// Sinner types. Each hit peels off one layer: the sinner turns into its kids.
// noSharp: stamps and pitchforks bounce off. noSlow: ignores the hold music.

export const ETYPES = {
  soul:       { name: 'Lost Soul',      hp: 1,   speed: 75,  r: 13, kids: [] },
  cart:       { name: 'Cart Guy',       hp: 1,   speed: 105, r: 16, kids: ['soul'] },
  infl:       { name: 'Influencer',     hp: 1,   speed: 135, r: 16, kids: ['cart'] },
  lawyer:     { name: 'Lawyer',         hp: 1,   speed: 195, r: 16, kids: ['infl'] },
  ceo:        { name: 'CEO',            hp: 1,   speed: 220, r: 17, kids: ['lawyer'] },
  mime:       { name: 'Mime',           hp: 1,   speed: 175, r: 16, kids: ['ceo', 'ceo'], noSlow: true },
  complainer: { name: 'The Complainer', hp: 1,   speed: 95,  r: 18, kids: ['mime', 'mime'], noSharp: true },
  bus:        { name: 'Tour Bus',       hp: 16,  speed: 120, r: 28, kids: ['complainer', 'complainer', 'mime', 'mime'] },
  replyall:   { name: 'Reply-All Guy',  hp: 160, speed: 52,  r: 40, kids: ['mime', 'mime', 'mime', 'mime'], boss: true },
  popup:      { name: 'The Inventor of Pop-Up Ads', hp: 900, speed: 40, r: 54, kids: ['replyall', 'replyall'], boss: true },
};

// "Red-sinner equivalent": how many layers a type holds in total.
const rbeCache = {};
export function rbe(type) {
  if (rbeCache[type] != null) return rbeCache[type];
  const T = ETYPES[type];
  let n = T.hp;
  for (const k of T.kids) n += rbe(k);
  return (rbeCache[type] = n);
}
export function rbeOf(e) {
  let n = e.hp;
  for (const k of ETYPES[e.t].kids) n += rbe(k);
  return n;
}

export const LINES = {
  soul: ['...where am I?', 'Is this the line for snacks?', 'I just wanted to go home', 'Mom?'],
  cart: ['It was only one cart!', 'The parking lot was FAR', "Someone else will do it", 'Squeak squeak'],
  infl: ['This is going on my story', 'Use my code HELL10', 'Hell is SO aesthetic', 'Wait, is the lighting okay?', 'Like and subscribe!'],
  lawyer: ['I object!', "You'll hear from my client", 'Technically I am innocent', 'Read the fine print'],
  ceo: ['Do you know who I am?', 'I fired 9000 people. For growth!', "Let's circle back", 'Can I pay to skip the line?'],
  mime: ['...', '*pretends to be in a box*', '*silent screaming*'],
  complainer: ['I want to speak to the manager', 'This line is UNACCEPTABLE', "I'm leaving one star", 'I know the Devil personally'],
  bus: ['ARE WE THERE YET', 'Tour group, stay together!', 'Free sample?'],
  replyall: ['RE: RE: RE: FW: Lunch?', 'Sorry, wrong chat. Anyway...', 'Per my last email...'],
  popup: ['CONGRATULATIONS! YOU WON!', 'Hot singles in your circle of Hell', 'Click here! Click here!'],
};
