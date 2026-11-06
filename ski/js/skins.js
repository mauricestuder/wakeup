// Outfit textures: each outfit paints its jacket, pants and gear (skis or
// board) with a pattern on a small canvas, plus a glow map for the parts
// that light up. Every texture gets soft shading, fabric grain and seams so
// the boxes read as clothing. The Aurora outfit is animated.
import * as THREE from '../../game/vendor/three.module.min.js';

const S = 128;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const shade = (n, k) => { // k > 0 lightens, k < 0 darkens
  const c = new THREE.Color(n); const t = k > 0 ? new THREE.Color(1, 1, 1) : new THREE.Color(0, 0, 0);
  return '#' + c.lerp(t, Math.abs(k)).getHexString();
};
// Small seeded random so patterns are the same every time.
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Each pattern draws on g (colour) and e (glow, black = no glow).
// c = { base, alt, acc } as hex numbers.
const PATTERNS = {
  solid(g, e, c) { g.fillStyle = hex(c.base); g.fillRect(0, 0, S, S); },
  band(g, e, c) { // chest band with pinstripes
    PATTERNS.solid(g, e, c);
    g.fillStyle = hex(c.alt); g.fillRect(0, 44, S, 34);
    g.fillStyle = hex(c.acc); g.fillRect(0, 40, S, 4); g.fillRect(0, 78, S, 4);
    if (c.glow) { e.fillStyle = hex(c.acc); e.fillRect(0, 40, S, 4); e.fillRect(0, 78, S, 4); }
  },
  split(g, e, c) { // diagonal colour block
    PATTERNS.solid(g, e, c);
    g.fillStyle = hex(c.alt); g.beginPath(); g.moveTo(0, S * 0.25); g.lineTo(S, S * 0.75); g.lineTo(S, S); g.lineTo(0, S); g.fill();
    g.strokeStyle = hex(c.acc); g.lineWidth = 6; g.beginPath(); g.moveTo(0, S * 0.25); g.lineTo(S, S * 0.75); g.stroke();
  },
  candy(g, e, c) {
    PATTERNS.solid(g, e, c);
    g.fillStyle = hex(c.alt);
    for (let i = -S; i < S * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 14, 0); g.lineTo(i + 14 - S, S); g.lineTo(i - S, S); g.fill(); }
  },
  camo(g, e, c) {
    PATTERNS.solid(g, e, c);
    const r = rnd(7);
    for (const col of [c.alt, c.acc, shade(c.base, -0.45)]) {
      g.fillStyle = typeof col === 'string' ? col : hex(col);
      for (let i = 0; i < 9; i++) {
        const x = r() * S, y = r() * S;
        g.beginPath();
        for (let a = 0; a < 7; a++) {
          const ang = (a / 7) * Math.PI * 2, rr = 8 + r() * 12;
          g.lineTo(x + Math.cos(ang) * rr * 1.4, y + Math.sin(ang) * rr);
        }
        g.fill();
      }
    }
  },
  check(g, e, c) {
    PATTERNS.solid(g, e, c);
    g.fillStyle = hex(c.alt);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 16, y * 16, 16, 16);
  },
  tiger(g, e, c) {
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, hex(c.base)); gr.addColorStop(1, shade(c.base, -0.25));
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = hex(c.alt);
    const r = rnd(3);
    for (let y = 6; y < S; y += 20) {
      const side = r() > 0.5 ? 0 : S, dir = side ? -1 : 1, len = 40 + r() * 60;
      g.beginPath(); g.moveTo(side, y - 5); g.quadraticCurveTo(side + dir * len * 0.5, y - 2 + r() * 8, side + dir * len, y + 4);
      g.quadraticCurveTo(side + dir * len * 0.5, y + 6, side, y + 7); g.fill();
    }
  },
  gradient(g, e, c) {
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, hex(c.alt)); gr.addColorStop(0.55, hex(c.base)); gr.addColorStop(1, hex(c.acc));
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  },
  flames(g, e, c) {
    PATTERNS.solid(g, e, c);
    for (const [ctx, k] of [[g, 1], [e, 0.9]]) {
      const gr = ctx.createLinearGradient(0, S, 0, 20);
      gr.addColorStop(0, hex(c.acc)); gr.addColorStop(0.5, hex(c.alt)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = k; ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, S);
      for (let x = 0; x <= S; x += 16) { ctx.quadraticCurveTo(x + 4, S - 50 - (x % 32 ? 30 : 60), x + 8, S - 40); ctx.quadraticCurveTo(x + 12, S - 70, x + 16, S - 30); }
      ctx.lineTo(S, S); ctx.fill(); ctx.globalAlpha = 1;
    }
  },
  stars(g, e, c) {
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, hex(c.base)); gr.addColorStop(1, hex(c.alt));
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    const r = rnd(11);
    g.globalAlpha = 0.35; g.fillStyle = hex(c.acc);
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(r() * S, r() * S, 30, 12, r() * 3, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    for (let i = 0; i < 46; i++) {
      const x = r() * S, y = r() * S, s = r() < 0.15 ? 2.6 : 1.2;
      for (const ctx of [g, e]) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); }
    }
  },
  circuit(g, e, c) {
    PATTERNS.solid(g, e, c);
    const r = rnd(5);
    for (const ctx of [g, e]) { ctx.strokeStyle = hex(c.acc); ctx.fillStyle = hex(c.acc); ctx.lineWidth = 2.5; }
    for (let i = 0; i < 14; i++) {
      let x = Math.round(r() * 8) * 16, y = Math.round(r() * 8) * 16;
      const pts = [[x, y]];
      for (let k = 0; k < 3; k++) { if (r() > 0.5) x += (r() > 0.5 ? 1 : -1) * 24; else y += 24; pts.push([x, y]); }
      for (const ctx of [g, e]) {
        ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts) ctx.lineTo(...p); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
      }
    }
  },
  drip(g, e, c) {
    PATTERNS.solid(g, e, c);
    const r = rnd(9);
    for (const ctx of [g, e]) {
      ctx.fillStyle = hex(c.acc); ctx.fillRect(0, 0, S, 14);
      for (let x = 4; x < S; x += 14) {
        const len = 18 + r() * 60;
        ctx.fillRect(x, 0, 7, len); ctx.beginPath(); ctx.arc(x + 3.5, len, 5.5, 0, 7); ctx.fill();
      }
    }
  },
  sparkle(g, e, c) { // brushed gold with glints
    const gr = g.createLinearGradient(0, 0, S, S);
    gr.addColorStop(0, shade(c.base, 0.35)); gr.addColorStop(0.3, hex(c.base)); gr.addColorStop(0.55, shade(c.base, -0.35));
    gr.addColorStop(0.8, hex(c.base)); gr.addColorStop(1, shade(c.base, 0.3));
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.globalAlpha = 0.18; g.fillStyle = '#ffffff';
    for (let y = 0; y < S; y += 3) g.fillRect(0, y, S, 1);
    g.globalAlpha = 1;
    const r = rnd(13);
    for (let i = 0; i < 10; i++) {
      const x = r() * S, y = r() * S, s = 3 + r() * 5;
      for (const ctx of [g, e]) {
        ctx.fillStyle = '#fffbe6'; ctx.beginPath();
        ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.25, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.25, y); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x, y + s * 0.25); ctx.lineTo(x + s, y); ctx.lineTo(x, y - s * 0.25); ctx.fill();
      }
    }
  },
  // Animated: flowing curtains of light; t is time in seconds.
  aurora(g, e, c, t = 0) {
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#0a0f2e'); gr.addColorStop(1, '#170a33');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
    const cols = ['#2bffb1', '#29d4ff', '#b24dff', '#ff4dc4'];
    for (let b = 0; b < 4; b++) {
      for (const [ctx, a] of [[g, 0.75], [e, 0.85]]) {
        ctx.globalAlpha = a;
        ctx.fillStyle = cols[b];
        ctx.beginPath();
        for (let x = 0; x <= S; x += 4) {
          const y = 18 + b * 28 + Math.sin(x * 0.05 + t * (1.1 + b * 0.3) + b * 2) * 12 + Math.sin(x * 0.11 - t * 0.7) * 2.5;
          ctx.lineTo(x, y);
        }
        for (let x = S; x >= 0; x -= 4) {
          const y = 18 + b * 28 + Math.sin(x * 0.05 + t * (1.1 + b * 0.3) + b * 2) * 12 + Math.sin(x * 0.11 - t * 0.7) * 2.5 + 12 + 6 * Math.sin(x * 0.04 + t * 1.5);
          ctx.lineTo(x, y);
        }
        ctx.fill();
      }
    }
    g.globalAlpha = e.globalAlpha = 1;
    const r = rnd(17);
    for (let i = 0; i < 24; i++) {
      const x = r() * S, y = r() * S, tw = 0.5 + 0.5 * Math.sin(t * 4 + i);
      for (const ctx of [g, e]) { ctx.fillStyle = `rgba(255,255,255,${tw})`; ctx.fillRect(x, y, 2, 2); }
    }
  },
};

