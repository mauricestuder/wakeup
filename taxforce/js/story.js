// The intro comic: the robbers plan the heist, and the tax office has to
// protect the bank. Five animated panels drawn on one canvas. Tap / click /
// Space for the next panel, SKIP to jump straight into the game.

import { drawTower, drawSinner, circ, ell, rr, line, text, INK, FONT } from './draw.js';
import { sfx } from './audio.js';

const PW = 1200, PH = 640, TAU = Math.PI * 2;
const $ = id => document.getElementById(id);

// ---------- little drawing helpers ----------
function robber(c, type, x, y, r, ang, t, seed = 0.3, scale = 1) {
  c.save(); c.translate(x, y); c.scale(scale, scale); c.translate(-x, -y);
  drawSinner(c, { t: type, x, y, r, fa: ang, seed, flash: 0, burnT: 0, stunT: 0, slowF: 1, hp: 1, maxHp: 1, noBar: true }, t);
  c.restore();
}
function official(c, key, x, y, s, t, ang = Math.PI / 2) {
  drawTower(c, key, x, y, { icon: true, scale: s, lvl: [0, 0, 0], t, ang, anim: (Math.sin(t * 3) + 1) / 4, spin: t * 3, range: 60 });
}
// Yellow caption box in the top-left corner, like a comic.
function caption(c, lines, t) {
  const a = Math.min(1, t * 4);
  c.save(); c.globalAlpha = a;
  c.font = `28px ${FONT}`;
  const w = Math.max(...lines.map(l => c.measureText(l.toUpperCase()).width)) + 44, h = lines.length * 34 + 22;
  rr(c, 18, 18, w, h, 10, '#ffe066', INK, 4);
  lines.forEach((l, i) => text(c, l, 40, 18 + 28 + i * 34, 28, INK, null, 'left'));
  c.restore();
}
// Speech bubble pointing at (px, py). Pops in after `delay` seconds.
function bubble(c, s, x, y, px, py, t, delay = 0.5, size = 28, col = '#fff') {
  if (t < delay) return;
  const k = Math.min(1, (t - delay) * 6);
  c.save(); c.translate(x, y); c.scale(k, k); c.translate(-x, -y);
  c.font = `${size}px ${FONT}`;
  const w = c.measureText(s.toUpperCase()).width + 40, h = size + 26;
  c.beginPath(); c.moveTo(x - 16, y + h / 2 - 4); c.lineTo(px, py); c.lineTo(x + 16, y + h / 2 - 4); c.closePath();
  c.fillStyle = col; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
  rr(c, x - w / 2, y - h / 2, w, h, h / 2, col, INK, 4);
  c.beginPath(); c.moveTo(x - 13, y + h / 2 - 3); c.lineTo(px, py); c.lineTo(x + 13, y + h / 2 - 3); c.fillStyle = col; c.fill();
  text(c, s, x, y + 2, size, INK, null);
  c.restore();
}
function rays(c, x, y, cols, t, n = 16, speed = 0.15) {
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + t * speed;
    c.beginPath(); c.moveTo(x, y);
    c.arc(x, y, 1600, a, a + TAU / n / 2); c.closePath();
    c.fillStyle = cols[i % cols.length]; c.fill();
  }
}
function tiles(c, a, b, size = 80) {
  for (let y = 0; y < PH; y += size) for (let x = 0; x < PW; x += size) { c.fillStyle = ((x + y) / size) % 2 ? a : b; c.fillRect(x, y, size, size); }
}
function goldBar(c, x, y, s = 1) {
  c.beginPath(); c.moveTo(x - 22 * s, y + 10 * s); c.lineTo(x - 16 * s, y - 10 * s); c.lineTo(x + 16 * s, y - 10 * s); c.lineTo(x + 22 * s, y + 10 * s); c.closePath();
  c.fillStyle = '#ffcf3a'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
  line(c, x - 12 * s, y - 5 * s, x + 6 * s, y - 5 * s, 'rgba(255,255,255,0.7)', 2.5);
}
function bag(c, x, y, r) {
  circ(c, x, y, r, '#d9b77a', INK, 3);
  line(c, x - r * 0.3, y - r * 0.9, x + r * 0.3, y - r * 0.9, INK, 4);
  text(c, '$', x, y + 3, r * 1.1, '#2b6b22', null);
}
function manhole(c, x, y, t, delay) {
  const k = Math.max(0, Math.min(1, (t - delay) * 2));
  circ(c, x, y, 46, '#c9ccd2', INK, 4);
  circ(c, x, y, 36, '#16120f', INK, 3);
  // the lid flies off
  const lx = x - 70 * k, ly = y - 60 * k - Math.sin(k * Math.PI) * 60;
  c.save(); c.translate(lx, ly); c.rotate(k * 4);
  circ(c, 0, 0, 34, '#7d8290', INK, 3);
  for (let i = -1; i <= 1; i++) line(c, -22, i * 11, 22, i * 11, '#4a4f5a', 4);
  c.restore();
  if (k > 0.2 && k < 1) text(c, 'CLANK!', x + 60, y - 50, 30, '#fff', INK);
}

