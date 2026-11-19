#!/bin/sh
# Prova completa de um banco na máquina simulada do Docker, na ordem do #9.
# Retoma da fase seguinte à última concluída. Os números são SIMULADOS: não substituem a AWS.
# Toda falha provocada comprova que aconteceu e tem controle negativo (RP1).
# Uso: sh scripts/simular-prova.sh clickhouse|opensearch|postgres
# ESCALA divide durações e volume, só para ensaiar o roteiro (1 = prova de verdade).
set -eu
set -o pipefail
nome_banco="$1"
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
escala="${ESCALA:-1}"
binarios="$pasta_prova/bancada/target/release"
raiz_resultados="$pasta_prova/resultados-simulacao"
[ "$escala" = 1 ] || raiz_resultados="$pasta_prova/resultados-locais/simulacao-escala-$escala"
resultados="$raiz_resultados/$nome_banco"
endereco_servidor=http://127.0.0.1:18080
COMPOSE_EXTRA="$pasta_prova/compose.simulacao.yml"
limite_compose_s=900
milissegundos_margem_vinculo_tardio=7500000
milissegundos_35_dias=3024000000
mkdir -p "$resultados"

case "$nome_banco" in
  clickhouse) endereco_banco=http://127.0.0.1:18123/; endereco_interno=http://127.0.0.1:8123/; pasta_dados=/var/lib/clickhouse ;;
  opensearch) endereco_banco=http://127.0.0.1:19200; endereco_interno=http://127.0.0.1:9200; pasta_dados=/usr/share/opensearch/data ;;
  postgres) endereco_banco=; endereco_interno="host=127.0.0.1 port=5432 user=postgres dbname=prova"; pasta_dados=/var/lib/postgresql ;;
  *) echo "banco desconhecido: $nome_banco" >&2; exit 2 ;;
esac

. "$pasta_prova/scripts/comum-tempo.sh"
. "$pasta_prova/scripts/comum-controle.sh"
compose_prova() { com_limite "$limite_compose_s" docker compose -f "$pasta_prova/compose.yml" -f "$COMPOSE_EXTRA" "$@"; }
. "$pasta_prova/scripts/comum-copias.sh"

falhar() { echo "FALHA: $1"; exit 1; }
registrar() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$resultados/andamento.log"; }
duracao() { valor_escalado=$(($1 / escala)); [ "$valor_escalado" -ge "${2:-30}" ] && echo "$valor_escalado" || echo "${2:-30}"; }
agora_ms() { echo "$(date +%s)000"; }
conteiner_banco() { compose_prova ps -aq "$nome_banco"; }
servidor_responde() { curl -fsS --max-time 2 "$endereco_servidor/saude" >/dev/null 2>&1; }

esperar_banco() {
  tentativas=0
  until case "$nome_banco" in
    clickhouse) curl -fsS --max-time 5 "${endereco_banco}ping" >/dev/null 2>&1 ;;
    # Responder não basta: com os índices ainda abrindo, a primeira busca dá erro.
    opensearch) curl -fsS --max-time 15 "$endereco_banco/_cluster/health?wait_for_status=yellow&timeout=10s" >/dev/null 2>&1 ;;
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
  until servidor_responde; do
    tentativas=$((tentativas + 1))
    [ "$tentativas" -lt 600 ] || return 1
    sleep 1
  done
}

# Só retorna com sucesso depois de ver o servidor fora do ar.
derrubar_servidor() {
  compose_prova exec -T "$nome_banco" sh -c 'kill -9 "$(cat /tmp/servidor.pid)"' >/dev/null 2>&1 || return 1
  tentativas=0
  while servidor_responde; do
    tentativas=$((tentativas + 1))
    [ "$tentativas" -lt 10 ] || return 1
    sleep 1
  done
}

definir_cpu() { com_limite 60 docker update --cpus "$1" "$(compose_prova ps -q "$nome_banco")" >/dev/null; }

subir_maquina() {
  compose_prova up -d "$nome_banco" >/dev/null 2>&1
  esperar_banco
  servidor_responde || iniciar_servidor
}

medir_disco() {
  bytes_dados=$(compose_prova exec -T "$nome_banco" du -sk "$pasta_dados" | awk '{print $1 * 1024}')
  echo "$1,$bytes_dados" >>"$resultados/disco.csv"
}

