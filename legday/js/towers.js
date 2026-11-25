// Gym bro tower definitions. Each has a base stat block and two upgrade paths of three
// tiers. Upgrade rule: one path can reach tier 3, the other stops at tier 1.

export const TOWERS = {
  dumbbell: {
    name: 'Dumbbell Bro', cost: 200, r: 24, key: '1',
    desc: 'Throws dumbbells. Cheap, reliable, never skips arm day.',
    base: { range: 160, cd: 0.9, dmg: 1, pierce: 2, kind: 'sharp', speed: 720, count: 1, spread: 0, psize: 11 },
    paths: [[
      { name: 'Heavier Plates', cost: 140, desc: 'Each dumbbell smashes through 2 more zombies.', fx: s => { s.pierce += 2; } },
      { name: 'Double Curl', cost: 240, desc: 'Throws 2 dumbbells at once.', fx: s => { s.count = 2; s.spread = 14; s.pierce += 1; } },
      { name: 'Barbell Toss', cost: 1300, desc: 'Throws a whole barbell: 3 damage, 12 pierce, breaks riot shields.', fx: s => { s.dmg = 3; s.pierce = 12; s.kind = 'magic'; s.psize = 19; s.range += 20; } },
    ], [
      { name: 'Pre-Workout', cost: 110, desc: 'Throws 33% faster.', fx: s => { s.cd *= 0.75; } },
      { name: 'Focus Headband', cost: 260, desc: 'Spots zombies hiding in trash cans. More range.', fx: s => { s.detect = true; s.range += 35; } },
      { name: 'NO DAYS OFF', cost: 1100, desc: 'Dumbbell machine-gun. REP REP REP REP.', fx: s => { s.cd *= 0.26; s.speed = 900; } },
    ]],
  },
  spinner: {
    name: 'Kettlebell Spinner', cost: 330, r: 26, key: '2',
    desc: 'Spins a kettlebell and flings weight plates in every direction.',
    base: { range: 110, cd: 1.25, dmg: 1, pierce: 1, kind: 'sharp', speed: 520, count: 8, psize: 9 },
    paths: [[
      { name: 'More Plates', cost: 230, desc: '12 plates per spin.', fx: s => { s.count = 12; } },
      { name: 'Spicy Pre-Workout', cost: 480, desc: 'Plates set zombies on fire. Burns riot zombies too.', fx: s => { s.kind = 'fire'; s.burn = true; } },
      { name: 'Tornado of Gains', cost: 2500, desc: '20 burning plates, 4 pierce, spins like crazy.', fx: s => { s.count = 20; s.pierce = 4; s.cd *= 0.4; s.dmg = 2; } },
    ], [
      { name: 'Longer Chain', cost: 130, desc: 'More range.', fx: s => { s.range += 28; } },
      { name: 'Faster Spin', cost: 320, desc: 'Spins 50% faster.', fx: s => { s.cd *= 0.66; } },
      { name: 'Ring of Fire', cost: 2700, desc: 'A ring of flames burns everything in range, all the time.', fx: s => { s.ring = true; s.ringCd = 0.16; s.kind = 'fire'; s.range += 12; } },
    ]],
  },
  shake: {
    name: 'Protein Shake Grenadier', cost: 560, r: 28, key: '3',
    desc: 'Lobs exploding protein shakes. The blast breaks riot shields.',
    base: { range: 145, cd: 1.5, dmg: 1, pierce: 14, kind: 'blast', blast: 46, targets: 1, stun: 0 },
    paths: [[
      { name: 'Bigger Shaker', cost: 320, desc: 'Bigger blast, hits more zombies.', fx: s => { s.blast = 62; s.pierce = 24; } },
      { name: 'Expired Protein', cost: 520, desc: 'Zombies hit stop to gag for a moment.', fx: s => { s.stun = 0.6; } },
      { name: 'Creatine Nuke', cost: 2900, desc: '4 damage, enormous blast. Shakes the street.', fx: s => { s.dmg = 4; s.blast = 95; s.pierce = 70; s.shake = true; } },
    ], [
      { name: 'Faster Shaking', cost: 260, desc: 'Throws 33% faster.', fx: s => { s.cd *= 0.75; } },
      { name: 'Triple Shake', cost: 640, desc: 'Throws at 3 zombies at once.', fx: s => { s.targets = 3; } },
      { name: 'Shake Barrage', cost: 3100, desc: 'Way faster, huge range, shakes raining everywhere.', fx: s => { s.cd *= 0.45; s.range += 70; s.targets = 5; } },
    ]],
  },
  dj: {
    name: 'DJ Bro', cost: 300, r: 22, key: '4',
    desc: 'Blasts the gym playlist. Zombies start dancing and slow down. Headphones zombies can\'t hear it.',
    base: { range: 105, slow: 0.6 },
    paths: [[
      { name: 'Bass Boost', cost: 210, desc: 'Even slower.', fx: s => { s.slow = 0.45; } },
      { name: 'Drop The Beat', cost: 470, desc: 'Every few seconds everyone nearby freezes to dance.', fx: s => { s.holdCd = 2.5; s.holdT = 0.9; } },
      { name: 'Bass So Loud It Hurts', cost: 1900, desc: 'The bass damages everyone in range.', fx: s => { s.hurtCd = 0.45; s.slow = 0.35; } },
    ], [
      { name: 'Bigger Speakers', cost: 160, desc: 'More range.', fx: s => { s.range += 35; } },
      { name: 'Wrong Way!', cost: 520, desc: 'Confuses zombies and sends them back down the street.', fx: s => { s.pushCd = 3; s.pushN = 6; s.push = 70; } },
      { name: 'Festival Mode', cost: 2300, desc: 'Huge range, slows bosses fully, constant confusion.', fx: s => { s.range += 60; s.bossSlow = true; s.pushCd = 1.4; s.pushN = 16; s.slow = Math.min(s.slow, 0.45); } },
    ]],
  },
  chad: {
    name: 'The Chad', cost: 420, r: 24, key: '5',
    desc: 'Throws weight-plate frisbees anywhere on the map. Spots trash-can zombies.',
    base: { range: 9999, cd: 1.6, dmg: 2, kind: 'sharp', detect: true, multi: 1, cashPerHit: 0, bossMul: 1 },
    paths: [[
      { name: 'Heavy Plates', cost: 360, desc: '4 damage. Breaks riot shields.', fx: s => { s.dmg = 4; s.kind = 'magic'; } },
      { name: 'Sponsored', cost: 1050, desc: '7 damage and +$2 every hit. This hit was sponsored.', fx: s => { s.dmg = 7; s.cashPerHit = 2; } },
      { name: 'Final Form', cost: 4200, desc: '30 damage, triple damage to bosses.', fx: s => { s.dmg = 30; s.bossMul = 3; } },
    ], [
      { name: 'Fast Twitch', cost: 310, desc: 'Throws 40% faster.', fx: s => { s.cd *= 0.7; } },
      { name: 'Arm Day', cost: 1250, desc: 'Throws almost 3x as fast.', fx: s => { s.cd *= 0.36; } },
      { name: 'Main Character', cost: 3600, desc: 'Each throw hits the 4 strongest zombies.', fx: s => { s.multi = 4; s.cd *= 0.8; } },
    ]],
  },
  store: {
    name: 'Supplement Store', cost: 800, r: 30, key: '6',
    desc: 'Sells overpriced supplements. Pays out after every wave.',
    base: { range: 0, income: 80, interest: 0, interestMax: 0, tips: false },
    paths: [[
      { name: 'Protein Bars', cost: 520, desc: '+$60 per wave.', fx: s => { s.income += 60; } },
      { name: 'Gym Memberships', cost: 1350, desc: '+$140 per wave.', fx: s => { s.income += 140; } },
      { name: 'Supplement Empire', cost: 4600, desc: '+$520 per wave.', fx: s => { s.income += 520; } },
    ], [
      { name: 'Savings Account', cost: 420, desc: '+5% of your cash every wave (max $150).', fx: s => { s.interest = 0.05; s.interestMax = 150; } },
      { name: 'Tip Jar', cost: 950, desc: 'Every zombie hit nearby gives +$1 extra.', fx: s => { s.tips = true; s.range = 175; } },
      { name: 'Crypto Gains', cost: 3600, desc: 'Double income, 10% interest (max $600).', fx: s => { s.income *= 2; s.interest = 0.1; s.interestMax = 600; } },
    ]],
  },
};

export const TOWER_KEYS = Object.keys(TOWERS);
export const TARGET_MODES = ['First', 'Last', 'Strong', 'Close'];

export function computeStats(key, lvl) {
  const D = TOWERS[key];
  const s = { ...D.base };
  // Apply in tier order across both paths so later tiers can build on earlier ones.
  for (let tier = 0; tier < 3; tier++)
    for (let p = 0; p < 2; p++)
      if (lvl[p] > tier) D.paths[p][tier].fx(s);
  return s;
}

export function canUpgrade(lvl, p) {
  const next = lvl[p] + 1;
  if (next > 3) return false;
  return !(next >= 2 && lvl[1 - p] >= 2);   // only one path may go beyond tier 1
}
