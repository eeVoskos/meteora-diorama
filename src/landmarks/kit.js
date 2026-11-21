// Shared materials and shapes for the landmark modules.
// Local frame: u east, v north, y up, all in metres. three.js axes: X = u, Y = y, Z = −v.
// Every helper returns a Mesh or Group at the origin; place it with at(). "Front" means the −v (south) side
// before turning; turn is radians counter-clockwise seen from above (turn = π/2 makes the front face east).
// Materials are double-sided and flat-shaded, so triangle winding never matters.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P } from '../palette.js';

const mat = (hex, extra = {}) =>
  new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0, flatShading: true, side: THREE.DoubleSide, ...extra });

// The only materials a module may use (the placer merges meshes per material).
export const mats = {
  stone: mat(P.monasteryStone),     // rubble walls, retaining walls, towers
  plaster: mat(P.monasteryPlaster), // cream-plastered monastery wings
  white: mat(P.wall[0]),            // white render (town churches, town hall)
  cream: mat(P.wall[1]),
  ochre: mat(P.stationOchre),       // station render
  ashlar: mat(P.rockOchre),         // katholikon ochre ashlar
  brick: mat(P.roofTile[1]),        // red brick banding and arches
  pink: mat(P.stStephenDrum),       // St Stephen's painted drums
  tile: mat(P.roofTile[0]),
  tileDark: mat(P.roofTile[1]),
  tileLight: mat(P.roofTile[2]),
  lead: mat(P.leadDome),
  timber: mat(P.timber),            // galleries, balconies, doors
  concrete: mat(P.pavers),          // flat roofs, platforms, paving
  charcoal: mat(P.museumCharcoal),
  glass: mat(P.haze, { roughness: 0.3, metalness: 0.2 }),
  blueTrim: mat(P.townHallBlue),
  dark: mat(P.rockCave),            // window and door openings, iron crosses
  cypress: mat(P.cypress),
  garden: mat(P.grass),
  aqua: mat(P.fountain, { roughness: 0.4 }), // painted fountain basin and ledges
  foam: mat(P.foam, { roughness: 0.4 }),     // falling water
};

function finish(g) {
  g.deleteAttribute('uv');
  g.clearGroups();
  return g;
}
const mesh = (g, m) => new THREE.Mesh(finish(g), m);

// Positions o (Mesh or Group) at u, v with its origin at height y; returns o.
export function at(o, u, v, y = 0, turn = 0) {
  o.position.set(u, y, -v);
  o.rotation.y = turn;
  return o;
}

// Group of the given objects.
export function group(...items) {
  const g = new THREE.Group();
  for (const i of items) if (i) g.add(i);
  return g;
}

// Box w (along u) × h × d (along v), centred on u, v = 0, bottom on y = 0.
export function box(w, h, d, m) {
  return mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), m);
}

function tris(points, m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}
const V = (u, v, y) => [u, y, -v];

// Hipped roof over a w × d footprint centred on the origin; eaves at y = 0, ridge `rise` above, along the longer side.
// w = d gives a pyramid (tower roofs). overhang in m beyond the walls on every side.
export function hipRoof(w, d, rise, m, overhang = 0.4) {
  const W = w + 2 * overhang, D = d + 2 * overhang, swap = D > W;
  const L = swap ? D : W, S = swap ? W : D, R = (L - S) / 2;
  const p = (a, b, h) => (swap ? V(b, a, h) : V(a, b, h));
  const A = p(-L / 2, -S / 2, 0), B = p(L / 2, -S / 2, 0), C = p(L / 2, S / 2, 0), D4 = p(-L / 2, S / 2, 0);
  const E = p(-R, 0, rise), F = p(R, 0, rise);
  return tris([A, B, F, A, F, E, B, C, F, C, D4, E, C, E, F, D4, A, E, A, C, B, A, D4, C], m);
}

