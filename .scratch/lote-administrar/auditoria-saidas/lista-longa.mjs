// A janela de diálogo aparece à vista de quem a abriu? Mede a caixa da janela contra a janela do navegador
// (a) em tela baixa com os dados do cenário, (b) com lista longa (aplicações acrescentadas só na memória da página)
// e (c) na abertura da busca, que é uma página longa. Não edita arquivo nenhum do protótipo.
// Uso: node lista-longa.mjs <rodada>
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const { avaliar, abrir, clicar, tecla, foto, enviar, fechar } = await abrirNavegador({ porta: 9475 });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
let falhas = 0;
const ADMINISTRADOR = '#/painel/excurfly/producao/administrador'; const INVESTIGADOR = '#/painel/excurfly/producao/investigador';
const cena = (rota, estado = 'default') => `/?visao=painel&superficie=desktop&tema=light&estado=${estado}&print=1&idioma=pt-BR${rota}`;
const mudarJanelaDoNavegador = async (largura, altura) => { await enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false }); await new Promise((resolver) => setTimeout(resolver, 250)); };
const medirJanela = `(() => {
  const janela = document.querySelector('[aria-modal="true"]');
  if (!janela) return { aberta: false };
  const caixa = janela.getBoundingClientRect();
  const alturaVisivel = Math.max(0, Math.min(caixa.bottom, innerHeight) - Math.max(caixa.top, 0));
  const botoes = [...janela.querySelectorAll('[role="button"], input')].map((controle) => { const caixaDoControle = controle.getBoundingClientRect(); return { nome: (controle.getAttribute('aria-label') || controle.innerText || controle.placeholder || '').replace(/\\s+/g, ' ').slice(0, 28), aVista: caixaDoControle.top >= 0 && caixaDoControle.bottom <= innerHeight }; });
  return { aberta: true, topo: Math.round(caixa.top), base: Math.round(caixa.bottom), alturaDaJanelaDoNavegador: innerHeight, alturaDaPagina: document.documentElement.scrollHeight, rolagemDaPagina: Math.round(document.scrollingElement.scrollTop || document.body.scrollTop),
    porcentagemAVista: Math.round(100 * alturaVisivel / caixa.height), foraDaVista: botoes.filter((controle) => !controle.aVista).map((controle) => controle.nome), comFoco: (document.activeElement.getAttribute('aria-label') || document.activeElement.innerText || document.activeElement.tagName).replace(/\\s+/g, ' ').slice(0, 30),
    focoAVista: (() => { const caixaDoFoco = document.activeElement.getBoundingClientRect(); return caixaDoFoco.top >= 0 && caixaDoFoco.bottom <= innerHeight; })() };
})()`;
const relatar = (nome, medida, esperaReprovar = false) => {
  const inteiraAVista = medida.aberta && medida.porcentagemAVista === 100 && medida.foraDaVista.length === 0;
  if (esperaReprovar) { dizer(`CONTROLE NEGATIVO ${nome}: ${inteiraAVista ? 'NÃO REPROVOU' : 'REPROVADO como devia'} (${JSON.stringify(medida)})`); return !inteiraAVista; }
  if (!inteiraAVista) falhas++;
  dizer(`${inteiraAVista ? 'PASS' : 'FAIL'} ${nome}: ${medida.aberta ? `janela de y ${medida.topo} a ${medida.base} numa janela de navegador de ${medida.alturaDaJanelaDoNavegador} px (página de ${medida.alturaDaPagina} px, rolada ${medida.rolagemDaPagina}) · ${medida.porcentagemAVista}% à vista · controles fora da vista: ${medida.foraDaVista.join(', ') || 'nenhum'} · foco em «${medida.comFoco}» ${medida.focoAVista ? 'à vista' : 'FORA da vista'}` : 'a janela não abriu'}`);
  return inteiraAVista;
};

// ---------- Controles (RP1) ----------
await abrir(cena(`${ADMINISTRADOR}/aplicacoes`));
await avaliar(`(() => { const falsa = document.createElement('div'); falsa.setAttribute('aria-modal', 'true'); falsa.id = 'controle-fora-da-vista'; falsa.style.cssText = 'position:absolute;top:2400px;left:100px;width:300px;height:200px;background:#fff'; falsa.innerHTML = '<div role="button">CONTROLE</div>'; document.body.appendChild(falsa); return true; })()`);
const controleNegativoValeu = relatar('janela plantada a 2400 px do topo', await avaliar(medirJanela), true);
await abrir(cena(`${ADMINISTRADOR}/aplicacoes/site/chaves/ex2b/revogar`));
const controlePositivoValeu = relatar('CONTROLE POSITIVO: revogar em 1440×900 com os dados do cenário', await avaliar(medirJanela));
dizer(`MEDIDA ${controleNegativoValeu && controlePositivoValeu ? 'VÁLIDA' : 'INVÁLIDA'}\n`);
if (!(controleNegativoValeu && controlePositivoValeu)) { writeFileSync(`${PASTA}lista-longa-${rodada}.txt`, linhas.join('\n') + '\n'); fechar(); process.exit(2); }

