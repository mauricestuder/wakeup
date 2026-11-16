// First Chair: every number of the game lives here, so balancing is one file.

export const T = {
  N: 96,                 // the mountain is N x N tiles
  STEP: 0.1,             // length of one simulation step in seconds
  LIFT_COUNT: 6,
  START_MONEY: 25,

  // Piste colour: steepness (drop per tile) below these limits.
  GREEN: 0.17, BLUE: 0.28, RED: 0.42, PISTE_WIDTH: 2.4,

  // Guests.
  WALK: 2.4, SKI: 3.6,
  GUESTS_START: 10, GUESTS_STEP: 6, GUESTS_MAX: 280,   // how many are on the mountain at once
  RUNS: [4, 9],                                         // rides before a guest goes home

  // What one ride costs on each lift, before upgrades.
  FARE: [1, 2.5, 7, 18, 50, 140],
  TICKET_GAIN: 1.1,      // each ticket level multiplies every fare by this
  HUT_GAIN: 0.2,         // each hut level adds this share on top
  SPEED_GAIN: 0.06,      // each speed level adds this share of lift speed

  // Prices. A repeatable upgrade costs base * growth ^ level.
  LIFT_COST: [0, 80, 2500, 30000, 600000, 12000000],
  CHAIR_COST: [350, 800], GONDOLA_COST: [12000, 20000, 150000, 300000],
  SPEED: { base: 50, growth: 1.45, max: 25 },
  GUESTS: { base: 20, growth: 1.25, max: 45 },
  TICKET: { base: 30, growth: 1.3, max: 9999 },
  HUT: { base: 400, growth: 1.8, max: 30 },

  // Rush hour: more guests and faster lifts for a short while.
  RUSH_TIME: 30, RUSH_WAIT: 120, RUSH_GUESTS: 1.5, RUSH_SPEED: 1.5,

  // A new mountain: everything costs more, pays more, and fame doubles income on top.
  NEXT_COST: 5.5, NEXT_FARE: 3, FAME: 2,

  DAY_LENGTH: 300,       // seconds for the sun to cross the sky (looks only)
};

// Lifts. speed in tiles per second, interval = seconds between carriers,
// clear = cable height over the ground.
export const LIFTS = {
  drag: { name: 'Drag lift', seats: 1, interval: 1.3, speed: 1.7, clear: 1.5, ground: true, color: 0xf2a33a },
  chair: { name: 'Chairlift', seats: 4, interval: 2.2, speed: 2.4, clear: 2.5, color: 0x3d8bff },
  gondola: { name: 'Gondola', seats: 8, interval: 2.5, speed: 3.4, clear: 3.2, color: 0xe5484d },
};
export const NEXT_TYPE = { drag: 'chair', chair: 'gondola' };

export const DIFF = [
  { name: 'Green', color: 0x34b05a, css: '#34b05a' },
  { name: 'Blue', color: 0x2f7fe6, css: '#2f7fe6' },
  { name: 'Red', color: 0xe5484d, css: '#e5484d' },
  { name: 'Black', color: 0x20242b, css: '#20242b' },
];
