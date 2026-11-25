// All the cartoon drawing, seen from above: robbers, tax officials, projectiles,
// the street and effects. World units are 1280 x 900. Characters face +x
// in their own space and get rotated to where they are heading.

import { W, H, LANE } from './maps.js';
import { ETYPES } from './enemies.js';
import { TOWERS } from './towers.js';

export const INK = '#16120f';
export const FONT = "'Luckiest Guy', 'Arial Black', Impact, sans-serif";
const TAU = Math.PI * 2;
const BSKIN = ['#f2c7a0', '#d9a273', '#a86b43', '#6e4127', '#f6d9bd', '#c58c5c'];

// ---------- tiny helpers (story.js uses them too) ----------
export function circ(c, x, y, r, fill, stroke = INK, lw = 3) {
  c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
export function ell(c, x, y, rx, ry, fill, stroke = INK, lw = 3, rot = 0) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
export function rr(c, x, y, w, h, r, fill, stroke = INK, lw = 3) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
export function line(c, x1, y1, x2, y2, col = INK, lw = 3) {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.stroke();
}
export function text(c, s, x, y, size, fill = '#fff', stroke = INK, align = 'center') {
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

// ---------- robbers (top-down) ----------
// A robber: stepping shoes, shoulders, swinging arms, a money bag on his back,
// and a head with a beanie and a black eye mask. Faces +x.
const RSKIN = ['#f2c7a0', '#d9a273', '#a86b43', '#6e4127', '#f6d9bd', '#c58c5c'];
const rskin = e => RSKIN[Math.floor(e.seed * 10) % RSKIN.length];
function moneyBag(c, x, y, r, col = '#d9b77a') {
  circ(c, x, y, r, col, INK, 2);
  line(c, x + r * 0.55, y - r * 0.35, x + r * 0.95, y - r * 0.6, INK, 2);
  text(c, '$', x, y + 1, r * 1.1, '#2b6b22', null);
}
function eyeMask(c, hx, hr) {
  c.beginPath(); c.arc(hx, 0, hr, -0.95, 0.95); c.lineWidth = hr * 0.42; c.strokeStyle = '#16120f'; c.stroke();
  for (const s of [-1, 1]) { circ(c, hx + hr * 0.78, s * hr * 0.38, hr * 0.2, '#fff', null); circ(c, hx + hr * 0.86, s * hr * 0.38, hr * 0.1, INK, null); }
}
function robber(c, r, t, e, o) {
  const skin = o.skin || rskin(e);
  const ph = t * (o.pace || 8) + e.seed * 5;
  const step = Math.sin(ph) * r * 0.3;
  if (o.under) o.under(c, r, t);
  if (!o.noFeet) for (const s of [-1, 1]) ell(c, s * step * 0.9, s * r * 0.3, r * 0.3, r * 0.16, o.shoes || '#2a2a30', INK, 2);
  if (!o.noBag) moneyBag(c, -r * 0.62, 0, r * (o.bag || 0.42));
  const sw = Math.sin(ph) * r * 0.2;
  for (const s of [-1, 1]) arm(c, r * 0.05, s * r * 0.55, r * 0.55 - s * sw * 0.5, s * r * 0.68, r * 0.24, o.sleeve || skin);
  ell(c, 0, 0, r * 0.5, r * 0.78, o.shirt || '#2a2a30', INK, 2.5);
  if (o.stripes) {
    c.save(); c.beginPath(); c.ellipse(0, 0, r * 0.48, r * 0.76, 0, 0, TAU); c.clip();
    for (let k = -3; k <= 3; k++) line(c, k * r * 0.2, -r, k * r * 0.2, r, o.stripes, r * 0.09);
    c.restore();
  }
  if (o.body) o.body(c, r, t);
  circ(c, r * 0.12, 0, r * 0.44, skin, INK, 2.5);
  if (o.head) o.head(c, r, t, skin);
  else {
    c.beginPath(); c.arc(r * 0.08, 0, r * 0.42, Math.PI * 0.42, Math.PI * 1.58); c.closePath(); c.fillStyle = o.beanie || '#1e1e24'; c.fill();
    circ(c, -r * 0.18, 0, r * 0.13, o.pom || '#e83a2a', INK, 1.2);      // pom-pom
  }
  if (!o.noMask) eyeMask(c, r * 0.12, r * 0.44);
}

const ROBBER = {
  crawler(c, r, t, e) {      // Pickpocket
    robber(c, r, t, e, { shirt: '#7d8290', beanie: '#3a3d48', pom: '#ffd21f', pace: 11, noBag: true,
      body: (c, r) => rr(c, r * 0.45, r * 0.4, r * 0.45, r * 0.34, 3, '#8a5a2a', INK, 1.5) });   // a stolen wallet
  },
  walker(c, r, t, e) {       // Burglar
    robber(c, r, t, e, { shirt: '#f4f4f4', stripes: '#1e1e24', pace: 8 });
  },
  hardhat(c, r, t, e) {      // Big Bag Robber
    robber(c, r, t, e, { shirt: '#8a5a2a', beanie: '#ff8a2a', pom: '#fff', pace: 7, bag: 0.72 });
  },
  jogger(c, r, t, e) {       // Sprinter Thief
    robber(c, r, t, e, { shirt: '#e83a2a', sleeve: '#e83a2a', shoes: '#fff', pace: 15, beanie: '#1e1e24', pom: '#fff',
      body: (c, r) => { for (const s of [-1, 1]) line(c, -r * 0.4, s * r * 0.3, r * 0.4, s * r * 0.3, '#fff', 2); } });
  },
  football(c, r, t, e) {     // Scooter Thief: fastest
    robber(c, r, t, e, { shirt: '#3aa84a', pace: 2, noFeet: true,
      under: (c, r) => {
        rr(c, -r * 0.9, -r * 0.3, r * 1.9, r * 0.6, r * 0.3, '#3a3d48', INK, 2);
        for (const x of [-r * 0.85, r * 0.95]) circ(c, x, 0, r * 0.2, '#16120f', null);
        line(c, r * 0.95, 0, r * 0.95, 0, INK, 2);
        line(c, r * 0.95, -r * 0.55, r * 0.95, r * 0.55, INK, r * 0.14);     // handlebar
      },
      head: (c, r) => { circ(c, r * 0.1, 0, r * 0.47, '#ffd21f', INK, 2); line(c, -r * 0.3, 0, r * 0.5, 0, '#e8a800', 2.5); } });
  },
  headphones(c, r, t, e) {   // Hacker: can't hear the hold music
    robber(c, r, t, e, { shirt: '#5a3a9a', sleeve: '#5a3a9a', beanie: '#2a1a4a', pom: '#7dff8a', pace: 8, noBag: true,
      body: (c, r) => {
        rr(c, r * 0.5, -r * 0.42, r * 0.5, r * 0.84, 3, '#9aa0aa', INK, 1.5);       // laptop
        rr(c, r * 0.56, -r * 0.34, r * 0.36, r * 0.68, 2, '#7dff8a', null);
      },
      head: (c, r) => {
        c.beginPath(); c.arc(r * 0.08, 0, r * 0.42, Math.PI * 0.42, Math.PI * 1.58); c.closePath(); c.fillStyle = '#2a1a4a'; c.fill();
        line(c, r * 0.08, -r * 0.5, r * 0.08, r * 0.5, '#222', 3.5);
        for (const s of [-1, 1]) rr(c, -r * 0.08, s * r * 0.5 - r * 0.16, r * 0.3, r * 0.32, 4, '#16120f', INK, 1.5);
      } });
    text(c, '01', -r * 0.5, -r * 1.0 + Math.sin(t * 6 + e.seed) * 3, r * 0.5, '#7dff8a', INK);
  },
  riot(c, r, t, e) {         // The Lawyer: stamps bounce off his briefcase
    robber(c, r, t, e, { shirt: '#22305a', sleeve: '#22305a', shoes: '#111', pace: 6, noBag: true, noMask: true,
      body: (c, r) => { c.beginPath(); c.moveTo(r * 0.5, 0); c.lineTo(r * 0.2, -r * 0.16); c.lineTo(r * 0.2, r * 0.16); c.closePath(); c.fillStyle = '#c82a2a'; c.fill(); },
      head: (c, r, t, skin) => {
        c.beginPath(); c.arc(r * 0.06, 0, r * 0.42, Math.PI * 0.45, Math.PI * 1.55); c.closePath(); c.fillStyle = '#2a1a10'; c.fill();
        line(c, -r * 0.1, -r * 0.3, r * 0.3, -r * 0.05, 'rgba(255,255,255,0.35)', 1.5);     // slick gel
        for (const s of [-1, 1]) circ(c, r * 0.4, s * r * 0.16, r * 0.07, INK, null);
      } });
    // the briefcase shield
    rr(c, r * 0.85, -r * 0.85, r * 0.42, r * 1.7, 4, '#7a4a22', INK, 3);
    rr(c, r * 0.92, -r * 0.2, r * 0.28, r * 0.4, 2, '#e0b030', INK, 1.5);
  },
  partybus(c, r, t, e) {     // Getaway Van
    const L = r * 1.5, Wd = r * 0.8;
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {     // arms waving cash out of the windows
      const x = -L * 0.2 + i * L * 0.55, wave = Math.sin(t * 8 + i + s) * 4;
      arm(c, x, s * Wd * 0.8, x + 4 + wave, s * (Wd + 12), 6, RSKIN[(i + 1) % 5]);
      rr(c, x + wave - 4, s * (Wd + 14) - 4, 12, 8, 1, '#7dd87a', INK, 1);
    }
    rr(c, -L, -Wd, L * 2, Wd * 2, r * 0.25, '#2a2a30');
    rr(c, L - r * 0.5, -Wd + 4, r * 0.38, Wd * 2 - 8, 5, '#5a6a7a', INK, 2);      // tinted windscreen
    rr(c, -L * 0.8, -Wd * 0.55, L * 1.3, Wd * 1.1, 6, '#3a3a42', INK, 2);
    for (let i = 0; i < 3; i++) moneyBag(c, -L * 0.5 + i * L * 0.45, 0, r * 0.28);
    for (const s of [-1, 1]) circ(c, L - 4, s * (Wd - 6), 4, '#ffe066', INK, 1);   // headlights
  },
  couch(c, r, t, e) {        // Bulldozer Bob
    for (const s of [-1, 1]) {                                  // tracks
      rr(c, -r * 1.0, s * r * 0.9 - r * 0.22, r * 1.8, r * 0.44, 6, '#2a2a30', INK, 2.5);
      for (let i = 0; i < 6; i++) { const x = -r * 0.95 + ((i * r * 0.32 + t * 40) % (r * 1.75)); line(c, x, s * r * 0.9 - r * 0.2, x, s * r * 0.9 + r * 0.2, '#555', 2); }
    }
    rr(c, -r * 0.85, -r * 0.7, r * 1.5, r * 1.4, 10, '#ffc21f', INK, 3);
    rr(c, r * 0.95, -r * 1.2, r * 0.22, r * 2.4, 4, '#9aa0aa', INK, 3);              // the blade
    line(c, r * 0.65, -r * 0.5, r * 0.95, -r * 0.5, INK, 4); line(c, r * 0.65, r * 0.5, r * 0.95, r * 0.5, INK, 4);
    rr(c, -r * 0.55, -r * 0.5, r * 0.85, r * 1.0, 6, '#bfe8ff', INK, 2);              // cab roof window
    c.save(); c.translate(-r * 0.12, 0); c.scale(0.55, 0.55);
    robber(c, r * 0.9, t, e, { shirt: '#f4f4f4', stripes: '#1e1e24', noFeet: true, noBag: true, pace: 0 });
    c.restore();
    moneyBag(c, -r * 0.7, r * 0.45, r * 0.25); moneyBag(c, -r * 0.7, -r * 0.45, r * 0.25);
  },
  mru(c, r, t, e) {          // The Godfather
    const skin = RSKIN[1];
    for (const s of [-1, 1]) ell(c, s * Math.sin(t * 3 + e.seed) * r * 0.15, s * r * 0.32, r * 0.28, r * 0.15, '#111', INK, 2);
    for (const s of [-1, 1]) arm(c, r * 0.05, s * r * 0.62, r * 0.5, s * r * 0.3, r * 0.22, '#1a1a1e');
    ell(c, 0, 0, r * 0.55, r * 0.85, '#1a1a1e', INK, 3);
    line(c, r * 0.1, -r * 0.5, r * 0.45, -r * 0.05, '#f4f4f4', 3);            // white shirt collar
    line(c, r * 0.1, r * 0.5, r * 0.45, r * 0.05, '#f4f4f4', 3);
    circ(c, r * 0.32, -r * 0.42, r * 0.09, '#e83a5a', INK, 1.5);             // a rose
    ell(c, r * 0.5, 0, r * 0.3, r * 0.26, '#f4f4f4', INK, 2);                 // the white cat in his arms
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.72, s * r * 0.08); c.lineTo(r * 0.86, s * r * 0.2); c.lineTo(r * 0.7, s * r * 0.22); c.closePath(); c.fillStyle = '#f4f4f4'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); }
    circ(c, r * 0.06, 0, r * 0.32, skin, INK, 2.5);
    circ(c, r * 0.06, 0, r * 0.5, '#2a2a30', INK, 2.5);                       // fedora brim
    circ(c, r * 0.06, 0, r * 0.32, '#1a1a1e', INK, 2);
    circ(c, r * 0.06, 0, r * 0.34, null, '#f4f4f4', 3);                        // hat band
  },
  offshore(c, r, t, e) {     // Mr. Offshore: the final boss in his golden limo
    const L = r * 1.9, Wd = r * 0.72;
    rr(c, -L, -Wd, L * 2, Wd * 2, r * 0.35, '#ffcf3a');
    rr(c, -L, -Wd, L * 2, Wd * 2, r * 0.35, null, INK, 3.5);
    line(c, -L + 10, -Wd + 8, L - 10, -Wd + 8, 'rgba(255,255,255,0.6)', 4);
    rr(c, L - r * 0.6, -Wd + 6, r * 0.4, Wd * 2 - 12, 6, '#5a6a7a', INK, 2);
    rr(c, -L + 10, -Wd + 6, r * 0.35, Wd * 2 - 12, 6, '#5a6a7a', INK, 2);
    rr(c, -L * 0.55, -Wd * 0.55, L * 1.0, Wd * 1.1, 8, '#2a2a30', INK, 2);        // sunroof
    for (const s of [-1, 1]) circ(c, L - 6, s * (Wd - 9), 5, '#fff6b0', INK, 1.2);
    // Mr. Offshore sticks out of the sunroof: top hat, monocle, gold chain
    ell(c, -L * 0.05, 0, r * 0.38, r * 0.5, '#f4f4f4', INK, 2.5);
    line(c, r * 0.05, -r * 0.3, r * 0.05, r * 0.3, '#ffd21f', 3);
    for (const s of [-1, 1]) arm(c, -L * 0.05, s * r * 0.4, r * 0.35, s * r * (0.75 + Math.sin(t * 5 + s) * 0.1), r * 0.16, RSKIN[4]);
    circ(c, -L * 0.05 + r * 0.05, 0, r * 0.25, RSKIN[4], INK, 2);
    circ(c, -L * 0.05, 0, r * 0.32, '#16120f', INK, 2.5);                      // top hat brim
    circ(c, -L * 0.05, 0, r * 0.2, '#2a2a30', INK, 2);
    circ(c, -L * 0.05, 0, r * 0.21, null, '#c82a2a', 3);
    // cash flying everywhere
    for (let i = 0; i < 6; i++) {
      const a = t * 1.5 + i * 1.05, rad = r * (1.2 + (i % 3) * 0.25);
      c.save(); c.translate(Math.cos(a) * rad * 1.3, Math.sin(a) * rad); c.rotate(a * 2);
      rr(c, -7, -4, 14, 8, 1, '#7dd87a', INK, 1.2); text(c, '$', 0, 0.5, 7, '#2b6b22', null);
      c.restore();
    }
  },
};

