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
      className={className}
      /* O que sobra vem antes: nada do que quem chama passar troca a guarda do apagado. */
      {...rest}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={() => !disabled && setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onClick={() => !disabled && onClick && onClick()}
      onKeyDown={(evento) => {
        if ((evento.key === 'Enter' || evento.key === ' ') && !disabled && onClick) { evento.preventDefault(); onClick(); }
      }}
      aria-disabled={disabled || undefined}
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
/* `compacto` é o botão das barras densas do painel (paginação, ação de um aviso).
   A classe `botao` dá o realce de passar o mouse e de apertar (index.html); `className`
   soma as variantes que o grupo Estado força na conferência (`botao--hover`…). */
const Button = React.forwardRef(({ variant = 'primary', loading, disabled, compacto, className, children, ...rest }, referencia) => {
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
      className={className ? `botao ${className}` : 'botao'}
      {...rest}
      style={{
        ...styles[variant],
        padding: compacto ? 'var(--space-1) var(--space-3)' : 'var(--space-3) var(--space-5)',
        borderRadius: compacto ? 'var(--radius-sm)' : 'var(--radius-md)',
        fontSize: compacto ? 13 : 14,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        justifyContent: 'center',
        minHeight: compacto ? 32 : 44,
        whiteSpace: 'nowrap',
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
/* `rotuloSoParaLeitor` tira o rótulo da vista quando o exemplo dentro do campo já diz para
   que ele serve (a procura numa barra de título); leitor de tela continua lendo o rótulo. */
const Field = ({ label, value, onChange, type = 'text', placeholder, error, disabled, inputMode, autoComplete, mono, dica, focarAoAbrir, aoTeclar, maximoDeLetras, rotuloSoParaLeitor }) => {
  const [focus, setFocus] = useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: rotuloSoParaLeitor ? 0 : 4, width: '100%' }}>
      {label && (
        <span className={rotuloSoParaLeitor ? 'so-leitor' : undefined} style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{label}</span>
      )}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoFocus={focarAoAbrir}
        maxLength={maximoDeLetras}
        onKeyDown={aoTeclar}
        aria-invalid={error ? true : undefined}
        onChange={(evento) => onChange && onChange(evento.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          background: 'var(--input-bg)',
          color: 'var(--fg)',
          border: `1px solid ${error ? 'var(--danger)' : focus ? 'var(--primary)' : 'var(--border-control)'}`,
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
        <span role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>
      )}
      {dica && !error && (
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{dica}</span>
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
/* `detalhes` e `acoes` servem ao vazio que precisa dizer o que foi olhado e oferecer mais
   de um próximo passo (a busca de eventos). */
const EmptyState = ({ title, body, cta, onCta, detalhes, acoes }) => (
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
    <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: detalhes ? 520 : 320 }}>{body}</div>
    {detalhes}
    {cta && <Button onClick={onCta}>{cta}</Button>}
    {acoes}
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

/* ---------- Caixa de marcar ----------
   Liga ou desliga uma opção que vale junto com outras (as buscas permitidas de um campo).
   `dica` explica a opção logo abaixo do rótulo. O teclado marca com Enter ou espaço. */
const LADO_DA_CAIXA_DE_MARCAR = 18;

const CaixaDeMarcar = ({ rotulo, dica, marcada, aoMudar, disabled }) => (
  <Press
    role="checkbox" aria-checked={marcada} disabled={disabled} onClick={() => aoMudar(!marcada)}
    style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }}
  >
    <span aria-hidden style={{
      width: LADO_DA_CAIXA_DE_MARCAR, height: LADO_DA_CAIXA_DE_MARCAR, flexShrink: 0, marginTop: 1,
      display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-sm)',
      border: `1px solid ${marcada ? 'var(--accent)' : 'var(--border-control)'}`,
      background: marcada ? 'var(--accent)' : 'var(--input-bg)', color: 'var(--on-accent)',
    }}>
      {marcada && <IconCheck size={14} />}
    </span>
    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg)' }}>{rotulo}</span>
      {dica && <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4 }}>{dica}</span>}
    </span>
  </Press>
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

/* ---------- Aviso de atenção dentro da tela ----------
   O resultado veio, mas com uma ressalva que a pessoa precisa ler (parcial, "rápido
   desde"). Anunciado a leitor de tela sem tirar o foco. */
const TONS_DO_AVISO = {
  atencao: { fundo: 'var(--warn-soft)', contorno: 'var(--warn)', icone: IconAlert },
  feito: { fundo: 'var(--ok-soft)', contorno: 'var(--ok)', icone: IconCheck },
};

