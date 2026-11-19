# Funções dos testes locais. Quem inclui define nome_banco, pasta_prova e nome_rodada.
binarios="$pasta_prova/bancada/target/release"
resultados="$pasta_prova/resultados-locais/$nome_rodada/$nome_banco"
porta_servidor=18080
endereco_servidor="http://127.0.0.1:$porta_servidor"
colunas="id, ts_ms, recebido_ms, produto, aplicacao, execucao, seq, url, valor_centavos, termos, palavras, corpo, campos"

case "$nome_banco" in
  clickhouse) endereco_banco="http://127.0.0.1:18123/" ;;
  opensearch) endereco_banco="http://127.0.0.1:19200" ;;
  postgres) endereco_banco="host=127.0.0.1 port=15432 user=postgres dbname=prova" ;;
  *) echo "banco desconhecido: $nome_banco" >&2; exit 2 ;;
esac

rm -rf "$resultados"
mkdir -p "$resultados"

compose_prova() {
  docker compose -f "$pasta_prova/compose.yml" ${COMPOSE_EXTRA:+-f "$COMPOSE_EXTRA"} "$@"
}

sql_postgres() {
  compose_prova exec -T postgres psql -q -U postgres -d prova -v ON_ERROR_STOP=1 -c "$1"
}

esperar_banco() {
  tentativas=0
  until case "$nome_banco" in
    clickhouse) curl -fsS "${endereco_banco}ping" >/dev/null 2>&1 ;;
    opensearch) curl -fsS "$endereco_banco/_cluster/health" >/dev/null 2>&1 ;;
    postgres) compose_prova exec -T postgres pg_isready -q -U postgres -d prova >/dev/null 2>&1 ;;
  esac; do
    tentativas=$((tentativas + 1))
    if [ "$tentativas" -gt 180 ]; then echo "banco não respondeu" >&2; exit 1; fi
    sleep 1
  done
}

limpar_banco() {
  case "$nome_banco" in
    clickhouse) curl -fsS "$endereco_banco" -d 'DROP TABLE IF EXISTS eventos SYNC' ;;
    opensearch) curl -fsS -o /dev/null -X DELETE "$endereco_banco/eventos-*" ;;
    postgres) sql_postgres 'DROP TABLE IF EXISTS eventos CASCADE' 2>/dev/null ;;
  esac
}

subir_servidor() {
  BANCO="$nome_banco" ENDERECO_BANCO="$endereco_banco" PORTA="$porta_servidor" PASTA_DADOS="$resultados" \
    RESERVA_BYTES="${reserva_bytes:-0}" "$binarios/servidor" >>"$resultados/servidor.log" 2>&1 &
  pid_servidor=$!
  tentativas=0
  until curl -fsS "$endereco_servidor/saude" >/dev/null 2>&1; do
    tentativas=$((tentativas + 1))
    if [ "$tentativas" -gt 240 ]; then echo "servidor não subiu" >&2; exit 1; fi
    sleep 0.5
  done
}

derrubar_servidor() {
  kill -9 "$pid_servidor" 2>/dev/null || true
  wait "$pid_servidor" 2>/dev/null || true
}

gerador() {
  pasta_saida="$1"; execucao="$2"; shift 2
  "$binarios/gerador" --servidor "$endereco_servidor" --saida "$resultados/$pasta_saida" --execucao "$execucao" "$@"
}

# Conta as linhas de uma busca. Uso: contar_linhas desde_ms ate_ms termo
contar_linhas() {
  curl -fsS "$endereco_servidor/v1/busca" -H 'content-type: application/json' \
    -d "{\"consulta\":{\"desde_ms\":$1,\"ate_ms\":$2,\"termos\":[\"$3\"],\"limite\":100}}" |
    python3 -c 'import json, sys; print(len(json.load(sys.stdin)["linhas"]))'
}

agora_em_ms() {
  echo "$(date +%s)000"
}

falhar() {
  echo "FALHA: $1"
  exit 1
}
