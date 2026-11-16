// Lottning. Ren JavaScript utan beroenden.
//
// Resultatet returneras bara i minnet. Den här filen skriver aldrig till
// konsol, fil eller något annat.

import { shuffle } from './random.js';

export class DrawError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DrawError';
  }
}

// Max antal söksteg för backtracking med regeln "inga ömsesidiga byten".
const NODE_LIMIT = 300000;
const LIMIT_HIT = Symbol('limit');

/**
 * @param {object} opts
 * @param {string[]} opts.names             unika namn
 * @param {Array<[string,string]>} opts.exclusions  par som inte får dra varandra (båda håll)
 * @param {boolean} [opts.noMutual=true]    inga ömsesidiga byten (A->B och B->A)
 * @returns {{assignment: Map<string,string>, warnings: string[]}}  giver -> mottagare
 */
export function draw({ names, exclusions = [], noMutual = true }) {
  if (!Array.isArray(names)) throw new DrawError('Namnlistan saknas.');
  const clean = names.map((n) => (typeof n === 'string' ? n.trim() : ''));
  if (clean.some((n) => n === '')) throw new DrawError('Ett namn är tomt.');
  if (new Set(clean).size !== clean.length) throw new DrawError('Namnlistan innehåller dubbletter.');
  if (clean.length < 2) throw new DrawError('Det måste vara minst två personer.');

  const n = clean.length;
  const index = new Map(clean.map((name, i) => [name, i]));
  const forbidden = Array.from({ length: n }, () => new Array(n).fill(false));
  for (let i = 0; i < n; i++) forbidden[i][i] = true;
  for (const pair of exclusions) {
    const [a, b] = pair;
    if (!index.has(a) || !index.has(b)) throw new DrawError('Ett undantag hänvisar till ett namn som inte finns i listan.');
    if (a === b) continue;
    forbidden[index.get(a)][index.get(b)] = true;
    forbidden[index.get(b)][index.get(a)] = true;
  }
  const allowed = forbidden.map((row, i) => row.map((f, j) => (f ? -1 : j)).filter((j) => j >= 0));

  // 1. Finns det över huvud taget en lösning? (bipartit matchning)
  const probe = maxMatching(allowed, n);
  if (probe.size < n) throw new DrawError(explainInfeasible(clean, allowed, probe));

  const warnings = [];
  const toResult = (to) => new Map(to.map((r, g) => [clean[g], clean[r]]));

  // 2. Slumpad backtracking, först med regeln om ömsesidiga byten.
  if (noMutual) {
    const r = backtrack(allowed, n, true);
    if (r === LIMIT_HIT) {
      warnings.push(
        'Hittade ingen lottning utan ömsesidiga byten inom rimlig tid, så den regeln är avstängd för den här lottningen. ' +
          'Någon kan alltså ha dragit någon som dragit hen. Ta bort några undantag och lotta igen om du vill ha regeln.',
      );
    } else if (r) {
      return { assignment: toResult(r), warnings };
    } else {
      warnings.push(
        'Det gick inte att lotta utan ömsesidiga byten med de här undantagen (A ger till B och B ger till A), ' +
          'så den regeln är avstängd för den här lottningen. Ta bort några undantag eller lägg till fler personer om du vill ha regeln.',
      );
    }
  }

  // 3. Utan mutual-regeln. Backtracking, med garanterad reserv (slumpad matchning).
  let r = backtrack(allowed, n, false);
  if (r === LIMIT_HIT || !r) {
    const m = maxMatching(allowed, n, true);
    r = new Array(n);
    for (let recv = 0; recv < n; recv++) r[m.matchR[recv]] = recv;
  }
  return { assignment: toResult(r), warnings };
}

// ---------------------------------------------------------------------------