// ---------- (a) Tela baixa, dados do cenário, abrindo com clique real ----------
for (const [largura, altura] of [[1440, 900], [1280, 720]]) {
  await mudarJanelaDoNavegador(largura, altura);
  await abrir(cena(`${ADMINISTRADOR}/aplicacoes`));
  await clicar('document.querySelector("[aria-label=\\"Revogar a chave servidor dos webhooks de Webhooks\\"]")', 'revogar dos webhooks');
  relatar(`${largura}×${altura} aplicações: "Revogar" da última aplicação (Webhooks)`, await avaliar(medirJanela));
  await abrir(cena(`${ADMINISTRADOR}/aplicacoes`));
  await clicar('[...document.querySelectorAll(\'#root [role="button"]\')].find((elemento) => elemento.textContent.trim() === "Cadastrar aplicação")', 'cadastrar');
  relatar(`${largura}×${altura} aplicações: "Cadastrar aplicação"`, await avaliar(medirJanela));
  await abrir(cena(`${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a/gerada`));
  relatar(`${largura}×${altura} chave gerada (4 aplicações na lista)`, await avaliar(medirJanela));
  await abrir(cena(`${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a/gerada`, 'offline'));
  relatar(`${largura}×${altura} chave gerada, sem internet`, await avaliar(medirJanela));
  await abrir(cena(`${ADMINISTRADOR}/catalogo`));
  await clicar('document.querySelector("[aria-label=\\"Declarar o campo installmentCount\\"]")', 'declarar');
  relatar(`${largura}×${altura} catálogo: "Declarar" installmentCount`, await avaliar(medirJanela));
  await abrir(cena(`${ADMINISTRADOR}/catalogo`));
  await clicar('[...document.querySelectorAll("[aria-label^=\\"Declarar o campo \\"]")].pop()', 'declarar o último');
  relatar(`${largura}×${altura} catálogo: "Declarar" do último campo não declarado da lista`, await avaliar(medirJanela));
  await abrir(cena(INVESTIGADOR));
  await tecla('?');
  relatar(`${largura}×${altura} abertura da busca (página longa): janela de atalhos com "?"`, await avaliar(medirJanela));
  if (altura === 720) await foto(`${rodada}-atalhos-na-abertura-da-busca-${largura}x${altura}`);
}
await mudarJanelaDoNavegador(1440, 900);

// ---------- (b) Lista longa: 9 aplicações a mais, só na memória da página ----------
await abrir(cena(`${ADMINISTRADOR}/saude`));
const quantasAplicacoes = await avaliar(`(() => {
  const doAmbiente = APLICACOES_CADASTRADAS.excurfly.producao;
  for (let indice = 1; indice <= 9; indice++) doAmbiente.push({ id: 'ensaio-' + indice, nome: 'Aplicação de ensaio ' + indice, chaves: [{ id: 'en' + indice + 'x', apelido: 'servidor de ensaio ' + indice, criadaEm: doAmbiente[0].chaves[0].criadaEm, criadaPor: doAmbiente[0].chaves[0].criadaPor, ultimoEnvioEm: null }] });
  location.hash = '${ADMINISTRADOR}/aplicacoes';
  return doAmbiente.length;
})()`);
await new Promise((resolver) => setTimeout(resolver, 700));
dizer(`\nLista longa: ${quantasAplicacoes} aplicações em produção (9 acrescentadas na memória da página, sem tocar em arquivo)`);
await clicar('document.querySelector("[aria-label=\\"Revogar a chave servidor de ensaio 9 de Aplicação de ensaio 9\\"]")', 'revogar a última');
relatar('1440×900 lista longa: "Revogar" da última aplicação', await avaliar(medirJanela));
await foto(`${rodada}-lista-longa-revogar-a-ultima`);
await tecla('Escape');
await avaliar('(document.scrollingElement.scrollTop = 0, document.body.scrollTop = 0, true)');
await new Promise((resolver) => setTimeout(resolver, 300));
await clicar('[...document.querySelectorAll(\'#root [role="button"]\')].find((elemento) => elemento.textContent.trim() === "Cadastrar aplicação")', 'cadastrar no topo');
relatar('1440×900 lista longa: "Cadastrar aplicação" (botão no topo da página)', await avaliar(medirJanela));
await foto(`${rodada}-lista-longa-cadastrar-no-topo`);
dizer(`\nfalhas: ${falhas}`);
writeFileSync(`${PASTA}lista-longa-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