function disguise(c, r, t, e) {
  // A robber in a trench coat, fedora and a very fake mustache. Only spotters see through it.
  const ph = t * 7 + e.seed * 5, step = Math.sin(ph) * r * 0.3;
  for (const s of [-1, 1]) ell(c, s * step * 0.9, s * r * 0.3, r * 0.3, r * 0.16, '#5a3a22', INK, 2);
  ell(c, -r * 0.1, 0, r * 0.62, r * 0.85, '#c8a46a', INK, 2.5);           // trench coat
  line(c, -r * 0.5, 0, r * 0.4, 0, '#9a7a4a', 2);
  circ(c, r * 0.1, 0, r * 0.6, '#6a4a2a', INK, 2.5);                       // fedora brim
  circ(c, r * 0.1, 0, r * 0.38, '#7a5a3a', INK, 2);
  // the fake mustache and nose poking out in front
  ell(c, r * 0.72, 0, r * 0.12, r * 0.36, '#2a1a10', INK, 1.5);
  circ(c, r * 0.78, 0, r * 0.12, '#f2c7a0', INK, 1.5);
  text(c, '?', r * 0.1, 0, r * 0.5, '#fff', INK);
}

export function drawSinner(c, e, t) {
  const T = ETYPES[e.t], r = e.r;
  const a = e.fa ?? e.ang ?? 0;
  c.save();
  c.translate(e.x, e.y);
  const long = { partybus: 1.6, offshore: 2, couch: 1.2 }[e.t] || 0.9;
  ell(c, 3, 5, r * long, r * (long > 1 ? 0.9 : 0.8), 'rgba(0,0,0,0.25)', null, 0, a);
  c.rotate(a);
  const tt = e.stunT > 0 ? 0 : t;
  if (e.camo) disguise(c, r, tt, e); else ROBBER[e.t](c, r, tt, e);
  c.restore();
  if (e.flash > 0) circ(c, e.x, e.y, r * 0.9, 'rgba(255,255,255,0.55)', null);
  if (e.burnT > 0) for (let i = 0; i < 3; i++) flame(c, e.x - r * 0.5 + i * r * 0.5, e.y - r * 0.2 + Math.sin(t * 20 + i) * 2, r * 0.3, t + i);
  if (e.stunT > 0) for (let i = 0; i < 3; i++) {
    const s = t * 5 + i * TAU / 3;
    text(c, '★', e.x + Math.cos(s) * r * 0.8, e.y - r * 1.2 + Math.sin(s) * r * 0.25, 12, '#ffe066', INK);
  } else if (e.slowF < 1) text(c, '♪', e.x + r * 0.7, e.y - r * 1.2 - (t * 30 % 10), 14, '#ff7ab8', INK);
  if (T.boss && !e.noBar) {
    const w = r * 2.2, f = Math.max(0, e.hp / e.maxHp);
    rr(c, e.x - w / 2, e.y - r * 1.7, w, 10, 4, '#300', INK, 2);
    rr(c, e.x - w / 2 + 1, e.y - r * 1.7 + 1, (w - 2) * f, 8, 3, '#ff4d3a', null);
  }
}

