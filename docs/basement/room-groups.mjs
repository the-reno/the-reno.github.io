// The three spaces selected in the reference screenshots. Shared boundary walls
// belong to both adjacent rooms; wall IDs stay tied to the original glTF order.
export const OMITTED_WALLS = new Set(["W10"]);
export const ROOM_GROUPS = [
  {
    id: "main",
    name: "Main room",
    color: "#255d77",
    walls: [
      "W01",
      "W02",
      "W08",
      "W09",
      "W12",
      "W14",
      "W17",
      "W19",
      "W20",
      "W21",
      "W22",
    ],
  },
  {
    id: "rear",
    name: "Rear room",
    color: "#ad5420",
    walls: [
      "W04",
      "W05",
      "W06",
      "W07",
      "W08",
      "W09",
      "W13",
      "W18",
      "W20",
      "W22",
    ],
  },
  {
    id: "side",
    name: "Side room",
    color: "#397253",
    walls: ["W03", "W11", "W15", "W16", "W17"],
  },
];

// Clip scan triangles rather than multiplying wall lengths or drawing a guessed
// bounding rectangle. These partitions include wall/stair footprints, like the
// original scan total. They are approximate room references, not net floor area.
function clip(points, signedDistance, positive) {
  if (!points.length) return [];
  const output = [];
  const score = (point) => signedDistance(point) * (positive ? 1 : -1);
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const sa = score(a),
      sb = score(b);
    if (sa >= 0) output.push(a);
    if (sa >= 0 !== sb >= 0) {
      const t = sa / (sa - sb);
      output.push(a.map((value, k) => value + (b[k] - value) * t));
    }
  }
  return output;
}
function triangles(points) {
  const result = [];
  for (let i = 1; i + 1 < points.length; i++) {
    const tri = [points[0], points[i], points[i + 1]];
    if (triangleArea(tri) > 1e-10) result.push(tri);
  }
  return result;
}
function triangleArea([a, b, c]) {
  return (
    Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])) / 2
  );
}
export function groupFloor(floor, walls) {
  const wall = (id) => {
    const result = walls.find((item) => item.id === id);
    if (!result) throw new Error(`Missing room boundary ${id}`);
    return result;
  };
  const midX = (id) => {
    const w = wall(id);
    return (w.a[0] + w.b[0]) / 2;
  };
  const above = (id) => {
    const { a, b } = wall(id);
    return (p) =>
      p[2] - (a[1] + ((p[0] - a[0]) * (b[1] - a[1])) / (b[0] - a[0]));
  };
  const right = (id) => {
    const { a, b } = wall(id);
    return (p) =>
      p[0] - (a[0] + ((p[2] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
  };
  const sideBoundary = right("W17"),
    rearEdge = right("W13");
  const firstJoint = midX("W09"),
    secondJoint = midX("W18");
  const bands = [
    { min: -Infinity, max: firstJoint, front: above("W22") },
    { min: firstJoint, max: secondJoint, front: above("W19") },
    { min: secondJoint, max: Infinity, front: above("W20") },
  ];
  const pieces = { main: [], rear: [], side: [] };
  const add = (id, points) => pieces[id].push(...triangles(points));
  for (const tri of floor.triangles) {
    add("side", clip(tri, sideBoundary, true));
    const rest = clip(tri, sideBoundary, false);
    add("main", clip(rest, rearEdge, true));
    const candidate = clip(rest, rearEdge, false);
    for (const band of bands) {
      let part = candidate;
      if (Number.isFinite(band.min))
        part = clip(part, (p) => p[0] - band.min, true);
      if (Number.isFinite(band.max))
        part = clip(part, (p) => p[0] - band.max, false);
      add("rear", clip(part, band.front, true));
      add("main", clip(part, band.front, false));
    }
  }
  return ROOM_GROUPS.map((group) => {
    let squareMeters = 0,
      weighted = [0, 0, 0];
    for (const tri of pieces[group.id]) {
      const area = triangleArea(tri);
      squareMeters += area;
      weighted = weighted.map(
        (value, k) => value + (area * (tri[0][k] + tri[1][k] + tri[2][k])) / 3,
      );
    }
    if (squareMeters <= 0) throw new Error(`Empty room ${group.id}`);
    return {
      ...group,
      squareMeters,
      position: weighted.map((v) => v / squareMeters),
      triangles: pieces[group.id],
    };
  });
}
