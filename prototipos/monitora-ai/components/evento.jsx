// Monitora AI — Detalhe de um evento (Prototipar o detalhe de um evento).
// O evento abre ao lado da lista da busca, sem escondê-la: Enter ou clique abre, Esc fecha,
// ↑ e ↓ trocam o evento aberto. Mostra, nesta ordem: cabeçalho, horários, origem, vínculos
// de correlação, atributos e erro. De cada valor de campo pesquisável sai a ficha de
// filtro; do valor do campo principal, a tentativa.
// `DetalheDoEvento` é o miolo, que não depende da largura do computador (a chegada pelo
// celular vai reusá-lo); `PainelDoEvento` é a moldura dele ao lado da lista.

const ALTURA_DA_PILHA_RECOLHIDA = 168;
const LARGURA_MINIMA_DO_PAR = 132;
const COLUNAS_DOS_ATRIBUTOS = ['40%', 'auto', '172px'];
const PAPEIS_DE_VINCULO = ['principal', 'correlacao'];
const ESTADOS_DEMONSTRADOS = ['hover', 'focus', 'active'];
const ORDEM_DAS_SITUACOES = ['pesquisavel', 'mascarado', 'codigo', 'incompativel', 'naoDeclarado'];
/* Seções do evento que o "Ir para" alcança, pelo nome que vai no endereço. */
const SECOES_DO_EVENTO = [
  { id: 'horarios', chave: 'eventoSecaoHorarios' },
  { id: 'origem', chave: 'eventoSecaoOrigem' },
  { id: 'vinculos', chave: 'eventoSecaoVinculosCurta' },
  { id: 'atributos', chave: 'eventoSecaoAtributos' },
  { id: 'erro', chave: 'eventoSecaoErro' },
];

const CHAVE_DA_MARCA = {
  horarioNoFuturo: 'marcaHorarioNoFuturo',
  muitoNoPassado: 'marcaMuitoNoPassado',
  semHorarioDeOrigem: 'marcaSemHorarioDeOrigem',
  cortado: 'marcaCortado',
  valorAcimaDoLimite: 'marcaValorAcimaDoLimite',
};

/* ---------- Horários e durações ---------- */
const textoDoHorarioCompleto = (traduzir, instante) => traduzir('eventoHorarioComFuso', {
  data: formatarData(instante), hora: formatarHoraComMilissegundos(instante), fuso: FUSO_DO_PAINEL.rotulo,
});

const textoDaDuracao = (traduzir, milissegundos) => {
  if (milissegundos < 1000) return traduzir('duracaoMilissegundos', { valor: milissegundos });
  const segundosTotais = Math.floor(milissegundos / 1000);
  if (segundosTotais < 60) {
    return traduzir('duracaoSegundos', { valor: (milissegundos / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) });
  }
  const minutosTotais = Math.floor(segundosTotais / 60);
  if (minutosTotais < 60) return traduzir('duracaoMinutos', { minutos: minutosTotais, segundos: segundosTotais % 60 });
  return traduzir('duracaoHoras', { horas: Math.floor(minutosTotais / 60), minutos: minutosTotais % 60 });
};

/* ---------- Atributos contra o catálogo de campos ---------- */

/* O campo do catálogo que um atributo do evento preenche, pelo nome ou por um apelido.
   Sem campo, o atributo é "não declarado". */
const campoDoAtributo = (catalogo, nomeDoAtributo) => catalogo.find((campo) => !campo.propriedadeDoEvento
  && (campo.nome === nomeDoAtributo || (campo.apelidos || []).includes(nomeDoAtributo))) || null;

const valorCabeNoTipo = (campo, valor) => {
  if (campo.tipo === 'numero') {
    return typeof valor === 'number' || (typeof valor === 'string' && valor.trim() !== '' && !Number.isNaN(Number(valor)));
  }
  if (campo.tipo === 'booleano') return typeof valor === 'boolean' || valor === 'true' || valor === 'false';
  if (campo.tipo === 'data') return instanteDoTexto(valor) !== null;
  return valor === null || typeof valor !== 'object';
};

/* Uma linha por valor que veio no evento: os atributos, depois os valores mascarados e
   os códigos de busca. `situacao` diz o que a linha pode fazer. */
