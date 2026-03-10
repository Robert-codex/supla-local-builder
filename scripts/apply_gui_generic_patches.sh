#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUBMODULE_DIR="${ROOT_DIR}/external/GUI-Generic"
PATCH_FILE="${ROOT_DIR}/patches/gui-generic/0001-local-mqtt-zigbee-builder.patch"

if [[ ! -d "${SUBMODULE_DIR}/.git" && ! -f "${SUBMODULE_DIR}/.git" ]]; then
  echo "Brak zainicjalizowanego submodule ${SUBMODULE_DIR}" >&2
  echo "Uruchom: git submodule update --init --recursive" >&2
  exit 1
fi

if [[ ! -f "${PATCH_FILE}" ]]; then
  echo "Brak pliku patcha: ${PATCH_FILE}" >&2
  exit 1
fi

git -C "${SUBMODULE_DIR}" apply --check "${PATCH_FILE}"
git -C "${SUBMODULE_DIR}" apply "${PATCH_FILE}"

echo "Applied GUI-Generic local patch set."
