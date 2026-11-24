import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  encryptEntry,
  decryptEntry,
  fileId,
  newSalt,
  CannotOpenError,
  DEFAULT_ITERATIONS,
  MAX_NAME_BYTES,
} from '../docs/lib/crypto.js';

const FAST = 1000; // snabbt i tester
const cannot = (e) => e instanceof CannotOpenError && e.message === 'Kunde inte öppna lappen';
const ID = '0123456789abcdef';

test('kryptera och dekryptera fram och tillbaka (även åäö och emoji)', async () => {
  for (const name of ['Anna Testsson', 'Åsa Öberg-Ängström', 'Zoë 🎅 Test', 'X']) {
    const file = await encryptEntry({ id: ID, secret: 'anna testsson', giver: 'Anna Testsson', recipient: name, iterations: FAST });
    assert.deepEqual(await decryptEntry({ id: ID, secret: 'anna testsson', file }), { giver: 'Anna Testsson', recipient: name });
  }
});

test('fel nyckel (fel namn) misslyckas med samma neutrala fel', async () => {
  const file = await encryptEntry({ id: ID, secret: 'anna testsson', giver: 'Anna Testsson', recipient: 'Bo Provsson', iterations: FAST });
  await assert.rejects(decryptEntry({ id: ID, secret: 'anna testson', file }), cannot);
  await assert.rejects(decryptEntry({ id: ID, secret: 'bo provsson', file }), cannot);
  await assert.rejects(decryptEntry({ id: ID, secret: '', file }), cannot);
  await assert.rejects(decryptEntry({ id: ID, secret: undefined, file }), cannot);
});

test('fel id, manipulerad och trasig fil ger samma fel', async () => {
  const file = await encryptEntry({ id: ID, secret: 'a b', giver: 'A B', recipient: 'C D', iterations: FAST });
  await assert.rejects(decryptEntry({ id: 'fedcba9876543210', secret: 'a b', file }), cannot);

  const obj = JSON.parse(file);
  const flipped = { ...obj, c: (obj.c[0] === 'A' ? 'B' : 'A') + obj.c.slice(1) };
  await assert.rejects(decryptEntry({ id: ID, secret: 'a b', file: flipped }), cannot);
  await assert.rejects(decryptEntry({ id: ID, secret: 'a b', file: { ...obj, i: obj.i + 1 } }), cannot);
  await assert.rejects(decryptEntry({ id: ID, secret: 'a b', file: { ...obj, v: 1 } }), cannot);
  for (const broken of ['', 'inte json', '{}', '[]', 'null', JSON.stringify({ ...obj, s: '!!!' }), JSON.stringify({ ...obj, i: 1e12 })]) {
    await assert.rejects(decryptEntry({ id: ID, secret: 'a b', file: broken }), cannot);
  }
});

test('paddning: alla filer har exakt samma storlek oavsett namnlängd', async () => {
  const sizes = new Set();
  const long = 'ö'.repeat(31);
  for (const [g, r] of [['A', 'B'], ['Kort Namn', 'Ett Längre Namn Åäö'], [long, long]]) {
    const f = await encryptEntry({ id: ID, secret: 'x', giver: g, recipient: r, iterations: FAST });
    sizes.add(f.length);
    assert.deepEqual(Object.keys(JSON.parse(f)), ['v', 'i', 's', 'n', 'c']);
  }
  assert.equal(sizes.size, 1);
});

test('för långt eller tomt namn och tom nyckel avvisas', async () => {
  const base = { id: ID, secret: 'x', giver: 'A', recipient: 'B', iterations: FAST };
  await assert.rejects(encryptEntry({ ...base, recipient: 'a'.repeat(MAX_NAME_BYTES + 1) }), RangeError);
  await assert.rejects(encryptEntry({ ...base, giver: 'a'.repeat(MAX_NAME_BYTES + 1) }), RangeError);
  await assert.rejects(encryptEntry({ ...base, recipient: '' }), RangeError);
  await assert.rejects(encryptEntry({ ...base, secret: '' }), RangeError);
  const max = 'a'.repeat(MAX_NAME_BYTES);
  const ok = await encryptEntry({ ...base, giver: max, recipient: max });
  assert.deepEqual(await decryptEntry({ id: ID, secret: 'x', file: ok }), { giver: max, recipient: max });
});

test('slumpad salt och IV: samma indata ger olika filer', async () => {
  const a = await encryptEntry({ id: ID, secret: 'x', giver: 'A', recipient: 'B', iterations: FAST });
  const b = await encryptEntry({ id: ID, secret: 'x', giver: 'A', recipient: 'B', iterations: FAST });
  assert.notEqual(a, b);
});

test('filnamnets id: 16 hex-tecken, beror på både salt och namn, avslöjar inte namnet', async () => {
  const salt = newSalt();
  assert.match(salt, /^[0-9a-f]{32}$/);
  assert.notEqual(salt, newSalt());
  const a = await fileId(salt, 'anna testsson');
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(a, await fileId(salt, 'anna testsson'), 'samma indata ger samma id');
  assert.notEqual(a, await fileId(salt, 'bo provsson'));
  assert.notEqual(a, await fileId(newSalt(), 'anna testsson'), 'ny lottning ger nya id');
  assert.ok(!a.includes('anna'));
});

test('standardvärdet är minst 600 000 iterationer och används i filen', async () => {
  assert.ok(DEFAULT_ITERATIONS >= 600000);
  const t = performance.now();
  const file = await encryptEntry({ id: ID, secret: 'test testsson', giver: 'Test Testsson', recipient: 'Bo Provsson' });
  assert.equal(JSON.parse(file).i, DEFAULT_ITERATIONS);
  assert.equal((await decryptEntry({ id: ID, secret: 'test testsson', file })).recipient, 'Bo Provsson');
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
