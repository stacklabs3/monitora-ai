#!/usr/bin/env bash
# CI local de uma PR: reproduz na máquina o que o GitHub roda nela e escreve o relatório em markdown.
# Para quando o GitHub Actions está sem cota, ou para conferir antes do merge. Modelo: o
# scripts/ci-local.sh do excurfly, sem o Docker, porque o CI daqui não tem build nem serviço.
#
# uso: scripts/ci-local.sh <número-da-pr> <pasta-do-relatório>
#
# Como o GitHub: a cabeça da PR vem por refs/pull/<pr>/head (sobrevive à branch apagada) e é
# mesclada sobre a base de hoje numa worktree temporária; conflito sai 2 ("não mescla limpo").
# Na worktree do merge rodam, na ordem:
#   1. vigia-do-metodo: o `actions/github-script` do .github/workflows/vigia-do-metodo.yml, com o
#      texto lido do próprio workflow da worktree e rodado no host pelo scripts/ci-local/vigia.mjs,
#      com os dados da PR lidos pelo `gh`. Chamada que o substituto não oferece sai "não reproduzível".
#   2. validador: `sh .claude/watchdogs/rodar validar --base origin/<base>` (docs/agents/validador.md).
#      Só VALIDADOR: APROVADO passa. Sem docs/regras-de-codigo.json o job sai "pulado" e não
#      reprova, como o `rodar ci` (o mapa de Regras de código ainda não gerou as regras).
# O relatório nunca diz "passou" no que não conferiu: job não reproduzível impede o "tudo passou".
#
# Uma execução por vez na máquina: a vaga é a trava $HOME/.stacklabs/ci-local-vaga-monitora-ai.lock
# (mkdir; dono morto se retoma pelo kill -0). Ocupada, o script espera sozinho, checando a cada 15 s.
#
# Saída: 0 tudo passou; 1 algum job falhou ou não foi reproduzível; 2 não deu para montar.
# O relatório fica em <pasta>/ci-local-<pr>.md e os logs de cada job em <pasta>/ci-local-<pr>/.
set -uo pipefail

