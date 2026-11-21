import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { P } from './palette.js';

const BASE = 1000;       // frustum height in metres at camera.zoom = 1, so zoom = BASE / visible extent
const DIST = 8000;       // camera distance from its target (orthographic, so only clipping and fog care)
const HOME_ELEVATION = 35;
const FLOOR = 6;         // m the 3D camera keeps above the ground
const FOV = 40;          // vertical field of view of the perspective ("3D") camera, degrees
const deg = THREE.MathUtils.degToRad;

// Times of day: where the sun (or moon) stands, its light, the sky's fill light [sky, ground, strength], the sky
// from top to horizon, and the haze colour. Azimuth is a compass bearing, elevation degrees above the horizon.
const TIMES = {
  dawn: { az: 82, el: 17, sun: ['#FFD0A6', 2.9], fill: ['#C2CCE6', '#9A8B70', 1.0], sky: ['#8AA6D8', '#F7D3B2'], fog: '#DCC9C4' },
  day: { az: 135, el: 45, sun: ['#fff6e8', 2.6], fill: [P.sky, P.scrub, 1.1], sky: [P.sky, '#DCE9F3'], fog: null }, // fog: see createScene
  dusk: { az: 278, el: 16, sun: ['#FFB07A', 3.1], fill: ['#C9BBDA', '#8E7862', 1.0], sky: ['#7A90CC', '#F5B488'], fog: '#D2B3AC' },
  night: { az: 205, el: 48, sun: ['#A9BEF0', 0.85], fill: ['#3A4C80', '#1A2236', 0.75], sky: ['#0D1530', '#2B3B68'], fog: '#1C2748' },
};

const views = new Map(); // key -> { x, y, zoom, azimuth, elevation? }

// Later tasks add named views. x, y local metres; zoom = visible vertical extent in metres;
// azimuth = compass bearing the camera looks from (225 = from the south-west);
// elevation = optional degrees above the horizon (default HOME_ELEVATION).
export function registerView(key, view) {
  views.set(key, view);
}
export const hasView = (key) => views.has(key);

