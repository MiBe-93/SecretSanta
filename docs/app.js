import { CONFIG } from './config.js';
import { loadMeta, openEnvelope } from './lib/lookup.js';

const $ = (id) => document.getElementById(id);
const AUTO_HIDE_SECONDS = 60;
const SUBMIT_LABEL = 'Lotta fram min julklappskompis';

let meta = null;
let busy = false;
let hideTimer = null;

document.title = CONFIG.title;
for (const el of document.querySelectorAll('.year')) el.textContent = String(CONFIG.year);
$('error-help').textContent = `Hittar du inte dig? Fråga ${CONFIG.adminName}.`;

// Visar de delar av sidan som hör till ett visst läge (loading, start, notready, result).
function setView(view) {
  document.body.dataset.view = view;
  for (const el of document.querySelectorAll('[data-show]')) {
    el.hidden = !el.dataset.show.split(' ').includes(view);
  }
}

function showError(text, withHelp = false) {
  $('error-text').textContent = text;
  $('error-help').hidden = !withHelp;
  $('error').hidden = !text;
}

async function load() {
  meta = await loadMeta();
  setView(meta ? 'start' : 'notready');
}

$('form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (busy || !meta) return;
  showError('');
  busy = true;
  $('submit').disabled = true;
  $('submit-label').textContent = 'Letar upp din person…';
  let result;
  try {
    result = await openEnvelope({ typed: $('name').value, salt: meta.salt });
  } finally {
    busy = false;
    $('submit').disabled = false;
    $('submit-label').textContent = SUBMIT_LABEL;
  }
  if (result.ok) {
    show(result);
    return;
  }
  // "Fråga admin" är bara till hjälp när namnet inte hittas eller lappen inte går att öppna.
  showError(result.message, result.reason === 'not-found' || result.reason === 'broken');
});

function firstName(name) {
  return String(name).split(' ')[0];
}

function show({ giver, recipient }) {
  $('hello-name').textContent = firstName(giver);
  $('recipient').textContent = recipient;
  $('recipient-first').textContent = firstName(recipient);
  $('name').value = '';
  setView('result');
  window.scrollTo(0, 0);
  $('result').focus({ preventScroll: true }); // skärmläsare börjar läsa i kortet

  let left = AUTO_HIDE_SECONDS;
  const tick = () => {
    if (left <= 0) return hide();
    $('countdown').textContent = `Göms automatiskt om ${left} s.`;
    left--;
  };
  clearInterval(hideTimer);
  tick();
  hideTimer = setInterval(tick, 1000);
}

function hide() {
  clearInterval(hideTimer);
  for (const id of ['recipient', 'recipient-first', 'hello-name', 'countdown']) $(id).textContent = '';
  $('name').value = '';
  showError('');
  setView('start');
}

$('hide').addEventListener('click', hide);
// Göm också direkt om fliken/appen lämnas.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && document.body.dataset.view === 'result') hide();
});

load();
