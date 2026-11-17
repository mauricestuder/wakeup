// Idle Lift: the three mountains.
// H = summit height in tiles, curve = how much steeper it gets towards the top,
// narrow = how much the massif narrows, ridge = strength of ridges and gullies.
// flip mirrors the lift plan left to right, spread widens it.

export const MAPS = [
  { id: 'sunny', name: 'Sonnenhang', tag: 'Gentle and friendly',
    seed: 1871, H: 22, curve: 1.6, narrow: 0.3, ridge: 0.13, rib: 0.05, band: 0.03, treeline: 0.72, flip: false, spread: 1 },
  { id: 'alpine', name: 'Gamshorn', tag: 'Big alpine terrain',
    seed: 4242, H: 31, curve: 1.7, narrow: 0.45, ridge: 0.26, rib: 0.08, band: 0.05, treeline: 0.6, flip: true, spread: 1.2 },
  { id: 'storm', name: 'Wetterspitz', tag: 'Steep and stormy',
    seed: 9007, H: 38, curve: 1.8, narrow: 0.5, ridge: 0.3, rib: 0.1, band: 0.06, treeline: 0.5, flip: false, spread: 1.35 },
];
