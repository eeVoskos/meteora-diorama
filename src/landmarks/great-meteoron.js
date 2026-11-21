// Great Meteoron (Metamorphosis) on Platys Lithos — reference sheet section 1.
// The precinct outline covers the whole broad rock; only its south-east end is built, after the OSM footprints
// (site frame: u east, v north). One closed ring of wings round an irregular paved court: the west wing (OSM
// 1066256737), the long north range on the north rim, the net-and-winch gate tower at the north-east corner
// where the stair arrives, the four-storey east range on the east rim facing Varlaam, a south wing, the refectory
// (OSM 735), the old domed kitchen (769) and the old infirmary (736), closed by a link wall to the katholikon
// (733), which stands in the west of the court. Inside the court: the old-age home and the slim pale tower.
// West of the ring, a walled garden with lawns and cypresses; the rest of the plateau stays rock, with a few
// mapped outbuildings, a small domed chapel (739) and the farm buildings at the north-west end.
// Access (OSM steps and paths): from the parking on the service road east of the rock, down steps and a path to
// the saddle, then switchback rock-cut flights up the east cliff into the gate tower.
// Which mapped footprint is which building (refectory, kitchen, infirmary, chapel) is a guess from their shapes.
// Every height comes from site.ground.

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
  // Wing from a to b (centre line), d deep: plaster storeys h tall over a stone base reaching down the slope.
  // The block runs d/2 past each end so neighbouring wings overlap at the corners.
  const wing = (a, b, d, h, extra = {}) => {
    const du = b[0] - a[0], dv = b[1] - a[1], len = Math.hypot(du, dv), turn = Math.atan2(dv, du);
    const u = (a[0] + b[0]) / 2, v = (a[1] + b[1]) / 2;
    const r = kit.block(site, { u, v, w: len + d, d, h, turn, winSpacing: 3.2, ...extra });
    const { top, bottom } = r.userData;
    add(r, at(box(len + d + 0.2, Math.max(0.5, top - h + 0.8 - bottom), d + 0.2, mats.stone), u, v, bottom, turn));
    return { u, v, turn, top, len: len + d, d };
  };
  // Timber galleries on the back (+v) face of a wing, for wings whose outer side is the back.
  const galleries = (w, levels, len = w.len - 4) => add(at(group(
    ...levels.map((y) => at(kit.balcony(len, 1.8, mats.timber), 0, -w.d / 2, w.top - y)),
    at(kit.hipRoof(len, 1.8, 0.5, mats.tileDark, 0.2), 0, -w.d / 2 - 0.9, w.top - 0.4),
  ), w.u, w.v, 0, w.turn + Math.PI));
  const wall = (pts, h, thick = 0.8, m = mats.stone) =>
    add(kit.wall(densify(pts, 3).map(([u, v]) => [u, v, gr(u, v) - 1.5, gr(u, v) + h]), thick, m));

  // ── The ring of wings round the court.
  const west = wing([49, -3], [57, -24], 8, 7);                       // OSM 737, on the north-west rim
  const north1 = wing([60, -24], [84, -30], 9, 9);                    // long cell range on the north rim
  const north2 = wing([84, -30], [104, -31], 9, 9);
  galleries(north1, [3, 6]); galleries(north2, [3, 6]);
  const east1 = wing([110, -34], [116, -52], 10, 12, { winSpacing: 3 }); // four-storey guest range on the east rim
  const east2 = wing([116, -52], [117, -71], 10, 12, { winSpacing: 3 });
  for (const w of [east1, east2]) {
    galleries(w, [3, 6], w.len - 6);
    add(at(group(                                                        // stone lower storeys, arcaded loggia
      at(box(w.len - 6, 2, 1.6, mats.stone), 0, -w.d / 2 - 0.8, w.top - 11.5),
      at(kit.arcade(w.len - 6, 3, Math.round((w.len - 6) / 3.4), mats.plaster, 0.6), 0, -w.d / 2 - 1.3, w.top - 9.5),
    ), w.u, w.v, 0, w.turn + Math.PI));
  }
  wing([117, -72], [99, -65], 8, 8);                                  // south wing (south arm of the OSM complex)

  // Refectory (OSM 735): long, vaulted, apse at its west end (its east end joins the south wing).
  {
    const ref = wing([95, -62.5], [72, -72.5], 7.5, 7, { roof: 'gable', rise: 2.2, winSpacing: 3.6 });
    const [u, v] = [69.4, -73.6], { lo } = kit.groundRange(site, u, v, 5, 6);
    add(at(kit.apse(3, ref.top - lo + 0.5, mats.stone), u, v, lo - 0.5, ref.turn));
  }
  // Old kitchen (OSM 769): squat stone block, hemispherical vault with a little smoke-hole dome.
  {
    const k = kit.block(site, { u: 66.5, v: -66.5, w: 7, d: 7, h: 5, wallMat: mats.stone, roof: 'flat', roofMat: mats.stone });
    const t = k.userData.top;
    add(k, at(kit.dome(3.2, mats.tile, 8, 3), 66.5, -66.5, t + 0.4),
      at(kit.drum(0.7, 1.3, 6, mats.stone), 66.5, -66.5, t + 3.3), at(kit.dome(0.8, mats.tile, 6, 2), 66.5, -66.5, t + 4.6));
  }
  wing([62.5, -52.5], [73.5, -61], 5.5, 6, { winSpacing: 3 });         // old infirmary, two storeys (OSM 736)
  wall([[69, -64], [64, -61], [61, -55]], 3.5);                         // kitchen ↔ infirmary
  // Link wall with the garden gate: infirmary ↔ katholikon.
  {
    const a = [60.5, -50], b = [63.5, -45.5], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    wall([a, b], 3.5, 0.8, mats.plaster);
    add(at(kit.hipRoof(5.4, 0.8, 0.3, mats.tile, 0.3), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, gr(...a) + 3.5, ang));
    add(at(kit.windows(1, 1, 1.6, 2.4, mats.dark, 0.45), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, gr(...a), ang));
  }

  // ── Katholikon of the Transfiguration (OSM 733): Athonite cross-in-square, apse to the east-south-east,
  // ochre ashlar with brick bands, tall 12-sided main drum and dome, a lower drum and dome over the lite.
  {
    const u = 61.3, v = -35, turn = deg(-35);
    const { lo, hi } = kit.groundRange(site, u, v, 20, 12, turn);
    const F = hi + 0.3;
    add(at(group(
      at(box(20, F - lo + 1, 12.4, mats.stone), 0.5, 0, lo - 1),     // plinth
      at(box(10, 10, 10.4, mats.ashlar), 2, 0, F),                     // naos
      at(box(8, 8, 11.6, mats.ashlar), -7, 0, F),                      // lite, wider than the naos
      at(box(10.2, 0.4, 10.6, mats.brick), 2, 0, F + 4),              // brick bands
      at(box(10.2, 0.4, 10.6, mats.brick), 2, 0, F + 7.5),
      at(box(8.2, 0.4, 11.8, mats.brick), -7, 0, F + 4),
      at(kit.apse(3.2, 8.5, mats.ashlar), 7, 0, F),                    // sanctuary apse
      at(kit.apse(2.4, 7, mats.ashlar), 2.5, 5.2, F, Math.PI / 2),     // side choirs
      at(kit.apse(2.4, 7, mats.ashlar), 2.5, -5.2, F, -Math.PI / 2),
      at(kit.hipRoof(10, 10.4, 2, mats.tile), 2, 0, F + 10),
      at(kit.hipRoof(8, 11.6, 1.8, mats.tileDark), -7, 0, F + 8),
      at(box(5.6, 2.8, 5.6, mats.ashlar), 2, 0, F + 10.4),             // square base of the main drum
      at(kit.drum(2.8, 5.5, 12, mats.ashlar), 2, 0, F + 13.2),
      at(kit.drumWindows(2.8, 12, 0.4, 2), 2, 0, F + 14.5),
      at(kit.drum(3.1, 0.35, 12, mats.tile), 2, 0, F + 18.7),          // eave ring
      at(kit.dome(3, mats.tile, 12), 2, 0, F + 18.9),
      at(kit.cross(2), 2, 0, F + 21.8),
      at(kit.drum(2, 4, 8, mats.ashlar), -7, 0, F + 8.8),              // lite drum
      at(kit.drumWindows(2, 8, 0.4, 1.4), -7, 0, F + 10),
      at(kit.dome(2.2, mats.tile, 8, 3), -7, 0, F + 12.8),
      at(kit.cross(1.4), -7, 0, F + 15),
      at(kit.windows(2, 3.6, 0.7, 1.8), 2, -5.2, F + 5),
      at(kit.windows(2, 3.6, 0.7, 1.8), 2, 5.2, F + 5, Math.PI),
      at(kit.windows(1, 1, 1.6, 2.8), -7, 5.8, F, Math.PI),             // north door onto the court
    ), u, v, 0, turn));
  }

  // ── Inside the court: the two-storey old-age home and the slim pale square tower.
  wing([82, -41], [95, -55], 7, 6, { winSpacing: 3 });
  {
    const [u, v] = [101, -40], { lo, hi } = kit.groundRange(site, u, v, 4.5, 4.5);
    add(at(group(
      at(box(4.5, hi + 17 - lo + 1, 4.5, mats.plaster), 0, 0, lo - 1),
      at(kit.windows(1, 1, 0.6, 1.2), 0, -2.25, hi + 13.5),
      at(kit.windows(1, 1, 0.6, 1.2), 0, 2.25, hi + 13.5, Math.PI),
      at(kit.hipRoof(4.5, 4.5, 2.2, mats.tile, 0.4), 0, 0, hi + 17),
    ), u, v, 0, deg(-30)));
  }
  // Paved court (wings cover its edges) and a few trees.
  cover([[58, -28], [106, -34], [112, -50], [112, -67], [96, -61], [74, -67], [72, -60], [66, -46], [72, -37]], mats.concrete, 6, 0.1);
  for (const [u, v] of [[76, -50], [80, -58], [104, -50], [106, -60], [92, -38], [70, -44]])
    add(at(kit.cypress(8 + Math.abs((u + v) % 3)), u, v, gr(u, v) - 0.3));

  // ── Gate and net tower at the north-east corner: the stair enters it from below; timber winch room on top
  // with the net balcony out over the east cliff.
  {
    const [u, v] = [108.5, -30.5], turn = deg(-72);
    const { lo, hi } = kit.groundRange(site, u, v, 7, 7, turn), top = hi + 17;
    add(at(group(
      at(box(7, top - lo + 1, 7, mats.stone), 0, 0, lo - 1),
      at(box(7.6, 3, 7.6, mats.timber), 0, 0, top),
      at(kit.windows(2, 2.6, 0.9, 1.1), 0, 3.85, top + 1, Math.PI),
      at(kit.hipRoof(7.6, 7.6, 2.6, mats.tile, 0.6), 0, 0, top + 3),
      at(kit.balcony(4, 2.8, mats.timber, 1.1), 0, 3.8, top, Math.PI),  // winch balcony facing east
      at(kit.hipRoof(4, 2.8, 0.5, mats.tileDark, 0.2), 0, 5.2, top + 2.6),
      at(box(1.4, 4, 1.4, mats.dark), 0, 5.6, top - 4.5),                // the net hanging below
      at(kit.windows(1, 1, 1.6, 2.6), 0, 3.55, hi - 0.2, Math.PI),        // gate where the stair arrives
    ), u, v, 0, turn));
  }

  // ── The access, all OSM: service road and parking east of the rock, steps and a path down to the saddle,
  // then the rock-cut flights switching back up the east cliff (offset so the passes sit side by side) into the
  // gate. Flights climb evenly from the saddle to the gate; each is built solid down to the cliff below it.
  strip([[214, -4], [194, -9], [185, -8], [176, -2]], 5, mats.concrete);
  strip([[176, -2], [171, -2], [159, 5], [161, -1], [165, -9], [164, -11], [162, -11], [157, -5], [145, 1], [140, 1],
    [138, -1], [130, -11], [119, -21]], 2.6, mats.concrete);
  {
    const route = [[119, -21], [116, -25], [120, -29], [138, -46], [136, -48.5], [118, -31.5], [116.5, -34],
      [124, -41], [121.5, -43], [107, -31.5]];
    const y0 = gr(119, -21) + 0.15, y1 = gr(107, -30) + 0.3;
    const lens = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]));
    const total = lens.reduce((s, l) => s + l, 0);
    let y = y0;
    route.slice(1).forEach((b, i) => {
      const a = route[i], len = lens[i], rise = ((y1 - y0) * len) / total, turn = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const low = kit.groundRange(site, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, len, 3, turn).lo;
      add(at(kit.stairs(len, rise, 2.4, Math.max(2, Math.round(len / 1.5)), mats.stone, Math.max(1, y - low + 1)), a[0], a[1], y, turn));
      y += rise;
    });
  }

  // ── Walled garden west of the ring: lawns, a cross walk from the garden gate, cypresses, two garden houses.
  const garden = [[46, -4], [53, -26], [50, -34], [60, -50], [61, -56], [63, -64], [56, -72], [40, -66], [24, -54],
    [22, -30], [28, -14], [38, -4]];
  add(kit.wall(densify([...garden, garden[0]], 3).map(([u, v]) => [u, v, gr(u, v) - 1.5, gr(u, v) + 1.8]), 0.7, mats.stone));
  cover(garden, mats.garden, 6, 0.12);
  strip([[60, -48], [44, -44], [26, -42]], 2.2, mats.concrete, 0.3);
  strip([[42, -10], [40, -30], [42, -62]], 2.2, mats.concrete, 0.3);
  for (const [u, v] of [[30, -20], [36, -16], [48, -20], [30, -34], [50, -38], [34, -52], [46, -54], [54, -62], [28, -48], [44, -36], [36, -26]])
    add(at(kit.cypress(8 + Math.abs((u * 7 + v * 3) % 3)), u, v, gr(u, v) - 0.3));
  add(kit.block(site, { u: 45, v: -28, w: 7, d: 4.5, h: 4, turn: deg(-20) }));   // OSM 738
  add(kit.block(site, { u: 33.5, v: -39.5, w: 5.5, d: 4, h: 3.5, turn: deg(35), wallMat: mats.stone })); // OSM 740

  // ── Small domed chapel on the open plateau (OSM 739), apse to the south-east.
  {
    const u = 11, v = -37.5, turn = deg(-37);
    const { lo, hi } = kit.groundRange(site, u, v, 11, 7, turn), F = hi + 0.3;
    add(at(group(
      at(box(9, F - lo + 0.5, 6, mats.stone), 0, 0, lo - 0.5),
      at(box(8.5, 5, 5.5, mats.plaster), 0, 0, F),
      at(kit.apse(2, 4.5, mats.plaster), 4.25, 0, F),
      at(kit.gableRoof(8.5, 5.5, 1.6, mats.tile, 0.4, mats.plaster), 0, 0, F + 5),
      at(kit.drum(1.4, 1.6, 8, mats.plaster), 0.5, 0, F + 5.6),
      at(kit.dome(1.5, mats.tile, 8, 3), 0.5, 0, F + 7.2),
      at(kit.cross(1), 0.5, 0, F + 8.6),
      at(kit.windows(1, 1, 1.2, 2.2), -4.3, 0, F, -Math.PI / 2),
    ), u, v, 0, turn));
  }

  // ── Mapped outbuildings on the plateau and the farm buildings at the north-west end.
  add(kit.block(site, { u: 39, v: 10.5, w: 15, d: 6, h: 5, turn: deg(-63) }));                    // OSM 741
  add(kit.block(site, { u: 35.5, v: -4.5, w: 10, d: 4, h: 4, turn: deg(-73), wallMat: mats.stone })); // OSM 742
  add(kit.block(site, { u: -68.5, v: 45, w: 17, d: 7, h: 4, turn: deg(22), wallMat: mats.stone })); // OSM 745
  add(kit.block(site, { u: -70, v: 86, w: 24, d: 7, h: 4, turn: deg(-13) }));                    // OSM 746
  for (const [u, v] of[[-58, 40], [-80, 50], [-62, 75], [-50, 82], [-20, 50]])
    add(at(kit.cypress(9), u, v, gr(u, v) - 0.3));

  return g;
}
