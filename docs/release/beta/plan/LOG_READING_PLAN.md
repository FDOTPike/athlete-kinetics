# Reading the returned beta logs — proposed offline analysis procedure

Use only the approved private local environment in the signed consent. Do not attach raw backups, passwords, names or free text to a remote agent/service. The agent's work is local authenticated extraction, reproducible queries and de-identified findings for owner review. No symptom-policy, observer or load-rule change is authorized by this procedure.

## Reference and receipt

All `origin/master:` citations below are at `26f6557a793f1cafe9f609fb10e015cfc42d22b0`. The backup schema reference ends at migration slot 71 / user version 70 (`origin/master:packages/core-db/src/backup/schemaContract.ts:95`). A joined release may add migrations: verify its actual contract, keep its exact source revision, and use a reader supporting that contract. An older backup may authenticate but cannot recreate facts never recorded.

Owner records participant code, consent version, agreed date window, receipt time, file SHA-256, build, backup ID and creation time, schema slot/version and included athlete inventory. Keep names/passwords in a separate private register. Quarantine unconsented extra athletes; do not silently include their records. Confirm readability after the proposed setup/day-7/final handovers. These snapshots overlap: choose the latest authenticated final snapshot per athlete for the main analysis; do not concatenate weekly copies. Use earlier snapshots only to investigate loss/edits and identify withdrawn/deleted records explicitly. Keys are `(participant code, athlete identity, session_id/set_id)`, never bare numeric IDs across databases.

## Supported decryption and restore paths

The existing format uses scrypt and AES-256-GCM (`origin/master:packages/core-db/src/backup/contract.ts:5`). This is an encrypted archive carrying a registry and base64 SQLite database snapshots, not an encrypted SQLite file you can open directly (`origin/master:packages/core-db/src/backup/contract.ts:71`).

**For the agent's queries, prefer offline extraction without replacing an app database.** In an isolated checkout of the matching reader, use the TypeScript compile step from `verify:backup` (`package.json:39`), targeting `packages/core-db/src/backup/index.ts`; use exported `openBackup(text, password, cryptoProvider)` and require `ok === true`. The current implementation authenticates, validates inventory and snapshot bytes; do not bypass it with a hand-written decryptor (`origin/master:packages/core-db/src/backup/contract.ts:399`). The existing Node crypto adapter is demonstrated at `origin/master:packages/core-db/test/backup/verify_backup_contract.mjs:15` (scrypt parameters, GCM AAD/tag and SHA-256); reuse that adapter in the controlled analysis environment. It is test support, not a shipped backup-reader CLI. There is no claim that such a CLI is already installed.

Obtain the password interactively, never through command arguments, environment logs or source files. Reject all authentication/unsupported-schema/corruption errors; return a clear missing-data status to the owner. After successful opening, use `archive.registry.athletes` to identify only consenting inventories, decode `archive.databases[].databaseBase64` with the exported `base64ToBytes`, verify the declared digest/length, and write disposable SQLite copies in the private workspace. The contract validates snapshot hashes and SQLite header (`origin/master:packages/core-db/src/backup/contract.ts:302`). Open copies read-only, run `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, inspect `PRAGMA user_version` and `sqlite_master`, and inventory required tables/columns before executing these queries. Never migrate the evidence original to hide a missing table. If a newer joined contract is needed, first update and verify this query plan against that source.

**For the owner's human restore/readability check**, use a dedicated disposable QA phone/installation with synthetic data only. Enter the password, choose RESTORE ENCRYPTED BACKUP, inspect preview athlete names/date, then deliberately confirm replacement. Backup controls and preview are at `apps/mobile/src/components/BackupTransferPanel.tsx:82` and `apps/mobile/src/components/BackupTransferPanel.tsx:106`; replacement erases all current athlete data and does not merge, although it first verifies an encrypted recovery copy (`apps/mobile/src/components/BackupTransferPanel.tsx:118`). Never restore each participant into the owner's live coaching installation. Delete restored and retained-recovery material under the agreed retention policy. App restore supports inspection, but is not an existing read-only SQL export tool.

## Query conventions

Every SQL block below is a separate read-only query, run once per consenting athlete database. Bind `:start_date` / `:end_date` to that athlete's inclusive beta dates. For report-time precision bind `:start_ms` inclusive / `:end_ms` exclusive from the agreed local-day boundaries, retaining timezone metadata; do not guess UTC boundaries. SQL constants for counts, boolean flags and valid domains are arithmetic/schema values, not newly approved policy thresholds.

Preserve raw outputs privately with query version and input hash. Publish counts and de-identified summaries only. No missing answer becomes a zero. No unfinished session becomes a completed failure. Flag deletions and unavailable/unmappable provenance rather than repairing them by guessing a movement match.

### Session inventory and finalization coverage

Source: `origin/master:packages/core-db/src/schema/001_mechanical_input.sql:61`, `origin/master:packages/core-db/src/schema/026_phase18_session_outcome.sql:48`, `origin/master:packages/core-db/src/schema/023_phase17_session_foundation.sql:100`.

```sql
SELECT s.session_id, s.session_date, o.outcome_kind, o.training_age,
       o.planned_set_count, o.logged_set_count, o.skipped_slot_count,
       o.missing_unskipped_set_count, o.finalized_at_ms,
       c.phase AS unfinished_phase
