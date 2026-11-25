// Mutant gym rat types. Each hit knocks off one layer: the rat turns into its kids.
// noSharp: dumbbells and plates bounce off (frying pan). noSlow: can't hear the DJ.

export const ETYPES = {
  crawler:    { name: 'Baby Rat',           hp: 1,   speed: 75,  r: 13, kids: [] },
  walker:     { name: 'Gym Rat',            hp: 1,   speed: 105, r: 16, kids: ['crawler'] },
  hardhat:    { name: 'Buff Rat',   hp: 1,   speed: 135, r: 16, kids: ['walker'] },
  jogger:     { name: 'Cardio Rat',     hp: 1,   speed: 195, r: 16, kids: ['hardhat'] },
  football:   { name: 'Skater Rat',   hp: 1,   speed: 220, r: 18, kids: ['jogger'] },
  headphones: { name: 'AirPods Rat', hp: 1,   speed: 175, r: 16, kids: ['football', 'football'], noSlow: true },
  riot:       { name: 'Frying-Pan Rat',       hp: 1,   speed: 95,  r: 19, kids: ['headphones', 'headphones'], noSharp: true },
  partybus:   { name: 'Shopping Cart of Rats',  hp: 16,  speed: 120, r: 28, kids: ['riot', 'riot', 'headphones', 'headphones'] },
  couch:      { name: 'The Roomba Rat',  hp: 160, speed: 52,  r: 42, kids: ['headphones', 'headphones', 'headphones', 'headphones'], boss: true },
  mru:        { name: 'The Rat King', hp: 900, speed: 40, r: 54, kids: ['couch', 'couch'], boss: true },
};

// "Red-rat equivalent": how many layers a type holds in total.
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
  crawler: ['squeak', 'mom?', 'is this the protein?', 'I am baby'],
  walker: ['SQUEAK', 'is anyone using this?', 'can I work in?', 'I live here now', '*steals your protein*'],
  hardhat: ['I lift... cheese', 'creatine tastes like cheese', 'rat gains', 'squeak squeak (BEAST MODE)'],
  jogger: ['just 5 more km', 'I paused my Strava for this', 'cardio is king', 'wheel day every day'],
  football: ['KICKFLIP', 'skate or die', 'no brakes', 'sick ollie bro'],
  headphones: ["*can't hear you*", 'what?', '*vibing*', 'noise cancelling ON'],
  riot: ['CLANG', 'pan day', 'I cook AND lift', 'nice try'],
  partybus: ['CLEAN UP AISLE 5', 'free ride!', 'wheee'],
  couch: ["I'll start Monday", 'pass the chips', 'cleaning? never heard of it'],
  mru: ['BOW TO THE KING', 'I ate ALL the protein', 'my six-pack has a six-pack'],
};

export const SHOUTS = ['LIGHT WEIGHT BABY!', 'YEAH BUDDY', 'DO YOU EVEN LIFT?', 'NO DAYS OFF', 'ONE MORE REP', 'GET SWOLE', 'SKILL ISSUE', 'BEAST MODE'];
