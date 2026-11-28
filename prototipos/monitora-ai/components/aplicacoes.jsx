// Monitora AI — Aplicações e chaves de envio (Prototipar aplicações e chaves de envio).
// A rotina é só do Administrador: ver o produto que já existe, cadastrar uma aplicação no
// ambiente escolhido na casca, gerar a chave de envio (a chave inteira aparece uma vez só)
// e revogar uma chave. Criar produto, pessoas, retenção e auditoria ficam fora.
// É uma tela só: o cadastro, a chave gerada e a confirmação de revogar abrem por cima da
// lista. Tudo mora no endereço (a aplicação, a chave e o passo); a lista é o cenário de
// data.jsx mais o que o endereço diz que acabou de acontecer. O painel nunca tem a chave
// inteira de uma chave antiga: só o começo.

const PASSO_NOVA = 'nova';
const PASSO_GERADA = 'gerada';
const PASSO_REVOGAR = 'revogar';
const PASSO_REVOGADA = 'revogada';
const LARGURA_DA_JANELA_DE_PEDIDO = 520;
const LARGURA_DA_JANELA_DA_CHAVE = 580;
const MAXIMO_DE_LETRAS_DO_NOME = 60;
/* A altura do botão "Cadastrar aplicação": o título não sobe quando o botão não está. */
const ALTURA_DA_LINHA_DO_TITULO = 32;
const ESTADOS_COM_O_PEDIDO_JA_ESCRITO = ['loading', 'error', 'offline'];
const ESTADOS_SEM_A_CHAVE_GERADA = ['loading', 'error'];
const LARGURAS_DAS_COLUNAS_DE_CHAVE = ['28%', '25%', '16%', '19%', '12%'];
const ESTILO_DO_TITULO_DE_COLUNA = {
  padding: 'var(--space-2) var(--space-3)', textAlign: 'left', borderBottom: '1px solid var(--border-strong)',
  fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)',
};
const ESTILO_DA_CELULA_DE_CHAVE = { padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border)', fontSize: 13, verticalAlign: 'middle' };
const ESTILO_DO_RODAPE_DA_JANELA = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' };
const ESTILO_DA_NOTA_DE_ESPERA = { margin: 0, fontSize: 13, fontWeight: 600 };

/* O nome e o apelido que a pessoa escreveu, para a tela seguinte dizer o mesmo. Ficam só na
   memória da página: o endereço leva o código da aplicação e o da chave. */
const ESCRITO_NO_PEDIDO = { nomesDeAplicacao: {}, apelidosDeChave: {} };

const lembrarOPedido = ({ idDaAplicacao, nomeDaAplicacao, idDaChave, apelido }) => {
  if (nomeDaAplicacao) ESCRITO_NO_PEDIDO.nomesDeAplicacao[idDaAplicacao] = nomeDaAplicacao;
  ESCRITO_NO_PEDIDO.apelidosDeChave[`${idDaAplicacao}/${idDaChave}`] = apelido;
};

const nomeLembradoDaAplicacao = (idDaAplicacao) => ESCRITO_NO_PEDIDO.nomesDeAplicacao[idDaAplicacao]
  || (idDaAplicacao === APLICACAO_DO_EXEMPLO_DE_CADASTRO.id ? APLICACAO_DO_EXEMPLO_DE_CADASTRO.nome : idDaAplicacao);

/* ---------- As aplicações e as chaves (simulado) ---------- */

const chaveEstaAtiva = (chave) => !chave.revogadaEm;

const comecoDaChave = (idDoAmbiente, chave) =>
  `${PREFIXO_DA_CHAVE_POR_AMBIENTE[idDoAmbiente] || PREFIXO_DA_CHAVE_POR_AMBIENTE.producao}${chave.id}`;

/* A chave inteira do protótipo: traz escrito que é exemplo. */
const chaveInteiraDeExemplo = (idDoAmbiente, chave) => `${comecoDaChave(idDoAmbiente, chave)}${RESTO_DA_CHAVE_SINTETICA}`;

/* O código da aplicação no endereço, a partir do nome escrito. */
const codigoDoNomeDaAplicacao = (nomeDaAplicacao) => nomeDaAplicacao.trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'aplicacao';

/* A lista do ambiente: o cenário, mais o que o endereço diz que acabou de acontecer (a
   aplicação cadastrada, que entra no topo para ficar à vista; a chave gerada; a chave revogada). `chaveJaGerada` é falso enquanto
   a geração não terminou ou falhou: aí nada foi criado. */
