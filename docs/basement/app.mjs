import {STORAGE_KEY, CATEGORIES, COMMENT_STATUSES, STEP_STATUSES, M2_TO_FT2, INCH_TO_M, distance, polygonArea, polygonCenter, formatLength, nextId, validatePolygon, validateData} from './data.mjs';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const status = $('#status'), body = $('#panel-body');
export let viewer;
let data, mode = 'navigate', stepFilter = null, commentFilter = 'all', selected = null, points = [], anchors = [], editGeometry = null;
let storageOK = true, loadProblem = false, toastTimer, pendingImport = null, lastAreaTap = null;
const visible = {comments: true, measurements: false, areas: true};
const clone = value => structuredClone(value);
function el(tag, text, className) {const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n;}
function button(text, fn, className) {const n = el('button', text, className); n.type = 'button'; n.onclick = fn; return n;}
function note(text) {body.append(el('p', text, 'small'));}
function toast(text) {clearTimeout(toastTimer); $('#toast').textContent = text; $('#toast').hidden = false; toastTimer = setTimeout(() => {$('#toast').hidden = true;}, 4500);}
function save() {
  data.updatedAt = new Date().toISOString();
  if (loadProblem) {$('#save-state').textContent = 'Export to save · stored data needs recovery'; return;}
  try {localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); storageOK = true; $('#save-state').textContent = 'Saved on this device';}
  catch {storageOK = false; $('#save-state').textContent = 'Not saved · use Data → Export';}
}
function changed() {save(); refresh();}
function panel(title, selection = null) {
  selected = selection; $('#panel-title').textContent = title; body.replaceChildren(); $('#panel').hidden = false; $('#panel').scrollTop = 0; refresh();
}
function closePanel() {$('#panel').hidden = true; selected = null; refresh();}
function field(label, value, options, onChange, config = {}) {
  const id = 'field-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const name = el('label', label); name.htmlFor = id;
  const input = el(options ? 'select' : config.multiline ? 'textarea' : 'input'); input.id = id;
  if (options) options.forEach(o => input.append(new Option(typeof o === 'string' ? o : o.label, typeof o === 'string' ? o : o.value)));
  if (config.maxLength) input.maxLength = config.maxLength;
  input.value = value; input.addEventListener(options ? 'change' : 'input', () => onChange(input.value));
  body.append(name, input); return input;
}
function stepField(item) {field('Execution step', String(item.step), data.steps.map(s => ({value: String(s.id), label: `${String(s.id).padStart(2, '0')} ${s.name}`})), v => {item.step = Number(v); changed();});}
function actions(...buttons) {const row = el('div', undefined, 'panel-actions'); row.append(...buttons); body.append(row);}
function removeItem(type, item) {
  const existing = body.querySelector('.confirm-delete'); if (existing) return;
  const box = el('div', undefined, 'confirm-delete'); box.append(el('p', `Delete ${item.id}?`));
  const row = el('div', undefined, 'row'); row.append(button('Keep', () => box.remove()), button('Delete', () => {data[type] = data[type].filter(x => x.id !== item.id); closePanel(); changed();}, 'danger')); box.append(row); body.append(box); box.scrollIntoView({block: 'nearest'});
}
function openComment(c) {
  setMode('navigate'); panel(c.id, {type: 'comment', id: c.id});
  field('Comment', c.text, null, v => {c.text = v; changed();}, {multiline: true, maxLength: 5000});
  field('Category', c.category, CATEGORIES, v => {c.category = v; changed();});
  stepField(c); field('Status', c.status, COMMENT_STATUSES, v => {c.status = v; changed();});
  actions(button('Move marker', () => {editGeometry = {type: 'comment', item: c}; setMode('comment', true);}), button('Delete', () => removeItem('comments', c), 'danger'));
  note('Changes save automatically on this device.');
}
function lengthOf(m) {return m.status === 'VERIFIED' ? m.verifiedMeters : distance(m.a, m.b);}
function openMeasurement(m) {
  setMode('navigate'); panel(m.id, {type: 'measurement', id: m.id});
  body.append(el('div', formatLength(lengthOf(m)), 'value'));
  const badge = el('span', m.status, `badge ${m.status === 'VERIFIED' ? 'verified' : ''}`); body.append(badge);
  note(`${lengthOf(m).toFixed(3)} m · scan geometry ${distance(m.a, m.b).toFixed(3)} m`);
  field('Name', m.name, null, v => {m.name = v; changed();}, {maxLength: 80}); stepField(m);
  note('Confirm the length with a tape or laser before marking VERIFIED.');
  const row = el('div', undefined, 'row');
  const totalInches = lengthOf(m) / INCH_TO_M, feet = Math.floor(totalInches / 12);
  function numeric(label, value) {const wrap = el('div'), lab = el('label', label), input = el('input'); lab.htmlFor = 'confirmed-' + label.toLowerCase(); input.id = lab.htmlFor; input.type = 'number'; input.min = '0'; input.step = label === 'Feet' ? '1' : '.125'; input.inputMode = 'decimal'; input.value = String(value); wrap.append(lab, input); row.append(wrap); return input;}
  const ft = numeric('Feet', feet), inches = numeric('Inches', Number((totalInches - feet * 12).toFixed(3))); body.append(row);
  actions(button('Mark VERIFIED', () => {
    const f = Number(ft.value), i = Number(inches.value), value = (f * 12 + i) * INCH_TO_M;
    if (!ft.value || !inches.value || !Number.isInteger(f) || f < 0 || !Number.isFinite(i) || i < 0 || i >= 12 || value <= 0 || value > 1000) return toast('Enter feet and inches. Inches must be between 0 and 12.');
    m.status = 'VERIFIED'; m.verifiedMeters = value; m.verifiedAt = new Date().toISOString(); changed(); openMeasurement(m); toast('Length manually confirmed.');
  }), button('Use SCAN', () => {m.status = 'SCAN'; delete m.verifiedMeters; delete m.verifiedAt; changed(); openMeasurement(m);}));
  actions(button('Move A', () => {editGeometry = {type: 'measurement', item: m, endpoint: 'a'}; setMode('measure', true);}), button('Move B', () => {editGeometry = {type: 'measurement', item: m, endpoint: 'b'}; setMode('measure', true);}), button('Delete', () => removeItem('measurements', m), 'danger'));
}
function openArea(a) {
  setMode('navigate'); panel(a.id, {type: 'area', id: a.id});
  body.append(el('div', `≈ ${(a.squareMeters * M2_TO_FT2).toFixed(1)} sq ft`, 'value'));
  note(`${a.squareMeters.toFixed(2)} m² · SCAN · horizontal ceiling footprint`);
  field('Name', a.name, null, v => {a.name = v; changed();}, {maxLength: 80}); stepField(a);
  note(`${a.points.length} corners. Separate zones share edges; they cannot overlap.`);
  actions(button('Redraw outline', () => {editGeometry = {type: 'area', item: a}; setMode('area', true);}), button('Delete', () => removeItem('areas', a), 'danger'));
}
function openItem(type, item) {({comment: openComment, measurement: openMeasurement, area: openArea})[type](item);}
function matchesStep(item) {return !stepFilter || item.step === stepFilter;}
function matchesComment(c) {return matchesStep(c) && (commentFilter === 'all' || (commentFilter === 'done' ? c.status === 'DONE' : c.status !== 'DONE'));}
function openList() {
  setMode('navigate'); panel(stepFilter ? `Step ${String(stepFilter).padStart(2, '0')} items` : 'Saved items');
  const groups = [['Comments', 'comment', data.comments.filter(matchesComment)], ['Measurements', 'measurement', data.measurements.filter(matchesStep)], ['Areas', 'area', data.areas.filter(matchesStep)]];
  if (!groups.some(g => g[2].length)) {body.append(el('p', 'No items in this view.', 'empty')); return;}
  for (const [title, type, items] of groups) {
    if (!items.length) continue; body.append(el('div', title, 'list-group'));
    for (const item of items) {
      const name = type === 'comment' ? item.text || 'Add a comment' : item.name || item.id;
      const b = button(`${item.id} · ${name}`, () => openItem(type, item), 'list-item');
      const info = type === 'comment' ? `${item.category} · ${item.status}` : type === 'measurement' ? `${formatLength(lengthOf(item))} · ${item.status}` : `≈ ${(item.squareMeters * M2_TO_FT2).toFixed(1)} sq ft`;
      b.append(el('small', info)); body.append(b);
    }
  }
}
function openStep(step) {
  setMode('navigate'); stepFilter = step.id; panel(`${String(step.id).padStart(2, '0')} ${step.name}`);
  field('Step status', step.status, STEP_STATUSES, v => {step.status = v; changed();});
  const count = data.comments.filter(c => c.step === step.id).length, measures = data.measurements.filter(m => m.step === step.id).length;
  note(`${count} comments · ${measures} measurements`);
  note('Related markers are shown. New items use this step.');
  actions(button('View items', openList), button('Show all steps', () => {stepFilter = null; closePanel(); refresh();}));
}
function refresh() {
  if (!viewer || !data) return;
  const items = [];
  function label(type, item, text) {
    const node = button(text, () => {if (mode === 'navigate') openItem(type, item);}, `model-label ${type}${item.status === 'DONE' ? ' done' : ''}${selected?.id === item.id ? ' selected' : ''}`);
    node.dataset.id = item.id; node.title = type === 'comment' ? `${item.id} · ${item.category} · ${item.text || 'Add a comment'}` : `${item.id} · ${item.name}`;
    node.setAttribute('aria-label', type === 'comment' ? `${item.id}: ${item.text || 'Comment'}` : `${item.name || item.id}: ${text}`);
    if (type === 'measurement') node.append(el('span', item.status, `badge ${item.status === 'VERIFIED' ? 'verified' : ''}`));
    if (type === 'measurement' || type === 'area') {
      node.replaceChildren(el('span', item.name || item.id, 'label-name'));
      const row = el('span', undefined, 'label-line');
      row.append(el('span', type === 'measurement' ? formatLength(lengthOf(item)) : `≈ ${(item.squareMeters * M2_TO_FT2).toFixed(1)} sq ft`));
      if (type === 'measurement') row.append(el('span', item.status, `badge ${item.status === 'VERIFIED' ? 'verified' : ''}`));
      node.append(row);
    }
    items.push({...item, type, node});
  }
  if (visible.comments) data.comments.filter(matchesComment).forEach(c => label('comment', c, c.id));
  if (visible.measurements) data.measurements.filter(matchesStep).forEach(m => label('measurement', m, `${m.name || m.id} · ${formatLength(lengthOf(m))}`));
  if (visible.areas) data.areas.filter(matchesStep).forEach(a => label('area', a, `${a.name || a.id} · ≈ ${(a.squareMeters * M2_TO_FT2).toFixed(1)} sq ft`));
  viewer.renderItems(items); viewer.showDraft(points, mode === 'area');
  $('#area-total').textContent = `Ceiling zones: ≈ ${(data.areas.reduce((sum, a) => sum + a.squareMeters, 0) * M2_TO_FT2).toLocaleString(undefined, {maximumFractionDigits: 1})} sq ft`;
  $('#step-buttons').replaceChildren();
  for (const step of data.steps) {
    const b = button('', () => openStep(step)); b.dataset.step = String(step.id); b.setAttribute('aria-pressed', String(stepFilter === step.id)); b.title = step.status;
    b.setAttribute('aria-label', `${String(step.id).padStart(2, '0')} ${step.name}: ${step.status}`);
    b.append(el('span', '', `step-dot ${step.status === 'Complete' ? 'complete' : step.status === 'In progress' ? 'progress' : ''}`), el('span', String(step.id).padStart(2, '0'), 'step-number'), el('span', step.name));
    $('#step-buttons').append(b);
  }
  $('#all-steps').setAttribute('aria-pressed', String(!stepFilter));
  $$('[data-visibility]').forEach(b => b.setAttribute('aria-pressed', String(visible[b.dataset.visibility])));
  $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === commentFilter)));
}
function setMode(next, keepEdit = false) {
  const oldEdit = keepEdit ? editGeometry : null;
  mode = next; points = []; anchors = []; editGeometry = oldEdit; lastAreaTap = null;
  $('#panel').hidden = true; selected = null;
  $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  $('#drawing-actions').hidden = mode === 'navigate'; $('#finish-area').hidden = mode !== 'area'; $('#undo-point').hidden = mode === 'comment' || !!editGeometry && mode !== 'area';
  $('#prompt').classList.toggle('drawing', mode !== 'navigate');
  viewer?.setMode(mode);
  if (mode === 'area') viewer?.fit('top');
  updateInstruction(); refresh();
}
function updateInstruction() {
  $('#instruction').textContent = mode === 'navigate' ? 'Drag to orbit · Scroll / pinch to zoom · Right-drag / two fingers to pan'
    : mode === 'comment' ? editGeometry ? 'Tap the new marker position' : 'Tap a place on the model to add a comment'
    : mode === 'measure' ? editGeometry ? `Tap the new Point ${editGeometry.endpoint.toUpperCase()}` : points.length ? 'Tap Point B · drag to adjust your view' : 'Tap Point A · drag to adjust your view'
    : `Tap ceiling-zone corners · ${points.length} placed · Finish to save`;
  $('#finish-area').disabled = points.length < 3; $('#undo-point').disabled = points.length === 0;
}
function activeStep(fallback) {return stepFilter || fallback;}
function checkFootprint(outline) {
  if (outline.some(p => Math.abs(p[1] - viewer.ceilingY) > .01)) throw new Error('This zone uses a different ceiling reference plane.');
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length], samples = Math.ceil(distance(a, b) / .1);
    for (let j = 0; j <= samples; j++) if (!viewer.onFloor(a.map((v, k) => v + (b[k] - v) * j / samples))) throw new Error('An edge leaves the basement footprint. Adjust the outline.');
  }
}
function handleTap(hit, screen) {
  if (mode === 'navigate') {closePanel(); return;}
  if (!hit) {toast(mode === 'area' ? 'Tap inside the basement footprint.' : 'Tap a wall, floor or another model surface.');return;}
  const p = hit.position;
  if (mode === 'comment') {
    let c;
    if (editGeometry) {c = editGeometry.item; c.position = p; c.anchor = hit.object;}
    else {c = {id: nextId(data, 'comment'), position: p, anchor: hit.object, text: '', category: 'GENERAL', step: activeStep(1), status: 'OPEN'}; data.comments.push(c);}
    visible.comments = true; commentFilter = 'all'; changed(); openComment(c); return;
  }
  if (mode === 'measure') {
    if (editGeometry) {
      const m = editGeometry.item, other = editGeometry.endpoint === 'a' ? m.b : m.a;
      if (distance(p, other) < .001) return toast('Pick two different points.');
      m[editGeometry.endpoint] = p; m.anchors ||= {}; m.anchors[editGeometry.endpoint] = hit.object;
      m.position = m.a.map((v, i) => (v + m.b[i]) / 2); m.status = 'SCAN'; delete m.verifiedMeters; delete m.verifiedAt;
      changed();openMeasurement(m);toast('Point moved. Confirm the new length by hand.');return;
    }
    if (points.length && distance(points[0], p) < .001) return toast('Pick a different Point B.');
    points.push(p); anchors.push(hit.object);
    if (points.length === 2) {
      const id = nextId(data, 'measurement'), m = {id, name: id, a: points[0], b: points[1], position: polygonCenter(points), anchors: {a: anchors[0], b: anchors[1]}, step: activeStep(1), status: 'SCAN'};
      data.measurements.push(m); visible.measurements = true; changed(); openMeasurement(m);return;
    }
  }
  if (mode === 'area') {
    if (points.length >= 3 && Math.hypot(screen.x - viewer.project(points[0]).x, screen.y - viewer.project(points[0]).y) < 16) {finishArea(); return;}
    // Ignore the second tap of an accidental double tap at the same corner.
    if (lastAreaTap && Date.now() - lastAreaTap.time < 350 && Math.hypot(screen.x - lastAreaTap.x, screen.y - lastAreaTap.y) < 16) return;
    if (points.length && distance(points.at(-1), p) < .01) return toast('Tap a different corner.');
    if (points.length >= 100) return toast('Finish this zone before adding more corners.');
    points.push(p); lastAreaTap = {...screen, time: Date.now()};
  }
  updateInstruction(); viewer.showDraft(points, mode === 'area');
}
function finishArea() {
  try {
    const others = data.areas.filter(a => a.id !== editGeometry?.item.id), area = validatePolygon(points, others);
    checkFootprint(points);
    let item;
    if (editGeometry) {item = editGeometry.item; Object.assign(item, {points: clone(points), squareMeters: area, position: polygonCenter(points)});}
    else {const id = nextId(data, 'area'); item = {id, name: id, points: clone(points), squareMeters: area, position: polygonCenter(points), step: activeStep(4), source: 'SCAN', projection: 'horizontal'}; data.areas.push(item);}
    visible.areas = true; changed(); openArea(item);
  } catch (e) {toast(e.message);}
}
function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], {type: 'application/json'}), url = URL.createObjectURL(blob);
  const a = el('a'); a.href = url; a.download = 'basement-execution-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.append(a);a.click();a.remove();setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function openData() {
  setMode('navigate');panel('Execution data');
  note('Saved on this browser and device. Export a copy, then import it on your phone or computer. There is no automatic sync.');
  if (!storageOK) note('Browser storage is unavailable. Export before closing this page.');
  if (loadProblem) note('Stored data could not be read. Export the recovery file before replacing it.');
  actions(button('Export JSON', exportData), button('Import JSON', () => $('#import-file').click()));
  if (loadProblem) actions(button('Export recovery file', () => {
    const raw = localStorage.getItem(STORAGE_KEY) || ''; const url = URL.createObjectURL(new Blob([raw], {type: 'application/json'}));
    const a = el('a'); a.href = url; a.download = 'basement-recovery.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }));
  note('SCAN dimensions and zone areas are approximate. VERIFIED stores your manually confirmed length.');
  const a = el('a', 'Original navigation-only viewer'); a.href = './navigation.html'; body.append(a);
}
async function readImport(file) {
  if (!file) return;
  try {
    if (file.size > 4 * 1024 * 1024) throw new Error('Choose a JSON file under 4 MB.');
    pendingImport = validateData(JSON.parse(await file.text()));
    // Reject geometry unrelated to this room even when a model ID was copied.
    const positions = [...pendingImport.comments.map(c => c.position), ...pendingImport.measurements.flatMap(m => [m.a, m.b]), ...pendingImport.areas.flatMap(a => a.points)];
    if (positions.some(p => p.some((v, i) => v < viewer.box.min.getComponent(i) - .1 || v > viewer.box.max.getComponent(i) + .1))) throw new Error('The imported points are outside this basement model.');
    pendingImport.areas.forEach(a => checkFootprint(a.points));
    panel('Import execution data'); note(`${pendingImport.comments.length} comments · ${pendingImport.measurements.length} measurements · ${pendingImport.areas.length} zones`);
    note('Import replaces the data on this device. Export your current data first if you need to keep it.');
    actions(button('Export current', exportData), button('Replace with import', () => {data = pendingImport; pendingImport = null; loadProblem = false; stepFilter = null;commentFilter = 'all'; visible.measurements = true; setMode('navigate'); changed();toast('Execution data imported.');}, 'accent'), button('Cancel', () => {pendingImport = null;openData();}));
  } catch (e) {toast(`Import failed: ${e.message}`);}
  $('#import-file').value = '';
}

try {
  const response = await fetch('./execution.json'); if (!response.ok) throw new Error('Execution data unavailable');
  const defaults = validateData(await response.json()); data = defaults;
  let raw;
  try {raw = localStorage.getItem(STORAGE_KEY);} catch {storageOK = false;}
  if (raw) {try {data = validateData(JSON.parse(raw));} catch {loadProblem = true;}}
  const {createViewer} = await import('./viewer.mjs'); viewer = await createViewer($('#view'), handleTap);
  $('#top').onclick = () => viewer.fit('top');
  $('#three').onclick = () => {if (mode === 'area') setMode('navigate'); viewer.fit('three');};
  $('#reset').onclick = () => {setMode('navigate');viewer.fit('three');};
  $$('[data-mode]').forEach(b => {b.disabled = false;b.onclick = () => setMode(b.dataset.mode);});
  $$('[data-visibility]').forEach(b => {b.disabled = false;b.onclick = () => {visible[b.dataset.visibility] = !visible[b.dataset.visibility];refresh();};});
  $$('[data-filter]').forEach(b => {b.disabled = false;b.onclick = () => {commentFilter = b.dataset.filter;refresh();if (!$('#panel').hidden && !selected) openList();};});
  for (const id of ['top', 'three', 'reset', 'list', 'data', 'all-steps']) $('#' + id).disabled = false;
  $('#close-panel').onclick = closePanel; $('#list').onclick = openList; $('#data').onclick = openData;
  $('#all-steps').onclick = () => {stepFilter = null; closePanel(); refresh();};
  $('#undo-point').onclick = () => {points.pop(); anchors.pop();lastAreaTap = null;updateInstruction();viewer.showDraft(points, mode === 'area');};
  $('#finish-area').onclick = finishArea; $('#cancel-drawing').onclick = () => setMode('navigate');
  $('#import-file').onchange = e => readImport(e.target.files[0]);
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {if (e.key === 'Escape') document.activeElement.blur();return;}
    if (e.key === 'Escape') {setMode('navigate');closePanel();}
    if (e.key === 'Enter' && mode === 'area') {e.preventDefault();finishArea();}
  });
  window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEY) return;
    try {if (!e.newValue) return; data = validateData(JSON.parse(e.newValue));setMode('navigate');refresh();toast('Updated from another tab.');} catch {toast('Another tab saved unreadable data. Your current view was kept.');}
  });
  $('#view canvas').addEventListener('webglcontextlost', e => {e.preventDefault(); status.hidden = false;status.textContent = '3D view interrupted. Reload this page to continue.';});
  // Do not overwrite a corrupt saved record just by loading the page.
  $('#save-state').textContent = loadProblem ? 'Stored data needs recovery · open Data' : storageOK ? 'Saved on this device' : 'Not saved · use Data → Export';
  status.hidden = true;setMode('navigate');
  if (loadProblem) toast('Stored data could not be read. Open Data to export a recovery file.');
} catch (error) {
  console.error(error);status.hidden = false;
  status.textContent = /WebGL|context/i.test(error.message) ? '3D requires WebGL. Enable browser graphics acceleration or try another browser.' : 'Could not open the basement. Reload to try again.';
  const fallback = el('a', 'Open original viewer'); fallback.href = './navigation.html';status.append(fallback);
}
