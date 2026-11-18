// Idle Lift 2D: a side view of the resort, drawn on a canvas in a flat cartoon style
// with dark outlines. Drag (or scroll) left and right to look along the valley.
import * as E from './econ.js';

const { PEAKS } = E;
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const $ = (id) => document.getElementById(id);
const INK = '#2b2340', SNOW = '#fffaf3', SHADE = '#d6d3f2';
const DIFF = ['#3fae5a', '#3d7fe0', '#e04848', '#2b2f37'];
const JACKETS = ['#e5484d', '#2f7fe6', '#f2c230', '#34b05a', '#f2793a', '#a25be0', '#24b8b0', '#e85aa0', '#3a50c8'];
const LIFTC = { drag: '#f2a33a', chair: '#3d8bff', gondola: '#e5484d' };
const KEY = 'idlelift2d.v1';

// ---------- the world ----------
// World units: x to the right, y up from the valley floor. Each mountain is 440 wide.
const STEP = 460;
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const G = PEAKS.map((p, i) => {
  const fx = i * STEP, sx = fx + 230, rx = fx + 440;
  const g = { ...p, fx, sx, rx, h: p.h };
  g.bx = fx + 30; g.tx = sx - 24;
  g.H0 = p.lift === 'drag' ? 16 : 36;
  g.trees = []; g.rocks = []; g.poles = [];
  for (let k = 0; k < 34; k++) {
    const x = fx + 12 + rnd() * 416, y = yAt(g, x);
    if (y < g.h * 0.45 && Math.abs(x - g.bx) > 14 && (x < g.bx || x > g.tx + 10 || rnd() < 0.5)) g.trees.push({ x, y: y - 2, s: 0.7 + rnd() * 0.6 });
  }
  g.trees.sort((a, b) => b.y - a.y);
  for (let k = 0; k < 6; k++) { const x = sx - 110 + rnd() * 220; g.rocks.push({ x, w: 8 + rnd() * 12 }); }
  for (let x = sx + 30; x < rx - 20; x += 42) g.poles.push(x);
  return g;
});
function yAt(g, x) {
  if (x <= g.fx || x >= g.rx) return 0;
  if (x <= g.sx) { const u = (x - g.fx) / (g.sx - g.fx); return g.h * Math.pow(u, 1.55) + Math.sin(u * 9 + g.i) * 18 * u * (1 - u); }
  const v = (x - g.sx) / (g.rx - g.sx);
  return g.h * Math.pow(1 - v, 1.35) + Math.sin(v * 11 + g.i * 2) * 18 * v * (1 - v);
}
const cableY = (g, x) => { const y0 = yAt(g, g.bx) + g.H0, y1 = yAt(g, g.tx) + g.H0; return y0 + (y1 - y0) * (x - g.bx) / (g.tx - g.bx); };

// ---------- state ----------
let s = E.newGame(), away = null;
try { const t = localStorage.getItem(KEY); if (t) { s = E.fromSave(t); away = E.offline(s); } } catch { s = E.newGame(); }
const save = () => { try { localStorage.setItem(KEY, E.toSave(s)); } catch {} };
setInterval(save, 5000);
addEventListener('visibilitychange', () => { if (document.hidden) save(); else { const a = E.offline(s); if (a.pay > 0) showAway(a); } });
addEventListener('pagehide', save);

// ---------- screen ----------
let W = 0, H = 0, dpr = 1, k = 1, groundY = 0, camX = -330, camGo = null;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  // Fit the tallest mountain open (plus the next one) and the valley floor; on a narrow
  // screen fit one mountain across instead.
  const open = Math.max(1, E.nextPeak(s) < 0 ? PEAKS.length : E.nextPeak(s) + 1);
  const tall = G[Math.min(PEAKS.length - 1, open - 1)].h + 110;
  const bottom = Math.max(110, H * 0.17);
  k = Math.min((H - bottom - 80) / tall, W / (W < H ? 330 : 470));
  k = Math.max(0.55, Math.min(k, 2.2));
  // On a tall screen the valley floor moves up and the foreground fills the space below.
  groundY = Math.min(H - bottom, 80 + (tall + 30) * k);
  clampCam();
}
addEventListener('resize', resize);
const minCam = () => -420;
const maxCam = () => { const n = E.nextPeak(s), last = n < 0 ? PEAKS.length - 1 : n; return G[last].rx + 40 - W / k; };
function clampCam() { camX = Math.max(minCam(), Math.min(Math.max(minCam(), maxCam()), camX)); }
const SX = (x) => (x - camX) * k, SY = (y) => groundY - y * k;
const WX = (px) => px / k + camX, WY = (py) => (groundY - py) / k;

