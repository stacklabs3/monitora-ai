# Protocolo de envio de eventos: OpenTelemetry pronto ou formato próprio

Pesquisa de 15/11/2026 para [Pesquisar protocolo de envio de eventos](https://github.com/stacklabs3/monitora-ai/issues/26).
Complementa [Contratos e resiliência de ingestão](https://github.com/stacklabs3/monitora-ai/blob/research/ingestao/docs/pesquisas/contrato-resiliencia-ingestao.md),
que não revisou versões. Todas as consultas foram feitas em 2026-11-15, só em fontes primárias
(especificação, opentelemetry.io, código dos repositórios oficiais, npm, Maven Central, crates.io).
Não houve teste de desempenho: os pesos abaixo são tamanhos publicados, não medições de CPU ou memória.
**Nada foi escolhido**: o documento compara.

## Resumo

- **OTLP (o protocolo) é estável para logs**: especificação OTLP 1.11.1, "Stable" para traces,
  métricas e logs; gRPC na porta 4317, HTTP na 4318 em `/v1/logs`, corpo Protobuf binário ou JSON. [1]
- **Java**: logs estáveis na documentação oficial; SDK 1.68.0 (06/11/2026). Os appenders de Logback
  e Log4j ainda saem como `2.33.1-alpha`. [2][3][4]
- **Node.js**: a documentação oficial ainda marca logs como **Development** [5], mas o pacote
  `@opentelemetry/sdk-logs` foi **declarado estável na 3.0.0 (20/10/2026)**, hoje 3.1.1. A API de logs
  (`@opentelemetry/api-logs` 0.223.0) e os exportadores (0.301.2) continuam em 0.x. [6][7]
- **Rust recebe OTLP** com `opentelemetry-proto` 0.33.1 (tipos gerados e servidor gRPC via `tonic`,
  JSON via `serde`); não há receptor pronto em Rust do projeto oficial. [8][9]
- **Rede fora e fila cheia**: nos dois SDKs, padrão de fila 2048, lote 512, envio a cada 1 s,
  timeout 30 s; **fila cheia descarta** o registro novo e conta o descarte numa métrica interna;
  retry com até 5 tentativas e backoff de 1 s a 5 s. [10][11][12][13]

## 1. O protocolo OTLP

| Item | O que a especificação diz | Fonte |
|---|---|---|
| Versão e status | OTLP 1.11.1, estável para logs; profiles em desenvolvimento | [1] |
| Transportes | gRPC (4317) e HTTP (4318, `POST /v1/logs`) | [1] |
| Codificação | `application/x-protobuf` ou `application/json`; servidor responde no mesmo tipo | [1] |
| Armadilhas do JSON | ids de trace em hex, enums como inteiros, chaves em lowerCamelCase, inteiros de 64 bits como string; receptor ignora campo desconhecido | [1] |
| Compressão | servidor deve aceitar `none` e `gzip` | [1] |
| Retry | só 429, 502, 503 e 504; `Retry-After` deve ser respeitado; 400 não se repete | [1] |
| Sucesso parcial | HTTP 200 com `partial_success` e contagem de rejeitados; cliente não reenvia | [1] |

O formato próprio teria de redefinir cada linha desta tabela (e a documentação de cada uma).

## 2. Node.js

| Pacote | Versão | Status | Fonte |
|---|---|---|---|
| `@opentelemetry/api` | 1.10.0 | estável | [7] |
| `@opentelemetry/api-logs` | 0.223.0 | 0.x (experimental) | [7] |
| `@opentelemetry/sdk-logs` | 3.1.1 | estável desde 3.0.0 | [6][7] |
| `@opentelemetry/exporter-logs-otlp-http` / `-proto` / `-grpc` | 0.301.2 | 0.x | [7] |
| `@opentelemetry/instrumentation-pino` | 0.71.0 | 0.x (contrib) | [7][14] |
| `@opentelemetry/instrumentation-winston` + `@opentelemetry/winston-transport` | 0.70.0 / 0.35.0 | 0.x (contrib) | [7][15] |
| `pino-opentelemetry-transport` (do projeto pino) | 4.0.2 | — | [7][14] |

- **Node mínimo**: `sdk-logs` 3.1.1 declara `engines.node >=22.15.0`. [7]
- **pino**: a instrumentação injeta contexto de trace e envia os logs ao SDK ("log sending") para
  pino `>=5.14.0 <11`; o envio exige pino 7+. Roda na thread principal; a alternativa
  `pino-opentelemetry-transport` roda como transport do pino. [14]
- **winston**: envio para winston `>=3 <4`, exige instalar `@opentelemetry/winston-transport`. [15]
- **Peso (tamanho descompactado no npm, árvore resolvida pelo registro)**: api + api-logs + sdk-logs +
  exportador HTTP/JSON ou HTTP/Protobuf = **11 pacotes, ~13,7 MB**, dos quais ~9,9 MB são
  `@opentelemetry/semantic-conventions` (constantes; muito some com tree-shaking). O exportador gRPC
  soma `@grpc/grpc-js` e vai a **30 pacotes, ~21,4 MB**. O exportador HTTP puxa também `sdk-trace` e
  `sdk-metrics` como dependência. [7] Custo de CPU e memória em execução: [confirmar] por teste.

## 3. Java

| Artefato | Versão | Status | Fonte |
|---|---|---|---|
| `opentelemetry-api` / `-sdk-logs` / `-exporter-otlp` | 1.68.0 | estável | [2][3] |
| `opentelemetry-logback-appender-1.0` | 2.33.1-alpha | alpha | [4] |
| `opentelemetry-log4j-appender-2.17` | 2.33.1-alpha | alpha | [4] |
| `opentelemetry-javaagent` (instrumentação automática) | 2.33.1 | estável | [4] |

- **Java mínimo**: artefatos suportam Java 8+; o sender JDK exige Java 11+ (`java.net.http`). [16][17]
- **Logback/Log4j2**: os appenders fazem a ponte do framework para o SDK. Logs emitidos antes de
  `OpenTelemetryAppender.install(...)` ficam num cache de 1000 registros por padrão
  (`numLogsCapturedBeforeOtelInstall`). SLF4J chega pelo Logback (ou pelo binding do Log4j2). [18]
- **Peso (JARs no Maven Central)**: api, context, common, sdk-common, sdk-logs, exporter-otlp,
  exporter-otlp-common e exporter-common somam ~0,86 MB; o `exporter-otlp` também puxa `sdk-trace` e
  `sdk-metrics` (+0,52 MB), ~1,38 MB no total. Sender padrão é OkHttp: +42 KB do sender, +0,96 MB do
  `okhttp-jvm` 5.5.1, que depende de `kotlin-stdlib` 2.1.21 e `okio-jvm` 3.18.1 (tamanho destes:
  [confirmar]). Trocando para o sender JDK: +21 KB e sem OkHttp/Kotlin, só HTTP/Protobuf. O javaagent
  completo tem 26,5 MB. [3][17]

## 4. Rede fora e fila cheia (comportamento nas versões atuais)

| | Node.js (`sdk-logs` 3.1.1) | Java (1.68.0) | Fonte |
|---|---|---|---|
| Fila / lote / atraso / timeout | 2048 / 512 / 1000 ms / 30000 ms | 2048 / 512 / 1000 ms / 30000 ms | [10][11][19] |
| Fila cheia | descarta o registro novo e soma em `dropLogs` | descarta (`queue.offer` falha) e soma em `dropLogsQueueFull` | [10][11] |
| Retry | 5 tentativas, backoff 1 s → 5 s, ×1,5, jitter ±20% | 5 tentativas, backoff 1 s → 5 s, ×1,5; ligado por padrão (`otel.java.exporter.otlp.retry.disabled=false`) | [12][13][19] |
| O que se repete | HTTP 429/502/503/504 e erros de rede como `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT` | erros transitórios [confirmar lista exata] | [12][20] |
| Envios simultâneos | limite de concorrência no exportador; acima dele, falha "Concurrent export limit reached" | [confirmar] | [21] |
| Persistência em disco | não há | não há no SDK | [10][11] |

Conclusão factual: com o servidor fora por mais do que as ~5 tentativas cobrem, os lotes falham e a
fila de 2048 enche; daí em diante, cada evento novo é descartado sem bloquear a aplicação, e o descarte
só aparece em métrica interna do SDK. A especificação do processador em lote prevê isso. [22]

## 5. Receber OTLP em Rust

| Crate | Versão (data) | Papel | Fonte |
|---|---|---|---|
| `opentelemetry-proto` | 0.33.1 (09/10/2026), MSRV 1.75 | tipos gerados do proto OTLP; feature `gen-tonic` gera `logs_service_server::LogsService` (servidor gRPC); `with-serde` para JSON | [8][9] |
| `tonic` | 0.14.9 | servidor gRPC | [8] |
| `prost` | 0.14.6 | decodificação Protobuf | [8] |
| `axum` | 0.8.9 | servidor HTTP para `/v1/logs` | [8] |

- O README do opentelemetry-rust lista Logs API/SDK/Exporter como estáveis, mas trata do **envio**;
  `opentelemetry-proto` não aparece na tabela de status e segue em 0.x. [9]
- A conformidade do `with-serde` com as regras do JSON OTLP (hex, enums inteiros, int64 em string):
  [confirmar] por teste.
- Alternativa sem código próprio no recebimento: o OpenTelemetry Collector (Go) como processo à parte;
  soma um serviço para hospedar. [23]

## 6. Formato próprio

Um formato próprio (por exemplo JSON sobre HTTP com campos declarados) evita as dependências do SDK e
dá controle do payload, mas o projeto precisaria escrever e manter, em Node e Java: fila limitada, lote,
retry com backoff e `Retry-After`, contagem de descartes, flush no encerramento, compressão, e os
adaptadores de pino, winston, Logback e Log4j2 que os pacotes acima já trazem. No Rust, o receptor é
igualmente escrito à mão nos dois casos (com OTLP, sobre tipos gerados). Não há fonte primária que meça
a diferença de custo; [confirmar] por protótipo.

## 7. O que a biblioteca leve do Monitora AI colocaria por cima (em qualquer opção)

Nenhum destes itens existe nos SDKs oficiais com a semântica do projeto:

- **Campos declarados no código** com tipo, validados antes do envio (o modelo OTLP aceita atributos
  livres). [1]
- **Limites** por evento (tamanho, número de atributos) e da fila, com padrão definido pelo projeto; o
  SDK oferece limites de atributos e de fila, mas não por produto. [10][11]
- **Contagem de descartes visível ao produto**: hoje o descarte vira métrica interna do SDK, que só
  chega se houver exportador de métricas configurado. [10][11]
- **Configuração mínima** (endpoint, credencial do produto, ambiente) escondendo `sdk-logs`,
  exportador e appender, e fixando versões das dependências 0.x/alpha.

## Critério do humano: execução rápida e hospedagem barata

| Aspecto | OTLP com SDK oficial | Formato próprio |
|---|---|---|
| Peso na aplicação | Node ~13,7 MB (HTTP) a ~21,4 MB (gRPC); Java ~1,4 MB + sender | o que a biblioteca escrever |
| Estabilidade | protocolo estável; SDK de logs estável em Java e Node, API/exportadores Node e appenders Java em 0.x/alpha | depende do projeto |
| Comportamento sob falha | pronto e documentado (descarte em fila cheia, retry 5×) | a escrever e testar |
| Recebimento no Rust | `tonic`/`axum` + `opentelemetry-proto` | `axum` + `serde` |
| Custo de CPU/memória | [confirmar] por medição | [confirmar] por medição |
| Hospedagem | um processo Rust; Collector é opcional | um processo Rust |

## Fontes

1. OTLP Specification 1.11.1 — https://opentelemetry.io/docs/specs/otlp/
2. OpenTelemetry Java (status dos sinais) — https://opentelemetry.io/docs/languages/java/
3. Maven Central, `io.opentelemetry` 1.68.0 — https://repo1.maven.org/maven2/io/opentelemetry/opentelemetry-sdk-logs/maven-metadata.xml
4. Maven Central, instrumentation 2.33.1 — https://repo1.maven.org/maven2/io/opentelemetry/instrumentation/opentelemetry-logback-appender-1.0/maven-metadata.xml
5. OpenTelemetry JavaScript (status dos sinais) — https://opentelemetry.io/docs/languages/js/
6. CHANGELOG do opentelemetry-js, 3.0.0: "mark `@opentelemetry/sdk-logs` as stable" (#7143) — https://github.com/open-telemetry/opentelemetry-js/blob/main/CHANGELOG.md
7. Registro npm (`/latest` de cada pacote) — https://registry.npmjs.org/@opentelemetry/sdk-logs
8. crates.io — https://crates.io/crates/opentelemetry-proto , https://crates.io/crates/tonic , https://crates.io/crates/prost , https://crates.io/crates/axum
9. opentelemetry-rust (README e código gerado) — https://github.com/open-telemetry/opentelemetry-rust
10. `BatchLogRecordProcessorBase.ts` — https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/sdk-logs/src/export/BatchLogRecordProcessorBase.ts
11. `BatchLogRecordProcessor.java` e builder — https://github.com/open-telemetry/opentelemetry-java/tree/main/sdk/logs/src/main/java/io/opentelemetry/sdk/logs/export
12. `retrying-transport.ts` e `is-export-retryable.ts` — https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/otlp-exporter-base/src
13. `RetryPolicy.java` — https://github.com/open-telemetry/opentelemetry-java/blob/main/sdk/common/src/main/java/io/opentelemetry/sdk/common/export/RetryPolicy.java
14. README de `instrumentation-pino` — https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-pino
15. README de `instrumentation-winston` — https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-winston
16. README do opentelemetry-java (Java 8+) — https://github.com/open-telemetry/opentelemetry-java
17. Java SDK, senders — https://opentelemetry.io/docs/languages/java/sdk/
18. README do appender Logback — https://github.com/open-telemetry/opentelemetry-java-instrumentation/tree/main/instrumentation/logback/logback-appender-1.0/library
19. Configuração do SDK Java (`otel.blrp.*`, retry) — https://opentelemetry.io/docs/languages/java/configuration/
20. `http-transport-utils.ts` (erros de rede repetíveis) — https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/otlp-exporter-base/src/platform/node/transport/http-transport-utils.ts
21. `otlp-export-delegate.ts` e `bounded-queue-export-promise-handler.ts` — https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/otlp-exporter-base/src
22. Logs SDK, batching processor — https://opentelemetry.io/docs/specs/otel/logs/sdk/#batching-processor
23. Collector, resiliência — https://opentelemetry.io/docs/collector/resiliency/
