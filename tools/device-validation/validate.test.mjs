import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureEvidence, harnessPacketErrors, memoryBand, parseArgs, selectDevice, verifyColdRestartPidContinuity } from './validate.mjs';

test('ceiling boundaries and missing measurements fail closed', () => {
  assert.equal(memoryBand(null), 'NOT MEASURED');
  assert.equal(memoryBand(NaN), 'NOT MEASURED');
  assert.equal(memoryBand(450000000), 'WITHIN PREFERRED TARGET');
  assert.equal(memoryBand(450000001), 'REVIEW REQUIRED');
  assert.equal(memoryBand(536870912), 'REVIEW REQUIRED');
  assert.equal(memoryBand(536870913), 'BLOCK RELEASE');
});
test('only one authorized USB target; never guess among devices', () => {
  assert.equal(selectDevice('List of devices attached\r\nUSB1\tdevice\r\n'), 'USB1');
  assert.throws(() => selectDevice('List of devices attached\nx\tunauthorized\n'));
  assert.throws(() => selectDevice('List of devices attached\nx\tdevice\ny\tdevice\n'));
  assert.throws(() => selectDevice('List of devices attached\nx\tdevice\ny\toffline\n'));
});
test('dry-run has no APK dependency; reject unrecognized or missing arguments', () => {
  assert.equal(parseArgs(['--dry-run']).dryRun, true);
  assert.throws(() => parseArgs([]));
  assert.throws(() => parseArgs(['--apk']));
  assert.throws(() => parseArgs(['--surprise']));
});

test('capture accepts large screenshots and a stopped app, but preserves adb failures', () => {
  const saved = {};
  const save = (name, data) => { saved[name] = data; };
  const png = Buffer.alloc(2 * 1024 * 1024, 1);
  const execute = (exe, args, options) => {
    assert.equal(exe, 'adb');
    assert.deepEqual(args, ['exec-out', 'screencap', '-p']);
    assert.equal(options.maxBuffer, 64 * 1024 * 1024);
    return png;
  };
  const stopped = Object.assign(new Error('pidof exited 1'), { status: 1, stdout: '', stderr: '', signal: null });
  const adb = args => {
    if (args.includes('pidof')) throw stopped;
    return '<hierarchy />';
  };
  captureEvidence('denied', save, adb, {}, execute);
  assert.equal(saved['denied-screen.png'], png);
  assert.equal(saved['denied-ui.xml'], '<hierarchy />');
  assert.equal(saved['denied-pid.txt'], 'not running (exit 1)\n');
  captureEvidence('running', save, () => '1234\n', {}, execute);
  assert.equal(saved['running-pid.txt'], '1234\n');
  for (const detail of [{ status: 2 }, { stderr: 'device offline' }, { stdout: 'unexpected' }, { signal: 'SIGTERM' }, { status: null, code: 'ETIMEDOUT' }]) {
    const failure = Object.assign(new Error('adb failure'), stopped, detail);
    assert.throws(() => captureEvidence('failed', save, args => { if (args.includes('pidof')) throw failure; return '<hierarchy />'; }, {}, execute), e => e === failure);
  }
});

test('a summary is accepted only when the harness confirms clean disposal', () => {
  // A sound packet must also carry the dual-model, serial-session fields
  // (WO-02 Item 3), so the positive control states them explicitly.
  const withIntegrity = (disposalIntegrity) => ({ summary: { lifecycle: { disposalIntegrity } } });
  const sound = () => ({ summary: { lifecycle: {
    componentRequestCounts: { embedder: 1, 'safety-reader': 1 },
    sessionOverlapCount: 0,
    disposalIntegrity: { clean: true, countersBalanced: true, sessionOverlapCount: 0 },
  } } });
  assert.deepEqual(harnessPacketErrors(sound()), []);
  assert.equal(harnessPacketErrors({}).length, 1);
  assert.equal(harnessPacketErrors(withIntegrity({ clean: false })).length, 1);
  for (const packet of [{ summary: {} }, { summary: { lifecycle: {} } }, withIntegrity({}), withIntegrity({ clean: 'true' }), withIntegrity({ clean: null })]) {
    assert.equal(harnessPacketErrors(packet).length, 1, JSON.stringify(packet));
  }
});