/* `tom="feito"` confirma o que acabou de ser feito (chave revogada), com o mesmo desenho. */
const AvisoDeAtencao = ({ titulo, corpo, acao, tom = 'atencao' }) => {
  const { fundo, contorno, icone: IconeDoTom } = TONS_DO_AVISO[tom] || TONS_DO_AVISO.atencao;
  return (
    <div role="status" aria-live="polite" style={{
      display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start',
      padding: 'var(--space-3) var(--space-4)',
      background: fundo, color: 'var(--fg)',
      border: `1px solid ${contorno}`, borderRadius: 'var(--radius-md)',
    }}>
      <IconeDoTom size={20} style={{ color: contorno, flexShrink: 0, marginTop: 1 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{titulo}</div>
        {corpo && <div style={{ fontSize: 13, lineHeight: 1.45 }}>{corpo}</div>}
      </div>
      {acao && <div style={{ flexShrink: 0, alignSelf: 'center' }}>{acao}</div>}
    </div>
  );
};

/* ---------- Janela de diálogo ----------
   Janela por cima da tela, que prende o foco do teclado enquanto está aberta. O foco entra
   no elemento marcado com `data-foco-inicial` (ou na própria janela). Com `aoFechar`, Esc e
   o clique fora fecham; sem ele, a janela só fecha pelos botões de dentro: serve ao que a
   pessoa não pode perder por um toque sem querer. Devolver o foco é de quem abriu. */
const SELETOR_DE_FOCAVEIS = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]';

/* O véu fica preso à área que a pessoa vê (não à página inteira), e a janela nunca passa
   dela: o título e as `acoes` (os botões do rodapé) ficam sempre à vista e o miolo rola por
   dentro. Abaixo da altura mínima, quem rola é o véu. */
const ALTURA_MINIMA_DA_JANELA_DE_DIALOGO = 320;

const JanelaDeDialogo = ({ titulo, largura = 480, papel = 'dialog', aoFechar, acoes, children }) => {
  const janelaRef = useRef(null);
  const aoFecharRef = useRef(aoFechar);
  const idDoTitulo = React.useId();
  aoFecharRef.current = aoFechar;

  useEffect(() => {
    const janela = janelaRef.current;
    if (!janela.contains(document.activeElement)) (janela.querySelector('[data-foco-inicial]') || janela).focus();
    const teclar = (eventoDeTeclado) => {
      /* Só a janela de cima responde ao teclado: um Esc nunca fecha duas. */
      const janelasAbertas = document.querySelectorAll('[aria-modal="true"]');
      if (janelasAbertas[janelasAbertas.length - 1] !== janela) return;
      if (eventoDeTeclado.key === 'Escape' && aoFecharRef.current) { aoFecharRef.current(); return; }
      if (eventoDeTeclado.key !== 'Tab') return;
      const focaveis = [...janela.querySelectorAll(SELETOR_DE_FOCAVEIS)];
      if (focaveis.length === 0) { eventoDeTeclado.preventDefault(); janela.focus(); return; }
      const primeiroFocavel = focaveis[0];
      const ultimoFocavel = focaveis[focaveis.length - 1];
      const focoAtual = document.activeElement;
      const focoFora = !janela.contains(focoAtual) || focoAtual === janela;
      if (eventoDeTeclado.shiftKey && (focoFora || focoAtual === primeiroFocavel)) { eventoDeTeclado.preventDefault(); ultimoFocavel.focus(); }
      if (!eventoDeTeclado.shiftKey && (focoFora || focoAtual === ultimoFocavel)) { eventoDeTeclado.preventDefault(); primeiroFocavel.focus(); }
    };
    window.addEventListener('keydown', teclar);
    return () => window.removeEventListener('keydown', teclar);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--veu)', zIndex: 20,
      display: 'flex', padding: 'var(--space-4)', overflowY: 'auto',
    }} onClick={() => aoFechar && aoFechar()}>
      <div
        ref={janelaRef} role={papel} aria-modal="true" aria-labelledby={idDoTitulo} tabIndex={-1}
        onClick={(eventoDeClique) => eventoDeClique.stopPropagation()}
        style={{
          width: largura, maxWidth: '100%', maxHeight: `max(100%, ${ALTURA_MINIMA_DA_JANELA_DE_DIALOGO}px)`, margin: 'auto',
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
          /* O foco na janela inteira é só o ponto de partida do teclado: não ganha contorno. */
          outline: 'none',
        }}
      >
        <h2 id={idDoTitulo} style={{ margin: 0, fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>{titulo}</h2>
        {/* O miolo rola; a folga em volta (devolvida pela margem negativa) guarda o contorno de foco do corte. */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minHeight: 0, overflowY: 'auto',
          margin: 'calc(-1 * var(--space-1)) calc(-1 * var(--space-5))', padding: 'var(--space-1) var(--space-5)',
        }}>
          {children}
        </div>
        {acoes}
      </div>
    </div>
  );
};

