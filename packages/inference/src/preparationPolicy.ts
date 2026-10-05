/**
 * preparationPolicy.ts — the versioned, deterministic movement-preparation
 * policy.
 *
 * Preparation is a MOVEMENT PROTOCOL, not a title: comfortable breathing and
 * easy movement (raise), dynamic mobility for the joints the session uses
 * (mobilise), balance or bracing where it is useful (activate), an unloaded
 * rehearsal of the first movement (rehearse) and progressive preparation sets
 * toward the first working load (ramp).
 *
 * Pure: no clock, no storage, no randomness. The store freezes the returned
 * protocol into `session_preparation.protocol_json` inside the session-start
 * transaction, so the athlete resumes the SAME protocol after a restart even
 * if this policy is revised in a later build.
 *
 * Every dose below names the source it came from (PREPARATION_SOURCES and
 * docs/coaching/PREPARATION_PROVENANCE.md). Where a source gives a range, the
 * policy stays inside it; where no reviewed source supports a number, the
 * number is not prescribed. In particular the "25-50 hip-flexor raises per
 * side" Muay Thai example was evaluated and is NOT a preparation dose here:
 * no reviewed source supports that volume as a warm-up, and that much work is
 * practice volume, which must be visible as work rather than hidden in
 * preparation.
 *
 * What preparation is NOT: it never writes `set_record`, never earns a
 * lifting record and never feeds APRE progression. Ramp sets are preparation
 * items with their own performed-dose record.
 */
import type { MovementPattern, TrainingAge } from './types';
import type { Joint } from './substitution';
import type { ExecutableMovementAccessContext } from './tierPolicy';

export const PREPARATION_POLICY_ID = 'ramp-general' as const;
export const PREPARATION_POLICY_REVISION = 1 as const;
export const PREPARATION_PROTOCOL_VERSION = 1 as const;

/** Reviewed minimum protocol length in minutes (sessionTimeBudget mirrors it). */
export const PREPARATION_MINIMUM_MIN = 5;
/** At or above this many minutes the full protocol is built. */
export const PREPARATION_STANDARD_FROM_MIN = 8;

/**
 * Movement ids that must never be PRESCRIBED as a preparation drill, each
 * with the reason. 135 and 187 (the barbell and dumbbell incline shoulder
 * raise) are held while their intended movement identity is being corrected
 * in the animation lane; a rehearsal or ramp of either would coach a movement
 * whose definition is still open.
 */
export const PREPARATION_HELD_MOVEMENT_IDS: ReadonlyMap<number, string> = new Map([
  [135, 'Movement identity is under review; no preparation drill is prescribed for it.'],
  [187, 'Movement identity is under review; no preparation drill is prescribed for it.'],
]);

export interface PreparationSource {
  readonly id: string;
  readonly citation: string;
  readonly supports: string;
}

export const PREPARATION_SOURCES: readonly PreparationSource[] = [
  {
    id: 'ramp',
    citation: 'Jeffreys I. Warm-up revisited: the "ramp" method of optimising performance preparation. Professional Strength and Conditioning. 2007;(6):12-18; and Jeffreys I, "Warm-Up and Flexibility Training", in NSCA Essentials of Strength Training and Conditioning, 4th ed. (2016), ch. 14.',
    supports: 'Protocol structure (raise, activate and mobilise, potentiate) and the 3-5 minute raise phase.',
  },
  {
    id: 'acsm',
    citation: 'American College of Sports Medicine. ACSM\'s Guidelines for Exercise Testing and Prescription, 11th ed. (2021): components of the exercise training session.',
    supports: 'A warm-up of at least 5-10 minutes of light-to-moderate activity; the 5-minute reviewed floor.',
  },
  {
    id: 'fradkin2010',
    citation: 'Fradkin AJ, Zazryn TR, Smoliga JM. Effects of warming-up on physical performance: a systematic review with meta-analysis. J Strength Cond Res. 2010;24(1):140-148. PMID 19996770.',
    supports: 'Warming up improved performance in 79% of the criteria examined; little evidence that it is detrimental.',
  },
  {
    id: 'behm2016',
    citation: 'Behm DG, Blazevich AJ, Kay AD, McHugh M. Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals: a systematic review. Appl Physiol Nutr Metab. 2016;41(1):1-11.',
    supports: 'Dynamic rather than long static stretching before activity; static holds of 60 seconds or more per muscle group reduce performance, so no item here is a long static hold.',
  },
  {
    id: 'ribeiro2020',
    citation: 'Ribeiro B, Pereira A, Neves PP, et al. The Role of Specific Warm-up during Bench Press and Squat Exercises: A Novel Approach. Int J Environ Res Public Health. 2020;17(18):6882. PMID 32971729.',
    supports: 'Progressive specific warm-up sets of 6 repetitions at 40% and 80% of the training load; a single light set was not enough for the squat.',
  },
  {
    id: 'fifa11plus',
    citation: 'Soligard T, Myklebust G, Steffen K, et al. Comprehensive warm-up programme to prevent injuries in young female footballers: cluster randomised controlled trial. BMJ. 2008;337:a2469; and the FIFA 11+ manual (F-MARC).',
    supports: 'Single-leg balance held for 30 seconds per leg and a static front support ("the bench") of 20-30 seconds as warm-up items.',
  },
];

