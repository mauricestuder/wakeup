// Gym bro tower definitions. Every bro has three upgrade paths of five tiers.
// Upgrade rule (like the big tower-defense games): at most two paths can have
// upgrades, and only one of them can go past tier 2.

const u = (name, cost, desc, fx) => ({ name, cost, desc, fx });

export const TOWERS = {
  dumbbell: {
    name: 'Dumbbell Bro', cost: 200, r: 24,
    desc: 'Throws dumbbells. Cheap, reliable, never skips arm day.',
    base: { range: 160, cd: 0.9, dmg: 1, pierce: 2, kind: 'sharp', speed: 720, count: 1, psize: 11 },
    paths: [[
      u('Heavier Plates', 140, 'Each dumbbell smashes through 2 more rats.', s => { s.pierce += 2; }),
      u('Double Curl', 240, 'Throws 2 dumbbells at once.', s => { s.count = 2; s.pierce += 1; }),
      u('Barbell Toss', 1300, 'Throws a whole barbell: 3 damage, 12 pierce, breaks frying pans.', s => { s.dmg = 3; s.pierce = 12; s.kind = 'magic'; s.psize = 19; s.range += 20; }),
      u('Olympic Barbell', 4200, '6 damage, 20 pierce, triple damage to bosses.', s => { s.dmg = 6; s.pierce = 20; s.bossMul = 3; }),
      u('The Bar Bends', 22000, '15 damage, 40 pierce, x5 vs bosses, and every hit stuns.', s => { s.dmg = 15; s.pierce = 40; s.bossMul = 5; s.stunHit = 0.3; }),
    ], [
      u('Pre-Workout', 110, 'Throws 33% faster.', s => { s.cd *= 0.75; }),
      u('Focus Headband', 260, 'Spots rats hiding in protein tubs. More range.', s => { s.detect = true; s.range += 35; }),
      u('NO DAYS OFF', 1100, 'Dumbbell machine-gun. REP REP REP REP.', s => { s.cd *= 0.26; s.speed = 900; }),
      u('Drop Sets', 3800, 'Throws 2 extra dumbbells every rep, even faster.', s => { s.count += 2; s.cd *= 0.75; }),
      u('Infinite Reps', 19000, 'Never stops. Way faster and +2 damage.', s => { s.cd *= 0.45; s.dmg += 2; }),
    ], [
      u('Chalk Hands', 120, 'Better grip: more range and faster throws.', s => { s.range += 20; s.speed *= 1.25; }),
      u('Burning Iron', 380, 'Dumbbells set rats on fire.', s => { s.burn = true; }),
      u('Rage Mode', 1600, 'Every 10 s he goes berserk and throws 3x as fast for 4 s.', s => { s.rage = { every: 10, dur: 4, mul: 0.33 }; }),
      u('Personal Record', 5200, 'Burns hit 3x harder, +1 damage, double damage to bosses.', s => { s.burnDmg = 3; s.dmg += 1; s.bossMul = Math.max(s.bossMul || 1, 2); }),
      u('Gym Legend', 24000, 'Permanent rage. +3 damage. Breaks frying pans.', s => { s.rage = { every: 1, dur: 1, mul: 0.3 }; s.dmg += 3; s.kind = 'magic'; }),
    ]],
  },
  spinner: {
    name: 'Kettlebell Spinner', cost: 330, r: 26,
    desc: 'Spins a kettlebell and flings weight plates in every direction.',
    base: { range: 110, cd: 1.25, dmg: 1, pierce: 1, kind: 'sharp', speed: 520, count: 8, psize: 9 },
    paths: [[
      u('More Plates', 230, '12 plates per spin.', s => { s.count = 12; }),
      u('Spicy Pre-Workout', 480, 'Plates set rats on fire. Burns frying-pan rats too.', s => { s.kind = 'fire'; s.burn = true; }),
      u('Tornado of Gains', 2500, '20 burning plates, 4 pierce, spins like crazy.', s => { s.count = 20; s.pierce = 4; s.cd *= 0.4; s.dmg = 2; }),
      u('Hurricane of Gains', 5000, '28 plates, 6 pierce, 3 damage, more range.', s => { s.count = 28; s.pierce = 6; s.dmg = 3; s.range += 15; }),
      u('Black Hole Kettlebell', 26000, '6 damage and it pulls rats backwards every 2 s.', s => { s.dmg = 6; s.bossMul = 2; s.pull = { cd: 2, n: 20, d: 80 }; }),
    ], [
      u('Longer Chain', 130, 'More range.', s => { s.range += 28; }),
      u('Faster Spin', 320, 'Spins 50% faster.', s => { s.cd *= 0.66; }),
      u('Ring of Fire', 2700, 'A ring of flames burns everything in range, all the time.', s => { s.ring = true; s.ringCd = 0.16; s.kind = 'fire'; s.range += 12; }),
      u('Ring of Gains', 4500, 'The ring hits for 2 and reaches further.', s => { s.dmg += 1; s.range += 20; }),
      u('Sun Kettlebell', 24000, 'A tiny sun on a chain. 6 damage, burns twice as often.', s => { s.dmg += 4; s.ringCd = 0.1; s.range += 30; }),
    ], [
      u('Chalked Chain', 150, 'Plates fly faster and a bit further.', s => { s.range += 10; s.speed *= 1.3; }),
      u('Heavy Kettlebell', 450, 'Plates hit for 2 and break frying pans.', s => { s.dmg += 1; if (s.kind === 'sharp') s.kind = 'magic'; }),
      u('Kettle Smash', 1800, 'Every 4 s he slams the kettlebell on the strongest rat (20 damage).', s => { s.smash = { cd: 4, dmg: 20, bossMul: 1, blast: 0 }; }),
      u('Double Kettle', 5500, 'Smashes every 2.2 s for 35.', s => { s.smash = { cd: 2.2, dmg: 35, bossMul: 1, blast: 0 }; }),
      u('Kettlebell Meteor', 23000, 'Meteor smash: 150 damage, x3 vs bosses, hits everyone nearby.', s => { s.smash = { cd: 2, dmg: 150, bossMul: 3, blast: 70 }; }),
    ]],
  },
  shake: {
    name: 'Protein Shake Grenadier', cost: 560, r: 28,
    desc: 'Lobs exploding protein shakes. The blast breaks frying pans.',
    base: { range: 145, cd: 1.5, dmg: 1, pierce: 14, kind: 'blast', blast: 46, targets: 1, stun: 0 },
    paths: [[
      u('Bigger Shaker', 320, 'Bigger blast, hits more rats.', s => { s.blast = 62; s.pierce = 24; }),
      u('Expired Protein', 520, 'Rats hit stop to gag for a moment.', s => { s.stun = 0.6; }),
      u('Creatine Nuke', 2900, '4 damage, enormous blast. Shakes the street.', s => { s.dmg = 4; s.blast = 95; s.pierce = 70; s.shake = true; }),
      u('Mass Gainer Bomb', 6000, '8 damage, triple damage to bosses.', s => { s.dmg = 8; s.bossMul = 3; }),
      u('Protein Apocalypse', 30000, '20 damage in a giant blast that hits 150 rats.', s => { s.dmg = 20; s.blast = 130; s.pierce = 150; }),
    ], [
      u('Faster Shaking', 260, 'Throws 33% faster.', s => { s.cd *= 0.75; }),
      u('Triple Shake', 640, 'Throws at 3 rats at once.', s => { s.targets = 3; }),
      u('Shake Barrage', 3100, 'Way faster, huge range, shakes raining everywhere.', s => { s.cd *= 0.45; s.range += 70; s.targets = 5; }),
      u('Shake Machine', 5200, 'Faster again, 7 targets.', s => { s.cd *= 0.6; s.targets = 7; }),
      u('Protein Rain', 26000, 'Hits anywhere on the map, 10 targets, twice as fast.', s => { s.cd *= 0.5; s.range = 9999; s.targets = 10; }),
    ], [
      u('Sticky Shake', 180, 'Rats hit are slowed for 1.5 s.', s => { s.slowHit = 0.5; s.slowHitT = 1.5; }),
      u('Pre-Workout Mix', 420, 'Shakes set rats on fire.', s => { s.burn = true; }),
      u('Expired Milk', 1500, 'Shakes leave a gross puddle on the road that hurts rats.', s => { s.puddle = { life: 3, dmg: 1, tick: 0.5, r: 34, slow: 1 }; }),
      u('Toxic Sludge', 4800, 'Bigger, longer puddles: 3 damage and they slow.', s => { s.puddle = { life: 6, dmg: 3, tick: 0.5, r: 44, slow: 0.5 }; }),
      u('Biohazard Gains', 22000, 'Huge puddles that deal 8 damage. +2 shake damage.', s => { s.puddle = { life: 8, dmg: 8, tick: 0.4, r: 56, slow: 0.4 }; s.dmg += 2; }),
    ]],
  },
  dj: {
    name: 'DJ Bro', cost: 300, r: 22,
    desc: 'Blasts the gym playlist. Rats start dancing and slow down. AirPods Rats can\'t hear it.',
    base: { range: 105, slow: 0.6 },
    paths: [[
      u('Bass Boost', 210, 'Even slower.', s => { s.slow = 0.45; }),
      u('Drop The Beat', 470, 'Every few seconds everyone nearby freezes to dance.', s => { s.holdCd = 2.5; s.holdT = 0.9; }),
      u('Bass So Loud It Hurts', 1900, 'The bass damages everyone in range.', s => { s.hurtCd = 0.45; s.hurtDmg = 1; s.slow = 0.35; }),
      u('Subwoofer of Doom', 4500, 'The bass hits for 3, more often.', s => { s.hurtDmg = 3; s.hurtCd = 0.35; }),
      u('Bass Drop Apocalypse', 22000, 'The bass hits for 10 and the beat drops every 1.5 s.', s => { s.hurtDmg = 10; s.holdCd = 1.5; s.holdT = 1; s.range += 20; }),
    ], [
      u('Bigger Speakers', 160, 'More range.', s => { s.range += 35; }),
      u('Wrong Way!', 520, 'Confuses rats and sends them back down the street.', s => { s.pushCd = 3; s.pushN = 6; s.push = 70; }),
      u('Festival Mode', 2300, 'Huge range, slows bosses fully, constant confusion.', s => { s.range += 60; s.bossSlow = true; s.pushCd = 1.4; s.pushN = 16; s.slow = Math.min(s.slow, 0.45); }),
      u('World Tour', 5000, 'Even bigger, sends 30 rats way back.', s => { s.range += 60; s.pushN = 30; s.push = 120; }),
      u('Headliner', 24000, 'So loud even AirPods Rats hear it. Pushes bosses too.', s => { s.hearAll = true; s.pushBoss = 40; s.pushCd = 1; }),
    ], [
      u('Hype Man', 250, 'Nearby bros attack 10% faster.', s => { s.buff = { cd: 0.9, dmg: 0, rng: 0, detect: false }; }),
      u('Pump-Up Playlist', 600, 'Nearby bros attack 18% faster with more range.', s => { s.buff = { cd: 0.82, dmg: 0, rng: 10, detect: false }; }),
      u('Gym Anthem', 2000, 'Nearby bros attack 25% faster and spot rats in protein tubs.', s => { s.buff = { cd: 0.75, dmg: 0, rng: 10, detect: true }; }),
      u('Rave', 6000, 'Nearby bros attack 32% faster and hit +1 harder.', s => { s.buff = { cd: 0.68, dmg: 1, rng: 15, detect: true }; }),
      u('Main Stage', 25000, 'The whole squad goes off: +45% speed, +2 damage, huge area.', s => { s.buff = { cd: 0.55, dmg: 2, rng: 30, detect: true }; s.range *= 1.6; }),
    ]],
  },
  chad: {
    name: 'The Chad', cost: 420, r: 24,
    desc: 'Throws weight-plate frisbees anywhere on the map. Spots rats in protein tubs.',
    base: { range: 9999, cd: 1.6, dmg: 2, pierce: 1, kind: 'sharp', detect: true, multi: 1, cashPerHit: 0, bossMul: 1 },
    paths: [[
      u('Heavy Plates', 360, '4 damage. Breaks frying pans.', s => { s.dmg = 4; s.kind = 'magic'; }),
      u('Sponsored', 1050, '7 damage and +$2 every hit. This hit was sponsored.', s => { s.dmg = 7; s.cashPerHit += 2; }),
      u('Final Form', 4200, '30 damage, triple damage to bosses.', s => { s.dmg = 30; s.bossMul = 3; }),
      u('Ascended Chad', 9000, '70 damage, x4 vs bosses.', s => { s.dmg = 70; s.bossMul = 4; }),
      u('Gigachad', 35000, '200 damage, x5 vs bosses, frisbees go through 3 rats.', s => { s.dmg = 200; s.bossMul = 5; s.pierce = 3; }),
    ], [
      u('Fast Twitch', 310, 'Throws 40% faster.', s => { s.cd *= 0.7; }),
      u('Arm Day', 1250, 'Throws almost 3x as fast.', s => { s.cd *= 0.36; }),
      u('Main Character', 3600, 'Each throw hits the 4 strongest rats.', s => { s.multi = 4; s.cd *= 0.8; }),
      u('Plot Armor', 6000, '6 frisbees per throw, even faster.', s => { s.multi = 6; s.cd *= 0.7; }),
      u('Protagonist Energy', 28000, '10 frisbees, twice as fast, double damage.', s => { s.multi = 10; s.cd *= 0.5; s.dmg *= 2; }),
    ], [
      u('Rizz', 200, 'Rats hit stop and stare: slowed for 1 s.', s => { s.slowHit = 0.6; s.slowHitT = 1; }),
      u('Aura Farming', 500, 'Frisbees explode and hit 5 rats nearby.', s => { s.blastHit = 34; }),
      u('Mewing', 1800, 'Jawline so sharp the frisbees go through 4 rats.', s => { s.pierce = Math.max(s.pierce, 4); }),
      u('Sigma Grindset', 5000, '+$4 every hit and +$200 every wave.', s => { s.cashPerHit += 4; s.income = (s.income || 0) + 200; }),
      u('Unspoken Rizz', 24000, 'Every 8 s every rat on the map freezes and stares at him.', s => { s.rizz = { cd: 8, t: 1.5 }; }),
    ]],
  },
  store: {
    name: 'Supplement Store', cost: 800, r: 30,
    desc: 'Sells overpriced supplements. Pays out after every wave.',
    base: { range: 0, income: 80, interest: 0, interestMax: 0, tips: 0 },
    paths: [[
      u('Protein Bars', 520, '+$60 per wave.', s => { s.income += 60; }),
      u('Gym Memberships', 1350, '+$140 per wave.', s => { s.income += 140; }),
      u('Supplement Empire', 4600, '+$520 per wave.', s => { s.income += 520; }),
      u('Celebrity Endorsement', 12000, '+$1,500 per wave.', s => { s.income += 1500; }),
      u('Supplement Monopoly', 40000, '+$4,000 per wave.', s => { s.income += 4000; }),
    ], [
      u('Savings Account', 420, '+5% of your cash every wave (max $150).', s => { s.interest = 0.05; s.interestMax = 150; }),
      u('Tip Jar', 950, 'Every rat hit nearby gives +$1 extra.', s => { s.tips = 1; s.range = Math.max(s.range, 175); }),
      u('Crypto Gains', 3600, 'Double income, 10% interest (max $600).', s => { s.income *= 2; s.interest = 0.1; s.interestMax = 600; }),
      u('Hedge Fund', 10000, '15% interest (max $2,500).', s => { s.interest = 0.15; s.interestMax = 2500; }),
      u('Bro Bank', 35000, '20% interest (max $6,000). Tips pay double.', s => { s.interest = 0.2; s.interestMax = 6000; s.tips = 2; }),
    ], [
      u('Free Samples', 300, 'Nearby bros attack 8% faster.', s => { s.range = Math.max(s.range, 150); s.buff = { cd: 0.92, dmg: 0, rng: 0, detect: false }; }),
      u('Energy Drinks', 750, 'Nearby bros attack 15% faster.', s => { s.buff = { cd: 0.85, dmg: 0, rng: 0, detect: false }; }),
      u('Creatine Station', 2400, 'Nearby bros also hit +1 harder.', s => { s.buff = { cd: 0.85, dmg: 1, rng: 0, detect: false }; }),
      u('Mystery Powder', 6500, 'Nobody knows what\'s in it. +28% speed, +2 damage.', s => { s.buff = { cd: 0.72, dmg: 2, rng: 0, detect: false }; }),
      u('Lab-Grown Gains', 25000, '+42% speed, +4 damage, +40 range for every bro nearby.', s => { s.buff = { cd: 0.58, dmg: 4, rng: 40, detect: false }; s.range = Math.max(s.range, 220); }),
    ]],
  },
  influencer: {
    name: 'Gymfluencer', cost: 450, r: 24,
    desc: 'Takes mirror selfies. The flash blinds every rat nearby for a moment.',
    base: { range: 120, cd: 3, flashT: 0.5, flashDmg: 0, income: 0, cashPerStun: 0, expose: 0, exposeMul: 1, reveal: false },
    paths: [[
      u('Ring Light', 250, 'Bigger flash.', s => { s.range += 30; }),
      u('Flash Spam', 500, 'Flashes every 2 s.', s => { s.cd = 2; }),
      u('Blinding Selfie', 1800, 'Blinds longer and the flash deals 1 damage.', s => { s.flashT = 0.9; s.flashDmg = 1; }),
      u('Mirror Selfie Army', 5500, 'Blinds for 1.3 s, 3 damage.', s => { s.flashT = 1.3; s.flashDmg = 3; }),
      u('Main Character Lighting', 24000, 'Flashes every second for 8 damage.', s => { s.cd = 1; s.flashDmg = 8; }),
    ], [
      u('Zoom Lens', 200, 'More range.', s => { s.range += 25; }),
      u('Expose Them', 550, 'Knocks the lids off rats in protein tubs in range. Everyone can see them now.', s => { s.reveal = true; }),
      u('Cancel Culture', 2000, 'Flashed rats take +1 damage from every hit.', s => { s.expose = 1; }),
      u('Ratio\'d', 5000, 'Flashed rats take +2 damage. Works on bosses.', s => { s.expose = 2; s.exposeBoss = true; }),
      u('Doxxed', 23000, 'Flashed rats take DOUBLE damage. Bigger range.', s => { s.exposeMul = 2; s.range += 40; }),
    ], [
      u('Sponsorship', 250, '+$40 per wave.', s => { s.income += 40; }),
      u('Going Viral', 700, '+$1 for every rat she blinds.', s => { s.cashPerStun = 1; }),
      u('Brand Deals', 2200, '+$200 per wave.', s => { s.income += 160; }),
      u('Livestream', 6500, '+$600 per wave, +$2 per blinded rat.', s => { s.income += 400; s.cashPerStun = 2; }),
      u('Influencer Empire', 30000, '+$2,000 per wave, +$4 per blinded rat.', s => { s.income += 1400; s.cashPerStun = 4; }),
    ]],
  },
  legs: {
    name: 'Leg Day Bro', cost: 500, r: 26,
    desc: 'Never skipped leg day. Squats and stomps a shockwave that hits everyone around him.',
    base: { range: 85, cd: 1.4, dmg: 1, pierce: 25, kind: 'blast', stun: 0 },
    paths: [[
      u('Heavier Squat', 300, 'Stomps hit for 2.', s => { s.dmg = 2; }),
      u('Deep Squat', 600, 'Bigger shockwave, hits 40 rats.', s => { s.range += 20; s.pierce = 40; }),
      u('Earthquake', 2200, '4 damage and rats are stunned.', s => { s.dmg = 4; s.stun = 0.4; s.shake = true; }),
      u('Tectonic Thighs', 6000, '8 damage, huge range, double damage to bosses.', s => { s.dmg = 8; s.range += 30; s.bossMul = 2; }),
      u('Leg Day God', 28000, '20 damage, x3 vs bosses, long stun.', s => { s.dmg = 20; s.range += 40; s.bossMul = 3; s.stun = 0.8; }),
    ], [
      u('Jump Squats', 250, 'Stomps 30% faster.', s => { s.cd *= 0.7; }),
      u('Box Jumps', 550, 'Faster and a bit more range.', s => { s.cd *= 0.75; s.range += 10; }),
      u('Squat Rack Spam', 2000, 'Twice as fast.', s => { s.cd *= 0.5; }),
      u('Thunder Thighs', 5000, 'Even faster, +1 damage.', s => { s.cd *= 0.6; s.dmg += 1; }),
      u('Never Skipped A Day', 24000, 'Constant earthquakes. +3 damage.', s => { s.cd *= 0.4; s.dmg += 3; }),
    ], [
      u('Wide Stance', 200, 'Stomps slow rats for 1 s.', s => { s.slowHit = 0.6; s.slowHitT = 1; }),
      u('Calf Raises', 500, 'Stomps knock rats back.', s => { s.knock = 30; }),
      u('Sumo Stance', 1800, 'Bigger knockback and a stronger slow.', s => { s.knock = 60; s.slowHit = 0.4; }),
      u('Hip Thrust Shockwave', 5000, 'Huge knockback. Even bosses get pushed.', s => { s.knock = 100; s.knockBoss = 20; }),
      u('Leg Press Lockdown', 22000, 'Every stomp locks rats in place for 1.5 s.', s => { s.stun = 1.5; s.knock = 120; }),
    ]],
  },
  treadmill: {
    name: 'Treadmill Bro', cost: 400, r: 24,
    desc: 'Drops treadmills (rats run in place) and loose kettlebells (ouch) onto the road.',
    base: { range: 120, cd: 2.2, kbPierce: 4, kbDmg: 1, kbKind: 'sharp', kbBlast: 0, kbLife: 10, tmSlow: 0.5, tmLife: 6, tmDmg: 0, tmBoss: false,
            maxTraps: 10, perDrop: 1, lifeMul: 1, trapMul: 1, smart: false },
    paths: [[
      u('More Kettlebells', 220, 'Kettlebells trip 6 rats and drop faster.', s => { s.kbPierce = 6; s.cd *= 0.85; }),
      u('Spiked Kettlebells', 450, 'Kettlebells hit for 2.', s => { s.kbDmg = 2; }),
      u('Kettlebell Minefield', 1800, 'Kettlebells explode. Breaks frying pans.', s => { s.kbBlast = 40; s.kbPierce = 15; s.kbKind = 'blast'; }),
      u('Heavy Duty', 5500, 'Kettlebells hit for 5 and trip 25 rats.', s => { s.kbDmg = 5; s.kbPierce = 25; }),
      u('Kettlebell Rain', 25000, 'Drops 3 at a time, 12 damage each.', s => { s.kbDmg = 12; s.perDrop += 2; }),
    ], [
      u('Faster Belt', 200, 'Treadmills slow rats more.', s => { s.tmSlow = 0.35; }),
      u('Incline Mode', 480, 'Treadmills last longer. More range.', s => { s.tmLife = 10; s.range += 20; }),
      u('Max Speed', 1900, 'Treadmills are so fast rats walk BACKWARDS on them.', s => { s.tmSlow = -0.35; }),
      u('Treadmill of Doom', 5000, 'Rats fly backwards. Bosses get slowed too.', s => { s.tmSlow = -0.8; s.tmBoss = true; }),
      u('Infinite Cardio', 23000, 'Treadmills last 20 s, hurt rats, and launch them back.', s => { s.tmSlow = -1; s.tmLife = 20; s.tmDmg = 1; }),
    ], [
      u('Rubber Mats', 150, 'Everything he drops lasts 50% longer.', s => { s.lifeMul = 1.5; }),
      u('Smart Treadmills', 400, 'Drops right in front of the leading rat.', s => { s.smart = true; }),
      u('Gym Floor', 1600, 'Drops 2 at a time.', s => { s.perDrop += 1; }),
      u('Equipment Warehouse', 4500, 'Up to 30 items on the road, drops way faster.', s => { s.maxTraps = 30; s.cd *= 0.6; }),
      u('Mega Gym', 21000, 'Everything hits twice as hard and lasts 3x longer.', s => { s.trapMul = 2; s.lifeMul = 3; s.tmDmg = Math.max(s.tmDmg, 1); }),
    ]],
  },
};

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
