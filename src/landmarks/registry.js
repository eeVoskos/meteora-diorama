// Landmark metadata and generic-building replacement (no three.js, so Node can test it).
import { centroid, pointInRing } from '../geom.js';

// kind 'way': the OSM way's outline `o` in osm.places is the site. kind 'node': the building footprint
// containing the node, else a `size` [w, d] box turned `angle` radians (counter-clockwise from east).
// skip (optional): extra OSM building ids the model replaces (e.g. a mapped platform canopy).
// view (optional): overrides the registered camera view, e.g. { azimuth: 160 } or { zoom: 300 }.
export const LANDMARKS = [
  { key: 'great-meteoron', id: 534903882, kind: 'way', en: 'Great Meteoron', el: 'Μεγάλο Μετέωρο', view: { azimuth: 130 } },
  { key: 'varlaam', id: 634421149, kind: 'way', en: 'Varlaam', el: 'Βαρλαάμ' },
  { key: 'roussanou', id: 433488106, kind: 'way', en: 'Roussanou', el: 'Ρουσάνου' },
  { key: 'st-nicholas', id: 379737941, kind: 'way', en: 'St Nicholas Anapafsas', el: 'Άγιος Νικόλαος Αναπαυσάς' },
  { key: 'holy-trinity', id: 379736577, kind: 'way', en: 'Holy Trinity', el: 'Αγία Τριάδα' },
  { key: 'st-stephen', id: 379736573, kind: 'way', en: 'St Stephen', el: 'Άγιος Στέφανος' },
  { key: 'dormition', id: 609218810, kind: 'way', en: 'Church of the Dormition', el: 'Κοίμηση της Θεοτόκου' },
  { key: 'agios-vissarion', id: 585513480, kind: 'way', en: 'Agios Vissarion', el: 'Άγιος Βησσαρίων' },
  { key: 'agios-konstantinos', id: 415534160, kind: 'way', en: 'Agios Konstantinos', el: 'Άγιος Κωνσταντίνος' },
  { key: 'town-hall', id: 302995899, kind: 'way', en: 'Town Hall', el: 'Δημαρχείο' },
  { key: 'station', id: 9859440669, kind: 'node', lat: 39.7030, lon: 21.6254, size: [28, 10], angle: 2.51, skip: [1071173982], en: 'Railway Station', el: 'Σιδηροδρομικός Σταθμός' },
  { key: 'museum', id: 4692270989, kind: 'node', lat: 39.7017, lon: 21.6307, size: [27, 14], angle: 1.45, en: 'Natural History & Mushroom Museum', el: 'Μουσείο Φυσικής Ιστορίας & Μανιταριών' },
];

// Site outline for a landmark as a flat ring [x0,y0,…] in local metres, plus which building (if any) it came from.
export function landmarkRing(l, osm) {
  const place = osm.places.find((p) => p.id === l.id);
  if (!place) throw new Error(`no place ${l.id}`);
  if (l.kind === 'way') {
    if (!place.o) throw new Error(`place ${l.id} has no outline`);
    return { ring: place.o, buildingId: osm.buildings.some((b) => b.id === l.id) ? l.id : null };
  }
  const host = osm.buildings.find((b) => pointInRing(place.x, place.y, b.p));
  if (host) return { ring: host.p, buildingId: host.id };
  const [w, d] = l.size, c = Math.cos(l.angle ?? 0), s = Math.sin(l.angle ?? 0), ring = [];
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const u = (a * w) / 2, v = (b * d) / 2;
    ring.push(place.x + u * c - v * s, place.y + u * s + v * c);
  }
  return { ring, buildingId: null };
}

// Ids of generic buildings the landmark models replace: centroid inside the site ring, plus the host building.
export function landmarkSkipIds(osm) {
  const skip = new Set();
  for (const l of LANDMARKS) {
    const { ring, buildingId } = landmarkRing(l, osm);
    if (buildingId !== null) skip.add(buildingId);
    for (const id of l.skip ?? []) skip.add(id);
    for (const b of osm.buildings) {
      const [x, y] = centroid(b.p);
      if (pointInRing(x, y, ring)) skip.add(b.id);
    }
  }
  return skip;
}
