# Pesquisa: armazenamento e busca de logs estruturados

Pesquisa de 15/11/2026; fontes primárias vinculadas abaixo. Escopo: produto próprio, múltiplas aplicações, campos definidos por produto, retenção de dias e pesquisa por nome, telefone, IDs, tempo e texto. Não há benchmark executado nem dimensionamento para o Excurfly.

## Conclusão provisória

Prototipar **ClickHouse e OpenSearch** com uma mesma amostra e o mesmo contrato; PostgreSQL é um terceiro candidato para baixo volume e operação simples; Loki é referência para logs baratos, mas seu modelo padrão não oferece índice por cliente/telefone da forma solicitada. Nenhum deles tem vantagem de custo, capacidade ou latência demonstrada para este volume sem testes. Não projetar o contrato público da plataforma como API de um único motor.

| Critério | ClickHouse | OpenSearch | PostgreSQL | Loki |
|---|---|---|---|---|
| Modelo | colunar, analítico | documentos e índice de busca | relacional, linhas + JSONB | blocos compactados por fluxo, índice de labels |
| Campos variáveis | JSON nativo com caminhos/subcolunas e limites | mapeamento dinâmico ou explícito; controlar explosão | JSONB e GIN ou índices em expressões | metadados estruturados, não indexados como labels |
| Busca | ordenação e índices dependem da tabela e consulta; validar seletividade | `keyword` exato; `text` analisado; flexível, com custo de índices | igualdade, texto e GIN requerem índices apropriados | restringe por labels, depois filtra conteúdo/metadados |
| Retenção | TTL/partições a projetar e validar | ciclo de vida dos índices a configurar | partições por tempo e remoção de partições | Compactor; retenção exige habilitação |
| Risco | JSON dinâmico não equivale automaticamente a índice eficiente por campo | mapeamentos dinâmicos, memória e disco; reindexação | ingestão e índices crescentes; compressão total exige medição | buscas por usuário/telefone podem exigir varredura relevante |

## ClickHouse

