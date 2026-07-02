import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const appSource = readFileSync(new URL("./app.js", import.meta.url), "utf8");

const elements = new Map();
const makeElement = (id) => ({
  id,
  value: "",
  checked: false,
  hidden: false,
  textContent: "",
  innerHTML: "",
  dataset: {},
  className: "",
  classList: {
    toggle() {}
  },
  addEventListener() {},
  append() {},
  focus() {},
  reset() {}
});

const context = {
  console,
  localStorage: {
    getItem() {
      return "[]";
    },
    setItem() {}
  },
  document: {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    createElement() {
      return makeElement("created");
    },
    querySelectorAll() {
      return [];
    }
  },
  window: {
    GammaCalc: null,
    alert() {},
    confirm() {
      return true;
    }
  },
  crypto: {
    randomUUID() {
      return "test-id";
    }
  },
  Date,
  Blob,
  URL
};

vm.createContext(context);
vm.runInContext(appSource, context);

const { GammaCalc } = context.window;

const irSource = {
  isotope: "Ir-192",
  startStrength: 100,
  strengthDate: "2026-01-01"
};
const activeSource = {
  id: "active",
  isActive: true,
  isotope: "Ir-192",
  serialNumber: "A",
  containerNumber: "C1",
  startStrength: 100,
  strengthDate: "2026-01-01",
  notes: "Ready"
};
const inactiveSource = {
  id: "inactive",
  isActive: false,
  isotope: "Ir-192",
  serialNumber: "B",
  containerNumber: "C2",
  startStrength: 80,
  strengthDate: "2026-01-01",
  notes: "Old, store"
};

assert.equal(GammaCalc.ISOTOPES["Ir-192"].halfLifeDays, 73.82);
assert.equal(GammaCalc.ISOTOPES["Co-60"].halfLifeDays, 5.2714 * 365.25);
assert.equal(GammaCalc.daysBetween("2026-01-01", "2026-01-02"), 1);

const oneHalfLifeStrength = GammaCalc.currentStrengthCi(irSource, "2026-03-15");
assert.ok(Math.abs(oneHalfLifeStrength - 50.37) < 0.1);

assert.equal(GammaCalc.adjustedExposureCiMinutes(1200, 1200, 1200), 1200);
assert.equal(GammaCalc.adjustedExposureCiMinutes(1200, 1200, 2400), 4800);
assert.equal(GammaCalc.toMm(1, "in"), 25.4);
assert.equal(GammaCalc.fromMm(25.4, "in"), 1);
assert.ok(Math.abs(GammaCalc.adjustedExposureCiMinutes(1200, 1200, GammaCalc.toMm(47.2440944882, "in")) - 1200) < 0.01);
assert.ok(Math.abs(GammaCalc.sourceHeightMm(1200, 45) - 848.53) < 0.1);
assert.ok(Math.abs(GammaCalc.sourceHeightMm(1200, 60) - 1039.23) < 0.1);
assert.ok(Math.abs(GammaCalc.sourceHeight(47.2440944882, 45, "in", "in") - 33.41) < 0.01);
assert.equal(GammaCalc.formatMinutes(26.7), "26 mins 42 secs");
assert.equal(GammaCalc.formatMinutes(1 + 1 / 60), "1 min 01 sec");
assert.equal(GammaCalc.formatMinutes(0.5), "30 secs");
assert.deepEqual(GammaCalc.visibleSourcesForMode([activeSource, inactiveSource], false), [activeSource]);
assert.deepEqual(GammaCalc.visibleSourcesForMode([activeSource, inactiveSource], true), [activeSource, inactiveSource]);
assert.equal(
  GammaCalc.inventoryExportRows([inactiveSource, activeSource], "2026-01-01").map((row) => row.status).join("|"),
  "Active|Inactive"
);
assert.ok(GammaCalc.inventoryCsv([inactiveSource], "2026-01-01").includes('"Old, store"'));

const minutes = GammaCalc.exposureTimeMinutes(
  { isotope: "Ir-192", startStrength: 100, strengthDate: "2026-01-01" },
  1200,
  1200,
  1200,
  "2026-01-01"
);
assert.equal(minutes, 12);

console.log("Gamma Calc calculation tests passed.");
