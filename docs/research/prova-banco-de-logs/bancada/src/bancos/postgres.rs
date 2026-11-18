use crate::modelo::{dia_de, Consulta, EventoGravavel, LinhaEncontrada, ResultadoBusca, MILISSEGUNDOS_POR_DIA};
use anyhow::{anyhow, Result};
use futures::{pin_mut, StreamExt};
use std::collections::HashSet;
use std::time::{Duration, Instant};
use tokio::sync::mpsc::Sender;
use tokio::sync::Mutex;
use tokio_postgres::binary_copy::BinaryCopyInWriter;
use tokio_postgres::types::{ToSql, Type};
use tokio_postgres::error::SqlState;
use tokio_postgres::{Client, NoTls};

const CRIAR_TABELA: &str = r#"
CREATE TABLE IF NOT EXISTS eventos (
    id text NOT NULL,
    ts_ms bigint NOT NULL,
    recebido_ms bigint NOT NULL,
    produto text NOT NULL,
    aplicacao text NOT NULL,
    execucao text NOT NULL,
    seq bigint NOT NULL,
    url text NOT NULL,
    valor_centavos bigint,
    termos text[] NOT NULL,
    palavras text NOT NULL,
    corpo text COMPRESSION lz4 NOT NULL,
    campos text COMPRESSION lz4 NOT NULL,
    palavras_busca tsvector GENERATED ALWAYS AS (to_tsvector('simple', palavras)) STORED
) PARTITION BY RANGE (ts_ms);
CREATE INDEX IF NOT EXISTS eventos_ts ON eventos USING brin (ts_ms);
CREATE INDEX IF NOT EXISTS eventos_termos ON eventos USING gin (termos) WITH (fastupdate = on);
CREATE INDEX IF NOT EXISTS eventos_palavras ON eventos USING gin (palavras_busca);
CREATE INDEX IF NOT EXISTS eventos_url ON eventos (url text_pattern_ops);
CREATE INDEX IF NOT EXISTS eventos_valor ON eventos (valor_centavos) WHERE valor_centavos IS NOT NULL;
"#;

const TIPOS_COPIA: [Type; 13] = [
    Type::TEXT, Type::INT8, Type::INT8, Type::TEXT, Type::TEXT, Type::TEXT,
    Type::INT8, Type::TEXT, Type::INT8, Type::TEXT_ARRAY, Type::TEXT, Type::TEXT, Type::TEXT,
];

pub struct BancoPostgres {
    endereco: String,
    conexao_escrita: Mutex<Option<Client>>,
    conexoes_leitura: Vec<Mutex<Option<Client>>>,
    particoes_criadas: Mutex<HashSet<i64>>,
}

async fn conectar(endereco: &str) -> Result<Client> {
    let (cliente, conexao) = tokio_postgres::connect(endereco, NoTls).await?;
    tokio::spawn(async move {
        let _ = conexao.await;
    });
    Ok(cliente)
}

fn foi_cancelada_por_prazo(erro: &anyhow::Error) -> bool {
    erro.downcast_ref::<tokio_postgres::Error>()
        .and_then(tokio_postgres::Error::code)
        .is_some_and(|codigo| *codigo == SqlState::QUERY_CANCELED)
}

async fn garantir_conexao<'vaga>(
    vaga: &'vaga mut Option<Client>,
    endereco: &str,
) -> Result<&'vaga mut Client> {
    let precisa_conectar = vaga.as_ref().is_none_or(Client::is_closed);
    if precisa_conectar {
        *vaga = Some(conectar(endereco).await?);
    }
    vaga.as_mut().ok_or_else(|| anyhow!("sem conexão"))
}

impl BancoPostgres {
    pub async fn novo(endereco: &str) -> Result<Self> {
        Ok(Self {
            endereco: endereco.to_string(),
            conexao_escrita: Mutex::new(None),
            conexoes_leitura: (0..4).map(|_| Mutex::new(None)).collect(),
            particoes_criadas: Mutex::new(HashSet::new()),
        })
    }

