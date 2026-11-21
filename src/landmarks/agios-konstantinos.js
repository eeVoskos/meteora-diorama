// Agios Konstantinos, south-west Kalampaka — reference sheet section 3, "Landmarks to model".
// White-rendered modern Byzantine-style parish church: cross-in-square with gabled tile-roofed arms over lower
// corner bays, a tiled dome on a tall 12-sided drum at the crossing, three tile-capped apses, red (brick) window
// surrounds, a lower narthex at the west end and a bell tower with a small tiled dome.
//
// Plan, from the OSM outline (way 415534160): a 28.7 × 22.6 m rectangle whose long axis runs 20.6° south of east,
// parallel to the street along its north side. Apse on the east-south-east end, entrance on the west-north-west
// end. Guesses (the sheet only says "bell tower"): the tower stands at the north-west corner, on the street side,
// and is capped with a small dome rather than a pyramid.

const T = -0.359; // long axis, radians (south of east)
const C = Math.cos(T), S = Math.sin(T);
const toSite = (a, b) => [a * C - b * S, a * S + b * C];

export function build(kit, site) {
  const { mats, at, group, box } = kit;
  const range = (a, b, w, d) => kit.groundRange(site, ...toSite(a, b), w, d, T);
  const parts = [];
  const add = (...o) => parts.push(...o);
  const turnOf = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
  const panes = (side, a, b, y, n, sp, w, h, m = mats.dark, gap = 0.06) => add(at(kit.windows(n, sp, w, h, m, gap), a, b, y, turnOf[side]));
  // Windows with red surrounds: a brick panel, the dark pane just in front of it.
  const rwin = (side, a, b, y, n = 1, sp = 1, w = 0.7, h = 1.8) => {
    panes(side, a, b, y - 0.25, n, sp, w + 0.5, h + 0.5, mats.brick);
    panes(side, a, b, y, n, sp, w, h, mats.dark, 0.14);
  };

  const { lo, hi } = range(0, 0, 28.7, 22.6);
  const F = hi + 0.4, y0 = lo - 1;
  const aW = -9.2, aE = 9.6, bN = 10.6, ac = 0.2; // naos walls, crossing centre
  const len = aE - aW, mid = (aW + aE) / 2;

  // Corner bays, then the two gabled arms (0.2 m proud of the walls), all white render from below the ground.
  add(at(box(len, F + 8 - y0, 2 * bN, mats.white), mid, 0, y0));
  add(at(kit.hipRoof(len, 2 * bN, 1.2, mats.tileDark, 0.35), mid, 0, F + 8));
  const armH = 11, armW = 8, rise = 2.4;
  add(at(box(len + 0.4, armH + F - y0, armW, mats.white), mid, 0, y0));
  add(at(kit.gableRoof(len + 0.4, armW, rise, mats.tile, 0.45, mats.white), mid, 0, F + armH));
  add(at(box(armW, armH + F - y0, 2 * bN + 0.4, mats.white), ac, 0, y0));
  add(at(kit.gableRoof(2 * bN + 0.4, armW, rise, mats.tile, 0.45, mats.white), ac, 0, F + armH, Math.PI / 2));

  // Crossing: square base, tall drum with arched windows in brick surrounds, eave ring, tiled dome, cross.
  const yb = F + armH + 0.2;
  add(at(box(7, 2.6, 7, mats.white), ac, 0, yb));
  const dr = 3.1, dh = 6, yd = yb + 2.6;
  add(at(kit.drum(dr, dh, 12, mats.white), ac, 0, yd));
  add(at(kit.drumWindows(dr, 12, 1.05, 2.9, mats.brick), ac, 0, yd + 1.2));
  add(at(kit.drumWindows(dr + 0.1, 12, 0.55, 2.3), ac, 0, yd + 1.45));
  add(at(kit.drum(dr + 0.3, 0.3, 12, mats.tile), ac, 0, yd + dh));
  add(at(kit.dome(dr + 0.2, mats.tile, 12, 4), ac, 0, yd + dh + 0.3));
  add(at(kit.cross(1.8), ac, 0, yd + dh + 0.3 + dr + 0.1));

  // Three tile-capped apses on the east end, walls run down below the ground.
  const apse = (r, h, sides, a, b) => {
    const ap = at(kit.apse(r, h, mats.white, mats.tile, sides), a, b, y0);
    ap.children[0].scale.y = (F + h - y0) / h;
    ap.children[1].position.y += F - y0;
    return ap;
  };
  add(apse(3.4, 7.2, 9, aE + 0.2, 0), apse(1.7, 5.4, 7, aE, -6.1), apse(1.7, 5.4, 7, aE, 6.1));
  rwin('E', aE + 0.2 + 3.42, 0, F + 2.6, 1, 1, 0.6, 2);

  // Windows: corner bays, arm ends (two below, one in the gable), east gable over the apse.
  for (const [side, b] of [['S', -bN], ['N', bN]]) {
    for (const a of [aW + 2.6, aE - 2.6]) rwin(side, a, b, F + 3.2);
    rwin(side, ac, b + Math.sign(b) * 0.2, F + 3, 2, 2.2, 0.8, 2.2);
    rwin(side, ac, b + Math.sign(b) * 0.2, F + 7.6, 1, 1, 0.7, 2);
  }
  rwin('E', aE + 0.2, 0, F + 8.2, 1, 1, 0.6, 1.6);

  // Narthex: lower, narrower, hipped; west door and windows; a step platform in front.
  {
    const a0 = -14.2, d = aW - a0, a = (a0 + aW) / 2, w = 15;
    add(at(box(d + 0.2, F + 7 - y0, w, mats.white), a + 0.1, 0, y0));
    add(at(kit.hipRoof(d + 0.2, w, 1.5, mats.tile, 0.4), a + 0.1, 0, F + 7));
    rwin('W', a0, 0, F, 1, 1, 1.6, 2.8);
    rwin('W', a0, 0, F + 4.2, 2, 4.4, 0.7, 1.6);
    rwin('S', a, -w / 2, F + 3, 1, 1, 0.7, 1.8);
    add(at(box(1.8, F - y0 - 0.6, 6, mats.concrete), a0 - 0.3, 0, y0)); // entrance steps
  }

  // Bell tower at the north-west corner (street side): white shaft, belfry with arched openings in brick
  // surrounds, white cornice, small tiled dome on a short drum, cross.
  {
    const ta = -11.7, tb = 9.1, w = 4.2, r = range(ta, tb, w, w), top = F + 14;
    add(at(box(w, top - (r.lo - 1), w, mats.white), ta, tb, r.lo - 1));
    for (const [side, a, b] of [['S', ta, tb - w / 2], ['N', ta, tb + w / 2], ['E', ta + w / 2, tb], ['W', ta - w / 2, tb]])
      rwin(side, a, b, top - 3.6, 2, 1.4, 0.8, 2.6);
    rwin('N', ta, tb + w / 2, F + 5, 1, 1, 0.5, 1.2);
    add(at(box(w + 0.5, 0.4, w + 0.5, mats.white), ta, tb, top));
    add(at(kit.drum(1.7, 0.8, 8, mats.white), ta, tb, top + 0.4));
    add(at(kit.dome(1.9, mats.tile, 8, 3), ta, tb, top + 1.2));
    add(at(kit.cross(1.3), ta, tb, top + 3));
  }

  return at(group(...parts), 0, 0, 0, T);
}
