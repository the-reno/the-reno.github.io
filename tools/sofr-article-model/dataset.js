"use strict";

const modelSheetColumns = ["Date", "ON", "1M", "3M", "6M"];
const rateHeadings = new Set(modelSheetColumns.slice(1));
const decimalRate = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const sheetTable = $("rate-table");
let datasetDraft;
let datasetDirty = false;
let datasetBusy = false;
let sheetPage = 0;
let selectedSheetRow = -1;
let selectedSheetColumn = -1;

function sheetPageSize() {
  return Math.min(2000, Math.floor(8000 / datasetDraft.columns.length));
}

function updateDatasetDraftNotice() {
  $("dataset-draft-notice").hidden = !datasetDirty || activeStep === "dataset";
}

function updateDatasetActions() {
  const disabled = datasetBusy || !datasetDraft;
  $("save-dataset").disabled = disabled || !datasetDirty;
  $("discard-dataset").disabled = disabled || !datasetDirty;
  $("delete-row").disabled = disabled || selectedSheetRow < 0;
  $("delete-column").disabled = disabled || selectedSheetColumn < 0 || datasetDraft.columns.length === 1;
  $("add-column").disabled = disabled || datasetDraft.columns.length >= 512;
  $("rates-prev").disabled = disabled || sheetPage === 0;
  $("rates-next").disabled = disabled || (sheetPage + 1) * sheetPageSize() >= datasetDraft.rows.length;
}

function setDatasetBusy(busy) {
  datasetBusy = busy;
  $("rate-sheet").inert = busy;
  $("step-dataset").setAttribute("aria-busy", String(busy));
  for (const id of ["dataset", "new-dataset", "import-rates", "curve-download", "dataset-name",
    "dataset-observations", "add-row"]) {
    $(id).disabled = busy;
  }
  updateDatasetActions();
}

function datasetStatus(message, error = false) {
  const status = $("dataset-status");
  status.classList.toggle("error", error);
  if (status.textContent !== message) status.textContent = message;
}

function datasetRowsLabel() {
  const count = datasetDraft.rows.length;
  return number.format(count) + (count === 1 ? " row" : " rows");
}

function markDatasetDirty() {
  datasetDirty = true;
  updateDatasetActions();
  updateDatasetDraftNotice();
  datasetStatus(datasetRowsLabel() + " · Unsaved changes");
}

function selectSheetCell(row = -1, column = -1) {
  selectedSheetRow = row;
  selectedSheetColumn = column;
  for (const cell of sheetTable.querySelectorAll(".sheet-selected")) {
    cell.classList.remove("sheet-selected");
  }
  if (column >= 0) sheetTable.tHead.rows[0].cells[column + 1].classList.add("sheet-selected");
  if (row >= 0) sheetTable.tBodies[0].rows[row - sheetPage * sheetPageSize()].cells[0].classList.add("sheet-selected");
  updateDatasetActions();
}

function isRateColumn(column) {
  return rateHeadings.has(datasetDraft.columns[column].trim().toUpperCase());
}

function sheetDisplayValue(value, isRate) {
  if (!isRate) return value;
  const trimmed = value.trim();
  const percentage = trimmed.endsWith("%");
  const digits = percentage ? trimmed.slice(0, -1).trim() : trimmed;
  if (!decimalRate.test(digits)) return value;
  const rate = Number(digits) * (percentage ? 1 : 100);
  return Number.isFinite(rate) && Math.abs(rate) < 1000 ? rate.toFixed(4) + "%" : value;
}

function makeSheetInput(label, value) {
  const input = document.createElement("input");
  input.type = "text";
  input.size = 1;
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", label);
  input.value = value;
  return input;
}

function focusSheetCell(row, column) {
  const nextPage = Math.floor(row / sheetPageSize());
  if (nextPage !== sheetPage) {
    sheetPage = nextPage;
    renderRateSheet();
  }
  const rowElement = sheetTable.tBodies[0].rows[row - sheetPage * sheetPageSize()];
  rowElement.cells[column + 1].firstElementChild.focus();
}

