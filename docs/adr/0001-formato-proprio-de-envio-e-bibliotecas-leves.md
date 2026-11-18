---
status: accepted
---

# Formato próprio de envio e bibliotecas leves sem SDK do OpenTelemetry

As aplicações enviam eventos ao Monitora AI em um contrato próprio, JSON com gzip por HTTPS, por bibliotecas leves escritas pelo projeto. O contrato copia do OTLP as regras de reenvio e de lote parcial, mas não usa o formato OTLP nem os SDKs do OpenTelemetry. O motivo: a primeira versão precisa rodar no Node 20, os pacotes de logs do OpenTelemetry para Node exigem 22.15 ou mais novo, e as garantias da ingestão teriam de ser escritas por nós em qualquer opção. Um remetente OTLP comum também não manda o código e o número na execução, sem os quais o evento é recusado.

Decidido em [Escolher o protocolo de envio e as bibliotecas Node e Java](https://github.com/stacklabs3/monitora-ai/issues/27), em 18/11/2026.

## Contrato

| Endereço | Uso |
|---|---|
| `POST /v1/eventos` | Lote de eventos, até 5 MB ou 1.000 eventos |
| `POST /v1/situacao` | Situação da execução: último número usado, perdas por motivo, início e encerramento. Vai a cada 30 s, ao iniciar e ao encerrar |
| `GET /v1/regras` | Regras do produto: campos declarados, máscaras e parâmetros liberados |

- A chave de envio vai em todas as chamadas. O servidor tira dela produto, ambiente e aplicação.
- Há reenvio em 429, 502, 503, 504 e falha de rede, respeitando `Retry-After`. Evento recusado em lote parcial não é reenviado.
- Campo novo é sempre opcional e campo desconhecido é ignorado. Só uma quebra real abre `/v2`, e `/v1` fica até nenhuma aplicação usá-lo.
- Um conjunto único de casos sintéticos, de entrada e saída, vale para todas as bibliotecas. Exemplo: `(11) 90000-4321` gera o mesmo código de busca em Node e em Java.

## Biblioteca Node

Não tem dependência obrigatória. Usa `node:https`, `node:zlib`, `node:crypto` e `AsyncLocalStorage`, sai em CommonJS e ESM e é testada em Node 20, 22 e 24. Não usa `fetch` nem `enterWith`, que são experimentais no Node 20.

Cada evento passa, no processo da aplicação, por: captura, escolha do que sai, remoção e máscara, código de busca, numeração e fila.

- **Regras:** vêm de `/v1/regras` ao iniciar e quando mudam. Até chegarem, vale o padrão mais protegido.
- **Código de busca:** a biblioteca gera com a chave de códigos do produto, lida de variável de ambiente e separada da chave de envio. O servidor só recebe o valor mascarado e o código.
- **Pino:** um destino extra no `pino.multistream` lê a linha pronta, e a saída atual continua. O objeto bruto fica de fora porque pode trazer o que os serializadores removeram. Saem os níveis informativo para cima, com entrada e fim de requisição, menos as rotas excluídas, como `/health`.
- **Next:** a captura entra em `instrumentation.ts`, só no servidor Node. Saem `console.warn` e `console.error`; `log` e `info` só se o site ligar, porque um nome solto no texto não é reconhecível pelo formato.
- **Ocorrência:** `monitora.iniciar(...)` abre e `transacao.executar(async () => { ... })` delimita o trecho cujos logs herdam o código. Fora dele, o log vai sem código.

## Biblioteca Java

Vem depois da primeira versão e segue o mesmo contrato: appender próprio para Logback, com `java.net.http`, em Java 11 ou mais novo. Log4j2 entra quando um produto pedir.

## Quem cumpre cada garantia

| Garantia da ingestão | Dono |
|---|---|
| Fila de 2.048 eventos ou 16 MB, tentativas por 5 min, nenhuma chamada bloqueia ou lança erro | Biblioteca |
| Preferência de erro e aviso com a fila cheia | Biblioteca |
| Corte em 1 MB, protegendo os campos das regras do produto | Biblioteca |
| Lote de até 5 MB ou 1.000 eventos | Biblioteca monta, servidor confere |
| Numeração por execução e último número | Biblioteca, por `/v1/situacao` |
| Perda com motivo, separada dos eventos | Biblioteca, por `/v1/situacao` |
| Desligamento em até 3 s | Biblioteca na API; tentativa sem garantia nos sites |
| Recusa permanente, com até 1 linha por minuto no stderr | Biblioteca |
| Remoção, máscara e código de busca | Biblioteca; o servidor confere de novo |
| Evento aceito só depois de gravado, reenvio sem duplicar, julgamento evento a evento | Servidor |

## Opções recusadas

- **OTLP com SDK oficial:** não roda no Node 20 e não traz a preferência por erros, a numeração nem a perda visível no painel.
- **OTLP com Protobuf gerado pela nossa biblioteca:** mantém o formato padrão, mas nossos campos obrigatórios viram convenção própria. Os remetentes OTLP comuns continuariam recusados, e cada linguagem ganharia ferramentas de Protobuf.
- **Transport do pino em outra thread:** acrescenta uma thread que pode morrer e não enxerga a ocorrência da requisição sozinha.
- **Perda dentro do lote:** uma aplicação acima do limite recebe "tente depois", e a contagem ficaria presa com os eventos.
- **CPF completo até o servidor para gerar o código:** contraria a máscara antes do envio.
- **Assumir o desligamento dos sites:** garantiria os 3 s, mas cortaria requisições mais longas no deploy.

## Consequências

- **Sem ferramentas prontas:** coletores e SDKs OTLP não enviam ao Monitora AI. O contrato e as bibliotecas são nossos para manter.
- **Desvio aceito nos sites:** o Next encerra o processo sem esperar a biblioteca. Um deploy normal pode mostrar "pode ter perdido mais", o que abranda os itens 10 e 15 de [Definir garantias e falhas da ingestão](https://github.com/stacklabs3/monitora-ai/issues/7) só nos sites.
- **Mais um segredo:** cada aplicação guarda a chave de códigos. Se ela vazar, a troca faz a busca em dados antigos falhar até eles vencerem.
- **Adoção na API do Excurfly:** o pino passa a ser dependência direta, o logger muda em `app.ts` e o `server.ts` ganha uma linha de encerramento. As chamadas de log não mudam.
- **Node 20 fora de suporte:** ele saiu de suporte em 30/04/2026 e continua exigido por [Restrições do projeto](https://github.com/stacklabs3/monitora-ai/issues/19).

## Ainda sem prova

- A captura foi testada só no Node 26, com pino 10.3.1, Fastify 5.12.1 e dados sintéticos: 3 compras simultâneas, 6 eventos, nenhum com a ocorrência errada. Falta rodar no Node 20.
- O custo do JSON, da captura no processo e do volume de logs de requisição será medido em [Definir prova de conceito e critérios de avaliação](https://github.com/stacklabs3/monitora-ai/issues/9).
- Os 30 s da situação da execução são proposta, sem fonte que fixe o valor.

## Fontes

- [Pesquisa: protocolo de envio](https://github.com/stacklabs3/monitora-ai/blob/research/protocolo-de-envio/docs/research/protocolo-de-envio.md)
- [Especificação OTLP](https://opentelemetry.io/docs/specs/otlp/) e [registro npm de `@opentelemetry/sdk-logs`](https://registry.npmjs.org/@opentelemetry/sdk-logs/latest)
- [Pino: API](https://github.com/pinojs/pino/blob/main/docs/api.md) e [transports](https://github.com/pinojs/pino/blob/main/docs/transports.md); [Fastify: Logging](https://github.com/fastify/fastify/blob/main/docs/Reference/Logging.md)
- [Node 20: `fetch`](https://nodejs.org/docs/latest-v20.x/api/globals.html#fetch), [`AsyncLocalStorage`](https://nodejs.org/docs/latest-v20.x/api/async_context.html) e [calendário de versões](https://github.com/nodejs/Release/blob/main/schedule.json)
- [Next: `instrumentation`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation), [self-hosting](https://nextjs.org/docs/app/guides/self-hosting) e [`start-server.ts` 16.3.8](https://github.com/vercel/next.js/blob/v16.3.8/packages/next/src/server/lib/start-server.ts)
- [Logback: setup](https://logback.qos.ch/setup.html) e [FIPS 198-1 (HMAC)](https://csrc.nist.gov/pubs/fips/198-1/final)
