import json, os, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "cache", "osm", "raw.json")
SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
BOX = (39.698, 21.605, 39.731, 21.648)  # the pinned snapshot's area
# strips added when the block grew east and south (lat0, lon0, lat1, lon1); they abut BOX
EXTEND = [(39.6966, 21.648, 39.731, 21.6546), (39.6966, 21.605, 39.698, 21.648)]


def query(boxes):
    """Same query as the snapshot's, over the union of the boxes."""
    bb = [",".join(str(v) for v in b) for b in boxes]
    return ("[out:json][timeout:120];\n("
            + "".join(f"way({b});\n " for b in bb)
            + "".join(f'node({b})[~"^(natural|place|tourism|amenity|railway|historic|man_made)$"~"."];\n ' for b in bb)
            + " ".join(f"rel({b})[type=multipolygon];" for b in bb)
            + ");\nout geom;")  # `out tags geom` omits relation members; `out geom` (body) keeps them


QUERY = query([BOX])
LANDMARK_WAYS = [534903882, 634421149, 433488106, 379737941, 379736577, 379736573, 609218810, 585513480, 415534160, 302995899]
LANDMARK_NODES = [9859440669, 4692270989]


def load_cached():
    try:
        with open(RAW) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def post(url, q):
    body = urllib.parse.urlencode({"data": q}).encode()
    req = urllib.request.Request(url, data=body, headers={"User-Agent": "osm-diorama/0.1"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode("utf-8"))  # raises on non-JSON


def download(q=QUERY):
    for url in SERVERS:
        for attempt in (1, 2):
            try:
                data = post(url, q)
                if data.get("elements"):
                    return data
                print(f"{url} attempt {attempt}: empty elements (remark: {data.get('remark')})")
            except Exception as e:
                print(f"{url} attempt {attempt}: {type(e).__name__}: {e}")
            time.sleep(5)
    sys.exit("BLOCKED: both Overpass servers failed")


def save(data):
    os.makedirs(os.path.dirname(RAW), exist_ok=True)
    tmp = RAW + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, RAW)


def extend(data):
    """Fetch only the EXTEND strips and append elements whose (type, id) is new; existing ones stay as they are."""
    have = {(e["type"], e["id"]) for e in data["elements"]}
    added = {}
    for e in download(query(EXTEND))["elements"]:
        if (e["type"], e["id"]) not in have:
            have.add((e["type"], e["id"]))
            data["elements"].append(e)
            added[e["type"]] = added.get(e["type"], 0) + 1
    print("added", sum(added.values()), "elements", added)
    save(data)


def main():
    data = load_cached()
    if len(sys.argv) > 1 and sys.argv[1] == "extend":
        if data is None:
            sys.exit("extend needs the cached snapshot " + RAW)
        extend(data)
    elif data is None:
        data = download()
        save(data)
    els = data["elements"]
    ids = {(e["type"], e["id"]) for e in els}
    counts = {}
    for e in els:
        counts[e["type"]] = counts.get(e["type"], 0) + 1
    print(len(els), "elements", counts)
    assert len(els) >= 3000, len(els)
    assert all(e.get('members') for e in els if e['type'] == 'relation'), 'relations without members'
    for w in LANDMARK_WAYS:
        assert ("way", w) in ids, f"missing way {w}"
    for n in LANDMARK_NODES:
        assert ("node", n) in ids, f"missing node {n}"


if __name__ == "__main__":
    main()
