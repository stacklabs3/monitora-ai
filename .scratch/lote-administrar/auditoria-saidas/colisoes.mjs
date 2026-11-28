// Colisões de nome global entre os scripts: cada <script type="text/babel"> roda no escopo global, então
// o que o Babel gera no topo de um arquivo (`_excluded`, `_excluded2`…) e toda declaração de topo dividem um só espaço de nomes.
// Uso: node colisoes.mjs <rodada>
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const { avaliar, abrir, fechar } = await abrirNavegador({ porta: 9480 });
await abrir('/?visao=painel&idioma=pt-BR');
const analisar = (fontesExtras) => `(async (fontesExtras) => {
  const declaracoesPorNome = new Map();
  const colher = (nomeDoArquivo, fonte) => {
    const transpilado = Babel.transform(fonte, { presets: ['react', 'env'], sourceType: 'script' }).code;
    for (const linhaTranspilada of transpilado.split('\\n')) {
      const declaracao = linhaTranspilada.match(/^(?:var|let|const|function\\*?|class)\\s+([A-Za-z_$][\\w$]*)/);
      if (!declaracao) continue;
      const valor = (linhaTranspilada.match(/=\\s*(.*);?$/) || [])[1] || '';
      if (!declaracoesPorNome.has(declaracao[1])) declaracoesPorNome.set(declaracao[1], []);
      declaracoesPorNome.get(declaracao[1]).push({ arquivo: nomeDoArquivo, valor: linhaTranspilada.startsWith('function') ? '(função)' : valor.slice(0, 90) });
    }
  };
  for (const marcaDeScript of document.querySelectorAll('script[type="text/babel"][src]')) {
    const endereco = marcaDeScript.getAttribute('src');
    colher(endereco.replace('components/', '').replace(/\\?.*/, ''), await (await fetch(endereco)).text());
  }
  for (const [nomeDoArquivo, fonte] of fontesExtras) colher(nomeDoArquivo, fonte);
  const colisoes = [];
  for (const [nome, declaracoes] of declaracoesPorNome) {
    if (declaracoes.length < 2) continue;
    const valoresDistintos = new Set(declaracoes.map((declaracao) => declaracao.valor));
    colisoes.push({ nome, mesmaCoisa: valoresDistintos.size === 1, onde: declaracoes.map((declaracao) => declaracao.arquivo + (valoresDistintos.size === 1 ? '' : ' = ' + declaracao.valor)).join(' | ') });
  }
  return colisoes;
})(${JSON.stringify(fontesExtras)})`;
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
// Controle (RP1): dois arquivos plantados aqui, fora do repositório, com a mesma colisão, têm de ser acusados; um sozinho, não.
const plantados = [['controle-a.jsx', 'const PrimeiroControle = ({ nome, ...sobra }) => <div {...sobra}>{nome}</div>;'], ['controle-b.jsx', 'const SegundoControle = ({ titulo, cor, ...sobra }) => <span {...sobra}>{titulo}</span>;']];
const comOsPlantados = await avaliar(analisar(plantados));
const acusouOsPlantados = comOsPlantados.some((colisao) => colisao.nome === '_excluded' && colisao.onde.includes('controle-a.jsx') && colisao.onde.includes('controle-b.jsx'));
dizer(`CONTROLE NEGATIVO (dois arquivos plantados com desestruturação "...sobra"): ${acusouOsPlantados ? 'ACUSADO como devia' : 'NÃO ACUSOU'}`);
const semOsPlantados = await avaliar(analisar([]));
const colisoesDeValor = semOsPlantados.filter((colisao) => !colisao.mesmaCoisa);
dizer(`\nNOMES DECLARADOS NO TOPO DE MAIS DE UM SCRIPT: ${semOsPlantados.length} · com valor diferente entre os arquivos (o último a carregar vence): ${colisoesDeValor.length}`);
for (const colisao of colisoesDeValor) dizer(`  COLISÃO ${colisao.nome}: ${colisao.onde}`);
dizer(`  com o mesmo conteúdo em todos (auxiliares do Babel, inofensivos): ${semOsPlantados.filter((colisao) => colisao.mesmaCoisa).map((colisao) => colisao.nome).join(', ') || 'nenhum'}`);
dizer(`  na página: window._excluded = ${await avaliar('JSON.stringify(window._excluded)')}`);
writeFileSync(`${PASTA}colisoes-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
