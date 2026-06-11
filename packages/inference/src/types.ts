/**
 * types.ts — shared inference-layer types, decoupled from any model runtime.
 */

/** Mirrors packages/core-db/src/schema/003_state_vector.sql exactly.
 *  Do not rename fields here without a schema migration. */
export interface StateVectorRow {
  date: string;
  readiness_score: number;
  hrv_component: number;
  load_component: number;
  sleep_component: number;
  spo2_component: number;
  acwr: number | null;
  acute_load_kg: number | null;
  chronic_load_kg: number | null;
  ln_rmssd: number | null;
  hrv_z: number | null;
  sleep_efficiency_pct: number | null;
  spo2_night_mean: number | null;
  computed_at_ms: number;
}

/** Mirrors the movement.pattern CHECK enum in 001_mechanical_input.sql. */
export const MOVEMENT_PATTERNS = [
  'squat', 'hinge', 'push_h', 'push_v', 'pull_h', 'pull_v',
  'lunge', 'carry', 'rotation', 'isolation', 'locomotion',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

// ---------------------------------------------------------------------------
// Athlete profile — mirrors the CHECK constraints in 006_user_profile.sql.
// Field names match column names so the store maps rows 1:1.
// ---------------------------------------------------------------------------
export const OBJECTIVES = [
  'strength', 'hypertrophy', 'power', 'endurance', 'gpp', 'rehab', 'weight_loss',
] as const;
export type Objective = (typeof OBJECTIVES)[number];

export const TRAINING_AGES = ['beginner', 'intermediate', 'advanced', 'elite'] as const;
export type TrainingAge = (typeof TRAINING_AGES)[number];

export const ENERGY_SYSTEMS = ['aerobic', 'anaerobic', 'atp_pc', 'hybrid'] as const;
export type EnergySystem = (typeof ENERGY_SYSTEMS)[number];

export const PROGRESSION_METHODS = [
  'linear', 'undulating', 'conjugate', 'autoregulated',
] as const;
export type ProgressionMethod = (typeof PROGRESSION_METHODS)[number];

export const EQUIPMENT_ACCESS = ['full_gym', 'home_basic', 'minimal'] as const;
export type EquipmentAccess = (typeof EQUIPMENT_ACCESS)[number];

/** One historical-injury or mobility-limit note (stored as JSON in 006). */
export interface BodyNote {
  region: string;
  note: string;
}

export interface UserProfile {
  objective: Objective;
  training_age: TrainingAge;
  weekly_frequency: number;          // 1..7
  max_sessions_per_day: number;      // 1..3
  session_duration_cap_min: number;  // 15..240
  base_rpe_cap: number;              // 5.0..10.0, 0.5 steps
  target_energy_system: EnergySystem;
  progression_methodology: ProgressionMethod;
  injury_flags: BodyNote[];
  mobility_limits: BodyNote[];
  equipment_access: EquipmentAccess;
}

/** Mirrors the SQL column defaults — a fresh install is safe pre-questionnaire. */
export const DEFAULT_PROFILE: UserProfile = Object.freeze({
  objective: 'gpp',
  training_age: 'intermediate',
  weekly_frequency: 4,
  max_sessions_per_day: 1,
  session_duration_cap_min: 90,
  base_rpe_cap: 9.0,
  target_energy_system: 'hybrid',
  progression_methodology: 'autoregulated',
  injury_flags: [],
  mobility_limits: [],
  equipment_access: 'full_gym',
});
