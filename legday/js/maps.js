// Maps: the road zombies walk along, plus stuff you can't build on.
// The map area is W x H world units; the shop sidebar lives outside it.

export const W = 1280, H = 900;
export const LANE = 30;          // half width of the road
const STEP = 2;                  // path sample spacing

export const MAPS = [
  {
    id: 'street', name: 'Main Street', blurb: 'A long road through town. Good for your first workout.',
    floor: ['#56763d', '#4f6e38'],
    pts: [[-50, 140], [340, 140], [340, 420], [140, 420], [140, 760], [580, 760], [580, 250],
          [820, 250], [820, 640], [1060, 640], [1060, 140], [1310, 140]],
    blockers: [
      { kind: 'sign', x: 530, y: 24, w: 470, h: 84 },
      { kind: 'car', x: 370, y: 515, w: 140, h: 70, col: '#3f7fd0' },
      { kind: 'tree', cx: 700, cy: 830, r: 34 },
      { kind: 'tree', cx: 40, cy: 860, r: 30 },
      { kind: 'dumpster', x: 870, y: 724, w: 150, h: 56 },
      { kind: 'hydrant', cx: 240, cy: 240, r: 22 },
      { kind: 'tree', cx: 1230, cy: 860, r: 30 },
      { kind: 'manhole', cx: 700, cy: 470, r: 30 },
    ],
  },
  {
    id: 'gas', name: 'Gas Station', blurb: 'Short road, burning wrecks everywhere. Hard.',
    floor: ['#7a7a76', '#717170'],
    pts: [[-50, 450], [480, 450], [480, 150], [820, 150], [820, 750], [1100, 750], [1100, 450], [1330, 450]],
    blockers: [
      { kind: 'wreck', cx: 240, cy: 220, r: 110 },
      { kind: 'wreck', cx: 240, cy: 700, r: 125 },
      { kind: 'wreck', cx: 650, cy: 470, r: 92 },
      { kind: 'wreck', cx: 960, cy: 320, r: 100 },
      { kind: 'wreck', cx: 1210, cy: 190, r: 72 },
      { kind: 'pumps', x: 560, y: 790, w: 180, h: 70 },
      { kind: 'hydrant', cx: 1220, cy: 760, r: 22 },
    ],
  },
];

export function buildPath(map) {
  const segs = [];
  let len = 0;
  for (let i = 0; i < map.pts.length - 1; i++) {
    const [ax, ay] = map.pts[i], [bx, by] = map.pts[i + 1];
    const l = Math.hypot(bx - ax, by - ay);
    segs.push({ ax, ay, bx, by, l, start: len });
    len += l;
  }
  const n = Math.ceil(len / STEP) + 2;
  const px = new Float32Array(n), py = new Float32Array(n);
  let si = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.min(i * STEP, len);
    while (si < segs.length - 1 && d > segs[si].start + segs[si].l) si++;
    const s = segs[si], t = s.l ? (d - s.start) / s.l : 0;
    px[i] = s.ax + (s.bx - s.ax) * t;
    py[i] = s.ay + (s.by - s.ay) * t;
  }
  return { px, py, len, segs, n };
}

// Writes x, y and facing (dx) for distance d along the path into out.
export function posAt(path, d, out) {
  let f = d / STEP;
  if (f < 0) f = 0;
  if (f > path.n - 2) f = path.n - 2;
  const i = f | 0, t = f - i;
  const x0 = path.px[i], y0 = path.py[i], x1 = path.px[i + 1], y1 = path.py[i + 1];
  out.x = x0 + (x1 - x0) * t;
  out.y = y0 + (y1 - y0) * t;
  if (x1 !== x0) out.dx = x1 > x0 ? 1 : -1;
  if (x1 !== x0 || y1 !== y0) out.ang = Math.atan2(y1 - y0, x1 - x0);
  return out;
}

function segDist(px, py, s) {
  const vx = s.bx - s.ax, vy = s.by - s.ay;
  let t = ((px - s.ax) * vx + (py - s.ay) * vy) / (vx * vx + vy * vy || 1);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (s.ax + vx * t), py - (s.ay + vy * t));
}

export function pathDist(path, x, y) {
  let m = Infinity;
  for (const s of path.segs) m = Math.min(m, segDist(x, y, s));
  return m;
}

function blockerHit(b, x, y, r) {
  if (b.r) return Math.hypot(x - b.cx, y - b.cy) < b.r + r - 6;
  const cx = Math.max(b.x, Math.min(x, b.x + b.w)), cy = Math.max(b.y, Math.min(y, b.y + b.h));
  return Math.hypot(x - cx, y - cy) < r - 4;
}

export function canPlace(map, path, towers, x, y, r) {
  if (x < r || y < r || x > W - r || y > H - r) return false;
  if (pathDist(path, x, y) < LANE + r - 4) return false;
  for (const b of map.blockers) if (blockerHit(b, x, y, r)) return false;
  for (const t of towers) if (Math.hypot(t.x - x, t.y - y) < t.r + r - 2) return false;
  return true;
}
