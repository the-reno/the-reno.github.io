import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const view=document.getElementById('view');
const scene=new THREE.Scene(); scene.fog=new THREE.Fog(0x0b0e12,8,20);
const camera=new THREE.PerspectiveCamera(38,1,.1,100); camera.position.set(6.7,2.55,.35);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; view.appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement); orbit.enableDamping=true; orbit.target.set(0,1.55,0); orbit.minDistance=3.4; orbit.maxDistance=10;
scene.add(new THREE.HemisphereLight(0xeaf1ff,0x1a1f24,2.1)); const key=new THREE.DirectionalLight(0xffffff,3.2); key.position.set(4,7,5); key.castShadow=true; scene.add(key);
const floor=new THREE.Mesh(new THREE.CircleGeometry(5.2,64),new THREE.MeshStandardMaterial({color:0x222930,roughness:.96})); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.7}); const skin=mat(0xb97856),kit=mat(0x161a20),shoe=mat(0xe8652d);
const joint=(p,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g};
const cast=o=>{o.castShadow=true;o.receiveShadow=true;return o};
function ell(p,r,s,pos,m){const o=cast(new THREE.Mesh(new THREE.SphereGeometry(r,24,18),m));o.scale.set(...s);o.position.set(...pos);p.add(o);return o}
function seg(p,len,rt,rb,m){const o=cast(new THREE.Mesh(new THREE.CylinderGeometry(rb,rt,len,18),m));o.position.y=-len/2;p.add(o);return o}
function arrow(color){const a=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),.5,color,.12,.07);scene.add(a);return a}
const runner=new THREE.Group();runner.position.y=.06;scene.add(runner);
const pelvis=joint(runner,0,1.86,0);ell(pelvis,.29,[1.02,.65,.78],[0,0,0],kit);
const torso=joint(pelvis,0,.2,0);ell(torso,.34,[1.02,1.35,.66],[0,.45,0],kit);ell(torso,.3,[1.24,.86,.7],[0,.73,0],kit);
const neck=joint(torso,0,.99,0);seg(neck,.16,.075,.08,skin).position.y=.08;ell(neck,.22,[.82,1.08,.9],[0,.38,0],skin);
function makeArm(side){const sh=joint(torso,side*.49,.78,0);ell(sh,.105,[1,.9,.9],[0,0,0],skin);seg(sh,.60,.095,.077,skin);const el=joint(sh,0,-.60,0);ell(el,.067,[1,.88,.9],[0,0,0],skin);seg(el,.54,.077,.055,skin);const wr=joint(el,0,-.54,0);ell(wr,.05,[1,.74,.9],[0,0,0],skin);ell(wr,.09,[.7,1.18,.56],[0,-.12,.02],skin);return{sh,el,wr}}
function makeLeg(side){const hip=joint(pelvis,side*.19,-.08,0);seg(hip,.83,.145,.105,kit);const knee=joint(hip,0,-.83,0);ell(knee,.078,[1,.86,.92],[0,0,0],skin);seg(knee,.71,.105,.065,skin);const ankle=joint(knee,0,-.71,0);ell(ankle,.05,[1,.7,.85],[0,0,0],skin);const foot=joint(ankle,0,-.06,0);const s=cast(new THREE.Mesh(new THREE.BoxGeometry(.23,.11,.48),shoe));s.position.z=-.15;foot.add(s);return{hip,knee,ankle,foot}}
const LA=makeArm(-1),RA=makeArm(1),LL=makeLeg(-1),RL=makeLeg(1); const arrL=arrow(0xf08a42),arrR=arrow(0xf08a42),arrNet=arrow(0xffffff);

