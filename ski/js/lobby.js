import { outfitIcon } from './skins.js';
// The lobby: the rider on show, PLAY with a mode picker, a locker for
// characters, outfits and trails, an item shop paid in snowflakes (earned
// from run points), and settings. Progress is kept in localStorage.

// ---------- catalogue ----------

export const RARITY = {
  common: { name: 'Common', c: '#7b8a9e' },
  uncommon: { name: 'Uncommon', c: '#4fb83a' },
  rare: { name: 'Rare', c: '#2f8cff' },
  epic: { name: 'Epic', c: '#a64dff' },
  legendary: { name: 'Legendary', c: '#ff9324' },
  mythic: { name: 'Mythic', c: '#d8d8d8' },
};

// Outfit fields: jacket, pants, gear (skis/board), accent (zip, stripe), trim
// (collar, cuffs, belt, gaiters), helmet, lens; pat = pattern per part, alt =
// second pattern colour per part, glow = parts that light up, flat = no
// shading. grants = items that come with it (a bundle).
export const ITEMS = [
  // Characters (the head)
  { id: 'rider', type: 'character', name: 'Rider', rarity: 'common', price: 0, icon: '⛑️', desc: 'Helmet on, goggles down.' },
  { id: 'beanie', type: 'character', name: 'Beanie Local', rarity: 'uncommon', price: 2000, icon: '🧶', desc: 'Pompom beanie, lift-line legend.' },
  { id: 'cap', type: 'character', name: 'Backwards Cap', rarity: 'uncommon', price: 2000, icon: '🧢', desc: 'Park lap energy.' },
  { id: 'bear', type: 'character', name: 'Bear Hood', rarity: 'rare', price: 5000, icon: '🐻', desc: 'Warm ears, wild steeze.' },
  { id: 'penguin', type: 'character', name: 'Penguin', rarity: 'epic', price: 12000, icon: '🐧', desc: 'Born on the ice.' },
  { id: 'yeti', type: 'character', name: 'Yeti', rarity: 'legendary', price: 25000, icon: '🦣', desc: 'The mountain sends its best.' },
  // Outfits
  { id: 'classic', type: 'skin', name: 'Classic', rarity: 'common', price: 0, desc: 'The one you started in.',
    skin: { jacket: 0xff4f1f, pants: 0x22303f, gear: 0x1e88e5, accent: 0xffcf33, trim: 0x1a1f28, pat: { gear: 'band' }, alt: { gear: 0x0d47a1 } } },
  { id: 'glacier', type: 'skin', name: 'Glacier', rarity: 'uncommon', price: 2000, desc: 'Ice blue with a frosted chest band.',
    skin: { jacket: 0x4fc3f7, pants: 0xe8f1f8, gear: 0xffffff, accent: 0x0277bd, trim: 0x01579b, helmet: 0xe1f5fe, lens: 0x4fc3f7,
      pat: { jacket: 'band', gear: 'gradient' }, alt: { jacket: 0xe1f5fe, gear: 0x81d4fa } } },
  { id: 'polar', type: 'skin', name: 'Polar', rarity: 'uncommon', price: 2000, desc: 'Rescue-team red and white.',
    skin: { jacket: 0xf4f6fa, pants: 0xc62828, gear: 0xd32f2f, accent: 0x212121, trim: 0xb71c1c, helmet: 0xd32f2f,
      pat: { jacket: 'split', gear: 'split' }, alt: { jacket: 0xc62828, gear: 0xf4f6fa } } },
  { id: 'candy', type: 'skin', name: 'Candy Cane', rarity: 'uncommon', price: 2500, desc: 'Sweet stripes, sharp edges.',
    skin: { jacket: 0xfff0f5, pants: 0xff6fa5, gear: 0xff6fa5, accent: 0xff2d6f, trim: 0xffffff, helmet: 0xffc2d9, lens: 0xff6fa5,
      pat: { jacket: 'candy', gear: 'candy' }, alt: { jacket: 0xff4f8b, gear: 0xffffff } } },
  { id: 'camo', type: 'skin', name: 'Backcountry Camo', rarity: 'rare', price: 5000, desc: 'Disappear into the trees.',
    skin: { jacket: 0x5b6b3a, pants: 0x4a4030, gear: 0x6b7b45, accent: 0xd9c27a, trim: 0x2b2a1e, helmet: 0x4b5a30, lens: 0xd9c27a,
      pat: { jacket: 'camo', pants: 'camo', gear: 'camo' }, alt: { jacket: 0x8a8a5a, pants: 0x6b5f45, gear: 0x3c4a25 } } },
  { id: 'checker', type: 'skin', name: 'Checkmate', rarity: 'rare', price: 5000, desc: 'Black, white, a flash of red.',
    skin: { jacket: 0x111111, pants: 0x111111, gear: 0xf4f4f4, accent: 0xff1744, trim: 0xff1744, helmet: 0x111111, lens: 0xff1744,
      pat: { jacket: 'check', gear: 'check' }, alt: { jacket: 0xf4f4f4, gear: 0x111111 } } },
  { id: 'tiger', type: 'skin', name: 'Tiger', rarity: 'rare', price: 6000, desc: 'Stripes earned on the steeps.',
    skin: { jacket: 0xff8f1f, pants: 0x1b1b1b, gear: 0xff8f1f, accent: 0xfff3e0, trim: 0x1b1b1b, helmet: 0xff8f1f, lens: 0xffe082,
      pat: { jacket: 'tiger', gear: 'tiger' }, alt: { jacket: 0x161616, gear: 0x161616 } } },
  { id: 'retro', type: 'skin', name: "Retro '86", rarity: 'rare', price: 6500, desc: 'Teal, purple and too much attitude.',
    skin: { jacket: 0x00bfa5, pants: 0x4a148c, gear: 0xff4081, accent: 0xff4081, trim: 0xffeb3b, helmet: 0xffffff, lens: 0xff4081,
      pat: { jacket: 'split', pants: 'split', gear: 'band' }, alt: { jacket: 0x7c4dff, pants: 0x00bfa5, gear: 0x00bfa5 } } },
  { id: 'midnight', type: 'skin', name: 'Midnight Circuit', rarity: 'epic', price: 12000, desc: 'Circuit lines that glow in the dark.',
    skin: { jacket: 0x141a33, pants: 0x0b0d18, gear: 0x141a33, accent: 0x00e5ff, trim: 0x7c4dff, helmet: 0x141a33, lens: 0x00e5ff,
      pat: { jacket: 'circuit', pants: 'circuit', gear: 'circuit' }, glow: ['jacket', 'pants', 'gear', 'accent', 'trim'] } },
  { id: 'sunset', type: 'skin', name: 'Sunset', rarity: 'epic', price: 12000, desc: 'Last chair, golden hour.',
    skin: { jacket: 0xff6e40, pants: 0x4a1e6e, gear: 0xff6e40, accent: 0xffd54f, trim: 0x311b92, helmet: 0xffd54f, lens: 0xff4081,
      pat: { jacket: 'gradient', pants: 'gradient', gear: 'gradient' }, alt: { jacket: 0xffd54f, pants: 0x7b1fa2, gear: 0xffd54f } } },
  { id: 'neon', type: 'skin', name: 'Neon Rush', rarity: 'epic', price: 14000, desc: 'Turn it up.',
    skin: { jacket: 0x39ff14, pants: 0x1b1b1b, gear: 0x1b1b1b, accent: 0xff00e5, trim: 0x00f0ff, helmet: 0x1b1b1b, lens: 0x39ff14,
      pat: { jacket: 'band', gear: 'band' }, alt: { jacket: 0x1b1b1b, gear: 0x39ff14 }, glow: ['jacket', 'gear', 'accent', 'trim'] } },
  { id: 'lava', type: 'skin', name: 'Lava', rarity: 'epic', price: 15000, desc: 'Flames lick up from the boots.',
    skin: { jacket: 0x1c1010, pants: 0x1c1010, gear: 0x1c1010, accent: 0xffea00, trim: 0xff3d00, helmet: 0x1c1010, lens: 0xff6d00,
      pat: { jacket: 'flames', pants: 'flames', gear: 'flames' }, alt: { jacket: 0xff3d00, pants: 0xff3d00, gear: 0xff3d00 }, glow: ['jacket', 'pants', 'gear', 'trim'] } },
  { id: 'toxic', type: 'skin', name: 'Toxic', rarity: 'epic', price: 15000, desc: 'Do not lick the rail.',
    skin: { jacket: 0x2a2a35, pants: 0x2a2a35, gear: 0x2a2a35, accent: 0x76ff03, trim: 0x76ff03, helmet: 0x76ff03, lens: 0x76ff03,
      pat: { jacket: 'drip', pants: 'drip', gear: 'drip' }, glow: ['jacket', 'pants', 'gear', 'trim'] } },
  { id: 'galaxy', type: 'skin', name: 'Galaxy', rarity: 'legendary', price: 28000, desc: 'A whole night sky to wear.',
    skin: { jacket: 0x1a0b3d, pants: 0x0d0626, gear: 0x1a0b3d, accent: 0xb388ff, trim: 0xb388ff, helmet: 0x1a0b3d, lens: 0xb388ff,
      pat: { jacket: 'stars', pants: 'stars', gear: 'stars' }, alt: { jacket: 0x3d1a78, pants: 0x1a0b3d, gear: 0x0a3d78 }, glow: ['jacket', 'pants', 'gear', 'trim'], glowK: 1 } },
  { id: 'gold', type: 'skin', name: 'Golden Legend', rarity: 'legendary', price: 30000, desc: 'Polished gold. Everyone will look.',
    skin: { jacket: 0xffc933, pants: 0x3a2c0c, gear: 0xffc933, accent: 0xfff3b0, trim: 0xffe082, helmet: 0xffd54f, lens: 0x3a2c0c,
      pat: { jacket: 'sparkle', gear: 'sparkle' }, glow: ['jacket', 'gear'], glowK: 0.5 } },
  { id: 'void', type: 'skin', name: 'Void', rarity: 'mythic', price: 1000000000, grants: ['trail:void'],
    desc: 'Pure darkness. No colour, no shine, no light. Comes with the Void Trail.',
    skin: { jacket: 0x000000, pants: 0x000000, gear: 0x000000, accent: 0x000000, trim: 0x000000, helmet: 0x000000, lens: 0x000000,
      pat: { jacket: 'void', pants: 'void', gear: 'void' }, flat: true } },
  // Trails
  { id: 'none', type: 'trail', name: 'No Trail', rarity: 'common', price: 0, bar: ['#3a4658', '#3a4658'] },
  { id: 'frost', type: 'trail', name: 'Frost', rarity: 'uncommon', price: 2000, bar: ['#ffffff', '#9fe8ff'] },
  { id: 'ember', type: 'trail', name: 'Ember', rarity: 'rare', price: 5000, bar: ['#ffe14d', '#ff3d00'] },
  { id: 'neon', type: 'trail', name: 'Neon Streak', rarity: 'rare', price: 5000, bar: ['#ff4dff', '#7c4dff'], tid: 'neon' },
  { id: 'shadow', type: 'trail', name: 'Shadow', rarity: 'epic', price: 12000, bar: ['#2a1640', '#0a0412'] },
  { id: 'rainbow', type: 'trail', name: 'Rainbow', rarity: 'epic', price: 12000, bar: ['#ff4d4d', '#ffd84d', '#4dff88', '#4dc3ff', '#b84dff'] },
  { id: 'goldtrail', type: 'trail', name: 'Gold Dust', rarity: 'legendary', price: 25000, bar: ['#fff3b0', '#ffb300'], tid: 'gold' },
  { id: 'void', type: 'trail', name: 'Void Trail', rarity: 'mythic', price: 1000000000, bar: ['#000', '#000'], grants: ['skin:void'],
    desc: 'A line of pure darkness. Comes with the Void outfit.' },
];

