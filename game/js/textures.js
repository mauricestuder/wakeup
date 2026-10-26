// Procedural textures drawn on canvases, so the game needs no image files.
import * as THREE from '../vendor/three.module.min.js';

export function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

export function canvasTex(canvas, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  // Blocky up close, but mipmapped far away so signs stay readable.
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// Textures are drawn at full size, then shrunk 4x for chunky PS1 texels.
export function tex(w, h, draw, repeatX = 1, repeatY = 1) {
  const full = makeCanvas(w, h, draw);
  const small = makeCanvas(Math.max(16, Math.round(w / 4)), Math.max(8, Math.round(h / 4)),
    (g, sw, sh) => g.drawImage(full, 0, 0, sw, sh));
  return canvasTex(small, repeatX, repeatY);
}

// Small deterministic RNG so textures look the same every load.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

export function marbleFloor() {
  return tex(512, 512, (g, w, h) => {
    const r = rng(7);
    const s = w / 4;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        g.fillStyle = (x + y) % 2 ? '#d9d2c3' : '#2b2b2e';
        g.fillRect(x * s, y * s, s, s);
        g.strokeStyle = (x + y) % 2 ? 'rgba(120,110,95,.35)' : 'rgba(200,200,210,.12)';
        g.lineWidth = 1.5;
        for (let v = 0; v < 3; v++) {
          g.beginPath();
          let px = x * s + r() * s, py = y * s;
          g.moveTo(px, py);
          for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 30; py += s / 6; g.lineTo(px, py); }
          g.stroke();
        }
      }
    }
    g.strokeStyle = 'rgba(180,150,60,.6)';
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke();
    }
  });
}

export function bankWall() {
  return tex(256, 320, (g, w, h) => {
    g.fillStyle = '#1d3b2f'; g.fillRect(0, 0, w, h);
    // faint damask stripes
    g.fillStyle = 'rgba(255,255,255,.04)';
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 14, h * 0.62);
    // gold trim
    g.fillStyle = '#b8902f'; g.fillRect(0, h * 0.62, w, 8);
    g.fillRect(0, 10, w, 4);
    // wood wainscot
    g.fillStyle = '#4a2c17'; g.fillRect(0, h * 0.62 + 8, w, h);
    g.strokeStyle = '#2e1a0c'; g.lineWidth = 4;
    for (let x = 0; x < w; x += 64) g.strokeRect(x + 8, h * 0.68, 48, h * 0.26);
  });
}

export function steelWall() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#5b6066'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3c4045'; g.lineWidth = 3;
    for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) g.strokeRect(x + 4, y + 4, 56, 56);
    g.fillStyle = '#2a2d31';
    for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) {
      g.beginPath(); g.arc(x + 32, y + 32, 4, 0, Math.PI * 2); g.fill();
    }
  });
}

export function ceilingTex() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#1a1a1c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a2a2e'; g.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke();
    }
  });
}

export function bill() {
  return tex(128, 64, (g, w, h) => {
    g.fillStyle = '#7fae7a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2f5d2c'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#c9dfc2'; g.beginPath(); g.ellipse(w / 2, h / 2, 18, 22, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f5d2c'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('$', w / 2, h / 2 + 1);
    g.font = 'bold 14px sans-serif'; g.fillText('100', 20, 16); g.fillText('100', w - 20, h - 14);
  });
}

export function woodBoards() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#3b2412'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 42) {
      g.fillStyle = y % 84 ? '#6b4423' : '#5c391c';
      g.fillRect(0, y + 3, w, 36);
      g.fillStyle = '#9a9a9a';
      g.fillRect(14, y + 16, 6, 6); g.fillRect(w - 20, y + 16, 6, 6);
    }
    g.fillStyle = 'rgba(200,30,30,.85)'; g.font = 'bold 40px Impact, sans-serif'; g.textAlign = 'center';
    g.save(); g.translate(w / 2, h / 2); g.rotate(-0.25); g.fillText('CLOSED', 0, 14); g.restore();
  });
}

