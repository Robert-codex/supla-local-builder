#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
SITE_PACKAGES_DIR="${ROOT_DIR}/.local-builder-py"
BOOTSTRAP_DIR="${ROOT_DIR}/local_builder/data/bootstrap"
CORE_DIR="${ROOT_DIR}/local_builder/data/platformio-core"
GET_PIP="${BOOTSTRAP_DIR}/get-pip.py"

mkdir -p "${BOOTSTRAP_DIR}"
mkdir -p "${CORE_DIR}"

if ! "${PYTHON_BIN}" -m pip --version >/dev/null 2>&1; then
  curl -fsSL https://bootstrap.pypa.io/get-pip.py -o "${GET_PIP}"
  "${PYTHON_BIN}" "${GET_PIP}" --user --break-system-packages
fi

"${PYTHON_BIN}" -m pip install --upgrade --break-system-packages --target "${SITE_PACKAGES_DIR}" pip
"${PYTHON_BIN}" -m pip install --upgrade --break-system-packages --target "${SITE_PACKAGES_DIR}" platformio

echo "PlatformIO installed in ${SITE_PACKAGES_DIR}"
echo "Run builder with: ${ROOT_DIR}/scripts/run_local_builder.sh"
