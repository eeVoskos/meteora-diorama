"""One Solar API request for the town centre: is Kalampaka covered, at what quality, imagery from when?

Reads GOOGLE_MAPS_KEY from .env in the project folder. Downloads no imagery; prints the reply with URLs hidden.
Usage: python3 -I tools/probe_google.py [lat lon]
"""
import json
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
LAT, LON = 39.7072, 21.6233  # town-hall square


def key():
    for line in (ROOT / '.env').read_text().splitlines():
        if line.startswith('GOOGLE_MAPS_KEY='):
            return line.split('=', 1)[1].strip().strip('"\'')
    sys.exit('no GOOGLE_MAPS_KEY in .env')


def ask(lat, lon, quality, extra=(), radius=100, pixel=0.5):
    q = [('location.latitude', lat), ('location.longitude', lon), ('radiusMeters', radius), ('pixelSizeMeters', pixel),
         ('view', 'IMAGERY_LAYERS'), ('requiredQuality', quality), *extra, ('key', key())]
    req = urllib.request.Request('https://solar.googleapis.com/v1/dataLayers:get?' + urllib.parse.urlencode(q),
                                 headers={'User-Agent': 'osm-diorama/0.1'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:  # the error body never contains the key; the URL (which does) is not printed
        return e.code, json.loads(e.read() or b'{}')


if __name__ == '__main__':
    lat, lon = (float(a) for a in sys.argv[1:3]) if len(sys.argv) >= 3 else (LAT, LON)
    for quality, extra in (('MEDIUM', ()), ('BASE', (('experiments', 'EXPANDED_COVERAGE'),))):
        status, body = ask(lat, lon, quality, extra)
        shown = {k: ('<url>' if isinstance(v, str) and v.startswith('http') else v) for k, v in body.items()}
        print(quality, status, json.dumps(shown, indent=1)[:1500])
        if status == 200:
            break