// Speech bubble for a robber or a shouting official.
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

// ---------- tax officials (top-down) ----------
// Suit shoulders, white collar and tie at the front, head with a comb-over,
// side parting, bun or cap, often glasses. Faces +x.
function official(c, o) {
  const skin = o.skin || BSKIN[0];
  if (o.arms) o.arms(c, skin, o.suit || '#5a6070');
  ell(c, -1, 0, 12, 18, o.suit || '#5a6070', INK, 3);                 // jacket shoulders
  ell(c, -8, 0, 4, 11, 'rgba(0,0,0,0.15)', null);
  if (!o.noTie) {
    c.beginPath(); c.moveTo(11, 0); c.lineTo(5, -6); c.lineTo(5, 6); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
    line(c, 6, 0, 11.5, 0, o.tie || '#c82a2a', 3);
  }
  if (o.body) o.body(c, skin);
  circ(c, 3, 0, 7.5, skin, INK, 2.5);                                 // head
  const hair = o.hair || '#4a3a2a';
  if (o.cap) { circ(c, 2.5, 0, 7.3, o.cap, INK, 2); rr(c, 6, -5, 6, 10, 3, o.cap, INK, 2); }
  else if (o.style === 'comb') {                                       // the classic comb-over
    c.beginPath(); c.arc(2, 0, 7, Math.PI * 0.5, Math.PI * 1.5); c.closePath(); c.fillStyle = hair; c.fill();
    for (let k = -1; k <= 1; k++) line(c, -3, k * 3, 6, k * 3 - 1.5, hair, 1.5);
  } else if (o.style === 'bun') {
    c.beginPath(); c.arc(2, 0, 7.2, Math.PI * 0.4, Math.PI * 1.6); c.closePath(); c.fillStyle = hair; c.fill();
    circ(c, -5.5, 0, 4, hair, INK, 1.5);
  } else if (o.style === 'bald') {
    circ(c, 1, -1.5, 2.2, 'rgba(255,255,255,0.45)', null);
  } else {
    c.beginPath(); c.arc(2, 0, 7.2, Math.PI * 0.45, Math.PI * 1.55); c.closePath(); c.fillStyle = hair; c.fill();
    line(c, -2, -2.5, 6, -4.5, 'rgba(255,255,255,0.35)', 1.2);        // side parting
  }
  if (o.band) circ(c, 3, 0, 7.4, null, o.band, 2.6);
  if (o.shades) rr(c, 7.5, -5.5, 3.5, 11, 2, '#111', INK, 1);
  else if (o.glasses) { for (const s of [-1, 1]) circ(c, 9, s * 3.2, 2.4, 'rgba(200,235,255,0.7)', INK, 1.2); }
  else frontEyes(c, 3, 7.5);
  if (o.extra) o.extra(c, skin);
}
function stamp(c, x, y, s = 1, big = false) {
  if (big) { circ(c, x, y, 9 * s, '#c82a2a', INK, 2); circ(c, x, y, 5 * s, '#8a5a2a', INK, 1.5); return; }
  rr(c, x - 5 * s, y - 4 * s, 10 * s, 8 * s, 2, '#c82a2a', INK, 1.5);
  circ(c, x, y, 3 * s, '#8a5a2a', INK, 1.2);
}
function folder(c, x, y, s = 1, col = '#f0c870') {
  rr(c, x - 8 * s, y - 6 * s, 16 * s, 12 * s, 2, col, INK, 1.5);
  rr(c, x - 8 * s, y - 8 * s, 7 * s, 3 * s, 1, col, INK, 1);
  line(c, x - 5 * s, y, x + 5 * s, y, 'rgba(0,0,0,0.25)', 1);
}
function cup(c, x, y, s = 1) {
  circ(c, x, y, 6 * s, '#fff', INK, 2);
  circ(c, x, y, 4 * s, '#6a3a1a', null);
  circ(c, x + 1 * s, y - 1 * s, 1.2 * s, 'rgba(255,255,255,0.6)', null);
}
function coinBall(c, x, y, r) {
  circ(c, x, y, r, '#ffcf3a', INK, 2);
  circ(c, x - r * 0.3, y - r * 0.3, r * 0.3, 'rgba(255,255,255,0.6)', null);
  text(c, '$', x + 0.5, y + 1, r * 1.1, '#a07800', null);
}

