-- =============================================================================
-- 064_accessible_coach_support.sql
--
-- Product-authorized capture/accounting/mechanical-hold foundation for the
-- Accessible Coach work orders. This migration is intentionally neutral:
--   * activity kinds are log-only identities, never sport prescriptions;
--   * effort and duration remain separate nullable observations;
--   * custom names create no inferred demand, facility, or injury meaning;
--   * clinician text is user-reported and not independently verified;
--   * holds are explicit mechanical routing state, not medical decisions.
--
-- Excluded: screening questions/outcomes, diagnoses, numeric medical limits,
-- clinician verification, symptom thresholds, live-monitor timing, automatic
-- prose interpretation, cross-sport load scores, and clearance states.
--
-- Athlete ownership is provided by the repository's one-database-per-athlete
-- boundary. profile_slot is deliberately not used as athlete identity.
-- =============================================================================

CREATE TABLE IF NOT EXISTS activity_definition (
  activity_id      TEXT PRIMARY KEY CHECK (length(activity_id) BETWEEN 1 AND 160),
  kind_id          TEXT NOT NULL CHECK (kind_id IN
                    ('walking','running','swimming','cycling','strength_training',
                     'basketball','soccer','netball','rugby','cricket','field_hockey',
                     'volleyball','wheelchair_mobility','wheelchair_sport','custom')),
  display_name     TEXT NOT NULL CHECK (length(trim(display_name)) >= 1 AND length(display_name) <= 160),
  demand_class     TEXT NOT NULL CHECK (demand_class IN ('low','moderate','high','unknown')),
  demand_source    TEXT NOT NULL CHECK (demand_source IN ('user_reported','curated','unknown')),
  provenance       TEXT NOT NULL CHECK (provenance = 'user_reported'),
  created_at_ms    INTEGER NOT NULL CHECK (created_at_ms >= 0),
  updated_at_ms    INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms)
) STRICT;

CREATE TABLE IF NOT EXISTS activity_requirement (
  requirement_id    TEXT PRIMARY KEY CHECK (length(requirement_id) BETWEEN 1 AND 160),
  activity_id       TEXT NOT NULL REFERENCES activity_definition(activity_id) ON DELETE CASCADE,
  requirement_kind  TEXT NOT NULL CHECK (requirement_kind IN ('facility','equipment')),
  requirement_code  TEXT NOT NULL CHECK (
    (requirement_kind = 'facility' AND requirement_code IN
      ('pool','open_water','road_path','trail','court','field_pitch','indoor_space','gym','other','unknown'))
    OR
    (requirement_kind = 'equipment' AND requirement_code IN
      ('bicycle','stationary_cycle','handcycle','wheelchair','ball','stick','protective_gear','other','unknown'))
  ),
  requirement_state TEXT NOT NULL CHECK (requirement_state IN
                       ('known_available','known_unavailable','unknown','not_applicable')),
  provenance         TEXT NOT NULL CHECK (provenance = 'user_reported'),
  recorded_at_ms     INTEGER NOT NULL CHECK (recorded_at_ms >= 0),
  UNIQUE (activity_id, requirement_kind, requirement_code)
) STRICT;

CREATE TABLE IF NOT EXISTS activity_series (
  series_id               TEXT PRIMARY KEY CHECK (length(series_id) BETWEEN 1 AND 160),
  activity_id             TEXT NOT NULL REFERENCES activity_definition(activity_id) ON DELETE RESTRICT,
  revision                INTEGER NOT NULL CHECK (revision >= 1),
  recurrence_kind         TEXT NOT NULL CHECK (recurrence_kind = 'weekly'),
  local_weekday           INTEGER NOT NULL CHECK (local_weekday BETWEEN 0 AND 6),
  local_start_minute      INTEGER CHECK (local_start_minute IS NULL OR local_start_minute BETWEEN 0 AND 1439),
  timezone_id             TEXT NOT NULL CHECK (length(trim(timezone_id)) >= 1 AND length(timezone_id) <= 128),
  time_resolution_state   TEXT NOT NULL CHECK (time_resolution_state IN
                            ('unresolved','unambiguous','earlier_offset','later_offset','shift_forward_confirmed')),
  effective_start_date    TEXT NOT NULL CHECK (date(effective_start_date) IS NOT NULL
                                                AND date(effective_start_date) = effective_start_date),
  effective_end_date      TEXT CHECK (effective_end_date IS NULL OR
                            (date(effective_end_date) IS NOT NULL
                             AND date(effective_end_date) = effective_end_date
                             AND effective_end_date >= effective_start_date)),
  timing_commitment       TEXT NOT NULL CHECK (timing_commitment IN ('fixed','flexible')),
  expected_duration_min   INTEGER CHECK (expected_duration_min IS NULL OR expected_duration_min > 0),
  expected_effort         REAL CHECK (expected_effort IS NULL OR expected_effort BETWEEN 1.0 AND 10.0),
  effort_scale_id         TEXT CHECK (effort_scale_id IS NULL OR effort_scale_id = 'whole_session_effort_1_10'),
  effort_scale_version    INTEGER CHECK (effort_scale_version IS NULL OR effort_scale_version = 1),
  created_at_ms           INTEGER NOT NULL CHECK (created_at_ms >= 0),
  updated_at_ms           INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms),
  CHECK ((expected_effort IS NULL AND effort_scale_id IS NULL AND effort_scale_version IS NULL)
      OR (expected_effort IS NOT NULL AND effort_scale_id IS NOT NULL AND effort_scale_version IS NOT NULL)),
  CHECK (timing_commitment = 'flexible' OR local_start_minute IS NOT NULL),
  UNIQUE (series_id, activity_id)
) STRICT;

