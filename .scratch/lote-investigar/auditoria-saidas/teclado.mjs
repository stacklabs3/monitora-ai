// Tab real pelos controles: ordem, foco visível (contorno medido), foco não encoberto, nada inalcançável.
// Uso: node teclado.mjs <rodada> [tema]
import { readFileSync, writeFileSync } from 'node:fs';
import { abrirNavegador, porTexto, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const temas = process.argv[3] ? [process.argv[3]] : ['light', 'dark'];
const { avaliar, abrir, clicar, tecla, digitar, fechar, registros } = await abrirNavegador({ porta: 9366 });
const medidor = readFileSync(PASTA + 'medidor.js', 'utf8');
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const botao = (texto) => porTexto('[role="button"]', texto);
const I = '#/painel/excurfly/producao/investigador';
const R = `${I}/eventos/p=1h;f=reservationId:e:R-1042`;
const T = `${I}/tentativas`;
const PAGINAS = [
  ['busca com filtro', R, null],
  ['evento aberto', `${R}/evento/ev-1042-06`, null],
  ['painel de filtro: catálogo', R, async () => { await clicar(botao('Adicionar filtro'), 'filtro'); }],
  ['painel de filtro: valor', R, async () => { await clicar(botao('Adicionar filtro'), 'filtro'); await clicar(porTexto('[role="option"]', 'amountCents'), 'campo'); }],
  ['painel do período', R, async () => { await clicar(botao('Período'), 'período'); }],
  ['achar tentativas (achadas)', `${T}/por/cliente/conta-7/1h`, null],
  ['linha do tempo', `${T}/reservationId/R-1042`, null],
  ['linha do tempo com evento', `${T}/reservationId/R-1042/evento/ev-1042-05`, null],
  ['código em duas tentativas', `${T}/reservationId/R-1046`, null],
];
const lerParada = `(() => {
  const ativo = document.activeElement;
  if (!ativo || ativo === document.body) return { corpo: true };
  const candidatos = [ativo, ativo.closest('.caixa-de-campo'), ativo.closest('label')].filter(Boolean);
  const comContorno = candidatos.find((el) => { const estilo = getComputedStyle(el); return estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 1; });
  let razaoDoContorno = 0; let larguraDoContorno = 0; let corDoContorno = '';
  if (comContorno) {
    const estilo = getComputedStyle(comContorno); larguraDoContorno = parseFloat(estilo.outlineWidth);
    const cor = window.__analisarCor(estilo.outlineColor); corDoContorno = window.__hex(cor);
    const porDentro = parseFloat(estilo.outlineOffset) < 0;
    const fundo = window.__compor(porDentro ? comContorno : (comContorno.parentElement || comContorno), null).fundo;
    razaoDoContorno = Math.round(window.__razao(cor, fundo) * 100) / 100;
  }
  const caixa = ativo.getBoundingClientRect();
  const naJanela = caixa.bottom > 0 && caixa.top < innerHeight && caixa.right > 0 && caixa.left < innerWidth;
  const pontos = [[caixa.left + caixa.width / 2, caixa.top + caixa.height / 2], [caixa.left + 3, caixa.top + 3], [caixa.right - 3, caixa.bottom - 3]];
  // Quem cobre de verdade: o primeiro elemento pintado (com fundo) por cima do ponto, antes de chegar ao próprio alvo.
  const pintado = (el) => { const estilo = getComputedStyle(el); const cor = window.__analisarCor(estilo.backgroundColor); return (cor && cor[3] > 0.05) || estilo.backgroundImage !== 'none'; };
  const cobertura = ([x, y]) => { for (const el of document.elementsFromPoint(x, y)) { if (ativo.contains(el) || el.contains(ativo)) return null; if (pintado(el)) return el; } return null; };
  const coberturas = pontos.map(cobertura);
  const encoberto = naJanela && coberturas.every(Boolean);
  const quemCobre = encoberto ? coberturas[0].tagName.toLowerCase() + '.' + String(coberturas[0].className).split(' ')[0] + '[' + (coberturas[0].getAttribute('role') || '') + '] «' + coberturas[0].textContent.slice(0, 30) + '»' : '';
  const nome = (ativo.getAttribute('aria-label') || ativo.innerText || ativo.placeholder || ativo.value || '').replace(/\\s+/g, ' ').slice(0, 46);
  const noChrome = Boolean(ativo.closest('.showcase-header, .painel'));
  if (!ativo.dataset.paradaDoTab) ativo.dataset.paradaDoTab = String(Date.now() + Math.random());
  return { id: ativo.dataset.paradaDoTab, papel: ativo.getAttribute('role') || ativo.tagName.toLowerCase(), nome, x: Math.round(caixa.left), y: Math.round(caixa.top), temContorno: Boolean(comContorno), razaoDoContorno, larguraDoContorno, corDoContorno, naJanela, encoberto, quemCobre, noChrome,
    desabilitado: ativo.getAttribute('aria-disabled') === 'true', linhaDeEvento: ativo.classList.contains('linha-de-evento') };
})()`;
const naoAlcancados = `(() => {
  const chaveDeProps = (el) => Object.keys(el).find((chave) => chave.startsWith('__reactProps$'));
  const saida = [];
  for (const el of document.querySelectorAll('#root *')) {
    const chave = chaveDeProps(el); if (!chave || typeof el[chave].onClick !== 'function') continue;
    if (!el.checkVisibility() || el.closest('.showcase-header, .painel, [aria-hidden="true"]')) continue;
    if (el.getAttribute('aria-disabled') === 'true' || el.disabled) continue;
    if (el.dataset.paradaDoTab) continue;
    // Um invólucro com onClick (contagem de toques) cujo conteúdo foi alcançado não conta.
    if (el.querySelector('[data-parada-do-tab]')) continue;
    const alcancadoPorCima = el.closest('[data-parada-do-tab]');
    if (alcancadoPorCima) continue;
    saida.push((el.getAttribute('role') || el.tagName.toLowerCase()) + ' tabindex=' + el.getAttribute('tabindex') + ' «' + (el.getAttribute('aria-label') || el.innerText || '').replace(/\\s+/g, ' ').slice(0, 40) + '»');
  }
  return saida;
})()`;
let falhas = 0;
for (const tema of temas) {
  for (const [nome, rota, preparar] of PAGINAS) {
    await abrir(`/?visao=painel&superficie=desktop&tema=${tema}&print=1&idioma=pt-BR${rota}`);
    await avaliar(medidor + '; window.medirContraste(); true');
    if (preparar) await preparar();
    else await avaliar('document.activeElement && document.activeElement.blur(); true');
    const paradas = []; const vistos = new Set(); let passagensPeloCorpo = 0;
    for (let vez = 0; vez < 260; vez++) {
      await tecla('Tab');
      const parada = await avaliar(lerParada);
      if (parada.corpo) { passagensPeloCorpo++; if (passagensPeloCorpo > 2) break; continue; }
      if (vistos.has(parada.id)) break;
      vistos.add(parada.id); paradas.push(parada);
    }
    const semContorno = paradas.filter((parada) => !parada.temContorno);
    const contornoFraco = paradas.filter((parada) => parada.temContorno && parada.razaoDoContorno < 3);
    const encobertos = paradas.filter((parada) => parada.encoberto);
    const foraDaJanela = paradas.filter((parada) => !parada.naJanela);
    const desabilitadosComFoco = paradas.filter((parada) => parada.desabilitado);
    const inalcancaveis = await avaliar(naoAlcancados);
    // Ordem: dentro da tela, cada parada não pode voltar para cima mais de uma linha sem motivo.
    // Ordem: sem tabindex positivo, o Tab segue a ordem do documento; a sequência fica impressa para leitura.
    const voltas = await avaliar(`[...document.querySelectorAll('[tabindex]')].filter((el) => Number(el.getAttribute('tabindex')) > 0).map((el) => 'tabindex positivo: ' + el.outerHTML.slice(0, 60))`);
    const menorContorno = Math.min(...paradas.filter((parada) => parada.temContorno).map((parada) => parada.razaoDoContorno));
    const problemas = semContorno.length + contornoFraco.length + encobertos.length + foraDaJanela.length + inalcancaveis.length + voltas.length;
    if (problemas) falhas++;
    dizer(`${problemas ? 'FAIL' : 'PASS'} [${tema}] ${nome}: ${paradas.length} paradas · sem contorno ${semContorno.length} · contorno < 3:1 ${contornoFraco.length} (menor ${menorContorno}:1, ${paradas[0]?.corDoContorno}) · encobertas ${encobertos.length} · fora da janela ${foraDaJanela.length} · com onClick e fora do Tab ${inalcancaveis.length} · tabindex positivo ${voltas.length} · desabilitados que recebem foco ${desabilitadosComFoco.length}`);
    dizer('     ordem: ' + paradas.slice(0, 60).map((parada) => `${parada.papel}«${parada.nome.slice(0, 22)}»`).join(' → '));
    for (const parada of semContorno.slice(0, 5)) dizer(`     SEM CONTORNO: ${parada.papel} «${parada.nome}»`);
    for (const parada of contornoFraco.slice(0, 5)) dizer(`     CONTORNO FRACO ${parada.razaoDoContorno}:1: ${parada.papel} «${parada.nome}»`);
    for (const parada of encobertos.slice(0, 5)) dizer(`     ENCOBERTA: ${parada.papel} «${parada.nome}» por ${parada.quemCobre}`);
    for (const parada of foraDaJanela.slice(0, 5)) dizer(`     FORA DA JANELA: ${parada.papel} «${parada.nome}» (${parada.x},${parada.y})`);
    for (const texto of inalcancaveis.slice(0, 8)) dizer(`     FORA DO TAB: ${texto}`);
    for (const volta of voltas.slice(0, 5)) dizer(`     VOLTA: ${volta}`);
  }
}

// ---------- O que o mouse faz, o teclado faz ----------
const focarPorTexto = async (expressao) => avaliar(`(() => { const el = ${expressao}; if (!el) return false; el.focus(); return true; })()`);
const estadoDoFoco = () => avaliar(`(() => { const ativo = document.activeElement; const dialogo = document.querySelector('[role="dialog"]:not(.painel-corpo)'); return { dialogoAberto: Boolean(dialogo), focoNoDialogo: Boolean(dialogo && dialogo.contains(ativo)), foco: (ativo.getAttribute('role') || ativo.tagName.toLowerCase()) + ' «' + (ativo.getAttribute('aria-label') || ativo.innerText || ativo.placeholder || '').replace(/\\s+/g, ' ').slice(0, 40) + '»', hash: location.hash.slice(-46), dicaVisivel: [...document.querySelectorAll('[role=tooltip]')].some((dica) => getComputedStyle(dica).display !== 'none') }; })()`);
const conferir = (nome, passou, detalhe) => { if (!passou) falhas++; dizer(`${passou ? 'PASS' : 'FAIL'} teclado · ${nome}: ${detalhe}`); };
await abrir(`/?visao=painel&superficie=desktop&tema=light&print=1&idioma=pt-BR${R}`);
for (const rotulo of ['Adicionar filtro', 'Período']) {
  await focarPorTexto(botao(rotulo)); await tecla('Enter');
  const aberto = await estadoDoFoco();
  await tecla('Tab'); const depoisDoTab = await estadoDoFoco();
  await tecla('Escape'); const fechado = await estadoDoFoco();
  conferir(`${rotulo} abre com Enter`, aberto.dialogoAberto, `aberto=${aberto.dialogoAberto} · foco ${aberto.foco} (dentro do painel: ${aberto.focoNoDialogo}) · depois de um Tab: ${depoisDoTab.foco} (dentro: ${depoisDoTab.focoNoDialogo})`);
  conferir(`${rotulo} fecha com Esc e devolve o foco`, !fechado.dialogoAberto && fechado.foco.includes(rotulo.slice(0, 7)), `aberto=${fechado.dialogoAberto} · foco depois do Esc: ${fechado.foco}`);
}
await focarPorTexto(botao('Adicionar filtro')); await tecla(' ');
conferir('Adicionar filtro abre com espaço', (await estadoDoFoco()).dialogoAberto, 'espaço');
await digitar('amount'); await tecla('Enter');
const noValor = await estadoDoFoco();
await digitar('4500'); await tecla('Enter');
const aplicado = await estadoDoFoco();
conferir('filtro inteiro só com teclado (procurar, Enter, valor, Enter)', !aplicado.dialogoAberto && aplicado.hash.includes('amountCents'), `no passo do valor: ${noValor.foco} · depois: ${aplicado.hash} · foco ${aplicado.foco}`);
await abrir(`/?visao=painel&superficie=desktop&tema=light&print=1&idioma=pt-BR${R}`);
await focarPorTexto('document.querySelector(".linha-de-evento")'); await tecla('ArrowDown'); const desceu = await estadoDoFoco();
await tecla('Enter'); const abriu = await estadoDoFoco();
await tecla('Escape'); const fechou = await estadoDoFoco();
conferir('lista: seta anda, Enter abre o evento, Esc fecha e devolve o foco à linha', abriu.hash.includes('/evento/') && !fechou.hash.includes('/evento/') && fechou.foco.startsWith('button «14:'), `seta: ${desceu.foco} · Enter: ${abriu.hash} foco ${abriu.foco} · Esc: ${fechou.hash} foco ${fechou.foco}`);
await abrir(`/?visao=painel&superficie=desktop&tema=light&print=1&idioma=pt-BR${R}/evento/ev-1042-06/atributos`);
await focarPorTexto('document.querySelector("[role=note]")'); const comDica = await estadoDoFoco();
await tecla('Escape'); const semDica = await estadoDoFoco();
conferir('dica "sem filtro" aparece no foco e some com Esc sem fechar o evento', comDica.dicaVisivel && !semDica.dicaVisivel && semDica.hash.includes('/evento/'), `no foco: ${comDica.dicaVisivel} · depois do Esc: ${semDica.dicaVisivel} · ${semDica.hash}`);
await abrir(`/?visao=painel&superficie=desktop&tema=light&print=1&idioma=pt-BR${T}`);
const focoNaAbertura = await estadoDoFoco();
await digitar('conta-7'); await tecla('Enter'); const achadas = await estadoDoFoco();
conferir('achar tentativas só com teclado (foco na caixa, digitar, Enter)', achadas.hash.includes('por/cliente/conta-7'), `foco na abertura: ${focoNaAbertura.foco} · depois: ${achadas.hash}`);
await focarPorTexto('document.querySelector(".linha-de-evento")'); await tecla('Enter'); const naLinha = await estadoDoFoco();
conferir('tentativa abre com Enter na linha', naLinha.hash.includes('tentativas/reservationId/R-1042'), naLinha.hash);

// Controle negativo (RP1): um botão sem contorno e um clicável sem tabindex precisam ser acusados.
await abrir(`/?visao=painel&superficie=desktop&tema=light&print=1&idioma=pt-BR${R}`);
await avaliar(medidor + '; window.medirContraste(); true');
await avaliar(`(() => { const main = document.querySelector('main main') || document.querySelector('main'); const semContorno = document.createElement('button'); semContorno.textContent = 'CONTROLE sem contorno'; semContorno.style.outline = 'none'; semContorno.id = 'controle-sem-contorno'; main.prepend(semContorno); const fraco = document.createElement('button'); fraco.textContent = 'CONTROLE contorno fraco'; fraco.id = 'controle-fraco'; fraco.style.cssText = 'outline: 2px solid #eee !important; outline-offset: 2px'; main.prepend(fraco); return true; })()`);
await avaliar('document.querySelector("#controle-fraco").focus(); true');
const controleFraco = await avaliar(lerParada);
await avaliar('document.querySelector("#controle-sem-contorno").focus(); true');
const controleSem = await avaliar(lerParada);
dizer(`CONTROLE NEGATIVO contorno fraco (#eee sobre a tela): razão ${controleFraco.razaoDoContorno}:1 => ${controleFraco.razaoDoContorno < 3 ? 'REPROVADO como devia' : 'NÃO REPROVOU'}`);
dizer(`CONTROLE NEGATIVO sem contorno (outline: none): temContorno=${controleSem.temContorno} => ${!controleSem.temContorno ? 'REPROVADO como devia' : 'NÃO REPROVOU'}`);
dizer(`páginas com problema: ${falhas}`);
dizer(`CONSOLE (${new Set(registros).size}): ${[...new Set(registros)].join(' | ').slice(0, 400)}`);
writeFileSync(`${PASTA}teclado-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
