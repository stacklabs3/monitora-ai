// A dica "sem filtro ⓘ" (e toda dica de ComDica) cabe na área visível? Foco real por Tab e por mouse, no topo da rolagem.
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const { avaliar, abrir, tecla, foto, moverMouse, fechar } = await abrirNavegador({ porta: 9367 });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const I = '#/painel/excurfly/producao/investigador';
const PAGINAS = [
  ['evento na busca, seção atributos', `${I}/eventos/p=1h;f=reservationId:e:R-1042/evento/ev-1042-06/atributos`],
  ['evento na busca, topo', `${I}/eventos/p=1h;f=reservationId:e:R-1042/evento/ev-1042-06`],
  ['evento do webhook na linha do tempo', `${I}/tentativas/reservationId/R-1042/evento/ev-1042-05`],
  ['evento cortado', `${I}/eventos/p=24h;f=reservationId:e:R-1040/evento/ev-1040-01`],
];
const medir = `(() => {
  const dica = [...document.querySelectorAll('[role=tooltip]')].find((el) => getComputedStyle(el).display !== 'none');
  if (!dica) return null;
  const caixa = dica.getBoundingClientRect();
  let cortadaPor = '';
  for (let moldura = dica.parentElement; moldura; moldura = moldura.parentElement) {
    const estilo = getComputedStyle(moldura);
    if (!/(auto|scroll|hidden|clip)/.test(estilo.overflowX + estilo.overflowY)) continue;
    const limite = moldura.getBoundingClientRect();
    if (caixa.top < limite.top - 0.5 || caixa.left < limite.left - 0.5 || caixa.right > limite.right + 0.5 || caixa.bottom > limite.bottom + 0.5) { cortadaPor = moldura.tagName.toLowerCase() + '.' + String(moldura.className).split(' ')[0] + ' (dica ' + Math.round(caixa.left) + ',' + Math.round(caixa.top) + '–' + Math.round(caixa.right) + ',' + Math.round(caixa.bottom) + ' · moldura ' + Math.round(limite.left) + ',' + Math.round(limite.top) + '–' + Math.round(limite.right) + ',' + Math.round(limite.bottom) + ')'; break; }
  }
  const foraDaJanela = caixa.top < 0 || caixa.left < 0 || caixa.right > innerWidth || caixa.bottom > innerHeight;
  // Está por cima de tudo? Os quatro cantos (um pouco para dentro) precisam bater na própria dica.
  const cantos = [[caixa.left + 4, caixa.top + 4], [caixa.right - 4, caixa.top + 4], [caixa.left + 4, caixa.bottom - 4], [caixa.right - 4, caixa.bottom - 4]];
  const encoberta = cantos.filter(([x, y]) => { const topo = document.elementFromPoint(x, y); return !topo || !dica.contains(topo); }).length;
  return { texto: dica.textContent.slice(0, 50), cortadaPor, foraDaJanela, encoberta };
})()`;
let falhas = 0; let conferidas = 0;
for (const tema of ['light', 'dark']) {
  for (const [nome, rota] of PAGINAS) {
    await abrir(`/?visao=painel&superficie=desktop&tema=${tema}&print=1&idioma=pt-BR${rota}`);
    const quantas = await avaliar('document.querySelectorAll("[role=note]").length');
    // Com o teclado: Tab até cada nota (o navegador rola sozinho para mostrar o foco).
    let vistas = 0; let problemasDaPagina = 0;
    for (let vez = 0; vez < 120 && vistas < quantas; vez++) {
      await tecla('Tab');
      if (!(await avaliar('document.activeElement.getAttribute("role") === "note"'))) continue;
      vistas++; conferidas++;
      const medida = await avaliar(medir);
      const ruim = !medida || medida.cortadaPor || medida.foraDaJanela || medida.encoberta;
      if (ruim) { problemasDaPagina++; falhas++; dizer(`FAIL [${tema}] ${nome} · dica ${vistas} por Tab: ${medida ? `«${medida.texto}» cortada por ${medida.cortadaPor || '-'} · fora da janela ${medida.foraDaJanela} · cantos encobertos ${medida.encoberta}` : 'a dica não apareceu'}`); if (problemasDaPagina === 1) await foto(`${rodada}-dica-cortada-${tema}-${PAGINAS.findIndex(([nomeDaPagina]) => nomeDaPagina === nome)}`); }
    }
    // Pior caso: cada nota encostada no topo da área que rola (a dica abre para cima). Com mouse e com foco.
    let pelosMouse = 0;
    for (let indice = 0; indice < quantas; indice++) {
      const ponto = await avaliar(`(() => { const nota = document.querySelectorAll('[role=note]')[${indice}]; document.activeElement.blur();
        let area = nota.parentElement; while (area && !/(auto|scroll)/.test(getComputedStyle(area).overflowY)) area = area.parentElement;
        if (!area) return null;
        area.scrollTop += nota.getBoundingClientRect().top - area.getBoundingClientRect().top - 6;
        // cabeçalho grudado dentro da área: a nota fica logo abaixo dele
        const caixa = nota.getBoundingClientRect(); const topo = document.elementFromPoint(caixa.left + caixa.width / 2, caixa.top + caixa.height / 2);
        if (topo && !nota.contains(topo) && !topo.contains(nota)) { const grudado = topo.closest('[style*="sticky"]') || topo; area.scrollTop -= grudado.getBoundingClientRect().bottom - caixa.top + 6; }
        const final = nota.getBoundingClientRect(); const limite = area.getBoundingClientRect();
        return { x: final.left + final.width / 2, y: final.top + final.height / 2, distanciaDoTopo: Math.round(final.top - limite.top), rolou: area.scrollTop }; })()`);
      if (!ponto) continue;
      for (const modo of ['mouse', 'foco']) {
        if (modo === 'mouse') await moverMouse(ponto.x, ponto.y); else await avaliar(`document.querySelectorAll('[role=note]')[${indice}].focus({ preventScroll: true }); true`);
        pelosMouse++; conferidas++;
        const medida = await avaliar(medir);
        const ruim = !medida || medida.cortadaPor || medida.foraDaJanela || medida.encoberta;
        if (ruim) { falhas++; problemasDaPagina++; dizer(`FAIL [${tema}] ${nome} · dica ${indice + 1} por ${modo}, nota a ${ponto.distanciaDoTopo} px do topo da rolagem: ${medida ? `«${medida.texto}» cortada por ${medida.cortadaPor || '-'} · fora da janela ${medida.foraDaJanela} · cantos encobertos ${medida.encoberta}` : 'a dica não apareceu'}`); if (problemasDaPagina === 1) await foto(`${rodada}-dica-cortada-${tema}`); }
        await moverMouse(5, 5); await avaliar('document.activeElement.blur(); true');
      }
    }
    dizer(`${problemasDaPagina ? 'FAIL' : 'PASS'} [${tema}] ${nome}: ${quantas} dicas · ${vistas} por Tab · ${pelosMouse} no pior caso (nota no topo da rolagem, mouse e foco) · com problema ${problemasDaPagina}`);
  }
}
// Controle negativo (RP1): uma dica posta de propósito para fora da moldura precisa ser acusada.
await abrir(`/?visao=painel&superficie=desktop&tema=light&print=1&idioma=pt-BR${PAGINAS[0][1]}`);
await avaliar(`(() => { const area = document.querySelector('.rolagem-propria'); const dica = document.createElement('span'); dica.setAttribute('role', 'tooltip'); dica.textContent = 'CONTROLE dica cortada'; dica.style.cssText = 'display:block;position:absolute;top:-60px;left:0;width:200px;height:40px'; area.style.position = 'relative'; area.prepend(dica); area.scrollTop = 0; return true; })()`);
const controle = await avaliar(medir);
dizer(`CONTROLE NEGATIVO (dica 60 px acima do topo da rolagem): ${controle && controle.cortadaPor ? 'REPROVADO como devia: ' + controle.cortadaPor : 'NÃO REPROVOU'}`);
dizer(`dicas conferidas: ${conferidas} · falhas: ${falhas}`);
writeFileSync(`${PASTA}dica-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
