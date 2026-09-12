// Typing challenge: retype a sentence exactly. Characters are marked live;
// the challenge only passes when the whole input matches. Paste is blocked.

const SHORT = [
  'The early bird catches the worm.',
  'Coffee is waiting in the kitchen.',
  'Today is going to be a good day.',
  'Get up and open the curtains now.',
  'Every morning is a fresh start.',
  'Stretch your arms and stand up.',
  'The sun is already on its way.',
  'Breakfast tastes better standing up.',
  'Small steps still move you forward.',
  'Your bed will still be here tonight.',
  'Wake up, the world is waiting.',
  'A cold shower fixes most mornings.',
  'Put both feet on the floor now.',
  'Drink a glass of water first.',
  'Nobody ever regretted getting up early.',
];

const LONG = [
  'The quick brown fox jumps over the lazy dog while the farmer drinks his coffee.',
  'Seven sleepy penguins waddled across the frozen lake before the sun came up.',
  'If you snooze this alarm one more time, the coffee will get cold and bitter.',
  'A rolling stone gathers no moss, but a sleeping person gathers no breakfast.',
  'The train to the city leaves at exactly seven, and it never waits for anyone.',
  'Yesterday you promised yourself that today you would finally get up on time.',
  'Bright morning light spilled through the window and onto the wooden floor.',
  'Twelve purple umbrellas stood in a row next to the old bakery on Main Street.',
  'Please remember to water the plants, feed the cat, and take out the recycling.',
  'The mountain air was crisp and clear, and the trail ahead looked long but inviting.',
  'A good breakfast, a short walk, and a clear plan make the whole day run smoother.',
  'Somewhere out there, a very patient kettle is waiting to be switched on by you.',
  'Nine curious ducks followed the baker home because he smelled like fresh bread.',
  'Getting up is the hardest part; everything after that is just a normal day.',
  'Write down three things you want to finish today before you check your phone.',
];

function randomChars(length = 12) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

function pickTarget(difficulty) {
  switch (Number(difficulty)) {
    case 1: return SHORT[Math.floor(Math.random() * SHORT.length)];
    case 3: return randomChars(12);
    default: return LONG[Math.floor(Math.random() * LONG.length)];
  }
}

let cleanup = null;

export const typing = {
  id: 'typing',
  label: 'Typing',

  mount(container, settings, { onPass, onActivity }) {
    const target = pickTarget(settings.typing?.difficulty ?? 2);

    container.innerHTML = `
      <div class="challenge-title">Type this exactly</div>
      <div class="typing-target" data-target></div>
      <textarea class="typing-input" data-input rows="3" autocomplete="off" autocorrect="off"
                autocapitalize="off" spellcheck="false" placeholder="Type here…"></textarea>
    `;
    const targetEl = container.querySelector('[data-target]');
    const input = container.querySelector('[data-input]');

    const spans = Array.from(target, ch => {
      const s = document.createElement('span');
      s.textContent = ch;
      return s;
    });
    targetEl.append(...spans);

    const render = () => {
      const typed = input.value;
      spans.forEach((s, i) => {
        s.className = '';
        if (i < typed.length) s.classList.add(typed[i] === target[i] ? 'ok' : 'bad');
        else if (i === typed.length) s.classList.add('cur');
      });
      if (typed === target) onPass();
    };

    const onInput = () => { onActivity(); render(); };
    const onPaste = (e) => e.preventDefault();
    const onDrop = (e) => e.preventDefault();
    input.addEventListener('input', onInput);
    input.addEventListener('paste', onPaste);
    input.addEventListener('drop', onDrop);
    cleanup = () => {
      input.removeEventListener('input', onInput);
      input.removeEventListener('paste', onPaste);
      input.removeEventListener('drop', onDrop);
    };

    render();
    input.focus();
  },

  unmount() {
    if (cleanup) { cleanup(); cleanup = null; }
  },
};
