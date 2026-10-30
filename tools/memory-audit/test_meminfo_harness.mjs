import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = realpathSync(mkdtempSync(join(tmpdir(), 'ak-harness-test-')));
const harness = process.argv[2] ?? join(import.meta.dirname, 'meminfo_harness.mjs');
let checks = 0;
try {
  const home = join(root, 'home');
  mkdirSync(home);
  const preload = join(root, 'mock-adb.mjs');
  writeFileSync(preload, `
import { mock } from 'node:test';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
if (process.env.AK_TEST_ROOT_ALIASES || process.env.AK_TEST_POSIX_MODES) {
  const aliases = JSON.parse(process.env.AK_TEST_ROOT_ALIASES ?? '[]');
  const modes = JSON.parse(process.env.AK_TEST_POSIX_MODES ?? '{}');
  const lstatSync = fs.lstatSync;
  process.getuid = () => 1000;
  fs.lstatSync = (path) => {
    const stat = lstatSync(path);
    stat.uid = aliases.includes(path) ? 0 : path === process.env.AK_TEST_UNTRUSTED_DIR ? 2000 : 1000;
    stat.mode = (stat.mode & ~0o1777) | (modes[path] ?? 0o700);
    return stat;
  };
  syncBuiltinESMExports();
}
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
  const run = (args, evidenceDir, extraEnv = {}) => {
    const env = { ...process.env, ...extraEnv };
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
  const refusedLink = run(['start'], linked);
  assert.notEqual(refusedLink.status, 0, 'linked evidence directory must be refused');
  assert.match(refusedLink.stderr, /Linked evidence directory/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'keep me');
  console.log(`  [${++checks}] PASS precreated directory link cannot redirect session writes`);

  const systemAlias = join(root, 'system-alias');
  symlinkSync(victim, systemAlias, process.platform === 'win32' ? 'junction' : 'dir');
  const aliasEnv = { AK_TEST_ROOT_ALIASES: JSON.stringify([systemAlias]) };
  const trustedAlias = run(['start'], join(systemAlias, 'trusted-evidence'), aliasEnv);
  assert.equal(trustedAlias.status, 0, trustedAlias.stderr);
  console.log(`  [${++checks}] PASS root-owned system alias with a trusted target chain is allowed`);

  const nestedLink = join(victim, 'nested-link');
  symlinkSync(home, nestedLink, process.platform === 'win32' ? 'junction' : 'dir');
  const redirectedAlias = join(root, 'redirected-alias');
  symlinkSync(nestedLink, redirectedAlias, process.platform === 'win32' ? 'junction' : 'dir');
  const nested = run(['start'], join(redirectedAlias, 'evidence'), {
    AK_TEST_ROOT_ALIASES: JSON.stringify([redirectedAlias]),
  });
  assert.notEqual(nested.status, 0);
  assert.match(nested.stderr, /Linked evidence directory/);
  assert.equal(existsSync(join(home, 'evidence')), false);
  console.log(`  [${++checks}] PASS root-owned alias cannot hide a non-root-owned target link`);

  const untrusted = run(['start'], join(systemAlias, 'untrusted-evidence'), {
    ...aliasEnv, AK_TEST_UNTRUSTED_DIR: victim,
  });
  assert.notEqual(untrusted.status, 0);
  assert.match(untrusted.stderr, /Linked evidence directory/);
  assert.equal(existsSync(join(victim, 'untrusted-evidence')), false);
  console.log(`  [${++checks}] PASS root-owned alias cannot enter another user's directory`);

  const writableAncestor = join(root, 'writable-ancestor');
  mkdirSync(writableAncestor);
  for (const [label, mode] of [['group-writable', 0o720], ['other-writable', 0o702]]) {
    const writable = run(['start'], join(writableAncestor, `${label}-evidence`), {
      AK_TEST_POSIX_MODES: JSON.stringify({ [writableAncestor]: mode }),
    });
    assert.notEqual(writable.status, 0, `${label} non-sticky ancestor must be refused`);
    assert.match(writable.stderr, /Linked evidence directory/);
    assert.equal(existsSync(join(writableAncestor, `${label}-evidence`)), false);
  }
  console.log(`  [${++checks}] PASS group- or other-writable non-sticky ancestor is refused`);

  const stickyAncestor = join(root, 'sticky-tmp');
  mkdirSync(stickyAncestor);
  const stickyAllowed = run(['start'], join(stickyAncestor, 'evidence'), {
    AK_TEST_ROOT_ALIASES: JSON.stringify([stickyAncestor]),
    AK_TEST_POSIX_MODES: JSON.stringify({ [stickyAncestor]: 0o1777 }),
  });
  assert.equal(stickyAllowed.status, 0, stickyAllowed.stderr);
  assert.ok(existsSync(join(stickyAncestor, 'evidence', 'session.json')));
  console.log(`  [${++checks}] PASS root-owned sticky ancestor such as /tmp is allowed`);

  const privateAncestor = join(root, 'private-parent');
  mkdirSync(privateAncestor, { mode: 0o700 });
  const privateAllowed = run(['start'], join(privateAncestor, 'evidence'), {
    AK_TEST_POSIX_MODES: JSON.stringify({ [privateAncestor]: 0o700 }),
  });
  assert.equal(privateAllowed.status, 0, privateAllowed.stderr);
  assert.ok(existsSync(join(privateAncestor, 'evidence', 'session.json')));
  console.log(`  [${++checks}] PASS normal private ancestor path is allowed`);

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
  const badLabel = run(['sample', '--label', '../escape'], evidence);
  assert.notEqual(badLabel.status, 0);
  assert.match(badLabel.stderr, /Sample label must be a filename-safe name/);
  console.log(`  [${++checks}] PASS path separators in sample labels are refused`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log(`Memory harness tests complete: ${checks} checks passed.`);