FROM session s
LEFT JOIN session_outcome o USING (session_id)
LEFT JOIN session_runner_checkpoint c USING (session_id)
WHERE s.session_date BETWEEN :start_date AND :end_date
ORDER BY s.session_date, s.session_id;
```

List started, finalized and unfinished sessions separately; ask the owner about expected sessions never started (no database row cannot prove adherence). All main slot ratios below use finalized sessions; retain stopped-safely outcomes as their own stratum rather than erasing them.

### Completion per slot, explicit skips and frozen dose

Source: `origin/master:packages/core-db/src/schema/022_set_target.sql:39`, `origin/master:packages/core-db/src/schema/022_set_target.sql:79`, `origin/master:packages/core-db/src/schema/023_phase17_session_foundation.sql:59`, `origin/master:packages/core-db/src/schema/071_beta_recording.sql:43`.

```sql
SELECT p.session_id, p.session_plan_slot_id, p.movement_id,
       p.provenance_kind, p.planned_sets, p.planned_reps, p.target_rpe,
       d.target_kind, d.target_reps, d.target_seconds,
       CASE WHEN k.session_plan_slot_id IS NULL THEN 0 ELSE 1 END AS recorded_skip,
       COUNT(r.set_id) AS logged_sets,
       MAX(p.planned_sets - COUNT(r.set_id), 0) AS missing_sets,
       MAX(COUNT(r.set_id) - p.planned_sets, 0) AS extra_sets
FROM session_plan_slot p
JOIN session s USING (session_id)
JOIN session_outcome o USING (session_id)
LEFT JOIN session_slot_target d USING (session_plan_slot_id)
LEFT JOIN session_skipped_slot k USING (session_plan_slot_id)
LEFT JOIN set_target t USING (session_plan_slot_id)
LEFT JOIN set_record r ON r.set_id = t.set_id
  AND r.session_id = p.session_id AND r.movement_id = p.movement_id
WHERE s.session_date BETWEEN :start_date AND :end_date
GROUP BY p.session_plan_slot_id
ORDER BY p.session_id, p.slot_index;
```

Denominator: sum `planned_sets` over eligible finalized slots, also report per-athlete/session/slot distributions. Numerator for capped set completion: sum `MIN(logged_sets, planned_sets)`; extra sets remain separate. Split missing work into recorded-skipped and unskipped slots and by provenance, stopped-safely outcome and training age. A recorded skip can coexist with earlier logged sets. Reconcile skip counts against `session_outcome.skipped_slot_count`; absent rows in older history mean unknown, not no skips (`origin/master:packages/core-db/src/schema/071_beta_recording.sql:18`). No per-slot reason is inferred from session feel.

Audit unmapped/cross-slot sets before claiming complete coverage:

```sql
SELECT r.session_id, r.set_id, r.movement_id, t.session_plan_slot_id,
       t.provenance_kind
