const state = {
  config: null,
  selected: new Set(),
  currentBuildHash: "",
  pollTimer: null,
  envFamilies: [],
  preferredDownloadUrl: "",
  webInstallButton: null,
};

const DUAL_R3_PM_TEMPLATE_NAME = "Sonoff Dual R3 Power Monitoring";
const DUAL_R3_PM_BASE_GPIO = [
  32, 0, 0, 0, 0, 0, 0, 0, 0, 576, 225, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 224,
  0, 0, 0, 0, 160, 161, 0, 0, 0, 0, 0, 0,
];
const TEMPLATE_CODES = {
  cse7766Rx: 3104,
  cse7761Tx: 7296,
  cse7761Rx: 7328,
  cf: 2688,
};
const DUAL_R3_REQUIRED_OPTIONS = ["SUPLA_RELAY", "SUPLA_BUTTON"];
const DUAL_R3_METER_OPTIONS = ["SUPLA_CSE7761", "SUPLA_CSE7766", "SUPLA_BL0930"];
const DUAL_R3_PRESETS = {
  sonoff_dual_r3_pm: {
    chip: "none",
    pins: {},
    label: "Sonoff Dual R3 Power Monitoring",
  },
  sonoff_dual_r3_pm_bl0930: {
    chip: "bl0930",
    pins: {},
    label: "Sonoff Dual R3 + BL0930",
  },
  sonoff_dual_r3_pm_cse7761: {
    chip: "cse7761",
    pins: { tx: 25, rx: 26 },
    label: "Sonoff Dual R3 + CSE7761",
  },
  sonoff_dual_r3_pm_cse7766: {
    chip: "cse7766",
    pins: { rx: 26 },
    label: "Sonoff Dual R3 + CSE7766",
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
    description: "Konfiguracja z wbudowanym licznikiem energii CSE7766/CSE7761.",
    templateName: "Sonoff Pow R2",
    processor: "esp82xx",
    env: "GUI_Generic_2MB",
    hardwarePreset: "",
    selectedOptions: ["SUPLA_RELAY", "SUPLA_BUTTON", "SUPLA_CSE7766"],
    chips: ["Sonoff", "CSE7766"],
  },
];

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
  installFirmwareButton: document.getElementById("installFirmwareButton"),
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
  const envs = state.config.envs.filter((env) => detectEnvFamily(env) === family);
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
  const gpioCount = Array.isArray(template.GPIO) ? template.GPIO.length : 0;
  return gpioCount > 20 ? "esp32" : "esp82xx";
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
    applyDualR3PresetDefaults();
  } else {
    els.meterChip.value = "none";
    els.meterRxPin.value = "";
    els.meterTxPin.value = "";
    els.meterCfPin.value = "";
    els.meterCf1Pin.value = "";
    els.meterSelPin.value = "";
  }
  if (preset.selectedOptions?.length) {
    const base = state.config.defaults.selected_options || [];
    state.selected = new Set([...base, ...preset.selectedOptions]);
  }
  normalizeSelection();
  renderAll();
}

function renderFeaturedDevices() {
  const search = els.deviceSearch.value.trim().toLowerCase();
  const items = FEATURED_DEVICE_PRESETS.filter((preset) => (
    !search ||
    preset.name.toLowerCase().includes(search) ||
    preset.description.toLowerCase().includes(search) ||
    preset.chips.some((chip) => chip.toLowerCase().includes(search))
  ));

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
      renderTemplateSelect(templateName);
      els.templateSelect.value = templateName;
      if (!els.templateJson.value.trim()) {
        if (template) {
          els.templateJson.value = JSON.stringify(template, null, 2);
        }
      }
      renderAll();
    });
  });
}

