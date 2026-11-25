// Waves. Each group: [type, count, gap seconds, start second, camo?, boss HP multiplier?]
// After round 40 the game makes rounds up (freeplay).

const R = {
  1:  [['crawler', 20, 0.9, 0]],
  2:  [['crawler', 32, 0.65, 0]],
  3:  [['crawler', 20, 0.6, 0], ['walker', 6, 1.0, 6]],
  4:  [['crawler', 26, 0.5, 0], ['walker', 15, 0.8, 4]],
  5:  [['walker', 26, 0.6, 0], ['crawler', 15, 0.45, 3]],
  6:  [['crawler', 15, 0.5, 0], ['walker', 16, 0.6, 2], ['hardhat', 5, 1.2, 8]],
  7:  [['walker', 26, 0.5, 0], ['hardhat', 9, 1.0, 5]],
  8:  [['walker', 22, 0.4, 0], ['hardhat', 15, 0.7, 4]],
  9:  [['hardhat', 32, 0.5, 0]],
  10: [['walker', 110, 0.18, 0]],
  11: [['hardhat', 18, 0.5, 0], ['jogger', 8, 1.0, 6], ['crawler', 12, 0.3, 2]],
  12: [['jogger', 15, 0.7, 0], ['hardhat', 12, 0.5, 3]],
  13: [['walker', 45, 0.28, 0], ['hardhat', 22, 0.4, 3], ['jogger', 6, 1.0, 9]],
  14: [['crawler', 60, 0.18, 0], ['jogger', 14, 0.6, 5], ['football', 3, 1.0, 10]],
  15: [['hardhat', 30, 0.3, 0], ['jogger', 16, 0.5, 2], ['football', 8, 0.8, 8]],
  16: [['jogger', 32, 0.38, 0], ['football', 10, 0.6, 6]],
  17: [['football', 16, 0.5, 0], ['jogger', 22, 0.3, 3]],
  18: [['hardhat', 55, 0.22, 0], ['walker', 30, 0.2, 2], ['football', 10, 0.5, 8]],
  19: [['walker', 18, 0.6, 0, 1], ['jogger', 22, 0.4, 2], ['football', 12, 0.5, 8]],
  20: [['football', 14, 0.4, 0], ['couch', 1, 1, 6]],
  21: [['headphones', 6, 1.2, 0], ['football', 20, 0.35, 3]],
  22: [['hardhat', 30, 0.3, 0, 1], ['headphones', 8, 1.0, 4]],
  23: [['jogger', 40, 0.25, 0], ['headphones', 12, 0.8, 3], ['football', 20, 0.3, 8]],
  24: [['riot', 3, 2.0, 0], ['football', 25, 0.3, 2]],
  25: [['riot', 6, 1.4, 0], ['headphones', 10, 0.8, 3], ['jogger', 30, 0.2, 6, 1]],
  26: [['football', 50, 0.2, 0], ['headphones', 15, 0.5, 4]],
  27: [['riot', 10, 1.0, 0], ['football', 40, 0.25, 2], ['headphones', 10, 0.6, 8, 1]],
  28: [['partybus', 2, 3.0, 0], ['football', 30, 0.3, 2]],
  29: [['partybus', 4, 2.2, 0], ['riot', 10, 0.8, 4]],
  30: [['headphones', 20, 0.4, 0], ['football', 30, 0.2, 3, 1], ['mru', 1, 1, 7, 0, 0.4]],
  31: [['partybus', 6, 1.8, 0], ['headphones', 20, 0.4, 2, 1]],
  32: [['riot', 18, 0.9, 0], ['partybus', 4, 2.2, 3]],
  33: [['football', 60, 0.15, 0], ['football', 20, 0.3, 3, 1], ['headphones', 20, 0.4, 4]],
  34: [['partybus', 8, 1.3, 0], ['riot', 16, 0.5, 3]],
  35: [['couch', 1, 1, 0], ['partybus', 8, 1.5, 4], ['headphones', 30, 0.3, 2, 1]],
  36: [['partybus', 10, 1.1, 0], ['riot', 22, 0.4, 2]],
  37: [['partybus', 9, 1.0, 0, 1], ['riot', 18, 0.45, 3, 1]],
  38: [['couch', 2, 6, 0], ['partybus', 8, 1.2, 3]],
  39: [['partybus', 14, 0.8, 0], ['riot', 26, 0.3, 2], ['headphones', 26, 0.25, 6, 1]],
  40: [['partybus', 10, 1.0, 0], ['offshore', 1, 1, 8]],
};

export const LAST_ROUND = 40;

function freeplay(n) {
  const k = n - 40;
  const g = [
    ['partybus', 10 + k * 2, Math.max(0.25, 0.9 - k * 0.02), 0, k % 3 === 0 ? 1 : 0],
    ['riot', 20 + k * 3, 0.3, 2, 1],
    ['couch', 1 + Math.floor(k / 4), 3, 5],
  ];
  if (n % 10 === 0) g.push(['offshore', Math.floor(k / 10), 8, 10]);
  else if (n % 5 === 0) g.push(['mru', 1, 6, 10]);
  return g;
}

// Returns spawn events sorted by time, and the HP multiplier for bosses in freeplay.
export function roundSpawns(n) {
  const groups = R[n] || freeplay(n);
  const out = [];
  for (const [type, count, gap, start, camo, hp] of groups)
    for (let i = 0; i < count; i++) out.push({ t: start + i * gap, type, camo: !!camo, hp: hp || 1 });
  out.sort((a, b) => a.t - b.t);
  return out;
}

export function bossHpMul(n) { return n > 40 ? 1 + (n - 40) * 0.12 : 1; }
