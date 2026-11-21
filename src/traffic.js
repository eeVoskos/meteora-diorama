// Pure road graph and motion for the ambient cars and walkers of the nature layer (no three.js, so Node can test it).
import { mulberry32, pointInRing } from './geom.js';

// Painted widths in metres, as in ground.js ROAD.
export const ROAD_WIDTH = { primary: 9, secondary: 8, tertiary: 7, street: 5.5, service: 3.5, track: 3, path: 1.5, steps: 1.5 };
const KMH = 1 / 3.6;
// Cars keep to the right, a quarter of the width off the centre line; w weights main roads at junctions and at spawn.
const CAR = {
  primary: { off: 9 / 4, v: 50 * KMH, w: 4 }, secondary: { off: 8 / 4, v: 50 * KMH, w: 4 },
  tertiary: { off: 7 / 4, v: 40 * KMH, w: 2 }, street: { off: 5.5 / 4, v: 25 * KMH, w: 1 },
};
const PAVEMENT = 0.9; // m from the painted road edge to the walker's centre line
const ROADSIDE = new Set(['primary', 'secondary', 'tertiary', 'street', 'service']);
const FOOT = new Set(['path', 'steps']);
const NEAR_MONASTERY = 300; // m: paths and steps this close to a monastery are its approach
export const CAR_TAU = 0.2, WALK_TAU = 0.35; // s, easing time of position and heading

// Graph from roads [{ c, p }]: vertices closer than `snap` metres become one node; every polyline segment is an
// edge { a, b, len, c, ...props(c) }. adj[node] lists the edges touching it.
export function buildGraph(roads, props, snap = 1.5) {
  const xs = [], ys = [], adj = [], edges = [], cells = new Map();
  const node = (x, y) => {
    const cx = Math.round(x / snap), cy = Math.round(y / snap);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
      for (const n of cells.get(`${cx + i},${cy + j}`) ?? []) if (Math.hypot(xs[n] - x, ys[n] - y) <= snap) return n;
    const n = xs.length;
    xs.push(x); ys.push(y); adj.push([]);
    const k = `${cx},${cy}`;
    (cells.get(k) ?? cells.set(k, []).get(k)).push(n);
    return n;
  };
  for (const r of roads) {
    let prev = node(r.p[0], r.p[1]);
    for (let i = 2; i < r.p.length; i += 2) {
      const n = node(r.p[i], r.p[i + 1]);
      if (n === prev) continue;
      adj[prev].push(edges.length); adj[n].push(edges.length);
      edges.push({ a: prev, b: n, len: Math.hypot(xs[n] - xs[prev], ys[n] - ys[prev]), c: r.c, ...props(r.c) });
      prev = n;
    }
  }
  return { xs, ys, adj, edges };
}

// Connected component of every edge, and each component's total length.
export function components(g) {
  const comp = new Int32Array(g.edges.length).fill(-1), length = [];
  for (let e0 = 0; e0 < g.edges.length; e0++) {
    if (comp[e0] >= 0) continue;
    const id = length.length, stack = [e0];
    let sum = 0;
    comp[e0] = id;
    while (stack.length) {
      const e = g.edges[stack.pop()];
      sum += e.len;
      for (const n of [e.a, e.b]) for (const f of g.adj[n]) if (comp[f] < 0) { comp[f] = id; stack.push(f); }
    }
    length.push(sum);
  }
  return { comp, length };
}

const rand = (a) => (a.r = (Math.imul(a.r, 1664525) + 1013904223) >>> 0) / 4294967296; // per-agent LCG, no allocation

// Where the agent wants to be: on its edge, s metres from the start, shifted sideways to its side.
function aim(g, a) {
  const e = g.edges[a.e], f = a.dir > 0 ? e.a : e.b, t = a.dir > 0 ? e.b : e.a;
  const ux = (g.xs[t] - g.xs[f]) / e.len, uy = (g.ys[t] - g.ys[f]) / e.len, o = (e.off + a.lat) * a.side;
  a.tx = g.xs[f] + ux * a.s + uy * o; // right of (ux, uy) is (uy, -ux)
  a.ty = g.ys[f] + uy * a.s - ux * o;
  a.th = Math.atan2(uy, ux);
}

// Agent on edge e travelling a→b (dir 1) or b→a (dir -1). side 1 keeps right of travel, -1 left; lat adds to the
// edge offset. k scales the edge speed (or is the speed itself when the graph has no v). x, y, h: eased position
// and heading (radians from +x towards +y) to draw.
export function makeAgent(g, { e, dir, s, k, side = 1, lat = 0, flip = false, tau, seed }) {
  const a = { e, pe: e, dir, s, k, side, lat, flip, tau, r: seed >>> 0, tx: 0, ty: 0, th: 0, x: 0, y: 0, h: 0 };
  aim(g, a);
  a.x = a.tx; a.y = a.ty; a.h = a.th;
  return a;
}

