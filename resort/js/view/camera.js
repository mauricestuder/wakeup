// Idle Lift: the camera. It orbits a point on the ground.
// The player only moves it and zooms: it never turns or tilts by hand.
// Mouse: drag (any button) moves, wheel zooms. Keys: WASD / arrows move, + - zoom.
// Touch: one finger moves, two fingers pinch to zoom (and move together to move).
import * as THREE from '../../../game/vendor/three.module.min.js';
import { clamp } from '../terrain.js';

export function createCamera(camera, canvas, hooks) {
  let ter = null;
  const goal = { x: 48, z: 70, yaw: 0, pitch: 0.75, dist: 90 };
  const now = { ...goal, y: 0 };
  const target = new THREE.Vector3();
  const keys = new Set();
  const pointers = new Map();
  let drag = null, pinch = null;
  // How fast the camera follows its goal: direct while the player steers, a soft glide when the game moves it.
  const DIRECT = 14, GLIDE = 3.4;
  let ease = DIRECT;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

  const limit = () => {
    const N = ter ? ter.N : 96;
    // The invisible wall: the camera stays over the resort, never too far out and never
    // too flat, so the far end of the land is always lost in the haze.
    goal.x = clamp(goal.x, 8, N - 8); goal.z = clamp(goal.z, 10, N + 7);
    goal.pitch = clamp(goal.pitch, 0.42, 1.45);
    goal.dist = clamp(goal.dist, 9, 150);
  };

  // Move the target along the ground, relative to where the camera looks.
  function pan(dx, dy) {
    const k = now.dist * 0.0016 * (camera.fov / 42);
    const s = Math.sin(now.yaw), c = Math.cos(now.yaw);
    goal.x -= (dx * c + dy * s / Math.max(0.45, Math.sin(now.pitch))) * k;
    goal.z -= (-dx * s + dy * c / Math.max(0.45, Math.sin(now.pitch))) * k;
    limit();
  }

  // Where a screen point hits the mountain. Walks along the ray until it goes under the ground.
  function pickGround(cx, cy) {
    if (!ter) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction, N = ter.N;
    let prev = 0, was = false;
    for (let t = 0; t < 600; t += 0.6) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      const inside = x >= 0 && z >= 0 && x <= N && z <= N;
      if (inside && y < ter.height(x, z)) {
        if (!was) return null; // came in through the side wall
        let a = prev, b = t;
        for (let i = 0; i < 12; i++) {
          const m = (a + b) / 2;
          if (o.y + d.y * m < ter.height(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m;
        }
        const px = o.x + d.x * b, pz = o.z + d.z * b;
        return { x: px, z: pz, y: ter.height(px, pz) };
      }
      was = inside; prev = t;
      if (y < -8) break;
    }
    return null;
  }

  // ---------- pointers ----------
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    ease = DIRECT;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false,
        button: e.button, id: e.pointerId };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), cy: (a.y + b.y) / 2, cx: (a.x + b.x) / 2 };
      if (drag) drag.moved = true; // a second finger means this is not a tap
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') hooks.onHover?.(e.clientX, e.clientY); return; }
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size >= 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), cy = (a.y + b.y) / 2, cx = (a.x + b.x) / 2;
      goal.dist *= pinch.d / Math.max(1, d);
      pan(cx - pinch.cx, cy - pinch.cy);
      Object.assign(pinch, { d, ang, cy, cx });
      limit();
    } else if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 9) drag.moved = true;
      if (drag.moved) {
        pan(dx, dy);
      }
      drag.x = e.clientX; drag.y = e.clientY;
    }
  });
  const up = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (drag && e.pointerId === drag.id) {
      if (!drag.moved && e.type === 'pointerup' && performance.now() - drag.t < 600 && drag.button === 0) hooks.onTap?.(e.clientX, e.clientY);
      drag = null;
    }
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) {
      const [id, p] = [...pointers.entries()][0];
      drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, t: 0, moved: true, button: 0, id };
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    ease = DIRECT;
    if (e.ctrlKey) goal.dist *= Math.exp(e.deltaY * 0.01); // trackpad pinch
    else goal.dist *= Math.exp(clamp(e.deltaY, -120, 120) * 0.0016);
    limit();
  }, { passive: false });
  addEventListener('keydown', (e) => { if (!e.target.closest?.('input, textarea')) keys.add(e.code); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  function update(dt) {
    const sp = now.dist * 0.9 * dt;
    let mx = 0, mz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (mx || mz) ease = DIRECT;
    if (mx || mz) {
      const s = Math.sin(now.yaw), c = Math.cos(now.yaw);
      goal.x += (mx * c + mz * s) * sp; goal.z += (-mx * s + mz * c) * sp;
    }
    if (keys.has('Equal') || keys.has('NumpadAdd') || keys.has('KeyR')) goal.dist *= Math.exp(-1.3 * dt);
    if (keys.has('Minus') || keys.has('NumpadSubtract') || keys.has('KeyF')) goal.dist *= Math.exp(1.3 * dt);
    limit();
    const k = 1 - Math.exp(-dt * ease);
    now.x += (goal.x - now.x) * k; now.z += (goal.z - now.z) * k;
    now.yaw += (goal.yaw - now.yaw) * k; now.pitch += (goal.pitch - now.pitch) * k;
    now.dist += (goal.dist - now.dist) * k;
    const gy = ter ? ter.height(clamp(now.x, 0, ter.N), clamp(now.z, 0, ter.N)) : 0;
    now.y += (gy - now.y) * (1 - Math.exp(-dt * Math.min(5, ease)));
    target.set(now.x, now.y, now.z);
    const cp = Math.cos(now.pitch), spt = Math.sin(now.pitch);
    camera.position.set(now.x + Math.sin(now.yaw) * cp * now.dist, now.y + spt * now.dist, now.z + Math.cos(now.yaw) * cp * now.dist);
    // Never let the camera sink into a ridge behind the target.
    if (ter) {
      camera.position.y = Math.max(camera.position.y, ter.ground(camera.position.x, camera.position.z) + 2.5);
    }
    camera.lookAt(target);
  }

  return {
    update, pickGround, target, goal, now,
    setTerrain(t) { ter = t; },
    view(x, z, dist, yaw = goal.yaw, pitch = goal.pitch, snap = false) {
      Object.assign(goal, { x, z, dist, yaw, pitch }); limit();
      ease = GLIDE;
      if (snap) Object.assign(now, goal, { y: ter ? ter.height(clamp(x, 0, ter.N), clamp(z, 0, ter.N)) : 0 });
    },
    // Fit a set of points into the part of the screen that is not covered by buttons.
    // free = shares of the screen that are covered: { left, right, top, bottom }.
    frame(pts, snap = false, free = {}) {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
      const L = free.left || 0, R = free.right || 0, U = free.top || 0, D = free.bottom || 0;
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight), pitch = 0.84;
      const tan = Math.tan(camera.fov * Math.PI / 360) * 2;
      const dist = clamp(Math.max((z1 - z0 + 5) * Math.sin(pitch) / (tan * (1 - U - D)), (x1 - x0 + 6) / (tan * aspect * (1 - L - R))) * 1.1, 22, 150);
      // Shift the target so the points sit in the middle of the free part, not of the whole screen.
      this.view((x0 + x1) / 2 + (R - L) / 2 * tan * dist * aspect, (z0 + z1) / 2 + (D - U) / 2 * tan * dist / Math.sin(pitch), dist, 0, pitch, snap);
    },
    zoom(f) { goal.dist *= f; limit(); },
    rotate(a) { goal.yaw += a; },
  };
}