O tipo JSON pode materializar caminhos como subcolunas; limites para caminhos e tipos impedem crescimento indiscriminado. Definir tipos de caminhos frequentemente pesquisados pode melhorar as consultas. Isso não implica que qualquer campo novo tenha um índice invertido imediato ou igualdade com custo constante. Fonte: [explicação do tipo JSON pelo ClickHouse](https://clickhouse.com/videos/clickhouses-new-json-type-fosdem). Atenção: a apresentação inclui configuração experimental histórica; verificar a versão efetivamente selecionada.

Modelo colunar permite compressão e análise de logs, mas escolher chave de ordenação, índices auxiliares, lotes de ingestão e TTL exige medições reais. Não extrapolar resultados comerciais ou de benchmarks de terceiros. [Exemplo de armazenamento de logs com ClickHouse](https://clickhouse.com/blog/storing-log-data-in-clickhouse-fluent-bit-vector-open-telemetry).

## OpenSearch

Mapeamentos e templates permitem configurar campos conforme nomes e tipos; um identificador pode ser `keyword` para pesquisa exata, enquanto nomes exigem política de análise normalização e eventualmente prefixos/fragmentos. Índice de texto e exato simultâneos têm custos adicionais. Templates se aplicam apenas a campos novos; mudar o tipo de um campo já existente precisa de um plano de migração/reindexação. [Templates dinâmicos](https://docs.opensearch.org/latest/mappings/dynamic-templates/).

Abrir mapeamento dinâmico para todos os campos pode causar explosão de mapeamentos. `flat_object` reduz essa pressão e armazena campos desconhecidos, mas subcampos não recebem índice para localização rápida e há limitações de análise e consulta. Logo, registro de campos e limites por produto são necessários. [OpenSearch: flat object](https://docs.opensearch.org/latest/field-types/flat-object/).

## PostgreSQL

JSONB permite indexação GIN para chaves e valores e operadores específicos; classes de operadores apresentam compromissos diferentes. Nem toda consulta textual, substring ou intervalo será atendida igualmente por qualquer GIN. Índices específicos por expressão e tipo podem ser mais adequados, mas crescem em número. [JSONB e indexação](https://www.postgresql.org/docs/current/datatype-json.html) e [tipos de índices](https://www.postgresql.org/docs/current/indexes.html).

Partições temporais permitem remover dados vencidos sem apagar linha a linha, mas manutenção e bloqueios associados precisam de atenção. [Particionamento PostgreSQL](https://www.postgresql.org/docs/current/ddl-partitioning.html). Usar uma instância separada da base transacional do produto evita que cargas de investigação concorram diretamente com compras. Relação de compressão e limite prático do servidor devem ser medidos.

## Loki

Loki indexa labels de fluxos e guarda eventos comprimidos em blocos. Labels com valores quase únicos, como ID de cliente, produzem muitos fluxos e podem degradar memória, índice e eficiência; a documentação orienta não usá-los como labels. Metadados estruturados podem ser filtrados sem serem indexados dessa maneira; isso é diferente de pesquisa indexada rápida por campo. [Labels](https://grafana.com/docs/loki/latest/get-started/labels/) · [Metadados estruturados](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/) · [Armazenamento](https://grafana.com/docs/loki/latest/configure/storage/).

A retenção usa Compactor e precisa ser ativada; por padrão não expira. [Retenção](https://grafana.com/docs/loki/latest/operations/storage/retention/). É útil para comparação de custo/benefício, sem assumir que satisfaz a busca por muitos campos com a velocidade desejada.

## Modelo comum e contrato de indexação

- Envelope estável: produto, ambiente, serviço, horário do evento e da ingestão, nível, ID do evento, mensagem, identificador da operação, versão do esquema e atributos opcionais tipados.
- Catálogo por produto: nome e tipo do campo, estratégia de pesquisa (exata, texto, prefixo, intervalo), normalização, sensibilidade, retenção e estado de implantação do índice. Não permitir campos novos ilimitados nem confiar em tipos inferidos a partir do primeiro evento.
- Histórico ao habilitar índice: especificar se é prospectivo, envolve reprocessamento ou consulta lenta; exibir progresso. Evolução de tipo e semântica implica versão/migração.
- Normalização de telefone e nome definida por produto. Campos e resultados sensíveis protegidos por permissão; auditoria de acesso; retenção e exclusão também contemplam índices, réplicas e backups. Hash simples de telefone não garante sigilo; consultas de prefixo não funcionam por hash comum.
- Não confundir 'campo indexado' na interface com índice físico idêntico em cada motor. Garantir comportamento e medir latência, sem prometer desempenho prévio.

## Prova de conceito comparável

1. Gerar dados sintéticos sem dados pessoais reais que preservem distribuição realista: volume por dia, 30/90 dias, tamanho dos eventos, níveis, número de produtos, clientes, duplicação de nomes, cardinalidade e quantidade de campos opcionais. Usar pelo menos três perfis de volume e picos.
2. Indexar exatamente as mesmas propriedades e manter semântica equivalente: produto + período; igualdade em ID/telefone; nome exato normalizado; nome parcial e combinação com outros campos; texto livre; linha do tempo da compra. Verificar acentos, caracteres não latinos, vazios e strings longas.
3. Medir espaço líquido após estabilização (eventos, índices, WAL/log transacional, metadados, arquivos temporários, réplicas) e espaço de pico durante compactação/reindexação; RAM, CPU e escrita; ingestão sustentada e picos; p50/p95/p99 por consulta com cache frio/quente; concorrência e tempo até o evento ficar pesquisável.
4. Testar adicionar campo após ingestão, reindexação e custo; retenção; falha e reinício no meio de lote; dados duplicados, atrasados e fora de ordem; backup/restauração; disco quase cheio; exclusão de eventos e proteção de segredos.
5. Repetir sob os recursos de uma instância candidata, com versão, configuração, número de réplicas, parâmetros de ingestão, hardware, dataset e consultas registrados. Calcular custo com preços da região, snapshots, tráfego, requisições e folga. Não tratar valores ou taxa de compressão teórica como promessa.
