const state = {
  config: null,
  selected: new Set(),
  currentBuildHash: "",
  pollTimer: null,
};

const els = {
  catalogVersion: document.getElementById("catalogVersion"),
  publicUrl: document.getElementById("publicUrl"),
  envSelect: document.getElementById("envSelect"),
  languageSelect: document.getElementById("languageSelect"),
  buildVersion: document.getElementById("buildVersion"),
  customName: document.getElementById("customName"),
  templateSelect: document.getElementById("templateSelect"),
  templateJson: document.getElementById("templateJson"),
  searchInput: document.getElementById("searchInput"),
  selectionSummary: document.getElementById("selectionSummary"),
  optionsRoot: document.getElementById("optionsRoot"),
  buildButton: document.getElementById("buildButton"),
  buildStatus: document.getElementById("buildStatus"),
  artifactLinks: document.getElementById("artifactLinks"),
  buildLog: document.getElementById("buildLog"),
  buildHistory: document.getElementById("buildHistory"),
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
}

function setDefaults() {
  state.selected = new Set(state.config.defaults.selected_options);
  els.languageSelect.value = state.config.defaults.language;
  els.envSelect.value = state.config.defaults.env;
  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  els.buildVersion.value = `${yy}.${mm}.${dd}`;
  els.customName.value = "";
  els.templateJson.value = "";
  normalizeSelection();
  renderAll();
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
  els.selectionSummary.innerHTML = `
    <strong>${selectedList.length}</strong> aktywnych opcji |
    env: <strong>${escapeHtml(els.envSelect.value)}</strong> |
    język: <strong>${escapeHtml(els.languageSelect.value)}</strong> |
    template: <strong>${escapeHtml(templateName)}</strong>
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
}

function renderAll() {
  renderOptions();
  renderSummary();
}

function selectedTemplateJson() {
  const custom = els.templateJson.value.trim();
  if (custom) {
    return custom;
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

  els.catalogVersion.textContent = state.config.version || "-";
  els.publicUrl.textContent = state.config.public_url || "-";

  els.envSelect.innerHTML = state.config.envs
    .map((env) => `<option value="${escapeHtml(env)}">${escapeHtml(env)}</option>`)
    .join("");
  els.templateSelect.innerHTML = ['<option value="">brak</option>']
    .concat(state.config.templates.map((template) => (
      `<option value="${escapeHtml(template.NAME)}">${escapeHtml(template.NAME)}</option>`
    )))
    .join("");

  setDefaults();
  await fetchBuildHistory();

  els.searchInput.addEventListener("input", renderOptions);
  els.languageSelect.addEventListener("change", renderAll);
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
