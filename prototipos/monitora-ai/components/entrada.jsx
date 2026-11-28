// Monitora AI — Entrada e segundo fator (casca).
// A entrada é por convite com segundo fator, no computador e no celular
// (Definir privacidade, acesso e retenção, itens 13 e 14). Quem chega pelo link do
// alerta entra e volta direto ao alerta; quem tem a sessão caída volta para onde estava.

const ehDestinoDeAlerta = (destino) => Boolean(destino) && destino.startsWith('alerta-');

const irParaODestino = (navigate, destino) => {
  if (ehDestinoDeAlerta(destino)) {
    navigate('ALERTA_NO_CELULAR', { idDoAlerta: destino.replace('alerta-', '') });
    return;
  }
  navigate('PAINEL_INVESTIGADOR', PAINEL_DO_EXCURFLY);
};

const MolduraDeEntrada = ({ traduzir, children }) => (
  <div style={{
    flex: 1, minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 'var(--space-5)', background: 'var(--bg)',
  }}>
    <main style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <MarcaDoPainel traduzir={traduzir} />
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {children}
      </Card>
    </main>
  </div>
);

const TituloDaEntrada = ({ titulo, subtitulo }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>{titulo}</h1>
    <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.45 }}>{subtitulo}</p>
  </div>
);

const AvisoDoDestinoAlerta = ({ traduzir }) => (
  <div style={{
    display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start',
    padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
    background: 'var(--accent-soft)', color: 'var(--fg)', fontSize: 13, lineHeight: 1.45,
  }}>
    <IconBell size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
    <span>{traduzir('entradaDestinoAlerta', { alerta: ALERTA_EXEMPLO.nome })}</span>
  </div>
);

const TelaEntrada = ({ lang, estado, params }) => {
  const traduzir = useT(lang);
  const { navigate } = useRouter();
  const [emailDigitado, setEmailDigitado] = useState(PESSOA_EXEMPLO.email);
  const [senhaDigitada, setSenhaDigitada] = useState('senha-de-exemplo');

  const destino = params.destino || 'painel';
  const vazio = estado === 'empty';
  const comErro = estado === 'error';
  const carregando = estado === 'loading';
  const semInternet = estado === 'offline';
  const desabilitado = estado === 'disabled';

  const emailNaTela = vazio ? '' : emailDigitado;
  const senhaNaTela = vazio || comErro ? '' : senhaDigitada;
  const podeEntrar = Boolean(emailNaTela && senhaNaTela) && !semInternet && !desabilitado;

  return (
    <MolduraDeEntrada traduzir={traduzir}>
      {semInternet && (
        <AvisoSemInternet
          titulo={traduzir('semInternetTitulo')}
          continuaFuncionando={traduzir('entradaSemInternetContinua')}
          espera={traduzir('entradaSemInternetEspera')}
        />
      )}
      <TituloDaEntrada titulo={traduzir('entradaTitulo')} subtitulo={traduzir('entradaSubtitulo')} />
      {ehDestinoDeAlerta(destino) && <AvisoDoDestinoAlerta traduzir={traduzir} />}
      {comErro && <AvisoDeErro titulo={traduzir('entradaErroTitulo')} corpo={traduzir('entradaErroCorpo')} />}
      <Field
        label={traduzir('entradaEmail')} type="email" autoComplete="username"
        value={emailNaTela} onChange={setEmailDigitado} disabled={desabilitado}
      />
      <Field
        label={traduzir('entradaSenha')} type="password" autoComplete="current-password"
        value={senhaNaTela} onChange={setSenhaDigitada} disabled={desabilitado}
        error={comErro ? traduzir('entradaErroTitulo') : undefined}
      />
      {vazio && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{traduzir('entradaVazioCorpo')}</p>}
      <Button
        variant="primary" loading={carregando} disabled={!podeEntrar}
        onClick={() => navigate('SEGUNDO_FATOR', { destino })}
      >
        {carregando ? traduzir('entradaEntrando') : traduzir('entradaEntrar')}
      </Button>
    </MolduraDeEntrada>
  );
};

const TelaSegundoFator = ({ lang, estado, params }) => {
  const traduzir = useT(lang);
  const { navigate } = useRouter();
  const [codigoDigitado, setCodigoDigitado] = useState('482913');

  const destino = params.destino || 'painel';
  const vazio = estado === 'empty';
  const comErro = estado === 'error';
  const carregando = estado === 'loading';
  const semInternet = estado === 'offline';
  const desabilitado = estado === 'disabled';

  const codigoNaTela = vazio ? '' : codigoDigitado;
  const podeConfirmar = codigoNaTela.length === 6 && !semInternet && !desabilitado;

  return (
    <MolduraDeEntrada traduzir={traduzir}>
      {semInternet && (
        <AvisoSemInternet
          titulo={traduzir('semInternetTitulo')}
          continuaFuncionando={traduzir('entradaSemInternetContinua')}
          espera={traduzir('segundoFatorSemInternetEspera')}
        />
      )}
      <TituloDaEntrada titulo={traduzir('segundoFatorTitulo')} subtitulo={traduzir('segundoFatorSubtitulo')} />
      {comErro && <AvisoDeErro titulo={traduzir('segundoFatorErroTitulo')} corpo={traduzir('segundoFatorErroCorpo')} />}
      <Field
        label={traduzir('segundoFatorCodigo')} inputMode="numeric" autoComplete="one-time-code" mono
        value={codigoNaTela} disabled={desabilitado}
        onChange={(codigoNovo) => setCodigoDigitado(codigoNovo.replace(/\D/g, '').slice(0, 6))}
        error={comErro ? traduzir('segundoFatorErroTitulo') : undefined}
      />
      {vazio && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{traduzir('segundoFatorVazioCorpo')}</p>}
      <Button
        variant="primary" loading={carregando} disabled={!podeConfirmar}
        onClick={() => irParaODestino(navigate, destino)}
      >
        {carregando ? traduzir('segundoFatorConfirmando') : traduzir('segundoFatorConfirmar')}
      </Button>
      <Button variant="ghost" onClick={() => navigate('ENTRADA', { destino })}>
        {traduzir('voltar')}
      </Button>
    </MolduraDeEntrada>
  );
};
