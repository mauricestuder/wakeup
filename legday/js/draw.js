// All the cartoon drawing, seen from above: zombies, gym bros, projectiles,
// the street and effects. World units are 1280 x 900. Characters face +x
// in their own space and get rotated to where they are heading.

import { W, H, LANE } from './maps.js';
import { ETYPES } from './enemies.js';
import { TOWERS } from './towers.js';

export const INK = '#16120f';
export const FONT = "'Luckiest Guy', 'Arial Black', Impact, sans-serif";
const TAU = Math.PI * 2;
const ZSKIN = ['#8fbf6a', '#9fb87a', '#7aa86a', '#a5c48a', '#86a874'];
const BSKIN = ['#f2c7a0', '#d9a273', '#a86b43', '#6e4127', '#f6d9bd', '#c58c5c'];

// ---------- tiny helpers ----------
function circ(c, x, y, r, fill, stroke = INK, lw = 3) {
  c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function ell(c, x, y, rx, ry, fill, stroke = INK, lw = 3, rot = 0) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function rr(c, x, y, w, h, r, fill, stroke = INK, lw = 3) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function line(c, x1, y1, x2, y2, col = INK, lw = 3) {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.stroke();
}
function text(c, s, x, y, size, fill = '#fff', stroke = INK, align = 'center') {
  s = String(s).toUpperCase();
  c.font = `${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle';
  if (stroke) { c.lineWidth = Math.max(2, size / 5); c.strokeStyle = stroke; c.lineJoin = 'round'; c.strokeText(s, x, y); }
  c.fillStyle = fill; c.fillText(s, x, y);
}
// An arm from the shoulder to a hand, drawn as a thick outlined line.
function arm(c, x1, y1, x2, y2, w, skin) {
  line(c, x1, y1, x2, y2, INK, w + 4);
  line(c, x1, y1, x2, y2, skin, w);
  circ(c, x2, y2, w * 0.62, skin, INK, 2);
}
// Little eyes on the front edge of a head, so you can tell where it looks.
function frontEyes(c, hx, hr, col = '#fff', pupil = INK) {
  for (const s of [-1, 1]) { circ(c, hx + hr * 0.62, s * hr * 0.38, hr * 0.26, col, INK, 1.5); circ(c, hx + hr * 0.75, s * hr * 0.38, hr * 0.12, pupil, null); }
}
function flame(c, x, y, s, t) {
  const f = 1 + Math.sin(t * 25 + x) * 0.15;
  c.beginPath(); c.moveTo(x, y - s * 1.6 * f);
  c.quadraticCurveTo(x + s, y - s * 0.3, x, y + s * 0.4);
  c.quadraticCurveTo(x - s, y - s * 0.3, x, y - s * 1.6 * f);
  c.fillStyle = '#ff8a1f'; c.fill();
  c.beginPath(); c.moveTo(x, y - s * 0.8 * f); c.quadraticCurveTo(x + s * 0.45, y, x, y + s * 0.3); c.quadraticCurveTo(x - s * 0.45, y, x, y - s * 0.8 * f);
  c.fillStyle = '#ffe066'; c.fill();
}
function dumbbell(c, x, y, len, s, rot = 0, col = '#3a3d44') {
  c.save(); c.translate(x, y); c.rotate(rot);
  line(c, -len / 2, 0, len / 2, 0, INK, 5 * s); line(c, -len / 2, 0, len / 2, 0, '#c9ccd2', 2.5 * s);
  for (const sx of [-1, 1]) rr(c, sx * len / 2 - 4 * s, -7 * s, 8 * s, 14 * s, 2 * s, col, INK, 1.5 * s);
  c.restore();
}
function plateDisc(c, x, y, r, col = '#2e3138') {
  circ(c, x, y, r, col, INK, 2);
  circ(c, x, y, r * 0.62, null, 'rgba(255,255,255,0.18)', 1.5);
  circ(c, x, y, r * 0.22, '#c9ccd2', INK, 1.5);
}

const zskin = e => ZSKIN[Math.floor(e.seed * 10) % ZSKIN.length];

// ---------- zombies (top-down) ----------
// A generic zombie: shuffling feet, shoulders, arms reaching forward, head.
function zombie(c, r, t, e, o) {
  const skin = o.skin || zskin(e);
  const ph = t * (o.pace || 7) + e.seed * 5;
  const step = Math.sin(ph) * r * 0.28;
  if (!o.noLegs) for (const s of [-1, 1]) ell(c, -r * 0.25 + s * step, s * r * 0.32, r * 0.3, r * 0.17, o.shoes || '#3a3328', INK, 2);
  const reach = r * (1.05 + Math.sin(ph * 0.5) * 0.08);
  for (const s of [-1, 1]) arm(c, r * 0.05, s * r * 0.58, reach, s * r * (0.42 + Math.sin(ph + s) * 0.06), r * 0.26, skin);
  ell(c, 0, 0, r * 0.52, r * 0.82, o.shirt || '#6a7fa0', INK, 2.5);
  if (o.body) o.body(c, r, t);
  circ(c, r * 0.12, 0, r * 0.47, skin, INK, 2.5);
  if (o.head) o.head(c, r, t);
  else { // messy hair on top
    c.beginPath(); c.arc(r * 0.05, 0, r * 0.4, Math.PI * 0.55, Math.PI * 1.45); c.closePath();
    c.fillStyle = o.hair || '#4a3a2a'; c.fill();
  }
  if (!o.noEyes) frontEyes(c, r * 0.12, r * 0.47, '#f4f0c8', '#a01818');
}

const ZOMBIE = {
  crawler(c, r, t, e) {
    // no legs, dragging itself along
    const skin = zskin(e), ph = t * 5 + e.seed * 5;
    ell(c, -r * 0.5, 0, r * 0.75, r * 0.55, '#6b5a48', INK, 2.5);
    for (const s of [-1, 1]) arm(c, r * 0.1, s * r * 0.45, r * (0.95 + Math.sin(ph + s * 1.5) * 0.25), s * r * 0.55, r * 0.24, skin);
    circ(c, r * 0.25, 0, r * 0.45, skin, INK, 2.5);
    c.beginPath(); c.arc(r * 0.18, 0, r * 0.38, Math.PI * 0.6, Math.PI * 1.4); c.closePath(); c.fillStyle = '#5a4a3a'; c.fill();
    frontEyes(c, r * 0.25, r * 0.45, '#f4f0c8', '#a01818');
  },
  walker(c, r, t, e) {
    zombie(c, r, t, e, { shirt: '#6a7fa0', pace: 6,
      body: (c, r) => { c.beginPath(); c.moveTo(-r * 0.3, -r * 0.5); c.lineTo(-r * 0.1, -r * 0.2); c.lineTo(-r * 0.35, -r * 0.1); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); } });
  },
  hardhat(c, r, t, e) {
    zombie(c, r, t, e, { shirt: '#ff8a2a', pace: 7,
      body: (c, r) => { line(c, -r * 0.1, -r * 0.78, -r * 0.1, r * 0.78, '#fff36a', r * 0.14); },
      head: (c, r) => { circ(c, r * 0.12, 0, r * 0.56, '#ffd21f', INK, 2.5); line(c, -r * 0.35, 0, r * 0.6, 0, '#e8b800', 3); } });
  },
  jogger(c, r, t, e) {
    zombie(c, r, t, e, { shirt: '#3ee0b8', shoes: '#ff4d8a', pace: 13,
      head: (c, r) => {
        c.beginPath(); c.arc(r * 0.05, 0, r * 0.4, Math.PI * 0.55, Math.PI * 1.45); c.closePath(); c.fillStyle = '#c8a050'; c.fill();
        circ(c, r * 0.12, 0, r * 0.47, null, '#e83030', 3.5);
      } });
  },
  football(c, r, t, e) {
    zombie(c, r, t, e, { shirt: '#c82a2a', shoes: '#fff', pace: 12, noEyes: true,
      body: (c, r) => { ell(c, -r * 0.05, 0, r * 0.55, r * 1.0, '#c82a2a', INK, 2.5); text(c, '66', -r * 0.25, 0, r * 0.5, '#fff', null); },
      head: (c, r) => {
        circ(c, r * 0.12, 0, r * 0.56, '#7a1616', INK, 2.5);
        line(c, -r * 0.4, 0, r * 0.65, 0, '#fff', 3);
        for (const k of [-0.25, 0, 0.25]) line(c, r * 0.62, r * k * 1.4, r * 0.85, r * k * 1.4, '#ddd', 2);
      } });
  },
  headphones(c, r, t, e) {
    zombie(c, r, t, e, { shirt: '#7a4fc0', pace: 7,
      body: (c, r) => { c.beginPath(); c.arc(-r * 0.15, 0, r * 0.45, Math.PI * 0.5, Math.PI * 1.5); c.strokeStyle = '#5a2f9a'; c.lineWidth = 4; c.stroke(); },
      head: (c, r) => {
        c.beginPath(); c.arc(r * 0.05, 0, r * 0.4, Math.PI * 0.55, Math.PI * 1.45); c.closePath(); c.fillStyle = '#222'; c.fill();
        line(c, r * 0.1, -r * 0.55, r * 0.1, r * 0.55, '#222', 4);
        for (const s of [-1, 1]) rr(c, -r * 0.05, s * r * 0.55 - r * 0.17, r * 0.32, r * 0.34, 4, '#ff3a8a', INK, 2);
      } });
    text(c, '♪', -r * 0.6, -r * 0.9 + Math.sin(t * 6 + e.seed) * 3, r * 0.6, '#ff7ab8', INK);
  },
  riot(c, r, t, e) {
    zombie(c, r, t, e, { shirt: '#2a3a5a', shoes: '#111', pace: 5, noEyes: true,
      head: (c, r) => { circ(c, r * 0.12, 0, r * 0.55, '#1e2a40', INK, 2.5); ell(c, r * 0.45, 0, r * 0.18, r * 0.42, 'rgba(160,210,255,0.6)', INK, 1.5); } });
    // the shield: arrows bounce off this
    c.beginPath(); c.arc(-r * 0.3, 0, r * 1.45, -0.62, 0.62);
    c.lineWidth = r * 0.42; c.strokeStyle = INK; c.lineCap = 'butt'; c.stroke();
    c.lineWidth = r * 0.3; c.strokeStyle = '#9fb4cc'; c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.beginPath(); c.arc(-r * 0.3, 0, r * 1.38, -0.5, 0.1); c.stroke(); c.lineCap = 'round';
  },
  partybus(c, r, t, e) {
    const L = r * 1.5, Wd = r * 0.78;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { // zombie arms out of the windows
      const x = -L * 0.6 + i * L * 0.55, wave = Math.sin(t * 8 + i + s) * 4;
      arm(c, x, s * Wd * 0.8, x + 6 + wave, s * (Wd + 12), 6, ZSKIN[(i + 2) % 5]);
    }
    rr(c, -L, -Wd, L * 2, Wd * 2, r * 0.3, '#d14fd8');
    rr(c, L - r * 0.45, -Wd + 4, r * 0.35, Wd * 2 - 8, 5, '#bfe8ff', INK, 2);
    rr(c, -L * 0.75, -Wd * 0.45, L * 1.2, Wd * 0.9, 6, '#a332b0', INK, 2);
    circ(c, -L * 0.15, 0, r * 0.28, '#e8e8f0', INK, 2);   // disco ball
    for (let i = 0; i < 6; i++) { const a = t * 3 + i; circ(c, -L * 0.15 + Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.5, 2.5, ['#ff5', '#5ff', '#f5f'][i % 3], null); }
    text(c, 'PARTY', L * 0.35, 0, r * 0.36, '#ffe066', INK);
  },
  couch(c, r, t, e) {
    rr(c, -r * 0.95, -r * 1.15, r * 1.6, r * 2.3, 12, '#6b4a8a');                       // couch base
    rr(c, -r * 0.95, -r * 1.15, r * 0.45, r * 2.3, 10, '#5a3a78', INK, 2.5);              // backrest
    for (const s of [-1, 1]) rr(c, -r * 0.6, s * r * 1.15 - (s > 0 ? r * 0.38 : 0), r * 1.25, r * 0.38, 8, '#5a3a78', INK, 2.5);
    // the fat zombie lounging on it
    ell(c, -r * 0.05, 0, r * 0.55, r * 0.7, '#e8e0d0', INK, 2.5);
    circ(c, -r * 0.05, 0, r * 0.5, null, 'rgba(0,0,0,0.12)', 6);
    circ(c, r * 0.05, 0, r * 0.32, ZSKIN[1], INK, 2.5);
    frontEyes(c, r * 0.05, r * 0.32, '#f4f0c8', '#a01818');
    rr(c, r * 0.35, r * 0.2, r * 0.3, r * 0.4, 4, '#e8301a', INK, 2);   // chips
    text(c, 'CHIPS', r * 0.5, r * 0.4, 8, '#ffe066', null);
    rr(c, r * 0.35, -r * 0.6, r * 0.32, r * 0.14, 3, '#222', INK, 1.5); // remote
  },
  mru(c, r, t, e) {
    const skin = '#8fbf6a', ph = t * 3 + e.seed;
    for (const s of [-1, 1]) ell(c, -r * 0.3 + s * Math.sin(ph) * r * 0.2, s * r * 0.35, r * 0.3, r * 0.17, '#222', INK, 2);
    // huge flexing arms
    for (const s of [-1, 1]) {
      const fl = Math.sin(t * 4) * 0.15;
      arm(c, 0, s * r * 0.8, r * 0.35, s * r * (1.35 + fl), r * 0.42, skin);
      arm(c, r * 0.35, s * r * (1.35 + fl), r * 0.85, s * r * (1.0 + fl), r * 0.36, skin);
    }
    ell(c, 0, 0, r * 0.62, r * 1.05, skin, INK, 3);            // massive back and traps
    ell(c, -r * 0.1, 0, r * 0.32, r * 0.7, 'rgba(0,0,0,0.12)', null);
    ell(c, r * 0.05, 0, r * 0.45, r * 0.5, '#9fcf7a', INK, 2.5); // traps
    circ(c, r * 0.18, 0, r * 0.26, skin, INK, 2.5);             // tiny head
    frontEyes(c, r * 0.18, r * 0.26, '#f4f0c8', '#a01818');
    rr(c, -r * 0.62, -r * 0.18, r * 0.25, r * 0.36, 3, '#e0b030', INK, 2); // gold belt buckle peeking out
  },
};

function trashCan(c, r, t, e) {
  // A zombie hiding in a trash can. Only spotters can see it.
  const peek = Math.sin(t * 2 + e.seed) * 0.5 + 0.5;
  for (const s of [-1, 1]) arm(c, r * 0.4, s * r * 0.5, r * (0.9 + peek * 0.25), s * r * 0.75, r * 0.2, zskin(e));
  circ(c, 0, 0, r * 0.95, '#7d858c', INK, 3);
  for (let i = 0; i < 3; i++) circ(c, 0, 0, r * (0.3 + i * 0.22), null, 'rgba(0,0,0,0.22)', 1.5);
  rr(c, -r * 0.2, -r * 0.1, r * 0.4, r * 0.2, 3, '#5d656c', INK, 1.5);
  for (const s of [-1, 1]) circ(c, r * 0.72, s * r * 0.25, r * 0.13, '#f4f0c8', INK, 1.2);
}

export function drawSinner(c, e, t) {
  const T = ETYPES[e.t], r = e.r;
  const a = e.fa ?? e.ang ?? 0;
  c.save();
  c.translate(e.x, e.y);
  ell(c, 3, 5, r * (e.t === 'partybus' ? 1.6 : 0.9), r * (e.t === 'partybus' ? 0.9 : 0.8), 'rgba(0,0,0,0.28)', null, 0, a);
  c.rotate(a);
  const tt = e.stunT > 0 ? 0 : t;
  if (e.camo) trashCan(c, r, tt, e); else ZOMBIE[e.t](c, r, tt, e);
  c.restore();
  if (e.flash > 0) circ(c, e.x, e.y, r * 0.9, 'rgba(255,255,255,0.55)', null);
  if (e.burnT > 0) for (let i = 0; i < 3; i++) flame(c, e.x - r * 0.5 + i * r * 0.5, e.y - r * 0.2 + Math.sin(t * 20 + i) * 2, r * 0.3, t + i);
  if (e.stunT > 0) for (let i = 0; i < 3; i++) {
    const s = t * 5 + i * TAU / 3;
    text(c, '★', e.x + Math.cos(s) * r * 0.8, e.y - r * 1.2 + Math.sin(s) * r * 0.25, 12, '#ffe066', INK);
  } else if (e.slowF < 1) text(c, '♪', e.x + r * 0.7, e.y - r * 1.2 - (t * 30 % 10), 14, '#ff7ab8', INK);
  if (T.boss) {
    const w = r * 2.2, f = Math.max(0, e.hp / e.maxHp);
    rr(c, e.x - w / 2, e.y - r * 1.7, w, 10, 4, '#300', INK, 2);
    rr(c, e.x - w / 2 + 1, e.y - r * 1.7 + 1, (w - 2) * f, 8, 3, '#ff4d3a', null);
  }
}

// Speech bubble for a zombie or a shouting bro.
export function drawBubble(c, who, shout = false) {
  if (!who.say) return;
  c.font = `15px ${FONT}`;
  const say = who.say.toUpperCase();
  const w = Math.min(280, c.measureText(say).width + 18), h = 26;
  let x = who.x - w / 2, y = who.y - who.r * 1.8 - h - (who.t && ETYPES[who.t]?.boss ? 18 : 0);
  x = Math.max(4, Math.min(W - w - 4, x)); y = Math.max(4, y);
  rr(c, x, y, w, h, 12, shout ? '#ffe066' : '#fff', INK, 2.5);
  c.beginPath(); c.moveTo(who.x - 6, y + h - 1); c.lineTo(who.x, y + h + 9); c.lineTo(who.x + 6, y + h - 1); c.fillStyle = shout ? '#ffe066' : '#fff'; c.fill();
  c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(say, x + w / 2, y + h / 2 + 1, w - 12);
}

// ---------- gym bros (top-down) ----------
// Wide shoulders, tank top, head with hair or a backwards cap. Faces +x.
function bro(c, o) {
  const skin = o.skin || BSKIN[0];
  if (o.arms) o.arms(c, skin);
  for (const s of [-1, 1]) circ(c, 1, s * 17, 8.5, skin, INK, 2.5);     // big round delts
  ell(c, -2, 0, 13, 18, o.top || '#2f7ad8', INK, 3);                   // tank top (the colour you see)
  ell(c, -9, 0, 4, 11, 'rgba(0,0,0,0.18)', null);                       // back shading
  ell(c, 3, 0, 6, 10, skin, INK, 2);                                    // neck + traps between the straps
  circ(c, 5, 0, 7.5, skin, INK, 2.5);                                   // head
  if (o.cap) {                                         // backwards cap: bill points back
    circ(c, 4.5, 0, 7.2, o.cap, INK, 2);
    rr(c, -7, -4.5, 7, 9, 3, o.cap, INK, 2);
  } else if (o.hair) { c.beginPath(); c.arc(4, 0, 6.8, Math.PI * 0.5, Math.PI * 1.5); c.closePath(); c.fillStyle = o.hair; c.fill(); }
  if (o.band) circ(c, 5, 0, 7.2, null, o.band, 3);
  if (o.shades) rr(c, 9, -5.5, 3.5, 11, 2, '#111', INK, 1);
  else frontEyes(c, 5, 7.5);
  if (o.extra) o.extra(c, skin);
}

const TOWER = {
  dumbbell(c, o) {
    const l = o.lvl, throwing = o.anim > 0, bar = l[0] >= 3;
    bro(c, { top: '#2f7ad8', cap: '#e83a2a', band: l[1] >= 2 ? '#ff3a3a' : null, skin: BSKIN[2],
      arms: (c, skin) => {
        if (bar) { arm(c, 4, -18, throwing ? 24 : 16, -14, 7, skin); arm(c, 4, 18, throwing ? 24 : 16, 14, 7, skin); dumbbell(c, throwing ? 26 : 18, 0, 46, 1.2, Math.PI / 2, '#c22'); return; }
        arm(c, 4, -18, 12, -22, 7, skin);
        arm(c, 4, 18, throwing ? 30 : 14, throwing ? 10 : 22, 7, skin);
        if (!throwing) dumbbell(c, 15, 24, 16, 0.8, 0);
        dumbbell(c, 13, -24, 16, 0.8, 0);
      } });
    if (l[1] >= 3) for (let i = 0; i < 3; i++) dumbbell(c, -18, -12 + i * 12, 14, 0.7, 0.1);
  },
  spinner(c, o) {
    const l = o.lvl, a = o.spin;
    // the kettlebell on its chain spins around the bro
    const kx = Math.cos(a) * 30, ky = Math.sin(a) * 30;
    c.save(); c.setLineDash([3, 3]); line(c, 0, 0, kx, ky, '#9aa', 2.5); c.restore();
    bro(c, { top: '#ff8a1f', hair: '#2a1a10', skin: BSKIN[0],
      arms: (c, skin) => { arm(c, 2, -16, Math.cos(a) * 16, Math.sin(a) * 16, 7, skin); arm(c, 2, 16, Math.cos(a) * 16, Math.sin(a) * 16, 7, skin); } });
    circ(c, kx, ky, 9, '#2e3138', INK, 2.5);
    c.beginPath(); c.arc(kx, ky - 7, 5, Math.PI, TAU); c.strokeStyle = '#2e3138'; c.lineWidth = 3; c.stroke();
    if (l[0] >= 2) flame(c, kx, ky - 4, 6, o.t);
    if (l[0] >= 1) for (let i = 0; i < 3; i++) plateDisc(c, -16 + i * 4, 18 - i * 3, 6);
    if (l[1] >= 3) {
      c.save(); c.setLineDash([10, 8]); c.lineDashOffset = -o.t * 60;
      circ(c, 0, 0, o.range, null, 'rgba(255,140,40,0.55)', 5); c.restore();
    }
  },
  shake(c, o) {
    const l = o.lvl, throwing = o.anim > 0;
    rr(c, -24, 10, 16, 14, 3, '#8a5a2a', INK, 2);               // crate of shakes
    for (let i = 0; i < 2; i++) circ(c, -20 + i * 8, 17, 3, '#f3e3c3', INK, 1);
    bro(c, { top: '#3aa84a', cap: l[0] >= 3 ? '#ffd21f' : '#1e2a40', skin: BSKIN[4],
      arms: (c, skin) => {
        arm(c, 4, -18, 14, -20, 7, skin);
        const hx = throwing ? 30 : 16, hy = throwing ? 6 : 20;
        arm(c, 4, 18, hx, hy, 7, skin);
        circ(c, hx + 3, hy, 6, l[0] >= 3 ? '#ff4dc8' : '#f3e3c3', INK, 2);    // shaker bottle from above
        circ(c, hx + 3, hy, 3, '#2a2a2a', null);
      } });
    if (l[1] >= 2) for (let i = 0; i < 2; i++) { circ(c, 16, -26 + i * 9, 4, '#f3e3c3', INK, 1.5); }
  },
  dj(c, o) {
    const l = o.lvl, t = o.t, big = l[1] >= 1 ? 1.35 : 1;
    rr(c, 14, -24, 16, 48, 4, '#2a2a2e');                       // DJ table in front
    for (const s of [-1, 1]) { circ(c, 22, s * 12, 7, '#111', INK, 1.5); line(c, 22, s * 12, 22 + Math.cos(t * 8) * 6, s * 12 + Math.sin(t * 8) * 6, '#ff3a8a', 2); }
    for (const s of [-1, 1]) {                                  // speakers
      rr(c, -14 * big, s * 30 - 9 * big, 18 * big, 18 * big, 3, '#222');
      circ(c, -5 * big, s * 30, 6 * big * (1 + (o.anim > 0 ? Math.sin(t * 30) * 0.1 : 0)), '#555', INK, 1.5);
    }
    const bob = Math.sin(t * 9) * 2;
    c.save(); c.translate(bob, 0);
    bro(c, { top: l[0] >= 3 ? '#e83030' : '#1a1a1a', hair: '#e0c050', skin: BSKIN[1],
      arms: (c, skin) => { arm(c, 2, -16, 18, -12, 6, skin); arm(c, 2, 16, 18, 12, 6, skin); },
      extra: () => { line(c, 3, -10, 3, 10, '#222', 3); for (const s of [-1, 1]) circ(c, 3, s * 10, 3.5, '#ff3a8a', INK, 1.5); } });
    c.restore();
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.6 + i * 0.5) % 1;
      c.globalAlpha = 1 - p;
      text(c, i ? '♫' : '♪', -10 + i * 20 + Math.sin(p * 6) * 4, -26 - p * 26, 16, '#ff7ab8', INK);
      c.globalAlpha = 1;
    }
  },
  chad(c, o) {
    const l = o.lvl, flex = o.anim > 0;
    if (l[0] >= 3) circ(c, 0, 0, 30, 'rgba(255,215,80,0.25)', 'rgba(255,215,80,0.6)', 2);
    bro(c, { top: '#f4f4f4', hair: '#f2d060', skin: BSKIN[5], shades: true,
      arms: (c, skin) => {
        if (flex) { arm(c, 2, -20, -4, -32, 8, skin); arm(c, 2, 20, -4, 32, 8, skin); }
        else { arm(c, 4, -20, 16, -24, 8, skin); arm(c, 4, 20, 18, 22, 8, skin); plateDisc(c, 22, 24, 8, l[1] >= 2 ? '#c8a040' : '#2e3138'); }
      } });
    if (l[1] >= 3) for (let i = 0; i < 3; i++) plateDisc(c, -20, -14 + i * 14, 6);
  },
  influencer(c, o) {
    const l = o.lvl, snap = o.anim > 0, ring = l[0] >= 1 ? 15 : 12;
    circ(c, -20, 0, ring, 'rgba(255,246,208,0.25)', '#fff6d0', 4);   // ring light behind her
    circ(c, -20, 0, ring + 2.5, null, INK, 1.5);
    bro(c, { top: '#ff5fa8', hair: '#f2d060', skin: BSKIN[4],
      arms: (c, skin) => {
        arm(c, 4, -18, 22, -6, 6, skin); arm(c, 4, 18, 22, 6, 6, skin);
        line(c, 22, 0, 34, 0, '#666', 3);
        rr(c, 33, -7, 6, 14, 2, '#222', INK, 1.5);
      },
      extra: () => { circ(c, -5, 0, 4, '#f2d060', INK, 1.5); } });   // ponytail
    if (l[2] >= 2) text(c, '$', -6, 22, 12, '#7dff8a', INK);
    if (l[1] >= 2) text(c, '#', -6, -22, 13, '#ff7ab8', INK);
    if (snap) { circ(c, 40, 0, 12 + o.anim * 20, 'rgba(255,255,255,0.85)', null); }
  },
  legs(c, o) {
    const l = o.lvl, sq = o.anim > 0 ? 1 + o.anim * 0.9 : 1;
    for (const s of [-1, 1]) {   // the thighs. the legendary thighs.
      ell(c, -10, s * 17 * sq, 17, 12, BSKIN[1], INK, 2.5, s * 0.35);
      ell(c, -5, s * 13 * sq, 9, 10, '#22222a', INK, 2);
    }
    bro(c, { top: '#9aa0aa', cap: '#c8202a', skin: BSKIN[1],
      arms: (c, skin) => { arm(c, 2, -18, -4, -26, 7, skin); arm(c, 2, 18, -4, 26, 7, skin); } });
    if (l[0] >= 3) for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.6; line(c, Math.cos(a) * 26, Math.sin(a) * 26, Math.cos(a) * 34, Math.sin(a) * 34 + 3, '#5a4a3a', 2); }
  },
  treadmill(c, o) {
    const l = o.lvl, t = o.t;
    rr(c, -28, -16, 50, 32, 6, '#2a2a2e');
    rr(c, -24, -12, 36, 24, 3, '#45454c', null);
    for (let i = 0; i < 5; i++) { const x = -24 + ((i * 7.2 + t * 50) % 36); line(c, x, -11, x, 11, '#6a6a72', 2); }
    rr(c, 14, -16, 9, 32, 3, '#3a3d44', INK, 1.5);
    rr(c, 15.5, -6, 6, 12, 1, l[1] >= 3 ? '#ff6a3a' : '#7dff8a', null);
    bro(c, { top: '#2fbf8a', hair: '#3a2a1a', skin: BSKIN[3],
      arms: (c, skin) => {
        arm(c, 4, -18, 14, -24, 7, skin); arm(c, 4, 18, 14, 24, 7, skin);
        circ(c, 17, 27, 6, l[0] >= 3 ? '#8a2a2a' : '#2e3138', INK, 2);
      } });
  },
  store(c, o) {
    const l = o.lvl;
    rr(c, -28, -26, 56, 52, 6, '#e8e4dc');                       // roof from above
    for (let i = 0; i < 4; i++) rr(c, -28 + i * 14, -26, 7, 52, 0, '#3aa84a', null);
    rr(c, -28, -26, 56, 52, 6, null, INK, 3);
    rr(c, -16, -10, 32, 20, 4, '#16120f');
    text(c, 'SUPPS', 0, 1, 11, '#7dff8a', null);
    for (const [x, y, col] of [[-22, 20, '#e83030'], [-12, 22, '#2f7ad8'], [18, 20, '#ffd21f']]) { circ(c, x, y, 6, col, INK, 2); circ(c, x, y, 3, null, 'rgba(255,255,255,0.5)', 1.5); }
    if (l[1] >= 2) { circ(c, 22, -20, 6, 'rgba(200,240,255,0.7)', INK, 1.5); text(c, '$', 22, -19, 9, '#2b6b22', null); }
    if (l[0] >= 3) text(c, '★', -20, -18, 18, '#ffe066', INK);
  },
};

export const PATH_COLS = ['#ffd34d', '#6fd3ff', '#ff7ab8'];

export function drawTower(c, key, x, y, o) {
  const lvl = o.lvl || [0, 0, 0];
  const top = Math.max(...lvl), topP = lvl.indexOf(top), t = o.t || 0;
  c.save();
  c.translate(x, y);
  if (o.scale) c.scale(o.scale, o.scale);
  if (!o.icon) {
    rr(c, -24, -24, 48, 48, 8, 'rgba(20,20,24,0.55)', null);    // rubber gym tile under every bro
    ell(c, 3, 5, 22, 22, 'rgba(0,0,0,0.25)', null);
  }
  if (top >= 4) {   // tier 4+: glowing aura in the path's colour
    const col = PATH_COLS[topP], pulse = 1 + Math.sin(t * 4) * 0.06;
    c.globalAlpha = 0.35; circ(c, 0, 0, 31 * pulse, col, null); c.globalAlpha = 1;
    circ(c, 0, 0, 31 * pulse, null, col, 2.5);
  }
  if (top >= 5) c.scale(1.12, 1.12);
  const rot = ['dumbbell', 'chad', 'shake'].includes(key) ? (o.ang ?? Math.PI / 2) : key === 'spinner' ? 0 : Math.PI / 2;
  c.rotate(rot);
  TOWER[key](c, { anim: 0, spin: 0, range: 100, ...o, lvl, t });
  if (top >= 5) {   // tier 5: gold chain
    c.beginPath(); c.arc(4, 0, 11, -1.1, 1.1); c.strokeStyle = INK; c.lineWidth = 5; c.stroke();
    c.strokeStyle = '#ffd21f'; c.lineWidth = 3; c.stroke();
    circ(c, 15, 0, 3.5, '#ffd21f', INK, 1.5);
    if (Math.sin(t * 3) > 0.6) text(c, '✦', 12, -14, 10, '#fff6a0', null);
  }
  c.restore();
  if (!o.icon && top) {   // pips: a row of dots for each trained path
    let row = 0;
    for (let p = 0; p < 3; p++) {
      if (!lvl[p]) continue;
      for (let i = 0; i < lvl[p]; i++) circ(c, x - (lvl[p] - 1) * 4.5 + i * 9, y + TOWERS[key].r + 8 + row * 8, 3.2, PATH_COLS[p], INK, 1.2);
      row++;
    }
  }
}

// ---------- road items (treadmills, kettlebells, puddles) ----------
export function drawTrap(c, tr, t) {
  c.globalAlpha = Math.min(1, tr.life * 2);
  if (tr.k === 'kb') {
    ell(c, tr.x + 2, tr.y + 3, 9, 7, 'rgba(0,0,0,0.3)', null);
    circ(c, tr.x, tr.y, tr.blast ? 9 : 8, tr.blast ? '#8a2a2a' : '#2e3138', INK, 2);
    c.beginPath(); c.arc(tr.x, tr.y - 6, 5, Math.PI, Math.PI * 2); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    if (tr.blast) circ(c, tr.x, tr.y, 2.5, Math.sin(t * 12) > 0 ? '#ff4d3a' : '#ffd21f', null);
  } else if (tr.k === 'tm') {
    c.save(); c.translate(tr.x, tr.y); c.rotate(tr.ang);
    rr(c, -26, -15, 52, 30, 6, '#2a2a2e');
    rr(c, -22, -11, 40, 22, 3, '#45454c', null);
    const dir = tr.slow < 0 ? -1 : 1, sp = tr.slow < 0 ? 90 : 35;
    for (let i = 0; i < 5; i++) {
      const x = -22 + (((i * 8 - dir * t * sp) % 40) + 40) % 40;
      line(c, x, -10, x, 10, tr.slow < 0 ? '#ff6a3a' : '#6a6a72', 2);
    }
    rr(c, 18, -14, 7, 28, 3, '#3a3d44', INK, 1.5);
    rr(c, 19, -6, 5, 12, 1, '#7dff8a', null);
    c.restore();
  } else {
    const f = 1 + Math.sin(t * 3 + tr.x) * 0.04;
    ell(c, tr.x, tr.y, tr.r * f, tr.r * 0.75 * f, 'rgba(140,220,60,0.55)', 'rgba(60,120,20,0.8)', 2);
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.8 + i / 3 + tr.x * 0.01) % 1;
      circ(c, tr.x + Math.sin(i * 2.3) * tr.r * 0.5, tr.y + Math.cos(i * 1.7) * tr.r * 0.35, 2 + p * 4, `rgba(200,255,120,${1 - p})`, null);
    }
  }
  c.globalAlpha = 1;
}

// ---------- projectiles ----------
function trail(c, p, col, w) {
  const tr = p.trail;
  if (!tr || tr.length < 4) return;
  for (let i = 2; i < tr.length; i += 2) {
    c.globalAlpha = (i / tr.length) * 0.5;
    line(c, tr[i - 2], tr[i - 1], tr[i], tr[i + 1] ?? p.y, col, w * (i / tr.length));
  }
  c.globalAlpha = 1;
  line(c, tr[tr.length - 2], tr[tr.length - 1], p.x, p.y, col, w);
}

export function drawProj(c, p, t) {
  if (p.k === 'dumbbell') {
    trail(c, p, 'rgba(255,255,255,0.8)', 5);
    const s = p.big ? 1.6 : 1;
    dumbbell(c, p.x, p.y, (p.big ? 30 : 18), s * 0.9, p.age * 18, p.big ? '#c22' : '#3a3d44');
  } else if (p.k === 'plate') {
    trail(c, p, p.burn ? 'rgba(255,150,40,0.9)' : 'rgba(255,255,255,0.7)', 4);
    plateDisc(c, p.x, p.y, 6.5);
    if (p.burn) flame(c, p.x, p.y - 2, 5, t);
  } else if (p.k === 'frisbee') {
    trail(c, p, 'rgba(255,225,120,0.95)', 7);
    c.save(); c.translate(p.x, p.y); c.scale(1, 0.85); plateDisc(c, 0, 0, 9, '#c8a040'); c.restore();
  } else if (p.k === 'shake') {
    // shadow on the ground, bottle up in the air
    ell(c, p.x, p.y, 8, 5, 'rgba(0,0,0,0.3)', null);
    const s = 1 + p.h * 0.7, by = p.y - p.h * 46;
    c.save(); c.translate(p.x, by); c.rotate(p.tt * 14); c.scale(s, s);
    rr(c, -5, -8, 10, 16, 3, '#f3e3c3', INK, 2);
    rr(c, -5, -8, 10, 5, 2, '#2a2a2a', null);
    c.restore();
  }
}

// ---------- background ----------
function car(c, x, y, w, h, col, burnt) {
  rr(c, x, y, w, h, h * 0.3, burnt ? '#2a2522' : col, INK, 3);
  rr(c, x + w * 0.28, y + h * 0.15, w * 0.42, h * 0.7, 6, burnt ? '#1a1614' : 'rgba(255,255,255,0.2)', INK, 2);
  rr(c, x + w * 0.68, y + h * 0.12, w * 0.14, h * 0.76, 4, burnt ? '#111' : '#9fd8ff', INK, 2);
  rr(c, x + w * 0.16, y + h * 0.15, w * 0.1, h * 0.7, 3, burnt ? '#111' : '#9fd8ff', INK, 2);
}

function drawBlocker(c, b) {
  switch (b.kind) {
    case 'sign': {
      rr(c, b.x, b.y, b.w, b.h, 10, '#16120f', INK, 4);
      rr(c, b.x + 6, b.y + 6, b.w - 12, b.h - 12, 7, null, '#e0b030', 2);
      text(c, 'IRON PARADISE GYM', b.x + b.w / 2, b.y + 30, 28, '#ffd21f', INK);
      text(c, 'Open 24/7. Even in the apocalypse.', b.x + b.w / 2, b.y + 60, 15, '#f3ead2', null);
      break;
    }
    case 'car': car(c, b.x, b.y, b.w, b.h, b.col); break;
    case 'tree': {
      circ(c, b.cx + 4, b.cy + 6, b.r, 'rgba(0,0,0,0.25)', null);
      circ(c, b.cx, b.cy, b.r, '#3f7a2e', INK, 3);
      for (let i = 0; i < 5; i++) { const a = i * 1.3; circ(c, b.cx + Math.cos(a) * b.r * 0.45, b.cy + Math.sin(a) * b.r * 0.45, b.r * 0.42, '#4f8f36', null); }
      circ(c, b.cx - b.r * 0.2, b.cy - b.r * 0.25, b.r * 0.3, '#66a845', null);
      break;
    }
    case 'dumpster': {
      rr(c, b.x, b.y, b.w, b.h, 6, '#2f6a3a', INK, 3);
      line(c, b.x + b.w / 2, b.y + 4, b.x + b.w / 2, b.y + b.h - 4, INK, 3);
      for (const k of [0.25, 0.75]) rr(c, b.x + b.w * k - 14, b.y + b.h / 2 - 4, 28, 8, 3, '#255530', INK, 1.5);
      text(c, 'DUMPSTER', b.x + b.w / 2, b.y - 10, 12, '#f3ead2', INK);
      break;
    }
    case 'hydrant': {
      circ(c, b.cx, b.cy, b.r * 0.75, '#d22', INK, 3);
      circ(c, b.cx, b.cy, b.r * 0.35, '#ff6a5a', INK, 2);
      for (const s of [-1, 1]) rr(c, b.cx + s * b.r * 0.75 - 4, b.cy - 4, 8, 8, 2, '#a11', INK, 1.5);
      break;
    }
    case 'manhole': {
      circ(c, b.cx, b.cy, b.r, '#555a60', INK, 3);
      for (let i = -2; i <= 2; i++) line(c, b.cx - b.r * 0.7, b.cy + i * b.r * 0.28, b.cx + b.r * 0.7, b.cy + i * b.r * 0.28, '#3f4348', 2);
      c.globalAlpha = 0.5; text(c, '!', b.cx, b.cy, 16, '#7dff8a', null); c.globalAlpha = 1;
      break;
    }
    case 'wreck': {
      const g = c.createRadialGradient(b.cx, b.cy, b.r * 0.1, b.cx, b.cy, b.r);
      g.addColorStop(0, '#1a1210'); g.addColorStop(0.7, '#2e2520'); g.addColorStop(1, 'rgba(40,30,25,0)');
      c.fillStyle = g; c.beginPath(); c.arc(b.cx, b.cy, b.r, 0, TAU); c.fill();
      car(c, b.cx - b.r * 0.45, b.cy - b.r * 0.22, b.r * 0.9, b.r * 0.44, '#333', true);
      break;
    }
    case 'pumps': {
      rr(c, b.x, b.y, b.w, b.h, 10, '#c9c9c4', INK, 3);
      for (const k of [0.25, 0.75]) { rr(c, b.x + b.w * k - 18, b.y + 14, 36, b.h - 28, 5, '#d22', INK, 2); rr(c, b.x + b.w * k - 10, b.y + 20, 20, 12, 2, '#9fe8a0', INK, 1.5); }
      text(c, 'GAS', b.x + b.w / 2, b.y - 10, 13, '#f3ead2', INK);
      break;
    }
  }
}

export function makeBackground(map, path, scale) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  const c = cv.getContext('2d');
  c.scale(scale, scale);
  const T = 64;
  for (let y = 0; y < H; y += T) for (let x = 0; x < W; x += T) {
    c.fillStyle = ((x + y) / T) % 2 ? map.floor[0] : map.floor[1];
    c.fillRect(x, y, T, T);
  }
  let seed = map.id.length * 99;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (map.id === 'gas') {     // concrete slabs with oil stains
    c.strokeStyle = 'rgba(0,0,0,0.15)'; c.lineWidth = 2;
    for (let x = 0; x < W; x += 128) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 128) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let i = 0; i < 14; i++) ell(c, rnd() * W, rnd() * H, 10 + rnd() * 26, 6 + rnd() * 14, 'rgba(20,20,30,0.25)', null);
  } else {                    // grass tufts
    for (let i = 0; i < 120; i++) {
      const x = rnd() * W, y = rnd() * H;
      c.strokeStyle = 'rgba(30,60,20,0.35)'; c.lineWidth = 2; c.beginPath();
      c.moveTo(x, y); c.lineTo(x - 3, y - 7); c.moveTo(x, y); c.lineTo(x + 3, y - 7); c.stroke();
    }
  }
  // road: sidewalk, curb, asphalt, centre line
  const stroke = (w, col, dash) => {
    c.save(); if (dash) c.setLineDash(dash);
    c.beginPath();
    map.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.lineJoin = 'round'; c.lineCap = dash ? 'butt' : 'round'; c.lineWidth = w; c.strokeStyle = col; c.stroke();
    c.restore();
  };
  stroke(LANE * 2 + 34, 'rgba(0,0,0,0.25)');
  stroke(LANE * 2 + 28, '#b8b5ab');
  stroke(LANE * 2 + 8, '#d8d4c8');
  stroke(LANE * 2, '#3b3d42');
  stroke(3, '#e8c440', [22, 18]);
  // cracks and skid marks on the asphalt
  for (let i = 0; i < 30; i++) {
    const d = rnd() * path.len, k = Math.min(path.n - 1, Math.floor(d / 2));
    const x = path.px[k] + (rnd() - 0.5) * LANE, y = path.py[k] + (rnd() - 0.5) * LANE;
    line(c, x, y, x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 16, 'rgba(0,0,0,0.35)', 1.5);
  }
  for (const b of map.blockers) drawBlocker(c, b);
  // graveyard gate on the left edge
  const [, sy] = map.pts[0];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const gx = 14 + i * 26, gy = sy + s * (LANE + 40 + i * 14);
      rr(c, gx - 10, gy - 8, 20, 16, 6, '#9a9a94', INK, 2.5);
      text(c, 'RIP', gx, gy, 7, '#555', null);
    }
    rr(c, -4, sy + s * (LANE + 10) - 7, 22, 14, 3, '#2a2a2a', INK, 2.5);
  }
  text(c, 'GRAVEYARD', 64, sy - LANE - 70, 15, '#c9e8a8', INK);
  // the gym doors on the right edge
  const [, ey] = map.pts[map.pts.length - 1];
  rr(c, W - 70, ey - LANE - 50, 90, LANE * 2 + 100, 6, '#2a2a30', INK, 4);
  rr(c, W - 70, ey - LANE - 4, 14, LANE * 2 + 8, 2, '#9fd8ff', INK, 2);
  text(c, 'GYM', W - 30, ey - LANE - 30, 20, '#ffd21f', INK);
  text(c, '→', W - 30, ey + LANE + 28, 22, '#ffd21f', INK);
  return cv;
}

// ---------- effects ----------
const POWS = ['BONK!', 'POW!', 'SMACK!', 'WHAM!', 'GAINS!'];

export class FX {
  constructor() { this.parts = []; this.shake = 0; }
  add(p) { if (this.parts.length < 450) this.parts.push(p); }
  text(x, y, s, col, size = 18, life = 0.9, vy = -40) { this.add({ k: 'txt', x, y, s, col, size, life, max: life, vy }); }
  event(ev) {
    switch (ev.k) {
      case 'pop': {
        for (let i = 0; i < (ev.boss ? 18 : 4); i++) {
          const a = Math.random() * TAU, s = 40 + Math.random() * 80;
          this.add({ k: 'puff', x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: ev.boss ? 14 : 6, col: i % 2 ? '#a8c890' : '#e8e8d8', life: 0.4, max: 0.4 });
        }
        if (ev.boss) { this.shake = Math.max(this.shake, 14); this.text(ev.x, ev.y - 30, 'K.O.!', '#ffe066', 46, 1.6, -30); }
        break;
      }
      case 'decal':
        if (Math.random() < (ev.big ? 0.5 : 0.12)) this.text(ev.x + (Math.random() - 0.5) * 20, ev.y - 18, POWS[(Math.random() * POWS.length) | 0], '#fff36a', ev.big ? 22 : 16, 0.5, -50);
        break;
      case 'clang': if (Math.random() < 0.35) this.text(ev.x, ev.y - 20, 'BLOCKED', '#cfd6e0', 14, 0.5, -60); break;
      case 'boom':
        this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#f3e3c3', life: 0.35, max: 0.35 });
        for (let i = 0; i < 8; i++) { const a = Math.random() * TAU, s = 30 + Math.random() * 70; this.add({ k: 'puff', x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 9, col: i % 2 ? '#f3e3c3' : '#d9b98a', life: 0.45, max: 0.45 }); }
        if (ev.shake) this.shake = Math.max(this.shake, 8);
        break;
      case 'ring': if (Math.random() < 0.3) this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#ff6a1a', life: 0.25, max: 0.25 }); break;
      case 'hold': this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#ff7ab8', life: 0.5, max: 0.5 }); this.text(ev.x, ev.y - 40, 'DROP THE BEAT', '#ff9ad0', 16); break;
      case 'press1': this.text(ev.x, ev.y - 40, 'WRONG WAY!', '#ff9ad0', 16); break;
      case 'income': this.text(ev.x, ev.y - 40, '+$$$', '#7dff8a', 22, 1.3); break;
      case 'leak': this.text(W - 120, ev.y || 200, `-${ev.n}`, '#ff6a5a', 22, 1); break;
      case 'place': case 'upgrade':
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; this.add({ k: 'puff', x: ev.x, y: ev.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, r: 6, col: ev.k === 'upgrade' ? '#ffe066' : '#d8d4c8', life: 0.4, max: 0.4 }); }
        if (ev.k === 'upgrade') this.text(ev.x, ev.y - 34, 'GAINS!', '#ffe066', 20, 1);
        break;
      case 'sell': this.text(ev.x, ev.y - 20, `+$${ev.v}`, '#7dff8a', 22, 1.2); break;
      case 'flash':
        this.add({ k: 'flashb', x: ev.x, y: ev.y, r: ev.r, life: 0.25, max: 0.25 });
        if (Math.random() < 0.3) this.text(ev.x, ev.y - 36, 'SNAP!', '#fff', 16, 0.6);
        break;
      case 'stomp':
        this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#c8a070', life: 0.35, max: 0.35 });
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; this.add({ k: 'puff', x: ev.x + Math.cos(a) * 20, y: ev.y + Math.sin(a) * 20, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, r: 7, col: '#b8a080', life: 0.35, max: 0.35 }); }
        if (ev.shake) this.shake = Math.max(this.shake, 5);
        break;
      case 'smash':
        this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.big ? 70 : 30, col: '#ffd34d', life: 0.4, max: 0.4 });
        this.text(ev.x, ev.y - 30, ev.big ? 'METEOR!' : 'SLAM!', '#ffd34d', ev.big ? 30 : 22, 0.8);
        this.shake = Math.max(this.shake, ev.big ? 12 : 6);
        break;
      case 'rizz':
        this.add({ k: 'tint', col: 'rgba(255,90,180,', life: 0.7, max: 0.7 });
        this.text(ev.x, ev.y - 40, 'UNSPOKEN RIZZ', '#ff7ab8', 26, 1.4, -20);
        break;
      case 'reveal': this.text(ev.x, ev.y - 24, 'EXPOSED', '#ff7ab8', 15, 0.8); break;
      case 'pull': this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#a04dff', life: 0.5, max: 0.5 }); break;
      case 'drop': this.add({ k: 'puff', x: ev.x, y: ev.y, vx: 0, vy: -20, r: 8, col: '#d8d4c8', life: 0.3, max: 0.3 }); break;
    }
  }
  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      if (p.vx != null) { p.x += p.vx * dt; p.vx *= 0.92; }
      if (p.vy != null) { p.y += p.vy * dt; if (p.k === 'puff') p.vy *= 0.92; }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    this.shake = Math.max(0, this.shake - dt * 40);
  }
  drawOver(c) {
    for (const p of this.parts) {
      const f = p.life / p.max;
      c.globalAlpha = Math.min(1, f * 1.5);
      if (p.k === 'tint') { c.fillStyle = p.col + (f * 0.3) + ')'; c.fillRect(0, 0, W, H); }
      else if (p.k === 'flashb') circ(c, p.x, p.y, p.r * (1.15 - f * 0.25), `rgba(255,255,255,${f * 0.55})`, null);
      else if (p.k === 'puff') circ(c, p.x, p.y, p.r * (1.6 - f * 0.6), p.col, null);
      else if (p.k === 'ring') circ(c, p.x, p.y, p.r * (1.1 - f * 0.3), null, p.col, 5 * f + 1);
      else if (p.k === 'txt') text(c, p.s, p.x, p.y, p.size, p.col, INK);
    }
    c.globalAlpha = 1;
  }
}

// ---------- full frame ----------
export function drawWorld(c, game, bg, fx, t, ui) {
  c.drawImage(bg, 0, 0, W, H);
  // burning wrecks
  for (const b of game.map.blockers) if (b.kind === 'wreck') {
    for (let i = 0; i < 4; i++) flame(c, b.cx - b.r * 0.35 + i * b.r * 0.22, b.cy - b.r * 0.05 + Math.sin(i * 2.3) * 8, 7 + (i % 2) * 4, t + i * 0.7);
    const p = (t * 0.35 + b.cx * 0.01) % 1;
    circ(c, b.cx + Math.sin(p * 5) * 10, b.cy - 20 - p * 60, 10 + p * 18, `rgba(60,60,60,${(1 - p) * 0.45})`, null);
  }
  if (game.map.id === 'street') text(c, `WAVE  ${game.round + 1}`, 765, 126, 14, '#7dff8a', INK);
  for (const tr of game.traps) drawTrap(c, tr, t);
  if (ui.sel) rangeCircle(c, ui.sel.x, ui.sel.y, (ui.sel.es || ui.sel.s).range, true);
  // depth sort bros and zombies together
  const items = [];
  for (const tw of game.towers) items.push({ y: tw.y, tw });
  for (const e of game.enemies) items.push({ y: e.y, e });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.e) drawSinner(c, it.e, t);
    else {
      const tw = it.tw;
      if (tw === ui.sel) circ(c, tw.x, tw.y, tw.r + 8, null, '#ffe066', 3);
      drawTower(c, tw.key, tw.x, tw.y, { ang: tw.ang, lvl: tw.lvl, anim: tw.anim, spin: tw.spin, t, range: tw.s.range });
    }
  }
  for (const p of game.projs) drawProj(c, p, t);
  fx.drawOver(c);
  for (const e of game.enemies) drawBubble(c, e);
  for (const tw of game.towers) drawBubble(c, tw, true);
  if (ui.ghost) {
    const g = ui.ghost;
    rangeCircle(c, g.x, g.y, TOWERS[g.key].base.range || 0, g.ok);
    c.globalAlpha = 0.8;
    drawTower(c, g.key, g.x, g.y, { lvl: [0, 0], t });
    c.globalAlpha = 1;
    if (!g.ok) text(c, '✕', g.x, g.y - 44, 26, '#ff4d3a', INK);
  }
  const boss = game.enemies.find(e => ETYPES[e.t].boss);
  if (boss) {
    const w = 460, x = W / 2 - w / 2, y = 14;
    rr(c, x, y, w, 24, 8, '#300', INK, 3);
    rr(c, x + 2, y + 2, (w - 4) * Math.max(0, boss.hp / boss.maxHp), 20, 6, '#ff4d3a', null);
    text(c, ETYPES[boss.t].name, W / 2, y + 13, 15, '#fff', INK);
  }
}

function rangeCircle(c, x, y, r, ok) {
  if (!r || r > 2000) return;
  circ(c, x, y, r, ok ? 'rgba(255,255,255,0.13)' : 'rgba(255,40,40,0.2)', ok ? 'rgba(255,255,255,0.6)' : 'rgba(255,60,60,0.8)', 2);
}
