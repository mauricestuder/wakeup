// Maps: the roads the robbers run along (from a manhole to the bank), plus
// stuff you can't build on. A map can have several roads, and a road can
// dive into sewer tunnels where nobody can hit the robbers.
// The map area is W x H world units; the shop sidebar lives outside it.

export const W = 1280, H = 900;
export const LANE = 30;          // half width of the road
const STEP = 2;                  // path sample spacing
const EMERGE = 28;               // robbers can't be hit while climbing out of the manhole

// The bank is the end of every road. Its door is at the bottom middle.
const bank = (x, y, w, h) => ({ kind: 'bank', x, y, w, h });
export const bankDoor = b => [b.x + b.w / 2, b.y + b.h - 14];

export const MAPS = [
  {
    id: 'street', name: 'Main Street', blurb: 'A long road through town. Good for your first shift.',
    floor: ['#8ad35e', '#82cb57'],
    roads: [{ pts: [[70, 140], [340, 140], [340, 420], [140, 420], [140, 760], [580, 760], [580, 250],
                    [820, 250], [820, 640], [1060, 640], [1060, 426], [1185, 426]] }],
    blockers: [
      { kind: 'sign', x: 530, y: 24, w: 470, h: 84 },
      { kind: 'car', x: 370, y: 515, w: 140, h: 70, col: '#3f7fd0' },
      { kind: 'tree', cx: 700, cy: 830, r: 34 },
      { kind: 'tree', cx: 40, cy: 860, r: 30 },
      { kind: 'dumpster', x: 870, y: 724, w: 150, h: 56 },
      { kind: 'hydrant', cx: 240, cy: 240, r: 22 },
      { kind: 'tree', cx: 1230, cy: 860, r: 30 },
      { kind: 'grate', cx: 700, cy: 470, r: 30 },
      bank(1090, 120, 190, 320),
    ],
  },
  {
    id: 'gas', name: 'Gas Station', blurb: 'Short road, food trucks parked everywhere. Hard.',
    floor: ['#e6dac4', '#ddd0b8'],
    roads: [{ pts: [[70, 450], [480, 450], [480, 150], [820, 150], [820, 750], [1100, 750], [1100, 446], [1205, 446]] }],
    blockers: [
      { kind: 'truck', cx: 240, cy: 220, r: 110 },
      { kind: 'truck', cx: 240, cy: 700, r: 125 },
      { kind: 'truck', cx: 650, cy: 470, r: 92 },
      { kind: 'truck', cx: 960, cy: 320, r: 100 },
      { kind: 'pumps', x: 560, y: 790, w: 180, h: 70 },
      { kind: 'hydrant', cx: 1220, cy: 760, r: 22 },
      bank(1130, 120, 150, 340),
    ],
  },
  {
    id: 'downtown', name: 'Downtown Crossing', blurb: 'The road crosses itself 3 times. Build at the crossings!',
    floor: ['#dfe3ea', '#d7dce4'],
    roads: [{ pts: [[110, 830], [110, 300], [760, 300], [760, 800], [430, 800], [430, 150], [960, 150], [960, 560],
                    [600, 560], [600, 706], [1175, 706]] }],
    blockers: [
      { kind: 'fountain', cx: 270, cy: 560, r: 62 },
      { kind: 'tree', cx: 600, cy: 420, r: 34 },
      { kind: 'tree', cx: 1110, cy: 120, r: 34 },
      { kind: 'hotdog', x: 820, y: 380, w: 90, h: 60 },
      { kind: 'tree', cx: 40, cy: 120, r: 26 },
      bank(1070, 420, 210, 300),
    ],
  },
  {
    id: 'twin', name: 'Twin Heist', blurb: 'Two manholes, two roads, one bank. Watch both sides!',
    floor: ['#9bd86c', '#93d065'],
    roads: [
      { pts: [[90, 160], [330, 160], [330, 330], [620, 330], [620, 160], [900, 160], [900, 470], [1160, 470]] },
      { pts: [[90, 760], [330, 760], [330, 590], [620, 590], [620, 760], [900, 760], [900, 470], [1160, 470]] },
    ],
    blockers: [
      { kind: 'statue', cx: 760, cy: 470, r: 52 },
      { kind: 'tree', cx: 470, cy: 470, r: 40 },
      { kind: 'tree', cx: 200, cy: 470, r: 34 },
      { kind: 'tree', cx: 760, cy: 860, r: 30 },
      { kind: 'tree', cx: 470, cy: 60, r: 30 },
      bank(1040, 200, 240, 284),
    ],
  },
  {
    id: 'sewer', name: 'Sewer Run', blurb: 'The robbers sneak through 2 sewer tunnels. You can\'t hit them down there.',
    floor: ['#b6d978', '#aed172'],
    roads: [{ pts: [[100, 140], [600, 140], [600, 420], [180, 420], [180, 780], [700, 780], [700, 300], [960, 300], [960, 700], [1170, 700]],
              tunnels: [2, 5] }],
    blockers: [
      { kind: 'tree', cx: 390, cy: 600, r: 40 },
      { kind: 'tree', cx: 840, cy: 560, r: 36 },
      { kind: 'dumpster', x: 760, y: 150, w: 150, h: 56 },
      { kind: 'tree', cx: 1220, cy: 120, r: 30 },
      bank(1060, 420, 220, 294),
    ],
  },
];

