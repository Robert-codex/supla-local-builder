const state = {
  config: null,
  selected: new Set(),
  currentBuildHash: "",
  lastBuildPayload: null,
  pollTimer: null,
  envFamilies: [],
  preferredDownloadUrl: "",
  webInstallButton: null,
  installManifestUrl: "",
  serialPorts: [],
  serialPortSource: "",
  serialRequestPending: false,
};

const DUAL_R3_PM_TEMPLATE_NAME = "Sonoff Dual R3 Power Monitoring";
const DUAL_R3_V2_PM_TEMPLATE_NAME = "Sonoff Dual R3 v2 Power Monitoring";
const POW_R2_TEMPLATE_NAME = "Sonoff Pow R2 Power Monitoring";
const POW_R2_HLW_TEMPLATE_NAME = "Sonoff Pow R2 /SEL Power Monitoring (CSE7759 manual)";
const POW_CSE7759_TEMPLATE_NAME = "Sonoff POW / POWR1 Power Monitoring (CSE7759)";
const POWR316_TEMPLATE_NAME = "Sonoff POW Origin 16A Power Monitoring Switch Module (POWR316)";
const XIAO_ESP32C6_TEMPLATE_NAME = "Seeed Studio XIAO ESP32C6";
const XIAO_ESP32C6_ENVS = {
  wifi: "GUI_Generic_ESP32C6_XIAO_nolibs",
  zigbee: "GUI_Generic_ESP32C6_XIAO_Zigbee_gateway",
};
const GENERIC_ESP32C6_ENVS = {
  wifi: "GUI_Generic_ESP32C6_nolibs",
  zigbee: "GUI_Generic_ESP32C6_Zigbee_gateway",
};
const DUAL_R3_PM_BASE_GPIO = [
  32, 0, 0, 0, 0, 0, 0, 0, 0, 576, 225, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 224,
  0, 0, 0, 0, 160, 161, 0, 0, 0, 0, 0, 0,
];
const POW_R2_BASE_GPIO = [17, 0, 0, 0, 0, 0, 0, 0, 21, 56, 0, 0, 0];
const TEMPLATE_CODES = {
  cse7766Rx: 3104,
  cse7761Tx: 7296,
  cse7761Rx: 7328,
  cf: 2688,
  cfOld: 133,
  cf1Old: 132,
  selOld: 131,
};
const HARDWARE_REQUIRED_OPTIONS = ["SUPLA_RELAY", "SUPLA_BUTTON"];
const HARDWARE_METER_OPTIONS = ["SUPLA_HLW8012", "SUPLA_CSE7759", "SUPLA_CSE7761", "SUPLA_CSE7766", "SUPLA_CSE7759B", "SUPLA_BL0930", "SUPLA_BL0939"];
const HARDWARE_PRESETS = {
  sonoff_dual_r3_pm: {
    profile: "dualr3",
    templateName: DUAL_R3_PM_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    chip: "none",
    pins: {},
    label: "Sonoff Dual R3 Power Monitoring",
    customTemplate: true,
  },
  sonoff_dual_r3_pm_bl0930: {
    profile: "dualr3",
    templateName: DUAL_R3_PM_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    chip: "bl0930",
    pins: {},
    label: "Sonoff Dual R3 + BL0930",
    customTemplate: true,
  },
  sonoff_dual_r3_pm_cse7761: {
    profile: "dualr3",
    templateName: DUAL_R3_PM_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    chip: "cse7761",
    pins: { tx: 25, rx: 26 },
    label: "Sonoff Dual R3 + CSE7761",
    customTemplate: true,
  },
  sonoff_dual_r3_pm_cse7766: {
    profile: "dualr3",
    templateName: DUAL_R3_PM_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    chip: "cse7766",
    pins: { rx: 26 },
    label: "Sonoff Dual R3 + CSE7766",
    customTemplate: true,
  },
  sonoff_pow_r2_meter: {
    profile: "pow_uart",
    templateName: POW_R2_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    chip: "none",
    pins: {},
    label: "Sonoff Pow R2 Power Monitoring",
  },
  sonoff_pow_r2_cse7766: {
    profile: "pow_uart",
    templateName: POW_R2_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    chip: "cse7766",
    pins: {},
    label: "Sonoff Pow R2 + CSE7766",
  },
  sonoff_pow_r2_cse7759b: {
    profile: "pow_uart",
    templateName: POW_R2_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    chip: "cse7759b",
    pins: {},
    label: "Sonoff Pow R2 + CSE7759B-S",
  },
  sonoff_pow_r2_cse7759_manual: {
    profile: "pow_hlw_manual",
    templateName: POW_R2_HLW_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    chip: "cse7759",
    pins: { sel: 5, cf1: 13, cf: 14 },
    label: "Sonoff Pow R2 /SEL + CSE7759 (manual)",
    customTemplate: true,
  },
  sonoff_pow_r2_cse7759_verified_1739die: {
    profile: "pow_hlw_manual",
    templateName: POW_R2_HLW_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    chip: "cse7759",
    pins: { sel: 5, cf1: 13, cf: 14 },
    label: "Sonoff Pow R2 + CSE7759 (verified PCB 1739DIE)",
    customTemplate: true,
    verifiedBoard: "CSE7759 1739DIE",
  },
  sonoff_pow_cse7759: {
    profile: "pow_hlw_fixed",
    templateName: POW_CSE7759_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    chip: "cse7759",
    pins: { sel: 5, cf1: 13, cf: 14 },
    label: "Sonoff POW / POWR1 + CSE7759",
  },
  sonoff_powr316_meter: {
    profile: "pow_uart",
    templateName: POWR316_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    chip: "none",
    pins: {},
    label: "Sonoff POWR316",
  },
  sonoff_powr316_cse7766: {
    profile: "pow_uart",
    templateName: POWR316_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    chip: "cse7766",
    pins: {},
    label: "Sonoff POWR316 + CSE7766",
  },
  sonoff_powr316_cse7759b: {
    profile: "pow_uart",
    templateName: POWR316_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    chip: "cse7759b",
    pins: {},
    label: "Sonoff POWR316 + CSE7759B-S",
  },
};
const FEATURED_DEVICE_PRESETS = [
  {
    id: "dualr3-pm",
    name: "Sonoff Dual R3 Power Monitoring",
    description: "Bazowy preset DUALR3 z ręcznym doborem układu pomiarowego i pinów.",
    templateName: DUAL_R3_PM_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    hardwarePreset: "sonoff_dual_r3_pm",
    chips: ["ESP32", "DUALR3", "Power Monitoring"],
  },
  {
    id: "dualr3-cse7761",
    name: "Sonoff Dual R3 + CSE7761",
    description: "Gotowy preset DUALR3 pod wariant z CSE7761.",
    templateName: DUAL_R3_PM_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    hardwarePreset: "sonoff_dual_r3_pm_cse7761",
    chips: ["ESP32", "CSE7761"],
  },
  {
    id: "dualr3-cse7766",
    name: "Sonoff Dual R3 + CSE7766",
    description: "Gotowy preset DUALR3 pod wariant z CSE7766.",
    templateName: DUAL_R3_PM_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    hardwarePreset: "sonoff_dual_r3_pm_cse7766",
    chips: ["ESP32", "CSE7766"],
  },
  {
    id: "dualr3-bl0930",
    name: "Sonoff Dual R3 + BL0930",
    description: "Gotowy preset DUALR3 pod wariant z BL0930.",
    templateName: DUAL_R3_PM_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    hardwarePreset: "sonoff_dual_r3_pm_bl0930",
    chips: ["ESP32", "BL0930"],
  },
  {
    id: "powr2-meter",
    name: "Sonoff Pow R2 Power Monitoring",
    description: "Preset Pow R2 z wyborem UART-owego układu pomiarowego w czasie buildu.",
    templateName: POW_R2_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    hardwarePreset: "sonoff_pow_r2_meter",
    chips: ["ESP8266", "Pow R2", "Power Monitoring"],
  },
  {
    id: "powr2-cse7766",
    name: "Sonoff Pow R2 + CSE7766",
    description: "Gotowy preset Pow R2 dla wariantu z CSE7766.",
    templateName: POW_R2_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    hardwarePreset: "sonoff_pow_r2_cse7766",
    chips: ["ESP8266", "CSE7766"],
  },
  {
    id: "powr2-cse7759b",
    name: "Sonoff Pow R2 + CSE7759B-S",
    description: "Preset Pow R2 dla wariantu UART CSE7759B-S obsługiwanego ścieżką zgodną z CSE7766.",
    templateName: POW_R2_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    hardwarePreset: "sonoff_pow_r2_cse7759b",
    chips: ["ESP8266", "CSE7759B-S"],
  },
  {
    id: "powr2-cse7759-manual",
    name: "Sonoff Pow R2 /SEL + CSE7759 (manual)",
    description: "Ogólny preset manualny Pow R2 dla wariantu impulsowego CSE7759. Pozwala ręcznie wpisać mapę CF/CF1/SEL dla innych rewizji PCB.",
    templateName: POW_R2_HLW_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    hardwarePreset: "sonoff_pow_r2_cse7759_manual",
    chips: ["ESP8266", "CSE7759", "manual"],
  },
  {
    id: "powr2-cse7759-verified-1739die",
    name: "Sonoff Pow R2 + CSE7759 (verified PCB 1739DIE)",
    description: "Zweryfikowany preset dla PCB Pow R2 z układem CSE7759 1739DIE. Używa mapy SEL=GPIO5, CF1=GPIO13, CF=GPIO14; CF1 współdzieli GPIO13 z obwodem stockowego LED.",
    templateName: POW_R2_HLW_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    hardwarePreset: "sonoff_pow_r2_cse7759_verified_1739die",
    chips: ["ESP8266", "CSE7759", "verified", "1739DIE"],
  },
  {
    id: "pow-cse7759",
    name: "Sonoff POW / POWR1 + CSE7759",
    description: "Preset dla impulsowego wariantu CSE7759/HLW8012 z mapą SEL=GPIO5, CF1=GPIO13, CF=GPIO14 i kalibracją w GUI urządzenia.",
    templateName: POW_CSE7759_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    hardwarePreset: "sonoff_pow_cse7759",
    chips: ["ESP8266", "CSE7759", "HLW8012", "POWR1"],
  },
  {
    id: "powr316-meter",
    name: "Sonoff POWR316",
    description: "Preset POWR316 z wyborem UART-owego układu pomiarowego w czasie buildu.",
    templateName: POWR316_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    hardwarePreset: "sonoff_powr316_meter",
    chips: ["ESP32", "POWR316", "Power Monitoring"],
  },
  {
    id: "powr316-cse7766",
    name: "Sonoff POWR316 + CSE7766",
    description: "Gotowy preset POWR316 dla wariantu z CSE7766.",
    templateName: POWR316_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    hardwarePreset: "sonoff_powr316_cse7766",
    chips: ["ESP32", "CSE7766"],
  },
  {
    id: "powr316-cse7759b",
    name: "Sonoff POWR316 + CSE7759B-S",
    description: "Preset POWR316 dla wariantu UART CSE7759B-S obsługiwanego ścieżką zgodną z CSE7766.",
    templateName: POWR316_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    hardwarePreset: "sonoff_powr316_cse7759b",
    chips: ["ESP32", "CSE7759B-S"],
  },
  {
    id: "dualr3-v2-bl0939-layout",
    name: "Sonoff Dual R3 v2 Power Monitoring",
    description: "Gotowy preset dla rewizji v2 z mapą GPIO i sterownikiem UART BL0939.",
    templateName: DUAL_R3_V2_PM_TEMPLATE_NAME,
    processor: "esp32",
    env: "GUI_Generic_ESP32",
    hardwarePreset: "",
    selectedOptions: ["SUPLA_RELAY", "SUPLA_BUTTON", "SUPLA_BL0939"],
    chips: ["ESP32", "BL0939", "Dual R3 v2"],
  },
  {
    id: "zigbee-gateway",
    name: "ESP32-C6 Zigbee Gateway",
    description: "Preset dla bramki Zigbee na ESP32-C6 z profilem gateway dodanym w projekcie.",
    templateName: "",
    processor: "esp32c6",
    env: "GUI_Generic_ESP32C6_Zigbee_gateway",
    hardwarePreset: "",
    selectedOptions: [],
    chips: ["ESP32-C6", "Zigbee"],
  },
  {
    id: "xiao-esp32c6",
    name: "Seeed Studio XIAO ESP32C6",
    description: "Preset XIAO ESP32C6 z lokalnym mapowaniem GPIO. Protokół WiFi albo Zigbee przełączysz osobno w formularzu builda.",
    templateName: XIAO_ESP32C6_TEMPLATE_NAME,
    processor: "esp32c6",
    env: XIAO_ESP32C6_ENVS.wifi,
    hardwarePreset: "",
    selectedOptions: ["SUPLA_LED"],
    xiaoProtocol: "wifi",
    chips: ["ESP32-C6", "XIAO", "Seeed"],
  },
  {
    id: "shelly-1",
    name: "Shelly 1",
    description: "Popularny switch na ESP8266/ESP8285 ze wsparciem dwóch przekaźników.",
    templateName: "Shelly 1",
    processor: "esp82xx",
    env: "GUI_Generic_1MB",
    hardwarePreset: "",
    selectedOptions: ["SUPLA_RELAY", "SUPLA_BUTTON", "SUPLA_LED"],
    chips: ["Shelly", "ESP8266"],
  },
  {
    id: "sonoff-basic",
    name: "Sonoff Basic R3",
    description: "Podstawowy dwustanowy przekaźnik Sonoff Basic.",
    templateName: "Sonoff Basic R3",
    processor: "esp82xx",
    env: "GUI_Generic_1MB",
    hardwarePreset: "",
    selectedOptions: ["SUPLA_RELAY", "SUPLA_BUTTON"],
    chips: ["Sonoff", "ESP8266"],
  },
  {
    id: "sonoff-pow",
    name: "Sonoff Pow R2",
    description: "Szybki preset Pow R2 z domyślną ścieżką CSE7766.",
    templateName: POW_R2_TEMPLATE_NAME,
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    hardwarePreset: "sonoff_pow_r2_cse7766",
    chips: ["Sonoff", "CSE7766"],
  },
];

