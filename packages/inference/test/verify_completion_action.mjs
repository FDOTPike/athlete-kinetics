/**
 * Completion-action verification and finite candidate sweep.
 *
 * This is part of verify:autopilot but runs after the unchanged C1-C6B
 * verifier. Candidate policies below are diagnostics only; none is wired to
 * production block generation.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildCompletionWindow,
  composeControlActions,
  deriveCompletionAction,
  loggedCompletionShortfall,
  summarizeCompletionWindow,
} = require('./.build/completionAction.js');
const { MOVEMENT_PATTERNS } = require('./.build/types.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};
const eq = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const dates = Array.from({ length: 21 }, (_, index) =>
  `2026-07-${String(index + 1).padStart(2, '0')}`);
const neutralCorrection = { dLoad_p: 1, dSet_p: 0, dRpe_p: 0, prefBias_p: 0 };

const rowsFor = (pattern, shortfalls, evidenceCount = 4) =>
  shortfalls.map((shortfall, index) => ({
    date: dates[dates.length - shortfalls.length + index],
    pattern,
    evidenceCount,
    sumShortfall: shortfall * evidenceCount,
  }));

const actionWith = (overrides = {}) => {
  const corrections = {};
  for (const pattern of MOVEMENT_PATTERNS) {
    corrections[pattern] = { ...neutralCorrection, ...(overrides[pattern] ?? {}) };
  }
  return {
    corrections,
    blockAddedSets: MOVEMENT_PATTERNS.reduce(
      (total, pattern) => total + Math.max(0, corrections[pattern].dSet_p), 0),
    blockAddedRpe: MOVEMENT_PATTERNS.reduce(
      (total, pattern) => total + Math.max(0, corrections[pattern].dRpe_p), 0),
  };
};

const classOf = (correction) => {
  if (correction.dLoad_p < 1) return 'strong';
  if (correction.dSet_p < 0 || correction.dRpe_p < 0 || correction.prefBias_p < 0) {
    return 'reduce';
  }
  return 'neutral';
};

console.log('\n[completion 1] exact shortfall contract');
check('8 of 10 reps -> 0.2 shortfall',
  loggedCompletionShortfall(10, 8) === 0.2);
check('over-completion caps at zero',
  loggedCompletionShortfall(10, 12) === 0);
check('missing target is absent',
  loggedCompletionShortfall(null, 8) === null);
check('missing actual is absent',
  loggedCompletionShortfall(10, null) === null);
check('invalid counts are absent',
  loggedCompletionShortfall(0, 8) === null &&
  loggedCompletionShortfall(10, Number.NaN) === null);

console.log('\n[completion 2] grouped calendar projection');
const projected = buildCompletionWindow(dates, [
  { date: dates[20], pattern: 'squat', evidenceCount: 2, sumShortfall: 0.5 },
  { date: dates[20], pattern: 'squat', evidenceCount: 2, sumShortfall: 0.5 },
  { date: dates[19], pattern: 'hinge', evidenceCount: 1, sumShortfall: 3 },
  { date: '2026-06-01', pattern: 'squat', evidenceCount: 10, sumShortfall: 10 },
]);
check('duplicate grouped rows re-aggregate deterministically',
  projected.squat.evidenceCount[20] === 4 &&
  projected.squat.avgShortfall[20] === 0.25);
check('row shortfall is fail-safe clamped to evidence count',
  projected.hinge.avgShortfall[19] === 1);
check('out-of-window evidence is inert',
  projected.squat.evidenceCount.reduce((sum, value) => sum + value, 0) === 4);
check('absent pattern-day remains null and zero',
  projected.push_h.avgShortfall[20] === null &&
  projected.push_h.evidenceCount[20] === 0);

const projectedReverse = buildCompletionWindow(dates, [
  { date: '2026-06-01', pattern: 'squat', evidenceCount: 10, sumShortfall: 10 },
  { date: dates[19], pattern: 'hinge', evidenceCount: 1, sumShortfall: 3 },
  { date: dates[20], pattern: 'squat', evidenceCount: 2, sumShortfall: 0.5 },
  { date: dates[20], pattern: 'squat', evidenceCount: 2, sumShortfall: 0.5 },
]);
check('projection is input-order independent', eq(projected, projectedReverse));

const summary = summarizeCompletionWindow(projected);
check('summary counts honest days and sets',
  summary.squat.observationDays === 1 &&
  summary.squat.evidenceSets === 4 &&
  summary.squat.meanShortfall === 0.25);
check('absent summary stays null',
  summary.push_h.observationDays === 0 &&
  summary.push_h.evidenceSets === 0 &&
  summary.push_h.meanShortfall === null);

console.log('\n[completion 3] explicit candidate action');
const candidate = {
  minObservationDays: 5,
  deficitThreshold: 0.2,
  strongThreshold: 0.5,
};
const moderate = deriveCompletionAction(
  buildCompletionWindow(dates, rowsFor('squat', Array(5).fill(0.25))),
  candidate,
);
const strong = deriveCompletionAction(
  buildCompletionWindow(dates, rowsFor('squat', Array(5).fill(0.5))),
  candidate,
);
const thin = deriveCompletionAction(
  buildCompletionWindow(dates, rowsFor('squat', Array(4).fill(1))),
  candidate,
);
const exact = deriveCompletionAction(
  buildCompletionWindow(dates, rowsFor('squat', Array(21).fill(0))),
  candidate,
);
const inclusiveBoundary = deriveCompletionAction(
  buildCompletionWindow(dates, rowsFor('squat', Array(7).fill(0.1))),
  { minObservationDays: 5, deficitThreshold: 0.1, strongThreshold: 0.6 },
);
check('decimal threshold boundary remains inclusive after aggregation',
  eq(inclusiveBoundary.corrections.squat,
    { dLoad_p: 1, dSet_p: -1, dRpe_p: -0.5, prefBias_p: -1 }));

check('candidate moderate threshold emits existing reduction row',
  eq(moderate.corrections.squat,
    { dLoad_p: 1, dSet_p: -1, dRpe_p: -0.5, prefBias_p: -1 }));
check('candidate strong threshold emits existing strong-reduction row',
  eq(strong.corrections.squat,
    { dLoad_p: 0.95, dSet_p: -1, dRpe_p: -0.5, prefBias_p: -1 }));
check('thin evidence fails closed neutral',
  eq(thin.corrections.squat, neutralCorrection));
check('exact completion stays neutral',
  eq(exact.corrections.squat, neutralCorrection));
check('invalid policy fails closed neutral',
  eq(
    deriveCompletionAction(
      buildCompletionWindow(dates, rowsFor('squat', Array(21).fill(1))),
      { minObservationDays: 0, deficitThreshold: 0, strongThreshold: Number.NaN },
    ),
    actionWith(),
  ));
check('candidate action never carries positive authority',
  MOVEMENT_PATTERNS.every((pattern) => {
    const correction = strong.corrections[pattern];
    return correction.dLoad_p <= 1 &&
      correction.dSet_p <= 0 &&
      correction.dRpe_p <= 0 &&
      correction.prefBias_p <= 0;
  }) && strong.blockAddedSets === 0 && strong.blockAddedRpe === 0);

console.log('\n[completion 4] action-boundary composition');
const rpeAction = actionWith({
  squat: { dLoad_p: 0.95, dSet_p: -1, dRpe_p: -0.5, prefBias_p: -1 },
  hinge: { dLoad_p: 1.05, dSet_p: 1, dRpe_p: 0.5, prefBias_p: 1 },
});
const completionAction = actionWith({
  hinge: { dLoad_p: 1, dSet_p: -1, dRpe_p: -0.5, prefBias_p: -1 },
});
const composed = composeControlActions(rpeAction, completionAction);
check('completion reduction overrides RPE raise fieldwise',
  eq(composed.corrections.hinge,
    { dLoad_p: 1, dSet_p: -1, dRpe_p: -0.5, prefBias_p: -1 }));
check('RPE reduction survives neutral completion evidence',
  eq(composed.corrections.squat, rpeAction.corrections.squat));
const neutralComposed = composeControlActions(rpeAction, actionWith());
check('explicit neutral completion caps beginner RPE headroom at neutral',
  eq(neutralComposed.corrections.hinge, neutralCorrection));

check('positive totals are recomputed after composition',
  composed.blockAddedSets === 0 && composed.blockAddedRpe === 0);
check('composition is commutative',
  eq(
    composeControlActions(rpeAction, completionAction),
    composeControlActions(completionAction, rpeAction),
  ));
check('composition is idempotent',
  eq(composeControlActions(rpeAction, rpeAction), rpeAction));
const thirdAction = actionWith({
  carry: { dLoad_p: 0.95, dSet_p: 0, dRpe_p: -0.5, prefBias_p: 0 },
});
check('composition is associative',
  eq(
    composeControlActions(composeControlActions(rpeAction, completionAction), thirdAction),
    composeControlActions(rpeAction, composeControlActions(completionAction, thirdAction)),
  ));

console.log('\n[completion 5] finite diagnostic sweep - NO production winner');
const scenarios = {
  exact_7d: Array(7).fill(0),
  mild_7d: Array(7).fill(0.1),
  moderate_7d: Array(7).fill(0.25),
  severe_7d: Array(7).fill(0.6),
  high_7d: Array(7).fill(0.5),
  moderate_3d: Array(3).fill(0.25),
  sparse_severe_2d: Array(2).fill(0.6),
  severe_3d: Array(3).fill(0.6),
  severe_5d: Array(5).fill(0.6),
  mixed_5d: [0, 0, 0.25, 0.25, 0.5],
  improving_7d: [0.5, 0.4, 0.3, 0.2, 0.1, 0, 0],
  worsening_7d: [0, 0, 0.1, 0.2, 0.3, 0.4, 0.5],
};
const sweepRows = [];
for (const minObservationDays of [3, 5, 7]) {
  for (const deficitThreshold of [0.1, 0.2, 0.3]) {
    for (const strongThreshold of [0.4, 0.6]) {
      const policy = { minObservationDays, deficitThreshold, strongThreshold };
      const outcomes = {};
      for (const [name, shortfalls] of Object.entries(scenarios)) {
        const action = deriveCompletionAction(
          buildCompletionWindow(dates, rowsFor('squat', shortfalls)),
          policy,
        );
        outcomes[name] = classOf(action.corrections.squat);
      }
      sweepRows.push({ policy, outcomes });
    }
  }
}
check('sweep covers 18 finite candidate policies', sweepRows.length === 18);
check('all candidates keep exact completion neutral',
  sweepRows.every((row) => row.outcomes.exact_7d === 'neutral'));
check('each candidate policy has a distinct scenario signature',
  new Set(sweepRows.map((row) => JSON.stringify(row.outcomes))).size ===
    sweepRows.length);
check('all candidates keep two-day sparse evidence neutral',
  sweepRows.every((row) => row.outcomes.sparse_severe_2d === 'neutral'));
check('mean-only candidates expose improving/worsening ambiguity',
  sweepRows.every((row) =>
    row.outcomes.improving_7d === row.outcomes.worsening_7d));
console.log(`  SWEEP ${JSON.stringify(sweepRows)}`);

if (fail > 0) {
  console.error(`\n${fail} COMPLETION ACTION CHECK(S) FAILED`);
  process.exit(1);
}
console.log('\nALL COMPLETION ACTION CHECKS PASSED');