const montarAplicacoes = ({ idDoProduto, idDoAmbiente, idDaAplicacao, idDaChave, passo, chaveJaGerada }) => {
  const cadastradas = (APLICACOES_CADASTRADAS[idDoProduto] || {})[idDoAmbiente] || [];
  const enderecoTrazChaveGerada = Boolean(idDaAplicacao) && Boolean(idDaChave) && idDaChave !== PASSO_NOVA
    && (!passo || passo === PASSO_GERADA) && chaveJaGerada;
  const aplicacaoAcabouDeNascer = enderecoTrazChaveGerada && !cadastradas.some((aplicacao) => aplicacao.id === idDaAplicacao);
  const aplicacoes = aplicacaoAcabouDeNascer
    ? [{ id: idDaAplicacao, nome: nomeLembradoDaAplicacao(idDaAplicacao), chaves: [] }, ...cadastradas]
    : cadastradas;

  return aplicacoes.map((aplicacao) => {
    const ehADoEndereco = aplicacao.id === idDaAplicacao;
    const faltaAChaveGerada = ehADoEndereco && enderecoTrazChaveGerada && !aplicacao.chaves.some((chave) => chave.id === idDaChave);
    const chavesComAGerada = faltaAChaveGerada
      ? [...aplicacao.chaves, {
        id: idDaChave, apelido: ESCRITO_NO_PEDIDO.apelidosDeChave[`${idDaAplicacao}/${idDaChave}`] || '',
        criadaEm: RELOGIO_DO_PAINEL.agora, criadaPor: PESSOA_EXEMPLO.nome, ultimoEnvioEm: null,
      }]
      : aplicacao.chaves;
    const chaves = chavesComAGerada.map((chave) => (ehADoEndereco && passo === PASSO_REVOGADA && chave.id === idDaChave && chaveEstaAtiva(chave)
      ? { ...chave, revogadaEm: RELOGIO_DO_PAINEL.agora, revogadaPor: PESSOA_EXEMPLO.nome }
      : chave));
    return { ...aplicacao, chaves, chavesAtivas: chaves.filter(chaveEstaAtiva).length };
  });
};

/* O miolo da próxima chave gerada: o primeiro que nenhuma chave do ambiente usa. */
const mioloDaProximaChave = (aplicacoes) => {
  const miolosUsados = aplicacoes.flatMap((aplicacao) => aplicacao.chaves.map((chave) => chave.id));
  return MIOLOS_DE_CHAVE_GERADA.find((miolo) => !miolosUsados.includes(miolo)) || `ex${miolosUsados.length}z`;
};

/* ---------- Textos derivados ---------- */
const nomeDaChave = (traduzir, idDoAmbiente, chave) => chave.apelido || traduzir('chaveComeco', { comeco: comecoDaChave(idDoAmbiente, chave) });

const textoDeDataEPessoa = (traduzir, instante, nomeDaPessoa) => traduzir('chaveDataEPessoa', { data: formatarDataEHora(instante), pessoa: nomeDaPessoa });

const textoDoUltimoEnvio = (traduzir, chave) => (chave.ultimoEnvioEm ? formatarDataEHora(chave.ultimoEnvioEm) : traduzir('chaveAindaNaoEnviou'));

/* ---------- A lista ---------- */

