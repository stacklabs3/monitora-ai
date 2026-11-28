// Monitora AI — Saúde do envio (Prototipar a saúde do envio).
// O Investigador e o Administrador conferem, por aplicação: até que horário os dados já
// aparecem na busca, as perdas de evento com horário e motivo, o que falta na numeração de
// cada execução e a execução que sumiu sem se despedir. A tela só lê: ninguém escreve aqui.
// As aplicações são as cadastradas no ambiente da casca; as execuções e as perdas vêm de
// data.jsx, a mesma fonte dos avisos da busca e da tentativa. O período e a aplicação aberta
// moram no endereço. A única perda sem número é a da execução que sumiu: ela é sinalizada,
// nunca contada. Período sem dados depois de restaurar um backup fica fora desta rotina.

const PERIODO_DE_ABERTURA_DA_SAUDE = '24h';
const PERIODO_MAIOR_DA_SAUDE = '7d';
const MINUTOS_EM_VOLTA_DA_PERDA = 5;
const LARGURAS_DAS_COLUNAS_DE_SAUDE = ['8%', '23%', '10%', '10%', '14%', '25%', '10%'];
const LARGURAS_DAS_COLUNAS_DE_EXECUCAO = ['14%', '8%', '11%', '32%', '11%', '14%', '10%'];
const LARGURAS_DAS_COLUNAS_DE_PERDA = ['15%', '19%', '17%', '19%', '30%'];
const COLUNAS_DA_CONTA_E_DAS_PERDAS = 'minmax(0, 5fr) minmax(0, 6fr)';
const ESTILO_DO_SUBTITULO_DA_SAUDE = { margin: 0, fontSize: 13.5, fontWeight: 800 };
const ESTILO_DA_CELULA_DE_NUMERO = { ...ESTILO_DA_CELULA_DE_CHAVE, fontVariantNumeric: 'tabular-nums' };

/* A situação nunca é só cor: a etiqueta traz o texto, e o tom é reforço. */
const TOM_DA_SITUACAO_DE_EXECUCAO = { enviando: 'ok', sumiu: 'atencao', encerrou: 'neutro' };
const CHAVE_DA_SITUACAO_DE_EXECUCAO = { enviando: 'saudeSituacaoEnviando', sumiu: 'saudeSituacaoSumiu', encerrou: 'saudeSituacaoEncerrou' };
/* O que pede atenção vem primeiro. */
const ORDEM_DAS_SITUACOES_DE_EXECUCAO = ['sumiu', 'enviando', 'encerrou'];

/* ---------- A saúde do envio do ambiente (simulado) ---------- */

const situacaoDaExecucao = (execucao) => {
  if (execucao.sumiu) return 'sumiu';
  return execucao.encerradaEm ? 'encerrou' : 'enviando';
};

/* A execução conta para o período se estava de pé em algum momento dele. */
const execucaoEstavaDePeNoPeriodo = (execucao, periodo) => execucao.iniciadaEm <= periodo.fim
  && (situacaoDaExecucao(execucao) === 'enviando' || execucao.ultimoInformeEm >= periodo.inicio);

const somarQuantidades = (perdas) => perdas.reduce((quantidadeSomada, perda) => quantidadeSomada + perda.quantidade, 0);

/* A conta de uma execução: o que falta é o último número informado menos o que o servidor
   recebeu. O que falta e já tem perda informada não é contado de novo; o resto é "motivo
   desconhecido". Vale desde o início da execução. */
const contaDaExecucao = (execucao) => {
  const perdasDaExecucao = PERDAS_INFORMADAS.filter((perda) => perda.execucao === execucao.execucao);
  const faltando = execucao.ultimoNumeroInformado - execucao.eventosRecebidos;
  const comMotivo = Math.min(faltando, somarQuantidades(perdasDaExecucao));
  return { faltando, comMotivo, motivoDesconhecido: faltando - comMotivo, motivos: semRepetir(perdasDaExecucao.map((perda) => perda.motivo)) };
};

/* Uma linha por aplicação cadastrada no ambiente, com as execuções que estavam de pé no
   período (a que informou por último vem primeiro) e as perdas informadas nele. */
