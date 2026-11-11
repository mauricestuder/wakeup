// Everything drawn over the 3D view: crosshair, slots, ammo, hit feedback.

import * as THREE from '../../game/vendor/three.module.min.js';
import { label } from './input.js';
import { GUNS } from './weapons.js';

const $ = (id) => document.getElementById(id);

const ICON = {
  brk: '<path d="M2 9h17l3 2v2H9l-1 3H5l1-3H2z"/>',
  rng: '<path d="M1 9h14V7h3v2h5v2h-6v1h-4l-1 4h-3l1-4H1z"/>',
  hrn: '<path d="M4 8h13v3h-4v5h-3v-5H7l-1 3H4z"/>',
  wall: '<path d="M3 4h18v16H3z M9 4v16 M15 4v16 M3 9.3h18 M3 14.6h18" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  floor: '<path d="M2 15 8 9h14l-6 6z M12 9l-6 6 M15 12H5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  ramp: '<path d="M2 19 22 19 22 6z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  roof: '<path d="M2 18 12 6l10 12z M12 6v12" fill="none" stroke="currentColor" stroke-width="1.6"/>',
};
const SLOTS = [
  ['gun1', 'brk', 'Breaker'], ['gun2', 'rng', 'Ranger'], ['gun3', 'hrn', 'Hornet'],
  ['wall', 'wall', 'Wall'], ['floor', 'floor', 'Floor'], ['ramp', 'ramp', 'Ramp'], ['roof', 'roof', 'Roof'],
];

