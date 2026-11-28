// Os painéis suspensos (adicionar filtro, período) cabem na tela? Mede a caixa do diálogo contra a janela e a rolagem lateral.
import { writeFileSync } from 'node:fs';
import { abrirNavegador, porTexto, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const botao = (texto) => porTexto('[role="button"]', texto);
const I = '#/painel/excurfly/producao/investigador';
const CASOS = [
  ['abertura (sem filtro)', I],
  ['um filtro', `${I}/eventos/p=1h;f=reservationId:e:R-1042`],
  ['dois filtros', `${I}/eventos/p=1h;f=reservationId:e:R-1042;f=method:e:cartao`],
  ['evento aberto ao lado', `${I}/eventos/p=1h;f=reservationId:e:R-1042/evento/ev-1042-06`],
  ['achar tentativas', `${I}/tentativas`],
];
let falhas = 0;
for (const [largura, altura, modo] of [[1440, 900, 'print=1&'], [1440, 900, ''], [1280, 720, 'print=1&']]) {
  const { avaliar, abrir, clicar, fechar } = await abrirNavegador({ porta: 9365, largura, altura });
  for (const [nome, rota] of CASOS) {
    for (const rotuloDoBotao of ['Adicionar filtro', 'Período']) {
      await abrir(`/?visao=painel&superficie=desktop&tema=light&${modo}idioma=pt-BR${rota}`);
      if (!(await avaliar(`Boolean(${botao(rotuloDoBotao)})`))) continue;
      await clicar(botao(rotuloDoBotao), rotuloDoBotao);
      const medida = await avaliar(`(() => {
        const dialogo = document.querySelector('[role="dialog"]:not(.painel-corpo)'); if (!dialogo) return null;
        const caixa = dialogo.getBoundingClientRect();
        // A moldura que corta: o ancestral com rolagem ou corte mais próximo.
        let moldura = dialogo.parentElement; while (moldura && !/(auto|scroll|hidden)/.test(getComputedStyle(moldura).overflowX + getComputedStyle(moldura).overflowY)) moldura = moldura.parentElement;
        const caixaDaMoldura = (moldura || document.documentElement).getBoundingClientRect();
        const rolados = [...document.querySelectorAll('*')].filter((el) => el.scrollLeft > 0).map((el) => el.tagName.toLowerCase() + ' scrollLeft=' + el.scrollLeft);
        const transbordam = [...document.querySelectorAll('main, .showcase-body, body')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.tagName.toLowerCase() + ' ' + el.scrollWidth + '>' + el.clientWidth);
        return { esquerda: Math.round(caixa.left), direita: Math.round(caixa.right), base: Math.round(caixa.bottom), molduraEsquerda: Math.round(caixaDaMoldura.left), molduraDireita: Math.round(caixaDaMoldura.right), molduraBase: Math.round(caixaDaMoldura.bottom), rolados, transbordam };
      })()`);
      if (!medida) { dizer(`?    ${largura}x${altura} ${modo ? 'print' : 'com casca'} · ${nome} · ${rotuloDoBotao}: o painel não abriu`); continue; }
      const cabe = medida.esquerda >= medida.molduraEsquerda && medida.direita <= medida.molduraDireita && medida.rolados.length === 0 && medida.transbordam.length === 0;
      if (!cabe) falhas++;
      dizer(`${cabe ? 'PASS' : 'FAIL'} ${largura}x${altura} ${modo ? 'print' : 'com casca'} · ${nome} · ${rotuloDoBotao}: painel x ${medida.esquerda}–${medida.direita}, base ${medida.base} · moldura x ${medida.molduraEsquerda}–${medida.molduraDireita}, base ${medida.molduraBase}${medida.rolados.length ? ' · rolou de lado: ' + medida.rolados.join(', ') : ''}${medida.transbordam.length ? ' · transborda: ' + medida.transbordam.join(', ') : ''}`);
    }
  }
  fechar(); await new Promise((resolver) => setTimeout(resolver, 600));
}
dizer(`falhas: ${falhas}`);
writeFileSync(`${PASTA}paineis-${rodada}.txt`, linhas.join('\n') + '\n');
