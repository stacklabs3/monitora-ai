// Rodada 2, F2: no modo interativo (sem print=1) o véu da janela de diálogo é `position: fixed` na janela do navegador inteira.
// Mede se o título e os botões de ação da janela ficam à vista e por cima de tudo, e o que acontece com o cabeçalho do
// showcase e com o painel flutuante (fechado e aberto). Uso: node veu-interativo.mjs <rodada>
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA, porTexto } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const { avaliar, abrir, clicar, tecla, foto, enviar, fechar } = await abrirNavegador({ porta: 9481 });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const ADMINISTRADOR = '#/painel/excurfly/producao/administrador';
const CENAS = [
  ['cadastro', `${ADMINISTRADOR}/aplicacoes/nova`], ['mais uma chave', `${ADMINISTRADOR}/aplicacoes/api/chaves/nova`],
  ['chave gerada', `${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a/gerada`], ['revogar', `${ADMINISTRADOR}/aplicacoes/site/chaves/ex2b/revogar`],
  ['declarar (forma mais alta)', `${ADMINISTRADOR}/catalogo/installmentCount/declarar`],
];
const enderecoInterativo = (rota, tema, estado) => `/?visao=painel&tema=${tema}&estado=${estado}&idioma=pt-BR${rota}`;
const medirJanela = `(() => {
  const janela = document.querySelector('[aria-modal="true"]'); if (!janela) return null;
  const caixaDe = (elemento) => { const caixa = elemento.getBoundingClientRect(); return { topo: Math.round(caixa.top), base: Math.round(caixa.bottom), esquerda: Math.round(caixa.left), direita: Math.round(caixa.right) }; };
  const cruza = (caixaUm, caixaDois) => caixaUm.topo < caixaDois.base && caixaDois.topo < caixaUm.base && caixaUm.esquerda < caixaDois.direita && caixaDois.esquerda < caixaUm.direita;
  // Um alvo está alcançável se está inteiro na janela do navegador e se o centro e os quatro cantos (2 px para dentro) são dele ou de um filho dele.
  const conferirAlvo = (elemento, nome) => {
    const caixa = elemento.getBoundingClientRect();
    const inteiroAVista = caixa.top >= 0 && caixa.bottom <= innerHeight && caixa.left >= 0 && caixa.right <= innerWidth;
    const pontos = [[caixa.left + caixa.width / 2, caixa.top + caixa.height / 2], [caixa.left + 2, caixa.top + 2], [caixa.right - 2, caixa.top + 2], [caixa.left + 2, caixa.bottom - 2], [caixa.right - 2, caixa.bottom - 2]];
    const quemCobre = pontos.map(([horizontal, vertical]) => document.elementFromPoint(horizontal, vertical)).filter((elementoNoPonto) => !elementoNoPonto || !(elemento.contains(elementoNoPonto) || (elementoNoPonto.contains(elemento) && janela.contains(elementoNoPonto))));
    return { nome, topo: Math.round(caixa.top), base: Math.round(caixa.bottom), inteiroAVista, encobertoPor: quemCobre.length ? (quemCobre[0] ? quemCobre[0].tagName.toLowerCase() + '.' + String(quemCobre[0].className).slice(0, 20) + '#' + quemCobre[0].id : 'fora da janela do navegador') : '' };
  };
  const rodape = janela.children[2];
  const alvos = [conferirAlvo(janela.querySelector('h2'), 'título')];
  for (const botaoDeAcao of (rodape ? (rodape.matches('[role="button"], button') ? [rodape] : rodape.querySelectorAll('[role="button"], button')) : [])) alvos.push(conferirAlvo(botaoDeAcao, 'ação «' + botaoDeAcao.innerText.trim().slice(0, 22) + '»'));
  const cabecalho = document.querySelector('.showcase-header'); const painel = document.querySelector('.painel');
  const corpoDoPainel = document.querySelector('.painel-corpo');
  const centroDe = (elemento) => { const caixa = elemento.getBoundingClientRect(); return document.elementFromPoint(caixa.left + caixa.width / 2, caixa.top + caixa.height / 2); };
  const miolo = janela.children[1];
  return {
    alturaDoNavegador: innerHeight, janela: caixaDe(janela), alvos, quantasAcoes: alvos.length - 1,
    mioloRola: miolo ? miolo.scrollHeight > miolo.clientHeight + 1 : false, veuRola: janela.parentElement.scrollHeight > janela.parentElement.clientHeight + 1, paginaRolou: Math.round(scrollY),
    cabecalho: cabecalho ? { ...caixaDe(cabecalho), cruzaAJanela: cruza(caixaDe(cabecalho), caixaDe(janela)), clicavel: cabecalho.contains(centroDe(cabecalho)) } : null,
    painel: painel ? { ...caixaDe(painel), cruzaAJanela: cruza(caixaDe(painel), caixaDe(janela)), clicavel: painel.contains(centroDe(painel)), aberto: Boolean(corpoDoPainel) } : null,
  };
})()`;
const resumir = (medida) => `janela y ${medida.janela.topo} a ${medida.janela.base} (navegador ${medida.alturaDoNavegador}) · miolo rola ${medida.mioloRola ? 'sim' : 'não'} · véu rola ${medida.veuRola ? 'sim' : 'não'} · ${medida.quantasAcoes} ações`;
const problemasDosAlvos = (medida) => medida.alvos.filter((alvo) => !alvo.inteiroAVista || alvo.encobertoPor).map((alvo) => `${alvo.nome} y ${alvo.topo} a ${alvo.base}${alvo.inteiroAVista ? '' : ' FORA DA VISTA'}${alvo.encobertoPor ? ' ENCOBERTO por ' + alvo.encobertoPor : ''}`);
const prepararDeclarar = async () => {
  await clicar(porTexto('[aria-modal="true"] [role="radio"]', 'texto'), 'tipo texto').catch(() => {});
  await avaliar(`(() => { const grupos = [...document.querySelectorAll('[aria-modal="true"] [role="radiogroup"]')]; const papeis = grupos.length ? grupos[grupos.length - 1].querySelectorAll('[role="radio"]') : []; if (papeis[2]) papeis[2].click(); return papeis.length; })()`);
  await new Promise((resolver) => setTimeout(resolver, 250));
};

