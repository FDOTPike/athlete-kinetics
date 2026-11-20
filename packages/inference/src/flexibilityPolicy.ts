/**
 * flexibilityPolicy.ts — regional flexibility packs and their placement
 * (WO-03B).
 *
 * The five packs are regional, not sport-specific. Dose is two 45-second
 * static holds or two sets of eight controlled dynamic reps at RPE 6 or less.
 * Static work within 60 minutes of a heavy strength, hypertrophy or power
 * session is blocked, not merely discouraged: the reviewed evidence does not
 * support long static holds immediately before maximal work.
 *
 * Author: deepseek-v4.1-flash-1017 via Hermes
 */

export const FLEXIBILITY_PACK_IDS = [
  'hips_hamstrings',
  'thoracic_shoulders',
  'ankles_calves',
  'wrists_forearms',
  'full_body_recovery',
] as const;
export type FlexibilityPackId = (typeof FLEXIBILITY_PACK_IDS)[number];

export interface FlexibilityPack {
  readonly id: FlexibilityPackId;
  readonly label: string;
  readonly muscles: readonly string[];
  /** v13 template this pack replaces or extends, when one exists. */
  readonly v13TemplateId: string | null;
}

export const FLEXIBILITY_PACKS: readonly FlexibilityPack[] = [
  { id: 'hips_hamstrings', label: 'Hips and hamstrings', muscles: ['hamstrings', 'glutes'], v13TemplateId: 'hips_lower_body' },
  { id: 'thoracic_shoulders', label: 'Thoracic spine and shoulders', muscles: ['upper_back', 'rear_shoulders'], v13TemplateId: 'thoracic_shoulders' },
  { id: 'ankles_calves', label: 'Ankles and calves', muscles: ['calves'], v13TemplateId: 'ankles_calves' },
  { id: 'wrists_forearms', label: 'Wrists and forearms', muscles: ['forearms'], v13TemplateId: 'wrists_forearms' },
  { id: 'full_body_recovery', label: 'Full-body recovery', muscles: ['hamstrings', 'glutes', 'upper_back', 'calves'], v13TemplateId: 'full_body_recovery' },
];

export const FLEXIBILITY_DOSE = {
  staticHoldSeconds: 45,
  staticSets: 2,
  dynamicReps: 8,
  dynamicSets: 2,
  rpeCeiling: 6,
} as const;

/** Static holds must be at least this far from a heavy session. */
export const MIN_MINUTES_BEFORE_HEAVY_SESSION = 60;

/** A pack's own duration: two 45 s holds per side plus setup and transitions. */
export const FLEXIBILITY_PACK_MINUTES = 5;

export const HEAVY_SESSION_KINDS = ['strength', 'hypertrophy', 'power'] as const;
export type SessionKind = (typeof HEAVY_SESSION_KINDS)[number] | 'recovery' | 'skill' | 'endurance';

export type FlexibilityPlacement = 'pre_session' | 'post_session' | 'standalone' | 'blocked';

export interface FlexibilityPlacementResult {
  readonly placement: FlexibilityPlacement;
  readonly reason: string;
}

const isHeavy = (kind: SessionKind): kind is (typeof HEAVY_SESSION_KINDS)[number] =>
  (HEAVY_SESSION_KINDS as readonly string[]).includes(kind);

export const flexibilityPlacementFor = (input: {
  readonly packId: FlexibilityPackId;
  readonly sessionKind: SessionKind;
  /** Minutes until the next heavy session; null when there is none today. */
  readonly minutesUntilHeavy: number | null;
}): FlexibilityPlacementResult => {
  // CONFLICT DISCLOSED: WO_03_PROPOSAL v13 says pre-session work is dynamic
  // mobility only and forbids static holds before a session; WO-05C sets a
  // 60-minute guard instead. This implements WO-05C (the later instruction)
  // and leaves the stricter v13 rule as an owner decision.
  // The guard follows the NEXT heavy session, not today's label: a skill or
  // endurance day can still sit inside 60 minutes of a heavy session.
  if (
    input.minutesUntilHeavy !== null
    && input.minutesUntilHeavy - FLEXIBILITY_PACK_MINUTES < MIN_MINUTES_BEFORE_HEAVY_SESSION
  ) {
    return {
      placement: 'blocked',
      reason: `The pack must FINISH at least ${MIN_MINUTES_BEFORE_HEAVY_SESSION} minutes before the heavy session; move it after the session or to another day.`,
    };
  }
  if (input.sessionKind === 'recovery') {
    return { placement: 'standalone', reason: 'A recovery day carries the pack as its own session.' };
  }
  if (input.minutesUntilHeavy !== null) {
    return { placement: 'pre_session', reason: `At least ${MIN_MINUTES_BEFORE_HEAVY_SESSION} minutes separate the pack from the heavy session (WO-05C rule; v13 would forbid static holds before any session).` };
  }
  return { placement: 'post_session', reason: 'No heavy session follows, so the pack runs after training.' };
};
// S5FIX