// Double mahogany doors with brass handles and a "PRIVATE" plaque.
export function boardroomDoor() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#3a1a0c'; g.fillRect(0, 0, w, h);
    for (const x0 of [8, w / 2 + 4]) {
      const pw = w / 2 - 12;
      g.fillStyle = '#5a2a14'; g.fillRect(x0, 8, pw, h - 16);
      g.strokeStyle = '#2a1006'; g.lineWidth = 4;
      g.strokeRect(x0 + 12, 20, pw - 24, h * 0.38); g.strokeRect(x0 + 12, h * 0.5, pw - 24, h * 0.42);
      g.fillStyle = 'rgba(255,220,180,.06)';
      for (let y = 10; y < h - 10; y += 7) g.fillRect(x0, y, pw, 2); // grain
    }
    g.fillStyle = '#d4a017'; g.fillRect(w / 2 - 16, h * 0.52, 8, 34); g.fillRect(w / 2 + 8, h * 0.52, 8, 34);
    g.fillStyle = '#c9a43a'; g.fillRect(w / 2 - 50, 28, 100, 26);
    g.fillStyle = '#2a1006'; g.font = 'bold 20px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('PRIVATE', w / 2, 42);
  });
}

// "Q3 PROFITS" line chart that only goes down.
export function chartTex() {
  return tex(384, 230, (g, w, h) => {
    g.fillStyle = '#f2ecdc'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b8902f'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#1a1a1a'; g.font = 'bold 26px Impact, sans-serif'; g.textAlign = 'center';
    g.fillText('Q3 PROFITS', w / 2, 38);
    g.strokeStyle = '#bbb'; g.lineWidth = 1;
    for (let y = 60; y < h - 20; y += 30) { g.beginPath(); g.moveTo(30, y); g.lineTo(w - 24, y); g.stroke(); }
    g.strokeStyle = '#c62828'; g.lineWidth = 6; g.lineJoin = 'round';
    g.beginPath();
    const pts = [[34, 64], [80, 80], [120, 72], [170, 110], [210, 104], [260, 150], [300, 142], [350, 205]];
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.stroke();
    g.fillStyle = '#c62828'; g.beginPath(); g.moveTo(350, 214); g.lineTo(336, 192); g.lineTo(362, 196); g.fill();
    g.fillStyle = 'rgba(120,10,10,.6)'; g.fillRect(250, 170, 20, 10); g.fillRect(258, 180, 6, 22); // blood smear
  });
}

export function vaultDoor() {
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#4d5359'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    g.fillStyle = '#8a9198'; g.beginPath(); g.arc(cx, cy, 230, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6c737a'; g.beginPath(); g.arc(cx, cy, 200, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a3f44'; g.lineWidth = 18;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 140, cy + Math.sin(a) * 140); g.stroke();
    }
    g.fillStyle = '#c9a43a'; g.beginPath(); g.arc(cx, cy, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2d31';
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      g.beginPath(); g.arc(cx + Math.cos(a) * 215, cy + Math.sin(a) * 215, 9, 0, Math.PI * 2); g.fill();
    }
  });
}

export function depositBoxes() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#7a6a45'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 64) {
      g.fillStyle = '#a8955f'; g.fillRect(x + 3, y + 3, 58, 26);
      g.fillStyle = '#3d3424'; g.fillRect(x + 28, y + 12, 8, 8);
    }
  });
}

export function monitorTex(seed) {
  return tex(128, 80, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = '#04110a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,255,120,.15)';
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    const up = r() > 0.4;
    g.strokeStyle = up ? '#21ff7a' : '#ff3b3b'; g.lineWidth = 2.5; g.beginPath();
    let y = h * (up ? 0.75 : 0.3);
    g.moveTo(0, y);
    for (let x = 8; x <= w; x += 8) { y += (r() - (up ? 0.62 : 0.38)) * 14; y = Math.max(6, Math.min(h - 6, y)); g.lineTo(x, y); }
    g.stroke();
    g.fillStyle = up ? '#21ff7a' : '#ff3b3b'; g.font = 'bold 12px monospace';
    g.fillText((up ? '+' : '-') + (r() * 9).toFixed(2) + '%', 6, 14);
  });
}

// Shredder floor grate: dark steel with slots and yellow-black hazard edges.
export function grateTex() {
  return tex(128, 128, (g, w, h) => {
    g.fillStyle = '#2a2c30'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#050505';
    for (let y = 18; y < h - 12; y += 14) g.fillRect(14, y, w - 28, 6);
    g.fillStyle = '#4a4d55';
    for (let y = 18; y < h - 12; y += 14) g.fillRect(14, y + 6, w - 28, 2);
    for (let i = -h; i < w + h; i += 16) {
      g.fillStyle = '#e0b000';
      for (const [x0, y0, ww, hh] of [[0, 0, w, 10], [0, h - 10, w, 10], [0, 0, 8, h], [w - 8, 0, 8, h]]) {
        g.save(); g.beginPath(); g.rect(x0, y0, ww, hh); g.clip();
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 8, 0); g.lineTo(i + 8 - h, h); g.lineTo(i - h, h); g.fill();
        g.restore();
      }
    }
  });
}