// Draw in world units: (x, -y) with the transform below.
function world() { ctx.setTransform(k * dpr, 0, 0, k * dpr, -camX * k * dpr, groundY * dpr); }
function screen() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
function ink(w = 2.2) { ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function fillStroke(fill, w = 2.2) { ctx.fillStyle = fill; ctx.fill(); ink(w); ctx.stroke(); }

// ---------- drawing: sky and far hills ----------
function sky(t) {
  screen();
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#7fb4e6'); gr.addColorStop(0.6, '#cfe4f3'); gr.addColorStop(1, '#ffe6d2');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  // A soft low sun.
  const sx = W * 0.78, sy = groundY - 330 * k;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 130 * k);
  sg.addColorStop(0, 'rgba(255,240,200,.95)'); sg.addColorStop(0.3, 'rgba(255,226,170,.5)'); sg.addColorStop(1, 'rgba(255,226,170,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  // Far mountains, moving slower than the near ones.
  for (const [par, col, hh, wave] of [[0.25, '#b9c4ea', 260, 300], [0.45, '#cdd4f0', 190, 220]]) {
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let px = 0; px <= W + 20; px += 16) {
      const wx = px / k + camX * par;
      const y = hh * (0.55 + 0.25 * Math.sin(wx / wave) + 0.2 * Math.sin(wx / (wave * 0.37) + 1.3));
      ctx.lineTo(px, groundY - y * k);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  // Clouds drifting.
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  for (let c = 0; c < 7; c++) {
    const span = W / k + 400, wx = ((c * 377 + t * (6 + c)) % span) - 200, x = wx * k - (camX * 0.6 % 400) * 0, y = groundY - (380 + (c % 3) * 55) * k;
    const r = (18 + (c % 4) * 6) * k;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.arc(x + r, y - r * 0.4, r * 1.15, 0, 7); ctx.arc(x + r * 2.1, y, r * 0.9, 0, 7); ctx.fill();
  }
}

// ---------- drawing: one mountain ----------
function mountain(g, locked) {
  world();
  const path = () => { ctx.beginPath(); ctx.moveTo(g.fx - 6, 4); for (let x = g.fx; x <= g.rx; x += 6) ctx.lineTo(x, -yAt(g, x)); ctx.lineTo(g.rx + 6, 4); ctx.closePath(); };
  path();
  const gr = ctx.createLinearGradient(0, -g.h, 0, 0);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#f3ede6');
  ctx.fillStyle = gr; ctx.fill();
  ctx.save(); path(); ctx.clip();
  // The shady side.
  ctx.beginPath(); ctx.moveTo(g.sx, -g.h - 4);
  for (let x = g.sx; x <= g.rx; x += 8) ctx.lineTo(x, -yAt(g, x));
  ctx.lineTo(g.sx + (g.rx - g.sx) * 0.25, 0); ctx.lineTo(g.sx - 10, -g.h * 0.55); ctx.closePath();
  ctx.fillStyle = SHADE; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
  path(); ink(2.6); ctx.stroke();
  // Trees.
  for (const t of g.trees) tree(t.x, t.y, t.s);
  if (locked) { path(); ctx.fillStyle = 'rgba(230,225,240,.55)'; ctx.fill(); }
}
function tree(x, y, sc) {
  const w = 11 * sc, h = 26 * sc;
  ctx.fillStyle = '#7a5640'; ctx.fillRect(x - 1.5 * sc, -y - 5 * sc, 3 * sc, 6 * sc);
  for (let l = 0; l < 3; l++) {
    const yb = -y - 4 * sc - l * 7 * sc, ww = w * (1 - l * 0.25);
    ctx.beginPath(); ctx.moveTo(x - ww, yb); ctx.lineTo(x, yb - h * 0.45); ctx.lineTo(x + ww, yb); ctx.closePath();
    ctx.fillStyle = l % 2 ? '#56996c' : '#4b8a5c'; ctx.fill(); ink(1.6); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(x - 3.5 * sc, -y - 4 * sc - 14 * sc - h * 0.3); ctx.lineTo(x, -y - 4 * sc - 14 * sc - h * 0.45); ctx.lineTo(x + 3.5 * sc, -y - 4 * sc - 14 * sc - h * 0.3); ctx.closePath();
  ctx.fillStyle = SNOW; ctx.fill();
}

// The piste down the sunny side to the right: marker poles in the piste colour.
function piste(g) {
  ctx.beginPath();
  for (let x = g.sx + 6; x <= g.rx - 10; x += 6) ctx.lineTo(x, -yAt(g, x) + 3);
  ctx.strokeStyle = DIFF[g.diff]; ctx.lineWidth = 2.4; ctx.setLineDash([7, 6]); ctx.stroke(); ctx.setLineDash([]);
  for (const x of g.poles) {
    const y = yAt(g, x);
    ctx.fillStyle = INK; ctx.fillRect(x - 0.9, -y - 13, 1.8, 13);
    ctx.fillStyle = DIFF[g.diff]; ctx.fillRect(x - 1.6, -y - 13, 3.2, 5);
  }
}

// Stations, towers, the cable and the chairs.
function lift(g, t, speed, open) {
  const c = LIFTC[g.lift];
  // Towers.
  for (let x = g.bx + 55; x < g.tx - 30; x += 70) {
    const y0 = yAt(g, x), y1 = cableY(g, x);
    ctx.beginPath(); ctx.moveTo(x, -y0); ctx.lineTo(x, -y1 - 3); ink(3.4); ctx.stroke();
    ctx.strokeStyle = '#8e95a3'; ctx.lineWidth = 1.6; ctx.stroke();
    rr(x - 6, -y1 - 5, 12, 4, 1.5); fillStroke('#8e95a3', 1.4);
  }
  // Two cables: up in front, back down behind.
  const by = cableY(g, g.bx), ty = cableY(g, g.tx);
  for (const off of [-3, 2]) { ctx.beginPath(); ctx.moveTo(g.bx, -by + off); ctx.lineTo(g.tx, -ty + off); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); }
  // Chairs or cabins moving along, evenly spaced.
  if (open) {
    const len = Math.hypot(g.tx - g.bx, ty - by), gap = g.lift === 'gondola' ? 60 : 38, ux = (g.tx - g.bx) / len, uy = (ty - by) / len;
    const off = (t * speed) % gap;
    for (let d = off; d < len; d += gap) {
      const up = { x: g.bx + ux * d, y: by + uy * d }, dn = { x: g.tx - ux * d, y: ty - uy * d };
      carrier(g, dn.x, dn.y - 2, false, c, d);
      carrier(g, up.x, up.y + 3, true, c, d);
    }
  }
  // Stations: a hut at the bottom and the top, with the big wheel.
  station(g.bx, yAt(g, g.bx), by, c, false);
  station(g.tx, yAt(g, g.tx), ty, c, true);
}
function carrier(g, x, y, full, c, d) {
  if (g.lift === 'drag') {
    if (!full) { ctx.beginPath(); ctx.moveTo(x, -y); ctx.lineTo(x, -y + 8); ink(1.2); ctx.stroke(); return; }
    // Someone pulled up the slope on the bar.
    const gy = yAt(g, x);
    ctx.beginPath(); ctx.moveTo(x, -y); ctx.lineTo(x - 2, -gy - 9); ink(1.2); ctx.stroke();
    person(x - 3, gy, 0.95, JACKETS[(d | 0) % JACKETS.length], 'stand', Math.atan2(yAt(g, x + 3) - yAt(g, x - 3), 6));
    return;
  }
  if (g.lift === 'chair') {
    ctx.beginPath(); ctx.moveTo(x, -y); ctx.lineTo(x, -y + 16); ink(1.5); ctx.stroke();
    if (full) person(x - 1, y - 23, 0.95, JACKETS[(d | 0) % JACKETS.length], 'sit', 0);
    rr(x - 8, -y + 15, 14, 3.2, 1.5); fillStroke(c, 1.3);
    rr(x + 4, -y + 7, 3, 10, 1.2); fillStroke(c, 1.3);
    return;
  }
  ctx.beginPath(); ctx.moveTo(x, -y); ctx.lineTo(x, -y + 7); ink(1.5); ctx.stroke();
  rr(x - 9, -y + 6, 18, 17, 4); fillStroke(c, 1.6);
  rr(x - 6.5, -y + 9, 13, 7, 2); fillStroke(full ? '#ffe2a8' : '#cfe6f5', 1.1);
  if (full) for (const dx of [-3, 3]) { ctx.beginPath(); ctx.arc(x + dx, -y + 13.5, 2, 0, 7); ctx.fillStyle = JACKETS[((d | 0) + dx + 9) % JACKETS.length]; ctx.fill(); }
}
function station(x, gy, cy, c, top) {
  const w = 30, h = Math.max(16, cy - gy - 6);
  rr(x - w / 2, -gy - h, w, h + 2, 3); fillStroke('#a86f45');
  rr(x - w / 2 + 4, -gy - h + 5, 8, 7, 1.5); fillStroke('#ffd27a', 1.4);
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 4, -gy - h); ctx.lineTo(x, -gy - h - 11); ctx.lineTo(x + w / 2 + 4, -gy - h); ctx.closePath(); fillStroke(c);
  ctx.beginPath(); ctx.moveTo(x - w / 2 - 1, -gy - h - 1.5); ctx.lineTo(x, -gy - h - 9); ctx.lineTo(x + w / 2 + 1, -gy - h - 1.5); ctx.strokeStyle = SNOW; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + (top ? -6 : 6), -cy, 7, 2.6, 0, 0, 7); fillStroke('#5a5f6b', 1.4);
}

