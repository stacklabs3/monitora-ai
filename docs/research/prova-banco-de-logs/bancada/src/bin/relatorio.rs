//! Resume os CSVs de uma rodada e, com --verificar, julga contra as metas do #9.
use anyhow::Result;
use clap::Parser;
use std::collections::BTreeMap;
use std::path::PathBuf;

#[derive(Parser)]
struct Argumentos {
    #[arg(long)]
    pasta: PathBuf,
    /// Sai com código 1 e lista o que quebrou alguma meta.
    #[arg(long)]
    verificar: bool,
    #[arg(long, default_value_t = 1_000)]
    meta_confirmar_ms: i64,
    #[arg(long, default_value_t = 10_000)]
    meta_aparecer_ms: i64,
    #[arg(long, default_value_t = 60_000)]
    limite_aparecer_ms: i64,
    #[arg(long, default_value_t = 5_000)]
    meta_busca_ms: i64,
}

fn percentil(valores_ordenados: &[i64], fracao: f64) -> i64 {
    if valores_ordenados.is_empty() {
        return -1;
    }
    let posicao = ((valores_ordenados.len() as f64 * fracao).ceil() as usize).clamp(1, valores_ordenados.len());
    valores_ordenados[posicao - 1]
}

fn linhas_de(caminho: PathBuf) -> Vec<String> {
    std::fs::read_to_string(caminho)
        .map(|texto| texto.lines().skip(1).map(str::to_string).collect())
        .unwrap_or_default()
}

fn resumo(valores: &mut [i64]) -> String {
    valores.sort_unstable();
    format!(
        "n={} p50={} p95={} p99={} max={}",
        valores.len(),
        percentil(valores, 0.50),
        percentil(valores, 0.95),
        percentil(valores, 0.99),
        valores.last().copied().unwrap_or(-1)
    )
}

fn main() -> Result<()> {
    let argumentos = Argumentos::parse();
    let mut reprovacoes = Vec::new();

    let mut latencias_envio = Vec::new();
    let (mut lotes_com_nova_tentativa, mut lotes_perdidos, mut aceitos, mut duplicados) = (0u64, 0u64, 0u64, 0u64);
    for linha in linhas_de(argumentos.pasta.join("envios.csv")) {
        let colunas: Vec<&str> = linha.split(',').collect();
        let [_, _, _, texto_latencia, texto_tentativas, texto_aceitos, texto_duplicados] = colunas[..] else { continue };
        let latencia_ms: i64 = texto_latencia.parse()?;
        if latencia_ms < 0 {
            lotes_perdidos += 1;
            continue;
        }
        latencias_envio.push(latencia_ms);
        lotes_com_nova_tentativa += u64::from(texto_tentativas != "1");
        aceitos += texto_aceitos.parse::<u64>()?;
        duplicados += texto_duplicados.parse::<u64>()?;
    }
    println!("confirmar lote (ms): {}", resumo(&mut latencias_envio));
    println!("lotes com 'tente depois'={lotes_com_nova_tentativa} sem confirmação={lotes_perdidos} aceitos={aceitos} duplicados barrados={duplicados}");
    let p95_confirmar = percentil(&latencias_envio, 0.95);
    if p95_confirmar > argumentos.meta_confirmar_ms {
        reprovacoes.push(format!("confirmar lote p95={p95_confirmar} ms"));
    }
    if lotes_com_nova_tentativa > 0 {
        reprovacoes.push(format!("{lotes_com_nova_tentativa} lotes receberam 'tente depois'"));
    }
    if lotes_perdidos > 0 {
        reprovacoes.push(format!("{lotes_perdidos} lotes sem confirmação"));
    }

    let mut visibilidade = Vec::new();
    let mut sondas_nao_vistas = 0u64;
    for linha in linhas_de(argumentos.pasta.join("visibilidade.csv")) {
        let latencia_ms: i64 = linha.rsplit(',').next().unwrap_or("-1").parse()?;
        if latencia_ms < 0 { sondas_nao_vistas += 1 } else { visibilidade.push(latencia_ms) }
    }
    println!("aparecer na busca (ms): {} não vistas em 120 s={sondas_nao_vistas}", resumo(&mut visibilidade));
    let p95_aparecer = percentil(&visibilidade, 0.95);
    let maior_aparecer = visibilidade.last().copied().unwrap_or(-1);
    if p95_aparecer > argumentos.meta_aparecer_ms {
        reprovacoes.push(format!("aparecer na busca p95={p95_aparecer} ms"));
    }
    if maior_aparecer > argumentos.limite_aparecer_ms || sondas_nao_vistas > 0 {
        reprovacoes.push(format!("aparecer na busca max={maior_aparecer} ms, não vistas={sondas_nao_vistas}"));
    }

    let mut por_busca: BTreeMap<String, Vec<i64>> = BTreeMap::new();
    let mut linhas_por_busca: BTreeMap<String, i64> = BTreeMap::new();
    let mut desfechos: BTreeMap<String, BTreeMap<String, u64>> = BTreeMap::new();
    for linha in linhas_de(argumentos.pasta.join("buscas.csv")) {
        let colunas: Vec<&str> = linha.split(',').collect();
        let [_, rotulo, busca, janela, texto_latencia, texto_linhas, parcial, situacao] = colunas[..] else { continue };
        let chave = format!("{rotulo} {busca} {janela}");
        let desfecho = if parcial == "true" { "parcial" } else { situacao };
        *desfechos.entry(chave.clone()).or_default().entry(desfecho.to_string()).or_default() += 1;
        if situacao == "ok" {
            por_busca.entry(chave.clone()).or_default().push(texto_latencia.parse()?);
            *linhas_por_busca.entry(chave).or_default() += texto_linhas.parse::<i64>()?;
        }
    }
    for (chave, desfechos_busca) in &desfechos {
        let mut latencias = por_busca.get(chave).cloned().unwrap_or_default();
        let total_linhas = linhas_por_busca.get(chave).copied().unwrap_or(0);
        println!("busca {chave}: {} linhas={total_linhas} {desfechos_busca:?}", resumo(&mut latencias));
        if chave.contains(" lenta-") {
            continue;
        }
        let p95_busca = percentil(&latencias, 0.95);
        if p95_busca > argumentos.meta_busca_ms {
            reprovacoes.push(format!("busca {chave} p95={p95_busca} ms"));
        }
        if let Some(erros) = desfechos_busca.get("erro") {
            reprovacoes.push(format!("busca {chave} com {erros} erros"));
        }
    }

    if argumentos.verificar {
        if reprovacoes.is_empty() {
            println!("VEREDITO: dentro das metas");
        } else {
            println!("VEREDITO: fora das metas");
            for reprovacao in &reprovacoes {
                println!("  - {reprovacao}");
            }
            std::process::exit(1);
        }
    }
    Ok(())
}