// Text label on a solid or transparent background.
export function labelTex(text, { w = 512, h = 128, bg = '#111', fg = '#f5d76e', font = 'bold 64px Impact, sans-serif', border = null } = {}) {
  return tex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    if (border) { g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); }
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('\n');
    // Shrink the font so the widest line fits.
    const widest = Math.max(...lines.map(l => g.measureText(l).width));
    if (widest > w * 0.9) g.font = font.replace(/(\d+)px/, (_, n) => Math.floor(n * w * 0.9 / widest) + 'px');
    const lh = h / (lines.length + 0.4);
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  });
}

// Zombie faces for the enemies. The glowing eyes are separate meshes, so
// only sockets are drawn here.
export function npcFace(kind) {
  return tex(128, 128, (g, w, h) => {
    const skin = { debt: '#8fa07a', tax: '#a3a594', shark: '#b49a8a', collector: '#7f8f6f' }[kind];
    g.fillStyle = skin; g.fillRect(0, 0, w, h);
    // rotten blotches
    g.fillStyle = 'rgba(60,80,40,.35)';
    g.fillRect(14, 70, 18, 12); g.fillRect(100, 92, 14, 18);
    if (kind === 'debt') { // slicked-back hair with a side part
      g.fillStyle = '#17120e'; g.fillRect(0, 0, w, 26); g.fillRect(0, 26, 10, 22); g.fillRect(118, 26, 10, 22);
      g.fillStyle = skin; g.fillRect(40, 18, 4, 8);
    } else if (kind === 'tax') { // bald top, grey sides
      g.fillStyle = '#8c8c86'; g.fillRect(0, 22, 12, 34); g.fillRect(116, 22, 12, 34);
    } else if (kind === 'collector') { // buzz cut and a scar
      g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, 12);
      g.fillStyle = '#5a1a1a'; g.fillRect(96, 20, 4, 40); g.fillRect(90, 30, 16, 3); g.fillRect(90, 44, 16, 3);
    } else { // white hair
      g.fillStyle = '#e6e2d8'; g.fillRect(0, 0, w, 16); g.fillRect(0, 16, 14, 40); g.fillRect(114, 16, 14, 40);
    }
    // sunken eye sockets
    g.fillStyle = '#1e2218';
    g.fillRect(22, 40, 26, 18); g.fillRect(80, 40, 26, 18);
    if (kind === 'collector') { // dark shades
      g.fillStyle = '#050505'; g.fillRect(16, 38, 96, 22);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(24, 42, 14, 4); g.fillRect(84, 42, 14, 4);
    }
    if (kind === 'tax') { // thick glasses
      g.strokeStyle = '#0b0b0b'; g.lineWidth = 6;
      g.strokeRect(18, 36, 34, 26); g.strokeRect(76, 36, 34, 26);
      g.beginPath(); g.moveTo(52, 46); g.lineTo(76, 46); g.stroke();
    }
    if (kind === 'shark') { // monocle and walrus mustache
      g.strokeStyle = '#d4a017'; g.lineWidth = 5;
      g.beginPath(); g.arc(93, 49, 17, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(93, 66); g.lineTo(100, 110); g.stroke();
      g.fillStyle = '#f0ece2'; g.fillRect(28, 80, 72, 14); g.fillRect(20, 88, 16, 12); g.fillRect(92, 88, 16, 12);
      g.fillStyle = '#2a0c0c'; g.fillRect(44, 98, 40, 8);
    } else if (kind === 'debt') { // too-wide salesman grin
      g.fillStyle = '#2a0c0c'; g.fillRect(24, 84, 80, 22);
      g.fillStyle = '#e8e0c0'; g.fillRect(28, 86, 72, 8);
      g.fillStyle = '#2a0c0c'; for (let x = 36; x < 100; x += 10) g.fillRect(x, 86, 3, 8);
      g.fillStyle = '#7a1c1c'; g.fillRect(60, 106, 6, 14); // drool of blood
    } else if (kind === 'collector') { // gold-toothed sneer
      g.fillStyle = '#2a0c0c'; g.fillRect(36, 90, 56, 10); g.fillRect(84, 84, 8, 8);
      g.fillStyle = '#d4a017'; g.fillRect(70, 90, 8, 6);
    } else { // tight frown
      g.fillStyle = '#2a0c0c'; g.fillRect(40, 92, 48, 8); g.fillRect(34, 98, 8, 6); g.fillRect(86, 98, 8, 6);
    }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(58, 56, 12, 24); // nose shadow
  });
}

