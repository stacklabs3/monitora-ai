#!/bin/sh
# Reinicia a máquina do banco sem gravar o cache, durante a carga, e confere as confirmações.
# Roda na OUTRA máquina, onde ficam o gerador e o registro de confirmações.
# Uso: quedas-sysrq.sh binarios servidor pasta_saida quantidade intervalo_s
# Ambiente: COMANDO_ROOT (ex.: "ssh maquina sudo"), COMANDO_RELIGAR (opcional).
set -eu
binarios="$1"; endereco_servidor="$2"; pasta_saida="$3"; quantidade_quedas="$4"; intervalo_s="$5"
: "${COMANDO_ROOT:?defina COMANDO_ROOT}"
limite_volta_s="${LIMITE_VOLTA_S:-300}"

identificador_boot() {
  $COMANDO_ROOT cat /proc/sys/kernel/random/boot_id 2>/dev/null || true
}

esperar_volta() {
  inicio_espera=$(date +%s)
  religou=0
  until curl -fsS --max-time 2 "$endereco_servidor/saude" >/dev/null 2>&1; do
    decorrido=$(($(date +%s) - inicio_espera))
    [ "$decorrido" -lt "$limite_volta_s" ] || { echo "FALHA: servidor não voltou em $limite_volta_s s"; return 1; }
    if [ -n "${COMANDO_RELIGAR:-}" ] && [ "$religou" -eq 0 ] && [ "$decorrido" -ge 20 ]; then
      religou=1
      sh -c "$COMANDO_RELIGAR" >/dev/null 2>&1 || true
    fi
    sleep 1
  done
  echo "$(($(date +%s) - inicio_espera))"
}

duracao_carga_s=$(((quantidade_quedas + 1) * (intervalo_s + 60)))
"$binarios/gerador" --servidor "$endereco_servidor" --saida "$pasta_saida" --execucao quedas \
  ritmo --duracao-s "$duracao_carga_s" --reenvio-apos-s 30 --sem-buscas >"$pasta_saida.gerador.log" 2>&1 &
pid_gerador=$!

numero_queda=1
while [ "$numero_queda" -le "$quantidade_quedas" ]; do
  sleep "$intervalo_s"
  boot_antes=$(identificador_boot)
  [ -n "$boot_antes" ] || { echo "FALHA: não li o identificador de boot"; exit 1; }
  echo 'echo b > /proc/sysrq-trigger' | $COMANDO_ROOT sh >/dev/null 2>&1 || true
  sleep 3
  tempo_volta=$(esperar_volta) || { echo "$tempo_volta"; exit 1; }
  boot_depois=$(identificador_boot)
  # Sem boot novo a queda não aconteceu e a conferência não provaria nada.
  [ -n "$boot_depois" ] && [ "$boot_depois" != "$boot_antes" ] || { echo "FALHA: a máquina não reiniciou na queda $numero_queda"; exit 1; }
  echo "queda $numero_queda: reiniciou e voltou em $tempo_volta s"
  numero_queda=$((numero_queda + 1))
done
wait "$pid_gerador"
sleep 8
"$binarios/conferidor" --servidor "$endereco_servidor" --confirmados "$pasta_saida/confirmados.log"
