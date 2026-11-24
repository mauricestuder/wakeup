// Tower definitions. Each has a base stat block and two upgrade paths of three
// tiers. Upgrade rule: one path can reach tier 3, the other stops at tier 1.

export const TOWERS = {
  stamp: {
    name: 'Stamp Demon', cost: 200, r: 24, key: '1',
    desc: 'Throws DENIED stamps at sinners.',
    base: { range: 160, cd: 0.9, dmg: 1, pierce: 2, kind: 'sharp', speed: 720, count: 1, spread: 0, psize: 11 },
    paths: [[
      { name: 'Heavy Stamps', cost: 140, desc: 'Each stamp goes through 2 more sinners.', fx: s => { s.pierce += 2; } },
      { name: 'Double Stamp', cost: 240, desc: 'Throws 2 stamps at once.', fx: s => { s.count = 2; s.spread = 14; s.pierce += 1; } },
      { name: 'PERMANENTLY DENIED', cost: 1300, desc: 'Huge stamps: 3 damage, 12 pierce, even Complainers.', fx: s => { s.dmg = 3; s.pierce = 12; s.kind = 'magic'; s.psize = 19; s.range += 20; } },
    ], [
      { name: 'Coffee Break', cost: 110, desc: 'Stamps 33% faster.', fx: s => { s.cd *= 0.75; } },
      { name: 'Reading Glasses', cost: 260, desc: 'Sees Tax Evaders hiding in boxes. More range.', fx: s => { s.detect = true; s.range += 35; } },
      { name: 'Stamp Machine-Gun', cost: 1100, desc: 'STAMPSTAMPSTAMPSTAMP.', fx: s => { s.cd *= 0.26; s.speed = 900; } },
    ]],
  },
  fork: {
    name: 'Pitchfork Spinner', cost: 330, r: 26, key: '2',
    desc: 'Spins on an office chair, flinging pitchforks everywhere.',
    base: { range: 110, cd: 1.25, dmg: 1, pierce: 1, kind: 'sharp', speed: 520, count: 8, psize: 9 },
    paths: [[
      { name: 'More Forks', cost: 230, desc: '12 pitchforks per spin.', fx: s => { s.count = 12; } },
      { name: 'Flaming Forks', cost: 480, desc: 'Forks set sinners on fire. Burns Complainers too.', fx: s => { s.kind = 'fire'; s.burn = true; } },
      { name: 'Pitchfork Tornado', cost: 2500, desc: '20 burning forks, 4 pierce, spins like crazy.', fx: s => { s.count = 20; s.pierce = 4; s.cd *= 0.4; s.dmg = 2; } },
    ], [
      { name: 'Long Handles', cost: 130, desc: 'More range.', fx: s => { s.range += 28; } },
      { name: 'Faster Chair', cost: 320, desc: 'Spins 50% faster.', fx: s => { s.cd *= 0.66; } },
      { name: 'Ring of Fire', cost: 2700, desc: 'A ring of flames burns everything in range, all the time.', fx: s => { s.ring = true; s.ringCd = 0.16; s.kind = 'fire'; s.range += 12; } },
    ]],
  },
  lava: {
    name: 'Lava Geyser', cost: 560, r: 28, key: '3',
    desc: 'Erupts on sinners. Blast pops Complainers.',
    base: { range: 145, cd: 1.5, dmg: 1, pierce: 14, kind: 'blast', blast: 46, targets: 1, stun: 0 },
    paths: [[
      { name: 'Bigger Eruption', cost: 320, desc: 'Bigger blast, hits more sinners.', fx: s => { s.blast = 62; s.pierce = 24; } },
      { name: 'Molten Stun', cost: 520, desc: 'Sinners hit are stuck for a moment.', fx: s => { s.stun = 0.6; } },
      { name: 'Volcano', cost: 2900, desc: '4 damage, enormous blast. Shakes the office.', fx: s => { s.dmg = 4; s.blast = 95; s.pierce = 70; s.shake = true; } },
    ], [
      { name: 'Hot Spring', cost: 260, desc: 'Erupts 33% faster.', fx: s => { s.cd *= 0.75; } },
      { name: 'Triple Geyser', cost: 640, desc: 'Erupts on 3 sinners at once.', fx: s => { s.targets = 3; } },
      { name: 'Meteor Shower', cost: 3100, desc: 'Way faster, huge range, meteors everywhere.', fx: s => { s.cd *= 0.45; s.range += 70; s.targets = 5; } },
    ]],
  },
  phone: {
    name: 'Hold-Music Phone', cost: 300, r: 22, key: '4',
    desc: '"Your call is important to us." Slows sinners. Mimes can\'t hear it.',
    base: { range: 105, slow: 0.6 },
    paths: [[
      { name: 'Smooth Jazz', cost: 210, desc: 'Even slower.', fx: s => { s.slow = 0.45; } },
      { name: 'Please Hold', cost: 470, desc: 'Every few seconds everyone nearby freezes.', fx: s => { s.holdCd = 2.5; s.holdT = 0.9; } },
      { name: 'Elevator Music Hurts', cost: 1900, desc: 'The music damages everyone in range.', fx: s => { s.hurtCd = 0.45; s.slow = 0.35; } },
    ], [
      { name: 'Speakerphone', cost: 160, desc: 'More range.', fx: s => { s.range += 35; } },
      { name: '"Press 1 for..."', cost: 520, desc: 'Confuses sinners and sends them back down the line.', fx: s => { s.pushCd = 3; s.pushN = 6; s.push = 70; } },
      { name: 'Infinite Hold', cost: 2300, desc: 'Huge range, slows bosses fully, constant confusion.', fx: s => { s.range += 60; s.bossSlow = true; s.pushCd = 1.4; s.pushN = 16; s.slow = Math.min(s.slow, 0.45); } },
    ]],
  },
  auditor: {
    name: 'Tax Auditor', cost: 420, r: 24, key: '5',
    desc: 'Hits from anywhere on the map. Sees Tax Evaders.',
    base: { range: 9999, cd: 1.6, dmg: 2, kind: 'sharp', detect: true, multi: 1, cashPerHit: 0, bossMul: 1 },
    paths: [[
      { name: 'Bigger Fines', cost: 360, desc: '4 damage. Fines go through complaint forms.', fx: s => { s.dmg = 4; s.kind = 'magic'; } },
      { name: 'Seize Assets', cost: 1050, desc: '7 damage and +$2 every hit.', fx: s => { s.dmg = 7; s.cashPerHit = 2; } },
      { name: 'FULL AUDIT', cost: 4200, desc: '30 damage, triple damage to bosses.', fx: s => { s.dmg = 30; s.bossMul = 3; } },
    ], [
      { name: 'Faster Paperwork', cost: 310, desc: 'Shoots 40% faster.', fx: s => { s.cd *= 0.7; } },
      { name: 'Calculator Machine-Gun', cost: 1250, desc: 'Shoots almost 3x as fast.', fx: s => { s.cd *= 0.36; } },
      { name: 'Audit Everyone', cost: 3600, desc: 'Each shot hits the 4 strongest sinners.', fx: s => { s.multi = 4; s.cd *= 0.8; } },
    ]],
  },
  shop: {
    name: 'Soul Gift Shop', cost: 800, r: 30, key: '6',
    desc: 'Sells souvenirs. Pays out after every round.',
    base: { range: 0, income: 80, interest: 0, interestMax: 0, tips: false },
    paths: [[
      { name: 'Skull Mugs', cost: 520, desc: '+$60 per round.', fx: s => { s.income += 60; } },
      { name: '"I Went To Hell" T-Shirts', cost: 1350, desc: '+$140 per round.', fx: s => { s.income += 140; } },
      { name: 'Hell Franchise', cost: 4600, desc: '+$520 per round.', fx: s => { s.income += 520; } },
    ], [
      { name: 'Savings Account', cost: 420, desc: '+5% of your cash every round (max $150).', fx: s => { s.interest = 0.05; s.interestMax = 150; } },
      { name: 'Tip Jar', cost: 950, desc: 'Every sinner popped nearby gives +$1 extra.', fx: s => { s.tips = true; s.range = 175; } },
      { name: 'Offshore Account', cost: 3600, desc: 'Double income, 10% interest (max $600).', fx: s => { s.income *= 2; s.interest = 0.1; s.interestMax = 600; } },
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
