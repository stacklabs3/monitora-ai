#!/bin/sh
# Cria o disco cifrado (LUKS2 sobre arquivo) em /dados. Roda como root na máquina do banco.
# A chave é descartável e fica na própria máquina, que só guarda dados sintéticos.
# Uso: preparar-disco.sh [gigabytes_reservados_para_o_sistema]
set -eu
reserva_sistema_gb="${1:-6}"
arquivo_cofre=/var/cofre-prova.img
arquivo_chave=/root/chave-cofre-sintetica

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null
apt-get install -y -qq cryptsetup fio sysstat jq >/dev/null
swapoff -a
sed -i '/\sswap\s/d' /etc/fstab

livre_gb=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
tamanho_gb=$((livre_gb - reserva_sistema_gb))
[ "$tamanho_gb" -ge 10 ] || { echo "disco pequeno demais: $livre_gb GB livres" >&2; exit 1; }

umask 077
[ -f "$arquivo_chave" ] || head -c 64 /dev/urandom >"$arquivo_chave"
fallocate -l "${tamanho_gb}G" "$arquivo_cofre"
cryptsetup luksFormat --batch-mode --type luks2 --key-file "$arquivo_chave" "$arquivo_cofre"

cat >/usr/local/sbin/abrir-cofre-prova <<'FIM'
#!/bin/sh
set -eu
dispositivo_loop=$(losetup --find --show --direct-io=on /var/cofre-prova.img)
cryptsetup open --key-file /root/chave-cofre-sintetica "$dispositivo_loop" cofre-prova
mkdir -p /dados
blkid /dev/mapper/cofre-prova >/dev/null 2>&1 || mkfs.ext4 -q -m 0 /dev/mapper/cofre-prova
fsck.ext4 -p /dev/mapper/cofre-prova || [ "$?" -le 1 ]
mount -o noatime /dev/mapper/cofre-prova /dados
FIM
chmod 755 /usr/local/sbin/abrir-cofre-prova

cat >/etc/systemd/system/cofre-prova.service <<'FIM'
[Unit]
Description=Disco cifrado da prova
DefaultDependencies=no
After=local-fs.target
Before=multi-user.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/abrir-cofre-prova

[Install]
WantedBy=multi-user.target
FIM
systemctl daemon-reload
systemctl enable --now cofre-prova.service
df -h /dados | tail -1