const linhasDosAtributos = (evento, catalogo) => {
  const linhasDeAtributo = Object.entries(evento.atributos || {}).map(([nomeDoAtributo, valorDoAtributo]) => {
    const campo = campoDoAtributo(catalogo, nomeDoAtributo);
    let situacao = 'pesquisavel';
    if (!campo) situacao = 'naoDeclarado';
    else if (!valorCabeNoTipo(campo, valorDoAtributo)) situacao = 'incompativel';
    return { id: nomeDoAtributo, nome: nomeDoAtributo, valor: valorDoAtributo, campo, situacao };
  });
  const linhasDeMascarado = Object.entries(evento.mascarados || {}).map(([nomeDoAtributo, valorMascarado]) => (
    { id: `${nomeDoAtributo}:mascarado`, nome: nomeDoAtributo, valor: valorMascarado, campo: campoDoAtributo(catalogo, nomeDoAtributo), situacao: 'mascarado' }));
  const linhasDeCodigo = Object.entries(evento.codigosDeBusca || {}).map(([nomeDoAtributo, codigoDeBusca]) => (
    { id: `${nomeDoAtributo}:codigo`, nome: nomeDoAtributo, valor: codigoDeBusca, campo: campoDoAtributo(catalogo, nomeDoAtributo), situacao: 'codigo' }));
  /* Primeiro o que filtra, depois o dado pessoal (mascarado e código de busca), o valor
     incompatível e o que não foi declarado; dentro de cada grupo, a ordem em que veio. */
  const linhas = [...linhasDeAtributo, ...linhasDeMascarado, ...linhasDeCodigo];
  return ORDEM_DAS_SITUACOES.flatMap((situacao) => linhas.filter((linha) => linha.situacao === situacao));
};

/* Por que a linha não oferece "filtrar por este valor", como chave de texto; null quando
   ela oferece. */
const motivoSemAtalho = (linha) => {
  if (linha.situacao === 'mascarado') return 'motivoValorMascarado';
  if (!linha.campo) return 'motivoNaoDeclarado';
  if (linha.situacao === 'incompativel') return 'motivoValorIncompativel';
  if (!linha.campo.buscas.includes('exata')) return 'motivoOutraBusca';
  return null;
};

const filtroJaEstaNaBusca = (filtrosDaBusca, nomeDoCampo, codigoDoOperador, valorDoFiltro) => filtrosDaBusca
  .some((filtro) => filtro.campo === nomeDoCampo && filtro.operador === codigoDoOperador && filtro.valores.includes(valorDoFiltro));

const classeDoEstadoDemonstrado = (estadoDemonstrado) => (estadoDemonstrado ? `botao--${estadoDemonstrado}` : undefined);

/* ---------- Peças do miolo ---------- */
const SecaoDoEvento = ({ titulo, secao, children }) => (
  <section aria-label={titulo} data-secao={secao} style={{
    display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
    paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border)',
  }}>
    <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{titulo}</h3>
    {children}
  </section>
);

/* Pares "nome em cima, valor embaixo", que se acomodam à largura que houver. `emLinha`
   deixa cada par com a largura do próprio valor, para valor longo não quebrar no meio. */