CREATE TABLE IF NOT EXISTS activity_occurrence (
  occurrence_id           TEXT PRIMARY KEY CHECK (length(occurrence_id) BETWEEN 1 AND 160),
  activity_id             TEXT NOT NULL REFERENCES activity_definition(activity_id) ON DELETE RESTRICT,
  series_id               TEXT,
  original_recurrence_key TEXT,
  origin_kind             TEXT NOT NULL CHECK (origin_kind IN ('manual','imported','coached_session')),
  origin_identity         TEXT NOT NULL CHECK (length(trim(origin_identity)) >= 1
                                                 AND length(origin_identity) <= 240),
  origin_session_id       INTEGER UNIQUE REFERENCES session(session_id) ON DELETE RESTRICT,
  revision                INTEGER NOT NULL CHECK (revision >= 1),
  local_date              TEXT NOT NULL CHECK (date(local_date) IS NOT NULL AND date(local_date) = local_date),
  local_start_minute      INTEGER CHECK (local_start_minute IS NULL OR local_start_minute BETWEEN 0 AND 1439),
  timezone_id             TEXT NOT NULL CHECK (length(trim(timezone_id)) >= 1 AND length(timezone_id) <= 128),
  time_resolution_state   TEXT NOT NULL CHECK (time_resolution_state IN
                            ('unresolved','unambiguous','earlier_offset','later_offset','shift_forward_confirmed')),
  resolved_start_at_ms    INTEGER CHECK (resolved_start_at_ms IS NULL OR resolved_start_at_ms >= 0),
  resolved_end_at_ms      INTEGER CHECK (resolved_end_at_ms IS NULL OR resolved_end_at_ms >= 0),
  resolver_version        TEXT CHECK (resolver_version IS NULL OR
                              (length(trim(resolver_version)) >= 1 AND length(resolver_version) <= 80)),
  occurrence_state        TEXT NOT NULL CHECK (occurrence_state IN ('planned','completed','cancelled','missed')),
  timing_commitment       TEXT NOT NULL CHECK (timing_commitment IN ('fixed','flexible')),
  modality_id             TEXT NOT NULL DEFAULT 'unknown' CHECK (modality_id IN
                            ('outdoor_bicycle','stationary_upright','stationary_recumbent',
                             'handcycle','other','unknown')),
  purpose_id              TEXT NOT NULL DEFAULT 'unknown' CHECK (purpose_id IN
                            ('practice','match','recreation','conditioning','transport','other','unknown')),
  expected_duration_min   INTEGER CHECK (expected_duration_min IS NULL OR expected_duration_min > 0),
  expected_effort         REAL CHECK (expected_effort IS NULL OR expected_effort BETWEEN 1.0 AND 10.0),
  effort_scale_id         TEXT CHECK (effort_scale_id IS NULL OR effort_scale_id = 'whole_session_effort_1_10'),
  effort_scale_version    INTEGER CHECK (effort_scale_version IS NULL OR effort_scale_version = 1),
  created_at_ms           INTEGER NOT NULL CHECK (created_at_ms >= 0),
  updated_at_ms           INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms),
  FOREIGN KEY (series_id, activity_id) REFERENCES activity_series(series_id, activity_id) ON DELETE RESTRICT,
  CHECK ((series_id IS NULL AND original_recurrence_key IS NULL)
      OR (series_id IS NOT NULL AND original_recurrence_key IS NOT NULL
          AND length(trim(original_recurrence_key)) >= 1
          AND length(original_recurrence_key) <= 160)),
  CHECK ((origin_kind = 'coached_session' AND origin_session_id IS NOT NULL)
      OR (origin_kind <> 'coached_session' AND origin_session_id IS NULL)),
  CHECK ((resolved_start_at_ms IS NULL AND resolved_end_at_ms IS NULL AND resolver_version IS NULL)
      OR (resolved_start_at_ms IS NOT NULL AND resolved_end_at_ms IS NOT NULL
          AND resolver_version IS NOT NULL AND resolved_end_at_ms >= resolved_start_at_ms)),
  CHECK ((time_resolution_state = 'unresolved'
            AND resolved_start_at_ms IS NULL AND resolved_end_at_ms IS NULL AND resolver_version IS NULL)
      OR (time_resolution_state <> 'unresolved'
            AND resolved_start_at_ms IS NOT NULL AND resolved_end_at_ms IS NOT NULL
            AND resolver_version IS NOT NULL)),
  CHECK ((expected_effort IS NULL AND effort_scale_id IS NULL AND effort_scale_version IS NULL)
      OR (expected_effort IS NOT NULL AND effort_scale_id IS NOT NULL AND effort_scale_version IS NOT NULL)),
  CHECK (timing_commitment = 'flexible'
      OR (local_start_minute IS NOT NULL AND time_resolution_state <> 'unresolved')),
  UNIQUE (series_id, original_recurrence_key),
  UNIQUE (origin_kind, origin_identity)
) STRICT;

