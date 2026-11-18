//! Gerador de carga em taxa aberta. Roda em outra máquina e anota cada confirmação em disco.
use anyhow::Result;
use bancada::catalogo::{buscas_garantidas, buscas_lentas, BuscaCatalogo, PedidoCatalogo};
use bancada::cliente::{ClienteBancada, ResultadoEnvio};
use bancada::geracao::*;
use bancada::modelo::*;
use clap::{Parser, Subcommand};
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::Semaphore;
use tokio::time::{interval_at, sleep, sleep_until, Instant, MissedTickBehavior};

const PRAZO_TENTATIVAS: Duration = Duration::from_secs(300);
const INTERVALO_BUSCA: Duration = Duration::from_secs(5);
const INTERVALO_SONDA: Duration = Duration::from_secs(5);
const LIMITE_SONDA: Duration = Duration::from_secs(120);

#[derive(Parser)]
struct Argumentos {
    #[arg(long, default_value = "http://127.0.0.1:8080")]
    servidor: String,
    #[arg(long)]
    saida: PathBuf,
    #[arg(long, default_value_t = 20261118)]
    semente: u64,
    #[arg(long, default_value_t = 1)]
    multiplicador_valores: u64,
    #[arg(long)]
    execucao: String,
    #[command(subcommand)]
    modo: Modo,
}

#[derive(Subcommand)]
enum Modo {
    /// Carrega histórico o mais rápido que o servidor aceitar.
    Historico {
        #[arg(long, default_value_t = 30)]
        dias: i64,
        #[arg(long, default_value_t = 1_000_000)]
        eventos_por_dia: u64,
        #[arg(long, default_value_t = 1000)]
        tamanho_lote: u64,
        #[arg(long, default_value_t = 4)]
        envios_simultaneos: usize,
    },
    /// Ritmo real, com picos e buscas.
    Ritmo {
        #[arg(long)]
        duracao_s: u64,
        #[arg(long, default_value_t = 12.0)]
        eventos_por_segundo: f64,
        /// Lista "inicio_s:duracao_s:eventos_por_segundo", separada por vírgula.
        #[arg(long, default_value = "")]
        picos: String,
        #[arg(long, default_value_t = 840)]
        reenvio_apos_s: u64,
        #[arg(long)]
        sem_buscas: bool,
    },
    /// Cada busca 3 vezes (1 fria, 2 quentes); o frio é preparado por fora.
    Bateria {
        #[arg(long)]
        rotulo: String,
    },
}

struct Pico {
    inicio_s: u64,
    duracao_s: u64,
    eventos_por_segundo: f64,
}

fn ler_picos(texto: &str) -> Result<Vec<Pico>> {
    texto
        .split(',')
        .filter(|trecho| !trecho.trim().is_empty())
        .map(|trecho| {
            let partes: Vec<&str> = trecho.trim().split(':').collect();
            anyhow::ensure!(partes.len() == 3, "pico inválido: {trecho}");
            Ok(Pico {
                inicio_s: partes[0].parse()?,
                duracao_s: partes[1].parse()?,
                eventos_por_segundo: partes[2].parse()?,
            })
        })
        .collect()
}

/// Arquivo CSV compartilhado; o de confirmações vai ao disco a cada linha.
#[derive(Clone)]
struct Registro {
    arquivo: Arc<Mutex<BufWriter<File>>>,
    sincronizar: bool,
}

impl Registro {
    fn abrir(caminho: &Path, cabecalho: &str, sincronizar: bool) -> Result<Self> {
        let novo = !caminho.exists();
        let arquivo = OpenOptions::new().create(true).append(true).open(caminho)?;
        let mut escritor = BufWriter::new(arquivo);
        if novo {
            writeln!(escritor, "{cabecalho}")?;
        }
        Ok(Self { arquivo: Arc::new(Mutex::new(escritor)), sincronizar })
    }

    fn escrever(&self, linha: String) {
        let Ok(mut escritor) = self.arquivo.lock() else { return };
        let _ = writeln!(escritor, "{linha}");
        let _ = escritor.flush();
        if self.sincronizar {
            let _ = escritor.get_ref().sync_data();
        }
    }
}

#[derive(Clone)]
struct Contexto {
    cliente: ClienteBancada,
    parametros: ParametrosGeracao,
    execucao: String,
    confirmados: Registro,
    envios: Registro,
    buscas: Registro,
    visibilidade: Registro,
    perdidos: Arc<AtomicU64>,
}

