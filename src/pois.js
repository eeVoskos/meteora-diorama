// Joins the map's named places with the hand-written points of interest (data/pois.json). No three.js or DOM.
import { inBlock } from './geom.js';

// A POI with `osm` describes a place the map already names: it keeps the map's position and adds the kind and
// text. The others become new 'landmark' pins. `key` names the place in ?view= links.
export function withPois(places, pois) {
  const byOsm = new Map(pois.filter((p) => p.osm).map((p) => [p.osm, p]));
  const out = places.map((p) => {
    const i = byOsm.get(p.id);
    return i ? { ...p, key: i.id, kind: i.kind, text: i.text } : p;
  });
  for (const p of pois) {
    if (!p.osm && inBlock(p.x, p.y)) out.push({ k: p.k, id: p.id, key: p.id, x: p.x, y: p.y, en: p.en, el: p.el, kind: p.kind, text: p.text, lift: p.h });
  }
  return out;
}