function renderRateSheet() {
  const { columns, rows } = datasetDraft;
  const pageSize = sheetPageSize();
  sheetPage = Math.min(sheetPage, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  const start = sheetPage * pageSize;
  const end = Math.min(start + pageSize, rows.length);
  const header = document.createElement("tr");
  const indexHeader = document.createElement("th");
  indexHeader.scope = "col";
  indexHeader.textContent = "#";
  header.append(indexHeader);
  columns.forEach((heading, column) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    const label = "Column " + (column + 1);
    const input = makeSheetInput(label + " heading", heading);
    input.placeholder = label;
    input.addEventListener("focus", () => {
      selectSheetCell(-1, column);
      input.select();
    });
    input.addEventListener("input", () => {
      columns[column] = input.value;
      markDatasetDirty();
    });
    input.addEventListener("change", () => {
      const rate = isRateColumn(column);
      for (const [index, row] of Array.from(sheetTable.tBodies[0].rows).entries()) {
        const entry = row.cells[column + 1].firstElementChild;
        entry.classList.toggle("sheet-rate", rate);
        entry.value = sheetDisplayValue(rows[start + index][column], rate);
      }
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || start === end) return;
      event.preventDefault();
      focusSheetCell(start, column);
    });
    cell.append(input);
    header.append(cell);
  });
  sheetTable.tHead.replaceChildren(header);

  const page = document.createDocumentFragment();
  for (let rowIndex = start; rowIndex < end; rowIndex++) {
    const cells = rows[rowIndex];
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.scope = "row";
    const index = document.createElement("button");
    index.type = "button";
    index.textContent = number.format(rowIndex + 1);
    index.setAttribute("aria-label", "Select row " + (rowIndex + 1));
    index.addEventListener("focus", () => selectSheetCell(rowIndex));
    index.addEventListener("click", () => selectSheetCell(rowIndex));
    heading.append(index);
    row.append(heading);
    cells.forEach((value, column) => {
      const label = "Row " + (rowIndex + 1) + ", column " + (column + 1);
      const input = makeSheetInput(label, sheetDisplayValue(value, isRateColumn(column)));
      input.classList.toggle("sheet-rate", isRateColumn(column));
      input.addEventListener("focus", () => {
        selectSheetCell(rowIndex, column);
        input.value = cells[column];
        input.select();
      });
      input.addEventListener("blur", () => { input.value = sheetDisplayValue(cells[column], isRateColumn(column)); });
      input.addEventListener("input", () => {
        cells[column] = input.value;
        markDatasetDirty();
      });
      input.addEventListener("keydown", (event) => {
        if (!["ArrowUp", "ArrowDown", "Enter"].includes(event.key) || event.isComposing) return;
        event.preventDefault();
        const up = event.key === "ArrowUp" || (event.key === "Enter" && event.shiftKey);
        const target = rowIndex + (up ? -1 : 1);
        if (target >= 0 && target < rows.length) focusSheetCell(target, column);
      });
      const cell = document.createElement("td");
      cell.append(input);
      row.append(cell);
    });
    page.append(row);
  }
  sheetTable.tBodies[0].replaceChildren(page);
  $("sheet-pages").hidden = rows.length <= pageSize;
  $("rate-rows").textContent = number.format(start + 1) + "–" + number.format(end) + " of " + number.format(rows.length);
  selectSheetCell();
}

function startDatasetDraft(draft, name, observations) {
  datasetDraft = draft;
  datasetDirty = false;
  sheetPage = 0;
  $("dataset").value = draft.id;
  $("dataset-name").value = name;
  $("dataset-observations").value = observations;
  renderRateSheet();
  $("rate-sheet").scrollTop = 0;
  $("rate-sheet").scrollLeft = 0;
  updateDatasetDraftNotice();
}

function loadDatasetEditor(data) {
  const { model_id: id, datasets, sheet } = data;
  const active = datasets.find((record) => record.id === id);
  $("dataset").replaceChildren(...datasets.map((record) => new Option(record.name, record.id)));
  startDatasetDraft({
    id, columns: sheet.columns.slice(), rows: sheet.rows.map((row) => row.slice()), version: sheet.version,
  }, active.name, active.observations);
}

async function selectDataset(url, options, progress = "Loading the dataset…", done = "") {
  if (datasetBusy) return;
  setDatasetBusy(true);
  datasetStatus(progress);
  try {
    const data = await json(url, options);
    loadDatasetEditor(data);
    applyDatasetModel(data);
    const status = [datasetRowsLabel(), done, data.model_error].filter(Boolean);
    datasetStatus(status.join(" · "), Boolean(data.model_error));
  } catch (error) {
    if (datasetDraft) {
      $("dataset").value = datasetDraft.id;
      datasetStatus(error.message, true);
    } else {
      $("loading").textContent = "The model could not load. " + error.message;
    }
  } finally {
    setDatasetBusy(false);
  }
}

