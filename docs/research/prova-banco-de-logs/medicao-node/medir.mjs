// Mede custo e garantias da biblioteca sintética na versão de Node em que roda.
// Uso: node medir.mjs arquivo_saida.json [segundos_por_cenario] [segundos_fora]
import { fork } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [arquivoSaida, textoDuracao = '15', textoFora = '20'] = process.argv.slice(2);
const segundosPorCenario = Number(textoDuracao);
const segundosFora = Number(textoFora);
const PORTA_API = 19301;
const PORTA_RECEBEDOR = 19302;
const PEDIDOS_POR_SEGUNDO = 200;
const RODADAS_DE_CUSTO = 3;
const agenteCarga = new http.Agent({ keepAlive: true, maxSockets: 256 });
const esperar = (duracaoMs) => new Promise((aoAcordar) => setTimeout(aoAcordar, duracaoMs));

function chamar(porta, metodo, caminho, corpo) {
  return new Promise((aoResolver, aoFalhar) => {
    const pedido = http.request({ host: '127.0.0.1', port: porta, method: metodo, path: caminho, agent: agenteCarga,
      headers: corpo ? { 'content-type': 'application/json' } : {} }, (resposta) => {
      let texto = '';
      resposta.setEncoding('utf8');
      resposta.on('data', (pedaco) => { texto += pedaco; });
      resposta.on('end', () => aoResolver({ situacao: resposta.statusCode, corpo: texto ? JSON.parse(texto) : null }));
    });
    pedido.on('error', aoFalhar);
    pedido.end(corpo ? JSON.stringify(corpo) : undefined);
  });
}

function iniciarProcesso(arquivo, ambiente) {
  const processoFilho = fork(new URL(arquivo, import.meta.url).pathname, { env: { ...process.env, ...ambiente }, stdio: 'ignore' });
  return new Promise((aoResolver, aoFalhar) => {
    processoFilho.once('message', () => aoResolver(processoFilho));
    processoFilho.once('exit', (codigo) => aoFalhar(new Error(`${arquivo} saiu com ${codigo}`)));
  });
}

async function comAmbiente({ comBiblioteca, logsDeRequisicao, guardarEventos = false }, tarefa) {
  const recebedor = await iniciarProcesso('./recebedor.mjs', { PORTA: PORTA_RECEBEDOR, GUARDAR_EVENTOS: guardarEventos ? '1' : '0' });
  const api = await iniciarProcesso('./api.mjs', {
    PORTA: PORTA_API,
    COM_BIBLIOTECA: comBiblioteca ? '1' : '0',
    LOGS_REQUISICAO: logsDeRequisicao ? '1' : '0',
    RECEBEDOR: `http://127.0.0.1:${PORTA_RECEBEDOR}`,
    ARQUIVO_LOG: join(tmpdir(), `api-${process.pid}.log`),
  });
  try {
    return await tarefa();
  } finally {
    for (const processoFilho of [api, recebedor]) {
      processoFilho.removeAllListeners('exit');
      processoFilho.kill('SIGKILL');
    }
    await esperar(200);
  }
}

function percentil(valoresOrdenados, fracao) {
  if (valoresOrdenados.length === 0) return -1;
  return valoresOrdenados[Math.min(valoresOrdenados.length - 1, Math.ceil(valoresOrdenados.length * fracao) - 1)];
}

// Taxa aberta: a latência conta do horário agendado, mesmo se a API atrasar.
async function gerarCarga(pedidosPorSegundo, duracaoSegundos, primeiroId) {
  const latenciasMs = [];
  const pendentes = [];
  const inicioMs = performance.now();
  const totalPedidos = Math.round(pedidosPorSegundo * duracaoSegundos);
  for (let numeroPedido = 0; numeroPedido < totalPedidos; numeroPedido += 1) {
    const agendadoMs = inicioMs + (numeroPedido * 1000) / pedidosPorSegundo;
    const faltaMs = agendadoMs - performance.now();
    if (faltaMs > 1) await esperar(faltaMs);
    pendentes.push(chamar(PORTA_API, 'POST', `/compras/${primeiroId + numeroPedido}`)
      .then(() => latenciasMs.push(performance.now() - agendadoMs)));
  }
  await Promise.all(pendentes);
  return latenciasMs.sort((menor, maior) => menor - maior);
}