FROM set_record r
JOIN session s USING (session_id)
LEFT JOIN set_target t USING (set_id)
LEFT JOIN session_plan_slot p ON p.session_plan_slot_id = t.session_plan_slot_id
WHERE s.session_date BETWEEN :start_date AND :end_date
  AND (p.session_plan_slot_id IS NULL OR p.session_id <> r.session_id
       OR p.movement_id <> r.movement_id)
ORDER BY r.session_id, r.set_id;
```

The same source definitions above establish these keys. Never join only on movement: a movement may appear in different slots.

### Loads initially shown versus loads lifted

Source: `origin/master:packages/core-db/src/schema/071_beta_recording.sql:30`, `origin/master:packages/core-db/src/schema/071_beta_recording.sql:47`, `origin/master:packages/core-db/src/schema/001_mechanical_input.sql:73`.

```sql
SELECT r.session_id, r.set_id, r.movement_id, r.load_kg AS lifted_kg,
       l.load_source, l.shown_load_kg, l.advisory_kg, l.advisory_kind,
       CASE WHEN l.set_id IS NULL THEN 'unrecorded'
            WHEN l.shown_load_kg IS NULL THEN 'blank'
            ELSE 'numeric' END AS seed_state,
       CASE WHEN l.shown_load_kg IS NOT NULL
            THEN r.load_kg - l.shown_load_kg END AS lifted_minus_seed_kg
FROM set_record r JOIN session s USING (session_id)
LEFT JOIN set_load_shown l USING (set_id)
WHERE s.session_date BETWEEN :start_date AND :end_date
ORDER BY r.logged_at_ms, r.set_id;
```

Report source counts, blank/unrecorded fraction, changes from numeric seeds and advisory comparisons separately. The difference denominator includes only numeric recorded seeds; retain zero. Sidecars preserve the initial seed even if the set is edited later, so differences are not automatically athlete overrides made at entry (`origin/master:packages/core-db/src/schema/071_beta_recording.sql:34`).

### Effort response and consecutive eligible sets

Source: `origin/master:packages/core-db/src/schema/001_mechanical_input.sql:73`, `origin/master:packages/core-db/src/schema/026_phase18_session_outcome.sql:14`; qualifying checks `origin/master:packages/inference/src/e1rm.ts:77`.

```sql
SELECT r.set_id, r.session_id, s.session_date, r.movement_id,
       r.reps, r.load_kg, r.rpe, r.logged_at_ms, d.target_kind,
       CASE WHEN r.rpe IS NULL THEN 'unanswered' ELSE 'answered' END AS effort_state
FROM set_record r JOIN session s USING (session_id)
LEFT JOIN set_dose_target d USING (set_id)
WHERE s.session_date BETWEEN :start_date AND :end_date
ORDER BY r.movement_id, s.session_date, r.session_id, r.logged_at_ms, r.set_id;
```

Effort coverage: answered sets divided by all logged sets, with unrated counts retained. For repeatability, keep each movement/athlete separate; require an explicit reps dose for the primary analysis and retain unknown/time doses as exclusions. Feed reps/load/RPE into the existing `estimateOneRepMax` function, which rejects unrated, below-RPE-6, nonpositive-load/rep and nonfinite inputs (`origin/master:packages/inference/src/e1rm.ts:82`). Pair adjacent eligible sets in the query order within session, and consecutive comparable sessions separately. Report pair count, absolute/relative differences, effort/rep/load context, equipment changes and within-person spread. Use `bestPerSession` only for a separately labelled session-maximum series, not as every-set repeatability (`origin/master:packages/inference/src/e1rm.ts:100`). No new strength formula, clinical limit or minimal-change threshold is invented.

### Session feel, reasons and notes

Source: `origin/master:packages/core-db/src/schema/070_session_feel.sql:26`, `origin/master:packages/core-db/src/schema/009_periodization.sql:55`.

```sql
SELECT s.session_id, s.session_date, o.outcome_kind, f.feel,
       f.reason_pain, f.reason_tired, f.reason_unwell, f.reason_technique,
       f.reason_equipment, f.reason_time, f.reason_felt_good, f.reason_other,
       f.recorded_at_ms, n.note, n.created_at_ms AS note_created_at_ms
