# Pesquisa: opções de banco de logs

Consulta em 2026-11-15, só fontes primárias (documentação oficial, página de preço, repositório oficial,
crates.io, API do GitHub). Item sem fonte primária fica marcado **[confirmar]**. Não há escolha aqui: é
comparação para o grilling, com o critério do humano em mente (**rápido de execução e baixo custo de
hospedagem**). Complementa [research/armazenamento](https://github.com/stacklabs3/monitora-ai/blob/research/armazenamento/docs/pesquisas/mecanismos-busca-armazenamento.md)
e [docs/pesquisa-inicial/armazenamento.md](../pesquisa-inicial/armazenamento.md), que cobrem modelo de
dados, campos variáveis e retenção.

## Resumo

| | ClickHouse | OpenSearch | PostgreSQL | Loki (referência) |
|---|---|---|---|---|
| Versão atual | 26.10.4.207-stable (estável mais recente) [R1] | 3.9.0 (29/09/2026); linha 2.19 segue com patches (2.19.7) [R2] | 18.7; 14 sai de suporte em 12/11/2026 [P1] | 3.7.10 (13/11/2026) [L1] |
| Licença | Apache-2.0 [R1] | Apache-2.0 [R2][O1] | PostgreSQL License (permissiva, OSI) [P2] | AGPL-3.0 [L1] |
| Quem mantém | ClickHouse, Inc. (org `ClickHouse` no GitHub) [R1] | opensearch-project; OpenSearch Software Foundation (Linux Foundation) apoia, sem supervisão técnica [O2] | PostgreSQL Global Development Group [P1] | Grafana Labs [L1] |
| Maturidade (sinais) | ~51k estrelas, push diário [R1] | ~14k estrelas, release a cada ~2 meses [R2] | 5 versões maiores suportadas, 5 anos cada [P1] | ~29k estrelas [L1] |
| Cliente Rust | `clickhouse` 0.15.3, **oficial** (org ClickHouse), só HTTP [C1][C2] | `opensearch` 2.4.0, no org oficial, "fork comunitário do elasticsearch-rs" [C3][C4] | `tokio-postgres` 0.7.18 ou `sqlx` 0.9.0, comunitários e muito usados [C5] | não se aplica (API HTTP) |
| RAM mínima documentada | recomenda 32 GB; roda com **2 GB** com ajuste e ingestão baixa [D1] | sem mínimo oficial; heap padrão 1 GB, recomenda metade da RAM para heap; Docker Desktop ≥ 4 GB [D2][D3] | sem mínimo; `shared_buffers` padrão 128 MB, 25% da RAM com ≥ 1 GB [D4] | monolítico para até ~20 GB/dia; sem mínimo de RAM para esse modo [D5] |
| Gerenciado, entrada | ClickHouse Cloud Basic: 8 GiB/2 vCPU a US$ 0,21811/h (AWS us-east-1) + US$ 25,30/TB-mês; US$ 300 de teste [M1] | AWS OpenSearch: m7g.medium.search US$ 0,068/h; Serverless mínimo 2 OCU a US$ 0,24/OCU-h [M2] | Lightsail DB US$ 15/mês (1 GB, 1 core, 40 GB); RDS free tier 750 h + 20 GB [M3][M4] | Grafana Cloud Free: 50 GB/mês, 14 dias; Pro US$ 19/mês [M5] |

## ClickHouse

- **Execução:** colunar; a documentação de ajuste diz que máquinas com menos de 16 GB podem dar erro de memória
  com a configuração padrão e lista o que reduzir: mark cache até 500 MB, 1 thread por consulta,
  `max_block_size` 8192, desligar `metric_log`, `text_log`, `trace_log` e `asynchronous_metric_log`, evitar
  integrações S3/Kafka [D1]. Ou seja: cabe numa máquina pequena, mas fora do padrão e com ingestão baixa.
- **Rust:** `clickhouse` (clickhouse-rs) é o "cliente Rust oficial", serde, inserção em lote e contínua
  (`inserter`), LZ4/ZSTD, TLS opcional, mocks para teste; MSRV 1.89 [C2]. Limites: só HTTP (TCP nativo
  planejado), tipo `Dynamic` não suportado, `JSON` tratado como string (ClickHouse 24.10+), validação de
  esquema custa 5 a 10% [C2]. Relevante: o projeto vai guardar campos variáveis por produto.
- **Gerenciado:** compute 8 GiB rodando o mês inteiro ≈ 0,21811 × 730 h ≈ **US$ 159/mês** só de compute
  (conta nossa sobre o preço de [M1]). Pausa automática ("automatic idling") existe [M6]; em quais tiers e se
  zera o compute ocioso: **[confirmar]**.

## OpenSearch

- **Execução:** JVM; heap padrão `-Xms1g -Xmx1g`, recomendação de metade da RAM; produção em Linux exige
  `vm.max_map_count` ≥ 262144 e 65536 arquivos abertos [D2]. Nó único com `discovery.type=single-node`; desde
  2.12 exige senha de admin forte na subida [D3]. Mínimo de RAM do host além do "≥ 4 GB" do Docker Desktop:
  **[confirmar]**.
- **Rust:** crate `opensearch` 2.4.0 (24/03/2026) [C3]. O COMPATIBILITY.md já descreve uma linha 3.x do
  cliente para OpenSearch 2.19 a 3.x, mas a última versão publicada no crates.io é 2.4.0 (cobre 1.x a 2.x) [C4][C3]:
  uso contra OpenSearch 3.9 com o cliente atual **[confirmar]**. Alternativa: chamar a API REST com `reqwest`.
- **Gerenciado:** menor preço explícito na página da AWS é m7g.medium.search a US$ 0,068/h (≈ US$ 50/mês, conta
  nossa) mais EBS gp3 US$ 0,122/GB-mês; a página é inconsistente para gp2 (0,135 vs 0,122) [M2]. Preço de t3
  e free tier não aparecem na página: **[confirmar]**. Serverless: mínimo 2 OCU (dev-test 0,5+0,5) a
  US$ 0,24/OCU-h [M2] ≈ US$ 175/mês com 1 OCU (conta nossa).

## PostgreSQL

- **Execução:** o mais leve de subir; padrão `shared_buffers` 128 MB e `work_mem` 4 MB, `shared_buffers` em 25%
  da RAM para servidor dedicado com ≥ 1 GB [D4]. Desempenho de busca e ingestão depende de JSONB+GIN e
  partições (ver pesquisa anterior), não medido.
- **Rust:** sem cliente oficial do projeto; `tokio-postgres` 0.7.18 (rust-postgres, ~88 mi downloads) e
  `sqlx` 0.9.0 (launchbadge, ~190 mi downloads) [C5].
- **Gerenciado:** Lightsail managed database US$ 15/mês (1 GB RAM, 1 core, 40 GB SSD, sem criptografia);
  HA US$ 30/mês; a página não diz o motor desse plano, Postgres **[confirmar]** [M3]. RDS: free tier de
  750 h em instâncias Single-AZ selecionadas + 20 GB gp2 + 20 GB de backup por um ano; T4g/T3 em modo
  Unlimited cobram crédito de CPU a US$ 0,075/vCPU-h [M4]. Preço por hora do db.t4g.micro: **[confirmar]**.

## Loki (referência)

- Modo monolítico (um binário) para "até aproximadamente 20 GB por dia" [D5]. A tabela de dimensionamento
  só cobre modo distribuído a partir de < 3 TB/dia (≈ 38 CPU e 59 Gi somados) [D6], então não serve para
  máquina pequena. AGPL-3.0 [L1]: usar como serviço separado sem alterar o código não foi analisado
  juridicamente **[confirmar]**.
- Gerenciado: Grafana Cloud Free 50 GB/mês e 14 dias; Pro US$ 19/mês com 50 GB e 30 dias, depois
  US$ 0,05 processamento + US$ 0,40 escrita + US$ 0,10 retenção por GB [M5].
- Não indexa campos de alta cardinalidade como labels (pesquisa anterior); busca por telefone/ID tende a varrer.

## Custo de hospedagem própria (referência)

Lightsail Linux IPv4: US$ 5 (0,5 GB), US$ 12 (2 GB), US$ 24 (4 GB) por mês [M3]; CPU com baseline de 20%
nos planos de 2 e 4 GB (ver [custos.md](../pesquisa-inicial/custos.md)). Pelo documentado, PostgreSQL e
ClickHouse ajustado cabem na faixa de 2 a 4 GB; OpenSearch tem heap de 1 GB padrão mais a JVM e o cache do SO,
e a viabilidade em 2 GB não foi encontrada em fonte oficial **[confirmar]**. Nada disso foi medido.

## O que a prova com dados sintéticos precisa medir

Mesmos dados, mesmas consultas e mesma máquina para os três (Loki opcional como piso de custo):

1. **Máquina:** rodar em 2 GB e 4 GB (ex.: Lightsail US$ 12 e US$ 24) com baseline de CPU limitado; registrar
   versão, configuração (inclusive os ajustes de [D1] e o heap de [D2]) e hardware.
2. **Memória e CPU:** RAM residente em repouso, em ingestão e em consulta; ocorrência de OOM ou erro de memória;
   consumo de crédito de CPU sustentado.
3. **Ingestão:** eventos/s sustentados e em pico pelo cliente Rust escolhido (`clickhouse`, `opensearch` ou
   `reqwest`, `sqlx`/`tokio-postgres`), em lotes; tempo até o evento aparecer na busca.
4. **Consulta:** p50/p95/p99, cache frio e quente, para produto+período, igualdade por ID/telefone, nome exato
   e parcial, texto livre e linha do tempo; com 1 e com N consultas concorrentes.
5. **Disco:** bytes por evento bruto vs. armazenado (dados + índices + WAL/translog/temporários), pico durante
   merge/compactação, efeito da retenção de 30 dias.
6. **Operação:** tempo de subida, reinício após queda no meio de lote, campo novo depois da ingestão, backup e
   restauração.
7. **Cliente Rust:** cobertura do que precisamos (JSON/campos variáveis no `clickhouse`; compatibilidade do
   `opensearch` 2.4.0 com OpenSearch 3.x).
8. **Custo:** converter o menor tamanho que passar nos itens 2 a 4 em US$/mês próprio vs. gerenciado (fórmulas
   acima), por GB/dia ingerido.

## Fontes

- [R1] https://github.com/ClickHouse/ClickHouse (API do GitHub: licença, releases)
- [R2] https://github.com/opensearch-project/OpenSearch/releases
- [P1] https://www.postgresql.org/support/versioning/
- [P2] https://www.postgresql.org/about/licence/
- [L1] https://github.com/grafana/loki (licença, release v3.7.10)
- [O1] https://opensearch.org/faq/
- [O2] https://opensearch.org/foundation/
- [C1] https://crates.io/crates/clickhouse
- [C2] https://github.com/ClickHouse/clickhouse-rs
- [C3] https://crates.io/crates/opensearch
- [C4] https://github.com/opensearch-project/opensearch-rs/blob/main/COMPATIBILITY.md
- [C5] https://crates.io/crates/tokio-postgres · https://crates.io/crates/sqlx
- [D1] https://clickhouse.com/docs/operations/tips
- [D2] https://docs.opensearch.org/latest/install-and-configure/install-opensearch/index/
- [D3] https://docs.opensearch.org/latest/install-and-configure/install-opensearch/docker/
- [D4] https://www.postgresql.org/docs/current/runtime-config-resource.html
- [D5] https://grafana.com/docs/loki/latest/get-started/deployment-modes/
- [D6] https://grafana.com/docs/loki/latest/setup/size/
- [M1] https://clickhouse.com/pricing
- [M2] https://aws.amazon.com/opensearch-service/pricing/
- [M3] https://aws.amazon.com/lightsail/pricing/
- [M4] https://aws.amazon.com/rds/postgresql/pricing/
- [M5] https://grafana.com/pricing/
- [M6] https://clickhouse.com/docs/manage/scaling
