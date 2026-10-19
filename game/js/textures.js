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
  t.anisotropy = 4;
  return t;
}

export function tex(w, h, draw, repeatX = 1, repeatY = 1) {
  return canvasTex(makeCanvas(w, h, draw), repeatX, repeatY);
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

// Text label on a solid or transparent background.
export function labelTex(text, { w = 512, h = 128, bg = '#111', fg = '#f5d76e', font = 'bold 64px Impact, sans-serif', border = null } = {}) {
  return tex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    if (border) { g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); }
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('\n');
    const lh = h / (lines.length + 0.4);
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  });
}

// Chalk-outline wall-buy sign, like the outlines on BO walls.
export function wallBuyTex(name, price, kind) {
  return tex(512, 256, (g, w, h) => {
    g.fillStyle = 'rgba(10,10,10,.55)'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f2e8c9'; g.lineWidth = 6; g.lineJoin = 'round';
    g.shadowColor = '#f2e8c9'; g.shadowBlur = 6;
    g.beginPath();
    if (kind === 'grenade') {
      g.ellipse(w / 2, 110, 60, 55, 0, 0, Math.PI * 2);
      g.moveTo(w / 2 - 25, 55); g.lineTo(w / 2, 40); g.lineTo(w / 2 + 25, 55);
    } else if (kind === 'shotgun') {
      g.rect(80, 80, 300, 26); g.rect(380, 70, 70, 50); g.moveTo(300, 106); g.lineTo(300, 150);
    } else {
      g.rect(150, 70, 220, 40); g.moveTo(200, 110); g.lineTo(185, 180); g.lineTo(225, 180); g.lineTo(235, 110);
      if (kind === 'smg') { g.moveTo(290, 110); g.lineTo(290, 170); g.lineTo(315, 170); g.lineTo(315, 110); }
    }
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = '#f2e8c9'; g.font = 'bold 34px Impact, sans-serif'; g.textAlign = 'center';
    g.fillText(name.toUpperCase(), w / 2, 205);
    g.fillStyle = '#f5d76e'; g.fillText('$' + price, w / 2, 242);
  });
}
