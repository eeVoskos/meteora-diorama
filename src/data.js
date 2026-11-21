import { makeHeightfield } from './heightfield.js';
import { STOREY } from './rules.js';

const FAIL = 'Could not load the map data. Open this page from a web server, not as a local file.';
const NO_MODEL = 'The measured model data (the private/ folder) is missing. See "Build the model data" in the README.';

// Marks the failures whose message is meant for the reader (main.js shows a generic one for anything else).
export class LoadError extends Error {}

async function get(url, kind, missing = FAIL) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new LoadError(FAIL);
  }
  if (!res.ok) throw new LoadError(res.status === 404 ? missing : FAIL);
  if (kind !== 'json') return res.arrayBuffer();
  try {
    return await res.json();
  } catch {
    throw new LoadError(FAIL); // e.g. a host that answers a missing file with an HTML page
  }
}

// Terrain, building heights, trees and ground cover are measured from imagery and live in private/ (tools/build_google.py).
export async function loadData() {
  const [header, bin, osm, google, cls, pois] = await Promise.all([
    get('private/heights.json', 'json', NO_MODEL), // 4 m grid
    get('private/heights.bin', 'bin', NO_MODEL),
    get('data/osm.json', 'json'),
    get('private/google.json', 'json', NO_MODEL),
    get('private/ground.bin', 'bin', NO_MODEL), // a class per 2 m cell, row 0 south
    get('data/pois.json', 'json'), // hand-written points of interest: kind and a short text in both languages
  ]);
  if (google.buildings.length !== osm.buildings.length || cls.byteLength !== google.ground.w * google.ground.h) throw new LoadError(FAIL);
  // Measured wall height and roof kind per building; the list runs parallel to osm.buildings (null: not measured).
  // `extra`: buildings the map lacks, as [wall height, tiled, 4 corners]; negative ids keep them apart from mapped ones.
  google.buildings.forEach((v, i) => {
    if (v) Object.assign(osm.buildings[i], { lv: v[0] / STOREY, rf: v[1] ? 'hip' : 'flat' });
  });
  google.extra.forEach((e, k) => osm.buildings.push({ id: -1 - k, p: e.slice(2), lv: e[0] / STOREY, rf: e[1] ? 'hip' : 'flat' }));
  if (bin.byteLength !== header.nx * header.ny * 2) throw new LoadError(FAIL);
  // heights.bin is uint16 little-endian; every browser we target is little-endian.
  const hf = makeHeightfield(header, new Uint16Array(bin));
  // `trees`: flat [x, y, scale, kind].
  return { hf, osm, pois, needles: header.needles ?? [], trees: Float32Array.from(google.trees), ground: { ...google.ground, cls: new Uint8Array(cls) } };
}
