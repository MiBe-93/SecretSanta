// Kryptering av en lapp. Använder bara WebCrypto (globalThis.crypto), så exakt
// samma kod körs i Node (tester, admin-logik) och i webbläsaren.
//
// Det finns ingen PIN. Nyckeln härleds ur personens eget namn (se names.js), så
// den som känner till en persons för- och efternamn kan öppna personens lapp.
//
// Lappens filnamn:  data/<id>.json
//   id = de första 8 byten av SHA-256( salt + "\n" + namnnyckel ) som hex (16 tecken)
//   salt = slumpat per lottning och står i data/meta.json
//
// Lappens format (JSON, fast struktur och storlek för alla personer):
//   { "v":2, "i":<iterationer>, "s":<salt b64>, "n":<IV b64>, "c":<chiffertext b64> }
//
// Nyckel:   PBKDF2-HMAC-SHA256( lösenord = id + ":" + namnnyckel, salt, i ) -> 256 bit
// Chiffer:  AES-256-GCM, slumpad 12-byte IV, AAD = id
// Klartext: exakt 160 byte = [längd][personens eget namn][längd][mottagarens namn][nollor]

import { randomBytes } from './random.js';

export const DEFAULT_ITERATIONS = 1_000_000; // ca 0,15 s på dator, uppskattat 0,5-1 s på medelgod mobil
export const PLAINTEXT_BYTES = 160;
export const MAX_NAME_BYTES = 63; // per namn (UTF-8)
export const CANNOT_OPEN = 'Kunde inte öppna lappen';

const MIN_ITER = 1;
const MAX_ITER = 10_000_000; // skydd mot absurda värden i manipulerade filer

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

export class CannotOpenError extends Error {
  constructor() {
    super(CANNOT_OPEN);
    this.name = 'CannotOpenError';
  }
}

const subtle = () => globalThis.crypto.subtle;

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromB64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Slumpat salt för en lottning (32 hex-tecken). Publikt, står i data/meta.json. */
export function newSalt() {
  return hex(randomBytes(16));
}

/** Filnamnets id för en namnnyckel i en given lottning (16 hex-tecken). */
export async function fileId(salt, key) {
  const digest = new Uint8Array(await subtle().digest('SHA-256', enc.encode(`${salt}\n${key}`)));
  return hex(digest.subarray(0, 8));
}

async function deriveKey(id, secret, salt, iterations) {
  const material = await subtle().importKey('raw', enc.encode(`${id}:${secret}`), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function pad(giver, recipient) {
  const out = new Uint8Array(PLAINTEXT_BYTES);
  let pos = 0;
  for (const name of [giver, recipient]) {
    const bytes = enc.encode(name);
    if (bytes.length === 0 || bytes.length > MAX_NAME_BYTES) {
      throw new RangeError(`Namnet måste vara 1-${MAX_NAME_BYTES} byte långt (UTF-8).`);
    }
    out[pos++] = bytes.length;
    out.set(bytes, pos);
    pos += bytes.length;
  }
  return out;
}

function unpad(bytes) {
  if (bytes.length !== PLAINTEXT_BYTES) throw new CannotOpenError();
  const names = [];
  let pos = 0;
  for (let i = 0; i < 2; i++) {
    const len = bytes[pos++];
    if (len < 1 || len > MAX_NAME_BYTES || pos + len > bytes.length) throw new CannotOpenError();
    names.push(dec.decode(bytes.subarray(pos, pos + len)));
    pos += len;
  }
  return { giver: names[0], recipient: names[1] };
}

/**
 * Krypterar en lapp. Returnerar filinnehållet som sträng.
 * @param {{id:string, secret:string, giver:string, recipient:string, iterations?:number}} p
 *   secret = personens namnnyckel, giver = personens eget namn, recipient = den personen ska ge till
 */
export async function encryptEntry({ id, secret, giver, recipient, iterations = DEFAULT_ITERATIONS }) {
  if (typeof secret !== 'string' || secret === '') throw new RangeError('Namnnyckeln får inte vara tom.');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(id, secret, salt, iterations);
  const ct = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(id) }, key, pad(giver, recipient)),
  );
  return JSON.stringify({ v: 2, i: iterations, s: toB64(salt), n: toB64(iv), c: toB64(ct) });
}

/**
 * Dekrypterar en lapp. Kastar alltid CannotOpenError vid fel nyckel, fel id
 * eller trasig fil, så att felen inte går att skilja åt.
 * @param {{id:string, secret:string, file:string|object}} p
 * @returns {Promise<{giver:string, recipient:string}>}
 */
export async function decryptEntry({ id, secret, file }) {
  try {
    const f = typeof file === 'string' ? JSON.parse(file) : file;
    if (!f || f.v !== 2 || !Number.isInteger(f.i) || f.i < MIN_ITER || f.i > MAX_ITER) throw new CannotOpenError();
    if (typeof secret !== 'string' || secret === '') throw new CannotOpenError();
    const salt = fromB64(f.s);
    const iv = fromB64(f.n);
    const ct = fromB64(f.c);
    if (salt.length !== 16 || iv.length !== 12 || ct.length !== PLAINTEXT_BYTES + 16) throw new CannotOpenError();
    const key = await deriveKey(id, secret, salt, f.i);
    const plain = new Uint8Array(
      await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(String(id)) }, key, ct),
    );
    return unpad(plain);
  } catch {
    throw new CannotOpenError();
  }
}
