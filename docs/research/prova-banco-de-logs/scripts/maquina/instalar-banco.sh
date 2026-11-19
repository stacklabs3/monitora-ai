#!/bin/sh
# Instala um banco, nas versões fixadas da prova, com os dados em /dados, e o servidor de teste.
# Roda como root, com a pasta da prova em /opt/prova.
# Uso: instalar-banco.sh clickhouse|opensearch|postgres pasta_binarios
set -eu
nome_banco="$1"
pasta_binarios="$2"
pasta_prova=/opt/prova
porta_servidor="${PORTA_SERVIDOR:-18090}"
reserva_bytes="${RESERVA_BYTES:-0}"
arquitetura=$(dpkg --print-architecture)
export DEBIAN_FRONTEND=noninteractive

apt-get install -y -qq curl gnupg ca-certificates >/dev/null
mkdir -p /etc/apt/keyrings /dados/copias

ligar_ao_cofre() {
  mkdir -p "/etc/systemd/system/$1.service.d"
  printf '[Unit]\nRequires=cofre-prova.service\nAfter=cofre-prova.service\n' >"/etc/systemd/system/$1.service.d/cofre.conf"
}

case "$nome_banco" in
  postgres)
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor --yes -o /etc/apt/keyrings/pgdg.gpg
    echo "deb [signed-by=/etc/apt/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" >/etc/apt/sources.list.d/pgdg.list
    apt-get update -qq >/dev/null
    mkdir -p /etc/postgresql-common
    echo 'create_main_cluster = false' >/etc/postgresql-common/createcluster.conf
    versao_pacote=$(apt-cache madison postgresql-18 | awk '$3 ~ /^18\.7-/ {print $3; exit}')
    apt-get install -y -qq "postgresql-18=$versao_pacote" "postgresql-client-18=$versao_pacote" >/dev/null
    mkdir -p /dados/postgres; chown postgres:postgres /dados/postgres /dados/copias
    pg_createcluster 18 main -d /dados/postgres/18 >/dev/null
    grep -v '^listen_addresses' "$pasta_prova/config/postgresql.conf" >>/etc/postgresql/18/main/postgresql.conf
    echo "listen_addresses = '127.0.0.1'" >>/etc/postgresql/18/main/postgresql.conf
    sed -i '1i host all postgres 127.0.0.1/32 trust' /etc/postgresql/18/main/pg_hba.conf
    ligar_ao_cofre 'postgresql@18-main'
    systemctl daemon-reload
    systemctl enable --now postgresql@18-main >/dev/null 2>&1
    su postgres -c 'createdb prova'
    servico_banco='postgresql@18-main.service'
    endereco_banco='host=127.0.0.1 port=5432 user=postgres dbname=prova'
    ;;
  clickhouse)
    curl -fsSL https://packages.clickhouse.com/rpm/lts/repodata/repomd.xml.key | gpg --dearmor --yes -o /etc/apt/keyrings/clickhouse.gpg
    echo "deb [signed-by=/etc/apt/keyrings/clickhouse.gpg] https://packages.clickhouse.com/deb stable main" >/etc/apt/sources.list.d/clickhouse.list
    apt-get update -qq >/dev/null
    apt-get install -y -qq clickhouse-common-static=26.10.4.207 clickhouse-server=26.10.4.207 clickhouse-client=26.10.4.207 >/dev/null
    systemctl stop clickhouse-server
    mkdir -p /dados/clickhouse; chown -R clickhouse:clickhouse /dados/clickhouse /dados/copias
    sed 's#/copias/#/dados/copias/#; s#<listen_host>0.0.0.0</listen_host>#<listen_host>127.0.0.1</listen_host><path>/dados/clickhouse/</path><tmp_path>/dados/clickhouse/tmp/</tmp_path><user_files_path>/dados/clickhouse/user_files/</user_files_path>#' \
      "$pasta_prova/config/clickhouse-pouca-memoria.xml" >/etc/clickhouse-server/config.d/pouca-memoria.xml
    cp "$pasta_prova/config/clickhouse-usuario.xml" /etc/clickhouse-server/users.d/pouca-memoria.xml
    chown clickhouse:clickhouse /etc/clickhouse-server/config.d/pouca-memoria.xml /etc/clickhouse-server/users.d/pouca-memoria.xml
    ligar_ao_cofre clickhouse-server
    systemctl daemon-reload
    systemctl enable --now clickhouse-server >/dev/null 2>&1
    servico_banco='clickhouse-server.service'
    endereco_banco='http://127.0.0.1:8123/'
    ;;
  opensearch)
    case "$arquitetura" in amd64) sufixo=x64 ;; *) sufixo=arm64 ;; esac
    pacote=/var/tmp/opensearch.deb
    curl -fsSL -o "$pacote" "https://artifacts.opensearch.org/releases/bundle/opensearch/3.9.0/opensearch-3.9.0-linux-$sufixo.deb"
    DISABLE_INSTALL_DEMO_CONFIG=true DISABLE_SECURITY_PLUGIN=true dpkg -i "$pacote" >/dev/null
    rm -f "$pacote"
    systemctl stop opensearch 2>/dev/null || true
    mkdir -p /dados/opensearch; chown -R opensearch:opensearch /dados/opensearch /dados/copias
    cat >/etc/opensearch/opensearch.yml <<'FIM'
path.data: /dados/opensearch
path.logs: /var/log/opensearch
path.repo: ["/dados/copias"]
network.host: 127.0.0.1
discovery.type: single-node
plugins.security.disabled: true
bootstrap.memory_lock: true
FIM
    printf -- '-Xms700m\n-Xmx700m\n' >/etc/opensearch/jvm.options.d/prova.options
    echo 'vm.max_map_count=262144' >/etc/sysctl.d/90-opensearch.conf
    sysctl -q -p /etc/sysctl.d/90-opensearch.conf
    mkdir -p /etc/systemd/system/opensearch.service.d
    printf '[Service]\nLimitMEMLOCK=infinity\nLimitNOFILE=65536\nTimeoutStartSec=600\n' >/etc/systemd/system/opensearch.service.d/limites.conf
    ligar_ao_cofre opensearch
    systemctl daemon-reload
    systemctl enable --now opensearch >/dev/null 2>&1
    servico_banco='opensearch.service'
    endereco_banco='http://127.0.0.1:9200'
    ;;
  *) echo "banco desconhecido: $nome_banco" >&2; exit 2 ;;
esac

install -m 755 "$pasta_binarios/servidor" /usr/local/bin/servidor-prova
cat >/etc/systemd/system/servidor-prova.service <<FIM
[Unit]
Description=Servidor de teste da prova
Requires=$servico_banco
After=$servico_banco

[Service]
Environment="BANCO=$nome_banco"
Environment="ENDERECO_BANCO=$endereco_banco"
Environment="PORTA=$porta_servidor"
Environment="PASTA_DADOS=/dados"
Environment="RESERVA_BYTES=$reserva_bytes"
ExecStart=/usr/local/bin/servidor-prova
Restart=always
RestartSec=1

[Install]
WantedBy=multi-user.target
FIM
systemctl daemon-reload
systemctl enable --now servidor-prova.service >/dev/null 2>&1
echo "$nome_banco instalado"
