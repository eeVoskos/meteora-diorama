import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P } from './palette.js';
import { mulberry32 } from './geom.js';

const BROADLEAF_H = 6.4; // m at scale 1 (scatter scales it to 5–8 m)
const CYPRESS_H = 10;    // m at scale 1 (8–12 m)

const SWAY = 0.8; // m a cypress tip moves at full sway (a broadleaf crown top about two thirds of that)
// Full sway once a screen pixel covers 0.25 m of ground or less, none from 0.5 m up, where it would be under a pixel.
const SWAY_NEAR = 0.25, SWAY_FAR = 0.5;
const wind = { t: { value: 0 }, amp: { value: 0 } }; // shared by both tree materials

// Called before each frame while the nature layer is on (t in seconds); pass Infinity as metresPerPixel to still the trees.
export function treeWind(t, metresPerPixel) {
  wind.t.value = t;
  wind.amp.value = SWAY * (1 - THREE.MathUtils.smoothstep(metresPerPixel, SWAY_NEAR, SWAY_FAR));
}

// Bends each tree from the ground up: gusts roll across the map as a wave (phase from the tree's position), all
// leaning the same way. The static shadow map is not redrawn, so shadows stay put.
function swaying(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.windT = wind.t;
    sh.uniforms.windAmp = wind.amp;
    sh.vertexShader = 'uniform float windT;\nuniform float windAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      if (windAmp > 0.0) {
        float bend = min(position.y * position.y / 64.0, 1.0) * windAmp;
        float ph = instanceMatrix[3].x * 0.021 + instanceMatrix[3].z * 0.013;
        vec3 push = vec3(sin(windT * 1.1 - ph) + 0.35 * sin(windT * 2.7 + ph * 3.1), 0.0, 0.5 * sin(windT * 1.7 - ph * 1.3));
        transformed += (bend * push) * mat3(instanceMatrix); // world push turned back into the tree's own frame
      }
      #endif`);
  };
  return mat;
}

// Paints a part one colour; with `grade` = [y0, y1] it runs from darker at y0 to lighter at y1, so a crown has
// depth without relying on visible facets.
function painted(g, hex, grade) {
  const c = new THREE.Color(hex), p = g.attributes.position, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = grade ? 0.7 + 0.5 * THREE.MathUtils.clamp((p.getY(i) - grade[0]) / (grade[1] - grade[0]), 0, 1) : 1;
    a.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}

// A lumpy ball that keeps a plain sphere's normals: the soft shading hides the facets and the lumps break up the outline.
function blob(r, detail, cx, cy, cz, squash, seed) {
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, n = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = r * (1 + 0.15 * Math.sin(5 * x + seed) * Math.sin(4 * z + 2 * seed) + 0.09 * Math.sin(7 * y + seed));
    n.set([x, y, z], i * 3);
    p.setXYZ(i, cx + x * k, cy + y * k * squash, cz + z * k);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}

// Near shapes, about 150 and 80 triangles: a trunk under a main crown with three smaller clumps, and a cypress spindle.
function broadleafGeometry() {
  const trunk = new THREE.CylinderGeometry(0.3, 0.5, 3.2, 5, 1, true).translate(0, 1.6, 0);
  // The crown starts about 2 m up, so the trunk shows from the side and it reads as a tree, not a bush.
  const crown = mergeGeometries([
    blob(3.0, 1, 0, BROADLEAF_H - 3.0 * 0.72 * 1.09, 0, 0.72, 0.3), // 1.09: the tallest lump still ends at BROADLEAF_H
    blob(2.0, 0, 2.0, 3.7, 0.6, 0.8, 1.7),
    blob(1.9, 0, -1.7, 3.9, 1.4, 0.8, 2.9),
    blob(1.8, 0, -0.5, 3.6, -2.0, 0.8, 4.1),
  ]);
  return mergeGeometries([painted(trunk, P.timber), painted(crown, P.forest, [2.2, BROADLEAF_H])]);
}

function cypressGeometry() {
  const profile = [[0, 0.7], [0.5, 0.75], [1.0, 2.0], [1.2, 3.8], [1.0, 6.2], [0.6, 8.4], [0, CYPRESS_H]];
  const body = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 7);
  const trunk = new THREE.CylinderGeometry(0.2, 0.28, 1, 4, 1, true).translate(0, 0.5, 0);
  return mergeGeometries([painted(trunk, P.timber), painted(body, P.cypress, [0.7, CYPRESS_H])]);
}

// Far shapes, 14 and 4 triangles: beyond FAR a crown is only a few pixels wide and nobody can tell.
function farBroadleafGeometry() {
  const trunk = new THREE.CylinderGeometry(0.25, 0.4, 2, 3, 1, true).translate(0, 1, 0);
  const crown = new THREE.OctahedronGeometry(4.2, 0).scale(1, 0.7, 1).translate(0, BROADLEAF_H - 4.2 * 0.7, 0);
  return mergeGeometries([painted(trunk, P.timber), painted(crown, P.forest)]);
}

function farCypressGeometry() {
  return painted(new THREE.ConeGeometry(1.4, CYPRESS_H, 4, 1, true).translate(0, CYPRESS_H / 2, 0), P.cypress);
}

const FAR = 1.2; // metres of ground per screen pixel
const lods = []; // [mesh, near geometry, far geometry]

// Called before each frame: a wide view shows all ~15,000 trees at a few pixels each, so it gets the cheap shapes.
export function treeDetail(metresPerPixel) {
  for (const [mesh, near, far] of lods) mesh.geometry = metresPerPixel > FAR ? far : near;
}

const TILE = 800; // m: trees are grouped into square tiles, so a close view draws only the tiles it can see

// points: Float32Array of [x, y, scale, kind]; returns a Group of instanced meshes, one per kind and tile.
export function buildTrees(points, hf) {
  const n = points.length / 4, rng = mulberry32(4711);
  const kinds = [new Map(), new Map()]; // tile key -> point indices
  for (let i = 0; i < n; i++) {
    const tiles = kinds[points[i * 4 + 3] === 1 ? 1 : 0], key = `${Math.floor(points[i * 4] / TILE)},${Math.floor(points[i * 4 + 1] / TILE)}`;
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(i);
  }

  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  [[broadleafGeometry(), farBroadleafGeometry()], [cypressGeometry(), farCypressGeometry()]].forEach(([geo, far], k) => {
    const mat = swaying(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    for (const ids of kinds[k].values()) {
      const mesh = new THREE.InstancedMesh(geo, mat, ids.length);
      ids.forEach((id, j) => {
        const x = points[id * 4], y = points[id * 4 + 1], s = points[id * 4 + 2];
        pos.set(x, hf.at(x, y) - 0.3, -y);
        q.setFromAxisAngle(up, rng() * Math.PI * 2);
        sc.set(s * (0.9 + 0.2 * rng()), s, s * (0.9 + 0.2 * rng()));
        mesh.setMatrixAt(j, m.compose(pos, q, sc));
        mesh.setColorAt(j, tint.setScalar(0.8 + 0.4 * rng()).multiply(new THREE.Color(1, 0.97 + 0.06 * rng(), 1)));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      lods.push([mesh, geo, far]);
      group.add(mesh);
    }
  });
  return group;
}