const byKey = (type, id) => ITEMS.find((i) => i.type === type && i.id === id);
const key = (it) => it.type + ':' + it.id;
export const trailId = (id) => { const it = byKey('trail', id); return it ? it.tid || it.id : 'none'; };
export const skinOf = (id) => (byKey('skin', id) || byKey('skin', 'classic')).skin;

const TYPE_NAME = { character: 'Character', skin: 'Outfit', trail: 'Trail' };

export const MODES = [
  { id: 'summit', name: 'Summit', desc: 'The full mountain, top to bottom', c: ['#ff7a1a', '#c2410c'] },
  { id: 'park', name: 'Park', desc: 'Kickers, rails and boxes', c: ['#2f8cff', '#1550a8'] },
  { id: 'pro', name: 'Pro Line', desc: 'Step-up, hip and big air', c: ['#1c2433', '#ffb300'] },
  { id: 'pipe', name: 'Halfpipe', desc: 'Superpipe airs', c: ['#ff3d81', '#8a1c4b'] },
  { id: 'backcountry', name: 'Backcountry', desc: 'Trees, cliffs and pillows', c: ['#2e7d4f', '#123b26'] },
  { id: 'jump', name: 'Ski Jump', boardName: 'Big Jump', desc: 'Distance and style', c: ['#4dc3ff', '#1e5aa8'] },
  { id: 'cross', name: 'Boardercross', desc: 'Berms and rollers', c: ['#a64dff', '#4a1d8a'] },
];

