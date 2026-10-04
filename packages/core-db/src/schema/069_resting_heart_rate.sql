-- =============================================================================
-- 069_resting_heart_rate.sql
--
-- Resting heart rate stored on its own, independent of HRV.
--
-- hrv_daily (002) can hold resting_hr only beside an rmssd_ms value, because
-- rmssd_ms is NOT NULL. Apple Health exposes resting heart rate but no RMSSD
-- (its HRV is SDNN, a different statistic that must never be stored as
-- RMSSD), so on iPhone resting heart rate had nowhere to go. Health Connect
-- has the same gap on any day it reports resting heart rate without HRV.
--
--   * resting_hr_daily — one row per local calendar date:
--       bpm           beats per minute (HealthKit unit count/min; Health
--                     Connect beatsPerMinute), the same 20..150 domain as
--                     hrv_daily.resting_hr;
--       source        which service the value was read from — provenance,
--                     never inferred;
--       synced_at_ms  when this value was last written.
--     A later read of the same date REPLACES the row (Health revises a day's
--     value as the day completes). A date the service returns nothing for is
--     left as it is: an empty read can mean no data or no access (HealthKit
--     does not reveal read denial), and neither is a reason to delete.
--
-- Append-only: no existing table, view, trigger or row is changed. hrv_daily
-- keeps its resting_hr column and its data; readers prefer this table and fall
-- back to hrv_daily.resting_hr for history written before 069. Readiness
-- (v_readiness_inputs) does not read resting heart rate and is unchanged.
-- Idempotent (IF NOT EXISTS) for the self-heal replay.
-- =============================================================================

CREATE TABLE IF NOT EXISTS resting_hr_daily (
  date          TEXT PRIMARY KEY
                CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  bpm           REAL NOT NULL CHECK (bpm BETWEEN 20 AND 150),
  source        TEXT NOT NULL CHECK (source IN ('apple_health', 'health_connect')),
  synced_at_ms  INTEGER NOT NULL CHECK (synced_at_ms > 0)
) STRICT, WITHOUT ROWID;
