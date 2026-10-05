import {STORAGE_KEY, M2_TO_FT2, INCH_TO_M, distance, polygonCenter, formatLength, nextId, validatePolygon, validateData} from './data.mjs';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const status = $('#status'), body = $('#panel-body');
let viewer, data, mode = 'navigate', selected = null, points = [], anchors = [], editGeometry = null;
let toastTimer, lastAreaTap = null;
const visible = {comments: true, measurements: true, areas: true};
const clone = value => structuredClone(value);

function el(tag, text, className) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (className) n.className = className;
  return n;
}
function button(text, fn, className) {
  const n = el('button', text, className);
  n.type = 'button';
  n.onclick = fn;
  return n;
}
function toast(text) {
  clearTimeout(toastTimer);
  $('#toast').textContent = text;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => {$('#toast').hidden = true;}, 3500);
}
function save() {
  data.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    $('#save-state').textContent = 'Saved on this device';
  } catch {
    $('#save-state').textContent = 'Not saved on this device';
  }
}
function changed() {save(); refresh();}
function panel(title, selection = null) {
  selected = selection;
  $('#panel-title').textContent = title;
  body.replaceChildren();
  $('#panel').hidden = false;
  refresh();
}
function closePanel() {
  $('#panel').hidden = true;
  selected = null;
  refresh();
}
function field(label, value, onChange, config = {}) {
  const id = 'field-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const lab = el('label', label); lab.htmlFor = id;
  const input = el(config.multiline ? 'textarea' : 'input');
  input.id = id;
  if (config.maxLength) input.maxLength = config.maxLength;
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  body.append(lab, input);
  return input;
}
function note(text) {body.append(el('p', text, 'small'));}
function actions(...buttons) {
  const row = el('div', undefined, 'panel-actions');
  row.append(...buttons);
  body.append(row);
}
function removeItem(type, item) {
  data[type] = data[type].filter(x => x.id !== item.id);
  closePanel();
  changed();
}
function lengthOf(m) {return m.status === 'VERIFIED' ? m.verifiedMeters : distance(m.a, m.b);}

function openComment(c) {
  setMode('navigate');
  panel(c.id, {type:'comment', id:c.id});
  field('Comment', c.text, v => {c.text = v; changed();}, {multiline:true, maxLength:5000});
  actions(
    button(c.resolved ? 'Show note' : 'Resolve / hide', () => {c.resolved = !c.resolved; changed(); closePanel();}),
    button('Move', () => {editGeometry = {type:'comment', item:c}; setMode('comment', true);}),
    button('Delete', () => removeItem('comments', c), 'danger')
  );
}
function openMeasurement(m) {
  setMode('navigate');
  panel(m.name || m.id, {type:'measurement', id:m.id});
  body.append(el('div', formatLength(lengthOf(m)), 'value'));
  body.append(el('span', m.status, `badge ${m.status === 'VERIFIED' ? 'verified' : ''}`));
  note(`${lengthOf(m).toFixed(3)} m`);
  field('Name (optional)', m.name === m.id ? '' : m.name, v => {m.name = v || m.id; changed();}, {maxLength:80});
  const totalInches = lengthOf(m) / INCH_TO_M, feet = Math.floor(totalInches / 12);
  const row = el('div', undefined, 'row');
  const ft = el('input'), inches = el('input');
  ft.type = inches.type = 'number'; ft.min = inches.min = '0'; ft.step = '1'; inches.step = '.125';
  ft.value = String(feet); inches.value = String(Number((totalInches - feet * 12).toFixed(3)));
  row.append(ft, inches); body.append(row);
  note('Enter a tape/laser value only if you want to mark this measurement VERIFIED.');
  actions(
    button('Mark VERIFIED', () => {
      const f = Number(ft.value), i = Number(inches.value), value = (f * 12 + i) * INCH_TO_M;
      if (!Number.isInteger(f) || f < 0 || !Number.isFinite(i) || i < 0 || i >= 12 || value <= 0) return toast('Enter valid feet and inches.');
      m.status = 'VERIFIED'; m.verifiedMeters = value; m.verifiedAt = new Date().toISOString(); changed(); openMeasurement(m);
    }),
    button('Use SCAN', () => {m.status='SCAN'; delete m.verifiedMeters; delete m.verifiedAt; changed(); openMeasurement(m);}),
    button('Delete', () => removeItem('measurements', m), 'danger')
  );
}
function openArea(a) {
  setMode('navigate');
  panel(a.name || a.id, {type:'area', id:a.id});
  body.append(el('div', `≈ ${(a.squareMeters * M2_TO_FT2).toFixed(1)} sq ft`, 'value'));
  note(`${a.squareMeters.toFixed(2)} m² · approximate scan area`);
  field('Name (optional)', a.name === a.id ? '' : a.name, v => {a.name = v || a.id; changed();}, {maxLength:80});
  actions(
    button('Redraw', () => {editGeometry = {type:'area', item:a}; setMode('area', true);}),
    button('Delete', () => removeItem('areas', a), 'danger')
  );
}
function openItem(type, item) {
  ({comment:openComment, measurement:openMeasurement, area:openArea})[type](item);
}