function normalizeSelection() {
  let changed = true;
  while (changed) {
    changed = false;
    for (const optionId of [...state.selected]) {
      const option = getOption(optionId);
      if (!option) {
        state.selected.delete(optionId);
        changed = true;
        continue;
      }

      for (const depId of option.depOn || []) {
        if (!state.selected.has(depId)) {
          state.selected.add(depId);
          changed = true;
        }
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

      const blockers = option.depOff || [];
      if (blockers.some((requiredId) => !state.selected.has(requiredId))) {
        state.selected.delete(optionId);
        changed = true;
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

function parseOptionalPin(value) {
  if (value === "") {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function setTemplatePin(template, pin, code) {
  const index = templateIndexForEsp32Pin(pin);
  if (index === null) {
    return false;
  }
  while (template.GPIO.length <= index) {
    template.GPIO.push(0);
  }
  template.GPIO[index] = code;
  return true;
}

function isDualR3PresetActive() {
  return Object.hasOwn(DUAL_R3_PRESETS, els.hardwarePreset.value);
}

function currentDualR3Preset() {
  return DUAL_R3_PRESETS[els.hardwarePreset.value] || null;
}

function dualR3MeterRequirements(chip) {
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
  const active = isDualR3PresetActive();
  els.meterChip.disabled = !active;
  els.meterRxPin.disabled = !active;
  els.meterTxPin.disabled = !active;
  els.meterCfPin.disabled = !active;
  els.meterCf1Pin.disabled = !active;
  els.meterSelPin.disabled = !active;

  if (!active) {
    els.hardwarePresetNote.textContent = "Presety sprzętowe składają gotowy template bez ręcznego pisania JSON-a.";
    return;
  }

  const preset = currentDualR3Preset();
  const prefix = preset ? `${preset.label}. ` : "";
  els.hardwarePresetNote.textContent = `${prefix}${dualR3MeterRequirements(els.meterChip.value).note}`;
}

function setRecommendedMeterPins(chip) {
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

function applyDualR3PresetDefaults() {
  const preset = currentDualR3Preset();
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
    setTemplatePin(template, txPin, TEMPLATE_CODES.cse7761Tx);
    setTemplatePin(template, rxPin, TEMPLATE_CODES.cse7761Rx);
  } else if (chip === "cse7766") {
    setTemplatePin(template, rxPin, TEMPLATE_CODES.cse7766Rx);
  } else if (chip === "bl0930") {
    setTemplatePin(template, cfPin, TEMPLATE_CODES.cf);
  }

  return JSON.stringify(template, null, 2);
}

function validateHardwarePreset() {
  if (!isDualR3PresetActive()) {
    return { ok: true, message: "" };
  }

  const requirements = dualR3MeterRequirements(els.meterChip.value);
  const pinValues = {
    rx: parseOptionalPin(els.meterRxPin.value.trim()),
    tx: parseOptionalPin(els.meterTxPin.value.trim()),
    cf: parseOptionalPin(els.meterCfPin.value.trim()),
  };

  for (const key of requirements.requiredPins) {
    const pin = pinValues[key];
    if (!Number.isInteger(pin) || templateIndexForEsp32Pin(pin) === null) {
      return { ok: false, message: `Preset DUALR3 wymaga poprawnego GPIO dla pola ${key.toUpperCase()}.` };
    }
  }

  return { ok: true, message: requirements.note };
}

function applyHardwarePresetSelection() {
  if (!isDualR3PresetActive()) {
    return;
  }

  for (const optionId of DUAL_R3_REQUIRED_OPTIONS) {
    if (state.config.options[optionId]) {
      state.selected.add(optionId);
    }
  }

  for (const optionId of DUAL_R3_METER_OPTIONS) {
    state.selected.delete(optionId);
  }

  const meterOption = dualR3MeterRequirements(els.meterChip.value).optionId;
  if (meterOption && state.config.options[meterOption]) {
    state.selected.add(meterOption);
  }
}

function setDefaults() {
  state.selected = new Set(state.config.defaults.selected_options);
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
  els.hardwarePreset.value = "";
  els.meterChip.value = "none";
  els.meterRxPin.value = "";
  els.meterTxPin.value = "";
  els.meterCfPin.value = "";
  els.meterCf1Pin.value = "";
  els.meterSelPin.value = "";
  els.templateJson.value = "";
  normalizeSelection();
  renderAll();
  renderInstallPanel(null);
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
  const templateName = els.templateSelect.value || "brak";
  const hardwarePreset = currentDualR3Preset()?.label || els.hardwarePreset.value || "brak";
  const meterChip = isDualR3PresetActive() ? els.meterChip.value : "brak";
  els.selectionSummary.innerHTML = `
    <strong>${selectedList.length}</strong> aktywnych opcji |
    env: <strong>${escapeHtml(els.envSelect.value)}</strong> |
    język: <strong>${escapeHtml(els.languageSelect.value)}</strong> |
    template: <strong>${escapeHtml(templateName)}</strong> |
    preset: <strong>${escapeHtml(hardwarePreset)}</strong> |
    pomiar: <strong>${escapeHtml(meterChip)}</strong>
  `;
}

function renderHistory(items = []) {
  if (!items.length) {
    els.buildHistory.innerHTML = '<div class="history-item"><small>Brak historii buildów.</small></div>';
    return;
  }

  els.buildHistory.innerHTML = items.map((item) => `
    <article class="history-item">
      <strong>${escapeHtml(item.hash)}</strong>
      <small>${escapeHtml(item.status)} | ${escapeHtml(item.updated_at_iso || "")}</small>
      <small>${escapeHtml(item.request?.env || "")} | ${escapeHtml(item.request?.build_version || "")}</small>
    </article>
  `).join("");
}

function renderStatus(payload) {
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

function webInstallSupported() {
  return "serial" in navigator && (window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
}

function renderWebInstallButton(payload) {
  els.webInstallWrap.innerHTML = "";
  els.webInstallWrap.hidden = true;
  state.webInstallButton = null;

  if (!payload?.hash || payload.status !== "ready") {
    els.webInstallHint.textContent = "Instalacja z przeglądarki działa przez Web Serial w Chromium i wymaga połączenia HTTP localhost albo HTTPS.";
    return;
  }

  if (!webInstallSupported()) {
    els.webInstallHint.textContent = "Ta przeglądarka albo kontekst strony nie obsługuje Web Serial. Użyj Chrome lub Edge na localhost/HTTPS albo pobierz pliki poniżej.";
    return;
  }

  const manifestUrl = currentInstallManifestUrl(payload);
  const button = document.createElement("esp-web-install-button");
  button.setAttribute("manifest", manifestUrl);
  button.setAttribute("install-supported", "");
  els.webInstallWrap.appendChild(button);
  els.webInstallWrap.hidden = false;
  state.webInstallButton = button;
  els.webInstallHint.textContent = "Przycisk Zainstaluj wykrywa port szeregowy i wgrywa gotowy build bez ręcznego doboru offsetów.";
}

function updateInstallButtons(payload) {
  const ready = Boolean(payload?.status === "ready");
  const downloadEnabled = ready && Boolean(state.preferredDownloadUrl);
  const installEnabled = ready && Boolean(els.otaUrl.value);
  if (els.downloadFirmwareButton) {
    els.downloadFirmwareButton.disabled = !downloadEnabled;
  }
  if (els.installFirmwareButton) {
    els.installFirmwareButton.disabled = !installEnabled;
  }
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
  renderWebInstallButton(payload);
  updateInstallButtons(payload);
}

function selectedTemplateJson() {
  const custom = els.templateJson.value.trim();
  if (custom) {
    return custom;
  }
  if (isDualR3PresetActive()) {
    return buildDualR3Template();
  }
  const selectedName = els.templateSelect.value;
  if (!selectedName) {
    return "";
  }
  const template = state.config.templates.find((item) => item.NAME === selectedName);
  return template ? JSON.stringify(template) : "";
}

async function fetchBuildHistory() {
  const response = await fetch("/api/builds");
  const payload = await response.json();
  renderHistory(payload.items || []);
}

async function pollBuild(hash) {
  const response = await fetch(`/api/builds/${hash}`);
  const payload = await response.json();
  payload.compatibility_url = `${state.config.public_url}?firmware=${hash}`;
  renderStatus(payload);
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

  setDefaults();
  await fetchBuildHistory();

  els.searchInput.addEventListener("input", renderOptions);
  els.languageSelect.addEventListener("change", renderAll);
  els.processorSelect.addEventListener("change", () => {
    renderEnvSelect();
    renderSummary();
    renderDeviceGroups();
  });
  els.templateFilter.addEventListener("input", () => {
    renderTemplateSelect(els.templateSelect.value);
  });
  els.deviceSearch.addEventListener("input", () => {
    renderFeaturedDevices();
    renderDeviceGroups();
  });
  els.hardwarePreset.addEventListener("change", () => {
    applyDualR3PresetDefaults();
    if (isDualR3PresetActive()) {
      els.processorSelect.value = "esp32";
      renderEnvSelect("GUI_Generic_ESP32");
      renderTemplateSelect(DUAL_R3_PM_TEMPLATE_NAME);
      els.templateSelect.value = DUAL_R3_PM_TEMPLATE_NAME;
    }
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
  els.templateSelect.addEventListener("change", () => {
    const selectedName = els.templateSelect.value;
    if (!els.templateJson.value.trim() && selectedName) {
      const template = state.config.templates.find((item) => item.NAME === selectedName);
      if (template) {
        els.templateJson.value = JSON.stringify(template, null, 2);
      }
    }
    renderSummary();
  });
  els.templateJson.addEventListener("input", renderSummary);
  els.envSelect.addEventListener("change", renderSummary);
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
  els.installFirmwareButton?.addEventListener("click", () => {
    if (state.webInstallButton) {
      state.webInstallButton.click();
      return;
    }
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
}

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