const montarSaudeDoAmbiente = ({ idDoProduto, idDoAmbiente, periodo }) => {
  const aplicacoesCadastradas = APLICACOES_CADASTRADAS[idDoProduto]?.[idDoAmbiente] || [];
  const execucoesDoAmbiente = SITUACAO_DAS_EXECUCOES[idDoProduto]?.[idDoAmbiente] || [];
  return aplicacoesCadastradas.map((aplicacaoCadastrada) => {
    const execucoesDaAplicacao = execucoesDoAmbiente
      .filter((execucao) => execucao.idDaAplicacao === aplicacaoCadastrada.id)
      .sort((execucaoAnterior, execucaoSeguinte) => execucaoSeguinte.ultimoInformeEm - execucaoAnterior.ultimoInformeEm);
    const execucoesNoPeriodo = execucoesDaAplicacao
      .filter((execucao) => execucaoEstavaDePeNoPeriodo(execucao, periodo))
      .map((execucao) => ({ dados: execucao, situacao: situacaoDaExecucao(execucao), conta: contaDaExecucao(execucao) }));
    const codigosDasExecucoes = execucoesDaAplicacao.map((execucao) => execucao.execucao);
    const perdasDaAplicacao = PERDAS_INFORMADAS.filter((perda) => codigosDasExecucoes.includes(perda.execucao));
    const perdasNoPeriodo = perdasDaAplicacao
      .filter((perda) => perda.informadaEm >= periodo.inicio && perda.informadaEm <= periodo.fim)
      .sort((perdaAnterior, perdaSeguinte) => perdaSeguinte.informadaEm - perdaAnterior.informadaEm);
    const ultimoEnvioEm = execucoesDaAplicacao.length > 0 ? execucoesDaAplicacao[0].ultimoInformeEm : null;
    return {
      id: aplicacaoCadastrada.id, nome: aplicacaoCadastrada.nome,
      nuncaEnviou: execucoesDaAplicacao.length === 0,
      execucoesNoPeriodo, perdasNoPeriodo, ultimoEnvioEm,
      /* O que a aplicação mandou depois do "dados até" foi aceito, mas ainda não aparece. */
      dadosAte: ultimoEnvioEm === null ? null : Math.min(ultimoEnvioEm, RELOGIO_DO_PAINEL.dadosAte),
      quantidadePerdidaNoPeriodo: somarQuantidades(perdasNoPeriodo),
      quantidadePerdidaForaDoPeriodo: somarQuantidades(perdasDaAplicacao) - somarQuantidades(perdasNoPeriodo),
      motivosNoPeriodo: semRepetir(perdasNoPeriodo.map((perda) => perda.motivo)),
      faltando: execucoesNoPeriodo.reduce((faltandoSomado, execucao) => faltandoSomado + execucao.conta.faltando, 0),
      motivoDesconhecido: execucoesNoPeriodo.reduce((desconhecidoSomado, execucao) => desconhecidoSomado + execucao.conta.motivoDesconhecido, 0),
      execucoesQueSumiram: execucoesNoPeriodo.filter((execucao) => execucao.situacao === 'sumiu'),
    };
  });
};

const aplicacaoTemOQueApontar = (aplicacao) => aplicacao.quantidadePerdidaNoPeriodo > 0 || aplicacao.faltando > 0 || aplicacao.execucoesQueSumiram.length > 0;

/* ---------- Textos derivados ---------- */

/* "14:59:52" quando é hoje no cenário; "20/11 08:45" quando é outro dia. */
const textoDoHorarioComSegundos = (instante) => (noMesmoDia(instante, RELOGIO_DO_PAINEL.agora)
  ? formatarHoraComSegundos(instante)
  : `${formatarDiaEMes(instante)} ${formatarHoraEMinuto(instante)}`);

const textoDoQueFalta = (traduzir, faltando, motivoDesconhecido) => {
  const variaveis = { faltando: formatarQuantidade(faltando), desconhecido: formatarQuantidade(motivoDesconhecido) };
  if (motivoDesconhecido === 0) return traduzir('saudeFaltandoTudoComMotivo', variaveis);
  if (motivoDesconhecido === faltando) return traduzir('saudeFaltandoTudoDesconhecido', variaveis);
  return traduzir('saudeFaltandoComDesconhecido', variaveis);
};

/* A busca de eventos da aplicação nos minutos antes e depois do horário da perda, no
   formato de busca do endereço (busca.jsx). */
const buscaEmVoltaDaPerda = (perda) => {
  const folga = MINUTOS_EM_VOLTA_DA_PERDA * MILISSEGUNDOS_POR_MINUTO;
  return codificarBusca({
    periodo: periodoDeIntervalo(perda.informadaEm - folga, perda.informadaEm + folga), base: 'origem',
    filtros: [{ campo: 'aplicacao', operador: 'e', valores: [perda.aplicacao] }],
    texto: '', regex: false, incluirAntesDoRapido: false, pagina: 1,
  });
};

/* ---------- As aplicações ---------- */

/* O período olhado, o horário da leitura e o "dados até". O produto e o ambiente estão na
   casca, logo acima. */
