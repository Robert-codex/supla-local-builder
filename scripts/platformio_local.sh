#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_PACKAGES_DIR="${ROOT_DIR}/.local-builder-py"
DEFAULT_CORE_DIR="${ROOT_DIR}/local_builder/data/platformio-core"
CORE_DIR="${PLATFORMIO_CORE_DIR:-${DEFAULT_CORE_DIR}}"
VENV_PYTHON="${ROOT_DIR}/.venv-local-builder/bin/python"
PYTHON_BIN="${PYTHON_BIN:-python3}"

core_dir_usable() {
  local dir="$1"
  if [[ ! -d "${dir}" ]]; then
    return 1
  fi
  if [[ ! -r "${dir}" || ! -w "${dir}" || ! -x "${dir}" ]]; then
    return 1
  fi
  if [[ -n "$(find "${dir}" -mindepth 1 -maxdepth 3 \( ! -readable -o ! -executable \) -print -quit 2>/dev/null)" ]]; then
    return 1
  fi
  return 0
}

if [[ ! -d "${SITE_PACKAGES_DIR}" ]]; then
  echo "Brak lokalnej instalacji PlatformIO w ${SITE_PACKAGES_DIR}" >&2
  echo "Uruchom: ${ROOT_DIR}/scripts/install_local_builder.sh" >&2
  exit 1
fi

if [[ -x "${VENV_PYTHON}" ]]; then
  PYTHON_BIN="${VENV_PYTHON}"
fi

if ! core_dir_usable "${CORE_DIR}"; then
  CORE_DIR="${ROOT_DIR}/local_builder/data/platformio-core-${USER:-local}"
fi

mkdir -p "${CORE_DIR}"

export PYTHONPATH="${SITE_PACKAGES_DIR}${PYTHONPATH:+:${PYTHONPATH}}"
export PLATFORMIO_CORE_DIR="${CORE_DIR}"
export PIP_BREAK_SYSTEM_PACKAGES="${PIP_BREAK_SYSTEM_PACKAGES:-1}"

exec "${PYTHON_BIN}" -m platformio "$@"
