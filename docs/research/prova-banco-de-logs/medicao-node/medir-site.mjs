// Simula publicações do site: sobe, recebe compras, recebe SIGTERM e sobe de novo.
// Só informa (#9): conta avisos "pode ter perdido mais" e eventos que faltaram.
// Uso: node medir-site.mjs arquivo_saida.json [publicacoes] [sinal]
// Com SIGKILL, é o controle negativo: nenhuma execução consegue avisar o encerramento.
import { fork, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [arquivoSaida, textoPublicacoes = '20', sinalEncerramento = 'SIGTERM'] = process.argv.slice(2);
const totalPublicacoes = Number(textoPublicacoes);
const PORTA_SITE = 19311;
const PORTA_RECEBEDOR = 19312;
const COMPRAS_POR_PUBLICACAO = 40;
const EVENTOS_POR_COMPRA = 2;
const esperar = (duracaoMs) => new Promise((aoAcordar) => setTimeout(aoAcordar, duracaoMs));
const pastaSite = new URL('./site-next/', import.meta.url).pathname;

const recebedor = fork(new URL('./recebedor.mjs', import.meta.url).pathname, {
  env: { ...process.env, PORTA: PORTA_RECEBEDOR },
  stdio: 'ignore',
});
await new Promise((aoResolver) => recebedor.once('message', aoResolver));

async function esperarSite() {
  for (let tentativa = 0; tentativa < 200; tentativa += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORTA_SITE}/`)).ok) return;
    } catch {
      await esperar(100);
    }
  }
  throw new Error('site não subiu');
}

let comprasConfirmadas = 0;
for (let numeroPublicacao = 0; numeroPublicacao < totalPublicacoes; numeroPublicacao += 1) {
  const site = spawn('node_modules/.bin/next', ['start', '-p', String(PORTA_SITE), '-H', '127.0.0.1'], {
    cwd: pastaSite,
    env: { ...process.env, RECEBEDOR: `http://127.0.0.1:${PORTA_RECEBEDOR}`, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: 'ignore',
    detached: true,
  });
  const saidaDoSite = new Promise((aoResolver) => site.once('exit', aoResolver));
  await esperarSite();
  const compras = Array.from({ length: COMPRAS_POR_PUBLICACAO }, async (_, posicao) => {
    await esperar(posicao * 25);
    const resposta = await fetch(`http://127.0.0.1:${PORTA_SITE}/api/compra?compraId=${numeroPublicacao}-${posicao}`, { method: 'POST' });
    if (resposta.ok) comprasConfirmadas += 1;
  });
  await Promise.all(compras);
  // O comando `next start` pode delegar a outro processo; o grupo inteiro recebe o sinal.
  process.kill(-site.pid, sinalEncerramento);
  await saidaDoSite;
}

await esperar(2000);
const resumo = await (await fetch(`http://127.0.0.1:${PORTA_RECEBEDOR}/__resumo`)).json();
recebedor.kill('SIGKILL');
const execucoes = Object.values(resumo.execucoes);
const eventosEsperados = comprasConfirmadas * EVENTOS_POR_COMPRA;
const resultado = {
  versaoNode: process.version,
  publicacoes: totalPublicacoes,
  execucoesVistas: execucoes.length,
  avisosPodeTerPerdidoMais: execucoes.filter((execucao) => !execucao.encerrou).length,
  eventosEsperados,
  eventosRecebidos: resumo.quantidadeEventos,
  eventosQueFaltaram: eventosEsperados - resumo.quantidadeEventos,
  lotesComSegredo: resumo.lotesComSegredo,
};
writeFileSync(arquivoSaida, JSON.stringify(resultado, null, 2));
console.log(JSON.stringify(resultado));
process.exit(resultado.execucoesVistas === totalPublicacoes ? 0 : 1);
