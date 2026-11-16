import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/rensa-data.mjs', import.meta.url));

function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), 'rensa-'));
  writeFileSync(path.join(dir, 'participants.json'), '{}');
  writeFileSync(path.join(dir, '0123456789abcdef.json'), '{}');
  writeFileSync(path.join(dir, 'fedcba9876543210.json'), '{}');
  writeFileSync(path.join(dir, 'annat.txt'), 'rörs inte');
  return dir;
}
const run = (dir, input) => spawnSync('node', [script, dir], { input, encoding: 'utf8' });

test('visar filerna, tar bara bort efter "ja", behåller .gitkeep', () => {
  const dir = setup();
  try {
    const r = run(dir, 'ja\n');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /tas bort/);
    assert.match(r.stdout, /0123456789abcdef\.json/);
    assert.match(r.stdout, /participants\.json/);
    assert.deepEqual(readdirSync(dir).sort(), ['.gitkeep', 'annat.txt']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('svarar man något annat än "ja" tas inget bort', () => {
  const dir = setup();
  try {
    for (const input of ['nej\n', '\n', '']) {
      const r = run(dir, input);
      assert.equal(r.status, 1);
      assert.equal(readdirSync(dir).length, 4);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tom/saknad mapp: inget att ta bort, .gitkeep skapas', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'rensa-'));
  try {
    const r = run(dir, '');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Inga genererade filer/);
    assert.deepEqual(readdirSync(dir), ['.gitkeep']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
