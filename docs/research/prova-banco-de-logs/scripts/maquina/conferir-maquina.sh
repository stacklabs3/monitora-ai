#!/bin/sh
# Conferência da máquina (#9): CPU, cifra, disco com gravação segura e repasse da ordem de gravar.
# Roda como root depois de preparar-disco.sh. Uso: conferir-maquina.sh pasta_saida [segundos_fio]
set -eu
pasta_saida="$1"
segundos_fio="${2:-60}"
mkdir -p "$pasta_saida"

contar_descargas() {
  awk '$3 ~ /^(nvme[0-9]+n[0-9]+|xvd[a-z]+|sd[a-z]+|vd[a-z]+)$/ {soma += $(NF-1)} END {print soma + 0}' /proc/diskstats
}

medir_fio() {
  nome_medida="$1"; pasta_alvo="$2"; shift 2
  fio --name="$nome_medida" --directory="$pasta_alvo" --size=512M --time_based --runtime="$segundos_fio" \
    --ioengine=psync --bs=4k --rw=randwrite --output-format=json "$@" >"$pasta_saida/fio-$nome_medida.json"
  rm -f "$pasta_alvo/$nome_medida".*
}

resumir_fio() {
  jq -r --arg nome "$1" '.jobs[0] | [$nome, (.write.iops | floor), ((.sync.lat_ns.percentile["99.000000"] // 0) / 1000000)] | @tsv' \
    "$pasta_saida/fio-$1.json"
}

lscpu >"$pasta_saida/lscpu.txt"
uname -r >"$pasta_saida/kernel.txt"
if grep -q -m1 -w aes /proc/cpuinfo; then echo sim; else echo nao; fi >"$pasta_saida/aes.txt"
cryptsetup benchmark --cipher aes-xts --key-size 512 >"$pasta_saida/cryptsetup.txt" 2>&1 || true

descargas_antes=$(contar_descargas)
medir_fio cifrado-com-fsync /dados --fsync=1
descargas_com_fsync=$(($(contar_descargas) - descargas_antes))
fsyncs=$(jq '.jobs[0].sync.total_ios // .jobs[0].sync.lat_ns.N' "$pasta_saida/fio-cifrado-com-fsync.json")

descargas_antes=$(contar_descargas)
medir_fio cifrado-sem-fsync /dados --end_fsync=0
descargas_sem_fsync=$(($(contar_descargas) - descargas_antes))

medir_fio sem-cifra-com-fsync /var/tmp --fsync=1

{
  echo "aes_na_cpu=$(cat "$pasta_saida/aes.txt")"
  echo "fsyncs_no_disco_cifrado=$fsyncs"
  echo "descargas_no_disco_real_com_fsync=$descargas_com_fsync"
  echo "descargas_no_disco_real_sem_fsync=$descargas_sem_fsync"
  printf 'medida\tiops\tp99_fsync_ms\n'
  resumir_fio cifrado-com-fsync
  resumir_fio sem-cifra-com-fsync
} | tee "$pasta_saida/resumo.txt"

# A ordem de gravar atravessa cifra e arquivo se quase todo fsync vira descarga no disco real.
if [ "$((descargas_com_fsync * 2))" -ge "$fsyncs" ] && [ "$descargas_com_fsync" -gt "$((descargas_sem_fsync * 2))" ]; then
  echo "repasse_da_ordem_de_gravar=confirmado" | tee -a "$pasta_saida/resumo.txt"
else
  echo "repasse_da_ordem_de_gravar=NAO_confirmado" | tee -a "$pasta_saida/resumo.txt"
  exit 1
fi
