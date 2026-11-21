import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGraph, components, makeAgent, stepAgent, edgeDistance, makeTraffic, inTown } from '../src/traffic.js';

const osm = JSON.parse(readFileSync(new URL('../data/osm.json', import.meta.url)));

// A T: a road west→east with a junction at (100, 0) (the second road starts 0.6 m off it), and a dead-end spur north.
const ROADS = [
  { c: 'street', p: [0, 0, 100, 0, 200, 0] },
  { c: 'street', p: [100.6, 0.3, 100, 50] },
];
const props = () => ({ off: 1, v: 10, w: 1 });

test('graph: snaps shared vertices into a junction', () => {
  const g = buildGraph(ROADS, props);
  assert.equal(g.xs.length, 4);
  assert.equal(g.edges.length, 3);
  const deg = g.adj.map((l) => l.length).sort();
  assert.deepEqual(deg, [1, 1, 1, 3]);
  assert.equal(components(g).length.length, 1);
});

test('agent: branches at the junction, turns back at the dead end, keeps right', () => {
  const g = buildGraph(ROADS, props);
  const a = makeAgent(g, { e: 0, dir: 1, s: 50, k: 1, tau: 0.2, seed: 1 });
  assert.ok(Math.abs(a.y + 1) < 1e-9, 'eastbound keeps to the south (right) side');
  const seen = new Set();
  for (let i = 0; i < 3000; i++) {
    stepAgent(g, a, 0.05);
    seen.add(`${a.e}:${a.dir}`);
    assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.h));
    assert.ok(a.s >= 0 && a.s <= g.edges[a.e].len);
  }
  // It has been on every edge in both directions (the ends are all dead ends).
  assert.equal(seen.size, 6);
});

test('cars: deterministic, on the network, within their offset, finite, for 5 simulated minutes', () => {
  const a = makeTraffic(osm), b = makeTraffic(osm);
  assert.deepEqual(a.cars.map((c) => [c.e, c.s, c.x]), b.cars.map((c) => [c.e, c.s, c.x]));
  const g = a.carGraph;
  for (const c of a.cars) {
    for (let t = 0; t < 300; t += 1 / 30) {
      stepAgent(g, c, 1 / 30);
      assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.h));
      const e = g.edges[c.e];
      assert.ok(['primary', 'secondary', 'tertiary', 'street'].includes(e.c));
      const d = Math.min(edgeDistance(g, c.e, c.x, c.y), edgeDistance(g, c.pe, c.x, c.y));
      assert.ok(d < e.off + 3, `car ${d.toFixed(2)} m from its road`);
    }
  }
});

test('walkers: stay in town or on monastery approaches', () => {
  const { walkGraph: g, walkers, residential, monasteries } = makeTraffic(osm);
  assert.equal(walkers.length, 600);
  const near = (x, y) => inTown(residential, x, y) || monasteries.some((m) => Math.hypot(x - m.x, y - m.y) < 320)
    || [-8, 8].some((dx) => [-8, 8].some((dy) => inTown(residential, x + dx, y + dy)));
  for (const w of walkers) {
    for (let t = 0; t < 120; t += 0.25) {
      stepAgent(g, w, 0.25);
      assert.ok(Number.isFinite(w.x) && Number.isFinite(w.y));
      assert.ok(near(w.x, w.y), `walker out of town at ${w.x.toFixed(0)}, ${w.y.toFixed(0)}`);
      assert.ok(Math.min(edgeDistance(g, w.e, w.x, w.y), edgeDistance(g, w.pe, w.x, w.y))
        < Math.max(g.edges[w.e].off, g.edges[w.pe].off) + 1.5, `walker off its path at t=${t}`);
    }
  }
});
