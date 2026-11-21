// Pure polygon helpers (no three.js, so Node can test them). Rings are flat [x0,y0,x1,y1,…], not closed.

// Block rectangle in local metres (tools/geo.py X0, X1, Y0, Y1); the origin is not its centre.
export const BLOCK = { x0: -1840, x1: 2400, y0: -1980, y1: 1836 };
export const inBlock = (x, y) => x >= BLOCK.x0 && x <= BLOCK.x1 && y >= BLOCK.y0 && y <= BLOCK.y1;

// Signed area in m², positive when counter-clockwise.
export function ringArea(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i += 2) {
    const j = (i + 2) % n;
    a += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return a / 2;
}

// Area centroid; falls back to the vertex mean for degenerate rings.
export function centroid(p) {
  let a = 0, cx = 0, cy = 0;
  const x0 = p[0], y0 = p[1]; // shift to the first vertex to keep precision
  for (let i = 0, n = p.length; i < n; i += 2) {
    const j = (i + 2) % n;
    const xi = p[i] - x0, yi = p[i + 1] - y0, xj = p[j] - x0, yj = p[j + 1] - y0;
    const c = xi * yj - xj * yi;
    a += c; cx += (xi + xj) * c; cy += (yi + yj) * c;
  }
  if (Math.abs(a) < 1e-9) {
    let sx = 0, sy = 0;
    for (let i = 0; i < p.length; i += 2) { sx += p[i]; sy += p[i + 1]; }
    return [sx / (p.length / 2), sy / (p.length / 2)];
  }
  return [x0 + cx / (3 * a), y0 + cy / (3 * a)];
}

export function pointInRing(x, y, p) {
  let inside = false;
  for (let i = 0, n = p.length, j = n - 2; i < n; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Convex hull (monotone chain) as [[x, y], …], counter-clockwise.
function hull(p) {
  const pts = [];
  for (let i = 0; i < p.length; i += 2) pts.push([p[i], p[i + 1]]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of pts) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const q = pts[i];
    while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop();
    hi.push(q);
  }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// Minimum-area enclosing rectangle: one side lies on a hull edge, so try every edge.
export function orientedBox(p) {
  const h = hull(p);
  let best = null;
  for (let i = 0; i < h.length; i++) {
    const [ax, ay] = h[i], [bx, by] = h[(i + 1) % h.length];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-9) continue;
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of h) {
      const u = x * ux + y * uy, v = -x * uy + y * ux;
      if (u < u0) u0 = u; if (u > u1) u1 = u;
      if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area - 1e-9) best = { area, ux, uy, u0, u1, v0, v1 };
  }
  if (!best) { const [cx, cy] = centroid(p); return { cx, cy, w: 0, d: 0, angle: 0 }; }
  const { ux, uy, u0, u1, v0, v1 } = best;
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
  const cx = um * ux - vm * uy, cy = um * uy + vm * ux;
  let w = u1 - u0, d = v1 - v0, angle = Math.atan2(uy, ux);
  if (d > w) { [w, d] = [d, w]; angle += Math.PI / 2; }
  angle = ((angle % Math.PI) + Math.PI) % Math.PI;
  return { cx, cy, w, d, angle };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable [0,1) hash of an OSM id; uses both 32-bit halves so ids beyond 2^32 still spread.
export function hash01(id) {
  const lo = id >>> 0, hi = Math.floor(id / 4294967296) >>> 0;
  let h = Math.imul(lo ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(hi + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
