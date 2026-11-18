#!/bin/sh
# Mede a biblioteca sintética em Node 20, 22 e 24, cada um em contêiner com 2 CPUs.
# Uso: sh scripts/medir-node-local.sh [segundos_por_cenario] [segundos_fora]
set -eu
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
segundos_por_cenario="${1:-15}"
segundos_fora="${2:-20}"
pasta_resultados="$pasta_prova/resultados-locais/node"
mkdir -p "$pasta_resultados"
docker run --rm -v "$pasta_prova/medicao-node:/medicao" -w /medicao node:20-slim npm install --no-audit --no-fund --silent
situacao_final=0
for versao_node in 20 22 24; do
  if ! docker run --rm --cpus 2 --memory 1g -v "$pasta_prova/medicao-node:/medicao:ro" -v "$pasta_resultados:/resultados" -w /medicao \
    "node:$versao_node-slim" node medir.mjs "/resultados/node-$versao_node.json" "$segundos_por_cenario" "$segundos_fora"; then
    situacao_final=1
  fi
done
exit "$situacao_final"
