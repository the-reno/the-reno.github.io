import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { measureWall, measureFloor } from "../docs/basement/model-metrics.mjs";
import {
  ROOM_GROUPS,
  OMITTED_WALLS,
  groupFloor,
} from "../docs/basement/room-groups.mjs";
import { insidePolygon } from "../docs/basement/data.mjs";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
const box = [];
for (const x of [-2, 2])
  for (const z of [-0.1, 0.1])
    for (const y of [0, 2.4])
      box.push([
        x * Math.cos(0.7) - z * Math.sin(0.7) + 3,
        y,
        x * Math.sin(0.7) + z * Math.cos(0.7) - 5,
      ]);
const wall = measureWall(box);
near(wall.length, 4);
near(wall.thickness, 0.2);
near(wall.height, 2.4);
near(Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]), 4);
const floor = measureFloor([
  {
    positions: [
      [0, 0, 0],
      [4, 0, 0],
      [4, 0, 3],
      [0, 0, 3],
      [0, -0.2, 0],
      [4, -0.2, 0],
      [4, -0.2, 3],
    ],
    indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 2, 1, 0],
  },
]);
near(floor.squareMeters, 12);
near(floor.position[0], 2);
near(floor.position[2], 1.5);
const gltf = JSON.parse(
  await readFile(new URL("../docs/basement/room.gltf", import.meta.url)),
);
const buffers = gltf.buffers.map((b) =>
  Buffer.from(b.uri.split(",")[1], "base64"),
);
function accessor(id) {
  const a = gltf.accessors[id],
    v = gltf.bufferViews[a.bufferView],
    buffer = buffers[v.buffer];
  const dims = { VEC3: 3, SCALAR: 1 }[a.type],
    bytes = { 5126: 4, 5123: 2, 5125: 4 }[a.componentType];
  const read = {
    5126: "readFloatLE",
    5123: "readUInt16LE",
    5125: "readUInt32LE",
  }[a.componentType];
  return Array.from({ length: a.count }, (_, i) =>
    Array.from({ length: dims }, (_, j) =>
      buffer[read](
        (v.byteOffset || 0) +
          (a.byteOffset || 0) +
          i * (v.byteStride || dims * bytes) +
          j * bytes,
      ),
    ),
  );
}
const entries = gltf.nodes
  .filter((n) => "mesh" in n)
  .map((n) => {
    const p = gltf.meshes[n.mesh].primitives[0];
    return {
      name: n.name,
      positions: accessor(p.attributes.POSITION),
      indices: accessor(p.indices).flat(),
    };
  });
const walls = entries
  .filter((e) => e.name.startsWith("wall_"))
  .map((e) => measureWall(e.positions));
assert.equal(walls.length, 22);
assert.ok(
  walls.every(
    (w) => w.length > 0.1 && w.length < 10 && w.height > 2 && w.height < 2.5,
  ),
);
const actual = measureFloor(entries.filter((e) => e.name.startsWith("floor_")));
near(actual.squareMeters, 79.39815231028437);
assert.equal(actual.triangles.length, 10);
console.log(
  `Model metric checks passed: rotated walls, length versus diagonal, floor-only faces, duplicate rejection; ${walls.length} walls and ${actual.squareMeters.toFixed(5)} m².`,
);

const identified = walls.map((wall, i) => ({
  ...wall,
  id: `W${String(i + 1).padStart(2, "0")}`,
}));
const active = identified.filter((wall) => !OMITTED_WALLS.has(wall.id));
assert.equal(active.length, 21);
assert.deepEqual(
  [...new Set(ROOM_GROUPS.flatMap((room) => room.walls))].sort(),
  active.map((wall) => wall.id).sort(),
);
const groups = groupFloor(actual, active);
near(
  groups.reduce((sum, group) => sum + group.squareMeters, 0),
  actual.squareMeters,
);
for (const group of groups) {
  assert.ok(group.squareMeters > 0);
  assert.ok(actual.triangles.some((tri) => insidePolygon(group.position, tri)));
  for (const tri of group.triangles) {
    // Every piece stays within the scan. No other room contains its interior.
    for (const point of tri)
      assert.ok(
        actual.triangles.some((source) => insidePolygon(point, source)),
      );
    const center = tri[0].map(
      (_, k) => (tri[0][k] + tri[1][k] + tri[2][k]) / 3,
    );
    for (const other of groups.filter((other) => other.id !== group.id))
      assert.ok(
        !other.triangles.some((t) => insidePolygon(center, t, false)),
        `${group.id} overlaps ${other.id}`,
      );
  }
}
// Independent side-room trapezoid area from its two opposite widths and depth.
const side = groups.find((group) => group.id === "side");
near(side.squareMeters, 3.1036072290124);
console.log(
  "Room group checks passed: 21 stable wall IDs, W10 omitted, three nonoverlapping scan partitions and preserved total area.",
);
