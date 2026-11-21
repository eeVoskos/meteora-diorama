// Generated churches for every mapped church footprint the hand-built landmarks do not cover.
// Each is built in its own frame (u along the long axis, apse toward +u = the east end, v across) from kit
// shapes, then all are merged per material. Heights are absolute (m a.s.l.).
import * as kit from './landmarks/kit.js';
import { mergeByMaterial } from './landmarks/index.js';
import { churchPlan, seatHeights } from './rules.js';
import { hash01, mulberry32 } from './geom.js';

const { mats, at, group, box } = kit;
const WALLS = [mats.plaster, mats.white, mats.stone, mats.ashlar];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const FACE = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

export { churchIds } from './rules.js';

function buildOne(b, hf) {
  const pl = churchPlan(b);
  const rnd = mulberry32(Math.floor(hash01(b.id) * 4294967296));
  const wm = WALLS[Math.floor(rnd() * WALLS.length)];
  const side = rnd() < 0.5 ? 1 : -1;          // tower on the +v or −v side of the west end
  const domeMat = rnd() < 0.7 ? mats.tile : mats.lead;
  const turn = pl.angle + (pl.east < 0 ? Math.PI : 0);
  const W = pl.wid;
  const L = pl.kind === 'chapel' ? Math.min(pl.len, 3 * W + 1) : pl.len; // keep chapels stubby

  const site = { ground: (u, v) => hf.at(pl.cx + u, pl.cy + v) };
  const { lo, hi } = kit.groundRange(site, 0, 0, L, W, turn);
  const centre = hf.at(pl.cx, pl.cy);
  const { base: y0 } = seatHeights(lo, hi, centre, 0);
  const F = (hi - lo > 8 ? centre : hi) + 0.3; // floor

  const parts = [];
  const add = (...o) => parts.push(...o);
  const panes = (face, u, v, y, n, sp, w, h) => add(at(kit.windows(n, sp, w, h), u, v, y, FACE[face]));
  const apseAt = (r, top, u, v, sides = 7) => add(at(kit.apse(r, top - y0, wm, mats.tile, sides), u, v, y0));
  const towerAt = (t, top, u, v, domed) => {
    add(at(box(t, top - y0, t, wm), u, v, y0));
    const ob = top - 2.4, ow = t * 0.3;
    panes('S', u, v - t / 2, ob, 1, 1, ow, 1.7); panes('N', u, v + t / 2, ob, 1, 1, ow, 1.7);
    panes('E', u + t / 2, v, ob, 1, 1, ow, 1.7); panes('W', u - t / 2, v, ob, 1, 1, ow, 1.7);
    add(at(box(t + 0.35, 0.3, t + 0.35, wm), u, v, top));
    if (domed) {
      add(at(kit.drum(t * 0.4, 0.6, 8, wm), u, v, top + 0.3));
      add(at(kit.dome(t * 0.45, mats.tile, 8, 3), u, v, top + 0.9));
      add(at(kit.cross(1), u, v, top + 0.9 + t * 0.45));
    } else {
      add(at(kit.hipRoof(t, t, t * 0.65, mats.tile, 0.25), u, v, top + 0.3));
      add(at(kit.cross(1), u, v, top + 0.3 + t * 0.65));
    }
  };
  const domeAt = (r, sides, yb, u, winH) => {
    const dh = winH + 1.2;
    add(at(kit.drum(r, dh, sides, wm), u, 0, yb));
    add(at(kit.drumWindows(r, sides, Math.min(0.6, r * 0.28), winH), u, 0, yb + 0.6));
    add(at(kit.drum(r + 0.25, 0.25, sides, mats.tile), u, 0, yb + dh));
    add(at(kit.dome(r + 0.1, domeMat, sides, 4), u, 0, yb + dh + 0.25));
    add(at(kit.cross(clamp(r * 0.5, 1, 1.8)), u, 0, yb + dh + 0.25 + r));
  };

  if (pl.kind === 'chapel') {
    const r = clamp(W * 0.32, 0.6, 1.8), uE = L / 2 - r, uW = -L / 2, um = (uE + uW) / 2, lb = uE - uW;
    const top = F + clamp(W * 0.7, 2.2, 3.6), rise = W * 0.4;
    add(at(box(lb, top - y0, W, wm), um, 0, y0));
    add(at(kit.gableRoof(lb, W, rise, mats.tile, 0.3, wm), um, 0, top));
    apseAt(r, top - 0.5, uE, 0);
    add(at(kit.cross(clamp(W * 0.3, 0.7, 1.2)), uW, 0, top + rise));
    panes('W', uW, 0, F, 1, 1, Math.min(0.9, W * 0.3), Math.min(1.9, top - F - 0.3));
    if (lb > 4) { panes('S', um, -W / 2, F + 1.3, 1, 1, 0.4, 0.8); panes('N', um, W / 2, F + 1.3, 1, 1, 0.4, 0.8); }
  } else if (pl.kind === 'parish') {
    const r = clamp(W * 0.28, 1.2, 3), uE = L / 2 - r, n = clamp(L * 0.2, 2.5, 5), uN = -L / 2 + n;
    const um = (uN + uE) / 2, top = F + clamp(W * 0.55, 4, 7), rise = Math.min(W * 0.35, 3);
    add(at(box(uE - uN, top - y0, W, wm), um, 0, y0));
    add(at(kit.gableRoof(uE - uN, W, rise, mats.tile, 0.4, wm), um, 0, top));
    apseAt(r, top - 0.8, uE, 0);
    const nw = Math.min(uE - uN, 14), nWin = Math.max(1, Math.floor((nw - 2) / 2.6));
    panes('S', um, -W / 2, F + 1.6, nWin, 2.6, 0.6, 1.5); panes('N', um, W / 2, F + 1.6, nWin, 2.6, 0.6, 1.5);
    domeAt(clamp(W * 0.24, 1.5, 2.8), 8, top - 0.2, um, rise + 0.9);
    // Lower narthex beside the tower at the west end.
    const t = clamp(W * 0.3, 2.4, 3.6), nwid = W - t - 0.2, nv = -side * (t + 0.2) / 2;
    add(at(box(n + 0.2, top - 1.4 - y0, nwid, wm), -L / 2 + n / 2 + 0.1, nv, y0));
    add(at(kit.hipRoof(n + 0.2, nwid, 1.1, mats.tile, 0.3), -L / 2 + n / 2 + 0.1, nv, top - 1.4));
    panes('W', -L / 2, nv, F, 1, 1, 1.2, 2.2);
    towerAt(t, top + rise + 3.5, -L / 2 + t / 2, side * (W / 2 - t / 2), false);
  } else {
    const r = clamp(W * 0.2, 2, 3.8), uE = L / 2 - r, n = clamp(L * 0.16, 3.5, 6), uN = -L / 2 + n, uc = (uN + uE) / 2;
    const h = clamp(W * 0.32, 5.5, 8), armW = clamp(W * 0.38, 5, 9), armH = h + 2.5, rise = armW * 0.32;
    const len = uE - uN;
    // Lower corner bays under one low hipped roof, then the two crossing gabled arms.
    add(at(box(len, F + h - y0, W, wm), uc, 0, y0));
    add(at(kit.hipRoof(len, W, 1.2, mats.tileDark, 0.35), uc, 0, F + h));
    add(at(box(len + 0.3, F + armH - y0, armW, wm), uc, 0, y0));
    add(at(kit.gableRoof(len + 0.3, armW, rise, mats.tile, 0.4, wm), uc, 0, F + armH));
    add(at(box(armW, F + armH - y0, W + 0.3, wm), uc, 0, y0));
    add(at(kit.gableRoof(W + 0.3, armW, rise, mats.tile, 0.4, wm), uc, 0, F + armH, Math.PI / 2));
    const dr = clamp(armW * 0.4, 2.2, 3.8), yb = F + armH + rise + 0.4;
    add(at(box(2 * dr + 0.6, rise + 0.4, 2 * dr + 0.6, wm), uc, 0, F + armH));
    domeAt(dr, 12, yb, uc, dr * 1.1);
    apseAt(r, F + armH - 1.2, uE, 0, 9);
    const r2 = Math.min(r * 0.55, W * 0.2);
    for (const s of [-1, 1]) apseAt(r2, F + h - 1, uE, s * (W / 2 - r2 - 0.3));
    for (const [face, v] of [['S', -W / 2 - 0.16], ['N', W / 2 + 0.16]]) {
      panes(face, uc, v, F + 2, 2, 1.8, 0.7, 2); panes(face, uc, v, F + h + 0.3, 1, 1, 0.6, 1.4);
      for (const a of [uN + len * 0.17, uE - len * 0.17]) panes(face, a, v - Math.sign(v) * 0.16, F + 2, 1, 1, 0.6, 1.8);
    }
    const t = clamp(W * 0.2, 3, 4.5), nwid = Math.min(W * 0.85, W - t - 0.2), nv = -side * (W - nwid) / 2;
    add(at(box(n + 0.2, F + h - 0.6 - y0, nwid, wm), -L / 2 + n / 2 + 0.1, nv, y0));
    add(at(kit.hipRoof(n + 0.2, nwid, 1.3, mats.tile, 0.35), -L / 2 + n / 2 + 0.1, nv, F + h - 0.6));
    panes('W', -L / 2, nv, F, 1, 1, 1.5, 2.6);
    panes('W', -L / 2, nv, F + 3.4, 2, 2.6, 0.6, 1.4);
    towerAt(t, F + armH + rise + 5, -L / 2 + t / 2, side * (W / 2 - t / 2), rnd() < 0.5);
  }
  return at(group(...parts), pl.cx, pl.cy, 0, turn);
}

export function buildChurches(osm, hf, ids) {
  const root = group();
  const kinds = { chapel: 0, parish: 0, large: 0 };
  let skipped = 0;
  for (const b of osm.buildings) {
    if (!ids.has(b.id)) continue;
    try {
      root.add(buildOne(b, hf));
      kinds[churchPlan(b).kind]++;
    } catch (e) {
      skipped++;
    }
  }
  console.info(`churches skipped: ${skipped}`);
  console.info(`churches: ${kinds.chapel} chapel, ${kinds.parish} parish, ${kinds.large} large`);
  const out = mergeByMaterial(root);
  out.name = 'churches';
  out.userData.kinds = kinds;
  return out;
}