const ids=['cadence','leg','arm','elbow','freq','phaseOff','torso']; const ui={}; ids.forEach(id=>ui[id]=document.getElementById(id));
const names={cadence:'Cadence',leg:'Leg lift',arm:'Arm swing',elbow:'Elbow angle',freq:'Arm frequency',phaseOff:'Arm timing',torso:'Torso response'};
const format={cadence:v=>Math.round(v),leg:v=>Math.round(v),arm:v=>Math.round(v),elbow:v=>Math.round(v),freq:v=>Number(v).toFixed(2),phaseOff:v=>Math.round(v),torso:v=>Math.round(v)};
let selected='cadence'; const selectedName=document.getElementById('selectedName'),editorInput=document.getElementById('editorInput'),editorRange=document.getElementById('editorRange');
function clamp(el,v){const min=+el.min,max=+el.max,step=+el.step||1;const d=(String(step).split('.')[1]||'').length;return Number(Math.max(min,Math.min(max,v)).toFixed(d))}
function setValue(id,v){ui[id].value=clamp(ui[id],Number(v));ui[id].dispatchEvent(new Event('input',{bubbles:true}))}
function updateReadout(id){const r=document.querySelector(`[data-readout="${id}"]`);if(r)r.textContent=format[id](ui[id].value)}
function syncEditor(){const e=ui[selected];selectedName.textContent=names[selected];['min','max','step'].forEach(k=>{editorInput[k]=e[k];editorRange[k]=e[k]});editorInput.value=e.value;editorRange.value=e.value;document.querySelectorAll('.param').forEach(p=>p.classList.toggle('active',p.dataset.param===selected))}
ids.forEach(id=>ui[id].addEventListener('input',()=>{updateReadout(id);if(id===selected){editorInput.value=ui[id].value;editorRange.value=ui[id].value}}));
document.querySelectorAll('.param').forEach(p=>p.onclick=()=>{selected=p.dataset.param;syncEditor()});
document.getElementById('editorMinus').onclick=()=>setValue(selected,+ui[selected].value-(+ui[selected].step||1)); document.getElementById('editorPlus').onclick=()=>setValue(selected,+ui[selected].value+(+ui[selected].step||1));
editorInput.onchange=()=>setValue(selected,editorInput.value); editorRange.oninput=()=>setValue(selected,editorRange.value);
function preset(v){Object.entries(v).forEach(([id,x])=>setValue(id,x));syncEditor()}
document.getElementById('natural').onclick=()=>preset({cadence:176,leg:42,arm:34,elbow:90,freq:1,phaseOff:0,torso:58});
document.getElementById('highKnee').onclick=()=>preset({cadence:180,leg:56,arm:44,elbow:88,freq:1,phaseOff:0,torso:62});
document.getElementById('strongArms').onclick=()=>preset({cadence:176,leg:42,arm:52,elbow:82,freq:1.05,phaseOff:0,torso:62});
document.getElementById('quietArms').onclick=()=>preset({cadence:176,leg:42,arm:14,elbow:95,freq:1,phaseOff:0,torso:45});
ids.forEach(updateReadout);syncEditor();
document.getElementById('front').onclick=()=>{camera.position.set(0,2.7,6.8);orbit.target.set(0,1.55,0);orbit.update()}; document.getElementById('side').onclick=()=>{camera.position.set(6.7,2.55,.35);orbit.target.set(0,1.55,0);orbit.update()};

const deg=THREE.MathUtils.degToRad,M=87,mUpper=.028*M,mFore=.016*M,mHand=.006*M,LUpper=.33,LFore=.27;
function armInertia(elbow){const phi=Math.PI-deg(elbow),rf=LUpper*LUpper+(LFore/2)**2+2*LUpper*(LFore/2)*Math.cos(phi),rh=LUpper*LUpper+LFore*LFore+2*LUpper*LFore*Math.cos(phi);return mUpper*LUpper*LUpper/3+mFore*rf+mHand*rh}
function cfg(){return Object.fromEntries(ids.map(id=>[id,+ui[id].value]))}
function mechanics(q,c){const omega=(c.cadence/60)*Math.PI,off=deg(c.phaseOff),aqL=c.freq*q+off,aqR=c.freq*(q+Math.PI)+off,I=armInertia(c.elbow),amp=deg(c.arm)*c.freq*omega;
 const Hleft=-I*amp*Math.cos(aqL); const Hright=I*amp*Math.cos(aqR); // side-axis sign: both natural arms counter the same net lower-body rotation
 const Hlegs=(.115*M)*(.88*.46*.46)*deg(c.leg)*omega*Math.cos(q),Harms=Hleft+Hright,residual=Hlegs+Harms,yaw=THREE.MathUtils.clamp(residual*2.8*(1-.72*c.torso/100),-12,12),armEffort=(Math.abs(Hleft)+Math.abs(Hright))*c.freq;
 return{Hleft,Hright,Hlegs,Harms,residual,yaw,armEffort}}
