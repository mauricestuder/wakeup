// All the cartoon drawing: map, sinners, towers, projectiles and effects.
// Everything is drawn with Canvas 2D paths in world units (1280 x 900).

import { W, H, LANE } from './maps.js';
import { ETYPES } from './enemies.js';
import { TOWERS } from './towers.js';

export const INK = '#1b0b0d';
export const FONT = "'Luckiest Guy', 'Arial Black', Impact, sans-serif";
const TAU = Math.PI * 2;
const SKINS = ['#f2c7a0', '#d9a273', '#a86b43', '#6e4127', '#f6d9bd', '#c58c5c'];

// ---------- tiny helpers ----------
function circ(c, x, y, r, fill, stroke = INK, lw = 3) {
  c.beginPath(); c.arc(x, y, r, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function ell(c, x, y, rx, ry, fill, stroke = INK, lw = 3) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
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
function eyes(c, x, y, s, look = 0.3, mood = 0) {
  for (const ox of [-s * 1.05, s * 1.05]) {
    circ(c, x + ox, y, s, '#fff', INK, Math.max(1.5, s * 0.35));
    circ(c, x + ox + look * s * 0.45, y + s * 0.15, s * 0.5, INK, null);
  }
  if (mood) {   // 1 angry, -1 sad
    c.lineWidth = Math.max(2, s * 0.4); c.strokeStyle = INK; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - s * 2, y - s * (1.3 + 0.5 * mood)); c.lineTo(x - s * 0.4, y - s * (1.3 - 0.5 * mood));
    c.moveTo(x + s * 2, y - s * (1.3 + 0.5 * mood)); c.lineTo(x + s * 0.4, y - s * (1.3 - 0.5 * mood));
    c.stroke();
  }
}
function mouth(c, x, y, w, kind) {
  c.lineWidth = 2.2; c.strokeStyle = INK; c.lineCap = 'round'; c.beginPath();
  if (kind === 'smile') c.arc(x, y - w * 0.4, w, 0.2 * Math.PI, 0.8 * Math.PI);
  else if (kind === 'frown') c.arc(x, y + w * 0.6, w, 1.2 * Math.PI, 1.8 * Math.PI);
  else if (kind === 'o') { c.arc(x, y, w * 0.45, 0, TAU); c.fillStyle = INK; c.fill(); }
  else { c.moveTo(x - w, y); c.lineTo(x + w, y); }
  c.stroke();
}

// A generic little person. Origin = body centre. Faces +x.
function person(c, r, o) {
  // legs
  c.lineCap = 'round';
  for (const lx of [-0.22, 0.22]) {
    line(c, r * lx, r * 0.45, r * lx * 1.2, r * 0.9, INK, r * 0.34);
    line(c, r * lx, r * 0.45, r * lx * 1.2, r * 0.9, o.pants || '#2b2b38', r * 0.18);
  }
  // body
  rr(c, -r * 0.55, -r * 0.3, r * 1.1, r * 0.95, r * 0.38, o.shirt);
  if (o.body) o.body(c, r);
  // head
  circ(c, 0, -r * 0.72, r * 0.52, o.skin);
  if (o.hair) o.hair(c, r);
  eyes(c, r * 0.12, -r * 0.78, r * 0.17, 0.6, o.mood || 0);
  mouth(c, r * 0.16, -r * 0.48, r * 0.16, o.mouth || 'flat');
  if (o.extra) o.extra(c, r);
}

const skinOf = e => SKINS[Math.floor(e.seed * 10) % SKINS.length];

// ---------- sinners ----------
const SINNER = {
  soul(c, r, t, e) {
    c.globalAlpha = 0.85;
    c.beginPath();
    c.moveTo(0, -r * 1.15);
    c.bezierCurveTo(r * 1.1, -r * 0.9, r * 0.95, r * 0.3, r * 0.5, r * 0.6);
    const w = Math.sin(t * 8 + e.seed) * r * 0.2;
    c.quadraticCurveTo(r * 0.2 + w, r * 1.0, 0, r * 0.75);
    c.quadraticCurveTo(-r * 0.3 - w, r * 1.05, -r * 0.5, r * 0.6);
    c.bezierCurveTo(-r * 0.95, r * 0.3, -r * 1.1, -r * 0.9, 0, -r * 1.15);
    c.fillStyle = '#c9e8ff'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    c.globalAlpha = 1;
    eyes(c, 0, -r * 0.25, r * 0.22, 0.3, -1);
    mouth(c, 0, r * 0.25, r * 0.18, 'o');
  },
  cart(c, r, t, e) {
    person(c, r, { skin: skinOf(e), shirt: '#5d7a54', pants: '#3a3a52', mood: 0, mouth: 'flat',
      hair: (c, r) => { c.beginPath(); c.arc(0, -r * 0.8, r * 0.55, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(0, -r * 0.6); c.closePath(); c.fillStyle = '#5d7a54'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); } });
    // cart
    const x0 = r * 0.55, y0 = -r * 0.15;
    line(c, r * 0.3, -r * 0.05, x0 + r * 0.05, y0, '#9aa3ad', 3);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + r * 1.3, y0); c.lineTo(x0 + r * 1.15, y0 + r * 0.7); c.lineTo(x0 + r * 0.15, y0 + r * 0.7); c.closePath();
    c.fillStyle = 'rgba(200,210,220,0.35)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#3b4148'; c.stroke();
    for (let i = 1; i < 4; i++) line(c, x0 + r * 0.32 * i, y0, x0 + r * 0.06 + r * 0.28 * i, y0 + r * 0.7, '#3b4148', 1.5);
    circ(c, x0 + r * 0.3, y0 + r * 0.92, r * 0.13, '#222', INK, 1.5);
    circ(c, x0 + r * 1.0, y0 + r * 0.92, r * 0.13, '#222', INK, 1.5);
  },
  infl(c, r, t, e) {
    person(c, r, { skin: skinOf(e), shirt: '#ff5fa8', pants: '#f4f0f6', mouth: 'smile',
      hair: (c, r) => { c.beginPath(); c.arc(0, -r * 0.78, r * 0.6, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(-r * 0.6, -r * 0.2); c.closePath(); c.fillStyle = '#ffd35c'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); },
      extra: (c, r) => {
        rr(c, -r * 0.2, -r * 0.92, r * 0.75, r * 0.25, 4, '#111', INK, 1.5); // shades
        line(c, r * 0.4, -r * 0.05, r * 1.0, -r * 1.55, '#555', 3);
        rr(c, r * 0.85, -r * 1.95, r * 0.36, r * 0.55, 3, '#222', INK, 2);
        circ(c, r * 1.03, -r * 1.75, r * 0.08, '#8ef', null);
      } });
  },
  lawyer(c, r, t, e) {
    person(c, r, { skin: skinOf(e), shirt: '#5b6170', pants: '#3e434f', mouth: 'smile', mood: 1,
      body: (c, r) => {
        c.beginPath(); c.moveTo(-r * 0.2, -r * 0.3); c.lineTo(0, r * 0.05); c.lineTo(r * 0.2, -r * 0.3); c.closePath(); c.fillStyle = '#fff'; c.fill();
        c.beginPath(); c.moveTo(-r * 0.07, -r * 0.25); c.lineTo(r * 0.07, -r * 0.25); c.lineTo(r * 0.04, r * 0.15); c.lineTo(-r * 0.04, r * 0.15); c.closePath(); c.fillStyle = '#d22'; c.fill();
      },
      hair: (c, r) => { c.beginPath(); c.arc(0, -r * 0.8, r * 0.53, Math.PI * 1.0, Math.PI * 2.0); c.closePath(); c.fillStyle = '#222'; c.fill(); },
      extra: (c, r) => { rr(c, r * 0.45, r * 0.15, r * 0.65, r * 0.45, 3, '#7a4a22', INK, 2); line(c, r * 0.65, r * 0.15, r * 0.9, r * 0.15, INK, 3); } });
  },
  ceo(c, r, t, e) {
    person(c, r, { skin: skinOf(e), shirt: '#e3b437', pants: '#b88a1c', mouth: 'smile', mood: 1,
      hair: (c, r) => { rr(c, -r * 0.42, -r * 1.75, r * 0.84, r * 0.75, 3, '#141414', INK, 2); rr(c, -r * 0.62, -r * 1.08, r * 1.24, r * 0.16, 3, '#141414', INK, 2); line(c, -r * 0.4, -r * 1.2, r * 0.4, -r * 1.2, '#c22', 3); },
      extra: (c, r) => {
        circ(c, r * 0.3, -r * 0.78, r * 0.2, null, '#e8c34a', 2);
        circ(c, r * 0.8, r * 0.3, r * 0.38, '#cfa55a', INK, 2);
        text(c, '$', r * 0.8, r * 0.33, r * 0.5, '#2b6b22', null);
      } });
  },
  mime(c, r, t, e) {
    person(c, r, { skin: '#fbfbfb', shirt: '#fff', pants: '#111', mouth: 'o', mood: -1,
      body: (c, r) => { for (let i = 0; i < 3; i++) rr(c, -r * 0.52, -r * 0.15 + i * r * 0.27, r * 1.04, r * 0.12, 2, '#111', null); },
      hair: (c, r) => { ell(c, -r * 0.05, -r * 1.18, r * 0.55, r * 0.18, '#111', INK, 2); circ(c, -r * 0.05, -r * 1.35, r * 0.07, '#111', null); },
      extra: (c, r) => {
        const s = Math.sin(t * 6 + e.seed) * r * 0.08;
        circ(c, r * 0.75, -r * 0.55 + s, r * 0.17, '#fff', INK, 2);
        circ(c, r * 0.75, r * 0.1 - s, r * 0.17, '#fff', INK, 2);
        line(c, r * 0.95, -r * 0.8, r * 0.95, r * 0.35, 'rgba(255,255,255,0.5)', 2); // invisible wall
      } });
  },
  complainer(c, r, t, e) {
    person(c, r, { skin: skinOf(e), shirt: '#7c4fa3', pants: '#3a2a4f', mouth: 'o', mood: 1,
      hair: (c, r) => {
        c.beginPath(); c.moveTo(-r * 0.7, -r * 0.35); c.quadraticCurveTo(-r * 0.75, -r * 1.45, r * 0.2, -r * 1.3);
        c.quadraticCurveTo(r * 0.75, -r * 1.25, r * 0.6, -r * 0.95); c.lineTo(-r * 0.1, -r * 0.95); c.quadraticCurveTo(-r * 0.25, -r * 0.6, -r * 0.3, -r * 0.35); c.closePath();
        c.fillStyle = '#d8b36a'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
      },
      extra: (c, r) => {
        rr(c, r * 0.3, -r * 0.55, r * 0.95, r * 1.2, 4, '#f4f1e6', INK, 2.5);
        text(c, '1★', r * 0.78, -r * 0.25, r * 0.38, '#d22', null);
        for (let i = 0; i < 3; i++) line(c, r * 0.45, r * 0.05 + i * r * 0.17, r * 1.1, r * 0.05 + i * r * 0.17, '#999', 1.5);
        line(c, r * 0.4, r * 0.55, r * 1.15, -r * 0.45, 'rgba(255,255,255,0.7)', 2);
      } });
  },
  bus(c, r, t, e) {
    const L = r * 1.45;
    rr(c, -L, -r * 0.75, L * 2, r * 1.2, r * 0.25, '#d8322d');
    rr(c, L - r * 0.45, -r * 0.6, r * 0.35, r * 0.55, 4, '#bfe8ff', INK, 2);
    for (let i = 0; i < 4; i++) {
      const wx = -L + r * 0.2 + i * r * 0.6;
      rr(c, wx, -r * 0.6, r * 0.48, r * 0.45, 4, '#bfe8ff', INK, 2);
      circ(c, wx + r * 0.24, -r * 0.3, r * 0.14, SKINS[(i + Math.floor(e.seed * 5)) % SKINS.length], INK, 1.5);
    }
    text(c, 'HELL TOURS', -r * 0.15, r * 0.2, r * 0.32, '#ffe066', INK);
    circ(c, -L + r * 0.55, r * 0.5, r * 0.25, '#222', INK, 2);
    circ(c, L - r * 0.55, r * 0.5, r * 0.25, '#222', INK, 2);
  },
  replyall(c, r, t, e) {
    person(c, r, { skin: skinOf(e), shirt: '#4b7bd1', pants: '#2c3c66', mouth: 'smile',
      hair: (c, r) => { c.beginPath(); c.arc(0, -r * 0.82, r * 0.5, Math.PI * 1.1, Math.PI * 1.9); c.closePath(); c.fillStyle = '#6b4a2a'; c.fill(); },
      extra: (c, r) => {
        rr(c, r * 0.2, -r * 0.15, r * 0.85, r * 0.55, 4, '#aab', INK, 2);
        rr(c, r * 0.28, -r * 0.08, r * 0.69, r * 0.38, 2, '#9df', null);
        circ(c, -r * 0.4, -r * 0.95, r * 0.08, '#8cf', null); // sweat
      } });
    for (let i = 0; i < 4; i++) {
      const a = t * 1.8 + i * TAU / 4, ex = Math.cos(a) * r * 1.35, ey = Math.sin(a) * r * 0.7 - r * 0.2;
      rr(c, ex - 9, ey - 6, 18, 12, 2, '#fff', INK, 2);
      c.beginPath(); c.moveTo(ex - 9, ey - 6); c.lineTo(ex, ey + 1); c.lineTo(ex + 9, ey - 6); c.stroke();
    }
  },
  popup(c, r, t, e) {
    person(c, r, { skin: skinOf(e), shirt: '#8a3fd1', pants: '#3b1d5c', mouth: 'smile',
      hair: (c, r) => { c.beginPath(); c.arc(0, -r * 0.85, r * 0.5, Math.PI, TAU); c.closePath(); c.fillStyle = '#111'; c.fill(); },
      extra: (c, r) => { rr(c, -r * 0.25, -r * 0.92, r * 0.8, r * 0.22, 3, '#111', INK, 1.5); } });
    const ads = ['WIN!!', 'FREE', 'CLICK', '$$$', 'HOT', 'OMG'];
    for (let i = 0; i < 6; i++) {
      const a = -t * 0.9 + i * TAU / 6, ex = Math.cos(a) * r * 1.45, ey = Math.sin(a) * r * 0.85 - r * 0.25;
      rr(c, ex - 22, ey - 15, 44, 30, 3, '#fff', INK, 2);
      rr(c, ex - 22, ey - 15, 44, 9, 2, '#2f6fe0', null);
      rr(c, ex + 12, ey - 14, 8, 7, 1, '#e33', null);
      text(c, ads[i], ex, ey + 5, 11, '#e33', null);
    }
  },
};