async function medirCusto(nomeCenario, configuracao) {
  return comAmbiente(configuracao, async () => {
    await gerarCarga(PEDIDOS_POR_SEGUNDO, 5, 1_000_000);
    await chamar(PORTA_API, 'POST', '/__zerar');
    const memoriaInicialMb = (await chamar(PORTA_API, 'GET', '/__medidas')).corpo.memoriaMb;
    const latenciasMs = await gerarCarga(PEDIDOS_POR_SEGUNDO, segundosPorCenario, 2_000_000);
    await esperar(1500);
    const { corpo: medidas } = await chamar(PORTA_API, 'GET', '/__medidas');
    return {
      nomeCenario,
      cpuMsPorPedido: medidas.cpuMs / medidas.pedidosAtendidos,
      p50Ms: percentil(latenciasMs, 0.5),
      p99Ms: percentil(latenciasMs, 0.99),
      memoriaMb: medidas.memoriaMb,
      crescimentoMemoriaMb: medidas.memoriaMb - memoriaInicialMb,
      bytesEmDisco: medidas.bytesEmDisco,
      biblioteca: medidas.biblioteca,
    };
  });
}

async function provarConcorrencia() {
  return comAmbiente({ comBiblioteca: true, logsDeRequisicao: true, guardarEventos: true }, async () => {
    await chamar(PORTA_API, 'GET', '/health');
    const identificadores = Array.from({ length: 200 }, (_, posicao) => 5000 + posicao);
    await Promise.all(identificadores.map((compraId) => chamar(PORTA_API, 'POST', `/compras/${compraId}`)));
    await esperar(2500);
    const { corpo: resumo } = await chamar(PORTA_RECEBEDOR, 'GET', '/__resumo');
    const eventosDeCompra = resumo.eventos.filter((evento) => evento.compraId !== undefined);
    return {
      eventosDeCompra: eventosDeCompra.length,
      esperados: identificadores.length * 3,
      ocorrenciasTrocadas: eventosDeCompra.filter((evento) => evento.ocorrencia !== `oc-${evento.compraId}`).length,
      lotesComSegredo: resumo.lotesComSegredo,
      eventosDeHealth: resumo.eventos.filter((evento) => evento.url.startsWith('/health')).length,
    };
  });
}

async function provarFila(pedidosPorSegundo) {
  return comAmbiente({ comBiblioteca: true, logsDeRequisicao: false }, async () => {
    const memoriaInicialMb = (await chamar(PORTA_API, 'GET', '/__medidas')).corpo.memoriaMb;
    await chamar(PORTA_RECEBEDOR, 'POST', '/__modo', { fora: true });
    await gerarCarga(pedidosPorSegundo, segundosFora, 3_000_000);
    const memoriaNaQuedaMb = (await chamar(PORTA_API, 'GET', '/__medidas')).corpo.memoriaMb;
    await chamar(PORTA_RECEBEDOR, 'POST', '/__modo', { fora: false });
    let medidas;
    for (let tentativa = 0; tentativa < 120; tentativa += 1) {
      await esperar(500);
      ({ corpo: medidas } = await chamar(PORTA_API, 'GET', '/__medidas'));
      if (medidas.biblioteca.filaAtual === 0) break;
    }
    const { corpo: resumo } = await chamar(PORTA_RECEBEDOR, 'GET', '/__resumo');
    const { biblioteca } = medidas;
    const totalPerdas = biblioteca.perdas.fila_cheia + biblioteca.perdas.tentativas_esgotadas;
    return {
      pedidosPorSegundo,
      capturados: biblioteca.capturados,
      recebidos: resumo.quantidadeEventos,
      perdasContadas: totalPerdas,
      contaFecha: biblioteca.capturados === resumo.quantidadeEventos + totalPerdas,
      errosGerados: medidas.errosGerados,
      errosRecebidos: resumo.quantidadeErros,
      maiorFilaEventos: biblioteca.maiorFilaEventos,
      maiorFilaMb: biblioteca.maiorFilaBytes / 1024 / 1024,
      crescimentoMemoriaMb: memoriaNaQuedaMb - memoriaInicialMb,
    };
  });
}

function mediana(valores) {
  return percentil([...valores].sort((menor, maior) => menor - maior), 0.5);
}

