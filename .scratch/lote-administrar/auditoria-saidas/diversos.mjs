// Marcas da linha do tempo, Showcase, salto de layout no carregando, texto cortado/sobreposto, abas, painel flutuante, conexão de volta.
import { writeFileSync } from 'node:fs';
import { abrirNavegador, porTexto, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada'; const so = process.argv[3] || '';
const { avaliar, abrir, clicar, tecla, foto, registros, fechar, enviar } = await abrirNavegador({ porta: 9469 });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const roda = (parte) => !so || so === parte;
const INVESTIGADOR = '#/painel/excurfly/producao/investigador';
await abrir('/?listarPrints=todas');
const prints = JSON.parse(await avaliar('document.querySelector("#lista-de-prints").textContent'));
const LOTE = ['cadastrar-aplicacao', 'guardar-a-chave', 'revogar-chave', 'declarar-um-campo', 'ler-o-catalogo-como-investigador', 'conferir-a-saude-do-envio', 'execucao-que-sumiu', 'eventos-em-volta-da-perda'];
const telas = new Map();
for (const print of prints) { const rotina = print.arquivo.split('/')[0]; if (!LOTE.includes(rotina)) continue; const rota = print.endereco.slice(print.endereco.indexOf('#')); if (!telas.has(rota)) telas.set(rota, `${rotina}/${print.arquivo.split('/')[1].split('--')[0]}`); }
const enderecoDaCena = (tema, estado, rota) => `/?visao=painel&superficie=desktop&tema=${tema}&estado=${estado}&print=1&idioma=pt-BR${rota}`;

if (roda('marcas')) {
  dizer('== MARCAS NA LINHA DO TEMPO ==');
  const achadas = {};
  for (const valor of ['R-1019', 'R-1031', 'R-1038', 'R-1040', 'R-1042', 'R-1046', 'R-1047']) {
    await abrir(enderecoDaCena('light', 'default', `${INVESTIGADOR}/tentativas/reservationId/${valor}`));
    const texto = await avaliar('document.querySelector("#root").innerText');
    for (const marca of ['entrou pelo recebimento', 'cortado']) if (texto.includes(marca)) (achadas[marca] = achadas[marca] || []).push(valor);
  }
  dizer('  tentativas com cada marca: ' + JSON.stringify(achadas));
  for (const [marca, valores] of Object.entries(achadas)) {
    for (const tema of ['light', 'dark']) {
      await abrir(enderecoDaCena(tema, 'default', `${INVESTIGADOR}/tentativas/reservationId/${valores[0]}`));
      const medida = await avaliar(`(() => { const etiqueta = [...document.querySelectorAll('.linha-de-evento span')].find((el) => el.children.length === 0 && el.textContent.trim() === ${JSON.stringify(marca)}); if (!etiqueta) return null; etiqueta.scrollIntoView({ block: 'center' }); const linha = etiqueta.closest('.linha-de-evento'); const caixa = etiqueta.getBoundingClientRect(); const caixaDaLinha = linha.getBoundingClientRect(); return { dentroDaLinha: caixa.left >= caixaDaLinha.left && caixa.right <= caixaDaLinha.right + 1 && caixa.top >= caixaDaLinha.top - 1 && caixa.bottom <= caixaDaLinha.bottom + 1, cortada: etiqueta.scrollWidth > etiqueta.clientWidth + 1, textoDaLinha: linha.innerText.replace(/\\s+/g, ' ').slice(0, 150), y: Math.round(caixaDaLinha.top), altura: Math.round(caixaDaLinha.height) }; })()`);
      dizer(`  ${medida && medida.dentroDaLinha && !medida.cortada ? 'PASS' : 'FAIL'} [${tema}] «${marca}» em ${valores[0]}: ${JSON.stringify(medida)}`);
      if (medida) { const { data } = await enviar('Page.captureScreenshot', { format: 'png', clip: { x: 236, y: Math.max(0, medida.y - 40), width: 1204, height: medida.altura + 80, scale: 1 } }); writeFileSync(`${PASTA}fotos/${rodada}-marca-${marca.replace(/ /g, '-')}-${tema}.png`, Buffer.from(data, 'base64')); }
    }
  }
}

if (roda('showcase')) {
  dizer('\n== MODO SHOWCASE ==');
  for (const visao of ['painel', 'celular', 'telegram']) {
    for (const tema of ['light', 'dark']) {
      const antes = registros.length;
      await abrir(`/?visao=${visao}&tema=${tema}&modo=showcase&idioma=pt-BR`);
      await new Promise((resolver) => setTimeout(resolver, 1200));
      const medida = await avaliar(`(() => ({ rotinas: document.querySelectorAll('.grade-rotina').length, quadros: document.querySelectorAll('.grade-tile').length, erros: [...document.querySelectorAll('#root *')].filter((el) => el.children.length === 0 && el.textContent.startsWith('Render error')).map((el) => el.textContent), vazios: [...document.querySelectorAll('.grade-tile-viewport')].filter((quadro) => quadro.innerText.trim().length < 20).length, titulos: [...document.querySelectorAll('.grade-rotina-titulo')].map((titulo) => titulo.textContent).join(' | '), larguraDoCorpo: document.querySelector('.showcase-body').scrollWidth + '/' + document.querySelector('.showcase-body').clientWidth }))()`);
      const novos = registros.slice(antes).filter((registro) => !registro.includes('Babel') && !registro.includes('favicon'));
      const esperado = { painel: [18, 47], celular: [1, 3], telegram: [1, 4] }[visao];
      const passou = medida.rotinas === esperado[0] && medida.quadros === esperado[1] && medida.erros.length === 0 && medida.vazios === 0 && novos.length === 0;
      dizer(`  ${passou ? 'PASS' : 'FAIL'} [${visao} ${tema}] rotinas ${medida.rotinas}/${esperado[0]} · quadros ${medida.quadros}/${esperado[1]} · erros de render ${medida.erros.length} · quadros vazios ${medida.vazios} · console ${novos.length}${novos.length ? ' ' + novos[0] : ''} · corpo ${medida.larguraDoCorpo}`);
      if (visao === 'painel') { await foto(`${rodada}-showcase-${tema}`); if (tema === 'light') dizer('    títulos: ' + medida.titulos.slice(0, 700)); }
    }
  }
}

if (roda('carregando')) {
  dizer('\n== SALTO DE LAYOUT AO SAIR DO CARREGANDO ==');
  const caixas = `(() => { const principal = document.querySelector('#root main main') || document.querySelector('#root main'); const filhos = [...principal.children].filter((filho) => filho.checkVisibility()); return { filhos: filhos.map((filho) => [Math.round(filho.getBoundingClientRect().top), Math.round(filho.getBoundingClientRect().height)]), alto: principal.scrollHeight }; })()`;
  for (const [rota, nomeDaTela] of telas) {
    await abrir(enderecoDaCena('light', 'loading', rota)); const carregando = await avaliar(caixas);
    await abrir(enderecoDaCena('light', 'default', rota)); const pronto = await avaliar(caixas);
    // O que vem ANTES do conteúdo que carrega não pode se mexer: compara o topo de cada bloco na ordem.
    const comuns = Math.min(carregando.filhos.length, pronto.filhos.length);
    let primeiroDesvio = -1; for (let indice = 0; indice < comuns; indice++) { if (Math.abs(carregando.filhos[indice][0] - pronto.filhos[indice][0]) > 2) { primeiroDesvio = indice; break; } }
    const mesmoNumero = carregando.filhos.length === pronto.filhos.length;
    dizer(`  ${primeiroDesvio === -1 ? 'PASS' : 'WARN'} ${nomeDaTela}: blocos ${carregando.filhos.length}→${pronto.filhos.length}${primeiroDesvio >= 0 ? ` · o bloco ${primeiroDesvio + 1} muda de topo ${carregando.filhos[primeiroDesvio][0]}→${pronto.filhos[primeiroDesvio][0]}` : ' · topos iguais'} · alturas carregando ${carregando.filhos.map((filho) => filho[1]).join(',')} · pronto ${pronto.filhos.map((filho) => filho[1]).join(',')}`);
  }
}

if (roda('texto')) {
  dizer('\n== TEXTO CORTADO OU SOBREPOSTO ==');
  const varrer = `(() => {
    const cortados = []; const sobrepostos = []; let comReticencias = 0;
    for (const el of document.querySelectorAll('#root *')) {
      if (!el.checkVisibility() || el.closest('.so-leitor')) continue;
      const estilo = getComputedStyle(el);
      const temTextoProprio = [...el.childNodes].some((no) => no.nodeType === 3 && no.textContent.trim());
      if (temTextoProprio && /(hidden|clip)/.test(estilo.overflowX) && el.scrollWidth > el.clientWidth + 1) { if (estilo.textOverflow === 'ellipsis') comReticencias++; else cortados.push(el.tagName.toLowerCase() + ' «' + el.textContent.slice(0, 50) + '» ' + el.scrollWidth + '>' + el.clientWidth); }
      if (temTextoProprio && /(hidden|clip)/.test(estilo.overflowY) && el.scrollHeight > el.clientHeight + 2 && estilo.webkitLineClamp === 'none') cortados.push('na altura: ' + el.tagName.toLowerCase() + ' «' + el.textContent.slice(0, 50) + '» ' + el.scrollHeight + '>' + el.clientHeight);
      if (!/(flex|grid)/.test(estilo.display) || el.children.length < 2) continue;
      const filhos = [...el.children].filter((filho) => filho.checkVisibility() && !/(absolute|fixed|sticky)/.test(getComputedStyle(filho).position) && filho.getAttribute('aria-hidden') !== 'true');
      for (let indice = 1; indice < filhos.length; indice++) {
        const caixaA = filhos[indice - 1].getBoundingClientRect(); const caixaB = filhos[indice].getBoundingClientRect();
        if (!caixaA.width || !caixaB.width) continue;
        const cruzaX = Math.min(caixaA.right, caixaB.right) - Math.max(caixaA.left, caixaB.left); const cruzaY = Math.min(caixaA.bottom, caixaB.bottom) - Math.max(caixaA.top, caixaB.top);
        if (cruzaX > 2 && cruzaY > 2) sobrepostos.push('«' + filhos[indice - 1].textContent.slice(0, 30) + '» sobre «' + filhos[indice].textContent.slice(0, 30) + '» ' + Math.round(cruzaX) + 'x' + Math.round(cruzaY) + ' px');
      }
      // Texto que sai da caixa do pai sem corte: invade o vizinho.
    }
    const transborda = [...document.querySelectorAll('#root main, #root main main, #root section, #root aside, #root header, #root nav')].filter((el) => el.checkVisibility() && el.scrollWidth > el.clientWidth + 1 && !/(auto|scroll)/.test(getComputedStyle(el).overflowX)).map((el) => el.tagName.toLowerCase() + '[' + (el.getAttribute('aria-label') || '') + '] ' + el.scrollWidth + '>' + el.clientWidth);
    const paginaPassaDaMoldura = document.documentElement.scrollHeight > innerHeight + 1 ? ['página de ' + document.documentElement.scrollHeight + ' px numa moldura de ' + innerHeight + ' px (a tela inteira rola, não a área de conteúdo)'] : [];
    const rolagemLateral = [...document.querySelectorAll('#root main, #root main main, body')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.tagName.toLowerCase() + ' ' + el.scrollWidth + '>' + el.clientWidth);
    return { cortados: [...new Set(cortados)], sobrepostos: [...new Set(sobrepostos)], comReticencias, transborda, rolagemLateral, paginaPassaDaMoldura };
  })()`;
  let comProblema = 0; let conferidas = 0;
  for (const [rota, nomeDaTela] of telas) {
    for (const estado of ['default', 'empty', 'error', 'loading', 'offline', 'disabled']) {
      await abrir(enderecoDaCena('light', estado, rota)); conferidas++;
      const medida = await avaliar(varrer);
      const ruim = medida.cortados.length + medida.sobrepostos.length + medida.transborda.length + medida.rolagemLateral.length;
      if (ruim) { comProblema++; dizer(`  FAIL ${nomeDaTela} ${estado}: cortados ${medida.cortados.length} ${medida.cortados.slice(0, 3).join(' ; ')} · sobrepostos ${medida.sobrepostos.length} ${medida.sobrepostos.slice(0, 3).join(' ; ')} · transborda ${medida.transborda.join(' ; ')} · rolagem lateral ${medida.rolagemLateral.join(' ; ')}`); }
      else if (estado === 'default') dizer(`  PASS ${nomeDaTela} default: sem corte nem sobreposição · ${medida.comReticencias} textos com reticências`);
    }
  }
  await abrir(enderecoDaCena('light', 'default', [...telas.keys()][0]));
  await avaliar(`(() => { const main = document.querySelector('#root main main') || document.querySelector('#root main'); const caixa = document.createElement('div'); caixa.style.cssText = 'display:flex;width:200px'; caixa.innerHTML = '<span style="width:120px;flex-shrink:0">CONTROLE primeiro</span><span style="margin-left:-60px;width:120px;flex-shrink:0">CONTROLE segundo</span>'; const cortado = document.createElement('div'); cortado.style.cssText = 'width:60px;overflow:hidden;white-space:nowrap'; cortado.textContent = 'CONTROLE texto cortado sem reticências'; main.prepend(caixa, cortado); return true; })()`);
  const controle = await avaliar(varrer);
  dizer(`  CONTROLE NEGATIVO: cortados ${controle.cortados.filter((achado) => achado.includes('CONTROLE')).length} (esperado 1) · sobrepostos ${controle.sobrepostos.filter((achado) => achado.includes('CONTROLE')).length} (esperado 1) => ${controle.cortados.some((achado) => achado.includes('CONTROLE')) && controle.sobrepostos.some((achado) => achado.includes('CONTROLE')) ? 'REPROVADO como devia' : 'NÃO REPROVOU'}`);
  dizer(`  cenas conferidas ${conferidas} · com problema ${comProblema}`);
}

if (roda('casca')) {
  dizer('\n== ABAS, PAINEL FLUTUANTE, CONEXÃO DE VOLTA ==');
  await abrir('/?idioma=pt-BR');
  for (const [aba, esperado] of [['Painel no celular', 'iOS · Escuro'], ['Alerta no Telegram', 'iOS · Escuro'], ['Painel', 'Computador · Claro']]) {
    await clicar(porTexto('.showcase-abas button', aba), aba);
    const medida = await avaliar('({ resumo: document.querySelector(".painel-resumo").textContent, tema: document.documentElement.dataset.theme, hash: location.hash })');
    dizer(`  ${medida.resumo.includes(esperado.split(' · ')[1]) ? 'PASS' : 'FAIL'} aba «${aba}»: resumo «${medida.resumo}» · tema ${medida.tema} · ${medida.hash}`);
  }
  await clicar('document.querySelector(".painel-toggle")', 'painel');
  const superficies = await avaliar('[...document.querySelectorAll(".painel-grupo")][0].innerText.replace(/\\n/g, " ")');
  await tecla('Escape');
  const fechouComEsc = await avaliar('({ aberto: Boolean(document.querySelector(".painel-corpo")), foco: document.activeElement.className })');
  await clicar('document.querySelector(".painel-toggle")', 'painel'); await clicar('document.querySelector(".showcase-brand")', 'fora');
  const fechouFora = await avaliar('Boolean(document.querySelector(".painel-corpo"))');
  dizer(`  ${!fechouComEsc.aberto && fechouComEsc.foco.includes('painel-toggle') && !fechouFora ? 'PASS' : 'FAIL'} painel flutuante: superfícies da aba «${superficies}» · Esc fecha (${!fechouComEsc.aberto}) e devolve o foco (${fechouComEsc.foco}) · clique fora fecha (${!fechouFora})`);
  for (const rota of [`${INVESTIGADOR}/eventos/p=1h;f=reservationId:e:R-1042`, '#/painel/excurfly/producao/administrador/aplicacoes', '#/painel/excurfly/producao/administrador/catalogo', `${INVESTIGADOR}/catalogo`, `${INVESTIGADOR}/saude`, `${INVESTIGADOR}/saude/24h/api`]) {
    await abrir(`/?visao=painel&idioma=pt-BR${rota}`);
    await clicar('document.querySelector(".painel-toggle")', 'painel'); await clicar(porTexto('.painel-opcoes button', 'offline'), 'offline');
    const noOffline = await avaliar('document.querySelector("#root").innerText.includes("Sem internet")');
    await clicar(porTexto('.painel-opcoes button', 'default'), 'default');
    const voltou = await avaliar('[...document.querySelectorAll("[role=status]")].map((el) => el.innerText).find((texto) => texto.includes("conexão voltou")) || ""');
    dizer(`  ${noOffline && voltou ? 'PASS' : 'FAIL'} sair do sem internet em ${rota.slice(-40)}: aviso sem internet ${noOffline} · aviso de volta «${voltou}»`);
  }
}
dizer(`\nCONSOLE (${new Set(registros).size} distintas): ${[...new Set(registros)].map((registro) => registro.slice(0, 110)).join(' | ')}`);
writeFileSync(`${PASTA}diversos-${rodada}${so ? '-' + so : ''}.txt`, linhas.join('\n') + '\n');
fechar();
