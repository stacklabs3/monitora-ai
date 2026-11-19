# Cópia e restauração por banco. Quem inclui define nome_banco, endereco_banco e compose_prova.
nome_copia="copia1"
endereco_repositorio="$endereco_banco/_snapshot/copias"

no_banco_como_root() {
  compose_prova exec -T -u root "$nome_banco" sh -c "$1"
}

preparar_copias() {
  case "$nome_banco" in
    clickhouse) dono_copias=clickhouse ;;
    opensearch) dono_copias=opensearch ;;
    postgres) dono_copias=postgres ;;
  esac
  no_banco_como_root "rm -rf /copias/* && chown -R $dono_copias /copias"
}

registrar_repositorio() {
  curl -fsS -o /dev/null -X PUT "$endereco_repositorio" -H 'content-type: application/json' \
    -d '{"type":"fs","settings":{"location":"/copias"}}'
}

fazer_copia() {
  case "$nome_banco" in
    clickhouse)
      curl -fsS -o /dev/null "$endereco_banco" -d "BACKUP TABLE eventos TO File('/copias/$nome_copia')" ;;
    opensearch)
      registrar_repositorio
      curl -fsS -o /dev/null -X PUT "$endereco_repositorio/$nome_copia?wait_for_completion=true" \
        -H 'content-type: application/json' -d '{"indices":"eventos-*","include_global_state":false}' ;;
    postgres)
      compose_prova exec -T -u postgres postgres pg_dump -U postgres -d prova -Fc -Z zstd -f "/copias/$nome_copia.dump" ;;
  esac
}

restaurar_copia() {
  case "$nome_banco" in
    clickhouse)
      curl -fsS -o /dev/null "$endereco_banco" -d "RESTORE TABLE eventos FROM File('/copias/$nome_copia')" ;;
    opensearch)
      registrar_repositorio
      curl -fsS -o /dev/null -X POST "$endereco_repositorio/$nome_copia/_restore?wait_for_completion=true" \
        -H 'content-type: application/json' -d '{"indices":"eventos-*","include_global_state":false}' ;;
    postgres)
      compose_prova exec -T -u postgres postgres pg_restore -U postgres -d prova --no-owner "/copias/$nome_copia.dump" ;;
  esac
}

# Mede a cópia como ela sairia da máquina: empacotada e cifrada com chave descartável.
medir_copia_cifrada() {
  CHAVE_DESCARTAVEL=$(openssl rand -hex 32)
  export CHAVE_DESCARTAVEL
  no_banco_como_root "tar -C /copias -cf - ." |
    openssl enc -aes-256-ctr -pbkdf2 -salt -pass env:CHAVE_DESCARTAVEL | wc -c | tr -d ' '
  unset CHAVE_DESCARTAVEL
}

apagar_banco_inteiro() {
  compose_prova rm -sf "$nome_banco" >/dev/null 2>&1
  docker volume rm "prova-banco-de-logs_dados-$nome_banco" >/dev/null
  compose_prova up -d "$nome_banco" >/dev/null 2>&1
  esperar_banco
}
