// Registry of wake-up challenges. Every challenge implements:
//   { id, label, mount(container, settings, { onPass, onActivity }), unmount() }
// `onActivity` resets the abandon timer; `onPass` advances the chain.

import { math } from './math.js';
import { typing } from './typing.js';
import { qr } from './qr.js';

export const challenges = { math, typing, qr };

export const CHALLENGE_IDS = Object.keys(challenges);
