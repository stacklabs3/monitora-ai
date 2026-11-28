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
  /* A tentativa: tudo que se liga a um valor de um campo principal. */
  TENTATIVA_INVESTIGADOR:  '#/painel/:produto/:ambiente/investigador/tentativas/:campo/:valor',
  TENTATIVA_ADMINISTRADOR: '#/painel/:produto/:ambiente/administrador/tentativas/:campo/:valor',
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
