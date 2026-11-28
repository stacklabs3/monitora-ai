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
const TENTATIVA_DA_RESERVA = { ...PAINEL_DO_EXCURFLY, campo: 'reservationId', valor: 'R-1042' };

/* O cenário das rotinas Administrar: a chave gerada no cadastro da API de parceiros e a
   chave do servidor antigo do Site, as duas de data.jsx. */
const CHAVE_DA_API_DE_PARCEIROS = { ...PAINEL_DO_EXCURFLY, aplicacao: 'api-de-parceiros', chave: 'ex7a' };
const CHAVE_ANTIGA_DO_SITE = { ...PAINEL_DO_EXCURFLY, aplicacao: 'site', chave: 'ex2b' };

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
     "Abrir a tentativa" no valor R-1042, que leva à linha do tempo dela. */
  {
    id: 'ler-um-evento',
    visao: 'painel',
    rotulo: 'Abrir e ler um evento',
    telas: [
      { rota: 'BUSCA_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: BUSCA_DA_RESERVA } },
      { rota: 'EVENTO_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: BUSCA_DA_RESERVA, idDoEvento: EVENTO_DO_CARTAO_SEM_LIMITE } },
      { rota: 'TENTATIVA_INVESTIGADOR', params: TENTATIVA_DA_RESERVA },
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
  /* Prototipar a tentativa e sua linha do tempo (issue 70). Tudo mora no endereço: campo,
     valor inteiro, período, evento aberto e a parte rolada.
     Caminho: digitar conta-7 e "Achar tentativas" (ou Enter) → clicar em R-1042. */
  {
    id: 'achar-a-tentativa',
    visao: 'painel',
    rotulo: 'Achar a tentativa e ler a linha do tempo',
    telas: [
      { rota: 'TENTATIVAS_INVESTIGADOR', params: PAINEL_DO_EXCURFLY },
      { rota: 'TENTATIVAS_ACHADAS_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, campo: 'cliente', valor: 'conta-7', periodo: '1h' } },
      { rota: 'TENTATIVA_INVESTIGADOR', params: TENTATIVA_DA_RESERVA },
    ],
  },
  /* A linha do tempo com um evento aberto ao lado e, embaixo, o que fica à parte ("mesmo
     horário, sem vínculo"). Caminho: clicar na linha do Webhooks ligada por T-900 →
     "Ir para" Mesmo horário, sem vínculo. */
  {
    id: 'ler-a-linha-do-tempo',
    visao: 'painel',
    rotulo: 'Ler um evento da linha do tempo e o que fica à parte',
    telas: [
      { rota: 'TENTATIVA_INVESTIGADOR', params: TENTATIVA_DA_RESERVA },
      { rota: 'TENTATIVA_EVENTO_INVESTIGADOR', params: { ...TENTATIVA_DA_RESERVA, idDoEvento: 'ev-1042-05' } },
      { rota: 'TENTATIVA_SECAO_INVESTIGADOR', params: { ...TENTATIVA_DA_RESERVA, secao: 'sem-vinculo' } },
    ],
  },
  /* O código ligado a duas tentativas: a cobrança T-905 está em R-1046 e em R-1047. O
     aviso leva de uma à outra, e elas não se juntam. Caminho: "Abrir a tentativa R-1047". */
  {
    id: 'codigo-em-duas-tentativas',
    visao: 'painel',
    rotulo: 'Ler o código ligado a duas tentativas',
    telas: [
      { rota: 'TENTATIVA_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, campo: 'reservationId', valor: 'R-1046' } },
      { rota: 'TENTATIVA_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, campo: 'reservationId', valor: 'R-1047' } },
    ],
  },
  /* Prototipar aplicações e chaves de envio (issue 71). Só o Administrador. No cenário a API,
     o Site e os Webhooks já enviam de produção; a rotina cadastra uma aplicação que ainda
     não existe ali, a API de parceiros. A chave inteira aparece uma vez só.
     Caminho: menu "Aplicações e chaves de envio" → "Cadastrar aplicação" → digitar
     API de parceiros e "Cadastrar e gerar a chave" (ou Enter). */
  {
    id: 'cadastrar-aplicacao',
    visao: 'painel',
    rotulo: 'Cadastrar uma aplicação e gerar a chave de envio',
    telas: [
      { rota: 'PAINEL_ADMINISTRADOR', params: PAINEL_DO_EXCURFLY },
      { rota: 'APLICACOES_ADMINISTRADOR', params: PAINEL_DO_EXCURFLY },
      { rota: 'APLICACAO_NOVA_ADMINISTRADOR', params: { ...PAINEL_DO_EXCURFLY, passo: 'nova' } },
      { rota: 'CHAVE_PASSO_ADMINISTRADOR', params: { ...CHAVE_DA_API_DE_PARCEIROS, passo: 'gerada' } },
    ],
  },
  /* A chave mostrada uma vez: copiar e fechar. Depois de fechar, a lista só mostra o começo.
     Caminho: "Copiar a chave" → "Já guardei a chave". */
  {
    id: 'guardar-a-chave',
    visao: 'painel',
    rotulo: 'Copiar a chave de envio, mostrada uma vez só',
    telas: [
      { rota: 'CHAVE_PASSO_ADMINISTRADOR', params: { ...CHAVE_DA_API_DE_PARCEIROS, passo: 'gerada' } },
      { rota: 'CHAVE_ADMINISTRADOR', params: CHAVE_DA_API_DE_PARCEIROS },
    ],
    metaDeToques: 2,
  },
  /* Revogar pede confirmação com o nome e a consequência. Caminho: "Revogar" na chave
     "servidor antigo" do Site → "Revogar a chave". */
  {
    id: 'revogar-chave',
    visao: 'painel',
    rotulo: 'Revogar uma chave de envio',
    telas: [
      { rota: 'APLICACOES_ADMINISTRADOR', params: PAINEL_DO_EXCURFLY },
      { rota: 'CHAVE_PASSO_ADMINISTRADOR', params: { ...CHAVE_ANTIGA_DO_SITE, passo: 'revogar' } },
      { rota: 'CHAVE_PASSO_ADMINISTRADOR', params: { ...CHAVE_ANTIGA_DO_SITE, passo: 'revogada' } },
    ],
    metaDeToques: 2,
  },
  /* Prototipar o catálogo de campos (issue 72). No cenário, `amountCents` já foi declarado
     hoje às 14:00 ("rápido desde 14:00"); a rotina declara `installmentCount`, que os eventos
     da cobrança T-900 trazem sem declaração, e ele fica "rápido desde 15:00". O que foi
     declarado mora no endereço. Caminho: "Declarar" na linha de installmentCount → o tipo
     número já vem sugerido pelo valor visto → "Declarar o campo". */
  {
    id: 'declarar-um-campo',
    visao: 'painel',
    rotulo: 'Declarar um campo não declarado do catálogo de campos',
    telas: [
      { rota: 'CATALOGO_ADMINISTRADOR', params: PAINEL_DO_EXCURFLY },
      { rota: 'CATALOGO_CAMPO_ADMINISTRADOR', params: { ...PAINEL_DO_EXCURFLY, campo: 'installmentCount', passo: 'declarar' } },
      { rota: 'CATALOGO_DECLARADO_ADMINISTRADOR', params: { ...PAINEL_DO_EXCURFLY, campo: 'installmentCount', declaracao: 'numero.exata-intervalo.nenhum' } },
    ],
  },
  /* O Investigador lê o catálogo, sem declarar. O menu dele não tem o item: a entrada é o
     evento aberto, pela nota do atributo não declarado. Caminho: "Ver no catálogo de campos". */
  {
    id: 'ler-o-catalogo-como-investigador',
    visao: 'painel',
    rotulo: 'Ler o catálogo de campos como Investigador',
    telas: [
      { rota: 'EVENTO_SECAO_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: BUSCA_DA_RESERVA, idDoEvento: EVENTO_DO_CARTAO_SEM_LIMITE, secao: 'atributos' } },
      { rota: 'CATALOGO_INVESTIGADOR', params: PAINEL_DO_EXCURFLY },
    ],
    metaDeToques: 1,
  },
  /* Prototipar a saúde do envio (issue 73). Tela só de leitura, dos dois papéis. A abertura
     olha as últimas 24 h; o período e a aplicação aberta moram no endereço. No cenário a API
     tem 152 eventos faltando (122 com motivo "fila cheia", 30 de motivo desconhecido).
     Caminho: menu "Saúde do envio" → "Abrir" na linha da API. */
  {
    id: 'conferir-a-saude-do-envio',
    visao: 'painel',
    rotulo: 'Conferir a saúde do envio de uma aplicação',
    telas: [
      { rota: 'PAINEL_INVESTIGADOR', params: PAINEL_DO_EXCURFLY },
      { rota: 'SAUDE_INVESTIGADOR', params: PAINEL_DO_EXCURFLY },
      { rota: 'SAUDE_APLICACAO_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, periodo: '24h', aplicacao: 'api' } },
    ],
    metaDeToques: 2,
  },
  /* A execução que sumiu sem se despedir: a webhooks-c44a parou de informar às 14:52. O
     painel mostra o que faltou e avisa, sem número, que ela pode ter perdido mais depois.
     Caminho: "Abrir" na linha dos Webhooks. */
  {
    id: 'execucao-que-sumiu',
    visao: 'painel',
    rotulo: 'Ler a execução que sumiu sem se despedir',
    telas: [
      { rota: 'SAUDE_ADMINISTRADOR', params: PAINEL_DO_EXCURFLY },
      { rota: 'SAUDE_APLICACAO_ADMINISTRADOR', params: { ...PAINEL_DO_EXCURFLY, periodo: '24h', aplicacao: 'webhooks' } },
    ],
    metaDeToques: 1,
  },
  /* De uma perda para a busca: os eventos da aplicação nos 5 minutos antes e depois do
     horário da perda. Caminho: "Ver eventos em volta" na perda das 14:31. */
  {
    id: 'eventos-em-volta-da-perda',
    visao: 'painel',
    rotulo: 'Ver os eventos em volta de uma perda',
    telas: [
      { rota: 'SAUDE_APLICACAO_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, periodo: '24h', aplicacao: 'api' } },
      { rota: 'BUSCA_INVESTIGADOR', params: { ...PAINEL_DO_EXCURFLY, busca: 'p=i.202611271426.202611271436;f=aplicacao:e:API' } },
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
