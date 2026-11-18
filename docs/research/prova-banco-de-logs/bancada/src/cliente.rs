use crate::catalogo::PedidoCatalogo;
use crate::modelo::{Evento, PedidoBusca, PedidoLinhaDoTempo, RespostaLinhaDoTempo, RespostaLote, ResultadoBusca};
use anyhow::{anyhow, Context, Result};
use flate2::{write::GzEncoder, Compression};
use serde::Serialize;
use std::io::Write;
use std::time::Duration;

#[derive(Clone)]
pub struct ClienteBancada {
    http: reqwest::Client,
    endereco_base: String,
}

pub enum ResultadoEnvio {
    Confirmado(RespostaLote),
    TenteDepois(Duration),
}

#[derive(Debug)]
pub struct DesfechoBusca {
    pub linhas: usize,
    pub parcial: bool,
    pub recusada: bool,
}

#[derive(Serialize)]
struct CorpoLote<'lote> {
    eventos: &'lote [Evento],
}

impl ClienteBancada {
    pub fn novo(endereco_base: &str) -> Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(60))
            .pool_max_idle_per_host(32)
            .build()?;
        Ok(Self { http, endereco_base: endereco_base.trim_end_matches('/').to_string() })
    }

    pub async fn enviar_lote(&self, eventos: &[Evento]) -> ResultadoEnvio {
        let corpo_gzip = match comprimir(&CorpoLote { eventos }) {
            Ok(corpo) => corpo,
            Err(_) => return ResultadoEnvio::TenteDepois(Duration::from_secs(1)),
        };
        let resposta = self
            .http
            .post(format!("{}/v1/eventos", self.endereco_base))
            .header("content-encoding", "gzip")
            .header("content-type", "application/json")
            .body(corpo_gzip)
            .send()
            .await;
        match resposta {
            Ok(resposta_http) if resposta_http.status().is_success() => {
                match resposta_http.json::<RespostaLote>().await {
                    Ok(lote) => ResultadoEnvio::Confirmado(lote),
                    Err(_) => ResultadoEnvio::TenteDepois(Duration::from_secs(1)),
                }
            }
            Ok(resposta_http) => {
                let espera_segundos = resposta_http
                    .headers()
                    .get("retry-after")
                    .and_then(|valor| valor.to_str().ok())
                    .and_then(|valor| valor.parse().ok())
                    .unwrap_or(1);
                ResultadoEnvio::TenteDepois(Duration::from_secs(espera_segundos))
            }
            Err(_) => ResultadoEnvio::TenteDepois(Duration::from_secs(1)),
        }
    }

    pub async fn executar(&self, pedido: &PedidoCatalogo) -> Result<DesfechoBusca> {
        match pedido {
            PedidoCatalogo::Busca { consulta, lenta } => {
                let resposta = self
                    .http
                    .post(format!("{}/v1/busca", self.endereco_base))
                    .json(&PedidoBusca { consulta: consulta.clone(), lenta: *lenta })
                    .send()
                    .await?;
                if resposta.status().as_u16() == 429 {
                    return Ok(DesfechoBusca { linhas: 0, parcial: false, recusada: true });
                }
                let situacao = resposta.status();
                if !situacao.is_success() {
                    return Err(anyhow!("busca respondeu {situacao}: {}", resposta.text().await.unwrap_or_default()));
                }
                let resultado: ResultadoBusca = resposta.json().await.context("resposta da busca")?;
                Ok(DesfechoBusca { linhas: resultado.linhas.len(), parcial: resultado.parcial, recusada: false })
            }
            PedidoCatalogo::LinhaDoTempo { termo_inicial, desde_ms, ate_ms, saltos } => {
                let resposta = self
                    .http
                    .post(format!("{}/v1/linha-do-tempo", self.endereco_base))
                    .json(&PedidoLinhaDoTempo {
                        termo_inicial: termo_inicial.clone(),
                        desde_ms: *desde_ms,
                        ate_ms: *ate_ms,
                        saltos: *saltos,
                    })
                    .send()
                    .await?
                    .error_for_status()?;
                let resultado: RespostaLinhaDoTempo = resposta.json().await?;
                Ok(DesfechoBusca { linhas: resultado.eventos, parcial: resultado.cortada, recusada: false })
            }
        }
    }

    pub async fn presentes(&self, desde_ms: i64) -> Result<reqwest::Response> {
        Ok(self
            .http
            .get(format!("{}/v1/presentes?desde_ms={desde_ms}", self.endereco_base))
            .timeout(Duration::from_secs(3600))
            .send()
            .await?
            .error_for_status()?)
    }
}

fn comprimir<Corpo: Serialize>(corpo: &Corpo) -> Result<Vec<u8>> {
    let mut compressor = GzEncoder::new(Vec::new(), Compression::fast());
    serde_json::to_writer(&mut compressor, corpo)?;
    compressor.flush()?;
    Ok(compressor.finish()?)
}