FROM session s JOIN session_outcome o USING (session_id)
LEFT JOIN session_feel f USING (session_id)
LEFT JOIN session_note n USING (session_id)
WHERE s.session_date BETWEEN :start_date AND :end_date
ORDER BY s.session_date, s.session_id;
```

Denominator: finalized sessions, with absent feel and absent note counted separately. Reasons may overlap; their percentages need not sum to the whole. Review text locally, remove identifiers and manually code themes. A pain reason is not proof that a triage report or halt occurred, and a note does not establish same-day coach receipt.

### Symptom reports and applied routing

Source: `origin/master:packages/core-db/src/schema/005_subjective_report.sql:8`.

```sql
SELECT report_id, date, reported_at_ms, raw_text, matched_entry_id,
       similarity, halt, load_modifier, set_modifier, rpe_cap
FROM subjective_report
WHERE reported_at_ms >= :start_ms AND reported_at_ms < :end_ms
ORDER BY reported_at_ms, report_id;
```

Report all routing counts including unmatched (`matched_entry_id IS NULL`), halts and actual applied fields. There is no session foreign key in this table: do not make an exact session association from date alone. The owner's private incident register supplies contact time, injury follow-up and safety review. Compare routing with a qualified review of de-identified examples; logging an entry does not prove it was clinically appropriate. October systemic precedence is implemented at `origin/master:packages/inference/src/semantic/redFlag.ts:149`; verify the beta build includes it.

### Attribution context

Source: `origin/master:packages/core-db/src/schema/034_autopilot_attribution.sql:5`, `origin/master:packages/core-db/src/schema/022_set_target.sql:48`.

```sql
SELECT p.session_id, p.session_plan_slot_id, p.source_planned_slot_id,
       a.rpe_delta, a.set_delta, a.reason
FROM session_plan_slot p JOIN session s USING (session_id)
LEFT JOIN planned_slot_autopilot a ON a.planned_slot_id = p.source_planned_slot_id
WHERE s.session_date BETWEEN :start_date AND :end_date
ORDER BY p.session_id, p.slot_index;
```

Treat unmatched attribution as unavailable context if the original plan no longer exists. This does not reconstruct a frozen adjustment history.

### Question log — explicit pre-start dependency

The reference schema does not supply a verified question-log contract. Do not write a plausible table/query and call it implemented. Before recruitment, the separate feature owner must provide exact table/column paths and lines, persisted question text/time and selected card/no-answer/referral fields, flag/build identity, and encrypted backup round-trip evidence. Add a bound-window SELECT against that verified schema, inventory missing text/response rows and confirm only one shown card per response. Until then this query and the question measure are **NOT VERIFIED**. Ask the owner to label de-identified questions blind to the selected response; keep the new real-question evaluation set separate from previously seen questions.

## The three deferred decisions this evidence informs

| Decision reserved for owner review | Evidence to bring; limits |
| --- | --- |
| Completion observer thresholds | Per-slot planned versus completed distributions, explicit skips, stopped/unfinished strata, outcome reconciliation, missing effort/dose/provenance and session reasons. Show sensitivity to excluding unsafe/incomplete history; do not enable the dormant observer or choose its thresholds here. |
| Whether/how “adjusted by completion” changes the load shown | Numeric seed versus lifted-load differences by source, blank/unrecorded rates, advisories, attribution and completion context. Seed is not every later display and edits can confound differences; this beta is not a causal comparison. |
| Strength-estimate repeatability | Within-athlete/movement consecutive eligible-set and session distributions, number of comparable pairs, excluded/unrated/timed cases and coaching/equipment context. Fourteen days may yield too few pairs: report insufficient evidence rather than inventing a threshold. |

Deliver a de-identified analysis with denominators, missingness, safety incidents, reproducible query/input hashes and uncertainty; obtain an independent reading before the owner rules. Questions and symptom examples inform later content/clinical review, not automatic training-policy changes. Finish the approved deletion register after analysis.