// A little person: round head, beanie with a pompom, jacket, skis.
function person(x, y, sc, jacket, pose, ang, flip = 1) {
  ctx.save(); ctx.translate(x, -y); ctx.rotate(-ang); ctx.scale(sc * flip, sc);
  ink(1.3);
  if (pose === 'sit') {
    rr(-3, -9, 9, 3.4, 1.5); fillStroke('#3a3f4a', 1.2);                   // legs forward
    rr(-4, -16, 7, 9, 2.5); fillStroke(jacket, 1.3);
  } else {
    if (pose !== 'walk') { ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(9, 0); ctx.lineTo(10.5, -1.6); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke(); ctx.strokeStyle = jacket; ctx.lineWidth = 1.2; ctx.stroke(); }
    const lean = pose === 'ski' ? 2 : 0;
    rr(-3 + lean * 0.4, -8, 6, 8, 1.5); fillStroke('#3a3f4a', 1.2);         // trousers
    rr(-3.6 + lean, -16, 7.2, 9, 2.5); fillStroke(jacket, 1.3);              // jacket
    if (pose === 'ski') { ctx.beginPath(); ctx.moveTo(lean - 2, -11); ctx.lineTo(-7, -1); ctx.moveTo(lean + 2, -11); ctx.lineTo(5, -1); ink(1); ctx.stroke(); }
  }
  const hx = pose === 'ski' ? 2 : pose === 'sit' ? -0.5 : 0;
  ctx.beginPath(); ctx.arc(hx, -19.5, 4, 0, 7); fillStroke('#f2c9a0', 1.3);
  ctx.beginPath(); ctx.arc(hx, -20.5, 4.3, Math.PI, 0); ctx.closePath(); fillStroke(jacket, 1.2);
  ctx.beginPath(); ctx.arc(hx, -25.2, 1.7, 0, 7); fillStroke('#fffaf3', 1);
  ctx.restore();
}

