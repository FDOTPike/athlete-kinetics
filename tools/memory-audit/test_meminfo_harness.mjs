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

  // --- finish fails closed unless BOTH models correlate, serially and cleanly ---
  const finishCase = (name, logBodies) => {
    const dir = join(root, `finish-${name}`);
    mkdirSync(dir, { mode: 0o700 });
    const t0 = Date.UTC(2026, 7, 24, 3, 0, 0, 0);
    const samples = [];
    for (let i = 0; i < 12; i += 1) {
      const rawFile = join(dir, `sample-${String(i + 1).padStart(3, '0')}-window.txt`);
      writeFileSync(rawFile, '** MEMINFO in pid 4242 [com.pikemethods.training.qa] **\n'
        + '                   Pss  Private  Private  SwapPss      Rss\n'
        + '                 Total    Dirty    Clean    Dirty    Total\n'
        + `        TOTAL   100000    ${90000 + i}        0        0    100000\n`);
      const at = t0 + i * 200;
      samples.push({ appName: 'com.pikemethods.training.qa', processId: 4242, seq: i + 1, label: 'window',
        captureStartMs: at, captureEndMs: at + 10, captureDurationMs: 10, atUtc: new Date(at).toISOString(),
        rawFile, privateDirtyBytes: (90000 + i) * 1024 });
    }
    writeFileSync(join(dir, 'session.json'), JSON.stringify({ startedAtUtc: new Date(t0).toISOString(),
      package: 'com.pikemethods.training.qa', deviceUtcOffsetMinutes: 0, requestedIntervalMs: 200, samples }));
    const stamp = (ms) => `${Math.floor(ms / 1000)}.${String(ms % 1000).padStart(3, '0')}`;
    const logFile = join(root, `finish-${name}-logcat.txt`);
    writeFileSync(logFile, logBodies.map(([dt, tag, body]) =>
      `${stamp(t0 + dt)}  4242 4243 I ReactNativeJS: [${tag}-lifecycle] ${body}`).join('\n'));
    const result = run(['finish'], dir, { AK_LOGCAT_FILE: logFile });
    return { result, dir };
  };
  const lifecycle = (tag, req, created, s0) => [
    [s0, tag, `session:start req=${req} ok=1 created=${created} disposed=${created}`],
    [s0 + 50, tag, `session:settled req=${req} ok=1 created=${created + 1} disposed=${created}`],
    [s0 + 50, tag, `inference:start req=${req} ok=1 created=${created + 1} disposed=${created}`],
    [s0 + 100, tag, `inference:settled req=${req} ok=1 created=${created + 1} disposed=${created}`],
    [s0 + 100, tag, `disposal:start req=${req} ok=1 created=${created + 1} disposed=${created}`],
    [s0 + 150, tag, `disposal:settled req=${req} ok=1 created=${created + 1} disposed=${created + 1}`],
    [s0 + 150, tag, `request=${req} ok=1 totalMs=150`],
  ];
  const wrappersAt = (dt) => [
    [dt, 'embedder', 'wrapper:settled req=0 ok=1 created=0 disposed=0'],
    [dt + 10, 'safety-reader', 'wrapper:settled req=0 ok=1 created=0 disposed=0'],
  ];

  const dual = finishCase('dual', [...wrappersAt(100), ...lifecycle('embedder', 1, 0, 500), ...lifecycle('safety-reader', 1, 0, 1000)]);
  assert.equal(dual.result.status, 0, dual.result.stderr);
  const dualSummary = JSON.parse(readFileSync(join(dual.dir, 'session.json'), 'utf8')).summary;
  assert.deepEqual(dualSummary.lifecycle.componentRequestCounts, { embedder: 1, 'safety-reader': 1 });
  assert.equal(dualSummary.lifecycle.sessionOverlapCount, 0);
  assert.deepEqual(dualSummary.lifecycle.sampledProcessIds, [4242]);
  assert.deepEqual(dualSummary.lifecycle.correlatedRequests.map((q) => [q.component, q.requestId, q.pid, q.wrapperEpoch]),
    [['embedder', 1, 4242, 1], ['safety-reader', 1, 4242, 1]]);
  assert.ok(dualSummary.lifecycle.disposalProof.every((d) => d.pid === 4242 && d.wrapperEpoch === 1
    && typeof d.component === 'string' && d.createdSessionWasDisposed === true));
  assert.ok(dualSummary.sampling.continuousSegments.every((s) => s.pid === 4242));
  console.log(`  [${++checks}] PASS finish accepts a serial dual-model run and records component/PID identity`);

  const single = finishCase('embedder-only', [...wrappersAt(100), ...lifecycle('embedder', 1, 0, 500)]);
  assert.notEqual(single.result.status, 0, 'single-model run must fail finish');
  assert.match(single.result.stderr, /safety-reader=0/);
  const readerOnly = finishCase('reader-only', [...wrappersAt(100), ...lifecycle('safety-reader', 1, 0, 500)]);
  assert.notEqual(readerOnly.result.status, 0, 'single-model run must fail finish');
  assert.match(readerOnly.result.stderr, /embedder=0/);
  console.log(`  [${++checks}] PASS finish fails closed on a single-model (embedder-only or safety-reader-only) run`);

  const overlap = finishCase('overlap', [...wrappersAt(100), ...lifecycle('embedder', 1, 0, 500),
    ...lifecycle('safety-reader', 1, 0, 600), ...lifecycle('embedder', 2, 1, 1200), ...lifecycle('safety-reader', 2, 1, 1500)]);
  assert.notEqual(overlap.result.status, 0, 'overlapping sessions must fail finish');
  assert.match(overlap.result.stderr, /sessionOverlapCount=1/);
  console.log(`  [${++checks}] PASS finish fails closed when two sessions overlap in one process`);

  const dangling = finishCase('unbalanced', [...wrappersAt(100), ...lifecycle('embedder', 1, 0, 500),
    ...lifecycle('safety-reader', 1, 0, 1000), ...lifecycle('embedder', 2, 1, 1500).slice(0, 2)]);
  assert.notEqual(dangling.result.status, 0, 'unbalanced counters must fail finish');
  assert.match(dangling.result.stderr, /countersBalanced=false/);
  console.log(`  [${++checks}] PASS finish fails closed when created/disposed counters do not balance`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log(`Memory harness tests complete: ${checks} checks passed.`);
