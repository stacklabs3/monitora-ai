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

/* O cenário das rotinas Investigar: a reserva R-1042 e o erro da cobrança T-900. */
const BUSCA_DA_RESERVA = 'p=1h;f=reservationId:e:R-1042';
const EVENTO_DO_CARTAO_SEM_LIMITE = 'ev-1042-06';

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
  /* Prototipar a busca de eventos (issue 68). A busca vai inteira no parâmetro `busca`,
     no formato de busca.jsx. Caminho: Adicionar filtro → reservationId → R-1042 e aplicar. */
  {
    id: 'buscar-eventos',
    visao: 'painel',
    rotulo: 'Buscar eventos',
    telas: [
      { rota: 'PAINEL_INVESTIGADOR', params: PAINEL_DO_EXCURFLY },
      { rota: 'BUSCA_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: BUSCA_DA_RESERVA } },
    ],
  },
  /* Os avisos próprios da busca, cada um numa tela: "rápido desde" (campo declarado às
     14h), resultado parcial de uma busca lenta e a busca lenta que termina inteira.
     Caminho: tirar a ficha → texto livre "limite" e Enter → Reduzir para a última hora. */
  {
    id: 'avisos-da-busca',
    visao: 'painel',
    rotulo: 'Ler os avisos da busca',
    telas: [
      { rota: 'BUSCA_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: 'p=24h;f=amountCents:i:1000,5000' } },
      { rota: 'BUSCA_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: 'p=24h;q=limite' } },
      { rota: 'BUSCA_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: 'p=1h;q=limite' } },
    ],
  },
  /* Prototipar o detalhe de um evento (issue 69). O evento abre ao lado da lista e mora
     no endereço. Caminho: clicar na linha do erro "cartão sem limite" (cobrança T-900) →
     "Abrir a tentativa" no valor R-1042. A tela da tentativa é a próxima rotina: aqui
     ela é um miolo provisório. */
  {
    id: 'ler-um-evento',
    visao: 'painel',
    rotulo: 'Abrir e ler um evento',
    telas: [
      { rota: 'BUSCA_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: BUSCA_DA_RESERVA } },
      { rota: 'EVENTO_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: BUSCA_DA_RESERVA, idDoEvento: EVENTO_DO_CARTAO_SEM_LIMITE } },
      { rota: 'TENTATIVA_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, campo: 'reservationId', valor: 'R-1042' } },
    ],
  },
  /* O que fica abaixo da dobra do evento aberto: os atributos (valor mascarado, código de
     busca, não declarado, valor incompatível) e o erro com a pilha longa. A seção mora no
     endereço. Caminho: "Ir para" Atributos → "Ir para" Erro. */
  {
    id: 'ler-o-erro-do-evento',
    visao: 'painel',
    rotulo: 'Ler os atributos e o erro de um evento',
    telas: [
      { rota: 'EVENTO_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: BUSCA_DA_RESERVA, idDoEvento: EVENTO_DO_CARTAO_SEM_LIMITE } },
      { rota: 'EVENTO_SECAO_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: BUSCA_DA_RESERVA, idDoEvento: EVENTO_DO_CARTAO_SEM_LIMITE, secao: 'atributos' } },
      { rota: 'EVENTO_SECAO_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: BUSCA_DA_RESERVA, idDoEvento: EVENTO_DO_CARTAO_SEM_LIMITE, secao: 'erro' } },
    ],
  },
  /* O atalho de filtrar por um valor do evento aberto. Caminho: "é" na linha `method`. */
  {
    id: 'filtrar-por-um-valor',
    visao: 'painel',
    rotulo: 'Filtrar por um valor do evento',
    telas: [
      { rota: 'EVENTO_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: BUSCA_DA_RESERVA, idDoEvento: EVENTO_DO_CARTAO_SEM_LIMITE } },
      { rota: 'BUSCA_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: `${BUSCA_DA_RESERVA};f=method:e:cartao` } },
    ],
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