export class Hud {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.v = new THREE.Vector3();
    this.cross = $('cross');
    this.hitEl = $('hitmark');
    this.ammoEl = $('ammoNow');
    this.ammoSub = $('ammoSub');
    this.gunName = $('gunName');
    this.tip = $('tip');
    this.toastEl = $('toast');
    this.numsEl = $('nums');
    this.barsEl = $('bars');
    this.statsEl = $('stats');
    this.hintsEl = $('hints');
    this.slotEls = {};
    const bar = $('slots');
    for (const [action, icon, name] of SLOTS) {
      const d = document.createElement('div');
      d.className = 'slot' + (icon.length === 3 ? ' gun' : '');
      d.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">${ICON[icon]}</svg><b></b><i>${name}</i>`;
      bar.append(d);
      if (action === 'wall') d.classList.add('gap');
      this.slotEls[action] = d;
    }
    this.cache = {};
    this.hitT = 0;
    this.toastT = 0;
    this.nums = [];
    this.bars = [];
    this.keys();
  }

  set(el, key, text) {
    if (this.cache[key] === text) return;
    this.cache[key] = text;
    el.textContent = text;
  }

  // Key labels on the slots and in the hint line.
  keys() {
    for (const [action] of SLOTS) this.slotEls[action].querySelector('b').textContent = label(action);
    $('menuKeys').innerHTML =
      `<b>${['forward', 'left', 'back', 'right'].map(label).join(' ')} · ${label('jump')} · ${label('crouch')}</b><span>move, jump, crouch</span>` +
      `<b>${['wall', 'floor', 'ramp', 'roof'].map(label).join(' · ')}</b><span>wall, floor, ramp, roof</span>` +
      `<b>${label('edit')}</b><span>edit your own piece, again to confirm</span>` +
      `<b>${['gun1', 'gun2', 'gun3'].map(label).join(' · ')}</b><span>shotgun, rifle, SMG</span>` +
      `<b>${label('resetArena')}</b><span>reset the arena</span>`;
    this.hintsEl.innerHTML =
      `<span><b>${label('edit')}</b> edit</span><span><b>${label('reload')}</b> reload</span>` +
      `<span><b>${label('resetArena')}</b> reset arena</span><span><b>Esc</b> menu</span>`;
  }

  mode(mode, slot) {
    document.body.dataset.mode = mode;
    for (const k in this.slotEls) this.slotEls[k].classList.toggle('on', k === slot);
  }

  tipText(text) { this.set(this.tip, 'tip', text); }

  ammo(gun, now, reloading, left) {
    this.set(this.gunName, 'gun', gun ? `${gun.name} · ${gun.kind}` : '');
    this.set(this.ammoEl, 'ammo', gun ? String(now) : '');
    this.set(this.ammoSub, 'sub', !gun ? '' : reloading ? 'reloading' : '/ ∞');
    const w = reloading ? Math.round((1 - left) * 100) : 0;
    if (this.cache.rel !== w) { this.cache.rel = w; $('reloadFill').style.width = w + '%'; }
    $('ammo').classList.toggle('low', !!gun && !reloading && now === 0);
    if (this.cache.gunOn !== !!gun) { this.cache.gunOn = !!gun; $('ammo').style.visibility = gun ? '' : 'hidden'; }
  }

  // Crosshair gap follows the spread (degrees) and the field of view.
  spread(deg) {
    const px = Math.round(4 + Math.tan(deg * Math.PI / 180) / Math.tan(this.camera.fov * Math.PI / 360) * innerHeight / 2);
    if (this.cache.gap === px) return;
    this.cache.gap = px;
    this.cross.style.setProperty('--gap', px + 'px');
  }

  hit(head) {
    this.hitEl.className = head ? 'show head' : 'show';
    this.hitT = 0.16;
  }

  toast(text, time = 1.6) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastT = time;
  }

  stats(text) { this.set(this.statsEl, 'stats', text); }

  project(x, y, z) {
    const v = this.v.set(x, y, z).project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    return v;
  }

  // A damage number that floats up from where the shot landed.
  number(x, y, z, amount, head) {
    const el = document.createElement('span');
    el.className = head ? 'num head' : 'num';
    el.textContent = amount;
    this.numsEl.append(el);
    this.nums.push({ el, x: x + (Math.random() - 0.5) * 0.3, y: y + 0.25, z, t: 0 });
    if (this.nums.length > 24) this.nums.shift().el.remove();
  }

  update(dt, dummies) {
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.hitEl.className = ''; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toastEl.classList.remove('show'); }
    const w = innerWidth / 2, h = innerHeight / 2;
    for (let n = this.nums.length - 1; n >= 0; n--) {
      const m = this.nums[n];
      m.t += dt;
      if (m.t > 0.7) { m.el.remove(); this.nums.splice(n, 1); continue; }
      const v = this.project(m.x, m.y + m.t * 1.4, m.z);
      if (!v) { m.el.style.opacity = 0; continue; }
      m.el.style.transform = `translate(${(v.x * w + w).toFixed(1)}px, ${(-v.y * h + h).toFixed(1)}px) translate(-50%, -50%)`;
      m.el.style.opacity = m.t < 0.45 ? 1 : 1 - (m.t - 0.45) / 0.25;
    }
    // health bars over the dummies
    while (this.bars.length < dummies.length) {
      const el = document.createElement('div');
      el.className = 'hp';
      el.innerHTML = '<i></i>';
      this.barsEl.append(el);
      this.bars.push({ el, fill: el.firstChild, w: -1, on: true });
    }
    for (let n = 0; n < dummies.length; n++) {
      const d = dummies[n], bar = this.bars[n];
      let v = d.alive ? this.project(d.x, d.y + 2.15, d.z) : null;
      if (v) {
        // not through walls
        const c = this.camera.position;
        let dx = d.x - c.x, dy = d.y + d.headY - c.y, dz = d.z - c.z;
        const len = Math.hypot(dx, dy, dz);
        if (len > 0.6 && this.world.ray(c.x, c.y, c.z, dx / len, dy / len, dz / len, len - 0.3)) v = null;
      }
      const on = !!v;
      if (on !== bar.on) { bar.on = on; bar.el.style.display = on ? '' : 'none'; }
      if (!on) continue;
      bar.el.style.transform = `translate(${(v.x * w + w).toFixed(1)}px, ${(-v.y * h + h).toFixed(1)}px) translate(-50%, -50%)`;
      const pct = Math.round(d.hp / d.maxHp * 100);
      if (pct !== bar.w) { bar.w = pct; bar.fill.style.width = pct + '%'; }
    }
  }

  clear() {
    for (const m of this.nums) m.el.remove();
    this.nums.length = 0;
    this.hitEl.className = '';
    this.toastEl.classList.remove('show');
  }
}

export { GUNS };
