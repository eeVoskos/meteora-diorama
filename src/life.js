// Nature layer: drifting clouds, wheeling birds, cars, walkers and swaying trees, behind a "Nature" toggle in the control bar.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeBirds, birdAt, clearance, makeClouds, cloudAt } from './lifeplan.js';
import { makeTraffic, stepAgent } from './traffic.js';
import { toggle } from './controls.js';
import { treeWind } from './trees.js';

// Wingspans in metres: real ones (1–2 m) vanish from the diorama view, so these read as specks from above
// and as large birds, not monsters, from the ground.
const SMALL_SPAN = 4, SOAR_SPAN = 9;
const CLOUD_OPACITY = 0.88;
// Cars and people are drawn a little larger than life so they still read from a neighbourhood view.
const CAR_SCALE = 1.3, PERSON_SCALE = 1.8;
const CAR_COLOURS = ['#8a8d91', '#d8d6d0', '#3f4a5a', '#7a3b34', '#2f3133', '#6d7560', '#b9ac8f'];
const CLOTHES = ['#3c5a7a', '#7d3c3c', '#e2ddd0', '#4d5b3a', '#2d2d33', '#a8783f', '#6c4f7a'];
const SKIN = '#c99a78';

export function createLife({ view, hf, ui, osm }) {
  let layer = null, stop = null, t = 0;
  view.onBeforeRender((mpp) => treeWind(t, stop ? mpp : Infinity)); // trees sway only while the layer is on and zoomed in
  ui.append(toggle({ en: 'Nature', el: 'Φύση' }, (on) => {
    if (on) {
      layer ??= build(hf, osm); // built on first use, kept for the next toggle
      view.scene.add(layer.group);
      stop = view.animate((dt) => { t += dt; layer.update(t, dt); });
    } else {
      stop?.(); stop = null;
      view.scene.remove(layer.group);
      view.render();
    }
  }, { id: 'nature-toggle' }));
}

