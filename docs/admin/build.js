// Admin-logik utan DOM: tar namn/undantag, lottar, krypterar och bygger filerna.
// Körs i webbläsaren (admin/index.html) och i Node (tester).
//
// Ingen loggning, ingen lagring. Lottningsresultatet finns bara i minnet och
// lämnar den här funktionen enbart som krypterade filer.

import { draw as realDraw } from '../lib/draw.js';
import { encryptEntry, randomId, generatePin, MAX_NAME_BYTES, DEFAULT_ITERATIONS } from '../lib/crypto.js';

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const key = (s) => s.toLocaleLowerCase('sv');

/** Läser namnlistan. Tål radnummer före namnet och ';' efter. */
export function parseNames(text) {
  const names = [];
  const seen = new Map();
  const duplicates = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const name = norm(raw.replace(/^\s*\d+[.)]?\s+/, '').replace(/[;,\s]+$/, ''));
    if (!name) continue;
    const k = key(name);
    if (seen.has(k)) {
      if (!duplicates.includes(seen.get(k))) duplicates.push(seen.get(k));
      continue;
    }
    seen.set(k, name);
    names.push(name);
  }
  const tooLong = names.filter((n) => new TextEncoder().encode(n).length > MAX_NAME_BYTES);
  return { names, duplicates, tooLong };
}

export function firstName(name) {
  return name.split(' ')[0];
}

export function normalizeBaseUrl(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\/[^\s]+$/i.test(u)) {
    throw new Error('Sidans adress måste börja med https:// (t.ex. https://ANVÄNDARNAMN.github.io/REPONAMN/).');
  }
  return u.endsWith('/') ? u : `${u}/`;
}

export function messageFor(name, url, pin) {
  return (
    `Hej ${firstName(name)}! Här är släktens Secret Santa: ${url} . ` +
    `Välj ditt namn i listan och skriv in din kod: ${pin}. ` +
    `Då får du se vem du ska ge julklapp till. Visa den inte för någon annan!`
  );
}

/**
 * @param {object} o
 * @param {string[]} o.names
 * @param {Array<[string,string]>} o.exclusions
 * @param {boolean} o.noMutual
 * @param {string} o.baseUrl
 * @param {number} [o.iterations]
 * @param {Function} [o.drawFn]  endast för tester
 * @returns {Promise<{files: Array<{path:string, content:string}>, utskick:string, warnings:string[], count:number}>}
 */
export async function createLottery({ names, exclusions, noMutual, baseUrl, iterations = DEFAULT_ITERATIONS, drawFn = realDraw }) {
  const url = normalizeBaseUrl(baseUrl);
  const { assignment, warnings } = drawFn({ names, exclusions, noMutual });

  const ids = new Set();
  const people = names.map((name) => {
    let id;
    do id = randomId();
    while (ids.has(id));
    ids.add(id);
    return { name, id, pin: generatePin() };
  });

  const files = await Promise.all(
    people.map(async (p) => ({
      path: `data/${p.id}.json`,
      content: await encryptEntry({ id: p.id, pin: p.pin, recipient: assignment.get(p.name), iterations }),
    })),
  );

  const participants = people
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  files.unshift({ path: 'data/participants.json', content: JSON.stringify({ v: 1, participants }, null, 2) + '\n' });

  const header =
    'VARNING: Den här filen innehåller PIN-koder. Checka ALDRIG in den i repot och dela den inte. ' +
    'Skicka bara varje persons eget meddelande till just den personen, radera sedan filen.\n';
  const blocks = [...people]
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
    .map((p) => `=== ${p.name} ===\n${messageFor(p.name, url, p.pin)}\n`);
  const utskick = `${header}\n${blocks.join('\n')}`;

  return { files, utskick, warnings, count: people.length };
}
