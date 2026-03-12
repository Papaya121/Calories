#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <domain> [email]"
  exit 1
fi

DOMAIN="$1"
EMAIL="${2:-}"
REPO_DIR="/root/Calories"
NGINX_AVAILABLE="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}.conf"
BACKEND_ENV="$REPO_DIR/calories-backend/.env"
FRONTEND_ENV="$REPO_DIR/calories-frontend/.env.production"
CERTBOT_DOMAINS=(-d "$DOMAIN")
CORS_ORIGIN_VALUE="https://${DOMAIN}"

if getent hosts "www.${DOMAIN}" >/dev/null 2>&1; then
  CERTBOT_DOMAINS+=(-d "www.${DOMAIN}")
  CORS_ORIGIN_VALUE="${CORS_ORIGIN_VALUE},https://www.${DOMAIN}"
fi

apt-get update
apt-get install -y certbot python3-certbot-nginx

mkdir -p /var/www/html
sed "s/__DOMAIN__/${DOMAIN}/g" \
  "$REPO_DIR/deploy/vps/nginx-calories.conf.template" > "$NGINX_AVAILABLE"

if [[ ! -L "$NGINX_ENABLED" ]]; then
  ln -s "$NGINX_AVAILABLE" "$NGINX_ENABLED"
fi

nginx -t
systemctl reload nginx

if [[ -n "$EMAIL" ]]; then
  certbot --nginx "${CERTBOT_DOMAINS[@]}" --agree-tos --redirect -m "$EMAIL" --non-interactive
else
  certbot --nginx "${CERTBOT_DOMAINS[@]}" --agree-tos --redirect --register-unsafely-without-email --non-interactive
fi

if [[ -f "$BACKEND_ENV" ]]; then
  cp "$BACKEND_ENV" "${BACKEND_ENV}.bak.$(date +%Y%m%d%H%M%S)"
  if grep -q '^CORS_ORIGIN=' "$BACKEND_ENV"; then
    sed -i "s#^CORS_ORIGIN=.*#CORS_ORIGIN=${CORS_ORIGIN_VALUE}#" "$BACKEND_ENV"
  else
    echo "CORS_ORIGIN=${CORS_ORIGIN_VALUE}" >> "$BACKEND_ENV"
  fi

  if grep -q '^AI_IMAGE_PUBLIC_BASE_URL=' "$BACKEND_ENV"; then
    sed -i "s#^AI_IMAGE_PUBLIC_BASE_URL=.*#AI_IMAGE_PUBLIC_BASE_URL=https://${DOMAIN}#" "$BACKEND_ENV"
  else
    echo "AI_IMAGE_PUBLIC_BASE_URL=https://${DOMAIN}" >> "$BACKEND_ENV"
  fi
fi

if [[ -f "$FRONTEND_ENV" ]]; then
  cp "$FRONTEND_ENV" "${FRONTEND_ENV}.bak.$(date +%Y%m%d%H%M%S)"
fi
echo "NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN}/api/v1" > "$FRONTEND_ENV"

systemctl restart calories-backend.service
systemctl restart calories-frontend.service
systemctl reload nginx

echo "Domain setup finished for ${DOMAIN}"
