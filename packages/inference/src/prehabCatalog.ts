/**
 * prehabCatalog.ts — optional tendon and joint care (WO-03A).
 *
 * Seven target areas. Each binds movements that exist in the shipped library
 * (movement ids 1-300) and records, in `catalogGap`, what the library does not
 * carry. No movement is invented and no id outside the catalog is cited.
 *
 * This is not a diagnosis and not a physical-therapy prescription. The stop
 * rule below is one sentence, repeated verbatim on every target.
 *
 * Author: deepseek-v4.1-flash-1017 via Hermes
 */

export const PREHAB_DISCLAIMER =
  'Optional tendon and joint care — not a medical diagnosis or physical therapy prescription. Stop immediately if you feel sharp pain, numbness, tingling, or radiating symptoms.';

/** One predicate, repeated verbatim: the ceiling, the rise, sharpness and
 *  next-day persistence are a single rule, never paraphrased per exercise. */
export const PREHAB_STOP_RULE =
  "Start at or below 3/10. Stop the set if pain rises above 3/10 at any rep, increases from the previous set, " +
  "sharpens, or is still there the next day. This is not a diagnosis and does not replace a clinician's advice.";

export const PREHAB_TARGET_IDS = [
  'elbow_tendon',
  'shoulder_cuff',
  'knee_patellar',
  'achilles_calf',
  'hip_groin',
  'low_back_core',
  'wrist_forearm',
] as const;
export type PrehabTargetId = (typeof PREHAB_TARGET_IDS)[number];

export interface PrehabMovement {
  readonly movementId: number;
  readonly name: string;
  readonly role: 'isometric' | 'slow_eccentric' | 'optional';
}

export interface PrehabTarget {
  readonly id: PrehabTargetId;
  /** The WO-03 v13 target this one covers, or null when the id is new. */
  readonly v13TargetId: string | null;
  /** Every v13 target this entry covers (elbow_tendon covers lateral and medial). */
  readonly coversV13: readonly string[];
  readonly joints: readonly string[];
  readonly muscles: readonly string[];
  readonly isometricDose: string;
  readonly eccentricDose: string;
  readonly movements: readonly PrehabMovement[];
  /** What the shipped library does not carry for this target. */
  readonly catalogGap: string | null;
  readonly stopRule: string;
}

const COPENHAGEN_GAP =
  'The library has no Copenhagen adduction or side-lying adduction movement, so the adductor programme is a ' +
  'catalogue gap and no substitute is bound to it.';

