/* ============================================================
   BuildMind AI — rendering engine: renderer, sky, lighting moods
   ============================================================ */

const scene3d = {
  renderer: null, scene: null, camera: null, controls: null,
  sky: null, sun: null, hemi: null, pmrem: null, envRT: null, envScene: null, envSky: null,
  ground: null, gen: 0, mount: null, ro: null, hooks: [], lighting: 'day',
  groups: null, spec: null, extras: [], interiorLights: [],
};

const LIGHTING = {
  day: {
    elev: 42, azim: 205, turbidity: 4.5, rayleigh: 1.0, mie: 0.004, mieG: 0.8,
    exposure: 0.7, sunColor: 0xfff1de, sunI: 1.8, hemiSky: 0xe8eddf, hemiGround: 0xb9ad93, hemiI: 0.6,
    fog: 0xeeeae0, fogDensity: 0.004, window: 0, lamp: 0.3, interior: 0.65, env: 0.18,
  },
  golden: {
    elev: 7, azim: 245, turbidity: 8, rayleigh: 2.4, mie: 0.006, mieG: 0.88,
    exposure: 0.8, sunColor: 0xffbf85, sunI: 2.0, hemiSky: 0xffdfb7, hemiGround: 0x93806c, hemiI: 0.65,
    fog: 0xd9a983, fogDensity: 0.0036, window: 0.55, lamp: 1.4, interior: 0.9, env: 0.8,
  },
  night: {
    elev: -8, azim: 245, turbidity: 2, rayleigh: 0.4, mie: 0.002, mieG: 0.8,
    exposure: 0.95, sunColor: 0x8da6ff, sunI: 0.4, hemiSky: 0x24324f, hemiGround: 0x0c0e14, hemiI: 0.45,
    fog: 0x0d1424, fogDensity: 0.006, window: 1.6, lamp: 2.4, interior: 1.6, env: 0.3,
    moonElev: 48, moonAzim: 150,
  },
};

const isMobileGPU = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

function disposeObject(root) {
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
  });
}

function disposeRenderer() {
  scene3d.gen++;
  if (scene3d.ro) { scene3d.ro.disconnect(); scene3d.ro = null; }
  if (scene3d.controls) { scene3d.controls.dispose(); scene3d.controls = null; }
  if (scene3d.scene) disposeObject(scene3d.scene);
  if (scene3d.envRT) { scene3d.envRT.dispose(); scene3d.envRT = null; }
  if (scene3d.pmrem) { scene3d.pmrem.dispose(); scene3d.pmrem = null; }
  if (scene3d.renderer) {
    const canvas = scene3d.renderer.domElement;
    scene3d.renderer.dispose();
    scene3d.renderer.forceContextLoss();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
  Object.assign(scene3d, { renderer: null, scene: null, camera: null, groups: null, spec: null, hooks: [], extras: [], interiorLights: [] });
}

function initRenderer(mount, opts = {}) {
  disposeRenderer();
  const myGen = scene3d.gen;
  scene3d.mount = mount;

  const w = mount.clientWidth || 800, h = mount.clientHeight || 600;
  const renderer = new THREE.WebGLRenderer({
    antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.pixelRatio || (isMobileGPU ? 1.5 : 2)));
  renderer.setSize(w, h);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.6;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xc7d3de, 0.0032);
  const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 3000);

  const sky = new THREE.Sky();
  sky.scale.setScalar(2400);
  sky.visible = false;
  scene.add(sky);

  const envScene = new THREE.Scene();
  const envSky = new THREE.Sky();
  envSky.scale.setScalar(2400);
  envScene.add(envSky);

  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  const sm = opts.shadowMap || 2048;
  sun.shadow.mapSize.set(sm, sm);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6f6a55, 0.55);
  scene.add(hemi);

  const grassMat = MatLib.plain(0xe4dfd2, { roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  scene.add(ground);

  const pmrem = new THREE.PMREMGenerator(renderer);

  let controls = null;
  if (opts.interactive) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.minDistance = 4;
    controls.maxDistance = 260;
    controls.zoomSpeed = 0.8;
    controls.rotateSpeed = 0.6;
  }

  Object.assign(scene3d, { renderer, scene, camera, controls, sky, sun, hemi, ground, pmrem, envScene, envSky, hooks: [] });

  scene3d.ro = new ResizeObserver(() => {
    const nw = mount.clientWidth, nh = mount.clientHeight;
    if (!nw || !nh) return;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
    if (opts.onResize) opts.onResize();
  });
  scene3d.ro.observe(mount);

  setLighting(opts.lighting || 'day');

  if (!opts.noLoop) {
    let last = performance.now();
    (function loop(now) {
      if (myGen !== scene3d.gen) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      scene3d.hooks.forEach(fn => fn(dt));
      if (controls && controls.enabled) controls.update();
      if (!document.hidden) renderer.render(scene, camera);
    })(last);
  }
  return scene3d;
}

