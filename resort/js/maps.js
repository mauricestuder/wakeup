// Idle Lift: the mountains, one after the other. Each is higher than the one before and has a
// landmark of its own (special).
// H = summit height in tiles, curve = how much steeper it gets towards the top,
// narrow = how much the massif narrows, ridge = strength of ridges and gullies.
// flip mirrors the lift plan left to right, spread widens it.

export const SPECIALS = {
  cross: { name: 'Summit cross', note: 'a wooden cross on the summit' },
  jump: { name: 'Ski jump', note: 'a ski jump with a tower and a landing hill' },
  weather: { name: 'Weather station', note: 'a weather station with a radar dome on the summit' },
  igloo: { name: 'Igloo village', note: 'a little village of igloos with a campfire' },
  panorama: { name: 'Panorama restaurant', note: 'a round glass restaurant on the summit' },
  glacier: { name: 'Glacier', note: 'a blue glacier with ice towers below the summit' },
  observatory: { name: 'Observatory', note: 'a star observatory with a big dome on the summit' },
  skywalk: { name: 'Skywalk', note: 'a glass platform out over the cliff, with a flag' },
};

const LIST = [
  { id: 'sunny', name: 'Sonnenhang', tag: 'Gentle and friendly', special: 'cross',
    seed: 1871, H: 22, curve: 1.6, narrow: 0.3, ridge: 0.13, rib: 0.05, band: 0.03, treeline: 0.72, flip: false, spread: 1 },
  { id: 'alpine', name: 'Gamshorn', tag: 'Big alpine terrain', special: 'jump',
    seed: 4242, H: 31, curve: 1.7, narrow: 0.45, ridge: 0.26, rib: 0.08, band: 0.05, treeline: 0.6, flip: true, spread: 1.2 },
  { id: 'storm', name: 'Wetterspitz', tag: 'Steep and stormy', special: 'weather',
    seed: 9007, H: 38, curve: 1.8, narrow: 0.5, ridge: 0.3, rib: 0.1, band: 0.06, treeline: 0.5, flip: false, spread: 1.35 },
  { id: 'firn', name: 'Firnhorn', tag: 'Deep snow and quiet woods', special: 'igloo',
    seed: 3313, H: 44, curve: 1.75, narrow: 0.42, ridge: 0.22, rib: 0.07, band: 0.04, treeline: 0.55, flip: true, spread: 1.3 },
  { id: 'eagle', name: 'Adlerhorn', tag: 'Where the eagles fly', special: 'panorama',
    seed: 5150, H: 50, curve: 1.85, narrow: 0.5, ridge: 0.28, rib: 0.09, band: 0.06, treeline: 0.48, flip: false, spread: 1.4 },
  { id: 'glacier', name: 'Gletscherkrone', tag: 'Ice up high', special: 'glacier',
    seed: 7777, H: 55, curve: 1.9, narrow: 0.52, ridge: 0.3, rib: 0.1, band: 0.07, treeline: 0.44, flip: true, spread: 1.4 },
  { id: 'stars', name: 'Sternenhorn', tag: 'Closer to the stars', special: 'observatory',
    seed: 2468, H: 60, curve: 1.95, narrow: 0.55, ridge: 0.3, rib: 0.11, band: 0.07, treeline: 0.42, flip: false, spread: 1.45 },
  { id: 'sky', name: 'Himmelsspitz', tag: 'The top of the world', special: 'skywalk',
    seed: 8642, H: 65, curve: 2.0, narrow: 0.56, ridge: 0.32, rib: 0.12, band: 0.08, treeline: 0.4, flip: true, spread: 1.45 },
];

const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

// The mountain for a level. After the last one the list starts over with new seeds, a second
// round of names, and every mountain still a little higher than the one before.
export function mapAt(level) {
  const n = LIST.length, m = LIST[level % n], round = Math.floor(level / n);
  if (!round) return { ...m, peak: m.H * 1.12 };
  const top = LIST[n - 1].H, steps = level - (n - 1);
  return { ...m, id: m.id + round, name: m.name + (ROMAN[round] || ' ' + (round + 1)), seed: m.seed + round * 1013,
    H: top + 18 * (1 - Math.pow(0.9, steps)), peak: (top + 18 * (1 - Math.pow(0.9, steps))) * 1.12 };
}

export const MAPS = LIST;

// The summit in metres, for the signs: 1 tile of height is 50 m, the valley floor is at 800 m.
export const summitM = (map) => Math.round((800 + (map.peak || map.H * 1.12) * 50) / 10) * 10;
