#!/bin/sh
# Teste local de ponta a ponta de um banco: histórico pequeno, ritmo com pico e reenvio,
# queda do servidor no meio, bateria de buscas e conferência das confirmações.
# Uso: sh scripts/testar-local.sh clickhouse|opensearch|postgres
set -eu
set -o pipefail
nome_banco="$1"
nome_rodada="ponta-a-ponta"
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
. "$pasta_prova/scripts/comum-local.sh"

# Controle negativo: copia um evento já gravado por fora do servidor.
plantar_duplicata() {
  case "$nome_banco" in
    clickhouse)
      curl -fsS "$endereco_banco" -d "INSERT INTO eventos ($colunas) SELECT $colunas FROM eventos WHERE execucao = 'ritmo1' LIMIT 1" ;;
    postgres)
      sql_postgres "INSERT INTO eventos ($colunas) SELECT $colunas FROM eventos WHERE execucao = 'ritmo1' LIMIT 1" ;;
    opensearch)
      curl -fsS "$endereco_banco/eventos-*/_search?size=1&q=execucao:ritmo1" | python3 -c '
import json, sys, urllib.request
acerto = json.load(sys.stdin)["hits"]["hits"][0]
pedido = urllib.request.Request(sys.argv[1] + "/" + acerto["_index"] + "/_doc/duplicata-plantada?refresh=true",
    json.dumps(acerto["_source"]).encode(), {"content-type": "application/json"}, method="PUT")
urllib.request.urlopen(pedido).read()' "$endereco_banco" ;;
  esac
}

esperar_banco
limpar_banco
subir_servidor
trap 'kill "$pid_servidor" 2>/dev/null || true' EXIT

echo "== histórico (2 dias de 20 mil eventos)"
gerador historico hist historico --dias 2 --eventos-por-dia 20000 --tamanho-lote 200

echo "== ritmo: 150 s, pico de 120/s aos 30 s, reenvio aos 40 s, servidor cai aos 75 s"
gerador ritmo ritmo1 ritmo --duracao-s 150 --picos 30:30:120 --reenvio-apos-s 40 &
pid_gerador=$!
sleep 75
derrubar_servidor
sleep 3
subir_servidor
wait "$pid_gerador"

echo "== bateria de buscas"
gerador bateria bateria bateria --rotulo local

sleep 8
echo "== conferência"
"$binarios/conferidor" --servidor "$endereco_servidor" \
  --confirmados "$resultados/historico/confirmados.log" \
  --confirmados "$resultados/ritmo/confirmados.log" | tee "$resultados/conferencia.txt"

echo "== relatório do ritmo"
"$binarios/relatorio" --pasta "$resultados/ritmo" > "$resultados/relatorio-ritmo.txt"
"$binarios/relatorio" --pasta "$resultados/bateria" > "$resultados/relatorio-bateria.txt"
head -3 "$resultados/relatorio-ritmo.txt"

echo "== controle negativo: o conferidor precisa reprovar"
cp "$resultados/ritmo/confirmados.log" "$resultados/confirmados-com-perda.log"
echo "excurfly-api ritmo1 900000 900002 $(date +%s)000" >>"$resultados/confirmados-com-perda.log"
if "$binarios/conferidor" --servidor "$endereco_servidor" --confirmados "$resultados/confirmados-com-perda.log"; then
  falhar "perda plantada não foi detectada"
fi
plantar_duplicata
sleep 6
if "$binarios/conferidor" --servidor "$endereco_servidor" --confirmados "$resultados/ritmo/confirmados.log"; then
  falhar "duplicata plantada não foi detectada"
fi
echo "controle negativo ok"
