/**
 * py.mjs — cross-platform Python launcher for the verify gates.
 *
 * Windows installs commonly expose `py` (launcher) but not `python`;
 * Linux/CI exposes `python3` but often not `python`. This shim tries the
 * platform-appropriate candidates and runs the given script with the first
 * interpreter that answers. Zero dependencies, no PATH mutation.
 *
 * Usage: node scripts/py.mjs <script.py> [args...]
 */
import { spawnSync } from 'node:child_process';

const candidates = process.platform === 'win32'
  ? ['py', 'python', 'python3']
  : ['python3', 'python'];

for (const cmd of candidates) {
  const probe = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  if (probe.status === 0) {
    const run = spawnSync(cmd, process.argv.slice(2), { stdio: 'inherit' });
    process.exit(run.status ?? 1);
  }
}

console.error(`No Python 3 interpreter found (tried: ${candidates.join(', ')}).`);
console.error('Install Python 3.10+ — on Windows: winget install Python.Python.3.12');
console.error('(or python.org installer with "Add python.exe to PATH" ticked).');
process.exit(1);
