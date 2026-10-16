#!/usr/bin/env bash
set -Eeuo pipefail

sudo apt-get update
sudo apt-get install -y ca-certificates cifs-utils curl docker.io docker-compose-plugin util-linux
sudo install -d -m 0755 /mnt/pdf-toolkit /opt/pdf-toolkit
sudo install -m 0600 /dev/null /root/.smbcredentials-pdf-toolkit
cat <<'EOF'
Edit /root/.smbcredentials-pdf-toolkit with sudo and add:
username=YOUR_SMB_USERNAME
password=YOUR_SMB_PASSWORD
Optional: domain=YOUR_DOMAIN
Then run:
sudo chmod 600 /root/.smbcredentials-pdf-toolkit
sudo sh -c 'printf "%s\n" "//192.168.1.15/PDF_TEMP /mnt/pdf-toolkit cifs credentials=/root/.smbcredentials-pdf-toolkit,vers=3.0,uid=1000,gid=1000,file_mode=0600,dir_mode=0700,_netdev,nofail,x-systemd.automount 0 0" >> /etc/fstab'
sudo systemctl daemon-reload
sudo mount /mnt/pdf-toolkit
sudo usermod -aG docker vuteq
EOF