const SOURCE_IDS: ReadonlySet<string> = new Set(PREPARATION_SOURCES.map((source) => source.id));

export type PreparationStage = 'raise' | 'mobilise' | 'activate' | 'rehearse' | 'ramp';
export const PREPARATION_STAGES: readonly PreparationStage[] = ['raise', 'mobilise', 'activate', 'rehearse', 'ramp'];

export type PreparationDose =
  | { readonly kind: 'time'; readonly seconds: number; readonly perSide: boolean }
  | { readonly kind: 'reps'; readonly reps: number; readonly perSide: boolean }
  /** One progressive preparation set toward today's working load. */
  | { readonly kind: 'ramp'; readonly reps: number; readonly percentOfWorkingLoad: number };

export type PreparationEffort = 'easy' | 'moderate';

export interface PreparationItem {
  readonly itemId: string;
  readonly itemRevision: number;
  readonly stage: PreparationStage;
  readonly title: string;
  readonly instruction: string;
  readonly cue: string;
  readonly stopInstruction: string;
  /** An easier way to do the same job, or null when there is none. */
  readonly regression: string | null;
  readonly dose: PreparationDose;
  /** The session movement this item rehearses or ramps; null for a drill. */
  readonly movementId: number | null;
  readonly effort: PreparationEffort;
  readonly sourceRefs: readonly string[];
  readonly estimateSeconds: number;
}

export type PreparationOmissionReason =
  | 'movement_hold'
  | 'support_hold'
  | 'capability'
  | 'safety'
  | 'time'
  | 'not_applicable';

export interface PreparationOmission {
  readonly itemId: string;
  readonly movementId: number | null;
  readonly reasonCode: PreparationOmissionReason;
  readonly detail: string;
}

export type PreparationVariant = 'standard' | 'condensed';

export interface PreparationProtocol {
  readonly version: typeof PREPARATION_PROTOCOL_VERSION;
  readonly policyId: string;
  readonly policyRevision: number;
  readonly variant: PreparationVariant;
  /** What the protocol was tailored to, in plain language. */
  readonly basis: readonly string[];
  readonly items: readonly PreparationItem[];
  readonly omitted: readonly PreparationOmission[];
  readonly estimateSeconds: { readonly low: number; readonly high: number };
  /** Honest notes shown with the protocol (time conflicts, reduced readiness). */
  readonly notes: readonly string[];
}

export interface PreparationMainSlot {
  readonly movementId: number;
  readonly movementName: string;
  readonly pattern: MovementPattern;
  readonly isCompound: boolean;
  /** True when the movement is performed with an external load today. */
  readonly externallyLoaded: boolean;
  readonly target: { readonly kind: 'reps'; readonly reps: number } | { readonly kind: 'time'; readonly seconds: number };
}

export interface PreparationInput {
  readonly tier: TrainingAge;
  readonly accessContext: ExecutableMovementAccessContext;
  /** The frozen main plan in execution order. May be empty (free-form start). */
  readonly slots: readonly PreparationMainSlot[];
  /**
   * Movements that may not be used by a preparation item, with the reason.
   * The store fills this from the SAME gates the main plan passes through:
   * support holds, capability, tier/equipment access and active niggles.
   */
  readonly excludedMovements: ReadonlyMap<number, { readonly reasonCode: PreparationOmissionReason; readonly detail: string }>;
  /** Joints with an active niggle at or above the athlete's triage threshold. */
  readonly restrictedJoints: readonly Joint[];
  /** True when today's prescription is eased (lower effort cap, load or sets). */
  readonly readinessReduced: boolean;
  /** Minutes available for preparation inside the session limit. */
  readonly budgetMin: number;
  /** Set when the frozen plan plus preparation exceeds the session limit. */
  readonly timeConflictNote?: string | null;
}

interface DrillDefinition {
  readonly itemId: string;
  readonly itemRevision: number;
  readonly stage: PreparationStage;
  readonly title: string;
  readonly instruction: string;
  readonly cue: string;
  readonly stopInstruction: string;
  readonly regression: string | null;
  readonly dose: PreparationDose;
  readonly effort: PreparationEffort;
  readonly sourceRefs: readonly string[];
  /** Joints the drill loads; an active niggle on any of them withholds it. */
  readonly joints: readonly Joint[];
}

const STOP_GENERAL = 'Stop if you feel chest pain, dizziness or unusual breathlessness, and do not start the session.';
const STOP_JOINT = 'Stop the drill if it causes sharp or increasing pain, and skip it.';

const LOWER_LIMB_JOINTS: readonly Joint[] = ['knee', 'hip', 'ankle'];

