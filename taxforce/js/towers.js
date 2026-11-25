// Tax office tower definitions. Every official has three upgrade paths of five tiers.
// `cat` puts him in the NEAR / MID / FAR shop tab.
// Upgrade rule (like the big tower-defense games): at most two paths can have
// upgrades, and only one of them can go past tier 2.

const u = (name, cost, desc, fx) => ({ name, cost, desc, fx });

export const TOWERS = {
  dumbbell: {
    name: 'Stamp Clerk', cost: 200, r: 24, cat: 'mid',
    desc: 'Throws DENIED stamps. Cheap, reliable, has never approved anything.',
    base: { range: 160, cd: 0.9, dmg: 1, pierce: 2, kind: 'sharp', speed: 720, count: 1, psize: 11 },
    paths: [[
      u('Heavier Stamps', 140, 'Each stamp goes through 2 more robbers.', s => { s.pierce += 2; }),
      u('Double Stamp', 240, 'Throws 2 stamps at once.', s => { s.count = 2; s.pierce += 1; }),
      u('Rubber Stamp Wheel', 1300, 'Throws a giant stamp wheel: 3 damage, 12 pierce, gets past briefcases.', s => { s.dmg = 3; s.pierce = 12; s.kind = 'magic'; s.psize = 19; s.range += 20; }),
      u('Official Seal', 4200, '6 damage, 20 pierce, triple damage to bosses.', s => { s.dmg = 6; s.pierce = 20; s.bossMul = 3; }),
      u('PERMANENTLY DENIED', 22000, '15 damage, 40 pierce, x5 vs bosses, and every hit stuns.', s => { s.dmg = 15; s.pierce = 40; s.bossMul = 5; s.stunHit = 0.3; }),
    ], [
      u('Coffee Break Over', 110, 'Throws 33% faster.', s => { s.cd *= 0.75; }),
      u('Reading Glasses', 260, 'Spots disguised robbers. More range.', s => { s.detect = true; s.range += 35; }),
      u('Stamp Machine-Gun', 1100, 'DENIED DENIED DENIED DENIED.', s => { s.cd *= 0.26; s.speed = 900; }),
      u('Mass Rejection', 3800, 'Throws 2 extra stamps every time, even faster.', s => { s.count += 2; s.cd *= 0.75; }),
      u('Stamp Tornado', 19000, 'Never stops. Way faster and +2 damage.', s => { s.cd *= 0.45; s.dmg += 2; }),
    ], [
      u('Ergonomic Chair', 120, 'More range and faster throws.', s => { s.range += 20; s.speed *= 1.25; }),
      u('Hot Ink', 380, 'Stamps set robbers on fire.', s => { s.burn = true; }),
      u('Deadline Panic', 1600, 'Every 10 s he panics and throws 3x as fast for 4 s.', s => { s.rage = { every: 10, dur: 4, mul: 0.33 }; }),
      u('Burnout', 5200, 'Burns hit 3x harder, +1 damage, double damage to bosses.', s => { s.burnDmg = 3; s.dmg += 1; s.bossMul = Math.max(s.bossMul || 1, 2); }),
      u('Employee of the Century', 24000, 'Permanent panic. +3 damage. Gets past briefcases.', s => { s.rage = { every: 1, dur: 1, mul: 0.3 }; s.dmg += 3; s.kind = 'magic'; }),
    ]],
  },
  spinner: {
    name: 'Paper Shredder Guy', cost: 330, r: 26, cat: 'near',
    desc: 'Shreds tax forms and sprays the paper bits in every direction.',
    base: { range: 110, cd: 1.25, dmg: 1, pierce: 1, kind: 'sharp', speed: 520, count: 8, psize: 9 },
    paths: [[
      u('More Paper', 230, '12 paper bits per shred.', s => { s.count = 12; }),
      u('Overheating Shredder', 480, 'Paper bits are on fire. Burns lawyers too.', s => { s.kind = 'fire'; s.burn = true; }),
      u('Paper Tornado', 2500, '20 burning paper bits, 4 pierce, shreds like crazy.', s => { s.count = 20; s.pierce = 4; s.cd *= 0.4; s.dmg = 2; }),
      u('Paper Hurricane', 5000, '28 bits, 6 pierce, 3 damage, more range.', s => { s.count = 28; s.pierce = 6; s.dmg = 3; s.range += 15; }),
      u('Black Hole Shredder', 26000, '6 damage and it sucks robbers backwards every 2 s.', s => { s.dmg = 6; s.bossMul = 2; s.pull = { cd: 2, n: 20, d: 80 }; }),
    ], [
      u('Longer Cable', 130, 'More range.', s => { s.range += 28; }),
      u('Turbo Blades', 320, 'Shreds 50% faster.', s => { s.cd *= 0.66; }),
      u('Ring of Fire', 2700, 'The shredder catches fire: a ring of flames burns everything in range.', s => { s.ring = true; s.ringCd = 0.16; s.kind = 'fire'; s.range += 12; }),
      u('Bonfire of Receipts', 4500, 'The ring hits for 2 and reaches further.', s => { s.dmg += 1; s.range += 20; }),
      u('Paperwork Inferno', 24000, '6 damage, burns twice as often.', s => { s.dmg += 4; s.ringCd = 0.1; s.range += 30; }),
    ], [
      u('Sharper Blades', 150, 'Paper bits fly faster and a bit further.', s => { s.range += 10; s.speed *= 1.3; }),
      u('Cardboard Mode', 450, 'Bits hit for 2 and get past briefcases.', s => { s.dmg += 1; if (s.kind === 'sharp') s.kind = 'magic'; }),
      u('Shredder Slam', 1800, 'Every 4 s he slams the whole shredder on the strongest robber (20 damage).', s => { s.smash = { cd: 4, dmg: 20, bossMul: 1, blast: 0 }; }),
      u('Industrial Shredder', 5500, 'Slams every 2.2 s for 35.', s => { s.smash = { cd: 2.2, dmg: 35, bossMul: 1, blast: 0 }; }),
      u('Shredder Meteor', 23000, 'Meteor slam: 150 damage, x3 vs bosses, hits everyone nearby.', s => { s.smash = { cd: 2, dmg: 150, bossMul: 3, blast: 70 }; }),
    ]],
  },
  shake: {
    name: 'Coffee Intern', cost: 560, r: 28, cat: 'mid',
    desc: 'Lobs hot coffee cups that splash an area. Gets past briefcases.',
    base: { range: 145, cd: 1.5, dmg: 1, pierce: 14, kind: 'blast', blast: 46, targets: 1, stun: 0 },
    paths: [[
      u('Large Latte', 320, 'Bigger splash, hits more robbers.', s => { s.blast = 62; s.pierce = 24; }),
      u('Office Coffee', 520, 'It tastes so bad robbers stop to gag.', s => { s.stun = 0.6; }),
      u('Espresso Bomb', 2900, '4 damage, enormous blast. Shakes the street.', s => { s.dmg = 4; s.blast = 95; s.pierce = 70; s.shake = true; }),
      u('Triple Shot', 6000, '8 damage, triple damage to bosses.', s => { s.dmg = 8; s.bossMul = 3; }),
      u('Caffeine Apocalypse', 30000, '20 damage in a giant blast that hits 150 robbers.', s => { s.dmg = 20; s.blast = 130; s.pierce = 150; }),
    ], [
      u('Unpaid Overtime', 260, 'Throws 33% faster.', s => { s.cd *= 0.75; }),
      u('Coffee Run', 640, 'Throws at 3 robbers at once.', s => { s.targets = 3; }),
      u('Coffee Barrage', 3100, 'Way faster, huge range, coffee raining everywhere.', s => { s.cd *= 0.45; s.range += 70; s.targets = 5; }),
      u('Coffee Machine', 5200, 'Faster again, 7 targets.', s => { s.cd *= 0.6; s.targets = 7; }),
      u('Coffee Rain', 26000, 'Hits anywhere on the map, 10 targets, twice as fast.', s => { s.cd *= 0.5; s.range = 9999; s.targets = 10; }),
    ], [
      u('Sticky Syrup', 180, 'Robbers hit are slowed for 1.5 s.', s => { s.slowHit = 0.5; s.slowHitT = 1.5; }),
      u('Extra Hot', 420, 'Coffee burns robbers.', s => { s.burn = true; }),
      u('Spilled Coffee', 1500, 'Leaves a hot puddle on the road that hurts robbers.', s => { s.puddle = { life: 3, dmg: 1, tick: 0.5, r: 34, slow: 1 }; }),
      u('Break Room Sludge', 4800, 'Bigger, longer puddles: 3 damage and they slow.', s => { s.puddle = { life: 6, dmg: 3, tick: 0.5, r: 44, slow: 0.5 }; }),
      u('Coffee Flood', 22000, 'Huge puddles that deal 8 damage. +2 coffee damage.', s => { s.puddle = { life: 8, dmg: 8, tick: 0.4, r: 56, slow: 0.4 }; s.dmg += 2; }),
    ]],
  },
  dj: {
    name: 'Hold-Music Clerk', cost: 300, r: 22, cat: 'near',
    desc: '"Your call is important to us." Robbers nearby slow down to wait. Hackers can\'t hear it.',
    base: { range: 105, slow: 0.6 },
    paths: [[
      u('Smooth Jazz', 210, 'Even slower.', s => { s.slow = 0.45; }),
      u('Please Hold', 470, 'Every few seconds everyone nearby freezes and waits.', s => { s.holdCd = 2.5; s.holdT = 0.9; }),
      u('Elevator Music', 1900, 'So bad it hurts everyone in range.', s => { s.hurtCd = 0.45; s.hurtDmg = 1; s.slow = 0.35; }),
      u('Panflute Cover', 4500, 'The music hits for 3, more often.', s => { s.hurtDmg = 3; s.hurtCd = 0.35; }),
      u('Infinite Hold', 22000, 'The music hits for 10 and everyone waits every 1.5 s.', s => { s.hurtDmg = 10; s.holdCd = 1.5; s.holdT = 1; s.range += 20; }),
    ], [
      u('Speakerphone', 160, 'More range.', s => { s.range += 35; }),
      u('Press 1...', 520, 'Wrong department! Sends robbers back down the street.', s => { s.pushCd = 3; s.pushN = 6; s.push = 70; }),
      u('Call Center', 2300, 'Huge range, slows bosses fully, constant confusion.', s => { s.range += 60; s.bossSlow = true; s.pushCd = 1.4; s.pushN = 16; s.slow = Math.min(s.slow, 0.45); }),
      u('Transferred Again', 5000, 'Even bigger, sends 30 robbers way back.', s => { s.range += 60; s.pushN = 30; s.push = 120; }),
      u('Hold Forever', 24000, 'So loud even Hackers hear it. Pushes bosses too.', s => { s.hearAll = true; s.pushBoss = 40; s.pushCd = 1; }),
    ], [
      u('Motivational Playlist', 250, 'Nearby officials attack 10% faster.', s => { s.buff = { cd: 0.9, dmg: 0, rng: 0, detect: false }; }),
      u('Office Radio', 600, 'Nearby officials attack 18% faster with more range.', s => { s.buff = { cd: 0.82, dmg: 0, rng: 10, detect: false }; }),
      u('Tax Anthem', 2000, 'Nearby officials attack 25% faster and spot disguised robbers.', s => { s.buff = { cd: 0.75, dmg: 0, rng: 10, detect: true }; }),
      u('Office Party', 6000, 'Nearby officials attack 32% faster and hit +1 harder.', s => { s.buff = { cd: 0.68, dmg: 1, rng: 15, detect: true }; }),
      u('Christmas Party', 25000, 'The whole office goes wild: +45% speed, +2 damage, huge area.', s => { s.buff = { cd: 0.55, dmg: 2, rng: 30, detect: true }; s.range *= 1.6; }),
    ]],
  },
  chad: {
    name: 'Tax Auditor', cost: 420, r: 24, cat: 'far',
    desc: 'Throws heavy files anywhere on the map. Spots disguised robbers.',
    base: { range: 9999, cd: 1.6, dmg: 2, pierce: 1, kind: 'sharp', detect: true, multi: 1, cashPerHit: 0, bossMul: 1 },
    paths: [[
      u('Thick Files', 360, '4 damage. Gets past briefcases.', s => { s.dmg = 4; s.kind = 'magic'; }),
      u('Late Fees', 1050, '7 damage and +$2 every hit.', s => { s.dmg = 7; s.cashPerHit += 2; }),
      u('FULL AUDIT', 4200, '30 damage, triple damage to bosses.', s => { s.dmg = 30; s.bossMul = 3; }),
      u('Senior Auditor', 9000, '70 damage, x4 vs bosses.', s => { s.dmg = 70; s.bossMul = 4; }),
      u('The Final Audit', 35000, '200 damage, x5 vs bosses, files go through 3 robbers.', s => { s.dmg = 200; s.bossMul = 5; s.pierce = 3; }),
    ], [
      u('Fast Fingers', 310, 'Throws 40% faster.', s => { s.cd *= 0.7; }),
      u('Calculator Machine-Gun', 1250, 'Throws almost 3x as fast.', s => { s.cd *= 0.36; }),
      u('Audit Everyone', 3600, 'Each throw hits the 4 strongest robbers.', s => { s.multi = 4; s.cd *= 0.8; }),
      u('Audit Department', 6000, '6 files per throw, even faster.', s => { s.multi = 6; s.cd *= 0.7; }),
      u('Ministry of Finance', 28000, '10 files, twice as fast, double damage.', s => { s.multi = 10; s.cd *= 0.5; s.dmg *= 2; }),
    ], [
      u('Stern Look', 200, 'Robbers hit get scared: slowed for 1 s.', s => { s.slowHit = 0.6; s.slowHitT = 1; }),
      u('Exploding Folders', 500, 'Files explode and hit 5 robbers nearby.', s => { s.blastHit = 34; }),
      u('Sharp Paper Cuts', 1800, 'Files go through 4 robbers.', s => { s.pierce = Math.max(s.pierce, 4); }),
      u('Back Taxes', 5000, '+$4 every hit and +$200 every wave.', s => { s.cashPerHit += 4; s.income = (s.income || 0) + 200; }),
      u('YOU ARE BEING AUDITED', 24000, 'Every 8 s every robber on the map freezes in fear.', s => { s.rizz = { cd: 8, t: 1.5 }; }),
    ]],
  },
  store: {
    name: 'Tax Collector', cost: 800, r: 30, cat: 'mid',
    desc: 'Collects taxes from the whole town. Pays out after every wave.',
    base: { range: 0, income: 80, interest: 0, interestMax: 0, tips: 0 },
    paths: [[
      u('Dog Tax', 520, '+$60 per wave.', s => { s.income += 60; }),
      u('Parking Fines', 1350, '+$140 per wave.', s => { s.income += 140; }),
      u('Tax Hike', 4600, '+$520 per wave.', s => { s.income += 520; }),
      u('Tax on Air', 12000, '+$1,500 per wave.', s => { s.income += 1500; }),
      u('Tax on Taxes', 40000, '+$4,000 per wave.', s => { s.income += 4000; }),
    ], [
      u('Savings Account', 420, '+5% of your cash every wave (max $150).', s => { s.interest = 0.05; s.interestMax = 150; }),
      u('Toll Booth', 950, 'Every robber taken down nearby gives +$1 extra.', s => { s.tips = 1; s.range = Math.max(s.range, 175); }),
      u('Crypto Tax', 3600, 'Double income, 10% interest (max $600).', s => { s.income *= 2; s.interest = 0.1; s.interestMax = 600; }),
      u('Hedge Fund', 10000, '15% interest (max $2,500).', s => { s.interest = 0.15; s.interestMax = 2500; }),
      u('Central Bank', 35000, '20% interest (max $6,000). Tips pay double.', s => { s.interest = 0.2; s.interestMax = 6000; s.tips = 2; }),
    ], [
      u('Free Donuts', 300, 'Nearby officials attack 8% faster.', s => { s.range = Math.max(s.range, 150); s.buff = { cd: 0.92, dmg: 0, rng: 0, detect: false }; }),
      u('Energy Drinks', 750, 'Nearby officials attack 15% faster.', s => { s.buff = { cd: 0.85, dmg: 0, rng: 0, detect: false }; }),
      u('Bonus Payments', 2400, 'Nearby officials also hit +1 harder.', s => { s.buff = { cd: 0.85, dmg: 1, rng: 0, detect: false }; }),
      u('Pension Plan', 6500, 'Something to live for. +28% speed, +2 damage.', s => { s.buff = { cd: 0.72, dmg: 2, rng: 0, detect: false }; }),
      u('Golden Handshake', 25000, '+42% speed, +4 damage, +40 range for every official nearby.', s => { s.buff = { cd: 0.58, dmg: 4, rng: 40, detect: false }; s.range = Math.max(s.range, 220); }),
    ]],
  },
  influencer: {
    name: 'Speed Camera Officer', cost: 450, r: 24, cat: 'mid',
    desc: 'SNAP! The radar flash blinds every robber nearby for a moment.',
    base: { range: 120, cd: 3, flashT: 0.5, flashDmg: 0, income: 0, cashPerStun: 0, expose: 0, exposeMul: 1, reveal: false },
    paths: [[
      u('Brighter Flash', 250, 'Bigger flash.', s => { s.range += 30; }),
      u('Burst Mode', 500, 'Flashes every 2 s.', s => { s.cd = 2; }),
      u('Blinding Flash', 1800, 'Blinds longer and the flash deals 1 damage.', s => { s.flashT = 0.9; s.flashDmg = 1; }),
      u('Radar Trap', 5500, 'Blinds for 1.3 s, 3 damage.', s => { s.flashT = 1.3; s.flashDmg = 3; }),
      u('Stadium Lights', 24000, 'Flashes every second for 8 damage.', s => { s.cd = 1; s.flashDmg = 8; }),
    ], [
      u('Zoom Lens', 200, 'More range.', s => { s.range += 25; }),
      u('Face Recognition', 550, 'Pulls the fake mustache off disguised robbers in range. Everyone can see them now.', s => { s.reveal = true; }),
      u('Wanted Poster', 2000, 'Flashed robbers take +1 damage from every hit.', s => { s.expose = 1; }),
      u('Most Wanted', 5000, 'Flashed robbers take +2 damage. Works on bosses.', s => { s.expose = 2; s.exposeBoss = true; }),
      u('Public Enemy No. 1', 23000, 'Flashed robbers take DOUBLE damage. Bigger range.', s => { s.exposeMul = 2; s.range += 40; }),
    ], [
      u('Speeding Tickets', 250, '+$40 per wave.', s => { s.income += 40; }),
      u('Instant Fines', 700, '+$1 for every robber he flashes.', s => { s.cashPerStun = 1; }),
      u('Ticket Quota', 2200, '+$200 per wave.', s => { s.income += 160; }),
      u('Camera Network', 6500, '+$600 per wave, +$2 per flashed robber.', s => { s.income += 400; s.cashPerStun = 2; }),
      u('Surveillance State', 30000, '+$2,000 per wave, +$4 per flashed robber.', s => { s.income += 1400; s.cashPerStun = 4; }),
    ]],
  },
  legs: {
    name: 'Desk Slammer', cost: 500, r: 26, cat: 'near',
    desc: 'Slams a huge stack of files on his desk. The shockwave hits everyone around him.',
    base: { range: 85, cd: 1.4, dmg: 1, pierce: 25, kind: 'blast', stun: 0 },
    paths: [[
      u('Thicker Files', 300, 'Stomps hit for 2.', s => { s.dmg = 2; }),
      u('Phone Book', 600, 'Bigger shockwave, hits 40 robbers.', s => { s.range += 20; s.pierce = 40; }),
      u('Tax Code Volume 1-12', 2200, '4 damage and robbers are stunned.', s => { s.dmg = 4; s.stun = 0.4; s.shake = true; }),
      u('Filing Cabinet Drop', 6000, '8 damage, huge range, double damage to bosses.', s => { s.dmg = 8; s.range += 30; s.bossMul = 2; }),
      u('The Whole Archive', 28000, '20 damage, x3 vs bosses, long stun.', s => { s.dmg = 20; s.range += 40; s.bossMul = 3; s.stun = 0.8; }),
    ], [
      u('Angry Typing', 250, 'Slams 30% faster.', s => { s.cd *= 0.7; }),
      u('Monday Mood', 550, 'Faster and a bit more range.', s => { s.cd *= 0.75; s.range += 10; }),
      u('Table Flip', 2000, 'Twice as fast.', s => { s.cd *= 0.5; }),
      u('Rage Quit', 5000, 'Even faster, +1 damage.', s => { s.cd *= 0.6; s.dmg += 1; }),
      u('Never Took A Vacation', 24000, 'Constant earthquakes. +3 damage.', s => { s.cd *= 0.4; s.dmg += 3; }),
    ], [
      u('Sticky Notes', 200, 'Slams slow robbers for 1 s.', s => { s.slowHit = 0.6; s.slowHitT = 1; }),
      u('Paper Wind', 500, 'Slams blow robbers back.', s => { s.knock = 30; }),
      u('Paper Storm', 1800, 'Bigger knockback and a stronger slow.', s => { s.knock = 60; s.slowHit = 0.4; }),
      u('Sonic Slam', 5000, 'Huge knockback. Even bosses get pushed.', s => { s.knock = 100; s.knockBoss = 20; }),
      u('Lockdown', 22000, 'Every slam locks robbers in place for 1.5 s.', s => { s.stun = 1.5; s.knock = 120; }),
    ]],
  },
  treadmill: {
    name: 'Red Tape Officer', cost: 400, r: 24, cat: 'mid',
    desc: 'Puts red tape (robbers get stuck) and traffic cones (ouch) on the road.',
    base: { range: 120, cd: 2.2, kbPierce: 4, kbDmg: 1, kbKind: 'sharp', kbBlast: 0, kbLife: 10, tmSlow: 0.5, tmLife: 6, tmDmg: 0, tmBoss: false,
            maxTraps: 10, perDrop: 1, lifeMul: 1, trapMul: 1, smart: false },
    paths: [[
      u('More Cones', 220, 'Cones trip 6 robbers and get placed faster.', s => { s.kbPierce = 6; s.cd *= 0.85; }),
      u('Spiky Cones', 450, 'Cones hit for 2.', s => { s.kbDmg = 2; }),
      u('Exploding Cones', 1800, 'Cones explode. Gets past briefcases.', s => { s.kbBlast = 40; s.kbPierce = 15; s.kbKind = 'blast'; }),
      u('Concrete Cones', 5500, 'Cones hit for 5 and trip 25 robbers.', s => { s.kbDmg = 5; s.kbPierce = 25; }),
      u('Cone Rain', 25000, 'Drops 3 at a time, 12 damage each.', s => { s.kbDmg = 12; s.perDrop += 2; }),
    ], [
      u('Stickier Tape', 200, 'Red tape slows robbers more.', s => { s.tmSlow = 0.35; }),
      u('Form 27-B', 480, 'Red tape lasts longer. More range.', s => { s.tmLife = 10; s.range += 20; }),
      u('Wrong Form', 1900, 'Robbers on the tape have to go BACK and start again.', s => { s.tmSlow = -0.35; }),
      u('Bureaucracy', 5000, 'Robbers fly backwards. Bosses get slowed too.', s => { s.tmSlow = -0.8; s.tmBoss = true; }),
      u('Endless Paperwork', 23000, 'Tape lasts 20 s, hurts robbers, and sends them way back.', s => { s.tmSlow = -1; s.tmLife = 20; s.tmDmg = 1; }),
    ], [
      u('Laminated', 150, 'Everything he drops lasts 50% longer.', s => { s.lifeMul = 1.5; }),
      u('Roadblock', 400, 'Places right in front of the leading robber.', s => { s.smart = true; }),
      u('Two Clipboards', 1600, 'Drops 2 at a time.', s => { s.perDrop += 1; }),
      u('Warehouse of Cones', 4500, 'Up to 30 items on the road, drops way faster.', s => { s.maxTraps = 30; s.cd *= 0.6; }),
      u('Department of Red Tape', 21000, 'Everything hits twice as hard and lasts 3x longer.', s => { s.trapMul = 2; s.lifeMul = 3; s.tmDmg = Math.max(s.tmDmg, 1); }),
    ]],
  },
  kicker: {
    name: 'Karate Accountant', cost: 260, r: 22, cat: 'near',
    desc: 'Black belt in accounting. Kicks the closest robber back down the street.',
    base: { range: 72, cd: 0.85, dmg: 2, kind: 'magic', knock: 55, knockBoss: 0, targets: 1, stun: 0, bossMul: 1, cashPerHit: 0 },
    paths: [[
      u('Steel-Toe Shoes', 180, 'Kicks hit for 4.', s => { s.dmg = 4; }),
      u('Roundhouse', 450, 'Spin kick: hits 3 robbers at once.', s => { s.targets = 3; }),
      u('Black Belt', 1900, '10 damage, double damage to bosses.', s => { s.dmg = 10; s.bossMul = 2; }),
      u('Tax Ninja', 5500, '25 damage, x3 vs bosses, hits 4.', s => { s.dmg = 25; s.bossMul = 3; s.targets = 4; }),
      u('Kick of the Century', 25000, '80 damage, x4 vs bosses, and they see stars.', s => { s.dmg = 80; s.bossMul = 4; s.stun = 0.5; }),
    ], [
      u('Stretching', 150, 'Kicks 25% faster.', s => { s.cd *= 0.75; }),
      u('Double Kick', 400, 'Kicks 40% faster.', s => { s.cd *= 0.6; }),
      u('Flurry Kicks', 1600, 'Twice as fast.', s => { s.cd *= 0.5; }),
      u('Thousand Kicks', 4800, 'Twice as fast again, more range.', s => { s.cd *= 0.5; s.range += 12; }),
      u('Kick Storm', 21000, 'Legs become a blur. Faster, +4 damage.', s => { s.cd *= 0.55; s.dmg += 4; }),
    ], [
      u('Long Legs', 140, 'More range.', s => { s.range += 22; }),
      u('Field Goal', 420, 'Kicks robbers way further back.', s => { s.knock = 120; }),
      u('Back To The Start', 1800, 'Huge knockback. Even bosses move.', s => { s.knock = 220; s.knockBoss = 30; }),
      u('Penalty Fee', 4500, '+$3 every kick. Kicking robbers is now a business.', s => { s.cashPerHit = 3; }),
      u('Kick Into Orbit', 22000, 'Robbers fly back 400 and lie there dizzy.', s => { s.knock = 400; s.knockBoss = 60; s.stun = Math.max(s.stun, 1); }),
    ]],
  },
  collector: {
    name: 'Debt Collector', cost: 650, r: 26, cat: 'near',
    desc: 'Grabs the strongest robber nearby and shakes the money out of him. Great vs bosses.',
    base: { range: 85, cd: 3, dmg: 15, kind: 'magic', bossMul: 1, stun: 0.5, targets: 1, cashPerHit: 0, income: 0, detect: false },
    paths: [[
      u('Bigger Hands', 350, 'Grabs hit for 30.', s => { s.dmg = 30; }),
      u('Final Notice', 900, '60 damage, double damage to bosses.', s => { s.dmg = 60; s.bossMul = 2; }),
      u('Repo Man', 3500, '150 damage, x3 vs bosses.', s => { s.dmg = 150; s.bossMul = 3; }),
      u('Collection Agency', 9000, '400 damage.', s => { s.dmg = 400; }),
      u('The Debt Reaper', 32000, '1,200 damage, x4 vs bosses. Nobody escapes.', s => { s.dmg = 1200; s.bossMul = 4; }),
    ], [
      u('Phone Calls', 250, 'Grabs 25% faster.', s => { s.cd *= 0.75; }),
      u('Overtime', 700, 'Grabs 40% faster.', s => { s.cd *= 0.6; }),
      u('Speed Dial', 2400, 'Faster and more range.', s => { s.cd *= 0.6; s.range += 15; }),
      u('Two Hands', 6000, 'Grabs 2 robbers at once.', s => { s.targets = 2; }),
      u('Tireless', 24000, 'Twice as fast, grabs 3.', s => { s.cd *= 0.5; s.targets = 3; }),
    ], [
      u('Late Fees', 220, '+$5 every grab.', s => { s.cashPerHit = 5; }),
      u('Interest Rates', 650, '+$15 every grab.', s => { s.cashPerHit = 15; }),
      u('Seize Assets', 2000, 'Spots disguised robbers. +$30 every grab.', s => { s.detect = true; s.cashPerHit = 30; }),
      u('Garnished Wages', 6000, '+$300 per wave.', s => { s.income += 300; }),
      u('Owns Everything', 28000, '+$100 every grab, +$1,000 per wave.', s => { s.cashPerHit = 100; s.income += 700; }),
    ]],
  },
  cannon: {
    name: 'Coin-Ball Cannon', cost: 700, r: 28, cat: 'far',
    desc: 'Fires heavy steel coin-balls across half the map. Slow, but the blast is huge.',
    base: { range: 380, cd: 2.6, dmg: 2, pierce: 20, kind: 'blast', blast: 58, targets: 1, stun: 0, bossMul: 1, flight: 0.85 },
    paths: [[
      u('Heavier Balls', 400, '4 damage.', s => { s.dmg = 4; }),
      u('Gold Bars', 1100, '8 damage, double damage to bosses.', s => { s.dmg = 8; s.bossMul = 2; }),
      u('Wrecking Ball', 3600, '20 damage, bigger blast, robbers get dizzy.', s => { s.dmg = 20; s.blast = 80; s.stun = 0.4; }),
      u('Bank Vault Drop', 9000, '50 damage, x3 vs bosses, hits 60.', s => { s.dmg = 50; s.bossMul = 3; s.pierce = 60; }),
      u('Fort Knox', 34000, '140 damage in a giant blast that hits 120.', s => { s.dmg = 140; s.blast = 120; s.pierce = 120; s.shake = true; }),
    ], [
      u('Long Barrel', 300, 'Even more range.', s => { s.range += 120; }),
      u('Rapid Reload', 900, 'Fires 40% faster.', s => { s.cd *= 0.6; }),
      u('Twin Cannon', 3000, 'Fires at 2 robbers at once.', s => { s.targets = 2; }),
      u('Coin Gatling', 7500, 'Way faster, 3 targets.', s => { s.cd *= 0.45; s.targets = 3; }),
      u('Money Printer Go Brrr', 30000, 'Hits anywhere, 5 targets, even faster.', s => { s.cd *= 0.5; s.targets = 5; s.range = 9999; }),
    ], [
      u('Bouncy Coins', 250, 'Bigger blast.', s => { s.blast += 20; }),
      u('Glue Coins', 600, 'Robbers hit are slowed for 2 s.', s => { s.slowHit = 0.5; s.slowHitT = 2; }),
      u('Hot Coins', 1800, 'Coins set robbers on fire.', s => { s.burn = true; }),
      u('Shrapnel Pennies', 5000, '+2 damage, hits 30 more.', s => { s.dmg += 2; s.pierce += 30; }),
      u('Coin Storm', 24000, 'Leaves a pile of hot coins on the road (5 damage).', s => { s.puddle = { life: 5, dmg: 5, tick: 0.4, r: 52, slow: 0.6, coins: true }; }),
    ]],
  },
  drone: {
    name: 'Tax Drone', cost: 550, r: 22, cat: 'far',
    desc: 'Flies laps around its spot and drops tax letters on robbers. Spots disguises.',
    base: { range: 120, orbit: 150, cd: 1.1, dmg: 1, pierce: 3, kind: 'sharp', detect: true, drones: 1, blastHit: 0, burn: false, bossMul: 1, reveal: false },
    paths: [[
      u('Bigger Envelopes', 220, 'Letters go through 3 more robbers.', s => { s.pierce += 3; }),
      u('Registered Mail', 600, '2 damage.', s => { s.dmg = 2; }),
      u('Express Delivery', 2000, '4 damage. Gets past briefcases.', s => { s.dmg = 4; s.kind = 'magic'; }),
      u('Audit Letters', 6000, '10 damage, double damage to bosses.', s => { s.dmg = 10; s.bossMul = 2; }),
      u('Final Reminder', 26000, '30 damage, x3 vs bosses.', s => { s.dmg = 30; s.bossMul = 3; }),
    ], [
      u('Better Battery', 200, 'Flies a bigger lap.', s => { s.orbit += 60; s.range += 20; }),
      u('Twin Rotors', 550, 'Drops 30% faster.', s => { s.cd *= 0.7; }),
      u('Machine Mail', 2200, 'Drops letters 2.5x as fast.', s => { s.cd *= 0.4; }),
      u('Spam Folder', 5500, 'Drops 3 letters at a time.', s => { s.count = 3; }),
      u('Drone Swarm', 26000, '3 drones fly the lap together.', s => { s.drones = 3; }),
    ], [
      u('Camera Zoom', 180, 'Sees further.', s => { s.range += 30; }),
      u('Night Vision', 500, 'Pulls disguises off robbers it flies over.', s => { s.reveal = true; }),
      u('Tax Bombs', 2000, 'Letters explode and hit robbers nearby.', s => { s.blastHit = 40; }),
      u('Carpet Bombing', 6000, 'Bigger explosions, +2 damage.', s => { s.blastHit = 60; s.dmg += 2; }),
      u('Air Superiority', 24000, 'Twice as fast, +5 damage, burning letters.', s => { s.cd *= 0.5; s.dmg += 5; s.burn = true; }),
    ]],
  },
};

export const CATEGORIES = [['near', 'NEAR'], ['mid', 'MID'], ['far', 'FAR']];

export const TOWER_KEYS = Object.keys(TOWERS);
export const TARGET_MODES = ['First', 'Last', 'Strong', 'Close'];
export const PATHS = 3, TIERS = 5;

export function computeStats(key, lvl) {
  const D = TOWERS[key];
  const s = structuredClone(D.base);
  for (let tier = 0; tier < TIERS; tier++)
    for (let p = 0; p < PATHS; p++)
      if (lvl[p] > tier) D.paths[p][tier].fx(s);
  return s;
}

// Why a path can't be upgraded right now, or null if it can.
export function upgradeBlock(lvl, p) {
  const next = lvl[p] + 1;
  if (next > TIERS) return 'MAXED';
  const others = lvl.filter((v, i) => i !== p);
  if (lvl[p] === 0 && others.filter(v => v > 0).length >= 2) return '2 PATHS MAX';
  if (next >= 3 && others.some(v => v >= 3)) return 'ONLY ONE PATH PAST TIER 2';
  return null;
}
export const canUpgrade = (lvl, p) => !upgradeBlock(lvl, p);
