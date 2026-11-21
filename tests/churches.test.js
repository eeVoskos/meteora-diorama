import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { churchPlan, churchIds } from '../src/rules.js';

// L × W rectangle centred on (cx, cy), long side turned `a` radians from east.
const rect = (L, W, a = 0, cx = 100, cy = 50) => {
  const c = Math.cos(a), s = Math.sin(a), p = [];
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.push(cx + (u * L / 2) * c - (v * W / 2) * s, cy + (u * L / 2) * s + (v * W / 2) * c);
  return { id: 42, p, t: 'church' };
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

test('small footprint is a chapel', () => assert.equal(churchPlan(rect(6, 4)).kind, 'chapel'));

test('20 × 10 turned 30° is a parish church along its long axis', () => {
  const pl = churchPlan(rect(20, 10, Math.PI / 6));
  assert.equal(pl.kind, 'parish');
  assert.ok(near(pl.len, 20, 1e-3) && near(pl.wid, 10, 1e-3), `${pl.len} × ${pl.wid}`);
  assert.ok(near(((pl.angle % Math.PI) + Math.PI) % Math.PI, Math.PI / 6, 1e-3), `angle ${pl.angle}`);
  assert.ok(near(pl.cx, 100, 1e-3) && near(pl.cy, 50, 1e-3));
  const endX = (sgn) => pl.cx + sgn * (pl.len / 2) * Math.cos(pl.angle);
  assert.ok(endX(pl.east) > endX(-pl.east), 'east end has the larger x');
});

test('east flips for an axis pointing north-west', () => {
  const pl = churchPlan(rect(20, 10, (5 * Math.PI) / 6));
  const endX = (sgn) => pl.cx + sgn * (pl.len / 2) * Math.cos(pl.angle);
  assert.ok(endX(pl.east) > endX(-pl.east));
});

test('25 × 20 is large', () => assert.equal(churchPlan(rect(25, 20)).kind, 'large'));

test('square footprint does not throw', () => {
  const pl = churchPlan(rect(10, 10));
  assert.ok(pl.len >= pl.wid);
});

test('L-shaped footprint: plan fits the bounding box', () => {
  const p = [0, 0, 20, 0, 20, 6, 8, 6, 8, 14, 0, 14];
  const pl = churchPlan({ id: 7, p, t: 'church' });
  const c = Math.cos(pl.angle), s = Math.sin(pl.angle);
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = pl.cx + (u * pl.len / 2) * c - (v * pl.wid / 2) * s, y = pl.cy + (u * pl.len / 2) * s + (v * pl.wid / 2) * c;
    assert.ok(x >= -1e-6 && x <= 20 + 1e-6 && y >= -1e-6 && y <= 14 + 1e-6, `${x},${y}`);
  }
});

test('every church on the real data gets a finite plan', () => {
  const osm = JSON.parse(readFileSync(new URL('../data/osm.json', import.meta.url)));
  const churches = osm.buildings.filter((b) => b.t === 'church');
  assert.ok(churches.length > 0);
  for (const b of churches) {
    const pl = churchPlan(b);
    for (const k of ['cx', 'cy', 'len', 'wid', 'angle', 'east']) assert.ok(Number.isFinite(pl[k]), `${b.id} ${k}`);
    assert.ok(['chapel', 'parish', 'large'].includes(pl.kind) && Math.abs(pl.east) === 1);
  }
});

const axisOffEW = (a) => { const m = ((a % Math.PI) + Math.PI) % Math.PI; return Math.min(m, Math.PI - m); };

test('near-square footprint runs its nave east–west', () => {
  const pl = churchPlan(rect(20, 18, (70 * Math.PI) / 180));
  assert.ok(axisOffEW(pl.angle) <= (25 * Math.PI) / 180, `axis ${(pl.angle * 180) / Math.PI}°`);
});

test('elongated footprint keeps its long axis', () => {
  const pl = churchPlan(rect(20, 10, (70 * Math.PI) / 180));
  assert.ok(Math.abs(pl.angle - (70 * Math.PI) / 180) < 1e-3 && Math.abs(pl.len - 20) < 1e-3);
});

test('churchIds leaves out landmarks and slivers under 3 m wide', () => {
  const osm = { buildings: [{ ...rect(20, 10), id: 1 }, { ...rect(28, 1.4), id: 2 }, { ...rect(8, 5), id: 3 }, { id: 4, p: rect(8, 5).p }] };
  assert.deepEqual([...churchIds(osm, new Set([3]))], [1]);
});

test('Οσίων Μετεωριτών Πατέρων has its apse within 25° of east', () => {
  const osm = JSON.parse(readFileSync(new URL('../data/osm.json', import.meta.url)));
  const pl = churchPlan(osm.buildings.find((b) => b.id === 379736575));
  const dir = pl.angle + (pl.east < 0 ? Math.PI : 0);
  assert.ok(Math.abs(Math.atan2(Math.sin(dir), Math.cos(dir))) <= (25 * Math.PI) / 180, `apse at ${(dir * 180) / Math.PI}°`);
});