function allowDraftReplacement() {
  return !datasetDirty || window.confirm("Discard unsaved changes to this dataset?");
}

function downloadDataset() {
  const { columns, rows } = datasetDraft;
  const csvRow = (row) => row.map((cell) => /[",\r\n]/.test(cell) || row.length === 1
    ? '"' + cell.replaceAll('"', '""') + '"'
    : cell).join(",") + "\r\n";
  const csv = new Blob(["\uFEFF", csvRow(columns), rows.map(csvRow).join("")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(csv);
  const link = document.createElement("a");
  const name = $("dataset-name").value.trim().replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-");
  link.download = (name || "SOFR_rates") + ".csv";
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("dataset").addEventListener("change", (event) => {
  if (allowDraftReplacement()) {
    selectDataset("/model?model=" + encodeURIComponent(event.target.value));
  } else {
    event.target.value = datasetDraft.id;
  }
});
$("new-dataset").addEventListener("click", () => {
  if (!allowDraftReplacement()) return;
  if (!$("dataset").querySelector('option[value=""]')) {
    $("dataset").add(new Option("New dataset", ""));
  }
  const columns = modelSheetColumns.slice();
  startDatasetDraft({ id: "", columns, rows: [columns.map(() => "")], version: null }, "Untitled dataset", "");
  markDatasetDirty();
  $("dataset-name").focus();
  $("dataset-name").select();
});
$("import-rates").addEventListener("click", () => $("rate-file").click());
$("rate-file").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file && allowDraftReplacement()) {
    const query = "?filename=" + encodeURIComponent(file.name);
    selectDataset("/model" + query, { method: "POST", body: file }, "Importing the CSV…", "Imported");
  }
  event.target.value = "";
});
$("curve-download").addEventListener("click", downloadDataset);
$("dataset-details").addEventListener("input", markDatasetDirty);
$("dataset-details").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!datasetDirty) return;
  const { id, columns, rows, version } = datasetDraft;
  const body = JSON.stringify({
    columns, rows, version, name: $("dataset-name").value, observations: $("dataset-observations").value,
  });
  const query = id ? "?model=" + encodeURIComponent(id) : "";
  selectDataset("/sheet" + query, {
    method: "POST", headers: { "Content-Type": "application/json" }, body,
  }, "Saving changes…", "Saved");
});
$("discard-dataset").addEventListener("click", () => {
  loadDatasetEditor(defaults);
  datasetStatus(defaults.model_error || datasetRowsLabel(), Boolean(defaults.model_error));
});

$("add-row").addEventListener("click", () => {
  const { columns, rows } = datasetDraft;
  const row = rows.push(columns.map(() => "")) - 1;
  sheetPage = Math.floor(row / sheetPageSize());
  renderRateSheet();
  focusSheetCell(row, 0);
  markDatasetDirty();
});
$("delete-row").addEventListener("click", () => {
  const { rows } = datasetDraft;
  const row = selectedSheetRow;
  const column = Math.max(0, selectedSheetColumn);
  rows.splice(row, 1);
  renderRateSheet();
  if (rows.length) focusSheetCell(Math.min(row, rows.length - 1), column);
  markDatasetDirty();
});
$("add-column").addEventListener("click", () => {
  const { columns, rows } = datasetDraft;
  const firstRow = sheetPage * sheetPageSize();
  columns.push("");
  for (const row of rows) row.push("");
  sheetPage = Math.floor(firstRow / sheetPageSize());
  renderRateSheet();
  sheetTable.tHead.rows[0].lastElementChild.firstElementChild.focus();
  markDatasetDirty();
});
$("delete-column").addEventListener("click", () => {
  const { columns, rows } = datasetDraft;
  const firstRow = sheetPage * sheetPageSize();
  const column = selectedSheetColumn;
  columns.splice(column, 1);
  for (const row of rows) row.splice(column, 1);
  sheetPage = Math.floor(firstRow / sheetPageSize());
  renderRateSheet();
  sheetTable.tHead.rows[0].cells[Math.min(column + 1, columns.length)].firstElementChild.focus();
  markDatasetDirty();
});
for (const [id, offset] of [["rates-prev", -1], ["rates-next", 1]]) {
  $(id).addEventListener("click", () => {
    sheetPage += offset;
    renderRateSheet();
    $("rate-sheet").scrollTop = 0;
  });
}
