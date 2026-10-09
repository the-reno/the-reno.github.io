'use strict';
/** Integration tests against plain static hosting, including GitHub Pages-style 404s.
 * Requires Playwright with Chromium. No live feedback or analytics requests are sent.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const site = path.resolve(__dirname, '../docs');
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.webp':'image/webp', '.png':'image/png', '.pdf':'application/pdf', '.zip':'application/zip', '.csv':'text/csv', '.xml':'application/xml', '.txt':'text/plain'};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = path.resolve(site, '.' + decodeURIComponent(url.pathname));
  if (file !== site && !file.startsWith(site + path.sep)) {res.writeHead(403).end(); return;}
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!url.pathname.endsWith('/')) {res.writeHead(301, {Location: url.pathname + '/' + url.search}).end(); return;}
    file = path.join(file, 'index.html');
  }
  const status = fs.existsSync(file) ? 200 : 404;
  if (status === 404) file = path.join(site, '404.html');
  res.writeHead(status, {'Content-Type': (mime[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8'});
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless: true, ...(process.env.RONU_CHROMIUM_PATH ? {executablePath:process.env.RONU_CHROMIUM_PATH, args:['--no-sandbox','--disable-dev-shm-usage']} : {})});
  let checks = 0;
  const check = (value, message) => {assert.ok(value, message); checks++;};
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
    const external = [];
    await context.route('https://ronu-records.rafatreno.workers.dev/**', route => {
      external.push(JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({status: 200, contentType:'application/json', body:'{"ok":true}'});
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = async () => {await page.locator('#narrative-content[aria-busy="false"]').waitFor();};
    const topics = [
      ['garage-door', 'Rebuilding the garage doors'],
      ['prediction', 'The Complexity of Prediction'],
      ['sunlight-to-step', 'From sunlight to a single step']
    ];
    for (const [id, title] of topics) {
      const response = await page.goto(base + '/topic/' + id + '/');
      await ready();
      check(response.status() === 200, 'Direct article responds 200');
      check(await page.locator('h1:visible').textContent() === title, 'Correct direct article');
      check(await page.title() === title + ' — Ronu.one', 'Article title');
      check(await page.locator('link[rel=canonical]').getAttribute('href') === 'https://ronu.one/topic/' + id + '/', 'Article canonical');
      const article = JSON.parse(fs.readFileSync(path.join(site, 'articles', id + '.json'), 'utf8'));
      check(await page.locator('#narrative-content .story-section').count() === article.sections.length && (await page.locator('#narrative-content').innerText()).length > 500, 'Full article text');
      check((await page.reload()).status() === 200, 'Article refresh');
      await ready();
      check((await page.goto(base + '/topic/' + id)).status() === 200 && page.url().endsWith('/'), 'Trailing slash redirect');
      check((await page.goto(base + '/topic/' + id + '/index.html')).status() === 200, 'Explicit index file');
      await page.waitForURL(base + '/topic/' + id + '/');
    }
    await page.goto(base + '/');
    await page.locator('.nav a[data-section=science]').click();
    await page.waitForURL(base + '/section/science/');
    await page.locator('.article-tile').click(); await ready();
    await page.waitForURL(base + '/topic/prediction/');
    check(await page.locator('.nav a[aria-current=page]').textContent() === 'Science', 'Active section');
    await page.goBack(); await page.waitForURL(base + '/section/science/');
    check(await page.locator('.article-tile').isVisible(), 'Back restores article card');
    check(await page.locator('link[rel=canonical]').getAttribute('href') === 'https://ronu.one/section/science/', 'Back updates canonical');
    await page.goForward(); await ready();
    check(page.url() === base + '/topic/prediction/', 'Forward restores article');
    await page.locator('.reader-top a').click();
    check(page.url() === base + '/section/science/', 'Article back navigation');
    await page.locator('#search-open').click(); await page.locator('#global-search').fill('sunlight');
    check(await page.locator('#search-results a[href="/topic/sunlight-to-step/"]').count() === 1, 'Search uses real path');
    await page.locator('#search-results a[href="/topic/sunlight-to-step/"]').click(); await ready();
    check(!await page.locator('#search-dialog').evaluate(el => el.open), 'Search closes after navigation');
    // Feedback is intercepted locally: verify that article context survives the migration.
    await page.locator('#feedback-open').click();
    await page.locator('#feedback-message').fill('Local integration test');
    await page.locator('#feedback-submit').click();
    await page.locator('#feedback-success').waitFor();
    check(external.length === 1 && external[0].page === '/article/sunlight-to-step', 'Feedback retains service page identifier');
    await page.locator('.feedback-close').click();
    for (const [old, expected] of [
      ['/#topic/prediction', '/topic/prediction/'],
      ['/#topic/prediction/part-2', '/topic/prediction/#part-2'],
      ['/#topic/sunlight-to-step/article-opening', '/topic/sunlight-to-step/#article-opening'],
      ['/#topic/endurance', '/topic/sunlight-to-step/'],
      ['/#topic/spark', '/section/science/'],
      ['/#topic/unknown-legacy-article', '/'],
      ['/#section/maker?gallery=images', '/section/maker/?gallery=images'],
      ['/preview/#topic/prediction', '/topic/prediction/'],
      ['/science/prediction.html', '/topic/prediction/'],
      ['/triathlon/energy.html', '/topic/sunlight-to-step/']
    ]) {
      await page.goto(base + old); await page.waitForURL(base + expected);
      check(true, 'Legacy route ' + old);
    }
    await page.goto(base + '/topic/prediction/#part-2'); await ready();
    await page.waitForFunction(() => {
      const section = document.getElementById('part-2');
      const inset = parseFloat(getComputedStyle(section).scrollMarginTop) + parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
      return scrollY > 0 && Math.abs(section.getBoundingClientRect().top - inset) < 2;
    });
    check(true, 'Article anchor scrolls to section');
    const missing = await page.goto(base + '/topic/does-not-exist/');
    check(missing.status() === 404 && await page.locator('meta[name=robots]').getAttribute('content') === 'noindex,follow', 'Unknown article is a noindex 404');
    for (const section of ['triathlon','science','markets','maker']) {
      check((await page.goto(base + '/section/' + section + '/')).status() === 200, 'Direct section ' + section);
      check(await page.locator('h1:visible').count() === 1, 'One visible section heading');
    }
    await page.locator('[data-toggle]').click();
    await page.locator('[data-step="1"]').click();
    check(await page.locator('.carousel-slide.is-active').count() === 1, 'Gallery controls work');
    check(await page.locator('.gallery-image img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), 'Gallery assets resolve at nested URL');
    // Direct article pages remain readable without their JSON fetch or JavaScript.
    await page.route('**/articles/*.json*', route => route.abort());
    await page.goto(base + '/topic/prediction/'); await ready();
    check(!await page.locator('.story-error').count(), 'Prerendered article does not require a JSON request');
    await page.unroute('**/articles/*.json*');
    // A failed client-side article request can still be retried successfully.
    await page.goto(base + '/section/science/');
    await page.route('**/articles/prediction.json*', route => route.fulfill({status:503, body:'Unavailable'}));
    await page.locator('.article-tile').click();
    await page.locator('[data-retry-story]').waitFor();
    await page.unroute('**/articles/prediction.json*');
    await page.locator('[data-retry-story]').click(); await ready();
    check(!await page.locator('.story-error').count(), 'Article retry restores content');
    const nojs = await browser.newContext({javaScriptEnabled: false});
    const staticPage = await nojs.newPage();
    await staticPage.goto(base + '/');
    await staticPage.locator('.nav a[data-section=science]').click();
    await staticPage.locator('.article-tile').click();
    check((await staticPage.locator('#narrative-content').innerText()).length > 2000, 'No-JavaScript crawl from home to article');
    await nojs.close();
    // Mobile layout and screenshots for visual review, saved outside the repository by default.
    const screenshotDir = process.env.RONU_SCREENSHOT_DIR;
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height: 900});
      for (const route of ['/', '/section/science/', '/topic/prediction/', '/topic/sunlight-to-step/', '/topic/garage-door/', '/section/maker/']) {
        await page.goto(base + route);
        if (route.startsWith('/topic/')) await ready();
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow: ' + width + route);
        if (screenshotDir) {
          fs.mkdirSync(screenshotDir, {recursive:true});
          await page.screenshot({path:path.join(screenshotDir, width + '-' + (route.replaceAll('/', '-') || 'home') + '.png')});
        }
      }
    }
    check(errors.length === 0, 'No JavaScript errors: ' + errors.join('; '));
    check(external.length === 1, 'No unexpected visitor/feedback requests');
    console.log(`Browser validation passed: ${checks} checks, including direct URLs, refresh, navigation, history, search, redirects, anchors, gallery, feedback context, no-JavaScript access and mobile layout.`);
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); server.close(); process.exitCode = 1;});
