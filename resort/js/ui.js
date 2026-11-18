// Idle Lift: everything on screen that is not the mountain. The money sign, the
// upgrade boards, the quest marker and list, pop-ups, the start screen and the notices.
import { T } from './tuning.js';
import { UPGRADES, offer, guestCap, currentGoal, questList, canMoveOn, fameOf, mapOf, short, money, NAMES, EVENTS, awayOf, parkOf } from './idle.js';
import { mapAt, SPECIALS, summitM } from './maps.js';

const $ = (id) => document.getElementById(id);
const svg = (d) => `<svg class="ic" viewBox="0 0 24 24">${d}</svg>`;
const ICON = {
  lift: svg('<path d="M3 5l18 4M9 6.700V11M6 11h6v5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM6 20h6"/>'),
  upgrade: svg('<path d="M12 20V8M6.500 13.500L12 8l5.500 5.500M6 4h12"/>'),
  speed: svg('<path d="M4.500 17a8.500 8.500 0 1 1 15 0M12 13l4-5"/><circle cx="12" cy="13.500" r="1.300"/>'),
  guests: svg('<circle cx="9" cy="8" r="3.200"/><path d="M3 19.500c0-3.300 2.700-5.500 6-5.500s6 2.200 6 5.500M18 8v6M15 11h6"/>'),
  ticket: svg('<path d="M3 8.500a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V10a2 2 0 0 0 0 4v1.500a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V14a2 2 0 0 0 0-4zM14.500 7v10"/>'),
  hut: svg('<path d="M3 11l9-7 9 7M5 9.500V20h14V9.500M10 20v-6h4v6"/>'),
  jump: svg('<path d="M3 20h9l9-9M3 20c5 0 9-3 12-7"/><circle cx="8" cy="7" r="1.800"/><path d="M5 12l3-2 3 1.500"/>'),
  cannon: svg('<path d="M12 3v18M4.200 7.500l15.600 9M19.800 7.500l-15.600 9M12 6l-2-1.500M12 6l2-1.500M12 18l-2 1.500M12 18l2 1.500"/>'),
  school: svg('<path d="M2.500 9L12 4.500 21.500 9 12 13.500zM6.500 11.200V16c1.500 1.500 3.500 2.200 5.500 2.200s4-.7 5.500-2.200v-4.800M21.500 9v5"/>'),
  night: svg('<path d="M20 14.500A8.500 8.500 0 0 1 9.500 4a8.500 8.500 0 1 0 10.500 10.500z"/><path d="M16 4.500v3M14.500 6h3"/>'),
  resto: svg('<path d="M6 3v8M4 3v4a2 2 0 0 0 4 0V3M6 11v10M17 3c-2 2-2.500 4.500-2.500 7.500H17zM17 10.500V21"/>'),
  rush: svg('<path d="M13 2.500L5 13.500h6l-1 8 8-11h-6z"/>'),
  view: svg('<path d="M2 12s3.600-6.500 10-6.500S22 12 22 12s-3.600 6.500-10 6.500S2 12 2 12z"/><circle cx="12" cy="12" r="2.800"/>'),
  peak: svg('<path d="M2.500 19.500l6.500-11 4 6 2.500-3.500 6 8.500zM7.300 11.500l1.700 1.300 1.500-1.500"/>'),
  quest: svg('<path d="M12 21V3M12 5h7l2 2-2 2h-7zM12 11H5l-2 2 2 2h7z"/>'),
  lodge: svg('<path d="M3 20V10l9-6 9 6v10M3 20h18M7 20v-5h10v5M7 17.500h10M9.500 11h5"/>'),
  tie: svg('<path d="M10 3h4l-1 3 2.500 10L12 20l-3.500-4L11 6z"/>'),
  powder: svg('<path d="M12 3v18M4.200 7.500l15.600 9M19.800 7.500l-15.600 9"/>'),
  storm: svg('<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>'),
  celeb: svg('<path d="M12 3l2.600 5.600 6 .7-4.500 4.100 1.200 6-5.300-3-5.300 3 1.200-6L3.400 9.300l6-.7z"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
};
// Every board has the colour of a piste sign.
const COLOR = { lift: 'var(--blue)', upgrade: 'var(--red)', speed: 'var(--orange)', guests: 'var(--green)', ticket: '#c9941a', hut: 'var(--black)',
  jump: 'var(--purple)', cannon: '#3aa6c9', school: 'var(--green)', night: '#34406e', resto: 'var(--red)', lodge: '#8a5a2b' };
// The money logo: a gold coin with a mountain and a chairlift on it.
const COIN = `<svg class="coinpic" viewBox="0 0 32 32" aria-hidden="true">
  <circle cx="16" cy="16.6" r="14.6" fill="#8f5a06"/><circle cx="16" cy="15.4" r="14.6" fill="#f2ae12"/>
  <circle cx="16" cy="15.4" r="11.2" fill="#ffe27a"/><circle cx="16" cy="15.4" r="11.2" fill="none" stroke="#c98a0a" stroke-width="1.1"/>
  <path d="M5.400 19.400L12.600 8.400l4 6 2.400-3.300 7.600 8.300a11.200 11.200 0 0 1-21.200 0z" fill="#b06f06"/>
  <path d="M12.600 8.400l2.800 4.200-1.700 1.100-1.300-1.200-1.800 1.600-.6-1zM19 11.100l2.600 2.900-1.600.5-1.300-1-1.100.4z" fill="#fffbe6"/>
  <path d="M7.200 9.200a10.800 10.800 0 0 1 5-4" stroke="#fff" stroke-opacity=".8" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>`;
const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.ceil(s % 60) % 60).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createUI(api) {
  const set = (el, key, v) => { if (el[key] !== v) el[key] = v; };
  const txt = (el, v) => { if (el._t !== v) { el._t = v; el.textContent = v; } };

  // ---------- the upgrade boards ----------
  const deck = $('deck'), ups = {};
  for (const id of UPGRADES) {
    const b = document.createElement('button');
    b.className = 'up board'; b.id = 'up-' + id;
    b.style.setProperty('--c', COLOR[id]);
    b.innerHTML = `<span class="bd"><span class="bi">${ICON[id]}</span><i class="lv"></i></span><span class="nm"></span><span class="nt"></span><span class="pr">${COIN}<b class="num"></b></span><span class="fill"><i></i></span>`;
    deck.appendChild(b);
    ups[id] = { b, badge: b.querySelector('.bi'), name: b.querySelector('.nm'), lvl: b.querySelector('.lv'), note: b.querySelector('.nt'), price: b.querySelector('.pr b'), fill: b.querySelector('.fill i'), icon: id };
    // A tap buys once. Holding still for a moment keeps buying. Dragging scrolls the list instead.
    let hold = 0, rep = 0, held = false, sx = 0, sy = 0;
    const stop = () => { clearTimeout(hold); clearInterval(rep); b.classList.remove('hit'); };
    b.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      stop(); held = false; sx = e.clientX; sy = e.clientY;
      b.classList.add('hit');
      hold = setTimeout(() => { held = true; api.buy(id, true); rep = setInterval(() => { if (!api.buy(id, false)) stop(); }, 110); }, 380);
    });
    b.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) stop(); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
    b.addEventListener('click', (e) => {
      if (!held) api.buy(id, true); held = false;
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  const rush = $('rush');
  rush.innerHTML = `${ICON.rush}<b></b>`;
  const rushText = rush.querySelector('b');
  rush.addEventListener('click', () => api.rush());

  for (const el of document.querySelectorAll('.coin')) el.innerHTML = COIN;
  $('viewBtn').innerHTML = ICON.view;
  $('questBtn').innerHTML = ICON.quest;
  $('viewBtn').addEventListener('click', () => { api.click(); api.overview(); });
  $('menuBtn').addEventListener('click', () => { api.click(); showSettings(); });
  $('questBtn').addEventListener('click', () => { api.click(); showQuests(); });
  $('parkBtn').addEventListener('click', () => { api.click(); showPark(); });
  $('goal').addEventListener('click', () => { api.click(); showQuests(); });
  $('next').addEventListener('click', () => { api.click(); showNext(); });
  $('evBtn').addEventListener('click', () => { api.click(); api.eventAction(); });

  // ---------- every frame ----------
  let last = null, shown = 0, slow = 1, deckH = 0;
  // Where the boards are, as shares of the screen, so the camera can keep the action in the free part.
  const free = { right: 0, bottom: 0, top: 0.14, left: 0 };
  function measure() {
    const r = deck.getBoundingClientRect();
    if (!r.width) return;
    const side = r.height > innerHeight * 0.55;
    free.right = side ? (innerWidth - r.left) / innerWidth : 0;
    free.bottom = side ? 0 : (innerHeight - r.top) / innerHeight;
    $('hud').style.setProperty('--deck-h', side ? '0px' : Math.round(r.height) + 'px');
    free.measured = true;
  }
  addEventListener('resize', () => setTimeout(measure, 60));

  // The money number rolls every frame. Everything else is refreshed 8 times a second, or at once after a purchase.
  function update(state, dt = 0, now = false) {
    if (state !== last) { last = state; shown = state.money; now = true; }
    if (!free.measured) measure();
    shown = state.money < shown || Math.abs(state.money - shown) < 0.5 ? state.money : shown + (state.money - shown) * (1 - Math.exp(-dt * 9));
    txt($('money'), money(Math.floor(shown + 1e-6)));
    slow += dt;
    if (!now && slow < 0.125) return;
    slow = 0;
    txt($('rate'), '+' + money(state.rate) + ' / s');
    txt($('guests'), String(state.guests.length));
    txt($('guestCap'), '/ ' + guestCap(state));
    txt($('parkTag'), parkOf(state).tag);
    const fame = fameOf(state);
    set($('sFame'), 'hidden', fame <= 1);
    if (fame > 1) txt($('sFame'), '★ x' + short(fame));

    for (const id of UPGRADES) {
      const o = offer(state, id), u = ups[id];
      const can = !o.maxed && !o.locked && o.cost <= state.money;
      const kind = o.maxed ? 'max' : o.locked ? 'locked' : can ? 'can' : 'no';
      if (u.kind !== kind) {
        u.kind = kind;
        u.b.className = 'up board ' + kind + (u.b.classList.contains('hit') ? ' hit' : '');
      }
      const icon = o.secret ? 'lock' : id;
      if (u.icon !== icon) { u.icon = icon; u.badge.innerHTML = ICON[icon]; }
      txt(u.name, o.name);
      txt(u.lvl, o.maxed ? 'MAX' : id === 'lift' ? `${state.open} / ${T.LIFT_COUNT}` : o.level !== undefined ? 'Lv ' + o.level : '');
      txt(u.note, o.note || '');
      txt(u.price, o.maxed ? 'Done' : o.locked ? 'Locked' : money(o.cost));
      const w = o.maxed || o.locked ? 0 : Math.round(Math.min(1, state.money / o.cost) * 100) / 100;
      if (u.fillW !== w) { u.fillW = w; u.fill.style.transform = `scaleX(${w})`; }
    }

    const g = currentGoal(state), box = $('goal');
    set(box, 'hidden', !g);
    if (g) {
      txt($('goalText'), g.text);
      txt($('goalReward'), '+' + money(g.reward));
      const w = Math.round(g.have / g.want * 100) + '%';
      if ($('goalBar').style.width !== w) $('goalBar').style.width = w;
    }

    // The event sign under the quest marker.
    const ev = state.event, sign = $('event');
    set(sign, 'hidden', !ev);
    $('hud').classList.toggle('ev', !!ev);
    if (ev) {
      if (sign._id !== ev.id) {
        sign._id = ev.id; sign.className = 'board ' + ev.id;
        $('evIcon').innerHTML = ICON[ev.id];
        txt($('evName'), ev.name);
        txt($('evText'), ev.id === 'powder' ? `Fresh snow: income x${T.POWDER_PAY}` : ev.id === 'storm' ? `Wind stopped lift ${ev.lifts.map((i) => i).join(' and ')}` : 'A famous skier is on the slopes. Tap them!');
        set($('evBtn'), 'hidden', ev.id === 'powder');
        txt($('evBtn'), ev.id === 'storm' ? 'Secure the lifts' : 'Find');
      }
      txt($('evTime'), Math.ceil(ev.t) + 's');
    }

    const cls = state.rush > 0 ? 'on' : state.rushWait > 0 ? 'wait' : '';
    if (rush._c !== cls) { rush._c = cls; rush.className = cls; }
    txt(rushText, state.rush > 0 ? Math.ceil(state.rush) + 's' : state.rushWait > 0 ? mmss(state.rushWait) : 'Rush hour');

    // The boards change height when their texts do, and the camera and round buttons follow.
    const h = deck.offsetHeight;
    if (h !== deckH) { deckH = h; measure(); }

    const move = canMoveOn(state);
    set($('next'), 'hidden', !move);
    if (move && !$('next')._set) { $('next')._set = 1; $('next').innerHTML = `${ICON.peak}<span>Next mountain</span>`; }
  }

  // ---------- pop-ups over the mountain ----------
  // The same few elements are used again and again, so nothing is created while playing.
  const labels = $('labels');
  const pool = (cls, n) => { const a = []; for (let i = 0; i < n; i++) { const el = document.createElement('div'); el.className = cls; labels.appendChild(el); a.push(el); } a.next = 0; return a; };
  let pops = null, coins = null;
  function pop(x, y, text, trick = false) {
    if (!pops) pops = pool('pop', 14);
    const el = pops[pops.next++ % pops.length];
    el.textContent = text;
    el.classList.toggle('trick', trick);
    const rise = trick ? 4.4 : 3;
    el.animate([
      { transform: `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${trick ? 0.6 : 1})`, opacity: 1 },
      { transform: `translate(${x}px, ${y}px) translate(-50%, -100%) translateY(-${rise * 0.6}em) scale(${trick ? 1.15 : 1})`, opacity: 1, offset: 0.6 },
      { transform: `translate(${x}px, ${y}px) translate(-50%, -100%) translateY(-${rise}em) scale(1)`, opacity: 0 },
    ], { duration: trick ? 1400 : 1100, easing: 'ease-out' });
  }
  // A few coins fly from a spot on screen to the money sign.
  function flyCoins(x, y, n = 5) {
    if (!coins) { coins = pool('fly', 12); for (const el of coins) el.innerHTML = COIN; }
    const r = document.querySelector('#sMoney .coin').getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const el = coins[coins.next++ % coins.length], ox = (Math.random() - 0.5) * 60, oy = (Math.random() - 0.5) * 40;
      el.animate([
        { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(.6)`, opacity: 0 },
        { transform: `translate(${x + ox}px, ${y + oy - 30}px) translate(-50%, -50%) scale(1.1)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${tx}px, ${ty}px) translate(-50%, -50%) scale(.7)`, opacity: 1, offset: 0.95 },
        { transform: `translate(${tx}px, ${ty}px) translate(-50%, -50%) scale(.3)`, opacity: 0 },
      ], { duration: 720 + i * 70, delay: i * 45, easing: 'cubic-bezier(.5, 0, .3, 1)' });
    }
    const m = $('sMoney');
    setTimeout(() => { m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); }, 700);
  }

  function toast(html, kind = '', ms = 3200) {
    const box = $('toasts'), el = document.createElement('div');
    el.className = 'toast ' + kind; el.innerHTML = html;
    box.appendChild(el);
    while (box.childElementCount > 3) box.firstElementChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
  }

  // ---------- notices ----------
  const sheet = $('sheet');
  let open = false;
  function showSheet(title, html) {
    $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html; $('sheetBody').scrollTop = 0;
    sheet.hidden = false; open = true;
  }
  function closeSheet() { sheet.hidden = true; open = false; }
  $('sheetX').addEventListener('click', () => { api.click(); closeSheet(); });
  sheet.addEventListener('pointerdown', (e) => { if (e.target === sheet) closeSheet(); });

  // Open quests first, then the ones still locked, then the finished ones.
  function showQuests() {
    const all = questList(last), open = all.filter((q) => q.state === 'open'), locked = all.filter((q) => q.state === 'locked'), done = all.filter((q) => q.done);
    const line = (q, i) => `<div class="q ${q.done ? 'done' : i === 0 ? 'now' : ''}"><span class="dot">${q.done ? '✓' : i === 0 ? '!' : i + 1}</span>
      <span class="tx">${esc(q.text)}<small>${q.done ? 'Done' : short(q.have) + ' / ' + short(q.want)}</small></span><span class="rw num">+${money(q.reward)}</span>
      ${q.done ? '' : `<div class="meter"><i style="width:${Math.round(q.have / q.want * 100)}%"></i></div>`}</div>`;
    const hidden = () => `<div class="q locked"><span class="dot">${ICON.lock}</span><span class="tx">???<small>Finish a quest to unlock</small></span><span class="rw num"></span></div>`;
    showSheet(`Quests  ${done.length} / ${all.length}`,
      (open.length ? '<div class="qhead">Open now</div>' + open.map(line).join('') : '<p>Every quest on this mountain is done. Time for the next one!</p>')
      + (locked.length ? `<div class="qhead" style="margin-top:1em">Locked · ${locked.length} more</div>` + locked.slice(0, 4).map(hidden).join('')
        + (locked.length > 4 ? `<p class="more">… and ${locked.length - 4} more after that.</p>` : '') : '')
      + (done.length ? '<div class="qhead" style="margin-top:1em">Done</div>' + done.map(line).join('') : ''));
  }

  // Parking prices: what each one would do to the guests and the income, the current one marked.
  function showPark() {
    const all = T.PARK.map((p, k) => ({ p, k, o: api.parkPreview(k) }));
    const best = all.reduce((a, b) => (b.o.rate > a.o.rate ? b : a));
    const body = $('sheetBody'), keep = open && $('sheetTitle').textContent === 'Parking' ? body.scrollTop : 0;
    showSheet('Parking', `<p>Every guest pays for parking. <b>Cheap</b> parking brings more people to the mountain, <b>dear</b> parking brings fewer, but each one pays more.</p>
      <div class="pk">${all.map(({ p, k, o }) => `<button class="pkopt ${k === last.park ? 'on' : ''} ${k === 0 ? 'free' : ''}" data-k="${k}">
        <span class="pkt">${k === 0 ? 'Free' : p.tag}</span><span class="pkn">${p.name}${k === best.k ? '<span class="best">Most income</span>' : ''}</span>
        <span class="pkr num">${money(o.rate)} / s</span><span class="pkg">${o.guests} guests</span><span class="pki num">${o.parking ? 'Parking +' + money(o.parking) + ' / s' : 'No parking money'}</span></button>`).join('')}</div>
      <p><small>The total counts lifts, lessons and parking, without rush hour or events.</small></p>`);
    body.scrollTop = keep;
    for (const b of body.querySelectorAll('.pkopt')) b.addEventListener('click', () => { api.setPark(+b.dataset.k); showPark(); });
  }

  const hm = (s) => s >= 3600 ? Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' min' : Math.max(1, Math.floor(s / 60)) + ' min';
  function welcomeBack(o) {
    showSheet('Welcome back!', `<p>You were away for <b>${hm(o.away)}</b>. While you were gone the resort kept running at ${Math.round(o.share * 100)}% and earned</p>
      <p class="big">${COIN}<b class="num">${money(o.pay)}</b></p>
      ${o.away > o.paid ? `<p><small>Only the first ${o.hours} hours count. The <b>Lodge</b> board raises the share and the hours.</small></p>` : `<p><small>The <b>Lodge</b> board raises the share and the hours.</small></p>`}
      <button class="btn board gold" id="wbOk">Collect</button>`);
    $('wbOk').addEventListener('click', () => { api.click(); closeSheet(); flyCoins(innerWidth * (1 - free.right) / 2, innerHeight * 0.45, 8); });
  }

  const HOW = `<ul>
      <li>Guests arrive by car and coach on their own. Your income per second depends on your lifts, your guests and your prices, and stays the same until you buy something.</li>
      <li><b>New lift</b> opens the next lift and piste. Higher lifts pay more per ride.</li>
      <li><b>Upgrade lift</b> turns a lift into a chairlift, then a gondola, so more guests fit.</li>
      <li><b>Lift speed</b> and <b>More guests</b> sell more rides. <b>Ticket price</b> and <b>Ski hut</b> make each ride pay more.</li>
      <li><b>Jump park</b> builds kickers. Now and then a skier takes one and you get a trick bonus.</li>
      <li>More boards unlock as you play. The dark ones show what they need.</li>
      <li>Three <b>quests</b> are open at a time. Finishing one pays a reward and unlocks the next.</li>
      <li><b>Events</b> happen every few minutes: powder days pay double, storms stop a lift until you secure it, and a celebrity pays a bonus if you tap them.</li>
      <li>When you close the game the resort keeps earning half its income for up to 8 hours. The <b>Lodge</b> raises both.</li>
      <li>The <b>P</b> button sets the parking price: cheap parking brings more guests, dear parking pays more per guest.</li>
      <li>Hold a board to keep buying. <b>Rush hour</b> gives a 30 second boost.</li>
      <li>Camera: drag to move, pinch or scroll to zoom.</li>
    </ul>`;

  function showHow() { showSheet('How to play', HOW + '<button class="btn board gold" id="okBtn">Got it</button>'); $('okBtn').addEventListener('click', () => { api.click(); closeSheet(); }); }

  function showSettings() {
    const s = api.settings();
    showSheet('Menu', `
      <div class="row"><span>Sound</span><input type="range" id="setVol" min="0" max="1" step="0.05" value="${s.volume}"></div>
      <div class="row"><span>Graphics</span><div class="seg" id="setGfx">${['auto', 'high', 'low'].map((k) => `<button data-k="${k}" class="${s.graphics === k ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div></div>
      <div class="row" style="display:block">
        <button class="btn board" id="setHow">How to play</button>
        <button class="btn board" id="setQuit">Back to the start screen</button>
        <button class="btn board bad" id="setReset">Reset all progress</button>
      </div>`);
    $('setVol').addEventListener('input', (e) => { s.volume = +e.target.value; api.applySettings(); });
    $('setGfx').addEventListener('click', (e) => {
      const k = e.target.dataset?.k;
      if (!k) return;
      s.graphics = k;
      for (const b of $('setGfx').children) b.classList.toggle('on', b.dataset.k === k);
      api.applySettings(); api.click();
    });
    $('setHow').addEventListener('click', () => { api.click(); showHow(); });
    $('setQuit').addEventListener('click', () => { api.click(); closeSheet(); api.quit(); });
    $('setReset').addEventListener('click', () => {
      api.click();
      showSheet('Reset all progress?', '<p>This deletes your resort, your money, your unlocked upgrades and your fame. It cannot be undone.</p><button class="btn board bad" id="yesReset">Yes, start over</button><button class="btn board" id="noReset">Keep playing</button>');
      $('yesReset').addEventListener('click', () => { closeSheet(); api.reset(); });
      $('noReset').addEventListener('click', () => { api.click(); closeSheet(); });
    });
  }

  function showNext() {
    const to = mapAt(last.level + 1);
    const here = mapOf(last), sp = SPECIALS[to.special];
    showSheet('Move to ' + to.name + '?', `<p>${here.name} is finished: every lift is a gondola.</p>
      <ul><li>You start again with one drag lift, on a new mountain: <b>${to.name}</b> (${to.tag.toLowerCase()}).</li>
      <li>It is higher: the summit is at <b>${summitM(to).toLocaleString('en-US')} m</b>, ${(summitM(to) - summitM(here)).toLocaleString('en-US')} m above ${here.name}.</li>
      ${sp ? `<li>Something new up there: <b>${sp.name}</b>, ${sp.note}.</li>` : ''}
      <li>Your money and upgrade levels stay behind. Unlocked boards stay unlocked.</li>
      <li>Your fame doubles: all income <b>x${short(fameOf(last) * T.FAME)}</b> from now on.</li></ul>
      <button class="btn board gold" id="goNext">Move on</button><button class="btn board" id="stayHere">Stay a little longer</button>`);
    $('goNext').addEventListener('click', () => { closeSheet(); api.next(); });
    $('stayHere').addEventListener('click', () => { api.click(); closeSheet(); });
  }

  // ---------- start screen ----------
  $('playBtn').addEventListener('click', () => api.start());
  $('howBtn').addEventListener('click', () => { api.click(); showHow(); });

  return {
    update, pop, flyCoins, toast, closeSheet, showQuests, welcomeBack, labels, free,
    get sheetOpen() { return open; },
    clearLabels() { for (const el of [...labels.children]) if (!el.classList.contains('pop') && !el.classList.contains('fly')) el.remove(); },
    showMenu(save) {
      $('menu').hidden = false; $('hud').hidden = true;
      $('playBtn').textContent = save ? 'Continue' : 'Play';
      $('menuNote').textContent = save ? `${mapAt(save.level | 0).name} · ${save.open} of ${T.LIFT_COUNT} lifts · ${money(save.v === 2 ? save.money * T.MONEY : save.money)} in the bank` : 'Your progress saves in this browser.';
    },
    hideMenu() { $('menu').hidden = true; $('hud').hidden = false; },
  };
}
