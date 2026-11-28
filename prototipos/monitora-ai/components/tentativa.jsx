// Monitora AI — Tentativas e linha do tempo (Prototipar a tentativa e sua linha do tempo).
// Duas telas do item "Tentativas" do menu:
//   1. Achar tentativas por um campo de localização (cliente, viagem) ou abrir uma direto
//      pelo campo principal. Campo de localização acha tentativas, não liga eventos: o
//      resultado é uma lista de tentativas, com os "eventos sem tentativa" à parte.
//   2. A linha do tempo de uma tentativa: os eventos ligados a um valor do campo principal,
//      de várias aplicações, em ordem de acontecimento, com o vínculo de correlação de cada
//      um, os avisos de que podem faltar eventos e, à parte, o que só tem horário próximo.
// O evento abre ao lado da linha do tempo com a mesma moldura da busca (evento.jsx), e tudo
// mora no endereço: campo, valor, período, evento aberto e a parte rolada.

const PERIODO_DE_ABERTURA_DAS_TENTATIVAS = '1h';
/* Até quanto de distância um evento sem vínculo aparece em "mesmo horário, sem vínculo". */
const SEGUNDOS_DO_MESMO_HORARIO = 5;
const ORDEM_DOS_NIVEIS = ['info', 'aviso', 'erro'];
const MARCAS_QUE_ENTRAM_PELO_RECEBIMENTO = ['semHorarioDeOrigem', 'horarioNoFuturo'];
const COLUNAS_DAS_TENTATIVAS = '120px minmax(0, 1.2fr) 72px minmax(0, 1fr) 84px minmax(0, 1.5fr)';
const SECAO_SEM_VINCULO = 'sem-vinculo';
const MARGEM_ACIMA_DA_PARTE = 12;
/* Com um evento aberto, a linha do tempo e o evento dividem a largura ao meio: a linha do
   tempo precisa de mais largura que a lista da busca, por causa do vínculo de cada linha. */
const COLUNAS_DA_LINHA_DO_TEMPO_COM_EVENTO = 'minmax(0, 1fr) minmax(0, 1fr)';
const LINHAS_DO_ESQUELETO_DA_LINHA_DO_TEMPO = 9;
const LARGURA_DO_TEXTO_DE_AJUDA = 720;
const TEXTOS_DO_EVENTO_NA_LINHA_DO_TEMPO = {
  posicao: 'eventoPosicaoNaLinhaDoTempo', voltar: 'eventoVoltarALinhaDoTempo', corpoDaFalha: 'eventoFalhaCorpoNaLinhaDoTempo',
};
const ESTILO_DA_CAIXA = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', flexShrink: 0,
};
const ESTILO_DA_BARRA_DA_CAIXA = {
  display: 'flex', alignItems: 'center', gap: 'var(--space-1) var(--space-3)', flexWrap: 'wrap',
  padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border)',
};
const ESTILO_DO_TITULO_DA_CAIXA = { margin: 0, fontSize: 14, fontWeight: 800 };
const ESTILO_DO_TEXTO_DE_APOIO = { margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 };

/* De qual evento aberto a pessoa veio, para o "voltar". Fica só na memória da página: num
   link aberto direto não há de onde voltar. */
const ORIGEM_DA_TENTATIVA = { parametrosDoEvento: null, nomeDoCampo: null, valorDoCampo: null };

const lembrarOrigemDaTentativa = (parametrosDoEvento, nomeDoCampo, valorDoCampo) => {
  Object.assign(ORIGEM_DA_TENTATIVA, { parametrosDoEvento, nomeDoCampo, valorDoCampo });
};

/* ---------- A tentativa (simulada) ----------
   Tentativa é o grupo de eventos ligados a um valor do campo principal. A corrente segue
   os códigos de correlação que os eventos trazem juntos e nunca atravessa para outro
   valor do campo principal: evento que traz outra reserva é de outra tentativa. */
const idDoCodigo = (codigo) => `${codigo.nomeDoCampo}=${codigo.valor}`;

const codigosDeVinculoDoEvento = (evento, camposDeVinculo) => camposDeVinculo
  .map((campo) => ({ nomeDoCampo: campo.nome, papel: campo.papel, valorNoEvento: valorDoCampoNoEvento(campo, evento) }))
  .filter((codigo) => codigo.valorNoEvento !== undefined && codigo.valorNoEvento !== null)
  .map((codigo) => ({ nomeDoCampo: codigo.nomeDoCampo, papel: codigo.papel, valor: String(codigo.valorNoEvento) }));

/* Sem horário de origem, ou com ele no futuro, o evento entra pelo horário de recebimento. */
const entraPeloRecebimento = (evento) => (evento.marcas || []).some((marca) => MARCAS_QUE_ENTRAM_PELO_RECEBIMENTO.includes(marca));
const instanteNaLinhaDoTempo = (evento) => (entraPeloRecebimento(evento) ? evento.recebidoEm : evento.origemEm);

/* A ordem da linha do tempo: horário de origem, execução, número na execução. Entre
   aplicações com o mesmo horário a posição é fixa, mas não diz quem veio antes. */
const compararNaLinhaDoTempo = (eventoAnterior, eventoSeguinte) =>
  instanteNaLinhaDoTempo(eventoAnterior) - instanteNaLinhaDoTempo(eventoSeguinte)
  || eventoAnterior.execucao.localeCompare(eventoSeguinte.execucao)
  || eventoAnterior.numeroNaExecucao - eventoSeguinte.numeroNaExecucao;

/* Os eventos encontráveis que trazem algum campo de correlação, em ordem de acontecimento,
   com os códigos de cada um. Monta uma vez por produto e ambiente. */
const EVENTOS_COM_VINCULO_POR_AMBIENTE = {};

const eventosComVinculo = (idDoProduto, idDoAmbiente) => {
  const idDoIndice = `${idDoProduto}/${idDoAmbiente}`;
  if (!EVENTOS_COM_VINCULO_POR_AMBIENTE[idDoIndice]) {
    const camposDeVinculo = catalogoDoProduto(idDoProduto).filter((campo) => PAPEIS_DE_VINCULO.includes(campo.papel));
    const eventosDoIndice = eventosDoAmbiente(idDoProduto, idDoAmbiente)
      .filter((evento) => evento.recebidoEm <= RELOGIO_DO_PAINEL.dadosAte)
      .map((evento) => ({ evento, codigos: codigosDeVinculoDoEvento(evento, camposDeVinculo) }))
      .filter((eventoComCodigos) => eventoComCodigos.codigos.length > 0)
      .sort((anterior, seguinte) => compararNaLinhaDoTempo(anterior.evento, seguinte.evento));
    EVENTOS_COM_VINCULO_POR_AMBIENTE[idDoIndice] = {
      eventosDoIndice, idsComVinculo: new Set(eventosDoIndice.map((eventoComCodigos) => eventoComCodigos.evento.id)),
    };
  }
  return EVENTOS_COM_VINCULO_POR_AMBIENTE[idDoIndice];
};

const codigoPrincipalDoEvento = (codigos) => codigos.find((codigo) => codigo.papel === 'principal') || null;

const piorNivelDosEventos = (eventos) => eventos
  .map((evento) => evento.nivel)
  .sort((nivelAnterior, nivelSeguinte) => ORDEM_DOS_NIVEIS.indexOf(nivelSeguinte) - ORDEM_DOS_NIVEIS.indexOf(nivelAnterior))[0];

const semRepetir = (itens) => [...new Set(itens)];

