// First Chair: every number of the game lives here, so balancing is one file.

export const T = {
  N: 96,                 // the mountain is N x N tiles
  // The clock, in minutes since midnight. One real second at 1x is MIN_PER_SEC minutes.
  DAY_START: 480, LIFTS_OPEN: 495, LAST_ARRIVAL: 760, CLOSING: 990, DAY_END: 1035, MIN_PER_SEC: 2,
  STEP: 0.1,             // length of one simulation step in seconds
  SEASON_DAYS: 30,
  MAX_GUESTS: 400,

  // How close two things must be to count as connected (in tiles).
  R_ENTER: 3.6, R_EXIT: 3.2, R_WALK: 4.6, R_BASE: 9, R_BASE_EXIT: 6,

  // Piste rating: steepness (drop per tile) below these limits.
  GREEN: 0.17, BLUE: 0.28, RED: 0.42,
  PISTE_COST: 55, TREE_COST: 30, PISTE_MIN: 6, PISTE_MAX: 150, PISTE_WIDTH: 2.4,

  // Money.
  TICKET: 25, FOOD: 12, RENT: 18, RENT_SHARE: 0.4, RENT_PER_SHOP: 60,
  BASE_UPKEEP: 250, LOAN_STEP: 10000, LOAN_MAX: 60000, INTEREST: 0.003, OVERDRAFT: 0.01,
  HOTEL_BEDS: 40, HOTEL_NIGHT: 55, RESCUE_COST: 60, REFUND: 0.5,

  // Guests.
  WALK: 1.5, SKI: 2.6, SKI_SKILL: 0.9, EAT_TIME: 9, HUT_SEATS: 24,
  HUNGER: 1 / 190, ENERGY: 1 / 310, QUEUE_OK: 12, QUEUE_PAIN: 0.0045,
  SKILL_MIX: [0.4, 0.4, 0.2],

  // Snow, in centimetres. Depth at a height is valley depth + SNOW_ALT * height share.
  SNOW_ALT: 70, SNOW_GOOD: 35, CANNON_R: 7, CANNON_DEPTH: 45, GROOM_REACH: 170, WEAR: 0.0005,
};

// Lifts. speed in tiles per second, interval = seconds between carriers,
// clear = cable height over the ground, storm = height share above which a storm closes it.
export const LIFTS = {
  drag: { name: 'Drag lift', base: 3500, perTile: 140, seats: 1, interval: 1.3, speed: 1.7, run: 140,
    minLen: 6, maxLen: 34, maxGrade: 0.5, clear: 1.5, ground: true, storm: 2, color: 0xf2a33a,
    blurb: 'Cheap and short. One rider at a time, and it cannot cross a dip.' },
  chair: { name: 'Chairlift', base: 14000, perTile: 420, seats: 4, interval: 2.2, speed: 2.4, run: 480,
    minLen: 10, maxLen: 70, maxGrade: 0.8, clear: 2.5, storm: 0.72, color: 0x3d8bff,
    blurb: 'Four seats per chair. Crosses hollows. Closes in a storm when it ends high up.' },
  gondola: { name: 'Gondola', base: 38000, perTile: 850, seats: 8, interval: 2.5, speed: 3.4, run: 1050,
    minLen: 16, maxLen: 120, maxGrade: 1.3, clear: 3.2, storm: 0.9, color: 0xe5484d,
    blurb: 'Fast, long and steep. Eight per cabin, and almost storm-proof.' },
};

// Buildings. upkeep is per day.
export const BUILDINGS = {
  hut: { name: 'Ski hut', cost: 7000, upkeep: 180, blurb: 'Food and a rest. Hungry guests look for one.' },
  rental: { name: 'Ski rental', cost: 5500, upkeep: 140, blurb: 'Rents gear to arriving guests. One shop serves 60 a day.' },
  firstaid: { name: 'First-aid post', cost: 5000, upkeep: 200, blurb: 'Looks after injured guests, so accidents hurt your rating less.' },
  cannon: { name: 'Snow cannon', cost: 2400, upkeep: 55, blurb: 'Keeps the snow deep within 7 tiles, even when it thaws.' },
  groomer: { name: 'Groomer garage', cost: 11000, upkeep: 300, blurb: 'Grooms 170 tiles of piste every night, busiest pistes first.' },
  hotel: { name: 'Hotel', cost: 30000, upkeep: 550, blurb: '40 beds: overnight income and guests who come whatever the weather.' },
};

export const DIFF = [
  { name: 'Green', word: 'easy', color: 0x34b05a, css: '#34b05a' },
  { name: 'Blue', word: 'medium', color: 0x2f7fe6, css: '#2f7fe6' },
  { name: 'Red', word: 'hard', color: 0xe5484d, css: '#e5484d' },
  { name: 'Black', word: 'expert', color: 0x20242b, css: '#20242b' },
];

export const SKILL = ['Beginner', 'Intermediate', 'Expert'];

// How much fun a piste of each difficulty is, per skill. Below zero means scared.
export const FUN = [
  [1.0, 0.3, -1.4, -3.0],
  [0.6, 1.0, 0.65, -1.1],
  [0.3, 0.65, 1.0, 1.25],
];

// Weather: demand factor, snow change overnight (cm), mood.
export const WEATHER = {
  sun: { name: 'Sunny', demand: 1.15, snow: -2, mood: 0.05 },
  cloud: { name: 'Cloudy', demand: 1.0, snow: -1, mood: 0 },
  snow: { name: 'Snowfall', demand: 0.85, snow: 14, mood: 0.02 },
  storm: { name: 'Storm', demand: 0.5, snow: 22, mood: -0.1 },
  thaw: { name: 'Thaw', demand: 0.9, snow: -9, mood: -0.02 },
};
