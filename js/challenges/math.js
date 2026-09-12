// Math challenge: solve `count` arithmetic problems. A wrong answer swaps in a
// fresh problem without advancing progress.

const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

/** Returns { text, answer } for the given difficulty (1–3). */
export function generateProblem(difficulty = 2) {
  switch (Number(difficulty)) {
    case 1: {
      const a = rnd(5, 40), b = rnd(5, 40);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    case 3: {
      const a = rnd(11, 25), b = rnd(3, 9), c = rnd(11, 25), d = rnd(2, 6);
      // Keep the result positive so the user never needs a minus sign.
      const [x, y] = a * b >= c * d ? [[a, b], [c, d]] : [[c, d], [a, b]];
      return { text: `${x[0]} × ${x[1]} − ${y[0]} × ${y[1]}`, answer: x[0] * x[1] - y[0] * y[1] };
    }
    default: {
      const a = rnd(6, 19), b = rnd(3, 9), c = rnd(10, 60);
      return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
    }
  }
}

let cleanup = null;

export const math = {
  id: 'math',
  label: 'Math',

  mount(container, settings, { onPass, onActivity }) {
    const count = Math.max(1, Number(settings.math?.count ?? 3));
    const difficulty = Number(settings.math?.difficulty ?? 2);
    let solved = 0;
    let current = generateProblem(difficulty);

    container.innerHTML = `
      <div class="challenge-title">Solve ${count} problem${count > 1 ? 's' : ''}</div>
      <div class="progress" data-progress></div>
      <div class="problem" data-problem></div>
      <input class="answer" data-answer type="text" inputmode="numeric" pattern="[0-9]*"
             autocomplete="off" autocorrect="off" spellcheck="false" placeholder="?" enterkeyhint="go">
      <button class="btn primary" data-submit>Check</button>
    `;
    const progressEl = container.querySelector('[data-progress]');
    const problemEl = container.querySelector('[data-problem]');
    const input = container.querySelector('[data-answer]');
    const submit = container.querySelector('[data-submit]');

    const renderProgress = () => {
      progressEl.innerHTML = Array.from({ length: count }, (_, i) =>
        `<i class="${i < solved ? 'done' : ''}"></i>`).join('');
    };
    const renderProblem = () => {
      problemEl.textContent = `${current.text} = ?`;
      input.value = '';
      input.focus();
    };

    const check = () => {
      onActivity();
      const value = input.value.trim();
      if (value === '') return;
      if (Number(value) === current.answer) {
        solved++;
        renderProgress();
        if (solved >= count) { onPass(); return; }
      } else {
        problemEl.classList.remove('shake');
        void problemEl.offsetWidth; // restart the animation
        problemEl.classList.add('shake');
      }
      current = generateProblem(difficulty);
      renderProblem();
    };

    const onKey = (e) => { onActivity(); if (e.key === 'Enter') { e.preventDefault(); check(); } };
    input.addEventListener('keydown', onKey);
    input.addEventListener('input', onActivity);
    submit.addEventListener('click', check);
    cleanup = () => {
      input.removeEventListener('keydown', onKey);
      input.removeEventListener('input', onActivity);
      submit.removeEventListener('click', check);
    };

    renderProgress();
    renderProblem();
  },

  unmount() {
    if (cleanup) { cleanup(); cleanup = null; }
  },
};
