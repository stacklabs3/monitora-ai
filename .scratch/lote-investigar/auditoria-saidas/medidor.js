// Roda dentro da página. Mede o contraste WCAG de todo texto visível.
window.medirContraste = () => {
  const analisarCor = (textoDaCor) => {
    if (!textoDaCor || textoDaCor === 'transparent') return [0, 0, 0, 0];
    const numeros = (textoDaCor.match(/-?[\d.]+(e-?\d+)?%?/g) || []).map((parte) => parseFloat(parte));
    if (textoDaCor.startsWith('color(srgb')) return [numeros[0] * 255, numeros[1] * 255, numeros[2] * 255, numeros[3] ?? 1];
    if (textoDaCor.startsWith('rgb')) return [numeros[0], numeros[1], numeros[2], numeros[3] ?? 1];
    return null;
  };
  // "cima" sobre "baixo", as duas em RGBA sem pré-multiplicar.
  const sobrepor = (cima, baixo) => {
    const alfa = cima[3] + baixo[3] * (1 - cima[3]);
    if (alfa === 0) return [0, 0, 0, 0];
    const canal = (indice) => (cima[indice] * cima[3] + baixo[indice] * baixo[3] * (1 - cima[3])) / alfa;
    return [canal(0), canal(1), canal(2), alfa];
  };
  const luminancia = (cor) => {
    const linear = (canal) => { const fracao = canal / 255; return fracao <= 0.04045 ? fracao / 12.92 : Math.pow((fracao + 0.055) / 1.055, 2.4); };
    return 0.2126 * linear(cor[0]) + 0.7152 * linear(cor[1]) + 0.0722 * linear(cor[2]);
  };
  const razao = (corA, corB) => { const lumA = luminancia(corA); const lumB = luminancia(corB); return (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05); };
  const hex = (cor) => '#' + [0, 1, 2].map((indice) => Math.round(cor[indice]).toString(16).padStart(2, '0')).join('');
  const BRANCO = [255, 255, 255, 1];
  const camadaDeRealce = (estilo) => {
    // box-shadow "inset" com espalhamento enorme é a camada de realce do botão: pinta por cima do fundo.
    const sombra = estilo.boxShadow;
    if (!sombra || sombra === 'none' || !sombra.includes('inset')) return null;
    for (const parte of sombra.split(/,(?![^(]*\))/)) {
      if (!parte.includes('inset')) continue;
      const medidas = (parte.replace(/rgba?\([^)]*\)|color\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
      if (medidas.length === 4 && medidas[3] >= 100) return analisarCor(parte.match(/rgba?\([^)]*\)|color\([^)]*\)/)?.[0]);
    }
    return null;
  };
  // Compõe o pixel do glifo e o pixel ao lado dele, subindo pelos ancestrais (grupo de opacidade incluído).
  const compor = (elemento, corDoTexto) => {
    let pixelDoGlifo = corDoTexto ? corDoTexto.slice() : [0, 0, 0, 0];
    let pixelDoFundo = [0, 0, 0, 0];
    let temImagemDeFundo = false;
    for (let atual = elemento; atual && atual.nodeType === 1; atual = atual.parentElement) {
      const estilo = getComputedStyle(atual);
      const camadas = [];
      const realce = camadaDeRealce(estilo); if (realce) camadas.push(realce);
      if (estilo.backgroundImage && estilo.backgroundImage !== 'none') temImagemDeFundo = temImagemDeFundo || pixelDoFundo[3] < 0.999;
      const corDeFundo = analisarCor(estilo.backgroundColor); if (corDeFundo && corDeFundo[3] > 0) camadas.push(corDeFundo);
      for (const camada of camadas) { pixelDoGlifo = sobrepor(pixelDoGlifo, camada); pixelDoFundo = sobrepor(pixelDoFundo, camada); }
      const opacidade = parseFloat(estilo.opacity);
      if (opacidade < 1) { pixelDoGlifo = [pixelDoGlifo[0], pixelDoGlifo[1], pixelDoGlifo[2], pixelDoGlifo[3] * opacidade]; pixelDoFundo = [pixelDoFundo[0], pixelDoFundo[1], pixelDoFundo[2], pixelDoFundo[3] * opacidade]; }
    }
    return { glifo: sobrepor(pixelDoGlifo, BRANCO), fundo: sobrepor(pixelDoFundo, BRANCO), temImagemDeFundo };
  };
  window.__compor = compor; window.__razao = razao; window.__analisarCor = analisarCor; window.__hex = hex;
  const descrever = (elemento) => {
    const partes = [];
    for (let atual = elemento, nivel = 0; atual && atual.nodeType === 1 && nivel < 3; atual = atual.parentElement, nivel++) {
      partes.unshift(atual.tagName.toLowerCase() + (atual.className && typeof atual.className === 'string' ? '.' + atual.className.split(' ')[0] : '') + (atual.getAttribute('role') ? `[${atual.getAttribute('role')}]` : ''));
    }
    return partes.join('>');
  };
  // Isento só o controle desabilitado que está de fato apagado (opacidade < 1). O que se declara indisponível
  // mas continua com a cor normal (linha da lista sem internet) é medido como texto comum.
  const desabilitado = (elemento) => {
    const controle = elemento.closest('[disabled], [aria-disabled="true"]');
    if (!controle) return false;
    for (let atual = elemento; atual && atual.nodeType === 1; atual = atual.parentElement) { if (parseFloat(getComputedStyle(atual).opacity) < 1) return true; if (atual === controle) break; }
    return false;
  };
  const achados = [];
  const registrar = (elemento, texto, corDoTextoBruta, tipo) => {
    const estilo = getComputedStyle(elemento);
    const corDoTexto = analisarCor(corDoTextoBruta);
    if (!corDoTexto) { achados.push({ tipo: 'cor-ilegivel', texto, bruta: corDoTextoBruta }); return; }
    const { glifo, fundo, temImagemDeFundo } = compor(elemento, corDoTexto);
    const tamanho = parseFloat(estilo.fontSize); const peso = parseInt(estilo.fontWeight, 10) || 400;
    const grande = tamanho >= 24 || (tamanho >= 18.66 && peso >= 700);
    const valor = razao(glifo, fundo);
    achados.push({ tipo, texto: texto.slice(0, 48), onde: descrever(elemento), texto_cor: hex(glifo), fundo_cor: hex(fundo), razao: Math.round(valor * 100) / 100,
      minimo: grande ? 3 : 4.5, tamanho, peso, desabilitado: desabilitado(elemento), temImagemDeFundo });
  };
  const caminhante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (caminhante.nextNode()) {
    const no = caminhante.currentNode; const texto = no.textContent.trim();
    if (!texto) continue;
    const elemento = no.parentElement;
    if (!elemento || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(elemento.tagName)) continue;
    if (elemento.closest('.so-leitor, #lista-de-prints')) continue;
    if (!elemento.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    const faixa = document.createRange(); faixa.selectNodeContents(no);
    const caixa = faixa.getBoundingClientRect();
    if (caixa.width < 1 || caixa.height < 1) continue;
    registrar(elemento, texto, getComputedStyle(elemento).color, 'texto');
  }
  for (const campo of document.querySelectorAll('input, textarea, select')) {
    if (!campo.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    if (['checkbox', 'radio', 'hidden'].includes(campo.type)) continue;
    if (campo.value) registrar(campo, campo.value, getComputedStyle(campo).color, 'valor-de-campo');
    else if (campo.placeholder) registrar(campo, campo.placeholder, getComputedStyle(campo, '::placeholder').color, 'placeholder');
  }
  return achados;
};
// Bordas de campo (1.4.11): a borda contra o fundo de fora e o de dentro; vale a maior das duas.
window.medirBordas = () => {
  const saida = [];
  const alvos = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea, select, .caixa-de-campo, [role="combobox"], [role="searchbox"]')];
  for (const alvo of alvos) {
    if (!alvo.checkVisibility()) continue;
    // O campo "sem moldura" tem a moldura na caixa que o envolve.
    const comMoldura = alvo.classList.contains('campo-sem-moldura') ? (alvo.closest('.caixa-de-campo') || alvo.closest('label')) : alvo;
    if (!comMoldura) continue;
    const estilo = getComputedStyle(comMoldura);
    const largura = parseFloat(estilo.borderTopWidth) || parseFloat(estilo.borderBottomWidth);
    const corDaBorda = window.__analisarCor(largura ? (parseFloat(estilo.borderTopWidth) ? estilo.borderTopColor : estilo.borderBottomColor) : 'transparent');
    const dentro = window.__compor(comMoldura, null).fundo;
    const fora = comMoldura.parentElement ? window.__compor(comMoldura.parentElement, null).fundo : [255, 255, 255, 1];
    const sobre = (base) => { const alfa = corDaBorda[3]; return [0, 1, 2].map((indice) => corDaBorda[indice] * alfa + base[indice] * (1 - alfa)).concat(1); };
    const contraFora = window.__razao(sobre(fora), fora); const contraDentro = window.__razao(sobre(dentro), dentro);
    const dentroContraFora = window.__razao(dentro, fora);
    saida.push({ onde: comMoldura.tagName.toLowerCase() + '.' + (comMoldura.className || '').toString().split(' ')[0], rotulo: (alvo.getAttribute('aria-label') || alvo.placeholder || alvo.textContent || '').slice(0, 40),
      borda: window.__hex(sobre(fora)), fora: window.__hex(fora), dentro: window.__hex(dentro), larguraDaBorda: largura,
      razao: Math.round(Math.max(contraFora, contraDentro, dentroContraFora) * 100) / 100, desabilitado: Boolean(alvo.closest('[disabled], [aria-disabled="true"]')) });
  }
  return saida;
};
