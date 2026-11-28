// Monitora AI — Busca de eventos no painel do computador (Prototipar a busca de eventos).
// Produto, ambiente e período sempre à vista; filtro por clique, em fichas; página de 100
// eventos; avisos de busca lenta, resultado parcial, "rápido desde" e nada encontrado.
// A busca inteira mora no endereço: o link reabre a mesma busca.
// Enter ou clique numa linha abre o evento ao lado da lista (evento.jsx); o evento aberto
// também mora no endereço.

const EVENTOS_POR_PAGINA = 100;
const LIMITE_DE_EVENTOS_DA_BUSCA = 5000;
const LIMITE_DE_LETRAS_DO_TEXTO = 1000;
const SEGUNDOS_DA_BUSCA_LENTA = 10;
/* Quanto do período a busca lenta consegue olhar antes de parar, neste protótipo. */
const ALCANCE_DA_BUSCA_LENTA = 3 * MILISSEGUNDOS_POR_HORA;
const BUSCA_DE_ABERTURA = 'p=1h';

const ALTURA_DA_LINHA_DE_EVENTO = 34;
const ALTURA_DA_CAIXA_DE_BUSCA = 40;
const ALTURA_DO_SELETOR_DE_PERIODO = 34;
const LARGURA_DO_PAINEL_DE_FILTRO = 760;
const LARGURA_DO_PAINEL_DE_PERIODO = 540;
const ALTURA_MAXIMA_DA_LISTA_DE_CAMPOS = 328;
const COLUNAS_DA_LISTA = { semData: '112px 64px 84px 1fr', comData: '156px 64px 84px 1fr' };
const COLUNAS_DO_CATALOGO = '1fr 112px 136px 136px';
/* Com um evento aberto, a lista e o evento dividem o que sobra da tela, cada um com a
   sua rolagem. */
const COLUNAS_COM_EVENTO_ABERTO = 'minmax(0, 5fr) minmax(0, 7fr)';
const ALTURA_MINIMA_COM_EVENTO_ABERTO = 520;

const PERIODOS_PRONTOS = [
  { id: '1h', chave: 'periodoUltimaHora', duracao: MILISSEGUNDOS_POR_HORA },
  { id: '24h', chave: 'periodoUltimas24h', duracao: MILISSEGUNDOS_POR_DIA },
  { id: '7d', chave: 'periodoUltimos7Dias', duracao: 7 * MILISSEGUNDOS_POR_DIA },
  { id: '30d', chave: 'periodoTodaARetencao', duracao: RETENCAO_EM_DIAS * MILISSEGUNDOS_POR_DIA },
];

/* Operadores da ficha, pelo código que vai no endereço. Sem linguagem de consulta: a
   pessoa escolhe o campo, o operador e o valor por clique. */
const OPERADORES = {
  e: { chave: 'operadorE', busca: 'exata' },
  n: { chave: 'operadorNaoE', busca: 'exata', nega: true },
  c: { chave: 'operadorComecaCom', busca: 'comeco' },
  nc: { chave: 'operadorNaoComecaCom', busca: 'comeco', nega: true },
  p: { chave: 'operadorTemAsPalavras', busca: 'palavras' },
  i: { chave: 'operadorEntre', busca: 'intervalo' },
};

const CHAVE_DO_TIPO = { texto: 'tipoTexto', numero: 'tipoNumero', data: 'tipoDataEHora', booleano: 'tipoVerdadeiroFalso', url: 'tipoUrl', codigo: 'tipoCodigoDeBusca' };
const CHAVE_DA_BUSCA_PERMITIDA = { exata: 'buscaExata', comeco: 'buscaComeco', palavras: 'buscaPalavras', intervalo: 'buscaIntervalo' };
const CHAVE_DO_PAPEL = { principal: 'papelCampoPrincipal', correlacao: 'papelCampoDeCorrelacao', localizacao: 'papelCampoDeLocalizacao', origem: 'papelOrigem' };

/* ---------- Horários, sempre no fuso do painel ---------- */
const comDoisDigitos = (numero) => String(numero).padStart(2, '0');

const partesDoInstante = (instante) => {
  const dataNoFuso = new Date(instante + FUSO_DO_PAINEL.deslocamentoEmMinutos * MILISSEGUNDOS_POR_MINUTO);
  return {
    ano: String(dataNoFuso.getUTCFullYear()),
    mes: comDoisDigitos(dataNoFuso.getUTCMonth() + 1),
    dia: comDoisDigitos(dataNoFuso.getUTCDate()),
    hora: comDoisDigitos(dataNoFuso.getUTCHours()),
    minuto: comDoisDigitos(dataNoFuso.getUTCMinutes()),
    segundo: comDoisDigitos(dataNoFuso.getUTCSeconds()),
    milissegundo: String(dataNoFuso.getUTCMilliseconds()).padStart(3, '0'),
  };
};

const formatarData = (instante) => { const partes = partesDoInstante(instante); return `${partes.dia}/${partes.mes}/${partes.ano}`; };
const formatarDiaEMes = (instante) => { const partes = partesDoInstante(instante); return `${partes.dia}/${partes.mes}`; };
const formatarHoraEMinuto = (instante) => { const partes = partesDoInstante(instante); return `${partes.hora}:${partes.minuto}`; };
const formatarHoraComSegundos = (instante) => `${formatarHoraEMinuto(instante)}:${partesDoInstante(instante).segundo}`;
const formatarHoraComMilissegundos = (instante) => `${formatarHoraComSegundos(instante)}.${partesDoInstante(instante).milissegundo}`;
const formatarDataEHora = (instante) => `${formatarData(instante)} ${formatarHoraEMinuto(instante)}`;
const noMesmoDia = (instanteInicial, instanteFinal) => formatarData(instanteInicial) === formatarData(instanteFinal);

/* "27/11/2026 14:00" → instante; null quando o texto não é data e hora. */
const instanteDoTexto = (textoDeDataEHora) => {
  const correspondencia = String(textoDeDataEHora).trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!correspondencia) return null;
  const [, dia, mes, ano, hora, minuto] = correspondencia.map(Number);
  return Date.UTC(ano, mes - 1, dia, hora, minuto) - FUSO_DO_PAINEL.deslocamentoEmMinutos * MILISSEGUNDOS_POR_MINUTO;
};

/* Carimbo do intervalo no endereço: aaaammddhhmm, no fuso do painel. */
const carimboDoInstante = (instante) => {
  const partes = partesDoInstante(instante);
  return `${partes.ano}${partes.mes}${partes.dia}${partes.hora}${partes.minuto}`;
};
const instanteDoCarimbo = (carimbo) => instanteDoTexto(
  `${carimbo.slice(6, 8)}/${carimbo.slice(4, 6)}/${carimbo.slice(0, 4)} ${carimbo.slice(8, 10)}:${carimbo.slice(10, 12)}`);

const formatarQuantidade = (quantidade) => quantidade.toLocaleString('pt-BR');

/* ---------- A busca no endereço ----------
   Um segmento só: partes separadas por ";".
     p=1h | 24h | 7d | 30d | i.<início>.<fim>   período
     h=rec                                     período pelo horário de recebimento
     f=<campo>:<operador>:<valor>,<valor>      uma ficha (vírgula = "ou")
     q=<texto>  ou  rx=<regex>                 texto livre
     lenta=1                                   inclui o que veio antes do "rápido desde"
     pg=<n>                                    página */
const decodificarValor = (valorCodificado) => {
  try { return decodeURIComponent(valorCodificado); } catch { return valorCodificado; }
};

const decodificarBusca = (textoDaBusca) => {
  const busca = { periodo: '1h', base: 'origem', filtros: [], texto: '', regex: false, incluirAntesDoRapido: false, pagina: 1 };
  (textoDaBusca || BUSCA_DE_ABERTURA).split(';').forEach((parte) => {
    const posicaoDoIgual = parte.indexOf('=');
    if (posicaoDoIgual < 0) return;
    const chave = parte.slice(0, posicaoDoIgual);
    const valor = parte.slice(posicaoDoIgual + 1);
    if (chave === 'p') busca.periodo = valor;
    if (chave === 'h' && valor === 'rec') busca.base = 'recebimento';
    if (chave === 'q') { busca.texto = decodificarValor(valor); busca.regex = false; }
    if (chave === 'rx') { busca.texto = decodificarValor(valor); busca.regex = true; }
    if (chave === 'lenta') busca.incluirAntesDoRapido = valor === '1';
    if (chave === 'pg') busca.pagina = Math.max(1, Number(valor) || 1);
    if (chave === 'f') {
      const [campo, operador, valoresCodificados = ''] = valor.split(':');
      busca.filtros.push({ campo, operador, valores: valoresCodificados.split(',').map(decodificarValor) });
    }
  });
  return busca;
};

const codificarBusca = (busca) => {
  const partes = [`p=${busca.periodo}`];
  if (busca.base === 'recebimento') partes.push('h=rec');
  busca.filtros.forEach((filtro) => {
    partes.push(`f=${filtro.campo}:${filtro.operador}:${filtro.valores.map(encodeURIComponent).join(',')}`);
  });
  if (busca.texto) partes.push(`${busca.regex ? 'rx' : 'q'}=${encodeURIComponent(busca.texto)}`);
  if (busca.incluirAntesDoRapido) partes.push('lenta=1');
  if (busca.pagina > 1) partes.push(`pg=${busca.pagina}`);
  return partes.join(';');
};

