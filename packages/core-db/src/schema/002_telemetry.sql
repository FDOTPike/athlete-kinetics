-- =============================================================================
-- 002_telemetry.sql
-- Domain 2: TELEMETRY — high-frequency SpO2 stream, daily HRV, sleep efficiency.
--
-- Indexing strategy for this domain
--   * spo2_sample is the only true high-frequency stream. It is clustered
--     WITHOUT ROWID on (epoch_ms, source): wearable ingestion arrives in
--     ascending epoch order, so inserts are right-edge B-tree appends (no page
--     splits), and time-range scans are sequential page reads. No secondary
--     indexes — every byte of index is RAM competing with SLM weight pages.
--   * Raw samples are a 14-day ring buffer; the compaction job folds them into
--     spo2_daily and deletes the tail. The State Vector only ever touches the
--     daily rollups, never the raw stream.
--   * hrv_daily / sleep_daily / spo2_daily are clustered on date (WITHOUT
--     ROWID): one row per day, point lookups and short ordered range scans.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Raw high-frequency stream (ring buffer, ~14 days retention)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spo2_sample (
  epoch_ms INTEGER NOT NULL,
  source   TEXT    NOT NULL DEFAULT 'wearable',
  spo2_pct REAL    NOT NULL CHECK (spo2_pct BETWEEN 50 AND 100),
  PRIMARY KEY (epoch_ms, source)
) STRICT, WITHOUT ROWID;

-- ---------------------------------------------------------------------------
-- Daily rollups (what the State Vector reads)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spo2_daily (
  date              TEXT PRIMARY KEY,
  mean_pct          REAL NOT NULL CHECK (mean_pct BETWEEN 50 AND 100),
  min_pct           REAL NOT NULL CHECK (min_pct  BETWEEN 50 AND 100),
  pct_time_below_90 REAL NOT NULL DEFAULT 0 CHECK (pct_time_below_90 BETWEEN 0 AND 100),
  sample_count      INTEGER NOT NULL CHECK (sample_count > 0)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS hrv_daily (
  date         TEXT PRIMARY KEY,
  rmssd_ms     REAL NOT NULL CHECK (rmssd_ms > 0),
  sdnn_ms      REAL CHECK (sdnn_ms IS NULL OR sdnn_ms > 0),
  resting_hr   REAL CHECK (resting_hr IS NULL OR resting_hr BETWEEN 20 AND 150),
  source       TEXT NOT NULL DEFAULT 'wearable'
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS sleep_daily (
  date           TEXT PRIMARY KEY,                 -- date of the wake morning
  in_bed_min     REAL NOT NULL CHECK (in_bed_min > 0),
  asleep_min     REAL NOT NULL CHECK (asleep_min >= 0),
  deep_min       REAL CHECK (deep_min  IS NULL OR deep_min  >= 0),
  rem_min        REAL CHECK (rem_min   IS NULL OR rem_min   >= 0),
  light_min      REAL CHECK (light_min IS NULL OR light_min >= 0),
  latency_min    REAL CHECK (latency_min IS NULL OR latency_min >= 0),
  interruptions  INTEGER CHECK (interruptions IS NULL OR interruptions >= 0),
  -- Sleep efficiency is derived, never written by the app layer.
  efficiency_pct REAL GENERATED ALWAYS AS
                   (100.0 * asleep_min / in_bed_min) STORED
                 CHECK (efficiency_pct <= 100.0)
) STRICT, WITHOUT ROWID;

-- ---------------------------------------------------------------------------
-- Compaction job (executed by compaction.ts, nightly + on app foreground):
--
--   1. Fold finished days of raw SpO2 into the rollup:
--
--      INSERT INTO spo2_daily (date, mean_pct, min_pct, pct_time_below_90, sample_count)
--      SELECT date(epoch_ms / 1000, 'unixepoch', 'localtime')              AS d,
--             avg(spo2_pct),
--             min(spo2_pct),
--             100.0 * sum(spo2_pct < 90.0) / count(*),
--             count(*)
--      FROM spo2_sample
--      WHERE epoch_ms < strftime('%s', 'now', 'localtime', 'start of day') * 1000
--      GROUP BY d
--      ON CONFLICT (date) DO UPDATE SET
--        mean_pct = excluded.mean_pct, min_pct = excluded.min_pct,
--        pct_time_below_90 = excluded.pct_time_below_90,
--        sample_count = excluded.sample_count;
--
--   2. Trim the ring buffer (keeps DB size and page cache flat):
--
--      DELETE FROM spo2_sample
--      WHERE epoch_ms < (strftime('%s', 'now') - 14 * 86400) * 1000;
--
--   Deletes are followed by PRAGMA incremental_vacuum when auto_vacuum =
--   INCREMENTAL (set at creation in pragmas.ts) so the file never balloons.
-- ---------------------------------------------------------------------------
