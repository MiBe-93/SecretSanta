// Tar bort alla genererade filer i docs/data/ (behåller .gitkeep).
// Användning: npm run rensa-data
// Visar först vilka filer som tas bort och ber om bekräftelse (skriv "ja").
// Valfritt argument: en annan mapp (används av testerna).

import { readdir, rm, writeFile, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? fileURLToPath(new URL('../docs/data/', import.meta.url)));
const GENERATED = /^(participants|[0-9a-f]{16})\.json$/;

let entries = [];
try {
  entries = await readdir(dir);
} catch {
  entries = [];
}
const toRemove = entries.filter((f) => GENERATED.test(f)).sort();
const others = entries.filter((f) => !GENERATED.test(f) && f !== '.gitkeep').sort();

if (others.length) {
  console.log(`Obs: ${others.length} fil(er) i mappen ser inte genererade ut och rörs inte: ${others.join(', ')}`);
}
if (toRemove.length === 0) {
  console.log('Inga genererade filer att ta bort i docs/data/.');
  await keep();
  process.exit(0);
}

console.log(`Följande ${toRemove.length} filer i ${path.relative(process.cwd(), dir) || '.'} tas bort:`);
for (const f of toRemove) console.log(`  ${f}`);

const answer = await new Promise((resolve) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.on('close', () => resolve('')); // tom/stängd inmatning räknas som "nej"
  rl.question('Skriv "ja" för att ta bort dem: ', (a) => {
    resolve(a.trim().toLowerCase());
    rl.close();
  });
});
if (answer !== 'ja') {
  console.log('Avbröt. Inget togs bort.');
  process.exit(1);
}
for (const f of toRemove) await rm(path.join(dir, f));
await keep();
console.log(`Klart, ${toRemove.length} filer borttagna. Glöm inte att committa och pusha ändringen (git add -A && git commit && git push).`);

async function keep() {
  try {
    await stat(path.join(dir, '.gitkeep'));
  } catch {
    await writeFile(path.join(dir, '.gitkeep'), '');
  }
}