const resolverPeriodo = (busca) => {
  const periodoPronto = PERIODOS_PRONTOS.find((periodo) => periodo.id === busca.periodo);
  if (periodoPronto) {
    return { ...periodoPronto, inicio: RELOGIO_DO_PAINEL.agora - periodoPronto.duracao, fim: RELOGIO_DO_PAINEL.agora };
  }
  const correspondencia = String(busca.periodo).match(/^i\.(\d{12})\.(\d{12})$/);
  const inicio = correspondencia && instanteDoCarimbo(correspondencia[1]);
  const fim = correspondencia && instanteDoCarimbo(correspondencia[2]);
  if (inicio && fim && inicio < fim) return { id: 'intervalo', chave: 'periodoIntervalo', duracao: fim - inicio, inicio, fim };
  return resolverPeriodo({ periodo: '1h' });
};

/* O período de um id do endereço ("1h", "30d", "i.<início>.<fim>"), para as outras telas.
   Elas chamam por aqui: `resolverPeriodo` chama a si mesmo, e o Babel do navegador troca o
   nome de função assim, que deixa de existir fora deste arquivo. */
const periodoDoId = (idDoPeriodo) => resolverPeriodo({ periodo: idDoPeriodo });

const periodoDeIntervalo = (inicio, fim) => `i.${carimboDoInstante(inicio)}.${carimboDoInstante(fim)}`;

/* ---------- Catálogo ---------- */
const catalogoDoProduto = (idDoProduto) => [...(CATALOGO_DE_CAMPOS[idDoProduto] || []), ...CAMPOS_DA_PLATAFORMA];

const campoDoCatalogo = (catalogo, nomeDoCampo) => catalogo.find((campo) => campo.nome === nomeDoCampo);

const operadoresDoCampo = (campo) => Object.keys(OPERADORES)
  .filter((codigoDoOperador) => campo.buscas.includes(OPERADORES[codigoDoOperador].busca));

/* Filtro que aponta um código (reserva, cliente, cobrança): libera toda a retenção. */
const temFiltroEspecifico = (busca, catalogo) => busca.filtros.some((filtro) => {
  const campo = campoDoCatalogo(catalogo, filtro.campo);
  return Boolean(campo?.especifico) && !OPERADORES[filtro.operador]?.nega;
});

/* Tira o que o catálogo do produto não conhece e traz o período para dentro do limite. */
const ajustarBusca = (busca, catalogo) => {
  const filtros = busca.filtros.filter((filtro) => campoDoCatalogo(catalogo, filtro.campo) && OPERADORES[filtro.operador]);
  const buscaAjustada = { ...busca, filtros };
  const passaDeUmDia = resolverPeriodo(buscaAjustada).duracao > MILISSEGUNDOS_POR_DIA;
  if (passaDeUmDia && !temFiltroEspecifico(buscaAjustada, catalogo)) buscaAjustada.periodo = '24h';
  const temCampoDeclaradoDepois = filtros.some((filtro) => campoDoCatalogo(catalogo, filtro.campo).rapidoDesde);
  if (!temCampoDeclaradoDepois) buscaAjustada.incluirAntesDoRapido = false;
  return buscaAjustada;
};

/* Mesmo campo e mesmo operador: os valores se juntam ("ou" dentro do mesmo campo).
   Campos diferentes valem ao mesmo tempo ("e"). */
const juntarFiltro = (filtros, filtroNovo) => {
  const filtroIgual = filtros.find((filtro) => filtro.campo === filtroNovo.campo && filtro.operador === filtroNovo.operador);
  if (!filtroIgual || OPERADORES[filtroNovo.operador].busca !== 'exata') {
    return [...filtros.filter((filtro) => filtro !== filtroIgual), filtroNovo];
  }
  const valoresJuntos = [...new Set([...filtroIgual.valores, ...filtroNovo.valores])];
  return filtros.map((filtro) => (filtro === filtroIgual ? { ...filtro, valores: valoresJuntos } : filtro));
};

/* ---------- Conferência de um evento contra a busca (simulada) ---------- */
const valorDoCampoNoEvento = (campo, evento) => {
  if (campo.propriedadeDoEvento) return evento[campo.propriedadeDoEvento];
  if (campo.tipo === 'codigo') return evento.codigosDeBusca?.[campo.nome];
  const nomeNoEvento = [campo.nome, ...(campo.apelidos || [])]
    .find((nomePossivel) => evento.atributos && nomePossivel in evento.atributos);
  return nomeNoEvento ? evento.atributos[nomeNoEvento] : undefined;
};

const numeroComparavel = (campo, valor) => (campo.tipo === 'data' ? instanteDoTexto(valor) : Number(valor));

const filtroAceitaEvento = (filtro, campo, evento) => {
  const operador = OPERADORES[filtro.operador];
  const valorNoEvento = valorDoCampoNoEvento(campo, evento);
  if (valorNoEvento === undefined || valorNoEvento === null) return Boolean(operador.nega);
  const textoNoEvento = String(valorNoEvento).toLowerCase();
  const valoresProcurados = filtro.valores.map((valor) => String(valor).toLowerCase());
  let confere = false;
  if (operador.busca === 'exata') confere = valoresProcurados.includes(textoNoEvento);
  if (operador.busca === 'comeco') confere = valoresProcurados.some((comeco) => textoNoEvento.startsWith(comeco));
  if (operador.busca === 'palavras') confere = valoresProcurados.join(' ').split(/\s+/).every((palavra) => textoNoEvento.includes(palavra));
  if (operador.busca === 'intervalo') {
    const numeroNoEvento = numeroComparavel(campo, valorNoEvento);
    confere = numeroNoEvento >= numeroComparavel(campo, filtro.valores[0]) && numeroNoEvento <= numeroComparavel(campo, filtro.valores[1]);
  }
  return operador.nega ? !confere : confere;
};

/* Lista e JSON com níveis viram texto como a aplicação mandou. */
const textoDoValorDoAtributo = (valorDoAtributo) => (valorDoAtributo !== null && typeof valorDoAtributo === 'object'
  ? JSON.stringify(valorDoAtributo)
  : String(valorDoAtributo));

/* Texto livre e regex olham a mensagem e os valores dos atributos. Não alcançam nome de
   campo, valor mascarado nem código de busca. */
const textosAlcancadosDoEvento = (evento) => [evento.mensagem, ...Object.values(evento.atributos || {}).map(textoDoValorDoAtributo)];

/* Só o Excurfly em produção tem eventos neste protótipo. */
const eventosDoAmbiente = (idDoProduto, idDoAmbiente) =>
  (idDoProduto === 'excurfly' && idDoAmbiente === 'producao' ? EVENTOS_DO_EXCURFLY : []);

const criarConferenciaDoTexto = (busca) => {
  if (!busca.texto) return null;
  if (busca.regex) {
    try {
      const padrao = new RegExp(busca.texto, 'i');
      return (textoDoEvento) => padrao.test(textoDoEvento);
    } catch {
      return () => false;
    }
  }
  const textoProcurado = busca.texto.toLowerCase();
  return (textoDoEvento) => textoDoEvento.toLowerCase().includes(textoProcurado);
};

