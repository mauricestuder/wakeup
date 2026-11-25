// Robber types. Each hit knocks off one layer: the robber turns into its kids.
// noSharp: stamps and files bounce off (the lawyer's briefcase). noSlow: can't hear the hold music.

export const ETYPES = {
  crawler:    { name: 'Pickpocket',       hp: 1,   speed: 75,  r: 13, kids: [] },
  walker:     { name: 'Burglar',          hp: 1,   speed: 105, r: 16, kids: ['crawler'] },
  hardhat:    { name: 'Big Bag Robber',   hp: 1,   speed: 135, r: 16, kids: ['walker'] },
  jogger:     { name: 'Sprinter Thief',   hp: 1,   speed: 195, r: 16, kids: ['hardhat'] },
  football:   { name: 'Scooter Thief',    hp: 1,   speed: 220, r: 18, kids: ['jogger'] },
  headphones: { name: 'Hacker',           hp: 1,   speed: 175, r: 16, kids: ['football', 'football'], noSlow: true },
  riot:       { name: 'The Lawyer',       hp: 1,   speed: 95,  r: 19, kids: ['headphones', 'headphones'], noSharp: true },
  partybus:   { name: 'Getaway Van',      hp: 16,  speed: 120, r: 28, kids: ['riot', 'riot', 'headphones', 'headphones'] },
  couch:      { name: 'Bulldozer Bob',    hp: 160, speed: 52,  r: 42, kids: ['headphones', 'headphones', 'headphones', 'headphones'], boss: true },
  mru:        { name: 'The Godfather',    hp: 900, speed: 40,  r: 54, kids: ['couch', 'couch'], boss: true },
  offshore:   { name: 'MR. OFFSHORE',     hp: 2000, speed: 34, r: 62, kids: ['mru'], boss: true },
};

// "Red-robber equivalent": how many layers a type holds in total.
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
  crawler: ['nice wallet', 'just browsing', 'that\'s mine now', 'oops'],
  walker: ['shhh', 'nobody saw that', 'is the vault this way?', 'I\'m a customer', 'tiptoe tiptoe'],
  hardhat: ['the bag is heavy', 'MORE MONEY', 'bag secured', 'I need a bigger bag'],
  jogger: ['can\'t catch me', 'cardio for crime', 'run run run', 'no receipts'],
  football: ['skrrt', 'no license', 'scooter go brrr', 'catch me if you can'],
  headphones: ['*can\'t hear you*', 'hacking the mainframe', '*typing noises*', 'I\'m in'],
  riot: ['objection!', 'my client is innocent', 'that\'s inadmissible', 'I bill by the hour'],
  partybus: ['GET IN THE VAN', 'floor it!', 'honk honk'],
  couch: ['I\'m not robbing, I\'m renovating', 'beep beep', 'bulldozer coming through'],
  mru: ['an offer you can\'t refuse', 'nice bank. shame if...', 'capisce?'],
  offshore: ['taxes are for poor people', 'I have 47 yachts', 'my money lives in the Cayman Islands', 'Panama papers? never heard of them'],
};

export const SHOUTS = ['DENIED!', 'PAY YOUR TAXES', 'FORM 27-B PLEASE', 'NOT ON MY WATCH', 'THAT\'S OUR MONEY', 'AUDIT TIME', 'RECEIPT PLEASE', 'STOP RIGHT THERE'];