function refresh() {
  if (!viewer || !data) return;
  const items = [];
  function add(type, item, text) {
    if (type === 'comment' && item.resolved) return;
    const node = button(text, () => {if (mode === 'navigate') openItem(type, item);}, `model-label ${type}${selected?.id === item.id ? ' selected' : ''}`);
    if (type === 'measurement') {
      node.replaceChildren(el('span', item.name || item.id, 'label-name'));
      const line = el('span', undefined, 'label-line');
      line.append(el('span', formatLength(lengthOf(item))), el('span', item.status, `badge ${item.status === 'VERIFIED' ? 'verified' : ''}`));
      node.append(line);
    }
    if (type === 'area') {
      node.replaceChildren(el('span', item.name || item.id, 'label-name'), el('span', `≈ ${(item.squareMeters*M2_TO_FT2).toFixed(1)} sq ft`, 'label-line'));
    }
    items.push({...item, type, node});
  }
  if (visible.comments) data.comments.forEach(c => add('comment', c, c.id));
  if (visible.measurements) data.measurements.forEach(m => add('measurement', m, m.id));
  if (visible.areas) data.areas.forEach(a => add('area', a, a.id));
  viewer.renderItems(items);
  viewer.showDraft(points, mode === 'area');
  $('#area-total').textContent = `Areas: ≈ ${(data.areas.reduce((sum,a)=>sum+a.squareMeters,0)*M2_TO_FT2).toLocaleString(undefined,{maximumFractionDigits:1})} sq ft`;
  $$('[data-visibility]').forEach(b => b.setAttribute('aria-pressed', String(visible[b.dataset.visibility])));
}
function setMode(next, keepEdit=false) {
  const oldEdit = keepEdit ? editGeometry : null;
  mode = next; points = []; anchors = []; editGeometry = oldEdit; lastAreaTap = null;
  $('#panel').hidden = true; selected = null;
  $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  $('#drawing-actions').hidden = mode === 'navigate';
  $('#finish-area').hidden = mode !== 'area';
  $('#undo-point').hidden = mode === 'comment' || (!!editGeometry && mode !== 'area');
  $('#prompt').classList.toggle('drawing', mode !== 'navigate');
  viewer?.setMode(mode);
  if (mode === 'area') viewer?.fit('top');
  updateInstruction(); refresh();
}
function updateInstruction() {
  $('#instruction').textContent = mode === 'navigate'
    ? 'Drag to orbit · Scroll / pinch to zoom · Right-drag / two fingers to pan'
    : mode === 'comment'
      ? (editGeometry ? 'Tap the new note position' : 'Tap anywhere on the model to place a note')
      : mode === 'measure'
        ? (editGeometry ? `Tap the new Point ${editGeometry.endpoint?.toUpperCase() || ''}` : (points.length ? 'Tap Point B' : 'Tap Point A'))
        : `Tap area corners · ${points.length} placed · Done to save`;
  $('#finish-area').disabled = points.length < 3;
  $('#undo-point').disabled = points.length === 0;
}
function checkFootprint(outline) {
  if (outline.some(p => Math.abs(p[1] - viewer.ceilingY) > .01)) throw new Error('Use one horizontal ceiling plane.');
  for (let i=0;i<outline.length;i++) {
    const a=outline[i], b=outline[(i+1)%outline.length], samples=Math.ceil(distance(a,b)/.1);
    for (let j=0;j<=samples;j++) if (!viewer.onFloor(a.map((v,k)=>v+(b[k]-v)*j/samples))) throw new Error('An edge leaves the basement footprint.');
  }
}
function handleTap(hit, screen) {
  if (mode === 'navigate') {closePanel(); return;}
  if (!hit) return toast(mode === 'area' ? 'Tap inside the basement footprint.' : 'Tap a model surface.');
  const p = hit.position;
  if (mode === 'comment') {
    let c;
    if (editGeometry) {c = editGeometry.item; c.position = p; c.anchor = hit.object;}
    else {c = {id:nextId(data,'comment'), position:p, anchor:hit.object, text:'', resolved:false}; data.comments.push(c);}
    visible.comments = true; changed(); openComment(c); return;
  }
  if (mode === 'measure') {
    if (editGeometry) {
      const m=editGeometry.item, other=editGeometry.endpoint==='a'?m.b:m.a;
      if (distance(p,other)<.001) return toast('Pick two different points.');
      m[editGeometry.endpoint]=p; m.status='SCAN'; delete m.verifiedMeters; delete m.verifiedAt; m.position=m.a.map((v,i)=>(v+m.b[i])/2);
      changed(); openMeasurement(m); return;
    }
    if (points.length && distance(points[0],p)<.001) return toast('Pick a different Point B.');
    points.push(p); anchors.push(hit.object);
    if (points.length===2) {
      const id=nextId(data,'measurement');
      const m={id,name:id,a:points[0],b:points[1],position:polygonCenter(points),anchors:{a:anchors[0],b:anchors[1]},status:'SCAN'};
      data.measurements.push(m); visible.measurements=true; changed(); openMeasurement(m); return;
    }
  }
  if (mode === 'area') {
    if (points.length>=3 && Math.hypot(screen.x-viewer.project(points[0]).x,screen.y-viewer.project(points[0]).y)<16) {finishArea();return;}
    if (lastAreaTap && Date.now()-lastAreaTap.time<350 && Math.hypot(screen.x-lastAreaTap.x,screen.y-lastAreaTap.y)<16) return;
    if (points.length && distance(points.at(-1),p)<.01) return toast('Tap a different corner.');
    points.push(p); lastAreaTap={...screen,time:Date.now()};
  }
  updateInstruction(); viewer.showDraft(points, mode==='area');
}
function finishArea() {
  try {
    const others=data.areas.filter(a=>a.id!==editGeometry?.item.id), area=validatePolygon(points,others);
    checkFootprint(points);
    let item;
    if (editGeometry) {
      item=editGeometry.item;
      Object.assign(item,{points:clone(points),squareMeters:area,position:polygonCenter(points)});
    } else {
      const id=nextId(data,'area');
      item={id,name:id,points:clone(points),squareMeters:area,position:polygonCenter(points),source:'SCAN',projection:'horizontal'};
      data.areas.push(item);
    }
    visible.areas=true; changed(); openArea(item);
  } catch(e) {toast(e.message);}
}

