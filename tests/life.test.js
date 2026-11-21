import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeHeightfield } from '../src/heightfield.js';
import { wrap, makeBirds, birdAt, clearance, makeClouds, cloudAt, SMALL_MARGIN } from '../src/lifeplan.js';

const header = JSON.parse(readFileSync(new URL('./fixtures/heights.json', import.meta.url)));
const buf = readFileSync(new URL('./fixtures/heights.bin', import.meta.url));
const hf = makeHeightfield(header, new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2));

test('wrap', () => {
  assert.equal(wrap(5, 0, 10), 5);
  assert.equal(wrap(12, 0, 10), 2);
  assert.equal(wrap(-3, 0, 10), 7);
  assert.equal(wrap(-1850, -1840, 2400), 2390);
});

test('birds: deterministic, 8 groups of 5–12 plus 4 soarers', () => {
  const birds = makeBirds(hf);
  assert.deepEqual(makeBirds(hf), birds);
  const soar = birds.filter((b) => b.soar).length;
  assert.equal(soar, 4);
  assert.ok(birds.length - soar >= 40 && birds.length - soar <= 96);
});

test('birds never go through terrain, even between frames', () => {
  const ground = clearance(hf);
  for (const b of makeBirds(hf)) {
    let prev = birdAt(b, 0, ground);
    for (let t = 1 / 30; t < 300; t += 1 / 30) {
      const p = birdAt(b, t, ground);
      const mid = hf.at((p.x + prev.x) / 2, (p.y + prev.y) / 2);
      assert.ok(p.z >= hf.at(p.x, p.y) + SMALL_MARGIN - 1e-9 && (p.z + prev.z) / 2 > mid, `bird below ground at t=${t}`);
      assert.ok(Math.abs(p.z - prev.z) < 1, `height jumps ${p.z - prev.z} m in one frame at t=${t}`);
      prev = p;
    }
  }
});

test('clouds: 8, sized and placed as specified, wrapping inside the block with edge fade', () => {
  const clouds = makeClouds(hf);
  assert.deepEqual(makeClouds(hf), clouds);
  assert.equal(clouds.length, 8);
  const x1 = hf.x0 + (hf.nx - 1) * hf.step, y1 = hf.y0 + (hf.ny - 1) * hf.step;
  for (const c of clouds) {
    assert.ok(c.size >= 150 && c.size <= 400 && c.z >= 850 && c.z <= 1100);
    for (const t of [0, 100, 1000, 5000]) {
      const p = cloudAt(c, t, hf);
      assert.ok(p.x >= hf.x0 && p.x < x1 && p.y >= hf.y0 && p.y < y1 && p.fade >= 0 && p.fade <= 1);
    }
  }
});