amostrar_maquina() {
  while :; do
    nome_conteiner=$(compose_prova ps -q "$nome_banco" 2>/dev/null || true)
    amostra=""
    [ -z "$nome_conteiner" ] || amostra=$(com_limite 30 docker stats --no-stream --format '{{.CPUPerc}},{{.MemUsage}},{{.BlockIO}}' "$nome_conteiner" 2>/dev/null || true)
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

conferir() {
  rodar_conferidor "$1/confirmados.log" "$1.conferencia.txt" || { cat "$1.conferencia.txt"; return 1; }
  cat "$1.conferencia.txt"
  grep -Eq '^confirmados=[1-9]' "$1.conferencia.txt" || falhar "a conferência não tinha nenhum evento confirmado"
}

verificar_metas() {
  "$binarios/relatorio" --pasta "$1" --verificar >"$1.relatorio.txt" && return 0
  sed -n '/^VEREDITO/,$p' "$1.relatorio.txt" | head -20 >"$1.motivo.txt"
  cat "$1.motivo.txt"
  return 1
}

post_json() { curl -fsS --max-time 3600 "$endereco_servidor$1" -H 'content-type: application/json' -d "$2"; }

contar_linhas() {
  curl -fsS --max-time 300 "$endereco_servidor/v1/busca" -H 'content-type: application/json' \
    -d "{\"consulta\":{\"desde_ms\":$1,\"ate_ms\":$2,\"termos\":[\"$3\"],\"limite\":100}}" |
    python3 -c 'import json, sys; print(len(json.load(sys.stdin)["linhas"]))'
}

contar_linhas_das_pessoas() {
  numero_pessoa=1; soma_linhas=0
  while [ "$numero_pessoa" -le 100 ]; do
    soma_linhas=$((soma_linhas + $(contar_linhas "$1" "$2" "accountId=conta-$numero_pessoa")))
    numero_pessoa=$((numero_pessoa + 1))
  done
  echo "$soma_linhas"
}

fase_etapa_2h() {
  pasta=$(nova_pasta etapa-2h); total=$(duracao 7200 120); largura_pico=$(duracao 600)
  gerador "$pasta" ritmo --duracao-s "$total" --picos "$((total / 2)):$largura_pico:120" --reenvio-apos-s "$(duracao 840 20)"
  sleep 15; conferir "$pasta"; verificar_metas "$pasta"
}

# Sem isto, um conferidor ou um relatório que aprovam tudo passariam a prova inteira.
fase_controle_conferidor() {
  pasta=$(find "$resultados/etapa-2h" -mindepth 1 -maxdepth 1 -type d -name 'etapa-2h-*' | sort | tail -1)
  [ -n "$pasta" ] || falhar "sem rodada da etapa de 2 h para o controle"
  controle_negativo_conferidor "$pasta/confirmados.log" "$resultados/controle-conferidor" simulacao
  if "$binarios/relatorio" --pasta "$pasta" --verificar --meta-confirmar-ms 0 >"$resultados/controle-conferidor/relatorio-meta-impossivel.txt"; then
    falhar "o relatório aprovou uma meta impossível"
  fi
  grep -q '^VEREDITO: fora das metas' "$resultados/controle-conferidor/relatorio-meta-impossivel.txt" || falhar "o relatório não deu veredito"
  echo "controle do relatório ok: meta impossível reprovou"
}

fase_historico() {
  pasta="$resultados/historico/historico-30d"
  [ ! -e "$pasta" ] || falhar "histórico parcial existe: apague o banco antes de repetir"
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
  com_limite 180 docker run --rm --privileged --pid=host alpine:3.22 sh -c 'sync; echo 3 >/proc/sys/vm/drop_caches'
  esperar_banco; iniciar_servidor
  pasta=$(nova_pasta bateria)
  gerador "$pasta" bateria --rotulo trinta-dias
  verificar_metas "$pasta"
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
    identificador_conteiner=$(conteiner_banco)
    compose_prova kill "$nome_banco" >/dev/null 2>&1
    inicio_queda=$(agora_ms)
    [ "$(docker inspect -f '{{.State.Running}}' "$identificador_conteiner")" = false ] || falhar "o banco continuou de pé"
    if servidor_responde; then falhar "o servidor respondeu com a máquina parada"; fi
    sleep "$parada"; fim_queda=$(agora_ms)
    compose_prova start "$nome_banco" >/dev/null 2>&1
    esperar_banco; iniciar_servidor
    fim_volta=$(agora_ms)
    wait "$pid_carga"
    sleep 10; conferir "$pasta"
    awk -F, -v inicio="$inicio_queda" -v fim="$fim_queda" -v volta="$fim_volta" 'NR>1 {
        if ($1>=inicio+2000 && $1<=fim && $6>0) na_queda+=$6
        if ($4<0) lotes_perdidos++
        if ($5>1) lotes_repetidos++
        if ($5>1 && $1>ultimo) ultimo=$1
      } END {
        segundos_ate_zerar=(ultimo-volta)/1000
        printf "confirmados_na_queda=%d lotes_sem_confirmacao=%d lotes_repetidos=%d segundos_ate_zerar_atraso=%d\n", na_queda, lotes_perdidos, lotes_repetidos, segundos_ate_zerar
        exit (na_queda>0 || lotes_repetidos==0 || segundos_ate_zerar>600)
      }' "$pasta/envios.csv" | tee "$pasta.fora.txt"
  done
}

