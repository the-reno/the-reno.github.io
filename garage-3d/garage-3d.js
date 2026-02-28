(function () {

if (!window.THREE) {
  alert("three.min.js not loading");
  return;
}

const FT = 0.3048;

const W = 21 * FT;
const D = 20 * FT;
const H = 8 * FT;

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(app.clientWidth, app.clientHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0c10);

const camera = new THREE.PerspectiveCamera(55, app.clientWidth/app.clientHeight, 0.01, 200);
camera.position.set(6,-9,5);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff,0x202533,1));

const slabMat = new THREE.MeshStandardMaterial({color:0x999999});
const wallMat = new THREE.MeshStandardMaterial({color:0x2a2f3a,transparent:true,opacity:0.4});
const woodMat = new THREE.MeshStandardMaterial({color:0x5b3a21});

function box(w,d,h,mat){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,d,h),mat);
  m.castShadow=true;
  m.receiveShadow=true;
  return m;
}

// slab
const slab = box(W,D,0.1,slabMat);
slab.position.set(W/2,D/2,-0.05);
scene.add(slab);

// walls
const t = 0.09;

const front = box(W,t,H,wallMat);
front.position.set(W/2,t/2,H/2);
scene.add(front);

const rear = box(W,t,H,wallMat);
rear.position.set(W/2,D-t/2,H/2);
scene.add(rear);

const left = box(t,D,H,wallMat);
left.position.set(t/2,D/2,H/2);
scene.add(left);

const right = box(t,D,H,wallMat);
right.position.set(W-t/2,D/2,H/2);
scene.add(right);

// roof (simple 8/12 pitch)
const rise = (8/12)*(W/2);
const slope = Math.sqrt((W/2)*(W/2)+rise*rise);

const roofMat = new THREE.MeshStandardMaterial({color:0x1a1c24});

const roofL = new THREE.Mesh(new THREE.BoxGeometry(slope,D,0.05),roofMat);
roofL.rotation.z = Math.atan2(rise,W/2);
roofL.position.set(W/2-(W/4),D/2,H+rise/2);
scene.add(roofL);

const roofR = new THREE.Mesh(new THREE.BoxGeometry(slope,D,0.05),roofMat);
roofR.rotation.z = -Math.atan2(rise,W/2);
roofR.position.set(W/2+(W/4),D/2,H+rise/2);
scene.add(roofR);

// animation
function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
animate();

window.addEventListener('resize',()=>{
  renderer.setSize(app.clientWidth,app.clientHeight);
  camera.aspect=app.clientWidth/app.clientHeight;
  camera.updateProjectionMatrix();
});

})();
