#!/bin/sh
# Dobra a carga a cada degrau até quebrar uma meta (#9: degraus de 30 min).
# Uso: degraus-de-carga.sh binarios servidor pasta_saida taxa_inicial duracao_s taxa_maxima [argumentos do relatorio]
set -eu
binarios="$1"; endereco_servidor="$2"; pasta_saida="$3"; taxa_atual="$4"; duracao_s="$5"; taxa_maxima="$6"
shift 6
maior_taxa_aprovada=0
numero_degrau=1
while [ "$taxa_atual" -le "$taxa_maxima" ]; do
  pasta_degrau="$pasta_saida/degrau-$numero_degrau-$taxa_atual"
  "$binarios/gerador" --servidor "$endereco_servidor" --saida "$pasta_degrau" --execucao "degrau$numero_degrau" \
    ritmo --duracao-s "$duracao_s" --eventos-por-segundo "$taxa_atual" --reenvio-apos-s 5 >/dev/null
  if "$binarios/relatorio" --pasta "$pasta_degrau" --verificar "$@" >"$pasta_degrau/relatorio.txt"; then
    maior_taxa_aprovada=$taxa_atual
    echo "degrau $taxa_atual/s: dentro das metas"
  else
    echo "degrau $taxa_atual/s: fora das metas"
    sed -n '/^VEREDITO/,$p' "$pasta_degrau/relatorio.txt" | cut -c1-160 | head -6
    break
  fi
  taxa_atual=$((taxa_atual * 2))
  numero_degrau=$((numero_degrau + 1))
done
echo "maior carga aprovada: $maior_taxa_aprovada eventos/s"
