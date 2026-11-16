// Kryptering av en lapp. Använder bara WebCrypto (globalThis.crypto), så exakt
// samma kod körs i Node (tester, admin-logik) och i webbläsaren.
//
// Format (JSON, fast struktur och storlek för alla personer):
//   { "v":1, "i":<iterationer>, "s":<salt b64>, "n":<IV b64>, "c":<chiffertext b64> }
//
// Nyckel:   PBKDF2-HMAC-SHA256( lösenord = id + ":" + PIN, salt, i ) -> 256 bit
// Chiffer:  AES-256-GCM, slumpad 12-byte IV, AAD = id
// Klartext: exakt 64 byte = [längd][namn i UTF-8][nollor]

import { randomBytes, randomInt } from './random.js';

export const DEFAULT_ITERATIONS = 1_000_000; // ca 0,15 s på dator, uppskattat 0,5-1 s på medelgod mobil
export const PLAINTEXT_BYTES = 64;
export const MAX_NAME_BYTES = PLAINTEXT_BYTES - 1;
export const WRONG_CODE = 'Fel kod';

const MIN_ITER = 1;
const MAX_ITER = 10_000_000; // skydd mot absurda värden i manipulerade filer

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

export class WrongCodeError extends Error {
  constructor() {
    super(WRONG_CODE);
    this.name = 'WrongCodeError';
  }
}

const subtle = () => globalThis.crypto.subtle;

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

/** Slumpat id (16 hex-tecken), helt oberoende av namnet. */
export function randomId() {
  return Array.from(randomBytes(8), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Slumpad 4-siffrig PIN (0000-9999), utan bias. */
export function generatePin() {
  return String(randomInt(10000)).padStart(4, '0');
}

async function deriveKey(id, pin, salt, iterations) {
  const material = await subtle().importKey('raw', enc.encode(`${id}:${pin}`), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function pad(name) {
  const bytes = enc.encode(name);
  if (bytes.length === 0 || bytes.length > MAX_NAME_BYTES) {
    throw new RangeError(`Namnet måste vara 1-${MAX_NAME_BYTES} byte långt (UTF-8).`);
  }
  const out = new Uint8Array(PLAINTEXT_BYTES);
  out[0] = bytes.length;
  out.set(bytes, 1);
  return out;
}

function unpad(bytes) {
  const len = bytes[0];
  if (bytes.length !== PLAINTEXT_BYTES || len < 1 || len > MAX_NAME_BYTES) throw new WrongCodeError();
  return dec.decode(bytes.subarray(1, 1 + len));
}

/**
 * Krypterar mottagarens namn. Returnerar filinnehållet som sträng.
 * @param {{id:string, pin:string, recipient:string, iterations?:number}} p
 */
export async function encryptEntry({ id, pin, recipient, iterations = DEFAULT_ITERATIONS }) {
  if (!/^\d{4}$/.test(pin)) throw new RangeError('PIN måste vara 4 siffror.');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(id, pin, salt, iterations);
  const ct = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(id) }, key, pad(recipient)),
  );
  return JSON.stringify({ v: 1, i: iterations, s: toB64(salt), n: toB64(iv), c: toB64(ct) });
}

/**
 * Dekrypterar en lapp. Kastar alltid WrongCodeError ("Fel kod") vid fel PIN,
 * fel id eller trasig fil, så att felen inte går att skilja åt.
 * @param {{id:string, pin:string, file:string|object}} p
 */
export async function decryptEntry({ id, pin, file }) {
  try {
    const f = typeof file === 'string' ? JSON.parse(file) : file;
    if (!f || f.v !== 1 || !Number.isInteger(f.i) || f.i < MIN_ITER || f.i > MAX_ITER) throw new WrongCodeError();
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) throw new WrongCodeError();
    const salt = fromB64(f.s);
    const iv = fromB64(f.n);
    const ct = fromB64(f.c);
    if (salt.length !== 16 || iv.length !== 12 || ct.length !== PLAINTEXT_BYTES + 16) throw new WrongCodeError();
    const key = await deriveKey(id, pin, salt, f.i);
    const plain = new Uint8Array(
      await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(String(id)) }, key, ct),
    );
    return unpad(plain);
  } catch {
    throw new WrongCodeError();
  }
}
