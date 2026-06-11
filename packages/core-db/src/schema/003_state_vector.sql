-- =============================================================================
-- 003_state_vector.sql
-- Domain 3: THE STATE VECTOR — unified daily readiness snapshot (0-100).
--
-- Design: a VIEW (v_readiness_inputs) does the cross-domain math over the
-- daily rollups using julianday-RANGE windows (gap-tolerant: a missing rest
-- day still counts as 7 calendar days, not 7 rows). The state_vector TABLE is
-- a MATERIALIZED snapshot written once per day by 004 — so the embedded SLM's
-- read path is a clustered single-row PK lookup (or a short ordered range scan
-- for a 14-day trend window). Zero joins, zero window functions at inference
-- time.
--
-- Requires SQLite built-in math functions (ln, sqrt): NOT in op-sqlite's
-- default build — the app MUST set "op-sqlite": { "sqliteFlags":
-- "-DSQLITE_ENABLE_MATH_FUNCTIONS=1" } in apps/mobile/package.json
-- (proven on-device 2026-06-11: CREATE VIEW fails with "no such function:
-- ln" without it). Node verifiers register JS fallbacks. Window RANGE
-- frames require SQLite >= 3.28; op-sqlite ships >= 3.45.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Cross-domain feature view (read by 004 only — never by the SLM directly)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_readiness_inputs;
CREATE VIEW v_readiness_inputs AS
WITH days AS (
  SELECT date FROM mech_daily
  UNION SELECT date FROM hrv_daily
  UNION SELECT date FROM sleep_daily
  UNION SELECT date FROM spo2_daily
),
joined AS (
  SELECT
    d.date,
    julianday(d.date)            AS jd,
    COALESCE(m.tonnage_kg, 0.0)  AS tonnage_kg,
    h.rmssd_ms                   AS rmssd_ms,
    s.efficiency_pct             AS sleep_efficiency_pct,
    o.mean_pct                   AS spo2_night_mean
  FROM days d
  LEFT JOIN mech_daily  m ON m.date = d.date
  LEFT JOIN hrv_daily   h ON h.date = d.date
  LEFT JOIN sleep_daily s ON s.date = d.date
  LEFT JOIN spo2_daily  o ON o.date = d.date
),
windowed AS (
  SELECT
    date, tonnage_kg, sleep_efficiency_pct, spo2_night_mean,
    -- Acute (7-day) and chronic (28-day) mean daily load; total() over a
    -- calendar RANGE divided by the fixed window length treats absent days
    -- as zero-load days, which is the correct ACWR convention.
    total(tonnage_kg) OVER (ORDER BY jd RANGE BETWEEN  6 PRECEDING AND CURRENT ROW) /  7.0
      AS acute_load_kg,
    total(tonnage_kg) OVER (ORDER BY jd RANGE BETWEEN 27 PRECEDING AND CURRENT ROW) / 28.0
      AS chronic_load_kg,
    -- HRV is log-normal: baseline = 28-day mean/sd of ln(rMSSD), EXCLUDING
    -- today (1 PRECEDING) so today's reading is scored against history.
    CASE WHEN rmssd_ms > 0 THEN ln(rmssd_ms) END AS ln_rmssd,
    avg(CASE WHEN rmssd_ms > 0 THEN ln(rmssd_ms) END)
      OVER (ORDER BY jd RANGE BETWEEN 28 PRECEDING AND 1 PRECEDING)
      AS hrv_baseline_mean,
    avg(CASE WHEN rmssd_ms > 0 THEN ln(rmssd_ms) * ln(rmssd_ms) END)
      OVER (ORDER BY jd RANGE BETWEEN 28 PRECEDING AND 1 PRECEDING)
      AS hrv_baseline_sq_mean
  FROM joined
)
SELECT
  date,
  tonnage_kg,
  acute_load_kg,
  chronic_load_kg,
  -- ACWR undefined until a real chronic base exists (> 1 kg/day avg).
  CASE WHEN chronic_load_kg > 1.0
       THEN acute_load_kg / chronic_load_kg END   AS acwr,
  ln_rmssd,
  hrv_baseline_mean,
  -- sd = sqrt(E[x^2] - E[x]^2); floor guards fp noise on flat baselines.
  CASE WHEN (hrv_baseline_sq_mean - hrv_baseline_mean * hrv_baseline_mean) > 1.0e-9
       THEN sqrt(hrv_baseline_sq_mean - hrv_baseline_mean * hrv_baseline_mean)
       END                                        AS hrv_baseline_sd,
  sleep_efficiency_pct,
  spo2_night_mean
FROM windowed;

-- ---------------------------------------------------------------------------
-- Materialized State Vector — the SLM's only read surface.
-- Clustered on date (WITHOUT ROWID): SELECT * WHERE date = ? is a single
-- B-tree descent; the 14-day trend query is one ordered leaf-page scan.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS state_vector (
  date                 TEXT PRIMARY KEY,
  readiness_score      REAL NOT NULL CHECK (readiness_score BETWEEN 0 AND 100),
  -- Component sub-scores (each 0-100; 50 = neutral when the input is absent)
  hrv_component        REAL NOT NULL CHECK (hrv_component   BETWEEN 0 AND 100),
  load_component       REAL NOT NULL CHECK (load_component  BETWEEN 0 AND 100),
  sleep_component      REAL NOT NULL CHECK (sleep_component BETWEEN 0 AND 100),
  spo2_component       REAL NOT NULL CHECK (spo2_component  BETWEEN 0 AND 100),
  -- Raw features, denormalized so prompt assembly is this one row:
  acwr                 REAL,
  acute_load_kg        REAL,
  chronic_load_kg      REAL,
  ln_rmssd             REAL,
  hrv_z                REAL,
  sleep_efficiency_pct REAL,
  spo2_night_mean      REAL,
  computed_at_ms       INTEGER NOT NULL
) STRICT, WITHOUT ROWID;
