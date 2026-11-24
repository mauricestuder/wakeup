// Hell's Customs: boot, screens, input and the frame loop.

import { W, H, MAPS, buildPath } from './maps.js';
import { Game, DT } from './game.js';
import { ETYPES } from './enemies.js';
import { TOWERS, TOWER_KEYS, TARGET_MODES } from './towers.js';
import { roundSpawns, LAST_ROUND } from './rounds.js';
import { makeBackground, drawWorld, drawSinner, FX } from './draw.js';
import { UI, toast, tip, hurtFlash } from './ui.js';
import { initAudio, sfx, setVolume, setMusicVolume, startMusic } from './audio.js';
import { save, persist, recordBest } from './save.js';

const $ = id => document.getElementById(id);
const stage = $('stage'), canvas = $('game'), ctx = canvas.getContext('2d');
const DEBUG = new URLSearchParams(location.search).has('debug');

let scale = 1, dpr = 1, bg = null;
let game = null, fx = new FX();
let state = 'menu';                // menu | play | paused | end
let speed = 1, acc = 0, time = 0;
let mapIdx = 0, diffKey = 'normal';
let sel = null;                    // selected tower
let placing = null;                // { key, drag, touch }
let pointer = { x: -999, y: -999, over: false, type: 'mouse' };
let ghost = null;
let seenThisGame = new Set();

// ---------- layout ----------
function layout() {
  const iw = window.innerWidth, ih = window.innerHeight;
  scale = Math.min(iw / 1600, ih / 900);
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  stage.style.transform = `translate(${(iw - 1600 * scale) / 2}px, ${(ih - 900 * scale) / 2}px) scale(${scale})`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  if (game) bg = makeBackground(game.map, game.path, scale * dpr);
}
window.addEventListener('resize', layout);

// ---------- menu ----------
function buildMenu() {
  const maps = $('maps');
  maps.innerHTML = '';
  MAPS.forEach((m, i) => {
    const card = document.createElement('button');
    card.className = 'mapc' + (i === mapIdx ? ' on' : '');
    const best = save.best[`${m.id}-${diffKey}`];
    card.innerHTML = `<canvas width="712" height="500"></canvas><div class="n">${m.name}</div><div class="b">${m.blurb}</div><div class="best">${best ? `Best: ticket #${best}` : '&nbsp;'}</div>`;
    const prev = makeBackground(m, buildPath(m), 712 / W);
    card.querySelector('canvas').getContext('2d').drawImage(prev, 0, 0, 712, 500);
    card.onclick = () => { mapIdx = i; sfx('click'); buildMenu(); };
    maps.appendChild(card);
  });
  for (const b of document.querySelectorAll('#diffs .btn')) b.classList.toggle('on', b.dataset.d === diffKey);
}

function buildChain() {
  const order = ['ceo', 'lawyer', 'infl', 'cart', 'soul'];
  const el = $('chain');
  el.innerHTML = '';
  order.forEach((t, i) => {
    const c = document.createElement('canvas');
    c.width = 140; c.height = 140;
    const x = c.getContext('2d');
    x.scale(2, 2);
    drawSinner(x, { t, x: 35, y: 42, r: ETYPES[t].r * 1.25, dx: 1, seed: i * 1.7, flash: 0, burnT: 0, stunT: 0, slowF: 1, hp: 1, maxHp: 1 }, 0.2);
    const wrap = document.createElement('div');
    wrap.style.textAlign = 'center';
    wrap.appendChild(c);
    const n = document.createElement('div'); n.textContent = ETYPES[t].name; wrap.appendChild(n);
    el.appendChild(wrap);
    if (i < order.length - 1) { const a = document.createElement('div'); a.className = 'arr'; a.textContent = '→'; el.appendChild(a); }
  });
}

for (const b of document.querySelectorAll('#diffs .btn')) b.onclick = () => { diffKey = b.dataset.d; sfx('click'); buildMenu(); };
$('start').onclick = () => { initAudio(); startMusic(); newGame(); };

