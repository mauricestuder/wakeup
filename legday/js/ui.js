// Sidebar: tower shop, selected-tower panel, play/speed controls and HUD.

import { TOWERS, TOWER_KEYS, TARGET_MODES, canUpgrade } from './towers.js';
import { drawTower } from './draw.js';

const $ = id => document.getElementById(id);

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.side = $('side');
    this.cards = {};
    this.last = {};
    const grid = $('shopGrid');
    for (const key of TOWER_KEYS) {
      const D = TOWERS[key];
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.key = key;
      el.innerHTML = `<span class="k">${D.key}</span><canvas width="240" height="184"></canvas><div class="n">${D.name}</div><div class="c">$${D.cost}</div>`;
      grid.appendChild(el);
      const c = el.querySelector('canvas').getContext('2d');
      c.scale(2, 2);
      drawTower(c, key, 60, 56, { icon: true, scale: 1.25, lvl: [0, 0], t: 0.3 });
      el.addEventListener('pointerdown', ev => { ev.preventDefault(); handlers.cardDown(key, ev); });
      el.addEventListener('mouseenter', () => this.showInfo(key));
      this.cards[key] = el;
    }
    $('pClose').onclick = () => handlers.deselect();
    $('pTarget').onclick = () => handlers.cycleTarget();
    $('pSell').onclick = () => handlers.sell();
    for (const b of document.querySelectorAll('.up')) b.onclick = () => handlers.upgrade(+b.dataset.p);
    $('play').onclick = () => handlers.play();
    $('auto').onclick = () => handlers.toggleAuto();
    $('pause').onclick = () => handlers.pause();
  }

  showInfo(key) {
    const D = TOWERS[key];
    $('info').innerHTML = `<div class="t">${D.name}</div>${D.desc}<br><span style="color:#a88">Hotkey ${D.key}</span>`;
  }

  highlight(key) { for (const k in this.cards) this.cards[k].classList.toggle('on', k === key); }

  // Called every frame; only touches the DOM when something changed.
  update(game, sel, speed, auto) {
    const cash = Math.floor(game.cash);
    const set = (id, v, el) => { if (this.last[id] !== v) { this.last[id] = v; el(v); } };
    set('cash', cash, v => { $('hCash').querySelector('b').textContent = v.toLocaleString('en-US'); });
    set('lives', game.lives, v => { $('hLives').querySelector('b').textContent = v; });
    const shown = game.round + 1;
    set('round', `${shown}|${game.won}`, () => {
      $('hRound').innerHTML = game.won && shown > 40 ? `WAVE <b>${shown}</b> ★` : `WAVE <b>${shown}</b>/40`;
    });
    for (const key of TOWER_KEYS) {
      const poor = cash < game.towerCost(key);
      set('poor' + key, poor, v => this.cards[key].classList.toggle('poor', v));
      set('price' + key, game.towerCost(key), v => { this.cards[key].querySelector('.c').textContent = '$' + v; });
    }
    set('play', `${game.active}|${speed}`, () => {
      const b = $('play');
      b.classList.toggle('run', game.active);
      b.innerHTML = game.active ? `${'▶'.repeat(speed)} ${speed}X<small>Tap for speed</small>` : '▶ NEXT WAVE<small>Space</small>';
    });
    set('auto', auto, v => $('auto').classList.toggle('on', v));
    // selected tower panel
    const key = sel ? `${sel.id}|${sel.lvl}|${sel.mode}|${cash}|${sel.pops}` : '';
    set('panel', key, () => this.renderPanel(game, sel));
  }

  renderPanel(game, t) {
    this.side.classList.toggle('sel', !!t);
    if (!t) return;
    const D = TOWERS[t.key];
    $('pName').textContent = D.name;
    $('pPops').textContent = t.key === 'store' ? `Pays $${t.s.income}+ per wave` : `${t.pops.toLocaleString('en-US')} zombies smashed`;
    const c = $('pIcon').getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 168, 140);
    c.scale(2, 2);
    drawTower(c, t.key, 42, 40, { icon: true, scale: 1.05, lvl: t.lvl, t: 0.3, face: 1 });
    const tgt = $('pTarget');
    tgt.style.display = ['dj', 'store', 'spinner'].includes(t.key) ? 'none' : '';
    tgt.innerHTML = `TARGET: <b>${TARGET_MODES[t.mode].toUpperCase()}</b>`;
    for (const b of document.querySelectorAll('.up')) {
      const p = +b.dataset.p, lvl = t.lvl[p], next = D.paths[p][lvl];
      const pips = [0, 1, 2].map(i => `<i class="${lvl > i ? 'f' : ''}"></i>`).join('');
      let cls = 'up', body;
      if (!next) { body = `<div class="un">${D.paths[p][2].name}</div><div class="ud">Fully upgraded.</div><div class="uc">MAXED</div>`; cls += ' lock'; }
      else if (!canUpgrade(t.lvl, p)) { body = `<div class="un">${next.name}</div><div class="ud">Only one path can go past tier 1.</div><div class="uc">PATH LOCKED</div>`; cls += ' lock'; }
      else {
        const cost = game.upgradeCost(t, p);
        if (game.cash < cost) cls += ' poor';
        body = `<div class="un">${next.name}</div><div class="ud">${next.desc}</div><div class="uc">$${cost.toLocaleString('en-US')}</div>`;
      }
      b.className = cls;
      b.innerHTML = `<div class="pips">${pips}</div>${body}`;
    }
    $('pSell').textContent = `SELL $${game.sellValue(t).toLocaleString('en-US')}`;
  }

  forcePanel() { this.last.panel = null; }
}

let toastTimer = 0;
export function toast(msg, ms = 1800) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

let tipTimer = 0;
export function tip(title, desc) {
  const el = $('tip');
  el.querySelector('.t').textContent = title;
  el.querySelector('.d').textContent = desc;
  el.classList.add('show');
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => el.classList.remove('show'), 9000);
  el.querySelector('.x').onclick = () => el.classList.remove('show');
}

export function hurtFlash() {
  const el = $('hLives');
  el.classList.remove('hurt'); void el.offsetWidth; el.classList.add('hurt');
}
