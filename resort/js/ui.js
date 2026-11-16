// First Chair: everything on screen that is not the mountain. The top bar, the big
// buttons, the goal, pop-ups, the start screen and the windows.
import { T } from './tuning.js';
import { UPGRADES, offer, guestCap, currentGoal, canMoveOn, fameOf, mapOf, short } from './idle.js';
import { MAPS } from './maps.js';

const $ = (id) => document.getElementById(id);
const svg = (d) => `<svg class="ic" viewBox="0 0 24 24">${d}</svg>`;
const ICON = {
  lift: svg('<path d="M3 5l18 4M9 6.700V11M6 11h6v5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM6 20h6"/>'),
  upgrade: svg('<path d="M12 20V8M6.500 13.500L12 8l5.500 5.500M6 4h12"/>'),
  speed: svg('<path d="M4.500 17a8.500 8.500 0 1 1 15 0M12 13l4-5"/><circle cx="12" cy="13.500" r="1.300"/>'),
  guests: svg('<circle cx="9" cy="8" r="3.200"/><path d="M3 19.500c0-3.300 2.700-5.500 6-5.500s6 2.200 6 5.500M18 8v6M15 11h6"/>'),
  ticket: svg('<path d="M3 8.500a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2V10a2 2 0 0 0 0 4v1.500a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V14a2 2 0 0 0 0-4zM14.500 7v10" stroke-dasharray="none"/>'),
  hut: svg('<path d="M3 11l9-7 9 7M5 9.500V20h14V9.500M10 20v-6h4v6"/>'),
  rush: svg('<path d="M13 2.500L5 13.500h6l-1 8 8-11h-6z"/>'),
  coin: svg('<circle cx="12" cy="12" r="9"/><path d="M14.800 9.200c-.5-1-1.500-1.500-2.800-1.500-1.700 0-2.900.8-2.900 2.100 0 3 5.900 1.400 5.900 4.300 0 1.300-1.300 2.200-3 2.200-1.500 0-2.700-.6-3.200-1.700"/>'),
  view: svg('<path d="M2 12s3.600-6.500 10-6.500S22 12 22 12s-3.600 6.500-10 6.500S2 12 2 12z"/><circle cx="12" cy="12" r="2.800"/>'),
  peak: svg('<path d="M2.500 19.500l6.500-11 4 6 2.500-3.500 6 8.500zM7.300 11.500l1.700 1.300 1.500-1.500"/>'),
};
const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.ceil(s % 60) % 60).padStart(2, '0');

