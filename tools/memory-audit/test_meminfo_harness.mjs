import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = mkdtempSync(join(tmpdir(), 'ak-harness-test-'));
const harness = process.argv[2] ?? join(import.meta.dirname, 'meminfo_harness.mjs');
let checks = 0;
try {
  const home = join(root, 'home');
  mkdirSync(home);
  const preload = join(root, 'mock-adb.mjs');
  writeFileSync(preload, `
import { mock } from 'node:test';
mock.module('node:os', { namedExports: { homedir: () => ${JSON.stringify(home)}, tmpdir: () => ${JSON.stringify(root)} } });
mock.module('node:child_process', { namedExports: { execFileSync: (_cmd, args) => {
  if (args[0] === 'devices') return 'List of devices attached\\nfixture\\tdevice\\n';
  if (args.includes('/proc/meminfo')) return 'MemTotal: 4000000 kB';
  if (args.includes('package')) return 'versionName=1.0';
  if (args.includes('meminfo')) return '** MEMINFO in pid 4242 [com.pikemethods.training.qa] **\\n'
    + '                   Pss  Private  Private  SwapPss      Rss\\n'
    + '                 Total    Dirty    Clean    Dirty    Total\\n'
    + '        TOTAL   100000    90000        0        0    100000\\n';
  return '+0000';
} } });
`);
  const run = (args, evidenceDir) => {
    const env = { ...process.env };
    delete env.AK_MEM_EVIDENCE_DIR;
    if (evidenceDir) env.AK_MEM_EVIDENCE_DIR = evidenceDir;
    return spawnSync(process.execPath, ['--experimental-test-module-mocks', '--import', pathToFileURL(preload).href, harness, ...args], {
      encoding: 'utf8', env, timeout: 10000,
    });
  };
  const victim = join(root, 'victim');
  mkdirSync(victim);
  const sentinel = join(victim, 'session.json');
  writeFileSync(sentinel, 'keep me');
  const linked = join(root, 'linked');
  symlinkSync(victim, linked, process.platform === 'win32' ? 'junction' : 'dir');
  assert.notEqual(run(['start'], linked).status, 0, 'linked evidence directory must be refused');
  assert.equal(readFileSync(sentinel, 'utf8'), 'keep me');
  console.log(`  [${++checks}] PASS precreated directory link cannot redirect session writes`);

  const evidence = join(root, 'evidence');
  mkdirSync(evidence, { mode: 0o700 });
  linkSync(sentinel, join(evidence, 'session.json'));
  const start = run(['start'], evidence);
  assert.equal(start.status, 0, start.stderr);
  assert.equal(readFileSync(sentinel, 'utf8'), 'keep me');
  console.log(`  [${++checks}] PASS atomic output replacement preserves hardlink target`);

  const fresh = run(['start']);
  assert.equal(fresh.status, 0, fresh.stderr);
  const active = JSON.parse(readFileSync(join(home, '.ak-mem-evidence', 'active.json'), 'utf8'));
  assert.match(active, /run-[A-Za-z0-9]+$/);
  assert.ok(existsSync(join(active, 'session.json')));
  const sample = run(['sample', '--label', 'cold-launch-baseline']);
  assert.equal(sample.status, 0, sample.stderr);
  assert.ok(existsSync(join(active, 'sample-001-cold-launch-baseline.txt')));
  const session = JSON.parse(readFileSync(join(active, 'session.json'), 'utf8'));
  assert.equal(session.samples[0].processId, 4242);
  console.log(`  [${++checks}] PASS separate commands resume the private default session and record target PID`);
  assert.notEqual(run(['sample', '--label', '../escape'], evidence).status, 0);
  console.log(`  [${++checks}] PASS path separators in sample labels are refused`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log(`Memory harness tests complete: ${checks} checks passed.`);
