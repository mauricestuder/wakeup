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
};

export const ITEMS = [
  // Characters (the head, and sometimes a pack)
  { id: 'rider', type: 'character', name: 'Rider', rarity: 'common', price: 0, icon: '⛑️', desc: 'Helmet on, goggles down.' },
  { id: 'beanie', type: 'character', name: 'Beanie Local', rarity: 'uncommon', price: 800, icon: '🧶', desc: 'Pompom beanie, lift-line legend.' },
  { id: 'cap', type: 'character', name: 'Backwards Cap', rarity: 'uncommon', price: 800, icon: '🧢', desc: 'Park lap energy.' },
  { id: 'bear', type: 'character', name: 'Bear Hood', rarity: 'rare', price: 2000, icon: '🐻', desc: 'Warm ears, wild steeze.' },
  { id: 'penguin', type: 'character', name: 'Penguin', rarity: 'epic', price: 4000, icon: '🐧', desc: 'Born on the ice.' },
  { id: 'robot', type: 'character', name: 'Robo-Rider', rarity: 'epic', price: 4500, icon: '🤖', desc: 'Glowing visor, battery pack.' },
  { id: 'yeti', type: 'character', name: 'Yeti', rarity: 'legendary', price: 8000, icon: '🦣', desc: 'The mountain sends its best.' },
  { id: 'astro', type: 'character', name: 'Astronaut', rarity: 'legendary', price: 8000, icon: '🧑‍🚀', desc: 'Low gravity, high style.' },
  // Outfits (skin colours)
  { id: 'classic', type: 'skin', name: 'Classic', rarity: 'common', price: 0, skin: { jacket: 0xff4f1f, pants: 0x22303f, gear: 0x1e88e5, accent: 0xffcf33 } },
  { id: 'glacier', type: 'skin', name: 'Glacier', rarity: 'uncommon', price: 600, skin: { jacket: 0x4fc3f7, pants: 0xe8f1f8, gear: 0xffffff, accent: 0x1e88e5 } },
  { id: 'polar', type: 'skin', name: 'Polar', rarity: 'uncommon', price: 600, skin: { jacket: 0xf4f6fa, pants: 0xd32f2f, gear: 0xd32f2f, accent: 0x222222 } },
  { id: 'camo', type: 'skin', name: 'Backcountry Camo', rarity: 'rare', price: 1500, skin: { jacket: 0x5b6b3a, pants: 0x3a2f22, gear: 0x6b8e23, accent: 0xd9c27a } },
  { id: 'midnight', type: 'skin', name: 'Midnight', rarity: 'rare', price: 1500, skin: { jacket: 0x1a1f3a, pants: 0x0b0d18, gear: 0x7c4dff, accent: 0x00e5ff, glow: ['accent'] } },
  { id: 'sunset', type: 'skin', name: 'Sunset', rarity: 'epic', price: 3000, skin: { jacket: 0xff7a59, pants: 0x5b2a86, gear: 0xffb86c, accent: 0xff3d81 } },
  { id: 'neon', type: 'skin', name: 'Neon Rush', rarity: 'epic', price: 3500, skin: { jacket: 0x39ff14, pants: 0x1b1b1b, gear: 0xff00e5, accent: 0x00f0ff, glow: ['jacket', 'accent'] } },
  { id: 'gold', type: 'skin', name: 'Golden Legend', rarity: 'legendary', price: 7000, skin: { jacket: 0xffc933, pants: 0x6d5418, gear: 0xffd700, accent: 0xfff3b0, glow: ['jacket', 'gear'] } },
  // Trails
  { id: 'none', type: 'trail', name: 'No Trail', rarity: 'common', price: 0, bar: ['#3a4658', '#3a4658'] },
  { id: 'frost', type: 'trail', name: 'Frost', rarity: 'uncommon', price: 700, bar: ['#ffffff', '#9fe8ff'] },
  { id: 'ember', type: 'trail', name: 'Ember', rarity: 'rare', price: 1800, bar: ['#ffe14d', '#ff3d00'] },
  { id: 'neon', type: 'trail', name: 'Neon Streak', rarity: 'rare', price: 1800, bar: ['#ff4dff', '#7c4dff'], tid: 'neon' },
  { id: 'shadow', type: 'trail', name: 'Shadow', rarity: 'epic', price: 3500, bar: ['#2a1640', '#0a0412'] },
  { id: 'rainbow', type: 'trail', name: 'Rainbow', rarity: 'epic', price: 3500, bar: ['#ff4d4d', '#ffd84d', '#4dff88', '#4dc3ff', '#b84dff'] },
  { id: 'goldtrail', type: 'trail', name: 'Gold Dust', rarity: 'legendary', price: 6000, bar: ['#fff3b0', '#ffb300'], tid: 'gold' },
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
  try {
    const p = JSON.parse(localStorage.getItem(SAVE));
    if (p) return { ...DEFAULT, ...p, equip: { ...DEFAULT.equip, ...p.equip }, settings: { ...DEFAULT.settings, ...p.settings } };
  } catch { /* fresh start */ }
  return JSON.parse(JSON.stringify(DEFAULT));
})();
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
    const h = (n) => '#' + n.toString(16).padStart(6, '0');
    const s = it.skin;
    return `<div class="ico swatch"><span style="background:${h(s.jacket)}"></span><span style="background:${h(s.pants)}"></span><span style="background:${h(s.gear)}"></span><span style="background:${h(s.accent)}"></span></div>`;
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
    api.skier.applyLook(skinOf(skin), char);
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
    const pool = ITEMS.filter((i) => i.price > 0 && (i.rarity === 'epic' || i.rarity === 'legendary'));
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
    sec(`Featured <small>new in ${hrs} h</small>`, featured(), true);
    sec('Characters', ITEMS.filter((i) => i.type === 'character' && i.price));
    sec('Outfits', ITEMS.filter((i) => i.type === 'skin' && i.price));
    sec('Trails', ITEMS.filter((i) => i.type === 'trail' && i.price));
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
        profile.owned.push(key(it));
        toast(`Unlocked ${it.name}!`, r.c);
      }
      profile.equip[it.type] = it.id;
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
