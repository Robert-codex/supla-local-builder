#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${LOCAL_BUILDER_HOST:-127.0.0.1}"
PORT="${LOCAL_BUILDER_PORT:-8181}"
VENV_PYTHON="${ROOT_DIR}/.venv-local-builder/bin/python"
LOCAL_SITE_PACKAGES="${ROOT_DIR}/.local-builder-py"

if [[ -x "${VENV_PYTHON}" ]]; then
  exec "${VENV_PYTHON}" "$ROOT_DIR/local_builder/server.py" --host "$HOST" --port "$PORT"
fi

if [[ -d "${LOCAL_SITE_PACKAGES}" ]]; then
  export PYTHONPATH="${LOCAL_SITE_PACKAGES}${PYTHONPATH:+:${PYTHONPATH}}"
fi

exec python3 "$ROOT_DIR/local_builder/server.py" --host "$HOST" --port "$PORT"
