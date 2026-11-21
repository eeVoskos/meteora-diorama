// Prints what the map and the terrain say about one landmark site, in the model's own frame: u east, v north,
// metres, origin at the outline centroid (the same origin `siteFor` in src/landmarks/index.js gives a module).
// Usage: node tools/site-info.mjs <landmark key>      e.g. node tools/site-info.mjs varlaam
import { readFileSync } from 'node:fs';
import { centroid, pointInRing } from '../src/geom.js';
import { LANDMARKS, landmarkRing } from '../src/landmarks/registry.js';

const at = (f) => new URL(`../${f}`, import.meta.url);
const l = LANDMARKS.find((x) => x.key === process.argv[2]);
if (!l) { console.error('keys:', LANDMARKS.map((x) => x.key).join(' ')); process.exit(1); }
const osm = JSON.parse(readFileSync(at('data/osm.json')));
const { ring } = landmarkRing(l, osm);
const [cx, cy] = centroid(ring);
const rel = (p) => { const o = []; for (let i = 0; i < p.length; i += 2) o.push(`(${Math.round(p[i] - cx)},${Math.round(p[i + 1] - cy)})`); return o.join(' '); };
const near = (p, d) => { for (let i = 0; i < p.length; i += 2) if (Math.hypot(p[i] - cx, p[i + 1] - cy) < d) return true; return false; };

console.log(`${l.key}: outline centroid at map x=${cx.toFixed(1)} y=${cy.toFixed(1)}`);
console.log('outline:', rel(ring));
for (const b of osm.buildings) if (near(b.p, 120)) console.log(`building ${b.id} ${b.t ?? ''} ${pointInRing(...centroid(b.p), ring) ? 'INSIDE' : 'outside'}:`, rel(b.p));
for (const r of osm.roads) if (near(r.p, 220)) console.log(`road ${r.c}${r.s ? ' ' + r.s : ''}:`, rel(r.p));
for (const c of osm.cover) if (near(c.p, 120)) console.log(`ground ${c.k}:`, rel(c.p));

const h = JSON.parse(readFileSync(at('private/heights.json'))), bin = readFileSync(at('private/heights.bin'));
const z = (x, y) => {
  const i = Math.min(h.nx - 1, Math.max(0, Math.round((x - h.x0) / h.step))), j = Math.min(h.ny - 1, Math.max(0, Math.round((y - h.y0) / h.step)));
  return bin.readUInt16LE(2 * (j * h.nx + i)) * (h.unit ?? 0.1);
};
const inside = [];
for (let v = -150; v <= 150; v += 4) for (let u = -150; u <= 150; u += 4) if (pointInRing(cx + u, cy + v, ring)) inside.push(z(cx + u, cy + v));
inside.sort((a, b) => a - b);
const base = inside[inside.length >> 1];
console.log(`terrain from ${dir}/, relative to the median height under the outline (about what site.ground returns), 12 m lattice, rows north to south:`);
const us = []; for (let u = -120; u <= 120; u += 12) us.push(u);
console.log('   u:' + us.map((u) => String(u).padStart(5)).join(''));
for (let v = 120; v >= -120; v -= 12) console.log(`v=${String(v).padStart(4)}` + us.map((u) => String(Math.round(z(cx + u, cy + v) - base)).padStart(5)).join(''));