const montarTentativa = ({ idDoProduto, idDoAmbiente, nomeDoCampo, valorDoCampo }) => {
  const { eventosDoIndice } = eventosComVinculo(idDoProduto, idDoAmbiente);
  const codigoDaTentativa = { nomeDoCampo, papel: 'principal', valor: valorDoCampo };
  const corrente = [codigoDaTentativa];
  const idsNaCorrente = new Set([idDoCodigo(codigoDaTentativa)]);
  const entradasPorEvento = new Map();

  /* Repete a passagem até a corrente parar de crescer: um código novo pode puxar eventos
     que vieram antes dele. */
  let correnteCresceu = true;
  while (correnteCresceu) {
    correnteCresceu = false;
    eventosDoIndice.forEach(({ evento, codigos }) => {
      if (entradasPorEvento.has(evento.id)) return;
      const codigoPrincipal = codigoPrincipalDoEvento(codigos);
      if (codigoPrincipal && idDoCodigo(codigoPrincipal) !== idDoCodigo(codigoDaTentativa)) return;
      const codigosNaCorrente = codigos.filter((codigo) => idsNaCorrente.has(idDoCodigo(codigo)));
      if (codigosNaCorrente.length === 0) return;
      /* O vínculo que a linha mostra: o campo principal, quando o evento o traz; senão, os
         códigos da corrente por onde ele entrou. */
      entradasPorEvento.set(evento.id, { evento, vinculos: codigoPrincipal ? [codigoPrincipal] : codigosNaCorrente });
      codigos.forEach((codigo) => {
        if (idsNaCorrente.has(idDoCodigo(codigo))) return;
        idsNaCorrente.add(idDoCodigo(codigo));
        corrente.push(codigo);
      });
      correnteCresceu = true;
    });
  }

  /* Código da corrente que também está em evento de outro valor do campo principal: as
     duas tentativas dividem o código e não se juntam. */
  const codigosEmComum = corrente.slice(1).map((codigo) => {
    const outrasTentativas = eventosDoIndice
      .filter((eventoComCodigos) => eventoComCodigos.codigos.some((codigoDoEvento) => idDoCodigo(codigoDoEvento) === idDoCodigo(codigo)))
      .map((eventoComCodigos) => codigoPrincipalDoEvento(eventoComCodigos.codigos))
      .filter((codigoPrincipal) => codigoPrincipal && idDoCodigo(codigoPrincipal) !== idDoCodigo(codigoDaTentativa));
    const idsDasOutras = semRepetir(outrasTentativas.map(idDoCodigo));
    return { ...codigo, outrasTentativas: idsDasOutras.map((idDaOutra) => outrasTentativas.find((outra) => idDoCodigo(outra) === idDaOutra)) };
  }).filter((codigo) => codigo.outrasTentativas.length > 0);

  const entradasEmOrdem = [...entradasPorEvento.values()]
    .sort((entradaAnterior, entradaSeguinte) => compararNaLinhaDoTempo(entradaAnterior.evento, entradaSeguinte.evento));
  const temMesmoHorario = (entrada, entradaVizinha) => Boolean(entradaVizinha)
    && instanteNaLinhaDoTempo(entradaVizinha.evento) === instanteNaLinhaDoTempo(entrada.evento)
    && entradaVizinha.evento.aplicacao !== entrada.evento.aplicacao;
  const entradas = entradasEmOrdem.map((entrada, indiceDaEntrada) => ({
    ...entrada,
    mesmoHorario: temMesmoHorario(entrada, entradasEmOrdem[indiceDaEntrada - 1]) || temMesmoHorario(entrada, entradasEmOrdem[indiceDaEntrada + 1]),
    /* Só o evento sem campo principal aparece nas duas tentativas. */
    outrasTentativas: entrada.vinculos[0].papel === 'principal' ? [] : codigosEmComum
      .filter((codigoEmComum) => entrada.vinculos.some((vinculo) => idDoCodigo(vinculo) === idDoCodigo(codigoEmComum)))
      .flatMap((codigoEmComum) => codigoEmComum.outrasTentativas),
  }));

  const eventos = entradas.map((entrada) => entrada.evento);
  const primeiro = eventos.length ? instanteNaLinhaDoTempo(eventos[0]) : null;
  const ultimo = eventos.length ? instanteNaLinhaDoTempo(eventos[eventos.length - 1]) : null;
  const catalogo = catalogoDoProduto(idDoProduto);
  return {
    nomeDoCampo, valorDoCampo, entradas, eventos, corrente, codigosEmComum, primeiro, ultimo,
    aplicacoes: semRepetir(eventos.map((evento) => evento.aplicacao)),
    piorNivel: piorNivelDosEventos(eventos),
    cruzaDias: eventos.length > 0 && !noMesmoDia(primeiro, ultimo),
    perdas: PERDAS_INFORMADAS.filter((perda) => eventos.length > 0 && perda.informadaEm >= primeiro && perda.informadaEm <= ultimo),
    execucoesSemEncerramento: EXECUCOES_SEM_ENCERRAMENTO
      .filter((execucao) => eventos.length > 0 && execucao.ultimoInformeEm >= primeiro && execucao.ultimoInformeEm <= ultimo),
    camposLigadosDepois: semRepetir(corrente.map((codigo) => codigo.nomeDoCampo))
      .map((nomeDoCampoDaCorrente) => campoDoCatalogo(catalogo, nomeDoCampoDaCorrente))
      .filter((campo) => campo && campo.correlacaoDesde && campo.correlacaoDesde > RELOGIO_DO_PAINEL.dadosDesde),
    ocorrencias: semRepetir(eventos.map((evento) => evento.ocorrencia).filter(Boolean))
      .filter((idDaOcorrencia) => OCORRENCIAS_DO_CENARIO[idDaOcorrencia])
      .map((idDaOcorrencia) => ({ id: idDaOcorrencia, ...OCORRENCIAS_DO_CENARIO[idDaOcorrencia] })),
  };
};

const tentativaTemPerda = (tentativa) => tentativa.perdas.length > 0 || tentativa.execucoesSemEncerramento.length > 0;

/* O que cada evento traz nos campos de localização do catálogo, como "campo=valor". */
const valoresDeLocalizacaoDoEvento = (evento, camposDeLocalizacao) => camposDeLocalizacao
  .map((campo) => ({ nomeDoCampo: campo.nome, valorNoEvento: valorDoCampoNoEvento(campo, evento) }))
  .filter((localizacao) => localizacao.valorNoEvento !== undefined && localizacao.valorNoEvento !== null)
  .map((localizacao) => ({ nomeDoCampo: localizacao.nomeDoCampo, valor: String(localizacao.valorNoEvento) }));

/* "Mesmo horário, sem vínculo": eventos sem campo de correlação, a poucos segundos de um
   evento da tentativa e com o mesmo valor de um campo de localização. Não entram nela. */
const eventosDeMesmoHorarioSemVinculo = ({ idDoProduto, idDoAmbiente, tentativa }) => {
  if (tentativa.eventos.length === 0) return [];
  const { idsComVinculo } = eventosComVinculo(idDoProduto, idDoAmbiente);
  const camposDeLocalizacao = catalogoDoProduto(idDoProduto).filter((campo) => campo.papel === 'localizacao');
  const janela = SEGUNDOS_DO_MESMO_HORARIO * 1000;
  const localizacoesDaTentativa = new Set(tentativa.eventos
    .flatMap((evento) => valoresDeLocalizacaoDoEvento(evento, camposDeLocalizacao)).map(idDoCodigo));
  const instantesDaTentativa = tentativa.eventos.map(instanteNaLinhaDoTempo);
  return eventosDoAmbiente(idDoProduto, idDoAmbiente)
    .filter((evento) => {
      const instante = instanteNaLinhaDoTempo(evento);
      if (instante < tentativa.primeiro - janela || instante > tentativa.ultimo + janela) return false;
      if (evento.recebidoEm > RELOGIO_DO_PAINEL.dadosAte || idsComVinculo.has(evento.id)) return false;
      if (!valoresDeLocalizacaoDoEvento(evento, camposDeLocalizacao).some((localizacao) => localizacoesDaTentativa.has(idDoCodigo(localizacao)))) return false;
      return instantesDaTentativa.some((instanteDaTentativa) => Math.abs(instanteDaTentativa - instante) <= janela);
    })
    .sort(compararNaLinhaDoTempo);
};

/* ---------- Achar tentativas (simulado) ---------- */

/* Os campos pelos quais se acha uma tentativa: os de localização que o produto marcou e
   os campos principais do catálogo. */
const camposParaAcharTentativas = (idDoProduto) => [
  ...(CAMPOS_DE_LOCALIZACAO[idDoProduto] || []).map((campoDeLocalizacao) => ({ ...campoDeLocalizacao, tipo: 'localizacao' })),
  ...catalogoDoProduto(idDoProduto).filter((campo) => campo.papel === 'principal')
    .map((campo) => ({ id: campo.nome, rotulo: campo.nome, tipo: 'principal' })),
];

/* Os nomes de campo que a busca por um campo de localização olha, com os apelidos. */
const nomesOlhadosPeloCampo = (campoDeLocalizacao, catalogo) => campoDeLocalizacao.campos
  .flatMap((nomeDoCampo) => [nomeDoCampo, ...(campoDoCatalogo(catalogo, nomeDoCampo)?.apelidos || [])]);

/* Campo de localização acha tentativas, não liga eventos: cada evento com o valor aponta a
   tentativa do campo principal que ele traz. Os que não trazem campo principal ficam à
   parte, sem tentativa. */