const TOWER = {
  dumbbell(c, o) {            // Stamp Clerk
    const l = o.lvl, throwing = o.anim > 0, big = l[0] >= 3;
    official(c, { suit: '#7d8290', style: 'comb', glasses: true, skin: BSKIN[0], tie: l[1] >= 2 ? '#2f7ad8' : '#c82a2a',
      arms: (c, skin, suit) => {
        arm(c, 4, -17, 12, -21, 7, suit);
        arm(c, 4, 17, throwing ? 28 : 13, throwing ? 8 : 21, 7, suit);
        circ(c, 12, -21, 3.5, skin, INK, 1.5);
        if (!throwing) stamp(c, 15, 23, 0.9, big);
        circ(c, throwing ? 28 : 13, throwing ? 8 : 21, 3.5, skin, INK, 1.5);
      } });
    if (l[1] >= 3) for (let i = 0; i < 3; i++) stamp(c, -18, -12 + i * 12, 0.7);
    else { rr(c, -22, 12, 14, 10, 1, '#fff', INK, 1.5); line(c, -20, 15, -11, 15, '#999', 1); line(c, -20, 18, -11, 18, '#999', 1); }
  },
  spinner(c, o) {             // Paper Shredder Guy
    const l = o.lvl, a = o.spin;
    for (let i = 0; i < 4; i++) {          // paper bits whirling around him
      const b = a + i * 1.57, px = Math.cos(b) * 30, py = Math.sin(b) * 30;
      c.save(); c.translate(px, py); c.rotate(b * 2); rr(c, -4, -2.5, 8, 5, 1, l[0] >= 2 ? '#ffb060' : '#fff', INK, 1); c.restore();
    }
    rr(c, 10, -15, 15, 30, 3, '#3a3d48', INK, 2.5);                     // the shredder
    rr(c, 12, -11, 3, 22, 1, '#111', null);
    if (l[0] >= 2) flame(c, 18, -6, 6, o.t);
    official(c, { suit: '#4a6a8a', style: 'side', skin: BSKIN[2],
      arms: (c, skin, suit) => { arm(c, 2, -16, 12, -10, 6, suit); arm(c, 2, 16, 12, 10, 6, suit); } });
    if (l[1] >= 3) {
      c.save(); c.setLineDash([10, 8]); c.lineDashOffset = -o.t * 60;
      circ(c, 0, 0, o.range, null, 'rgba(255,140,40,0.55)', 5); c.restore();
    }
  },
  shake(c, o) {               // Coffee Intern
    const l = o.lvl, throwing = o.anim > 0;
    rr(c, -24, 9, 18, 14, 3, '#c8a070', INK, 2);                        // tray of cups
    for (let i = 0; i < 2; i++) cup(c, -19 + i * 8, 16, 0.6);
    official(c, { suit: '#3aa84a', style: 'bun', hair: '#8a4a2a', skin: BSKIN[4], noTie: true,
      body: () => { line(c, 6, -6, 6, 6, '#2f7ad8', 2); rr(c, 3, 5, 5, 6, 1, '#fff', INK, 1); },     // lanyard + badge
      arms: (c, skin, suit) => {
        arm(c, 4, -17, 13, -19, 6, suit);
        const hx = throwing ? 28 : 15, hy = throwing ? 6 : 19;
        arm(c, 4, 17, hx, hy, 6, suit);
        cup(c, hx + 3, hy, l[0] >= 3 ? 1.1 : 0.9);
      } });
  },
  dj(c, o) {                  // Hold-Music Clerk
    const l = o.lvl, t = o.t;
    rr(c, 12, -22, 18, 44, 4, '#c8a070', INK, 2);                       // desk
    rr(c, 15, -12, 11, 16, 3, '#e8dcc0', INK, 1.5);                     // old phone
    c.beginPath(); c.moveTo(20, 4); c.bezierCurveTo(30, 14, 4, 20, 8, 10); c.strokeStyle = '#333'; c.lineWidth = 1.5; c.stroke();
    if (l[1] >= 1) for (const s of [-1, 1]) { rr(c, -16, s * 28 - 8, 14, 16, 3, '#2a2a30'); circ(c, -9, s * 28, 5, '#555', INK, 1.2); }
    official(c, { suit: l[0] >= 3 ? '#c82a2a' : '#6a5a8a', style: 'side', hair: '#e0c050', skin: BSKIN[1],
      arms: (c, skin, suit) => { arm(c, 2, -15, 16, -10, 6, suit); arm(c, 2, 15, 16, 10, 6, suit); },
      extra: () => { c.beginPath(); c.arc(3, 0, 9, -1.2, 1.2); c.strokeStyle = '#222'; c.lineWidth = 2; c.stroke(); circ(c, 9, 6, 2.5, '#222', null); } });   // headset
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.6 + i * 0.5) % 1;
      c.globalAlpha = 1 - p;
      text(c, i ? '♫' : '♪', -10 + i * 20 + Math.sin(p * 6) * 4, -26 - p * 26, 16, '#ff7ab8', INK);
      c.globalAlpha = 1;
    }
  },
  chad(c, o) {                // Tax Auditor
    const l = o.lvl, fl = o.anim > 0;
    if (l[0] >= 3) circ(c, 0, 0, 30, 'rgba(255,215,80,0.25)', 'rgba(255,215,80,0.6)', 2);
    official(c, { suit: '#22305a', style: 'side', hair: '#16120f', skin: BSKIN[5], shades: l[0] >= 3, glasses: l[0] < 3, tie: '#ffd21f',
      arms: (c, skin, suit) => {
        if (fl) { arm(c, 2, -18, 24, -6, 7, suit); arm(c, 2, 18, 8, 26, 7, suit); }
        else { arm(c, 4, -18, 15, -22, 7, suit); arm(c, 4, 18, 17, 21, 7, suit); folder(c, 20, 24, 0.9, l[1] >= 2 ? '#ffb02e' : '#f0c870'); }
        rr(c, 12, -30, 10, 13, 2, '#3a3d48', INK, 1.5);                 // calculator
        rr(c, 14, -28, 6, 3, 1, '#9fe8a0', null);
      } });
    if (l[1] >= 3) for (let i = 0; i < 3; i++) folder(c, -20, -14 + i * 14, 0.6);
  },
  store(c, o) {               // Tax Collector booth
    const l = o.lvl;
    rr(c, -28, -26, 56, 52, 6, '#f4f4f4');
    for (let i = 0; i < 4; i++) rr(c, -28 + i * 14, -26, 7, 52, 0, '#2f86d6', null);
    rr(c, -28, -26, 56, 52, 6, null, INK, 3);
    rr(c, -17, -10, 34, 20, 4, '#16120f');
    text(c, 'TAX', 0, 1, 13, '#ffd21f', null);
    for (const [x, y] of [[-20, 19], [-12, 21], [18, 19]]) { for (let k = 0; k < 3; k++) circ(c, x, y - k * 2.5, 5, '#ffcf3a', INK, 1.5); }
    if (l[1] >= 2) { circ(c, 22, -20, 6, 'rgba(200,240,255,0.7)', INK, 1.5); text(c, '%', 22, -19, 9, '#2b6b22', null); }
    if (l[0] >= 3) text(c, '★', -20, -18, 18, '#ffe066', INK);
  },
  influencer(c, o) {          // Speed Camera Officer
    const l = o.lvl, snap = o.anim > 0;
    rr(c, 14, -9, 16, 18, 3, '#3a3d48', INK, 2);                        // radar camera on a tripod
    circ(c, 28, 0, 5, '#9fd8ff', INK, 1.5);
    for (const s of [-1, 0, 1]) line(c, 18, 0, 8, s * 14, '#555', 2);
    official(c, { suit: '#2f5aa8', cap: '#1e2a50', skin: BSKIN[3], noTie: true,
      body: () => { rr(c, -2, -4, 6, 8, 2, '#ffd21f', INK, 1); },      // badge
      arms: (c, skin, suit) => { arm(c, 4, -16, 16, -8, 6, suit); arm(c, 4, 16, 16, 8, 6, suit); } });
    if (l[2] >= 2) text(c, '$', -6, 22, 12, '#7dff8a', INK);
    if (l[1] >= 2) text(c, '!', -6, -22, 13, '#ff7ab8', INK);
    if (snap) circ(c, 34, 0, 12 + o.anim * 20, 'rgba(255,255,255,0.85)', null);
  },
  legs(c, o) {                // Desk Slammer
    const l = o.lvl, up = o.anim > 0 ? o.anim * 30 : 0;
    rr(c, 10, -26, 22, 52, 4, '#a8783a', INK, 2.5);                     // desk
    const stack = l[0] >= 3 ? 5 : 3;
    for (let i = 0; i < stack; i++) rr(c, 14 + i * 0.6, -8 - i * 1.5, 14, 16, 1, i % 2 ? '#f0c870' : '#fff', INK, 1);
    official(c, { suit: '#8a6a4a', style: 'bald', skin: BSKIN[1], tie: '#3aa84a',
      arms: (c, skin, suit) => { arm(c, 2, -17, 12 - up * 0.3, -14 - up * 0.2, 7, suit); arm(c, 2, 17, 12 - up * 0.3, 14 + up * 0.2, 7, suit); } });
    if (o.anim > 0.15) text(c, '!!', 0, -26, 14, '#ff4d3a', INK);
  },
  treadmill(c, o) {           // Red Tape Officer
    const l = o.lvl;
    for (const [x, y] of [[-20, -18], [-20, 18]]) { rr(c, x - 7, y - 7, 14, 14, 2, '#3a3d48', INK, 1.5); circ(c, x, y, 5, '#ff7a1a', INK, 1.5); circ(c, x, y, 2, '#fff', null); }
    official(c, { suit: '#ff7a1a', style: 'side', hair: '#3a2a1a', skin: BSKIN[3], noTie: true,
      body: () => { for (const s of [-1, 1]) line(c, -8, s * 9, 8, s * 9, '#f4f4f4', 2.5); },   // hi-vis stripes
      arms: (c, skin, suit) => {
        arm(c, 4, -17, 14, -22, 6, suit); arm(c, 4, 17, 14, 22, 6, suit);
        circ(c, 17, 25, 6, '#e83a2a', INK, 2); circ(c, 17, 25, 2.5, '#fff', null);      // tape roll
      } });
    if (l[1] >= 3) line(c, 18, -20, 30, -20, '#e83a2a', 4);
  },
  kicker(c, o) {              // Karate Accountant
    const l = o.lvl, kick = o.anim > 0;
    // the kicking leg shoots forward
    if (kick) { line(c, -2, 8, 34, 4, INK, 11); line(c, -2, 8, 34, 4, '#f4f4f4', 7); ell(c, 36, 4, 6, 4, BSKIN[0], INK, 1.5); }
    official(c, { suit: '#f4f4f4', style: 'side', hair: '#16120f', skin: BSKIN[0], glasses: true, tie: '#c82a2a', band: l[0] >= 3 ? '#16120f' : '#c82a2a',
      body: () => { line(c, -6, -11, -6, 11, l[0] >= 3 ? '#16120f' : '#ffd21f', 3.5); },     // belt
      arms: (c, skin, suit) => { arm(c, 2, -16, 12, -22, 6, suit); arm(c, 2, 16, kick ? -8 : 12, kick ? 24 : 22, 6, suit); } });
  },
  collector(c, o) {           // Debt Collector
    const l = o.lvl, grab = o.anim > 0, reach = grab ? 20 : 0;
    official(c, { suit: '#2a2a30', style: 'bald', skin: BSKIN[2], shades: true, noTie: true,
      body: () => { line(c, 6, -7, 9, 7, '#ffd21f', 2); },              // gold chain
      arms: (c, skin, suit) => {
        arm(c, 3, -19, 16 + reach, -16 + reach * 0.4, 9, suit); arm(c, 3, 19, 16 + reach, 16 - reach * 0.4, 9, suit);
        circ(c, 16 + reach, -16 + reach * 0.4, 6, skin, INK, 2); circ(c, 16 + reach, 16 - reach * 0.4, 6, skin, INK, 2);
      } });
    if (l[2] >= 1) folder(c, -22, 16, 0.6, '#ff8a7a');
  },
  cannon(c, o) {              // Coin-Ball Cannon
    const l = o.lvl, fire = o.anim > 0 ? o.anim * 10 : 0;
    for (const s of [-1, 1]) circ(c, -4, s * 16, 8, '#8a5a2a', INK, 2);   // wheels
    rr(c, -14 - fire, -9, 46, 18, 7, l[0] >= 3 ? '#a07800' : '#3a3d48', INK, 3);   // barrel
    rr(c, 26 - fire, -11, 8, 22, 3, '#2a2a30', INK, 2);
    for (let i = 0; i < 3; i++) coinBall(c, -24, -14 + i * 10, 4.5);
    if (o.anim > 0.2) circ(c, 42, 0, 10, 'rgba(240,240,240,0.8)', null);
    c.save(); c.translate(-12, 22); c.scale(0.7, 0.7);
    official(c, { suit: '#ff7a1a', cap: '#ffd21f', skin: BSKIN[4], noTie: true });
    c.restore();
  },
  drone(c, o) {               // Tax Drone pilot on his launch pad
    circ(c, 0, 0, 22, '#d8dce4', INK, 2);
    text(c, 'H', -12, 0, 12, '#2f86d6', null);
    official(c, { suit: '#5a7a5a', cap: '#2f86d6', skin: BSKIN[5], tie: '#2f86d6',
      arms: (c, skin, suit) => { arm(c, 4, -14, 14, -6, 6, suit); arm(c, 4, 14, 14, 6, 6, suit); rr(c, 13, -8, 9, 16, 3, '#2a2a30', INK, 1.5); circ(c, 17, -3, 1.6, '#e83a2a', null); circ(c, 17, 3, 1.6, '#7dff8a', null); } });
  },
};

