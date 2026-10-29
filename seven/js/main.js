// Screens and rendering: setup → draft → cup (seven matches) → end.

import { SQUADS } from './data.js';
import { FORMATIONS, fitRating } from './formations.js';
import { newDraft, spin, reroll, place, slotsForPlayer, fits, isFull, openSlots } from './draft.js';
import { teamRating, drawOpponents, simulate, ROUNDS, SHORT } from './sim.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let formation = '4-3-3', mode = 'classic';
let d = null, selected = null, team = null, cup = null;

// ---------- stats ----------
const STATS_KEY = 'seven-nil-stats';
function loadStats() {
  try { return { played: 0, perfect: 0, titles: 0, best: 0, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') }; }
  catch { return { played: 0, perfect: 0, titles: 0, best: 0 }; }
}
function saveStats(s) { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* private mode */ } }

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  scrollTo(0, 0);
}

// ---------- setup ----------
function renderSetup() {
  $('forms').innerHTML = FORMATIONS.map((f) => `<button class="chip" data-f="${f}" aria-pressed="${f === formation}">${f}</button>`).join('');
  for (const b of document.querySelectorAll('#modes .chip')) b.setAttribute('aria-pressed', b.dataset.mode === mode);
  const s = loadStats();
  $('stats').textContent = s.played
    ? `Runs ${s.played} · Perfect 7–0s ${s.perfect} · Titles ${s.titles} · Best ${s.best} wins`
    : 'No runs yet.';
  show('setup');
}
$('forms').addEventListener('click', (e) => {
  const f = e.target.closest('[data-f]')?.dataset.f;
  if (f) { formation = f; renderSetup(); }
});
$('modes').addEventListener('click', (e) => {
  const m = e.target.closest('[data-mode]')?.dataset.mode;
  if (m) { mode = m; renderSetup(); }
});
$('start').addEventListener('click', () => {
  d = newDraft(formation);
  selected = null;
  document.body.classList.toggle('blind', mode === 'blind');
  $('sFlag').textContent = '🌍'; $('sNation').textContent = 'Ready?'; $('sYear').textContent = 'Spin for a squad';
  $('note').textContent = '';
  renderDraft();
  show('draft');
});

