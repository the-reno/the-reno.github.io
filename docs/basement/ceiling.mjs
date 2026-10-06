import {
  CEILING_STORAGE_KEY,
  SQFT_PER_M2,
  PRICE_DATE,
  PRODUCTS,
  loadCeiling,
  estimateCeiling,
} from "./ceiling-data.mjs?v=1";

const money = (cents) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const node = (tag, text, className) => {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
};

export function openCeiling({ dialog, storage, units, modelArea, drawnArea }) {
  const state = loadCeiling(storage);
  const metric = units === "metric";
  const factor = metric ? 1 : SQFT_PER_M2;
  let source = state.squareMeters === null ? "model" : "custom";
  state.squareMeters ??= modelArea;
  const content = dialog.querySelector("#ceiling-content");
  content.replaceChildren();
  content.append(
    node(
      "p",
      "Painted drywall · starting materials estimate",
      "ceiling-subtitle",
    ),
  );
  const inputs = node("div", undefined, "ceiling-inputs");
  function field(title, id, value, max, step) {
    const label = node("label", title);
    const input = node("input");
    input.id = id;
    input.type = "number";
    input.inputMode = "decimal";
    input.min = "0";
    input.max = String(max);
    input.step = step;
    input.value = value;
    label.append(input);
    inputs.append(label);
    return input;
  }
  const area = field(
    `Ceiling area (${metric ? "m²" : "ft²"})`,
    "ceiling-area",
    (state.squareMeters * factor).toFixed(metric ? 2 : 1),
    5000 * factor,
    "any",
  );
  const waste = field(
    "Waste allowance (%)",
    "ceiling-waste",
    state.wastePercent,
    30,
    "any",
  );
  content.append(inputs);
  const shortcuts = node("div", undefined, "ceiling-shortcuts");
  const sourceNote = node("p", undefined, "small");
  const validation = node("p", undefined, "ceiling-error");
  validation.setAttribute("role", "status");
  const summary = node("div", undefined, "ceiling-estimate");
  const summaryText = node("div");
  summaryText.append(node("span", "Estimated materials"));
  const total = node("strong");
  total.id = "ceiling-total";
  total.setAttribute("aria-live", "polite");
  summaryText.append(total);
  summary.append(
    summaryText,
    node("small", "USD · before tax and delivery\nLabor and tools are extra"),
  );
  const list = node("div", undefined, "ceiling-products");
  const rowValues = new Map();
  for (const product of PRODUCTS) {
    const row = node("article", undefined, "ceiling-product");
    row.dataset.product = product.id;
    const photo = node("img");
    photo.src = product.image;
    photo.alt = product.name;
    photo.width = 100;
    photo.height = 100;
    photo.loading = "lazy";
    const description = node("div", undefined, "ceiling-description");
    description.append(node("h2", product.name), node("p", product.pack));
    const link = node("a", "Home Depot ↗");
    link.href = product.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `${product.name} at Home Depot`);
    description.append(link);
    const figures = node("dl", undefined, "ceiling-figures");
    const values = [];
    for (const heading of ["Quantity", "Unit price", "Est. total"]) {
      const group = node("div");
      const value = node("dd");
      values.push(value);
      group.append(node("dt", heading), value);
      figures.append(group);
    }
    rowValues.set(product.id, values);
    row.append(photo, description, figures);
    list.append(row);
  }
  function recalculate(save = false) {
    try {
      if (area.value === "" || waste.value === "")
        throw new Error(
          "Enter a ceiling area and waste allowance to see the estimate.",
        );
      const estimate = estimateCeiling(state.squareMeters, state.wastePercent);
      validation.hidden = true;
      list.hidden = summary.hidden = false;
      sourceNote.textContent =
        source === "model"
          ? "Starting from the scan’s floor footprint, including walls and stairs. Adjust this to the ceiling you will actually cover."
          : source === "drawn"
            ? "Using the total of your saved drawn areas. Check that these are the ceiling areas you want to cover."
            : "Using your saved area. Quantities include waste and round up to whole packs.";
      for (const item of estimate.items) {
        const [quantity, price, lineTotal] = rowValues.get(item.id);
        const unit =
          item.quantity === 1
            ? {
                sheets: "sheet",
                boxes: "box",
                rolls: "roll",
                pails: "pail",
                sponges: "sponge",
                cans: "can",
              }[item.unit]
            : item.unit;
        quantity.textContent = `${item.quantity} ${unit}`;
        price.textContent = money(Math.round(item.price * 100));
        lineTotal.textContent = money(item.totalCents);
      }
      total.textContent = `≈ ${money(estimate.totalCents)}`;
      if (save) {
        try {
          if (!storage) throw new Error("unavailable");
          storage.setItem(CEILING_STORAGE_KEY, JSON.stringify(state));
        } catch {
          validation.textContent =
            "Changes apply in this view. Browser saving is unavailable.";
          validation.hidden = false;
        }
      }
    } catch (error) {
      validation.textContent = error.message;
      validation.hidden = false;
      list.hidden = summary.hidden = true;
    }
  }
  for (const [title, value, sourceName] of [
    ["Use model footprint", modelArea, "model"],
    ["Use drawn areas", drawnArea, "drawn"],
  ]) {
    const button = node("button", title);
    button.type = "button";
    button.disabled = !(value > 0);
    button.onclick = () => {
      source = sourceName;
      state.squareMeters = value;
      area.value = (value * factor).toFixed(metric ? 2 : 1);
      recalculate(true);
    };
    shortcuts.append(button);
  }
  area.oninput = () => {
    source = "custom";
    state.squareMeters = area.valueAsNumber / factor;
    recalculate(true);
  };
  waste.oninput = () => {
    state.wastePercent = waste.valueAsNumber;
    recalculate(true);
  };
  const details = node("details", undefined, "ceiling-basis");
  details.append(node("summary", "Quantity basis & what is extra"));
  details.append(
    node(
      "p",
      "Assumes one flat drywall layer on suitable existing wood framing. Confirm the ceiling assembly and service access before buying; the scan does not show the joists or utilities.",
    ),
  );
  const basis = node("ul");
  for (const product of PRODUCTS)
    basis.append(node("li", `${product.name}: ${product.basis}`));
  details.append(
    basis,
    node(
      "p",
      "Not priced: new framing/furring, soffits, insulation, access panels, lights, utility relocation, joint tools, rollers, lift rental, protective equipment, labor, tax or delivery. This is a materials subtotal, not the full installed ceiling cost.",
    ),
  );
  content.append(
    shortcuts,
    sourceNote,
    validation,
    summary,
    list,
    details,
    node(
      "p",
      `Home Depot reference prices researched ${PRICE_DATE}. No local store selected. Prices and availability may vary; bulk discounts are not included. Product photos: Home Depot.`,
      "small ceiling-price-note",
    ),
  );
  recalculate();
  dialog.showModal();
  dialog.scrollTop = 0;
}