/* O motivo da recusa, como chave de texto, ou null quando o texto pode ser buscado. */
const recusaDoTexto = (texto, ehRegex) => {
  if (texto.length > LIMITE_DE_LETRAS_DO_TEXTO) return 'buscaTextoErroTamanho';
  if (!ehRegex || !texto) return null;
  if (/\\[1-9]/.test(texto)) return 'buscaRegexErroReferencia';
  if (/\(\?<?[=!]/.test(texto)) return 'buscaRegexErroOlhar';
  try { new RegExp(texto); } catch { return 'buscaRegexErroInvalida'; }
  return null;
};

const calcularResultado = ({ idDoProduto, idDoAmbiente, busca, catalogo }) => {
  const periodo = resolverPeriodo(busca);
  const filtrosComCampo = busca.filtros
    .map((filtro) => ({ filtro, campo: campoDoCatalogo(catalogo, filtro.campo) }))
    .filter((filtroComCampo) => filtroComCampo.campo && OPERADORES[filtroComCampo.filtro.operador]);

  const campoDeclaradoDepois = filtrosComCampo
    .map((filtroComCampo) => filtroComCampo.campo)
    .filter((campo) => campo.rapidoDesde && campo.rapidoDesde > periodo.inicio)
    .sort((campoAnterior, campoSeguinte) => campoSeguinte.rapidoDesde - campoAnterior.rapidoDesde)[0] || null;

  const incluiAntesDoRapido = busca.incluirAntesDoRapido && Boolean(campoDeclaradoDepois);
  const lenta = Boolean(busca.texto) || busca.base === 'recebimento' || incluiAntesDoRapido;
  const corteRapido = campoDeclaradoDepois && !incluiAntesDoRapido ? campoDeclaradoDepois.rapidoDesde : null;
  const limiteDaBuscaLenta = periodo.fim - ALCANCE_DA_BUSCA_LENTA;
  const parcial = lenta && Math.max(periodo.inicio, corteRapido || 0) < limiteDaBuscaLenta;
  const inicioOlhado = Math.max(periodo.inicio, corteRapido || 0, parcial ? limiteDaBuscaLenta : 0);

  const instanteDoEvento = (evento) => (busca.base === 'recebimento' ? evento.recebidoEm : evento.origemEm);
  const confereOTexto = criarConferenciaDoTexto(busca);
  const eventosEncontrados = eventosDoAmbiente(idDoProduto, idDoAmbiente).filter((evento) => {
    const instante = instanteDoEvento(evento);
    if (instante < inicioOlhado || instante > periodo.fim || evento.recebidoEm > RELOGIO_DO_PAINEL.dadosAte) return false;
    if (!filtrosComCampo.every((filtroComCampo) => filtroAceitaEvento(filtroComCampo.filtro, filtroComCampo.campo, evento))) return false;
    return !confereOTexto || textosAlcancadosDoEvento(evento).some(confereOTexto);
  });
  if (busca.base === 'recebimento') {
    eventosEncontrados.sort((eventoAnterior, eventoSeguinte) => eventoSeguinte.recebidoEm - eventoAnterior.recebidoEm);
  }

  const passouDoLimite = eventosEncontrados.length > LIMITE_DE_EVENTOS_DA_BUSCA;
  const total = Math.min(eventosEncontrados.length, LIMITE_DE_EVENTOS_DA_BUSCA);
  const totalDePaginas = Math.max(1, Math.ceil(total / EVENTOS_POR_PAGINA));
  const pagina = Math.min(busca.pagina, totalDePaginas);
  const primeiro = (pagina - 1) * EVENTOS_POR_PAGINA;
  const eventos = eventosEncontrados.slice(primeiro, Math.min(primeiro + EVENTOS_POR_PAGINA, total));

  return {
    periodo, eventos, total, passouDoLimite, pagina, totalDePaginas,
    primeiro: primeiro + 1, ultimo: primeiro + eventos.length,
    lenta, parcial, olhouAte: limiteDaBuscaLenta, corteRapido, campoDeclaradoDepois,
    mostrarData: !noMesmoDia(periodo.inicio, periodo.fim - 1),
    instanteDoEvento,
  };
};

/* ---------- Textos derivados ---------- */
const textoDoIntervaloDoPeriodo = (traduzir, periodo) => (noMesmoDia(periodo.inicio, periodo.fim)
  ? traduzir('periodoNoMesmoDia', { data: formatarData(periodo.inicio), inicio: formatarHoraEMinuto(periodo.inicio), fim: formatarHoraEMinuto(periodo.fim) })
  : traduzir('periodoEntreDias', { inicio: formatarDataEHora(periodo.inicio), fim: formatarDataEHora(periodo.fim) }));

const textoDoPeriodoComFuso = (traduzir, periodo) =>
  traduzir('periodoComFuso', { periodo: textoDoIntervaloDoPeriodo(traduzir, periodo), fuso: FUSO_DO_PAINEL.rotulo });

/* "14:00" quando é hoje no cenário; "26/11 14:00" quando é outro dia. */
const textoDoHorarioProximo = (instante) => (noMesmoDia(instante, RELOGIO_DO_PAINEL.agora)
  ? formatarHoraEMinuto(instante)
  : `${formatarDiaEMes(instante)} ${formatarHoraEMinuto(instante)}`);

const rotuloDoCampo = (traduzir, campo) => (campo.chaveDoRotulo ? traduzir(campo.chaveDoRotulo) : campo.nome);

const rotuloDoValor = (traduzir, campo, valor) => {
  const opcao = (campo.opcoes || []).find((opcaoDoCampo) => opcaoDoCampo.valor === valor);
  if (!opcao) return campo.tipo === 'codigo' ? traduzir('fichaCodigoDeBusca', { codigo: valor }) : valor;
  return opcao.chaveDoRotulo ? traduzir(opcao.chaveDoRotulo) : opcao.rotulo;
};

const textoDoFiltro = (traduzir, campo, filtro) => {
  const operador = OPERADORES[filtro.operador];
  if (operador.busca === 'intervalo') {
    return `${rotuloDoCampo(traduzir, campo)} ${traduzir('operadorEntre')} ${traduzir('intervaloDeValores', { inicio: filtro.valores[0], fim: filtro.valores[1] })}`;
  }
  const valores = filtro.valores.map((valor) => rotuloDoValor(traduzir, campo, valor)).join(` ${traduzir('operadorOu')} `);
  return `${rotuloDoCampo(traduzir, campo)} ${traduzir(operador.chave)} ${valores}`;
};

/* O começo do que a aplicação mandou junto: atributos e valores mascarados, como vieram. */
const resumoDosAtributos = (evento) => Object.entries({ ...(evento.atributos || {}), ...(evento.mascarados || {}) })
  .map(([nomeDoAtributo, valorDoAtributo]) => `${nomeDoAtributo}=${textoDoValorDoAtributo(valorDoAtributo)}`).join('  ');

/* ---------- Peças ---------- */

/* Diz, em texto, se a busca é garantida ou lenta. A cor é reforço. */
const EtiquetaDaBusca = ({ garantida, children }) => <Etiqueta tom={garantida ? 'ok' : 'atencao'}>{children}</Etiqueta>;

const textoDaEtiquetaDoCampo = (traduzir, campo, buscaLenta) => {
  if (buscaLenta) return traduzir('fichaLenta');
  if (campo.rapidoDesde) return traduzir('fichaRapidoDesde', { horario: textoDoHorarioProximo(campo.rapidoDesde) });
  return traduzir('fichaGarantida');
};

const FichaDeFiltro = ({ traduzir, rotulo, etiqueta, garantida, disabled, aoRemover }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
    padding: 'var(--space-1) var(--space-1) var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)',
    background: 'var(--surface)', border: '1px solid var(--border-strong)', fontSize: 13, fontWeight: 600,
  }}>
    <span>{rotulo}</span>
    <EtiquetaDaBusca garantida={garantida}>{etiqueta}</EtiquetaDaBusca>
    <Press
      aria-label={traduzir('fichaRemover', { ficha: rotulo })} title={traduzir('fichaRemover', { ficha: rotulo })}
      disabled={disabled} onClick={aoRemover}
      style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-full)', color: 'var(--muted)' }}
    >
      <IconClose size={14} />
    </Press>
  </span>
);

/* Painel que abre embaixo de um botão (período, adicionar filtro). Fecha com Esc, com o
   clique fora e ao aplicar. */
const PainelSuspenso = ({ rotulo, largura, alinharADireita, fechar, children }) => (
  <React.Fragment>
    <div aria-hidden onClick={fechar} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
    <div role="dialog" aria-label={rotulo} style={{
      position: 'absolute', top: 'calc(100% + var(--space-2))', zIndex: 10, width: largura,
      left: alinharADireita ? 'auto' : 0, right: alinharADireita ? 0 : 'auto',
      background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)', padding: 'var(--space-4)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
    }}>
      {children}
    </div>
  </React.Fragment>
);

/* ---------- Período ---------- */
const PainelDoPeriodo = ({ traduzir, busca, periodo, liberaToda, aoEscolherPeriodo, aoEscolherBase, fechar }) => {
  const [textoDoInicio, setTextoDoInicio] = useState(formatarDataEHora(periodo.inicio));
  const [textoDoFim, setTextoDoFim] = useState(formatarDataEHora(periodo.fim));
  const [chaveDoErro, setChaveDoErro] = useState(null);

  const usarIntervalo = () => {
    const inicio = instanteDoTexto(textoDoInicio);
    const fim = instanteDoTexto(textoDoFim);
    if (inicio === null || fim === null) { setChaveDoErro('periodoErroFormato'); return; }
    if (inicio >= fim) { setChaveDoErro('periodoErroOrdem'); return; }
    if (inicio < RELOGIO_DO_PAINEL.dadosDesde || fim > RELOGIO_DO_PAINEL.agora) { setChaveDoErro('periodoErroRetencao'); return; }
    if (fim - inicio > MILISSEGUNDOS_POR_DIA && !liberaToda) { setChaveDoErro('periodoErroLimiteDeUmDia'); return; }
    aoEscolherPeriodo(periodoDeIntervalo(inicio, fim));
  };
  const aplicarComEnter = (eventoDeTeclado) => { if (eventoDeTeclado.key === 'Enter') usarIntervalo(); };

  return (
    <PainelSuspenso rotulo={traduzir('periodoEscolher')} largura={LARGURA_DO_PAINEL_DE_PERIODO} fechar={fechar}>
      <div role="radiogroup" aria-label={traduzir('periodoEscolher')} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {PERIODOS_PRONTOS.map((periodoPronto) => {
          const escolhido = periodoPronto.id === busca.periodo;
          const foraDoLimite = periodoPronto.duracao > MILISSEGUNDOS_POR_DIA && !liberaToda;
          return (
            <Press
              key={periodoPronto.id} role="radio" aria-checked={escolhido} disabled={foraDoLimite}
              className={escolhido ? undefined : 'item-realcavel'}
              onClick={() => aoEscolherPeriodo(periodoPronto.id)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', fontSize: 13.5,
                fontWeight: escolhido ? 800 : 600, whiteSpace: 'nowrap',
                ...(escolhido ? { background: 'var(--accent-soft)' } : {}),
              }}
            >
              <span>{traduzir(periodoPronto.chave)}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                {textoDoIntervaloDoPeriodo(traduzir, resolverPeriodo({ periodo: periodoPronto.id }))}
              </span>
            </Press>
          );
        })}
      </div>
      {!liberaToda && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>{traduzir('periodoLimiteNota')}</p>}
      {/* Sem `aoEscolherBase`, o período conta sempre pelo horário de origem (as tentativas). */}

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{traduzir('periodoIntervalo')} ({FUSO_DO_PAINEL.rotulo})</div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
          <Field label={traduzir('periodoDe')} value={textoDoInicio} onChange={setTextoDoInicio} placeholder={traduzir('periodoFormato')} aoTeclar={aplicarComEnter} />
          <Field label={traduzir('periodoAte')} value={textoDoFim} onChange={setTextoDoFim} placeholder={traduzir('periodoFormato')} aoTeclar={aplicarComEnter} />
        </div>
        {chaveDoErro && (
          <div role="alert" style={{ fontSize: 12.5, color: 'var(--danger)' }}>
            {traduzir(chaveDoErro, { dadosDesde: formatarData(RELOGIO_DO_PAINEL.dadosDesde) })}
          </div>
        )}
        <div><Button variant="secondary" compacto onClick={usarIntervalo}>{traduzir('periodoUsarIntervalo')}</Button></div>
      </div>

      {aoEscolherBase && <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)' }}>{traduzir('periodoBase')}</div>
        <div>
          <SeletorSegmentado
            rotulo={traduzir('periodoBase')} valor={busca.base} aoEscolher={aoEscolherBase}
            opcoes={[
              { valor: 'origem', rotulo: traduzir('periodoBaseOrigem') },
              { valor: 'recebimento', rotulo: traduzir('periodoBaseRecebimento') },
            ]}
          />
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>{traduzir('periodoBaseRecebimentoNota')}</p>
      </div>}
    </PainelSuspenso>
  );
};