fase_reenvio() {
  pasta=$(nova_pasta reenvio); atraso=$(duracao 840 30); total=$((atraso + $(duracao 360 30)))
  gerador "$pasta" ritmo --duracao-s "$total" --reenvio-apos-s "$atraso" --sem-buscas &
  pid_carga=$!
  sleep "$((atraso + 5))"; derrubar_servidor; instante_reinicio=$(agora_ms); iniciar_servidor
  wait "$pid_carga"; sleep 10; conferir "$pasta"
  "$binarios/relatorio" --pasta "$pasta" >"$pasta.relatorio.txt"
  sed -n 2p "$pasta.relatorio.txt" | tee "$pasta.resumo.txt"
  barrados_total=$(awk -F, 'NR>1 {soma+=$7} END {print soma+0}' "$pasta/envios.csv")
  barrados_depois_do_reinicio=$(awk -F, -v desde="$instante_reinicio" 'NR>1 && $1>desde {soma+=$7} END {print soma+0}' "$pasta/envios.csv")
  echo "duplicados_barrados=$barrados_total depois_do_reinicio=$barrados_depois_do_reinicio" | tee "$pasta.barrados.txt"
  [ "$barrados_depois_do_reinicio" -gt 0 ] || falhar "nenhum reenvio chegou depois do reinício: o cenário não foi testado"
}

fase_disco_cheio() {
  derrubar_servidor; iniciar_servidor 9000000000000000000
  arquivo_cabecalhos="$resultados/disco-cheio-cabecalhos.txt"
  situacao=$(curl -s --max-time 30 -o /dev/null -D "$arquivo_cabecalhos" -w '%{http_code}' "$endereco_servidor/v1/eventos" -H 'content-type: application/json' -d '{"eventos":[]}')
  agora=$(agora_ms)
  linhas=$(contar_linhas "$((agora - 3600000))" "$agora" "nivel=info")
  derrubar_servidor; iniciar_servidor
  situacao_sem_reserva=$(curl -s --max-time 30 -o /dev/null -w '%{http_code}' "$endereco_servidor/v1/eventos" -H 'content-type: application/json' -d '{"eventos":[]}')
  echo "situacao_envio=$situacao linhas_busca=$linhas situacao_sem_reserva=$situacao_sem_reserva" | tee "$resultados/disco-cheio.txt"
  [ "$situacao" = 503 ] || falhar "o envio não recebeu 503 com o disco na reserva"
  grep -qi '^retry-after:' "$arquivo_cabecalhos" || falhar "faltou Retry-After"
  [ "$linhas" -gt 0 ] || falhar "a busca não trouxe linhas com o disco na reserva"
  [ "$situacao_sem_reserva" = 200 ] || falhar "controle: sem reserva o envio deveria passar e deu $situacao_sem_reserva"
}

