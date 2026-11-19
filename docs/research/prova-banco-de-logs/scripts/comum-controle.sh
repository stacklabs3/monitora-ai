# Controle negativo do conferidor (RP1): perda e duplicata plantadas precisam reprovar.
# Quem inclui define binarios, endereco_servidor e com_limite. Usa só a API do servidor,
# então vale igual para os três bancos, no Docker e na máquina virtual.

limite_conferencia_s="${LIMITE_CONFERENCIA_S:-7200}"

# Roda o conferidor, guarda a saída e devolve o código real dele.
rodar_conferidor() {
  codigo_conferidor=0
  com_limite "$limite_conferencia_s" "$binarios/conferidor" --servidor "$endereco_servidor" \
    --confirmados "$1" >"$2" 2>&1 || codigo_conferidor=$?
  return "$codigo_conferidor"
}

# Lê um contador da linha de resumo. Sem a linha, o conferidor não chegou a comparar nada.
contador_conferencia() {
  sed -n "s/^confirmados=.* $1=\([0-9][0-9]*\).*/\1/p" "$2" | head -1
}

evento_de_controle() {
  cat <<JSON
{"id":"$1","ts_ms":$2,"produto":"excurfly","ambiente":"controle","aplicacao":"excurfly-api","execucao":"$3","seq":1,"nivel":"info","familia":"controle","ocorrencia":"controle","nome":"controle","rota":"/controle","url":"/controle","status":"ok","valor_centavos":null,"assentos":[],"palavras":"controle","corpo":"controle negativo sintetico","campos":{"accountId":"$4"}}
JSON
}

# Uso: controle_negativo_conferidor confirmados.log pasta_saida rotulo
controle_negativo_conferidor() {
  arquivo_confirmados="$1"; pasta_controle="$2"; rotulo_controle="$3"
  mkdir -p "$pasta_controle"
  instante_controle_ms="$(date +%s)000"
  execucao_controle="controle-$rotulo_controle-$(date +%s)"
  conta_controle="$execucao_controle"

  cp "$arquivo_confirmados" "$pasta_controle/confirmados-com-perda.log"
  echo "excurfly-api $execucao_controle 900000 900002 $instante_controle_ms" >>"$pasta_controle/confirmados-com-perda.log"
  if rodar_conferidor "$pasta_controle/confirmados-com-perda.log" "$pasta_controle/perda.txt"; then
    echo "FALHA: o conferidor aprovou uma perda plantada"; return 1
  fi
  perdidos_plantados=$(contador_conferencia perdidos "$pasta_controle/perda.txt")
  [ "${perdidos_plantados:-0}" -ge 3 ] || { echo "FALHA: o conferidor reprovou sem contar a perda plantada"; cat "$pasta_controle/perda.txt"; return 1; }

  for sufixo_evento in original copia; do
    corpo_lote="{\"eventos\":[$(evento_de_controle "$execucao_controle-$sufixo_evento" "$instante_controle_ms" "$execucao_controle" "$conta_controle")]}"
    com_limite 90 curl -fsS --max-time 60 "$endereco_servidor/v1/eventos" -H 'content-type: application/json' -d "$corpo_lote" >/dev/null
  done
  tentativas_duplicata=0; duplicados_plantados=0
  while [ "$tentativas_duplicata" -lt 24 ]; do
    rodar_conferidor "$arquivo_confirmados" "$pasta_controle/duplicata.txt" || true
    duplicados_plantados=$(contador_conferencia duplicados "$pasta_controle/duplicata.txt")
    [ "${duplicados_plantados:-0}" -lt 1 ] || break
    tentativas_duplicata=$((tentativas_duplicata + 1)); sleep 5
  done
  [ "${duplicados_plantados:-0}" -ge 1 ] || { echo "FALHA: o conferidor não viu a duplicata plantada"; return 1; }

  com_limite 3700 curl -fsS --max-time 3600 "$endereco_servidor/v1/exclusoes" -H 'content-type: application/json' \
    -d "{\"termo_pessoa\":\"accountId=$conta_controle\"}" >/dev/null
  tentativas_limpeza=0
  until rodar_conferidor "$arquivo_confirmados" "$pasta_controle/depois-da-limpeza.txt"; do
    tentativas_limpeza=$((tentativas_limpeza + 1))
    [ "$tentativas_limpeza" -lt 60 ] || { echo "FALHA: a duplicata plantada não saiu do banco"; cat "$pasta_controle/depois-da-limpeza.txt"; return 1; }
    sleep 5
  done
  echo "controle negativo ok: perdidos_plantados=$perdidos_plantados duplicados_plantados=$duplicados_plantados, ambos reprovaram"
}