// Gable roof over w × d, ridge along u; eaves at y = 0. With gableMat, the two end triangles are filled
// (at u = ±w/2) in that material and the result is a Group.
export function gableRoof(w, d, rise, m, overhang = 0.4, gableMat = null) {
  const W = w + 2 * overhang, D = d + 2 * overhang;
  const A = V(-W / 2, -D / 2, 0), B = V(W / 2, -D / 2, 0), C = V(W / 2, D / 2, 0), D4 = V(-W / 2, D / 2, 0);
  const E = V(-W / 2, 0, rise), F = V(W / 2, 0, rise);
  const roof = tris([A, B, F, A, F, E, C, D4, E, C, E, F], m);
  if (!gableMat) return roof;
  // Gable triangles sit in the wall planes, just under the overhanging slopes.
  const g1 = [V(-w / 2, -d / 2, 0), V(-w / 2, d / 2, 0), V(-w / 2, 0, rise)];
  const g2 = [V(w / 2, -d / 2, 0), V(w / 2, d / 2, 0), V(w / 2, 0, rise)];
  return group(roof, tris([...g1, ...g2], gableMat));
}

// Hemispherical dome of radius r, base circle on y = 0. sides = facets around (12 for Great Meteoron's dome).
export function dome(r, m, sides = 12, rings = 4) {
  return mesh(new THREE.SphereGeometry(r, sides, rings, 0, Math.PI * 2, 0, Math.PI / 2), m);
}

// Polygonal drum (prism) of radius r and height h, bottom on y = 0.
export function drum(r, h, sides, m) {
  return mesh(new THREE.CylinderGeometry(r, r, h, sides, 1, false).translate(0, h / 2, 0), m);
}

// Cone (conical or pyramidal roof, spire, kiosk cap) of base radius r, height h, base on y = 0.
export function cone(r, h, sides, m) {
  return mesh(new THREE.ConeGeometry(r, h, sides, 1, false).translate(0, h / 2, 0), m);
}

// Half-round apse bulging toward +u from the wall plane u = 0, walls h tall on y = 0, capped with a
// half-cone roof in roofMat. Turn it to face where the sanctuary is (apses usually face east, turn 0).
export function apse(r, h, m, roofMat = mats.tile, sides = 7) {
  const wall = mesh(new THREE.CylinderGeometry(r, r, h, sides, 1, false, 0, Math.PI).translate(0, h / 2, 0), m);
  const rise = r * 0.45;
  const cap = mesh(new THREE.ConeGeometry(r + 0.3, rise, sides, 1, false, 0, Math.PI).translate(0, h + rise / 2, 0), roofMat);
  return group(wall, cap);
}

// Wall `length` long along u with `bays` round-arched openings from the floor; h tall on y = 0, depth thick
// (centred on v = 0). Use it as the front of a loggia, a porch or an arcaded terrace wall.
export function arcade(length, h, bays, m, depth = 0.5) {
  const bw = length / bays, ow = Math.min(bw * 0.64, (h - 0.5) / 1.3), r = ow / 2, sh = Math.min(h * 0.55, h - r - 0.4);
  const s = new THREE.Shape();
  s.moveTo(-length / 2, h);
  s.lineTo(-length / 2, 0);
  for (let i = 0; i < bays; i++) {
    const xc = -length / 2 + (i + 0.5) * bw;
    s.lineTo(xc - r, 0);
    s.lineTo(xc - r, sh);
    for (let k = 1; k < 6; k++) s.lineTo(xc - r * Math.cos((k * Math.PI) / 6), sh + r * Math.sin((k * Math.PI) / 6));
    s.lineTo(xc + r, sh);
    s.lineTo(xc + r, 0);
  }
  s.lineTo(length / 2, 0);
  s.lineTo(length / 2, h);
  return mesh(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -depth / 2), m);
}

// Upright prism over a ring [[u, v], …] (not closed), bottom on y = 0, h tall.
export function prism(ring, h, m) {
  const s = new THREE.Shape(ring.map(([u, v]) => new THREE.Vector2(u, v)));
  return mesh(new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2), m);
}