function bindSlider(id, key, fn) {
  const el = $(id);
  el.value = save[key];
  el.oninput = () => { save[key] = +el.value; fn(save[key]); persist(); syncSliders(); };
}
function syncSliders() { for (const [id, k] of [['vol', 'vol'], ['vol2', 'vol'], ['mus', 'music'], ['mus2', 'music']]) $(id).value = save[k]; }
bindSlider('vol', 'vol', setVolume); bindSlider('vol2', 'vol', setVolume);
bindSlider('mus', 'music', setMusicVolume); bindSlider('mus2', 'music', setMusicVolume);
setVolume(save.vol); setMusicVolume(save.music);
// Start the hold music on the first touch anywhere (browsers need a gesture).
window.addEventListener('pointerdown', () => { initAudio(); startMusic(); }, { once: true });

function show(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id); }

// ---------- game lifecycle ----------
function newGame() {
  game = new Game(MAPS[mapIdx], diffKey);
  if (DEBUG) game.cash = 99999;
  fx = new FX();
  bg = makeBackground(game.map, game.path, scale * dpr);
  sel = null; placing = null; ghost = null; speed = 1; acc = 0;
  seenThisGame = new Set();
  ui.highlight(null); ui.forcePanel();
  state = 'play';
  show(null);
  toast('YOUR SHIFT STARTS NOW', 2200);
  window.__hc = { game, ui, newGame, setSpeed: s => (speed = s) };
}

function endScreen(won) {
  state = 'end';
  const t = $('endT'), s = $('endS'), b = $('endB');
  if (won) {
    t.textContent = 'QUOTA REACHED'; t.className = 'big';
    s.textContent = 'Employee of the Month. Your prize: more work.';
    b.innerHTML = '<button class="btn go" data-a="freeplay">KEEP WORKING (FREEPLAY)</button><button class="btn" data-a="menu">CLOCK OUT</button>';
  } else {
    t.textContent = 'THEY GOT INTO HEAVEN'; t.className = 'big bad';
    s.textContent = `Management is furious. You lasted until ticket #${game.round + 1}.`;
    b.innerHTML = '<button class="btn go" data-a="restart">TRY AGAIN</button><button class="btn" data-a="menu">QUIT TO MENU</button>';
  }
  show('endScr');
}

document.addEventListener('click', ev => {
  const a = ev.target.closest('[data-a]')?.dataset.a;
  if (!a) return;
  sfx('click');
  if (a === 'resume') { state = 'play'; show(null); }
  else if (a === 'restart') newGame();
  else if (a === 'menu') { state = 'menu'; game = null; buildMenu(); show('menu'); }
  else if (a === 'freeplay') { state = 'play'; show(null); toast('FREEPLAY: OVERTIME, UNPAID', 2400); }
});

function pause() {
  if (state !== 'play') return;
  state = 'paused';
  syncSliders();
  show('pauseScr');
}

// ---------- tower actions ----------
function select(t) { sel = t; ui.forcePanel(); if (t) cancelPlacing(); }
function cancelPlacing() { placing = null; ghost = null; ui.highlight(null); }

const TIPS = {
  lawyer: ['NEW: LAWYERS', 'Fast talkers, fast walkers. Inside every Lawyer is an Influencer.'],
  ceo: ['NEW: CEOS', 'The fastest sinners in the building. They think they can buy their way out.'],
  camo: ['NEW: TAX EVADERS', 'Sinners hiding in boxes! Only the Tax Auditor and a Stamp Demon with Reading Glasses can see them. Lava blasts still hit them.'],
  mime: ['NEW: MIMES', "Mimes can't hear the hold music, so phones don't slow them. Each one hides 2 CEOs."],
  complainer: ['NEW: THE COMPLAINER', 'Stamps and pitchforks bounce off the complaint form! Use Lava Geysers, Flaming Forks, Bigger Fines or PERMANENTLY DENIED.'],
  bus: ['NEW: TOUR BUS', 'Takes 16 hits, then the whole tour group gets out. Bring lava.'],
  replyall: ['BOSS: REPLY-ALL GUY', 'He replies to everyone. Lots of HP. Tax Auditors are great against bosses.'],
  popup: ['FINAL BOSS: THE INVENTOR OF POP-UP ADS', 'The worst person in history. Throw everything at him.'],
};