// Shading, grain and seams on top of a pattern so it reads as fabric.
function finish(g, part) {
  const gr = g.createLinearGradient(0, 0, 0, S);
  gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const r = rnd(part.length * 31 + 1);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    g.fillRect(r() * S, r() * S, 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.32)'; g.lineWidth = 5; g.strokeRect(0, 0, S, S);
  if (part !== 'gear') { // stitched seam
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.5; g.setLineDash([4, 4]);
    g.strokeRect(6, 6, S - 12, S - 12); g.setLineDash([]);
  }
}

function canvas() { const c = document.createElement('canvas'); c.width = c.height = S; return c; }

function partColors(skin, part) {
  const base = skin[part];
  const alt = skin.alt?.[part] ?? (part === 'pants' ? shade(base, -0.3) : skin.accent);
  return { base, alt: typeof alt === 'string' ? parseInt(alt.slice(1), 16) : alt, acc: skin.accent, glow: !!skin.glow?.includes(part) };
}

function paint(skin, part, cv, ev, t) {
  const g = cv.getContext('2d'), e = ev.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
  const pat = PATTERNS[skin.pat?.[part]] || PATTERNS.solid;
  pat(g, e, partColors(skin, part), t);
  finish(g, part);
}

const cache = new Map();
// { map, glow, live } for an outfit's part; live parts redraw over time.
export function partTextures(id, skin, part) {
  const k = id + ':' + part;
  if (cache.has(k)) return cache.get(k);
  const cv = canvas(), ev = canvas();
  paint(skin, part, cv, ev, 0);
  const mk = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const glows = skin.pat?.[part] === 'aurora' || ['stars', 'circuit', 'drip', 'flames', 'sparkle', 'band'].includes(skin.pat?.[part]) && skin.glow?.includes(part);
  const out = { map: mk(cv), glow: glows ? mk(ev) : null, live: skin.pat?.[part] === 'aurora', cv, ev, skin, part };
  cache.set(k, out);
  return out;
}
export function repaint(tx, t) {
  paint(tx.skin, tx.part, tx.cv, tx.ev, t);
  tx.map.needsUpdate = true;
  if (tx.glow) tx.glow.needsUpdate = true;
}