// ---------- profile ----------

const SAVE = 'freshline.profile';
const DEFAULT = {
  coins: 0, owned: ['character:rider', 'skin:classic', 'trail:none'],
  equip: { character: 'rider', skin: 'classic', trail: 'none' },
  mode: 'park', board: false,
  settings: { name: 'RIDER', volume: 0.8, keys: true, shake: true, quality: 'high', snowfall: true },
};
export const profile = (() => {
  const p = load();
  // Items that were removed from the game fall back to the defaults.
  for (const t of ['character', 'skin', 'trail']) if (!byKey(t, p.equip[t])) p.equip[t] = DEFAULT.equip[t];
  p.owned = p.owned.filter((k) => ITEMS.some((i) => key(i) === k));
  return p;
})();
function load() {
  try {
    const p = JSON.parse(localStorage.getItem(SAVE));
    if (p) return { ...DEFAULT, ...p, equip: { ...DEFAULT.equip, ...p.equip }, settings: { ...DEFAULT.settings, ...p.settings } };
  } catch { /* fresh start */ }
  return JSON.parse(JSON.stringify(DEFAULT));
}
export function saveProfile() { try { localStorage.setItem(SAVE, JSON.stringify(profile)); } catch { /* private mode */ } }
const owns = (it) => it.price === 0 || profile.owned.includes(key(it));

