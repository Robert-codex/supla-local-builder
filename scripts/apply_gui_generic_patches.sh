#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUBMODULE_DIR="${ROOT_DIR}/external/GUI-Generic"
PATCH_DIR="${ROOT_DIR}/patches/gui-generic"

patch_markers_present() {
  local patch_name
  patch_name="$(basename "$1")"

  case "${patch_name}" in
    0001-local-mqtt-zigbee-builder.patch)
      [[ -f "${SUBMODULE_DIR}/src/src/zigbee/SuplaZigbeeGateway.h" ]] &&
      grep -q "SUPLA_CSE7761" "${SUBMODULE_DIR}/builder.json" &&
      grep -q "FUNCTION_CSE7761_RX" "${SUBMODULE_DIR}/src/SuplaConfigManager.h"
      ;;
    0002-esp8266-serial-fallback.patch)
      python3 - "${SUBMODULE_DIR}/src/SuplaConfigESP.cpp" <<'PY'
from pathlib import Path
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")
snippet = """  if (rxPin == 2 && txPin == -1) {
    return Serial1;
  }

  return Serial;
#else
  return Serial0;
#endif
"""
raise SystemExit(0 if snippet in text else 1)
PY
      ;;
    0003-cse7759-alias-label.patch)
      grep -q '#ifdef SUPLA_CSE7759' "${SUBMODULE_DIR}/src/src/language/common.h" &&
      grep -q 'String(S_HLW8012) + " Multipliers"' "${SUBMODULE_DIR}/src/SuplaWebPageOther.cpp"
      ;;
    0004-cse7759b-dedicated-driver.patch)
      grep -q 'new HardwareSerial(CSE7766_UART_PORT)' "${SUBMODULE_DIR}/lib/CSE7766/CSE7766.cpp" &&
      grep -q 'class CSE7759B' "${SUBMODULE_DIR}/lib/CSE7759B/CSE7759B.h" &&
      grep -q 'class CSE_7759B' "${SUBMODULE_DIR}/lib/SuplaDeviceExtensions/src/supla/sensor/CSE_7759B.h" &&
      grep -q 'void addCSE7759B' "${SUBMODULE_DIR}/src/SuplaDeviceGUI.h" &&
      grep -q 'class CSE_7759B_FG' "${SUBMODULE_DIR}/src/src/sensor/CSE_7759B_FG.h" &&
      grep -q 'KEY_NETWORK_IP_MODE' "${SUBMODULE_DIR}/src/SuplaConfigManager.h"
      ;;
    *)
      return 1
      ;;
  esac
}

if [[ ! -d "${SUBMODULE_DIR}/.git" && ! -f "${SUBMODULE_DIR}/.git" ]]; then
  echo "Brak zainicjalizowanego submodule ${SUBMODULE_DIR}" >&2
  echo "Uruchom: git submodule update --init --recursive" >&2
  exit 1
fi

if [[ ! -d "${PATCH_DIR}" ]]; then
  echo "Brak katalogu z patchami: ${PATCH_DIR}" >&2
  exit 1
fi

shopt -s nullglob
PATCH_FILES=("${PATCH_DIR}"/*.patch)
shopt -u nullglob

if [[ ${#PATCH_FILES[@]} -eq 0 ]]; then
  echo "Brak plików patcha w katalogu: ${PATCH_DIR}" >&2
  exit 1
fi

for patch_file in "${PATCH_FILES[@]}"; do
  patch_name="$(basename "${patch_file}")"

  if patch_markers_present "${patch_file}"; then
    echo "${patch_name} is already present."
    continue
  fi

  if git -C "${SUBMODULE_DIR}" apply --reverse --check "${patch_file}" >/dev/null 2>&1; then
    echo "${patch_name} is already present."
    continue
  fi

  if git -C "${SUBMODULE_DIR}" apply --check "${patch_file}" >/dev/null 2>&1; then
    git -C "${SUBMODULE_DIR}" apply "${patch_file}"
    echo "Applied ${patch_name}."
    continue
  fi

  echo "Nie można nałożyć patcha ${patch_name} na aktualny stan submodule ${SUBMODULE_DIR}." >&2
  echo "Sprawdź stan gałęzi w ${SUBMODULE_DIR} i zgodność patcha z aktualnym upstream." >&2
  exit 1
done

echo "GUI-Generic local patch set is up to date."