// The flying drone itself (drawn separately at its lap position).
export function drawDrone(c, x, y, a, t, lvl) {
  ell(c, x + 6, y + 22, 14, 6, 'rgba(0,0,0,0.18)', null);
  c.save(); c.translate(x, y); c.rotate(a);
  for (const [dx, dy] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) {
    line(c, 0, 0, dx, dy, '#3a3d48', 3);
    c.save(); c.translate(dx, dy); c.rotate(t * 40);
    ell(c, 0, 0, 9, 2, 'rgba(60,60,70,0.55)', null); c.restore();
    circ(c, dx, dy, 2.5, '#2a2a30', null);
  }
  rr(c, -7, -7, 14, 14, 4, lvl[2] >= 3 ? '#e83a2a' : '#2f86d6', INK, 2);
  circ(c, 0, 0, 2.5, Math.sin(t * 8) > 0 ? '#7dff8a' : '#1a8a3a', null);
  rr(c, -5, 9, 10, 7, 1, '#fff', INK, 1.2);                              // dangling letter
  c.restore();
}

export const PATH_COLS = ['#ffd34d', '#6fd3ff', '#ff7ab8'];

export function drawTower(c, key, x, y, o) {
  const lvl = o.lvl || [0, 0, 0];
  const top = Math.max(...lvl), topP = lvl.indexOf(top), t = o.t || 0;
  c.save();
  c.translate(x, y);
  if (o.scale) c.scale(o.scale, o.scale);
  if (!o.icon) {
    rr(c, -24, -24, 48, 48, 8, 'rgba(40,60,100,0.35)', null);   // a square of office carpet under every official
    ell(c, 3, 5, 22, 22, 'rgba(0,0,0,0.25)', null);
  }
  if (top >= 4) {   // tier 4+: glowing aura in the path's colour
    const col = PATH_COLS[topP], pulse = 1 + Math.sin(t * 4) * 0.06;
    c.globalAlpha = 0.35; circ(c, 0, 0, 31 * pulse, col, null); c.globalAlpha = 1;
    circ(c, 0, 0, 31 * pulse, null, col, 2.5);
  }
  if (top >= 5) c.scale(1.12, 1.12);
  const rot = ['dumbbell', 'chad', 'shake', 'kicker', 'collector', 'cannon'].includes(key) ? (o.ang ?? Math.PI / 2) : key === 'spinner' || key === 'store' ? 0 : Math.PI / 2;
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

// ---------- road items (red tape, traffic cones, puddles, coin piles) ----------
export function drawTrap(c, tr, t) {
  c.globalAlpha = Math.min(1, tr.life * 2);
  if (tr.k === 'kb') {                       // traffic cone from above
    ell(c, tr.x + 2, tr.y + 3, 10, 8, 'rgba(0,0,0,0.25)', null);
    rr(c, tr.x - 9, tr.y - 9, 18, 18, 3, '#2a2a30', INK, 1.5);
    circ(c, tr.x, tr.y, 7.5, tr.blast ? '#e83a2a' : '#ff7a1a', INK, 2);
    circ(c, tr.x, tr.y, 4.5, null, '#fff', 2);
    circ(c, tr.x, tr.y, 1.8, tr.blast && Math.sin(t * 12) > 0 ? '#ffd21f' : '#ff9a4a', null);
  } else if (tr.k === 'tm') {                // red tape across the road
    c.save(); c.translate(tr.x, tr.y); c.rotate(tr.ang + Math.PI / 2);
    rr(c, -34, -8, 68, 16, 3, '#e83a2a', INK, 2);
    c.save(); c.beginPath(); c.rect(-33, -7, 66, 14); c.clip();
    for (let x = -40; x < 40; x += 12) { c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 8, -8); c.lineTo(x + 13, -8); c.lineTo(x + 5, 8); c.closePath(); c.fillStyle = '#fff'; c.fill(); }
    c.restore();
    text(c, tr.slow < 0 ? 'GO BACK' : 'RED TAPE', 0, 0.5, 9, INK, null);
    for (const s of [-1, 1]) rr(c, s * 38 - 4, -6, 8, 12, 2, '#ffd21f', INK, 1.5);
    c.restore();
    if (tr.slow < 0) { const p = (t * 1.5) % 1; c.globalAlpha *= 1 - p; text(c, '↩', tr.x, tr.y - 16 - p * 10, 14, '#ff4d3a', INK); }
  } else if (tr.coins) {                     // pile of hot coins
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, rad = tr.r * 0.55 * ((i % 3) / 3 + 0.3);
      circ(c, tr.x + Math.cos(a) * rad, tr.y + Math.sin(a) * rad * 0.7, 6, '#ffcf3a', INK, 1.2);
    }
    if (Math.sin(t * 6 + tr.x) > 0.5) text(c, '✦', tr.x + 8, tr.y - 10, 10, '#fff6a0', null);
  } else {                                   // spilled coffee
    const f = 1 + Math.sin(t * 3 + tr.x) * 0.04;
    ell(c, tr.x, tr.y, tr.r * f, tr.r * 0.75 * f, 'rgba(120,70,30,0.6)', 'rgba(70,40,15,0.8)', 2);
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.8 + i / 3 + tr.x * 0.01) % 1;
      circ(c, tr.x + Math.sin(i * 2.3) * tr.r * 0.5, tr.y + Math.cos(i * 1.7) * tr.r * 0.35 - p * 12, 2 + p * 4, `rgba(255,255,255,${(1 - p) * 0.6})`, null);
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
  if (p.k === 'dumbbell') {                  // DENIED stamp
    trail(c, p, 'rgba(255,255,255,0.8)', 5);
    c.save(); c.translate(p.x, p.y); c.rotate(p.age * 14);
    stamp(c, 0, 0, p.big ? 1.5 : 1, p.big);
    c.restore();
  } else if (p.k === 'plate') {              // shredded paper bit
    trail(c, p, p.burn ? 'rgba(255,150,40,0.9)' : 'rgba(255,255,255,0.7)', 4);
    c.save(); c.translate(p.x, p.y); c.rotate(p.age * 20); rr(c, -5, -3, 10, 6, 1, '#fff', INK, 1.2); c.restore();
    if (p.burn) flame(c, p.x, p.y - 2, 5, t);
  } else if (p.k === 'frisbee') {            // the auditor's file
    trail(c, p, 'rgba(255,225,120,0.95)', 7);
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot); folder(c, 0, 0, 0.9); c.restore();
  } else if (p.k === 'letter') {             // tax letter from the drone
    trail(c, p, p.burn ? 'rgba(255,150,40,0.9)' : 'rgba(255,255,255,0.8)', 4);
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
    rr(c, -7, -5, 14, 10, 1, '#fff', INK, 1.5);
    c.beginPath(); c.moveTo(-7, -5); c.lineTo(0, 1); c.lineTo(7, -5); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
    circ(c, 0, 1, 2, '#c82a2a', null);
    c.restore();
  } else if (p.k === 'shake' || p.k === 'ball') {
    // shadow on the ground, the cup / ball up in the air
    ell(c, p.x, p.y, 8, 5, 'rgba(0,0,0,0.3)', null);
    const s = 1 + p.h * (p.k === 'ball' ? 1.1 : 0.7), by = p.y - p.h * (p.k === 'ball' ? 90 : 46);
    c.save(); c.translate(p.x, by); c.rotate(p.tt * 14); c.scale(s, s);
    if (p.k === 'ball') coinBall(c, 0, 0, 8); else cup(c, 0, 0, 1.1);
    c.restore();
  }
}

