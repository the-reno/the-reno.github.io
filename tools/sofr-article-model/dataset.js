"use strict";

const sheetColumns = ["Date", "ON", "1M", "3M", "6M"];
const sheetLetters = "ABCDE";
const rateNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const sheetTable = $("rate-table");
const sheetViewport = $("rate-sheet");
const sheetPageSize = 1500;
const minSheetRows = 16;
const maxSheetRows = 20_000;
const gutterWidth = 44;
const columnWidths = [null, null, null, null, null];
const columns = Array.from(sheetTable.querySelectorAll("col"));
let savedDraft;
let rateDraft;
let draftVersion;
let sheetBusy = false;
let rowCount = 0;
let sheetPage = 0;
let selection = null;
let painted = [];
let editor = null;
let dragging = false;
let resize = null;
const undoRows = [];
const redoRows = [];

function blankRow() {
  return sheetColumns.map(() => "");
}

function draftWithRows(data) {
  const rows = data.rows.slice();
  while (rows.length < minSheetRows) rows.push(blankRow());
  return { rows, name: data.name, observations: data.observations, filename: data.filename, worksheet: data.worksheet || "" };
}

function draftDirty() {
  return rateDraft.rows !== savedDraft.rows || rateDraft.name !== savedDraft.name ||
    rateDraft.observations !== savedDraft.observations || rateDraft.filename !== savedDraft.filename;
}

function sheetStatus(message, error = false) {
  $("dataset-status").textContent = message;
  $("dataset-status").classList.toggle("error", error);
}

function rowLabel() {
  return rowCount ? number.format(rowCount) + (rowCount === 1 ? " row" : " rows") : "No rates entered";
}

function updateSheetActions() {
  const busy = sheetBusy || !rateDraft;
  const dirty = !busy && draftDirty();
  const rowsSelected = selection?.anchor.column === -1 && selection.anchor.row >= 0;
  $("save-dataset").disabled = !dirty;
  $("confirm-dataset").disabled = busy || !rowCount || Boolean(defaults);
  $("insert-row").disabled = busy || rateDraft.rows.length >= maxSheetRows;
  $("delete-rows").disabled = busy || !rowsSelected;
  $("clear-cells").disabled = busy || !selection;
  $("undo-sheet").disabled = busy || !undoRows.length;
  $("redo-sheet").disabled = busy || !redoRows.length;
  $("rates-prev").disabled = busy || sheetPage === 0;
  $("rates-next").disabled = busy || (sheetPage + 1) * sheetPageSize >= rateDraft.rows.length;
  for (const id of ["dataset-name", "dataset-observations", "import-rates", "curve-download", "revert-draft"]) {
    $(id).disabled = busy;
  }
}

function setSheetBusy(busy) {
  sheetBusy = busy;
  sheetViewport.inert = busy;
  $("step-dataset").setAttribute("aria-busy", String(busy));
  updateSheetActions();
}

function displayValue(raw, column) {
  if (!column || !raw) return raw;
  const trimmed = raw.trim();
  const hasPercent = trimmed.endsWith("%");
  const digits = hasPercent ? trimmed.slice(0, -1).trim() : trimmed;
  if (!rateNumber.test(digits)) return raw;
  const value = Number(digits) * (hasPercent ? 1 : 100);
  return Number.isFinite(value) && Math.abs(value) < 1000 ? value.toFixed(4) + "%" : raw;
}

function cellId(row, column) {
  return "rate-cell-" + (row + 1) + "-" + (column + 1);
}

function sheetCell(row, column) {
  return $(cellId(row, column));
}

function positionCell(cell, row, column) {
  cell.id = cellId(row, column);
  cell.dataset.row = row;
  cell.dataset.column = column;
}

function fitSheetColumns() {
  if (!sheetViewport.clientWidth) return;
  const remaining = sheetViewport.clientWidth - gutterWidth - columnWidths.reduce((total, width) => total + width, 0);
  const automatic = Math.max(100, Math.floor(remaining / Math.max(1, columnWidths.filter((width) => width === null).length)));
  const widths = columnWidths.map((width, index) => width ?? Math.max(index === 0 ? 132 : 100, automatic));
  [gutterWidth, ...widths].forEach((width, index) => { columns[index].style.width = width + "px"; });
  sheetTable.style.width = gutterWidth + widths.reduce((a, b) => a + b, 0) + "px";
}

