/**
 * verify_focus_goals.mjs — the focus question and SMART goals (work order 2).
 *
 * Pins:
 *   [1] the exact slide question, the four editable bundles and the canonical
 *       muscle-group vocabulary with its verified aliases;
 *   [2] focus selections are normalised, never guessed: unknown ids are
 *       errors, nothing is inferred, six areas is the limit;
 *   [3] a movement matches a focus only through its explicit mapping;
 *   [4] every SMART element is required, with an explicit "unknown" baseline
 *       and an explicit "no deadline";
 *   [5] feasibility is arithmetic and stated uncertainty — never a promise,
 *       never an invented benchmark; the deadline is separate from the
 *       four-week review horizon;
 *   [6] progress comes from recorded observations only.
 *
 * Run: npm run verify:preparation
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fg = require('./.build/focusGoals.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};
const TODAY = '2026-10-02';

// --- [1] vocabulary -----------------------------------------------------------
console.log('[1] question, bundles and vocabulary');
{
  check('the slide question is exact', fg.FOCUS_QUESTION === 'Is there an area that you want to work on?');
  check('four bundles: posture, beach muscles, lower body, balanced whole body',
    fg.FOCUS_BUNDLES.join(',') === 'posture,beach_muscles,lower_body,balanced'
      && fg.FOCUS_BUNDLE_INFO.posture.label === 'Posture' && fg.FOCUS_BUNDLE_INFO.beach_muscles.label === 'Beach muscles'
      && fg.FOCUS_BUNDLE_INFO.lower_body.label === 'Lower body' && fg.FOCUS_BUNDLE_INFO.balanced.label === 'Balanced whole body');
  check('posture is upper back, rear shoulders and core, with movement control',
    fg.FOCUS_BUNDLE_INFO.posture.muscles.join(',') === 'upper_back,rear_shoulders,core'
      && fg.FOCUS_BUNDLE_INFO.posture.movementControl === true);
  check('beach muscles is arms and upper chest',
    fg.FOCUS_BUNDLE_INFO.beach_muscles.muscles.join(',') === 'biceps,triceps,upper_chest');
  check('lower body is glutes, quads, hamstrings and calves',
    fg.FOCUS_BUNDLE_INFO.lower_body.muscles.join(',') === 'glutes,quadriceps,hamstrings,calves');
  check('balanced carries no emphasis at all', fg.FOCUS_BUNDLE_INFO.balanced.muscles.length === 0
    && fg.BALANCED_FOCUS.muscles.length === 0 && fg.BALANCED_FOCUS.bundleId === 'balanced');
  check('17 canonical muscle groups, each with a plain gym name and a region',
    fg.MUSCLE_GROUPS.length === 17 && new Set(fg.MUSCLE_GROUPS).size === 17
      && fg.MUSCLE_GROUPS.every((id) => fg.MUSCLE_GROUP_INFO[id].label.length > 2 && ['upper', 'trunk', 'lower'].includes(fg.MUSCLE_GROUP_INFO[id].region)));
  check('plain gym language, not anatomy: Quads, Lats, Core and abs, Rear shoulders',
    fg.MUSCLE_GROUP_INFO.quadriceps.label === 'Quads' && fg.MUSCLE_GROUP_INFO.lats.label === 'Lats'
      && fg.MUSCLE_GROUP_INFO.core.label === 'Core and abs' && fg.MUSCLE_GROUP_INFO.rear_shoulders.label === 'Rear shoulders');
  check('every bundle muscle is a canonical id',
    fg.FOCUS_BUNDLES.every((bundle) => fg.FOCUS_BUNDLE_INFO[bundle].muscles.every(fg.isMuscleGroupId)));
  check('aliases resolve to canonical ids, case and space insensitive',
    fg.resolveMuscleGroupAlias('Quads') === 'quadriceps' && fg.resolveMuscleGroupAlias(' abs ') === 'core'
      && fg.resolveMuscleGroupAlias('middle back') === 'upper_back' && fg.resolveMuscleGroupAlias('spinal_erectors') === 'lower_back'
      && fg.resolveMuscleGroupAlias('rear delts') === 'rear_shoulders' && fg.resolveMuscleGroupAlias('glutes') === 'glutes');
  check('every alias points at a canonical id',
    Object.values(fg.MUSCLE_GROUP_ALIASES).every(fg.isMuscleGroupId));
  check('an ambiguous or unknown term is NOT guessed (arms, back, legs, toned)',
    ['arms', 'back', 'legs', 'toned', 'full_body', 'cardiovascular', ''].every((term) => fg.resolveMuscleGroupAlias(term) === null));
  check('the two non-muscle library terms are documented as unmapped',
    fg.UNMAPPED_LIBRARY_MUSCLE_TERMS.join(',') === 'full_body,cardiovascular');
}

// --- [2] focus selection --------------------------------------------------------
console.log('[2] focus selection');
{
  const norm = fg.normalizeFocusSelection;
  const lower = norm({ bundleId: 'lower_body', muscles: ['calves', 'glutes', 'hamstrings', 'quadriceps'] });
  check('an untouched bundle is stored in canonical order and not marked edited',
    lower.ok && lower.selection.muscles.join(',') === 'glutes,quadriceps,hamstrings,calves'
      && lower.selection.customised === false && lower.selection.bundleId === 'lower_body');
  const edited = norm({ bundleId: 'lower_body', muscles: ['glutes', 'hamstrings', 'core'] });
  check('a bundle is editable: adding and removing areas keeps the bundle and marks it edited',
    edited.ok && edited.selection.bundleId === 'lower_body' && edited.selection.customised === true
      && edited.selection.muscles.join(',') === 'core,glutes,hamstrings');
  const own = norm({ bundleId: null, muscles: ['biceps', 'biceps', 'lats'] });
  check('individually selected groups work without any bundle, de-duplicated',
    own.ok && own.selection.bundleId === null && own.selection.muscles.join(',') === 'biceps,lats' && own.selection.customised);
  check('choosing areas under "balanced" is an emphasis, not balanced',
    (() => { const r = norm({ bundleId: 'balanced', muscles: ['glutes'] }); return r.ok && r.selection.bundleId === null && r.selection.muscles.join(',') === 'glutes'; })());
  check('no bundle and no areas is balanced whole body',
    (() => { const r = norm({ bundleId: null, muscles: [] }); return r.ok && r.selection.bundleId === 'balanced' && r.selection.muscles.length === 0; })());
  check('posture keeps its movement-control flag; other bundles do not have one',
    norm({ bundleId: 'posture', muscles: ['upper_back', 'rear_shoulders', 'core'] }).selection.movementControl === true
      && lower.selection.movementControl === false);
  check('an unknown bundle or muscle group is an error, never a guess',
    norm({ bundleId: 'summer_body', muscles: [] }).ok === false && norm({ bundleId: null, muscles: ['legs'] }).ok === false);
  check('more than six areas is refused with a plain explanation',
    (() => { const r = norm({ bundleId: null, muscles: fg.MUSCLE_GROUPS.slice(0, 7) }); return !r.ok && /Choose up to 6 areas/.test(r.message); })()
      && norm({ bundleId: null, muscles: fg.MUSCLE_GROUPS.slice(0, 6) }).ok === true && fg.FOCUS_MAX_MUSCLES === 6);
  check('focusFromBundle returns the bundle unedited',
    fg.focusFromBundle('beach_muscles').muscles.join(',') === 'upper_chest,biceps,triceps' && fg.focusFromBundle('beach_muscles').customised === false);
  check('descriptions read back in plain language',
    fg.describeFocus(lower.selection) === 'Lower body: glutes, quads, hamstrings, calves'
      && fg.describeFocus(edited.selection) === 'Lower body (edited): core and abs, glutes, hamstrings'
      && fg.describeFocus(own.selection) === 'Your own selection: biceps, lats'
      && fg.describeFocus(fg.BALANCED_FOCUS) === 'Balanced whole body');
  // Nothing about the athlete is an input: the function takes a selection and nothing else.
  check('a focus is derived from the selection alone (no profile, gender or tier input exists)',
    fg.normalizeFocusSelection.length === 1);
}

// --- [3] movement matching --------------------------------------------------------
console.log('[3] movement matching');
{
  const focus = new Set(['glutes', 'hamstrings']);
  const roles = (pairs) => pairs.map(([muscleGroupId, role]) => ({ movementId: 9, muscleGroupId, role }));
  check('primary mapping in the focus is a primary match',
    fg.focusMatchFor(roles([['hamstrings', 'primary'], ['glutes', 'supporting']]), focus) === 'primary');
  check('only a supporting mapping in the focus is a supporting match',
    fg.focusMatchFor(roles([['quadriceps', 'primary'], ['glutes', 'supporting']]), focus) === 'supporting');
  check('no mapping in the focus is no match',
    fg.focusMatchFor(roles([['chest', 'primary'], ['triceps', 'supporting']]), focus) === 'none');
  check('a movement with NO mapping matches nothing — absence is not a match',
    fg.focusMatchFor([], focus) === 'none');
  check('an empty focus (balanced) matches nothing', fg.focusMatchFor(roles([['glutes', 'primary']]), new Set()) === 'none');
}

// --- [4] SMART validation ------------------------------------------------------------
console.log('[4] SMART goal validation');
const goodDraft = {
  specificOutcome: 'Squat 100 kg for 5 reps', metricId: 'load_kg', measurementMethod: 'Back squat, 5 reps to parallel',
  baselineKnown: true, baselineValue: 80, targetValue: 100, reason: 'To be stronger for football',
  requestedDeadline: '2027-01-08',
};
{
  const ok = fg.validateSmartGoal(goodDraft, TODAY);
  check('a complete goal validates and takes its unit from the metric',
    ok.ok && ok.goal.unit === 'kg' && ok.goal.baselineValue === 80 && ok.goal.requestedDeadline === '2027-01-08');
  const fieldsOf = (draft) => { const r = fg.validateSmartGoal(draft, TODAY); return r.ok ? [] : r.errors.map((e) => e.field); };
  check('specific: an empty outcome is refused', fieldsOf({ ...goodDraft, specificOutcome: ' ' }).includes('specificOutcome'));
  check('measurable: a metric and a measurement method are required',
    fieldsOf({ ...goodDraft, metricId: 'vibes' }).includes('metricId') && fieldsOf({ ...goodDraft, measurementMethod: 'ok' }).includes('measurementMethod'));
  check('units: a custom metric needs the athlete to name the unit',
    fieldsOf({ ...goodDraft, metricId: 'custom', unit: '' }).includes('unit')
      && fg.validateSmartGoal({ ...goodDraft, metricId: 'custom', unit: 'rounds' }, TODAY).goal.unit === 'rounds');
  check('baseline: known needs a number; a blank is not zero',
    fieldsOf({ ...goodDraft, baselineValue: null }).includes('baselineValue') && fieldsOf({ ...goodDraft, baselineValue: Number.NaN }).includes('baselineValue'));
  const unknown = fg.validateSmartGoal({ ...goodDraft, baselineKnown: false, baselineValue: 55 }, TODAY);
  check('baseline: an explicit unknown is accepted and stores no number',
    unknown.ok && unknown.goal.baselineKnown === false && unknown.goal.baselineValue === null);
  check('target: required, finite, and different from the baseline',
    fieldsOf({ ...goodDraft, targetValue: Number.NaN }).includes('targetValue') && fieldsOf({ ...goodDraft, targetValue: 80 }).includes('targetValue'));
  check('relevant: a personal reason is required', fieldsOf({ ...goodDraft, reason: '' }).includes('reason'));
  check('time-bound: a deadline must be a real future date',
    fieldsOf({ ...goodDraft, requestedDeadline: '2026-10-02' }).includes('requestedDeadline')
      && fieldsOf({ ...goodDraft, requestedDeadline: '2026-02-30' }).includes('requestedDeadline')
      && fieldsOf({ ...goodDraft, requestedDeadline: 'next month' }).includes('requestedDeadline'));
  const noDeadline = fg.validateSmartGoal({ ...goodDraft, requestedDeadline: null }, TODAY);
  check('time-bound: an explicit "no deadline" is accepted', noDeadline.ok && noDeadline.goal.requestedDeadline === null);
  check('every metric has a unit or asks for one, and a method prompt',
    fg.GOAL_METRICS.every((id) => fg.GOAL_METRIC_INFO[id].methodPrompt.length > 20
      && (fg.GOAL_METRIC_INFO[id].unit === null) === (id === 'custom')));
}

// --- [5] feasibility ---------------------------------------------------------------------
console.log('[5] feasibility');
{
  const goal = fg.validateSmartGoal(goodDraft, TODAY).goal;
  const assess = (g, extra = {}) => fg.assessGoalFeasibility(g, { today: TODAY, ...extra });
  const strength = assess(goal);
  check('a strength goal states the gap and the weekly rate as arithmetic',
    strength.weeksAvailable === 14 && strength.changePerWeek === 1.43 && strength.totalChangeFraction === 0.25
      && /an increase of 20 kg \(25% of where you are now\)/.test(strength.explanation)
      && /about 1.43 kg a week for 14 weeks/.test(strength.explanation), strength.explanation);
  check('where no reviewed reference exists the app says so instead of inventing a benchmark',
    strength.kind === 'not_assessable' && /no reviewed reference/.test(strength.explanation) && strength.references.length === 0);
  check('experience level changes nothing: no tier benchmark is applied',
    JSON.stringify(assess(goal, { trainingAge: 'beginner' })) === JSON.stringify(assess(goal, { trainingAge: 'elite' })));
  const all = [
    strength,
    assess({ ...goal, baselineKnown: false, baselineValue: null }),
    assess({ ...goal, requestedDeadline: null }),
    assess({ ...goal, requestedDeadline: '2026-10-20' }),
    assess({ ...goal, metricId: 'bodyweight_kg', unit: 'kg', baselineValue: 90, targetValue: 84 }),
    assess({ ...goal, metricId: 'bodyweight_kg', unit: 'kg', baselineValue: 90, targetValue: 70 }),
  ];
  check('every assessment carries the same uncertainty statement and never promises',
    all.every((a) => /not a prediction/.test(a.uncertainty) && /cannot promise/.test(a.uncertainty))
      && all.every((a) => !/guarantee|you will reach|will achieve|on track to/i.test(`${a.explanation} ${a.uncertainty}`)));
  check('an unknown baseline cannot be assessed and asks for a first measurement',
    all[1].kind === 'baseline_unknown' && all[1].changePerWeek === null && /Record a first measurement/.test(all[1].explanation));
  check('no deadline: no weekly rate, progress shown at each 4-week review',
    all[2].kind === 'no_deadline' && all[2].weeksAvailable === null && /4-week plan review/.test(all[2].explanation));
  check('a deadline before the first review is not rushed or peaked for',
    all[3].kind === 'before_first_review' && all[3].weeksAvailable === 2 && /will not be rushed or peaked/.test(all[3].explanation));
  check('the review horizon is four weeks and is separate from the goal deadline',
    fg.PLAN_REVIEW_WEEKS === 4 && strength.weeksAvailable !== fg.PLAN_REVIEW_WEEKS);
  check('gradual weight loss is recognised against the cited public-health guidance',
    all[4].kind === 'gradual_rate' && all[4].changePerWeek === -0.43 && all[4].references.length === 1
      && /Centers for Disease Control/.test(all[4].references[0]) && /no.*diet plan or medical advice|does not provide a diet plan or medical advice/.test(all[4].explanation));
  check('faster-than-guidance weight loss is named as such and a later date is suggested',
    all[5].kind === 'faster_than_guidance' && Math.abs(all[5].changePerWeek) > fg.GRADUAL_WEIGHT_LOSS_KG_PER_WEEK
      && /faster than the gradual rate/.test(all[5].explanation) && /Consider a later date/.test(all[5].explanation));
  check('a weight GAIN goal has no reference and is not assessed against the loss guidance',
    assess({ ...goal, metricId: 'bodyweight_kg', unit: 'kg', baselineValue: 70, targetValue: 76 }).kind === 'not_assessable');
}

// --- [6] progress ----------------------------------------------------------------------------
console.log('[6] progress from recorded observations only');
{
  const goal = fg.validateSmartGoal(goodDraft, TODAY).goal;
  const none = fg.goalProgress(goal, []);
  check('no observation means no progress is reported — nothing is inferred',
    none.kind === 'no_observations' && none.latest === null && none.fractionOfGap === null
      && /only from measurements you record/.test(none.summary));
  const toward = fg.goalProgress(goal, [{ observedOn: '2026-11-01', value: 90 }, { observedOn: '2026-10-15', value: 85 }]);
  check('the latest observation by date is used, and the share of the gap is computed',
    toward.kind === 'moving_toward' && toward.latest.value === 90 && toward.fractionOfGap === 0.5 && /About 50% of the way/.test(toward.summary));
  check('reaching or passing the target is reported as reached',
    fg.goalProgress(goal, [{ observedOn: '2026-12-01', value: 102.5 }]).kind === 'reached');
  check('a measurement further from the target is reported honestly',
    fg.goalProgress(goal, [{ observedOn: '2026-11-01', value: 75 }]).kind === 'moving_away');
  check('no change is reported as no change',
    fg.goalProgress(goal, [{ observedOn: '2026-11-01', value: 80 }]).kind === 'no_change');
  const unknownBaseline = { ...goal, baselineKnown: false, baselineValue: null };
  const first = fg.goalProgress(unknownBaseline, [{ observedOn: '2026-10-05', value: 78 }]);
  check('with an unknown baseline the first real measurement becomes the starting point',
    first.kind === 'baseline_only' && first.startValue === 78 && /starting point/.test(first.summary));
  const later = fg.goalProgress(unknownBaseline, [{ observedOn: '2026-10-05', value: 78 }, { observedOn: '2026-11-05', value: 89 }]);
  check('later measurements are then compared with that first measurement',
    later.kind === 'moving_toward' && later.startValue === 78 && later.fractionOfGap === 0.5);
  const loss = { ...goal, metricId: 'bodyweight_kg', baselineValue: 90, targetValue: 84 };
  check('a decrease goal counts a lower measurement as progress',
    fg.goalProgress(loss, [{ observedOn: '2026-11-01', value: 87 }]).kind === 'moving_toward'
      && fg.goalProgress(loss, [{ observedOn: '2026-11-01', value: 92 }]).kind === 'moving_away');
  check('an invalid observation row is ignored rather than counted',
    fg.goalProgress(goal, [{ observedOn: 'yesterday', value: 99 }, { observedOn: '2026-11-01', value: Number.NaN }]).kind === 'no_observations');
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
