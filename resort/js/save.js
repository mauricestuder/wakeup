// First Chair: turning the game into plain data and back.
// Guests are not saved: after a reload the mountain is empty and the rest of the day's guests still arrive.

const LIFT = ['id', 'type', 'a', 'b', 'open', 'cost', 'name'];
const PISTE = ['id', 'wps', 'cost', 'name', 'wear', 'runs', 'runsYesterday'];
const BUILDING = ['id', 'type', 'x', 'z', 'cost', 'rot'];
const TOP = ['v', 'mapId', 'sandbox', 'day', 'clock', 'phase', 'closing', 'money', 'loan', 'ticket', 'food', 'snow', 'weather', 'forecast',
  'rating', 'nextId', 'cleared', 'unlocks', 'goals', 'best', 'today', 'history', 'last', 'rng', 'arrivals', 'arrIdx'];

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

export function toSave(state) {
  const out = pick(state, TOP);
  out.lifts = state.lifts.map((l) => pick(l, LIFT));
  out.pistes = state.pistes.map((p) => pick(p, PISTE));
  out.buildings = state.buildings.map((b) => pick(b, BUILDING));
  return JSON.parse(JSON.stringify(out));
}

// Returns a state ready for attach(), or null if the data is not a usable save.
export function fromSave(data) {
  if (!data || typeof data !== 'object' || data.v !== 1 || !Array.isArray(data.lifts)) return null;
  const state = JSON.parse(JSON.stringify(data));
  state.guests = [];
  state.events = [];
  return state;
}
