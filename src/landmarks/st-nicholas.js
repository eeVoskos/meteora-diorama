// St Nicholas Anapafsas — reference sheet section 1.
// A narrow building stacked on a small rock, no courtyard. Plan from the one OSM building in the precinct, which
// wraps round the east and south of the rock knob: its long axis runs north-north-east and the ground falls about
// 25 m from the knob to its north-east end. One tall stack that continues the rock face: a stone base on the true
// footprint, from the entrance level at the foot of the east face (chapel of St Anthony, crypt) up to a paved roof
// terrace with a parapet; the katholikon on it with its low windowless dome; the plastered top storey (old
// refectory, ossuary, chapel of St John) with dark timber balconies. A tiny belfry kiosk stands on the rock knob.
// Access follows the mapped route: from the Kastraki road by the parking, the path and flights of steps climb
// north round the rock, then west, and the last paved flight rises to the door at the foot of the east face.
// Every height comes from site.ground.

const AX = 1.1537; // long axis of the OSM footprint, radians from east
const C = Math.cos(AX), S = Math.sin(AX);
const ab = (a, b) => [a * C - b * S, a * S + b * C]; // a along the axis (+ = north-north-east), b across (+ = west-north-west)

// OSM building footprint (u, v), two sub-metre notches dropped.
const FOOT = [[-8, -9], [9, -17], [16, -1], [14, 4], [14, 8], [10, 10], [7, 4], [5, 5], [1, -5], [-5, -3]];