# A carga cria eventos com horário de até 2 h atrás, que chegam depois da exclusão e são dados
# novos. Por isso a conferência olha só o que é mais velho que 2 h e 5 min antes do corte.
fase_apagar_com_carga() {
  pasta=$(nova_pasta apagar-com-carga); total=$(duracao 1200 90)
  corte_ms=$(agora_ms)
  desde_ms=$((corte_ms - milissegundos_35_dias)); ate_ms=$((corte_ms - milissegundos_margem_vinculo_tardio))
  dia_final=$(($(date +%s) / 86400 - 29))
  pessoas_antes=$(contar_linhas_das_pessoas "$desde_ms" "$ate_ms")
  vencidos_antes=$(contar_linhas "$desde_ms" "$((dia_final * 86400000))" "nivel=info")
  controle_antes=$(contar_linhas "$((dia_final * 86400000))" "$ate_ms" "accountId=conta-102")
  echo "antes: linhas_de_pessoas=$pessoas_antes linhas_vencidas=$vencidos_antes linhas_pessoa_mantida=$controle_antes" | tee "$pasta.exclusao.txt"
  [ "$pessoas_antes" -gt 0 ] && [ "$vencidos_antes" -gt 0 ] && [ "$controle_antes" -gt 0 ] || falhar "não havia linhas para apagar: o cenário não foi testado"

  gerador "$pasta" ritmo --duracao-s "$total" --reenvio-apos-s "$(duracao 840 20)" &
  pid_carga=$!
  sleep "$(duracao 120 15)"
  inicio=$(date +%s)
  post_json /v1/exclusoes "{\"dia_final_exclusivo\":$dia_final}"
  numero_pessoa=1
  while [ "$numero_pessoa" -le 100 ]; do
    post_json /v1/exclusoes "{\"termo_pessoa\":\"accountId=conta-$numero_pessoa\"}"
    numero_pessoa=$((numero_pessoa + 1))
  done
  echo "segundos_para_apagar=$(($(date +%s) - inicio))" | tee -a "$pasta.exclusao.txt"
  wait "$pid_carga"; sleep 10
  restantes=$(contar_linhas_das_pessoas "$desde_ms" "$ate_ms")
  vencidos=$(contar_linhas "$desde_ms" "$((dia_final * 86400000))" "nivel=info")
  controle_depois=$(contar_linhas "$((dia_final * 86400000))" "$ate_ms" "accountId=conta-102")
  echo "depois: linhas_de_pessoas=$restantes linhas_vencidas=$vencidos linhas_pessoa_mantida=$controle_depois" | tee -a "$pasta.exclusao.txt"
  falhas_encontradas=0
  [ "$restantes" -eq 0 ] || { echo "FALHA: linhas de pessoas excluídas voltaram"; falhas_encontradas=1; }
  [ "$vencidos" -eq 0 ] || { echo "FALHA: linhas vencidas voltaram"; falhas_encontradas=1; }
  [ "$controle_depois" -gt 0 ] || { echo "FALHA: controle: a pessoa não excluída perdeu as linhas"; falhas_encontradas=1; }
  verificar_metas "$pasta" || { echo "FALHA: meta quebrada durante a exclusão"; falhas_encontradas=1; }
  [ "$falhas_encontradas" -eq 0 ]
}

fase_degraus() {
  sh "$pasta_prova/scripts/degraus-de-carga.sh" "$binarios" "$endereco_servidor" "$resultados/degraus" 12 "$(duracao 1800 60)" 3072 | tee "$resultados/degraus.txt"
  grep -q '^maior carga aprovada: [1-9]' "$resultados/degraus.txt" || falhar "nenhum degrau ficou dentro das metas"
}

