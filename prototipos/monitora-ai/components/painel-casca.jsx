// Monitora AI — Casca do painel no computador.
// Produto, ambiente e período sempre à vista; seletor de papel; menu das rotinas; tema;
// atalhos de teclado. O miolo da busca é provisório: a busca, o detalhe e a tentativa
// se desenham nos tickets do lote Investigar, pelo /integrar-ao-prototipo.

const ALTURA_DA_LINHA_DE_EVENTO = 34;

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

const ItemDoMenu = ({ icone: Icone, rotulo, atual }) => (
  <Press
    aria-current={atual ? 'page' : undefined}
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

const MenuDoPainel = ({ traduzir, papel }) => (
  <nav aria-label={traduzir('cascaMenu')} style={{
    width: 236, flexShrink: 0, padding: 'var(--space-3)',
    borderRight: '1px solid var(--border)', background: 'var(--surface)',
    display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto',
  }}>
    <SecaoDoMenu titulo={traduzir('menuInvestigar')}>
      <ItemDoMenu icone={IconSearch} rotulo={traduzir('menuBusca')} atual />
      <ItemDoMenu icone={IconBranch} rotulo={traduzir('menuTentativas')} />
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

const BotaoDeIcone = ({ rotulo, icone: Icone, aoClicar, disabled, ...resto }) => (
  <Press
    aria-label={rotulo} title={rotulo} onClick={aoClicar} disabled={disabled} {...resto}
    style={{
      width: 36, height: 36, display: 'grid', placeItems: 'center',
      borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
      background: 'var(--surface)', color: 'var(--fg)',
    }}
  >
    <Icone size={18} />
  </Press>
);

const BarraDoPainel = ({ traduzir, params, papel, desabilitado, abrirAtalhos }) => {
  const { navigate } = useRouter();
  const rotaDoPapel = papel === 'administrador' ? 'PAINEL_ADMINISTRADOR' : 'PAINEL_INVESTIGADOR';
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
          onChange={(evento) => navigate(rotaDoPapel, { ...params, produto: evento.target.value })}
          style={{
            minHeight: 36, padding: '0 var(--space-3)', borderRadius: 'var(--radius-md)',
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
          aoEscolher={(ambienteEscolhido) => navigate(rotaDoPapel, { ...params, ambiente: ambienteEscolhido })}
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
          aoEscolher={(papelEscolhido) => navigate(
            papelEscolhido === 'administrador' ? 'PAINEL_ADMINISTRADOR' : 'PAINEL_INVESTIGADOR', params)}
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

const FichaDeFiltro = ({ traduzir, rotulo, garantida, disabled }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
    padding: '4px 4px 4px var(--space-3)', borderRadius: 'var(--radius-full)',
    background: 'var(--surface)', border: '1px solid var(--border-strong)', fontSize: 13, fontWeight: 600,
  }}>
    <span>{rotulo}</span>
    <span style={{
      fontSize: 11, fontWeight: 800, padding: '1px var(--space-2)', borderRadius: 'var(--radius-full)',
      background: garantida ? 'var(--ok-soft)' : 'var(--warn-soft)',
      color: garantida ? 'var(--ok-fg)' : 'var(--nivel-aviso-fg)',
    }}>{garantida ? traduzir('fichaGarantida') : traduzir('fichaLenta')}</span>
    <Press
      aria-label={traduzir('fichaRemover', { ficha: rotulo })} disabled={disabled}
      style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-full)', color: 'var(--muted)' }}
    >
      <IconClose size={14} />
    </Press>
  </span>
);

const BarraDeBusca = ({ traduzir, desabilitado, semInternet, campoDeBuscaRef }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'stretch' }}>
      <label style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        padding: '0 var(--space-3)', minHeight: 40, borderRadius: 'var(--radius-md)',
        background: 'var(--input-bg)', border: '1px solid var(--border-strong)',
      }}>
        <IconSearch size={16} style={{ color: 'var(--muted)' }} />
        <span className="so-leitor">{traduzir('buscaCampo')}</span>
        <input
          ref={campoDeBuscaRef} type="search" placeholder={traduzir('buscaCampo')} disabled={desabilitado}
          className="campo-sem-moldura"
          style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--fg)', fontSize: 14 }}
        />
        <span aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 12, color: 'var(--muted)' }}>
          <Tecla>/</Tecla>
        </span>
      </label>
      <Press
        disabled={desabilitado}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '0 var(--space-3)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--surface)',
          fontSize: 13, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{traduzir('cascaPeriodo')}</span>
        <span>{traduzir('buscaPeriodoValor', PERIODO_PADRAO)}</span>
      </Press>
      <Button variant="primary" disabled={desabilitado || semInternet}>{traduzir('buscaBuscar')}</Button>
    </div>
    <div role="group" aria-label={traduzir('buscaFichas')} style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <FichaDeFiltro traduzir={traduzir} rotulo={traduzir('fichaAplicacao')} garantida disabled={desabilitado} />
    </div>
  </div>
);

