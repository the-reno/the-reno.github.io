import {
  STORAGE_KEY,
  INCH_TO_M,
  distance,
  polygonCenter,
  formatLength as displayLength,
  formatArea as displayArea,
  VIEW_STORAGE_KEY,
  loadView,
  parseProjectLength,
  commentNumber,
  nextId,
  validatePolygon,
  validateData,
  loadData,
} from "./data.mjs?v=8";

import { ROOM_GROUPS } from "./room-groups.mjs?v=8";

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
let preferences = loadView();
let visible = preferences.visibility;
let focusedMeasure = null;
const formatLength = (meters) => displayLength(meters, preferences.units);
const formatArea = (meters) => displayArea(meters, preferences.units);
function projectLength(item) {
  const meters = parseProjectLength(item.value);
  return preferences.units === "metric" && meters !== null
    ? formatLength(meters)
    : item.value;
}
let projectData = null;
let projectLoading = false;
let revealLighting = false;
const expandedGroups = new Set();
let dimensionSource = "model";
let selectedImage = "lighting";

function saveView() {
  preferences.source = dimensionSource;
  try {
    storage?.setItem(VIEW_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    toast(
      "View preferences apply only in this tab. Browser saving is unavailable.",
    );
  }
}
function measureShown(key) {
  return preferences.shown.includes(key);
}
function setMeasureShown(key, show) {
  preferences.shown = preferences.shown.filter((id) => id !== key);
  if (show) {
    preferences.shown.push(key);
    visible.measurements = true;
  }
  if (!show && focusedMeasure === key) focusedMeasure = null;
  saveView();
  refresh();
}
function measurementEntries() {
  const own = data.measurements.map((item) => ({
    key: `saved:${item.id}`,
    title: item.name || item.id,
    detail: `${item.id} · ${formatLength(lengthOf(item))} · ${item.status}`,
    a: item.a,
    b: item.b,
    item,
    type: "saved",
  }));
  const reference =
    dimensionSource === "model"
      ? (viewer.metrics?.walls || []).map((wall) => ({
          key: `wall:${wall.id}`,
          title: `Wall ${wall.id}`,
          detail: `${formatLength(wall.length)} long · ${formatLength(wall.height)} high · SCAN`,
          a: [wall.a[0], viewer.ceilingY, wall.a[1]],
          b: [wall.b[0], viewer.ceilingY, wall.b[1]],
          type: "wall",
          item: wall,
        }))
      : projectDimensions()
          .slice()
          .sort((a, b) => a.room.localeCompare(b.room))
          .map((item) => ({
            key: `project:${item.id}`,
            title: `${item.room} · ${item.name}`,
            detail: `${item.id} · ${projectLength(item)} · PROJECT`,
            a: [item.a[0], viewer.ceilingY, item.a[1]],
            b: [item.b[0], viewer.ceilingY, item.b[1]],
            type: "project",
            item,
          }));
  return [...own, ...reference];
}
function locateMeasure(entry) {
  setMode("navigate");
  focusedMeasure = entry.key;
  setMeasureShown(entry.key, true);
  viewer.focusMeasurement(entry.a, entry.b);
  toast(`${entry.title} · highlighted between A and B`);
}
function renderShowOptions() {
  if (!viewer || !data) return;
  const controls = $("#show-controls");
  const list = $("#measure-list");
  const scroll = list.scrollTop;
  controls.replaceChildren();
  list.replaceChildren();
  const units = el("div", undefined, "unit-options");
  units.setAttribute("role", "group");
  units.setAttribute("aria-label", "Measurement units");
  for (const [value, label] of [
    ["imperial", "Imperial · ft/in"],
    ["metric", "Metric · m"],
  ]) {
    const control = button(label, () => {
      preferences.units = value;
      saveView();
      refresh();
      if (projectData) renderProjectReferences();
      closePanel();
      renderShowOptions();
    });
    control.dataset.units = value;
    control.setAttribute("aria-pressed", String(preferences.units === value));
    units.append(control);
  }
  controls.append(units);
  const groups = el("div", undefined, "visibility-options");
  for (const [key, label] of [
    ["measurements", "Walls"],
    ["areas", "Floor"],
  ]) {
    const control = button(label, () => {
      visible[key] = !visible[key];
      saveView();
      refresh();
    });
    control.dataset.visibility = key;
    control.setAttribute("aria-pressed", String(visible[key]));
    groups.append(control);
  }
  controls.append(groups);
  const entries = measurementEntries();
  const allActions = el("div", undefined, "show-actions");
  allActions.append(
    ...[
      ["Show all", true],
      ["Hide all", false],
    ].map(([label, show]) =>
      button(label, () => {
        const keys = new Set(entries.map((entry) => entry.key));
        preferences.shown = preferences.shown.filter((key) => !keys.has(key));
        if (show) preferences.shown.push(...keys);
        else {
          revealLighting = false;
          preferences.shown = [];
          visible.areas = false;
        }
        visible.measurements = show;
        focusedMeasure = null;
        saveView();
        refresh();
      }),
    ),
  );
  controls.append(allActions);
  const appendEntry = (entry, host) => {
    const row = el("div", undefined, "measurement-option");
    row.dataset.measureKey = entry.key;
    const label = el("label");
    const checkbox = el("input");
    checkbox.type = "checkbox";
    checkbox.checked = measureShown(entry.key);
    checkbox.setAttribute("aria-label", `Show ${entry.title}`);
    checkbox.onchange = () => setMeasureShown(entry.key, checkbox.checked);
    const text = el("span");
    text.append(el("strong", entry.title), el("small", entry.detail));
    label.append(checkbox, text);
    const locate = button("Locate", () => locateMeasure(entry));
    locate.setAttribute("aria-label", `Locate ${entry.title}`);
    row.append(label, locate);
    host.append(row);
  };
  const own = entries.filter((entry) => entry.type === "saved");
  if (own.length) {
    list.append(el("h2", "Your measurements", "filter-heading"));
    own.forEach((entry) => appendEntry(entry, list));
  }
  if (dimensionSource === "model") {
    for (const group of ROOM_GROUPS) {
      const section = el("section", undefined, "room-group");
      section.dataset.roomGroup = group.id;
      section.style.setProperty("--room-color", group.color);
      const checkbox = el("input");
      checkbox.type = "checkbox";
      checkbox.dataset.groupCheck = group.id;
      checkbox.setAttribute("aria-label", `Show ${group.name} walls`);
      checkbox.onchange = () => setGroupShown(group, checkbox.checked);
      const details = el("details");
      details.open = expandedGroups.has(group.id);
      details.ontoggle = () => {
        if (!details.isConnected) return;
        if (details.open) expandedGroups.add(group.id);
        else expandedGroups.delete(group.id);
      };
      const summary = el("summary");
      summary.append(el("strong", group.name));
      const area = viewer.metrics?.groups?.find((item) => item.id === group.id);
      if (area) {
        const value = el("small", formatArea(area.squareMeters), "group-area");
        value.hidden = !visible.areas;
        summary.append(value);
      }
      const rows = el("div", undefined, "group-walls");
      for (const id of group.walls) {
        const entry = entries.find((item) => item.key === `wall:${id}`);
        if (entry) appendEntry(entry, rows);
      }
      details.append(summary, rows);
      section.append(checkbox, details);
      list.append(section);
    }
  } else {
    let room;
    for (const entry of entries.filter((item) => item.type === "project")) {
      if (room !== entry.item.room) {
        room = entry.item.room;
        list.append(el("h2", room, "filter-heading"));
      }
      appendEntry(entry, list);
    }
  }
  if (!entries.length)
    list.append(
      el(
        "p",
        projectLoading
          ? "Loading reference dimensions…"
          : "No measurements to show yet.",
        "small",
      ),
    );
  list.scrollTop = scroll;
  updateGroupControls();
}
function updateGroupControls() {
  for (const group of ROOM_GROUPS) {
    const checkbox = $(`[data-group-check="${group.id}"]`);
    if (!checkbox) continue;
    const count = group.walls.filter((id) => measureShown(`wall:${id}`)).length;
    checkbox.checked = count === group.walls.length;
    checkbox.indeterminate = count > 0 && count < group.walls.length;
  }
  $$(".group-area").forEach((node) => {
    node.hidden = !visible.areas;
  });
}
function setGroupShown(group, show) {
  const keys = new Set(group.walls.map((id) => `wall:${id}`));
  // Keep a shared boundary if another fully selected room still uses it.
  const retained = new Set(
    ROOM_GROUPS.filter(
      (other) =>
        other.id !== group.id &&
        other.walls.every((id) => measureShown(`wall:${id}`)),
    ).flatMap((other) => other.walls.map((id) => `wall:${id}`)),
  );
  if (show) {
    preferences.shown = [...new Set([...preferences.shown, ...keys])];
    visible.measurements = true;
  } else
    preferences.shown = preferences.shown.filter(
      (key) => !keys.has(key) || retained.has(key),
    );
  focusedMeasure = null;
  saveView();
  refresh();
}
function showLightingReferences() {
  if (!revealLighting || dimensionSource !== "lighting" || !projectData) return;
  const dimensions = projectDimensions();
  preferences.shown = [
    ...new Set([
      ...preferences.shown,
      ...dimensions.map((item) => `project:${item.id}`),
    ]),
  ];
  revealLighting = false;
  visible.measurements = true;
  saveView();
}

function projectDimensions() {
  return (projectData?.dimensions || []).filter(
    (d) =>
      typeof d.id === "string" &&
      typeof d.value === "string" &&
      [d.a, d.b].every(
        (p) =>
          Array.isArray(p) &&
          p.length === 2 &&
          p.every((v) => Number.isFinite(v) && Math.abs(v) < 10),
      ),
  );
}

function openProjectDimension(item) {
  setMode("navigate");
  openPanel(`${item.room} · plan dimension`);
  body.append(el("span", "PROJECT", "badge project-badge"));
  focusedMeasure = `project:${item.id}`;
  setMeasureShown(focusedMeasure, true);
  body.append(el("p", projectLength(item), "value"), el("p", item.name));
  note(projectData.dimensionNote);
  const source = el("a", "Open lighting drawing image");
  source.href = "./lighting-plan.png";
  source.target = "_blank";
  source.rel = "noopener";
  body.append(source);
  refresh();
}

async function loadProjectReferences() {
  if (projectData || projectLoading) return;
  projectLoading = true;
  const host = $("#project-reference-list");
  try {
    host.textContent = "Loading project references…";
    const response = await fetch("./project-data.json?v=4", {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      throw new Error(`Project reference HTTP ${response.status}`);
    const reference = await response.json();
    if (!Array.isArray(reference?.pages))
      throw new Error("Invalid project references");
    projectData = reference;
    showLightingReferences();
    renderProjectReferences();
    refresh();
    renderShowOptions();
  } catch (error) {
    projectData = null;
    console.warn("Project references unavailable:", error);
    host.textContent = "Project images unavailable. Reload to try again.";
    $("#plan-note").textContent = "Lighting references unavailable";
    $("#plan-note").hidden = dimensionSource !== "lighting";
  } finally {
    projectLoading = false;
    renderShowOptions();
  }
}

function renderProjectReferences() {
  const host = $("#project-reference-list");
  if (!host || !projectData) return;
  host.replaceChildren();
  const dimensions = projectDimensions();
  const catalogue = $("#lighting-dimensions");
  catalogue.replaceChildren();
  if (dimensions.length) {
    const list = el("details", undefined, "plan-dimension-list");
    list.append(el("summary", `All ${dimensions.length} printed dimensions`));
    for (const item of dimensions) {
      const row = button(
        `${item.room} · ${item.name}: ${projectLength(item)}`,
        () => openProjectDimension(item),
      );
      list.append(row);
    }
    catalogue.append(list);
  }
  for (const page of projectData.pages || []) {
    const card = button(
      "",
      () => {
        selectedImage = page.id;
        renderProjectReferences();
      },
      "project-ref",
    );
    card.setAttribute("aria-pressed", String(page.id === selectedImage));
    const image = el("img");
    image.src = page.image;
    image.loading = "lazy";
    image.alt = "";
    card.append(image, el("span", page.title));
    host.append(card);
  }
  const page =
    projectData.pages.find((p) => p.id === selectedImage) ||
    projectData.pages[0];
  if (page) {
    $("#project-image").src = page.image;
    $("#project-image").alt = page.title;
    $("#project-image-note").textContent = page.description;
    $("#open-project-image").href = page.image;
    $("#lighting-dimensions").hidden = page.id !== "lighting";
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
  saveView();
  renderShowOptions();
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
  focusedMeasure = `saved:${measurement.id}`;
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
    `Original scan: ${formatLength(distance(measurement.a, measurement.b))}`,
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
    input.step = label === "Feet" ? "1" : label === "Meters" ? ".001" : ".125";
    input.inputMode = "decimal";
    input.value = String(value);
    wrap.append(lab, input);
    row.append(wrap);
    return input;
  }
  const metric = preferences.units === "metric";
  const meterInput = metric
    ? numeric("Meters", Number(lengthOf(measurement).toFixed(3)))
    : null;
  const feetInput = metric ? null : numeric("Feet", feet);
  const inchInput = metric
    ? null
    : numeric("Inches", Number((totalInches - feet * 12).toFixed(3)));
  body.append(row);
  actions(
    button("Mark VERIFIED", () => {
      const f = Number(feetInput?.value),
        i = Number(inchInput?.value);
      const meters = metric
        ? Number(meterInput.value)
        : (f * 12 + i) * INCH_TO_M;
      if (
        !Number.isFinite(meters) ||
        meters <= 0 ||
        meters > 1000 ||
        (metric
          ? meterInput.value === ""
          : feetInput.value === "" ||
            inchInput.value === "" ||
            !Number.isInteger(f) ||
            f < 0 ||
            !Number.isFinite(i) ||
            i < 0 ||
            i >= 12)
      ) {
        return toast(
          metric
            ? "Enter a physical length in meters greater than zero."
            : "Enter feet and inches. Inches must be less than 12.",
        );
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
  note("Approximate horizontal scan area");
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
      `model-label ${type}${selected?.id === item.id || type === "measurement" ? " selected" : ""}`,
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
    items.push({
      ...item,
      type,
      node,
      selected: type === "measurement",
      focused: focusedMeasure === `saved:${item.id}`,
    });
  }
  data.comments
    .filter((comment) => comment.id !== editingNote?.item.id)
    .forEach((comment) => add("comment", comment));
  if (editingNote) add("comment", editingNote.item);
  if (visible.measurements)
    data.measurements
      .filter((measurement) => measureShown(`saved:${measurement.id}`))
      .forEach((measurement) => add("measurement", measurement));
  if (visible.areas) data.areas.forEach((area) => add("area", area));
  const dimensions = projectDimensions();
  $("#plan-note").hidden =
    dimensionSource !== "lighting" ||
    !visible.measurements ||
    !dimensions.length ||
    mode !== "navigate";
  if (dimensions.length) {
    $("#plan-note").replaceChildren(
      el("span", `LIGHTING · ${dimensions.length} fixture spacings`),
      el("small", "Approximate placement · zoom for detail"),
    );
  }
  $$("[data-source]").forEach((b) =>
    b.setAttribute(
      "aria-pressed",
      String(b.dataset.source === dimensionSource),
    ),
  );
  if (viewer.metrics) {
    const { floor, walls } = viewer.metrics;
    $("#model-area").textContent = `Floor ${formatArea(floor.squareMeters)}`;
    if (visible.areas && mode === "navigate") {
      for (const group of viewer.metrics.groups || []) {
        const node = el("span", undefined, "model-label room-area");
        node.dataset.group = group.id;
        node.style.setProperty("--room-color", group.color);
        node.append(
          el("span", group.name, "label-name"),
          el("strong", formatArea(group.squareMeters)),
        );
        items.push({
          type: "room-floor",
          color: group.color,
          triangles: group.triangles,
          position: [
            group.position[0],
            group.position[1] + 0.03,
            group.position[2],
          ],
          node,
        });
      }
    }
    if (
      visible.measurements &&
      dimensionSource === "model" &&
      mode === "navigate"
    ) {
      const ordered = walls.filter((wall) => measureShown(`wall:${wall.id}`));
      for (const wall of ordered) {
        const a = [wall.a[0], viewer.ceilingY, wall.a[1]],
          b = [wall.b[0], viewer.ceilingY, wall.b[1]];
        const active = focusedMeasure === `wall:${wall.id}`;
        const node = el(
          "span",
          undefined,
          "model-label wall-dimension selected",
        );
        node.append(
          el("span", wall.id, "wall-id"),
          el("span", `≈ ${formatLength(wall.length)}`),
        );
        node.dataset.id = wall.id;
        node.setAttribute(
          "aria-label",
          `${wall.id}, model length ${formatLength(wall.length)}, height ${formatLength(wall.height)}`,
        );
        items.push({
          type: "wall-dimension",
          a,
          b,
          source: wall.source,
          position: polygonCenter([a, b]),
          node,
          selected: true,
          focused: active,
        });
      }
    }
  }
  if (
    visible.measurements &&
    dimensionSource === "lighting" &&
    mode === "navigate"
  ) {
    for (const item of dimensions
      .filter((item) => measureShown(`project:${item.id}`))
      .sort((a, b) => a.priority - b.priority)) {
      const a = [item.a[0], viewer.ceilingY, item.a[1]];
      const b = [item.b[0], viewer.ceilingY, item.b[1]];
      const active = focusedMeasure === `project:${item.id}`;
      const node = el(
        "span",
        `${item.room} · ${projectLength(item)}`,
        `model-label project-dimension selected${active ? " focused" : ""}`,
      );
      node.dataset.id = item.id;
      node.title = `PROJECT · ${item.room} · ${item.name}: ${projectLength(item)}`;
      node.setAttribute("aria-label", node.title);
      items.push({
        type: "project-dimension",
        a,
        b,
        position: polygonCenter([a, b]),
        node,
        selected: true,
        focused: active,
      });
    }
  }
  const priority = (item) =>
    item.focused ? 2 : item.type === "room-floor" ? 1 : 0;
  items.sort((a, b) => priority(b) - priority(a));
  viewer.renderItems(items);
  viewer.showDraft(points, mode === "area");
  const total = visible.areas
    ? data.areas.reduce((sum, area) => sum + area.squareMeters, 0)
    : 0;
  $("#area-total").hidden = total === 0;
  $("#area-total").textContent = `Drawn areas: ${formatArea(total)}`;
  const hiddenCount = data.comments.filter(
    (comment) => comment.resolved,
  ).length;
  $("#hidden-notes").hidden = hiddenCount === 0;
  $("#hidden-notes").textContent = `Hidden · ${hiddenCount}`;
  $$("[data-measure-key] input").forEach((node) => {
    node.checked = measureShown(
      node.closest("[data-measure-key]").dataset.measureKey,
    );
  });
  updateGroupControls();
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
  focusedMeasure = null;
  $$("[data-mode]").forEach((node) =>
    node.setAttribute("aria-pressed", String(node.dataset.mode === mode)),
  );
  $("#add-tools").open = false;
  $("#prompt").hidden = mode === "navigate";
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
      ? ""
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
      preferences.shown.push(`saved:${item.id}`);
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
$("#plan-note").onclick = () => $("#project").click();
$("#execution").onclick = async () => {
  setMode("navigate");
  $("#execution").disabled = true;
  try {
    const { openCeiling } = await import("./ceiling.mjs?v=1");
    openCeiling({
      dialog: $("#execution-panel"),
      storage,
      units: preferences.units,
      modelArea: viewer.metrics.floor.squareMeters,
      drawnArea: data.areas.reduce((sum, area) => sum + area.squareMeters, 0),
    });
    $("#execution").setAttribute("aria-expanded", "true");
  } catch {
    toast("Could not open the ceiling estimate. Please try again.");
  } finally {
    $("#execution").disabled = false;
  }
};
$("#close-execution").onclick = () => $("#execution-panel").close();
$("#execution-panel").addEventListener("close", () => {
  $("#execution").setAttribute("aria-expanded", "false");
  $("#execution").focus();
});
$$("[data-source]").forEach(
  (node) =>
    (node.onclick = () => {
      setMode("navigate");
      dimensionSource = node.dataset.source;
      revealLighting =
        dimensionSource === "lighting" &&
        !preferences.shown.some((key) => key.startsWith("project:"));
      showLightingReferences();
      visible.measurements = true;
      saveView();
      renderShowOptions();
      refresh();
      if (dimensionSource === "lighting") void loadProjectReferences();
    }),
);

try {
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  const loaded = loadData(storage);
  preferences = loadView(storage);
  visible = preferences.visibility;
  dimensionSource = preferences.source;
  data = loaded.data;
  writable = loaded.writable;
  const { createViewer } = await import("./viewer.mjs?v=8");
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
  renderShowOptions();
  $("#execution").disabled = false;
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
      renderShowOptions();
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
  viewer.fit("top");
  setMode("navigate");
  // Reference failures/timeouts never delay the canvas or enablement of tools.
  void loadProjectReferences();
  if (loaded.message) toast(loaded.message);
} catch (error) {
  console.error(error);
  $("#status").hidden = false;
  $("#status").textContent = /WebGL|context/i.test(error.message)
    ? "3D requires WebGL. Enable browser graphics acceleration or try another browser."
    : "Could not open the basement. Reload to try again.";
}
