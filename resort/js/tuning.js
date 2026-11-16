// First Chair: every number of the game lives here, so balancing is one file.

export const T = {
  N: 96,                 // the mountain is N x N tiles
  STEP: 0.1,             // length of one simulation step in seconds
  LIFT_COUNT: 6,
  START_MONEY: 25,
  MONEY: 10,             // every fare, price and reward is multiplied by this, so nothing needs cents

  // Piste colour: steepness (drop per tile) below these limits.
  GREEN: 0.17, BLUE: 0.28, RED: 0.42, PISTE_WIDTH: 2.4,

  // Guests.
  WALK: 2.4, SKI: 3.6,
  GUESTS_START: 10, GUESTS_STEP: 6, GUESTS_MAX: 280,   // how many are on the mountain at once
  RUNS: [4, 9],                                         // rides before a guest goes home
  BOARDERS: 0.35,                                       // share of guests on a snowboard
  QUESTS_OPEN: 3,                                       // quests that can be worked on at once

  // What one ride costs on each lift, before upgrades.
  FARE: [1, 2.5, 7, 18, 50, 140],
  TICKET_GAIN: 1.1,      // each ticket level multiplies every fare by this
  HUT_GAIN: 0.2,         // each hut level adds this share on top
  SPEED_GAIN: 0.06,      // each speed level adds this share of lift speed

  // Prices. A repeatable upgrade costs base * growth ^ level.
  LIFT_COST: [0, 80, 5000, 250000, 12000000, 600000000],
  CHAIR_COST: [350, 800], GONDOLA_COST: [50000, 120000, 3000000, 9000000],
  SPEED: { base: 50, growth: 1.45, max: 25 },
  GUESTS: { base: 20, growth: 1.25, max: 45 },
  TICKET: { base: 30, growth: 1.3, max: 9999 },
  HUT: { base: 400, growth: 1.8, max: 30 },

  // Upgrades that unlock by playing.
  JUMP: { base: 600, growth: 1.9, max: 20 },      // kickers on the pistes
  CANNON: { base: 5000, growth: 1.7, max: 10 },   // snow cannons: faster skiing
  SCHOOL: { base: 3000, growth: 1.6, max: 25 },   // ski school: lessons per guest
  NIGHT: { base: 60000, growth: 2.2, max: 8 },    // night skiing: income multiplier
  RESTO: { base: 900000, growth: 2.4, max: 10 },  // mountain restaurant: income multiplier
  CANNON_GAIN: 0.08, SCHOOL_PAY: 0.012, NIGHT_GAIN: 0.15, RESTO_GAIN: 0.25,
  TRICK_CHANCE: 0.08, TRICK_CHANCE_STEP: 0.005, TRICK_CHANCE_MAX: 0.18, TRICK_PAY: 2, TRICK_PAY_STEP: 0.3, AIR_TIME: 0.95,
  UNLOCK_CANNON_RIDES: 2000, UNLOCK_SCHOOL_TIME: 480,
  TURNAROUND: 9,         // seconds a guest spends walking and queueing per ride, for the income sum

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