function sunDirection(elevDeg, azimDeg) {
  const phi = THREE.MathUtils.degToRad(90 - elevDeg);
  const theta = THREE.MathUtils.degToRad(azimDeg);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

function setLighting(mode) {
  const L = LIGHTING[mode] || LIGHTING.day;
  scene3d.lighting = mode;
  document.body.dataset.lighting = mode;
  const { renderer, scene, sky, envSky, sun, hemi, pmrem } = scene3d;
  if (!renderer) return;

  const sunDir = sunDirection(L.elev, L.azim);
  [sky, envSky].forEach(s => {
    const u = s.material.uniforms;
    u.turbidity.value = L.turbidity;
    u.rayleigh.value = L.rayleigh;
    u.mieCoefficient.value = L.mie;
    u.mieDirectionalG.value = L.mieG;
    u.sunPosition.value.copy(sunDir);
  });

  renderer.toneMappingExposure = L.exposure;
  scene.background = new THREE.Color(L.fog);
  scene.fog.color.setHex(L.fog);
  scene.fog.density = L.fogDensity;

  const lightDir = L.moonElev != null ? sunDirection(L.moonElev, L.moonAzim) : sunDir.clone();
  if (lightDir.y < 0.12) lightDir.y = 0.12;
  lightDir.normalize();
  scene3d.lightDir = lightDir;
  sun.color.setHex(L.sunColor);
  sun.intensity = L.sunI;
  hemi.color.setHex(L.hemiSky);
  hemi.groundColor.setHex(L.hemiGround);
  hemi.intensity = L.hemiI;
  fitSunShadow();

  if (scene3d.envRT) scene3d.envRT.dispose();
  scene3d.envRT = pmrem.fromScene(scene3d.envScene, 0.02);
  scene.environment = scene3d.envRT.texture;
  applyEnvIntensity(scene, L.env);

  MatLib.setGlow(L.window, L.lamp);
  scene3d.interiorLights.forEach(l => { l.intensity = (l.userData.base || 1) * L.interior; l.visible = L.interior > 0; });
}

function applyEnvIntensity(root, k) {
  root.traverse(o => {
    const m = o.isMesh && o.material;
    if (!m || !m.isMeshStandardMaterial) return;
    if (m.userData.envBase == null) m.userData.envBase = m.envMapIntensity;
    m.envMapIntensity = m.userData.envBase * k;
  });
}

function fitSunShadow() {
  const { sun, spec } = scene3d;
  if (!sun) return;
  let cx = 0, cz = 0, r = 40;
  if (spec) {
    const b = spec.bounds;
    cx = (b.minX + b.maxX) / 2; cz = (b.minZ + b.maxZ) / 2;
    r = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.62 + 4;
  }
  const dir = scene3d.lightDir || new THREE.Vector3(0.4, 0.8, 0.3).normalize();
  sun.target.position.set(cx, 0, cz);
  sun.position.set(cx + dir.x * 140, dir.y * 140, cz + dir.z * 140);
  const cam = sun.shadow.camera;
  cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
  cam.near = 1; cam.far = 320;
  cam.updateProjectionMatrix();
}

function boundsExtent(spec) {
  const b = spec.bounds;
  return Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
}

// classic 3/4 hero view from the front-right
function heroCameraPose(spec, angle = -0.95, distMul = 1, elevMul = 1) {
  const span = Math.max(spec.W + 14, spec.D + 14, spec.wallH * 2.2);
  const r = (span * 1.18 + 10) * distMul;
  const cz = -spec.D * 0.08;
  const pos = new THREE.Vector3(Math.cos(angle) * r, (span * 0.48 + spec.wallH * 0.5) * elevMul, cz + Math.sin(angle) * r);
  const target = new THREE.Vector3(0, PLINTH + spec.wallH * 0.38, cz);
  return { pos, target };
}

function frameCamera(spec) {
  const { camera, mount, controls } = scene3d;
  camera.aspect = mount.clientWidth / mount.clientHeight;
  camera.updateProjectionMatrix();
  const { pos, target } = heroCameraPose(spec);
  pos.sub(target).multiplyScalar(Math.max(1, 1.3 / camera.aspect)).add(target);
  camera.position.copy(pos);
  if (controls) {
    controls.maxDistance = Math.max(260, pos.distanceTo(target) * 1.8);
    controls.target.copy(target); controls.update();
  } else camera.lookAt(target);
}
