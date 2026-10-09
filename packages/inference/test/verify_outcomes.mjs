/** verify:outcomes - Phase 18 neutral training-decision classifier knives. */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const {
  evaluateSessionOutcome,
  SESSION_OUTCOME_ENGINE_VERSION,
  SessionOutcomeValidationError,
} = require('./.build/sessionOutcome.js');
const feel = require('./.build/sessionFeel.js');

const reps = (value) => ({ kind: 'reps', reps: value });
const time = (value) => ({ kind: 'time', seconds: value });
const slot = (id, plannedSets = 2, provenanceKind = 'planned') => ({
  sessionPlanSlotId: id,
  plannedSets,
  provenanceKind,
});
const logged = (setId, slotId, actual, prescribed = actual, provenanceKind = 'planned') => ({
  setId,
  sessionPlanSlotId: slotId,
  provenanceKind,
  prescribedDose: prescribed,
  actualDose: actual,
});
const input = (patch = {}) => ({
  originKind: 'planned',
  terminal: { phase: 'complete', haltReason: null },
  slots: [slot(1)],
  sets: [logged(1, 1, reps(5)), logged(2, 1, reps(5))],
  skippedSessionPlanSlotIds: [],
  finalizedAtMs: 1000,
  ...patch,
});
const kind = (value) => evaluateSessionOutcome(value)?.kind ?? null;

let n = 0;
const check = (label, fn) => {
  n += 1;
  fn();
  console.log(`  [${n}] PASS ${label}`);
};

check('exact repetition work follows the plan', () => {
  const result = evaluateSessionOutcome(input());
  assert.equal(result.kind, 'followed_plan');
  assert.equal(result.engineVersion, SESSION_OUTCOME_ENGINE_VERSION);
  assert.deepEqual(result.evidence, {
    slotCount: 1, plannedSetCount: 2, loggedSetCount: 2,
    exactDoseCount: 2, underDoseCount: 0, overDoseCount: 0,
    unknownDoseCount: 0, unmappedSetCount: 0, missingSetCount: 0,
    missingUnskippedSetCount: 0, extraSetCount: 0, adaptedSlotCount: 0,
    skippedSlotCount: 0, offPlanSlotCount: 0,
  });
});

check('exact timed work follows the plan', () => {
  assert.equal(kind(input({ sets: [logged(1, 1, time(30)), logged(2, 1, time(30))] })), 'followed_plan');
});

check('subjective exertion, load, and band evidence cannot alter classification', () => {
  const base = input();
  const extraEvidence = {
    ...input(),
    targetRpe: 5,
    actualRpe: 10,
    loadKg: 400,
    bandLevel: 20,
    sets: input().sets.map((setRow, index) => ({
      ...setRow,
      targetRpe: index === 0 ? 5 : 10,
      actualRpe: index === 0 ? 10 : 5,
      loadKg: index * 200,
      bandLevel: index + 1,
    })),
  };
  assert.deepEqual(evaluateSessionOutcome(extraEvidence), evaluateSessionOutcome(base));
});

for (const [label, actual, prescribed] of [
  ['under reps', reps(4), reps(5)],
  ['over reps', reps(6), reps(5)],
  ['under seconds', time(29), time(30)],
  ['over seconds', time(31), time(30)],
]) {
  check(`${label} is neutrally recorded`, () => {
    assert.equal(kind(input({ sets: [logged(1, 1, actual, prescribed), logged(2, 1, prescribed)] })), 'session_recorded');
  });
}

check('missing, extra, incompatible, and unmapped work is neutrally recorded', () => {
  assert.equal(kind(input({ sets: [logged(1, 1, reps(5))] })), 'session_recorded');
  assert.equal(kind(input({ sets: [logged(1, 1, reps(5)), logged(2, 1, reps(5)), logged(3, 1, reps(5))] })), 'session_recorded');
  assert.equal(kind(input({ sets: [logged(1, 1, time(30), reps(5)), logged(2, 1, reps(5))] })), 'session_recorded');
  assert.equal(kind(input({ sets: [logged(1, null, reps(5), null, 'free_form'), logged(2, 1, reps(5))] })), 'session_recorded');
});

