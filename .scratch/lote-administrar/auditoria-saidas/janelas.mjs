// Teclado e foco nas janelas (JanelaDeDialogo): foco inicial, Tab preso, Esc fecha e devolve o foco, clique fora,
// contorno de foco medido, foco não encoberto, e a janela inteira à vista em janelas de navegador baixas.
// Uso: node janelas.mjs <rodada> [teclado|tamanho|todas]
import { readFileSync, writeFileSync } from 'node:fs';
import { abrirNavegador, porTexto, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const parte = process.argv[3] || 'todas';
const { avaliar, abrir, clicar, tecla, digitar, foto, enviar, fechar } = await abrirNavegador({ porta: 9472 });
const medidor = readFileSync(PASTA + 'medidor.js', 'utf8');
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
let falhas = 0;
const conferir = (passou, texto) => { if (!passou) falhas++; dizer(`${passou ? 'PASS' : 'FAIL'} ${texto}`); return passou; };
const ADMINISTRADOR = '#/painel/excurfly/producao/administrador';
const botao = (texto) => porTexto('[role="button"]', texto);
const naJanela = (texto) => porTexto('[aria-modal="true"] [role="button"]', texto);
const enderecoDaCena = (rota, tema = 'light', estado = 'default') => `/?visao=painel&superficie=desktop&tema=${tema}&estado=${estado}&print=1&idioma=pt-BR${rota}`;
const mudarJanelaDoNavegador = async (largura, altura) => { await enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false }); await new Promise((resolver) => setTimeout(resolver, 250)); };

// O elemento com o foco: nome, se está na janela de diálogo, o contorno (cor resolvida contra o fundo), se está à vista e se algo o cobre.
const lerFoco = `(() => {
  const comFoco = document.activeElement;
  if (!comFoco || comFoco === document.body) return { nome: 'body', noCorpo: true, dentroDaJanelaDeDialogo: false, temContorno: false, razaoDoContorno: 0, aVista: false, encoberto: false };
  const candidatos = [comFoco, comFoco.closest('.caixa-de-campo'), comFoco.closest('label')].filter(Boolean);
  const comContorno = candidatos.find((candidato) => { const estilo = getComputedStyle(candidato); return estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 1; });
  let razaoDoContorno = 0; let corDoContorno = '';
  if (comContorno) {
    const estilo = getComputedStyle(comContorno);
    const cor = window.__analisarCor(estilo.outlineColor); corDoContorno = window.__hex(cor);
    const porDentro = parseFloat(estilo.outlineOffset) < 0;
    const fundo = window.__compor(porDentro ? comContorno : (comContorno.parentElement || comContorno), null).fundo;
    razaoDoContorno = Math.round(window.__razao(cor, fundo) * 100) / 100;
  }
  const caixa = comFoco.getBoundingClientRect();
  const aVista = caixa.top >= 0 && caixa.left >= 0 && caixa.bottom <= innerHeight && caixa.right <= innerWidth;
  const pontos = [[caixa.left + caixa.width / 2, caixa.top + caixa.height / 2], [caixa.left + 3, caixa.top + 3], [caixa.right - 3, caixa.bottom - 3]];
  const pintado = (elemento) => { const estilo = getComputedStyle(elemento); const cor = window.__analisarCor(estilo.backgroundColor); return (cor && cor[3] > 0.05) || estilo.backgroundImage !== 'none'; };
  const quemCobre = ([horizontal, vertical]) => { for (const elemento of document.elementsFromPoint(horizontal, vertical)) { if (comFoco.contains(elemento) || elemento.contains(comFoco)) return null; if (pintado(elemento)) return elemento; } return null; };
  const coberturas = pontos.map(quemCobre);
  const encoberto = coberturas.every(Boolean);
  return {
    nome: (comFoco.getAttribute('role') || comFoco.tagName.toLowerCase()) + ' «' + (comFoco.getAttribute('aria-label') || comFoco.innerText || comFoco.placeholder || '').replace(/\\s+/g, ' ').slice(0, 50) + '»',
    dentroDaJanelaDeDialogo: Boolean(comFoco.closest('[aria-modal="true"]')), ehAJanela: comFoco.getAttribute('aria-modal') === 'true',
    temContorno: Boolean(comContorno), razaoDoContorno, corDoContorno, aVista, encoberto,
    quemCobre: encoberto ? coberturas[0].tagName.toLowerCase() + ' «' + coberturas[0].textContent.replace(/\\s+/g, ' ').slice(0, 40) + '»' : '',
    topo: Math.round(caixa.top), base: Math.round(caixa.bottom),
  };
})()`;
const lerJanela = `(() => {
  const janela = document.querySelector('[aria-modal="true"]');
  if (!janela) return null;
  const caixa = janela.getBoundingClientRect();
  const focaveis = [...janela.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]')];
  const foraDaVista = focaveis.filter((focavel) => { const caixaDoFocavel = focavel.getBoundingClientRect(); return caixaDoFocavel.top < 0 || caixaDoFocavel.bottom > innerHeight; })
    .map((focavel) => (focavel.getAttribute('aria-label') || focavel.innerText || focavel.placeholder || '').replace(/\\s+/g, ' ').slice(0, 30) + ' (y ' + Math.round(focavel.getBoundingClientRect().top) + ' a ' + Math.round(focavel.getBoundingClientRect().bottom) + ')');
  let comRolagem = janela; let podeRolar = false;
  while (comRolagem && comRolagem !== document.body) { const estilo = getComputedStyle(comRolagem); if (/(auto|scroll)/.test(estilo.overflowY) && comRolagem.scrollHeight > comRolagem.clientHeight + 1) { podeRolar = true; break; } comRolagem = comRolagem.parentElement; }
  return { papel: janela.getAttribute('role'), titulo: (document.getElementById(janela.getAttribute('aria-labelledby')) || {}).textContent || '', topo: Math.round(caixa.top), base: Math.round(caixa.bottom), altura: Math.round(caixa.height),
    alturaDaJanelaDoNavegador: innerHeight, focaveis: focaveis.length, foraDaVista, podeRolar };
})()`;
const quantasJanelas = 'document.querySelectorAll(\'[aria-modal="true"]\').length';

