// HUD: plain DOM elements over the canvas.

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = {
      cash: $('cash'), pops: $('cashPops'), round: $('round'), weapon: $('weapon'), ammo: $('ammo'),
      grenades: $('grenades'), vignette: $('vignette'), hurt: $('hurt'), prompt: $('prompt'),
      announce: $('announce'), toast: $('toast'), hit: $('hitmarker'), powerups: $('powerups'),
      perks: $('perks'), left: $('left'), combo: $('combo'),
    };
    this.comboT = 0;
    this.announceT = 0;
    this.toastT = 0;
    this.hitT = 0;
    this.hurtT = 0;
    this.last = {};
  }

  set(key, el, value, fn) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    fn ? fn(el, value) : (el.textContent = value);
  }

  setCash(n) { this.set('cash', this.el.cash, '$' + Math.floor(n).toLocaleString('en-US')); }

  popCash(n) {
    const d = document.createElement('div');
    d.className = 'pop';
    d.textContent = '+' + Math.round(n);
    d.style.left = (Math.random() * 40) + 'px';
    this.el.pops.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  setRound(r) { this.set('round', this.el.round, String(r)); }

  setAmmo(name, mag, reserve, gold, reloading) {
    this.set('weapon', this.el.weapon, name + (gold ? ' ★' : ''), (el, v) => { el.textContent = v; el.classList.toggle('gold', gold); });
    this.set('ammo', this.el.ammo, reloading ? 'RELOADING' : `${mag} / ${reserve}`, (el, v) => {
      el.textContent = v; el.classList.toggle('low', !reloading && mag === 0);
    });
  }

  setGrenades(n) { this.set('gren', this.el.grenades, n, (el, v) => { el.innerHTML = '<i class="bag"></i>'.repeat(v); }); }
  setLeft(n) { this.set('left', this.el.left, n > 0 ? `${n} remaining` : ''); }

  setHealth(frac) {
    this.set('hp', this.el.vignette, Math.round((1 - frac) * 20), (el, v) => { el.style.opacity = Math.min(1, v / 14); });
  }

  flashDamage() { this.hurtT = 0.3; this.el.hurt.style.opacity = 0.6; }

  prompt(text) { this.set('prompt', this.el.prompt, text || '', (el, v) => { el.textContent = v; el.style.display = v ? 'block' : 'none'; }); }

  announce(title, sub = '', dur = 2.5, small = false) {
    const a = this.el.announce;
    a.innerHTML = '';
    const t = document.createElement('div'); t.className = small ? 'title small' : 'title'; t.textContent = title; a.appendChild(t);
    if (sub) { const s = document.createElement('div'); s.className = 'sub'; s.textContent = sub; a.appendChild(s); }
    a.style.opacity = 1;
    this.announceT = dur;
  }

  // Hide banners and hints, e.g. when a pause or game-over screen opens.
  clear() {
    this.prompt('');
    for (const k of ['announce', 'toast', 'combo']) this.el[k].style.opacity = 0;
    this.announceT = this.toastT = this.comboT = 0;
  }

  toast(text) { this.el.toast.textContent = text; this.el.toast.style.opacity = 1; this.toastT = 1.6; }

  hitmarker(head) {
    this.el.hit.classList.toggle('head', head);
    this.el.hit.style.opacity = 1;
    this.hitT = 0.12;
  }

  setPowerups(state) {
    const parts = [];
    if (state.doubleT > 0) parts.push(`2X CASH ${Math.ceil(state.doubleT)}`);
    if (state.instaT > 0) parts.push(`INSTA-KILL ${Math.ceil(state.instaT)}`);
    if (state.saleT > 0) parts.push(`FIRE SALE ${Math.ceil(state.saleT)}`);
    this.set('pu', this.el.powerups, parts.join('   '));
  }

  combo(n, bonus) {
    const c = this.el.combo;
    c.innerHTML = `${n}x COMBO <span>+$${bonus}</span>`;
    c.style.opacity = 1;
    // Restart the pop animation.
    c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    this.comboT = 1.4;
  }

  setPerks(list) {
    this.el.perks.innerHTML = '';
    for (const p of list) {
      const d = document.createElement('div');
      d.className = 'perk';
      d.style.background = '#' + p.color.toString(16).padStart(6, '0');
      d.title = p.name;
      d.textContent = p.name.split(' ').map(w => w[0]).join('');
      this.el.perks.appendChild(d);
    }
  }

  update(dt) {
    if (this.announceT > 0) { this.announceT -= dt; if (this.announceT <= 0) this.el.announce.style.opacity = 0; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.style.opacity = 0; }
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.el.combo.style.opacity = 0; }
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.el.hit.style.opacity = 0; }
    if (this.hurtT > 0) { this.hurtT -= dt; this.el.hurt.style.opacity = Math.max(0, this.hurtT * 2); }
  }
}