const LinhaDeEvento = ({ traduzir, evento, quebrarLinha, selecionada, aoSelecionar, aoTeclar, linhaRef, disabled }) => (
  <li style={{ listStyle: 'none' }}>
    <Press
      ref={linhaRef} disabled={disabled}
      onClick={aoSelecionar} onKeyDownCapture={aoTeclar}
      aria-current={selecionada ? 'true' : undefined}
      style={{
        display: 'grid', gridTemplateColumns: '112px 64px 64px 1fr', gap: 'var(--space-3)',
        alignItems: quebrarLinha ? 'start' : 'center',
        minHeight: ALTURA_DA_LINHA_DE_EVENTO, padding: '6px var(--space-3)',
        borderBottom: '1px solid var(--border)',
        background: selecionada ? 'var(--accent-soft)' : 'transparent',
        fontSize: 13,
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
        {evento.horario}
      </span>
      <span><NivelDoEvento nivel={evento.nivel} traduzir={traduzir} /></span>
      <span style={{ fontWeight: 700 }}>{evento.aplicacao}</span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 12.5, minWidth: 0,
        whiteSpace: quebrarLinha ? 'normal' : 'nowrap', overflow: 'hidden',
        textOverflow: quebrarLinha ? 'clip' : 'ellipsis', wordBreak: quebrarLinha ? 'break-word' : 'normal',
      }}>
        {evento.mensagem}
        {quebrarLinha
          ? <span style={{ display: 'block', color: 'var(--muted)', marginTop: 2 }}>{evento.detalhe}</span>
          : <span style={{ color: 'var(--muted)' }}>{'  '}{evento.detalhe}</span>}
      </span>
    </Press>
  </li>
);

const CabecalhoDaLista = ({ traduzir }) => (
  <div aria-hidden style={{
    display: 'grid', gridTemplateColumns: '112px 64px 64px 1fr', gap: 'var(--space-3)',
    padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border-strong)',
    fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)',
  }}>
    <span>{traduzir('buscaColunaHorario')}</span>
    <span>{traduzir('buscaColunaNivel')}</span>
    <span>{traduzir('buscaColunaAplicacao')}</span>
    <span>{traduzir('buscaColunaMensagem')}</span>
  </div>
);

