(function () {
  const errBox = document.getElementById('errBox');
  const showErr = (msg) => { errBox.style.display = 'block'; errBox.textContent = msg; };

  if (!window.THREE) { showErr("THREE not found. Check ./vendor/three.min.js path."); return; }
  if (!THREE.OrbitControls) { showErr("OrbitControls not found. Check ./vendor/OrbitControls.js path."); return; }

  const FT = 0.3048;

  // Known structural inputs
  const params = {
    W_ft: 21.0,
    D_ft: 20.0,
    slabTh_in: 4.0,
    wallH_ft: 8.0,
    pitch_rise_per12: 8.0,
    studSpacing_in: 16,
    doorW_ft: 6.0,
    doorH_ft: 7.0,
    gap_ft: 0.5,
    showFraming: true,
    showDims: true
  };

  function derived() {
    const remaining = params.W_ft - (params.doorW_ft + params.gap_ft + params.doorW_ft);
    const sideReturn_ft = Math.max(0.25, remaining / 2);
    return { sideReturn_ft };
  }

  const app = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(app.clientWidth, app.clientHeight);
  renderer.shadowMap.enabled = true;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0c10);

  const camera = new THREE.PerspectiveCamera(55, app.clientWidth / app.clientHeight, 0.01, 250);
  camera.position.set(6.5, -9.5, 5.5);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.screenSpacePanning = true;
  controls.minDistance = 2.0;
  controls.maxDistance = 80.0;
  controls.maxPolarAngle = Math.PI * 0.49;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x202533, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(10, -10, 12);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  scene.add(dir);

  scene.add(new THREE.AxesHelper(2));

  const matSlab = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.95 });
  const matWall = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9, transparent: true, opacity: 0.35 });
  const matWood = new THREE.MeshStandardMaterial({ color: 0x5b3a21, roughness: 0.85 });
  const matBeam = new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: 0.85 });
  const matDim = new THREE.LineBasicMaterial({ color: 0xffffff });

  const root = new THREE.Group();
  const envelope = new THREE.Group();
  const framing = new THREE.Group();
  const dims = new THREE.Group();
  root.add(envelope, framing, dims);
  scene.add(root);

  const clearGroup = (g) => { while (g.children.length) g.remove(g.children[0]); };

  function box(w, d, h, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function makeLabel(text) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const pad = 10;
    ctx.font = 'bold 24px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    const h = 42;
    c.width = w; c.height = h;
    ctx.font = 'bold 24px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.fillStyle = 'white'; ctx.textBaseline = 'middle'; ctx.fillText(text, pad, h / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(w / 200, h / 200, 1);
    return spr;
  }

  function addDimLine(a, b, label) {
    const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geom, matDim);
    dims.add(line);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const lab = makeLabel(label);
    lab.position.copy(mid);
    dims.add(lab);
  }

  function build() {
    clearGroup(envelope); clearGroup(framing); clearGroup(dims);
    const { sideReturn_ft } = derived();

    const W = params.W_ft * FT;
    const D = params.D_ft * FT;
    const slabTh = (params.slabTh_in / 12) * FT;
    const He = params.wallH_ft * FT;

    const pitch = params.pitch_rise_per12;
    const halfSpan = W / 2;
    const rise = (pitch / 12) * halfSpan;
    const Hr = He + rise;

    // slab
    const slab = box(W, D, slabTh, matSlab);
    slab.position.set(W / 2, D / 2, -slabTh / 2);
    envelope.add(slab);

    // walls
    const wallTh = 0.089;
    const front = box(W, wallTh, He, matWall); front.position.set(W / 2, wallTh / 2, He / 2); envelope.add(front);
    const rear = box(W, wallTh, He, matWall); rear.position.set(W / 2, D - wallTh / 2, He / 2); envelope.add(rear);
    const left = box(wallTh, D, He, matWall); left.position.set(wallTh / 2, D / 2, He / 2); envelope.add(left);
    const right = box(wallTh, D, He, matWall); right.position.set(W - wallTh / 2, D / 2, He / 2); envelope.add(right);

    // roof planes (context)
    const roofTh = 0.04;
    const roofLen = D + 0.2;
    const slopeLen = Math.sqrt(halfSpan * halfSpan + rise * rise);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.95 });

    const roofL = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, roofLen, roofTh), roofMat);
    roofL.rotation.z = Math.atan2(rise, halfSpan);
    roofL.position.set(W / 2 - halfSpan / 2, D / 2, He + rise / 2);
    envelope.add(roofL);

    const roofR = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, roofLen, roofTh), roofMat);
    roofR.rotation.z = -Math.atan2(rise, halfSpan);
    roofR.position.set(W / 2 + halfSpan / 2, D / 2, He + rise / 2);
    envelope.add(roofR);

    // framing
    const studSpacing = (params.studSpacing_in / 12) * FT;
    const studW = 0.038, studD = 0.089, plateH = 0.038;

    const addStud = (x, y, z0, h) => {
      const s = box(studW, studD, h, matWood);
      s.position.set(x, y, z0 + h / 2);
      framing.add(s);
    };

    // plates
    framing.add(Object.assign(box(W, studD, plateH, matBeam), { position: new THREE.Vector3(W/2, studD/2, plateH/2) }));
    framing.add(Object.assign(box(W, studD, plateH, matBeam), { position: new THREE.Vector3(W/2, studD/2, He-plateH/2) }));
    framing.add(Object.assign(box(W, studD, plateH, matBeam), { position: new THREE.Vector3(W/2, D-studD/2, plateH/2) }));
    framing.add(Object.assign(box(W, studD, plateH, matBeam), { position: new THREE.Vector3(W/2, D-studD/2, He-plateH/2) }));
    framing.add(Object.assign(box(studD, D, plateH, matBeam), { position: new THREE.Vector3(studD/2, D/2, plateH/2) }));
    framing.add(Object.assign(box(studD, D, plateH, matBeam), { position: new THREE.Vector3(studD/2, D/2, He-plateH/2) }));
    framing.add(Object.assign(box(studD, D, plateH, matBeam), { position: new THREE.Vector3(W-studD/2, D/2, plateH/2) }));
    framing.add(Object.assign(box(studD, D, plateH, matBeam), { position: new THREE.Vector3(W-studD/2, D/2, He-plateH/2) }));

    // doors
    const dw = params.doorW_ft * FT;
    const dh = params.doorH_ft * FT;
    const gp = params.gap_ft * FT;
    const xdl = sideReturn_ft * FT;

    const leftStart = xdl, leftEnd = xdl + dw;
    const rightStart = xdl + dw + gp, rightEnd = rightStart + dw;

    for (let x = 0; x <= W + 1e-6; x += studSpacing) {
      const inLeft = (x > leftStart && x < leftEnd);
      const inRight = (x > rightStart && x < rightEnd);
      if (inLeft || inRight) continue;
      addStud(x, studD / 2, 0, He - plateH);
    }

    // center post + headers
    const post = box(0.09, 0.14, dh, matWood);
    post.position.set(xdl + dw + gp / 2, studD / 2, dh / 2);
    framing.add(post);

    const headerH = 0.14, headerD = 0.09;
    const headerL = box(dw, headerD, headerH, matBeam);
    headerL.position.set((leftStart + leftEnd) / 2, studD / 2, dh + headerH / 2);
    framing.add(headerL);

    const headerR = box(dw, headerD, headerH, matBeam);
    headerR.position.set((rightStart + rightEnd) / 2, studD / 2, dh + headerH / 2);
    framing.add(headerR);

    // rear + side studs
    for (let x = 0; x <= W + 1e-6; x += studSpacing) addStud(x, D - studD / 2, 0, He - plateH);
    for (let y = 0; y <= D + 1e-6; y += studSpacing) {
      addStud(studD / 2, y, 0, He - plateH);
      addStud(W - studD / 2, y, 0, He - plateH);
    }

    // rafters
    const rafterCount = Math.floor(D / studSpacing) + 1;
    const angle = Math.atan2(rise, halfSpan);
    for (let i = 0; i < rafterCount; i++) {
      const y = i * studSpacing;
      const rL = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.089, 0.038), matWood);
      rL.rotation.z = angle; rL.position.set(W/2 - halfSpan/2, y, He + rise/2); framing.add(rL);
      const rR = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.089, 0.038), matWood);
      rR.rotation.z = -angle; rR.position.set(W/2 + halfSpan/2, y, He + rise/2); framing.add(rR);
    }

    const ridge = box(0.06, D, 0.06, matBeam);
    ridge.position.set(W/2, D/2, Hr);
    framing.add(ridge);

    // dims
    if (params.showDims) {
      addDimLine(new THREE.Vector3(0, -0.25, 0.02), new THREE.Vector3(W, -0.25, 0.02), `W = ${params.W_ft.toFixed(1)}'`);
      addDimLine(new THREE.Vector3(-0.25, 0, 0.02), new THREE.Vector3(-0.25, D, 0.02), `D = ${params.D_ft.toFixed(1)}'`);
      addDimLine(new THREE.Vector3(W + 0.25, 0.2, 0), new THREE.Vector3(W + 0.25, 0.2, He), `He = ${params.wallH_ft.toFixed(1)}'`);
    }

    framing.visible = params.showFraming;

    controls.target.set(W/2, D/2, 1.2);
    controls.update();
  }

  // UI wiring
  const wallH = document.getElementById('wallH');
  const pitch = document.getElementById('pitch');
  const stud  = document.getElementById('stud');
  const wallHVal = document.getElementById('wallHVal');
  const pitchVal = document.getElementById('pitchVal');
  const studVal  = document.getElementById('studVal');

  function sync() {
    wallHVal.textContent = Number(wallH.value).toFixed(1);
    pitchVal.textContent = Number(pitch.value).toFixed(1);
    studVal.textContent  = Number(stud.value).toFixed(0);
  }

  wallH.addEventListener('input', () => { params.wallH_ft = Number(wallH.value); sync(); build(); });
  pitch.addEventListener('input', () => { params.pitch_rise_per12 = Number(pitch.value); sync(); build(); });
  stud.addEventListener('input',  () => { params.studSpacing_in = Number(stud.value); sync(); build(); });

  document.getElementById('toggleFrame').addEventListener('click', () => {
    params.showFraming = !params.showFraming;
    framing.visible = params.showFraming;
  });
  document.getElementById('toggleDims').addEventListener('click', () => { params.showDims = !params.showDims; build(); });
  document.getElementById('resetView').addEventListener('click', () => {
    camera.position.set(6.5, -9.5, 5.5);
    controls.update();
  });

  // Start
  sync();
  build();

  // Resize
  window.addEventListener('resize', () => {
    const w = app.clientWidth, h = app.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });

  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();
})();
