// Monitora AI — Primitivos de UI compartilhados por todas as telas do protótipo.
// Antes de criar um componente numa tela, veja se ele já existe aqui.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- i18n hook ---------- */
const useT = (lang) => {
  const dicionario = TRANSLATIONS[lang] || TRANSLATIONS["pt-BR"];
  return useCallback((chave, variaveis) => {
    let texto = dicionario[chave];
    if (texto == null) return chave;
    if (variaveis) for (const nomeDaVariavel in variaveis) texto = texto.replace("{" + nomeDaVariavel + "}", variaveis[nomeDaVariavel]);
    return texto;
  }, [lang]);
};

/* ---------- Press (tappable feedback) ---------- */
const Press = React.forwardRef(({ children, onClick, style, className, disabled, ...rest }, referencia) => {
  const [down, setDown] = useState(false);
  return (
    <div
      ref={referencia}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onPointerDown={() => !disabled && setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onClick={() => !disabled && onClick && onClick()}
      onKeyDown={(evento) => {
        if ((evento.key === 'Enter' || evento.key === ' ') && !disabled && onClick) { evento.preventDefault(); onClick(); }
      }}
      aria-disabled={disabled || undefined}
      className={className}
      {...rest}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transform: down ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 120ms ease, opacity 120ms ease',
        userSelect: 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
});

/* ---------- Button variants ---------- */
const Button = React.forwardRef(({ variant = 'primary', loading, disabled, children, ...rest }, referencia) => {
  const styles = {
    primary: {
      background: 'var(--primary)',
      color: 'var(--surface)',
      border: '1px solid var(--primary)',
    },
    secondary: {
      background: 'var(--surface)',
      color: 'var(--fg)',
      border: '1px solid var(--border-strong)',
    },
    danger: {
      background: 'var(--danger)',
      color: 'var(--on-danger)',
      border: '1px solid var(--danger)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--fg)',
      border: '1px solid transparent',
    },
  };
  return (
    <Press
      ref={referencia}
      disabled={disabled || loading}
      {...rest}
      style={{
        ...styles[variant],
        padding: 'var(--space-3) var(--space-5)',
        borderRadius: 'var(--radius-md)',
        fontSize: 14,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        justifyContent: 'center',
        minHeight: 44,
      }}
    >
      {loading && <IconLoader size={16} />}
      {children}
    </Press>
  );
});

/* ---------- Card ---------- */
const Card = ({ children, style }) => (
  <div
    style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5)',
      boxShadow: 'var(--shadow-sm)',
      ...style,
    }}
  >
    {children}
  </div>
);

