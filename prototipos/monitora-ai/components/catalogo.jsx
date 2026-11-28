// Monitora AI — Catálogo de campos (Prototipar o catálogo de campos).
// O Administrador vê os campos do produto, declara um campo que apareceu como "não
// declarado" (tipo, buscas permitidas e papel) e lê, antes de confirmar, que a mudança só
// vale para eventos novos. O Investigador lê a mesma tela, sem declarar.
// Os declarados são o catálogo de data.jsx, o mesmo de "Adicionar filtro" e do evento
// aberto; os não declarados saem dos eventos do ambiente. A janela de declarar abre por
// cima da lista, e o que foi declarado mora no endereço (o campo, o tipo, as buscas e o
// papel). Máscaras, listas de dados proibidos, apelidos e mudar ou remover um campo ficam
// fora desta rotina.

const PASSO_DECLARAR = 'declarar';
const PAPEL_NENHUM = 'nenhum';
const LARGURA_DA_JANELA_DE_DECLARAR = 660;
const LARGURA_DA_PROCURA_DE_CAMPO = 300;
/* Cinco linhas e meia à vista: os não declarados rolam por dentro da caixa, para os
   declarados (e o campo que acabou de ser declarado) ficarem na mesma tela. A linha cortada
   ao meio mostra que há mais para rolar. */
