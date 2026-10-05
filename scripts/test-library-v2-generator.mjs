import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assetKeyForName,
  contentFingerprintV2,
  generate,
  inferEquipment,
  inferPattern,
} from './generate-library-v2.mjs';
import { TARGET_NAMES } from './library-target-v1.mjs';

let passed = 0;
const check = (label, run) => {
  try {
    run();
    passed += 1;
    console.log(`  [${passed}] PASS ${label}`);
  } catch (error) {
    console.error(`  FAIL ${label}: ${error.message}`);
    process.exitCode = 1;
  }
};

const root = join(import.meta.dirname, '..');
const movementImport = JSON.parse(readFileSync(
  join(root, 'packages', 'core-db', 'staging', 'movement_import.json'),
  'utf8',
));
const byName = new Map(movementImport.movements.map((record) => [record.name, record]));

check('frozen target contains exactly 176 unique mapped records', () => {
  assert.equal(TARGET_NAMES.length, 176);
  assert.equal(new Set(TARGET_NAMES).size, 176);
  assert.ok(TARGET_NAMES.every((name) => byName.has(name)));
});

check('v2 text fingerprint is independent of every media field', () => {
  const base = {
    name: 'Test Press',
    coachingIntent: 'Train a repeatable press.',
    setupSteps: ['Set the start.', 'Press the load.'],
    cues: ['Own the press.'],
  };
  const changedMedia = {
    ...base,
    assetKey: 'movement/test-press/demo/v9',
    status: 'ready',
    fallbackUrl: 'https://example.invalid/video',
  };
  assert.equal(contentFingerprintV2(base), contentFingerprintV2(changedMedia));
});

check('asset keys are deterministic canonical paths', () => {
  assert.equal(assetKeyForName('3/4 Sit-Up'), 'movement/3-4-sit-up/demo/v1');
  assert.equal(assetKeyForName('Dumbbell Bench Press'), assetKeyForName('Dumbbell Bench Press'));
});

check('pattern and equipment projection use canonical engine vocabularies', () => {
  const row = byName.get('Dumbbell Bench Press with Neutral Grip');
  assert.equal(inferPattern(row), 'push_h');
  assert.ok(inferEquipment(row).includes('dumbbells'));
  assert.ok(inferEquipment(row).includes('bench'));
});

check('all generated artifacts exactly match the frozen contracts', () => {
  assert.deepEqual(generate({ write: false }), { targetCount: 176, finalCount: 300, batchCount: 12 });
});

if (process.exitCode) process.exit(process.exitCode);
console.log(`library-v2 generator — all ${passed} checks green`);