// Advance dt seconds. At a node it takes a random other edge there, weighted by the edges' w, and turns back only
// at a dead end (a walker with flip set crosses to the other side of the road when it does).
export function stepAgent(g, a, dt) {
  let e = g.edges[a.e];
  a.s += (e.v ?? 1) * a.k * dt;
  while (a.s > e.len) {
    a.s -= e.len;
    const node = a.dir > 0 ? e.b : e.a, list = g.adj[node];
    let total = 0;
    for (const f of list) if (f !== a.e) total += g.edges[f].w ?? 1;
    a.pe = a.e;
    if (total === 0) {
      a.dir = -a.dir;
      if (a.flip) a.side = -a.side;
    } else {
      let pick = rand(a) * total;
      for (const f of list) {
        if (f === a.e) continue;
        a.e = f;
        if ((pick -= g.edges[f].w ?? 1) < 0) break;
      }
      e = g.edges[a.e];
      a.dir = e.a === node ? 1 : -1;
    }
    e = g.edges[a.e];
  }
  aim(g, a);
  const q = 1 - Math.exp(-dt / a.tau);
  a.x += (a.tx - a.x) * q;
  a.y += (a.ty - a.y) * q;
  a.h += (Math.atan2(Math.sin(a.th - a.h), Math.cos(a.th - a.h))) * q;
}

// Distance from (x, y) to edge e of g.
export function edgeDistance(g, e, x, y) {
  const { a, b, len } = g.edges[e], ux = (g.xs[b] - g.xs[a]) / len, uy = (g.ys[b] - g.ys[a]) / len;
  const s = Math.max(0, Math.min(len, (x - g.xs[a]) * ux + (y - g.ys[a]) * uy));
  return Math.hypot(x - g.xs[a] - ux * s, y - g.ys[a] - uy * s);
}

// Pick n edges at random, weighted by weight(e) (0 = never), each with a random start point along it.
function spawn(g, n, weight, rng) {
  const cum = [];
  let sum = 0;
  g.edges.forEach((e, i) => { sum += weight(e, i); cum.push(sum); });
  return Array.from({ length: n }, () => {
    const u = rng() * sum;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] > u) hi = mid; else lo = mid + 1; }
    return { e: lo, dir: rng() < 0.5 ? 1 : -1, s: rng() * g.edges[lo].len, seed: Math.floor(rng() * 4294967296) };
  });
}

export const inTown = (res, x, y) => res.some((p) => pointInRing(x, y, p));

// Cars on the drivable roads (largest connected network only) and walkers along road sides in the residential
// areas and on the paved paths, steps and monastery approaches.
// 200 cars and 600 walkers: about one car per 300 m of road and one walker per 50 m of town street. Fewer than
// that and a zoomed-in street is usually empty.
export function makeTraffic(osm, { cars = 200, walkers = 600, seed = 4242 } = {}) {
  const rng = mulberry32(seed), res = osm.cover.filter((c) => c.k === 'residential').map((c) => c.p);
  const monas = osm.places.filter((p) => p.k === 'monastery');

  const carGraph = buildGraph(osm.roads.filter((r) => CAR[r.c]), (c) => CAR[c]);
  const cc = components(carGraph), main = cc.length.indexOf(Math.max(...cc.length));
  const town = (e, g) => inTown(res, (g.xs[e.a] + g.xs[e.b]) / 2, (g.ys[e.a] + g.ys[e.b]) / 2);
  const carList = spawn(carGraph, cars, (e, i) => cc.comp[i] === main ? e.len * e.w * (town(e, carGraph) ? 2 : 1) : 0, rng)
    .map((p) => makeAgent(carGraph, { ...p, k: 0.9 + 0.2 * rng(), tau: CAR_TAU }));

  // Walkers' roads: the runs of segments with both ends in town (or, for paths and steps, near a monastery).
  const keep = (c, s, x0, y0, x1, y1) => (ROADSIDE.has(c) || (FOOT.has(c) && s !== 'unpaved')) && inTown(res, x0, y0) && inTown(res, x1, y1)
    || FOOT.has(c) && monas.some((m) => Math.hypot(x0 - m.x, y0 - m.y) < NEAR_MONASTERY && Math.hypot(x1 - m.x, y1 - m.y) < NEAR_MONASTERY);
  const pieces = [];
  for (const r of osm.roads) {
    let run = null;
    for (let i = 2; i < r.p.length; i += 2) {
      if (keep(r.c, r.s, r.p[i - 2], r.p[i - 1], r.p[i], r.p[i + 1])) {
        if (!run) pieces.push(run = { c: r.c, p: [r.p[i - 2], r.p[i - 1]] });
        run.p.push(r.p[i], r.p[i + 1]);
      } else run = null;
    }
  }
  const walkGraph = buildGraph(pieces, (c) => ({ off: FOOT.has(c) ? 0 : ROAD_WIDTH[c] / 2 + PAVEMENT }));
  const wc = components(walkGraph);
  const walkList = spawn(walkGraph, walkers, (e, i) => wc.length[wc.comp[i]] >= 150 ? e.len : 0, rng)
    .map((p) => makeAgent(walkGraph, { ...p, k: 1.3 * (0.85 + 0.3 * rng()), side: rng() < 0.5 ? 1 : -1, lat: 0.4 * rng(), flip: true, tau: WALK_TAU }));

  return { carGraph, walkGraph, cars: carList, walkers: walkList, residential: res, monasteries: monas };
}
