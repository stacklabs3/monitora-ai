# Contratos e resiliência de ingestão

Pesquisa de 15/11/2026 para [Pesquisar contratos e resiliência de ingestão](https://github.com/stacklabs3/monitora-ai/issues/3). Fontes primárias; nenhuma opção de protocolo ou garantia foi escolhida. Não houve teste de desempenho nem revisão de versões específicas dos SDKs.

## Modelo e interoperabilidade

O [modelo de logs OpenTelemetry](https://opentelemetry.io/docs/specs/otel/logs/data-model/) distingue instante de origem (`Timestamp`) e instante de observação (`ObservedTimestamp`), além de corpo, severidade, recurso e atributos. O horário observado pode ser gerado antes da chegada à plataforma; portanto, se necessário medir atraso de rede até a plataforma, registrar também o recebimento pelo servidor. O evento pode conter correlação de trace, mas isso não torna a coleta de traces requisito do produto. A identidade do produto deve ser derivada da autenticação, não aceita cegamente como atributo enviado: esta é uma recomendação de desenho ainda sujeita à decisão de segurança.

OTLP define exportação por gRPC e HTTP, formatos Protobuf e, no caso de HTTP, codificação JSON ou binária; avaliar adoção de receptor existente, adaptador ou contrato próprio exige comparar implementação e operação, não apenas semelhança do modelo. A [especificação OTLP](https://opentelemetry.io/docs/specs/otlp/) não especifica a durabilidade dos dados após o servidor aceitar um lote como propriedade geral de toda implementação.

## Entrega e falhas

- OTLP diferencia sucesso completo, sucesso parcial e falha. Quando a resposta informa sucesso parcial, o cliente não deve reenviar a solicitação; ela inclui contagem de registros rejeitados, não uma lista identificando cada registro. Esse detalhe limita reenvio seletivo. Ver [OTLP: partial success](https://opentelemetry.io/docs/specs/otlp/#partial-success).
- Ausência de confirmação pode ocorrer depois de o servidor ter aceitado dados. Repetir em resposta a falha transitória pode criar duplicatas; recebimento, persistência e visibilidade de busca são etapas diferentes. Definir se é preciso identificador estável e deduplicação, por quanto tempo e com que custo. [OTLP: acknowledgements e duplicate data](https://opentelemetry.io/docs/specs/otlp/).
- O [processador em lote do SDK de logs](https://opentelemetry.io/docs/specs/otel/logs/sdk/#batching-processor) define tamanho máximo de fila, lote, atraso e timeout; ao atingir a capacidade, registros são descartados. Esses padrões da especificação não comprovam o comportamento das versões concretas em cada linguagem.
- O [Collector: resiliency](https://opentelemetry.io/docs/collector/resiliency/) descreve fila em memória, retry com backoff e jitter e opção de fila persistente. Reinício, fila cheia, expiração das tentativas, armazenamento cheio ou danificado ainda podem levar a perda. A persistência oferece um compromisso adicional de recursos e operação; não representa entrega perfeita.

## Node.js e Java

A documentação oficial classifica logs do [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/) como **em desenvolvimento** e os do [OpenTelemetry Java](https://opentelemetry.io/docs/languages/java/) como **estáveis**, no momento da consulta. Isso é status por sinal, não uma garantia de compatibilidade de cada biblioteca de logging, versão, exportador ou recurso. Devem ser avaliados adaptadores para os frameworks efetivamente usados e custos de inicialização, memória e chamadas em Node.js e Java.

Uma biblioteca leve própria pode encapsular configuração, atributos, limites e telemetria de perda, tanto sobre um SDK existente quanto sobre transporte próprio; um coletor externo é outra alternativa. Comparar dependências, atualização, comportamento em encerramento e funcionamento sem coletor. O objetivo de não interromper compras requer teste com rede indisponível e fila saturada, inclusive erro de serialização: nenhuma destas opções o garante automaticamente.

## Perguntas e testes para decisões posteriores

1. Onde começa a aceitação que o usuário pode confiar: memória local, fila persistente ou gravação no servidor? O que ocorre quando rede ou disco falham antes e depois da resposta?
2. Qual limite de fila, duração de tentativas, política de saturação e prazo de flush no encerramento são aceitáveis por produto? A quais dados a política de perda se aplica e como registrar descartes sem criar loops de logging?
3. Como lidar com lotes parcialmente aceitos, payload inválido, erros permanentes, eventos grandes, divergência de versão, duplicação e mensagens fora de ordem?
4. Testar sinteticamente carga, indisponibilidade, reinício abrupto, disco cheio, resposta perdida, aceitação parcial, fila cheia e saída do processo. Medir p95/p99 de latência da aplicação de origem, CPU, memória, eventos gerados/aceitos/rejeitados/descartados e atraso até consulta; especificar tempos, amostra e critérios antes de comparar.
5. Definir credencial por produto/ambiente, TLS, limites e remoção de dados sensíveis na origem; o [guia de segurança do Collector](https://opentelemetry.io/docs/security/config-best-practices/) trata de controles, mas não elimina a necessidade de teste próprio.
