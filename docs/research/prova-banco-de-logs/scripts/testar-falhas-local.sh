#!/bin/sh
# Ensaio local, em escala reduzida, de banco fora, disco cheio e exclusões.
# Confere se a bancada detecta o resultado; os tempos reais do #9 rodam na máquina-alvo.
# Uso: sh scripts/testar-falhas-local.sh clickhouse|opensearch|postgres
set -eu
nome_banco="$1"
nome_rodada="falhas"
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
. "$pasta_prova/scripts/comum-local.sh"

esperar_banco
limpar_banco
subir_servidor
trap 'kill "$pid_servidor" 2>/dev/null || true' EXIT

echo "== histórico"
gerador historico hist historico --dias 2 --eventos-por-dia 5000 --tamanho-lote 100 >/dev/null

echo "== banco fora por 20 s durante o pico"
gerador ritmo ritmo1 ritmo --duracao-s 100 --picos 20:40:120 --reenvio-apos-s 30 --sem-buscas >/dev/null &
pid_gerador=$!
sleep 30
compose_prova kill "$nome_banco" >/dev/null 2>&1
inicio_queda_ms=$(agora_em_ms)
sleep 20
fim_queda_ms=$(agora_em_ms)
compose_prova start "$nome_banco" >/dev/null 2>&1
esperar_banco
wait "$pid_gerador"

confirmados_na_queda=$(awk -F, -v inicio="$inicio_queda_ms" -v fim="$fim_queda_ms" \
  'NR>1 && $1>=inicio+2000 && $1<=fim && $6>0 {soma+=$6} END {print soma+0}' "$resultados/ritmo/envios.csv")
echo "eventos confirmados com o banco fora: $confirmados_na_queda"
[ "$confirmados_na_queda" -eq 0 ] || falhar "confirmou com o banco fora"
"$binarios/conferidor" --servidor "$endereco_servidor" \
  --confirmados "$resultados/historico/confirmados.log" \
  --confirmados "$resultados/ritmo/confirmados.log" || falhar "conferência depois do banco fora"

echo "== disco na reserva"
derrubar_servidor
reserva_bytes=9000000000000000000
subir_servidor
situacao_envio=$(curl -s -o /dev/null -D "$resultados/cabecalhos.txt" -w '%{http_code}' \
  "$endereco_servidor/v1/eventos" -H 'content-type: application/json' -d '{"eventos":[]}')
[ "$situacao_envio" = 503 ] || falhar "envio respondeu $situacao_envio com disco na reserva"
grep -qi '^retry-after:' "$resultados/cabecalhos.txt" || falhar "faltou Retry-After"
agora_ms=$(agora_em_ms)
contar_linhas $((agora_ms - 259200000)) "$agora_ms" "nivel=info" >/dev/null || falhar "busca parou com disco na reserva"
echo "envio recusado com Retry-After e busca respondendo"
derrubar_servidor
reserva_bytes=0
subir_servidor

echo "== exclusão de pessoa"
agora_ms=$(agora_em_ms)
inicio_periodo_ms=$((agora_ms - 259200000))
termo_pessoa=$(curl -fsS "$endereco_servidor/v1/busca" -H 'content-type: application/json' \
  -d "{\"consulta\":{\"desde_ms\":$inicio_periodo_ms,\"ate_ms\":$agora_ms,\"termos\":[\"nivel=info\"],\"limite\":1}}" |
  python3 -c 'import json, sys; print("accountId=" + json.loads(json.load(sys.stdin)["linhas"][0]["campos"])["accountId"])')
antes=$(contar_linhas "$inicio_periodo_ms" "$agora_ms" "$termo_pessoa")
[ "$antes" -gt 0 ] || falhar "pessoa de teste sem eventos"
curl -fsS "$endereco_servidor/v1/exclusoes" -H 'content-type: application/json' -d "{\"termo_pessoa\":\"$termo_pessoa\"}"
sleep 6
depois=$(contar_linhas "$inicio_periodo_ms" "$agora_ms" "$termo_pessoa")
echo "linhas da pessoa: antes=$antes depois=$depois"
[ "$depois" -eq 0 ] || falhar "pessoa excluída voltou na busca"

echo "== exclusão de dia vencido"
dia_atual=$(($(date +%s) / 86400))
inicio_dia_atual_ms=$((dia_atual * 86400000))
antes=$(contar_linhas "$inicio_periodo_ms" "$inicio_dia_atual_ms" "nivel=info")
[ "$antes" -gt 0 ] || falhar "sem eventos de dias anteriores"
curl -fsS "$endereco_servidor/v1/exclusoes" -H 'content-type: application/json' -d "{\"dia_final_exclusivo\":$dia_atual}"
sleep 6
depois=$(contar_linhas "$inicio_periodo_ms" "$inicio_dia_atual_ms" "nivel=info")
echo "linhas de dias vencidos: antes=$antes depois=$depois"
[ "$depois" -eq 0 ] || falhar "dia vencido voltou na busca"
echo "falhas locais ok"
