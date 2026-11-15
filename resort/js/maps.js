// First Chair: the three mountains.
// H = summit height in tiles, curve = how much steeper it gets towards the top,
// narrow = how much the massif narrows, ridge = strength of ridges and gullies,
// crowd = how many guests the region sends, weather = chances per day.

export const MAPS = [
  { id: 'sunny', name: 'Sonnenhang', tag: 'Gentle and friendly',
    text: 'Wide, easy slopes and steady weather. The place to learn the business.',
    seed: 1871, H: 20, curve: 2.1, narrow: 0.3, ridge: 0.1, treeline: 0.72,
    crowd: 115, money: 45000, snow: 24,
    weather: { sun: 4, cloud: 3, snow: 2, storm: 0.3, thaw: 0.7 },
    unlocked: ['drag', 'piste', 'hut', 'rental'] },
  { id: 'alpine', name: 'Gamshorn', tag: 'Big alpine terrain',
    text: 'Higher, steeper and split by ridges. Room for a real ski area, if you can connect it.',
    seed: 4242, H: 31, curve: 2.2, narrow: 0.45, ridge: 0.22, treeline: 0.6,
    crowd: 135, money: 55000, snow: 20, needs: 3,
    weather: { sun: 3, cloud: 3, snow: 2.5, storm: 0.8, thaw: 0.7 },
    unlocked: ['drag', 'piste', 'hut', 'rental', 'chair', 'firstaid'] },
  { id: 'storm', name: 'Wetterspitz', tag: 'Steep and stormy',
    text: 'Brutal faces, thin snow in the valley and storms that shut the high lifts.',
    seed: 9007, H: 38, curve: 2.4, narrow: 0.5, ridge: 0.26, treeline: 0.5,
    crowd: 150, money: 60000, snow: 10, needs: 4,
    weather: { sun: 2.5, cloud: 3, snow: 2.5, storm: 1.6, thaw: 1.4 },
    unlocked: ['drag', 'piste', 'hut', 'rental', 'chair', 'firstaid', 'cannon', 'groomer'] },
];

export const mapById = (id) => MAPS.find((m) => m.id === id) || MAPS[0];
