// Monitora AI — Dados de exemplo do protótipo.
// Tudo sintético: produto, aplicações, eventos e pessoas são fictícios. Nunca PII real,
// nem segredo, nem evento copiado de produção (mapa do protótipo, notas).

const PRODUTOS = [
  { id: 'excurfly', nome: 'Excurfly' },
  { id: 'demonstracao', nome: 'Produto de demonstração' },
];

const AMBIENTES = [
  { id: 'producao', nome: 'produção' },
  { id: 'homologacao', nome: 'homologação' },
];

const PESSOA_EXEMPLO = {
  nome: 'Pessoa Exemplo',
  iniciais: 'PE',
  email: 'pessoa@exemplo.test',
};

/* ---------- Relógio do cenário ----------
   O protótipo não lê o relógio da máquina: o "agora" do cenário é 27/11/2026 15:00 no
   fuso do painel, para todo print sair igual. Horários são instantes (ms), e a tela os
   escreve no fuso do painel, com o fuso ao lado. */
const MILISSEGUNDOS_POR_MINUTO = 60 * 1000;
const MILISSEGUNDOS_POR_HORA = 60 * MILISSEGUNDOS_POR_MINUTO;
const MILISSEGUNDOS_POR_DIA = 24 * MILISSEGUNDOS_POR_HORA;

const FUSO_DO_PAINEL = { rotulo: 'BRT, UTC−3', deslocamentoEmMinutos: -180 };

const instanteNoFusoDoPainel = (dia, hora, minuto = 0, segundo = 0, milissegundo = 0) =>
  Date.UTC(2026, 10, dia, hora, minuto, segundo, milissegundo) - FUSO_DO_PAINEL.deslocamentoEmMinutos * MILISSEGUNDOS_POR_MINUTO;

const RETENCAO_EM_DIAS = 30;

/* "Dados até": evento aceito depois desse instante ainda não é encontrável. */
const RELOGIO_DO_PAINEL = {
  agora: instanteNoFusoDoPainel(27, 15),
  dadosAte: instanteNoFusoDoPainel(27, 14, 58, 41),
  dadosDesde: instanteNoFusoDoPainel(27, 15) - RETENCAO_EM_DIAS * MILISSEGUNDOS_POR_DIA,
};

/* Perdas de evento que as aplicações informaram na última hora (saúde do envio). */
const PERDAS_INFORMADAS = [
  { aplicacao: 'API', quantidade: 2, informadaEm: instanteNoFusoDoPainel(27, 14, 31, 7) },
];

/* ---------- Origem: aplicações, versões e execuções do Excurfly ---------- */
const ORIGENS_DO_EXCURFLY = {
  api: { aplicacao: 'API', versao: '2.14.0', execucao: 'api-7f3c' },
  site: { aplicacao: 'Site', versao: '5.3.1', execucao: 'site-b21a' },
  webhooks: { aplicacao: 'Webhooks', versao: '1.8.2', execucao: 'webhooks-e90d' },
};

/* ---------- Catálogo de campos (sintético) ----------
   Campo pesquisável: nome, tipo e buscas permitidas. `especifico` marca o filtro que
   aponta um código (reserva, cliente, cobrança): com ele o período vai a toda a retenção.
   `rapidoDesde` é o instante em que o campo foi declarado: antes dele, só busca lenta.
   Os campos da plataforma valem para todo produto e leem a origem do evento. */