export function createUI(api) {
  const set = (el, key, v) => { if (el[key] !== v) el[key] = v; };
  const txt = (el, v) => { if (el._t !== v) { el._t = v; el.textContent = v; } };

  // ---------- the big buttons ----------
  const deck = $('deck'), ups = {};
  for (const id of UPGRADES) {
    const b = document.createElement('button');
    b.className = 'up'; b.id = 'up-' + id;
    b.innerHTML = `${ICON[id]}<div class="nm"><span></span><i></i></div><div class="nt"></div><div class="pr num">${ICON.coin}<span></span></div><div class="fill"></div>`;
    deck.appendChild(b);
    ups[id] = { b, name: b.querySelector('.nm span'), lvl: b.querySelector('.nm i'), note: b.querySelector('.nt'), price: b.querySelector('.pr span'), coin: b.querySelector('.pr svg'), fill: b.querySelector('.fill') };
    // One press buys once. Holding keeps buying.
    let hold = 0, rep = 0;
    const stop = () => { clearTimeout(hold); clearInterval(rep); b.classList.remove('hit'); };
    b.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      e.preventDefault();
      stop();
      b.classList.add('hit');
      api.buy(id, true);
      hold = setTimeout(() => { rep = setInterval(() => { if (!api.buy(id, false)) stop(); }, 110); }, 420);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
    b.addEventListener('keydown', (e) => { if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) { e.preventDefault(); api.buy(id, true); } });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  const rush = $('rush');
  rush.innerHTML = `${ICON.rush}<b></b>`;
  const rushText = rush.querySelector('b');
  rush.addEventListener('click', () => api.rush());

  $('viewBtn').innerHTML = ICON.view;
  $('viewBtn').addEventListener('click', () => { api.click(); api.overview(); });
  $('menuBtn').addEventListener('click', () => { api.click(); showSettings(); });
  $('next').addEventListener('click', () => { api.click(); showNext(); });

  // ---------- every frame ----------
  let last = null, deckH = 0;
  // The round buttons sit just above the deck, however tall it is on this screen.
  const measure = () => { const h = deck.offsetHeight; if (h && h !== deckH) { deckH = h; $('hud').style.setProperty('--deck', h + 'px'); } };
  addEventListener('resize', () => setTimeout(measure, 50));
  function update(state) {
    last = state;
    if (!deckH) measure();
    txt($('money'), short(state.money));
    txt($('rate'), '+' + short(state.rate * 60) + ' / min');
    txt($('guests'), String(state.guests.length));
    txt($('guestCap'), '/ ' + guestCap(state));
    const fame = fameOf(state);
    set($('sFame'), 'hidden', fame <= 1);
    if (fame > 1) txt($('sFame'), '★ x' + short(fame));

    for (const id of UPGRADES) {
      const o = offer(state, id), u = ups[id];
      const can = !o.maxed && !o.locked && o.cost <= state.money;
      const cls = 'up' + (o.maxed ? ' max' : o.locked ? ' locked' : can ? ' can' : '') + (u.b.classList.contains('hit') ? ' hit' : '');
      set(u.b, 'className', cls);
      txt(u.name, o.name);
      txt(u.lvl, o.maxed ? 'MAX' : id === 'lift' ? `${state.open} / ${T.LIFT_COUNT}` : o.level !== undefined ? 'Lv ' + o.level : '');
      txt(u.note, o.note || '');
      txt(u.price, o.maxed ? 'Done' : o.locked ? 'Locked' : short(o.cost));
      const show = o.maxed || o.locked ? 'none' : '';
      if (u.coin.style.display !== show) u.coin.style.display = show;
      const w = o.maxed || o.locked ? '0%' : Math.round(Math.min(1, state.money / o.cost) * 100) + '%';
      if (u.fill.style.width !== w) u.fill.style.width = w;
    }

    const g = currentGoal(state), box = $('goal');
    set(box, 'hidden', !g);
    if (g) {
      txt($('goalText'), g.goal.text);
      txt($('goalReward'), '+' + short(g.reward));
      const w = Math.round(g.have / g.want * 100) + '%';
      if ($('goalBar').style.width !== w) $('goalBar').style.width = w;
    }

    const cls = 'rush' + (state.rush > 0 ? ' on' : state.rushWait > 0 ? ' wait' : '');
    if (rush._c !== cls) { rush._c = cls; rush.className = cls.replace('rush', '').trim(); }
    txt(rushText, state.rush > 0 ? Math.ceil(state.rush) + 's' : state.rushWait > 0 ? mmss(state.rushWait) : 'Rush hour');

    const move = canMoveOn(state);
    set($('next'), 'hidden', !move);
    if (move && !$('next')._set) { $('next')._set = 1; $('next').innerHTML = `${ICON.peak} Next mountain`; }
  }

  // ---------- pop-ups and tags over the mountain ----------
  const labels = $('labels');
  function pop(x, y, text) {
    if (labels.childElementCount > 40) return;
    const el = document.createElement('div');
    el.className = 'pop'; el.textContent = text;
    el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(y) + 'px';
    labels.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    setTimeout(() => el.remove(), 1600);
  }

  function toast(html, kind = '', ms = 3200) {
    const box = $('toasts'), el = document.createElement('div');
    el.className = 'toast ' + kind; el.innerHTML = html;
    box.appendChild(el);
    while (box.childElementCount > 3) box.firstElementChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
  }

  // ---------- windows ----------
  const sheet = $('sheet');
  let open = false;
  function showSheet(title, html) {
    $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html;
    sheet.hidden = false; open = true;
  }
  function closeSheet() { sheet.hidden = true; open = false; }
  $('sheetX').addEventListener('click', () => { api.click(); closeSheet(); });
  sheet.addEventListener('pointerdown', (e) => { if (e.target === sheet) closeSheet(); });

  const HOW = `<ul>
      <li>Guests arrive on their own. Every ride on a lift pays you.</li>
      <li><b>New lift</b> opens the next lift and piste. Higher lifts pay more per ride.</li>
      <li><b>Upgrade lift</b> turns a lift into a chairlift, then a gondola, so more guests fit.</li>
      <li><b>Lift speed</b> shortens the queues. <b>More guests</b> fills the chairs.</li>
      <li><b>Ticket price</b> and <b>Ski hut</b> raise what every ride earns.</li>
      <li>Hold a button to keep buying. <b>Rush hour</b> gives a 30 second boost.</li>
      <li>Camera: drag to move, pinch or scroll to zoom, two fingers or right-drag to turn.</li>
    </ul>`;

  function showHow() { showSheet('How to play', HOW + '<button class="btn gold" id="okBtn">Got it</button>'); $('okBtn').addEventListener('click', () => { api.click(); closeSheet(); }); }

  function showSettings() {
    const s = api.settings();
    showSheet('Menu', `
      <div class="row"><span>Sound</span><input type="range" id="setVol" min="0" max="1" step="0.05" value="${s.volume}"></div>
      <div class="row"><span>Shadows</span><button class="switch ${s.shadows ? 'on' : ''}" id="setShadow" aria-label="Shadows"></button></div>
      <div class="row" style="display:block">
        <button class="btn" id="setHow">How to play</button>
        <button class="btn" id="setQuit">Back to the start screen</button>
        <button class="btn bad" id="setReset">Reset all progress</button>
      </div>`);
    $('setVol').addEventListener('input', (e) => { s.volume = +e.target.value; api.applySettings(); });
    $('setShadow').addEventListener('click', (e) => { s.shadows = !s.shadows; e.currentTarget.classList.toggle('on', s.shadows); api.applySettings(); api.click(); });
    $('setHow').addEventListener('click', () => { api.click(); showHow(); });
    $('setQuit').addEventListener('click', () => { api.click(); closeSheet(); api.quit(); });
    $('setReset').addEventListener('click', () => {
      api.click();
      showSheet('Reset all progress?', '<p>This deletes your resort, your money and your fame. It cannot be undone.</p><button class="btn bad" id="yesReset">Yes, start over</button><button class="btn" id="noReset">Keep playing</button>');
      $('yesReset').addEventListener('click', () => { closeSheet(); api.reset(); });
      $('noReset').addEventListener('click', () => { api.click(); closeSheet(); });
    });
  }

  function showNext() {
    const to = MAPS[(last.level + 1) % MAPS.length];
    showSheet('Move to ' + to.name + '?', `<p>${mapOf(last).name} is finished: every lift is a gondola.</p>
      <ul><li>You start again with one drag lift, on a new mountain: <b>${to.name}</b> (${to.tag.toLowerCase()}).</li>
      <li>Your money and upgrades stay behind.</li>
      <li>Your fame doubles: all income <b>x${short(fameOf(last) * T.FAME)}</b> from now on.</li></ul>
      <button class="btn gold" id="goNext">Move on</button><button class="btn" id="stayHere">Stay a little longer</button>`);
    $('goNext').addEventListener('click', () => { closeSheet(); api.next(); });
    $('stayHere').addEventListener('click', () => { api.click(); closeSheet(); });
  }

  // ---------- start screen ----------
  $('playBtn').addEventListener('click', () => api.start());
  $('howBtn').addEventListener('click', () => { api.click(); showHow(); });

  return {
    update, pop, toast, closeSheet, labels,
    get deckHeight() { return deckH; },
    get sheetOpen() { return open; },
    showMenu(save) {
      $('menu').hidden = false; $('hud').hidden = true;
      $('playBtn').textContent = save ? 'Continue' : 'Play';
      $('menuNote').textContent = save ? `${MAPS[save.level % MAPS.length].name} · ${save.open} of ${T.LIFT_COUNT} lifts · ${short(save.money)} in the bank` : 'Your progress saves in this browser.';
    },
    hideMenu() { $('menu').hidden = true; $('hud').hidden = false; },
  };
}
