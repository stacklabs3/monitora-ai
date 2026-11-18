//! Gerador determinístico: o mesmo (semente, aplicação, execução, seq, ts) dá sempre o mesmo evento.
use crate::modelo::Evento;
use hmac::{Hmac, Mac};
use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;
use sha2::Sha256;
use std::collections::BTreeMap;

/// Chave de códigos sintética e pública: só existe nesta prova.
pub const CHAVE_CODIGOS_SINTETICA: &[u8] = b"chave-sintetica-da-prova";

pub struct AplicacaoSintetica {
    pub produto: &'static str,
    pub aplicacao: &'static str,
    pub peso: f64,
}

/// 8 aplicações: 80%, 15% e 5% do volume por produto (#9).
pub const APLICACOES: [AplicacaoSintetica; 8] = [
    AplicacaoSintetica { produto: "excurfly", aplicacao: "excurfly-api", peso: 0.20 },
    AplicacaoSintetica { produto: "excurfly", aplicacao: "excurfly-site-compra", peso: 0.20 },
    AplicacaoSintetica { produto: "excurfly", aplicacao: "excurfly-site-agencia", peso: 0.20 },
    AplicacaoSintetica { produto: "excurfly", aplicacao: "excurfly-rotinas", peso: 0.20 },
    AplicacaoSintetica { produto: "produto-b", aplicacao: "produto-b-api", peso: 0.075 },
    AplicacaoSintetica { produto: "produto-b", aplicacao: "produto-b-site", peso: 0.075 },
    AplicacaoSintetica { produto: "produto-c", aplicacao: "produto-c-api", peso: 0.025 },
    AplicacaoSintetica { produto: "produto-c", aplicacao: "produto-c-site", peso: 0.025 },
];

const FRASES: [&str; 8] = [
    "cartão sem limite",
    "pagamento recusado pelo emissor",
    "assento indisponível na viagem",
    "reserva expirada antes da cobrança",
    "cliente pediu estorno da compra",
    "tempo esgotado ao chamar parceiro",
    "boleto gerado aguardando compensação",
    "embarque confirmado pelo motorista",
];

const VOCABULARIO: [&str; 16] = [
    "requisicao", "resposta", "processada", "parceiro", "fila", "tentativa", "sucesso", "falha",
    "cache", "consulta", "viagem", "compra", "assento", "pagamento", "cliente", "agencia",
];

const STATUS: [&str; 5] = ["ok", "ok", "pending", "refused", "failed"];

#[derive(Clone, Copy)]
pub struct ParametrosGeracao {
    pub semente: u64,
    /// 1 no padrão; 2 na rodada de disco com o dobro de valores distintos.
    pub multiplicador_valores: u64,
}

/// Poucos valores muito comuns e muitos raros (log-uniforme, aproxima Zipf com s=1).
fn posto_desigual(gerador: &mut ChaCha8Rng, quantidade_valores: u64) -> u64 {
    let sorteio: f64 = gerador.gen();
    ((quantidade_valores as f64).powf(sorteio) as u64).clamp(1, quantidade_valores)
}

pub fn codigo_de_busca(telefone_digitado: &str) -> String {
    let digitos: String = telefone_digitado.chars().filter(char::is_ascii_digit).collect();
    let mut autenticador =
        Hmac::<Sha256>::new_from_slice(CHAVE_CODIGOS_SINTETICA).expect("chave de tamanho livre");
    autenticador.update(digitos.as_bytes());
    hex::encode(&autenticador.finalize().into_bytes()[..12])
}

pub fn telefone_do_posto(posto: u64) -> String {
    format!("(11) 9{:04}-{:04}", posto / 10_000, posto % 10_000)
}

pub fn cobranca_da_reserva(numero_reserva: u64) -> String {
    if numero_reserva == 1042 { "T-900".into() } else { format!("T-{}", numero_reserva + 1_000_000) }
}