// ---------- Controles (RP1) ----------
await abrir(enderecoDaCena(`${ADMINISTRADOR}/aplicacoes`));
await avaliar(medidor + '; window.medirContraste(); true');
await avaliar(`(() => { const caixa = document.createElement('div'); caixa.id = 'controles-de-foco'; caixa.style.cssText = 'position:fixed;top:0;left:0;z-index:9999;background:#fff;padding:12px';
  caixa.innerHTML = '<button id="controle-sem-contorno" style="outline:none">CONTROLE sem contorno</button><button id="controle-contorno-fraco" style="outline:2px solid #eee;outline-offset:2px">CONTROLE contorno fraco</button><button id="controle-contorno-forte" style="outline:2px solid #000;outline-offset:2px">CONTROLE contorno forte</button><span style="position:relative"><button id="controle-encoberto" style="outline:2px solid #000">CONTROLE encoberto</button><span style="position:absolute;inset:-4px;background:#f00"></span></span>';
  document.body.appendChild(caixa); return true; })()`);
const focoDoControle = async (id) => { await avaliar(`document.getElementById(${JSON.stringify(id)}).focus(), true`); return avaliar(lerFoco); };
const semContorno = await focoDoControle('controle-sem-contorno');
const contornoFraco = await focoDoControle('controle-contorno-fraco');
const contornoForte = await focoDoControle('controle-contorno-forte');
const encoberto = await focoDoControle('controle-encoberto');
dizer('== CONTROLES do conferidor de foco ==');
dizer(`  negativo sem contorno: temContorno=${semContorno.temContorno} => ${!semContorno.temContorno ? 'REPROVADO como devia' : 'NÃO REPROVOU'}`);
dizer(`  negativo contorno #eee sobre #fff: ${contornoFraco.razaoDoContorno}:1 => ${contornoFraco.razaoDoContorno < 3 ? 'REPROVADO como devia' : 'NÃO REPROVOU'}`);
dizer(`  negativo encoberto por uma camada: encoberto=${encoberto.encoberto} => ${encoberto.encoberto ? 'REPROVADO como devia' : 'NÃO REPROVOU'}`);
dizer(`  positivo contorno #000 sobre #fff: ${contornoForte.razaoDoContorno}:1, encoberto=${contornoForte.encoberto} => ${contornoForte.razaoDoContorno > 20 && !contornoForte.encoberto ? 'passou' : 'NÃO PASSOU'}`);
const controlesValem = !semContorno.temContorno && contornoFraco.razaoDoContorno < 3 && encoberto.encoberto && contornoForte.razaoDoContorno > 20 && !contornoForte.encoberto;
dizer(`MEDIDA ${controlesValem ? 'VÁLIDA' : 'INVÁLIDA'}\n`);
if (!controlesValem) { writeFileSync(`${PASTA}janelas-${rodada}.txt`, linhas.join('\n') + '\n'); fechar(); process.exit(2); }

