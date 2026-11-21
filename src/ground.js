import { P } from './palette.js';
import { BLOCK } from './geom.js';

const X0 = BLOCK.x0, Y0 = BLOCK.y0, W = BLOCK.x1 - BLOCK.x0, H = BLOCK.y1 - BLOCK.y0;

// Paint order: natural cover (residential is the town ground), then town surfaces over it.
const COVER = ['farmland', 'grass', 'orchard', 'residential', 'scrub', 'wood', 'gravel'];
const TOWN = ['park', 'garden', 'cemetery', 'square', 'parking', 'school', 'playground'];
const FILL = {
  residential: P.townGround, wood: P.forest, park: P.garden, garden: P.garden, cemetery: P.cemetery,
  square: P.pavers, parking: P.carPark, school: P.schoolYard, playground: P.playground,
};
const FARM = [P.farmland, P.ploughed, P.dryGrass, P.farmland]; // patchwork, picked per field
const PAVED = new Set(['street', 'tertiary', 'secondary', 'primary']); // get pavements in town
const CENTRE = [-277, -817]; // town hall: garden speckle thins out towards it
const GARDEN = [[P.garden, 0.9], [P.grass, 0.85], [P.scrub, 0.8], [P.dryGrass, 0.6]]; // tone, alpha
const ROAD = { // width m, fill, casing (paved classes only)
  primary: [9, P.asphalt, true], secondary: [8, P.asphalt, true], tertiary: [7, P.asphalt, true],
  street: [5.5, P.asphalt, true], service: [3.5, P.pavers, true],
  track: [3, P.dirt, false], path: [1.5, P.gravel, false], steps: [1.5, P.pavers, false],
};
const ROAD_ORDER = ['path', 'steps', 'track', 'service', 'street', 'tertiary', 'secondary', 'primary'];

// Canvas whose drawing coordinates are local metres, north up, covering the block exactly.
function sheet(scale) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const g = c.getContext('2d');
  g.setTransform(c.width / W, 0, 0, -c.height / H, -X0 * c.width / W, (Y0 + H) * c.height / H);
  return [c, g];
}

function ring(g, p) {
  g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.closePath();
}

function line(g, p) {
  g.beginPath();
  g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.stroke();
}

function rand(seed) { // small LCG, so the patchwork is the same on every load
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function fillArea(g, c, style) { // leaves the area as the current path, for clipping
  g.beginPath();
  ring(g, c.p);
  for (const h of c.h ?? []) ring(g, h);
  g.fillStyle = style;
  g.fill('evenodd');
}

function bbox(p) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
  }
  return [x0, y0, x1, y1];
}

function centroid(p) { // vertex mean: enough for the convex-ish areas it is used on
  let x = 0, y = 0;
  for (let i = 0; i < p.length; i += 2) { x += p[i]; y += p[i + 1]; }
  return [x * 2 / p.length, y * 2 / p.length];
}

function inside(x, y, p) { // even-odd ray cast
  let c = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    if ((p[i + 1] > y) !== (p[j + 1] > y) && x < p[i] + (y - p[i + 1]) * (p[j] - p[i]) / (p[j + 1] - p[i + 1])) c = !c;
  }
  return c;
}

function axis(p) { // unit vector and length of the longest edge
  let best = [1, 0, 0];
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const dx = p[i] - p[j], dy = p[i + 1] - p[j + 1], l = Math.hypot(dx, dy);
    if (l > best[2]) best = [dx / l, dy / l, l];
  }
  return best;
}

// Town ground: soft earth and concrete blotches, then clusters of irregular garden patches,
// sparse near the centre and denser towards the edges. Clipped to the residential outline.
function townGround(g, c, r) {
  const [x0, y0, x1, y1] = bbox(c.p), w = x1 - x0, h = y1 - y0;
  g.save();
  g.beginPath(); ring(g, c.p); g.clip();
  for (let i = 0, n = w * h / 2500; i < n; i++) {
    g.globalAlpha = 0.05 + r() * 0.07;
    g.fillStyle = r() < 0.5 ? P.dirt : P.gravel;
    g.beginPath();
    g.arc(x0 + r() * w, y0 + r() * h, 15 + r() * 35, 0, Math.PI * 2);
    g.fill();
  }
  // One small path per garden: a single path with thousands of blobs rasterises far slower.
  for (let i = 0, n = w * h / 300; i < n; i++) {
    const x = x0 + r() * w, y = y0 + r() * h;
    if (r() > 0.15 + Math.hypot(x - CENTRE[0], y - CENTRE[1]) / 800 || !inside(x, y, c.p)) continue;
    const t = r(), [tone, alpha] = GARDEN[t < 0.4 ? 0 : t < 0.7 ? 1 : t < 0.88 ? 2 : 3];
    g.beginPath();
    for (let k = 2 + r() * 5; k > 0; k--) {
      const bx = x + (r() - 0.5) * 12, by = y + (r() - 0.5) * 12, rr = 1.5 + r() * 4, a0 = r() * 6;
      for (let v = 0; v < 6; v++) { // irregular hexagon, same winding for every blob so they union
        const a = a0 + v * Math.PI / 3, q = rr * (0.6 + r() * 0.6);
        g[v ? 'lineTo' : 'moveTo'](bx + Math.cos(a) * q, by + Math.sin(a) * q);
      }
      g.closePath();
    }
    g.globalAlpha = alpha * (0.75 + r() * 0.25); g.fillStyle = tone;
    g.fill();
  }
  g.restore();
}

