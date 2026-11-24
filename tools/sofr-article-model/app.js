"use strict";

const $ = (id) => document.getElementById(id);
const weightInputs = ["weight-1m", "weight-3m", "weight-6m"].map($);
const dayMs = 86_400_000;
const fullDate = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC"
});
const chartDate = new Intl.DateTimeFormat("en-US", {
  month: "short", year: "numeric", timeZone: "UTC"
});
const currencyOptions = { style: "currency", currency: "USD", maximumFractionDigits: 0 };
const currency = new Intl.NumberFormat("en-US", currencyOptions);
const signedCurrency = new Intl.NumberFormat("en-US", {
  ...currencyOptions, signDisplay: "exceptZero"
});
const number = new Intl.NumberFormat("en-US");
const signedNumber = new Intl.NumberFormat("en-US", { signDisplay: "exceptZero" });

let defaults;
let latest;
let presets;
let revision = 0;
let pending;

const percent = (rate) => (100 * rate).toFixed(2) + "%";
const bp = (value) => value.toFixed(2) + " bp";
const dateAt = (day) => new Date(Date.parse(defaults.anchor_date) + day * dayMs);
const isoAt = (day) => dateAt(day).toISOString().slice(0, 10);
const prettyDate = (iso) => fullDate.format(new Date(iso));

async function json(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "The scenario could not be calculated.");
  return body;
}

function setError(message) {
  $("input-error").textContent = message;
  $("input-error").hidden = !message;
  $("download").hidden = Boolean(message);
}

function getInputs() {
  const term = weightInputs.map((input) => input.valueAsNumber);
  const on = 100 - term.reduce((total, value) => total + value, 0);
  const shift = $("shift").valueAsNumber;
  $("shift-label").textContent = signedNumber.format(shift) + " bp";
  const weightsValid = term.every((value) => Number.isInteger(value) && value >= 0) && on >= 0;
  $("on").value = weightsValid ? on : "–";
  const matchKey = [on, ...term].join(",");
  for (const preset of presets) {
    preset.button.setAttribute("aria-pressed", String(preset.weights.join(",") === matchKey));
  }
  if (!weightsValid) throw new Error("Enter whole-percent term weights that add to 100% or less.");
  if (!$("amount").checkValidity()) throw new Error("Enter a USD cash amount between $1 and $1 trillion.");
  if (!$("entry-date").checkValidity()) throw new Error("Choose an entry date shown in the calendar.");
  const entry = (Date.parse($("entry-date").value) - Date.parse(defaults.anchor_date)) / dayMs;
  return new URLSearchParams({
    scenario: $("scenario").value, amount: $("amount").value,
    start: entry, weights: matchKey, shift, model: defaults.model_id
  }).toString();
}

function scheduleRun() {
  const id = ++revision;
  clearTimeout(pending);
  let query;
  try {
    query = getInputs();
  } catch (error) {
    setError(error.message);
    return;
  }
  setError("");
  $("download").hidden = true;
  pending = setTimeout(async () => {
    try {
      const run = await json("/simulate?" + query);
      if (id !== revision) return;
      renderRun(run);
      $("download").href = "/results.csv?" + query;
      $("download").hidden = false;
    } catch (error) {
      if (id === revision) setError(error.message);
    }
  }, 90);
}

function row(label, values, selected) {
  const tr = document.createElement("tr");
  const th = document.createElement("th");
  th.scope = "row";
  th.textContent = label;
  tr.append(th);
  for (const value of values) {
    const td = document.createElement("td");
    td.textContent = value;
    tr.append(td);
  }
  if (selected) tr.classList.add("selected");
  return tr;
}

function renderRun(run) {
  latest = run;
  $("window").textContent = defaults.profile === "july" ? "36 model months · 30 days per month" :
    prettyDate(run.start_date) + " to " + prettyDate(run.end_date);
  $("interest").textContent = currency.format(run.interest);
  $("incremental").textContent = signedCurrency.format(run.incremental_interest);
  $("incremental").classList.toggle("positive", Math.round(run.incremental_interest) > 0);
  $("incremental").classList.toggle("negative", Math.round(run.incremental_interest) < 0);
  $("constraint-note").hidden = run.within_constraints;
  $("constraint-note").textContent = defaults.profile === "july" ?
    "The July search requires at least 10% ON, 15% in 1M, and 50% inside 3M." :
    "The search requires at least " + defaults.min_short_pct + "% in ON and 1M combined and at most " +
    defaults.max_six_month_pct + "% in 6M.";

  const benchmarkRows = [row("Your mix", [currency.format(run.interest), percent(run.annual_return)], true)];
  for (const benchmark of run.benchmarks) {
    benchmarkRows.push(row("100% " + benchmark.tenor, [
      currency.format(benchmark.interest), percent(benchmark.annual_return)
    ]));
  }
  $("benchmarks").tBodies[0].replaceChildren(...benchmarkRows);

  const comparisonRows = run.by_scenario.map((scenario) => {
    const active = scenario.name === run.scenario;
    const label = active && run.shift_bp ? scenario.name + " (adjusted)" : scenario.name;
    return row(label, [percent(scenario.average_annual_return), bp(scenario.worst_regret_bp)], active);
  });
  $("stress").tBodies[0].replaceChildren(...comparisonRows);
  $("stress").tFoot.replaceChildren(row("Worst across paths", ["", bp(run.worst_regret_bp)]));
  drawRateChart();
}

