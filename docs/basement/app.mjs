import {
  STORAGE_KEY,
  INCH_TO_M,
  distance,
  polygonCenter,
  formatLength,
  formatArea,
  commentNumber,
  nextId,
  validatePolygon,
  validateData,
  loadData,
} from "./data.mjs?v=2";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const body = $("#panel-body");
export let viewer;
let data,
  storage,
  writable = true,
  mode = "navigate";
let selected = null,
  points = [],
  editGeometry = null,
  editingNote = null;
let toastTimer,
  lastAreaTap = null;
const visible = { comments: true, measurements: true, areas: true };
let projectData = null;

async function loadProjectReferences() {
  if (projectData) return;
  const host = $("#project-reference-list");
  try {
    host.textContent = "Loading project references…";
    const response = await fetch("./project-data.json", {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Project reference HTTP ${response.status}`);
    const reference = await response.json();
    if (!Array.isArray(reference?.pages)) throw new Error("Invalid project references");
    projectData = reference;
    renderProjectReferences();
  } catch (error) {
    projectData = null;
    console.warn("Project references unavailable:", error);
    host.textContent = "Project details unavailable. Open the original PDF below.";
  }
}

function renderProjectReferences() {
  const host = $("#project-reference-list");
  if (!host || !projectData) return;
  host.replaceChildren();
  for (const page of projectData.pages || []) {
    const card = el("div", undefined, "project-ref");
    const head = el("div", undefined, "project-ref-head");
    head.append(
      el("strong", page.title),
      el("span", "PROJECT", "badge project-badge"),
    );
    card.append(head);
    card.append(el("p", page.description || "", "small"));
    const link = el("a", `Open · original page ${page.sourcePage}`);
    link.href = `./project.pdf#page=${page.pdfPage}`;
    link.target = "_blank";
    link.rel = "noopener";
    card.append(link);
    host.append(card);
  }
}


function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, action, className) {
  const node = el("button", text, className);
  node.type = "button";
  node.onclick = action;
  return node;
}
function toast(text) {
  clearTimeout(toastTimer);
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 3500);
}
function save() {
  if (!writable) {
    $("#save-state").textContent = "Not saved · original data kept";
    return false;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    $("#save-state").textContent = "Saved on this device";
    return true;
  } catch {
    $("#save-state").textContent = "Browser saving unavailable";
    toast("This change is only in this tab. Browser saving is unavailable.");
    return false;
  }
}
function changed() {
  save();
  refresh();
}
function openPanel(title, selection = null) {
  selected = selection;
  $("#project-panel").hidden = true;
  $("#panel-title").textContent = title;
  body.replaceChildren();
  $("#panel").hidden = false;
  $("#panel").scrollTop = 0;
}
function closePanel() {
  $("#panel").hidden = true;
  selected = null;
  editingNote = null;
  refresh();
}
function field(label, value, onInput, config = {}) {
  const id = "field-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const lab = el("label", label);
  lab.htmlFor = id;
  const input = el(config.multiline ? "textarea" : "input");
  input.id = id;
  if (config.maxLength) input.maxLength = config.maxLength;
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  body.append(lab, input);
  return input;
}
function note(text) {
  body.append(el("p", text, "small"));
}
function actions(...items) {
  const row = el("div", undefined, "panel-actions");
  row.append(...items);
  body.append(row);
}
function removeItem(type, item) {
  data[type] = data[type].filter((value) => value.id !== item.id);
  closePanel();
  changed();
}
function lengthOf(measurement) {
  return measurement.status === "VERIFIED"
    ? measurement.verifiedMeters
    : distance(measurement.a, measurement.b);
}

