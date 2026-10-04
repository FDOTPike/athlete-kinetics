/**
 * verify_workflow_shell.mjs — every multi-line `run: |` block in the CI
 * workflows must parse as bash (`bash -n`).
 *
 * A quoting slip in a run block (an unterminated `node -e '…'`, a stray `fi`)
 * is otherwise discovered only on the runner, after a 10-minute macOS queue
 * and install. This reads the block bodies by indentation (no YAML
 * dependency, like verify_ci_structure.mjs) and fails closed on any parse
 * error, and when bash itself cannot be run.
 *
 *   node tools/verify_workflow_shell.mjs [workflow.yml ...]
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The bodies of `run: |` blocks, with the 1-based line each starts on. */
export function runBlocks(text) {
  const lines = String(text).split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(\s*)(?:- )?run: \|[-+]?\s*$/);
    if (!m) continue;
    const indent = m[1].length + 2;
    const body = [];
    let j = i + 1;
    for (; j < lines.length; j += 1) {
      const line = lines[j];
      if (line.trim() === '') { body.push(''); continue; }
      if (line.match(/^\s*/)[0].length < indent) break;
      body.push(line.slice(indent));
    }
    blocks.push({ line: i + 1, body: body.join('\n') });
  }
  return blocks;
}

function bashParses(body) {
  try {
    execFileSync('bash', ['-n'], { input: body, stdio: ['pipe', 'pipe', 'pipe'] });
    return null;
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('bash is not available; this gate needs it (Git Bash on Windows)');
    return String(error.stderr ?? error.message).trim();
  }
}

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : readdirSync('.github/workflows').filter((f) => /\.ya?ml$/.test(f)).map((f) => join('.github/workflows', f));

// Self-test: the gate must reject a broken block before it is trusted.
const broken = bashParses("node -e '\n  console.log(1)\nif true; then\n  echo x\nfi\n");
if (broken === null) {
  console.error('FAIL  the shell parser accepted a known-broken block (unterminated quote)');
  process.exit(1);
}

let total = 0;
let bad = 0;
for (const file of files) {
  for (const block of runBlocks(readFileSync(file, 'utf8'))) {
    total += 1;
    const error = bashParses(block.body);
    if (error !== null) {
      bad += 1;
      console.error(`FAIL  ${file}:${block.line} run block does not parse: ${error.split('\n')[0]}`);
    }
  }
}
if (total === 0) {
  console.error('FAIL  no run blocks found (the reader is broken or the workflows moved)');
  process.exit(1);
}
console.log(`${bad === 0 ? 'WORKFLOW SHELL VERIFIED' : 'WORKFLOW SHELL CHECK FAILED'}: ${total} run blocks, ${bad} with parse errors`);
process.exit(bad === 0 ? 0 : 1);
