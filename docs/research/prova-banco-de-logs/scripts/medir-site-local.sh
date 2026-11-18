#!/bin/sh
# Ensaio local das publicações do site Next sintético. Na Vercel o encerramento é outro:
# este ensaio prova a medição, não o comportamento de lá.
# Uso: sh scripts/medir-site-local.sh [publicacoes]
set -eu
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
publicacoes="${1:-20}"
pasta_resultados="$pasta_prova/resultados-locais/site"
mkdir -p "$pasta_resultados"
cp "$pasta_prova/medicao-node/biblioteca.mjs" "$pasta_prova/medicao-node/site-next/biblioteca.mjs"
docker run --rm --cpus 2 --memory 2g -e NEXT_TELEMETRY_DISABLED=1 \
  -v "$pasta_prova/medicao-node:/medicao" -v "$pasta_resultados:/resultados" -w /medicao/site-next node:22-slim \
  sh -c "npm install --no-audit --no-fund --silent && node_modules/.bin/next build >/resultados/build.log 2>&1 && cd .. && node medir-site.mjs /resultados/site.json $publicacoes && node medir-site.mjs /resultados/site-controle.json 3 SIGKILL"
python3 - "$pasta_resultados/site-controle.json" <<'FIM'
import json, sys
controle = json.load(open(sys.argv[1]))
if controle["avisosPodeTerPerdidoMais"] != controle["publicacoes"]:
    sys.exit("FALHA: o controle negativo não gerou os avisos esperados")
print("controle negativo ok:", controle["avisosPodeTerPerdidoMais"], "avisos em", controle["publicacoes"], "publicações")
FIM
