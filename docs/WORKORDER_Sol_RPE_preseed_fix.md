# Work order — RPE pre-seed integrity fix

Date: 2026-07-31
Status: **AUTHORIZED — BLOCKING**
Assignee: Sol (Codex)

## 1. Defect

`SessionScreen` initializes the actual-RPE input from the prescribed target.
Logging without touching that control therefore persists
`set_record.rpe = set_target.target_rpe`. The observer cannot distinguish a
genuine exact-target report from an unanswered input, so fabricated zero
`delta_rpe` observations can pull the flaw signal toward its deadband.

The database and observer already model missing evidence correctly:

- `set_record.rpe` is nullable.
- The autopilot projection excludes rows where actual or target RPE is null.
- No migration or observer-constant change is authorized.

## 2. Device evidence before remediation

Read-only audit of the connected default-athlete database:

```sql
SELECT
  COUNT(*) AS all_set_rows,
  SUM(CASE WHEN sr.rpe IS NOT NULL THEN 1 ELSE 0 END) AS rows_with_rpe,
  SUM(CASE WHEN sr.rpe IS NOT NULL AND st.target_rpe IS NOT NULL
      THEN 1 ELSE 0 END) AS eligible_rows,
  SUM(CASE WHEN sr.rpe IS NOT NULL AND st.target_rpe IS NOT NULL
      AND sr.rpe = st.target_rpe THEN 1 ELSE 0 END) AS exact_rows,
  ROUND(100.0 * SUM(CASE WHEN sr.rpe IS NOT NULL AND st.target_rpe IS NOT NULL
      AND sr.rpe = st.target_rpe THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN
      sr.rpe IS NOT NULL AND st.target_rpe IS NOT NULL THEN 1 ELSE 0 END), 0), 2) AS exact_pct
FROM set_record sr
LEFT JOIN set_target st ON st.set_id = sr.set_id;
```

Result:

- 1,175 total `set_record` rows.
- 4 rows have both actual RPE and a frozen target RPE.
- 4 of 4 eligible rows are exact matches: **100% possibly fabricated**.
- The other 1,171 rows predate frozen `set_target` evidence and are excluded
  from this fraction and from the current observer.
- Four eligible observations exist across all patterns, so no pattern can yet
  meet per-pattern `MIN_OBSERVATIONS = 5` from these rows alone. Continued
  fabricated zeros could eventually cross a pattern's threshold.

## 3. Authorized fix

1. Track whether the athlete explicitly touched/confirmed actual RPE for the
   current set.
2. Persist `NULL` when it was not answered.
3. Persist the selected numeric value when it was answered, including when the
   answer equals the prescribed target.
4. Keep runner rest deterministic: unanswered actual RPE may fall back to the
   prescribed target for rest calculation only. That fallback must never be
   persisted as athlete evidence.
5. Preserve null RPE when editing unrelated set metrics.

## 4. Gates

- Untouched RPE logs `null`.
- An explicit exact-target answer logs the exact numeric value.
- Adjusting RPE logs the adjusted numeric value.
- Store SQL binds `NULL` into `set_record.rpe` and keeps it null during unrelated
  metric edits.
- Autopilot projection continues to exclude null actual RPE.
- `verify:all` remains green.

## 5. Out of scope

- Completion-versus-prescription observer.
- Experience-tiered RPE authority.
- Four-mode load selection.
- RPE teaching thresholds.
- Schema migrations, controller constants, or historical backfill/rewrite.
