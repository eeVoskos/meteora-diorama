// Low walls round school yards (plaster) and cemeteries (stone), following the terrain; one merged mesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { wall } from './landmarks/kit.js';
import { P } from './palette.js';

const HEIGHT = 1.1, THICK = 0.3, FOOT = 0.5, RUN = 8; // m
const COLOR = { school: new THREE.Color(P.monasteryPlaster), cemetery: new THREE.Color(P.monasteryStone) };

export function buildYardWalls(osm, hf) {
  const geos = [];
  for (const c of osm.cover) {
    const color = COLOR[c.k];
    if (!color) continue;
    const pts = [], n = c.p.length / 2;
    for (let i = 0; i < n; i++) {
      const [ax, ay, bx, by] = [c.p[i * 2], c.p[i * 2 + 1], c.p[((i + 1) % n) * 2], c.p[((i + 1) % n) * 2 + 1]];
      const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / RUN));
      for (let j = 0; j < k; j++) pts.push([ax + ((bx - ax) * j) / k, ay + ((by - ay) * j) / k]);
    }
    const h = pts.map(([x, y]) => hf.at(x, y)), m = pts.length;
    // Foot under each point: 0.5 m below the lower end of both segments meeting there.
    const path = pts.map(([x, y], i) => [x, y, Math.min(h[(i - 1 + m) % m], h[i], h[(i + 1) % m]) - FOOT, h[i] + HEIGHT]);
    const g = wall(path, THICK, null, true).geometry;
    const a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) a.set([color.r, color.g, color.b], i);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    geos.push(g);
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true, side: THREE.DoubleSide }));
  for (const g of geos) g.dispose();
  mesh.name = 'yard-walls';
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