let falhas = 0; let avisos = 0; let cenasMedidas = 0;
// ---------- Controles (RP1) ----------
await enviar('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await abrir(enderecoInterativo(`${ADMINISTRADOR}/aplicacoes/site/chaves/ex2b/revogar`, 'light', 'default'));
const controlePositivo = await avaliar(medirJanela);
const positivoPassou = Boolean(controlePositivo) && problemasDosAlvos(controlePositivo).length === 0 && controlePositivo.quantasAcoes === 2;
dizer(`CONTROLE POSITIVO (revogar em 1440×900, título e 2 ações alcançáveis): ${positivoPassou ? 'passou' : 'NÃO PASSOU'} · ${controlePositivo ? resumir(controlePositivo) : 'a janela não abriu'}`);
await avaliar(`(() => { const tampa = document.createElement('div'); tampa.id = 'tampa-plantada'; tampa.style.cssText = 'position:fixed;top:0;left:0;right:0;height:400px;z-index:500;background:#fff'; document.body.appendChild(tampa); return true; })()`);
const controleDaTampa = await avaliar(medirJanela);
const tampaAcusada = problemasDosAlvos(controleDaTampa).some((problema) => problema.startsWith('título') && problema.includes('ENCOBERTO'));
dizer(`CONTROLE NEGATIVO 1 (faixa fixa plantada de 400 px por cima, z-index 500): ${tampaAcusada ? 'ACUSADO como devia → ' + problemasDosAlvos(controleDaTampa).join(' ; ') : 'NÃO ACUSOU'}`);
await enviar('Emulation.setDeviceMetricsOverride', { width: 1280, height: 200, deviceScaleFactor: 1, mobile: false });
await abrir(enderecoInterativo(`${ADMINISTRADOR}/aplicacoes/site/chaves/ex2b/revogar`, 'light', 'default'));
const controleBaixo = await avaliar(medirJanela);
const baixoAcusado = problemasDosAlvos(controleBaixo).some((problema) => problema.includes('FORA DA VISTA'));
dizer(`CONTROLE NEGATIVO 2 (janela de navegador de 200 px): ${baixoAcusado ? 'ACUSADO como devia → ' + problemasDosAlvos(controleBaixo).join(' ; ') : 'NÃO ACUSOU'} · ${resumir(controleBaixo)}`);
const medidaValida = positivoPassou && tampaAcusada && baixoAcusado;
dizer(medidaValida ? 'MEDIDA VÁLIDA: o positivo passou e os dois negativos foram acusados.\n' : 'MEDIDA INVÁLIDA\n');

// ---------- As cinco janelas, nos dois tamanhos, nos dois temas, nos estados que as deixam mais altas ----------
for (const [largura, altura] of [[1440, 900], [1280, 720]]) {
  await enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false });
  for (const tema of ['light', 'dark']) {
    for (const [nomeDaCena, rota] of CENAS) {
      for (const estado of ['default', 'error', 'offline']) {
        await abrir(enderecoInterativo(rota, tema, estado));
        if (nomeDaCena.startsWith('declarar')) await prepararDeclarar();
        const medida = await avaliar(medirJanela);
        const rotulo = `${largura}×${altura} ${tema} ${nomeDaCena} ${estado}`;
        if (!medida) { falhas++; dizer(`FAIL ${rotulo}: a janela não abriu`); continue; }
        cenasMedidas++;
        let problemas = problemasDosAlvos(medida);
        // Se o miolo rola, o Tab tem de trazer cada parada à vista: percorre e mede de novo título e ações no fim.
        if (medida.mioloRola || medida.veuRola) { for (let passo = 0; passo < 14; passo++) await tecla('Tab'); problemas = problemas.concat(problemasDosAlvos(await avaliar(medirJanela)).map((problema) => problema + ' (depois do Tab)')); }
        const cabecalhoPorCima = medida.cabecalho && medida.cabecalho.clicavel && medida.cabecalho.cruzaAJanela;
        const painelPorCimaDaJanela = medida.painel && medida.painel.cruzaAJanela;
        if (problemas.length) { falhas++; await foto(`${rodada}-veu-${nomeDaCena.replace(/[^a-z]+/g, '-')}-${estado}-${tema}-${largura}x${altura}`); }
        if (painelPorCimaDaJanela || cabecalhoPorCima) avisos++;
        dizer(`${problemas.length ? 'FAIL' : 'ok  '} ${rotulo}: ${resumir(medida)} · cabeçalho do showcase y ${medida.cabecalho?.topo} a ${medida.cabecalho?.base}, ${medida.cabecalho?.clicavel ? 'CLICÁVEL por cima do véu' : 'debaixo do véu'}${medida.cabecalho?.cruzaAJanela ? ', a janela entra na faixa dele' : ''} · painel flutuante fechado y ${medida.painel?.topo} a ${medida.painel?.base} x ${medida.painel?.esquerda} a ${medida.painel?.direita}, ${medida.painel?.clicavel ? 'clicável por cima do véu' : 'debaixo do véu'}${painelPorCimaDaJanela ? ', CRUZA a janela' : ''}${problemas.length ? '\n       ' + problemas.join('\n       ') : ''}`);
      }
    }
  }
  // O painel flutuante aberto por cima da janela mais larga e da mais alta: o que ele cobre, e o que o Esc fecha primeiro.
  for (const [nomeDaCena, rota] of [CENAS[2], CENAS[4], CENAS[3]]) {
    await abrir(enderecoInterativo(rota, 'light', 'default'));
    if (nomeDaCena.startsWith('declarar')) await prepararDeclarar();
    await clicar('document.querySelector(".painel-toggle")', 'abrir o painel flutuante');
    const comPainelAberto = await avaliar(medirJanela);
    const cobertos = comPainelAberto ? problemasDosAlvos(comPainelAberto) : ['a janela fechou ao abrir o painel'];
    await tecla('Escape');
    const depoisDeUmEsc = await avaliar(`({ painelAberto: Boolean(document.querySelector('.painel-corpo')), janelas: document.querySelectorAll('[aria-modal="true"]').length })`);
    const depoisDoEscOsAlvos = depoisDeUmEsc.janelas ? problemasDosAlvos(await avaliar(medirJanela)) : [];
    if (cobertos.length) avisos++;
    if (depoisDoEscOsAlvos.length) falhas++;
    dizer(`${depoisDoEscOsAlvos.length ? 'FAIL' : (cobertos.length ? 'AVISO' : 'ok  ')} ${largura}×${altura} ${nomeDaCena} com o painel flutuante ABERTO: painel y ${comPainelAberto?.painel?.topo} a ${comPainelAberto?.painel?.base} x ${comPainelAberto?.painel?.esquerda} a ${comPainelAberto?.painel?.direita}${comPainelAberto?.painel?.cruzaAJanela ? ', cruza a janela' : ', não cruza a janela'} · alvos cobertos enquanto aberto: ${cobertos.length ? cobertos.join(' ; ') : 'nenhum'} · depois de um Esc: painel ${depoisDeUmEsc.painelAberto ? 'aberto' : 'fechado'}, ${depoisDeUmEsc.janelas} janela(s)${depoisDoEscOsAlvos.length ? ' · AINDA cobertos: ' + depoisDoEscOsAlvos.join(' ; ') : ' · título e ações alcançáveis de novo'}`);
  }
}
dizer(`\nRESUMO: ${cenasMedidas} cenas medidas · falhas (título ou ação inalcançável ou encoberto): ${falhas} · avisos: ${avisos}${medidaValida ? '' : ' · MEDIDA INVÁLIDA'}`);
writeFileSync(`${PASTA}veu-interativo-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
