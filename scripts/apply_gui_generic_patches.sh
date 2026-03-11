#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUBMODULE_DIR="${ROOT_DIR}/external/GUI-Generic"
PATCH_FILE="${ROOT_DIR}/patches/gui-generic/0001-local-mqtt-zigbee-builder.patch"

patch_markers_present() {
  [[ -f "${SUBMODULE_DIR}/src/src/zigbee/SuplaZigbeeGateway.h" ]] &&
  grep -q "SUPLA_CSE7761" "${SUBMODULE_DIR}/builder.json" &&
  grep -q "FUNCTION_CSE7761_RX" "${SUBMODULE_DIR}/src/SuplaConfigManager.h"
}

if [[ ! -d "${SUBMODULE_DIR}/.git" && ! -f "${SUBMODULE_DIR}/.git" ]]; then
  echo "Brak zainicjalizowanego submodule ${SUBMODULE_DIR}" >&2
  echo "Uruchom: git submodule update --init --recursive" >&2
  exit 1
fi

if [[ ! -f "${PATCH_FILE}" ]]; then
  echo "Brak pliku patcha: ${PATCH_FILE}" >&2
  exit 1
fi

if git -C "${SUBMODULE_DIR}" apply --reverse --check "${PATCH_FILE}" >/dev/null 2>&1; then
  echo "GUI-Generic local patch set is already present."
  exit 0
fi

if patch_markers_present; then
  echo "GUI-Generic local patch markers are already present."
  exit 0
fi

if git -C "${SUBMODULE_DIR}" apply --check "${PATCH_FILE}" >/dev/null 2>&1; then
  git -C "${SUBMODULE_DIR}" apply "${PATCH_FILE}"
  echo "Applied GUI-Generic local patch set."
  exit 0
fi

echo "Nie można nałożyć patcha na aktualny stan submodule ${SUBMODULE_DIR}." >&2
echo "Jeżeli submodule śledzi już commit z gałęzi local-builder-patches, nie trzeba robić nic więcej." >&2
echo "W przeciwnym razie sprawdź stan gałęzi w ${SUBMODULE_DIR} i dopiero potem spróbuj ponownie." >&2
exit 1
