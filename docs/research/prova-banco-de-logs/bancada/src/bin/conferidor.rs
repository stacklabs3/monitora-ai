//! Compara as confirmações anotadas fora da máquina com o que existe no banco.
//! Sai com código 1 se algum evento confirmado sumiu ou se algo está duplicado.
use anyhow::Result;
use bancada::cliente::ClienteBancada;
use clap::Parser;
use futures::StreamExt;
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Parser)]
struct Argumentos {
    #[arg(long, default_value = "http://127.0.0.1:8080")]
    servidor: String,
    /// Um ou mais arquivos confirmados.log.
    #[arg(long, required = true)]
    confirmados: Vec<PathBuf>,
}

type Chave = (String, String);

#[derive(Default)]
struct Contagem {
    vezes_por_seq: Vec<u8>,
    confirmado_por_seq: Vec<bool>,
}

impl Contagem {
    fn garantir(&mut self, seq: usize) {
        if self.vezes_por_seq.len() <= seq {
            self.vezes_por_seq.resize(seq + 1, 0);
            self.confirmado_por_seq.resize(seq + 1, false);
        }
    }
}

fn registrar_presente(contagens: &mut HashMap<Chave, Contagem>, linha: &str, duplicados_fora: &mut u64) {
    let mut partes = linha.split(' ');
    let (Some(aplicacao), Some(execucao), Some(texto_seq)) = (partes.next(), partes.next(), partes.next()) else {
        return;
    };
    if execucao.starts_with("sonda-") {
        return;
    }
    let Ok(seq) = texto_seq.trim().parse::<usize>() else { return };
    let contagem = contagens.entry((aplicacao.to_string(), execucao.to_string())).or_default();
    contagem.garantir(seq);
    contagem.vezes_por_seq[seq] = contagem.vezes_por_seq[seq].saturating_add(1);
    if contagem.vezes_por_seq[seq] == 2 {
        *duplicados_fora += 1;
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let argumentos = Argumentos::parse();
    let mut contagens: HashMap<Chave, Contagem> = HashMap::new();
    let mut menor_ts_ms = i64::MAX;
    let mut total_confirmados = 0u64;
    for caminho in &argumentos.confirmados {
        for linha in std::fs::read_to_string(caminho)?.lines().skip(1) {
            let partes: Vec<&str> = linha.split(' ').collect();
            let [aplicacao, execucao, texto_inicial, texto_final, texto_ts] = partes[..] else { continue };
            let (seq_inicial, seq_final): (usize, usize) = (texto_inicial.parse()?, texto_final.parse()?);
            menor_ts_ms = menor_ts_ms.min(texto_ts.parse()?);
            let contagem = contagens.entry((aplicacao.to_string(), execucao.to_string())).or_default();
            contagem.garantir(seq_final);
            for seq in seq_inicial..=seq_final {
                if !contagem.confirmado_por_seq[seq] {
                    contagem.confirmado_por_seq[seq] = true;
                    total_confirmados += 1;
                }
            }
        }
    }
    anyhow::ensure!(menor_ts_ms != i64::MAX, "nenhuma confirmação nos arquivos");

    let cliente = ClienteBancada::novo(&argumentos.servidor)?;
    let resposta = cliente.presentes(menor_ts_ms).await?;
    let mut pedacos = resposta.bytes_stream();
    let mut resto = Vec::new();
    let mut duplicados = 0u64;
    let mut total_presentes = 0u64;
    while let Some(pedaco) = pedacos.next().await {
        resto.extend_from_slice(&pedaco?);
        let Some(ultima_quebra) = resto.iter().rposition(|byte| *byte == b'\n') else { continue };
        let completas: Vec<u8> = resto.drain(..=ultima_quebra).collect();
        for linha in String::from_utf8_lossy(&completas).lines() {
            total_presentes += 1;
            registrar_presente(&mut contagens, linha, &mut duplicados);
        }
    }

    let mut perdidos = 0u64;
    let mut exemplos = Vec::new();
    for ((aplicacao, execucao), contagem) in &contagens {
        for (seq, confirmado) in contagem.confirmado_por_seq.iter().enumerate() {
            if *confirmado && contagem.vezes_por_seq[seq] == 0 {
                perdidos += 1;
                if exemplos.len() < 5 {
                    exemplos.push(format!("{aplicacao}/{execucao}/{seq}"));
                }
            }
        }
    }
    println!("confirmados={total_confirmados} presentes={total_presentes} perdidos={perdidos} duplicados={duplicados}");
    if !exemplos.is_empty() {
        println!("exemplos de perdidos: {}", exemplos.join(", "));
    }
    if perdidos > 0 || duplicados > 0 {
        std::process::exit(1);
    }
    Ok(())
}
