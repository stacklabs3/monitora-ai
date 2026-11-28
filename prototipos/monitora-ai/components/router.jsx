// Monitora AI — Router hash-based.
// Navegação real entre telas, como no painel final: o showcase não troca de tela por
// aba, ele navega. Em produção isso vira o roteador do painel em Solid (ADR 0004).
//
// O mapa rota → componente vive em app.jsx, que carrega por último e enxerga as
// telas. Aqui ficam só as rotas, o estado e a navegação.

const ROUTES = {
  ENTRADA:              '#/entrada/:destino',
  SEGUNDO_FATOR:        '#/segundo-fator/:destino',
  PAINEL_INVESTIGADOR:  '#/painel/:produto/:ambiente/investigador',
  PAINEL_ADMINISTRADOR: '#/painel/:produto/:ambiente/administrador',
  /* A busca inteira mora no endereço, num segmento só (busca.jsx diz o formato). As rotas
     PAINEL_* acima são a abertura da busca: última hora, sem filtro. */
  BUSCA_INVESTIGADOR:   '#/painel/:produto/:ambiente/investigador/eventos/:busca',
  BUSCA_ADMINISTRADOR:  '#/painel/:produto/:ambiente/administrador/eventos/:busca',
  /* O evento aberto ao lado da lista também mora no endereço: o link reabre a mesma busca
     com o mesmo evento aberto. */
  EVENTO_INVESTIGADOR:  '#/painel/:produto/:ambiente/investigador/eventos/:busca/evento/:idDoEvento',
  EVENTO_ADMINISTRADOR: '#/painel/:produto/:ambiente/administrador/eventos/:busca/evento/:idDoEvento',
  /* O evento aberto já rolado até uma seção (atributos, erro…). */
  EVENTO_SECAO_INVESTIGADOR:  '#/painel/:produto/:ambiente/investigador/eventos/:busca/evento/:idDoEvento/:secao',
  EVENTO_SECAO_ADMINISTRADOR: '#/painel/:produto/:ambiente/administrador/eventos/:busca/evento/:idDoEvento/:secao',
  /* Achar tentativas: a abertura (sem busca) e as tentativas achadas por um campo de
     localização, com o valor inteiro e o período no endereço. As rotas "por" vêm antes das
     rotas da tentativa: o `matchRoute` casa na ordem, e "por" não pode virar nome de campo. */
  TENTATIVAS_INVESTIGADOR:          '#/painel/:produto/:ambiente/investigador/tentativas',
  TENTATIVAS_ADMINISTRADOR:         '#/painel/:produto/:ambiente/administrador/tentativas',
  TENTATIVAS_ACHADAS_INVESTIGADOR:  '#/painel/:produto/:ambiente/investigador/tentativas/por/:campo/:valor/:periodo',
  TENTATIVAS_ACHADAS_ADMINISTRADOR: '#/painel/:produto/:ambiente/administrador/tentativas/por/:campo/:valor/:periodo',
  /* A tentativa: tudo que se liga a um valor de um campo principal, lido na linha do tempo. */
  TENTATIVA_INVESTIGADOR:  '#/painel/:produto/:ambiente/investigador/tentativas/:campo/:valor',
  TENTATIVA_ADMINISTRADOR: '#/painel/:produto/:ambiente/administrador/tentativas/:campo/:valor',
  /* O evento aberto ao lado da linha do tempo mora no endereço. */
  TENTATIVA_EVENTO_INVESTIGADOR:  '#/painel/:produto/:ambiente/investigador/tentativas/:campo/:valor/evento/:idDoEvento',
  TENTATIVA_EVENTO_ADMINISTRADOR: '#/painel/:produto/:ambiente/administrador/tentativas/:campo/:valor/evento/:idDoEvento',
  /* A linha do tempo já rolada até uma parte dela (o que fica à parte, embaixo). */
  TENTATIVA_SECAO_INVESTIGADOR:  '#/painel/:produto/:ambiente/investigador/tentativas/:campo/:valor/secao/:secao',
  TENTATIVA_SECAO_ADMINISTRADOR: '#/painel/:produto/:ambiente/administrador/tentativas/:campo/:valor/secao/:secao',
  /* Aplicações e chaves de envio: só o Administrador. A lista, o cadastro (`passo` = nova),
     a lista logo depois de guardar uma chave gerada (`chave` = nova abre o pedido de mais uma
     chave) e os passos de uma chave (`passo` = gerada, revogar ou revogada). */
  APLICACOES_ADMINISTRADOR:     '#/painel/:produto/:ambiente/administrador/aplicacoes',
  APLICACAO_NOVA_ADMINISTRADOR: '#/painel/:produto/:ambiente/administrador/aplicacoes/:passo',
  CHAVE_ADMINISTRADOR:          '#/painel/:produto/:ambiente/administrador/aplicacoes/:aplicacao/chaves/:chave',
  CHAVE_PASSO_ADMINISTRADOR:    '#/painel/:produto/:ambiente/administrador/aplicacoes/:aplicacao/chaves/:chave/:passo',
  /* Catálogo de campos: o Administrador declara, o Investigador só lê (por isso só a lista
     tem a rota dele). A janela de declarar um campo não declarado (`passo` = declarar) e a
     lista logo depois de declarar, com o que foi declarado no endereço (`declaracao` =
     tipo.buscas.papel, como catalogo.jsx diz). */
  CATALOGO_INVESTIGADOR:            '#/painel/:produto/:ambiente/investigador/catalogo',
  CATALOGO_ADMINISTRADOR:           '#/painel/:produto/:ambiente/administrador/catalogo',
  CATALOGO_CAMPO_ADMINISTRADOR:     '#/painel/:produto/:ambiente/administrador/catalogo/:campo/:passo',
  CATALOGO_DECLARADO_ADMINISTRADOR: '#/painel/:produto/:ambiente/administrador/catalogo/:campo/declarado/:declaracao',
  /* Saúde do envio: os dois papéis leem, ninguém escreve. A abertura olha as últimas 24 h;
     o período escolhido e a aplicação aberta moram no endereço (saude.jsx). */
  SAUDE_INVESTIGADOR:            '#/painel/:produto/:ambiente/investigador/saude',
  SAUDE_ADMINISTRADOR:           '#/painel/:produto/:ambiente/administrador/saude',
  SAUDE_PERIODO_INVESTIGADOR:    '#/painel/:produto/:ambiente/investigador/saude/:periodo',
  SAUDE_PERIODO_ADMINISTRADOR:   '#/painel/:produto/:ambiente/administrador/saude/:periodo',
  SAUDE_APLICACAO_INVESTIGADOR:  '#/painel/:produto/:ambiente/investigador/saude/:periodo/:aplicacao',
  SAUDE_APLICACAO_ADMINISTRADOR: '#/painel/:produto/:ambiente/administrador/saude/:periodo/:aplicacao',
  ALERTA_NO_CELULAR:    '#/alerta/:idDoAlerta',
  MENSAGEM_DO_ALERTA:   '#/telegram/:idDoAlerta',
};

