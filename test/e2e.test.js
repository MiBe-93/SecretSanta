import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLottery, parseNames, normalizeBaseUrl } from '../docs/admin/build.js';
import { createZip, crc32 } from '../docs/admin/zip.js';
import { draw } from '../docs/lib/draw.js';
import { decryptEntry, WrongCodeError } from '../docs/lib/crypto.js';

// Endast påhittade namn.
const NAMES = ['Anna Testsson', 'Bo Provsson', 'Cecilia Exempel', 'David Fiktiv', 'Åsa Påhittad', 'Örjan Mockström', 'Eva Dummy', 'Filip Falsk'];
const EXCL = [['Anna Testsson', 'Bo Provsson'], ['Cecilia Exempel', 'David Fiktiv']];
const URL = 'https://example.github.io/test-repo/';

async function run(extra = {}) {
  let captured;
  const result = await createLottery({
    names: NAMES,
    exclusions: EXCL,
    noMutual: true,
    baseUrl: URL,
    iterations: 1000,
    drawFn: (o) => (captured = draw(o)),
    ...extra,
  });
  return { result, captured };
}

test('helhet: varje fil dekrypteras med rätt PIN och motsvarar lottningen', async () => {
  const logs = [];
  const orig = { ...console };
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) console[k] = (...a) => logs.push(a);
  let result, captured;
  try {
    ({ result, captured } = await run());
  } finally {
    Object.assign(console, orig);
  }
  assert.equal(logs.length, 0, 'ingen loggning under lottning');
  assert.equal(result.count, NAMES.length);

  const files = new Map(result.files.map((f) => [f.path, f.content]));
  const { participants } = JSON.parse(files.get('data/participants.json'));
  assert.equal(participants.length, NAMES.length);
  assert.deepEqual(participants.map((p) => p.name), [...NAMES].sort((a, b) => a.localeCompare(b, 'sv')));

  for (const p of participants) {
    assert.match(p.id, /^[0-9a-f]{16}$/);
    const block = result.utskick.split('=== ').find((b) => b.startsWith(`${p.name} ===`));
    assert.ok(block, 'meddelande finns');
    const pin = block.match(/din kod: (\d{4})\./)[1];
    assert.ok(block.includes(`Hej ${p.name.split(' ')[0]}!`));
    assert.ok(block.includes(URL));

    const file = files.get(`data/${p.id}.json`);
    assert.equal(await decryptEntry({ id: p.id, pin, file }), captured.assignment.get(p.name));
    const badPin = String((Number(pin) + 1) % 10000).padStart(4, '0');
    await assert.rejects(decryptEntry({ id: p.id, pin: badPin, file }), WrongCodeError);
    // Meddelandet till personen avslöjar inte mottagaren.
    assert.ok(!block.includes(captured.assignment.get(p.name)));
  }
});

test('alla krypterade filer är lika stora, filnamn/id avslöjar inget', async () => {
  const { result, captured } = await run();
  const enc = result.files.filter((f) => f.path !== 'data/participants.json');
  assert.equal(enc.length, NAMES.length);
  assert.equal(new Set(enc.map((f) => f.content.length)).size, 1);
  assert.equal(new Set(enc.map((f) => f.path)).size, NAMES.length);
  for (const f of result.files) {
    for (const n of NAMES) assert.ok(!f.path.includes(n.split(' ')[0]));
    if (f.path !== 'data/participants.json') {
      for (const n of NAMES) assert.ok(!f.content.includes(n), 'klartextnamn i krypterad fil');
    }
  }
  assert.ok(captured);
});

test('ny lottning ger nya id (inga filnamn återanvänds)', async () => {
  const a = await run();
  const b = await run();
  const ids = (r) => new Set(r.result.files.map((f) => f.path).filter((x) => x !== 'data/participants.json'));
  assert.equal([...ids(a)].filter((p) => ids(b).has(p)).length, 0);
});

test('varning och fel från lottningen når anroparen', async () => {
  const two = await createLottery({ names: ['A Test', 'B Test'], exclusions: [], noMutual: true, baseUrl: URL, iterations: 1000 });
  assert.equal(two.warnings.length, 1);
  await assert.rejects(
    createLottery({ names: ['A', 'B', 'C'], exclusions: [['A', 'B'], ['A', 'C']], noMutual: true, baseUrl: URL, iterations: 1000 }),
    /A kan inte ge till någon/,
  );
});

test('namnlista: radnummer, semikolon, dubbletter, för långa namn', () => {
  const r = parseNames('1\tPeter Test;\n2  Elin  Test;\n\n3 peter test;\nÅsa Ö;\n');
  assert.deepEqual(r.names, ['Peter Test', 'Elin Test', 'Åsa Ö']);
  assert.deepEqual(r.duplicates, ['Peter Test']);
  assert.equal(parseNames('x'.repeat(64)).tooLong.length, 1);
});

test('adress valideras och får snedstreck sist', () => {
  assert.equal(normalizeBaseUrl('https://a.github.io/b'), 'https://a.github.io/b/');
  assert.throws(() => normalizeBaseUrl(''), /adress/);
  assert.throws(() => normalizeBaseUrl('javascript:alert(1)'), /adress/);
});

test('ZIP: giltig struktur, rätt filer och CRC', async () => {
  const { result } = await run();
  const zip = createZip(result.files);
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  assert.equal(dv.getUint32(eocd, true), 0x06054b50);
  const count = dv.getUint16(eocd + 10, true);
  assert.equal(count, result.files.length);
  let p = dv.getUint32(eocd + 16, true);
  const names = [];
  for (let i = 0; i < count; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50);
    const crc = dv.getUint32(p + 16, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    names.push(name);
    assert.equal(dv.getUint32(off, true), 0x04034b50);
    const dataStart = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const data = zip.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data), crc);
    assert.equal(new TextDecoder().decode(data), result.files.find((f) => f.path === name).content);
    p += 46 + nameLen;
  }
  assert.deepEqual(names.sort(), result.files.map((f) => f.path).sort());
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});
