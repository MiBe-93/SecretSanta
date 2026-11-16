import { CONFIG } from './config.js';
import { loadParticipants, openEnvelope, MESSAGES } from './lib/lookup.js';

const $ = (id) => document.getElementById(id);
const AUTO_HIDE_SECONDS = 60;
const MAX_WAIT_SECONDS = 300;

let failures = 0; // bara i minnet, en "gardin" på klientsidan
let waitTimer = null;
let hideTimer = null;
let busy = false;

document.title = CONFIG.title;
$('title').textContent = CONFIG.title;
$('forgot').textContent = `Glömt koden? Fråga ${CONFIG.adminName}.`;

function showError(text) {
  $('error').textContent = text;
  $('error').hidden = !text;
}

async function load() {
  const participants = await loadParticipants();
  $('loading').hidden = true;
  if (!participants) {
    $('not-ready').hidden = false;
    return;
  }
  participants.sort((a, b) => String(a.name).localeCompare(String(b.name), 'sv'));
  const select = $('who');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '– välj ditt namn –';
  select.append(placeholder);
  for (const p of participants) {
    if (!/^[0-9a-f]{16}$/.test(p.id)) continue;
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    select.append(o);
  }
  $('form').hidden = false;
}

function startWait(seconds) {
  clearInterval(waitTimer);
  let left = seconds;
  const button = $('submit');
  const tick = () => {
    if (left <= 0) {
      clearInterval(waitTimer);
      button.disabled = false;
      button.textContent = 'Visa min person';
      return;
    }
    button.disabled = true;
    button.textContent = `Vänta ${left} s…`;
    left--;
  };
  tick();
  waitTimer = setInterval(tick, 1000);
}

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (busy || $('submit').disabled) return;
  const id = $('who').value;
  const pin = $('pin').value;
  showError('');
  if (!/^[0-9a-f]{16}$/.test(id)) return showError('Välj ditt namn i listan.');
  if (!/^\d{4}$/.test(pin)) return showError('Koden är 4 siffror.');

  busy = true;
  $('submit').disabled = true;
  $('submit').textContent = 'Kontrollerar…';
  let result;
  try {
    result = await openEnvelope({ id, pin });
  } finally {
    busy = false;
  }

  if (result.ok) {
    failures = 0;
    show(result.name);
    return;
  }
  if (result.reason === 'wrong-code') {
    failures++;
    showError(MESSAGES.wrongCode);
    $('pin').value = '';
    startWait(Math.min(2 ** failures, MAX_WAIT_SECONDS));
    return;
  }
  // Gammal lottning (404) eller nätfel: inget fel på koden, ingen väntetid.
  showError(result.message);
  $('submit').disabled = false;
  $('submit').textContent = 'Visa min person';
});

function show(name) {
  $('recipient').textContent = name;
  $('form').hidden = true;
  $('result').hidden = false;
  $('pin').value = '';
  $('submit').disabled = false;
  $('submit').textContent = 'Visa min person';
  let left = AUTO_HIDE_SECONDS;
  const tick = () => {
    if (left <= 0) return hide();
    $('countdown').textContent = `Döljs automatiskt om ${left} s`;
    left--;
  };
  clearInterval(hideTimer);
  tick();
  hideTimer = setInterval(tick, 1000);
}

function hide() {
  clearInterval(hideTimer);
  $('recipient').textContent = '';
  $('countdown').textContent = '';
  $('result').hidden = true;
  $('pin').value = '';
  $('form').hidden = false;
}

$('hide').addEventListener('click', hide);
// Dölj också direkt om fliken/appen lämnas.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !$('result').hidden) hide();
});

load();
