// Pure layout and motion for the nature layer (no three.js, so Node can test it).
import { mulberry32 } from './geom.js';
import { makeHeightfield } from './heightfield.js';

// Rocks the bird groups wheel around (local metres, from data/osm.json places).
const ROOSTS = [
  [-89, 1361],  // Great Meteoron
  [286, 1175],  // Varlaam
  [486, 791],   // Roussanou
  [-154, 495],  // Holy Spirit rock
  [772, -137],  // Holy Trinity
  [-22, -123],  // Adrachti, above Kastraki
  [1036, -589], // Agios Stefanos
  [810, -190],  // Holy Trinity, the cliff facing the town
];
// Soarers circle high over the main rock clusters.
const THERMALS = [[150, 950, 380], [400, -250, 330], [-350, 300, 300], [920, -380, 320]]; // the last over Agios Stefanos and Holy Trinity

export const SMALL_MARGIN = 12;  // m kept above the ground
export const SOAR_MARGIN = 60;

// v wrapped into [lo, hi).
export const wrap = (v, lo, hi) => lo + ((((v - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));

function topNear(hf, x, y, r) {
  let top = -Infinity;
  for (let dx = -r; dx <= r; dx += hf.step) for (let dy = -r; dy <= r; dy += hf.step) top = Math.max(top, hf.at(x + dx, y + dy));
  return top;
}

// Every bird as plain numbers: orbit centre (cx, cy), radius, angular speed, phase, base height.
export function makeBirds(hf, seed = 2611) {
  const rng = mulberry32(seed), birds = [];
  for (const [x, y] of ROOSTS) {
    const top = topNear(hf, x, y, 48);
    const n = 5 + Math.floor(rng() * 8);                                  // 5–12 per group
    const R = 70 + rng() * 70;                                            // group orbit radius
    const h = top + (rng() - 0.5) * 70;                                   // some below the top, beside the faces
    const dir = rng() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const r = R * (0.6 + 0.6 * rng()), speed = 11 + 4 * rng();
      birds.push({ soar: false, cx: x + (rng() - 0.5) * 60, cy: y + (rng() - 0.5) * 60, r, w: dir * speed / r,
        ph: rng() * Math.PI * 2, h: h + (rng() - 0.5) * 30, wob: rng() * Math.PI * 2, flap: 14 + 4 * rng() });
    }
  }
  for (const [x, y, r] of THERMALS) {
    birds.push({ soar: true, cx: x, cy: y, r, w: -10 / r, ph: rng() * Math.PI * 2, h: hf.max + 120 + rng() * 80, wob: rng() * Math.PI * 2, flap: 2 });
  }
  return birds;
}

// The ground spread sideways at a slope of 1 in 2 (max over the grid of height - 0.5 × distance), so a bird
// kept above it climbs and sinks gently around a cliff instead of hopping up or dropping off it.
// Same shape as hf (it has .at); every value is at least the real ground height.
export function clearance(hf, slope = 0.5) {
  const { nx, ny, step } = hf, g = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g[j * nx + i] = hf.at(hf.x0 + i * step, hf.y0 + j * step);
  const s1 = slope * step, s2 = s1 * Math.SQRT2;
  const pass = (i, j, di, dj) => {
    let v = g[j * nx + i];
    const take = (a, b, d) => { if (a >= 0 && a < nx && b >= 0 && b < ny) v = Math.max(v, g[b * nx + a] - d); };
    take(i - di, j, s1); take(i, j - dj, s1); take(i - di, j - dj, s2); take(i + di, j - dj, s2);
    g[j * nx + i] = v;
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pass(i, j, 1, 1);
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) pass(i, j, -1, -1);
  return makeHeightfield(hf, Uint16Array.from(g, (v) => Math.ceil(v * 10)));
}

// ground = clearance(hf). Position (x, y local; z = height), heading (radians, from +x towards +y), bank and wing angle at time t.
export function birdAt(b, t, ground) {
  const a = b.ph + b.w * t;
  const r = b.r * (1 + (b.soar ? 0.08 : 0.25) * Math.sin(t * 0.3 + b.wob));
  const x = b.cx + Math.cos(a) * r, y = b.cy + Math.sin(a) * r;
  const heading = a + Math.sign(b.w) * Math.PI / 2;
  const z = Math.max(b.h + (b.soar ? 15 : 8) * Math.sin(t * 0.5 + b.wob), ground.at(x, y) + (b.soar ? SOAR_MARGIN : SMALL_MARGIN));
  // Small birds flap in bursts and glide between; soarers barely move their wings.
  const flap = b.soar ? 0.12 + 0.04 * Math.sin(t * b.flap + b.wob)
    : Math.sin(t * 0.7 + b.wob) > -0.2 ? 0.55 * Math.sin(t * b.flap + b.wob) : 0.15;
  return { x, y, z, heading, bank: -Math.sign(b.w) * (b.soar ? 0.25 : 0.4), flap };
}

export const WIND = { x: 4, y: -2.5 }; // m/s, one shared wind from the north-west
const FADE = 350;                       // m over which a cloud fades in or out at the block edge

// 8 clumps, 150–400 m across, 850–1100 m up. blobs: [dx, dy, dz, radius] in metres around the clump centre.
export function makeClouds(hf, seed = 1977) {
  const rng = mulberry32(seed), w = (hf.nx - 1) * hf.step, h = (hf.ny - 1) * hf.step, clouds = [];
  for (let i = 0; i < 8; i++) {
    const size = 150 + rng() * 250, n = 4 + Math.floor(rng() * 2), blobs = [];
    for (let k = 0; k < n; k++) {
      const r = size * (0.18 + 0.1 * rng());
      blobs.push([(rng() - 0.5) * (size - 2 * r), (rng() - 0.5) * (size - 2 * r) * 0.6, rng() * r * 0.4, r]);
    }
    // Spread along x in even slots so they never bunch up.
    clouds.push({ x: hf.x0 + w * (i + rng() * 0.6) / 8, y: hf.y0 + h * rng(), z: 850 + rng() * 250, size, blobs });
  }
  return clouds;
}

// Cloud centre at time t (wrapped inside the block) and its opacity factor 0..1, fading near the edges.
export function cloudAt(c, t, hf) {
  const x1 = hf.x0 + (hf.nx - 1) * hf.step, y1 = hf.y0 + (hf.ny - 1) * hf.step;
  const x = wrap(c.x + WIND.x * t, hf.x0, x1), y = wrap(c.y + WIND.y * t, hf.y0, y1);
  const edge = Math.min(x - hf.x0, x1 - x, y - hf.y0, y1 - y);
  return { x, y, fade: Math.min(1, Math.max(0, edge / FADE)) };
}
