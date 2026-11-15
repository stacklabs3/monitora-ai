# Plataforma própria de investigação de logs — pesquisa inicial

15/11/2026. Objetivo: plataforma independente, compartilhada por vários produtos, com atributos definidos por cada aplicação e buscas por nome, telefone, IDs, período e combinações. Esta pesquisa não inclui benchmark nem projeto definitivo.

## Decisões do responsável pelo produto

- A aplicação de monitoramento será desenvolvida em **Rust**. A escolha do mecanismo de armazenamento permanece em aberto; ele não precisa ser implementado do zero nem necessariamente escrito em Rust.
- Criar bibliotecas de integração para projetos **JavaScript/TypeScript com Node.js** e **Java**. São interfaces leves para facilitar a comunicação com a aplicação de monitoramento, e não implementações locais do servidor, armazenamento ou busca.
- Construir uma **interface web de análise**, inspirada na experiência de investigação do Datadog. Angular é uma opção proposta, condicionada à avaliação de desempenho e adequação; não está decidido como o framework mais rápido.
- As bibliotecas devem compartilhar um contrato de ingestão versionado e comportamento consistente. Linguagens, bibliotecas e protocolo exatos, bem como os mecanismos de coleta e envio, continuam sujeitos à pesquisa e à prova de conceito. Integração com navegador ou Flutter não faz parte das decisões atuais.

## Conclusão

A arquitetura candidata tem quatro partes: SDK/adaptadores, ingestão confiável, armazenamento pesquisável e painel de investigação. Contratos e campos devem ser independentes do mecanismo de armazenamento. Comparar ClickHouse e OpenSearch com carga equivalente, mantendo PostgreSQL como referência simples para volumes baixos; não escolher pelo nome ou por taxa de compressão anunciada. Loki é uma referência útil para logs compactados, mas não oferece por padrão indexação individual dos atributos de cliente. Ver [comparação e fontes](armazenamento.md).

No Datadog, índice de logs é uma coleção com regras de roteamento e retenção; atributo é campo do evento; faceta ajuda a navegar e analisar. Uma faceta não é necessária para buscar atributos. Não confundir esses conceitos com os índices físicos escolhidos no banco. [Datadog: índices](https://docs.datadoghq.com/logs/log_configuration/indexes/) · [Facetas](https://docs.datadoghq.com/logs/explorer/facets/).

## Arquitetura candidata

```text
Produtos → SDK / adaptador ou coletor → API de ingestão → armazenamento e índices
                                               ↑                    ↓
                                   catálogo de campos ← API de consulta → painel
```

- SDK envia eventos estruturados em lotes, com limite de espera e fila; adaptadores aproveitam logs existentes. Avaliar OpenTelemetry/OTLP e compatibilidade das linguagens antes de implementar transporte próprio. O modelo prevê campos comuns e atributos flexíveis. [Modelo OpenTelemetry](https://opentelemetry.io/docs/specs/otel/logs/data-model/).
- API autentica a origem, valida e limita os eventos, remove ou rejeita campos proibidos, e associa produto/ambiente à credencial, não apenas ao payload. Definir se a confirmação acontece antes ou depois de persistência e como tratar duplicatas.
- Catálogo por produto define nome, tipo, sensibilidade e modalidade de pesquisa de cada atributo. Declaração pelo código e configuração pelo painel são possibilidades, ainda sem decisão. Estabelecer limites, tratamento de conflito de tipos e evolução do esquema.
- Painel oferece filtros combináveis, linha do tempo por IDs de correlação, eventos recentes e diagnóstico de ingestão. Um evento só será localizado por um atributo se ele o contiver ou houver vínculo explícito.
- Avaliar o painel com paginação/virtualização, filtros e listas em atualização. Medir tempo da consulta no servidor separadamente da renderização no navegador. Angular oferece recursos como carregamento sob demanda, mas não há um framework universalmente mais rápido para toda aplicação. [Angular: desempenho](https://next.angular.dev/best-practices/performance).
- Filas, repetição e persistência reduzem perdas, mas não as eliminam: reinício, disco cheio, tempo limite e filas saturadas importam. Medir descartes e atraso; não interromper uma compra por falha do monitoramento. [Resiliência do coletor OpenTelemetry](https://opentelemetry.io/docs/collector/resiliency/).

## Busca e dados pessoais

Definir por campo igualdade, prefixo, texto ou intervalo, normalização e sensibilidade; nome e telefone não têm necessariamente a mesma semântica. O desempenho e espaço variam com a modalidade. Telefones e nomes são dados pessoais: acesso restrito, auditoria, criptografia, retenção e exclusão também em índices e backups; não guardar segredos. Hash simples de telefone é vulnerável a tentativa por dicionário. Não colocar credencial secreta em aplicativo móvel ou navegador. Ver [ingestão e segurança](ingestao.md).

Ao tornar um campo pesquisável depois que dados foram recebidos, decidir explicitamente se só vale para eventos novos, se há consulta lenta do histórico, ou se ocorre reindexação; esta só é possível se o campo original foi preservado. Indicar progresso e custo operacional.

## Custos: estimativa ainda aberta

A estimativa anterior de US$ 15–30/mês é apenas ordem de grandeza e **não está validada** para um motor com busca por campos arbitrários. Na referência AWS, Lightsail Linux IPv4 de 4 GB e 80 GB custa US$ 24/mês; 20 GB-mês cobrados de snapshots a US$ 0,05 somariam US$ 1, antes de outros custos. Essa conta hipotética não demonstra que a máquina suporta a carga. Verificar região, rede, capacidade, backups e impostos. [AWS Lightsail](https://aws.amazon.com/lightsail/pricing/) · [detalhamento](custos.md).

CPU e memória podem limitar antes do disco, principalmente em buscas e indexação. Bytes por dia × dias de retenção é o volume bruto; só testes podem determinar espaço de dados comprimidos mais índices, WAL, temporários, backups e margem.

## Próximo passo: prova de conceito

1. Medir volume e distribuição dos logs existentes sem copiar dados pessoais para pesquisa; criar dados sintéticos com campos e cardinalidade representativos.
2. Avaliar os mesmos cenários em ClickHouse, OpenSearch e, se viável, PostgreSQL: busca exata por telefone e ID, nome normalizado e parcial, filtros combinados, texto e linha do tempo.
3. Medir armazenamento total e pico, memória, CPU, ingestão, atraso até aparecer na busca e latência p50/p95 em cache quente e frio, concorrência, reindexação e retenção.
4. Testar perda de rede, filas cheias, duplicatas, reinício, disco cheio e restauração; repetir na configuração AWS candidata.
5. Com medidas e região escolhida, calcular custos e tomar decisão documentada. Definir metas de busca, volume, retenção e disponibilidade antes de considerar o resultado satisfatório.

Relatórios de apoio: [armazenamento](armazenamento.md), [ingestão](ingestao.md) e [custos](custos.md).