/* ---------- Field ---------- */
const Field = ({ label, value, onChange, type = 'text', placeholder, error, disabled, inputMode, autoComplete, mono }) => {
  const [focus, setFocus] = useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      {label && (
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{label}</span>
      )}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        onChange={(evento) => onChange && onChange(evento.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          background: 'var(--input-bg)',
          color: 'var(--fg)',
          border: `1px solid ${error ? 'var(--danger)' : focus ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3) var(--space-4)',
          fontSize: 14,
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          letterSpacing: mono ? '0.2em' : 'normal',
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color 140ms ease',
          minHeight: 44,
        }}
      />
      {error && (
        <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>
      )}
    </label>
  );
};

/* ---------- Skeleton ---------- */
const Skeleton = ({ largura = '100%', altura = 16, raio = 'var(--radius-sm)' }) => (
  <div
    aria-hidden
    style={{
      width: largura,
      height: altura,
      borderRadius: raio,
      background: 'linear-gradient(90deg, var(--surface-2) 0%, var(--border) 50%, var(--surface-2) 100%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
    }}
  />
);

/* ---------- Empty / Error states ---------- */
const EmptyState = ({ title, body, cta, onCta }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-6)',
      textAlign: 'center',
    }}
  >
    <div
      style={{
        width: 56, height: 56,
        borderRadius: 'var(--radius-full)',
        background: 'var(--surface-2)',
        display: 'grid', placeItems: 'center',
        color: 'var(--muted)',
      }}
    >
      <IconBox size={28} />
    </div>
    <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
    <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 320 }}>{body}</div>
    {cta && <Button onClick={onCta}>{cta}</Button>}
  </div>
);

const ErrorState = ({ title, body, cta, onCta }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-6)',
      textAlign: 'center',
    }}
  >
    <div
      style={{
        width: 56, height: 56,
        borderRadius: 'var(--radius-full)',
        background: 'var(--danger-soft)',
        display: 'grid', placeItems: 'center',
        color: 'var(--danger)',
      }}
    >
      <IconAlert size={28} />
    </div>
    <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
    <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 320 }}>{body}</div>
    {cta && <Button variant="secondary" onClick={onCta}>{cta}</Button>}
  </div>
);

/* ---------- Sem internet ----------
   Avisa na hora que a conexão caiu, diz o que continua funcionando e o que espera.
   A tela continua de pé por baixo: sem internet não é tela de erro. */
const AvisoSemInternet = ({ titulo, continuaFuncionando, espera }) => (
  <div
    role="status"
    style={{
      display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--warn-soft)', color: 'var(--fg)',
      border: '1px solid var(--warn)', borderRadius: 'var(--radius-md)',
    }}
  >
    <IconWifiOff size={20} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{titulo}</div>
      {continuaFuncionando && <div style={{ fontSize: 13 }}>{continuaFuncionando}</div>}
      {espera && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{espera}</div>}
    </div>
  </div>
);

/* Aviso curto de que a conexão voltou. O Showcase mostra sozinho ao sair do
   estado offline; a tela não precisa cuidar disso. */
const AvisoConexaoVoltou = ({ texto }) => (
  <div
    role="status"
    style={{
      position: 'absolute', left: 'var(--space-4)', right: 'var(--space-4)', bottom: 'var(--space-5)',
      display: 'flex', gap: 'var(--space-2)', alignItems: 'center',
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--toast-bg)', color: 'var(--toast-fg)',
      borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
      fontSize: 13, fontWeight: 700, zIndex: 60, animation: 'fadeIn 160ms ease',
    }}
  >
    <IconWifi size={18} />
    <span>{texto}</span>
  </div>
);

/* ---------- Nível do evento ----------
   O nível nunca é só cor: "ERRO" aparece escrito, e a cor é reforço (Definir princípios
   de UI/UX, Q4; WCAG 1.4.1). */
const CORES_DO_NIVEL = {
  erro:  { fundo: 'var(--nivel-erro-bg)',  texto: 'var(--nivel-erro-fg)',  chave: 'nivelErro' },
  aviso: { fundo: 'var(--nivel-aviso-bg)', texto: 'var(--nivel-aviso-fg)', chave: 'nivelAviso' },
  info:  { fundo: 'var(--nivel-info-bg)',  texto: 'var(--nivel-info-fg)',  chave: 'nivelInfo' },
};

const NivelDoEvento = ({ nivel, traduzir }) => {
  const coresDoNivel = CORES_DO_NIVEL[nivel] || CORES_DO_NIVEL.info;
  return (
    <span style={{
      display: 'inline-block', minWidth: 52, textAlign: 'center',
      padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)',
      background: coresDoNivel.fundo, color: coresDoNivel.texto,
      fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em',
    }}>
      {traduzir(coresDoNivel.chave)}
    </span>
  );
};

/* ---------- Seletor segmentado ----------
   Escolha entre poucas opções sempre à vista (ambiente, papel). Grupo de rádio, que o
   teclado percorre com Tab e escolhe com Enter ou espaço. */
const SeletorSegmentado = ({ rotulo, opcoes, valor, aoEscolher, disabled }) => (
  <div role="radiogroup" aria-label={rotulo} style={{
    display: 'inline-flex', gap: 2, padding: 3,
    background: 'var(--surface-2)', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
  }}>
    {opcoes.map((opcao) => {
      const escolhida = opcao.valor === valor;
      return (
        <Press
          key={opcao.valor}
          role="radio"
          aria-checked={escolhida}
          disabled={disabled}
          onClick={() => !escolhida && aoEscolher(opcao.valor)}
          style={{
            padding: '6px var(--space-3)', borderRadius: 'var(--radius-sm)',
            fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            background: escolhida ? 'var(--surface)' : 'transparent',
            color: escolhida ? 'var(--fg)' : 'var(--muted)',
            boxShadow: escolhida ? 'var(--shadow-sm)' : 'none',
          }}
        >
          {opcao.rotulo}
        </Press>
      );
    })}
  </div>
);

/* ---------- Mensagem de estado ----------
   "Buscando…" e afins: anunciados a leitor de tela sem tirar o foco (WCAG 4.1.3). */
const MensagemDeEstado = ({ children, acao }) => (
  <div role="status" aria-live="polite" style={{
    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
    fontSize: 13, fontWeight: 600, color: 'var(--fg)',
  }}>
    <IconLoader size={16} style={{ color: 'var(--accent)' }} />
    <span>{children}</span>
    {acao}
  </div>
);

/* ---------- Marca do painel ---------- */
const MarcaDoPainel = ({ traduzir, compacta }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
    <span aria-hidden style={{
      width: compacta ? 22 : 26, height: compacta ? 22 : 26, borderRadius: 'var(--radius-sm)',
      background: 'var(--accent)', color: 'var(--on-accent)',
      display: 'grid', placeItems: 'center',
    }}>
      <IconActivity size={compacta ? 14 : 16} />
    </span>
    <span style={{ fontSize: compacta ? 15 : 17, fontWeight: 800, letterSpacing: '-0.3px', color: 'var(--fg)' }}>
      {traduzir('appName')}
    </span>
  </div>
);

/* ---------- Aviso de erro dentro da tela ----------
   Diz o que houve e o que fazer, sem tirar a pessoa da tela nem apagar o que ela digitou. */
const AvisoDeErro = ({ titulo, corpo, acao }) => (
  <div role="alert" style={{
    display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
    padding: 'var(--space-3) var(--space-4)',
    background: 'var(--danger-soft)', color: 'var(--fg)',
    border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)',
  }}>
    <IconAlert size={20} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{titulo}</div>
      {corpo && <div style={{ fontSize: 13 }}>{corpo}</div>}
      {acao}
    </div>
  </div>
);

/* ---------- Tecla ---------- */
const Tecla = ({ children }) => (
  <kbd style={{
    display: 'inline-block', minWidth: 22, textAlign: 'center',
    padding: '1px var(--space-1)', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--fg)',
  }}>{children}</kbd>
);

/* ---------- Animation keyframes injection ---------- */
const styleId = '__prototype_keyframes__';
if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `;
  document.head.appendChild(style);
}
