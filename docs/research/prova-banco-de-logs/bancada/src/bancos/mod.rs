//! A única parte do servidor que muda por banco (#9, comparação justa, item 1).
pub mod clickhouse;
pub mod opensearch;
pub mod postgres;

use crate::modelo::{Consulta, EventoGravavel, ResultadoBusca};
use anyhow::{bail, Result};
use std::time::Duration;
use tokio::sync::mpsc::Sender;

pub enum Banco {
    ClickHouse(clickhouse::BancoClickHouse),
    OpenSearch(opensearch::BancoOpenSearch),
    Postgres(postgres::BancoPostgres),
}

macro_rules! em_cada_banco {
    ($banco:expr, $adaptador:ident => $chamada:expr) => {
        match $banco {
            Banco::ClickHouse($adaptador) => $chamada,
            Banco::OpenSearch($adaptador) => $chamada,
            Banco::Postgres($adaptador) => $chamada,
        }
    };
}

impl Banco {
    pub async fn conectar(nome_banco: &str, endereco: &str) -> Result<Self> {
        Ok(match nome_banco {
            "clickhouse" => Banco::ClickHouse(clickhouse::BancoClickHouse::novo(endereco)?),
            "opensearch" => Banco::OpenSearch(opensearch::BancoOpenSearch::novo(endereco)?),
            "postgres" => Banco::Postgres(postgres::BancoPostgres::novo(endereco).await?),
            desconhecido => bail!("banco desconhecido: {desconhecido}"),
        })
    }

    pub async fn preparar(&self) -> Result<()> {
        em_cada_banco!(self, adaptador => adaptador.preparar().await)
    }

    pub async fn gravar(&self, eventos: &[EventoGravavel]) -> Result<()> {
        em_cada_banco!(self, adaptador => adaptador.gravar(eventos).await)
    }

    /// Códigos gravados há pouco, para não duplicar reenvio depois de reinício ou resposta perdida.
    pub async fn ids_recentes(&self, recebido_desde_ms: i64, ts_desde_ms: i64) -> Result<Vec<String>> {
        em_cada_banco!(self, adaptador => adaptador.ids_recentes(recebido_desde_ms, ts_desde_ms).await)
    }

    pub async fn buscar(&self, consulta: &Consulta, prazo: Option<Duration>) -> Result<ResultadoBusca> {
        em_cada_banco!(self, adaptador => adaptador.buscar(consulta, prazo).await)
    }

    /// Envia linhas "aplicacao execucao seq" de tudo que existe a partir de `desde_ms`.
    pub async fn listar_presentes(&self, desde_ms: i64, saida: Sender<String>) -> Result<()> {
        em_cada_banco!(self, adaptador => adaptador.listar_presentes(desde_ms, saida).await)
    }

    pub async fn apagar_dias_ate(&self, dia_final_exclusivo: i64) -> Result<()> {
        em_cada_banco!(self, adaptador => adaptador.apagar_dias_ate(dia_final_exclusivo).await)
    }

    pub async fn apagar_pessoa(&self, termo_pessoa: &str) -> Result<()> {
        em_cada_banco!(self, adaptador => adaptador.apagar_pessoa(termo_pessoa).await)
    }
}
