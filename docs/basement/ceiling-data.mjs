// Online Home Depot reference prices researched October 5, 2026 (New York).
// Standard single-pack prices; location, promotions and bulk discounts vary.
export const CEILING_STORAGE_KEY = "ronu.basement.ceiling.v1";
export const SQFT_PER_M2 = 10.7639104167;
export const PRICE_DATE = "October 5, 2026";
export const PRODUCTS = [
  {
    id: "drywall",
    name: "USG Sheetrock Firecode X drywall",
    pack: "5/8 in. × 4 ft. × 8 ft. sheet",
    unit: "sheets",
    price: 17.78,
    productId: "100321591",
    model: "14211011308",
    basis: "32 ft² per sheet, including your waste allowance.",
    priceSource:
      "https://www.homedepot.com/b/Building-Materials-Drywall-Drywall-Sheets/Fire-Resistant/5-8-in/4x8/N-5yc1vZbb52Z1z0ppqaZ1z0qvc1Z1z18jbl",
    imageSource:
      "https://images.thdstatic.com/productImages/78f7c046-0d8c-47e1-bbf6-d2bf6ea1ebaf/svn/usg-sheetrock-brand-drywall-sheets-14211011308-64_600.jpg",
  },
  {
    id: "screws",
    name: "Grip-Rite coarse-thread drywall screws",
    pack: "#6 × 1-5/8 in. · 5 lb box · wood framing",
    unit: "boxes",
    price: 24.98,
    productId: "100182191",
    model: "158CDWS5",
    basis:
      "Budget allowance: 40 screws per sheet and 1,000 screws per box. Confirm the fastening pattern and pack count before buying.",
    priceSource:
      "https://www.homedepot.com/b/Hardware-Fasteners-Screws-Drywall-Screws/5-10/1-5-8-in/N-5yc1vZc2atZ1z0sg17Z1z1u54a",
    imageSource:
      "https://images.thdstatic.com/productImages/59d9fdf4-44b3-4890-b2a7-0aea8761feaf/svn/grip-rite-drywall-screws-158cdws5-64_600.jpg",
  },
  {
    id: "tape",
    name: "USG Sheetrock paper joint tape",
    pack: "2-1/16 in. × 250 ft. roll",
    unit: "rolls",
    price: 4.57,
    productId: "100321613",
    model: "382175",
    basis:
      "Planning allowance: 0.5 linear ft of tape per ft², plus waste. Actual joints depend on the sheet layout.",
    priceSource: "https://www.homedepot.com/p/100321613",
    imageSource:
      "https://images.thdstatic.com/productImages/829e538e-4bb6-4ec5-a953-cd7c95241c17/svn/usg-sheetrock-brand-drywall-tape-382175-64_600.jpg",
  },
  {
    id: "compound",
    name: "USG Sheetrock all-purpose joint compound",
    pack: "4.5 gal. pail",
    unit: "pails",
    price: 23.65,
    productId: "100321605",
    model: "380501",
    basis:
      "450 ft² per pail for joint finishing, plus waste. Full skim coating is extra.",
    priceSource:
      "https://www.homedepot.com/b/Building-Materials-Drywall-Joint-Compound/Premixed-Joint-Compound/N-5yc1vZard1Z1z10nvr",
    imageSource:
      "https://images.thdstatic.com/productImages/bf9715e4-0264-4ff5-9f20-95713c5c51df/svn/usg-sheetrock-brand-joint-compound-380501-64_600.jpg",
  },
  {
    id: "sanding",
    name: "3M fine/medium sanding sponge",
    pack: "Reusable drywall sponge · each",
    unit: "sponges",
    price: 4.98,
    productId: "100321145",
    model: "9095",
    basis:
      "Consumables allowance: one sponge per 250 ft², plus waste. Pole sander and dust protection are separate.",
    priceSource: "https://www.homedepot.com/p/100321145",
    imageSource:
      "https://images.thdstatic.com/productImages/e9e394a4-b632-4a20-b118-25df41c9c044/svn/3m-drywall-sanding-sponges-9095-64_600.jpg",
  },
  {
    id: "primer",
    name: "Glidden PVA drywall primer",
    pack: "White · 5 gal. pail",
    unit: "pails",
    price: 68,
    productId: "100091142",
    model: "GPD-0000-05",
    basis:
      "One coat. Planning coverage: 1,440 ft² per pail (45 sheets), plus waste.",
    priceSource: "https://www.homedepot.com/p/100091142",
    imageSource:
      "https://images.thdstatic.com/productImages/09e78418-b189-479e-8ee1-4187b598e93e/svn/white-glidden-pva-primers-gpd-0000-05-64_600.jpg",
  },
  {
    id: "paint",
    name: "BEHR Premium Plus ceiling paint",
    pack: "Ultra Pure White · flat · 1 gal. can",
    unit: "cans",
    price: 33.98,
    productId: "100206081",
    model: "55801",
    basis:
      "Two coats at a planning rate of 350 ft² per gallon, plus waste. Store bulk pricing may reduce the cost.",
    priceSource: "https://www.homedepot.com/p/100206081",
    imageSource:
      "https://images.thdstatic.com/productImages/16b910a8-4f58-42ba-84e4-fcbeae3442c6/svn/ultra-pure-white-behr-premium-plus-ceiling-paint-55801-64_600.jpg",
  },
].map((product) => ({
  ...product,
  url: `https://www.homedepot.com/p/${product.productId}`,
  image: `./products/${product.id}.jpg`,
}));

export function validEstimateInput(squareMeters, wastePercent) {
  return (
    Number.isFinite(squareMeters) &&
    squareMeters > 0 &&
    squareMeters <= 5000 &&
    Number.isFinite(wastePercent) &&
    wastePercent >= 0 &&
    wastePercent <= 30
  );
}

export function estimateCeiling(squareMeters, wastePercent = 10) {
  if (!validEstimateInput(squareMeters, wastePercent))
    throw new Error(
      "Enter a positive ceiling area and a waste allowance from 0 to 30%.",
    );
  const squareFeet = squareMeters * SQFT_PER_M2;
  const purchaseArea = squareFeet * (1 + wastePercent / 100);
  // Small tolerance avoids an extra pack caused solely by unit conversion noise.
  const packs = (n) => Math.ceil(n - 1e-9);
  const sheets = packs(purchaseArea / 32);
  const quantities = {
    drywall: sheets,
    screws: packs((sheets * 40) / 1000),
    tape: packs((purchaseArea * 0.5) / 250),
    compound: packs(purchaseArea / 450),
    sanding: packs(purchaseArea / 250),
    primer: packs(purchaseArea / 1440),
    paint: packs((purchaseArea * 2) / 350),
  };
  const items = PRODUCTS.map((product) => ({
    ...product,
    quantity: quantities[product.id],
    totalCents: quantities[product.id] * Math.round(product.price * 100),
  }));
  return {
    squareFeet,
    purchaseArea,
    items,
    totalCents: items.reduce((sum, item) => sum + item.totalCents, 0),
  };
}

export function loadCeiling(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(CEILING_STORAGE_KEY) || "null");
    if (saved && validEstimateInput(saved.squareMeters, saved.wastePercent))
      return {
        squareMeters: saved.squareMeters,
        wastePercent: saved.wastePercent,
      };
  } catch {
    /* Unavailable or corrupt preferences never block the viewer. */
  }
  return { squareMeters: null, wastePercent: 10 };
}