function boxed(c, r, t, e) {
  // A Tax Evader hiding in a cardboard box.
  const w = r * 1.5, h = r * 1.3;
  circ(c, 0, -h * 0.55, r * 0.42, skinOf(e));
  eyes(c, r * 0.1, -h * 0.58, r * 0.15, Math.sin(t * 3 + e.seed), 0);
  rr(c, -w / 2, -h * 0.35, w, h, 2, '#c8975a');
  c.beginPath(); c.moveTo(-w / 2, -h * 0.35); c.lineTo(-w * 0.7, -h * 0.65); c.lineTo(-w * 0.1, -h * 0.55); c.closePath();
  c.fillStyle = '#b5844a'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
  line(c, -w / 2 + 3, -h * 0.05, w / 2 - 3, -h * 0.05, '#9a6a35', 2);
  text(c, 'NOT A SINNER', 0, h * 0.25, r * 0.28, '#3a2410', null);
}

export function drawSinner(c, e, t) {
  const T = ETYPES[e.t], r = e.r;
  const slowDown = e.stunT > 0 ? 0 : 1;
  const ph = t * (T.boss ? 4 : 9) * slowDown + e.seed * 3;
  const bob = e.t === 'bus' ? 0 : Math.abs(Math.sin(ph)) * r * 0.12;
  const wob = e.t === 'bus' ? Math.sin(ph * 2) * 0.02 : Math.sin(ph) * 0.08;
  c.save();
  c.translate(e.x, e.y);
  ell(c, 0, r * 0.9, r * (e.t === 'bus' ? 1.5 : 0.75), r * 0.22, 'rgba(0,0,0,0.3)', null);
  if (e.camo) c.globalAlpha = 0.9;
  c.translate(0, -bob); c.rotate(wob); c.scale(e.dx || 1, 1);
  if (e.camo) boxed(c, r, t, e); else SINNER[e.t](c, r, t, e);
  c.restore();
  c.globalAlpha = 1;
  if (e.flash > 0) circ(c, e.x, e.y - r * 0.2, r * 0.9, 'rgba(255,255,255,0.55)', null);
  if (e.burnT > 0) for (let i = 0; i < 3; i++) flame(c, e.x - r * 0.5 + i * r * 0.5, e.y - r * 0.2 + Math.sin(t * 20 + i) * 2, r * 0.3, t + i);
  if (e.stunT > 0) for (let i = 0; i < 3; i++) {
    const a = t * 5 + i * TAU / 3;
    text(c, '★', e.x + Math.cos(a) * r * 0.8, e.y - r * 1.5 + Math.sin(a) * r * 0.25, 12, '#ffe066', INK);
  } else if (e.slowF < 1) text(c, '♪', e.x + r * 0.7, e.y - r * 1.4 - (t * 30 % 10), 14, '#9fd8ff', INK);
  if (T.boss) {
    const w = r * 2.2, f = Math.max(0, e.hp / e.maxHp);
    rr(c, e.x - w / 2, e.y - r * 1.9, w, 10, 4, '#300', INK, 2);
    rr(c, e.x - w / 2 + 1, e.y - r * 1.9 + 1, (w - 2) * f, 8, 3, '#ff4d3a', null);
  }
}

