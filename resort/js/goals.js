// First Chair: goals. Each pays a bonus, some unlock new things to build.
import { LIFTS, BUILDINGS } from './tuning.js';

const diffs = (s) => new Set(s.pistes.map((p) => p.diff)).size;

export const GOALS = [
  { id: 'lift', text: 'Build your first lift', reward: 2000, test: (s) => s.lifts.length >= 1,
    hint: 'Tap Lift, then Drag lift. Tap a spot near the car park, then a spot further up the slope, and confirm.' },
  { id: 'piste', text: 'Build a piste from the top of the lift', reward: 2000, test: (s) => s.pistes.length >= 1,
    hint: 'Tap Piste. Tap next to the top station, add points downhill, end next to the bottom station, then Build.' },
  { id: 'runs', text: 'Let guests ski 10 runs', reward: 2000, test: (s) => s.best.runs >= 10,
    hint: 'Guests arrive in the morning. Press 4x to speed up time. A lift and a piste must touch at both ends.' },
  { id: 'hut', text: 'Build a ski hut', reward: 1500, test: (s) => s.buildings.some((b) => b.type === 'hut'),
    hint: 'Hungry guests get grumpy. Put a ski hut next to a piste or a lift station.' },
  { id: 'g40', text: 'Welcome 40 guests in one day', reward: 4000, unlock: ['chair', 'firstaid'], test: (s) => s.best.guests >= 40,
    hint: 'More and longer pistes, a fair ticket price and good weather bring more guests.' },
  { id: 'two', text: 'Offer pistes of two difficulties', reward: 3000, test: (s) => diffs(s) >= 2,
    hint: 'Steeper ground gives harder pistes. The colour shows while you draw.' },
  { id: 'stars2', text: 'Reach 2 stars', reward: 6000, unlock: ['cannon', 'groomer'], test: (s) => s.rating >= 2,
    hint: 'Stars come from happy guests, a variety of pistes and services like huts and rental.' },
  { id: 'g120', text: 'Welcome 120 guests in one day', reward: 8000, unlock: ['hotel'], test: (s) => s.best.guests >= 120,
    hint: 'One drag lift will not carry them. Add lifts so queues stay short.' },
  { id: 'black', text: 'Open a black piste', reward: 5000, test: (s) => s.pistes.some((p) => p.diff === 3),
    hint: 'Experts want it steep. Look near the summit, and use the Steepness overlay.' },
  { id: 'four', text: 'Offer all four difficulties', reward: 8000, test: (s) => diffs(s) >= 4,
    hint: 'Green, blue, red and black: something for everyone.' },
  { id: 'profit', text: 'Make 4,000 profit in one day', reward: 8000, test: (s) => s.best.profit >= 4000,
    hint: 'Watch the Finance panel. Empty lifts cost money every day.' },
  { id: 'stars3', text: 'Reach 3 stars', reward: 12000, unlock: ['gondola'], test: (s) => s.rating >= 3,
    hint: 'Read the complaints in the day summary and fix the biggest one.' },
  { id: 'g250', text: 'Welcome 250 guests in one day', reward: 15000, test: (s) => s.best.guests >= 250,
    hint: 'A hotel fills the mountain even on stormy days.' },
  { id: 'stars4', text: 'Reach 4 stars', reward: 25000, test: (s) => s.rating >= 4,
    hint: 'Groom the pistes, keep snow in the valley with cannons, and keep queues short.' },
  { id: 'stars5', text: 'Reach 5 stars: a legendary resort', reward: 50000, test: (s) => s.rating >= 4.75,
    hint: 'Everything has to be right: mood, variety and every service.' },
];

export const nameOf = (k) => (LIFTS[k] || BUILDINGS[k] || { name: k }).name;

// Which goal unlocks a thing, for the lock text in the build menu.
export function unlockedBy(k) {
  const g = GOALS.find((x) => x.unlock && x.unlock.includes(k));
  return g ? g.text : '';
}

export function checkGoals(state) {
  for (const g of GOALS) {
    if (state.goals[g.id] || !g.test(state)) continue;
    state.goals[g.id] = state.day;
    if (!state.sandbox) state.money += g.reward;
    state.today.income.bonus += g.reward;
    for (const k of g.unlock || []) state.unlocks[k] = 1;
    state.events.push({ type: 'goal', goal: g });
  }
}

export const currentGoal = (state) => GOALS.find((g) => !state.goals[g.id]) || null;
