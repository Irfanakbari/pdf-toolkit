#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/pdf-toolkit}"
COMPOSE_FILE="${DEPLOY_DIR}/deploy/compose.production.yml"
ENV_FILE="${DEPLOY_DIR}/deploy/.env.production"
STATE_DIR="${DEPLOY_DIR}/deploy/state"
LOCK_FILE="${DEPLOY_DIR}/deploy/deploy.lock"
[[ -f "$STATE_DIR/previous" ]] || { echo "No previous application release recorded" >&2; exit 2; }
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Another deployment is running" >&2; exit 1; }

set -a
source "$STATE_DIR/previous"
set +a
compose=(docker compose --project-directory "$DEPLOY_DIR" --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${compose[@]}" pull api worker-pdf worker-office cleanup web
"${compose[@]}" up -d --no-deps api worker-pdf worker-office cleanup web

for _ in {1..30}; do
  if curl --fail --silent --show-error "http://127.0.0.1:${API_PORT:-8000}/health/ready" >/dev/null \
    && curl --fail --silent --show-error "http://127.0.0.1:${WEB_PORT:-3000}/pdf-tools/health" >/dev/null; then
    cp "$STATE_DIR/current" "$STATE_DIR/failed" 2>/dev/null || true
    cp "$STATE_DIR/previous" "$STATE_DIR/current"
    echo "Application rollback healthy; database migrations were not downgraded"
    exit 0
  fi
  sleep 5
done

echo "Rollback failed health checks" >&2
"${compose[@]}" ps >&2
exit 1