const DRILLS = {
  raise: {
    itemId: 'raise.easy_movement',
    itemRevision: 1,
    stage: 'raise',
    title: 'Easy movement and breathing',
    instruction: 'Walk, pedal or row at an easy pace. Breathe through your nose if you can and keep a pace where you could hold a conversation.',
    cue: 'Easy pace, steady breathing.',
    stopInstruction: STOP_GENERAL,
    regression: 'March on the spot or walk slowly.',
    dose: { kind: 'time', seconds: 240, perSide: false },
    effort: 'easy',
    sourceRefs: ['ramp', 'acsm', 'fradkin2010'],
    joints: [],
  },
  legSwings: {
    itemId: 'mobilise.leg_swings',
    itemRevision: 1,
    stage: 'mobilise',
    title: 'Leg swings',
    instruction: 'Hold a rack or wall. Swing one straight leg forward and back in a smooth arc, a little higher each time, without leaning your trunk to help it.',
    cue: 'Tall trunk, smooth swing.',
    stopInstruction: STOP_JOINT,
    regression: 'Make the swing smaller, or do slow standing knee lifts instead.',
    dose: { kind: 'time', seconds: 30, perSide: true },
    effort: 'easy',
    sourceRefs: ['ramp', 'behm2016'],
    joints: ['hip', 'knee'],
  },
  ankleRocks: {
    itemId: 'mobilise.ankle_rocks',
    itemRevision: 1,
    stage: 'mobilise',
    title: 'Ankle rocks',
    instruction: 'Stand in a short split stance facing a wall. Keep the front heel down and move the front knee slowly forward over the toes, then back.',
    cue: 'Heel down, knee over toes.',
    stopInstruction: STOP_JOINT,
    regression: 'Shorten the range and keep both hands on the wall.',
    dose: { kind: 'time', seconds: 30, perSide: true },
    effort: 'easy',
    sourceRefs: ['ramp', 'behm2016'],
    joints: ['ankle', 'knee'],
  },
  hipHinge: {
    itemId: 'mobilise.hip_hinge_reach',
    itemRevision: 1,
    stage: 'mobilise',
    title: 'Hip hinge and reach',
    instruction: 'Stand with soft knees. Push your hips straight back and let your hands slide down your thighs with a long, flat back, then stand tall again.',
    cue: 'Hips back, long back.',
    stopInstruction: STOP_JOINT,
    regression: 'Hinge only as far as your back stays flat, with hands on your thighs.',
    dose: { kind: 'time', seconds: 30, perSide: false },
    effort: 'easy',
    sourceRefs: ['ramp', 'behm2016'],
    joints: ['hip', 'lower_back'],
  },
  armCircles: {
    itemId: 'mobilise.arm_circles',
    itemRevision: 1,
    stage: 'mobilise',
    title: 'Arm circles',
    instruction: 'Stand tall and circle both straight arms forward, starting small and growing to a full comfortable circle. Change direction halfway.',
    cue: 'Ribs down, big easy circles.',
    stopInstruction: STOP_JOINT,
    regression: 'Keep the circles small and below shoulder height.',
    dose: { kind: 'time', seconds: 30, perSide: false },
    effort: 'easy',
    sourceRefs: ['ramp', 'behm2016'],
    joints: ['shoulder'],
  },
  torsoRotation: {
    itemId: 'mobilise.torso_rotation',
    itemRevision: 1,
    stage: 'mobilise',
    title: 'Standing torso rotation',
    instruction: 'Stand with feet hip-width and arms crossed over your chest. Turn your chest slowly to one side, then the other, keeping your hips facing forward.',
    cue: 'Turn from the chest, hips quiet.',
    stopInstruction: STOP_JOINT,
    regression: 'Do the same turn seated on a bench.',
    dose: { kind: 'time', seconds: 30, perSide: false },
    effort: 'easy',
    sourceRefs: ['ramp', 'behm2016'],
    joints: ['spine', 'lower_back'],
  },
  singleLegBalance: {
    itemId: 'activate.single_leg_balance',
    itemRevision: 1,
    stage: 'activate',
    title: 'Single-leg balance',
    instruction: 'Stand on one leg with that knee slightly bent and your hips level. Keep the standing knee in line with your toes and hold steady.',
    cue: 'Hips level, knee over toes.',
    stopInstruction: STOP_JOINT,
    regression: 'Keep one fingertip on a wall or rack.',
    dose: { kind: 'time', seconds: 30, perSide: true },
    effort: 'easy',
    sourceRefs: ['fifa11plus'],
    joints: ['ankle', 'knee', 'hip'],
  },
  frontPlank: {
    itemId: 'activate.front_support',
    itemRevision: 1,
    stage: 'activate',
    title: 'Front support hold',
    instruction: 'Rest on your forearms and toes with elbows under shoulders. Hold a straight line from head to heels and keep breathing.',
    cue: 'Straight line, keep breathing.',
    stopInstruction: 'Stop the hold when your hips sag or your lower back aches.',
    regression: 'Hold from your knees instead of your toes.',
    dose: { kind: 'time', seconds: 20, perSide: false },
    effort: 'moderate',
    sourceRefs: ['fifa11plus'],
    joints: ['shoulder', 'elbow', 'lower_back'],
  },
} as const satisfies Record<string, DrillDefinition>;

