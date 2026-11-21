"""Fetch Google Solar API layers for the block into cache/google/: surface heights (dsm), aerial image (rgb)
and building mask, one GeoTIFF each per tile. The tiles stay on this machine (cache/ is ignored by git).

Usage: python3 -I tools/fetch_google.py sample   (one 200 m tile on the town-hall square)
       python3 -I tools/fetch_google.py all      (the whole block: 24 one-kilometre tiles at 0.5 m per pixel)
Tiles already on disk are skipped. Links in a reply expire after an hour, so each tile is downloaded at once.
"""
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo import LAT0, LON0, _KX, _KY
from probe_google import LAT, LON, ROOT, ask, key

RADIUS, PIXEL = 500, 0.5  # radius may not exceed pixel size x 1000
# Tile centres in local metres, as fetched: a 4 x 4 grid over the first block (x -1840..1840, y -1836..1836), then
# a column for the east extension and a row for the south one. Names are fixed so nothing is fetched twice.
CENTRES = [(f'solar_{i}_{j}', -1840 + (i + 0.5) * 920, -1836 + (j + 0.5) * 918) for j in range(4) for i in range(4)]
CENTRES += [(f'solar_e_{j}', 2120, y) for j, y in enumerate((-1503, -549, 405, 1359))]
CENTRES += [(f'solar_s_{i}', x, -2350) for i, x in enumerate((-1380, -460, 460, 1380))]


def tiles(mode):
    if mode == 'sample':
        return [('sample', LAT, LON, 100)]
    return [(name, LAT0 + y / _KY, LON0 + x / _KX, RADIUS) for name, x, y in CENTRES]


def fetch(mode):
    out = ROOT / 'cache' / 'google'
    out.mkdir(parents=True, exist_ok=True)
    for name, lat, lon, radius in tiles(mode):
        meta = out / f'{name}.json'
        if meta.exists():
            continue
        status, body = ask(lat, lon, 'MEDIUM', radius=radius, pixel=PIXEL)
        if status != 200:
            print(name, 'no data:', status, body.get('error', {}).get('status'))
            continue
        for layer in ('dsm', 'rgb', 'mask'):
            req = urllib.request.Request(body[layer + 'Url'] + '&key=' + key(), headers={'User-Agent': 'osm-diorama/0.1'})
            with urllib.request.urlopen(req, timeout=300) as r:
                data = r.read()
            (out / f'{name}_{layer}.tif').write_bytes(data)
            print(name, layer, len(data), 'bytes')
        keep = {k: v for k, v in body.items() if not k.endswith('Url')}
        meta.write_text(json.dumps({'lat': lat, 'lon': lon, 'radius': radius, 'pixel': PIXEL, **keep}))  # written last: marks the tile complete


if __name__ == '__main__':
    assert len(sys.argv) == 2 and sys.argv[1] in ('sample', 'all'), __doc__
    fetch(sys.argv[1])