function selectionBounds() {
  if (!selection) return null;
  const { anchor, end } = selection;
  return {
    top: anchor.row < 0 ? 0 : Math.min(anchor.row, end.row),
    bottom: anchor.row < 0 ? rateDraft.rows.length - 1 : Math.max(anchor.row, end.row),
    left: anchor.column < 0 ? 0 : Math.min(anchor.column, end.column),
    right: anchor.column < 0 ? sheetColumns.length - 1 : Math.max(anchor.column, end.column),
  };
}

function paintSelection() {
  for (const cell of painted) {
    cell.classList.remove("sheet-selected", "sheet-current");
    cell.removeAttribute("aria-selected");
  }
  painted = [];
  function mark(row, column) {
    const cell = sheetCell(row, column);
    if (!cell) return;
    cell.classList.add("sheet-selected");
    cell.setAttribute("aria-selected", "true");
    painted.push(cell);
  }
  sheetTable.removeAttribute("aria-activedescendant");
  $("sheet-range").textContent = "";
  if (!selection) return;
  const { top, bottom, left, right } = selectionBounds();
  const start = sheetPage * sheetPageSize;
  for (let column = left; column <= right; column++) mark(-1, column);
  for (let row = Math.max(start, top); row <= Math.min(start + sheetPageSize - 1, bottom); row++) {
    mark(row, -1);
    for (let column = left; column <= right; column++) mark(row, column);
  }
  const { row, column } = selection.end;
  if (row < 0 && column < 0) mark(-1, -1);
  const current = sheetCell(row, column);
  if (current) {
    current.classList.add("sheet-current");
    sheetTable.setAttribute("aria-activedescendant", current.id);
  }
  const first = sheetLetters[left] + (top + 1);
  const last = sheetLetters[right] + (bottom + 1);
  if (row < 0 && column >= 0) {
    $("sheet-range").textContent = sheetLetters[left] + ":" + sheetLetters[right];
  } else {
    $("sheet-range").textContent = first === last ? first : first + ":" + last;
  }
}

function renderRateSheet() {
  const rows = rateDraft.rows;
  sheetPage = Math.min(sheetPage, Math.floor((rows.length - 1) / sheetPageSize));
  const start = sheetPage * sheetPageSize;
  const end = Math.min(start + sheetPageSize, rows.length);
  const header = document.createElement("tr");
  const corner = document.createElement("th");
  corner.scope = "col";
  corner.setAttribute("aria-label", "Select all");
  corner.textContent = "\u25E2";
  positionCell(corner, -1, -1);
  header.append(corner);
  sheetColumns.forEach((label, column) => {
    const heading = document.createElement("th");
    heading.scope = "col";
    positionCell(heading, -1, column);
    const letter = document.createElement("span");
    letter.className = "sheet-letter";
    letter.textContent = sheetLetters[column];
    const edge = document.createElement("span");
    edge.className = "sheet-resize";
    edge.dataset.resize = column;
    edge.title = "Drag to resize " + label + ". Double-click to fit.";
    heading.append(letter, label, edge);
    header.append(heading);
  });
  sheetTable.tHead.replaceChildren(header);
  const page = document.createDocumentFragment();
  for (let index = start; index < end; index++) {
    const row = document.createElement("tr");
    row.setAttribute("aria-rowindex", index + 2);
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = number.format(index + 1);
    positionCell(heading, index, -1);
    row.append(heading);
    rows[index].forEach((value, column) => {
      const cell = document.createElement("td");
      cell.classList.toggle("sheet-rate", column > 0);
      positionCell(cell, index, column);
      cell.textContent = displayValue(value, column);
      row.append(cell);
    });
    page.append(row);
  }
  sheetTable.tBodies[0].replaceChildren(page);
  sheetTable.setAttribute("aria-rowcount", rows.length + 1);
  $("sheet-pages").hidden = rows.length <= sheetPageSize;
  $("rate-rows").textContent = number.format(start + 1) + "–" + number.format(end) + " of " + number.format(rows.length);
  fitSheetColumns();
  paintSelection();
}

function updateCells(previous) {
  const start = sheetPage * sheetPageSize;
  const end = Math.min(start + sheetPageSize, rateDraft.rows.length);
  for (let index = start; index < end; index++) {
    if (previous[index] === rateDraft.rows[index]) continue;
    rateDraft.rows[index].forEach((value, column) => {
      sheetCell(index, column).textContent = displayValue(value, column);
    });
  }
}

