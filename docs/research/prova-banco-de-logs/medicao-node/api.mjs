// API sintética em Fastify e pino, com ou sem a biblioteca.
import { createWriteStream } from 'node:fs';
import Fastify from 'fastify';
import pino from 'pino';
import { criarMonitora } from './biblioteca.mjs';

const comBiblioteca = process.env.COM_BIBLIOTECA === '1';
const logsDeRequisicao = process.env.LOGS_REQUISICAO === '1';
const porta = Number(process.env.PORTA);

const monitora = comBiblioteca
  ? criarMonitora({
      endereco: process.env.RECEBEDOR,
      chaveCodigos: 'chave-sintetica-da-prova',
      produto: 'excurfly',
      aplicacao: 'api-sintetica',
      execucao: `execucao-${process.pid}`,
    })
  : null;

let bytesEmDisco = 0;
const arquivoLog = createWriteStream(process.env.ARQUIVO_LOG);
const saidaArquivo = {
  write(linha) {
    bytesEmDisco += Buffer.byteLength(linha);
    arquivoLog.write(linha);
  },
};
const destinos = [{ level: 'info', stream: saidaArquivo }];
if (monitora) destinos.push({ level: 'info', stream: monitora.destino });

const registrador = pino({ level: 'info', mixin: monitora?.mixin }, pino.multistream(destinos));
const aplicacaoWeb = Fastify({ loggerInstance: registrador, disableRequestLogging: !logsDeRequisicao });
const executarOcorrencia = monitora?.executar ?? ((_familia, _ocorrencia, tarefa) => tarefa());
const esperar = (duracaoMs) => new Promise((aoAcordar) => setTimeout(aoAcordar, duracaoMs));

let errosGerados = 0;
let inicioCpu = process.cpuUsage();
let pedidosAtendidos = 0;

aplicacaoWeb.get('/health', { logLevel: 'silent' }, async () => ({ ok: true }));

aplicacaoWeb.post('/compras/:compraId', async (pedido) => {
  const compraId = Number(pedido.params.compraId);
  const ocorrencia = `oc-${compraId}`;
  return executarOcorrencia('transacao-financeira', ocorrencia, async () => {
    const dadosPessoais = compraId % 5 === 0
      ? { telefone: `(11) 90000-${String(compraId % 10000).padStart(4, '0')}`, senha: 'segredo-sintetico-senha', authorization: 'segredo-sintetico-token' }
      : {};
    pedido.log.info({ compraId, ...dadosPessoais }, 'compra iniciada');
    await esperar(1 + (compraId % 3));
    pedido.log.info({ compraId, assentos: [compraId % 46] }, 'assento reservado');
    await esperar(1);
    if (compraId % 20 === 0) {
      errosGerados += 1;
      pedido.log.error({ compraId }, 'pagamento recusado');
    } else {
      pedido.log.info({ compraId }, 'pagamento aprovado');
    }
    pedidosAtendidos += 1;
    return { ok: true, ocorrencia };
  });
});

aplicacaoWeb.post('/__zerar', { logLevel: 'silent' }, async () => {
  inicioCpu = process.cpuUsage();
  pedidosAtendidos = 0;
  monitora?.zerarEtapas();
  return { ok: true };
});

aplicacaoWeb.get('/__medidas', { logLevel: 'silent' }, async () => {
  const cpuGasta = process.cpuUsage(inicioCpu);
  return {
    versaoNode: process.version,
    cpuMs: (cpuGasta.user + cpuGasta.system) / 1000,
    pedidosAtendidos,
    errosGerados,
    bytesEmDisco,
    memoriaMb: process.memoryUsage().rss / 1024 / 1024,
    biblioteca: monitora?.medidas() ?? null,
  };
});

await aplicacaoWeb.listen({ port: porta, host: '127.0.0.1' });
process.send?.('pronta');
