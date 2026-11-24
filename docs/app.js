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

// Förnamnet på en rad och resten av namnet på nästa, som i designen.
function renderName(el, name) {
  el.replaceChildren();
  const [first, ...rest] = String(name).split(' ');
  for (const part of [first, rest.join(' ')]) {
    if (!part) continue;
    const line = document.createElement('span');
    line.textContent = part;
    el.append(line);
  }
}

function startCountdown() {
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

// ---------- Tomten drar fram namnet (bara på dator och om rörelse är okej) ----------
const WIDE = window.matchMedia('(min-width: 861px)');
const CALM = window.matchMedia('(prefers-reduced-motion: reduce)');
let reveal = null; // pågående animation: { anims, skip }

function canAnimate() {
  return WIDE.matches && !CALM.matches && typeof Element.prototype.animate === 'function';
}

// Tomten vandrar in från höger (han tittar åt vänster), stannar, drar upp en lapp
// ur säcken som flyger till namnplatsen, och namnet vecklas ut. Tar ca 4 sekunder;
// ett klick eller tangenttryck hoppar över.
function playReveal(onDone) {
  const santa = document.querySelector('.art-santa');
  const hero = document.querySelector('.hero');
  const card = document.querySelector('.name-card');
  const slip = $('slip');
  const result = $('result');

  // Mät först, innan något flyttats.
  const h = hero.getBoundingClientRect();
  const s = santa.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const startX = window.innerWidth - s.left + 24;
  const ax = s.left + s.width * 0.5 - h.left; // säckens öppning
  const ay = s.top + s.height * 0.24 - h.top;
  const tx = c.left + c.width / 2 - h.left; // mitten av namnplatsen
  const ty = c.top + c.height / 2 - h.top;
  const mx = (ax + tx) / 2;

  const T_WALK = 1900;
  const T_SLIP = T_WALK + 200;
  const T_CARD = T_SLIP + 950;
  const anims = [];
  const add = (el, frames, opts) => {
    const a = el.animate(frames, { fill: 'backwards', ...opts });
    anims.push(a);
    return a;
  };

  result.classList.add('is-reveal');

  // Promenaden: in från höger, med lätt guppande steg.
  add(santa, [{ translate: `${startX}px 0` }, { translate: '0 0' }], { duration: T_WALK, easing: 'cubic-bezier(0.35, 0.35, 0.5, 1)' });
  const steps = 10;
  const bob = [];
  for (let i = 0; i <= steps; i++) {
    const up = i % 2 === 1 && i < steps;
    const tilt = i % 4 === 1 ? -1.2 : 1.2;
    bob.push({ transform: up ? `translateY(-7px) rotate(${tilt}deg)` : 'translateY(0) rotate(0deg)', easing: 'ease-in-out' });
  }
  add(santa, bob, { duration: T_WALK });
  // Han lutar sig bakåt när han drar i lappen.
  add(santa, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-2.2deg) translateX(6px)', offset: 0.4 }, { transform: 'rotate(0deg)' }],
    { delay: T_SLIP, duration: 520, easing: 'ease-in-out' });

  // Lappen: upp ur säcken, en liten tvekan, och iväg till kortet där den växer och försvinner.
  add(slip, [
    { offset: 0, opacity: 0, transform: `translate(${ax}px, ${ay + 10}px) rotate(-8deg) scale(0.5)` },
    { offset: 0.1, opacity: 1 },
    { offset: 0.38, opacity: 1, transform: `translate(${ax + 4}px, ${ay - 64}px) rotate(-14deg) scale(1.15)`, easing: 'ease-in-out' },
    { offset: 0.5, transform: `translate(${ax + 8}px, ${ay - 70}px) rotate(-4deg) scale(1.2)`, easing: 'ease-in' },
    { offset: 0.78, transform: `translate(${mx}px, ${Math.min(ay, ty) - 90}px) rotate(8deg) scale(2)` },
    { offset: 0.93, opacity: 1, transform: `translate(${tx}px, ${ty}px) rotate(0deg) scale(3.2)` },
    { offset: 1, opacity: 0, transform: `translate(${tx}px, ${ty}px) rotate(0deg) scale(3.6)` },
  ], { delay: T_SLIP, duration: 1100 });

  // Namnet vecklas ut, sedan resten av kortet.
  add(card, [
    { opacity: 0, transform: 'scale(0.82)', easing: 'ease-out' },
    { opacity: 1, transform: 'scale(1.03)', offset: 0.6, easing: 'ease-in-out' },
    { opacity: 1, transform: 'scale(1)' },
  ], { delay: T_CARD, duration: 520 });
  const later = [result.querySelector('.lead'), $('hide'), result.querySelector('.fine')];
  later.forEach((el, i) => add(el, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
    { delay: T_CARD + 380 + i * 150, duration: 400, easing: 'ease-out' }));

  const token = { anims, skip: () => anims.forEach((a) => a.finish()) };
  reveal = token;
  const skip = (ev) => { if (!ev.repeat) token.skip(); };
  window.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip);
  const end = () => {
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
    result.classList.remove('is-reveal');
  };
  token.end = end;
  Promise.allSettled(anims.map((a) => a.finished)).then(() => {
    if (reveal !== token) return; // avbruten (göms) under tiden
    reveal = null;
    end();
    onDone();
  });
}

function cancelReveal() {
  if (!reveal) return;
  const token = reveal;
  reveal = null;
  token.anims.forEach((a) => a.cancel());
  token.end();
}

function show({ giver, recipient }) {
  $('hello-name').textContent = firstName(giver);
  renderName($('recipient'), recipient);
  $('recipient-first').textContent = firstName(recipient);
  $('name').value = '';
  cancelReveal();
  clearInterval(hideTimer);
  $('countdown').textContent = '';
  setView('result');
  window.scrollTo(0, 0);
  $('result').focus({ preventScroll: true }); // skärmläsare börjar läsa i kortet
  if (canAnimate()) playReveal(startCountdown);
  else startCountdown();
}

function hide() {
  cancelReveal();
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
