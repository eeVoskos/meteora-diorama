import * as THREE from 'three';
import { P } from './palette.js';

// Block and needles: painted ground map plus the procedural rock look (see ROCK_GLSL). Skirts keep their strata.
export const terrainMaterial = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
const skirtMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });

const U = {
  rockMask: { value: null },
  uBlock: { value: new THREE.Vector4() }, // x0, y0, width, height of the block in local metres
  ...Object.fromEntries(['rockLight', 'rockMid', 'rockOchre', 'rockStreak', 'rockCave', 'scrub', 'moss']
    .map((k) => [`c_${k}`, { value: new THREE.Color(P[k]) }])),
};

// Ground canvases from paintGround(); both map the block rectangle, north up, so UVs come from world x / y.
export function setGround({ ground, rockMask }, hf, anisotropy) {
  const map = new THREE.CanvasTexture(ground);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;
  U.rockMask.value = new THREE.CanvasTexture(rockMask);
  U.uBlock.value.set(hf.x0, hf.y0, (hf.nx - 1) * hf.step, (hf.ny - 1) * hf.step);
  terrainMaterial.map = map;
  terrainMaterial.needsUpdate = true;
}

const NOISE_GLSL = `
varying vec3 vWPos;
varying vec3 vWNrm;
uniform sampler2D rockMask;
uniform vec4 uBlock;
uniform vec3 c_rockLight, c_rockMid, c_rockOchre, c_rockStreak, c_rockCave, c_scrub, c_moss;
float hash2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return 0.5 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 17.0) + 0.2 * vnoise(p * 4.01 + 31.0); }
// Wall noise: the face is projected on the vertical planes facing x and z and blended by the normal,
// so texture runs along the face and never stretches down a cliff. f = (along the face, along height).
float wall(vec3 p, vec2 w, vec2 f, float o) {
  return w.x * fbm(vec2(p.z * f.x + o, p.y * f.y)) + w.y * fbm(vec2(p.x * f.x - o, p.y * f.y));
}
`;

const ROCK_GLSL = `
#ifdef USE_MAP
  vec2 gUv = vec2((vWPos.x - uBlock.x) / uBlock.z, (-vWPos.z - uBlock.y) / uBlock.w);
  diffuseColor.rgb *= texture2D(map, gUv).rgb;
  vec3 wn = normalize(vWNrm);
  float slope = 1.0 - wn.y;
  float mask = texture2D(rockMask, gUv).r;
  float rock = max(mask, smoothstep(0.55, 0.8, slope)); // steep ground is rock even where unmapped
  if (rock > 0.002) { // most of the block is not rock: skip the noise there, it is the costly part of this shader
  vec3 p = vWPos;
  vec2 w = pow(abs(wn.xz), vec2(3.0)) + 1e-3; w /= w.x + w.y; // sharpened: a 50/50 blend doubles every mark
  float steep = smoothstep(0.3, 0.75, slope);

  float low = vnoise(p.xz * 0.012 + vec2(p.y * 0.009, -p.y * 0.006));
  vec3 rc = mix(c_rockMid, c_rockLight, smoothstep(0.25, 0.75, low));
  rc = mix(rc, c_rockOchre, 0.4 * steep * smoothstep(0.62, 0.82, vnoise(p.xz * 0.009 + p.y * 0.017 + 50.0)));

  // Bedding, about 23 m apart and warped enough that tall faces never show ruled horizontal lines.
  float band = sin(6.2832 * (p.y + 16.0 * vnoise(p.xz * 0.02) + 7.0 * vnoise(p.xz * 0.09 + 5.0)) / 23.0);
  rc *= 1.0 - 0.08 * steep * smoothstep(0.3, 1.0, band);

  vec3 ps = p + vec3(1.0, 0.0, 1.0) * 7.0 * (vnoise(vec2(p.y * 0.035, 3.0)) - 0.5); // stains wander as they run down
  float streak = wall(ps, w, vec2(0.13, 0.007), 0.0); // broad water stains, long down the face
  rc = mix(rc, c_rockStreak, 0.5 * steep * smoothstep(0.5, 0.78, streak));

  float pock = wall(p, w, vec2(0.11, 0.13), 70.0); // tafoni: sparse soft blotches
  rc = mix(rc, c_rockCave, 0.4 * steep * smoothstep(0.66, 0.8, pock));

  float level = 1.0 - smoothstep(0.06, 0.3, slope);
  float green = mask * level * smoothstep(0.3, 0.65, fbm(p.xz * 0.04));
  rc = mix(rc, mix(c_scrub, c_moss, vnoise(p.xz * 0.11)), 0.85 * green);

  diffuseColor.rgb = mix(diffuseColor.rgb, rc, rock);
  }
#endif
`;

terrainMaterial.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, U);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + NOISE_GLSL)
    .replace('#include <map_fragment>', ROCK_GLSL);
};

const SKIRT_DEPTH = 60;
const SOIL = [6, 20]; // m below the surface where the soil and ploughed-earth bands end

export function buildTerrain(hf, needles = []) {
  const group = new THREE.Group();
  group.name = 'terrain';
  group.add(blockMesh(hf), skirtMesh(hf), ...needles.map((n) => needleMesh(hf, n)));
  return group;
}

