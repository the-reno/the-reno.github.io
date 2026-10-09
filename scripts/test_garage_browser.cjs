'use strict';
/** Focused Maker integration checks. No requests leave the local test host. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const site = path.resolve(__dirname, '../docs');
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.jpg':'image/jpeg','.pdf':'application/pdf','.csv':'text/csv','.zip':'application/zip'};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = path.resolve(site, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(site + path.sep)) {res.writeHead(403).end(); return;}
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {res.writeHead(404).end(); return;}
  res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, ...(process.env.RONU_CHROMIUM_PATH ? {executablePath:process.env.RONU_CHROMIUM_PATH, args:['--no-sandbox','--disable-dev-shm-usage']} : {})});
  let checks = 0;
  const check = (value, message) => {assert.ok(value, message); checks++;};
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors = [], failedLocal = [];
    await context.route('https://**/*', route => route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {if (response.url().startsWith(base) && response.status() >= 400) failedLocal.push(response.url());});
    const ready = () => page.locator('.project-article #narrative-content[aria-busy=false]').waitFor();
    const model = async () => {
      await page.locator('[data-project-model]').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => Boolean(document.querySelector('[data-project-model]')?.contentWindow?.__garageExecution3D));
      const frame = page.frames().find(item => item.url().includes('/garage-door/viewer/'));
      assert.ok(frame, 'Model iframe exists');
      await frame.waitForFunction(() => Boolean(window.__garageExecution3D));
      return frame;
    };
    await page.goto(base + '/section/maker/');
    await page.locator('.maker-project-feature').click(); await ready();
    check(new URL(page.url()).pathname === '/topic/garage-door/', 'Maker card opens canonical project');
    check(await page.locator('.nav [aria-current=page]').textContent() === 'Maker', 'Maker stays active');
    check(await page.locator('.project-step').count() === 12, 'All twelve assembly steps are present');
    check(await page.locator('.project-gallery img').count() === 8, 'Part sheets and workshop drawings are present');
    const frame = await model();
    check(await frame.locator('[data-units] option').evaluateAll(options => options.length === 1 && options[0].value === 'in'), 'Public inspector is imperial');
    await frame.locator('select[data-mode]').selectOption('leaf');
    check(await frame.evaluate(() => window.__garageExecution3D.getState().exploded === 1), 'Single-leaf view separates layers');
    await frame.locator('[data-exploded]').uncheck();
    check(await frame.evaluate(() => window.__garageExecution3D.getState().exploded === 0), 'Layer control changes model');
    await frame.locator('select[data-mode]').selectOption('lap');
    check((await frame.locator('[data-instruction]').textContent()).includes('1.905 cm'), 'Half-lap carries metric cut instructions');
    await frame.locator('select[data-mode]').selectOption('build');
    await frame.locator('select[data-step]').selectOption('5');
    check(await frame.evaluate(() => window.__garageExecution3D.getState().step === 5), 'Build-step control changes the model');
    await frame.locator('select[data-mode]').selectOption('whole');
    await frame.locator('[data-opening]').focus();
    await frame.locator('[data-opening]').press('Home');
    await frame.locator('[data-opening]').press('ArrowRight');
    check(await frame.evaluate(() => {const a=window.__garageExecution3D.getState().angles;return a.RIGHT > 0 && a.LEFT === 0;}), 'Right leaf opens before left');
    await frame.locator('[data-play]').click();
    check(await frame.evaluate(() => window.__garageExecution3D.getState().opening === 100), 'Opening action respects reduced motion');
    await frame.locator('[data-play]').click();
    await frame.locator('[data-angle]').selectOption('front');
    await frame.locator('canvas').scrollIntoViewIfNeeded();
    const box = await frame.locator('canvas').boundingBox();
    const yaw = await frame.evaluate(() => window.__garageExecution3D.getState().yaw);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 20, {steps:5});
    await page.mouse.up();
    check(await frame.evaluate(before => window.__garageExecution3D.getState().yaw !== before, yaw), 'Pointer drag rotates the model');
    const part = await frame.locator('[data-part-select] option').nth(1).getAttribute('value');
    await frame.locator('[data-part-select]').selectOption(part);
    check(await frame.evaluate(id => window.__garageExecution3D.getState().selected === id, part), 'Accessible part selector inspects a model part');
    check((await frame.locator('[data-part-size]').textContent()).includes('in'), 'Selected part dimensions use inches');
    await page.locator('[data-project-expand]').click();
    check(await page.locator('.project-step[open]').count() === 12, 'Expand-all opens every assembly step');
    await page.locator('.project-step summary').nth(2).click();
    await page.waitForFunction(() => document.querySelector('[data-project-expand]').textContent === 'Expand all steps');
    check(true, 'Aggregate step action follows manual toggles');
    await page.locator('[data-project-expand]').click();
    await page.locator('[data-project-expand]').click();
    check(await page.locator('.project-step[open]').count() === 0, 'Collapse-all closes every assembly step');
    for (const href of await page.locator('#part-8 a[download]').evaluateAll(links => links.map(link => link.getAttribute('href')))) {
      const response = await context.request.get(base + href);
      check(response.ok() && (await response.body()).length > 100, 'Download resolves: ' + href);
    }
    await page.locator('.project-contents a[href="#part-5"]').click();
    await page.waitForFunction(() => {const top=document.querySelector('#part-5').getBoundingClientRect().top;return top >= 70 && top < 350;});
    check(new URL(page.url()).hash === '#part-5', 'Project jump links scroll through the shared router');
    await page.locator('.reader-top a').click();
    check(await page.locator('.maker-project-feature').isVisible(), 'Back to Maker restores the project entry');
    check(await page.locator('[data-project-model]').count() === 0, 'Leaving the project removes its iframe');
    await page.goBack(); await ready();
    await model();
    await page.locator('#search-open').click(); await page.locator('#global-search').fill('garage');
    check(await page.locator('#search-results a[href="/topic/garage-door/"]').count() === 1, 'Global search finds project');
    await page.locator('#search-close').click();
    for (const width of [1024,780,390,320]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(base + '/topic/garage-door/'); await ready();
      const currentFrame = await model();
      await page.waitForFunction(() => {const f=document.querySelector('[data-project-model]');return parseFloat(f.style.height)>400;});
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at ' + width);
      check(await currentFrame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No model overflow at ' + width);
      check(await currentFrame.evaluate(() => document.querySelector('main').getBoundingClientRect().height <= innerHeight + 3), 'Model height includes all controls at ' + width);
      const canvas = currentFrame.locator('canvas');
      check(await canvas.evaluate(el => el.width > 200 && el.height >= 400), 'Usable model canvas at ' + width);
    }
    const nojs = await browser.newContext({javaScriptEnabled:false});
    const staticPage = await nojs.newPage();
    await staticPage.goto(base + '/section/maker/'); await staticPage.locator('.maker-project-feature').click();
    check(await staticPage.locator('.project-step').count() === 12, 'Assembly is delivered as static HTML');
    await staticPage.locator('.project-step summary').nth(1).click();
    check(await staticPage.locator('.project-step').nth(1).getAttribute('open') !== null, 'Step details work without JavaScript');
    check(await staticPage.locator('#part-8 a[download]').count() === 4, 'Downloads remain available without JavaScript');
    await nojs.close();
    check(errors.length === 0, 'No browser errors: ' + errors.join('; '));
    check(failedLocal.length === 0, 'All local assets resolve: ' + failedLocal.join('; '));
    console.log(`Garage project browser checks passed: ${checks}. Maker/search/history, static assembly, model controls, imperial inspector, downloads and responsive layout.`);
  } finally {await browser.close(); await new Promise(resolve => server.close(resolve));}
})().catch(error => {console.error(error);server.close();process.exitCode=1;});
