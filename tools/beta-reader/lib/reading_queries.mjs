// The reading plan's queries, run read-only once per consenting athlete database.
// SQL is copied verbatim from docs/release/beta/plan/LOG_READING_PLAN.md (the
// line range of each block is given). Each analyser turns rows into integer
// counts only. No estimate is computed: effort is counted as RPE pairs under
// the RPE 6 floor, never as an e1RM value (ratified by
// docs/decisions/E1RM_RPE_FLOOR_2026-10-15.md and the progression decisions).
// Free text (notes, report text, question text) is never placed in counts.
import { createHash } from 'node:crypto';

const SQL = {
  // LOG_READING_PLAN.md:31-41
  sessionInventory: `SELECT s.session_id, s.session_date, o.outcome_kind, o.training_age,
       o.planned_set_count, o.logged_set_count, o.skipped_slot_count,
       o.missing_unskipped_set_count, o.finalized_at_ms,
       c.phase AS unfinished_phase
FROM session s
LEFT JOIN session_outcome o USING (session_id)
LEFT JOIN session_runner_checkpoint c USING (session_id)
WHERE s.session_date BETWEEN :start_date AND :end_date
ORDER BY s.session_date, s.session_id;`,
  // LOG_READING_PLAN.md:49-73
  completion: `SELECT p.session_id, p.session_plan_slot_id, p.movement_id,
       p.provenance_kind, p.planned_sets, p.planned_reps, p.target_rpe,
       d.target_kind, d.target_reps, d.target_seconds,
       CASE WHEN k.session_plan_slot_id IS NOT NULL THEN 1
            WHEN o.skipped_slot_count = (
              SELECT COUNT(*) FROM session_skipped_slot k2
              JOIN session_plan_slot p2 USING (session_plan_slot_id)
              WHERE p2.session_id = p.session_id
            ) THEN 0 ELSE NULL END AS recorded_skip,
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
ORDER BY p.session_id, p.slot_index;`,
  // LOG_READING_PLAN.md:79-90
  unmapped: `SELECT r.session_id, r.set_id, r.movement_id, t.session_plan_slot_id,
       t.provenance_kind
FROM set_record r
JOIN session s USING (session_id)
LEFT JOIN set_target t USING (set_id)
LEFT JOIN session_plan_slot p ON p.session_plan_slot_id = t.session_plan_slot_id
WHERE s.session_date BETWEEN :start_date AND :end_date
  AND (p.session_plan_slot_id IS NULL OR p.session_id <> r.session_id
       OR p.movement_id <> r.movement_id)
ORDER BY r.session_id, r.set_id;`,
  // LOG_READING_PLAN.md:98-110
  loads: `SELECT r.session_id, r.set_id, r.movement_id, r.load_kg AS lifted_kg,
       l.load_source, l.shown_load_kg, l.advisory_kg, l.advisory_kind,
       CASE WHEN l.set_id IS NULL THEN 'unrecorded'
            WHEN l.shown_load_kg IS NULL THEN 'blank'
            ELSE 'numeric' END AS seed_state,
       CASE WHEN l.shown_load_kg IS NOT NULL
            THEN r.load_kg - l.shown_load_kg END AS lifted_minus_seed_kg
FROM set_record r JOIN session s USING (session_id)
LEFT JOIN set_load_shown l USING (set_id)
WHERE s.session_date BETWEEN :start_date AND :end_date
ORDER BY r.logged_at_ms, r.set_id;`,
  // LOG_READING_PLAN.md:119-125
  effort: `SELECT r.set_id, r.session_id, s.session_date, r.movement_id,
       r.reps, r.load_kg, r.rpe, r.logged_at_ms, d.target_kind,
       CASE WHEN r.rpe IS NULL THEN 'unanswered' ELSE 'answered' END AS effort_state
FROM set_record r JOIN session s USING (session_id)
LEFT JOIN set_dose_target d USING (set_id)
WHERE s.session_date BETWEEN :start_date AND :end_date
ORDER BY r.movement_id, s.session_date, r.session_id, r.logged_at_ms, r.set_id;`,
  // LOG_READING_PLAN.md:135-143
  sessionFeel: `SELECT s.session_id, s.session_date, o.outcome_kind, f.feel,
       f.reason_pain, f.reason_tired, f.reason_unwell, f.reason_technique,
       f.reason_equipment, f.reason_time, f.reason_felt_good, f.reason_other,
       f.recorded_at_ms, n.note, n.created_at_ms AS note_created_at_ms
FROM session s JOIN session_outcome o USING (session_id)
LEFT JOIN session_feel f USING (session_id)
LEFT JOIN session_note n USING (session_id)
WHERE s.session_date BETWEEN :start_date AND :end_date
ORDER BY s.session_date, s.session_id;`,
  // LOG_READING_PLAN.md:153-158
  symptoms: `SELECT report_id, date, reported_at_ms, raw_text, matched_entry_id,
       similarity, halt, load_modifier, set_modifier, rpe_cap
FROM subjective_report
WHERE reported_at_ms >= :start_ms AND reported_at_ms < :end_ms
ORDER BY reported_at_ms, report_id;`,
  // LOG_READING_PLAN.md:167-172
  attribution: `SELECT p.session_id, p.session_plan_slot_id, p.source_planned_slot_id,
       a.rpe_delta, a.set_delta, a.reason
FROM session_plan_slot p JOIN session s USING (session_id)
LEFT JOIN planned_slot_autopilot a ON a.planned_slot_id = p.source_planned_slot_id
WHERE s.session_date BETWEEN :start_date AND :end_date
ORDER BY p.session_id, p.slot_index;`,
  // LOG_READING_PLAN.md:182-185
  questions: `SELECT asked_at, question_text, outcome_kind, glossary_term_id
FROM question_log
WHERE asked_at >= :start_ms AND asked_at < :end_ms
ORDER BY asked_at;`,
};

