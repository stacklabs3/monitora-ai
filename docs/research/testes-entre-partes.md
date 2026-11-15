# Testes entre o servidor Rust e as bibliotecas Node.js e Java

Pesquisa de 15/11/2026 para [Pesquisar testes entre o servidor Rust e as bibliotecas](https://github.com/stacklabs3/monitora-ai/issues/38),
filho de [Mapa: fases do desenvolvimento](https://github.com/stacklabs3/monitora-ai/issues/35).
Todas as consultas foram feitas em 2026-11-15, só em fontes primárias (documentação oficial, código e
CI dos repositórios oficiais, GitHub Releases, npm, Maven Central, crates.io). O protocolo ainda não está
escolhido; OTLP é o candidato forte ([Protocolo de envio de eventos](https://github.com/stacklabs3/monitora-ai/blob/research/protocolo-de-envio/docs/research/protocolo-de-envio.md)).
Não houve medição de tempo de execução: onde o critério "rápido e barato" pede número, o texto marca
**[não medido]**. **Nada foi escolhido**: o documento compara.

A pergunta: como fazer uma mudança no formato do evento, num dos três lados, quebrar um teste antes de
quebrar o recebimento (ex.: a biblioteca Java muda um campo e o servidor deixa de entender).

## Resumo

- **Quatro famílias de técnica**, que se somam em vez de se excluírem: (A) checagem de quebra do
  esquema versionado (`buf breaking` para Protobuf), (B) teste de contrato dirigido pelo consumidor
  (Pact), (C) arquivos de exemplo compartilhados ("golden files") lidos pelos três lados, (D) teste de
  ponta a ponta com containers (Testcontainers). [1][5][10][14]
- **O próprio OpenTelemetry não tem suíte oficial de conformidade OTLP.** O repositório do protocolo
  roda `buf breaking` contra a última tag em toda PR; os SDKs de Java, Rust e JS sobem um Collector
  real no CI e conferem o que chegou; a matriz de conformidade é uma tabela, sem teste automático
  descrito. [1][2][15][16][17][18]
- **Pact cobre as três linguagens** (pact-js 17.1.4, pact-jvm 4.7.7, `pact_consumer` 1.4.11, todos
  MIT ou Apache-2.0), mas corpo Protobuf exige o plugin `pact-protobuf-plugin` 0.8.1, que lista
  suporte a JVM e Rust e não lista Node. [5][6][7][8][9]
- **Custo de CI**: tudo acima é software livre; o que cobra é o runner. No GitHub Actions o runner
  padrão é grátis em repositório público; em privado, o plano Free inclui US$ 12/mês e o Linux 2-core
  custa US$ 0,006/min. O runner Ubuntu 24.04 já traz Docker 28.0.4. [19][20]
- **Partes pagas são opcionais**: PactFlow (Broker hospedado; Starter grátis com 2 integrações, Team
  a partir de US$ 1.385/ano); Testcontainers Cloud é alternativa ao Docker local. O Pact Broker livre roda em Docker com Postgres
  (ou SQLite para teste). [11][12][13][14]

## 1. Como o OpenTelemetry testa o OTLP

| O que | Como funciona | Fonte |
|---|---|---|
| Garantia do esquema | Componentes `Stable` não mudam tipo, número nem nome de campo, nem número de enum, nem apagam símbolo; adicionar campo e mensagem é permitido. Logs, traces e métricas são `Stable` em binário e em JSON. | [1] |
| Checagem de quebra | O CI (`build-check.yaml`, job `breaking-change`) roda `buf breaking --against <repo>#tag=<última release>` e anota a PR com cada quebra; ignora só profiles e processcontext (em desenvolvimento). Versão atual do protocolo: v1.11.1 (29/09/2026). | [2][3] |
| Exemplos de referência | `examples/` traz `logs.json`, `trace.json`, `metrics.json`, `events.json` em OTLP/JSON. | [2] |
| SDK Rust | `opentelemetry-otlp/tests/integration_test` sobe um Collector com **testcontainers**, envia por 4317/4318, e o Collector grava o que recebeu em arquivo; o teste compara com `expected/`. Retry usa endpoint falso em processo. Exige Docker. | [15] |
| SDK Java | `integration-tests/otlp/OtlpExporterIntegrationTest` usa Testcontainers (`@Testcontainers(disabledWithoutDocker = true)`) com a imagem `otel/opentelemetry-collector-contrib:0.165.0` fixada por digest, mais um servidor gRPC falso (Armeria). | [16] |
| SDK JS | Workflow `e2e.yml` baixa o binário `otelcol-contrib` 0.126.0, roda em segundo plano, exporta telemetria, e `npm run verify` confere o arquivo de saída do Collector. Sem Testcontainers. | [17] |
| Collector | `testbed/` tem testes de correção com `GoldenDataProvider` (conjunto "golden" gerado por teste combinatório par a par) e `CorrectnessTestValidator`. `telemetrygen` (estabilidade alpha) é o cliente gerador para teste e demonstração. | [4][21] |
| Matriz de conformidade | `spec-compliance-matrix.md` lista, por linguagem, quais recursos do exportador OTLP existem (gzip, retry etc.); a página não descreve verificação automática. | [18] |

Leitura para o Monitora AI: o padrão do projeto de origem é **checar o esquema na PR** e **testar o
emissor contra um receptor real em container**. Não há um "kit de conformidade" pronto para importar.

## 2. Esquema versionado

### 2.1 Protobuf + `buf breaking`

| Item | Detalhe | Fonte |
|---|---|---|
| Ferramenta | `buf` CLI v1.75.0 (22/10/2026), Apache-2.0, mantida pela Buf Technologies (`bufbuild`). Também sai no npm como `@bufbuild/buf` 1.75.0. | [3][22] |
| Categorias | `FILE` (padrão, mais estrita), `PACKAGE`, `WIRE_JSON` (a doc chama de "recommended minimum level") e `WIRE` (só binário). | [10] |
| Contra o quê compara | Uma referência git (tag ou branch), como faz o OpenTelemetry; não precisa do registro pago (BSR). | [2] |
| Regras de evolução | Não mudar número de campo; campo novo é seguro (código antigo ignora); campo removido tem número e nome em `reserved`; proto3 preserva campos desconhecidos no binário, não no JSON. | [23] |
| Geração por linguagem | Rust: `prost` 0.14.6 (Apache-2.0, `tokio-rs`) e `opentelemetry-proto` 0.33.1 (tipos OTLP prontos). Node: `@bufbuild/protobuf` 2.17.0. Java: `protobuf-java` do projeto `protocolbuffers` (BSD-3-Clause; release atual v36.2, v37.0 em RC). | [24][25][22][26] |

O que pega: renomear, renumerar ou mudar tipo de campo **no `.proto`**. O que não pega: a biblioteca
Java montar o evento errado com um esquema correto (ex.: deixar de preencher um atributo que o servidor
exige) — isso é regra de negócio, não de esquema, e pede as técnicas B, C ou D.

Se o protocolo for OTLP puro, o `.proto` é o do OpenTelemetry e quem garante a compatibilidade é o
próprio projeto [1][2]; o que fica do lado do Monitora AI são os **atributos** que ele exige dentro do
evento (nomes de chave em `attributes`), que o Protobuf não descreve.

### 2.2 JSON Schema

| Item | Detalhe | Fonte |
|---|---|---|
| Versão da especificação | 2020-12 (a atual; anterior 2019-09). | [27] |
| Validadores | Rust: `jsonschema` 0.61.2 (MIT). Node: `ajv` 8.20.0 (MIT). Java: `networknt/json-schema-validator` 3.0.9 (Apache-2.0). | [24][22][28] |
| Checagem de quebra | Não achei ferramenta oficial do json-schema.org que compare duas versões de um esquema e diga se é quebra. **[não confirmado]** | — |

Serve para descrever o "envelope" do Monitora AI (quais atributos são obrigatórios) e validar os
exemplos nos três lados; a detecção de quebra entre versões fica por conta de teste (técnica C).

## 3. Teste de contrato com Pact

Como funciona: o teste do consumidor registra a interação esperada num servidor falso e gera um
**arquivo de pact**; a verificação do provedor reaplica cada requisição contra o provedor real e
confere a resposta. Para filas e eventos há "message pacts". O Broker integra o fluxo ao CI. [5]
No Monitora AI, as bibliotecas seriam os **consumidores** (fazem a requisição) e o servidor Rust o
**provedor** (verifica).

| Lado | Pacote | Versão | Licença | Fonte |
|---|---|---|---|---|
| Node (bibliotecas) | `@pact-foundation/pact` | 17.1.4 (07/09/2026), Node `>=22`; usa `pact-core` (núcleo Rust via FFI); tem plugins e mensagens | MIT | [6][22] |
| Java (bibliotecas) | `au.com.dius.pact.consumer:junit5` | 4.7.7 (03/11/2026) | Apache-2.0 | [7][29] |
| Rust (servidor) | `pact_consumer` / `pact_verifier` / `pact_verifier_cli` | 1.4.11 / 1.6.0 / 1.5.0 (13/11/2026); spec V3 e V4 | MIT (pact_consumer: MIT AND Apache-2.0) | [8][24][30] |
| Protobuf/gRPC | `pact-protobuf-plugin` | 0.8.1 (05/10/2026); proto3, mensagens e gRPC unário; sem streaming gRPC, sem proto2; lista Pact-JVM e Pact-Rust como suportados, **não lista Pact-JS** | MIT | [9] |
| Broker | `pact_broker` (imagem `pactfoundation/pact-broker`) | v2.124.0 (11/11/2026); Postgres em produção, SQLite para experimentar | MIT | [11][12] |

Mantenedores: Pact Foundation (organização `pact-foundation` no GitHub); o plugin Protobuf mora em
`pactflow`. [6][7][8][9]

Onde a própria documentação diz que Pact serve: quando você controla os dois lados, ambos em
desenvolvimento ativo, poucos consumidores, microsserviços da mesma organização. Onde não serve:
API pública (consumidor não identificável), lado que não usa Pact, teste funcional do provedor,
teste de carga. [13]

Custo: frameworks e Broker livres; o Broker auto-hospedado é mais um serviço com banco para manter.
PactFlow Starter é grátis (2 integrações); Team custa US$ 1.385/ano (ou US$ 127/mês). [11][12][14]
Tempo de execução no CI: **[não medido]**; o teste de consumidor roda contra servidor falso local, sem
Docker. [5]

## 4. Arquivos de exemplo compartilhados (golden files)

Técnica, não ferramenta: um conjunto versionado de eventos de exemplo (JSON ou binário) que (a) cada
biblioteca precisa **produzir** igual e (b) o servidor precisa **aceitar**. É o que o OpenTelemetry
publica em `examples/` [2] e o que o testbed do Collector usa como "golden dataset" [4]; o SDK Rust
compara a saída do Collector com arquivos em `expected/` [15]. Custo: nenhuma dependência nova; roda
como teste de unidade em cada linguagem, sem rede nem Docker. Ponto fraco: sem um lado "dono" do
arquivo, os dois lados podem divergir do exemplo ao mesmo tempo, e o teste só pega o que está no
exemplo. [não medido]

## 5. Ponta a ponta com containers (Testcontainers)

| Linguagem | Pacote | Versão | Licença | Fonte |
|---|---|---|---|---|
| Java | `org.testcontainers:testcontainers` | 2.0.5 (20/04/2026) | MIT | [31][32] |
| Node | `testcontainers` | 12.2.1 (13/10/2026), Node `>= 22.22` | MIT | [31][22] |
| Rust | `testcontainers` (crate) | 0.28.0 (06/08/2026), Rust 1.88+ | MIT OR Apache-2.0 | [31][24] |

Mantido pela organização `testcontainers` no GitHub. Exige um ambiente Docker: testado em Docker
recente no Linux e Docker Desktop no Mac/Windows; Podman, Colima e Rancher funcionam sem teste ativo;
Testcontainers Cloud é citado como runtime alternativo (preço não consultado). [33] No GitHub Actions, a imagem Ubuntu 24.04 vem com
Docker 28.0.4 e Compose 2.38.2. [20]

Formas de usar no Monitora AI, todas vistas nos SDKs do OpenTelemetry:
- **Biblioteca contra o servidor real**: a biblioteca Node ou Java envia para o servidor Rust em
  container e o teste confere o que foi gravado (é o que pega "Java mudou um campo"). Custo: construir
  a imagem do servidor no CI. [não medido]
- **Biblioteca contra o Collector**: como Java [16] e Rust [15] fazem; confirma que a biblioteca fala
  OTLP válido, mas não que o servidor do Monitora AI entende.
- **Sem Testcontainers**: binário em segundo plano no próprio job, como o JS faz [17].

Custo: o mais caro das quatro técnicas em tempo (baixar imagem, subir container); número **[não medido]**.

## 6. Comparação pelo critério do humano (rápido e barato)

| Técnica | O que quebra antes do recebimento | Precisa de Docker | Serviço extra | Custo em dinheiro | Tempo de CI |
|---|---|---|---|---|---|
| A. `buf breaking` | Mudança incompatível no `.proto` | Não (CLI ou npm) | Não | Zero | [não medido] |
| A'. JSON Schema | Evento fora do envelope (em cada lado) | Não | Não | Zero | [não medido] |
| B. Pact | Requisição da biblioteca que o servidor não aceita | Não (Broker opcional) | Broker, se usado | Zero (auto-hospedado) ou PactFlow | [não medido] |
| C. Golden files | Divergência de qualquer lado em relação ao exemplo | Não | Não | Zero | [não medido] |
| D. Testcontainers | Qualquer quebra real, inclusive transporte e compressão | Sim | Não | Minutos de runner | [não medido], o maior |

Fontes da tabela: seções 2 a 5. Em todas, o custo em dinheiro é o runner: grátis em repositório
público; em privado, US$ 0,006/min no Linux 2-core depois dos US$ 12 incluídos no plano Free. [19]

## Lacunas

- Tempo de execução de cada técnica no CI: não medido; pede um protótipo.
- Ferramenta de detecção de quebra entre versões de JSON Schema: não confirmada.
- Suporte do `pact-protobuf-plugin` no Pact-JS: o README do plugin não lista; o README do pact-js tem
  uma página de plugins, sem lista de plugins compatíveis. [6][9]

## Fontes

Consultadas em 2026-11-15.

1. README do opentelemetry-proto (maturidade e estabilidade): https://github.com/open-telemetry/opentelemetry-proto/blob/main/README.md
2. CI e Makefile do opentelemetry-proto (`breaking-change`, `examples/`): https://github.com/open-telemetry/opentelemetry-proto/blob/main/.github/workflows/build-check.yaml , https://github.com/open-telemetry/opentelemetry-proto/blob/main/Makefile , https://github.com/open-telemetry/opentelemetry-proto/tree/main/examples
3. Releases: https://github.com/open-telemetry/opentelemetry-proto/releases , https://github.com/bufbuild/buf/releases
4. Collector testbed: https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/testbed/README.md
5. Como o Pact funciona: https://docs.pact.io/getting_started/how_pact_works
6. pact-js: https://github.com/pact-foundation/pact-js (README, package.json, releases)
7. pact-jvm: https://github.com/pact-foundation/pact-jvm/releases
8. Pact em Rust: https://docs.pact.io/implementation_guides/rust , https://github.com/pact-foundation/pact-reference/releases
9. pact-protobuf-plugin: https://github.com/pactflow/pact-protobuf-plugin (README, releases)
10. Regras do buf breaking: https://buf.build/docs/breaking/rules
11. Pact Broker: https://github.com/pact-foundation/pact_broker (README, releases)
12. Imagem Docker do Broker: https://docs.pact.io/pact_broker/docker_images
13. Para que o Pact serve: https://docs.pact.io/getting_started/what_is_pact_good_for
14. Preços do PactFlow: https://pactflow.io/pricing/
15. Testes de integração do SDK Rust: https://github.com/open-telemetry/opentelemetry-rust/tree/main/opentelemetry-otlp/tests/integration_test
16. Teste de integração OTLP do SDK Java: https://github.com/open-telemetry/opentelemetry-java/blob/main/integration-tests/otlp/src/main/java/io/opentelemetry/integrationtest/OtlpExporterIntegrationTest.java
17. Workflow e2e do SDK JS: https://github.com/open-telemetry/opentelemetry-js/blob/main/.github/workflows/e2e.yml
18. Matriz de conformidade: https://github.com/open-telemetry/opentelemetry-specification/blob/main/spec-compliance-matrix.md
19. Cobrança do GitHub Actions: https://docs.github.com/en/billing/concepts/product-billing/github-actions
20. Imagem Ubuntu 24.04 do runner: https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md
21. telemetrygen: https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/cmd/telemetrygen/README.md
22. npm: https://www.npmjs.com/package/@pact-foundation/pact , https://www.npmjs.com/package/testcontainers , https://www.npmjs.com/package/@bufbuild/protobuf , https://www.npmjs.com/package/@bufbuild/buf , https://www.npmjs.com/package/ajv
23. Atualizar mensagem Protobuf: https://protobuf.dev/programming-guides/proto3/#updating
24. crates.io: https://crates.io/crates/pact_consumer , https://crates.io/crates/pact_verifier , https://crates.io/crates/testcontainers , https://crates.io/crates/prost , https://crates.io/crates/opentelemetry-proto , https://crates.io/crates/jsonschema
25. prost: https://github.com/tokio-rs/prost/releases
26. protobuf: https://github.com/protocolbuffers/protobuf/releases
27. JSON Schema: https://json-schema.org/specification
28. networknt/json-schema-validator: https://github.com/networknt/json-schema-validator/releases
29. Maven Central (Pact JVM): https://repo1.maven.org/maven2/au/com/dius/pact/consumer/junit5/maven-metadata.xml
30. pact-reference (licença MIT): https://github.com/pact-foundation/pact-reference
31. Testcontainers: https://github.com/testcontainers/testcontainers-java/releases , https://github.com/testcontainers/testcontainers-node/releases , https://github.com/testcontainers/testcontainers-rs/releases
32. Maven Central (Testcontainers): https://repo1.maven.org/maven2/org/testcontainers/testcontainers/maven-metadata.xml
33. Ambientes Docker suportados: https://java.testcontainers.org/supported_docker_environment/