function usingCustomTemplateJson() {
  return Boolean(els.templateJson?.value.trim());
}

const els = {
  catalogVersion: document.getElementById("catalogVersion"),
  publicUrl: document.getElementById("publicUrl"),
  processorSelect: document.getElementById("processorSelect"),
  envSelect: document.getElementById("envSelect"),
  languageSelect: document.getElementById("languageSelect"),
  buildVersion: document.getElementById("buildVersion"),
  customName: document.getElementById("customName"),
  templateFilter: document.getElementById("templateFilter"),
  templateSelect: document.getElementById("templateSelect"),
  hardwarePreset: document.getElementById("hardwarePreset"),
  meterChip: document.getElementById("meterChip"),
  meterRxPin: document.getElementById("meterRxPin"),
  meterTxPin: document.getElementById("meterTxPin"),
  meterCfPin: document.getElementById("meterCfPin"),
  meterCf1Pin: document.getElementById("meterCf1Pin"),
  meterSelPin: document.getElementById("meterSelPin"),
  hardwarePresetPanel: document.getElementById("hardwarePresetPanel"),
  hardwarePresetNote: document.getElementById("hardwarePresetNote"),
  xiaoProtocolPanel: document.getElementById("xiaoProtocolPanel"),
  xiaoProtocolNote: document.getElementById("xiaoProtocolNote"),
  templateJson: document.getElementById("templateJson"),
  searchInput: document.getElementById("searchInput"),
  selectionSummary: document.getElementById("selectionSummary"),
  optionsRoot: document.getElementById("optionsRoot"),
  buildButton: document.getElementById("buildButton"),
  buildStatus: document.getElementById("buildStatus"),
  artifactLinks: document.getElementById("artifactLinks"),
  buildLog: document.getElementById("buildLog"),
  installBadge: document.getElementById("installBadge"),
  installSummary: document.getElementById("installSummary"),
  otaUrl: document.getElementById("otaUrl"),
  copyOtaButton: document.getElementById("copyOtaButton"),
  openOtaButton: document.getElementById("openOtaButton"),
  downloadFirmwareButton: document.getElementById("downloadFirmwareButton"),
  detectProgrammerButton: document.getElementById("detectProgrammerButton"),
  programmerStatus: document.getElementById("programmerStatus"),
  programmerDetails: document.getElementById("programmerDetails"),
  webInstallWrap: document.getElementById("webInstallWrap"),
  webInstallHint: document.getElementById("webInstallHint"),
  installArtifacts: document.getElementById("installArtifacts"),
  buildHistory: document.getElementById("buildHistory"),
  featuredDevices: document.getElementById("featuredDevices"),
  deviceGroups: document.getElementById("deviceGroups"),
  deviceSearch: document.getElementById("deviceSearch"),
  refreshBuilds: document.getElementById("refreshBuilds"),
  resetDefaults: document.getElementById("resetDefaults"),
  optionTemplate: document.getElementById("optionTemplate"),
};
const xiaoProtocolInputs = [...document.querySelectorAll('input[name="xiaoProtocol"]')];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function optionLabel(option) {
  const lang = els.languageSelect.value || "pl";
  if (lang !== "pl" && option[lang] && option[lang].name) {
    return option[lang].name;
  }
  return option.name || option.id;
}

function optionDescription(option) {
  const lang = els.languageSelect.value || "pl";
  if (lang !== "pl" && option[lang] && option[lang].desc) {
    return option[lang].desc;
  }
  return option.desc || "";
}