// Rows of white tombs on cemetery gravel.
function tombs(g, c, r) {
  const [x0, y0, x1, y1] = bbox(c.p);
  g.save();
  g.clip('evenodd');
  g.fillStyle = P.wall[0];
  for (let y = y0 + 1; y < y1; y += 3.4) for (let x = x0 + 1; x < x1; x += 1.9) if (r() < 0.7) g.fillRect(x, y, 1.2, 2.2);
  g.restore();
}

// Faint bay lines in pairs of rows either side of an aisle, along the longest edge.
function bays(g, c) {
  const [ux, uy] = axis(c.p), [cx, cy] = centroid(c.p), [x0, y0, x1, y1] = bbox(c.p);
  const R = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
  g.save();
  g.clip('evenodd');
  g.transform(ux, uy, -uy, ux, cx, cy);
  g.beginPath();
  for (let v = -R; v < R; v += 16) for (let u = -R; u < R; u += 2.5) {
    g.moveTo(u, v); g.lineTo(u, v + 5); g.moveTo(u, v + 11); g.lineTo(u, v + 16);
  }
  g.strokeStyle = P.wall[0]; g.globalAlpha = 0.45; g.lineWidth = 0.3;
  g.stroke();
  g.restore();
}

// Grass pitches (soccer and unspecified) and hard courts, each with a white outline just inside
// its edge; a rectangular grass pitch also gets a halfway line and, when full size, a centre circle.
function pitch(g, c) {
  const grassy = !c.sp || c.sp === 'soccer';
  fillArea(g, c, grassy ? P.pitchGrass : P.court);
  g.save();
  g.clip('evenodd');
  g.strokeStyle = P.wall[0]; g.lineWidth = grassy ? 2 : 1.2;
  g.beginPath(); ring(g, c.p); g.stroke();
  if (grassy && c.p.length === 8) {
    const [ux, uy, len] = axis(c.p), [cx, cy] = centroid(c.p);
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx + uy * 100, cy - ux * 100); g.lineTo(cx - uy * 100, cy + ux * 100); g.stroke();
    if (len > 80) { g.beginPath(); g.arc(cx, cy, 9.15, 0, Math.PI * 2); g.stroke(); }
  }
  g.restore();
}

