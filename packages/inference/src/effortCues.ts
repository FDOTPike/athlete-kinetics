/**
 * effortCues.ts — plain-language effort anchors (WO §2.7, W5).
 *
 * A PURE copy formatter for the RPE stepper. The cues are an interpretation
 * aid beside a value the athlete chose — never a second score, never an
 * inferred value, never derived from any sensor or biometric source.
 *
 * Owner-ratified bands (work order §2.7):
 *   5–6     Easy; at least four good reps left
 *   6.5–7   Moderate; about three good reps left
 *   7.5–8   Hard but controlled; about two good reps left
 *   8.5–9   Very hard; about one good rep left
 *   9.5–10  Limit effort; no good reps left; never trade form for the number
 *
 * Reps-in-reserve and form quality are the primary lifting anchors. Breathing
 * or talk cues are secondary and say they vary by exercise and fitness.
 * Pain is not RPE: the stop guidance names pain, dizziness, and loss of
 * control without making a medical diagnosis.
 */

export const EFFORT_STOP_GUIDANCE =
  'Pain, dizziness, or losing control of the movement: stop the set. Pain is not effort — never trade form for the number.';

export const EFFORT_BREATHING_NOTE =
  'Breathing and talk cues vary by exercise and fitness — treat them as rough guides, not targets.';

/** The half-step band table. `lo`/`hi` are inclusive RPE bounds. */
const CUE_BANDS: readonly { lo: number; hi: number; anchor: string }[] = [
  { lo: 5.0, hi: 6.0, anchor: 'Easy; at least four good reps left.' },
  { lo: 6.5, hi: 7.0, anchor: 'Moderate; about three good reps left.' },
  { lo: 7.5, hi: 8.0, anchor: 'Hard but controlled; about two good reps left.' },
  { lo: 8.5, hi: 9.0, anchor: 'Very hard; about one good rep left.' },
  { lo: 9.5, hi: 10.0, anchor: 'Limit effort; no good reps left; never trade form for the number.' },
];

/** Plain-language anchor for an RPE value, or null outside the 5.0–10.0
 *  domain (the caller hides the cue rather than guessing). Deterministic:
 *  every half-step from 5.0 to 10.0 maps to exactly one band. */
export function effortCue(rpe: number): string | null {
  if (!Number.isFinite(rpe)) return null;
  const band = CUE_BANDS.find((b) => rpe >= b.lo && rpe <= b.hi);
  return band?.anchor ?? null;
}