pub fn estorno_da_reserva(numero_reserva: u64) -> String {
    if numero_reserva == 1042 { "E-3".into() } else { format!("E-{}", numero_reserva + 1_000_000) }
}

/// As reservas 2000 a 2039 são as 40 tentativas da viagem V-5.
pub fn viagem_da_reserva(numero_reserva: u64) -> String {
    if (2000..2040).contains(&numero_reserva) {
        "V-5".into()
    } else {
        format!("V-{}", 6 + numero_reserva % 5000)
    }
}

fn tamanho_alvo(gerador: &mut ChaCha8Rng, seq: u64, tipo_sorteado: f64) -> usize {
    if seq % 100_000 == 99_999 {
        1_048_576
    } else if tipo_sorteado < 0.75 {
        450
    } else if tipo_sorteado < 0.95 {
        800
    } else {
        gerador.gen_range(1024..=4096)
    }
}

pub fn gerar_evento(
    parametros: ParametrosGeracao,
    indice_aplicacao: usize,
    execucao: &str,
    seq: u64,
    ts_ms: i64,
) -> Evento {
    let aplicacao = &APLICACOES[indice_aplicacao];
    let semente_evento = parametros
        .semente
        .wrapping_add((indice_aplicacao as u64 + 1).wrapping_mul(0x9E37_79B9_7F4A_7C15))
        .wrapping_add(seq.wrapping_mul(0xC2B2_AE3D_27D4_EB4F));
    let mut gerador = ChaCha8Rng::seed_from_u64(semente_evento);
    let multiplicador = parametros.multiplicador_valores.max(1);

    let tipo_sorteado: f64 = gerador.gen();
    let alvo_bytes = tamanho_alvo(&mut gerador, seq, tipo_sorteado);
    // Garante a corrente R-1042 → T-900 → E-3 em todo período medido.
    let cobranca_garantida = seq % 5000 == 17;
    let estorno_garantido = seq % 5000 == 20;
    let eh_negocio = (0.75..0.95).contains(&tipo_sorteado) || cobranca_garantida || estorno_garantido;
    let eh_problema = tipo_sorteado >= 0.95 && !eh_negocio;

    let numero_reserva = match seq % 5000 {
        17 | 20 => 1042,
        18 => 2000 + (seq / 5000) % 40,
        _ => posto_desigual(&mut gerador, 200_000 * multiplicador),
    };
    let numero_conta = posto_desigual(&mut gerador, 50_000 * multiplicador);
    let posto_telefone = if seq % 5000 == 19 { 4321 } else { posto_desigual(&mut gerador, 50_000 * multiplicador) };
    let numero_ocorrencia = posto_desigual(&mut gerador, 2_000_000 * multiplicador);

    let mut campos = BTreeMap::new();
    campos.insert("reservationId".to_string(), format!("R-{numero_reserva}"));
    campos.insert("accountId".to_string(), format!("conta-{numero_conta}"));
    campos.insert("tripId".to_string(), viagem_da_reserva(numero_reserva));
    campos.insert("telefoneCodigo".to_string(), codigo_de_busca(&telefone_do_posto(posto_telefone)));
    campos.insert("telefoneMascarado".to_string(), format!("(11) *****-{:04}", posto_telefone % 10_000));

    let tipo_negocio = match (cobranca_garantida, estorno_garantido) {
        (true, _) => 1,
        (_, true) => 2,
        _ => gerador.gen_range(0..3),
    };
    let (familia, nome, rota, url) = if eh_negocio {
        match tipo_negocio {
            0 => ("reserva", "reserva-criada", "/api/v1/trip/:id/purchase".to_string(),
                format!("/api/v1/trip/{}/purchase", viagem_da_reserva(numero_reserva))),
            1 => {
                campos.insert("pspTxId".to_string(), cobranca_da_reserva(numero_reserva));
                ("transacao-financeira", "cobranca-enviada", "/api/v1/payments".to_string(),
                    format!("/api/v1/payments/{numero_reserva}"))
            }
            _ => {
                campos.remove("reservationId");
                campos.insert("pspTxId".to_string(), cobranca_da_reserva(numero_reserva));
                campos.insert("refundId".to_string(), estorno_da_reserva(numero_reserva));
                ("transacao-financeira", "estorno-criado", "/api/v1/refunds".to_string(),
                    format!("/api/v1/refunds/{numero_reserva}"))
            }
        }
    } else {
        ("requisicao", "requisicao-concluida", "/api/v1/search".to_string(),
            format!("/api/v1/search/{}", numero_conta % 500))
    };

    for _ in 0..gerador.gen_range(6..=10) {
        let numero_campo = gerador.gen_range(0..100);
        let valor_campo = posto_desigual(&mut gerador, 2_000 * multiplicador);
        campos.insert(format!("campo_{numero_campo:03}"), format!("valor-{valor_campo}"));
    }

    let valor_centavos = eh_negocio.then(|| gerador.gen_range(100..100_000));
    let assentos: Vec<i32> = if eh_negocio {
        (0..gerador.gen_range(1..=3)).map(|_| gerador.gen_range(1..=46)).collect()
    } else {
        Vec::new()
    };
    let palavras = (0..5)
        .map(|_| FRASES[gerador.gen_range(0..FRASES.len())])
        .collect::<Vec<_>>()
        .join(" | ");

    let tamanho_base = 420 + campos.iter().map(|(nome_campo, valor)| nome_campo.len() + valor.len() + 6).sum::<usize>() + palavras.len();
    let mut corpo = String::with_capacity(alvo_bytes.saturating_sub(tamanho_base) + 32);
    while corpo.len() + tamanho_base < alvo_bytes {
        corpo.push_str(VOCABULARIO[gerador.gen_range(0..VOCABULARIO.len())]);
        corpo.push(' ');
        if gerador.gen_bool(0.2) {
            corpo.push_str(&format!("{:x} ", gerador.gen::<u32>()));
        }
    }

    let nivel = if eh_problema { if gerador.gen_bool(0.5) { "warn" } else { "error" } } else { "info" };
    Evento {
        id: format!("{}-{execucao}-{seq}", aplicacao.aplicacao),
        ts_ms,
        produto: aplicacao.produto.to_string(),
        ambiente: "prova".to_string(),
        aplicacao: aplicacao.aplicacao.to_string(),
        execucao: execucao.to_string(),
        seq,
        nivel: nivel.to_string(),
        familia: familia.to_string(),
        ocorrencia: format!("oc_{numero_ocorrencia}"),
        nome: nome.to_string(),
        rota,
        url,
        status: STATUS[gerador.gen_range(0..STATUS.len())].to_string(),
        valor_centavos,
        assentos,
        palavras,
        corpo,
        campos,
    }
}

/// Atraso de vínculo tardio: 5% chegam 4 min depois e 0,5% chegam 2 h depois (#9).
pub fn atraso_do_vinculo_ms(semente: u64, indice_aplicacao: usize, seq: u64) -> i64 {
    match sorteio_estavel(semente ^ 0x5649_4E43, indice_aplicacao, seq) % 1000 {
        0..=4 => 7_200_000,
        5..=54 => 240_000,
        _ => 0,
    }
}

/// 1% dos eventos é reenviado aos 14 min (#9).
pub fn sera_reenviado(semente: u64, indice_aplicacao: usize, seq: u64) -> bool {
    sorteio_estavel(semente ^ 0x5245_454E, indice_aplicacao, seq) % 100 == 0
}

/// Finalizador do SplitMix64: espalha bem entradas sequenciais.
fn sorteio_estavel(semente: u64, indice_aplicacao: usize, seq: u64) -> u64 {
    let mut mistura = semente
        .wrapping_add((indice_aplicacao as u64 + 1) << 48)
        .wrapping_add(seq)
        .wrapping_add(0x9E37_79B9_7F4A_7C15);
    mistura = (mistura ^ (mistura >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    mistura = (mistura ^ (mistura >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    mistura ^ (mistura >> 31)
}
