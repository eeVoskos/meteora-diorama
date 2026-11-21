import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withPois } from '../src/pois.js';
import { inBlock } from '../src/geom.js';

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const osm = read('osm.json'), pois = read('pois.json');
const places = withPois(osm.places, pois);

test('every POI is complete in both languages', () => {
  for (const p of pois) {
    for (const v of [p.en, p.el, p.kind.en, p.kind.el, p.text.en, p.text.el]) assert.ok(typeof v === 'string' && v.trim(), p.id);
    assert.ok(['town', 'monastery', 'landmark'].includes(p.k), p.id);
  }
});

test('POI ids are unique', () => assert.equal(new Set(pois.map((p) => p.id)).size, pois.length));

test('a POI that names a mapped place points at one that exists, and each mapped place is described once', () => {
  const ids = pois.filter((p) => p.osm).map((p) => p.osm);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(osm.places.some((q) => q.id === id), String(id));
});

test('mapped places keep their position and gain the text; the rest become new pins inside the block', () => {
  const gm = places.find((p) => p.id === 534903882), raw = osm.places.find((p) => p.id === 534903882);
  assert.deepEqual([gm.x, gm.y, gm.k], [raw.x, raw.y, 'monastery']);
  assert.equal(gm.key, 'great-meteoron');
  assert.match(gm.text.en, /Athanasios/);
  const added = pois.filter((p) => !p.osm);
  assert.equal(places.length, osm.places.length + added.length);
  for (const p of places) assert.ok(inBlock(p.x, p.y), String(p.id));
  assert.equal(new Set(places.map((p) => p.id)).size, places.length);
});

test('a POI outside the block is dropped', () => {
  const out = withPois([], [{ id: 'far', k: 'landmark', x: 99999, y: 0, en: 'a', el: 'b', kind: {}, text: {} }]);
  assert.equal(out.length, 0);
});