/// Envia até confirmar ou esgotar os 5 min de tentativas da biblioteca.
async fn enviar_com_tentativas(
    contexto: &Contexto,
    indice_aplicacao: usize,
    eventos: Vec<Evento>,
    agendado: Instant,
    registrar_confirmacao: bool,
) -> bool {
    let quantidade = eventos.len();
    let mut tentativas = 0u32;
    loop {
        tentativas += 1;
        match contexto.cliente.enviar_lote(&eventos).await {
            ResultadoEnvio::Confirmado(resposta) => {
                let latencia_ms = agendado.elapsed().as_millis();
                if registrar_confirmacao {
                    let menor_ts = eventos.iter().map(|evento| evento.ts_ms).min().unwrap_or(0);
                    let primeiro_seq = eventos.first().map_or(0, |evento| evento.seq);
                    let ultimo_seq = eventos.last().map_or(0, |evento| evento.seq);
                    contexto.confirmados.escrever(format!(
                        "{} {} {primeiro_seq} {ultimo_seq} {menor_ts}",
                        APLICACOES[indice_aplicacao].aplicacao, contexto.execucao
                    ));
                }
                contexto.envios.escrever(format!(
                    "{},{},{quantidade},{latencia_ms},{tentativas},{},{}",
                    agora_ms(), APLICACOES[indice_aplicacao].aplicacao, resposta.aceitos, resposta.duplicados
                ));
                return true;
            }
            ResultadoEnvio::TenteDepois(espera) => {
                if agendado.elapsed() >= PRAZO_TENTATIVAS {
                    contexto.perdidos.fetch_add(quantidade as u64, Ordering::Relaxed);
                    contexto.envios.escrever(format!(
                        "{},{},{quantidade},-1,{tentativas},0,0",
                        agora_ms(), APLICACOES[indice_aplicacao].aplicacao
                    ));
                    return false;
                }
                sleep(espera).await;
            }
        }
    }
}

async fn carregar_historico(
    contexto: Contexto,
    dias: i64,
    eventos_por_dia: u64,
    tamanho_lote: u64,
    envios_simultaneos: usize,
) -> Result<()> {
    let fim_ms = agora_ms() - 3_600_000;
    let inicio_ms = fim_ms - dias * MILISSEGUNDOS_POR_DIA;
    let total_eventos = dias as u64 * eventos_por_dia;
    let vagas = Arc::new(Semaphore::new(envios_simultaneos));
    let mut proximo_seq = [0u64; APLICACOES.len()];
    let mut enviados = 0u64;
    let inicio_carga = Instant::now();
    while enviados < total_eventos {
        for (indice_aplicacao, aplicacao) in APLICACOES.iter().enumerate() {
            let tamanho = ((tamanho_lote as f64 * aplicacao.peso / 0.2).ceil() as u64).max(1);
            let primeiro_seq = proximo_seq[indice_aplicacao];
            proximo_seq[indice_aplicacao] += tamanho;
            let progresso = enviados as f64 / total_eventos as f64;
            let ts_lote_ms = inicio_ms + (progresso * (fim_ms - inicio_ms) as f64) as i64;
            enviados += tamanho;
            let vaga = vagas.clone().acquire_owned().await?;
            let contexto_envio = contexto.clone();
            tokio::spawn(async move {
                let eventos: Vec<Evento> = (primeiro_seq..primeiro_seq + tamanho)
                    .map(|seq| {
                        let ts_ms = ts_lote_ms + (seq - primeiro_seq) as i64;
                        gerar_evento(contexto_envio.parametros, indice_aplicacao, &contexto_envio.execucao, seq, ts_ms)
                    })
                    .collect();
                enviar_com_tentativas(&contexto_envio, indice_aplicacao, eventos, Instant::now(), true).await;
                drop(vaga);
            });
        }
        if enviados % 1_000_000 < tamanho_lote * 4 {
            println!("carregados {enviados}/{total_eventos} em {} s", inicio_carga.elapsed().as_secs());
        }
    }
    let _ = vagas.acquire_many(envios_simultaneos as u32).await?;
    println!("histórico: {enviados} eventos em {} s", inicio_carga.elapsed().as_secs());
    Ok(())
}

fn taxa_no_instante(segundos: u64, base: f64, picos: &[Pico]) -> f64 {
    picos
        .iter()
        .find(|pico| (pico.inicio_s..pico.inicio_s + pico.duracao_s).contains(&segundos))
        .map_or(base, |pico| pico.eventos_por_segundo)
}

