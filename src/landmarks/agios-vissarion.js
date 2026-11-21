// Agios Vissarion, the metropolitan church of Kalampaka — reference sheet section 3, "Landmarks to model".
// Large modern neo-Byzantine cross-in-square in grey-beige ashlar: tall gabled cross arms over lower corner bays,
// a broad tiled dome on a low drum at the crossing, three apses to the east, red brick arches round triple windows
// on the arm ends, an attached square bell tower with a pyramidal tile roof, and white arcaded porches with red
// (brick) trim on the west front and on the south side, which faces the street and the steps up from it.
//
// Plan, from the OSM outline (way 585513480): a 33 × 23 m body, axis 1.7° south of east, with a 11 × 3.5 m
// projection on the south side (the south porch) and a 7 × 4.5 m one on the north side (the bell tower).
// The task brief mentions twin west towers; the reference sheet and the outline show a single attached tower,
// so that is what is built here.

const T = -0.03; // body axis, radians (slightly south of east)
const C = Math.cos(T), S = Math.sin(T);
const toSite = (a, b) => [a * C - b * S, a * S + b * C];

export function build(kit, site) {
  const { mats, at, group, box } = kit;
  const range = (a, b, w, d) => kit.groundRange(site, ...toSite(a, b), w, d, T);
  const parts = [];
  const add = (...o) => parts.push(...o);
  const turnOf = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
  const panes = (side, a, b, y, n, sp, w, h, m = mats.dark, gap = 0.06) => add(at(kit.windows(n, sp, w, h, m, gap), a, b, y, turnOf[side]));
  // Triple window with a red brick surround: brick panel first, dark panes just in front of it.
  const triple = (side, a, b, y) => { panes(side, a, b, y - 0.35, 1, 1, 4.3, 3.4, mats.brick); panes(side, a, b, y, 3, 1.3, 0.8, 2.5, mats.dark, 0.14); };

  // Whole church on one floor level: a stone podium from 1 m under the lowest ground (steps up from the south street).
  const { lo, hi } = range(0, 0, 34, 31);
  const F = hi + 0.3, y0 = lo - 1;
  const aW = -16.5, aE = 13.6, bN = 11.3; // naos walls; porch west of aW, apses east of aE
  const ac = 0.5;                          // crossing centre (a); b = 0
  add(at(box(aE - aW + 1, F - y0, 2 * bN + 0.6, mats.stone), (aW + aE) / 2, 0, y0));

  // Naos: lower corner bays, then the two gabled arms (protruding 0.2 m so no faces coincide).
  const nW = aW + 4;                        // west porch is a −16.5 … −12.5; naos starts at −12.5
  const nLen = aE - nW, nMid = (nW + aE) / 2;
  add(at(box(nLen, 9, 2 * bN, mats.stone), nMid, 0, F));
  add(at(kit.hipRoof(nLen, 2 * bN, 1.4, mats.tileDark, 0.35), nMid, 0, F + 9));
  const armH = 13.2, armW = 9.4, rise = 2.6;
  add(at(box(nLen + 0.4, armH, armW, mats.stone), nMid, 0, F));
  add(at(kit.gableRoof(nLen + 0.4, armW, rise, mats.tile, 0.45, mats.stone), nMid, 0, F + armH));
  add(at(box(armW, armH, 2 * bN + 0.4, mats.stone), ac, 0, F));
  add(at(kit.gableRoof(2 * bN + 0.4, armW, rise, mats.tile, 0.45, mats.stone), ac, 0, F + armH, Math.PI / 2));
  // Brick string course at the corner-bay eaves.
  add(at(box(nLen + 0.3, 0.35, 2 * bN + 0.3, mats.brick), nMid, 0, F + 8.65));

  // Crossing: square base, low 16-sided drum with windows, eave ring, broad tiled dome, cross.
  const yb = F + armH + 0.2;
  add(at(box(10, 2.6, 10, mats.stone), ac, 0, yb));
  add(at(kit.drum(4.7, 2.4, 16, mats.stone), ac, 0, yb + 2.6));
  add(at(kit.drumWindows(4.7, 16, 0.55, 1.4), ac, 0, yb + 3.1));
  add(at(kit.drum(5.05, 0.35, 16, mats.brick), ac, 0, yb + 5));
  add(at(kit.dome(5, mats.tile, 16, 5), ac, 0, yb + 5.3));
  add(at(kit.cross(2.4), ac, 0, yb + 10.2));

  // Apses: big central one, two smaller side ones; walls run down to the podium foot.
  const apse = (r, h, sides, a, b) => {
    const ap = at(kit.apse(r, h, mats.stone, mats.tile, sides), a, b, y0);
    ap.children[0].scale.y = (F + h - y0) / h;
    ap.children[1].position.y += F - y0;
    return ap;
  };
  add(apse(3.4, 8, 9, aE + 0.2, 0), apse(1.9, 6.5, 7, aE, -6.9), apse(1.9, 6.5, 7, aE, 6.9));
  panes('E', aE + 0.2 + 3.42, 0, F + 3.2, 1, 1, 0.7, 2.6);

  // Triple windows with brick arches on the arm ends (south, north, east above the apse, west above the porch).
  triple('S', ac, -bN - 0.2, F + 8.4);
  triple('N', ac, bN + 0.2, F + 8.4);
  triple('E', aE + 0.2, 0, F + 10);
  triple('W', nW - 0.2, 0, F + 8.4);
  // Paired windows in the corner bays.
  for (const a of [nMid - 8.5, nMid + 8.5]) {
    panes('S', a, -bN, F + 3, 2, 1.6, 0.8, 2.2);
    panes('N', a, bN, F + 3, 2, 1.6, 0.8, 2.2);
  }

  // West porch (exonarthex): white arcade of 7 bays across the front, end walls, brick cornice, tile roof.
  {
    const d = 4, a = aW + d / 2, w = 2 * bN, h = 5;
    add(at(kit.arcade(w, h, 7, mats.white, 0.6), aW + 0.3, 0, F, -Math.PI / 2));
    for (const s of [-1, 1]) add(at(box(d, h, 0.6, mats.white), a, s * (bN - 0.3), F));
    add(at(box(d + 0.3, 0.4, w + 0.3, mats.brick), a, 0, F + h));
    add(at(kit.hipRoof(d, w, 1.3, mats.tile, 0.4), a, 0, F + h + 0.4));
    panes('W', nW - 0.2, 0, F, 1, 1, 1.8, 3);                            // main door, seen through the arcade
  }

  // South porch in the outline's south projection: 3-bay white arcade facing the street, tile roof.
  {
    const a = 1.5, w = 10.6, d = 3.6, b = -bN - d / 2, h = 4.6;
    const r = range(a, b, w, d);
    add(at(box(w + 0.4, F - r.lo + 1, d + 0.4, mats.stone), a, b, r.lo - 1));  // podium under the porch
    add(at(kit.arcade(w, h, 3, mats.white, 0.6), a, -bN - d + 0.3, F));
    for (const s of [-1, 1]) add(at(box(0.6, h, d, mats.white), a + s * (w / 2 - 0.3), b, F));
    add(at(box(w + 0.3, 0.4, d + 0.3, mats.brick), a, b, F + h));
    add(at(kit.hipRoof(w, d, 1.1, mats.tile, 0.4), a, b, F + h + 0.4));
    panes('S', a, -bN - 0.2, F, 1, 1, 1.8, 2.8);
  }

  // Attached bell tower in the north projection: stone shaft, belfry with paired arched openings in brick
  // surrounds, white cornice, pyramidal tile roof, cross.
  {
    const ta = -5.8, tb = 13.2, w = 5.8, r = range(ta, tb, w, w), top = F + 22;
    add(at(box(w, top - (r.lo - 1), w, mats.stone), ta, tb, r.lo - 1));
    const yb2 = top - 5;
    for (const [side, a, b] of [['S', ta, tb - w / 2], ['N', ta, tb + w / 2], ['E', ta + w / 2, tb], ['W', ta - w / 2, tb]]) {
      panes(side, a, b, yb2 - 0.3, 1, 1, 3.6, 3.6, mats.brick);
      panes(side, a, b, yb2, 2, 1.5, 1, 2.9, mats.dark, 0.14);
    }
    panes('N', ta, tb + w / 2, F + 9, 1, 1, 0.6, 1.6);
    panes('W', ta - w / 2, tb, F + 13, 1, 1, 0.6, 1.6);
    add(at(box(w + 0.5, 0.45, w + 0.5, mats.white), ta, tb, top - 0.45));
    add(at(box(w + 0.4, 0.3, w + 0.4, mats.white), ta, tb, yb2 - 0.9));
    add(at(kit.hipRoof(w, w, 3.6, mats.tile, 0.4), ta, tb, top));
    add(at(kit.cross(1.8), ta, tb, top + 3.5));
  }

  return at(group(...parts), 0, 0, 0, T);
}