const DRILL_JOINTS: ReadonlyMap<string, readonly Joint[]> = new Map(
  Object.values(DRILLS).map((drill): [string, readonly Joint[]] => [drill.itemId, drill.joints]),
);

/**
 * Joints a catalogue drill loads, for the execution-time recheck: a niggle
 * reported AFTER the protocol was frozen must still withhold a drill that
 * loads that area. Rehearsal and ramp items are movement-bound and are
 * rechecked through the movement's own access and safety verdict instead.
 */
export const preparationItemJoints = (itemId: string): readonly Joint[] => DRILL_JOINTS.get(itemId) ?? [];

/** Changeover allowance between two preparation items. */
const ITEM_CHANGEOVER_SECONDS = 10;
/** Tempo and changeover used only to estimate a rehearsal or ramp set. */
const SET_SECONDS_PER_REP = 4;
const SET_CHANGEOVER_SECONDS = 36;
const RAMP_REPS = 6;
const RAMP_PERCENTS: readonly number[] = [40, 80];
const REHEARSE_REPS = 6;
const REHEARSE_HOLD_SECONDS = 10;

const doseSeconds = (dose: PreparationDose): number => {
  switch (dose.kind) {
    case 'time': return dose.seconds * (dose.perSide ? 2 : 1);
    case 'reps': return dose.reps * SET_SECONDS_PER_REP * (dose.perSide ? 2 : 1);
    case 'ramp': return dose.reps * SET_SECONDS_PER_REP + SET_CHANGEOVER_SECONDS;
  }
};

const drillItem = (drill: DrillDefinition, doseOverride?: PreparationDose): PreparationItem => {
  const dose = doseOverride ?? drill.dose;
  return {
    itemId: drill.itemId,
    itemRevision: drill.itemRevision,
    stage: drill.stage,
    title: drill.title,
    instruction: drill.instruction,
    cue: drill.cue,
    stopInstruction: drill.stopInstruction,
    regression: drill.regression,
    dose,
    movementId: null,
    effort: drill.effort,
    sourceRefs: [...drill.sourceRefs],
    estimateSeconds: doseSeconds(dose) + ITEM_CHANGEOVER_SECONDS,
  };
};

const MOBILISE_BY_PATTERN: Record<MovementPattern, readonly DrillDefinition[]> = {
  squat: [DRILLS.legSwings, DRILLS.ankleRocks],
  hinge: [DRILLS.hipHinge, DRILLS.legSwings],
  lunge: [DRILLS.legSwings, DRILLS.ankleRocks],
  locomotion: [DRILLS.legSwings, DRILLS.ankleRocks],
  push_h: [DRILLS.armCircles, DRILLS.torsoRotation],
  push_v: [DRILLS.armCircles, DRILLS.torsoRotation],
  pull_h: [DRILLS.armCircles, DRILLS.torsoRotation],
  pull_v: [DRILLS.armCircles, DRILLS.torsoRotation],
  carry: [DRILLS.armCircles, DRILLS.torsoRotation],
  rotation: [DRILLS.torsoRotation, DRILLS.hipHinge],
  isolation: [],
};

const BALANCE_PATTERNS: ReadonlySet<MovementPattern> = new Set(['lunge', 'locomotion']);
const BRACING_PATTERNS: ReadonlySet<MovementPattern> = new Set(['squat', 'hinge', 'carry']);

const PATTERN_LABEL: Record<MovementPattern, string> = {
  squat: 'squat', hinge: 'hinge', lunge: 'lunge', locomotion: 'running or rounds',
  push_h: 'horizontal press', push_v: 'overhead press', pull_h: 'row', pull_v: 'pull-down or pull-up',
  carry: 'carry', rotation: 'rotation', isolation: 'isolation',
};

const roundToHalfMinute = (seconds: number): number => Math.round(seconds / 30) * 30;

/**
 * Build the preparation protocol for one session. The result is complete and
 * self-describing: every item that is NOT there but could have been is listed
 * in `omitted` with its reason, so nothing is dropped silently.
 */
