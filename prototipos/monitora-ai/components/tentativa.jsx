// Monitora AI — Tentativa: miolo provisório.
// A tentativa é o grupo de eventos ligados a um valor de um campo principal. A tela dela,
// com a linha do tempo, é a próxima rotina do lote Investigar (Prototipar a tentativa e a
// linha do tempo). Por enquanto esta tela só recebe o atalho "Abrir a tentativa" do
// evento aberto e devolve a pessoa para onde ela estava.

const LARGURA_DO_MIOLO_PROVISORIO = 560;

/* De qual evento aberto a pessoa veio, para o "voltar". Fica só na memória da página: num
   link aberto direto não há de onde voltar, e o botão leva aos eventos da tentativa. */
const ORIGEM_DA_TENTATIVA = { parametrosDoEvento: null, nomeDoCampo: null, valorDoCampo: null };

const lembrarOrigemDaTentativa = (parametrosDoEvento, nomeDoCampo, valorDoCampo) => {
  Object.assign(ORIGEM_DA_TENTATIVA, { parametrosDoEvento, nomeDoCampo, valorDoCampo });
};

const TelaTentativa = ({ lang, estado, params, papel }) => {
  const traduzir = useT(lang);
  const { navigate } = useRouter();
  const parametrosDoPainel = { ...PAINEL_DO_EXCURFLY, ...params };
  const { produto: idDoProduto, ambiente: idDoAmbiente, campo: nomeDoCampo } = parametrosDoPainel;
  const valorDoCampo = decodificarValor(parametrosDoPainel.valor || '');
  const nomeDoProduto = (PRODUTOS.find((produto) => produto.id === idDoProduto) || PRODUTOS[0]).nome;
  const nomeDoAmbiente = (AMBIENTES.find((ambiente) => ambiente.id === idDoAmbiente) || AMBIENTES[0]).nome;
  const { parametrosDoEvento } = ORIGEM_DA_TENTATIVA;
  const veioDeUmEvento = Boolean(parametrosDoEvento)
    && parametrosDoEvento.produto === idDoProduto && parametrosDoEvento.ambiente === idDoAmbiente
    && ORIGEM_DA_TENTATIVA.nomeDoCampo === nomeDoCampo && ORIGEM_DA_TENTATIVA.valorDoCampo === valorDoCampo;

  const voltar = () => {
    if (veioDeUmEvento) { navigate(ROTAS_DO_PAPEL[papel].evento, parametrosDoEvento); return; }
    const buscaDaTentativa = codificarBusca({ ...decodificarBusca(BUSCA_DE_ABERTURA), filtros: [{ campo: nomeDoCampo, operador: 'e', valores: [valorDoCampo] }] });
    navigate(ROTAS_DO_PAPEL[papel].busca, { produto: idDoProduto, ambiente: idDoAmbiente, busca: buscaDaTentativa });
  };

  /* Trocar o papel mantém a tentativa; trocar produto ou ambiente volta à abertura do painel. */
  const mudarOPainel = (destino) => {
    if (destino.papel) { navigate(ROTAS_DO_PAPEL[destino.papel].tentativa, { ...parametrosDoPainel }); return; }
    navigate(ROTAS_DO_PAPEL[papel].abertura, { produto: destino.produto || idDoProduto, ambiente: destino.ambiente || idDoAmbiente });
  };

  return (
    <CascaDoPainel traduzir={traduzir} estado={estado} params={parametrosDoPainel} papel={papel} aoMudar={mudarOPainel} itemAtual="tentativas">
      {estado === 'offline' && (
        <AvisoSemInternet
          titulo={traduzir('semInternetTitulo')}
          continuaFuncionando={traduzir('tentativaSemInternetContinua')}
          espera={traduzir('tentativaSemInternetEspera')}
        />
      )}
      <Card style={{ maxWidth: LARGURA_DO_MIOLO_PROVISORIO, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--muted)' }}>
          <IconBranch size={18} />
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>
            {traduzir('tentativaSubtitulo', { campo: nomeDoCampo, produto: nomeDoProduto, ambiente: nomeDoAmbiente })}
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>
          {traduzir('tentativaTitulo', { valor: valorDoCampo })}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>{traduzir('tentativaProvisoria')}</p>
        <Button variant="secondary" disabled={estado === 'disabled'} onClick={voltar}>
          {traduzir(veioDeUmEvento ? 'tentativaVoltarParaOEvento' : 'tentativaVerEventos', { valor: valorDoCampo })}
        </Button>
      </Card>
    </CascaDoPainel>
  );
};

const TelaTentativaInvestigador = (propriedades) => <TelaTentativa {...propriedades} papel="investigador" />;
const TelaTentativaAdministrador = (propriedades) => <TelaTentativa {...propriedades} papel="administrador" />;
