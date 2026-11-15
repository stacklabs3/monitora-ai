# Bibliotecas Rust do servidor

Ticket: [Pesquisar bibliotecas Rust do servidor](https://github.com/stacklabs3/monitora-ai/issues/25).
Consulta: **2026-11-15**. Comparação, não escolha. Critério do humano: rápido de execução e baixo
custo de hospedagem (consumo de memória).

Fontes: API do crates.io (`https://crates.io/api/v1/crates/<crate>`: versão estável, licença,
MSRV, datas, downloads) e API do GitHub (`repos/<org>/<repo>`: dono, último push, arquivado).
"Downloads 90d" é o campo `recent_downloads` do crates.io. Afirmação sem fonte primária está marcada
**[confirmar]**.

## 1. Runtime, HTTP e gRPC

| Crate | Versão (data) | Licença | Mantém | MSRV | Downloads 90d | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| `tokio` | 1.54.1 (2026-10-21) | MIT | org tokio-rs | 1.85 | 310 M | Base de axum, tonic, hyper; estável 1.x desde 2020 [confirmar data do 1.0]. |
| `hyper` | 1.12.0 (2026-10-06) | MIT | org hyperium | – | 287 M | HTTP/1 e HTTP/2 de baixo nível; base de axum e tonic. |
| `tower` | 0.5.3 (2026-01-12) | MIT | org tower-rs | – | 244 M | Middleware (`Service`) partilhado por axum e tonic. |
| `axum` | 0.8.9 (2026-04-14) | MIT | org tokio-rs | 1.80 | 166 M | Ainda 0.x (quebra possível em 0.9). Roda sobre tokio + hyper + tower. |
| `actix-web` | 4.19.0 (2026-11-09) | MIT OR Apache-2.0 | org actix | 1.89 | 13 M | 4.x estável; runtime próprio (`actix-rt`, sobre tokio) [confirmar]. Middleware não é tower. |
| `poem` | 3.1.12 (2025-07-28) | MIT OR Apache-2.0 | org poem-web | – | 0,9 M | Alternativa com OpenAPI embutido (`poem-openapi`) [confirmar]; última versão há 15 meses. |
| `tonic` | 0.14.9 (2026-10-29) | MIT | org grpc (repo `grpc/grpc-rust`) | 1.88 | 115 M | gRPC sobre hyper/HTTP2, codegen via prost. README avisa: a `master` prepara mudanças que quebram; o lançado está em `v0.14.x`. |

Leitura:

- **axum + tonic** dividem tokio, hyper e tower: um processo só pode servir o painel (HTTP) e a
  ingestão gRPC com a mesma pilha de middleware. Fonte: README do tonic (componentes hyper/tokio)
  e dependências no crates.io.
- **actix-web** tem versão 4.x estável e é o mais antigo dos três, mas um volume de uso ~12x menor
  que axum (crates.io, 90 dias) e middleware próprio; misturar com tonic significa duas pilhas.
- **Memória e velocidade:** não há medição primária comparável entre axum e actix-web no mesmo
  cenário do Monitora AI. Rankings públicos (TechEmpower, https://www.techempower.com/benchmarks/)
  medem vazão em testes sintéticos, não memória **[confirmar números da rodada atual]**. A diferença
  esperada entre os dois é pequena perto do custo do banco; quem decide é uma medição local
  (RSS em repouso e sob carga de ingestão).

## 2. Receber OTLP em Rust

| Peça | Versão (data) | Licença | Mantém | O que dá |
| --- | --- | --- | --- | --- |
| `opentelemetry-proto` | 0.33.1 (2026-10-09) | Apache-2.0 | projeto OpenTelemetry (`open-telemetry/opentelemetry-rust`) | Tipos gerados do `opentelemetry-proto`. Features: `gen-tonic` (servidores/clientes gRPC), `gen-tonic-messages`, `with-serde` (OTLP/JSON), `logs`, `trace`, `metrics`, `profiles`. MSRV 1.75. 67 M downloads/90d. |
| `prost` | 0.14.6 (2026-11-12) | Apache-2.0 | org tokio-rs | Codificação protobuf usada por tonic e pelo `opentelemetry-proto`. |
| Rotel (`rotel-dev/rotel`) | v0.2.7 (2026-10-30) | Apache-2.0 | org rotel-dev | Coletor OTel em Rust: receptor OTLP gRPC, HTTP/Protobuf e HTTP/JSON; exportador ClickHouse. Ainda 0.x, 414 estrelas. Diz-se "resource efficient" (README, sem número primário **[confirmar]**). |
| Vector (`vectordotdev/vector`) | v0.61.0 (2026-10-29) | MPL-2.0 | org vectordotdev (Datadog [confirmar]) | Fonte `opentelemetry` com gRPC e HTTP (`src/sources/opentelemetry/{grpc,http}.rs`). É um binário completo, não uma biblioteca para embutir. |

Leitura:

- Não achei crate de **receptor** OTLP pronto para embutir num servidor: o caminho como biblioteca
  é `opentelemetry-proto` (tipos + traits de serviço com `gen-tonic`) montado em tonic (gRPC) e num
  framework HTTP (OTLP/HTTP com protobuf via prost ou JSON via `with-serde`) **[confirmar: busca no
  crates.io por "otlp receiver" não foi exaustiva]**.
- Rotel e Vector são alternativas de **coletor separado** na frente do servidor, não bibliotecas.
- `opentelemetry-proto` continua 0.x e muda a cada versão da especificação; trava-se a versão.

## 3. Serialização

| Crate | Versão (data) | Licença | Mantém | Notas |
| --- | --- | --- | --- | --- |
| `serde` | 1.0.229 (2026-07-18) | MIT OR Apache-2.0 | org serde-rs | Padrão de fato; 434 M downloads/90d. 1.x estável desde 2017 [confirmar]. |
| `serde_json` | 1.0.154 (2026-10-11) | MIT OR Apache-2.0 | org serde-rs | JSON para a API do painel e OTLP/JSON. |
| `simd-json` | 0.19.0 (2026-10-27) | Apache-2.0 OR MIT | org simd-lite | Parser JSON com SIMD, compatível com serde; ganho de CPU no parse de payload grande [confirmar medição]. 0.x. |
| `prost` | 0.14.6 (2026-11-12) | Apache-2.0 | org tokio-rs | Protobuf (OTLP e gRPC). |

## 4. Clientes dos bancos candidatos

| Crate | Versão (data) | Licença | Mantém | MSRV | Downloads 90d | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| `clickhouse` | 0.15.3 (2026-10-13) | MIT OR Apache-2.0 | **oficial**, org ClickHouse | 1.89 | 6,2 M | Transporte HTTP com `RowBinary`/`RowBinaryWithNamesAndTypes`, linhas via serde, LZ4/ZSTD, insert contínuo. Protocolo nativo TCP só "planejado" (README). 0.x. |
| `opensearch` | 2.4.0 (2026-03-24) | Apache-2.0 | **oficial**, org opensearch-project | – | 0,6 M | Fork comunitário do `elasticsearch-rs`. Matriz: cliente 2.x ↔ OpenSearch 1.x–2.x; 3.x ↔ 2.19–3.x, mas **3.x ainda não está no crates.io** (última 2.4.0). Repo pequeno (93 estrelas). |
| `sqlx` | 0.9.0 (2026-05-21) | MIT OR Apache-2.0 | org transact-rs (antes launchbadge; o repo redireciona) | 1.94.0 | 58 M | Async puro, consultas checadas em tempo de compilação (opcional), pool embutido, PostgreSQL/MySQL/SQLite. 0.x. |
| `tokio-postgres` | 0.7.18 (2026-06-12) | MIT OR Apache-2.0 | org rust-postgres | – | 27 M | Driver async de PostgreSQL mais baixo nível; sem pool (pool vem de crate à parte, ex. `deadpool-postgres` [confirmar]). |

Leitura:

- **ClickHouse** e **OpenSearch** têm cliente oficial em Rust; o do ClickHouse é bem mais ativo
  (6,2 M vs 0,6 M downloads/90d; 569 vs 93 estrelas).
- **PostgreSQL:** `sqlx` dá ergonomia e checagem de SQL; `tokio-postgres` é mais fino. Diferença de
  memória/velocidade entre os dois **[confirmar com medição]**.
- MSRV do `sqlx` 0.9 (1.94) é o maior da lista: define a versão mínima do Rust do projeto se entrar.

## 5. Sinais de manutenção (2026-11-15)

Todos os repositórios acima estão ativos (push nas últimas 6 semanas) e nenhum está arquivado
(API do GitHub). Mudanças de casa que importam: `tonic` foi para `grpc/grpc-rust` e `sqlx` para
`transact-rs/sqlx` (redirecionamentos do GitHub). Maturidade de API: 1.x/4.x estáveis em tokio,
hyper, serde e actix-web; 0.x em axum, tonic, prost, sqlx, clickhouse e opentelemetry-proto.

## Fontes

- crates.io API (consultada 2026-11-15): https://crates.io/api/v1/crates/tokio ,
  https://crates.io/api/v1/crates/axum , https://crates.io/api/v1/crates/actix-web ,
  https://crates.io/api/v1/crates/poem , https://crates.io/api/v1/crates/tonic ,
  https://crates.io/api/v1/crates/hyper , https://crates.io/api/v1/crates/tower ,
  https://crates.io/api/v1/crates/opentelemetry-proto , https://crates.io/api/v1/crates/prost ,
  https://crates.io/api/v1/crates/serde , https://crates.io/api/v1/crates/serde_json ,
  https://crates.io/api/v1/crates/simd-json , https://crates.io/api/v1/crates/sqlx ,
  https://crates.io/api/v1/crates/tokio-postgres , https://crates.io/api/v1/crates/clickhouse ,
  https://crates.io/api/v1/crates/opensearch
- Repositórios oficiais e READMEs: https://github.com/tokio-rs/tokio , https://github.com/tokio-rs/axum ,
  https://github.com/actix/actix-web , https://github.com/poem-web/poem ,
  https://github.com/grpc/grpc-rust , https://github.com/open-telemetry/opentelemetry-rust/tree/main/opentelemetry-proto ,
  https://github.com/tokio-rs/prost , https://github.com/serde-rs/serde ,
  https://github.com/transact-rs/sqlx , https://github.com/rust-postgres/rust-postgres ,
  https://github.com/ClickHouse/clickhouse-rs , https://github.com/opensearch-project/opensearch-rs
  (e `COMPATIBILITY.md`), https://github.com/rotel-dev/rotel ,
  https://github.com/vectordotdev/vector/tree/master/src/sources/opentelemetry
- Docs: https://docs.rs/opentelemetry-proto , https://docs.rs/tonic , https://docs.rs/clickhouse
- Benchmark citado só como ponto de partida: https://www.techempower.com/benchmarks/