// Front of the enemy's torso: suit, shirt and tie.
export function npcSuit(kind) {
  return tex(128, 128, (g, w, h) => {
    const suit = { debt: '#6b4a2b', tax: '#d8d4c4', shark: '#1d2238', collector: '#5a0f12' }[kind];
    g.fillStyle = suit; g.fillRect(0, 0, w, h);
    if (kind === 'debt') {
      g.strokeStyle = 'rgba(240,200,120,.25)'; g.lineWidth = 3; // cheap plaid
      for (let i = 8; i < w; i += 24) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
      g.fillStyle = '#e8e2d0'; g.beginPath(); g.moveTo(40, 0); g.lineTo(88, 0); g.lineTo(64, 70); g.fill();
      g.fillStyle = '#c62828'; g.beginPath(); g.moveTo(58, 4); g.lineTo(70, 4); g.lineTo(74, 80); g.lineTo(64, 92); g.lineTo(54, 80); g.fill();
      g.fillStyle = '#4a311b'; g.beginPath(); g.moveTo(30, 0); g.lineTo(40, 0); g.lineTo(64, 70); g.lineTo(52, 74); g.fill();
      g.beginPath(); g.moveTo(98, 0); g.lineTo(88, 0); g.lineTo(64, 70); g.lineTo(76, 74); g.fill();
      g.fillStyle = '#f4f0e4'; g.fillRect(84, 30, 30, 18); g.fillStyle = '#c62828'; g.fillRect(84, 30, 30, 6); // name tag
    } else if (kind === 'tax') {
      g.fillStyle = '#7d7a6e'; g.fillRect(16, 0, 10, h); g.fillRect(102, 0, 10, h); // suspenders
      g.fillStyle = '#2b2f3a'; g.beginPath(); g.moveTo(60, 0); g.lineTo(68, 0); g.lineTo(70, 76); g.lineTo(64, 84); g.lineTo(58, 76); g.fill();
      g.fillStyle = '#e9ecef'; g.fillRect(80, 24, 24, 26); // pocket protector
      g.fillStyle = '#1d4ed8'; g.fillRect(84, 14, 4, 16); g.fillStyle = '#c62828'; g.fillRect(92, 12, 4, 18); g.fillStyle = '#111'; g.fillRect(98, 16, 3, 14);
      g.fillStyle = '#d4a017'; g.fillRect(28, 30, 22, 16); // badge
    } else if (kind === 'collector') {
      g.fillStyle = '#3a0709'; g.fillRect(58, 0, 12, h); // jacket zip
      g.fillStyle = '#111'; g.fillRect(40, 0, 48, 20); // black tee
      g.strokeStyle = '#c0c0c0'; g.lineWidth = 4; // heavy chain
      g.beginPath(); g.moveTo(40, 4); g.quadraticCurveTo(64, 44, 88, 4); g.stroke();
      g.save(); g.translate(64, 84); g.rotate(-0.2); // PAST DUE stamp
      g.strokeStyle = '#ff3b30'; g.lineWidth = 3; g.strokeRect(-46, -14, 92, 28);
      g.fillStyle = '#ff3b30'; g.font = 'bold 20px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('PAST DUE', 0, 1); g.restore();
    } else {
      g.fillStyle = '#e8e2d0'; g.beginPath(); g.moveTo(44, 0); g.lineTo(84, 0); g.lineTo(64, 50); g.fill();
      g.fillStyle = '#5a1020'; g.fillRect(40, 30, 48, h); // waistcoat
      g.fillStyle = '#d4a017'; for (let y = 50; y < h; y += 18) g.fillRect(61, y, 6, 6);
      g.strokeStyle = '#d4a017'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 80); g.quadraticCurveTo(76, 96, 86, 82); g.stroke(); // watch chain
      g.fillStyle = '#b3121b'; g.beginPath(); g.moveTo(0, 6); g.lineTo(20, 0); g.lineTo(128, 110); g.lineTo(128, 128); g.lineTo(108, 128); g.fill(); // sash
      g.fillStyle = '#d4a017'; g.fillRect(60, 56, 10, 10);
      g.fillStyle = '#e53935'; g.fillRect(14, 20, 10, 10); // carnation
    }
    g.fillStyle = 'rgba(90,10,10,.55)'; // blood stains
    g.fillRect(20, 92, 14, 10); g.fillRect(30, 100, 6, 16); g.fillRect(96, 60, 8, 8);
  });
}

// ---------- extra rooms ----------

