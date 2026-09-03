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

// ---------------------------------------------------------------------------
// WO §2.2, §7.3 W2 & CANONICAL_CONTRACT §1 — Pure Effort Interpretation (RIR)
// ---------------------------------------------------------------------------

export const RIR_CHOICES = ['0', '1', '2', '3', '4+'] as const;
export type RirChoice = typeof RIR_CHOICES[number];
export type EffortAnswer = RirChoice | 'Not sure';

export interface RirOption {
  readonly choice: EffortAnswer;
  readonly label: string;
  readonly meaning: string;
  readonly rpe: number | null;
}

/**
 * Pure, deterministic mapping from athlete RIR/effort choice to actual RPE (§2.2).
 *
 * '0'        -> 10.0 ('No more clean reps')
 * '1'        -> 9.0  ('About one clean rep left')
 * '2'        -> 8.0  ('About two clean reps left')
 * '3'        -> 7.0  ('About three clean reps left')
 * '4+'       -> 6.0  ('At least four clean reps left')
 * 'Not sure' -> null ('Athlete cannot give a reliable answer')
 * Out-of-domain / malformed -> null (strict fail-safe)
 */
export function mapRirToRpe(choice?: unknown): number | null {
  switch (choice) {
    case '0':
      return 10.0;
    case '1':
      return 9.0;
    case '2':
      return 8.0;
    case '3':
      return 7.0;
    case '4+':
      return 6.0;
    case 'Not sure':
      return null;
    default:
      return null;
  }
}

export const RIR_OPTIONS: readonly RirOption[] = [
  {
    choice: '0',
    label: '0',
    meaning: 'No more clean reps',
    rpe: 10.0,
  },
  {
    choice: '1',
    label: '1',
    meaning: 'About one clean rep left',
    rpe: 9.0,
  },
  {
    choice: '2',
    label: '2',
    meaning: 'About two clean reps left',
    rpe: 8.0,
  },
  {
    choice: '3',
    label: '3',
    meaning: 'About three clean reps left',
    rpe: 7.0,
  },
  {
    choice: '4+',
    label: '4+',
    meaning: 'At least four clean reps left',
    rpe: 6.0,
  },
  {
    choice: 'Not sure',
    label: 'Not sure',
    meaning: 'Athlete cannot give a reliable answer',
    rpe: null,
  },
];
