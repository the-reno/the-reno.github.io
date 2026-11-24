"use strict";

const palette = ["#176873", "#4e648e", "#795786", "#a24019", "#906406"];
const pageSize = 12;
const tabs = Array.from(document.querySelectorAll(".steps [role=tab]"));
let activeStep = "rates";
let historyView = "timeline";
let ratePage = 0;

const series = (label, color, points, extra = {}) => ({ label, color, points, ...extra });
const percentAxis = (value) => value.toFixed(1) + "%";
const bpAxis = (value) => Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
const dateAxis = (value) => chartDate.format(new Date(value));
const quote = (rate) => (rate * 100).toFixed(4) + "%";
const signedBp = (value) => (value > 0 ? "+" : "") + bp(value);
const mixLabel = (weights) => weights.flatMap((weight, index) =>
  weight ? [weight + "% " + defaults.tenors[index]] : []
).join(" / ");

function setLegend(id, lines) {
  $(id).replaceChildren(...lines.map(({ label, color, dots, dashed }) => {
    const item = document.createElement("span");
    const key = document.createElement("i");
    key.className = dots ? "chart-key dot" : "chart-key";
    if (dashed) key.classList.add("dashed");
    key.style.setProperty("--series-color", color);
    item.append(key, label);
    return item;
  }));
}