const acharTentativas = ({ idDoProduto, idDoAmbiente, campoDeLocalizacao, valor, periodo }) => {
  const catalogo = catalogoDoProduto(idDoProduto);
  const camposOlhados = campoDeLocalizacao.campos.map((nomeDoCampo) => campoDoCatalogo(catalogo, nomeDoCampo)).filter(Boolean);
  const camposDeVinculo = catalogo.filter((campo) => PAPEIS_DE_VINCULO.includes(campo.papel));
  const valorProcurado = valor.toLowerCase();
  const trazOValor = (evento) => camposOlhados.some((campo) => String(valorDoCampoNoEvento(campo, evento) ?? '').toLowerCase() === valorProcurado)
    || (campoDeLocalizacao.codigosDeBusca || []).some((nomeDoDado) => evento.codigosDeBusca?.[nomeDoDado] === valor);
  const eventosComOValor = eventosDoAmbiente(idDoProduto, idDoAmbiente).filter((evento) => evento.origemEm >= periodo.inicio
    && evento.origemEm <= periodo.fim && evento.recebidoEm <= RELOGIO_DO_PAINEL.dadosAte && trazOValor(evento));

  const codigosPrincipais = eventosComOValor
    .map((evento) => codigoPrincipalDoEvento(codigosDeVinculoDoEvento(evento, camposDeVinculo))).filter(Boolean);
  const tentativas = semRepetir(codigosPrincipais.map(idDoCodigo))
    .map((idDoCodigoPrincipal) => codigosPrincipais.find((codigoPrincipal) => idDoCodigo(codigoPrincipal) === idDoCodigoPrincipal))
    .map((codigoPrincipal) => montarTentativa({ idDoProduto, idDoAmbiente, nomeDoCampo: codigoPrincipal.nomeDoCampo, valorDoCampo: codigoPrincipal.valor }))
    .sort((tentativaAnterior, tentativaSeguinte) => tentativaSeguinte.ultimo - tentativaAnterior.ultimo);
  const idsEmTentativas = new Set(tentativas.flatMap((tentativa) => tentativa.eventos.map((evento) => evento.id)));
  return { tentativas, eventosSemTentativa: eventosComOValor.filter((evento) => !idsEmTentativas.has(evento.id)) };
};

/* ---------- Textos derivados ---------- */
const textoDoCodigo = (traduzir, codigo) => traduzir('codigoComCampo', { campo: codigo.nomeDoCampo, valor: codigo.valor });

const juntarComE = (traduzir, itens) => (itens.length <= 1
  ? (itens[0] || '')
  : traduzir('listaComE', { primeiros: itens.slice(0, -1).join(', '), ultimo: itens[itens.length - 1] }));

/* O intervalo entre dois eventos, com segundos. `formatarODia` escolhe a data inteira (o
   cabeçalho) ou só dia e mês (a lista). */
const textoDoIntervaloDeEventos = (traduzir, inicio, fim, formatarODia) => (noMesmoDia(inicio, fim)
  ? traduzir('periodoNoMesmoDia', { data: formatarODia(inicio), inicio: formatarHoraComSegundos(inicio), fim: formatarHoraComSegundos(fim) })
  : traduzir('periodoEntreDias', { inicio: `${formatarODia(inicio)} ${formatarHoraComSegundos(inicio)}`, fim: `${formatarODia(fim)} ${formatarHoraComSegundos(fim)}` }));

const textoDaContagemDeEventosSimples = (traduzir, quantidade) => (quantidade === 1
  ? traduzir('contagemDeUmEvento')
  : traduzir('contagemDeEventos', { quantidade: formatarQuantidade(quantidade) }));

/* O que a busca por um campo de localização olha, em palavras. */
const textoDoQueOCampoOlha = (traduzir, campoDeLocalizacao, catalogo) => juntarComE(traduzir, [
  ...nomesOlhadosPeloCampo(campoDeLocalizacao, catalogo),
  ...(campoDeLocalizacao.dadosComCodigoDeBusca ? [traduzir('tentativasCodigosDeBusca', { dados: campoDeLocalizacao.dadosComCodigoDeBusca })] : []),
]);

const dicaDoCampoParaAchar = (traduzir, campoParaAchar, catalogo) => {
  if (campoParaAchar.tipo === 'principal') return traduzir('tentativasDicaPrincipal');
  const partes = [traduzir('tentativasDicaLocalizacao', { campos: textoDoQueOCampoOlha(traduzir, campoParaAchar, catalogo) })];
  if (campoParaAchar.foraDaBusca) partes.push(traduzir('tentativasDicaFora', campoParaAchar.foraDaBusca));
  return partes.join(' ');
};

/* O menor período pronto da busca que alcança um instante. */
const periodoProntoQueAlcanca = (instante) => (PERIODOS_PRONTOS
  .find((periodoPronto) => RELOGIO_DO_PAINEL.agora - periodoPronto.duracao <= instante) || PERIODOS_PRONTOS[PERIODOS_PRONTOS.length - 1]).id;

const buscaComUmFiltro = (idDoPeriodo, filtro) => codificarBusca({ ...decodificarBusca(BUSCA_DE_ABERTURA), periodo: idDoPeriodo, filtros: [filtro] });

const nomeDoProdutoPorId = (idDoProduto) => (PRODUTOS.find((produto) => produto.id === idDoProduto) || PRODUTOS[0]).nome;
const nomeDoAmbientePorId = (idDoAmbiente) => (AMBIENTES.find((ambiente) => ambiente.id === idDoAmbiente) || AMBIENTES[0]).nome;

/* ---------- Peças comuns às duas telas ---------- */
const CodigoEmDestaque = ({ children, tamanho = 12.5 }) => (
  <span style={{ fontFamily: 'var(--font-mono)', fontSize: tamanho, fontWeight: 700, color: 'var(--fg)' }}>{children}</span>
);

const TituloDeColunas = ({ colunas, titulos }) => (
  <div aria-hidden style={{
    display: 'grid', gridTemplateColumns: colunas, gap: 'var(--space-3)',
    padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border-strong)',
    fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)',
  }}>
    {titulos.map((titulo) => <span key={titulo}>{titulo}</span>)}
  </div>
);

const AvisoSemInternetFixo = ({ traduzir, chaveDoQueContinua, chaveDoQueEspera }) => (
  <FaixaFixa>
    <AvisoSemInternet titulo={traduzir('semInternetTitulo')} continuaFuncionando={traduzir(chaveDoQueContinua)} espera={traduzir(chaveDoQueEspera)} />
  </FaixaFixa>
);

const BarraDeCarregando = ({ traduzir, chaveDaMensagem, chaveDoComplemento }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
    <MensagemDeEstado acao={<Button variant="secondary" compacto onClick={() => {}}>{traduzir('cancelar')}</Button>}>
      {traduzir(chaveDaMensagem)}
    </MensagemDeEstado>
    {chaveDoComplemento && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{traduzir(chaveDoComplemento)}</span>}
  </div>
);

/* ---------- Tela 1: achar tentativas ---------- */

/* O campo se escolhe em dois grupos, cada um com o nome do papel: os campos de localização
   e o campo principal. Só um fica marcado, de um grupo ou do outro. */
const SeletorDoCampoDeTentativa = ({ traduzir, camposParaAchar, idDoCampoEscolhido, aoEscolher, disabled }) => {
  const grupoDoTipo = (tipo, chaveDoRotulo) => {
    const opcoes = camposParaAchar.filter((campoParaAchar) => campoParaAchar.tipo === tipo)
      .map((campoParaAchar) => ({ valor: campoParaAchar.id, rotulo: campoParaAchar.rotulo }));
    if (opcoes.length === 0) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>{traduzir(chaveDoRotulo)}</span>
        <SeletorSegmentado rotulo={traduzir(chaveDoRotulo)} opcoes={opcoes} valor={idDoCampoEscolhido} aoEscolher={aoEscolher} disabled={disabled} />
      </div>
    );
  };
  const grupoDeLocalizacao = grupoDoTipo('localizacao', 'tentativasCampoDeLocalizacao');
  const grupoPrincipal = grupoDoTipo('principal', 'tentativasCampoPrincipal');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2) var(--space-3)', flexWrap: 'wrap' }}>
      {grupoDeLocalizacao}
      {grupoDeLocalizacao && grupoPrincipal && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{traduzir('tentativasOu')}</span>}
      {grupoPrincipal}
    </div>
  );
};