export function drawBubble(c, e) {
  if (!e.say) return;
  c.font = `15px ${FONT}`;
  const say = e.say.toUpperCase();
  const w = Math.min(280, c.measureText(say).width + 18), h = 26;
  let x = e.x - w / 2, y = e.y - e.r * 2.3 - h - (ETYPES[e.t].boss ? 18 : 0);
  x = Math.max(4, Math.min(W - w - 4, x)); y = Math.max(4, y);
  rr(c, x, y, w, h, 10, '#fff', INK, 2.5);
  c.beginPath(); c.moveTo(e.x - 6, y + h - 1); c.lineTo(e.x, y + h + 9); c.lineTo(e.x + 6, y + h - 1); c.fillStyle = '#fff'; c.fill();
  c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(say, x + w / 2, y + h / 2 + 1, w - 12);
}

function flame(c, x, y, s, t) {
  const f = 1 + Math.sin(t * 25) * 0.15;
  c.beginPath(); c.moveTo(x, y - s * 1.6 * f);
  c.quadraticCurveTo(x + s, y - s * 0.3, x, y + s * 0.4);
  c.quadraticCurveTo(x - s, y - s * 0.3, x, y - s * 1.6 * f);
  c.fillStyle = '#ff8a1f'; c.fill();
  c.beginPath(); c.moveTo(x, y - s * 0.8 * f); c.quadraticCurveTo(x + s * 0.45, y, x, y + s * 0.3); c.quadraticCurveTo(x - s * 0.45, y, x, y - s * 0.8 * f);
  c.fillStyle = '#ffe066'; c.fill();
}