function evaluate(c,goal){let r2=0,y2=0,e=0;const n=24;for(let i=0;i<n;i++){const m=mechanics(i/n*Math.PI*2,c);r2+=m.residual**2;y2+=m.yaw**2;e+=m.armEffort}const rr=Math.sqrt(r2/n),yr=Math.sqrt(y2/n),eff=e/n,rn=rr/8,yn=yr/8,en=eff/1.6,torsoPenalty=Math.abs(c.torso-58)/42;let score;
 if(goal==='stability')score=.48*rn+.42*yn+.07*en+.03*torsoPenalty; else if(goal==='performance')score=.57*rn+.23*yn+.12*en+.04*Math.abs(c.freq-1)+.04*torsoPenalty; else score=.43*rn+.22*yn+.30*en+.05*torsoPenalty;
 return{score,residual:rr,yaw:yr,effort:eff}}
function vals(a,b,s){const x=[];for(let v=a;v<=b+1e-9;v+=s)x.push(Number(v.toFixed(3)));return x}
let goal='efficiency',best=null; const result=document.getElementById('optResult'),optBtn=document.getElementById('optimizeBtn');
document.querySelectorAll('.goal-btn').forEach(b=>b.onclick=()=>{goal=b.dataset.goal;document.querySelectorAll('.goal-btn').forEach(x=>x.classList.toggle('active',x===b));best=null;result.innerHTML=`<b>${b.textContent}</b> selected. Press Optimize.`});
function optimize(){const base=cfg(),before=evaluate(base,goal);best={c:{...base},m:before};const A=vals(10,60,5),E=vals(65,125,10),F=vals(.85,1.15,.05),P=vals(-20,20,5),T=vals(40,80,10);
 for(const arm of A)for(const elbow of E)for(const freq of F)for(const phaseOff of P)for(const torso of T){const c={...base,arm,elbow,freq,phaseOff,torso},m=evaluate(c,goal);if(m.score<best.m.score)best={c,m}}
 const b=best.c,AA=vals(Math.max(0,b.arm-4),Math.min(70,b.arm+4),2),EE=vals(Math.max(55,b.elbow-10),Math.min(170,b.elbow+10),5),FF=vals(Math.max(.5,b.freq-.05),Math.min(1.5,b.freq+.05),.05),PP=vals(Math.max(-60,b.phaseOff-5),Math.min(60,b.phaseOff+5),5),TT=vals(Math.max(0,b.torso-10),Math.min(100,b.torso+10),5);
 for(const arm of AA)for(const elbow of EE)for(const freq of FF)for(const phaseOff of PP)for(const torso of TT){const c={...base,arm,elbow,freq,phaseOff,torso},m=evaluate(c,goal);if(m.score<best.m.score)best={c,m}}
 const gain=Math.max(0,(before.score-best.m.score)/Math.max(.0001,before.score)*100);result.innerHTML=`<b>Best:</b> arm ${best.c.arm}°, elbow ${best.c.elbow}°, freq ${best.c.freq.toFixed(2)}×, timing ${best.c.phaseOff}°, torso ${best.c.torso}% <span class="gain">${gain.toFixed(0)}% better score</span><button class="apply-btn" id="applyBest">Apply</button>`;
 document.getElementById('applyBest').onclick=()=>{['arm','elbow','freq','phaseOff','torso'].forEach(id=>setValue(id,best.c[id]));syncEditor();result.innerHTML=`Applied <b>${goal}</b> setup. Cadence ${base.cadence} spm and leg lift ${base.leg}° stayed fixed.`}}