/* A abertura, antes de qualquer busca: diz o que cada tipo de campo faz. */
const ComoAcharUmaTentativa = ({ traduzir }) => (
  <section style={{ ...ESTILO_DA_CAIXA, padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
    <h2 style={ESTILO_DO_TITULO_DA_CAIXA}>{traduzir('tentativasComoFuncionaTitulo')}</h2>
    <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', maxWidth: LARGURA_DO_TEXTO_DE_AJUDA, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontSize: 13, lineHeight: 1.5 }}>
      <li>{traduzir('tentativasComoLocalizacao')}</li>
      <li>{traduzir('tentativasComoPrincipal')}</li>
      <li>{traduzir('tentativasComoPeriodo', { dias: RETENCAO_EM_DIAS })}</li>
    </ul>
  </section>
);

const LinhaDeTentativa = ({ traduzir, tentativa, estadoDemonstrado, disabled, semInternet, aoAbrir }) => (
  <li style={{ listStyle: 'none' }}>
    <Press
      disabled={disabled} onClick={semInternet ? undefined : aoAbrir} title={traduzir('tentativasAbrir', { valor: tentativa.valorDoCampo })}
      className={`linha-de-evento${estadoDemonstrado ? ` linha-de-evento--${estadoDemonstrado}` : ''}`}
      {...propriedadesDaLinhaSemInternet(traduzir, semInternet)}
      style={{
        display: 'grid', gridTemplateColumns: COLUNAS_DAS_TENTATIVAS, gap: 'var(--space-3)', alignItems: 'center',
        minHeight: ALTURA_DA_CAIXA_DE_BUSCA, padding: '6px var(--space-3)', borderBottom: '1px solid var(--border)', fontSize: 13,
        ...(semInternet ? { cursor: 'default' } : {}),
      }}
    >
      <CodigoEmDestaque tamanho={14}>{tentativa.valorDoCampo}</CodigoEmDestaque>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
        {textoDoIntervaloDeEventos(traduzir, tentativa.primeiro, tentativa.ultimo, formatarDiaEMes)}
      </span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatarQuantidade(tentativa.eventos.length)}</span>
      <span style={{ fontWeight: 700 }}>{tentativa.aplicacoes.join(', ')}</span>
      <span><NivelDoEvento nivel={tentativa.piorNivel} traduzir={traduzir} /></span>
      <span>
        {tentativaTemPerda(tentativa)
          ? <Etiqueta tom="atencao" podeQuebrar>{traduzir('tentativasComPerda')}</Etiqueta>
          : <span style={{ color: 'var(--muted)' }}>{traduzir('tentativasSemPerda')}</span>}
      </span>
    </Press>
  </li>
);

/* Nunca em branco e nunca afirma que nada aconteceu: diz o que foi olhado e o próximo passo. */
const VazioDasTentativas = ({ traduzir, campoDeLocalizacao, valor, periodo, idDoPeriodo, catalogo, temEventosSemTentativa, indisponivel, aoAmpliar, aoVerSemTentativa, aoVerNaBusca }) => (
  <EmptyState
    title={traduzir('tentativasVazioTitulo')}
    body={traduzir('tentativasVazioCorpo')}
    detalhes={(
      <ListaDeFatos emCaixa fatos={[
        [traduzir('vazioCampoEValor'), traduzir('vazioOlhouOsCampos', { campo: campoDeLocalizacao.rotulo, valor, campos: textoDoQueOCampoOlha(traduzir, campoDeLocalizacao, catalogo) })],
        ...fatosDoQueFoiOlhado(traduzir, periodo, false),
      ]} />
    )}
    acoes={(
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
        {periodo.duracao < MILISSEGUNDOS_POR_DIA && <Button variant="primary" compacto disabled={indisponivel} onClick={() => aoAmpliar('24h')}>{traduzir('vazioAmpliarPara24h')}</Button>}
        {idDoPeriodo !== '30d' && <Button variant="secondary" compacto disabled={indisponivel} onClick={() => aoAmpliar('30d')}>{traduzir('vazioAmpliarParaARetencao')}</Button>}
        {temEventosSemTentativa
          ? <Button variant="secondary" compacto onClick={aoVerSemTentativa}>{traduzir('tentativasVerSemTentativa')}</Button>
          : <Button variant="secondary" compacto disabled={indisponivel} onClick={aoVerNaBusca}>{traduzir('tentativasVerNaBusca')}</Button>}
      </div>
    )}
  />
);

const TelaTentativas = ({ lang, estado, params, papel }) => {
  const traduzir = useT(lang);
  const { navigate } = useRouter();
  const parametrosDoPainel = { ...PAINEL_DO_EXCURFLY, ...params };
  const { produto: idDoProduto, ambiente: idDoAmbiente } = parametrosDoPainel;
  const rotasDoPapel = ROTAS_DO_PAPEL[papel];
  const catalogo = useMemo(() => catalogoDoProduto(idDoProduto), [idDoProduto]);
  const camposParaAchar = useMemo(() => camposParaAcharTentativas(idDoProduto), [idDoProduto]);

  /* O que o endereço guarda: o campo de localização, o valor inteiro e o período. */
  const campoDoEndereco = camposParaAchar.find((campoParaAchar) => campoParaAchar.tipo === 'localizacao' && campoParaAchar.id === parametrosDoPainel.campo) || null;
  const valorDoEndereco = campoDoEndereco ? decodificarValor(parametrosDoPainel.valor || '') : '';
  const temBusca = Boolean(campoDoEndereco) && valorDoEndereco !== '';

  const [idDoCampoEscolhido, setIdDoCampoEscolhido] = useState(campoDoEndereco?.id || camposParaAchar[0]?.id);
  const [valorDigitado, setValorDigitado] = useState(valorDoEndereco);
  const [idDoPeriodoSemBusca, setIdDoPeriodoSemBusca] = useState(PERIODO_DE_ABERTURA_DAS_TENTATIVAS);
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [chaveDaRecusa, setChaveDaRecusa] = useState(null);
  const campoDoValorRef = useRef(null);
  const semTentativaRef = useRef(null);
  const botaoDePeriodoRef = useRef(null);

  useFocoDeVoltaAoFechar(periodoAberto ? 'periodo' : null, { periodo: botaoDePeriodoRef });

  useEffect(() => {
    setIdDoCampoEscolhido(campoDoEndereco?.id || camposParaAchar[0]?.id);
    setValorDigitado(valorDoEndereco);
    setPeriodoAberto(false);
    setChaveDaRecusa(null);
  }, [idDoProduto, idDoAmbiente, parametrosDoPainel.campo, parametrosDoPainel.valor, parametrosDoPainel.periodo]);

  useEffect(() => {
    if (!periodoAberto) return undefined;
    const fecharComEsc = (eventoDeTeclado) => { if (eventoDeTeclado.key === 'Escape') setPeriodoAberto(false); };
    window.addEventListener('keydown', fecharComEsc);
    return () => window.removeEventListener('keydown', fecharComEsc);
  }, [periodoAberto]);

  const idDoPeriodo = temBusca ? parametrosDoPainel.periodo : idDoPeriodoSemBusca;
  const periodo = useMemo(() => periodoDoId(idDoPeriodo), [idDoPeriodo]);
  const achado = useMemo(
    () => (temBusca ? acharTentativas({ idDoProduto, idDoAmbiente, campoDeLocalizacao: campoDoEndereco, valor: valorDoEndereco, periodo }) : null),
    [temBusca, idDoProduto, idDoAmbiente, campoDoEndereco, valorDoEndereco, periodo]);
  const listaSemTentativa = useMemo(() => ({
    eventos: achado ? achado.eventosSemTentativa : [],
    mostrarData: !noMesmoDia(periodo.inicio, periodo.fim - 1),
    instanteDoEvento: (evento) => evento.origemEm,
  }), [achado, periodo]);

  const desabilitado = estado === 'disabled';
  const semInternet = estado === 'offline';
  const indisponivel = desabilitado || semInternet;
  const carregando = estado === 'loading';
  const comErro = estado === 'error';
  const semTentativas = temBusca && !comErro && (estado === 'empty' || achado.tentativas.length === 0);
  const estadoDemonstrado = ESTADOS_DEMONSTRADOS.includes(estado) ? estado : null;
  const campoEscolhido = camposParaAchar.find((campoParaAchar) => campoParaAchar.id === idDoCampoEscolhido) || null;
  const ehCampoPrincipal = campoEscolhido?.tipo === 'principal';

  const parametrosDaBusca = (idDoCampo, valor, idDoPeriodoDaBusca) => (
    { produto: idDoProduto, ambiente: idDoAmbiente, campo: idDoCampo, valor: encodeURIComponent(valor), periodo: idDoPeriodoDaBusca });

  /* Campo principal abre direto a linha do tempo; campo de localização lista as tentativas. */
  const achar = () => {
    if (indisponivel || !campoEscolhido) return;
    const valorInteiro = valorDigitado.trim();
    if (!valorInteiro) { setChaveDaRecusa('tentativasErroValorVazio'); campoDoValorRef.current?.focus(); return; }
    if (ehCampoPrincipal) {
      navigate(rotasDoPapel.tentativa, { produto: idDoProduto, ambiente: idDoAmbiente, campo: campoEscolhido.id, valor: encodeURIComponent(valorInteiro) });
      return;
    }
    // O endereço guarda o código de busca, nunca o dado pessoal digitado.
    const valorNoEndereco = (campoEscolhido.codigosDeBusca && CODIGOS_DE_BUSCA_SINTETICOS[valorInteiro]) || valorInteiro;
    navigate(rotasDoPapel.tentativasAchadas, parametrosDaBusca(campoEscolhido.id, valorNoEndereco, idDoPeriodo));
  };
  const escolherPeriodo = (idDoPeriodoEscolhido) => {
    setPeriodoAberto(false);
    if (temBusca) navigate(rotasDoPapel.tentativasAchadas, parametrosDaBusca(campoDoEndereco.id, valorDoEndereco, idDoPeriodoEscolhido));
    else setIdDoPeriodoSemBusca(idDoPeriodoEscolhido);
  };
  const abrirTentativa = (tentativa) => {
    if (indisponivel) return;
    navigate(rotasDoPapel.tentativa, { produto: idDoProduto, ambiente: idDoAmbiente, campo: tentativa.nomeDoCampo, valor: encodeURIComponent(tentativa.valorDoCampo) });
  };
  const buscaDoValor = () => buscaComUmFiltro(idDoPeriodo, { campo: campoDoEndereco.campos[0], operador: 'e', valores: [valorDoEndereco] });
  /* O evento sem tentativa abre na busca de eventos, ao lado da lista de quem traz o valor. */
  const abrirEventoNaBusca = (evento) => {
    if (indisponivel) return;
    navigate(rotasDoPapel.evento, { produto: idDoProduto, ambiente: idDoAmbiente, busca: buscaDoValor(), idDoEvento: evento.id });
  };
  const verNaBusca = () => navigate(rotasDoPapel.busca, { produto: idDoProduto, ambiente: idDoAmbiente, busca: buscaDoValor() });

  /* Trocar o papel ou o ambiente mantém a busca; trocar o produto volta à abertura, porque
     os campos são de cada produto. */
  const mudarOPainel = (destino) => {
    const rotasDoDestino = ROTAS_DO_PAPEL[destino.papel || papel];
    if (temBusca && !destino.produto) {
      navigate(rotasDoDestino.tentativasAchadas, { ...parametrosDaBusca(campoDoEndereco.id, valorDoEndereco, idDoPeriodo), ambiente: destino.ambiente || idDoAmbiente });
      return;
    }
    navigate(rotasDoDestino.tentativas, { produto: destino.produto || idDoProduto, ambiente: destino.ambiente || idDoAmbiente });
  };

  return (
    <CascaDoPainel
      traduzir={traduzir} estado={estado} params={parametrosDoPainel} papel={papel} aoMudar={mudarOPainel}
      itemAtual="tentativas" campoDeBuscaRef={campoDoValorRef}
    >
      {semInternet && <AvisoSemInternetFixo traduzir={traduzir} chaveDoQueContinua="tentativasSemInternetContinua" chaveDoQueEspera="tentativasSemInternetEspera" />}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2) var(--space-3)', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.2px' }}>{traduzir('tentativasTitulo')}</h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{traduzir('tentativasSubtitulo')}</p>
      </div>

      {camposParaAchar.length === 0 && (
        <section style={{ ...ESTILO_DA_CAIXA, padding: 'var(--space-4)', fontSize: 13 }}>{traduzir('tentativasSemCampos')}</section>
      )}
      {campoEscolhido && (
        <React.Fragment>
          <SeletorDoCampoDeTentativa
            traduzir={traduzir} camposParaAchar={camposParaAchar} idDoCampoEscolhido={idDoCampoEscolhido} disabled={desabilitado}
            aoEscolher={(idDoCampo) => { setIdDoCampoEscolhido(idDoCampo); setChaveDaRecusa(null); campoDoValorRef.current?.focus(); }}
          />
          <BarraDeBusca
            traduzir={traduzir} garantida focarAoAbrir={!temBusca}
            desabilitado={desabilitado} buscaIndisponivel={indisponivel} campoDeBuscaRef={campoDoValorRef}
            rotuloDaCaixa={traduzir('tentativasValor', { campo: campoEscolhido.rotulo })}
            rotuloDoBotao={traduzir(ehCampoPrincipal ? 'tentativasAbrirLinhaDoTempo' : 'tentativasAchar')}
            dica={dicaDoCampoParaAchar(traduzir, campoEscolhido, catalogo)}
            classeDoBotao={classeDoEstadoDemonstrado(estadoDemonstrado)}
            textoDigitado={valorDigitado} aoDigitar={(valorNovo) => { setValorDigitado(valorNovo); setChaveDaRecusa(null); }}
            chaveDaRecusa={chaveDaRecusa} aoBuscar={achar}
            aoLimparTexto={() => { setValorDigitado(''); campoDoValorRef.current?.focus(); }}
          />
          <div style={{ display: 'flex' }}>
            <SeletorDePeriodo
              traduzir={traduzir} busca={{ periodo: idDoPeriodo, base: 'origem' }} periodo={periodo} liberaToda
              indisponivel={indisponivel} aberto={periodoAberto} botaoRef={botaoDePeriodoRef}
              aoAbrir={() => setPeriodoAberto(true)} aoFechar={() => setPeriodoAberto(false)} aoEscolherPeriodo={escolherPeriodo}
            />
          </div>
        </React.Fragment>
      )}

      {comErro && (
        <AvisoDeErro
          titulo={traduzir('tentativasErroTitulo')} corpo={traduzir('tentativasErroCorpo')}
          acao={<div><Button variant="secondary" compacto onClick={() => {}}>{traduzir('tentarDeNovo')}</Button></div>}
        />
      )}

      {!temBusca && !comErro && carregando && (
        <section style={ESTILO_DA_CAIXA}><BarraDeCarregando traduzir={traduzir} chaveDaMensagem="buscando" /></section>
      )}
      {!temBusca && !comErro && camposParaAchar.length > 0 && <ComoAcharUmaTentativa traduzir={traduzir} />}

      {temBusca && !comErro && (
        <section style={ESTILO_DA_CAIXA}>
          <div style={ESTILO_DA_BARRA_DA_CAIXA}>
            {!semTentativas && (
              <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {traduzir(achado.tentativas.length === 1 ? 'tentativasContagemUma' : 'tentativasContagem',
                  { quantidade: achado.tentativas.length, campo: campoDoEndereco.rotulo, valor: valorDoEndereco })}
              </span>
            )}
            {!semTentativas && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{traduzir('buscaMaisRecentesPrimeiro')}</span>}
            <span title={traduzir('buscaDadosAteNota')} style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              {traduzir('buscaDadosAte', { dadosAte: formatarHoraComSegundos(RELOGIO_DO_PAINEL.dadosAte) })}
            </span>
          </div>
          {carregando && <BarraDeCarregando traduzir={traduzir} chaveDaMensagem="buscando" chaveDoComplemento="buscaResultadoAnterior" />}
          {semTentativas
            ? (
              <VazioDasTentativas
                traduzir={traduzir} campoDeLocalizacao={campoDoEndereco} valor={valorDoEndereco} periodo={periodo} idDoPeriodo={idDoPeriodo}
                catalogo={catalogo} temEventosSemTentativa={achado.eventosSemTentativa.length > 0} indisponivel={indisponivel}
                aoAmpliar={escolherPeriodo} aoVerNaBusca={verNaBusca}
                aoVerSemTentativa={() => { semTentativaRef.current?.scrollIntoView({ block: 'start' }); semTentativaRef.current?.focus({ preventScroll: true }); }}
              />
            )
            : (
              <React.Fragment>
                <TituloDeColunas colunas={COLUNAS_DAS_TENTATIVAS} titulos={[
                  traduzir('tentativasColunaTentativa'), traduzir('tentativasColunaPeriodo'), traduzir('tentativasColunaEventos'),
                  traduzir('tentativasColunaAplicacoes'), traduzir('tentativasColunaPiorNivel'), traduzir('tentativasColunaPerda'),
                ]} />
                <ol aria-label={traduzir('tentativasLista')} aria-busy={carregando || undefined} style={{ margin: 0, padding: 0 }}>
                  {achado.tentativas.map((tentativa, indiceDaTentativa) => (
                    <LinhaDeTentativa
                      key={tentativa.valorDoCampo} traduzir={traduzir} tentativa={tentativa} disabled={desabilitado} semInternet={semInternet}
                      estadoDemonstrado={indiceDaTentativa === 1 ? estadoDemonstrado : null} aoAbrir={() => abrirTentativa(tentativa)}
                    />
                  ))}
                </ol>
              </React.Fragment>
            )}
        </section>
      )}

      {temBusca && !comErro && achado.eventosSemTentativa.length > 0 && (
        <section ref={semTentativaRef} tabIndex={-1} aria-label={traduzir('semTentativaTitulo')} style={ESTILO_DA_CAIXA}>
          <div style={{ ...ESTILO_DA_BARRA_DA_CAIXA, alignItems: 'baseline' }}>
            <h2 style={ESTILO_DO_TITULO_DA_CAIXA}>{traduzir('semTentativaTitulo')}</h2>
            <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {textoDaContagemDeEventosSimples(traduzir, achado.eventosSemTentativa.length)}
            </span>
            <p style={{ ...ESTILO_DO_TEXTO_DE_APOIO, flexBasis: '100%' }}>
              {traduzir('semTentativaCorpo', { campo: campoDoEndereco.rotulo, valor: valorDoEndereco })}
            </p>
          </div>
          <ListaDeEventos
            traduzir={traduzir} resultado={listaSemTentativa} estado={estado === 'loading' ? 'default' : estado} semCursor
            rotulo={traduzir('semTentativaLista', { campo: campoDoEndereco.rotulo, valor: valorDoEndereco })}
            aoAbrir={abrirEventoNaBusca} aoFechar={() => {}}
          />
        </section>
      )}
    </CascaDoPainel>
  );
};

