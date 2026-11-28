// Botão apagado (aria-disabled="true") não pode agir: clique real em cada um e comparação do retrato da tela.
// Também imprime o `_excluded` global que o Babel cria por script (a colisão que faz o apagado agir).
// Uso: node apagados.mjs <rodada> [novas|antigas|todas]
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const recorte = process.argv[3] || 'todas';
// Rodada 2: TEMA (light|dark) e PORTA vêm do ambiente; a saída leva o sufixo do recorte e do tema quando não são o padrão.
const tema = process.env.TEMA || 'light';
const sufixoDaSaida = `${rodada}${recorte === 'todas' ? '' : '-' + recorte}${tema === 'light' ? '' : '-' + tema}`;
const { avaliar, abrir, clicar, fechar } = await abrirNavegador({ porta: Number(process.env.PORTA || 9470) });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const ROTINAS_NOVAS = ['cadastrar-aplicacao', 'guardar-a-chave', 'revogar-chave', 'declarar-um-campo', 'ler-o-catalogo-como-investigador', 'conferir-a-saude-do-envio', 'execucao-que-sumiu', 'eventos-em-volta-da-perda'];
const ROTINAS_ANTIGAS = ['buscar-eventos', 'avisos-da-busca', 'ler-um-evento', 'filtrar-por-um-valor', 'ler-o-erro-do-evento', 'achar-a-tentativa', 'ler-a-linha-do-tempo', 'codigo-em-duas-tentativas', 'entrar-no-painel', 'ver-como-administrador'];
const ESTADOS_DAS_NOVAS = ['default', 'disabled', 'loading', 'offline', 'error', 'empty'];
const ESTADOS_DAS_ANTIGAS = ['disabled', 'offline'];

await abrir('/?listarPrints=todas');
const prints = JSON.parse(await avaliar('document.querySelector("#lista-de-prints").textContent'));
const telasPorRota = new Map();
for (const print of prints) {
  const rotina = print.arquivo.split('/')[0];
  const ehNova = ROTINAS_NOVAS.includes(rotina);
  if (!ehNova && !ROTINAS_ANTIGAS.includes(rotina)) continue;
  if ((recorte === 'novas' && !ehNova) || (recorte === 'antigas' && ehNova)) continue;
  const rota = print.endereco.slice(print.endereco.indexOf('#'));
  if (!telasPorRota.has(rota)) telasPorRota.set(rota, { nome: `${rotina}/${print.arquivo.split('/')[1].split('--')[0]}`, ehNova });
}

const retratoDaTela = `(() => JSON.stringify([location.hash, document.querySelector('#root').innerText,
  [...document.querySelectorAll('#root input')].map((campo) => campo.value).join('|'),
  document.querySelectorAll('[role=dialog],[role=alertdialog]').length,
  [...document.querySelectorAll('[aria-pressed],[aria-expanded],[aria-checked],[aria-current]')].map((elemento) => (elemento.getAttribute('aria-pressed') || '') + (elemento.getAttribute('aria-expanded') || '') + (elemento.getAttribute('aria-checked') || '') + (elemento.getAttribute('aria-current') || '')).join('')]))()`;
const marcarApagados = `(() => {
  const tiposVistos = new Set(); const apagados = [];
  [...document.querySelectorAll('#root [aria-disabled="true"], #root button:disabled')].forEach((elemento, indice) => {
    if (!elemento.checkVisibility()) return;
    // Com uma janela aberta, o que está atrás do véu não recebe o clique (o véu recebe e fecha a janela): fica de fora.
    if (document.querySelector('[aria-modal="true"]') && !elemento.closest('[aria-modal="true"]')) return;
    const nome = (elemento.getAttribute('aria-label') || elemento.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
    const dentroDeJanela = Boolean(elemento.closest('[aria-modal="true"]'));
    const tipo = (elemento.getAttribute('role') || elemento.tagName) + '|' + nome.replace(/[0-9]+/g, '#') + '|' + dentroDeJanela;
    if (tiposVistos.has(tipo)) return; tiposVistos.add(tipo);
    elemento.dataset.apagadoDaAuditoria = String(indice);
    apagados.push({ indice: String(indice), nome: (elemento.getAttribute('role') || elemento.tagName.toLowerCase()) + ' «' + nome + '»' + (dentroDeJanela ? ' (na janela)' : '') });
  });
  return apagados;
})()`;
const partesQueMudaram = (retratoAntes, retratoDepois) => {
  const [enderecoAntes, textoAntes, camposAntes, janelasAntes, marcasAntes] = JSON.parse(retratoAntes);
  const [enderecoDepois, textoDepois, camposDepois, janelasDepois, marcasDepois] = JSON.parse(retratoDepois);
  const mudancas = [];
  if (enderecoAntes !== enderecoDepois) mudancas.push(`endereço ${enderecoAntes.replace('#/painel/excurfly/producao/', '')} → ${enderecoDepois.replace('#/painel/excurfly/producao/', '')}`);
  if (janelasAntes !== janelasDepois) mudancas.push(`janelas ${janelasAntes} → ${janelasDepois}`);
  if (textoAntes !== textoDepois) mudancas.push('texto da tela');
  if (camposAntes !== camposDepois) mudancas.push('valor de campo');
  if (marcasAntes !== marcasDepois) mudancas.push('marcado/aberto');
  return mudancas;
};