// ---------- towers ----------
function horns(c, x, y, s) {
  for (const d of [-1, 1]) {
    c.beginPath(); c.moveTo(x + d * s * 0.45, y - s * 0.55); c.quadraticCurveTo(x + d * s * 0.95, y - s * 1.0, x + d * s * 0.8, y - s * 1.45);
    c.quadraticCurveTo(x + d * s * 0.55, y - s * 0.95, x + d * s * 0.15, y - s * 0.8); c.closePath();
    c.fillStyle = '#f3ead2'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
  }
}
function demonHead(c, x, y, s, col, look, grin = true) {
  horns(c, x, y, s);
  circ(c, x, y, s, col);
  eyes(c, x + look * s * 0.15, y - s * 0.12, s * 0.28, look, 1);
  if (grin) {
    c.beginPath(); c.arc(x + look * s * 0.1, y + s * 0.25, s * 0.42, 0.15 * Math.PI, 0.85 * Math.PI);
    c.closePath(); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
  }
}

const TOWER = {
  stamp(c, o) {
    const f = o.face, l = o.lvl, big = l[0] >= 3;
    circ(c, 0, -2, 16, '#c92f2a');
    demonHead(c, 0, -20, 14, '#e0443a', f);
    if (l[1] >= 2) { circ(c, -4 + f * 2, -23, 6, null, INK, 2); circ(c, 8 + f * 2, -23, 6, null, INK, 2); line(c, 2 + f * 2, -23, 2 + f * 2, -23, INK, 2); }
    rr(c, -24, 4, 48, 18, 4, '#8a5530');
    rr(c, -16, 2, 14, 6, 1, '#f4f1e6', INK, 1.5);
    const down = o.anim > 0, sx = 13 * f, sz = big ? 1.7 : 1;
    const sy = down ? 0 : -18;
    rr(c, sx - 3 * sz, sy - 16 * sz, 6 * sz, 14 * sz, 2, '#a0703f', INK, 2);
    rr(c, sx - 8 * sz, sy - 3 * sz, 16 * sz, 6 * sz, 2, '#d22', INK, 2);
  },
  fork(c, o) {
    const l = o.lvl;
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.3; line(c, 0, 14, Math.cos(a) * 20, 14 + Math.sin(a) * 7, '#333', 4); }
    circ(c, 0, 4, 19, '#2b2b2b');
    const forks = l[0] >= 1 ? 3 : 2;
    for (let i = 0; i < forks; i++) {
      const a = o.spin + i * TAU / forks, ex = Math.cos(a) * 32, ey = Math.sin(a) * 18 - 6;
      line(c, 0, -6, ex, ey, '#6b4a2a', 4);
      const px = Math.cos(a), py = Math.sin(a) * 0.56;
      for (const k of [-1, 0, 1]) line(c, ex - py * k * 6, ey + px * k * 6, ex + px * 9 - py * k * 6, ey + py * 9 + px * k * 6, '#ccc', 2.5);
      if (l[0] >= 2) flame(c, ex + px * 10, ey + py * 10, 5, o.t + i);
    }
    demonHead(c, 0, -10, 14, '#b52a2a', Math.cos(o.spin));
    if (l[1] >= 3) {
      c.save(); c.setLineDash([10, 8]); c.lineDashOffset = -o.t * 60;
      circ(c, 0, 0, o.range, null, 'rgba(255,140,40,0.55)', 5); c.restore();
    }
  },
  lava(c, o) {
    const l = o.lvl, t = o.t;
    if (l[0] >= 3) { c.beginPath(); c.moveTo(-34, 18); c.lineTo(-14, -14); c.lineTo(14, -14); c.lineTo(34, 18); c.closePath(); c.fillStyle = '#5b3a2a'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); }
    ell(c, 0, 4, 28, 20, '#4a2e22');
    ell(c, 0, 2, 19, 13, '#ff7a1a', INK, 2);
    ell(c, 0, 0, 11, 6, '#ffd34d', null);
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.8 + i / 3) % 1;
      circ(c, -8 + i * 8, 2 - p * 6, 2 + p * 2, `rgba(255,220,90,${1 - p})`, null);
    }
    const vents = l[1] >= 2 ? 3 : 1;
    for (let v = 1; v < vents; v++) { const vx = v === 1 ? -22 : 22; ell(c, vx, 14, 8, 5, '#ff7a1a', INK, 2); }
    if (o.anim > 0) { const k = o.anim / 0.3; c.globalAlpha = k; flame(c, 0, -2, 12 + (1 - k) * 10, t); c.globalAlpha = 1; }
  },
  phone(c, o) {
    const l = o.lvl, t = o.t;
    ell(c, 0, 10, 24, 12, '#6b3b23');
    rr(c, -16, -10, 32, 20, 6, l[0] >= 3 ? '#e8695a' : '#e8d7a8');
    circ(c, 0, 1, 7, '#fff', INK, 2);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; circ(c, Math.cos(a) * 4.5, 1 + Math.sin(a) * 4.5, 1, INK, null); }
    rr(c, -18, -18, 36, 8, 4, '#3a3a3a');
    c.beginPath(); c.moveTo(16, 4); for (let i = 0; i < 6; i++) c.lineTo(20 + (i % 2) * 5, 6 + i * 3); c.strokeStyle = '#3a3a3a'; c.lineWidth = 2; c.stroke();
    if (l[1] >= 1) { c.beginPath(); c.moveTo(-18, -4); c.lineTo(-30, -14); c.lineTo(-30, 6); c.closePath(); c.fillStyle = '#555'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); }
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.6 + i * 0.5) % 1;
      c.globalAlpha = 1 - p;
      text(c, i ? '♫' : '♪', 10 + i * 8 + Math.sin(p * 6) * 4, -20 - p * 26, 16, '#9fd8ff', INK);
      c.globalAlpha = 1;
    }
  },
  auditor(c, o) {
    const f = o.face, l = o.lvl;
    rr(c, -14, -6, 28, 26, 8, '#2e3340');
    c.beginPath(); c.moveTo(-5, -6); c.lineTo(0, 6); c.lineTo(5, -6); c.fillStyle = '#fff'; c.fill();
    line(c, 0, -4, 0, 8, '#2c8a3a', 3);
    demonHead(c, 0, -20, 13, '#9aa0ab', f, false);
    mouth(c, f * 2, -12, 4, 'flat');
    c.beginPath(); c.moveTo(-15, -28); c.lineTo(15, -28); c.lineTo(10 + f * 6, -20); c.lineTo(-10 + f * 6, -20); c.closePath();
    c.fillStyle = 'rgba(40,200,90,0.75)'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    const cx = 15 * f;
    rr(c, cx - 7, -2, 14, 18, 2, l[1] >= 2 ? '#e0b030' : '#555');
    rr(c, cx - 5, 0, 10, 4, 1, '#9fe8a0', null);
    if (l[0] >= 3) text(c, 'AUDIT', 0, 24, 11, '#ff4d3a', INK);
  },
  shop(c, o) {
    const l = o.lvl;
    rr(c, -28, -8, 56, 30, 4, '#8a5530');
    for (let i = 0; i < 7; i++) {
      c.beginPath(); c.moveTo(-32 + i * 9.2, -30); c.lineTo(-32 + (i + 1) * 9.2, -30); c.lineTo(-32 + (i + 1) * 9.2, -12); c.arc(-32 + (i + 0.5) * 9.2, -12, 4.6, 0, Math.PI); c.closePath();
      c.fillStyle = i % 2 ? '#fff' : '#d22'; c.fill();
    }
    c.lineWidth = 2.5; c.strokeStyle = INK; c.strokeRect(-32, -30, 64, 18);
    text(c, 'GIFTS', 0, -36, 12, '#ffe066', INK);
    circ(c, -12, -2, 6, '#f3ead2', INK, 2); circ(c, -14, -3, 1.5, INK, null); circ(c, -10, -3, 1.5, INK, null);
    rr(c, 2, -6, 10, 10, 2, '#4b7bd1', INK, 1.5);
    if (l[1] >= 2) { rr(c, 15, -10, 10, 14, 3, 'rgba(200,240,255,0.7)', INK, 1.5); text(c, '$', 20, -2, 9, '#2b6b22', null); }
    if (l[0] >= 3) text(c, '★', 0, 8, 18, '#ffe066', INK);
  },
};