/* ---------- Tela 2: a linha do tempo de uma tentativa ---------- */

/* Quem rola de verdade em volta de um elemento: o miolo do painel, quando a moldura tem
   altura fixa, ou a página inteira, quando a tela cresce com o conteúdo (o print). */
const areaRolavelDoElemento = (elemento) => {
  let candidato = elemento.parentElement;
  while (candidato && candidato !== document.documentElement) {
    const podeRolar = ['auto', 'scroll'].includes(getComputedStyle(candidato).overflowY);
    if (podeRolar && candidato.scrollHeight > candidato.clientHeight) return candidato;
    candidato = candidato.parentElement;
  }
  return document.documentElement;
};

/* O que vai na coluna da mensagem de cada linha: a mensagem como a aplicação mandou, as
   marcas do evento e, à direita, por que ele está na tentativa (o vínculo de correlação).
   `estreita` é a coluna com um evento aberto ao lado: a mensagem quebra e o vínculo desce
   para a linha de baixo, inteiro. */
const MioloDaLinhaDoTempo = ({ traduzir, entrada, estreita }) => {
  const { evento } = entrada;
  const marcas = evento.marcas || [];
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px var(--space-2)', minWidth: 0 }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 12.5, minWidth: 0,
        ...(estreita ? { flexBasis: '100%', wordBreak: 'break-word' } : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
      }}>
        {evento.mensagem}
      </span>
      {evento.atrasado && (
        <Etiqueta tom="atencao">
          {traduzir('marcaRecebidoDepois', { horario: formatarHoraComSegundos(evento.recebidoEm), diferenca: textoDaDuracao(traduzir, evento.recebidoEm - evento.origemEm) })}
        </Etiqueta>
      )}
      {entraPeloRecebimento(evento) && <Etiqueta tom="atencao">{traduzir('marcaEntrouPeloRecebimento')}</Etiqueta>}
      {marcas.includes('cortado') && <Etiqueta tom="atencao">{traduzir('marcaCortadoCurta')}</Etiqueta>}
      {entrada.mesmoHorario && <Etiqueta tom="atencao" podeQuebrar>{traduzir('marcaMesmoHorario')}</Etiqueta>}
      {entrada.outrasTentativas.map((outraTentativa) => (
        <Etiqueta key={idDoCodigo(outraTentativa)} tom="destaque">{traduzir('marcaTambemNaTentativa', { valor: outraTentativa.valor })}</Etiqueta>
      ))}
      <span style={{ fontSize: 12, color: 'var(--muted)', ...(estreita ? { flexBasis: '100%' } : { marginLeft: 'auto' }) }}>
        {traduzir('linhaLigadoPor')}{' '}
        {entrada.vinculos.map((vinculo, indiceDoVinculo) => (
          <React.Fragment key={idDoCodigo(vinculo)}>
            {indiceDoVinculo > 0 && ` ${traduzir('fichaE')} `}
            <span style={{ whiteSpace: 'nowrap' }}><CodigoEmDestaque tamanho={12}>{textoDoCodigo(traduzir, vinculo)}</CodigoEmDestaque></span>
          </React.Fragment>
        ))}
      </span>
    </span>
  );
};