export function buildPreparationProtocol(input: PreparationInput): PreparationProtocol {
  const budgetMin = Math.max(PREPARATION_MINIMUM_MIN, Number.isFinite(input.budgetMin) ? input.budgetMin : PREPARATION_MINIMUM_MIN);
  const variant: PreparationVariant = budgetMin >= PREPARATION_STANDARD_FROM_MIN ? 'standard' : 'condensed';
  const restricted = new Set<Joint>(input.restrictedJoints);
  const omitted: PreparationOmission[] = [];
  const notes: string[] = [];
  const basis: string[] = [];

  const withheldByJoint = (drill: DrillDefinition): boolean => drill.joints.some((joint) => restricted.has(joint));

  // --- raise: always present. A lower-limb niggle switches it to an option
  // that does not load the sore area instead of removing it. ---------------
  const lowerLimbRestricted = LOWER_LIMB_JOINTS.some((joint) => restricted.has(joint));
  const raiseSeconds = variant === 'standard' ? 240 : 180;
  const raise: PreparationItem = {
    ...drillItem(DRILLS.raise, { kind: 'time', seconds: raiseSeconds, perSide: false }),
    ...(lowerLimbRestricted ? {
      instruction: 'Use an option that keeps weight off the sore area, such as easy seated arm cycling or seated marching with the comfortable leg. Keep a pace where you could hold a conversation.',
      regression: 'Slow, relaxed breathing while seated, with gentle arm swings.',
    } : {}),
  };

  // --- mobilise: dynamic drills for the patterns of the first two movements.
  const patternsInOrder: MovementPattern[] = [];
  for (const slot of input.slots) {
    if (!patternsInOrder.includes(slot.pattern)) patternsInOrder.push(slot.pattern);
  }
  const mobiliseCandidates: DrillDefinition[] = [];
  const pushCandidate = (drill: DrillDefinition | undefined): void => {
    if (drill !== undefined && !mobiliseCandidates.includes(drill)) mobiliseCandidates.push(drill);
  };
  if (input.slots.length === 0) {
    pushCandidate(DRILLS.legSwings);
    pushCandidate(DRILLS.armCircles);
  } else {
    // First choice of each pattern in session order, then second choices.
    for (const pattern of patternsInOrder) pushCandidate(MOBILISE_BY_PATTERN[pattern][0]);
    for (const pattern of patternsInOrder) pushCandidate(MOBILISE_BY_PATTERN[pattern][1]);
  }
  const mobilise: PreparationItem[] = [];
  for (const drill of mobiliseCandidates) {
    if (withheldByJoint(drill)) {
      omitted.push({ itemId: drill.itemId, movementId: null, reasonCode: 'safety', detail: `${drill.title} is withheld because it loads an area with an active niggle.` });
      continue;
    }
    if (mobilise.length >= 2) continue;
    mobilise.push(drillItem(drill));
  }

  // --- activate: balance or bracing only where the session uses it. ---------
  const sportContext = input.accessContext === 'sport_conditioning';
  const wantsBalance = sportContext || input.slots.some((slot) => BALANCE_PATTERNS.has(slot.pattern));
  const wantsBracing = input.slots.some((slot) => BRACING_PATTERNS.has(slot.pattern));
  const activateDrill: DrillDefinition | null = wantsBalance ? DRILLS.singleLegBalance : wantsBracing ? DRILLS.frontPlank : null;
  let activate: PreparationItem | null = null;
  if (activateDrill !== null) {
    if (withheldByJoint(activateDrill)) {
      omitted.push({ itemId: activateDrill.itemId, movementId: null, reasonCode: 'safety', detail: `${activateDrill.title} is withheld because it loads an area with an active niggle.` });
    } else {
      activate = drillItem(activateDrill);
    }
  }

  // --- rehearse + ramp: the first session movement that may be used. --------
  const usable = (slot: PreparationMainSlot): boolean => {
    const held = PREPARATION_HELD_MOVEMENT_IDS.get(slot.movementId);
    if (held !== undefined) {
      omitted.push({ itemId: 'rehearse.session_movement', movementId: slot.movementId, reasonCode: 'movement_hold', detail: `${slot.movementName}: ${held}` });
      return false;
    }
    const excluded = input.excludedMovements.get(slot.movementId);
    if (excluded !== undefined) {
      omitted.push({ itemId: 'rehearse.session_movement', movementId: slot.movementId, reasonCode: excluded.reasonCode, detail: `${slot.movementName}: ${excluded.detail}` });
      return false;
    }
    return true;
  };
  const compoundFirst = [...input.slots.filter((slot) => slot.isCompound), ...input.slots.filter((slot) => !slot.isCompound)];
  const anchor = compoundFirst.find(usable) ?? null;

  let rehearse: PreparationItem | null = null;
  const ramp: PreparationItem[] = [];
  if (anchor === null) {
    if (input.slots.length === 0) {
      rehearse = {
        itemId: 'rehearse.first_choice',
        itemRevision: 1,
        stage: 'rehearse',
        title: 'Rehearse your first movement',
        instruction: 'When you choose your first movement, do one easy set with no added load or the lightest option before your first working set. Move at the same speed and through the same range you plan to train.',
        cue: 'Same technique, no strain.',
        stopInstruction: STOP_JOINT,
        regression: 'Use a shorter range or a supported version.',
        dose: { kind: 'reps', reps: REHEARSE_REPS, perSide: false },
        movementId: null,
        effort: 'easy',
        sourceRefs: ['ramp'],
        estimateSeconds: REHEARSE_REPS * SET_SECONDS_PER_REP + SET_CHANGEOVER_SECONDS,
      };
    }
  } else {
    const timed = anchor.target.kind === 'time';
    const workingReps = anchor.target.kind === 'reps' ? Math.max(1, Math.round(anchor.target.reps)) : 1;
    // A preparation set is never more repetitions than a working set.
    const rehearseReps = Math.min(REHEARSE_REPS, workingReps);
    rehearse = {
      itemId: 'rehearse.session_movement',
      itemRevision: 1,
      stage: 'rehearse',
      title: `Rehearse: ${anchor.movementName}`,
      instruction: timed
        ? `Do one short, easy effort of ${anchor.movementName} at well below working effort to check your position and setup.`
        : anchor.externallyLoaded
          ? `Do one set of ${anchor.movementName} with no added load or the empty bar. Use the same stance, grip and range you will use for your working sets.`
          : `Do one easy set of ${anchor.movementName} using a shorter range or a supported version. Use the same positions you will use for your working sets.`,
      cue: 'Same technique, no strain.',
      stopInstruction: STOP_JOINT,
      regression: 'Use a shorter range or a supported version of the movement.',
      dose: timed
        ? { kind: 'time', seconds: REHEARSE_HOLD_SECONDS, perSide: false }
        : { kind: 'reps', reps: rehearseReps, perSide: false },
      movementId: anchor.movementId,
      effort: 'easy',
      sourceRefs: ['ramp'],
      estimateSeconds: (timed ? REHEARSE_HOLD_SECONDS : rehearseReps * SET_SECONDS_PER_REP) + SET_CHANGEOVER_SECONDS,
    };
    if (anchor.externallyLoaded && !timed) {
      const rampReps = Math.min(RAMP_REPS, workingReps);
      for (const percent of RAMP_PERCENTS) {
        const dose: PreparationDose = { kind: 'ramp', reps: rampReps, percentOfWorkingLoad: percent };
        ramp.push({
          itemId: `ramp.set_${percent}`,
          itemRevision: 1,
          stage: 'ramp',
          title: `Preparation set: ${anchor.movementName} at about ${percent}% of today's working load`,
          instruction: percent < 60
            ? `Load about ${percent}% of the weight you plan to use for your working sets and do ${rampReps} controlled repetitions. It should feel light.`
            : `Load about ${percent}% of the weight you plan to use for your working sets and do ${rampReps} controlled repetitions. It should feel clearly easier than a working set.`,
          cue: 'Controlled reps, same technique.',
          stopInstruction: 'Stop the set if it feels hard, grinds or hurts, and tell the app how you feel before your working sets.',
          regression: 'Use a lighter load, or repeat the lighter preparation set.',
          dose,
          movementId: anchor.movementId,
          effort: percent < 60 ? 'easy' : 'moderate',
          sourceRefs: ['ribeiro2020'],
          estimateSeconds: doseSeconds(dose),
        });
      }
    } else if (!anchor.externallyLoaded) {
      omitted.push({ itemId: 'ramp.sets', movementId: anchor.movementId, reasonCode: 'not_applicable', detail: `${anchor.movementName} has no added load today, so there are no loaded preparation sets.` });
    } else {
      omitted.push({ itemId: 'ramp.sets', movementId: anchor.movementId, reasonCode: 'not_applicable', detail: `${anchor.movementName} is time-based, so there are no loaded preparation sets.` });
    }
  }

  // --- fit to the preparation time. Essential items stay: raise, and the
  // rehearsal or ramp of the first movement. In the condensed protocol a
  // loaded movement's first (light) ramp set IS its rehearsal. -------------
  const budgetSeconds = budgetMin * 60;
  const essential: PreparationItem[] = [raise];
  if (variant === 'condensed' && ramp.length > 0 && rehearse !== null) {
    omitted.push({ itemId: rehearse.itemId, movementId: rehearse.movementId, reasonCode: 'time', detail: 'The unloaded rehearsal is combined with the first light preparation set in this short session.' });
  } else if (rehearse !== null) {
    essential.push(rehearse);
  }
  essential.push(...ramp);
  // Lowest priority is dropped first: the second mobility drill, then
  // activation, then the first mobility drill.
  const optional: PreparationItem[] = [...mobilise, ...(activate === null ? [] : [activate])];
  const dropOrder: PreparationItem[] = [
    ...mobilise.slice(1).reverse(),
    ...(activate === null ? [] : [activate]),
    ...mobilise.slice(0, 1),
  ];
  const total = (): number => [...essential, ...optional].reduce((sum, item) => sum + item.estimateSeconds, 0);
  for (const candidate of dropOrder) {
    if (total() <= budgetSeconds) break;
    optional.splice(optional.indexOf(candidate), 1);
    omitted.push({ itemId: candidate.itemId, movementId: null, reasonCode: 'time', detail: `${candidate.title} is left out so preparation fits the time available.` });
  }

  const stageOrder = (item: PreparationItem): number => PREPARATION_STAGES.indexOf(item.stage);
  const items = [...essential, ...optional]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => stageOrder(a.item) - stageOrder(b.item) || a.index - b.index)
    .map(({ item }) => item);

  basis.push(input.slots.length === 0
    ? 'No movements are planned yet, so this is general preparation.'
    : `Session movements: ${patternsInOrder.map((pattern) => PATTERN_LABEL[pattern]).join(', ')}.`);
  if (anchor !== null) basis.push(`First movement prepared: ${anchor.movementName}.`);
  basis.push(variant === 'standard'
    ? `Full protocol within ${Math.round(budgetMin)} minutes.`
    : `Short protocol within ${Math.round(budgetMin)} minutes.`);
  if (input.tier === 'beginner') basis.push('Experience: beginner — move slowly and use the easier option whenever unsure.');
  if (sportContext) basis.push('Sport or conditioning session: balance is included.');
  if (restricted.size > 0) basis.push('Active niggles: drills that load those areas are withheld.');
  if (input.readinessReduced) {
    notes.push('Today\'s plan is eased. Keep every preparation item easy and base the preparation sets on today\'s reduced working load.');
  }
  if (input.timeConflictNote !== undefined && input.timeConflictNote !== null && input.timeConflictNote.trim().length > 0) {
    notes.push(input.timeConflictNote.trim());
  }

  const sum = items.reduce((seconds, item) => seconds + item.estimateSeconds, 0);
  return {
    version: PREPARATION_PROTOCOL_VERSION,
    policyId: PREPARATION_POLICY_ID,
    policyRevision: PREPARATION_POLICY_REVISION,
    variant,
    basis,
    items,
    omitted,
    estimateSeconds: {
      low: Math.max(30, roundToHalfMinute(sum * 0.85)),
      high: Math.max(60, roundToHalfMinute(sum * 1.15)),
    },
    notes,
  };
}

