// Top-left minimap: rotates with the player (forward is always up), shows the
// rooms you can reach, locked rooms, doors and nearby enemies.
import { AREAS } from './world.js';

export class Minimap {
  constructor(game) {
    this.game = game;
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.range = 22; // world units from the centre to the edge
  }

  update() {
    const { canvas, ctx, game } = this;
    const size = canvas.clientWidth;
    if (!size) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(size * dpr);
    if (canvas.width !== px) canvas.width = canvas.height = px;
    const r = px / 2, scale = r / this.range;
    const p = game.player, world = game.world;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);
    ctx.save();
    ctx.beginPath(); ctx.arc(r, r, r - dpr, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(5,5,5,.72)';
    ctx.fillRect(0, 0, px, px);

    // World -> map: centre on the player and turn so the view direction points up.
    ctx.translate(r, r);
    ctx.rotate(p.yaw);
    ctx.scale(scale, scale);
    ctx.translate(-p.pos.x, -p.pos.z);

    for (const key in AREAS) {
      const [x1, x2, z1, z2] = AREAS[key].rect;
      const open = world.isUnlocked(key);
      ctx.fillStyle = open ? 'rgba(216,208,188,.22)' : 'rgba(216,208,188,.06)';
      ctx.fillRect(x1, z1, x2 - x1, z2 - z1);
      ctx.strokeStyle = open ? 'rgba(216,208,188,.65)' : 'rgba(216,208,188,.22)';
      ctx.lineWidth = 0.45;
      ctx.strokeRect(x1, z1, x2 - x1, z2 - z1);
    }

    // Closed doors in gold (they cost money); open ones as gaps in the wall.
    for (const d of world.doors) {
      const w = d.x2 - d.x1, h = d.z2 - d.z1;
      if (d.opened) {
        ctx.fillStyle = 'rgba(216,208,188,.22)';
        ctx.fillRect(d.x1 - 0.3, d.z1 - 0.3, w + 0.6, h + 0.6);
      } else {
        ctx.fillStyle = '#e6b84a';
        ctx.fillRect(d.x1 - 0.2, d.z1 - 0.2, w + 0.4, h + 0.4);
      }
    }

    ctx.fillStyle = '#ff3b30';
    for (const e of game.enemies.list) {
      if (e.state === 'dying') continue;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.z, e.def.scale > 1.3 ? 1.1 : 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Player arrow, always in the middle pointing up.
    ctx.setTransform(1, 0, 0, 1, r, r);
    const a = 7 * dpr;
    ctx.fillStyle = '#f3ecd8';
    ctx.beginPath();
    ctx.moveTo(0, -a); ctx.lineTo(a * 0.7, a * 0.75); ctx.lineTo(0, a * 0.35); ctx.lineTo(-a * 0.7, a * 0.75);
    ctx.closePath(); ctx.fill();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = 'rgba(216,208,188,.45)';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.arc(r, r, r - dpr, 0, Math.PI * 2); ctx.stroke();
  }
}