function blockMesh(hf) {
  const { nx, ny, step, x0, y0 } = hf;
  const pos = new Float32Array(nx * ny * 3);
  for (let j = 0, k = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++, k += 3) {
      const x = x0 + i * step, y = y0 + j * step;
      pos[k] = x; pos[k + 1] = hf.at(x, y); pos[k + 2] = -y;
    }
  }
  const index = new Uint32Array((nx - 1) * (ny - 1) * 6);
  for (let j = 0, k = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      index.set([a, b, c, b, d, c], k); k += 6; // counter-clockwise from above (Z = −y)
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  if (step < 8) smoothNormals(geo, nx, ny, 2);

  const mesh = new THREE.Mesh(geo, terrainMaterial);
  mesh.name = 'block';
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// A fine grid stair-steps along cliffs and its normals flip from one step to the next, which shows as stripes
// in the lighting and in the rock marks. Averaging the normals (3 x 3 per pass) evens both out; the shape stays.
function smoothNormals(geo, nx, ny, passes) {
  const n = geo.attributes.normal.array, t = new Float32Array(n.length), row = nx * 3;
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 3, a = i > 0 ? k - 3 : k, b = i < nx - 1 ? k + 3 : k;
      for (let c = 0; c < 3; c++) t[k + c] = n[a + c] + n[k + c] + n[b + c];
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 3, a = j > 0 ? k - row : k, b = j < ny - 1 ? k + row : k;
      for (let c = 0; c < 3; c++) n[k + c] = t[a + c] + t[k + c] + t[b + c];
    }
  }
  for (let k = 0; k < n.length; k += 3) {
    const l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1;
    n[k] /= l; n[k + 1] /= l; n[k + 2] /= l;
  }
}

// Four walls from the block edge down to a flat base, plus the base. Bands follow the surface: a thin soil
// band, a ploughed-earth band, then rock down to the base.
function skirtMesh(hf) {
  const { nx, ny, step, x0, y0 } = hf;
  const x1 = x0 + (nx - 1) * step, y1 = y0 + (ny - 1) * step;
  const base = hf.min - SKIRT_DEPTH;
  const bands = P.strata.map((s) => new THREE.Color(s));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const pos = [], col = [];

  // One edge sample list per side, as local (x, y).
  const sides = [[], [], [], []];
  for (let i = 0; i < nx; i++) { sides[0].push([x0 + i * step, y0]); sides[1].push([x0 + i * step, y1]); }
  for (let j = 0; j < ny; j++) { sides[2].push([x0, y0 + j * step]); sides[3].push([x1, y0 + j * step]); }

  const tri = (a, b, c, color) => {
    // Flip the winding if the face normal (x, z of (b−a)×(c−a)) would point into the block.
    const nxv = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const nzv = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const v = nxv * (a[0] - cx) + nzv * (a[2] + cy) >= 0 ? [a, b, c] : [a, c, b];
    for (const p of v) { pos.push(...p); color.toArray(col, col.length); }
  };

  for (const side of sides) {
    for (let s = 0; s < side.length - 1; s++) {
      const [ax, ay] = side[s], [bx, by] = side[s + 1];
      const ta = hf.at(ax, ay), tb = hf.at(bx, by);
      // Levels from top to base; each band is a quad between two levels.
      const la = [ta, ta - SOIL[0], ta - SOIL[1], base];
      const lb = [tb, tb - SOIL[0], tb - SOIL[1], base];
      for (let k = 0; k < 3; k++) {
        if (la[k] - la[k + 1] <= 0 && lb[k] - lb[k + 1] <= 0) continue;
        const A = [ax, la[k], -ay], B = [bx, lb[k], -by], C = [bx, lb[k + 1], -by], D = [ax, la[k + 1], -ay];
        tri(A, B, C, bands[k]);
        tri(A, C, D, bands[k]);
      }
    }
  }
  // Flat base facing down.
  const b = bands[2];
  const c00 = [x0, base, -y0], c10 = [x1, base, -y0], c11 = [x1, base, -y1], c01 = [x0, base, -y1];
  for (const p of [c00, c11, c10, c00, c01, c11]) { pos.push(...p); b.toArray(col, col.length); }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, skirtMaterial);
  mesh.name = 'skirts';
  mesh.receiveShadow = true;
  return mesh;
}

// Tapered four-sided column from the ground up to `top`, w × d at the base.
function needleMesh(hf, n) {
  // Start 1 m below the lowest ground under the footprint (corners and edge midpoints) so no side floats.
  let low = Infinity;
  for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) if (i || j) low = Math.min(low, hf.at(n.x + i * n.w / 2, n.y + j * n.d / 2));
  const ground = low - 1;
  const height = n.top - ground;
  const geo = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.6, Math.SQRT1_2, height, 4, 1);
  geo.rotateY(Math.PI / 4);
  geo.scale(n.w, 1, n.d);
  geo.translate(n.x, ground + height / 2, -n.y);
  const mesh = new THREE.Mesh(geo, terrainMaterial);
  mesh.name = `needle:${n.name}`;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
