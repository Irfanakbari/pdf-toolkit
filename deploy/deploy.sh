#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/pdf-toolkit}"
COMPOSE_FILE="${DEPLOY_DIR}/deploy/compose.production.yml"
ENV_FILE="${DEPLOY_DIR}/deploy/.env.production"
STATE_DIR="${DEPLOY_DIR}/deploy/state"
LOCK_FILE="${DEPLOY_DIR}/deploy/deploy.lock"
API_IMAGE="${1:?Usage: deploy.sh API_IMAGE WEB_IMAGE}"
WEB_IMAGE="${2:?Usage: deploy.sh API_IMAGE WEB_IMAGE}"

is_immutable() {
  [[ "$1" =~ ^ghcr\.io/irfanakbari/pdf-toolkit-(api|web):(sha-)?[0-9a-f]{40}$ || "$1" =~ ^ghcr\.io/irfanakbari/pdf-toolkit-(api|web)@sha256:[0-9a-f]{64}$ ]]
}

is_immutable "$API_IMAGE" || { echo "API_IMAGE must use an immutable SHA tag or digest" >&2; exit 2; }
is_immutable "$WEB_IMAGE" || { echo "WEB_IMAGE must use an immutable SHA tag or digest" >&2; exit 2; }
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 2; }
mkdir -p "$STATE_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Another deployment is running" >&2; exit 1; }

compose=(docker compose --project-directory "$DEPLOY_DIR" --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
export API_IMAGE WEB_IMAGE
printf 'API_IMAGE=%s\nWEB_IMAGE=%s\n' "$API_IMAGE" "$WEB_IMAGE" >"$STATE_DIR/candidate"
"${compose[@]}" pull redis api worker-pdf worker-office cleanup web
"${compose[@]}" up -d redis
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --remove-orphans api worker-pdf worker-office cleanup web

for _ in {1..30}; do
  if curl --fail --silent --show-error "http://127.0.0.1:${API_PORT:-8000}/health/ready" >/dev/null \
    && curl --fail --silent --show-error "http://127.0.0.1:${WEB_PORT:-3000}/health" >/dev/null; then
    if [[ -f "$STATE_DIR/current" ]]; then cp "$STATE_DIR/current" "$STATE_DIR/previous"; fi
    mv "$STATE_DIR/candidate" "$STATE_DIR/current"
    echo "Deployment healthy: $API_IMAGE $WEB_IMAGE"
    exit 0
  fi
  sleep 5
done

rm -f "$STATE_DIR/candidate"
echo "Deployment failed health checks; run rollback.sh explicitly" >&2
"${compose[@]}" ps >&2
exit 1
