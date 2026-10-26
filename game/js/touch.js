// Touch controls for phones and tablets: a floating stick on the left half,
// drag to look on the right half, and on-screen buttons.

export const isTouch = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');

const LOOK_SENS = 2.2; // touch pixels feel much shorter than mouse counts
const STICK_R = 60;

export function initTouch(game, { keys, firing, pause }) {
  document.body.classList.add('touch');
  const ui = document.getElementById('touchUI');
  const stick = document.getElementById('stick');
  const knob = document.getElementById('knob');
  const useBtn = ui.querySelector('[data-act="use"]');
  game.touchMove = { x: 0, y: 0, sprint: false };

  const acts = {
    fire: (down) => firing(down),
    aim: (down) => { if (down) game.aiming = !game.aiming; },
    jump: (down) => { keys.Space = down; },
    reload: (down) => down && game.arsenal.startReload(),
    swap: (down) => down && game.arsenal.cycle(),
    grenade: (down) => down && game.items.throwGrenade(),
    use: (down) => { if (down) { const n = game.items.nearest(); if (n) n.it.use(); } },
    pause: (down) => down && pause(),
  };

  // Each finger keeps the role it started with until it lifts.
  const roles = new Map();
  let stickId = null, stickX = 0, stickY = 0;

  function moveStick(t) {
    let dx = t.clientX - stickX, dy = t.clientY - stickY;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    game.touchMove.x = dx / STICK_R;
    game.touchMove.y = dy / STICK_R;
    game.touchMove.sprint = dy / STICK_R < -0.92;
  }

  function endStick() {
    stickId = null;
    stick.style.display = 'none';
    game.touchMove.x = game.touchMove.y = 0;
    game.touchMove.sprint = false;
  }

  ui.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (game.state.mode !== 'playing') return;
    for (const t of e.changedTouches) {
      const btn = t.target.closest?.('[data-act]');
      if (btn) {
        const act = btn.dataset.act;
        roles.set(t.identifier, { act, btn, x: t.clientX, y: t.clientY });
        btn.classList.add('down');
        acts[act](true);
      } else if (t.clientX < innerWidth * 0.4 && stickId === null) {
        stickId = t.identifier;
        stickX = t.clientX; stickY = t.clientY;
        stick.style.display = 'block';
        stick.style.left = stickX + 'px';
        stick.style.top = stickY + 'px';
        moveStick(t);
        roles.set(t.identifier, { act: 'stick' });
      } else {
        roles.set(t.identifier, { act: 'look', x: t.clientX, y: t.clientY });
      }
    }
  }, { passive: false });

  ui.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const r = roles.get(t.identifier);
      if (!r) continue;
      if (r.act === 'stick') { moveStick(t); continue; }
      // Looking works while holding fire, so you can track a target.
      if (r.act === 'look' || r.act === 'fire') {
        if (game.state.mode === 'playing') game.player.look((t.clientX - r.x) * LOOK_SENS, (t.clientY - r.y) * LOOK_SENS);
        r.x = t.clientX; r.y = t.clientY;
      }
    }
  }, { passive: false });

  function end(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const r = roles.get(t.identifier);
      if (!r) continue;
      roles.delete(t.identifier);
      if (r.act === 'stick') endStick();
      else if (r.btn) {
        r.btn.classList.remove('down');
        if (r.act === 'fire' || r.act === 'jump') acts[r.act](false);
      }
    }
  }
  ui.addEventListener('touchend', end, { passive: false });
  ui.addEventListener('touchcancel', end, { passive: false });

  // Light up the buttons that matter right now.
  function tick() {
    requestAnimationFrame(tick);
    if (game.state.mode !== 'playing') return;
    useBtn.classList.toggle('ready', !!game.items.nearest());
    ui.querySelector('[data-act="aim"]').classList.toggle('on', game.aiming);
  }
  tick();

  return {
    // Release everything, e.g. when pausing or dying.
    reset() {
      for (const r of roles.values()) r.btn?.classList.remove('down');
      roles.clear();
      endStick();
      firing(false);
      keys.Space = false;
      game.aiming = false;
    },
  };
}