function commitComment() {
  const { item, isNew } = editingNote;
  const text = item.text.trim();
  if (isNew && !text) return toast("Type a note before saving.");
  const record = {
    id: item.id,
    position: [...item.position],
    text,
    resolved: item.resolved,
  };
  const index = data.comments.findIndex((comment) => comment.id === item.id);
  if (index < 0) data.comments.push(record);
  else data.comments[index] = record;
  closePanel();
  changed();
}
function openComment(comment, isNew = false) {
  setMode("navigate");
  editingNote = { item: structuredClone(comment), isNew };
  const item = editingNote.item;
  openPanel(`${commentNumber(item.id)} Comment`, {
    type: "comment",
    id: item.id,
  });
  field(
    "Note",
    item.text,
    (text) => {
      item.text = text;
      refresh();
    },
    { multiline: true, maxLength: 5000 },
  );
  const saveButton = button("Save", commitComment, "accent");
  const moveButton = button("Move", () => {
    editGeometry = { type: "comment", item: structuredClone(item), isNew };
    setMode("comment", true);
  });
  if (isNew) actions(saveButton, moveButton, button("Cancel", closePanel));
  else
    actions(
      saveButton,
      moveButton,
      button(item.resolved ? "Show note" : "Resolve / hide", () => {
        item.resolved = !item.resolved;
        commitComment();
      }),
      button("Delete", () => removeItem("comments", item), "danger"),
    );
  refresh();
}
function openHiddenNotes() {
  setMode("navigate");
  openPanel("Hidden notes");
  for (const comment of data.comments.filter((item) => item.resolved)) {
    body.append(
      button(
        `${commentNumber(comment.id)} ${comment.text || "Note"}`,
        () => openComment(comment),
        "hidden-note",
      ),
    );
  }
  refresh();
}
function openMeasurement(measurement) {
  setMode("navigate");
  openPanel(measurement.name || "Measurement", {
    type: "measurement",
    id: measurement.id,
  });
  body.append(el("div", formatLength(lengthOf(measurement)), "value"));
  body.append(
    el(
      "span",
      measurement.status,
      `badge ${measurement.status === "VERIFIED" ? "verified" : ""}`,
    ),
  );
  note(
    `${lengthOf(measurement).toFixed(3)} m · scan ${distance(measurement.a, measurement.b).toFixed(3)} m`,
  );
  field(
    "Name (optional)",
    measurement.name,
    (value) => {
      measurement.name = value;
      changed();
    },
    { maxLength: 80 },
  );
  note("Enter a physical tape or laser measurement to mark VERIFIED.");
  const totalInches =
    Math.round((lengthOf(measurement) / INCH_TO_M) * 1000) / 1000;
  const feet = Math.floor(totalInches / 12);
  const row = el("div", undefined, "row");
  function numeric(label, value) {
    const wrap = el("div"),
      lab = el("label", label),
      input = el("input");
    lab.htmlFor = "confirmed-" + label.toLowerCase();
    input.id = lab.htmlFor;
    input.type = "number";
    input.min = "0";
    input.step = label === "Feet" ? "1" : ".125";
    input.inputMode = "decimal";
    input.value = String(value);
    wrap.append(lab, input);
    row.append(wrap);
    return input;
  }
  const feetInput = numeric("Feet", feet);
  const inchInput = numeric(
    "Inches",
    Number((totalInches - feet * 12).toFixed(3)),
  );
  body.append(row);
  actions(
    button("Mark VERIFIED", () => {
      const f = Number(feetInput.value),
        i = Number(inchInput.value),
        meters = (f * 12 + i) * INCH_TO_M;
      if (
        feetInput.value === "" ||
        inchInput.value === "" ||
        !Number.isInteger(f) ||
        f < 0 ||
        !Number.isFinite(i) ||
        i < 0 ||
        i >= 12 ||
        meters <= 0 ||
        meters > 1000
      ) {
        return toast("Enter feet and inches. Inches must be less than 12.");
      }
      measurement.status = "VERIFIED";
      measurement.verifiedMeters = meters;
      measurement.verifiedAt = new Date().toISOString();
      changed();
      openMeasurement(measurement);
    }),
    button("Use SCAN", () => {
      measurement.status = "SCAN";
      delete measurement.verifiedMeters;
      delete measurement.verifiedAt;
      changed();
      openMeasurement(measurement);
    }),
    button("Delete", () => removeItem("measurements", measurement), "danger"),
  );
  refresh();
}
function openArea(area) {
  setMode("navigate");
  openPanel(area.name || "Area", { type: "area", id: area.id });
  body.append(el("div", formatArea(area.squareMeters), "value"));
  note(`${area.squareMeters.toFixed(2)} m² · approximate horizontal scan area`);
  field(
    "Name (optional)",
    area.name,
    (value) => {
      area.name = value;
      changed();
    },
    { maxLength: 80 },
  );
  actions(
    button("Redraw", () => {
      editGeometry = { type: "area", item: area };
      setMode("area", true);
    }),
    button("Delete", () => removeItem("areas", area), "danger"),
  );
  refresh();
}
function openItem(type, item) {
  ({ comment: openComment, measurement: openMeasurement, area: openArea })[
    type
  ](item);
}
function refresh() {
  if (!viewer || !data) return;
  const items = [];
  function add(type, item) {
    if (type === "comment" && item.resolved) return;
    const text =
      type === "comment"
        ? `${commentNumber(item.id)} ${item.text || "New note"}`
        : item.name || item.id;
    const node = button(
      text,
      () => {
        if (mode === "navigate") openItem(type, item);
      },
      `model-label ${type}${selected?.id === item.id ? " selected" : ""}`,
    );
    node.dataset.id = item.id;
    node.title = text;
    node.setAttribute(
      "aria-label",
      type === "comment"
        ? `Comment ${Number(item.id.slice(1))}: ${item.text || "New note"}`
        : `${text}: ${type === "measurement" ? formatLength(lengthOf(item)) : formatArea(item.squareMeters)}`,
    );
    if (type === "measurement") {
      node.replaceChildren(el("span", item.name || item.id, "label-name"));
      const line = el("span", undefined, "label-line");
      line.append(
        el("span", formatLength(lengthOf(item))),
        el(
          "span",
          item.status,
          `badge ${item.status === "VERIFIED" ? "verified" : ""}`,
        ),
      );
      node.append(line);
    } else if (type === "area") {
      node.replaceChildren(
        el("span", item.name || item.id, "label-name"),
        el("span", formatArea(item.squareMeters), "label-line"),
      );
    }
    items.push({ ...item, type, node });
  }
  if (visible.comments) {
    data.comments
      .filter((comment) => comment.id !== editingNote?.item.id)
      .forEach((comment) => add("comment", comment));
    if (editingNote) add("comment", editingNote.item);
  }
  if (visible.measurements)
    data.measurements.forEach((measurement) => add("measurement", measurement));
  if (visible.areas) data.areas.forEach((area) => add("area", area));
  viewer.renderItems(items);
  viewer.showDraft(points, mode === "area");
  const total = visible.areas
    ? data.areas.reduce((sum, area) => sum + area.squareMeters, 0)
    : 0;
  $("#area-total").textContent = `Area: ${formatArea(total)}`;
  const hiddenCount = data.comments.filter(
    (comment) => comment.resolved,
  ).length;
  $("#hidden-notes").hidden = hiddenCount === 0;
  $("#hidden-notes").textContent = `Hidden · ${hiddenCount}`;
  $$("[data-visibility]").forEach((node) =>
    node.setAttribute("aria-pressed", String(visible[node.dataset.visibility])),
  );
}
function setMode(next, keepEdit = false) {
  const previousEdit = keepEdit ? editGeometry : null;
  mode = next;
  points = [];
  editGeometry = previousEdit;
  editingNote = null;
  lastAreaTap = null;
  $("#panel").hidden = true;
  $("#project-panel").hidden = true;
  selected = null;
  $$("[data-mode]").forEach((node) =>
    node.setAttribute("aria-pressed", String(node.dataset.mode === mode)),
  );
  $("#drawing-actions").hidden = mode === "navigate";
  $("#finish-area").hidden = mode !== "area";
  $("#undo-point").hidden = mode === "comment";
  $("#prompt").classList.toggle("drawing", mode !== "navigate");
  viewer?.setMode(mode);
  if (mode === "area") viewer?.fit("top");
  updateInstruction();
  refresh();
}
function updateInstruction() {
  $("#instruction").textContent =
    mode === "navigate"
      ? "Drag to orbit · Scroll / pinch to zoom · Right-drag / two fingers to pan"
      : mode === "comment"
        ? editGeometry
          ? "Tap the new note position"
          : "Tap a model surface to place a note"
        : mode === "measure"
          ? points.length
            ? "Tap Point B"
            : "Tap Point A"
          : `Tap area corners · ${points.length} placed · Done to save`;
  $("#finish-area").disabled = points.length < 3;
  $("#undo-point").disabled = points.length === 0;
}
function checkFootprint(outline) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      samples = Math.ceil(distance(a, b) / 0.1);
    for (let j = 0; j <= samples; j++) {
      if (
        !viewer.onFloor(
          a.map((value, k) => value + ((b[k] - value) * j) / samples),
        )
      ) {
        throw new Error("An edge leaves the basement footprint.");
      }
    }
  }
}
function handleTap(hit, screen) {
  if (mode === "navigate") {
    closePanel();
    return;
  }
  if (!hit)
    return toast(
      mode === "area"
        ? "Tap inside the basement footprint."
        : "Tap a model surface.",
    );
  const position = hit.position;
  if (mode === "comment") {
    if (editGeometry) {
      const item = editGeometry.item,
        isNew = editGeometry.isNew;
      item.position = position;
      openComment(item, isNew);
    } else {
      openComment(
        { id: nextId(data, "comment"), position, text: "", resolved: false },
        true,
      );
    }
    visible.comments = true;
    refresh();
    return;
  }
  if (mode === "measure") {
    if (points.length && distance(points[0], position) < 0.001)
      return toast("Pick a different Point B.");
    points.push(position);
    if (points.length === 2) {
      const item = {
        id: nextId(data, "measurement"),
        name: "",
        a: points[0],
        b: points[1],
        position: polygonCenter(points),
        status: "SCAN",
      };
      data.measurements.push(item);
      visible.measurements = true;
      changed();
      openMeasurement(item);
      return;
    }
  } else if (mode === "area") {
    const start = points.length ? viewer.project(points[0]) : null;
    if (
      points.length >= 3 &&
      Math.hypot(screen.x - start.x, screen.y - start.y) < 16
    ) {
      finishArea();
      return;
    }
    if (
      lastAreaTap &&
      Date.now() - lastAreaTap.time < 350 &&
      Math.hypot(screen.x - lastAreaTap.x, screen.y - lastAreaTap.y) < 16
    )
      return;
    if (points.length && distance(points.at(-1), position) < 0.01)
      return toast("Tap a different corner.");
    if (points.length >= 100)
      return toast("Save this area before adding more corners.");
    points.push(position);
    lastAreaTap = { ...screen, time: Date.now() };
  }
  updateInstruction();
  viewer.showDraft(points, mode === "area");
}
function finishArea() {
  try {
    const others = data.areas.filter(
      (area) => area.id !== editGeometry?.item.id,
    );
    const squareMeters = validatePolygon(points, others);
    checkFootprint(points);
    let item;
    if (editGeometry) {
      item = editGeometry.item;
      Object.assign(item, {
        points: structuredClone(points),
        squareMeters,
        position: polygonCenter(points),
      });
    } else {
      item = {
        id: nextId(data, "area"),
        name: "",
        points: structuredClone(points),
        squareMeters,
        position: polygonCenter(points),
      };
      data.areas.push(item);
    }
    visible.areas = true;
    changed();
    openArea(item);
  } catch (error) {
    toast(error.message);
  }
}

