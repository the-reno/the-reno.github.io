import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const view=document.getElementById('view');
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0x0d1014,8,18);
const camera=new THREE.PerspectiveCamera(38,1,.1,100);
camera.position.set(6.6,2.55,.12);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
view.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=.075;
controls.target.set(0,1.55,0); controls.minDistance=3.2; controls.maxDistance=10;
scene.add(new THREE.HemisphereLight(0xdfe7ff,0x20252b,2.15));
const key=new THREE.DirectionalLight(0xffffff,3); key.position.set(4,7,5); key.castShadow=true; scene.add(key);
const rim=new THREE.DirectionalLight(0x8aa5d9,1.25); rim.position.set(-5,4,-5); scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(5.3,64),new THREE.MeshStandardMaterial({color:0x242a31,roughness:.96}));
floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);

const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.68,metalness:.01});
const skin=mat(0xb97a58),kit=mat(0x15191d),green=mat(0x67a92d),orange=mat(0xed5a2b),white=mat(0xe9ecef),dark=mat(0x111318),lens=mat(0xc85c16);
const J=(p,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g};
const cast=m=>{m.castShadow=true;m.receiveShadow=true;return m};
const ell=(p,r,s,pos,m)=>{const o=cast(new THREE.Mesh(new THREE.SphereGeometry(r,28,20),m));o.scale.set(...s);o.position.set(...pos);p.add(o);return o};
function seg(p,len,rTop,rBot,m){const o=cast(new THREE.Mesh(new THREE.CylinderGeometry(rBot,rTop,len,20,1,false),m));o.position.y=-len/2;p.add(o);return o}
function shoeMesh(material,soleMat){
  const g=new THREE.Group(); const geo=new THREE.BufferGeometry();
  const v=new Float32Array([-.095,-.045,.08,.095,-.045,.08,-.10,.055,.07,.10,.055,.07,-.115,-.05,-.31,.115,-.05,-.31,-.105,.045,-.37,.105,.045,-.37]);
  const idx=[0,2,1,1,2,3,4,5,6,5,7,6,0,1,4,1,5,4,2,6,3,3,6,7,0,4,2,2,4,6,1,3,5,3,7,5];
  geo.setAttribute('position',new THREE.BufferAttribute(v,3)); geo.setIndex(idx); geo.computeVertexNormals();
  g.add(cast(new THREE.Mesh(geo,material)));
  const sole=cast(new THREE.Mesh(new THREE.BoxGeometry(.23,.028,.46),soleMat)); sole.position.set(0,-.063,-.145); g.add(sole);
  ell(g,.075,[1,.62,.95],[0,-.01,.075],material); ell(g,.09,[1.02,.58,1.18],[0,-.005,-.35],material); return g;
}

const runner=new THREE.Group(); runner.position.y=.07; scene.add(runner);
const pelvis=J(runner,0,1.86,0); ell(pelvis,.29,[1.03,.65,.78],[0,.02,0],kit);
const torso=J(pelvis,0,.20,0); ell(torso,.34,[1.02,1.34,.65],[0,.44,0],kit); ell(torso,.30,[1.24,.86,.69],[0,.72,0],kit);
const stripe=cast(new THREE.Mesh(new THREE.BoxGeometry(.64,.055,.018),green)); stripe.position.set(0,.66,.218); torso.add(stripe);
const neck=J(torso,0,.98,0); seg(neck,.17,.075,.082,skin).position.y=.085; ell(neck,.224,[.80,1.08,.88],[0,.39,0],skin); ell(neck,.15,[.82,.52,.76],[0,.27,.015],skin);
const cap=cast(new THREE.Mesh(new THREE.SphereGeometry(.228,26,18,0,Math.PI*2,0,Math.PI/2),dark)); cap.scale.set(.81,1.08,.89); cap.position.y=.43; neck.add(cap);
const glasses=cast(new THREE.Mesh(new THREE.BoxGeometry(.31,.052,.024),lens)); glasses.position.set(0,.43,.19); neck.add(glasses);
function arm(side){const shoulder=J(torso,side*.49,.77,0);ell(shoulder,.105,[1,.9,.9],[0,0,0],skin);seg(shoulder,.60,.095,.078,skin);const elbow=J(shoulder,0,-.60,0);ell(elbow,.066,[1,.88,.9],[0,0,0],skin);seg(elbow,.54,.078,.055,skin);const wrist=J(elbow,0,-.54,0);ell(wrist,.050,[1,.74,.9],[0,0,0],skin);ell(wrist,.09,[.70,1.20,.56],[0,-.12,.02],skin);return{shoulder,elbow,wrist}}
const LA=arm(-1),RA=arm(1);
function leg(side){const hip=J(pelvis,side*.19,-.08,0);seg(hip,.83,.145,.105,kit);const knee=J(hip,0,-.83,0);ell(knee,.078,[1,.86,.92],[0,0,0],skin);seg(knee,.71,.105,.065,skin);ell(knee,.105,[.72,1.22,.75],[0,-.28,-.02],skin);const ankle=J(knee,0,-.71,0);ell(ankle,.050,[1,.66,.84],[0,0,0],skin);const footRoot=J(ankle,0,-.045,0);footRoot.add(shoeMesh(orange,white));return{hip,knee,ankle,footRoot}}
const LL=leg(-1),RL=leg(1);