const textoDaOcorrencia = (traduzir, ocorrencia) => (ocorrencia.encerradaEm
  ? traduzir('tentativaOcorrenciaComFim', { ocorrencia: ocorrencia.id, familia: ocorrencia.familia, duracao: textoDaDuracao(traduzir, ocorrencia.encerradaEm - ocorrencia.iniciadaEm) })
  : traduzir('tentativaOcorrenciaSemFim', { ocorrencia: ocorrencia.id, familia: ocorrencia.familia }));

/* A corrente de códigos, na ordem em que cada código entrou. A seta só liga códigos. */
const CorrenteDeCodigos = ({ corrente }) => (
  <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-1)' }}>
    {corrente.map((codigo, indiceDoCodigo) => (
      <React.Fragment key={idDoCodigo(codigo)}>
        {indiceDoCodigo > 0 && <span aria-hidden style={{ color: 'var(--muted)' }}>→</span>}
        <span title={codigo.nomeDoCampo}><CodigoEmDestaque tamanho={13}>{codigo.valor}</CodigoEmDestaque></span>
      </React.Fragment>
    ))}
  </span>
);

/* O cabeçalho fica na tela em todo estado: diz de que tentativa se fala. Os fatos (período
   coberto, eventos, corrente) só aparecem quando a linha do tempo veio. */
const CabecalhoDaTentativa = ({ traduzir, nomeDoCampo, valorDoCampo, tentativa, indisponivel, veioDeUmEvento, estadoDemonstrado, aoVoltarParaOEvento, aoVerNaBusca }) => {
  const pares = tentativa && [
    [traduzir('tentativaPeriodoCoberto'), traduzir('periodoComFuso', {
      periodo: textoDoIntervaloDeEventos(traduzir, tentativa.primeiro, tentativa.ultimo, formatarData), fuso: FUSO_DO_PAINEL.rotulo,
    }), true],
    [traduzir('tentativaEventosEAplicacoes'), traduzir('tentativaEventosDasAplicacoes', {
      quantidade: formatarQuantidade(tentativa.eventos.length), aplicacoes: tentativa.aplicacoes.join(', '),
    })],
    ...tentativa.ocorrencias.map((ocorrencia) => [traduzir('campoOcorrencia'), textoDaOcorrencia(traduzir, ocorrencia)]),
    [traduzir('tentativaCorrente'), <CorrenteDeCodigos corrente={tentativa.corrente} />],
  ];
  return (
    <header style={{ ...ESTILO_DA_CAIXA, overflow: 'visible', padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2) var(--space-3)', flexWrap: 'wrap' }}>
        <IconBranch size={18} style={{ color: 'var(--muted)' }} />
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.2px', display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <span>{traduzir('tentativaTitulo')}</span>
          <CodigoEmDestaque tamanho={17}>{textoDoCodigo(traduzir, { nomeDoCampo, valor: valorDoCampo })}</CodigoEmDestaque>
        </h1>
        <Etiqueta tom="destaque">{traduzir('etiquetaCampoPrincipal')}</Etiqueta>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {veioDeUmEvento && (
            <Button variant="ghost" compacto disabled={indisponivel} onClick={aoVoltarParaOEvento}>{traduzir('tentativaVoltarParaOEvento')}</Button>
          )}
          <Button
            variant="secondary" compacto disabled={indisponivel} className={classeDoEstadoDemonstrado(estadoDemonstrado)}
            title={traduzir('tentativaVerNaBuscaNota', { campo: nomeDoCampo, valor: valorDoCampo })} onClick={aoVerNaBusca}
          >
            {traduzir('tentativaVerNaBusca')}<IconArrow size={14} />
          </Button>
        </div>
      </div>
      {pares && <ParesDoEvento pares={pares} emLinha />}
    </header>
  );
};

/* Os avisos da linha do tempo. Nenhum afirma que o fato não ocorreu: dizem por que podem
   faltar eventos, ou que um código está em duas tentativas. `resumidos` deixa só o título
   de cada um, para a linha do tempo caber ao lado do evento aberto. */
const AvisosDaTentativa = ({ traduzir, tentativa, indisponivel, resumidos, aoAbrirOutraTentativa }) => {
  const textoDasPerdas = tentativa.perdas.map((perda) => traduzir(perda.quantidade === 1 ? 'avisoPerdaItemUm' : 'avisoPerdaItem', {
    quantidade: formatarQuantidade(perda.quantidade), aplicacao: perda.aplicacao, horario: textoDoHorarioProximo(perda.informadaEm), motivo: perda.motivo,
  })).join('; ');
  const frasesDaPerda = [
    ...(tentativa.perdas.length > 0 ? [traduzir('avisoPerdaCorpo', { perdas: textoDasPerdas })] : []),
    ...tentativa.execucoesSemEncerramento.map((execucao) => traduzir('avisoExecucaoSemEncerramento', {
      execucao: execucao.execucao, aplicacao: execucao.aplicacao, horario: textoDoHorarioProximo(execucao.ultimoInformeEm),
    })),
  ];
  return (
    <React.Fragment>
      {frasesDaPerda.length > 0 && <AvisoDeAtencao titulo={traduzir('avisoPerdaTitulo')} corpo={!resumidos && frasesDaPerda.join(' ')} />}
      {tentativa.codigosEmComum.flatMap((codigoEmComum) => codigoEmComum.outrasTentativas.map((outraTentativa) => (
        <AvisoDeAtencao
          key={`${idDoCodigo(codigoEmComum)}:${idDoCodigo(outraTentativa)}`}
          titulo={traduzir('avisoCodigoEmComumTitulo', { codigo: textoDoCodigo(traduzir, codigoEmComum) })}
          corpo={!resumidos && traduzir('avisoCodigoEmComumCorpo', { outra: outraTentativa.valor })}
          acao={(
            <Button variant="secondary" compacto disabled={indisponivel} onClick={() => aoAbrirOutraTentativa(outraTentativa)}>
              {traduzir('avisoCodigoEmComumAbrir', { valor: outraTentativa.valor })}<IconArrow size={14} />
            </Button>
          )}
        />
      )))}
      {tentativa.camposLigadosDepois.map((campo) => (
        <AvisoDeAtencao
          key={campo.nome}
          titulo={traduzir('avisoCampoLigadoDepoisTitulo', { campo: campo.nome, horario: textoDoHorarioProximo(campo.correlacaoDesde) })}
          corpo={!resumidos && traduzir('avisoCampoLigadoDepoisCorpo')}
        />
      ))}
    </React.Fragment>
  );
};

/* O esqueleto ocupa a mesma caixa da linha do tempo. No painel de verdade ele só aparece
   se a abertura passar de 1 s; antes disso, nada muda na tela. */
const EsqueletoDaLinhaDoTempo = ({ traduzir }) => (
  <section aria-busy="true" style={ESTILO_DA_CAIXA}>
    <BarraDeCarregando traduzir={traduzir} chaveDaMensagem="linhaDoTempoAbrindo" />
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: LINHAS_DO_ESQUELETO_DA_LINHA_DO_TEMPO }, (_, indiceDaLinha) => (
        <div key={indiceDaLinha} style={{ display: 'flex', alignItems: 'center', minHeight: ALTURA_DA_LINHA_DE_EVENTO, padding: '0 var(--space-3)', borderBottom: '1px solid var(--border)' }}>
          <Skeleton largura={`${92 - (indiceDaLinha % 4) * 9}%`} />
        </div>
      ))}
    </div>
  </section>
);