export function drawTower(c, key, x, y, o) {
  c.save();
  c.translate(x, y);
  if (o.scale) c.scale(o.scale, o.scale);
  if (!o.icon) ell(c, 0, TOWERS[key].r * 0.75, TOWERS[key].r * 0.95, TOWERS[key].r * 0.32, 'rgba(0,0,0,0.3)', null);
  TOWER[key](c, { face: 1, lvl: [0, 0], anim: 0, spin: 0, t: 0, range: 100, ...o });
  c.restore();
  if (!o.icon && (o.lvl[0] || o.lvl[1])) {
    for (let p = 0; p < 2; p++) for (let i = 0; i < 3; i++)
      circ(c, x - 9 + i * 9, y + TOWERS[key].r + 6 + p * 8, 3.2, o.lvl[p] > i ? (p ? '#6fd3ff' : '#ffd34d') : 'rgba(0,0,0,0.45)', INK, 1.2);
  }
}

// ---------- projectiles ----------
export function drawProj(c, p, t) {
  if (p.k === 'stamp') {
    c.save(); c.translate(p.x, p.y); c.rotate(t * 14);
    const s = p.r / 11;
    rr(c, -8 * s, -4 * s, 16 * s, 8 * s, 2, '#d22', INK, 2);
    rr(c, -3 * s, -10 * s, 6 * s, 7 * s, 2, '#a0703f', INK, 1.5);
    c.restore();
  } else if (p.k === 'fork') {
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
    line(c, -12, 0, 6, 0, '#6b4a2a', 3);
    for (const k of [-4, 0, 4]) line(c, 6, k, 13, k, '#ddd', 2);
    if (p.burn) flame(c, 12, 0, 4, t);
    c.restore();
  } else if (p.k === 'lava') {
    circ(c, p.x, p.y, 13, 'rgba(255,140,30,0.3)', null);
    circ(c, p.x, p.y, 8, '#ff7a1a', INK, 2);
    circ(c, p.x - 2, p.y - 2, 3, '#ffe066', null);
  }
}

