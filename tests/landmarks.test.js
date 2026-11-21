import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LANDMARKS, landmarkSkipIds } from '../src/landmarks/registry.js';

const osm = JSON.parse(fs.readFileSync(new URL('../data/osm.json', import.meta.url)));
const WAYS = [534903882, 634421149, 433488106, 379737941, 379736577, 379736573, 609218810, 585513480, 415534160, 302995899];
const NODES = [9859440669, 4692270989];

test('twelve landmarks with unique keys', () => {
  assert.equal(LANDMARKS.length, 12);
  assert.equal(new Set(LANDMARKS.map((l) => l.key)).size, 12);
});

test('ids and kinds match the shared list', () => {
  assert.deepEqual(LANDMARKS.filter((l) => l.kind === 'way').map((l) => l.id).sort(), [...WAYS].sort());
  assert.deepEqual(LANDMARKS.filter((l) => l.kind === 'node').map((l) => l.id).sort(), [...NODES].sort());
});

test('every landmark has English and Greek names', () => {
  for (const l of LANDMARKS) {
    assert.ok(typeof l.en === 'string' && l.en.length, l.key);
    assert.ok(typeof l.el === 'string' && l.el.length, l.key);
  }
});

test('skip ids on the real data', () => {
  const skip = landmarkSkipIds(osm);
  if (osm.buildings.some((b) => b.id === 534903882)) assert.ok(skip.has(534903882));
  assert.ok(skip.size >= 1 && skip.size <= 150, `size ${skip.size}`);
  // Way landmarks that are buildings themselves are skipped; so are the buildings on Great Meteoron's summit.
  for (const id of [609218810, 585513480, 415534160, 302995899]) assert.ok(skip.has(id), String(id));
  assert.ok(skip.has(1066256734)); // the big range inside Great Meteoron's precinct
});

test('node landmarks skip the building that contains the node', () => {
  const skip = landmarkSkipIds(osm);
  assert.ok(skip.has(1071173981)); // station building
  assert.ok(skip.has(1180426018)); // museum building
});

test('station skips the mapped platform canopy', () => {
  assert.ok(landmarkSkipIds(osm).has(1071173982));
});
