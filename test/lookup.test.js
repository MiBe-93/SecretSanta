import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadParticipants, openEnvelope, MESSAGES } from '../docs/lib/lookup.js';
import { encryptEntry, randomId } from '../docs/lib/crypto.js';

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

test('404 på personfil ger "ny lottning"-meddelandet, inte "Fel kod"', async () => {
  const id = randomId();
  const res = await openEnvelope({ id, pin: '1234', fetchFn: fakeFetch({}) });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'stale');
  assert.equal(res.message, 'Det verkar ha gjorts en ny lottning. Vänta några minuter och ladda om sidan.');
  assert.notEqual(res.message, MESSAGES.wrongCode);
});

test('fel PIN och trasig fil ger neutralt "Fel kod"', async () => {
  const id = randomId();
  const file = await encryptEntry({ id, pin: '1234', recipient: 'Test Testsson', iterations: 1000 });
  const ok = await openEnvelope({ id, pin: '1234', fetchFn: fakeFetch({ [`data/${id}.json`]: { body: file } }) });
  assert.deepEqual(ok, { ok: true, name: 'Test Testsson' });

  for (const body of [file, 'trasig fil', '', '{}', '<html>404</html>']) {
    const r = await openEnvelope({ id, pin: '9999', fetchFn: fakeFetch({ [`data/${id}.json`]: { body } }) });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'wrong-code');
    assert.equal(r.message, 'Fel kod');
  }
});

test('nätfel och serverfel är varken "Fel kod" eller "ny lottning"', async () => {
  const id = randomId();
  const a = await openEnvelope({ id, pin: '1234', fetchFn: fakeFetch({ [`data/${id}.json`]: new TypeError('offline') }) });
  const b = await openEnvelope({ id, pin: '1234', fetchFn: fakeFetch({ [`data/${id}.json`]: { status: 503, body: '' } }) });
  for (const r of [a, b]) {
    assert.equal(r.reason, 'network');
    assert.equal(r.message, MESSAGES.network);
  }
});

test('hämtar alltid med cache: no-store och cache-buster, utan cookies/referrer', async () => {
  const id = randomId();
  const calls = [];
  await openEnvelope({ id, pin: '1234', fetchFn: fakeFetch({}, calls) });
  await loadParticipants(fakeFetch({}, calls));
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(c.opts.cache, 'no-store');
    assert.equal(c.opts.credentials, 'omit');
    assert.equal(c.opts.referrerPolicy, 'no-referrer');
    assert.match(c.url, /\?v=\d+$/);
    assert.ok(!c.url.includes('1234'), 'PIN får inte finnas i URL:en');
  }
});

test('participants.json: saknas/trasig/tom ger null, annars listan', async () => {
  assert.equal(await loadParticipants(fakeFetch({})), null);
  assert.equal(await loadParticipants(fakeFetch({ 'data/participants.json': { body: 'inte json' } })), null);
  assert.equal(await loadParticipants(fakeFetch({ 'data/participants.json': { body: '{"participants":[]}' } })), null);
  assert.equal(await loadParticipants(fakeFetch({ 'data/participants.json': new TypeError('x') })), null);
  const list = await loadParticipants(fakeFetch({ 'data/participants.json': { body: '{"participants":[{"id":"a","name":"X"}]}' } }));
  assert.equal(list.length, 1);
});

test('ogiltigt id hämtar ingenting och ger "Fel kod"', async () => {
  const calls = [];
  const r = await openEnvelope({ id: '../hemligt', pin: '1234', fetchFn: fakeFetch({}, calls) });
  assert.equal(r.message, 'Fel kod');
  assert.equal(calls.length, 0);
});

test('texterna antyder inte att man väljer en egen kod', async () => {
  const { readFileSync } = await import('node:fs');
  const files = ['../docs/index.html', '../docs/app.js', '../docs/lib/lookup.js', '../docs/admin/build.js'];
  for (const f of files) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /välj (en |din )?(egen |ny )?(kod|pin)|skapa (en |din )?(egen )?(kod|pin)|första gången/i, f);
  }
  const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
  assert.match(html, /den du fått i meddelandet/);
});
