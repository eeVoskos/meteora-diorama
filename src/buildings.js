import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P } from './palette.js';
import { ringArea, centroid, pointInRing, orientedBox, mulberry32, hash01 } from './geom.js';
import { zoneOf, buildingLevels, roofKind, seatHeights } from './rules.js';

const OVERHANG = 0.4;   // m of eave beyond the walls
const PITCH = 0.3;      // roof rise as a share of the short side
const MAX_RISE = 3.5;   // m
const PARAPET = 0.5;    // m tall
const PARAPET_W = 0.4;  // m inset of the flat slab from the wall face

const col = (hex) => new THREE.Color(hex);
const WALLS = [
  ...P.wall.map(col),
  // Minority tints from the sheet's "occasional ochre or pastel": cream pulled toward the station ochre / St Stephen pink.
  col(P.wall[1]).lerp(col(P.stationOchre), 0.45),
  col(P.wall[0]).lerp(col(P.stStephenDrum), 0.3),
];
const TILES = P.roofTile.map(col);
const FLAT = col(P.flatRoof);
const SCHOOL = col(P.wall[1]).lerp(col(P.stationOchre), 0.6); // pale yellow-ochre institutional render

function pickWall(r) { return r < 0.55 ? WALLS[0] : r < 0.88 ? WALLS[1] : r < 0.95 ? WALLS[2] : WALLS[3]; }
function pickTile(r) { return r < 0.5 ? TILES[0] : r < 0.85 ? TILES[1] : TILES[2]; }

const material = (opts) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...opts });

function shapeOf(p, holes = []) {
  const pts = (r) => { const v = []; for (let i = 0; i < r.length; i += 2) v.push(new THREE.Vector2(r[i], r[i + 1])); return v; };
  const s = new THREE.Shape(pts(p));
  for (const h of holes) s.holes.push(new THREE.Path(pts(h)));
  return s;
}

// Shape in the (x, y) plane extruded `depth` up from `y0`, turned into world axes (X = x, Y = up, Z = −y).
function prism(shape, y0, depth, color) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  g.deleteAttribute('uv');
  g.clearGroups();
  return paint(g, color);
}

function paint(g, c) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// Ring moved inward by d along each edge's normal (mitred); null when that breaks the ring.
function inset(p, d) {
  const n = p.length / 2, s = Math.sign(ringArea(p)), out = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = [p[((i - 1 + n) % n) * 2], p[((i - 1 + n) % n) * 2 + 1]];
    const [bx, by] = [p[i * 2], p[i * 2 + 1]];
    const [cx, cy] = [p[((i + 1) % n) * 2], p[((i + 1) % n) * 2 + 1]];
    const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by);
    if (l1 < 1e-6 || l2 < 1e-6) return null;
    // Inward normals (left of the edge for a counter-clockwise ring).
    const n1 = [-(by - ay) / l1 * s, (bx - ax) / l1 * s], n2 = [-(cy - by) / l2 * s, (cx - bx) / l2 * s];
    const mx = n1[0] + n2[0], my = n1[1] + n2[1], k = (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    if (k < 0.3) return null; // spike: the mitre would shoot off
    out.push(bx + (mx / k) * d, by + (my / k) * d);
  }
  const a0 = Math.abs(ringArea(p)), a1 = ringArea(out) * s;
  if (a1 < 0.4 * a0) return null;
  for (let i = 0; i < out.length; i += 2) if (!pointInRing(out[i], out[i + 1], p)) return null;
  return out;
}

// Hipped roof on the footprint's oriented box: two trapezoids, two hip triangles and a soffit underneath.
function hipRoof(box, y0, color) {
  const W = box.w + 2 * OVERHANG, D = box.d + 2 * OVERHANG;
  const rise = Math.min(PITCH * box.d, MAX_RISE), R = (W - D) / 2;
  const c = Math.cos(box.angle), s = Math.sin(box.angle);
  const v = (u, w, h) => [box.cx + u * c - w * s, y0 + h, -(box.cy + u * s + w * c)];
  const A = v(-W / 2, -D / 2, 0), B = v(W / 2, -D / 2, 0), C = v(W / 2, D / 2, 0), Dd = v(-W / 2, D / 2, 0);
  const E = v(-R, 0, rise), F = v(R, 0, rise);
  const tris = [A, B, F, A, F, E, B, C, F, C, Dd, E, C, E, F, Dd, A, E, A, C, B, A, Dd, C];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return paint(g, color);
}

export function buildBuildings(buildings, places, hf, skipIds = new Set()) {
  const walls = [], tiles = [], flats = [];
  let skipped = 0, cliffHouses = 0, firstError;
  for (const b of buildings) {
    if (skipIds.has(b.id)) continue;
    try {
      const [cx, cy] = centroid(b.p);
      let lo = hf.at(cx, cy), hi = lo;
      for (let i = 0; i < b.p.length; i += 2) {
        const h = hf.at(b.p[i], b.p[i + 1]);
        if (h < lo) lo = h; if (h > hi) hi = h;
      }
      if (b.t === 'roof') { // canopy (OSM building=roof): a thin slab 4 m above the highest ground, no walls
        const g = prism(shapeOf(b.p, b.h), hi + 3.6, 0.4, FLAT);
        if (!g.attributes.position.count) throw new Error('empty geometry');
        flats.push(g);
        continue;
      }
      const zone = zoneOf(cx, cy, places);
      const { base, top } = seatHeights(lo, hi, hf.at(cx, cy), buildingLevels(b, zone));
      if (hi - lo > 8) cliffHouses++;
      const rnd = mulberry32(Math.floor(hash01(b.id) * 4294967296));
      const wall = b.t === 'school' ? (rnd(), SCHOOL) : pickWall(rnd()), tile = pickTile(rnd());
      const out = [];
      out.push([walls, prism(shapeOf(b.p, b.h), base, top - base, wall)]);
      if (roofKind(b, zone) === 'hip') {
        const box = orientedBox(b.p);
        if (!(box.w > 0.5 && box.d > 0.5)) throw new Error('degenerate footprint');
        out.push([tiles, hipRoof(box, top, tile)]);
      } else {
        const inner = inset(b.p, PARAPET_W);
        if (inner) {
          const rim = shapeOf(b.p, [inner]);
          out.push([walls, prism(rim, top, PARAPET, wall)]);
          out.push([flats, prism(shapeOf(inner, b.h), top, 0.1, FLAT)]);
        } else {
          out.push([flats, prism(shapeOf(b.p, b.h), top, 0.1, FLAT)]); // shortcut: no parapet when the inset fails
        }
      }
      for (const g of out) if (!g[1].attributes.position.count) throw new Error('empty geometry');
      for (const [list, g] of out) list.push(g);
    } catch (e) {
      if (!skipped++) firstError = e.message;
    }
  }
  console.info(`cliff-seated houses: ${cliffHouses}`);
  console.info(`buildings skipped: ${skipped}${skipped ? ` (first: ${firstError})` : ''}`);

  const group = new THREE.Group();
  group.name = 'buildings';
  for (const [list, name] of [[walls, 'walls'], [tiles, 'tile-roofs'], [flats, 'flat-roofs']]) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(list), material({}));
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    for (const g of list) g.dispose();
  }
  return group;
}
