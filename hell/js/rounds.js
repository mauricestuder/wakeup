// Rounds ("tickets"). Each group: [type, count, gap seconds, start second, camo?]
// After round 40 the game makes rounds up (freeplay).

const R = {
  1:  [['soul', 20, 0.9, 0]],
  2:  [['soul', 32, 0.65, 0]],
  3:  [['soul', 20, 0.6, 0], ['cart', 6, 1.0, 6]],
  4:  [['soul', 26, 0.5, 0], ['cart', 15, 0.8, 4]],
  5:  [['cart', 26, 0.6, 0], ['soul', 15, 0.45, 3]],
  6:  [['soul', 15, 0.5, 0], ['cart', 16, 0.6, 2], ['infl', 5, 1.2, 8]],
  7:  [['cart', 26, 0.5, 0], ['infl', 9, 1.0, 5]],
  8:  [['cart', 22, 0.4, 0], ['infl', 15, 0.7, 4]],
  9:  [['infl', 32, 0.5, 0]],
  10: [['cart', 110, 0.18, 0]],
  11: [['infl', 18, 0.5, 0], ['lawyer', 8, 1.0, 6], ['soul', 12, 0.3, 2]],
  12: [['lawyer', 15, 0.7, 0], ['infl', 12, 0.5, 3]],
  13: [['cart', 45, 0.28, 0], ['infl', 22, 0.4, 3], ['lawyer', 6, 1.0, 9]],
  14: [['soul', 60, 0.18, 0], ['lawyer', 14, 0.6, 5], ['ceo', 3, 1.0, 10]],
  15: [['infl', 30, 0.3, 0], ['lawyer', 16, 0.5, 2], ['ceo', 8, 0.8, 8]],
  16: [['lawyer', 32, 0.38, 0], ['ceo', 10, 0.6, 6]],
  17: [['ceo', 16, 0.5, 0], ['lawyer', 22, 0.3, 3]],
  18: [['infl', 55, 0.22, 0], ['cart', 30, 0.2, 2], ['ceo', 10, 0.5, 8]],
  19: [['cart', 18, 0.6, 0, 1], ['lawyer', 22, 0.4, 2], ['ceo', 12, 0.5, 8]],
  20: [['ceo', 14, 0.4, 0], ['replyall', 1, 1, 6]],
  21: [['mime', 6, 1.2, 0], ['ceo', 20, 0.35, 3]],
  22: [['infl', 30, 0.3, 0, 1], ['mime', 8, 1.0, 4]],
  23: [['lawyer', 40, 0.25, 0], ['mime', 12, 0.8, 3], ['ceo', 20, 0.3, 8]],
  24: [['complainer', 3, 2.0, 0], ['ceo', 25, 0.3, 2]],
  25: [['complainer', 6, 1.4, 0], ['mime', 10, 0.8, 3], ['lawyer', 30, 0.2, 6, 1]],
  26: [['ceo', 50, 0.2, 0], ['mime', 15, 0.5, 4]],
  27: [['complainer', 10, 1.0, 0], ['ceo', 40, 0.25, 2], ['mime', 10, 0.6, 8, 1]],
  28: [['bus', 2, 3.0, 0], ['ceo', 30, 0.3, 2]],
  29: [['bus', 4, 2.2, 0], ['complainer', 10, 0.8, 4]],
  30: [['mime', 30, 0.35, 0], ['complainer', 14, 0.6, 3], ['ceo', 40, 0.15, 8, 1]],
  31: [['bus', 6, 1.8, 0], ['mime', 20, 0.4, 2, 1]],
  32: [['complainer', 18, 0.9, 0], ['bus', 4, 2.2, 3]],
  33: [['ceo', 60, 0.15, 0], ['ceo', 20, 0.3, 3, 1], ['mime', 20, 0.4, 4]],
  34: [['bus', 8, 1.3, 0], ['complainer', 16, 0.5, 3]],
  35: [['replyall', 1, 1, 0], ['bus', 8, 1.5, 4], ['mime', 30, 0.3, 2, 1]],
  36: [['bus', 10, 1.1, 0], ['complainer', 22, 0.4, 2]],
  37: [['bus', 9, 1.0, 0, 1], ['complainer', 18, 0.45, 3, 1]],
  38: [['replyall', 2, 6, 0], ['bus', 8, 1.2, 3]],
  39: [['bus', 14, 0.8, 0], ['complainer', 26, 0.3, 2], ['mime', 26, 0.25, 6, 1]],
  40: [['bus', 10, 1.0, 0], ['popup', 1, 1, 8]],
};

export const LAST_ROUND = 40;

function freeplay(n) {
  const k = n - 40;
  const g = [
    ['bus', 10 + k * 2, Math.max(0.25, 0.9 - k * 0.02), 0, k % 3 === 0 ? 1 : 0],
    ['complainer', 20 + k * 3, 0.3, 2, 1],
    ['replyall', 1 + Math.floor(k / 4), 3, 5],
  ];
  if (n % 10 === 0) g.push(['popup', Math.floor(k / 10), 6, 10]);
  return g;
}

// Returns spawn events sorted by time, and the HP multiplier for bosses in freeplay.
export function roundSpawns(n) {
  const groups = R[n] || freeplay(n);
  const out = [];
  for (const [type, count, gap, start, camo] of groups)
    for (let i = 0; i < count; i++) out.push({ t: start + i * gap, type, camo: !!camo });
  out.sort((a, b) => a.t - b.t);
  return out;
}

export function bossHpMul(n) { return n > 40 ? 1 + (n - 40) * 0.12 : 1; }
