// First Chair: everything drawn in HTML. Top bar, toolbar, info card, panels and toasts.
import { T, LIFTS, BUILDINGS, DIFF, SKILL, WEATHER } from './tuning.js';
import { GOALS, currentGoal, unlockedBy } from './goals.js';
import { DAYS, dayInSeason, seasonOf } from './sim.js';
import { fairTicket, dailyCosts, hotelShare, count, pisteLength } from './economy.js';
import { MAPS } from './maps.js';

const $ = (id) => document.getElementById(id);
const svg = (d, extra = '') => `<svg class="ic" viewBox="0 0 24 24" ${extra}>${d}</svg>`;
export const ICON = {
  lift: svg('<path d="M3 5l18 4M9 6.700V11M6 11h6v5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM6 20h6"/>'),
  piste: svg('<path d="M7 3c5 3-3 6 2 9s-2 6 5 9M14 3c5 3-3 6 2 9s-2 6 4 8"/>'),
  build: svg('<path d="M3 11l9-7 9 7M5 9.500V20h14V9.500M10 20v-6h4v6"/>'),
  remove: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>'),
  goals: svg('<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="4.500"/><circle cx="12" cy="12" r=".8"/>'),
  money: svg('<path d="M4 19V9M9 19V5M14 19v-7M19 19V8M3 21h18"/>'),
  view: svg('<path d="M2 12s3.600-6.500 10-6.500S22 12 22 12s-3.600 6.500-10 6.500S2 12 2 12z"/><circle cx="12" cy="12" r="2.800"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300l1.800 1.800M16.900 16.900l1.800 1.800M5.300 18.700l1.800-1.800M16.900 7.100l1.800-1.800"/>', 'style="color:#ffc247"'),
  cloud: svg('<path d="M7 18a4 4 0 0 1-.5-8A5.500 5.500 0 0 1 17 9.500a4.300 4.300 0 0 1 .5 8.500z"/>', 'style="color:#c4d0dc"'),
  snow: svg('<path d="M7 14a4 4 0 0 1-.5-8A5.500 5.500 0 0 1 17 5.500a4.300 4.300 0 0 1 .5 8.500zM8 18v.1M12 17v.1M16 18v.1M10 21v.1M14 21v.1"/>', 'style="color:#e9f2ff"'),
  storm: svg('<path d="M7 14a4 4 0 0 1-.5-8A5.500 5.500 0 0 1 17 5.500a4.300 4.300 0 0 1 .5 8.500zM12 13l-2.500 4.500h4L11 22"/>', 'style="color:#ffb23e"'),
  thaw: svg('<path d="M12 3s6 6.500 6 11a6 6 0 0 1-12 0c0-4.500 6-11 6-11z"/>', 'style="color:#5cb3ff"'),
};

export const money = (n) => (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('en-US');
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60 / 5) * 5).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (v) => Math.round(v * 100) + '%';
export function stars(r) {
  let out = '<span class="stars">';
  for (let i = 1; i <= 5; i++) out += r >= i - 0.25 ? '★' : r >= i - 0.75 ? '<span class="half">★</span>' : '<i>★</i>';
  return out + '</span>';
}

const ADVICE = {
  queue: 'Long queues. Add a lift, or a second way up.',
  hard: 'Pistes too hard for some. Give beginners an easy way down.',
  snow: 'Thin snow. Add snow cannons, or build higher up.',
  hungry: 'Hungry guests found no food. Put a ski hut next to a piste.',
  hutfull: 'The huts were full. Build another one.',
  price: 'Guests find the prices too high.',
  nothing: 'Some guests found nothing for their level.',
  stranded: 'Guests were stranded: a lift or piste ends with no way down.',
  injury: 'Injuries. Keep beginners off steep pistes and add a first-aid post.',
  fedup: 'Unhappy guests left early.',
};

