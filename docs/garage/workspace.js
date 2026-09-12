/* Garage study. Metric geometry; supplied dimensions are not a verified survey.
 * No third-party requests, trackers, browser storage, or background rendering.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const FT = 0.3048;
  const BASE = {width:20, depth:21.5, doorWidth:127, doorHeight:226, post:14, height:260, doorBasis:'leaf'};
  let dimensions = {...BASE};
  const state = {page:'model', mode:'proposed', view:'orbit', finish:'charcoal', cutaway:false, roof:true, framing:true, dims:true, open:false, photo:false, photoIndex:0};
  const camera = {yaw:-0.64, pitch:0.40, zoom:1, panX:0, panY:0};
  const format = (n, dp=2) => Number(n.toFixed(dp)).toString();
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const title = s => s.charAt(0).toUpperCase()+s.slice(1);
  let requestRender = () => {};
  let toastTimer;
  function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').hidden=true,3400); }

  function metrics(d=dimensions) {
    const W=d.width*FT, D=d.depth*FT, H=d.height/100, P=d.post/100, leaf=d.doorWidth/100/(d.doorBasis==='opening'?2:1), bay=2*leaf, DH=d.doorHeight/100;
    const entryW=Math.min(.9144,bay*.7),entryH=Math.min(2.032,DH-.06),entryReturn=Math.min(.18,bay*.12),entryRight=P/2+bay-entryReturn;
    // Unmeasured roof rise, front roof depth, window sizes and structural sizes
    // are planning placeholders, not a framing design or an ordering schedule.
    return {W,D,H,P,leaf,bay,DH,T:.14,side:(W-P-2*bay)/2,entryW,entryH,entryReturn,entryRight,entryLeft:entryRight-entryW,windowW:.762,windowH:.9144,windowSill:.95,ridge:H+W*.34,frontSetback:.85};
  }
  function photoShots(){
    const g=metrics(),F=g.D/2+g.T/2,eye=1.52;
    return [
      {id:'P01',title:'Front / straight',position:[0,eye,F+8],target:[0,g.H*.52,F],stand:'Centered in front, about 26 ft (8 m) from the doors.',aim:'Straight at the center of the façade (0°).',camera:'1× · landscape · phone level at 5 ft.',capture:'Include the entire front, roof edges and about 2 ft of margin.',inside:false,yaw:-.62},
      {id:'P02',title:'Front-left / 45°',position:[-g.W/2-5,eye,F+5],target:[0,g.H*.5,F],stand:'About 23 ft (7 m) diagonally from the front-left corner.',aim:'Toward the center of the front at approximately 45°.',camera:'1× · landscape · phone level at 5 ft.',capture:'Include the front, left wall and complete roof outline.',inside:false,yaw:.62},
      {id:'P03',title:'Front-right / 45°',position:[g.W/2+5,eye,F+5],target:[0,g.H*.5,F],stand:'About 23 ft (7 m) diagonally from the front-right corner.',aim:'Toward the center of the front at approximately 45°.',camera:'1× · landscape · phone level at 5 ft.',capture:'Include the front, right wall and complete roof outline.',inside:false,yaw:-.62},
      {id:'P04',title:'Inside / entrance to rear',position:[0,eye,g.D/2-.45],target:[0,1.35,-g.D/2],stand:'Centered just inside the garage entrance.',aim:'Straight toward the center of the rear wall.',camera:'1× · landscape · phone level at 5 ft.',capture:'Include both side walls, floor edges and overhead framing. Use 0.5× only if 1× cannot fit the space.',inside:true,yaw:-.72},
      {id:'P05',title:'Inside / rear to front',position:[0,eye,-g.D/2+.45],target:[0,1.35,g.D/2],stand:'Centered near the rear wall.',aim:'Straight toward the doors and center post.',camera:'1× · landscape · phone level at 5 ft.',capture:'Include both openings, the center post and the floor-to-wall connections.',inside:true,yaw:2.55},
      {id:'P06',title:'Inside / left wall',position:[g.W/2-.4,eye,0],target:[-g.W/2,1.35,0],stand:'Near the center of the right wall.',aim:'Perpendicular to the center of the left wall (90°).',camera:'1× · landscape · phone level at 5 ft.',capture:'Include the complete left wall from floor to overhead structure.',inside:true,yaw:.78},
      {id:'P07',title:'Inside / right wall',position:[-g.W/2+.4,eye,0],target:[g.W/2,1.35,0],stand:'Near the center of the left wall.',aim:'Perpendicular to the center of the right wall (90°).',camera:'1× · landscape · phone level at 5 ft.',capture:'Include the complete right wall from floor to overhead structure.',inside:true,yaw:-.78},
      {id:'P08',title:'Ceiling / overhead',position:[0,1.45,0],target:[0,g.ridge,0],stand:'At the approximate center of the garage.',aim:'Straight upward at the center of the overhead structure.',camera:'0.5× · landscape; long side front-to-back.',capture:'The framing photograph is sufficient for the planning model.',inside:true,yaw:-.72,framing:true},
      {id:'P09',title:'Floor / overall',position:[0,eye,g.D/2-.45],target:[0,0,-g.D*.2],stand:'Centered just inside the entrance.',aim:'Down toward the middle of the floor at about 30°.',camera:'1× · landscape; avoid digital zoom.',capture:'Include the threshold, both floor edges and the rear floor line.',inside:true,yaw:-.72}
    ];
  }
  function validate(d) {
    const ranges={width:[15,40],depth:[10,50],doorWidth:[60,350],doorHeight:[180,350],post:[8,60],height:[200,450]};
    for (const [k,[min,max]] of Object.entries(ranges)) if(!Number.isFinite(d[k])||d[k]<min||d[k]>max)return 'Enter valid dimensions within the limits shown in each field.';
    if(!['leaf','opening'].includes(d.doorBasis))return 'Choose how the door width should be interpreted.';
    const g=metrics(d);
    if(g.side<.08)return 'The two bays and center post do not fit within this width. Check the door-width interpretation or overall width.';
    if(g.H<g.DH+.16)return 'Wall height must leave at least 16 cm above the door in this simplified model. Confirm the actual header and wall height.';
    return '';
  }
  function activatePage(page,updateHash=true) {
    if(!['model','design','measure','build'].includes(page))page='model';
    state.page=page;
    all('.page').forEach(el=>{el.hidden=el.id!=='page-'+page;el.classList.toggle('active',!el.hidden)});
    all('[data-page]').forEach(el=>{const active=el.dataset.page===page;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
    if(updateHash&&location.hash!=='#'+page)history.pushState(null,'','#'+page);
    if(page==='model')requestRender();
  }
  all('[data-page]').forEach(b=>b.addEventListener('click',()=>activatePage(b.dataset.page)));
  all('[data-go]').forEach(b=>b.addEventListener('click',()=>{activatePage(b.dataset.go);window.scrollTo({top:0,behavior:'auto'})}));
  window.addEventListener('popstate',()=>activatePage(location.hash.slice(1),false));

  function setMode(mode) {
    state.mode=mode;
    all('[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
    rebuild();updateLabels();drawPlan();requestRender();
  }
  function setView(view) {
    state.view=view;camera.zoom=1;camera.panX=0;camera.panY=0;
    camera.yaw=view==='orbit'?-.64:0;camera.pitch=view==='orbit'?.40:0;
    all('[data-view]').forEach(b=>{const active=b.dataset.view===view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
    syncDisplayControls();
    updateLabels();requestRender();
  }
  function updateLabels(){
    const labels={orbit:state.cutaway?'3D cutaway':'3D exterior',front:'Front elevation',inside:'Interior view',plan:'Orthographic floor plan'};
    $('view-name').textContent=state.photo?'Photo survey · '+photoShots()[state.photoIndex].id:labels[state.view]+' · '+state.mode+' layout';
    $('drawing-view').textContent=state.photo?'PHOTO':{orbit:'3D',front:'FRONT',inside:'INSIDE',plan:'PLAN'}[state.view];
    $('footprint').innerHTML=format(dimensions.width)+' × '+format(dimensions.depth)+' <span>ft</span>';
    $('floor-area').textContent=format(dimensions.width*dimensions.depth)+' sq ft · '+format(dimensions.width*dimensions.depth*FT*FT)+' m²';
    $('model-warning').textContent=state.view==='plan'?'Planning only · centered post/windows · inward entry at far right':'Planning only · roof, framing sizes & 30 × 36 in windows assumed';
  }
  let photoRestore=null;
  function syncDisplayControls(){
    for(const [id,key] of [['cutaway','cutaway'],['roof-cover','roof'],['framing','framing'],['show-dimensions','dims'],['open-doors','open']]){if(!$(id))continue;$(id).checked=state[key];$(id).disabled=state.photo||(key==='cutaway'&&state.view!=='orbit')||(key==='roof'&&(state.view==='inside'||state.view==='plan'||state.cutaway&&state.view==='orbit'))||(key==='framing'&&state.view==='plan')}
    all('[data-mode]').forEach(b=>{const active=b.dataset.mode===state.mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));b.disabled=state.photo});
    all('[data-view]').forEach(b=>{const active=b.dataset.view===state.view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));b.disabled=state.photo});
  }
  function renderPhotoStrip(){
    $('photo-strip').replaceChildren(...photoShots().map((shot,index)=>{const button=document.createElement('button');button.type='button';button.textContent=shot.id;button.dataset.photoIndex=index;button.setAttribute('role','tab');button.setAttribute('aria-label',shot.id+' '+shot.title);button.addEventListener('click',()=>setPhotoShot(index));return button}));
  }
  function setPhotoShot(index){
    const shots=photoShots();state.photoIndex=clamp(index,0,shots.length-1);const shot=shots[state.photoIndex];
    state.photo=true;state.mode='existing';state.view='orbit';state.cutaway=shot.inside;state.roof=!shot.inside;state.framing=true;state.dims=false;state.open=false;
    camera.yaw=shot.yaw;camera.pitch=shot.inside?.78:.62;camera.zoom=1;camera.panX=0;camera.panY=0;
    rebuild();syncDisplayControls();updateLabels();drawPlan();
    document.querySelector('.viewer-column').classList.add('photo-survey-active');$('photo-survey').hidden=false;$('photo-map-label').hidden=false;$('photo-map-label').querySelector('strong').textContent=shot.id;
    const received=['P01','P02','P03','P04','P05','P08'].includes(shot.id);
    $('photo-title').textContent=shot.id+' · '+shot.title;$('photo-progress').textContent=received?'Received':'Deferred';$('photo-position').textContent=shot.stand;$('photo-aim').textContent=shot.aim;$('photo-camera').textContent=shot.camera;$('photo-capture').textContent=(received?'Reference received. No retake needed. ':'Deferred by agreement; no new photo needed now. ')+shot.capture;
    all('[data-photo-index]').forEach(b=>{const active=Number(b.dataset.photoIndex)===state.photoIndex;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));if(active&&b.scrollIntoView)b.scrollIntoView({block:'nearest',inline:'center'})});
    $('photo-prev').disabled=state.photoIndex===0;$('photo-next').textContent=state.photoIndex===shots.length-1?'Close reference map':'Next reference →';requestRender();
  }
  function startPhotoSurvey(){
    if(!state.photo)photoRestore={mode:state.mode,view:state.view,cutaway:state.cutaway,roof:state.roof,framing:state.framing,dims:state.dims,open:state.open};
    setPhotoShot(0);$('photo-survey').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function closePhotoSurvey(){
    if(!state.photo)return;state.photo=false;document.querySelector('.viewer-column').classList.remove('photo-survey-active');$('photo-survey').hidden=true;$('photo-map-label').hidden=true;
    if(photoRestore)Object.assign(state,photoRestore);photoRestore=null;syncDisplayControls();rebuild();setView(state.view);drawPlan();requestRender();
  }
  $('photo-start').addEventListener('click',startPhotoSurvey);$('photo-prev').addEventListener('click',()=>setPhotoShot(state.photoIndex-1));$('photo-next').addEventListener('click',()=>state.photoIndex===photoShots().length-1?closePhotoSurvey():setPhotoShot(state.photoIndex+1));$('photo-close').addEventListener('click',closePhotoSurvey);renderPhotoStrip();
  all('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  all('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  for(const [id,key] of [['cutaway','cutaway'],['roof-cover','roof'],['framing','framing'],['show-dimensions','dims'],['open-doors','open']])if($(id))$(id).addEventListener('change',()=>{state[key]=$(id).checked;if(key==='open')rebuild();syncDisplayControls();updateLabels();requestRender()});
  all('[data-finish]').forEach(b=>b.addEventListener('click',()=>{state.finish=b.dataset.finish;all('[data-finish]').forEach(el=>{const active=el===b;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active))});$('finish-status').textContent=title(state.finish)+' selected · applies to the proposed model';$('brief-finish').textContent=title(state.finish)+' · working choice';setMode('proposed');toast('Door finish updated. Open Space & views to inspect it.')}));

  const formMap={width:'input-width',depth:'input-depth',doorWidth:'input-door-width',doorHeight:'input-door-height',post:'input-post',height:'input-height',doorBasis:'input-door-basis'};
  function readForm(){const d={};for(const [key,id] of Object.entries(formMap))d[key]=key==='doorBasis'?$(id).value:Number($(id).value);return d}
  function writeForm(){for(const [key,id] of Object.entries(formMap))$(id).value=dimensions[key]}
  function applyDimensions(d){dimensions={...d};rebuild();drawPlan();updateLabels();setView(state.view);$('measurement-error').textContent='';$('measurement-status').textContent='Applied to this session. Door width treated as '+(d.doorBasis==='leaf'?'one leaf.':'a full opening.')+' Print the brief before leaving to keep a record.';}
  $('measurement-form').addEventListener('submit',e=>{e.preventDefault();const d=readForm(),error=validate(d);if(error){$('measurement-error').textContent=error;return}applyDimensions(d);toast('Measurements applied to the 3D model and plan.')});
  $('reset-measurements').addEventListener('click',()=>{applyDimensions(BASE);writeForm();toast('Original baseline restored.')});

  // Accurate 2D geometry is available even if WebGL cannot start.
  const svgNS='http://www.w3.org/2000/svg';
  function node(tag,attrs={},text){const el=document.createElementNS(svgNS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el}
  function drawPlan(){
    const svg=$('survey-plan');svg.replaceChildren();
    const g=metrics(),scale=Math.min(430/g.W,515/(g.D+g.leaf)),x=320-g.W*scale/2,y=65,w=g.W*scale,h=g.D*scale,front=y+h;
    const X=a=>320+a*scale;
    const line=(x1,y1,x2,y2,color='#697975',width=1,dash='')=>svg.appendChild(node('line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,'stroke-dasharray':dash}));
    const label=(xx,yy,t,size=15,color='#35433e')=>svg.appendChild(node('text',{x:xx,y:yy,'text-anchor':'middle','font-family':'system-ui,sans-serif','font-size':size,fill:color},t));
    svg.appendChild(node('rect',{x,y,width:w,height:h,fill:'#f2f4f0'}));
    for(let z=1;z<g.D;z++)line(x,y+z*scale,x+w,y+z*scale,'#e2e7df');
    for(let v=-g.W/2+1;v<g.W/2;v++)line(X(v),y,X(v),front,'#e2e7df');
    const win=g.windowW*scale;
    line(x,y,320-win/2,y,'#53605c',9);line(320+win/2,y,x+w,y,'#53605c',9);line(x,y,x,front,'#53605c',9);
    line(x+w,y,x+w,y+h/2-win/2,'#53605c',9);line(x+w,y+h/2+win/2,x+w,front,'#53605c',9);
    for(const offset of[-2,2]){line(320-win/2,y+offset,320+win/2,y+offset,'#7caaa9',1.5);line(x+w+offset,y+h/2-win/2,x+w+offset,y+h/2+win/2,'#7caaa9',1.5)}
    const l0=-g.P/2-g.bay,l1=-g.P/2,r0=g.P/2,r1=g.P/2+g.bay;
    line(x,front,X(l0),front,'#53605c',9);line(X(-g.P/2),front,X(g.P/2),front,'#9b764a',9);line(X(r1),front,x+w,front,'#53605c',9);
    function leaf(hinge,dir,width,inward=false){const hx=X(hinge),len=width*scale,sign=inward?-1:1;line(hx,front,hx,front+sign*len,'#a36f3e',2);svg.appendChild(node('path',{d:'M '+(hx+dir*len)+' '+front+' A '+len+' '+len+' 0 0 '+(dir*sign>0?1:0)+' '+hx+' '+(front+sign*len),fill:'none',stroke:'#bb9c77','stroke-width':1.2,'stroke-dasharray':'4 3'}))}
    leaf(l0,1,g.leaf);leaf(l1,-1,g.leaf);
    if(state.mode==='existing'){leaf(r0,1,g.leaf);leaf(r1,-1,g.leaf)}else{const e0=g.entryLeft,e1=g.entryRight;line(X(r0),front,X(e0),front,'#53605c',9);line(X(e1),front,X(r1),front,'#53605c',9);leaf(e1,-1,g.entryW,true)}
    // The photographed interior post/beam line is offset behind the doors;
    // this marker locates the centered post, with setback still unmeasured.
    svg.appendChild(node('rect',{x:X(-g.P/2),y:front-g.frontSetback*scale-g.P*scale/2,width:g.P*scale,height:g.P*scale,fill:'#9b764a'}));
    line(x,y-26,x+w,y-26);for(const xx of[x,x+w])line(xx,y-33,xx,y-19);label(320,y-38,format(dimensions.width)+' ft / '+format(g.W)+' m');
    line(x-30,y,x-30,front);line(x-36,y,x-24,y);line(x-36,front,x-24,front);svg.appendChild(node('text',{x:x-42,y:y+h/2,transform:'rotate(-90 '+(x-42)+' '+(y+h/2)+')','text-anchor':'middle','font-family':'system-ui,sans-serif','font-size':15,fill:'#35433e'},format(dimensions.depth)+' ft / '+format(g.D)+' m'));
    label(320,y+h*.45,format(dimensions.width*dimensions.depth)+' sq ft',25);label(320,y+h*.45+26,state.mode==='proposed'?'PROPOSED LAYOUT':'EXISTING LAYOUT',12,'#74837c');
    label(X((l0+l1)/2),front+g.leaf*scale+25,'Paired doors · outward',13);label(X((r0+r1)/2),front+g.leaf*scale+25,state.mode==='proposed'?'Right entry · inward':'Paired doors · outward',13);
    label(320,630,'Bay '+format(g.bay*100)+' cm · post '+format(dimensions.post)+' cm · windows 30 × 36 in (assumed)',12);
    label(320,653,'Planning only · dimensions, setbacks & framing require field verification',12,'#8b633e');
  }
  // Printing never silently applies an unsubmitted measurement draft.
  let printedDetails=[],printedForm=null;
  function beforePrint(){printedDetails=all('.phases details').map(el=>[el,el.open]);printedDetails.forEach(([el])=>el.open=true);printedForm=Object.values(formMap).map(id=>[id,$(id).value]);writeForm()}
  function afterPrint(){printedDetails.forEach(([el,open])=>el.open=open);printedDetails=[];if(printedForm)printedForm.forEach(([id,value])=>$(id).value=value);printedForm=null;document.body.classList.remove('print-execution')}
  window.addEventListener('beforeprint',beforePrint);window.addEventListener('afterprint',afterPrint);
  function printBrief(executionOnly=false){const draft=readForm();if(JSON.stringify(draft)!==JSON.stringify(dimensions)){toast('Apply or restore the measurement form before printing.');activatePage('measure');return}document.body.classList.toggle('print-execution',executionOnly);window.print()}
  $('print-project').addEventListener('click',()=>printBrief());$('print-execution').addEventListener('click',()=>printBrief(true));
  $('enlarge-image').addEventListener('click',()=>$('image-dialog').showModal());$('close-image').addEventListener('click',()=>$('image-dialog').close());$('image-dialog').addEventListener('click',e=>{if(e.target===$('image-dialog'))$('image-dialog').close()});

  // Minimal dependency-free box renderer. Geometry groups support real openings,
  // door pivots, wall cutaways, and plan/elevation projection, not a CAD schedule.
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d)};
  const mul=(a,b)=>{const o=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o};
  const lookAt=(e,t,u=[0,1,0])=>{const z=norm(sub(e,t)),x=norm(cross(u,z)),y=cross(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1]};
  const perspective=(fov,aspect,near,far)=>{const f=1/Math.tan(fov/2),nf=1/(near-far);return[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]};
  const ortho=(halfH,aspect,near=.05,far=120)=>[1/(halfH*aspect),0,0,0,0,1/halfH,0,0,0,0,-2/(far-near),0,0,0,-(far+near)/(far-near),1];
  function transform(x,y,z,w,h,d,angle=0){const c=Math.cos(angle),s=Math.sin(angle);return[c*w/2,0,-s*w/2,0,0,h/2,0,0,s*d/2,0,c*d/2,0,x,y,z,1]}
  function color(hex){const v=parseInt(hex.slice(1),16);return[(v>>16&255)/255,(v>>8&255)/255,(v&255)/255]}
  let objects=[];
  function box(x,y,z,w,h,d,hex,group='shell',material=0,angle=0){if(w<=0||h<=0||d<=0)return;objects.push({m:transform(x,y,z,w,h,d,angle),color:color(hex),group,material})}
  function orientedBox(center,axes,sizes,hex,group,material=0){
    if(sizes.some(v=>v<=0))return;
    const m=[];for(let i=0;i<3;i++)m.push(...axes[i].map(v=>v*sizes[i]/2),0);m.push(...center,1);objects.push({m,color:color(hex),group,material});
  }
  function beam(a,b,width,depth,hex,group='framing'){
    const y=norm(sub(b,a)),reference=Math.abs(y[2])>.9?[1,0,0]:[0,0,1],x=norm(cross(y,reference)),z=cross(x,y);
    orientedBox(a.map((v,i)=>(v+b[i])/2),[x,y,z],[width,Math.hypot(...sub(b,a)),depth],hex,group,1);
  }
  function rebuild(){
    objects=[];const g=metrics(),{W,D,H,P,DH,T,bay,leaf,side}=g,F=D/2+T/2,proposed=state.mode==='proposed';
    // This proposal changes the front only; side/rear timber stays existing.
    const wall='#687880',trim='#eeeee5',timber='#66503d',interior='#615044',door=proposed?{charcoal:'#344349',timber:'#aa8052',light:'#e7e6dc'}[state.finish]:'#eeece0';
    box(0,-.19,0,W+.9,.07,D+.9,'#c2c9bd','ground');box(0,-.085,0,W+2*T+.12,.17,D+2*T+.12,'#aaa99d','slab',2);
    // Window voids are centered by owner instruction. The 30 × 36 in opening
    // and 95 cm sill are representative, not measured or a product order size.
    for(const sideName of['left','right','back']){
      const length=sideName==='back'?W:D,hasWindow=sideName!=='left',ww=g.windowW,wh=g.windowH,sill=g.windowSill;
      const part=(u,y,w,h,offset=0,d=T,hex=wall,group=sideName)=>{
        if(sideName==='back')box(u,y,-D/2-T/2-offset,w,h,d,hex,group,1);
        else box((sideName==='right'?1:-1)*(W/2+T/2+offset),y,u,d,h,w,hex,group,1);
      };
      const pieces=hasWindow?[[-(length+ww)/4,H/2,(length-ww)/2,H],[(length+ww)/4,H/2,(length-ww)/2,H],[0,sill/2,ww,sill],[0,(sill+wh+H)/2,ww,H-sill-wh]]:[[0,H/2,length,H]];
      for(const p of pieces){part(...p);part(...p,-T/2-.008,.015,interior)}
      // Fine horizontal siding courses split around the actual window void.
      for(let y=.22;y<H;y+=.22){const gap=hasWindow&&y>sill&&y<sill+wh;for(const[u,w]of(gap?[[-(length+ww)/4,(length-ww)/2],[(length+ww)/4,(length-ww)/2]]:[[0,length]]))part(u,y,w,.009,T/2+.004,.01,'#52636d')}
      // Stud spacing is schematic only; no load capacity or fastening implied.
      const frameGroup=sideName+':framing';
      for(let u=-length/2+.07;u<length/2;u+=.61){
        if(hasWindow&&Math.abs(u)<ww/2+.05){part(u,sill/2,.045,sill-.05,-T/2-.045,.09,timber,frameGroup);part(u,(H+sill+wh)/2,.045,H-sill-wh-.05,-T/2-.045,.09,timber,frameGroup)}
        else part(u,H/2,.045,H,-T/2-.045,.09,timber,frameGroup);
      }
      for(const y of[.045,H-.045])part(0,y,length,.09,-T/2-.045,.09,timber,frameGroup);
      if(hasWindow){
        for(const off of[-T/2-.035,T/2+.035]){
          for(const u of[-ww/2,ww/2])part(u,sill+wh/2,.065,wh+.12,off,.04,trim);
          for(const y of[sill,sill+wh])part(0,y,ww+.12,.065,off,.04,trim);
          part(0,sill+wh/2,.028,wh,off,.025,trim);part(0,sill+wh/2,ww,.028,off,.025,trim);
        }
        part(0,sill+wh/2,ww-.055,wh-.055,0,.012,'#829d9b');
        for(const u of[-ww/2-.055,ww/2+.055])part(u,H/2,.055,H,-T/2-.045,.09,timber,frameGroup);
        for(const y of[sill-.06,sill+wh+.065])part(0,y,ww+.14,.09,-T/2-.045,.09,timber,frameGroup);
      }
    }
    // Front openings and side piers are derived from the same dimensional model.
    box(-W/2+side/2,H/2,F,side,H,T,wall,'front');box(W/2-side/2,H/2,F,side,H,T,wall,'front');box(0,H/2,F,P,H,T,trim,'front');box(0,DH+(H-DH)/2,F,W,H-DH,T,wall,'header');
    const left0=-P/2-bay,left1=-P/2,right0=P/2,right1=P/2+bay;
    function openingFrame(a,b,height){box(a-.032,height/2,F+.092,.065,height,.045,trim,'front');box(b+.032,height/2,F+.092,.065,height,.045,trim,'front');box((a+b)/2,height+.035,F+.092,b-a+.13,.07,.045,trim,'header')}
    function doorLeaf(hinge,dir,width,height,person=false){
      // Paired carriage leaves swing out; the far-right prehung entry swings in.
      const angle=state.open?(person?dir:-dir)*Math.PI*.46:0;
      const localBox=(x,y,z,w,h,d,hex,mat=0)=>{const xx=hinge+Math.cos(angle)*x+Math.sin(angle)*z,zz=F-Math.sin(angle)*x+Math.cos(angle)*z;box(xx,y,zz,w,h,d,hex,'doors',mat,angle)};
      const point=([x,y,z])=>[hinge+Math.cos(angle)*x+Math.sin(angle)*z,y,F-Math.sin(angle)*x+Math.cos(angle)*z];
      const center=dir*width/2,paint=person?'#ecece3':door;
      if(person){
        localBox(center,height/2,0,width,height,.045,paint);
        for(const y of[height*.27,height*.7])localBox(center,y,.027,width-.23,height*.32,.016,'#d5d9d1');
      }else{
        const glassW=width-.27,glassH=.68,glassBottom=height-.96,glassY=glassBottom+glassH/2;
        localBox(center,glassBottom/2,0,width,glassBottom,.055,paint,1);
        localBox(center,(height+glassBottom+glassH)/2,0,width,height-glassBottom-glassH,.055,paint,1);
        for(const dirX of[-1,1])localBox(center+dirX*(width+glassW)/4,glassY,0,(width-glassW)/2,glassH,.055,paint,1);
        localBox(center,glassY,0,glassW,glassH,.018,'#829c9c');
        // Six-pane glazing and X braces match the photographed carriage doors.
        for(const face of[-.036,.04]){
          for(const x of[-glassW/2,-glassW/6,glassW/6,glassW/2])localBox(center+x,glassY,face,.027,glassH+.04,.025,paint);
          for(const y of[glassBottom,glassY,glassBottom+glassH])localBox(center,y,face,glassW+.04,.032,.025,paint);
        }
        for(let a=.15;a<width;a+=.095)localBox(dir*a,glassBottom/2,.031,.005,glassBottom-.10,.005,proposed?'#727876':'#cdcfc3');
        for(const x of[.05,width-.05])localBox(dir*x,glassBottom/2,.05,.08,glassBottom,.035,paint,1);
        for(const y of[.06,glassBottom-.025])localBox(center,y,.05,width,.1,.035,paint,1);
        beam(point([dir*.10,.12,.064]),point([dir*(width-.10),glassBottom-.10,.064]),.082,.035,paint,'doors');
        beam(point([dir*(width-.10),.12,.068]),point([dir*.10,glassBottom-.10,.068]),.082,.035,paint,'doors');
        for(const y of[.15,glassBottom-.03,height-.15])localBox(dir*.17,y,.08,.30,.035,.02,proposed?'#343a36':'#d4d6cd');
      }
      localBox(dir*(width-.13),height*.44,.081,.025,.16,.03,'#30352e');
    }
    openingFrame(left0,left1,DH);doorLeaf(left0,1,leaf,DH);doorLeaf(left1,-1,leaf,DH);
    if(!proposed){openingFrame(right0,right1,DH);doorLeaf(right0,1,leaf,DH);doorLeaf(right1,-1,leaf,DH)}
    else{
      const e0=g.entryLeft,e1=g.entryRight,center=(e0+e1)/2;
      // True void around pedestrian door (never a door pasted onto a solid wall).
      box((right0+e0)/2,DH/2,F,e0-right0,DH,T,wall,'front');box((e1+right1)/2,DH/2,F,right1-e1,DH,T,wall,'front');box(center,g.entryH+(DH-g.entryH)/2,F,g.entryW,DH-g.entryH,T,wall,'header');
      for(let yy=.12;yy<DH;yy+=.22){box((right0+e0)/2,yy,F+.073,e0-right0,.01,.013,'#52636d','front');box((e1+right1)/2,yy,F+.073,right1-e1,.01,.013,'#52636d','front')}
      openingFrame(e0,e1,g.entryH);doorLeaf(e1,-1,g.entryW,g.entryH,true);
      // Infill studs and entry framing are diagrammatic, NOT a certified
      // rough opening or structural header specification. Existing load-bearing
      // post/header geometry is retained in both design modes.
      for(let x=right0+.05;x<e0-.05;x+=.4064)box(x,DH/2,F-T/2-.045,.038,DH,.089,timber,'front:framing',1);
      for(const x of[e0-.045,e1+.045])box(x,g.entryH/2,F-T/2-.045,.06,g.entryH,.089,timber,'front:framing',1);
    }
    // Main gable plus the photographed lower, sloping front roof. This is a
    // photo-based envelope study; pitch, setback and all member sizes assumed.
    const ridge=g.ridge,eave=H+.08,roofFront=F-g.frontSetback,roofBack=-D/2-.28,halfRoof=W/2+.29,roofHex='#555d5c';
    const roofPanel=(a,b,midZ,depth)=>{const dir=norm(sub(b,a));orientedBox([(a[0]+b[0])/2,(a[1]+b[1])/2,midZ],[dir,[-dir[1],dir[0],0],[0,0,1]],[Math.hypot(...sub(b,a)),.09,depth],roofHex,'roof',3)};
    roofPanel([-halfRoof,eave-.16,0],[0,ridge+.08,0],(roofFront+roofBack)/2,roofFront-roofBack+.12);
    roofPanel([0,ridge+.08,0],[halfRoof,eave-.16,0],(roofFront+roofBack)/2,roofFront-roofBack+.12);
    const apronBack=roofFront-.035,apronFront=F+.35,apronTop=H+.65,apronBottom=H+.035,apronDir=norm([0,apronBottom-apronTop,apronFront-apronBack]);
    orientedBox([0,(apronTop+apronBottom)/2,(apronBack+apronFront)/2],[[1,0,0],[0,apronDir[2],-apronDir[1]],apronDir],[W+.64,.085,Math.hypot(apronFront-apronBack,apronTop-apronBottom)],roofHex,'roof',3);
    // Course-width stepped gable fill follows the roof; diagonal white fascia
    // hides the small course-end steps while remaining dependency-free geometry.
    for(const[z,group]of[[roofFront,'gable-front'],[-D/2-T/2,'gable-back']]){
      for(let y=H;y<ridge;y+=.035){const ht=Math.min(.035,ridge-y),width=W*(1-(y+ht-H)/(ridge-H));box(0,y+ht/2,z,width,ht,.075,wall,group,1)}
      beam([-halfRoof,eave-.16,z+.055],[0,ridge+.08,z+.055],.13,.07,trim,group);
      beam([0,ridge+.08,z+.055],[halfRoof,eave-.16,z+.055],.13,.07,trim,group);
    }
    box(0,H-.055,apronFront+.025,W+.72,.19,.09,trim,'roof-trim');
    for(const x of[-halfRoof,halfRoof]){box(x,eave-.17,(roofFront+roofBack)/2,.10,.18,roofFront-roofBack,trim,'roof-trim');beam([x,apronTop,apronBack],[x,apronBottom,apronFront],.11,.11,trim,'roof-trim')}
    // Observed roof system: rafters, ties, vertical links and diagonal bracing.
    // Repetition/location is intentionally schematic, not an asserted survey.
    for(let z=-D/2+.14;z<roofFront+.05;z+=.61){beam([-W/2,H,z],[0,ridge,z],.055,.12,timber);beam([0,ridge,z],[W/2,H,z],.055,.12,timber)}
    beam([0,ridge,roofBack],[0,ridge,roofFront],.07,.17,timber);
    for(const z of[-D/2+.25,-D*.16,roofFront]){
      box(0,H-.16,z,W,.19,.14,timber,'framing',1);
      beam([0,H-.08,z],[0,ridge-.05,z],.075,.085,timber);
      beam([-W*.27,H-.06,z],[-W*.08,ridge-.35,z],.065,.085,timber);
      beam([W*.27,H-.06,z],[W*.08,ridge-.35,z],.065,.085,timber);
    }
    for(const x of[-W/2,W/2])box(x,H-.04,(roofFront-D/2)/2,.11,.13,roofFront+D/2,timber,'framing',1);
    for(let x=-W/2+.12;x<W/2;x+=.61)beam([x,apronTop-.08,apronBack],[x,apronBottom-.08,apronFront],.045,.105,timber);
    // One centered front interior post is visible. No additional floor-supported
    // posts or foundations are invented; its setback is marked assumed.
    box(0,(H-.25)/2,roofFront,P,H-.25,P,timber,'post',1);
  }

  const canvas=$('scene');let gl,program,locations,contextLost=false,softwareMode=false;
  const vertexSource='attribute vec3 p;attribute vec3 n;uniform mat4 mvp;uniform mat4 model;varying vec3 normal;varying vec3 world;void main(){world=(model*vec4(p,1.0)).xyz;normal=normalize(mat3(model)*n);gl_Position=mvp*vec4(p,1.0);}';
  const fragmentSource='precision mediump float;varying vec3 normal;varying vec3 world;uniform vec3 color;uniform float material;float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}void main(){vec3 N=normalize(normal);float sun=max(dot(N,normalize(vec3(-0.4,0.85,0.5))),0.0);float light=0.72+sun*0.27;float grain=0.0;if(material>0.5&&material<1.5){grain=(noise(vec2(world.x*33.0+world.z*35.0,world.y*3.0))-0.5)*0.075;}if(material>1.5){grain=(noise(world.xz*320.0)-0.5)*0.055;if(N.y>0.8){vec2 lines=abs(fract(world.xz)-0.5);float grid=step(0.497,max(lines.x,lines.y));grain-=grid*0.035;}}float foot=1.0-0.11*exp(-max(world.y,0.0)*3.0);gl_FragColor=vec4((color+grain)*light*foot,1.0);}';
  function initGL(){
    gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!gl)throw new Error('WebGL unavailable');
    const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Shader compilation failed');return s};
    program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertexSource));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader linking failed');gl.useProgram(program);
    locations={p:gl.getAttribLocation(program,'p'),n:gl.getAttribLocation(program,'n'),mvp:gl.getUniformLocation(program,'mvp'),model:gl.getUniformLocation(program,'model'),color:gl.getUniformLocation(program,'color'),material:gl.getUniformLocation(program,'material')};
    const cube=[],faces=[[[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],[[0,0,-1],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]],[[1,0,0],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]],[[-1,0,0],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]],[[0,1,0],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]],[[0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]]];
    for(const[n,q]of faces)for(const i of[0,1,2,0,2,3])cube.push(...q[i],...n);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cube),gl.STATIC_DRAW);gl.enableVertexAttribArray(locations.p);gl.vertexAttribPointer(locations.p,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(locations.n);gl.vertexAttribPointer(locations.n,3,gl.FLOAT,false,24,12);
  }
  function rendererStatus(message){if($('renderer-status'))$('renderer-status').textContent=message}
  function failGL(reason){
    contextLost=true;softwareMode=Boolean($('software-scene'));$('fallback').hidden=softwareMode;$('dimensions').replaceChildren();$('download-view').disabled=true;
    $('download-view').title='Image export requires WebGL. The interactive software model remains available.';
    const detail=reason&&typeof reason.message==='string'?reason.message:'WebGL context unavailable';
    if(softwareMode){$('software-scene').removeAttribute('hidden');rendererStatus('Software 3D · image export unavailable · '+detail);requestRender()}
    else rendererStatus('3D unavailable · '+detail);
  }
  function projection(aspect){
    const g=metrics(),{W,D,H,ridge}=g;let eye,target,projection,up=[0,1,0],halfH;
    if(state.view==='plan'){halfH=Math.max((D+1.5)/2,(W+1.6)/(2*aspect))/camera.zoom;target=[camera.panX,0,camera.panY];eye=[camera.panX,30,camera.panY];up=[0,0,-1];projection=ortho(halfH,aspect)}
    else if(state.view==='front'){halfH=Math.max((ridge+1.05)/2,(W+1.1)/(2*aspect))/camera.zoom;target=[camera.panX,ridge/2+camera.panY,0];eye=[camera.panX,ridge/2+camera.panY,30];projection=ortho(halfH,aspect)}
    else if(state.view==='inside'){const yaw=camera.yaw,dy=Math.sin(camera.pitch);eye=[clamp(camera.panX,-W/2+.2,W/2-.2),clamp(1.6+camera.panY,.35,H-.2),-D/2+.7];target=[eye[0]+Math.sin(yaw)*6,eye[1]+dy*6,eye[2]+Math.cos(yaw)*Math.cos(camera.pitch)*6];projection=perspective(clamp(1.12/camera.zoom,.45,1.5),aspect,.03,100)}
    else{let radius=Math.hypot(W+.8,D+1,ridge+.3)/2,centerX=0,centerZ=0;if(state.photo){const shot=photoShots()[state.photoIndex],xs=[-W/2,W/2,shot.position[0],shot.target[0]],zs=[-D/2,D/2,shot.position[2],shot.target[2]],spanX=Math.max(...xs)-Math.min(...xs),spanZ=Math.max(...zs)-Math.min(...zs);centerX=(Math.max(...xs)+Math.min(...xs))/2;centerZ=(Math.max(...zs)+Math.min(...zs))/2;radius=Math.max(radius,Math.hypot(spanX,spanZ,ridge+.3)/2)}const angle=Math.min(.64,Math.atan(Math.tan(.64)*aspect)),distance=radius/Math.sin(angle)*(state.photo?1.12:.86)/camera.zoom;target=[centerX+camera.panX,ridge*.39+camera.panY,centerZ];eye=[target[0]+Math.sin(camera.yaw)*Math.cos(camera.pitch)*distance,target[1]+Math.sin(camera.pitch)*distance,target[2]+Math.cos(camera.yaw)*Math.cos(camera.pitch)*distance];projection=perspective(1.28,aspect,.05,150)}
    return {vp:mul(projection,lookAt(eye,target,up)),eye,target};
  }
  function isVisible(o,eye){
    const base=o.group.split(':')[0],cutaway=state.view==='orbit'&&state.cutaway;
    if(o.group==='roof'||o.group==='roof-trim')return state.roof&&!cutaway&&state.view!=='inside'&&state.view!=='plan';
    if(o.group.startsWith('gable-'))return state.roof&&!cutaway&&state.view!=='inside'&&state.view!=='plan';
    if(o.group==='framing')return state.framing&&state.view!=='plan';
    if(o.group.endsWith(':framing')&&(!state.framing||state.view==='plan'))return false;
    if(state.view==='plan'&&(base==='ground'||base==='header'))return false;
    if(state.photo&&photoShots()[state.photoIndex].inside&&eye[2]>0&&['front','header','doors'].includes(base))return false;
    if(cutaway){if(base==='left'&&eye[0]<0)return false;if(base==='right'&&eye[0]>0)return false;if(base==='back'&&eye[2]<0)return false;}
    return true;
  }
  let frame=0,lastVP;
  // CPU fallback uses the very same model matrices, camera and visibility rules.
  // For each cuboid only camera-facing faces are drawn, far-to-near. It avoids
  // requesting a second canvas context after a failed/blocked WebGL context.
  function renderSoftware(vp,eye,w,h){
    const svg=$('software-scene');if(!svg)return;
    svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.removeAttribute('hidden');
    const corners=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    const faces=[[4,5,6,7],[1,0,3,2],[5,1,2,6],[0,4,7,3],[7,6,2,3],[0,1,5,4]],polygons=[],sun=norm([-.4,.85,.5]);
    for(const o of objects){
      if(!isVisible(o,eye))continue;
      // A painter renderer cannot perfectly depth-resolve intersecting long
      // members behind opaque panels. Do not draw hidden internal structure
      // through an exterior enclosure; cutaway/inside remain the inspection views.
      const exterior=state.view==='front'||state.view==='orbit'&&!state.cutaway;
      if(exterior&&(o.group.endsWith(':framing')||o.group==='post'||state.roof&&o.group==='framing'))continue;
      const world=corners.map(p=>[0,1,2].map(r=>o.m[r]*p[0]+o.m[4+r]*p[1]+o.m[8+r]*p[2]+o.m[12+r]));
      for(const face of faces){
        const points=face.map(i=>world[i]),normal=norm(cross(sub(points[1],points[0]),sub(points[2],points[0]))),center=[0,1,2].map(i=>points.reduce((sum,p)=>sum+p[i],0)/4);
        if(dot(normal,sub(eye,center))<=0)continue;
        const projected=points.map(p=>project(p,vp,w,h));
        // Faces crossing the near plane are omitted rather than stretched
        // across the screen. Interior cameras stay within the clear volume.
        if(projected.some(p=>!p||p[2]<-1||p[2]>1))continue;
        if(projected.every(p=>p[0]<0)||projected.every(p=>p[0]>w)||projected.every(p=>p[1]<0)||projected.every(p=>p[1]>h))continue;
        const light=(.72+Math.max(0,dot(normal,sun))*.27)*(1-.11*Math.exp(-Math.max(center[1],0)*3));
        const rgb=o.color.map(v=>Math.round(clamp(v*light,0,1)*255));
        polygons.push({depth:projected.reduce((sum,p)=>sum+p[2],0)/4,points:projected.map(p=>p[0].toFixed(2)+','+p[1].toFixed(2)).join(' '),fill:'rgb('+rgb.join(',')+')'});
      }
    }
    polygons.sort((a,b)=>b.depth-a.depth);
    svg.replaceChildren(...polygons.map(p=>node('polygon',{points:p.points,fill:p.fill,stroke:p.fill,'stroke-width':.35,'stroke-linejoin':'round'})));
  }
  function render(){
    frame=0;if((!softwareMode&&(!gl||contextLost))||document.hidden||state.page!=='model')return;
    const cw=canvas.clientWidth,ch=canvas.clientHeight;if(!cw||!ch)return;
    const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(cw*dpr),h=Math.round(ch*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    const {vp,eye}=projection(cw/ch);lastVP=vp;
    if(softwareMode){renderSoftware(vp,eye,cw,ch);drawDimensions(vp,cw,ch);return}
    gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(.91,.93,.90,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
    for(const o of objects){if(!isVisible(o,eye))continue;gl.uniformMatrix4fv(locations.model,false,o.m);gl.uniformMatrix4fv(locations.mvp,false,mul(vp,o.m));gl.uniform3fv(locations.color,o.color);gl.uniform1f(locations.material,o.material);gl.drawArrays(gl.TRIANGLES,0,36)}
    drawDimensions(vp,cw,ch);
  }
  requestRender=()=>{if(!frame&&(!contextLost||softwareMode))frame=requestAnimationFrame(render)};
  function project(point,vp,w,h){const a=[...point,1],clip=[0,0,0,0];for(let r=0;r<4;r++)for(let k=0;k<4;k++)clip[r]+=vp[k*4+r]*a[k];if(clip[3]<=0)return null;return[(clip[0]/clip[3]+1)*w/2,(1-clip[1]/clip[3])*h/2,clip[2]/clip[3]]}
  function drawPhotoMarker(svg,vp,w,h){
    const shot=photoShots()[state.photoIndex],p=project(shot.position,vp,w,h),q=project(shot.target,vp,w,h);if(!p||!q||p[2]>1||q[2]>1)return;
    const dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(length<5)return;const ux=dx/length,uy=dy/length,tip=[q[0],q[1]],base=[q[0]-ux*13,q[1]-uy*13],nx=-uy*5,ny=ux*5;
    const group=node('g',{'font-family':'system-ui,sans-serif'});group.appendChild(node('line',{x1:p[0],y1:p[1],x2:base[0],y2:base[1],stroke:'#b45f24','stroke-width':2.4,'stroke-dasharray':'7 5'}));group.appendChild(node('polygon',{points:tip[0]+','+tip[1]+' '+(base[0]+nx)+','+(base[1]+ny)+' '+(base[0]-nx)+','+(base[1]-ny),fill:'#b45f24'}));group.appendChild(node('circle',{cx:q[0],cy:q[1],r:4,fill:'#fff',stroke:'#b45f24','stroke-width':2}));group.appendChild(node('circle',{cx:p[0],cy:p[1],r:17,fill:'#a95825',stroke:'#fff','stroke-width':2}));group.appendChild(node('rect',{x:p[0]-9,y:p[1]-6,width:18,height:12,rx:2,fill:'#fff'}));group.appendChild(node('circle',{cx:p[0],cy:p[1],r:3.3,fill:'#a95825'}));group.appendChild(node('path',{d:'M '+(p[0]+9)+' '+(p[1]-3)+' L '+(p[0]+14)+' '+(p[1]-7)+' L '+(p[0]+14)+' '+(p[1]+7)+' L '+(p[0]+9)+' '+(p[1]+3)+' Z',fill:'#fff'}));group.appendChild(node('rect',{x:p[0]-25,y:p[1]+23,width:50,height:21,rx:4,fill:'#fffaf3',stroke:'#d5aa84'}));group.appendChild(node('text',{x:p[0],y:p[1]+38,'text-anchor':'middle','font-size':12,'font-weight':700,fill:'#8a461c'},shot.id));svg.appendChild(group);
  }
  function drawDimensions(vp,w,h){
    const svg=$('dimensions');svg.replaceChildren();svg.setAttribute('viewBox','0 0 '+w+' '+h);
    const {W,D,H}=metrics();
    function dimension(a,b,text){const p=project(a,vp,w,h),q=project(b,vp,w,h);if(!p||!q||p[2]>1||q[2]>1)return;const dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(length<40)return;const nx=-dy/length*4,ny=dx/length*4;const group=node('g',{stroke:'#5e7168','stroke-width':1.1});group.appendChild(node('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1]}));for(const t of[p,q])group.appendChild(node('line',{x1:t[0]-nx,y1:t[1]-ny,x2:t[0]+nx,y2:t[1]+ny}));const lx=(p[0]+q[0])/2,ly=(p[1]+q[1])/2-9;if(lx<30||lx>w-30||ly<25||ly>h-45)return;const tw=text.length*7+14;group.appendChild(node('rect',{x:lx-tw/2,y:ly-12,width:tw,height:20,fill:'#e8ede6',stroke:'none',rx:3}));group.appendChild(node('text',{x:lx,y:ly+2,'text-anchor':'middle','font-family':'system-ui,sans-serif','font-size':12,fill:'#43564d',stroke:'none'},text));svg.appendChild(group)}
    if(state.dims&&state.view!=='inside'){
      dimension([-W/2,0,D/2+.38],[W/2,0,D/2+.38],format(dimensions.width)+' ft / '+format(W)+' m');
      if(state.view==='front')dimension([W/2+.24,0,D/2],[W/2+.24,H,D/2],format(H)+' m (est.)');
      else dimension([-W/2-.36,0,-D/2],[-W/2-.36,0,D/2],format(dimensions.depth)+' ft / '+format(D)+' m');
    }
    if(state.photo)drawPhotoMarker(svg,vp,w,h);
  }
  function zoomBy(factor){camera.zoom=clamp(camera.zoom*factor,.55,2.3);requestRender()}
  $('zoom-in').addEventListener('click',()=>zoomBy(1.15));$('zoom-out').addEventListener('click',()=>zoomBy(1/1.15));$('reset-view').addEventListener('click',()=>setView(state.view));
  function pan(dx,dy){const g=metrics(),factor=Math.max(g.W,g.D)/Math.max(canvas.clientHeight,1)/camera.zoom;camera.panX=clamp(camera.panX-dx*factor,-g.W,g.W);camera.panY=clamp(camera.panY+(state.view==='plan'?-dy:dy)*factor,-g.D,g.D)}
  function rotate(dx,dy){if(state.view==='front'||state.view==='plan'){pan(dx,dy);return}camera.yaw-=dx*.007;camera.pitch=clamp(camera.pitch+dy*.006,state.view==='inside'?-.7:.05,state.view==='inside'?.7:1.4)}
  const pointers=new Map();
  canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY})});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const old=[...pointers.values()],previous=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const next=[...pointers.values()];if(next.length===2){const dist=a=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),before=dist(old),after=dist(next);if(before>0)camera.zoom=clamp(camera.zoom*after/before,.55,2.3);pan((next[0].x+next[1].x-old[0].x-old[1].x)/2,(next[0].y+next[1].y-old[0].y-old[1].y)/2)}else if(next.length===1){if(e.shiftKey||e.buttons===2)pan(e.clientX-previous.x,e.clientY-previous.y);else rotate(e.clientX-previous.x,e.clientY-previous.y)}requestRender()});
  for(const event of['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>pointers.delete(e.pointerId));
  canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(-e.deltaY*.001))},{passive:false});
  canvas.addEventListener('keydown',e=>{const actions={ArrowLeft:()=>rotate(-15,0),ArrowRight:()=>rotate(15,0),ArrowUp:()=>rotate(0,-15),ArrowDown:()=>rotate(0,15),'+':()=>zoomBy(1.15),'=':()=>zoomBy(1.15),'-':()=>zoomBy(1/1.15),'0':()=>setView(state.view)};if(actions[e.key]){e.preventDefault();actions[e.key]();requestRender()}});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failGL(new Error('WebGL context lost'))});canvas.addEventListener('webglcontextrestored',()=>{try{initGL();contextLost=false;softwareMode=false;if($('software-scene'))$('software-scene').setAttribute('hidden','');$('fallback').hidden=true;$('download-view').disabled=false;$('download-view').removeAttribute('title');rendererStatus('WebGL 3D');requestRender()}catch(error){failGL(error)}});
  window.addEventListener('resize',requestRender);document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0}else requestRender()});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(requestRender).observe(canvas);
  $('download-view').addEventListener('click',()=>{
    if(!gl||contextLost)return;render();const out=document.createElement('canvas'),ctx=out.getContext('2d'),mode=state.mode,view=state.view;out.width=canvas.width;out.height=canvas.height+124;ctx.fillStyle='#edf0ea';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(canvas,0,0);ctx.fillStyle='#22342b';ctx.font='600 22px system-ui';ctx.fillText('GARAGE / '+mode.toUpperCase()+' / '+view.toUpperCase(),24,canvas.height+32,out.width-48);ctx.font='16px system-ui';ctx.fillText(format(dimensions.width)+' × '+format(dimensions.depth)+' ft · '+(mode==='existing'?'White timber':title(state.finish))+' doors · '+(state.open?'doors open':'doors closed'),24,canvas.height+61,out.width-48);ctx.fillText('Planning only. Roof, windows, framing and entry rough opening need field verification.',24,canvas.height+89,out.width-48);
    function save(){out.toBlob(blob=>{if(!blob){toast('This browser could not save the image.');return}const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='garage-'+mode+'-'+view+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('View exported as a PNG image.')},'image/png')}
    if(state.photo||state.dims&&view!=='inside'){
      const overlay=$('dimensions').cloneNode(true);overlay.setAttribute('xmlns',svgNS);overlay.setAttribute('width',canvas.clientWidth);overlay.setAttribute('height',canvas.clientHeight);
      const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(overlay)],{type:'image/svg+xml;charset=utf-8'})),image=new Image();
      image.onload=()=>{ctx.drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);save()};image.onerror=()=>{URL.revokeObjectURL(url);toast('Could not include dimensions in the image. Try again with Dimensions turned off.')};image.src=url;
    }else save();
  });
  rebuild();drawPlan();updateLabels();syncDisplayControls();
  try{initGL();rendererStatus('WebGL 3D')}catch(error){failGL(error)}
  activatePage(location.hash.slice(1)||'model',false);requestRender();
})();
