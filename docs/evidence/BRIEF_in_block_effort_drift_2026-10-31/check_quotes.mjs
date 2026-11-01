// Checks that every passage the brief presents as file text appears inside
// the line range it cites, in the files as they were at the brief's pinned
// revision (quotes.json "revision"). Later work moves lines, so the files are
// read from that commit, not the working tree. Run from the repository root:
//   node docs/evidence/BRIEF_in_block_effort_drift_2026-10-31/check_quotes.mjs
// Exit 0 when all match; exit 1 and name each miss otherwise.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { revision, quotes } = JSON.parse(readFileSync(join(here, 'quotes.json'), 'utf8'));
if (!/^[0-9a-f]{40}$/.test(revision ?? '')) {
  console.log('MISS quotes.json: "revision" must be a full commit id');
  process.exit(1);
}
const squash = (s) => s.replace(/\s+/g, ' ').trim();
const fileAt = (file) => execFileSync('git', ['show', `${revision}:${file}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

console.log(`Files read at revision ${revision}`);
let misses = 0;
for (const q of quotes) {
  let lines;
  try {
    lines = fileAt(q.file).split(/\r?\n/);
  } catch {
    console.log(`MISS ${q.file}: not found at ${revision}`);
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
