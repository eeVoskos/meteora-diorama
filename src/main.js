import { loadData, LoadError } from './data.js';
import { createScene, registerView, hasView } from './scene.js';
import { buildTerrain, setGround } from './terrain.js';
import { paintGround } from './ground.js';
import { buildBuildings } from './buildings.js';
import { buildTrees, treeDetail } from './trees.js';
import { churchPlan, MAX_SLOPE } from './rules.js';
import * as THREE from 'three';
import { buildLandmarks, landmarkSkipIds, LANDMARKS } from './landmarks/index.js';
import { createLabels } from './labels.js';
import { createCard } from './card.js';
import { withPois } from './pois.js';
import { churchIds, buildChurches } from './churches.js';
import { buildYardWalls } from './yards.js';
import { buildFountain } from './fountain.js';
import { createLife } from './life.js';
import { segmented } from './controls.js';

// Measured trees on rock walls come from height errors at cliff edges.
function offCliffs(points, hf) {
  const s = hf.step, keep = [];
  for (let i = 0; i < points.length; i += 4) {
    const x = points[i], y = points[i + 1];
    if (Math.hypot(hf.at(x + s, y) - hf.at(x, y), hf.at(x, y + s) - hf.at(x, y)) / s <= MAX_SLOPE) keep.push(x, y, points[i + 2], points[i + 3]);
  }
  return Float32Array.from(keep);
}

registerView('kastraki', { x: -330, y: 370, zoom: 700, azimuth: 230, elevation: 30 }); // village under Holy Spirit rock
registerView('town', { x: -277, y: -817, zoom: 500, azimuth: 200, elevation: 30 }); // town hall, Kalampaka centre
registerView('rocks', { x: 80, y: 1290, zoom: 650, azimuth: 165, elevation: 30 }); // Great Meteoron and Varlaam

try {
  // Probe on a throwaway canvas so the real one keeps three.js's context attributes (antialias).
  if (!document.createElement('canvas').getContext('webgl2')) {
    throw new LoadError('This browser cannot draw 3D graphics (WebGL is unavailable).');
  }
  const { hf, osm, pois, needles, trees, ground } = await loadData();
  const view = createScene(document.getElementById('view'), hf);
  view.scene.add(buildTerrain(hf, needles));
  const { renderer } = view;
  setGround(paintGround(osm, renderer.capabilities.maxTextureSize, ground), hf, renderer.capabilities.getMaxAnisotropy());

  const skip = landmarkSkipIds(osm);
  const churches = churchIds(osm, skip);
  view.scene.add(buildBuildings(osm.buildings, osm.places, hf, new Set([...skip, ...churches])));
  view.scene.add(buildLandmarks(osm, hf));
  view.scene.add(buildChurches(osm, hf, churches));
  view.scene.add(buildYardWalls(osm, hf));
  const fountain = buildFountain(osm, hf);
  if (fountain) view.scene.add(fountain);
  const osioi = osm.buildings.find((b) => b.id === 379736575); // Οσίων Μετεωριτών Πατέρων
  if (osioi) { const pl = churchPlan(osioi); registerView('church', { x: pl.cx, y: pl.cy, zoom: 90, azimuth: 210, elevation: 22 }); }

  const treePoints = offCliffs(trees, hf); // the tool that measures them caps their number
  view.scene.add(buildTrees(treePoints, hf));
  view.onBeforeRender(treeDetail);

  // Label anchors sit just above each landmark model's highest point.
  const landmarks = LANDMARKS.map((l) => ({ id: l.id, en: l.en, el: l.el, top: new THREE.Box3().setFromObject(view.scene.getObjectByName(l.key)).max.y }));
  // Every named place can be visited: landmarks and a few others have a tuned view, the rest get a plain one.
  const places = withPois(osm.places, pois);
  const viewKey = (p) => LANDMARKS.find((l) => l.id === p.id)?.key ?? p.key ?? String(p.id);
  for (const p of places) {
    if (!hasView(viewKey(p))) registerView(viewKey(p), { x: p.x, y: p.y, zoom: { town: 900, peak: 420 }[p.k] ?? 260, azimuth: 200, elevation: 30 });
  }
  const ui = document.getElementById('ui');
  const card = createCard({ go: (p) => view.setView(viewKey(p)) });
  document.getElementById('dock').prepend(card.el);
  const labels = createLabels({ places, landmarks, needles, hf, camera: () => view.camera, canvas: document.getElementById('view'), ui, card });
  view.onRender(labels.update);
  createLife({ view, hf, ui, osm });
  const lens = segmented({ en: 'View', el: 'Προβολή' }, [ // isometric (orthographic) by default
    { value: 'iso', text: { en: 'Isometric', el: 'Ισομετρική' } },
    { value: '3d', text: { en: '3D', el: '3D' }, label: { en: '3D perspective', el: '3D προοπτική' } },
  ], 'iso', (v) => view.setProjection(v === '3d'));
  lens.el.id = 'view-toggle';
  ui.prepend(lens.el);
  const params = new URLSearchParams(location.search);
  const time = segmented({ en: 'Time of day', el: 'Ώρα της ημέρας' }, [
    { value: 'dawn', text: { en: 'Dawn', el: 'Αυγή' } },
    { value: 'day', text: { en: 'Day', el: 'Μέρα' } },
    { value: 'dusk', text: { en: 'Dusk', el: 'Δύση' } },
    { value: 'night', text: { en: 'Night', el: 'Νύχτα' } },
  ], 'day', (v) => view.setTime(v));
  time.el.id = 'time-switch';
  ui.append(time.el);
  labels.setVisible(true); // pins are the way into the place cards, so they start on

  view.setView(params.get('view') ?? 'home');
  time.set(view.setTime(params.get('time'))); // draws the shadow map, now that everything is in the scene
  window.__diorama = { ...view, hf, osm, treePoints, labels };
  requestAnimationFrame(() => { document.getElementById('msg').style.display = 'none'; });
} catch (e) {
  console.error(e);
  showLoadError(e instanceof LoadError ? e.message : 'Something went wrong while building the model. Reload to try again.');
}