function refreshDraft(message) {
  rowCount = rateDraft.rows.filter((row) => row.some((value) => value.trim())).length;
  sheetStatus([message, rowLabel()].filter(Boolean).join(" · "));
  updateSheetActions();
}

function showDraft(data) {
  rateDraft = data;
  $("dataset-name").value = data.name;
  $("dataset-observations").value = data.observations;
  $("dataset-source").textContent = data.filename ?
    [data.filename, data.worksheet].filter(Boolean).join(" · ") :
    "Import an Excel or CSV file, or paste rates into the sheet.";
  undoRows.length = 0;
  redoRows.length = 0;
  selection = null;
  sheetPage = 0;
  renderRateSheet();
  sheetViewport.scrollTop = 0;
  sheetViewport.scrollLeft = 0;
}

function showSaved(data) {
  draftVersion = data.version;
  savedDraft = draftWithRows(data);
  showDraft(savedDraft);
}

function changeRows(rows, recordUndo = true) {
  const previous = rateDraft.rows;
  if (recordUndo) {
    undoRows.push(previous);
    if (undoRows.length > 35) undoRows.shift();
    redoRows.length = 0;
  }
  while (rows.length < minSheetRows) rows.push(blankRow());
  rateDraft = { ...rateDraft, rows };
  if (selection) {
    for (const point of new Set([selection.anchor, selection.end])) {
      point.row = Math.min(point.row, rows.length - 1);
    }
  }
  if (previous.length === rows.length) {
    updateCells(previous);
    paintSelection();
  } else {
    renderRateSheet();
  }
  invalidateDatasetModel();
  refreshDraft(draftDirty() ? "Unsaved draft" : "Draft saved");
}

function sheetUndo(undo = true) {
  const from = undo ? undoRows : redoRows;
  const to = undo ? redoRows : undoRows;
  if (!from.length) return;
  to.push(rateDraft.rows);
  changeRows(from.pop(), false);
  sheetTable.focus({ preventScroll: true });
}

function selectPosition(row, column, extend = false, reveal = true) {
  const next = { row, column };
  const anchor = selection?.anchor;
  const sameKind = anchor && (anchor.row < 0) === (row < 0) && (anchor.column < 0) === (column < 0);
  selection = { anchor: extend && sameKind ? anchor : next, end: next };
  const page = row < 0 ? sheetPage : Math.floor(row / sheetPageSize);
  if (page !== sheetPage) {
    sheetPage = page;
    renderRateSheet();
  } else {
    paintSelection();
  }
  if (reveal) sheetCell(row, column)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  updateSheetActions();
}

function locateCell(target) {
  const cell = target.closest("[data-row][data-column]");
  return cell ? { row: Number(cell.dataset.row), column: Number(cell.dataset.column) } : null;
}

function finishCellEdit(save = true) {
  if (!editor) return;
  const { input, row, column } = editor;
  const oldValue = rateDraft.rows[row][column];
  editor = null;
  input.replaceWith(displayValue(oldValue, column));
  if (save && input.value !== oldValue) {
    const rows = rateDraft.rows.slice();
    rows[row] = rows[row].slice();
    rows[row][column] = input.value;
    changeRows(rows);
  }
}

function beginCellEdit(initial) {
  const { row, column } = selection.end;
  if (row < 0 || column < 0) return;
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 128;
  input.value = initial ?? rateDraft.rows[row][column];
  input.setAttribute("aria-label", sheetColumns[column] + ", row " + (row + 1));
  input.spellcheck = false;
  input.autocomplete = "off";
  editor = { input, row, column };
  sheetCell(row, column).replaceChildren(input);
  input.addEventListener("blur", () => finishCellEdit(), { once: true });
  input.focus({ preventScroll: true });
  input.setSelectionRange(input.value.length, input.value.length);
}

function clearSelection() {
  if (!selection) return;
  const { top, bottom, left, right } = selectionBounds();
  const rows = rateDraft.rows.slice();
  let changed = false;
  for (let row = top; row <= bottom; row++) {
    if (!rows[row].slice(left, right + 1).some(Boolean)) continue;
    rows[row] = rows[row].map((value, column) => column >= left && column <= right ? "" : value);
    changed = true;
  }
  if (changed) changeRows(rows);
}

