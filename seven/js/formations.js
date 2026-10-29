// Formations: each slot has a role, a spot on the pitch (x/y in %, y=0 is the
// opponent's goal) and the positions it accepts. Playing someone in an
// accepted but not natural position costs a few rating points.

const ACCEPTS = {
  GK: ['GK'],
  CB: ['CB', 'DM'],
  LB: ['LB', 'RB', 'LW'],
  RB: ['RB', 'LB', 'RW'],
  DM: ['DM', 'CM', 'CB'],
  CM: ['CM', 'DM', 'AM'],
  AM: ['AM', 'CM', 'ST'],
  LW: ['LW', 'RW', 'AM'],
  RW: ['RW', 'LW', 'AM'],
  ST: ['ST', 'AM'],
};

const L = (role, x, y) => ({ role, x, y });

const SHAPES = {
  '4-3-3': [L('GK', 50, 92), L('LB', 14, 72), L('CB', 37, 76), L('CB', 63, 76), L('RB', 86, 72),
    L('CM', 26, 50), L('DM', 50, 57), L('CM', 74, 50), L('LW', 16, 24), L('ST', 50, 16), L('RW', 84, 24)],
  '4-4-2': [L('GK', 50, 92), L('LB', 14, 72), L('CB', 37, 76), L('CB', 63, 76), L('RB', 86, 72),
    L('LW', 13, 44), L('CM', 37, 50), L('CM', 63, 50), L('RW', 87, 44), L('ST', 36, 18), L('ST', 64, 18)],
  '4-2-3-1': [L('GK', 50, 92), L('LB', 14, 72), L('CB', 37, 76), L('CB', 63, 76), L('RB', 86, 72),
    L('DM', 36, 56), L('DM', 64, 56), L('LW', 16, 32), L('AM', 50, 35), L('RW', 84, 32), L('ST', 50, 13)],
  '3-5-2': [L('GK', 50, 92), L('CB', 26, 75), L('CB', 50, 78), L('CB', 74, 75), L('LB', 10, 48),
    L('CM', 32, 52), L('DM', 50, 60), L('CM', 68, 52), L('RB', 90, 48), L('ST', 36, 18), L('ST', 64, 18)],
  '5-3-2': [L('GK', 50, 92), L('LB', 10, 66), L('CB', 30, 76), L('CB', 50, 79), L('CB', 70, 76), L('RB', 90, 66),
    L('CM', 28, 48), L('DM', 50, 54), L('CM', 72, 48), L('ST', 36, 18), L('ST', 64, 18)],
  '3-4-3': [L('GK', 50, 92), L('CB', 26, 75), L('CB', 50, 78), L('CB', 74, 75), L('LB', 11, 50),
    L('CM', 37, 54), L('CM', 63, 54), L('RB', 89, 50), L('LW', 18, 22), L('ST', 50, 15), L('RW', 82, 22)],
};

export const FORMATIONS = Object.keys(SHAPES);

export function slotsFor(name) {
  return SHAPES[name].map((s, i) => ({ ...s, i, player: null }));
}

// Rating the player would have in this slot, or null if they can't play there.
export function fitRating(player, role) {
  if (player.pos.includes(role)) return player.r;
  if (!ACCEPTS[role].some((p) => player.pos.includes(p))) return null;
  return player.r - 4;
}

export const canPlay = (player, role) => fitRating(player, role) !== null;
