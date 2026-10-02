/**
 * focusGoals.ts — the athlete's training focus and SMART goals (work order 2).
 *
 * Two separate things, deliberately kept apart:
 *
 *   FOCUS  — "Is there an area that you want to work on?" A set of muscle
 *            groups, chosen one by one or started from an editable bundle.
 *            It is a preference: it never overrides safety, capability,
 *            equipment or time, and it is never inferred from anything about
 *            the athlete (gender included) — only from what they select.
 *
 *   GOAL   — a specific, measurable target with a method, a baseline (or an
 *            explicit "unknown"), a personal reason and a requested deadline.
 *            The deadline is the athlete's own date. It is NOT the four-week
 *            plan review horizon and it grants no peaking or testing
 *            authority.
 *
 * Pure: no clock, no storage, no randomness. The caller passes today's date.
 *
 * Honesty rules encoded here:
 *   - feasibility is arithmetic plus stated uncertainty, never a promise;
 *   - where no reviewed reference exists for a kind of measurement the result
 *     says "cannot be assessed" instead of inventing a benchmark;
 *   - progress is computed only from observations the athlete recorded. It is
 *     never inferred from training volume.
 */
import type { TrainingAge } from './types';

// ---------------------------------------------------------------------------
// Muscle groups: canonical ids, plain gym names, verified aliases
// ---------------------------------------------------------------------------

export const MUSCLE_GROUPS = [
  'chest', 'upper_chest', 'shoulders', 'rear_shoulders', 'biceps', 'triceps', 'forearms',
  'upper_back', 'lats', 'lower_back', 'core',
  'glutes', 'quadriceps', 'hamstrings', 'calves', 'inner_thighs', 'outer_hips',
] as const;
export type MuscleGroupId = (typeof MUSCLE_GROUPS)[number];

export type MuscleRegion = 'upper' | 'trunk' | 'lower';

export const MUSCLE_GROUP_INFO: Record<MuscleGroupId, { readonly label: string; readonly region: MuscleRegion }> = {
  chest: { label: 'Chest', region: 'upper' },
  upper_chest: { label: 'Upper chest', region: 'upper' },
  shoulders: { label: 'Shoulders', region: 'upper' },
  rear_shoulders: { label: 'Rear shoulders', region: 'upper' },
  biceps: { label: 'Biceps', region: 'upper' },
  triceps: { label: 'Triceps', region: 'upper' },
  forearms: { label: 'Forearms', region: 'upper' },
  upper_back: { label: 'Upper back', region: 'upper' },
  lats: { label: 'Lats', region: 'upper' },
  lower_back: { label: 'Lower back', region: 'trunk' },
  core: { label: 'Core and abs', region: 'trunk' },
  glutes: { label: 'Glutes', region: 'lower' },
  quadriceps: { label: 'Quads', region: 'lower' },
  hamstrings: { label: 'Hamstrings', region: 'lower' },
  calves: { label: 'Calves', region: 'lower' },
  inner_thighs: { label: 'Inner thighs', region: 'lower' },
  outer_hips: { label: 'Outer hips', region: 'lower' },
};

const MUSCLE_GROUP_SET: ReadonlySet<string> = new Set(MUSCLE_GROUPS);
export const isMuscleGroupId = (value: unknown): value is MuscleGroupId =>
  typeof value === 'string' && MUSCLE_GROUP_SET.has(value);

/**
 * Aliases, lower-case. Two kinds, both verified against a named source:
 *   - LIBRARY terms: every distinct value that appears in
 *     movement_detail.target_muscles across the 300-movement library. Two
 *     library terms ('full_body', 'cardiovascular') name no muscle group and
 *     are deliberately absent.
 *   - GYM terms: common names an athlete may type or read. Kept short on
 *     purpose; an alias that could mean two groups ("arms", "back", "legs")
 *     is not listed, because guessing would be inventing a preference.
 */
