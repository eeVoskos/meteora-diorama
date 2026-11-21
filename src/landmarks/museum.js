// Natural History Museum of Meteora & Mushroom Museum — reference sheet section 3. The sheet is unsure between a
// modern two-storey flat-roofed box in dark charcoal render with a glass balcony balustrade and grey paver
// forecourt [P], and a neoclassical former school [? one tourism page]. Built as the simpler, photographed one:
// the charcoal box.
//
// Host outline (building 1180426018, ~27 × 14 m) runs nearly north–south. The front is the short north face: the
// main road passes ~15 m to the north, while a neighbour stands 4 m off the east face. The north face gets a
// glazed ground floor, a balcony with a glass balustrade above it and a paved forecourt; the long faces get wide
// window bands, and a pale floor band and roof slab give the box its modern horizontal lines.
import { edges } from './town-hall.js';

export function build(kit, site) {
  const { mats, at, group, box } = kit;
  const ring = site.ring, E = edges(ring);
  const { lo, hi } = kit.groundRange(site, 0, 0, site.box.w, site.box.d, site.box.angle);
  const y0 = lo - 1, F = hi + 0.2, top = F + 7.6;
  const g = group(
    at(kit.prism(ring, top - y0, mats.charcoal), 0, 0, y0),
    at(kit.prism(kit.offsetRing(ring, 0.25), 0.4, mats.concrete), 0, 0, top),        // roof slab
    at(kit.prism(kit.offsetRing(ring, 0.12), 0.3, mats.concrete), 0, 0, F + 3.7),    // floor band
  );
  const front = E.filter((e) => e.len > 5).reduce((a, b) => (b.n[1] > a.n[1] ? b : a));
  const o = (e, d) => [e.mid[0] + e.n[0] * d, e.mid[1] + e.n[1] * d];

  for (const e of E) {
    if (e.len < 3) continue;
    if (e === front) {
      const L = e.len - 1.2;
      g.add(
        at(kit.windows(1, 0, L - 2, 2.9, mats.glass, 0.06), ...e.mid, F, e.turn),              // glazed entrance
        at(kit.windows(1, 0, L - 1, 2.7, mats.glass, 0.06), ...e.mid, F + 4.1, e.turn),        // upper glazing
        at(box(L, 0.3, 1.8, mats.concrete), ...o(e, 0.9), F + 3.65, e.turn),                    // balcony slab
        at(box(L, 1.0, 0.05, mats.glass), ...o(e, 1.75), F + 3.95, e.turn),                     // glass balustrade
        at(kit.windows(1, 0, 1.6, 2.4, mats.dark, 0.12), ...e.mid, F, e.turn),                  // door behind the glass
      );
      // Paver forecourt: 5 m deep, at the floor level or just above the ground under it.
      const [fu, fv] = o(e, 2.5), r = kit.groundRange(site, fu, fv, e.len + 2, 5, e.turn);
      const ft = Math.max(F - 0.1, r.hi + 0.06);
      g.add(at(box(e.len + 2, ft - (r.lo - 0.6), 5, mats.concrete), fu, fv, r.lo - 0.6, e.turn));
    } else {
      const n = Math.max(1, Math.floor(e.len / 4.2));
      g.add(
        at(kit.windows(n, e.len / n, 2.6, 2.1, mats.glass), ...e.mid, F + 0.9, e.turn),
        at(kit.windows(n, e.len / n, 2.6, 2.1, mats.glass), ...e.mid, F + 4.6, e.turn),
      );
    }
  }
  return g;
}
