// Varlaam (All Saints) — reference sheet section 1.
// One closed unit after the OSM footprints on the levelled summit: the north range on the cliff edge, the long
// north-west cell wing, a west wing and the refectory arm round a small inner court with the chapel of the Three
// Hierarchs; the two-domed katholikon (lite on the west, naos and apse on the east) joins the north range and the
// refectory; the windlass (net) tower and its lower wing on the east rim, with the gate where the rock-cut stair
// arrives. South of them a paved court runs out to the round kiosk on the south-east tip, and a walled garden with
// lawns and cypresses falls away to the south-west (OSM garden). A parapet follows the rim between them.
// Access (OSM paths and steps): from the car park on the road side a paved path crosses the neighbouring knob,
// a stone footbridge spans the gap, then the 195-step stair zigzags up the east face to the gate.
// Wing corners overlap so the ring has no gaps. Every height comes from site.ground.

const TURN = 0.12; // the OSM buildings' common axis, a few degrees north of east

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
    const ring = kit.offsetRing(outline, -cell / 2);
    const us = ring.map((p) => p[0]), vs = ring.map((p) => p[1]);
    for (let u = Math.min(...us) + cell / 2; u < Math.max(...us); u += cell)
      for (let v = Math.min(...vs) + cell / 2; v < Math.max(...vs); v += cell) {
        if (!inRing(u, v, ring)) continue;
        const { lo, hi } = kit.groundRange(site, u, v, cell, cell);
        add(at(box(cell, hi - lo + 0.5 + lift, cell, m), u, v, lo - 0.5));
      }
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
  const strip = (pts, width, m, lift = 0.15) => {
    const p = densify(pts, 2);
    add(kit.wall(p.map(([u, v], i) => {
      const [a, b] = p[Math.max(i - 1, 0)], [c, d] = p[Math.min(i + 1, p.length - 1)];
      const l = Math.hypot(c - a, d - b) || 1, nu = (-(d - b) / l) * width / 2, nv = ((c - a) / l) * width / 2;
      const hs = [gr(u, v), gr(u + nu, v + nv), gr(u - nu, v - nv)];
      return [u, v, Math.min(...hs) - 0.4, Math.max(...hs) + lift];
    }), width, m));
  };
  // Parapet along the ground, `h` tall.
  const parapet = (pts, h = 1.2, m = mats.stone, thick = 0.7) =>
    add(kit.wall(densify(pts, 3).map(([u, v]) => [u, v, gr(u, v) - 2, gr(u, v) + h]), thick, m));
  // Wing from a to b (centre line), d deep: plaster storeys h tall over a stone base that reaches down the slope.
  // The block runs d/2 past each end so neighbouring wings overlap at the corners.
  const wing = (a, b, d, h, extra = {}) => {
    const du = b[0] - a[0], dv = b[1] - a[1], len = Math.hypot(du, dv), turn = Math.atan2(dv, du);
    const u = (a[0] + b[0]) / 2, v = (a[1] + b[1]) / 2;
    const r = kit.block(site, { u, v, w: len + d, d, h, turn, winSpacing: 3.4, ...extra });
    const { top, bottom } = r.userData;
    add(r, at(box(len + d + 0.2, top - h + 0.8 - bottom, d + 0.2, mats.stone), u, v, bottom, turn));
    return { u, v, turn, top, len: len + d };
  };

  // ── The ring of wings.
  const north = wing([1, 18], [25, 20.5], 6.5, 9);                     // north range on the cliff edge
  add(at(group(                                                         // two timber galleries over the drop
    at(kit.balcony(22, 1.5, mats.timber), 0, 0, north.top - 3),
    at(kit.balcony(22, 1.5, mats.timber), 0, 0, north.top - 6),
    at(kit.hipRoof(22, 1.5, 0.4, mats.tileDark, 0.2), 0, -0.8, north.top - 0.3),
  ), north.u - 3.5 * Math.sin(north.turn), north.v + 3.5 * Math.cos(north.turn), 0, north.turn + Math.PI));
  wing([-5, 16.5], [-29, 12.5], 7, 8);                                     // north-west cell wing
  wing([-29, 12.5], [-29, -3], 7, 7);                                    // west wing
  wing([-29, -2.5], [0, -2.5], 9, 6, { wallMat: mats.stone, roof: 'gable', rise: 2.4 }); // refectory (museum)

  // ── Inner court between the wings, with the chapel of the Three Hierarchs (single aisle, gabled).
  cover([[-25, 2.5], [-1, 2.5], [-1, 12.5], [-25, 9.5]], mats.concrete, 3, 0.08);
  {
    const u = -11, v = 9.5, turn = -0.14;
    const { lo, hi } = kit.groundRange(site, u, v, 8, 5, turn);
    const F = hi + 0.2;
    add(at(group(
      at(box(8, F - lo + 1, 5, mats.stone), 0, 0, lo - 1),
      at(box(6.5, 4.5, 4.4, mats.plaster), -0.4, 0, F),
      at(kit.apse(1.6, 3.8, mats.plaster), 2.85, 0, F),
      at(kit.gableRoof(6.5, 4.4, 1.4, mats.tile, 0.3, mats.plaster), -0.4, 0, F + 4.5),
      at(kit.cross(0.9), -3.6, 0, F + 5.9),
      at(kit.windows(1, 1, 1.1, 2.1), -0.4, -2.2, F),
    ), u, v, 0, turn));
  }

  // ── Katholikon of All Saints (1541/42): Athonite cross-in-square, warm ochre masonry with brick bands; the
  // wide lite (narthex) on the west under the lower dome, the naos with the main dome, side choirs and the apse
  // on the east, after the two OSM church footprints.
  {
    const [u, v] = [13.5, 10];
    const { lo, hi } = kit.groundRange(site, u, v, 30, 15, TURN);
    const F = hi + 0.3;
    add(at(group(
      at(box(30, F - lo + 1, 15, mats.stone), 0.5, 0, lo - 1),         // plinth
      at(box(12, 9, 10, mats.ashlar), 5, 0, F),                        // naos
      at(box(12, 7, 11, mats.ashlar), -7, 0, F),                       // lite
      at(box(12.2, 0.4, 10.2, mats.brick), 5, 0, F + 4.5),
      at(box(12.2, 0.4, 11.2, mats.brick), -7, 0, F + 4),
      at(kit.apse(3.2, 7.5, mats.ashlar), 11, 0, F),
      at(kit.apse(2.4, 6, mats.ashlar), 6, 5, F, Math.PI / 2),         // side choirs
      at(kit.apse(2.4, 6, mats.ashlar), 6, -5, F, -Math.PI / 2),
      at(kit.hipRoof(12, 10, 2, mats.tile), 5, 0, F + 9),
      at(kit.hipRoof(12, 11, 1.8, mats.tileDark), -7, 0, F + 7),
      at(box(5.4, 2.6, 5.4, mats.ashlar), 5, 0, F + 9.4),              // main drum: square base, 8-sided drum
      at(kit.drum(2.6, 4.2, 8, mats.ashlar), 5, 0, F + 12),
      at(kit.drumWindows(2.6, 8, 0.45, 1.8), 5, 0, F + 13),
      at(kit.drum(2.9, 0.3, 8, mats.tile), 5, 0, F + 16.2),
      at(kit.dome(2.8, mats.tile, 8, 3), 5, 0, F + 16.4),
      at(kit.cross(1.6), 5, 0, F + 19.1),
      at(kit.drum(1.9, 3, 8, mats.ashlar), -7, 0, F + 8.2),            // lite drum and dome
      at(kit.drumWindows(1.9, 8, 0.35, 1.2), -7, 0, F + 9.1),
      at(kit.dome(2.1, mats.tile, 8, 3), -7, 0, F + 11.2),
      at(kit.cross(1.2), -7, 0, F + 13.2),
      at(kit.windows(3, 3.4, 0.6, 1.6), -7, -5.5, F + 2.4),            // lite south windows
      at(kit.windows(1, 1, 1.6, 2.6), -7, -5.5, F),                    // south door onto the court
    ), u, v, 0, TURN));
  }

  // ── Windlass (net) tower on the east rim (1536): tall stone shaft, timber winch room and balcony facing east
  // over the cliff, the net hanging below; a lower plaster wing joins it to the court.
  {
    const [u, v] = [33, -1.5];
    const { lo, hi } = kit.groundRange(site, u, v, 8, 8, TURN);
    const top = hi + 12;
    add(at(group(
      at(box(8, top - lo + 1, 8, mats.stone), 0, 0, lo - 1),
      at(kit.windows(2, 3, 0.7, 1.2), 0, -4, top - 4),
      at(box(8.6, 3.2, 8.6, mats.timber), 0, 0, top),
      at(kit.windows(3, 2.4, 0.9, 1.1), 0, -4.36, top + 1),
      at(kit.hipRoof(8.6, 8.6, 2.6, mats.tile, 0.6), 0, 0, top + 3.2),
      at(kit.balcony(5, 2.8, mats.timber, 1.1), 0, -4.3, top),
      at(kit.hipRoof(5, 2.8, 0.5, mats.tileDark, 0.2), 0, -5.7, top + 2.8),
      at(box(1.3, 4.5, 1.3, mats.dark), 0, -6.2, top - 4.5),           // the net
    ), u, v, 0, TURN + Math.PI / 2)); // front (−v) turned to face east
    wing([22.5, -4], [28, -2], 9, 6);                                    // old hospital wing between tower and court
  }

  // ── Gatehouse where the stair arrives, between the tower and the katholikon apse; gate faces east.
  const gate = [35, 5];
  {
    const gh = kit.block(site, { u: 32, v: 5.5, w: 6, d: 5.5, h: 5.5, turn: TURN, wallMat: mats.stone, roof: 'hip' });
    add(gh, at(kit.windows(1, 1, 1.8, 2.8), ...gate, gr(...gate) + 0.2, TURN + Math.PI / 2));
  }
  parapet([[33, 8], [30.5, 13], [28.5, 17]]);                           // east rim between gate and north range

  // ── South court: paving from the katholikon to the kiosk, parapet round the rim, walled off from the garden.
  cover([[1, 3.5], [1, -8], [4, -12], [7, -19], [11, -26], [22, -24], [27, -20], [32, -14], [34, -9], [22, -9], [21, 3.5]],
    mats.concrete, 3, 0.08);
  parapet([[37, -6], [34, -16], [28, -22], [23, -26], [11, -28], [-7, -29], [-20, -26], [-31, -19], [-33, -15], [-34, -8], [-31, -5]]);
  parapet([[0.5, -7], [4, -12], [7, -19], [11, -27.5]], 2.2, mats.plaster, 0.6); // garden wall
  add(at(kit.windows(1, 1, 1.4, 2, mats.dark, 0.35), 5.5, -15.5, gr(5.5, -15.5), Math.atan2(-7, 3))); // its gate

  // ── Garden on the south-west terraces (OSM garden): lawns, a walk, cypresses.
  cover([[7, -19], [10, -27], [-7, -28], [-12, -28], [-20, -25], [-30, -19], [-32, -15], [-33, -8], [-25, -7], [0, -8], [4, -12]],
    mats.garden, 4, 0.12);
  strip([[4, -14], [-8, -17], [-22, -19]], 2, mats.concrete, 0.3);
  for (const [u, v, h] of [[-26, -14, 9], [-20, -21, 8], [-12, -23, 9], [-4, -24, 8], [2, -21, 9], [-16, -11, 8], [-6, -12, 7],
    [16, -6, 8], [12, -20, 9], [-21, 5, 7]])
    add(at(kit.cypress(h), u, v, gr(u, v) - 0.3));

  // Barrel house against the garden wall (OSM footprint).
  add(kit.block(site, { u: 7, v: -15, w: 7.6, d: 3.6, h: 3.5, turn: 2.05, wallMat: mats.stone, roof: 'gable', rise: 1.2 }));

  // ── Kiosk on the south-east tip of the terrace: round, open, conical tile roof on six posts.
  {
    const [u, v] = [23.2, -21];
    const { lo, hi } = kit.groundRange(site, u, v, 5, 5);
    const k = group(at(kit.drum(2.6, hi - lo + 1.5, 8, mats.stone), 0, 0, lo - 1));
    for (let i = 0; i < 6; i++) k.add(at(box(0.3, 2.4, 0.3, mats.plaster), 2 * Math.cos(i * Math.PI / 3), 2 * Math.sin(i * Math.PI / 3), hi + 0.5));
    k.add(at(kit.cone(2.9, 1.8, 8, mats.tile), 0, 0, hi + 2.9));
    add(at(k, u, v));
  }

  // ── Access. Paved path from the car park over the neighbouring knob to the gap (OSM path), 3 m wide.
  const B0 = [50, 26], B1 = [42, 17.5], L = [45, 13];
  strip([[81, 80], [78, 66], [79, 59], [84, 50], [82, 43], [76, 37], [69, 33], [62, 31], [55, 29], B0], 3, mats.concrete);
  // Footbridge over the gap on a middle pier, level with the path end; a landing on the rock beyond it.
  const yB = gr(...B0) + 0.3;
  {
    const len = Math.hypot(B1[0] - B0[0], B1[1] - B0[1]), turn = Math.atan2(B1[1] - B0[1], B1[0] - B0[0]);
    const m = [(B0[0] + B1[0]) / 2, (B0[1] + B1[1]) / 2];
    add(at(kit.bridge(len + 1, 2.6, mats.stone, 1), ...m, yB, turn));
    add(at(box(2.4, yB - 0.6 - gr(...m) + 2, 3.2, mats.stone), ...m, gr(...m) - 2, turn));
    const yl = Math.min(gr(...B1), gr(...L)) - 2;
    add(kit.wall([[...B1, yl, yB], [...L, yl, yB]], 3, mats.stone));
  }
  // The 195-step stair up the east face (OSM steps), each leg a flight solid down to the rock, landings at the turns.
  {
    const path = [L, [47, 9], [49, 4], [48, 0], [46, -4], [43, -6], [40, -5], [39, -1], [40, 3], [41, 5], [42, 9], [41, 13],
      [37, 10], gate];
    const top = gr(...gate) + 0.2, d = [0];
    for (let i = 1; i < path.length; i++) d.push(d[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    let y = yB;
    const ys = path.map(([u, v], i) => (y = Math.max(y, yB + (top - yB) * d[i] / d[d.length - 1], gr(u, v) + 0.2)));
    ys[ys.length - 1] = Math.max(top, ys[ys.length - 2]);
    for (let i = 0; i < path.length - 1; i++) {
      const [a, b] = path[i], [c, e] = path[i + 1], len = Math.hypot(c - a, e - b), rise = Math.max(0.1, ys[i + 1] - ys[i]);
      const low = Math.min(gr(a, b), gr(c, e), gr((a + c) / 2, (b + e) / 2));
      add(at(kit.stairs(len, rise, 2.4, Math.max(2, Math.round(rise / 0.5)), mats.stone, ys[i] - low + 1.5), a, b, ys[i], Math.atan2(e - b, c - a)));
      if (i > 0) add(at(box(2.8, ys[i] - gr(a, b) + 1.5, 2.8, mats.stone), a, b, gr(a, b) - 1.5));
    }
  }

  return g;
}
