"use strict";

let reviewedDatasetId;
let datasetBusy = false;

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