// ---------- Teclado: abrir com clique real, foco inicial, Tab preso, Esc, clique fora, foco de volta ----------
const JANELAS = [
  { nome: 'cadastrar aplicação', rota: `${ADMINISTRADOR}/aplicacoes`, abrir: async () => { await clicar(botao('Cadastrar aplicação'), 'cadastrar'); }, focoInicialEsperado: 'input', fechaComEsc: true, quemAbriu: 'Cadastrar aplicação' },
  { nome: 'mais uma chave (API)', rota: `${ADMINISTRADOR}/aplicacoes`, abrir: async () => { await clicar('document.querySelector("[aria-label=\\"Gerar chave de envio para API\\"]")', 'gerar chave'); }, focoInicialEsperado: 'input', fechaComEsc: true, quemAbriu: 'Gerar chave de envio para API' },
  { nome: 'revogar (servidor antigo do Site)', rota: `${ADMINISTRADOR}/aplicacoes`, abrir: async () => { await clicar('document.querySelector("[aria-label=\\"Revogar a chave servidor antigo de Site\\"]")', 'revogar'); }, focoInicialEsperado: 'Cancelar', fechaComEsc: true, quemAbriu: 'Revogar a chave servidor antigo de Site' },
  { nome: 'chave gerada', rota: `${ADMINISTRADOR}/aplicacoes`, abrir: async () => { await clicar(botao('Cadastrar aplicação'), 'cadastrar'); await digitar('API de parceiros'); await tecla('Enter'); }, focoInicialEsperado: 'Copiar a chave', fechaComEsc: false, quemAbriu: 'Cadastrar aplicação' },
  { nome: 'declarar campo', rota: `${ADMINISTRADOR}/catalogo`, abrir: async () => { await clicar('document.querySelector("[aria-label=\\"Declarar o campo installmentCount\\"]")', 'declarar'); }, focoInicialEsperado: null, fechaComEsc: true, quemAbriu: 'Declarar o campo installmentCount' },
  { nome: 'atalhos do teclado', rota: `${ADMINISTRADOR}/aplicacoes`, abrir: async () => { await avaliar(`[...document.querySelectorAll('#root [role="button"]')].find((elemento) => elemento.textContent.trim() === 'Cadastrar aplicação').focus(), true`); await tecla('?'); }, focoInicialEsperado: 'Fechar', fechaComEsc: true, quemAbriu: 'Cadastrar aplicação' },
];
if (parte === 'todas' || parte === 'teclado') {
  const menorContorno = { light: 99, dark: 99 }; const paradasMedidas = { light: 0, dark: 0 };
  for (const tema of ['light', 'dark']) {
    for (const janela of JANELAS) {
      await abrir(enderecoDaCena(janela.rota, tema)); await avaliar(medidor + '; window.medirContraste(); true');
      await janela.abrir();
      const aberta = await avaliar(lerJanela);
      if (!conferir(Boolean(aberta), `[${tema}] ${janela.nome}: a janela abre (${aberta ? aberta.papel + ' «' + aberta.titulo.slice(0, 60) + '»' : 'não abriu'})`)) continue;
      const focoInicial = await avaliar(lerFoco);
      if (janela.focoInicialEsperado) conferir(focoInicial.dentroDaJanelaDeDialogo && focoInicial.nome.includes(janela.focoInicialEsperado), `[${tema}] ${janela.nome}: foco inicial em ${focoInicial.nome} (esperado: ${janela.focoInicialEsperado})`);
      else dizer(`INFO [${tema}] ${janela.nome}: foco inicial em ${focoInicial.nome}${focoInicial.ehAJanela ? ' (a janela inteira, sem contorno: o primeiro Tab leva ao primeiro controle)' : ''}`);
      // Tab preso: duas voltas inteiras para a frente e uma para trás.
      const paradas = []; let fugiu = 0; let semContornoVisivel = 0; let contornoFracoDemais = 0; let encobertas = 0; let foraDaVista = 0;
      const passos = (aberta.focaveis + 1) * 2;
      for (let passo = 0; passo < passos + aberta.focaveis + 1; passo++) {
        await tecla('Tab', { shift: passo >= passos });
        const parada = await avaliar(lerFoco);
        if (passo < aberta.focaveis) paradas.push(parada.nome);
        if (!parada.dentroDaJanelaDeDialogo) { fugiu++; dizer(`     fugiu da janela no Tab ${passo + 1}: ${parada.nome}`); }
        if (!parada.temContorno) { semContornoVisivel++; dizer(`     sem contorno: ${parada.nome}`); } else { paradasMedidas[tema]++; menorContorno[tema] = Math.min(menorContorno[tema], parada.razaoDoContorno); if (parada.razaoDoContorno < 3) { contornoFracoDemais++; dizer(`     contorno ${parada.razaoDoContorno}:1 ${parada.corDoContorno}: ${parada.nome}`); } }
        if (parada.encoberto) { encobertas++; dizer(`     encoberto por ${parada.quemCobre}: ${parada.nome}`); }
        if (!parada.aVista) { foraDaVista++; dizer(`     fora da vista (y ${parada.topo} a ${parada.base}): ${parada.nome}`); }
      }
      conferir(fugiu === 0, `[${tema}] ${janela.nome}: Tab preso na janela (${passos + aberta.focaveis + 1} Tabs, ${aberta.focaveis} focáveis; fugas ${fugiu}) · ordem: ${paradas.join(' → ')}`);
      conferir(semContornoVisivel === 0 && contornoFracoDemais === 0, `[${tema}] ${janela.nome}: foco visível em toda parada (sem contorno ${semContornoVisivel}; abaixo de 3:1 ${contornoFracoDemais})`);
      conferir(encobertas === 0 && foraDaVista === 0, `[${tema}] ${janela.nome}: foco à vista e não encoberto (encobertas ${encobertas}; fora da vista ${foraDaVista})`);
      // Clique fora (no véu, canto de cima à esquerda da área da tela).
      const enderecoComAJanela = await avaliar('location.hash');
      // O centro do véu é a própria janela; o clique fora vai num canto do véu.
      const cantoDoVeu = await avaliar(`(() => { const veu = document.querySelector('[aria-modal="true"]') && document.querySelector('[aria-modal="true"]').parentElement; if (!veu) return null; const caixa = veu.getBoundingClientRect(); return { horizontal: caixa.left + 6, vertical: caixa.top + 6 }; })()`);
      if (cantoDoVeu) { for (const type of ['mousePressed', 'mouseReleased']) await enviar('Input.dispatchMouseEvent', { type, x: cantoDoVeu.horizontal, y: cantoDoVeu.vertical, button: 'left', clickCount: 1 }); await new Promise((resolver) => setTimeout(resolver, 350)); }
      const fechouComCliqueFora = (await avaliar(quantasJanelas)) === 0;
      conferir(fechouComCliqueFora === janela.fechaComEsc, `[${tema}] ${janela.nome}: clique fora ${fechouComCliqueFora ? 'fecha' : 'não fecha'} (esperado: ${janela.fechaComEsc ? 'fecha' : 'não fecha'})`);
      // Esc e o foco de volta.
      await abrir(enderecoDaCena(janela.rota, tema)); await avaliar(medidor + '; window.medirContraste(); true');
      await janela.abrir();
      await tecla('Escape');
      const fechouComEsc = (await avaliar(quantasJanelas)) === 0;
      conferir(fechouComEsc === janela.fechaComEsc, `[${tema}] ${janela.nome}: Esc ${fechouComEsc ? 'fecha' : 'não fecha'} (esperado: ${janela.fechaComEsc ? 'fecha' : 'não fecha'}) · endereço ${enderecoComAJanela.replace(ADMINISTRADOR, '')} → ${(await avaliar('location.hash')).replace(ADMINISTRADOR, '')}`);
      if (janela.fechaComEsc && fechouComEsc) {
        const focoDepois = await avaliar(lerFoco);
        conferir(focoDepois.nome.includes(janela.quemAbriu), `[${tema}] ${janela.nome}: fechada com Esc, o foco volta a quem abriu (${focoDepois.nome}; esperado «${janela.quemAbriu}»)`);
      }
    }
    // Depois de confirmar: revogar e declarar tiram o botão que abriu; a chave gerada fecha pelo botão.
    await abrir(enderecoDaCena(`${ADMINISTRADOR}/aplicacoes`, tema)); await avaliar(medidor + '; window.medirContraste(); true');
    await clicar('document.querySelector("[aria-label=\\"Revogar a chave servidor antigo de Site\\"]")', 'revogar'); await tecla('Tab'); await tecla('Enter');
    let focoDepoisDeConfirmar = await avaliar(lerFoco);
    conferir(!focoDepoisDeConfirmar.noCorpo && (await avaliar('location.hash')).endsWith('/revogada'), `[${tema}] revogar pelo teclado (Tab, Enter): chave revogada e foco em ${focoDepoisDeConfirmar.nome} (não pode ficar no body)`);
    await abrir(enderecoDaCena(`${ADMINISTRADOR}/aplicacoes`, tema)); await avaliar(medidor + '; window.medirContraste(); true');
    await clicar('document.querySelector("[aria-label=\\"Revogar a chave servidor antigo de Site\\"]")', 'revogar'); await tecla('Enter');
    conferir((await avaliar('location.hash')).endsWith('/aplicacoes'), `[${tema}] revogar: Enter logo ao abrir cancela, não revoga (endereço ${(await avaliar('location.hash')).replace(ADMINISTRADOR, '')})`);
    await abrir(enderecoDaCena(`${ADMINISTRADOR}/catalogo`, tema)); await avaliar(medidor + '; window.medirContraste(); true');
    await clicar('document.querySelector("[aria-label=\\"Declarar o campo installmentCount\\"]")', 'declarar');
    await clicar(naJanela('Declarar o campo'), 'confirmar');
    focoDepoisDeConfirmar = await avaliar(lerFoco);
    conferir(!focoDepoisDeConfirmar.noCorpo, `[${tema}] declarar confirmado: foco em ${focoDepoisDeConfirmar.nome} (não pode ficar no body)`);
    await abrir(enderecoDaCena(`${ADMINISTRADOR}/aplicacoes`, tema)); await avaliar(medidor + '; window.medirContraste(); true');
    await clicar(botao('Cadastrar aplicação'), 'cadastrar'); await digitar('API de parceiros'); await tecla('Enter');
    await tecla('Tab'); await tecla('Enter');
    focoDepoisDeConfirmar = await avaliar(lerFoco);
    conferir(!focoDepoisDeConfirmar.noCorpo && (await avaliar(quantasJanelas)) === 0, `[${tema}] chave gerada: "Já guardei a chave" pelo teclado fecha e o foco vai para ${focoDepoisDeConfirmar.nome} (não pode ficar no body)`);
  }
  dizer(`\nINDICADOR DE FOCO NAS JANELAS: light ${paradasMedidas.light} paradas, menor ${menorContorno.light}:1 · dark ${paradasMedidas.dark} paradas, menor ${menorContorno.dark}:1 (mínimo 3:1)\n`);
}