function sectionLabel(sectionKey) {
  const labels = state.config.section_labels[sectionKey] || {};
  return labels[els.languageSelect.value] || labels.pl || sectionKey;
}

function getOption(optionId) {
  return state.config.options[optionId];
}

function detectEnvFamily(env) {
  if (env.includes("ESP32C6")) {
    return "esp32c6";
  }
  if (env.includes("ESP32C3")) {
    return "esp32c3";
  }
  if (env.includes("ESP32")) {
    return "esp32";
  }
  return "esp82xx";
}

function envFamilyLabel(family) {
  switch (family) {
    case "esp32":
      return "ESP32";
    case "esp32c3":
      return "ESP32-C3";
    case "esp32c6":
      return "ESP32-C6";
    default:
      return "ESP8266 / ESP8285";
  }
}

function isXiaoTemplateSelected() {
  return els.templateSelect.value === XIAO_ESP32C6_TEMPLATE_NAME;
}

function isXiaoEnv(env) {
  return Object.values(XIAO_ESP32C6_ENVS).includes(env);
}

function xiaoProtocolForEnv(env) {
  const value = String(env || "");
  if (value === XIAO_ESP32C6_ENVS.zigbee || value === GENERIC_ESP32C6_ENVS.zigbee || value.includes("Zigbee")) {
    return "zigbee";
  }
  if (value === XIAO_ESP32C6_ENVS.wifi || value === GENERIC_ESP32C6_ENVS.wifi) {
    return "wifi";
  }
  return "";
}

function xiaoEnvForProtocol(protocol) {
  return protocol === "zigbee" ? XIAO_ESP32C6_ENVS.zigbee : XIAO_ESP32C6_ENVS.wifi;
}

function xiaoProtocolLabel(protocol) {
  return protocol === "zigbee" ? "Zigbee gateway" : "WiFi / standard";
}

function selectedXiaoProtocol() {
  const active = xiaoProtocolInputs.find((input) => input.checked);
  return active?.value || "wifi";
}

function setXiaoProtocol(protocol) {
  xiaoProtocolInputs.forEach((input) => {
    input.checked = input.value === protocol;
  });
}

function availableEnvsForFamily(family) {
  const envs = state.config.envs.filter((env) => detectEnvFamily(env) === family);
  if (family === "esp32c6" && isXiaoTemplateSelected()) {
    const xiaoEnvs = envs.filter((env) => isXiaoEnv(env));
    if (xiaoEnvs.length) {
      return xiaoEnvs;
    }
  }
  return envs;
}

function genericEsp32C6EnvForProtocol(protocol) {
  const preferred = protocol === "zigbee" ? GENERIC_ESP32C6_ENVS.zigbee : GENERIC_ESP32C6_ENVS.wifi;
  if (state.config.envs.includes(preferred)) {
    return preferred;
  }
  return state.config.envs.find((env) => detectEnvFamily(env) === "esp32c6") || "";
}

function buildEnvFamilies() {
  const seen = new Set();
  state.envFamilies = state.config.envs
    .map((env) => detectEnvFamily(env))
    .filter((family) => {
      if (seen.has(family)) {
        return false;
      }
      seen.add(family);
      return true;
    });
}

function renderProcessorSelect() {
  els.processorSelect.innerHTML = state.envFamilies
    .map((family) => `<option value="${escapeHtml(family)}">${escapeHtml(envFamilyLabel(family))}</option>`)
    .join("");
}

function renderEnvSelect(preferredEnv = "") {
  const family = els.processorSelect.value || state.envFamilies[0];
  const envs = availableEnvsForFamily(family);
  els.envSelect.innerHTML = envs
    .map((env) => `<option value="${escapeHtml(env)}">${escapeHtml(env)}</option>`)
    .join("");

  if (preferredEnv && envs.includes(preferredEnv)) {
    els.envSelect.value = preferredEnv;
  } else if (envs.length) {
    els.envSelect.value = envs[0];
  }
}

function renderTemplateSelect(preferredTemplate = "") {
  const search = els.templateFilter.value.trim().toLowerCase();
  const templates = state.config.templates.filter((template) => (
    !search || template.NAME.toLowerCase().includes(search)
  ));

  els.templateSelect.innerHTML = ['<option value="">brak</option>']
    .concat(templates.map((template) => (
      `<option value="${escapeHtml(template.NAME)}">${escapeHtml(template.NAME)}</option>`
    )))
    .join("");

  if (preferredTemplate && templates.some((template) => template.NAME === preferredTemplate)) {
    els.templateSelect.value = preferredTemplate;
  }
}

function templateVendor(name) {
  if (!name) {
    return "Inne";
  }
  const [first] = name.split(" ");
  if (!first) {
    return "Inne";
  }
  if (/^\d/.test(first)) {
    return "Własne / moduły";
  }
  return first;
}

function templateFamily(template) {
  const name = String(template.NAME || "").toUpperCase();
  if (name.includes("ESP32-C6") || name.includes("ESP32C6")) {
    return "esp32c6";
  }
  if (name.includes("ESP32-C3") || name.includes("ESP32C3")) {
    return "esp32c3";
  }
  const gpioCount = Array.isArray(template.GPIO) ? template.GPIO.length : 0;
  return gpioCount >= 20 ? "esp32" : "esp82xx";
}

function syncXiaoProtocolContext(preferredProtocol = "") {
  if (isXiaoTemplateSelected()) {
    els.processorSelect.value = "esp32c6";
    const protocol = preferredProtocol || xiaoProtocolForEnv(els.envSelect.value) || selectedXiaoProtocol();
    renderEnvSelect(xiaoEnvForProtocol(protocol));
    setXiaoProtocol(protocol);
    return;
  }

  if (els.processorSelect.value === "esp32c6" && isXiaoEnv(els.envSelect.value)) {
    const protocol = xiaoProtocolForEnv(els.envSelect.value) || selectedXiaoProtocol();
    renderEnvSelect(genericEsp32C6EnvForProtocol(protocol));
  }
}

function updateXiaoProtocolVisibility() {
  const visible = isXiaoTemplateSelected();
  els.xiaoProtocolPanel.hidden = !visible;

  if (!visible) {
    return;
  }

  const protocol = xiaoProtocolForEnv(els.envSelect.value) || selectedXiaoProtocol();
  setXiaoProtocol(protocol);
  if (protocol === "zigbee") {
    els.xiaoProtocolNote.textContent = "Tryb Zigbee ustawia dedykowany env XIAO z partycjami custom_zigbee_zczr i bibliotekami stosu Zigbee dla ESP32-C6.";
  } else {
    els.xiaoProtocolNote.textContent = "Tryb WiFi wybiera lżejszy env nolibs dla XIAO ESP32-C6. To dobry punkt startowy dla klasycznego firmware SUPLA.";
  }
}

function applyDevicePreset(preset) {
  if (preset.processor) {
    els.processorSelect.value = preset.processor;
    renderEnvSelect(preset.env || "");
  }
  if (preset.templateName) {
    renderTemplateSelect(preset.templateName);
    els.templateSelect.value = preset.templateName;
  }
  els.hardwarePreset.value = preset.hardwarePreset || "";
  if (preset.hardwarePreset) {
    applyHardwarePresetDefaults();
  } else {
    resetHardwarePresetInputs();
  }
  if (preset.selectedOptions?.length) {
    const base = state.config.defaults.selected_options || [];
    state.selected = new Set([...base, ...preset.selectedOptions]);
  }
  syncXiaoProtocolContext(preset.xiaoProtocol || "");
  normalizeSelection();
  renderAll();
}

function isPresetAvailable(preset) {
  if (preset.env && !state.config.envs.includes(preset.env)) {
    return false;
  }
  if (preset.templateName && !state.config.templates.some((item) => item.NAME === preset.templateName)) {
    return false;
  }
  if (preset.selectedOptions?.some((optionId) => !state.config.options[optionId])) {
    return false;
  }
  return true;
}

function renderFeaturedDevices() {
  const search = els.deviceSearch.value.trim().toLowerCase();
  const items = FEATURED_DEVICE_PRESETS.filter((preset) => (
    isPresetAvailable(preset) && (
    !search ||
    preset.name.toLowerCase().includes(search) ||
    preset.description.toLowerCase().includes(search) ||
    preset.chips.some((chip) => chip.toLowerCase().includes(search))
  )));

  if (!items.length) {
    els.featuredDevices.innerHTML = "";
    return;
  }

  els.featuredDevices.innerHTML = `
    <section class="featured-block">
      <h3>Presety projektu</h3>
      <div class="featured-grid">
        ${items.map((preset) => `
          <article class="device-card">
            <strong>${escapeHtml(preset.name)}</strong>
            <p>${escapeHtml(preset.description)}</p>
            <div class="device-meta">
              ${preset.chips.map((chip) => `<span class="device-chip">${escapeHtml(chip)}</span>`).join("")}
            </div>
            <button type="button" data-preset-id="${escapeHtml(preset.id)}">Wybierz preset</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;

  els.featuredDevices.querySelectorAll("button[data-preset-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = FEATURED_DEVICE_PRESETS.find((item) => item.id === button.dataset.presetId);
      if (preset) {
        applyDevicePreset(preset);
      }
    });
  });
}