check('missing prescribed evidence or timed metric fails closed to session recorded', () => {
  assert.equal(kind(input({ sets: [logged(1, 1, reps(5), null), logged(2, 1, reps(5))] })), 'session_recorded');
  assert.equal(kind(input({ sets: [logged(1, 1, null, time(30)), logged(2, 1, time(30))] })), 'session_recorded');
});

check('free-form origins and added/free-form slots are session recorded', () => {
  assert.equal(kind(input({ originKind: 'free_form' })), 'session_recorded');
  assert.equal(kind(input({ slots: [slot(1, 2, 'added')], sets: [logged(1, 1, reps(5), reps(5), 'added'), logged(2, 1, reps(5), reps(5), 'added')] })), 'session_recorded');
});

check('substitution and day swap with exact dose are adapted sessions', () => {
  for (const provenance of ['substituted', 'day_swapped']) {
    const value = input({
      slots: [slot(1, 2, provenance)],
      sets: [logged(1, 1, reps(5), reps(5), 'planned'), logged(2, 1, reps(5), reps(5), provenance)],
    });
    assert.equal(kind(value), 'adapted_session', provenance);
  }
});

check('each set is judged against its immutable prescribed-at-log dose', () => {
  const changedMidSlot = input({
    slots: [slot(1, 2, 'day_swapped')],
    sets: [
      logged(1, 1, reps(5), reps(5), 'planned'),
      logged(2, 1, reps(8), reps(8), 'day_swapped'),
    ],
  });
  assert.equal(kind(changedMidSlot), 'adapted_session');
});

check('partial exact work followed by a real skip is adapted', () => {
  const partial = input({
    slots: [slot(1, 3)],
    sets: [logged(1, 1, reps(5))],
    skippedSessionPlanSlotIds: [1],
  });
  assert.equal(kind(partial), 'adapted_session');
  assert.equal(evaluateSessionOutcome(partial).evidence.missingSetCount, 2);
});

check('a skip cannot excuse inexact work, another slot, or an already finished slot', () => {
  assert.equal(kind(input({ slots: [slot(1, 3)], sets: [logged(1, 1, reps(4), reps(5))], skippedSessionPlanSlotIds: [1] })), 'session_recorded');
  assert.equal(kind(input({ slots: [slot(1, 1), slot(2, 1)], sets: [logged(1, 1, reps(5))], skippedSessionPlanSlotIds: [1] })), 'session_recorded');
  assert.equal(kind(input({ slots: [slot(1, 2)], skippedSessionPlanSlotIds: [1] })), 'session_recorded');
});

check('zero-set completion and zero-set manual stop are disposable', () => {
  const empty = { slots: [slot(1)], sets: [], skippedSessionPlanSlotIds: [] };
  assert.equal(kind(input(empty)), null);
  assert.equal(kind(input({ ...empty, skippedSessionPlanSlotIds: [1] })), null);
  assert.equal(kind(input({ ...empty, terminal: { phase: 'halted', haltReason: 'manual' } })), null);
});

check('zero-set directive halts are stopped safely', () => {
  for (const haltReason of ['niggle', 'pain', 'safety']) {
    assert.equal(kind(input({ terminal: { phase: 'halted', haltReason }, sets: [] })), 'stopped_safely', haltReason);
  }
});

check('halt takes precedence after work, including a manual halt and inexact dose', () => {
  for (const haltReason of ['manual', 'niggle', 'pain', 'safety']) {
    assert.equal(kind(input({
      terminal: { phase: 'halted', haltReason },
      sets: [logged(1, 1, reps(1), reps(10))],
    })), 'stopped_safely', haltReason);
  }
});

check('set and slot order do not change a decision', () => {
  const a = input({
    slots: [slot(1, 1), slot(2, 1, 'substituted')],
    sets: [logged(1, 1, reps(5)), logged(2, 2, time(30), time(30), 'substituted')],
  });
  const b = { ...a, slots: [...a.slots].reverse(), sets: [...a.sets].reverse() };
  assert.deepEqual(evaluateSessionOutcome(a), evaluateSessionOutcome(b));
});

