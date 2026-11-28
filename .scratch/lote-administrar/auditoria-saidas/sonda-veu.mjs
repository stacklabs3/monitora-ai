// Sonda: no modo interativo (sem print=1), quem são os elementos fixos da página e onde fica a janela de diálogo.
// Uso: node sonda-veu.mjs <rota-com-hash> [largura] [altura]
import { abrirNavegador } from './lib.mjs';
const { avaliar, abrir, fechar } = await abrirNavegador({ porta: 9473, largura: Number(process.argv[3]) || 1440, altura: Number(process.argv[4]) || 900 });
await abrir(`/?visao=painel&idioma=pt-BR${process.argv[2]}`);
console.log(await avaliar(`(() => {
  const descrever = (elemento) => { const caixa = elemento.getBoundingClientRect(); const estilo = getComputedStyle(elemento); return [elemento.tagName.toLowerCase() + (elemento.id ? '#' + elemento.id : '') + '.' + String(elemento.className).slice(0, 24), 'y ' + Math.round(caixa.top) + ' a ' + Math.round(caixa.bottom), 'x ' + Math.round(caixa.left) + ' a ' + Math.round(caixa.right), estilo.position, 'z ' + estilo.zIndex, 'overflowY ' + estilo.overflowY, 'rolavel ' + elemento.scrollHeight + '/' + elemento.clientHeight, estilo.transform !== 'none' ? 'transform' : '', estilo.contain !== 'none' ? 'contain ' + estilo.contain : '', (elemento.getAttribute('aria-label') || '').slice(0, 30)].join(' · '); };
  const linhas = ['janela ' + innerWidth + 'x' + innerHeight + ' · página rolável ' + document.documentElement.scrollHeight, '-- cadeia da janela de diálogo --'];
  let elemento = document.querySelector('[aria-modal="true"]');
  while (elemento && elemento !== document.documentElement) { linhas.push(descrever(elemento)); elemento = elemento.parentElement; }
  linhas.push('-- fixos e grudados da página --');
  for (const candidato of document.querySelectorAll('body *')) { const posicao = getComputedStyle(candidato).position; if ((posicao === 'fixed' || posicao === 'sticky') && candidato.checkVisibility()) linhas.push(descrever(candidato)); }
  return linhas.join('\\n');
})()`));
fechar();
