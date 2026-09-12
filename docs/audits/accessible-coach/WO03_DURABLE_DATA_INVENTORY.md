# WO-03 durable data inventory

Date: 2026-09-13
Originally frozen at `87624d9e43189ddd87db317e24d4379ef5a13fae`; updated by the Accessible Coach integration candidate.
Live chain: migration files through `064`; `004` is a parameterized materializer, not a migration. The migration array therefore has 63 entries and a fully migrated database reports `PRAGMA user_version = 63`. Slot `064` is the product-ratified neutral activity/support capture contract; it contains no executable clinical limit or screening schema.

## Discovery result

No restorable backup or restore implementation exists at the frozen source.

- `AK_HISTORY_V1` is a paste-only training-history import format. It imports sessions and sets after preview; it is not an export and cannot recreate profile, preferences, programs, routines, telemetry, or the athlete registry.
- The Coach Verification Lab can share a deliberately redacted diagnostic report. That report is not user data backup.
- `react-native-blob-util` can read and write known paths, but the repository has no OS create/open document picker bridge and no backup snapshot flow.
- There is no database backup API call, `VACUUM INTO`, recovery-copy flow, atomic swap, portable encryption, backup preview, or persisted “last successful backup” state in app source.

## Non-database durable data

`coach_athletes.json` is stored in the app document directory outside SQLite. It contains registry version, active athlete id, athlete ids/display names/database filenames/creation times, and the device-wide advanced-tools preference. Each athlete maps to a distinct SQLite file (`athlete_kinetics.db` for the default athlete, otherwise `ak_athlete_<id>.db`). A complete all-athletes transfer must keep the registry and every referenced database together. Copying only the active database is not a complete Coach Mode backup.

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

These tables are athlete-owned health/schedule information. A complete backup must include the graph atomically and use reviewed authenticated encryption before becoming shareable. The current generic backup contract is still design-only and does not yet provide that protected native adapter.

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

These rows are bundled/reference data rather than athlete-authored data. A physical SQLite snapshot naturally includes them. A future logical restore should normally reseed them from the target app and migrate athlete-owned references by stable identifiers; overwriting a newer app’s catalog with an older backup would be a downgrade hazard. That rule needs an integration adapter and cannot be inferred by the generic envelope.

## Non-table schema objects and superseded intermediates

- Views `v_readiness_inputs` and `v_training_daily_all` contain no independent rows and should be recreated by migrations, not serialized as data.
- Indexes and triggers are schema/invariant objects and should be recreated by migrations. They are not backup data sets.
- `user_profile` is created by 006, copied into `athlete_profile`, and dropped by 007; it is not live.
- `movement_equipment_v049`, `movement_role_eligibility_v052`, `routine_template_slot_v052`, and `planned_slot_autopilot_061` are migration replacement tables renamed into their final names; their temporary names are not live data classes.

## WO-05/WO-06 boundary

Migration 064 now supplies the shared neutral persistence contract. It does not by itself ship the WO-05 capture UI, apply holds at every personalized-advice boundary, or provide protected backup/restore. Those remain separately testable implementation stages. Do not call backup complete while the native encrypted adapter and all-table round trip are absent.

## CSV is not a backup

A future CSV history export may provide readable rows such as date, movement, set, reps/load/time, and effort. It will flatten relationships, omit most classes above, omit registry and preferences, and cannot be restored safely. It must be labelled “Export workout history (CSV)”, never “backup”, and must not be accepted by Restore backup.