// ---------- the valley floor and the village ----------
const CARS = [];
function ground() {
  world();
  const x0 = camX - 10, x1 = camX + W / k + 10;
  ctx.fillStyle = '#f7f1ea'; ctx.fillRect(x0, -1, x1 - x0, 300);
  ctx.beginPath(); ctx.moveTo(x0, -1); ctx.lineTo(x1, -1); ink(2.6); ctx.stroke();
  // A packed-snow path in front of the mountains and the road through the village.
  ctx.fillStyle = '#ece3db'; ctx.fillRect(x0, 22, x1 - x0, 14);
  ctx.fillStyle = '#8b8188'; ctx.fillRect(Math.max(x0, -460), 52, Math.min(x1, -10) - Math.max(x0, -460), 22);
  ctx.fillStyle = '#fff4e4'; for (let x = -450; x < -20; x += 22) if (x > x0 - 20 && x < x1) ctx.fillRect(x, 62, 11, 2);
  // Fence posts along the path, and below it frozen ponds and little woods.
  for (let x = Math.floor(x0 / 30) * 30; x < x1; x += 30) if (x > -20) { ctx.fillStyle = '#9a6a3a'; ctx.fillRect(x, 38, 2.4, 9); if (x % 60 === 0) ctx.fillRect(x, 40, 30, 1.8); }
  const deep = (H - groundY) / k;
  if (deep > 100) for (let c = Math.floor(x0 / 300) - 1; c * 300 < x1 + 300; c++) {
    const h = ((c * 2654435761) >>> 0) / 4294967296, cx = c * 300 + h * 120;
    if (c % 3 === 0 && deep > 150) { ctx.beginPath(); ctx.ellipse(cx + 120, 125, 90, 22, 0, 0, 7); ctx.fillStyle = '#bfe0ef'; ctx.fill(); ink(2.2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + 100, 120, 40, 7, 0, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fill(); }
    for (let t = 0; t < 5; t++) { const hx = ((c * 31 + t * 97) * 2654435761 >>> 0) / 4294967296; tree(cx + t * 46 + hx * 20 - 20, -(88 + (t % 2) * 26 + hx * 18), 1.1 + hx * 0.4); }
  }
}
function village(t) {
  world();
  // Ski hut: grows a floor with each upgrade (up to three).
  const hx = -150, fl = Math.min(3, 1 + Math.floor(s.H / 2));
  for (let f = 0; f < fl; f++) { rr(hx - 38, -14 - f * 20 - 20 + 14, 76, 22, 2); fillStroke(f % 2 ? '#b87c4e' : '#a86f45'); for (const wx of [-24, -6, 12]) { rr(hx + wx, -14 - f * 20 - 14 + 14, 10, 9, 1.5); fillStroke('#ffd27a', 1.3); } }
  const ry = -fl * 20 - 2;
  ctx.beginPath(); ctx.moveTo(hx - 48, ry + 2); ctx.lineTo(hx, ry - 26); ctx.lineTo(hx + 48, ry + 2); ctx.closePath(); fillStroke('#a4473a');
  ctx.beginPath(); ctx.moveTo(hx - 44, ry - 1); ctx.lineTo(hx, ry - 23); ctx.lineTo(hx + 44, ry - 1); ctx.strokeStyle = SNOW; ctx.lineWidth = 4; ctx.stroke();
  rr(hx + 20, ry - 30, 7, 16, 1); fillStroke('#8a8088', 1.4);
  for (let p = 0; p < 4; p++) { const u = ((t * 0.25 + p / 4) % 1); ctx.beginPath(); ctx.arc(hx + 23.5 + u * 10 + Math.sin(u * 6 + p) * 2, ry - 34 - u * 34, 3 + u * 6, 0, 7); ctx.fillStyle = `rgba(255,250,245,${0.7 * (1 - u)})`; ctx.fill(); }
  label(hx, ry - 36, 'Ski hut', '#5a3a1c');
  // Car park sign and the ticket booth.
  rr(-330, -40, 4, 40, 1); fillStroke('#6b6f7a', 1.4);
  rr(-342, -62, 28, 24, 4); fillStroke('#2f6fd6', 2);
  ctx.fillStyle = '#fff'; ctx.font = '700 17px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('P', -328, -50);
  rr(-62, -34, 34, 34, 3); fillStroke('#e98a7c'); rr(-56, -28, 22, 12, 2); fillStroke('#ffd27a', 1.4);
  ctx.beginPath(); ctx.moveTo(-68, -34); ctx.lineTo(-45, -46); ctx.lineTo(-22, -34); ctx.closePath(); fillStroke('#fff4e6');
  label(-45, -52, 'Tickets', '#5a3a1c');
  // Cars: more of them as the car park grows. Each drives in, parks a while, drives off.
  const want = Math.min(10, 2 + s.G);
  while (CARS.length < want) CARS.push({ x: -480 - Math.random() * 200, spot: CARS.length, wait: 4 + Math.random() * 8, st: 'in', col: JACKETS[(Math.random() * 9) | 0] });
  for (const c of CARS) {
    const px = -430 + c.spot * 34;
    ctx.save(); ctx.translate(c.x, 64); if (c.st === 'out') ctx.scale(-1, 1);
    rr(-14, -12, 28, 9, 3); fillStroke(c.col, 1.6); rr(-8, -18, 15, 7, 3); fillStroke('#cfe6f5', 1.4);
    for (const wx of [-8, 8]) { ctx.beginPath(); ctx.arc(wx, -2.5, 3.4, 0, 7); fillStroke('#2b2326', 1.3); }
    ctx.restore();
    c.target = px;
  }
}
function updateCars(dt) {
  for (const c of CARS) {
    if (c.st === 'in') { c.x += Math.min(90, (c.target - c.x) * 2 + 10) * dt; if (c.x >= c.target - 0.5) { c.x = c.target; c.st = 'park'; } }
    else if (c.st === 'park') { c.wait -= dt; if (c.wait <= 0) c.st = 'out'; }
    else { c.x -= 70 * dt; if (c.x < camX - 200 && c.x < -500) { c.x = -520 - Math.random() * 300; c.st = 'in'; c.wait = 6 + Math.random() * 12; } }
  }
}
function label(x, y, text, col) {
  ctx.font = '600 11px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 10;
  rr(x - w / 2, y - 8, w, 15, 7); ctx.fillStyle = 'rgba(255,248,236,.92)'; ctx.fill(); ink(1.3); ctx.stroke();
  ctx.fillStyle = col; ctx.fillText(text, x, y);
}

// ---------- guests on each open mountain ----------
// Skiers come down the piste, walk back along the path and wait in line for the lift.
function guests(g, t, speed) {
  const L = s.lv[g.i], n = Math.min(14, 3 + Math.floor(L / 6));
  const skiLen = g.rx - g.sx, walk = g.rx - g.bx + 30;
  const cycle = skiLen / 70 + walk / 22 + 6;
  const queue = [];
  for (let m = 0; m < n; m++) {
    const ph = ((t / cycle + m / n + g.i * 0.13) % 1) * cycle;
    const col = JACKETS[(m * 4 + g.i) % JACKETS.length];
    if (ph < skiLen / 70) {
      const x = g.sx + 8 + ph * 70 * 0.96, y = yAt(g, x), a = Math.atan2(yAt(g, x + 3) - yAt(g, x - 3), 6);
      const hop = Math.max(0, Math.sin((x - g.sx) / 26 + m)) > 0.97 ? 5 : 0;
      person(x, y + hop, 0.95, col, 'ski', a);
    } else if (ph < skiLen / 70 + walk / 22) {
      const u = (ph - skiLen / 70) * 22, x = g.rx - u;
      person(x, -29 + Math.abs(Math.sin(t * 9 + m)) * 0.8, 0.9, col, 'walk', 0, -1);
    } else queue.push(col);
  }
  queue.slice(0, 8).forEach((col, q) => person(g.bx - 22 - q * 9, -1, 0.9, col, 'stand', 0));
}

// ---------- level badges, the build sign, money pops ----------
const hits = [];
function badges(t) {
  screen(); hits.length = 0;
  for (const g of G) {
    const L = s.lv[g.i], x = SX(g.bx), y = SY(cableY(g, g.bx) + 34);
    if (x < -80 || x > W + 80) continue;
    if (L) {
      const can = s.money >= E.upCost(s, g.i), w = 78, h = 30;
      ctx.save(); ctx.translate(x, y + (can ? Math.sin(t * 5) * 1.5 : 0));
      rr(-w / 2, -h / 2, w, h, 10); ctx.fillStyle = can ? '#45b860' : '#a58a6b'; ctx.fill(); ink(2.4); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '600 15px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((can ? '▲ ' : '') + 'Lv ' + L, 0, 1);
      ctx.restore();
      hits.push({ x: x - w / 2, y: y - h / 2, w, h, act: () => openLift(g.i) });
      // The lift station itself: tap to speed it up for a moment.
      const sx = SX(g.bx), sy = SY(yAt(g, g.bx) + 20);
      hits.push({ x: sx - 24 * k, y: sy - 26 * k, w: 48 * k, h: 40 * k, act: () => { E.tap(s, g.i); pop(g.tx, cableY(g, g.tx) + 30, 'Boost!', '#ffd23a'); } });
      if (s.tap[g.i] > 0) { ctx.font = '600 13px Fredoka, sans-serif'; ctx.fillStyle = '#ffb000'; ctx.textAlign = 'center'; ctx.fillText('⚡ ×2', x, y - 24); }
      // Name board.
      ctx.font = '600 13px Fredoka, sans-serif';
      const nm = g.name, nw = ctx.measureText(nm).width + 16, ny = SY(g.h + 48);
      rr(SX(g.sx) - nw / 2, ny - 10, nw, 20, 8); ctx.fillStyle = 'rgba(255,248,236,.9)'; ctx.fill(); ink(1.6); ctx.stroke();
      ctx.fillStyle = '#4a2f18'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(nm, SX(g.sx), ny + 1);
    } else if (g.i === E.nextPeak(s)) {
      const can = s.money >= g.unlock, cx = SX(g.sx), cy = SY(g.h * 0.45), w = 150, h = 58;
      ctx.save(); ctx.translate(cx, cy + (can ? Math.sin(t * 4) * 2 : 0));
      rr(-w / 2, -h / 2, w, h, 14); ctx.fillStyle = can ? '#45b860' : '#8f7a63'; ctx.fill(); ink(2.6); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 15px Fredoka, sans-serif'; ctx.fillText('Build ' + g.name, 0, -10);
      ctx.font = '600 17px Fredoka, sans-serif'; ctx.fillText('$' + E.fmt(g.unlock), 0, 12);
      ctx.restore();
      hits.push({ x: cx - w / 2, y: cy - h / 2, w, h, act: () => build(g.i) });
    }
  }
  // Tutorial hand on the first badge until the first upgrade.
  if (s.lv[0] === 1 && s.earned < 60) {
    const g = G[0], x = SX(g.bx) + 30, y = SY(cableY(g, g.bx) + 34) + 22 + Math.sin(t * 6) * 4;
    ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.fillText('👆', x, y + 10);
  }
}
const pops = [];
function pop(x, y, text, col = '#fff') { pops.push({ x, y, text, col, t: 0 }); }
function drawPops(dt) {
  screen();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 16px Fredoka, sans-serif';
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt;
    if (p.t > 1.4) { pops.splice(i, 1); continue; }
    const x = SX(p.x), y = SY(p.y) - p.t * 26;
    ctx.globalAlpha = Math.min(1, (1.4 - p.t) * 2);
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(p.text, x, y);
    ctx.fillStyle = p.col; ctx.fillText(p.text, x, y);
  }
  ctx.globalAlpha = 1;
}