const ParesDoEvento = ({ pares, emLinha }) => (
  <dl style={{
    margin: 0, gap: 'var(--space-2) var(--space-5)',
    ...(emLinha
      ? { display: 'flex', flexWrap: 'wrap' }
      : { display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${LARGURA_MINIMA_DO_PAR}px, 1fr))` }),
  }}>
    {pares.map(([nomeDoPar, valorDoPar, emMono]) => (
      <div key={nomeDoPar} style={{ minWidth: 0 }}>
        <dt style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{nomeDoPar}</dt>
        <dd style={{
          margin: 0, fontSize: 13, fontWeight: 600, wordBreak: 'break-word',
          fontFamily: emMono ? 'var(--font-mono)' : 'inherit',
        }}>{valorDoPar}</dd>
      </div>
    ))}
  </dl>
);

const NotaDoEvento = ({ icone: Icone, children }) => (
  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.45 }}>
    <Icone size={14} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 2 }} />
    <span>{children}</span>
  </div>
);

/* O valor como a aplicação mandou: lista como lista, JSON com níveis indentado. */
const ValorDoAtributo = ({ valor }) => {
  const estiloDoTexto = { fontFamily: 'var(--font-mono)', fontSize: 12.5, wordBreak: 'break-word' };
  if (Array.isArray(valor)) {
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
        {valor.map((itemDaLista, indiceDoItem) => (
          <li key={indiceDoItem} style={{
            ...estiloDoTexto, padding: '0 var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)',
          }}>{textoDoValorDoAtributo(itemDaLista)}</li>
        ))}
      </ul>
    );
  }
  if (valor !== null && typeof valor === 'object') {
    return <pre style={{ ...estiloDoTexto, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{JSON.stringify(valor, null, 2)}</pre>;
  }
  return <span style={estiloDoTexto}>{String(valor)}</span>;
};

/* ---------- Cabeçalho, horários e origem ---------- */
const CabecalhoDoEvento = ({ traduzir, evento }) => {
  const pares = [
    [traduzir('campoNomeDoEvento'), evento.nome, true],
    evento.familia && [traduzir('campoFamilia'), evento.familia, true],
    evento.ocorrencia && [traduzir('campoOcorrencia'), evento.ocorrencia, true],
  ].filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        <span style={{ flexShrink: 0, paddingTop: 2 }}><NivelDoEvento nivel={evento.nivel} traduzir={traduzir} /></span>
        <p style={{
          margin: 0, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, lineHeight: 1.4,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{evento.mensagem}</p>
      </div>
      <ParesDoEvento pares={pares} emLinha />
    </div>
  );
};

const HorariosDoEvento = ({ traduzir, evento }) => {
  const marcas = evento.marcas || [];
  const estiloDoHorario = { fontFamily: 'var(--font-mono)', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' };
  const diferenca = textoDaDuracao(traduzir, Math.max(0, evento.recebidoEm - evento.origemEm));
  const horarioDeOrigem = marcas.includes('semHorarioDeOrigem')
    ? <span style={{ color: 'var(--muted)' }}>{traduzir('eventoSemHorarioDeOrigem')}</span>
    : <span style={estiloDoHorario}>{textoDoHorarioCompleto(traduzir, evento.origemEm)}</span>;
  const horarioDeRecebimento = (
    <span>
      <span style={estiloDoHorario}>{textoDoHorarioCompleto(traduzir, evento.recebidoEm)}</span>
      {!marcas.includes('semHorarioDeOrigem') && !evento.atrasado && (
        <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{' · '}{traduzir('eventoDepoisDaOrigem', { diferenca })}</span>
      )}
    </span>
  );
  return (
    <SecaoDoEvento titulo={traduzir('eventoSecaoHorarios')} secao="horarios">
      <ListaDeFatos fatos={[
        [traduzir('eventoHorarioDeOrigem'), horarioDeOrigem],
        [traduzir('eventoHorarioDeRecebimento'), horarioDeRecebimento],
      ]} />
      {evento.atrasado && <NotaDoEvento icone={IconClock}>{traduzir('eventoAtrasado', { diferenca })}</NotaDoEvento>}
      {marcas.map((marca) => <NotaDoEvento key={marca} icone={IconAlert}>{traduzir(CHAVE_DA_MARCA[marca])}</NotaDoEvento>)}
    </SecaoDoEvento>
  );
};

const OrigemDoEvento = ({ traduzir, evento, nomeDoProduto, nomeDoAmbiente }) => (
  <SecaoDoEvento titulo={traduzir('eventoSecaoOrigem')} secao="origem">
    <ParesDoEvento pares={[
      [traduzir('cascaProduto'), nomeDoProduto],
      [traduzir('cascaAmbiente'), nomeDoAmbiente],
      [traduzir('campoAplicacao'), evento.aplicacao],
      [traduzir('campoVersao'), evento.versao, true],
      [traduzir('campoExecucao'), evento.execucao, true],
      [traduzir('eventoNumeroNaExecucao'), formatarQuantidade(evento.numeroNaExecucao), true],
      [traduzir('eventoCodigo'), evento.id, true],
    ]} />
  </SecaoDoEvento>
);

/* ---------- Vínculos de correlação ---------- */
const VinculosDoEvento = ({ traduzir, linhas, indisponivel, semInternet, estadoDemonstrado, aoAbrirTentativa }) => {
  const linhasDeVinculo = linhas.filter((linha) => linha.situacao === 'pesquisavel' && PAPEIS_DE_VINCULO.includes(linha.campo.papel));
  return (
    <SecaoDoEvento titulo={traduzir('eventoSecaoVinculos')} secao="vinculos">
      {linhasDeVinculo.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{traduzir('eventoSemVinculos')}</p>}
      {linhasDeVinculo.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {linhasDeVinculo.map((linha) => {
            const ehPrincipal = linha.campo.papel === 'principal';
            return (
              <li key={linha.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2) var(--space-3)', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700 }}>{linha.nome}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700 }}>{String(linha.valor)}</span>
                <Etiqueta tom={ehPrincipal ? 'destaque' : 'neutro'}>
                  {traduzir(ehPrincipal ? 'etiquetaCampoPrincipal' : 'papelCampoDeCorrelacao')}
                </Etiqueta>
                {ehPrincipal && (
                  <span style={{ marginLeft: 'auto' }}>
                    <Button
                      variant="primary" compacto disabled={indisponivel}
                      className={classeDoEstadoDemonstrado(estadoDemonstrado)}
                      aria-label={traduzir('eventoAbrirTentativaDe', { valor: String(linha.valor) })}
                      title={semInternet ? traduzir('motivoSemInternet') : undefined}
                      onClick={() => aoAbrirTentativa(linha.campo.nome, String(linha.valor))}
                    >
                      {traduzir('eventoAbrirTentativa')}<IconArrow size={14} />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SecaoDoEvento>
  );
};

/* ---------- Atributos ---------- */
const AtalhoDeFiltro = ({ traduzir, linha, filtrosDaBusca, indisponivel, semInternet, estadoDemonstrado, aoFiltrar }) => {
  const chaveDoMotivo = motivoSemAtalho(linha);
  if (chaveDoMotivo) {
    const tipoDoCampo = linha.campo ? traduzir(CHAVE_DO_TIPO[linha.campo.tipo]) : '';
    return (
      <ComDica dica={traduzir(chaveDoMotivo, { tipo: tipoDoCampo })} alinharADireita mostrar={Boolean(estadoDemonstrado)}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{traduzir('eventoSemAtalho')}</span>
        <IconInfo size={14} style={{ color: 'var(--muted)' }} />
      </ComDica>
    );
  }
  const valorDoFiltro = String(linha.valor);
  const botaoDoOperador = (codigoDoOperador, chaveDoRotuloAcessivel) => {
    const jaFiltrado = filtroJaEstaNaBusca(filtrosDaBusca, linha.campo.nome, codigoDoOperador, valorDoFiltro);
    let motivoDoBloqueio;
    if (semInternet) motivoDoBloqueio = traduzir('motivoSemInternet');
    else if (jaFiltrado) motivoDoBloqueio = traduzir('motivoJaFiltrado');
    return (
      <Button
        variant="secondary" compacto disabled={indisponivel || jaFiltrado}
        className={codigoDoOperador === 'e' ? classeDoEstadoDemonstrado(estadoDemonstrado) : undefined}
        aria-label={traduzir(chaveDoRotuloAcessivel, { campo: linha.campo.nome, valor: valorDoFiltro })}
        title={motivoDoBloqueio}
        onClick={() => aoFiltrar({ campo: linha.campo.nome, operador: codigoDoOperador, valores: [valorDoFiltro] })}
      >
        {traduzir(OPERADORES[codigoDoOperador].chave)}
      </Button>
    );
  };
  return (
    <span style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
      {botaoDoOperador('e', 'eventoFiltrarE')}
      {botaoDoOperador('n', 'eventoFiltrarNaoE')}
    </span>
  );
};

const LinhaDeAtributo = ({ traduzir, linha, filtrosDaBusca, indisponivel, semInternet, estadoDemonstrado, aoFiltrar }) => {
  const { campo, situacao } = linha;
  const mostraOCampo = Boolean(campo) && situacao !== 'mascarado';
  const estiloDaCelula = { padding: 'var(--space-2) var(--space-2) var(--space-2) 0', borderBottom: '1px solid var(--border)', verticalAlign: 'top', textAlign: 'left' };
  return (
    <tr>
      <th scope="row" style={{ ...estiloDaCelula, fontWeight: 400 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700, wordBreak: 'break-word' }}>{linha.nome}</span>
        {mostraOCampo && (
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px var(--space-2)', marginTop: 2 }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              {[traduzir(CHAVE_DO_TIPO[campo.tipo]), traduzir(CHAVE_DO_PAPEL[campo.papel] || 'papelCampoPesquisavel')].join(' · ')}
            </span>
            <EtiquetaDaBusca garantida>{textoDaEtiquetaDoCampo(traduzir, campo, false)}</EtiquetaDaBusca>
          </span>
        )}
        {!campo && <span style={{ display: 'block', marginTop: 2 }}><Etiqueta>{traduzir('etiquetaNaoDeclarado')}</Etiqueta></span>}
      </th>
      <td style={estiloDaCelula}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'flex-start' }}>
          <ValorDoAtributo valor={linha.valor} />
          {situacao === 'mascarado' && <Etiqueta tom="destaque">{traduzir('etiquetaValorMascarado')}</Etiqueta>}
          {situacao === 'codigo' && <Etiqueta tom="destaque">{traduzir('tipoCodigoDeBusca')}</Etiqueta>}
          {situacao === 'incompativel' && <Etiqueta tom="atencao" podeQuebrar>{traduzir('etiquetaValorIncompativel')}</Etiqueta>}
        </div>
      </td>
      <td style={{ ...estiloDaCelula, paddingRight: 0, textAlign: 'right' }}>
        <AtalhoDeFiltro
          traduzir={traduzir} linha={linha} filtrosDaBusca={filtrosDaBusca} indisponivel={indisponivel} semInternet={semInternet}
          estadoDemonstrado={estadoDemonstrado} aoFiltrar={aoFiltrar}
        />
      </td>
    </tr>
  );
};

const AtributosDoEvento = ({ traduzir, linhas, filtrosDaBusca, indisponivel, semInternet, estadoDemonstrado, aoFiltrar }) => {
  const estiloDoTitulo = {
    padding: '0 var(--space-2) var(--space-1) 0', borderBottom: '1px solid var(--border-strong)', textAlign: 'left',
    fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)',
  };
  const situacoes = linhas.map((linha) => linha.situacao);
  /* O estado forçado na conferência aparece numa linha só de cada tipo. */
  const idDaPrimeiraComAtalho = linhas.find((linha) => !motivoSemAtalho(linha)
    && !filtroJaEstaNaBusca(filtrosDaBusca, linha.campo.nome, 'e', String(linha.valor)))?.id;
  const idDaPrimeiraSemAtalho = linhas.find((linha) => motivoSemAtalho(linha))?.id;
  const notas = [
    situacoes.includes('naoDeclarado') && 'notaNaoDeclarado',
    situacoes.includes('mascarado') && 'notaValorMascarado',
    situacoes.includes('codigo') && 'notaCodigoDeBusca',
  ].filter(Boolean);
  return (
    <SecaoDoEvento titulo={traduzir('eventoSecaoAtributos')} secao="atributos">
      {linhas.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{traduzir('eventoSemAtributos')}</p>}
      {linhas.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {COLUNAS_DOS_ATRIBUTOS.map((larguraDaColuna, indiceDaColuna) => <col key={indiceDaColuna} style={{ width: larguraDaColuna }} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" style={estiloDoTitulo}>{traduzir('eventoColunaAtributo')}</th>
              <th scope="col" style={estiloDoTitulo}>{traduzir('eventoColunaValor')}</th>
              <th scope="col" style={{ ...estiloDoTitulo, paddingRight: 0, textAlign: 'right' }}>{traduzir('eventoColunaFiltrar')}</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <LinhaDeAtributo
                key={linha.id} traduzir={traduzir} linha={linha} filtrosDaBusca={filtrosDaBusca}
                indisponivel={indisponivel} semInternet={semInternet} aoFiltrar={aoFiltrar}
                estadoDemonstrado={[idDaPrimeiraComAtalho, idDaPrimeiraSemAtalho].includes(linha.id) ? estadoDemonstrado : null}
              />
            ))}
          </tbody>
        </table>
      )}
      {notas.map((chaveDaNota) => (
        <p key={chaveDaNota} style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>{traduzir(chaveDaNota)}</p>
      ))}
    </SecaoDoEvento>
  );
};

/* ---------- Erro ----------
   A pilha longa abre recolhida, numa altura fixa com rolagem própria: o evento abre na
   hora (ADR 0004) e a pilha não empurra o resto. */
const PilhaDoErro = ({ traduzir, pilha, indisponivel }) => {
  const [inteira, setInteira] = useState(false);
  const textoDaPilha = pilha.join('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{traduzir('eventoPilha')}</span>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{traduzir('eventoPilhaLinhas', { linhas: pilha.length })}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="secondary" compacto disabled={indisponivel} aria-expanded={inteira} onClick={() => setInteira(!inteira)}>
            {inteira ? <IconUp size={14} /> : <IconDown size={14} />}
            {traduzir(inteira ? 'eventoPilhaRecolher' : 'eventoPilhaMostrarTudo')}
          </Button>
          <BotaoDeCopiar rotulo={traduzir('eventoPilhaCopiar')} rotuloCopiado={traduzir('copiado')} texto={textoDaPilha} disabled={indisponivel} />
        </div>
      </div>
      <pre
        tabIndex={0} role="group" aria-label={traduzir('eventoPilha')} data-rolagem-propria="" className="rolagem-propria"
        style={{
          margin: 0, padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
          background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--fg)',
          fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre',
          overflow: 'auto', maxHeight: inteira ? 'none' : ALTURA_DA_PILHA_RECOLHIDA,
        }}
      >{textoDaPilha}</pre>
    </div>
  );
};

const ErroDoEvento = ({ traduzir, erro, indisponivel }) => (
  <SecaoDoEvento titulo={traduzir('eventoSecaoErro')} secao="erro">
    <ListaDeFatos fatos={[
      [traduzir('eventoErroTipo'), <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700, wordBreak: 'break-word' }}>{erro.tipo}</span>],
      [traduzir('eventoErroMensagem'), <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, wordBreak: 'break-word' }}>{erro.mensagem}</span>],
    ]} />
    <PilhaDoErro traduzir={traduzir} pilha={erro.pilha} indisponivel={indisponivel} />
  </SecaoDoEvento>
);

/* ---------- O miolo ----------
   Tudo de um evento, na ordem de leitura. Não depende da largura: os pares se acomodam
   e a tabela de atributos encolhe com a coluna. */
const DetalheDoEvento = ({
  traduzir, evento, catalogo, filtrosDaBusca, nomeDoProduto, nomeDoAmbiente,
  indisponivel, semInternet, estadoDemonstrado, aoFiltrar, aoAbrirTentativa,
}) => {
  const linhas = useMemo(() => linhasDosAtributos(evento, catalogo), [evento, catalogo]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <CabecalhoDoEvento traduzir={traduzir} evento={evento} />
      <HorariosDoEvento traduzir={traduzir} evento={evento} />
      <OrigemDoEvento traduzir={traduzir} evento={evento} nomeDoProduto={nomeDoProduto} nomeDoAmbiente={nomeDoAmbiente} />
      <VinculosDoEvento
        traduzir={traduzir} linhas={linhas} indisponivel={indisponivel} semInternet={semInternet}
        estadoDemonstrado={estadoDemonstrado} aoAbrirTentativa={aoAbrirTentativa}
      />
      <AtributosDoEvento
        traduzir={traduzir} linhas={linhas} filtrosDaBusca={filtrosDaBusca} indisponivel={indisponivel} semInternet={semInternet}
        estadoDemonstrado={estadoDemonstrado} aoFiltrar={aoFiltrar}
      />
      {evento.erro && <ErroDoEvento traduzir={traduzir} erro={evento.erro} indisponivel={indisponivel} />}
    </div>
  );
};

/* ---------- Carregando, não encontrado e erro ---------- */

/* O esqueleto ocupa a mesma caixa do evento. No painel de verdade ele só aparece se a
   abertura passar de 1 s; antes disso, nada muda na tela. */
const EsqueletoDoEvento = ({ traduzir }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
    <MensagemDeEstado>{traduzir('eventoAbrindo')}</MensagemDeEstado>
    <Skeleton altura={22} largura="70%" />
    <Skeleton altura={34} />
    <Skeleton altura={44} />
    <Skeleton altura={72} />
    <Skeleton altura={64} />
    <Skeleton altura={220} />
    <Skeleton altura={ALTURA_DA_PILHA_RECOLHIDA} />
  </div>
);

/* Nunca em branco e nunca afirma que o fato não ocorreu: diz o que foi procurado, desde
   quando há dados e o próximo passo. */
const EventoNaoEncontrado = ({ traduzir, idDoEvento, nomeDoProduto, nomeDoAmbiente, aoFechar }) => (
  <EmptyState
    title={traduzir('eventoVazioTitulo')}
    body={traduzir('eventoVazioCorpo')}
    detalhes={(
      <ListaDeFatos emCaixa fatos={[
        [traduzir('eventoCodigo'), <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>{idDoEvento}</span>],
        [traduzir('cascaProduto'), nomeDoProduto],
        [traduzir('cascaAmbiente'), nomeDoAmbiente],
        [traduzir('vazioDadosDesde'), traduzir('vazioDadosDesdeValor', { dadosDesde: formatarData(RELOGIO_DO_PAINEL.dadosDesde), dias: RETENCAO_EM_DIAS })],
      ]} />
    )}
    cta={traduzir('eventoVoltarABusca')} onCta={aoFechar}
  />
);

/* ---------- A moldura ao lado da lista ----------
   Região rotulada que recebe o foco ao abrir. Esc fecha (o foco volta para a linha, em
   busca.jsx) e ↑ ↓ trocam o evento aberto, menos dentro da pilha, que rola com as setas. */
const PainelDoEvento = ({
  traduzir, estado, evento, idDoEvento, catalogo, filtrosDaBusca, nomeDoProduto, nomeDoAmbiente,
  posicaoNaPagina, eventosNaPagina, enderecoDoEvento, secao, aoIrParaSecao, aoFechar, aoIrParaVizinho, aoFiltrar, aoAbrirTentativa,
}) => {
  const painelRef = useRef(null);
  const mioloRolavelRef = useRef(null);
  const desabilitado = estado === 'disabled';
  const semInternet = estado === 'offline';
  const carregando = estado === 'loading';
  const comErro = estado === 'error';
  const naoEncontrado = !carregando && !comErro && (estado === 'empty' || !evento);
  const mostraOEvento = !carregando && !comErro && !naoEncontrado;
  const estadoDemonstrado = ESTADOS_DEMONSTRADOS.includes(estado) ? estado : null;
  const temPosicao = mostraOEvento && posicaoNaPagina >= 0;

  useEffect(() => { painelRef.current?.focus({ preventScroll: true }); }, []);
  const secoesDoEvento = mostraOEvento ? SECOES_DO_EVENTO.filter((secaoDoEvento) => secaoDoEvento.id !== 'erro' || evento.erro) : [];

  /* A seção do endereço já aparece rolada, sem animação: o link abre o evento nela. Sem
     seção, o evento abre no topo. Refaz a conta quando as fontes chegam, porque as
     alturas mudam. */
  const rolarParaASecao = (idDaSecao) => {
    const miolo = mioloRolavelRef.current;
    if (!miolo) return;
    const alvo = idDaSecao && miolo.querySelector(`[data-secao="${idDaSecao}"]`);
    miolo.scrollTop = alvo ? alvo.offsetTop : 0;
  };
  React.useLayoutEffect(() => {
    rolarParaASecao(secao);
    let aindaMontado = true;
    document.fonts?.ready.then(() => { if (aindaMontado) rolarParaASecao(secao); });
    return () => { aindaMontado = false; };
  }, [idDoEvento, secao, mostraOEvento]);
  const irParaASecao = (idDaSecao) => { aoIrParaSecao(idDaSecao); rolarParaASecao(idDaSecao); };

  const teclarNoPainel = (eventoDeTeclado) => {
    if (eventoDeTeclado.key === 'Escape') { eventoDeTeclado.preventDefault(); aoFechar(); return; }
    const passos = { ArrowDown: 1, ArrowUp: -1 };
    if (!(eventoDeTeclado.key in passos) || eventoDeTeclado.target.closest('[data-rolagem-propria]')) return;
    eventoDeTeclado.preventDefault();
    aoIrParaVizinho(passos[eventoDeTeclado.key]);
  };

  return (
    <section
      ref={painelRef} tabIndex={-1} aria-label={traduzir('eventoPainel')} aria-busy={carregando || undefined}
      className="painel-do-evento" onKeyDown={teclarNoPainel}
      style={{
        minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)', overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap',
        padding: 'var(--space-2) var(--space-2) var(--space-2) var(--space-4)', borderBottom: '1px solid var(--border)',
      }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{traduzir('eventoTitulo')}</h2>
        {temPosicao && (
          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {traduzir('eventoPosicao', { posicao: posicaoNaPagina + 1, total: eventosNaPagina })}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {mostraOEvento && (
            <React.Fragment>
              <BotaoDeIcone
                rotulo={traduzir('eventoAnterior')} icone={IconUp} aoClicar={() => aoIrParaVizinho(-1)}
                disabled={desabilitado || semInternet || posicaoNaPagina <= 0}
              />
              <BotaoDeIcone
                rotulo={traduzir('eventoProximo')} icone={IconDown} aoClicar={() => aoIrParaVizinho(1)}
                disabled={desabilitado || semInternet || posicaoNaPagina < 0 || posicaoNaPagina >= eventosNaPagina - 1}
              />
              <BotaoDeCopiar
                rotulo={traduzir('eventoCopiarLink')} rotuloCopiado={traduzir('eventoLinkCopiado')}
                texto={enderecoDoEvento} disabled={desabilitado}
              />
            </React.Fragment>
          )}
          <BotaoDeIcone rotulo={traduzir('eventoFechar')} icone={IconClose} aoClicar={aoFechar} />
        </div>
      </div>

      {secoesDoEvento.length > 0 && (
        <nav aria-label={traduzir('eventoSecoes')} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap',
          padding: 'var(--space-1) var(--space-2) var(--space-1) var(--space-4)', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginRight: 'var(--space-1)' }}>{traduzir('eventoIrPara')}</span>
          {secoesDoEvento.map((secaoDoEvento) => (
            <Button
              key={secaoDoEvento.id} compacto variant={secaoDoEvento.id === secao ? 'secondary' : 'ghost'}
              aria-current={secaoDoEvento.id === secao ? 'true' : undefined} disabled={desabilitado}
              onClick={() => irParaASecao(secaoDoEvento.id)}
            >
              {traduzir(secaoDoEvento.chave)}
            </Button>
          ))}
        </nav>
      )}

      <div ref={mioloRolavelRef} className="rolagem-propria" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--space-4)' }}>
        {carregando && <EsqueletoDoEvento traduzir={traduzir} />}
        {comErro && (
          <AvisoDeErro
            titulo={traduzir('eventoFalhaTitulo')} corpo={traduzir('eventoFalhaCorpo')}
            acao={<div><Button variant="secondary" compacto onClick={() => {}}>{traduzir('tentarDeNovo')}</Button></div>}
          />
        )}
        {naoEncontrado && (
          <EventoNaoEncontrado
            traduzir={traduzir} idDoEvento={idDoEvento} nomeDoProduto={nomeDoProduto} nomeDoAmbiente={nomeDoAmbiente} aoFechar={aoFechar}
          />
        )}
        {mostraOEvento && (
          <DetalheDoEvento
            traduzir={traduzir} evento={evento} catalogo={catalogo} filtrosDaBusca={filtrosDaBusca}
            nomeDoProduto={nomeDoProduto} nomeDoAmbiente={nomeDoAmbiente}
            indisponivel={desabilitado || semInternet} semInternet={semInternet} estadoDemonstrado={estadoDemonstrado}
            aoFiltrar={aoFiltrar} aoAbrirTentativa={aoAbrirTentativa}
          />
        )}
      </div>
    </section>
  );
};