// Ground classes measured from imagery: one colour per class,
// drawn over the natural cover and under the town surfaces and roads. Class 0 (shadow, roof) keeps what is there.
const CLASS = [null, P.grass, P.forest, P.dryGrass, P.pavement];
function paintClasses(g, { w, h, cls }) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d'), img = x.createImageData(w, h);
  const rgb = CLASS.map((hex) => hex && [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  for (let i = 0; i < cls.length; i++) {
    const v = rgb[cls[i]];
    if (v) img.data.set([v[0], v[1], v[2], 235], i * 4);
  }
  x.putImageData(img, 0, 0);
  g.drawImage(c, X0, Y0, W, H); // row 0 is the south edge, and the sheet's y axis already points north
}

export function paintGround(osm, maxSize, classes) {
  const scale = Math.min(1, maxSize / Math.max(W, H)); // 1 px per metre where the GPU allows
  const [ground, g] = sheet(scale);
  g.lineJoin = g.lineCap = 'round';

  // Base: scrub grass with soft blotches of dry grass and scrub so open ground is not one flat tone.
  g.fillStyle = P.grass;
  g.fillRect(X0, Y0, W, H);
  const r = rand(7);
  for (let i = 0; i < 2600; i++) {
    g.globalAlpha = 0.05 + r() * 0.1;
    g.fillStyle = r() < 0.55 ? P.dryGrass : P.scrub;
    g.beginPath();
    g.arc(X0 + r() * W, Y0 + r() * H, 30 + r() * 90, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  const tr = rand(11);
  for (const k of COVER) {
    for (const [i, c] of osm.cover.entries()) {
      if (c.k !== k) continue;
      fillArea(g, c, k === 'farmland' ? FARM[i % FARM.length] : FILL[k] ?? P[k]);
      if (k === 'residential') townGround(g, c, tr);
    }
  }
  paintClasses(g, classes);
  for (const k of TOWN) {
    for (const c of osm.cover) {
      if (c.k !== k) continue;
      fillArea(g, c, FILL[k]);
      if (k === 'cemetery') tombs(g, c, tr);
      if (k === 'parking') bays(g, c);
    }
  }
  // Lawns inside the town (the town-hall square's beds, school lawns) go back over the surfaces.
  const town = osm.cover.filter(c => c.k === 'residential' || TOWN.includes(c.k));
  for (const c of osm.cover) {
    if (c.k === 'grass' && town.some(t => inside(...centroid(c.p), t.p))) fillArea(g, c, P.grass);
  }
  // Unspecified pitches first: they are often a whole sports ground with the fields inside.
  // A paragliding "pitch" is a hillside launch, not a court, so it keeps the ground under it.
  for (const c of osm.cover.filter(c => c.k === 'pitch' && c.sp !== 'paragliding').sort((a, b) => !!a.sp - !!b.sp)) pitch(g, c);
  for (const c of osm.cover) if (c.k === 'track') fillArea(g, c, P.runTrack);
  for (const c of osm.cover) {
    if (c.k !== 'pool') continue;
    g.beginPath(); ring(g, c.p);
    g.strokeStyle = P.wall[0]; g.lineWidth = 2.5; g.stroke(); // pale deck
    g.fillStyle = P.pool; g.fill();
  }
  for (const c of osm.cover) if (c.k === 'water') fillArea(g, c, P.water);

  // Pavements: about 1.5 m each side of paved streets and main roads, outside the 0.6 m kerb
  // casing, only on town ground.
  g.strokeStyle = P.pavement;
  for (const c of osm.cover) {
    if (c.k !== 'residential') continue;
    g.save();
    g.beginPath(); ring(g, c.p); g.clip();
    for (const rd of osm.roads) {
      if (PAVED.has(rd.c) && rd.s !== 'unpaved') { g.lineWidth = ROAD[rd.c][0] + 4.2; line(g, rd.p); }
    }
    g.restore();
  }
  // Roads: casings (kerbs) of every paved class first, then the fills from minor to major,
  // coloured by surface where the map gives one.
  for (const cls of ROAD_ORDER) {
    const [w, , casing] = ROAD[cls];
    if (!casing) continue;
    g.strokeStyle = P.rockShade; g.lineWidth = w + 1.2;
    for (const rd of osm.roads) if (rd.c === cls && rd.s !== 'unpaved') line(g, rd.p);
  }
  for (const cls of ROAD_ORDER) {
    const [w, fill] = ROAD[cls];
    g.lineWidth = w;
    for (const rd of osm.roads) {
      if (rd.c !== cls) continue;
      g.strokeStyle = rd.s === 'pavers' ? P.pavers : rd.s === 'unpaved' ? P.dirt : fill;
      line(g, rd.p);
    }
  }

  // Railway: pale ballast bed under a thin dark track.
  g.strokeStyle = P.gravel; g.lineWidth = 4;
  for (const rl of osm.rail) line(g, rl.p);
  g.strokeStyle = P.rockStreak; g.lineWidth = 1.5;
  for (const rl of osm.rail) line(g, rl.p);

  return { ground, rockMask: rockMask(osm.rocks) };
}

// 2 m per pixel, white inside rock outlines, box-blurred 5 × 5 px by shifted additive copies
// (portable: canvas `filter` is missing in some Safari versions).
function rockMask(rocks) {
  const [hard, g] = sheet(0.5);
  g.fillStyle = '#000'; g.fillRect(X0, Y0, W, H);
  g.fillStyle = '#fff';
  // One path per outline: overlapping rings of opposite winding would cancel under one nonzero fill.
  for (const rk of rocks) { g.beginPath(); ring(g, rk.p); g.fill(); }
  const out = document.createElement('canvas');
  out.width = hard.width; out.height = hard.height;
  const o = out.getContext('2d');
  o.fillStyle = '#000'; o.fillRect(0, 0, out.width, out.height);
  o.globalCompositeOperation = 'lighter';
  o.globalAlpha = 1 / 25;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) o.drawImage(hard, dx, dy);
  return out;
}