// ---------- background ----------
function drawBlocker(c, b) {
  switch (b.kind) {
    case 'sign': {
      rr(c, b.x, b.y, b.w, b.h, 10, '#2a1416', INK, 4);
      rr(c, b.x + 6, b.y + 6, b.w - 12, b.h - 12, 7, null, '#e0b030', 2);
      text(c, 'WELCOME TO HELL', b.x + b.w / 2, b.y + 30, 28, '#ff5a3a', INK);
      text(c, 'Please have your sins ready', b.x + b.w / 2, b.y + 60, 17, '#f3ead2', null);
      break;
    }
    case 'desk': {
      rr(c, b.x, b.y, b.w, b.h, 6, '#7a4a2a', INK, 4);
      rr(c, b.x + 10, b.y + 10, 50, 34, 3, '#333', INK, 2); rr(c, b.x + 14, b.y + 14, 42, 24, 2, '#3fd16a', null);
      text(c, 'ERROR 666', b.x + 35, b.y + 26, 9, '#062', null);
      rr(c, b.x + 72, b.y + 14, 34, 26, 2, '#f4f1e6', INK, 2); rr(c, b.x + 76, b.y + 10, 34, 26, 2, '#fff', INK, 2);
      rr(c, b.x + 20, b.y + b.h - 22, b.w - 40, 16, 3, '#e0b030', INK, 2);
      text(c, 'CUSTOMS', b.x + b.w / 2, b.y + b.h - 13, 12, INK, null);
      break;
    }
    case 'cooler': {
      rr(c, b.cx - 22, b.cy - 6, 44, 38, 5, '#ddd', INK, 3);
      circ(c, b.cx, b.cy - 12, 20, '#ff8a2a', INK, 3);
      circ(c, b.cx - 6, b.cy - 18, 5, '#ffd34d', null);
      text(c, 'LAVA', b.cx, b.cy + 14, 11, '#d22', null);
      break;
    }
    case 'plant': {
      rr(c, b.cx - 16, b.cy - 2, 32, 26, 4, '#8a5530', INK, 3);
      for (const a of [-0.9, -0.3, 0.4, 1.0]) line(c, b.cx, b.cy, b.cx + Math.sin(a) * 26, b.cy - Math.cos(a) * 26 + 6, '#5a4a2a', 3);
      break;
    }
    case 'cabinet': {
      for (let i = 0; i < 3; i++) {
        rr(c, b.x + i * (b.w / 3), b.y, b.w / 3 - 4, b.h, 4, '#7d8590', INK, 3);
        rr(c, b.x + i * (b.w / 3) + 14, b.y + b.h / 2 - 4, b.w / 3 - 32, 8, 2, '#c9cfd6', INK, 1.5);
      }
      text(c, 'SINS A-Z', b.x + b.w / 2, b.y - 10, 12, '#f3ead2', INK);
      break;
    }
    case 'ticket': {
      circ(c, b.cx, b.cy, b.r, '#d22', INK, 3);
      rr(c, b.cx - 12, b.cy - 6, 24, 14, 2, '#fff', INK, 2);
      text(c, 'TAKE A', b.cx, b.cy - 16, 9, '#fff', null);
      text(c, 'NUMBER', b.cx, b.cy + 18, 9, '#fff', null);
      break;
    }
    case 'clock': {
      circ(c, b.cx, b.cy, b.r, '#f3ead2', INK, 4);
      text(c, '6', b.cx, b.cy - 22, 11, INK, null); text(c, '6', b.cx + 22, b.cy, 11, INK, null);
      text(c, '6', b.cx, b.cy + 22, 11, INK, null); text(c, '6', b.cx - 22, b.cy, 11, INK, null);
      line(c, b.cx, b.cy, b.cx + 10, b.cy - 14, INK, 3); line(c, b.cx, b.cy, b.cx - 16, b.cy + 4, INK, 2);
      text(c, 'FOREVER', b.cx, b.cy + b.r + 12, 11, '#f3ead2', INK);
      break;
    }
    case 'lava': {
      const g = c.createRadialGradient(b.cx, b.cy, b.r * 0.2, b.cx, b.cy, b.r);
      g.addColorStop(0, '#ffd34d'); g.addColorStop(0.6, '#ff7a1a'); g.addColorStop(1, '#c2361a');
      c.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = i / 24 * TAU, rr2 = b.r * (0.92 + 0.08 * Math.sin(i * 2.7 + b.cx));
        const x = b.cx + Math.cos(a) * rr2, y = b.cy + Math.sin(a) * rr2;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath(); c.fillStyle = g; c.fill(); c.lineWidth = 5; c.strokeStyle = '#2a0e0a'; c.stroke();
      break;
    }
    case 'couch': {
      rr(c, b.x, b.y, b.w, b.h, 14, '#a8202c', INK, 4);
      rr(c, b.x + 12, b.y + 18, b.w / 2 - 16, b.h - 28, 8, '#c93040', INK, 2);
      rr(c, b.x + b.w / 2 + 4, b.y + 18, b.w / 2 - 16, b.h - 28, 8, '#c93040', INK, 2);
      text(c, 'WAITING AREA', b.x + b.w / 2, b.y - 10, 12, '#f3ead2', INK);
      break;
    }
  }
}

