//! Servidor mínimo da prova: igual para todos os bancos, só o adaptador muda.
use anyhow::{Context, Result};
use axum::{
    body::{Body, Bytes},
    extract::{DefaultBodyLimit, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use bancada::bancos::Banco;
use bancada::modelo::*;
use flate2::read::GzDecoder;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, oneshot, Semaphore};
use tokio_stream::wrappers::ReceiverStream;
use tokio_stream::StreamExt;

const JANELA_REENVIO_MS: i64 = 16 * 60 * 1000;
const MAIOR_ATRASO_DE_VINCULO_MS: i64 = 2 * 3_600_000 + 20 * 60 * 1000;
const JANELA_AGRUPAMENTO: Duration = Duration::from_millis(200);
const LIMITE_EVENTOS_GRUPO: usize = 5_000;
const PRAZO_BUSCA_LENTA: Duration = Duration::from_secs(10);
const CAMPOS_DE_VINCULO: [&str; 3] = ["reservationId", "pspTxId", "refundId"];
const MAXIMO_EVENTOS_LINHA_DO_TEMPO: usize = 5_000;

struct PedidoGravacao {
    eventos: Vec<Evento>,
    resposta: oneshot::Sender<Result<RespostaLote, String>>,
}

struct Estado {
    banco: Arc<Banco>,
    gravador: mpsc::Sender<PedidoGravacao>,
    buscas_lentas: Arc<Semaphore>,
    pasta_dados: String,
    reserva_bytes: u64,
}

struct MemoriaReenvio {
    vistos: HashMap<String, i64>,
    incerta: bool,
}

impl MemoriaReenvio {
    fn limpar(&mut self, agora: i64) {
        self.vistos.retain(|_, recebido_ms| *recebido_ms >= agora - JANELA_REENVIO_MS);
    }

    async fn reconciliar(&mut self, banco: &Banco) -> Result<()> {
        let agora = agora_ms();
        let ids = banco.ids_recentes(agora - JANELA_REENVIO_MS, agora - MAIOR_ATRASO_DE_VINCULO_MS).await?;
        self.vistos.extend(ids.into_iter().map(|id| (id, agora)));
        self.incerta = false;
        Ok(())
    }
}

/// Grava em grupos: confirma só depois que o banco disse que o dado está em disco.
async fn laco_gravador(banco: Arc<Banco>, mut entrada: mpsc::Receiver<PedidoGravacao>) {
    let mut memoria = MemoriaReenvio { vistos: HashMap::new(), incerta: true };
    while let Some(primeiro) = entrada.recv().await {
        let mut pedidos = vec![primeiro];
        let mut quantidade = pedidos[0].eventos.len();
        let limite_grupo = tokio::time::Instant::now() + JANELA_AGRUPAMENTO;
        while quantidade < LIMITE_EVENTOS_GRUPO {
            match tokio::time::timeout_at(limite_grupo, entrada.recv()).await {
                Ok(Some(pedido)) => {
                    quantidade += pedido.eventos.len();
                    pedidos.push(pedido);
                }
                _ => break,
            }
        }
        let desfecho = gravar_grupo(&banco, &mut memoria, &mut pedidos).await;
        for (pedido, contagem) in pedidos.into_iter().zip(desfecho.contagens) {
            let resposta = match &desfecho.falha {
                Some(mensagem) => Err(mensagem.clone()),
                None => Ok(contagem),
            };
            let _ = pedido.resposta.send(resposta);
        }
    }
}

struct DesfechoGrupo {
    contagens: Vec<RespostaLote>,
    falha: Option<String>,
}

async fn gravar_grupo(banco: &Banco, memoria: &mut MemoriaReenvio, pedidos: &mut [PedidoGravacao]) -> DesfechoGrupo {
    let mut contagens = vec![RespostaLote::default(); pedidos.len()];
    if memoria.incerta {
        if let Err(erro) = memoria.reconciliar(banco).await {
            return DesfechoGrupo { contagens, falha: Some(format!("reconciliação: {erro}")) };
        }
    }
    let agora = agora_ms();
    memoria.limpar(agora);
    let mut novos_no_grupo: HashSet<String> = HashSet::new();
    let mut gravaveis = Vec::new();
    for (posicao, pedido) in pedidos.iter_mut().enumerate() {
        for evento in std::mem::take(&mut pedido.eventos) {
            if memoria.vistos.contains_key(&evento.id) || !novos_no_grupo.insert(evento.id.clone()) {
                contagens[posicao].duplicados += 1;
            } else {
                contagens[posicao].aceitos += 1;
                gravaveis.push(EventoGravavel::de_evento(evento, agora));
            }
        }
    }
    if gravaveis.is_empty() {
        return DesfechoGrupo { contagens, falha: None };
    }
    match banco.gravar(&gravaveis).await {
        Ok(()) => {
            memoria.vistos.extend(novos_no_grupo.into_iter().map(|id| (id, agora)));
            DesfechoGrupo { contagens, falha: None }
        }
        Err(erro) => {
            // A gravação pode ter acontecido mesmo com erro: reconcilia antes da próxima.
            memoria.incerta = true;
            DesfechoGrupo { contagens, falha: Some(erro.to_string()) }
        }
    }
}

fn tente_depois(mensagem: String) -> Response {
    (StatusCode::SERVICE_UNAVAILABLE, [(header::RETRY_AFTER, "1")], mensagem).into_response()
}

fn falha_interna(erro: anyhow::Error) -> Response {
    (StatusCode::INTERNAL_SERVER_ERROR, erro.to_string()).into_response()
}

#[derive(Deserialize)]
struct CorpoLote {
    eventos: Vec<Evento>,
}

fn abrir_lote(cabecalhos: &HeaderMap, corpo: &[u8]) -> Result<Vec<Evento>> {
    let comprimido = cabecalhos.get(header::CONTENT_ENCODING).is_some_and(|valor| valor == "gzip");
    let lote: CorpoLote = if comprimido {
        let mut texto = Vec::new();
        GzDecoder::new(corpo).take(64 * 1024 * 1024).read_to_end(&mut texto)?;
        serde_json::from_slice(&texto)?
    } else {
        serde_json::from_slice(corpo)?
    };
    Ok(lote.eventos)
}

async fn receber_eventos(State(estado): State<Arc<Estado>>, cabecalhos: HeaderMap, corpo: Bytes) -> Response {
    let espaco_livre = fs2::available_space(&estado.pasta_dados).unwrap_or(u64::MAX);
    if espaco_livre < estado.reserva_bytes {
        return tente_depois("disco na reserva".to_string());
    }
    let eventos = match abrir_lote(&cabecalhos, &corpo) {
        Ok(eventos) => eventos,
        Err(erro) => return (StatusCode::BAD_REQUEST, erro.to_string()).into_response(),
    };
    let (resposta, aguardando) = oneshot::channel();
    if estado.gravador.try_send(PedidoGravacao { eventos, resposta }).is_err() {
        return tente_depois("fila de gravação cheia".to_string());
    }
    match aguardando.await {
        Ok(Ok(contagem)) => Json(contagem).into_response(),
        Ok(Err(mensagem)) => tente_depois(mensagem),
        Err(_) => tente_depois("gravador encerrado".to_string()),
    }
}

async fn buscar(State(estado): State<Arc<Estado>>, Json(pedido): Json<PedidoBusca>) -> Response {
    if !pedido.lenta {
        return match estado.banco.buscar(&pedido.consulta, None).await {
            Ok(resultado) => Json(resultado).into_response(),
            Err(erro) => falha_interna(erro),
        };
    }
    // No máximo 2 buscas lentas: a terceira simultânea é recusada (#9).
    let Ok(_vaga) = estado.buscas_lentas.clone().try_acquire_owned() else {
        return (StatusCode::TOO_MANY_REQUESTS, "limite de buscas lentas").into_response();
    };
    match estado.banco.buscar(&pedido.consulta, Some(PRAZO_BUSCA_LENTA)).await {
        Ok(resultado) => Json(resultado).into_response(),
        Err(erro) => falha_interna(erro),
    }
}

async fn linha_do_tempo(State(estado): State<Arc<Estado>>, Json(pedido): Json<PedidoLinhaDoTempo>) -> Response {
    match percorrer_vinculos(&estado.banco, pedido).await {
        Ok(resposta) => Json(resposta).into_response(),
        Err(erro) => falha_interna(erro),
    }
}

async fn percorrer_vinculos(banco: &Banco, pedido: PedidoLinhaDoTempo) -> Result<RespostaLinhaDoTempo> {
    let mut resposta = RespostaLinhaDoTempo::default();
    let mut visitados: HashSet<String> = HashSet::new();
    let mut fronteira = vec![pedido.termo_inicial.clone()];
    let mut ids_vistos: HashSet<String> = HashSet::new();
    while !fronteira.is_empty() && resposta.saltos_feitos < pedido.saltos {
        resposta.saltos_feitos += 1;
        let mut proxima_fronteira = Vec::new();
        for termo in fronteira {
            if !visitados.insert(termo.clone()) {
                continue;
            }
            resposta.termos_visitados.push(termo.clone());
            let consulta = Consulta {
                desde_ms: pedido.desde_ms,
                ate_ms: pedido.ate_ms,
                termos: vec![termo],
                limite: MAXIMO_EVENTOS_LINHA_DO_TEMPO as u32,
                ..Consulta::default()
            };
            for linha in banco.buscar(&consulta, None).await?.linhas {
                if !ids_vistos.insert(linha.id) {
                    continue;
                }
                let campos: HashMap<String, String> = serde_json::from_str(&linha.campos).unwrap_or_default();
                for nome_campo in CAMPOS_DE_VINCULO {
                    if let Some(valor) = campos.get(nome_campo) {
                        let vizinho = format!("{nome_campo}={valor}");
                        if !visitados.contains(&vizinho) && !proxima_fronteira.contains(&vizinho) {
                            proxima_fronteira.push(vizinho);
                        }
                    }
                }
            }
            if ids_vistos.len() >= MAXIMO_EVENTOS_LINHA_DO_TEMPO {
                resposta.cortada = true;
                proxima_fronteira.clear();
                break;
            }
        }
        fronteira = proxima_fronteira;
    }
    resposta.eventos = ids_vistos.len();
    Ok(resposta)
}

#[derive(Deserialize)]
struct ParametrosPresentes {
    desde_ms: i64,
}

async fn listar_presentes(State(estado): State<Arc<Estado>>, Query(parametros): Query<ParametrosPresentes>) -> Response {
    let (saida, entrada) = mpsc::channel::<String>(16);
    let banco = estado.banco.clone();
    let (aviso_erro, erro_recebido) = oneshot::channel::<String>();
    tokio::spawn(async move {
        if let Err(erro) = banco.listar_presentes(parametros.desde_ms, saida).await {
            let _ = aviso_erro.send(erro.to_string());
        }
    });
    let linhas = ReceiverStream::new(entrada).map(|bloco| Ok::<_, std::io::Error>(Bytes::from(bloco)));
    let desfecho = futures::stream::once(async move {
        match erro_recebido.await {
            Ok(mensagem) => Err(std::io::Error::other(mensagem)),
            Err(_) => Ok(Bytes::new()),
        }
    });
    Body::from_stream(linhas.chain(desfecho)).into_response()
}

#[derive(Deserialize)]
struct PedidoExclusao {
    dia_final_exclusivo: Option<i64>,
    termo_pessoa: Option<String>,
}

async fn apagar(State(estado): State<Arc<Estado>>, Json(pedido): Json<PedidoExclusao>) -> Response {
    let resultado = async {
        if let Some(dia) = pedido.dia_final_exclusivo {
            estado.banco.apagar_dias_ate(dia).await?;
        }
        if let Some(termo) = &pedido.termo_pessoa {
            estado.banco.apagar_pessoa(termo).await?;
        }
        anyhow::Ok(())
    }
    .await;
    match resultado {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(erro) => falha_interna(erro),
    }
}

fn variavel(nome: &str, padrao: &str) -> String {
    std::env::var(nome).unwrap_or_else(|_| padrao.to_string())
}

#[tokio::main]
async fn main() -> Result<()> {
    let nome_banco = std::env::var("BANCO").context("defina BANCO")?;
    let endereco_banco = std::env::var("ENDERECO_BANCO").context("defina ENDERECO_BANCO")?;
    let banco = Arc::new(Banco::conectar(&nome_banco, &endereco_banco).await?);
    let mut tentativas_restantes = 60;
    while let Err(erro) = banco.preparar().await {
        tentativas_restantes -= 1;
        if tentativas_restantes == 0 {
            return Err(erro.context("banco não ficou pronto"));
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
    let (gravador, entrada_gravador) = mpsc::channel(256);
    tokio::spawn(laco_gravador(banco.clone(), entrada_gravador));
    let estado = Arc::new(Estado {
        banco,
        gravador,
        buscas_lentas: Arc::new(Semaphore::new(2)),
        pasta_dados: variavel("PASTA_DADOS", "."),
        reserva_bytes: variavel("RESERVA_BYTES", "0").parse()?,
    });
    let rotas = Router::new()
        .route("/saude", get(|| async { "ok" }))
        .route("/v1/eventos", post(receber_eventos))
        .route("/v1/busca", post(buscar))
        .route("/v1/linha-do-tempo", post(linha_do_tempo))
        .route("/v1/presentes", get(listar_presentes))
        .route("/v1/exclusoes", post(apagar))
        .layer(DefaultBodyLimit::max(16 * 1024 * 1024))
        .with_state(estado);
    let endereco_escuta = format!("0.0.0.0:{}", variavel("PORTA", "8080"));
    let ouvinte = tokio::net::TcpListener::bind(&endereco_escuta).await?;
    println!("servidor pronto em {endereco_escuta} usando {nome_banco}");
    axum::serve(ouvinte, rotas).await?;
    Ok(())
}