const CAMPOS_DA_PLATAFORMA = [
  { nome: 'nivel', chaveDoRotulo: 'campoNivel', propriedadeDoEvento: 'nivel', tipo: 'texto', buscas: ['exata'], papel: 'origem',
    opcoes: [{ valor: 'erro', chaveDoRotulo: 'nivelErro' }, { valor: 'aviso', chaveDoRotulo: 'nivelAviso' }, { valor: 'info', chaveDoRotulo: 'nivelInfo' }] },
  { nome: 'aplicacao', chaveDoRotulo: 'campoAplicacao', propriedadeDoEvento: 'aplicacao', tipo: 'texto', buscas: ['exata'], papel: 'origem',
    opcoes: [{ valor: 'API', rotulo: 'API' }, { valor: 'Site', rotulo: 'Site' }, { valor: 'Webhooks', rotulo: 'Webhooks' }] },
  { nome: 'versao', chaveDoRotulo: 'campoVersao', propriedadeDoEvento: 'versao', tipo: 'texto', buscas: ['exata'], papel: 'origem' },
  { nome: 'execucao', chaveDoRotulo: 'campoExecucao', propriedadeDoEvento: 'execucao', tipo: 'texto', buscas: ['exata'], papel: 'origem' },
  { nome: 'nomeDoEvento', chaveDoRotulo: 'campoNomeDoEvento', propriedadeDoEvento: 'nome', tipo: 'texto', buscas: ['exata'], papel: 'plataforma' },
  { nome: 'familia', chaveDoRotulo: 'campoFamilia', propriedadeDoEvento: 'familia', tipo: 'texto', buscas: ['exata'], papel: 'plataforma' },
  { nome: 'ocorrencia', chaveDoRotulo: 'campoOcorrencia', propriedadeDoEvento: 'ocorrencia', tipo: 'texto', buscas: ['exata'], papel: 'plataforma', especifico: true },
  { nome: 'rota', chaveDoRotulo: 'campoRota', propriedadeDoEvento: 'rota', tipo: 'texto', buscas: ['exata'], papel: 'plataforma' },
  { nome: 'url', chaveDoRotulo: 'campoUrl', propriedadeDoEvento: 'url', tipo: 'url', buscas: ['comeco'], papel: 'plataforma' },
];

const CATALOGO_DE_CAMPOS = {
  excurfly: [
    { nome: 'reservationId', descricao: 'Código da reserva', apelidos: ['reserva'], tipo: 'texto', buscas: ['exata'], papel: 'principal', especifico: true },
    { nome: 'pspTxId', descricao: 'Código da cobrança no provedor', tipo: 'texto', buscas: ['exata'], papel: 'correlacao', especifico: true },
    { nome: 'refundId', descricao: 'Código do estorno', tipo: 'texto', buscas: ['exata'], papel: 'correlacao', especifico: true },
    { nome: 'accountId', descricao: 'Conta de quem compra', apelidos: ['buyerAccountId'], tipo: 'texto', buscas: ['exata'], papel: 'localizacao', especifico: true },
    { nome: 'tripId', descricao: 'Viagem', tipo: 'texto', buscas: ['exata'], papel: 'localizacao', especifico: true },
    { nome: 'buyerDocument', descricao: 'Documento de quem compra', tipo: 'codigo', buscas: ['exata'], especifico: true },
    { nome: 'method', descricao: 'Método de pagamento', tipo: 'texto', buscas: ['exata'],
      opcoes: [{ valor: 'pix', rotulo: 'pix' }, { valor: 'cartao', rotulo: 'cartao' }, { valor: 'boleto', rotulo: 'boleto' }] },
    { nome: 'amountCents', descricao: 'Valor em centavos', tipo: 'numero', buscas: ['exata', 'intervalo'], rapidoDesde: instanteNoFusoDoPainel(27, 14) },
    { nome: 'paidAt', descricao: 'Quando o pagamento foi confirmado', tipo: 'data', buscas: ['intervalo'] },
    { nome: 'refunded', descricao: 'Se houve estorno', tipo: 'booleano', buscas: ['exata'],
      opcoes: [{ valor: 'true', chaveDoRotulo: 'valorVerdadeiro' }, { valor: 'false', chaveDoRotulo: 'valorFalso' }] },
    { nome: 'providerMessage', descricao: 'Resposta do provedor de pagamento', tipo: 'texto', buscas: ['palavras'] },
  ],
  demonstracao: [],
};

/* Código de busca: o painel troca o valor digitado inteiro pelo código e busca por ele.
   O documento abaixo é inventado e não passa na conferência de dígitos. */
const CODIGOS_DE_BUSCA_SINTETICOS = { '123.456.789-00': 'cb_51c0e7' };