// Cada rodada começa num cenário diferente, para o ruído da máquina não favorecer nenhum.
async function medirCustosRepetidos(cenarios) {
  const rodadasPorCenario = new Map(cenarios.map(({ nomeCenario }) => [nomeCenario, []]));
  for (let numeroRodada = 0; numeroRodada < RODADAS_DE_CUSTO; numeroRodada += 1) {
    for (let deslocamento = 0; deslocamento < cenarios.length; deslocamento += 1) {
      const { nomeCenario, configuracao } = cenarios[(numeroRodada + deslocamento) % cenarios.length];
      rodadasPorCenario.get(nomeCenario).push(await medirCusto(nomeCenario, configuracao));
    }
  }
  return cenarios.map(({ nomeCenario }) => {
    const rodadas = rodadasPorCenario.get(nomeCenario);
    const medianaDe = (nomeMedida) => mediana(rodadas.map((rodada) => rodada[nomeMedida]));
    const cpuPorRodada = rodadas.map((rodada) => rodada.cpuMsPorPedido);
    return {
      nomeCenario,
      cpuMsPorPedido: medianaDe('cpuMsPorPedido'),
      menorCpuMsPorPedido: Math.min(...cpuPorRodada),
      maiorCpuMsPorPedido: Math.max(...cpuPorRodada),
      p50Ms: medianaDe('p50Ms'),
      p99Ms: medianaDe('p99Ms'),
      memoriaMb: medianaDe('memoriaMb'),
      bytesEmDisco: medianaDe('bytesEmDisco'),
      biblioteca: rodadas.at(-1).biblioteca,
    };
  });
}

const [custoSemBiblioteca, custoComBiblioteca, custoSemLogsBase, custoSemLogs] = await medirCustosRepetidos([
  { nomeCenario: 'sem biblioteca, com logs de requisição', configuracao: { comBiblioteca: false, logsDeRequisicao: true } },
  { nomeCenario: 'com biblioteca, com logs de requisição', configuracao: { comBiblioteca: true, logsDeRequisicao: true } },
  { nomeCenario: 'sem biblioteca, sem logs de requisição', configuracao: { comBiblioteca: false, logsDeRequisicao: false } },
  { nomeCenario: 'com biblioteca, sem logs de requisição', configuracao: { comBiblioteca: true, logsDeRequisicao: false } },
]);
const concorrencia = await provarConcorrencia();
const filas = [];
for (const ritmo of [20, 120, 500]) filas.push(await provarFila(ritmo));

const acrescimoCpuPct = 100 * (custoComBiblioteca.cpuMsPorPedido / custoSemBiblioteca.cpuMsPorPedido - 1);
const acrescimoP99Ms = custoComBiblioteca.p99Ms - custoSemBiblioteca.p99Ms;
const acrescimoMemoriaMb = custoComBiblioteca.memoriaMb - custoSemBiblioteca.memoriaMb;
const falhas = [];
if (concorrencia.eventosDeCompra !== concorrencia.esperados) falhas.push('faltaram eventos das 200 compras');
if (concorrencia.ocorrenciasTrocadas > 0) falhas.push('ocorrência trocada');
if (concorrencia.lotesComSegredo > 0) falhas.push('segredo sintético enviado');
if (concorrencia.eventosDeHealth > 0) falhas.push('/health enviado');
for (const fila of filas) {
  if (!fila.contaFecha) falhas.push(`perda sem contagem a ${fila.pedidosPorSegundo}/s`);
  if (fila.errosRecebidos !== fila.errosGerados) falhas.push(`erros perdidos a ${fila.pedidosPorSegundo}/s`);
  if (fila.maiorFilaEventos > 2048 || fila.maiorFilaMb > 16) falhas.push(`fila passou do limite a ${fila.pedidosPorSegundo}/s`);
}
if (filas.at(-1).perdasContadas === 0) falhas.push('o ritmo alto não encheu a fila: ensaio sem efeito');

const resultado = {
  versaoNode: process.version,
  pedidosPorSegundo: PEDIDOS_POR_SEGUNDO,
  custos: [custoSemBiblioteca, custoComBiblioteca, custoSemLogsBase, custoSemLogs],
  metas: { acrescimoCpuPct, acrescimoP99Ms, acrescimoMemoriaMb },
  concorrencia,
  filas,
  falhas,
};
writeFileSync(arquivoSaida, JSON.stringify(resultado, null, 2));
console.log(JSON.stringify({ versaoNode: process.version, metas: resultado.metas, concorrencia, filas: filas.map(({ pedidosPorSegundo, perdasContadas, errosRecebidos, errosGerados, maiorFilaEventos, crescimentoMemoriaMb }) => ({ pedidosPorSegundo, perdasContadas, errosRecebidos, errosGerados, maiorFilaEventos, crescimentoMemoriaMb: Math.round(crescimentoMemoriaMb) })), falhas }));
process.exit(falhas.length > 0 ? 1 : 0);
