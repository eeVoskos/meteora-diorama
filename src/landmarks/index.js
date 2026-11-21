// Landmark placement: builds each module in its site frame, merges it per material and puts it on the terrain.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { centroid, orientedBox, pointInRing } from '../geom.js';
import { registerView } from '../scene.js';
import * as kit from './kit.js';
import { LANDMARKS as META, landmarkRing, landmarkSkipIds } from './registry.js';
import * as greatMeteoron from './great-meteoron.js';
import * as varlaam from './varlaam.js';
import * as roussanou from './roussanou.js';
import * as stNicholas from './st-nicholas.js';
import * as holyTrinity from './holy-trinity.js';
import * as stStephen from './st-stephen.js';
import * as dormition from './dormition.js';
import * as agiosVissarion from './agios-vissarion.js';
import * as agiosKonstantinos from './agios-konstantinos.js';
import * as townHall from './town-hall.js';
import * as station from './station.js';
import * as museum from './museum.js';

const MODULES = {
  'great-meteoron': greatMeteoron, varlaam, roussanou, 'st-nicholas': stNicholas, 'holy-trinity': holyTrinity,
  'st-stephen': stStephen, dormition, 'agios-vissarion': agiosVissarion, 'agios-konstantinos': agiosKonstantinos,
  'town-hall': townHall, station, museum,
};

export const LANDMARKS = META.map((l) => ({ ...l, build: MODULES[l.key].build }));
export { landmarkSkipIds };

const ALLOWED = new Set(Object.values(kit.mats));

// Site handed to every module: ring and box in the local frame (origin at the outline centroid, u east, v north),
// base = median terrain height under the outline (m a.s.l.), ground(u, v) = terrain height relative to base.
function siteFor(l, osm, hf) {
  const { ring: flat } = landmarkRing(l, osm);
  const [cx, cy] = centroid(flat);
  const ring = [];
  for (let i = 0; i < flat.length; i += 2) ring.push([flat[i] - cx, flat[i + 1] - cy]);
  const { w, d, angle } = orientedBox(flat);
  const hs = [];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [u, v] of ring) { x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
  const step = Math.max(2, Math.max(x1 - x0, y1 - y0) / 40);
  for (let u = x0; u <= x1; u += step) for (let v = y0; v <= y1; v += step)
    if (pointInRing(u + cx, v + cy, flat)) hs.push(hf.at(u + cx, v + cy));
  if (!hs.length) for (const [u, v] of ring) hs.push(hf.at(u + cx, v + cy));
  hs.sort((a, b) => a - b);
  const base = hs[hs.length >> 1];
  return { cx, cy, site: { ring, box: { w, d, angle }, base, ground: (u, v) => hf.at(u + cx, v + cy) - base } };
}

const placeholder = (site) => kit.group(kit.prism(site.ring, 6, kit.mats.plaster));

// One mesh per material; throws if the module used anything outside kit.mats or produced nothing.
export function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const byMat = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!ALLOWED.has(o.material)) throw new Error('material not from kit.mats');
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    g.applyMatrix4(o.matrixWorld);
    g.computeVertexNormals();
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  if (!byMat.size) throw new Error('no meshes');
  const out = new THREE.Group();
  let triangles = 0;
  for (const [m, list] of byMat) {
    const merged = mergeGeometries(list);
    if (!merged) throw new Error('merge failed');
    for (const g of list) g.dispose();
    triangles += merged.attributes.position.count / 3;
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = mesh.receiveShadow = true;
    out.add(mesh);
  }
  out.userData.triangles = triangles;
  return out;
}

export function buildLandmarks(osm, hf) {
  const all = new THREE.Group();
  all.name = 'landmarks';
  for (const l of LANDMARKS) {
    const { cx, cy, site } = siteFor(l, osm, hf);
    let g;
    try {
      g = mergeByMaterial(l.build(kit, site));
    } catch (e) {
      console.error(`landmark failed: ${l.key}: ${e.message}`);
      g = mergeByMaterial(placeholder(site));
    }
    g.name = l.key;
    g.position.set(cx, site.base, -cy);
    g.userData.site = site;
    all.add(g);
    registerView(l.key, { x: cx, y: cy, zoom: Math.min(320, Math.max(140, 1.6 * Math.max(site.box.w, site.box.d))), azimuth: 200, elevation: 28, ...l.view });
  }
  return all;
}