const ResumoDaSaude = ({ traduzir, periodo }) => (
  <section aria-label={traduzir('saudeResumo')} style={{ ...ESTILO_DA_CAIXA, padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
    <dl style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1) var(--space-5)' }}>
      <FatoDoResumo nome={traduzir('saudePeriodo')} valor={textoDoIntervaloDoPeriodo(traduzir, periodo)} />
      <FatoDoResumo nome={traduzir('saudeFatoLidaAs')} valor={formatarHoraComSegundos(RELOGIO_DO_PAINEL.agora)} />
      <FatoDoResumo nome={traduzir('vazioDadosAte')} valor={traduzir('vazioDadosAteValor', { dadosAte: formatarHoraComSegundos(RELOGIO_DO_PAINEL.dadosAte) })} />
    </dl>
    <p style={ESTILO_DO_TEXTO_DE_APOIO}>{traduzir('saudeComoFunciona')}</p>
  </section>
);

/* Quantas execuções em cada situação: "1 sumiu sem se despedir", "1 enviando". */
const SituacoesDaAplicacao = ({ traduzir, aplicacao }) => {
  if (aplicacao.nuncaEnviou) return <Etiqueta>{traduzir('saudeSituacaoNuncaEnviou')}</Etiqueta>;
  if (aplicacao.execucoesNoPeriodo.length === 0) return <span style={{ color: 'var(--muted)' }}>{traduzir('saudeSituacaoSemExecucaoNoPeriodo')}</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
      {ORDEM_DAS_SITUACOES_DE_EXECUCAO.map((situacao) => {
        const quantidade = aplicacao.execucoesNoPeriodo.filter((execucao) => execucao.situacao === situacao).length;
        if (quantidade === 0) return null;
        return (
          <Etiqueta key={situacao} tom={TOM_DA_SITUACAO_DE_EXECUCAO[situacao]} podeQuebrar>
            {traduzir('saudeContagemDeSituacao', { quantidade, situacao: traduzir(CHAVE_DA_SITUACAO_DE_EXECUCAO[situacao]) })}
          </Etiqueta>
        );
      })}
    </div>
  );
};

const LinhaDeAplicacao = ({ traduzir, aplicacao, aberta, indisponivel, motivoDaEspera, classeDoAbrir, aoAbrir }) => (
  <tr>
    {/* A aplicação aberta ganha a barra à esquerda e diz "aberta abaixo" por escrito. */}
    <th scope="row" style={{ ...ESTILO_DA_CELULA_DE_CHAVE, textAlign: 'left', fontWeight: 800, ...(aberta ? { boxShadow: 'inset 3px 0 0 var(--accent)' } : {}) }}>
      {aplicacao.nome}
    </th>
    <td style={ESTILO_DA_CELULA_DE_CHAVE}><SituacoesDaAplicacao traduzir={traduzir} aplicacao={aplicacao} /></td>
    <td style={ESTILO_DA_CELULA_DE_NUMERO}>
      {aplicacao.dadosAte === null
        ? <span style={{ color: 'var(--muted)' }}>{traduzir('saudeAindaSemDados')}</span>
        : textoDoHorarioComSegundos(aplicacao.dadosAte)}
    </td>
    <td style={ESTILO_DA_CELULA_DE_NUMERO}>
      {aplicacao.ultimoEnvioEm === null
        ? <span style={{ color: 'var(--muted)' }}>{traduzir('chaveAindaNaoEnviou')}</span>
        : textoDoHorarioComSegundos(aplicacao.ultimoEnvioEm)}
    </td>
    {/* Quem nunca enviou não tem perda nem lacuna conhecida: a tela não diz "nada faltando". */}
    <td style={ESTILO_DA_CELULA_DE_NUMERO}>
      {aplicacao.quantidadePerdidaNoPeriodo > 0
        ? <strong>{traduzir('saudePerdasComMotivos', { quantidade: formatarQuantidade(aplicacao.quantidadePerdidaNoPeriodo), motivos: aplicacao.motivosNoPeriodo.join(', ') })}</strong>
        : <span style={{ color: 'var(--muted)' }}>{traduzir(aplicacao.nuncaEnviou ? 'saudeAindaSemDados' : 'saudePerdasNenhumaInformada')}</span>}
    </td>
    <td style={ESTILO_DA_CELULA_DE_NUMERO}>
      {aplicacao.faltando > 0
        ? <strong>{textoDoQueFalta(traduzir, aplicacao.faltando, aplicacao.motivoDesconhecido)}</strong>
        : <span style={{ color: 'var(--muted)' }}>{traduzir(aplicacao.nuncaEnviou ? 'saudeAindaSemDados' : 'saudeFaltandoNada')}</span>}
      {aplicacao.execucoesQueSumiram.map((execucao) => (
        <div key={execucao.dados.execucao} style={{ marginTop: 2 }}>
          <Etiqueta tom="atencao" podeQuebrar>{traduzir('saudePodeTerPerdidoMais', { horario: textoDoHorarioProximo(execucao.dados.ultimoInformeEm) })}</Etiqueta>
        </div>
      ))}
    </td>
    <td style={{ ...ESTILO_DA_CELULA_DE_CHAVE, textAlign: 'right' }}>
      {aberta
        ? <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{traduzir('saudeAbertaAbaixo')}</span>
        : (
          <Button
            variant="secondary" compacto disabled={indisponivel} title={motivoDaEspera} className={classeDoAbrir} onClick={aoAbrir}
            aria-label={traduzir('saudeAbrirRotulo', { aplicacao: aplicacao.nome })} data-abrir-aplicacao={aplicacao.id}
          >
            {traduzir('saudeAbrir')}
          </Button>
        )}
    </td>
  </tr>
);

