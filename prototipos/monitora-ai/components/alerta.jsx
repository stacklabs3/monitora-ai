// Monitora AI — Chegada pelo alerta (casca): a mensagem no Telegram e o painel no celular.
// No celular só se lê: o alerta que disparou, os eventos dele (duas linhas por evento) e,
// no lote Alertas, o detalhe de um evento. Sem busca nova, sem administração, sem atalhos
// (Definir superfícies e aparelhos, Q3; Definir princípios de UI/UX, Q1 e Q3).

const EventoDoAlerta = ({ traduzir, evento }) => (
  <li style={{
    listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
    padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
        {evento.horario}
      </span>
      <NivelDoEvento nivel={evento.nivel} traduzir={traduzir} />
      <span style={{ fontSize: 13, fontWeight: 700 }}>{evento.aplicacao}</span>
    </div>
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 13.5, lineHeight: 1.4,
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {evento.mensagem}
    </div>
  </li>
);

const CartaoDoAlerta = ({ traduzir }) => (
  <section aria-labelledby="titulo-do-alerta" style={{
    margin: 'var(--space-4)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
    background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--danger)',
    display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
      <IconBell size={16} style={{ color: 'var(--danger)' }} />
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--nivel-erro-fg)' }}>
        {traduzir('alertaCelularTitulo')}
      </span>
    </div>
    <h1 id="titulo-do-alerta" style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>{ALERTA_EXEMPLO.nome}</h1>
    <div style={{ fontSize: 14, fontWeight: 700 }}>
      {traduzir('alertaCelularContagem', ALERTA_EXEMPLO)}
    </div>
    <div style={{ fontSize: 13, color: 'var(--muted)' }}>
      {traduzir('alertaCelularDisparou', { horario: ALERTA_EXEMPLO.disparouEm, data: ALERTA_EXEMPLO.data, fuso: ALERTA_EXEMPLO.fuso })}
    </div>
  </section>
);

const TelaAlertaNoCelular = ({ lang, estado }) => {
  const traduzir = useT(lang);
  const semInternet = estado === 'offline';

  const cabecalho = (
    <header style={{
      position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)',
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    }}>
      <MarcaDoPainel traduzir={traduzir} compacta />
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
        {ALERTA_EXEMPLO.produto} · {ALERTA_EXEMPLO.ambiente}
      </span>
    </header>
  );

  if (estado === 'loading') {
    return (
      <div style={{ flex: 1, minHeight: '100%', background: 'var(--bg)' }}>
        {cabecalho}
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <MensagemDeEstado>{traduzir('buscando')}</MensagemDeEstado>
          <Skeleton altura={132} raio="var(--radius-lg)" />
          {[1, 2, 3, 4].map((posicao) => <Skeleton key={posicao} altura={56} raio="var(--radius-md)" />)}
        </div>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div style={{ flex: 1, minHeight: '100%', background: 'var(--bg)' }}>
        {cabecalho}
        <ErrorState title={traduzir('alertaCelularErroTitulo')} body={traduzir('alertaCelularErroCorpo')} cta={traduzir('tentarDeNovo')} onCta={() => {}} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: '100%', background: 'var(--bg)' }}>
      {cabecalho}
      {semInternet && (
        <div style={{ padding: 'var(--space-3) var(--space-4) 0' }}>
          <AvisoSemInternet
            titulo={traduzir('semInternetTitulo')}
            continuaFuncionando={traduzir('alertaCelularSemInternetContinua')}
            espera={traduzir('alertaCelularSemInternetEspera')}
          />
        </div>
      )}
      <CartaoDoAlerta traduzir={traduzir} />
      <h2 style={{
        margin: 0, padding: 'var(--space-2) var(--space-4)', fontSize: 12, fontWeight: 800,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)',
      }}>{traduzir('alertaCelularEventos')}</h2>
      {estado === 'empty'
        ? <EmptyState title={traduzir('alertaCelularVazioTitulo')} body={traduzir('alertaCelularVazioCorpo')} />
        : (
          <ol aria-label={traduzir('alertaCelularEventos')} style={{ margin: 0, padding: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
            {EVENTOS_DO_ALERTA.map((evento) => <EventoDoAlerta key={evento.id} traduzir={traduzir} evento={evento} />)}
          </ol>
        )}
      <p style={{ margin: 0, padding: 'var(--space-4)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
        {traduzir('alertaCelularRodape')}
      </p>
    </div>
  );
};

/* ---------- Moldura do Telegram ----------
   Só a moldura da conversa, com as cores do protótipo: a marca do Telegram não entra.
   Se o canal de alerta mudar (Escolher os canais de alerta), troca a moldura e o
   conteúdo da mensagem fica. */
const BalaoDoBot = ({ traduzir, desabilitado, aoAbrir }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxWidth: '86%' }}>
    <div style={{
      padding: 'var(--space-3) var(--space-3) var(--space-2)', borderRadius: '4px var(--radius-lg) var(--radius-lg) var(--radius-lg)',
      background: 'var(--chat-balao)', color: 'var(--fg)', boxShadow: 'var(--shadow-sm)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 14.5, lineHeight: 1.4,
    }}>
      <strong>{traduzir('telegramLinha1', ALERTA_EXEMPLO)}</strong>
      <span>{traduzir('telegramLinha2', ALERTA_EXEMPLO)}</span>
      <span>{traduzir('telegramLinha3', { horario: ALERTA_EXEMPLO.disparouEm, fuso: ALERTA_EXEMPLO.fuso })}</span>
      <span style={{ alignSelf: 'flex-end', fontSize: 11.5, color: 'var(--muted)' }}>{traduzir('telegramHorarioDaMensagem')}</span>
    </div>
    <Press
      role="link" disabled={desabilitado} onClick={aoAbrir}
      style={{
        minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
        borderRadius: 'var(--radius-md)', background: 'var(--chat-botao)', color: 'var(--fg)',
        fontSize: 14, fontWeight: 700,
      }}
    >
      {traduzir('telegramVerNoPainel')}<IconExternal size={15} />
    </Press>
  </div>
);

const TelaMensagemDoAlerta = ({ lang, estado }) => {
  const traduzir = useT(lang);
  const { navigate } = useRouter();
  const semInternet = estado === 'offline';
  const desabilitado = estado === 'disabled' || semInternet;

  const conteudo = () => {
    if (estado === 'loading') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxWidth: '86%' }}>
          <Skeleton altura={104} raio="var(--radius-lg)" />
          <Skeleton altura={44} raio="var(--radius-md)" />
        </div>
      );
    }
    if (estado === 'empty') {
      return <p style={{ margin: 'auto', textAlign: 'center', fontSize: 13.5, color: 'var(--muted)', maxWidth: 260 }}>{traduzir('telegramVazio')}</p>;
    }
    return (
      <>
        <BalaoDoBot traduzir={traduzir} desabilitado={desabilitado}
          aoAbrir={() => navigate('ENTRADA', { destino: `alerta-${ALERTA_EXEMPLO.id}` })} />
        {estado === 'error' && (
          <div role="alert" style={{
            alignSelf: 'center', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-full)',
            background: 'var(--danger-soft)', color: 'var(--fg)', fontSize: 12.5, fontWeight: 600, textAlign: 'center',
          }}>{traduzir('telegramErro')}</div>
        )}
      </>
    );
  };

  return (
    <div style={{ flex: 1, minHeight: '100%', display: 'flex', flexDirection: 'column', background: 'var(--chat-fundo)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      }}>
        <span aria-hidden style={{
          width: 38, height: 38, borderRadius: 'var(--radius-full)', background: 'var(--accent)', color: 'var(--on-accent)',
          display: 'grid', placeItems: 'center',
        }}><IconActivity size={18} /></span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{traduzir('telegramBot')}</span>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            {semInternet ? traduzir('telegramSemInternet') : traduzir('telegramBotTipo')}
          </span>
        </div>
      </header>
      {semInternet && (
        <div style={{ padding: 'var(--space-3) var(--space-4) 0' }}>
          <AvisoSemInternet
            titulo={traduzir('semInternetTitulo')}
            continuaFuncionando={traduzir('telegramSemInternetContinua')}
            espera={traduzir('telegramSemInternetEspera')}
          />
        </div>
      )}
      <main aria-label={traduzir('telegramConversa')} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
        <span style={{
          alignSelf: 'center', padding: '2px var(--space-3)', borderRadius: 'var(--radius-full)',
          background: 'var(--chat-data)', color: 'var(--fg)', fontSize: 12, fontWeight: 700,
        }}>{traduzir('telegramDataDaConversa')}</span>
        {conteudo()}
      </main>
    </div>
  );
};