/** Slumpad backtracking med "minst antal val först". Returnerar array giver->mottagare, null (omöjligt) eller LIMIT_HIT. */
function backtrack(allowed, n, noMutual) {
  const to = new Array(n).fill(-1);
  const taken = new Array(n).fill(false);
  let nodes = 0;

  const candidates = (g) => {
    const out = [];
    for (const r of allowed[g]) {
      if (taken[r]) continue;
      if (noMutual && to[r] === g) continue;
      out.push(r);
    }
    return out;
  };

  const search = () => {
    if (++nodes > NODE_LIMIT) return LIMIT_HIT;
    let best = -1;
    let bestCands = null;
    for (const g of shuffle([...Array(n).keys()])) {
      if (to[g] !== -1) continue;
      const c = candidates(g);
      if (bestCands === null || c.length < bestCands.length) {
        best = g;
        bestCands = c;
        if (c.length === 0) return false;
      }
    }
    if (best === -1) return true;
    for (const r of shuffle(bestCands)) {
      to[best] = r;
      taken[r] = true;
      const res = search();
      if (res !== false) {
        if (res === true) return true;
        return res; // LIMIT_HIT
      }
      to[best] = -1;
      taken[r] = false;
    }
    return false;
  };

  const res = search();
  if (res === true) return to;
  return res === LIMIT_HIT ? LIMIT_HIT : null;
}

/** Kuhns algoritm. matchR[mottagare] = giver. */
function maxMatching(allowed, n, randomize = false) {
  const matchR = new Array(n).fill(-1);
  const order = randomize ? shuffle([...Array(n).keys()]) : [...Array(n).keys()];
  const lists = randomize ? allowed.map((l) => shuffle(l)) : allowed;
  let size = 0;
  const unmatched = [];
  for (const g of order) {
    const seen = new Array(n).fill(false);
    if (augment(g, lists, matchR, seen)) size++;
    else unmatched.push(g);
  }
  return { size, matchR, unmatched };
}

function augment(g, lists, matchR, seen) {
  for (const r of lists[g]) {
    if (seen[r]) continue;
    seen[r] = true;
    if (matchR[r] === -1 || augment(matchR[r], lists, matchR, seen)) {
      matchR[r] = g;
      return true;
    }
  }
  return false;
}

function list(names) {
  return names.join(', ');
}

/** Förklarar vilka regler som krockar. Nämner bara namn i reglerna, aldrig något lottningsresultat. */
function explainInfeasible(names, allowed, probe) {
  const n = names.length;
  const parts = [];

  for (let g = 0; g < n; g++) {
    if (allowed[g].length === 0) parts.push(`${names[g]} kan inte ge till någon, eftersom alla andra är undantagna.`);
  }
  const inDeg = new Array(n).fill(0);
  allowed.forEach((l) => l.forEach((r) => inDeg[r]++));
  for (let r = 0; r < n; r++) {
    if (inDeg[r] === 0) parts.push(`Ingen kan ge till ${names[r]}, eftersom alla andra är undantagna.`);
  }
  if (parts.length) return `Reglerna går inte ihop. ${parts.join(' ')} Ta bort något undantag.`;

  // Hall-överträdelse: hitta en grupp givare som tillsammans har för få möjliga mottagare.
  const start = probe.unmatched[0];
  const S = new Set([start]);
  const N = new Set();
  const queue = [start];
  while (queue.length) {
    const g = queue.shift();
    for (const r of allowed[g]) {
      if (N.has(r)) continue;
      N.add(r);
      const g2 = probe.matchR[r];
      if (g2 !== -1 && !S.has(g2)) {
        S.add(g2);
        queue.push(g2);
      }
    }
  }
  const sNames = [...S].map((i) => names[i]).sort();
  const nNames = [...N].map((i) => names[i]).sort();
  return (
    `Reglerna går inte ihop: ${sNames.length} personer (${list(sNames)}) kan tillsammans bara ge till ` +
    `${nNames.length} personer (${list(nNames)}) på grund av undantagen. Ta bort något av undantagen som rör dem.`
  );
}