// Snowflakes for a run: one for every 20 points.
export const flakesFor = (score) => Math.floor(score / 20);

// ---------- UI ----------

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const fmt = (n) => n.toLocaleString();
const FLAKE = '<i class="flake">❄</i>';

function icon(it) {
  if (it.type === 'character') return `<div class="ico emoji">${it.icon}</div>`;
  if (it.type === 'skin') {
    return `<img class="ico fig" alt="" src="${outfitIcon(it.id, it.skin)}">`;
  }
  return `<div class="ico bar" style="background:linear-gradient(90deg,${it.bar.join(',')})"></div>`;
}

function card(it, opts = {}) {
  const r = RARITY[it.rarity];
  const c = el('button', 'card r-' + it.rarity + (opts.big ? ' big' : ''));
  c.style.setProperty('--rc', r.c);
  const equipped = profile.equip[it.type] === it.id;
  let foot = '';
  if (opts.shop) foot = owns(it) ? '<div class="price owned">OWNED</div>' : `<div class="price">${FLAKE}${fmt(it.price)}</div>`;
  c.innerHTML = `${icon(it)}<div class="name">${it.name}</div><div class="kind">${TYPE_NAME[it.type]}</div>${foot}` +
    (equipped && !opts.shop ? '<div class="check">✓</div>' : '');
  return c;
}

