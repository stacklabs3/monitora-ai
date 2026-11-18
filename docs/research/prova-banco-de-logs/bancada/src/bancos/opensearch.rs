use crate::modelo::{dia_de, Consulta, EventoGravavel, LinhaEncontrada, ResultadoBusca};
use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::sync::mpsc::Sender;

pub struct BancoOpenSearch {
    http: reqwest::Client,
    endereco: String,
}

fn indice_do_dia(dia: i64) -> String {
    format!("eventos-{dia}")
}

fn indices_do_periodo(desde_ms: i64, ate_ms: i64) -> String {
    (dia_de(desde_ms)..=dia_de(ate_ms)).map(indice_do_dia).collect::<Vec<_>>().join(",")
}

impl BancoOpenSearch {
    pub fn novo(endereco: &str) -> Result<Self> {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(120)).build()?;
        Ok(Self { http, endereco: endereco.trim_end_matches('/').to_string() })
    }

    async fn pedir(&self, metodo: reqwest::Method, caminho: &str, corpo: Option<Value>) -> Result<Value> {
        let mut pedido = self.http.request(metodo, format!("{}/{caminho}", self.endereco));
        if let Some(corpo_json) = corpo {
            pedido = pedido.json(&corpo_json);
        }
        let resposta = pedido.send().await?;
        let situacao = resposta.status();
        let texto = resposta.text().await?;
        if !situacao.is_success() {
            return Err(anyhow!("opensearch {situacao}: {texto}"));
        }
        Ok(serde_json::from_str(&texto)?)
    }

    pub async fn preparar(&self) -> Result<()> {
        let modelo = json!({
            "index_patterns": ["eventos-*"],
            "template": {
                "settings": {
                    "index.number_of_shards": 1,
                    "index.number_of_replicas": 0,
                    "index.refresh_interval": "5s",
                    "index.translog.durability": "request",
                    "index.codec": "best_compression"
                },
                "mappings": {
                    "dynamic": false,
                    "properties": {
                        "id": {"type": "keyword"},
                        "ts_ms": {"type": "date", "format": "epoch_millis"},
                        "recebido_ms": {"type": "long"},
                        "produto": {"type": "keyword"},
                        "aplicacao": {"type": "keyword"},
                        "execucao": {"type": "keyword"},
                        "seq": {"type": "long"},
                        "url": {"type": "keyword"},
                        "valor_centavos": {"type": "long"},
                        "termos": {"type": "keyword"},
                        "palavras": {"type": "text"},
                        "corpo": {"type": "match_only_text"},
                        "campos": {"type": "keyword", "index": false, "doc_values": false}
                    }
                }
            }
        });
        self.pedir(reqwest::Method::PUT, "_index_template/eventos", Some(modelo)).await.map(|_| ())
    }

    pub async fn gravar(&self, eventos: &[EventoGravavel]) -> Result<()> {
        let mut corpo = Vec::with_capacity(eventos.len() * 1000);
        for evento in eventos {
            serde_json::to_writer(
                &mut corpo,
                &json!({"create": {"_index": indice_do_dia(dia_de(evento.ts_ms)), "_id": evento.id}}),
            )?;
            corpo.push(b'\n');
            serde_json::to_writer(&mut corpo, evento)?;
            corpo.push(b'\n');
        }
        let resposta = self
            .http
            .post(format!("{}/_bulk", self.endereco))
            .header("content-type", "application/x-ndjson")
            .body(corpo)
            .send()
            .await?;
        let situacao = resposta.status();
        let texto = resposta.text().await?;
        if !situacao.is_success() {
            return Err(anyhow!("opensearch {situacao}: {texto}"));
        }
        let resultado: Value = serde_json::from_str(&texto)?;
        if resultado["errors"].as_bool().unwrap_or(false) {
            let itens = resultado["items"].as_array().cloned().unwrap_or_default();
            let primeira_falha = itens.iter().find(|item| {
                let situacao_item = item["create"]["status"].as_u64().unwrap_or(500);
                situacao_item >= 300 && situacao_item != 409
            });
            if let Some(falha) = primeira_falha {
                return Err(anyhow!("opensearch recusou item: {falha}"));
            }
        }
        Ok(())
    }

    pub async fn ids_recentes(&self, recebido_desde_ms: i64, ts_desde_ms: i64) -> Result<Vec<String>> {
        let consulta = json!({"bool": {"filter": [
            {"range": {"ts_ms": {"gte": ts_desde_ms}}},
            {"range": {"recebido_ms": {"gte": recebido_desde_ms}}}
        ]}});
        let mut ids = Vec::new();
        self.percorrer(consulta, json!(["id"]), ts_desde_ms, |fonte| {
            if let Some(id) = fonte["id"].as_str() {
                ids.push(id.to_string());
            }
        })
        .await?;
        Ok(ids)
    }

    async fn percorrer(
        &self,
        consulta: Value,
        campos: Value,
        desde_ms: i64,
        mut ao_receber: impl FnMut(&Value),
    ) -> Result<()> {
        let indices = indices_do_periodo(desde_ms, crate::modelo::agora_ms());
        let caminho = format!("{indices}/_search?scroll=2m&ignore_unavailable=true");
        let corpo = json!({"size": 5000, "query": consulta, "_source": campos, "sort": ["_doc"]});
        let mut pagina = self.pedir(reqwest::Method::POST, &caminho, Some(corpo)).await?;
        loop {
            let acertos = pagina["hits"]["hits"].as_array().cloned().unwrap_or_default();
            if acertos.is_empty() {
                break;
            }
            for acerto in &acertos {
                ao_receber(&acerto["_source"]);
            }
            let marcador = pagina["_scroll_id"].as_str().unwrap_or_default().to_string();
            pagina = self
                .pedir(reqwest::Method::POST, "_search/scroll", Some(json!({"scroll": "2m", "scroll_id": marcador})))
                .await?;
        }
        if let Some(marcador) = pagina["_scroll_id"].as_str() {
            let _ = self
                .pedir(reqwest::Method::DELETE, "_search/scroll", Some(json!({"scroll_id": [marcador]})))
                .await;
        }
        Ok(())
    }

    fn montar_consulta(consulta: &Consulta) -> Value {
        let mut filtros = vec![json!({"range": {"ts_ms": {"gte": consulta.desde_ms, "lt": consulta.ate_ms}}})];
        if let Some(produto) = &consulta.produto {
            filtros.push(json!({"term": {"produto": produto}}));
        }
        filtros.extend(consulta.termos.iter().map(|termo| json!({"term": {"termos": termo}})));
        if let Some(prefixo) = &consulta.prefixo_url {
            filtros.push(json!({"prefix": {"url": prefixo}}));
        }
        if consulta.valor_minimo.is_some() || consulta.valor_maximo.is_some() {
            filtros.push(json!({"range": {"valor_centavos": {"gte": consulta.valor_minimo, "lte": consulta.valor_maximo}}}));
        }
        if let Some(palavra) = &consulta.palavra {
            filtros.push(json!({"match": {"palavras": palavra}}));
        }
        if let Some(texto) = &consulta.texto_livre {
            filtros.push(json!({"match": {"corpo": texto}}));
        }
        if let Some(regex) = &consulta.regex_url {
            filtros.push(json!({"regexp": {"url": regex}}));
        }
        json!({"bool": {"filter": filtros}})
    }

    pub async fn buscar(&self, consulta: &Consulta, prazo: Option<Duration>) -> Result<ResultadoBusca> {
        let indices = indices_do_periodo(consulta.desde_ms, consulta.ate_ms);
        let mut corpo = json!({
            "size": consulta.limite,
            "query": Self::montar_consulta(consulta),
            "sort": [{"ts_ms": "desc"}],
            "_source": ["id", "ts_ms", "campos"],
            "track_total_hits": false
        });
        let mut caminho = format!("{indices}/_search?ignore_unavailable=true&allow_partial_search_results=true");
        if let Some(duracao) = prazo {
            corpo["timeout"] = json!(format!("{}ms", duracao.as_millis()));
            // O cancelamento vem depois do corte, só para não deixar busca presa no banco.
            caminho.push_str(&format!("&cancel_after_time_interval={}ms", duracao.as_millis() + 1000));
        }
        let resposta = match self.pedir(reqwest::Method::POST, &caminho, Some(corpo)).await {
            Ok(resposta) => resposta,
            Err(erro) if prazo.is_some() && erro.to_string().contains("task_cancelled_exception") => {
                return Ok(ResultadoBusca { linhas: Vec::new(), parcial: true });
            }
            Err(erro) => return Err(erro),
        };
        let linhas = resposta["hits"]["hits"]
            .as_array()
            .map(|acertos| {
                acertos
                    .iter()
                    .map(|acerto| LinhaEncontrada {
                        id: acerto["_source"]["id"].as_str().unwrap_or_default().to_string(),
                        ts_ms: acerto["_source"]["ts_ms"].as_i64().unwrap_or_default(),
                        campos: acerto["_source"]["campos"].as_str().unwrap_or("{}").to_string(),
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(ResultadoBusca { linhas, parcial: resposta["timed_out"].as_bool().unwrap_or(false) })
    }

    pub async fn listar_presentes(&self, desde_ms: i64, saida: Sender<String>) -> Result<()> {
        let consulta = json!({"range": {"ts_ms": {"gte": desde_ms}}});
        let mut bloco = String::new();
        let mut blocos_prontos = Vec::new();
        self.pedir(reqwest::Method::POST, "eventos-*/_refresh?ignore_unavailable=true", None).await?;
        self.percorrer(consulta, json!(["aplicacao", "execucao", "seq"]), desde_ms, |fonte| {
            bloco.push_str(&format!(
                "{} {} {}\n",
                fonte["aplicacao"].as_str().unwrap_or_default(),
                fonte["execucao"].as_str().unwrap_or_default(),
                fonte["seq"].as_u64().unwrap_or_default()
            ));
            if bloco.len() > 1_000_000 {
                blocos_prontos.push(std::mem::take(&mut bloco));
            }
        })
        .await?;
        blocos_prontos.push(bloco);
        for pronto in blocos_prontos {
            saida.send(pronto).await.map_err(|_| anyhow!("leitor encerrou"))?;
        }
        Ok(())
    }

    pub async fn apagar_dias_ate(&self, dia_final_exclusivo: i64) -> Result<()> {
        let existentes = self.pedir(reqwest::Method::GET, "_cat/indices/eventos-*?format=json&h=index", None).await?;
        for item in existentes.as_array().cloned().unwrap_or_default() {
            let nome = item["index"].as_str().unwrap_or_default();
            let dia = nome.trim_start_matches("eventos-").parse::<i64>().unwrap_or(i64::MAX);
            if dia < dia_final_exclusivo {
                self.pedir(reqwest::Method::DELETE, nome, None).await?;
            }
        }
        Ok(())
    }

    pub async fn apagar_pessoa(&self, termo_pessoa: &str) -> Result<()> {
        let corpo = json!({"query": {"term": {"termos": termo_pessoa}}});
        self.pedir(
            reqwest::Method::POST,
            "eventos-*/_delete_by_query?refresh=true&conflicts=proceed&ignore_unavailable=true",
            Some(corpo),
        )
        .await
        .map(|_| ())
    }
}
