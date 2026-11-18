#!/bin/sh
# Amostra CPU, memória, swap, disco e E/S da máquina em CSV. Roda como root na máquina do banco.
# Uso: coletar-metricas.sh saida.csv pasta_dados 'regex_dos_processos' [intervalo_s] [amostras]
# Memória dos processos é PSS somado (não conta duas vezes a memória compartilhada).
set -eu
arquivo_saida="$1"
pasta_dados="$2"
regex_processos="$3"
intervalo_s="${4:-10}"
amostras_restantes="${5:-0}"

ler_cpu() { awk '/^cpu /{ocioso=$5+$6; total=0; for (coluna=2; coluna<=NF; coluna++) total+=$coluna; print total, ocioso}' /proc/stat; }

ler_disco() {
  awk '$3 ~ /^(nvme[0-9]+n[0-9]+|xvd[a-z]+|sd[a-z]+|vd[a-z]+)$/ {leituras+=$4; setores_lidos+=$6; escritas+=$8; setores_escritos+=$10; descargas+=$(NF-1)}
       END {print leituras+0, setores_lidos+0, escritas+0, setores_escritos+0, descargas+0}' /proc/diskstats
}

memoria_processos_kb() {
  soma_kb=0
  for pasta_processo in /proc/[0-9]*; do
    comando=$(tr '\0' ' ' 2>/dev/null <"$pasta_processo/cmdline" || true)
    if [ -n "$comando" ] && printf '%s' "$comando" | grep -Eq "$regex_processos"; then
      pss_kb=$(awk '/^Pss:/{print $2; exit}' "$pasta_processo/smaps_rollup" 2>/dev/null || true)
      soma_kb=$((soma_kb + ${pss_kb:-0}))
    fi
  done
  echo "$soma_kb"
}

[ -f "$arquivo_saida" ] || echo "instante_s,cpu_pct,mem_usada_kb,mem_processos_kb,swap_usada_kb,disco_usado_kb,disco_livre_kb,leituras_s,escritas_s,kb_lidos_s,kb_escritos_s,descargas_s" >"$arquivo_saida"

set -- $(ler_cpu); cpu_total_anterior=$1; cpu_ocioso_anterior=$2
set -- $(ler_disco); leituras_ant=$1; setores_lidos_ant=$2; escritas_ant=$3; setores_escritos_ant=$4; descargas_ant=$5

while :; do
  sleep "$intervalo_s"
  set -- $(ler_cpu); cpu_total=$1; cpu_ocioso=$2
  set -- $(ler_disco); leituras=$1; setores_lidos=$2; escritas=$3; setores_escritos=$4; descargas=$5
  set -- $(awk '/^MemTotal:/{total=$2} /^MemAvailable:/{livre=$2} /^SwapTotal:/{swap=$2} /^SwapFree:/{swap_livre=$2} END {print total-livre, swap-swap_livre}' /proc/meminfo)
  memoria_usada_kb=$1; swap_usada_kb=$2
  set -- $(df -Pk "$pasta_dados" | awk 'NR==2 {print $3, $4}')
  disco_usado_kb=$1; disco_livre_kb=$2
  awk -v instante="$(date +%s)" -v delta_total="$((cpu_total - cpu_total_anterior))" -v delta_ocioso="$((cpu_ocioso - cpu_ocioso_anterior))" \
      -v intervalo="$intervalo_s" -v memoria="$memoria_usada_kb" -v processos="$(memoria_processos_kb)" -v swap="$swap_usada_kb" \
      -v usado="$disco_usado_kb" -v livre="$disco_livre_kb" \
      -v leituras="$((leituras - leituras_ant))" -v escritas="$((escritas - escritas_ant))" \
      -v lidos="$((setores_lidos - setores_lidos_ant))" -v escritos="$((setores_escritos - setores_escritos_ant))" \
      -v descargas="$((descargas - descargas_ant))" 'BEGIN {
        cpu = delta_total > 0 ? 100 * (delta_total - delta_ocioso) / delta_total : 0
        printf "%s,%.1f,%s,%s,%s,%s,%s,%.1f,%.1f,%.0f,%.0f,%.1f\n", instante, cpu, memoria, processos, swap, usado, livre,
          leituras/intervalo, escritas/intervalo, lidos/2/intervalo, escritos/2/intervalo, descargas/intervalo
      }' >>"$arquivo_saida"
  cpu_total_anterior=$cpu_total; cpu_ocioso_anterior=$cpu_ocioso
  leituras_ant=$leituras; setores_lidos_ant=$setores_lidos; escritas_ant=$escritas; setores_escritos_ant=$setores_escritos; descargas_ant=$descargas
  if [ "$amostras_restantes" -gt 0 ]; then
    amostras_restantes=$((amostras_restantes - 1))
    [ "$amostras_restantes" -gt 0 ] || exit 0
  fi
done