const ui={}; ['cadence','elbow','arm','lean','stride','speed'].forEach(id=>ui[id]=document.getElementById(id));
const vals={cadence:cadenceVal,elbow:elbowVal,arm:armVal,lean:leanVal,stride:strideVal,speed:speedVal};
const phaseVal=document.getElementById('phaseVal'),phaseFill=document.getElementById('phasefill');
function labels(){vals.cadence.textContent=`${ui.cadence.value} spm`;vals.elbow.textContent=`${ui.elbow.value}°`;vals.arm.textContent=`${ui.arm.value}°`;vals.lean.textContent=`${ui.lean.value}°`;vals.stride.textContent=`${ui.stride.value}°`;vals.speed.textContent=`${Number(ui.speed.value).toFixed(2)}×`}
Object.values(ui).forEach(e=>e.addEventListener('input',labels)); labels();
let running=true; play.onclick=e=>{running=!running;e.currentTarget.textContent=running?'Pause':'Play'};
front.onclick=()=>{camera.position.set(0,2.75,6.8);controls.target.set(0,1.55,0);controls.update()};
side.onclick=()=>{camera.position.set(6.6,2.55,.12);controls.target.set(0,1.55,0);controls.update()};

const deg=v=>THREE.MathUtils.degToRad(v); let phase=.55; const clock=new THREE.Clock();
function easeSin(x){return Math.sin(x)*(.90+.10*Math.cos(2*x))}
function clamp01(x){return Math.max(0,Math.min(1,x))}
function gaitLeg(leg,q,stride){
  const s=easeSin(q),c=Math.cos(q);
  const swing=clamp01((-s+.05)/1.05),stance=1-swing;
  leg.hip.rotation.x=deg(stride*(.88*s+.12*Math.sin(2*q-.25)));
  const kneeFlex=10+stance*(7+5*clamp01(c))+swing*(36+27*clamp01(-c));
  leg.knee.rotation.x=deg(-kneeFlex);
  leg.ankle.rotation.x=deg(stance*(-2-7*c)+swing*(3+10*c));
  leg.footRoot.rotation.x=deg(stance*(1.5+3*c)+swing*(-2-3*c));
}
function pose(p){
  const elbow=+ui.elbow.value,arm=+ui.arm.value,lean=+ui.lean.value,stride=+ui.stride.value;
  const lp=p,rp=p+Math.PI;
  const bounce=.030*(.5-.5*Math.cos(2*p));
  const flight=.010*Math.pow(Math.max(0,Math.sin(2*p)),2);
  runner.position.y=.055+bounce+flight;
  pelvis.position.x=.015*Math.sin(p);
  pelvis.rotation.y=deg(3.8)*Math.sin(p);
  pelvis.rotation.z=deg(1.8)*Math.sin(p+Math.PI/2);
  torso.rotation.x=deg(lean)+deg(.6)*Math.sin(2*p+.5);
  torso.rotation.y=-deg(2.4)*Math.sin(p);
  torso.rotation.z=-deg(.7)*Math.sin(p+Math.PI/2);
  gaitLeg(LL,lp,stride); gaitLeg(RL,rp,stride);
  const armL=-easeSin(lp),armR=-easeSin(rp);
  LA.shoulder.rotation.x=deg(arm)*armL; RA.shoulder.rotation.x=deg(arm)*armR;
  LA.shoulder.rotation.z=deg(-5)+deg(1.2)*Math.sin(p); RA.shoulder.rotation.z=deg(5)+deg(1.2)*Math.sin(p);
  const epL=5*(.5+.5*Math.cos(lp+.6)),epR=5*(.5+.5*Math.cos(rp+.6));
  LA.elbow.rotation.x=deg(180-elbow-epL); RA.elbow.rotation.x=deg(180-elbow-epR);
  LA.elbow.rotation.y=deg(-3); RA.elbow.rotation.y=deg(3);
  neck.rotation.x=deg(-lean*.40)-deg(.35)*Math.sin(2*p+.4); neck.rotation.y=deg(-1.0)*Math.sin(p);
}
function resize(){const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
addEventListener('resize',resize); resize();
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);if(running){phase+=dt*((+ui.cadence.value)/120)*Math.PI*2*(+ui.speed.value)}pose(phase);const pct=((phase%(Math.PI*2))/(Math.PI*2)*100+100)%100;phaseVal.textContent=`${pct.toFixed(0)}%`;phaseFill.style.width=`${pct}%`;controls.update();renderer.render(scene,camera)}
animate();