import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const view=document.getElementById('view');
const scene=new THREE.Scene(); scene.fog=new THREE.Fog(0x0b0e12,8,20);
const camera=new THREE.PerspectiveCamera(38,1,.1,100); camera.position.set(6.7,2.55,.35);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; view.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.target.set(0,1.55,0); controls.minDistance=3.4; controls.maxDistance=10;
scene.add(new THREE.HemisphereLight(0xeaf1ff,0x1a1f24,2.1)); const key=new THREE.DirectionalLight(0xffffff,3.2); key.position.set(4,7,5); key.castShadow=true; scene.add(key);
const floor=new THREE.Mesh(new THREE.CircleGeometry(5.2,64),new THREE.MeshStandardMaterial({color:0x222930,roughness:.96})); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
const mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:.7}); const skin=mat(0xb97856), kit=mat(0x161a20), shoe=mat(0xe8652d), white=mat(0xe7ebef), dark=mat(0x111419);
const J=(p,x=0,y=0,z=0)=>{const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g}; const cast=o=>{o.castShadow=true;o.receiveShadow=true;return o};
function ell(p,r,s,pos,m){const o=cast(new THREE.Mesh(new THREE.SphereGeometry(r,24,18),m));o.scale.set(...s);o.position.set(...pos);p.add(o);return o}
function seg(p,len,rt,rb,m){const o=cast(new THREE.Mesh(new THREE.CylinderGeometry(rb,rt,len,18),m));o.position.y=-len/2;p.add(o);return o}
function arrow(color){const a=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),.5,color,.12,.07);scene.add(a);return a}

const runner=new THREE.Group();runner.position.y=.06;scene.add(runner); const pelvis=J(runner,0,1.86,0);ell(pelvis,.29,[1.02,.65,.78],[0,0,0],kit); const torso=J(pelvis,0,.2,0);ell(torso,.34,[1.02,1.35,.66],[0,.45,0],kit);ell(torso,.3,[1.24,.86,.7],[0,.73,0],kit); const neck=J(torso,0,.99,0);seg(neck,.16,.075,.08,skin).position.y=.08;ell(neck,.22,[.82,1.08,.9],[0,.38,0],skin);
function arm(side){const sh=J(torso,side*.49,.78,0);ell(sh,.105,[1,.9,.9],[0,0,0],skin);seg(sh,.60,.095,.077,skin);const el=J(sh,0,-.60,0);ell(el,.067,[1,.88,.9],[0,0,0],skin);seg(el,.54,.077,.055,skin);const wr=J(el,0,-.54,0);ell(wr,.05,[1,.74,.9],[0,0,0],skin);ell(wr,.09,[.7,1.18,.56],[0,-.12,.02],skin);return{sh,el,wr}}
function leg(side){const hip=J(pelvis,side*.19,-.08,0);seg(hip,.83,.145,.105,kit);const knee=J(hip,0,-.83,0);ell(knee,.078,[1,.86,.92],[0,0,0],skin);seg(knee,.71,.105,.065,skin);const ankle=J(knee,0,-.71,0);ell(ankle,.05,[1,.7,.85],[0,0,0],skin);const foot=J(ankle,0,-.06,0);const s=cast(new THREE.Mesh(new THREE.BoxGeometry(.23,.11,.48),shoe));s.position.z=-.15;foot.add(s);return{hip,knee,ankle,foot}}
const LA=arm(-1),RA=arm(1),LL=leg(-1),RL=leg(1);
const arrL=arrow(0xf08a42),arrR=arrow(0xf08a42),arrNet=arrow(0xffffff);

