// Rodada 2, regressão da correção: sem internet, a linha de evento se declara indisponível (aria-disabled), como o lote
// Investigar aprovou (busca.jsx:798-802)? Compara a versão de hoje (8771) com a de antes da correção (37378b1, servida na 8772).
// Controle negativo (RP1): a versão de antes tem de mostrar as linhas com aria-disabled (a sonda enxerga o atributo);
// controle positivo: com internet, nenhuma linha tem aria-disabled em nenhuma das duas.
// Uso: node linha-sem-internet.mjs <rodada>
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const { avaliar, clicar, enviar, fechar } = await abrirNavegador({ porta: 9484 });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const esperarATela = async (enderecoInteiro) => {
  await enviar('Page.navigate', { url: 'about:blank' }); await new Promise((resolver) => setTimeout(resolver, 100));
  await enviar('Page.navigate', { url: enderecoInteiro });
  for (let vez = 0; vez < 100; vez++) { await new Promise((resolver) => setTimeout(resolver, 120)); if (await avaliar('Boolean(document.querySelector("#root") && document.querySelector("#root").children.length)')) break; }
  await new Promise((resolver) => setTimeout(resolver, 700));
};
const lerLinhas = `(() => { const linhasDeEvento = [...document.querySelectorAll('.linha-de-evento')]; return { quantas: linhasDeEvento.length, comAriaDisabled: linhasDeEvento.filter((linhaDeEvento) => linhaDeEvento.getAttribute('aria-disabled') === 'true').length, comMotivo: linhasDeEvento.filter((linhaDeEvento) => linhaDeEvento.title).length, apagadosNaTela: document.querySelectorAll('#root [aria-disabled="true"]').length, endereco: location.hash, versao: (document.querySelector('script[src*="ui.jsx"]')?.getAttribute('src') || '').split('?')[1] }; })()`;
const ROTAS = [['busca', '#/painel/excurfly/producao/investigador/eventos/p=1h;f=reservationId:e:R-1042'], ['tentativa', '#/painel/excurfly/producao/investigador/tentativas/reservationId/R-1042']];
const medidas = {};
for (const [nomeDaVersao, base] of [['antes da correção (37378b1)', 'http://localhost:8772'], ['hoje (7db1aa4)', 'http://localhost:8771']]) {
  for (const [nomeDaTela, rota] of ROTAS) {
    for (const estado of ['default', 'offline']) {
      await esperarATela(`${base}/?visao=painel&superficie=desktop&tema=light&estado=${estado}&print=1&idioma=pt-BR${rota}`);
      const antesDoClique = await avaliar(lerLinhas);
      let abriuAoClicar = 'sem linha';
      if (antesDoClique.quantas) { await clicar('document.querySelector(".linha-de-evento")', 'primeira linha'); abriuAoClicar = (await avaliar('location.hash')) !== antesDoClique.endereco ? 'abre' : 'não abre'; }
      medidas[`${nomeDaVersao}|${nomeDaTela}|${estado}`] = antesDoClique;
      dizer(`${nomeDaVersao} (${antesDoClique.versao}) · ${nomeDaTela} · ${estado}: ${antesDoClique.quantas} linhas de evento · com aria-disabled ${antesDoClique.comAriaDisabled} · com o motivo no title ${antesDoClique.comMotivo} · apagados na tela ${antesDoClique.apagadosNaTela} · clique na primeira linha: ${abriuAoClicar}`);
    }
  }
}
let falhas = 0; let medidaValida = true;
for (const [nomeDaTela] of ROTAS) {
  const antesSemInternet = medidas[`antes da correção (37378b1)|${nomeDaTela}|offline`]; const hojeSemInternet = medidas[`hoje (7db1aa4)|${nomeDaTela}|offline`];
  const antesComInternet = medidas[`antes da correção (37378b1)|${nomeDaTela}|default`]; const hojeComInternet = medidas[`hoje (7db1aa4)|${nomeDaTela}|default`];
  const negativoViuOAtributo = antesSemInternet.quantas > 0 && antesSemInternet.comAriaDisabled === antesSemInternet.quantas;
  const positivoPassou = antesComInternet.comAriaDisabled === 0 && hojeComInternet.comAriaDisabled === 0;
  if (!negativoViuOAtributo || !positivoPassou) medidaValida = false;
  const passou = hojeSemInternet.quantas > 0 && hojeSemInternet.comAriaDisabled === hojeSemInternet.quantas;
  if (!passou) falhas++;
  dizer(`${passou ? 'PASS' : 'FAIL'} ${nomeDaTela} sem internet: hoje ${hojeSemInternet.comAriaDisabled} de ${hojeSemInternet.quantas} linhas com aria-disabled (antes ${antesSemInternet.comAriaDisabled} de ${antesSemInternet.quantas}) · controle negativo (a versão de antes mostra o atributo): ${negativoViuOAtributo ? 'viu' : 'NÃO VIU'} · controle positivo (com internet, zero nas duas): ${positivoPassou ? 'passou' : 'NÃO PASSOU'}`);
}
dizer(`${medidaValida ? 'MEDIDA VÁLIDA' : 'MEDIDA INVÁLIDA'} · falhas: ${falhas}`);
writeFileSync(`${PASTA}linha-sem-internet-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