/* ---------- Texto livre, período e buscar ----------
   Por padrão é a caixa do texto livre (busca lenta, com regex). Com `garantida`, é a caixa
   de um valor inteiro de busca garantida (achar tentativas): sem regex, com a etiqueta
   "busca garantida"; `rotuloDaCaixa`, `rotuloDoBotao` e `dica` trocam os textos. */
const BarraDeBusca = ({
  traduzir, desabilitado, buscaIndisponivel, campoDeBuscaRef,
  textoDigitado, aoDigitar, modoRegex, aoTrocarModoRegex, chaveDaRecusa, aoBuscar, aoLimparTexto,
  garantida, rotuloDaCaixa, rotuloDoBotao, dica, focarAoAbrir, classeDoBotao,
}) => {
  const rotuloDoCampoDeTexto = rotuloDaCaixa || traduzir(modoRegex ? 'buscaCampoRegex' : 'buscaCampo');
  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'stretch' }}>
      <div className="caixa-de-campo" style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        padding: '0 var(--space-3)', minHeight: ALTURA_DA_CAIXA_DE_BUSCA, borderRadius: 'var(--radius-md)',
        background: 'var(--input-bg)', border: `1px solid ${chaveDaRecusa ? 'var(--danger)' : 'var(--border-control)'}`,
      }}>
        <IconSearch size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        <input
          ref={campoDeBuscaRef} type="text" disabled={desabilitado} value={textoDigitado} autoFocus={focarAoAbrir}
          aria-label={rotuloDoCampoDeTexto} placeholder={rotuloDoCampoDeTexto}
          aria-invalid={chaveDaRecusa ? true : undefined} aria-describedby="dica-do-texto-livre"
          onChange={(eventoDeDigitacao) => aoDigitar(eventoDeDigitacao.target.value)}
          onKeyDown={(eventoDeTeclado) => { if (eventoDeTeclado.key === 'Enter') aoBuscar(); }}
          className="campo-sem-moldura"
          style={{
            flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--fg)', fontSize: 14,
            fontFamily: modoRegex || garantida ? 'var(--font-mono)' : 'inherit',
          }}
        />
        {textoDigitado && (
          <Press
            aria-label={traduzir('buscaLimparTexto')} title={traduzir('buscaLimparTexto')} disabled={desabilitado} onClick={aoLimparTexto}
            style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-full)', color: 'var(--muted)', flexShrink: 0 }}
          >
            <IconClose size={14} />
          </Press>
        )}
        {!garantida && (
          <Press
            aria-pressed={modoRegex} title={traduzir('buscaRegexLigar')} disabled={desabilitado} onClick={aoTrocarModoRegex}
            style={{
              padding: '2px var(--space-2)', borderRadius: 'var(--radius-sm)', flexShrink: 0,
              fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
              border: `1px solid ${modoRegex ? 'var(--accent)' : 'var(--border-strong)'}`, color: 'var(--fg)',
              background: modoRegex ? 'var(--accent-soft)' : 'var(--surface)',
            }}
          >
            {modoRegex && <IconCheck size={12} />}
            {traduzir('buscaRegex')}
          </Press>
        )}
        <EtiquetaDaBusca garantida={garantida}>{traduzir(garantida ? 'etiquetaBuscaGarantida' : 'etiquetaBuscaLenta')}</EtiquetaDaBusca>
        <span aria-hidden style={{ flexShrink: 0 }}><Tecla>/</Tecla></span>
      </div>
      <Button variant="primary" disabled={desabilitado || buscaIndisponivel} className={classeDoBotao} onClick={aoBuscar}>
        {rotuloDoBotao || traduzir('buscaBuscar')}
      </Button>
    </div>
    {chaveDaRecusa
      ? <div id="dica-do-texto-livre" role="alert" style={{ fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>{traduzir(chaveDaRecusa)}</div>
      : <div id="dica-do-texto-livre" style={{ fontSize: 12.5, color: 'var(--muted)' }}>{dica || traduzir('buscaTextoDica')}</div>}
  </div>
  );
};

/* O período fica sempre à vista, com a data, o fuso e por qual horário se conta. */
const SeletorDePeriodo = ({
  traduzir, busca, periodo, liberaToda, indisponivel, aberto, aoAbrir, aoFechar, aoEscolherPeriodo, aoEscolherBase, botaoRef,
}) => (
  <div style={{ position: 'relative', display: 'flex' }}>
    <Press
      ref={botaoRef} disabled={indisponivel} aria-haspopup="dialog" aria-expanded={aberto}
      onClick={aberto ? aoFechar : aoAbrir}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1) var(--space-3)',
        minHeight: ALTURA_DO_SELETOR_DE_PERIODO,
        borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', background: 'var(--surface)',
        fontSize: 13, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap',
      }}
    >
      <IconClock size={15} style={{ color: 'var(--muted)' }} />
      <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{traduzir('cascaPeriodo')}</span>
      <span>{traduzir(periodo.chave)}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500 }}>{textoDoPeriodoComFuso(traduzir, periodo)}</span>
      <span
        title={traduzir(busca.base === 'recebimento' ? 'periodoPeloRecebimento' : 'periodoPelaOrigem')}
        style={{ color: 'var(--muted)', fontWeight: 600 }}
      >
        {traduzir(busca.base === 'recebimento' ? 'periodoBaseCurtaRecebimento' : 'periodoBaseCurtaOrigem')}
      </span>
    </Press>
    {aberto && (
      <PainelDoPeriodo
        traduzir={traduzir} busca={busca} periodo={periodo} liberaToda={liberaToda}
        aoEscolherPeriodo={aoEscolherPeriodo} aoEscolherBase={aoEscolherBase} fechar={aoFechar}
      />
    )}
  </div>
);

/* ---------- Adicionar filtro: campo do catálogo, depois operador e valor ---------- */
const LinhaDoCatalogo = ({ traduzir, campo, aoEscolher }) => {
  const complementos = [
    campo.descricao,
    campo.papel && CHAVE_DO_PAPEL[campo.papel] && traduzir(CHAVE_DO_PAPEL[campo.papel]),
    campo.apelidos && traduzir('filtroApelidos', { apelidos: campo.apelidos.join(', ') }),
  ].filter(Boolean);
  return (
    <Press
      role="option" aria-selected={false} className="item-realcavel" onClick={aoEscolher}
      style={{
        display: 'grid', gridTemplateColumns: COLUNAS_DO_CATALOGO, gap: 'var(--space-3)', alignItems: 'center',
        padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border)', fontSize: 13,
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ fontFamily: campo.chaveDoRotulo ? 'inherit' : 'var(--font-mono)', fontWeight: 700 }}>{rotuloDoCampo(traduzir, campo)}</span>
        {complementos.length > 0 && (
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>
            {complementos.join(' · ')}
          </span>
        )}
      </span>
      <span>{traduzir(CHAVE_DO_TIPO[campo.tipo])}</span>
      <span>{campo.buscas.map((buscaPermitida) => traduzir(CHAVE_DA_BUSCA_PERMITIDA[buscaPermitida])).join(', ')}</span>
      <span><EtiquetaDaBusca garantida>{textoDaEtiquetaDoCampo(traduzir, campo, false)}</EtiquetaDaBusca></span>
    </Press>
  );
};

