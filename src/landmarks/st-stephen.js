// St Stephen (Agios Stefanos, nunnery) on the broad rock directly above Kalampaka — reference sheet section 1.
// One closed ring of buildings round a paved courtyard, after the OSM footprints: the long north range on the
// cliff edge, the gatehouse at the north-east corner, an east wing and a south wing (the mapped "arm") meeting
// it, a west wing, and the multi-domed St Charalambos (1798) standing against the north and west wings. A short
// wall with a gate links the south wing to the church and leads out to the walled garden terrace on the south
// side over the town: lawns, paved walks, cypresses, the small old St Stephen on the south-east and a pavilion at
// the southern tip. Visitors cross a stone footbridge over the narrow cleft north-east of the gatehouse; a paved
// path and the service road run from there to the public road junction (OSM path + service road).
// Wing corners overlap so the ring has no gaps. Every height comes from site.ground.

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
  // Ground cover over a ring: square cells, each from below its lowest ground to `lift` above its highest.
  const cover = (outline, m, cell, lift) => {
    const ring = kit.offsetRing(outline, -cell / 2); // whole cells stay inside the outline
    const us = ring.map((p) => p[0]), vs = ring.map((p) => p[1]);
    for (let u = Math.min(...us) + cell / 2; u < Math.max(...us); u += cell)
      for (let v = Math.min(...vs) + cell / 2; v < Math.max(...vs); v += cell) {
        if (!inRing(u, v, ring)) continue;
        const { lo, hi } = kit.groundRange(site, u, v, cell, cell);
        add(at(box(cell, hi - lo + 0.5 + lift, cell, m), u, v, lo - 0.5));
      }
  };
  // Path points every ~step m.
  const densify = (pts, step) => {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = pts[i - 1], [c, d] = pts[i], n = Math.max(1, Math.round(Math.hypot(c - a, d - b) / step));
      for (let k = 1; k <= n; k++) out.push([a + ((c - a) * k) / n, b + ((d - b) * k) / n]);
    }
    return out;
  };
  // Paved strip `width` wide draped on the ground: top `lift` above the highest ground across it.
  const strip = (pts, width, m, lift = 0.15) => {
    const p = densify(pts, 2);
    add(kit.wall(p.map(([u, v], i) => {
      const [a, b] = p[Math.max(i - 1, 0)], [c, d] = p[Math.min(i + 1, p.length - 1)];
      const l = Math.hypot(c - a, d - b) || 1, nu = (-(d - b) / l) * width / 2, nv = ((c - a) / l) * width / 2;
      const hs = [gr(u, v), gr(u + nu, v + nv), gr(u - nu, v - nv)];
      return [u, v, Math.min(...hs) - 0.4, Math.max(...hs) + lift];
    }), width, m));
  };
  // Wing from a to b (centre line), d deep: plaster storeys h tall over a stone base that reaches down the slope.
  // The block runs d/2 past each end so neighbouring wings overlap at the corners.
  const wing = (a, b, d, h, extra = {}) => {
    const du = b[0] - a[0], dv = b[1] - a[1], len = Math.hypot(du, dv), turn = Math.atan2(dv, du);
    const u = (a[0] + b[0]) / 2, v = (a[1] + b[1]) / 2;
    const r = kit.block(site, { u, v, w: len + d, d, h, turn, winSpacing: 3.2, ...extra });
    const { top, bottom } = r.userData;
    add(r, at(box(len + d + 0.2, top - h + 0.8 - bottom, d + 0.2, mats.stone), u, v, bottom, turn));
    return { u, v, turn, top, len: len + d };
  };
  const chimneys = (w, offs) => add(at(group(...offs.map(([a, b]) => at(box(0.8, 3, 0.8, mats.stone), a, b, w.top))), w.u, w.v, 0, w.turn));

  // ── The ring of wings.
  const north = wing([12, 19.5], [-22, 19.5], 9, 8);
  chimneys(north, [[-14, 2], [-4, -2], [6, 2], [14, -2]]);
  add(at(group(                                                         // timber gallery facing the court (south)
    at(kit.balcony(26, 1.5, mats.timber), 0, -4.5, north.top - 3.1),
    at(kit.hipRoof(26, 1.5, 0.4, mats.tileDark, 0.2), 0, -5.3, north.top - 0.3),
  ), north.u, north.v, 0, 0));
  const west = wing([-23, 17], [-29, 1], 7, 7);
  chimneys(west, [[-4, 1.5]]);
  const east = wing([18, 16], [25, -6], 8, 7);
  chimneys(east, [[-5, 1.5], [6, -1.5]]);
  const south = wing([23, -9], [0, 1.5], 7, 6);
  chimneys(south, [[0, 1.5]]);

  // ── Gatehouse at the north-east corner, its gate facing the footbridge over the cleft.
  const G = [18.9, 23.2], E = [28.5, 34];                               // gate face, far end of the bridge
  const bAng = Math.atan2(E[1] - G[1], E[0] - G[0]);
  {
    const c = [G[0] - 4 * Math.cos(bAng), G[1] - 4 * Math.sin(bAng)], turn = bAng + Math.PI / 2;
    const gh = kit.block(site, { u: c[0], v: c[1], w: 8, d: 8, h: 12, turn, wallMat: mats.stone, winSpacing: 3 });
    add(gh, at(kit.cross(1.2), c[0], c[1], gh.userData.top + 2.4));
  }
  const gateY = gr(...G);
  add(at(kit.windows(1, 1, 2, 3), G[0], G[1], gateY, bAng + Math.PI / 2)); // gate opening on the gatehouse face

  // ── Footbridge over the cleft, deck sloping gently from the gate to the road end, on a central pier.
  {
    const yE = gr(...E) + 0.3, path = (y0, y1) => [[...G, gateY + y0, gateY + y1], [...E, yE + y0, yE + y1]];
    const off = (d) => (p) => [p[0] - Math.sin(bAng) * d, p[1] + Math.cos(bAng) * d, p[2], p[3]];
    add(kit.wall(path(-0.7, 0), 3, mats.stone));                          // deck
    for (const s of [1.35, -1.35]) add(kit.wall(path(0, 1.1).map(off(s)), 0.3, mats.stone)); // parapets
    const mid = [(G[0] + E[0]) / 2, (G[1] + E[1]) / 2], yM = (gateY + yE) / 2;
    add(at(box(2, yM - 0.6 - gr(...mid) + 2, 3, mats.stone), ...mid, gr(...mid) - 2, bAng));
    add(at(box(2.5, yE - gr(...E) + 1.5, 3.4, mats.stone), ...E, gr(...E) - 1.5, bAng));        // road-end abutment
  }

  // ── Path and service road from the bridge to the public road junction (OSM path + service road), 3 m paving.
  strip([E, [33, 33], [40, 32.9], [46.9, 33.1], [55.9, 35.9], [65, 39.6], [75.7, 43.9], [85, 50.5], [94.1, 57]], 3.2, mats.concrete);

  // ── Paved courtyard inside the ring (the wings cover its edges).
  cover([[-24, 16], [17, 16], [23, -5], [0, 4], [-10.5, -1.4], [-26, 6]], mats.concrete, 3, 0.08);

  // ── St Charalambos (1798): Athonite cross-in-square, ochre ashlar with brick bands, side choirs; main dome on
  // a terracotta-pink drum with white arched panels and a tile eave, two smaller pink-drummed domes over the lite.
  {
    const u = -15.4, v = 6.7, turn = deg(-29);
    const { lo, hi } = kit.groundRange(site, u, v, 18, 11, turn);
    const F = hi + 0.3, pinkDrum = (r, h, sides, y, du, dv, win) => [
      at(kit.drum(r, h, sides, mats.pink), du, dv, y),
      at(kit.drumWindows(r, sides, win * 2, h * 0.7, mats.white), du, dv, y + h * 0.12),
      at(kit.drumWindows(r + 0.06, sides, win, h * 0.5), du, dv, y + h * 0.2),
      at(kit.drum(r + 0.25, 0.3, sides, mats.tile), du, dv, y + h),
    ];
    add(at(group(
      at(box(18, F - lo + 1, 11, mats.stone), 0, 0, lo - 1),               // plinth
      at(box(9, 8, 9.4, mats.ashlar), 2.5, 0, F),                            // naos
      at(box(6, 6.5, 9.4, mats.ashlar), -5, 0, F),                           // lite
      at(box(9.2, 0.35, 9.6, mats.brick), 2.5, 0, F + 4),
      at(box(6.2, 0.35, 9.6, mats.brick), -5, 0, F + 4),
      at(kit.apse(2.8, 7, mats.ashlar), 7, 0, F),
      at(kit.apse(2.2, 6, mats.ashlar), 2.5, 4.7, F, Math.PI / 2),           // side choirs
      at(kit.apse(2.2, 6, mats.ashlar), 2.5, -4.7, F, -Math.PI / 2),
      at(kit.hipRoof(9, 9.4, 1.8, mats.tile), 2.5, 0, F + 8),
      at(kit.hipRoof(6, 9.4, 1.6, mats.tileDark), -5, 0, F + 6.5),
      at(box(4.8, 2.2, 4.8, mats.ashlar), 2.5, 0, F + 8.2),
      ...pinkDrum(2.3, 3.6, 12, F + 10.4, 2.5, 0, 0.45),
      at(kit.dome(2.45, mats.tile, 12), 2.5, 0, F + 14.3),
      at(kit.cross(1.8), 2.5, 0, F + 16.7),
      ...pinkDrum(1.1, 2.2, 8, F + 7, -5, 2.6, 0.3),
      ...pinkDrum(1.1, 2.2, 8, F + 7, -5, -2.6, 0.3),
      at(kit.dome(1.2, mats.tile, 8, 3), -5, 2.6, F + 9.5),
      at(kit.dome(1.2, mats.tile, 8, 3), -5, -2.6, F + 9.5),
      at(kit.windows(1, 1, 0.6, 1.8), -5, -4.7, F + 2.6),                  // south window of the lite
      at(kit.windows(1, 1, 1.5, 2.6), 2.5, 7.2, F, Math.PI),                 // north door, onto the court
    ), u, v, 0, turn));
  }

  // ── Link wall with a gate between the south wing and the church: court on one side, garden on the other.
  {
    const a = [-1.4, 6.2], b = [-6.4, 7.2], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    add(kit.wall([a, b].map(([u, v]) => [u, v, gr(u, v) - 1, gr(u, v) + 3.5]), 0.8, mats.plaster));
    add(at(kit.hipRoof(5.4, 0.8, 0.3, mats.tile, 0.3), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, gr(...a) + 3.5, ang));
    add(at(kit.windows(1, 1, 1.6, 2.4, mats.dark, 0.45), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, gr(...a), ang));
  }

  // ── Garden terrace: low parapet round the rim from the west wing to the east wing, lawns, walks, cypresses.
  const rim = [[-30, -2], [-30, -10], [-24, -17], [-17, -22], [-10, -27], [-4, -33], [5, -42], [8, -50], [19, -50],
    [21, -42], [22, -30], [25, -20], [26, -11]];
  add(kit.wall(densify(rim, 3).map(([u, v]) => [u, v, gr(u, v) - 2, gr(u, v) + 1.2]), 0.7, mats.stone));
  cover([...rim, [0, 1.5], [-10.5, -1.4], [-26, 5]], mats.garden, 4, 0.12);
  strip([[-4, 4], [-1, -4], [5, -14], [9, -22]], 2.2, mats.concrete, 0.3);        // court gate → old church
  strip([[16, -32], [14, -40], [14, -43]], 2.2, mats.concrete, 0.3);              // → pavilion
  strip([[-27, -8], [-12, -12], [4, -15], [22, -17]], 2.2, mats.concrete, 0.3);   // cross walk along the terrace
  for (const [u, v] of [[-24, -12], [-14, -18], [-6, -22], [2, -9], [7, -18], [20, -22], [3, -30], [17, -38], [11, -46],
    [-18, -4], [10, 10], [-3, 12]])
    add(at(kit.cypress(7.5 + Math.abs((u * 7 + v * 3) % 3)), u, v, gr(u, v) - 0.3));

  // ── Old St Stephen (15th c.): small single-aisle church, gabled, apse to the south-east (OSM footprint).
  {
    const u = 13.9, v = -26.2, turn = deg(-54);
    const { lo, hi } = kit.groundRange(site, u, v, 11, 7, turn);
    const F = hi + 0.3;
    add(at(group(
      at(box(11, F - lo + 1, 7, mats.stone), 0, 0, lo - 1),
      at(box(8.5, 5, 5.5, mats.plaster), -0.5, 0, F),
      at(kit.apse(2.2, 4.5, mats.plaster), 3.75, 0, F),
      at(kit.gableRoof(8.5, 5.5, 1.6, mats.tile, 0.3, mats.plaster), -0.5, 0, F + 5),
      at(kit.cross(1), -4.6, 0, F + 6.6),
      at(kit.windows(1, 1, 1.2, 2.2), -4.75, 0, F, -Math.PI / 2),
      at(kit.windows(2, 3, 0.5, 1.2), -0.5, -2.75, F + 2.4),
    ), u, v, 0, turn));
  }

  // ── Pavilion at the southern tip of the terrace (OSM footprint), open timber posts under a hipped roof.
  {
    const u = 14.1, v = -45.5;
    const { lo, hi } = kit.groundRange(site, u, v, 7, 5);
    const T = hi + 0.3;
    add(at(group(
      at(box(7, T - lo + 1, 5, mats.concrete), 0, 0, lo - 1),
      ...[[-3, -2], [3, -2], [3, 2], [-3, 2]].map(([a, b]) => at(box(0.3, 2.6, 0.3, mats.timber), a, b, T)),
      at(kit.hipRoof(6.2, 4.2, 1.2, mats.tile, 0.4), 0, 0, T + 2.6),
    ), u, v));
  }

  return g;
}