const OUTCOME_KINDS = ['followed_plan', 'adapted_session', 'stopped_safely', 'session_recorded'];
const TRAINING_AGES = ['beginner', 'intermediate', 'advanced', 'elite'];
const PROVENANCE_KINDS = ['planned', 'substituted', 'day_swapped', 'added', 'free_form'];
const LOAD_SOURCES = ['seeded', 'history', 'derived', 'manual'];
const ADVISORY_KINDS = ['apre', 'onerm', 'history', 'none'];
const FEELS = ['as_planned', 'harder', 'easier', 'stopped_early'];
const REASONS = ['pain', 'tired', 'unwell', 'technique', 'equipment', 'time', 'felt_good', 'other'];
const RE_ATTRIBUTION_REASONS = ['eased', 'raised', 'held_safety'];
const QUESTION_OUTCOMES = ['card', 'none', 'refer'];

const zeroed = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));
const bump = (map, key) => { map[key] = (map[key] ?? 0) + 1; };
const hasText = (value) => value !== null && value !== undefined && String(value).trim() !== '';

function effortClass(row) {
  if (row.rpe === null || row.rpe === undefined) return 'unrated';
  const rpe = Number(row.rpe);
  if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10) return 'out_of_domain';
  if (rpe < 6) return 'below_floor';
  if (row.target_kind !== 'reps') return 'no_reps_dose';
  if (!(Number(row.reps) >= 1) || !(Number(row.load_kg) > 0)) return 'non_positive';
  return 'eligible';
}