function renderDeviceGroups() {
  const search = els.deviceSearch.value.trim().toLowerCase();
  const groups = new Map();
  for (const template of state.config.templates) {
    const vendor = templateVendor(template.NAME);
    if (!groups.has(vendor)) {
      groups.set(vendor, []);
    }
    groups.get(vendor).push(template);
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "pl"));
  els.deviceGroups.innerHTML = sortedGroups.map(([vendor, templates]) => {
    const filtered = templates.filter((template) => !search || template.NAME.toLowerCase().includes(search));
    if (!filtered.length) {
      return "";
    }
    return `
      <section class="device-group">
        <h3>${escapeHtml(vendor)}</h3>
        <div class="device-grid">
          ${filtered.map((template) => `
            <article class="device-card">
              <strong>${escapeHtml(template.NAME)}</strong>
              <p>Template board z katalogu GUI Generic. Kliknięcie ustawia płytkę i zachowuje resztę konfiguracji firmware.</p>
              <div class="device-meta">
                <span class="device-chip">${escapeHtml(envFamilyLabel(templateFamily(template)))}</span>
              </div>
              <button type="button" data-template-name="${escapeHtml(template.NAME)}">Wybierz urządzenie</button>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }).join("");

  els.deviceGroups.querySelectorAll("button[data-template-name]").forEach((button) => {
    button.addEventListener("click", () => {
      const templateName = button.dataset.templateName || "";
      const template = state.config.templates.find((item) => item.NAME === templateName);
      if (template) {
        els.processorSelect.value = templateFamily(template);
        renderEnvSelect();
      }
      clearHardwarePresetSelection();
      renderTemplateSelect(templateName);
      els.templateSelect.value = templateName;
      syncXiaoProtocolContext();
      normalizeSelection();
      renderAll();
    });
  });
}

function normalizeSelection() {
  let changed = true;
  while (changed) {
    changed = false;

    // `depOn` in builder.json is a reverse dependency:
    // enabling one of the listed options should auto-enable the current option.
    for (const [optionId, option] of Object.entries(state.config.options)) {
      if (state.selected.has(optionId)) {
        continue;
      }
      if ((option.depOn || []).some((depId) => state.selected.has(depId))) {
        state.selected.add(optionId);
        changed = true;
      }
    }

    for (const optionId of [...state.selected]) {
      const option = getOption(optionId);
      if (!option) {
        state.selected.delete(optionId);
        changed = true;
        continue;
      }

      for (const depId of option.depOpt || []) {
        if (!state.selected.has(depId)) {
          state.selected.add(depId);
          changed = true;
        }
      }

      for (const relId of option.depRel || []) {
        if (state.selected.has(relId)) {
          state.selected.delete(relId);
          changed = true;
        }
      }
    }
  }

  applyHardwarePresetSelection();
}

function templateIndexForEsp32Pin(pin) {
  if (!Number.isInteger(pin) || pin < 0 || pin > 39) {
    return null;
  }
  if (pin <= 5) {
    return pin;
  }
  if (pin === 6) {
    return 24;
  }
  if (pin === 7) {
    return 25;
  }
  if (pin === 8) {
    return 26;
  }
  if (pin === 9) {
    return 6;
  }
  if (pin === 10) {
    return 7;
  }
  if (pin === 11) {
    return 27;
  }
  if (pin >= 12 && pin <= 27) {
    return pin - 4;
  }
  if (pin >= 32 && pin <= 39) {
    return pin - 4;
  }
  return null;
}

function templateIndexForEsp8266Pin(pin) {
  if (!Number.isInteger(pin) || pin < 0 || pin > 16) {
    return null;
  }
  if (pin <= 5) {
    return pin;
  }
  if (pin === 9) {
    return 6;
  }
  if (pin === 10) {
    return 7;
  }
  if (pin >= 12 && pin <= 16) {
    return pin - 4;
  }
  return null;
}

function templateIndexForProcessor(processor, pin) {
  if (processor === "esp82xx") {
    return templateIndexForEsp8266Pin(pin);
  }
  return templateIndexForEsp32Pin(pin);
}

