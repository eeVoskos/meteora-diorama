import math

LAT0, LON0 = 39.7145, 21.6265
R = 6371008.8
# block rectangle in local metres; the origin is not its centre (it grew east and south)
X0, X1, Y0, Y1 = -1840, 2400, -1980, 1836
WIDTH, HEIGHT, STEP = X1 - X0, Y1 - Y0, 8
NX, NY = WIDTH // STEP + 1, HEIGHT // STEP + 1  # 531 x 478 samples, first at (X0, Y0)
_KX = R * math.radians(1) * math.cos(math.radians(LAT0))
_KY = R * math.radians(1)


def to_xy(lat, lon):
    return (_KX * (lon - LON0), _KY * (lat - LAT0))


def area2(r):
    return sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r)))


def dedupe(r):
    out = []
    for p in r:
        if not out or p != out[-1]:
            out.append(p)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out


# each edge: (inside test, intersection with that edge's line)
def _edges():
    return [
        (lambda p: p[0] >= X0, lambda a, b: (X0, a[1] + (b[1] - a[1]) * (X0 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[0] <= X1, lambda a, b: (X1, a[1] + (b[1] - a[1]) * (X1 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[1] >= Y0, lambda a, b: (a[0] + (b[0] - a[0]) * (Y0 - a[1]) / (b[1] - a[1]), Y0)),
        (lambda p: p[1] <= Y1, lambda a, b: (a[0] + (b[0] - a[0]) * (Y1 - a[1]) / (b[1] - a[1]), Y1)),
    ]


def inside_block(x, y, margin=0):
    return X0 - margin <= x <= X1 + margin and Y0 - margin <= y <= Y1 + margin


def clip_ring(ring):
    """Sutherland-Hodgman against the block rectangle; [] if degenerate or empty."""
    pts = dedupe([tuple(p) for p in ring])
    if len(pts) < 3:
        return []
    for inside, cross in _edges():
        if not pts:
            return []
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cross(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cross(prev, cur))
        pts = dedupe(out)
    if len(pts) < 3 or abs(area2(pts)) < 1e-9:
        return []
    return pts


def _clip_seg(a, b):
    """Liang-Barsky; returns clipped (p, q) or None."""
    t0, t1 = 0.0, 1.0
    dx, dy = b[0] - a[0], b[1] - a[1]
    for p, q in ((-dx, a[0] - X0), (dx, X1 - a[0]), (-dy, a[1] - Y0), (dy, Y1 - a[1])):
        if p == 0:
            if q < 0:
                return None
        else:
            t = q / p
            if p < 0:
                t0 = max(t0, t)
            else:
                t1 = min(t1, t)
    if t0 > t1:
        return None
    return (a[0] + t0 * dx, a[1] + t0 * dy), (a[0] + t1 * dx, a[1] + t1 * dy)


def clip_line(line):
    pieces, cur = [], []
    for i in range(len(line) - 1):
        a, b = tuple(line[i]), tuple(line[i + 1])
        s = _clip_seg(a, b)
        if s is None:
            if len(cur) > 1:
                pieces.append(cur)
            cur = []
            continue
        p, q = s
        if cur and cur[-1] != p:
            if len(cur) > 1:
                pieces.append(cur)
            cur = []
        if not cur:
            cur = [p]
        cur.append(q)
        if q != b:  # line leaves the block here
            pieces.append(cur)
            cur = []
    if len(cur) > 1:
        pieces.append(cur)
    return pieces