/* ---------- Tecla ---------- */
const Tecla = ({ children }) => (
  <kbd style={{
    display: 'inline-block', minWidth: 22, textAlign: 'center',
    padding: '1px var(--space-1)', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-strong)', background: 'var(--surface-2)',
    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--fg)',
  }}>{children}</kbd>
);

/* ---------- Etiqueta ----------
   Marca curta ao lado de um valor ou de um campo. O texto diz tudo; o tom é reforço.
   `podeQuebrar` serve à etiqueta longa, que precisa caber numa coluna estreita. */
const TONS_DA_ETIQUETA = {
  ok: { fundo: 'var(--ok-soft)', texto: 'var(--ok-fg)' },
  atencao: { fundo: 'var(--warn-soft)', texto: 'var(--nivel-aviso-fg)' },
  destaque: { fundo: 'var(--accent-soft)', texto: 'var(--fg)' },
  neutro: { fundo: 'var(--surface-2)', texto: 'var(--fg)' },
};

const Etiqueta = ({ tom = 'neutro', podeQuebrar, children }) => {
  const coresDoTom = TONS_DA_ETIQUETA[tom] || TONS_DA_ETIQUETA.neutro;
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, padding: '1px var(--space-2)',
      borderRadius: podeQuebrar ? 'var(--radius-sm)' : 'var(--radius-full)',
      whiteSpace: podeQuebrar ? 'normal' : 'nowrap',
      background: coresDoTom.fundo, color: coresDoTom.texto,
    }}>{children}</span>
  );
};

/* ---------- Foco de volta ao fechar um painel ----------
   Quando o painel que abre embaixo de um botão fecha (Esc, aplicar, escolher), o foco volta
   ao botão que o abriu, se ficou sem dono: quem usa o teclado não perde o lugar. O clique
   fora leva o foco para onde a pessoa clicou, e ali ele fica.
   `painelAberto` é o nome do painel aberto (ou nada); `botoes`, a referência do botão de cada um. */
const useFocoDeVoltaAoFechar = (painelAberto, botoes) => {
  const painelAbertoAntesRef = useRef(painelAberto);
  useEffect(() => {
    const painelAbertoAntes = painelAbertoAntesRef.current;
    painelAbertoAntesRef.current = painelAberto;
    if (!painelAbertoAntes || painelAberto) return;
    const focoSemDono = !document.activeElement || document.activeElement === document.body;
    if (focoSemDono) botoes[painelAbertoAntes]?.current?.focus();
  }, [painelAberto]);
};

/* ---------- Faixa fixa no topo da área que rola ----------
   O aviso de sem internet fica à vista enquanto a tela rola. A área que rola ganha a
   folga do tamanho da faixa, para o foco do teclado nunca parar debaixo dela. */
const FaixaFixa = ({ children }) => {
  const faixaRef = useRef(null);
  useEffect(() => {
    const faixa = faixaRef.current;
    let areaQueRola = faixa?.parentElement;
    while (areaQueRola && !/(auto|scroll)/.test(getComputedStyle(areaQueRola).overflowY)) areaQueRola = areaQueRola.parentElement;
    if (!areaQueRola) return undefined;
    areaQueRola.style.scrollPaddingTop = `${faixa.offsetHeight}px`;
    return () => { areaQueRola.style.scrollPaddingTop = ''; };
  }, []);
  return <div ref={faixaRef} style={{ position: 'sticky', top: 0, zIndex: 5 }}>{children}</div>;
};

/* ---------- Dica ao passar o mouse ou focar ----------
   A explicação aparece com o mouse e com o foco do teclado, some com Esc e fica ligada ao
   alvo por `aria-describedby`: leitor de tela lê a dica junto do alvo (não depende de
   `title`). `mostrar` deixa a dica aberta, para a conferência dos estados. */
const LARGURA_DA_DICA = 280;

