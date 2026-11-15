# Telegram como canal de alerta

Pesquisa em 15/11/2026 para o ticket [Pesquisar Telegram como canal de alerta](https://github.com/stacklabs3/monitora-ai/issues/29).
Só descreve o canal; a escolha fica para outro ticket. Critério do humano: baixo custo.
Fontes primárias: [Bot API](https://core.telegram.org/bots/api) (versão 10.4, de 09/11/2026), [Bots: introdução](https://core.telegram.org/bots), [Bot Features](https://core.telegram.org/bots/features), [Bots FAQ](https://core.telegram.org/bots/faq), [Termos para desenvolvedores de bots](https://telegram.org/tos/bot-developers), crates.io e docs.rs.

## Resumo

- **Preço:** a plataforma de bots é gratuita para usuários e desenvolvedores; envio de até 30 msg/s é sem custo. Só há cobrança (0,1 Star por mensagem) acima de 30 msg/s, recurso opcional que exige 100 mil Stars e 100 mil usuários ativos/mês. Para alertas do Monitora AI, custo zero de envio. [Bots](https://core.telegram.org/bots), [FAQ](https://core.telegram.org/bots/faq), [Termos 6.2.5](https://telegram.org/tos/bot-developers)
- **Envio:** um `POST https://api.telegram.org/bot<token>/sendMessage` com `chat_id` e `text`. Não precisa de SDK. [Bot API](https://core.telegram.org/bots/api#making-requests)
- **Restrição principal:** o bot não inicia conversa. A pessoa precisa mandar mensagem ao bot (ou adicioná-lo a um grupo) antes de receber alertas. [Bots](https://core.telegram.org/bots)

## Criação do bot e autenticação

- Cria-se o bot conversando com o @BotFather (`/newbot`): pede nome e username (o username não muda depois) e devolve um **token**. [Features](https://core.telegram.org/bots/features#creating-a-new-bot)
- O token autoriza toda chamada da API e vai no caminho da URL (`/bot<token>/MÉTODO`); só HTTPS; GET ou POST; parâmetros por query, form-urlencoded, JSON ou multipart. [Bot API](https://core.telegram.org/bots/api#authorizing-your-bot)
- Quem tem o token controla o bot: guardar com segurança; se vazar, gerar outro com `/token` no @BotFather. [Features](https://core.telegram.org/bots/features#botfather)
- Consequência para o projeto: como o token está na URL, logs de requisição HTTP do servidor central não podem gravar a URL completa. (Inferência a partir do formato da URL.)

## Envio para pessoa e para grupo

- `sendMessage`: `chat_id` (inteiro ou `@username` de supergrupo/canal), `text` de **1 a 4096 caracteres** após o parse, `parse_mode`, `disable_notification` (envio silencioso), `protect_content`, `message_thread_id` (tópico de fórum). [sendMessage](https://core.telegram.org/bots/api#sendmessage)
- **Pessoa:** "Bots can't start conversations with users. A user must either add them to a group or send them a message first." A pessoa abre o link `t.me/<username_do_bot>` e toca em Iniciar. [Bots](https://core.telegram.org/bots)
- **Como obter o `chat_id`:** o bot recebe a mensagem (`/start`) como `Update`; o id está em `message.chat.id`. O id pode passar de 32 bits (até 52): guardar como inteiro de 64 bits. [Chat](https://core.telegram.org/bots/api#chat), [getUpdates](https://core.telegram.org/bots/api#getupdates)
- **Deep link:** o link do bot aceita um parâmetro que chega ao bot no início da conversa, o que permite associar a pessoa a um cadastro do painel sem digitar o id. [Features: deep linking](https://core.telegram.org/bots/features#deep-linking)
- **Grupo:** ao ser adicionado, o bot recebe `my_chat_member` e o `chat.id` do grupo. Grupo que vira supergrupo muda de id (`migrate_to_chat_id`), e o servidor precisa atualizar o cadastro. [Update](https://core.telegram.org/bots/api#update), [Message](https://core.telegram.org/bots/api#message)
- Em grupo o bot roda em *privacy mode* por padrão e só vê comandos e menções; para apenas enviar alertas isso não atrapalha. [Features: privacy mode](https://core.telegram.org/bots/features#privacy-mode)
- Pessoa que bloqueia o bot gera `my_chat_member` (bot bloqueado) e o envio passa a falhar. [Update](https://core.telegram.org/bots/api#update). Código de erro exato (ex.: 403): [confirmar].

## Limites de envio

| Escopo | Limite | Fonte |
| --- | --- | --- |
| Um chat | evitar mais de 1 msg/s; rajadas curtas toleradas, depois erro 429 | [FAQ](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this) |
| Um grupo | até 20 msg/min | [FAQ](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this) |
| Total do bot | ~30 msg/s grátis; até 1000 msg/s pago (0,1 Star/msg) | [FAQ](https://core.telegram.org/bots/faq), [sendMessage `allow_paid_broadcast`](https://core.telegram.org/bots/api#sendmessage) |

Ao estourar, a resposta traz `ok: false` e `parameters.retry_after` (segundos de espera). [ResponseParameters](https://core.telegram.org/bots/api#responseparameters). O limite de 20/min por grupo pede agrupar alertas (vários erros numa mensagem) se houver rajada.

## Formatação

`parse_mode` aceita `MarkdownV2`, `HTML` ou `Markdown` (legado, sem aninhamento). Há negrito, itálico, sublinhado, tachado, spoiler, citação, link e bloco de código. Em `MarkdownV2` caracteres especiais precisam de escape; `HTML` só exige escapar `<`, `>` e `&`. [Formatting options](https://core.telegram.org/bots/api#formatting-options). Limite de texto: 4096 caracteres; trecho de log longo precisa ser cortado com link para o painel.

## Receber mensagens: webhook ou polling

Só é preciso receber mensagens para cadastrar o `chat_id` (o `/start`). Duas formas, mutuamente exclusivas: [Getting updates](https://core.telegram.org/bots/api#getting-updates)

- **Long polling (`getUpdates`):** o servidor pergunta ao Telegram; não precisa de URL pública nem certificado. Confirma-se com `offset = último update_id + 1`. Updates não lidos ficam guardados no máximo 24 h.
- **Webhook (`setWebhook`):** o Telegram faz POST HTTPS no servidor; exige certificado válido e porta 443, 80, 88 ou 8443; `secret_token` volta no cabeçalho `X-Telegram-Bot-Api-Secret-Token` para validar a origem. [setWebhook](https://core.telegram.org/bots/api#setwebhook), [FAQ](https://core.telegram.org/bots/faq)
- Existe servidor Bot API próprio (código aberto `telegram-bot-api`), útil só para arquivos grandes; não é necessário para alertas. [Local Bot API Server](https://core.telegram.org/bots/api#using-a-local-bot-api-server)

## Termos de uso para mensagens automáticas

- O bot não pode "harass or spam users with unsolicited messages" e deve seguir os Termos de Serviço do Telegram. [Termos para desenvolvedores, seção 5](https://telegram.org/tos/bot-developers)
- O envio gratuito vale "to users who have granted permission to contact them" (quem iniciou o bot). [Termos 6.2.5](https://telegram.org/tos/bot-developers)
- Todo bot precisa de política de privacidade acessível; sem uma própria, vale a política padrão do Telegram para bots. Dados recebidos de usuários só com consentimento explícito e para o fim informado. [Termos, seção 4](https://telegram.org/tos/bot-developers)
- O Telegram pode mudar acesso e recursos da plataforma sem aviso. [Termos](https://telegram.org/tos/bot-developers)
- Para o projeto: alertas para quem iniciou o bot e pediu para recebê-los se encaixam nos termos; o conteúdo do alerta passa pelos servidores do Telegram (chats de bot não são cifrados ponta a ponta [confirmar na política de privacidade]), então o texto não deveria levar dados sensíveis dos logs.

## Cliente Rust

| Opção | Versão (15/11/2026) | Licença | Bot API coberta | Observação |
| --- | --- | --- | --- | --- |
| [teloxide](https://crates.io/crates/teloxide) | 0.17.0 (11/07/2025) | MIT | 9.1 | Framework completo, Tokio; polling e webhook (feature `webhooks-axum`). Fica atrás da API atual (10.4). [docs.rs](https://docs.rs/teloxide/0.17.0/teloxide/), [update_listeners](https://docs.rs/teloxide/latest/teloxide/update_listeners/index.html) |
| [frankenstein](https://crates.io/crates/frankenstein) | 0.53.0 (14/11/2026) | WTFPL | 10.4 | Só tipos e métodos; cliente bloqueante (`client-ureq`) ou assíncrono (`client-reqwest`). [docs.rs](https://docs.rs/frankenstein/0.53.0/frankenstein/) |
| HTTP direto com [reqwest](https://crates.io/crates/reqwest) | 0.13.5 (08/09/2026) | MIT OR Apache-2.0 | qualquer | Para alerta bastam `sendMessage` e `getUpdates`: dois POSTs JSON e structs próprias. |

Versões e licenças lidas da API do crates.io em 15/11/2026. A licença WTFPL do frankenstein é permissiva, mas incomum; aceitação pela política do projeto: [confirmar].

## Lacunas

- Código de erro quando a pessoa bloqueia o bot: [confirmar].
- Se o Telegram documenta cifragem dos chats com bots: [confirmar].
