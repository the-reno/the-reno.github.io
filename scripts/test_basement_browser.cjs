const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../docs");
const artifactDir = process.env.BASEMENT_SCREENSHOT_DIR;
const storageKey = "ronu.basement.simple.v2";
const legacyKey = "ronu.basement.execution.v1";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (p.endsWith("/")) p += "index.html";
      const file = path.resolve(root, "." + p);
      if (!file.startsWith(root + path.sep)) throw new Error("path");
      const mime = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".gltf": "model/gltf+json",
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
      };
      res.setHeader(
        "Content-Type",
        mime[path.extname(file)] || "application/octet-stream",
      );
      res.end(await fs.readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  server.unref();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BASEMENT_CHROMIUM_PATH || undefined,
    args: [
      "--no-sandbox",
      "--no-zygote",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-dev-shm-usage",
    ],
  });
  const errors = [],
    broken = [];
  let checks = 0;
  function check(value, message) {
    assert.ok(value, message);
    checks++;
  }
  async function newPage(options = {}, referenceFailure = false) {
    const context = await browser.newContext(options);
    if (process.env.BASEMENT_THREE_PATH) {
      const pkg = JSON.parse(
        await fs.readFile(
          path.join(process.env.BASEMENT_THREE_PATH, "package.json"),
        ),
      );
      assert.equal(pkg.version, "0.180.0");
      await context.route(
        "https://cdn.jsdelivr.net/npm/three@0.180.0/**",
        async (route) => {
          const relative = new URL(route.request().url()).pathname.split(
            "/three@0.180.0/",
          )[1];
          await route.fulfill({
            body: await fs.readFile(
              path.join(process.env.BASEMENT_THREE_PATH, relative),
            ),
            contentType: "text/javascript",
            headers: { "Access-Control-Allow-Origin": "*" },
          });
        },
      );
    }
    const page = await context.newPage();
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("Page error:", e.message);
    });
    page.on("console", (msg) => {
      // Chrome may request a site-wide icon; the site has never supplied one.
      if (msg.location().url === `${base}/favicon.ico`) return;
      if (referenceFailure && msg.location().url.includes("/project-data.json"))
        return;
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("response", (response) => {
      if (referenceFailure && response.url().includes("/project-data.json"))
        return;
      if (response.status() >= 400)
        broken.push(`${response.status()} ${response.url()}`);
    });
    page.on("requestfailed", (request) => {
      if (referenceFailure && request.url().includes("/project-data.json"))
        return;
      broken.push(`${request.url()} ${request.failure().errorText}`);
    });
    return page;
  }
  const ready = (page) =>
    page.locator("#status").waitFor({ state: "hidden", timeout: 30000 });
  const data = (page) =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
  const camera = (page) =>
    page.evaluate(async () => {
      const v = (
        await import(document.querySelector('script[type="module"][src]').src)
      ).viewer;
      return {
        position: v.camera.position.toArray(),
        target: v.controls.target.toArray(),
      };
    });
  const project = (page, p, area = false) =>
    page.evaluate(
      async ({ p, area }) => {
        const v = (
          await import(document.querySelector('script[type="module"][src]').src)
        ).viewer;
        return v.project([p[0], area ? v.ceilingY : -1.13053, p[1]]);
      },
      { p, area },
    );
  const tap = async (page, p, area = false) => {
    const s = await project(page, p, area);
    await page.mouse.click(s.x, s.y);
    await sleep(100);
  };
  const tool = (page, name) => page.getByRole("button", { name, exact: true });
  const close = async (page) => {
    if (await page.locator("#panel").isVisible())
      await tool(page, "Close editor").click();
  };
  const create = async (page, name) => {
    if (!(await page.locator("#add-tools").evaluate((node) => node.open)))
      await page.locator("#add-tools summary").click();
    await tool(page, name).click();
  };
  const visibility = async (page, key) => {
    await page.locator(`[data-visibility="${key}"]`).click();
    await close(page);
  };
  async function screenshot(page, name) {
    if (artifactDir) {
      await page.locator("#toast").waitFor({ state: "hidden" });
      await page.screenshot({ path: path.join(artifactDir, name + ".png") });
    }
  }
  try {
    if (artifactDir) await fs.mkdir(artifactDir, { recursive: true });
    const page = await newPage({ viewport: { width: 1280, height: 850 } });
    await page.goto(`${base}/basement/`);
    await ready(page);
    check(
      (await page.locator("#view canvas").count()) === 1,
      "Real WebGL model loads",
    );
    check(
      (await page.evaluate(async () =>
        (
          await import(document.querySelector('script[type="module"][src]').src)
        ).viewer.box.isEmpty(),
      )) === false,
      "Model has geometry",
    );
    check(
      (await page.locator('[data-mode][aria-pressed="true"]').count()) === 0,
      "Navigation is the default, with no extra mode",
    );
    check(
      (await page.locator("#model-area").innerText()).includes("854.6"),
      "Floor area comes from KIRI geometry",
    );
    check(
      (await page.locator(".wall-dimension").count()) === 0,
      "Hide all is the default",
    );
    check(
      (await page.locator(".project-dimension").count()) === 0,
      "Lighting spacings are separate from wall sizes",
    );
    check(
      await page.locator("#show-panel").isVisible(),
      "Show menu is always visible",
    );
    check(
      (await tool(page, "Walls").getAttribute("aria-pressed")) === "false",
      "Walls start hidden",
    );
    check(
      (await tool(page, "Floor").getAttribute("aria-pressed")) === "false",
      "Floor starts hidden",
    );
    check(
      (await page.locator('[data-visibility="comments"]').count()) === 0,
      "Comments toggle removed",
    );
    check(
      (await page.locator(".tools, .model-floor, .model-summary").count()) ===
        0,
      "Old bottom menu and floor scan badge removed",
    );
    check(
      await page.locator("#prompt").isHidden(),
      "Default navigation help no longer covers the model",
    );
    await screenshot(page, "basement-default-hidden");
    await page.getByLabel("Show Wall W01", { exact: true }).check();
    await page.getByLabel("Show Wall W02", { exact: true }).check();
    for (const id of ["W01", "W02"]) {
      check(
        await page
          .locator(`.wall-dimension.selected[data-id="${id}"]`)
          .isVisible(),
        `${id} stays highlighted alongside the other selection`,
      );
    }
    check(
      (await page.locator(".model-label.muted").count()) === 0,
      "Selections do not dim one another",
    );
    await screenshot(page, "basement-two-walls");
    await page.reload();
    await ready(page);
    for (const id of ["W01", "W02"]) {
      check(
        await page.getByLabel(`Show Wall ${id}`, { exact: true }).isChecked(),
        `${id} checkbox persists`,
      );
      check(
        await page
          .locator(`.wall-dimension.selected[data-id="${id}"]`)
          .isVisible(),
        `${id} highlight persists`,
      );
    }
    await page.getByLabel("Show Wall W01", { exact: true }).uncheck();
    check(
      await page.locator('.wall-dimension.selected[data-id="W02"]').isVisible(),
      "Unchecking one wall preserves the other highlight",
    );
    await tool(page, "Floor").click();
    check(
      (await page.locator(".model-floor").count()) === 0,
      "Floor tint has no floating scan badge",
    );
    await tool(page, "Hide all").click();
    check(
      (await page.locator(".wall-dimension").count()) === 0 &&
        (await tool(page, "Floor").getAttribute("aria-pressed")) === "false",
      "Hide all clears walls and floor",
    );
    await tool(page, "Show all").click();
    await screenshot(page, "basement-model-dimensions");
    const beforeWalls = await data(page);
    check(
      (await page.locator(".measurement-option").count()) === 22,
      "All 22 walls have individual visibility and size rows",
    );
    await page.getByLabel("Show Wall W06", { exact: true }).uncheck();
    check(
      (await page.locator('.wall-dimension[data-id="W06"]').count()) === 0,
      "Only the unchecked wall dimension hides",
    );
    check(
      (await page.locator(".wall-dimension").count()) === 21,
      "Other wall dimensions stay visible",
    );
    await close(page);
    await page.reload();
    await ready(page);
    check(
      (await page.locator('.wall-dimension[data-id="W06"]').count()) === 0,
      "Per-measurement visibility survives refresh",
    );
    await tool(page, "Hide all").click();
    await tool(page, "Locate Wall W06").click();
    check(
      await page.locator('.wall-dimension.selected[data-id="W06"]').isVisible(),
      "Selecting a wall highlights its model label",
    );
    check(
      (await page.locator(".wall-dimension").count()) === 1,
      "Locate reveals only the requested hidden dimension",
    );
    check(
      (await page.locator(".endpoint").count()) === 2,
      "The related line has A and B endpoints",
    );
    await screenshot(page, "basement-located-wall");
    await tool(page, "Metric · m").click();
    check(
      (await page.locator("#model-area").innerText()).includes("79.4 m²"),
      "Floor area switches to metric",
    );
    check(
      (
        await page.locator('.wall-dimension[data-id="W06"]').innerText()
      ).includes(" m"),
      "Wall labels switch to meters",
    );
    await screenshot(page, "basement-filter-panel");
    await close(page);
    await page.reload();
    await ready(page);
    check(
      (await page.locator("#model-area").innerText()).includes("m²"),
      "Unit selection survives refresh",
    );
    await tool(page, "Imperial · ft/in").click();
    await tool(page, "Show all").click();
    assert.deepEqual(await data(page), beforeWalls);
    checks++;
    await close(page);
    check(
      (await page.locator(".tools nav").count()) === 0,
      "Bottom toolbar is removed",
    );
    await tool(page, "Lighting plan").click();
    await page
      .locator("#plan-note")
      .getByText("LIGHTING · 42 fixture spacings")
      .waitFor();
    await page.locator('[data-measure-key="project:P6-01"]').waitFor();
    await tool(page, "Show all").click();
    check(
      (await page.locator(".project-dimension").count()) === 42,
      "All printed plan dimensions load independently of saved annotations",
    );
    check(
      (await page.locator(".project-dimension:not([hidden])").count()) >= 5,
      "Printed lighting dimensions are visibly readable",
    );
    await page.locator('[data-measure-key="project:P6-01"] input').uncheck();
    check(
      (await page.locator('.project-dimension[data-id="P6-01"]').count()) === 0,
      "Individual lighting dimension hides",
    );
    await tool(page, "Metric · m").click();
    await page.locator('[data-measure-key="project:P6-01"] button').click();
    check(
      (
        await page.locator('.project-dimension[data-id="P6-01"]').innerText()
      ).includes("0.889 m"),
      "Metric lighting value converts printed 2ft 11in, not approximate endpoints",
    );
    check(
      await page
        .locator('.project-dimension.selected[data-id="P6-01"]')
        .isVisible(),
      "Located lighting measurement is visible",
    );
    await tool(page, "Imperial · ft/in").click();
    await close(page);
    const beforePlan = await data(page);
    await tool(page, "Project images").click();
    await page.locator(".plan-dimension-list summary").click();
    await page.locator(".plan-dimension-list button").first().click();
    check(
      (await page.locator("#panel-body").innerText()).includes(
        "Placement on the KIRI model is approximate",
      ),
      "Plan dimensions explain their source and approximate placement",
    );
    check(
      (await page.locator("#panel-body button").count()) === 0,
      "Reference values cannot be edited or marked as field-verified",
    );
    await close(page);
    await visibility(page, "measurements");
    check(
      (await page.locator(".project-dimension").count()) === 0,
      "Measurements toggle also hides plan references",
    );
    await visibility(page, "measurements");
    check(
      (await page.locator(".project-dimension").count()) === 42,
      "Measurements toggle restores the source dimensions",
    );
    assert.deepEqual(await data(page), beforePlan);
    checks++;
    await screenshot(page, "basement-plan-dimensions");
    await tool(page, "3D dimensions").click();
    await tool(page, "3D").click();
    const initial = await camera(page);
    await page.mouse.move(850, 400);
    await page.mouse.down();
    await page.mouse.move(950, 470, { steps: 10 });
    await page.mouse.up();
    await sleep(300);
    check(
      JSON.stringify(await camera(page)) !== JSON.stringify(initial),
      "Mouse orbit changes view",
    );
    await tool(page, "Reset").click();
    await sleep(150);
    check(
      (await camera(page)).position.every(
        (value, i) => Math.abs(value - initial.position[i]) < 0.02,
      ),
      "Reset restores original 3D camera",
    );
    await tool(page, "Top").click();
    check(
      (await tool(page, "Top").getAttribute("aria-pressed")) === "true",
      "Top works",
    );
    const beforePan = await camera(page);
    await page.mouse.move(850, 400);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(900, 420, { steps: 5 });
    await page.mouse.up({ button: "right" });
    await sleep(200);
    check(
      JSON.stringify((await camera(page)).target) !==
        JSON.stringify(beforePan.target),
      "Right drag pans",
    );
    await tool(page, "Top").click();
    const beforeZoom = await camera(page);
    await page.mouse.move(850, 400);
    await page.mouse.wheel(0, -200);
    await sleep(200);
    check(
      JSON.stringify((await camera(page)).position) !==
        JSON.stringify(beforeZoom.position),
      "Wheel zoom works",
    );
    await tool(page, "3D").click();
    check(
      (await tool(page, "3D").getAttribute("aria-pressed")) === "true",
      "3D works",
    );
    await tool(page, "Top").click();

    // A note is a draft until Save; drags never add geometry.
    await create(page, "Comment");
    await page.mouse.move(850, 400);
    await page.mouse.down();
    await page.mouse.move(950, 470, { steps: 8 });
    await page.mouse.up();
    check((await data(page)) === null, "Orbit drag does not create a note");
    await tool(page, "Top").click();
    await tap(page, [-3, -3]);
    await page
      .getByLabel("Note", { exact: true })
      .fill("Can this pipe move higher? <script>");
    check(
      (await data(page)) === null,
      "Draft note is not persisted prematurely",
    );
    await tool(page, "Save").click();
    check((await data(page)).comments.length === 1, "Comment saves");
    check(
      (await page.locator("#panel script").count()) === 0,
      "Note text remains literal",
    );
    await page.locator(".model-label.comment").click();
    await page.getByLabel("Note", { exact: true }).fill("Check pipe clearance");
    await tool(page, "Save").click();
    check(
      (await data(page)).comments[0].text === "Check pipe clearance",
      "Comment edit saves",
    );
    const originalPosition = (await data(page)).comments[0].position;
    await page.locator(".model-label.comment").click();
    await tool(page, "Move").click();
    await tap(page, [-3, -0.5]);
    await tool(page, "Save").click();
    check(
      JSON.stringify((await data(page)).comments[0].position) !==
        JSON.stringify(originalPosition),
      "Comment moves with the same ID",
    );
    check((await data(page)).comments[0].id === "C01", "Move preserves ID");
    await page.locator(".model-label.comment").click();
    await tool(page, "Resolve / hide").click();
    check(
      (await page.locator(".model-label.comment").count()) === 0,
      "Resolved comment hides",
    );
    check(
      (await data(page)).comments[0].resolved === true,
      "Resolved boolean persists",
    );
    await tool(page, "Show hidden notes").click();
    await page.locator(".hidden-note").click();
    await tool(page, "Show note").click();
    check(
      (await page.locator(".model-label.comment").count()) === 1,
      "Hidden comment can be restored",
    );
    check(
      Object.keys((await data(page)).comments[0])
        .sort()
        .join() === "id,position,resolved,text",
      "Comment schema has only four fields",
    );

    await create(page, "Measure");
    await tap(page, [-3, -2]);
    await tap(page, [-1, -2]);
    let m = (await data(page)).measurements[0];
    check(
      Math.abs(Math.hypot(...m.a.map((value, i) => value - m.b[i])) - 2) < 0.01,
      "A to B measures actual model coordinates",
    );
    check(
      m.status === "SCAN" &&
        (await page
          .locator(".model-label.measurement")
          .innerText()
          .then((text) => text.includes("SCAN"))),
      "SCAN appears directly in model",
    );
    const scanEndpoints = [m.a, m.b];
    await page
      .getByLabel("Name (optional)", { exact: true })
      .fill("Beam height");
    await page.getByLabel("Feet", { exact: true }).fill("7");
    await page.getByLabel("Inches", { exact: true }).fill("2.5");
    await tool(page, "Mark VERIFIED").click();
    m = (await data(page)).measurements[0];
    check(
      m.status === "VERIFIED" &&
        Math.abs(m.verifiedMeters - 86.5 * 0.0254) < 1e-9,
      "Tape/laser value marks VERIFIED",
    );
    assert.deepEqual([m.a, m.b], scanEndpoints);
    checks++;
    check(
      (await page.locator(".model-label.measurement").innerText()).includes(
        "7′ 2½″",
      ),
      "Primary dimension uses feet and fractional inches",
    );
    await close(page);
    await visibility(page, "measurements");
    check(
      (await page.locator(".model-label.measurement").count()) === 0,
      "Measurements hide",
    );
    await visibility(page, "measurements");

    const beforeUnits = await data(page);
    await page.locator('[data-measure-key="saved:M01"] input').uncheck();
    check(
      (await page.locator(".model-label.measurement").count()) === 0,
      "Individual saved measurement hides without hiding walls",
    );
    check(
      (await page.locator(".wall-dimension").count()) === 22,
      "Saved-measure filtering leaves model dimensions alone",
    );
    await tool(page, "Metric · m").click();
    await tool(page, "Locate Beam height").click();
    check(
      (await page.locator(".model-label.measurement").innerText()).includes(
        "2.197 m",
      ),
      "Saved VERIFIED dimension switches to metric",
    );
    check(
      await page.locator(".model-label.measurement.selected").isVisible(),
      "Locate highlights the saved measurement's exact scan endpoints",
    );
    assert.deepEqual(await data(page), beforeUnits);
    checks++;
    await tool(page, "Imperial · ft/in").click();
    await close(page);
    assert.deepEqual(await data(page), beforeUnits);
    checks++;

    await create(page, "Area");
    for (const p of [
      [-4, -4],
      [-2, -4],
      [-2, -2.5],
      [-4, -2.5],
    ])
      await tap(page, p, true);
    await tool(page, "Done").click();
    check((await data(page)).areas.length === 1, "Polygon saves");
    check(
      Math.abs((await data(page)).areas[0].squareMeters - 3) < 0.01,
      "Polygon calculation is 3 m²",
    );
    await page
      .getByLabel("Name (optional)", { exact: true })
      .fill("Main ceiling");
    await close(page);
    check(
      (await page.locator(".model-label.area").innerText()).includes(
        "≈ 32.3 ft²",
      ),
      "Area shows approximate square feet",
    );
    check(
      (await page.locator("#area-total").innerText()).includes("32.3"),
      "Visible area total is correct",
    );
    await visibility(page, "areas");
    check(
      await page.locator("#area-total").isHidden(),
      "Hidden areas leave visible total",
    );
    await visibility(page, "areas");
    await tool(page, "Metric · m").click();
    await close(page);
    check(
      (await page.locator(".model-label.area").innerText()).includes("≈ 3 m²"),
      "Drawn areas use selected metric units",
    );
    check(
      (await page.locator("#area-total").innerText()).includes("≈ 3 m²"),
      "Drawn-area total uses metric units",
    );
    await tool(page, "Imperial · ft/in").click();
    await close(page);
    await create(page, "Area");
    for (const p of [
      [-3.5, -3.5],
      [-2.5, -3.5],
      [-2.5, -3],
    ])
      await tap(page, p, true);
    await tool(page, "Done").click();
    check(
      (await data(page)).areas.length === 1,
      "Overlapping outline cannot double count",
    );
    check(
      (await page.locator("#toast").innerText()).includes("overlaps"),
      "Overlap correction is clear",
    );
    await tool(page, "Cancel").click();
    await page.locator(".model-label.area").click();
    await tool(page, "Redraw").click();
    for (const p of [
      [-4, -4],
      [-2, -4],
      [-2, -2.5],
      [-4, -2.5],
    ])
      await tap(page, p, true);
    await tool(page, "Done").click();
    await close(page);
    check(
      (await data(page)).areas[0].name === "Main ceiling",
      "Redraw retains name and ID",
    );

    // Leader start points remain attached to saved world positions after orbiting.
    const saved = await data(page);
    await tool(page, "3D").click();
    await sleep(200);
    const attachment = await page.evaluate(async () => {
      const v = (
        await import(document.querySelector('script[type="module"][src]').src)
      ).viewer;
      const data = JSON.parse(localStorage.getItem("ronu.basement.simple.v2"));
      const records = [...data.comments, ...data.measurements, ...data.areas];
      return records.map((item) => {
        const label = document.querySelector(`[data-id="${item.id}"]`);
        const index = [...document.querySelectorAll(".model-label")].indexOf(
          label,
        );
        const leader = document.querySelectorAll(".label-leaders line")[index];
        const projected = v.project(item.position);
        return (
          Math.abs(Number(leader.getAttribute("x1")) - projected.x) < 1 &&
          Math.abs(Number(leader.getAttribute("y1")) - projected.y) < 1
        );
      });
    });
    check(
      attachment.every(Boolean),
      "Every annotation remains attached while navigating",
    );
    await screenshot(page, "basement-desktop");
    await page.reload();
    await ready(page);
    assert.deepEqual(await data(page), saved);
    checks++;
    check(
      (await page.locator(".model-label.measurement").count()) === 1,
      "Annotations return after refresh",
    );
    await tool(page, "Project images").click();
    await page.locator(".project-ref").nth(2).waitFor();
    check(
      (await page.locator(".project-ref").count()) === 3,
      "All project references load",
    );
    check(
      await page.locator("#project-panel").isVisible(),
      "Project overlay opens",
    );
    await page.locator(".lighting-plan").waitFor();
    await page.waitForFunction(
      () => document.querySelector("#project-image").naturalWidth === 2400,
    );
    check(true, "Original dimensioned drawing renders in Project");
    check(
      (await page.locator('a[href*=".pdf"]').count()) === 0,
      "No PDF links remain in the UI",
    );
    for (const image of await page.locator(".project-ref img").all()) {
      const response = await page.request.get(
        new URL(await image.getAttribute("src"), page.url()).href,
      );
      check(
        response.ok() && response.headers()["content-type"] === "image/png",
        "Original project image loads",
      );
    }
    await screenshot(page, "basement-project");
    await tool(page, "Close project reference").click();

    // Missing, malformed, offline and stalled optional references must not stop 3D.
    for (const failure of [
      "404",
      "json",
      "schema",
      "dimension-schema",
      "offline",
      "stalled",
    ]) {
      const isolated = await newPage({}, true);
      let referenceRequests = 0,
        pdfRequests = 0,
        pendingRoute;
      await isolated.route("**/project.pdf", (route) => {
        pdfRequests++;
        return route.fulfill({ status: 404, body: "Missing PDF" });
      });
      await isolated.route("**/project-data.json*", (route) => {
        referenceRequests++;
        if (failure === "stalled") {
          pendingRoute = route;
          return;
        }
        if (failure === "offline") return route.abort("failed");
        return route.fulfill({
          status: failure === "404" ? 404 : 200,
          contentType: "application/json",
          body:
            failure === "json"
              ? "{"
              : failure === "dimension-schema"
                ? '{"pages":[],"dimensions":{}}'
                : "{}",
        });
      });
      await isolated.goto(`${base}/basement/`);
      await ready(isolated);
      check(
        referenceRequests <= 1 && pdfRequests === 0,
        `${failure}: canvas becomes ready without waiting for optional data`,
      );
      check(
        (await isolated.locator("#model-area").innerText()).includes("854.6"),
        `${failure}: model measurements do not depend on references`,
      );
      await tool(isolated, "Project images").click();
      await tool(isolated, "Close project reference").click();
      await create(isolated, "Measure");
      check(
        (await isolated.locator("#instruction").innerText()) === "Tap Point A",
        `${failure}: tools work during reference loading`,
      );
      await isolated
        .locator("#project-reference-list")
        .getByText("Project images unavailable. Reload to try again.")
        .waitFor({ state: "attached", timeout: 12000 });
      check(
        await isolated.locator("#status").isHidden(),
        `${failure}: reference failure does not replace viewer status`,
      );
      await isolated.locator("#add-tools summary").click();
      check(
        (await tool(isolated, "Area").isEnabled()) &&
          (await tool(isolated, "Comment").isEnabled()),
        `${failure}: all tools remain enabled`,
      );
      check(pdfRequests === 0, `${failure}: no PDF is requested`);
      if (pendingRoute) await pendingRoute.abort().catch(() => {});
      await isolated.context().close();
    }

    // Actual touch events with mobile context, including two-finger pan and pinch.
    const mobile = await newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    await mobile.goto(`${base}/basement/`);
    await ready(mobile);
    await tool(mobile, "Top").click();
    await screenshot(mobile, "basement-mobile-model");
    await mobile.getByLabel("Show Wall W01", { exact: true }).check();
    await mobile.getByLabel("Show Wall W02", { exact: true }).check();
    for (const id of ["W01", "W02"]) {
      check(
        await mobile
          .locator(`.wall-dimension.selected[data-id="${id}"]`)
          .isVisible(),
        `Phone shows ${id} with both walls selected`,
      );
    }
    await screenshot(mobile, "basement-mobile-two-walls");
    await tool(mobile, "Hide all").click();
    await tool(mobile, "Project images").click();
    await mobile.waitForFunction(
      () => document.querySelector("#project-image").naturalWidth === 2400,
    );
    await screenshot(mobile, "basement-mobile-gallery");
    await tool(mobile, "Close project reference").click();
    const session = await mobile.context().newCDPSession(mobile);
    const touch = (type, points) =>
      session.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    async function gesture(start, end) {
      await touch("touchStart", start);
      for (let i = 1; i <= 6; i++)
        await touch(
          "touchMove",
          start.map((p, j) => ({
            id: p.id,
            x: p.x + ((end[j].x - p.x) * i) / 6,
            y: p.y + ((end[j].y - p.y) * i) / 6,
          })),
        );
      await touch("touchEnd", []);
      await sleep(200);
    }
    let before = await camera(mobile);
    await gesture([{ id: 1, x: 165, y: 290 }], [{ id: 1, x: 215, y: 330 }]);
    check(
      JSON.stringify(await camera(mobile)) !== JSON.stringify(before),
      "Touch orbit works",
    );
    await tool(mobile, "Top").click();
    before = await camera(mobile);
    await gesture(
      [
        { id: 1, x: 145, y: 280 },
        { id: 2, x: 245, y: 380 },
      ],
      [
        { id: 1, x: 170, y: 290 },
        { id: 2, x: 270, y: 390 },
      ],
    );
    check(
      JSON.stringify((await camera(mobile)).target) !==
        JSON.stringify(before.target),
      "Two-finger pan works",
    );
    await tool(mobile, "Top").click();
    before = await camera(mobile);
    await gesture(
      [
        { id: 1, x: 160, y: 280 },
        { id: 2, x: 230, y: 350 },
      ],
      [
        { id: 1, x: 135, y: 255 },
        { id: 2, x: 255, y: 375 },
      ],
    );
    check(
      JSON.stringify((await camera(mobile)).position) !==
        JSON.stringify(before.position),
      "Pinch zoom works",
    );
    await tool(mobile, "Top").click();
    await create(mobile, "Comment");
    let p = await project(mobile, [-3, 0]);
    await touch("touchStart", [{ id: 1, x: p.x, y: p.y }]);
    await touch("touchEnd", []);
    await mobile.getByLabel("Note", { exact: true }).fill("Check clearance");
    await screenshot(mobile, "basement-mobile-editor");
    await tool(mobile, "Save").click();
    check(
      (await data(mobile)).comments.length === 1,
      "Touch comment workflow saves",
    );
    await create(mobile, "Measure");
    await gesture(
      [
        { id: 1, x: 160, y: 280 },
        { id: 2, x: 230, y: 350 },
      ],
      [
        { id: 1, x: 135, y: 255 },
        { id: 2, x: 255, y: 375 },
      ],
    );
    check(
      (await mobile.locator(".model-label.draft").count()) === 0,
      "Pinch never adds accidental measurement points",
    );
    await tool(mobile, "Cancel").click();
    await tool(mobile, "Top").click();
    async function touchPoint(point, area = false) {
      const projected = await project(mobile, point, area);
      await touch("touchStart", [{ id: 1, x: projected.x, y: projected.y }]);
      await touch("touchEnd", []);
      await sleep(100);
    }
    await create(mobile, "Measure");
    await touchPoint([-3, -2]);
    await touchPoint([-1, -2]);
    check(
      (await data(mobile)).measurements[0].status === "SCAN",
      "Phone A to B creates SCAN measurement",
    );
    await mobile.getByLabel("Feet", { exact: true }).fill("6");
    await mobile.getByLabel("Inches", { exact: true }).fill("7");
    await tool(mobile, "Mark VERIFIED").click();
    check(
      (await data(mobile)).measurements[0].status === "VERIFIED",
      "Phone physical measurement verification works",
    );
    await close(mobile);
    await tool(mobile, "Metric · m").click();
    await screenshot(mobile, "basement-mobile-filters");
    await close(mobile);
    await mobile.locator(".model-label.measurement").click();
    const mobileEndpoints = (await data(mobile)).measurements.map((m) => [
      m.a,
      m.b,
    ]);
    await mobile.getByLabel("Meters", { exact: true }).fill("2.2");
    await tool(mobile, "Mark VERIFIED").click();
    check(
      (await data(mobile)).measurements[0].verifiedMeters === 2.2,
      "Metric tape entry verifies without imperial conversion input",
    );
    assert.deepEqual(
      (await data(mobile)).measurements.map((m) => [m.a, m.b]),
      mobileEndpoints,
    );
    checks++;
    await close(mobile);
    await tool(mobile, "Imperial · ft/in").click();
    await close(mobile);
    await create(mobile, "Area");
    for (const point of [
      [-4, -4],
      [-2, -4],
      [-2, -2.5],
      [-4, -2.5],
    ])
      await touchPoint(point, true);
    await tool(mobile, "Done").click();
    check(
      Math.abs((await data(mobile)).areas[0].squareMeters - 3) < 0.01,
      "Phone polygon creates correct area",
    );
    await close(mobile);
    await mobile.locator(".model-label.comment").click();
    await mobile.setViewportSize({ width: 390, height: 440 });
    await mobile
      .getByLabel("Note", { exact: true })
      .fill("Check clearance on phone");
    await tool(mobile, "Save").click();
    check(
      (await data(mobile)).comments[0].text === "Check clearance on phone",
      "Short phone viewport can save an edited note",
    );
    await mobile.setViewportSize({ width: 390, height: 844 });
    await tool(mobile, "Reset").click();
    for (const width of [390, 320]) {
      await mobile.setViewportSize({ width, height: 844 });
      check(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Phone has no horizontal overflow",
      );
      for (const selector of ["#show-panel", ".camera", ".top-actions"]) {
        const bounds = await mobile.locator(selector).boundingBox();
        check(
          bounds.x >= 0 && bounds.x + bounds.width <= width,
          `Phone controls fit: ${width} ${selector}`,
        );
      }
    }
    await mobile.setViewportSize({ width: 390, height: 844 });
    await screenshot(mobile, "basement-mobile");
    await page.setViewportSize({ width: 1280, height: 850 });
    await tool(page, "Top").click();
    await page.locator(".model-label.comment").click();
    await tool(page, "Delete").click();
    check((await data(page)).comments.length === 0, "Comment deletes");
    await page.locator(".model-label.measurement").click();
    await tool(page, "Delete").click();
    check((await data(page)).measurements.length === 0, "Measurement deletes");
    await page.locator(".model-label.area").click();
    await tool(page, "Delete").click();
    check((await data(page)).areas.length === 0, "Area deletes");

    // Real browser migration and corrupt-record protection.
    const legacy = { ...saved, schemaVersion: 1, steps: [] };
    legacy.comments[0] = {
      ...legacy.comments[0],
      category: "MOVE",
      step: 3,
      status: "DONE",
    };
    const raw = JSON.stringify(legacy);
    await page.evaluate(
      ({ legacyKey, storageKey, raw }) => {
        localStorage.removeItem(storageKey);
        localStorage.setItem(legacyKey, raw);
      },
      { legacyKey, storageKey, raw },
    );
    await page.reload();
    await ready(page);
    check(
      (await data(page)).comments[0].resolved === false,
      "Legacy comment text/position migrate without workflow semantics",
    );
    check(
      (await page.evaluate((key) => localStorage.getItem(key), legacyKey)) ===
        raw,
      "Legacy record is untouched",
    );
    check(
      !JSON.stringify(await data(page)).includes("category"),
      "Migration writes clean V2 only",
    );
    const migrated = await data(page);
    await page.reload();
    await ready(page);
    assert.deepEqual(await data(page), migrated);
    checks++;
    await page.evaluate(
      (key) => localStorage.setItem(key, "broken-json"),
      storageKey,
    );
    await page.reload();
    await ready(page);
    await tool(page, "Top").click();
    await create(page, "Comment");
    await tap(page, [-3, 0]);
    await page.getByLabel("Note", { exact: true }).fill("Temporary note");
    await tool(page, "Save").click();
    check(
      (await page.evaluate((key) => localStorage.getItem(key), storageKey)) ===
        "broken-json",
      "Editing cannot overwrite corrupt saved data",
    );
    check(
      (await page.locator("#save-state").innerText()).includes(
        "original data kept",
      ),
      "Unsaved state is explicit",
    );
    const ceiling = await newPage({ viewport: { width: 1280, height: 850 } });
    const materialRequests = [];
    ceiling.on("request", (request) => {
      if (/ceiling|\/products\//.test(request.url()))
        materialRequests.push(request.url());
    });
    await ceiling.goto(`${base}/basement/`);
    await ready(ceiling);
    check(
      materialRequests.length === 0,
      "Ceiling materials do not load during model startup",
    );
    const originalAnnotations = await data(ceiling);
    await tool(ceiling, "Execution").click();
    await ceiling.locator("#execution-panel").waitFor({ state: "visible" });
    check(
      (await ceiling.locator("#ceiling-total").innerText()) === "≈ $955.25",
      "Full-footprint ceiling estimate has correct package total",
    );
    check(
      (await ceiling.locator(".ceiling-product").count()) === 7,
      "Ceiling section shows seven material items",
    );
    check(
      (await ceiling
        .locator('.ceiling-product a[href^="https://www.homedepot.com/p/"]')
        .count()) === 7,
      "Every material has a Home Depot product link",
    );
    for (const image of await ceiling.locator(".ceiling-product img").all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((image) => image.decode());
      check(
        await image.evaluate((image) => image.naturalWidth > 0),
        "Original product image loads",
      );
    }
    await ceiling.locator("#execution-panel").evaluate((dialog) => {
      dialog.scrollTop = 0;
    });
    await screenshot(ceiling, "basement-ceiling-desktop");
    await ceiling.getByLabel("Ceiling area (ft²)").fill("320");
    await ceiling.getByLabel("Waste allowance (%)").fill("0");
    check(
      (await ceiling.locator("#ceiling-total").innerText()) === "≈ $376.92",
      "Changing area recalculates quantities and total",
    );
    await ceiling.getByLabel("Ceiling area (ft²)").fill("");
    check(
      await ceiling.locator(".ceiling-estimate").isHidden(),
      "Invalid input does not show a stale total",
    );
    await ceiling.getByLabel("Ceiling area (ft²)").fill("320");
    await tool(ceiling, "Close execution").click();
    await ceiling.waitForFunction(
      () =>
        document.querySelector("#execution").getAttribute("aria-expanded") ===
        "false",
    );
    check(
      (await ceiling.locator("#execution").getAttribute("aria-expanded")) ===
        "false",
      "Closing returns to the model",
    );
    assert.deepEqual(await data(ceiling), originalAnnotations);
    checks++;
    await ceiling.reload();
    await ready(ceiling);
    await tool(ceiling, "Execution").click();
    check(
      (await ceiling.getByLabel("Ceiling area (ft²)").inputValue()) === "320.0",
      "Ceiling estimate persists independently after reload",
    );
    await ceiling.keyboard.press("Escape");
    check(
      await ceiling.locator("#execution-panel").isHidden(),
      "Escape closes the execution dialog",
    );
    await tool(ceiling, "Metric · m").click();
    await close(ceiling);
    await tool(ceiling, "Execution").click();
    check(
      (await ceiling.getByLabel("Ceiling area (m²)").inputValue()) === "29.73",
      "Ceiling area follows metric selection",
    );
    check(
      (await ceiling.locator("#ceiling-total").innerText()) === "≈ $376.92",
      "Unit switching does not change the stored physical area or cost",
    );
    await tool(ceiling, "Use model footprint").click();
    await ceiling.getByLabel("Waste allowance (%)").fill("10");
    await tool(ceiling, "Close execution").click();
    // Mobile touch opens the same lightweight section without changing the viewer.
    await tool(mobile, "Execution").tap();
    await mobile.locator("#execution-panel").waitFor({ state: "visible" });
    check(
      await mobile.locator("#ceiling-total").isVisible(),
      "Phone shows the ceiling estimate",
    );
    await screenshot(mobile, "basement-ceiling-mobile");
    await tool(mobile, "Use drawn areas").tap();
    check(
      Math.abs(
        Number(await mobile.locator("#ceiling-area").inputValue()) -
          (await data(mobile)).areas.reduce(
            (sum, a) => sum + a.squareMeters,
            0,
          ) *
            ((await mobile
              .locator("#ceiling-area")
              .evaluate((input) =>
                input.parentElement.textContent.includes("m²"),
              ))
              ? 1
              : 10.7639104167),
      ) < 0.1,
      "Saved ceiling polygons can supply the area",
    );
    for (const width of [390, 320]) {
      await mobile.setViewportSize({ width, height: 844 });
      check(
        await mobile
          .locator("#execution-panel")
          .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
        "Ceiling list fits a narrow phone without horizontal scrolling",
      );
    }
    await tool(mobile, "Close execution").tap();
    const actionsBounds = await mobile.locator(".top-actions").boundingBox();
    check(
      actionsBounds.x >= 0 && actionsBounds.x + actionsBounds.width <= 320,
      "Execution and camera controls fit 320px width",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(broken, []);
    console.log(
      `Basement browser validation passed: ${checks} checks covering real model, model measurements, desktop navigation, simple tools, provenance, visibility, images, persistence, migration, mobile touch and optional-reference failures. No application console errors or broken requests.`,
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
