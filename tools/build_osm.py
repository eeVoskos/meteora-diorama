import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "cache", "osm", "raw.json")
OUT = os.path.join(ROOT, "data", "osm.json")

ROAD = {"primary": "primary", "secondary": "secondary", "tertiary": "tertiary",
        "motorway": "primary", "trunk": "primary",  # not in the brief; mapped so the main road has no gaps
        "primary_link": "primary", "secondary_link": "secondary", "tertiary_link": "tertiary", "motorway_link": "primary",
        "residential": "street", "unclassified": "street", "living_street": "street", "pedestrian": "street",
        "service": "service", "track": "track", "footway": "path", "path": "path", "cycleway": "path", "steps": "steps"}
COVER = [("amenity", {"school": "school", "kindergarten": "school", "college": "school", "parking": "parking"}),
         ("place", {"square": "square"}),
         ("natural", {"wood": "wood", "scrub": "scrub", "heath": "scrub", "grassland": "grass", "water": "water",
                      "shingle": "gravel", "sand": "gravel"}),
         ("landuse", {"cemetery": "cemetery", "forest": "wood", "grass": "grass", "meadow": "grass", "farmland": "farmland", "orchard": "orchard",
                      "vineyard": "orchard", "residential": "residential"}),
         ("leisure", {"park": "park", "pitch": "pitch", "track": "track", "playground": "playground", "garden": "garden",
                      "swimming_pool": "pool"}),
         ("waterway", {"riverbank": "water"})]
PAVERS = {"paving_stones", "sett", "cobblestone", "unhewn_cobblestone", "concrete:plates"}
UNPAVED = {"ground", "dirt", "unpaved", "gravel", "compacted", "grass", "pebblestone", "rock"}
LANDMARKS = [("way", 534903882, "monastery"), ("way", 634421149, "monastery"), ("way", 433488106, "monastery"),
             ("way", 379737941, "monastery"), ("way", 379736577, "monastery"), ("way", 379736573, "monastery"),
             ("way", 609218810, "landmark"), ("way", 585513480, "landmark"), ("way", 415534160, "landmark"),
             ("way", 302995899, "landmark"), ("node", 9859440669, "landmark"), ("node", 4692270989, "landmark")]

malformed = 0


def valid(r):
    r = geo.dedupe(r)
    return len(r) >= 3 and abs(geo.area2(r)) > 1e-9


def inside(p, ring):
    x, y = p
    c = False
    for i in range(len(ring)):
        (x1, y1), (x2, y2) = ring[i - 1], ring[i]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            c = not c
    return c


def centroid(r):
    a = cx = cy = 0.0
    for i in range(len(r)):
        (x1, y1), (x2, y2) = r[i - 1], r[i]
        k = x1 * y2 - x2 * y1
        a += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k
    return (cx / (3 * a), cy / (3 * a))


def pts(geom):
    return [geo.to_xy(g["lat"], g["lon"]) for g in geom]


def join(segs):
    """Join member ways (lists of (lat, lon) tuples) into closed rings."""
    global malformed
    rings = []
    while segs:
        cur = segs.pop()
        while cur[0] != cur[-1]:
            for i, w in enumerate(segs):
                if w[0] == cur[-1]: cur = cur + w[1:]
                elif w[-1] == cur[-1]: cur = cur + w[::-1][1:]
                else: continue
                segs.pop(i)
                break
            else:
                malformed += 1
                break
        else:
            rings.append(cur[:-1])
    return rings


def areas(e):
    """-> list of (outer, [inners]) in local metres, unclipped. Open rings count as malformed."""
    global malformed
    if e["type"] == "way":
        g = e["geometry"]
        if g[0] != g[-1] or len(g) < 4:
            malformed += 1
            return []
        return [(pts(g[:-1]), [])]
    segs = {"outer": [], "inner": []}
    for m in e["members"]:
        if m["type"] == "way" and m["role"] in segs and m.get("geometry"):
            segs[m["role"]].append([(g["lat"], g["lon"]) for g in m["geometry"]])
    outers = [[geo.to_xy(*p) for p in r] for r in join(segs["outer"])]
    inners = [[geo.to_xy(*p) for p in r] for r in join(segs["inner"])]
    return [(o, [i for i in inners if inside(i[0], o)]) for o in outers]


