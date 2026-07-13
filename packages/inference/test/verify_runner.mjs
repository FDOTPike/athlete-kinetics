/**
 * verify:runner — boundary invariants of the P17 S1 session-runner reducer.
 * Compiled from packages/inference/src/sessionRunner.ts by the npm script.
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { startRunner, advance, nextUp, restSecondsFor } = require('./.build/sessionRunner.js');

const slot = (id, sets, reps, rpe, name = `M${id}`) => ({
  plannedSlotId: id, movementId: id, movementName: name, sets, reps, targetRpe: rpe,
});
const SLOTS = [slot(1, 2, 5, 8.5), slot(2, 1, 10, 7.0)];

let n = 0;
const check = (label, fn) => { n += 1; fn(); console.log(`  [${n}] PASS ${label}`); };

check('start: first slot, first set, working', () => {
  const s = startRunner(SLOTS);
  assert.deepEqual([s.slotIndex, s.setIndex, s.phase, s.loggedSets], [0, 1, 'working', 0]);
});

check('empty session starts complete', () => {
  assert.equal(startRunner([]).phase, 'complete');
});

check('LOG_SET mid-slot rests with the RPE-prescribed target', () => {
  const s = advance(startRunner(SLOTS), { kind: 'LOG_SET' });
  assert.equal(s.phase, 'resting');
  assert.equal(s.restSecondsTarget, 180); // RPE 8.5, intermediate
  assert.equal(s.loggedSets, 1);
});

check('rest table: RPE 9+ =240, 8+ =180, 7+ =120, else 90 (intermediate)', () => {
  assert.equal(restSecondsFor(slot(9, 3, 3, 9.0), 'intermediate'), 240);
  assert.equal(restSecondsFor(slot(9, 3, 5, 8.0), 'intermediate'), 180);
  assert.equal(restSecondsFor(slot(9, 3, 8, 7.5), 'intermediate'), 120);
  assert.equal(restSecondsFor(slot(9, 3, 12, 6.0), 'intermediate'), 90);
});

check('tier scaling: beginner rests shorter, elite longer, clamped + snapped', () => {
  assert.equal(restSecondsFor(slot(9, 3, 3, 9.0), 'beginner'), 180);  // 240*.75
  assert.equal(restSecondsFor(slot(9, 3, 3, 9.0), 'elite'), 300);     // 240*1.25 = 300 (at clamp)
  assert.equal(restSecondsFor(slot(9, 3, 12, 6.0), 'beginner'), 75);  // 90*.75 = 67.5 -> snap 75... see below
});

check('REST_ELAPSED advances within the slot; slot rollover after final set', () => {
  let s = startRunner(SLOTS);
  s = advance(s, { kind: 'LOG_SET' });
  s = advance(s, { kind: 'REST_ELAPSED' });
  assert.deepEqual([s.slotIndex, s.setIndex, s.phase], [0, 2, 'working']);
  s = advance(s, { kind: 'LOG_SET' });   // final set of slot 1
  s = advance(s, { kind: 'SKIP_REST' }); // skip works like elapsed
  assert.deepEqual([s.slotIndex, s.setIndex, s.phase], [1, 1, 'working']);
});

check('final set of final slot completes the session (no trailing rest)', () => {
  let s = startRunner(SLOTS);
  for (const e of ['LOG_SET', 'REST_ELAPSED', 'LOG_SET', 'REST_ELAPSED', 'LOG_SET']) {
    s = advance(s, { kind: e });
  }
  assert.equal(s.phase, 'complete');
  assert.equal(s.loggedSets, 3);
});

check('complete state is terminal: every event is a no-op', () => {
  let s = startRunner([slot(1, 1, 5, 7)]);
  s = advance(s, { kind: 'LOG_SET' });
  assert.equal(s.phase, 'complete');
  for (const e of [{ kind: 'LOG_SET' }, { kind: 'SKIP_SLOT' }, { kind: 'THUMBS_DOWN' }]) {
    assert.deepEqual(advance(s, e), s);
  }
});

check('LOG_SET while resting is ignored (double-tap protection)', () => {
  let s = advance(startRunner(SLOTS), { kind: 'LOG_SET' });
  assert.deepEqual(advance(s, { kind: 'LOG_SET' }), s);
});

check('nextUp previews the following set, then the following slot', () => {
  let s = startRunner(SLOTS);
  assert.deepEqual(nextUp(s), { slot: SLOTS[0], setIndex: 2 });
  s = advance(s, { kind: 'LOG_SET' });
  s = advance(s, { kind: 'REST_ELAPSED' });
  assert.deepEqual(nextUp(s), { slot: SLOTS[1], setIndex: 1 });
});

check('THUMBS_DOWN offers substitution for the current slot; decline clears', () => {
  let s = advance(startRunner(SLOTS), { kind: 'THUMBS_DOWN' });
  assert.equal(s.substitutionOfferedFor, 1);
  s = advance(s, { kind: 'DECLINE_SUBSTITUTION' });
  assert.equal(s.substitutionOfferedFor, null);
});

check('SUBSTITUTE swaps the movement, keeps the prescription, clears the offer', () => {
  let s = advance(startRunner(SLOTS), { kind: 'THUMBS_DOWN' });
  s = advance(s, { kind: 'SUBSTITUTE', movementId: 99, movementName: 'Swap' });
  assert.equal(s.slots[0].movementId, 99);
  assert.deepEqual([s.slots[0].sets, s.slots[0].reps, s.slots[0].targetRpe], [2, 5, 8.5]);
  assert.equal(s.substitutionOfferedFor, null);
});

check('SKIP_SLOT abandons the slot; skipping the last slot completes', () => {
  let s = advance(startRunner(SLOTS), { kind: 'SKIP_SLOT' });
  assert.deepEqual([s.slotIndex, s.setIndex, s.phase], [1, 1, 'working']);
  s = advance(s, { kind: 'SKIP_SLOT' });
  assert.equal(s.phase, 'complete');
});

check('determinism: identical event streams give deep-equal states', () => {
  const run = () => {
    let s = startRunner(SLOTS);
    for (const e of [{ kind: 'LOG_SET' }, { kind: 'THUMBS_DOWN' }, { kind: 'REST_ELAPSED' }, { kind: 'LOG_SET' }]) {
      s = advance(s, e, 'beginner');
    }
    return s;
  };
  assert.deepEqual(run(), run());
});

console.log(`verify:runner — all ${n} checks green`);
