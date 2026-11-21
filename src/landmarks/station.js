// Kalampaka railway station — reference sheet section 3 [P]: ochre-yellow render, grey stone quoins and string
// course, pale-blue doors and window frames (kit has only the town hall blue), low hipped tile roofs. The sheet
// describes a two-storey, five-bay block with a single-storey wing; the brief says single-storey. Built as the
// sheet has it: a two-storey five-bay centre with single-storey wings either side, so the long low read survives.
//
// Plan from the host outline (building 1071173981, ~28 × 9 m): long axis north-west → south-east, parallel to the
// tracks, which run 3–4 m beyond the south-west face. Frame: a along the axis (+ = south-east), b across
// (+ = north-east, the town/forecourt side). Outline in that frame: a −13.4 … 14.4, north-east face b = 4.25,
// south-west face b = −4.65 up to a = 6 and −3.4 beyond (the narrower south-east wing). The platform side gets
// doors, a canopy on posts and a low platform slab out to b = −7.3.
import { edges } from './town-hall.js';

const A0 = -13.4, A1 = 14.4, BN = 4.25, BS = -4.65, BS2 = -3.4, AC0 = -8, AC1 = 6; // centre block a AC0 … AC1

export function build(kit, site) {
  const { mats, at, group, box } = kit;
  let T = site.box.angle;
  if (-Math.sin(T) + Math.cos(T) < 0) T -= Math.PI; // +b toward the north-east
  const C = Math.cos(T), S = Math.sin(T);
  const ab = (a, b) => [a * C - b * S, a * S + b * C];
  const g = group();
  const add = (...o) => { for (const x of o) g.add(x); };
  const { lo, hi } = kit.groundRange(site, ...ab((A0 + A1) / 2, (BS + BN) / 2), A1 - A0 + 4, BN - BS + 6, T);
  const y0 = lo - 1, F = hi + 0.3;

  // Part of the building: walls, stone plinth, hip roof; returns its four faces as edges (for windows).
  const part = (a0, a1, b0, b1, h, rise) => {
    const w = a1 - a0, d = b1 - b0, [u, v] = ab((a0 + a1) / 2, (b0 + b1) / 2);
    add(
      at(box(w, F + h - y0, d, mats.ochre), u, v, y0, T),
      at(box(w + 0.12, F + 0.5 - y0, d + 0.12, mats.stone), u, v, y0, T),
      at(kit.hipRoof(w, d, rise, mats.tile, 0.5), u, v, F + h, T),
    );
    return edges([ab(a0, b0), ab(a1, b0), ab(a1, b1), ab(a0, b1)]);
  };
  // Row of blue-framed openings on an edge, centred, `sp` apart.
  const row = (e, n, sp, w, h, y, off = 0) => {
    const [u, v] = [e.mid[0] + (off * (e.q[0] - e.p[0])) / e.len, e.mid[1] + (off * (e.q[1] - e.p[1])) / e.len];
    add(
      at(kit.windows(n, sp, w + 0.25, h + 0.25, mats.blueTrim, 0.05), u, v, y - 0.12, e.turn),
      at(kit.windows(n, sp, w, h, mats.dark, 0.1), u, v, y, e.turn),
    );
  };

  // Centre: two storeys, five bays 2.8 m apart, quoins and a string course.
  const H = 7.2, c = part(AC0, AC1, BS, BN, H, 1.8);
  const [cu, cv] = ab((AC0 + AC1) / 2, (BS + BN) / 2);
  add(at(box(AC1 - AC0 + 0.16, 0.3, BN - BS + 0.16, mats.stone), cu, cv, F + 3.55, T));
  for (const [a, b] of [[AC0, BS], [AC1, BS], [AC1, BN], [AC0, BN]]) add(at(box(0.5, H + 0.6, 0.5, mats.stone), ...ab(a, b), F - 0.6, T));
  // Faces: c[0] south-west (platform), c[2] north-east (forecourt).
  row(c[2], 2, 2.8, 1.1, 1.9, F + 0.9, -4.2); row(c[2], 2, 2.8, 1.1, 1.9, F + 0.9, 4.2);
  row(c[2], 1, 0, 1.4, 2.8, F);                       // main door, middle bay
  row(c[0], 5, 2.8, 1.2, 2.7, F);                     // doors onto the platform
  for (const e of [c[0], c[2]]) row(e, 5, 2.8, 1.0, 1.7, F + 4.4);

  // Wings: single storey.
  const nw = part(A0, AC0, BS, BN, 4.3, 1.5), se = part(AC1, A1, BS2, BN, 4.3, 1.5);
  for (const e of [nw[0], nw[2]]) row(e, 2, 2.6, 1.0, 1.8, F + 0.9);
  for (const e of [se[0], se[2]]) row(e, 3, 2.6, 1.0, 1.8, F + 0.9);
  row(nw[3], 2, 3.4, 1.0, 1.8, F + 0.9); row(se[1], 2, 3, 1.0, 1.8, F + 0.9); // end walls

  // Platform: paved slab from the south-west face to the edge, canopy on posts in front of the building.
  const BE = -7.3, BC = -6.9, ch = F + 3.4;
  const slab = (a0, a1, b0) => {
    const [u, v] = ab((a0 + a1) / 2, (b0 + BE) / 2);
    const r = kit.groundRange(site, u, v, a1 - a0, b0 - BE, T);
    add(at(box(a1 - a0, F - 0.05 - (r.lo - 0.8), b0 - BE, mats.concrete), u, v, r.lo - 0.8, T));
  };
  slab(A0 - 3, AC1, BS); slab(AC1, A1 + 3, BS2);
  const canopy = (a0, a1, b0) => {
    const [u, v] = ab((a0 + a1) / 2, (b0 + BC) / 2), [fu, fv] = ab((a0 + a1) / 2, BC);
    add(
      at(box(a1 - a0, 0.15, b0 - BC, mats.lead), u, v, ch, T),
      at(box(a1 - a0, 0.3, 0.12, mats.timber), fu, fv, ch - 0.15, T), // fascia
    );
  };
  canopy(A0, AC1, BS); canopy(AC1, A1, BS2);
  for (let a = A0 + 1.2; a <= A1 - 1; a += 4.5) add(at(box(0.14, ch - F, 0.14, mats.dark), ...ab(a, BC + 0.3), F - 0.05, T));
  return g;
}
