// Church of the Dormition (Koimisi Theotokou), Kalampaka — reference sheet section 3, "Landmarks to model".
// Low, long three-aisled stone basilica: tall nave with a gabled tile roof, lower side aisles with lean-to roofs,
// inner and outer narthex at the west end, three semicircular apses at the east end. Separate square stone bell
// tower with three tiers of paired arched openings and a pyramidal tile roof. Cypresses by the west entrance.
//
// Plan, from the OSM outline (way 609218810): a 32.4 × 12.1 m body whose long axis runs 2.8° north of east, plus a
// 6 × 7 m annex at its south-east corner. The apses are drawn inside the body's east end; the bell tower stands
// in the annex, just clear of the south apse (guess: the sheet does not say where the tower stands).

const T = 0.048; // body axis, radians north of east (from the outline's long edges)
const C = Math.cos(T), S = Math.sin(T);
const toSite = (a, b) => [a * C - b * S, a * S + b * C]; // church frame (a along the axis, b across) → site frame

export function build(kit, site) {
  const { mats, at, group, box } = kit;
  const range = (a, b, w, d) => kit.groundRange(site, ...toSite(a, b), w, d, T);
  const parts = [];
  const add = (...o) => parts.push(...o);
  // Pane rows on a face: side 'S' | 'N' | 'E' | 'W' is the direction the face looks.
  const turnOf = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
  const panes = (side, a, b, y, n, sp, w, h, m = mats.dark, gap = 0.06) => add(at(kit.windows(n, sp, w, h, m, gap), a, b, y, turnOf[side]));

  // Body: a −17.6 … 14.8, b −5.45 … 6.65 (centre line bc). Floor between the high west and low east ends;
  // the stone walls simply run down to 1 m under the lowest ground, so the east end stands on a tall base.
  const bc = 0.6, a0 = -17.6, a1 = 14.8, hw = 6.05;
  const { lo, hi } = range((a0 + a1) / 2, bc, a1 - a0, 2 * hw);
  const F = Math.max(lo + 0.5, (lo + hi) / 2 + 0.4), y0 = lo - 1;

  // Outer narthex (exonarthex): low, the full width, hipped roof.
  const ex = 3, exA = a0 + ex / 2;
  add(at(box(ex, F + 5 - y0, 2 * hw, mats.stone), exA, bc, y0));
  add(at(kit.hipRoof(ex, 2 * hw, 1.2, mats.tileDark, 0.35), exA, bc, F + 5));
  panes('W', a0, bc, F, 1, 1, 1.5, 2.6);                         // west door
  panes('S', exA, bc - hw, F + 1.4, 1, 1, 0.6, 1.2);
  panes('N', exA, bc + hw, F + 1.4, 1, 1, 0.6, 1.2);

  // Inner narthex + naos: aisle walls over the whole width, the nave rising above them.
  const e = 12, len = e - (a0 + ex), mid = (a0 + ex + e) / 2;  // east wall at a = 12, apses beyond it
  const nw = 2.9, aisleTop = F + 6.2, naveTop = F + 9.2, aisleW = hw - nw;
  add(at(box(len, aisleTop - y0, 2 * hw, mats.stone), mid, bc, y0));
  add(at(box(len + 0.3, naveTop - y0, 2 * nw, mats.stone), mid + 0.15, bc, y0));
  add(at(kit.gableRoof(len + 0.3, 2 * nw, 2.2, mats.tile, 0.45, mats.stone), mid + 0.15, bc, naveTop));
  // Lean-to aisle roofs: tilted slabs from the aisle eaves up under the nave windows.
  const rise = 1.2, slope = Math.atan2(rise, aisleW);
  for (const s of [-1, 1]) {
    const r = box(len + 0.6, 0.22, Math.hypot(aisleW, rise) + 0.5, mats.tile);
    at(r, mid, bc + s * (nw + aisleW / 2), aisleTop + rise / 2 - 0.2);
    r.rotation.x = -s * slope; // rises toward the nave
    add(r);
  }
  // Clerestory and aisle windows on both long sides, a small window in the west gable over the narthex roof.
  panes('S', mid, bc - nw, F + 7.4, 6, 3.6, 0.5, 1.2);
  panes('N', mid, bc + nw, F + 7.4, 6, 3.6, 0.5, 1.2);
  panes('S', mid + 1, bc - hw, F + 2.6, 5, 4.2, 0.6, 1.5);
  panes('N', mid + 1, bc + hw, F + 2.6, 5, 4.2, 0.6, 1.5);
  panes('W', a0 + ex, bc, F + 6.6, 2, 1.2, 0.5, 1.4);
  // Thin brick string course under the nave eaves (Byzantine cloisonné reads stone + brick).
  add(at(box(len + 0.45, 0.3, 2 * nw + 0.15, mats.brick), mid + 0.15, bc, naveTop - 0.5));

  // Three semicircular apses against the east wall, inside the mapped outline.
  // Apse walls run down to the base under the floor; the half-cone cap stays at the eave.
  const apse = (r, h, sides, b) => {
    const ap = at(kit.apse(r, h, mats.stone, mats.tile, sides), e, b, y0);
    ap.children[0].scale.y = (F + h - y0) / h;
    ap.children[1].position.y += F - y0;
    return ap;
  };
  add(apse(2.6, 7.6, 9, bc), apse(1.4, 5, 7, bc - 4.4), apse(1.4, 5, 7, bc + 4.4));
  panes('E', e + 2.62, bc, F + 3.4, 1, 1, 0.5, 1.6);             // window in the main apse

  // Separate bell tower in the south-east annex: stone shaft, three tiers of paired arched openings, pyramid roof.
  {
    const ta = 15.4, tb = -7.0, w = 4.4, t = range(ta, tb, w, w), base = t.lo - 1, top = t.hi + 17.5;
    add(at(box(w, top - base, w, mats.stone), ta, tb, base));
    for (let k = 0; k < 3; k++) {
      const y = t.hi + 6.2 + 3.6 * k;
      add(at(box(w + 0.3, 0.25, w + 0.3, mats.stone), ta, tb, y - 0.45));  // ledge under each tier
      panes('S', ta, tb - w / 2, y, 2, 1.25, 0.65, 2.1);
      panes('N', ta, tb + w / 2, y, 2, 1.25, 0.65, 2.1);
      panes('E', ta + w / 2, tb, y, 2, 1.25, 0.65, 2.1);
      panes('W', ta - w / 2, tb, y, 2, 1.25, 0.65, 2.1);
    }
    add(at(box(w + 0.4, 0.35, w + 0.4, mats.brick), ta, tb, top - 0.35));
    add(at(kit.hipRoof(w, w, 2.4, mats.tile, 0.35), ta, tb, top));
    add(at(kit.cross(1.4), ta, tb, top + 2.3));
  }

  // Crosses on the nave gables.
  add(at(kit.cross(1.2), a0 + ex - 0.2, bc, naveTop + 2.1), at(kit.cross(1.2), e + 0.3, bc, naveTop + 2.1));

  const church = at(group(...parts), 0, 0, 0, T);
  // Two cypresses flanking the west entrance (site frame, foot from the ground there).
  const cyp = [[-21, -3.2], [-21, 4.8]].map(([a, b]) => {
    const [u, v] = toSite(a, b);
    return at(kit.cypress(10), u, v, site.ground(u, v) - 0.5);
  });
  return group(church, ...cyp);
}
