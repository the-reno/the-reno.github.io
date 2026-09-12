const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').join(__dirname,'../docs/garage/');
const html=fs.readFileSync(root+'index.html','utf8');
class Element{
 constructor(tag='div',attrs={}){this.tagName=tag;this.attrs={...attrs};this.id=attrs.id;this.value=attrs.value||'';this.dataset={};for(const[k,v]of Object.entries(attrs))if(k.startsWith('data-'))this.dataset[k.slice(5)]=v;this.checked='checked'in attrs;this.disabled=false;this.hidden='hidden'in attrs;this.open='open'in attrs;this.children=[];this.events={};this.clientWidth=880;this.clientHeight=570;this.width=880;this.height=570;this.classList={toggle(){},add(){},remove(){}};}
 setAttribute(k,v){this.attrs[k]=String(v)}removeAttribute(k){delete this.attrs[k]}getAttribute(k){return this.attrs[k]}addEventListener(k,fn){(this.events[k]??=[]).push(fn)}appendChild(n){this.children.push(n);return n}replaceChildren(...nodes){this.children=nodes;for(const n of nodes)if(!elements.includes(n))elements.push(n)}focus(){}setPointerCapture(){}remove(){}showModal(){this.open=true}close(){this.open=false}scrollIntoView(){}querySelector(){return new Element('strong')}cloneNode(){const el=new Element(this.tagName,this.attrs);el.children=[...this.children];return el}dispatch(type,extra={}){for(const fn of this.events[type]||[])fn({preventDefault(){},target:this,...extra})}
}
const elements=[];
for(const m of html.matchAll(/<([a-z][\w-]*)\b([^>]*?)>/gi)){const attrs={};for(const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]??'';elements.push(new Element(m[1],attrs))}
const byId=Object.fromEntries(elements.filter(el=>el.id).map(el=>[el.id,el]));byId['input-door-basis'].value='leaf';
const select=selector=>{if(selector==='.page')return elements.filter(el=>(el.attrs.class||'').split(' ').includes('page'));if(selector==='.phases details')return elements.filter(el=>el.tagName==='details');const match=selector.match(/^\[([\w-]+)\]$/);if(match){const key=match[1];return elements.filter(el=>key in el.attrs||(key.startsWith('data-')&&key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()) in el.dataset))}return[]};
let draws=0;
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:()=>({}),createProgram:()=>({}),createShader:()=>({}),createBuffer:()=>({}),drawArrays:()=>{draws++}},{get(o,k){return k in o?o[k]:k.toUpperCase()===k?1:()=>{}}});
const softwareTest=process.env.GARAGE_NO_WEBGL==='1';
byId.scene.getContext=()=>softwareTest?null:gl;
const body=new Element('body');const docEvents={};
const document={getElementById:id=>byId[id],querySelectorAll:select,querySelector:selector=>elements.find(el=>(el.attrs.class||'').split(' ').includes(selector.slice(1))),createElementNS:(ns,tag)=>new Element(tag),createElement:tag=>new Element(tag),body,hidden:false,addEventListener:(k,fn)=>docEvents[k]=fn};
const winEvents={};let rafId=0;const raf=new Map();
const context={document,console,location:{hash:''},history:{pushState(){}},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>{raf.set(++rafId,fn);return rafId},cancelAnimationFrame:id=>raf.delete(id),ResizeObserver:class{observe(){}},window:{devicePixelRatio:1,addEventListener:(k,fn)=>winEvents[k]=fn,scrollTo(){},print(){winEvents.beforeprint();winEvents.afterprint()}},Blob,URL,Math,Map,Float32Array};
context.globalThis=context;
let source=fs.readFileSync(root+'workspace.js','utf8');source=source.replace(/\}\)\(\);\s*$/, 'globalThis.testAPI={metrics,validate,projection,project,state,camera,render,rebuild,isVisible,objects:()=>objects,drawPlan,applyDimensions,BASE,beforePrint,afterPrint,photoShots,setPhotoShot,startPhotoSurvey,closePhotoSurvey,drawPhotoMarker};})();');
vm.runInNewContext(source,context);const a=context.testAPI;
assert.equal(a.validate({...a.BASE}),'');assert(Math.abs(a.metrics().bay-2.54)<1e-9);assert(Math.abs(a.metrics().side-.438)<1e-9);assert(Math.abs(a.metrics().W-6.096)<1e-9);
assert(a.validate({...a.BASE,width:15}));assert(a.validate({...a.BASE,height:220}));assert(a.validate({...a.BASE,width:NaN}));assert.equal(a.metrics({...a.BASE,doorBasis:'opening'}).bay,1.27);
function click(selector,value){const b=select(selector).find(el=>Object.values(el.dataset).includes(value));assert(b);b.dispatch('click')}
for(const mode of ['existing','proposed']){click('[data-mode]',mode);for(const view of ['orbit','front','inside','plan']){click('[data-view]',view);a.render();for(const aspect of[.75,1,1.7,2.5]){const p=a.projection(aspect);assert(p.vp.every(Number.isFinite));if(view==='inside'){const g=a.metrics();assert(p.eye[2]>-g.D/2&&p.eye[2]<g.D/2);assert(p.eye[1]>0&&p.eye[1]<g.H)}}if(view==='plan'){assert(a.objects().filter(o=>o.group==='header').length>0);assert(a.objects().filter(o=>o.group==='header').every(o=>!a.isVisible(o,[0,30,0])))}}}
for(const finish of['charcoal','timber','light']){click('[data-finish]',finish);assert.equal(a.state.finish,finish)}
const before=a.objects().filter(o=>o.group==='doors')[0].m;byId['open-doors'].checked=true;byId['open-doors'].dispatch('change');assert.notEqual(a.objects().filter(o=>o.group==='doors')[0].m[0],before[0]);
for(const page of['design','measure','build','model']){click('[data-page]',page);assert.equal(a.state.page,page);assert.equal(byId['page-'+page].hidden,false)}
byId['input-width'].value='22';byId['measurement-form'].dispatch('submit');assert.equal(a.metrics().W,22*.3048);
byId['input-width'].value='15';byId['measurement-form'].dispatch('submit');assert(byId['measurement-error'].textContent);assert.equal(a.metrics().W,22*.3048);
byId['reset-measurements'].dispatch('click');assert.equal(a.metrics().W,20*.3048);
byId['input-width'].value='22';a.beforePrint();assert.equal(Number(byId['input-width'].value),20);a.afterPrint();assert.equal(byId['input-width'].value,'22');
a.applyDimensions({...a.BASE,width:40,depth:40,doorWidth:296});
const texts=byId['survey-plan'].children.filter(el=>el.tagName==='text');const label=texts.find(el=>el.textContent==='Paired doors · outward');assert(Number(label.attrs.y)<=606);assert(texts.find(el=>el.textContent.startsWith('Bay ')).attrs.y>=630);
a.applyDimensions({...a.BASE});click('[data-view]','orbit');
byId.scene.dispatch('pointerdown',{pointerId:1,clientX:100,clientY:100});byId.scene.dispatch('pointerdown',{pointerId:2,clientX:200,clientY:100});const yaw=a.camera.yaw;byId.scene.dispatch('pointermove',{pointerId:2,clientX:220,clientY:100});assert.equal(a.camera.yaw,yaw);assert(a.camera.zoom>1);byId.scene.dispatch('pointerup',{pointerId:1});byId.scene.dispatch('pointerup',{pointerId:2});
assert.equal(a.photoShots().length,9);a.startPhotoSurvey();assert.equal(a.state.mode,'existing');assert.equal(a.state.photo,true);for(let i=0;i<9;i++){a.setPhotoShot(i);assert.equal(a.state.photoIndex,i);const shot=a.photoShots()[i];assert(/^P0[1-9]$/.test(shot.id));assert(/1×|0\.5×/.test(shot.camera));const p=a.projection(1.55),marker=a.project(shot.position,p.vp,880,570),aim=a.project(shot.target,p.vp,880,570);assert(marker&&aim);assert(marker[0]>-80&&marker[0]<960&&marker[1]>-80&&marker[1]<650,'marker out of useful frame '+shot.id);assert(aim[0]>-80&&aim[0]<960&&aim[1]>-80&&aim[1]<650,'aim out of useful frame '+shot.id);a.render()}a.closePhotoSurvey();assert.equal(a.state.photo,false);assert.equal(a.state.mode,'proposed');