const ids=['cadence','leg','arm','elbow','freq','phaseOff','torso'];const ui={};ids.forEach(id=>ui[id]=document.getElementById(id));
const fmt={cadence:v=>`${v} spm`,leg:v=>`${v}°`,arm:v=>`${v}°`,elbow:v=>`${v}°`,freq:v=>`${Number(v).toFixed(2)}×`,phaseOff:v=>`${v}°`,torso:v=>`${v}%`};
ids.forEach(id=>ui[id].addEventListener('input',()=>document.getElementById(id+'Val').textContent=fmt[id](ui[id].value))); ids.forEach(id=>document.getElementById(id+'Val').textContent=fmt[id](ui[id].value));
natural.onclick=()=>{cadence.value=176;leg.value=42;arm.value=34;elbow.value=90;freq.value=1;phaseOff.value=0;torso.value=58;ids.forEach(id=>{document.getElementById(id+'Val').textContent=fmt[id](ui[id].value)})};
front.onclick=()=>{camera.position.set(0,2.7,6.8);controls.target.set(0,1.55,0)};side.onclick=()=>{camera.position.set(6.7,2.55,.35);controls.target.set(0,1.55,0)};
const cycleVal=document.getElementById('cycleVal'),cycleFill=document.getElementById('cycleFill'); const armMetric=document.getElementById('armMetric'),legMetric=document.getElementById('legMetric'),resMetric=document.getElementById('resMetric'),yawMetric=document.getElementById('yawMetric');
const deg=THREE.MathUtils.degToRad; const M=87, mUpper=.028*M,mFore=.016*M,mHand=.006*M,LUpper=.33,LFore=.27;
function armInertia(elbowDeg){const phi=Math.PI-deg(elbowDeg);const rF2=LUpper*LUpper+(LFore/2)**2+2*LUpper*(LFore/2)*Math.cos(phi);const rH2=LUpper*LUpper+LFore*LFore+2*LUpper*LFore*Math.cos(phi);return (mUpper*LUpper*LUpper/3)+mFore*rF2+mHand*rH2}
function gaitLeg(leg,q,a){const s=Math.sin(q),c=Math.cos(q);leg.hip.rotation.x=deg(a*(.88*s+.12*Math.sin(2*q-.2)));const swing=Math.max(0,Math.min(1,(-s+.05)/1.05));const knee=10+(1-swing)*(7+5*Math.max(0,c))+swing*(36+28*Math.max(0,-c));leg.knee.rotation.x=deg(-knee);leg.ankle.rotation.x=deg((1-swing)*(-2-7*c)+swing*(3+10*c))}
function worldPos(obj){const v=new THREE.Vector3();obj.getWorldPosition(v);return v}
let phase=.2;const clock=new THREE.Clock();
function pose(p,dt){const cadence=+ui.cadence.value,legA=+ui.leg.value,armA=+ui.arm.value,elbow=+ui.elbow.value,freq=+ui.freq.value,off=deg(+ui.phaseOff.value),comp=+ui.torso.value/100;const omegaStep=(cadence/60)*Math.PI;const qL=p,qR=p+Math.PI;
 runner.position.y=.055+.025*(.5-.5*Math.cos(2*p));pelvis.rotation.y=deg(4.2)*Math.sin(p);pelvis.rotation.z=deg(1.4)*Math.sin(p+Math.PI/2);gaitLeg(LL,qL,legA);gaitLeg(RL,qR,legA);
 const aqL=freq*qL+off,aqR=freq*qR+off;const aL=-Math.sin(aqL),aR=-Math.sin(aqR);LA.sh.rotation.x=deg(armA)*aL;RA.sh.rotation.x=deg(armA)*aR;LA.sh.rotation.z=deg(-5);RA.sh.rotation.z=deg(5);LA.el.rotation.x=deg(180-elbow);RA.el.rotation.x=deg(180-elbow);
 const Iarm=armInertia(elbow);const shoulderOmegaAmp=deg(armA)*freq*omegaStep;const Hleft=Iarm*shoulderOmegaAmp*(-Math.cos(aqL));const Hright=Iarm*shoulderOmegaAmp*(-Math.cos(aqR));
 const legDemandAmp=(.115*M)*(.88*.46*.46)*deg(legA)*omegaStep;const Hlegs=legDemandAmp*Math.cos(p);const Harms=Hleft+Hright;const residual=Hlegs+Harms;const yaw=THREE.MathUtils.clamp(residual*2.8*(1-.72*comp),-12,12);torso.rotation.y=deg(-2.2*Math.sin(p)+yaw);torso.rotation.z=deg(-.6*Math.sin(p+Math.PI/2));neck.rotation.y=deg(-.45*yaw);
 const lp=worldPos(LA.sh),rp=worldPos(RA.sh),tp=worldPos(torso);const sc=1.05;arrL.position.copy(lp);arrR.position.copy(rp);arrNet.position.copy(tp);arrL.setDirection(new THREE.Vector3(0,0,Math.sign(Hleft||1)));arrR.setDirection(new THREE.Vector3(0,0,Math.sign(Hright||1)));arrNet.setDirection(new THREE.Vector3(0,0,Math.sign(residual||1)));arrL.setLength(.12+Math.min(.75,Math.abs(Hleft)*sc),.11,.06);arrR.setLength(.12+Math.min(.75,Math.abs(Hright)*sc),.11,.06);arrNet.setLength(.12+Math.min(1.0,Math.abs(residual)*.8),.13,.07);
 armMetric.textContent=Math.abs(Harms).toFixed(2);legMetric.textContent=Math.abs(Hlegs).toFixed(2);resMetric.textContent=Math.abs(residual).toFixed(2);yawMetric.textContent=`${Math.abs(yaw).toFixed(1)}°`;
}
function resize(){const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);phase+=dt*((+ui.cadence.value)/60)*Math.PI;pose(phase,dt);const pct=((phase%(2*Math.PI))/(2*Math.PI)*100+100)%100;cycleVal.textContent=`${pct.toFixed(0)}%`;cycleFill.style.width=`${pct}%`;controls.update();renderer.render(scene,camera)}animate();