# WO-03 durable data inventory

Date: 2026-09-13
Originally frozen at `87624d9e43189ddd87db317e24d4379ef5a13fae`; updated by the Accessible Coach integration candidate.
Live chain: migration files through `064`; `004` is a parameterized materializer, not a migration. The migration array therefore has 63 entries and a fully migrated database reports `PRAGMA user_version = 63`. Slot `064` is the product-ratified neutral activity/support capture contract; it contains no executable clinical limit or screening schema.

## Discovery result and candidate disposition

No restorable backup or restore implementation existed at the frozen source. The WO-03B candidate now adds an encrypted, all-athlete, replace-only implementation. The baseline findings below remain useful evidence of why existing export and diagnostic features could not be reused as backup.

- `AK_HISTORY_V1` is a paste-only training-history import format. It imports sessions and sets after preview; it is not an export and cannot recreate profile, preferences, programs, routines, telemetry, or the athlete registry.
- The Coach Verification Lab can share a deliberately redacted diagnostic report. That report is not user data backup.
- At the frozen source, `react-native-blob-util` could read and write known paths, but the repository had no OS create/open document picker bridge and no backup snapshot flow.
- At the frozen source, there was no database backup API call, `VACUUM INTO`, recovery-copy flow, journaled replacement, portable encryption, backup preview, or persisted “last successful backup” state.

The candidate closes those gaps with authenticated AES-256-GCM/scrypt containers, OS document create/open operations, private `VACUUM INTO` snapshots, exhaustive schema checks, a verified encrypted recovery backup, operation-bound restore journaling, and a startup recovery gate. The implementation decision and failure policy are recorded in `docs/decisions/WO03_ENCRYPTED_BACKUP_AND_RESTORE.md`.

## Non-database durable data

`coach_athletes.json` is stored in the app document directory outside SQLite. It contains registry version, active athlete id, athlete ids/display names/database filenames/creation times, and the device-wide advanced-tools preference. Each athlete maps to a distinct SQLite file (`athlete_kinetics.db` for the default athlete, otherwise `ak_athlete_<id>.db`). The candidate always carries the registry and one consistent physical snapshot of every referenced athlete database in one authenticated archive. Copying only the active database is not a complete Coach Mode backup.

`backup_preferences.json` stores only the timestamp of the last portable backup whose OS save action returned success. It is operational UI state, is not athlete data, and is not part of the portable archive. The private `pikeMethods-recovery-current.pmbak`, restore journal, operation markers, rollback copies, and incoming files are recovery machinery rather than portable payload. Temporary plaintext snapshots exist only under narrowly named app-private cache directories (`ak-backup-<32 lowercase hex characters>`) and are cleaned on every reachable path; matching abandoned directories are swept before normal boot. Passwords, derived keys, decrypted archives, and private support prose are never written to diagnostics or metadata.

## Final live durable tables: 104

The inventory comes from the complete migration chain and the recovery sentinels. Temporary replacement tables and the superseded `user_profile` table are listed separately below.

### Athlete-owned profile, settings, declarations, and estimates (10)

- `athlete_profile` — active profile fields including goal, experience, availability, injury/mobility JSON, and equipment inventory.
- `profile_slot` — named profile snapshots and active-slot identity.
- `profile_ui_preference` — per-profile guided-detail preference.
- `profile_load_preference` — per-profile automatic/manual load preference.
- `band_ladder` — athlete-editable band level labels.
- `movement_preference` — liked/disliked movement choices.
- `movement_load_intent` — athlete-declared implement for ambiguous movements.
- `movement_prior_experience` — athlete declaration/revocation history.
- `movement_capability_attestation` — athlete capability attestations.
- `one_rep_max` — athlete-entered or updated movement load estimates.

### Programs, routines, plans, provenance, and suspension state (26)

- `macro_cycle`
- `micro_cycle`
- `training_block`
- `block_meta`
- `planned_session`
- `planned_slot`
- `slot_override`
- `planned_session_method`
- `planned_slot_target`
- `planned_slot_autopilot`
- `planned_slot_disposition`
- `planned_slot_load_intent`
- `planned_session_routine_context`
- `planned_slot_routine_decision`
- `planned_slot_legacy_role_allowance`
- `training_program`
- `training_program_day`
- `training_program_movement_preference`
- `training_block_program`
- `routine_template`
- `routine_template_slot`
- `routine_template_legacy_role_allowance`
- `routine_template_contract_cutoff` — singleton fail-closed provenance; it is a row-level sentinel and must not be missed by table-only sentinel extraction.
- `suspension_episode`
- `suspension_episode_program`
- `block_suspension_origin`

These tables collectively carry goal/program state, generated schedule, routine definitions, decisions that explain generated slots, immutable suspension history, and foreign-key identity. They must be treated as one graph, not independently merged.

### External activities and training support (18)

