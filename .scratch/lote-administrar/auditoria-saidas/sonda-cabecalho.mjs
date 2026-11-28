// Sonda: a janela de declarar no modo interativo, como abre (sem escolher nada) e na forma mais alta, com foto.
// Uso: node sonda-cabecalho.mjs <largura> <altura>
import { abrirNavegador, porTexto } from './lib.mjs';
const largura = Number(process.argv[2]) || 1280; const altura = Number(process.argv[3]) || 720;
const { avaliar, abrir, clicar, foto, fechar } = await abrirNavegador({ porta: 9482, largura, altura });
const ler = `(() => { const janela = document.querySelector('[aria-modal="true"]'); const titulo = janela.querySelector('h2').getBoundingClientRect(); const cabecalho = document.querySelector('.showcase-header'); const estiloDoCabecalho = getComputedStyle(cabecalho); const noTitulo = document.elementFromPoint(titulo.left + titulo.width / 2, titulo.top + titulo.height / 2); return 'janela y ' + Math.round(janela.getBoundingClientRect().top) + ' a ' + Math.round(janela.getBoundingClientRect().bottom) + ' · título y ' + Math.round(titulo.top) + ' a ' + Math.round(titulo.bottom) + ' · no centro do título está ' + noTitulo.tagName.toLowerCase() + '.' + String(noTitulo.className).slice(0, 20) + ' · cabeçalho: position ' + estiloDoCabecalho.position + ', z-index ' + estiloDoCabecalho.zIndex + ', y ' + Math.round(cabecalho.getBoundingClientRect().top) + ' a ' + Math.round(cabecalho.getBoundingClientRect().bottom); })()`;
await abrir('/?visao=painel&tema=light&estado=default&idioma=pt-BR#/painel/excurfly/producao/administrador/catalogo/installmentCount/declarar');
console.log(`${largura}×${altura} declarar como abre: ` + await avaliar(ler));
await clicar(porTexto('[aria-modal="true"] [role="radio"]', 'texto'), 'tipo texto');
console.log(`${largura}×${altura} declarar com tipo texto: ` + await avaliar(ler));
await avaliar(`(() => { const grupos = [...document.querySelectorAll('[aria-modal="true"] [role="radiogroup"]')]; grupos[grupos.length - 1].querySelectorAll('[role="radio"]')[2].click(); return true; })()`);
await new Promise((resolver) => setTimeout(resolver, 300));
console.log(`${largura}×${altura} declarar com tipo texto e papel que liga eventos: ` + await avaliar(ler));
await foto(`rodada2-declarar-sob-o-cabecalho-${largura}x${altura}`);
fechar();