const CaixaDasAplicacoes = ({ traduzir, caixaRef, aplicacoes, idDaAplicacaoAberta, nomeDoProduto, nomeDoAmbiente, indisponivel, motivoDaEspera, classeDoAbrir, aoAbrir }) => {
  const idDaAplicacaoDemonstrada = aplicacoes.find((aplicacao) => aplicacao.id !== idDaAplicacaoAberta)?.id;
  return (
    <section ref={caixaRef} aria-label={traduzir('saudeAplicacoesTitulo')} style={ESTILO_DA_CAIXA}>
      <div style={ESTILO_DA_BARRA_DA_CAIXA}>
        <h2 style={{ ...ESTILO_DO_TITULO_DA_CAIXA, fontSize: 15 }}>{traduzir('saudeAplicacoesTitulo')}</h2>
        <Etiqueta>{formatarQuantidade(aplicacoes.length)}</Etiqueta>
      </div>
      <table aria-label={traduzir('saudeAplicacoesTabela', { produto: nomeDoProduto, ambiente: nomeDoAmbiente })} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          {LARGURAS_DAS_COLUNAS_DE_SAUDE.map((larguraDaColuna, indiceDaColuna) => <col key={indiceDaColuna} style={{ width: larguraDaColuna }} />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('campoAplicacao')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('saudeColunaSituacao')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('vazioDadosAte')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('chaveColunaUltimoEnvio')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('saudeColunaPerdas')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('saudeColunaFaltando')}</th>
            <th scope="col" style={{ ...ESTILO_DO_TITULO_DE_COLUNA, textAlign: 'right' }}>{traduzir('chaveColunaAcao')}</th>
          </tr>
        </thead>
        <tbody>
          {aplicacoes.map((aplicacao) => (
            <LinhaDeAplicacao
              key={aplicacao.id} traduzir={traduzir} aplicacao={aplicacao} aberta={aplicacao.id === idDaAplicacaoAberta}
              indisponivel={indisponivel} motivoDaEspera={motivoDaEspera}
              classeDoAbrir={aplicacao.id === idDaAplicacaoDemonstrada ? classeDoAbrir : undefined}
              aoAbrir={() => aoAbrir(aplicacao)}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
};

/* ---------- A aplicação aberta ---------- */

const LinhaDeExecucao = ({ traduzir, execucao }) => {
  const { dados, situacao, conta } = execucao;
  return (
    <tr>
      <td style={ESTILO_DA_CELULA_DE_CHAVE}><CodigoEmDestaque tamanho={13}>{dados.execucao}</CodigoEmDestaque></td>
      <td style={ESTILO_DA_CELULA_DE_NUMERO}>{dados.versao}</td>
      <td style={ESTILO_DA_CELULA_DE_NUMERO}>{textoDoHorarioComSegundos(dados.iniciadaEm)}</td>
      <td style={ESTILO_DA_CELULA_DE_NUMERO}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px var(--space-2)' }}>
          <Etiqueta tom={TOM_DA_SITUACAO_DE_EXECUCAO[situacao]}>{traduzir(CHAVE_DA_SITUACAO_DE_EXECUCAO[situacao])}</Etiqueta>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {traduzir(situacao === 'encerrou' ? 'saudeEncerradaEm' : 'saudeUltimoInforme', { horario: textoDoHorarioComSegundos(dados.encerradaEm || dados.ultimoInformeEm) })}
          </span>
        </div>
      </td>
      <td style={ESTILO_DA_CELULA_DE_NUMERO}>{formatarQuantidade(dados.ultimoNumeroInformado)}</td>
      <td style={ESTILO_DA_CELULA_DE_NUMERO}>{formatarQuantidade(dados.eventosRecebidos)}</td>
      <td style={ESTILO_DA_CELULA_DE_NUMERO}>
        {conta.faltando > 0
          ? <strong>{formatarQuantidade(conta.faltando)}</strong>
          : <span style={{ color: 'var(--muted)' }}>{traduzir('saudeFaltandoNada')}</span>}
      </td>
    </tr>
  );
};

/* A conta às claras: o que falta, o que já tem motivo informado e o resto, de motivo
   desconhecido. Na execução que sumiu, a última linha diz que o depois não tem número. */
const ContaDaExecucao = ({ traduzir, execucao }) => {
  const { dados, situacao, conta } = execucao;
  const fatos = [
    [traduzir('saudeContaFaltando'), traduzir('saudeContaFaltandoValor', {
      faltando: formatarQuantidade(conta.faltando), numerou: formatarQuantidade(dados.ultimoNumeroInformado), recebidos: formatarQuantidade(dados.eventosRecebidos),
    })],
    [traduzir('saudeContaComMotivo'), conta.comMotivo > 0
      ? traduzir('saudeContaComMotivoValor', { quantidade: formatarQuantidade(conta.comMotivo), motivos: conta.motivos.join(', ') })
      : traduzir('saudeContaComMotivoNenhum')],
    [traduzir('saudeContaDesconhecido'), conta.motivoDesconhecido > 0
      ? traduzir('saudeContaDesconhecidoValor', { quantidade: formatarQuantidade(conta.motivoDesconhecido) })
      : traduzir('saudeContaDesconhecidoZero')],
    ...(situacao === 'sumiu'
      ? [[traduzir('saudeContaDepois', { horario: textoDoHorarioProximo(dados.ultimoInformeEm) }), traduzir('saudeContaDepoisValor')]]
      : []),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <h3 style={ESTILO_DO_SUBTITULO_DA_SAUDE}>{traduzir('saudeContaTitulo', { execucao: dados.execucao })}</h3>
      <ListaDeFatos emCaixa fatos={fatos} />
    </div>
  );
};

const TabelaDeExecucoes = ({ traduzir, aplicacao }) => (
  <table aria-label={traduzir('saudeExecucoesTabela', { aplicacao: aplicacao.nome })} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
    <colgroup>
      {LARGURAS_DAS_COLUNAS_DE_EXECUCAO.map((larguraDaColuna, indiceDaColuna) => <col key={indiceDaColuna} style={{ width: larguraDaColuna }} />)}
    </colgroup>
    <thead>
      <tr>
        <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('campoExecucao')}</th>
        <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('campoVersao')}</th>
        <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('saudeColunaInicio')}</th>
        <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('saudeColunaSituacaoDaExecucao')}</th>
        <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('saudeColunaUltimoNumero')}</th>
        <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('saudeColunaRecebidos')}</th>
        <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('saudeColunaFaltandoCurta')}</th>
      </tr>
    </thead>
    <tbody>
      {aplicacao.execucoesNoPeriodo.map((execucao) => <LinhaDeExecucao key={execucao.dados.execucao} traduzir={traduzir} execucao={execucao} />)}
    </tbody>
  </table>
);