const PassoDoValor = ({ traduzir, campo, aoVoltar, aoAplicar }) => {
  const operadores = operadoresDoCampo(campo);
  const [codigoDoOperador, setCodigoDoOperador] = useState(operadores[0]);
  const [valorDigitado, setValorDigitado] = useState('');
  const [valorFinalDigitado, setValorFinalDigitado] = useState('');
  const [valoresMarcados, setValoresMarcados] = useState([]);
  const [chaveDoErro, setChaveDoErro] = useState(null);
  const ehIntervalo = OPERADORES[codigoDoOperador].busca === 'intervalo';
  const aceitaVarios = OPERADORES[codigoDoOperador].busca === 'exata' && campo.tipo !== 'codigo';

  const valorValido = (valor) => {
    if (campo.tipo === 'numero') return valor !== '' && !Number.isNaN(Number(valor));
    if (campo.tipo === 'data') return instanteDoTexto(valor) !== null;
    return valor !== '';
  };

  const aplicar = () => {
    let valores = [valorDigitado.trim()];
    if (campo.opcoes) valores = valoresMarcados;
    else if (ehIntervalo) valores = [valorDigitado.trim(), valorFinalDigitado.trim()];
    else if (aceitaVarios) valores = valorDigitado.split(',').map((valor) => valor.trim()).filter(Boolean);
    if (!valores.length || valores.some((valor) => valor === '')) { setChaveDoErro('filtroErroVazio'); return; }
    if (!valores.every(valorValido)) { setChaveDoErro(campo.tipo === 'data' ? 'periodoErroFormato' : 'filtroErroNumero'); return; }
    // O endereço guarda o código de busca, nunca o dado pessoal digitado.
    if (campo.tipo === 'codigo') valores = valores.map((valor) => CODIGOS_DE_BUSCA_SINTETICOS[valor] || 'cb_000000');
    aoAplicar({ campo: campo.nome, operador: codigoDoOperador, valores });
  };
  const aplicarComEnter = (eventoDeTeclado) => { if (eventoDeTeclado.key === 'Enter') aplicar(); };
  const marcarValor = (valor) => setValoresMarcados((marcadosAntes) => (marcadosAntes.includes(valor)
    ? marcadosAntes.filter((valorMarcado) => valorMarcado !== valor)
    : [...marcadosAntes, valor]));

  const erro = chaveDoErro && traduzir(chaveDoErro);
  const formatoDoValor = campo.tipo === 'data' ? traduzir('periodoFormato') : undefined;
  let dicaDoValor;
  if (campo.tipo === 'codigo') dicaDoValor = traduzir('filtroCodigoDeBuscaDica');
  else if (aceitaVarios) dicaDoValor = traduzir('filtroVariosValores');

  return (
    <React.Fragment>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: campo.chaveDoRotulo ? 'inherit' : 'var(--font-mono)', fontSize: 15, fontWeight: 800 }}>{rotuloDoCampo(traduzir, campo)}</span>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {[campo.descricao, traduzir(CHAVE_DO_TIPO[campo.tipo]), campo.papel && CHAVE_DO_PAPEL[campo.papel] && traduzir(CHAVE_DO_PAPEL[campo.papel])].filter(Boolean).join(' · ')}
        </span>
        <EtiquetaDaBusca garantida>{traduzir('etiquetaBuscaGarantida')}</EtiquetaDaBusca>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>
        {campo.rapidoDesde
          ? traduzir('filtroRapidoDesdeNota', { horario: formatarDataEHora(campo.rapidoDesde) })
          : traduzir('filtroGarantidaNota')}
      </p>
      {operadores.length > 1 && (
        <div>
          <SeletorSegmentado
            rotulo={traduzir('filtroOperador')} valor={codigoDoOperador}
            aoEscolher={(codigoEscolhido) => { setCodigoDoOperador(codigoEscolhido); setChaveDoErro(null); }}
            opcoes={operadores.map((codigo) => ({ valor: codigo, rotulo: traduzir(OPERADORES[codigo].chave) }))}
          />
        </div>
      )}
      {operadores.length === 1 && <div style={{ fontSize: 13, fontWeight: 700 }}>{traduzir(OPERADORES[codigoDoOperador].chave)}</div>}

      {campo.opcoes && (
        <div role="group" aria-label={traduzir('filtroValor')} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {campo.opcoes.map((opcao) => {
              const marcado = valoresMarcados.includes(opcao.valor);
              return (
                <Press
                  key={opcao.valor} aria-pressed={marcado} onClick={() => { marcarValor(opcao.valor); setChaveDoErro(null); }}
                  style={{
                    padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 700,
                    border: `1px solid ${marcado ? 'var(--accent)' : 'var(--border-strong)'}`,
                    background: marcado ? 'var(--accent-soft)' : 'var(--surface)', color: 'var(--fg)',
                    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
                  }}
                >
                  {marcado && <IconCheck size={14} />}
                  {rotuloDoValor(traduzir, campo, opcao.valor)}
                </Press>
              );
            })}
          </div>
          {erro
            ? <span role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>{erro}</span>
            : <span style={{ fontSize: 12, color: 'var(--muted)' }}>{traduzir('filtroVariasOpcoes')}</span>}
        </div>
      )}
      {!campo.opcoes && ehIntervalo && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
          <Field key="inicio" label={traduzir('filtroValorDe')} value={valorDigitado} onChange={setValorDigitado} placeholder={formatoDoValor} focarAoAbrir aoTeclar={aplicarComEnter} error={erro} />
          <Field key="fim" label={traduzir('filtroValorAte')} value={valorFinalDigitado} onChange={setValorFinalDigitado} placeholder={formatoDoValor} aoTeclar={aplicarComEnter} />
        </div>
      )}
      {!campo.opcoes && !ehIntervalo && (
        <Field
          key="valor" label={traduzir('filtroValor')} value={valorDigitado} onChange={setValorDigitado} placeholder={formatoDoValor}
          focarAoAbrir aoTeclar={aplicarComEnter} error={erro} dica={dicaDoValor}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <Button variant="ghost" compacto onClick={aoVoltar}>{traduzir('voltar')}</Button>
        <Button variant="primary" compacto onClick={aplicar}>{traduzir('filtroAplicar')}</Button>
      </div>
    </React.Fragment>
  );
};

const PainelDeAdicionarFiltro = ({ traduzir, catalogo, nomeDoProduto, aoAplicar, fechar }) => {
  const [campoEscolhido, setCampoEscolhido] = useState(null);
  const [procura, setProcura] = useState('');
  const procuraSemCaixa = procura.trim().toLowerCase();
  const camposAchados = catalogo.filter((campo) => [campo.nome, rotuloDoCampo(traduzir, campo), campo.descricao || '', ...(campo.apelidos || [])]
    .some((textoDoCampo) => textoDoCampo.toLowerCase().includes(procuraSemCaixa)));

  return (
    <PainelSuspenso rotulo={traduzir('filtroAdicionar')} largura={LARGURA_DO_PAINEL_DE_FILTRO} fechar={fechar}>
      {campoEscolhido
        ? <PassoDoValor traduzir={traduzir} campo={campoEscolhido} aoVoltar={() => setCampoEscolhido(null)} aoAplicar={aoAplicar} />
        : (
          <React.Fragment>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{traduzir('filtroTitulo', { produto: nomeDoProduto })}</div>
            <Field
              value={procura} onChange={setProcura} placeholder={traduzir('filtroProcurarCampo')} focarAoAbrir
              aoTeclar={(eventoDeTeclado) => { if (eventoDeTeclado.key === 'Enter' && camposAchados.length) setCampoEscolhido(camposAchados[0]); }}
            />
            <div>
              <div aria-hidden style={{
                display: 'grid', gridTemplateColumns: COLUNAS_DO_CATALOGO, gap: 'var(--space-3)',
                padding: 'var(--space-1) var(--space-3)', borderBottom: '1px solid var(--border-strong)',
                fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)',
              }}>
                <span>{traduzir('filtroColunaCampo')}</span>
                <span>{traduzir('filtroColunaTipo')}</span>
                <span>{traduzir('filtroColunaBuscas')}</span>
                <span>{traduzir('filtroColunaPromessa')}</span>
              </div>
              <div role="listbox" aria-label={traduzir('filtroTitulo', { produto: nomeDoProduto })} style={{ maxHeight: ALTURA_MAXIMA_DA_LISTA_DE_CAMPOS, overflowY: 'auto' }}>
                {camposAchados.map((campo) => (
                  <LinhaDoCatalogo key={campo.nome} traduzir={traduzir} campo={campo} aoEscolher={() => setCampoEscolhido(campo)} />
                ))}
                {camposAchados.length === 0 && (
                  <div style={{ padding: 'var(--space-4) var(--space-3)', fontSize: 13, color: 'var(--muted)' }}>{traduzir('filtroNenhumCampo')}</div>
                )}
              </div>
            </div>
          </React.Fragment>
        )}
    </PainelSuspenso>
  );
};