const ComDica = ({ dica, alinharADireita, mostrar, children }) => {
  const [visivel, setVisivel] = useState(false);
  const [abreParaBaixo, setAbreParaBaixo] = useState(false);
  const alvoRef = useRef(null);
  const dicaRef = useRef(null);
  const idDaDica = React.useId();
  const aberta = visivel || Boolean(mostrar);

  /* A dica abre para cima. Sem lugar acima dentro da área que rola (o alvo encostado no
     topo), ela abre para baixo: assim nunca fica cortada. */
  React.useLayoutEffect(() => {
    if (!aberta || !alvoRef.current || !dicaRef.current) return;
    let areaQueCorta = alvoRef.current.parentElement;
    while (areaQueCorta && !/(auto|scroll|hidden)/.test(getComputedStyle(areaQueCorta).overflowY)) areaQueCorta = areaQueCorta.parentElement;
    const topoDaArea = areaQueCorta ? Math.max(0, areaQueCorta.getBoundingClientRect().top) : 0;
    const espacoAcima = alvoRef.current.getBoundingClientRect().top - topoDaArea;
    setAbreParaBaixo(espacoAcima < dicaRef.current.offsetHeight + alvoRef.current.offsetHeight);
  }, [aberta]);

  return (
    <span
      ref={alvoRef}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisivel(true)} onMouseLeave={() => setVisivel(false)}
      onFocus={() => setVisivel(true)} onBlur={() => setVisivel(false)}
      onKeyDown={(eventoDeTeclado) => {
        if (eventoDeTeclado.key !== 'Escape' || !visivel) return;
        eventoDeTeclado.stopPropagation();
        setVisivel(false);
      }}
    >
      <span
        tabIndex={0} role="note" aria-describedby={idDaDica}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', borderRadius: 'var(--radius-sm)', cursor: 'help' }}
      >
        {children}
      </span>
      <span ref={dicaRef} role="tooltip" id={idDaDica} style={{
        display: aberta ? 'block' : 'none', position: 'absolute', zIndex: 8,
        ...(abreParaBaixo ? { top: 'calc(100% + var(--space-1))' } : { bottom: 'calc(100% + var(--space-1))' }),
        left: alinharADireita ? 'auto' : 0, right: alinharADireita ? 0 : 'auto', width: LARGURA_DA_DICA,
        padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
        background: 'var(--toast-bg)', color: 'var(--toast-fg)',
        fontSize: 12.5, fontWeight: 600, lineHeight: 1.4, textAlign: 'left', whiteSpace: 'normal',
      }}>{dica}</span>
    </span>
  );
};

/* ---------- Botão de copiar ----------
   Copia um texto e confirma no próprio botão, com a confirmação anunciada a leitor de
   tela. No protótipo a confirmação aparece sempre; no painel, só quando o navegador aceita. */
const SEGUNDOS_DA_CONFIRMACAO_DE_COPIA = 2;

/* `focoInicial` faz o foco entrar neste botão quando ele abre dentro de uma JanelaDeDialogo. */
const BotaoDeCopiar = ({ rotulo, rotuloCopiado, texto, disabled, className, focoInicial }) => {
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!copiado) return undefined;
    const temporizador = setTimeout(() => setCopiado(false), SEGUNDOS_DA_CONFIRMACAO_DE_COPIA * 1000);
    return () => clearTimeout(temporizador);
  }, [copiado]);
  const copiar = () => {
    try {
      const copia = navigator.clipboard?.writeText(texto);
      copia?.catch(() => {});
    } catch { /* sem área de transferência neste navegador */ }
    setCopiado(true);
  };
  return (
    <React.Fragment>
      <Button variant="secondary" compacto disabled={disabled} className={className} onClick={copiar} data-foco-inicial={focoInicial && !disabled ? true : undefined}>
        {copiado ? <IconCheck size={14} /> : <IconCopy size={14} />}
        {copiado ? rotuloCopiado : rotulo}
      </Button>
      <span role="status" aria-live="polite" className="so-leitor">{copiado ? rotuloCopiado : ''}</span>
    </React.Fragment>
  );
};

/* ---------- Lista de fatos ----------
   Pares "nome: valor" alinhados (o que a busca olhou, os horários de um evento).
   `emCaixa` destaca a lista do resto, como no estado vazio. */
const ListaDeFatos = ({ fatos, emCaixa }) => (
  <dl style={{
    margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-2) var(--space-4)',
    textAlign: 'left', fontSize: 13,
    ...(emCaixa ? { padding: 'var(--space-3) var(--space-4)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' } : {}),
  }}>
    {fatos.map(([nomeDoFato, valorDoFato]) => (
      <React.Fragment key={nomeDoFato}>
        <dt style={{ fontWeight: 700, color: 'var(--muted)' }}>{nomeDoFato}</dt>
        <dd style={{ margin: 0, minWidth: 0 }}>{valorDoFato}</dd>
      </React.Fragment>
    ))}
  </dl>
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
