// Texto cru na tela: {parametro} sem resolver, undefined, NaN, [object Object], chave de i18n aparecendo, e termos Avoid do glossário no que a tela mostra.
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const { avaliar, abrir, fechar } = await abrirNavegador({ porta: 9471 });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
await abrir('/?listarPrints=todas');
const prints = JSON.parse(await avaliar('document.querySelector("#lista-de-prints").textContent'));
const LOTE = ['cadastrar-aplicacao', 'guardar-a-chave', 'revogar-chave', 'declarar-um-campo', 'ler-o-catalogo-como-investigador', 'conferir-a-saude-do-envio', 'execucao-que-sumiu', 'eventos-em-volta-da-perda'];
const telas = new Map();
for (const print of prints) { const rotina = print.arquivo.split('/')[0]; if (!LOTE.includes(rotina)) continue; const rota = print.endereco.slice(print.endereco.indexOf('#')); if (!telas.has(rota)) telas.set(rota, `${rotina}/${print.arquivo.split('/')[1].split('--')[0]}`); }
const chaves = await avaliar('Object.keys(TRANSLATIONS["pt-BR"])');
// Termos Avoid do GLOSSARY.md (os que não têm outro sentido legítimo na tela ficam de fora da lista automática e vão na leitura).
const AVOID = ['tenant', 'serviço', 'sistema monitorado', 'instância', 'resource', 'propriedade', 'categoria', 'sessão', 'índice', 'campo raiz', 'associação', 'transação', 'evento recebido', 'evento entregue', 'descarte', 'notificação', 'alarme', 'integração', 'mensageiro', 'token', 'api key', 'salt', 'heartbeat', 'anonimizado', 'ofuscado', 'hash', 'pseudônimo', 'analista', 'admin', 'indexado', 'facet', 'varredura', 'full scan', 'endpoint', 'esquema', 'mapping', 'configuração', 'telemetria', 'expiração', 'ttl', 'histórico', ' log ', ' logs ', 'projeto', 'processo'];
const INGLES_DA_TELA = ['loading', 'search', 'filter', 'apply', 'cancel', 'close', 'empty', 'error:', 'submit', 'retry', 'back', 'next', 'previous', 'copy', 'copied', 'default', 'offline', 'timeline', 'attempt'];
const achados = new Map(); let cenas = 0;
const lerTexto = (textoETitulos, nomeDaTela, estado) => {
    const anotar = (tipo, trecho) => { const chave = `${tipo}: ${trecho}`; if (!achados.has(chave)) achados.set(chave, `${nomeDaTela} ${estado}`); };
  for (const cru of textoETitulos.match(/\{[a-zA-Z]+\}|\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/g) || []) anotar('CRU', cru);
  for (const chave of chaves) if (chave.length > 6 && new RegExp(`(^|[\\s|])${chave}($|[\\s|])`).test(textoETitulos)) anotar('CHAVE DE I18N NA TELA', chave);
  const semCaixa = ' ' + textoETitulos.toLowerCase().replace(/\s+/g, ' ') + ' ';
  for (const termo of AVOID) { const posicao = semCaixa.search(new RegExp(`(^|[^\\p{L}])${termo.trim()}(s|es)?([^\\p{L}]|$)`, 'u')); if (posicao >= 0) anotar('AVOID', `${termo.trim()} → «${semCaixa.slice(Math.max(0, posicao - 40), posicao + 50)}»`); }
  for (const palavra of INGLES_DA_TELA) { const posicao = semCaixa.search(new RegExp(`(^|[^\\p{L}.=_/-])${palavra}([^\\p{L}=_.-]|$)`, 'u')); if (posicao >= 0) anotar('INGLÊS?', `${palavra} → «${semCaixa.slice(Math.max(0, posicao - 40), posicao + 40)}»`); }
};

for (const [rota, nomeDaTela] of telas) {
  for (const estado of ['default', 'empty', 'error', 'loading', 'offline', 'disabled']) {
    await abrir(`/?visao=painel&superficie=desktop&tema=light&estado=${estado}&print=1&idioma=pt-BR${rota}`); cenas++;
    const textoETitulos = await avaliar(`document.querySelector('#root').innerText + '\\n' + [...document.querySelectorAll('#root [title], #root [aria-label], #root [placeholder]')].map((el) => [el.getAttribute('title'), el.getAttribute('aria-label'), el.getAttribute('placeholder')].filter(Boolean).join(' | ')).join('\\n')`);
    lerTexto(textoETitulos, nomeDaTela, estado);
  }
}
// Controle (RP1): um texto plantado aqui, fora do repositório, com o que o conferidor tem de pegar; e um limpo, que não pode ser acusado.
const antesDoControle = achados.size;
lerTexto('O token da api key {campo} deu undefined no heartbeat do admin; ver o histórico. catalogoDeclararTitulo Loading', 'CONTROLE NEGATIVO', 'plantado');
const pegosNoControle = [...achados.keys()].slice(antesDoControle);
const antesDoPositivo = achados.size;
lerTexto('A chave de envio da aplicação API foi revogada às 15:00 por Pessoa Exemplo.', 'CONTROLE POSITIVO', 'plantado');
const pegosNoPositivo = achados.size - antesDoPositivo;
dizer(`CONTROLE NEGATIVO (texto plantado): ${pegosNoControle.length} achados (esperado: {campo}, undefined, token, api key, heartbeat, admin, histórico, chave de i18n, inglês) => ${pegosNoControle.length >= 8 ? 'REPROVADO como devia' : 'NÃO REPROVOU'}`);
dizer(`CONTROLE POSITIVO (texto limpo): ${pegosNoPositivo} achados (esperado 0) => ${pegosNoPositivo === 0 ? 'passou' : 'ACUSADO À TOA'}`);
for (const achadoDoControle of pegosNoControle) achados.delete(achadoDoControle);
dizer(`cenas lidas: ${cenas} · achados distintos: ${achados.size}`);
for (const [achado, onde] of achados) dizer(`  ${achado}  (${onde})`);
writeFileSync(`${PASTA}texto-cru-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