export function build(kit, site) {
  const { mats, at, group, box } = kit;
  const g = group();
  const add = (...o) => { for (const x of o) g.add(x); };
  const G = site.ground;
  const range = (a, b, w, d) => kit.groundRange(site, ...ab(a, b), w, d, AX);
  // Box w (along the axis) × d placed at rock coords a, b from y0 to y1.
  const slab = (a, b, w, d, y0, y1, m) => at(box(w, y1 - y0, d, m), ...ab(a, b), y0, AX);
  const frame = (a, b, ...kids) => at(group(...kids), ...ab(a, b), 0, AX);
  const prism = (ring, y0, y1, m) => at(kit.prism(ring, y1 - y0, m), 0, 0, y0);

  // ── Entrance: a landing at the foot of the east face where the mapped steps arrive; E = entrance floor.
  const land = range(4, -16.8, 3.4, 3.4), E = land.hi + 0.3;
  let lo = Infinity, hi = -Infinity;
  for (const [u, v] of FOOT) { lo = Math.min(lo, G(u, v)); hi = Math.max(hi, G(u, v)); }
  hi = Math.max(hi, range(0, -6, 24, 18).hi);
  const L1 = hi + 4.5; // roof terrace, above the rock top

  // ── Stone base on the true footprint: entrance storey, then a slight setback up to the terrace.
  const T0 = E + 6.5, inner = kit.offsetRing(FOOT, -0.6);
  add(prism(FOOT, lo - 2, T0, mats.stone), prism(inner, T0 - 0.5, L1, mats.stone));
  add(prism(kit.offsetRing(FOOT, 0.15), T0 - 0.35, T0, mats.plaster)); // plastered drip course at the setback
  add(prism(inner, L1, L1 + 0.12, mats.concrete));                      // terrace paving
  add(kit.wall(kit.offsetRing(FOOT, -0.8).map(([u, v]) => [u, v, L1 - 0.3, L1 + 1.1]), 0.4, mats.stone, true)); // parapet
  // Windows: the base is mostly blind; a few small openings per storey on the upper tier, staggered.
  const rows = [];
  for (let y = T0 + 1.5; y < L1 - 2; y += 4) rows.push(y);
  add(frame(-3, -14.5, ...rows.map((y, i) => at(kit.windows(3 - (i % 2), 4.6, 0.5, 1), (i % 2) * 2 - 1, 0, y))));
  add(frame(13, -10, ...rows.map((y) => at(kit.windows(2, 3.5, 0.5, 1), -0.6, 0, y, Math.PI / 2))));
  add(frame(13, -10, at(kit.windows(1, 1, 0.4, 0.8), 0, 0, T0 - 3, Math.PI / 2)));
  add(frame(-8, 3.4, at(kit.windows(2, 3, 0.6, 1.1), 0, 0.6, L1 - 2.6, Math.PI))); // west face, over the knob

  // ── Entrance door and porch on the east face, landing in front.
  add(slab(4, -16.8, 3.4, 3.4, land.lo - 1, E, mats.stone));
  add(frame(4, -15.1,
    at(kit.windows(1, 1, 1.4, 2.5, mats.timber), 0, 0, E),
    at(kit.windows(1, 1, 1.8, 2.9), 0, 0.02, E),
    at(kit.hipRoof(3, 1.6, 0.6, mats.tile, 0.2), 0, -0.8, E + 3.1),
    at(kit.windows(2, 5, 0.35, 0.8), 0, 0, E + 4.2),                     // crypt slits
  ));

  // ── Katholikon on the terrace: stone, a low tile dome straight on the roof (no drum windows).
  const L2 = L1 + 5.5;
  add(slab(0, -8.5, 13, 10, L1, L2, mats.stone));
  add(frame(0, -8.5,
    at(kit.windows(3, 3.5, 0.5, 1), -1.5, -5.06, L1 + 2.4),
    at(kit.windows(3, 3.5, 0.5, 1), -1.5, 5.06, L1 + 2.4, Math.PI),
    at(kit.hipRoof(13, 10, 2.2, mats.tile, 0.5), 0, 0, L2),
  ));
  add(at(group(
    at(kit.drum(2.3, 1.4, 8, mats.stone), 0, 0, L2 + 0.8),
    at(kit.dome(2.3, mats.tile, 8, 3), 0, 0, L2 + 2.2),
    at(kit.cross(1.2), 0, 0, L2 + 4.5),
  ), ...ab(-2.5, -8.5)));

  // ── Top storey: plaster, over the north end and the drop, timber balconies on three sides.
  const L3 = L2 + 4.5;
  add(slab(6, -9.5, 10, 8, L1, L3, mats.plaster));
  add(frame(6, -9.5,
    at(kit.windows(3, 2.8, 0.7, 1.1), 0, -4, L3 - 2.2),
    at(kit.windows(3, 2.8, 0.7, 1.1), 0, 4, L3 - 2.2, Math.PI),
    at(kit.windows(2, 3, 0.7, 1.1), 5, 0, L3 - 2.2, Math.PI / 2),
    at(kit.balcony(7, 1.5, mats.timber), 0, -4, L3 - 3.4),
    at(kit.balcony(7, 1.4, mats.timber), 5, 0, L3 - 3.4, Math.PI / 2),
    at(kit.balcony(5, 1.2, mats.timber), 1, 4, L3 - 3.4, Math.PI),
    at(kit.hipRoof(10, 8, 2.2, mats.tile, 0.6), 0, 0, L3),
    at(box(0.8, 2.6, 0.8, mats.stone), 3, 2, L3),                       // chimney
  ));

  // ── Belfry kiosk on the rock knob just west of the building: four posts and a pyramid tile roof.
  {
    const u = -1, v = 0.5, r = kit.groundRange(site, u, v, 3, 3);
    const k = group(at(box(3, r.hi - r.lo + 1.4, 3, mats.stone), 0, 0, r.lo - 1));
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [-1.2, 1.2]]) k.add(at(box(0.3, 2.2, 0.3, mats.stone), x, z, r.hi + 0.4));
    k.add(at(kit.hipRoof(3, 3, 1.4, mats.tile, 0.3), 0, 0, r.hi + 2.6), at(box(0.8, 0.8, 0.8, mats.dark), 0, 0, r.hi + 1.6));
    add(at(k, u, v, 0, AX));
  }

  // ── Access route (OSM): paved strips where the path is gentle, solid stair flights where it is mapped as steps.
  const densify = (pts, step) => {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = pts[i - 1], [c, d] = pts[i], n = Math.max(1, Math.round(Math.hypot(c - a, d - b) / step));
      for (let k = 1; k <= n; k++) out.push([a + ((c - a) * k) / n, b + ((d - b) * k) / n]);
    }
    return out;
  };
  const strip = (pts, width = 2.6, lift = 0.15) => {
    const p = densify(pts, 2.5);
    add(kit.wall(p.map(([u, v], i) => {
      const [a, b] = p[Math.max(i - 1, 0)], [c, d] = p[Math.min(i + 1, p.length - 1)];
      const l = Math.hypot(c - a, d - b) || 1, nu = (-(d - b) / l) * width / 2, nv = ((c - a) / l) * width / 2;
      const hs = [G(u, v), G(u + nu, v + nv), G(u - nu, v - nv)];
      return [u, v, Math.min(...hs) - 0.4, Math.max(...hs) + lift];
    }), width, mats.concrete));
  };
  // Straight flights between mapped step vertices, climbing whichever way the ground rises, solid down to the ground.
  const flight = (p, q, yq = null, width = 2.4) => {
    let [a, b] = [p, q], ya = G(...a) + 0.15, yb = yq ?? G(...b) + 0.15;
    if (yb < ya) [a, b, ya, yb] = [b, a, yb, ya];
    const du = b[0] - a[0], dv = b[1] - a[1], run = Math.hypot(du, dv), rise = yb - ya;
    let dip = 0;
    for (let t = 0.1; t < 1; t += 0.1) dip = Math.max(dip, ya + rise * t - G(a[0] + du * t, a[1] + dv * t));
    const steps = Math.min(40, Math.max(2, Math.round(Math.max(run / 0.9, rise / 0.4))));
    add(at(kit.stairs(run, rise, width, steps, mats.concrete, dip + 1.5), ...a, ya, Math.atan2(dv, du)));
  };
  const flights = (pts) => { for (let i = 1; i < pts.length; i++) flight(pts[i - 1], pts[i]); };

  strip([[21, -116], [19, -104], [14, -102], [11, -99], [11, -96], [12, -93], [15, -91], [24, -90], [28, -89]]);
  flights([[28, -89], [33, -82], [34, -76], [33, -75], [36, -72], [32, -66], [27, -64], [28, -60], [18, -56]]);
  strip([[18, -56], [23, -55], [31, -52], [39, -50], [44, -47], [50, -41], [54, -33], [56, -24], [57, -14]]);
  flights([[57, -14], [54, 3], [40, 18]]);
  strip([[40, 18], [36, 19], [33, 18], [30, 15], [25, 12], [16.5, 7]]);
  const top = ab(4, -18.4); // outer edge of the landing
  flight([16.5, 7], top, E);

  for (const [u, v, h] of [[-8, 4, 7], [-11, 1, 6], [21, 11, 8]]) add(at(kit.cypress(h), u, v, G(u, v) - 0.5));
  return g;
}