CREATE TABLE IF NOT EXISTS activity_completion (
  occurrence_id          TEXT PRIMARY KEY REFERENCES activity_occurrence(occurrence_id) ON DELETE RESTRICT,
  completion_state       TEXT NOT NULL CHECK (completion_state IN ('partial','completed')),
  actual_start_at_ms     INTEGER CHECK (actual_start_at_ms IS NULL OR actual_start_at_ms >= 0),
  actual_end_at_ms       INTEGER CHECK (actual_end_at_ms IS NULL OR actual_end_at_ms >= 0),
  actual_duration_min    INTEGER CHECK (actual_duration_min IS NULL OR actual_duration_min > 0),
  actual_effort          REAL CHECK (actual_effort IS NULL OR actual_effort BETWEEN 1.0 AND 10.0),
  effort_scale_id        TEXT CHECK (effort_scale_id IS NULL OR effort_scale_id = 'whole_session_effort_1_10'),
  effort_scale_version   INTEGER CHECK (effort_scale_version IS NULL OR effort_scale_version = 1),
  effort_reported_at_ms  INTEGER CHECK (effort_reported_at_ms IS NULL OR effort_reported_at_ms >= 0),
  provenance             TEXT NOT NULL CHECK (provenance IN ('user_reported','imported','coached_session')),
  recorded_at_ms         INTEGER NOT NULL CHECK (recorded_at_ms >= 0),
  CHECK ((actual_start_at_ms IS NULL AND actual_end_at_ms IS NULL)
      OR (actual_start_at_ms IS NOT NULL AND actual_end_at_ms IS NOT NULL
          AND actual_end_at_ms >= actual_start_at_ms)),
  CHECK ((actual_effort IS NULL AND effort_scale_id IS NULL
          AND effort_scale_version IS NULL AND effort_reported_at_ms IS NULL)
      OR (actual_effort IS NOT NULL AND effort_scale_id IS NOT NULL
          AND effort_scale_version IS NOT NULL AND effort_reported_at_ms IS NOT NULL))
) STRICT;

CREATE TABLE IF NOT EXISTS activity_source_link (
  source_link_id    TEXT PRIMARY KEY CHECK (length(source_link_id) BETWEEN 1 AND 160),
  occurrence_id    TEXT NOT NULL REFERENCES activity_occurrence(occurrence_id) ON DELETE RESTRICT,
  source_kind      TEXT NOT NULL CHECK (source_kind IN ('manual','imported','coached_session')),
  source_identity  TEXT NOT NULL CHECK (length(trim(source_identity)) >= 1
                                          AND length(source_identity) <= 240),
  linked_session_id INTEGER UNIQUE REFERENCES session(session_id) ON DELETE RESTRICT,
  recorded_at_ms   INTEGER NOT NULL CHECK (recorded_at_ms >= 0),
  CHECK ((source_kind = 'coached_session' AND linked_session_id IS NOT NULL)
      OR (source_kind <> 'coached_session' AND linked_session_id IS NULL)),
  UNIQUE (source_kind, source_identity)
) STRICT;

