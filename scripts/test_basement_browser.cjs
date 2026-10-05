const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../docs');
const artifactDir = process.env.BASEMENT_SCREENSHOT_DIR;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); if (p.endsWith('/')) p += 'index.html';
      const file = path.join(root, p); if (!file.startsWith(root + path.sep)) throw new Error('path');
      const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.gltf':'model/gltf+json'};
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(await fs.readFile(file));
    } catch {res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  server.unref();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless:true, executablePath:process.env.BASEMENT_CHROMIUM_PATH || undefined, args:['--no-sandbox','--no-zygote','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  try {
    if (artifactDir) await fs.mkdir(artifactDir, {recursive:true});
    const page = await browser.newPage({viewport:{width:1280,height:850}}), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // Optional local copy of the same pinned Three release for network-independent QA.
    if (process.env.BASEMENT_THREE_PATH) await page.route('https://cdn.jsdelivr.net/npm/three@0.180.0/**', async route => {
      const relative = new URL(route.request().url()).pathname.split('/three@0.180.0/')[1];
      await route.fulfill({body:await fs.readFile(path.join(process.env.BASEMENT_THREE_PATH, relative)), contentType:'text/javascript', headers:{'Access-Control-Allow-Origin':'*'}});
    });
    const entry = process.env.BASEMENT_ENTRY || 'index.html';
    await page.goto(`${base}/basement/${entry}`); await page.locator('#status').waitFor({state:'hidden',timeout:30000});
    const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('ronu.basement.execution.v1')));
    const camera = () => page.evaluate(async () => (await import('/basement/app.mjs?v=1')).viewer.camera.position.toArray());
    const screen = p => page.evaluate(async p => {const v=(await import('/basement/app.mjs?v=1')).viewer;const area=document.querySelector('[data-mode="area"]').getAttribute('aria-pressed')==='true';return v.project([p[0], area?v.ceilingY:-1.13053, p[1]]);}, p);
    const tap = async p => {const s=await screen(p);await page.mouse.click(s.x,s.y);await sleep(80);if(process.env.BASEMENT_DEBUG)console.log('tap',p,s,await page.locator('#instruction').textContent(),await page.locator('#toast').textContent());};
    const tool = name => page.getByRole('button',{name,exact:true});
    const close = () => page.getByRole('button',{name:'Close editor'}).click();
    assert.equal(await tool('Navigate').getAttribute('aria-pressed'), 'true');
    const initial = await camera();
    await page.mouse.move(850,400);await page.mouse.down();await page.mouse.move(950,470,{steps:10});await page.mouse.up();await sleep(300);
    assert.notDeepEqual(await camera(),initial);
    await tool('Reset').click();await sleep(200);
    assert.ok((await camera()).every((x,i)=>Math.abs(x-initial[i])<.02));
    await tool('Top').click();assert.equal(await tool('Top').getAttribute('aria-pressed'),'true');
    await page.mouse.move(850,400);const beforePan=await camera();await page.mouse.down({button:'right'});await page.mouse.move(900,420,{steps:5});await page.mouse.up({button:'right'});await sleep(100);assert.notDeepEqual(await camera(),beforePan);
    await tool('Top').click();const beforeZoom=await camera();await page.mouse.move(850,400);await page.mouse.wheel(0,-200);await sleep(200);assert.notDeepEqual(await camera(),beforeZoom);await tool('Top').click();

    await tool('+ Comment').click();
    await page.mouse.move(850,400);await page.mouse.down();await page.mouse.move(950,470,{steps:8});await page.mouse.up();await sleep(100);
    assert.equal(await data(),null); // an orbit drag must not place a comment
    await tool('Top').click();await tap([-3,-3]);
    assert.equal((await data()).comments.length,1);assert.equal((await data()).comments[0].id,'C01');
    await page.getByLabel('Comment',{exact:true}).fill('Check if PEX can move <script>');
    await page.getByLabel('Category',{exact:true}).selectOption('MOVE');
    await page.getByLabel('Execution step',{exact:true}).selectOption('3');
    await page.getByLabel('Status',{exact:true}).selectOption('IN PROGRESS');await close();
    assert.equal((await data()).comments[0].step,3);assert.equal(await page.locator('#panel script').count(),0);

    await tool('Measure').click();await tap([-3,-2]);await tap([-1,-2]);
    assert.equal((await data()).measurements.length,1);const m=(await data()).measurements[0];assert.ok(Math.abs(Math.hypot(...m.a.map((v,i)=>v-m.b[i]))-2)<.01);
    await page.getByLabel('Name',{exact:true}).fill('Column spacing');
    await page.getByLabel('Feet',{exact:true}).fill('6');await page.getByLabel('Inches',{exact:true}).fill('7');await tool('Mark VERIFIED').click();
    assert.equal((await data()).measurements[0].status,'VERIFIED');assert.ok(Math.abs((await data()).measurements[0].verifiedMeters-79*.0254)<1e-9);
    await tool('Move B').click();await tap([-.8,-2]);assert.equal((await data()).measurements[0].status,'SCAN');assert.equal((await data()).measurements[0].verifiedMeters,undefined);await close();
    await page.locator('[data-visibility="measurements"]').click();assert.equal(await page.locator('.model-label.measurement').count(),0);
    await page.locator('[data-visibility="measurements"]').click();assert.equal(await page.locator('.model-label.measurement').count(),1);

    await tool('Areas').first().click();await tap([-4,-4]);await tap([-2,-4]);await tap([-2,-2.5]);await tap([-4,-2.5]);await tool('Finish zone').click();
    assert.equal((await data()).areas.length,1);assert.ok(Math.abs((await data()).areas[0].squareMeters-3)<.01,JSON.stringify((await data()).areas));await page.getByLabel('Name',{exact:true}).fill('A1 · Main ceiling');await close();
    await tool('Areas').first().click();await tap([-3.5,-3.5]);await tap([-2.5,-3.5]);await tap([-2.5,-3]);await tool('Finish zone').click();
    assert.equal((await data()).areas.length,1);assert.match(await page.locator('#toast').textContent(),/overlaps/);await tool('Cancel').click();
    await tool('Areas').first().click();await tap([-2,-4]);await tap([0,-4]);await tap([0,-2.5]);await tap([-2,-2.5]);await tool('Finish zone').click();
    assert.equal((await data()).areas.length,2);await close();assert.match(await page.locator('#area-total').textContent(),/64.6/);
    await page.locator('[data-step="3"]').click();await page.getByLabel('Step status').selectOption('In progress');await close();
    assert.equal(await page.locator('.model-label.comment').count(),1);assert.equal(await page.locator('.model-label.measurement').count(),0);assert.equal((await data()).steps[2].status,'In progress');
    await page.locator('.model-label.comment').click();await page.getByLabel('Status',{exact:true}).selectOption('DONE');await close();
    await tool('Open').click();assert.equal(await page.locator('.model-label.comment').count(),0);await tool('Done').click();assert.equal(await page.locator('.model-label.comment').count(),1);
    await tool('All steps').click();await tool('All').click();
    if(artifactDir){await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:path.join(artifactDir,'basement-desktop.png')});}

    await tool('Data').click();const downloadPromise=page.waitForEvent('download');await tool('Export JSON').click();const download=await downloadPromise;
    const file=await download.path(), exported=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(exported.comments.length,1);assert.equal(exported.areas.length,2);
    await close();await page.reload();await page.locator('#status').waitFor({state:'hidden'});assert.equal((await data()).areas.length,2);assert.equal(await page.locator('.model-label.measurement').count(),0);
    await tool('Data').click();await page.locator('#import-file').setInputFiles({name:'execution.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await tool('Replace with import').click();assert.equal((await data()).measurements.length,1);
    await tool('List').click();await page.locator('.list-item').filter({hasText:'Column spacing'}).click();await tool('Delete').click();await page.locator('.confirm-delete').getByRole('button',{name:'Delete',exact:true}).click();assert.equal((await data()).measurements.length,0);
    await tool('Data').click();await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":1}')});assert.match(await page.locator('#toast').textContent(),/Import failed/);assert.equal((await data()).areas.length,2);await close();

    await page.setViewportSize({width:390,height:844});await tool('Top').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    for(const selector of ['.primary','.visibility','.camera']){const bounds=await page.locator(selector).boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);}
    if(artifactDir){await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:path.join(artifactDir,'basement-mobile.png')});}
    await tool('List').click();await page.locator('.list-item').filter({hasText:'Check if PEX'}).click();assert.equal(await page.getByLabel('Comment',{exact:true}).isVisible(),true);await page.getByLabel('Comment',{exact:true}).fill('Check PEX before drywall');if(artifactDir)await page.screenshot({path:path.join(artifactDir,'basement-mobile-editor.png')});await close();

    // Actual touch gestures, not mouse events in a narrow viewport.
    const session=await page.context().newCDPSession(page), touch=(type,points)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:points});
    await tool('+ Comment').click();const p=await screen([-3,0]);await touch('touchStart',[{id:1,x:p.x,y:p.y}]);await touch('touchEnd',[]);await sleep(200);assert.equal((await data()).comments.length,2);await close();
    await tool('Measure').click();const count=(await data()).measurements.length;
    await touch('touchStart',[{id:1,x:165,y:390},{id:2,x:230,y:460}]);await touch('touchMove',[{id:1,x:145,y:380},{id:2,x:250,y:470}]);await touch('touchEnd',[]);await sleep(200);assert.equal((await data()).measurements.length,count);assert.equal(await page.locator('.model-label.draft').count(),0);await tool('Cancel').click();
    await tool('Reset').click();assert.equal(await tool('Navigate').getAttribute('aria-pressed'),'true');
    await tool('Top').click();
    // Edit geometry and delete remaining item types through their actual editors.
    await tool('List').click();await page.locator('.list-item').filter({hasText:'Check PEX before drywall'}).click();await tool('Move marker').click();await tap([-3,-.5]);assert.equal((await data()).comments[0].id,'C01');assert.equal((await data()).comments[0].status,'DONE');await close();
    await tool('List').click();await page.locator('.list-item').filter({hasText:'A2 · A2'}).click();await tool('Redraw outline').click();await tap([0,-4]);await tap([2,-4]);await tap([2,-2.5]);await tap([0,-2.5]);await tool('Finish zone').click();assert.equal((await data()).areas[1].id,'A2');assert.ok(Math.abs((await data()).areas[1].squareMeters-3)<.01);
    await tool('Delete').click();await page.locator('.confirm-delete').getByRole('button',{name:'Delete',exact:true}).click();assert.equal((await data()).areas.length,1);
    await tool('List').click();await page.locator('.list-item').filter({hasText:'C02'}).click();await tool('Delete').click();await page.locator('.confirm-delete').getByRole('button',{name:'Delete',exact:true}).click();assert.equal((await data()).comments.length,1);
    // A corrupt browser record must survive loading and editing until explicitly replaced.
    await page.evaluate(()=>localStorage.setItem('ronu.basement.execution.v1','broken-json'));
    await page.reload();await page.locator('#status').waitFor({state:'hidden'});assert.match(await page.locator('#save-state').textContent(),/recovery/);
    await tool('Top').click();await tool('+ Comment').click();await tap([-3,0]);await close();assert.equal(await page.evaluate(()=>localStorage.getItem('ronu.basement.execution.v1')),'broken-json');
    await tool('Data').click();const recoveryPromise=page.waitForEvent('download');await tool('Export recovery file').click();const recovery=await recoveryPromise;assert.equal(await fs.readFile(await recovery.path(),'utf8'),'broken-json');
    await page.locator('#import-file').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await tool('Replace with import').click();assert.equal((await data()).areas.length,2);
    assert.deepEqual(errors,[]);
    console.log('Basement browser checks passed: navigation, comments, measurements, zones, filters, recovery-safe persistence, export/import and mobile touch.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