const FatoDoResumo = ({ nome, valor }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
    <dt style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>{nome}</dt>
    <dd style={{ margin: 0, fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{valor}</dd>
  </div>
);

/* O produto que já existe, visto pelo ambiente da casca. Criar produto não é desta rotina. */
const ResumoDoProduto = ({ traduzir, nomeDoProduto, nomeDoAmbiente, aplicacoes, semNumeros }) => (
  <section aria-label={traduzir('aplicacoesResumo')} style={{ ...ESTILO_DA_CAIXA, padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
    <dl style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1) var(--space-5)' }}>
      <FatoDoResumo nome={traduzir('cascaProduto')} valor={nomeDoProduto} />
      <FatoDoResumo nome={traduzir('cascaAmbiente')} valor={nomeDoAmbiente} />
      {!semNumeros && <FatoDoResumo nome={traduzir('aplicacoesFatoAplicacoes')} valor={formatarQuantidade(aplicacoes.length)} />}
      {!semNumeros && (
        <FatoDoResumo
          nome={traduzir('aplicacoesFatoChavesAtivas')}
          valor={formatarQuantidade(aplicacoes.reduce((somaDeAtivas, aplicacao) => somaDeAtivas + aplicacao.chavesAtivas, 0))}
        />
      )}
    </dl>
    <p style={{ ...ESTILO_DO_TEXTO_DE_APOIO, maxWidth: 940 }}>{traduzir('aplicacoesComoFunciona', { ambiente: nomeDoAmbiente })}</p>
  </section>
);

const LinhaDeChave = ({ traduzir, aplicacao, chave, idDoAmbiente, indisponivel, motivoDaEspera, classeDoRevogar, aoRevogar }) => {
  const ativa = chaveEstaAtiva(chave);
  const corDoTexto = ativa ? 'var(--fg)' : 'var(--muted)';
  return (
    <tr>
      <td style={{ ...ESTILO_DA_CELULA_DE_CHAVE, color: corDoTexto }}>
        <div style={{ fontWeight: 700 }}>{chave.apelido || <span style={{ fontWeight: 600, color: 'var(--muted)' }}>{traduzir('chaveSemApelido')}</span>}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{traduzir('chaveComeco', { comeco: comecoDaChave(idDoAmbiente, chave) })}</div>
      </td>
      <td style={{ ...ESTILO_DA_CELULA_DE_CHAVE, color: corDoTexto, fontVariantNumeric: 'tabular-nums' }}>
        {textoDeDataEPessoa(traduzir, chave.criadaEm, chave.criadaPor)}
      </td>
      <td style={{ ...ESTILO_DA_CELULA_DE_CHAVE, color: corDoTexto, fontVariantNumeric: 'tabular-nums' }}>{textoDoUltimoEnvio(traduzir, chave)}</td>
      <td style={{ ...ESTILO_DA_CELULA_DE_CHAVE, color: corDoTexto }}>
        {ativa
          ? <Etiqueta tom="ok">{traduzir('chaveAtiva')}</Etiqueta>
          : (
            <React.Fragment>
              <Etiqueta>{traduzir('chaveRevogada')}</Etiqueta>
              <div style={{ fontSize: 12, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {traduzir('chaveRevogadaEm', { data: formatarDataEHora(chave.revogadaEm), pessoa: chave.revogadaPor })}
              </div>
            </React.Fragment>
          )}
      </td>
      <td style={{ ...ESTILO_DA_CELULA_DE_CHAVE, textAlign: 'right' }}>
        {ativa && (
          <Button
            variant="secondary" compacto disabled={indisponivel} title={motivoDaEspera} className={classeDoRevogar} onClick={aoRevogar}
            aria-label={traduzir('chaveRevogarRotulo', { chave: nomeDaChave(traduzir, idDoAmbiente, chave), aplicacao: aplicacao.nome })}
          >
            {traduzir('chaveRevogar')}
          </Button>
        )}
      </td>
    </tr>
  );
};

/* Uma aplicação e as suas chaves neste ambiente. Com duas chaves ativas, "Gerar chave"
   fica apagado e a caixa diz por quê, por escrito. */
const CaixaDaAplicacao = ({ traduzir, aplicacao, idDoAmbiente, nomeDoAmbiente, indisponivel, motivoDaEspera, classeDoRevogar, aoGerar, aoRevogar }) => {
  const idDaNotaDoLimite = React.useId();
  const noLimite = aplicacao.chavesAtivas >= LIMITE_DE_CHAVES_ATIVAS;
  const idDaPrimeiraChaveAtiva = aplicacao.chaves.find(chaveEstaAtiva)?.id;
  return (
    <section aria-label={aplicacao.nome} style={ESTILO_DA_CAIXA}>
      <div style={ESTILO_DA_BARRA_DA_CAIXA}>
        <h2 style={{ ...ESTILO_DO_TITULO_DA_CAIXA, fontSize: 15 }}>{aplicacao.nome}</h2>
        <Etiqueta tom={aplicacao.chavesAtivas === 0 ? 'atencao' : 'neutro'}>
          {traduzir('aplicacaoChavesAtivas', { ativas: aplicacao.chavesAtivas, limite: LIMITE_DE_CHAVES_ATIVAS })}
        </Etiqueta>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {noLimite && (
            <span id={idDaNotaDoLimite} style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              {traduzir('chaveLimiteNota', { limite: LIMITE_DE_CHAVES_ATIVAS })}
            </span>
          )}
          <Button
            variant="secondary" compacto disabled={indisponivel || noLimite} onClick={aoGerar}
            title={noLimite ? undefined : motivoDaEspera} aria-describedby={noLimite ? idDaNotaDoLimite : undefined}
            aria-label={traduzir('chaveGerarPara', { aplicacao: aplicacao.nome })}
          >
            <IconPlus size={14} />
            {traduzir('chaveGerar')}
          </Button>
        </div>
      </div>
      {aplicacao.chavesAtivas === 0 && (
        <p style={{ margin: 0, padding: 'var(--space-2) var(--space-3)', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)', background: 'var(--warn-soft)' }}>
          {traduzir('aplicacaoSemChaveAtiva', { ambiente: nomeDoAmbiente })}
        </p>
      )}
      <table aria-label={traduzir('chavesTabela', { aplicacao: aplicacao.nome })} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          {LARGURAS_DAS_COLUNAS_DE_CHAVE.map((larguraDaColuna, indiceDaColuna) => <col key={indiceDaColuna} style={{ width: larguraDaColuna }} />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('chaveColunaChave')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('chaveColunaCriada')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('chaveColunaUltimoEnvio')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('chaveColunaSituacao')}</th>
            <th scope="col" style={{ ...ESTILO_DO_TITULO_DE_COLUNA, textAlign: 'right' }}>{traduzir('chaveColunaAcao')}</th>
          </tr>
        </thead>
        <tbody>
          {aplicacao.chaves.map((chave) => (
            <LinhaDeChave
              key={chave.id} traduzir={traduzir} aplicacao={aplicacao} chave={chave} idDoAmbiente={idDoAmbiente}
              indisponivel={indisponivel} motivoDaEspera={motivoDaEspera}
              classeDoRevogar={chave.id === idDaPrimeiraChaveAtiva ? classeDoRevogar : undefined}
              aoRevogar={() => aoRevogar(chave)}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
};

/* ---------- As janelas ---------- */

/* Cadastrar aplicação (sem `aplicacao`) ou pedir mais uma chave para uma que já existe. O
   ambiente é o da casca e vem dito por escrito. Ao confirmar, a chave é gerada e a janela
   seguinte mostra a chave inteira, uma vez só. */
const JanelaDePedirChave = ({ traduzir, aplicacao, nomeDoProduto, nomeDoAmbiente, estado, classeDoBotao, nomeEscrito, apelidoEscrito, recusa, aoEscreverNome, aoEscreverApelido, aoConfirmar, aoFechar }) => {
  const gerando = estado === 'loading';
  const semInternet = estado === 'offline';
  const parado = estado === 'disabled' || gerando;
  const ehCadastro = !aplicacao;
  const confirmarComEnter = (eventoDeTeclado) => { if (eventoDeTeclado.key === 'Enter') aoConfirmar(); };
  return (
    <JanelaDeDialogo
      largura={LARGURA_DA_JANELA_DE_PEDIDO} aoFechar={aoFechar}
      titulo={ehCadastro
        ? traduzir('aplicacaoNovaTitulo', { produto: nomeDoProduto, ambiente: nomeDoAmbiente })
        : traduzir('chaveNovaTitulo', { aplicacao: aplicacao.nome, ambiente: nomeDoAmbiente })}
    >
      <p style={{ ...ESTILO_DO_TEXTO_DE_APOIO, fontSize: 13 }}>
        {ehCadastro ? traduzir('aplicacaoNovaAmbienteNota', { ambiente: nomeDoAmbiente }) : traduzir('chaveNovaNota')}
      </p>
      {estado === 'error' && (
        <AvisoDeErro
          titulo={traduzir(ehCadastro ? 'aplicacaoNovaFalhaTitulo' : 'chaveNovaFalhaTitulo')}
          corpo={traduzir(ehCadastro ? 'aplicacaoNovaFalhaCorpo' : 'chaveNovaFalhaCorpo')}
          acao={<div><Button variant="secondary" compacto onClick={aoConfirmar}>{traduzir('tentarDeNovo')}</Button></div>}
        />
      )}
      {ehCadastro && (
        <Field
          label={traduzir('aplicacaoNovaNome')} value={nomeEscrito} onChange={aoEscreverNome} focarAoAbrir disabled={parado}
          placeholder={traduzir('aplicacaoNovaNomeExemplo')} dica={traduzir('aplicacaoNovaNomeDica')} error={recusa}
          maximoDeLetras={MAXIMO_DE_LETRAS_DO_NOME} autoComplete="off" aoTeclar={confirmarComEnter}
        />
      )}
      <Field
        label={traduzir('chaveApelido')} value={apelidoEscrito} onChange={aoEscreverApelido} focarAoAbrir={!ehCadastro} disabled={parado}
        placeholder={traduzir('chaveApelidoExemplo')} dica={traduzir('chaveApelidoDica')}
        maximoDeLetras={MAXIMO_DE_LETRAS_DO_NOME} autoComplete="off" aoTeclar={confirmarComEnter}
      />
      {ehCadastro && <p style={ESTILO_DO_TEXTO_DE_APOIO}>{traduzir('aplicacaoNovaProximoPasso')}</p>}
      {semInternet && <p role="status" style={ESTILO_DA_NOTA_DE_ESPERA}>{traduzir(ehCadastro ? 'aplicacaoNovaSemInternet' : 'chaveNovaSemInternet')}</p>}
      <div style={ESTILO_DO_RODAPE_DA_JANELA}>
        <Button variant="secondary" disabled={estado === 'disabled'} onClick={aoFechar}>{traduzir('cancelar')}</Button>
        <Button variant="primary" loading={gerando} disabled={parado || semInternet} className={classeDoBotao} onClick={aoConfirmar}>
          {gerando ? traduzir('chaveGerando') : traduzir(ehCadastro ? 'aplicacaoNovaConfirmar' : 'chaveNovaConfirmar')}
        </Button>
      </div>
    </JanelaDeDialogo>
  );
};

/* A chave inteira, uma vez só. A janela não fecha com Esc nem com o clique fora: só pelo
   botão que confirma que a chave foi guardada. Se a geração falha, nada foi criado. */
const JanelaDaChaveGerada = ({ traduzir, nomeDaAplicacao, idDoAmbiente, nomeDoAmbiente, idDaChave, estado, classeDoBotao, aoGuardar, aoTentarDeNovo, aoFechar }) => {
  const gerando = estado === 'loading';
  const desabilitado = estado === 'disabled';
  const chaveGerada = { id: idDaChave };
  const titulo = traduzir('chaveGeradaTitulo', { aplicacao: nomeDaAplicacao, ambiente: nomeDoAmbiente });

  if (estado === 'error') {
    return (
      <JanelaDeDialogo papel="alertdialog" largura={LARGURA_DA_JANELA_DA_CHAVE} titulo={titulo} aoFechar={aoFechar}>
        <AvisoDeErro
          titulo={traduzir('chaveNovaFalhaTitulo')} corpo={traduzir('chaveNovaFalhaCorpo')}
          acao={<div><Button variant="secondary" compacto onClick={aoTentarDeNovo}>{traduzir('tentarDeNovo')}</Button></div>}
        />
        <div style={ESTILO_DO_RODAPE_DA_JANELA}>
          <Button variant="secondary" data-foco-inicial onClick={aoFechar}>{traduzir('fechar')}</Button>
        </div>
      </JanelaDeDialogo>
    );
  }

  return (
    <JanelaDeDialogo papel="alertdialog" largura={LARGURA_DA_JANELA_DA_CHAVE} titulo={titulo}>
      <AvisoDeAtencao titulo={traduzir('chaveGeradaAvisoTitulo')} corpo={traduzir('chaveGeradaAvisoCorpo')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{traduzir('chaveGeradaRotulo')}</span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)',
          background: 'var(--surface-2)', border: '1px solid var(--border-control)', borderRadius: 'var(--radius-md)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {gerando
              ? <MensagemDeEstado>{traduzir('chaveGerando')}</MensagemDeEstado>
              : (
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 700, wordBreak: 'break-all', userSelect: 'all' }}>
                  {chaveInteiraDeExemplo(idDoAmbiente, chaveGerada)}
                </code>
              )}
          </div>
          <BotaoDeCopiar
            rotulo={traduzir('chaveCopiar')} rotuloCopiado={traduzir('copiado')} disabled={gerando || desabilitado}
            texto={chaveInteiraDeExemplo(idDoAmbiente, chaveGerada)} className={classeDoBotao} focoInicial
          />
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{traduzir('chaveGeradaOnde')}</span>
      </div>
      <ListaDeFatos emCaixa fatos={[
        [traduzir('campoAplicacao'), nomeDaAplicacao],
        [traduzir('cascaAmbiente'), nomeDoAmbiente],
        [traduzir('chaveFatoComeco'), gerando ? '…' : <CodigoEmDestaque>{traduzir('chaveComeco', { comeco: comecoDaChave(idDoAmbiente, chaveGerada) })}</CodigoEmDestaque>],
      ]} />
      {estado === 'offline' && <p role="status" style={ESTILO_DA_NOTA_DE_ESPERA}>{traduzir('chaveGeradaSemInternet')}</p>}
      <div style={{ ...ESTILO_DO_RODAPE_DA_JANELA, flexWrap: 'nowrap' }}>
        <span style={{ ...ESTILO_DO_TEXTO_DE_APOIO, flex: 1 }}>{traduzir('chaveGeradaSoFechaPeloBotao')}</span>
        <Button variant="primary" disabled={gerando || desabilitado} onClick={aoGuardar}>{traduzir('chaveGeradaFechar')}</Button>
      </div>
    </JanelaDeDialogo>
  );
};

/* O que não se desfaz pede confirmação com o nome e a consequência. O foco entra em
   "Cancelar": Enter sem ler não revoga. */
const JanelaDeRevogar = ({ traduzir, aplicacao, chave, idDoAmbiente, nomeDoProduto, nomeDoAmbiente, estado, classeDoBotao, aoRevogar, aoFechar }) => {
  const revogando = estado === 'loading';
  const semInternet = estado === 'offline';
  const desabilitado = estado === 'disabled';
  const ehAUnicaAtiva = aplicacao.chavesAtivas <= 1;
  return (
    <JanelaDeDialogo
      papel="alertdialog" largura={LARGURA_DA_JANELA_DE_PEDIDO} aoFechar={aoFechar}
      titulo={traduzir('chaveRevogarTitulo', { chave: nomeDaChave(traduzir, idDoAmbiente, chave), aplicacao: aplicacao.nome, produto: nomeDoProduto, ambiente: nomeDoAmbiente })}
    >
      {estado === 'error' && (
        <AvisoDeErro
          titulo={traduzir('chaveRevogarFalhaTitulo')} corpo={traduzir('chaveRevogarFalhaCorpo')}
          acao={<div><Button variant="secondary" compacto onClick={aoRevogar}>{traduzir('tentarDeNovo')}</Button></div>}
        />
      )}
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>
        {traduzir(ehAUnicaAtiva ? 'chaveRevogarConsequenciaUnica' : 'chaveRevogarConsequenciaComOutra', { aplicacao: aplicacao.nome, ambiente: nomeDoAmbiente })}
      </p>
      <ListaDeFatos emCaixa fatos={[
        [traduzir('chaveColunaChave'), <CodigoEmDestaque>{traduzir('chaveComeco', { comeco: comecoDaChave(idDoAmbiente, chave) })}</CodigoEmDestaque>],
        [traduzir('chaveColunaCriada'), textoDeDataEPessoa(traduzir, chave.criadaEm, chave.criadaPor)],
        [traduzir('chaveColunaUltimoEnvio'), textoDoUltimoEnvio(traduzir, chave)],
      ]} />
      <p style={{ ...ESTILO_DO_TEXTO_DE_APOIO, fontSize: 13 }}>{traduzir('chaveRevogarNaoVolta')}</p>
      {semInternet && <p role="status" style={ESTILO_DA_NOTA_DE_ESPERA}>{traduzir('chaveRevogarSemInternet')}</p>}
      <div style={ESTILO_DO_RODAPE_DA_JANELA}>
        <Button variant="secondary" data-foco-inicial disabled={desabilitado} onClick={aoFechar}>{traduzir('cancelar')}</Button>
        <Button variant="danger" loading={revogando} disabled={desabilitado || semInternet} className={classeDoBotao} onClick={aoRevogar}>
          {revogando ? traduzir('chaveRevogando') : traduzir('chaveRevogarConfirmar')}
        </Button>
      </div>
    </JanelaDeDialogo>
  );
};

/* ---------- A tela ---------- */
const TelaAplicacoes = ({ lang, estado, params }) => {
  const traduzir = useT(lang);
  const { navigate } = useRouter();
  const parametrosDoPainel = { ...PAINEL_DO_EXCURFLY, ...params };
  const { produto: idDoProduto, ambiente: idDoAmbiente, aplicacao: idDaAplicacao, chave: idDaChave, passo } = parametrosDoPainel;
  const rotasDoPapel = ROTAS_DO_PAPEL.administrador;
  const nomeDoProduto = nomeDoProdutoPorId(idDoProduto);
  const nomeDoAmbiente = nomeDoAmbientePorId(idDoAmbiente);
  const ondeEstou = { produto: idDoProduto, ambiente: idDoAmbiente };

  const [nomeEscrito, setNomeEscrito] = useState('');
  const [apelidoEscrito, setApelidoEscrito] = useState('');
  const [recusa, setRecusa] = useState(null);
  const tituloRef = useRef(null);
  const quemAbriuAJanelaRef = useRef(null);
  const janelaAnteriorRef = useRef(null);

  const desabilitado = estado === 'disabled';
  const semInternet = estado === 'offline';
  const indisponivel = desabilitado || semInternet;
  const estadoDemonstrado = ESTADOS_DEMONSTRADOS.includes(estado) ? estado : null;
  const classeDemonstrada = classeDoEstadoDemonstrado(estadoDemonstrado);
  const motivoDaEspera = semInternet ? traduzir('motivoSemInternet') : undefined;

  const chaveJaGerada = !(passo === PASSO_GERADA && ESTADOS_SEM_A_CHAVE_GERADA.includes(estado));
  const aplicacoes = useMemo(
    () => montarAplicacoes({ idDoProduto, idDoAmbiente, idDaAplicacao, idDaChave, passo, chaveJaGerada }),
    [idDoProduto, idDoAmbiente, idDaAplicacao, idDaChave, passo, chaveJaGerada]);
  const aplicacaoDoEndereco = aplicacoes.find((aplicacao) => aplicacao.id === idDaAplicacao) || null;
  const chaveDoEndereco = aplicacaoDoEndereco?.chaves.find((chave) => chave.id === idDaChave) || null;

  /* A janela aberta sai do endereço. Endereço que não fecha com o cenário abre só a lista. */
  const pedeMaisUmaChave = Boolean(aplicacaoDoEndereco) && idDaChave === PASSO_NOVA && !passo
    && aplicacaoDoEndereco.chavesAtivas < LIMITE_DE_CHAVES_ATIVAS;
  const janela = (!idDaAplicacao && passo === PASSO_NOVA && 'cadastro')
    || (pedeMaisUmaChave && 'maisUmaChave')
    || (Boolean(idDaAplicacao) && Boolean(idDaChave) && idDaChave !== PASSO_NOVA && passo === PASSO_GERADA && 'chaveGerada')
    || (chaveDoEndereco && chaveEstaAtiva(chaveDoEndereco) && passo === PASSO_REVOGAR && 'revogar')
    || null;
  const chaveAcabouDeSerGuardada = Boolean(chaveDoEndereco) && !passo;
  const chaveAcabouDeSerRevogada = Boolean(chaveDoEndereco) && passo === PASSO_REVOGADA;

  /* Os estados da lista. Com uma chave no endereço, a lista nunca se mostra vazia: aquela
     aplicação existe. Com uma janela aberta, carregando e erro são da janela. */
  const semAplicacoes = aplicacoes.length === 0 || (estado === 'empty' && !idDaAplicacao);
  const comErroNaLista = estado === 'error' && !janela;
  const atualizandoALista = estado === 'loading' && !janela;

  /* Abrir uma janela de pedido começa em branco; nos estados que mostram um pedido em
     andamento (gerando, falhou, sem internet), o nome do exemplo já vem escrito. */
  useEffect(() => {
    if (janela !== 'cadastro' && janela !== 'maisUmaChave') return;
    setRecusa(estado === 'empty' && janela === 'cadastro' ? traduzir('aplicacaoNovaErroVazio') : null);
    setApelidoEscrito('');
    setNomeEscrito(ESTADOS_COM_O_PEDIDO_JA_ESCRITO.includes(estado) ? APLICACAO_DO_EXEMPLO_DE_CADASTRO.nome : '');
  }, [janela, estado]);

  /* Fechada a janela, o foco volta a quem a abriu; se esse botão não existe mais (a chave
     foi revogada), vai para o título da tela. */
  useEffect(() => {
    const janelaAnterior = janelaAnteriorRef.current;
    janelaAnteriorRef.current = janela;
    if (!janelaAnterior || janela) return;
    const quemAbriu = quemAbriuAJanelaRef.current;
    if (quemAbriu?.isConnected && quemAbriu.getAttribute('aria-disabled') !== 'true') quemAbriu.focus();
    else tituloRef.current?.focus();
  }, [janela]);

  const lembrarQuemAbriu = () => { quemAbriuAJanelaRef.current = document.activeElement; };
  const voltarALista = () => navigate(rotasDoPapel.aplicacoes, ondeEstou);
  const abrirCadastro = () => { lembrarQuemAbriu(); navigate(rotasDoPapel.aplicacaoNova, { ...ondeEstou, passo: PASSO_NOVA }); };
  const abrirPedidoDeChave = (aplicacao) => { lembrarQuemAbriu(); navigate(rotasDoPapel.chave, { ...ondeEstou, aplicacao: aplicacao.id, chave: PASSO_NOVA }); };
  const abrirRevogar = (aplicacao, chave) => {
    lembrarQuemAbriu();
    navigate(rotasDoPapel.passoDaChave, { ...ondeEstou, aplicacao: aplicacao.id, chave: chave.id, passo: PASSO_REVOGAR });
  };

  const gerarAChave = (aplicacaoDaChave, nomeDaAplicacao) => {
    const idDaChaveGerada = mioloDaProximaChave(aplicacoes);
    lembrarOPedido({ idDaAplicacao: aplicacaoDaChave, nomeDaAplicacao, idDaChave: idDaChaveGerada, apelido: apelidoEscrito.trim() });
    navigate(rotasDoPapel.passoDaChave, { ...ondeEstou, aplicacao: aplicacaoDaChave, chave: idDaChaveGerada, passo: PASSO_GERADA });
  };
  /* Nome recusado: a recusa aparece no campo e o foco volta para ele, para corrigir logo. */
  const recusarONome = (textoDaRecusa) => {
    setRecusa(textoDaRecusa);
    document.querySelector('[aria-modal="true"] input')?.focus();
  };
  const cadastrar = () => {
    if (indisponivel) return;
    const nomeDaAplicacao = nomeEscrito.trim();
    if (!nomeDaAplicacao) { recusarONome(traduzir('aplicacaoNovaErroVazio')); return; }
    const codigoDaAplicacao = codigoDoNomeDaAplicacao(nomeDaAplicacao);
    const aplicacaoRepetida = aplicacoes.find((aplicacao) => aplicacao.id === codigoDaAplicacao);
    if (aplicacaoRepetida) { recusarONome(traduzir('aplicacaoNovaErroRepetido', { aplicacao: aplicacaoRepetida.nome, ambiente: nomeDoAmbiente })); return; }
    gerarAChave(codigoDaAplicacao, nomeDaAplicacao);
  };
  const pedirMaisUmaChave = () => { if (!indisponivel) gerarAChave(aplicacaoDoEndereco.id, null); };
  const guardarAChave = () => navigate(rotasDoPapel.chave, { ...ondeEstou, aplicacao: idDaAplicacao, chave: idDaChave });
  const revogar = () => {
    if (indisponivel) return;
    navigate(rotasDoPapel.passoDaChave, { ...ondeEstou, aplicacao: idDaAplicacao, chave: idDaChave, passo: PASSO_REVOGADA });
  };

  /* Trocar o ambiente ou o produto leva à lista de lá. O Investigador não tem esta tela:
     trocar o papel leva à busca de eventos. */
  const mudarOPainel = (destino) => {
    const paraOnde = { produto: destino.produto || idDoProduto, ambiente: destino.ambiente || idDoAmbiente };
    if (destino.papel === 'investigador') { navigate(ROTAS_DO_PAPEL.investigador.abertura, paraOnde); return; }
    navigate(rotasDoPapel.aplicacoes, paraOnde);
  };

  const botaoDeCadastrar = (rotulo) => (
    <Button
      variant="primary" compacto disabled={indisponivel} title={motivoDaEspera} onClick={abrirCadastro}
      className={janela ? undefined : classeDemonstrada} aria-haspopup="dialog"
    >
      <IconPlus size={14} />
      {rotulo}
    </Button>
  );

  return (
    <CascaDoPainel traduzir={traduzir} estado={estado} params={parametrosDoPainel} papel="administrador" aoMudar={mudarOPainel} itemAtual="aplicacoes">
      {semInternet && <AvisoSemInternetFixo traduzir={traduzir} chaveDoQueContinua="aplicacoesSemInternetContinua" chaveDoQueEspera="aplicacoesSemInternetEspera" />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2) var(--space-3)', flexWrap: 'wrap', minHeight: ALTURA_DA_LINHA_DO_TITULO }}>
        <h1 ref={tituloRef} tabIndex={-1} style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.2px' }}>{traduzir('aplicacoesTitulo')}</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{traduzir('aplicacoesFuso', { fuso: FUSO_DO_PAINEL.rotulo })}</span>
        {!semAplicacoes && !comErroNaLista && <div style={{ marginLeft: 'auto' }}>{botaoDeCadastrar(traduzir('aplicacoesCadastrar'))}</div>}
      </div>

      <ResumoDoProduto traduzir={traduzir} nomeDoProduto={nomeDoProduto} nomeDoAmbiente={nomeDoAmbiente} aplicacoes={aplicacoes} semNumeros={semAplicacoes || comErroNaLista} />

      {chaveAcabouDeSerGuardada && !comErroNaLista && (
        <AvisoDeAtencao
          tom="feito" titulo={traduzir('chaveGuardadaTitulo', { aplicacao: aplicacaoDoEndereco.nome })}
          corpo={traduzir('chaveGuardadaCorpo', { comeco: traduzir('chaveComeco', { comeco: comecoDaChave(idDoAmbiente, chaveDoEndereco) }) })}
        />
      )}
      {chaveAcabouDeSerRevogada && !comErroNaLista && (
        <AvisoDeAtencao
          tom="feito" titulo={traduzir('chaveRevogadaTitulo', { chave: nomeDaChave(traduzir, idDoAmbiente, chaveDoEndereco), aplicacao: aplicacaoDoEndereco.nome })}
          corpo={traduzir('chaveRevogadaCorpo', { horario: formatarHoraEMinuto(chaveDoEndereco.revogadaEm) })}
        />
      )}

      {comErroNaLista && (
        <AvisoDeErro
          titulo={traduzir('aplicacoesErroTitulo')} corpo={traduzir('aplicacoesErroCorpo')}
          acao={<div><Button variant="secondary" compacto onClick={() => {}}>{traduzir('tentarDeNovo')}</Button></div>}
        />
      )}

      {atualizandoALista && !semAplicacoes && (
        <section style={{ ...ESTILO_DA_CAIXA, display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-2)' }}>
          <MensagemDeEstado>{traduzir('aplicacoesCarregando')}</MensagemDeEstado>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{traduzir('aplicacoesCarregandoNota')}</span>
        </section>
      )}

      {!comErroNaLista && semAplicacoes && (
        <section style={ESTILO_DA_CAIXA}>
          <EmptyState
            title={traduzir('aplicacoesVazioTitulo', { ambiente: nomeDoAmbiente })}
            body={traduzir('aplicacoesVazioCorpo', { ambiente: nomeDoAmbiente })}
            detalhes={<ListaDeFatos emCaixa fatos={[[traduzir('cascaProduto'), nomeDoProduto], [traduzir('cascaAmbiente'), nomeDoAmbiente]]} />}
            acoes={botaoDeCadastrar(traduzir('aplicacoesVazioCta'))}
          />
        </section>
      )}

      {!comErroNaLista && !semAplicacoes && aplicacoes.map((aplicacao) => (
        <CaixaDaAplicacao
          key={aplicacao.id} traduzir={traduzir} aplicacao={aplicacao} idDoAmbiente={idDoAmbiente} nomeDoAmbiente={nomeDoAmbiente}
          indisponivel={indisponivel} motivoDaEspera={motivoDaEspera}
          classeDoRevogar={!janela && aplicacao.id === aplicacoes[0].id ? classeDemonstrada : undefined}
          aoGerar={() => abrirPedidoDeChave(aplicacao)} aoRevogar={(chave) => abrirRevogar(aplicacao, chave)}
        />
      ))}

      {(janela === 'cadastro' || janela === 'maisUmaChave') && (
        <JanelaDePedirChave
          key={janela} traduzir={traduzir} aplicacao={janela === 'maisUmaChave' ? aplicacaoDoEndereco : null}
          nomeDoProduto={nomeDoProduto} nomeDoAmbiente={nomeDoAmbiente} estado={estado} classeDoBotao={classeDemonstrada}
          nomeEscrito={nomeEscrito} apelidoEscrito={apelidoEscrito} recusa={recusa}
          aoEscreverNome={(nomeNovo) => { setNomeEscrito(nomeNovo); setRecusa(null); }} aoEscreverApelido={setApelidoEscrito}
          aoConfirmar={janela === 'cadastro' ? cadastrar : pedirMaisUmaChave} aoFechar={voltarALista}
        />
      )}
      {janela === 'chaveGerada' && (
        <JanelaDaChaveGerada
          key={estado === 'error' ? 'falhou' : 'gerada'} traduzir={traduzir}
          nomeDaAplicacao={aplicacaoDoEndereco?.nome || nomeLembradoDaAplicacao(idDaAplicacao)}
          idDoAmbiente={idDoAmbiente} nomeDoAmbiente={nomeDoAmbiente} idDaChave={idDaChave} estado={estado} classeDoBotao={classeDemonstrada}
          aoGuardar={guardarAChave} aoTentarDeNovo={() => {}} aoFechar={voltarALista}
        />
      )}
      {janela === 'revogar' && (
        <JanelaDeRevogar
          traduzir={traduzir} aplicacao={aplicacaoDoEndereco} chave={chaveDoEndereco} idDoAmbiente={idDoAmbiente}
          nomeDoProduto={nomeDoProduto} nomeDoAmbiente={nomeDoAmbiente} estado={estado} classeDoBotao={classeDemonstrada}
          aoRevogar={revogar} aoFechar={voltarALista}
        />
      )}
    </CascaDoPainel>
  );
};

const TelaAplicacoesAdministrador = TelaAplicacoes;
