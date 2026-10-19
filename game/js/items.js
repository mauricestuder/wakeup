// Grenades, piggy rockets, explosions, particles, power-ups and every buyable
// thing on the map (wall-buys, doors, Investments, Slot Machine, Gold Plater).
import * as THREE from '../vendor/three.module.min.js';
import { sfx } from './audio.js';
import * as T from './textures.js';
import { WEAPONS, BOX_POOL, weaponName } from './weapons.js';

const POWERUPS = {
  maxammo: { name: 'MAX AMMO',     color: '#2e7d32', short: 'AMMO' },
  double:  { name: 'DOUBLE CASH',  color: '#d4af37', short: '2X $' },
  insta:   { name: 'INSTA-KILL',   color: '#b71c1c', short: 'INSTA' },
  crash:   { name: 'MARKET CRASH', color: '#4a148c', short: 'CRASH' },
};

export const PERKS = {
  insurance: { name: 'Health Insurance', cost: 2500, desc: 'Take way more hits', color: 0xc62828 },
  fastcash:  { name: 'Fast Cash',        cost: 3000, desc: 'Reload twice as fast', color: 0x2e7d32 },
  interest:  { name: 'Compound Interest', cost: 2000, desc: '+50% cash from every hit', color: 0x1565c0 },
};

export class Items {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.particles = [];
    this.powerups = [];
    this.effects = [];
    this.interactables = [];
    this.geo = {
      bag: new THREE.SphereGeometry(0.16, 12, 10),
      knot: new THREE.CylinderGeometry(0.04, 0.07, 0.1, 8),
      coin: new THREE.CylinderGeometry(0.06, 0.06, 0.015, 10),
      bill: new THREE.PlaneGeometry(0.24, 0.12),
      spark: new THREE.BoxGeometry(0.05, 0.05, 0.05),
      boom: new THREE.SphereGeometry(1, 20, 14),
    };
    this.mat = {
      bag: new THREE.MeshLambertMaterial({ color: 0x8d6e4a }),
      coin: new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0x5a3c00 }),
      bill: new THREE.MeshLambertMaterial({ map: T.bill(), side: THREE.DoubleSide }),
      spark: new THREE.MeshBasicMaterial({ color: 0xfff08a }),
      pig: new THREE.MeshLambertMaterial({ color: 0xf48fb1, emissive: 0x301018 }),
      goldPig: new THREE.MeshLambertMaterial({ color: 0xffcc33, emissive: 0x5a3c00 }),
    };
    this.boomLight = new THREE.PointLight(0xffaa44, 0, 20, 1.2);
    game.scene.add(this.boomLight);
    this.powerupTex = {};
    for (const [k, p] of Object.entries(POWERUPS)) {
      this.powerupTex[k] = T.tex(128, 128, (g, w, h) => {
        g.fillStyle = p.color; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff6c8'; g.lineWidth = 6; g.stroke();
        g.fillStyle = '#fff6c8'; g.font = 'bold 30px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(p.short, 64, 66);
      });
    }
  }

  // ---------- grenades & rockets ----------
  throwGrenade() {
    const { state, camera } = this.game;
    if (state.grenades <= 0 || this.grenadeCd > 0) return;
    state.grenades--;
    this.grenadeCd = 0.6;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.geo.bag, this.mat.bag));
    const k = new THREE.Mesh(this.geo.knot, this.mat.bag); k.position.y = 0.17; g.add(k);
    const dollar = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), this.game.enemies.shared.dollar);
    dollar.position.z = 0.165; g.add(dollar);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    g.position.copy(camera.position).addScaledVector(fwd, 0.5);
    this.game.scene.add(g);
    const vel = fwd.multiplyScalar(15).add(new THREE.Vector3(0, 3.5, 0));
    this.projectiles.push({ kind: 'grenade', mesh: g, vel, fuse: 1.8, r: 0.16 });
    sfx.reload();
  }

  launchPiggy(pos, dir, dmg, radius, gold) {
    const g = new THREE.Group();
    const m = gold ? this.mat.goldPig : this.mat.pig;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), m); body.scale.set(1, 0.9, 1.25); g.add(body);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 10), m); snout.rotation.x = Math.PI / 2; snout.position.z = -0.23; g.add(snout);
    for (const x of [-0.08, 0.08]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), m); ear.position.set(x, 0.17, -0.08); g.add(ear); }
    g.position.copy(pos);
    g.lookAt(pos.clone().sub(dir));
    this.game.scene.add(g);
    this.projectiles.push({ kind: 'piggy', mesh: g, vel: dir.clone().multiplyScalar(32), dmg, radius, r: 0.2, life: 4 });
  }

  updateProjectiles(dt) {
    const { world, enemies } = this.game;
    this.grenadeCd = Math.max(0, (this.grenadeCd || 0) - dt);
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const m = p.mesh;
      if (p.kind === 'grenade') {
        p.vel.y -= 20 * dt;
        p.fuse -= dt;
        // Axis by axis so it bounces off walls and the floor.
        for (const ax of ['x', 'y', 'z']) {
          const prev = m.position[ax];
          m.position[ax] += p.vel[ax] * dt;
          if (world.pointBlocked(m.position)) {
            m.position[ax] = prev;
            p.vel[ax] *= -0.4;
            if (ax === 'y') { p.vel.x *= 0.6; p.vel.z *= 0.6; }
          }
        }
        m.rotation.x += p.vel.length() * dt * 2;
        if (p.fuse <= 0) {
          this.explode(m.position.clone(), 5.5, 320);
          this.game.scene.remove(m);
          this.projectiles.splice(i, 1);
        }
      } else {
        p.vel.y -= 3 * dt;
        p.life -= dt;
        m.position.addScaledVector(p.vel, dt);
        m.lookAt(m.position.clone().sub(p.vel));
        let hit = world.pointBlocked(m.position) || p.life <= 0;
        if (!hit) {
          for (const e of enemies.list) {
            if (e.state === 'dying') continue;
            const s = e.def.scale;
            if (Math.hypot(e.pos.x - m.position.x, e.pos.z - m.position.z) < 0.55 * s && m.position.y < e.pos.y + 2.1 * s) { hit = true; break; }
          }
        }
        if (Math.random() < 0.5) this.burst(m.position.clone(), 1, 'coin', 0.5);
        if (hit) {
          this.explode(m.position.clone(), p.radius, p.dmg);
          this.game.scene.remove(m);
          this.projectiles.splice(i, 1);
        }
      }
    }
  }

  explode(pos, radius, dmg) {
    const game = this.game;
    sfx.explosion();
    for (const e of game.enemies.list) {
      if (e.state === 'dying') continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.y + 1 - pos.y, e.pos.z - pos.z);
      if (d < radius) game.enemies.damage(e, dmg * (1 - (d / radius) * 0.5), false, null, true);
    }
    const pd = game.player.pos.distanceTo(pos);
    if (pd < radius * 2) game.player.shake = Math.min(1.2, game.player.shake + (1 - pd / (radius * 2)) * 1.2);

    const boom = new THREE.Mesh(this.geo.boom, new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    boom.position.copy(pos);
    boom.scale.setScalar(0.3);
    game.scene.add(boom);
    // One shared light for all explosions: adding lights at runtime forces shader recompiles.
    const light = this.boomLight;
    light.position.copy(pos);
    light.distance = radius * 4;
    this.effects.push({ t: 0, update: (t) => {
      boom.scale.setScalar(0.3 + t * radius * 2.2);
      boom.material.opacity = Math.max(0, 0.85 - t * 2.4);
      light.intensity = Math.max(0, 60 - t * 200);
      if (t > 0.4) { game.scene.remove(boom); light.intensity = 0; return true; }
      return false;
    } });
    this.burst(pos, 30, 'money', 2);
  }

  // ---------- particles ----------
  burst(pos, n, kind, power = 1) {
    for (let k = 0; k < n; k++) {
      if (this.particles.length > 260) break;
      let type = kind;
      if (kind === 'money') type = Math.random() < 0.5 ? 'coin' : 'bill';
      const mesh = new THREE.Mesh(this.geo[type], this.mat[type]);
      mesh.position.copy(pos);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.game.scene.add(mesh);
      const sp = (type === 'spark' ? 3 : 4) * power;
      this.particles.push({
        mesh, type,
        vel: new THREE.Vector3((Math.random() - 0.5) * sp, Math.random() * sp * 0.9 + 1, (Math.random() - 0.5) * sp),
        life: type === 'spark' ? 0.3 : 1.5 + Math.random(),
        drag: type === 'bill' ? 2.5 : 0.3,
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= (p.type === 'bill' ? 4 : 14) * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.02) { p.mesh.position.y = 0.02; p.vel.set(0, 0, 0); }
      else { p.mesh.rotation.x += dt * 8; p.mesh.rotation.z += dt * 5; }
      if (p.life <= 0) { this.game.scene.remove(p.mesh); this.particles.splice(i, 1); }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      if (e.update(e.t, dt)) this.effects.splice(i, 1);
    }
  }

  // ---------- power-ups ----------
  dropPowerup(pos, type) {
    if (!type) {
      const keys = Object.keys(POWERUPS);
      type = keys[Math.floor(Math.random() * keys.length)];
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.powerupTex[type], depthWrite: false }));
    sprite.scale.set(0.9, 0.9, 1);
    sprite.position.set(pos.x, 1, pos.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, 0.04, pos.z);
    this.game.scene.add(sprite, ring);
    this.powerups.push({ type, sprite, ring, life: 26, t: 0 });
  }

  updatePowerups(dt) {
    const { player, state, hud } = this.game;
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.t += dt; p.life -= dt;
      p.sprite.position.y = 1 + Math.sin(p.t * 3) * 0.15;
      p.ring.rotation.z += dt;
      const blink = p.life < 6 && Math.floor(p.t * 6) % 2 === 0;
      p.sprite.visible = !blink;
      const near = Math.hypot(player.pos.x - p.sprite.position.x, player.pos.z - p.sprite.position.z) < 1.4;
      if (near || p.life <= 0) {
        this.game.scene.remove(p.sprite, p.ring);
        this.powerups.splice(i, 1);
        if (!near) continue;
        sfx.powerup();
        hud.announce(POWERUPS[p.type].name, '', 2, true);
        if (p.type === 'maxammo') { this.game.arsenal.refillAll(); state.grenades = 4; }
        if (p.type === 'double') state.doubleT = 30;
        if (p.type === 'insta') state.instaT = 30;
        if (p.type === 'crash') { this.game.enemies.killAll(); this.game.addCash(400); sfx.explosion(0.4); }
      }
    }
    state.doubleT = Math.max(0, state.doubleT - dt);
    state.instaT = Math.max(0, state.instaT - dt);
  }

  // ---------- buyables ----------
  addInteractable(x, z, radius, text, use) {
    this.interactables.push({ x, z, radius, text, use });
  }

  nearest() {
    const p = this.game.player.pos;
    let best = null, bestD = Infinity;
    for (const it of this.interactables) {
      const d = Math.hypot(p.x - it.x, p.z - it.z);
      if (d < it.radius && d < bestD) {
        const text = it.text();
        if (text) { best = { it, text }; bestD = d; }
      }
    }
    return best;
  }

  buildBuyables() {
    const game = this.game;
    const { world, scene, arsenal, state } = game;
    const buy = (cost) => {
      if (state.cash < cost) { sfx.denied(); game.hud.toast('Not enough cash'); return false; }
      state.cash -= cost; sfx.kaching(); game.hud.setCash(state.cash);
      return true;
    };

    // Wall-buys: chalk outline on the wall.
    const wallBuy = (id, cost, x, z, ry, ix, iz, label, kind) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2),
        new THREE.MeshBasicMaterial({ map: T.wallBuyTex(label, cost, kind), transparent: true }));
      m.position.set(x, 1.7, z); m.rotation.y = ry;
      scene.add(m);
      this.addInteractable(ix, iz, 1.8, () => {
        if (id === 'grenade') return state.grenades >= 4 ? null : `Press E to buy Money Bags [$${cost}]`;
        const own = arsenal.has(id);
        if (own) return `Press E to buy ammo for ${weaponName(own)} [$${own.gold ? 2500 : cost / 2}]`;
        return `Press E to buy ${WEAPONS[id].name} [$${cost}]`;
      }, () => {
        if (id === 'grenade') { if (state.grenades < 4 && buy(cost)) state.grenades = 4; return; }
        const own = arsenal.has(id);
        const price = own ? (own.gold ? 2500 : cost / 2) : cost;
        if (buy(price)) arsenal.give(id, own ? own.gold : false);
      });
    };
    wallBuy('penny', 500, 5, 9.68, Math.PI, 5, 9, 'Penny Pistol', 'pistol');
    wallBuy('bill', 1000, 14.68, 2, -Math.PI / 2, 14, 2, 'Bill Blaster', 'smg');
    wallBuy('grenade', 250, -5, -9.68, 0, -5, -9, 'Money Bags', 'grenade');
    wallBuy('goldbar', 1500, -14.68, -22, Math.PI / 2, -14, -22, 'Gold Bar Shotgun', 'shotgun');

    // Doors
    for (const door of world.doors) {
      this.addInteractable(door.x, door.z, 2.6, () => door.opened ? null : `Press E to open ${door.name} [$${door.cost}]`, () => {
        if (!door.opened && buy(door.cost)) {
          door.open(); sfx.door();
          game.hud.toast(door.name + ' unlocked');
        }
      });
    }

    // Machines face into the room; `ry` rotates their front (+z) towards the player.
    const machine = (x, z, ry, w, h, d, color, signText, signColor) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
      body.position.y = h / 2; g.add(body);
      const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 0.5),
        new THREE.MeshBasicMaterial({ map: T.labelTex(signText, { w: 512, h: 128, bg: '#0b0b0b', fg: signColor, font: 'bold 54px Impact, sans-serif', border: signColor }) }));
      signMesh.position.set(0, h - 0.35, d / 2 + 0.01); g.add(signMesh);
      g.position.set(x, 0, z); g.rotation.y = ry;
      scene.add(g);
      const swap = Math.abs(Math.sin(ry)) > 0.5;
      const hw = (swap ? d : w) / 2, hd = (swap ? w : d) / 2;
      world.colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, minY: 0, maxY: h, active: true });
      return g;
    };
    const front = (x, z, ry, dist) => [x + Math.sin(ry) * dist, z + Math.cos(ry) * dist];

    // Investments (perks)
    const perk = (id, x, z, ry) => {
      const p = PERKS[id];
      const g = machine(x, z, ry, 1.2, 2.4, 0.9, p.color, p.name.toUpperCase(), '#fff6c8');
      const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), this.game.enemies.shared.dollar);
      icon.position.set(0, 1.3, 0.46); g.add(icon);
      const [ix, iz] = front(x, z, ry, 1.2);
      this.addInteractable(ix, iz, 1.6, () => state.perks.has(id) ? null : `Press E for ${p.name} [$${p.cost}] – ${p.desc}`, () => {
        if (state.perks.has(id) || !buy(p.cost)) return;
        state.perks.add(id);
        if (id === 'insurance') { game.player.maxHp = 250; game.player.hp = 250; }
        game.hud.announce(p.name.toUpperCase(), p.desc, 2);
        game.hud.setPerks([...state.perks].map(k => PERKS[k]));
      });
    };
    perk('insurance', -2, 9.2, Math.PI);
    perk('fastcash', 14.3, -15, -Math.PI / 2);
    perk('interest', -14.3, -32, Math.PI / 2);

    // Slot Machine (the mystery box)
    {
      const x = 0, z = -39.2, ry = 0;
      const g = machine(x, z, ry, 1.8, 2.6, 1, 0x6a1b9a, 'SLOT MACHINE', '#ffd34d');
      const reelCanvas = T.makeCanvas(512, 160, () => {});
      const reelTex = T.canvasTex(reelCanvas);
      const reel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.47), new THREE.MeshBasicMaterial({ map: reelTex }));
      reel.position.set(0, 1.5, 0.51); g.add(reel);
      const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), new THREE.MeshLambertMaterial({ color: 0xcccccc }));
      lever.position.set(1.0, 1.6, 0); g.add(lever);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd32f2f }));
      knob.position.set(1.0, 2.0, 0); g.add(knob);
      const drawReel = (text, sub) => {
        const c = reelCanvas.getContext('2d');
        c.fillStyle = '#120a1a'; c.fillRect(0, 0, 512, 160);
        c.strokeStyle = '#ffd34d'; c.lineWidth = 6; c.strokeRect(4, 4, 504, 152);
        c.fillStyle = '#ffd34d'; c.font = 'bold 54px Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(text, 256, sub ? 62 : 80);
        if (sub) { c.font = 'bold 30px Impact, sans-serif'; c.fillStyle = '#fff6c8'; c.fillText(sub, 256, 120); }
        reelTex.needsUpdate = true;
      };
      drawReel('$ $ $', '$950 A SPIN');
      const slot = { state: 'idle', t: 0, result: null, tick: 0 };
      this.slot = slot;
      const COST = 950;
      this.addInteractable(x, z + 1.6, 1.8, () => {
        if (slot.state === 'idle') return `Press E to spin the Slot Machine [$${COST}]`;
        if (slot.state === 'ready') return `Press E to take ${WEAPONS[slot.result].name}`;
        return null;
      }, () => {
        if (slot.state === 'idle' && buy(COST)) {
          slot.state = 'spinning'; slot.t = 0; sfx.spin();
          const pool = BOX_POOL.filter(id => !arsenal.has(id));
          slot.result = pool[Math.floor(Math.random() * pool.length)] || 'minigun';
        } else if (slot.state === 'ready') {
          arsenal.give(slot.result);
          slot.state = 'idle'; drawReel('$ $ $', '$950 A SPIN');
        }
      });
      this.effects.push({ t: 0, update: (t, dt) => {
        if (slot.state === 'spinning') {
          slot.t += dt;
          lever.position.y = 1.6 - Math.min(0.3, slot.t);
          knob.position.y = 2.0 - Math.min(0.3, slot.t);
          slot.tick -= dt;
          if (slot.tick <= 0) {
            slot.tick = 0.06 + slot.t * 0.04;
            drawReel(WEAPONS[BOX_POOL[Math.floor(Math.random() * BOX_POOL.length)]].name.toUpperCase());
          }
          if (slot.t > 2.6) {
            slot.state = 'ready'; slot.t = 0; sfx.kaching(0.15);
            drawReel(WEAPONS[slot.result].name.toUpperCase(), 'JACKPOT!');
            lever.position.y = 1.6; knob.position.y = 2.0;
          }
        } else if (slot.state === 'ready') {
          slot.t += dt;
          if (slot.t > 9) { slot.state = 'idle'; drawReel('$ $ $', '$950 A SPIN'); }
        }
        return false;
      } });
    }

    // Gold Plater (pack-a-punch)
    {
      const x = 29.1, z = -27, ry = -Math.PI / 2;
      const g = machine(x, z, ry, 2.2, 2.8, 1.4, 0x2b2410, 'GOLD PLATER', '#ffd34d');
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.1), new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0x8a6400 }));
      panel.position.set(0, 1.3, 0.7); g.add(panel);
      const COST = 5000;
      const [ix, iz] = front(x, z, ry, 1.6);
      this.addInteractable(ix, iz, 1.9, () => {
        const w = arsenal.weapon;
        if (!w || w.gold) return null;
        return `Press E to gold-plate ${WEAPONS[w.id].name} [$${COST}]`;
      }, () => {
        const w = arsenal.weapon;
        if (!w || w.gold || !buy(COST)) return;
        arsenal.goldPlate(); sfx.plate();
        game.hud.announce('24K ' + WEAPONS[w.id].name.toUpperCase(), 'Double damage. More ammo.', 2.5);
        this.burst(new THREE.Vector3(x - 0.9, 1.4, z), 25, 'coin', 1.2);
      });
    }
  }

  update(dt) {
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updatePowerups(dt);
  }
}