export function makeBackground(map, path, scale) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
  const c = cv.getContext('2d');
  c.scale(scale, scale);
  // floor tiles
  const T = 64;
  for (let y = 0; y < H; y += T) for (let x = 0; x < W; x += T) {
    c.fillStyle = ((x + y) / T) % 2 ? map.floor[0] : map.floor[1];
    c.fillRect(x, y, T, T);
  }
  // glowing cracks
  let seed = map.id.length * 99;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  c.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    let x = rnd() * W, y = rnd() * H;
    c.beginPath(); c.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; c.lineTo(x, y); }
    c.strokeStyle = 'rgba(255,110,40,0.35)'; c.lineWidth = 5; c.stroke();
    c.strokeStyle = 'rgba(255,200,90,0.5)'; c.lineWidth = 1.5; c.stroke();
  }
  // queue lane: rope edge, then floor
  const stroke = (w, col) => {
    c.beginPath();
    map.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.lineJoin = 'round'; c.lineWidth = w; c.strokeStyle = col; c.stroke();
  };
  stroke(LANE * 2 + 14, 'rgba(0,0,0,0.35)');
  stroke(LANE * 2 + 8, '#8e1622');
  stroke(LANE * 2 - 2, '#cdb991');
  c.save(); c.setLineDash([18, 18]); stroke(3, 'rgba(120,90,60,0.35)'); c.restore();
  // brass posts along the ropes, skipped near corners
  const corners = map.pts.slice(1, -1);
  for (let d = 30; d < path.len; d += 70) {
    const i = Math.min(path.n - 2, Math.floor(d / 2));
    const x = path.px[i], y = path.py[i], dx = path.px[i + 1] - x, dy = path.py[i + 1] - y, l = Math.hypot(dx, dy) || 1;
    if (corners.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < LANE + 12)) continue;
    for (const s of [-1, 1]) {
      const px = x - dy / l * (LANE + 3) * s, py = y + dx / l * (LANE + 3) * s;
      if (px < -5 || px > W + 5) continue;
      circ(c, px, py, 5, '#e0b030', INK, 2);
    }
  }
  for (const b of map.blockers) drawBlocker(c, b);
  // arrivals elevator on the left edge
  const [, sy] = map.pts[0];
  rr(c, -10, sy - LANE - 18, 34, LANE * 2 + 36, 4, '#6d727a', INK, 4);
  rr(c, -4, sy - LANE - 10, 22, LANE * 2 + 20, 2, '#3c4047', INK, 2);
  text(c, 'ARRIVALS ▼', 64, sy - LANE - 28, 15, '#ffe066', INK);
  // golden escalator up to Heaven on the right edge
  const [, ey] = map.pts[map.pts.length - 1];
  const g = c.createLinearGradient(W - 140, 0, W, 0);
  g.addColorStop(0, 'rgba(255,240,170,0)'); g.addColorStop(1, 'rgba(255,240,170,0.85)');
  c.fillStyle = g; c.fillRect(W - 140, ey - LANE - 40, 140, LANE * 2 + 80);
  for (let i = 0; i < 6; i++) rr(c, W - 90 + i * 14, ey - LANE + 4, 12, LANE * 2 - 8, 2, i % 2 ? '#ffe9a0' : '#f3cf5a', '#b8902a', 1.5);
  // the bored angel
  const ax = W - 46, ay = ey + LANE + 46;
  ell(c, ax, ay + 14, 30, 11, '#fff', '#b8c4d6', 2);
  circ(c, ax, ay - 10, 12, SKINS[0]);
  ell(c, ax, ay - 26, 12, 4, null, '#ffd34d', 3);
  c.lineWidth = 2; c.strokeStyle = INK; c.beginPath(); c.moveTo(ax - 7, ay - 11); c.lineTo(ax - 2, ay - 11); c.moveTo(ax + 2, ay - 11); c.lineTo(ax + 7, ay - 11); c.stroke();
  circ(c, ax, ay - 4, 3, INK, null);
  text(c, 'HEAVEN →', W - 70, ey - LANE - 26, 15, '#fff6c8', INK);
  return cv;
}

