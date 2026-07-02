(function () {
  "use strict";

  const STORAGE_KEY = "gamma-calc-sources-v1";
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const MM_PER_INCH = 25.4;
  const ISOTOPES = {
    "Ir-192": { halfLifeDays: 73.82, monthlyChangeDays: 31 },
    "Co-60": { halfLifeDays: 5.2714 * 365.25 }
  };

  const els = {
    loginForm: document.getElementById("loginForm"),
    adminPassword: document.getElementById("adminPassword"),
    adminSession: document.getElementById("adminSession"),
    adminMessage: document.getElementById("adminMessage"),
    logoutButton: document.getElementById("logoutButton"),
    passwordForm: document.getElementById("passwordForm"),
    newAdminPassword: document.getElementById("newAdminPassword"),
    modeBadge: document.getElementById("modeBadge"),
    storageStatus: document.getElementById("storageStatus"),
    sourceForm: document.getElementById("sourceForm"),
    sourceId: document.getElementById("sourceId"),
    isotope: document.getElementById("isotope"),
    serialNumber: document.getElementById("serialNumber"),
    containerNumber: document.getElementById("containerNumber"),
    startStrength: document.getElementById("startStrength"),
    strengthDate: document.getElementById("strengthDate"),
    notes: document.getElementById("notes"),
    isActive: document.getElementById("isActive"),
    clearFormButton: document.getElementById("clearFormButton"),
    calcSource: document.getElementById("calcSource"),
    techniqueExposure: document.getElementById("techniqueExposure"),
    referenceDistance: document.getElementById("referenceDistance"),
    referenceDistanceUnit: document.getElementById("referenceDistanceUnit"),
    actualDistance: document.getElementById("actualDistance"),
    actualDistanceUnit: document.getElementById("actualDistanceUnit"),
    calculationDate: document.getElementById("calculationDate"),
    currentStrength: document.getElementById("currentStrength"),
    adjustedExposure: document.getElementById("adjustedExposure"),
    exposureTime: document.getElementById("exposureTime"),
    heightDistance: document.getElementById("heightDistance"),
    heightDistanceUnit: document.getElementById("heightDistanceUnit"),
    exposureAngle: document.getElementById("exposureAngle"),
    heightResultUnit: document.getElementById("heightResultUnit"),
    sourceHeight: document.getElementById("sourceHeight"),
    heightAngleDisplay: document.getElementById("heightAngleDisplay"),
    heightForm: document.getElementById("heightForm"),
    sourceList: document.getElementById("sourceList"),
    activeCount: document.getElementById("activeCount"),
    irCount: document.getElementById("irCount"),
    coCount: document.getElementById("coCount"),
    exportButton: document.getElementById("exportButton"),
    importInput: document.getElementById("importInput")
  };

  let sources = [];
  let isAdmin = false;
  let apiMode = false;
  let dataPath = "";

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysBetween(startIso, endIso) {
    const start = new Date(`${startIso}T00:00:00`);
    const end = new Date(`${endIso}T00:00:00`);
    return Math.max(0, (end - start) / MS_PER_DAY);
  }

  function createId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return `source-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function currentStrengthCi(source, onDateIso) {
    const isotope = ISOTOPES[source.isotope];
    const elapsedDays = daysBetween(source.strengthDate, onDateIso);
    return Number(source.startStrength) * Math.pow(0.5, elapsedDays / isotope.halfLifeDays);
  }

  function adjustedExposureCiMinutes(techniqueExposure, referenceDistance, actualDistance) {
    return Number(techniqueExposure) * Math.pow(Number(actualDistance) / Number(referenceDistance), 2);
  }

  function exposureTimeMinutes(source, techniqueExposure, referenceDistance, actualDistance, onDateIso) {
    const currentStrength = currentStrengthCi(source, onDateIso);
    const adjustedExposure = adjustedExposureCiMinutes(techniqueExposure, referenceDistance, actualDistance);
    return adjustedExposure / currentStrength;
  }

  function sourceHeightMm(distanceMm, angleDegrees) {
    const radians = (Number(angleDegrees) * Math.PI) / 180;
    return Number(distanceMm) * Math.sin(radians);
  }

  function toMm(value, unit) {
    const number = Number(value);
    return unit === "in" ? number * MM_PER_INCH : number;
  }

  function fromMm(value, unit) {
    const number = Number(value);
    return unit === "in" ? number / MM_PER_INCH : number;
  }

  function sourceHeight(distance, angleDegrees, distanceUnit = "mm", resultUnit = "mm") {
    const heightMm = sourceHeightMm(toMm(distance, distanceUnit), angleDegrees);
    return fromMm(heightMm, resultUnit);
  }

  function loadLocalSources() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function saveLocalSources() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
  }

  async function apiRequest(path, options = {}) {
    if (typeof fetch !== "function") throw new Error("Backend unavailable.");
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Request failed.");
    return payload;
  }

  function formatCi(value) {
    if (!Number.isFinite(value)) return "--";
    return `${value.toFixed(value >= 10 ? 2 : 3)} Ci`;
  }

  function formatMinutes(value) {
    if (!Number.isFinite(value)) return "--";
    const totalSeconds = Math.round(value * 60);
    if (totalSeconds < 60) return `${totalSeconds} ${totalSeconds === 1 ? "sec" : "secs"}`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} ${minutes === 1 ? "min" : "mins"} ${seconds.toString().padStart(2, "0")} ${seconds === 1 ? "sec" : "secs"}`;
  }

  function formatMm(value) {
    if (!Number.isFinite(value)) return "--";
    return `${value.toFixed(value >= 100 ? 0 : 1)} mm`;
  }

  function formatDistance(value, unit) {
    if (!Number.isFinite(value)) return "--";
    if (unit === "in") return `${value.toFixed(value >= 10 ? 2 : 3)} in`;
    return formatMm(value);
  }

  function setMessage(message) {
    els.adminMessage.textContent = message;
  }

  function renderAdminState() {
    els.loginForm.hidden = isAdmin;
    els.adminSession.hidden = !isAdmin;
    els.modeBadge.textContent = isAdmin ? "Admin" : "Read only";
    els.modeBadge.className = `badge${isAdmin ? "" : " inactive"}`;
    document.querySelectorAll(".admin-only").forEach((element) => {
      element.classList.toggle("admin-locked", !isAdmin);
    });
    els.storageStatus.textContent = apiMode
      ? `Shared data store: ${dataPath || "connected"}`
      : "Local preview mode: source edits are stored only in this browser.";
  }

  function resetSourceForm() {
    els.sourceForm.reset();
    els.sourceId.value = "";
    els.isotope.value = "Ir-192";
    els.strengthDate.value = todayIso();
    els.isActive.checked = true;
  }

  function sourceFromForm() {
    return {
      id: els.sourceId.value || createId(),
      isotope: els.isotope.value,
      serialNumber: els.serialNumber.value.trim(),
      containerNumber: els.containerNumber.value.trim(),
      startStrength: Number(els.startStrength.value),
      strengthDate: els.strengthDate.value,
      notes: els.notes.value.trim(),
      isActive: els.isActive.checked,
      updatedAt: new Date().toISOString()
    };
  }

  async function upsertSource(event) {
    event.preventDefault();
    if (!isAdmin) return;

    const source = sourceFromForm();
    if (apiMode) {
      const data = await apiRequest("/api/sources", {
        method: "POST",
        body: JSON.stringify({ source })
      });
      sources = data.sources;
    } else {
      const existingIndex = sources.findIndex((item) => item.id === source.id);
      if (existingIndex >= 0) sources[existingIndex] = source;
      else sources.push(source);
      saveLocalSources();
    }

    resetSourceForm();
    render();
  }

  function editSource(id) {
    if (!isAdmin) return;
    const source = sources.find((item) => item.id === id);
    if (!source) return;

    els.sourceId.value = source.id;
    els.isotope.value = source.isotope;
    els.serialNumber.value = source.serialNumber;
    els.containerNumber.value = source.containerNumber;
    els.startStrength.value = source.startStrength;
    els.strengthDate.value = source.strengthDate;
    els.notes.value = source.notes || "";
    els.isActive.checked = source.isActive;
    els.serialNumber.focus();
  }

  function duplicateSource(id) {
    if (!isAdmin) return;
    const source = sources.find((item) => item.id === id);
    if (!source) return;

    els.sourceId.value = "";
    els.isotope.value = source.isotope;
    els.serialNumber.value = "";
    els.containerNumber.value = source.containerNumber;
    els.startStrength.value = "";
    els.strengthDate.value = todayIso();
    els.notes.value = source.notes || "";
    els.isActive.checked = true;
    els.serialNumber.focus();
  }

  async function toggleActive(id) {
    if (!isAdmin) return;
    const source = sources.find((item) => item.id === id);
    if (!source) return;

    if (apiMode) {
      const data = await apiRequest(`/api/sources/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !source.isActive })
      });
      sources = data.sources;
    } else {
      sources = sources.map((item) =>
        item.id === id ? { ...item, isActive: !item.isActive, updatedAt: new Date().toISOString() } : item
      );
      saveLocalSources();
    }
    render();
  }

  async function removeSource(id) {
    if (!isAdmin) return;
    const source = sources.find((item) => item.id === id);
    if (!source) return;
    const confirmed = window.confirm(`Delete source ${source.serialNumber}?`);
    if (!confirmed) return;

    if (apiMode) {
      const data = await apiRequest(`/api/sources/${encodeURIComponent(id)}`, { method: "DELETE" });
      sources = data.sources;
    } else {
      sources = sources.filter((item) => item.id !== id);
      saveLocalSources();
    }
    render();
  }

  function renderMetrics() {
    const activeSources = sources.filter((source) => source.isActive);
    els.activeCount.textContent = String(activeSources.length);
    els.irCount.textContent = String(activeSources.filter((source) => source.isotope === "Ir-192").length);
    els.coCount.textContent = String(activeSources.filter((source) => source.isotope === "Co-60").length);
  }

  function renderCalculatorSources() {
    const selected = els.calcSource.value;
    const activeSources = sources.filter((source) => source.isActive);

    els.calcSource.innerHTML = "";
    if (activeSources.length === 0) {
      const option = document.createElement("option");
      option.textContent = "Admin must add an active source first";
      option.value = "";
      els.calcSource.append(option);
      return;
    }

    activeSources.forEach((source) => {
      const option = document.createElement("option");
      option.value = source.id;
      option.textContent = `${source.isotope} | ${source.serialNumber} | ${source.containerNumber}`;
      els.calcSource.append(option);
    });

    if (activeSources.some((source) => source.id === selected)) {
      els.calcSource.value = selected;
    }
  }

  function renderCalculation() {
    const source = sources.find((item) => item.id === els.calcSource.value);
    if (!source) {
      els.currentStrength.textContent = "--";
      els.adjustedExposure.textContent = "--";
      els.exposureTime.textContent = "--";
      return;
    }

    const date = els.calculationDate.value || todayIso();
    const current = currentStrengthCi(source, date);
    const referenceDistanceMm = toMm(els.referenceDistance.value, els.referenceDistanceUnit.value);
    const actualDistanceMm = toMm(els.actualDistance.value, els.actualDistanceUnit.value);
    const adjusted = adjustedExposureCiMinutes(
      els.techniqueExposure.value,
      referenceDistanceMm,
      actualDistanceMm
    );
    const minutes = exposureTimeMinutes(
      source,
      els.techniqueExposure.value,
      referenceDistanceMm,
      actualDistanceMm,
      date
    );

    els.currentStrength.textContent = formatCi(current);
    els.adjustedExposure.textContent = `${adjusted.toFixed(adjusted >= 10 ? 1 : 2)} Ci min`;
    els.exposureTime.textContent = formatMinutes(minutes);
  }

  function renderHeightCalculation() {
    const resultUnit = els.heightResultUnit.value;
    const height = sourceHeight(
      els.heightDistance.value,
      els.exposureAngle.value,
      els.heightDistanceUnit.value,
      resultUnit
    );
    els.sourceHeight.textContent = formatDistance(height, resultUnit);
    els.heightAngleDisplay.textContent = `${Number(els.exposureAngle.value).toFixed(1)} deg`;
  }

  function sourceStatus(source) {
    if (!source.isActive) return { label: "Inactive", className: "inactive" };
    if (source.isotope === "Ir-192") {
      const age = daysBetween(source.strengthDate, todayIso());
      if (age >= ISOTOPES["Ir-192"].monthlyChangeDays) {
        return { label: "Change due", className: "warning" };
      }
    }
    return { label: "Active", className: "" };
  }

  function renderSources() {
    els.sourceList.innerHTML = "";

    if (sources.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No sources saved yet. An admin can unlock editing and add the current source.";
      els.sourceList.append(empty);
      return;
    }

    const sorted = [...sources].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.isotope.localeCompare(b.isotope) || a.serialNumber.localeCompare(b.serialNumber);
    });

    sorted.forEach((source) => {
      const current = currentStrengthCi(source, todayIso());
      const age = daysBetween(source.strengthDate, todayIso());
      const status = sourceStatus(source);
      const actions = isAdmin
        ? `<div class="card-actions">
            <button class="ghost-button" type="button" data-action="edit" data-id="${source.id}">Edit</button>
            <button class="ghost-button" type="button" data-action="duplicate" data-id="${source.id}">New monthly source</button>
            <button class="ghost-button" type="button" data-action="toggle" data-id="${source.id}">
              ${source.isActive ? "Mark inactive" : "Mark active"}
            </button>
            <button class="ghost-button danger-button" type="button" data-action="delete" data-id="${source.id}">Delete</button>
          </div>`
        : "";

      const card = document.createElement("article");
      card.className = `source-card${source.isActive ? "" : " inactive"}`;
      card.innerHTML = `
        <div class="source-card-header">
          <div>
            <h3>${escapeHtml(source.isotope)} source</h3>
            <span>${escapeHtml(source.serialNumber)}</span>
          </div>
          <span class="badge ${status.className}">${status.label}</span>
        </div>
        <dl class="source-details">
          <div><dt>Container</dt><dd>${escapeHtml(source.containerNumber)}</dd></div>
          <div><dt>Current</dt><dd class="source-current-strength">${formatCi(current)}</dd></div>
          <div><dt>Starting</dt><dd>${formatCi(Number(source.startStrength))}</dd></div>
          <div><dt>Age</dt><dd>${age.toFixed(0)} days</dd></div>
          <div><dt>Date</dt><dd>${escapeHtml(source.strengthDate)}</dd></div>
          <div><dt>Half-life</dt><dd>${ISOTOPES[source.isotope].halfLifeDays.toFixed(2)} days</dd></div>
        </dl>
        ${source.notes ? `<p>${escapeHtml(source.notes)}</p>` : ""}
        ${actions}
      `;
      els.sourceList.append(card);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function exportData() {
    if (!isAdmin) return;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), sources }, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gamma-calc-sources-${todayIso()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importData(event) {
    if (!isAdmin) return;
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const importedSources = Array.isArray(parsed) ? parsed : parsed.sources;
        if (!Array.isArray(importedSources)) throw new Error("No sources array");
        for (const importedSource of importedSources) {
          const source = {
            ...importedSource,
            id: importedSource.id || createId(),
            startStrength: Number(importedSource.startStrength),
            isActive: Boolean(importedSource.isActive)
          };
          if (apiMode) {
            const data = await apiRequest("/api/sources", {
              method: "POST",
              body: JSON.stringify({ source })
            });
            sources = data.sources;
          } else {
            const index = sources.findIndex((item) => item.id === source.id);
            if (index >= 0) sources[index] = source;
            else sources.push(source);
          }
        }
        if (!apiMode) saveLocalSources();
        render();
      } catch (_error) {
        window.alert("That file could not be imported. Please choose a Gamma Calc JSON export.");
      } finally {
        els.importInput.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function handleSourceListClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const { action, id } = button.dataset;
    if (action === "edit") editSource(id);
    if (action === "duplicate") duplicateSource(id);
    if (action === "toggle") await toggleActive(id);
    if (action === "delete") await removeSource(id);
  }

  async function login(event) {
    event.preventDefault();
    try {
      await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ password: els.adminPassword.value })
      });
      els.adminPassword.value = "";
      isAdmin = true;
      setMessage("Editing is unlocked for this browser session.");
      await loadAll();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function logout() {
    if (apiMode) {
      await apiRequest("/api/logout", { method: "POST" });
    }
    isAdmin = false;
    resetSourceForm();
    render();
  }

  async function changePassword(event) {
    event.preventDefault();
    if (!isAdmin || !apiMode) return;
    try {
      await apiRequest("/api/password", {
        method: "POST",
        body: JSON.stringify({ password: els.newAdminPassword.value })
      });
      els.newAdminPassword.value = "";
      setMessage("Admin password changed.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadAll() {
    try {
      const status = await apiRequest("/api/status");
      const data = await apiRequest("/api/sources");
      apiMode = true;
      isAdmin = status.mode === "admin";
      dataPath = status.dataPath || "";
      sources = data.sources || [];
    } catch (_error) {
      apiMode = false;
      sources = loadLocalSources();
    }
    render();
  }

  function render() {
    renderAdminState();
    renderMetrics();
    renderCalculatorSources();
    renderCalculation();
    renderHeightCalculation();
    renderSources();
  }

  function onValueChange(element, callback) {
    element.addEventListener("input", callback);
    element.addEventListener("change", callback);
  }

  els.loginForm.addEventListener("submit", login);
  els.logoutButton.addEventListener("click", logout);
  els.passwordForm.addEventListener("submit", changePassword);
  els.sourceForm.addEventListener("submit", (event) => {
    upsertSource(event).catch((error) => setMessage(error.message));
  });
  els.clearFormButton.addEventListener("click", resetSourceForm);
  els.sourceList.addEventListener("click", (event) => {
    handleSourceListClick(event).catch((error) => setMessage(error.message));
  });
  els.exportButton.addEventListener("click", exportData);
  els.importInput.addEventListener("change", importData);
  [
    els.calcSource,
    els.techniqueExposure,
    els.referenceDistance,
    els.referenceDistanceUnit,
    els.actualDistance,
    els.actualDistanceUnit,
    els.calculationDate
  ].forEach((element) => onValueChange(element, renderCalculation));
  [els.heightDistance, els.heightDistanceUnit, els.exposureAngle, els.heightResultUnit].forEach((element) =>
    onValueChange(element, renderHeightCalculation)
  );
  els.heightForm.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-angle]");
    if (!button) return;
    els.exposureAngle.value = button.dataset.angle;
    renderHeightCalculation();
  });

  els.strengthDate.value = todayIso();
  els.calculationDate.value = todayIso();
  resetSourceForm();
  loadAll();

  window.GammaCalc = {
    currentStrengthCi,
    adjustedExposureCiMinutes,
    exposureTimeMinutes,
    formatMinutes,
    sourceHeightMm,
    sourceHeight,
    toMm,
    fromMm,
    daysBetween,
    ISOTOPES
  };
})();
