// "Still awake?" prompt shown a few minutes after the chain is completed.
// One easy math problem; the caller enforces the deadline.

import { generateProblem } from './challenges/math.js';

let cleanup = null;

export function mountRecheckPrompt(container, { onPass, onActivity }) {
  let current = generateProblem(1);

  container.innerHTML = `
    <div class="challenge-title">Prove you're still up</div>
    <div class="problem" data-problem></div>
    <input class="answer" data-answer type="text" inputmode="numeric" pattern="[0-9]*"
           autocomplete="off" autocorrect="off" spellcheck="false" placeholder="?" enterkeyhint="go">
    <button class="btn primary" data-submit>Check</button>
  `;
  const problemEl = container.querySelector('[data-problem]');
  const input = container.querySelector('[data-answer]');
  const submit = container.querySelector('[data-submit]');

  const render = () => {
    problemEl.textContent = `${current.text} = ?`;
    input.value = '';
    input.focus();
  };
  const check = () => {
    onActivity();
    if (input.value.trim() === '') return;
    if (Number(input.value.trim()) === current.answer) { onPass(); return; }
    problemEl.classList.remove('shake');
    void problemEl.offsetWidth;
    problemEl.classList.add('shake');
    current = generateProblem(1);
    render();
  };
  const onKey = (e) => { onActivity(); if (e.key === 'Enter') { e.preventDefault(); check(); } };

  input.addEventListener('keydown', onKey);
  submit.addEventListener('click', check);
  cleanup = () => {
    input.removeEventListener('keydown', onKey);
    submit.removeEventListener('click', check);
  };
  render();
}

export function unmountRecheckPrompt() {
  if (cleanup) { cleanup(); cleanup = null; }
}