export const MUSCLE_GROUP_ALIASES: Readonly<Record<string, MuscleGroupId>> = {
  // library terms
  chest: 'chest', pectorals: 'chest', upper_chest: 'upper_chest',
  shoulders: 'shoulders', deltoids: 'shoulders', anterior_deltoids: 'shoulders',
  rear_deltoids: 'rear_shoulders',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearms',
  'middle back': 'upper_back', rhomboids: 'upper_back', traps: 'upper_back', trapezius: 'upper_back',
  upper_back: 'upper_back',
  lats: 'lats',
  'lower back': 'lower_back', spinal_erectors: 'lower_back',
  abdominals: 'core', core: 'core', obliques: 'core',
  glutes: 'glutes', quadriceps: 'quadriceps', hamstrings: 'hamstrings', calves: 'calves',
  adductors: 'inner_thighs', abductors: 'outer_hips',
  // gym terms
  pecs: 'chest', 'upper chest': 'upper_chest', delts: 'shoulders', 'rear delts': 'rear_shoulders',
  'rear shoulders': 'rear_shoulders', 'upper back': 'upper_back', 'lower_back': 'lower_back',
  abs: 'core', quads: 'quadriceps', hams: 'hamstrings', 'inner thighs': 'inner_thighs',
  'outer hips': 'outer_hips',
};

/** Library target_muscles terms that name no muscle group (left unmapped). */
export const UNMAPPED_LIBRARY_MUSCLE_TERMS: readonly string[] = ['full_body', 'cardiovascular'];

export const resolveMuscleGroupAlias = (term: string): MuscleGroupId | null => {
  const key = term.trim().toLowerCase();
  if (isMuscleGroupId(key)) return key;
  return Object.prototype.hasOwnProperty.call(MUSCLE_GROUP_ALIASES, key) ? MUSCLE_GROUP_ALIASES[key]! : null;
};

// ---------------------------------------------------------------------------
// Focus
// ---------------------------------------------------------------------------

export const FOCUS_QUESTION = 'Is there an area that you want to work on?' as const;

export const FOCUS_BUNDLES = ['posture', 'beach_muscles', 'lower_body', 'balanced'] as const;
export type FocusBundleId = (typeof FOCUS_BUNDLES)[number];

export interface FocusBundle {
  readonly label: string;
  readonly description: string;
  /** The bundle's starting muscle groups. The athlete may add or remove any. */
  readonly muscles: readonly MuscleGroupId[];
  /** Posture also asks for movement control: carries, trunk and single-side work. */
  readonly movementControl: boolean;
}

export const FOCUS_BUNDLE_INFO: Record<FocusBundleId, FocusBundle> = {
  posture: {
    label: 'Posture',
    description: 'Upper back, core and controlled movement.',
    muscles: ['upper_back', 'rear_shoulders', 'core'],
    movementControl: true,
  },
  beach_muscles: {
    label: 'Beach muscles',
    description: 'Arms and upper chest.',
    muscles: ['biceps', 'triceps', 'upper_chest'],
    movementControl: false,
  },
  lower_body: {
    label: 'Lower body',
    description: 'Glutes, quads, hamstrings and calves.',
    muscles: ['glutes', 'quadriceps', 'hamstrings', 'calves'],
    movementControl: false,
  },
  balanced: {
    label: 'Balanced whole body',
    description: 'No extra emphasis. Train everything evenly.',
    muscles: [],
    movementControl: false,
  },
};

const FOCUS_BUNDLE_SET: ReadonlySet<string> = new Set(FOCUS_BUNDLES);
export const isFocusBundleId = (value: unknown): value is FocusBundleId =>
  typeof value === 'string' && FOCUS_BUNDLE_SET.has(value);

/** More than this many groups is no longer an emphasis. */
export const FOCUS_MAX_MUSCLES = 6;

export interface FocusSelection {
  /** The bundle the selection started from, or null for a hand-picked set. */
  readonly bundleId: FocusBundleId | null;
  /** The muscle groups actually selected — the authority for programming. */
  readonly muscles: readonly MuscleGroupId[];
  /** True when the athlete changed the bundle's own list. */
  readonly customised: boolean;
  readonly movementControl: boolean;
}

