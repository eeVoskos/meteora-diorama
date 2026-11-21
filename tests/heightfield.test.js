import test from 'node:test';
import assert from 'node:assert/strict';
import { makeHeightfield } from '../src/heightfield.js';
import { BLOCK } from '../src/geom.js';

// 3 × 2 grid, step 8, first sample at (-8, -4); values in decimetres, rows south→north.
const header = { nx: 3, ny: 2, step: 8, x0: -8, y0: -4, unit: 0.1, min: 100, max: 160 };
const hf = makeHeightfield(header, new Uint16Array([1000, 1200, 1400, 1600, 1500, 1000]));

test('exact sample at a grid point', () => {
  assert.equal(hf.at(-8, -4), 100);
  assert.equal(hf.at(0, -4), 120);
  assert.equal(hf.at(8, 4), 100);
  assert.equal(hf.at(0, 4), 150);
});

test('mean of four at a cell centre', () => {
  assert.equal(hf.at(-4, 0), (100 + 120 + 160 + 150) / 4);
});

test('edge value for a point 100 m outside', () => {
  assert.equal(hf.at(-108, -4), 100);
  assert.equal(hf.at(108, 104), 100);
  assert.equal(hf.at(0, -104), 120);
});

test('passes header fields through', () => {
  assert.deepEqual([hf.nx, hf.ny, hf.step, hf.x0, hf.y0, hf.min, hf.max], [3, 2, 8, -8, -4, 100, 160]);
});

test('real data: Great Meteoron on its rock, town hall in the valley (guards against an axis flip)', async () => {
  const { readFileSync } = await import('node:fs');
  const file = (f) => new URL(f === 'osm.json' ? '../data/osm.json' : `./fixtures/${f}`, import.meta.url);
  const buf = readFileSync(file('heights.bin'));
  const real = makeHeightfield(JSON.parse(readFileSync(file('heights.json'), 'utf8')), new Uint16Array(buf.buffer, buf.byteOffset, buf.length / 2));
  const places = JSON.parse(readFileSync(file('osm.json'), 'utf8')).places;
  const h = (id) => { const p = places.find((q) => q.id === id); return real.at(p.x, p.y); };
  const gm = h(534903882), hall = h(302995899);
  assert.ok(gm >= 590 && gm <= 620, `Great Meteoron ${gm}`);
  assert.ok(hall >= 220 && hall <= 260, `town hall ${hall}`);
});

test('real data: the height grid spans the block rectangle the page paints', async () => {
  const { readFileSync } = await import('node:fs');
  const h = JSON.parse(readFileSync(new URL('./fixtures/heights.json', import.meta.url), 'utf8'));
  assert.deepEqual([h.x0, h.x0 + (h.nx - 1) * h.step, h.y0, h.y0 + (h.ny - 1) * h.step], [BLOCK.x0, BLOCK.x1, BLOCK.y0, BLOCK.y1]);
});
