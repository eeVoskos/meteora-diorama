"""Derives the measured model from the stitched Google grid (tools/google_grid.py) and writes private/, which the
page needs: private/google.json (wall height and roof kind per mapped building, buildings the map lacks, trees),
private/ground.bin (a ground class per 2 m cell) and private/heights.* (terrain and rocks on a 4 m grid).
private/ is ignored by git.

Usage: python3 -I tools/build_google.py
"""
import json, math, os, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo, google_grid as gg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H, HW, HH = gg.W, gg.H, -geo.X0, -geo.Y0  # HW, HH: metres from the block's west and south edges to the origin


def cells(p, dx=0.0, dy=0.0):
    """Grid offsets (j·W + i) of the cells whose centres lie inside flat ring p moved by (dx, dy)."""
    xs = [v + dx + HW - 0.5 for v in p[0::2]]; ys = [v + dy + HH - 0.5 for v in p[1::2]]  # in cell-index units
    out = []
    for j in range(max(0, math.ceil(min(ys))), min(H - 1, math.floor(max(ys))) + 1):
        cuts = sorted(xs[k] + (j - ys[k]) * (xs[k - 1] - xs[k]) / (ys[k - 1] - ys[k])
                      for k in range(len(xs)) if (ys[k] > j) != (ys[k - 1] > j))
        for a, b in zip(cuts[0::2], cuts[1::2]):
            out.extend(range(j * W + max(0, math.ceil(a)), j * W + min(W - 1, math.floor(b)) + 1))
    return out


def best_shift(rings, mask):
    """Whole-metre shift of the map that best covers Google's building mask (the two are a few metres apart)."""
    score = lambda d: sum(mask[o] for p in rings for o in cells(p, *d))
    best = max(((dx, dy) for dx in range(-12, 13, 3) for dy in range(-12, 13, 3)), key=score)
    return max(((best[0] + dx, best[1] + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)), key=score)


def is_tile(rgb, o):  # terracotta: clearly more red than green, and far more than blue
    r, g, b = rgb[3 * o], rgb[3 * o + 1], rgb[3 * o + 2]
    return r > 90 and r - g > 12 and r - b > 30


