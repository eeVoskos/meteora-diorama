// Kalampaka town hall (Δημαρχείο) — reference sheet section 3, from 2014-era photos [P 2014]: two-storey white
// corner building, chamfered arched entrance on the corner, blue window frames, a blue iron balcony wrapping
// the upper floor, wide-eaved terracotta hipped roof, blue "ΔΗΜΑΡΧΕΙΟ" lettering. No fountain.
//
// The OSM outline (way 302995899) is an L: a west wing (~8.5 m deep) and a south-east wing (~11 m deep) meeting
// at the south-west, where a ~4 m cut corner faces the roads and the square; that cut is the entrance. Walls
// follow the outline exactly and the roof is hipped over the same outline. The balcony runs along the street
// faces (outward normal toward the south-west half); the courtyard faces to the north-east get plain windows.
import * as THREE from 'three';

// Edges of a ring with their outward normal n and the kit `turn` that makes a helper's front (−v) face outward.
export function edges(ring) {
  const N = ring.length;
  let area = 0;
  for (let i = 0; i < N; i++) { const [a, b] = ring[i], [c, d] = ring[(i + 1) % N]; area += a * d - c * b; }
  const s = Math.sign(area) || 1;
  return ring.map((p, i) => {
    const q = ring[(i + 1) % N], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
    const n = [(s * dy) / len, (-s * dx) / len];
    return { p, q, len, n, mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], turn: Math.atan2(n[0], -n[1]) };
  });
}

// Hipped roof over any outline: slopes from the eaves (`overhang` outside the walls) up to the outline inset by
// `inset`, closed by a flat cap there; `rise` is eaves → cap. Sits so the slope meets the wall tops at y = 0.
export function ringRoof(kit, ring, rise, inset, overhang, mat) {
  const out = kit.offsetRing(ring, overhang), inn = kit.offsetRing(ring, -inset);
  const y0 = (-rise * overhang) / (overhang + inset), y1 = y0 + rise;
  const pts = [], N = ring.length, P = ([u, v], y) => [u, y, -v];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    pts.push(P(out[i], y0), P(out[j], y0), P(inn[j], y1), P(out[i], y0), P(inn[j], y1), P(inn[i], y1));
  }
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(inn.map(([u, v]) => new THREE.Vector2(u, v)), []))
    pts.push(P(inn[a], y1), P(inn[b], y1), P(inn[c], y1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// Window row on an edge: blue frames behind dark panes, n evenly spaced, bottoms at y.
function framedRow(kit, e, n, w, h, y, frame = kit.mats.blueTrim) {
  const sp = e.len / n;
  return kit.group(
    kit.at(kit.windows(n, sp, w + 0.3, h + 0.3, frame, 0.05), e.mid[0], e.mid[1], y - 0.15, e.turn),
    kit.at(kit.windows(n, sp, w, h, kit.mats.dark, 0.1), e.mid[0], e.mid[1], y, e.turn),
  );
}

export function build(kit, site) {
  const { mats, at, group, box } = kit;
  const ring = site.ring, E = edges(ring);
  const { lo, hi } = kit.groundRange(site, 0, 0, site.box.w, site.box.d, site.box.angle);
  const y0 = lo - 1, F = hi + 0.3, top = F + 8.2; // two tall civic storeys of ~4 m
  const g = group(
    at(kit.prism(ring, top - y0, mats.white), 0, 0, y0),
    at(kit.prism(kit.offsetRing(ring, 0.08), F + 0.6 - y0, mats.concrete), 0, 0, y0), // grey plinth
    at(ringRoof(kit, ring, 2.6, 3.6, 1.0, mats.tile), 0, 0, top + 0.05),                // wide eaves
  );

  // Entrance: the cut corner, the edge facing furthest south-west.
  const door = E.reduce((a, b) => (b.n[0] + b.n[1] < a.n[0] + a.n[1] ? b : a));
  const street = (e) => e.n[0] * -0.5 + e.n[1] * -0.85 > 0.1;

  let k = 0;
  E.forEach((e, i) => {
    if (e === door) {
      const arch = new THREE.Mesh(new THREE.CircleGeometry(1.05, 6, 0, Math.PI).translate(0, 2.5, 0.1), mats.dark);
      const archFrame = new THREE.Mesh(new THREE.CircleGeometry(1.35, 6, 0, Math.PI).translate(0, 2.5, 0.05), mats.blueTrim);
      g.add(
        at(kit.windows(1, 0, 2.7, 2.5, mats.blueTrim, 0.05), e.mid[0], e.mid[1], F, e.turn),
        at(kit.windows(1, 0, 2.1, 2.5, mats.dark, 0.1), e.mid[0], e.mid[1], F, e.turn),
        at(group(archFrame, arch), e.mid[0], e.mid[1], F, e.turn),
        framedRow(kit, e, 1, 1.4, 2.4, F + 4.05),
        at(kit.windows(9, 0.36, 0.26, 0.42, mats.blueTrim, 0.06), e.mid[0], e.mid[1], F + 6.95, e.turn), // ΔΗΜΑΡΧΕΙΟ
      );
    } else if (e.len >= 3) {
      const n = Math.max(1, Math.floor(e.len / 3.4));
      g.add(framedRow(kit, e, n, 1.1, 1.8, F + 1.0));
      g.add(street(e) ? framedRow(kit, e, n, 1.1, 2.4, F + 4.05) : framedRow(kit, e, n, 1.1, 1.8, F + 4.9));
    }
    if (street(e)) { // balcony slab and blue iron rail, lengthened at ends that meet another balcony
      const s0 = street(E[(i - 1 + E.length) % E.length]) ? 1.1 : 0, s1 = street(E[(i + 1) % E.length]) ? 1.1 : 0;
      const L = e.len + s0 + s1, sh = (s1 - s0) / 2 / e.len;
      const o = (d) => [e.mid[0] + e.n[0] * d + (e.q[0] - e.p[0]) * sh, e.mid[1] + e.n[1] * d + (e.q[1] - e.p[1]) * sh];
      g.add(
        at(box(L, 0.18, 1.1, mats.white), ...o(0.55), F + 3.85 + 0.01 * k, e.turn),
        at(box(L, 0.95, 0.06, mats.blueTrim), ...o(1.08), F + 4.03, e.turn),
      );
      k++;
    }
  });
  return g;
}
