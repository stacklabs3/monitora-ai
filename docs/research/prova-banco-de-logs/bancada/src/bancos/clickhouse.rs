use crate::modelo::{Consulta, EventoGravavel, LinhaEncontrada, ResultadoBusca, MILISSEGUNDOS_POR_DIA};
use anyhow::{anyhow, Result};
use futures::StreamExt;
use serde::Deserialize;
use std::time::Duration;
use tokio::sync::mpsc::Sender;

const CRIAR_TABELA: &str = r#"
CREATE TABLE IF NOT EXISTS eventos (
    id String CODEC(ZSTD(1)),
    ts_ms Int64 CODEC(Delta, ZSTD(1)),
    recebido_ms Int64 CODEC(Delta, ZSTD(1)),
    ts DateTime64(3) MATERIALIZED fromUnixTimestamp64Milli(ts_ms),
    produto LowCardinality(String),
    aplicacao LowCardinality(String),
    execucao LowCardinality(String),
    seq UInt64 CODEC(Delta, ZSTD(1)),
    url String CODEC(ZSTD(1)),
    valor_centavos Nullable(Int64),
    termos Array(String) CODEC(ZSTD(1)),
    palavras String CODEC(ZSTD(1)),
    corpo String CODEC(ZSTD(3)),
    campos String CODEC(ZSTD(3)),
    INDEX indice_termos termos TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX indice_palavras palavras TYPE tokenbf_v1(8192, 3, 0) GRANULARITY 1,
    INDEX indice_url url TYPE bloom_filter(0.01) GRANULARITY 1
) ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (produto, ts_ms)
SETTINGS fsync_after_insert = 1, fsync_part_directory = 1, min_rows_for_wide_part = 0
"#;

pub struct BancoClickHouse {
    http: reqwest::Client,
    endereco: String,
}

#[derive(Deserialize)]
struct LinhaClickHouse {
    id: String,
    ts_ms: i64,
    campos: String,
}

fn citar(texto: &str) -> String {
    format!("'{}'", texto.replace('\\', "\\\\").replace('\'', "\\'"))
}

fn instante(ts_ms: i64) -> String {
    format!("fromUnixTimestamp64Milli(toInt64({ts_ms}))")
}

