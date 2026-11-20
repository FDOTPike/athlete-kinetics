// Compiles the backup contract the same way the verify:backup script does
// (package.json, verify:backup: tsc --strict --target es2020 --module commonjs
// --lib es2020 ... packages/core-db/src/backup/index.ts), into a disposable
// folder, and loads the result. The reader therefore runs the repository's own
// openBackup, not a copy of it.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

export function compileContract({ repoRoot, outDir }) {
  mkdirSync(outDir, { recursive: true });
  const tsc = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  const entry = join(repoRoot, 'packages', 'core-db', 'src', 'backup', 'index.ts');
  try {
    execFileSync(process.execPath, [tsc, '--strict', '--target', 'es2020', '--module', 'commonjs', '--lib', 'es2020', '--outDir', outDir, entry], {
      cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error('The backup contract did not compile. Check the repository checkout and its node_modules.');
  }
  return createRequire(import.meta.url)(join(outDir, 'index.js'));
}