try {
  const response = await fetch('./execution.json?v=2');
  if (!response.ok) throw new Error('Basement data unavailable');
  data = validateData(await response.json());
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) data = validateData(JSON.parse(raw));
  } catch {}
  const {createViewer} = await import('./viewer.mjs');
  viewer = await createViewer($('#view'), handleTap);

  $('#top').onclick = () => viewer.fit('top');
  $('#three').onclick = () => viewer.fit('three');
  $('#reset').onclick = () => {setMode('navigate'); viewer.fit('three');};
  $('#project').onclick = () => {$('#project-panel').hidden = false;};
  $('#close-project').onclick = () => {$('#project-panel').hidden = true;};
  $('#close-panel').onclick = closePanel;
  $('#undo-point').onclick = () => {points.pop(); anchors.pop(); updateInstruction(); viewer.showDraft(points, mode==='area');};
  $('#finish-area').onclick = finishArea;
  $('#cancel-drawing').onclick = () => setMode('navigate');

  $$('[data-mode]').forEach(b => {b.disabled=false; b.onclick=()=>setMode(b.dataset.mode);});
  $$('[data-visibility]').forEach(b => {b.disabled=false; b.onclick=()=>{visible[b.dataset.visibility]=!visible[b.dataset.visibility]; refresh();};});
  for (const id of ['top','three','reset']) $('#'+id).disabled=false;

  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {if (e.key==='Escape') document.activeElement.blur(); return;}
    if (e.key==='Escape') {setMode('navigate'); closePanel(); $('#project-panel').hidden=true;}
    if (e.key==='Enter' && mode==='area') {e.preventDefault(); finishArea();}
  });

  status.hidden = true;
  setMode('navigate');
} catch(error) {
  console.error(error);
  status.hidden = false;
  status.textContent = 'Could not open the basement. Reload to try again.';
}
