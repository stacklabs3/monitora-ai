#!/usr/bin/env bash
# Integra uma PR na main com squash merge, depois de conferir a prova do CI, e confere pela fonte (a
# main do origin) que o merge entrou. Roda da sessão principal ou da Torre: o subagente de workflow
# tem o `gh pr merge` negado. Modelo: o scripts/agents/integrar-item.sh do excurfly, que integra na
# dev; aqui a base é a main, a branch padrão, e o `Closes #<n>` do corpo fecha a issue sozinho.
#
# uso: scripts/agents/integrar-item.sh <pr> [--relatorio <ci-local.md> | --sem-ci]
#
#   --relatorio  o relatório do scripts/ci-local.sh: precisa dizer "Resultado: tudo passou" e ter sido
#                tirado da cabeça atual da PR. É comentado na PR e vale como prova no lugar dos checks
#                do GitHub (Actions sem cota).
#   --sem-ci     a fila do lote (AGENTS.md da Torre, "CI por lote"): a prova da PR é a checagem rápida do
#                push, o revisor e o conferente, e o CI completo fica para a fila de ajustes do fim do
#                lote. Comenta isso na PR e mergeia.
#   sem nenhum   todo check do GitHub na PR precisa estar verde (SUCCESS ou SKIPPED).
#
# INTEGRAR_BASE troca a branch que recebe o merge (padrão main), para ensaiar contra uma base
# descartável sem tocar a main.
#
# Saída: 0 mesclada e conferida na base; 1 prova, merge ou conferência falhou; 2 uso errado.
set -uo pipefail
repositorio=${INTEGRAR_REPOSITORIO:-stacklabs3/monitora-ai}
branchQueRecebe=${INTEGRAR_BASE:-main}
uso="uso: $0 <pr> [--relatorio <ci-local.md> | --sem-ci]"

[ $# -ge 1 ] || { echo "$uso" >&2; exit 2; }
numeroPr=$1
shift
arquivoDoRelatorio=''
semCi=''
while [ $# -gt 0 ]; do
  case "$1" in
    --relatorio)
      [ $# -ge 2 ] || { echo "$uso" >&2; exit 2; }
      arquivoDoRelatorio=$2
      shift 2
      ;;
    --sem-ci) semCi=1; shift ;;
    *) echo "$uso" >&2; exit 2 ;;
  esac
done

if [ -n "$arquivoDoRelatorio" ] && [ -n "$semCi" ]; then
  echo "--relatorio e --sem-ci não andam juntos" >&2
  exit 2
fi

dadosDaPr=$(gh pr view "$numeroPr" --repo "$repositorio" --json state,baseRefName,headRefOid) \
  || { echo "a PR #$numeroPr não foi encontrada em $repositorio"; exit 1; }
estadoAntes=$(jq -r .state <<< "$dadosDaPr")
branchBase=$(jq -r .baseRefName <<< "$dadosDaPr")
cabecaDaPr=$(jq -r .headRefOid <<< "$dadosDaPr")
[ "$estadoAntes" = OPEN ] || { echo "a PR #$numeroPr não está aberta ($estadoAntes)"; exit 1; }
[ "$branchBase" = "$branchQueRecebe" ] \
  || { echo "a PR #$numeroPr mira $branchBase, não $branchQueRecebe: não integro"; exit 1; }

if [ -n "$semCi" ]; then
  gh pr comment "$numeroPr" --repo "$repositorio" --body "CI completo adiado para a fila de ajustes do fim do lote: a prova desta PR é a checagem rápida do push, o revisor e o conferente." > /dev/null || exit 1
  echo "PR #$numeroPr sem CI completo: vai na fila de ajustes do lote"
elif [ -n "$arquivoDoRelatorio" ]; then
  [ -f "$arquivoDoRelatorio" ] || { echo "o relatório $arquivoDoRelatorio não existe"; exit 1; }
  grep -q '^Resultado: tudo passou' "$arquivoDoRelatorio" \
    || { echo "o relatório $arquivoDoRelatorio não diz que tudo passou"; exit 1; }
  grep -q "^# CI local da PR #$numeroPr\$" "$arquivoDoRelatorio" \
    || { echo "o relatório $arquivoDoRelatorio não é da PR #$numeroPr"; exit 1; }
  grep -q "Cabeça da PR: \`$cabecaDaPr\`" "$arquivoDoRelatorio" \
    || { echo "o relatório não é da cabeça atual da PR (${cabecaDaPr:0:7}): rode o scripts/ci-local.sh de novo"; exit 1; }
  gh pr comment "$numeroPr" --repo "$repositorio" --body-file "$arquivoDoRelatorio" > /dev/null || exit 1
  echo "relatório do CI local comentado na PR #$numeroPr"
else
  checksNaoVerdes=$(gh pr view "$numeroPr" --repo "$repositorio" --json statusCheckRollup \
    --jq '[.statusCheckRollup[] | select(.conclusion != "SUCCESS" and .conclusion != "SKIPPED") | (.name // .context)] | join(", ")')
  [ -z "$checksNaoVerdes" ] || { echo "CI do GitHub não está verde: $checksNaoVerdes"; exit 1; }
fi

# --match-head-commit: se a PR ganhou commit depois da prova, o GitHub recusa o merge.
gh pr merge "$numeroPr" --repo "$repositorio" --squash --delete-branch --match-head-commit "$cabecaDaPr" \
  || { echo "o merge da PR #$numeroPr falhou"; exit 1; }

dadosDepois=$(gh pr view "$numeroPr" --repo "$repositorio" --json state,mergeCommit)
estadoDepois=$(jq -r .state <<< "$dadosDepois")
commitDoMerge=$(jq -r '.mergeCommit.oid // empty' <<< "$dadosDepois")
echo "PR #$numeroPr: $estadoDepois"
[ "$estadoDepois" = MERGED ] && [ -n "$commitDoMerge" ] || exit 1

# Conferência pela fonte: o commit do merge está na branch que recebe, no origin.
pontaDaBase=$(git ls-remote origin "refs/heads/$branchQueRecebe" | cut -f1)
git fetch --quiet origin "+refs/heads/$branchQueRecebe:refs/remotes/origin/$branchQueRecebe" \
  || { echo "o fetch de origin/$branchQueRecebe falhou: confira à mão"; exit 1; }
if git merge-base --is-ancestor "$commitDoMerge" "origin/$branchQueRecebe"; then
  echo "conferido: ${commitDoMerge:0:7} está em origin/$branchQueRecebe (ponta ${pontaDaBase:0:7})"
else
  echo "o commit do merge ${commitDoMerge:0:7} não está em origin/$branchQueRecebe"
  exit 1
fi