check('evaluation is deterministic and does not mutate deeply frozen input', () => {
  const value = input();
  Object.freeze(value.slots[0]);
  for (const setRow of value.sets) {
    Object.freeze(setRow.prescribedDose);
    Object.freeze(setRow.actualDose);
    Object.freeze(setRow);
  }
  Object.freeze(value.slots);
  Object.freeze(value.sets);
  Object.freeze(value.skippedSessionPlanSlotIds);
  Object.freeze(value.terminal);
  Object.freeze(value);
  assert.deepEqual(evaluateSessionOutcome(value), evaluateSessionOutcome(value));
});

check('invalid IDs, doses, skip references, provenance, and terminal shapes throw', () => {
  const invalid = [
    input({ slots: [slot(1), slot(1)] }),
    input({ sets: [logged(1, 1, reps(5)), logged(1, 1, reps(5))] }),
    input({ skippedSessionPlanSlotIds: [999] }),
    input({ sets: [logged(1, 1, reps(0)), logged(2, 1, reps(5))] }),
    input({ slots: [{ ...slot(1), provenanceKind: 'rewarded' }] }),
    input({ terminal: { phase: 'working', haltReason: null } }),
    input({ terminal: { phase: 'halted', haltReason: null } }),
  ];
  for (const value of invalid) {
    assert.throws(() => evaluateSessionOutcome(value), SessionOutcomeValidationError);
  }
});

check('decision output is recognition-only and exposes no prescription controls', () => {
  const result = evaluateSessionOutcome(input());
  assert.deepEqual(Object.keys(result).sort(), ['engineVersion', 'evidence', 'finalizedAtMs', 'haltReason', 'kind', 'terminalPhase']);
  assert.deepEqual(Object.keys(result.evidence).sort(), [
    'adaptedSlotCount', 'exactDoseCount', 'extraSetCount', 'loggedSetCount',
    'missingSetCount', 'missingUnskippedSetCount', 'offPlanSlotCount',
    'overDoseCount', 'plannedSetCount', 'skippedSlotCount', 'slotCount',
    'underDoseCount', 'unknownDoseCount', 'unmappedSetCount',
  ]);
});

