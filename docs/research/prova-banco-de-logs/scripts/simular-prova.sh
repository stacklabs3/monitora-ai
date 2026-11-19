#!/bin/sh
# Prova completa de um banco na máquina simulada do Docker, na ordem do #9.
# Retoma da fase seguinte à última concluída. Os números são SIMULADOS: não substituem a AWS.
# Uso: sh scripts/simular-prova.sh clickhouse|opensearch|postgres
# ESCALA divide durações e volume, só para ensaiar o roteiro (1 = prova de verdade).
set -eu
nome_banco="$1"
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
escala="${ESCALA:-1}"
binarios="$pasta_prova/bancada/target/release"
raiz_resultados="$pasta_prova/resultados-simulacao"
[ "$escala" = 1 ] || raiz_resultados="$pasta_prova/resultados-locais/simulacao-escala-$escala"
resultados="$raiz_resultados/$nome_banco"
endereco_servidor=http://127.0.0.1:18080
COMPOSE_EXTRA="$pasta_prova/compose.simulacao.yml"
mkdir -p "$resultados"

case "$nome_banco" in
  clickhouse) endereco_banco=http://127.0.0.1:18123/; endereco_interno=http://127.0.0.1:8123/; pasta_dados=/var/lib/clickhouse ;;
  opensearch) endereco_banco=http://127.0.0.1:19200; endereco_interno=http://127.0.0.1:9200; pasta_dados=/usr/share/opensearch/data ;;
  postgres) endereco_banco=; endereco_interno="host=127.0.0.1 port=5432 user=postgres dbname=prova"; pasta_dados=/var/lib/postgresql ;;
  *) echo "banco desconhecido: $nome_banco" >&2; exit 2 ;;
esac

compose_prova() { docker compose -f "$pasta_prova/compose.yml" -f "$COMPOSE_EXTRA" "$@"; }
. "$pasta_prova/scripts/comum-copias.sh"

registrar() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$resultados/andamento.log"; }
duracao() { valor_escalado=$(($1 / escala)); [ "$valor_escalado" -ge "${2:-30}" ] && echo "$valor_escalado" || echo "${2:-30}"; }
agora_ms() { echo "$(date +%s)000"; }

esperar_banco() {
  tentativas=0
  until case "$nome_banco" in
    clickhouse) curl -fsS "${endereco_banco}ping" >/dev/null 2>&1 ;;
    opensearch) curl -fsS "$endereco_banco/_cluster/health" >/dev/null 2>&1 ;;
    postgres) compose_prova exec -T postgres pg_isready -q -U postgres -d prova >/dev/null 2>&1 ;;
  esac; do
    tentativas=$((tentativas + 1))
    [ "$tentativas" -lt 900 ] || return 1
    sleep 2
  done
}

iniciar_servidor() {
  compose_prova exec -d -e BANCO="$nome_banco" -e ENDERECO_BANCO="$endereco_interno" -e PORTA=18080 \
    -e PASTA_DADOS="$pasta_dados" -e RESERVA_BYTES="${1:-0}" "$nome_banco" \
    sh -c 'echo $$ >/tmp/servidor.pid; exec /opt/bancada/servidor >>/tmp/servidor.log 2>&1'
  tentativas=0
  until curl -fsS --max-time 2 "$endereco_servidor/saude" >/dev/null 2>&1; do
    tentativas=$((tentativas + 1))
    [ "$tentativas" -lt 600 ] || return 1
    sleep 1
  done
}

derrubar_servidor() {
  compose_prova exec -T "$nome_banco" sh -c 'kill -9 "$(cat /tmp/servidor.pid)"' >/dev/null 2>&1 || true
  sleep 1
}

definir_cpu() { docker update --cpus "$1" "$(compose_prova ps -q "$nome_banco")" >/dev/null; }

subir_maquina() {
  compose_prova up -d "$nome_banco" >/dev/null 2>&1
  esperar_banco
  curl -fsS --max-time 2 "$endereco_servidor/saude" >/dev/null 2>&1 || iniciar_servidor
}

medir_disco() {
  bytes_dados=$(compose_prova exec -T "$nome_banco" du -sk "$pasta_dados" | awk '{print $1 * 1024}')
  echo "$1,$bytes_dados" >>"$resultados/disco.csv"
}