$("#project").onclick = () => {
  setMode("navigate");
  $("#project-panel").hidden = false;
  // Optional references never participate in viewer startup or block its tools.
  void loadProjectReferences();
};
$("#close-project").onclick = () => {
  $("#project-panel").hidden = true;
};

try {
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  const loaded = loadData(storage);
  data = loaded.data;
  writable = loaded.writable;
  const { createViewer } = await import("./viewer.mjs?v=2");
  viewer = await createViewer($("#view"), handleTap);
  $("#top").onclick = () => viewer.fit("top");
  $("#three").onclick = () => {
    setMode("navigate");
    viewer.fit("three");
  };
  $("#reset").onclick = () => {
    setMode("navigate");
    viewer.fit("three");
  };
  $("#close-panel").onclick = closePanel;
  $("#hidden-notes").onclick = openHiddenNotes;
  $("#undo-point").onclick = () => {
    points.pop();
    lastAreaTap = null;
    updateInstruction();
    viewer.showDraft(points, mode === "area");
  };
  $("#finish-area").onclick = finishArea;
  $("#cancel-drawing").onclick = () => setMode("navigate");
  $$("[data-mode]").forEach((node) => {
    node.disabled = false;
    node.onclick = () =>
      setMode(
        node.getAttribute("aria-pressed") === "true"
          ? "navigate"
          : node.dataset.mode,
      );
  });
  $$("[data-visibility]").forEach((node) => {
    node.disabled = false;
    node.onclick = () => {
      visible[node.dataset.visibility] = !visible[node.dataset.visibility];
      refresh();
    };
  });
  for (const id of ["top", "three", "reset"]) $("#" + id).disabled = false;
  document.addEventListener("keydown", (event) => {
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      if (event.key === "Escape") document.activeElement.blur();
      return;
    }
    if (event.key === "Escape") {
      setMode("navigate");
      closePanel();
    }
    if (event.key === "Enter" && mode === "area") {
      event.preventDefault();
      finishArea();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const next = validateData(JSON.parse(event.newValue));
      // Keep an unsaved note in this tab; it will merge into the new record on Save.
      data = next;
      if (mode === "navigate") refresh();
    } catch {
      toast("Another tab saved unreadable notes. This view was kept.");
    }
  });
  $("#view canvas").addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    $("#status").hidden = false;
    $("#status").textContent = "3D view interrupted. Reload to continue.";
  });
  $("#save-state").textContent = writable
    ? "Saved on this device"
    : "Browser saving unavailable";
  $("#status").hidden = true;
  setMode("navigate");
  if (loaded.message) toast(loaded.message);
} catch (error) {
  console.error(error);
  $("#status").hidden = false;
  $("#status").textContent = /WebGL|context/i.test(error.message)
    ? "3D requires WebGL. Enable browser graphics acceleration or try another browser."
    : "Could not open the basement. Reload to try again.";
}