export const PREHAB_TARGETS: readonly PrehabTarget[] = [
  {
    id: 'elbow_tendon',
    v13TargetId: 'elbow_lateral',
    coversV13: ['elbow_lateral', 'elbow_medial'],
    joints: ['elbow', 'wrist'],
    muscles: ['forearms'],
    isometricDose: '3-5 x 30-45 s at moderate effort; stay at or below 3/10',
    eccentricDose: '3 x 12-15 reps, 3 s lowering; stay at or below 3/10',
    movements: [
      { movementId: 268, name: 'Seated Dumbbell Palms-Down Wrist Curl', role: 'slow_eccentric' },
      { movementId: 269, name: 'Seated Dumbbell Palms-Up Wrist Curl', role: 'slow_eccentric' },
      { movementId: 164, name: 'Cable Wrist Curl', role: 'slow_eccentric' },
    ],
    catalogGap: null,
    stopRule: PREHAB_STOP_RULE,
  },
  {
    id: 'shoulder_cuff',
    v13TargetId: 'shoulder_rotator_cuff',
    coversV13: ['shoulder_rotator_cuff'],
    joints: ['shoulder'],
    muscles: ['rear_shoulders'],
    isometricDose: '3 x 30 s hold at moderate effort; stay at or below 3/10',
    eccentricDose: '3 x 12 slow external rotations; stay at or below 3/10',
    movements: [
      { movementId: 32, name: 'Band External Rotation', role: 'slow_eccentric' },
      { movementId: 198, name: 'External Rotation with Cable', role: 'slow_eccentric' },
      { movementId: 59, name: 'Face Pull', role: 'optional' },
    ],
    catalogGap: null,
    stopRule: PREHAB_STOP_RULE,
  },
  {
    id: 'knee_patellar',
    v13TargetId: 'knee_patellar',
    coversV13: ['knee_patellar'],
    joints: ['knee'],
    muscles: ['quadriceps'],
    isometricDose: '5 x 45 s at 70% effort; stay at or below 3/10',
    eccentricDose: '4 x 15 reps at 15RM, 3 s lowering, progressing to 6RM; stay at or below 3/10',
    movements: [
      { movementId: 1, name: 'Competition Squat', role: 'slow_eccentric' },
      { movementId: 28, name: 'Bodyweight Squat', role: 'slow_eccentric' },
    ],
    catalogGap:
      'The library has no leg-extension or Spanish-squat movement; the squat variants above are the available anchors ' +
      'and carry the slow lowering only when the prescription gives them a tempo.',
    stopRule: PREHAB_STOP_RULE,
  },
  {
    id: 'achilles_calf',
    v13TargetId: 'ankle_achilles',
    coversV13: ['ankle_achilles'],
    joints: ['ankle'],
    muscles: ['calves'],
    isometricDose: '5 x 45 s at moderate effort; stay at or below 3/10',
    eccentricDose: '3 x 15 reps, 3 s lowering, straight knee; seated variant for soleus; stay at or below 3/10',
    movements: [
      { movementId: 96, name: 'Standing Barbell Calf Raise', role: 'slow_eccentric' },
      { movementId: 76, name: 'Standing Dumbbell Calf Raise', role: 'slow_eccentric' },
      { movementId: 111, name: 'Barbell Seated Calf Raise', role: 'slow_eccentric' },
    ],
    catalogGap: null,
    stopRule: PREHAB_STOP_RULE,
  },
  {
    id: 'hip_groin',
    v13TargetId: 'hip_groin',
    coversV13: ['hip_groin'],
    joints: ['hip'],
    muscles: [],
    isometricDose: '3 x 30-45 s adductor squeeze at moderate effort; stay at or below 3/10',
    eccentricDose: '2-3 x 8-12 Copenhagen adduction reps per side',
    movements: [],
    catalogGap: COPENHAGEN_GAP,
    stopRule: PREHAB_STOP_RULE,
  },
  {
    id: 'low_back_core',
    v13TargetId: 'lower_back_trunk',
    coversV13: ['lower_back_trunk'],
    joints: ['lower_back'],
    muscles: ['lower_back'],
    isometricDose: '3 x 20-30 s per position; stay at or below 3/10',
    eccentricDose: 'not applicable — endurance holds, no eccentric',
    movements: [
      { movementId: 26, name: 'Plank', role: 'isometric' },
      { movementId: 44, name: 'Dead Bug', role: 'isometric' },
      { movementId: 25, name: 'Pallof Press', role: 'isometric' },
    ],
    catalogGap: null,
    stopRule: PREHAB_STOP_RULE,
  },
  {
    id: 'wrist_forearm',
    v13TargetId: null,
    coversV13: [],
    joints: ['wrist'],
    muscles: ['forearms'],
    isometricDose: '3 x 30 s hold at moderate effort; stay at or below 3/10',
    eccentricDose: '3 x 12-15 reps, 3 s lowering; stay at or below 3/10',
    movements: [
      { movementId: 268, name: 'Seated Dumbbell Palms-Down Wrist Curl', role: 'slow_eccentric' },
      { movementId: 269, name: 'Seated Dumbbell Palms-Up Wrist Curl', role: 'slow_eccentric' },
      { movementId: 164, name: 'Cable Wrist Curl', role: 'slow_eccentric' },
    ],
    catalogGap: null,
    stopRule: PREHAB_STOP_RULE,
  },
];

const BY_ID: ReadonlyMap<PrehabTargetId, PrehabTarget> =
  new Map(PREHAB_TARGETS.map((target) => [target.id, target]));

export const isPrehabTargetId = (value: unknown): value is PrehabTargetId =>
  typeof value === 'string' && BY_ID.has(value as PrehabTargetId);

export const prehabTargetFor = (id: PrehabTargetId): PrehabTarget => {
  const target = BY_ID.get(id);
  if (!target) throw new Error(`unknown prehab target: ${id}`);
  return target;
};

/** A target that carries a gap must never present its plan as complete:
 *  no movements = gap, movements beside a stated gap = partial. */
export const prehabCoverage = (id: PrehabTargetId): 'bound' | 'partial' | 'gap' => {
  const target = prehabTargetFor(id);
  if (target.movements.length === 0) return 'gap';
  return target.catalogGap ? 'partial' : 'bound';
};
// S5FIX