amostrar_maquina() {
  nome_conteiner=$(compose_prova ps -q "$nome_banco")
  while :; do
    amostra=$(docker stats --no-stream --format '{{.CPUPerc}},{{.MemUsage}},{{.BlockIO}}' "$(compose_prova ps -q "$nome_banco" 2>/dev/null || echo "$nome_conteiner")" 2>/dev/null || true)
    [ -z "$amostra" ] || echo "$(date +%s),$amostra" >>"$resultados/maquina.csv"
    sleep 10
  done
}

gerador() {
  pasta_saida="$1"; shift
  "$binarios/gerador" --servidor "$endereco_servidor" --saida "$pasta_saida" --execucao "$(basename "$pasta_saida")" "$@" >>"$pasta_saida.log" 2>&1
}

nova_pasta() {
  pasta_nova="$resultados/$1/$1-$(date +%s)"
  mkdir -p "$(dirname "$pasta_nova")"
  echo "$pasta_nova"
}

conferir() { "$binarios/conferidor" --servidor "$endereco_servidor" --confirmados "$1/confirmados.log" | tee "$1.conferencia.txt"; }

verificar_metas() {
  "$binarios/relatorio" --pasta "$1" --verificar >"$1.relatorio.txt" && return 0
  sed -n '/^VEREDITO/,$p' "$1.relatorio.txt" | head -20 >"$1.motivo.txt"
  return 1
}

post_json() { curl -fsS "$endereco_servidor$1" -H 'content-type: application/json' -d "$2"; }

contar_linhas() {
  post_json /v1/busca "{\"consulta\":{\"desde_ms\":$1,\"ate_ms\":$2,\"termos\":[\"$3\"],\"limite\":100}}" |
    python3 -c 'import json, sys; print(len(json.load(sys.stdin)["linhas"]))'
}

fase_etapa_2h() {
  pasta=$(nova_pasta etapa-2h); total=$(duracao 7200 120); largura_pico=$(duracao 600)
  gerador "$pasta" ritmo --duracao-s "$total" --picos "$((total / 2)):$largura_pico:120" --reenvio-apos-s "$(duracao 840 20)"
  sleep 15; conferir "$pasta"; verificar_metas "$pasta"
}

fase_historico() {
  pasta="$resultados/historico/historico-30d"
  [ ! -e "$pasta" ] || { echo "histórico parcial existe: apague o banco antes de repetir"; return 1; }
  mkdir -p "$resultados/historico"
  definir_cpu 2
  inicio=$(date +%s)
  gerador "$pasta" historico --dias 30 --eventos-por-dia "$((1000000 / escala))" --tamanho-lote 1000 --envios-simultaneos 2
  echo "$(($(date +%s) - inicio))" >"$resultados/historico/segundos.txt"
  definir_cpu 0.4
  sleep 30; conferir "$pasta"; medir_disco depois-do-historico
}

fase_bateria() {
  compose_prova restart "$nome_banco" >/dev/null 2>&1
  docker run --rm --privileged --pid=host alpine:3.22 sh -c 'sync; echo 3 >/proc/sys/vm/drop_caches'
  esperar_banco; iniciar_servidor
  pasta=$(nova_pasta bateria)
  gerador "$pasta" bateria --rotulo trinta-dias
  "$binarios/relatorio" --pasta "$pasta" >"$pasta.relatorio.txt"
}

fase_24h() {
  pasta=$(nova_pasta rodada-24h); total=$(duracao 86400 180); largura_pico=$(duracao 600)
  picos="$((total * 2 / 24)):$largura_pico:120,$((total * 8 / 24)):$largura_pico:120,$((total * 14 / 24)):$largura_pico:120"
  gerador "$pasta" ritmo --duracao-s "$total" --picos "$picos" --reenvio-apos-s "$(duracao 840 20)"
  sleep 15; conferir "$pasta"; medir_disco depois-das-24h; verificar_metas "$pasta"
}