// ---------- main loop ----------
const acc = PEAKS.map(() => 0), lastPop = PEAKS.map(() => 0);
let last = performance.now(), time = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt;
  E.tick(s, dt);
  if (camGo !== null) { camX += (camGo - camX) * Math.min(1, dt * 4); if (Math.abs(camGo - camX) < 1) camGo = null; clampCam(); }
  updateCars(dt);
  sky(time);
  // Back to front: mountains to the right sit behind those to the left.
  const vis = G.filter((g) => g.rx + 60 > camX && g.fx - 60 < camX + W / k && (s.lv[g.i] || g.i === E.nextPeak(s)));
  for (const g of [...vis].reverse()) {
    const open = s.lv[g.i] > 0;
    mountain(g, !open);
    if (!open) continue;
    piste(g);
    const r = E.rides(s.lv[g.i]) * (s.tap[g.i] > 0 ? 2 : 1) * (s.rush > 0 ? 2 : 1);
    const speed = Math.min(150, 26 + 16 * Math.log2(1 + r));
    lift(g, time, speed, true);
  }
  ground();
  for (const g of vis) if (s.lv[g.i]) guests(g, time, 0);
  village(time);
  // Money pops at the top stations, about once a second each.
  for (const g of G) {
    const L = s.lv[g.i]; if (!L) continue;
    acc[g.i] += E.liftRate(s, g.i) * (s.tap[g.i] > 0 ? E.T.TAP_X : 1) * dt; lastPop[g.i] += dt;
    if (lastPop[g.i] > 1.1) { if (g.rx > camX && g.fx < camX + W / k) pop(g.tx, cableY(g, g.tx) + 12, '+$' + E.fmt(acc[g.i]), '#ffe07a'); acc[g.i] = 0; lastPop[g.i] = 0; }
  }
  badges(time);
  drawPops(dt);
  hud();
  requestAnimationFrame(frame);
}