// Extended roof/window/front-layout checks. These do not certify structure.
const geom=a.metrics();
assert(geom.ridge>geom.H);
assert.equal(geom.windowW,.762);
assert.equal(geom.windowH,.9144);
assert(geom.entryLeft>geom.P/2+geom.bay/2,'entry should be toward the right');
assert(Math.abs(geom.P/2+geom.bay-geom.entryRight-.18)<1e-9);
click('[data-view]','orbit');a.state.cutaway=false;a.state.roof=true;a.rebuild();
assert(a.objects().every(o=>o.m.every(Number.isFinite)),'finite model transforms');
const roofs=a.objects().filter(o=>o.group==='roof');
assert(roofs.length>=3);assert(roofs.every(o=>a.isVisible(o,[8,6,10])));
byId['roof-cover'].checked=false;byId['roof-cover'].dispatch('change');
assert(roofs.every(o=>!a.isVisible(o,[8,6,10])));
byId['roof-cover'].checked=true;byId['roof-cover'].dispatch('change');
a.state.cutaway=true;assert(roofs.every(o=>!a.isVisible(o,[8,6,10])));
click('[data-view]','inside');assert(roofs.every(o=>!a.isVisible(o,[0,1.6,0])));
assert(/id="front-budget"/.test(html));assert(html.includes('$1,808–3,559'));
assert(!html.includes('Start with 9 images.'));
if(softwareTest){a.state.page='model';a.render();assert(byId['software-scene'].children.length>0,'software geometry rendered');assert(byId['download-view'].disabled);assert(byId['renderer-status'].textContent.includes('Software 3D'));}else assert(draws>0);
assert(!byId.fallback.hidden===false);
console.log('PASS: initialization, both layouts, 4 camera views, projection matrices, true interior camera, plan header visibility, finishes, opening doors, navigation, valid/invalid dimensions, print draft safety, large plan label spacing, two-finger gestures, nine photo positions, roof/window/front-layout geometry and budget presence. Draw calls:',draws);
