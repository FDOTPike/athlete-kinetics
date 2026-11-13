-- =============================================================================
-- 078_kinestrike_telemetry.sql
--
-- Additive KineStrike plantar/IMU daily telemetry side-car (WO-KS-BRIDGE-02).
--
-- Append-only side-car keyed by local calendar date (matching resting_hr_daily
-- in 069 and state_vector in 003):
--   * Leaves state_vector (003) and 004_state_vector_materialize.sql untouched,
--     so readiness materialization never overwrites plantar telemetry and no
--     prescription or autopilot path reads these descriptive columns.
--   * Every KineStrike measurement column is nullable and domain-checked.
--   * Idempotent (CREATE TABLE IF NOT EXISTS) for production self-heal replay.
-- =============================================================================

CREATE TABLE IF NOT EXISTS state_vector_kinestrike (
  date                  TEXT PRIMARY KEY
                        CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  ks_foot               TEXT CHECK (ks_foot IN ('L', 'R', 'BOTH', 'UNKNOWN') OR ks_foot IS NULL),
  ks_strike_count       INTEGER CHECK (ks_strike_count IS NULL OR ks_strike_count >= 0),
  ks_gct_mean_ms        REAL CHECK (ks_gct_mean_ms IS NULL OR ks_gct_mean_ms >= 0),
  ks_gct_delta_pct      REAL,
  ks_peak_load_mean     REAL CHECK (ks_peak_load_mean IS NULL OR ks_peak_load_mean >= 0),
  ks_peak_load_cv       REAL CHECK (ks_peak_load_cv IS NULL OR ks_peak_load_cv >= 0),
  ks_heel_share_mean    REAL CHECK (ks_heel_share_mean IS NULL OR (ks_heel_share_mean >= 0 AND ks_heel_share_mean <= 1.001)),
  ks_medial_share_mean  REAL CHECK (ks_medial_share_mean IS NULL OR (ks_medial_share_mean >= 0 AND ks_medial_share_mean <= 1.001)),
  ks_lateral_share_mean REAL CHECK (ks_lateral_share_mean IS NULL OR (ks_lateral_share_mean >= 0 AND ks_lateral_share_mean <= 1.001)),
  ks_toe_share_mean     REAL CHECK (ks_toe_share_mean IS NULL OR (ks_toe_share_mean >= 0 AND ks_toe_share_mean <= 1.001)),
  ks_cop_x_mean         REAL CHECK (ks_cop_x_mean IS NULL OR (ks_cop_x_mean >= -1.001 AND ks_cop_x_mean <= 1.001)),
  ks_impact_peak_g_max  REAL CHECK (ks_impact_peak_g_max IS NULL OR ks_impact_peak_g_max >= 0),
  ks_cod_count          INTEGER CHECK (ks_cod_count IS NULL OR ks_cod_count >= 0),
  ks_fall_warning_count INTEGER CHECK (ks_fall_warning_count IS NULL OR ks_fall_warning_count >= 0),
  ks_fall_last_state    TEXT CHECK (ks_fall_last_state IS NULL OR ks_fall_last_state IN ('IDLE', 'IMPACT_ARMED', 'TILT_UNLOADED', 'FALL_WARNING', 'RECOVERED', 'FAULT_RESET'))
) STRICT, WITHOUT ROWID;