async fn laco_aplicacao(
    contexto: Contexto,
    indice_aplicacao: usize,
    duracao_s: u64,
    base: f64,
    picos: Arc<Vec<Pico>>,
    reenvio_apos: Duration,
) {
    let peso = APLICACOES[indice_aplicacao].peso;
    let defasagem = Duration::from_millis(125 * indice_aplicacao as u64);
    let inicio = Instant::now() + defasagem;
    let mut relogio = interval_at(inicio, Duration::from_secs(1));
    relogio.set_missed_tick_behavior(MissedTickBehavior::Burst);
    let mut proximo_seq = 0u64;
    let mut acumulado = 0f64;
    for segundo in 0..duracao_s {
        let agendado = relogio.tick().await;
        acumulado += taxa_no_instante(segundo, base, &picos) * peso;
        let quantidade = acumulado.floor() as u64;
        acumulado -= quantidade as f64;
        if quantidade == 0 {
            continue;
        }
        let agora = agora_ms();
        let semente = contexto.parametros.semente;
        let eventos: Vec<Evento> = (proximo_seq..proximo_seq + quantidade)
            .map(|seq| {
                let ts_ms = agora - atraso_do_vinculo_ms(semente, indice_aplicacao, seq);
                gerar_evento(contexto.parametros, indice_aplicacao, &contexto.execucao, seq, ts_ms)
            })
            .collect();
        proximo_seq += quantidade;
        let reenvios: Vec<Evento> = eventos
            .iter()
            .filter(|evento| sera_reenviado(semente, indice_aplicacao, evento.seq))
            .cloned()
            .collect();
        let contexto_envio = contexto.clone();
        tokio::spawn(async move {
            let confirmado = enviar_com_tentativas(&contexto_envio, indice_aplicacao, eventos, agendado, true).await;
            if confirmado && !reenvios.is_empty() {
                sleep(reenvio_apos).await;
                enviar_com_tentativas(&contexto_envio, indice_aplicacao, reenvios, Instant::now(), false).await;
            }
        });
    }
}

async fn medir_busca(contexto: &Contexto, busca: &BuscaCatalogo, agendado: Instant, rotulo: &str) {
    let desfecho = contexto.cliente.executar(&busca.pedido).await;
    let latencia_ms = agendado.elapsed().as_millis();
    let (linhas, parcial, situacao) = match desfecho {
        Ok(resultado) if resultado.recusada => (0, false, "recusada"),
        Ok(resultado) => (resultado.linhas, resultado.parcial, "ok"),
        Err(_) => (0, false, "erro"),
    };
    contexto.buscas.escrever(format!(
        "{},{rotulo},{},{},{latencia_ms},{linhas},{parcial},{situacao}",
        agora_ms(), busca.nome, busca.janela
    ));
}

/// Duas pessoas, 1 busca a cada 5 s cada, em horário fixo mesmo se o banco atrasar.
async fn laco_investigador(contexto: Contexto, indice_pessoa: u64, duracao: Duration) {
    let inicio = Instant::now() + Duration::from_millis(2500 * indice_pessoa);
    let mut relogio = interval_at(inicio, INTERVALO_BUSCA);
    relogio.set_missed_tick_behavior(MissedTickBehavior::Burst);
    let mut rodada = indice_pessoa as usize * 7;
    while inicio.elapsed() < duracao {
        let agendado = relogio.tick().await;
        let agora = agora_ms();
        let mut catalogo = buscas_garantidas(agora);
        // A cada 12 buscas entra uma lenta, para o servidor provar corte e isolamento.
        catalogo.extend(buscas_lentas(agora));
        let busca = catalogo[rodada % catalogo.len()].clone();
        rodada += 1;
        let contexto_busca = contexto.clone();
        tokio::spawn(async move { medir_busca(&contexto_busca, &busca, agendado, "carga").await });
    }
}

