// Com uma janela de diálogo aberta, os atalhos de uma tecla da casca ("?" e "/") não podem agir por trás dela nem roubar o que se digita.
// Uso: node atalhos-na-janela.mjs <rodada>
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const { avaliar, abrir, clicar, tecla, fechar } = await abrirNavegador({ porta: 9479 });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const ADMINISTRADOR = '#/painel/excurfly/producao/administrador';
const cena = (rota) => `/?visao=painel&superficie=desktop&tema=light&estado=default&print=1&idioma=pt-BR${rota}`;
const retrato = `(() => ({ janelas: document.querySelectorAll('[aria-modal="true"]').length, titulos: [...document.querySelectorAll('[aria-modal="true"] h2')].map((titulo) => titulo.textContent.slice(0, 40)).join(' | '), endereco: location.hash.replace('${ADMINISTRADOR}', ''), foco: (document.activeElement.getAttribute('aria-label') || document.activeElement.placeholder || document.activeElement.innerText || document.activeElement.tagName).replace(/\\s+/g, ' ').slice(0, 40), valorDoCampo: document.activeElement.value ?? null }))()`;
// Controle (RP1): fora de janela, "?" tem de abrir os atalhos (o ensaio enxerga o atalho agir).
await abrir(cena(`${ADMINISTRADOR}/aplicacoes`));
await tecla('?');
const controle = await avaliar(retrato);
dizer(`CONTROLE (sem janela aberta, "?" abre os atalhos): janelas ${controle.janelas} «${controle.titulos}» => ${controle.janelas === 1 ? 'o ensaio enxerga o atalho agir' : 'NÃO ENXERGA: medida inválida'}`);
let falhas = 0;
for (const [nomeDaCena, rota] of [['cadastro, foco no campo do nome', `${ADMINISTRADOR}/aplicacoes/nova`], ['revogar, foco em Cancelar', `${ADMINISTRADOR}/aplicacoes/site/chaves/ex2b/revogar`], ['chave gerada, foco em Copiar', `${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a/gerada`], ['declarar, foco na janela', `${ADMINISTRADOR}/catalogo/installmentCount/declarar`]]) {
  for (const teclaDoAtalho of ['?', '/']) {
    await abrir(cena(rota));
    const antes = await avaliar(retrato);
    await tecla(teclaDoAtalho);
    const depois = await avaliar(retrato);
    const digitouNoCampo = antes.valorDoCampo !== null && depois.valorDoCampo === teclaDoAtalho;
    const nadaMudou = depois.janelas === antes.janelas && depois.endereco === antes.endereco && depois.foco === antes.foco;
    const passou = (antes.valorDoCampo !== null ? digitouNoCampo : true) && nadaMudou;
    if (!passou) falhas++;
    dizer(`${passou ? 'PASS' : 'FAIL'} ${nomeDaCena} · tecla "${teclaDoAtalho}": janelas ${antes.janelas} → ${depois.janelas} «${depois.titulos}» · foco «${antes.foco}» → «${depois.foco}» · endereço ${depois.endereco}${antes.valorDoCampo !== null ? ' · campo ficou com «' + depois.valorDoCampo + '»' : ''}`);
  }
}
// Rodada 2: o ensaio antigo pressupunha duas janelas empilhadas, que a correção não deixa mais existir pelo teclado.
// O ensaio certo: a janela é aberta por um clique real (para haver a quem devolver o foco); "?" e "/" não abrem outra;
// o Tab fica nela; continua existindo exatamente 1 aria-modal; um Esc fecha só ela e devolve o foco a quem abriu.
const ondeEstaOFoco = `(() => { const janelaDoFoco = document.activeElement.closest('[aria-modal="true"]'); return (janelaDoFoco ? '«' + janelaDoFoco.querySelector('h2').textContent.slice(0, 26) + '»' : 'fora de janela') + ' › ' + (document.activeElement.getAttribute('aria-label') || document.activeElement.innerText || document.activeElement.tagName).replace(/\\s+/g, ' ').slice(0, 30); })()`;
const quantasJanelas = `document.querySelectorAll('[aria-modal="true"]').length`;
const BOTAO_REVOGAR = `[...document.querySelectorAll('#root [role="button"]')].find((elemento) => elemento.textContent.trim() === 'Revogar' && elemento.getAttribute('aria-disabled') !== 'true')`;
const BOTAO_DOS_ATALHOS = `document.querySelector('#root [role="button"][aria-haspopup="dialog"]')`;
const abrirRevogarPeloClique = async () => {
  await abrir(cena(`${ADMINISTRADOR}/aplicacoes`));
  await avaliar(`(() => { ${BOTAO_REVOGAR}.dataset.quemAbriuNoEnsaio = 'sim'; ${BOTAO_REVOGAR}.focus(); return true; })()`);
  await clicar(`document.querySelector('[data-quem-abriu-no-ensaio]')`, 'Revogar da lista');
};
// O que o ensaio mede, numa função só, para o controle negativo passar pela mesma régua.
const ensaioDeUmaJanelaSo = async (nomeDoEnsaio, { forcarAtalhosPorCima }) => {
  await abrirRevogarPeloClique();
  const janelasAoAbrir = await avaliar(quantasJanelas);
  if (forcarAtalhosPorCima) { await avaliar(`(() => { ${BOTAO_DOS_ATALHOS}.click(); return true; })()`); await new Promise((resolver) => setTimeout(resolver, 300)); }
  await tecla('?'); await tecla('/');
  const janelasDepoisDosAtalhos = await avaliar(quantasJanelas);
  const titulosDepoisDosAtalhos = (await avaliar(retrato)).titulos;
  const focos = [await avaliar(ondeEstaOFoco)];
  for (let vez = 0; vez < 3; vez++) { await tecla('Tab'); focos.push(await avaliar(ondeEstaOFoco)); }
  const tabFicouNaJanelaDeRevogar = focos.every((focoLido) => focoLido.startsWith('«Revogar'));
  await tecla('Escape');
  const depoisDoEsc = await avaliar(retrato);
  const focoVoltouAQuemAbriu = await avaliar(`document.activeElement === document.querySelector('[data-quem-abriu-no-ensaio]')`);
  const passou = janelasAoAbrir === 1 && janelasDepoisDosAtalhos === 1 && tabFicouNaJanelaDeRevogar && depoisDoEsc.janelas === 0 && depoisDoEsc.endereco === '/aplicacoes' && focoVoltouAQuemAbriu;
  dizer(`${nomeDoEnsaio}: ao abrir ${janelasAoAbrir} janela · depois de "?" e "/" ${janelasDepoisDosAtalhos} janela(s) «${titulosDepoisDosAtalhos}» · Tab três vezes → ${focos.join(' → ')} · depois de um Esc: ${depoisDoEsc.janelas} janela(s) «${depoisDoEsc.titulos}» · endereço ${depoisDoEsc.endereco} · foco de volta em quem abriu: ${focoVoltouAQuemAbriu ? 'sim' : 'não'} («${depoisDoEsc.foco}»)`);
  return { passou, janelasDepoisDosAtalhos, depoisDoEsc };
};
const ensaioReal = await ensaioDeUmaJanelaSo('ENSAIO revogar aberta pelo clique, "?" e "/" pelo teclado', { forcarAtalhosPorCima: false });
if (!ensaioReal.passou) falhas++;
dizer(`${ensaioReal.passou ? 'PASS' : 'FAIL'} com uma janela aberta, "?" e "/" não abrem outra; 1 aria-modal; Esc fecha só ela e devolve o foco`);
// Controle negativo (RP1): os atalhos abertos à força por cima (clique sintético no botão da casca, que o véu taparia) têm de fazer o mesmo ensaio reprovar com 2 janelas.
const ensaioForcado = await ensaioDeUmaJanelaSo('CONTROLE NEGATIVO atalhos abertos à força por cima de revogar', { forcarAtalhosPorCima: true });
const controleNegativoReprovou = !ensaioForcado.passou && ensaioForcado.janelasDepoisDosAtalhos === 2;
dizer(`CONTROLE NEGATIVO: ${controleNegativoReprovou ? 'REPROVADO como devia (o ensaio acusa 2 janelas)' : 'NÃO REPROVOU: medida inválida'}`);
// De brinde, a guarda de ui.jsx: com as duas empilhadas à força, um Esc fecha só a de cima.
const escFechouSoADeCima = ensaioForcado.depoisDoEsc.janelas === 1 && ensaioForcado.depoisDoEsc.titulos.startsWith('Revogar');
if (!escFechouSoADeCima) falhas++;
dizer(`${escFechouSoADeCima ? 'PASS' : 'FAIL'} empilhadas à força, um Esc fecha só a de cima: sobrou ${ensaioForcado.depoisDoEsc.janelas} «${ensaioForcado.depoisDoEsc.titulos}»`);
// A chave gerada não fecha por Esc (de propósito): "?" e "/" não abrem outra e o Esc deixa 1 janela, a mesma.
await abrir(cena(`${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a/gerada`));
await tecla('?'); await tecla('/');
const chaveDepoisDosAtalhos = await avaliar(retrato);
await tecla('Escape');
const chaveDepoisDoEsc = await avaliar(retrato);
const chaveGeradaPassou = chaveDepoisDosAtalhos.janelas === 1 && chaveDepoisDoEsc.janelas === 1 && chaveDepoisDoEsc.titulos.startsWith('Chave de envio');
if (!chaveGeradaPassou) falhas++;
dizer(`${chaveGeradaPassou ? 'PASS' : 'FAIL'} chave gerada: depois de "?" e "/" ${chaveDepoisDosAtalhos.janelas} janela · depois de um Esc ${chaveDepoisDoEsc.janelas} «${chaveDepoisDoEsc.titulos}» (esta só fecha pelo botão)`);
if (controle.janelas !== 1 || !controleNegativoReprovou) { dizer('MEDIDA INVÁLIDA'); falhas++; } else dizer('MEDIDA VÁLIDA: o controle positivo (sem janela, "?" abre os atalhos) passou e o negativo (atalhos à força por cima) reprovou.');
dizer(`falhas: ${falhas}`);
writeFileSync(`${PASTA}atalhos-na-janela-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
