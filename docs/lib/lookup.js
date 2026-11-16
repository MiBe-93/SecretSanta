// Hämtar deltagarlistan och en persons lapp och försöker öppna den.
// Ren logik utan DOM, så att den kan testas i Node med en låtsas-fetch.

import { decryptEntry } from './crypto.js';

export const MESSAGES = {
  wrongCode: 'Fel kod',
  staleLottery: 'Det verkar ha gjorts en ny lottning. Vänta några minuter och ladda om sidan.',
  network: 'Kunde inte hämta lappen. Kontrollera anslutningen och försök igen.',
};

const ID_RE = /^[0-9a-f]{16}$/;

// no-store + en enkel cache-buster, eftersom GitHub Pages kan servera gamla filer en stund.
function fetchOptions() {
  return { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };
}
function bust(path) {
  return `${path}?v=${Date.now()}`;
}

/** Returnerar listan med deltagare, eller null om lottningen inte är gjord (404, tom eller trasig fil). */
export async function loadParticipants(fetchFn = globalThis.fetch.bind(globalThis)) {
  try {
    const res = await fetchFn(bust('data/participants.json'), fetchOptions());
    if (!res.ok) return null;
    const json = await res.json();
    if (json && Array.isArray(json.participants) && json.participants.length > 0) return json.participants;
  } catch {
    // faller igenom
  }
  return null;
}

/**
 * @returns {Promise<{ok:true, name:string} | {ok:false, reason:'wrong-code'|'stale'|'network', message:string}>}
 *  - stale:      personfilen finns inte (listan och filerna kommer från olika lottningar)
 *  - network:    nätfel eller serverfel, inget fel på koden
 *  - wrong-code: fel PIN eller trasig fil (samma neutrala svar)
 */
export async function openEnvelope({ id, pin, fetchFn = globalThis.fetch.bind(globalThis) }) {
  if (!ID_RE.test(String(id))) return { ok: false, reason: 'wrong-code', message: MESSAGES.wrongCode };
  let res;
  try {
    res = await fetchFn(bust(`data/${id}.json`), fetchOptions());
  } catch {
    return { ok: false, reason: 'network', message: MESSAGES.network };
  }
  if (res.status === 404) return { ok: false, reason: 'stale', message: MESSAGES.staleLottery };
  if (!res.ok) return { ok: false, reason: 'network', message: MESSAGES.network };
  let text;
  try {
    text = await res.text();
  } catch {
    return { ok: false, reason: 'network', message: MESSAGES.network };
  }
  try {
    const name = await decryptEntry({ id, pin, file: text });
    return { ok: true, name };
  } catch {
    return { ok: false, reason: 'wrong-code', message: MESSAGES.wrongCode };
  }
}