function parseOptionalPin(value) {
  if (value === "") {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function setTemplatePin(template, pin, code, processor = "esp32") {
  const index = templateIndexForProcessor(processor, pin);
  if (index === null) {
    return false;
  }
  while (template.GPIO.length <= index) {
    template.GPIO.push(0);
  }
  template.GPIO[index] = code;
  return true;
}

function isHardwarePresetActive() {
  return Object.hasOwn(HARDWARE_PRESETS, els.hardwarePreset.value);
}

function currentHardwarePreset() {
  return HARDWARE_PRESETS[els.hardwarePreset.value] || null;
}

function resetHardwarePresetInputs() {
  els.hardwarePreset.value = "";
  els.meterChip.value = "none";
  els.meterRxPin.value = "";
  els.meterTxPin.value = "";
  els.meterCfPin.value = "";
  els.meterCf1Pin.value = "";
  els.meterSelPin.value = "";
}

function clearHardwarePresetSelection() {
  const hadPreset = Boolean(
    els.hardwarePreset.value ||
    els.meterChip.value !== "none" ||
    els.meterRxPin.value ||
    els.meterTxPin.value ||
    els.meterCfPin.value ||
    els.meterCf1Pin.value ||
    els.meterSelPin.value ||
    HARDWARE_METER_OPTIONS.some((optionId) => state.selected.has(optionId))
  );

  if (!hadPreset) {
    return false;
  }

  resetHardwarePresetInputs();
  for (const optionId of HARDWARE_METER_OPTIONS) {
    state.selected.delete(optionId);
  }
  return true;
}

function hardwarePresetRequirements(preset, chip) {
  if (!preset) {
    return { requiredPins: [], optionId: "", note: "Preset sprzętowy nie jest aktywny." };
  }

  if (preset.profile === "pow_uart") {
    switch (chip) {
      case "cse7766":
        return {
          requiredPins: [],
          optionId: "SUPLA_CSE7766",
          note: "Pow R2 i POWR316 używają tu gotowego template z już wpisanym torem UART. Builder tylko dobiera wariant firmware podczas buildu.",
        };
      case "cse7759b":
        return {
          requiredPins: [],
          optionId: "SUPLA_CSE7759B",
          note: "CSE7759B-S dostaje osobną flagę buildu `SUPLA_CSE7759B`, ale firmware mapuje ją obecnie na istniejącą ścieżkę UART CSE7766. Podstawą jest zgodność 24-bajtowej ramki 4800 bps z datasheetu CSE7759B-S.",
        };
      case "none":
        return {
          requiredPins: [],
          optionId: "",
          note: "Preset ustawia tylko bazowy template płytki. Pomiar energii pozostaje wyłączony.",
        };
      default:
        return {
          requiredPins: [],
          optionId: "",
          note: "Dla tego presetu builder obsługuje tylko warianty UART CSE7766 i CSE7759B-S. Impulsowy CSE7759 wymaga osobnego mapowania CF/CF1/SEL.",
        };
    }
  }

  if (preset.profile === "pow_hlw_manual") {
    switch (chip) {
      case "cse7759":
        if (preset.verifiedBoard) {
          return {
            requiredPins: ["cf", "cf1", "sel"],
            optionId: "SUPLA_CSE7759",
            note: `Zweryfikowany preset dla Pow R2 z impulsowym CSE7759 na PCB ${preset.verifiedBoard}. Builder wygeneruje template z mapą SEL=GPIO5, CF1=GPIO13, CF=GPIO14. CF1 współdzieli GPIO13 z obwodem stockowego LED. Kalibracja napięcia jest dostępna po flashu w Ustawienia urządzenia -> Inne -> Calibration.`,
          };
        }
        return {
          requiredPins: ["cf", "cf1", "sel"],
          optionId: "SUPLA_CSE7759",
          note: "Manualny preset dla Pow R2 z impulsowym CSE7759. Builder wygeneruje własny template z CF/CF1/SEL i pozwala wpisać własną mapę pinów dla innych rewizji PCB. Kalibracja napięcia jest dostępna po flashu w Ustawienia urządzenia -> Inne -> Calibration.",
        };
      case "none":
        if (preset.verifiedBoard) {
          return {
            requiredPins: [],
            optionId: "",
            note: `Preset ustawia bazowy template Pow R2 /SEL dla zweryfikowanego wariantu PCB ${preset.verifiedBoard} bez aktywnego pomiaru energii.`,
          };
        }
        return {
          requiredPins: [],
          optionId: "",
          note: "Preset ustawia bazowy template Pow R2 /SEL dla wariantu CSE7759 bez aktywnego pomiaru energii.",
        };
      default:
        return {
          requiredPins: [],
          optionId: "",
          note: preset.verifiedBoard
            ? `Ten zweryfikowany preset jest przygotowany tylko dla impulsowego CSE7759 na PCB ${preset.verifiedBoard}.`
            : "Ten manualny preset obsługuje tylko impulsowy CSE7759 przez CF/CF1/SEL.",
        };
    }
  }

  if (preset.profile === "pow_hlw_fixed") {
    switch (chip) {
      case "cse7759":
        return {
          requiredPins: [],
          optionId: "SUPLA_CSE7759",
          note: "To preset dla klasycznego Sonoff POW/POWR1 z impulsowym CSE7759. Używa mapy SEL=GPIO5, CF1=GPIO13, CF=GPIO14 i drivera HLW8012. Kalibracja napięcia jest dostępna po flashu w Ustawienia urządzenia -> Inne -> Calibration.",
        };
      case "none":
        return {
          requiredPins: [],
          optionId: "",
          note: "Preset ustawia bazowy template klasycznego Sonoff POW/POWR1, ale pomiar energii pozostaje wyłączony.",
        };
      default:
        return {
          requiredPins: [],
          optionId: "",
          note: "Ten preset jest tylko dla impulsowego CSE7759/HLW8012 w Sonoff POW/POWR1. Fabryczny Pow R2 używa zwykle UART CSE7766.",
        };
    }
  }

  switch (chip) {
    case "cse7761":
      return {
        requiredPins: ["rx", "tx"],
        optionId: "SUPLA_CSE7761",
        note: "DUALR3 Power Monitoring zwykle używa UART na GPIO25/GPIO26. Ten wariant buildera pozwala to ręcznie zmienić.",
      };
    case "cse7766":
      return {
        requiredPins: ["rx"],
        optionId: "SUPLA_CSE7766",
        note: "Dla CSE7766 firmware używa wejścia RX. Jeśli układ wymaga też TX, trzeba go obsłużyć poza aktualnym presetem.",
      };
    case "bl0930":
      return {
        requiredPins: ["cf"],
        optionId: "SUPLA_BL0930",
        note: "BL0930 w `DUALR3 Power Monitoring` jest obsługiwany jako driver impulsowy `CF`. Pin ustawiasz ręcznie.",
      };
    default:
      return {
        requiredPins: [],
        optionId: "",
        note: "Preset ustawia tylko bazowe GPIO `DUALR3`. Układ pomiarowy możesz dobrać później albo zostawić wyłączony.",
      };
  }
}

function updateHardwarePresetVisibility() {
  els.hardwarePresetPanel.hidden = false;
  const preset = currentHardwarePreset();
  const active = Boolean(preset);
  const customTemplate = Boolean(preset?.customTemplate);
  els.meterChip.disabled = !active;
  els.meterRxPin.disabled = !customTemplate;
  els.meterTxPin.disabled = !customTemplate;
  els.meterCfPin.disabled = !customTemplate;
  els.meterCf1Pin.disabled = !customTemplate;
  els.meterSelPin.disabled = !customTemplate;

  if (!active) {
    els.hardwarePresetNote.textContent = "Presety sprzętowe składają gotowy template bez ręcznego pisania JSON-a.";
    return;
  }

  const prefix = preset ? `${preset.label}. ` : "";
  els.hardwarePresetNote.textContent = `${prefix}${hardwarePresetRequirements(preset, els.meterChip.value).note}`;
}

function setRecommendedMeterPins(chip) {
  const preset = currentHardwarePreset();
  if (!preset) {
    return;
  }
  if (preset.profile === "pow_hlw_manual" && chip === "cse7759") {
    if (!els.meterCfPin.value) {
      els.meterCfPin.value = "14";
    }
    if (!els.meterCf1Pin.value) {
      els.meterCf1Pin.value = "13";
    }
    if (!els.meterSelPin.value) {
      els.meterSelPin.value = "5";
    }
    return;
  }
  if (preset.profile !== "dualr3") {
    return;
  }
  if (chip === "cse7761") {
    if (!els.meterTxPin.value) {
      els.meterTxPin.value = "25";
    }
    if (!els.meterRxPin.value) {
      els.meterRxPin.value = "26";
    }
  } else if (chip === "cse7766") {
    if (!els.meterRxPin.value) {
      els.meterRxPin.value = "26";
    }
  }
}

function applyHardwarePresetDefaults() {
  const preset = currentHardwarePreset();
  if (!preset) {
    return;
  }

  els.meterChip.value = preset.chip;
  els.meterRxPin.value = preset.pins.rx ?? "";
  els.meterTxPin.value = preset.pins.tx ?? "";
  els.meterCfPin.value = preset.pins.cf ?? "";
  els.meterCf1Pin.value = preset.pins.cf1 ?? "";
  els.meterSelPin.value = preset.pins.sel ?? "";
}

function buildDualR3Template() {
  const template = {
    NAME: DUAL_R3_PM_TEMPLATE_NAME,
    GPIO: [...DUAL_R3_PM_BASE_GPIO],
  };
  const chip = els.meterChip.value;
  const rxPin = parseOptionalPin(els.meterRxPin.value.trim());
  const txPin = parseOptionalPin(els.meterTxPin.value.trim());
  const cfPin = parseOptionalPin(els.meterCfPin.value.trim());

  if (chip === "cse7761") {
    setTemplatePin(template, txPin, TEMPLATE_CODES.cse7761Tx, "esp32");
    setTemplatePin(template, rxPin, TEMPLATE_CODES.cse7761Rx, "esp32");
  } else if (chip === "cse7766") {
    setTemplatePin(template, rxPin, TEMPLATE_CODES.cse7766Rx, "esp32");
  } else if (chip === "bl0930") {
    setTemplatePin(template, cfPin, TEMPLATE_CODES.cf, "esp32");
  }

  return JSON.stringify(template, null, 2);
}

function buildPowR2HlwTemplate(preset) {
  const template = {
    NAME: preset?.templateName || POW_R2_HLW_TEMPLATE_NAME,
    GPIO: [...POW_R2_BASE_GPIO],
    FLAG: 0,
  };
  const chip = els.meterChip.value;
  const cfPin = parseOptionalPin(els.meterCfPin.value.trim());
  const cf1Pin = parseOptionalPin(els.meterCf1Pin.value.trim());
  const selPin = parseOptionalPin(els.meterSelPin.value.trim());

  if (chip === "cse7759") {
    setTemplatePin(template, cfPin, TEMPLATE_CODES.cfOld, "esp82xx");
    setTemplatePin(template, cf1Pin, TEMPLATE_CODES.cf1Old, "esp82xx");
    setTemplatePin(template, selPin, TEMPLATE_CODES.selOld, "esp82xx");
  }

  return JSON.stringify(template, null, 2);
}

function buildCustomHardwareTemplate(preset) {
  if (!preset?.customTemplate) {
    return "";
  }
  if (preset.profile === "dualr3") {
    return buildDualR3Template();
  }
  if (preset.profile === "pow_hlw_manual") {
    return buildPowR2HlwTemplate(preset);
  }
  return "";
}

function validateHardwarePreset() {
  const preset = currentHardwarePreset();
  if (!preset) {
    return { ok: true, message: "" };
  }

  const requirements = hardwarePresetRequirements(preset, els.meterChip.value);
  if (!preset.customTemplate) {
    return { ok: true, message: requirements.note };
  }
  const pinValues = {
    rx: parseOptionalPin(els.meterRxPin.value.trim()),
    tx: parseOptionalPin(els.meterTxPin.value.trim()),
    cf: parseOptionalPin(els.meterCfPin.value.trim()),
    cf1: parseOptionalPin(els.meterCf1Pin.value.trim()),
    sel: parseOptionalPin(els.meterSelPin.value.trim()),
  };

  for (const key of requirements.requiredPins) {
    const pin = pinValues[key];
    if (!Number.isInteger(pin) || templateIndexForProcessor(preset.processor, pin) === null) {
      return { ok: false, message: `Preset ${preset.label} wymaga poprawnego GPIO dla pola ${key.toUpperCase()}.` };
    }
  }

  return { ok: true, message: requirements.note };
}

function parseTemplateBase(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return String(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return String(Number.parseInt(value.trim(), 10));
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function templateCompatibilityIssue(templateJson) {
  const raw = templateJson.trim();
  if (!raw) {
    return "";
  }

  try {
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return "Template JSON musi być poprawnym obiektem JSON.";
    }
    if (!Object.prototype.hasOwnProperty.call(payload, "BASE")) {
      return "";
    }
    const base = parseTemplateBase(payload.BASE);
    const name = typeof payload.NAME === "string" && payload.NAME.trim() ? payload.NAME.trim() : "Wybrany template";
    return `${name} używa pola BASE=${base ?? "unknown"}. Ten builder GUI Generic interpretuje tylko jawne GPIO z JSON-a i nie obsługuje dziedziczenia Tasmota przez BASE.`;
  } catch {
    return "Template JSON musi być poprawnym obiektem JSON.";
  }
}

function selectedTemplateCompatibilityIssue() {
  return templateCompatibilityIssue(selectedTemplateJson());
}

function applyHardwarePresetSelection() {
  const preset = currentHardwarePreset();
  if (!preset) {
    return;
  }

  for (const optionId of preset.requiredOptions || HARDWARE_REQUIRED_OPTIONS) {
    if (state.config.options[optionId]) {
      state.selected.add(optionId);
    }
  }

  for (const optionId of HARDWARE_METER_OPTIONS) {
    state.selected.delete(optionId);
  }

  const meterOption = hardwarePresetRequirements(preset, els.meterChip.value).optionId;
  if (meterOption && state.config.options[meterOption]) {
    state.selected.add(meterOption);
  }
}

function setDefaults() {
  state.selected = new Set(state.config.defaults.selected_options);
  state.currentBuildHash = "";
  state.lastBuildPayload = null;
  setXiaoProtocol("wifi");
  els.languageSelect.value = state.config.defaults.language;
  els.processorSelect.value = detectEnvFamily(state.config.defaults.env);
  renderEnvSelect(state.config.defaults.env);
  renderTemplateSelect();
  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  els.buildVersion.value = `${yy}.${mm}.${dd}`;
  els.customName.value = "";
  resetHardwarePresetInputs();
  els.templateJson.value = "";
  normalizeSelection();
  renderAll();
  renderStatus(null);
}

function meterChipLabel(chip) {
  switch (chip) {
    case "cse7759":
      return "CSE7759";
    case "cse7761":
      return "CSE7761";
    case "cse7766":
      return "CSE7766";
    case "cse7759b":
      return "CSE7759B-S";
    case "bl0930":
      return "BL0930";
    default:
      return "brak";
  }
}

function buildOptionMeta(option) {
  const chunks = [];
  if (option.depOn?.length) {
    chunks.push(`wymusza: ${option.depOn.join(", ")}`);
  }
  if (option.depOff?.length) {
    chunks.push(`wymaga: ${option.depOff.join(", ")}`);
  }
  if (option.depRel?.length) {
    chunks.push(`wyłącza: ${option.depRel.join(", ")}`);
  }
  if (option.libs) {
    chunks.push(`lib: ${option.libs}`);
  }
  if (option.opts) {
    chunks.push(`flags: ${option.opts}`);
  }
  return chunks.join(" | ");
}

function renderOptions() {
  const search = els.searchInput.value.trim().toLowerCase();
  els.optionsRoot.innerHTML = "";

  for (const sectionKey of state.config.sections) {
    const sectionOptions = Object.entries(state.config.options)
      .filter(([, option]) => option.section === sectionKey)
      .filter(([optionId, option]) => {
        if (!search) {
          return true;
        }
        return [
          optionId,
          option.name || "",
          option.desc || "",
          option.en?.name || "",
          option.en?.desc || "",
        ].some((value) => value.toLowerCase().includes(search));
      });

    if (!sectionOptions.length) {
      continue;
    }

    const section = document.createElement("section");
    section.className = "section";
    section.innerHTML = `<h3 class="section-title">${escapeHtml(sectionLabel(sectionKey))}</h3>`;
    const grid = document.createElement("div");
    grid.className = "options-grid";

    for (const [optionId, option] of sectionOptions) {
      const node = els.optionTemplate.content.firstElementChild.cloneNode(true);
      const checkbox = node.querySelector("input");
      const name = node.querySelector(".option-name");
      const desc = node.querySelector(".option-desc");
      const meta = node.querySelector(".option-meta");
      const badges = node.querySelector(".option-badges");

      checkbox.checked = state.selected.has(optionId);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.selected.add(optionId);
        } else {
          state.selected.delete(optionId);
        }
        normalizeSelection();
        renderAll();
      });

      name.textContent = `${optionLabel(option)} (${optionId})`;
      desc.textContent = optionDescription(option);
      meta.textContent = buildOptionMeta(option);

      if (option.new) {
        badges.insertAdjacentHTML("beforeend", '<span class="badge new">new</span>');
      }
      if (option.test) {
        badges.insertAdjacentHTML("beforeend", '<span class="badge test">test</span>');
      }
      if (option.depOn?.length || option.depOff?.length || option.depRel?.length) {
        badges.insertAdjacentHTML("beforeend", '<span class="badge dep">deps</span>');
      }

      grid.appendChild(node);
    }

    section.appendChild(grid);
    els.optionsRoot.appendChild(section);
  }
}

