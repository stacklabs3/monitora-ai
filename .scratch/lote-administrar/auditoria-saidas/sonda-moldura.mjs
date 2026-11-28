// Sonda: a cadeia de ancestrais da janela de diálogo (tamanho e rolagem), para saber onde ela se ancora e quem rola.
// Uso: node sonda-moldura.mjs <rota-com-hash> [estado] [largura] [altura]
import { abrirNavegador } from './lib.mjs';
const { avaliar, abrir, fechar } = await abrirNavegador({ porta: 9473, largura: Number(process.argv[4]) || 1440, altura: Number(process.argv[5]) || 900 });
await abrir(`/?visao=painel&superficie=desktop&tema=light&estado=${process.argv[3] || 'default'}&print=1&idioma=pt-BR${process.argv[2]}`);
console.log(await avaliar(`(() => {
  const cadeia = []; let elemento = document.querySelector('[aria-modal="true"]');
  while (elemento && elemento !== document.documentElement) {
    const caixa = elemento.getBoundingClientRect(); const estilo = getComputedStyle(elemento);
    cadeia.push([elemento.tagName.toLowerCase() + '.' + String(elemento.className).slice(0, 30), 'y ' + Math.round(caixa.top) + ' a ' + Math.round(caixa.bottom), 'x ' + Math.round(caixa.left) + ' a ' + Math.round(caixa.right), estilo.position, 'overflowY ' + estilo.overflowY, 'rolavel ' + elemento.scrollHeight + '/' + elemento.clientHeight, estilo.transform !== 'none' ? 'transform ' + estilo.transform : ''].join(' · '));
    elemento = elemento.parentElement;
  }
  return cadeia.join('\\n');
})()`));
fechar();