// Stained garage concrete with expansion joints.
export function concreteFloor() {
  return tex(256, 256, (g, w, h) => {
    const r = rng(41);
    g.fillStyle = '#56544f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 70 + r() * 40 | 0; g.fillStyle = `rgb(${v},${v - 2},${v - 6})`; g.fillRect(r() * w, r() * h, 3, 3); }
    g.fillStyle = 'rgba(20,18,14,.35)';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(r() * w, r() * h, 10 + r() * 30, 6 + r() * 20, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#3a3935'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  });
}

// Front of a server rack: dark panels with vents and little status lights.
export function serverRack() {
  return tex(128, 256, (g, w, h) => {
    const r = rng(7);
    g.fillStyle = '#121418'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 20) {
      g.fillStyle = '#23272e'; g.fillRect(8, y, w - 16, 16);
      g.fillStyle = '#0a0b0d'; for (let x = 14; x < 70; x += 6) g.fillRect(x, y + 4, 3, 8);
      for (let k = 0; k < 3; k++) { g.fillStyle = r() > 0.25 ? '#33ff88' : r() > 0.5 ? '#ff4040' : '#3aa0ff'; g.fillRect(86 + k * 10, y + 6, 5, 4); }
    }
  });
}

// Shelf full of record boxes and binders.
export function fileShelf() {
  return tex(256, 256, (g, w, h) => {
    const r = rng(19);
    g.fillStyle = '#2b1d10'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) {
      g.fillStyle = '#4a321b'; g.fillRect(0, y + 58, w, 6);
      let x = 4;
      while (x < w - 10) {
        const bw = 18 + r() * 26 | 0;
        const c = ['#b89d6a', '#a88c5b', '#c7b48a', '#6d4b8a', '#2f5d8a', '#8a2f2f'][r() * 6 | 0];
        g.fillStyle = c; g.fillRect(x, y + 10 + r() * 8, bw - 3, 48);
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x + 4, y + 24, bw - 11, 8);
        x += bw;
      }
    }
  });
}

// Roll-up garage shutter.
export function shutterTex() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#6c6f73'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { g.fillStyle = '#55585c'; g.fillRect(0, y + 12, w, 4); }
    g.fillStyle = '#e0b020'; g.fillRect(0, h - 20, w, 20);
    g.fillStyle = '#111'; for (let x = -20; x < w; x += 40) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 20, h - 20); g.lineTo(x + 40, h - 20); g.lineTo(x + 20, h); g.fill(); }
  });
}

// Grainy black-and-white security camera feed.
export function cctvTex(seed) {
  return tex(128, 96, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = '#1c1f1c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a514a'; g.fillRect(0, h * 0.62, w, h);
    g.fillStyle = '#5f675f'; for (let i = 0; i < 3; i++) g.fillRect(10 + r() * 90, 20 + r() * 20, 10, 50);
    g.fillStyle = '#9aa59a';
    const fx = 30 + r() * 60; g.fillRect(fx, 38, 10, 26); g.fillRect(fx + 1, 30, 8, 8); // a lurking figure
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.12})`; g.fillRect(r() * w, r() * h, 2, 1); }
    g.fillStyle = '#e8e8e8'; g.font = 'bold 11px monospace'; g.fillText('CAM ' + (seed % 9 + 1), 5, 12);
    g.fillStyle = '#ff3030'; g.beginPath(); g.arc(w - 10, 9, 4, 0, Math.PI * 2); g.fill();
  });
}

// Side of a banded brick of $100 bills.
export function cashBrick() {
  return tex(64, 32, (g, w, h) => {
    g.fillStyle = '#7fae7a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5d8a58'; for (let y = 2; y < h; y += 4) g.fillRect(0, y, w, 1);
    g.fillStyle = '#f2ead2'; g.fillRect(w / 2 - 8, 0, 16, h);
    g.fillStyle = '#8a6d2f'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText('$10K', w / 2, h / 2 + 4);
  });
}

// Grey steel door with a coloured plate, e.g. STAFF ONLY.
export function staffDoor(text, plate = '#b8902f') {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#4b4f55'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#33363b'; g.lineWidth = 6; g.strokeRect(14, 10, w / 2 - 20, h - 20); g.strokeRect(w / 2 + 6, 10, w / 2 - 20, h - 20);
    g.fillStyle = '#9a9a9a'; g.fillRect(w / 2 - 16, h / 2, 8, 24); g.fillRect(w / 2 + 8, h / 2, 8, 24);
    g.fillStyle = plate; g.fillRect(w / 2 - 80, 40, 160, 40);
    g.fillStyle = '#111'; g.font = 'bold 26px Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, 61);
  });
}
