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

assert.equal(GammaCalc.ISOTOPES["Ir-192"].halfLifeDays, 73.82);
assert.equal(GammaCalc.ISOTOPES["Co-60"].halfLifeDays, 5.2714 * 365.25);
assert.equal(GammaCalc.daysBetween("2026-01-01", "2026-01-02"), 1);

const oneHalfLifeStrength = GammaCalc.currentStrengthCi(irSource, "2026-03-15");
assert.ok(Math.abs(oneHalfLifeStrength - 50.37) < 0.1);

assert.equal(GammaCalc.adjustedExposureCiMinutes(1200, 1200, 1200), 1200);
assert.equal(GammaCalc.adjustedExposureCiMinutes(1200, 1200, 2400), 4800);
assert.ok(Math.abs(GammaCalc.sourceHeightMm(1200, 45) - 848.53) < 0.1);
assert.ok(Math.abs(GammaCalc.sourceHeightMm(1200, 60) - 1039.23) < 0.1);

const minutes = GammaCalc.exposureTimeMinutes(
  { isotope: "Ir-192", startStrength: 100, strengthDate: "2026-01-01" },
  1200,
  1200,
  1200,
  "2026-01-01"
);
assert.equal(minutes, 12);

console.log("Gamma Calc calculation tests passed.");