const TabelaDePerdas = ({ traduzir, aplicacao, indisponivel, motivoDaEspera, aoVerEventos }) => (
  <table aria-label={traduzir('saudePerdasTabela', { aplicacao: aplicacao.nome })} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
    <colgroup>
      {LARGURAS_DAS_COLUNAS_DE_PERDA.map((larguraDaColuna, indiceDaColuna) => <col key={indiceDaColuna} style={{ width: larguraDaColuna }} />)}
    </colgroup>
    <thead>
      <tr>
        <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('saudeColunaHorario')}</th>
        <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('campoExecucao')}</th>
        <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('saudeColunaQuantidade')}</th>
        <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('saudeColunaMotivo')}</th>
        <th scope="col" style={{ ...ESTILO_DO_TITULO_DE_COLUNA, textAlign: 'right' }}>{traduzir('chaveColunaAcao')}</th>
      </tr>
    </thead>
    <tbody>
      {aplicacao.perdasNoPeriodo.map((perda) => (
        <tr key={`${perda.execucao}/${perda.informadaEm}`}>
          <td style={ESTILO_DA_CELULA_DE_NUMERO}>{textoDoHorarioComSegundos(perda.informadaEm)}</td>
          <td style={ESTILO_DA_CELULA_DE_CHAVE}><CodigoEmDestaque tamanho={13}>{perda.execucao}</CodigoEmDestaque></td>
          <td style={{ ...ESTILO_DA_CELULA_DE_NUMERO, fontWeight: 800 }}>{formatarQuantidade(perda.quantidade)}</td>
          <td style={ESTILO_DA_CELULA_DE_CHAVE}>{perda.motivo}</td>
          <td style={{ ...ESTILO_DA_CELULA_DE_CHAVE, textAlign: 'right' }}>
            <Button
              variant="secondary" compacto disabled={indisponivel} title={motivoDaEspera} onClick={() => aoVerEventos(perda)}
              aria-label={traduzir('saudeVerEventosRotulo', { aplicacao: aplicacao.nome, horario: textoDoHorarioProximo(perda.informadaEm) })}
            >
              {traduzir('saudeVerEventos')}
            </Button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

/* As execuções em ordem, a conta do que falta e as perdas com horário e motivo de uma
   aplicação. Aplicação sem nada a apontar diz isso por escrito, sem afirmar que nada se
   perdeu. */
const DetalheDaAplicacao = ({ traduzir, aplicacao, nomeDoAmbiente, tituloRef, indisponivel, motivoDaEspera, aoFechar, aoVerEventos }) => {
  const execucoesComConta = aplicacao.execucoesNoPeriodo.filter((execucao) => execucao.conta.faltando > 0 || execucao.situacao === 'sumiu');
  return (
    <section aria-label={traduzir('saudeDetalheTitulo', { aplicacao: aplicacao.nome })} style={ESTILO_DA_CAIXA}>
      <div style={ESTILO_DA_BARRA_DA_CAIXA}>
        <h2 ref={tituloRef} tabIndex={-1} style={{ ...ESTILO_DO_TITULO_DA_CAIXA, fontSize: 15 }}>{traduzir('saudeDetalheTitulo', { aplicacao: aplicacao.nome })}</h2>
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="secondary" compacto onClick={aoFechar} aria-label={traduzir('saudeFecharRotulo', { aplicacao: aplicacao.nome })}>{traduzir('fechar')}</Button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4) var(--space-4)' }}>
        {aplicacao.nuncaEnviou && (
          <AvisoDeAtencao
            titulo={traduzir('saudeNuncaEnviouTitulo', { aplicacao: aplicacao.nome, ambiente: nomeDoAmbiente })}
            corpo={traduzir('saudeNuncaEnviouCorpo')}
          />
        )}
        {aplicacao.execucoesQueSumiram.map((execucao) => (
          <AvisoDeAtencao
            key={execucao.dados.execucao}
            titulo={traduzir('saudeSumiuTitulo', { execucao: execucao.dados.execucao })}
            corpo={traduzir('saudeSumiuCorpo', {
              horarioCompleto: textoDoHorarioComSegundos(execucao.dados.ultimoInformeEm), horario: textoDoHorarioProximo(execucao.dados.ultimoInformeEm),
            })}
          />
        ))}
        {!aplicacao.nuncaEnviou && !aplicacaoTemOQueApontar(aplicacao) && (
          <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{traduzir('saudeSemProblemaTitulo', { aplicacao: aplicacao.nome })}</div>
            <p style={{ ...ESTILO_DO_TEXTO_DE_APOIO, fontSize: 13 }}>{traduzir('saudeSemProblemaCorpo')}</p>
          </div>
        )}

        {!aplicacao.nuncaEnviou && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <h3 style={ESTILO_DO_SUBTITULO_DA_SAUDE}>{traduzir('saudeExecucoesTitulo')}</h3>
            {aplicacao.execucoesNoPeriodo.length > 0
              ? <TabelaDeExecucoes traduzir={traduzir} aplicacao={aplicacao} />
              : <p style={{ ...ESTILO_DO_TEXTO_DE_APOIO, fontSize: 13 }}>{traduzir('saudeExecucoesNenhuma', { aplicacao: aplicacao.nome })}</p>}
          </div>
        )}

        {/* A conta e as perdas ficam lado a lado: as duas se leem juntas, sem rolar. */}
        {!aplicacao.nuncaEnviou && (
          <div style={{ display: 'grid', gridTemplateColumns: execucoesComConta.length > 0 ? COLUNAS_DA_CONTA_E_DAS_PERDAS : 'minmax(0, 1fr)', gap: 'var(--space-4) var(--space-5)', alignItems: 'start' }}>
            {execucoesComConta.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {execucoesComConta.map((execucao) => <ContaDaExecucao key={execucao.dados.execucao} traduzir={traduzir} execucao={execucao} />)}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <h3 style={ESTILO_DO_SUBTITULO_DA_SAUDE}>{traduzir('saudePerdasTitulo')}</h3>
              {aplicacao.perdasNoPeriodo.length > 0
                ? <TabelaDePerdas traduzir={traduzir} aplicacao={aplicacao} indisponivel={indisponivel} motivoDaEspera={motivoDaEspera} aoVerEventos={aoVerEventos} />
                : <p style={{ ...ESTILO_DO_TEXTO_DE_APOIO, fontSize: 13 }}>{traduzir('saudePerdasNenhumaNoPeriodo', { aplicacao: aplicacao.nome })}</p>}
              {aplicacao.quantidadePerdidaForaDoPeriodo > 0 && (
                <p style={ESTILO_DO_TEXTO_DE_APOIO}>
                  {traduzir('saudePerdasForaDoPeriodo', { aplicacao: aplicacao.nome, quantidade: formatarQuantidade(aplicacao.quantidadePerdidaForaDoPeriodo) })}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

/* ---------- A tela ---------- */
const TelaSaude = ({ lang, estado, params, papel }) => {
  const traduzir = useT(lang);
  const { navigate } = useRouter();
  const parametrosDoPainel = { ...PAINEL_DO_EXCURFLY, ...params };
  const idDoProduto = parametrosDoPainel.produto;
  const idDoAmbiente = parametrosDoPainel.ambiente;
  const idDaAplicacaoDoEndereco = parametrosDoPainel.aplicacao;
  const rotasDoPapel = ROTAS_DO_PAPEL[papel];
  const nomeDoProduto = nomeDoProdutoPorId(idDoProduto);
  const nomeDoAmbiente = nomeDoAmbientePorId(idDoAmbiente);
  const ondeEstou = { produto: idDoProduto, ambiente: idDoAmbiente };

  /* Período que o endereço não reconhece vale como o de abertura. */
  const idDoPeriodo = PERIODOS_PRONTOS.some((periodoPronto) => periodoPronto.id === parametrosDoPainel.periodo)
    ? parametrosDoPainel.periodo
    : PERIODO_DE_ABERTURA_DA_SAUDE;
  const periodo = useMemo(() => periodoDoId(idDoPeriodo), [idDoPeriodo]);

  const tituloDoDetalheRef = useRef(null);
  const caixaDasAplicacoesRef = useRef(null);
  const aplicacaoAnteriorRef = useRef(idDaAplicacaoDoEndereco);

  const desabilitado = estado === 'disabled';
  const semInternet = estado === 'offline';
  const indisponivel = desabilitado || semInternet;
  const comErro = estado === 'error';
  const estadoDemonstrado = ESTADOS_DEMONSTRADOS.includes(estado) ? estado : null;
  const motivoDaEspera = semInternet ? traduzir('motivoSemInternet') : undefined;

  const aplicacoes = useMemo(() => montarSaudeDoAmbiente({ idDoProduto, idDoAmbiente, periodo }), [idDoProduto, idDoAmbiente, periodo]);
  const aplicacaoAberta = aplicacoes.find((aplicacao) => aplicacao.id === idDaAplicacaoDoEndereco) || null;
  const nenhumaEnviouNoPeriodo = estado === 'empty' || aplicacoes.every((aplicacao) => aplicacao.execucoesNoPeriodo.length === 0);
  const podeAmpliar = periodo.duracao < periodoDoId(PERIODO_MAIOR_DA_SAUDE).duracao;

  /* Aberta outra aplicação, o foco vai para o título dela: quem usa o teclado ou leitor de
     tela chega ao que acabou de abrir, que fica abaixo da lista. Fechada, o foco volta ao
     "Abrir" da linha dela. */
  useEffect(() => {
    const idDaAplicacaoAnterior = aplicacaoAnteriorRef.current;
    aplicacaoAnteriorRef.current = idDaAplicacaoDoEndereco;
    if (idDaAplicacaoDoEndereco === idDaAplicacaoAnterior) return;
    if (idDaAplicacaoDoEndereco) tituloDoDetalheRef.current?.focus();
    else caixaDasAplicacoesRef.current?.querySelector(`[data-abrir-aplicacao="${idDaAplicacaoAnterior}"]`)?.focus();
  }, [idDaAplicacaoDoEndereco]);

  /* Cada ação confere de novo se pode agir: o botão apagado não basta sozinho. */
  const irParaOPeriodo = (idDoNovoPeriodo) => navigate(
    aplicacaoAberta ? rotasDoPapel.saudeDaAplicacao : rotasDoPapel.saudeNoPeriodo,
    { ...ondeEstou, periodo: idDoNovoPeriodo, ...(aplicacaoAberta ? { aplicacao: aplicacaoAberta.id } : {}) });
  const trocarPeriodo = (idDoNovoPeriodo) => { if (!indisponivel) irParaOPeriodo(idDoNovoPeriodo); };
  const abrirAplicacao = (aplicacao) => {
    if (indisponivel) return;
    navigate(rotasDoPapel.saudeDaAplicacao, { ...ondeEstou, periodo: idDoPeriodo, aplicacao: aplicacao.id });
  };
  const fecharAplicacao = () => navigate(rotasDoPapel.saudeNoPeriodo, { ...ondeEstou, periodo: idDoPeriodo });
  const verEventosEmVolta = (perda) => {
    if (indisponivel) return;
    navigate(rotasDoPapel.busca, { ...ondeEstou, busca: buscaEmVoltaDaPerda(perda) });
  };
  const irParaAsAplicacoes = () => { if (!indisponivel && rotasDoPapel.aplicacoes) navigate(rotasDoPapel.aplicacoes, ondeEstou); };

  /* Trocar o produto, o ambiente ou o papel leva à saúde do envio de lá, no mesmo período:
     os dois papéis têm a tela. A aplicação aberta não vai junto: pode não existir lá. */
  const mudarOPainel = (destino) => navigate(
    ROTAS_DO_PAPEL[destino.papel || papel].saudeNoPeriodo,
    { produto: destino.produto || idDoProduto, ambiente: destino.ambiente || idDoAmbiente, periodo: idDoPeriodo });

  return (
    <CascaDoPainel traduzir={traduzir} estado={estado} params={parametrosDoPainel} papel={papel} aoMudar={mudarOPainel} itemAtual="saude">
      {semInternet && (
        <FaixaFixa>
          <AvisoSemInternet
            titulo={traduzir('semInternetTitulo')}
            continuaFuncionando={traduzir('saudeSemInternetContinua', { horario: formatarHoraComSegundos(RELOGIO_DO_PAINEL.agora) })}
            espera={traduzir('saudeSemInternetEspera')}
          />
        </FaixaFixa>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2) var(--space-3)', flexWrap: 'wrap', minHeight: ALTURA_DA_LINHA_DO_TITULO }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.2px' }}>{traduzir('saudeTitulo')}</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{traduzir('aplicacoesFuso', { fuso: FUSO_DO_PAINEL.rotulo })}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }} title={motivoDaEspera}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{traduzir('saudePeriodo')}</span>
          <SeletorSegmentado
            rotulo={traduzir('saudePeriodo')} valor={idDoPeriodo} disabled={indisponivel} aoEscolher={trocarPeriodo}
            opcoes={PERIODOS_PRONTOS.map((periodoPronto) => ({ valor: periodoPronto.id, rotulo: traduzir(periodoPronto.chave) }))}
          />
        </div>
      </div>

      <ResumoDaSaude traduzir={traduzir} periodo={periodo} />

      {comErro && (
        <AvisoDeErro
          titulo={traduzir('saudeErroTitulo')} corpo={traduzir('saudeErroCorpo')}
          acao={<div><Button variant="secondary" compacto onClick={() => {}}>{traduzir('tentarDeNovo')}</Button></div>}
        />
      )}

      {estado === 'loading' && !nenhumaEnviouNoPeriodo && (
        <section style={{ ...ESTILO_DA_CAIXA, display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-2)' }}>
          <MensagemDeEstado>{traduzir('saudeCarregando')}</MensagemDeEstado>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{traduzir('aplicacoesCarregandoNota')}</span>
        </section>
      )}

      {!comErro && nenhumaEnviouNoPeriodo && (
        <section style={ESTILO_DA_CAIXA}>
          <EmptyState
            title={traduzir('saudeVazioTitulo', { produto: nomeDoProduto, ambiente: nomeDoAmbiente })}
            body={traduzir('saudeVazioCorpo')}
            detalhes={(
              <React.Fragment>
                <ListaDeFatos emCaixa fatos={[
                  [traduzir('cascaProduto'), nomeDoProduto],
                  [traduzir('cascaAmbiente'), nomeDoAmbiente],
                  [traduzir('vazioPeriodo'), textoDoPeriodoComFuso(traduzir, periodo)],
                  [traduzir('vazioDadosAte'), traduzir('vazioDadosAteValor', { dadosAte: formatarHoraComSegundos(RELOGIO_DO_PAINEL.dadosAte) })],
                ]} />
                <p style={{ ...ESTILO_DO_TEXTO_DE_APOIO, fontSize: 13, maxWidth: 520 }}>
                  {traduzir(papel === 'administrador' ? 'saudeVazioPassoDoAdministrador' : 'saudeVazioPassoDoInvestigador')}
                </p>
              </React.Fragment>
            )}
            acoes={(
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
                {podeAmpliar && (
                  <Button variant="primary" compacto disabled={indisponivel} title={motivoDaEspera} className={classeDoEstadoDemonstrado(estadoDemonstrado)} onClick={() => trocarPeriodo(PERIODO_MAIOR_DA_SAUDE)}>
                    {traduzir('saudeVazioAmpliar')}
                  </Button>
                )}
                {papel === 'administrador' && (
                  <Button variant="secondary" compacto disabled={indisponivel} title={motivoDaEspera} onClick={irParaAsAplicacoes}>
                    {traduzir('catalogoVazioCta')}
                  </Button>
                )}
              </div>
            )}
          />
        </section>
      )}

      {!comErro && !nenhumaEnviouNoPeriodo && (
        <React.Fragment>
          <CaixaDasAplicacoes
            traduzir={traduzir} caixaRef={caixaDasAplicacoesRef} aplicacoes={aplicacoes} idDaAplicacaoAberta={aplicacaoAberta?.id} nomeDoProduto={nomeDoProduto} nomeDoAmbiente={nomeDoAmbiente}
            indisponivel={indisponivel} motivoDaEspera={motivoDaEspera} classeDoAbrir={classeDoEstadoDemonstrado(estadoDemonstrado)} aoAbrir={abrirAplicacao}
          />
          {aplicacaoAberta && (
            <DetalheDaAplicacao
              traduzir={traduzir} aplicacao={aplicacaoAberta} nomeDoAmbiente={nomeDoAmbiente} tituloRef={tituloDoDetalheRef}
              indisponivel={indisponivel} motivoDaEspera={motivoDaEspera} aoFechar={fecharAplicacao} aoVerEventos={verEventosEmVolta}
            />
          )}
        </React.Fragment>
      )}
    </CascaDoPainel>
  );
};

const TelaSaudeInvestigador = (propriedades) => <TelaSaude {...propriedades} papel="investigador" />;
const TelaSaudeAdministrador = (propriedades) => <TelaSaude {...propriedades} papel="administrador" />;