test('harness packet fails closed on unbalanced counters, overlap, or a missing model', () => {
  const sound = () => ({ summary: { lifecycle: {
    componentRequestCounts: { embedder: 1, 'safety-reader': 1 },
    sessionOverlapCount: 0,
    disposalIntegrity: { clean: true, countersBalanced: true, sessionOverlapCount: 0 },
  } } });
  const cases = [
    ['countersBalanced false', (L) => { L.disposalIntegrity.countersBalanced = false; }, /counters/i],
    ['countersBalanced missing', (L) => { delete L.disposalIntegrity.countersBalanced; }, /counters/i],
    ['disposalIntegrity overlap', (L) => { L.disposalIntegrity.sessionOverlapCount = 1; }, /overlap/i],
    ['disposalIntegrity overlap missing', (L) => { delete L.disposalIntegrity.sessionOverlapCount; }, /overlap/i],
    ['lifecycle overlap', (L) => { L.sessionOverlapCount = 2; }, /overlap/i],
    ['lifecycle overlap missing', (L) => { delete L.sessionOverlapCount; }, /overlap/i],
    ['embedder missing', (L) => { L.componentRequestCounts.embedder = 0; }, /embedder/],
    ['safety-reader missing', (L) => { L.componentRequestCounts['safety-reader'] = 0; }, /safety-reader/],
    ['counts absent', (L) => { delete L.componentRequestCounts; }, /embedder/],
  ];
  for (const [label, mutate, pattern] of cases) {
    const packet = sound();
    mutate(packet.summary.lifecycle);
    const errors = harnessPacketErrors(packet);
    assert.ok(errors.length >= 1 && errors.some((e) => pattern.test(e)), `${label}: ${JSON.stringify(errors)}`);
  }
  const noCounts = sound();
  delete noCounts.summary.lifecycle.componentRequestCounts;
  const noCountErrors = harnessPacketErrors(noCounts);
  assert.ok(noCountErrors.some((e) => /safety-reader/.test(e)), 'missing counts fail for BOTH models');
});

test('cold restart requires two distinct valid PIDs, in order, with no recurrence', () => {
  const run = (pids) => pids.map((processId) => ({ processId }));
  const ok = { beforePidText: '900\n', afterPidText: '901\r\n', samples: run([900, 900, 900, 901, 901]) };
  assert.deepEqual(verifyColdRestartPidContinuity(ok), []);
  // Equal PIDs: the process was never actually restarted.
  assert.ok(verifyColdRestartPidContinuity({ ...ok, afterPidText: '900\n', samples: run([900, 900]) }).length >= 1);
  // Non-integer / non-positive / multiple / stopped-app PIDs.
  for (const bad of ['abc', '12.5', '900 901', 'not running (exit 1)\n', '0', '-5', '']) {
    assert.ok(verifyColdRestartPidContinuity({ ...ok, beforePidText: bad }).length >= 1, `before ${JSON.stringify(bad)}`);
    assert.ok(verifyColdRestartPidContinuity({ ...ok, afterPidText: bad }).length >= 1, `after ${JSON.stringify(bad)}`);
  }
  // Recurrence 900 -> 901 -> 900.
  assert.ok(verifyColdRestartPidContinuity({ ...ok, samples: run([900, 901, 900]) }).length >= 1);
  // Wrong order and a foreign PID in between.
  assert.ok(verifyColdRestartPidContinuity({ ...ok, samples: run([901, 900]) }).length >= 1);
  assert.ok(verifyColdRestartPidContinuity({ ...ok, samples: run([900, 950, 901]) }).length >= 1);
  // Missing inputs.
  assert.ok(verifyColdRestartPidContinuity({ ...ok, beforePidText: undefined }).length >= 1);
  assert.ok(verifyColdRestartPidContinuity({ ...ok, afterPidText: undefined }).length >= 1);
  assert.ok(verifyColdRestartPidContinuity({ ...ok, samples: undefined }).length >= 1);
  assert.ok(verifyColdRestartPidContinuity({ ...ok, samples: run([900, 900]) }).length >= 1);
  assert.ok(verifyColdRestartPidContinuity({ ...ok, samples: run([901]) }).length >= 1);
});
