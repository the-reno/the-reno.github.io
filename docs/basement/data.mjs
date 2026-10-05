export const STORAGE_KEY = 'ronu.basement.simple.v2';
export const MODEL_ID = 'kiri-room3-shell-v1';
export const M2_TO_FT2 = 10.7639104167;
export const INCH_TO_M = .0254;
const EPS = 1e-6;
export const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
export const polygonArea = points => Math.abs(points.reduce((s, p, i) => {
  const q = points[(i + 1) % points.length]; return s + p[0] * q[2] - q[0] * p[2];
}, 0)) / 2;
export const polygonCenter = points => points.reduce((s, p) => s.map((v, i) => v + p[i] / points.length), [0, 0, 0]);
export function formatLength(meters) {
  const eighths = Math.round(meters / INCH_TO_M * 8), feet = Math.floor(eighths / 96);
  const inches = (eighths % 96) / 8;
  return `${feet}′ ${inches}″`;
}
export function nextId(data, type) {
  const prefix = {comment: 'C', measurement: 'M', area: 'A'}[type];
  const n = ++data.counters[type]; return prefix + (type === 'area' ? n : String(n).padStart(2, '0'));
}
const cross = (a, b, c) => (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
const onSegment = (a, b, p) => Math.abs(cross(a, b, p)) < EPS && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS && p[2] >= Math.min(a[2], b[2]) - EPS && p[2] <= Math.max(a[2], b[2]) + EPS;
function segmentsMeet(a, b, c, d, proper = false) {
  const ac = cross(a, b, c), ad = cross(a, b, d), ca = cross(c, d, a), cb = cross(c, d, b);
  if (ac * ad < -EPS && ca * cb < -EPS) return true;
  return !proper && (onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b));
}
export function insidePolygon(point, points, includeBoundary = true) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if (onSegment(a, b, point)) return includeBoundary;
    if ((a[2] > point[2]) !== (b[2] > point[2]) && point[0] < (b[0] - a[0]) * (point[2] - a[2]) / (b[2] - a[2]) + a[0]) inside = !inside;
  }
  return inside;
}
export function polygonsOverlap(a, b) {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    if (segmentsMeet(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length], true)) return true;
  }
  for (const [p, q] of [[a, b], [b, a]]) {
    for (let i = 0; i < p.length; i++) {
      if (insidePolygon(p[i], q, false)) return true;
      const mid = p[i].map((v, k) => (v + p[(i + 1) % p.length][k]) / 2);
      if (insidePolygon(mid, q, false)) return true;
    }
  }
  return false;
}
export function validatePolygon(points, otherAreas = []) {
  if (points.length < 3) throw new Error('Add at least three corners.');
  if (points.length > 100) throw new Error('Use at most 100 corners per area.');
  for (let i = 0; i < points.length; i++) {
    if (distance(points[i], points[(i + 1) % points.length]) < .01) throw new Error('Keep corners at least 1 cm apart.');
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (segmentsMeet(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length])) throw new Error('The outline crosses itself.');
    }
  }
  if (polygonArea(points) < .01) throw new Error('The area is too small.');
  if (points.some(p => Math.abs(p[1] - points[0][1]) > EPS)) throw new Error('Area corners must be on the same horizontal plane.');
  if (otherAreas.some(a => polygonsOverlap(points, a.points))) throw new Error('This overlaps another area.');
  return polygonArea(points);
}
export function validateData(raw) {
  if (!raw || raw.schemaVersion !== 2 || raw.model?.id !== MODEL_ID || raw.model.units !== 'meters' || raw.model.upAxis !== 'Y') throw new Error('This file is not for this basement model.');
  const d = structuredClone(raw), ids = new Set();
  const point = p => Array.isArray(p) && p.length === 3 && p.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1000);
  const string = (s, max) => typeof s === 'string' && s.length <= max;
  const checkId = (id, prefix) => {
    if (!new RegExp(`^${prefix}[0-9]{1,8}$`).test(id) || ids.has(id)) throw new Error('Invalid or duplicate item ID.');
    ids.add(id);
  };
  for (const key of ['measurements', 'areas', 'comments']) if (!Array.isArray(d[key]) || d[key].length > 1000) throw new Error('Invalid item list.');
  for (const c of d.comments) {
    checkId(c.id, 'C');
    if (!point(c.position) || !string(c.text, 5000)) throw new Error('Invalid comment.');
    c.resolved = Boolean(c.resolved);
  }
  for (const m of d.measurements) {
    checkId(m.id, 'M');
    if (!point(m.a) || !point(m.b) || !string(m.name, 80) || !['SCAN', 'VERIFIED'].includes(m.status) || distance(m.a, m.b) < .001) throw new Error('Invalid measurement.');
    if (m.status === 'VERIFIED' && (!Number.isFinite(m.verifiedMeters) || m.verifiedMeters <= 0 || m.verifiedMeters > 1000 || !string(m.verifiedAt, 80))) throw new Error('Invalid confirmed length.');
    m.position = m.a.map((v, i) => (v + m.b[i]) / 2);
  }
  const checked = [];
  for (const a of d.areas) {
    checkId(a.id, 'A');
    if (!string(a.name, 80) || !Array.isArray(a.points) || !a.points.every(point)) throw new Error('Invalid area.');
    a.squareMeters = validatePolygon(a.points, checked); a.position = polygonCenter(a.points); checked.push(a);
  }
  d.model = {id: MODEL_ID, url: './room.gltf', units: 'meters', upAxis: 'Y'};
  d.counters = Object.fromEntries(['comment', 'measurement', 'area'].map((type, i) => {
    const items = d[['comments', 'measurements', 'areas'][i]];
    const max = Math.max(0, ...items.map(x => Number(x.id.slice(1))));
    const old = raw.counters?.[type];
    return [type, Math.max(max, Number.isSafeInteger(old) && old >= 0 && old < 1e8 ? old : 0)];
  }));
  return d;
}