- `activity_definition` — stable neutral activity identity and the ratified 15-kind log-only taxonomy.
- `activity_requirement` — activity-specific facility/equipment context, separate from strength movement eligibility.
- `activity_series` — weekly local-civil recurrence intent, timezone, timing commitment, and nullable expected duration/effort.
- `activity_occurrence` — stable planned/completed/cancelled/missed occurrence identity and explicitly resolved time facts.
- `activity_completion` — one factual actual/partial completion per occurrence; duration and effort remain separate.
- `activity_source_link` — explicit manual/import/coached-session reconciliation without fuzzy matching.
- `activity_typical_week_report` — separately dated user-reported habit window, never completed work.
- `activity_typical_week_item` — activities described by a typical-week report.
- `health_support_profile` — capture/review state; no clearance state exists.
- `health_support_preference` — non-executable position/transition/rest preferences.
- `health_support_note` — user-reported non-executable support notes.
- `clinician_instruction` — stable envelope for an instruction entered by the athlete.
- `clinician_instruction_revision` — user-reported/not-verified transcription history.
- `health_support_hold` — explicit mechanical review/request hold state and reason code.
- `health_support_scope` — exact activity/movement/all/unresolved applicability for an instruction or hold.
- `recommendation_support_record` — content-free identity, status, engine version, and timestamp for a prospective recommendation attempt.
- `recommendation_activity_basis` — exact occurrence identities/revisions considered by that attempt.
- `recommendation_hold_basis` — exact hold identities/revisions and mechanical reason codes decisive for that attempt; no support prose.

These tables are athlete-owned health/schedule information. The candidate includes the complete graph inside each physical SQLite snapshot, authenticates it before it becomes shareable, and verifies the real migration-chain schema before restore. Restore preview is generated only after successful authentication and intentionally exposes no support-note prose.

### Native workout history, execution checkpoints, and outcomes (14)

- `session`
- `set_record`
- `set_prefix`
- `set_metric`
- `session_note`
- `session_origin`
- `session_plan_slot`
- `set_target`
- `set_dose_target`
- `session_slot_target`
- `session_runner_checkpoint`
- `session_outcome`
- `capability_session_evidence`
- `return_checkin_ack`

An in-progress runner checkpoint is durable. A backup policy must either include it consistently with its session graph or explicitly complete/cancel the session before snapshot; silently dropping it is not a faithful restore.

### Imported history, readiness, health, and subjective state (15)

- `history_import`
- `history_import_session`
- `history_import_set`
- `history_import_capability_evidence`
- `import_readiness_daily`
- `bodyweight_daily`
- `hrv_daily`
- `sleep_daily`
- `spo2_daily`
- `spo2_sample`
- `subjective_report`
- `report_severity`
- `niggle`
- `mech_daily`
- `state_vector`

Some of these are derived or aggregated, but no verified full rebuild path exists for the complete set. Until rebuild equivalence is proven, a restorable backup must retain them. This group contains health information and requires the encryption decision in the WO-03 docket.

### Bundled catalog, policy, taxonomy, and provenance (21)

- `movement`
- `movement_equipment`
- `movement_taxonomy`
- `movement_detail`
- `movement_prefix`
- `movement_beginner_whitelist`
- `movement_progression`
- `movement_logging_mode`
- `progression_policy`
- `movement_coaching_intent`
- `movement_time_policy`
- `movement_role_eligibility`
- `movement_capability_family`
- `movement_capability_edge`
- `movement_media`
- `movement_scope`
- `movement_content_correction`
- `movement_lift_family`
- `movement_assistance_relationship`
- `movement_sport_tracking`
- `movement_tier_alignment`

These rows are bundled/reference data rather than athlete-authored data. The candidate physical snapshot includes them and therefore preserves exact foreign-key identity. Format version, app schema version, migration slot, table count, every user table/column/index/trigger definition, and their fingerprint are checked before replacement. A newer or otherwise unsupported schema fails closed; no downgrade or inferred logical adapter is attempted.

## Non-table schema objects and superseded intermediates

- Views `v_readiness_inputs` and `v_training_daily_all` contain no independent rows. Physical snapshots retain their definitions with the database, while the restore schema contract deliberately fingerprints the 174 durable table/index/trigger objects.
- Indexes and triggers are schema/invariant objects, not independent data sets. They are nevertheless included by the physical snapshot and verified exhaustively because omitting or mutating them could weaken restored invariants.
- `user_profile` is created by 006, copied into `athlete_profile`, and dropped by 007; it is not live.
- `movement_equipment_v049`, `movement_role_eligibility_v052`, `routine_template_slot_v052`, and `planned_slot_autopilot_061` are migration replacement tables renamed into their final names; their temporary names are not live data classes.

## Candidate capacity and WO-05/WO-06 boundary

The in-memory v1 implementation fails closed above 8 MiB of aggregate decoded database snapshot bytes or above a 16 MiB portable file. Both live files and the running `VACUUM INTO` output total are checked before accumulating or reading the next snapshot. Larger streaming backups are explicitly deferred rather than weakening cryptography or risking constrained-device memory exhaustion.

Migration 064 supplies the shared neutral persistence contract and remains byte-identical to the frozen base. WO-03B protects and transfers that data but does not by itself ship the WO-05 capture UI or apply holds at every personalized-advice boundary. Those remain separately testable stages. This candidate must not be used to claim C6.

## CSV is not a backup

A future CSV history export may provide readable rows such as date, movement, set, reps/load/time, and effort. It will flatten relationships, omit most classes above, omit registry and preferences, and cannot be restored safely. It must be labelled “Export workout history (CSV)”, never “backup”, and must not be accepted by Restore backup.