/* ---------- Fichas ---------- */
const FichasDaBusca = ({
  traduzir, busca, catalogo, nomeDoProduto, desabilitado, buscaIndisponivel,
  filtroAberto, aoAbrirFiltro, aoFecharFiltro, aoAplicarFiltro, aoRemoverFiltro, botaoDeFiltroRef,
}) => (
  <div role="group" aria-label={traduzir('buscaFichas')} style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: 0 }}>
    {busca.filtros.map((filtro, indiceDoFiltro) => {
      const campo = campoDoCatalogo(catalogo, filtro.campo);
      if (!campo || !OPERADORES[filtro.operador]) return null;
      const buscaLenta = Boolean(campo.rapidoDesde) && busca.incluirAntesDoRapido;
      return (
        <span key={`${filtro.campo}:${filtro.operador}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {indiceDoFiltro > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>{traduzir('fichaE')}</span>}
          <FichaDeFiltro
            traduzir={traduzir} rotulo={textoDoFiltro(traduzir, campo, filtro)}
            etiqueta={textoDaEtiquetaDoCampo(traduzir, campo, buscaLenta)} garantida={!buscaLenta}
            disabled={desabilitado || buscaIndisponivel} aoRemover={() => aoRemoverFiltro(filtro)}
          />
        </span>
      );
    })}
    {busca.filtros.length === 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{traduzir('fichasNenhuma')}</span>}
    {/* O painel se prende à linha do período e das fichas (quem chama dá `position: relative`):
        preso ao botão, ele saía da tela pela direita. */}
    <div>
      <Press
        ref={botaoDeFiltroRef}
        disabled={desabilitado || buscaIndisponivel} aria-haspopup="dialog" aria-expanded={filtroAberto}
        onClick={filtroAberto ? aoFecharFiltro : aoAbrirFiltro}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
          padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-full)',
          border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 13, fontWeight: 700,
        }}
      >
        <IconPlus size={14} />{traduzir('filtroAdicionar')}
      </Press>
      {filtroAberto && (
        <PainelDeAdicionarFiltro
          traduzir={traduzir} catalogo={catalogo} nomeDoProduto={nomeDoProduto}
          aoAplicar={aoAplicarFiltro} fechar={aoFecharFiltro}
        />
      )}
    </div>
  </div>
);

/* ---------- Lista ----------
   `miolo` troca o que vem na coluna da mensagem (a linha do tempo põe ali a mensagem, as
   marcas e o vínculo de correlação). */
/* Sem internet a linha continua legível e alcançável pelo teclado, mas não abre: ela se
   declara indisponível (`aria-disabled`), diz o motivo e não reage como quem abre. */
const propriedadesDaLinhaSemInternet = (traduzir, semInternet) => (semInternet
  ? { 'aria-disabled': true, title: traduzir('motivoSemInternet') }
  : {});

const LinhaDeEvento = ({ traduzir, evento, horario, colunas, quebrarLinha, selecionada, estadoDemonstrado, aoSelecionar, aoTeclar, linhaRef, disabled, semInternet, miolo }) => (
  <li style={{ listStyle: 'none' }}>
    <Press
      ref={linhaRef} disabled={disabled}
      onClick={semInternet ? undefined : aoSelecionar} onKeyDownCapture={aoTeclar}
      aria-current={selecionada ? 'true' : undefined}
      className={`linha-de-evento${estadoDemonstrado ? ` linha-de-evento--${estadoDemonstrado}` : ''}`}
      {...propriedadesDaLinhaSemInternet(traduzir, semInternet)}
      style={{
        display: 'grid', gridTemplateColumns: colunas, gap: 'var(--space-3)',
        alignItems: quebrarLinha ? 'start' : 'center',
        minHeight: ALTURA_DA_LINHA_DE_EVENTO, padding: '6px var(--space-3)',
        borderBottom: '1px solid var(--border)', fontSize: 13,
        ...(semInternet ? { cursor: 'default' } : {}),
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
        {horario}
      </span>
      <span><NivelDoEvento nivel={evento.nivel} traduzir={traduzir} /></span>
      <span style={{ fontWeight: 700 }}>{evento.aplicacao}</span>
      {miolo || <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 12.5, minWidth: 0,
        whiteSpace: quebrarLinha ? 'normal' : 'nowrap', overflow: 'hidden',
        textOverflow: quebrarLinha ? 'clip' : 'ellipsis', wordBreak: quebrarLinha ? 'break-word' : 'normal',
      }}>
        {evento.mensagem}
        {quebrarLinha
          ? <span style={{ display: 'block', color: 'var(--muted)', marginTop: 2 }}>{resumoDosAtributos(evento)}</span>
          : <span style={{ color: 'var(--muted)' }}>{'  '}{resumoDosAtributos(evento)}</span>}
      </span>}
    </Press>
  </li>
);

const CabecalhoDaLista = ({ traduzir, colunas, peloRecebimento }) => (
  <div aria-hidden style={{
    display: 'grid', gridTemplateColumns: colunas, gap: 'var(--space-3)',
    padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border-strong)',
    fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)',
  }}>
    <span>{traduzir(peloRecebimento ? 'buscaColunaRecebimento' : 'buscaColunaHorario')}</span>
    <span>{traduzir('buscaColunaNivel')}</span>
    <span>{traduzir('buscaColunaAplicacao')}</span>
    <span>{traduzir('buscaColunaMensagem')}</span>
  </div>
);

const Paginacao = ({ traduzir, resultado, indisponivel, aoIrParaPagina }) => (
  <nav aria-label={traduzir('buscaPaginacao')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
    <Button variant="secondary" compacto disabled={indisponivel || resultado.pagina <= 1} onClick={() => aoIrParaPagina(resultado.pagina - 1)}>
      {traduzir('buscaPaginaAnterior')}
    </Button>
    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {traduzir('buscaPagina', { pagina: resultado.pagina, total: resultado.totalDePaginas })}
    </span>
    <Button variant="secondary" compacto disabled={indisponivel || resultado.pagina >= resultado.totalDePaginas} onClick={() => aoIrParaPagina(resultado.pagina + 1)}>
      {traduzir('buscaPaginaProxima')}
    </Button>
  </nav>
);

const textoDaContagemDeEventos = (traduzir, resultado) => (resultado.passouDoLimite
  ? traduzir('buscaContagemAcimaDoLimite', { primeiro: formatarQuantidade(resultado.primeiro), ultimo: formatarQuantidade(resultado.ultimo), limite: formatarQuantidade(LIMITE_DE_EVENTOS_DA_BUSCA) })
  : traduzir('buscaContagem', { primeiro: formatarQuantidade(resultado.primeiro), ultimo: formatarQuantidade(resultado.ultimo), total: formatarQuantidade(resultado.total) }));

/* `idDoEventoAberto` é o evento aberto ao lado: a linha dele fica marcada, as setas
   trocam o evento aberto e Esc fecha, devolvendo o foco à linha.
   A linha do tempo de uma tentativa usa a mesma lista: `rotulo` dá o nome dela e
   `mioloDaLinha` devolve o que vai na coluna da mensagem de cada evento. `semCursor`
   serve à lista que fica à parte na tela: nenhuma linha nasce marcada. */
const ListaDeEventos = ({
  traduzir, resultado, estado, quebrarLinha, peloRecebimento, idDoEventoAberto, eventoAbertoExiste, aoAbrir, aoFechar,
  rotulo, mioloDaLinha, semCursor,
}) => {
  const [indiceSelecionado, setIndiceSelecionado] = useState(0);
  const linhasRef = useRef([]);
  const idDoEventoAbertoAntesRef = useRef(idDoEventoAberto);
  const desabilitado = estado === 'disabled';
  const colunas = resultado.mostrarData ? COLUNAS_DA_LISTA.comData : COLUNAS_DA_LISTA.semData;
  const estadoDemonstrado = ['hover', 'focus', 'active'].includes(estado) ? estado : null;
  const indiceDoEventoAberto = resultado.eventos.findIndex((evento) => evento.id === idDoEventoAberto);

  useEffect(() => { setIndiceSelecionado(0); }, [resultado]);

  /* A linha do evento aberto fica à vista; ao fechar, o foco volta para ela. */
  useEffect(() => {
    const idDoEventoAbertoAntes = idDoEventoAbertoAntesRef.current;
    idDoEventoAbertoAntesRef.current = idDoEventoAberto;
    if (idDoEventoAberto) {
      if (indiceDoEventoAberto >= 0) {
        setIndiceSelecionado(indiceDoEventoAberto);
        linhasRef.current[indiceDoEventoAberto]?.scrollIntoView({ block: 'nearest' });
      }
      return;
    }
    const indiceDoEventoFechado = resultado.eventos.findIndex((evento) => evento.id === idDoEventoAbertoAntes);
    if (indiceDoEventoFechado >= 0) {
      setIndiceSelecionado(indiceDoEventoFechado);
      linhasRef.current[indiceDoEventoFechado]?.focus();
    }
  }, [idDoEventoAberto, indiceDoEventoAberto]);

  const teclarNaLinha = (indiceDaLinha) => (eventoDeTeclado) => {
    if (eventoDeTeclado.key === 'Escape' && idDoEventoAberto) { eventoDeTeclado.preventDefault(); aoFechar(); return; }
    const passos = { ArrowDown: 1, ArrowUp: -1 };
    if (!(eventoDeTeclado.key in passos)) return;
    const proximoIndice = indiceDaLinha + passos[eventoDeTeclado.key];
    if (proximoIndice < 0 || proximoIndice >= resultado.eventos.length) return;
    eventoDeTeclado.preventDefault();
    setIndiceSelecionado(proximoIndice);
    linhasRef.current[proximoIndice]?.focus();
    if (idDoEventoAberto) aoAbrir(resultado.eventos[proximoIndice]);
  };

  const horarioDoEvento = (evento) => {
    const instante = resultado.instanteDoEvento(evento);
    return resultado.mostrarData
      ? `${formatarDiaEMes(instante)} ${formatarHoraComMilissegundos(instante)}`
      : formatarHoraComMilissegundos(instante);
  };

  /* Enter ou clique abre o evento ao lado da lista. */
  return (
    <React.Fragment>
      <CabecalhoDaLista traduzir={traduzir} colunas={colunas} peloRecebimento={peloRecebimento} />
      <ol aria-label={rotulo || traduzir('buscaLista')} aria-busy={estado === 'loading' || undefined} style={{ margin: 0, padding: 0 }}>
        {resultado.eventos.map((evento, indiceDaLinha) => (
          <LinhaDeEvento
            key={evento.id} traduzir={traduzir} evento={evento} horario={horarioDoEvento(evento)} colunas={colunas}
            quebrarLinha={quebrarLinha} disabled={desabilitado} semInternet={estado === 'offline'} miolo={mioloDaLinha && mioloDaLinha(evento)}
            selecionada={idDoEventoAberto ? eventoAbertoExiste && evento.id === idDoEventoAberto : !semCursor && indiceDaLinha === indiceSelecionado}
            estadoDemonstrado={indiceDaLinha === 1 ? estadoDemonstrado : null}
            aoSelecionar={() => { setIndiceSelecionado(indiceDaLinha); aoAbrir(evento); }}
            aoTeclar={teclarNaLinha(indiceDaLinha)}
            linhaRef={(elemento) => { linhasRef.current[indiceDaLinha] = elemento; }}
          />
        ))}
      </ol>
    </React.Fragment>
  );
};

/* ---------- Nada encontrado ----------
   Nunca em branco e nunca afirma que o fato não ocorreu: diz o que a busca olhou e dá o
   próximo passo. */
/* O que todo "nada encontrado" diz que foi olhado: o período, até quando e desde quando há
   dados, e as perdas de evento informadas no período. */
const fatosDoQueFoiOlhado = (traduzir, periodo, peloRecebimento) => {
  const perdasNoPeriodo = PERDAS_INFORMADAS.filter((perda) => perda.informadaEm >= periodo.inicio && perda.informadaEm <= periodo.fim);
  return [
    [traduzir('vazioPeriodo'), `${textoDoPeriodoComFuso(traduzir, periodo)}, ${traduzir(peloRecebimento ? 'periodoPeloRecebimento' : 'periodoPelaOrigem')}`],
    [traduzir('vazioDadosAte'), traduzir('vazioDadosAteValor', { dadosAte: formatarHoraComSegundos(RELOGIO_DO_PAINEL.dadosAte) })],
    [traduzir('vazioDadosDesde'), traduzir('vazioDadosDesdeValor', { dadosDesde: formatarData(RELOGIO_DO_PAINEL.dadosDesde), dias: RETENCAO_EM_DIAS })],
    [traduzir('vazioPerdas'), perdasNoPeriodo.length
      ? perdasNoPeriodo.map((perda) => traduzir('vazioPerdasValor', { quantidade: perda.quantidade, aplicacao: perda.aplicacao, horario: formatarHoraEMinuto(perda.informadaEm) })).join('; ')
      : traduzir('vazioSemPerdas')],
  ];
};

const VazioDaBusca = ({ traduzir, busca, resultado, catalogo, liberaToda, indisponivel, aoAmpliar, aoTirarFiltros }) => {
  const { periodo } = resultado;
  const camposDeclaradosDepois = busca.filtros
    .map((filtro) => campoDoCatalogo(catalogo, filtro.campo))
    .filter((campo) => campo && campo.rapidoDesde);
  const fatos = [
    ...fatosDoQueFoiOlhado(traduzir, periodo, busca.base === 'recebimento'),
    [traduzir('vazioRapidoDesde'), camposDeclaradosDepois.length
      ? camposDeclaradosDepois.map((campo) => traduzir('vazioRapidoDesdeValor', { campo: campo.nome, horario: formatarDataEHora(campo.rapidoDesde) })).join('; ')
      : traduzir('vazioRapidoDesdeTodos')],
  ];
  const podeAmpliarPara24h = periodo.duracao < MILISSEGUNDOS_POR_DIA;
  const podeAmpliarParaARetencao = liberaToda && busca.periodo !== '30d';

  return (
    <EmptyState
      title={traduzir('buscaVazioTitulo')}
      body={traduzir('buscaVazioCorpo')}
      detalhes={<ListaDeFatos fatos={fatos} emCaixa />}
      acoes={(
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {podeAmpliarPara24h && <Button variant="primary" compacto disabled={indisponivel} onClick={() => aoAmpliar('24h')}>{traduzir('vazioAmpliarPara24h')}</Button>}
          {podeAmpliarParaARetencao && <Button variant="secondary" compacto disabled={indisponivel} onClick={() => aoAmpliar('30d')}>{traduzir('vazioAmpliarParaARetencao')}</Button>}
          {(busca.filtros.length > 0 || busca.texto) && <Button variant="secondary" compacto disabled={indisponivel} onClick={aoTirarFiltros}>{traduzir('vazioTirarFiltros')}</Button>}
        </div>
      )}
    />
  );
};

/* ---------- Avisos do resultado ---------- */
const AvisosDoResultado = ({ traduzir, busca, resultado, indisponivel, aoReduzirParaUltimaHora, aoBuscarAntesDoRapido }) => (
  <React.Fragment>
    {resultado.parcial && (
      <AvisoDeAtencao
        titulo={traduzir('parcialTitulo', { horario: formatarHoraEMinuto(resultado.olhouAte) })}
        corpo={traduzir('parcialCorpo', { segundos: SEGUNDOS_DA_BUSCA_LENTA, fim: formatarHoraEMinuto(resultado.periodo.fim), horario: formatarHoraEMinuto(resultado.olhouAte) })}
        acao={busca.periodo !== '1h' && !busca.incluirAntesDoRapido && (
          <Button variant="secondary" compacto disabled={indisponivel} onClick={aoReduzirParaUltimaHora}>{traduzir('parcialReduzir')}</Button>
        )}
      />
    )}
    {resultado.corteRapido && (
      <AvisoDeAtencao
        titulo={traduzir('rapidoDesdeTitulo', { campo: resultado.campoDeclaradoDepois.nome, horario: textoDoHorarioProximo(resultado.corteRapido) })}
        corpo={traduzir('rapidoDesdeCorpo', { horario: formatarDataEHora(resultado.corteRapido) })}
        acao={(
          <Button variant="secondary" compacto disabled={indisponivel} onClick={aoBuscarAntesDoRapido}>
            {traduzir('rapidoDesdeBuscarAntes', { horario: textoDoHorarioProximo(resultado.corteRapido) })}
          </Button>
        )}
      />
    )}
  </React.Fragment>
);

/* ---------- A tela ---------- */
const TelaBusca = ({ lang, estado, params, papel }) => {
  const traduzir = useT(lang);
  const { navigate } = useRouter();
  const parametrosDoPainel = { ...PAINEL_DO_EXCURFLY, ...params };
  const { produto: idDoProduto, ambiente: idDoAmbiente, busca: textoDaBusca, idDoEvento: idDoEventoAberto } = parametrosDoPainel;
  const secaoDoEvento = parametrosDoPainel.secao;
  const temEventoAberto = Boolean(idDoEventoAberto);

  const catalogo = useMemo(() => catalogoDoProduto(idDoProduto), [idDoProduto]);
  const eventoAberto = useMemo(
    () => eventosDoAmbiente(idDoProduto, idDoAmbiente).find((evento) => evento.id === idDoEventoAberto) || null,
    [idDoProduto, idDoAmbiente, idDoEventoAberto]);
  const busca = useMemo(() => ajustarBusca(decodificarBusca(textoDaBusca), catalogo), [textoDaBusca, catalogo]);
  const resultado = useMemo(
    () => calcularResultado({ idDoProduto, idDoAmbiente, busca, catalogo }),
    [idDoProduto, idDoAmbiente, busca, catalogo]);

  const [textoDigitado, setTextoDigitado] = useState(busca.texto);
  const [modoRegex, setModoRegex] = useState(busca.regex);
  const [painelAberto, setPainelAberto] = useState(null);
  const [quebrarLinha, setQuebrarLinha] = useState(false);
  const campoDeBuscaRef = useRef(null);
  const botaoDePeriodoRef = useRef(null);
  const botaoDeFiltroRef = useRef(null);

  useEffect(() => { setTextoDigitado(busca.texto); setModoRegex(busca.regex); setPainelAberto(null); }, [textoDaBusca]);

  useFocoDeVoltaAoFechar(painelAberto, { periodo: botaoDePeriodoRef, filtro: botaoDeFiltroRef });

  useEffect(() => {
    if (!painelAberto) return undefined;
    const fecharComEsc = (eventoDeTeclado) => { if (eventoDeTeclado.key === 'Escape') setPainelAberto(null); };
    window.addEventListener('keydown', fecharComEsc);
    return () => window.removeEventListener('keydown', fecharComEsc);
  }, [painelAberto]);

  const desabilitado = estado === 'disabled';
  const semInternet = estado === 'offline';
  /* Com um evento aberto, carregando, vazio e erro falam do evento: a lista continua na tela. */
  const estadoDaLista = temEventoAberto && ['loading', 'empty', 'error'].includes(estado) ? 'default' : estado;
  const carregando = estadoDaLista === 'loading';
  const comErro = estadoDaLista === 'error';
  const vazio = !comErro && (estadoDaLista === 'empty' || resultado.total === 0);
  const buscaIndisponivel = desabilitado || semInternet;
  const liberaToda = temFiltroEspecifico(busca, catalogo);
  const chaveDaRecusa = recusaDoTexto(textoDigitado, modoRegex);
  const nomeDoProduto = (PRODUTOS.find((produto) => produto.id === idDoProduto) || PRODUTOS[0]).nome;
  const nomeDoAmbiente = (AMBIENTES.find((ambiente) => ambiente.id === idDoAmbiente) || AMBIENTES[0]).nome;
  const indiceDoEventoAberto = resultado.eventos.findIndex((evento) => evento.id === idDoEventoAberto);

  /* Toda mudança da busca vira endereço. Sem filtro, na última hora, é a abertura do painel.
     Com `destino.idDoEvento`, o endereço leva também o evento aberto ao lado da lista. */
  const irParaBusca = (novaBusca, destino = {}) => {
    const idDoProdutoDeDestino = destino.produto || idDoProduto;
    const rotasDoPapel = ROTAS_DO_PAPEL[destino.papel || papel];
    const buscaCodificada = codificarBusca(ajustarBusca(novaBusca, catalogoDoProduto(idDoProdutoDeDestino)));
    const parametrosDaRota = { produto: idDoProdutoDeDestino, ambiente: destino.ambiente || idDoAmbiente };
    if (destino.idDoEvento) {
      const parametrosDoEvento = { ...parametrosDaRota, busca: buscaCodificada, idDoEvento: destino.idDoEvento };
      if (destino.secao) navigate(rotasDoPapel.eventoNaSecao, { ...parametrosDoEvento, secao: destino.secao });
      else navigate(rotasDoPapel.evento, parametrosDoEvento);
      return;
    }
    const comBusca = buscaCodificada !== BUSCA_DE_ABERTURA;
    navigate(comBusca ? rotasDoPapel.busca : rotasDoPapel.abertura, comBusca ? { ...parametrosDaRota, busca: buscaCodificada } : parametrosDaRota);
  };
  const mudarBusca = (mudancas) => irParaBusca({ ...busca, pagina: 1, ...mudancas });

  /* Abrir outro evento pede o servidor: sem internet, só o que já está aberto continua. */
  const abrirEvento = (evento) => { if (!buscaIndisponivel) irParaBusca(busca, { idDoEvento: evento.id }); };
  const fecharEvento = () => irParaBusca(busca);
  const irParaASecaoDoEvento = (idDaSecao) => irParaBusca(busca, { idDoEvento: idDoEventoAberto, secao: idDaSecao });
  const abrirEventoVizinho = (passo) => {
    const eventoVizinho = indiceDoEventoAberto >= 0 && resultado.eventos[indiceDoEventoAberto + passo];
    if (eventoVizinho) abrirEvento(eventoVizinho);
  };
  /* "Clicar num campo do evento aberto cria a ficha": a busca ganha o filtro e o endereço muda. */
  const filtrarPeloValor = (filtroNovo) => mudarBusca({ filtros: juntarFiltro(busca.filtros, filtroNovo) });
  const abrirTentativa = (nomeDoCampo, valorDoCampo) => {
    lembrarOrigemDaTentativa(
      { produto: idDoProduto, ambiente: idDoAmbiente, busca: codificarBusca(busca), idDoEvento: idDoEventoAberto }, nomeDoCampo, valorDoCampo);
    navigate(ROTAS_DO_PAPEL[papel].tentativa, { produto: idDoProduto, ambiente: idDoAmbiente, campo: nomeDoCampo, valor: encodeURIComponent(valorDoCampo) });
  };

  const buscarOTexto = () => {
    if (buscaIndisponivel || chaveDaRecusa) return;
    mudarBusca({ texto: textoDigitado.trim(), regex: modoRegex });
  };
  const limparTexto = () => {
    setTextoDigitado('');
    if (busca.texto && !buscaIndisponivel) mudarBusca({ texto: '' });
    campoDeBuscaRef.current?.focus();
  };

  return (
    <CascaDoPainel
      traduzir={traduzir} estado={estado} params={parametrosDoPainel} papel={papel} campoDeBuscaRef={campoDeBuscaRef}
      aoMudar={(destino) => irParaBusca({ ...busca, pagina: 1 }, { ...destino, idDoEvento: destino.papel ? idDoEventoAberto : undefined, secao: secaoDoEvento })}
    >
      {semInternet && (
        <FaixaFixa>
          <AvisoSemInternet
            titulo={traduzir('semInternetTitulo')}
            continuaFuncionando={traduzir(temEventoAberto ? 'eventoSemInternetContinua' : 'buscaSemInternetContinua')}
            espera={traduzir(temEventoAberto ? 'eventoSemInternetEspera' : 'buscaSemInternetEspera')}
          />
        </FaixaFixa>
      )}

      <BarraDeBusca
        traduzir={traduzir}
        desabilitado={desabilitado} buscaIndisponivel={buscaIndisponivel} campoDeBuscaRef={campoDeBuscaRef}
        textoDigitado={textoDigitado} aoDigitar={setTextoDigitado}
        modoRegex={modoRegex} aoTrocarModoRegex={() => setModoRegex(!modoRegex)}
        chaveDaRecusa={chaveDaRecusa} aoBuscar={buscarOTexto} aoLimparTexto={limparTexto}
      />

      <div style={{ position: 'relative', display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <SeletorDePeriodo
          botaoRef={botaoDePeriodoRef}
          traduzir={traduzir} busca={busca} periodo={resultado.periodo} liberaToda={liberaToda}
          indisponivel={buscaIndisponivel} aberto={painelAberto === 'periodo'}
          aoAbrir={() => setPainelAberto('periodo')} aoFechar={() => setPainelAberto(null)}
          aoEscolherPeriodo={(periodoEscolhido) => mudarBusca({ periodo: periodoEscolhido, incluirAntesDoRapido: false })}
          aoEscolherBase={(baseEscolhida) => mudarBusca({ base: baseEscolhida })}
        />
        <FichasDaBusca
          traduzir={traduzir} busca={busca} catalogo={catalogo} nomeDoProduto={nomeDoProduto}
          desabilitado={desabilitado} buscaIndisponivel={buscaIndisponivel}
          filtroAberto={painelAberto === 'filtro'} botaoDeFiltroRef={botaoDeFiltroRef}
          aoAbrirFiltro={() => setPainelAberto('filtro')} aoFecharFiltro={() => setPainelAberto(null)}
          aoAplicarFiltro={(filtroNovo) => { setPainelAberto(null); mudarBusca({ filtros: juntarFiltro(busca.filtros, filtroNovo) }); }}
          aoRemoverFiltro={(filtroRemovido) => mudarBusca({ filtros: busca.filtros.filter((filtro) => filtro !== filtroRemovido) })}
        />
      </div>

      {comErro && (
        <AvisoDeErro
          titulo={traduzir('buscaErroTitulo')} corpo={traduzir('buscaErroCorpo')}
          acao={<div><Button variant="secondary" compacto onClick={() => {}}>{traduzir('tentarDeNovo')}</Button></div>}
        />
      )}

      {!comErro && !vazio && (
        <AvisosDoResultado
          traduzir={traduzir} busca={busca} resultado={resultado} indisponivel={buscaIndisponivel}
          aoReduzirParaUltimaHora={() => mudarBusca({ periodo: '1h' })}
          aoBuscarAntesDoRapido={() => mudarBusca({
            periodo: periodoDeIntervalo(Math.max(resultado.periodo.inicio, resultado.corteRapido - MILISSEGUNDOS_POR_DIA), resultado.corteRapido),
            incluirAntesDoRapido: true,
          })}
        />
      )}

      {!comErro && (
        <div style={temEventoAberto ? {
          flex: '1 1 0', minHeight: ALTURA_MINIMA_COM_EVENTO_ABERTO, display: 'grid', gap: 'var(--space-3)',
          gridTemplateColumns: COLUNAS_COM_EVENTO_ABERTO, gridTemplateRows: 'minmax(0, 1fr)',
        } : undefined}>
        <section
          className={temEventoAberto ? 'rolagem-propria' : undefined}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            overflowX: 'hidden', overflowY: temEventoAberto ? 'auto' : 'hidden', minHeight: temEventoAberto ? 0 : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {!vazio && (
              <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{textoDaContagemDeEventos(traduzir, resultado)}</span>
            )}
            {!vazio && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{traduzir('buscaMaisRecentesPrimeiro')}</span>}
            <span title={traduzir('buscaDadosAteNota')} style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              {traduzir('buscaDadosAte', { dadosAte: formatarHoraComSegundos(RELOGIO_DO_PAINEL.dadosAte) })}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {!vazio && (
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
              )}
              {!vazio && (
                <Paginacao
                  traduzir={traduzir} resultado={resultado} indisponivel={buscaIndisponivel}
                  aoIrParaPagina={(pagina) => irParaBusca({ ...busca, pagina })}
                />
              )}
            </div>
          </div>

          {carregando && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <MensagemDeEstado acao={<Button variant="secondary" compacto onClick={() => {}}>{traduzir('cancelar')}</Button>}>
                {traduzir('buscando')}
              </MensagemDeEstado>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{traduzir('buscaResultadoAnterior')}</span>
            </div>
          )}

          {!vazio && resultado.passouDoLimite && (
            <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border)', fontSize: 12.5, color: 'var(--muted)' }}>
              {traduzir('buscaAcimaDoLimite', { limite: formatarQuantidade(LIMITE_DE_EVENTOS_DA_BUSCA) })}
            </div>
          )}

          {vazio
            ? (
              <VazioDaBusca
                traduzir={traduzir} busca={busca} resultado={resultado} catalogo={catalogo} liberaToda={liberaToda}
                indisponivel={buscaIndisponivel}
                aoAmpliar={(periodoMaior) => mudarBusca({ periodo: periodoMaior })}
                aoTirarFiltros={() => mudarBusca({ filtros: [], texto: '', regex: false })}
              />
            )
            : (
              <ListaDeEventos
                traduzir={traduzir} resultado={resultado} estado={estadoDaLista} quebrarLinha={quebrarLinha}
                peloRecebimento={busca.base === 'recebimento'}
                idDoEventoAberto={idDoEventoAberto} aoAbrir={abrirEvento} aoFechar={fecharEvento}
                eventoAbertoExiste={Boolean(eventoAberto) && estado !== 'empty'}
              />
            )}

          {!vazio && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{textoDaContagemDeEventos(traduzir, resultado)}</span>
              <Paginacao
                traduzir={traduzir} resultado={resultado} indisponivel={buscaIndisponivel}
                aoIrParaPagina={(pagina) => irParaBusca({ ...busca, pagina })}
              />
            </div>
          )}
        </section>
        {temEventoAberto && (
          <PainelDoEvento
            traduzir={traduzir} estado={estado} evento={eventoAberto} idDoEvento={idDoEventoAberto}
            catalogo={catalogo} filtrosDaBusca={busca.filtros} nomeDoProduto={nomeDoProduto} nomeDoAmbiente={nomeDoAmbiente}
            posicaoNaPagina={indiceDoEventoAberto} eventosNaPagina={resultado.eventos.length}
            enderecoDoEvento={`${window.location.origin}${window.location.pathname}${buildPath(ROTAS_DO_PAPEL[papel].evento, { produto: idDoProduto, ambiente: idDoAmbiente, busca: codificarBusca(busca), idDoEvento: idDoEventoAberto })}`}
            secao={secaoDoEvento} aoIrParaSecao={irParaASecaoDoEvento}
            aoFechar={fecharEvento} aoIrParaVizinho={abrirEventoVizinho}
            aoFiltrar={filtrarPeloValor} aoAbrirTentativa={abrirTentativa}
          />
        )}
        </div>
      )}
    </CascaDoPainel>
  );
};

const TelaPainelInvestigador = (propriedades) => <TelaBusca {...propriedades} papel="investigador" />;
const TelaPainelAdministrador = (propriedades) => <TelaBusca {...propriedades} papel="administrador" />;