fase_banco_fora() {
  for parada_real in 300 1200; do
    parada=$(duracao "$parada_real" 20); pasta=$(nova_pasta "banco-fora-$parada_real"); antes=$(duracao 120 15); depois=$(duracao 900 45)
    total=$((antes + parada + depois))
    gerador "$pasta" ritmo --duracao-s "$total" --picos "0:$total:120" --reenvio-apos-s "$(duracao 60 10)" --sem-buscas &
    pid_carga=$!
    sleep "$antes"
    compose_prova kill "$nome_banco" >/dev/null 2>&1
    inicio_queda=$(agora_ms); sleep "$parada"; fim_queda=$(agora_ms)
    compose_prova start "$nome_banco" >/dev/null 2>&1
    esperar_banco; iniciar_servidor
    fim_volta=$(agora_ms)
    wait "$pid_carga"
    sleep 10; conferir "$pasta"
    awk -F, -v inicio="$inicio_queda" -v fim="$fim_queda" -v volta="$fim_volta" 'NR>1 {
        if ($1>=inicio+2000 && $1<=fim && $6>0) na_queda+=$6
        if ($4<0) lotes_perdidos++
        if ($5>1 && $1>ultimo) ultimo=$1
      } END {
        printf "confirmados_na_queda=%d lotes_sem_confirmacao=%d segundos_ate_zerar_atraso=%d\n", na_queda, lotes_perdidos, (ultimo-volta)/1000
        exit (na_queda>0 || (ultimo-volta)/1000>600)
      }' "$pasta/envios.csv" | tee "$pasta.fora.txt"
  done
}

fase_reenvio() {
  pasta=$(nova_pasta reenvio); atraso=$(duracao 840 30); total=$((atraso + $(duracao 360 30)))
  gerador "$pasta" ritmo --duracao-s "$total" --reenvio-apos-s "$atraso" --sem-buscas &
  pid_carga=$!
  sleep "$((atraso + 5))"; derrubar_servidor; iniciar_servidor
  wait "$pid_carga"; sleep 10; conferir "$pasta"
  "$binarios/relatorio" --pasta "$pasta" | sed -n 2p | tee "$pasta.resumo.txt"
}

fase_disco_cheio() {
  derrubar_servidor; iniciar_servidor 9000000000000000000
  situacao=$(curl -s -o /dev/null -w '%{http_code}' "$endereco_servidor/v1/eventos" -H 'content-type: application/json' -d '{"eventos":[]}')
  agora=$(agora_ms)
  linhas=$(contar_linhas "$((agora - 3600000))" "$agora" "nivel=info")
  derrubar_servidor; iniciar_servidor
  echo "situacao_envio=$situacao linhas_busca=$linhas" | tee "$resultados/disco-cheio.txt"
  [ "$situacao" = 503 ]
}

fase_apagar_com_carga() {
  pasta=$(nova_pasta apagar-com-carga); total=$(duracao 1200 90)
  gerador "$pasta" ritmo --duracao-s "$total" --reenvio-apos-s "$(duracao 840 20)" &
  pid_carga=$!
  sleep "$(duracao 120 15)"
  corte_ms=$(agora_ms); inicio=$(date +%s)
  dia_final=$(($(date +%s) / 86400 - 29))
  post_json /v1/exclusoes "{\"dia_final_exclusivo\":$dia_final}"
  numero_pessoa=1
  while [ "$numero_pessoa" -le 100 ]; do
    post_json /v1/exclusoes "{\"termo_pessoa\":\"accountId=conta-$numero_pessoa\"}"
    numero_pessoa=$((numero_pessoa + 1))
  done
  echo "segundos_para_apagar=$(($(date +%s) - inicio))" | tee "$pasta.exclusao.txt"
  wait "$pid_carga"; sleep 10
  numero_pessoa=1; restantes=0
  while [ "$numero_pessoa" -le 100 ]; do
    restantes=$((restantes + $(contar_linhas "$((corte_ms - 3024000000))" "$corte_ms" "accountId=conta-$numero_pessoa")))
    numero_pessoa=$((numero_pessoa + 1))
  done
  vencidos=$(contar_linhas "$((corte_ms - 3024000000))" "$((dia_final * 86400000))" "nivel=info")
  echo "linhas_de_pessoas=$restantes linhas_vencidas=$vencidos" | tee -a "$pasta.exclusao.txt"
  [ "$restantes" -eq 0 ] && [ "$vencidos" -eq 0 ] && verificar_metas "$pasta"
}

fase_degraus() {
  sh "$pasta_prova/scripts/degraus-de-carga.sh" "$binarios" "$endereco_servidor" "$resultados/degraus" 12 "$(duracao 1800 60)" 3072 | tee "$resultados/degraus.txt"
}