// Wall along a path [[u, v, y0, y1], …]: thick m wide, centred on the path, from y0 up to y1 at each point
// (heights are absolute in the site frame, so it can step down a slope). closed joins the last point to the first.
export function wall(path, thick, m, closed = false) {
  const n = path.length, off = [];
  for (let i = 0; i < n; i++) {
    const p = path[i], a = path[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)], b = path[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
    const d1 = norm2(p[0] - a[0], p[1] - a[1]) ?? norm2(b[0] - p[0], b[1] - p[1]);
    const d2 = norm2(b[0] - p[0], b[1] - p[1]) ?? d1;
    let mx = -(d1[1] + d2[1]), my = d1[0] + d2[0];
    const l = Math.hypot(mx, my) || 1;
    mx /= l; my /= l;
    const k = Math.max(0.5, mx * -d1[1] + my * d1[0]); // mitre, limited at sharp corners
    off.push([(mx * thick) / 2 / k, (my * thick) / 2 / k]);
  }
  const pts = [];
  const corner = (i, side, top) => V(path[i][0] + side * off[i][0], path[i][1] + side * off[i][1], top ? path[i][3] : path[i][2]);
  const quad = (a, b, c, d) => pts.push(a, b, c, a, c, d);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const j = (i + 1) % n;
    for (const s of [1, -1]) quad(corner(i, s, 0), corner(j, s, 0), corner(j, s, 1), corner(i, s, 1));
    quad(corner(i, 1, 1), corner(j, 1, 1), corner(j, -1, 1), corner(i, -1, 1));
  }
  if (!closed) for (const i of [0, n - 1]) quad(corner(i, 1, 0), corner(i, -1, 0), corner(i, -1, 1), corner(i, 1, 1));
  return tris(pts, m);
}
function norm2(x, y) {
  const l = Math.hypot(x, y);
  return l > 1e-6 ? [x / l, y / l] : null;
}

// Straight stair flight climbing toward +u from (0, 0) to (run, rise), width along v, solid down to `below` m
// under its foot (raise it for a stair built against a cliff so the outer edge never floats).
export function stairs(run, rise, width, steps, m, below = 2) {
  const sr = run / steps, sh = rise / steps, s = new THREE.Shape();
  s.moveTo(0, -below);
  s.lineTo(run, -below);
  s.lineTo(run, rise);
  for (let k = steps - 1; k >= 0; k--) { s.lineTo(k * sr, (k + 1) * sh); s.lineTo(k * sr, k * sh); }
  return mesh(new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -width / 2), m);
}

// Balcony or gallery `length` along u projecting `depth` to the front (−v) from v = 0; floor at y = 0, solid rail railH tall.
export function balcony(length, depth, m, railH = 1) {
  return group(
    at(box(length, 0.25, depth, m), 0, -depth / 2, -0.25),
    at(box(length, railH, 0.12, m), 0, -depth + 0.06, 0),
    at(box(0.12, railH, depth, m), -length / 2 + 0.06, -depth / 2, 0),
    at(box(0.12, railH, depth, m), length / 2 - 0.06, -depth / 2, 0),
  );
}

// Footbridge `length` along u, `width` across; deck top on y = 0, 0.6 m thick, with parapets parapetH tall.
export function bridge(length, width, m, parapetH = 1) {
  return group(
    at(box(length, 0.6, width, m), 0, 0, -0.6),
    at(box(length, parapetH, 0.3, m), 0, -width / 2 + 0.15, 0),
    at(box(length, parapetH, 0.3, m), 0, width / 2 - 0.15, 0),
  );
}

// Latin cross h tall standing on y = 0 (finial for domes and gables).
export function cross(h, m = mats.dark) {
  const t = Math.max(0.12, h * 0.08);
  return group(box(t, h, t, m), at(box(h * 0.55, t, t, m), 0, 0, h * 0.62));
}

// Cypress h tall on y = 0.
export function cypress(h, m = mats.cypress) {
  return mesh(new THREE.ConeGeometry(h * 0.13, h, 6, 1, false).translate(0, h / 2, 0), m);
}

// Row of n flat window panes (w × h, 2 triangles each) along u, `spacing` apart, centred on u = 0, bottoms on
// y = 0, lying in the plane v = −gap (just in front of a wall face at v = 0).
export function windows(n, spacing, w, h, m = mats.dark, gap = 0.06) {
  const gs = [];
  for (let i = 0; i < n; i++) gs.push(new THREE.PlaneGeometry(w, h).translate((i - (n - 1) / 2) * spacing, h / 2, gap));
  return mesh(mergeGeometries(gs.map(finish)), m);
}

// Narrow window panes (w × h, bottoms on y = 0) on every face of a drum(r, …, sides) — each face gets one.
export function drumWindows(r, sides, w, h, m = mats.dark) {
  const a = r * Math.cos(Math.PI / sides) + 0.05, gs = [];
  for (let k = 0; k < sides; k++) {
    const t = ((k + 0.5) * 2 * Math.PI) / sides;
    gs.push(new THREE.PlaneGeometry(w, h).translate(0, h / 2, a).rotateY(t));
  }
  return mesh(mergeGeometries(gs.map(finish)), m);
}