// ---------- A colisão: o que cada script deixou no `_excluded` global ----------
await abrir('/?visao=painel&idioma=pt-BR#/painel/excurfly/producao/administrador/aplicacoes');
dizer('== `_excluded` global na página (Babel gera um por script, todos com o mesmo nome) ==');
dizer('  window._excluded  = ' + await avaliar('JSON.stringify(window._excluded)'));
dizer('  window._excluded2 = ' + await avaliar('JSON.stringify(window._excluded2)'));
dizer('  esperado por Press (ui.jsx:18): ["children","onClick","style","className","disabled"]');
dizer('  scripts transpilados que declaram _excluded: ' + await avaliar(`(async () => {
    const declaram = [];
    for (const marcaDeScript of document.querySelectorAll('script[type="text/babel"][src]')) {
      const fonte = await (await fetch(marcaDeScript.getAttribute('src'))).text();
      const transpilado = Babel.transform(fonte, { presets: ['react', 'env'] }).code;
      const declaracoes = transpilado.match(/_excluded[0-9]* = \\[[^\\]]*\\]/g);
      if (declaracoes) declaram.push(marcaDeScript.getAttribute('src').replace('components/', '').replace(/\\?.*/, '') + ': ' + declaracoes.join(' ; '));
    }
    return declaram.join(' || ');
  })()`));

// ---------- Controles (RP1) ----------
const CENA_DE_CONTROLE = '/?visao=painel&superficie=desktop&tema=' + tema + '&estado=default&print=1&idioma=pt-BR#/painel/excurfly/producao/administrador/aplicacoes';
await abrir(CENA_DE_CONTROLE);
let retratoAntes = await avaliar(retratoDaTela);
await clicar(`[...document.querySelectorAll('#root [role="button"]')].find((elemento) => elemento.textContent.trim() === 'Cadastrar aplicação')`, 'botão aceso');
let retratoDepois = await avaliar(retratoDaTela);
const controleNegativoAcusou = retratoAntes !== retratoDepois;
dizer(`\nCONTROLE NEGATIVO (botão aceso "Cadastrar aplicação", tem de ser acusado como "agiu"): ${controleNegativoAcusou ? 'ACUSADO como devia → ' + partesQueMudaram(retratoAntes, retratoDepois).join(' · ') : 'NÃO ACUSOU: medida inválida'}`);
await abrir(CENA_DE_CONTROLE);
await avaliar(`(() => { const inerte = document.createElement('div'); inerte.id = 'controle-inerte'; inerte.setAttribute('role', 'button'); inerte.setAttribute('aria-disabled', 'true'); inerte.textContent = 'CONTROLE apagado de verdade'; inerte.style.cssText = 'position:fixed;top:0;left:0;z-index:999;padding:8px;background:#fff;color:#000'; document.body.appendChild(inerte); return true; })()`);
retratoAntes = await avaliar(retratoDaTela);
await clicar('document.querySelector("#controle-inerte")', 'controle inerte');
retratoDepois = await avaliar(retratoDaTela);
const controlePositivoPassou = retratoAntes === retratoDepois;
dizer(`CONTROLE POSITIVO (elemento apagado sem manipulador, não pode ser acusado): ${controlePositivoPassou ? 'passou (nada mudou)' : 'ACUSADO À TOA: medida inválida'}`);
// Rodada 2 (RP1): um apagado que age, plantado dentro do #root, tem de ser achado pela mesma marcação e acusado pelo mesmo clique.
await abrir(CENA_DE_CONTROLE);
await avaliar(`(() => { const plantado = document.createElement('div'); plantado.id = 'controle-apagado-que-age'; plantado.setAttribute('role', 'button'); plantado.setAttribute('aria-disabled', 'true'); plantado.textContent = 'CONTROLE apagado que age'; plantado.style.cssText = 'position:fixed;top:0;left:0;z-index:999;padding:8px;background:#fff;color:#000'; plantado.addEventListener('click', () => { location.hash = '#/painel/excurfly/producao/administrador/saude'; }); document.querySelector('#root').appendChild(plantado); return true; })()`);
const marcadosNoControle = await avaliar(marcarApagados);
const plantadoMarcado = marcadosNoControle.find((apagado) => apagado.nome.includes('CONTROLE apagado que age'));
retratoAntes = await avaliar(retratoDaTela);
if (plantadoMarcado) await clicar(`document.querySelector('[data-apagado-da-auditoria="${plantadoMarcado.indice}"]')`, 'apagado que age, plantado');
retratoDepois = await avaliar(retratoDaTela);
const controlePlantadoAcusou = Boolean(plantadoMarcado) && retratoAntes !== retratoDepois;
dizer(`CONTROLE NEGATIVO PLANTADO (aria-disabled="true" com manipulador de clique, tem de ser marcado e acusado): ${controlePlantadoAcusou ? 'ACUSADO como devia → ' + partesQueMudaram(retratoAntes, retratoDepois).join(' · ') : 'NÃO ACUSOU: medida inválida'}`);
if (!controleNegativoAcusou || !controlePositivoPassou || !controlePlantadoAcusou) { dizer('MEDIDA INVÁLIDA'); writeFileSync(`${PASTA}apagados-${sufixoDaSaida}.txt`, linhas.join('\n') + '\n'); fechar(); process.exit(2); }
dizer('MEDIDA VÁLIDA: os controles negativos (aceso e apagado plantado que age) foram acusados e o positivo passou. Tema: ' + tema);