const ListaDeEventos = ({ traduzir, estado, quebrarLinha }) => {
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const linhasRef = useRef([]);
  const desabilitado = estado === 'disabled';

  const teclarNaLinha = (indiceDaLinha) => (evento) => {
    const proximoIndice = evento.key === 'ArrowDown' ? indiceDaLinha + 1 : evento.key === 'ArrowUp' ? indiceDaLinha - 1 : null;
    if (proximoIndice === null || proximoIndice < 0 || proximoIndice >= EVENTOS_DA_BUSCA.length) return;
    evento.preventDefault();
    setIndiceSelecionado(proximoIndice);
    linhasRef.current[proximoIndice]?.focus();
  };

  if (estado === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border)' }}>
          <MensagemDeEstado acao={<Button variant="ghost">{traduzir('cancelar')}</Button>}>
            {traduzir('buscando')}
          </MensagemDeEstado>
        </div>
        {EVENTOS_DA_BUSCA.slice(0, 10).map((evento) => (
          <div key={evento.id} style={{
            display: 'grid', gridTemplateColumns: '112px 64px 64px 1fr', gap: 'var(--space-3)', alignItems: 'center',
            height: ALTURA_DA_LINHA_DE_EVENTO, padding: '0 var(--space-3)', borderBottom: '1px solid var(--border)',
          }}>
            <Skeleton altura={12} /><Skeleton altura={14} /><Skeleton altura={12} /><Skeleton largura="70%" altura={12} />
          </div>
        ))}
      </div>
    );
  }

  if (estado === 'empty') {
    return (
      <EmptyState
        title={traduzir('buscaVazioTitulo', { inicio: PERIODO_PADRAO.inicio, fim: PERIODO_PADRAO.fim, ambiente: AMBIENTES[0].nome })}
        body={traduzir('buscaVazioCorpo', { dadosAte: PERIODO_PADRAO.dadosAte })}
        cta={traduzir('buscaVazioAcao')} onCta={() => {}}
      />
    );
  }

  if (estado === 'error') {
    return <ErrorState title={traduzir('buscaErroTitulo')} body={traduzir('buscaErroCorpo')} cta={traduzir('tentarDeNovo')} onCta={() => {}} />;
  }

  return (
    <ol aria-label={traduzir('buscaLista')} style={{ margin: 0, padding: 0 }}>
      {EVENTOS_DA_BUSCA.map((evento, indiceDaLinha) => (
        <LinhaDeEvento
          key={evento.id} traduzir={traduzir} evento={evento} quebrarLinha={quebrarLinha} disabled={desabilitado}
          selecionada={indiceDaLinha === indiceSelecionado}
          aoSelecionar={() => setIndiceSelecionado(indiceDaLinha)}
          aoTeclar={teclarNaLinha(indiceDaLinha)}
          linhaRef={(elemento) => { linhasRef.current[indiceDaLinha] = elemento; }}
        />
      ))}
    </ol>
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
        onClick={(evento) => evento.stopPropagation()}
        style={{
          width: 420, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
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

const TelaPainel = ({ lang, estado, params, papel }) => {
  const traduzir = useT(lang);
  const [quebrarLinha, setQuebrarLinha] = useState(false);
  const [atalhosAbertos, setAtalhosAbertos] = useState(false);
  const campoDeBuscaRef = useRef(null);
  const desabilitado = estado === 'disabled';
  const semInternet = estado === 'offline';
  const parametrosDoPainel = { ...PAINEL_DO_EXCURFLY, ...params };

  useEffect(() => {
    const teclar = (evento) => {
      if (evento.key === 'Escape') { setAtalhosAbertos(false); return; }
      if (ehCampoDeDigitar(document.activeElement)) return;
      if (evento.key === '/') { evento.preventDefault(); campoDeBuscaRef.current?.focus(); }
      if (evento.key === '?') { evento.preventDefault(); setAtalhosAbertos(true); }
    };
    window.addEventListener('keydown', teclar);
    return () => window.removeEventListener('keydown', teclar);
  }, []);

  return (
    <div style={{ position: 'relative', flex: 1, width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <BarraDoPainel
        traduzir={traduzir} params={parametrosDoPainel} papel={papel} desabilitado={desabilitado}
        abrirAtalhos={() => setAtalhosAbertos(true)}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <MenuDoPainel traduzir={traduzir} papel={papel} />
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-4) var(--space-5)', overflowY: 'auto' }}>
          {semInternet && (
            <div style={{ position: 'sticky', top: 0, zIndex: 5 }}>
              <AvisoSemInternet
                titulo={traduzir('semInternetTitulo')}
                continuaFuncionando={traduzir('buscaSemInternetContinua')}
                espera={traduzir('buscaSemInternetEspera')}
              />
            </div>
          )}
          <BarraDeBusca traduzir={traduzir} desabilitado={desabilitado} semInternet={semInternet} campoDeBuscaRef={campoDeBuscaRef} />
          <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                {traduzir('buscaResumo', { total: TOTAL_DA_PAGINA, dadosAte: PERIODO_PADRAO.dadosAte })}
              </span>
              <Press
                aria-pressed={quebrarLinha} disabled={desabilitado} onClick={() => setQuebrarLinha(!quebrarLinha)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '6px var(--space-3)',
                  borderRadius: 'var(--radius-sm)', fontSize: 12.5, fontWeight: 700,
                  border: '1px solid var(--border-strong)',
                  background: quebrarLinha ? 'var(--accent-soft)' : 'var(--surface)', color: 'var(--fg)',
                }}
              >
                <IconWrap size={14} />{traduzir('buscaQuebrarLinha')}
              </Press>
            </div>
            {estado !== 'empty' && estado !== 'error' && <CabecalhoDaLista traduzir={traduzir} />}
            <ListaDeEventos traduzir={traduzir} estado={estado} quebrarLinha={quebrarLinha} />
          </section>
        </main>
      </div>
      {atalhosAbertos && <JanelaDeAtalhos traduzir={traduzir} fechar={() => setAtalhosAbertos(false)} />}
    </div>
  );
};

const TelaPainelInvestigador = (propriedades) => <TelaPainel {...propriedades} papel="investigador" />;
const TelaPainelAdministrador = (propriedades) => <TelaPainel {...propriedades} papel="administrador" />;
