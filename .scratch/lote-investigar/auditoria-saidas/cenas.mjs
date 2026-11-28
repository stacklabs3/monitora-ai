// Cenas com interação (painéis abertos, erros de digitação, dicas): foto + contraste nos dois temas.
// Uso: node cenas.mjs <rodada> [filtro-do-nome]
import { readFileSync, writeFileSync } from 'node:fs';
import { abrirNavegador, porTexto, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada'; const filtro = process.argv[3] || '';
const navegador = await abrirNavegador({ porta: 9364 });
const { avaliar, abrir, clicar, digitar, tecla, foto, registros, fechar, moverMouse } = navegador;
const medidor = readFileSync(PASTA + 'medidor.js', 'utf8');
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const botao = (texto) => porTexto('[role="button"]', texto);
const opcao = (texto) => porTexto('[role="option"]', texto);
const radio = (texto) => porTexto('[role="radio"]', texto);
const I = '#/painel/excurfly/producao/investigador';
const EVENTO = `${I}/eventos/p=1h;f=reservationId:e:R-1042/evento/ev-1042-06`;
const abrirFiltro = async (campo) => { await clicar(botao('Adicionar filtro'), 'adicionar filtro'); if (campo) await clicar(opcao(campo), campo); };
const focar = async (expressao) => { await avaliar(`(() => { const el = ${expressao}; el.scrollIntoView({ block: 'center' }); el.focus(); return true; })()`); };
const CENAS = [
  ['filtro-catalogo', I, async () => { await abrirFiltro(); }],
  ['filtro-valor-texto', I, async () => { await abrirFiltro('reservationId'); await clicar(botao('Aplicar filtro'), 'aplicar vazio'); }],
  ['filtro-valor-data', I, async () => { await abrirFiltro('paidAt'); await digitar('ontem'); await clicar(botao('Aplicar filtro'), 'aplicar'); }],
  ['filtro-valor-data-certo', I, async () => { await abrirFiltro('paidAt'); await digitar('27/11/2026 14:00'); await tecla('Tab'); await digitar('27/11/2026 15:00'); await tecla('Enter'); }],
  ['filtro-valor-url', I, async () => { await abrirFiltro('URL'); await digitar('https://api.excurfly.example/api/v1/trip'); }],
  ['filtro-valor-url-aplicado', I, async () => { await abrirFiltro('URL'); await digitar('https://api.excurfly.example/api/v1/trip'); await tecla('Enter'); }],
  ['filtro-valor-codigo', I, async () => { await abrirFiltro('buyerDocument'); await digitar('123.456.789-00'); }],
  ['filtro-valor-codigo-aplicado', I, async () => { await abrirFiltro('buyerDocument'); await digitar('123.456.789-00'); await tecla('Enter'); }],
  ['filtro-valor-numero-intervalo', I, async () => { await abrirFiltro('amountCents'); await clicar(radio('entre'), 'entre'); }],
  ['filtro-valor-opcoes', I, async () => { await abrirFiltro('Nível'); await clicar(botao('ERRO'), 'erro'); }],
  ['periodo-aberto', I, async () => { await clicar(botao('Período'), 'período'); }],
  ['periodo-erro-de-formato', I, async () => { await clicar(botao('Período'), 'período'); await clicar('document.querySelector("[role=dialog] input")', 'de'); await avaliar('document.execCommand("selectAll")'); await digitar('ontem cedo'); await clicar(botao('Usar este intervalo'), 'usar'); }],
  ['periodo-intervalo-certo', I, async () => { await clicar(botao('Período'), 'período'); await clicar('document.querySelector("[role=dialog] input")', 'de'); await avaliar('document.execCommand("selectAll")'); await digitar('27/11/2026 13:00'); await tecla('Enter'); }],
  ['periodo-24h', I, async () => { await clicar(botao('Período'), 'período'); await clicar(radio('Últimas 24 h'), '24h'); }],
  ['periodo-pelo-recebimento', I, async () => { await clicar(botao('Período'), 'período'); await clicar(radio('Horário de recebimento'), 'recebimento'); }],
  ['regex-recusada', I, async () => { await clicar(botao('regex'), 'regex'); await clicar('document.querySelector(".campo-sem-moldura")', 'caixa'); await digitar('(a)\\1'); await tecla('Enter'); }],
  ['regex-ligada', I, async () => { await clicar(botao('regex'), 'regex'); }],
  ['atalhos', I, async () => { await clicar('document.body', 'corpo'); await tecla('?', { shift: true }); }],
  ['evento-dica-sem-filtro-foco', `${EVENTO}/atributos`, async () => { await focar('document.querySelector("[role=note]")'); }],
  ['evento-pilha-inteira', `${EVENTO}/erro`, async () => { await clicar(botao('Mostrar tudo'), 'mostrar tudo'); }],
  ['evento-copiado', EVENTO, async () => { await clicar(botao('Copiar'), 'copiar'); }],
  ['tentativas-periodo', `${I}/tentativas`, async () => { await clicar(botao('Período'), 'período'); }],
  ['tentativas-documento', `${I}/tentativas`, async () => { await clicar(radio('buyerDocument'), 'campo').catch(() => {}); }],
  ['busca-evento-cortado', `${I}/eventos/p=24h;f=reservationId:e:R-1040`, async () => {}],
];
const falhas = new Map(); const bordas = new Map(); const menor = { light: 99, dark: 99 }; const pares = { light: 0, dark: 0 };
for (const [nome, rota, passos] of CENAS) {
  if (filtro && !nome.includes(filtro)) continue;
  for (const tema of ['light', 'dark']) {
    try {
      await abrir(`/?visao=painel&superficie=desktop&tema=${tema}&estado=default&print=1&idioma=pt-BR${rota}`);
      await passos();
      await foto(`${rodada}-${nome}-${tema}`);
      await avaliar(medidor + '; true');
      const achados = (await avaliar('window.medirContraste()')).filter((achado) => !achado.desabilitado && achado.tipo !== 'cor-ilegivel');
      const reprovados = achados.filter((achado) => achado.razao < achado.minimo);
      pares[tema] += achados.length; menor[tema] = Math.min(menor[tema], ...achados.map((achado) => achado.razao));
      for (const achado of reprovados) { const chave = `${tema} ${achado.texto_cor}/${achado.fundo_cor} ${achado.onde}`; if (!falhas.has(chave)) falhas.set(chave, { ...achado, cena: `${nome} ${tema}` }); }
      for (const borda of await avaliar('window.medirBordas()')) { const chave = `${tema} ${borda.onde} ${borda.borda}/${borda.fora}/${borda.dentro}`; if (!bordas.has(chave) && !borda.desabilitado) bordas.set(chave, { ...borda, cena: `${nome} ${tema}` }); }
      dizer(`${reprovados.length ? 'FAIL' : 'ok  '} ${nome} ${tema}: ${achados.length} textos, menor ${Math.min(...achados.map((achado) => achado.razao))}:1, reprovados ${reprovados.length} · ${await avaliar('location.hash')}`);
    } catch (erro) { dizer(`ERRO ${nome} ${tema}: ${erro.message.slice(0, 160)}`); }
  }
}
dizer(`\nRESUMO: light ${pares.light} pares, menor ${menor.light}:1 · dark ${pares.dark} pares, menor ${menor.dark}:1`);
dizer(`PARES REPROVADOS (${falhas.size}):`);
for (const [, achado] of falhas) dizer(`FAIL ${achado.razao}:1 < ${achado.minimo}  ${achado.texto_cor} sobre ${achado.fundo_cor}  ${achado.tamanho}px/${achado.peso} [${achado.tipo}] «${achado.texto}»  ${achado.onde}  (${achado.cena})`);
dizer(`BORDAS DE CAMPO (${bordas.size}):`);
for (const [, borda] of bordas) dizer(`${borda.razao < 3 ? 'FAIL' : 'ok  '} ${borda.razao}:1 borda ${borda.borda} fora ${borda.fora} dentro ${borda.dentro}  ${borda.onde} «${borda.rotulo}» (${borda.cena})`);
dizer(`CONSOLE (${new Set(registros).size}):`); for (const registro of new Set(registros)) dizer('  ' + registro);
writeFileSync(`${PASTA}cenas-${rodada}${filtro ? '-' + filtro : ''}.txt`, linhas.join('\n') + '\n');
fechar();
