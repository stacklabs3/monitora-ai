import { readFileSync, readdirSync } from 'node:fs';
const pasta = process.argv[2];
const arquivos = readdirSync(pasta + '/components').filter((nome) => nome.endsWith('.jsx'));
const fonteI18n = readFileSync(pasta + '/components/i18n.jsx', 'utf8');
const TRANSLATIONS = new Function(fonteI18n + '; return TRANSLATIONS;')();
const dicionario = TRANSLATIONS['pt-BR'];
const chaves = new Set(Object.keys(dicionario));
const usadas = new Map(); const dinamicas = [];
for (const arquivo of arquivos) {
  if (arquivo === 'i18n.jsx') continue;
  const linhas = readFileSync(`${pasta}/components/${arquivo}`, 'utf8').split('\n');
  linhas.forEach((linha, indice) => {
    for (const achado of linha.matchAll(/traduzir\(\s*'([^']+)'/g)) { if (!usadas.has(achado[1])) usadas.set(achado[1], `${arquivo}:${indice + 1}`); }
    for (const achado of linha.matchAll(/traduzir\(\s*(?!')([^,)]+)/g)) dinamicas.push(`${arquivo}:${indice + 1} ${achado[1].slice(0, 60)}`);
  });
}
const todoOCodigo = arquivos.filter((nome) => nome !== 'i18n.jsx').map((nome) => readFileSync(`${pasta}/components/${nome}`, 'utf8')).join('\n');
console.log('chaves no dicionario', chaves.size, 'usadas literais', usadas.size);
console.log('USADA E INEXISTENTE:', [...usadas].filter(([chave]) => !chaves.has(chave)));
console.log('dinamicas:', dinamicas.length); dinamicas.forEach((chaveDinamica) => console.log('  ', chaveDinamica));
const naoCitadas = [...chaves].filter((chave) => !new RegExp(`['"\`]${chave}['"\`]`).test(todoOCodigo));
console.log('chaves nao citadas literalmente (podem ser dinamicas):', naoCitadas.length, naoCitadas.join(' '));
const avoid = ['projeto','cliente','tenant','serviço','app','sistema monitorado','instância','processo','log','fonte','resource','propriedade','tag','categoria','grupo','sessão','chave','índice','campo raiz','relação','associação','transação','evento recebido','evento entregue','descarte','notificação','alarme','monitor','integração','provedor','mensageiro','token','api key','salt','heartbeat','ping','anonimizado','ofuscado','hash','pseudônimo','leitor','analista','admin','dono','indexado','facet','busca indexada','varredura','full scan','endpoint','url','esquema','mapping','configuração','telemetria','expiração','ttl','histórico'];
for (const [chave, valor] of Object.entries(dicionario)) {
  for (const termo of avoid) {
    const padrao = new RegExp(`(^|[^\\p{L}])${termo}(s|es)?([^\\p{L}]|$)`, 'iu');
    if (padrao.test(String(valor))) console.log(`AVOID? [${termo}] ${chave}: ${String(valor).slice(0, 110)}`);
  }
}
