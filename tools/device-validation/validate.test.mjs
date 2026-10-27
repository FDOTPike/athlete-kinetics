import assert from 'node:assert/strict';
import { test } from 'node:test';
import { memoryBand, parseArgs, selectDevice } from './validate.mjs';

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
