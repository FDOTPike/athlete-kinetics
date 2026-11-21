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

/** The method in the same words as the Fine-tune chips, lower-cased for a sentence. */
const METHOD_WORD: Record<SchemaType, string> = {
  LINEAR: 'linear', WAVE: 'undulating', STEP: 'step loading', APRE: 'autoregulated',
};

export interface ProgramChoices {
  buildMode: 'coach' | 'custom';
  schemaType: SchemaType;
  horizonKind: 'weeks' | 'date';
  blockCount: number;
  /** The review date as typed; only read when horizonKind is 'date'. */
  reviewDate?: string;
}

/**
 * Android issue #222: the top box on the build screen used to be a fixed
 * sentence about the defaults, so it kept saying "linear" and "12 weeks" after
 * the athlete chose otherwise. It is built from the screen's current choices;
 * with nothing changed it is exactly the recommended-defaults sentence.
 */
export const programChoiceDisclosure = (choices: ProgramChoices): string => {
  const who = choices.buildMode === 'custom' ? 'You pick the movements' : 'Coach picks the movements';
  const method = METHOD_WORD[choices.schemaType];
  const article = /^[aeiou]/.test(method) ? 'an' : 'a';
  const date = choices.reviewDate?.trim() ?? '';
  const review = choices.horizonKind === 'date'
    ? (date === ''
      ? 'with a review around the date you enter (rounded up to whole four-week blocks)'
      : `with a review around ${date} (rounded up to whole four-week blocks)`)
    : `with a review after ${choices.blockCount * 4} weeks (${choices.blockCount} four-week block${choices.blockCount === 1 ? '' : 's'})`;
  return `${who}, on ${article} ${method} progression, ${review}. Change any of it below.`;
};

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
    disclosure: programChoiceDisclosure({ buildMode: 'coach', schemaType, horizonKind: 'weeks', blockCount }),
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
