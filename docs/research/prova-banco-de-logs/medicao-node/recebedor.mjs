// Recebedor falso: confirma lotes, procura segredo sintético e pode fingir que está fora.
import http from 'node:http';
import { gunzipSync } from 'node:zlib';

let fora = false;
let eventosGuardados = [];
let quantidadeEventos = 0;
let quantidadeErros = 0;
let lotesComSegredo = 0;

function lerCorpo(pedido) {
  return new Promise((aoResolver, aoFalhar) => {
    const pedacos = [];
    pedido.on('data', (pedaco) => pedacos.push(pedaco));
    pedido.on('end', () => aoResolver(Buffer.concat(pedacos)));
    pedido.on('error', aoFalhar);
  });
}

const servidor = http.createServer(async (pedido, resposta) => {
  const corpo = await lerCorpo(pedido);
  const responder = (situacao, conteudo, cabecalhos = {}) => {
    resposta.writeHead(situacao, { 'content-type': 'application/json', ...cabecalhos });
    resposta.end(JSON.stringify(conteudo));
  };
  if (pedido.url === '/v1/eventos') {
    if (fora) return responder(503, { erro: 'fora' }, { 'retry-after': '1' });
    const texto = gunzipSync(corpo).toString();
    if (texto.includes('segredo-sintetico')) lotesComSegredo += 1;
    const { eventos } = JSON.parse(texto);
    quantidadeEventos += eventos.length;
    for (const evento of eventos) {
      if (evento.nivel === 'error') quantidadeErros += 1;
      if (process.env.GUARDAR_EVENTOS === '1') {
        eventosGuardados.push({ ocorrencia: evento.ocorrencia, compraId: evento.campos.compraId, url: evento.url });
      }
    }
    return responder(200, { aceitos: eventos.length, duplicados: 0 });
  }
  if (pedido.url === '/__modo') {
    fora = JSON.parse(corpo.toString()).fora;
    return responder(200, { fora });
  }
  if (pedido.url === '/__resumo') {
    return responder(200, { quantidadeEventos, quantidadeErros, lotesComSegredo, eventos: eventosGuardados });
  }
  return responder(404, {});
});

servidor.listen(Number(process.env.PORTA), '127.0.0.1', () => process.send?.('pronta'));
