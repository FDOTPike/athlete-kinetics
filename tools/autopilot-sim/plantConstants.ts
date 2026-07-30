/**
 * Banister two-factor fitness-fatigue plant used only by the offline
 * Kinematic Autopilot stability simulation.
 *
 * Model provenance:
 * - Calvert, Banister, Savage & Bach (1976), DOI 10.1109/TSMC.1976.5409179.
 * - Busso (2003), DOI 10.1249/01.MSS.0000074465.13621.37.
 *
 * The papers support the antagonistic first-order fitness/fatigue structure.
 * They do not validate these strength-training/RPE constants. Every numeric
 * value below is therefore an explicit simulation choice to sweep, not a
 * tuned athlete truth.
 */

export interface BanisterPlantParams {
  /** Fatigue decay time constant, in days. */
  TAU_FAT: number;
  /** Fitness decay time constant, in days. */
  TAU_FIT: number;
  /** Fatigue accumulated per normalized daily dose. */
  K_FAT: number;
  /** Fitness accumulated per normalized daily dose. */
  K_FIT: number;
  /** Maps one capacity-unit deficit to observed delta-RPE. */
  RPE_GAIN: number;
  /** Standard deviation of per-session RPE noise. */
  SIGMA_RPE: number;
  /** Zero-state capacity on the same 1–10 scale as target RPE. */
  BASE_CAPACITY_RPE: number;
}

/**
 * A generated slot contributes:
 *
 *   slotDose = (sets / REFERENCE_SETS_PER_SLOT) * (targetRpe / RPE_SCALE_MAX)
 *
 * Daily per-pattern dose is the sum of its generated slots for that date.
 * This makes the shipped dSet and dRpe corrections reach the plant while
 * keeping an ordinary 4-set @ RPE 7.5 slot near Neo's 0.75 dose scale.
 */
export const PLANT_SCALE = {
  REFERENCE_SETS_PER_SLOT: 4,
  RPE_SCALE_MAX: 10,
  RPE_MIN: 1,
  RPE_MAX: 10,
} as const;

const STABLE_PLANT_PARAMS = {
  TAU_FAT: 14,
  TAU_FIT: 45,
  K_FAT: 0.5,
  K_FIT: 0.12,
  RPE_GAIN: 3,
  SIGMA_RPE: 0.5,
  BASE_CAPACITY_RPE: 7.5,
} as const satisfies BanisterPlantParams;

export const BANISTER_BASELINE: Readonly<BanisterPlantParams> = STABLE_PLANT_PARAMS;

export const BANISTER_ARCHETYPES = {
  stable: STABLE_PLANT_PARAMS,
  overreach: {
    TAU_FAT: 10,
    TAU_FIT: 50,
    K_FAT: 0.8,
    K_FIT: 0.1,
    RPE_GAIN: 4.5,
    SIGMA_RPE: 0.7,
    BASE_CAPACITY_RPE: 7.5,
  },
  adapting: {
    TAU_FAT: 18,
    TAU_FIT: 40,
    K_FAT: 0.4,
    K_FIT: 0.18,
    RPE_GAIN: 2.5,
    SIGMA_RPE: 0.4,
    BASE_CAPACITY_RPE: 7.5,
  },
} as const satisfies Record<string, BanisterPlantParams>;

export interface BanisterInitialStateOffset {
  /** Additive offset to the zero-state fitness accumulator. */
  fitness: number;
  /** Additive offset to the zero-state fatigue accumulator. */
  fatigue: number;
}

/**
 * C1-audit initial-condition family. BASE_CAPACITY_RPE remains the fixed
 * definition of the zero-state neutral point; these states test attraction
 * from a capacity deficit and from supercompensation.
 */
export const INITIAL_STATE_OFFSETS = {
  neutral: { fitness: 0, fatigue: 0 },
  mid_deficit: { fitness: 0, fatigue: 0.75 },
  mid_supercompensation: { fitness: 0.75, fatigue: 0 },
} as const satisfies Record<string, BanisterInitialStateOffset>;

/**
 * C1 primary envelope. The C2 derivation determines the dense RPE_GAIN grid
 * inside this envelope; no sweep is authorized before C1/C2 ratification.
 */
export const PRIMARY_SWEEP_ENVELOPE = {
  TAU_FAT: { min: 7, baseline: 14, max: 21, unit: 'days' },
  TAU_FIT: { min: 30, baseline: 45, max: 60, unit: 'days' },
  K_FAT: { min: 0.3, baseline: 0.5, max: 1, unit: 'capacity/dose' },
  K_FIT: { min: 0.05, baseline: 0.12, max: 0.2, unit: 'capacity/dose' },
  RPE_GAIN: { min: 0.25, baseline: 3, max: 6, unit: 'delta-RPE/capacity' },
  SIGMA_RPE: { min: 0, baseline: 0.5, max: 1, unit: 'RPE' },
} as const;