/* ---------- O cenário das rotinas Investigar ----------
   A cliente conta-7 reserva a viagem V-5 (reserva R-1042). A cobrança T-900, no cartão,
   volta "cartão sem limite"; ela paga por pix (T-901) e recebe o estorno E-3 de uma taxa.
   O Site chama a reserva de `reserva` e a conta de `buyerAccountId` (apelidos do catálogo).
   A busca, o detalhe do evento e a tentativa usam estes mesmos eventos. */
const TRANSACAO_DA_RESERVA = { familia: 'transacao-financeira', ocorrencia: 'oc_1' };

const PILHA_DO_CARTAO_SEM_LIMITE = [
  'CardLimitExceededError: cartão sem limite',
  '    at ProviderGateway.authorize (/srv/api/src/payments/provider-gateway.js:212:15)',
  '    at async ChargeService.create (/srv/api/src/payments/charge-service.js:88:22)',
  '    at async PurchaseService.confirm (/srv/api/src/purchase/purchase-service.js:141:20)',
  '    at async PurchaseController.purchase (/srv/api/src/purchase/purchase-controller.js:37:18)',
  '    at async Layer.handle (/srv/api/node_modules/router/lib/layer.js:95:5)',
  '    at async Route.dispatch (/srv/api/node_modules/router/lib/route.js:114:3)',
  '    at async authenticate (/srv/api/src/http/authenticate.js:29:5)',
  '    at async requestContext (/srv/api/src/http/request-context.js:18:5)',
  '    at async rateLimiter (/srv/api/src/http/rate-limiter.js:44:7)',
  '    at async Server.handleRequest (/srv/api/src/http/server.js:71:9)',
  'Caused by: ProviderResponseError: 402 insufficient_funds (provider=pagador-ficticio, tx=T-900)',
  '    at ProviderClient.post (/srv/api/src/payments/provider-client.js:63:13)',
  '    at async ProviderGateway.authorize (/srv/api/src/payments/provider-gateway.js:198:24)',
];

