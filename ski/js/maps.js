// The maps: each run from the lobby drops you on one of these, so the
// mountain is a little different every time. A map sets the park layout
// (seed), the backcountry, how many trees and rocks, how steep and bumpy the
// slope is, and the light and weather. The halfpipe, ski jump, boardercross
// and moguls are the same on every map.
//
// sky: top colour, horizon colour, sun colour, cloud cover (0-1), stars (0-1)
// sun: direction the light comes from; light: sun and sky light strength
// fog: [near, far]; snow: falling snow (0-1); tint: snow colour multiplier

export const MAPS = [
  {
    id: 'classic', name: 'Bluebird', desc: 'The home mountain on a perfect day', park: 'classic', seed: 7,
    slope: 1, rough: 1, trees: 0.52, rocks: 260,
    sky: { top: 0x2763c4, horizon: 0xd9e6f3, sun: 0xfff1dc, clouds: 0.52, stars: 0 },
    sun: [-40, 60, 70], light: { sun: 2.1, hemi: 0.95, sky: 0xcfe2ff, ground: 0x4f6a96, exposure: 1.05 },
    fog: [260, 1500], snow: 0.3, tint: [1, 1, 1],
  },
  {
    id: 'golden', name: 'Golden Hour', desc: 'Low sun, long shadows, last laps', seed: 101,
    slope: 0.95, rough: 1.1, trees: 0.5, rocks: 300,
    sky: { top: 0x3a4f9a, horizon: 0xf3d2b4, sun: 0xffd6a8, clouds: 0.6, stars: 0 },
    sun: [-90, 34, 40], light: { sun: 1.7, hemi: 0.95, sky: 0xe4e2f2, ground: 0x56557a, exposure: 1.0 },
    fog: [240, 1400], snow: 0, tint: [1.0, 0.98, 0.96], cloudTint: [1, 0.88, 0.8], ridge: [1.02, 0.93, 0.86],
  },
  {
    id: 'powder', name: 'Powder Day', desc: 'Grey sky, deep snow, it will not stop', seed: 202,
    slope: 1.05, rough: 1.25, trees: 0.47, rocks: 200,
    sky: { top: 0x8e9db2, horizon: 0xd4dbe4, sun: 0xffffff, clouds: 0.95, stars: 0 },
    sun: [-20, 80, 40], light: { sun: 1.1, hemi: 1.35, sky: 0xe6edf6, ground: 0x7d8ba0, exposure: 1.1 },
    fog: [120, 760], snow: 1, tint: [0.98, 0.99, 1.02], cloudTint: [0.88, 0.9, 0.93], ridge: [0.9, 0.91, 0.94],
  },
  {
    id: 'alpenglow', name: 'Alpenglow', desc: 'Pink peaks as the sun goes down', seed: 303,
    slope: 1, rough: 0.9, trees: 0.55, rocks: 280,
    sky: { top: 0x3b3a85, horizon: 0xf2b3c4, sun: 0xffb8c0, clouds: 0.45, stars: 0.15 },
    sun: [70, 26, 60], light: { sun: 1.6, hemi: 0.9, sky: 0xe6d6e8, ground: 0x4a4370, exposure: 1.02 },
    fog: [240, 1400], snow: 0, tint: [1.01, 0.97, 1.0], cloudTint: [1, 0.82, 0.9], ridge: [1.04, 0.87, 0.95],
  },
  {
    id: 'night', name: 'Moonlight', desc: 'Stars out, the slope all to yourself', seed: 404,
    slope: 0.97, rough: 1, trees: 0.53, rocks: 240,
    sky: { top: 0x070d22, horizon: 0x24345a, sun: 0xcfe0ff, clouds: 0.25, stars: 1 },
    sun: [50, 55, -60], light: { sun: 1.25, hemi: 1.2, sky: 0x8fa8e0, ground: 0x1d2742, exposure: 1.15 },
    fog: [180, 1100], snow: 0.15, tint: [0.86, 0.9, 1.05], cloudTint: [0.22, 0.27, 0.4], ridge: [0.34, 0.4, 0.58],
  },
  {
    id: 'pines', name: 'Pine Valley', desc: 'Thick forest right up to the lane', seed: 505,
    slope: 0.93, rough: 0.85, trees: 0.42, treeMax: 3600, rocks: 140,
    sky: { top: 0x2f70cf, horizon: 0xdcebf5, sun: 0xfff6e6, clouds: 0.4, stars: 0 },
    sun: [-60, 70, 30], light: { sun: 2.0, hemi: 0.95, sky: 0xd6ead8, ground: 0x4c6a5a, exposure: 1.05 },
    fog: [220, 1300], snow: 0.2, tint: [1, 1, 0.98],
  },
  {
    id: 'glacier', name: 'Glacier', desc: 'High alpine: rock, ice and big drops', seed: 606,
    slope: 1.08, rough: 1.5, trees: 0.66, rocks: 520, cliffs: 7,
    sky: { top: 0x174fae, horizon: 0xcfe6f5, sun: 0xffffff, clouds: 0.2, stars: 0 },
    sun: [-30, 65, 80], light: { sun: 2.2, hemi: 1.0, sky: 0xcdeaff, ground: 0x4e6c9a, exposure: 1.05 },
    fog: [300, 1700], snow: 0, tint: [0.93, 1.0, 1.07],
  },
  {
    id: 'storm', name: 'Storm Front', desc: 'Dark clouds rolling in fast', seed: 707,
    slope: 1.02, rough: 1.15, trees: 0.5, rocks: 260,
    sky: { top: 0x3c4658, horizon: 0x9aa4b2, sun: 0xdfe6f0, clouds: 0.98, stars: 0 },
    sun: [-30, 70, 20], light: { sun: 1.0, hemi: 1.15, sky: 0xc2cad6, ground: 0x4d5666, exposure: 1.1 },
    fog: [100, 650], snow: 0.8, tint: [0.92, 0.94, 0.98], cloudTint: [0.5, 0.53, 0.58], ridge: [0.7, 0.72, 0.77],
  },
  {
    id: 'spring', name: 'Spring Slush', desc: 'Warm sun, soft snow, sunglasses on', seed: 808,
    slope: 0.9, rough: 0.8, trees: 0.56, rocks: 380,
    sky: { top: 0x3d8de0, horizon: 0xe8f1f6, sun: 0xfff8e8, clouds: 0.3, stars: 0 },
    sun: [-10, 80, 60], light: { sun: 2.3, hemi: 1.0, sky: 0xe8f1ff, ground: 0x6f7d8f, exposure: 1.1 },
    fog: [300, 1800], snow: 0, tint: [1.03, 1.0, 0.95],
  },
  {
    id: 'steep', name: 'The Steeps', desc: 'Steeper, faster, bigger everything', seed: 909,
    slope: 1.14, rough: 1.3, trees: 0.54, rocks: 340, cliffs: 6,
    sky: { top: 0x1b4db0, horizon: 0xd2e2f0, sun: 0xfff0d8, clouds: 0.5, stars: 0 },
    sun: [30, 55, 75], light: { sun: 2.1, hemi: 0.95, sky: 0xcfe2ff, ground: 0x4f6a96, exposure: 1.05 },
    fog: [260, 1500], snow: 0.25, tint: [0.98, 0.99, 1.02],
  },
];

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
