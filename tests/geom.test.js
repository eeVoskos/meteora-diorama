import test from 'node:test';
import assert from 'node:assert/strict';
import { ringArea, centroid, pointInRing, orientedBox, mulberry32, hash01 } from '../src/geom.js';

const unit = [0, 0, 1, 0, 1, 1, 0, 1];
const reversed = [0, 0, 0, 1, 1, 1, 1, 0];
// L-shape: 10 × 10 with the north-east 5 × 5 quarter cut out.
const L = [0, 0, 10, 0, 10, 5, 5, 5, 5, 10, 0, 10];

test('unit square area is 1, reversed is -1', () => {
  assert.equal(ringArea(unit), 1);
  assert.equal(ringArea(reversed), -1);
});

test('centroid of the unit square', () => assert.deepEqual(centroid(unit), [0.5, 0.5]));

test('pointInRing: inside the L, not in its notch', () => {
  assert.equal(pointInRing(2.5, 2.5, L), true);
  assert.equal(pointInRing(7.5, 7.5, L), false);
  assert.equal(pointInRing(20, 2, L), false);
});

test('orientedBox of a 10 × 4 rectangle rotated 30°', () => {
  const a = Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
  const p = [];
  for (const [x, y] of [[-5, -2], [5, -2], [5, 2], [-5, 2]]) p.push(100 + x * c - y * s, 50 + x * s + y * c);
  const b = orientedBox(p);
  assert.ok(Math.abs(b.w - 10) < 1e-6, `w ${b.w}`);
  assert.ok(Math.abs(b.d - 4) < 1e-6, `d ${b.d}`);
  const da = ((b.angle - a) % Math.PI + Math.PI) % Math.PI;
  assert.ok(Math.min(da, Math.PI - da) < 1e-6, `angle ${b.angle}`);
  assert.ok(Math.abs(b.cx - 100) < 1e-6 && Math.abs(b.cy - 50) < 1e-6);
});

test('mulberry32 is repeatable', () => {
  const a = mulberry32(1), b = mulberry32(1);
  const x = [a(), a(), a()], y = [b(), b(), b()];
  assert.deepEqual(x, y);
  for (const v of x) assert.ok(v >= 0 && v < 1);
});

test('hash01 stays in [0,1) up to 2^53', () => {
  for (const id of [0, 1, 302995899, 9859440669, 2 ** 31, 2 ** 32 + 7, 2 ** 53 - 1, 2 ** 53]) {
    const h = hash01(id);
    assert.ok(h >= 0 && h < 1, `${id} -> ${h}`);
  }
  assert.notEqual(hash01(1), hash01(2));
  assert.notEqual(hash01(2 ** 32 + 1), hash01(1)); // high bits matter
});