/** Whole minutes a planner or screen should show for a protocol. */
export const preparationEstimateMinutes = (protocol: PreparationProtocol): number =>
  Math.max(1, Math.ceil((protocol.estimateSeconds.low + protocol.estimateSeconds.high) / 2 / 60));

// ---------------------------------------------------------------------------
// Frozen-protocol parsing (resume). A protocol that does not validate is
// rejected rather than partially trusted.
// ---------------------------------------------------------------------------

export class PreparationProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreparationProtocolError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const isPositiveInt = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;
const OMISSION_REASONS: ReadonlySet<string> = new Set([
  'movement_hold', 'support_hold', 'capability', 'safety', 'time', 'not_applicable',
]);

const parseDose = (value: unknown): PreparationDose => {
  if (!isRecord(value)) throw new PreparationProtocolError('preparation dose is not an object');
  if (value.kind === 'time' && isPositiveInt(value.seconds, 3600) && typeof value.perSide === 'boolean') {
    return { kind: 'time', seconds: value.seconds, perSide: value.perSide };
  }
  if (value.kind === 'reps' && isPositiveInt(value.reps, 100) && typeof value.perSide === 'boolean') {
    return { kind: 'reps', reps: value.reps, perSide: value.perSide };
  }
  if (value.kind === 'ramp' && isPositiveInt(value.reps, 100) && isPositiveInt(value.percentOfWorkingLoad, 99)) {
    return { kind: 'ramp', reps: value.reps, percentOfWorkingLoad: value.percentOfWorkingLoad };
  }
  throw new PreparationProtocolError('preparation dose is invalid');
};