function build(hf, osm) {
  const group = new THREE.Group();
  group.name = 'nature';

  // Clouds: one merged mesh of flattened icosahedra per clump, each with its own material so it can fade at the edges.
  const clouds = makeClouds(hf).map((c) => {
    const geo = mergeGeometries(c.blobs.map(([dx, dy, dz, r]) =>
      new THREE.IcosahedronGeometry(r, 1).scale(1, 0.55, 0.85).translate(dx, dz, -dy)));
    // Self-lit a little so the shaded undersides read grey-white, not dark; fog off so the far camera keeps them white.
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#9aa4ae', flatShading: true, transparent: true, opacity: CLOUD_OPACITY, fog: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = false;
    group.add(mesh);
    return { c, mesh };
  });

  // Birds: each wing is its own instance, hinged at the body, so flapping is just a roll per instance.
  const birds = makeBirds(hf), ground = clearance(hf);
  const wing = (side) => { // unit span, swept back a little; body at the origin, +x forward
    const g = new THREE.BufferGeometry();
    const s = side;
    g.setAttribute('position', new THREE.Float32BufferAttribute([0.18, 0, 0, -0.15, 0, 0, -0.1, 0, 0.5 * s, 0.18, 0, 0, -0.1, 0, 0.5 * s, 0.02, 0, 0.42 * s], 3));
    g.computeVertexNormals();
    return g;
  };
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide }); // tinted per instance
  const wings = [1, -1].map((side) => {
    const mesh = new THREE.InstancedMesh(wing(side), mat, birds.length);
    mesh.castShadow = mesh.receiveShadow = false;
    mesh.frustumCulled = false; // instances move every frame; the base geometry's bounds say nothing about them
    birds.forEach((b, i) => mesh.setColorAt(i, new THREE.Color(b.soar ? '#6b4f36' : '#2e2d2c')));
    group.add(mesh);
    return { mesh, side };
  });

  // Cars and walkers: low-poly instances following the road graph (traffic.js). +x is forward in both models.
  const traffic = makeTraffic(osm);
  const { cars, walkers, carGraph, walkGraph } = traffic;
  const box = (w, h, d, x, y, shade) => { // w along x (length), d across; vertex colour shades the instance colour
    const g = new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, 0).toNonIndexed();
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(shade), 3));
    return g;
  };
  const carGeo = mergeGeometries([box(4.2, 0.75, 1.75, 0, 0.2, 1), box(2.2, 0.6, 1.6, -0.25, 0.95, 0.45)]).scale(CAR_SCALE, CAR_SCALE, CAR_SCALE);
  const carMesh = new THREE.InstancedMesh(carGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), cars.length);
  cars.forEach((c, i) => carMesh.setColorAt(i, new THREE.Color(CAR_COLOURS[c.r % CAR_COLOURS.length])));
  const bodyMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.27, 0.22, 1.45, 5).translate(0, 0.725, 0).scale(PERSON_SCALE, PERSON_SCALE, PERSON_SCALE),
    new THREE.MeshLambertMaterial({ flatShading: true }), walkers.length);
  walkers.forEach((w, i) => bodyMesh.setColorAt(i, new THREE.Color(CLOTHES[w.r % CLOTHES.length])));
  const headMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.17, 0).translate(0, 1.6, 0).scale(PERSON_SCALE, PERSON_SCALE, PERSON_SCALE),
    new THREE.MeshLambertMaterial({ color: SKIN, flatShading: true }), walkers.length);
  for (const mesh of [carMesh, bodyMesh, headMesh]) {
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  window.__life = traffic; // debug handle: agents' x, y are local metres

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), roll = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(1, 0, 0), SIDE = new THREE.Vector3(0, 0, 1), ONE = new THREE.Vector3(1, 1, 1);
  const HALF = 1.8 * CAR_SCALE; // m from a car's centre to its nose
  function update(t, dt = 0) {
    cars.forEach((c, i) => {
      stepAgent(carGraph, c, dt);
      const cx = Math.cos(c.h) * HALF, cy = Math.sin(c.h) * HALF;
      const zf = hf.at(c.x + cx, c.y + cy), zb = hf.at(c.x - cx, c.y - cy);
      // Pitched along the slope and lifted to the higher of centre and the two ends' midpoint, so no end sinks in.
      pos.set(c.x, Math.max(hf.at(c.x, c.y), (zf + zb) / 2) + 0.05, -c.y);
      q.setFromAxisAngle(UP, c.h).multiply(roll.setFromAxisAngle(SIDE, Math.atan2(zf - zb, 2 * HALF)));
      carMesh.setMatrixAt(i, m.compose(pos, q, ONE));
    });
    walkers.forEach((w, i) => {
      stepAgent(walkGraph, w, dt);
      pos.set(w.x, hf.at(w.x, w.y) + 0.04 * Math.abs(Math.sin(t * 7 + i)), -w.y); // a slight bob in step
      q.setFromAxisAngle(UP, w.h);
      m.compose(pos, q, ONE);
      bodyMesh.setMatrixAt(i, m);
      headMesh.setMatrixAt(i, m);
    });
    for (const mesh of [carMesh, bodyMesh, headMesh]) mesh.instanceMatrix.needsUpdate = true;

    for (const { c, mesh } of clouds) {
      const p = cloudAt(c, t, hf);
      mesh.position.set(p.x, c.z, -p.y);
      mesh.material.opacity = CLOUD_OPACITY * p.fade;
      mesh.visible = p.fade > 0;
    }
    birds.forEach((b, i) => {
      const p = birdAt(b, t, ground);
      pos.set(p.x, p.z, -p.y);
      const span = b.soar ? SOAR_SPAN : SMALL_SPAN;
      sc.set(span, span, span);
      for (const { mesh, side } of wings) {
        // Yaw to the heading (wing +x is forward, +z its right side), then roll: bank into the turn and lift this
        // wing by the flap angle (a negative roll raises the right, +z, wing).
        q.setFromAxisAngle(UP, p.heading).multiply(roll.setFromAxisAngle(FWD, p.bank - side * p.flap));
        mesh.setMatrixAt(i, m.compose(pos, q, sc));
      }
    });
    for (const { mesh } of wings) mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { group, update };
}
