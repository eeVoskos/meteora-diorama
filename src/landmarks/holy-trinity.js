// Holy Trinity (Agia Triada) on its isolated pillar above Kalampaka — reference sheet section 1.
// The buildings follow the one big mapped footprint (OSM 1064663873), a chevron on the east of the summit: a
// two-storey cell and guest range along its south arm (arcaded loggia and timber balcony facing the town), the
// small domed katholikon against its court side, the refectory range up the east arm, a gatehouse on the east
// face with the round chapel of St John the Baptist just inside, and a parapet along the north-west cliff edge
// closing the paved court. A west wall with a gate leads out to the garden terrace that covers the rest of the
// summit wherever the measured ground is gentle, walled along its rim, with a big cross on the south-west tip
// facing Kalampaka. Access (OSM): paved path from the road on the east down into the ravine, then about 140 steps
// in five flights up the east cliff to the shelf, and a paved walk to the gate. Goods cable car to the road side.
// The small mapped buildings north of the chevron and the toilets on the west stand where the measured ground is
// cliff, so they are left out. Every height comes from site.ground.
import * as THREE from 'three';

const deg = (d) => (d * Math.PI) / 180;

export function build(kit, site) {
  const { mats, at, group, box } = kit;
  const g = group();
  const add = (...o) => { for (const x of o) g.add(x); };
  const gr = site.ground;

  const inRing = (u, v, ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [a, b] = ring[i], [p, q] = ring[j];
      if ((b > v) !== (q > v) && u < ((p - a) * (v - b)) / (q - b) + a) c = !c;
    }
    return c;
  };
  // Ground cover: square cells whose centre is inside `ring` and whose ground passes `ok(lo, hi)`.
  const cover = (ring, m, cell, lift, ok = () => true) => {
    const us = ring.map((p) => p[0]), vs = ring.map((p) => p[1]), cells = [];
    for (let u = Math.min(...us) + cell / 2; u < Math.max(...us); u += cell)
      for (let v = Math.min(...vs) + cell / 2; v < Math.max(...vs); v += cell) {
        if (!inRing(u, v, ring)) continue;
        const { lo, hi } = kit.groundRange(site, u, v, cell, cell);
        if (!ok(lo, hi)) continue;
        add(at(box(cell, hi - lo + 0.5 + lift, cell, m), u, v, lo - 0.5));
        cells.push([u, v]);
      }
    return cells;
  };
  const densify = (pts, step) => {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = pts[i - 1], [c, d] = pts[i], n = Math.max(1, Math.round(Math.hypot(c - a, d - b) / step));
      for (let k = 1; k <= n; k++) out.push([a + ((c - a) * k) / n, b + ((d - b) * k) / n]);
    }
    return out;
  };
  // Paved strip `width` wide draped on the ground: top `lift` above the highest ground across it.
  const strip = (pts, width, m, lift = 0.15, step = 2) => {
    const p = densify(pts, step);
    add(kit.wall(p.map(([u, v], i) => {
      const [a, b] = p[Math.max(i - 1, 0)], [c, d] = p[Math.min(i + 1, p.length - 1)];
      const l = Math.hypot(c - a, d - b) || 1, nu = (-(d - b) / l) * width / 2, nv = ((c - a) / l) * width / 2;
      const hs = [gr(u, v), gr(u + nu, v + nv), gr(u - nu, v - nv)];
      return [u, v, Math.min(...hs) - 0.4, Math.max(...hs) + lift];
    }), width, m));
  };
  const parapet = (pts, h = 1.1, m = mats.stone) =>
    add(kit.wall(densify(pts, 4).map(([u, v]) => [u, v, gr(u, v) - 2, gr(u, v) + h]), 0.7, m));
  // Wing from a to b (centre line), d deep, running d/2 past each end so neighbours overlap at the corners.
  const wing = (a, b, d, h, extra = {}) => {
    const du = b[0] - a[0], dv = b[1] - a[1], len = Math.hypot(du, dv), turn = Math.atan2(dv, du);
    const u = (a[0] + b[0]) / 2, v = (a[1] + b[1]) / 2;
    const r = kit.block(site, { u, v, w: len + d, d, h, turn, winSpacing: 3.2, ...extra });
    const { top, bottom } = r.userData;
    add(r, at(box(len + d + 0.2, top - h + 0.8 - bottom, d + 0.2, mats.stone), u, v, bottom, turn));
    return { u, v, turn, top, len: len + d };
  };
  const chimneys = (w, offs) => add(at(group(...offs.map(([a, b]) => at(box(0.8, 3, 0.8, mats.stone), a, b, w.top))), w.u, w.v, 0, w.turn));

  // ── South range: cells and guest rooms, arcaded ground-floor loggia and a timber balcony facing the town.
  const S = wing([-4, -14.5], [28, -0.5], 7, 6.5);
  chimneys(S, [[-12, 1.5], [0, -1.5], [12, 1.5]]);
  add(at(group(
    at(kit.arcade(S.len - 4, 3, 9, mats.plaster, 0.5), 0, -4, gr(S.u, S.v) - 0.2),
    at(kit.balcony(S.len - 8, 1.5, mats.timber), 0, -3.5, S.top - 3.1),
    at(kit.hipRoof(S.len - 8, 1.5, 0.4, mats.tileDark, 0.2), 0, -4.3, S.top - 0.3),
  ), S.u, S.v, 0, S.turn));

  // ── East range up the east arm: refectory below, cells above; gallery facing the court.
  const E = wing([35, -3], [27, 19], 9, 6);
  chimneys(E, [[-6, 2], [5, -2]]);
  add(at(group(
    at(kit.balcony(16, 1.4, mats.timber), 0, -4.5, E.top - 3.1),
    at(kit.hipRoof(16, 1.4, 0.4, mats.tileDark, 0.2), 0, -5.2, E.top - 0.3),
  ), E.u, E.v, 0, E.turn + Math.PI));

  // ── Katholikon (1475/76): small two-column cross-in-square, one dome on a drum, brick-banded ochre ashlar,
  // barrel-vaulted narthex (1689) to the west; it backs onto the south range.
  {
    const u = 5, v = -2, turn = deg(23);
    const { lo, hi } = kit.groundRange(site, u, v, 17, 10, turn);
    const F = hi + 0.3;
    add(at(group(
      at(box(17, F - lo + 1, 10, mats.stone), -0.5, 0, lo - 1),
      at(box(8, 7, 8, mats.ashlar), 1.5, 0, F),
      at(box(6, 5.5, 8.4, mats.ashlar), -5.5, 0, F),
      at(box(8.2, 0.35, 8.2, mats.brick), 1.5, 0, F + 3.3),
      at(box(8.2, 0.35, 8.2, mats.brick), 1.5, 0, F + 5.6),
      at(box(6.2, 0.35, 8.6, mats.brick), -5.5, 0, F + 3.3),
      at(kit.apse(2.5, 5.8, mats.ashlar), 5.5, 0, F),
      at(kit.hipRoof(8, 8, 1.5, mats.tile), 1.5, 0, F + 7),
      at(kit.gableRoof(8.4, 6, 1.6, mats.tileDark, 0.3, mats.ashlar), -5.5, 0, F + 5.5, Math.PI / 2),
      at(box(4, 2, 4, mats.ashlar), 1.5, 0, F + 7.2),
      at(kit.drum(2, 3, 8, mats.ashlar), 1.5, 0, F + 9.2),
      at(kit.drumWindows(2, 8, 0.4, 1.4), 1.5, 0, F + 10),
      at(kit.drum(2.25, 0.3, 8, mats.tile), 1.5, 0, F + 12.2),
      at(kit.dome(2.1, mats.tile, 8, 3), 1.5, 0, F + 12.4),
      at(kit.cross(1.4), 1.5, 0, F + 14.4),
      at(kit.windows(2, 3, 0.6, 1.6), 1.5, 4.06, F + 2.5, Math.PI),       // north windows, onto the court
      at(kit.windows(1, 1, 1.4, 2.6), -8.5, 0, F, -Math.PI / 2),          // west door
    ), u, v, 0, turn));
  }

  // ── Gatehouse on the east face of the east range, gate facing the walk from the stair; St John's round
  // rock-cut chapel (1682) just inside the passage on the court side.
  const gate = [39, 12.5];
  {
    const gh = kit.block(site, { u: 35.5, v: 12.5, w: 7, d: 7, h: 9, wallMat: mats.stone, winSpacing: 3 });
    add(gh, at(kit.windows(1, 1, 2, 3), gate[0] + 0.05, gate[1], gr(...gate), Math.PI / 2));
    const c = [23.5, 9.5], { lo, hi } = kit.groundRange(site, ...c, 6, 6), F = hi + 0.2;
    add(at(group(
      at(kit.drum(2.8, F - lo + 4.5, 10, mats.stone), 0, 0, lo - 0.5),
      at(kit.drum(3, 0.3, 10, mats.tile), 0, 0, F + 4),
      at(kit.dome(2.8, mats.tile, 10, 3), 0, 0, F + 4.2),
      at(kit.cross(1.2), 0, 0, F + 7),
    ), ...c));
  }

  // ── West wall with the garden gate, and the parapet along the north-west cliff edge: they close the court.
  const westGate = [-8.4, -9];
  parapet([[-8.6, -16], [-8.4, -4.5]], 3, mats.plaster);
  add(at(kit.windows(1, 1, 1.6, 2.4, mats.dark, 0.4), ...westGate, gr(...westGate), -Math.PI / 2));
  parapet([[-8.4, -4.5], [4, 3], [14, 8.2], [22.5, 12.5], [23.5, 18], [24, 23.5]]);

  // ── Paved court inside the unit (the buildings cover its edges).
  cover([[-8, -15], [-8, -4.5], [4, 3], [14, 8.2], [22.5, 12.5], [24, 23.5], [30, 23.5], [36, -4], [26, -7], [-3, -13.5]],
    mats.concrete, 4.5, 0.08);

  // ── Garden terrace: rays from the middle of the summit run out to the cliff (or the buildings); their ends
  // make the garden outline, and the cliff ends make its parapet.
  const outline = kit.offsetRing(site.ring, 3), C = [-18, -28];
  const front = [Math.sin(S.turn), -Math.cos(S.turn)];                   // outward normal of the south range
  const sFace = [S.u + front[0] * 3.5, S.v + front[1] * 3.5];
  const built = (u, v) => u > -9 && (u - sFace[0]) * front[0] + (v - sFace[1]) * front[1] < 0.5;
  const rays = [];
  for (let k = 0; k < 48; k++) {
    const a = (k * 2 * Math.PI) / 48, cu = Math.cos(a), cv = Math.sin(a);
    let r = 1, edge = true;
    for (; r < 90; r += 1) {
      const u = C[0] + cu * r, v = C[1] + cv * r;
      if (built(u, v)) { edge = false; break; }
      if (gr(u, v) < -2.5 || !inRing(u, v, outline)) break;
    }
    const rr = r - (edge ? 1.5 : 0.5);
    rays.push({ p: [C[0] + cu * rr, C[1] + cv * rr], edge });
  }
  const rim = rays.map((x) => x.p);
  const lawns = cover(rim, mats.garden, 6, 0.12, (lo, hi) => lo > -3 && hi - lo < 6);
  // parapet: each run of cliff-side ray ends (the rays are a ring, so start just after a building-side one)
  const s0 = rays.findIndex((x) => !x.edge);
  let run = [];
  for (let i = 1; i <= rays.length; i++) {
    const x = rays[(s0 + i) % rays.length];
    if (x.edge) run.push(x.p);
    if ((!x.edge || i === rays.length) && run.length > 1) { parapet(run); run = []; }
    if (!x.edge) run = [];
  }
  // walk from the garden gate across the terrace to the cross on the south-west tip, facing the town
  const tip = rim.reduce((b, p) => (Math.hypot(p[0] + 54, p[1] + 50) < Math.hypot(b[0] + 54, b[1] + 50) ? p : b));
  const cross = [tip[0] + (C[0] - tip[0]) * 0.08, tip[1] + (C[1] - tip[1]) * 0.08];
  strip([westGate, [-24, -12], [-40, -16], [-46, -27], cross], 2.2, mats.concrete, 0.3);
  add(at(box(2.4, 1.6, 2.4, mats.stone), ...cross, gr(...cross) - 0.6));
  add(at(kit.cross(6), ...cross, gr(...cross) + 1, Math.atan2(cross[1], cross[0]) + Math.PI / 2));
  lawns.forEach(([u, v], i) => {
    if ((i * 7) % 5 === 0) add(at(kit.cypress(7 + ((i * 3) % 4)), u + 1.2, v - 0.8, gr(u + 1.2, v - 0.8) - 0.3));
  });

  // ── Small garden on the shelf outside the gate (OSM garden), two cypresses.
  cover([[56, 16], [47, 13], [41, 7], [43, 2], [48, 4], [53, 3]], mats.garden, 3, 0.12, (lo, hi) => lo > -4 && hi - lo < 3);
  for (const [u, v] of [[45, 6], [51, 8]]) add(at(kit.cypress(8), u, v, gr(u, v) - 0.3));

  // ── Rock-cut stair (1925): five flights zigzagging up the east cliff from the ravine floor to the shelf.
  const vS = 8, vN = 22, run0 = vN - vS, n = 5;
  const yTop = gr(68, 22) + 0.2, yFoot = gr(82, 7) + 0.2, rise = (yTop - yFoot) / n;
  const out = (vv, y) => { // u at which the east cliff, along v = vv, falls to height y
    let a = 50, b = 92;
    for (let k = 0; k < 20; k++) { const m = (a + b) / 2; if (gr(m, vv) > y) a = m; else b = m; }
    return (a + b) / 2;
  };
  const us = [];
  for (let i = 0; i < n; i++) {
    const y = yFoot + rise * i, north = i % 2 === 0;
    let u = out((vS + vN) / 2, y + rise / 2) - 0.5;
    if (i > 0) u = Math.min(u, us[i - 1] - 2.4);
    us.push(u);
    const { lo } = kit.groundRange(site, u, (vS + vN) / 2, 2.4, run0);
    add(at(kit.stairs(run0, rise, 2.2, 16, mats.stone, y - lo + 1), u, north ? vS : vN, y, north ? Math.PI / 2 : -Math.PI / 2));
    // landing at the turn (or the foot), solid to the ground
    const lu = i > 0 ? (u + us[i - 1]) / 2 : u, lw = i > 0 ? us[i - 1] - u + 2.2 : 2.2;
    const lv = north ? vS - 1.2 : vN + 1.2, r = kit.groundRange(site, lu, lv, lw, 2.4);
    add(at(box(lw, y - r.lo + 1, 2.4, mats.stone), lu, lv, r.lo - 1));
  }
  {
    const u = us[n - 1], r = kit.groundRange(site, u, vN + 1.2, 2.4, 2.4);
    add(at(box(2.4, yTop - r.lo + 1, 2.4, mats.stone), u, vN + 1.2, r.lo - 1));     // top landing
  }

  // ── Walks: shelf walk from the stair top to the gate; the path from the road down into the ravine (OSM).
  strip([[us[n - 1] - 1, vN + 1.2], [64, 19.5], [56, 18], [48, 15], gate], 2.6, mats.concrete, 0.2);
  strip([[261, 63], [256, 65], [252, 64], [246, 57], [242, 48], [238, 41], [235, 32], [232, 22], [223, 13], [213, 8],
    [199, 2], [190, -4], [179, -9], [175, -8], [175, -5], [177, 0], [190, 14], [203, 29], [206, 40], [206, 54],
    [203, 56], [200, 52], [196, 45], [191, 36], [176, 31], [165, 25], [156, 18], [148, 10], [143, 7], [141, 9],
    [142, 18], [146, 31], [147, 38], [145, 40], [140, 39], [136, 34], [127, 23], [119, 18], [110, 15], [104, 12],
    [90, 8.5], [us[0], vS - 1.2]], 2.4, mats.concrete, 0.15, 6);

  // ── Goods cable car: winch house against the east range, two cables to a landing on the road side.
  {
    const A = [34, 21], B = [228, 26];
    const ra = kit.groundRange(site, ...A, 5, 5), rb = kit.groundRange(site, ...B, 5, 4);
    const ya = ra.hi + 4, yb = rb.hi + 3.5;
    add(at(group(
      at(box(5, ra.hi + 1 - ra.lo + 1, 5, mats.stone), 0, 0, ra.lo - 1),
      at(box(5, 3, 5, mats.timber), 0, 0, ra.hi + 1),
      at(kit.hipRoof(5, 5, 1.6, mats.tile, 0.4), 0, 0, ra.hi + 4),
    ), ...A));
    add(at(group(
      at(box(5, rb.hi + 3 - rb.lo + 1, 4, mats.concrete), 0, 0, rb.lo - 1),
      at(box(5.6, 0.4, 4.6, mats.concrete), 0, 0, rb.hi + 3),
    ), ...B));
    const a = new THREE.Vector3(A[0] + 2.5, ya, -A[1]), b = new THREE.Vector3(B[0], yb, -B[1]);
    const dir = b.clone().sub(a), len = dir.length();
    dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(0.7);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    for (const s of [1, -1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, len), mats.dark);
      c.position.copy(a).lerp(b, 0.5).addScaledVector(side, s);
      c.quaternion.copy(q);
      add(c);
    }
    const p = a.clone().lerp(b, 0.33);
    const cabin = group(at(box(0.15, 1.6, 0.15, mats.dark), 0, 0, -1.6), at(box(2, 1.6, 1.6, mats.white), 0, 0, -3.2));
    cabin.position.copy(p).add(side);
    cabin.rotation.y = Math.atan2(-dir.z, dir.x);
    add(cabin);
  }

  return g;
}