function roundTips(n) {
  const types = new Set();
  let camo = false;
  for (const s of roundSpawns(n)) { types.add(s.type); if (s.camo) camo = true; }
  for (const k of ['popup', 'replyall', 'bus', 'complainer', 'mime', 'ceo', 'lawyer']) {
    if (types.has(k) && !seenThisGame.has(k)) { seenThisGame.add(k); tip(...TIPS[k]); return; }
  }
  if (camo && !seenThisGame.has('camo')) { seenThisGame.add('camo'); tip(...TIPS.camo); }
}

const handlers = {
  cardDown(key, ev) {
    if (state !== 'play') return;
    initAudio();
    ui.showInfo(key);
    if (placing && placing.key === key && !placing.drag) { cancelPlacing(); return; }
    select(null);
    placing = { key, drag: true, touch: ev.pointerType !== 'mouse', moved: false };
    ui.highlight(key);
  },
  deselect() { select(null); },
  cycleTarget() { if (sel) { sel.mode = (sel.mode + 1) % TARGET_MODES.length; sfx('click'); ui.forcePanel(); } },
  sell() { if (sel) { game.sell(sel); select(null); } },
  upgrade(p) { if (sel && !game.upgrade(sel, p)) sfx('nope'); ui.forcePanel(); },
  play,
  toggleAuto() { save.auto = !save.auto; persist(); sfx('click'); },
  pause,
};
const ui = new UI(handlers);

function play() {
  if (state !== 'play' || !game) return;
  initAudio();
  if (!game.active) { game.startRound(); }
  else { speed = speed % 3 + 1; sfx('click'); }
}

// ---------- pointer input ----------
function toWorld(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / r.width * W, y: (ev.clientY - r.top) / r.height * H };
}

function updateGhost() {
  if (!placing || !pointer.over) { ghost = null; return; }
  const lift = placing.drag && placing.touch ? 46 : 0;   // keep the tower visible above your finger
  const x = pointer.x, y = pointer.y - lift;
  ghost = { key: placing.key, x, y, ok: game.canPlaceAt(placing.key, x, y) && game.cash >= game.towerCost(placing.key) };
}

function tryPlace() {
  if (!ghost) return false;
  if (!ghost.ok) { sfx('nope'); return false; }
  const t = game.place(ghost.key, ghost.x, ghost.y);
  if (t) { sfx('place'); cancelPlacing(); return true; }
  return false;
}

window.addEventListener('pointermove', ev => {
  if (!game) return;
  const p = toWorld(ev);
  pointer = { ...p, over: p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H, type: ev.pointerType };
  if (placing) { placing.moved = placing.moved || pointer.over; updateGhost(); }
});

window.addEventListener('pointerup', ev => {
  if (!game || !placing || !placing.drag) return;
  const p = toWorld(ev);
  pointer = { ...p, over: p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H, type: ev.pointerType };
  updateGhost();
  if (pointer.over && placing.moved) { if (!tryPlace()) cancelPlacing(); }
  else if (!pointer.over) { placing.drag = false; ghost = null; }   // tapped the card: now tap the map
  else cancelPlacing();
});

canvas.addEventListener('pointerdown', ev => {
  if (state !== 'play') return;
  initAudio();
  const p = toWorld(ev);
  pointer = { ...p, over: true, type: ev.pointerType };
  if (placing && !placing.drag) {
    placing.touch = ev.pointerType !== 'mouse';
    updateGhost();
    if (!tryPlace() && placing.touch) setTimeout(() => { if (placing && !placing.drag) ghost = null; }, 600);
    return;
  }
  let hit = null, best = Infinity;
  for (const t of game.towers) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d < t.r + 10 && d < best) { best = d; hit = t; }
  }
  select(hit);
  if (hit) sfx('click');
});