impl BancoClickHouse {
    pub fn novo(endereco: &str) -> Result<Self> {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(120)).build()?;
        Ok(Self { http, endereco: endereco.trim_end_matches('/').to_string() })
    }

    async fn executar(&self, sql: String) -> Result<String> {
        let resposta = self.http.post(&self.endereco).body(sql).send().await?;
        let situacao = resposta.status();
        let texto = resposta.text().await?;
        if situacao.is_success() { Ok(texto) } else { Err(anyhow!("clickhouse {situacao}: {texto}")) }
    }

    pub async fn preparar(&self) -> Result<()> {
        self.executar(CRIAR_TABELA.to_string()).await.map(|_| ())
    }

    pub async fn gravar(&self, eventos: &[EventoGravavel]) -> Result<()> {
        let mut corpo = Vec::with_capacity(eventos.len() * 900);
        for evento in eventos {
            serde_json::to_writer(&mut corpo, evento)?;
            corpo.push(b'\n');
        }
        let resposta = self
            .http
            .post(&self.endereco)
            .query(&[
                ("query", "INSERT INTO eventos (id, ts_ms, recebido_ms, produto, aplicacao, execucao, seq, url, valor_centavos, termos, palavras, corpo, campos) FORMAT JSONEachRow"),
                ("async_insert", "0"),
                ("max_insert_threads", "1"),
                ("max_partitions_per_insert_block", "1000"),
            ])
            .body(corpo)
            .send()
            .await?;
        let situacao = resposta.status();
        if situacao.is_success() {
            Ok(())
        } else {
            Err(anyhow!("clickhouse {situacao}: {}", resposta.text().await.unwrap_or_default()))
        }
    }

    pub async fn ids_recentes(&self, recebido_desde_ms: i64, ts_desde_ms: i64) -> Result<Vec<String>> {
        let sql = format!(
            "SELECT id FROM eventos WHERE ts >= {} AND recebido_ms >= {recebido_desde_ms} FORMAT TSVRaw",
            instante(ts_desde_ms)
        );
        Ok(self.executar(sql).await?.lines().map(str::to_string).collect())
    }

    fn montar_filtros(consulta: &Consulta) -> String {
        let mut filtros = vec![
            format!("ts >= {}", instante(consulta.desde_ms)),
            format!("ts < {}", instante(consulta.ate_ms)),
        ];
        if let Some(produto) = &consulta.produto {
            filtros.push(format!("produto = {}", citar(produto)));
        }
        filtros.extend(consulta.termos.iter().map(|termo| format!("has(termos, {})", citar(termo))));
        if let Some(prefixo) = &consulta.prefixo_url {
            filtros.push(format!("startsWith(url, {})", citar(prefixo)));
        }
        if let Some(valor_minimo) = consulta.valor_minimo {
            filtros.push(format!("valor_centavos >= {valor_minimo}"));
        }
        if let Some(valor_maximo) = consulta.valor_maximo {
            filtros.push(format!("valor_centavos <= {valor_maximo}"));
        }
        if let Some(palavra) = &consulta.palavra {
            filtros.push(format!("hasTokenCaseInsensitive(palavras, {})", citar(palavra)));
        }
        if let Some(texto) = &consulta.texto_livre {
            filtros.push(format!("hasTokenCaseInsensitive(corpo, {})", citar(texto)));
        }
        if let Some(regex) = &consulta.regex_url {
            filtros.push(format!("match(url, {})", citar(regex)));
        }
        filtros.join(" AND ")
    }

    pub async fn buscar(&self, consulta: &Consulta, prazo: Option<Duration>) -> Result<ResultadoBusca> {
        let inicio = std::time::Instant::now();
        let configuracao_prazo = prazo
            .map(|duracao| format!(", max_execution_time = {:.3}, timeout_overflow_mode = 'break'", duracao.as_secs_f64()))
            .unwrap_or_default();
        let sql = format!(
            "SELECT id, ts_ms, campos FROM eventos WHERE {} ORDER BY ts_ms DESC LIMIT {} SETTINGS max_threads = 2{configuracao_prazo} FORMAT JSONEachRow",
            Self::montar_filtros(consulta),
            consulta.limite
        );
        let texto = self.executar(sql).await?;
        let mut linhas = Vec::new();
        for linha_json in texto.lines() {
            let linha: LinhaClickHouse = serde_json::from_str(linha_json)?;
            linhas.push(LinhaEncontrada { id: linha.id, ts_ms: linha.ts_ms, campos: linha.campos });
        }
        let parcial = prazo.is_some_and(|duracao| inicio.elapsed() >= duracao);
        Ok(ResultadoBusca { linhas, parcial })
    }

    pub async fn listar_presentes(&self, desde_ms: i64, saida: Sender<String>) -> Result<()> {
        let sql = format!(
            "SELECT aplicacao, execucao, seq FROM eventos WHERE ts >= {} FORMAT CustomSeparated SETTINGS format_custom_field_delimiter = ' ', format_custom_escaping_rule = 'Raw'",
            instante(desde_ms)
        );
        let resposta = self
            .http
            .post(&self.endereco)
            .timeout(Duration::from_secs(3600))
            .body(sql)
            .send()
            .await?
            .error_for_status()?;
        let mut pedacos = resposta.bytes_stream();
        while let Some(pedaco) = pedacos.next().await {
            let texto = String::from_utf8_lossy(&pedaco?).into_owned();
            saida.send(texto).await.map_err(|_| anyhow!("leitor encerrou"))?;
        }
        Ok(())
    }

    pub async fn apagar_dias_ate(&self, dia_final_exclusivo: i64) -> Result<()> {
        let limite_ms = dia_final_exclusivo * MILISSEGUNDOS_POR_DIA;
        let particoes = self
            .executar(format!(
                "SELECT DISTINCT partition FROM system.parts WHERE active AND database = currentDatabase() AND table = 'eventos' AND toUInt32(partition) < toYYYYMMDD(toDate({}), 'UTC') FORMAT TSVRaw",
                instante(limite_ms)
            ))
            .await?;
        for particao in particoes.lines() {
            self.executar(format!("ALTER TABLE eventos DROP PARTITION {particao}")).await?;
        }
        Ok(())
    }

    pub async fn apagar_pessoa(&self, termo_pessoa: &str) -> Result<()> {
        self.executar(format!(
            "DELETE FROM eventos WHERE has(termos, {}) SETTINGS lightweight_deletes_sync = 1",
            citar(termo_pessoa)
        ))
        .await
        .map(|_| ())
    }
}
