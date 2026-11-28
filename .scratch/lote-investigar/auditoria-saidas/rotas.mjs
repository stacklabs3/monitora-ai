// Rotas do papel Administrador que o lote mapeou (mesma tela, fora de rotina) abrem sem erro? E os prints batem com a lista?
import { existsSync, writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const { avaliar, abrir, registros, fechar } = await abrirNavegador({ porta: 9373 });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const A = '#/painel/excurfly/producao/administrador';
const B = 'p=1h;f=reservationId:e:R-1042';
for (const rota of [`${A}/eventos/${B}`, `${A}/eventos/${B}/evento/ev-1042-06`, `${A}/eventos/${B}/evento/ev-1042-06/erro`, `${A}/tentativas`, `${A}/tentativas/por/cliente/conta-7/1h`, `${A}/tentativas/reservationId/R-1042`, `${A}/tentativas/reservationId/R-1042/evento/ev-1042-05`, `${A}/tentativas/reservationId/R-1042/secao/sem-vinculo`]) {
  const antes = registros.length;
  await abrir(`/?visao=painel&idioma=pt-BR&print=1${rota}`);
  const medida = await avaliar(`({ erro: document.querySelector('#root').innerText.includes('Render error'), papel: [...document.querySelectorAll('[role=radio][aria-checked=true]')].map((el) => el.innerText).join(','), letras: document.querySelector('#root').innerText.length, hash: location.hash })`);
  const novos = registros.slice(antes).filter((registro) => !registro.includes('Babel') && !registro.includes('favicon'));
  dizer(`${!medida.erro && novos.length === 0 && medida.papel.includes('Administrador') && medida.hash === rota ? 'PASS' : 'FAIL'} ${rota.slice(36)}: papel «${medida.papel}» · ${medida.letras} letras · console ${novos.length}`);
}
await abrir('/?listarPrints=todas');
const prints = JSON.parse(await avaliar('document.querySelector("#lista-de-prints").textContent'));
const pasta = process.argv[2];
const faltando = prints.filter((print) => !existsSync(`${pasta}/${print.arquivo}`)).map((print) => print.arquivo);
dizer(`prints esperados (listarPrints=todas): ${prints.length} · faltando no repositório: ${faltando.length} ${faltando.slice(0, 5).join(', ')}`);
writeFileSync(`${PASTA}rotas-rodada2.txt`, linhas.join('\n') + '\n');
fechar();
