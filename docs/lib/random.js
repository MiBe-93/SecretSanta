// Kryptografiskt säker slump (WebCrypto). Fungerar i både Node och webbläsare.

/** Slumpat heltal 0..max-1 utan modulo-bias. */
export function randomInt(max) {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) {
    throw new RangeError('randomInt: ogiltigt max');
  }
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

/** Fisher–Yates. Returnerar en ny slumpad kopia. */
export function shuffle(items) {
  const a = Array.from(items);
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomBytes(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}
