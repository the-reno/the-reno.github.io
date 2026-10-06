export const STORAGE_KEY = "ronu.basement.simple.v2";
export const LEGACY_STORAGE_KEY = "ronu.basement.execution.v1";
export const MODEL_ID = "kiri-room3-shell-v1";
export const M2_TO_FT2 = 10.7639104167;
export const INCH_TO_M = 0.0254;
export const VIEW_STORAGE_KEY = "ronu.basement.view.v2";
const EPS = 1e-6;

export function loadView(storage) {
  const result = {
    units: "imperial",
    source: "model",
    shown: [],
    visibility: { measurements: false, areas: false },
  };
  try {
    const raw = JSON.parse(storage.getItem(VIEW_STORAGE_KEY));
    // Keep unit/source choices, but start the new opt-in display with Hide all.
    const previous =
      raw || JSON.parse(storage.getItem("ronu.basement.view.v1"));
    if (previous?.units === "metric") result.units = "metric";
    if (previous?.source === "lighting") result.source = "lighting";
    if (Array.isArray(raw?.shown))
      result.shown = [
        ...new Set(
          raw.shown
            .filter(
              (id) =>
                typeof id === "string" &&
                id !== "wall:W10" &&
                /^(wall:W\d+|project:P6-\d+|saved:M\d+)$/.test(id),
            )
            .slice(0, 2000),
        ),
      ];
    for (const key of Object.keys(result.visibility)) {
      if (typeof raw?.visibility?.[key] === "boolean")
        result.visibility[key] = raw.visibility[key];
    }
  } catch {
    /* View preferences are optional; annotations remain separate. */
  }
  return result;
}

// Convert the printed source value, never its approximately placed endpoints.
export function parseProjectLength(value) {
  const match = /^(\d+)\s*′\s*(\d+(?:\.\d+)?)\s*″$/.exec(value);
  return match ? (Number(match[1]) * 12 + Number(match[2])) * INCH_TO_M : null;
}

export function createData() {
  return {
    schemaVersion: 2,
    model: { id: MODEL_ID, url: "./room.gltf", units: "meters", upAxis: "Y" },
    measurements: [],
    areas: [],
    comments: [],
    counters: { comment: 0, measurement: 0, area: 0 },
  };
}

export const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
export const polygonCenter = (points) =>
  points.reduce(
    (sum, point) => sum.map((value, i) => value + point[i] / points.length),
    [0, 0, 0],
  );
export function polygonArea(points) {
  return (
    Math.abs(
      points.reduce((sum, point, i) => {
        const next = points[(i + 1) % points.length];
        return sum + point[0] * next[2] - next[0] * point[2];
      }, 0),
    ) / 2
  );
}
export function formatLength(meters, units = "imperial") {
  if (units === "metric")
    return `${meters.toLocaleString("en-US", { maximumFractionDigits: 3 })} m`;
  const eighths = Math.round((meters / INCH_TO_M) * 8);
  const feet = Math.floor(eighths / 96);
  const remainder = eighths % 96;
  const inches = Math.floor(remainder / 8);
  const fraction = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"][remainder % 8];
  return `${feet}′ ${inches || !fraction ? inches : ""}${fraction}″`;
}
export const formatArea = (squareMeters, units = "imperial") =>
  `≈ ${(units === "metric"
    ? squareMeters
    : squareMeters * M2_TO_FT2
  ).toLocaleString("en-US", {
    maximumFractionDigits: units === "metric" ? 2 : 1,
  })} ${units === "metric" ? "m²" : "ft²"}`;
export function commentNumber(id) {
  const number = Number(id.slice(1));
  return number >= 1 && number <= 20
    ? String.fromCodePoint(0x2460 + number - 1)
    : `(${number})`;
}
export function nextId(data, type) {
  const prefix = { comment: "C", measurement: "M", area: "A" }[type];
  const number = ++data.counters[type];
  return prefix + (type === "area" ? number : String(number).padStart(2, "0"));
}