const EVENTOS_DO_CENARIO = [
  { id: 'ev-1042-01', ...ORIGENS_DO_EXCURFLY.site, nivel: 'info', nome: 'reservation.created', mensagem: 'reservation created',
    origemEm: instanteNoFusoDoPainel(27, 14, 0, 3, 120), recebidoEm: instanteNoFusoDoPainel(27, 14, 4, 10, 512), atrasado: true,
    rota: '/viagem/:id/reservar', url: 'https://excurfly.example/viagem/V-5/reservar',
    atributos: { reserva: 'R-1042', buyerAccountId: 'conta-7', tripId: 'V-5', seats: 2 } },
  { id: 'ev-1042-02', ...ORIGENS_DO_EXCURFLY.site, ...TRANSACAO_DA_RESERVA, nivel: 'info', nome: 'checkout.started', mensagem: 'checkout started',
    origemEm: instanteNoFusoDoPainel(27, 14, 55, 12, 300),
    rota: '/checkout/:reserva', url: 'https://excurfly.example/checkout/R-1042',
    atributos: { reserva: 'R-1042', buyerAccountId: 'conta-7', step: 'payment' } },
  { id: 'ev-1042-03', ...ORIGENS_DO_EXCURFLY.api, ...TRANSACAO_DA_RESERVA, nivel: 'info', nome: 'purchase.requested', mensagem: 'purchase requested',
    origemEm: instanteNoFusoDoPainel(27, 14, 55, 13, 20),
    rota: '/api/v1/trip/:id/purchase', url: 'https://api.excurfly.example/api/v1/trip/V-5/purchase',
    atributos: { reservationId: 'R-1042', accountId: 'conta-7', tripId: 'V-5', amountCents: 4500, method: 'cartao', installmentCount: 3 },
    mascarados: { buyerDocument: '***.456.789-**' }, codigosDeBusca: { buyerDocument: 'cb_51c0e7' }, naoDeclarados: ['installmentCount'] },
  { id: 'ev-1042-04', ...ORIGENS_DO_EXCURFLY.api, ...TRANSACAO_DA_RESERVA, nivel: 'info', nome: 'charge.created', mensagem: 'charge created',
    origemEm: instanteNoFusoDoPainel(27, 14, 55, 13, 480),
    rota: '/api/v1/trip/:id/purchase', url: 'https://api.excurfly.example/api/v1/trip/V-5/purchase',
    atributos: { reservationId: 'R-1042', pspTxId: 'T-900', amountCents: 4500, method: 'cartao', installmentCount: 3 }, naoDeclarados: ['installmentCount'] },
  { id: 'ev-1042-05', ...ORIGENS_DO_EXCURFLY.webhooks, ...TRANSACAO_DA_RESERVA, nivel: 'aviso', nome: 'provider.webhook.received', mensagem: 'provider webhook received',
    origemEm: instanteNoFusoDoPainel(27, 14, 55, 15, 902),
    rota: '/webhooks/provider', url: 'https://hooks.excurfly.example/webhooks/provider',
    atributos: { pspTxId: 'T-900', status: 'refused', providerMessage: 'insufficient funds on card' } },
  { id: 'ev-1042-06', ...ORIGENS_DO_EXCURFLY.api, ...TRANSACAO_DA_RESERVA, nivel: 'erro', nome: 'charge.refused', mensagem: 'cartão sem limite',
    origemEm: instanteNoFusoDoPainel(27, 14, 55, 16, 10),
    rota: '/api/v1/trip/:id/purchase', url: 'https://api.excurfly.example/api/v1/trip/V-5/purchase',
    atributos: { reservationId: 'R-1042', pspTxId: 'T-900', accountId: 'conta-7', amountCents: 4500, method: 'cartao', installmentCount: 3 },
    mascarados: { buyerDocument: '***.456.789-**' }, codigosDeBusca: { buyerDocument: 'cb_51c0e7' }, naoDeclarados: ['installmentCount'],
    erro: { tipo: 'CardLimitExceededError', pilha: PILHA_DO_CARTAO_SEM_LIMITE } },
  { id: 'ev-1042-07', ...ORIGENS_DO_EXCURFLY.api, ...TRANSACAO_DA_RESERVA, nivel: 'aviso', nome: 'payment.retried', mensagem: 'retrying payment with another method',
    origemEm: instanteNoFusoDoPainel(27, 14, 56, 40, 877),
    rota: '/api/v1/trip/:id/purchase', url: 'https://api.excurfly.example/api/v1/trip/V-5/purchase',
    atributos: { reservationId: 'R-1042', accountId: 'conta-7', method: 'pix', attempt: 2 }, naoDeclarados: ['attempt'] },
  { id: 'ev-1042-08', ...ORIGENS_DO_EXCURFLY.api, ...TRANSACAO_DA_RESERVA, nivel: 'info', nome: 'charge.created', mensagem: 'charge created',
    origemEm: instanteNoFusoDoPainel(27, 14, 56, 41, 300),
    rota: '/api/v1/trip/:id/purchase', url: 'https://api.excurfly.example/api/v1/trip/V-5/purchase',
    atributos: { reservationId: 'R-1042', pspTxId: 'T-901', amountCents: 4500, method: 'pix' } },
  { id: 'ev-1042-09', ...ORIGENS_DO_EXCURFLY.webhooks, ...TRANSACAO_DA_RESERVA, nivel: 'info', nome: 'provider.webhook.received', mensagem: 'provider webhook received',
    origemEm: instanteNoFusoDoPainel(27, 14, 57, 2, 115),
    rota: '/webhooks/provider', url: 'https://hooks.excurfly.example/webhooks/provider',
    atributos: { pspTxId: 'T-901', status: 'paid', providerMessage: 'payment approved' } },
  { id: 'ev-1042-10', ...ORIGENS_DO_EXCURFLY.api, ...TRANSACAO_DA_RESERVA, nivel: 'info', nome: 'payment.confirmed', mensagem: 'payment confirmed',
    origemEm: instanteNoFusoDoPainel(27, 14, 57, 2, 640),
    rota: '/webhooks/provider', url: 'https://api.excurfly.example/internal/payment/T-901/confirm',
    atributos: { reservationId: 'R-1042', pspTxId: 'T-901', accountId: 'conta-7', amountCents: 4500, method: 'pix', paidAt: '27/11/2026 14:57', refunded: false } },
  { id: 'ev-1042-11', ...ORIGENS_DO_EXCURFLY.api, ...TRANSACAO_DA_RESERVA, nivel: 'info', nome: 'refund.requested', mensagem: 'refund requested',
    origemEm: instanteNoFusoDoPainel(27, 14, 58, 10, 4),
    rota: '/api/v1/reservation/:id/refund', url: 'https://api.excurfly.example/api/v1/reservation/R-1042/refund',
    atributos: { reservationId: 'R-1042', refundId: 'E-3', pspTxId: 'T-901', amountCents: 1500, reason: 'duplicated seat fee', refunded: true }, naoDeclarados: ['reason'] },
  { id: 'ev-1042-12', ...ORIGENS_DO_EXCURFLY.webhooks, ...TRANSACAO_DA_RESERVA, nivel: 'info', nome: 'refund.confirmed', mensagem: 'refund confirmed by provider',
    origemEm: instanteNoFusoDoPainel(27, 14, 58, 35, 660),
    rota: '/webhooks/provider', url: 'https://hooks.excurfly.example/webhooks/provider',
    atributos: { refundId: 'E-3', pspTxId: 'T-901', status: 'refunded', providerMessage: 'refund approved' } },

  /* Outras cobranças com "cartão sem limite", para a busca por texto livre achar. */
  { id: 'ev-1040-01', ...ORIGENS_DO_EXCURFLY.api, nivel: 'erro', nome: 'charge.refused', mensagem: 'cartão sem limite',
    origemEm: instanteNoFusoDoPainel(27, 14, 21, 47, 233),
    rota: '/api/v1/trip/:id/purchase', url: 'https://api.excurfly.example/api/v1/trip/V-9/purchase',
    atributos: { reservationId: 'R-1040', pspTxId: 'T-893', accountId: 'conta-12', amountCents: 12900, method: 'cartao' } },
  { id: 'ev-1038-01', ...ORIGENS_DO_EXCURFLY.api, nivel: 'erro', nome: 'charge.refused', mensagem: 'cartão sem limite',
    origemEm: instanteNoFusoDoPainel(27, 13, 12, 5, 871),
    rota: '/api/v1/trip/:id/purchase', url: 'https://api.excurfly.example/api/v1/trip/V-5/purchase',
    atributos: { reservationId: 'R-1038', pspTxId: 'T-887', accountId: 'conta-31', amountCents: 4500, method: 'cartao' } },
  { id: 'ev-1031-01', ...ORIGENS_DO_EXCURFLY.api, nivel: 'erro', nome: 'charge.refused', mensagem: 'cartão sem limite',
    origemEm: instanteNoFusoDoPainel(27, 12, 20, 39, 408),
    rota: '/api/v1/trip/:id/purchase', url: 'https://api.excurfly.example/api/v1/trip/V-2/purchase',
    atributos: { reservationId: 'R-1031', pspTxId: 'T-871', accountId: 'conta-44', amountCents: 2300, method: 'cartao' } },
  { id: 'ev-1019-01', ...ORIGENS_DO_EXCURFLY.api, nivel: 'erro', nome: 'charge.refused', mensagem: 'cartão sem limite',
    origemEm: instanteNoFusoDoPainel(27, 9, 40, 12, 96),
    rota: '/api/v1/trip/:id/purchase', url: 'https://api.excurfly.example/api/v1/trip/V-7/purchase',
    atributos: { reservationId: 'R-1019', pspTxId: 'T-850', accountId: 'conta-9', amountCents: 8700, method: 'cartao' } },
].map((evento) => ({ recebidoEm: evento.origemEm + 380, ...evento }));