export function createUI(api) {
  const el = {};
  for (const id of ['hud', 'money', 'sMoney', 'guests', 'sStars', 'clock', 'dayNo', 'wIcon', 'speed', 'menuBtn', 'goalChip', 'toasts', 'card', 'sub', 'confirm',
    'cText', 'cCancel', 'cUndo', 'cOk', 'bar', 'menu', 'maps', 'sandbox', 'howBtn', 'setBtn', 'sheet', 'sheetTitle', 'sheetBody', 'sheetX', 'labels']) el[id] = $(id);
  let state = null, open = null, card = null, sheetKind = null, sheetClose = null, last = {};

  // ---------- toolbar ----------
  const BAR = [['lift', 'Lift'], ['piste', 'Piste'], ['build', 'Build'], ['remove', 'Remove'], null, ['goals', 'Goals'], ['money', 'Money'], ['view', 'View']];
  el.bar.innerHTML = BAR.map((b) => b ? `<button data-b="${b[0]}">${ICON[b[0]]}${b[1]}</button>` : '<i></i>').join('');
  el.bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    api.click();
    const k = b.dataset.b;
    if (k === 'piste') { closeSub(); api.tool({ kind: 'piste' }); }
    else if (k === 'remove') { closeSub(); api.tool({ kind: 'remove' }); }
    else if (k === 'goals') { closeSub(); showGoals(); }
    else if (k === 'money') { closeSub(); showFinance(); }
    else if (open === k) closeSub();
    else openSub(k);
  });

  function closeSub() { open = null; el.sub.hidden = true; markBar(); }
  let activeTool = null, overlay = 'none';
  function markBar() {
    for (const b of el.bar.querySelectorAll('button')) {
      const k = b.dataset.b;
      const on = open === k || (activeTool && ((k === 'lift' && activeTool.kind === 'lift') || (k === 'piste' && activeTool.kind === 'piste')
        || (k === 'build' && activeTool.kind === 'building') || (k === 'remove' && activeTool.kind === 'remove'))) || (k === 'view' && overlay !== 'none');
      b.classList.toggle('on', !!on);
    }
  }

  function openSub(k) {
    api.tool(null);
    open = k;
    let html = '';
    if (k === 'lift' || k === 'build') {
      const defs = k === 'lift' ? LIFTS : BUILDINGS;
      for (const id in defs) {
        const d = defs[id], locked = !state.unlocks[id];
        const price = k === 'lift' ? `from ${money(d.base + d.perTile * d.minLen)}` : money(d.cost);
        const poor = !locked && !state.sandbox && state.money < (k === 'lift' ? d.base + d.perTile * d.minLen : d.cost);
        html += `<button class="opt${locked ? ' locked' : ''}${poor ? ' poor' : ''}" data-id="${id}"><b>${d.name}</b><em>${locked ? 'Locked' : price}</em>`
          + `<span>${locked ? 'Unlocks with: ' + esc(unlockedBy(id)) : d.blurb}</span></button>`;
      }
    } else if (k === 'view') {
      const o = [['none', 'Normal view', 'The mountain as it is.'], ['steep', 'Steepness', 'Green, blue, red and black ground. Purple is cliff.'], ['snow', 'Snow depth', 'Blue is deep, orange is thin, brown is bare.']];
      html = o.map(([id, n, t]) => `<button class="opt" data-id="${id}"><b>${n}</b><em>${overlay === id ? 'On' : ''}</em><span>${t}</span></button>`).join('');
    }
    el.sub.innerHTML = html;
    el.sub.hidden = false;
    markBar();
  }
  el.sub.addEventListener('click', (e) => {
    const b = e.target.closest('.opt');
    if (!b) return;
    const id = b.dataset.id, k = open;
    if (b.classList.contains('locked')) { api.buzz(); return; }
    api.click();
    closeSub();
    if (k === 'lift') api.tool({ kind: 'lift', type: id });
    else if (k === 'build') api.tool({ kind: 'building', type: id });
    else if (k === 'view') { overlay = id; api.overlay(id); markBar(); }
  });

  // ---------- confirm bar (used by the build tools) ----------
  el.cCancel.onclick = () => { api.click(); api.cancel(); };
  el.cUndo.onclick = () => { api.click(); api.undo(); };
  el.cOk.onclick = () => api.confirm();
  function setConfirm(c) {
    if (!c) { el.confirm.hidden = true; return; }
    el.confirm.hidden = false;
    el.cText.innerHTML = c.html;
    el.cOk.disabled = !c.ok;
    el.cOk.textContent = c.label || 'Build';
    el.cOk.className = 'btn ' + (c.red ? 'red' : 'go');
    el.cOk.hidden = !!c.noOk;
    el.cUndo.hidden = !c.undo;
    el.cCancel.textContent = c.cancel || 'Cancel';
    el.cCancel.hidden = !!c.noCancel;
    el.card.hidden = true; card = null;
  }

  // ---------- speed and menu ----------
  el.speed.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { api.click(); api.speed(+b.dataset.s); } });
  function setSpeed(s) { for (const b of el.speed.children) b.classList.toggle('on', +b.dataset.s === s); }
  el.menuBtn.onclick = () => { api.click(); showPause(); };
  el.goalChip.onclick = () => { api.click(); showGoals(); };

  // ---------- toasts ----------
  function toast(html, kind = '', ms = 3600) {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = html;
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms);
  }

  // ---------- the info card ----------
  function showCard(sel) {
    card = sel;
    el.card.hidden = !sel;
    if (sel) { last.card = ''; drawCard(); }
  }
  el.card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || !card) return;
    api.click();
    const a = b.dataset.a;
    if (a === 'x') { showCard(null); api.select(null); }
    else if (a === 'toggle') api.toggleLift(card.item.id);
    else if (a === 'remove') { const c = card; showCard(null); api.remove(c.kind, c.item); }
  });

  function drawCard() {
    if (!card) return;
    const { kind, item } = card;
    let h = '<button class="x" data-a="x" aria-label="Close">&times;</button>';
    const dl = (rows) => '<dl>' + rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('') + '</dl>';
    if (kind === 'lift') {
      const L = LIFTS[item.type], wait = item.queue.length * L.interval / L.seats;
      const status = item.storm ? '<b class="neg">Closed by the storm</b>' : item.open ? '<b class="pos">Open</b>' : '<b class="neg">Closed</b>';
      h += `<h3>${esc(item.name)}</h3><div class="sub">${L.name}</div>` + dl([
        ['Status', status], ['In the queue', `${item.queue.length} (${Math.round(wait * T.MIN_PER_SEC)} min wait)`], ['Riding', item.riders],
        ['Carries', `${Math.round(L.seats / L.interval * 60 / T.MIN_PER_SEC)} an hour`], ['Costs', `${money(L.run)} a day`],
      ]) + `<div class="row"><button class="btn small" data-a="toggle">${item.open ? 'Close lift' : 'Open lift'}</button><button class="btn small" data-a="remove">Remove</button></div>`;
    } else if (kind === 'piste') {
      const d = DIFF[item.diff], q = item.quality ?? 1;
      h += `<h3><i class="dotc" style="background:${d.css}"></i>${esc(item.name)}</h3><div class="sub">${d.name} piste, ${d.word}</div>` + dl([
        ['Length', Math.round(item.len) + ' tiles'], ['Steepest part', pct(item.steep)], ['Snow', q > 0.75 ? 'Great' : q > 0.5 ? 'Good' : q > 0.35 ? 'Thin' : 'Bare patches'],
        ['Groomed', item.groomed ? 'Yes' : 'No'], ['Runs today', item.runs || 0],
      ]) + `<div class="meter"><i style="width:${pct(q)};background:${q > 0.5 ? 'var(--good)' : q > 0.35 ? 'var(--gold)' : 'var(--bad)'}"></i></div>`
        + '<div class="row"><button class="btn small" data-a="remove">Remove</button></div>';
    } else if (kind === 'building') {
      const B = BUILDINGS[item.type];
      const rows = [['Costs', `${money(B.upkeep)} a day`]];
      if (item.type === 'hut') rows.unshift(['Guests inside', `${item.busy || 0} of ${T.HUT_SEATS}`]);
      if (item.type === 'hotel') rows.unshift(['Beds filled', pct(hotelShare(state))]);
      if (item.type === 'rental') rows.unshift(['Rented today', state.today.rented]);
      h += `<h3>${B.name}</h3><div class="sub">${B.blurb}</div>` + dl(rows) + '<div class="row"><button class="btn small" data-a="remove">Remove</button></div>';
    } else if (kind === 'guest') {
      if (item.st === 'gone') { showCard(null); api.select(null); return; }
      const doing = { walk: 'Walking', queue: 'Queueing', ride: 'On the lift', ski: 'Skiing', eat: 'Having lunch', stuck: 'Stranded', decide: 'Looking around' }[item.st] || '';
      const bar = (v, c) => `<div class="meter"><i style="width:${pct(Math.max(0, Math.min(1, v)))};background:${c}"></i></div>`;
      h += `<h3><i class="dotc" style="background:${api.jacket(item.col)}"></i>${SKILL[item.skill]} skier</h3><div class="sub">${doing}${item.leaving ? ', heading home' : ''} · ${item.runs} runs</div>`
        + `<dl><dt>Mood</dt><dd>${bar(item.happy, item.happy > 0.6 ? 'var(--good)' : item.happy > 0.35 ? 'var(--gold)' : 'var(--bad)')}</dd>`
        + `<dt>Energy</dt><dd>${bar(item.energy, 'var(--blue)')}</dd><dt>Hunger</dt><dd>${bar(item.hunger, 'var(--gold)')}</dd></dl>`
        + `<div class="quote">“${esc(item.thought)}”</div>`;
    } else if (kind === 'base') {
      h += `<h3>Car park</h3><div class="sub">Guests arrive and leave here. Anything within ${T.R_BASE} tiles counts as next to it.</div>`
        + dl([['Arrived today', state.today.arrived], ['On the mountain', state.guests.length], ['Day ticket', money(state.ticket)]]);
    }
    if (h !== last.card) { el.card.innerHTML = h; last.card = h; }
  }

  // ---------- sheets ----------
  function sheet(title, html, kind, onClose) {
    sheetKind = kind; sheetClose = onClose || null;
    el.sheetTitle.textContent = title;
    el.sheetBody.innerHTML = html;
    el.sheet.hidden = false;
    el.sheetX.hidden = kind === 'summary';
    api.sheet(true);
  }
  function closeSheet() {
    if (el.sheet.hidden) return;
    el.sheet.hidden = true;
    const f = sheetClose; sheetKind = null; sheetClose = null;
    api.sheet(false);
    if (f) f();
  }
  el.sheetX.onclick = () => { api.click(); closeSheet(); };
  el.sheet.addEventListener('pointerdown', (e) => { if (e.target === el.sheet && sheetKind !== 'summary') closeSheet(); });

  function showGoals() {
    const now = currentGoal(state);
    let h = state.sandbox ? '<p>Sandbox: everything is unlocked and money is unlimited. Goals still tick off.</p>' : '';
    for (const g of GOALS) {
      const done = state.goals[g.id], cur = g === now;
      const unlock = g.unlock ? ' Unlocks: ' + g.unlock.map((k) => (LIFTS[k] || BUILDINGS[k]).name).join(', ') + '.' : '';
      h += `<div class="goal${done ? ' done' : ''}${cur ? ' now' : ''}"><div class="tick">${done ? '✓' : ''}</div><b>${g.text}</b><em>+${money(g.reward)}</em>`
        + `<span>${cur ? g.hint + unlock : done ? 'Done on day ' + done + '.' : unlock.trim()}</span></div>`;
    }
    sheet('Goals', h, 'goals');
  }

  function financeBody() {
    const t = state.today, c = dailyCosts(state), fair = fairTicket(state);
    const hist = state.history.slice(-30);
    const max = Math.max(300, ...hist.map((x) => Math.abs(x.profit)));
    const bars = hist.map((x) => `<div class="col" title="Day ${x.day}: ${money(x.profit)}"><div>${x.profit >= 0 ? `<i style="height:${Math.max(3, x.profit / max * 100)}%"></i>` : ''}</div>`
      + `<div>${x.profit < 0 ? `<i class="n" style="height:${Math.max(3, -x.profit / max * 100)}%"></i>` : ''}</div></div>`).join('');
    const hotels = count(state, 'hotel');
    return `<div class="slider"><label>Day ticket</label><output id="tOut">${money(state.ticket)}</output><input type="range" id="tIn" min="5" max="90" step="1" value="${state.ticket}">`
      + `<small>Guests think about <b>${money(fair)}</b> is fair for this resort. Cheaper brings more guests, dearer brings fewer and grumpier ones.</small></div>`
      + `<div class="slider"><label>Lunch at the hut</label><output id="fOut">${money(state.food)}</output><input type="range" id="fIn" min="4" max="30" step="1" value="${state.food}">`
      + `<small>Above ${money(T.FOOD * 1.4)} guests start to complain.</small></div>`
      + `<div class="note">Loan: <b>${money(state.loan)}</b> of ${money(T.LOAN_MAX)} · interest ${money(state.loan * T.INTEREST)} a day`
      + `<div class="row"><button class="btn small" id="loanM" ${state.loan <= 0 || state.money < T.LOAN_STEP ? 'disabled' : ''}>Pay back ${money(T.LOAN_STEP)}</button>`
      + `<button class="btn small" id="loanP" ${state.loan >= T.LOAN_MAX ? 'disabled' : ''}>Borrow ${money(T.LOAN_STEP)}</button></div></div>`
      + `<table class="t"><tr class="h"><td>Today so far</td><td></td></tr><tr><td>Tickets (${t.arrived} guests)</td><td class="pos">${money(t.income.tickets)}</td></tr>`
      + `<tr><td>Food</td><td class="pos">${money(t.income.food)}</td></tr><tr><td>Ski rental</td><td class="pos">${money(t.income.rental)}</td></tr>`
      + (hotels ? `<tr><td>Hotel tonight</td><td class="pos">${money(hotels * T.HOTEL_BEDS * hotelShare(state) * T.HOTEL_NIGHT)}</td></tr>` : '')
      + `<tr class="h"><td>Costs every day</td><td></td></tr><tr><td>Lifts</td><td class="neg">${money(-c.lifts)}</td></tr><tr><td>Buildings and staff</td><td class="neg">${money(-c.buildings)}</td></tr>`
      + `<tr><td>Resort base</td><td class="neg">${money(-c.base)}</td></tr>${c.interest ? `<tr><td>Interest</td><td class="neg">${money(-c.interest)}</td></tr>` : ''}`
      + `</table>${hist.length ? `<div class="chart">${bars}</div><small style="color:var(--dim)">Profit per day, last ${hist.length} days</small>` : ''}`;
  }
  function showFinance() {
    sheet('Money', financeBody(), 'money');
    wireFinance();
  }
  function wireFinance() {
    const tIn = $('tIn'), fIn = $('fIn');
    tIn.oninput = () => { state.ticket = +tIn.value; $('tOut').textContent = money(state.ticket); };
    fIn.oninput = () => { state.food = +fIn.value; $('fOut').textContent = money(state.food); };
    $('loanM').onclick = () => { api.loan(-T.LOAN_STEP); el.sheetBody.innerHTML = financeBody(); wireFinance(); };
    $('loanP').onclick = () => { api.loan(T.LOAN_STEP); el.sheetBody.innerHTML = financeBody(); wireFinance(); };
  }

  function showSummary() {
    const s = state.last;
    if (!s) return;
    const top = Object.entries(s.complaints).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const delta = s.rating - s.ratingBefore;
    let h = `<div class="big"><div><b>${s.guests}</b><small>guests</small></div><div><b class="${s.profit >= 0 ? 'pos' : 'neg'}">${money(s.profit)}</b><small>profit</small></div>`
      + `<div><b>${s.sat == null ? '–' : pct(s.sat)}</b><small>guest mood</small></div></div>`
      + `<table class="t"><tr><td>Income</td><td class="pos">${money(s.income)}</td></tr><tr><td>Running costs</td><td class="neg">${money(-s.costs)}</td></tr>`
      + (s.built ? `<tr><td>Spent on building</td><td>${money(-s.built)}</td></tr>` : '')
      + (s.detail.income.bonus ? `<tr><td>Goal bonuses</td><td class="pos">${money(s.detail.income.bonus)}</td></tr>` : '')
      + `<tr class="sum"><td>Rating</td><td>${stars(s.rating)} ${delta > 0.04 ? '<span class="pos">▲</span>' : delta < -0.04 ? '<span class="neg">▼</span>' : ''}</td></tr></table>`;
    if (!s.guests) h += '<div class="note">Nobody came. Guests need a lift next to the car park and a piste back down from its top.</div>';
    const AWAY = ['beginners stayed away: there is no easy (green) piste they can reach', 'intermediate skiers stayed away: they want a blue or red piste', 'experts stayed away: they want red or black pistes'];
    if (s.guests) s.away.forEach((n, k) => { if (n >= 3) h += `<div class="note"><b>${n}</b> ${AWAY[k]}.</div>`; });
    for (const [k, n] of top) h += `<div class="note"><b>${n}×</b> ${ADVICE[k] || k}</div>`;
    if (s.guests && !top.length) h += '<div class="note">No complaints today. </div>';
    if (s.guests >= 20 && state.ticket < fairTicket(state) * 0.65) h += `<div class="note">Your day ticket (${money(state.ticket)}) is cheap for a resort this good. Guests would pay about <b>${money(fairTicket(state))}</b>. Change it under Money.</div>`;
    if (s.seasonEnd) h += `<div class="note"><b>End of season ${seasonOf(state)}.</b> The snow starts fresh tomorrow.</div>`;
    h += `<div class="note">Tomorrow: ${ICON[s.forecast]} <b>${WEATHER[s.forecast].name}</b>${s.forecast === 'storm' ? '. High lifts will stay closed.' : s.forecast === 'thaw' ? '. Snow melts in the valley.' : ''}</div>`
      + '<div class="row"><button class="btn" id="sStay">Look around</button><button class="btn gold" id="sNext">Next day</button></div>';
    sheet(`${DAYS[(s.day - 1) % 7]}, day ${s.day} is over`, h, 'summary');
    $('sNext').onclick = () => { api.click(); closeSheet(); api.nextDay(); };
    $('sStay').onclick = () => { api.click(); closeSheet(); api.lookAround(); };
  }

  const HOW = `<p>You run a ski resort. Guests arrive at the <b>car park</b> every morning, and they need a way up and a way down.</p>
    <p><b>1. Lift.</b> Tap Lift, pick one, tap where the bottom station goes (near the car park), then tap higher up. Confirm.</p>
    <p><b>2. Piste.</b> Tap Piste, tap next to the top station, add points downhill, end next to a lift's bottom station or the car park. The colour shows how hard it is.</p>
    <p><b>3. Keep them happy.</b> Tap a guest to read their thoughts. Short queues, pistes for every level, food and good snow raise your stars. More stars bring more guests.</p>
    <p>Things count as connected when they are a few tiles apart. The bar above the Build button tells you what each end touches.</p>
    <p><b>Camera.</b> Touch: one finger moves, two fingers zoom, twist and tilt. Mouse: drag moves, right-drag turns, wheel zooms. Keys: <kbd>W A S D</kbd> move, <kbd>Q</kbd> <kbd>E</kbd> turn, <kbd>Space</kbd> pause, <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> speed, <kbd>Esc</kbd> cancel.</p>`;

  function settingsBody(s) {
    return `<div class="slider"><label>Sound volume</label><output id="vOut">${Math.round(s.volume * 100)}%</output><input type="range" id="vIn" min="0" max="1" step="0.05" value="${s.volume}"></div>`
      + `<label class="check" style="display:flex;margin:8px 0"><input type="checkbox" id="shIn" ${s.shadows ? 'checked' : ''}> Shadows (turn off if the game stutters)</label>`
      + `<label class="check" style="display:flex;margin:8px 0"><input type="checkbox" id="auIn" ${s.autoNext ? 'checked' : ''}> Start the next day by itself</label>`;
  }
  function wireSettings() {
    const s = api.settings();
    $('vIn').oninput = () => { s.volume = +$('vIn').value; $('vOut').textContent = Math.round(s.volume * 100) + '%'; api.applySettings(); };
    $('shIn').onchange = () => { s.shadows = $('shIn').checked; api.applySettings(); };
    $('auIn').onchange = () => { s.autoNext = $('auIn').checked; api.applySettings(); };
  }
  function showSettings() { sheet('Settings', settingsBody(api.settings()), 'settings'); wireSettings(); }
  function showHow() { sheet('How to play', HOW, 'how'); }

  function showPause() {
    const h = `<p>${esc(state.map.name)} · season ${seasonOf(state)}, day ${dayInSeason(state)} of ${T.SEASON_DAYS} · ${pisteLength(state).toFixed(0)} tiles of piste</p>`
      + '<div class="row"><button class="btn gold" id="pResume">Back to the mountain</button></div>'
      + '<div class="row"><button class="btn" id="pHow">How to play</button><button class="btn" id="pSet">Settings</button></div>'
      + '<div class="row"><button class="btn" id="pQuit">Save and go to the menu</button></div>';
    sheet('Paused', h, 'pause');
    $('pResume').onclick = () => { api.click(); closeSheet(); };
    $('pHow').onclick = () => { api.click(); showHow(); };
    $('pSet').onclick = () => { api.click(); showSettings(); };
    $('pQuit').onclick = () => { api.click(); closeSheet(); api.quit(); };
  }

  // ---------- main menu ----------
  el.howBtn.onclick = () => { api.click(); showHow(); };
  el.setBtn.onclick = () => { api.click(); showSettings(); };
  function showMenu(profile, saves) {
    el.menu.hidden = false; el.hud.hidden = true;
    el.maps.innerHTML = MAPS.map((m) => {
      const locked = m.needs && profile.stars < m.needs, sv = saves[m.id];
      const st = locked ? `Locked: reach ${m.needs} stars on another mountain` : sv ? `Day ${sv.day} · ${stars(sv.rating)}${sv.sandbox ? ' · sandbox' : ''}` : 'Not started yet';
      return `<div class="map${locked ? ' locked' : ''}"><div class="tagl">${m.tag}</div><h2>${m.name}</h2><p>${m.text}</p><div class="state">${st}</div>`
        + `<div class="row">${sv && !locked ? `<button class="btn gold" data-go="${m.id}">Continue</button><button class="btn" data-new="${m.id}">New</button>`
          : `<button class="btn gold" data-new="${m.id}" ${locked ? 'disabled' : ''}>Start</button>`}</div></div>`;
    }).join('');
  }
  el.maps.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    api.click();
    if (b.dataset.go) api.start(b.dataset.go, false, false);
    else if (b.dataset.new) {
      const has = b.parentElement.querySelector('[data-go]');
      if (has && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Erase?'; b.classList.add('red'); return; }
      api.start(b.dataset.new, true, el.sandbox.checked);
    }
  });
  function hideMenu() { el.menu.hidden = true; el.hud.hidden = false; }

  // ---------- every frame ----------
  function update(s) {
    state = s;
    const set = (k, node, v, html) => { if (last[k] !== v) { last[k] = v; if (html) node.innerHTML = v; else node.textContent = v; } };
    set('money', el.money, s.sandbox ? '∞' : money(s.money));
    el.sMoney.classList.toggle('neg', s.money < 0);
    set('guests', el.guests, String(s.guests.length));
    set('stars', el.sStars, stars(s.rating), true);
    set('clock', el.clock, `${DAYS[(s.day - 1) % 7]} ${hhmm(Math.min(s.clock, T.DAY_END))}`);
    set('day', el.dayNo, `Day ${s.day}`);
    set('w', el.wIcon, ICON[s.weather], true);
    el.wIcon.title = WEATHER[s.weather].name;
    const g = currentGoal(s);
    const early = Object.keys(s.goals).length < 3 && !s.sandbox;
    set('goal', el.goalChip, g ? `<b>Goal:</b> ${g.text} <span class="rw">+${money(g.reward)}</span>${early ? `<span>${g.hint}</span>` : ''}` : '<b>All goals done.</b> A legendary resort!', true);
    if (card) drawCard();
  }

  return { update, toast, showCard, setConfirm, setSpeed, showMenu, hideMenu, showSummary, showGoals, showFinance, showPause, showSettings, closeSheet, closeSub,
    setTool(t) { activeTool = t; document.body.classList.toggle('tooling', !!t); markBar(); }, get card() { return card; }, get sheetOpen() { return !el.sheet.hidden; }, labels: el.labels };
}