if [ $# -ne 2 ]; then
  echo "uso: $0 <número-da-pr> <pasta-do-relatório>" >&2
  exit 2
fi
numeroPr=$1
mkdir -p "$2"
pastaDoRelatorio=$(cd "$2" && pwd)
repositorio=${CI_LOCAL_REPOSITORIO:-stacklabs3/monitora-ai}
pastaDosScripts=$(cd "$(dirname "$0")" && pwd)
raizDoRepo=$(git -C "$pastaDosScripts" rev-parse --show-toplevel)
pastaTemporaria=${CI_LOCAL_TMP:-${TMPDIR:-/tmp}}
worktree=${pastaTemporaria%/}/ci-local-monitora-ai-$numeroPr
pastaDosLogs=$pastaDoRelatorio/ci-local-$numeroPr
relatorio=$pastaDoRelatorio/ci-local-$numeroPr.md
travaDaVaga=$HOME/.stacklabs/ci-local-vaga-monitora-ai.lock
vagaPega=''

horaDeBrasilia() {
  TZ=America/Sao_Paulo date '+%d/%m/%Y %H:%M'
}

removerWorktree() {
  git -C "$raizDoRepo" worktree remove --force "$worktree" > /dev/null 2>&1
  rm -rf "$worktree"
  git -C "$raizDoRepo" worktree prune
}

soltarVaga() {
  removerWorktree
  [ -z "$vagaPega" ] || rm -rf "$travaDaVaga"
}

pararSemMontar() {
  echo "✗ $1" >&2
  printf '# CI local da PR #%s\n\nNão rodou: %s\n\nResultado: não montou\n' "$numeroPr" "$1" > "$relatorio"
  exit 2
}

pegarVaga() {
  local donoDaVaga avisouEspera=''
  mkdir -p "$(dirname "$travaDaVaga")"
  while ! mkdir "$travaDaVaga" 2> /dev/null; do
    donoDaVaga=$(cat "$travaDaVaga/pid" 2> /dev/null)
    if [ -n "$donoDaVaga" ] && ! kill -0 "$donoDaVaga" 2> /dev/null; then
      rm -rf "$travaDaVaga"
      continue
    fi
    [ -n "$avisouEspera" ] || echo "■ vaga ocupada pelo processo ${donoDaVaga:-?}: esperando"
    avisouEspera=1
    sleep 15
  done
  echo $$ > "$travaDaVaga/pid"
  vagaPega=1
  echo "■ vaga do CI local pega"
}

pegarVaga
trap soltarVaga EXIT
removerWorktree
rm -rf "$pastaDosLogs"
mkdir -p "$pastaDosLogs"

dadosDaPr=$(gh pr view "$numeroPr" --repo "$repositorio" \
  --json number,title,body,baseRefName,headRefName,headRefOid,createdAt,labels) \
  || pararSemMontar "a PR #$numeroPr não foi encontrada em $repositorio"
branchBase=$(jq -r .baseRefName <<< "$dadosDaPr")
branchDaPr=$(jq -r .headRefName <<< "$dadosDaPr")
cabecaDaPr=$(jq -r .headRefOid <<< "$dadosDaPr")
tituloDaPr=$(jq -r .title <<< "$dadosDaPr")

git -C "$raizDoRepo" fetch --quiet origin "+refs/heads/$branchBase:refs/remotes/origin/$branchBase" \
  "+refs/pull/$numeroPr/head:refs/ci-local/pr-$numeroPr" \
  || pararSemMontar "o fetch da base $branchBase ou da cabeça da PR falhou"
cabecaBuscada=$(git -C "$raizDoRepo" rev-parse "refs/ci-local/pr-$numeroPr")
[ "$cabecaBuscada" = "$cabecaDaPr" ] \
  || pararSemMontar "a cabeça buscada ($cabecaBuscada) não é a da PR ($cabecaDaPr): rode de novo"
baseDoMerge=$(git -C "$raizDoRepo" rev-parse "origin/$branchBase")

git -C "$raizDoRepo" worktree add --quiet --detach "$worktree" "$baseDoMerge" \
  || pararSemMontar "não consegui criar a worktree $worktree"
git -C "$worktree" -c user.name=ci-local -c user.email=ci-local@localhost \
  merge --quiet --no-ff --no-edit "$cabecaDaPr" > "$pastaDosLogs/merge.log" 2>&1 \
  || pararSemMontar "a PR não mescla limpo sobre origin/$branchBase ($baseDoMerge)"
echo "■ PR #$numeroPr ($branchDaPr @ ${cabecaDaPr:0:7}) mesclada sobre origin/$branchBase @ ${baseDoMerge:0:7}"

linhasDosJobs=()
jobsQueFalharam=()

registrarJob() {
  local nomeDoJob=$1 estadoDoJob=$2 resumoDoJob=$3
  linhasDosJobs+=("| $nomeDoJob | $estadoDoJob | $resumoDoJob |")
  case $estadoDoJob in passou | pulado) ;; *) jobsQueFalharam+=("$nomeDoJob ($estadoDoJob)") ;; esac
  echo "■ $nomeDoJob: $estadoDoJob${resumoDoJob:+ — $resumoDoJob}"
}