CREATE TABLE IF NOT EXISTS activity_typical_week_report (
  report_id          TEXT PRIMARY KEY CHECK (length(report_id) BETWEEN 1 AND 160),
  reported_local_date TEXT NOT NULL CHECK (date(reported_local_date) IS NOT NULL
                                            AND date(reported_local_date) = reported_local_date),
  coverage_start_date TEXT NOT NULL CHECK (date(coverage_start_date) IS NOT NULL
                                            AND date(coverage_start_date) = coverage_start_date),
  coverage_end_date   TEXT NOT NULL CHECK (date(coverage_end_date) IS NOT NULL
                                           AND date(coverage_end_date) = coverage_end_date
                                           AND coverage_end_date >= coverage_start_date),
  timezone_id         TEXT NOT NULL CHECK (length(trim(timezone_id)) >= 1 AND length(timezone_id) <= 128),
  recorded_at_ms      INTEGER NOT NULL CHECK (recorded_at_ms >= 0)
) STRICT;

CREATE TABLE IF NOT EXISTS activity_typical_week_item (
  item_id              TEXT PRIMARY KEY CHECK (length(item_id) BETWEEN 1 AND 160),
  report_id            TEXT NOT NULL REFERENCES activity_typical_week_report(report_id) ON DELETE CASCADE,
  activity_id          TEXT NOT NULL REFERENCES activity_definition(activity_id) ON DELETE RESTRICT,
  local_weekday        INTEGER CHECK (local_weekday IS NULL OR local_weekday BETWEEN 0 AND 6),
  typical_duration_min INTEGER CHECK (typical_duration_min IS NULL OR typical_duration_min > 0),
  typical_effort       REAL CHECK (typical_effort IS NULL OR typical_effort BETWEEN 1.0 AND 10.0),
  effort_scale_id      TEXT CHECK (effort_scale_id IS NULL OR effort_scale_id = 'whole_session_effort_1_10'),
  effort_scale_version INTEGER CHECK (effort_scale_version IS NULL OR effort_scale_version = 1),
  CHECK ((typical_effort IS NULL AND effort_scale_id IS NULL AND effort_scale_version IS NULL)
      OR (typical_effort IS NOT NULL AND effort_scale_id IS NOT NULL AND effort_scale_version IS NOT NULL)),
  UNIQUE (report_id, activity_id, local_weekday)
) STRICT;

CREATE TABLE IF NOT EXISTS health_support_profile (
  singleton_id       INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  revision           INTEGER NOT NULL CHECK (revision >= 1),
  review_state       TEXT NOT NULL CHECK (review_state IN ('not_assessed','pending_review','review_required')),
  details_visibility TEXT NOT NULL CHECK (details_visibility IN ('collapsed','expanded')),
  updated_at_ms      INTEGER NOT NULL CHECK (updated_at_ms >= 0)
) STRICT;

CREATE TABLE IF NOT EXISTS health_support_preference (
  preference_id  TEXT PRIMARY KEY CHECK (length(preference_id) BETWEEN 1 AND 160),
  revision       INTEGER NOT NULL CHECK (revision >= 1),
  preference_kind TEXT NOT NULL UNIQUE CHECK (preference_kind IN ('position','position_transitions','rest')),
  reported_value TEXT NOT NULL,
  detail_text    TEXT CHECK (detail_text IS NULL OR length(detail_text) <= 4000),
  provenance     TEXT NOT NULL CHECK (provenance = 'user_reported'),
  recorded_at_ms INTEGER NOT NULL CHECK (recorded_at_ms >= 0),
  updated_at_ms  INTEGER NOT NULL CHECK (updated_at_ms >= recorded_at_ms),
  CHECK ((preference_kind = 'position' AND reported_value IN
           ('unanswered','no_preference','seated','recumbent','standing','other'))
      OR (preference_kind = 'position_transitions' AND reported_value IN
           ('unanswered','concern_reported','no_concern_reported'))
      OR (preference_kind = 'rest' AND reported_value IN
           ('unanswered','need_reported','no_need_reported')))
) STRICT;

CREATE TABLE IF NOT EXISTS health_support_note (
  note_id        TEXT PRIMARY KEY CHECK (length(note_id) BETWEEN 1 AND 160),
  revision       INTEGER NOT NULL CHECK (revision >= 1),
  note_kind      TEXT NOT NULL CHECK (note_kind IN ('general','functional_context','symptom_trigger','rest_context')),
  body_text      TEXT NOT NULL CHECK (length(trim(body_text)) >= 1 AND length(body_text) <= 4000),
  provenance     TEXT NOT NULL CHECK (provenance = 'user_reported'),
  recorded_at_ms INTEGER NOT NULL CHECK (recorded_at_ms >= 0),
  updated_at_ms  INTEGER NOT NULL CHECK (updated_at_ms >= recorded_at_ms)
) STRICT;