export const QUERIES = [
  {
    name: 'session_inventory', sql: SQL.sessionInventory, bind: 'dates', tables: ['session', 'session_outcome', 'session_runner_checkpoint'],
    analyse(rows) {
      const counts = { started: rows.length, finalized: 0, unfinished: 0, unaccounted: 0, byOutcomeKind: zeroed(OUTCOME_KINDS), byTrainingAge: zeroed(TRAINING_AGES) };
      for (const row of rows) {
        if (row.outcome_kind !== null) {
          counts.finalized += 1;
          bump(counts.byOutcomeKind, row.outcome_kind);
          bump(counts.byTrainingAge, row.training_age);
        } else if (row.unfinished_phase !== null) {
          counts.unfinished += 1;
        } else {
          counts.unaccounted += 1;
        }
      }
      return counts;
    },
  },
  {
    name: 'completion_per_slot', sql: SQL.completion, bind: 'dates', tables: ['session_plan_slot', 'session', 'session_outcome', 'session_slot_target', 'session_skipped_slot', 'set_target', 'set_record'],
    analyse(rows) {
      const counts = {
        slots: 0, plannedSets: 0, completedSetsCapped: 0, extraSets: 0, missingSets: 0,
        missingRecordedSkip: 0, missingNoRecordedSkip: 0, missingUnknownSkip: 0,
        slotsRecordedSkipYes: 0, slotsRecordedSkipNo: 0, slotsRecordedSkipUnknown: 0, slotsZeroLogged: 0,
        byProvenance: Object.fromEntries(PROVENANCE_KINDS.map((kind) => [kind, { slots: 0, plannedSets: 0, completedSetsCapped: 0 }])),
      };
      for (const row of rows) {
        const planned = Number(row.planned_sets);
        const logged = Number(row.logged_sets);
        const missing = Number(row.missing_sets);
        const capped = Math.min(logged, planned);
        counts.slots += 1;
        counts.plannedSets += planned;
        counts.completedSetsCapped += capped;
        counts.extraSets += Number(row.extra_sets);
        counts.missingSets += missing;
        if (row.recorded_skip === 1) { counts.missingRecordedSkip += missing; counts.slotsRecordedSkipYes += 1; }
        else if (row.recorded_skip === 0) { counts.missingNoRecordedSkip += missing; counts.slotsRecordedSkipNo += 1; }
        else { counts.missingUnknownSkip += missing; counts.slotsRecordedSkipUnknown += 1; }
        if (logged === 0) counts.slotsZeroLogged += 1;
        const bucket = counts.byProvenance[row.provenance_kind];
        if (bucket) { bucket.slots += 1; bucket.plannedSets += planned; bucket.completedSetsCapped += capped; }
      }
      return counts;
    },
  },
  {
    name: 'unmapped_sets', sql: SQL.unmapped, bind: 'dates', tables: ['set_record', 'session', 'set_target', 'session_plan_slot'],
    analyse(rows) {
      return { unmappedOrCrossSlotSets: rows.length };
    },
  },
  {
    name: 'loads_shown', sql: SQL.loads, bind: 'dates', tables: ['set_record', 'session', 'set_load_shown'],
    analyse(rows) {
      const counts = {
        sets: rows.length, unrecorded: 0, blank: 0, numeric: 0, bySource: zeroed(LOAD_SOURCES), advisoryKind: zeroed(ADVISORY_KINDS),
        numericDiffZero: 0, numericDiffPositive: 0, numericDiffNegative: 0,
      };
      for (const row of rows) {
        if (row.seed_state === 'unrecorded') { counts.unrecorded += 1; continue; }
        if (row.seed_state === 'blank') counts.blank += 1;
        else counts.numeric += 1;
        bump(counts.bySource, row.load_source);
        bump(counts.advisoryKind, row.advisory_kind ?? 'none');
        if (row.seed_state === 'numeric') {
          const difference = Number(row.lifted_minus_seed_kg);
          if (difference === 0) counts.numericDiffZero += 1;
          else if (difference > 0) counts.numericDiffPositive += 1;
          else counts.numericDiffNegative += 1;
        }
      }
      return counts;
    },
  },
  {
    name: 'effort', sql: SQL.effort, bind: 'dates', tables: ['set_record', 'session', 'set_dose_target'],
    analyse(rows) {
      const counts = {
        loggedSets: rows.length, answered: 0, unanswered: 0, eligibleSets: 0,
        excludedUnrated: 0, excludedBelowFloor: 0, excludedNoRepsDose: 0, excludedNonPositive: 0, excludedOutOfDomain: 0,
        withinSessionPairs: 0, crossSessionPairs: 0,
      };
      const excludedKey = { unrated: 'excludedUnrated', below_floor: 'excludedBelowFloor', no_reps_dose: 'excludedNoRepsDose', non_positive: 'excludedNonPositive', out_of_domain: 'excludedOutOfDomain' };
      // Rows arrive ordered by movement, then session date, session, logged time,
      // set. A pair is two adjacent eligible sets of one movement: inside one
      // session it is a within-session pair; across a session boundary it is a
      // consecutive-session pair. No estimate is formed from either.
      const lastEligibleByMovement = new Map();
      for (const row of rows) {
        if (row.rpe !== null && row.rpe !== undefined) counts.answered += 1; else counts.unanswered += 1;
        const verdict = effortClass(row);
        if (verdict !== 'eligible') {
          counts[excludedKey[verdict]] += 1;
          continue;
        }
        counts.eligibleSets += 1;
        const previous = lastEligibleByMovement.get(row.movement_id);
        if (previous) {
          if (previous.session_id === row.session_id) counts.withinSessionPairs += 1;
          else counts.crossSessionPairs += 1;
        }
        lastEligibleByMovement.set(row.movement_id, row);
      }
      return counts;
    },
  },
  {
    name: 'session_feel', sql: SQL.sessionFeel, bind: 'dates', tables: ['session', 'session_outcome', 'session_feel', 'session_note'],
    analyse(rows) {
      const counts = {
        finalizedSessions: rows.length, feelRecorded: 0, feelAbsent: 0, noteRecorded: 0, noteAbsent: 0,
        byFeel: zeroed(FEELS), reasons: zeroed(REASONS), byOutcomeKind: {},
      };
      for (const row of rows) {
        const bucket = (counts.byOutcomeKind[row.outcome_kind] ??= { sessions: 0, feelRecorded: 0, ...zeroed(REASONS) });
        bucket.sessions += 1;
        if (row.feel !== null) {
          counts.feelRecorded += 1;
          bucket.feelRecorded += 1;
          bump(counts.byFeel, row.feel);
          for (const reason of REASONS) {
            if (row[`reason_${reason}`] === 1) { counts.reasons[reason] += 1; bucket[reason] += 1; }
          }
        } else {
          counts.feelAbsent += 1;
        }
        if (hasText(row.note)) counts.noteRecorded += 1; else counts.noteAbsent += 1;
      }
      return counts;
    },
    freeText(rows) {
      return rows.filter((row) => hasText(row.note)).map((row) => ({
        kind: 'session_note', sessionId: row.session_id, sessionDate: row.session_date, text: row.note,
      }));
    },
  },
  {
    name: 'symptom_reports', sql: SQL.symptoms, bind: 'ms', tables: ['subjective_report'],
    analyse(rows) {
      const counts = { reports: rows.length, matched: 0, unmatched: 0, halt: 0, loadModifierApplied: 0, setModifierApplied: 0, rpeCapApplied: 0 };
      for (const row of rows) {
        if (row.matched_entry_id === null) counts.unmatched += 1; else counts.matched += 1;
        if (Number(row.halt) === 1) counts.halt += 1;
        if (row.load_modifier !== null) counts.loadModifierApplied += 1;
        if (row.set_modifier !== null) counts.setModifierApplied += 1;
        if (row.rpe_cap !== null) counts.rpeCapApplied += 1;
      }
      return counts;
    },
    freeText(rows) {
      return rows.map((row) => ({
        kind: 'symptom_report', reportId: row.report_id, date: row.date, text: row.raw_text,
        matchedEntryId: row.matched_entry_id, halt: Number(row.halt),
        loadModifier: row.load_modifier, setModifier: row.set_modifier, rpeCap: row.rpe_cap,
      }));
    },
  },
  {
    name: 'attribution', sql: SQL.attribution, bind: 'dates', tables: ['session_plan_slot', 'session', 'planned_slot_autopilot'],
    analyse(rows) {
      const counts = { slots: rows.length, slotsWithSource: 0, unavailable: 0, byReason: zeroed(RE_ATTRIBUTION_REASONS), rpeDeltaNonzero: 0, setDeltaNonzero: 0 };
      for (const row of rows) {
        if (row.source_planned_slot_id !== null) counts.slotsWithSource += 1;
        if (row.reason === null) { counts.unavailable += 1; continue; }
        bump(counts.byReason, row.reason);
        if (Number(row.rpe_delta) !== 0) counts.rpeDeltaNonzero += 1;
        if (Number(row.set_delta) !== 0) counts.setDeltaNonzero += 1;
      }
      return counts;
    },
  },
  {
    name: 'question_log', sql: SQL.questions, bind: 'ms', tables: ['question_log'],
    analyse(rows) {
      const counts = { questions: rows.length, byOutcome: zeroed(QUESTION_OUTCOMES), blankText: 0 };
      for (const row of rows) {
        bump(counts.byOutcome, row.outcome_kind);
        if (!hasText(row.question_text)) counts.blankText += 1;
      }
      return counts;
    },
    freeText(rows) {
      return rows.map((row) => ({
        kind: 'question', askedAt: row.asked_at, text: row.question_text, outcomeKind: row.outcome_kind, glossaryTermId: row.glossary_term_id,
      }));
    },
  },
];

export const QUERY_SET_VERSION = 'beta-reader-queries/1';

export function sqlSha256(name) {
  const query = QUERIES.find((candidate) => candidate.name === name);
  return createHash('sha256').update(query.sql).digest('hex');
}

// Adds numeric leaves of `source` into `target` in place. Used to sum the
// per-athlete counts into one aggregate; only ever called on complete results.
export function addCountsInto(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'number') {
      target[key] = (target[key] ?? 0) + value;
    } else if (value !== null && typeof value === 'object') {
      target[key] ??= {};
      addCountsInto(target[key], value);
    }
  }
  return target;
}
