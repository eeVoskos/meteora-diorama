// Roussanou (St Barbara, nunnery) — reference sheet section 1.
// One compact three-storey block over the mapped footprints on the low pillar: a broad south range (after the
// main OSM footprint), a narrow north arm and the west range (second footprint), overlapping at the corners so
// they read as one mass. Stone ground storey, cream plaster above, timber balconies toward the south-west, hipped
// tile roofs, and the small katholikon's tall octagonal dome rising out of the south range. The pillar is lower
// than the rock to its east: visitors climb the mapped flights of steps from the road onto that rock, then cross
// two short solid stone bridges on a pier to a gate tower joined to the north arm; from its foot a small paved
// court and the mapped paved path lead to the door. Every height comes from site.ground.

export function build(kit, site) {
  const { mats, at, group, box } = kit;
  const g = group();
  const add = (...o) => { for (const x of o) g.add(x); };
  const G = site.ground;

  const inRing = (u, v, ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [a, b] = ring[i], [p, q] = ring[j];
      if ((b > v) !== (q > v) && u < ((p - a) * (v - b)) / (q - b) + a) c = !c;
    }
    return c;
  };
  const densify = (pts, step) => {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = pts[i - 1], [c, d] = pts[i], n = Math.max(1, Math.round(Math.hypot(c - a, d - b) / step));
      for (let k = 1; k <= n; k++) out.push([a + ((c - a) * k) / n, b + ((d - b) * k) / n]);
    }
    return out;
  };
  // Paved strip draped on the ground (as St Stephen).
  const strip = (pts, width, m, lift = 0.15) => {
    const p = densify(pts, 2);
    add(kit.wall(p.map(([u, v], i) => {
      const [a, b] = p[Math.max(i - 1, 0)], [c, d] = p[Math.min(i + 1, p.length - 1)];
      const l = Math.hypot(c - a, d - b) || 1, nu = (-(d - b) / l) * width / 2, nv = ((c - a) / l) * width / 2;
      const hs = [G(u, v), G(u + nu, v + nv), G(u - nu, v - nv)];
      return [u, v, Math.min(...hs) - 0.4, Math.max(...hs) + lift];
    }), width, m));
  };
  // Flight of steps along a path: one tread block per ~1.6 m, each level with the highest ground under it.
  const flight = (pts, width, m) => {
    const p = densify(pts, 1.6);
    for (let i = 1; i < p.length; i++) {
      const [a, b] = p[i - 1], [c, d] = p[i], len = Math.hypot(c - a, d - b);
      const u = (a + c) / 2, v = (b + d) / 2, t = Math.atan2(d - b, c - a);
      const { lo, hi } = kit.groundRange(site, u, v, len, width, t);
      add(at(box(len + 0.3, hi - lo + 0.8, width, m), u, v, lo - 0.6, t));
    }
  };
  // Paved cells over a ring, each from below its lowest ground to `lift` above its highest.
  const cover = (outline, m, cell, lift) => {
    const us = outline.map((p) => p[0]), vs = outline.map((p) => p[1]);
    for (let u = Math.min(...us) + cell / 2; u < Math.max(...us); u += cell)
      for (let v = Math.min(...vs) + cell / 2; v < Math.max(...vs); v += cell) {
        if (!inRing(u, v, outline)) continue;
        const { lo, hi } = kit.groundRange(site, u, v, cell, cell);
        add(at(box(cell, hi - lo + 0.5 + lift, cell, m), u, v, lo - 0.5));
      }
  };
  // Range w × d at u, v turned `turn`: plaster storeys to h above the highest ground, stone ground storey.
  const range = (u, v, w, d, h, turn) => {
    const r = kit.block(site, { u, v, w, d, h, turn, winSpacing: 3 });
    const { top, bottom } = r.userData;
    add(r, at(box(w + 0.2, top - h + 4 - bottom, d + 0.2, mats.stone), u, v, bottom, turn));
    return { u, v, w, d, turn, top };
  };

  // ── The block: south range, north arm, west range (OSM footprints), corners overlapping.
  const south = range(-12.4, -13.5, 30, 13, 12, -0.69);
  const north = range(-16, 11.5, 19, 7, 12, 1.86);
  const west = range(-29, 7.5, 20, 10, 11, 0.38);
  add(at(group( // timber balconies on the south-west faces of the south and west ranges
    at(kit.balcony(22, 1.5, mats.timber), 0, -south.d / 2, south.top - 3.4),
    at(kit.hipRoof(22, 1.5, 0.4, mats.tileDark, 0.2), 0, -south.d / 2 - 0.8, south.top - 0.4),
  ), south.u, south.v, 0, south.turn));
  add(at(kit.balcony(14, 1.4, mats.timber), west.u - Math.sin(west.turn) * west.d / 2, west.v + Math.cos(west.turn) * west.d / 2,
    west.top - 3.4, west.turn + Math.PI)); // on the north-west face, over the drop

  // ── Katholikon of St Barbara: its tall octagonal dome, one single-light window per face, rising out of the
  // south range toward its north side (the church itself is inside the ground storey).
  {
    const u = -9.5, v = -9, y = south.top + 1;
    add(at(group(
      at(box(5.5, 3.5, 5.5, mats.plaster), 0, 0, y - 2),
      at(kit.hipRoof(5.5, 5.5, 0.6, mats.tile, 0.3), 0, 0, y + 1.5),
      at(kit.drum(2.3, 4, 8, mats.plaster), 0, 0, y + 1.6),
      at(kit.drumWindows(2.3, 8, 0.4, 1.6), 0, 0, y + 2.6),
      at(kit.drum(2.6, 0.3, 8, mats.tile), 0, 0, y + 5.6),
      at(kit.dome(2.5, mats.tile, 8, 3), 0, 0, y + 5.8),
      at(kit.cross(1.4), 0, 0, y + 8.3),
    ), u, v, 0, south.turn));
  }

  // ── Approach from the road: the two mapped flights of steps onto the higher rock east of the pillar.
  flight([[15, 65], [13, 49], [3, 38], [0, 30], [4, 26], [10, 27], [33, 35], [36, 34], [36, 30], [4, 16]], 2.2, mats.concrete);
  flight([[61, 7], [49, 13], [44, 13], [37, 8], [27, 7], [25, 10], [28, 13], [26, 15], [13, 14], [4, 16]], 2.2, mats.concrete);

  // ── Two short solid bridges from the rock (L) via a stone pier (P) to the gate tower joined to the north arm.
  {
    const L = [4, 16], P = [-1, 13], T = [-6, 10];
    const yL = G(...L), yD = yL - 2, yP = (yL + yD) / 2;
    const tAng = Math.atan2(P[1] - T[1], P[0] - T[0]);
    const D = [T[0] + Math.cos(tAng) * 2.5, T[1] + Math.sin(tAng) * 2.5]; // door on the tower face
    const span = (p, q, yp, yq) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]), t = Math.atan2(q[1] - p[1], q[0] - p[0]);
      const b = at(kit.bridge(len + 0.6, 2.4, mats.stone, 1), (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (yp + yq) / 2, t);
      b.rotation.z = Math.atan2(yq - yp, len);
      return b;
    };
    add(span(L, P, yL, yP), span(P, D, yP, yD));
    add(at(box(2.6, yP - 0.6 - (G(...P) - 2), 2.6, mats.stone), ...P, G(...P) - 2, tAng));
    add(at(box(3, yL - G(...L) + 2, 3, mats.stone), ...L, yL - 2.6, tAng)); // abutment on the rock
    strip([[6, 17], L], 2.6, mats.concrete); // landing where the two flights meet
    const lo = kit.groundRange(site, ...T, 5, 5, tAng).lo, top = yD + 3.6;
    add(at(group(
      at(box(5, top - (lo - 1), 5, mats.stone), 0, 0, lo - 1),
      at(kit.hipRoof(5, 5, 1.4, mats.tile, 0.4), 0, 0, top),
      at(kit.windows(1, 1, 1.2, 2.2), 0, -2.5, yD),            // upper door onto the bridge
      at(kit.windows(1, 1, 1.4, 2.4), 0, 2.5, G(...T), Math.PI), // ground door onto the court
      at(kit.windows(2, 2, 0.5, 0.9), 0, -2.5, yD - 4.5),
    ), ...T, 0, tAng + Math.PI / 2));
    // Covered passage from the tower to the north arm over the court path.
    const a = T, b = [-13, 12], la = Math.hypot(b[0] - a[0], b[1] - a[1]), ta = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const y0 = Math.max(G(...a), G(...b)) + 3.5, y1 = Math.min(top, north.top);
    add(at(box(la, y1 - y0, 3.5, mats.plaster), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, y0, ta));
    add(at(kit.hipRoof(la, 3.5, 0.6, mats.tile, 0.3), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, y1, ta));
  }

  // ── Entrance court on the pillar top east of the block, and the mapped paved path to the door.
  cover([[-13, 4], [-6, 1], [-1, -8], [5, -13], [8, -7], [1, 4], [-3, 8], [-9, 8]], mats.concrete, 3, 0.08);
  strip([[-4, 8], [-5, 10], [-11, 12], [-16, 8]], 2.4, mats.concrete, 0.2);
  add(kit.wall(densify([[5, -13], [8, -7], [1, 4]], 3).map(([u, v]) => [u, v, G(u, v) - 1, G(u, v) + 1.1]), 0.6, mats.stone));

  // ── Cypresses on the lower grounds round the foot of the pillar.
  for (const [u, v, h] of [[-44, -18, 10], [-40, -24, 9], [-34, -30, 11], [-46, 6, 9], [-30, 30, 10], [-12, 34, 9]])
    add(at(kit.cypress(h), u, v, G(u, v) - 0.5));

  return g;
}
