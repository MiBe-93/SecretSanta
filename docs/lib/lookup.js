// Hämtar lottningens meta-fil och en persons lapp och försöker öppna den.
// Ren logik utan DOM, så att den kan testas i Node med en låtsas-fetch.

import { decryptEntry, fileId } from './crypto.js';
import { nameCandidates } from './names.js';

export const MESSAGES = {
  empty: 'Skriv ditt för- och efternamn.',
  notFound:
    'Vi hittar inte det namnet. Kolla stavningen och skriv både för- och efternamn. ' +
    'Stämmer det och det ändå inte fungerar kan en ny lottning precis ha gjorts: vänta några minuter och ladda om sidan.',
  broken: 'Lappen gick inte att öppna. Ladda om sidan och försök igen.',
  network: 'Kunde inte hämta lappen. Kontrollera anslutningen och försök igen.',
};

const ID_RE = /^[0-9a-f]{16}$/;
const SALT_RE = /^[0-9a-f]{32}$/;

// no-store + en enkel cache-buster, eftersom GitHub Pages kan servera gamla filer en stund.
function fetchOptions() {
  return { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };
}
function bust(path) {
  return `${path}?v=${Date.now()}`;
}

/** Returnerar {salt} om lottningen är gjord, annars null (404, tom eller trasig fil). */
export async function loadMeta(fetchFn = globalThis.fetch.bind(globalThis)) {
  try {
    const res = await fetchFn(bust('data/meta.json'), fetchOptions());
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.v === 2 && typeof json.salt === 'string' && SALT_RE.test(json.salt)) return { salt: json.salt };
  } catch {
    // faller igenom
  }
  return null;
}

/**
 * Försöker öppna lappen för det namn någon skrivit.
 * @returns {Promise<{ok:true, giver:string, recipient:string} | {ok:false, reason:'empty'|'not-found'|'broken'|'network', message:string}>}
 *  - not-found: ingen lapp finns för namnet (felstavat, okänt, eller en ny lottning har precis gjorts)
 *  - network:   nätfel eller serverfel
 *  - broken:    lappen finns men går inte att öppna
 */
export async function openEnvelope({ typed, salt, fetchFn = globalThis.fetch.bind(globalThis) }) {
  const candidates = nameCandidates(typed);
  if (candidates.length === 0) return { ok: false, reason: 'empty', message: MESSAGES.empty };

  for (const key of candidates) {
    const id = await fileId(salt, key);
    if (!ID_RE.test(id)) continue;
    let res;
    try {
      res = await fetchFn(bust(`data/${id}.json`), fetchOptions());
    } catch {
      return { ok: false, reason: 'network', message: MESSAGES.network };
    }
    if (res.status === 404) continue;
    if (!res.ok) return { ok: false, reason: 'network', message: MESSAGES.network };
    let text;
    try {
      text = await res.text();
    } catch {
      return { ok: false, reason: 'network', message: MESSAGES.network };
    }
    try {
      const { giver, recipient } = await decryptEntry({ id, secret: key, file: text });
      return { ok: true, giver, recipient };
    } catch {
      return { ok: false, reason: 'broken', message: MESSAGES.broken };
    }
  }
  return { ok: false, reason: 'not-found', message: MESSAGES.notFound };
}
