"""Assembles the folder that gets deployed: dist/ with index.html, src/, the two data files the page loads
and private/, and nothing else.

An allow-list on purpose: the project folder also holds an API key (.env), downloaded tiles (cache/) and reference
photos, none of which may be uploaded by accident.

NOTE: private/ is the measured model derived from Google imagery. Deploying dist/ makes it public.

Usage: python3 -I tools/build_site.py
"""
import os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
LIMIT = 25 * 1024 * 1024  # Cloudflare's size limit for one static asset


def main():
    shutil.rmtree(DIST, ignore_errors=True)
    os.makedirs(os.path.join(DIST, 'data'))
    shutil.copy2(os.path.join(ROOT, 'index.html'), DIST)
    for f in ['osm.json', 'pois.json']:  # the page loads nothing else from data/
        shutil.copy2(os.path.join(ROOT, 'data', f), os.path.join(DIST, 'data'))
    for d in ['src', 'private']:
        shutil.copytree(os.path.join(ROOT, d), os.path.join(DIST, d), ignore=shutil.ignore_patterns('.*', '__pycache__'))
    files = [os.path.join(p, f) for p, _, fs in os.walk(DIST) for f in fs]
    top = sorted(os.listdir(DIST))
    assert top == ['data', 'index.html', 'private', 'src'], top
    big = [f for f in files if os.path.getsize(f) > LIMIT]
    assert not big, f'over 25 MiB: {big}'
    print(f'dist/: {len(files)} files, {sum(map(os.path.getsize, files)) / 1e6:.1f} MB, top level: {", ".join(top)}')


if __name__ == '__main__':
    assert not sys.argv[1:], __doc__
    main()