check('engine source has no clock or random reads', () => {
  const source = readFileSync(new URL('../src/sessionOutcome.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Date\.now\s*\(|new\s+Date\s*\(|Math\.random\s*\(|performance\.now\s*\(/);
});

// --- Session feel (070): when the completion screen asks, and what a valid answer is.
check('session feel: a session that followed the plan with effort on target is not asked about', () => {
  assert.equal(feel.shouldAskSessionFeel({ outcomeKind: 'followed_plan', meanRpeDrift: 0 }), false);
  assert.equal(feel.shouldAskSessionFeel({ outcomeKind: 'followed_plan', meanRpeDrift: 0.99 }), false);
  assert.equal(feel.shouldAskSessionFeel({ outcomeKind: 'followed_plan', meanRpeDrift: -0.99 }), false);
  assert.equal(feel.shouldAskSessionFeel({ outcomeKind: 'followed_plan', meanRpeDrift: null }), false);
});

check('session feel: effort a full point off target, either way, is asked about', () => {
  assert.equal(feel.SESSION_FEEL_RPE_DRIFT_THRESHOLD, 1);
  assert.equal(feel.shouldAskSessionFeel({ outcomeKind: 'followed_plan', meanRpeDrift: 1 }), true);
  assert.equal(feel.shouldAskSessionFeel({ outcomeKind: 'followed_plan', meanRpeDrift: -1 }), true);
  assert.equal(feel.shouldAskSessionFeel({ outcomeKind: 'followed_plan', meanRpeDrift: Number.NaN }), false);
});

check('session feel: every outcome other than followed_plan is asked about', () => {
  for (const outcomeKind of ['adapted_session', 'stopped_safely', 'session_recorded', 'a_kind_from_a_later_build']) {
    assert.equal(feel.shouldAskSessionFeel({ outcomeKind, meanRpeDrift: null }), true, outcomeKind);
    assert.equal(feel.shouldAskSessionFeel({ outcomeKind, meanRpeDrift: 0 }), true, outcomeKind);
  }
});

check('session feel: mean drift uses only sets that carry both a rating and a target', () => {
  assert.equal(feel.meanRpeDrift([]), null);
  assert.equal(feel.meanRpeDrift([{ rpe: null, targetRpe: 7 }, { rpe: 8, targetRpe: null }]), null);
  assert.equal(feel.meanRpeDrift([{ rpe: 9, targetRpe: 7 }, { rpe: 8, targetRpe: 7 }, { rpe: null, targetRpe: 7 }]), 1.5);
  assert.equal(feel.meanRpeDrift([{ rpe: 6, targetRpe: 8 }, { rpe: 8, targetRpe: 8 }]), -1);
  assert.equal(feel.meanRpeDrift([{ rpe: Number.NaN, targetRpe: 7 }, { rpe: 8, targetRpe: 7 }]), 1);
});

check('session feel: an answer needs a choice, and any choice but "as planned" needs a reason', () => {
  assert.deepEqual(feel.validateSessionFeel({ feel: null, reasons: ['tired'] }), { ok: false, problem: 'feel_required' });
  for (const kindOfFeel of ['harder', 'easier', 'stopped_early']) {
    assert.deepEqual(feel.validateSessionFeel({ feel: kindOfFeel, reasons: [] }), { ok: false, problem: 'reason_required' });
  }
  assert.deepEqual(feel.validateSessionFeel({ feel: 'harder', reasons: ['unwell', 'tired', 'tired'] }),
    { ok: true, record: { feel: 'harder', reasons: ['tired', 'unwell'] } });
});

check('session feel: "as planned" is saved with no reasons, whatever was tapped before', () => {
  assert.deepEqual(feel.validateSessionFeel({ feel: 'as_planned', reasons: [] }),
    { ok: true, record: { feel: 'as_planned', reasons: [] } });
  assert.deepEqual(feel.validateSessionFeel({ feel: 'as_planned', reasons: ['pain', 'other'] }),
    { ok: true, record: { feel: 'as_planned', reasons: [] } });
});

check('session feel: a value outside the closed lists is refused', () => {
  assert.deepEqual(feel.validateSessionFeel({ feel: 'terrible', reasons: ['tired'] }), { ok: false, problem: 'unknown_value' });
  assert.deepEqual(feel.validateSessionFeel({ feel: 'harder', reasons: ['weather'] }), { ok: false, problem: 'unknown_value' });
});

check('session feel: the closed lists mirror the 070 schema exactly', () => {
  const sql = readFileSync(new URL('../../core-db/src/schema/070_session_feel.sql', import.meta.url), 'utf8');
  const domain = /feel\s+TEXT NOT NULL CHECK \(feel IN \(([^)]+)\)\)/.exec(sql);
  assert.ok(domain, 'the feel CHECK domain was not found in 070');
  assert.deepEqual(domain[1].split(',').map((value) => value.trim().replace(/'/g, '')), [...feel.SESSION_FEEL_KINDS]);
  const columns = [...sql.matchAll(/^\s+reason_([a-z_]+)\s+INTEGER NOT NULL DEFAULT 0 CHECK/gm)].map((match) => match[1]);
  assert.deepEqual(columns, [...feel.SESSION_FEEL_REASONS]);
});

check('session feel: the module reads no clock, no randomness and no free text', () => {
  const source = readFileSync(new URL('../src/sessionFeel.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Date\.now\s*\(|new\s+Date\s*\(|Math\.random\s*\(|performance\.now\s*\(/);
  assert.doesNotMatch(source, /resolveReport|scanRedFlags|triage\s*\(|embed\s*\(/);
});

console.log(`verify:outcomes - all ${n} checks green`);
