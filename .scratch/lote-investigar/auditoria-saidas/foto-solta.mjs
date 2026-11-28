// Fotos das correções: dica abrindo para baixo e linha sem internet com o mouse em cima.
import { abrirNavegador } from './lib.mjs';
const { avaliar, abrir, moverMouse, foto, fechar } = await abrirNavegador({ porta: 9372 });
const I = '#/painel/excurfly/producao/investigador';
for (const tema of ['light', 'dark']) {
  await abrir(`/?visao=painel&superficie=desktop&tema=${tema}&print=1&idioma=pt-BR${I}/eventos/p=1h;f=reservationId:e:R-1042/evento/ev-1042-06/atributos`);
  const ponto = await avaliar(`(() => { const nota = document.querySelectorAll('[role=note]')[0]; let area = nota.parentElement; while (area && !/(auto|scroll)/.test(getComputedStyle(area).overflowY)) area = area.parentElement; area.scrollTop += nota.getBoundingClientRect().top - area.getBoundingClientRect().top - 6; const caixa = nota.getBoundingClientRect(); return { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 }; })()`);
  await moverMouse(ponto.x, ponto.y); await foto(`rodada2-dica-para-baixo-${tema}`);
  await abrir(`/?visao=painel&superficie=desktop&tema=${tema}&estado=offline&print=1&idioma=pt-BR${I}/eventos/p=1h;f=reservationId:e:R-1042`);
  const linha = await avaliar(`(() => { const alvo = document.querySelectorAll('.linha-de-evento')[2]; const caixa = alvo.getBoundingClientRect(); return { x: caixa.left + 300, y: caixa.top + caixa.height / 2, declarada: alvo.getAttribute('aria-disabled'), titulo: alvo.title, cursor: getComputedStyle(alvo).cursor }; })()`);
  await moverMouse(linha.x, linha.y);
  console.log(tema, JSON.stringify(linha), await avaliar(`getComputedStyle(document.querySelectorAll('.linha-de-evento')[2]).backgroundColor`));
  await foto(`rodada2-linha-sem-internet-${tema}`);
}
fechar();