export const BALANCED_FOCUS: FocusSelection = {
  bundleId: 'balanced', muscles: [], customised: false, movementControl: false,
};

export type FocusValidation =
  | { readonly ok: true; readonly selection: FocusSelection }
  | { readonly ok: false; readonly message: string };

/**
 * Normalise a selection: canonical ids only, in canonical order, without
 * duplicates. Nothing is inferred — an unknown id is an error, not a guess.
 */
export function normalizeFocusSelection(input: {
  readonly bundleId: string | null;
  readonly muscles: readonly string[];
}): FocusValidation {
  if (input.bundleId !== null && !isFocusBundleId(input.bundleId)) {
    return { ok: false, message: 'That focus option is not recognised.' };
  }
  const chosen = new Set<MuscleGroupId>();
  for (const value of input.muscles) {
    if (!isMuscleGroupId(value)) return { ok: false, message: 'That muscle group is not recognised.' };
    chosen.add(value);
  }
  if (chosen.size > FOCUS_MAX_MUSCLES) {
    return { ok: false, message: `Choose up to ${FOCUS_MAX_MUSCLES} areas. More than that is no longer an emphasis — pick "Balanced whole body" instead.` };
  }
  const muscles = MUSCLE_GROUPS.filter((group) => chosen.has(group));
  const bundleId = input.bundleId as FocusBundleId | null;
  if (bundleId === 'balanced' && muscles.length > 0) {
    // Picking areas IS choosing an emphasis; the selection is no longer "balanced".
    return { ok: true, selection: { bundleId: null, muscles, customised: true, movementControl: false } };
  }
  if (bundleId === null && muscles.length === 0) return { ok: true, selection: BALANCED_FOCUS };
  const bundle = bundleId === null ? null : FOCUS_BUNDLE_INFO[bundleId];
  const customised = bundle === null
    || bundle.muscles.length !== muscles.length
    || bundle.muscles.some((group) => !chosen.has(group));
  return {
    ok: true,
    selection: { bundleId, muscles, customised, movementControl: bundle?.movementControl === true },
  };
}

/** The selection a bundle starts from, before any edit. */
export const focusFromBundle = (bundleId: FocusBundleId): FocusSelection => ({
  bundleId,
  muscles: MUSCLE_GROUPS.filter((group) => FOCUS_BUNDLE_INFO[bundleId].muscles.includes(group)),
  customised: false,
  movementControl: FOCUS_BUNDLE_INFO[bundleId].movementControl,
});

/** One line an athlete can read back, e.g. "Posture: upper back, rear shoulders, core and abs". */
export function describeFocus(selection: FocusSelection): string {
  if (selection.muscles.length === 0) return FOCUS_BUNDLE_INFO.balanced.label;
  const names = selection.muscles.map((group) => MUSCLE_GROUP_INFO[group].label.toLowerCase()).join(', ');
  if (selection.bundleId === null) return `Your own selection: ${names}`;
  const label = FOCUS_BUNDLE_INFO[selection.bundleId].label;
  return selection.customised ? `${label} (edited): ${names}` : `${label}: ${names}`;
}

/** A movement's explicit muscle mapping row (movement_muscle_role, 066). */
export interface MovementMuscleRole {
  readonly movementId: number;
  readonly muscleGroupId: MuscleGroupId;
  readonly role: 'primary' | 'supporting';
}

export type FocusMatch = 'primary' | 'supporting' | 'none';

/**
 * How a movement relates to the focus, from its EXPLICIT mapping only. A
 * movement with no mapping matches nothing — absence is never treated as a
 * match.
 */
export function focusMatchFor(
  roles: readonly MovementMuscleRole[],
  focus: ReadonlySet<MuscleGroupId>,
): FocusMatch {
  if (focus.size === 0) return 'none';
  let match: FocusMatch = 'none';
  for (const row of roles) {
    if (!focus.has(row.muscleGroupId)) continue;
    if (row.role === 'primary') return 'primary';
    match = 'supporting';
  }
  return match;
}

