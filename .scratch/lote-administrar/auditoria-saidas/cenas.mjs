// Cenas com interação (painéis abertos, erros de digitação, dicas): foto + contraste nos dois temas.
// Uso: node cenas.mjs <rodada> [filtro-do-nome]
import { readFileSync, writeFileSync } from 'node:fs';
import { abrirNavegador, porTexto, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada'; const filtro = process.argv[3] || '';
const navegador = await abrirNavegador({ porta: 9464 });
const { avaliar, abrir, clicar, digitar, tecla, foto, registros, fechar, moverMouse } = navegador;
const medidor = readFileSync(PASTA + 'medidor.js', 'utf8');
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const botao = (texto) => porTexto('[role="button"]', texto);
const opcao = (texto) => porTexto('[role="option"]', texto);
const radio = (texto) => porTexto('[role="radio"]', texto);
const ADMINISTRADOR = '#/painel/excurfly/producao/administrador';
const INVESTIGADOR = '#/painel/excurfly/producao/investigador';
const HOMOLOGACAO = '#/painel/excurfly/homologacao/administrador';
const naJanela = (texto) => porTexto('[aria-modal="true"] [role="button"]', texto);
const naJanelaRadio = (texto) => porTexto('[aria-modal="true"] [role="radio"]', texto);
const caixaDeMarcar = (texto) => porTexto('[aria-modal="true"] [role="checkbox"]', texto);
const focar = async (expressao) => { await avaliar(`(() => { const elemento = ${expressao}; elemento.scrollIntoView({ block: 'center' }); elemento.focus(); return true; })()`); };
const CENAS = [
  ['cadastro-aberto', `${ADMINISTRADOR}/aplicacoes/nova`, async () => {}],
  ['cadastro-recusa-vazio', `${ADMINISTRADOR}/aplicacoes/nova`, async () => { await clicar(naJanela('Cadastrar e gerar a chave'), 'confirmar vazio'); }],
  ['cadastro-recusa-repetido', `${ADMINISTRADOR}/aplicacoes/nova`, async () => { await digitar('API'); await tecla('Enter'); }],
  ['cadastro-escrito', `${ADMINISTRADOR}/aplicacoes/nova`, async () => { await digitar('API de parceiros'); await tecla('Tab'); await digitar('servidor dos parceiros'); }],
  ['mais-uma-chave', `${ADMINISTRADOR}/aplicacoes/api/chaves/nova`, async () => {}],
  ['chave-gerada', `${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a/gerada`, async () => {}],
  ['chave-gerada-copiada', `${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a/gerada`, async () => { await clicar(naJanela('Copiar a chave'), 'copiar'); }],
  ['chave-guardada-aviso-de-feito', `${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a`, async () => {}],
  ['revogar-com-outra-ativa', `${ADMINISTRADOR}/aplicacoes/site/chaves/ex2b/revogar`, async () => {}],
  ['revogar-a-unica-ativa', `${ADMINISTRADOR}/aplicacoes/webhooks/chaves/ex4e/revogar`, async () => {}],
  ['revogar-foco-no-botao-de-perigo', `${ADMINISTRADOR}/aplicacoes/site/chaves/ex2b/revogar`, async () => { await tecla('Tab'); }],
  ['revogada-aviso-de-feito', `${ADMINISTRADOR}/aplicacoes/site/chaves/ex2b/revogada`, async () => {}],
  ['revogada-aplicacao-sem-chave-ativa', `${ADMINISTRADOR}/aplicacoes/webhooks/chaves/ex4e/revogada`, async () => {}],
  ['aplicacoes-de-homologacao', `${HOMOLOGACAO}/aplicacoes`, async () => {}],
  ['aplicacoes-gerar-chave-no-limite-com-mouse-em-cima', `${ADMINISTRADOR}/aplicacoes`, async () => { await focar('document.querySelector("[aria-label=\\"Gerar chave de envio para API\\"]")'); }],
  ['atalhos', `${ADMINISTRADOR}/aplicacoes`, async () => { await tecla('?'); }],
  ['declarar-aberto', `${ADMINISTRADOR}/catalogo/installmentCount/declarar`, async () => {}],
  ['declarar-tipo-texto-com-buscas', `${ADMINISTRADOR}/catalogo/installmentCount/declarar`, async () => { await clicar(naJanelaRadio('texto'), 'tipo texto'); await clicar(caixaDeMarcar('começo'), 'marcar começo').catch(() => {}); await avaliar(`(() => { const caixas = [...document.querySelectorAll('[aria-modal="true"] [role="checkbox"]')]; caixas.forEach((caixa) => { if (caixa.getAttribute('aria-checked') !== 'true' && caixa.getAttribute('aria-disabled') !== 'true') caixa.click(); }); return caixas.length; })()`); }],
  ['declarar-papel-principal', `${ADMINISTRADOR}/catalogo/installmentCount/declarar`, async () => { await clicar(naJanelaRadio('campo principal'), 'papel principal').catch(async () => { await avaliar(`(() => { const papeis = [...document.querySelectorAll('[aria-modal="true"] [role="radiogroup"]')].pop().querySelectorAll('[role="radio"]'); papeis[2].click(); return true; })()`); }); }],
  ['declarar-foco-na-caixa-de-marcar', `${ADMINISTRADOR}/catalogo/installmentCount/declarar`, async () => { await clicar(naJanelaRadio('texto'), 'tipo texto'); await focar('document.querySelector("[aria-modal=\\"true\\"] [role=\\"checkbox\\"]")'); }],
  ['declarado-aviso-de-feito', `${ADMINISTRADOR}/catalogo/installmentCount/declarado/numero.exata-intervalo.nenhum`, async () => {}],
  ['declarado-como-texto-principal', `${ADMINISTRADOR}/catalogo/installmentCount/declarado/texto.exata-comeco-palavras.principal`, async () => {}],
  ['catalogo-procura-com-achado', `${ADMINISTRADOR}/catalogo`, async () => { await focar('document.querySelector("main input")'); await digitar('amount'); }],
  ['catalogo-procura-sem-achado', `${ADMINISTRADOR}/catalogo`, async () => { await focar('document.querySelector("main input")'); await digitar('zzzz'); }],
  ['catalogo-do-investigador', `${INVESTIGADOR}/catalogo`, async () => {}],
  ['catalogo-de-homologacao', `${HOMOLOGACAO}/catalogo`, async () => {}],
  ['evento-com-ver-no-catalogo', `${INVESTIGADOR}/eventos/p=1h;f=reservationId:e:R-1042/evento/ev-1042-06/atributos`, async () => {}],
  ['saude-api-aberta', `${INVESTIGADOR}/saude/24h/api`, async () => {}],
  ['saude-webhooks-aberta', `${ADMINISTRADOR}/saude/24h/webhooks`, async () => {}],
  ['saude-site-sem-problema', `${INVESTIGADOR}/saude/24h/site`, async () => {}],
  ['saude-api-na-ultima-hora', `${INVESTIGADOR}/saude/1h/api`, async () => {}],
  ['saude-api-em-7-dias', `${INVESTIGADOR}/saude/7d/api`, async () => {}],
  ['saude-de-homologacao', `${HOMOLOGACAO}/saude/24h/site`, async () => {}],
  ['saude-foco-no-abrir', `${INVESTIGADOR}/saude`, async () => { await focar('document.querySelector("[data-abrir-aplicacao=\\"api\\"]")'); }],
];
// ---------- Controles (RP1): texto e borda que precisam reprovar, e os que precisam passar ----------
let controlesValidos = true;
for (const tema of ['light', 'dark']) {
  await abrir(`/?visao=painel&superficie=desktop&tema=${tema}&estado=default&print=1&idioma=pt-BR${ADMINISTRADOR}/aplicacoes`);
  await avaliar(medidor + '; true');
  const controles = await avaliar(`(() => {
    const caixa = document.createElement('div'); caixa.id = 'controles-da-medida'; caixa.style.background = '#fff';
    caixa.innerHTML = [
      '<span style="color:#9aa;background:#fff">CONTROLE negativo fixo #9aa sobre #fff</span>',
      '<span style="color:var(--muted);background:var(--primary)">CONTROLE negativo token muted sobre primary</span>',
      '<span style="background:#fff"><span style="color:#000;opacity:0.3">CONTROLE negativo preto com opacidade 0,3 sobre branco</span></span>',
      '<span style="background:#fff"><span style="background:rgba(0,0,0,0.5)"><span style="color:#555">CONTROLE negativo cinza sobre preto 50% sobre branco</span></span></span>',
      '<span style="color:#000;background:#fff">CONTROLE positivo preto sobre branco</span>',
      '<input aria-label="CONTROLE borda negativa" style="border:1px solid #ddd;background:#fff">',
      '<input aria-label="CONTROLE borda positiva" style="border:1px solid #000;background:#fff">',
      '<span role="checkbox" aria-label="CONTROLE caixa de marcar negativa"><span aria-hidden="true" style="display:inline-block;width:18px;height:18px;border:1px solid #e5e5e5;background:#fff"></span></span>',
    ].join('');
    document.body.appendChild(caixa);
    const textos = window.medirContraste().filter((achado) => achado.texto.startsWith('CONTROLE'));
    const bordas = window.medirBordas().filter((borda) => borda.rotulo.startsWith('CONTROLE'));
    caixa.remove();
    return { textos, bordas };
  })()`);
  dizer(`== CONTROLES no tema ${tema} ==`);
  for (const controle of controles.textos) dizer(`  ${controle.razao < controle.minimo ? 'REPROVADO' : 'aprovado '}  ${controle.razao}:1 (mínimo ${controle.minimo})  ${controle.texto_cor} sobre ${controle.fundo_cor}  «${controle.texto}»`);
  for (const controle of controles.bordas) dizer(`  ${controle.razao < 3 ? 'REPROVADO' : 'aprovado '}  ${controle.razao}:1 (mínimo 3)  borda ${controle.borda} fora ${controle.fora} dentro ${controle.dentro}  «${controle.rotulo}»`);
  const negativosDeTexto = controles.textos.filter((controle) => controle.texto.includes('negativo'));
  const positivoDeTexto = controles.textos.find((controle) => controle.texto.includes('positivo'));
  const bordasNegativas = controles.bordas.filter((controle) => controle.rotulo.includes('negativa'));
  const bordaPositiva = controles.bordas.find((controle) => controle.rotulo.includes('positiva'));
  const valeu = negativosDeTexto.length === 4 && negativosDeTexto.every((controle) => controle.razao < 4.5) && positivoDeTexto && positivoDeTexto.razao > 20.9
    && bordasNegativas.length === 2 && bordasNegativas.every((controle) => controle.razao < 3) && bordaPositiva && bordaPositiva.razao >= 3;
  if (!valeu) controlesValidos = false;
}
dizer(`MEDIDA ${controlesValidos ? 'VÁLIDA: os controles negativos (4 de texto, 2 de borda) reprovaram e os positivos passaram' : 'INVÁLIDA'}.\n`);
if (!controlesValidos) { writeFileSync(`${PASTA}cenas-${rodada}-invalida.txt`, linhas.join('\n') + '\n'); fechar(); process.exit(2); }
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