optBtn.onclick=()=>{optBtn.disabled=true;optBtn.textContent='Searching…';setTimeout(()=>{optimize();optBtn.disabled=false;optBtn.textContent='Optimize'},20)};

function gaitLeg(x,q,a){const s=Math.sin(q),co=Math.cos(q);x.hip.rotation.x=deg(a*(.88*s+.12*Math.sin(2*q-.2)));const sw=Math.max(0,Math.min(1,(-s+.05)/1.05));x.knee.rotation.x=deg(-(10+(1-sw)*(7+5*Math.max(0,co))+sw*(36+28*Math.max(0,-co))));x.ankle.rotation.x=deg((1-sw)*(-2-7*co)+sw*(3+10*co))}
function wp(o){const v=new THREE.Vector3();o.getWorldPosition(v);return v}
const armMetric=document.getElementById('armMetric'),legMetric=document.getElementById('legMetric'),resMetric=document.getElementById('resMetric'),yawMetric=document.getElementById('yawMetric'),cycleVal=document.getElementById('cycleVal'),cycleFill=document.getElementById('cycleFill');
let phase=.2;const clock=new THREE.Clock();
function pose(p){const c=cfg(),qL=p,qR=p+Math.PI,off=deg(c.phaseOff);runner.position.y=.055+.025*(.5-.5*Math.cos(2*p));pelvis.rotation.y=deg(4.2)*Math.sin(p);pelvis.rotation.z=deg(1.4)*Math.sin(p+Math.PI/2);gaitLeg(LL,qL,c.leg);gaitLeg(RL,qR,c.leg);LA.sh.rotation.x=deg(c.arm)*(-Math.sin(c.freq*qL+off));RA.sh.rotation.x=deg(c.arm)*(-Math.sin(c.freq*qR+off));LA.sh.rotation.z=deg(-5);RA.sh.rotation.z=deg(5);LA.el.rotation.x=deg(180-c.elbow);RA.el.rotation.x=deg(180-c.elbow);const m=mechanics(p,c);torso.rotation.y=deg(-2.2*Math.sin(p)+m.yaw);torso.rotation.z=deg(-.6*Math.sin(p+Math.PI/2));neck.rotation.y=deg(-.45*m.yaw);const lp=wp(LA.sh),rp=wp(RA.sh),tp=wp(torso);arrL.position.copy(lp);arrR.position.copy(rp);arrNet.position.copy(tp);arrL.setDirection(new THREE.Vector3(0,0,Math.sign(m.Hleft||1)));arrR.setDirection(new THREE.Vector3(0,0,Math.sign(m.Hright||1)));arrNet.setDirection(new THREE.Vector3(0,0,Math.sign(m.residual||1)));arrL.setLength(.12+Math.min(.75,Math.abs(m.Hleft)*1.05),.11,.06);arrR.setLength(.12+Math.min(.75,Math.abs(m.Hright)*1.05),.11,.06);arrNet.setLength(.12+Math.min(1,Math.abs(m.residual)*.8),.13,.07);armMetric.textContent=Math.abs(m.Harms).toFixed(2);legMetric.textContent=Math.abs(m.Hlegs).toFixed(2);resMetric.textContent=Math.abs(m.residual).toFixed(2);yawMetric.textContent=`${Math.abs(m.yaw).toFixed(1)}°`}
function resize(){const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();
function animate(){requestAnimationFrame(animate);phase+=Math.min(clock.getDelta(),.04)*(+ui.cadence.value/60)*Math.PI;pose(phase);const pct=((phase%(2*Math.PI))/(2*Math.PI)*100+100)%100;cycleVal.textContent=`${pct.toFixed(0)}%`;cycleFill.style.width=`${pct}%`;orbit.update();renderer.render(scene,camera)}animate();