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

/* Período padrão: produção na última hora, no fuso do navegador, com o fuso escrito. */
const PERIODO_PADRAO = {
  rotulo: 'Última hora',
  inicio: '13:00',
  fim: '14:00',
  fuso: 'BRT, UTC−3',
  dadosAte: '13:58:41',
};

/* A página de 100 eventos é a que o painel tem de desenhar em 100 ms (ADR 0004).
   O protótipo mostra o começo dela, uma linha por evento. */
const EVENTOS_DA_BUSCA = [
  { id: 'ev-01', horario: '13:58:41.120', nivel: 'erro', aplicacao: 'API', mensagem: 'payment refused by provider', detalhe: 'reserva=R-1042 method=pix status=refused provider=pagador-ficticio attempt=3' },
  { id: 'ev-02', horario: '13:58:40.877', nivel: 'aviso', aplicacao: 'API', mensagem: 'retrying payment after timeout', detalhe: 'reserva=R-1042 method=pix attempt=3 timeoutMs=5000' },
  { id: 'ev-03', horario: '13:58:35.004', nivel: 'info', aplicacao: 'Site', mensagem: 'checkout started', detalhe: 'reserva=R-1042 rota=/checkout/:reserva passo=pagamento' },
  { id: 'ev-04', horario: '13:58:12.660', nivel: 'erro', aplicacao: 'API', mensagem: 'payment refused by provider', detalhe: 'reserva=R-1038 method=cartao status=refused provider=pagador-ficticio attempt=1' },
  { id: 'ev-05', horario: '13:57:59.318', nivel: 'info', aplicacao: 'API', mensagem: 'trip availability checked', detalhe: 'viagem=V-311 assentosLivres=4 rota=/api/v1/trip/:id/availability' },
  { id: 'ev-06', horario: '13:57:44.902', nivel: 'info', aplicacao: 'Site', mensagem: 'search results rendered', detalhe: 'resultados=12 rota=/busca duracaoMs=184' },
  { id: 'ev-07', horario: '13:57:30.115', nivel: 'aviso', aplicacao: 'API', mensagem: 'slow query on reservations table', detalhe: 'duracaoMs=2310 rota=/api/v1/reservation/:id' },
  { id: 'ev-08', horario: '13:57:02.481', nivel: 'erro', aplicacao: 'API', mensagem: 'NullPointerException at PurchaseService.confirm', detalhe: 'reserva=R-1031 rota=/api/v1/trip/:id/purchase versao=2.14.0' },
  { id: 'ev-09', horario: '13:56:47.036', nivel: 'info', aplicacao: 'API', mensagem: 'reservation created', detalhe: 'reserva=R-1042 viagem=V-311 assentos=2' },
  { id: 'ev-10', horario: '13:56:20.770', nivel: 'info', aplicacao: 'Site', mensagem: 'user signed in', detalhe: 'conta=conta-7 metodo=senha' },
  { id: 'ev-11', horario: '13:55:58.209', nivel: 'aviso', aplicacao: 'Site', mensagem: 'image took too long to load', detalhe: 'duracaoMs=4120 rota=/viagem/:id' },
  { id: 'ev-12', horario: '13:55:31.642', nivel: 'info', aplicacao: 'API', mensagem: 'health check ok', detalhe: 'execucao=api-7f3c duracaoMs=4' },
];

const TOTAL_DA_PAGINA = 100;

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
