// Pure building rules (no three.js): zone, storeys and roof kind, all deterministic per OSM id.
import { ringArea, hash01, orientedBox } from './geom.js';

export const STOREY = 3.0;

const TOWN_HALL = 302995899;
const KASTRAKI_RADIUS = 800; // m from the Kastraki place node
const CENTRE_RADIUS = 450;   // m from the town hall
const BIG_BLOCK = 150;       // m²: centre footprints this large get a fourth storey
const FLAT_BLOCK = 600;      // m²: only the very largest centre footprints are flat-roofed apartment/hotel blocks
// Share of the remaining buildings with a flat roof, chosen so Kalampaka lands at ~10 % and Kastraki at ~5 %
// (reference sheet: 85–90 % tiled in Kalampaka, ~95 % in Kastraki).
const FLAT_SHARE = { centre: 0.14, outer: 0.08, kastraki: 0.05 };
const NEVER_FLAT = new Set(['church', 'chapel']);
const SCHOOL_BIG = 600; // m²: school blocks this large get a third storey
const CHAPEL_MAX = 60;  // m² footprint: below is a chapel
const LARGE_MIN = 250;  // m² footprint: from here a cross-in-square
const SQUARISH = 1.3;   // len / wid below this counts as near-square
const SLIVER = 3;       // m: narrower church footprints stay ordinary buildings

const dist = (x, y, p) => Math.hypot(x - p.x, y - p.y);

export function zoneOf(x, y, places) {
  const towns = places.filter((p) => p.k === 'town');
  const kastraki = towns.find((p) => p.en === 'Kastraki');
  const kalampaka = towns.find((p) => p !== kastraki);
  const hall = places.find((p) => p.id === TOWN_HALL);
  const dk = kastraki ? dist(x, y, kastraki) : Infinity;
  if (dk < KASTRAKI_RADIUS && (!kalampaka || dk < dist(x, y, kalampaka))) return 'kastraki';
  if (hall && dist(x, y, hall) < CENTRE_RADIUS) return 'centre';
  return 'outer';
}

export function buildingLevels(b, zone) {
  if (b.lv > 0) return b.lv;
  const area = Math.abs(ringArea(b.p));
  if (b.t === 'school') return area >= SCHOOL_BIG ? 3 : 2;
  if (area < 30) return 1;
  if (zone === 'centre') return area >= BIG_BLOCK ? 4 : 3;
  if (zone === 'kastraki') return area < 50 ? 1 : 2;
  return 2;
}

// Wall base and roof line. A footprint on a cliff (> 8 m of relief) is seated at its centroid instead of spanning the drop.
export function seatHeights(lo, hi, centre, levels) {
  if (hi - lo <= 8) return { base: lo - 1, top: hi + levels * STOREY };
  return { base: Math.max(lo - 1, centre - 6), top: centre + levels * STOREY };
}

export function roofKind(b, zone) {
  if (NEVER_FLAT.has(b.t)) return 'hip';
  if (b.rf) return b.rf; // measured from imagery (private/google.json), when that file is present
  if (b.t === 'school') return 'flat';
  if (zone === 'centre' && Math.abs(ringArea(b.p)) >= FLAT_BLOCK) return 'flat';
  return hash01(b.id ?? 0) < FLAT_SHARE[zone] ? 'flat' : 'hip';
}

// Church layout on the footprint's oriented box: long axis `angle` from east, `east` = which end (+1/−1 along
// the axis) points more to the east, for the sanctuary apse.
export function churchPlan(b) {
  const area = Math.abs(ringArea(b.p));
  let { cx, cy, w: len, d: wid, angle } = orientedBox(b.p);
  // Near-square: run the nave along whichever box axis is closer to east–west, so the apse faces east.
  if (len < SQUARISH * wid && Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle))) {
    [len, wid] = [wid, len];
    angle = (angle + Math.PI / 2) % Math.PI;
  }
  const kind = area < CHAPEL_MAX ? 'chapel' : area >= LARGE_MIN ? 'large' : 'parish';
  return { kind, cx, cy, len, wid, angle, east: Math.cos(angle) >= 0 ? 1 : -1 };
}

// Church buildings that get a generated church: not a landmark, and not a sliver (rock-face hermitages mapped as strips).
export function churchIds(osm, skipIds) {
  return new Set(osm.buildings.filter((b) => b.t === 'church' && !skipIds.has(b.id) && orientedBox(b.p).d >= SLIVER).map((b) => b.id));
}

// Steeper ground than this carries no trees: measured trees there come from height errors at cliff edges.
export const MAX_SLOPE = Math.tan((50 * Math.PI) / 180);