function drawPlot(canvas, lines, { formatX, formatY, includeZero = false }) {
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height || !lines.length) return;
  const dpi = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpi);
  canvas.height = Math.round(height * dpi);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpi, dpi);
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = includeZero ? 0 : Infinity;
  let yMax = includeZero ? 0 : -Infinity;
  for (const line of lines) {
    for (const [x, y] of line.points) {
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
  }
  if (!Number.isFinite(xMin)) return;
  const padding = (yMax - yMin || Math.max(Math.abs(yMax), 1)) * 0.08;
  yMin -= padding;
  yMax += padding;
  const left = 55;
  const right = width - 14;
  const top = 12;
  const bottom = height - 29;
  const xAt = (x) => left + (right - left) * (x - xMin) / (xMax - xMin || 1);
  const yAt = (y) => bottom - (bottom - top) * (y - yMin) / (yMax - yMin);
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#465b68";
  for (let i = 0; i <= 4; i++) {
    const value = yMin + i * (yMax - yMin) / 4;
    const y = yAt(value);
    ctx.strokeStyle = "#d8ddd9";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillText(formatY(value), left - 8, y);
  }
  if (includeZero) {
    ctx.strokeStyle = "#839397";
    ctx.beginPath();
    ctx.moveTo(left, yAt(0));
    ctx.lineTo(right, yAt(0));
    ctx.stroke();
  }
  const countX = xMin === xMax ? 0 : width < 520 ? 2 : 4;
  for (let i = 0; i <= countX; i++) {
    const value = xMin + i * (xMax - xMin) / (countX || 1);
    ctx.textAlign = i === 0 ? "left" : i === countX ? "right" : "center";
    ctx.fillText(formatX(value), xAt(value), height - 11);
  }
  for (const { color, points, dots, dashed } of lines) {
    if (dots) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.42;
      for (const [x, y] of points) {
        ctx.beginPath();
        ctx.arc(xAt(x), yAt(y), 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.beginPath();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = color;
    ctx.setLineDash(dashed ? [6, 4] : []);
    points.forEach(([x, y], i) => i ? ctx.lineTo(xAt(x), yAt(y)) : ctx.moveTo(xAt(x), yAt(y)));
    ctx.stroke();
  }
}

function snapshots(id, items) {
  $(id).replaceChildren(...items.map(([label, value]) => {
    const item = document.createElement("div");
    const key = document.createElement("dt");
    const output = document.createElement("dd");
    key.textContent = label;
    output.textContent = value;
    item.append(key, output);
    return item;
  }));
}

function renderRatePage() {
  const start = ratePage * pageSize;
  const datedRows = defaults.rates.slice(start, start + pageSize);
  $("rate-table").tBodies[0].replaceChildren(...datedRows.map(([day, ...rates]) =>
    row(prettyDate(day), rates.map(quote))
  ));
  $("rates-prev").disabled = start === 0;
  $("rates-next").disabled = start + pageSize >= defaults.observations;
  $("rate-rows").textContent = number.format(start + 1) + "–" + number.format(start + datedRows.length) +
    " of " + number.format(defaults.observations) + " observations";
}

function renderRates() {
  $("asof").textContent = "As of " + prettyDate(defaults.anchor_date);
  const source = $("rate-source");
  source.textContent = prettyDate(defaults.historical_start) + " – " +
    prettyDate(defaults.anchor_date) + " · " + defaults.source_name;
  if (defaults.source_url) {
    const link = document.createElement("a");
    link.href = defaults.source_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = defaults.source_label;
    source.append(" · ", link);
  } else if (defaults.source_label) {
    source.append(" · " + defaults.source_label);
  }
  const quotes = defaults.tenors.map((tenor) => [tenor, percent(defaults.curve[tenor])]);
  quotes.push(["6M − ON", signedBp((defaults.curve["6M"] - defaults.curve.ON) * 10000)]);
  snapshots("rate-snapshot", quotes);
  $("rate-summary").tBodies[0].replaceChildren(...defaults.rate_summary.rows.map(([label, on, term, spread]) =>
    row(label, [quote(on), quote(term), signedBp(spread)])
  ));
  $("rolling-note").textContent = defaults.rate_summary.common_maturity ?
    "The strategy returns share the final completed 6M maturity of " +
      prettyDate(defaults.rate_summary.common_maturity) + " and use 365-day annualization." : "";
  ratePage = Math.floor((defaults.observations - 1) / pageSize);
  renderRatePage();
}

function selectDecision() {
  const entry = defaults.windows[$("decision-date").selectedIndex];
  if (!entry) return;
  const values = [
    ["Starting ON quote", quote(entry.start_on_rate)],
    ["Starting 6M quote", quote(entry.start_six_month_rate)],
    ["6M − ON quoted spread", signedBp(entry.spread_bp)],
    ["Unadjusted maturity", prettyDate(entry.unadjusted_maturity)],
    ["Adjusted maturity", prettyDate(entry.maturity)],
    ["Actual accrual days", entry.days],
    ["Compounded ON holding return", quote(entry.on_return)],
    ["Locked 6M holding return", quote(entry.six_month_return)],
    ["6M − ON realized excess", signedBp(entry.excess_bp)]
  ];
  $("decision-table").tBodies[0].replaceChildren(...values.map(([name, value]) => row(name, [value])));
}

function renderHistory() {
  const { history, windows } = defaults;
  $("history-empty").hidden = Boolean(history.count);
  $("history-results").hidden = !history.count;
  $("decision-details").hidden = !history.count;
  $("history-download").hidden = !history.count;
  if (!history.count) return;
  snapshots("history-metrics", [
    ["Completed decisions", number.format(history.count)],
    ["6M win rate", percent(history.win_rate)],
    ["Average 6M excess", signedBp(history.average_excess_bp)]
  ]);
  const options = document.createDocumentFragment();
  windows.forEach(({ start }, index) => options.append(new Option(prettyDate(start), index)));
  $("decision-date").replaceChildren(options);
  selectDecision();
}

function renderCycle() {
  const summary = defaults.mirror_summary;
  const labels = ["6M excess vs. ON", "Rates up", "Rates down"];
  const heading = document.createElement("tr");
  for (const label of labels) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    heading.append(th);
  }
  $("mirror-table").tHead.replaceChildren(heading);
  const rows = [];
  if (defaults.archive) rows.push(row("Article values · archived", defaults.archive.reported_cycle.map((item) => signedBp(item[1]))));
  if (summary.first && defaults.archive) rows.push(row("July workbook · first decision", summary.first.map(signedBp)));
  if (summary.mean) rows.push(row("Average across " + number.format(defaults.history.count) + " decisions", summary.mean.map(signedBp), true));
  $("mirror-table").tBodies[0].replaceChildren(...rows);
  $("cycle-note").textContent = defaults.archive ?
    "The article workbook supplies two chart values. The calculated rows show the audit workbook’s first decision and the average over all eligible starts." :
    "Excess is locked 6M interest minus compounded overnight interest, measured in holding-period basis points.";
  if (!rows.length) $("cycle-note").textContent = "A complete six-month window is needed to calculate excess.";
}

function renderScenarios() {
  const july = defaults.profile === "july";
  $("scenario-method").textContent = july ?
    "Interpolate the supplied six-month rate nodes into 30-day months. Roll each strategy from month 0 through month 36." :
    "Start with the selected curve. Each of five paths has 916 daily starts with a full 180-day holding window.";
  const metrics = [
    [july ? "Calculated July mix" : "Reference mix", mixLabel(defaults.reference.weights)],
    [july ? "Calculated worst regret" : "Reference worst regret", bp(defaults.reference.worst_regret_bp)],
    july ? ["Article worst regret · archived", bp(defaults.archive.ladder_worst_bp)] :
      ["Minimum possible in the grid", bp(defaults.minimax.worst_regret_bp)]
  ];
  snapshots("scenario-metrics", metrics);
  $("archived-scenarios").hidden = !july;
  $("archive-table").tBodies[0].replaceChildren(...(defaults.archive?.reported_regret ?? []).map(
    ([label, ladder, on, term]) => row(label, [bp(on), bp(ladder), bp(term)])
  ));
  $("scenario-table").tBodies[0].replaceChildren(...defaults.scenario_results.map((result) => {
    const cells = [result.overnight, result.ladder, result.term].map((item) => bp(item.mean_regret_bp));
    return row(result.name, cells);
  }));
  const grid = number.format(defaults.candidate_count) + " feasible mixes";
  $("scenario-note").textContent = july ?
    "Annualized regret is the gap to the path’s best pure tenor. The July grid tested " + grid +
      " in 5% increments. The article’s regret bars are archived values supplied with the chart." :
    "The table shows mean annualized regret by path. Worst regret uses every start in each path. " +
      "The 10% grid tested " + grid + ". The minimum-regret mix is " + mixLabel(defaults.minimax.weights) + ".";
}

function drawActiveChart() {
  if (!defaults) return;
  if (activeStep === "rates") {
    const lines = defaults.tenors.map((name, i) =>
      series(name, palette[i], defaults.rates.map((r) => [Date.parse(r[0]), 100 * r[i + 1]]))
    );
    drawPlot($("history-rates-chart"), lines, { formatX: dateAxis, formatY: percentAxis });
    setLegend("rate-legend", lines);
  } else if (activeStep === "history" && defaults.history.count) {
    const timeline = historyView === "timeline";
    const { windows, history } = defaults;
    let lines;
    if (timeline) {
      lines = [
        series("Starting 6M − ON spread", palette[0], windows.map((w) => [Date.parse(w.start), w.spread_bp])),
        series("Realized 6M excess", palette[3], windows.map((w) => [Date.parse(w.start), w.excess_bp]))
      ];
    } else {
      const points = windows.map((w) => [w.spread_bp, w.excess_bp]);
      lines = [series("Each decision", palette[0], points, { dots: true })];
      if (history.trend) {
        const limits = points.reduce(([low, high], [x]) => [Math.min(low, x), Math.max(high, x)], [Infinity, -Infinity]);
        const { slope, intercept } = history.trend;
        lines.push(series("Fitted line", palette[3], limits.map((x) => [x, intercept + slope * x])));
      }
    }
    $("history-chart-title").textContent = timeline ? "Spread and outcome by decision date (bp)" :
      "Starting spread (x) vs. realized holding-period excess (y), both in bp";
    $("history-method").textContent = timeline ?
      "The spread compares annual quotes. The outcome measures interest earned over the actual holding period." :
      (history.trend ? "The starting spread explains " + percent(history.trend.r_squared) +
      " of the variation in realized excess in this sample." : "The fitted line needs variation in both series.");
    drawPlot($("history-check-chart"), lines, { formatX: timeline ? dateAxis : bpAxis, formatY: bpAxis, includeZero: true });
    setLegend("history-legend", lines);
  } else if (activeStep === "cycle") {
    const names = ["ON up", "6M up", "ON down", "6M down"];
    const lines = names.map((name, i) => series(name, palette[i < 2 ? 0 : 3],
      defaults.mirror_rates.map((rates, j) => [Date.parse(defaults.rates[j][0]), 100 * rates[i]]),
      { dashed: i % 2 === 1 }));
    drawPlot($("mirror-chart"), lines, { formatX: dateAxis, formatY: percentAxis });
    setLegend("cycle-legend", lines);
  } else if (activeStep === "scenarios") {
    const lines = defaults.scenario_results.map((item, i) =>
      series(item.name, palette[i], item.path.map(([day, rate]) => [day, rate * 100]))
    );
    drawPlot($("paths-chart"), lines, {
      formatX: (day) => "Month " + Math.round(day * 36 / defaults.horizon_days),
      formatY: percentAxis
    });
    setLegend("scenario-legend", lines);
    const july = defaults.profile === "july";
    const mixPoints = defaults.mix_grid.map(([worst, mean, annualReturn]) => [worst, july ? mean : annualReturn * 100]);
    const picked = (mix) => [mix.worst_regret_bp, july ? mix.mean_regret_bp : mix.average_annual_return * 100];
    const mixes = [
      series("Feasible mixes", palette[0], mixPoints, { dots: true }),
      series(july ? "Selected July mix" : "Minimum regret", palette[3], [picked(defaults.minimax)], { dots: true })
    ];
    if (!july) mixes.push(series("Reference mix", palette[2], [picked(defaults.reference)], { dots: true }));
    $("frontier-label").textContent = july ?
      "Worst-case regret (x) vs. mean regret (y), both in annualized bp." :
      "Worst-case regret in annualized bp (x) vs. average annualized return (y).";
    drawPlot($("frontier-chart"), mixes, { formatX: bpAxis, formatY: july ? bpAxis : percentAxis });
    setLegend("frontier-legend", mixes);
  } else if (activeStep === "allocation") {
    drawRateChart();
  }
}

function selectStep(step) {
  activeStep = step;
  for (const tab of tabs) {
    const selected = tab.dataset.step === step;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(tab.getAttribute("aria-controls")).hidden = !selected;
  }
  drawActiveChart();
}

function setHistoryView(view) {
  historyView = view;
  $("timeline-view").setAttribute("aria-pressed", String(view === "timeline"));
  $("scatter-view").setAttribute("aria-pressed", String(view === "scatter"));
  drawActiveChart();
}

async function selectDataset(url, options, uploadedName) {
  const select = $("dataset");
  select.disabled = true;
  $("import-rates").disabled = true;
  $("dataset-status").classList.remove("error");
  $("dataset-status").textContent = options ? "Validating and calculating the imported curve…" : "Calculating from the rate data…";
  try {
    const data = await json(url, options);
    if (data.profile === "custom") {
      select.querySelector("[data-upload]")?.remove();
      const option = new Option(uploadedName || "Custom CSV", data.model_id);
      option.dataset.upload = "";
      select.add(option);
      data.source_name = uploadedName || data.source_name;
    }
    select.value = data.model_id;
    setupCalculator(data);
    const query = "?model=" + encodeURIComponent(data.model_id);
    $("curve-download").href = "/curve.csv" + query;
    $("history-download").href = "/history.csv" + query;
    renderRates();
    renderHistory();
    renderCycle();
    renderScenarios();
    $("loading").hidden = true;
    $("simulator").hidden = false;
    $("dataset-status").textContent = number.format(data.observations) + " observations loaded";
    selectStep(activeStep);
  } catch (error) {
    if (defaults) {
      select.value = defaults.model_id;
      $("dataset-status").classList.add("error");
      $("dataset-status").textContent = error.message;
    } else {
      $("loading").textContent = "The model could not load. " + error.message;
    }
  } finally {
    select.disabled = false;
    $("import-rates").disabled = false;
  }
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectStep(tab.dataset.step));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const offset = event.key === "ArrowLeft" ? -1 : 1;
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    selectStep(next.dataset.step);
    next.focus();
  });
});
$("rates-prev").addEventListener("click", () => { ratePage--; renderRatePage(); });
$("rates-next").addEventListener("click", () => { ratePage++; renderRatePage(); });
$("timeline-view").addEventListener("click", () => setHistoryView("timeline"));
$("scatter-view").addEventListener("click", () => setHistoryView("scatter"));
$("decision-date").addEventListener("change", selectDecision);
$("dataset").addEventListener("change", (event) => selectDataset("/model?model=" + encodeURIComponent(event.target.value)));
$("import-rates").addEventListener("click", () => $("rate-file").click());
$("rate-file").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) selectDataset("/model", { method: "POST", body: file }, file.name);
  event.target.value = "";
});
window.addEventListener("resize", drawActiveChart);
selectDataset("/model");