// ---------------------------------------------------------------------------
// SMART goals
// ---------------------------------------------------------------------------

export const GOAL_METRICS = [
  'load_kg', 'reps', 'time_seconds', 'distance_m', 'bodyweight_kg', 'length_cm', 'height_cm', 'custom',
] as const;
export type GoalMetricId = (typeof GOAL_METRICS)[number];

export interface GoalMetricInfo {
  readonly label: string;
  /** Fixed unit, or null when the athlete names their own. */
  readonly unit: string | null;
  /** What a truthful measurement method has to say for this kind of metric. */
  readonly methodPrompt: string;
}

export const GOAL_METRIC_INFO: Record<GoalMetricId, GoalMetricInfo> = {
  load_kg: { label: 'Weight lifted', unit: 'kg', methodPrompt: 'Which lift, for how many reps, with what standard (for example "back squat, 5 reps to parallel").' },
  reps: { label: 'Repetitions', unit: 'reps', methodPrompt: 'Which movement, at what load, counted how (for example "strict pull-ups, bodyweight, full hang").' },
  time_seconds: { label: 'Time', unit: 'seconds', methodPrompt: 'What is timed and where it starts and stops (for example "front plank, until the hips drop").' },
  distance_m: { label: 'Distance', unit: 'metres', methodPrompt: 'What is measured and how (for example "standing long jump, heel of the back foot").' },
  bodyweight_kg: { label: 'Body weight', unit: 'kg', methodPrompt: 'When and how you weigh (for example "morning, same scale, before eating").' },
  length_cm: { label: 'Body measurement', unit: 'cm', methodPrompt: 'Where the tape goes and in what position (for example "upper arm, relaxed, at the midpoint").' },
  height_cm: { label: 'Jump or reach height', unit: 'cm', methodPrompt: 'Which jump and how it is measured (for example "standing vertical jump, reach on a wall").' },
  custom: { label: 'Something else', unit: null, methodPrompt: 'Exactly what is measured, with what, and in what unit.' },
};

const GOAL_METRIC_SET: ReadonlySet<string> = new Set(GOAL_METRICS);
export const isGoalMetricId = (value: unknown): value is GoalMetricId =>
  typeof value === 'string' && GOAL_METRIC_SET.has(value);

export const GOAL_TEXT_MAX = 200;
export const GOAL_METHOD_MAX = 300;
export const GOAL_UNIT_MAX = 24;
export const GOAL_VALUE_MAX = 100_000;
export const MAX_ACTIVE_GOALS = 5;

export interface SmartGoalDraft {
  readonly specificOutcome: string;
  readonly metricId: string;
  /** Required for 'custom'; ignored otherwise. */
  readonly unit?: string | null;
  readonly measurementMethod: string;
  /** False is an explicit "I do not know my starting point yet". */
  readonly baselineKnown: boolean;
  readonly baselineValue?: number | null;
  readonly targetValue: number;
  readonly reason: string;
  /** ISO YYYY-MM-DD, or null for "no deadline". */
  readonly requestedDeadline: string | null;
}

export interface SmartGoal {
  readonly specificOutcome: string;
  readonly metricId: GoalMetricId;
  readonly unit: string;
  readonly measurementMethod: string;
  readonly baselineKnown: boolean;
  readonly baselineValue: number | null;
  readonly targetValue: number;
  readonly reason: string;
  readonly requestedDeadline: string | null;
}

export type GoalField =
  | 'specificOutcome' | 'metricId' | 'unit' | 'measurementMethod' | 'baselineValue'
  | 'targetValue' | 'reason' | 'requestedDeadline';

export interface GoalFieldError { readonly field: GoalField; readonly message: string }

export type GoalValidation =
  | { readonly ok: true; readonly goal: SmartGoal }
  | { readonly ok: false; readonly errors: readonly GoalFieldError[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealIsoDate = (value: string): boolean => {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
};
const daysBetween = (fromIso: string, toIso: string): number => {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) / 86_400_000);
};
const isMeasurable = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= GOAL_VALUE_MAX;

