import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { measureWall, measureFloor } from "./model-metrics.mjs?v=4";

export async function createViewer(host, onTap) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeeede9);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.screenSpacePanning = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8b81, 2));
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(5, 10, 7);
  scene.add(light);
  const gltf = await new GLTFLoader().loadAsync("./room.gltf");
  const model = gltf.scene;
  scene.add(model);
  const meshes = [],
    floors = [],
    wallBox = new THREE.Box3();
  model.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    if (o.name.startsWith("floor_")) floors.push(o);
    if (o.name.startsWith("wall_")) wallBox.expandByObject(o);
    o.geometry.computeVertexNormals();
    o.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(o.geometry, 30),
        new THREE.LineBasicMaterial({
          color: 0x77786f,
          transparent: true,
          opacity: 0.4,
        }),
      ),
    );
  });
  const box = new THREE.Box3().setFromObject(model),
    center = box.getCenter(new THREE.Vector3()),
    size = box.getSize(new THREE.Vector3());
  if (box.isEmpty() || !Number.isFinite(size.length()) || size.length() === 0)
    throw new Error("Empty model");
  const radius = size.length() / 2,
    ceilingY = (wallBox.isEmpty() ? box.max.y : wallBox.max.y) + 0.025;
  model.updateMatrixWorld(true);
  const geometry = (mesh) => {
    const attribute = mesh.geometry.getAttribute("position");
    const positions = Array.from({ length: attribute.count }, (_, i) =>
      new THREE.Vector3()
        .fromBufferAttribute(attribute, i)
        .applyMatrix4(mesh.matrixWorld)
        .toArray(),
    );
    return {
      positions,
      indices: mesh.geometry.index
        ? Array.from(mesh.geometry.index.array)
        : null,
    };
  };
  let metrics = null;
  try {
    metrics = {
      floor: measureFloor(floors.map(geometry)),
      walls: meshes
        .filter((m) => m.name.startsWith("wall_"))
        .map((m, i) => ({
          ...measureWall(geometry(m).positions),
          source: m.name,
          id: `W${String(i + 1).padStart(2, "0")}`,
        })),
    };
  } catch (error) {
    console.warn("Model measurements unavailable:", error);
  }
  camera.near = radius / 1000;
  camera.far = radius * 100;
  controls.minDistance = radius * 0.025;
  controls.maxDistance = radius * 12;
  const ray = new THREE.Raycaster(),
    downRay = new THREE.Raycaster();
  const ceilingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ceilingY);
  const annotations = new THREE.Group(),
    draft = new THREE.Group();
  scene.add(annotations, draft);
  const labels = document.querySelector("#labels");
  let labelItems = [],
    cameraMode = "three",
    drawMode = "navigate";
  const svgNS = "http://www.w3.org/2000/svg",
    leaders = document.createElementNS(svgNS, "svg");
  leaders.classList.add("label-leaders");
  leaders.setAttribute("aria-hidden", "true");
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();
  function fit(next = "three") {
    // Flush residual damping on the old camera before installing the fitted view.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    cameraMode = next;
    controls.target.copy(center);
    camera.up.set(0, 1, 0);
    const halfFov = Math.atan(
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
        Math.min(camera.aspect, 1),
    );
    const dist = (radius / Math.sin(halfFov)) * 1.15;
    camera.position
      .copy(center)
      .add(
        new THREE.Vector3(...(next === "top" ? [0, 1, 0.00001] : [1, 0.85, 1]))
          .normalize()
          .multiplyScalar(dist),
      );
    camera.updateProjectionMatrix();
    controls.update();
    controls.enableDamping = damping;
    document
      .querySelector("#top")
      .setAttribute("aria-pressed", String(next === "top"));
    document
      .querySelector("#three")
      .setAttribute("aria-pressed", String(next === "three"));
  }
  fit();
  function clear(group) {
    group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) for (const m of [o.material].flat()) m.dispose();
    });
    group.clear();
  }
  function line(group, points, color, close = false) {
    const pts = points.map((p) => new THREE.Vector3(...p));
    if (close) pts.push(pts[0].clone());
    const object = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({
        color,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      }),
    );
    object.renderOrder = 10;
    group.add(object);
  }
  function dot(group, p, color) {
    const obj = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.005, 8, 6),
      new THREE.MeshBasicMaterial({ color, depthTest: false }),
    );
    obj.position.fromArray(p);
    obj.renderOrder = 11;
    group.add(obj);
  }
  function polygon(group, points, color) {
    const shape = new THREE.Shape(
      points.map((p) => new THREE.Vector2(p[0], -p[2])),
    );
    const obj = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
    );
    obj.rotation.x = -Math.PI / 2;
    obj.position.y = points[0][1];
    obj.renderOrder = 9;
    group.add(obj);
    line(group, points, color, true);
  }
  function addLabel(position, node) {
    const leader = document.createElementNS(svgNS, "line");
    leader.setAttribute("stroke", "#9a9f93");
    leader.setAttribute("stroke-width", "1");
    leaders.append(leader);
    labels.append(node);
    labelItems.push({ position: new THREE.Vector3(...position), node, leader });
  }
  function renderItems(items) {
    clear(annotations);
    labels.replaceChildren(leaders);
    leaders.replaceChildren();
    labelItems = [];
    for (const i of items) {
      if (i.type === "measurement") {
        const color = i.selected ? 0xad5420 : 0x255d77;
        line(annotations, [i.a, i.b], color);
        dot(annotations, i.a, color);
        dot(annotations, i.b, color);
      }
      if (i.type === "project-dimension" || i.type === "wall-dimension") {
        const color = i.selected
          ? 0xad5420
          : i.type === "wall-dimension"
            ? 0x255d77
            : 0x88613b;
        line(annotations, [i.a, i.b], color);
        // Architectural ticks; the printed value comes from the plan, not length.
        for (const p of [i.a, i.b])
          line(
            annotations,
            [
              [p[0] - 0.065, p[1], p[2] - 0.065],
              [p[0] + 0.065, p[1], p[2] + 0.065],
            ],
            color,
          );
      }
      if (i.type === "model-floor") {
        const fill = new THREE.Mesh(
          new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.Float32BufferAttribute(i.triangles.flat(2), 3),
          ),
          new THREE.MeshBasicMaterial({
            color: 0x255d77,
            transparent: true,
            opacity: 0.08,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        fill.position.y = 0.015;
        annotations.add(fill);
      }
      if (i.type === "area") polygon(annotations, i.points, 0xad5420);
      if (i.type === "comment") dot(annotations, i.position, 0xad5420);
      if (i.node) addLabel(i.position, i.node);
      if (i.selected && i.a && i.b) {
        const a = new THREE.Vector3(...i.a),
          b = new THREE.Vector3(...i.b);
        const direction = b.clone().sub(a);
        const stroke = new THREE.Mesh(
          new THREE.CylinderGeometry(
            radius * 0.003,
            radius * 0.003,
            direction.length(),
            8,
          ),
          new THREE.MeshBasicMaterial({ color: 0xad5420, depthTest: false }),
        );
        stroke.position.copy(a).add(b).multiplyScalar(0.5);
        stroke.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.normalize(),
        );
        stroke.renderOrder = 12;
        annotations.add(stroke);
        if (i.focused)
          for (const [index, position] of [i.a, i.b].entries()) {
            dot(annotations, position, 0xad5420);
            const endpoint = document.createElement("span");
            endpoint.className = "model-label endpoint";
            endpoint.textContent = index === 0 ? "A" : "B";
            addLabel(position, endpoint);
          }
        if (i.type === "wall-dimension") {
          const wall = meshes.find((mesh) => mesh.name === i.source);
          if (wall) {
            const highlight = new THREE.Mesh(
              wall.geometry.clone(),
              new THREE.MeshBasicMaterial({
                color: 0xad5420,
                transparent: true,
                opacity: 0.35,
                depthTest: false,
                depthWrite: false,
                side: THREE.DoubleSide,
              }),
            );
            highlight.applyMatrix4(wall.matrixWorld);
            highlight.renderOrder = 8;
            annotations.add(highlight);
          }
        }
      }
    }
  }
  function showDraft(points, area = false) {
    clear(draft);
    labels.querySelectorAll(".draft").forEach((n) => n.remove());
    labelItems
      .filter((i) => i.node.classList.contains("draft"))
      .forEach((i) => i.leader.remove());
    labelItems = labelItems.filter((i) => !i.node.classList.contains("draft"));
    if (points.length > 1) line(draft, points, 0xad5420);
    points.forEach((p, i) => {
      dot(draft, p, 0xad5420);
      const node = document.createElement("span");
      node.className = "model-label draft";
      node.textContent = area ? String(i + 1) : "A";
      addLabel(p, node);
    });
  }
  function project(position) {
    camera.updateMatrixWorld();
    const v = new THREE.Vector3(...position).project(camera);
    return {
      x: ((v.x + 1) / 2) * host.clientWidth,
      y: ((1 - v.y) / 2) * host.clientHeight,
      z: v.z,
    };
  }
  function onFloor(position) {
    downRay.set(
      new THREE.Vector3(position[0], ceilingY + 1, position[2]),
      new THREE.Vector3(0, -1, 0),
    );
    return downRay.intersectObjects(floors, false).length > 0;
  }
  function pick(x, y, planar = false) {
    const rect = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        (-(y - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    if (planar) {
      const p = ray.ray.intersectPlane(ceilingPlane, new THREE.Vector3());
      if (!p || !onFloor(p.toArray())) return null;
      return { position: p.toArray(), object: "ceiling-plan" };
    }
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit
      ? { position: hit.point.toArray(), object: hit.object.name }
      : null;
  }
  // A click adds geometry. Orbit/pan drags, pinches and canceled gestures never do.
  const pointers = new Map();
  let tap = null;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1 && e.button === 0)
      tap = { id: e.pointerId, x: e.clientX, y: e.clientY };
    else tap = null;
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (
      tap?.id === e.pointerId &&
      Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 6
    )
      tap = null;
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    const add =
      tap?.id === e.pointerId &&
      pointers.size === 1 &&
      Math.hypot(e.clientX - tap.x, e.clientY - tap.y) <= 6;
    pointers.delete(e.pointerId);
    tap = null;
    if (add)
      onTap(pick(e.clientX, e.clientY, drawMode === "area"), {
        x: e.clientX,
        y: e.clientY,
      });
  });
  renderer.domElement.addEventListener("pointercancel", (e) => {
    pointers.delete(e.pointerId);
    tap = null;
  });
  renderer.domElement.addEventListener("lostpointercapture", (e) => {
    pointers.delete(e.pointerId);
    if (tap?.id === e.pointerId) tap = null;
  });
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
    const placed = [
      ".topbar",
      "#show-panel",
      ".prompt",
      "#panel",
      "#project-panel",
    ]
      .map((selector) => document.querySelector(selector))
      .filter((node) => node && !node.hidden && node.getClientRects().length)
      .map((node) => node.getBoundingClientRect());
    for (const { position, node, leader } of labelItems) {
      const p = project(position.toArray());
      node.hidden =
        p.z < -1 ||
        p.z > 1 ||
        p.x < 0 ||
        p.x > host.clientWidth ||
        p.y < 0 ||
        p.y > host.clientHeight;
      leader.style.display = node.hidden ? "none" : "";
      if (node.hidden) continue;
      const w = node.offsetWidth,
        h = node.offsetHeight;
      if (
        node.classList.contains("project-dimension") &&
        !node.classList.contains("selected")
      ) {
        // Keep source labels close to their endpoints. Crowded labels reappear
        // as the user zooms; the complete catalogue stays in Project.
        const r = {
          left: p.x - w / 2,
          right: p.x + w / 2,
          top: p.y - h / 2,
          bottom: p.y + h / 2,
        };
        if (
          r.left < 6 ||
          r.right > host.clientWidth - 6 ||
          r.top < 140 ||
          r.bottom > host.clientHeight - 110 ||
          placed.some(
            (o) =>
              r.left < o.right + 6 &&
              r.right + 6 > o.left &&
              r.top < o.bottom + 6 &&
              r.bottom + 6 > o.top,
          )
        ) {
          node.hidden = true;
          leader.style.display = "none";
          continue;
        }
        placed.push(r);
        node.style.left = `${p.x}px`;
        node.style.top = `${p.y}px`;
        leader.style.display = "none";
        continue;
      }
      let x = p.x,
        y = p.y;
      if (!node.classList.contains("draft")) {
        const offsets = [
          [0, 0],
          [0, -h - 6],
          [0, h + 6],
          [0, -2 * (h + 6)],
          [0, 2 * (h + 6)],
          [-w - 6, 0],
          [w + 6, 0],
        ];
        const wallLabel = node.classList.contains("wall-dimension");
        if (wallLabel) {
          for (let ring = 1; ring <= 4; ring++) {
            for (let dx = -ring; dx <= ring; dx++)
              for (let dy = -ring; dy <= ring; dy++)
                if (Math.max(Math.abs(dx), Math.abs(dy)) === ring)
                  offsets.push([dx * (w + 8), dy * (h + 8)]);
          }
        }
        let found = false;
        for (const [dx, dy] of offsets) {
          const cx = Math.max(
            w / 2 + 4,
            Math.min(host.clientWidth - w / 2 - 4, p.x + dx),
          );
          const cy = Math.max(
            h / 2 + 4,
            Math.min(host.clientHeight - h / 2 - 4, p.y + dy),
          );
          const r = {
            left: cx - w / 2,
            right: cx + w / 2,
            top: cy - h / 2,
            bottom: cy + h / 2,
          };
          x = cx;
          y = cy;
          if (
            !placed.some(
              (o) =>
                r.left < o.right + 4 &&
                r.right + 4 > o.left &&
                r.top < o.bottom + 4 &&
                r.bottom + 4 > o.top,
            )
          ) {
            found = true;
            break;
          }
        }
        if (wallLabel && !found) {
          node.hidden = true;
          leader.style.display = "none";
          continue;
        }
        placed.push({
          left: x - w / 2,
          right: x + w / 2,
          top: y - h / 2,
          bottom: y + h / 2,
        });
      }
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      leader.setAttribute("x1", p.x);
      leader.setAttribute("y1", p.y);
      leader.setAttribute("x2", x);
      leader.setAttribute("y2", y);
      if (Math.hypot(x - p.x, y - p.y) < 2) leader.style.display = "none";
    }
  });
  function setMode(mode) {
    drawMode = mode;
    controls.enableRotate = mode !== "area";
    labels.style.pointerEvents = "none";
    labels.classList.toggle("drawing", mode !== "navigate");
    renderer.domElement.style.cursor =
      mode === "navigate" ? "grab" : "crosshair";
  }
  function focusMeasurement(a, b) {
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    const direction = camera.position.clone().sub(controls.target).normalize();
    const midpoint = new THREE.Vector3(...a)
      .add(new THREE.Vector3(...b))
      .multiplyScalar(0.5);
    const halfFov = Math.atan(
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
        Math.min(camera.aspect, 1),
    );
    const span = new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
    const dist = Math.max(2.5, span * 0.75) / Math.sin(halfFov);
    controls.target.copy(midpoint);
    camera.position
      .copy(midpoint)
      .addScaledVector(direction, Math.min(dist, controls.maxDistance));
    controls.update();
    controls.enableDamping = damping;
  }
  return {
    metrics,
    camera,
    controls,
    box,
    ceilingY,
    project,
    pick,
    onFloor,
    fit,
    focusMeasurement,
    renderItems,
    showDraft,
    setMode,
    get cameraMode() {
      return cameraMode;
    },
  };
}
