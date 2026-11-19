#!/bin/sh
# Ensaio local de cópia e restauração: faz a cópia, exclui uma pessoa e os dias vencidos no original,
# apaga o banco, restaura a cópia, reaplica as exclusões antes de abrir e compara os dois, evento a evento.
# Uso: sh scripts/testar-restauracao-local.sh clickhouse|opensearch|postgres
set -eu
nome_banco="$1"
nome_rodada="restauracao"
pasta_prova="$(cd "$(dirname "$0")/.." && pwd)"
. "$pasta_prova/scripts/comum-local.sh"

. "$pasta_prova/scripts/comum-copias.sh"

aplicar_exclusoes() {
  curl -fsS "$endereco_servidor/v1/exclusoes" -H 'content-type: application/json' \
    -d "{\"termo_pessoa\":\"$termo_pessoa\",\"dia_final_exclusivo\":$dia_atual}"
}

listar_presentes() {
  curl -fsS "$endereco_servidor/v1/presentes?desde_ms=$inicio_periodo_ms" | LC_ALL=C sort >"$1"
}

esperar_banco
limpar_banco
preparar_copias
subir_servidor
trap 'kill "$pid_servidor" 2>/dev/null || true' EXIT

echo "== dados"
gerador historico hist historico --dias 2 --eventos-por-dia 5000 --tamanho-lote 100 >/dev/null
gerador ritmo ritmo1 ritmo --duracao-s 30 --reenvio-apos-s 5 --sem-buscas >/dev/null
sleep 6

agora_ms=$(agora_em_ms)
inicio_periodo_ms=$((agora_ms - 3456000000))
inicio_busca_ms=$((agora_ms - 259200000))
dia_atual=$(($(date +%s) / 86400))
inicio_dia_atual_ms=$((dia_atual * 86400000))
termo_pessoa=$(curl -fsS "$endereco_servidor/v1/busca" -H 'content-type: application/json' \
  -d "{\"consulta\":{\"desde_ms\":$inicio_busca_ms,\"ate_ms\":$agora_ms,\"termos\":[\"nivel=info\"],\"limite\":1}}" |
  python3 -c 'import json, sys; print("accountId=" + json.loads(json.load(sys.stdin)["linhas"][0]["campos"])["accountId"])')

echo "== cópia"
fazer_copia
bytes_copia=$(medir_copia_cifrada)
echo "cópia cifrada: $bytes_copia bytes"
[ "$bytes_copia" -gt 10000 ] || falhar "cópia vazia"

echo "== exclusões depois da cópia, no original"
aplicar_exclusoes
sleep 6
listar_presentes "$resultados/original.txt"
linhas_original=$(wc -l <"$resultados/original.txt" | tr -d ' ')
[ "$linhas_original" -gt 0 ] || falhar "original ficou vazio"

echo "== máquina nova: apaga tudo e restaura"
derrubar_servidor
apagar_banco_inteiro
inicio_restauracao=$(date +%s)
restaurar_copia
subir_servidor
sleep 3
linhas_antes_da_limpeza=$(curl -fsS "$endereco_servidor/v1/presentes?desde_ms=$inicio_periodo_ms" | wc -l | tr -d ' ')
[ "$linhas_antes_da_limpeza" -gt "$linhas_original" ] || falhar "a cópia deveria trazer os dados excluídos depois dela"
aplicar_exclusoes
echo "restauração e limpeza: $(($(date +%s) - inicio_restauracao)) s"
sleep 6

echo "== comparação"
listar_presentes "$resultados/restaurado.txt"
cmp -s "$resultados/original.txt" "$resultados/restaurado.txt" || falhar "restaurado difere do original"
linhas_pessoa=$(contar_linhas "$inicio_busca_ms" "$agora_ms" "$termo_pessoa")
linhas_vencidas=$(contar_linhas "$inicio_busca_ms" "$inicio_dia_atual_ms" "nivel=info")
echo "eventos iguais=$linhas_original (antes da limpeza=$linhas_antes_da_limpeza) pessoa=$linhas_pessoa vencidos=$linhas_vencidas"
[ "$linhas_pessoa" -eq 0 ] || falhar "pessoa excluída voltou"
[ "$linhas_vencidas" -eq 0 ] || falhar "dia vencido voltou"
echo "restauração local ok"
