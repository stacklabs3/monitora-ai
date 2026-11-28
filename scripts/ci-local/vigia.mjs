// O passo `actions/github-script` do vigia do método, rodando num Node local (modelo: o vigia.mjs do excurfly).
// O texto do script vem do próprio workflow, lido na hora por quem chama (nunca copiado); aqui há só o
// substituto pequeno de `context`, `github` e `core`, montado a partir dos dados da PR que o
// scripts/ci-local.sh leu pelo `gh`. Nada aqui toca a rede: os dados entram por parâmetro.
//
// O que o substituto não oferece (uma chamada de `github`, um campo de `context`, um método de `core`)
// é registrado e faz o resultado sair "nao-reproduzivel" citando a chamada, mesmo que o script a
// engula num `try/catch`: o CI local não diz "passou" no que não conferiu.
import fs from 'node:fs';

const FuncaoAssincrona = Object.getPrototypeOf(async () => {}).constructor;

export const SAIDA_DO_ESTADO = { passou: 0, falhou: 1, 'nao-reproduzivel': 3 };

function erroDeHttp(status, mensagem) {
  return Object.assign(new Error(mensagem), { status });
}

// Um objeto que registra o que o substituto não tem. Com `registraNoAcesso`, o simples acesso à
// propriedade ausente já conta (`context.sha`: dado, não chamada). Sem ele, a ausente vira uma função
// aninhada que registra o caminho inteiro quando é chamada (`github.rest.checks.create`) e lança, para o
// script não seguir como se a chamada tivesse dado certo.
function chamadaAusente(caminho, chamadasSemSubstituto) {
  return new Proxy(() => {}, {
    get: (_, propriedade) =>
      typeof propriedade === 'symbol' || propriedade === 'then'
        ? undefined
        : chamadaAusente(`${caminho}.${propriedade}`, chamadasSemSubstituto),
    apply: () => {
      chamadasSemSubstituto.add(caminho);
      throw new Error(`${caminho} não existe no substituto do CI local`);
    },
  });
}

function comRegistroDoQueFalta(caminho, objeto, chamadasSemSubstituto, { registraNoAcesso = false } = {}) {
  return new Proxy(objeto, {
    get(alvo, propriedade, receptor) {
      if (typeof propriedade === 'symbol' || propriedade === 'then' || propriedade in alvo) {
        return Reflect.get(alvo, propriedade, receptor);
      }
      const chamada = `${caminho}.${propriedade}`;
      if (!registraNoAcesso) return chamadaAusente(chamada, chamadasSemSubstituto);
      chamadasSemSubstituto.add(chamada);
      return undefined;
    },
  });
}

function substitutoDoGithub({ dados, chamadasSemSubstituto }) {
  const listarArquivos = async () => dados.arquivosAlterados;
  const rest = {
    repos: {
      getContent: async ({ path: caminhoDoArquivo }) => {
        const conteudo = dados.arquivosDoRepo?.[caminhoDoArquivo];
        if (conteudo === undefined) throw erroDeHttp(404, `${caminhoDoArquivo} não existe na base`);
        return { data: { content: conteudo } };
      },
    },
    issues: {
      get: async ({ issue_number: numeroDaIssue }) => {
        const issue = dados.issues?.[String(numeroDaIssue)];
        if (!issue) throw erroDeHttp(404, `a issue #${numeroDaIssue} não existe`);
        return { data: issue };
      },
    },
    pulls: { listFiles: listarArquivos },
  };
  const paginar = async (metodo, parametros) => {
    if (metodo === listarArquivos) return listarArquivos(parametros);
    chamadasSemSubstituto.add('github.paginate com um método que não é pulls.listFiles');
    throw new Error('github.paginate só pagina pulls.listFiles no substituto do CI local');
  };
  const rotulado = {
    rest: comRegistroDoQueFalta(
      'github.rest',
      Object.fromEntries(
        Object.entries(rest).map(([grupo, metodos]) => [grupo, comRegistroDoQueFalta(`github.rest.${grupo}`, metodos, chamadasSemSubstituto)]),
      ),
      chamadasSemSubstituto,
    ),
    paginate: paginar,
  };
  return comRegistroDoQueFalta('github', rotulado, chamadasSemSubstituto);
}

function substitutoDoCore({ mensagens, chamadasSemSubstituto }) {
  const core = {
    info: texto => mensagens.informacoes.push(String(texto)),
    warning: texto => mensagens.avisos.push(String(texto)),
    setFailed: texto => mensagens.falhas.push(String(texto)),
  };
  return comRegistroDoQueFalta('core', core, chamadasSemSubstituto);
}

// dados: { pullRequest, repo: { owner, repo }, arquivosDoRepo: { <caminho>: <base64> },
//          issues: { <número>: { labels: [{ name }] } }, arquivosAlterados: [{ filename }] }
// Devolve { estado: 'passou' | 'falhou' | 'nao-reproduzivel', falhas, avisos, informacoes, motivo }.
export async function rodarScriptDoGithub({ script, dados }) {
  const mensagens = { falhas: [], avisos: [], informacoes: [] };
  const chamadasSemSubstituto = new Set();
  const contexto = comRegistroDoQueFalta(
    'context',
    { payload: { pull_request: dados.pullRequest }, repo: dados.repo },
    chamadasSemSubstituto,
    { registraNoAcesso: true },
  );
  const github = substitutoDoGithub({ dados, chamadasSemSubstituto });
  const core = substitutoDoCore({ mensagens, chamadasSemSubstituto });
  let erroDoScript = null;
  try {
    await new FuncaoAssincrona('context', 'github', 'core', 'Buffer', script)(contexto, github, core, Buffer);
  } catch (erro) {
    erroDoScript = erro;
  }
  if (chamadasSemSubstituto.size > 0) {
    return { estado: 'nao-reproduzivel', ...mensagens, motivo: `o script chama o que o substituto não oferece: ${[...chamadasSemSubstituto].join(', ')}` };
  }
  if (erroDoScript) {
    return { estado: 'nao-reproduzivel', ...mensagens, motivo: `o script lançou: ${erroDoScript.message}` };
  }
  return { estado: mensagens.falhas.length > 0 ? 'falhou' : 'passou', ...mensagens, motivo: '' };
}

// CLI: node vigia.mjs <arquivo-com-o-script> <arquivo-com-os-dados-em-json>
// Escreve as mensagens do script e a conclusão em stdout. Saída: 0 passou, 1 falhou, 3 não reproduzível.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [arquivoDoScript, arquivoDosDados] = process.argv.slice(2);
  const resultado = await rodarScriptDoGithub({
    script: fs.readFileSync(arquivoDoScript, 'utf8'),
    dados: JSON.parse(fs.readFileSync(arquivoDosDados, 'utf8')),
  });
  for (const aviso of resultado.avisos) console.log(`aviso: ${aviso}`);
  for (const falha of resultado.falhas) console.log(`falhou: ${falha}`);
  for (const informacao of resultado.informacoes) console.log(informacao);
  if (resultado.estado === 'nao-reproduzivel') console.log(`não reproduzível: ${resultado.motivo}`);
  process.exit(SAIDA_DO_ESTADO[resultado.estado]);
}