/**
 * Validate a goal draft. Every SMART element is required: a specific outcome,
 * a measurement method with units, a baseline or an explicit unknown, a
 * target, a personal reason, and a deadline or an explicit "none".
 */
export function validateSmartGoal(draft: SmartGoalDraft, today: string): GoalValidation {
  const errors: GoalFieldError[] = [];
  const specificOutcome = draft.specificOutcome.trim();
  const measurementMethod = draft.measurementMethod.trim();
  const reason = draft.reason.trim();
  if (specificOutcome.length < 3) errors.push({ field: 'specificOutcome', message: 'Say exactly what you want to achieve.' });
  if (specificOutcome.length > GOAL_TEXT_MAX) errors.push({ field: 'specificOutcome', message: `Keep it under ${GOAL_TEXT_MAX} characters.` });
  if (!isGoalMetricId(draft.metricId)) errors.push({ field: 'metricId', message: 'Choose what will be measured.' });
  const metric = isGoalMetricId(draft.metricId) ? GOAL_METRIC_INFO[draft.metricId] : null;
  const customUnit = (draft.unit ?? '').trim();
  if (metric !== null && metric.unit === null && (customUnit.length < 1 || customUnit.length > GOAL_UNIT_MAX)) {
    errors.push({ field: 'unit', message: 'Name the unit you will measure in.' });
  }
  if (measurementMethod.length < 5) errors.push({ field: 'measurementMethod', message: 'Describe how you will measure it, so every measurement is taken the same way.' });
  if (measurementMethod.length > GOAL_METHOD_MAX) errors.push({ field: 'measurementMethod', message: `Keep it under ${GOAL_METHOD_MAX} characters.` });
  if (!isMeasurable(draft.targetValue)) errors.push({ field: 'targetValue', message: 'Enter the number you are aiming for.' });
  const baselineValue = draft.baselineKnown ? draft.baselineValue ?? null : null;
  if (draft.baselineKnown && !isMeasurable(baselineValue)) {
    errors.push({ field: 'baselineValue', message: 'Enter where you are now, or choose "I do not know yet".' });
  }
  if (draft.baselineKnown && isMeasurable(baselineValue) && isMeasurable(draft.targetValue)
    && baselineValue === draft.targetValue) {
    errors.push({ field: 'targetValue', message: 'The target is the same as where you are now.' });
  }
  if (reason.length < 3) errors.push({ field: 'reason', message: 'Say why this matters to you. It is what you will read when it gets hard.' });
  if (reason.length > GOAL_TEXT_MAX) errors.push({ field: 'reason', message: `Keep it under ${GOAL_TEXT_MAX} characters.` });
  if (draft.requestedDeadline !== null) {
    if (!isRealIsoDate(draft.requestedDeadline)) {
      errors.push({ field: 'requestedDeadline', message: 'Enter the date as year-month-day, or choose "No deadline".' });
    } else if (daysBetween(today, draft.requestedDeadline) < 1) {
      errors.push({ field: 'requestedDeadline', message: 'Choose a date after today, or choose "No deadline".' });
    }
  }
  if (errors.length > 0 || metric === null) return { ok: false, errors };
  return {
    ok: true,
    goal: {
      specificOutcome,
      metricId: draft.metricId as GoalMetricId,
      unit: metric.unit ?? customUnit,
      measurementMethod,
      baselineKnown: draft.baselineKnown,
      baselineValue,
      targetValue: draft.targetValue,
      reason,
      requestedDeadline: draft.requestedDeadline,
    },
  };
}

export type GoalFeasibilityKind =
  | 'no_deadline'
  | 'baseline_unknown'
  | 'before_first_review'
  | 'gradual_rate'
  | 'faster_than_guidance'
  | 'not_assessable';

