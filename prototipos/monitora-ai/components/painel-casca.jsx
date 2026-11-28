// Monitora AI — Casca do painel no computador.
// Produto e ambiente sempre à vista; seletor de papel; menu das rotinas; tema; atalhos de
// teclado. O miolo de cada rotina entra como filho da CascaDoPainel: a busca de eventos
// está em busca.jsx, o detalhe do evento em evento.jsx e as tentativas, com a linha do
// tempo, em tentativa.jsx. O menu leva à busca e às tentativas.

const LARGURA_DO_MENU_DO_PAINEL = 236;
const LARGURA_DA_JANELA_DE_ATALHOS = 420;
const LADO_DO_BOTAO_DE_ICONE = 36;

const temaAtual = () => document.documentElement.getAttribute('data-theme') || 'light';

/* O tema muda no <html> depois da renderização; a barra acompanha pelo atributo. */
const useTemaDoDocumento = () => {
  const [tema, setTema] = useState(temaAtual);
  useEffect(() => {
    const observador = new MutationObserver(() => setTema(temaAtual()));
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observador.disconnect();
  }, []);
  return tema;
};

/* O botão de tema do painel pede ao showcase a troca, para o painel flutuante e o
   endereço continuarem dizendo o tema certo. */
const pedirTrocaDeTema = () => window.dispatchEvent(new CustomEvent('prototipo-trocar-tema'));

const ehCampoDeDigitar = (elemento) => Boolean(elemento) &&
  (elemento.tagName === 'INPUT' || elemento.tagName === 'TEXTAREA' || elemento.tagName === 'SELECT' || elemento.isContentEditable);

/* As rotas de cada papel, pelo que a tela é. Quem navega no painel escolhe por aqui, para
   o papel ativo continuar no endereço. */
const ROTAS_DO_PAPEL = {
  investigador: {
    abertura: 'PAINEL_INVESTIGADOR', busca: 'BUSCA_INVESTIGADOR', evento: 'EVENTO_INVESTIGADOR', eventoNaSecao: 'EVENTO_SECAO_INVESTIGADOR',
    tentativas: 'TENTATIVAS_INVESTIGADOR', tentativasAchadas: 'TENTATIVAS_ACHADAS_INVESTIGADOR',
    tentativa: 'TENTATIVA_INVESTIGADOR', eventoDaTentativa: 'TENTATIVA_EVENTO_INVESTIGADOR', secaoDaTentativa: 'TENTATIVA_SECAO_INVESTIGADOR',
  },
  administrador: {
    abertura: 'PAINEL_ADMINISTRADOR', busca: 'BUSCA_ADMINISTRADOR', evento: 'EVENTO_ADMINISTRADOR', eventoNaSecao: 'EVENTO_SECAO_ADMINISTRADOR',
    tentativas: 'TENTATIVAS_ADMINISTRADOR', tentativasAchadas: 'TENTATIVAS_ACHADAS_ADMINISTRADOR',
    tentativa: 'TENTATIVA_ADMINISTRADOR', eventoDaTentativa: 'TENTATIVA_EVENTO_ADMINISTRADOR', secaoDaTentativa: 'TENTATIVA_SECAO_ADMINISTRADOR',
  },
};

/* Item sem `aoClicar` é de uma rotina que ainda não entrou no protótipo. */
const ItemDoMenu = ({ icone: Icone, rotulo, atual, aoClicar }) => (
  <Press
    aria-current={atual ? 'page' : undefined} onClick={aoClicar}
    className={aoClicar && !atual ? 'item-realcavel' : undefined}
    style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)',
      fontSize: 13.5, fontWeight: atual ? 700 : 600,
      color: atual ? 'var(--fg)' : 'var(--muted)',
      background: atual ? 'var(--accent-soft)' : 'transparent',
      boxShadow: atual ? 'inset 3px 0 0 var(--accent)' : 'none',
    }}
  >
    <Icone size={16} />
    <span>{rotulo}</span>
  </Press>
);

const SecaoDoMenu = ({ titulo, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <div style={{
      padding: 'var(--space-2) var(--space-3) var(--space-1)', fontSize: 11, fontWeight: 800,
      letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)',
    }}>{titulo}</div>
    {children}
  </div>
);

