#!/usr/bin/env node
// Off-phone reader for an encrypted pikeMethods beta backup (.pmbak).
// Local tool for the owner. Not shipped in the app and not in CI.
//
// Usage (in a terminal window):
//   node tools/beta-reader/read_beta_backup.mjs --backup <file.pmbak> --manifest <consent.json> --out <folder> [--label <name>] [--include-free-text]
//
// The password is typed at a hidden prompt. It is never read from arguments,
// environment variables or files. Outputs: READING_AGGREGATE_<label>.json
// (de-identified counts) and PRIVATE_PER_ATHLETE_<label>.json (owner only), plus
// PRIVATE_FREE_TEXT_<label>.json when --include-free-text is given.
import { readBackup, ReaderError } from './lib/read_backup.mjs';
import { promptHiddenPassword } from './lib/prompt_hidden.mjs';

const VALUE_FLAGS = new Set(['--backup', '--manifest', '--out', '--label', '--work-base']);
const BOOLEAN_FLAGS = new Set(['--include-free-text']);
const REFUSED = new Set(['--password', '--pass', '--pw', '-p']);

function fail(message, status = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(status);
}

const options = {};
const argv = process.argv.slice(2);
for (let index = 0; index < argv.length; index += 1) {
  const flag = argv[index];
  // The name is the part before any '='. A password written as --password=... is refused
  // by name, and nothing after '=' is ever echoed back.
  const name = flag.split('=')[0];
  if (REFUSED.has(name)) fail('The password is never accepted on the command line. You will be asked for it at a hidden prompt.');
  if (BOOLEAN_FLAGS.has(flag)) { options[flag] = true; continue; }
  if (VALUE_FLAGS.has(flag)) {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) fail(`${flag} needs a value.`);
    options[flag] = value;
    index += 1;
    continue;
  }
  // Unknown arguments are not echoed: an unrecognised token may be a secret typed in the wrong place.
  fail('Unknown argument. Usage: --backup <file.pmbak> --manifest <consent.json> --out <folder> [--label <name>] [--include-free-text]');
}
for (const required of ['--backup', '--manifest', '--out']) {
  if (!options[required]) fail(`Missing ${required}. Usage: --backup <file.pmbak> --manifest <consent.json> --out <folder>`);
}
if (!process.stdin.isTTY) {
  fail('The password prompt needs an interactive terminal. Run this tool in a terminal window on the owner\'s machine.');
}

try {
  const result = await readBackup({
    backupPath: options['--backup'],
    manifestPath: options['--manifest'],
    outDir: options['--out'],
    label: options['--label'] ?? 'reading',
    includeFreeText: options['--include-free-text'] === true,
    workBase: options['--work-base'],
    promptPassword: () => promptHiddenPassword(),
  });
  process.stdout.write(`Aggregate (de-identified): ${result.aggregatePath}\n`);
  process.stdout.write(`Private per-athlete file (owner only): ${result.privatePath}\n`);
  if (result.freeTextPath) process.stdout.write(`Private free text (owner only): ${result.freeTextPath}\n`);
  process.exit(0);
} catch (error) {
  if (error instanceof ReaderError) fail(`${error.code}: ${error.message}`, 1);
  fail(`Reader stopped: ${error && error.message ? String(error.message).slice(0, 200) : 'unknown error'}`, 1);
}
