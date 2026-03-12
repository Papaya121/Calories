#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <domain> [email]"
  echo "  Optional env: SETUP_DOMAIN_CERT_MODE=auto|local|letsencrypt (default: auto)"
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
CERT_MODE="${SETUP_DOMAIN_CERT_MODE:-auto}"

LOCAL_CERT_CRT="$REPO_DIR/certs/certificate.crt"
LOCAL_CERT_KEY="$REPO_DIR/certs/certificate.key"
LOCAL_CERT_CA="$REPO_DIR/certs/certificate_ca.crt"
LOCAL_CERT_DIR="/etc/nginx/ssl/${DOMAIN}"
LOCAL_FULLCHAIN="$LOCAL_CERT_DIR/fullchain.pem"
LOCAL_PRIVKEY="$LOCAL_CERT_DIR/privkey.pem"

BOOTSTRAP_TEMPLATE="$REPO_DIR/deploy/vps/nginx-calories-bootstrap.conf.template"
HTTPS_TEMPLATE="$REPO_DIR/deploy/vps/nginx-calories.conf.template"

log() {
  echo "[setup-domain] $*"
}

has_local_certs() {
  [[ -f "$LOCAL_CERT_CRT" && -f "$LOCAL_CERT_KEY" ]]
}

if getent hosts "www.${DOMAIN}" >/dev/null 2>&1; then
  CERTBOT_DOMAINS+=(-d "www.${DOMAIN}")
  CORS_ORIGIN_VALUE="${CORS_ORIGIN_VALUE},https://www.${DOMAIN}"
fi

case "$CERT_MODE" in
  auto)
    if has_local_certs; then
      CERT_MODE="local"
    else
      CERT_MODE="letsencrypt"
    fi
    ;;
  local|letsencrypt)
    ;;
  *)
    echo "Unsupported SETUP_DOMAIN_CERT_MODE value: $CERT_MODE"
    echo "Allowed values: auto, local, letsencrypt"
    exit 1
    ;;
esac

mkdir -p /var/www/html

if [[ "$CERT_MODE" == "letsencrypt" ]]; then
  log "Using Let's Encrypt certificates"
  apt-get update
  apt-get install -y certbot

  sed "s/__DOMAIN__/${DOMAIN}/g" "$BOOTSTRAP_TEMPLATE" > "$NGINX_AVAILABLE"

  if [[ ! -L "$NGINX_ENABLED" ]]; then
    ln -s "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  fi

  nginx -t
  systemctl reload nginx

  if [[ -n "$EMAIL" ]]; then
    certbot certonly --webroot -w /var/www/html "${CERTBOT_DOMAINS[@]}" --agree-tos -m "$EMAIL" --non-interactive
  else
    certbot certonly --webroot -w /var/www/html "${CERTBOT_DOMAINS[@]}" --agree-tos --register-unsafely-without-email --non-interactive
  fi

  SSL_CERTIFICATE="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
  SSL_CERTIFICATE_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"
else
  log "Using local certificates from ${REPO_DIR}/certs"
  if ! has_local_certs; then
    echo "Missing local certificate files. Required:"
    echo "  $LOCAL_CERT_CRT"
    echo "  $LOCAL_CERT_KEY"
    exit 1
  fi

  install -d -m 0755 "$LOCAL_CERT_DIR"
  if [[ -f "$LOCAL_CERT_CA" ]]; then
    cat "$LOCAL_CERT_CRT" "$LOCAL_CERT_CA" > "$LOCAL_FULLCHAIN"
  else
    cp "$LOCAL_CERT_CRT" "$LOCAL_FULLCHAIN"
  fi
  cp "$LOCAL_CERT_KEY" "$LOCAL_PRIVKEY"
  chmod 0644 "$LOCAL_FULLCHAIN"
  chmod 0600 "$LOCAL_PRIVKEY"

  SSL_CERTIFICATE="$LOCAL_FULLCHAIN"
  SSL_CERTIFICATE_KEY="$LOCAL_PRIVKEY"
fi

sed -e "s/__DOMAIN__/${DOMAIN}/g" \
  -e "s#__SSL_CERTIFICATE__#${SSL_CERTIFICATE}#g" \
  -e "s#__SSL_CERTIFICATE_KEY__#${SSL_CERTIFICATE_KEY}#g" \
  "$HTTPS_TEMPLATE" > "$NGINX_AVAILABLE"

if [[ ! -L "$NGINX_ENABLED" ]]; then
  ln -s "$NGINX_AVAILABLE" "$NGINX_ENABLED"
fi

nginx -t
systemctl reload nginx

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

log "Domain setup finished for ${DOMAIN}"