// ---------- the five panels ----------
const PANELS = [
  { // 1. the vault
    draw(c, t) {
      tiles(c, '#e8e4dc', '#dcd6cc');
      // the huge round vault door, open
      circ(c, 1010, 300, 220, '#9aa0aa', INK, 6);
      circ(c, 1010, 300, 180, '#b8bec8', INK, 4);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * 0.3; line(c, 1010, 300, 1010 + Math.cos(a) * 150, 300 + Math.sin(a) * 150, '#7d8290', 10); }
      circ(c, 1010, 300, 40, '#ffcf3a', INK, 4);
      // piles of gold and money
      for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) goldBar(c, 150 + i * 46 + row * 23, 520 - row * 22, 1);
      for (let row = 0; row < 3; row++) for (let i = 0; i < 5 - row; i++) goldBar(c, 520 + i * 46 + row * 23, 560 - row * 22, 1);
      for (const [x, y, r] of [[160, 300, 46], [270, 260, 40], [210, 380, 42], [600, 300, 44], [700, 380, 38]]) bag(c, x, y, r);
      for (let i = 0; i < 6; i++) {   // sparkles
        const a = t * 2 + i * 1.2;
        text(c, '✦', 420 + Math.cos(a) * 300, 360 + Math.sin(a * 1.3) * 160, 26, '#fff6b0', INK);
      }
      official(c, 'dumbbell', 440, 380, 2.4, t);
      bubble(c, 'ALL TAXED. EVERY CENT.', 440, 220, 440, 330, t, 0.6, 26);
      caption(c, ['City Bank.', 'The fullest vault in history.'], t);
    },
  },
  { // 2. the heist plan under the city
    draw(c, t) {
      tiles(c, '#5a6070', '#525868', 60);
      for (let y = 0; y < PH; y += 30) line(c, 0, y, PW, y, 'rgba(0,0,0,0.25)', 2);   // bricks
      c.fillStyle = '#3a8a8a'; c.fillRect(0, 520, PW, 120);                          // sewer water
      for (let i = 0; i < 12; i++) { const x = ((i * 120 + t * 60) % 1300) - 50; line(c, x, 560 + (i % 3) * 20, x + 40, 560 + (i % 3) * 20, 'rgba(255,255,255,0.35)', 3); }
      // the table with the bank blueprint
      rr(c, 380, 180, 440, 260, 14, '#8a5a2a', INK, 5);
      rr(c, 410, 205, 380, 210, 6, '#3a7ad8', INK, 3);
      for (let i = 1; i < 6; i++) { line(c, 410 + i * 63, 205, 410 + i * 63, 415, 'rgba(255,255,255,0.25)', 1.5); line(c, 410, 205 + i * 35, 790, 205 + i * 35, 'rgba(255,255,255,0.25)', 1.5); }
      text(c, 'CITY BANK', 600, 250, 30, '#fff', null);
      rr(c, 520, 290, 160, 90, 4, null, '#fff', 3);
      text(c, 'X', 600, 335, 54, '#ff4d3a', INK);
      // the laptop with Mr. Offshore on a video call
      rr(c, 820, 200, 220, 150, 10, '#2a2a30', INK, 4);
      rr(c, 834, 212, 192, 124, 4, '#ffcf3a', null);
      circ(c, 930, 290, 34, '#f6d9bd', INK, 3);
      rr(c, 896, 216, 68, 46, 4, '#16120f', INK, 3); rr(c, 880, 258, 100, 10, 3, '#16120f', INK, 2);
      circ(c, 945, 288, 10, null, '#ffd21f', 3);                                     // monocle
      // robbers around the table, looking at it
      const spots = [[300, 250, 0], [300, 380, 0], [600, 120, Math.PI / 2], [600, 500, -Math.PI / 2], [460, 500, -Math.PI / 2]];
      const types = ['walker', 'hardhat', 'headphones', 'riot', 'jogger'];
      spots.forEach(([x, y, a], i) => robber(c, types[i], x, y, 16, a + Math.sin(t * 2 + i) * 0.15, t + i, i * 0.6, 2.6));
      bubble(c, 'TONIGHT WE TAKE IT ALL.', 930, 120, 930, 200, t, 0.8, 26, '#fff6d0');
      caption(c, ['Meanwhile, under the city...'], t);
    },
  },
  { // 3. they climb out
    draw(c, t) {
      c.fillStyle = '#3a4a6a'; c.fillRect(0, 0, PW, PH);                             // night street
      c.fillStyle = '#4a5468'; c.fillRect(0, 200, PW, 240);
      for (let x = 0; x < PW; x += 100) line(c, x, 320, x + 50, 320, '#ffd21f', 5);
      circ(c, 1080, 110, 50, '#fff6d0', null); circ(c, 1060, 96, 46, '#3a4a6a', null);   // moon
      const holes = [[230, 320, 0.2, 'walker'], [600, 260, 0.6, 'jogger'], [930, 380, 1.0, 'hardhat'], [420, 520, 1.4, 'headphones'], [800, 560, 1.8, 'football']];
      for (const [x, y, d, ty] of holes) {
        manhole(c, x, y, t, d);
        const k = Math.max(0, Math.min(1, (t - d - 0.3) * 1.5));
        if (k > 0) {
          const s = 1.2 + k * 1.6;
          c.save(); c.beginPath(); c.rect(0, 0, PW, y + 10 + k * 40); c.clip();
          robber(c, ty, x, y - k * 20, 16, -Math.PI / 2, t, d, s);
          c.restore();
        }
      }
      bubble(c, 'SHHH...', 230, 150, 230, 260, t, 1.0, 28);
      caption(c, ['Tonight.'], t);
    },
  },
  { // 4. the boss
    draw(c, t) {
      rays(c, 600, 360, ['#ffcf3a', '#ffe28a'], t, 18, 0.2);
      for (let i = 0; i < 14; i++) {   // money raining
        const x = (i * 97) % PW, y = ((i * 61 + t * 120) % (PH + 40)) - 20;
        c.save(); c.translate(x, y); c.rotate(i + t * 2); rr(c, -16, -9, 32, 18, 2, '#8fdc8a', INK, 2); text(c, '$', 0, 1, 14, '#2b6b22', null); c.restore();
      }
      robber(c, 'offshore', 600, 400, 62, 0, t, 0.4, 2.1);
      bubble(c, 'TAXES ARE FOR POOR PEOPLE.', 780, 130, 640, 290, t, 0.7, 30, '#fff6d0');
      caption(c, ['Their boss: MR. OFFSHORE.', 'Never paid a single cent of tax.'], t);
    },
  },
  { // 5. the tax office assembles
    draw(c, t) {
      rays(c, 600, 380, ['#9fdcff', '#5ab8f0'], t, 20, 0.12);
      const team = [['kicker', 150], ['dumbbell', 370], ['chad', 600], ['collector', 830], ['cannon', 1050]];
      team.forEach(([k, x], i) => {
        const pop = Math.max(0, Math.min(1, (t - i * 0.12) * 5));
        if (!pop) return;
        const s = (k === 'chad' ? 3.3 : 2.3) * (pop < 1 ? 0.6 + pop * 0.4 : 1);
        official(c, k, x, k === 'chad' ? 350 : 380, s, t + i, Math.PI / 2);
      });
      bubble(c, "THAT'S OUR MONEY.", 860, 160, 660, 270, t, 0.8, 30);
      if (t > 1.2) {
        const k = 1 + Math.sin(t * 5) * 0.04;
        c.save(); c.translate(600, 575); c.rotate(-0.03); c.scale(k, k);
        text(c, 'PROTECT THE BANK!', 0, 0, 80, '#ffe066', INK);
        c.restore();
      }
      caption(c, ['But the tax office had other plans.'], t);
    },
  },
];

