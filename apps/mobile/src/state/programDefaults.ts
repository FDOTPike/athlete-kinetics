/**
 * programDefaults.ts — the coach's opening recommendation (Astra UX Phase 1, W2).
 *
 * WHY THIS EXISTS
 * ---------------
 * Work order §3.2 keeps only the inputs needed to generate a defensible first
 * program in the REQUIRED path — goal, experience, availability, equipment,
 * limitations — and moves review horizon, training method and movement
 * selection into optional/advanced setup "unless the engine genuinely cannot
 * produce a program without them".
 *
 * The engine can. `previewTrainingProgram` needs a complete
 * `TrainingProgramInput`, but every field it needs either follows from an
 * answer the athlete has already given or has a safe, disclosed default. What
 * blocked the first run was not the engine — it was a form that refused to
 * submit until four programming decisions were made by hand.
 *
 * WHY IT LIVES IN THE APP AND NOT IN @ak/inference
 * -----------------------------------------------
 * These are UI defaults, not training policy. They select among options the
 * athlete could already have selected, they change no dose, no progression and
 * no ranking, and they are all editable before creation and after it. §2
 * defers training-engine changes to Phase 2, so nothing under packages/ is
 * touched by this file.
 *
 * IT DELIBERATELY DOES NOT READ `progression_methodology`
 * ------------------------------------------------------
 * `athlete_profile.progression_methodology` is a stored, typed, hydrated column
 * that no planner reads — a second vocabulary competing with `schemaType`,
 * tracked as OW-008 and explicitly out of scope for this branch. Wiring it in
 * here would resolve OW-008 as a side effect of a UI change, which is exactly
 * the kind of quiet scope absorption the work order forbids.
 */
import type { SchemaType, UserProfile } from '@ak/inference';

export interface RecommendedProgramDefaults {
  horizonKind: 'weeks';
  /** Whole 4-week blocks before the review checkpoint. */
  blockCount: number;
  schemaType: SchemaType;
  buildMode: 'coach';
  /** Athlete-facing sentence disclosing every default above. */
  disclosure: string;
}

/** Blocks are whole 4-week units, so the horizon is stated in blocks. */
export const RECOMMENDED_BLOCK_COUNT = 3;

/**
 * LINEAR for every athlete, deliberately.
 *
 * The screen already recommended Linear to beginners in as many words — "one
 * clear progression is easiest to learn and review" — and that reasoning is not
 * specific to beginners on a FIRST program, where there is no training history
 * for this app to have observed. The alternative would have been a
 * training-age-to-schema mapping (say, undulating for advanced athletes), and
 * nobody has ratified one. Inventing a periodization policy inside a navigation
 * work order is precisely the silent program-quality change §1 prohibits.
 *
 * The athlete can pick any selectable method before creating the program, and
 * the recommendation is disclosed rather than applied quietly.
 */
export const recommendedSchemaType = (_profile: UserProfile): SchemaType => 'LINEAR';

export const recommendedProgramDefaults = (
  profile: UserProfile,
): RecommendedProgramDefaults => {
  const blockCount = RECOMMENDED_BLOCK_COUNT;
  const schemaType = recommendedSchemaType(profile);
  return {
    horizonKind: 'weeks',
    blockCount,
    schemaType,
    buildMode: 'coach',
    disclosure: `Coach picks the movements, on a linear progression, with a review after ${blockCount * 4} weeks (${blockCount} four-week blocks). Change any of it below.`,
  };
};

/**
 * Days come from the weekly frequency the athlete ALREADY gave during
 * onboarding ("TRAINING DAYS PER WEEK"). Asking again under the heading
 * "Training days" is the same fact under different terminology, which §3.2
 * forbids — so the schedule is pre-filled from that answer and the control
 * moves into the optional area for anyone who wants to move a day.
 */
export const daysComeFromOnboarding = (profile: UserProfile): number =>
  profile.weekly_frequency;