// ---------- background ----------
function car(c, x, y, w, h, col) {
  rr(c, x, y, w, h, h * 0.3, col, INK, 3);
  rr(c, x + w * 0.28, y + h * 0.15, w * 0.42, h * 0.7, 6, 'rgba(255,255,255,0.2)', INK, 2);
  rr(c, x + w * 0.68, y + h * 0.12, w * 0.14, h * 0.76, 4, '#9fd8ff', INK, 2);
  rr(c, x + w * 0.16, y + h * 0.15, w * 0.1, h * 0.7, 3, '#9fd8ff', INK, 2);
}
function cloud(c, x, y, s) {
  for (const [dx, dy, r] of [[-20, 4, 16], [0, -4, 22], [22, 2, 17], [8, 10, 15], [-8, 10, 14]]) circ(c, x + dx * s, y + dy * s, r * s, '#ffffff', null);
}

// The bank: white marble columns, gold dome, golden doors. Heaven for money.
function drawBank(c, b) {
  const { x, y, w, h } = b, cx = x + w / 2;
  const g = c.createRadialGradient(cx, y + h * 0.4, 10, cx, y + h * 0.4, w * 0.9);
  g.addColorStop(0, 'rgba(255,240,160,0.75)'); g.addColorStop(1, 'rgba(255,240,160,0)');
  c.fillStyle = g; c.fillRect(x - w * 0.5, y - 40, w * 2, h + 80);
  for (let i = 0; i < 5; i++) cloud(c, x + 10 + i * (w - 20) / 4, y + h - 6 + (i % 2) * 8, 0.9);
  const top = y + h * 0.28, base = y + h - 22;
  rr(c, x + 6, base - 6, w - 12, 24, 4, '#f4f0e6', INK, 3);              // steps
  rr(c, x + 14, base - 16, w - 28, 14, 3, '#fffaf0', INK, 2.5);
  rr(c, x + 14, top + 26, w - 28, base - top - 40, 0, '#fffaf0', INK, 3);
  const n = Math.max(3, Math.round((w - 40) / 34));
  for (let i = 0; i < n; i++) {                                         // columns
    const px = x + 24 + i * (w - 48) / (n - 1);
    rr(c, px - 7, top + 30, 14, base - top - 46, 3, '#ffffff', INK, 2);
    line(c, px, top + 34, px, base - 20, 'rgba(0,0,0,0.12)', 2);
  }
  // golden double doors in the middle (the road ends here)
  rr(c, cx - 20, base - 52, 40, 48, 4, '#ffcf3a', INK, 3);
  line(c, cx, base - 50, cx, base - 6, INK, 2);
  // pediment and dome
  c.beginPath(); c.moveTo(x + 6, top + 28); c.lineTo(cx, top - 6); c.lineTo(x + w - 6, top + 28); c.closePath();
  c.fillStyle = '#fffaf0'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.arc(cx, top - 4, w * 0.22, Math.PI, 0); c.closePath(); c.fillStyle = '#ffcf3a'; c.fill(); c.stroke();
  line(c, cx - w * 0.12, top - 18, cx - w * 0.05, top - 26, 'rgba(255,255,255,0.7)', 3);
  text(c, '$', cx, top + 12, 18, '#ffcf3a', INK);
  text(c, 'BANK', cx, top + 44, Math.min(30, w * 0.18), '#ffcf3a', INK);
}

function drawBlocker(c, b) {
  switch (b.kind) {
    case 'bank': drawBank(c, b); break;
    case 'sign': {
      rr(c, b.x + 4, b.y + 6, b.w, b.h, 10, 'rgba(0,40,0,0.18)', null);
      rr(c, b.x, b.y, b.w, b.h, 10, '#2f86d6', INK, 4);
      rr(c, b.x + 6, b.y + 6, b.w - 12, b.h - 12, 7, null, '#ffd21f', 3);
      text(c, 'TAX OFFICE', b.x + b.w / 2, b.y + 30, 30, '#ffd21f', INK);
      text(c, 'We know where you live. :)', b.x + b.w / 2, b.y + 60, 15, '#fff', INK);
      break;
    }
    case 'car': car(c, b.x, b.y, b.w, b.h, b.col); break;
    case 'tree': {
      circ(c, b.cx + 6, b.cy + 8, b.r, 'rgba(0,50,0,0.2)', null);
      circ(c, b.cx, b.cy, b.r, '#3f9e32', INK, 3);
      for (let i = 0; i < 5; i++) { const a = i * 1.3; circ(c, b.cx + Math.cos(a) * b.r * 0.45, b.cy + Math.sin(a) * b.r * 0.45, b.r * 0.42, '#56b840', null); }
      circ(c, b.cx - b.r * 0.2, b.cy - b.r * 0.25, b.r * 0.32, '#86dc5c', null);
      for (let i = 0; i < 3; i++) circ(c, b.cx + Math.cos(i * 2.1) * b.r * 0.55, b.cy + Math.sin(i * 2.1) * b.r * 0.55, 3.5, '#ff5a5a', INK, 1);
      break;
    }
    case 'dumpster': {
      rr(c, b.x + 4, b.y + 6, b.w, b.h, 6, 'rgba(0,50,0,0.18)', null);
      rr(c, b.x, b.y, b.w, b.h, 6, '#3aa84a', INK, 3);
      line(c, b.x + b.w / 2, b.y + 4, b.x + b.w / 2, b.y + b.h - 4, INK, 3);
      for (const k of [0.25, 0.75]) rr(c, b.x + b.w * k - 14, b.y + b.h / 2 - 4, 28, 8, 3, '#2a8a3a', INK, 1.5);
      text(c, 'SHREDDED RECEIPTS', b.x + b.w / 2, b.y - 10, 11, '#fff', INK);
      break;
    }
    case 'hydrant': {
      circ(c, b.cx, b.cy, b.r * 0.75, '#d22', INK, 3);
      circ(c, b.cx, b.cy, b.r * 0.35, '#ff6a5a', INK, 2);
      for (const s of [-1, 1]) rr(c, b.cx + s * b.r * 0.75 - 4, b.cy - 4, 8, 8, 2, '#a11', INK, 1.5);
      break;
    }
    case 'grate': {
      circ(c, b.cx, b.cy, b.r, '#7d8290', INK, 3);
      for (let i = -2; i <= 2; i++) line(c, b.cx - b.r * 0.7, b.cy + i * b.r * 0.28, b.cx + b.r * 0.7, b.cy + i * b.r * 0.28, '#4a4f5a', 3);
      break;
    }
    case 'truck': {
      circ(c, b.cx, b.cy, b.r * 0.92, '#9aa0aa', INK, 3);
      c.save(); c.beginPath(); c.arc(b.cx, b.cy, b.r * 0.92, 0, TAU); c.clip();
      for (let x = -3; x <= 3; x++) line(c, b.cx + x * b.r * 0.32, b.cy - b.r, b.cx + x * b.r * 0.32, b.cy - b.r * 0.55, '#fff', 3);
      c.restore();
      const k = Math.floor(b.cx / 7) % 5;
      const [col, label] = [['#ff5fa8', 'DONUTS'], ['#ffb02e', 'TACOS'], ['#e83a2a', 'PIZZA'], ['#3ec0e8', 'ICE CREAM'], ['#ffd21f', 'BURGERS']][k];
      const w = b.r * 1.15, h = b.r * 0.52, x = b.cx - w / 2, y = b.cy - h / 2 + b.r * 0.1;
      rr(c, x + 6, y + 8, w, h, 10, 'rgba(0,0,0,0.2)', null);
      car(c, x, y, w, h, col);
      rr(c, x + w * 0.05, y + h * 0.05, w * 0.6, h * 0.9, 6, '#fff', INK, 2.5);
      for (let i = 0; i < 6; i++) rr(c, x + w * 0.05 + i * w * 0.1, y + h * 0.05, w * 0.05, h * 0.9, 0, col, null);
      text(c, label, x + w * 0.35, y + h * 0.5, Math.min(18, h * 0.38), '#fff', INK);
      break;
    }
    case 'pumps': {
      rr(c, b.x, b.y, b.w, b.h, 10, '#c9c9c4', INK, 3);
      for (const k of [0.25, 0.75]) { rr(c, b.x + b.w * k - 18, b.y + 14, 36, b.h - 28, 5, '#d22', INK, 2); rr(c, b.x + b.w * k - 10, b.y + 20, 20, 12, 2, '#9fe8a0', INK, 1.5); }
      text(c, 'GAS', b.x + b.w / 2, b.y - 10, 13, '#fff', INK);
      break;
    }
    case 'fountain': {
      circ(c, b.cx, b.cy, b.r, '#d8d4c8', INK, 3);
      circ(c, b.cx, b.cy, b.r * 0.8, '#6fc8ff', INK, 2);
      circ(c, b.cx, b.cy, b.r * 0.25, '#d8d4c8', INK, 2);
      for (let i = 0; i < 6; i++) { const a = i * 1.05; circ(c, b.cx + Math.cos(a) * b.r * 0.5, b.cy + Math.sin(a) * b.r * 0.5, 3, '#ffcf3a', INK, 1); }   // wishing coins
      break;
    }
    case 'statue': {
      circ(c, b.cx, b.cy, b.r, '#d8d4c8', INK, 3);
      circ(c, b.cx, b.cy, b.r * 0.6, '#b8c4b0', INK, 2);
      text(c, '$', b.cx, b.cy + 2, b.r * 0.9, '#8a9a80', INK);
      text(c, 'GOLDEN TAXPAYER', b.cx, b.cy + b.r + 14, 11, '#fff', INK);
      break;
    }
    case 'hotdog': {
      rr(c, b.x, b.y, b.w, b.h, 8, '#ffd21f', INK, 3);
      for (let i = 0; i < 5; i++) rr(c, b.x + 6 + i * (b.w - 12) / 5, b.y + 4, (b.w - 12) / 10, b.h - 8, 0, '#e83a2a', null);
      rr(c, b.x, b.y, b.w, b.h, 8, null, INK, 3);
      text(c, 'HOT DOGS', b.x + b.w / 2, b.y - 10, 12, '#fff', INK);
      break;
    }
  }
}

