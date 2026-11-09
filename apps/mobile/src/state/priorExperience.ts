/**
 * priorExperience — the athlete's own "I have trained this before"
 * declarations (#217), as pure helpers shared by the store and the screens.
 *
 * A declaration is a local statement about the athlete's history. It can clear
 * only an ordinary capability gap, and only where the shared resolver already
 * allows a declaration; tier, equipment, safety and attestation stay hard
 * gates. Training age alone never writes one.
 */
import type { MovementAvailability } from '@ak/inference';

/**
 * The one test for "a declaration would make this movement available". Every
 * place that offers or writes a declaration uses it, so a declaration made in
 * onboarding unlocks exactly what the Library's chip unlocks.
 */
export const priorExperienceWouldClear = (verdict: MovementAvailability | undefined): boolean =>
  verdict !== undefined
  && verdict.state === 'teaching_only'
  && verdict.confirmationWouldClear
  && !verdict.separateAttestationRequired
  && verdict.reasons.length === 1
  && verdict.reasons[0] === 'capability';

/** What an athlete can declare for a given profile, in the weight room. */
export interface PriorExperienceDeclarationOptions {
  /** Competition lifts (squat, bench, deadlift) a declaration would make available. */
  readonly anchors: readonly { readonly movementId: number; readonly name: string }[];
  /** Beginner-difficulty movements one "basics" declaration would make available. */
  readonly basicMovementIds: readonly number[];
}

const ANCHOR_DISPLAY_NAME: Readonly<Record<string, string>> = {
  'Competition Squat': 'Back squat (competition squat)',
  'Competition Bench': 'Bench press (competition bench)',
};

/** The competition lifts in plain words ("Competition Squat" is an ordinary
 *  back squat). Display only; the library names are unchanged. */
export const anchorDisplayName = (name: string): string => ANCHOR_DISPLAY_NAME[name] ?? name;
