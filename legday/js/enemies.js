// Zombie types. Each hit knocks off one layer: the zombie turns into its kids.
// noSharp: dumbbells and plates bounce off. noSlow: can't hear the DJ.

export const ETYPES = {
  crawler:    { name: 'Crawler',           hp: 1,   speed: 75,  r: 13, kids: [] },
  walker:     { name: 'Walker',            hp: 1,   speed: 105, r: 16, kids: ['crawler'] },
  hardhat:    { name: 'Hard-Hat Zombie',   hp: 1,   speed: 135, r: 16, kids: ['walker'] },
  jogger:     { name: 'Jogger Zombie',     hp: 1,   speed: 195, r: 16, kids: ['hardhat'] },
  football:   { name: 'Football Zombie',   hp: 1,   speed: 220, r: 18, kids: ['jogger'] },
  headphones: { name: 'Headphones Zombie', hp: 1,   speed: 175, r: 16, kids: ['football', 'football'], noSlow: true },
  riot:       { name: 'Riot Zombie',       hp: 1,   speed: 95,  r: 19, kids: ['headphones', 'headphones'], noSharp: true },
  partybus:   { name: 'Zombie Party Bus',  hp: 16,  speed: 120, r: 28, kids: ['riot', 'riot', 'headphones', 'headphones'] },
  couch:      { name: 'The Couch Zombie',  hp: 160, speed: 52,  r: 42, kids: ['headphones', 'headphones', 'headphones', 'headphones'], boss: true },
  mru:        { name: 'Zombie Mr. Universe', hp: 900, speed: 40, r: 54, kids: ['couch', 'couch'], boss: true },
};

// "Red-zombie equivalent": how many layers a type holds in total.
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
  crawler: ['braaains...', 'my legs fell off', 'never skipped crawl day', 'help'],
  walker: ['BRAAAINS', 'is anyone using this?', 'can I work in?', 'I only do cardio'],
  hardhat: ['safety first', 'I was on my lunch break', 'brains are on the menu'],
  jogger: ['just 5 more km', 'I paused my Strava for this', 'pace: undead', 'cardio is king'],
  football: ['TOUCHDOWN', 'coach said go left', 'I peaked in high school', 'BRAINS ARE THE ENDZONE'],
  headphones: ['*can\'t hear you*', 'what?', '*vibing*'],
  riot: ['you can\'t lift this shield', 'shield day', 'I bench 0 kg'],
  partybus: ['PARTY BUS!!!', 'who invited the bros?', 'turn it up'],
  couch: ['I\'ll start Monday', 'pass the chips', 'gym is overrated'],
  mru: ['DO YOU EVEN DIE?', 'I am the final boss of leg day', 'nice gains... for a human'],
};

export const SHOUTS = ['LIGHT WEIGHT BABY!', 'YEAH BUDDY', 'DO YOU EVEN LIFT?', 'NO DAYS OFF', 'ONE MORE REP', 'GET SWOLE', 'SKILL ISSUE', 'BEAST MODE'];