function drawRateChart() {
  if (!latest) return;
  const canvas = $("rate-chart");
  const rect = canvas.getBoundingClientRect();
  const { width, height } = rect;
  if (width <= 0 || height <= 0) return;
  const dpi = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpi);
  canvas.height = Math.round(height * dpi);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpi, dpi);

  const left = 38;
  const right = width - 14;
  const top = 12;
  const bottom = height - 28;
  const observed = latest.path.flatMap((point) => point.slice(1)).map((value) => 100 * value);
  const low = Math.floor((Math.min(...observed) - 0.1) * 2) / 2;
  const high = Math.ceil((Math.max(...observed) + 0.1) * 2) / 2;
  const x = (day) => left + (right - left) * day / defaults.horizon_days;
  const y = (pct) => top + (bottom - top) * (high - pct) / (high - low);

  const xStart = x(latest.start_day);
  const xEnd = x(latest.end_day);
  ctx.fillStyle = "#dcebea";
  ctx.fillRect(xStart, top, xEnd - xStart, bottom - top);
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const step = high - low > 3 ? 1 : 0.5;
  for (let value = low; value <= high; value += step) {
    ctx.beginPath();
    ctx.strokeStyle = "#d8ddd9";
    ctx.moveTo(left, y(value));
    ctx.lineTo(right, y(value));
    ctx.stroke();
    ctx.fillStyle = "#465b68";
    ctx.fillText(value.toFixed(1), left - 7, y(value));
  }

  const july = defaults.profile === "july";
  const days = july ? [0, 360, 720, defaults.horizon_days] : [0, 365, 730, defaults.horizon_days];
  for (const [index, day] of days.entries()) {
    ctx.textAlign = index === 0 ? "left" : index === days.length - 1 ? "right" : "center";
    ctx.fillStyle = "#465b68";
    ctx.fillText(july ? "Month " + day / 30 : chartDate.format(dateAt(day)), x(day), height - 10);
  }

  const lines = [[1, "#226a73", []]];
  if (!july) lines.push([2, "#a24019", [7, 4]]);
  for (const [column, color, dashed] of lines) {
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.setLineDash(dashed);
    latest.path.forEach((point, index) => {
      if (index === 0) ctx.moveTo(x(point[0]), y(100 * point[column]));
      else ctx.lineTo(x(point[0]), y(100 * point[column]));
    });
    ctx.stroke();
  }
  canvas.setAttribute("aria-label", latest.scenario +
    (july ? ". Common rate across the 36-month scenario." : ". Overnight and six-month rates, with the selected window highlighted."));
}

function setupCalculator(config) {
  latest = null;
  defaults = config;
  const july = defaults.profile === "july";
  $("scenario").replaceChildren(...defaults.scenarios.map((label, index) => new Option(label, index)));
  $("entry-date").min = defaults.anchor_date;
  $("entry-date").max = isoAt(defaults.last_start_day);
  $("entry-date").value = defaults.anchor_date;
  $("entry-date").disabled = july;
  if (!$("amount").value) $("amount").value = defaults.start_amount;
  $("shift").value = 0;
  $("shift-control").hidden = july;
  $("term-legend").hidden = july;
  $("interest-label").textContent = july ? "Interest over 36 model months" : "Interest over 180 days";
  $("stress-hint").textContent = july ? "Annualized gap to each path’s best pure tenor." :
    "Largest annualized gap to the best pure tenor across all 180-day starts.";
  presets = july ? [{ label: "Article mix", weights: defaults.reference.weights }] : [
    { label: "Reference mix", weights: defaults.reference.weights },
    { label: "Minimum regret", weights: defaults.minimax.weights }
  ];
  presets.push({ label: "All ON", weights: [100, 0, 0, 0] }, { label: "All 6M", weights: [0, 0, 0, 100] });
  $("presets").replaceChildren(...presets.map((preset) => {
    preset.button = document.createElement("button");
    preset.button.type = "button";
    preset.button.textContent = preset.label;
    preset.button.addEventListener("click", () => {
      weightInputs.forEach((input, index) => { input.value = preset.weights[index + 1]; });
      scheduleRun();
    });
    return preset.button;
  }));
  presets[0].button.click();
}

$("controls").addEventListener("input", scheduleRun);
$("controls").addEventListener("submit", (event) => {
  event.preventDefault();
  scheduleRun();
});
new ResizeObserver(drawRateChart).observe($("rate-chart"));