fase_restauracao() {
  preparar_copias
  inicio_copia=$(date +%s); fazer_copia
  bytes_copia=$(medir_copia_cifrada)
  echo "segundos_copia=$(($(date +%s) - inicio_copia)) bytes_copia_cifrada=$bytes_copia" | tee "$resultados/restauracao.txt"
  termo_pessoa="accountId=conta-101"; dia_final=$(($(date +%s) / 86400 - 28))
  corpo_exclusao="{\"termo_pessoa\":\"$termo_pessoa\",\"dia_final_exclusivo\":$dia_final}"
  post_json /v1/exclusoes "$corpo_exclusao"; sleep 10
  desde_ms=$(($(date +%s)000 - 3456000000))
  curl -fsS --max-time 7200 "$endereco_servidor/v1/presentes?desde_ms=$desde_ms" | LC_ALL=C sort >"$resultados/original.txt"
  compose_prova rm -sf "$nome_banco" >/dev/null 2>&1
  docker volume rm "prova-banco-de-logs_dados-$nome_banco" >/dev/null
  compose_prova up -d "$nome_banco" >/dev/null 2>&1
  esperar_banco
  inicio=$(date +%s); restaurar_copia; iniciar_servidor; post_json /v1/exclusoes "$corpo_exclusao"
  segundos=$(($(date +%s) - inicio)); sleep 10
  curl -fsS --max-time 7200 "$endereco_servidor/v1/presentes?desde_ms=$desde_ms" | LC_ALL=C sort >"$resultados/restaurado.txt"
  cmp -s "$resultados/original.txt" "$resultados/restaurado.txt"
  rm -f "$resultados/original.txt" "$resultados/restaurado.txt"
  echo "segundos_restauracao=$segundos meta_4h=$([ "$segundos" -le 14400 ] && echo ok || echo estourou)" | tee -a "$resultados/restauracao.txt"
}

limpar_para_disco() {
  compose_prova rm -sf "$nome_banco" >/dev/null 2>&1
  docker volume rm "prova-banco-de-logs_dados-$nome_banco" >/dev/null
  compose_prova up -d "$nome_banco" >/dev/null 2>&1
  esperar_banco; iniciar_servidor
}

fase_disco_valores() {
  definir_cpu 2
  for multiplicador in 1 2; do
    limpar_para_disco; definir_cpu 2
    pasta=$(nova_pasta "disco-valores-$multiplicador")
    "$binarios/gerador" --servidor "$endereco_servidor" --saida "$pasta" --execucao "disco$multiplicador" --multiplicador-valores "$multiplicador" \
      historico --dias 1 --eventos-por-dia "$((1000000 / escala))" --tamanho-lote 1000 --envios-simultaneos 2 >>"$pasta.log" 2>&1
    sleep 60; medir_disco "um-dia-valores-x$multiplicador"
  done
  definir_cpu 0.4
}

rodar_fase() {
  nome_fase="$1"; obrigatoria="$2"
  [ ! -e "$resultados/.feito-$nome_fase" ] || return 0
  registrar "início $nome_fase"
  if ( set -e; "fase_$nome_fase" ) >>"$resultados/$nome_fase.saida.txt" 2>&1; then
    touch "$resultados/.feito-$nome_fase"; registrar "fim $nome_fase: passou"
  elif [ "$obrigatoria" = sim ]; then
    echo "$nome_fase" >"$resultados/REPROVADO.txt"; registrar "fim $nome_fase: REPROVOU, banco encerrado"
    exit 0
  else
    touch "$resultados/.feito-$nome_fase"; echo "$nome_fase" >>"$resultados/metas-quebradas.txt"
    registrar "fim $nome_fase: meta quebrada, prova segue"
  fi
}

[ ! -e "$resultados/REPROVADO.txt" ] || { registrar "banco já reprovado"; exit 0; }
for outro_banco in clickhouse opensearch postgres; do
  [ "$outro_banco" = "$nome_banco" ] || compose_prova stop "$outro_banco" >/dev/null 2>&1 || true
done
if [ ! -e "$resultados/.iniciado" ]; then
  compose_prova rm -sf "$nome_banco" >/dev/null 2>&1 || true
  docker volume rm "prova-banco-de-logs_dados-$nome_banco" >/dev/null 2>&1 || true
  touch "$resultados/.iniciado"
fi
subir_maquina
amostrar_maquina & pid_amostrador=$!
trap 'kill "$pid_amostrador" 2>/dev/null || true' EXIT

rodar_fase etapa_2h sim
rodar_fase historico sim
rodar_fase bateria nao
rodar_fase 24h sim
rodar_fase banco_fora sim
rodar_fase reenvio sim
rodar_fase disco_cheio sim
rodar_fase apagar_com_carga nao
rodar_fase degraus nao
rodar_fase restauracao nao
rodar_fase disco_valores nao
registrar "prova simulada concluída"
compose_prova stop "$nome_banco" >/dev/null 2>&1
