-- =============================================================================
-- 004_state_vector_materialize.sql
-- Daily upsert of the State Vector. Idempotent; run by stateVectorDao.ts:
--   * after the nightly telemetry sync,
--   * after a session is closed (load changed),
--   * on app foreground if today's row is missing/stale.
--
-- Bind ?1 = target date 'YYYY-MM-DD'. (op-sqlite: db.execute(sql, [date]))
--
-- Scoring model (all components clamped to 0-100, 50 = neutral/no-data):
--   hrv_component   = 50 + 25 * z(ln rMSSD vs 28d baseline)
--   load_component  = plateau at 100 for ACWR in the 0.8-1.3 sweet spot,
--                     linear penalty below (detraining) and above (spike;
--                     penalized steeper, 200/unit vs 125/unit)
--   sleep_component = sleep efficiency mapped from 65% -> 0 to 95% -> 100
--   spo2_component  = nightly mean mapped from 90% -> 0 to 97% -> 100
--   readiness       = 0.35*hrv + 0.30*load + 0.25*sleep + 0.10*spo2
-- =============================================================================

WITH feat AS (
  SELECT
    date, acwr, acute_load_kg, chronic_load_kg, ln_rmssd,
    sleep_efficiency_pct, spo2_night_mean,
    CASE WHEN ln_rmssd IS NOT NULL AND hrv_baseline_sd IS NOT NULL
         THEN (ln_rmssd - hrv_baseline_mean) / hrv_baseline_sd
         END AS hrv_z
  FROM v_readiness_inputs
  WHERE date = ?1
),
scored AS (
  SELECT
    date, acwr, acute_load_kg, chronic_load_kg, ln_rmssd, hrv_z,
    sleep_efficiency_pct, spo2_night_mean,
    COALESCE(max(0.0, min(100.0, 50.0 + 25.0 * hrv_z)), 50.0)
      AS hrv_component,
    CASE
      WHEN acwr IS NULL  THEN 50.0
      WHEN acwr <  0.8   THEN max(0.0, 100.0 - (0.8 - acwr) * 125.0)
      WHEN acwr <= 1.3   THEN 100.0
      ELSE                    max(0.0, 100.0 - (acwr - 1.3) * 200.0)
    END
      AS load_component,
    COALESCE(max(0.0, min(100.0, (sleep_efficiency_pct - 65.0) * (100.0 / 30.0))), 50.0)
      AS sleep_component,
    COALESCE(max(0.0, min(100.0, (spo2_night_mean - 90.0) * (100.0 / 7.0))), 50.0)
      AS spo2_component
  FROM feat
)
INSERT INTO state_vector (
  date, readiness_score,
  hrv_component, load_component, sleep_component, spo2_component,
  acwr, acute_load_kg, chronic_load_kg, ln_rmssd, hrv_z,
  sleep_efficiency_pct, spo2_night_mean, computed_at_ms
)
SELECT
  date,
  round(0.35 * hrv_component
      + 0.30 * load_component
      + 0.25 * sleep_component
      + 0.10 * spo2_component, 1),
  hrv_component, load_component, sleep_component, spo2_component,
  acwr, acute_load_kg, chronic_load_kg, ln_rmssd, hrv_z,
  sleep_efficiency_pct, spo2_night_mean,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM scored
WHERE date IS NOT NULL          -- also disambiguates the upsert parse
ON CONFLICT (date) DO UPDATE SET
  readiness_score      = excluded.readiness_score,
  hrv_component        = excluded.hrv_component,
  load_component       = excluded.load_component,
  sleep_component      = excluded.sleep_component,
  spo2_component       = excluded.spo2_component,
  acwr                 = excluded.acwr,
  acute_load_kg        = excluded.acute_load_kg,
  chronic_load_kg      = excluded.chronic_load_kg,
  ln_rmssd             = excluded.ln_rmssd,
  hrv_z                = excluded.hrv_z,
  sleep_efficiency_pct = excluded.sleep_efficiency_pct,
  spo2_night_mean      = excluded.spo2_night_mean,
  computed_at_ms       = excluded.computed_at_ms;

-- SLM read paths (for reference — these are the ONLY queries inference runs):
--   Today:    SELECT * FROM state_vector WHERE date = ?1;
--   Trend:    SELECT * FROM state_vector WHERE date >= date(?1, '-13 days')
--             ORDER BY date;  -- one clustered range scan, <= 14 rows