function renderSummary() {
  const selectedList = [...state.selected].sort();
  const templateName = usingCustomTemplateJson() ? "własny JSON" : (els.templateSelect.value || "brak");
  const hardwarePreset = currentHardwarePreset()?.label || els.hardwarePreset.value || "brak";
  const meterChip = isHardwarePresetActive() ? meterChipLabel(els.meterChip.value) : "brak";
  const templateIssue = selectedTemplateCompatibilityIssue();
  const xiaoProtocol = isXiaoTemplateSelected()
    ? ` | protokół XIAO: <strong>${escapeHtml(xiaoProtocolLabel(xiaoProtocolForEnv(els.envSelect.value) || selectedXiaoProtocol()))}</strong>`
    : "";
  els.selectionSummary.innerHTML = `
    <strong>${selectedList.length}</strong> aktywnych opcji |
    env: <strong>${escapeHtml(els.envSelect.value)}</strong> |
    język: <strong>${escapeHtml(els.languageSelect.value)}</strong> |
    template: <strong>${escapeHtml(templateName)}</strong> |
    preset: <strong>${escapeHtml(hardwarePreset)}</strong> |
    pomiar: <strong>${escapeHtml(meterChip)}</strong>${xiaoProtocol}
    ${templateIssue ? `<br><strong>Uwaga:</strong> ${escapeHtml(templateIssue)}` : ""}
  `;
}

function renderHistory(items = []) {
  if (!items.length) {
    els.buildHistory.innerHTML = '<div class="history-item"><small>Brak historii buildów.</small></div>';
    return;
  }

  els.buildHistory.innerHTML = items.map((item) => `
    <article class="history-item" data-hash="${escapeHtml(item.hash)}" role="button" tabindex="0">
      <strong>${escapeHtml(item.hash)}</strong>
      <small>${escapeHtml(item.status)} | ${escapeHtml(item.updated_at_iso || "")}</small>
      <small>${escapeHtml(item.request?.env || "")} | ${escapeHtml(item.request?.build_version || "")}</small>
    </article>
  `).join("");
}

function renderStatus(payload) {
  state.lastBuildPayload = payload || null;
  els.buildStatus.className = `build-status ${payload?.status || "empty"}`;
  if (!payload) {
    els.buildStatus.textContent = "Nie uruchomiono jeszcze builda.";
    els.artifactLinks.innerHTML = "";
    els.buildLog.textContent = "";
    renderInstallPanel(null);
    return;
  }

  els.buildStatus.textContent = [
    `status: ${payload.status}`,
    `hash: ${payload.hash}`,
    payload.request ? `env: ${payload.request.env}` : "",
    payload.request ? `build_version: ${payload.request.build_version}` : "",
    payload.error ? `error: ${payload.error}` : "",
    payload.compatibility_url ? `ota: ${payload.compatibility_url}` : "",
  ].filter(Boolean).join("\n");

  const links = payload.artifact_urls || {};
  els.artifactLinks.innerHTML = Object.entries(links).map(([kind, url]) => (
    `<a href="${encodeURI(url)}" target="_blank" rel="noreferrer">${escapeHtml(kind)}</a>`
  )).join("");
  els.buildLog.textContent = payload.log_tail || "";
  renderInstallPanel(payload);
}

function renderAll() {
  updateHardwarePresetVisibility();
  updateXiaoProtocolVisibility();
  renderOptions();
  renderSummary();
  renderFeaturedDevices();
  renderDeviceGroups();
}

function currentInstallManifestUrl(payload) {
  if (!payload?.hash) {
    return "";
  }
  return `${state.config.public_url}api/builds/${payload.hash}/manifest`;
}

function webInstallComponentReady() {
  return typeof window.customElements !== "undefined" && Boolean(window.customElements.get("esp-web-install-button"));
}

function webInstallSupportReason() {
  if (!("serial" in navigator)) {
    return "Ta przeglądarka nie obsługuje Web Serial. Użyj Chrome albo Edge.";
  }
  if (window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "";
  }
  return `Ta strona działa pod ${window.location.origin}. Web Serial w Chrome wymaga HTTPS albo http://localhost.`;
}