// An open manhole the robbers climb out of: a dark hole with the lid pushed aside.
function manholeHole(c, x, y) {
  circ(c, x, y, 34, '#c9ccd2', INK, 3);
  circ(c, x, y, 26, '#16120f', INK, 2);
  circ(c, x - 6, y - 6, 12, 'rgba(255,255,255,0.05)', null);
  circ(c, x - 46, y - 30, 24, '#7d8290', INK, 3);                     // the lid
  for (let i = -1; i <= 1; i++) line(c, x - 62, y - 30 + i * 8, x - 30, y - 30 + i * 8, '#4a4f5a', 3);
}
// The front rim gets drawn again on top, so robbers look like they climb out of the hole.
function manholeRim(c, x, y) {
  c.beginPath(); c.arc(x, y, 30, 0.15, Math.PI - 0.15); c.lineWidth = 9; c.strokeStyle = '#c9ccd2'; c.stroke();
  c.beginPath(); c.arc(x, y, 34, 0.1, Math.PI - 0.1); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
}

export function makeBackground(map, paths, scale) {
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
  if (map.id === 'gas' || map.id === 'downtown') {     // pavement slabs
    c.strokeStyle = 'rgba(120,100,70,0.2)'; c.lineWidth = 2;
    for (let x = 0; x < W; x += 128) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 128) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let i = 0; i < 14; i++) ell(c, rnd() * W, rnd() * H, 10 + rnd() * 26, 6 + rnd() * 14, 'rgba(60,50,40,0.1)', null);
  } else {                                              // grass tufts and flowers
    for (let i = 0; i < 120; i++) {
      const x = rnd() * W, y = rnd() * H;
      c.strokeStyle = 'rgba(40,120,30,0.45)'; c.lineWidth = 2; c.beginPath();
      c.moveTo(x, y); c.lineTo(x - 3, y - 7); c.moveTo(x, y); c.lineTo(x + 3, y - 7); c.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W, y = rnd() * H, col = ['#fff', '#ffe066', '#ff8ac0', '#b8a0ff'][i % 4];
      for (let k = 0; k < 4; k++) circ(c, x + Math.cos(k * 1.57) * 3, y + Math.sin(k * 1.57) * 3, 2.6, col, null);
      circ(c, x, y, 2, '#ffb02e', null);
    }
  }
  // roads: sidewalk, curb, asphalt, centre line. Tunnels are drawn as a dashed sewer line instead.
  const stroke = (segs, w, col, dash) => {
    c.save(); if (dash) c.setLineDash(dash);
    c.lineJoin = 'round'; c.lineCap = dash ? 'butt' : 'round'; c.lineWidth = w; c.strokeStyle = col;
    c.beginPath();
    let last = null;
    for (const s of segs) {
      if (!last || last.bx !== s.ax || last.by !== s.ay) c.moveTo(s.ax, s.ay);
      c.lineTo(s.bx, s.by); last = s;
    }
    c.stroke(); c.restore();
  };
  const open = paths.map(p => p.segs.filter(s => !s.tunnel));
  for (const segs of open) stroke(segs, LANE * 2 + 34, 'rgba(0,40,0,0.16)');
  for (const segs of open) stroke(segs, LANE * 2 + 28, '#cfc9bb');
  for (const segs of open) stroke(segs, LANE * 2 + 8, '#f4f0e6');
  for (const segs of open) stroke(segs, LANE * 2, '#666b76');
  for (const segs of open) stroke(segs, 3, '#ffd21f', [22, 18]);
  for (const p of paths) {
    for (const s of p.segs) {
      if (!s.tunnel) continue;
      stroke([s], 14, 'rgba(90,70,40,0.35)', [14, 10]);         // the tunnel underground
      for (const [x, y] of [[s.ax, s.ay], [s.bx, s.by]]) {      // sewer grates at both ends
        circ(c, x, y, 34, '#7d8290', INK, 3);
        for (let i = -2; i <= 2; i++) line(c, x - 24, y + i * 10, x + 24, y + i * 10, '#3a3f4a', 4);
      }
      text(c, 'SEWER', (s.ax + s.bx) / 2, (s.ay + s.by) / 2, 14, '#b6ff3a', INK);
    }
    for (let i = 0; i < 24; i++) {                              // cracks on the asphalt
      const d = rnd() * p.len, k = Math.min(p.n - 1, Math.floor(d / 2));
      const x = p.px[k] + (rnd() - 0.5) * LANE, y = p.py[k] + (rnd() - 0.5) * LANE;
      line(c, x, y, x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 16, 'rgba(0,0,0,0.2)', 1.5);
    }
  }
  for (const b of map.blockers) drawBlocker(c, b);
  for (const p of paths) manholeHole(c, p.px[0], p.py[0]);
  return cv;
}

// ---------- effects ----------
const POWS = ['DENIED!', 'BONK!', 'POW!', 'AUDITED!', 'FINED!', 'NOPE!'];

