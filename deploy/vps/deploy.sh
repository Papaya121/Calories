#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="/root/Calories"
BACKEND_DIR="$REPO_DIR/calories-backend"
FRONTEND_DIR="$REPO_DIR/calories-frontend"
NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"

if (( NODE_MAJOR < 20 )); then
  echo "[deploy] Node.js >= 20 is required, current: $(node -v)"
  exit 1
fi

echo "[deploy] installing systemd units"
install -m 0644 "$REPO_DIR/deploy/vps/calories-backend.service" /etc/systemd/system/calories-backend.service
install -m 0644 "$REPO_DIR/deploy/vps/calories-frontend.service" /etc/systemd/system/calories-frontend.service

echo "[deploy] backend install/build"
cd "$BACKEND_DIR"
npm ci --no-audit --no-fund
npm run build

echo "[deploy] ensure uploads directory exists"
mkdir -p "$BACKEND_DIR/uploads/meals"

echo "[deploy] frontend install/build"
cd "$FRONTEND_DIR"
export NEXT_TELEMETRY_DISABLED=1
npm ci --no-audit --no-fund
npm run build

echo "[deploy] stopping old manual backend process if present"
pkill -f "/root/Calories/calories-backend/dist/main" || true

echo "[deploy] restarting services"
systemctl daemon-reload
systemctl enable calories-backend.service calories-frontend.service
systemctl restart calories-backend.service calories-frontend.service

echo "[deploy] health checks"
systemctl is-active --quiet calories-backend.service
systemctl is-active --quiet calories-frontend.service
nginx -t
systemctl reload nginx

echo "[deploy] done"