const cross = (a, b, c) =>
  (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
function onSegment(a, b, point) {
  return (
    Math.abs(cross(a, b, point)) < EPS &&
    point[0] >= Math.min(a[0], b[0]) - EPS &&
    point[0] <= Math.max(a[0], b[0]) + EPS &&
    point[2] >= Math.min(a[2], b[2]) - EPS &&
    point[2] <= Math.max(a[2], b[2]) + EPS
  );
}
function segmentsMeet(a, b, c, d, proper = false) {
  const ac = cross(a, b, c),
    ad = cross(a, b, d),
    ca = cross(c, d, a),
    cb = cross(c, d, b);
  if (
    ((ac > EPS && ad < -EPS) || (ac < -EPS && ad > EPS)) &&
    ((ca > EPS && cb < -EPS) || (ca < -EPS && cb > EPS))
  )
    return true;
  return (
    !proper &&
    (onSegment(a, b, c) ||
      onSegment(a, b, d) ||
      onSegment(c, d, a) ||
      onSegment(c, d, b))
  );
}
export function insidePolygon(point, points, includeBoundary = true) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (onSegment(a, b, point)) return includeBoundary;
    if (
      a[2] > point[2] !== b[2] > point[2] &&
      point[0] < ((b[0] - a[0]) * (point[2] - a[2])) / (b[2] - a[2]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function polygonsOverlap(a, b) {
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      if (
        segmentsMeet(
          a[i],
          a[(i + 1) % a.length],
          b[j],
          b[(j + 1) % b.length],
          true,
        )
      )
        return true;
    }
  for (const [points, other] of [
    [a, b],
    [b, a],
  ]) {
    for (let i = 0; i < points.length; i++) {
      if (insidePolygon(points[i], other, false)) return true;
      const next = points[(i + 1) % points.length];
      const mid = points[i].map((value, k) => (value + next[k]) / 2);
      if (insidePolygon(mid, other, false)) return true;
      const dx = next[0] - points[i][0],
        dz = next[2] - points[i][2];
      for (const sign of [-1, 1]) {
        const test = [
          mid[0] + sign * dz * 1e-4,
          mid[1],
          mid[2] - sign * dx * 1e-4,
        ];
        if (
          insidePolygon(test, points, false) &&
          insidePolygon(test, other, false)
        )
          return true;
      }
    }
  }
  return false;
}
export function validatePolygon(points, otherAreas = []) {
  if (points.length < 3) throw new Error("Add at least three corners.");
  if (points.length > 100) throw new Error("Use at most 100 corners per area.");
  for (let i = 0; i < points.length; i++) {
    if (distance(points[i], points[(i + 1) % points.length]) < 0.01)
      throw new Error("Keep corners at least 1 cm apart.");
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (
        segmentsMeet(
          points[i],
          points[(i + 1) % points.length],
          points[j],
          points[(j + 1) % points.length],
        )
      ) {
        throw new Error(
          "The outline crosses itself. Undo a corner and try again.",
        );
      }
    }
  }
  if (polygonArea(points) < 0.01) throw new Error("The area is too small.");
  if (points.some((point) => Math.abs(point[1] - points[0][1]) > EPS))
    throw new Error("Use one horizontal plane.");
  if (otherAreas.some((area) => polygonsOverlap(points, area.points))) {
    throw new Error(
      "This overlaps another area. Keep outlines separate for an accurate total.",
    );
  }
  return polygonArea(points);
}

// Construct only the current schema; unknown fields are never copied into it.
export function validateData(raw) {
  if (
    !raw ||
    raw.schemaVersion !== 2 ||
    raw.model?.id !== MODEL_ID ||
    raw.model.units !== "meters" ||
    raw.model.upAxis !== "Y"
  )
    throw new Error("Different basement model.");
  const result = createData(),
    ids = new Set();
  function point(value) {
    if (
      !Array.isArray(value) ||
      value.length !== 3 ||
      value.some(
        (n) =>
          typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) >= 1000,
      )
    )
      throw new Error("Invalid 3D position.");
    return [...value];
  }
  function name(value) {
    if (value === undefined) return "";
    if (typeof value !== "string" || value.length > 80)
      throw new Error("Invalid name.");
    return value;
  }
  function checkId(id, prefix) {
    if (
      typeof id !== "string" ||
      !new RegExp(`^${prefix}[0-9]{1,8}$`).test(id) ||
      ids.has(id)
    ) {
      throw new Error("Invalid or duplicate ID.");
    }
    ids.add(id);
    return id;
  }
  for (const key of ["comments", "measurements", "areas"]) {
    if (!Array.isArray(raw[key]) || raw[key].length > 1000)
      throw new Error("Invalid annotation list.");
  }
  for (const comment of raw.comments) {
    if (
      !comment ||
      typeof comment.text !== "string" ||
      comment.text.length > 5000 ||
      (comment.resolved !== undefined && typeof comment.resolved !== "boolean")
    )
      throw new Error("Invalid comment.");
    result.comments.push({
      id: checkId(comment.id, "C"),
      position: point(comment.position),
      text: comment.text,
      resolved: comment.resolved ?? false,
    });
  }
  for (const measurement of raw.measurements) {
    if (!measurement || !["SCAN", "VERIFIED"].includes(measurement.status))
      throw new Error("Invalid measurement.");
    const item = {
      id: checkId(measurement.id, "M"),
      name: name(measurement.name),
      a: point(measurement.a),
      b: point(measurement.b),
      status: measurement.status,
    };
    if (distance(item.a, item.b) < 0.001)
      throw new Error("Measurement points coincide.");
    item.position = polygonCenter([item.a, item.b]);
    if (item.status === "VERIFIED") {
      if (
        !Number.isFinite(measurement.verifiedMeters) ||
        measurement.verifiedMeters <= 0 ||
        measurement.verifiedMeters > 1000 ||
        typeof measurement.verifiedAt !== "string" ||
        !Number.isFinite(Date.parse(measurement.verifiedAt))
      )
        throw new Error("Invalid confirmed length.");
      item.verifiedMeters = measurement.verifiedMeters;
      item.verifiedAt = measurement.verifiedAt;
    }
    result.measurements.push(item);
  }
  for (const area of raw.areas) {
    if (!area || !Array.isArray(area.points)) throw new Error("Invalid area.");
    const item = {
      id: checkId(area.id, "A"),
      name: name(area.name),
      points: area.points.map(point),
    };
    item.squareMeters = validatePolygon(item.points, result.areas);
    item.position = polygonCenter(item.points);
    result.areas.push(item);
  }
  for (const [type, items] of [
    ["comment", result.comments],
    ["measurement", result.measurements],
    ["area", result.areas],
  ]) {
    const highest = Math.max(
      0,
      ...items.map((item) => Number(item.id.slice(1))),
    );
    const old = raw.counters?.[type];
    result.counters[type] = Math.max(
      highest,
      Number.isSafeInteger(old) && old >= 0 && old < 1e8 ? old : 0,
    );
  }
  return result;
}