const TelaTentativa = ({ lang, estado, params, papel }) => {
  const traduzir = useT(lang);
  const { navigate } = useRouter();
  const parametrosDoPainel = { ...PAINEL_DO_EXCURFLY, ...params };
  const { produto: idDoProduto, ambiente: idDoAmbiente, campo: nomeDoCampo, idDoEvento: idDoEventoAberto, secao } = parametrosDoPainel;
  const valorDoCampo = decodificarValor(parametrosDoPainel.valor || '');
  const rotasDoPapel = ROTAS_DO_PAPEL[papel];
  const temEventoAberto = Boolean(idDoEventoAberto);

  const catalogo = useMemo(() => catalogoDoProduto(idDoProduto), [idDoProduto]);
  const tentativa = useMemo(
    () => montarTentativa({ idDoProduto, idDoAmbiente, nomeDoCampo, valorDoCampo }),
    [idDoProduto, idDoAmbiente, nomeDoCampo, valorDoCampo]);
  const entradasPorEvento = useMemo(() => new Map(tentativa.entradas.map((entrada) => [entrada.evento.id, entrada])), [tentativa]);
  const eventosSemVinculo = useMemo(() => eventosDeMesmoHorarioSemVinculo({ idDoProduto, idDoAmbiente, tentativa }), [idDoProduto, idDoAmbiente, tentativa]);
  const linhaDoTempo = useMemo(() => ({ eventos: tentativa.eventos, mostrarData: tentativa.cruzaDias, instanteDoEvento: instanteNaLinhaDoTempo }), [tentativa]);
  const listaSemVinculo = useMemo(() => ({ eventos: eventosSemVinculo, mostrarData: tentativa.cruzaDias, instanteDoEvento: instanteNaLinhaDoTempo }), [eventosSemVinculo, tentativa]);

  const [secaoDoEvento, setSecaoDoEvento] = useState(undefined);
  const colunaRef = useRef(null);
  const semVinculoRef = useRef(null);
  useEffect(() => { setSecaoDoEvento(undefined); }, [idDoEventoAberto]);

  const desabilitado = estado === 'disabled';
  const semInternet = estado === 'offline';
  const indisponivel = desabilitado || semInternet;
  /* Com um evento aberto, carregando, vazio e erro falam do evento: a linha do tempo continua na tela. */
  const estadoDaLinhaDoTempo = temEventoAberto && ['loading', 'empty', 'error'].includes(estado) ? 'default' : estado;
  const carregando = estadoDaLinhaDoTempo === 'loading';
  const comErro = estadoDaLinhaDoTempo === 'error';
  const vazio = !carregando && !comErro && (estadoDaLinhaDoTempo === 'empty' || tentativa.eventos.length === 0);
  const mostraALinhaDoTempo = !carregando && !comErro && !vazio;
  const estadoDemonstrado = ESTADOS_DEMONSTRADOS.includes(estado) ? estado : null;
  const indiceDoEventoAberto = tentativa.eventos.findIndex((evento) => evento.id === idDoEventoAberto);
  const eventoAberto = tentativa.eventos[indiceDoEventoAberto] || null;

  /* A parte do endereço já aparece rolada, sem animação: o link abre a linha do tempo nela.
     Sem parte, abre no topo. Refaz a conta quando as fontes chegam, porque as alturas mudam. */
  const rolarAteAParte = () => {
    if (!colunaRef.current) return;
    const areaRolavel = areaRolavelDoElemento(colunaRef.current);
    const alvo = secao === SECAO_SEM_VINCULO ? semVinculoRef.current : null;
    if (!alvo) { areaRolavel.scrollTop = 0; return; }
    /* A moldura do showcase pode estar em escala: a distância na tela volta à medida da página. */
    const caixaDaArea = areaRolavel.getBoundingClientRect();
    const escala = caixaDaArea.height / areaRolavel.offsetHeight || 1;
    areaRolavel.scrollTop += (alvo.getBoundingClientRect().top - caixaDaArea.top) / escala - MARGEM_ACIMA_DA_PARTE;
  };
  React.useLayoutEffect(() => {
    rolarAteAParte();
    let aindaMontado = true;
    document.fonts?.ready.then(() => { if (aindaMontado) rolarAteAParte(); });
    return () => { aindaMontado = false; };
  }, [nomeDoCampo, valorDoCampo, secao, mostraALinhaDoTempo]);

  const parametrosDaTentativa = { produto: idDoProduto, ambiente: idDoAmbiente, campo: nomeDoCampo, valor: encodeURIComponent(valorDoCampo) };
  const { parametrosDoEvento } = ORIGEM_DA_TENTATIVA;
  const veioDeUmEvento = Boolean(parametrosDoEvento)
    && parametrosDoEvento.produto === idDoProduto && parametrosDoEvento.ambiente === idDoAmbiente
    && ORIGEM_DA_TENTATIVA.nomeDoCampo === nomeDoCampo && ORIGEM_DA_TENTATIVA.valorDoCampo === valorDoCampo;
  const idDoPeriodoDaBusca = tentativa.eventos.length ? periodoProntoQueAlcanca(tentativa.primeiro) : PERIODO_DE_ABERTURA_DAS_TENTATIVAS;

  /* Abrir outro evento pede o servidor: sem internet, só o que já está aberto continua. */
  const abrirEvento = (evento) => { if (!indisponivel) navigate(rotasDoPapel.eventoDaTentativa, { ...parametrosDaTentativa, idDoEvento: evento.id }); };
  const fecharEvento = () => navigate(rotasDoPapel.tentativa, parametrosDaTentativa);
  const abrirEventoVizinho = (passo) => {
    const eventoVizinho = indiceDoEventoAberto >= 0 && tentativa.eventos[indiceDoEventoAberto + passo];
    if (eventoVizinho) abrirEvento(eventoVizinho);
  };
  const irParaAParte = (idDaParte) => (idDaParte
    ? navigate(rotasDoPapel.secaoDaTentativa, { ...parametrosDaTentativa, secao: idDaParte })
    : navigate(rotasDoPapel.tentativa, parametrosDaTentativa));
  const abrirOutraTentativa = (codigoPrincipal) => navigate(rotasDoPapel.tentativa, {
    produto: idDoProduto, ambiente: idDoAmbiente, campo: codigoPrincipal.nomeDoCampo, valor: encodeURIComponent(codigoPrincipal.valor),
  });
  const irParaABusca = (filtro) => navigate(rotasDoPapel.busca, { produto: idDoProduto, ambiente: idDoAmbiente, busca: buscaComUmFiltro(idDoPeriodoDaBusca, filtro) });
  const verNaBusca = () => irParaABusca({ campo: nomeDoCampo, operador: 'e', valores: [valorDoCampo] });
  /* O evento sem vínculo abre na busca de eventos, pelo valor de localização que ele traz. */
  const abrirEventoSemVinculo = (evento) => {
    if (indisponivel) return;
    const [localizacao] = valoresDeLocalizacaoDoEvento(evento, catalogo.filter((campo) => campo.papel === 'localizacao'));
    navigate(rotasDoPapel.evento, {
      produto: idDoProduto, ambiente: idDoAmbiente, idDoEvento: evento.id,
      busca: buscaComUmFiltro(idDoPeriodoDaBusca, { campo: localizacao.nomeDoCampo, operador: 'e', valores: [localizacao.valor] }),
    });
  };

  /* Trocar o papel mantém a tentativa (e o evento aberto); trocar produto ou ambiente volta
     à abertura das tentativas. */
  const mudarOPainel = (destino) => {
    if (!destino.papel) {
      navigate(rotasDoPapel.tentativas, { produto: destino.produto || idDoProduto, ambiente: destino.ambiente || idDoAmbiente });
      return;
    }
    const rotasDoDestino = ROTAS_DO_PAPEL[destino.papel];
    if (temEventoAberto) navigate(rotasDoDestino.eventoDaTentativa, { ...parametrosDaTentativa, idDoEvento: idDoEventoAberto });
    else if (secao) navigate(rotasDoDestino.secaoDaTentativa, { ...parametrosDaTentativa, secao });
    else navigate(rotasDoDestino.tentativa, parametrosDaTentativa);
  };

  const partesDaLinhaDoTempo = [
    { id: undefined, rotulo: traduzir('linhaDoTempoTitulo') },
    { id: SECAO_SEM_VINCULO, rotulo: traduzir('semVinculoTitulo') },
  ];

  return (
    <CascaDoPainel traduzir={traduzir} estado={estado} params={parametrosDoPainel} papel={papel} aoMudar={mudarOPainel} itemAtual="tentativas" cabeNaJanela>
      {semInternet && <AvisoSemInternetFixo traduzir={traduzir} chaveDoQueContinua="tentativaSemInternetContinua" chaveDoQueEspera="tentativaSemInternetEspera" />}

      <CabecalhoDaTentativa
        traduzir={traduzir} nomeDoCampo={nomeDoCampo} valorDoCampo={valorDoCampo} tentativa={mostraALinhaDoTempo ? tentativa : null}
        indisponivel={indisponivel} veioDeUmEvento={veioDeUmEvento} estadoDemonstrado={estadoDemonstrado}
        aoVoltarParaOEvento={() => navigate(rotasDoPapel.evento, parametrosDoEvento)} aoVerNaBusca={verNaBusca}
      />

      {comErro && (
        <AvisoDeErro
          titulo={traduzir('tentativaErroTitulo')} corpo={traduzir('tentativaErroCorpo')}
          acao={<div><Button variant="secondary" compacto onClick={() => {}}>{traduzir('tentarDeNovo')}</Button></div>}
        />
      )}
      {carregando && <EsqueletoDaLinhaDoTempo traduzir={traduzir} />}
      {vazio && (
        <section style={ESTILO_DA_CAIXA}>
          <EmptyState
            title={traduzir('tentativaVazioTitulo', { codigo: textoDoCodigo(traduzir, { nomeDoCampo, valor: valorDoCampo }) })}
            body={traduzir('tentativaVazioCorpo')}
            detalhes={(
              <ListaDeFatos emCaixa fatos={[
                [traduzir('vazioCampoPrincipalEValor'), <CodigoEmDestaque>{textoDoCodigo(traduzir, { nomeDoCampo, valor: valorDoCampo })}</CodigoEmDestaque>],
                ...fatosDoQueFoiOlhado(traduzir, periodoDoId('30d'), false),
              ]} />
            )}
            acoes={(
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button variant="primary" compacto disabled={indisponivel} onClick={() => navigate(rotasDoPapel.tentativas, { produto: idDoProduto, ambiente: idDoAmbiente })}>
                  {traduzir('tentativaVoltarAsTentativas')}
                </Button>
              </div>
            )}
          />
        </section>
      )}

      {mostraALinhaDoTempo && (
        <div style={temEventoAberto ? {
          flex: '1 1 0', minHeight: ALTURA_MINIMA_COM_EVENTO_ABERTO, display: 'grid', gap: 'var(--space-3)',
          gridTemplateColumns: COLUNAS_DA_LINHA_DO_TEMPO_COM_EVENTO, gridTemplateRows: 'minmax(0, 1fr)',
        } : undefined}>
          <div
            ref={colunaRef} className={temEventoAberto ? 'rolagem-propria' : undefined}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0, ...(temEventoAberto ? { minHeight: 0, overflowY: 'auto' } : {}) }}
          >
            <AvisosDaTentativa
              traduzir={traduzir} tentativa={tentativa} indisponivel={indisponivel} resumidos={temEventoAberto}
              aoAbrirOutraTentativa={abrirOutraTentativa}
            />

            <section aria-label={traduzir('linhaDoTempoTitulo')} style={ESTILO_DA_CAIXA}>
              <div style={ESTILO_DA_BARRA_DA_CAIXA}>
                <h2 style={ESTILO_DO_TITULO_DA_CAIXA}>{traduzir('linhaDoTempoTitulo')}</h2>
                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{textoDaContagemDeEventosSimples(traduzir, tentativa.eventos.length)}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{traduzir('linhaDoTempoOrdem')}</span>
                {eventosSemVinculo.length > 0 && (
                  <nav aria-label={traduzir('linhaDoTempoPartes')} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginRight: 'var(--space-1)' }}>{traduzir('eventoIrPara')}</span>
                    {partesDaLinhaDoTempo.map((parte) => (
                      <Button
                        key={parte.rotulo} compacto variant={parte.id === secao ? 'secondary' : 'ghost'}
                        aria-current={parte.id === secao ? 'true' : undefined} disabled={desabilitado} onClick={() => irParaAParte(parte.id)}
                      >
                        {parte.rotulo}
                      </Button>
                    ))}
                  </nav>
                )}
              </div>
              <ListaDeEventos
                traduzir={traduzir} resultado={linhaDoTempo} estado={estadoDaLinhaDoTempo}
                rotulo={traduzir('linhaDoTempoLista', { valor: valorDoCampo })}
                mioloDaLinha={(evento) => <MioloDaLinhaDoTempo traduzir={traduzir} entrada={entradasPorEvento.get(evento.id)} estreita={temEventoAberto} />}
                idDoEventoAberto={idDoEventoAberto} eventoAbertoExiste={Boolean(eventoAberto) && estado !== 'empty'}
                aoAbrir={abrirEvento} aoFechar={fecharEvento}
              />
              <p style={{ ...ESTILO_DO_TEXTO_DE_APOIO, padding: 'var(--space-2) var(--space-3)' }}>
                {traduzir('linhaDoTempoNotaDaOrdem')}{' '}
                {traduzir('linhaDoTempoProcurado', { dadosDesde: formatarData(RELOGIO_DO_PAINEL.dadosDesde) })}{'. '}
                {traduzir('buscaDadosAte', { dadosAte: formatarHoraComSegundos(RELOGIO_DO_PAINEL.dadosAte) })}.
              </p>
            </section>

            {eventosSemVinculo.length > 0 && (
              <section ref={semVinculoRef} aria-label={traduzir('semVinculoTitulo')} style={ESTILO_DA_CAIXA}>
                <div style={{ ...ESTILO_DA_BARRA_DA_CAIXA, alignItems: 'baseline' }}>
                  <h2 style={ESTILO_DO_TITULO_DA_CAIXA}>{traduzir('semVinculoTitulo')}</h2>
                  <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{textoDaContagemDeEventosSimples(traduzir, eventosSemVinculo.length)}</span>
                  <p style={{ ...ESTILO_DO_TEXTO_DE_APOIO, flexBasis: '100%' }}>{traduzir('semVinculoCorpo', { segundos: SEGUNDOS_DO_MESMO_HORARIO })}</p>
                </div>
                <ListaDeEventos
                  traduzir={traduzir} resultado={listaSemVinculo} estado={estadoDaLinhaDoTempo} semCursor
                  rotulo={traduzir('semVinculoLista', { valor: valorDoCampo })} aoAbrir={abrirEventoSemVinculo} aoFechar={() => {}}
                />
              </section>
            )}
          </div>

          {temEventoAberto && (
            <PainelDoEvento
              traduzir={traduzir} estado={estado} evento={eventoAberto} idDoEvento={idDoEventoAberto}
              catalogo={catalogo} filtrosDaBusca={[]} nomeDoProduto={nomeDoProdutoPorId(idDoProduto)} nomeDoAmbiente={nomeDoAmbientePorId(idDoAmbiente)}
              posicaoNaPagina={indiceDoEventoAberto} eventosNaPagina={tentativa.eventos.length}
              enderecoDoEvento={`${window.location.origin}${window.location.pathname}${buildPath(rotasDoPapel.eventoDaTentativa, { ...parametrosDaTentativa, idDoEvento: idDoEventoAberto })}`}
              secao={secaoDoEvento} aoIrParaSecao={setSecaoDoEvento}
              aoFechar={fecharEvento} aoIrParaVizinho={abrirEventoVizinho} aoFiltrar={irParaABusca}
              aoAbrirTentativa={(nomeDoCampoPrincipal, valorDoCampoPrincipal) => abrirOutraTentativa({ nomeDoCampo: nomeDoCampoPrincipal, valor: valorDoCampoPrincipal })}
              tentativaAberta={{ nomeDoCampo, valorDoCampo }} chavesDeTexto={TEXTOS_DO_EVENTO_NA_LINHA_DO_TEMPO}
            />
          )}
        </div>
      )}
    </CascaDoPainel>
  );
};

const TelaTentativasInvestigador = (propriedades) => <TelaTentativas {...propriedades} papel="investigador" />;
const TelaTentativasAdministrador = (propriedades) => <TelaTentativas {...propriedades} papel="administrador" />;
const TelaTentativaInvestigador = (propriedades) => <TelaTentativa {...propriedades} papel="investigador" />;
const TelaTentativaAdministrador = (propriedades) => <TelaTentativa {...propriedades} papel="administrador" />;
