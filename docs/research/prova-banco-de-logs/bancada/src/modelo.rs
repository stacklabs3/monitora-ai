use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

pub const MILISSEGUNDOS_POR_DIA: i64 = 86_400_000;

/// Evento como a aplicação sintética envia.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Evento {
    pub id: String,
    pub ts_ms: i64,
    pub produto: String,
    pub ambiente: String,
    pub aplicacao: String,
    pub execucao: String,
    pub seq: u64,
    pub nivel: String,
    pub familia: String,
    pub ocorrencia: String,
    pub nome: String,
    pub rota: String,
    pub url: String,
    pub status: String,
    pub valor_centavos: Option<i64>,
    pub assentos: Vec<i32>,
    pub palavras: String,
    pub corpo: String,
    pub campos: BTreeMap<String, String>,
}

/// Evento pronto para o banco: os termos são a forma única de busca exata.
#[derive(Clone, Debug, Serialize)]
pub struct EventoGravavel {
    pub id: String,
    pub ts_ms: i64,
    pub recebido_ms: i64,
    pub produto: String,
    pub aplicacao: String,
    pub execucao: String,
    pub seq: u64,
    pub url: String,
    pub valor_centavos: Option<i64>,
    pub termos: Vec<String>,
    pub palavras: String,
    pub corpo: String,
    pub campos: String,
}

impl EventoGravavel {
    pub fn de_evento(evento: Evento, recebido_ms: i64) -> Self {
        let mut termos: Vec<String> = evento
            .campos
            .iter()
            .map(|(nome_campo, valor_campo)| format!("{nome_campo}={valor_campo}"))
            .collect();
        termos.push(format!("nivel={}", evento.nivel));
        termos.push(format!("familia={}", evento.familia));
        termos.push(format!("ocorrencia={}", evento.ocorrencia));
        termos.push(format!("nome={}", evento.nome));
        termos.push(format!("status={}", evento.status));
        termos.push(format!("aplicacao={}", evento.aplicacao));
        termos.extend(evento.assentos.iter().map(|assento| format!("seatNumbers={assento}")));
        let campos = serde_json::to_string(&evento.campos).unwrap_or_else(|_| "{}".to_string());
        Self {
            id: evento.id,
            ts_ms: evento.ts_ms,
            recebido_ms,
            produto: evento.produto,
            aplicacao: evento.aplicacao,
            execucao: evento.execucao,
            seq: evento.seq,
            url: evento.url,
            valor_centavos: evento.valor_centavos,
            termos,
            palavras: evento.palavras,
            corpo: evento.corpo,
            campos,
        }
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Consulta {
    pub produto: Option<String>,
    pub desde_ms: i64,
    pub ate_ms: i64,
    #[serde(default)]
    pub termos: Vec<String>,
    pub prefixo_url: Option<String>,
    pub valor_minimo: Option<i64>,
    pub valor_maximo: Option<i64>,
    pub palavra: Option<String>,
    pub texto_livre: Option<String>,
    pub regex_url: Option<String>,
    pub limite: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LinhaEncontrada {
    pub id: String,
    pub ts_ms: i64,
    pub campos: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct ResultadoBusca {
    pub linhas: Vec<LinhaEncontrada>,
    pub parcial: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PedidoBusca {
    pub consulta: Consulta,
    #[serde(default)]
    pub lenta: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PedidoLinhaDoTempo {
    pub termo_inicial: String,
    pub desde_ms: i64,
    pub ate_ms: i64,
    pub saltos: u32,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct RespostaLinhaDoTempo {
    pub saltos_feitos: u32,
    pub eventos: usize,
    pub termos_visitados: Vec<String>,
    pub cortada: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct RespostaLote {
    pub aceitos: usize,
    pub duplicados: usize,
}

pub fn agora_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duracao| duracao.as_millis() as i64)
        .unwrap_or(0)
}

/// Dias desde 1970 do instante dado.
pub fn dia_de(ts_ms: i64) -> i64 {
    ts_ms.div_euclid(MILISSEGUNDOS_POR_DIA)
}
