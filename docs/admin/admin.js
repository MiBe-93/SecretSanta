// Admin-verktygets gränssnitt. Inget lottningsresultat visas, loggas eller sparas här.
// Ingen localStorage/sessionStorage/IndexedDB används.

import { CONFIG } from '../config.js';
import { createLottery, parseNames } from './build.js';
import { createZip } from './zip.js';

const $ = (id) => document.getElementById(id);

const TEST_NAMES = [
  'Anna Testsson', 'Bertil Provsson', 'Cecilia Exempel', 'David Fiktiv', 'Eva Påhittad', 'Filip Falsk',
  'Gunilla Dummy', 'Hasse Skenman', 'Ingrid Låtsas', 'Jonas Mock', 'Karin Prov', 'Lars Exempelsson',
];

let exclusions = []; // [[namnA, namnB], ...]
let urls = [];

$('admin').addEventListener('submit', (e) => e.preventDefault());

function currentNames() {
  return parseNames($('names').value);
}

function fillSelect(select, names) {
  const prev = select.value;
  select.replaceChildren();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = '– välj –';
  select.append(first);
  for (const n of names) {
    const o = document.createElement('option');
    o.value = n;
    o.textContent = n;
    select.append(o);
  }
  if (names.includes(prev)) select.value = prev;
}

function renderExclusions() {
  const list = $('ex-list');
  list.replaceChildren();
  exclusions.forEach(([a, b], i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = `${a} ↔ ${b}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary';
    btn.textContent = 'Ta bort';
    btn.addEventListener('click', () => {
      exclusions.splice(i, 1);
      renderExclusions();
    });
    li.append(span, btn);
    list.append(li);
  });
}

function onNamesChanged() {
  const { names, duplicates, tooLong, invalid } = currentNames();
  $('names-info').textContent = `${names.length} namn`;
  const problems = [];
  if (duplicates.length) problems.push(`Dubbletter: ${duplicates.join(', ')}. Ta bort eller skilj dem åt (t.ex. med mellannamn). Namn som bara skiljer sig åt på stor/liten bokstav, å/ä/ö eller bindestreck räknas som samma namn.`);
  if (invalid.length) problems.push(`Saknar bokstäver: ${invalid.join(', ')}.`);
  if (tooLong.length) problems.push(`För långt namn: ${tooLong.join(', ')}.`);
  $('names-warn').textContent = problems.join(' ');
  $('names-warn').hidden = problems.length === 0;
  fillSelect($('ex-a'), names);
  fillSelect($('ex-b'), names);
  exclusions = exclusions.filter(([a, b]) => names.includes(a) && names.includes(b));
  renderExclusions();
}

$('names').addEventListener('input', onNamesChanged);

$('fill').addEventListener('click', () => {
  $('names').value = TEST_NAMES.join('\n');
  if (!$('url').value) $('url').value = 'https://exempel.github.io/testrepo/';
  onNamesChanged();
});

$('ex-add').addEventListener('click', () => {
  const a = $('ex-a').value;
  const b = $('ex-b').value;
  showError('');
  if (!a || !b) return showError('Välj två personer för undantaget.');
  if (a === b) return showError('Välj två olika personer.');
  if (exclusions.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return showError('Det undantaget finns redan.');
  exclusions.push([a, b]);
  renderExclusions();
});

function showError(text) {
  $('error').textContent = text;
  $('error').hidden = !text;
}

function showWarnings(list) {
  const box = $('warnings');
  box.replaceChildren();
  for (const w of list) {
    const d = document.createElement('div');
    d.className = 'msg warn';
    d.textContent = `Varning: ${w}`;
    box.append(d);
  }
}

function clearDownloads() {
  for (const u of urls) URL.revokeObjectURL(u);
  urls = [];
  $('dl-zip').removeAttribute('href');
  $('message').value = '';
  $('copied').hidden = true;
  $('done').hidden = true;
}

$('go').addEventListener('click', async () => {
  showError('');
  showWarnings([]);
  clearDownloads();
  const { names, duplicates, tooLong, invalid } = currentNames();
  if (duplicates.length || tooLong.length || invalid.length) return showError('Rätta namnlistan först (se varningen under den).');
  if (names.length < 2) return showError('Lägg in minst två namn.');

  const button = $('go');
  button.disabled = true;
  button.textContent = 'Lottar och krypterar…';
  try {
    const result = await createLottery({
      names,
      exclusions,
      noMutual: $('no-mutual').checked,
      baseUrl: $('url').value,
      iterations: CONFIG.iterations,
    });
    const zip = new Blob([createZip(result.files)], { type: 'application/zip' });
    urls = [URL.createObjectURL(zip)];
    $('dl-zip').href = urls[0];
    $('message').value = result.message;
    $('done-msg').textContent = `Lottning klar, ${result.files.length} filer skapade (${result.count} personer + meta.json).`;
    $('done').hidden = false;
    showWarnings(result.warnings);
    $('done').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    // Felmeddelanden nämner bara regler/namn, aldrig något lottningsresultat.
    showError(err && err.message ? err.message : 'Något gick fel.');
  } finally {
    button.disabled = false;
    button.textContent = 'Lotta';
  }
});

$('copy').addEventListener('click', async () => {
  const box = $('message');
  box.select();
  try {
    await navigator.clipboard.writeText(box.value);
    $('copied').hidden = false;
  } catch {
    // Webbläsaren tillät inte kopiering: texten är markerad, kopiera själv.
    $('copied').hidden = true;
  }
});

onNamesChanged();
