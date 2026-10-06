import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  VIEW_STORAGE_KEY,
  loadView,
  parseProjectLength,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  createData,
  validateData,
  validatePolygon,
  polygonArea,
  polygonsOverlap,
  distance,
  formatLength,
  formatArea,
  nextId,
  loadData,
  migrateLegacy,
} from "../docs/basement/data.mjs";
import {
  PRODUCTS,
  SQFT_PER_M2,
  CEILING_STORAGE_KEY,
  estimateCeiling,
  loadCeiling,
} from "../docs/basement/ceiling-data.mjs";

// Independent hand calculation: 30 boards, 2 screw boxes, 2 tape rolls,
// 3 compound pails, 4 sponges, 1 primer pail and 6 paint cans.
const ceiling = estimateCeiling(79.39815, 10);
assert.deepEqual(
  ceiling.items.map((item) => item.quantity),
  [30, 2, 2, 3, 4, 1, 6],
);
assert.equal(ceiling.totalCents, 95525);
assert.equal(estimateCeiling(320 / SQFT_PER_M2, 0).totalCents, 37692);
assert.equal(estimateCeiling(32 / SQFT_PER_M2, 0).items[0].quantity, 1);
for (const args of [
  [0, 10],
  [-1, 10],
  [NaN, 10],
  [3, -1],
  [3, 31],
  [3, Infinity],
])
  assert.throws(() => estimateCeiling(...args));
assert.deepEqual(loadCeiling({ getItem: () => "broken" }), {
  squareMeters: null,
  wastePercent: 10,
});
assert.deepEqual(
  loadCeiling({
    getItem: () => JSON.stringify({ squareMeters: -2, wastePercent: 10 }),
  }),
  { squareMeters: null, wastePercent: 10 },
);
assert.deepEqual(
  loadCeiling({
    getItem: (key) => {
      assert.equal(key, CEILING_STORAGE_KEY);
      return JSON.stringify({
        squareMeters: 30,
        wastePercent: 15,
        unwanted: true,
      });
    },
  }),
  { squareMeters: 30, wastePercent: 15 },
);
for (const product of PRODUCTS) {
  assert.ok(
    product.price > 0 && product.url.startsWith("https://www.homedepot.com/p/"),
  );
  assert.ok(product.priceSource.startsWith("https://www.homedepot.com/"));
  const photo = await readFile(
    new URL(`../docs/basement/${product.image}`, import.meta.url),
  );
  assert.deepEqual([...photo.subarray(0, 2)], [255, 216]);
}

const rect = (x, z, w, h) => [
  [x, 1, z],
  [x + w, 1, z],
  [x + w, 1, z + h],
  [x, 1, z + h],
];
assert.equal(distance([0, 0, 0], [0, 2, 0]), 2);
assert.equal(formatLength(0.3048), "1′ 0″");
assert.equal(formatLength(0.3039), "1′ 0″");
assert.equal(formatLength(86.5 * 0.0254), "7′ 2½″");
assert.equal(formatLength(2.1971, "metric"), "2.197 m");
assert.equal(formatArea(3, "metric"), "≈ 3 m²");
assert.equal(parseProjectLength("2′11″"), 35 * 0.0254);
assert.equal(parseProjectLength("unknown"), null);
const view = loadView({
  getItem: (key) => {
    assert.equal(key, VIEW_STORAGE_KEY);
    return JSON.stringify({
      units: "metric",
      source: "lighting",
      hidden: ["wall:W06", "wall:W06", "project:P6-01", "saved:M01", "bad"],
      visibility: { areas: false, comments: "invalid" },
    });
  },
});
assert.deepEqual(view, {
  units: "metric",
  source: "lighting",
  hidden: ["wall:W06", "project:P6-01", "saved:M01"],
  visibility: { measurements: true, areas: false, comments: true },
});
assert.equal(loadView({ getItem: () => "not-json" }).units, "imperial");
assert.equal(loadView().units, "imperial");
assert.equal(formatLength(0.125 * 0.0254), "0′ ⅛″");
assert.equal(formatArea(3), "≈ 32.3 ft²");
assert.equal(polygonArea(rect(0, 0, 3, 2)), 6);
assert.equal(validatePolygon(rect(0, 0, 3, 2)), 6);
assert.equal(polygonsOverlap(rect(0, 0, 2, 2), rect(2, 0, 2, 2)), false);
assert.equal(polygonsOverlap(rect(0, 0, 2, 2), rect(0, 0, 2, 2)), true);
assert.equal(polygonsOverlap(rect(0, 0, 2, 2), rect(1, 0, 2, 2)), true);
assert.equal(polygonsOverlap(rect(0, 0, 4, 4), rect(1, 1, 1, 1)), true);
assert.throws(
  () =>
    validatePolygon([
      [0, 1, 0],
      [2, 1, 2],
      [0, 1, 2],
      [2, 1, 0],
    ]),
  /crosses/,
);
assert.throws(
  () => validatePolygon(rect(1, 0, 2, 2), [{ points: rect(0, 0, 2, 2) }]),
  /overlaps/,
);
assert.throws(
  () =>
    validatePolygon([
      [0, 1, 0],
      [1, 1, 0],
      [2, 1, 0],
    ]),
  /small/,
);
const data = createData();
assert.equal(nextId(data, "comment"), "C01");
assert.equal(nextId(data, "measurement"), "M01");
assert.equal(nextId(data, "area"), "A1");
data.comments.push({
  id: "C01",
  position: [0, 0, 0],
  text: "<script>literal text</script>",
  resolved: true,
});
data.measurements.push({
  id: "M01",
  a: [0, 0, 0],
  b: [0, 2, 0],
  status: "SCAN",
  name: "Height",
});
data.areas.push({
  id: "A1",
  name: "",
  points: rect(0, 0, 2, 2),
  squareMeters: 999,
});
let restored = validateData(JSON.parse(JSON.stringify(data)));
assert.equal(restored.areas[0].squareMeters, 4);
assert.deepEqual(restored.measurements[0].position, [0, 1, 0]);
assert.equal(restored.measurements[0].status, "SCAN");
assert.equal(restored.comments[0].resolved, true);
assert.deepEqual(Object.keys(restored.comments[0]).sort(), [
  "id",
  "position",
  "resolved",
  "text",
]);
const endpoints = [restored.measurements[0].a, restored.measurements[0].b];
Object.assign(restored.measurements[0], {
  status: "VERIFIED",
  verifiedMeters: 86.5 * 0.0254,
  verifiedAt: "2026-10-05T00:00:00Z",
});
restored = validateData(restored);
assert.equal(formatLength(restored.measurements[0].verifiedMeters), "7′ 2½″");
assert.deepEqual(
  [restored.measurements[0].a, restored.measurements[0].b],
  endpoints,
);
restored.comments = [];
assert.equal(nextId(validateData(restored), "comment"), "C02");
const invalid = structuredClone(data);
invalid.model.id = "another-room";
assert.throws(() => validateData(invalid), /model/);
const duplicate = structuredClone(data);
duplicate.comments.push({ ...duplicate.comments[0] });
assert.throws(() => validateData(duplicate), /duplicate/);
const fakeVerified = structuredClone(data);
fakeVerified.measurements[0].status = "VERIFIED";
assert.throws(() => validateData(fakeVerified), /confirmed/);

