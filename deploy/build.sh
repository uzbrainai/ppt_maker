#!/usr/bin/env bash
# Build the slidewind backend + web frontend for production.
# Run from the repo root on the server:  bash deploy/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "▶ Backend: install + compile (dist/) …"
npm ci
npm run build

echo "▶ Frontend: install + build (front/web/dist/) …"
cd front/web
npm ci
# Same-origin API in production: the web app calls /api, nginx proxies it.
if [ ! -f .env.production ]; then
  printf 'VITE_API_BASE=\nVITE_SLIDEWIND_BASE=/api\nVITE_SLIDEWIND_TOKEN=\n' > .env.production
  echo "  created front/web/.env.production (VITE_SLIDEWIND_BASE=/api)"
fi
npm run build

echo "✓ Build complete."
echo "  Backend  → dist/services/server.js   (run via pm2)"
echo "  Frontend → front/web/dist/           (served by nginx)"