    async fn vaga_leitura(&self) -> tokio::sync::MutexGuard<'_, Option<Client>> {
        for vaga in &self.conexoes_leitura {
            if let Ok(travada) = vaga.try_lock() {
                return travada;
            }
        }
        self.conexoes_leitura[0].lock().await
    }

    pub async fn preparar(&self) -> Result<()> {
        let mut vaga = self.conexao_escrita.lock().await;
        let cliente = garantir_conexao(&mut vaga, &self.endereco).await?;
        cliente.batch_execute(CRIAR_TABELA).await?;
        Ok(())
    }

    async fn garantir_particoes(&self, cliente: &Client, eventos: &[EventoGravavel]) -> Result<()> {
        let mut criadas = self.particoes_criadas.lock().await;
        let dias: HashSet<i64> = eventos.iter().map(|evento| dia_de(evento.ts_ms)).collect();
        for dia in dias {
            if criadas.contains(&dia) {
                continue;
            }
            let inicio_ms = dia * MILISSEGUNDOS_POR_DIA;
            let fim_ms = inicio_ms + MILISSEGUNDOS_POR_DIA;
            cliente
                .batch_execute(&format!(
                    "CREATE TABLE IF NOT EXISTS eventos_{dia} PARTITION OF eventos FOR VALUES FROM ({inicio_ms}) TO ({fim_ms})"
                ))
                .await?;
            criadas.insert(dia);
        }
        Ok(())
    }

    pub async fn gravar(&self, eventos: &[EventoGravavel]) -> Result<()> {
        let mut vaga = self.conexao_escrita.lock().await;
        let cliente = garantir_conexao(&mut vaga, &self.endereco).await?;
        self.garantir_particoes(cliente, eventos).await?;
        let transacao = cliente.transaction().await?;
        let destino = transacao
            .copy_in("COPY eventos (id, ts_ms, recebido_ms, produto, aplicacao, execucao, seq, url, valor_centavos, termos, palavras, corpo, campos) FROM STDIN (FORMAT binary)")
            .await?;
        let escritor = BinaryCopyInWriter::new(destino, &TIPOS_COPIA);
        pin_mut!(escritor);
        for evento in eventos {
            let seq = evento.seq as i64;
            let colunas: [&(dyn ToSql + Sync); 13] = [
                &evento.id, &evento.ts_ms, &evento.recebido_ms, &evento.produto, &evento.aplicacao,
                &evento.execucao, &seq, &evento.url, &evento.valor_centavos, &evento.termos,
                &evento.palavras, &evento.corpo, &evento.campos,
            ];
            escritor.as_mut().write(&colunas).await?;
        }
        escritor.finish().await?;
        transacao.commit().await?;
        Ok(())
    }

    pub async fn ids_recentes(&self, recebido_desde_ms: i64, ts_desde_ms: i64) -> Result<Vec<String>> {
        let mut vaga = self.vaga_leitura().await;
        let cliente = garantir_conexao(&mut vaga, &self.endereco).await?;
        let linhas = cliente
            .query("SELECT id FROM eventos WHERE ts_ms >= $1 AND recebido_ms >= $2", &[&ts_desde_ms, &recebido_desde_ms])
            .await?;
        Ok(linhas.iter().map(|linha| linha.get(0)).collect())
    }

    async fn buscar_no_trecho(
        cliente: &Client,
        consulta: &Consulta,
        desde_ms: i64,
        ate_ms: i64,
        limite: i64,
    ) -> Result<Vec<LinhaEncontrada>> {
        let mut filtros = vec!["ts_ms >= $1".to_string(), "ts_ms < $2".to_string()];
        let mut parametros: Vec<Box<dyn ToSql + Sync + Send>> = vec![Box::new(desde_ms), Box::new(ate_ms)];
        let mut adicionar = |modelo_filtro: &str, valor: Box<dyn ToSql + Sync + Send>| {
            parametros.push(valor);
            filtros.push(modelo_filtro.replace('?', &format!("${}", parametros.len())));
        };
        if let Some(produto) = &consulta.produto {
            adicionar("produto = ?", Box::new(produto.clone()));
        }
        if !consulta.termos.is_empty() {
            adicionar("termos @> ?::text[]", Box::new(consulta.termos.clone()));
        }
        if let Some(prefixo) = &consulta.prefixo_url {
            let padrao = format!("{}%", prefixo.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_"));
            adicionar("url LIKE ?", Box::new(padrao));
        }
        if let Some(valor_minimo) = consulta.valor_minimo {
            adicionar("valor_centavos >= ?", Box::new(valor_minimo));
        }
        if let Some(valor_maximo) = consulta.valor_maximo {
            adicionar("valor_centavos <= ?", Box::new(valor_maximo));
        }
        if let Some(palavra) = &consulta.palavra {
            adicionar("palavras_busca @@ plainto_tsquery('simple', ?)", Box::new(palavra.clone()));
        }
        if let Some(texto) = &consulta.texto_livre {
            adicionar("corpo ~* ?", Box::new(format!("\\m{texto}\\M")));
        }
        if let Some(regex) = &consulta.regex_url {
            adicionar("url ~ ?", Box::new(regex.clone()));
        }
        parametros.push(Box::new(limite));
        let sql = format!(
            "SELECT id, ts_ms, campos FROM eventos WHERE {} ORDER BY ts_ms DESC LIMIT ${}",
            filtros.join(" AND "),
            parametros.len()
        );
        let referencias: Vec<&(dyn ToSql + Sync)> =
            parametros.iter().map(|parametro| parametro.as_ref() as &(dyn ToSql + Sync)).collect();
        let linhas = cliente.query(&sql, &referencias).await?;
        Ok(linhas
            .iter()
            .map(|linha| LinhaEncontrada { id: linha.get(0), ts_ms: linha.get(1), campos: linha.get(2) })
            .collect())
    }

    pub async fn buscar(&self, consulta: &Consulta, prazo: Option<Duration>) -> Result<ResultadoBusca> {
        let mut vaga = self.vaga_leitura().await;
        let cliente = garantir_conexao(&mut vaga, &self.endereco).await?;
        let Some(duracao) = prazo else {
            cliente.batch_execute("SET statement_timeout = 0").await?;
            let linhas = Self::buscar_no_trecho(cliente, consulta, consulta.desde_ms, consulta.ate_ms, consulta.limite as i64).await?;
            return Ok(ResultadoBusca { linhas, parcial: false });
        };
        // Busca lenta: do dia mais novo ao mais velho, devolvendo o que deu tempo.
        let inicio = Instant::now();
        let mut resultado = ResultadoBusca::default();
        let mut fim_trecho_ms = consulta.ate_ms;
        while fim_trecho_ms > consulta.desde_ms && (resultado.linhas.len() as u32) < consulta.limite {
            let restante = duracao.saturating_sub(inicio.elapsed());
            if restante.is_zero() {
                resultado.parcial = true;
                break;
            }
            let inicio_dia_ms = (dia_de(fim_trecho_ms - 1)) * MILISSEGUNDOS_POR_DIA;
            let inicio_trecho_ms = inicio_dia_ms.max(consulta.desde_ms);
            cliente.batch_execute(&format!("SET statement_timeout = {}", restante.as_millis().max(1))).await?;
            let faltam = consulta.limite as i64 - resultado.linhas.len() as i64;
            match Self::buscar_no_trecho(cliente, consulta, inicio_trecho_ms, fim_trecho_ms, faltam).await {
                Ok(linhas) => resultado.linhas.extend(linhas),
                Err(erro) if foi_cancelada_por_prazo(&erro) => {
                    resultado.parcial = true;
                    break;
                }
                Err(erro) => return Err(erro),
            }
            fim_trecho_ms = inicio_trecho_ms;
        }
        cliente.batch_execute("SET statement_timeout = 0").await?;
        Ok(resultado)
    }

    pub async fn listar_presentes(&self, desde_ms: i64, saida: Sender<String>) -> Result<()> {
        let mut vaga = self.vaga_leitura().await;
        let cliente = garantir_conexao(&mut vaga, &self.endereco).await?;
        let parametros: [&(dyn ToSql + Sync); 1] = [&desde_ms];
        let linhas = cliente
            .query_raw("SELECT aplicacao, execucao, seq FROM eventos WHERE ts_ms >= $1", parametros.iter().copied())
            .await?;
        pin_mut!(linhas);
        let mut bloco = String::new();
        while let Some(linha) = linhas.next().await {
            let linha = linha?;
            let aplicacao: &str = linha.get(0);
            let execucao: &str = linha.get(1);
            let seq: i64 = linha.get(2);
            bloco.push_str(&format!("{aplicacao} {execucao} {seq}\n"));
            if bloco.len() > 1_000_000 {
                saida.send(std::mem::take(&mut bloco)).await.map_err(|_| anyhow!("leitor encerrou"))?;
            }
        }
        saida.send(bloco).await.map_err(|_| anyhow!("leitor encerrou"))?;
        Ok(())
    }

    pub async fn apagar_dias_ate(&self, dia_final_exclusivo: i64) -> Result<()> {
        let mut vaga = self.conexao_escrita.lock().await;
        let cliente = garantir_conexao(&mut vaga, &self.endereco).await?;
        let particoes = cliente
            .query("SELECT inhrelid::regclass::text FROM pg_inherits WHERE inhparent = 'eventos'::regclass", &[])
            .await?;
        let mut criadas = self.particoes_criadas.lock().await;
        for particao in particoes {
            let nome: String = particao.get(0);
            let dia = nome.trim_start_matches("eventos_").parse::<i64>().unwrap_or(i64::MAX);
            if dia < dia_final_exclusivo {
                cliente.batch_execute(&format!("DROP TABLE {nome}")).await?;
                criadas.remove(&dia);
            }
        }
        Ok(())
    }

    pub async fn apagar_pessoa(&self, termo_pessoa: &str) -> Result<()> {
        let mut vaga = self.conexao_escrita.lock().await;
        let cliente = garantir_conexao(&mut vaga, &self.endereco).await?;
        let termos = vec![termo_pessoa.to_string()];
        cliente.execute("DELETE FROM eventos WHERE termos @> $1::text[]", &[&termos]).await?;
        Ok(())
    }
}