/* ---------- O resto do movimento do Excurfly ----------
   Eventos gerados por molde, sempre iguais: enchem as páginas de 100 e passam dos 5.000
   na última hora. Mais densos na última hora, mais ralos até o fim da retenção. */
const MOLDES_DE_EVENTO = [
  (numero) => ({ ...ORIGENS_DO_EXCURFLY.api, nivel: 'info', nome: 'trip.availability.checked', mensagem: 'trip availability checked',
    rota: '/api/v1/trip/:id/availability', url: `https://api.excurfly.example/api/v1/trip/V-${100 + (numero % 40)}/availability`,
    atributos: { tripId: `V-${100 + (numero % 40)}`, seatsLeft: numero % 9, durationMs: 12 + (numero % 60) } }),
  (numero) => ({ ...ORIGENS_DO_EXCURFLY.site, nivel: 'info', nome: 'search.rendered', mensagem: 'search results rendered',
    rota: '/busca', url: 'https://excurfly.example/busca',
    atributos: { results: 4 + (numero % 20), durationMs: 90 + (numero % 200) } }),
  (numero) => ({ ...ORIGENS_DO_EXCURFLY.api, nivel: 'info', nome: 'health.checked', mensagem: 'health check ok',
    rota: '/health', url: 'https://api.excurfly.example/health',
    atributos: { durationMs: 2 + (numero % 5) } }),
  (numero) => ({ ...ORIGENS_DO_EXCURFLY.api, ...{ familia: 'transacao-financeira', ocorrencia: `oc_${200 + (numero % 500)}` }, nivel: 'info', nome: 'charge.created', mensagem: 'charge created',
    rota: '/api/v1/trip/:id/purchase', url: `https://api.excurfly.example/api/v1/trip/V-${100 + (numero % 40)}/purchase`,
    atributos: { reservationId: `R-${900 + (numero % 90)}`, pspTxId: `T-${100 + (numero % 700)}`, amountCents: 500 + (numero % 12) * 650, method: numero % 3 === 0 ? 'cartao' : 'pix' } }),
  (numero) => ({ ...ORIGENS_DO_EXCURFLY.site, nivel: 'info', nome: 'page.viewed', mensagem: 'page viewed',
    rota: '/viagem/:id', url: `https://excurfly.example/viagem/V-${100 + (numero % 40)}`,
    atributos: { tripId: `V-${100 + (numero % 40)}`, buyerAccountId: `conta-${20 + (numero % 60)}` } }),
  (numero) => ({ ...ORIGENS_DO_EXCURFLY.webhooks, nivel: 'info', nome: 'provider.webhook.received', mensagem: 'provider webhook received',
    rota: '/webhooks/provider', url: 'https://hooks.excurfly.example/webhooks/provider',
    atributos: { pspTxId: `T-${100 + (numero % 700)}`, status: 'paid', providerMessage: 'payment approved' } }),
  (numero) => ({ ...ORIGENS_DO_EXCURFLY.api, nivel: 'aviso', nome: 'query.slow', mensagem: 'slow query on reservations table',
    rota: '/api/v1/reservation/:id', url: `https://api.excurfly.example/api/v1/reservation/R-${900 + (numero % 90)}`,
    atributos: { reservationId: `R-${900 + (numero % 90)}`, durationMs: 1800 + (numero % 900) } }),
  (numero) => ({ ...ORIGENS_DO_EXCURFLY.api, ...{ familia: 'transacao-financeira', ocorrencia: `oc_${200 + (numero % 500)}` }, nivel: 'erro', nome: 'charge.refused', mensagem: 'payment refused by provider',
    rota: '/api/v1/trip/:id/purchase', url: `https://api.excurfly.example/api/v1/trip/V-${100 + (numero % 40)}/purchase`,
    atributos: { reservationId: `R-${900 + (numero % 90)}`, pspTxId: `T-${100 + (numero % 700)}`, accountId: `conta-${20 + (numero % 60)}`, amountCents: 500 + (numero % 12) * 650, method: numero % 2 === 0 ? 'cartao' : 'pix' } }),
  (numero) => ({ ...ORIGENS_DO_EXCURFLY.site, nivel: 'aviso', nome: 'image.slow', mensagem: 'image took too long to load',
    rota: '/viagem/:id', url: `https://excurfly.example/viagem/V-${100 + (numero % 40)}`,
    atributos: { tripId: `V-${100 + (numero % 40)}`, durationMs: 3000 + (numero % 2500) } }),
  (numero) => ({ ...ORIGENS_DO_EXCURFLY.site, nivel: 'info', nome: 'session.started', mensagem: 'user signed in',
    rota: '/entrar', url: 'https://excurfly.example/entrar',
    atributos: { buyerAccountId: `conta-${20 + (numero % 60)}`, signInMethod: 'password' } }),
];

