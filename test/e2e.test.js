import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLottery, parseNames, normalizeBaseUrl, messageFor } from '../docs/admin/build.js';
import { createZip, crc32 } from '../docs/admin/zip.js';
import { draw } from '../docs/lib/draw.js';
import { fileId } from '../docs/lib/crypto.js';
import { nameKey } from '../docs/lib/names.js';
import { loadMeta, openEnvelope } from '../docs/lib/lookup.js';

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

// Låtsas-fetch som serverar filerna ur en lottning, som GitHub Pages skulle göra.
function serve(files) {
  const map = new Map(files.map((f) => [f.path, f.content]));
  return async (url) => {
    const body = map.get(url.split('?')[0]);
    if (body === undefined) return { ok: false, status: 404, text: async () => '', json: async () => { throw new Error('404'); } };
    return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
  };
}

test('helhet: alla skriver sitt namn och får rätt person, ingen får sig själv', async () => {
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
  assert.equal(result.files.length, NAMES.length + 1, 'en lapp per person + meta.json');

  const fetchFn = serve(result.files);
  const meta = await loadMeta(fetchFn);
  assert.ok(meta, 'meta.json läses');

  const seen = new Set();
  for (const name of NAMES) {
    const r = await openEnvelope({ typed: name, salt: meta.salt, fetchFn });
    assert.equal(r.ok, true, name);
    assert.equal(r.giver, name, 'lappen vet vem den tillhör (för hälsningen)');
    assert.equal(r.recipient, captured.assignment.get(name));
    assert.notEqual(r.recipient, name);
    seen.add(r.recipient);
  }
  assert.equal(seen.size, NAMES.length, 'alla får en unik person');

  // Undantagen följs.
  for (const [a, b] of EXCL) {
    assert.notEqual(captured.assignment.get(a), b);
    assert.notEqual(captured.assignment.get(b), a);
  }
});

test('stavningsvarianter av ett namn öppnar samma lapp', async () => {
  const { result, captured } = await run();
  const fetchFn = serve(result.files);
  const { salt } = await loadMeta(fetchFn);
  for (const typed of ['åsa påhittad', 'ASA PAHITTAD', '  Åsa   Påhittad  ', 'Åsa Maria Påhittad']) {
    const r = await openEnvelope({ typed, salt, fetchFn });
    assert.equal(r.ok, true, typed); // även med mellannamn: sidan provar förnamn + efternamn
    assert.equal(r.recipient, captured.assignment.get('Åsa Påhittad'));
  }
});

test('alla krypterade filer är lika stora, filnamn och innehåll avslöjar inga namn', async () => {
  const { result } = await run();
  const enc = result.files.filter((f) => f.path !== 'data/meta.json');
  assert.equal(enc.length, NAMES.length);
  assert.equal(new Set(enc.map((f) => f.content.length)).size, 1);
  assert.equal(new Set(enc.map((f) => f.path)).size, NAMES.length);
  for (const f of enc) assert.match(f.path, /^data\/[0-9a-f]{16}\.json$/);
  for (const f of result.files) {
    for (const n of NAMES) {
      // Korta namndelar ("Bo", "Eva") kan dyka upp av en slump i base64-text, så bara längre delar kontrolleras.
      for (const part of [...n.split(' ').filter((x) => x.length >= 6), n, nameKey(n)]) {
        assert.ok(!f.path.toLowerCase().includes(part.toLowerCase()), `namn i filnamn: ${f.path}`);
        assert.ok(!f.content.toLowerCase().includes(part.toLowerCase()), `namn i ${f.path}`);
      }
    }
  }
  const meta = JSON.parse(result.files.find((f) => f.path === 'data/meta.json').content);
  assert.deepEqual(Object.keys(meta).sort(), ['salt', 'v']);
  // Det finns ingen deltagarlista i klartext.
  assert.equal(result.files.some((f) => f.path.includes('participants')), false);
});

test('filnamnen i lottningen stämmer med id:t som sidan räknar ut', async () => {
  const { result } = await run();
  const meta = JSON.parse(result.files.find((f) => f.path === 'data/meta.json').content);
  const paths = new Set(result.files.map((f) => f.path));
  for (const n of NAMES) assert.ok(paths.has(`data/${await fileId(meta.salt, nameKey(n))}.json`), n);
});

test('ny lottning ger nytt salt och nya filnamn (inga filnamn återanvänds)', async () => {
  const a = await run();
  const b = await run();
  const paths = (r) => new Set(r.result.files.map((f) => f.path).filter((x) => x !== 'data/meta.json'));
  assert.equal([...paths(a)].filter((p) => paths(b).has(p)).length, 0);
});

test('meddelandet till släkten är gemensamt, har adressen och avslöjar ingenting', async () => {
  const { result, captured } = await run();
  assert.equal(result.message, messageFor(URL));
  assert.ok(result.message.includes(URL));
  assert.match(result.message, /för- och efternamn/);
  for (const n of NAMES) assert.ok(!result.message.includes(n));
  assert.ok(captured);
});

test('namn som inte går att skilja åt avvisas (annars skulle två personer dela lapp)', async () => {
  await assert.rejects(
    createLottery({ names: ['Åsa Berg', 'Asa Berg', 'Cia Test'], exclusions: [], noMutual: true, baseUrl: URL, iterations: 1000 }),
    /skilja åt/,
  );
  await assert.rejects(
    createLottery({ names: ['Åsa Berg', '---', 'Cia Test'], exclusions: [], noMutual: true, baseUrl: URL, iterations: 1000 }),
    /saknar bokstäver/,
  );
});

test('varning och fel från lottningen når anroparen', async () => {
  const two = await createLottery({ names: ['A Test', 'B Test'], exclusions: [], noMutual: true, baseUrl: URL, iterations: 1000 });
  assert.equal(two.warnings.length, 1);
  await assert.rejects(
    createLottery({ names: ['A', 'B', 'C'], exclusions: [['A', 'B'], ['A', 'C']], noMutual: true, baseUrl: URL, iterations: 1000 }),
    /A kan inte ge till någon/,
  );
});

test('namnlista: radnummer, semikolon, dubbletter (även å/ä/ö och bindestreck), för långa namn', () => {
  const r = parseNames('1\tPeter Test;\n2  Elin  Test;\n\n3 peter test;\nÅsa Ö;\n');
  assert.deepEqual(r.names, ['Peter Test', 'Elin Test', 'Åsa Ö']);
  assert.deepEqual(r.duplicates, ['Peter Test']);
  assert.equal(parseNames('x'.repeat(64)).tooLong.length, 1);

  const d = parseNames('Åsa Berg\nAsa Berg\nAnna-Lena Ek\nanna lena ek\n');
  assert.deepEqual(d.names, ['Åsa Berg', 'Anna-Lena Ek']);
  assert.deepEqual(d.duplicates, ['Åsa Berg', 'Anna-Lena Ek']);
  assert.deepEqual(parseNames('---\nOk Namn').invalid, ['---']);
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