export interface GoalFeasibility {
  readonly kind: GoalFeasibilityKind;
  /** Whole weeks from today to the requested deadline; null without one. */
  readonly weeksAvailable: number | null;
  /** Change needed per week in the goal's unit; null when it cannot be computed. */
  readonly changePerWeek: number | null;
  /** Total change as a share of the baseline, e.g. 0.12 for +12%; null when unknown. */
  readonly totalChangeFraction: number | null;
  readonly explanation: string;
  /** Always present. Nothing here is a prediction or a promise. */
  readonly uncertainty: string;
  /** Source of any external reference used; empty when none was. */
  readonly references: readonly string[];
}

/** The plan review horizon. A goal deadline is NOT this and does not change it. */
export const PLAN_REVIEW_WEEKS = 4;

/**
 * The gradual weight-loss rate public-health guidance describes: about 1 to 2
 * pounds a week (CDC, "Steps for Losing Weight"). Used ONLY to describe a
 * body-weight reduction goal; this app gives no diet plan or medical advice.
 */
export const GRADUAL_WEIGHT_LOSS_KG_PER_WEEK = 0.9;
const WEIGHT_LOSS_REFERENCE = 'Centers for Disease Control and Prevention, "Steps for Losing Weight": people who lose weight gradually, about 1 to 2 pounds (0.5 to 0.9 kg) a week, are more likely to keep it off.';

const UNCERTAINTY = 'This is arithmetic, not a prediction. How fast anyone changes varies a great deal from person to person, and the app cannot promise a result or a date.';

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Say what the goal asks for and what can honestly be said about it.
 *
 * `trainingAge` is accepted so a caller can show it beside the result, but no
 * tier-specific benchmark is applied: no reviewed reference for expected
 * rates of strength, size, speed or skill change by experience level was
 * verified, so none is used.
 */
export function assessGoalFeasibility(
  goal: SmartGoal,
  context: { readonly today: string; readonly trainingAge?: TrainingAge },
): GoalFeasibility {
  const weeksAvailable = goal.requestedDeadline === null
    ? null
    : Math.floor(daysBetween(context.today, goal.requestedDeadline) / 7);
  const base = { weeksAvailable, uncertainty: UNCERTAINTY, references: [] as string[] };
  const unit = goal.unit;

  if (!goal.baselineKnown || goal.baselineValue === null) {
    return {
      ...base, kind: 'baseline_unknown', changePerWeek: null, totalChangeFraction: null,
      explanation: 'Your starting point is not recorded yet, so the size of this goal cannot be assessed. Record a first measurement using your method and the app will show the gap.',
    };
  }
  const change = goal.targetValue - goal.baselineValue;
  const totalChangeFraction = goal.baselineValue > 0 ? round2(change / goal.baselineValue) : null;
  const percent = totalChangeFraction === null ? '' : ` (${Math.abs(Math.round(totalChangeFraction * 100))}% of where you are now)`;
  const direction = change > 0 ? 'an increase' : 'a decrease';
  const gap = `That is ${direction} of ${round2(Math.abs(change))} ${unit}${percent}.`;

  if (weeksAvailable === null) {
    return {
      ...base, kind: 'no_deadline', changePerWeek: null, totalChangeFraction,
      explanation: `${gap} There is no deadline, so there is no weekly rate to judge. Your measurements will be shown at each ${PLAN_REVIEW_WEEKS}-week plan review.`,
    };
  }
  if (weeksAvailable < PLAN_REVIEW_WEEKS) {
    return {
      ...base, kind: 'before_first_review', changePerWeek: null, totalChangeFraction,
      explanation: `${gap} The deadline is less than ${PLAN_REVIEW_WEEKS} weeks away, which is before the first plan review. The plan will not be rushed or peaked for the date; treat it as a first check-in.`,
    };
  }
  const changePerWeek = round2(change / weeksAvailable);
  const rate = `Reaching it by the deadline needs about ${Math.abs(changePerWeek)} ${unit} a week for ${weeksAvailable} weeks.`;

  if (goal.metricId === 'bodyweight_kg' && change < 0) {
    const gradual = Math.abs(changePerWeek) <= GRADUAL_WEIGHT_LOSS_KG_PER_WEEK;
    return {
      ...base,
      kind: gradual ? 'gradual_rate' : 'faster_than_guidance',
      changePerWeek,
      totalChangeFraction,
      references: [WEIGHT_LOSS_REFERENCE],
      explanation: gradual
        ? `${gap} ${rate} That is within the gradual rate public-health guidance describes (about 0.5 to 0.9 kg a week). This app does not provide a diet plan or medical advice.`
        : `${gap} ${rate} That is faster than the gradual rate public-health guidance describes (about 0.5 to 0.9 kg a week). Consider a later date. This app does not provide a diet plan or medical advice.`,
    };
  }
  return {
    ...base, kind: 'not_assessable', changePerWeek, totalChangeFraction,
    explanation: `${gap} ${rate} The app has no reviewed reference for how quickly this kind of measurement changes, so it cannot say whether that rate is realistic. It will show the measurements you record against it.`,
  };
}

