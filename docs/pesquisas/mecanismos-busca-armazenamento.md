# Pesquisa: mecanismos de busca e armazenamento

Pesquisa documental em 15/11/2026. Esta análise identifica diferenças e hipóteses, não representa benchmark nem escolha de motor. As buscas e os limites de carga ainda precisam ser definidos com o responsável pelo produto.

## Evidências e implicações

| Candidato | Evidência documental | Implicação a testar |
| --- | --- | --- |
| ClickHouse | O tipo JSON permite caminhos dinâmicos e limites para seu armazenamento como subcolunas; os detalhes dependem da versão e configuração. [JSON](https://clickhouse.com/docs/reference/data-types/newjson). | Medir campos de alta cardinalidade, dados esparsos, ordem física e estratégias de indexação, sobretudo igualdade e nome parcial; armazenamento colunar não assegura latência para toda consulta. |
| OpenSearch | Mapeamentos definem tipos e indexação; a documentação recomenda mapeamentos explícitos e informa que tipo de campo existente não pode ser alterado diretamente. [Mappings](https://docs.opensearch.org/latest/mappings/). | Medir custo de índices, crescimento de campos e migração/reindexação; comparar busca de texto e igualdade com semântica equivalente aos outros motores. |
| PostgreSQL | `jsonb` aceita índices GIN, com classes de operadores que têm capacidades diferentes; partições podem ser removidas para descarte em bloco. [JSON e GIN](https://www.postgresql.org/docs/current/datatype-json.html), [particionamento](https://www.postgresql.org/docs/current/ddl-partitioning.html). | Testar GIN e índices específicos para operações efetivamente exigidas, tamanho de índices e manutenção em ingestão sustentada. É referência de simplicidade possível, não garantia de escala. |
| Loki | Indexa labels dos streams e armazena logs em chunks; metadados estruturados permitem filtrar atributos de alta cardinalidade sem indexá-los como labels. Retenção pelo Compactor precisa ser habilitada. [Labels](https://grafana.com/docs/loki/latest/get-started/labels/), [metadados](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/), [retenção](https://grafana.com/docs/loki/latest/operations/storage/retention/). | Medir leitura necessária para consultas de cliente/compra e evitar atribuir IDs individuais a labels; pode não atender à latência desejada, ainda desconhecida. |

## Experimento comparável a especificar

- Gerar dados sintéticos com produtos, período, tamanhos, campos opcionais, cardinalidade e picos representativos. Registrar versão, parâmetros, hardware, réplicas, preparação dos dados e limitações de cada configuração.
- Comparar os mesmos resultados e semântica: período e produto, igualdade por identificador e telefone normalizado, nome exato e parcial, combinações e linha do tempo. Testar caracteres acentuados, valores ausentes, duplicatas e eventos fora de ordem.
- Medir ingestão sustentada e picos, tempo até pesquisa, latência p50/p95/p99 com cache frio e quente e concorrência, CPU, RAM, disco final e pico (dados, índices, WAL e temporários), compactação, reindexação e expiração. Relatar falhas e resultados incompletos, sem converter comparações de recursos diferentes em ranking.
- Ensaiar campo adicionado depois da ingestão, evolução de tipo, falha/reinício, disco cheio e recuperação de backup. Medir custo de reindexação e retenção, e considerar índices, cópias e backups nas políticas de exclusão.
- Dimensionar e precificar apenas após estabelecer região, disponibilidade, volumes e infraestrutura. A hipótese de 30 dias é ponto de partida, não requisito definitivamente validado. A pesquisa inicial contém [comparação e detalhes adicionais](../pesquisa-inicial/armazenamento.md).

## Limites

Não foram executados experimentos nem validados preço, compressão, desempenho, disponibilidade, segurança ou viabilidade em máquina específica. A escolha do motor depende de critérios negociados e medições reproduzíveis; a mera existência de um recurso não comprova adequação ao projeto.
