// Money guns: definitions, firing, reloading, the viewmodel and gold-plating.
import * as THREE from '../vendor/three.module.min.js';
import { sfx } from './audio.js';
import { isTouch } from './touch.js';
import * as T from './textures.js';

export const WEAPONS = {
  penny:   { name: 'Penny Pistol',     kind: 'pistol',   proj: 'coin',    auto: false, dmg: 35,  rate: 0.16,  mag: 8,   reserve: 80,  reload: 1.3, spread: 0.008, color: 0xb87333 },
  bill:    { name: 'Bill Blaster',     kind: 'smg',      proj: 'bill',    auto: true,  dmg: 30,  rate: 0.08,  mag: 32,  reserve: 192, reload: 1.9, spread: 0.028, color: 0x2e7d32, cost: 1000 },
  goldbar: { name: 'Gold Bar Shotgun', kind: 'shotgun',  proj: 'bar',     auto: false, dmg: 34,  rate: 0.75,  mag: 6,   reserve: 48,  reload: 2.4, spread: 0.085, color: 0xd4af37, cost: 1500, pellets: 8 },
  assault: { name: 'Market Maker AR',  kind: 'assault',  proj: 'coin',    auto: true,  dmg: 52,  rate: 0.105, mag: 30,  reserve: 240, reload: 2.2, spread: 0.016, color: 0x37474f, cost: 2500 },
  minigun: { name: 'Coin Minigun',     kind: 'minigun',  proj: 'coin',    auto: true,  dmg: 36,  rate: 0.045, mag: 120, reserve: 360, reload: 4.0, spread: 0.05,  color: 0x8f8f8f, moveMul: 0.75 },
  diamond: { name: 'Diamond Rifle',    kind: 'rifle',    proj: 'diamond', auto: false, dmg: 380, rate: 0.85,  mag: 5,   reserve: 40,  reload: 2.6, spread: 0.0,   color: 0x80deea, pierce: 5 },
  piggy:   { name: 'Piggy Launcher',   kind: 'launcher', proj: 'piggy',   auto: false, dmg: 650, rate: 0.9,   mag: 3,   reserve: 18,  reload: 2.8, spread: 0.0,   color: 0xf48fb1, explosive: true, radius: 5.5 },
};
// What the Slot Machine can roll.
export const BOX_POOL = ['bill', 'goldbar', 'assault', 'minigun', 'diamond', 'piggy'];

const GOLD = 0xffcc33;

export function weaponName(w) { return (w.gold ? '24K ' : '') + WEAPONS[w.id].name; }

// Build a gun model. Used for the gun in your hands and for the vending machines.
export function gunModel(id, gold = false) {
  const d = WEAPONS[id];
  const body = new THREE.MeshLambertMaterial({ color: gold ? GOLD : d.color, emissive: gold ? 0x5a3c00 : 0x000000 });
  const dark = new THREE.MeshLambertMaterial({ color: gold ? 0xb8860b : 0x222428 });
  const accent = new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0x3a2a00 });
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
  };
  const B = (w, h, l) => new THREE.BoxGeometry(w, h, l);
  const C = (r, l, seg = 12) => new THREE.CylinderGeometry(r, r, l, seg);
  let muzzleZ = -0.35;
  switch (d.kind) {
    case 'pistol':
      add(B(0.07, 0.09, 0.3), body, 0, 0, -0.12);
      add(B(0.06, 0.16, 0.08), dark, 0, -0.1, -0.02, 0.25);
      add(C(0.035, 0.012), accent, 0, 0.06, -0.12, 0, 0, Math.PI / 2); // coin on top
      muzzleZ = -0.29;
      break;
    case 'smg':
      add(B(0.09, 0.12, 0.42), body, 0, 0, -0.18);
      add(B(0.06, 0.18, 0.07), dark, 0, -0.13, -0.05, 0.2);
      add(B(0.05, 0.22, 0.1), new THREE.MeshLambertMaterial({ map: T.bill() }), 0, -0.14, -0.22); // bill magazine
      add(C(0.025, 0.12), dark, 0, 0.01, -0.44, Math.PI / 2);
      muzzleZ = -0.5;
      break;
    case 'shotgun':
      add(B(0.11, 0.1, 0.55), body, 0, 0, -0.22);
      add(B(0.12, 0.06, 0.2), dark, 0, -0.07, -0.3);
      add(B(0.08, 0.15, 0.2), dark, 0, -0.08, 0.06, 0.3);
      muzzleZ = -0.5;
      break;
    case 'assault':
      add(B(0.08, 0.11, 0.56), body, 0, 0, -0.22);
      add(B(0.07, 0.1, 0.2), dark, 0, -0.02, 0.12); // stock
      add(B(0.06, 0.16, 0.07), dark, 0, -0.12, -0.04, 0.25); // grip
      add(B(0.05, 0.2, 0.12), new THREE.MeshLambertMaterial({ map: T.bill() }), 0, -0.14, -0.2, -0.15); // banknote magazine
      add(C(0.03, 0.2), dark, 0, 0.1, -0.2, Math.PI / 2); // scope
      add(C(0.025, 0.01), new THREE.MeshBasicMaterial({ color: 0x3fff7a }), 0, 0.1, -0.305, Math.PI / 2); // green lens
      add(C(0.022, 0.14), dark, 0, 0.01, -0.56, Math.PI / 2);
      muzzleZ = -0.63;
      break;
    case 'minigun':
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        add(C(0.018, 0.55, 8), body, Math.cos(a) * 0.05, Math.sin(a) * 0.05, -0.3, Math.PI / 2);
      }
      add(C(0.09, 0.2, 16), dark, 0, 0, -0.02, Math.PI / 2);
      add(B(0.12, 0.12, 0.12), accent, 0.1, -0.08, 0.02);
      muzzleZ = -0.6;
      break;
    case 'rifle':
      add(B(0.07, 0.09, 0.7), body, 0, 0, -0.28);
      add(C(0.035, 0.18), dark, 0, 0.09, -0.15, Math.PI / 2);
      add(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xb8f6ff }), 0, 0.02, -0.66);
      add(B(0.06, 0.14, 0.18), dark, 0, -0.08, 0.06, 0.3);
      muzzleZ = -0.7;
      break;
    case 'launcher': {
      add(C(0.08, 0.5, 16), body, 0, 0, -0.2, Math.PI / 2);
      add(C(0.04, 0.05, 10), new THREE.MeshLambertMaterial({ color: 0xff8fb8 }), 0, 0, -0.47, Math.PI / 2);
      add(B(0.06, 0.15, 0.08), dark, 0, -0.12, -0.05, 0.2);
      muzzleZ = -0.5;
      break;
    }
  }
  return { group: g, muzzleZ };
}

