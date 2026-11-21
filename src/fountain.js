// Town-hall square fountain, from reference photos (not in the repository): a stone wall
// with three turquoise ledges and a jet on top, water falling south into the mapped basin, clipped hedges
// either side. The basin is the mapped water area; the wall stands on its north edge, facing the street.
import * as kit from './landmarks/kit.js';
import { mergeByMaterial } from './landmarks/index.js';
import { centroid, pointInRing } from './geom.js';
import { registerView } from './scene.js';

const AT = [-254, -842]; // a point inside the basin in the pinned OSM snapshot (fountain node 4332014836)
const W = 6.4, H = 2.6, D = 1.5; // wall width, height above the basin, thickness

export function buildFountain(osm, hf) {
  const pool = osm.cover.find((c) => c.k === 'water' && pointInRing(AT[0], AT[1], c.p));
  if (!pool) return null;
  const { mats, at, box, prism } = kit;
  const [cx, cy] = centroid(pool.p);
  const ring = [];
  for (let i = 0; i < pool.p.length; i += 2) ring.push([pool.p[i] - cx, pool.p[i + 1] - cy]);
  const north = Math.max(...ring.map((p) => p[1]));
  const back = ring.filter((p) => p[1] > north - 2);
  const u = back.reduce((s, p) => s + p[0], 0) / back.length; // wall centred on the basin's north end
  const v = north - 0.2, lip = v - D / 2 - 0.35;              // lip: front edge of the lowest ledge

  const root = kit.group(
    at(prism(kit.offsetRing(ring, 0.3), 1.25, mats.stone), 0, 0, -1), // basin kerb
    at(prism(ring, 1.32, mats.aqua), 0, 0, -1),                       // painted basin under shallow water
    at(box(W, H + 1, D, mats.stone), u, v, -1),
    at(box(W + 0.2, 0.22, D + 0.7, mats.aqua), u, v - 0.35, H),       // three stepped ledges
    at(box(W - 1.2, 0.3, D, mats.aqua), u, v + 0.1, H + 0.22),
    at(box(W - 3, 0.3, D - 0.4, mats.aqua), u, v + 0.25, H + 0.52),
    at(kit.cone(0.4, 1.1, 6, mats.foam), u, v + 0.25, H + 0.82),      // jet
    at(box(W - 0.6, H - 0.3, 0.12, mats.foam), u, lip, 0.32),         // falling sheet
    at(box(W, 0.1, 1.3, mats.foam), u, lip - 0.4, 0.32),              // churned water at its foot
    at(box(3.2, 2.9, 2.4, mats.garden), u - W / 2 - 1.6, v + 0.2, -0.5), // hedges
    at(box(3.2, 2.9, 2.4, mats.garden), u + W / 2 + 1.6, v + 0.2, -0.5),
  );
  const g = mergeByMaterial(root);
  g.name = 'fountain';
  g.position.set(cx, hf.at(cx, cy), -cy);
  registerView('waterfall', { x: cx, y: cy, zoom: 60, azimuth: 200, elevation: 22 });
  return g;
}
