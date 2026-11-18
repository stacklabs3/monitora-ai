#!/bin/sh
# Teste local de ponta a ponta de um banco: histórico pequeno, ritmo com pico e reenvio,
# queda do servidor no meio, bateria de buscas e conferência das confirmações.
# Uso: sh scripts/testar-local.sh clickhouse|opensearch|postgres
set -eu
nome_banco="$1"
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
binarios="$pasta_prova/bancada/target/release"
resultados="$pasta_prova/resultados-locais/$nome_banco"
porta_servidor=18080
endereco_servidor="http://127.0.0.1:$porta_servidor"

case "$nome_banco" in
  clickhouse) endereco_banco="http://127.0.0.1:18123/" ;;
  opensearch) endereco_banco="http://127.0.0.1:19200" ;;
  postgres) endereco_banco="host=127.0.0.1 port=15432 user=postgres dbname=prova" ;;
  *) echo "banco desconhecido: $nome_banco" >&2; exit 2 ;;
esac

rm -rf "$resultados"
mkdir -p "$resultados"

subir_servidor() {
  BANCO="$nome_banco" ENDERECO_BANCO="$endereco_banco" PORTA="$porta_servidor" PASTA_DADOS="$resultados" \
    "$binarios/servidor" >>"$resultados/servidor.log" 2>&1 &
  pid_servidor=$!
  tentativas=0
  until curl -fsS "$endereco_servidor/saude" >/dev/null 2>&1; do
    tentativas=$((tentativas + 1))
    if [ "$tentativas" -gt 240 ]; then echo "servidor não subiu" >&2; exit 1; fi
    sleep 0.5
  done
}

gerador() {
  pasta_saida="$1"; execucao="$2"; shift 2
  "$binarios/gerador" --servidor "$endereco_servidor" --saida "$resultados/$pasta_saida" --execucao "$execucao" "$@"
}

colunas="id, ts_ms, recebido_ms, produto, aplicacao, execucao, seq, url, valor_centavos, termos, palavras, corpo, campos"

sql_postgres() {
  docker compose -f "$pasta_prova/compose.yml" exec -T postgres psql -q -U postgres -d prova -v ON_ERROR_STOP=1 -c "$1"
}

limpar_banco() {
  case "$nome_banco" in
    clickhouse) curl -fsS "$endereco_banco" -d 'DROP TABLE IF EXISTS eventos SYNC' ;;
    opensearch) curl -fsS -o /dev/null -X DELETE "$endereco_banco/eventos-*" ;;
    postgres) sql_postgres 'DROP TABLE IF EXISTS eventos CASCADE' ;;
  esac
}

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

limpar_banco
subir_servidor
trap 'kill "$pid_servidor" 2>/dev/null || true' EXIT

echo "== histórico (2 dias de 20 mil eventos)"
gerador historico hist historico --dias 2 --eventos-por-dia 20000 --tamanho-lote 200

echo "== ritmo: 150 s, pico de 120/s aos 30 s, reenvio aos 40 s, servidor cai aos 75 s"
gerador ritmo ritmo1 ritmo --duracao-s 150 --picos 30:30:120 --reenvio-apos-s 40 &
pid_gerador=$!
sleep 75
kill -9 "$pid_servidor"
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
  echo "FALHA: perda plantada não foi detectada"; exit 1
fi
plantar_duplicata
sleep 6
if "$binarios/conferidor" --servidor "$endereco_servidor" --confirmados "$resultados/ritmo/confirmados.log"; then
  echo "FALHA: duplicata plantada não foi detectada"; exit 1
fi
echo "controle negativo ok"