// Legacy fields exist only in migration fixtures; they must never survive a V2 write.
const legacy = {
  ...structuredClone(restored),
  schemaVersion: 1,
  steps: [{ status: "Complete" }],
};
legacy.comments = [
  {
    id: "C03",
    position: [1, 2, 3],
    text: "Check pipe",
    category: "MOVE",
    step: 3,
    status: "DONE",
  },
];
legacy.measurements[0].step = 1;
legacy.areas[0].step = 4;
const migrated = migrateLegacy(legacy);
assert.deepEqual(migrated.comments[0], {
  id: "C03",
  position: [1, 2, 3],
  text: "Check pipe",
  resolved: false,
});
assert.deepEqual(migrated.measurements[0].a, legacy.measurements[0].a);
assert.equal(
  migrated.measurements[0].verifiedMeters,
  legacy.measurements[0].verifiedMeters,
);
for (const value of [
  migrated,
  ...migrated.comments,
  ...migrated.measurements,
  ...migrated.areas,
]) {
  for (const key of ["step", "steps", "category", "priority"])
    assert.equal(key in value, false);
}
function memory(initial = {}) {
  const values = new Map(Object.entries(initial)),
    writes = [];
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(key);
      values.set(key, value);
    },
    values,
    writes,
  };
}
const original = JSON.stringify(legacy),
  storage = memory({ [LEGACY_STORAGE_KEY]: original });
assert.deepEqual(loadData(storage).data, migrated);
assert.equal(storage.getItem(LEGACY_STORAGE_KEY), original);
assert.deepEqual(storage.writes, [STORAGE_KEY]);
loadData(storage);
assert.deepEqual(storage.writes, [STORAGE_KEY]); // migration runs exactly once
const both = memory({
  [STORAGE_KEY]: JSON.stringify(data),
  [LEGACY_STORAGE_KEY]: original,
});
assert.deepEqual(loadData(both).data, validateData(data));
assert.deepEqual(both.writes, []);
const corrupt = memory({
  [STORAGE_KEY]: "broken-json",
  [LEGACY_STORAGE_KEY]: original,
});
assert.equal(loadData(corrupt).writable, false);
assert.equal(corrupt.getItem(STORAGE_KEY), "broken-json");
assert.deepEqual(corrupt.writes, []);
assert.equal(loadData(undefined).writable, false);
const blocked = {
  getItem: (key) => (key === LEGACY_STORAGE_KEY ? original : null),
  setItem: () => {
    throw new Error("blocked");
  },
};
assert.deepEqual(loadData(blocked).data, migrated);
assert.equal(loadData(blocked).writable, false);
const poisoned = { ...structuredClone(data), workflow: true };
poisoned.comments[0].category = "GENERAL";
assert.deepEqual(validateData(poisoned), validateData(data));

// The model is byte-for-byte the existing self-contained KIRI asset.
const modelBytes = await readFile(
  new URL("../docs/basement/room.gltf", import.meta.url),
);
const blob = createHash("sha1")
  .update(`blob ${modelBytes.length}\0`)
  .update(modelBytes)
  .digest("hex");
assert.equal(blob, "5e6b473d4e7a2bdf0ed78af18d80fe12a76feb0b");
const model = JSON.parse(modelBytes);
assert.ok(model.meshes.length > 0);
for (const dependency of [...(model.buffers || []), ...(model.images || [])]) {
  assert.ok(
    !dependency.uri || dependency.uri.startsWith("data:"),
    "Model dependencies must remain embedded.",
  );
}
for (const name of [
  "existing-plan.png",
  "proposed-layout.png",
  "lighting-sheet.png",
  "lighting-plan.png",
]) {
  const image = await readFile(
    new URL(`../docs/basement/${name}`, import.meta.url),
  );
  assert.equal(image.subarray(1, 4).toString(), "PNG");
}
await assert.rejects(
  readFile(new URL("../docs/basement/project.pdf", import.meta.url)),
  { code: "ENOENT" },
);
console.log(
  "Basement data checks passed: geometry, fractional units, provenance, clean migration, persistence protection, unchanged model and image-only references.",
);