CREATE TABLE IF NOT EXISTS clinician_instruction (
  instruction_id  TEXT PRIMARY KEY CHECK (length(instruction_id) BETWEEN 1 AND 160),
  current_revision INTEGER NOT NULL CHECK (current_revision >= 1),
  created_at_ms    INTEGER NOT NULL CHECK (created_at_ms >= 0),
  UNIQUE (instruction_id, current_revision),
  FOREIGN KEY (instruction_id, current_revision)
    REFERENCES clinician_instruction_revision(instruction_id, revision)
    DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS clinician_instruction_revision (
  instruction_id      TEXT NOT NULL REFERENCES clinician_instruction(instruction_id) ON DELETE CASCADE,
  revision            INTEGER NOT NULL CHECK (revision >= 1),
  instruction_text    TEXT NOT NULL CHECK (length(trim(instruction_text)) >= 1
                                             AND length(instruction_text) <= 16000),
  issuer_text         TEXT CHECK (issuer_text IS NULL OR length(issuer_text) <= 160),
  source_class        TEXT NOT NULL CHECK (source_class = 'clinician_guidance_as_reported'),
  provenance          TEXT NOT NULL CHECK (provenance = 'user_reported'),
  verification_state  TEXT NOT NULL CHECK (verification_state = 'not_verified'),
  recorded_at_ms      INTEGER NOT NULL CHECK (recorded_at_ms >= 0),
  instruction_date    TEXT CHECK (instruction_date IS NULL OR
                           (date(instruction_date) IS NOT NULL AND date(instruction_date) = instruction_date)),
  effective_date      TEXT CHECK (effective_date IS NULL OR
                           (date(effective_date) IS NOT NULL AND date(effective_date) = effective_date)),
  review_date         TEXT CHECK (review_date IS NULL OR
                           (date(review_date) IS NOT NULL AND date(review_date) = review_date)),
  expiry_date         TEXT CHECK (expiry_date IS NULL OR
                           (date(expiry_date) IS NOT NULL AND date(expiry_date) = expiry_date)),
  date_zone_id        TEXT CHECK (date_zone_id IS NULL OR
                           (length(trim(date_zone_id)) >= 1 AND length(date_zone_id) <= 128)),
  date_status         TEXT NOT NULL CHECK (date_status IN ('unknown','as_reported')),
  transcription_state TEXT NOT NULL CHECK (transcription_state IN ('draft','user_confirmed')),
  confirmed_at_ms     INTEGER CHECK (confirmed_at_ms IS NULL OR confirmed_at_ms >= recorded_at_ms),
  supersedes_revision INTEGER CHECK (supersedes_revision IS NULL OR
                                      (supersedes_revision >= 1 AND supersedes_revision < revision)),
  lifecycle           TEXT NOT NULL CHECK (lifecycle IN ('current','superseded','withdrawn')),
  PRIMARY KEY (instruction_id, revision),
  CHECK ((transcription_state = 'draft' AND confirmed_at_ms IS NULL)
      OR (transcription_state = 'user_confirmed' AND confirmed_at_ms IS NOT NULL))
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS health_support_hold (
  hold_id              TEXT PRIMARY KEY CHECK (length(hold_id) BETWEEN 1 AND 160),
  revision             INTEGER NOT NULL CHECK (revision >= 1),
  instruction_id       TEXT,
  instruction_revision INTEGER,
  origin               TEXT NOT NULL CHECK (origin IN ('user_requested','instruction_review','deleted_support_review')),
  state                TEXT NOT NULL CHECK (state IN ('held','withdrawn')),
  reason_code          TEXT NOT NULL CHECK (reason_code IN
                        ('review_requested','instruction_unreviewed','scope_unknown','source_changed',
                         'date_unresolved','conflict_reported','support_deleted')),
  created_at_ms        INTEGER NOT NULL CHECK (created_at_ms >= 0),
  updated_at_ms        INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms),
  FOREIGN KEY (instruction_id, instruction_revision)
    REFERENCES clinician_instruction_revision(instruction_id, revision) ON DELETE RESTRICT,
  CHECK ((instruction_id IS NULL AND instruction_revision IS NULL)
      OR (instruction_id IS NOT NULL AND instruction_revision IS NOT NULL)),
  CHECK ((origin = 'deleted_support_review' AND instruction_id IS NULL AND reason_code = 'support_deleted')
      OR (origin <> 'deleted_support_review' AND reason_code <> 'support_deleted'))
) STRICT;

-- Content-free provenance for prospective recommendation attempts. The record
-- stores stable identities and mechanical reason codes only; health prose must
-- never be copied here. Application wiring is a later, separately-gated stage.
CREATE TABLE IF NOT EXISTS recommendation_support_record (
  decision_id            TEXT PRIMARY KEY CHECK (length(decision_id) BETWEEN 1 AND 160),
  advice_target_kind     TEXT NOT NULL CHECK (advice_target_kind IN
                          ('program','block','session','slot','movement_substitution')),
  advice_target_identity TEXT NOT NULL CHECK (length(trim(advice_target_identity)) >= 1
                                                AND length(advice_target_identity) <= 160),
  support_status         TEXT NOT NULL CHECK (support_status IN
                          ('available','held','setup_required','support_unavailable')),
  engine_version         TEXT NOT NULL CHECK (length(trim(engine_version)) >= 1
                                                AND length(engine_version) <= 80),
  generated_at_ms        INTEGER NOT NULL CHECK (generated_at_ms >= 0),
  UNIQUE (advice_target_kind, advice_target_identity, generated_at_ms)
) STRICT;

CREATE TABLE IF NOT EXISTS recommendation_activity_basis (
  decision_id         TEXT NOT NULL REFERENCES recommendation_support_record(decision_id) ON DELETE CASCADE,
  occurrence_id       TEXT NOT NULL REFERENCES activity_occurrence(occurrence_id) ON DELETE RESTRICT,
  occurrence_revision INTEGER NOT NULL CHECK (occurrence_revision >= 1),
  PRIMARY KEY (decision_id, occurrence_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS recommendation_hold_basis (
  decision_id  TEXT NOT NULL REFERENCES recommendation_support_record(decision_id) ON DELETE CASCADE,
  hold_id      TEXT NOT NULL REFERENCES health_support_hold(hold_id) ON DELETE RESTRICT,
  hold_revision INTEGER NOT NULL CHECK (hold_revision >= 1),
  reason_code  TEXT NOT NULL CHECK (reason_code IN
               ('review_requested','instruction_unreviewed','scope_unknown','source_changed',
                'date_unresolved','conflict_reported','support_deleted')),
  PRIMARY KEY (decision_id, hold_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS health_support_scope (
  scope_id             TEXT PRIMARY KEY CHECK (length(scope_id) BETWEEN 1 AND 160),
  instruction_id       TEXT,
  instruction_revision INTEGER,
  hold_id              TEXT REFERENCES health_support_hold(hold_id) ON DELETE RESTRICT,
  target_kind          TEXT NOT NULL CHECK (target_kind IN
                        ('all_prescription','activity_definition','activity_series',
                         'activity_occurrence','movement','unresolved')),
  activity_id          TEXT REFERENCES activity_definition(activity_id) ON DELETE RESTRICT,
  series_id            TEXT REFERENCES activity_series(series_id) ON DELETE RESTRICT,
  occurrence_id        TEXT REFERENCES activity_occurrence(occurrence_id) ON DELETE RESTRICT,
  movement_id          INTEGER REFERENCES movement(movement_id) ON DELETE RESTRICT,
  reported_scope_text  TEXT CHECK (reported_scope_text IS NULL OR length(reported_scope_text) <= 4000),
  FOREIGN KEY (instruction_id, instruction_revision)
    REFERENCES clinician_instruction_revision(instruction_id, revision) ON DELETE RESTRICT,
  CHECK ((instruction_id IS NOT NULL AND instruction_revision IS NOT NULL AND hold_id IS NULL)
      OR (instruction_id IS NULL AND instruction_revision IS NULL AND hold_id IS NOT NULL)),
  CHECK ((target_kind IN ('all_prescription','unresolved')
            AND activity_id IS NULL AND series_id IS NULL AND occurrence_id IS NULL AND movement_id IS NULL)
      OR (target_kind = 'activity_definition'
            AND activity_id IS NOT NULL AND series_id IS NULL AND occurrence_id IS NULL AND movement_id IS NULL)
      OR (target_kind = 'activity_series'
            AND activity_id IS NULL AND series_id IS NOT NULL AND occurrence_id IS NULL AND movement_id IS NULL)
      OR (target_kind = 'activity_occurrence'
            AND activity_id IS NULL AND series_id IS NULL AND occurrence_id IS NOT NULL AND movement_id IS NULL)
      OR (target_kind = 'movement'
            AND activity_id IS NULL AND series_id IS NULL AND occurrence_id IS NULL AND movement_id IS NOT NULL))
) STRICT;

-- A completion is factual actual work and must be paired with the occurrence's
-- explicit completed state. Planned/cancelled/missed rows never count merely
-- because a detached completion was inserted.
CREATE TRIGGER IF NOT EXISTS trg_activity_completion_completed_bi
BEFORE INSERT ON activity_completion
WHEN NOT EXISTS (
  SELECT 1 FROM activity_occurrence o
  WHERE o.occurrence_id = NEW.occurrence_id AND o.occurrence_state = 'completed'
)
BEGIN
  SELECT RAISE(ABORT, 'activity_completion: occurrence is not completed');
END;

CREATE TRIGGER IF NOT EXISTS trg_activity_completion_completed_bu
BEFORE UPDATE OF occurrence_id ON activity_completion
WHEN NOT EXISTS (
  SELECT 1 FROM activity_occurrence o
  WHERE o.occurrence_id = NEW.occurrence_id AND o.occurrence_state = 'completed'
)
BEGIN
  SELECT RAISE(ABORT, 'activity_completion: occurrence is not completed');
END;

CREATE TRIGGER IF NOT EXISTS trg_activity_occurrence_completion_consistency_bu
BEFORE UPDATE OF occurrence_state ON activity_occurrence
WHEN NEW.occurrence_state <> 'completed'
 AND EXISTS (SELECT 1 FROM activity_completion c WHERE c.occurrence_id = NEW.occurrence_id)
BEGIN
  SELECT RAISE(ABORT, 'activity_occurrence: completion must be reconciled before changing completed state');
END;

CREATE TRIGGER IF NOT EXISTS trg_activity_occurrence_origin_immutable_bu
BEFORE UPDATE OF origin_kind, origin_identity, origin_session_id ON activity_occurrence
WHEN NEW.origin_kind <> OLD.origin_kind OR NEW.origin_identity <> OLD.origin_identity
 OR NEW.origin_session_id IS NOT OLD.origin_session_id
BEGIN
  SELECT RAISE(ABORT, 'activity_occurrence: origin identity is immutable');
END;

-- Source identity is global across origins and explicit reconciliation links.
-- Close both insertion orders: the source-link trigger below handles
-- origin-first, while this trigger handles link-first.
CREATE TRIGGER IF NOT EXISTS trg_activity_occurrence_source_consistency_bi
BEFORE INSERT ON activity_occurrence
WHEN EXISTS (
  SELECT 1 FROM activity_source_link l
  WHERE l.source_kind = NEW.origin_kind
    AND l.source_identity = NEW.origin_identity
    AND l.occurrence_id <> NEW.occurrence_id
)
BEGIN
  SELECT RAISE(ABORT, 'activity_occurrence: source identity belongs to another occurrence');
END;

CREATE TRIGGER IF NOT EXISTS trg_activity_source_link_origin_consistency_bi
BEFORE INSERT ON activity_source_link
WHEN EXISTS (
  SELECT 1 FROM activity_occurrence o
  WHERE o.origin_kind = NEW.source_kind
    AND o.origin_identity = NEW.source_identity
    AND o.occurrence_id <> NEW.occurrence_id
)
BEGIN
  SELECT RAISE(ABORT, 'activity_source_link: source origin belongs to another occurrence');
END;

CREATE TRIGGER IF NOT EXISTS trg_activity_source_link_identity_immutable_bu
BEFORE UPDATE OF occurrence_id, source_kind, source_identity, linked_session_id ON activity_source_link
WHEN NEW.occurrence_id <> OLD.occurrence_id
 OR NEW.source_kind <> OLD.source_kind
 OR NEW.source_identity <> OLD.source_identity
 OR NEW.linked_session_id IS NOT OLD.linked_session_id
BEGIN
  SELECT RAISE(ABORT, 'activity_source_link: identity mapping is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_health_support_note_limit_bi
BEFORE INSERT ON health_support_note
WHEN (SELECT COUNT(*) FROM health_support_note) >= 256
BEGIN
  SELECT RAISE(ABORT, 'health_support_note: per-athlete limit reached');
END;

CREATE TRIGGER IF NOT EXISTS trg_clinician_instruction_limit_bi
BEFORE INSERT ON clinician_instruction
WHEN (SELECT COUNT(*) FROM clinician_instruction) >= 64
BEGIN
  SELECT RAISE(ABORT, 'clinician_instruction: per-athlete limit reached');
END;

CREATE TRIGGER IF NOT EXISTS trg_clinician_instruction_revision_limit_bi
BEFORE INSERT ON clinician_instruction_revision
WHEN (SELECT COUNT(*) FROM clinician_instruction_revision
      WHERE instruction_id = NEW.instruction_id) >= 64
BEGIN
  SELECT RAISE(ABORT, 'clinician_instruction_revision: per-instruction limit reached');
END;

CREATE TRIGGER IF NOT EXISTS trg_clinician_instruction_revision_limit_bu
BEFORE UPDATE OF instruction_id ON clinician_instruction_revision
WHEN NEW.instruction_id <> OLD.instruction_id
 AND (SELECT COUNT(*) FROM clinician_instruction_revision
      WHERE instruction_id = NEW.instruction_id) >= 64
BEGIN
  SELECT RAISE(ABORT, 'clinician_instruction_revision: per-instruction limit reached');
END;

CREATE TRIGGER IF NOT EXISTS trg_health_support_scope_limit_bi
BEFORE INSERT ON health_support_scope
WHEN (NEW.hold_id IS NOT NULL AND
      (SELECT COUNT(*) FROM health_support_scope WHERE hold_id = NEW.hold_id) >= 256)
  OR (NEW.instruction_id IS NOT NULL AND
      (SELECT COUNT(*) FROM health_support_scope
        WHERE instruction_id = NEW.instruction_id
          AND instruction_revision = NEW.instruction_revision) >= 256)
BEGIN
  SELECT RAISE(ABORT, 'health_support_scope: owner scope limit reached');
END;

CREATE TRIGGER IF NOT EXISTS trg_health_support_scope_limit_bu
BEFORE UPDATE OF hold_id, instruction_id, instruction_revision ON health_support_scope
WHEN NOT (NEW.hold_id IS OLD.hold_id
          AND NEW.instruction_id IS OLD.instruction_id
          AND NEW.instruction_revision IS OLD.instruction_revision)
 AND ((NEW.hold_id IS NOT NULL AND
       (SELECT COUNT(*) FROM health_support_scope WHERE hold_id = NEW.hold_id) >= 256)
   OR (NEW.instruction_id IS NOT NULL AND
       (SELECT COUNT(*) FROM health_support_scope
         WHERE instruction_id = NEW.instruction_id
           AND instruction_revision = NEW.instruction_revision) >= 256))
BEGIN
  SELECT RAISE(ABORT, 'health_support_scope: owner scope limit reached');
END;

-- Held review state may be withdrawn only as an explicit versioned action and
-- cannot disappear by absence. Withdrawn rows may be deleted later because
-- they no longer gate personalized advice.
CREATE TRIGGER IF NOT EXISTS trg_health_support_hold_no_delete_held_bd
BEFORE DELETE ON health_support_hold
WHEN OLD.state = 'held'
BEGIN
  SELECT RAISE(ABORT, 'health_support_hold: held state cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS trg_health_support_hold_versioned_withdrawal_bu
BEFORE UPDATE OF state ON health_support_hold
WHEN OLD.state = 'held' AND NEW.state = 'withdrawn' AND NEW.revision <= OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'health_support_hold: withdrawal requires a revision increment');
END;

-- Privacy-preserving deletion: remove the transcription and its direct scopes,
-- then retain only a content-free held/withdrawn marker and any separately
-- recorded hold scopes. An unscoped held marker fails closed athlete-wide.
CREATE TRIGGER IF NOT EXISTS trg_clinician_instruction_delete_bd
BEFORE DELETE ON clinician_instruction
BEGIN
  DELETE FROM health_support_scope WHERE instruction_id = OLD.instruction_id;
  UPDATE health_support_hold
     SET instruction_id = NULL,
         instruction_revision = NULL,
         origin = 'deleted_support_review',
         reason_code = 'support_deleted',
         revision = revision + 1
   WHERE instruction_id = OLD.instruction_id;
END;

CREATE INDEX IF NOT EXISTS idx_activity_occurrence_local_date
  ON activity_occurrence(local_date, occurrence_state);
CREATE INDEX IF NOT EXISTS idx_activity_occurrence_series
  ON activity_occurrence(series_id, original_recurrence_key);
CREATE INDEX IF NOT EXISTS idx_activity_source_occurrence
  ON activity_source_link(occurrence_id);
CREATE INDEX IF NOT EXISTS idx_health_support_scope_instruction
  ON health_support_scope(instruction_id, instruction_revision);
CREATE INDEX IF NOT EXISTS idx_health_support_scope_hold
  ON health_support_scope(hold_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_activity_occurrence
  ON recommendation_activity_basis(occurrence_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_hold
  ON recommendation_hold_basis(hold_id);