// ---------- keyboard ----------
window.addEventListener('keydown', ev => {
  if (state === 'paused' && ev.key === 'Escape') { state = 'play'; show(null); return; }
  if (state !== 'play') return;
  const k = ev.key;
  const idx = TOWER_KEYS.findIndex(key => TOWERS[key].key === k);
  if (idx >= 0) {
    select(null);
    placing = { key: TOWER_KEYS[idx], drag: false, touch: false };
    ui.highlight(placing.key); ui.showInfo(placing.key); updateGhost();
  } else if (k === ' ') { ev.preventDefault(); play(); }
  else if (k === 'f' || k === 'F') { speed = speed % 3 + 1; }
  else if (k === 'Escape') { if (placing) cancelPlacing(); else if (sel) select(null); else pause(); }
  else if ((k === 'Backspace' || k === 'Delete') && sel) handlers.sell();
  else if (k === ',' ) handlers.upgrade(0);
  else if (k === '.') handlers.upgrade(1);
  else if (k === 'Tab') { ev.preventDefault(); handlers.cycleTarget(); }
  else if (DEBUG && k === 'n') { for (const e of game.enemies) e.alive = false; game.spawnI = game.spawns.length; }
});

// ---------- events from the simulation ----------
function handleEvents() {
  const endY = game.map.pts[game.map.pts.length - 1][1];
  for (const ev of game.events) {
    if (ev.k === 'leak') ev.y = endY;
    fx.event(ev);
    switch (ev.k) {
      case 'pop': sfx(ev.boss ? 'bossPop' : 'pop'); break;
      case 'throw': case 'spin': case 'erupt': case 'shot': case 'clang': case 'hold': case 'press1': case 'bossHit': case 'upgrade': case 'sell':
        sfx(ev.k); break;
      case 'boom': sfx('boom'); break;
      case 'leak': sfx('leak'); hurtFlash(); break;
      case 'roundStart': sfx('roundStart'); toast(`NOW SERVING TICKET #${ev.n}`); roundTips(ev.n); break;
      case 'roundEnd':
        sfx('roundEnd');
        toast(`TICKET #${ev.n} DONE  +$${ev.bonus + ev.income}`);
        recordBest(game.map.id, game.diffKey, ev.n);
        if (save.auto && !(ev.n === LAST_ROUND)) setTimeout(() => { if (state === 'play' && game && !game.active) game.startRound(); }, 400);
        break;
      case 'win':
        sfx('win');
        for (let i = 0; i < 60; i++) fx.add({ k: 'puff', x: Math.random() * W, y: -20, vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 200, r: 7, col: ['#ffd34d', '#ff6a2a', '#7dff8a', '#6fd3ff', '#fff'][i % 5], life: 3, max: 3 });
        setTimeout(() => endScreen(true), 1400);
        break;
      case 'lose': sfx('lose'); setTimeout(() => endScreen(false), 1300); break;
    }
  }
  game.events.length = 0;
}

// ---------- loop ----------
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (game && (state === 'play' || state === 'end')) {
    if (state === 'play') {
      acc += dt * speed;
      let steps = 0;
      while (acc >= DT && steps < 12) { game.step(); acc -= DT; steps++; }
      if (steps === 12) acc = 0;
      time += dt * speed;
    }
    handleEvents();
    fx.update(dt);
    if (sel && !game.towers.includes(sel)) select(null);
    render();
    ui.update(game, sel, speed, save.auto);
  }
  requestAnimationFrame(frame);
}

function render() {
  const s = scale * dpr;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  ctx.imageSmoothingEnabled = true;
  drawWorld(ctx, game, bg, fx, time, { sel, ghost });
}

// ---------- boot ----------
layout();
document.fonts.load('30px "Luckiest Guy"').then(() => document.fonts.load('30px Creepster')).catch(() => {}).finally(() => {
  buildMenu();
  buildChain();
  syncSliders();
  requestAnimationFrame(frame);
});
