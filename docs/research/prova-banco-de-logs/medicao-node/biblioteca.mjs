// Biblioteca sintética da prova: segue o ADR 0001 só o bastante para medir custo e garantias.
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

const comprimir = promisify(gzip);
const LIMITE_EVENTOS_FILA = 2048;
const LIMITE_BYTES_FILA = 16 * 1024 * 1024;
const LIMITE_EVENTOS_LOTE = 1000;
const LIMITE_BYTES_LOTE = 5 * 1024 * 1024;
const LIMITE_BYTES_EVENTO = 1024 * 1024;
const PRAZO_TENTATIVAS_MS = 5 * 60 * 1000;
const CAMPOS_REMOVIDOS = new Set(['senha', 'authorization', 'cartao']);
const NOMES_NIVEL = { 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' };

function mascararTelefone(telefone) {
  return `(**) *****-${String(telefone).slice(-4)}`;
}

function limparCampos(registro) {
  const limpo = {};
  for (const [nomeCampo, valorCampo] of Object.entries(registro)) {
    if (CAMPOS_REMOVIDOS.has(nomeCampo)) continue;
    const ehObjeto = valorCampo !== null && typeof valorCampo === 'object' && !Array.isArray(valorCampo);
    limpo[nomeCampo] = ehObjeto ? limparCampos(valorCampo) : valorCampo;
  }
  return limpo;
}

export function criarMonitora({ endereco, chaveCodigos, produto, aplicacao, execucao, rotasExcluidas = ['/health'], intervaloSituacaoMs = 30_000 }) {
  const contexto = new AsyncLocalStorage();
  const enderecoEnvio = new URL('/v1/eventos', endereco);
  const agenteHttp = new http.Agent({ keepAlive: true, maxSockets: 1 });
  const etapasNs = { captura: 0n, mascara: 0n, codigo: 0n, json: 0n, gzip: 0n };
  const perdas = { fila_cheia: 0, tentativas_esgotadas: 0 };
  const contadores = { capturados: 0, enviados: 0, bytesJson: 0, bytesGzip: 0, maiorFilaEventos: 0, maiorFilaBytes: 0 };
  let fila = [];
  let bytesFila = 0;
  let loteEmVoo = null;
  let proximoNumero = 0;

  function somarEtapa(nomeEtapa, inicioNs) {
    const agoraNs = process.hrtime.bigint();
    etapasNs[nomeEtapa] += agoraNs - inicioNs;
    return agoraNs;
  }

  function descartarPorFilaCheia(novoEhErro) {
    const posicaoDescartavel = fila.findIndex((itemFila) => !itemFila.ehErro);
    if (posicaoDescartavel >= 0) {
      const [descartado] = fila.splice(posicaoDescartavel, 1);
      bytesFila -= descartado.tamanho;
      perdas.fila_cheia += 1;
      return true;
    }
    if (novoEhErro && fila.length > 0) {
      bytesFila -= fila.shift().tamanho;
      perdas.fila_cheia += 1;
      return true;
    }
    return false;
  }

  function enfileirar(texto, tamanho, ehErro) {
    while (fila.length >= LIMITE_EVENTOS_FILA || bytesFila + tamanho > LIMITE_BYTES_FILA) {
      if (!descartarPorFilaCheia(ehErro)) {
        perdas.fila_cheia += 1;
        return;
      }
    }
    fila.push({ texto, tamanho, ehErro });
    bytesFila += tamanho;
    contadores.maiorFilaEventos = Math.max(contadores.maiorFilaEventos, fila.length);
    contadores.maiorFilaBytes = Math.max(contadores.maiorFilaBytes, bytesFila);
  }

  function processarLinha(linha) {
    let instanteNs = process.hrtime.bigint();
    const registro = JSON.parse(linha);
    const urlRegistro = registro.req?.url ?? registro.url ?? '';
    if (registro.level < 30 || rotasExcluidas.some((rota) => urlRegistro.startsWith(rota))) return;
    contadores.capturados += 1;
    instanteNs = somarEtapa('captura', instanteNs);

    const limpo = limparCampos(registro);
    const telefoneOriginal = limpo.telefone;
    if (telefoneOriginal !== undefined) limpo.telefone = mascararTelefone(telefoneOriginal);
    instanteNs = somarEtapa('mascara', instanteNs);

    const campos = {};
    if (telefoneOriginal !== undefined) {
      const digitos = String(telefoneOriginal).replace(/\D/g, '');
      campos.telefoneCodigo = createHmac('sha256', chaveCodigos).update(digitos).digest('hex').slice(0, 24);
      campos.telefoneMascarado = limpo.telefone;
    }
    if (limpo.compraId !== undefined) campos.compraId = String(limpo.compraId);
    instanteNs = somarEtapa('codigo', instanteNs);

    const nivel = NOMES_NIVEL[registro.level] ?? 'info';
    const seq = proximoNumero;
    proximoNumero += 1;
    let corpo = JSON.stringify(limpo);
    if (corpo.length > LIMITE_BYTES_EVENTO) corpo = corpo.slice(0, LIMITE_BYTES_EVENTO);
    const texto = JSON.stringify({
      id: `${aplicacao}-${execucao}-${seq}`,
      ts_ms: registro.time ?? Date.now(),
      produto,
      ambiente: 'prova',
      aplicacao,
      execucao,
      seq,
      nivel,
      familia: limpo.familia ?? 'requisicao',
      ocorrencia: limpo.ocorrencia ?? '',
      nome: limpo.msg ?? '',
      rota: limpo.req?.url ?? '',
      url: urlRegistro,
      status: String(limpo.res?.statusCode ?? 'ok'),
      valor_centavos: null,
      assentos: [],
      palavras: limpo.msg ?? '',
      corpo,
      campos,
    });
    const tamanho = Buffer.byteLength(texto);
    somarEtapa('json', instanteNs);
    enfileirar(texto, tamanho, nivel === 'error' || nivel === 'fatal');
  }

  function postar(corpoGzip) {
    return new Promise((aoResolver) => {
      const pedido = http.request(enderecoEnvio, {
        method: 'POST',
        agent: agenteHttp,
        headers: { 'content-type': 'application/json', 'content-encoding': 'gzip', 'content-length': corpoGzip.length },
      }, (resposta) => {
        resposta.resume();
        resposta.on('end', () => aoResolver({
          confirmado: resposta.statusCode >= 200 && resposta.statusCode < 300,
          esperaMs: Number(resposta.headers['retry-after'] ?? 1) * 1000,
        }));
      });
      pedido.on('error', () => aoResolver({ confirmado: false, esperaMs: 1000 }));
      pedido.setTimeout(10_000, () => pedido.destroy(new Error('tempo esgotado')));
      pedido.end(corpoGzip);
    });
  }

  function separarLote() {
    const itens = [];
    let bytesLote = 0;
    while (fila.length > 0 && itens.length < LIMITE_EVENTOS_LOTE && bytesLote + fila[0].tamanho <= LIMITE_BYTES_LOTE) {
      const item = fila.shift();
      itens.push(item);
      bytesLote += item.tamanho;
      bytesFila -= item.tamanho;
    }
    return itens;
  }

  async function enviarPendentes() {
    if (loteEmVoo || fila.length === 0) return;
    const itens = separarLote();
    if (itens.length === 0) return;
    const inicioTentativasMs = Date.now();
    loteEmVoo = itens;
    const corpoJson = `{"eventos":[${itens.map((itemLote) => itemLote.texto).join(',')}]}`;
    const inicioGzipNs = process.hrtime.bigint();
    const corpoGzip = await comprimir(corpoJson);
    somarEtapa('gzip', inicioGzipNs);
    while (loteEmVoo) {
      const { confirmado, esperaMs } = await postar(corpoGzip);
      if (confirmado) {
        contadores.enviados += itens.length;
        contadores.bytesJson += Buffer.byteLength(corpoJson);
        contadores.bytesGzip += corpoGzip.length;
        loteEmVoo = null;
      } else if (Date.now() - inicioTentativasMs >= PRAZO_TENTATIVAS_MS) {
        perdas.tentativas_esgotadas += itens.length;
        loteEmVoo = null;
      } else {
        await new Promise((aoAcordar) => setTimeout(aoAcordar, esperaMs));
      }
    }
    if (fila.length >= LIMITE_EVENTOS_LOTE) setImmediate(enviarPendentes);
  }

  function enviarSituacao(momento) {
    const corpo = Buffer.from(JSON.stringify({ aplicacao, execucao, momento, ultimoNumero: proximoNumero - 1, perdas }));
    return new Promise((aoResolver) => {
      const pedido = http.request(new URL('/v1/situacao', endereco), {
        method: 'POST',
        agent: agenteHttp,
        headers: { 'content-type': 'application/json', 'content-length': corpo.length },
      }, (resposta) => {
        resposta.resume();
        resposta.on('end', aoResolver);
      });
      pedido.on('error', aoResolver);
      pedido.setTimeout(2000, () => pedido.destroy(new Error('tempo esgotado')));
      pedido.end(corpo);
    });
  }

  async function descarregar() {
    while (fila.length > 0 && !loteEmVoo) await enviarPendentes();
  }

  const relogioEnvio = setInterval(enviarPendentes, 1000);
  relogioEnvio.unref();
  const relogioSituacao = setInterval(() => enviarSituacao('periodica'), intervaloSituacaoMs);
  relogioSituacao.unref();
  enviarSituacao('inicio');

  return {
    destino: { write: processarLinha },
    descarregar,
    encerrar: async () => {
      await descarregar();
      await enviarSituacao('encerramento');
    },
    mixin: () => {
      const ocorrenciaAtual = contexto.getStore();
      return ocorrenciaAtual ? { ocorrencia: ocorrenciaAtual.ocorrencia, familia: ocorrenciaAtual.familia } : {};
    },
    executar: (familia, ocorrencia, tarefa) => contexto.run({ familia, ocorrencia }, tarefa),
    zerarEtapas: () => {
      for (const nomeEtapa of Object.keys(etapasNs)) etapasNs[nomeEtapa] = 0n;
    },
    medidas: () => ({
      etapasMs: Object.fromEntries(Object.entries(etapasNs).map(([nomeEtapa, duracaoNs]) => [nomeEtapa, Number(duracaoNs) / 1e6])),
      perdas: { ...perdas },
      ...contadores,
      filaAtual: fila.length + (loteEmVoo?.length ?? 0),
    }),
  };
}
