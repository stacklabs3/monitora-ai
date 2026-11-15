# WhatsApp como canal de alerta

Pesquisa em 15/11/2026 para o ticket [Pesquisar WhatsApp como canal de alerta](https://github.com/stacklabs3/monitora-ai/issues/30). Descreve o canal; não escolhe canal. Só fontes primárias (Meta/WhatsApp, crates.io, Twilio para o próprio preço). Onde não houve fonte primária legível, está marcado **[confirmar]**. Nenhuma conta foi criada e nenhuma credencial gerada.

## Resumo

- O caminho oficial é a **WhatsApp Business Platform (Cloud API)** da Meta: uma chamada HTTP `POST` por mensagem. Cliente não oficial (WhatsApp Web automatizado) viola os Termos de Serviço.
- Um alerta é mensagem **iniciada pela empresa**. Fora da janela de atendimento de 24h, só sai como **modelo (template) aprovado**, e é cobrado por mensagem entregue.
- A categoria **utility** cobre mensagens não promocionais ligadas à conta ou serviço do usuário. O enquadramento de um alerta operacional para alguém da equipe não aparece na documentação **[confirmar]**.
- Preço Brasil, utility, tabela oficial: **R$ 0,035 por mensagem entregue** na primeira faixa de volume (0 a 250 mil por mês).
- Exige conta Meta business (portfólio), número de telefone próprio dedicado e opt-in de cada destinatário.

## Cloud API direta ou provedor (BSP)

| Caminho | Como funciona | Custo | Fonte |
| --- | --- | --- | --- |
| Cloud API direta | App próprio na Meta, portfólio business, token de *system user*; a Meta cobra o uso direto no Meta Business Suite. Para app que não atende outras empresas, a Meta aponta o guia da Cloud API. | Só a tarifa da Meta. | [Get started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started.md), [Solution providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview.md), [Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md) |
| Provedor (ex.: Twilio) | O provedor intermedia a mesma plataforma. Tech Providers não têm linha de crédito: o cliente paga a Meta e o provedor cobra os serviços dele. Solution Partners podem faturar o cliente direto. | Tarifa da Meta + taxa do provedor. Twilio: US$ 0,005 por mensagem (entrada ou saída), mais US$ 0,001 por mensagem com status *Failed*, e repassa a tarifa da Meta ("pricing current as of September 2026"). | [Solution providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview.md), [Twilio WhatsApp pricing](https://www.twilio.com/en-us/whatsapp/pricing) |

## Cadastro, conta business, verificação e número

- **Conta e app:** conta de desenvolvedor Meta, app com o caso de uso WhatsApp e um portfólio business (existente ou novo). Um número de teste é gerado e registrado automaticamente. O token temporário "expires quickly"; para uso contínuo, token permanente de *system user*. [Get started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started.md), [Phone numbers](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers.md)
- **Número:** precisa ser seu e receber SMS ou ligação para verificação por código. Número já em uso no WhatsApp só registra depois de apagado lá. Portfólio novo começa com limite de 2 números registrados, que sobe para 20 após verificação ou limite de envio de 2.000. Todo número exige *display name* (que passa por revisão). [Phone numbers](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers.md), [Display names](https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names.md)
- **Verificação da empresa:** não é pré-requisito para começar. É um dos caminhos para subir o limite de envio (portfólio novo = 250 destinatários/24h) e o teto de templates (250 sem verificação; até 6.000 verificado). [Messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits.md), [Templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- **Pagamento:** sem forma de pagamento, a Meta entrega mensagens de serviço só dentro da franquia gratuita. [Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md). Prazo e documentos da verificação business: **[confirmar]**.

## Janela de atendimento de 24h

"When a WhatsApp user messages you or calls you, a 24-hour timer called a customer service window starts." Cada nova mensagem do usuário reinicia o timer. Com a janela aberta vale qualquer mensagem de serviço (texto livre). Fechada, "you can only send pre-approved template messages". [Send messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages.md)

Consequência para alerta: se o destinatário não escreveu ao número nas últimas 24h, o alerta precisa ser um template aprovado.

## Modelos de mensagem (templates) e categoria

- Templates são "the only type of message that can be sent to WhatsApp users outside of a customer service window". Categorias: authentication, marketing, utility. Revisão automática, até 24h; só status APPROVED envia. Um template pode ser pausado ou desativado por feedback negativo. Limite de criação: 100 por hora. [Templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- **Utility** precisa ser "non-promotional" e ou "specific to or requested by the user (clearly related to their order, account, services, or transactions)", ou "essential or critical to the user". Exemplos oficiais: alerta de conta ("Daily update for account ending in…"), pedido, alerta de segurança. Conteúdo promocional leva à recategorização para marketing (aviso de 1 dia; imediato para contas já advertidas). [Template categorization](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization.md)
- Limites do template utility: corpo até 1.024 caracteres, rodapé até 60, até 10 botões, exemplo obrigatório para cada parâmetro. [Utility templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/utility-templates/utility-templates.md)
- **Alerta operacional ("aplicação X com muitos erros") para alguém da equipe:** o texto da Meta não trata esse caso. Ele é não promocional e ligado ao serviço que o destinatário usa, mas a classificação final é da Meta **[confirmar]** (testar a submissão de um template).

## Limites de envio

Faixas: 250, 2.000, 10.000, 100.000 e ilimitado. A faixa conta destinatários únicos fora da janela de atendimento, em 24h móveis. Vale para o **portfólio**, somado entre todos os números. Portfólio novo começa em 250. Sobe pela verificação da empresa ou ao entregar 2.000 mensagens fora da janela em 30 dias; depois, automaticamente com qualidade alta e uso de metade do limite em 7 dias. [Messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits.md)

Para alertas de uma equipe pequena, 250 destinatários únicos/dia não é gargalo (a conta é de pessoas, não de mensagens).

## Preço no Brasil

**Modelo vigente:** cobrança por mensagem **entregue** desde 1/7/2025 (o modelo por conversa saiu). A tarifa depende da categoria e do código do país do destinatário (+55). Desde 1/10/2026 a Meta voltou a cobrar utility enviado dentro da janela aberta e mensagens de serviço. Cada número tem franquia de 1.000 mensagens de serviço entregues por mês (sem acúmulo). Faixas de volume valem só para utility e authentication, por mercado, somadas no portfólio e zeradas todo mês. Há faturamento em BRL pela Facebook Brasil desde 1/7/2026. [Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md)

| Categoria (destino Brasil) | Tarifa | Fonte |
| --- | --- | --- |
| Utility, 0 a 250 mil/mês | R$ 0,035 | [Calculadora oficial](https://whatsappbusiness.com/products/platform-pricing/) (mercado Brazil, BRL, Utility) |
| Utility, faixas seguintes | R$ 0,0333 (até 2 mi), 0,0315 (até 17 mi), 0,0298, 0,028, 0,0263 | Idem |
| Marketing, authentication, service (após franquia) | **[confirmar]** | Tabelas BRL/USD em [Pricing → rate cards](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md) (planilhas não lidas aqui) |

Conflito a conferir: a página de preços em pt-BR diz que mensagens de serviço e utility em resposta ao usuário não são cobradas. A documentação para desenvolvedores diz que passaram a ser cobradas desde 1/10/2026, com a franquia de 1.000 mensagens de serviço por número **[confirmar]**.

Conta de exemplo (aritmética, não estimativa de uso): 300 alertas utility/mês para números +55 = 300 × R$ 0,035 = **R$ 10,50/mês** pela Cloud API direta. Por provedor como a Twilio, soma-se US$ 0,005 por mensagem (300 × 0,005 = US$ 1,50).

## Políticas: automação e opt-in

- **Opt-in:** "Businesses are required to obtain opt-in before messaging people on WhatsApp". O opt-in diz que a pessoa aceita receber mensagens e nomeia a empresa. Pode ser coletado por site, SMS, URA, papel; a empresa também segue a lei aplicável. [Getting opt-in](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in.md)
- **Automação:** a Business Messaging Policy permite mensagens automatizadas dentro das regras: template fora da janela de 24h; respeitar todo pedido de parar de receber, dentro ou fora do WhatsApp; oferecer caminho de escalonamento (humano, telefone, e-mail, formulário) em experiências automatizadas; sem spam. Bloqueios e denúncias podem limitar o envio ou remover o acesso. [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/pt-br/policy/)
- **WhatsApp comum automatizado:** os Termos de Serviço proíbem "bulk messaging, auto-messaging" e software que funcione como o serviço sem autorização. [Terms of Service](https://www.whatsapp.com/legal/terms-of-service)

## Integração a partir de Rust

- **HTTP direto:** `POST https://graph.facebook.com/v27.0/<PHONE_NUMBER_ID>/messages` com `Authorization: Bearer <token>` e JSON `{"messaging_product":"whatsapp","to":…,"type":"template","template":{…}}` (nome, idioma, parâmetros). Qualquer cliente HTTP serve (ex.: `reqwest`). [Send messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages.md), [Utility templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/utility-templates/utility-templates.md)
- **Crates:** não há SDK Rust oficial da Meta em crates.io **[confirmar]**. Comunitário: [`whatsapp`](https://crates.io/crates/whatsapp) ("WhatsApp Business Cloud API client", 0.8.1, set/2026, 1.606 downloads, MIT/Apache-2.0), sucessor do [`whatsapp-cloud-api`](https://crates.io/crates/whatsapp-cloud-api), que está deprecado. O [`whatsapp-rust`](https://crates.io/crates/whatsapp-rust) é cliente de WhatsApp Web, não da Cloud API; ver Termos acima. Dados da [API do crates.io](https://crates.io/api/v1/crates?q=whatsapp%20cloud%20api).
- **Retorno de entrega:** status (entregue/falhou) chega por webhook. [Get started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started.md)

## Pendências [confirmar]

1. Se a Meta aprova como utility um template de alerta operacional para alguém da equipe.
2. Tarifas Brasil de marketing, authentication e service (planilhas BRL/USD da página de preços).
3. Se utility dentro da janela e service são cobrados hoje (conflito entre página pt-BR e docs).
4. Prazo e documentos da verificação business.
5. Existência de SDK Rust oficial.
