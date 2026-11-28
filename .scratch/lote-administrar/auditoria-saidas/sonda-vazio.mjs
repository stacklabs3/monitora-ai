// Sonda (F4): o texto do vazio da tentativa, como o print o mostra, para ler o período olhado e os horários das perdas.
import { abrirNavegador } from './lib.mjs';
const { avaliar, abrir, fechar } = await abrirNavegador({ porta: 9483 });
await abrir('/?listarPrints=todas');
const prints = JSON.parse(await avaliar('document.querySelector("#lista-de-prints").textContent'));
const printDoVazio = prints.find((print) => print.arquivo.startsWith('achar-a-tentativa/03-tentativa_investigador--desktop--light--empty'));
console.log('endereço do print: ' + printDoVazio.endereco);
await abrir(printDoVazio.endereco.replace(/^https?:\/\/[^/]+/, ''));
console.log(await avaliar(`(document.querySelector('main main') || document.querySelector('main')).innerText.replace(/\\n+/g, ' | ').slice(0, 1400)`));
fechar();