function copyCells(event) {
  if (editor || !selection || !event.clipboardData) return;
  const { top, bottom, left, right } = selectionBounds();
  const copied = rateDraft.rows.slice(top, bottom + 1).map((row) =>
    row.slice(left, right + 1).join("\t")
  );
  event.preventDefault();
  event.clipboardData.setData("text/plain", copied.join("\n"));
  if (event.type === "cut") clearSelection();
}

function pasteCells(event) {
  if (editor || !event.clipboardData || !rateDraft) return;
  event.preventDefault();
  const text = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n").replace(/\n$/, "");
  if (!text) return;
  const cells = text.split("\n").map((line) => line.split("\t"));
  const { top, left } = selectionBounds() ?? { top: 0, left: 0 };
  if (left === 0 && sheetColumns.every((label, index) => cells[0][index]?.trim().toUpperCase() === label.toUpperCase())) {
    cells.shift();
  }
  if (!cells.length) return;
  if (top + cells.length > maxSheetRows || cells.some((row) => row.length + left > sheetColumns.length)) {
    sheetStatus("The pasted range must fit within the five rate columns and 20,000 rows.", true);
    return;
  }
  if (cells.some((row) => row.some((cell) => cell.length > 128))) {
    sheetStatus("Use up to 128 characters in each rate or date cell.", true);
    return;
  }
  const rows = rateDraft.rows.slice();
  cells.forEach((pasted, index) => {
    const row = top + index;
    rows[row] = rows[row]?.slice() ?? blankRow();
    pasted.forEach((value, column) => { rows[row][left + column] = value; });
  });
  changeRows(rows);
  selectPosition(top, left, false, false);
  selectPosition(top + cells.length - 1, left + Math.max(...cells.map((row) => row.length)) - 1, true);
}

function setColumnWidth(column, width) {
  columnWidths[column] = Math.round(Math.max(64, Math.min(540, width)));
  fitSheetColumns();
}

sheetTable.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.target === editor?.input) return;
  const edge = event.target.closest("[data-resize]");
  if (edge) {
    event.preventDefault();
    const column = Number(edge.dataset.resize);
    resize = { column, start: event.clientX, width: edge.parentElement.getBoundingClientRect().width };
    edge.setPointerCapture(event.pointerId);
    return;
  }
  if (event.pointerType === "touch") return;
  const position = locateCell(event.target);
  if (!position) return;
  event.preventDefault();
  finishCellEdit();
  sheetTable.focus({ preventScroll: true });
  selectPosition(position.row, position.column, event.shiftKey, false);
  dragging = true;
});

sheetTable.addEventListener("pointerover", (event) => {
  if (!dragging || !event.buttons || !selection) return;
  const next = locateCell(event.target);
  const { anchor, end } = selection;
  if (!next || (next.row === end.row && next.column === end.column)) return;
  if ((anchor.row < 0) !== (next.row < 0) || (anchor.column < 0) !== (next.column < 0)) return;
  selectPosition(next.row, next.column, true, false);
});

sheetTable.addEventListener("pointermove", (event) => {
  if (resize) setColumnWidth(resize.column, resize.width + event.clientX - resize.start);
});
for (const event of ["pointerup", "pointercancel"]) {
  window.addEventListener(event, () => { dragging = false; resize = null; });
}

sheetTable.addEventListener("click", (event) => {
  if (event.pointerType !== "touch" || event.target === editor?.input || event.target.closest("[data-resize]")) return;
  const position = locateCell(event.target);
  if (!position) return;
  const alreadySelected = selection?.end.row === position.row && selection.end.column === position.column;
  finishCellEdit();
  sheetTable.focus({ preventScroll: true });
  selectPosition(position.row, position.column);
  if (alreadySelected) beginCellEdit();
});

sheetTable.addEventListener("dblclick", (event) => {
  const edge = event.target.closest("[data-resize]");
  if (edge) {
    const column = Number(edge.dataset.resize);
    const context = document.createElement("canvas").getContext("2d");
    context.font = getComputedStyle(sheetTable).font;
    const width = rateDraft.rows.reduce((longest, row) =>
      Math.max(longest, context.measureText(displayValue(row[column], column)).width), 62);
    setColumnWidth(column, width + 26);
  } else if (event.target !== editor?.input && selection) {
    beginCellEdit();
  }
});

sheetTable.addEventListener("focus", () => {
  if (rateDraft && !selection) selectPosition(sheetPage * sheetPageSize, 0, false, false);
});