# Job 1: o vigia-do-metodo, com o script lido do workflow da worktree do merge.
rodarVigia() {
  local workflowDoVigia=$worktree/.github/workflows/vigia-do-metodo.yml
  local arquivoDoScript=$pastaDosLogs/vigia-script.js
  local arquivoDosDados=$pastaDosLogs/vigia-dados.json
  local logDoVigia=$pastaDosLogs/vigia-do-metodo.log
  local metodoDaBase arquivosAlterados issueDaBranch issuesDaBranch='{}' saidaDoVigia
  if [ ! -f "$workflowDoVigia" ]; then
    registrarJob vigia-do-metodo "não reproduzível" "o workflow não existe na worktree do merge"
    return
  fi
  awk '
    !dentro && /^[[:space:]]*script:[[:space:]]*\|[[:space:]]*$/ {
      dentro = 1; match($0, /^[[:space:]]*/); recuoDaChave = RLENGTH; next
    }
    dentro {
      if ($0 ~ /^[[:space:]]*$/) { print ""; next }
      match($0, /^[[:space:]]*/)
      if (RLENGTH <= recuoDaChave) exit
      if (!recuoDoBloco) recuoDoBloco = RLENGTH
      print substr($0, recuoDoBloco + 1)
    }
  ' "$workflowDoVigia" > "$arquivoDoScript"
  if [ ! -s "$arquivoDoScript" ]; then
    registrarJob vigia-do-metodo "não reproduzível" "não achei o bloco script: do github-script"
    return
  fi
  metodoDaBase=$(git -C "$raizDoRepo" show "$baseDoMerge:.claude/metodo.json" 2> /dev/null | base64 | tr -d '\n')
  arquivosAlterados=$(git -C "$worktree" diff --name-only HEAD^1 HEAD | jq -R . | jq -s 'map({filename: .})')
  issueDaBranch=$(sed -nE 's|^issue/([0-9]+)-.*|\1|p' <<< "$branchDaPr")
  if [ -n "$issueDaBranch" ]; then
    issuesDaBranch=$(gh issue view "$issueDaBranch" --repo "$repositorio" --json labels \
      --jq "{\"$issueDaBranch\": {labels: [.labels[] | {name}]}}" 2> /dev/null) || issuesDaBranch='{}'
  fi
  jq -n \
    --argjson pr "$dadosDaPr" \
    --arg dono "${repositorio%%/*}" --arg nomeDoRepo "${repositorio#*/}" \
    --arg metodoDaBase "$metodoDaBase" \
    --argjson issues "$issuesDaBranch" \
    --argjson arquivosAlterados "$arquivosAlterados" \
    '{
      pullRequest: {
        number: $pr.number, title: $pr.title, body: $pr.body, created_at: $pr.createdAt,
        head: {ref: $pr.headRefName, sha: $pr.headRefOid}, base: {ref: $pr.baseRefName},
        labels: [$pr.labels[] | {name}]
      },
      repo: {owner: $dono, repo: $nomeDoRepo},
      arquivosDoRepo: (if $metodoDaBase == "" then {} else {".claude/metodo.json": $metodoDaBase} end),
      issues: $issues,
      arquivosAlterados: $arquivosAlterados
    }' > "$arquivoDosDados"
  node "$pastaDosScripts/ci-local/vigia.mjs" "$arquivoDoScript" "$arquivoDosDados" > "$logDoVigia" 2>&1
  saidaDoVigia=$?
  case $saidaDoVigia in
    0) registrarJob vigia-do-metodo passou "$(tail -n 1 "$logDoVigia")" ;;
    1) registrarJob vigia-do-metodo falhou "$(grep -m 1 -A 3 '^falhou:' "$logDoVigia" | tr '\n' ' ' | sed 's/|/\\|/g')" ;;
    *) registrarJob vigia-do-metodo "não reproduzível" "$(grep -m 1 'não reproduzível' "$logDoVigia" || tail -n 1 "$logDoVigia")" ;;
  esac
}

# Job 2: o validador das regras de código, só no que mudou desde a base.
rodarValidador() {
  local logDoValidador=$pastaDosLogs/validador.log
  if [ ! -f "$worktree/docs/regras-de-codigo.json" ]; then
    registrarJob validador pulado "sem docs/regras-de-codigo.json: o mapa de Regras de código ainda não gerou as regras (como o rodar ci)"
    return
  fi
  (cd "$worktree" && sh .claude/watchdogs/rodar validar --base "origin/$branchBase") > "$logDoValidador" 2>&1
  if grep -q 'VALIDADOR: APROVADO' "$logDoValidador"; then
    registrarJob validador passou "VALIDADOR: APROVADO"
  elif grep -q 'VALIDADOR: REPROVADO' "$logDoValidador"; then
    registrarJob validador falhou "VALIDADOR: REPROVADO (ver validador.log)"
  else
    registrarJob validador "não reproduzível" "$(tail -n 1 "$logDoValidador" | sed 's/|/\\|/g')"
  fi
}

rodarVigia
rodarValidador

if [ ${#jobsQueFalharam[@]} -eq 0 ]; then
  linhaDoResultado="Resultado: tudo passou"
  saidaDoScript=0
else
  linhaDoResultado="Resultado: falhou — $(IFS=,; echo "${jobsQueFalharam[*]}" | sed 's/,/, /g')"
  saidaDoScript=1
fi

{
  echo "# CI local da PR #$numeroPr"
  echo
  echo "- PR: $tituloDaPr"
  echo "- Branch: \`$branchDaPr\`"
  echo "- Cabeça da PR: \`$cabecaDaPr\`"
  echo "- Base: \`origin/$branchBase\` @ \`$baseDoMerge\`"
  echo "- Rodou em: $(horaDeBrasilia) (Brasília), pelo \`scripts/ci-local.sh\`"
  echo
  echo "| Job | Estado | Resumo |"
  echo "|---|---|---|"
  printf '%s\n' "${linhasDosJobs[@]}"
  echo
  echo "Logs: \`$pastaDosLogs/\`"
  echo
  echo "$linhaDoResultado"
} > "$relatorio"

echo "$linhaDoResultado"
echo "relatório: $relatorio"
exit $saidaDoScript