const parseItem = (value: unknown): PreparationItem => {
  if (!isRecord(value)) throw new PreparationProtocolError('preparation item is not an object');
  const stage = value.stage;
  if (typeof stage !== 'string' || !PREPARATION_STAGES.includes(stage as PreparationStage)) {
    throw new PreparationProtocolError('preparation item stage is invalid');
  }
  if (!isText(value.itemId, 80) || !isPositiveInt(value.itemRevision, 1_000_000)
    || !isText(value.title, 200) || !isText(value.instruction, 600) || !isText(value.cue, 120)
    || !isText(value.stopInstruction, 300)
    || !(value.regression === null || isText(value.regression, 300))
    || !(value.movementId === null || isPositiveInt(value.movementId, 1_000_000_000))
    || (value.effort !== 'easy' && value.effort !== 'moderate')
    || !Array.isArray(value.sourceRefs) || value.sourceRefs.length === 0
    || value.sourceRefs.some((ref) => typeof ref !== 'string' || !SOURCE_IDS.has(ref))
    || !isPositiveInt(value.estimateSeconds, 3600)) {
    throw new PreparationProtocolError('preparation item is invalid');
  }
  return {
    itemId: value.itemId,
    itemRevision: value.itemRevision,
    stage: stage as PreparationStage,
    title: value.title,
    instruction: value.instruction,
    cue: value.cue,
    stopInstruction: value.stopInstruction,
    regression: value.regression,
    dose: parseDose(value.dose),
    movementId: value.movementId,
    effort: value.effort,
    sourceRefs: value.sourceRefs as string[],
    estimateSeconds: value.estimateSeconds,
  };
};