def flat(r):
    return [round(v, 1) + 0.0 for p in r for v in p]


def clipped_areas(e):
    """areas() clipped to the block; degenerate input rings count as malformed."""
    global malformed
    out = []
    for o, hs in areas(e):
        if not valid(o):
            malformed += 1
            continue
        co = geo.clip_ring(o)
        if co:
            out.append((co, [c for c in (geo.clip_ring(h) for h in hs) if c]))
    return out


def cover_kind(t):
    if t.get("highway") == "pedestrian" and t.get("area") == "yes":
        return "square"
    for k, m in COVER:
        if t.get(k) in m:
            return m[t[k]]
    if t.get("natural") == "riverbed" or t.get("riverbed") == "gravel":
        return "gravel"


def road_surface(t):
    s = t.get("surface")
    return "pavers" if s in PAVERS else "unpaved" if s in UNPAVED else None


def building_type(t):
    b = t["building"]
    if t.get("amenity") == "place_of_worship" or b in ("church", "chapel", "monastery"):
        return "church"
    return None if b in ("yes", "house", "residential", "apartments") else b


def main():
    global malformed
    els = json.load(open(RAW))["elements"]
    byid = {(e["type"], e["id"]): e for e in els}
    out = {k: [] for k in ("buildings", "roads", "rail", "cover", "rocks", "cliffs", "trees", "places")}

    worship = [geo.to_xy(e["lat"], e["lon"]) for e in els
               if e["type"] == "node" and e.get("tags", {}).get("amenity") == "place_of_worship"]
    bvals = []  # raw `building` value, parallel to out["buildings"]
    for e in els:
        t = e.get("tags", {})
        if e["type"] == "node":
            if t.get("natural") == "tree":
                x, y = geo.to_xy(e["lat"], e["lon"])
                if geo.inside_block(x, y):
                    out["trees"] += flat([(x, y)])
            continue
        if "building" in t:
            for o, hs in areas(e):
                if not valid(o):
                    malformed += 1
                    continue
                cx, cy = centroid(geo.dedupe(o))
                if not geo.inside_block(cx, cy):
                    continue
                b = {"id": e["id"], "p": flat(o)}
                if hs: b["h"] = [flat(h) for h in hs]
                if t.get("building:levels", "").isdigit(): b["lv"] = int(t["building:levels"])
                if building_type(t): b["t"] = building_type(t)
                out["buildings"].append(b)
                bvals.append(t["building"])
            continue
        if e["type"] == "way":
            g = e["geometry"]
            if t.get("highway") in ROAD and t.get("area") != "yes":
                for piece in geo.clip_line(pts(g)):
                    r = {"p": flat(piece), "c": ROAD[t["highway"]]}
                    if road_surface(t): r["s"] = road_surface(t)
                    out["roads"].append(r)
            elif t.get("railway") == "rail":
                for piece in geo.clip_line(pts(g)):
                    out["rail"].append({"p": flat(piece)})
            elif t.get("natural") == "cliff":
                for piece in geo.clip_line(pts(g)):
                    out["cliffs"].append({"p": flat(piece)})
        if t.get("natural") == "bare_rock":
            for o, _ in clipped_areas(e):
                r = {"id": e["id"], "p": flat(o)}
                if t.get("name"): r["name"] = t["name"]
                out["rocks"].append(r)
        elif cover_kind(t):
            for o, hs in clipped_areas(e):
                c = {"k": cover_kind(t), "p": flat(o)}
                if c["k"] == "pitch" and t.get("sport"): c["sp"] = t["sport"]
                if hs: c["h"] = [flat(h) for h in hs]
                out["cover"].append(c)

    # buildings with a worship node inside, or inside school grounds, change type
    def ring_of(flatpts):
        return list(zip(flatpts[::2], flatpts[1::2]))

    grounds = [ring_of(c["p"]) for c in out["cover"] if c["k"] == "school"]
    for b, bv in zip(out["buildings"], bvals):
        ring = ring_of(b["p"])
        if b.get("t") != "church" and any(inside(w, ring) for w in worship):
            b["t"] = "church"
        elif b.get("t") != "church" and bv in ("yes", "school") and any(inside(centroid(geo.dedupe(ring)), g) for g in grounds):
            b["t"] = "school"

    def place(e, k):
        t = e.get("tags", {})
        p = {"k": k, "id": e["id"]}
        if e["type"] == "node":
            p["x"], p["y"] = (round(v, 1) + 0.0 for v in geo.to_xy(e["lat"], e["lon"]))
        else:
            o = pts(e["geometry"][:-1])
            p["x"], p["y"] = (round(v, 1) + 0.0 for v in centroid(o))
        p["en"] = t.get("name:en") or t.get("int_name") or t.get("name", "")
        p["el"] = t.get("name:el") or t.get("name", "")
        if e["type"] == "way": p["o"] = flat(o)
        return p

    for typ, i, k in LANDMARKS:
        out["places"].append(place(byid[(typ, i)], k))
    for e in els:
        t = e.get("tags", {})
        if e["type"] != "node": continue
        if t.get("natural") == "peak" and t.get("name"):
            out["places"].append(place(e, "peak"))
        elif t.get("place") in ("town", "village"):
            out["places"].append(place(e, "town"))

    # ---- checks
    def near(flatpts, m):
        return all(geo.inside_block(flatpts[i], flatpts[i + 1], m) for i in range(0, len(flatpts), 2))

    def rings_of(item):
        return [item["p"]] + item.get("h", [])

    for b in out["buildings"]:
        for r in rings_of(b):
            assert len(r) >= 6 and near(r, 60), b["id"]
    for k in ("roads", "rail", "cliffs"):
        for r in out[k]:
            assert len(r["p"]) >= 4 and near(r["p"], 0), (k, r)
    for k in ("cover", "rocks"):
        for it in out[k]:
            for r in rings_of(it):
                assert len(r) >= 6 and near(r, 0), (k, it.get("id"))
    assert near(out["trees"], 0)
    for p in out["places"]:
        assert near([p["x"], p["y"]], 0), p
        if "o" in p: assert len(p["o"]) >= 6 and near(p["o"], 60), p["id"]
    assert len(out["buildings"]) >= 1800, len(out["buildings"])
    assert len(out["roads"]) >= 500, len(out["roads"])
    assert len(out["rocks"]) >= 150, len(out["rocks"])
    kinds = {}
    for c in out["cover"]: kinds[c["k"]] = kinds.get(c["k"], 0) + 1
    for k, n in (("school", 6), ("square", 2), ("parking", 20), ("pitch", 10)):
        assert kinds.get(k, 0) >= n, (k, kinds.get(k, 0))
    assert sum(b.get("t") == "church" for b in out["buildings"]) >= 25
    assert sum(b.get("t") == "school" for b in out["buildings"]) >= 12
    assert sum(r.get("s") == "pavers" for r in out["roads"]) >= 40
    ids = {p["id"] for p in out["places"]}
    assert all(i in ids for _, i, _ in LANDMARKS)

    text = json.dumps(out, separators=(",", ":"), ensure_ascii=False)
    size = len(text.encode())
    assert size < 2.5e6, size

    # temp name in the same directory, then rename, so a failed run never leaves a half file
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT + ".tmp", "w") as f:
        f.write(text)
    os.replace(OUT + ".tmp", OUT)

    cover = {}
    for c in out["cover"]: cover[c["k"]] = cover.get(c["k"], 0) + 1
    places = {}
    for p in out["places"]: places[p["k"]] = places.get(p["k"], 0) + 1
    bids = {b["id"] for b in out["buildings"]}
    print("buildings", len(out["buildings"]), "roads", len(out["roads"]), "rail", len(out["rail"]),
          "rocks", len(out["rocks"]), "cliffs", len(out["cliffs"]), "trees", len(out["trees"]) // 2)
    print("cover", cover)
    print("places", places)
    print("malformed rings dropped", malformed)
    print("landmark ways tagged as buildings:", [i for t_, i, _ in LANDMARKS if t_ == "way" and i in bids])
    print("landmark ways outline only:", [i for t_, i, _ in LANDMARKS if t_ == "way" and i not in bids])
    print("size", size, "bytes")


if __name__ == "__main__":
    main()
