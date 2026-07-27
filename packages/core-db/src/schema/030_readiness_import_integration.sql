-- =============================================================================
-- 030_readiness_import_integration.sql
-- Readiness consumes only a compact, explicitly eligible imported-load rollup.
-- No state-vector materialization path scans history_import_set.
-- =============================================================================

DROP VIEW IF EXISTS v_readiness_inputs;
CREATE VIEW v_readiness_inputs AS
WITH daily_load AS (
  SELECT date, SUM(tonnage_kg) AS tonnage_kg
  FROM (
    SELECT date, tonnage_kg FROM mech_daily
    UNION ALL
    SELECT date, tonnage_kg FROM import_readiness_daily
  )
  GROUP BY date
),
days AS (
  SELECT date FROM daily_load
  UNION SELECT date FROM hrv_daily
  UNION SELECT date FROM sleep_daily
  UNION SELECT date FROM spo2_daily
),
joined AS (
  SELECT
    d.date,
    julianday(d.date) AS jd,
    COALESCE(l.tonnage_kg, 0.0) AS tonnage_kg,
    h.rmssd_ms AS rmssd_ms,
    s.efficiency_pct AS sleep_efficiency_pct,
    o.mean_pct AS spo2_night_mean
  FROM days d
  LEFT JOIN daily_load l ON l.date = d.date
  LEFT JOIN hrv_daily h ON h.date = d.date
  LEFT JOIN sleep_daily s ON s.date = d.date
  LEFT JOIN spo2_daily o ON o.date = d.date
),
windowed AS (
  SELECT
    date, tonnage_kg, sleep_efficiency_pct, spo2_night_mean,
    total(tonnage_kg) OVER (ORDER BY jd RANGE BETWEEN 6 PRECEDING AND CURRENT ROW) / 7.0 AS acute_load_kg,
    total(tonnage_kg) OVER (ORDER BY jd RANGE BETWEEN 27 PRECEDING AND CURRENT ROW) / 28.0 AS chronic_load_kg,
    CASE WHEN rmssd_ms > 0 THEN ln(rmssd_ms) END AS ln_rmssd,
    avg(CASE WHEN rmssd_ms > 0 THEN ln(rmssd_ms) END)
      OVER (ORDER BY jd RANGE BETWEEN 28 PRECEDING AND 1 PRECEDING) AS hrv_baseline_mean,
    avg(CASE WHEN rmssd_ms > 0 THEN ln(rmssd_ms) * ln(rmssd_ms) END)
      OVER (ORDER BY jd RANGE BETWEEN 28 PRECEDING AND 1 PRECEDING) AS hrv_baseline_sq_mean
  FROM joined
)
SELECT
  date, tonnage_kg, acute_load_kg, chronic_load_kg,
  CASE WHEN chronic_load_kg > 1.0 THEN acute_load_kg / chronic_load_kg END AS acwr,
  ln_rmssd, hrv_baseline_mean,
  CASE WHEN (hrv_baseline_sq_mean - hrv_baseline_mean * hrv_baseline_mean) > 1.0e-9
       THEN sqrt(hrv_baseline_sq_mean - hrv_baseline_mean * hrv_baseline_mean) END AS hrv_baseline_sd,
  sleep_efficiency_pct, spo2_night_mean
FROM windowed;