/* `itemAtual` diz em que rotina a pessoa está: 'busca' ou 'tentativas'. */
const MenuDoPainel = ({ traduzir, papel, itemAtual, aoIrPara }) => (
  <nav aria-label={traduzir('cascaMenu')} style={{
    width: LARGURA_DO_MENU_DO_PAINEL, flexShrink: 0, padding: 'var(--space-3)',
    borderRight: '1px solid var(--border)', background: 'var(--surface)',
    display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto',
  }}>
    <SecaoDoMenu titulo={traduzir('menuInvestigar')}>
      <ItemDoMenu icone={IconSearch} rotulo={traduzir('menuBusca')} atual={itemAtual === 'busca'} aoClicar={() => aoIrPara('abertura')} />
      <ItemDoMenu icone={IconBranch} rotulo={traduzir('menuTentativas')} atual={itemAtual === 'tentativas'} aoClicar={() => aoIrPara('tentativas')} />
      <ItemDoMenu icone={IconActivity} rotulo={traduzir('menuSaude')} />
      <ItemDoMenu icone={IconBell} rotulo={traduzir('menuAlertas')} />
    </SecaoDoMenu>
    {papel === 'administrador' && (
      <SecaoDoMenu titulo={traduzir('menuAdministrar')}>
        <ItemDoMenu icone={IconKey} rotulo={traduzir('menuAplicacoes')} />
        <ItemDoMenu icone={IconDatabase} rotulo={traduzir('menuCatalogo')} />
        <ItemDoMenu icone={IconBell} rotulo={traduzir('menuAdministrarAlertas')} />
      </SecaoDoMenu>
    )}
  </nav>
);

const RotuloDoControle = ({ children, paraId }) => (
  <label htmlFor={paraId} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{children}</label>
);

const BotaoDeIcone = ({ rotulo, icone: Icone, aoClicar, disabled, className, ...resto }) => (
  <Press
    aria-label={rotulo} title={rotulo} onClick={aoClicar} disabled={disabled}
    className={className ? `botao ${className}` : 'botao'} {...resto}
    style={{
      width: LADO_DO_BOTAO_DE_ICONE, height: LADO_DO_BOTAO_DE_ICONE, display: 'grid', placeItems: 'center',
      borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
      background: 'var(--surface)', color: 'var(--fg)',
    }}
  >
    <Icone size={18} />
  </Press>
);

/* `aoMudar` recebe o que a pessoa trocou (produto, ambiente ou papel). Quem decide o
   endereço é a rotina que está dentro da casca, para a busca não se perder na troca. */
const BarraDoPainel = ({ traduzir, params, papel, desabilitado, abrirAtalhos, aoMudar }) => {
  const temaEscuro = useTemaDoDocumento() === 'dark';

  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
      padding: 'var(--space-3) var(--space-4)', background: 'var(--surface)',
      borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
    }}>
      <MarcaDoPainel traduzir={traduzir} compacta />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <RotuloDoControle paraId="seletor-de-produto">{traduzir('cascaProduto')}</RotuloDoControle>
        <select
          id="seletor-de-produto" value={params.produto} disabled={desabilitado}
          onChange={(eventoDeTroca) => aoMudar({ produto: eventoDeTroca.target.value })}
          style={{
            minHeight: LADO_DO_BOTAO_DE_ICONE, padding: '0 var(--space-3)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--fg)',
            fontSize: 13.5, fontWeight: 700,
          }}
        >
          {PRODUTOS.map((produto) => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{traduzir('cascaAmbiente')}</span>
        <SeletorSegmentado
          rotulo={traduzir('cascaAmbiente')} valor={params.ambiente} disabled={desabilitado}
          opcoes={AMBIENTES.map((ambiente) => ({ valor: ambiente.id, rotulo: ambiente.nome }))}
          aoEscolher={(ambienteEscolhido) => aoMudar({ ambiente: ambienteEscolhido })}
        />
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{traduzir('cascaPapel')}</span>
        <SeletorSegmentado
          rotulo={traduzir('cascaPapel')} valor={papel} disabled={desabilitado}
          opcoes={[
            { valor: 'investigador', rotulo: traduzir('papelInvestigador') },
            { valor: 'administrador', rotulo: traduzir('papelAdministrador') },
          ]}
          aoEscolher={(papelEscolhido) => aoMudar({ papel: papelEscolhido })}
        />
        <BotaoDeIcone
          rotulo={temaEscuro ? traduzir('cascaTemaClaro') : traduzir('cascaTemaEscuro')}
          icone={temaEscuro ? IconSun : IconMoon} aoClicar={pedirTrocaDeTema}
        />
        <BotaoDeIcone rotulo={traduzir('cascaAtalhos')} icone={IconKeyboard} aoClicar={abrirAtalhos} aria-haspopup="dialog" />
        <span aria-label={PESSOA_EXEMPLO.nome} title={PESSOA_EXEMPLO.nome} style={{
          width: 32, height: 32, borderRadius: 'var(--radius-full)', display: 'grid', placeItems: 'center',
          background: 'var(--primary-soft)', color: 'var(--fg)', fontSize: 12, fontWeight: 800,
        }}>{PESSOA_EXEMPLO.iniciais}</span>
      </div>
    </header>
  );
};