sheetTable.addEventListener("keydown", (event) => {
  if (event.isComposing || !rateDraft) return;
  const command = event.ctrlKey || event.metaKey;
  const key = event.key;
  if (editor) {
    if (!["Enter", "Tab", "Escape"].includes(key)) return;
    event.preventDefault();
    const { row, column } = editor;
    finishCellEdit(key !== "Escape");
    sheetTable.focus({ preventScroll: true });
    if (key === "Enter") selectPosition(Math.max(0, Math.min(rateDraft.rows.length - 1, row + (event.shiftKey ? -1 : 1))), column);
    else if (key === "Tab") moveSheetCursor(row, column, 0, event.shiftKey ? -1 : 1, true);
    return;
  }
  if (!selection) return;
  const { row, column } = selection.end;
  if (command && ["z", "y"].includes(key.toLowerCase())) {
    event.preventDefault();
    sheetUndo(key.toLowerCase() === "z" && !event.shiftKey);
  } else if (command && key.toLowerCase() === "a") {
    event.preventDefault();
    selectPosition(-1, -1);
  } else if (key === " " && (command || event.shiftKey)) {
    event.preventDefault();
    selectPosition(command ? -1 : Math.max(0, row), command ? Math.max(0, column) : -1);
  } else if (key === "Delete" || key === "Backspace") {
    event.preventDefault();
    clearSelection();
  } else if (key === "Escape") {
    selection = null;
    paintSelection();
    updateSheetActions();
  } else if (key === "F2") {
    event.preventDefault();
    beginCellEdit();
  } else if (key === "Enter" && !command) {
    event.preventDefault();
    moveSheetCursor(row, column, event.shiftKey ? -1 : 1, 0, false);
  } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)) {
    event.preventDefault();
    if (event.altKey && row === -1 && column >= 0 && ["ArrowLeft", "ArrowRight"].includes(key)) {
      setColumnWidth(column, sheetCell(-1, column).getBoundingClientRect().width + (key === "ArrowLeft" ? -12 : 12));
      return;
    }
    const rowOffset = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
    const columnOffset = key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0;
    if (key === "Home" || key === "End") {
      const last = key === "End";
      selectPosition(command ? (last ? rateDraft.rows.length - 1 : 0) : Math.max(0, row),
        last ? sheetColumns.length - 1 : 0, event.shiftKey);
    } else {
      moveSheetCursor(row, column, rowOffset, columnOffset, false, event.shiftKey);
    }
  } else if (key.length === 1 && !command && !event.altKey && row >= 0 && column >= 0) {
    event.preventDefault();
    beginCellEdit(key);
  }
});

function moveSheetCursor(row, column, rowOffset, columnOffset, wrap, extend = false) {
  let nextRow = row + rowOffset;
  let nextColumn = column + columnOffset;
  if (wrap && (nextColumn < 0 || nextColumn >= sheetColumns.length)) {
    nextColumn = nextColumn < 0 ? sheetColumns.length - 1 : 0;
    nextRow += columnOffset;
  }
  selectPosition(Math.min(rateDraft.rows.length - 1, Math.max(0, nextRow)),
    Math.min(sheetColumns.length - 1, Math.max(0, nextColumn)), extend);
}

for (const event of ["copy", "cut"]) sheetTable.addEventListener(event, copyCells);
sheetTable.addEventListener("paste", pasteCells);
new ResizeObserver(fitSheetColumns).observe(sheetViewport);

function sheetJson(data) {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}

async function openRateDataset(initial = false) {
  setSheetBusy(true);
  try {
    const data = await json(initial ? "/sheet?initial=1" : "/sheet");
    showSaved(data);
    if (data.initial) showDraft(draftWithRows(data.initial));
    invalidateDatasetModel();
    $("loading").hidden = true;
    $("simulator").hidden = false;
    refreshDraft(data.initial ? "Review imported rates" : data.version ? "Draft loaded" : "");
    if (data.load_error && !data.initial) sheetStatus(data.load_error, true);
  } catch (error) {
    if (initial) $("loading").textContent = "Could not open the rate sheet. " + error.message;
    else sheetStatus(error.message, true);
  } finally {
    setSheetBusy(false);
  }
}