fase_restauracao() {
  limite_compose_s=14400
  preparar_copias
  inicio_copia=$(date +%s); fazer_copia
  bytes_copia=$(medir_copia_cifrada)
  [ "$bytes_copia" -gt 0 ] || falhar "a cópia cifrada saiu vazia"
  echo "segundos_copia=$(($(date +%s) - inicio_copia)) bytes_copia_cifrada=$bytes_copia" | tee "$resultados/restauracao.txt"
  termo_pessoa="accountId=conta-101"; dia_final=$(($(date +%s) / 86400 - 28))
  agora=$(agora_ms); desde_conferencia_ms=$((agora - milissegundos_35_dias))
  pessoa_antes=$(contar_linhas "$desde_conferencia_ms" "$agora" "$termo_pessoa")
  vencidos_antes=$(contar_linhas "$desde_conferencia_ms" "$((dia_final * 86400000))" "nivel=info")
  [ "$pessoa_antes" -gt 0 ] && [ "$vencidos_antes" -gt 0 ] || falhar "não havia linhas para excluir antes da cópia ser restaurada"
  corpo_exclusao="{\"termo_pessoa\":\"$termo_pessoa\",\"dia_final_exclusivo\":$dia_final}"
  post_json /v1/exclusoes "$corpo_exclusao"; sleep 10
  desde_ms=$(($(date +%s)000 - 3456000000))
  curl -fsS --max-time 7200 "$endereco_servidor/v1/presentes?desde_ms=$desde_ms" | LC_ALL=C sort >"$resultados/original.txt"
  [ -s "$resultados/original.txt" ] || falhar "o banco original estava vazio"
  compose_prova rm -sf "$nome_banco" >/dev/null 2>&1
  docker volume rm "prova-banco-de-logs_dados-$nome_banco" >/dev/null
  if docker volume inspect "prova-banco-de-logs_dados-$nome_banco" >/dev/null 2>&1; then falhar "o volume do banco não foi apagado"; fi
  compose_prova up -d "$nome_banco" >/dev/null 2>&1
  esperar_banco
  inicio=$(date +%s); restaurar_copia; iniciar_servidor; post_json /v1/exclusoes "$corpo_exclusao"
  segundos=$(($(date +%s) - inicio)); sleep 10
  curl -fsS --max-time 7200 "$endereco_servidor/v1/presentes?desde_ms=$desde_ms" | LC_ALL=C sort >"$resultados/restaurado.txt"
  cmp -s "$resultados/original.txt" "$resultados/restaurado.txt" || falhar "o banco restaurado difere do original"
  agora=$(agora_ms)
  pessoa_depois=$(contar_linhas "$desde_conferencia_ms" "$agora" "$termo_pessoa")
  vencidos_depois=$(contar_linhas "$desde_conferencia_ms" "$((dia_final * 86400000))" "nivel=info")
  rm -f "$resultados/original.txt" "$resultados/restaurado.txt"
  echo "segundos_restauracao=$segundos meta_4h=$([ "$segundos" -le 14400 ] && echo ok || echo estourou) pessoa_antes=$pessoa_antes pessoa_depois=$pessoa_depois vencidos_antes=$vencidos_antes vencidos_depois=$vencidos_depois" | tee -a "$resultados/restauracao.txt"
  [ "$pessoa_depois" -eq 0 ] && [ "$vencidos_depois" -eq 0 ] || falhar "dado excluído voltou depois da restauração"
  [ "$segundos" -le 14400 ] || falhar "a restauração passou de 4 h"
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

# Modo interno: cada fase roda em processo próprio, com `set -e` valendo de verdade.
if [ -n "${FASE_UNICA:-}" ]; then
  "fase_$FASE_UNICA"
  exit 0
fi

limite_da_fase_s() {
  case "$1" in
    etapa_2h) echo 14400 ;;
    controle_conferidor) echo 10800 ;;
    historico) echo 259200 ;;
    bateria) echo 43200 ;;
    24h) echo 108000 ;;
    banco_fora) echo 14400 ;;
    reenvio) echo 7200 ;;
    disco_cheio) echo 3600 ;;
    apagar_com_carga) echo 43200 ;;
    degraus) echo 28800 ;;
    restauracao) echo 57600 ;;
    disco_valores) echo 43200 ;;
  esac
}

rodar_fase() {
  nome_fase="$1"; obrigatoria="$2"
  [ ! -e "$resultados/.feito-$nome_fase" ] || return 0
  registrar "início $nome_fase"
  limite_fase_s=$(duracao "$(limite_da_fase_s "$nome_fase")" 1800)
  codigo_fase=0
  com_limite "$limite_fase_s" env FASE_UNICA="$nome_fase" sh "$pasta_prova/scripts/simular-prova.sh" "$nome_banco" \
    >>"$resultados/$nome_fase.saida.txt" 2>&1 || codigo_fase=$?
  motivo_fase="código $codigo_fase"
  [ "$codigo_fase" -ne 124 ] || motivo_fase="passou do limite de $limite_fase_s s"
  if [ "$(com_limite 30 docker inspect -f '{{.State.OOMKilled}}' "$(conteiner_banco)" 2>/dev/null || echo false)" = true ]; then
    codigo_fase=137; motivo_fase="falta de memória"
  fi
  if [ "$codigo_fase" -eq 0 ]; then
    touch "$resultados/.feito-$nome_fase"; registrar "fim $nome_fase: passou"
  elif [ "$obrigatoria" = sim ]; then
    { echo "$nome_fase: $motivo_fase"; tail -5 "$resultados/$nome_fase.saida.txt"; } >"$resultados/REPROVADO.txt"
    registrar "fim $nome_fase: REPROVOU ($motivo_fase), banco encerrado"
    exit 0
  else
    touch "$resultados/.feito-$nome_fase"; echo "$nome_fase: $motivo_fase" >>"$resultados/metas-quebradas.txt"
    registrar "fim $nome_fase: meta quebrada ($motivo_fase), prova segue"
    subir_maquina; definir_cpu 0.4
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
rodar_fase controle_conferidor sim
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