const JanelaDeAtalhos = ({ traduzir, fechar }) => {
  const botaoFecharRef = useRef(null);
  useEffect(() => { botaoFecharRef.current?.focus(); }, []);
  const atalhos = [
    ['/', 'atalhoBusca'], ['↑ ↓', 'atalhoSetas'], ['Enter', 'atalhoEnter'], ['Esc', 'atalhoEsc'], ['?', 'atalhoAjuda'],
  ];
  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'var(--veu)', zIndex: 20,
      display: 'grid', placeItems: 'center',
    }} onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-dos-atalhos"
        onClick={(eventoDeClique) => eventoDeClique.stopPropagation()}
        style={{
          width: LARGURA_DA_JANELA_DE_ATALHOS, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
        }}>
        <h2 id="titulo-dos-atalhos" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{traduzir('atalhosTitulo')}</h2>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-2) var(--space-4)', alignItems: 'center' }}>
          {atalhos.map(([tecla, chaveDoTexto]) => (
            <React.Fragment key={chaveDoTexto}>
              <dt><Tecla>{tecla}</Tecla></dt>
              <dd style={{ margin: 0, fontSize: 13.5 }}>{traduzir(chaveDoTexto)}</dd>
            </React.Fragment>
          ))}
        </dl>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>{traduzir('atalhosNota')}</p>
        <Button variant="secondary" ref={botaoFecharRef} onClick={fechar}>{traduzir('fechar')}</Button>
      </div>
    </div>
  );
};

/* A moldura de toda rotina do painel no computador. `campoDeBuscaRef` é o campo que o
   atalho "/" foca; `aoMudar` recebe a troca de produto, ambiente ou papel.
   `cabeNaJanela` prende a casca à altura da janela, para o miolo rolar por dentro mesmo
   quando a moldura do showcase cresce com o conteúdo (o print): serve à tela cujo endereço
   abre já rolado até uma parte. */
const CascaDoPainel = ({ traduzir, estado, params, papel, aoMudar, campoDeBuscaRef, itemAtual = 'busca', cabeNaJanela, children }) => {
  const [atalhosAbertos, setAtalhosAbertos] = useState(false);
  const { navigate } = useRouter();
  const desabilitado = estado === 'disabled';
  /* O menu leva à abertura de cada rotina, no mesmo produto, ambiente e papel. */
  const irParaOItemDoMenu = (rotaDoItem) => navigate(ROTAS_DO_PAPEL[papel][rotaDoItem], { produto: params.produto, ambiente: params.ambiente });

  useEffect(() => {
    const teclar = (eventoDeTeclado) => {
      if (eventoDeTeclado.key === 'Escape') { setAtalhosAbertos(false); return; }
      if (ehCampoDeDigitar(document.activeElement)) return;
      if (eventoDeTeclado.key === '/') { eventoDeTeclado.preventDefault(); campoDeBuscaRef?.current?.focus(); }
      if (eventoDeTeclado.key === '?') { eventoDeTeclado.preventDefault(); setAtalhosAbertos(true); }
    };
    window.addEventListener('keydown', teclar);
    return () => window.removeEventListener('keydown', teclar);
  }, []);

  return (
    <div style={{
      position: 'relative', flex: 1, width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)',
      ...(cabeNaJanela ? { maxHeight: '100vh' } : {}),
    }}>
      <BarraDoPainel
        traduzir={traduzir} params={params} papel={papel} desabilitado={desabilitado}
        abrirAtalhos={() => setAtalhosAbertos(true)} aoMudar={aoMudar}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <MenuDoPainel traduzir={traduzir} papel={papel} itemAtual={itemAtual} aoIrPara={irParaOItemDoMenu} />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
      {atalhosAbertos && <JanelaDeAtalhos traduzir={traduzir} fechar={() => setAtalhosAbertos(false)} />}
    </div>
  );
};