export class FX {
  constructor() { this.parts = []; this.shake = 0; }
  add(p) { if (this.parts.length < 450) this.parts.push(p); }
  text(x, y, s, col, size = 18, life = 0.9, vy = -40) { this.add({ k: 'txt', x, y, s, col, size, life, max: life, vy }); }
  event(ev) {
    switch (ev.k) {
      case 'pop': {
        for (let i = 0; i < (ev.boss ? 18 : 4); i++) {
          const a = Math.random() * TAU, s = 40 + Math.random() * 80;
          this.add({ k: i % 2 ? 'bill' : 'puff', x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: ev.boss ? 14 : 6, col: '#ffffff', life: 0.5, max: 0.5, rot: a });
        }
        if (ev.boss) { this.shake = Math.max(this.shake, 14); this.text(ev.x, ev.y - 30, 'BUSTED!', '#ffe066', 46, 1.6, -30); }
        break;
      }
      case 'decal':
        if (Math.random() < (ev.big ? 0.5 : 0.12)) this.text(ev.x + (Math.random() - 0.5) * 20, ev.y - 18, POWS[(Math.random() * POWS.length) | 0], '#fff36a', ev.big ? 22 : 16, 0.5, -50);
        break;
      case 'clang': if (Math.random() < 0.35) this.text(ev.x, ev.y - 20, 'OBJECTION!', '#cfd6e0', 14, 0.5, -60); break;
      case 'boom':
        this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: ev.coin ? '#ffcf3a' : '#f3e3c3', life: 0.35, max: 0.35 });
        for (let i = 0; i < 8; i++) { const a = Math.random() * TAU, s = 30 + Math.random() * 70; this.add({ k: 'puff', x: ev.x, y: ev.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 9, col: ev.coin ? (i % 2 ? '#ffcf3a' : '#fff6b0') : (i % 2 ? '#c8a070' : '#8a5a2a'), life: 0.45, max: 0.45 }); }
        if (ev.shake) this.shake = Math.max(this.shake, 8);
        break;
      case 'ring': if (Math.random() < 0.3) this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#ff6a1a', life: 0.25, max: 0.25 }); break;
      case 'hold': this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#ff7ab8', life: 0.5, max: 0.5 }); this.text(ev.x, ev.y - 40, 'PLEASE HOLD', '#ff9ad0', 16); break;
      case 'press1': this.text(ev.x, ev.y - 40, 'WRONG DEPARTMENT!', '#ff9ad0', 15); break;
      case 'income': this.text(ev.x, ev.y - 40, '+$$$', '#7dff8a', 22, 1.3); break;
      case 'leak': this.text(ev.x || W - 140, ev.y || 300, `-${ev.n}`, '#ff6a5a', 26, 1); break;
      case 'place': case 'upgrade':
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; this.add({ k: 'puff', x: ev.x, y: ev.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, r: 6, col: ev.k === 'upgrade' ? '#ffe066' : '#d8d4c8', life: 0.4, max: 0.4 }); }
        if (ev.k === 'upgrade') this.text(ev.x, ev.y - 34, 'PROMOTED!', '#ffe066', 20, 1);
        break;
      case 'sell': this.text(ev.x, ev.y - 20, `+$${ev.v}`, '#7dff8a', 22, 1.2); break;
      case 'flash':
        this.add({ k: 'flashb', x: ev.x, y: ev.y, r: ev.r, life: 0.25, max: 0.25 });
        if (Math.random() < 0.3) this.text(ev.x, ev.y - 36, 'SNAP!', '#fff', 16, 0.6);
        break;
      case 'stomp':
        this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#f0c870', life: 0.35, max: 0.35 });
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; this.add({ k: 'bill', x: ev.x + Math.cos(a) * 20, y: ev.y + Math.sin(a) * 20, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, r: 7, col: '#fff', life: 0.4, max: 0.4, rot: a, paper: true }); }
        if (ev.shake) this.shake = Math.max(this.shake, 5);
        break;
      case 'smash':
        this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.big ? 70 : 30, col: '#ffd34d', life: 0.4, max: 0.4 });
        this.text(ev.x, ev.y - 30, ev.big ? 'METEOR!' : 'SLAM!', '#ffd34d', ev.big ? 30 : 22, 0.8);
        this.shake = Math.max(this.shake, ev.big ? 12 : 6);
        break;
      case 'rizz':
        this.add({ k: 'tint', col: 'rgba(255,60,60,', life: 0.7, max: 0.7 });
        this.text(ev.x, ev.y - 40, 'YOU ARE BEING AUDITED', '#ff6a5a', 24, 1.4, -20);
        break;
      case 'reveal': this.text(ev.x, ev.y - 24, 'BUSTED', '#ff7ab8', 15, 0.8); break;
      case 'pull': this.add({ k: 'ring', x: ev.x, y: ev.y, r: ev.r, col: '#a04dff', life: 0.5, max: 0.5 }); break;
      case 'drop': this.add({ k: 'puff', x: ev.x, y: ev.y, vx: 0, vy: -20, r: 8, col: '#d8d4c8', life: 0.3, max: 0.3 }); break;
      case 'kick':
        this.add({ k: 'ring', x: ev.x, y: ev.y, r: 22, col: '#fff', life: 0.25, max: 0.25 });
        if (Math.random() < 0.35) this.text(ev.x, ev.y - 26, ['KICK!', 'HIYAA!', 'WHAM!'][(Math.random() * 3) | 0], '#ffe066', 18, 0.6);
        break;
      case 'grab':
        this.add({ k: 'ring', x: ev.x, y: ev.y, r: 30, col: '#7dff8a', life: 0.35, max: 0.35 });
        this.text(ev.x, ev.y - 30, ['PAY UP!', 'GOTCHA!', 'DEBT COLLECTED'][(Math.random() * 3) | 0], '#7dff8a', 18, 0.8);
        break;
      case 'cannon':
        for (let i = 0; i < 5; i++) { const a = Math.random() * TAU; this.add({ k: 'puff', x: ev.x, y: ev.y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 20, r: 10, col: '#e8e8e8', life: 0.5, max: 0.5 }); }
        this.shake = Math.max(this.shake, 2);
        break;
    }
  }
  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      if (p.vx != null) { p.x += p.vx * dt; p.vx *= 0.92; }
      if (p.vy != null) { p.y += p.vy * dt; if (p.k === 'puff' || p.k === 'bill') p.vy *= 0.92; }
      if (p.k === 'bill') p.rot += dt * 8;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    this.shake = Math.max(0, this.shake - dt * 40);
  }
  drawOver(c) {
    for (const p of this.parts) {
      const f = p.life / p.max;
      c.globalAlpha = Math.min(1, f * 1.5);
      if (p.k === 'tint') { c.fillStyle = p.col + (f * 0.25) + ')'; c.fillRect(0, 0, W, H); }
      else if (p.k === 'flashb') circ(c, p.x, p.y, p.r * (1.15 - f * 0.25), `rgba(255,255,255,${f * 0.55})`, null);
      else if (p.k === 'puff') circ(c, p.x, p.y, p.r * (1.6 - f * 0.6), p.col, null);
      else if (p.k === 'bill') {   // a flying banknote (or a sheet of paper)
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        rr(c, -7, -4, 14, 8, 1, p.paper ? '#fff' : '#8fdc8a', INK, 1);
        if (!p.paper) text(c, '$', 0, 0.5, 7, '#2b6b22', null);
        c.restore();
      }
      else if (p.k === 'ring') circ(c, p.x, p.y, p.r * (1.1 - f * 0.3), null, p.col, 5 * f + 1);
      else if (p.k === 'txt') text(c, p.s, p.x, p.y, p.size, p.col, INK);
    }
    c.globalAlpha = 1;
  }
}

// ---------- full frame ----------
const reach = s => (s.orbit ? s.orbit + s.range : s.range);

function heaven(c, b, t) {
  // slowly turning rays of light above the bank
  const cx = b.x + b.w / 2, cy = b.y + b.h * 0.2;
  c.save();
  c.beginPath(); c.rect(b.x - b.w * 0.6, b.y - 60, b.w * 2.2, b.h + 80); c.clip();
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU + t * 0.12;
    c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, b.h * 1.1, a, a + 0.16); c.closePath();
    c.fillStyle = 'rgba(255,240,150,0.16)'; c.fill();
  }
  c.restore();
  ell(c, cx, b.y + b.h * 0.28 - 26 - Math.sin(t * 2) * 2, b.w * 0.18, 6, null, 'rgba(255,230,90,0.95)', 3);   // halo over the dome
  for (let i = 0; i < 4; i++) {
    const p = (t * 0.4 + i / 4) % 1;
    c.globalAlpha = Math.sin(p * Math.PI);
    text(c, '✦', b.x + 10 + ((i * 53) % (b.w - 20)), b.y + b.h * 0.8 - p * b.h * 0.7, 12, '#fff6a0', null);
    c.globalAlpha = 1;
  }
}

export function drawWorld(c, game, bg, fx, t, ui) {
  c.drawImage(bg, 0, 0, W, H);
  for (const b of game.map.blockers) if (b.kind === 'bank') heaven(c, b, t);
  if (game.map.id === 'street') text(c, `WAVE  ${game.round + 1}`, 765, 126, 14, '#7dff8a', INK);
  for (const tr of game.traps) drawTrap(c, tr, t);
  if (ui.sel) rangeCircle(c, ui.sel.x, ui.sel.y, reach(ui.sel.es || ui.sel.s), true);
  // robbers underground: a dark shadow with glowing eyes moving under the grass
  for (const e of game.enemies) if (e.under && e.d > 30) {
    c.globalAlpha = 0.35 + Math.sin(t * 6 + e.seed) * 0.1;
    ell(c, e.x, e.y, e.r * 0.9, e.r * 0.6, '#16120f', null, 0, e.ang);
    c.globalAlpha = 1;
    for (const s of [-1, 1]) circ(c, e.x + Math.cos(e.ang + s * 0.5) * e.r * 0.5, e.y + Math.sin(e.ang + s * 0.5) * e.r * 0.5, 2, '#ffe066', null);
  }
  // depth sort officials and robbers together
  const items = [];
  for (const tw of game.towers) items.push({ y: tw.y, tw });
  for (const e of game.enemies) if (!(e.under && e.d > 30)) items.push({ y: e.y, e });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.e) {
      const e = it.e;
      if (e.d < 30) {        // climbing out of the manhole
        const k = 0.35 + 0.65 * Math.max(0, e.d) / 30;
        c.save(); c.translate(e.x, e.y); c.scale(k, k); c.translate(-e.x, -e.y);
        drawSinner(c, e, t); c.restore();
      } else drawSinner(c, e, t);
    } else {
      const tw = it.tw;
      if (tw === ui.sel) circ(c, tw.x, tw.y, tw.r + 8, null, '#ffe066', 3);
      drawTower(c, tw.key, tw.x, tw.y, { ang: tw.ang, lvl: tw.lvl, anim: tw.anim, spin: tw.spin, t, range: tw.s.range });
    }
  }
  for (const p of game.paths) manholeRim(c, p.px[0], p.py[0]);
  for (const tw of game.towers) if (tw.key === 'drone') {
    const s = tw.es || tw.s;
    if (!tw.dpos.length) tw.dpos = [{ x: tw.x + s.orbit, y: tw.y, a: 0 }];
    for (const d of tw.dpos) drawDrone(c, d.x, d.y, d.a, t, tw.lvl);
  }
  for (const p of game.projs) drawProj(c, p, t);
  fx.drawOver(c);
  for (const e of game.enemies) if (!e.under) drawBubble(c, e);
  for (const tw of game.towers) drawBubble(c, tw, true);
  if (ui.ghost) {
    const g = ui.ghost;
    rangeCircle(c, g.x, g.y, reach(TOWERS[g.key].base), g.ok);
    c.globalAlpha = 0.8;
    drawTower(c, g.key, g.x, g.y, { lvl: [0, 0, 0], t });
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