// hf is needed so views can sit on the ground (target height = hf.at(x, y)) and the block can be fitted.
export function createScene(canvas, hf) {
  const half = { x: (hf.nx - 1) * hf.step / 2, y: (hf.ny - 1) * hf.step / 2 };
  const centre = { x: hf.x0 + half.x, y: hf.y0 + half.y };
  const bottom = hf.min - 60, midY = (hf.min + hf.max) / 2;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // static scene: redraw the shadow map only on request (updateShadows)

  const scene = new THREE.Scene();
  const dayFog = new THREE.Color(P.sky).lerp(new THREE.Color('#ffffff'), 0.55);
  scene.fog = new THREE.Fog(dayFog, DIST - 1500, DIST + 14000);

  // Lights: a sun and a sky-coloured hemisphere fill; setTime() below places and colours them.
  const fill = new THREE.HemisphereLight();
  scene.add(fill);
  const sun = new THREE.DirectionalLight();
  sun.target.position.set(centre.x, midY, -centre.y);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const radius = Math.hypot(half.x, half.y, hf.max - bottom);
  Object.assign(sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 4000 - radius, far: 4000 + radius });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 1.5;
  scene.add(sun, sun.target);

  const camera = new THREE.OrthographicCamera(-BASE / 2, BASE / 2, BASE / 2, -BASE / 2, 1, DIST * 3);
  const controls = new OrbitControls(camera, canvas);
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.minPolarAngle = deg(20);
  controls.maxPolarAngle = deg(80);
  controls.maxZoom = BASE / 60; // about 60 m fills the view

  // The same scene through a perspective lens: the "3D" mode. The orbit controls drive whichever camera is in
  // use (`cam`). A view is described by its extent (metres visible top to bottom at the orbit target), which is
  // the orthographic zoom on one camera and the distance from the target on the other.
  const persp = new THREE.PerspectiveCamera(FOV, 1, 5, DIST * 4);
  const tanHalf = Math.tan(deg(FOV / 2));
  let cam = camera;

  const hooks = []; // called after every drawn frame (labels follow the camera)
  const before = []; // called before every drawn frame with the ground size of one screen pixel, in metres
  // Metres per pixel at the nearest ground in view: the orthographic extent, or for the 3D camera its distance
  // to the orbit point or its own height above the ground, whichever is smaller.
  const metresPerPixel = () => (cam === persp
    ? 2 * tanHalf * Math.min(cam.position.distanceTo(controls.target), Math.max(1, cam.position.y - hf.at(cam.position.x, -cam.position.z)))
    : BASE / camera.zoom) / (canvas.clientHeight || 1);
  const draw = (mpp) => { for (const f of before) f(mpp); renderer.render(scene, cam); for (const f of hooks) f(); };
  const render = () => draw(metresPerPixel());

  // Per-frame callbacks f(dt seconds, t seconds). While at least one is registered the scene redraws every
  // frame; with none it goes back to drawing only on demand. animate() returns the function that removes f.
  const frames = new Set();
  let last = 0, raf = 0, queued = false;
  // Pointer events can arrive several times per frame; drawing once per frame is enough.
  const requestRender = () => {
    if (queued || raf) return; // the animation loop, when running, draws every frame anyway
    queued = true;
    requestAnimationFrame(() => { queued = false; render(); });
  };
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const f of frames) f(dt, now / 1000);
    render();
    raf = frames.size ? requestAnimationFrame(tick) : 0;
  }
  function animate(f) {
    frames.add(f);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    return () => frames.delete(f);
  }
  const updateShadows = () => { renderer.shadowMap.needsUpdate = true; draw(0); }; // 0: the shadow map is drawn from the detailed tree shapes

  // Sets the light for a time of day (a key of TIMES; anything else means day), redraws the shadows and returns the key used.
  function setTime(key) {
    if (!TIMES[key]) key = 'day';
    const t = TIMES[key], a = deg(t.az), e = deg(t.el);
    sun.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(4000).add(sun.target.position);
    sun.color.set(t.sun[0]); sun.intensity = t.sun[1];
    fill.color.set(t.fill[0]); fill.groundColor.set(t.fill[1]); fill.intensity = t.fill[2];
    scene.background?.dispose();
    scene.background = skyGradient(t.sky);
    scene.fog.color.set(t.fog ?? dayFog);
    document.documentElement.dataset.time = key; // the page title turns light at night
    updateShadows();
    return key;
  }
  canvas.addEventListener('webglcontextrestored', updateShadows);

  // Keep the orbit target inside the block; shift the camera with it so the angle is unchanged.
  const lo = new THREE.Vector3(centre.x - half.x, bottom, -(centre.y + half.y));
  const hi = new THREE.Vector3(centre.x + half.x, hf.max, -(centre.y - half.y));
  const delta = new THREE.Vector3();
  controls.screenSpacePanning = false; // panning slides across the ground like a map; it never sinks the view into it
  controls.addEventListener('change', () => {
    delta.copy(controls.target).clamp(lo, hi);
    delta.y = Math.max(delta.y, hf.at(delta.x, -delta.z)); // the point the view turns about is never under the ground
    delta.sub(controls.target);
    if (delta.lengthSq() > 0) { controls.target.add(delta); cam.position.add(delta); }
    if (cam === persp) { // the 3D camera stays above the terrain it is over (and above the block's rim outside it)
      const floor = hf.at(cam.position.x, -cam.position.z) + FLOOR;
      if (cam.position.y < floor) { cam.position.y = floor; cam.lookAt(controls.target); }
    }
    requestRender();
  });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // the window may have moved to another display
    renderer.setSize(w, h, false);
    const aspect = w / h; // keep the vertical extent, widen or narrow the sides
    camera.left = -BASE / 2 * aspect; camera.right = BASE / 2 * aspect;
    camera.top = BASE / 2; camera.bottom = -BASE / 2;
    // Zoomed fully out, the block's bounding sphere fits in either direction.
    controls.minZoom = Math.min(BASE / (2.2 * radius * Math.max(1, 1 / aspect)), controls.maxZoom);
    camera.zoom = THREE.MathUtils.clamp(camera.zoom, controls.minZoom, controls.maxZoom);
    camera.updateProjectionMatrix();
    persp.aspect = aspect;
    persp.updateProjectionMatrix();
    limits();
    render();
  }

  // Distance limits apply to the perspective camera only: OrbitControls would also clamp the orthographic
  // camera's (meaningless) distance with them.
  function limits() {
    const p = cam === persp;
    controls.minDistance = p ? BASE / controls.maxZoom / (2 * tanHalf) : 0;
    controls.maxDistance = p ? 1.15 * BASE / controls.minZoom / (2 * tanHalf) : Infinity;
    controls.maxPolarAngle = deg(p ? 88 : 80); // the 3D view may look almost level, up at the rocks
  }
  resize();

  new ResizeObserver(resize).observe(canvas);

  function place(target, azimuth, elevation) {
    const a = deg(azimuth), e = deg(elevation);
    controls.target.copy(target);
    for (const c of [camera, persp]) {
      c.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(DIST).add(target);
      c.lookAt(target);
      c.updateMatrixWorld();
    }
  }

  // Shows `extent` metres top to bottom at the orbit target, on both cameras, within the zoom limits.
  function setExtent(extent) {
    camera.zoom = THREE.MathUtils.clamp(BASE / extent, controls.minZoom, controls.maxZoom);
    camera.updateProjectionMatrix();
    persp.position.sub(controls.target).setLength(BASE / camera.zoom / (2 * tanHalf)).add(controls.target);
  }

  // Switches between the isometric (orthographic) and the 3D (perspective) camera, keeping the target, the
  // direction and the extent, so the picture changes lens but not place.
  function setProjection(perspective) {
    const next = perspective ? persp : camera;
    if (next === cam) return;
    const offset = cam.position.clone().sub(controls.target);
    const extent = cam === camera ? BASE / camera.zoom : 2 * offset.length() * tanHalf;
    cam = next;
    cam.position.copy(offset.setLength(DIST)).add(controls.target);
    controls.object = cam;
    limits();
    setExtent(extent);
    cam.lookAt(controls.target);
    controls.update();
    render();
  }

  // Vertical extent that fits the whole block (with skirts) for the current aspect, plus a margin.
  function fitExtent() {
    const p = new THREE.Vector3();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const x of [lo.x, hi.x]) for (const y of [lo.y, hi.y]) for (const z of [lo.z, hi.z]) {
      p.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const aspect = (camera.right - camera.left) / (camera.top - camera.bottom);
    return Math.max(maxY - minY, (maxX - minX) / aspect) * 1.06;
  }

  function setView(key) {
    let view = views.get(key);
    if (!view) {
      if (key !== 'home') console.warn(`Unknown view "${key}", showing home.`);
      view = null;
    }
    if (view) {
      place(new THREE.Vector3(view.x, hf.at(view.x, view.y), -view.y), view.azimuth, view.elevation ?? HOME_ELEVATION);
      setExtent(view.zoom);
    } else {
      place(new THREE.Vector3(centre.x, midY, -centre.y), 225, HOME_ELEVATION);
      setExtent(fitExtent() * (cam === persp ? 1.15 : 1)); // perspective swells the near corners: step back a little
    }
    controls.update();
    render(); // 'change' does not fire when only the zoom differs
  }

  return { scene, get camera() { return cam; }, controls, renderer, sun, setView, setProjection, setTime, render, updateShadows, onRender: (f) => hooks.push(f), onBeforeRender: (f) => before.push(f), animate };
}

function skyGradient([top, horizon]) {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, horizon); // haze at the horizon
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
