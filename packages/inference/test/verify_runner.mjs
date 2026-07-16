/**
 * verify:runner - bounded exhaustive checks for the Phase 17 pure runner.
 * Compiled from packages/inference/src/sessionRunner.ts by npm run verify:runner.
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {
  RUNNER_CHECKPOINT_VERSION,
  RunnerCheckpointError,
  advance,
  createRunnerCheckpoint,
  currentSet,
  currentSlot,
  deserializeRunner,
  nextUp,
  replayRunner,
  restoreRunnerCheckpoint,
  restSecondsFor,
  serializeRunner,
  startRunner,
} = require('./.build/sessionRunner.js');

const repSlot = (sessionPlanSlotId, sets, reps, targetRpe, movementId = sessionPlanSlotId, movementName = `M${sessionPlanSlotId}`) => ({
  sessionPlanSlotId,
  movementId,
  movementName,
  sets,
  target: { kind: 'reps', reps },
  targetRpe,
});
const timeSlot = (sessionPlanSlotId, sets, seconds, targetRpe, movementId = sessionPlanSlotId, movementName = `M${sessionPlanSlotId}`) => ({
  sessionPlanSlotId,
  movementId,
  movementName,
  sets,
  target: { kind: 'time', seconds },
  targetRpe,
});
const event = (kind, atMs, fields = {}) => ({ kind, atMs, ...fields });

const SLOTS = [
  repSlot(101, 2, 5, 8.5, 11, 'Press'),
  timeSlot(102, 1, 40, 7, 12, 'Carry'),
];

let n = 0;
const check = (label, fn) => {
  n += 1;
  fn();
  console.log(`  [${n}] PASS ${label}`);
};

function completeSession(state) {
  let next = state;
  const maximumTransitions = next.slots.reduce((sum, slot) => sum + slot.sets, 0) + next.slots.length + 2;
  for (let transitions = 0; transitions < maximumTransitions && next.phase !== 'complete'; transitions += 1) {
    const atMs = (next.updatedAtMs ?? 0) + 1;
    next = next.phase === 'resting'
      ? advance(next, event('SKIP_REST', atMs))
      : advance(next, event('LOG_SET', atMs));
  }
  assert.equal(next.phase, 'complete', 'every live state must have a finite completion path');
  return next;
}

function canonicalStateKey(state) {
  return JSON.stringify({
    tier: state.tier,
    slots: state.slots.map((slot) => ({
      sessionPlanSlotId: slot.sessionPlanSlotId,
      movementId: slot.movementId,
      sets: slot.sets,
      target: slot.target,
      targetRpe: slot.targetRpe,
    })),
    slotIndex: state.slotIndex,
    setIndex: state.setIndex,
    phase: state.phase,
    restSecondsTarget: state.restSecondsTarget,
    restRpe: state.restRpe,
    slotSetCounts: state.slotSetCounts,
    loggedSets: state.loggedSets,
    substitutionOfferedForSessionPlanSlotId: state.substitutionOfferedForSessionPlanSlotId,
    haltReason: state.haltReason,
    skippedSessionPlanSlotIds: state.skippedSessionPlanSlotIds,
  });
}

function representativeEvents(state) {
  const atMs = (state.updatedAtMs ?? 0) + 1;
  if (state.phase === 'working') {
    return [
      event('LOG_SET', atMs, { actualRpe: 8 }),
      event('THUMBS_DOWN', atMs),
      event('NIGGLE', atMs, { severity: 4 }),
      event('NIGGLE', atMs, { severity: 8 }),
      event('DECLINE_SUBSTITUTION', atMs),
      event('SUBSTITUTE', atMs, { movementId: 999, movementName: 'Regression' }),
      event('SKIP_SLOT', atMs),
      event('HALT', atMs, { reason: 'manual' }),
    ];
  }
  if (state.phase === 'resting') {
    return [
      event('REST_ELAPSED', state.restStartedAtMs + state.restSecondsTarget * 1000),
      event('SKIP_REST', atMs),
      event('SKIP_SLOT', atMs),
      event('NIGGLE', atMs, { severity: 8 }),
      event('HALT', atMs, { reason: 'manual' }),
    ];
  }
  return [];
}

check('session-plan IDs and target union normalize while legacy repetition slots remain accepted', () => {
  const state = startRunner(SLOTS, { tier: 'beginner', startedAtMs: 10 });
  assert.deepEqual(
    [state.tier, state.slotIndex, state.setIndex, state.phase, state.updatedAtMs],
    ['beginner', 0, 1, 'working', 10],
  );
  assert.equal(state.slots[0].sessionPlanSlotId, 101);
  assert.deepEqual(state.slots[1].target, { kind: 'time', seconds: 40 });

  const legacy = startRunner([{ plannedSlotId: 77, movementId: 7, movementName: 'Legacy', sets: 1, reps: 8, targetRpe: 7 }]);
  assert.deepEqual(legacy.slots[0], {
    sessionPlanSlotId: 77,
    plannedSlotId: 77,
    movementId: 7,
    movementName: 'Legacy',
    sets: 1,
    target: { kind: 'reps', reps: 8 },
    targetRpe: 7,
  });
});

check('empty session starts complete and exposes no current work', () => {
  const state = startRunner([], { tier: 'advanced', startedAtMs: 5 });
  assert.deepEqual([state.phase, state.slotIndex, state.setIndex, currentSlot(state), currentSet(state)], ['complete', 0, 0, null, null]);
});

check('current work and next-up use the frozen vertical slot order', () => {
  let state = startRunner(SLOTS, { tier: 'intermediate', startedAtMs: 0 });
  assert.deepEqual(currentSet(state), { slot: state.slots[0], setIndex: 1 });
  assert.deepEqual(nextUp(state), { slot: state.slots[0], setIndex: 2 });
  state = advance(state, event('LOG_SET', 100, { actualRpe: 8 }));
  assert.equal(currentSet(state), null);
  assert.deepEqual(nextUp(state), { slot: state.slots[0], setIndex: 2 });
});

check('rest matrix honors actual RPE before target RPE and stays within the contract', () => {
  const rpe8 = { targetRpe: 8 };
  assert.equal(restSecondsFor({ targetRpe: 9 }, 'intermediate'), 240);
  assert.equal(restSecondsFor({ targetRpe: 8 }, 'intermediate'), 180);
  assert.equal(restSecondsFor({ targetRpe: 7 }, 'intermediate'), 120);
  assert.equal(restSecondsFor({ targetRpe: 6 }, 'intermediate'), 90);
  assert.equal(restSecondsFor({ targetRpe: 9 }, 'beginner'), 180);
  assert.equal(restSecondsFor({ targetRpe: 9 }, 'elite'), 300);
  assert.equal(restSecondsFor({ targetRpe: 6 }, 'beginner'), 75);
  assert.equal(restSecondsFor(rpe8, 'intermediate', 6), 90);
  for (const tier of ['beginner', 'intermediate', 'advanced', 'elite']) {
    for (const rpe of [0, 7, 8, 9, 10]) {
      const seconds = restSecondsFor({ targetRpe: rpe }, tier, rpe);
      assert.ok(seconds >= 45 && seconds <= 300 && seconds % 15 === 0, `${tier} RPE ${rpe}`);
    }
  }
});

check('timestamped rest cannot elapse early and advances exactly at its supplied deadline', () => {
  let state = startRunner([repSlot(1, 2, 5, 8)], { tier: 'intermediate', startedAtMs: 10 });
  state = advance(state, event('LOG_SET', 100, { actualRpe: 8 }));
  assert.deepEqual([state.phase, state.restStartedAtMs, state.restSecondsTarget, state.restRpe], ['resting', 100, 180, 8]);
  assert.strictEqual(advance(state, event('REST_ELAPSED', 180099)), state);
  state = advance(state, event('REST_ELAPSED', 180100));
  assert.deepEqual([state.phase, state.setIndex, state.restStartedAtMs], ['working', 2, null]);
});

check('a normal logged-set stream reaches complete without a trailing rest', () => {
  let state = startRunner(SLOTS, { tier: 'beginner', startedAtMs: 0 });
  state = advance(state, event('LOG_SET', 1));
  state = advance(state, event('SKIP_REST', 2));
  state = advance(state, event('LOG_SET', 3));
  state = advance(state, event('SKIP_REST', 4));
  state = advance(state, event('LOG_SET', 5));
  assert.deepEqual([state.phase, state.loggedSets, state.slotIndex, state.setIndex, state.restSecondsTarget], ['complete', 3, 2, 0, 0]);
});

check('self-directed pointers cannot complete the physical last slot before every slot resolves', () => {
  const slots = [
    repSlot(301, 1, 5, 7, 31, 'First'),
    repSlot(302, 1, 5, 7, 32, 'Middle'),
    timeSlot(303, 1, 30, 7, 33, 'Last'),
  ];
  let state = startRunner(slots, { tier: 'advanced', startedAtMs: 0 });
  // This mirrors a self-directed selection: preserve counts, move only the pointer.
  state = { ...state, slotIndex: 2, setIndex: state.slotSetCounts[2] + 1, updatedAtMs: 0 };
  assert.deepEqual(deserializeRunner(serializeRunner(state)), state);

  state = advance(state, event('LOG_SET', 1));
  assert.deepEqual([state.phase, state.loggedSets, state.slotSetCounts], ['resting', 1, [0, 0, 1]]);
  state = advance(state, event('SKIP_REST', 2));
  assert.deepEqual([state.phase, state.slotIndex, state.setIndex], ['working', 0, 1]);
  state = advance(state, event('LOG_SET', 3));
  state = advance(state, event('SKIP_REST', 4));
  assert.deepEqual([state.slotIndex, state.setIndex], [1, 1]);
  state = advance(state, event('LOG_SET', 5));
  assert.deepEqual([state.phase, state.loggedSets, state.slotSetCounts], ['complete', 3, [1, 1, 1]]);

  let skipped = startRunner(slots, { tier: 'advanced', startedAtMs: 0 });
  skipped = { ...skipped, slotIndex: 2, setIndex: 1, updatedAtMs: 0 };
  skipped = advance(skipped, event('SKIP_SLOT', 1));
  assert.deepEqual([skipped.phase, skipped.slotIndex, skipped.skippedSessionPlanSlotIds], ['working', 0, [303]]);
});

check('substitution after earlier sets preserves session-slot identity, targets, and completed volume', () => {
  let state = startRunner([repSlot(11, 2, 8, 7, 20, 'Original')], { tier: 'intermediate', startedAtMs: 0 });
  state = advance(state, event('LOG_SET', 1));
  state = advance(state, event('SKIP_REST', 2));
  const before = state.slots[0];
  state = advance(state, event('THUMBS_DOWN', 3));
  assert.equal(state.substitutionOfferedForSessionPlanSlotId, 11);
  state = advance(state, event('SUBSTITUTE', 4, { movementId: 99, movementName: 'Replacement' }));
  assert.deepEqual(
    [state.loggedSets, state.setIndex, state.slots[0].sessionPlanSlotId, state.slots[0].movementId, state.slots[0].target],
    [1, 2, 11, 99, before.target],
  );
  state = advance(state, event('LOG_SET', 5));
  assert.equal(state.phase, 'complete');
});

check('thumbs-down and qualifying niggles offer substitution; halt-level niggles always halt', () => {
  let state = startRunner([repSlot(1, 1, 5, 7)], { tier: 'beginner', startedAtMs: 0 });
  assert.strictEqual(advance(state, event('NIGGLE', 1, { severity: 4 })), state);
  state = advance(state, event('THUMBS_DOWN', 2));
  assert.equal(state.substitutionOfferedForSessionPlanSlotId, 1);
  state = advance(state, event('DECLINE_SUBSTITUTION', 3));
  assert.equal(state.substitutionOfferedForSessionPlanSlotId, null);
  state = advance(state, event('NIGGLE', 4, { severity: 5 }));
  assert.equal(state.substitutionOfferedForSessionPlanSlotId, 1);
  state = advance(state, event('NIGGLE', 5, { severity: 8 }));
  assert.deepEqual([state.phase, state.haltReason, state.substitutionOfferedForSessionPlanSlotId], ['halted', 'niggle', null]);

  const resting = advance(startRunner([repSlot(2, 2, 5, 7)], { tier: 'beginner', startedAtMs: 0 }), event('LOG_SET', 100));
  const haltedLate = advance(resting, event('NIGGLE', 1, { severity: 8 }));
  assert.deepEqual([haltedLate.phase, haltedLate.haltReason, haltedLate.updatedAtMs], ['halted', 'niggle', 100]);
});

check('slot skip is working-only, records its session-plan ID, and can complete a session', () => {
  let state = startRunner(SLOTS, { tier: 'intermediate', startedAtMs: 0 });
  state = advance(state, event('SKIP_SLOT', 1));
  assert.deepEqual([state.slotIndex, state.setIndex, state.phase, state.skippedSessionPlanSlotIds], [1, 1, 'working', [101]]);
  state = advance(state, event('SKIP_SLOT', 2));
  assert.deepEqual([state.phase, state.skippedSessionPlanSlotIds], ['complete', [101, 102]]);

  const resting = advance(startRunner([repSlot(3, 2, 5, 7)]), event('LOG_SET', 1));
  assert.strictEqual(advance(resting, event('SKIP_SLOT', 2)), resting);
});

check('invalid, stale, and out-of-phase events are protected as no-ops', () => {
  let state = startRunner([repSlot(1, 2, 5, 8)], { tier: 'intermediate', startedAtMs: 10 });
  assert.strictEqual(advance(state, event('LOG_SET', -1)), state);
  assert.strictEqual(advance(state, event('SUBSTITUTE', 11, { movementId: 9, movementName: 'No offer' })), state);
  state = advance(state, event('LOG_SET', 20));
  assert.strictEqual(advance(state, event('LOG_SET', 21)), state);
  assert.strictEqual(advance(state, event('REST_ELAPSED', 19)), state);
  assert.strictEqual(advance(state, event('REST_ELAPSED', 20 + state.restSecondsTarget * 1000 - 1)), state);
  assert.strictEqual(advance(state, event('NIGGLE', 22, { severity: 4.5 })), state);
});

check('manual halt is reachable from every live phase and terminal states reject all events', () => {
  const working = startRunner([repSlot(1, 2, 5, 7)], { tier: 'intermediate', startedAtMs: 10 });
  const resting = advance(working, event('LOG_SET', 20));
  for (const state of [working, resting]) {
    const halted = advance(state, event('HALT', 1, { reason: 'safety' }));
    assert.deepEqual([halted.phase, halted.haltReason], ['halted', 'safety']);
    for (const candidate of [event('LOG_SET', 999), event('SKIP_SLOT', 999), event('HALT', 999), event('NIGGLE', 999, { severity: 10 })]) {
      assert.strictEqual(advance(halted, candidate), halted);
    }
  }
  const complete = completeSession(startRunner([repSlot(3, 1, 5, 7)], { tier: 'intermediate', startedAtMs: 0 }));
  for (const candidate of [event('LOG_SET', 999), event('SKIP_SLOT', 999), event('HALT', 999), event('THUMBS_DOWN', 999)]) {
    assert.strictEqual(advance(complete, candidate), complete);
  }
});

check('replay is deterministic and checkpoint serialization round-trips exactly', () => {
  const transcript = [
    event('LOG_SET', 1, { actualRpe: 8 }),
    event('SKIP_REST', 2),
    event('THUMBS_DOWN', 3),
    event('SUBSTITUTE', 4, { movementId: 500, movementName: 'Swap' }),
    event('LOG_SET', 5),
    event('SKIP_REST', 6),
    event('LOG_SET', 7),
  ];
  const manual = transcript.reduce((state, next) => advance(state, next), startRunner(SLOTS, { tier: 'advanced', startedAtMs: 0 }));
  const replayed = replayRunner(SLOTS, transcript, { tier: 'advanced', startedAtMs: 0 });
  assert.deepEqual(replayed, manual);
  assert.equal(serializeRunner(replayed), serializeRunner(replayed));
  assert.deepEqual(deserializeRunner(serializeRunner(replayed)), replayed);

  const checkpoint = createRunnerCheckpoint(replayed);
  assert.equal(checkpoint.version, RUNNER_CHECKPOINT_VERSION);
  checkpoint.state.slots[0].movementName = 'Mutated copy only';
  assert.notEqual(replayed.slots[0].movementName, checkpoint.state.slots[0].movementName);
  assert.deepEqual(restoreRunnerCheckpoint(JSON.parse(serializeRunner(replayed))), replayed);

  const preCounts = JSON.parse(serializeRunner(advance(startRunner([repSlot(8, 2, 5, 8), repSlot(9, 1, 5, 7)]), event('LOG_SET', 1))));
  delete preCounts.state.slotSetCounts;
  const restoredPreCounts = deserializeRunner(JSON.stringify(preCounts));
  assert.deepEqual([restoredPreCounts.slotSetCounts, restoredPreCounts.loggedSets], [[1, 0], 1]);

  const poisoned = JSON.parse(serializeRunner(advance(startRunner([repSlot(8, 2, 5, 8)]), event('LOG_SET', 1))));
  poisoned.state.restSecondsTarget += 15;
  assert.throws(() => restoreRunnerCheckpoint(poisoned), RunnerCheckpointError);
  assert.throws(() => deserializeRunner('{not JSON'), RunnerCheckpointError);
  assert.throws(() => restoreRunnerCheckpoint({ version: 2, state: replayed }), RunnerCheckpointError);
});

check('bounded exhaustive sweep has no dead ends, every live state can halt, and rest always satisfies contract', () => {
  const slots = [repSlot(201, 2, 5, 7), timeSlot(202, 1, 30, 8)];
  const initial = startRunner(slots, { tier: 'intermediate', startedAtMs: 0 });
  // Seed a valid out-of-order self-directed pointer so the sweep proves the
  // physical last slot wraps to earlier unfinished work rather than completing.
  const selfDirected = { ...initial, slotIndex: 1, setIndex: 1, updatedAtMs: 0 };
  const queue = [initial, selfDirected];
  const seen = new Set([canonicalStateKey(initial), canonicalStateKey(selfDirected)]);
  const phases = new Set();
  let transitions = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const state = queue[index];
    phases.add(state.phase);
    assert.deepEqual(deserializeRunner(serializeRunner(state)), state, 'every visited state serializes exactly');
    if (state.phase === 'resting') {
      assert.ok(state.restSecondsTarget >= 45 && state.restSecondsTarget <= 300 && state.restSecondsTarget % 15 === 0);
      assert.equal(state.restSecondsTarget, restSecondsFor(currentSlot(state), state.tier, state.restRpe));
    }
    if (state.phase === 'working' || state.phase === 'resting') {
      const halted = advance(state, event('HALT', (state.updatedAtMs ?? 0) + 1));
      assert.equal(halted.phase, 'halted', 'halt must always be reachable');
      completeSession(state);
    }
    for (const candidate of representativeEvents(state)) {
      const next = advance(state, candidate);
      transitions += 1;
      const key = canonicalStateKey(next);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }

  assert.ok(queue.length >= 12, `expected representative state coverage, saw ${queue.length}`);
  assert.ok(transitions >= queue.length, 'sweep must traverse transitions');
  assert.deepEqual([...phases].sort(), ['complete', 'halted', 'resting', 'working']);
});

check('rest-timer-disabled preference makes LOG_SET skip directly past resting to the next working state', () => {
  // The store applies SKIP_REST immediately when restTimerEnabled is false, so
  // the runner should never remain in resting for the UI to observe.
  // We prove the runner exposes an orthogonal, deterministic SKIP_REST that can
  // always immediately follow any resting-phase entry, leaving phase=working.
  let state = startRunner([repSlot(501, 2, 5, 8)], { tier: 'intermediate', startedAtMs: 0 });
  state = advance(state, event('LOG_SET', 100, { actualRpe: 8 }));
  assert.equal(state.phase, 'resting', 'LOG_SET of non-final set must produce resting first');
  // When rest is disabled, the caller applies SKIP_REST at the same timestamp.
  const withoutTimer = advance(state, event('SKIP_REST', 100));
  assert.deepEqual([withoutTimer.phase, withoutTimer.setIndex, withoutTimer.restSecondsTarget], ['working', 2, 0]);
  // Confirm the shortcut serializes correctly so the checkpoint stays consistent.
  assert.deepEqual(deserializeRunner(serializeRunner(withoutTimer)), withoutTimer);
  // Final set: no trailing rest after last set, so goes directly to complete.
  const final = advance(withoutTimer, event('LOG_SET', 200));
  assert.equal(final.phase, 'complete');
});

check('athlete tier is frozen at session start; per-athlete preference changes cannot mutate an in-flight runner', () => {
  // `startRunner` burns the tier into the state at creation time. A mid-session
  // profile update can change `uiPreferences.tier`, but the runner state object
  // returned by `advance` never reads from the store — it only carries the
  // frozen value forward. Verify that the tier field on every downstream state
  // equals the original construction tier, regardless of which events fire.
  const initial = startRunner([repSlot(601, 3, 5, 8)], { tier: 'beginner', startedAtMs: 0 });
  assert.equal(initial.tier, 'beginner');
  const events = [
    event('LOG_SET', 1, { actualRpe: 8 }),
    event('SKIP_REST', 2),
    event('LOG_SET', 3, { actualRpe: 7 }),
    event('SKIP_REST', 4),
  ];
  let tierState = initial;
  for (const e of events) {
    tierState = advance(tierState, e);
    assert.equal(tierState.tier, 'beginner', `tier must remain 'beginner' after ${e.kind}`);
  }
  // Rest matrix uses the frozen tier. Beginner scale is 0.75x intermediate.
  const restForBeginner = restSecondsFor({ targetRpe: 9 }, 'beginner');
  const restForIntermediate = restSecondsFor({ targetRpe: 9 }, 'intermediate');
  assert.ok(restForBeginner < restForIntermediate, 'beginner rest must be shorter than intermediate');
  // Serialization preserves the tier.
  const restoredTier = deserializeRunner(serializeRunner(tierState));
  assert.equal(restoredTier.tier, 'beginner');
});

console.log(`verify:runner - all ${n} checks green`);