// ---------- effects ----------
export class FX {
  constructor() { this.parts = []; this.decals = []; this.shake = 0; this.lines = []; }
  add(p) { if (this.parts.length < 450) this.parts.push(p); }
  text(x, y, s, col, size = 18, life = 0.9, vy = -40) { this.add({ k: 'txt', x, y, s, col, size, life, max: life, vy }); }
  event(ev) {
    switch (ev.k) {
      case 'pop': {
        const col = ev.t === 'soul' ? '#c9e8ff' : '#fff';
        for (let i = 0; i < (ev.boss ? 18 : 4); i++) {
          const a = Math.random() * TAU, s = 40 + Math.random() * 80;
          this.add({ k: 'puff', x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: ev.boss ? 14 : 6, col, life: 0.4, max: 0.4 });
        }
        if (ev.t === 'soul') this.add({ k: 'wisp', x: ev.x, y: ev.y, life: 0.7, max: 0.7 });
        if (ev.boss) { this.shake = Math.max(this.shake, 14); this.text(ev.x, ev.y - 30, 'CASE CLOSED!', '#ffe066', 34, 1.6, -30); }
        break;
      }
      case 'decal':
        if (this.decals.length > 26) this.decals.shift();
        this.decals.push({ x: ev.x + (Math.random() - 0.5) * 10, y: ev.y, a: (Math.random() - 0.5) * 0.6, life: 1.2, big: ev.big });
        break;
      case 'clang': if (Math.random() < 0.35) this.text(ev.x, ev.y - 20, 'BOUNCE', '#cfd6e0', 14, 0.5, -60); break;
      case 'boom':
        this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#ff9a2a', life: 0.35, max: 0.35 });
        for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, s = 30 + Math.random() * 60; this.add({ k: 'puff', x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, r: 9, col: '#ffb347', life: 0.45, max: 0.45 }); }
        if (ev.shake) this.shake = Math.max(this.shake, 8);
        break;
      case 'ring': if (Math.random() < 0.3) this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#ff6a1a', life: 0.25, max: 0.25 }); break;
      case 'shot': this.lines.push({ ...ev, life: 0.12 }); this.add({ k: 'txt', x: ev.x2, y: ev.y2 - 20, s: '$', col: '#7dff8a', size: 16, life: 0.5, max: 0.5, vy: -50 }); break;
      case 'hold': this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#6fd3ff', life: 0.5, max: 0.5 }); this.text(ev.x, ev.y - 40, 'PLEASE HOLD', '#9fd8ff', 16); break;
      case 'press1': this.text(ev.x, ev.y - 40, 'PRESS 1...', '#9fd8ff', 16); break;
      case 'income': this.text(ev.x, ev.y - 40, '+$$$', '#7dff8a', 22, 1.3); break;
      case 'leak': this.text(W - 120, ev.y || 200, `-${ev.n}`, '#ff6a5a', 22, 1); break;
      case 'place': case 'upgrade':
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; this.add({ k: 'puff', x: ev.x, y: ev.y + 10, vx: Math.cos(a) * 90, vy: Math.sin(a) * 40, r: 6, col: ev.k === 'upgrade' ? '#ffe066' : '#d8c8a8', life: 0.4, max: 0.4 }); }
        break;
      case 'sell': this.text(ev.x, ev.y - 20, `+$${ev.v}`, '#7dff8a', 22, 1.2); break;
    }
  }
  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      if (p.vx != null) { p.x += p.vx * dt; p.vx *= 0.92; }
      if (p.vy != null) { p.y += p.vy * dt; if (p.k === 'puff') p.vy *= 0.92; }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const d of this.decals) d.life -= dt;
    this.decals = this.decals.filter(d => d.life > 0);
    for (const l of this.lines) l.life -= dt;
    this.lines = this.lines.filter(l => l.life > 0);
    this.shake = Math.max(0, this.shake - dt * 40);
  }
  drawUnder(c) {
    for (const d of this.decals) {
      c.save(); c.globalAlpha = Math.min(1, d.life * 2) * 0.85; c.translate(d.x, d.y); c.rotate(d.a);
      const s = d.big ? 1.6 : 1;
      c.strokeStyle = '#d22'; c.lineWidth = 2; c.strokeRect(-26 * s, -9 * s, 52 * s, 18 * s);
      c.font = `${13 * s}px ${FONT}`; c.fillStyle = '#d22'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(d.big ? 'NOPE' : 'DENIED', 0, 1);
      c.restore();
    }
  }
  drawOver(c) {
    for (const l of this.lines) {
      c.globalAlpha = l.life / 0.12;
      line(c, l.x1, l.y1 - 10, l.x2, l.y2, '#7dff8a', 3);
    }
    c.globalAlpha = 1;
    for (const p of this.parts) {
      const f = p.life / p.max;
      c.globalAlpha = Math.min(1, f * 1.5);
      if (p.k === 'puff') circ(c, p.x, p.y, p.r * (1.6 - f * 0.6), p.col, null);
      else if (p.k === 'ring') circ(c, p.x, p.y, p.r * (1.1 - f * 0.3), null, p.col, 5 * f + 1);
      else if (p.k === 'wisp') { c.globalAlpha = f * 0.8; circ(c, p.x, p.y + (1 - f) * 30, 7, '#c9e8ff', null); }
      else if (p.k === 'txt') text(c, p.s, p.x, p.y, p.size, p.col, INK);
    }
    c.globalAlpha = 1;
  }
}

// ---------- full frame ----------
export function drawWorld(c, game, bg, fx, t, ui) {
  c.drawImage(bg, 0, 0, W, H);
  // animated lava shimmer
  for (const b of game.map.blockers) if (b.kind === 'lava') {
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.5 + i / 3 + b.cx * 0.01) % 1;
      circ(c, b.cx + Math.sin(i * 2.1 + b.cy) * b.r * 0.45, b.cy + Math.cos(i * 1.7) * b.r * 0.35, 4 + p * 9, `rgba(255,235,120,${(1 - p) * 0.8})`, null);
    }
  }
  if (game.map.id === 'desk') text(c, `NOW SERVING  #${game.round + 1}`, 765, 126, 14, '#7dff8a', INK);
  fx.drawUnder(c);
  // range of selected tower
  if (ui.sel) rangeCircle(c, ui.sel.x, ui.sel.y, ui.sel.s.range, true);
  // depth sort towers and sinners together
  const items = [];
  for (const tw of game.towers) items.push({ y: tw.y, tw });
  for (const e of game.enemies) items.push({ y: e.y, e });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.e) drawSinner(c, it.e, t);
    else {
      const tw = it.tw;
      const face = tw.key === 'stamp' || tw.key === 'auditor' ? (Math.cos(tw.ang) >= 0 ? 1 : -1) : 1;
      if (tw === ui.sel) circ(c, tw.x, tw.y, tw.r + 6, null, '#ffe066', 3);
      drawTower(c, tw.key, tw.x, tw.y, { face, lvl: tw.lvl, anim: tw.anim, spin: tw.spin, t, range: tw.s.range });
    }
  }
  for (const p of game.projs) drawProj(c, p, t);
  fx.drawOver(c);
  for (const e of game.enemies) drawBubble(c, e);
  // placement ghost
  if (ui.ghost) {
    const g = ui.ghost;
    rangeCircle(c, g.x, g.y, TOWERS[g.key].base.range || 0, g.ok);
    c.globalAlpha = 0.8;
    drawTower(c, g.key, g.x, g.y, { lvl: [0, 0], t });
    c.globalAlpha = 1;
    if (!g.ok) text(c, '✕', g.x, g.y - 44, 26, '#ff4d3a', INK);
  }
  // boss bar at the top
  const boss = game.enemies.find(e => ETYPES[e.t].boss);
  if (boss) {
    const w = 460, x = W / 2 - w / 2, y = 14;
    rr(c, x, y, w, 24, 8, '#300', INK, 3);
    rr(c, x + 2, y + 2, (w - 4) * Math.max(0, boss.hp / boss.maxHp), 20, 6, '#ff4d3a', null);
    text(c, ETYPES[boss.t].name.toUpperCase(), W / 2, y + 13, 15, '#fff', INK);
  }
}

function rangeCircle(c, x, y, r, ok) {
  if (!r || r > 2000) return;
  circ(c, x, y, r, ok ? 'rgba(255,255,255,0.13)' : 'rgba(255,40,40,0.2)', ok ? 'rgba(255,255,255,0.6)' : 'rgba(255,60,60,0.8)', 2);
}