export function buildPath(road) {
  const segs = [];
  let len = 0;
  const tunnelSegs = new Set(road.tunnels || []);
  for (let i = 0; i < road.pts.length - 1; i++) {
    const [ax, ay] = road.pts[i], [bx, by] = road.pts[i + 1];
    const l = Math.hypot(bx - ax, by - ay);
    segs.push({ ax, ay, bx, by, l, start: len, tunnel: tunnelSegs.has(i) });
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
  const tunnels = segs.filter(s => s.tunnel).map(s => [s.start + 6, s.start + s.l - 6]);
  return { px, py, len, segs, n, tunnels, pts: road.pts };
}
export const buildPaths = map => map.roads.map(buildPath);

// Underground: still climbing out of the manhole, or inside a sewer tunnel.
export function isUnder(path, d) {
  if (d < EMERGE) return true;
  for (const [a, b] of path.tunnels) if (d > a && d < b) return true;
  return false;
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

// Distance to the nearest piece of open road (tunnels don't count: you can build on top of them).
export function pathDist(path, x, y) {
  let m = Infinity;
  for (const s of path.segs) if (!s.tunnel) m = Math.min(m, segDist(x, y, s));
  return m;
}

function blockerHit(b, x, y, r) {
  if (b.r) return Math.hypot(x - b.cx, y - b.cy) < b.r + r - 6;
  const cx = Math.max(b.x, Math.min(x, b.x + b.w)), cy = Math.max(b.y, Math.min(y, b.y + b.h));
  return Math.hypot(x - cx, y - cy) < r - 4;
}

export function canPlace(map, paths, towers, x, y, r) {
  if (x < r || y < r || x > W - r || y > H - r) return false;
  for (const path of paths) {
    if (pathDist(path, x, y) < LANE + r - 4) return false;
    if (Math.hypot(x - path.px[0], y - path.py[0]) < 44 + r) return false;     // the manhole
    for (const [a, b] of path.tunnels) {                                       // tunnel entrances
      for (const d of [a - 6, b + 6]) {
        const q = posAt(path, d, { x: 0, y: 0 });
        if (Math.hypot(x - q.x, y - q.y) < 38 + r) return false;
      }
    }
  }
  for (const b of map.blockers) if (blockerHit(b, x, y, r)) return false;
  for (const t of towers) if (Math.hypot(t.x - x, t.y - y) < t.r + r - 2) return false;
  return true;
}
