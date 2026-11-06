// Controls: a floating joystick on the left of the screen, JUMP, GRAB, STYLE
// and TUCK buttons on the right, and the keyboard on a computer.

export const isTouch = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
const STICK_R = 58;
// On a keyboard the touch buttons stay on screen with their key under them:
// a button lights up while its key is held, H hides the key labels.
const KEY_BTN = {
  Space: 'jump', ShiftLeft: 'grab', ShiftRight: 'grab', KeyJ: 'grab', KeyK: 'style', KeyL: 'style',
  KeyE: 'butter', ControlLeft: 'butter', KeyQ: 'rollL', KeyR: 'rollR', KeyT: 'reset', Escape: 'pause', KeyP: 'pause',
};
function lightKey(code, on) {
  const el = KEY_BTN[code] && document.querySelector(`[data-btn="${KEY_BTN[code]}"]`);
  if (el) el.classList.toggle('down', on);
}
function toggleKeyHints() {
  const off = document.body.classList.toggle('nokeys');
  try { localStorage.setItem('freshline.nokeys', off ? '1' : ''); } catch { /* private mode */ }
}
try { if (localStorage.getItem('freshline.nokeys')) document.body.classList.add('nokeys'); } catch { /* private mode */ }

const GRAB_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyJ'];
const STYLE_KEYS = ['KeyK', 'KeyL'];
const BUTTER_KEYS = ['KeyE', 'ControlLeft'];

export class Input {
  constructor({ onPause, onReset }) {
    this.x = 0; this.y = 0;
    this.jump = false; this.grab = false; this.style = false; this.butter = false;
    this.jumpReleased = false;
    this.roll = 0; this.touchRoll = 0; // -1 rolls left, 1 rolls right
    this.keys = new Set();
    this.stick = { x: 0, y: 0 };
    this.enabled = false;
    this.onPause = onPause;
    this.onReset = onReset;
    if (isTouch) document.body.classList.add('touch');
    this.initKeys();
    this.initTouch();
  }

  initKeys() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      lightKey(e.code, true);
      if (e.code === 'KeyH' && !e.repeat) toggleKeyHints();
      if (e.code === 'Escape' || e.code === 'KeyP') this.onPause();
      if (e.code === 'KeyT') this.onReset();
      if (e.code === 'Space') { this.jump = true; e.preventDefault(); }
      if (GRAB_KEYS.includes(e.code)) this.grab = true;
      if (STYLE_KEYS.includes(e.code)) this.style = true;
      if (BUTTER_KEYS.includes(e.code) && !e.repeat) this.butter = true;
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      lightKey(e.code, false);
      if (e.code === 'Space' && this.jump) { this.jump = false; this.jumpReleased = true; }
      if (GRAB_KEYS.includes(e.code)) this.grab = false;
      if (STYLE_KEYS.includes(e.code)) this.style = false;
    });
    addEventListener('blur', () => { this.keys.clear(); for (const el of document.querySelectorAll('[data-btn].down')) el.classList.remove('down'); this.jump = this.grab = this.style = false; });
  }

  initTouch() {
    const zone = document.getElementById('stickZone');
    const base = document.getElementById('stick');
    const knob = document.getElementById('knob');
    let id = null, cx = 0, cy = 0;
    const rest = () => {
      base.classList.remove('live');
      base.style.left = base.style.top = '';
      knob.style.transform = '';
    };
    const move = (e) => {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / STICK_R;
      this.stick.y = dy / STICK_R;
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      e.preventDefault();
      id = e.pointerId;
      zone.setPointerCapture(id);
      cx = e.clientX; cy = e.clientY;
      base.classList.add('live');
      base.style.left = cx + 'px';
      base.style.top = cy + 'px';
      move(e);
    });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.stick.x = this.stick.y = 0;
      rest();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    for (const el of document.querySelectorAll('[data-btn]')) {
      const act = el.dataset.btn;
      const down = (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        el.classList.add('down');
        if (act === 'jump') this.jump = true;
        if (act === 'grab') this.grab = true;
        if (act === 'style') this.style = true;
        if (act === 'butter') this.butter = true;
        if (act === 'pause') this.onPause();
        if (act === 'reset') this.onReset();
        if (act === 'rollL') this.touchRoll = -1;
        if (act === 'rollR') this.touchRoll = 1;
      };
      const up = () => {
        el.classList.remove('down');
        if (act === 'jump' && this.jump) { this.jump = false; this.jumpReleased = true; }
        if (act === 'grab') this.grab = false;
        if (act === 'style') this.style = false;
        if (act === 'rollL' || act === 'rollR') this.touchRoll = 0;
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  // Called once per frame before physics.
  read() {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (x && y) { x *= 0.75; y *= 0.75; }
    this.x = Math.max(-1, Math.min(1, x + this.stick.x));
    this.y = Math.max(-1, Math.min(1, y + this.stick.y));
    this.roll = Math.max(-1, Math.min(1, (k.has('KeyR') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0) + this.touchRoll));
    if (!isTouch) { // the on-screen stick follows the keys
      if (!this.knob) this.knob = document.getElementById('knob');
      this.knob.style.transform = x || y ? `translate(${x * STICK_R}px, ${y * STICK_R}px)` : '';
      this.knob.parentElement.classList.toggle('live', !!(x || y));
    }
  }

  // Release events last one physics step.
  consume() { this.jumpReleased = this.butter = false; }

  clear() {
    this.jump = this.grab = this.style = this.butter = this.jumpReleased = false;
    this.stick.x = this.stick.y = this.touchRoll = this.roll = 0;
  }
}
