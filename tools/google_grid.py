"""Stitches the fetched Solar API tiles into the model's own frame: one 1 m grid over the block, row 0 the
southernmost, cell (i, j) centred on x = geo.X0 + i + 0.5, y = geo.Y0 + j + 0.5. Cached in cache/google/ as
raw files (local_dsm.f32, local_rgb.u8, local_mask.u8) so later steps load in a second.
"""
import array, glob, math, os, struct, sys, zlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo, solartiff

CACHE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'cache', 'google')
W, H = geo.WIDTH, geo.HEIGHT


def to_utm(x, y):
    return solartiff.utm34(geo.LAT0 + y / geo._KY, geo.LON0 + x / geo._KX)


def affine():
    """Local metres -> UTM as E = e0 + ex·x + ey·y, N = n0 + nx·x + ny·y, fitted at the block centre (well under
    a cell off at the corners)."""
    cx, cy = (geo.X0 + geo.X1) / 2, (geo.Y0 + geo.Y1) / 2
    (ec, nc), (e1, n1), (e2, n2) = to_utm(cx, cy), to_utm(cx + 1000, cy), to_utm(cx, cy + 1000)
    ex, ey, nx, ny = (e1 - ec) / 1000, (e2 - ec) / 1000, (n1 - nc) / 1000, (n2 - nc) / 1000
    return ec - ex * cx - ey * cy, ex, ey, nc - nx * cx - ny * cy, nx, ny


def build():
    """Places every fetched tile (cache/google/solar_*.json) on the grid; where tiles overlap the later one wins."""
    e0, ex, ey, n0, nx, ny = affine()
    det = ex * ny - ey * nx
    dsm = array.array('f', [math.nan]) * (W * H)
    rgb, mask = bytearray(3 * W * H), bytearray(W * H)
    for meta in sorted(glob.glob(os.path.join(CACHE, 'solar_*.json'))):
        name = meta[:-5]
        D, R, M = (solartiff.read(f'{name}_{k}.tif') for k in ('dsm', 'rgb', 'mask'))
        assert (D['w'], D['h'], D['x0'], D['y0']) == (R['w'], R['h'], R['x0'], R['y0']) == (M['w'], M['h'], M['x0'], M['y0'])
        w, h, px, d, r, m = D['w'], D['h'], D['px'], D['data'], R['data'], M['data']
        xs, ys = [], []  # the tile's corners in local metres give the cells it can cover
        for E, N in ((D['x0'], D['y0']), (D['x0'] + w * px, D['y0']), (D['x0'], D['y0'] - h * px), (D['x0'] + w * px, D['y0'] - h * px)):
            xs.append(((E - e0) * ny - (N - n0) * ey) / det); ys.append(((N - n0) * ex - (E - e0) * nx) / det)
        i0, i1 = max(0, int(min(xs) - geo.X0)), min(W, int(max(xs) - geo.X0) + 1)
        j0, j1 = max(0, int(min(ys) - geo.Y0)), min(H, int(max(ys) - geo.Y0) + 1)
        for j in range(j0, j1):
            x, y = geo.X0 + i0 + 0.5, geo.Y0 + j + 0.5
            cf = (e0 + ex * x + ey * y - D['x0']) / px
            rf = (D['y0'] - (n0 + nx * x + ny * y)) / px
            dc, dr, o = ex / px, -nx / px, j * W + i0
            for _ in range(i1 - i0):
                c, q = int(cf), int(rf)
                if 0 <= c < w and 0 <= q < h and cf >= 0 and rf >= 0:
                    k = q * w + c
                    dsm[o] = d[k]; mask[o] = m[k]; rgb[3 * o:3 * o + 3] = r[3 * k:3 * k + 3]
                cf += dc; rf += dr; o += 1
        print('placed', os.path.basename(name), flush=True)
    for fn, data in (('local_dsm.f32', dsm), ('local_rgb.u8', rgb), ('local_mask.u8', mask)):
        with open(os.path.join(CACHE, fn), 'wb') as f: f.write(data.tobytes() if hasattr(data, 'tobytes') else data)


def load():
    """(dsm array 'f', rgb bytes, mask bytes), building the cache on first use."""
    if not os.path.exists(os.path.join(CACHE, 'local_mask.u8')): build()
    dsm = array.array('f')
    with open(os.path.join(CACHE, 'local_dsm.f32'), 'rb') as f: dsm.frombytes(f.read())
    with open(os.path.join(CACHE, 'local_rgb.u8'), 'rb') as f: rgb = f.read()
    with open(os.path.join(CACHE, 'local_mask.u8'), 'rb') as f: mask = f.read()
    assert len(dsm) == len(mask) == W * H and len(rgb) == 3 * W * H
    return dsm, rgb, mask


def write_png(path, w, h, rgb_rows_top_first):
    """8-bit RGB PNG from w·h·3 bytes, top row first (for looking at intermediate results)."""
    raw = b''.join(b'\x00' + rgb_rows_top_first[3 * w * r:3 * w * (r + 1)] for r in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))


if __name__ == '__main__':
    build()