// ---------- Tamanho: a janela cabe e nenhum botão fica cortado, em janelas de navegador baixas e nos estados que a deixam mais alta ----------
if (parte === 'todas' || parte === 'tamanho') {
  const CENAS_DE_TAMANHO = [
    ['cadastro', `${ADMINISTRADOR}/aplicacoes/nova`], ['mais uma chave', `${ADMINISTRADOR}/aplicacoes/api/chaves/nova`], ['chave gerada', `${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a/gerada`],
    ['revogar', `${ADMINISTRADOR}/aplicacoes/site/chaves/ex2b/revogar`], ['declarar', `${ADMINISTRADOR}/catalogo/installmentCount/declarar`],
  ];
  const TAMANHOS = [[1440, 900], [1280, 720], [1280, 600]];
  for (const [largura, altura] of TAMANHOS) {
    await mudarJanelaDoNavegador(largura, altura);
    for (const [nomeDaCena, rota] of CENAS_DE_TAMANHO) {
      for (const estado of ['default', 'error', 'offline']) {
        await abrir(enderecoDaCena(rota, 'light', estado)); await avaliar(medidor + '; window.medirContraste(); true');
        if (nomeDaCena === 'declarar') {
          // A forma mais alta da janela de declarar: tipo texto (duas caixas de marcar) e papel que liga eventos (aviso maior).
          await clicar(porTexto('[aria-modal="true"] [role="radio"]', 'texto'), 'tipo texto').catch(() => {});
          await avaliar(`(() => { const grupos = [...document.querySelectorAll('[aria-modal="true"] [role="radiogroup"]')]; const papeis = grupos.length ? grupos[grupos.length - 1].querySelectorAll('[role="radio"]') : []; if (papeis[2]) papeis[2].click(); return papeis.length; })()`);
          await new Promise((resolver) => setTimeout(resolver, 250));
        }
        const medida = await avaliar(lerJanela);
        if (!medida) { conferir(false, `${largura}×${altura} ${nomeDaCena} ${estado}: a janela não abriu`); continue; }
        const cabe = medida.topo >= 0 && medida.base <= medida.alturaDaJanelaDoNavegador;
        // Mesmo sem caber, passa se dá para rolar até os botões e o Tab os traz à vista.
        let botoesAlcancaveis = true; const paradasCortadas = [];
        for (let passo = 0; passo < medida.focaveis + 1; passo++) { await tecla('Tab'); const parada = await avaliar(lerFoco); if (parada.dentroDaJanelaDeDialogo && (!parada.aVista || parada.encoberto)) { botoesAlcancaveis = false; paradasCortadas.push(`${parada.nome} y ${parada.topo} a ${parada.base}${parada.encoberto ? ' encoberto por ' + parada.quemCobre : ''}`); } }
        const passou = cabe || botoesAlcancaveis;
        if (!passou) await foto(`${rodada}-janela-cortada-${nomeDaCena.replace(/ /g, '-')}-${estado}-${largura}x${altura}`);
        conferir(passou, `${largura}×${altura} ${nomeDaCena} ${estado}: janela de ${medida.altura}px, de y ${medida.topo} a ${medida.base} numa janela de navegador de ${medida.alturaDaJanelaDoNavegador}px · ${cabe ? 'cabe inteira' : 'NÃO cabe'} · rolagem ${medida.podeRolar ? 'sim' : 'não'}${paradasCortadas.length ? ' · foco cortado em: ' + [...new Set(paradasCortadas)].join(' ; ') : ''}`);
      }
    }
  }
  // Controle negativo do "cabe": numa janela de navegador de 300 px, a janela de declarar tem de ser acusada.
  await mudarJanelaDoNavegador(1280, 300);
  await abrir(enderecoDaCena(`${ADMINISTRADOR}/catalogo/installmentCount/declarar`)); await avaliar(medidor + '; window.medirContraste(); true');
  const medidaDoControle = await avaliar(lerJanela);
  dizer(`CONTROLE NEGATIVO (janela de navegador de 300 px): janela de y ${medidaDoControle.topo} a ${medidaDoControle.base} => ${medidaDoControle.topo < 0 || medidaDoControle.base > 300 ? 'ACUSADA como devia (não cabe)' : 'NÃO ACUSOU'}`);
  await mudarJanelaDoNavegador(1440, 900);
}
dizer(`\nfalhas: ${falhas}`);
writeFileSync(`${PASTA}janelas-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
