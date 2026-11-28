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