// Lowest and highest ground (site frame) under a w × d rectangle centred on u, v, turned `turn`.
export function groundRange(site, u, v, w, d, turn = 0) {
  const c = Math.cos(turn), s = Math.sin(turn);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 3; i++) for (let j = 0; j <= 3; j++) {
    const a = (i / 3 - 0.5) * w, b = (j / 3 - 0.5) * d;
    const g = site.ground(u + a * c - b * s, v + a * s + b * c);
    if (g < lo) lo = g; if (g > hi) hi = g;
  }
  return { lo, hi };
}

// A plain building on uneven ground: walls w × d from 1 m below the lowest ground under it up to `h` above the
// highest, then a roof ('hip' | 'gable' | 'flat'; rise defaults to 0.3 × the short side, max 3.5 m).
// winSpacing > 0 adds window rows (one per 3 m storey) on both long faces. Returns a Group placed at u, v
// with userData.top = eave height and userData.bottom = wall foot, in the site frame.
export function block(site, { u, v, w, d, h, turn = 0, wallMat = mats.plaster, roofMat = mats.tile, roof = 'hip', rise, overhang = 0.5, winSpacing = 0 }) {
  const { lo, hi } = groundRange(site, u, v, w, d, turn);
  const y0 = lo - 1, top = hi + h;
  const g = group(at(box(w, top - y0, d, wallMat), 0, 0, y0));
  const r = rise ?? Math.min(0.3 * Math.min(w, d), 3.5);
  if (roof === 'hip') g.add(at(hipRoof(w, d, r, roofMat, overhang), 0, 0, top));
  else if (roof === 'gable') g.add(at(gableRoof(w, d, r, roofMat, overhang, wallMat), 0, 0, top));
  else g.add(at(box(w + 0.3, 0.5, d + 0.3, roofMat), 0, 0, top));
  if (winSpacing > 0) {
    const long = w >= d, len = long ? w : d, depth = long ? d : w;
    const n = Math.max(1, Math.floor((len - 2) / winSpacing)), rows = Math.max(1, Math.floor(h / 3));
    for (let k = 0; k < rows; k++) for (const side of [0, Math.PI]) {
      const row = windows(n, winSpacing, 0.8, 1.2);
      at(row, 0, 0, top - 2.2 - 3 * k, side + (long ? 0 : Math.PI / 2));
      row.position.add(new THREE.Vector3(0, 0, depth / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), row.rotation.y));
      g.add(row);
    }
  }
  g.userData.top = top;
  g.userData.bottom = y0;
  return at(g, u, v, 0, turn);
}

// Ring [[u, v], …] keeping only points at least minLen from the last kept one (fewer wall segments).
export function simplify(ring, minLen) {
  const out = [ring[0]];
  for (const p of ring.slice(1)) {
    const q = out[out.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= minLen) out.push(p);
  }
  const f = out[0], l = out[out.length - 1];
  if (out.length > 3 && Math.hypot(f[0] - l[0], f[1] - l[1]) < minLen) out.pop();
  return out;
}

// Ring moved outward by d metres (negative d moves it inward), mitred at each corner.
export function offsetRing(ring, d) {
  const n = ring.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const [a, b] = ring[i], [c, e] = ring[(i + 1) % n]; area += a * e - c * b; }
  const out = Math.sign(area) || 1; // counter-clockwise rings have their outside on the right
  return ring.map((p, i) => {
    const a = ring[(i - 1 + n) % n], b = ring[(i + 1) % n];
    const d1 = norm2(p[0] - a[0], p[1] - a[1]) ?? [1, 0], d2 = norm2(b[0] - p[0], b[1] - p[1]) ?? d1;
    let mx = d1[1] + d2[1], my = -(d1[0] + d2[0]);
    const l = Math.hypot(mx, my) || 1;
    mx /= l; my /= l;
    const k = Math.max(0.5, mx * d1[1] - my * d1[0]);
    return [p[0] + (out * mx * d) / k, p[1] + (out * my * d) / k];
  });
}