/// Manda um evento marcado e mede quanto demora até a busca achar.
async fn laco_sonda(contexto: Contexto, duracao: Duration) {
    let inicio = Instant::now();
    let mut relogio = tokio::time::interval(INTERVALO_SONDA);
    let mut numero_sonda = 0u64;
    while inicio.elapsed() < duracao {
        relogio.tick().await;
        numero_sonda += 1;
        let contexto_sonda = contexto.clone();
        tokio::spawn(async move {
            let tardia = numero_sonda % 10 == 0;
            let atraso_ms = if tardia { 240_000 } else { 0 };
            let enviado_em = Instant::now();
            let ts_ms = agora_ms() - atraso_ms;
            let execucao_sonda = format!("sonda-{}", contexto_sonda.execucao);
            let mut evento = gerar_evento(contexto_sonda.parametros, 0, &execucao_sonda, numero_sonda, ts_ms);
            let termo = format!("sonda={}-{numero_sonda}", contexto_sonda.execucao);
            evento.campos.insert("sonda".to_string(), format!("{}-{numero_sonda}", contexto_sonda.execucao));
            if !enviar_com_tentativas(&contexto_sonda, 0, vec![evento], enviado_em, false).await {
                return;
            }
            let pedido = PedidoCatalogo::Busca {
                consulta: Consulta {
                    desde_ms: ts_ms - 1000,
                    ate_ms: agora_ms() + 600_000,
                    termos: vec![termo],
                    limite: 1,
                    ..Consulta::default()
                },
                lenta: false,
            };
            loop {
                if let Ok(resultado) = contexto_sonda.cliente.executar(&pedido).await {
                    if resultado.linhas > 0 {
                        contexto_sonda.visibilidade.escrever(format!(
                            "{},{tardia},{}", agora_ms(), enviado_em.elapsed().as_millis()
                        ));
                        return;
                    }
                }
                if enviado_em.elapsed() > LIMITE_SONDA {
                    contexto_sonda.visibilidade.escrever(format!("{},{tardia},-1", agora_ms()));
                    return;
                }
                sleep(Duration::from_millis(250)).await;
            }
        });
    }
}

async fn rodar_bateria(contexto: Contexto, rotulo: &str) {
    let agora = agora_ms();
    let mut catalogo = buscas_garantidas(agora);
    catalogo.extend(buscas_lentas(agora));
    for repeticao in ["fria", "quente-1", "quente-2"] {
        for busca in &catalogo {
            medir_busca(&contexto, busca, Instant::now(), &format!("{rotulo}-{repeticao}")).await;
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let argumentos = Argumentos::parse();
    fs::create_dir_all(&argumentos.saida)?;
    let pasta = &argumentos.saida;
    let contexto = Contexto {
        cliente: ClienteBancada::novo(&argumentos.servidor)?,
        parametros: ParametrosGeracao {
            semente: argumentos.semente,
            multiplicador_valores: argumentos.multiplicador_valores,
        },
        execucao: argumentos.execucao.clone(),
        confirmados: Registro::abrir(&pasta.join("confirmados.log"), "aplicacao execucao seq_inicial seq_final menor_ts_ms", true)?,
        envios: Registro::abrir(&pasta.join("envios.csv"), "instante_ms,aplicacao,eventos,latencia_ms,tentativas,aceitos,duplicados", false)?,
        buscas: Registro::abrir(&pasta.join("buscas.csv"), "instante_ms,rotulo,busca,janela,latencia_ms,linhas,parcial,situacao", false)?,
        visibilidade: Registro::abrir(&pasta.join("visibilidade.csv"), "instante_ms,tardia,latencia_ms", false)?,
        perdidos: Arc::new(AtomicU64::new(0)),
    };
    match argumentos.modo {
        Modo::Historico { dias, eventos_por_dia, tamanho_lote, envios_simultaneos } => {
            carregar_historico(contexto.clone(), dias, eventos_por_dia, tamanho_lote, envios_simultaneos).await?;
        }
        Modo::Bateria { rotulo } => rodar_bateria(contexto.clone(), &rotulo).await,
        Modo::Ritmo { duracao_s, eventos_por_segundo, picos, reenvio_apos_s, sem_buscas } => {
            let picos = Arc::new(ler_picos(&picos)?);
            let duracao = Duration::from_secs(duracao_s);
            let reenvio_apos = Duration::from_secs(reenvio_apos_s);
            let mut tarefas = Vec::new();
            for indice_aplicacao in 0..APLICACOES.len() {
                tarefas.push(tokio::spawn(laco_aplicacao(
                    contexto.clone(), indice_aplicacao, duracao_s, eventos_por_segundo, picos.clone(), reenvio_apos,
                )));
            }
            if !sem_buscas {
                for indice_pessoa in 0..2 {
                    tarefas.push(tokio::spawn(laco_investigador(contexto.clone(), indice_pessoa, duracao)));
                }
                tarefas.push(tokio::spawn(laco_sonda(contexto.clone(), duracao)));
            }
            for tarefa in tarefas {
                tarefa.await?;
            }
            // Dá tempo aos envios, reenvios e sondas que ainda estão em voo.
            sleep_until(Instant::now() + reenvio_apos.min(Duration::from_secs(900)) + Duration::from_secs(30)).await;
        }
    }
    println!("eventos sem confirmação após 5 min: {}", contexto.perdidos.load(Ordering::Relaxed));
    Ok(())
}
