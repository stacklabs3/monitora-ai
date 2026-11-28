// Sonda: imprime as linhas do texto de uma tela que casam com uma expressão. Uso: node sonda-texto.mjs <expressão> <rota> [rota...]
import { abrirNavegador } from './lib.mjs';
const { avaliar, abrir, fechar } = await abrirNavegador({ porta: 9477 });
const expressao = new RegExp(process.argv[2], 'i');
for (const rota of process.argv.slice(3)) {
  await abrir(`/?visao=painel&superficie=desktop&tema=light&estado=default&print=1&idioma=pt-BR${rota}`);
  const texto = await avaliar('document.querySelector("#root").innerText');
  console.log('== ' + rota.replace('#/painel/excurfly/', ''));
  for (const linhaDoTexto of texto.split('\n')) if (expressao.test(linhaDoTexto)) console.log('   ' + linhaDoTexto.replace(/\s+/g, ' ').slice(0, 260));
}
fechar();