/* A ordem dos moldes varia sem sorteio: o mesmo número dá sempre o mesmo evento. */
const ORDEM_DOS_MOLDES = [0, 1, 4, 3, 2, 0, 5, 9, 1, 7, 0, 4, 6, 2, 1, 3, 8, 0, 5, 4, 2, 7, 1, 9];

const FAIXAS_DE_MOVIMENTO = [
  { ate: RELOGIO_DO_PAINEL.agora - MILISSEGUNDOS_POR_HORA, passo: 678 },
  { ate: RELOGIO_DO_PAINEL.agora - MILISSEGUNDOS_POR_DIA, passo: 30 * 1000 },
  { ate: RELOGIO_DO_PAINEL.dadosDesde, passo: 15 * MILISSEGUNDOS_POR_MINUTO },
];

const gerarMovimentoDoExcurfly = () => {
  const eventosGerados = [];
  let instanteDaVez = RELOGIO_DO_PAINEL.dadosAte - 211;
  FAIXAS_DE_MOVIMENTO.forEach((faixa) => {
    while (instanteDaVez > faixa.ate) {
      const numero = eventosGerados.length;
      const molde = MOLDES_DE_EVENTO[ORDEM_DOS_MOLDES[numero % ORDEM_DOS_MOLDES.length]];
      const origemEm = instanteDaVez - ((numero * 37) % 190);
      eventosGerados.push({ id: `ev-m-${numero}`, origemEm, recebidoEm: origemEm + 240 + ((numero * 53) % 400), ...molde(numero * 7 + 3 + Math.floor(numero / ORDEM_DOS_MOLDES.length) * 5) });
      instanteDaVez -= faixa.passo;
    }
  });
  return eventosGerados;
};

