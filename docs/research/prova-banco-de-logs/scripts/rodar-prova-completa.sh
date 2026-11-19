#!/bin/sh
# Roda a prova simulada completa (ESCALA=1) nos três bancos, um por vez, e guarda os resumos no git.
# Feito para rodar desligado da sessão:
#   perl -MPOSIX -e 'setsid(); exec @ARGV' nohup sh scripts/rodar-prova-completa.sh >/dev/null 2>&1 &
# Retoma de onde parou: cada banco retoma da última fase concluída.
set -eu
set -o pipefail
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
pasta_resultados="$pasta_prova/resultados-simulacao"
registro="$pasta_resultados/orquestrador.log"
branch_prova=research/prova-banco-de-logs
intervalo_commit_s=7200
mkdir -p "$pasta_resultados"
. "$pasta_prova/scripts/comum-tempo.sh"

registrar() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >>"$registro"; }

# Só os resumos da prova entram no commit; outras mudanças da pasta ficam como estão.
guardar_resumos() {
  cd "$pasta_prova"
  git add -- resultados-simulacao >/dev/null 2>&1 || { registrar "git add falhou"; return 0; }
  if git diff --cached --quiet -- resultados-simulacao; then return 0; fi
  if git commit -q -m "docs: resultados simulados da prova ($1)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- resultados-simulacao >>"$registro" 2>&1; then
    com_limite 300 git push -q origin "$branch_prova" >>"$registro" 2>&1 || registrar "push falhou; tenta de novo no próximo"
  else
    registrar "commit falhou; tenta de novo no próximo"
  fi
}

guardar_periodicamente() {
  while :; do
    sleep "$intervalo_commit_s"
    guardar_resumos "andamento" || true
  done
}

echo $$ >"$pasta_resultados/orquestrador.pid"
registrar "início da prova completa"
guardar_periodicamente & pid_guardador=$!
trap 'kill "$pid_guardador" 2>/dev/null || true' EXIT

for nome_banco in postgres clickhouse opensearch; do
  registrar "início $nome_banco"
  codigo_banco=0
  caffeinate -i sh "$pasta_prova/scripts/simular-prova.sh" "$nome_banco" >>"$registro" 2>&1 || codigo_banco=$?
  registrar "fim $nome_banco: saída $codigo_banco"
  guardar_resumos "$nome_banco"
done
registrar "prova completa encerrada"
guardar_resumos "fim"
