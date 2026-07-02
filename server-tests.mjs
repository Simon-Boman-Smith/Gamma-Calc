import assert from "node:assert/strict";
import { normalizeSource } from "./server.mjs";

const normalized = normalizeSource({
  id: "source-1",
  isotope: "Ir-192",
  serialNumber: "SER-1",
  containerNumber: "CONT-1",
  startStrength: 100,
  strengthDate: "2026-01-01",
  returnedDate: "2026-02-01",
  notes: "Returned to supplier",
  isActive: false
});

assert.equal(normalized.returnedDate, "2026-02-01");
assert.equal(normalized.isActive, false);

console.log("Gamma Calc server tests passed.");
