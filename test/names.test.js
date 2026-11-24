import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameKey, nameCandidates, nameTokens } from '../docs/lib/names.js';

test('stora/små bokstäver, extra mellanslag och å/ä/ö spelar ingen roll', () => {
  const k = nameKey('Åsa Öberg');
  assert.equal(k, 'asa oberg');
  for (const v of ['åsa öberg', 'ÅSA  ÖBERG', '  Asa Oberg ', 'Åsa\tÖberg', 'asa oberg.']) assert.equal(nameKey(v), k, v);
});

test('å, ä och ö i olika unicode-former ger samma nyckel', () => {
  assert.equal(nameKey('Åsa'.normalize('NFC')), nameKey('Åsa'.normalize('NFD')));
  assert.equal(nameKey('Björn Ängel'.normalize('NFD')), 'bjorn angel');
});

test('bindestreck och apostrof räknas som mellanrum', () => {
  assert.equal(nameKey('Anna-Lena Svensson'), 'anna lena svensson');
  assert.equal(nameKey('Anna Lena Svensson'), 'anna lena svensson');
  assert.equal(nameKey("Sean O'Brien"), 'sean o brien');
});

test('namn utan bokstäver ger tom nyckel och inga kandidater', () => {
  assert.equal(nameKey('---'), '');
  assert.equal(nameKey('   '), '');
  assert.equal(nameKey(undefined), '');
  assert.deepEqual(nameCandidates('  ... '), []);
  assert.deepEqual(nameTokens(null), []);
});

test('kandidater: hela namnet först, sedan förnamn + efternamn om det finns mellannamn', () => {
  assert.deepEqual(nameCandidates('Karin Lindqvist'), ['karin lindqvist']);
  assert.deepEqual(nameCandidates('karin'), ['karin']);
  assert.deepEqual(nameCandidates('Karin Maria Lindqvist'), ['karin maria lindqvist', 'karin lindqvist']);
});

test('andra skriftsystem och specialtecken kraschar inte', () => {
  assert.equal(nameKey('Søren Æble'), 'soren aeble');
  assert.equal(nameKey('Zoë Müller'), 'zoe muller');
  assert.equal(nameKey('🎅🎅'), '');
});
