// Monitora AI — Abas (visões) e rotinas do protótipo único.
// As três visões vêm de Definir superfícies e aparelhos (issue 13); as rotinas da casca,
// de Definir rotinas do desenho inicial (issue 15). As rotinas dos lotes Investigar,
// Administrar e Alertas entram aqui pelo /integrar-ao-prototipo, uma por ticket.

/* Meta de toques do projeto: quantos toques a rotina pode levar, da primeira à última
   tela. Cada rotina pode declarar a sua; sem isso, vale esta. */
const META_DE_TOQUES = 3;

/* Uma aba por visão. O painel se desenha para o computador; o celular só mostra a
   chegada pelo link do alerta; o Telegram é a moldura da mensagem do alerta.
   O tablet não tem visão própria (usa a do computador ou a do celular). As visões do
   celular abrem no escuro: o alerta das 23h chega com o aparelho no modo escuro. */
const VISOES = [
  { id: 'painel', rotulo: 'Painel', superficies: ['desktop'], temaPadrao: 'light' },
  { id: 'celular', rotulo: 'Painel no celular', superficies: ['ios', 'android'], temaPadrao: 'dark' },
  { id: 'telegram', rotulo: 'Alerta no Telegram', superficies: ['ios', 'android'], temaPadrao: 'dark' },
];

const PAINEL_DO_EXCURFLY = { produto: 'excurfly', ambiente: 'producao' };

/* Uma rotina é o trabalho inteiro de alguém, em telas na ordem em que acontecem.
   `telas` são rotas de router.jsx, com os params da tela quando ela precisa. */
const ROTINAS = [
  {
    id: 'entrar-no-painel',
    visao: 'painel',
    rotulo: 'Entrar no painel',
    telas: [
      { rota: 'ENTRADA', params: { destino: 'painel' } },
      { rota: 'SEGUNDO_FATOR', params: { destino: 'painel' } },
      { rota: 'PAINEL_INVESTIGADOR', params: PAINEL_DO_EXCURFLY },
    ],
  },
  {
    id: 'ver-como-administrador',
    visao: 'painel',
    rotulo: 'Ver o painel como Administrador',
    telas: [
      { rota: 'PAINEL_INVESTIGADOR', params: PAINEL_DO_EXCURFLY },
      { rota: 'PAINEL_ADMINISTRADOR', params: PAINEL_DO_EXCURFLY },
    ],
    metaDeToques: 1,
  },
  {
    id: 'entrar-pelo-celular',
    visao: 'celular',
    rotulo: 'Entrar pelo link do alerta',
    telas: [
      { rota: 'ENTRADA', params: { destino: 'alerta-a17' } },
      { rota: 'SEGUNDO_FATOR', params: { destino: 'alerta-a17' } },
      { rota: 'ALERTA_NO_CELULAR', params: { idDoAlerta: 'a17' } },
    ],
  },
  {
    id: 'receber-o-alerta',
    visao: 'telegram',
    rotulo: 'Receber o alerta e abrir o painel',
    telas: [
      { rota: 'MENSAGEM_DO_ALERTA', params: { idDoAlerta: 'a17' } },
      { rota: 'ENTRADA', params: { destino: 'alerta-a17' } },
      { rota: 'SEGUNDO_FATOR', params: { destino: 'alerta-a17' } },
      { rota: 'ALERTA_NO_CELULAR', params: { idDoAlerta: 'a17' } },
    ],
  },
];

const visaoPorId = (idDaVisao) => VISOES.find((visao) => visao.id === idDaVisao) || VISOES[0];

const rotinasDaVisao = (idDaVisao) => ROTINAS.filter((rotina) => rotina.visao === idDaVisao);

const metaDaRotina = (rotina) => rotina.metaDeToques ?? META_DE_TOQUES;

/* Dúvida de aparência em aberto (A/B). Quando uma tela da rotina tem dúvida real entre
   duas formas, a rotina declara `duvidas` e a tela lê a escolha com useOpcao(id).
   A casca não tem dúvida aberta. */
const duvidasDaRotina = (rotina) => rotina.duvidas || [];

const duvidasDaVisao = (idDaVisao) => rotinasDaVisao(idDaVisao).flatMap(duvidasDaRotina);