// ---------- input ----------
let down = null;
cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, cam: camX, moved: false }; cv.setPointerCapture(e.pointerId); camGo = null; });
cv.addEventListener('pointermove', (e) => {
  if (!down) return;
  const dx = e.clientX - down.x;
  if (Math.abs(dx) > 6 || Math.abs(e.clientY - down.y) > 6) down.moved = true;
  if (down.moved) { camX = down.cam - dx / k; clampCam(); }
});
cv.addEventListener('pointerup', (e) => {
  if (down && !down.moved) {
    const h = hits.find((b) => e.clientX >= b.x && e.clientX <= b.x + b.w && e.clientY >= b.y && e.clientY <= b.y + b.h);
    if (h) h.act();
    else if (WX(e.clientX) > -200 && WX(e.clientX) < -100 && WY(e.clientY) < 90) openResort();
  }
  down = null;
});
cv.addEventListener('wheel', (e) => { e.preventDefault(); camGo = null; camX += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / k; clampCam(); }, { passive: false });

// ---------- the panels ----------
let buyN = 1, sheet = null;
// Where to look at a mountain: all of it if it fits, else from its lift station.
const focus = (g) => (W / k >= 470 ? g.fx - (W / k - 440) / 2 : g.fx - 50);
function hud() {
  $('cash').textContent = '$' + E.fmt(s.money);
  $('rate').textContent = '+$' + E.fmt(E.rateOf(s)) + '/s';
  const r = $('rush');
  r.classList.toggle('on', s.rush > 0); r.classList.toggle('wait', s.rush <= 0 && s.rushWait > 0);
  $('rushT').textContent = s.rush > 0 ? Math.ceil(s.rush) + 's' : s.rushWait > 0 ? Math.ceil(s.rushWait) + 's' : '×2';
  if (sheet && (time * 4 | 0) !== hud.tick) { hud.tick = time * 4 | 0; sheet(); }
}
function openSheet(render) { sheet = render; render(); $('sheet').hidden = false; }
function closeSheet() { sheet = null; $('sheet').hidden = true; }
$('sheet').addEventListener('pointerdown', (e) => { if (e.target.id === 'sheet') closeSheet(); });
$('close').onclick = closeSheet;
function nOf(i) { return buyN === 'max' ? Math.max(1, E.maxBuy(s, i)) : buyN; }
function openLift(i) {
  const g = G[i];
  camGo = focus(g);
  openSheet(() => {
    const L = s.lv[i], n = nOf(i), cost = E.upCost(s, i, n), nm = E.nextMile(L);
    $('sheetBody').innerHTML = `
      <h2>${g.name}</h2>
      <p class="sub"><i style="background:${DIFF[g.diff]}"></i>${g.liftName} · Level ${L}</p>
      <div class="rows">
        <div><span>Rides per second</span><b>${E.fmt(E.rides(L))} <em>→ ${E.fmt(E.rides(L + n))}</em></b></div>
        <div><span>Ticket</span><b>$${E.fmt(g.price * E.globalX({ ...s, rush: 0 }))}</b></div>
        <div><span>Earns</span><b>$${E.fmt(E.liftRate(s, i))}/s <em>→ $${E.fmt(E.liftRate(s, i, L + n))}/s</em></b></div>
      </div>
      ${nm ? `<div class="mile"><span>Level ${nm}: lift speed ×2</span><div class="bar"><i style="width:${Math.min(100, (L / nm) * 100)}%"></i></div></div>` : ''}
      <div class="seg">${[1, 10, 'max'].map((v) => `<button data-n="${v}" class="${buyN === v ? 'on' : ''}">${v === 'max' ? 'MAX' : '×' + v}</button>`).join('')}</div>
      <button id="buy" class="big ${cost <= s.money ? '' : 'no'}">Upgrade ×${n}<small>$${E.fmt(cost)}</small></button>
      <p class="tip">Tip: tap the lift station for a short ×2 boost.</p>`;
    bindSeg(); $('buy').onclick = () => { if (E.upgrade(s, i, nOf(i))) { pop(g.bx, cableY(g, g.bx) + 50, 'Level up!', '#9cf29c'); sheet(); save(); } };
  });
}
function bindSeg() { for (const b of document.querySelectorAll('.seg button')) b.onclick = () => { buyN = b.dataset.n === 'max' ? 'max' : +b.dataset.n; sheet(); }; }
function openResort() {
  openSheet(() => {
    const gn = buyN === 'max' ? Math.max(1, E.maxG(s)) : buyN, gc = E.gCost(s, gn), hc = E.hCost(s);
    $('sheetBody').innerHTML = `
      <h2>Resort</h2>
      <p class="sub">Upgrades for every lift at once</p>
      <div class="card"><div><b>Car park</b><small>Level ${s.G} · more guests, +10% income each</small></div>
        <button id="bG" class="mid ${gc <= s.money ? '' : 'no'}">×${gn}<small>$${E.fmt(gc)}</small></button></div>
      <div class="card"><div><b>Ski hut</b><small>Level ${s.H} · hot food, ×1.4 income each</small></div>
        <button id="bH" class="mid ${hc <= s.money ? '' : 'no'}">+1<small>$${E.fmt(hc)}</small></button></div>
      <div class="seg">${[1, 10, 'max'].map((v) => `<button data-n="${v}" class="${buyN === v ? 'on' : ''}">${v === 'max' ? 'MAX' : '×' + v}</button>`).join('')}</div>
      <div class="rows">
        <div><span>All lifts earn</span><b>$${E.fmt(E.baseRate(s))}/s</b></div>
        <div><span>Bonus from car park and hut</span><b>×${E.fmt(E.globalX({ ...s, rush: 0 }))}</b></div>
        <div><span>Earned in total</span><b>$${E.fmt(s.earned)}</b></div>
      </div>
      <button id="reset" class="small">Start over</button>`;
    bindSeg();
    $('bG').onclick = () => { if (E.buyG(s, buyN === 'max' ? Math.max(1, E.maxG(s)) : buyN)) { sheet(); save(); } };
    $('bH').onclick = () => { if (E.buyH(s)) { sheet(); save(); } };
    $('reset').onclick = () => { if (confirm('Start over from the beginning? Your resort will be gone.')) { s = E.newGame(); save(); closeSheet(); camGo = -330; resize(); } };
  });
}
function build(i) {
  if (!E.unlock(s, i)) { toast(`Save up $${E.fmt(G[i].unlock)} to build ${G[i].name}.`); return; }
  save(); resize();
  camGo = focus(G[i]);
  toast(`${G[i].name} is open! Its ${G[i].liftName.toLowerCase()} earns $${E.fmt(G[i].price)} a ride.`);
}
$('resortBtn').onclick = openResort;
$('rush').onclick = () => { if (E.rush(s)) toast('Rush hour! Everything earns ×2 for 30 seconds.'); };
function toast(text) {
  const t = $('toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2600);
}
function showAway(a) {
  const m = Math.round(a.away / 60), h = Math.floor(m / 60);
  $('awayText').textContent = `In ${h ? h + 'h ' : ''}${m % 60}m your lifts earned`;
  $('awayPay').textContent = '$' + E.fmt(a.pay);
  $('away').hidden = false;
}
$('awayOk').onclick = () => { $('away').hidden = true; };

resize();
camX = W / k >= 900 ? -360 : G[0].fx - 50;
clampCam();
if (away && away.pay > 0) showAway(away);
document.fonts?.ready.then(() => {});
requestAnimationFrame(frame);
window.__l2 = { get s() { return s; }, E, G };