/** Parse and validate a frozen protocol. Throws PreparationProtocolError. */
export function parsePreparationProtocol(json: string): PreparationProtocol {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new PreparationProtocolError('preparation protocol is not valid JSON');
  }
  if (!isRecord(value) || value.version !== PREPARATION_PROTOCOL_VERSION) {
    throw new PreparationProtocolError('preparation protocol version is not supported');
  }
  if (!isText(value.policyId, 80) || !isPositiveInt(value.policyRevision, 1_000_000)
    || (value.variant !== 'standard' && value.variant !== 'condensed')
    || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 20
    || !Array.isArray(value.omitted) || value.omitted.length > 40
    || !Array.isArray(value.basis) || value.basis.some((line) => !isText(line, 300))
    || !Array.isArray(value.notes) || value.notes.some((line) => !isText(line, 600))
    || !isRecord(value.estimateSeconds)
    || !isPositiveInt(value.estimateSeconds.low, 7200) || !isPositiveInt(value.estimateSeconds.high, 7200)
    || value.estimateSeconds.low > value.estimateSeconds.high) {
    throw new PreparationProtocolError('preparation protocol is invalid');
  }
  const omitted = value.omitted.map((row): PreparationOmission => {
    if (!isRecord(row) || !isText(row.itemId, 80) || !isText(row.detail, 400)
      || typeof row.reasonCode !== 'string' || !OMISSION_REASONS.has(row.reasonCode)
      || !(row.movementId === null || isPositiveInt(row.movementId, 1_000_000_000))) {
      throw new PreparationProtocolError('preparation omission is invalid');
    }
    return {
      itemId: row.itemId, movementId: row.movementId,
      reasonCode: row.reasonCode as PreparationOmissionReason, detail: row.detail,
    };
  });
  return {
    version: PREPARATION_PROTOCOL_VERSION,
    policyId: value.policyId,
    policyRevision: value.policyRevision,
    variant: value.variant,
    basis: value.basis as string[],
    items: value.items.map(parseItem),
    omitted,
    estimateSeconds: { low: value.estimateSeconds.low, high: value.estimateSeconds.high },
    notes: value.notes as string[],
  };
}

// ---------------------------------------------------------------------------
// Outcomes. The protocol-level outcome is DERIVED from what the athlete did,
// so "completed" can never be claimed over a skipped or changed item.
// ---------------------------------------------------------------------------

export const PREPARATION_STATUSES = [
  'pending', 'in_progress', 'completed', 'modified', 'already_warm', 'skipped', 'stopped',
] as const;
export type PreparationStatus = (typeof PREPARATION_STATUSES)[number];

export const PREPARATION_ITEM_STATUSES = [
  'pending', 'done', 'modified', 'substituted', 'skipped', 'withheld',
] as const;
export type PreparationItemStatus = (typeof PREPARATION_ITEM_STATUSES)[number];

export const isTerminalPreparationStatus = (status: PreparationStatus): boolean =>
  status !== 'pending' && status !== 'in_progress';

/** Did the athlete actually perform something for this item? */
const performed = (status: PreparationItemStatus): boolean =>
  status === 'done' || status === 'modified' || status === 'substituted';

/**
 * The truthful protocol outcome for a set of item states when the athlete
 * says they are finished:
 *   - every item done as prescribed            -> completed
 *   - some work performed, but not all as set  -> modified
 *   - nothing performed                        -> null (the athlete must say
 *     whether they were already warm or are skipping; it is not "completed")
 */
export function resolvePreparationOutcome(
  itemStatuses: readonly PreparationItemStatus[],
): 'completed' | 'modified' | null {
  if (itemStatuses.length === 0) return null;
  if (itemStatuses.every((status) => status === 'done')) return 'completed';
  return itemStatuses.some(performed) ? 'modified' : null;
}

/** The single number a dose asks for (seconds or repetitions, per side where relevant). */
export const prescribedAmount = (dose: PreparationDose): number =>
  dose.kind === 'time' ? dose.seconds : dose.reps;

export const preparationDoseUnit = (dose: PreparationDose): 'seconds' | 'reps' =>
  dose.kind === 'time' ? 'seconds' : 'reps';

/**
 * Work beyond preparation. A performed dose well above the prescribed one is
 * practice volume or extra work, and the app must SHOW it as such rather than
 * leave it hidden inside a warm-up. The threshold is a product rule (one and
 * a half times the prescribed amount), not a physiological claim.
 */
export const EXTRA_WORK_RATIO = 1.5;
export const isExtraPreparationWork = (dose: PreparationDose, performedAmount: number | null): boolean =>
  performedAmount !== null && Number.isFinite(performedAmount)
  && performedAmount > prescribedAmount(dose) * EXTRA_WORK_RATIO;

/** Plain-language dose, e.g. "30 seconds each side" or "6 reps at about 40% of today's working load". */
export function describePreparationDose(dose: PreparationDose): string {
  switch (dose.kind) {
    case 'time': {
      const amount = dose.seconds >= 120 && dose.seconds % 60 === 0
        ? `${dose.seconds / 60} minutes`
        : `${dose.seconds} seconds`;
      return dose.perSide ? `${amount} each side` : amount;
    }
    case 'reps':
      return `${dose.reps} rep${dose.reps === 1 ? '' : 's'}${dose.perSide ? ' each side' : ''}`;
    case 'ramp':
      return `${dose.reps} rep${dose.reps === 1 ? '' : 's'} at about ${dose.percentOfWorkingLoad}% of today's working load`;
  }
}

export const PREPARATION_STATUS_LABEL: Record<PreparationStatus, string> = {
  pending: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed as written',
  modified: 'Completed with changes',
  already_warm: 'Already warm before the session',
  skipped: 'Skipped',
  stopped: 'Stopped',
};