// ---------- player ----------
let idx = 0, t0 = 0, raf = 0, onDone = null, showFn = null;
const cv = () => $('storyCv');

function frame(now) {
  const c = cv().getContext('2d');
  const t = (now - t0) / 1000;
  c.setTransform(2, 0, 0, 2, 0, 0);
  c.clearRect(0, 0, PW, PH);
  c.save();
  c.beginPath(); c.rect(0, 0, PW, PH); c.clip();
  PANELS[idx].draw(c, t);
  c.restore();
  raf = requestAnimationFrame(frame);
}

function syncButtons() {
  const last = idx === PANELS.length - 1;
  $('storyNext').textContent = last ? 'PROTECT THE BANK!' : 'NEXT ▶';
  $('storyNext').classList.toggle('go', last);
  $('storySkip').style.visibility = last ? 'hidden' : 'visible';
  $('storyDots').innerHTML = PANELS.map((_, i) => `<i class="${i === idx ? 'f' : ''}"></i>`).join('');
  const el = cv(); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

function goTo(i) {
  idx = i; t0 = performance.now();
  syncButtons();
  if (i === 2) sfx('smash');
  else if (i === PANELS.length - 1) sfx('upgrade');
  else sfx('click');
}

function finish() {
  cancelAnimationFrame(raf); raf = 0;
  window.removeEventListener('keydown', onKey, true);
  const done = onDone; onDone = null;
  done?.();
}
function next() { if (idx < PANELS.length - 1) goTo(idx + 1); else finish(); }
function onKey(ev) {
  if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'ArrowRight') { ev.preventDefault(); ev.stopPropagation(); next(); }
  else if (ev.key === 'Escape') { ev.stopPropagation(); finish(); }
}

let bound = false;
export function playStory(show, done) {
  showFn = show; onDone = done;
  if (!bound) {
    bound = true;
    cv().addEventListener('click', () => next());
    $('storyNext').addEventListener('click', ev => { ev.stopPropagation(); next(); });
    $('storySkip').addEventListener('click', ev => { ev.stopPropagation(); sfx('click'); finish(); });
  }
  showFn('story');
  window.addEventListener('keydown', onKey, true);
  goTo(0);
  if (!raf) raf = requestAnimationFrame(frame);
}
