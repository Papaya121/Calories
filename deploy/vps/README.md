# VPS deploy

## 1) One-time setup on server

```bash
cd /root/Calories
chmod +x deploy/vps/deploy.sh deploy/vps/setup-domain.sh
bash deploy/vps/deploy.sh
```

This creates/enables:
- `calories-backend.service`
- `calories-frontend.service`

Requirements:
- Ubuntu server with `systemd`, `nginx`
- Node.js `20+` (deploy script checks this)

## 2) Domain + HTTPS

```bash
cd /root/Calories
bash deploy/vps/setup-domain.sh your-domain.com your-email@example.com
```

The script:
- creates nginx config from template
- uses local certs from `certs/certificate.crt` + `certs/certificate.key` when they exist
- otherwise installs `certbot` and gets Let's Encrypt cert
- updates backend `.env` (`CORS_ORIGIN`, `AI_IMAGE_PUBLIC_BASE_URL`) without deleting other values
- writes frontend `.env.production` (`NEXT_PUBLIC_API_BASE_URL=https://<domain>/api/v1`)

Force cert mode via env:

```bash
SETUP_DOMAIN_CERT_MODE=local bash deploy/vps/setup-domain.sh your-domain.com
SETUP_DOMAIN_CERT_MODE=letsencrypt bash deploy/vps/setup-domain.sh your-domain.com your-email@example.com
```

## 3) GitHub Actions secrets

Set these repository secrets:
- `VPS_HOST` (example: `155.212.191.239`)
- `VPS_USER` (example: `root`)
- `VPS_SSH_KEY` (private key that can SSH to VPS)

Workflow file: `.github/workflows/deploy.yml`.
