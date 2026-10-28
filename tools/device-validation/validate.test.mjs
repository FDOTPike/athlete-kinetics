import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureEvidence, memoryBand, parseArgs, selectDevice } from './validate.mjs';

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