// ---------- draft ----------
function renderPitch() {
  const targets = selected ? new Set(slotsForPlayer(d, selected)) : new Set();
  $('pitch').innerHTML = d.slots.map((s) => {
    const p = s.player;
    const inner = p ? (mode === 'blind' ? s.role : fitRating(p, s.role)) : s.role;
    return `<button class="slot ${p ? 'filled' : ''} ${targets.has(s) ? 'target' : ''}" data-i="${s.i}"
      style="left:${s.x}%;top:${s.y}%" ${targets.has(s) ? '' : 'disabled'}>
      <span class="dot">${inner}</span>
      ${p ? `<span class="nm">${esc(p.n)}</span><span class="fl">${p.flag} '${String(p.year).slice(2)}</span>` : ''}
    </button>`;
  }).join('');
  const r = teamRating(d.slots), filled = d.slots.filter((s) => s.player).length;
  const n = (v) => (filled ? Math.round(v) : '–');
  $('ratings').innerHTML = `<div><b>${n(r.att)}</b><span>ATT</span></div><div><b>${n(r.mid)}</b><span>MID</span></div>
    <div><b>${n(r.def)}</b><span>DEF</span></div><div><b>+${r.chem.toFixed(1)}</b><span>CHEM</span></div>`;
}

function renderList() {
  const sq = d.current;
  if (!sq) { $('list').innerHTML = ''; return; }
  const players = [...sq.players].sort((a, b) => fits(d, b) - fits(d, a) || (mode === 'blind' ? 0 : b.r - a.r));
  $('list').innerHTML = players.map((p) => {
    const i = sq.players.indexOf(p);
    return `<button class="row ${p === selected ? 'sel' : ''}" data-p="${i}" ${fits(d, p) ? '' : 'disabled'}>
      <span class="pn">${esc(p.n)}</span>
      <span class="poss">${p.pos.map((x) => `<span class="pos">${x}</span>`).join('')}</span>
      <span class="r">${p.r}</span></button>`;
  }).join('');
}

function renderDraft() {
  const full = isFull(d);
  $('pickN').textContent = full ? 'XI complete' : `Pick ${12 - openSlots(d).length} / 11`;
  $('formN').textContent = `${d.formation} · ${mode === 'blind' ? 'Blind' : 'Classic'}`;
  $('spin').disabled = !!d.current || full;
  $('reroll').disabled = !d.current || d.rerolls <= 0;
  $('reroll').textContent = `Reroll (${d.rerolls})`;
  $('kickoff').hidden = !full;
  if (full) document.body.classList.remove('blind'); // reveal the ratings once the XI is set
  renderPitch();
  renderList();
}

async function rollTo(fn) {
  $('spin').disabled = $('reroll').disabled = true;
  selected = null;
  $('list').innerHTML = '';
  const box = $('spinbox');
  box.classList.add('rolling');
  for (let i = 0; i < 12; i++) {
    const s = SQUADS[Math.floor(Math.random() * SQUADS.length)];
    $('sFlag').textContent = s.flag; $('sNation').textContent = s.nation; $('sYear').textContent = s.year;
    await sleep(45 + i * 6);
  }
  box.classList.remove('rolling');
  const sq = fn();
  if (sq) {
    $('sFlag').textContent = sq.flag; $('sNation').textContent = sq.nation; $('sYear').textContent = `World Cup ${sq.year}`;
  }
  const skipped = d.skipped.map((s) => `${s.nation} ${s.year}`);
  $('note').textContent = skipped.length ? `Skipped ${skipped.join(', ')} — nobody there fits your open slots.` : 'Tap a player, then a glowing slot.';
  renderDraft();
}

$('spin').addEventListener('click', () => rollTo(() => spin(d)));
$('reroll').addEventListener('click', () => rollTo(() => reroll(d)));

$('list').addEventListener('click', (e) => {
  const row = e.target.closest('[data-p]');
  if (!row || row.disabled) return;
  const p = d.current.players[row.dataset.p];
  const targets = slotsForPlayer(d, p);
  if (targets.length === 1) return commit(p, targets[0]);
  selected = p;
  renderDraft();
});
$('pitch').addEventListener('click', (e) => {
  const el = e.target.closest('[data-i]');
  if (el && selected) commit(selected, d.slots[el.dataset.i]);
});

function commit(p, slot) {
  if (!place(d, p, slot)) return;
  selected = null;
  $('sFlag').textContent = '🌍';
  $('sNation').textContent = isFull(d) ? 'Your XI is ready' : 'Next pick';
  $('sYear').textContent = isFull(d) ? 'Seven wins to go' : 'Spin for a squad';
  $('note').textContent = '';
  renderDraft();
}

// ---------- cup ----------
$('kickoff').addEventListener('click', () => {
  team = { slots: d.slots, rating: teamRating(d.slots) };
  cup = { opps: drawOpponents(), results: [], round: 0, pts: 0, gd: 0 };
  show('cup');
  playRound();
});

function renderRail() {
  $('rail').innerHTML = SHORT.map((s, i) => {
    const r = cup.results[i];
    const cls = r ? r.result : i === cup.round ? 'now' : '';
    const sc = r ? `${r.gf}–${r.ga}${r.pens ? 'p' : ''}` : '';
    return `<div class="stage ${cls}">${s}<small>${sc || '&nbsp;'}</small></div>`;
  }).join('');
}

const teamBox = (flag, name, sub) => `<span class="flag">${flag}</span>${esc(name)}<small>${esc(sub)}</small>`;

let skipping = false;
async function playRound() {
  const r = cup.round, opp = cup.opps[r], ko = r >= 3;
  const m = simulate(team, opp, ko);
  skipping = false;
  renderRail();
  $('round').textContent = ROUNDS[r];
  $('home').innerHTML = teamBox('⭐', 'Your XI', `OVR ${Math.round(team.rating.ovr)}`);
  $('away').innerHTML = teamBox(opp.flag, `${opp.name} ${opp.year}`, `OVR ${Math.round(opp.rating.ovr)}`);
  $('score').textContent = '0–0'; $('clock').textContent = "0'";
  $('feed').innerHTML = ''; $('verdict').textContent = ''; $('verdict').className = 'verdict'; $('pens').textContent = '';
  $('skip').hidden = false; $('next').hidden = true;

  const end = m.et ? 120 : 90, sc = [0, 0];
  const evs = [...m.events].sort((a, b) => a.m - b.m);
  let k = 0;
  for (let min = 1; min <= end; min++) {
    while (k < evs.length && evs[k].m === min) {
      const e = evs[k++];
      sc[e.side]++;
      $('feed').insertAdjacentHTML('beforeend', `<li class="${e.side ? 'them' : ''}">⚽ ${e.m}' ${esc(e.who)}</li>`);
    }
    $('score').textContent = `${sc[0]}–${sc[1]}`;
    $('clock').textContent = min > 90 ? `${min}' ET` : `${min}'`;
    if (!skipping) await sleep(min === 90 && m.et ? 600 : 45);
  }
  if (m.pens) {
    $('clock').textContent = 'Penalties';
    let line = ['', ''];
    for (const [a, b] of m.pens.kicks) {
      line[0] += a ? '🟢' : '🔴'; line[1] += b ? '🟢' : '🔴';
      $('pens').innerHTML = `${line[0]}<br>${line[1]}`;
      if (!skipping) await sleep(380);
    }
    $('score').textContent = `${m.gf}–${m.ga} (${m.pens.a}–${m.pens.b} p)`;
  } else {
    $('clock').textContent = m.et ? 'After extra time' : 'Full time';
  }

  cup.results.push(m);
  let out = false;
  if (r < 3) {
    cup.pts += m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0;
    cup.gd += m.gf - m.ga;
    if (r === 2 && !(cup.pts >= 4 || (cup.pts === 3 && cup.gd > 0))) out = true;
  } else if (m.result === 'L') out = true;
  const label = { W: 'Win', D: 'Draw', L: 'Defeat' }[m.result];
  $('verdict').textContent = r === 2 ? `${label} · Group: ${cup.pts} pts, ${cup.gd >= 0 ? '+' : ''}${cup.gd}${out ? ' — out' : ' — through'}` : label;
  $('verdict').classList.add(m.result);
  cup.round++;
  renderRail();
  $('skip').hidden = true;
  const done = out || cup.round === 7;
  $('next').hidden = false;
  $('next').textContent = done ? 'See result' : `Next: ${ROUNDS[cup.round]}`;
  $('next').onclick = () => (done ? finish(out) : playRound());
}
$('skip').addEventListener('click', () => { skipping = true; });

