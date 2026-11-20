/**
 * Targeted regression verifier for PR #384 CodeRabbit Major remediations
 * covering sportProfile, longitudinalAutopilot, substitution, blockGenerator,
 * programEmphasis, and core-db migrationRunner replay-stash durability.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { generateBlock } = require('./.build/blockGenerator.js');
const { resolveSportWorkload, resolveMultiSportWorkload } = require('./.build/sportProfile.js');
const { applyLongitudinalOverlayToBlockPlan } = require('./.build/longitudinalAutopilot.js');
const { computeNeutralSwapOptions } = require('./.build/substitution.js');
const { DEFAULT_PROFILE } = require('./.build/types.js');
const { runMigrations } = require('../../core-db/test/.build/migrationRunner.js');

const __dir = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(__dir, '..', '..', 'core-db', 'src', 'schema');
const migrations = readdirSync(schemaDir)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort()
  .map((f) => readFileSync(join(schemaDir, f), 'utf8'));

let passed = 0;
const check = (label, ok, detail = '') => {
  if (!ok) throw new Error(`FAIL: ${label}${detail ? ` (${detail})` : ''}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
};

const mkMove = (id, name, pattern, opts = {}) => ({
  movement_id: id,
  name,
  pattern,
  is_compound: opts.compound ?? true,
  required: opts.required ?? ['barbell'],
  difficulty: opts.difficulty ?? 'Beginner',
  beginner_ok: true,
  sportTracking: false,
  capability_available_weight_room: true,
  capability_available_sport_conditioning: true,
  plannedImplement: opts.plannedImplement ?? 'Barbell',
  bodyweightSupported: opts.bodyweightSupported ?? false,
});

const baseMovements = [
  mkMove(1, 'Back Squat', 'squat'),
  mkMove(2, 'Bench Press', 'push_h'),
  mkMove(3, 'Deadlift', 'hinge'),
  mkMove(4, 'Barbell Row', 'pull_h'),
  mkMove(5, 'Overhead Press', 'push_v'),
  mkMove(6, 'Pull-Up', 'pull_v', { required: ['pullup_bar'], plannedImplement: 'Bodyweight', bodyweightSupported: true }),
  mkMove(7, 'Walking Lunge', 'lunge', { required: [], plannedImplement: 'Bodyweight', bodyweightSupported: true }),
  mkMove(8, 'Farmer Carry', 'carry', { required: ['dumbbells'], plannedImplement: 'DB' }),
  mkMove(9, 'Biceps Curl', 'isolation', { compound: false, required: ['dumbbells'], plannedImplement: 'DB' }),
];

const fullProfile = (overrides = {}) => ({
  ...DEFAULT_PROFILE,
  objective: 'strength',
  training_age: 'advanced',
  weekly_frequency: 3,
  session_duration_cap_min: 90,
  equipment_inventory: ['barbell', 'squat_rack', 'bench', 'dumbbells', 'pullup_bar', 'cable_machine'],
  ...overrides,
});

// 1. sportProfile.ts:727 — scheduled outside sport sessions retained for lifting profiles
{
  const scheduled = [{ weekday: 2, label: 'Basketball', expectedDurationMin: 60 }];
  const single = resolveSportWorkload({
    scheduled,
    profile: { sportId: 'powerlifting', practiceSessionsPerWeek: 4, matchesPerWeek: 1, typicalSessionMinutes: 90 },
  });
  check(
    'sportProfile: lifting profile retains scheduled outside sport sessions (duration + weekday)',
    single.source === 'schedule' && single.sessionsPerWeek === 1 && single.knownMinutesPerWeek === 60
      && JSON.stringify(single.weekdays) === '[2]',
    JSON.stringify(single),
  );
  const unscheduled = resolveSportWorkload({
    scheduled: [],
    profile: { sportId: 'powerlifting', practiceSessionsPerWeek: 4, matchesPerWeek: 1, typicalSessionMinutes: 90 },
  });
  check(
    'sportProfile: lifting profile still excludes stated onboarding counts when schedule is empty',
    unscheduled.source === 'none' && unscheduled.sessionsPerWeek === 0,
  );
  const multi = resolveMultiSportWorkload({
    scheduled,
    profiles: [{
      sportId: 'powerlifting', outcomeId: 'bigger_competition_lifts', experienceId: '2_to_5_years',
      otherSportName: null, practiceSessionsPerWeek: 4, matchesPerWeek: 2, typicalSessionMinutes: 90, competitionDate: null,
    }],
  });
  check(
    'sportProfile: resolveMultiSportWorkload keeps scheduled outside sessions even when all profiles are lifting sports',
    multi.source === 'schedule' && multi.sessionsPerWeek === 1 && multi.knownMinutesPerWeek === 60
      && JSON.stringify(multi.weekdays) === '[2]',
    JSON.stringify(multi),
  );
}

// 2. longitudinalAutopilot.ts:1264 & 1322 — backOff normalized when MRV or time fit trims sets
{
  const plan = generateBlock({
    profile: fullProfile({ training_age: 'advanced', objective: 'strength', weekly_frequency: 2 }),
    movements: baseMovements,
    startDate: '2026-11-16',
    macroBlockIndex: 7,
  });
  const sbdSlotBefore = plan.sessions[0].slots.find((s) => s.backOff !== undefined);
  assert.ok(sbdSlotBefore !== undefined && sbdSlotBefore.sets === 3 && sbdSlotBefore.backOff.sets === 2);

  const patternById = new Map(baseMovements.map((m) => [m.movement_id, m.pattern]));
  const mrvOneOverlay = {
    policyApplied: true,
    haltAdvised: false,
    avoidMovementIds: {},
    patternMrvSets: { squat: 1, push_h: 2, hinge: 1 },
    week3SetTrimByPattern: {},
    patternActionDeltas: {},
    substitutions: {},
    reasons: [],
  };
  const projected = applyLongitudinalOverlayToBlockPlan(plan, patternById, mrvOneOverlay, {});
  for (const session of projected.sessions) {
    for (const slot of session.slots) {
      if (slot.sets <= 1) {
        assert.equal(slot.backOff, undefined, '1-set slot must not retain backOff');
      } else if (slot.backOff !== undefined) {
        assert.ok(slot.backOff.sets <= slot.sets - 1, `backOff.sets (${slot.backOff.sets}) must stay <= sets-1 (${slot.sets - 1})`);
      }
    }
  }
  const squat1 = projected.sessions[0].slots.find((s) => patternById.get(s.movement_id) === 'squat');
  check('longitudinalAutopilot: MRV reduction to 1 set removes backOff completely',
    squat1 !== undefined && squat1.sets === 1 && squat1.backOff === undefined);
  const bench2 = projected.sessions[1].slots.find((s) => patternById.get(s.movement_id) === 'push_h');
  check('longitudinalAutopilot: MRV reduction to 2 sets trims backOff.sets to 1',
    bench2 !== undefined && bench2.sets === 2 && bench2.backOff?.sets === 1);
}

// 3. substitution.ts:357 — neutral swap options blocked when haltAdvised is true
{
  const subLib = [
    {
      movement_id: 10, name: 'Barbell Bench Press', pattern: 'push_h', is_compound: true,
      difficulty: 'Intermediate', family: 'press', required: [], preference: 0,
      capabilityAvailable: true, sportTracking: false, primaryJoints: ['shoulder', 'elbow'],
    },
    {
      movement_id: 11, name: 'Dumbbell Bench Press', pattern: 'push_h', is_compound: true,
      difficulty: 'Intermediate', family: 'press', required: [], preference: 0,
      capabilityAvailable: true, sportTracking: false, primaryJoints: ['shoulder', 'elbow'],
    },
  ];
  const neutralDuringHalt = computeNeutralSwapOptions({
    target: subLib[0],
    library: subLib,
    inventory: [],
    niggles: [{ region: 'neck', severity: 6 }],
    currentDayIndex: 0,
    trainingAge: 'elite',
    accessContext: 'weight_room',
  });
  check('substitution: computeNeutralSwapOptions returns [] when haltAdvised is true (elite neck severity 6)',
    neutralDuringHalt.length === 0);
}

// 4. blockGenerator.ts:1275, 2024, 1376, 2005, 455, 1534
{
  // 4a. Omitted scheduleMode preserves relative day-1 on Wednesday start
  const wedRel = generateBlock({
    profile: fullProfile({ weekly_frequency: 1 }),
    movements: baseMovements,
    startDate: '2026-11-18', // Wednesday
  });
  check('blockGenerator: omitted scheduleMode keeps day 1 on Wednesday startDate',
    wedRel.sessions[0].session_date === '2026-11-18');
  const wedIso = generateBlock({
    profile: fullProfile({ weekly_frequency: 1 }),
    movements: baseMovements,
    startDate: '2026-11-18',
    scheduleMode: 'iso_weekday',
  });
  check('blockGenerator: explicit iso_weekday places day 1 on next Monday (2026-11-23)',
    wedIso.sessions[0].session_date === '2026-11-23');

  // 4b. Routine slot with 40 reps rejected instead of silently clamped to 30
  assert.throws(() => generateBlock({
    profile: fullProfile({ weekly_frequency: 1 }),
    movements: baseMovements,
    startDate: '2026-11-16',
    programDays: [{
      day_index: 1,
      focus: 'lower',
      routine_assignment: {
        routine_template_id: 1,
        routine_day_index: 1,
        routine_name: 'High Rep',
        slots: [{ slot_index: 1, movement_id: 7, sets: 3, reps: 40, target_rpe: 7.5 }],
      },
    }],
  }), /between 1 and 30/);
  check('blockGenerator: rejects 40-rep routine slot instead of silently shortening to 30', true);

  // 4c. Routine assignment validates movements against current day eligible pool
  assert.throws(() => generateBlock({
    profile: fullProfile({ weekly_frequency: 1, equipment_inventory: ['dumbbells'] }),
    movements: baseMovements,
    startDate: '2026-11-16',
    programDays: [{
      day_index: 1,
      focus: 'lower',
      routine_assignment: {
        routine_template_id: 1,
        routine_day_index: 1,
        routine_name: 'Barbell Day',
        slots: [{ slot_index: 1, movement_id: 1, sets: 3, reps: 5, target_rpe: 8 }],
      },
    }],
  }), /not available for this day/);
  assert.throws(() => generateBlock({
    profile: fullProfile({ weekly_frequency: 1 }),
    movements: baseMovements,
    startDate: '2026-11-16',
    programDays: [{
      day_index: 1,
      focus: 'lower',
      routine_assignment: {
        routine_template_id: 1,
        routine_day_index: 1,
        routine_name: 'Unknown Move',
        slots: [{ slot_index: 1, movement_id: 9999, sets: 3, reps: 5, target_rpe: 8 }],
      },
    }],
  }), /not available for this day/);
  check('blockGenerator: rejects ineligible (missing barbell) and unknown routine movements', true);

  // 4d. Routine work counted instead of unused default menus for weekly SBD limits
  const lungeRoutine = {
    routine_template_id: 2,
    routine_day_index: 1,
    routine_name: 'Lunge Only',
    slots: [{ slot_index: 1, movement_id: 7, sets: 3, reps: 10, target_rpe: 7.5 }],
  };
  const threeLower = generateBlock({
    profile: fullProfile({ objective: 'strength', weekly_frequency: 3 }),
    movements: baseMovements,
    startDate: '2026-11-16',
    programDays: [
      { day_index: 1, focus: 'lower', routine_assignment: lungeRoutine },
      { day_index: 3, focus: 'lower', routine_assignment: lungeRoutine },
      { day_index: 5, focus: 'lower' },
    ],
  });
  const day3Week1 = threeLower.sessions.find((s) => s.week_index === 1 && s.day_index === 5);
  check('blockGenerator: 2 lunge-only routine lower days do not strip hinge from Day 3',
    day3Week1 !== undefined && day3Week1.slots.some((sl) => sl.movement_id === 3));

  // 4e. Valid athlete movement preference for carry is not silently dropped at 4-slot strength cap
  const withCarryPref = generateBlock({
    profile: fullProfile({ objective: 'strength', weekly_frequency: 1, session_duration_cap_min: 120 }),
    movements: baseMovements,
    startDate: '2026-11-16',
    programDays: [{
      day_index: 1,
      focus: 'full',
      movement_preferences: [{ slot_index: 5, pattern: 'carry', movement_id: 8 }],
    }],
  });
  check('blockGenerator: valid carry preference on full strength day is preserved within 4-slot cap',
    withCarryPref.sessions[0].slots.length <= 4
      && withCarryPref.sessions[0].slots.some((sl) => sl.movement_id === 8));

  // 4f. Expired competition date does not produce an empty block; imminent meet clipping every session throws
  const expiredMeet = generateBlock({
    profile: fullProfile({ weekly_frequency: 2 }),
    movements: baseMovements,
    startDate: '2026-11-16',
    competitionDate: '2026-11-01',
    sportId: 'powerlifting',
  });
  check('blockGenerator: expired competitionDate before startDate still generates normal sessions',
    expiredMeet.sessions.length === 8);

  assert.throws(() => generateBlock({
    profile: fullProfile({ weekly_frequency: 1 }),
    movements: baseMovements,
    startDate: '2026-11-18', // Wednesday
    scheduleMode: 'iso_weekday',
    programDays: [{ day_index: 1, focus: 'lower' }], // Next Monday = 2026-11-23
    competitionDate: '2026-11-20', // Friday before first scheduled session
    sportId: 'powerlifting',
  }), /No scheduled sessions fall before the target competition date/);
  check('blockGenerator: future competitionDate clipping every session fails closed instead of returning empty plan', true);
}

// 5. migrationRunner.ts:741 — durable 078 sport stash survives failed replay and restores on retry
{
  const raw = new DatabaseSync(':memory:');
  const wrap = (db) => ({
    executeSync(sql, params) {
      const trimmed = sql.trim();
      const stmt = db.prepare(trimmed);
      if (/^(SELECT|PRAGMA|WITH)\b/i.test(trimmed)) {
        return { rows: params ? stmt.all(...params) : stmt.all() };
      }
      if (params) stmt.run(...params);
      else stmt.run();
      return { rows: [] };
    },
  });
  const db = wrap(raw);
  runMigrations(db, migrations);
  raw.prepare(
    `INSERT INTO athlete_sport_profile
       (sport_profile_id, sport_id, other_sport_name, outcome_id, experience_id,
        practice_sessions_per_week, matches_per_week, typical_session_min,
        competition_date, revision, updated_at_ms)
     VALUES (1, 'olympic_weightlifting', NULL, 'general_support', '2_to_5_years', 0, 20, NULL, '2027-06-01', 1, 1000)`,
  ).run();
  // Trigger self-heal by dropping a sentinel table, then poison one migration so replay throws mid-flight.
  raw.exec('DROP TABLE planned_slot_athlete_override;');
  const poisonedMigrations = [...migrations];
  poisonedMigrations[poisonedMigrations.length - 1] = 'INVALID SQL STATEMENT TO FORCE REPLAY FAILURE;';
  assert.throws(() => runMigrations(db, poisonedMigrations));

  const stashExistsAfterFailure = raw.prepare(
    "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name = '_ak_replay_stash_078_sport'",
  ).get().c;
  check('migrationRunner: _ak_replay_stash_078_sport survives a failed replay', stashExistsAfterFailure === 1);

  // Retry with the valid migration chain: must restore the stashed olympic_weightlifting row and drop the stash!
  runMigrations(db, migrations);
  const restored = raw.prepare('SELECT sport_id, matches_per_week, competition_date FROM athlete_sport_profile WHERE sport_profile_id = 1').get();
  const stashAfterRecovery = raw.prepare(
    "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table' AND name = '_ak_replay_stash_078_sport'",
  ).get().c;
  check(
    'migrationRunner: subsequent replay restores stashed olympic_weightlifting profile verbatim and cleans up stash',
    restored?.sport_id === 'olympic_weightlifting'
      && restored?.matches_per_week === 20
      && restored?.competition_date === '2027-06-01'
      && stashAfterRecovery === 0,
    JSON.stringify({ restored, stashAfterRecovery }),
  );
  raw.close();
}

console.log(`\nCodeRabbit PR #384 Inference/Core-DB Summary: ${passed} passed, 0 failed`);
