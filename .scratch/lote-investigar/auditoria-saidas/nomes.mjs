// Nomes de uma letra, texto visível fora do i18n e cor/px soltos, pela árvore sintática (Babel da própria página).
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const { avaliar, abrir, fechar } = await abrirNavegador({ porta: 9363 });
await abrir('/?visao=painel&idioma=pt-BR');
const ARQUIVOS = ['busca', 'evento', 'tentativa', 'visoes', 'data', 'router', 'app', 'ui', 'icons', 'painel-casca', 'i18n', 'painel', 'entrada', 'alerta', 'device'];
const analisar = `(async (arquivos, fontesExtras) => {
  const saida = [];
  const ATRIBUTOS_VISIVEIS = ['aria-label', 'title', 'placeholder', 'alt', 'label', 'rotulo', 'titulo', 'corpo', 'dica', 'texto', 'cta', 'body'];
  const analisarFonte = (nome, fonte) => {
    const achados = [];
    const anotar = (tipo, no, detalhe) => achados.push(tipo + ' ' + nome + ':' + (no.loc ? no.loc.start.line : '?') + ' ' + detalhe);
    const nomeCurto = (identificador) => identificador && identificador.type === 'Identifier' && identificador.name.length === 1 && identificador.name !== '_';
    const conferirPadrao = (padrao, onde) => {
      if (!padrao) return;
      if (padrao.type === 'Identifier') { if (nomeCurto(padrao)) anotar('NOME-DE-UMA-LETRA', padrao, onde + ' «' + padrao.name + '»'); }
      else if (padrao.type === 'ObjectPattern') padrao.properties.forEach((propriedade) => conferirPadrao(propriedade.type === 'RestElement' ? propriedade.argument : propriedade.value, onde + ' (desestruturação)'));
      else if (padrao.type === 'ArrayPattern') padrao.elements.forEach((elemento) => conferirPadrao(elemento, onde + ' (desestruturação)'));
      else if (padrao.type === 'AssignmentPattern') conferirPadrao(padrao.left, onde);
      else if (padrao.type === 'RestElement') conferirPadrao(padrao.argument, onde);
    };
    const funcao = (caminho) => caminho.node.params.forEach((parametro) => conferirPadrao(parametro, 'parâmetro'));
    const plugin = () => ({ visitor: {
      VariableDeclarator(caminho) { conferirPadrao(caminho.node.id, 'variável'); },
      FunctionDeclaration(caminho) { if (nomeCurto(caminho.node.id)) anotar('NOME-DE-UMA-LETRA', caminho.node, 'função'); funcao(caminho); },
      FunctionExpression: funcao, ArrowFunctionExpression: funcao, ObjectMethod: funcao, ClassMethod: funcao,
      CatchClause(caminho) { conferirPadrao(caminho.node.param, 'catch'); },
      JSXText(caminho) { const texto = caminho.node.value.trim(); if (texto && /[\\p{L}\\d]/u.test(texto)) anotar('TEXTO-NO-JSX', caminho.node, '«' + texto.slice(0, 60) + '»'); },
      JSXExpressionContainer(caminho) {
        const expressao = caminho.node.expression;
        if (caminho.parent.type !== 'JSXElement' && caminho.parent.type !== 'JSXFragment') return;
        const literais = [];
        const colher = (no) => { if (!no) return; if (no.type === 'StringLiteral') literais.push(no.value); else if (no.type === 'TemplateLiteral') no.quasis.forEach((trecho) => literais.push(trecho.value.cooked)); else if (no.type === 'ConditionalExpression') { colher(no.consequent); colher(no.alternate); } else if (no.type === 'LogicalExpression') { colher(no.right); } };
        colher(expressao);
        literais.filter((literal) => /\\p{L}{2,}/u.test(literal)).forEach((literal) => anotar('TEXTO-NO-JSX', caminho.node, 'literal como filho «' + literal.slice(0, 60) + '»'));
      },
      JSXAttribute(caminho) {
        const nomeDoAtributo = caminho.node.name.name; const valor = caminho.node.value;
        if (!ATRIBUTOS_VISIVEIS.includes(nomeDoAtributo) || !valor) return;
        if (valor.type === 'StringLiteral' && /\\p{L}{2,}/u.test(valor.value)) anotar('TEXTO-NO-JSX', caminho.node, 'atributo ' + nomeDoAtributo + '=«' + valor.value.slice(0, 60) + '»');
        if (valor.type === 'JSXExpressionContainer' && valor.expression.type === 'TemplateLiteral' && valor.expression.quasis.some((trecho) => /\\p{L}{2,}/u.test(trecho.value.cooked))) anotar('TEXTO-NO-JSX', caminho.node, 'atributo ' + nomeDoAtributo + ' com texto no molde');
      },
      StringLiteral(caminho) { if (/^#[0-9a-fA-F]{3,8}$/.test(caminho.node.value) || /rgba?\\(/.test(caminho.node.value)) anotar('COR-SOLTA', caminho.node, '«' + caminho.node.value + '»'); },
    } });
    try { Babel.transform(fonte, { presets: ['react'], plugins: [plugin], filename: nome }); } catch (erro) { achados.push('ERRO-DE-SINTAXE ' + nome + ' ' + erro.message.slice(0, 120)); }
    return achados;
  };
  for (const arquivo of arquivos) {
    const fonte = await (await fetch('components/' + arquivo + '.jsx?semcache=' + Date.now())).text();
    saida.push(...analisarFonte(arquivo + '.jsx', fonte));
  }
  for (const [nome, fonte] of fontesExtras) saida.push(...analisarFonte(nome, fonte).map((achado) => 'CONTROLE ' + achado));
  return saida;
})(${JSON.stringify(ARQUIVOS)}, ${JSON.stringify([
  ['controle-negativo.jsx', "const Tela = ({ traduzir }) => { const n = 2; const lista = [1].map((v) => v * n); const { a, ...resto } = { a: 1 }; return <div title=\"Fechar a janela\" style={{ color: '#ff0000' }}>Texto solto na tela {lista.length > 0 ? 'Sim, tem' : traduzir('x')}</div>; };"],
  ['controle-positivo.jsx', "const Tela = ({ traduzir }) => { const total = 2; const lista = [1].map((valor) => valor * total); const [_, segundo] = lista; return <div title={traduzir('fechar')} style={{ color: 'var(--fg)' }}>{traduzir('texto')}{segundo}</div>; };"],
])})`;
const achados = await avaliar(analisar);
const linhas = [];
const controlesNegativos = achados.filter((achado) => achado.includes('controle-negativo'));
const controlesPositivos = achados.filter((achado) => achado.includes('controle-positivo'));
linhas.push(`CONTROLE NEGATIVO: ${controlesNegativos.length} achados (esperado: 3 nomes de uma letra [n, v, a], 3 textos, 1 cor)`); controlesNegativos.forEach((achado) => linhas.push('  ' + achado));
linhas.push(`CONTROLE POSITIVO: ${controlesPositivos.length} achados (esperado: 0)`);
const reais = achados.filter((achado) => !achado.startsWith('CONTROLE'));
const DO_LOTE = ['busca.jsx', 'evento.jsx', 'tentativa.jsx', 'visoes.jsx', 'data.jsx', 'router.jsx', 'app.jsx', 'ui.jsx', 'icons.jsx', 'painel-casca.jsx', 'i18n.jsx'];
linhas.push(`\nACHADOS NOS ARQUIVOS (${reais.length}):`); reais.forEach((achado) => linhas.push('  ' + achado));
console.log(linhas.join('\n'));
writeFileSync(`${PASTA}nomes-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