export function migrateLegacy(raw) {
  if (raw?.schemaVersion !== 1 || raw.model?.id !== MODEL_ID)
    throw new Error("Different saved model.");
  const result = createData();
  result.counters = raw.counters;
  result.measurements = (raw.measurements || []).map((item) => ({
    id: item.id,
    name: item.name,
    a: item.a,
    b: item.b,
    status: item.status,
    verifiedMeters: item.verifiedMeters,
    verifiedAt: item.verifiedAt,
  }));
  result.areas = (raw.areas || []).map((item) => ({
    id: item.id,
    name: item.name,
    points: item.points,
  }));
  result.comments = (raw.comments || []).map((item) => ({
    id: item.id,
    position: item.position,
    text: item.text,
    resolved: false,
  }));
  return validateData(result);
}

export function loadData(storage) {
  try {
    const current = storage.getItem(STORAGE_KEY);
    if (current !== null) {
      try {
        return { data: validateData(JSON.parse(current)), writable: true };
      } catch {
        return {
          data: createData(),
          writable: false,
          message: "Saved notes could not be read. The original data was kept.",
        };
      }
    }
    const previous = storage.getItem(LEGACY_STORAGE_KEY);
    if (previous === null) return { data: createData(), writable: true };
    let migrated;
    try {
      migrated = migrateLegacy(JSON.parse(previous));
    } catch {
      return {
        data: createData(),
        writable: true,
        message:
          "Earlier notes could not be restored. The original data was kept.",
      };
    }
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return {
        data: migrated,
        writable: true,
        message: "Earlier measurements and notes restored.",
      };
    } catch {
      return {
        data: migrated,
        writable: false,
        message: "Browser saving is unavailable. Earlier data was kept.",
      };
    }
  } catch {
    return {
      data: createData(),
      writable: false,
      message: "Browser saving is unavailable.",
    };
  }
}
