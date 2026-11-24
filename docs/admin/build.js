// Admin-logik utan DOM: tar namn/undantag, lottar, krypterar och bygger filerna.
// Körs i webbläsaren (admin/index.html) och i Node (tester).
//
// Ingen loggning, ingen lagring. Lottningsresultatet finns bara i minnet och
// lämnar den här funktionen enbart som krypterade filer.

import { draw as realDraw } from '../lib/draw.js';
import { encryptEntry, fileId, newSalt, MAX_NAME_BYTES, DEFAULT_ITERATIONS } from '../lib/crypto.js';
import { nameKey } from '../lib/names.js';

const norm = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Läser namnlistan. Tål radnummer före namnet och ';' efter.
 * Två namn räknas som dubbletter om de ger samma nyckel (se lib/names.js), t.ex.
 * "Åsa Berg" och "asa  berg". Det är nyckeln som personen skriver in på sidan.
 */
export function parseNames(text) {
  const names = [];
  const seen = new Map();
  const duplicates = [];
  const invalid = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const name = norm(raw.replace(/^\s*\d+[.)]?\s+/, '').replace(/[;,\s]+$/, ''));
    if (!name) continue;
    const k = nameKey(name);
    if (!k) {
      invalid.push(name);
      continue;
    }
    if (seen.has(k)) {
      if (!duplicates.includes(seen.get(k))) duplicates.push(seen.get(k));
      continue;
    }
    seen.set(k, name);
    names.push(name);
  }
  const tooLong = names.filter((n) => new TextEncoder().encode(n).length > MAX_NAME_BYTES);
  return { names, duplicates, tooLong, invalid };
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

/** Ett gemensamt meddelande till hela släkten. Det innehåller inga hemligheter. */
export function messageFor(url) {
  return (
    `Hej! Nu är det dags för släktens Secret Santa: ${url}\n` +
    `Skriv ditt för- och efternamn på sidan så får du se vem du ska ge julklapp till. ` +
    `Visa den inte för någon annan!`
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
 * @returns {Promise<{files: Array<{path:string, content:string}>, message:string, warnings:string[], count:number}>}
 */
export async function createLottery({ names, exclusions, noMutual, baseUrl, iterations = DEFAULT_ITERATIONS, drawFn = realDraw }) {
  const url = normalizeBaseUrl(baseUrl);

  const keys = names.map(nameKey);
  if (keys.some((k) => !k)) throw new Error('Ett namn saknar bokstäver.');
  if (new Set(keys).size !== keys.length) {
    throw new Error('Två namn går inte att skilja åt när man skriver dem (t.ex. samma namn med och utan å/ä/ö). Lägg till ett mellannamn på den ena.');
  }

  const { assignment, warnings } = drawFn({ names, exclusions, noMutual });

  const salt = newSalt();
  const files = await Promise.all(
    names.map(async (name) => {
      const key = nameKey(name);
      const id = await fileId(salt, key);
      return {
        path: `data/${id}.json`,
        content: await encryptEntry({ id, secret: key, giver: name, recipient: assignment.get(name), iterations }),
      };
    }),
  );
  files.unshift({ path: 'data/meta.json', content: JSON.stringify({ v: 2, salt }) + '\n' });

  return { files, message: messageFor(url), warnings, count: names.length };
}
