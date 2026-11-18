//! Catálogo das buscas do #9, igual para todos os bancos.
use crate::geracao::codigo_de_busca;
use crate::modelo::{Consulta, MILISSEGUNDOS_POR_DIA};

const UMA_HORA_MS: i64 = 3_600_000;

#[derive(Clone, Debug)]
pub enum PedidoCatalogo {
    Busca { consulta: Consulta, lenta: bool },
    LinhaDoTempo { termo_inicial: String, desde_ms: i64, ate_ms: i64, saltos: u32 },
}

#[derive(Clone, Debug)]
pub struct BuscaCatalogo {
    pub nome: String,
    pub janela: &'static str,
    pub pedido: PedidoCatalogo,
}

fn consulta_base(desde_ms: i64, ate_ms: i64) -> Consulta {
    Consulta { desde_ms, ate_ms, limite: 100, ..Consulta::default() }
}

fn por_termos(desde_ms: i64, ate_ms: i64, termos: &[&str]) -> Consulta {
    Consulta {
        termos: termos.iter().map(|termo| termo.to_string()).collect(),
        ..consulta_base(desde_ms, ate_ms)
    }
}

/// Buscas garantidas de uma janela; `codigo_especifico` marca as que também valem em 30 dias.
fn garantidas(desde_ms: i64, ate_ms: i64) -> Vec<(&'static str, bool, PedidoCatalogo)> {
    let busca = |consulta: Consulta| PedidoCatalogo::Busca { consulta, lenta: false };
    let termo_telefone = format!("telefoneCodigo={}", codigo_de_busca("(11) 90000-4321"));
    vec![
        ("correlacao-reserva", true, busca(por_termos(desde_ms, ate_ms, &["reservationId=R-1042"]))),
        ("correlacao-cobranca", true, busca(por_termos(desde_ms, ate_ms, &["pspTxId=T-900"]))),
        ("localizacao-conta", true, busca(por_termos(desde_ms, ate_ms, &["accountId=conta-7"]))),
        ("localizacao-viagem", true, busca(por_termos(desde_ms, ate_ms, &["tripId=V-5"]))),
        ("codigo-telefone", true, busca(por_termos(desde_ms, ate_ms, &[termo_telefone.as_str()]))),
        ("familia", false, busca(por_termos(desde_ms, ate_ms, &["familia=transacao-financeira"]))),
        ("ocorrencia", true, busca(por_termos(desde_ms, ate_ms, &["ocorrencia=oc_1"]))),
        ("comeco-url", false, busca(Consulta {
            prefixo_url: Some("/api/v1/pay".to_string()),
            ..consulta_base(desde_ms, ate_ms)
        })),
        ("origem-nivel", false, busca(Consulta {
            produto: Some("excurfly".to_string()),
            ..por_termos(desde_ms, ate_ms, &["aplicacao=excurfly-api", "nivel=error"])
        })),
        ("status", false, busca(por_termos(desde_ms, ate_ms, &["status=refused"]))),
        ("valor", false, busca(Consulta {
            valor_minimo: Some(1000),
            valor_maximo: Some(5000),
            ..consulta_base(desde_ms, ate_ms)
        })),
        ("assento", false, busca(por_termos(desde_ms, ate_ms, &["seatNumbers=13"]))),
        ("palavras", false, busca(Consulta {
            palavra: Some("limite".to_string()),
            ..consulta_base(desde_ms, ate_ms)
        })),
        ("linha-do-tempo", true, PedidoCatalogo::LinhaDoTempo {
            termo_inicial: "reservationId=R-1042".to_string(),
            desde_ms,
            ate_ms,
            saltos: 3,
        }),
    ]
}

pub fn buscas_garantidas(agora_ms: i64) -> Vec<BuscaCatalogo> {
    let mut catalogo = Vec::new();
    let janelas = [
        ("1h", agora_ms - UMA_HORA_MS, false),
        ("1d", agora_ms - MILISSEGUNDOS_POR_DIA, false),
        ("30d", agora_ms - 30 * MILISSEGUNDOS_POR_DIA, true),
    ];
    for (janela, desde_ms, so_codigo_especifico) in janelas {
        for (nome, codigo_especifico, pedido) in garantidas(desde_ms, agora_ms) {
            if !so_codigo_especifico || codigo_especifico {
                catalogo.push(BuscaCatalogo { nome: nome.to_string(), janela, pedido });
            }
        }
    }
    catalogo
}

pub fn buscas_lentas(agora_ms: i64) -> Vec<BuscaCatalogo> {
    let desde_ms = agora_ms - MILISSEGUNDOS_POR_DIA;
    vec![
        BuscaCatalogo {
            nome: "lenta-texto-livre".to_string(),
            janela: "1d",
            pedido: PedidoCatalogo::Busca {
                consulta: Consulta { texto_livre: Some("parceiro".to_string()), ..consulta_base(desde_ms, agora_ms) },
                lenta: true,
            },
        },
        BuscaCatalogo {
            nome: "lenta-regex".to_string(),
            janela: "1d",
            pedido: PedidoCatalogo::Busca {
                consulta: Consulta {
                    regex_url: Some("/api/v1/trip/[^/]+/purchase".to_string()),
                    ..consulta_base(desde_ms, agora_ms)
                },
                lenta: true,
            },
        },
    ]
}
