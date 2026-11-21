# AGENTS.md

Notes for coding agents (and people) working on this repository. Read the README first for what the project is
and how to run it; this file covers how to change it safely.

## Hard rules

- **No build step, no package manager, no dependencies.** The page is plain ES modules. three.js 0.170.0 comes
  only from the import map in `index.html`. Do not add npm packages, bundlers or frameworks.
- **Python tools use the standard library only**, and are run as `python3 -I tools/<name>.py` from the project
  folder.
- **Never commit** `.env`, `private/`, `dist/`, or anything in `cache/` other than `cache/osm/raw.json`.
  `.gitignore` already covers them; do not weaken it.
- **Never print, log or copy the Google key.** It lives in `.env` as `GOOGLE_MAPS_KEY=` and nowhere else.
- **Do not re-fetch the map snapshot.** `cache/osm/raw.json` is pinned: rock outline ids, landmark ids, angles and
  offsets across `src/landmarks/` and the tests depend on its exact content. To add
  area, use `python3 -I tools/fetch_osm.py extend`, which only adds ids that are not there yet.
- **Requests to outside services** (Overpass, Google) carry a generic `User-Agent` (`osm-diorama/0.1`) and no
  personal details. Google tiles are fetched once and kept in `cache/google/`; do not delete or re-download them.
- **Do not deploy.** `tools/build_site.py` assembles `dist/`; deploying is the maintainer's step (`npx wrangler deploy`).

## Run, test, verify

```bash
python3 -m http.server 8137 --bind 127.0.0.1   # then http://localhost:8137
node --test tests/                             # page logic, Node 20+
python3 -I tools/test_tools.py                 # data tools
```

The tests need neither `private/` nor a key. The page does need `private/` (see README, "Build the model data");
without it you can still run the tests but cannot look at the result.

Looking at a change in a browser:

- `?view=<name>` jumps to a named view (`home`, `town`, `rocks`, any landmark key, any place id from
  `data/pois.json`). `?time=dawn|day|dusk|night` sets the light. They combine.
- `window.__diorama` exposes `scene`, `camera`, `renderer`, `controls`, `render()`, `setView(name)`,
  `updateShadows()`, `hf` (the heightfield), `osm`, `treePoints` and `labels`. `window.__life` holds the traffic
  agents while the Nature layer is on.
- `setView` takes a registered name only. For an arbitrary spot, register one first:
  `(await import('/src/scene.js')).registerView('tmp', { x, y, zoom, azimuth, elevation })`.
- Browsers cache the modules hard. After editing, reload with the cache bypassed.
- To time a frame: call `__diorama.render()` followed by `gl.readPixels(0, 0, 1, 1, …)` to force the GPU to
  finish, and take the best of several runs. `gl.finish()` alone gives meaningless numbers, and the first view
  after a load includes warm-up.

## Architecture in one page

**Coordinates.** Local metres from 39.7145° N, 21.6265° E: `x` east, `y` north. Block: x −1840…2400,
y −1980…1836 (`tools/geo.py` and `BLOCK` in `src/geom.js` must agree). three.js: X = x, Y = height, Z = −y.
Landmark modules work in their own frame: `u` east, `v` north from the site's centroid.

**Data.** `src/data.js` loads `data/osm.json` (map), `data/pois.json` (place descriptions) and `private/` (measured: `heights.json` + `heights.bin`
4 m terrain grid, `google.json` building heights, extra buildings and trees, `ground.bin` ground classes on a
2 m grid). All of them are required.

**Modules** (`src/`):

| Module | Job |
|---|---|
| `main.js` | Wires everything together in order; the only place that touches the DOM besides `labels.js`, `controls.js`, `life.js` |
| `scene.js` | Renderer, the two cameras, orbit controls, named views, the draw loop |
| `terrain.js`, `ground.js` | Terrain mesh and rock shader; the painted ground texture |
| `heightfield.js` | `hf.at(x, y)`: terrain height anywhere |
| `rules.js` | Pure rules: town zones, storeys, roof kinds, church plans |
| `buildings.js`, `churches.js`, `yards.js`, `fountain.js` | Generic buildings, parish churches, yard walls, the town fountain |
| `landmarks/` | `registry.js` (metadata), `kit.js` (shared parts and materials), `index.js` (placement), one module per landmark |
| `trees.js` | Instanced trees in 800 m tiles, two detail levels, wind sway in the vertex shader |
| `labels.js`, `overlap.js`, `controls.js` | HTML labels and pins, overlap culling, the control bar |
| `pois.js`, `card.js` | Joins the map's places with `data/pois.json`; the info card a pin opens |
| `life.js`, `lifeplan.js`, `traffic.js` | The Nature layer: clouds, birds, cars and walkers on the road graph |
| `geom.js`, `palette.js` | Geometry helpers and seeded random; every colour |

