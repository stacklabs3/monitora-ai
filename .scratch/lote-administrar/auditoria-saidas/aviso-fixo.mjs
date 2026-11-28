// O aviso fixo do sem internet cobre conteúdo? (1) a parte para onde a tela rola; (2) o foco do teclado ao voltar com Shift+Tab.
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const INVESTIGADOR = '#/painel/excurfly/producao/investigador';
const ADMINISTRADOR = '#/painel/excurfly/producao/administrador';
let falhas = 0;
const medirAviso = `(() => { const aviso = [...document.querySelectorAll('[role=status]')].find((el) => el.textContent.includes('Sem internet')); return aviso ? aviso.getBoundingClientRect().toJSON() : null; })()`;
for (const altura of [900, 600, 440]) {
  const { avaliar, abrir, tecla, foto, fechar } = await abrirNavegador({ porta: 9476, altura });
  // (1) a rota já rolada até a parte de baixo
  for (const [nome, rota, seletorDoTitulo] of [
  ]) {
    for (const estado of ['default', 'offline']) {
      await abrir(`/?visao=painel&superficie=desktop&tema=light&estado=${estado}&print=1&idioma=pt-BR${rota}`);
      const medida = await avaliar(`(() => { const parte = document.querySelector(${JSON.stringify(seletorDoTitulo)}); const aviso = ${medirAviso}; const caixa = parte.getBoundingClientRect(); let area = parte.parentElement; while (area && !/(auto|scroll)/.test(getComputedStyle(area).overflowY)) area = area.parentElement; return { topoDaParte: Math.round(caixa.top), baseDoAviso: aviso ? Math.round(aviso.bottom) : null, topoDoAviso: aviso ? Math.round(aviso.top) : null, rolagem: Math.round(area.scrollTop), maximo: Math.round(area.scrollHeight - area.clientHeight), topoDaArea: Math.round(area.getBoundingClientRect().top) }; })()`);
      const coberta = medida.baseDoAviso !== null && medida.topoDaParte < medida.baseDoAviso - 1;
      if (coberta) { falhas++; await foto(`${rodada}-aviso-fixo-cobre-${altura}`); }
      dizer(`${coberta ? 'FAIL' : 'PASS'} janela ${altura} · ${nome} · ${estado}: topo da parte ${medida.topoDaParte} · aviso ${medida.topoDoAviso}–${medida.baseDoAviso} · rolagem ${medida.rolagem}/${medida.maximo} · área começa em ${medida.topoDaArea}`);
    }
  }
  // (2) o foco ao voltar com Shift+Tab numa lista longa, sem internet
  for (const [nome, rota, estadoDaCena] of [['CONTROLE NEGATIVO: aviso plantado de 420 px por cima das aplicações', `${ADMINISTRADOR}/aplicacoes`, 'default'], ['aplicações', `${ADMINISTRADOR}/aplicacoes`, 'offline'], ['aplicações com a chave guardada', `${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a`, 'offline'], ['catálogo de campos', `${ADMINISTRADOR}/catalogo`, 'offline'], ['catálogo do Investigador', `${INVESTIGADOR}/catalogo`, 'offline'], ['saúde do envio com a API aberta', `${INVESTIGADOR}/saude/24h/api`, 'offline'], ['saúde do envio com os Webhooks abertos', `${ADMINISTRADOR}/saude/24h/webhooks`, 'offline']]) {
    const ehControle = nome.startsWith('CONTROLE');
    await abrir(`/?visao=painel&superficie=desktop&tema=light&estado=${estadoDaCena}&print=1&idioma=pt-BR${rota}`);
    if (ehControle) await avaliar(`(() => { const plantado = document.createElement('div'); plantado.setAttribute('role', 'status'); plantado.textContent = 'Sem internet (CONTROLE plantado)'; plantado.style.cssText = 'position:fixed;top:120px;left:236px;right:0;height:420px;background:#fff;z-index:50'; document.body.appendChild(plantado); return true; })()`);
    await avaliar(`(() => { const focaveisDaTela = [...document.querySelectorAll('#root [tabindex="0"], #root input, #root select')].filter((focavel) => focavel.checkVisibility()); focaveisDaTela[focaveisDaTela.length - 1].focus(); return true; })()`);
    let encobertas = 0; let emParte = 0; let conferidas = 0; let exemplo = '';
    for (let vez = 0; vez < 30; vez++) {
      await tecla('Tab', { shift: true });
      const medida = await avaliar(`(() => { const ativo = document.activeElement; const aviso = ${medirAviso}; const caixa = ativo.getBoundingClientRect(); return { cruzaNaLargura: caixa.right > aviso.left + 2 && caixa.left < aviso.right - 2, topo: Math.round(caixa.top), base: Math.round(caixa.bottom), baseDoAviso: Math.round(aviso.bottom), topoDoAviso: Math.round(aviso.top), nome: (ativo.innerText || '').slice(0, 30).replace(/\\s+/g, ' '), dentroDoAviso: Boolean(ativo.closest('[role=status]')) }; })()`);
      conferidas++;
      // Encoberta: a caixa do foco fica (quase) toda debaixo do aviso.
      const sobOAviso = !medida.dentroDoAviso && medida.cruzaNaLargura && medida.topo < medida.baseDoAviso - 2 && medida.base > medida.topoDoAviso + 2;
      // WCAG 2.4.11 (AA): reprova o foco INTEIRO debaixo do aviso; em parte é observação.
      if (sobOAviso && medida.base > medida.baseDoAviso + 2) emParte++;
      if (sobOAviso && medida.base <= medida.baseDoAviso + 2) { encobertas++; if (!exemplo) { exemplo = `«${medida.nome}» y ${medida.topo}–${medida.base} sob o aviso ${medida.topoDoAviso}–${medida.baseDoAviso}`; await foto(`${rodada}-foco-sob-o-aviso-${altura}`); } }
    }
    if (ehControle) { dizer(`${encobertas ? 'CONTROLE REPROVADO como devia' : 'CONTROLE NÃO REPROVOU'} janela ${altura} · ${encobertas} paradas inteiras debaixo do aviso plantado, de ${conferidas}`); continue; }
    if (encobertas) falhas++;
    dizer(`${encobertas ? 'FAIL' : 'PASS'} janela ${altura} · ${nome} · Shift+Tab 30 vezes a partir do último controle: ${encobertas} paradas inteiras debaixo do aviso fixo e ${emParte} em parte, de ${conferidas}${exemplo ? ' · ex.: ' + exemplo : ''}`);
  }
  fechar(); await new Promise((resolver) => setTimeout(resolver, 500));
}
dizer(`falhas: ${falhas}`);
writeFileSync(`${PASTA}aviso-fixo-${rodada}.txt`, linhas.join('\n') + '\n');
