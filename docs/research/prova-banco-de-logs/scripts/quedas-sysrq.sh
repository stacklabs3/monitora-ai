#!/bin/sh
# Reinicia a máquina do banco durante a carga, sem gravar o cache, e confere as confirmações.
# Roda na OUTRA máquina, onde ficam o gerador e o registro de confirmações.
# Cada reinício só vale com boot novo e com a carga confirmando eventos (RP1).
# Uso: quedas-sysrq.sh binarios servidor pasta_saida quantidade intervalo_s
# Ambiente: COMANDO_ROOT (ex.: "ssh maquina sudo"), COMANDO_RELIGAR (opcional),
#           QUANTIDADE_PARADAS e COMANDO_PARADA_FORCADA (paradas forçadas, depois das quedas).
set -eu
set -o pipefail
binarios="$1"; endereco_servidor="$2"; pasta_saida="$3"; quantidade_quedas="$4"; intervalo_s="$5"
: "${COMANDO_ROOT:?defina COMANDO_ROOT}"
pasta_scripts="$(cd "$(dirname "$0")" && pwd)"
. "$pasta_scripts/comum-tempo.sh"
. "$pasta_scripts/comum-controle.sh"
limite_volta_s="${LIMITE_VOLTA_S:-300}"
limite_comando_s="${LIMITE_COMANDO_S:-20}"
limite_religar_s="${LIMITE_RELIGAR_S:-240}"
quantidade_paradas="${QUANTIDADE_PARADAS:-0}"
[ "$quantidade_paradas" -eq 0 ] || : "${COMANDO_PARADA_FORCADA:?defina COMANDO_PARADA_FORCADA}"

falhar() { echo "FALHA: $1"; exit 1; }

# Depois de um reinício a conexão antiga pode prender o cliente: cada tentativa tem limite
# e a leitura insiste até o prazo de volta da máquina.
identificador_boot() {
  inicio_leitura=$(date +%s)
  while :; do
    codigo_leitura=0
    boot_lido=$(com_limite "$limite_comando_s" $COMANDO_ROOT cat /proc/sys/kernel/random/boot_id 2>/dev/null) || codigo_leitura=$?
    [ "$codigo_leitura" -ne 124 ] || echo "aviso: a leitura do boot travou e foi cortada em $limite_comando_s s" >&2
    [ "$codigo_leitura" -ne 0 ] || [ -z "$boot_lido" ] || { echo "$boot_lido"; return 0; }
    [ $(($(date +%s) - inicio_leitura)) -lt "$limite_volta_s" ] || return 1
    sleep 2
  done
}

religar_maquina() {
  com_limite "$limite_religar_s" sh -c "$COMANDO_RELIGAR" >/dev/null 2>&1 || true
}

esperar_volta() {
  inicio_espera=$(date +%s)
  religou=0
  until curl -fsS --max-time 2 "$endereco_servidor/saude" >/dev/null 2>&1; do
    decorrido=$(($(date +%s) - inicio_espera))
    [ "$decorrido" -lt "$limite_volta_s" ] || { echo "FALHA: servidor não voltou em $limite_volta_s s"; return 1; }
    if [ -n "${COMANDO_RELIGAR:-}" ] && [ "$religou" -eq 0 ] && [ "$decorrido" -ge 20 ]; then
      religou=1
      religar_maquina
    fi
    sleep 1
  done
  echo "$(($(date +%s) - inicio_espera))"
}

confirmacoes_ate_agora() { wc -l <"$pasta_saida/confirmados.log" | tr -d ' '; }

# Sem carga confirmando, a queda não testaria nada.
provar_carga_ativa() {
  kill -0 "$pid_gerador" 2>/dev/null || falhar "o gerador parou antes de $1"
  confirmacoes_agora=$(confirmacoes_ate_agora)
  [ "$confirmacoes_agora" -gt "$confirmacoes_na_queda_anterior" ] || falhar "nenhuma confirmação nova antes de $1"
  confirmacoes_na_queda_anterior=$confirmacoes_agora
}

reiniciar_e_provar() {
  tipo_reinicio="$1"; descricao_reinicio="$2"
  sleep "$intervalo_s"
  provar_carga_ativa "$descricao_reinicio"
  boot_antes=$(identificador_boot) || falhar "não li o identificador de boot antes de $descricao_reinicio"
  case "$tipo_reinicio" in
    sysrq) echo 'echo b > /proc/sysrq-trigger' | com_limite "$limite_comando_s" $COMANDO_ROOT sh >/dev/null 2>&1 || true ;;
    parada)
      com_limite "$limite_religar_s" sh -c "$COMANDO_PARADA_FORCADA" >/dev/null 2>&1 || falhar "a parada forçada falhou em $descricao_reinicio"
      religar_maquina ;;
  esac
  sleep 3
  tempo_volta=$(esperar_volta) || { echo "$tempo_volta"; exit 1; }
  boot_depois=$(identificador_boot) || falhar "não li o identificador de boot depois de $descricao_reinicio"
  [ "$boot_depois" != "$boot_antes" ] || falhar "a máquina não reiniciou em $descricao_reinicio"
  echo "$descricao_reinicio: boot novo ${boot_depois%%-*} e servidor de volta em $tempo_volta s"
}

# Controle do identificador: sem reinício ele precisa ficar igual, senão "boot novo" não prova nada.
boot_controle_inicial=$(identificador_boot) || falhar "não li o identificador de boot"
sleep 2
boot_controle_final=$(identificador_boot) || falhar "não li o identificador de boot"
[ "$boot_controle_inicial" = "$boot_controle_final" ] || falhar "o identificador de boot muda sem reinício"
echo "controle do boot ok: sem reinício o identificador não muda"

quantidade_reinicios=$((quantidade_quedas + quantidade_paradas))
duracao_carga_s=$((quantidade_reinicios * (intervalo_s + 120) + 120))
"$binarios/gerador" --servidor "$endereco_servidor" --saida "$pasta_saida" --execucao quedas \
  ritmo --duracao-s "$duracao_carga_s" --reenvio-apos-s 30 --sem-buscas >"$pasta_saida.gerador.log" 2>&1 &
pid_gerador=$!
trap 'kill "$pid_gerador" 2>/dev/null || true' EXIT
sleep 5
confirmacoes_na_queda_anterior=0

numero_queda=1
while [ "$numero_queda" -le "$quantidade_quedas" ]; do
  reiniciar_e_provar sysrq "queda $numero_queda"
  numero_queda=$((numero_queda + 1))
done
numero_parada=1
while [ "$numero_parada" -le "$quantidade_paradas" ]; do
  reiniciar_e_provar parada "parada forçada $numero_parada"
  numero_parada=$((numero_parada + 1))
done

prazo_gerador=$(($(date +%s) + duracao_carga_s + 1200))
while kill -0 "$pid_gerador" 2>/dev/null; do
  [ "$(date +%s)" -lt "$prazo_gerador" ] || falhar "o gerador passou do prazo"
  sleep 5
done
wait "$pid_gerador" || falhar "o gerador terminou com erro"
trap - EXIT
sleep 8

rodar_conferidor "$pasta_saida/confirmados.log" "$pasta_saida.conferencia.txt" || {
  cat "$pasta_saida.conferencia.txt"; falhar "a conferência reprovou depois dos reinícios"; }
cat "$pasta_saida.conferencia.txt"
controle_negativo_conferidor "$pasta_saida/confirmados.log" "$pasta_saida-controle" quedas
echo "reinícios provados: $quantidade_quedas quedas e $quantidade_paradas paradas forçadas"