// ---------- Cada tela, cada estado, cada tipo de botão apagado ----------
let cliquesFeitos = 0; let apagadosQueAgiram = 0; const resumoDosQueAgiram = new Map(); let primeiroQueAgiu = null;
for (const [rota, tela] of telasPorRota) {
  for (const estado of (tela.ehNova ? ESTADOS_DAS_NOVAS : ESTADOS_DAS_ANTIGAS)) {
    const endereco = `/?visao=painel&superficie=desktop&tema=${tema}&estado=${estado}&print=1&idioma=pt-BR${rota}`;
    await abrir(endereco);
    const apagados = await avaliar(marcarApagados);
    const agiramNaCena = [];
    for (const apagado of apagados) {
      await abrir(endereco); await avaliar(marcarApagados);
      const antesDoClique = await avaliar(retratoDaTela);
      try { await clicar(`document.querySelector('[data-apagado-da-auditoria="${apagado.indice}"]')`, apagado.nome); } catch { continue; }
      await new Promise((resolver) => setTimeout(resolver, 250));
      const depoisDoClique = await avaliar(retratoDaTela);
      cliquesFeitos++;
      if (antesDoClique !== depoisDoClique) {
        apagadosQueAgiram++;
        const mudancas = partesQueMudaram(antesDoClique, depoisDoClique).join(' · ');
        agiramNaCena.push(`${apagado.nome} ⇒ ${mudancas}`);
        const chaveDoResumo = `${tela.ehNova ? 'NOVA' : 'ANTIGA'} ${apagado.nome}`;
        resumoDosQueAgiram.set(chaveDoResumo, (resumoDosQueAgiram.get(chaveDoResumo) || []).concat(`${tela.nome} ${estado}`));
        if (!primeiroQueAgiu) primeiroQueAgiu = { endereco, indice: apagado.indice, nome: apagado.nome };
      }
    }
    dizer(`${agiramNaCena.length ? 'FAIL' : 'ok  '} ${tela.nome} ${estado}: ${apagados.length} tipos de botão apagado, agiram ${agiramNaCena.length}${agiramNaCena.length ? '\n       ' + agiramNaCena.join('\n       ') : ''}`);
  }
}
dizer(`\nRESUMO: ${cliquesFeitos} cliques reais em botões apagados · agiram ${apagadosQueAgiram}`);
for (const [nomeDoApagado, cenas] of resumoDosQueAgiram) dizer(`  AGIU ${nomeDoApagado} em ${cenas.length} cenas (ex.: ${cenas.slice(0, 3).join(' ; ')})`);

// ---------- A causa: com o `_excluded` de Press de volta, o mesmo clique não age ----------
if (primeiroQueAgiu) {
  await abrir(primeiroQueAgiu.endereco);
  await avaliar(`(() => { window._excluded = ['children', 'onClick', 'style', 'className', 'disabled']; return true; })()`);
  // Força um novo desenho para Press reler o _excluded: sai da rota e volta.
  await avaliar(`(async () => { const enderecoDaCena = location.hash; location.hash = '#/painel/excurfly/producao/administrador/saude'; await new Promise((resolver) => setTimeout(resolver, 400)); location.hash = enderecoDaCena; await new Promise((resolver) => setTimeout(resolver, 600)); return true; })()`);
  await avaliar(marcarApagados);
  const antesComOConserto = await avaliar(retratoDaTela);
  await clicar(`document.querySelector('[data-apagado-da-auditoria="${primeiroQueAgiu.indice}"]')`, primeiroQueAgiu.nome);
  const depoisComOConserto = await avaliar(retratoDaTela);
  dizer(`\nCAUSA: com window._excluded reposto para a lista de Press, o clique em ${primeiroQueAgiu.nome} ${antesComOConserto === depoisComOConserto ? 'NÃO age mais (a colisão é a causa)' : 'AINDA age (há outra causa; ver se a tela redesenhou)'}`);
}
writeFileSync(`${PASTA}apagados-${sufixoDaSaida}.txt`, linhas.join('\n') + '\n');
fechar();