// ---------- end ----------
function finish(out) {
  const res = cup.results, wins = res.filter((m) => m.result === 'W').length;
  const draws = res.filter((m) => m.result === 'D').length, losses = res.filter((m) => m.result === 'L').length;
  const perfect = wins === 7, champ = !out;
  const s = loadStats();
  s.played++; s.perfect += perfect; s.titles += champ; s.best = Math.max(s.best, wins);
  saveStats(s);

  $('headline').textContent = perfect ? '7–0!' : champ ? 'Champions' : `${wins}–${draws}–${losses}`;
  const pens = res.some((m) => m.pens && m.result === 'W');
  $('sub').textContent = perfect ? `A perfect World Cup${pens ? ' (one went to penalties!)' : ''}.`
    : champ ? `World champions, but with ${draws} draw${draws === 1 ? '' : 's'} — not perfect.`
    : `Out in the ${res.length <= 3 ? 'group stage' : ROUNDS[res.length - 1]}. Record ${wins}W ${draws}D ${losses}L.`;
  $('emoji').textContent = emojiRow();
  $('xi').innerHTML = team.slots.map((sl) => `<div><b>${sl.role}</b>${esc(sl.player.n)} <span class="muted">${sl.player.flag} ${sl.player.year} · ${fitRating(sl.player, sl.role)}</span></div>`).join('');
  $('shareNote').textContent = '';
  show('end');
}

const emojiRow = () => SHORT.map((_, i) => ({ W: '🟩', D: '🟨', L: '🟥' })[cup.results[i]?.result] || '⬛').join('');

$('share').addEventListener('click', async () => {
  const wins = cup.results.filter((m) => m.result === 'W').length;
  const text = [`Seven-Nil ⚽ ${wins === 7 ? '7–0 PERFECT' : `${wins}/7 wins`}`, emojiRow(),
    `${d.formation} · ${mode === 'blind' ? 'Blind' : 'Classic'} · OVR ${Math.round(team.rating.ovr)}`,
    team.slots.map((s) => `${s.role} ${s.player.n} '${String(s.player.year).slice(2)}`).join(', ')].join('\n');
  try { await navigator.clipboard.writeText(text); $('shareNote').textContent = 'Copied to clipboard.'; }
  catch { $('shareNote').textContent = text; }
});
$('again').addEventListener('click', renderSetup);

renderSetup();
