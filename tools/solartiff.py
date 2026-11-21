"""Reader for Google Solar API GeoTIFFs: big-endian, 256 px deflate tiles, float32 or uint8, UTM zone 34N (stdlib only)."""
import array, math, struct, sys, zlib


def read(path):
    """Whole raster as dict(w, h, bands, data, x0, y0, px): data is a row-major, band-interleaved array ('f' or
    'B'), row 0 the northernmost; (x0, y0) is the UTM corner of the top-left pixel and px its size in metres."""
    with open(path, 'rb') as f: b = f.read()
    assert b[:4] == b'MM\x00*', 'not a big-endian TIFF'
    off, = struct.unpack_from('>I', b, 4); n, = struct.unpack_from('>H', b, off); t = {}
    fm = {3: 'H', 4: 'I', 12: 'd'}
    for i in range(n):
        tag, typ, cnt = struct.unpack_from('>HHI', b, off + 2 + 12 * i)
        if typ not in fm: continue
        size = struct.calcsize(fm[typ]) * cnt; vo = off + 10 + 12 * i
        if size > 4: vo, = struct.unpack_from('>I', b, vo)
        t[tag] = struct.unpack_from(f'>{cnt}{fm[typ]}', b, vo)
    w, h, tw, th, bands = t[256][0], t[257][0], t[322][0], t[323][0], t[277][0]
    kind = (t[258][0], t.get(339, (1,))[0])
    assert t[259][0] in (8, 32946) and kind in ((32, 3), (8, 1)) and t.get(284, (1,))[0] == 1 and t.get(317, (1,))[0] == 1, kind
    code = 'f' if kind[0] == 32 else 'B'
    out = array.array(code, bytes(w * h * bands * (kind[0] // 8)))
    across = -(-w // tw)
    for k, (o, c) in enumerate(zip(t[324], t[325])):
        tile = array.array(code); tile.frombytes(zlib.decompress(b[o:o + c]))
        if code == 'f' and sys.byteorder == 'little': tile.byteswap()
        r0, c0 = (k // across) * th, (k % across) * tw
        cols = min(tw, w - c0)
        for r in range(min(th, h - r0)):
            at = ((r0 + r) * w + c0) * bands
            out[at:at + cols * bands] = tile[r * tw * bands:(r * tw + cols) * bands]
    m = t[34264]  # ModelTransformation: x = m0·col + m3, y = m5·row + m7
    assert m[1] == 0 and m[4] == 0 and m[0] == -m[5], 'rotated raster'
    return dict(w=w, h=h, bands=bands, data=out, x0=m[3], y0=m[7], px=m[0])


def utm34(lat, lon):
    """WGS84 degrees to UTM zone 34N easting, northing (Krueger series; far better than a pixel here)."""
    a, f = 6378137.0, 1 / 298.257223563
    n = f / (2 - f); A = a / (1 + n) * (1 + n * n / 4 + n ** 4 / 64)
    al = (n / 2 - 2 * n * n / 3 + 5 * n ** 3 / 16, 13 * n * n / 48 - 3 * n ** 3 / 5, 61 * n ** 3 / 240)
    phi, lam = math.radians(lat), math.radians(lon - 21)
    e = 2 * math.sqrt(n) / (1 + n)
    t = math.sinh(math.atanh(math.sin(phi)) - e * math.atanh(e * math.sin(phi)))
    xi, eta = math.atan2(t, math.cos(lam)), math.atanh(math.sin(lam) / math.hypot(1, t))
    E = 500000 + 0.9996 * A * (eta + sum(al[j] * math.cos(2 * (j + 1) * xi) * math.sinh(2 * (j + 1) * eta) for j in range(3)))
    N = 0.9996 * A * (xi + sum(al[j] * math.sin(2 * (j + 1) * xi) * math.cosh(2 * (j + 1) * eta) for j in range(3)))
    return E, N


# self-check against a published value: the zone's central meridian on the equator is exactly (500000, 0)
assert all(abs(v - k) < 1e-6 for v, k in zip(utm34(0, 21), (500000, 0)))
