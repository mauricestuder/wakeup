// The training room: grid floor, the outer walls, light, and the start layout.

import * as THREE from '../../game/vendor/three.module.min.js';
import { C, N, SIZE } from './grid.js';
import { WALL_TOP } from './collide.js';

export const SPAWN = { x: 6, y: 0, z: 14, yaw: -Math.PI / 2 };

function gridTexture(base, line, fine, sub) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = fine;
  g.lineWidth = 2;
  for (let n = 1; n < sub; n++) {
    const p = Math.round(n * 256 / sub);
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.moveTo(0, p); g.lineTo(256, p); g.stroke();
  }
  g.strokeStyle = line;
  g.lineWidth = 6;
  g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildArena(scene) {
  scene.background = new THREE.Color(0xc9d6e2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8e9aab, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(0.45, 1, 0.3);
  scene.add(sun);

  const floorTex = gridTexture('#e9eef3', '#9fb0c2', '#d3dce6', 3);
  floorTex.repeat.set(N, N);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(SIZE / 2, 0, SIZE / 2);
  scene.add(floor);

  const wallTex = gridTexture('#3d4654', '#252c37', '#353d4a', 3);
  wallTex.repeat.set(N, WALL_TOP / 3);
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const trim = new THREE.MeshLambertMaterial({ color: 0xffb23e });
  const sides = [[SIZE / 2, 0, 0], [SIZE / 2, SIZE, Math.PI], [0, SIZE / 2, Math.PI / 2], [SIZE, SIZE / 2, -Math.PI / 2]];
  for (const [x, z, rot] of sides) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, WALL_TOP), wallMat);
    w.position.set(x, WALL_TOP / 2, z);
    w.rotation.y = rot;
    scene.add(w);
    const t = new THREE.Mesh(new THREE.BoxGeometry(SIZE + 0.4, 0.25, 0.4), trim);
    t.position.set(x, WALL_TOP + 0.12, z);
    t.rotation.y = rot;
    scene.add(t);
  }
  // a darker surround so the room doesn't float in nothing
  const out = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x9aa9b9 }));
  out.rotation.x = -Math.PI / 2;
  out.position.set(SIZE / 2, -0.05, SIZE / 2);
  scene.add(out);
}

// The box the player starts in.
export function startLayout(pieces) {
  const i = 1, j = 3;
  for (const [type, a, b] of [['wx', i, j], ['wx', i + 1, j], ['wz', i, j], ['wz', i, j + 1]]) {
    pieces.add(type, a, 0, b, { owner: 'me', pop: false });
  }
}

export { C };
