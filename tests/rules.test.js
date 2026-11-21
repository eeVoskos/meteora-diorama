import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zoneOf, buildingLevels, roofKind, seatHeights, STOREY } from '../src/rules.js';
import { centroid, ringArea } from '../src/geom.js';

const sq = (s) => [0, 0, s, 0, s, s, 0, s];
const b = { id: 123456789, p: sq(12) };

test('storey height', () => assert.equal(STOREY, 3.0));
test('levels tag wins', () => assert.equal(buildingLevels({ lv: 5, p: sq(10) }, 'kastraki'), 5));
test('sheds are one storey', () => assert.equal(buildingLevels({ p: sq(5) }, 'centre'), 1)); // 25 m²
test('centre is taller than outer', () => assert.ok(buildingLevels({ p: sq(14) }, 'centre') > buildingLevels({ p: sq(14) }, 'outer')));
test('kastraki tops out at two', () => assert.ok(buildingLevels({ p: sq(20) }, 'kastraki') <= 2));
test('churches are never flat', () => assert.equal(roofKind({ id: 1, t: 'church', p: sq(30) }, 'centre'), 'hip'));
test('deterministic', () => assert.equal(roofKind(b, 'outer'), roofKind(b, 'outer')));
test('a measured roof wins over the rules, except on churches', () => {
  assert.equal(roofKind({ id: 5, t: 'school', rf: 'hip', p: sq(15) }, 'centre'), 'hip');
  assert.equal(roofKind({ id: 6, rf: 'flat', p: sq(12) }, 'outer'), 'flat');
  assert.equal(roofKind({ id: 1, t: 'church', rf: 'flat', p: sq(30) }, 'centre'), 'hip');
});
test('schools are flat with 2 storeys, 3 from 600 m²', () => {
  for (const zone of ['centre', 'outer', 'kastraki']) {
    assert.equal(roofKind({ id: 5, t: 'school', p: sq(15) }, zone), 'flat');
    assert.equal(buildingLevels({ t: 'school', p: sq(15) }, zone), 2);
    assert.equal(buildingLevels({ t: 'school', p: [0, 0, 35, 0, 35, 20, 0, 20] }, zone), 3); // 700 m²
  }
});

const osm = JSON.parse(readFileSync(new URL('../data/osm.json', import.meta.url)));

test('zones on the real places', () => {
  const kastraki = osm.places.find((p) => p.k === 'town' && p.en === 'Kastraki');
  const hall = osm.places.find((p) => p.id === 302995899);
  assert.equal(zoneOf(kastraki.x, kastraki.y, osm.places), 'kastraki');
  assert.equal(zoneOf(hall.x, hall.y, osm.places), 'centre');
  assert.equal(zoneOf(hall.x + 800, hall.y - 600, osm.places), 'outer');
});

test('roof shares on the real data', () => {
  const n = { kal: 0, kalFlat: 0, kas: 0, kasFlat: 0 };
  for (const bd of osm.buildings) {
    const zone = zoneOf(...centroid(bd.p), osm.places);
    const flat = roofKind(bd, zone) === 'flat';
    if (zone === 'kastraki') { n.kas++; n.kasFlat += flat; } else { n.kal++; n.kalFlat += flat; }
  }
  const kal = n.kalFlat / n.kal, kas = n.kasFlat / n.kas;
  assert.ok(kal >= 0.08 && kal <= 0.16, `Kalampaka flat share ${kal}`);
  assert.ok(kas >= 0.02 && kas <= 0.08, `Kastraki flat share ${kas}`);
});

test('centre reads red from above: flat share by footprint area', () => {
  let flat = 0, all = 0;
  for (const bd of osm.buildings) {
    const zone = zoneOf(...centroid(bd.p), osm.places);
    if (zone !== 'centre') continue;
    const a = Math.abs(ringArea(bd.p));
    all += a;
    if (roofKind(bd, zone) === 'flat') flat += a;
  }
  assert.ok(flat / all <= 0.25, `centre flat share by area ${flat / all}`);
});

test('seatHeights: gentle slope keeps the old rule', () => {
  assert.deepEqual(seatHeights(300, 306, 303, 2), { base: 299, top: 306 + 2 * STOREY });
});
test('seatHeights: cliff seats the house at its centroid', () => {
  assert.deepEqual(seatHeights(300, 360, 352, 2), { base: 346, top: 358 });
});
test('seatHeights: wall height is bounded', () => {
  for (let lv = 1; lv <= 5; lv++) {
    for (const [lo, hi, c] of [[300, 308, 304], [300, 360, 352], [300, 500, 310], [300, 330, 301]]) {
      const { base, top } = seatHeights(lo, hi, c, lv);
      const max = hi - lo <= 8 ? 8 + lv * STOREY + 1 : 6 + lv * STOREY;
      assert.ok(top - base <= max + 1e-9, `${lo},${hi},${c},${lv}: ${top - base} > ${max}`);
    }
  }
});
