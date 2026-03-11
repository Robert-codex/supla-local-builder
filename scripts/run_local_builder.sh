#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${LOCAL_BUILDER_HOST:-127.0.0.1}"
PORT="${LOCAL_BUILDER_PORT:-8181}"
PUBLIC_URL="${LOCAL_BUILDER_PUBLIC_URL:-}"
TLS_CERT="${LOCAL_BUILDER_TLS_CERT:-}"
TLS_KEY="${LOCAL_BUILDER_TLS_KEY:-}"
HTTP_REDIRECT_PORT="${LOCAL_BUILDER_HTTP_REDIRECT_PORT:-0}"
VENV_PYTHON="${ROOT_DIR}/.venv-local-builder/bin/python"
LOCAL_SITE_PACKAGES="${ROOT_DIR}/.local-builder-py"

if [[ -x "${VENV_PYTHON}" ]]; then
  exec "${VENV_PYTHON}" \
    "$ROOT_DIR/local_builder/server.py" \
    --host "$HOST" \
    --port "$PORT" \
    --public-url "$PUBLIC_URL" \
    --tls-cert "$TLS_CERT" \
    --tls-key "$TLS_KEY" \
    --http-redirect-port "$HTTP_REDIRECT_PORT"
fi

if [[ -d "${LOCAL_SITE_PACKAGES}" ]]; then
  export PYTHONPATH="${LOCAL_SITE_PACKAGES}${PYTHONPATH:+:${PYTHONPATH}}"
fi

exec python3 \
  "$ROOT_DIR/local_builder/server.py" \
  --host "$HOST" \
  --port "$PORT" \
  --public-url "$PUBLIC_URL" \
  --tls-cert "$TLS_CERT" \
  --tls-key "$TLS_KEY" \
  --http-redirect-port "$HTTP_REDIRECT_PORT"