/* Rota de abertura: a entrada, que depois leva ao painel. */
const ROTA_INICIAL = { name: 'ENTRADA', params: { destino: 'painel' } };

const matchRoute = (hash) => {
  if (!hash || hash === '#' || hash === '') return ROTA_INICIAL;

  for (const [name, pattern] of Object.entries(ROUTES)) {
    const padraoDaRota = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
    const correspondencia = hash.match(padraoDaRota);
    if (correspondencia) return { name, params: correspondencia.groups || {} };
  }
  return ROTA_INICIAL;
};

const buildPath = (name, params = {}) => {
  let path = ROUTES[name] || ROUTES[ROTA_INICIAL.name];
  for (const [nomeDoParametro, valorDoParametro] of Object.entries(params)) path = path.replace(`:${nomeDoParametro}`, valorDoParametro);
  return path;
};

const RouterContext = React.createContext(null);

const RouterProvider = ({ children }) => {
  const [route, setRoute] = React.useState(() => matchRoute(window.location.hash));

  React.useEffect(() => {
    const onHash = () => setRoute(matchRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = React.useCallback((name, params) => {
    window.location.hash = buildPath(name, params);
  }, []);

  const value = React.useMemo(() => ({ route, navigate }), [route, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

const useRouter = () => {
  const ctx = React.useContext(RouterContext);
  if (!ctx) throw new Error('useRouter precisa estar dentro de <RouterProvider>');
  return ctx;
};
