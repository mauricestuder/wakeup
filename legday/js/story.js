// The intro comic: how the rats mutated and why the bros have to save the gym.
// Five animated panels drawn on one canvas. Tap / click / Space for the next
// panel, SKIP to jump straight into the game.

import { drawTower, drawSinner, circ, ell, rr, line, text, INK, FONT } from './draw.js';
import { sfx } from './audio.js';

const PW = 1200, PH = 640, TAU = Math.PI * 2;
const $ = id => document.getElementById(id);

// ---------- little drawing helpers ----------
function rat(c, type, x, y, r, ang, t, seed = 0.3) {
  drawSinner(c, { t: type, x, y, r, fa: ang, seed, flash: 0, burnT: 0, stunT: 0, slowF: 1, hp: 1, maxHp: 1, noBar: true }, t);
}
function bro(c, key, x, y, s, t, ang = Math.PI / 2) {
  drawTower(c, key, x, y, { icon: true, scale: s, lvl: [0, 0, 0], t, ang, anim: (Math.sin(t * 3) + 1) / 2 });
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
function planks(c, col, line2) {
  c.fillStyle = col; c.fillRect(0, 0, PW, PH);
  for (let y = 0; y < PH; y += 56) {
    line(c, 0, y, PW, y, line2, 3);
    for (let x = ((y / 56) % 2) * 120; x < PW; x += 240) line(c, x, y, x, y + 56, line2, 2);
  }
}
function tub(c, x, y, r, ring = '#2f7ad8', label = 'WHEY') {
  circ(c, x + r * 0.08, y + r * 0.12, r, 'rgba(0,0,0,0.18)', null);
  circ(c, x, y, r, '#f4f4f4', INK, 4);
  circ(c, x, y, r * 0.84, null, ring, r * 0.16);
  circ(c, x, y, r * 0.72, '#e8e8ee', INK, 2);
  text(c, label, x, y + 2, r * 0.4, ring, null);
}
function megaTub(c, x, y, t) {
  const glow = 0.25 + Math.sin(t * 4) * 0.1;
  circ(c, x, y, 150, `rgba(140,255,60,${glow})`, null);
  tub(c, x, y, 112, '#3fc02a', '');
  text(c, 'MEGA', x, y - 30, 40, '#3fc02a', INK);
  text(c, 'WHEY 9000', x, y + 14, 34, '#3fc02a', INK);
  c.save(); c.translate(x + 40, y + 78); c.rotate(-0.12);
  rr(c, -100, -22, 200, 44, 6, '#ffd21f', INK, 3);
  text(c, '⚠ EXPERIMENTAL ⚠', 0, -6, 16, INK, null);
  text(c, 'DO NOT FEED TO RATS', 0, 11, 14, '#c82a2a', null);
  c.restore();
}

// ---------- the five panels ----------
const PANELS = [
  { // 1. the delivery
    draw(c, t) {
      planks(c, '#f0cf96', '#d8b278');
      rr(c, 40, 420, 420, 190, 16, '#3a3d48', INK, 4);                 // rubber mat with a bench
      rr(c, 150, 470, 200, 70, 14, '#e83a2a', INK, 4);
      rr(c, 120, 500, 260, 12, 4, '#c9ccd2', INK, 2);
      for (const sx of [120, 380]) rr(c, sx - 10, 480, 20, 52, 4, '#2e3138', INK, 3);
      for (let i = 0; i < 6; i++) tub(c, 520 + (i % 3) * 70, 170 + Math.floor(i / 3) * 70, 32);
      megaTub(c, 880, 330, t);
      for (let i = 0; i < 4; i++) {   // sparkles
        const a = t * 2 + i * 1.6;
        text(c, '✦', 880 + Math.cos(a) * 160, 330 + Math.sin(a) * 140, 26, '#fffbd0', INK);
      }
      bro(c, 'shake', 640, 480, 2.3, t);
      bubble(c, 'NEW PROTEIN, BROS!', 640, 360, 640, 425, t, 0.6, 24);
      caption(c, ['Iron Paradise Gym. 3 AM.', 'A new delivery arrives...'], t);
    },
  },
  { // 2. the rats sneak in
    draw(c, t) {
      planks(c, '#c9a878', '#a8875a');
      c.fillStyle = 'rgba(20,30,80,0.38)'; c.fillRect(0, 0, PW, PH);        // night
      ell(c, 880, 330, 230, 120, 'rgba(255,255,240,0.25)', null);           // moonlight from a window
      // the open sewer grate
      circ(c, 170, 470, 78, '#1a1f28', INK, 5);
      c.save(); c.translate(80, 330); c.rotate(-0.4);
      circ(c, 0, 0, 74, '#7d8290', INK, 4);
      for (let i = -2; i <= 2; i++) line(c, -50, i * 20, 50, i * 20, '#4a4f5a', 5);
      c.restore();
      // the tipped-over tub and its spill
      ell(c, 840, 420, 230, 90, '#ffffff', null);
      for (let i = 0; i < 14; i++) circ(c, 700 + (i * 53) % 300, 380 + (i * 37) % 80, 4, '#9fff5a', null);
      c.save(); c.translate(940, 300); c.rotate(1.2); tub(c, 0, 0, 100, '#3fc02a', 'MEGA'); c.restore();
      // rats creeping from the hole to the powder
      const go = Math.min(1, t / 2.2);
      const rats = [['walker', 0, 690, 380], ['crawler', 0.3, 800, 470], ['walker', 0.55, 640, 500], ['crawler', 0.8, 900, 400]];
      rats.forEach(([ty, d, tx, ty2], i) => {
        const k = Math.max(0, Math.min(1, go * 1.3 - d * 0.35));
        const x = 170 + k * (tx - 170), y = 470 + k * (ty2 - 470);
        c.save(); c.translate(x, y); c.scale(2.4, 2.4); c.translate(-x, -y);
        rat(c, ty, x, y, ty === 'walker' ? 16 : 13, -0.05, t + i, i * 0.7);
        c.restore();
      });
      bubble(c, 'IS THAT... PROTEIN?', 560, 230, 670, 345, t, 1.6, 26);
      caption(c, ['Meanwhile, in the sewer...'], t);
    },
  },
  { // 3. the mutation
    draw(c, t) {
      rays(c, 600, 360, ['#9fff5a', '#5fdc3a'], t, 18, 0.25);
      const g = c.createRadialGradient(600, 360, 20, 600, 360, 420);
      g.addColorStop(0, 'rgba(255,255,220,0.9)'); g.addColorStop(1, 'rgba(255,255,220,0)');
      c.fillStyle = g; c.fillRect(0, 0, PW, PH);
      const pulse = 1 + Math.sin(t * 10) * 0.04 * Math.max(0, 1 - t / 2);
      const grow = Math.min(1, 0.4 + t * 0.6);
      c.save(); c.translate(600, 380); c.scale(6.5 * grow * pulse, 6.5 * grow * pulse); c.translate(-600, -380);
      rat(c, 'hardhat', 600, 380, 16, -Math.PI / 2, t);
      c.restore();
      for (let i = 0; i < 4; i++) {   // smaller rats bulking up around him
        const x = [210, 1000, 290, 930][i], y = [460, 470, 230, 220][i];
        c.save(); c.translate(x, y); c.scale(3, 3); c.translate(-x, -y);
        rat(c, ['walker', 'jogger', 'crawler', 'headphones'][i], x, y, 16, -Math.PI / 2 + (i - 1.5) * 0.3, t + i, i * 0.4);
        c.restore();
      }
      if (t > 0.3) { c.save(); c.translate(250, 130); c.rotate(-0.15); text(c, 'SQUEAK!!', 0, 0, 70, '#ffe066', INK); c.restore(); }
      if (t > 1.0) { c.save(); c.translate(960, 600); c.rotate(0.08); text(c, 'GAINS.', 0, 0, 80, '#ffffff', INK); c.restore(); }
      bubble(c, 'I FEEL... SWOLE.', 900, 140, 650, 270, t, 1.4, 28);
      caption(c, ['One scoop was all it took.'], t);
    },
  },
  { // 4. the rat army
    draw(c, t) {
      c.fillStyle = '#8ad35e'; c.fillRect(0, 0, PW, PH);
      for (let i = 0; i < 40; i++) circ(c, (i * 137) % PW, (i * 89) % PH, 3, ['#fff', '#ffe066', '#ff8ac0'][i % 3], null);
      rr(c, -20, 250, PW + 40, 250, 0, '#f4f0e6', null);
      rr(c, -20, 266, PW + 40, 218, 0, '#666b76', null);
      for (let x = 0; x < PW; x += 80) line(c, x, 375, x + 40, 375, '#ffd21f', 4);
      // the gym on the right
      rr(c, 1080, 180, 160, 390, 10, '#ff8a2a', INK, 5);
      rr(c, 1080, 290, 28, 170, 4, '#bfe8ff', INK, 3);
      c.save(); c.translate(1150, 375); c.rotate(Math.PI / 2); text(c, 'GYM', 0, 0, 54, '#ffd21f', INK); c.restore();
      // the horde marching right
      const types = ['walker', 'jogger', 'football', 'hardhat', 'crawler', 'headphones', 'riot'];
      for (let i = 0; i < 26; i++) {
        const lane = i % 4, base = (i * 97) % 900;
        const x = ((base + t * 70) % 900) + 120, y = 300 + lane * 50 + Math.sin(i) * 8;
        if (x > 1050) continue;
        c.save(); c.translate(x, y); c.scale(1.9, 1.9); c.translate(-x, -y);
        rat(c, types[i % types.length], x, y, 16, 0, t + i, i * 0.37);
        c.restore();
      }
      const kx = 170 + Math.min(t, 3) * 14;
      c.save(); c.translate(kx, 380); c.scale(2.2, 2.2); c.translate(-kx, -380);
      rat(c, 'mru', kx, 380, 54, 0, t);
      c.restore();
      bubble(c, 'THIS GYM IS MINE!', 420, 170, 250, 290, t, 0.8, 30, '#ffe0e0');
      caption(c, ['Now there are thousands.', 'They want ALL the protein. And the gym.'], t);
    },
  },
  { // 5. the bros assemble
    draw(c, t) {
      rays(c, 600, 380, ['#ffe066', '#ffb02e'], t, 20, 0.12);
      const bros = [['dj', 140], ['shake', 360], ['chad', 600], ['dumbbell', 840], ['legs', 1060]];
      bros.forEach(([k, x], i) => {
        const pop = Math.max(0, Math.min(1, (t - i * 0.12) * 5));
        if (!pop) return;
        const s = (k === 'chad' ? 3.3 : 2.3) * (pop < 1 ? 0.6 + pop * 0.4 : 1);
        bro(c, k, x, k === 'chad' ? 350 : 380, s, t + i, Math.PI / 2);
      });
      bubble(c, 'NOT ON OUR WATCH.', 860, 160, 660, 270, t, 0.8, 30);
      if (t > 1.2) {
        const k = 1 + Math.sin(t * 5) * 0.04;
        c.save(); c.translate(600, 575); c.rotate(-0.03); c.scale(k, k);
        text(c, 'SAVE THE GYM!', 0, 0, 84, '#ffe066', INK);
        c.restore();
      }
      caption(c, ['But the rats forgot one thing:', 'gym bros never skip a day.'], t);
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
  $('storyNext').textContent = last ? 'SAVE THE GYM!' : 'NEXT ▶';
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