export function initLobby(api) {
  // api: { skier, setGear(board), play(mode), best(), applySettings(s), setTrailPreview(id) }
  const root = $('#lobby');
  let tab = 'play', lockerCat = 'character', selected = null;

  const coinsEl = $('#coins', root);
  const refreshCoins = () => { coinsEl.textContent = fmt(profile.coins); };

  // Showing an item on the rider (for a moment in the shop, or equipped).
  function wear(char, skin, trail) {
    api.skier.applyLook(skinOf(skin), char, skin);
    api.setTrailPreview(trailId(trail));
  }
  const wearEquipped = () => wear(profile.equip.character, profile.equip.skin, profile.equip.trail);
  function preview(it) {
    const e = profile.equip;
    wear(it.type === 'character' ? it.id : e.character, it.type === 'skin' ? it.id : e.skin, it.type === 'trail' ? it.id : e.trail);
  }

  // Tabs
  for (const b of root.querySelectorAll('[data-tab]')) b.addEventListener('click', () => setTab(b.dataset.tab));
  function setTab(t) {
    tab = t;
    for (const b of root.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === t);
    for (const p of root.querySelectorAll('[data-pane]')) p.hidden = p.dataset.pane !== t;
    root.dataset.tab = t;
    selected = null;
    wearEquipped();
    if (t === 'locker') drawLocker();
    if (t === 'shop') drawShop();
    if (t === 'play') drawPlay();
  }

  // ----- play -----
  const modeName = (m) => (profile.board && m.boardName) || m.name;
  function drawPlay() {
    const m = MODES.find((x) => x.id === profile.mode) || MODES[1];
    const mc = $('#modeCard', root);
    mc.style.background = `linear-gradient(135deg, ${m.c[0]}, ${m.c[1]})`;
    $('#modeName', root).textContent = modeName(m);
    $('#modeDesc', root).textContent = m.desc;
    $('#playerName', root).textContent = profile.settings.name || 'RIDER';
    const ch = byKey('character', profile.equip.character), sk = byKey('skin', profile.equip.skin);
    $('#playerLook', root).textContent = `${ch.name} · ${sk.name}`;
    const best = api.best();
    $('#playerBest', root).innerHTML = best ? `Best run <b>${fmt(best)}</b>` : 'No runs yet';
    for (const b of root.querySelectorAll('[data-gear]')) b.classList.toggle('on', (b.dataset.gear === 'board') === profile.board);
  }
  for (const b of root.querySelectorAll('[data-gear]')) b.addEventListener('click', () => {
    profile.board = b.dataset.gear === 'board'; saveProfile();
    api.setGear(profile.board); drawPlay();
  });
  $('#playBtn', root).addEventListener('click', () => api.play(profile.mode));
  $('#modeCard', root).addEventListener('click', openModes);
  function openModes() {
    const ov = $('#modes', root), grid = $('.modegrid', ov);
    grid.innerHTML = '';
    for (const m of MODES) {
      const t = el('button', 'modetile' + (m.id === profile.mode ? ' on' : ''), `<b>${modeName(m)}</b><span>${m.desc}</span>`);
      t.style.background = `linear-gradient(135deg, ${m.c[0]}, ${m.c[1]})`;
      t.addEventListener('click', () => { profile.mode = m.id; saveProfile(); ov.hidden = true; drawPlay(); });
      grid.append(t);
    }
    ov.hidden = false;
  }
  $('#modesClose', root).addEventListener('click', () => { $('#modes', root).hidden = true; });

  // ----- locker -----
  for (const b of root.querySelectorAll('[data-cat]')) b.addEventListener('click', () => { lockerCat = b.dataset.cat; drawLocker(); });
  function drawLocker() {
    for (const b of root.querySelectorAll('[data-cat]')) b.classList.toggle('on', b.dataset.cat === lockerCat);
    const grid = $('#lockerGrid', root);
    grid.innerHTML = '';
    const list = ITEMS.filter((i) => i.type === lockerCat);
    for (const it of list) {
      const c = card(it);
      if (!owns(it)) {
        c.classList.add('locked');
        c.insertAdjacentHTML('beforeend', `<div class="lock">🔒 ${FLAKE}${fmt(it.price)}</div>`);
        c.addEventListener('click', () => { setTab('shop'); select(it); });
      } else c.addEventListener('click', () => { profile.equip[it.type] = it.id; saveProfile(); wearEquipped(); drawLocker(); });
      grid.append(c);
    }
    const n = list.filter(owns).length;
    $('#lockerCount', root).textContent = `${n} / ${list.length} owned`;
  }

  // ----- shop -----
  // Two featured items change every day; everything else is always on sale.
  function featured() {
    const day = Math.floor(Date.now() / 864e5);
    const pool = ITEMS.filter((i) => i.rarity === 'epic' || i.rarity === 'legendary');
    const a = pool[(day * 7) % pool.length], b = pool[(day * 7 + 3) % pool.length];
    return a === b ? [a] : [a, b];
  }
  function drawShop() {
    const box = $('#shopList', root);
    box.innerHTML = '';
    const sec = (title, items, big) => {
      const s = el('div', 'shopsec', `<h3>${title}</h3>`);
      const g = el('div', 'grid' + (big ? ' feat' : ''));
      for (const it of items) {
        const c = card(it, { shop: true, big });
        c.addEventListener('click', () => select(it));
        if (selected === it) c.classList.add('sel');
        g.append(c);
      }
      s.append(g);
      box.append(s);
    };
    const hrs = 24 - new Date().getHours();
    sec('Mythic <small>one of a kind</small>', ITEMS.filter((i) => i.rarity === 'mythic' && i.type === 'skin'), true);
    sec(`Featured <small>new in ${hrs} h</small>`, featured(), true);
    sec('Characters', ITEMS.filter((i) => i.type === 'character' && i.price));
    sec('Outfits', ITEMS.filter((i) => i.type === 'skin' && i.price && i.rarity !== 'mythic'));
    sec('Trails', ITEMS.filter((i) => i.type === 'trail' && i.price && i.rarity !== 'mythic'));
    drawDetail();
  }
  function select(it) {
    selected = it;
    preview(it);
    drawShop();
  }
  function drawDetail() {
    const d = $('#detail', root);
    if (!selected) { d.hidden = true; return; }
    const it = selected, r = RARITY[it.rarity];
    d.hidden = false;
    d.style.setProperty('--rc', r.c);
    const have = owns(it), can = profile.coins >= it.price;
    d.innerHTML = `<div class="rar">${r.name} ${TYPE_NAME[it.type]}</div><div class="dname">${it.name}</div>` +
      (it.desc ? `<div class="ddesc">${it.desc}</div>` : '') +
      (have ? `<button class="buy owned" data-act="equip">${profile.equip[it.type] === it.id ? 'Equipped' : 'Equip'}</button>`
        : `<button class="buy" data-act="buy" ${can ? '' : 'disabled'}>${FLAKE}${fmt(it.price)}  Purchase</button>` +
          (can ? '' : `<div class="short">Need ${fmt(it.price - profile.coins)} more ❄ — ride to earn them</div>`)) +
      '<button class="close" data-act="close">✕</button>';
    d.querySelector('[data-act="close"]').addEventListener('click', () => { selected = null; wearEquipped(); drawShop(); });
    const act = d.querySelector('.buy');
    act.addEventListener('click', () => {
      if (act.dataset.act === 'buy') {
        if (profile.coins < it.price) return;
        profile.coins -= it.price;
        profile.owned.push(key(it), ...(it.grants || []));
        toast(`Unlocked ${it.name}!`, r.c);
      }
      profile.equip[it.type] = it.id;
      for (const g of it.grants || []) { const [t, id] = g.split(':'); profile.equip[t] = id; }
      saveProfile(); refreshCoins(); wearEquipped(); preview(it); drawShop();
    });
  }

  // ----- settings -----
  for (const b of root.querySelectorAll('[data-scat]')) b.addEventListener('click', () => {
    for (const x of root.querySelectorAll('[data-scat]')) x.classList.toggle('on', x === b);
    for (const p of root.querySelectorAll('[data-spane]')) p.hidden = p.dataset.spane !== b.dataset.scat;
  });
  const S = profile.settings;
  const bindToggle = (id, k) => {
    const t = $('#' + id, root);
    const draw = () => { t.classList.toggle('on', !!S[k]); t.querySelector('b').textContent = S[k] ? 'ON' : 'OFF'; };
    t.addEventListener('click', () => { S[k] = !S[k]; saveProfile(); draw(); api.applySettings(S); });
    draw();
  };
  bindToggle('setKeys', 'keys');
  bindToggle('setShake', 'shake');
  bindToggle('setSnow', 'snowfall');
  for (const b of root.querySelectorAll('[data-quality]')) {
    b.classList.toggle('on', b.dataset.quality === S.quality);
    b.addEventListener('click', () => {
      S.quality = b.dataset.quality; saveProfile(); api.applySettings(S);
      for (const x of root.querySelectorAll('[data-quality]')) x.classList.toggle('on', x === b);
    });
  }
  const vol = $('#setVol', root), volV = $('#setVolV', root);
  vol.value = Math.round(S.volume * 100); volV.textContent = vol.value;
  vol.addEventListener('input', () => { S.volume = vol.value / 100; volV.textContent = vol.value; saveProfile(); api.applySettings(S); });
  const nm = $('#setName', root);
  nm.value = S.name;
  nm.addEventListener('input', () => { S.name = nm.value.toUpperCase().slice(0, 14) || 'RIDER'; saveProfile(); });
  $('#setReset', root).addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Tap again to erase everything'; return; }
    localStorage.removeItem(SAVE); localStorage.removeItem('freshline.best'); location.reload();
  });

  // ----- cheats -----
  const give = (n) => {
    profile.coins = Math.max(0, Math.min(1e12, profile.coins + n)); saveProfile(); refreshCoins();
    toast(n >= 0 ? `Cheat: +${fmt(n)} ${FLAKE}` : 'Cheat: snowflakes reset');
  };
  for (const b of root.querySelectorAll('[data-give]')) b.addEventListener('click', () => give(+b.dataset.give));
  $('#cheatGive', root).addEventListener('click', () => {
    const n = Math.floor(+$('#cheatAmt', root).value.replace(/[^0-9]/g, '')) || 0;
    if (n > 0) give(n);
  });
  $('#cheatZero', root).addEventListener('click', () => give(-profile.coins));

  // ----- toast -----
  let toastT = null;
  function toast(text, color) {
    const t = $('#toast', root);
    t.innerHTML = text; t.style.setProperty('--rc', color || '#ffcf33');
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  refreshCoins();
  api.setGear(profile.board);
  api.applySettings(S);

  return {
    show() { root.hidden = false; refreshCoins(); setTab(tab); },
    hide() { root.hidden = true; $('#modes', root).hidden = true; wearEquipped(); },
    // Paid at the end of a run.
    award(score) {
      const n = flakesFor(score);
      if (n <= 0) return 0;
      profile.coins += n; saveProfile(); refreshCoins();
      toast(`+${fmt(n)} ${FLAKE} from your run`);
      return n;
    },
    wearEquipped,
    tab: () => (root.hidden ? null : tab),
  };
}