export class Arsenal {
  constructor(game) {
    this.game = game;
    this.slots = [];
    this.cur = 0;
    this.cooldown = 0;
    this.reloadT = 0;
    this.switchT = 0;
    this.kick = 0;
    this.headStreak = 0; // headshots in a row raise the headshot multiplier
    this.flashT = 0;
    this.triggerHeld = false;
    this.firedThisPress = false;

    // The viewmodel lives in its own scene, drawn after the world with a cleared
    // depth buffer, so the gun never clips into walls.
    this.vmRoot = new THREE.Group();
    game.vmCamera.add(this.vmRoot);
    this.vm = null;
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flash.visible = false;
    this.light = new THREE.PointLight(0xffd27a, 0, 8, 1.5);
    this.light.position.set(0.2, -0.1, -1);
    game.camera.add(this.light);

    this.tracers = [];
    this.droppedCoins = [];
    this.geo = {
      coin: new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12),
      bill: new THREE.PlaneGeometry(0.22, 0.11),
      bar: new THREE.BoxGeometry(0.14, 0.05, 0.07),
      diamond: new THREE.OctahedronGeometry(0.07),
    };
    this.mat = {
      coin: new THREE.MeshLambertMaterial({ color: 0xb87333, emissive: 0x3a1a05 }),
      silver: new THREE.MeshLambertMaterial({ color: 0xcfcfcf, emissive: 0x222222 }),
      gold: new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0x6a4a00 }),
      bill: new THREE.MeshLambertMaterial({ map: T.bill(), side: THREE.DoubleSide, emissive: 0x112211 }),
      diamond: new THREE.MeshBasicMaterial({ color: 0xb8f6ff }),
    };
  }

  get weapon() { return this.slots[this.cur]; }
  def(w = this.weapon) { return WEAPONS[w.id]; }
  has(id) { return this.slots.find(w => w.id === id); }
  moveMul() { return this.weapon ? (this.def().moveMul || 1) : 1; }
  maxSlots() { return this.game.state.perks.has('portfolio') ? 4 : 3; }

  stats(w) {
    const d = WEAPONS[w.id];
    const g = w.gold;
    return {
      dmg: d.dmg * (g ? 2.2 : 1),
      mag: Math.round(d.mag * (g ? 1.5 : 1)),
      reserve: Math.round(d.reserve * (g ? 1.6 : 1)),
      rate: d.rate * (g ? 0.85 : 1) * (this.game.state.perks.has('daytrader') ? 0.75 : 1),
      radius: (d.radius || 0) * (g ? 1.3 : 1),
    };
  }

  give(id, gold = false) {
    const existing = this.has(id);
    if (existing) { this.refill(existing); this.cur = this.slots.indexOf(existing); this.buildViewmodel(); return; }
    const w = { id, gold, mag: 0, reserve: 0 };
    this.refill(w);
    if (this.slots.length < this.maxSlots()) { this.slots.push(w); this.cur = this.slots.length - 1; }
    else this.slots[this.cur] = w;
    this.reloadT = 0;
    this.switchT = 0.35;
    this.buildViewmodel();
  }

  refill(w) { const s = this.stats(w); w.mag = s.mag; w.reserve = s.reserve; }
  refillAll() { this.slots.forEach(w => this.refill(w)); }

  goldPlate() {
    const w = this.weapon;
    w.gold = true;
    this.refill(w);
    this.reloadT = 0;
    this.buildViewmodel();
  }

  switchTo(i) {
    if (i < 0 || i >= this.slots.length || i === this.cur) return;
    this.cur = i;
    this.reloadT = 0;
    this.switchT = 0.35;
    this.buildViewmodel();
  }
  cycle() { if (this.slots.length > 1) this.switchTo((this.cur + 1) % this.slots.length); }

  startReload() {
    const w = this.weapon;
    if (!w || this.reloadT > 0 || w.reserve <= 0 || w.mag >= this.stats(w).mag) return;
    const fast = this.game.state.perks.has('fastcash');
    this.reloadT = WEAPONS[w.id].reload * (fast ? 0.5 : 1);
    this.reloadTotal = this.reloadT;
    sfx.reload();
  }

  setTrigger(down) {
    this.triggerHeld = down;
    // Remember a press briefly, so a tap shorter than one frame still fires.
    if (down) this.tapT = 0.15;
    if (!down) this.firedThisPress = false;
  }

  update(dt) {
    const w = this.weapon;
    this.cooldown -= dt;
    this.switchT = Math.max(0, this.switchT - dt);
    this.kick = Math.max(0, this.kick - dt * 6);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = this.stats(w).mag - w.mag;
        const take = Math.min(need, w.reserve);
        w.mag += take; w.reserve -= take;
      }
    }
    this.tapT = Math.max(0, (this.tapT || 0) - dt);
    if ((this.triggerHeld || this.tapT > 0) && w) {
      const d = this.def();
      if ((d.auto || !this.firedThisPress) && this.cooldown <= 0 && this.reloadT <= 0 && this.switchT <= 0) {
        if (w.mag > 0) this.fire();
        else { if (!this.firedThisPress) sfx.empty(); this.startReload(); }
        this.firedThisPress = this.triggerHeld;
        this.tapT = 0;
      }
    }

    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
    this.light.intensity = this.flashT > 0 ? 6 : 0;

    this.animateViewmodel(dt);
    this.updateTracers(dt);
  }

  fire() {
    const game = this.game;
    const w = this.weapon;
    const d = this.def();
    const s = this.stats(w);
    w.mag--;
    this.cooldown = s.rate;
    this.kick = Math.min(1, this.kick + (d.kind === 'shotgun' || d.kind === 'rifle' || d.kind === 'launcher' ? 1 : 0.35));
    this.flashT = 0.045;
    this.flash.rotation.z = Math.random() * Math.PI;
    sfx.shoot(d.kind, w.gold);
    // Aim climbs with each shot, except on touch screens where it's hard to pull back down.
    if (!isTouch) game.player.pitch = Math.min(1.5, game.player.pitch + (d.kind === 'shotgun' ? 0.03 : d.kind === 'rifle' ? 0.04 : 0.006));

    const cam = game.camera;
    const origin = cam.getWorldPosition(new THREE.Vector3());
    cam.updateMatrixWorld();
    const muzzle = this.flash.getWorldPosition(new THREE.Vector3()).applyMatrix4(cam.matrixWorld);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);

    if (d.explosive) {
      game.items.launchPiggy(muzzle, fwd, s.dmg, s.radius, w.gold);
      if (w.mag === 0) this.startReload();
      return;
    }

    // Headshots do 2x, +0.5x for every headshot in a row, up to 4x. A body shot or a miss resets it.
    const headMul = Math.min(4, 2 + 0.5 * this.headStreak);
    let headHit = false;
    const spreadMul = game.aiming ? 0.35 : game.player.moving ? 1.4 : 1;
    const pellets = d.pellets || 1;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    for (let p = 0; p < pellets; p++) {
      const dir = fwd.clone();
      const sp = d.spread * spreadMul;
      if (sp > 0) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sp;
        dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      }
      const wallDist = game.world.raycast(origin, dir, 120);
      game.items.shootSecrets(origin, dir, wallDist);
      const hits = game.enemies.raycast(origin, dir, wallDist);
      let endDist = wallDist;
      const pierce = d.pierce || 1;
      for (let i = 0; i < Math.min(pierce, hits.length); i++) {
        game.enemies.damage(hits[i].enemy, s.dmg, hits[i].head, hits[i].point, false, headMul);
        if (hits[i].head) headHit = true;
        if (i === Math.min(pierce, hits.length) - 1 && pierce === 1) endDist = hits[i].dist;
      }
      const end = origin.clone().addScaledVector(dir, endDist);
      this.spawnTracer(d.proj, muzzle, end, w.gold, endDist === wallDist && endDist < 120);
    }
    if (headHit) { game.hud.headshot(headMul); this.headStreak++; } else this.headStreak = 0;
    if (w.mag === 0) this.startReload();
  }

  spawnTracer(proj, from, to, gold, dropCoin) {
    const geo = this.geo[proj] || this.geo.coin;
    let mat = proj === 'bill' ? this.mat.bill : proj === 'diamond' ? this.mat.diamond : proj === 'bar' ? this.mat.gold : this.mat.coin;
    if (gold && proj !== 'bill') mat = this.mat.gold;
    if (proj === 'coin' && this.def().kind === 'minigun' && !gold) mat = this.mat.silver;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    this.game.scene.add(mesh);
    const dist = from.distanceTo(to);
    this.tracers.push({ mesh, from: from.clone(), to: to.clone(), t: 0, dur: Math.max(0.03, dist / 90), drop: dropCoin && proj !== 'diamond' });
  }

  updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t += dt;
      const k = Math.min(1, tr.t / tr.dur);
      tr.mesh.position.lerpVectors(tr.from, tr.to, k);
      tr.mesh.rotation.x += dt * 30;
      tr.mesh.rotation.y += dt * 20;
      if (k >= 1) {
        this.tracers.splice(i, 1);
        if (tr.drop && this.droppedCoins.length < 50 && Math.random() < 0.6) {
          // Spent money falls to the floor and stays for a while.
          const dir = tr.to.clone().sub(tr.from).normalize();
          tr.mesh.position.addScaledVector(dir, -0.08);
          this.droppedCoins.push({ mesh: tr.mesh, vy: 0, vx: -dir.x * 1.5, vz: -dir.z * 1.5, life: 8 });
        } else {
          this.game.scene.remove(tr.mesh);
        }
      }
    }
    for (let i = this.droppedCoins.length - 1; i >= 0; i--) {
      const c = this.droppedCoins[i];
      c.life -= dt;
      const m = c.mesh;
      if (m.position.y > 0.02) {
        c.vy -= 18 * dt;
        m.position.x += c.vx * dt; m.position.z += c.vz * dt;
        m.position.y = Math.max(0.01, m.position.y + c.vy * dt);
        m.rotation.x += dt * 10;
        if (m.position.y <= 0.01) { m.rotation.set(0, Math.random() * 6, 0); if (m.geometry === this.geo.bill) m.rotation.x = -Math.PI / 2; }
      }
      if (c.life <= 0) { this.game.scene.remove(m); this.droppedCoins.splice(i, 1); }
    }
  }

  // ---------- viewmodel ----------
  buildViewmodel() {
    if (this.vm) this.vmRoot.remove(this.vm);
    const w = this.weapon;
    const { group: g, muzzleZ } = gunModel(w.id, w.gold);
    this.flash.position.set(0, 0.01, muzzleZ - 0.06);
    g.add(this.flash);
    g.scale.setScalar(0.6);
    this.vm = g;
    this.vmRoot.add(g);
  }

  animateViewmodel(dt) {
    if (!this.vm) return;
    const p = this.game.player;
    const aim = this.game.aiming;
    const base = aim ? new THREE.Vector3(0, -0.09, -0.3) : new THREE.Vector3(0.17, -0.16, -0.36);
    const bob = p.moving ? Math.sin(p.bob) * (aim ? 0.003 : 0.012) : 0;
    const bobX = p.moving ? Math.cos(p.bob * 0.5) * (aim ? 0.002 : 0.012) : 0;
    this.vmRoot.position.lerp(new THREE.Vector3(base.x + bobX, base.y + bob, base.z + this.kick * 0.08), Math.min(1, dt * 18));
    let rx = this.kick * 0.25;
    if (this.reloadT > 0) {
      const k = 1 - this.reloadT / this.reloadTotal;
      rx -= Math.sin(k * Math.PI) * 0.9;
    }
    if (this.switchT > 0) rx -= this.switchT * 3;
    if (p.sprinting) rx -= 0.4;
    this.vmRoot.rotation.x += (rx - this.vmRoot.rotation.x) * Math.min(1, dt * 20);
    if (this.def().kind === 'minigun' && this.triggerHeld) this.vm.children.forEach((c, i) => { if (i < 6) {
      const a = performance.now() / 40 + i * Math.PI / 3;
      c.position.x = Math.cos(a) * 0.05; c.position.y = Math.sin(a) * 0.05;
    } });
  }
}