**Drawing.** `scene.js` draws on demand. `view.animate(f)` registers a per-frame callback and makes the scene
redraw continuously until it is removed (only the Nature layer does this). `view.onBeforeRender(f)` calls
`f(metresPerPixel)` before each frame; trees use it to pick their detail level and sway. The shadow map is static:
after adding or moving anything that casts a shadow, call `view.updateShadows()`. `view.setTime(key)` sets the
sun, the fill light, the sky and the haze from the `TIMES` table in `scene.js` and redraws the shadows.

## Conventions

- Keep logic that can be pure out of three.js and the DOM, and test it (`rules.js`, `geom.js`, `lifeplan.js`,
  `traffic.js`, `overlap.js`, `heightfield.js` and `landmarks/registry.js` are all tested under Node).
- Randomness is seeded (`mulberry32`, `hash01`), so the model is the same on every load. Keep it that way.
- Colours go in `src/palette.js`, taken from `docs/reference/visual-reference.md`.
- Comments say why, not what, in one line. A long line is fine; a decoded one-liner is not.
- British spelling in prose and comments (colour, metres).
- The smallest change that fully solves the task. No options, wrappers or abstractions nobody asked for.
- UI text exists in English and Greek: pass `{ en, el }` to the helpers in `controls.js`.
- The page must stay usable by keyboard and screen reader: real buttons, `aria-*` states, visible focus.

## How to

- **Add a landmark.** Add its entry to `src/landmarks/registry.js` (OSM id, names), write
  `src/landmarks/<key>.js` exporting `build(kit, site)`, and register it in `MODULES` in `index.js`. Run
  `node tools/site-info.mjs <key>` to see the outline, nearby buildings, paths and terrain heights in the site
  frame. Use only the materials in `kit.mats`. Check the facts in `docs/reference/visual-reference.md`.
- **Add or edit a place.** Edit `data/pois.json`: `id` (also its `?view=` name), `k` (`town`, `monastery` or
  `landmark`), `x`/`y` in local metres, names, `kind` and `text` in both languages. Give it `osm` (the place's
  OpenStreetMap id in `data/osm.json`) to describe a place the map already names instead of adding a pin.
  `tests/pois.test.js` checks the file.
- **Add a time of day.** Add a row to `TIMES` in `scene.js` and an option to the switch in `main.js`.
- **Add a named view.** `registerView(key, { x, y, zoom, azimuth, elevation })` in `main.js`.
- **Add a control.** Use `toggle` or `segmented` from `controls.js` and append to `#ui`.
- **Add to the Nature layer.** Put the motion maths in `lifeplan.js` or `traffic.js` with a test, and the meshes
  in `life.js`. Everything there must be removable when the layer is switched off.
- **Change what is measured.** Edit `tools/build_google.py`, cover it in `tools/test_tools.py`, re-run it to
  rewrite `private/`, and keep `src/data.js` in step with the file formats.
- **Grow the area.** Change the block in `tools/geo.py` and `src/geom.js` together, extend the map snapshot,
  fetch the extra Google tiles, then rebuild `data/osm.json` and `private/`.

## Things already tried and dropped

Do not bring these back without a new idea behind them:

- **A map-only terrain** (AW3D30 30 m elevation sharpened with OSM rock outlines). The rock tops came out flat and
  unnatural. Its tool is gone; `tests/fixtures/heights.*` is a grid it produced, kept as a test fixture.
- **Fewer terrain triangles when zoomed out.** It visibly softened the rocks: cliffs are near-vertical, so a
  coarse cell covers many screen pixels there, and building the coarse meshes in the same index buffer also
  blurred the vertex normals. If terrain cost matters, keep full detail on steep cells.
- **A driving mode** (steer a car along the roads). The ground paint and models are not made to be seen from a
  car's height.

## Performance notes

On an Apple M3 Max laptop at 2560 × 1600 a frame of the whole model takes about 5 ms: roughly 2.4 M triangles, of
which 2 M are terrain. Trees are the next cost; they are culled per tile and swap to a 14-triangle shape when a
screen pixel covers more than 1.2 m of ground. Phones have not been measured.

## Known gaps

- Not tested on touch devices, Safari or Firefox.
- The swap between tree shapes can be visible while zooming; tree shadows do not follow the sway.
- The Greek/English switch changes labels, cards and controls, not the title on the page or the info panel.
- "Go there" jumps; there is no camera flight. At night nothing is lit from inside.
- A clone cannot show the model without a Google key (see README).