function webInstallSupported() {
  return !webInstallSupportReason();
}

function renderWebInstallPlaceholder(label, title = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost web-install-placeholder";
  button.disabled = true;
  button.textContent = label;
  if (title) {
    button.title = title;
  }
  els.webInstallWrap.appendChild(button);
}

function serialPortLabel(port, index) {
  if (port && typeof port.path === "string") {
    return port.label || port.path;
  }
  const info = typeof port.getInfo === "function" ? port.getInfo() : {};
  const usbVendorId = info.usbVendorId ? `VID:${info.usbVendorId.toString(16).padStart(4, "0")}` : "";
  const usbProductId = info.usbProductId ? `PID:${info.usbProductId.toString(16).padStart(4, "0")}` : "";
  const suffix = [usbVendorId, usbProductId].filter(Boolean).join(" ");
  return suffix ? `Port ${index + 1} (${suffix})` : `Port ${index + 1}`;
}

function renderProgrammerPanel(payload) {
  const ready = Boolean(payload?.status === "ready");
  const supportReason = webInstallSupportReason();
  const supported = !supportReason;

  if (els.detectProgrammerButton) {
    els.detectProgrammerButton.disabled = state.serialRequestPending;
  }

  if (state.serialRequestPending) {
    els.programmerStatus.textContent = supported
      ? "Czekam na wybór portu USB w oknie przeglądarki."
      : "Sprawdzam porty USB widoczne dla lokalnego serwera.";
    return;
  }

  if (!ready && !state.serialPorts.length) {
    els.programmerStatus.textContent = supported
      ? "Możesz już wykryć port USB. Gdy build będzie gotowy, użyj przycisku Web Installer."
      : `${supportReason} Kliknij „Wykryj programator”, aby sprawdzić lokalne porty serwera.`;
    els.programmerDetails.innerHTML = "";
    return;
  }

  if (!state.serialPorts.length) {
    els.programmerStatus.textContent = supported
      ? "Kliknij „Wykryj programator”, wybierz port USB i potem użyj przycisku Web Installer."
      : `${supportReason} Kliknij „Wykryj programator”, żeby sprawdzić, czy lokalny serwer widzi port USB.`;
    els.programmerDetails.innerHTML = "";
    return;
  }

  if (supported) {
    els.programmerStatus.textContent = ready
      ? `Wykryto ${state.serialPorts.length} port(y). Możesz teraz użyć przycisku Web Installer.`
      : `Wykryto ${state.serialPorts.length} port(y). Port zostanie użyty, gdy build będzie gotowy do flashowania.`;
  } else {
    const sourceLabel = state.serialPortSource === "server" ? "przez lokalny serwer" : "lokalnie";
    els.programmerStatus.textContent = ready
      ? `Wykryto ${state.serialPorts.length} port(y) ${sourceLabel}, ale Web Installer nadal wymaga Chrome/Edge na localhost albo HTTPS.`
      : `Wykryto ${state.serialPorts.length} port(y) ${sourceLabel}. Build możesz pobrać ręcznie albo uruchomić stronę na localhost/HTTPS do flashowania z przeglądarki.`;
  }
  els.programmerDetails.innerHTML = state.serialPorts
    .map((port, index) => `<span>${escapeHtml(serialPortLabel(port, index))}</span>`)
    .join("");
}

async function fetchServerSerialPorts() {
  const response = await fetch("/api/serial-ports");
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
}

async function refreshSerialPorts({ requestAccess = false } = {}) {
  if (!webInstallSupported()) {
    if (!requestAccess) {
      renderProgrammerPanel(state.lastBuildPayload);
      return state.serialPorts;
    }
    state.serialRequestPending = true;
    renderProgrammerPanel(state.lastBuildPayload);
    try {
      state.serialPorts = await fetchServerSerialPorts();
      state.serialPortSource = "server";
    } catch (error) {
      state.serialPorts = [];
      state.serialPortSource = "";
      els.programmerStatus.textContent = `Nie udało się wykryć portów na serwerze: ${error.message || String(error)}`;
    }
    state.serialRequestPending = false;
    renderProgrammerPanel(state.lastBuildPayload);
    return state.serialPorts;
  }

  let grantedPort = null;
  if (requestAccess) {
    state.serialRequestPending = true;
    renderProgrammerPanel(state.lastBuildPayload);
    try {
      grantedPort = await navigator.serial.requestPort();
    } catch (error) {
      if (error?.name !== "NotFoundError") {
        els.programmerStatus.textContent = `Nie udało się uzyskać dostępu do portu: ${error.message || String(error)}`;
      }
      state.serialRequestPending = false;
      renderProgrammerPanel(state.lastBuildPayload);
      return state.serialPorts;
    }
    state.serialRequestPending = false;
  }

  try {
    state.serialPorts = await navigator.serial.getPorts();
    state.serialPortSource = "web";
  } catch (error) {
    if (grantedPort) {
      state.serialPorts = [grantedPort];
      state.serialPortSource = "web";
    } else {
      els.programmerStatus.textContent = `Nie udało się odczytać portów: ${error.message || String(error)}`;
      state.serialPorts = [];
      state.serialPortSource = "";
    }
  }

  if (grantedPort && !state.serialPorts.includes(grantedPort)) {
    state.serialPorts = [...state.serialPorts, grantedPort];
    state.serialPortSource = "web";
  }

  renderProgrammerPanel(state.lastBuildPayload);
  return state.serialPorts;
}

function renderWebInstallButton(payload) {
  els.webInstallWrap.innerHTML = "";
  state.webInstallButton = null;

  if (!payload?.hash || payload.status !== "ready") {
    renderWebInstallPlaceholder(
      "Web Installer będzie dostępny po buildzie",
      "Najpierw zbuduj firmware albo wybierz gotowy build z historii.",
    );
    els.webInstallHint.textContent = "Instalacja z przeglądarki działa przez Web Serial w Chromium i wymaga połączenia HTTP localhost albo HTTPS.";
    return;
  }

  if (!webInstallSupported()) {
    renderWebInstallPlaceholder(
      "Web Installer niedostępny w tej przeglądarce",
      "Użyj Chrome albo Edge na HTTPS lub localhost.",
    );
    els.webInstallHint.textContent = "Ta przeglądarka albo kontekst strony nie obsługuje Web Serial. Użyj Chrome lub Edge na localhost/HTTPS albo pobierz pliki poniżej.";
    return;
  }

  if (!webInstallComponentReady()) {
    renderWebInstallPlaceholder(
      "Web Installer nie załadował się",
      "Odśwież stronę albo sprawdź dostęp do skryptu esp-web-tools.",
    );
    els.webInstallHint.textContent = "Komponent Web Installera nie załadował się. Odśwież stronę albo sprawdź, czy przeglądarka ma dostęp do skryptu esp-web-tools.";
    return;
  }

  const manifestUrl = currentInstallManifestUrl(payload);
  const button = document.createElement("esp-web-install-button");
  button.setAttribute("manifest", manifestUrl);
  button.setAttribute("install-supported", "");
  els.webInstallWrap.appendChild(button);
  state.webInstallButton = button;
  els.webInstallHint.textContent = "Kliknij bezpośrednio przycisk Web Installer obok, żeby przeglądarka zachowała uprawnienia do portu USB.";
}

function updateInstallButtons(payload) {
  const ready = Boolean(payload?.status === "ready");
  const downloadEnabled = ready && Boolean(state.preferredDownloadUrl);
  if (els.downloadFirmwareButton) {
    els.downloadFirmwareButton.disabled = !downloadEnabled;
  }
}

function watchWebInstallComponent() {
  if (typeof window.customElements === "undefined") {
    return;
  }
  window.customElements.whenDefined("esp-web-install-button").then(() => {
    if (state.lastBuildPayload) {
      renderInstallPanel(state.lastBuildPayload);
    }
  }).catch(() => {});
}

function renderInstallPanel(payload) {
  if (!payload || !payload.hash) {
    els.installBadge.textContent = "brak builda";
    els.installSummary.textContent = "Po udanym buildzie pojawią się tutaj linki OTA i pliki firmware do pobrania.";
    els.otaUrl.value = "";
    els.installArtifacts.innerHTML = "";
    state.preferredDownloadUrl = "";
    renderWebInstallButton(null);
    updateInstallButtons(null);
    state.installManifestUrl = "";
    renderProgrammerPanel(null);
    return;
  }

  const ota = payload.compatibility_url || "";
  els.otaUrl.value = ota;
  els.installBadge.textContent = payload.status;

  if (payload.status === "ready") {
    els.installSummary.textContent = `Build ${payload.hash} jest gotowy. Możesz użyć OTA albo pobrać artefakty do flashowania lokalnego.`;
  } else if (payload.status === "failed") {
    els.installSummary.textContent = `Build ${payload.hash} nie przeszedł. Sprawdź log i popraw konfigurację przed kolejną próbą.`;
  } else {
    els.installSummary.textContent = `Build ${payload.hash} jest w toku. Gdy skończy się poprawnie, pojawią się tu gotowe pliki do instalacji.`;
  }

  const links = payload.artifact_urls || {};
  els.installArtifacts.innerHTML = Object.entries(links).map(([kind, url]) => (
    `<a href="${encodeURI(url)}" target="_blank" rel="noreferrer">Pobierz ${escapeHtml(kind)}</a>`
  )).join("");
  state.preferredDownloadUrl = links.factory || links.bin || links.gz || Object.values(links)[0] || "";
  state.installManifestUrl = currentInstallManifestUrl(payload);
  renderWebInstallButton(payload);
  updateInstallButtons(payload);
  renderProgrammerPanel(payload);
}

