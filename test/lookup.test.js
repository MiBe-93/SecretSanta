import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMeta, openEnvelope, MESSAGES } from '../docs/lib/lookup.js';
import { encryptEntry, fileId, newSalt } from '../docs/lib/crypto.js';
import { nameKey } from '../docs/lib/names.js';

// Endast påhittade data. Låtsas-fetch som loggar anropen.
function fakeFetch(routes, calls = []) {
  return async (url, opts) => {
    calls.push({ url, opts });
    const path = url.split('?')[0];
    const r = routes[path];
    if (r instanceof Error) throw r;
    if (!r) return { ok: false, status: 404, text: async () => 'Not found', json: async () => { throw new Error('html'); } };
    return { ok: r.status ? r.status < 400 : true, status: r.status ?? 200, text: async () => r.body, json: async () => JSON.parse(r.body) };
  };
}

// En liten färdig lottning med ett enda namn.
async function oneEntry(name = 'Anna Testsson', recipient = 'Bo Provsson') {
  const salt = newSalt();
  const key = nameKey(name);
  const id = await fileId(salt, key);
  const file = await encryptEntry({ id, secret: key, giver: name, recipient, iterations: 1000 });
  return { salt, id, file, routes: { [`data/${id}.json`]: { body: file } } };
}

test('rätt namn öppnar lappen, oavsett stora/små bokstäver, å/ä/ö och mellanslag', async () => {
  const { salt, routes } = await oneEntry('Åsa Öberg', 'Bo Provsson');
  for (const typed of ['Åsa Öberg', 'åsa öberg', ' ASA  OBERG ', 'asa oberg.']) {
    const r = await openEnvelope({ typed, salt, fetchFn: fakeFetch(routes) });
    assert.deepEqual(r, { ok: true, giver: 'Åsa Öberg', recipient: 'Bo Provsson' }, typed);
  }
});

test('mellannamn: förnamn + efternamn hittas även om man skrivit fler namn', async () => {
  const { salt, routes } = await oneEntry('Karin Lindqvist', 'Bo Provsson');
  const r = await openEnvelope({ typed: 'Karin Maria Lindqvist', salt, fetchFn: fakeFetch(routes) });
  assert.equal(r.ok, true);
  assert.equal(r.recipient, 'Bo Provsson');
});

test('okänt eller felstavat namn ger "hittar inte"-meddelandet, inte nätfel', async () => {
  const { salt, routes } = await oneEntry();
  for (const typed of ['Anna Testson', 'Anna', 'Någon Annan']) {
    const r = await openEnvelope({ typed, salt, fetchFn: fakeFetch(routes) });
    assert.equal(r.ok, false, typed);
    assert.equal(r.reason, 'not-found', typed);
    assert.equal(r.message, MESSAGES.notFound);
    assert.match(r.message, /Kolla stavningen/);
    assert.match(r.message, /ny lottning/);
  }
});

test('tomt namn hämtar ingenting', async () => {
  const { salt } = await oneEntry();
  const calls = [];
  for (const typed of ['', '   ', '...', '🎅']) {
    const r = await openEnvelope({ typed, salt, fetchFn: fakeFetch({}, calls) });
    assert.equal(r.reason, 'empty');
    assert.equal(r.message, MESSAGES.empty);
  }
  assert.equal(calls.length, 0);
});

test('gammal meta-fil mot nya filer (eller tvärtom) ger "hittar inte", inte ett tekniskt fel', async () => {
  const { routes } = await oneEntry();
  const r = await openEnvelope({ typed: 'Anna Testsson', salt: newSalt(), fetchFn: fakeFetch(routes) });
  assert.equal(r.reason, 'not-found');
});

test('trasig lapp ger "broken", nätfel och serverfel ger "network"', async () => {
  const { salt, id } = await oneEntry();
  for (const body of ['trasig fil', '', '{}', '<html>x</html>']) {
    const r = await openEnvelope({ typed: 'Anna Testsson', salt, fetchFn: fakeFetch({ [`data/${id}.json`]: { body } }) });
    assert.equal(r.reason, 'broken');
    assert.equal(r.message, MESSAGES.broken);
  }
  const a = await openEnvelope({ typed: 'Anna Testsson', salt, fetchFn: fakeFetch({ [`data/${id}.json`]: new TypeError('offline') }) });
  const b = await openEnvelope({ typed: 'Anna Testsson', salt, fetchFn: fakeFetch({ [`data/${id}.json`]: { status: 503, body: '' } }) });
  for (const r of [a, b]) {
    assert.equal(r.reason, 'network');
    assert.equal(r.message, MESSAGES.network);
  }
});

test('hämtar alltid med cache: no-store och cache-buster, utan cookies/referrer, och namnet står aldrig i URL:en', async () => {
  const { salt } = await oneEntry();
  const calls = [];
  await openEnvelope({ typed: 'Anna Testsson', salt, fetchFn: fakeFetch({}, calls) });
  await loadMeta(fakeFetch({}, calls));
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.opts.cache, 'no-store');
    assert.equal(c.opts.credentials, 'omit');
    assert.equal(c.opts.referrerPolicy, 'no-referrer');
    assert.match(c.url, /\?v=\d+$/);
    assert.ok(!/anna|testsson/i.test(c.url), 'namnet får inte finnas i URL:en');
  }
});

test('meta.json: saknas/trasig/fel version ger null, annars saltet', async () => {
  const salt = newSalt();
  assert.equal(await loadMeta(fakeFetch({})), null);
  assert.equal(await loadMeta(fakeFetch({ 'data/meta.json': { body: 'inte json' } })), null);
  assert.equal(await loadMeta(fakeFetch({ 'data/meta.json': { body: '{}' } })), null);
  assert.equal(await loadMeta(fakeFetch({ 'data/meta.json': { body: JSON.stringify({ v: 1, salt }) } })), null);
  assert.equal(await loadMeta(fakeFetch({ 'data/meta.json': { body: JSON.stringify({ v: 2, salt: '../x' }) } })), null);
  assert.equal(await loadMeta(fakeFetch({ 'data/meta.json': new TypeError('x') })), null);
  assert.deepEqual(await loadMeta(fakeFetch({ 'data/meta.json': { body: JSON.stringify({ v: 2, salt }) } })), { salt });
});

test('appen nämner ingen PIN eller kod', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['../docs/index.html', '../docs/app.js', '../docs/lib/lookup.js', '../docs/admin/build.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /\bpin\b|\bkod(en|er)?\b/i, f);
  }
});