// A small drawn figure in the outfit, for shop and locker cards.
const icons = new Map();
export function outfitIcon(id, skin) {
  if (icons.has(id)) return icons.get(id);
  const W = 120, c = document.createElement('canvas'); c.width = c.height = W;
  const g = c.getContext('2d');
  const pc = (part) => { const cv = canvas(), ev = canvas(); paint(skin, part, cv, ev, 1.3); return cv; };
  const jacket = pc('jacket'), pants = pc('pants'), gear = pc('gear');
  const fill = (img, path) => { g.save(); path(); g.clip(); g.drawImage(img, 0, 0, S, S, -10, -10, W + 20, W + 20); g.restore(); g.save(); path(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.stroke(); g.restore(); };
  const rr = (x, y, w, h, r) => () => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  g.translate(W / 2, W / 2); g.rotate(-0.12); g.translate(-W / 2, -W / 2);
  // board under the feet
  fill(gear, rr(14, 98, 92, 12, 6));
  // legs
  fill(pants, rr(40, 66, 18, 34, 5)); fill(pants, rr(62, 66, 18, 34, 5));
  // arms
  fill(jacket, rr(22, 36, 14, 34, 6)); fill(jacket, rr(84, 36, 14, 34, 6));
  g.fillStyle = '#1a1d22'; g.beginPath(); g.arc(29, 72, 6, 0, 7); g.arc(91, 72, 6, 0, 7); g.fill();
  // torso + trim
  fill(jacket, rr(34, 32, 52, 40, 9));
  g.fillStyle = hex(skin.trim ?? skin.accent); g.fillRect(36, 64, 48, 5); g.fillRect(56, 34, 4, 30);
  // helmet + goggles
  g.fillStyle = hex(skin.helmet ?? 0xf2f2f2); g.beginPath(); g.arc(60, 20, 15, 0, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#16181c'; g.beginPath(); g.roundRect(46, 17, 28, 9, 4); g.fill();
  g.fillStyle = hex(skin.lens ?? 0xffb02e); g.beginPath(); g.roundRect(49, 19, 22, 5, 3); g.fill();
  const url = c.toDataURL();
  icons.set(id, url);
  return url;
}
