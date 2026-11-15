# Pesquisa: referências de investigação de logs e de alertas

Pesquisa de 15/11/2026 para o ticket [Pesquisar referências de investigação de logs e alertas](https://github.com/stacklabs3/monitora-ai/issues/12), do mapa [Mapa: protótipo do desenho inicial](https://github.com/stacklabs3/monitora-ai/issues/11). Só documentação oficial dos fornecedores; cada afirmação traz o link da página que a sustenta. O arquivo **descreve padrões e diferenças e não recomenda escolha**: ele alimenta os tickets de princípios e de rotinas.

Vocabulário do [GLOSSARY.md](https://github.com/stacklabs3/monitora-ai/blob/chore/glossario-mapa-prototipo/GLOSSARY.md): **Produto** (sistema atendido, que reúne aplicações), **Aplicação** (parte executável que envia eventos) e **Alerta** (aviso fora do painel quando eventos atendem a uma condição). Os termos de cada ferramenta (facet, data view, contact point, monitor, rule) aparecem entre aspas ou em itálico quando citados como nome do fornecedor.

Limites: não houve acesso a contas das ferramentas, então não há prints próprios; as páginas citadas trazem as capturas oficiais. Onde a página consultada não cobre um ponto, o texto diz isso em vez de supor.

## Resumo dos padrões

| Tema | Datadog (Log Explorer) | Grafana Explore + Loki | Elastic (Kibana Discover) | Dynatrace (Logs / Notebooks) |
|---|---|---|---|---|
| Busca | barra com `chave:valor` + texto livre, `AND` implícito, `OR`, `-` | LogQL: seletor de *labels* + filtros de linha + filtros por campo extraído | KQL (ou Lucene) na barra + *filter pills*; ou ES\|QL | campo de filtro `chave operador valor` (AND implícito, `in`) ou DQL |
| Filtro por clique | *facet panel* com valores e contagens | *log details* com filtro positivo/negativo; Logs Drilldown | lista de campos com valores frequentes | *facets*: OR dentro da faceta, AND entre facetas |
| Muitos eventos | lista paginada, colunas configuráveis, Live Tail amostrado | histograma de volume, rolagem infinita, deduplicação | amostra padrão de 500 documentos, 100 por página, "Load more" | gráfico de distribuição por status, "search in results" no navegador |
| Detalhe | *side panel*: contexto + atributos + ações + trace | *log details* inline ou lateral, estatística por campo, links | *flyout* com tabela de campos, fixar campo, copiar link | painel de detalhes, JSON clicável vira filtro, links para trace e entidades |
| Vizinhança | "View in context" | "Log context" (tipo `grep -C`) | "View surrounding documents" | "Surrounding logs" |
| Correlação por ID | *Transactions* por atributo comum (ex. `requestId`), com duração e severidade máxima | *derived fields* viram link para trace | `trace.id`/`transaction.id` (ECS) injetados pelo agente | `trace_id`/`dt.trace_id` no log; *join* com *spans* em DQL |
| Campos com tipo | *facet* é declarada com tipo (dimensão string/inteiro, medida long/double) e só vale para logs novos | *labels* indexadas + *structured metadata* não indexada; tipos só na consulta | *mapping* explícito por índice; tipo não muda sem reindexar; *runtime fields* | processamento no OpenPipeline (DQL) gera campos tipados |
| Credenciais | API key (envio), application key (leitura), client token (navegador) | *access policies* com escopos `logs:write`/`logs:read` e *label policy* | API keys com privilégios recortados; valor só na criação | access token `logs.ingest` ou platform token; valor só na criação |
| Alerta por volume | *log monitor*: consulta + contagem + *group by* + janela + limite | regra com consulta LogQL (`count_over_time`) + *reduce* + *threshold* + *pending period* | *log threshold rule* (contagem com condições, *group by*, razão) | log alert ou detector com `makeTimeseries count()`; janela deslizante de amostras |
| Alerta por reinício | métrica `kubernetes_state.container.restarts` em *monitor* | métrica `kube_pod_container_status_restarts_total` com `increase()` | campo `kubernetes.container.status.restarts` | alerta pronto "Detect container restarts" |
| Telegram | não nativo; via webhook | **nativo** (contact point) | não listado; via webhook | não nativo; via HTTP Request em Workflows |
| WhatsApp | não nativo | não nativo | não listado | não nativo |

## 1. Busca e filtros combinados

**Datadog.** A consulta junta termos soltos e sequências entre aspas com operadores booleanos sensíveis a maiúsculas: `AND` é o padrão quando nada é dito, `OR` aceita qualquer um, `-` exclui, e parênteses agrupam, como em `env:(prod OR test)` ([sintaxe de busca](https://docs.datadoghq.com/logs/explorer/search_syntax/)). Atributo se busca com `@atributo:valor`; atributos reservados (`service`, `status`, `host`) dispensam o `@`; `*:termo` busca em todos os atributos, e termo solto busca só na mensagem e em alguns atributos de erro ([sintaxe de busca](https://docs.datadoghq.com/logs/explorer/search_syntax/)). Curingas (`*`) valem dentro da palavra, e intervalos numéricos usam `>100` ou `[400 TO 499]`; busca numérica exige o atributo declarado como *facet* ([sintaxe de busca](https://docs.datadoghq.com/logs/explorer/search_syntax/)). A barra tem destaque de sintaxe, validação de erro e autocompletar com *facets*, valores, as 100 buscas recentes e *Saved Views* ([busca](https://docs.datadoghq.com/logs/explorer/search/)). O *facet panel* permite filtrar sem escrever consulta: dimensões mostram os valores mais frequentes com contagem, e medidas têm um controle deslizante de mínimo e máximo ([facets](https://docs.datadoghq.com/logs/explorer/facets/)).

**Grafana + Loki.** Toda consulta LogQL começa por um seletor de *stream* por *labels* entre chaves (`=`, `!=`, `=~`, `!~`) e segue por um *pipeline* de estágios ([consultas de log](https://grafana.com/docs/loki/latest/query/log_queries/)). Filtros de linha (`|=`, `!=`, `|~`, `!~`) agem sobre o texto e, segundo a documentação, são o jeito mais rápido de filtrar depois do seletor; *parsers* (`json`, `logfmt`, `pattern`, `regexp`) extraem campos, e filtros de *label* comparam pelo tipo do valor (texto, duração `300ms`, bytes `20MB`, número), combináveis com `and`/`or` e parênteses ([consultas de log](https://grafana.com/docs/loki/latest/query/log_queries/)). O Logs Drilldown oferece exploração "sem consulta", filtrando por *labels*, campos ou padrões e levando ao Explore quando se quer LogQL ([Logs Drilldown](https://grafana.com/docs/grafana/latest/visualizations/simplified-exploration/logs/)).

**Elastic.** Discover tem dois modos: o clássico, com uma *data view* e busca KQL ou Lucene na barra mais filtros, e o modo ES|QL, em que a consulta nomeia os dados direto no editor ([Discover](https://www.elastic.co/docs/explore-analyze/discover/discover-get-started)). KQL só filtra (não agrega nem ordena): `campo: valor`, `AND`/`OR`/`NOT` com parênteses, faixas (`>=`), curingas e frases entre aspas, com sugestões de campo, operador e valor ao digitar ([KQL](https://www.elastic.co/docs/explore-analyze/query-filter/languages/kql)).

**Dynatrace.** O app Logs permite achar logs sem DQL, por filtros e *facets*, e tem a opção "Edit DQL query" para escrever a consulta ([Logs app](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app)). O campo de filtro usa `chave comparador valor`, com AND implícito entre declarações, `in` para vários valores (`status in (ERROR, WARN)`), curinga, `* ~ "frase"` para todos os campos e `content ~ "frase"` só no corpo, que tem melhor desempenho; autocompletar sugere até 100 valores das últimas 24 horas, e filtros recentes e fixados se reaplicam com um clique ([consultar e filtrar](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app/query-and-filter)). Nas *facets*, valores dentro de uma faceta se combinam com OR e facetas diferentes com AND; as contagens são aproximadas, e `~` indica amostragem ([facets](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app/facets)). Notebooks reúnem, num documento compartilhável, seções de consulta DQL (com visualização automática do resultado), seções *Explore* de apontar e clicar sobre logs e seções Markdown, com exportação em CSV ou JSON ([Notebooks](https://docs.dynatrace.com/docs/analyze-explore-automate/dashboards-and-notebooks/notebooks)).

**Padrão comum:** as quatro juntam uma linguagem textual com um painel de cliques que escreve o filtro na barra. **Diferença:** Datadog, Elastic e Dynatrace filtram por qualquer campo; o Loki exige primeiro um seletor por *labels* indexadas e filtra o resto depois.

## 2. Lista de resultados com muitos eventos

**Datadog.** A visualização em lista é paginada; colunas se ordenam, reorganizam e removem, e se acrescentam pelo *facet panel* ou pelo *side panel*; o padrão é por horário, mais novo primeiro, e a ordenação só é confiável para *facets* declaradas ([visualizações](https://docs.datadoghq.com/logs/explorer/visualize/)). A configuração da tabela fica salva em *Saved Views*; a mesma busca pode virar série temporal, *top list*, tabela e outras agregações ([visualizações](https://docs.datadoghq.com/logs/explorer/visualize/), [busca](https://docs.datadoghq.com/logs/explorer/search/)). *Patterns* agrupam eventos parecidos, ordenados por contagem ([visualizações](https://docs.datadoghq.com/logs/explorer/visualize/)). O Live Tail mostra eventos quase em tempo real e, quando muitos casam, amostra a saída de forma aleatória uniforme ([Live Tail](https://docs.datadoghq.com/logs/explorer/live_tail/)).

**Grafana.** Explore mostra um histograma de volume no período; o cálculo do volume no intervalo inteiro pode pesar no Loki ([logs no Explore](https://grafana.com/docs/grafana/latest/explore/logs-integration/)). A lista ordena por mais novos ou mais antigos com rolagem infinita, permite escolher campos como colunas, quebra de linha com JSON formatado, filtro e cor por nível, e quatro modos de deduplicação (nenhum, exato, números, assinatura) ([logs no Explore](https://grafana.com/docs/grafana/latest/explore/logs-integration/)). Há *live tailing* com pausa e exportação em TXT, JSON ou CSV ([logs no Explore](https://grafana.com/docs/grafana/latest/explore/logs-integration/)).

**Elastic.** Acima da tabela há um gráfico de como os resultados se distribuem no tempo ([Discover](https://www.elastic.co/docs/explore-analyze/discover/discover-get-started)). No modo clássico a amostra padrão é de 500 documentos (reduzível até 10), com 100 linhas por página e "Load more" na última página; a ordenação da tabela só reordena as linhas carregadas e não muda a consulta; densidade e linhas por célula são configuráveis ([personalizar o Discover](https://www.elastic.co/guide/en/kibana/current/document-explorer.html)).

**Dynatrace.** O gráfico de distribuição agrupa por status no tempo e permite disparar consultas a partir dele; ele, as *facets* e a busca dentro dos resultados já carregados não consomem licença, enquanto cada consulta consome ([Logs app](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app)). "Search in results" filtra no navegador sem refazer a consulta ([consultar e filtrar](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app/query-and-filter)). Há detecção de padrões ([Logs app](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app)).

**Padrão comum:** histograma ou gráfico de volume sobre uma lista ordenada por tempo, com colunas escolhidas pelo usuário e agrupamento por padrões. **Diferença:** Elastic deixa explícito o teto de amostra (500); Grafana usa rolagem infinita e deduplicação; Dynatrace separa o que é cobrado (consulta) do que é grátis (filtrar o que já veio).

## 3. Detalhe de um evento

**Datadog.** O *side panel* mostra em cima o contexto (host, contêiner, arquivo, serviço, vindos das *tags*) e embaixo a mensagem e os atributos estruturados ([side panel](https://docs.datadoghq.com/logs/explorer/side_panel/)). Em cada atributo: virar coluna, incluir ou excluir na busca, criar *facet* ou medida, criar campo calculado; o painel copia o JSON e compartilha o evento ([side panel](https://docs.datadoghq.com/logs/explorer/side_panel/)). "View in context" troca a busca pelas linhas logo antes e logo depois do evento, mesmo fora do filtro; abas mostram métricas da infraestrutura em 30 minutos ao redor e o *trace* quando há ID ([side panel](https://docs.datadoghq.com/logs/explorer/side_panel/)).

**Grafana.** *Log details* abre inline ou em barra lateral, com filtro positivo e negativo por campo, "mostrar só estes campos", estatística por campo sobre os logs exibidos e links para outros dados ([logs no Explore](https://grafana.com/docs/grafana/latest/explore/logs-integration/)). *Log context* mostra as linhas vizinhas, como `grep -C`, com janela ajustável, remoção de filtros de *label* e abertura em tela dividida ([logs no Explore](https://grafana.com/docs/grafana/latest/explore/logs-integration/)).

**Elastic.** "View details" abre o *flyout* com todos os campos e valores; nele se busca campo, filtra por tipo, fixa campo, esconde nulos e filtra pelo valor ao passar o mouse; o cabeçalho tem "Copy link", que reabre o documento ([inspecionar documentos](https://www.elastic.co/docs/explore-analyze/discover/inspect-documents)). No modo clássico há "View surrounding documents" (só os filtros fixados continuam valendo; exige campo de tempo) e "View single document", página própria compartilhável ([inspecionar documentos](https://www.elastic.co/docs/explore-analyze/discover/inspect-documents)).

**Dynatrace.** Os detalhes linkam *traces*, hosts, clusters e outras entidades; "Surrounding logs" mostra o entorno para separar causa de sintoma ([Logs app](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app)). No modo JSON do painel, clicar num atributo acrescenta o filtro ([consultar e filtrar](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app/query-and-filter)).

**Padrão comum:** painel lateral com campos clicáveis que viram filtro ou coluna, link para o evento e uma ação de "vizinhança" no tempo. **Diferença:** Datadog e Dynatrace mostram métricas e entidades de infraestrutura no mesmo painel; Elastic dá ao evento uma página própria compartilhável.

## 4. Linha do tempo por ID de correlação

**Datadog.** *Transactions* agregam logs por um atributo comum, como `requestId` ou `orderId`, e incluem todos os logs da transação, não só os que casaram com a busca; calculam duração (do primeiro ao último log) e severidade máxima, aceitam condições de início e fim, e um clique abre o painel com os logs da transação em sequência ([transactions](https://docs.datadoghq.com/logs/explorer/analytics/transactions/)). Com APM, o *tracer* injeta `trace_id`, `span_id`, `env`, `service` e `version` como atributos do log; logs e *traces* são amostrados de forma independente, então um log pode apontar para um *trace* não guardado ([ligar logs e traces](https://docs.datadoghq.com/tracing/other_telemetry/connect_logs_and_traces/)).

**Grafana + Loki.** *Derived fields* extraem um valor por regex na linha ou por nome de *label* (ex. `trace[_]?id`) e o transformam em link interno (Tempo, Jaeger) ou externo com `${__value.raw}` ([configurar a fonte Loki](https://grafana.com/docs/grafana/latest/datasources/loki/configure/)). IDs de alta cardinalidade como `trace_id` cabem em *structured metadata*, que não é indexada e se filtra com `| trace_id="..."` ([structured metadata](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/)).

**Elastic.** Os agentes APM gravam `trace.id` e `transaction.id` no log (campos ECS), seja como campos estruturados, seja no texto para extração por *ingest pipeline* com grok; no Java, o agente põe os IDs no MDC e a correlação vem ligada por padrão desde a versão 1.30.0 ([log correlation no Java](https://www.elastic.co/docs/reference/apm/agents/java/logs), [log correlation no Go](https://www.elastic.co/docs/reference/apm/agents/go/log-correlation)). No Node.js, os formatadores ECS (Pino, Winston, Morgan) injetam os campos automaticamente ([logs no Node.js](https://www.elastic.co/guide/en/apm/agent/nodejs/current/logs.html)).

**Dynatrace.** O OneAgent enriquece logs de *frameworks* suportados com `dt.trace_id` e `dt.span_id`; para os demais, o log leva `[!dt ...]` na mensagem ([ligar logs a traces](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-log-enrichment)). Logs OTLP têm TraceID mapeado para `trace_id` em hexadecimal ([ingestão OTLP de logs](https://docs.dynatrace.com/docs/ingest-from/opentelemetry/otlp-api/ingest-logs)), e o DQL faz *join* entre *spans* e logs pelo ID ([Advanced Tracing Analytics](https://docs.dynatrace.com/docs/analyze-explore-automate/distributed-tracing/advanced-tracing-analytics)).

**Padrão comum:** o ID vem do *tracing* (W3C/OTel ou agente próprio) e vira campo do log; o salto log ↔ *trace* é um link. **Diferença:** só o Datadog oferece, dentro da investigação de logs, uma linha do tempo por **qualquer** atributo de correlação definido pela Aplicação (não só `trace_id`), com duração e severidade calculadas.

## 5. Declaração de campos com tipo e catálogo de campos

**Datadog.** *Facets* são *tags* e atributos promovidos para análise: dimensões (string ou inteiro) e medidas (long ou double, com unidade de tempo ou tamanho) ([facets](https://docs.datadoghq.com/logs/explorer/facets/)). Criam-se a partir do *side panel* (nome e tipo vêm preenchidos) ou pelo botão "add facet"; valem só para logs ingeridos depois da criação, e o recomendado é ficar abaixo de 1.000 ([facets](https://docs.datadoghq.com/logs/explorer/facets/)). Grupos organizam a lista por tema só na exibição; atributos padrão já vêm com *facet*; *alias* aponta campos não padrão para os padrão ([facets](https://docs.datadoghq.com/logs/explorer/facets/)). *Facet* não é necessária para buscar: serve para autocompletar, filtrar e analisar mais rápido (e é exigida para busca numérica) ([facets](https://docs.datadoghq.com/logs/explorer/facets/), [sintaxe de busca](https://docs.datadoghq.com/logs/explorer/search_syntax/)).

**Grafana + Loki.** O tipo não é declarado na ingestão: *labels* são indexadas, *structured metadata* é anexada sem índice (limites padrão de 64 KB e 128 entradas por linha, rejeição com HTTP 400 acima disso), e o tipo do valor só aparece na comparação da consulta ([structured metadata](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/), [consultas de log](https://grafana.com/docs/loki/latest/query/log_queries/)). No Logs Drilldown, a aba *Labels* mostra volume por *label* (inclusive o `detected_level`) e a aba *Fields* mostra campos extraídos por JSON/logfmt ao lado das *labels* e do *structured metadata*, com quebra de valores no tempo ([labels e fields](https://grafana.com/docs/grafana/latest/visualizations/simplified-exploration/logs/labels-and-fields/)).

**Elastic.** O *mapping* explícito declara o tipo de cada campo do índice (`keyword`, `text`, `integer`...); campos novos se acrescentam, mas o tipo de um campo existente não muda sem novo índice e reindexação ([mapping explícito](https://www.elastic.co/docs/manage-data/data-store/mapping/explicit-mapping)). Na *data view*, *runtime fields* criam campos tipados calculados na consulta, e o formato de exibição (bytes, duração, URL...) depende do tipo ([runtime fields](https://www.elastic.co/docs/explore-analyze/find-and-organize/data-views/runtime-fields), [formatos](https://www.elastic.co/docs/explore-analyze/find-and-organize/data-views/field-formatters)). A lista de campos do Discover é o catálogo à vista, com valores mais frequentes no modo clássico ([Discover](https://www.elastic.co/docs/explore-analyze/discover/discover-get-started)).

**Dynatrace.** O estágio de processamento do OpenPipeline tem um processador DQL que extrai campos e formata o resultado como string, número, booleano, duração, *timestamp* e listas deles ([processing stage](https://docs.dynatrace.com/docs/platform/openpipeline/concepts/processing-stage)). O dicionário semântico fixa campos como `loglevel` (lista fechada de valores), `status` derivado e `content` ([modelo de log](https://docs.dynatrace.com/docs/semantic-dictionary/model/log)). As *facets* agrupam os campos DQL mais importantes em categorias predefinidas (Core, Log source, Primary tags), e o usuário escolhe quais aparecem ([facets](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app/facets)).

**Padrão comum:** existe um conjunto de campos padrão do fornecedor e um catálogo navegável no painel. **Diferença:** onde mora o tipo — na *facet* criada depois (Datadog), no *mapping* do índice (Elastic), no processamento da ingestão (Dynatrace) ou só na consulta (Loki). Nenhuma das quatro documenta a Aplicação declarando seus campos tipados por contrato no envio; a declaração é feita por quem administra a ferramenta.

## 6. Administração: produtos, aplicações e credenciais

Nenhuma das páginas consultadas usa o par Produto/Aplicação; a separação vem de atributos (*tags*, *labels*, campos) e de credenciais.

**Datadog.** *API keys* valem para a organização e servem para enviar dados; *application keys*, junto com a API key, dão acesso à API, pertencem a quem as criou e podem ter escopos; *client tokens* servem a apps de navegador e celular ([chaves](https://docs.datadoghq.com/account_management/api-app-keys/)). API key revogada pode ser restaurada em 7 dias; *application key* revogada não volta; nenhuma expira sozinha; a recomendação é uma API key por forma de implantação para revogar sem afetar as outras ([chaves](https://docs.datadoghq.com/account_management/api-app-keys/)). Os atributos `env`, `service` e `version` acompanham o log ([ligar logs e traces](https://docs.datadoghq.com/tracing/other_telemetry/connect_logs_and_traces/)).

**Grafana Cloud.** *Access policies* definem escopos (`logs:write` envia, `logs:read` lê) e o alcance (uma *stack* ou a organização); *label policies* restringem a leitura a *labels* como `{env="dev"}`; *tokens* podem expirar, com aviso por e-mail antes ([access policies](https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/)).

**Elastic.** API keys se criam em Stack Management, com privilégios recortados por *role descriptors*; o valor só aparece na criação; os privilégios da chave são a interseção com os de quem a criou ([API keys no Kibana](https://www.elastic.co/guide/en/kibana/8.19/api-keys.html), [privilégios](https://www.elastic.co/docs/reference/elasticsearch/security-privileges)).

**Dynatrace.** O *access token* com escopo `logs.ingest` libera a ingestão de logs pela API v2 e por OTLP; o *platform token* (`openpipeline:logs:ingest`) é o recomendado nos ambientes atuais, herda permissões do usuário e é exibido só uma vez ([tokens e autenticação](https://docs.dynatrace.com/docs/dynatrace-api/basics/dynatrace-api-authentication), [access tokens](https://docs.dynatrace.com/docs/manage/identity-access-management/access-tokens-and-oauth-clients/access-tokens)).

**Padrão comum:** credencial de envio separada da credencial de leitura, com escopo, segredo mostrado uma vez (Elastic, Dynatrace, Datadog com OTR) e revogação individual.

## 7. Alerta por volume de erros

**Datadog.** O *log monitor* parte de uma busca do Log Explorer, mede contagem, contagem de valores únicos ou agregado de medida, agrupa por até quatro *facets*, avalia numa janela de até 2 dias e compara com um limite; "Multi" gera um alerta por grupo; `below 1` alerta quando os logs param de chegar ([log monitor](https://docs.datadoghq.com/monitors/types/log/)). A mensagem aceita Markdown, variáveis condicionais (`{{#is_alert}}`), menções `@` para destinos, reenvio periódico enquanto persiste e prioridade P1–P5 ([notificações](https://docs.datadoghq.com/monitors/notify/)).

**Grafana.** A regra tem consulta, expressões (*Reduce* e *Threshold*), condição, pasta e *labels*, grupo de avaliação com intervalo, *pending period* (quanto tempo a condição precisa durar), tratamento de "No Data" e "Error", destino por *contact point* ou por política de roteamento, e anotações com resumo e *runbook* ([regra gerenciada pelo Grafana](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-grafana-managed-rule/)). O volume de erros sai de `sum by (app) (count_over_time({env="prod"} |= "error" [5m]))` ([consultas de métrica](https://grafana.com/docs/loki/latest/query/metric_queries/)).

**Elastic.** A *log threshold rule* conta entradas que atendem a condições `campo comparador valor` numa janela, pode agrupar (um alerta por grupo), pode alertar pela razão entre duas contagens, e oferece frequência de ação por checagem, por mudança de estado ou por intervalo, nos estados disparado e recuperado ([log threshold rule](https://www.elastic.co/docs/solutions/observability/incident-management/create-log-threshold-rule)). Com *group by*, um grupo que some da janela não é identificado e não alerta ([log threshold rule](https://www.elastic.co/docs/solutions/observability/incident-management/create-log-threshold-rule)). A *custom threshold rule* faz o mesmo com Count + filtro KQL ([custom threshold rule](https://www.elastic.co/docs/solutions/observability/incident-management/create-custom-threshold-rule)).

**Dynatrace.** Um alerta pode sair de uma consulta filtrada do app Logs, só com permissão de Logs; para tendências, uma seção DQL em Notebooks com `makeTimeseries count(), interval:1m` vira detector em Anomaly Detection ([alerta a partir de logs](https://docs.dynatrace.com/docs/discover-dynatrace/platform/davis-ai/anomaly-detection/set-up-a-customized-anomaly-detector/use-cases/create-alert-in-logs)). O limite estático usa janela deslizante: por padrão 3 amostras de um minuto violando em 5 abrem o problema, e 5 amostras normais o fecham ([limites estáticos](https://docs.dynatrace.com/docs/dynatrace-intelligence/anomaly-detection/static-thresholds)). Há também eventos Davis extraídos no OpenPipeline, que abrem problema assim que o log é ingerido ([alertas por eventos de logs](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-use-cases/lma-alert-log-based-events)).

**Padrão comum:** consulta → contagem por janela → agrupamento (um Alerta por Aplicação ou grupo) → limite → período de espera ou amostras → destinos. **Diferença:** como se evita alerta por pico isolado (*pending period* no Grafana, amostras violadoras no Dynatrace, janela de avaliação no Datadog e Elastic) e como se trata "sem dados".

## 8. Alerta por reinícios

Nenhuma das quatro detecta reinício a partir de logs; todas usam a métrica de reinícios do orquestrador (Kubernetes).

- **Kubernetes (fonte das métricas):** `kube_pod_container_status_restarts_total` é um contador por contêiner com *labels* `container`, `namespace`, `pod`, `uid`; `kube_pod_container_status_last_terminated_reason` traz o motivo do último término ([kube-state-metrics](https://github.com/kubernetes/kube-state-metrics/blob/main/docs/metrics/workload/pod-metrics.md)).
- **Grafana:** regra sobre essa métrica; `increase()` calcula o aumento no intervalo e trata os *resets* do contador ([funções do Prometheus](https://prometheus.io/docs/prometheus/latest/querying/functions/)).
- **Datadog:** métricas `kubernetes.containers.restarts` e `kubernetes_state.container.restarts`, esta com *tags* de namespace, pod e contêiner, usadas num *monitor* de métrica ([dados coletados do Kubernetes](https://docs.datadoghq.com/containers/kubernetes/data_collected/), [Kubernetes State Core](https://docs.datadoghq.com/integrations/kubernetes_state_core/)).
- **Elastic:** campo `kubernetes.container.status.restarts` no *dataset* `state_container` ([kube-state-metrics na Elastic](https://www.elastic.co/docs/reference/integrations/kubernetes/kube-state-metrics)).
- **Dynatrace:** alerta pronto "Detect container restarts", somando reinícios por namespace e *workload*; a recomendação do app Kubernetes é pelo menos 1 reinício por 3 minutos numa janela de 5, e os padrões recomendados não se aplicam sozinhos ([alertas do Kubernetes](https://docs.dynatrace.com/docs/observe/infrastructure-observability/kubernetes-app/reference/kubernetes-alerting), [alertar sobre problemas do Kubernetes](https://docs.dynatrace.com/docs/observe/infrastructure-observability/container-platform-monitoring/kubernetes-monitoring/alert-on-kubernetes-issues)).

**Padrão comum:** contador de reinícios por contêiner + aumento numa janela + limite. **Diferença:** Dynatrace traz o Alerta pronto; nas outras, quem administra monta a regra. Fora de Kubernetes, nenhuma página consultada documenta reinício como sinal pronto.

## 9. Canais de aviso, inclusive Telegram e WhatsApp

| Ferramenta | Canais nativos documentados | Telegram | WhatsApp |
|---|---|---|---|
| Datadog | e-mail, Slack, PagerDuty, webhooks, Jira, Microsoft Teams, ServiceNow ([notificações](https://docs.datadoghq.com/monitors/notify/)) | não nativo; webhook genérico ([webhooks](https://docs.datadoghq.com/integrations/webhooks/)) | não nativo |
| Grafana | 23 integrações, entre elas e-mail, Slack, Discord, Teams, Google Chat, PagerDuty, Line, Threema, Webhook e **Telegram** ([contact points](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/)) | **nativo**: token do bot + chat ID; mensagens até 4096 caracteres ([Telegram](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-telegram/)) | não está na lista |
| Elastic | Email, Slack, Microsoft Teams, PagerDuty, Opsgenie, Jira, ServiceNow, xMatters, Webhook e outros ([connectors](https://www.elastic.co/docs/reference/kibana/connectors-kibana)) | não listado | não listado |
| Dynatrace | classic: EMAIL, SLACK, WEBHOOK, Jira, PagerDuty, OpsGenie, VictorOps, xMatters, ServiceNow; atual: conectores de Workflows ([schema de notificações](https://docs.dynatrace.com/docs/dynatrace-api/environment-api/settings/schemas/builtin-problem-notifications), [guia de migração](https://docs.dynatrace.com/docs/platform/upgrade/keep-problems-and-alerting-working/upgrade-guide-alert-notification)) | não nativo; ação HTTP Request de Workflows, com segredo no *credential vault* ([HTTP Request](https://docs.dynatrace.com/docs/analyze-explore-automate/workflows/default-workflow-actions/http-request-workflow-action)) | não nativo |

O que os próprios canais exigem, para quem for integrar por webhook:

- **Telegram:** cada bot tem um *token* do BotFather, e toda chamada vai para `https://api.telegram.org/bot<token>/MÉTODO`, ou seja, o segredo viaja no caminho da URL ([Bot API](https://core.telegram.org/bots/api)).
- **WhatsApp (Cloud API da Meta):** fora da janela de atendimento de 24 horas, aberta quando o usuário escreve, só se enviam mensagens de *template* aprovado, e há limite de destinatários únicos fora da janela por 24 horas ([mensagens de serviço](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages), [templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)). Um Alerta, que parte do sistema, cai em regra nessa situação.

**Padrão comum:** e-mail, Slack, Teams, PagerDuty e webhook genérico estão em todas. **Diferença:** só o Grafana tem Telegram nativo; nenhuma tem WhatsApp nativo, e o WhatsApp acrescenta *template* aprovado e limites de envio que o Telegram não tem.

## Fontes

Datadog
- [Log Search Syntax](https://docs.datadoghq.com/logs/explorer/search_syntax/)
- [Search Logs](https://docs.datadoghq.com/logs/explorer/search/)
- [Log Visualizations](https://docs.datadoghq.com/logs/explorer/visualize/)
- [Log Side Panel](https://docs.datadoghq.com/logs/explorer/side_panel/)
- [Live Tail](https://docs.datadoghq.com/logs/explorer/live_tail/)
- [Facets](https://docs.datadoghq.com/logs/explorer/facets/)
- [Transactions](https://docs.datadoghq.com/logs/explorer/analytics/transactions/)
- [Correlate Logs and Traces](https://docs.datadoghq.com/tracing/other_telemetry/connect_logs_and_traces/)
- [API and Application Keys](https://docs.datadoghq.com/account_management/api-app-keys/)
- [Log Monitor](https://docs.datadoghq.com/monitors/types/log/)
- [Notifications](https://docs.datadoghq.com/monitors/notify/)
- [Webhooks](https://docs.datadoghq.com/integrations/webhooks/)
- [Kubernetes Data Collected](https://docs.datadoghq.com/containers/kubernetes/data_collected/)
- [Kubernetes State Core](https://docs.datadoghq.com/integrations/kubernetes_state_core/)

Grafana / Loki / Prometheus / Kubernetes
- [Logs in Explore](https://grafana.com/docs/grafana/latest/explore/logs-integration/)
- [LogQL log queries](https://grafana.com/docs/loki/latest/query/log_queries/)
- [LogQL metric queries](https://grafana.com/docs/loki/latest/query/metric_queries/)
- [Structured metadata](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/)
- [Configure the Loki data source (derived fields)](https://grafana.com/docs/grafana/latest/datasources/loki/configure/)
- [Logs Drilldown](https://grafana.com/docs/grafana/latest/visualizations/simplified-exploration/logs/)
- [Logs Drilldown: labels and fields](https://grafana.com/docs/grafana/latest/visualizations/simplified-exploration/logs/labels-and-fields/)
- [Grafana Cloud access policies](https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/)
- [Create a Grafana-managed alert rule](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/create-grafana-managed-rule/)
- [Manage contact points](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/)
- [Configure Telegram](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/manage-contact-points/integrations/configure-telegram/)
- [Prometheus query functions](https://prometheus.io/docs/prometheus/latest/querying/functions/)
- [kube-state-metrics: pod metrics](https://github.com/kubernetes/kube-state-metrics/blob/main/docs/metrics/workload/pod-metrics.md)

Elastic
- [Discover: get started](https://www.elastic.co/docs/explore-analyze/discover/discover-get-started)
- [Customize the Discover view](https://www.elastic.co/guide/en/kibana/current/document-explorer.html)
- [Inspect documents in Discover](https://www.elastic.co/docs/explore-analyze/discover/inspect-documents)
- [KQL](https://www.elastic.co/docs/explore-analyze/query-filter/languages/kql)
- [Explicit mapping](https://www.elastic.co/docs/manage-data/data-store/mapping/explicit-mapping)
- [Runtime fields](https://www.elastic.co/docs/explore-analyze/find-and-organize/data-views/runtime-fields)
- [Field formatters](https://www.elastic.co/docs/explore-analyze/find-and-organize/data-views/field-formatters)
- [APM Java agent: logs](https://www.elastic.co/docs/reference/apm/agents/java/logs)
- [APM Go agent: log correlation](https://www.elastic.co/docs/reference/apm/agents/go/log-correlation)
- [APM Node.js agent: logs](https://www.elastic.co/guide/en/apm/agent/nodejs/current/logs.html)
- [Kibana API keys (8.19)](https://www.elastic.co/guide/en/kibana/8.19/api-keys.html)
- [Elasticsearch security privileges](https://www.elastic.co/docs/reference/elasticsearch/security-privileges)
- [Log threshold rule](https://www.elastic.co/docs/solutions/observability/incident-management/create-log-threshold-rule)
- [Custom threshold rule](https://www.elastic.co/docs/solutions/observability/incident-management/create-custom-threshold-rule)
- [Kibana connectors](https://www.elastic.co/docs/reference/kibana/connectors-kibana)
- [Kubernetes integration: kube-state-metrics](https://www.elastic.co/docs/reference/integrations/kubernetes/kube-state-metrics)

Dynatrace
- [Logs app](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app)
- [Query and filter logs](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app/query-and-filter)
- [Filter with facets](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-logs-app/facets)
- [Notebooks](https://docs.dynatrace.com/docs/analyze-explore-automate/dashboards-and-notebooks/notebooks)
- [Connect log data to traces](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-log-enrichment)
- [Ingest OTLP logs](https://docs.dynatrace.com/docs/ingest-from/opentelemetry/otlp-api/ingest-logs)
- [Advanced Tracing Analytics](https://docs.dynatrace.com/docs/analyze-explore-automate/distributed-tracing/advanced-tracing-analytics)
- [OpenPipeline processing stage](https://docs.dynatrace.com/docs/platform/openpipeline/concepts/processing-stage)
- [Semantic dictionary: log](https://docs.dynatrace.com/docs/semantic-dictionary/model/log)
- [Tokens and authentication](https://docs.dynatrace.com/docs/dynatrace-api/basics/dynatrace-api-authentication)
- [Access tokens](https://docs.dynatrace.com/docs/manage/identity-access-management/access-tokens-and-oauth-clients/access-tokens)
- [Create log alerts](https://docs.dynatrace.com/docs/discover-dynatrace/platform/davis-ai/anomaly-detection/set-up-a-customized-anomaly-detector/use-cases/create-alert-in-logs)
- [Alerts based on events extracted from logs](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-use-cases/lma-alert-log-based-events)
- [Static thresholds](https://docs.dynatrace.com/docs/dynatrace-intelligence/anomaly-detection/static-thresholds)
- [Kubernetes alerting](https://docs.dynatrace.com/docs/observe/infrastructure-observability/kubernetes-app/reference/kubernetes-alerting)
- [Alert on common Kubernetes issues](https://docs.dynatrace.com/docs/observe/infrastructure-observability/container-platform-monitoring/kubernetes-monitoring/alert-on-kubernetes-issues)
- [Problem notifications schema](https://docs.dynatrace.com/docs/dynatrace-api/environment-api/settings/schemas/builtin-problem-notifications)
- [Upgrade to workflows](https://docs.dynatrace.com/docs/platform/upgrade/keep-problems-and-alerting-working/upgrade-guide-alert-notification)
- [HTTP Request action](https://docs.dynatrace.com/docs/analyze-explore-automate/workflows/default-workflow-actions/http-request-workflow-action)

Canais
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [WhatsApp Cloud API: service messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
- [WhatsApp Cloud API: template fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