const ALTURA_MAXIMA_DOS_NAO_DECLARADOS = 306;
/* O título de coluna fica parado enquanto a lista rola por dentro da caixa. */
const ESTILO_DO_TITULO_DE_COLUNA_PARADO = {
  ...ESTILO_DO_TITULO_DE_COLUNA, position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)',
  borderBottom: 'none', boxShadow: 'inset 0 -1px 0 var(--border-strong)',
};
const PAPEIS_QUE_LIGAM_EVENTOS = ['correlacao', 'principal'];
const ESTADOS_SEM_O_CAMPO_DECLARADO = ['loading', 'error'];
const LARGURAS_DAS_COLUNAS_DE_NAO_DECLARADO = ['25%', '14%', '15%', '9%', '25%', '12%'];
const LARGURAS_DAS_COLUNAS_DE_DECLARADO = ['31%', '12%', '15%', '20%', '22%'];
const ESTILO_DO_TEXTO_ABAIXO_DA_CELULA = { fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 };
const ESTILO_DO_ROTULO_DA_ESCOLHA = { fontSize: 12, fontWeight: 700, color: 'var(--muted)' };
const ESTILO_DO_GRUPO_DA_ESCOLHA = { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' };

/* As buscas que cada tipo aceita (Definir semântica de busca e campos configuráveis): as
   `fixas` valem sempre; as `opcionais`, só se o Administrador marcar. */
const BUSCAS_DO_TIPO = {
  texto: { fixas: ['exata'], opcionais: ['comeco', 'palavras'] },
  numero: { fixas: ['exata', 'intervalo'], opcionais: [] },
  data: { fixas: ['exata', 'intervalo'], opcionais: [] },
  booleano: { fixas: ['exata'], opcionais: [] },
  url: { fixas: ['comeco'], opcionais: [] },
  codigo: { fixas: ['exata'], opcionais: [] },
};
const TIPOS_DE_CAMPO = Object.keys(BUSCAS_DO_TIPO);
const PAPEIS_DE_CAMPO = [PAPEL_NENHUM, 'correlacao', 'principal', 'localizacao'];
const CHAVE_DO_PAPEL_A_ESCOLHER = {
  nenhum: 'catalogoPapelNenhum', correlacao: 'papelCampoDeCorrelacao', principal: 'etiquetaCampoPrincipal', localizacao: 'papelCampoDeLocalizacao',
};
const CHAVE_DA_EXPLICACAO_DO_PAPEL = {
  nenhum: 'catalogoPapelExplicaNenhum', correlacao: 'catalogoPapelExplicaCorrelacao',
  principal: 'catalogoPapelExplicaPrincipal', localizacao: 'catalogoPapelExplicaLocalizacao',
};
const CHAVE_DO_EXEMPLO_DA_BUSCA = {
  exata: 'catalogoExemploExata', comeco: 'catalogoExemploComeco', palavras: 'catalogoExemploPalavras', intervalo: 'catalogoExemploIntervalo',
};
/* O exemplo que muda com o tipo: o intervalo de datas, o começo de uma URL, o código de busca. */
const CHAVE_DO_EXEMPLO_PROPRIO_DO_TIPO = {
  data: { intervalo: 'catalogoExemploIntervaloDeData' },
  url: { comeco: 'catalogoExemploComecoDeUrl' },
  codigo: { exata: 'catalogoExemploExataDeCodigo' },
};

const chaveDoExemploDaBusca = (tipo, buscaPermitida) => CHAVE_DO_EXEMPLO_PROPRIO_DO_TIPO[tipo]?.[buscaPermitida] || CHAVE_DO_EXEMPLO_DA_BUSCA[buscaPermitida];

/* ---------- A declaração no endereço ----------
   `numero.exata-intervalo.nenhum`: o tipo, as buscas permitidas e o papel. Endereço que
   não fecha com as regras do tipo não vale como declaração. */
const codificarDeclaracao = ({ tipo, buscas, papel }) => `${tipo}.${buscas.join('-')}.${papel}`;

const decodificarDeclaracao = (textoDaDeclaracao) => {
  const [tipo, textoDasBuscas = '', papel] = (textoDaDeclaracao || '').split('.');
  const buscasDoTipo = BUSCAS_DO_TIPO[tipo];
  if (!buscasDoTipo || !PAPEIS_DE_CAMPO.includes(papel)) return null;
  const buscasPedidas = textoDasBuscas.split('-');
  const buscasOpcionais = buscasDoTipo.opcionais.filter((buscaOpcional) => buscasPedidas.includes(buscaOpcional));
  return { tipo, buscasOpcionais, buscas: [...buscasDoTipo.fixas, ...buscasOpcionais], papel };
};

/* ---------- Os campos do produto (simulado) ---------- */

/* O tipo que o painel sugere pelo valor visto. A lista vale pelo tipo dos seus valores. */
const tipoSugeridoPeloValor = (valorDeExemplo) => {
  const valoresVistos = Array.isArray(valorDeExemplo) ? valorDeExemplo : [valorDeExemplo];
  if (valoresVistos.length > 0 && valoresVistos.every((valorVisto) => typeof valorVisto === 'number')) return 'numero';
  if (valoresVistos.length > 0 && valoresVistos.every((valorVisto) => typeof valorVisto === 'boolean')) return 'booleano';
  return 'texto';
};

/* Os atributos que os eventos do ambiente trazem e que o catálogo não declara, nem por
   apelido: onde apareceram, desde quando, em quantos eventos e um valor de exemplo (o do
   evento mais recente). Em ordem de nome, para achar pelo que se leu no evento. */
const camposNaoDeclaradosDoAmbiente = (idDoProduto, idDoAmbiente) => {
  const nomesDeclarados = new Set((CATALOGO_DE_CAMPOS[idDoProduto] || []).flatMap((campo) => [campo.nome, ...(campo.apelidos || [])]));
  const vistosPorNome = new Map();
  eventosDoAmbiente(idDoProduto, idDoAmbiente).forEach((evento) => {
    const horarioDoEvento = evento.origemEm ?? evento.recebidoEm;
    Object.entries(evento.atributos || {}).forEach(([nomeDoAtributo, valorDoAtributo]) => {
      if (nomesDeclarados.has(nomeDoAtributo)) return;
      const campoVisto = vistosPorNome.get(nomeDoAtributo)
        || { nome: nomeDoAtributo, aplicacoes: [], eventos: 0, vistoDesde: horarioDoEvento, valorDeExemplo: valorDoAtributo };
      if (!campoVisto.aplicacoes.includes(evento.aplicacao)) campoVisto.aplicacoes.push(evento.aplicacao);
      campoVisto.eventos += 1;
      campoVisto.vistoDesde = Math.min(campoVisto.vistoDesde, horarioDoEvento);
      vistosPorNome.set(nomeDoAtributo, campoVisto);
    });
  });
  return [...vistosPorNome.values()].sort((campoAnterior, campoSeguinte) => campoAnterior.nome.localeCompare(campoSeguinte.nome));
};

/* Os declarados há pouco vêm primeiro, do mais novo para o mais antigo: são os que ainda
   têm "rápido desde" e que alguém acabou de mexer. Os demais seguem a ordem do catálogo. */
const comOsDeclaradosHaPoucoPrimeiro = (campos) => [
  ...campos.filter((campo) => campo.rapidoDesde).sort((campoAnterior, campoSeguinte) => campoSeguinte.rapidoDesde - campoAnterior.rapidoDesde),
  ...campos.filter((campo) => !campo.rapidoDesde),
];

/* O catálogo que a tela mostra: o cenário, mais o que o endereço diz que acabou de ser
   declarado. O campo declarado sai dos não declarados e entra no topo dos declarados, para
   ficar à vista, com "rápido desde" o agora do cenário. */
const montarCatalogo = ({ idDoProduto, camposVistos, nomeDoCampoDeclarado, declaracao }) => {
  const declaradosAntes = comOsDeclaradosHaPoucoPrimeiro(CATALOGO_DE_CAMPOS[idDoProduto] || []);
  const campoVisto = declaracao ? camposVistos.find((campo) => campo.nome === nomeDoCampoDeclarado) : null;
  if (!campoVisto) return { declarados: declaradosAntes, naoDeclarados: camposVistos, campoDeclaradoAgora: null };
  const campoDeclaradoAgora = {
    nome: campoVisto.nome, tipo: declaracao.tipo, buscas: declaracao.buscas,
    papel: declaracao.papel === PAPEL_NENHUM ? undefined : declaracao.papel,
    rapidoDesde: RELOGIO_DO_PAINEL.agora,
    ...(PAPEIS_QUE_LIGAM_EVENTOS.includes(declaracao.papel) ? { correlacaoDesde: RELOGIO_DO_PAINEL.agora } : {}),
  };
  return {
    declarados: [campoDeclaradoAgora, ...declaradosAntes],
    naoDeclarados: camposVistos.filter((campo) => campo.nome !== campoVisto.nome),
    campoDeclaradoAgora,
  };
};

const campoTemONome = (campo, procuraSemCaixa) => [campo.nome, campo.descricao || '', ...(campo.apelidos || [])]
  .some((textoDoCampo) => textoDoCampo.toLowerCase().includes(procuraSemCaixa));

/* ---------- Textos derivados ---------- */
const textoDasBuscasPermitidas = (traduzir, buscas) => buscas.map((buscaPermitida) => traduzir(CHAVE_DA_BUSCA_PERMITIDA[buscaPermitida])).join(', ');

const textoDaBuscaComExemplo = (traduzir, tipo, buscaPermitida) => traduzir('catalogoBuscaComExemplo', {
  busca: traduzir(CHAVE_DA_BUSCA_PERMITIDA[buscaPermitida]),
  exemplo: traduzir(chaveDoExemploDaBusca(tipo, buscaPermitida)),
});

/* ---------- A lista ---------- */

/* O produto e as contas do catálogo contra os limites. O catálogo é do produto; os não
   declarados são os que os eventos do ambiente da casca trouxeram. */
const ResumoDoCatalogo = ({ traduzir, nomeDoProduto, nomeDoAmbiente, declarados, naoDeclarados, semNumeros, podeDeclarar }) => (
  <section aria-label={traduzir('catalogoResumo')} style={{ ...ESTILO_DA_CAIXA, padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
    <dl style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1) var(--space-5)' }}>
      <FatoDoResumo nome={traduzir('cascaProduto')} valor={nomeDoProduto} />
      {!semNumeros && (
        <FatoDoResumo
          nome={traduzir('catalogoFatoDeclarados')}
          valor={traduzir('catalogoContaComLimite', { quantidade: formatarQuantidade(declarados.length), limite: LIMITE_DE_CAMPOS_DECLARADOS })}
        />
      )}
      {!semNumeros && (
        <FatoDoResumo
          nome={traduzir('catalogoFatoPorPalavras')}
          valor={traduzir('catalogoContaComLimite', {
            quantidade: declarados.filter((campo) => campo.buscas.includes('palavras')).length, limite: LIMITE_DE_CAMPOS_COM_BUSCA_POR_PALAVRAS,
          })}
        />
      )}
      {!semNumeros && <FatoDoResumo nome={traduzir('catalogoFatoNaoDeclarados', { ambiente: nomeDoAmbiente })} valor={formatarQuantidade(naoDeclarados.length)} />}
    </dl>
    <p style={{ ...ESTILO_DO_TEXTO_DE_APOIO, maxWidth: 940 }}>{traduzir('catalogoComoFunciona')}</p>
    {!podeDeclarar && <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{traduzir('catalogoSoLeitura')}</p>}
  </section>
);

const LinhaDeCampoNaoDeclarado = ({ traduzir, campo, podeDeclarar, indisponivel, motivoDaEspera, idDaNotaDoLimite, classeDoDeclarar, aoDeclarar }) => (
  <tr>
    <td style={ESTILO_DA_CELULA_DE_CHAVE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <CodigoEmDestaque tamanho={13}>{campo.nome}</CodigoEmDestaque>
        <Etiqueta tom="atencao">{traduzir('etiquetaNaoDeclarado')}</Etiqueta>
      </div>
    </td>
    <td style={ESTILO_DA_CELULA_DE_CHAVE}>{campo.aplicacoes.join(', ')}</td>
    <td style={{ ...ESTILO_DA_CELULA_DE_CHAVE, fontVariantNumeric: 'tabular-nums' }}>{formatarDataEHora(campo.vistoDesde)}</td>
    <td style={{ ...ESTILO_DA_CELULA_DE_CHAVE, fontVariantNumeric: 'tabular-nums' }}>{formatarQuantidade(campo.eventos)}</td>
    <td style={{ ...ESTILO_DA_CELULA_DE_CHAVE, fontFamily: 'var(--font-mono)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {textoDoValorDoAtributo(campo.valorDeExemplo)}
    </td>
    {podeDeclarar && (
      <td style={{ ...ESTILO_DA_CELULA_DE_CHAVE, textAlign: 'right' }}>
        <Button
          variant="secondary" compacto disabled={indisponivel} title={motivoDaEspera} className={classeDoDeclarar} onClick={aoDeclarar}
          aria-haspopup="dialog" aria-describedby={idDaNotaDoLimite} aria-label={traduzir('catalogoDeclararRotulo', { campo: campo.nome })}
        >
          {traduzir('catalogoDeclarar')}
        </Button>
      </td>
    )}
  </tr>
);

/* Os campos que apareceram nos eventos e ainda não filtram. Com o limite de campos
   declarados atingido, "Declarar" fica apagado e a caixa diz por quê, por escrito. */
const CaixaDosNaoDeclarados = ({ traduzir, campos, nomeDoAmbiente, procurando, podeDeclarar, noLimite, indisponivel, motivoDaEspera, classeDoDeclarar, aoDeclarar }) => {
  const idDaNotaDoLimite = React.useId();
  const limiteAVista = podeDeclarar && noLimite;
  const larguras = podeDeclarar ? LARGURAS_DAS_COLUNAS_DE_NAO_DECLARADO : LARGURAS_DAS_COLUNAS_DE_NAO_DECLARADO.slice(0, -1);
  const nomeDoCampoDemonstrado = (campos.find((campo) => campo.nome === CAMPO_DO_EXEMPLO_DE_DECLARACAO) || campos[0])?.nome;
  return (
    <section aria-label={traduzir('catalogoNaoDeclaradosTitulo')} style={ESTILO_DA_CAIXA}>
      <div style={ESTILO_DA_BARRA_DA_CAIXA}>
        <h2 style={{ ...ESTILO_DO_TITULO_DA_CAIXA, fontSize: 15 }}>{traduzir('catalogoNaoDeclaradosTitulo')}</h2>
        <Etiqueta tom={campos.length > 0 ? 'atencao' : 'neutro'}>{formatarQuantidade(campos.length)}</Etiqueta>
        <span style={{ ...ESTILO_DO_TEXTO_DE_APOIO, flexBasis: '100%' }}>{traduzir('catalogoNaoDeclaradosNota', { ambiente: nomeDoAmbiente })}</span>
      </div>
      {limiteAVista && (
        <p id={idDaNotaDoLimite} style={{ margin: 0, padding: 'var(--space-2) var(--space-3)', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)', background: 'var(--warn-soft)' }}>
          {traduzir('catalogoLimiteNota', { limite: LIMITE_DE_CAMPOS_DECLARADOS })}
        </p>
      )}
      {campos.length === 0 && (
        <p style={{ margin: 0, padding: 'var(--space-4) var(--space-3)', fontSize: 13, color: 'var(--muted)' }}>
          {procurando ? traduzir('catalogoNenhumComEsseNome') : traduzir('catalogoNaoDeclaradosNenhum', { ambiente: nomeDoAmbiente })}
        </p>
      )}
      {campos.length > 0 && (
        <div
          className="rolagem-propria" tabIndex={0} role="group" aria-label={traduzir('catalogoNaoDeclaradosTabela', { ambiente: nomeDoAmbiente })}
          style={{ maxHeight: ALTURA_MAXIMA_DOS_NAO_DECLARADOS, overflowY: 'auto' }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              {larguras.map((larguraDaColuna, indiceDaColuna) => <col key={indiceDaColuna} style={{ width: larguraDaColuna }} />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA_PARADO}>{traduzir('filtroColunaCampo')}</th>
                <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA_PARADO}>{traduzir('catalogoColunaOndeApareceu')}</th>
                <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA_PARADO}>{traduzir('catalogoColunaVistoDesde')}</th>
                <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA_PARADO}>{traduzir('catalogoColunaEventos')}</th>
                <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA_PARADO}>{traduzir('catalogoColunaExemplo')}</th>
                {podeDeclarar && <th scope="col" style={{ ...ESTILO_DO_TITULO_DE_COLUNA_PARADO, textAlign: 'right' }}>{traduzir('chaveColunaAcao')}</th>}
              </tr>
            </thead>
            <tbody>
              {campos.map((campo) => (
                <LinhaDeCampoNaoDeclarado
                  key={campo.nome} traduzir={traduzir} campo={campo} podeDeclarar={podeDeclarar}
                  indisponivel={indisponivel || noLimite} motivoDaEspera={noLimite ? undefined : motivoDaEspera}
                  idDaNotaDoLimite={limiteAVista ? idDaNotaDoLimite : undefined}
                  classeDoDeclarar={campo.nome === nomeDoCampoDemonstrado ? classeDoDeclarar : undefined}
                  aoDeclarar={() => aoDeclarar(campo)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const LinhaDeCampoDeclarado = ({ traduzir, campo, declaradoAgora }) => {
  const complementos = [campo.descricao, campo.apelidos && traduzir('catalogoTambem', { apelidos: campo.apelidos.join(', ') })].filter(Boolean);
  const estiloDaCelula = ESTILO_DA_CELULA_DE_CHAVE;
  return (
    <tr>
      {/* O campo que acabou de ser declarado ganha a barra à esquerda e a etiqueta escrita. */}
      <td style={{ ...estiloDaCelula, ...(declaradoAgora ? { boxShadow: 'inset 3px 0 0 var(--ok)' } : {}) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <CodigoEmDestaque tamanho={13}>{campo.nome}</CodigoEmDestaque>
          {declaradoAgora && <Etiqueta tom="ok">{traduzir('catalogoDeclaradoAgora')}</Etiqueta>}
        </div>
        {complementos.length > 0 && <div style={ESTILO_DO_TEXTO_ABAIXO_DA_CELULA}>{complementos.join(' · ')}</div>}
      </td>
      <td style={estiloDaCelula}>{traduzir(CHAVE_DO_TIPO[campo.tipo])}</td>
      <td style={estiloDaCelula}>{textoDasBuscasPermitidas(traduzir, campo.buscas)}</td>
      <td style={estiloDaCelula}>
        {campo.papel
          ? traduzir(CHAVE_DO_PAPEL[campo.papel])
          : <span style={{ color: 'var(--muted)' }}>{traduzir('catalogoPapelNenhum')}</span>}
        {campo.correlacaoDesde && (
          <div style={ESTILO_DO_TEXTO_ABAIXO_DA_CELULA}>{traduzir('catalogoLigaDesde', { horario: textoDoHorarioProximo(campo.correlacaoDesde) })}</div>
        )}
      </td>
      <td style={estiloDaCelula}>
        <EtiquetaDaBusca garantida>
          {campo.rapidoDesde
            ? traduzir('fichaRapidoDesde', { horario: textoDoHorarioProximo(campo.rapidoDesde) })
            : traduzir('etiquetaBuscaGarantida')}
        </EtiquetaDaBusca>
        {campo.rapidoDesde && (
          <div style={{ ...ESTILO_DO_TEXTO_ABAIXO_DA_CELULA, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {traduzir('catalogoAntesSoBuscaLenta', { data: formatarDataEHora(campo.rapidoDesde) })}
          </div>
        )}
      </td>
    </tr>
  );
};

const CaixaDosDeclarados = ({ traduzir, campos, nomeDoProduto, procurando, nomeDoCampoDeclaradoAgora }) => (
  <section aria-label={traduzir('catalogoDeclaradosTitulo')} style={ESTILO_DA_CAIXA}>
    <div style={ESTILO_DA_BARRA_DA_CAIXA}>
      <h2 style={{ ...ESTILO_DO_TITULO_DA_CAIXA, fontSize: 15 }}>{traduzir('catalogoDeclaradosTitulo')}</h2>
      <Etiqueta>{formatarQuantidade(campos.length)}</Etiqueta>
    </div>
    {campos.length === 0 && (
      <p style={{ margin: 0, padding: 'var(--space-4) var(--space-3)', fontSize: 13, color: 'var(--muted)' }}>
        {traduzir(procurando ? 'catalogoNenhumComEsseNome' : 'catalogoDeclaradosNenhum')}
      </p>
    )}
    {campos.length > 0 && (
      <table aria-label={traduzir('catalogoDeclaradosTabela', { produto: nomeDoProduto })} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          {LARGURAS_DAS_COLUNAS_DE_DECLARADO.map((larguraDaColuna, indiceDaColuna) => <col key={indiceDaColuna} style={{ width: larguraDaColuna }} />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('filtroColunaCampo')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('filtroColunaTipo')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('catalogoColunaBuscas')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('catalogoColunaPapel')}</th>
            <th scope="col" style={ESTILO_DO_TITULO_DE_COLUNA}>{traduzir('filtroColunaPromessa')}</th>
          </tr>
        </thead>
        <tbody>
          {campos.map((campo) => (
            <LinhaDeCampoDeclarado key={campo.nome} traduzir={traduzir} campo={campo} declaradoAgora={campo.nome === nomeDoCampoDeclaradoAgora} />
          ))}
        </tbody>
      </table>
    )}
  </section>
);

/* ---------- A janela de declarar ---------- */

/* Tipo, buscas permitidas e papel de um campo que apareceu nos eventos. As buscas mudam
   com o tipo: só o texto tem busca que se marca. O aviso de que a mudança só vale para
   eventos novos vem antes do botão. Se a declaração falha, o que foi escolhido continua. */
const JanelaDeDeclarar = ({ traduzir, campo, declaracaoPedida, nomeDoProduto, camposPorPalavras, estado, classeDoBotao, aoDeclarar, aoFechar }) => {
  const tipoSugerido = tipoSugeridoPeloValor(campo.valorDeExemplo);
  const [tipoEscolhido, setTipoEscolhido] = useState(declaracaoPedida?.tipo || tipoSugerido);
  const [buscasMarcadas, setBuscasMarcadas] = useState(declaracaoPedida?.buscasOpcionais || []);
  const [papelEscolhido, setPapelEscolhido] = useState(declaracaoPedida?.papel || PAPEL_NENHUM);

  const declarando = estado === 'loading';
  const semInternet = estado === 'offline';
  const parado = estado === 'disabled' || declarando;
  const buscasDoTipo = BUSCAS_DO_TIPO[tipoEscolhido];
  const palavrasNoLimite = camposPorPalavras >= LIMITE_DE_CAMPOS_COM_BUSCA_POR_PALAVRAS;
  const buscasOpcionais = buscasDoTipo.opcionais.filter((buscaOpcional) => buscasMarcadas.includes(buscaOpcional));
  const horarioDeAgora = textoDoHorarioProximo(RELOGIO_DO_PAINEL.agora);
  const ligaEventos = PAPEIS_QUE_LIGAM_EVENTOS.includes(papelEscolhido);

  /* Cada escolha confere de novo se pode mudar: o controle apagado não basta sozinho. */
  const escolherTipo = (tipo) => { if (!parado) setTipoEscolhido(tipo); };
  const escolherPapel = (papel) => { if (!parado) setPapelEscolhido(papel); };
  const marcarBusca = (buscaOpcional, marcada) => {
    if (parado || (buscaOpcional === 'palavras' && palavrasNoLimite)) return;
    setBuscasMarcadas((buscasAnteriores) => (marcada
      ? [...buscasAnteriores, buscaOpcional]
      : buscasAnteriores.filter((buscaAnterior) => buscaAnterior !== buscaOpcional)));
  };
  const confirmar = () => aoDeclarar({ tipo: tipoEscolhido, buscas: [...buscasDoTipo.fixas, ...buscasOpcionais], papel: papelEscolhido });

  return (
    <JanelaDeDialogo largura={LARGURA_DA_JANELA_DE_DECLARAR} aoFechar={aoFechar} titulo={traduzir('catalogoDeclararTitulo', { campo: campo.nome, produto: nomeDoProduto })}>
      {estado === 'error' && (
        <AvisoDeErro
          titulo={traduzir('catalogoDeclararFalhaTitulo')} corpo={traduzir('catalogoDeclararFalhaCorpo')}
          acao={<div><Button variant="secondary" compacto onClick={confirmar}>{traduzir('tentarDeNovo')}</Button></div>}
        />
      )}
      <ListaDeFatos emCaixa fatos={[
        [traduzir('catalogoColunaOndeApareceu'), campo.aplicacoes.join(', ')],
        [traduzir('catalogoColunaVistoDesde'), `${formatarDataEHora(campo.vistoDesde)} · ${traduzir(campo.eventos === 1 ? 'contagemDeUmEvento' : 'contagemDeEventos', { quantidade: formatarQuantidade(campo.eventos) })}`],
        [traduzir('catalogoColunaExemplo'), <span style={{ wordBreak: 'break-all' }}><CodigoEmDestaque>{textoDoValorDoAtributo(campo.valorDeExemplo)}</CodigoEmDestaque></span>],
      ]} />

      <div style={ESTILO_DO_GRUPO_DA_ESCOLHA}>
        <span style={ESTILO_DO_ROTULO_DA_ESCOLHA}>{traduzir('catalogoTipo')}</span>
        <div>
          <SeletorSegmentado
            rotulo={traduzir('catalogoTipo')} valor={tipoEscolhido} disabled={parado} aoEscolher={escolherTipo}
            opcoes={TIPOS_DE_CAMPO.map((tipo) => ({ valor: tipo, rotulo: traduzir(CHAVE_DO_TIPO[tipo]) }))}
          />
        </div>
        {tipoEscolhido === tipoSugerido && !declaracaoPedida && (
          <span style={ESTILO_DO_TEXTO_DE_APOIO}>{traduzir('catalogoTipoSugerido', { tipo: traduzir(CHAVE_DO_TIPO[tipoSugerido]) })}</span>
        )}
      </div>

      <div role="group" aria-label={traduzir('catalogoColunaBuscas')} style={ESTILO_DO_GRUPO_DA_ESCOLHA}>
        <span style={ESTILO_DO_ROTULO_DA_ESCOLHA}>{traduzir('catalogoColunaBuscas')}</span>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {buscasDoTipo.fixas.map((buscaFixa) => (
            <li key={buscaFixa} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 13.5, fontWeight: 700 }}>
              <IconCheck size={16} style={{ color: 'var(--ok)', flexShrink: 0 }} />
              <span>{textoDaBuscaComExemplo(traduzir, tipoEscolhido, buscaFixa)}</span>
            </li>
          ))}
        </ul>
        {buscasDoTipo.opcionais.map((buscaOpcional) => {
          const foraDoLimite = buscaOpcional === 'palavras' && palavrasNoLimite;
          const complementoDePalavras = buscaOpcional === 'palavras' && traduzir(foraDoLimite ? 'catalogoPalavrasNoLimite' : 'catalogoPalavrasDoProduto', {
            usados: camposPorPalavras, limite: LIMITE_DE_CAMPOS_COM_BUSCA_POR_PALAVRAS,
          });
          return (
            <CaixaDeMarcar
              key={buscaOpcional} rotulo={traduzir(CHAVE_DA_BUSCA_PERMITIDA[buscaOpcional])}
              dica={[traduzir(chaveDoExemploDaBusca(tipoEscolhido, buscaOpcional)), complementoDePalavras].filter(Boolean).join(' · ')}
              marcada={buscasMarcadas.includes(buscaOpcional) && !foraDoLimite} disabled={parado || foraDoLimite}
              aoMudar={(marcada) => marcarBusca(buscaOpcional, marcada)}
            />
          );
        })}
        <span style={ESTILO_DO_TEXTO_DE_APOIO}>
          {buscasDoTipo.opcionais.length > 0
            ? traduzir('catalogoBuscasDeTexto')
            : traduzir('catalogoBuscasFixas', { tipo: traduzir(CHAVE_DO_TIPO[tipoEscolhido]) })}
        </span>
      </div>

      <div style={ESTILO_DO_GRUPO_DA_ESCOLHA}>
        <span style={ESTILO_DO_ROTULO_DA_ESCOLHA}>{traduzir('catalogoPapel')}</span>
        <div>
          <SeletorSegmentado
            rotulo={traduzir('catalogoPapel')} valor={papelEscolhido} disabled={parado} aoEscolher={escolherPapel}
            opcoes={PAPEIS_DE_CAMPO.map((papel) => ({ valor: papel, rotulo: traduzir(CHAVE_DO_PAPEL_A_ESCOLHER[papel]) }))}
          />
        </div>
        <span style={ESTILO_DO_TEXTO_DE_APOIO}>{traduzir(CHAVE_DA_EXPLICACAO_DO_PAPEL[papelEscolhido])}</span>
      </div>

      <AvisoDeAtencao
        titulo={traduzir('catalogoAvisoNovosTitulo')}
        corpo={(
          <React.Fragment>
            <div>{traduzir('catalogoAvisoNovosCorpo', { campo: campo.nome, horario: horarioDeAgora })}</div>
            {ligaEventos && <div style={{ marginTop: 'var(--space-1)' }}>{traduzir('catalogoAvisoCorrelacao', { campo: campo.nome, horario: horarioDeAgora })}</div>}
          </React.Fragment>
        )}
      />
      {semInternet && <p role="status" style={ESTILO_DA_NOTA_DE_ESPERA}>{traduzir('catalogoDeclararSemInternet')}</p>}
      <div style={ESTILO_DO_RODAPE_DA_JANELA}>
        <Button variant="secondary" disabled={estado === 'disabled'} onClick={aoFechar}>{traduzir('cancelar')}</Button>
        <Button variant="primary" loading={declarando} disabled={parado || semInternet} className={classeDoBotao} onClick={confirmar}>
          {declarando ? traduzir('catalogoDeclarando') : traduzir('catalogoDeclararConfirmar')}
        </Button>
      </div>
    </JanelaDeDialogo>
  );
};

/* ---------- A tela ---------- */
const TelaCatalogo = ({ lang, estado, params, papel }) => {
  const traduzir = useT(lang);
  const { navigate } = useRouter();
  const parametrosDoPainel = { ...PAINEL_DO_EXCURFLY, ...params };
  const { produto: idDoProduto, ambiente: idDoAmbiente, campo: nomeDoCampoDoEndereco, passo, declaracao: textoDaDeclaracao } = parametrosDoPainel;
  const rotasDoPapel = ROTAS_DO_PAPEL[papel];
  const podeDeclarar = papel === 'administrador';
  const nomeDoProduto = nomeDoProdutoPorId(idDoProduto);
  const nomeDoAmbiente = nomeDoAmbientePorId(idDoAmbiente);
  const ondeEstou = { produto: idDoProduto, ambiente: idDoAmbiente };

  const [procura, setProcura] = useState('');
  /* De qual evento aberto a pessoa veio: lido uma vez, ao chegar. */
  const [enderecoDeOrigem] = useState(() => {
    const enderecoLembrado = ORIGEM_DO_CATALOGO.endereco;
    ORIGEM_DO_CATALOGO.endereco = null;
    return enderecoLembrado;
  });
  const tituloRef = useRef(null);
  const quemAbriuAJanelaRef = useRef(null);
  const janelaAnteriorRef = useRef(null);

  const desabilitado = estado === 'disabled';
  const semInternet = estado === 'offline';
  const indisponivel = desabilitado || semInternet;
  const estadoDemonstrado = ESTADOS_DEMONSTRADOS.includes(estado) ? estado : null;
  const classeDemonstrada = classeDoEstadoDemonstrado(estadoDemonstrado);
  const motivoDaEspera = semInternet ? traduzir('motivoSemInternet') : undefined;

  const camposVistos = useMemo(() => camposNaoDeclaradosDoAmbiente(idDoProduto, idDoAmbiente), [idDoProduto, idDoAmbiente]);
  const declaracaoDoEndereco = useMemo(() => (podeDeclarar ? decodificarDeclaracao(textoDaDeclaracao) : null), [podeDeclarar, textoDaDeclaracao]);
  const campoVistoDoEndereco = podeDeclarar ? camposVistos.find((campo) => campo.nome === nomeDoCampoDoEndereco) || null : null;
  /* Enquanto a declaração não terminou ou falhou, nada foi declarado: a janela continua
     aberta, com o que foi escolhido. */
  const declaracaoJaFeita = Boolean(declaracaoDoEndereco) && !ESTADOS_SEM_O_CAMPO_DECLARADO.includes(estado);
  const { declarados, naoDeclarados, campoDeclaradoAgora } = useMemo(
    () => montarCatalogo({ idDoProduto, camposVistos, nomeDoCampoDeclarado: nomeDoCampoDoEndereco, declaracao: declaracaoJaFeita ? declaracaoDoEndereco : null }),
    [idDoProduto, camposVistos, nomeDoCampoDoEndereco, declaracaoJaFeita, declaracaoDoEndereco]);
  const noLimite = declarados.length >= LIMITE_DE_CAMPOS_DECLARADOS;

  /* A janela aberta sai do endereço. Endereço que não fecha com o cenário abre só a lista. */
  const pedeParaDeclarar = passo === PASSO_DECLARAR || (Boolean(declaracaoDoEndereco) && !declaracaoJaFeita);
  const janelaAberta = Boolean(campoVistoDoEndereco) && pedeParaDeclarar && !noLimite;

  /* Os estados da lista. Com um campo no endereço, a lista nunca se mostra vazia: aquele
     campo existe. Com a janela aberta, carregando e erro são da janela. */
  const semCampos = (declarados.length === 0 && naoDeclarados.length === 0) || (estado === 'empty' && !campoVistoDoEndereco);
  const comErroNaLista = estado === 'error' && !janelaAberta;
  const atualizandoALista = estado === 'loading' && !janelaAberta;

  const procuraSemCaixa = procura.trim().toLowerCase();
  const procurando = procuraSemCaixa !== '';
  const naoDeclaradosAchados = naoDeclarados.filter((campo) => campoTemONome(campo, procuraSemCaixa));
  const declaradosAchados = declarados.filter((campo) => campoTemONome(campo, procuraSemCaixa));

  /* Fechada a janela, o foco volta a quem a abriu; se esse botão não existe mais (o campo
     foi declarado), vai para o título da tela. */
  useEffect(() => {
    const janelaEstavaAberta = janelaAnteriorRef.current;
    janelaAnteriorRef.current = janelaAberta;
    if (!janelaEstavaAberta || janelaAberta) return;
    const quemAbriu = quemAbriuAJanelaRef.current;
    if (quemAbriu?.isConnected && quemAbriu.getAttribute('aria-disabled') !== 'true') quemAbriu.focus();
    else tituloRef.current?.focus();
  }, [janelaAberta]);

  /* Cada ação confere de novo se pode agir: o botão apagado não basta sozinho. */
  const voltarALista = () => navigate(rotasDoPapel.catalogo, ondeEstou);
  const voltarParaOEvento = () => { if (!indisponivel) window.location.hash = enderecoDeOrigem; };
  const irParaAsAplicacoes = () => { if (!indisponivel) navigate(rotasDoPapel.aplicacoes, ondeEstou); };
  const abrirDeclarar = (campo) => {
    if (indisponivel || noLimite) return;
    quemAbriuAJanelaRef.current = document.activeElement;
    navigate(rotasDoPapel.campoDoCatalogo, { ...ondeEstou, campo: campo.nome, passo: PASSO_DECLARAR });
  };
  const declarar = (declaracaoEscolhida) => {
    if (indisponivel || estado === 'loading') return;
    navigate(rotasDoPapel.campoDeclarado, { ...ondeEstou, campo: campoVistoDoEndereco.nome, declaracao: codificarDeclaracao(declaracaoEscolhida) });
  };

  /* Trocar o produto, o ambiente ou o papel leva ao catálogo de lá: os dois papéis têm a tela. */
  const mudarOPainel = (destino) => navigate(
    ROTAS_DO_PAPEL[destino.papel || papel].catalogo,
    { produto: destino.produto || idDoProduto, ambiente: destino.ambiente || idDoAmbiente });

  return (
    <CascaDoPainel traduzir={traduzir} estado={estado} params={parametrosDoPainel} papel={papel} aoMudar={mudarOPainel} itemAtual="catalogo" cabeNaJanela>
      {semInternet && <AvisoSemInternetFixo traduzir={traduzir} chaveDoQueContinua="catalogoSemInternetContinua" chaveDoQueEspera={podeDeclarar ? 'catalogoSemInternetEspera' : 'catalogoSemInternetEsperaSoLeitura'} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2) var(--space-3)', flexWrap: 'wrap', minHeight: ALTURA_DA_LINHA_DO_TITULO }}>
        <h1 ref={tituloRef} tabIndex={-1} style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.2px' }}>{traduzir('catalogoTitulo')}</h1>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{traduzir('aplicacoesFuso', { fuso: FUSO_DO_PAINEL.rotulo })}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {enderecoDeOrigem && (
            <Button variant="secondary" compacto disabled={indisponivel} title={motivoDaEspera} onClick={voltarParaOEvento}>
              {traduzir('tentativaVoltarParaOEvento')}
            </Button>
          )}
          {!comErroNaLista && !semCampos && (
            <div style={{ width: LARGURA_DA_PROCURA_DE_CAMPO }}>
              <Field
                label={traduzir('filtroProcurarCampo')} rotuloSoParaLeitor value={procura} onChange={setProcura} disabled={desabilitado}
                placeholder={traduzir('filtroProcurarCampo')} autoComplete="off"
              />
            </div>
          )}
        </div>
      </div>

      <ResumoDoCatalogo
        traduzir={traduzir} nomeDoProduto={nomeDoProduto} nomeDoAmbiente={nomeDoAmbiente} declarados={declarados} naoDeclarados={naoDeclarados}
        semNumeros={semCampos || comErroNaLista} podeDeclarar={podeDeclarar}
      />

      {campoDeclaradoAgora && !comErroNaLista && (
        <AvisoDeAtencao
          tom="feito" titulo={traduzir('catalogoDeclaradoTitulo', { campo: campoDeclaradoAgora.nome, horario: textoDoHorarioProximo(campoDeclaradoAgora.rapidoDesde) })}
          corpo={(
            <React.Fragment>
              <div>
                {traduzir('catalogoDeclaradoCorpo', {
                  campo: campoDeclaradoAgora.nome, tipo: traduzir(CHAVE_DO_TIPO[campoDeclaradoAgora.tipo]),
                  buscas: textoDasBuscasPermitidas(traduzir, campoDeclaradoAgora.buscas), horario: textoDoHorarioProximo(campoDeclaradoAgora.rapidoDesde),
                })}
              </div>
              {campoDeclaradoAgora.correlacaoDesde && (
                <div style={{ marginTop: 'var(--space-1)' }}>
                  {traduzir('catalogoDeclaradoCorrelacao', { horario: textoDoHorarioProximo(campoDeclaradoAgora.correlacaoDesde) })}
                </div>
              )}
            </React.Fragment>
          )}
        />
      )}

      {comErroNaLista && (
        <AvisoDeErro
          titulo={traduzir('catalogoErroTitulo')} corpo={traduzir('catalogoErroCorpo')}
          acao={<div><Button variant="secondary" compacto onClick={() => {}}>{traduzir('tentarDeNovo')}</Button></div>}
        />
      )}

      {atualizandoALista && !semCampos && (
        <section style={{ ...ESTILO_DA_CAIXA, display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-2)' }}>
          <MensagemDeEstado>{traduzir('catalogoCarregando')}</MensagemDeEstado>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{traduzir('aplicacoesCarregandoNota')}</span>
        </section>
      )}

      {!comErroNaLista && semCampos && (
        <section style={ESTILO_DA_CAIXA}>
          <EmptyState
            title={traduzir('catalogoVazioTitulo', { produto: nomeDoProduto })}
            body={traduzir('catalogoVazioCorpo')}
            detalhes={(
              <ListaDeFatos emCaixa fatos={[
                [traduzir('cascaProduto'), nomeDoProduto],
                [traduzir('cascaAmbiente'), nomeDoAmbiente],
                [traduzir('catalogoFatoDeclarados'), traduzir('catalogoContaComLimite', { quantidade: 0, limite: LIMITE_DE_CAMPOS_DECLARADOS })],
              ]} />
            )}
            acoes={podeDeclarar && (
              <Button variant="primary" compacto disabled={indisponivel} title={motivoDaEspera} className={classeDemonstrada} onClick={irParaAsAplicacoes}>
                {traduzir('catalogoVazioCta')}
              </Button>
            )}
          />
        </section>
      )}

      {!comErroNaLista && !semCampos && (
        <React.Fragment>
          <CaixaDosNaoDeclarados
            traduzir={traduzir} campos={naoDeclaradosAchados} nomeDoAmbiente={nomeDoAmbiente} procurando={procurando}
            podeDeclarar={podeDeclarar} noLimite={noLimite} indisponivel={indisponivel} motivoDaEspera={motivoDaEspera}
            classeDoDeclarar={janelaAberta ? undefined : classeDemonstrada} aoDeclarar={abrirDeclarar}
          />
          <CaixaDosDeclarados
            traduzir={traduzir} campos={declaradosAchados} nomeDoProduto={nomeDoProduto} procurando={procurando}
            nomeDoCampoDeclaradoAgora={campoDeclaradoAgora?.nome}
          />
        </React.Fragment>
      )}

      {janelaAberta && (
        <JanelaDeDeclarar
          key={`${campoVistoDoEndereco.nome}/${textoDaDeclaracao || PASSO_DECLARAR}`} traduzir={traduzir} campo={campoVistoDoEndereco}
          declaracaoPedida={declaracaoDoEndereco} nomeDoProduto={nomeDoProduto}
          camposPorPalavras={declarados.filter((campo) => campo.buscas.includes('palavras')).length}
          estado={estado} classeDoBotao={classeDemonstrada} aoDeclarar={declarar} aoFechar={voltarALista}
        />
      )}
    </CascaDoPainel>
  );
};

const TelaCatalogoInvestigador = (propriedades) => <TelaCatalogo {...propriedades} papel="investigador" />;
const TelaCatalogoAdministrador = (propriedades) => <TelaCatalogo {...propriedades} papel="administrador" />;