def measure(p, dsm, rgb, mask, dx, dy):
    """[wall height in metres, 1 if tiled else 0] for a footprint, or None when the imagery does not show it."""
    inside = cells(p, dx, dy)
    if len(inside) < 12 or 2 * sum(mask[o] for o in inside) < len(inside): return None
    i0, i1 = int(min(p[0::2]) + dx + HW) - 6, int(max(p[0::2]) + dx + HW) + 6
    j0, j1 = int(min(p[1::2]) + dy + HH) - 6, int(max(p[1::2]) + dy + HH) + 6
    around = sorted(v for j in range(max(0, j0), min(H, j1 + 1)) for i in range(max(0, i0), min(W, i1 + 1))
                    if not mask[j * W + i] and (v := dsm[j * W + i]) == v)
    roof = sorted(v for o in inside if (v := dsm[o]) == v)
    if len(around) < 10 or len(roof) < 12: return None
    wall = roof[len(roof) // 4] - around[len(around) // 4]  # lower quartiles: roof near its edge, open ground nearby
    if not 2.2 <= wall <= 30: return None
    return [round(wall, 1), int(sum(is_tile(rgb, o) for o in inside) >= 0.4 * len(inside))]


C = 16  # m: cell of the coarse bare-ground estimate


def ground_model(dsm):
    """Bare-ground estimate: lowest surface in each 16 m cell. Returns (ground(i, j) by bilinear interpolation
    between cell centres, slope(i, j) in m per m). It sits low on slopes, so callers add slope to their thresholds."""
    gw, gh = -(-W // C), -(-H // C)
    rows = [[min(dsm[j * W + a:j * W + min(W, a + C)]) for a in range(0, W, C)] for j in range(H)]
    g = [[min(r[ci] for r in rows[cj * C:cj * C + C]) for ci in range(gw)] for cj in range(gh)]

    def ground(i, j):
        u, v = min(max((i + 0.5) / C - 0.5, 0), gw - 1.001), min(max((j + 0.5) / C - 0.5, 0), gh - 1.001)
        a, b = int(u), int(v); fu, fv = u - a, v - b
        return (g[b][a] * (1 - fu) + g[b][a + 1] * fu) * (1 - fv) + (g[b + 1][a] * (1 - fu) + g[b + 1][a + 1] * fu) * fv

    def slope(i, j):
        a, b = min(max(i // C, 1), gw - 2), min(max(j // C, 1), gh - 2)
        return math.hypot(g[b][a + 1] - g[b][a - 1], g[b + 1][a] - g[b - 1][a]) / (2 * C)
    return ground, slope


GRASS, CANOPY, DRY, GREY = 1, 2, 3, 4  # ground classes; 0 = unknown (shadow, roof): the page keeps its own ground


def classify(dsm, rgb, mask, ground, slope):
    """Ground class per 2 m cell (row 0 south) and the height above ground of every canopy cell."""
    cw, ch = W // 2, H // 2
    cls, tall = bytearray(cw * ch), {}
    for J in range(ch):
        for I in range(cw):
            o = 2 * J * W + 2 * I
            if mask[o]: continue
            r, g, b = rgb[3 * o], rgb[3 * o + 1], rgb[3 * o + 2]
            mx, mn = max(r, g, b), min(r, g, b)
            green = 2 * g - r - b > 10 and r <= g + 8
            if mx < 55 or green:  # vegetation, or shadow where only the height can tell
                s = slope(2 * I, 2 * J)
                h = dsm[o] - ground(2 * I, 2 * J) if s < 0.7 else 0
                if h > 3 + 10 * s and h < 40:
                    cls[J * cw + I] = CANOPY; tall[J * cw + I] = h
                elif mx >= 55:
                    cls[J * cw + I] = GRASS
            elif mx - mn < 22: cls[J * cw + I] = GREY
            elif r > g + 8 and r - b > 25: cls[J * cw + I] = DRY
    return cls, tall


def trees(cls, tall, dsm, rgb, sites, dx, dy, cap=15000):
    """Flat [x, y, scale, kind] list in map metres (kind 1 = cypress): the tallest canopy cell of each 6 m square,
    lone trees and thin rows first, then an even sample of the rest up to `cap`. Scale 1 is the page's 6.4 m broadleaf or 10 m cypress."""
    cw, B = W // 2, 3  # 3 cells of 2 m
    top = {}
    for k, h in tall.items():
        key = (k % cw // B, k // cw // B)
        if h > top.get(key, (0, 0))[0]: top[key] = (h, k)
    near = lambda key: sum((key[0] + a, key[1] + b) in top for a in (-1, 0, 1) for b in (-1, 0, 1)) - 1
    mix = lambda key: (key[0] * 73856093 ^ key[1] * 19349663) % 1000003  # scatters the choice evenly over the block
    lone = [key for key in top if near(key) <= 2]  # single trees and thin rows matter most: kept first
    keep = set(sorted(lone, key=mix)[:cap])
    keep |= set(sorted((key for key in top if key not in keep), key=mix)[:cap - len(keep)])
    out = []
    for key, (h, k) in sorted(top.items()):
        if key not in keep: continue
        i, j = 2 * (k % cw), 2 * (k // cw)
        x, y = i + 0.5 - HW - dx, j + 0.5 - HH - dy
        if any(inside(x, y, s) for s in sites): continue
        o = j * W + i
        falls = sum(1 for a, b in ((3, 0), (-3, 0), (0, 3), (0, -3))
                    if 0 <= i + a < W and 0 <= j + b < H and dsm[o] - dsm[o + b * W + a] > 0.6 * h)
        cyp = h >= 8 and falls >= 2 and max(rgb[3 * o:3 * o + 3]) < 90  # tall, narrow and dark
        out += [round(x, 1), round(y, 1), round(min(1.6, max(0.6, h / (10 if cyp else 6.4))), 2), int(cyp)]
    return out


def inside(x, y, p):  # even-odd ray cast on a flat ring
    hit = False
    for k in range(0, len(p), 2):
        x0, y0, x1, y1 = p[k], p[k + 1], p[k - 2], p[k - 1]
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0): hit = not hit
    return hit


def extra_buildings(rings, rocks, dsm, rgb, mask, dx, dy):
    """Buildings in Google's mask that the map lacks, as [wall height, tiled, x0, y0, … x3, y3] rectangles in map
    metres. Long runs of joined houses are cut into ~13 m lengths so each gets its own roof."""
    free = bytearray(mask)
    for p in rings:
        for o in cells(p, dx, dy):
            for q in (o, o - 1, o + 1, o - W, o + W):
                if 0 <= q < W * H: free[q] = 0
    core = bytearray(W * H)  # eroded by 1 m: drops the slivers left where map and mask disagree by a cell
    for o in range(W + 1, W * H - W - 1):
        if free[o] and free[o - 1] and free[o + 1] and free[o - W] and free[o + W]: core[o] = 1
    out = []
    for start in range(W * H):
        if not core[start]: continue
        core[start] = 0; stack, pts = [start], []
        while stack:
            o = stack.pop(); pts.append((o % W, o // W))
            for q in (o - 1, o + 1, o - W, o + W):
                if core[q]: core[q] = 0; stack.append(q)
        if len(pts) < 25: continue
        some = pts[::max(1, len(pts) // 300)]

        def box(deg, ps):
            c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
            us, vs = [i * c + j * s for i, j in ps], [j * c - i * s for i, j in ps]
            return min(us), max(us), min(vs), max(vs), c, s
        deg = min(range(0, 90, 5), key=lambda d: (lambda u0, u1, v0, v1, c, s: (u1 - u0) * (v1 - v0))(*box(d, some)))
        u0, u1, v0, v1, c, s = box(deg, pts)
        if v1 - v0 > u1 - u0:  # make u the long axis
            deg += 90; u0, u1, v0, v1, c, s = box(deg, pts)
        n = max(1, round((u1 - u0) / 13)) if u1 - u0 > 20 else 1
        for k in range(n):
            a, b = u0 + (u1 - u0) * k / n, u0 + (u1 - u0) * (k + 1) / n
            part = [(i, j) for i, j in pts if a <= i * c + j * s <= b]
            if len(part) < 20: continue
            pu0, pu1, pv0, pv1, _, _ = box(deg, part)
            if len(part) < 0.45 * (pu1 - pu0 + 1) * (pv1 - pv0 + 1): continue  # too far from a rectangle
            ring = []
            for u, v in ((pu0 - 1, pv0 - 1), (pu1 + 1, pv0 - 1), (pu1 + 1, pv1 + 1), (pu0 - 1, pv1 + 1)):  # 1 m back out
                ring += [round(u * c - v * s + 0.5 - HW - dx, 1), round(u * s + v * c + 0.5 - HH - dy, 1)]
            if any(inside(sum(ring[0::2]) / 4, sum(ring[1::2]) / 4, r) for r in rocks): continue  # the mask also marks bare rock
            m = measure(ring, dsm, rgb, mask, dx, dy)
            if m: out.append(m + ring)
    return out


STEP = 4  # m between terrain samples


def terrain(dsm, cls, rings, sites, dx, dy):
    """Bare ground and rock on a 4 m grid in map metres, rows south to north: the surface model with buildings
    and tree crowns cut out and the gaps filled from their edges. The mapped buildings of each monastery
    site get a level platform, because the models stand on one. Returns (nx, ny, heights)."""
    cw, gone = W // 2, bytearray(W * H)  # 1 m cells that are not ground: roofs and crowns, with a 2 m margin
    for p in rings:
        for o in cells(p, dx, dy):
            i, j = o % W, o // W
            for b in range(max(0, j - 2), min(H, j + 3)): gone[b * W + max(0, i - 2):b * W + min(W, i + 3)] = b'\x01' * (min(W, i + 3) - max(0, i - 2))
    for k, c in enumerate(cls):
        if c != CANOPY: continue
        i, j = 2 * (k % cw), 2 * (k // cw)
        for b in range(max(0, j - 1), min(H, j + 3)): gone[b * W + max(0, i - 1):b * W + min(W, i + 3)] = b'\x01' * (min(W, i + 3) - max(0, i - 1))
    nx, ny = W // STEP + 1, H // STEP + 1
    out, holes, built = [None] * (nx * ny), [], set()
    for p in rings:  # nodes on or within two steps of a building: smoothed at the end so houses stand on even ground
        for o in cells(p, dx, dy)[::3]:
            i, j = round((o % W - dx) / STEP), round((o // W - dy) / STEP)
            built.update(b * nx + a for b in range(max(0, j - 2), min(ny, j + 3)) for a in range(max(0, i - 2), min(nx, i + 3)))
    for j in range(ny):
        b0, b1 = max(0, STEP * j + dy - 2), min(H, STEP * j + dy + 2)
        for i in range(nx):
            a0, a1 = max(0, STEP * i + dx - 2), min(W, STEP * i + dx + 2)
            v = sorted(dsm[b * W + a] for b in range(b0, b1) for a in range(a0, a1) if not gone[b * W + a])
            if v: out[j * nx + i] = v[len(v) // 2]
            else: holes.append(j * nx + i)
    for site in sites:  # level platform under the monastery's mapped buildings (8 m margin), at the ground level around them
        inn = set()
        for p in rings:
            if not inside(sum(p[0::2]) / (len(p) // 2), sum(p[1::2]) / (len(p) // 2), site): continue
            for o in cells(p)[::3]:
                i, j = round(o % W / STEP), round(o // W / STEP)
                inn.update(b * nx + a for b in range(max(0, j - 2), min(ny, j + 3)) for a in range(max(0, i - 2), min(nx, i + 3))
                           if inside(a * STEP - HW, b * STEP - HH, site))
        v = sorted(out[k] for k in inn if out[k] is not None)
        if not v: continue
        level = v[len(v) // 2]
        for k in inn:  # the top only: cliff sides well below it stay as measured
            if out[k] is None or out[k] > level - 8: out[k] = level
    holes = [k for k in holes if out[k] is None]
    while holes:  # grow inward from the edges of each gap
        fill = {}
        for k in holes:
            i, j = k % nx, k // nx
            v = [out[b * nx + a] for b in (j - 1, j, j + 1) for a in (i - 1, i, i + 1)
                 if 0 <= a < nx and 0 <= b < ny and out[b * nx + a] is not None]
            if v: fill[k] = sum(v) / len(v)
        assert fill, 'gap with no edge'
        for k, v in fill.items(): out[k] = v
        holes = [k for k in holes if k not in fill]
    around = lambda src, k: [src[b * nx + a] for b in range(max(0, k // nx - 1), min(ny, k // nx + 2))
                             for a in range(max(0, k % nx - 1), min(nx, k % nx + 2))]
    low = list(out)  # lower quartile of each 3 x 3 drops cars, sheds and roof edges the cut-out missed, then a mean
    for k in built: v = sorted(around(out, k)); low[k] = v[len(v) // 4]
    for k in built: v = around(low, k); out[k] = sum(v) / len(v)
    return nx, ny, out


def main():
    dsm, rgb, mask = gg.load()
    with open(os.path.join(ROOT, 'data', 'osm.json')) as f: osm = json.load(f)
    rings = [b['p'] for b in osm['buildings']]
    area = lambda p: abs(sum(p[i] * p[(i + 3) % len(p)] - p[(i + 2) % len(p)] * p[i + 1] for i in range(0, len(p), 2))) / 2
    dx, dy = best_shift([p for p in rings if 60 < area(p) < 600][::4], mask)
    out = [measure(p, dsm, rgb, mask, dx, dy) for p in rings]
    got = [v for v in out if v]
    print(f'shift {dx},{dy} m; measured {len(got)} of {len(out)} buildings; tiled {sum(v[1] for v in got)}; '
          f'median wall {sorted(v[0] for v in got)[len(got) // 2]} m', flush=True)
    extra = extra_buildings(rings, [r['p'] for r in osm['rocks']], dsm, rgb, mask, dx, dy)
    print(f'{len(extra)} buildings added from the mask', flush=True)
    ground, slope = ground_model(dsm)
    cls, tall = classify(dsm, rgb, mask, ground, slope)
    print('ground classes (unknown, grass, canopy, dry, grey):', [cls.count(k) for k in range(5)], flush=True)
    sites = [p['o'] for p in osm['places'] if p['k'] in ('monastery', 'landmark') and p.get('o')]  # models bring their own trees
    tr = trees(cls, tall, dsm, rgb, sites, dx, dy)
    print(f'{len(tr) // 4} trees, {sum(tr[3::4])} of them cypresses')
    monasteries = [p['o'] for p in osm['places'] if p['k'] == 'monastery' and p.get('o')]
    nx, ny, hs = terrain(dsm, cls, rings + [e[2:] for e in extra], monasteries, dx, dy)
    print(f'terrain {nx} x {ny}, {min(hs):.1f} to {max(hs):.1f} m', flush=True)
    os.makedirs(os.path.join(ROOT, 'private'), exist_ok=True)
    with open(os.path.join(ROOT, 'private', 'heights.bin'), 'wb') as f: f.write(struct.pack(f'<{len(hs)}H', *(round(v * 10) for v in hs)))
    with open(os.path.join(ROOT, 'private', 'heights.json'), 'w') as f:  # the real needle is in the data
        json.dump({'nx': nx, 'ny': ny, 'step': STEP, 'x0': -HW, 'y0': -HH, 'unit': 0.1, 'min': round(min(hs), 1), 'max': round(max(hs), 1), 'needles': []}, f)
    with open(os.path.join(ROOT, 'private', 'ground.bin'), 'wb') as f: f.write(cls)
    tmp = os.path.join(ROOT, 'private', 'google.json.tmp')
    with open(tmp, 'w') as f:  # buildings: parallel to data/osm.json's list, null where there is no measurement
        json.dump({'imagery': '2015-11-04', 'shift': [dx, dy], 'buildings': out, 'extra': extra, 'trees': tr,
                   'ground': {'w': W // 2, 'h': H // 2, 'cell': 2}}, f, separators=(',', ':'))
    os.replace(tmp, os.path.join(ROOT, 'private', 'google.json'))


# self-check: a 4 x 3 m rectangle at the block's south-west corner covers 12 cell centres
assert len(cells([-HW, -HH, -HW + 4, -HH, -HW + 4, -HH + 3, -HW, -HH + 3])) == 12
assert inside(1, 1, [0, 0, 2, 0, 2, 2, 0, 2]) and not inside(3, 1, [0, 0, 2, 0, 2, 2, 0, 2])

if __name__ == '__main__':
    main()