/** One measurement the athlete recorded for a goal. */
export interface GoalObservation {
  readonly observedOn: string;
  readonly value: number;
}

export type GoalProgressKind = 'no_observations' | 'baseline_only' | 'moving_toward' | 'no_change' | 'moving_away' | 'reached';

export interface GoalProgress {
  readonly kind: GoalProgressKind;
  readonly latest: GoalObservation | null;
  /** The value progress is measured from: the stated baseline, else the first observation. */
  readonly startValue: number | null;
  /** 0..1 share of the distance from start to target that is covered; null when unknown. */
  readonly fractionOfGap: number | null;
  readonly summary: string;
}

/**
 * Progress from RECORDED observations only. With no observation there is no
 * progress to report — training volume, sessions and time are never used as a
 * stand-in for a measurement.
 */
export function goalProgress(goal: SmartGoal, observations: readonly GoalObservation[]): GoalProgress {
  const ordered = [...observations]
    .filter((row) => isRealIsoDate(row.observedOn) && Number.isFinite(row.value))
    .sort((a, b) => a.observedOn.localeCompare(b.observedOn));
  const latest = ordered.length === 0 ? null : ordered[ordered.length - 1]!;
  const unit = goal.unit;
  if (latest === null) {
    return {
      kind: 'no_observations', latest: null, startValue: goal.baselineValue, fractionOfGap: null,
      summary: 'No measurement recorded yet. Progress is shown only from measurements you record.',
    };
  }
  const startValue = goal.baselineValue ?? ordered[0]!.value;
  if (goal.baselineValue === null && ordered.length === 1) {
    return {
      kind: 'baseline_only', latest, startValue, fractionOfGap: null,
      summary: `First measurement: ${latest.value} ${unit} on ${latest.observedOn}. This is your starting point.`,
    };
  }
  const gap = goal.targetValue - startValue;
  const moved = latest.value - startValue;
  const reached = gap > 0 ? latest.value >= goal.targetValue : gap < 0 ? latest.value <= goal.targetValue : true;
  const fractionOfGap = gap === 0 ? null : Math.max(0, Math.min(1, round2(moved / gap)));
  const where = `Latest measurement: ${latest.value} ${unit} on ${latest.observedOn} (started at ${startValue} ${unit}, target ${goal.targetValue} ${unit}).`;
  if (reached) return { kind: 'reached', latest, startValue, fractionOfGap: 1, summary: `${where} Target reached.` };
  if (moved === 0) return { kind: 'no_change', latest, startValue, fractionOfGap, summary: `${where} No change from the start yet.` };
  const toward = (gap > 0 && moved > 0) || (gap < 0 && moved < 0);
  return toward
    ? { kind: 'moving_toward', latest, startValue, fractionOfGap, summary: `${where} About ${Math.round((fractionOfGap ?? 0) * 100)}% of the way.` }
    : { kind: 'moving_away', latest, startValue, fractionOfGap: 0, summary: `${where} This is further from the target than the start.` };
}