async function storeRateDraft(run) {
  finishCellEdit();
  setSheetBusy(true);
  sheetStatus((run ? "Checking rates and running the model" : "Saving draft") + "…");
  const { rows, name, observations, filename } = rateDraft;
  let invalidCell;
  try {
    const data = await json(run ? "/confirm" : "/sheet", sheetJson({
      rows, name, observations, filename, version: draftVersion,
    }));
    const saved = run ? data.sheet : data;
    draftVersion = saved.version;
    rateDraft = { ...rateDraft, name: saved.name, observations: saved.observations, filename: saved.filename };
    savedDraft = rateDraft;
    $("dataset-name").value = saved.name;
    $("dataset-observations").value = saved.observations;
    if (run) applyDatasetModel(data.analysis);
    refreshDraft(run ? "Rates confirmed" : "Draft saved");
  } catch (error) {
    sheetStatus(error.message, true);
    const match = /^Row (\d+), (Date|ON|1M|3M|6M)\./.exec(error.message);
    if (match) invalidCell = [Number(match[1]) - 1, sheetColumns.indexOf(match[2])];
  } finally {
    setSheetBusy(false);
    if (invalidCell) {
      sheetTable.focus({ preventScroll: true });
      selectPosition(...invalidCell);
    }
  }
}

function exportRateDraft() {
  const safeCell = (value, column) => {
    const trimmed = value.trimStart();
    const safe = /^[=+@-]/.test(trimmed) && !(column && rateNumber.test(trimmed.replace(/%$/, "").trim()))
      ? "'" + value : value;
    return /[",\r\n]/.test(safe) ? '"' + safe.replaceAll('"', '""') + '"' : safe;
  };
  const rows = rateDraft.rows.slice();
  while (rows.length && !rows.at(-1).some((value) => value.trim())) rows.pop();
  const csv = [sheetColumns, ...rows].map((row) => row.map(safeCell).join(",")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  const name = rateDraft.name.replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-").trim();
  link.download = (name || "SOFR_rates") + ".csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("rate-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file || sheetBusy || (draftDirty() && !window.confirm("Replace the unsaved draft with this file?"))) return;
  setSheetBusy(true);
  sheetStatus("Importing rates…");
  try {
    const data = await json("/import?filename=" + encodeURIComponent(file.name), { method: "POST", body: file });
    showDraft(draftWithRows(data));
    invalidateDatasetModel();
    refreshDraft("Imported for review");
  } catch (error) {
    sheetStatus(error.message, true);
  } finally {
    setSheetBusy(false);
  }
});

for (const [id, key] of [["dataset-name", "name"], ["dataset-observations", "observations"]]) {
  $(id).addEventListener("input", (event) => {
    rateDraft = { ...rateDraft, [key]: event.target.value };
    invalidateDatasetModel();
    refreshDraft("Unsaved draft");
  });
}

$("insert-row").addEventListener("click", () => {
  const rows = rateDraft.rows.slice();
  const row = selection?.anchor.row >= 0 ? selectionBounds().top : rows.length;
  rows.splice(row, 0, blankRow());
  changeRows(rows);
  sheetTable.focus({ preventScroll: true });
  selectPosition(row, 0);
});

$("delete-rows").addEventListener("click", () => {
  const { top, bottom } = selectionBounds();
  const rows = rateDraft.rows.slice();
  rows.splice(top, bottom - top + 1);
  changeRows(rows);
  sheetTable.focus({ preventScroll: true });
  selectPosition(Math.min(top, rateDraft.rows.length - 1), 0);
});

$("clear-cells").addEventListener("click", () => { clearSelection(); sheetTable.focus({ preventScroll: true }); });
$("undo-sheet").addEventListener("click", () => sheetUndo());
$("redo-sheet").addEventListener("click", () => sheetUndo(false));
$("save-dataset").addEventListener("click", () => storeRateDraft(false));
$("confirm-dataset").addEventListener("click", () => storeRateDraft(true));
$("import-rates").addEventListener("click", () => $("rate-file").click());
$("curve-download").addEventListener("click", exportRateDraft);
$("revert-draft").addEventListener("click", () => {
  if (!draftDirty() || window.confirm("Reload the saved draft and discard unsaved edits?")) openRateDataset();
});
for (const [id, offset] of [["rates-prev", -1], ["rates-next", 1]]) {
  $(id).addEventListener("click", () => {
    sheetPage += offset;
    selection = null;
    renderRateSheet();
    sheetViewport.scrollTop = 0;
    updateSheetActions();
  });
}
