"use strict";

let reviewedDatasetId;
let datasetBusy = false;

function enableColumnResizing() {
  const table = $("rate-table");
  const headings = Array.from(table.tHead.rows[0].cells);
  const columns = Array.from(table.querySelectorAll("col"));
  let widths;

  function setWidth(index, width, minimum) {
    if (!widths) {
      widths = headings.map((heading) => Math.round(heading.getBoundingClientRect().width));
      columns.forEach((column, i) => { column.style.width = widths[i] + "px"; });
      table.classList.add("columns-resized");
    }
    widths[index] = Math.round(Math.max(minimum, Math.min(width, 640)));
    columns[index].style.width = widths[index] + "px";
    table.style.width = widths.reduce((total, part) => total + part, 0) + "px";
  }

  const handles = headings.map((heading, index) => {
    const name = heading.textContent.trim();
    const minimum = index === 0 ? 120 : 96;
    const handle = document.createElement("span");
    handle.className = "column-resizer";
    handle.tabIndex = 0;
    handle.title = "Resize " + name + " column";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-label", handle.title);
    handle.setAttribute("aria-controls", table.id);
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-valuemin", minimum);
    handle.setAttribute("aria-valuemax", "640");
    let drag;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || drag) return;
      event.preventDefault();
      drag = { pointer: event.pointerId, start: event.clientX, width: heading.getBoundingClientRect().width };
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("dragging");
    });
    handle.addEventListener("pointermove", (event) => {
      if (drag?.pointer === event.pointerId) {
        setWidth(index, drag.width + event.clientX - drag.start, minimum);
      }
    });
    handle.addEventListener("lostpointercapture", () => {
      drag = null;
      handle.classList.remove("dragging");
    });
    handle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const change = event.key === "ArrowLeft" ? -12 : 12;
      setWidth(index, heading.getBoundingClientRect().width + change, minimum);
    });
    heading.append(handle);
    return handle;
  });

  new ResizeObserver(() => {
    headings.forEach((heading, index) => {
      const width = heading.getBoundingClientRect().width;
      if (width) handles[index].setAttribute("aria-valuenow", Math.round(width));
    });
  }).observe(table);
}

function setDatasetStatus(message, isError = false) {
  const status = $("dataset-status");
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle("error", isError);
}

function setDatasetBusy(busy) {
  datasetBusy = busy;
  $("step-dataset").setAttribute("aria-busy", String(busy));
  $("import-rates").disabled = busy;
  $("confirm-dataset").disabled = busy || !reviewedDatasetId;
}

function showRateDataset(dataset) {
  const rows = document.createDocumentFragment();
  for (const [date, ...rates] of dataset.rows) {
    rows.append(row(date, rates.map(quote)));
  }
  $("rate-table").tBodies[0].replaceChildren(rows);
  $("rate-sheet").scrollTop = 0;
  $("rate-sheet").scrollLeft = 0;
  const first = prettyDate(dataset.rows[0][0]);
  const last = prettyDate(dataset.rows.at(-1)[0]);
  const count = number.format(dataset.rows.length);
  $("dataset-source").textContent = dataset.name + " · " + count + " rows · " + first + " – " + last;
  reviewedDatasetId = dataset.dataset_id;
  $("confirm-dataset").hidden = false;
}

async function openRateDataset() {
  setDatasetBusy(true);
  try {
    showRateDataset(await json("/sheet"));
    $("loading").hidden = true;
    $("simulator").hidden = false;
    selectStep("dataset");
  } catch (error) {
    $("loading").textContent = "Could not load rates. " + error.message;
  } finally {
    setDatasetBusy(false);
  }
}

$("import-rates").addEventListener("click", () => $("rate-file").click());
enableColumnResizing();
$("rate-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file || datasetBusy) return;
  setDatasetBusy(true);
  setDatasetStatus("Loading " + file.name + "…");
  try {
    const dataset = await json("/import?filename=" + encodeURIComponent(file.name), { method: "POST", body: file });
    showRateDataset(dataset);
    invalidateDatasetModel();
    setDatasetStatus("");
  } catch (error) {
    setDatasetStatus(error.message, true);
  } finally {
    setDatasetBusy(false);
  }
});

$("confirm-dataset").addEventListener("click", async () => {
  if (datasetBusy || !reviewedDatasetId || defaults) return;
  setDatasetBusy(true);
  setDatasetStatus("Running the model…");
  try {
    const data = await json("/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: reviewedDatasetId }),
    });
    applyDatasetModel(data);
    $("confirm-dataset").hidden = true;
    setDatasetStatus("");
  } catch (error) {
    setDatasetStatus(error.message, true);
  } finally {
    setDatasetBusy(false);
  }
});
