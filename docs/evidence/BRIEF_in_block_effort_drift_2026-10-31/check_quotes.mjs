// Checks that every passage the brief presents as file text appears inside
// the line range it cites. Run from the repository root:
//   node docs/evidence/BRIEF_in_block_effort_drift_2026-10-31/check_quotes.mjs
// Exit 0 when all match; exit 1 and name each miss otherwise.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { quotes } = JSON.parse(readFileSync(join(here, 'quotes.json'), 'utf8'));
const squash = (s) => s.replace(/\s+/g, ' ').trim();

let misses = 0;
for (const q of quotes) {
  let lines;
  try {
    lines = readFileSync(q.file, 'utf8').split(/\r?\n/);
  } catch {
    console.log(`MISS ${q.file}: file not found`);
    misses += 1;
    continue;
  }
  const [from, to] = q.lines;
  const window = squash(lines.slice(from - 1, to).join(' '));
  if (window.includes(squash(q.text))) {
    console.log(`OK   ${q.file}:${from}-${to}  ${q.text.slice(0, 60)}`);
  } else {
    console.log(`MISS ${q.file}:${from}-${to}  ${q.text}`);
    misses += 1;
  }
}
console.log(`${quotes.length - misses} of ${quotes.length} quotations found at their cited lines`);
process.exit(misses === 0 ? 0 : 1);