/* Todos os eventos do Excurfly em produção, mais recentes primeiro. */
const EVENTOS_DO_EXCURFLY = [...EVENTOS_DO_CENARIO, ...gerarMovimentoDoExcurfly()]
  .sort((eventoAnterior, eventoSeguinte) => eventoSeguinte.origemEm - eventoAnterior.origemEm);

/* O alerta da chegada pelo celular e da mensagem no Telegram. */
const ALERTA_EXEMPLO = {
  id: 'a17',
  nome: 'API do Excurfly: mais de 40 erros em 5 min',
  produto: 'Excurfly',
  aplicacao: 'API',
  ambiente: 'produção',
  contagem: 42,
  janela: '5 min',
  limite: 40,
  disparouEm: '23:04:12',
  data: '27/11/2026',
  fuso: 'BRT, UTC−3',
};

const EVENTOS_DO_ALERTA = [
  { id: 'al-01', horario: '23:04:11.903', nivel: 'erro', aplicacao: 'API', mensagem: 'payment refused by provider' },
  { id: 'al-02', horario: '23:04:09.415', nivel: 'erro', aplicacao: 'API', mensagem: 'connection reset by pagador-ficticio' },
  { id: 'al-03', horario: '23:04:02.088', nivel: 'erro', aplicacao: 'API', mensagem: 'payment refused by provider' },
  { id: 'al-04', horario: '23:03:51.640', nivel: 'erro', aplicacao: 'API', mensagem: 'timeout calling pagador-ficticio after 5000 ms' },
  { id: 'al-05', horario: '23:03:40.217', nivel: 'erro', aplicacao: 'API', mensagem: 'payment refused by provider' },
  { id: 'al-06', horario: '23:03:22.761', nivel: 'erro', aplicacao: 'API', mensagem: 'NullPointerException at PurchaseService.confirm' },
];

/* Superfície e tema de abertura vêm da aba ativa, em visoes.jsx. */
const DEFAULTS = {
  estado: 'default',
  mode: 'prototype',
};
