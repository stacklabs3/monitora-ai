#!/bin/sh
# Ensaio local de busca lenta (corte, recusa da terceira, busca garantida no meio) e degraus de carga.
# Uso: sh scripts/testar-limites-local.sh clickhouse|opensearch|postgres
set -eu
nome_banco="$1"
nome_rodada="limites"
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
. "$pasta_prova/scripts/comum-local.sh"

# Prazo curto só neste ensaio, para o corte acontecer com pouco dado.
PRAZO_BUSCA_LENTA_MS=5
MARGEM_CORTE_MS=20
export PRAZO_BUSCA_LENTA_MS MARGEM_CORTE_MS

esperar_banco
limpar_banco
subir_servidor
trap 'kill "$pid_servidor" 2>/dev/null || true' EXIT

echo "== histórico"
gerador historico hist historico --dias 3 --eventos-por-dia 100000 --tamanho-lote 500 >/dev/null

echo "== 8 buscas lentas simultâneas"
gerador lentas lentas lentas --simultaneas 8 >/dev/null
"$binarios/relatorio" --pasta "$resultados/lentas" >"$resultados/relatorio-lentas.txt"
grep '^busca' "$resultados/relatorio-lentas.txt" | cut -c1-130
recusadas=$(awk -F, 'NR>1 && $2=="lentas" && $8=="recusada"' "$resultados/lentas/buscas.csv" | wc -l | tr -d ' ')
parciais=$(awk -F, 'NR>1 && $2=="lentas" && $7=="true"' "$resultados/lentas/buscas.csv" | wc -l | tr -d ' ')
garantidas_ok=$(awk -F, 'NR>1 && $2=="durante-lentas" && $8=="ok"' "$resultados/lentas/buscas.csv" | wc -l | tr -d ' ')
echo "recusadas=$recusadas parciais=$parciais garantidas_ok=$garantidas_ok"
[ "$recusadas" -gt 0 ] || falhar "nenhuma busca lenta foi recusada"
[ "$parciais" -gt 0 ] || falhar "nenhuma busca lenta foi cortada"
[ "$garantidas_ok" -eq 1 ] || falhar "busca garantida falhou durante as lentas"

echo "== degraus de carga"
sh "$pasta_prova/scripts/degraus-de-carga.sh" "$binarios" "$endereco_servidor" "$resultados/degraus" 12 15 48 |
  tee "$resultados/degraus.txt"
grep -q 'maior carga aprovada: 48 ' "$resultados/degraus.txt" || falhar "degraus não chegaram a 48/s"

echo "== controle negativo: meta impossível precisa parar no primeiro degrau"
sh "$pasta_prova/scripts/degraus-de-carga.sh" "$binarios" "$endereco_servidor" "$resultados/degraus-negativo" 12 10 48 \
  --meta-confirmar-ms 1 | tee "$resultados/degraus-negativo.txt"
grep -q 'maior carga aprovada: 0 ' "$resultados/degraus-negativo.txt" || falhar "meta impossível passou"
echo "limites locais ok"
