import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draw, DrawError } from '../docs/lib/draw.js';
import { randomInt } from '../docs/lib/random.js';

// Endast påhittade namn.
const makeNames = (n) => Array.from({ length: n }, (_, i) => `Person${i + 1} Test`);

function check(names, exclusions, assignment) {
  assert.equal(assignment.size, names.length);
  const receivers = new Set(assignment.values());
  assert.equal(receivers.size, names.length, 'alla får exakt en');
  for (const [g, r] of assignment) {
    assert.notEqual(g, r, 'ingen drar sig själv');
    assert.ok(names.includes(g) && names.includes(r));
    for (const [a, b] of exclusions) {
      assert.ok(!((g === a && r === b) || (g === b && r === a)), 'undantag följs');
    }
  }
}
const hasMutual = (assignment) => [...assignment].some(([g, r]) => assignment.get(r) === g);

// Brute force för små n: finns en giltig permutation (med/utan mutual-regeln)?
function brute(names, exclusions, noMutual) {
  const n = names.length;
  const forb = new Set(exclusions.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
  const perm = [];
  const used = new Array(n).fill(false);
  const rec = (g) => {
    if (g === n) return true;
    for (let r = 0; r < n; r++) {
      if (used[r] || r === g || forb.has(`${names[g]}|${names[r]}`)) continue;
      if (noMutual && r < g && perm[r] === g) continue;
      used[r] = true;
      perm[g] = r;
      if (rec(g + 1)) return true;
      used[r] = false;
    }
    return false;
  };
  return rec(0);
}

test('många slumpade körningar med planterade lösningar följer alla regler', () => {
  for (let run = 0; run < 300; run++) {
    const n = 3 + randomInt(18);
    const names = makeNames(n);
    // Planterad lösning (cyklisk permutation) garanterar att en lösning finns.
    const planted = new Set(names.map((nm, i) => `${nm}|${names[(i + 1) % n]}`));
    const exclusions = [];
    const k = randomInt(n * 2);
    for (let i = 0; i < k; i++) {
      const a = names[randomInt(n)];
      const b = names[randomInt(n)];
      if (a === b || planted.has(`${a}|${b}`) || planted.has(`${b}|${a}`)) continue;
      exclusions.push([a, b]);
    }
    const noMutual = randomInt(2) === 0;
    const { assignment, warnings } = draw({ names, exclusions, noMutual });
    check(names, exclusions, assignment);
    if (noMutual && warnings.length === 0) assert.ok(!hasMutual(assignment));
  }
});

test('stämmer mot brute force på små fall (lösning finns/finns inte, varning vid fallback)', () => {
  for (let run = 0; run < 400; run++) {
    const n = 2 + randomInt(5);
    const names = makeNames(n);
    const exclusions = [];
    const k = randomInt(n + 3);
    for (let i = 0; i < k; i++) {
      const a = names[randomInt(n)];
      const b = names[randomInt(n)];
      if (a !== b) exclusions.push([a, b]);
    }
    const noMutual = randomInt(2) === 0;
    const base = brute(names, exclusions, false);
    if (!base) {
      assert.throws(() => draw({ names, exclusions, noMutual }), DrawError);
      continue;
    }
    const { assignment, warnings } = draw({ names, exclusions, noMutual });
    check(names, exclusions, assignment);
    if (noMutual) {
      if (brute(names, exclusions, true)) {
        assert.equal(warnings.length, 0, 'ska hitta lösning utan mutual när en finns');
        assert.ok(!hasMutual(assignment));
      } else {
        assert.equal(warnings.length, 1, 'ska varna vid fallback');
      }
    } else {
      assert.equal(warnings.length, 0);
    }
  }
});

test('två personer: fallback med tydlig varning', () => {
  const { assignment, warnings } = draw({ names: ['A Test', 'B Test'], noMutual: true });
  assert.equal(assignment.get('A Test'), 'B Test');
  assert.equal(assignment.get('B Test'), 'A Test');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ömsesidiga byten/);
});

test('ingen lösning: felet pekar ut vilka regler som krockar', () => {
  // A kan inte ge till någon
  assert.throws(
    () => draw({ names: ['A', 'B', 'C'], exclusions: [['A', 'B'], ['A', 'C']] }),
    (e) => e instanceof DrawError && /A kan inte ge till någon/.test(e.message),
  );
  // Ingen kan ge till D
  assert.throws(
    () => draw({ names: ['A', 'B', 'C', 'D'], exclusions: [['A', 'D'], ['B', 'D'], ['C', 'D']] }),
    (e) => e instanceof DrawError && /Ingen kan ge till D/.test(e.message),
  );
  // A och B kan bara ge till C
  assert.throws(
    () => draw({ names: ['A', 'B', 'C', 'D'], exclusions: [['A', 'B'], ['A', 'D'], ['B', 'D']] }),
    (e) => e instanceof DrawError && /A, B\) kan tillsammans bara ge till 1 personer \(C\)/.test(e.message),
  );
});

test('ogiltig indata ger tydliga fel', () => {
  assert.throws(() => draw({ names: ['A'] }), DrawError);
  assert.throws(() => draw({ names: ['A', 'A'] }), /dubbletter/);
  assert.throws(() => draw({ names: ['A', ''] }), /tomt/);
  assert.throws(() => draw({ names: ['A', 'B'], exclusions: [['A', 'Z']] }), /inte finns/);
});

test('slumpen varierar (alla 6 möjligheter för 3 personer förekommer snart)', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const { assignment } = draw({ names: ['A', 'B', 'C'], noMutual: false });
    seen.add(JSON.stringify([...assignment]));
  }
  assert.equal(seen.size, 2, 'för 3 personer finns exakt 2 derangemang, båda ska förekomma');
});

test('20 personer med många undantag går snabbt', () => {
  const names = makeNames(20);
  const exclusions = [];
  for (let i = 0; i < 20; i += 2) exclusions.push([names[i], names[i + 1]]);
  for (let i = 0; i < 20; i++) exclusions.push([names[i], names[(i + 5) % 20]]);
  const t = Date.now();
  for (let i = 0; i < 50; i++) {
    const { assignment } = draw({ names, exclusions, noMutual: true });
    check(names, exclusions, assignment);
  }
  assert.ok(Date.now() - t < 5000);
});

test('draw skriver inget till konsolen', () => {
  const orig = { ...console };
  let calls = 0;
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) console[k] = () => calls++;
  try {
    draw({ names: makeNames(8), exclusions: [] });
  } finally {
    Object.assign(console, orig);
  }
  assert.equal(calls, 0);
});
