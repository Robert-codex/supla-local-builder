#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_PACKAGES_DIR="${ROOT_DIR}/.local-builder-py"
CORE_DIR="${ROOT_DIR}/local_builder/data/platformio-core"

if [[ ! -d "${SITE_PACKAGES_DIR}" ]]; then
  echo "Brak lokalnej instalacji PlatformIO w ${SITE_PACKAGES_DIR}" >&2
  echo "Uruchom: ${ROOT_DIR}/scripts/install_local_builder.sh" >&2
  exit 1
fi

mkdir -p "${CORE_DIR}"

export PYTHONPATH="${SITE_PACKAGES_DIR}${PYTHONPATH:+:${PYTHONPATH}}"
export PLATFORMIO_CORE_DIR="${CORE_DIR}"
exec python3 -m platformio "$@"
