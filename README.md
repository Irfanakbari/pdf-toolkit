# PDF Toolkit

Monorepo Next.js + FastAPI untuk pemrosesan PDF anonim dengan capability token, PostgreSQL, Redis/Dramatiq, dan storage eksternal.

## Pengembangan lokal

1. Salin `.env.example` ke `.env`, ubah password, dan atur `NAS_HOST_PATH`. Kredensial NAS tidak boleh dimasukkan ke environment aplikasi.
2. Jalankan `docker compose up --build`.
3. Buka `http://localhost:3000/pdf-tools`; API docs di `http://localhost:8000/api/docs`.

Tanpa Docker: backend memakai `uv sync --project apps/api --dev` dan `uv run --project apps/api pytest apps/api/tests`; frontend memakai `pnpm install` dan `pnpm dev:web`.

## Production deployment

Target adalah Debian 13 pada `10.10.10.110`, dengan web pada port `3000`, API pada port `8000`, image privat GHCR, serta SMB yang sudah di-mount host pada `/mnt/pdf-toolkit`. Compose produksi tidak menyimpan kredensial SMB dan memakai volume Docker persisten untuk PostgreSQL/Redis.

### Bootstrap server

Jalankan template secara lokal di server sebagai user dengan akses sudo:

```bash
bash deploy/bootstrap-server.sh
sudo editor /root/.smbcredentials-pdf-toolkit
sudo chmod 600 /root/.smbcredentials-pdf-toolkit
sudo sh -c 'printf "%s\n" "//192.168.1.15/PDF_TEMP /mnt/pdf-toolkit cifs credentials=/root/.smbcredentials-pdf-toolkit,vers=3.0,uid=1000,gid=1000,file_mode=0600,dir_mode=0700,_netdev,nofail,x-systemd.automount 0 0" >> /etc/fstab'
sudo systemctl daemon-reload
sudo mount /mnt/pdf-toolkit
```

Isi file credentials hanya dengan `username=...`, `password=...`, dan opsional `domain=...`; jangan commit file tersebut. Salin repository/worktree deployment ke `/opt/pdf-toolkit`, lalu:

```bash
sudo cp deploy/.env.production.example deploy/.env.production
sudo editor deploy/.env.production
sudo chown -R vuteq:vuteq /opt/pdf-toolkit
```

Gunakan password PostgreSQL acak. Login GHCR private pada server dengan token read-only packages (`docker login ghcr.io`) sebelum deployment pertama.

### GitHub configuration

Workflow CI memvalidasi backend, frontend, dan kedua Compose. Setelah CI `main` sukses, workflow publish membuat:

- `ghcr.io/irfanakbari/pdf-toolkit-api:sha-<40-char-commit>`
- `ghcr.io/irfanakbari/pdf-toolkit-web:sha-<40-char-commit>`

`NEXT_PUBLIC_API_URL` tertanam saat build web. Atur repository variable `NEXT_PUBLIC_API_URL`; default workflow adalah `http://10.10.10.110:8000`. Runtime environment tidak dapat mengubah nilai browser ini tanpa rebuild.

Deployment default-nya dilewati. Untuk mengaktifkan, set repository variable `ENABLE_DEPLOY=true`, buat environment `production`, dan tambahkan secrets:

- `DEPLOY_HOST` (`10.10.10.110`)
- `DEPLOY_PORT` (`1810`)
- `DEPLOY_USER` (`vuteq`)
- `DEPLOY_SSH_KEY`
- `DEPLOY_KNOWN_HOSTS` (output terverifikasi `ssh-keyscan -p 1810 10.10.10.110`)

Server harus memiliki `deploy/.env.production`; workflow tidak mengirim secrets aplikasi. Script deployment memakai `flock`, menarik exact SHA images, menjalankan migrasi one-shot, melakukan health gate, dan menyimpan release `current`/`previous` di `deploy/state`.

Deployment manual:

```bash
cd /opt/pdf-toolkit
./deploy/deploy.sh \
  ghcr.io/irfanakbari/pdf-toolkit-api:sha-<commit> \
  ghcr.io/irfanakbari/pdf-toolkit-web:sha-<commit>
```

Rollback aplikasi saja (tanpa downgrade database):

```bash
cd /opt/pdf-toolkit
./deploy/rollback.sh
```

Migrasi harus backward-compatible dengan versi aplikasi sebelumnya agar rollback aman.
