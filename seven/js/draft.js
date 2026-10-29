// Draft state: spin a nation + year, take one player from it into an open
// slot, repeat until the XI is full. Each squad can only be drawn once.

import { SQUADS } from './data.js';
import { slotsFor, canPlay } from './formations.js';

export const REROLLS = 3;

export function newDraft(formation) {
  return { formation, slots: slotsFor(formation), used: new Set(), rerolls: REROLLS, current: null, skipped: [] };
}

export const openSlots = (d) => d.slots.filter((s) => !s.player);
export const isFull = (d) => openSlots(d).length === 0;
export const slotsForPlayer = (d, p) => openSlots(d).filter((s) => canPlay(p, s.role));
export const fits = (d, p) => slotsForPlayer(d, p).length > 0;

// Draw a squad that has at least one player for the open slots. Squads with
// nobody useful are skipped for free (and reported so the UI can say so).
export function spin(d) {
  d.skipped = [];
  const pool = SQUADS.filter((s) => !d.used.has(s.id) && s !== d.current);
  while (pool.length) {
    const s = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (s.players.some((p) => fits(d, p))) return (d.current = s);
    d.skipped.push(s);
  }
  return (d.current = null);
}

export function reroll(d) {
  if (d.rerolls <= 0 || !d.current) return null;
  d.rerolls--;
  return spin(d);
}

export function place(d, player, slot) {
  if (!d.current || slot.player || !canPlay(player, slot.role)) return false;
  slot.player = player;
  d.used.add(d.current.id);
  d.current = null;
  return true;
}
