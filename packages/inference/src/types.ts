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
