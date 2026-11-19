#!/bin/sh
# Ensaia a automação numa máquina virtual Lima de 2 GB, criada do zero para cada banco.
# Uso: sh scripts/ensaiar-maquina-local.sh clickhouse|opensearch|postgres [quedas]
set -eu
nome_banco="$1"
quantidade_quedas="${2:-3}"
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
nome_maquina=prova-banco
resultados="$pasta_prova/resultados-locais/maquina/$nome_banco"
binarios_mac="$pasta_prova/bancada/target/release"
endereco_servidor=http://127.0.0.1:18090

como_root() {
  limactl shell "$nome_maquina" sudo "$@"
}

case "$nome_banco" in
  postgres) regex_processos='bin/postgres|postgres:|servidor-prova' ;;
  clickhouse) regex_processos='clickhouse|servidor-prova' ;;
  opensearch) regex_processos='opensearch|servidor-prova' ;;
  *) echo "banco desconhecido: $nome_banco" >&2; exit 2 ;;
esac

rm -rf "$resultados"
mkdir -p "$resultados"

echo "== máquina nova"
limactl delete --force "$nome_maquina" >/dev/null 2>&1 || true
limactl start --name="$nome_maquina" --cpus=2 --memory=2 --disk=30 --vm-type=vz --mount-none -y template:ubuntu-24.04 >/dev/null 2>&1
COPYFILE_DISABLE=1 tar -C "$pasta_prova" -czf - config scripts bancada/target-linux-arm64/release/servidor |
  como_root sh -c 'mkdir -p /opt/prova && tar -C /opt/prova -xzf - 2>/dev/null'

echo "== disco cifrado e instalação"
executar_etapa() {
  arquivo_etapa="$resultados/$1.log"; shift
  if ! como_root "$@" >"$arquivo_etapa" 2>&1; then
    echo "FALHA em $arquivo_etapa:"; tail -5 "$arquivo_etapa" | cut -c1-220
    exit 1
  fi
  tail -1 "$arquivo_etapa" | cut -c1-120
}
executar_etapa disco sh /opt/prova/scripts/maquina/preparar-disco.sh 4
executar_etapa instalacao sh /opt/prova/scripts/maquina/instalar-banco.sh "$nome_banco" /opt/prova/bancada/target-linux-arm64/release
tentativas=0
until curl -fsS --max-time 2 "$endereco_servidor/saude" >/dev/null 2>&1; do
  tentativas=$((tentativas + 1))
  [ "$tentativas" -lt 180 ] || { echo "FALHA: servidor não respondeu"; como_root journalctl -u servidor-prova -n 8 --no-pager | cut -c1-200; exit 1; }
  sleep 1
done

echo "== carga com medida de memória"
como_root sh -c "nohup sh /opt/prova/scripts/coletar-metricas.sh /var/tmp/metricas.csv /dados '$regex_processos' 5 24 >/dev/null 2>&1 &"
"$binarios_mac/gerador" --servidor "$endereco_servidor" --saida "$resultados/carga" --execucao carga \
  ritmo --duracao-s 120 --picos 30:30:120 --reenvio-apos-s 20 >/dev/null
como_root cat /var/tmp/metricas.csv >"$resultados/metricas.csv"
"$binarios_mac/relatorio" --pasta "$resultados/carga" --verificar >"$resultados/relatorio-carga.txt" || true
sed -n '1,3p;/^VEREDITO/,$p' "$resultados/relatorio-carga.txt" | cut -c1-150 | head -12
awk -F, 'NR>1 {if ($4>memoria) memoria=$4; if ($5>swap) swap=$5; soma+=$2; amostras++}
  END {printf "pico de memória banco+servidor=%.0f MB swap=%.0f MB cpu média=%.0f%%\n", memoria/1024, swap/1024, soma/amostras}' "$resultados/metricas.csv"

echo "== quedas com sysrq"
COMANDO_ROOT="limactl shell $nome_maquina sudo" COMANDO_RELIGAR="limactl start $nome_maquina -y" \
  sh "$pasta_prova/scripts/quedas-sysrq.sh" "$binarios_mac" "$endereco_servidor" "$resultados/quedas" "$quantidade_quedas" 30
echo "ensaio da máquina ok: $nome_banco"
