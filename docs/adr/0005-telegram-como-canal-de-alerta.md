---
status: accepted
---

# Telegram como único canal de alerta da primeira versão

Na primeira versão, o alerta sai só pelo Telegram, por um bot da plataforma, para a pessoa ou o grupo que o Administrador escolheu. O WhatsApp fica para depois. O motivo é o critério do responsável para toda escolha, rápido de execução e baixo custo: o Telegram não cobra pelo envio e começa a funcionar com um bot criado em minutos, e o WhatsApp exige conta business na Meta, número dedicado e modelo de mensagem aprovado, sem garantia de que a Meta aceite um alerta operacional.

Decidido em [Escolher os canais de alerta](https://github.com/stacklabs3/monitora-ai/issues/31), em 27/11/2026, pela recomendação, por delegação do responsável pelo produto, com as pesquisas de [Pesquisar Telegram como canal de alerta](https://github.com/stacklabs3/monitora-ai/issues/29) e [Pesquisar WhatsApp como canal de alerta](https://github.com/stacklabs3/monitora-ai/issues/30).

## Resultado que decidiu

| | Telegram | WhatsApp (Cloud API) |
|---|---|---|
| Custo por alerta | R$ 0 | R$ 0,035 (utility, +55) |
| Alertas que cabem em R$ 30/mês | sem limite de custo | 857 |
| Para começar | bot no @BotFather, que devolve um token | conta business na Meta, número dedicado, forma de pagamento e modelo aprovado |
| Para a pessoa receber | dar `/start` no bot ou pôr o bot num grupo | opt-in registrado; fora da janela de 24 h, só modelo aprovado |
| Texto do alerta | livre, até 4.096 caracteres | modelo fixo com parâmetros, até 1.024 caracteres |
| Risco aberto | nenhum que trave o envio | a Meta pode não aceitar o alerta operacional como utility |

O limite de R$ 30/mês para alertas vem de [Restrições do projeto](https://github.com/stacklabs3/monitora-ai/issues/19). O WhatsApp cabe no dinheiro, mas não no prazo: a meta é um alerta chegar em 30 dias, e o cadastro na Meta e a aprovação do modelo não dependem do projeto.

## Como entra

- **Envio por HTTP direto:** um `POST` em `sendMessage` com o `reqwest`, que o servidor já usa para o OpenSearch ([Escolher as bibliotecas Rust do servidor](https://github.com/stacklabs3/monitora-ai/issues/28)). Nenhuma biblioteca de bot: o `teloxide` está atrás da API atual e o `frankenstein` tem licença incomum (WTFPL), e o alerta só precisa de dois métodos.
- **Destino é um chat:** uma pessoa que deu `/start` ou um grupo que recebeu o bot. O servidor guarda o identificador do chat como inteiro de 64 bits e o atualiza quando um grupo vira supergrupo.
- **O servidor pergunta, o Telegram não chama:** o servidor descobre o `/start` e a entrada em grupo perguntando ao Telegram (`getUpdates`). Assim o servidor continua com só duas entradas HTTP ([ADR 0003](0003-modulos-e-seams-do-servidor.md)); receber chamadas do Telegram criaria uma terceira.
- **Sem seam enquanto houver um canal só:** vale o que o ADR 0003 já diz. O código que fala com o Telegram fica num lugar só dentro do módulo de alertas, e o resto do módulo passa a ele o conteúdo do alerta em campos (condição, aplicação, ambiente, contagem, horário e link), nunca um texto pronto. Um segundo canal reaproveita os mesmos campos, e é nesse dia que a seam nasce, com dois adaptadores de verdade.
- **Limites do Telegram:** cerca de 1 mensagem por segundo por chat e 20 por minuto por grupo. Quando o Telegram responde 429, o envio espera o tempo que a resposta manda (`retry_after`).
- **Token do bot é segredo:** ele vai na URL de cada chamada, então a URL completa nunca é gravada em log nem enviada como evento.

## Quando o WhatsApp entra

Quando alguém que precisa receber alertas não puder usar o Telegram, ou quando outro produto além do Excurfly pedir. A decisão reabre em ticket novo, que confirma antes as pendências da pesquisa: se a Meta aprova o modelo de alerta como utility e o que se cobra dentro da janela de 24 h.

## Opções recusadas

- **Só WhatsApp:** é onde a pessoa já está, mas põe o primeiro alerta atrás de conta na Meta, número dedicado e aprovação de modelo, e cobra por mensagem.
- **Os dois na primeira versão:** dobra o código de envio, os testes e os segredos para uma equipe de uma pessoa, sem um destinatário que hoje peça o segundo.
- **Automatizar o WhatsApp comum:** viola os termos do WhatsApp.
- **Provedor intermediário (Twilio):** usa a mesma plataforma da Meta e soma US$ 0,005 por mensagem.
- **Seam com um adaptador desde já:** o ADR 0003 já recusou; com um canal só, a divisa seria um palpite sobre o segundo.
- **Receber as chamadas do Telegram (webhook):** terceira entrada HTTP no servidor, com segredo próprio, para um volume de poucas mensagens por dia.

## Consequências

- **Um canal só:** se o Telegram estiver fora do ar ou a pessoa bloquear o bot, o alerta não chega. Os últimos disparos aparecem no painel ([Definir rotinas do desenho inicial](https://github.com/stacklabs3/monitora-ai/issues/15)), e o envio que falhou precisa aparecer ali.
- **Quem recebe precisa do Telegram:** cada pessoa instala o aplicativo e dá `/start` antes do primeiro alerta. O bot não começa a conversa.
- **O texto passa pelos servidores do Telegram:** o alerta leva só condição, aplicação, ambiente, contagem, horário e link, sem dado pessoal ([Definir privacidade, acesso e retenção](https://github.com/stacklabs3/monitora-ai/issues/8), item 18).
- **Trocar depois custa pouco no código e mais nas pessoas:** o código do Telegram está num lugar só, mas cada destinatário teria de se cadastrar de novo no canal novo.

## Fontes

- [Pesquisa: Telegram como canal de alerta](https://github.com/stacklabs3/monitora-ai/blob/research/alerta-telegram/docs/research/alerta-telegram.md): preço, `/start`, limites, `getUpdates` e webhook, token na URL, bibliotecas Rust
- [Pesquisa: WhatsApp como canal de alerta](https://github.com/stacklabs3/monitora-ai/blob/research/alerta-whatsapp/docs/research/alerta-whatsapp.md): Cloud API, conta business, número, opt-in, modelos, preço no Brasil, termos
- [Telegram Bot API](https://core.telegram.org/bots/api) e [FAQ de limites](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this)
- [Preços da WhatsApp Business Platform](https://whatsappbusiness.com/products/platform-pricing/) e [categorias de modelo](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization.md)
- [ADR 0003](0003-modulos-e-seams-do-servidor.md), [Restrições do projeto](https://github.com/stacklabs3/monitora-ai/issues/19), [Escolher as bibliotecas Rust do servidor](https://github.com/stacklabs3/monitora-ai/issues/28) e [Definir rotinas do desenho inicial](https://github.com/stacklabs3/monitora-ai/issues/15)
- Delegação do responsável pelo produto de 20/11/2026: decidir pela recomendação