function selectedTemplateJson() {
  const custom = els.templateJson.value.trim();
  if (custom) {
    return custom;
  }
  const preset = currentHardwarePreset();
  if (preset?.customTemplate) {
    return buildCustomHardwareTemplate(preset);
  }
  const selectedName = els.templateSelect.value;
  if (!selectedName) {
    return "";
  }
  const template = state.config.templates.find((item) => item.NAME === selectedName);
  return template ? JSON.stringify(template) : "";
}

async function fetchBuildHistory() {
  try {
    const response = await fetch("/api/builds");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const items = payload.items || [];
    renderHistory(items);
    if (!state.currentBuildHash) {
      return;
    }

    const currentExists = items.some((item) => item.hash === state.currentBuildHash);
    if (!currentExists) {
      try {
        await fetchBuildDetails(state.currentBuildHash);
      } catch (error) {
        if (error?.status === 404) {
          state.currentBuildHash = "";
          renderStatus(null);
        }
      }
    }
  } catch (error) {
    renderHistory([]);
    if (!state.currentBuildHash) {
      renderStatus(null);
    }
    els.buildHistory.innerHTML = `<div class="history-item"><small>Nie udało się pobrać historii buildów: ${escapeHtml(error.message || String(error))}</small></div>`;
  }
}

async function fetchBuildDetails(hash) {
  const response = await fetch(`/api/builds/${hash}`);
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  renderStatus(payload);
  state.currentBuildHash = hash;
  return payload;
}

function openBuildHistoryCard(card) {
  if (!card?.dataset.hash) {
    return;
  }
  fetchBuildDetails(card.dataset.hash).catch((error) => {
    els.buildStatus.textContent = `Nie udało się wczytać builda: ${error.message || String(error)}`;
  });
}

async function pollBuild(hash) {
  const payload = await fetchBuildDetails(hash);
  if (payload.status === "queued" || payload.status === "building") {
    state.pollTimer = setTimeout(() => pollBuild(hash), 2500);
  } else {
    state.pollTimer = null;
    fetchBuildHistory();
  }
}

async function triggerBuild() {
  if (state.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }

  const hardwareValidation = validateHardwarePreset();
  if (!hardwareValidation.ok) {
    renderStatus({
      status: "failed",
      hash: "",
      request: {},
      error: hardwareValidation.message,
      artifact_urls: {},
      log_tail: "",
    });
    return;
  }

  const templateIssue = selectedTemplateCompatibilityIssue();
  if (templateIssue) {
    renderStatus({
      status: "failed",
      hash: "",
      request: {},
      error: templateIssue,
      artifact_urls: {},
      log_tail: "",
    });
    return;
  }

  const payload = {
    env: els.envSelect.value,
    language: els.languageSelect.value,
    build_version: els.buildVersion.value.trim(),
    selected_options: [...state.selected].sort(),
    template_name: els.templateSelect.value,
    template_json: selectedTemplateJson(),
    public_builder_url: state.config.public_url,
    custom_name: els.customName.value.trim(),
  };

  renderStatus({
    status: "queued",
    hash: "obliczanie...",
    request: payload,
    compatibility_url: "",
    artifact_urls: {},
    log_tail: "",
  });

  const response = await fetch("/api/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  if (!response.ok && response.status !== 202) {
    renderStatus({
      status: "failed",
      hash: "",
      request: payload,
      error: data.error || "Build request failed",
      artifact_urls: {},
      log_tail: "",
    });
    return;
  }

  state.currentBuildHash = data.hash;
  pollBuild(data.hash);
}

async function bootstrap() {
  const response = await fetch("/api/config");
  state.config = await response.json();
  buildEnvFamilies();

  els.catalogVersion.textContent = state.config.version || "-";
  els.publicUrl.textContent = state.config.public_url || "-";

  renderProcessorSelect();
  renderEnvSelect(state.config.defaults.env);
  renderTemplateSelect();
  watchWebInstallComponent();
  try {
    await refreshSerialPorts();
  } catch (error) {
    els.programmerStatus.textContent = `Nie udało się przygotować wykrywania portów: ${error.message || String(error)}`;
  }

  setDefaults();
  await fetchBuildHistory();

  els.searchInput.addEventListener("input", renderOptions);
  els.languageSelect.addEventListener("change", renderAll);
  els.processorSelect.addEventListener("change", () => {
    clearHardwarePresetSelection();
    renderEnvSelect();
    syncXiaoProtocolContext();
    normalizeSelection();
    renderAll();
  });
  els.templateFilter.addEventListener("input", () => {
    renderTemplateSelect(els.templateSelect.value);
  });
  els.deviceSearch.addEventListener("input", () => {
    renderFeaturedDevices();
    renderDeviceGroups();
  });
  els.hardwarePreset.addEventListener("change", () => {
    applyHardwarePresetDefaults();
    const preset = currentHardwarePreset();
    if (preset) {
      els.processorSelect.value = preset.processor;
      renderEnvSelect(preset.env);
      renderTemplateSelect(preset.templateName);
      els.templateSelect.value = preset.templateName;
    }
    syncXiaoProtocolContext();
    normalizeSelection();
    renderAll();
  });
  els.meterChip.addEventListener("change", () => {
    setRecommendedMeterPins(els.meterChip.value);
    normalizeSelection();
    renderAll();
  });
  [els.meterRxPin, els.meterTxPin, els.meterCfPin, els.meterCf1Pin, els.meterSelPin].forEach((input) => {
    input.addEventListener("input", renderSummary);
  });
  xiaoProtocolInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) {
        return;
      }
      syncXiaoProtocolContext(input.value);
      renderAll();
    });
  });
  els.templateSelect.addEventListener("change", () => {
    clearHardwarePresetSelection();
    syncXiaoProtocolContext();
    normalizeSelection();
    renderAll();
  });
  els.templateJson.addEventListener("input", () => {
    if (els.templateJson.value.trim()) {
      clearHardwarePresetSelection();
      normalizeSelection();
    }
    syncXiaoProtocolContext();
    renderAll();
  });
  els.envSelect.addEventListener("change", () => {
    updateXiaoProtocolVisibility();
    renderSummary();
  });
  els.copyOtaButton.addEventListener("click", async () => {
    if (!els.otaUrl.value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(els.otaUrl.value);
      els.installBadge.textContent = "skopiowano OTA";
    } catch {
      els.installBadge.textContent = "błąd schowka";
    }
  });
  els.openOtaButton.addEventListener("click", () => {
    if (els.otaUrl.value) {
      window.open(els.otaUrl.value, "_blank", "noopener,noreferrer");
    }
  });
  els.downloadFirmwareButton?.addEventListener("click", () => {
    if (state.preferredDownloadUrl) {
      window.open(state.preferredDownloadUrl, "_blank", "noopener,noreferrer");
    }
  });
  els.buildButton.addEventListener("click", triggerBuild);
  els.refreshBuilds.addEventListener("click", fetchBuildHistory);
  els.resetDefaults.addEventListener("click", setDefaults);
  els.buildHistory.addEventListener("click", (event) => {
    const card = event.target.closest("[data-hash]");
    if (!card) {
      return;
    }
    openBuildHistoryCard(card);
  });
  els.buildHistory.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const card = event.target.closest("[data-hash]");
    if (!card) {
      return;
    }
    event.preventDefault();
    openBuildHistoryCard(card);
  });

  if ("serial" in navigator && typeof navigator.serial.addEventListener === "function") {
    navigator.serial.addEventListener("connect", () => {
      refreshSerialPorts();
    });
    navigator.serial.addEventListener("disconnect", () => {
      refreshSerialPorts();
    });
  }
}

els.detectProgrammerButton?.addEventListener("click", async () => {
  try {
    await refreshSerialPorts({ requestAccess: true });
  } catch (error) {
    els.programmerStatus.textContent = `Nie udało się wykryć portu: ${error.message || String(error)}`;
  }
});

bootstrap().catch((error) => {
  renderStatus({
    status: "failed",
    hash: "",
    request: {},
    error: error.message || String(error),
    artifact_urls: {},
    log_tail: "",
  });
});
