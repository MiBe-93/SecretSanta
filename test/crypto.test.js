import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  encryptEntry,
  decryptEntry,
  randomId,
  generatePin,
  WrongCodeError,
  DEFAULT_ITERATIONS,
  MAX_NAME_BYTES,
} from '../docs/lib/crypto.js';

const FAST = 1000; // snabbt i tester
const wrong = (e) => e instanceof WrongCodeError && e.message === 'Fel kod';

test('kryptera och dekryptera fram och tillbaka (även åäö och emoji)', async () => {
  for (const name of ['Anna Testsson', 'Åsa Öberg-Ängström', 'Zoë 🎅 Test', 'X']) {
    const id = randomId();
    const file = await encryptEntry({ id, pin: '0042', recipient: name, iterations: FAST });
    assert.equal(await decryptEntry({ id, pin: '0042', file }), name);
  }
});

test('fel PIN misslyckas med neutralt "Fel kod"', async () => {
  const id = randomId();
  const file = await encryptEntry({ id, pin: '1234', recipient: 'Test Testsson', iterations: FAST });
  await assert.rejects(decryptEntry({ id, pin: '1235', file }), wrong);
  await assert.rejects(decryptEntry({ id, pin: 'abcd', file }), wrong);
  await assert.rejects(decryptEntry({ id, pin: '', file }), wrong);
});

test('fel id, manipulerad och trasig fil ger samma fel', async () => {
  const id = randomId();
  const file = await encryptEntry({ id, pin: '1234', recipient: 'Test Testsson', iterations: FAST });
  await assert.rejects(decryptEntry({ id: randomId(), pin: '1234', file }), wrong);

  const obj = JSON.parse(file);
  const flipped = { ...obj, c: (obj.c[0] === 'A' ? 'B' : 'A') + obj.c.slice(1) };
  await assert.rejects(decryptEntry({ id, pin: '1234', file: flipped }), wrong);
  await assert.rejects(decryptEntry({ id, pin: '1234', file: { ...obj, i: obj.i + 1 } }), wrong);
  for (const broken of ['', 'inte json', '{}', '[]', 'null', JSON.stringify({ ...obj, s: '!!!' }), JSON.stringify({ ...obj, i: 1e12 })]) {
    await assert.rejects(decryptEntry({ id, pin: '1234', file: broken }), wrong);
  }
});

test('paddning: alla filer har exakt samma storlek oavsett namnlängd', async () => {
  const sizes = new Set();
  for (const name of ['A', 'Kort Namn', 'Ett Betydligt Längre Namn Med Många Tecken Åäö'.slice(0, 40), 'ö'.repeat(31)]) {
    const f = await encryptEntry({ id: randomId(), pin: '0000', recipient: name, iterations: FAST });
    sizes.add(f.length);
    assert.deepEqual(Object.keys(JSON.parse(f)), ['v', 'i', 's', 'n', 'c']);
  }
  assert.equal(sizes.size, 1);
});

test('för långt eller tomt namn avvisas', async () => {
  const id = randomId();
  await assert.rejects(encryptEntry({ id, pin: '1234', recipient: 'a'.repeat(MAX_NAME_BYTES + 1), iterations: FAST }), RangeError);
  await assert.rejects(encryptEntry({ id, pin: '1234', recipient: '', iterations: FAST }), RangeError);
  await assert.rejects(encryptEntry({ id, pin: '12', recipient: 'A', iterations: FAST }), RangeError);
  const ok = await encryptEntry({ id, pin: '1234', recipient: 'a'.repeat(MAX_NAME_BYTES), iterations: FAST });
  assert.equal(await decryptEntry({ id, pin: '1234', file: ok }), 'a'.repeat(MAX_NAME_BYTES));
});

test('slumpad salt och IV: samma indata ger olika filer', async () => {
  const id = randomId();
  const a = await encryptEntry({ id, pin: '1234', recipient: 'Test', iterations: FAST });
  const b = await encryptEntry({ id, pin: '1234', recipient: 'Test', iterations: FAST });
  assert.notEqual(a, b);
});

test('id och PIN: slumpade, rätt format, ej härledda från namn', () => {
  const ids = new Set(Array.from({ length: 500 }, randomId));
  assert.equal(ids.size, 500);
  for (const id of ids) assert.match(id, /^[0-9a-f]{16}$/);
  const pins = Array.from({ length: 2000 }, generatePin);
  for (const p of pins) assert.match(p, /^\d{4}$/);
  assert.ok(new Set(pins).size > 1500, 'PIN verkar slumpade');
  assert.ok(pins.some((p) => p.startsWith('0')), 'inledande nollor förekommer');
});

test('standardvärdet är minst 600 000 iterationer och används i filen', async () => {
  assert.ok(DEFAULT_ITERATIONS >= 600000);
  const id = randomId();
  const t = performance.now();
  const file = await encryptEntry({ id, pin: '4321', recipient: 'Test Testsson' });
  assert.equal(JSON.parse(file).i, DEFAULT_ITERATIONS);
  assert.equal(await decryptEntry({ id, pin: '4321', file }), 'Test Testsson');
  console.log(`  (info) kryptera+dekryptera vid ${DEFAULT_ITERATIONS} iterationer: ${Math.round(performance.now() - t)} ms totalt i Node`);
});

test('samma kod i Node och webbläsare: lib/ använder bara WebCrypto, inga Node-API:er', () => {
  const dir = new URL('../docs/lib/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /\bfrom\s+['"]node:/, `${f}: node:-import`);
    assert.doesNotMatch(src, /\brequire\s*\(/, `${f}: require`);
    assert.doesNotMatch(src, /\bprocess\./, `${f}: process`);
    assert.doesNotMatch(src, /\bBuffer\b/, `${f}: Buffer`);
    assert.doesNotMatch(src, /console\./, `${f}: console`);
    for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.match(m[1], /^\.\//, `${f}: bara lokala importer`);
  }
});
