/**
 * SportEmphasisStore.test.js — sport selection and goal-responsive
 * programming in the REAL store (production boot path and migration chain,
 * one SQLite file per athlete; node:sqlite stands in for the op-sqlite handle
 * only). Pins work order 3's store contract:
 *
 *   - the sport answer is validated, saved, cleared and kept per athlete, and
 *     never becomes an objective value or an activity kind;
 *   - the weekly sport workload comes from the Activities schedule when it has
 *     sessions, from the stated numbers otherwise, and never from both;
 *   - a NEW block is generated with the focus, goal exercise, sport and
 *     workload, and the explanation of what they changed is frozen with it in
 *     the same transaction;
 *   - an existing plan and its explanation are never rewritten by a later
 *     edit, and a new block never inherits an explanation under a reused id;
 *   - the preview and the committed block say the same thing;
 *   - onboarding saves sport and goal exercise with everything else, or not
 *     at all.
 */
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDrivers;
let mockRegistry;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) mockDrivers.set(name, { ...makeNodeSqliteDriver(), close: jest.fn() });
  return mockDrivers.get(name);
}
jest.mock('../../src/navigation/navigation', () => ({ useSubViewBack: () => undefined }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: ({ name }) => mockDriverFor(name) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => mockRegistry,
  saveRegistry: async (next) => { mockRegistry = next; return true; },
}));

// The first heavy module load in a fresh jest worker is slow.
jest.setTimeout(60_000);

const A = 'athlete_kinetics.db';
const B = 'athlete_b.db';
const state = () => useStore.getState();
const raw = (file = A) => mockDrivers.get(file).raw;
const all = (sql, file = A) => raw(file).prepare(sql).all();
const count = (table, file = A) => Number(raw(file).prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c);
const settle = async () => { for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); }); };
const idOf = (name) => Number(raw().prepare('SELECT movement_id FROM movement WHERE name = ?').get(name).movement_id);
const nameOf = (id) => raw().prepare('SELECT name FROM movement WHERE movement_id = ?').get(id).name;

const ALL_EQUIPMENT = ['barbell', 'squat_rack', 'dumbbells', 'bench', 'cable_machine', 'kettlebell', 'pullup_bar', 'bands'];
const PROFILE = {
  objective: 'hypertrophy', training_age: 'intermediate', weekly_frequency: 4, session_duration_cap_min: 60,
  equipment_inventory: ALL_EQUIPMENT,
};
const PROGRAM = { horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 2, 4, 6] };
const BEACH = { bundleId: 'beach_muscles', muscles: ['biceps', 'triceps', 'upper_chest'] };
const SPORT = {
  sportId: 'football_association', otherSportName: null, outcomeId: 'stay_available', experienceId: '2_to_5_years',
  practiceSessionsPerWeek: 2, matchesPerWeek: 1, typicalSessionMinutes: 90, competitionDate: null,
};
const GOAL = {
  specificOutcome: 'Front squat 100 kg for 5', metricId: 'load_kg', measurementMethod: 'Front squat, 5 reps to parallel',
  baselineKnown: true, baselineValue: 80, targetValue: 100, reason: 'To be stronger for football',
  requestedDeadline: '2099-01-08',
};
/** A weekly entry in the Activities schedule (064), inserted as the Activities screen stores it. */
const schedule = (id, { weekday = 2, kind = 'soccer', demand = 'high', minutes = 90, ended = null, name = `Session ${id}` } = {}) => {
  raw().prepare(`INSERT OR IGNORE INTO activity_definition
    (activity_id, kind_id, display_name, demand_class, demand_source, provenance, created_at_ms, updated_at_ms)
    VALUES (?, ?, ?, ?, 'user_reported', 'user_reported', 1, 1)`).run(`act-${id}`, kind, name, demand);
  raw().prepare(`INSERT INTO activity_series
    (series_id, activity_id, revision, recurrence_kind, local_weekday, local_start_minute, timezone_id,
     time_resolution_state, effective_start_date, effective_end_date, timing_commitment, expected_duration_min,
     expected_effort, effort_scale_id, effort_scale_version, created_at_ms, updated_at_ms)
    VALUES (?, ?, 1, 'weekly', ?, NULL, 'Australia/Sydney', 'unresolved', '2020-01-01', ?, 'flexible', ?, NULL, NULL, NULL, 1, 1)`)
    .run(`series-${id}`, `act-${id}`, weekday, ended, minutes);
};
const weekOne = (file = A) => all(`SELECT ps.day_index AS day, sl.slot_index AS slot, m.name AS name, sl.sets AS sets
  FROM planned_slot sl JOIN planned_session ps USING(planned_session_id) JOIN movement m USING(movement_id)
  JOIN training_block b USING(block_id) WHERE b.status = 'active' AND ps.week_index = 1 ORDER BY ps.day_index, sl.slot_index`, file);
const primaryMuscles = (name) => all(`SELECT r.muscle_group_id AS muscle FROM movement_muscle_role r JOIN movement m USING(movement_id)
  WHERE m.name = '${name.replaceAll("'", "''")}' AND r.role = 'primary'`).map((row) => row.muscle);
/** The standard plan for the same profile: a second athlete with nothing set.
 *  The real store gates every movement on capability, so plans are compared
 *  with this control rather than with names from the pure verifier. */
const controlWeekOne = async (profile = PROFILE) => {
  state().switchAthlete('athlete-b');
  await settle();
  state().saveProfile(profile);
  createProgram();
  expect(count('block_emphasis', B)).toBe(0);
  const rows = weekOne(B);
  state().switchAthlete('default');
  await settle();
  return rows;
};
const planBytes = () => JSON.stringify([
  all('SELECT * FROM planned_slot ORDER BY 1'), all('SELECT * FROM planned_session ORDER BY 1'),
  all('SELECT * FROM training_block ORDER BY 1'), all('SELECT * FROM block_emphasis ORDER BY 1'),
]);
const createProgram = () => {
  expect(state().createTrainingProgram(PROGRAM)).toBe(true);
  expect(state().error).toBeNull();
  return state().block.blockId;
};

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDrivers = new Map();
  mockRegistry = { version: 1, activeId: 'default', advancedToolsUnlocked: false, athletes: [
    { id: 'default', name: 'Synthetic A', dbName: A, createdAtMs: 0 },
    { id: 'athlete-b', name: 'Synthetic B', dbName: B, createdAtMs: 1 },
  ] };
  useStore.setState({
    status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null,
    focus: null, goals: [], sport: null, goalMovements: {}, blockEmphasis: null,
    block: null, program: null, todayPlan: null,
  });
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
  state().saveProfile(PROFILE);
});

afterEach(async () => {
  await settle();
  jest.restoreAllMocks();
});

describe('the sport answer', () => {
  test('is validated, saved, revised and cleared; it never touches the objective', () => {
    const objectiveBefore = all('SELECT objective FROM athlete_profile');
    expect(state().sport).toBeNull();
    expect(state().saveSport(SPORT)).toBe(true);
    expect(state().sport).toMatchObject({ sportId: 'football_association', outcomeId: 'stay_available', revision: 1 });
    expect(state().saveSport({ ...SPORT, sportId: 'muay_thai', outcomeId: 'striking_and_clinch' })).toBe(true);
    expect(state().sport).toMatchObject({ sportId: 'muay_thai', revision: 2 });
    expect(count('athlete_sport_profile')).toBe(1);
    // A sport is not an objective and not an activity kind.
    expect(all('SELECT objective FROM athlete_profile')).toEqual(objectiveBefore);
    expect(count('activity_definition')).toBe(0);
    expect(state().saveSport(null)).toBe(true);
    expect(state().sport).toBeNull();
    expect(count('athlete_sport_profile')).toBe(0);
  });

  test('an incomplete or impossible answer is refused and nothing is written', () => {
    expect(state().saveSport({ ...SPORT, outcomeId: 'bigger_competition_lifts' })).toBe(false);
    expect(state().error).toMatch(/Choose what you want from your training/);
    expect(state().saveSport({ ...SPORT, sportId: 'other', outcomeId: 'general_support' })).toBe(false);
    expect(state().error).toMatch(/Name your sport/);
    expect(state().saveSport({ ...SPORT, practiceSessionsPerWeek: 40 })).toBe(false);
    expect(state().saveSport({ ...SPORT, competitionDate: '2020-01-01' })).toBe(false);
    expect(count('athlete_sport_profile')).toBe(0);
    expect(state().sport).toBeNull();
  });

  test('"not sure" is stored as nothing, never as zero', () => {
    expect(state().saveSport({ ...SPORT, practiceSessionsPerWeek: null, matchesPerWeek: null, typicalSessionMinutes: null })).toBe(true);
    expect(all('SELECT practice_sessions_per_week AS p, matches_per_week AS m, typical_session_min AS t FROM athlete_sport_profile'))
      .toEqual([{ p: null, m: null, t: null }]);
    expect(state().sportWorkload).toMatchObject({ source: 'none', tier: 'none', sessionsPerWeek: 0 });
  });

  test('each athlete has their own sport answer', async () => {
    expect(state().saveSport(SPORT)).toBe(true);
    state().switchAthlete('athlete-b');
    await settle();
    expect(state().sport).toBeNull();
    expect(count('athlete_sport_profile', B)).toBe(0);
    state().switchAthlete('default');
    await settle();
    expect(state().sport).toMatchObject({ sportId: 'football_association' });
  });
});

describe('weekly sport workload: the schedule is the evidence', () => {
  test('stated numbers are used only while the schedule is empty, and the two are never added', () => {
    expect(state().saveSport(SPORT)).toBe(true);
    expect(state().sportWorkload).toMatchObject({ source: 'stated', sessionsPerWeek: 3, tier: 'high', knownMinutesPerWeek: 270 });
    schedule('one', { name: 'Team training' });
    state().refreshSport();
    expect(state().sportWorkload).toMatchObject({ source: 'schedule', sessionsPerWeek: 1, tier: 'light', knownMinutesPerWeek: 90 });
    expect(state().sportWorkload.description).toBe('1 weekly session in your Activities schedule (Team training)');
  });

  test('gym strength sessions, low-demand activities and ended series are not counted; unknown durations stay unknown', () => {
    schedule('gym', { kind: 'strength_training', name: 'Gym' });
    schedule('walk', { kind: 'walking', demand: 'low', name: 'Dog walk' });
    schedule('old', { ended: '2021-01-01', name: 'Old club' });
    schedule('train', { weekday: 2, name: 'Training' });
    schedule('game', { weekday: 6, minutes: null, name: 'Game' });
    state().refreshSport();
    expect(state().sportWorkload).toMatchObject({
      source: 'schedule', sessionsPerWeek: 2, knownMinutesPerWeek: 90, unknownDurationSessions: 1, weekdays: [2, 6],
    });
    expect(state().sportWorkload.description).toBe('2 weekly sessions in your Activities schedule (Training, Game)');
  });

  test('reading the schedule never writes to it', () => {
    schedule('one');
    const before = JSON.stringify([all('SELECT * FROM activity_definition'), all('SELECT * FROM activity_series'), all('SELECT * FROM activity_occurrence')]);
    expect(state().saveSport(SPORT)).toBe(true);
    createProgram();
    expect(JSON.stringify([all('SELECT * FROM activity_definition'), all('SELECT * FROM activity_series'), all('SELECT * FROM activity_occurrence')])).toBe(before);
  });
});

describe('a new block is planned with the focus, goal, sport and workload', () => {
  test('with nothing set the plan is the standard one and no explanation is stored', async () => {
    const control = await controlWeekOne();
    // A balanced focus is "nothing set" too.
    expect(state().saveFocus({ bundleId: 'balanced', muscles: [] })).toBe(true);
    createProgram();
    expect(count('block_emphasis')).toBe(0);
    expect(state().blockEmphasis).toBeNull();
    expect(weekOne()).toEqual(control);
    expect(control.length).toBeGreaterThanOrEqual(8);
  });

  test('focus changes selection and weekly allocation, and the explanation is frozen with the block', async () => {
    const control = await controlWeekOne();
    expect(state().saveFocus(BEACH)).toBe(true);
    const blockId = createProgram();
    const focused = weekOne();
    // Same shape as the standard plan: nothing added, lower days untouched.
    expect(focused.map((row) => [row.day, row.slot, row.sets])).toEqual(control.map((row) => [row.day, row.slot, row.sets]));
    expect(focused.filter((row) => [1, 4].includes(row.day))).toEqual(control.filter((row) => [1, 4].includes(row.day)));
    // The main press on both upper days now trains the upper chest directly, and still the chest.
    for (const day of [2, 6]) {
      const press = focused.find((row) => row.day === day && row.slot === 1).name;
      expect(press).not.toBe(control.find((row) => row.day === day && row.slot === 1).name);
      expect(primaryMuscles(press)).toEqual(expect.arrayContaining(['chest', 'upper_chest']));
    }
    // Exactly one upper day gives its last slot to direct arm work; the other keeps the standard exercise.
    const lastSlots = [2, 6].map((day) => focused.find((row) => row.day === day && row.slot === 3).name);
    const standardLast = control.find((row) => row.day === 2 && row.slot === 3).name;
    expect(lastSlots.filter((name) => name === standardLast)).toHaveLength(1);
    const armWork = lastSlots.find((name) => name !== standardLast);
    expect(['biceps', 'triceps']).toContain(primaryMuscles(armWork)[0]);
    const row = all('SELECT * FROM block_emphasis');
    expect(row).toHaveLength(1);
    expect(row[0]).toMatchObject({ block_id: blockId, emphasis_version: 1 });
    const report = JSON.parse(row[0].report_json);
    // Every change in the plan is one the report names, in the athlete's terms.
    const press = focused.find((entry) => entry.day === 2 && entry.slot === 1).name;
    expect(report.applied).toContain(`${press} is planned instead of ${control.find((entry) => entry.day === 2 && entry.slot === 1).name}: it trains upper chest directly (your focus).`);
    expect(report.applied.some((line) => line.startsWith(`${armWork} takes the place of ${standardLast} on one upper day a week, for `)
      && line.endsWith(`(your focus). ${standardLast} is still trained on another day.`))).toBe(true);
    expect(report.omitted.join(' ')).toMatch(/No room for extra (biceps|triceps) work in your 60-minute sessions/);
    expect(state().blockEmphasis).toMatchObject({ blockId, report });
    // The frozen inputs describe the emphasis; the 794-row library mapping is not copied into every block.
    const inputs = JSON.parse(row[0].inputs_json);
    expect(inputs.focus).toMatchObject({ muscles: ['upper_chest', 'biceps', 'triceps'], description: 'Beach muscles: upper chest, biceps, triceps' });
    expect(inputs.roles).toBeUndefined();
    expect(row[0].inputs_json.length).toBeLessThan(4000);
  });

  test('the preview and the committed block say exactly the same thing', () => {
    expect(state().saveFocus(BEACH)).toBe(true);
    expect(state().saveSport(SPORT)).toBe(true);
    const preview = state().previewTrainingProgram(PROGRAM);
    expect(preview.plan.emphasis.applied.length).toBeGreaterThan(2);
    createProgram();
    expect(state().blockEmphasis.report).toEqual(preview.plan.emphasis);
    const committed = weekOne().map((row) => `${row.day}:${row.slot}:${row.name}:${row.sets}`);
    const previewed = preview.plan.sessions.filter((s) => s.week_index === 1)
      .flatMap((s) => s.slots.map((slot) => `${s.day_index}:${slot.slot_index}:${nameOf(slot.movement_id)}:${slot.sets}`));
    expect(committed).toEqual(previewed);
  });

  test('a goal that names an exercise puts that exercise in the plan; a retired goal no longer does', async () => {
    const control = await controlWeekOne();
    const standardSquat = control.find((row) => row.day === 1 && row.slot === 1).name;
    expect(state().saveGoal({ ...GOAL, specificOutcome: 'A stronger squat' })).toBe(true);
    const { goalId } = state().goals[0];
    // Find a squat the gates allow for THIS athlete that is not already the
    // standard choice. previewTrainingProgram writes nothing, so trying each
    // candidate is free; the gates, not the test, decide which one is usable.
    const squats = all("SELECT name FROM movement WHERE pattern = 'squat' ORDER BY movement_id").map((row) => row.name);
    const usable = squats.find((name) => {
      if (name === standardSquat) return false;
      expect(state().setGoalMovement(goalId, idOf(name))).toBe(true);
      return state().previewTrainingProgram(PROGRAM).plan.emphasis.applied.some((line) => line.startsWith(`${name} is in your plan because of your goal`));
    });
    expect(usable).toBeDefined();
    expect(state().goalMovements).toEqual({ [goalId]: idOf(usable) });
    createProgram();
    const planned = weekOne();
    expect(planned.filter((row) => row.slot === 1 && [1, 4].includes(row.day)).map((row) => row.name)).toEqual([usable, usable]);
    // Only the squat slots changed.
    expect(planned.filter((row) => !(row.slot === 1 && [1, 4].includes(row.day))))
      .toEqual(control.filter((row) => !(row.slot === 1 && [1, 4].includes(row.day))));
    expect(state().blockEmphasis.report.applied)
      .toEqual([`${usable} is in your plan because of your goal "A stronger squat". It is never the first thing cut when a session is short.`]);

    // Retire the goal: the current block is untouched, and the NEXT plan
    // returns to the standard squat with nothing to explain.
    const before = planBytes();
    expect(state().setGoalStatus(goalId, 'retired')).toBe(true);
    expect(planBytes()).toBe(before);
    useStore.setState({ block: null, program: null });
    const next = state().previewTrainingProgram(PROGRAM).plan;
    expect(next.emphasis).toBeUndefined();
    expect(nameOf(next.sessions[0].slots[0].movement_id)).toBe(standardSquat);
  });

  test('a goal exercise the athlete is not cleared for is NOT planned, and the reason is given', async () => {
    const control = await controlWeekOne();
    // A new athlete has no capability evidence for the front squat: the gate
    // that keeps it out of the standard plan keeps it out of this one too.
    expect(control.some((row) => row.name === 'Front Squat')).toBe(false);
    expect(state().saveGoal(GOAL, undefined, idOf('Front Squat'))).toBe(true);
    createProgram();
    expect(weekOne()).toEqual(control);
    expect(state().blockEmphasis.report.applied).toEqual([]);
    expect(state().blockEmphasis.report.omitted)
      .toEqual(['Your goal "Front squat 100 kg for 5" names Front Squat, but it is not in this plan: it is not available to you right now.']);
  });

  test('a goal exercise link can be set, changed and removed without touching the goal definition', () => {
    expect(state().saveGoal(GOAL)).toBe(true);
    const { goalId } = state().goals[0];
    expect(state().goalMovements).toEqual({});
    expect(state().setGoalMovement(goalId, idOf('Front Squat'))).toBe(true);
    expect(state().setGoalMovement(goalId, idOf('Goblet Squat'))).toBe(true);
    expect(all('SELECT goal_id, movement_id FROM athlete_goal_movement')).toEqual([{ goal_id: goalId, movement_id: idOf('Goblet Squat') }]);
    expect(state().setGoalMovement(goalId, 999999)).toBe(false);
    expect(state().error).toMatch(/not in the library/);
    expect(state().setGoalMovement('goal-that-does-not-exist', idOf('Front Squat'))).toBe(false);
    expect(state().setGoalMovement(goalId, null)).toBe(true);
    expect(count('athlete_goal_movement')).toBe(0);
    expect(state().goals[0]).toMatchObject({ revision: 1 });
    expect(count('athlete_goal_revision')).toBe(1);
    // Editing the goal can change the link in the same save.
    expect(state().saveGoal({ ...GOAL, targetValue: 105 }, { goalId, expectedRevision: 1 }, idOf('Front Squat'))).toBe(true);
    expect(state().goalMovements).toEqual({ [goalId]: idOf('Front Squat') });
    // A refused edit (stale editor) changes neither the goal nor the link.
    expect(state().saveGoal({ ...GOAL, targetValue: 120 }, { goalId, expectedRevision: 1 }, null)).toBe(false);
    expect(state().goalMovements).toEqual({ [goalId]: idOf('Front Squat') });
  });

  test('a full sport week in the schedule takes one set off accessories in a NEW block and says why', async () => {
    // Control: the same athlete profile in a second database, with no schedule.
    state().saveProfile({ objective: 'gpp' });
    for (const [id, weekday] of [['a', 1], ['b', 3], ['c', 5]]) schedule(id, { weekday, name: 'Club training' });
    createProgram();
    const withSchedule = weekOne();
    expect(state().blockEmphasis.report.applied.join(' '))
      .toMatch(/Sport workload: 3 weekly sessions in your Activities schedule \(Club training\)\. To leave room for it, each accessory exercise has one fewer set\./);

    state().switchAthlete('athlete-b');
    await settle();
    state().saveProfile({ ...PROFILE, objective: 'gpp' });
    createProgram();
    const control = all(`SELECT ps.day_index AS day, sl.slot_index AS slot, m.name AS name, sl.sets AS sets
      FROM planned_slot sl JOIN planned_session ps USING(planned_session_id) JOIN movement m USING(movement_id)
      WHERE ps.week_index = 1 ORDER BY ps.day_index, sl.slot_index`, B);
    expect(count('block_emphasis', B)).toBe(0);
    expect(withSchedule.map((row) => row.name)).toEqual(control.map((row) => row.name));
    const strengthDays = new Set([1, 2, 4]);
    for (const [index, row] of withSchedule.entries()) {
      const accessory = strengthDays.has(row.day) && row.slot >= 3;
      expect(row.sets).toBe(control[index].sets - (accessory ? 1 : 0));
    }
  });
});

describe('a plan and its explanation are frozen', () => {
  test('later edits to focus, goals and sport rewrite neither the plan nor its explanation', () => {
    expect(state().saveFocus(BEACH)).toBe(true);
    createProgram();
    const before = planBytes();
    expect(state().saveFocus({ bundleId: 'lower_body', muscles: ['glutes', 'quadriceps', 'hamstrings', 'calves'] })).toBe(true);
    expect(state().saveSport(SPORT)).toBe(true);
    expect(state().saveGoal(GOAL, undefined, idOf('Front Squat'))).toBe(true);
    schedule('later');
    state().refreshSport();
    state().refreshBlock();
    expect(planBytes()).toBe(before);
    expect(state().blockEmphasis.report.applied[0]).toBe('Focus — Beach muscles: upper chest, biceps, triceps.');
    expect(() => raw().exec("UPDATE block_emphasis SET report_json = '{}'")).toThrow(/immutable/);
  });

  test('if the explanation cannot be stored, the block is not created either', () => {
    expect(state().saveFocus(BEACH)).toBe(true);
    raw().exec(`CREATE TEMP TRIGGER synthetic_emphasis_failure BEFORE INSERT ON block_emphasis
                BEGIN SELECT RAISE(ABORT, 'synthetic storage failure'); END`);
    expect(state().createTrainingProgram(PROGRAM)).toBe(false);
    expect(state().error).toMatch(/synthetic storage failure/);
    expect(count('training_block')).toBe(0);
    expect(count('planned_session')).toBe(0);
    expect(count('block_emphasis')).toBe(0);
    raw().exec('DROP TRIGGER synthetic_emphasis_failure');
    useStore.setState({ error: null });
    createProgram();
    expect(count('block_emphasis')).toBe(1);
  });

  test('a new block never inherits an explanation left under a reused block id', () => {
    expect(state().saveFocus(BEACH)).toBe(true);
    const firstId = createProgram();
    // The block disappears without its explanation (a crash, or a delete with
    // foreign keys off), leaving an orphan under an id the next block reuses.
    raw().exec('PRAGMA foreign_keys = OFF');
    for (const table of ['planned_slot_target', 'planned_slot_load_intent', 'planned_slot', 'planned_session',
      'block_meta', 'training_block_program', 'training_block', 'training_program_day', 'training_program']) {
      raw().exec(`DELETE FROM ${table}`);
    }
    raw().exec('PRAGMA foreign_keys = ON');
    expect(count('block_emphasis')).toBe(1);
    // The athlete now has no focus: the next block has nothing to explain.
    expect(state().saveFocus({ bundleId: 'balanced', muscles: [] })).toBe(true);
    state().refreshBlock();
    state().refreshProgram();
    const secondId = createProgram();
    expect(secondId).toBe(firstId);
    expect(count('block_emphasis')).toBe(0);
    expect(state().blockEmphasis).toBeNull();
  });

  test.each([['ON'], ['OFF']])('a training-data reset removes block explanations and keeps the sport answer and goal exercise (foreign keys %s)', (mode) => {
    raw().exec(`PRAGMA foreign_keys = ${mode}`);
    expect(state().saveFocus(BEACH)).toBe(true);
    expect(state().saveSport(SPORT)).toBe(true);
    expect(state().saveGoal(GOAL, undefined, idOf('Front Squat'))).toBe(true);
    createProgram();
    expect(count('block_emphasis')).toBe(1);
    state().resetTrainingData();
    expect(state().error).toBeNull();
    expect(count('block_emphasis')).toBe(0);
    expect(state().blockEmphasis).toBeNull();
    expect(state().sport).toMatchObject({ sportId: 'football_association' });
    expect(Object.values(state().goalMovements)).toEqual([idOf('Front Squat')]);
  });

  test('everything is read back from storage after a restart', async () => {
    expect(state().saveFocus(BEACH)).toBe(true);
    expect(state().saveSport({ ...SPORT, competitionDate: '2099-06-01' })).toBe(true);
    expect(state().saveGoal(GOAL, undefined, idOf('Front Squat'))).toBe(true);
    createProgram();
    const report = state().blockEmphasis.report;
    useStore.setState({ status: 'booting', sport: null, goalMovements: {}, blockEmphasis: null });
    state().boot();
    await settle();
    expect(state().status).toBe('ready');
    expect(state().sport).toMatchObject({ sportId: 'football_association', competitionDate: '2099-06-01' });
    expect(Object.values(state().goalMovements)).toEqual([idOf('Front Squat')]);
    expect(state().blockEmphasis.report).toEqual(report);
  });
});

describe('a competition date is context only', () => {
  test('two athletes identical except for a competition date get the same plan', async () => {
    const lifter = { sportId: 'powerlifting', otherSportName: null, outcomeId: 'bigger_competition_lifts',
      experienceId: 'over_5_years', practiceSessionsPerWeek: 0, matchesPerWeek: 0, typicalSessionMinutes: null };
    expect(state().saveSport({ ...lifter, competitionDate: '2099-03-01' })).toBe(true);
    createProgram();
    const dated = all(`SELECT ps.week_index, ps.day_index, ps.phase, sl.slot_index, sl.movement_id, sl.sets, sl.reps, sl.target_rpe
      FROM planned_slot sl JOIN planned_session ps USING(planned_session_id) ORDER BY 1, 2, 4`);
    // Each competition lift is accounted for one way or the other: planned as
    // a main lift, or named with the fact that it did not pass the checks.
    const report = state().blockEmphasis.report;
    for (const lift of ['Competition Squat', 'Competition Bench', 'Deadlift']) {
      const planned = dated.some((row) => nameOf(row.movement_id) === lift);
      expect(planned
        ? report.applied.some((line) => line.startsWith('Competition lifts planned as main lifts:') && line.includes(lift))
        : report.omitted.some((line) => line.startsWith(`${lift} is not planned as a main lift`))).toBe(true);
    }
    expect(report.omitted.join(' ')).toMatch(/Your competition on 2099-03-01 does not change this plan/);
    expect(dated.some((row) => row.phase === 'deload')).toBe(true);

    state().switchAthlete('athlete-b');
    await settle();
    state().saveProfile(PROFILE);
    expect(state().saveSport({ ...lifter, competitionDate: null })).toBe(true);
    createProgram();
    const undated = all(`SELECT ps.week_index, ps.day_index, ps.phase, sl.slot_index, sl.movement_id, sl.sets, sl.reps, sl.target_rpe
      FROM planned_slot sl JOIN planned_session ps USING(planned_session_id) ORDER BY 1, 2, 4`, B);
    expect(undated).toEqual(dated);
  });
});

describe('onboarding saves the sport answer and the goal exercise with everything else', () => {
  beforeEach(async () => {
    // A fresh, not-yet-onboarded athlete.
    state().switchAthlete('athlete-b');
    await settle();
    expect(state().onboarded).toBe(false);
  });

  test('profile, focus, sport, goal and its exercise are written together', async () => {
    state().completeOnboarding(PROFILE, 'Synthetic B', undefined, undefined, {
      binding: state().beginOnboardingDraft(), focus: BEACH, goal: GOAL,
      goalMovementId: idOf('Front Squat'), sport: SPORT,
    });
    await settle();
    expect(state().error).toBeNull();
    expect(state().onboarded).toBe(true);
    expect(state().sport).toMatchObject({ sportId: 'football_association', revision: 1 });
    expect(state().goals).toHaveLength(1);
    expect(state().goalMovements).toEqual({ [state().goals[0].goalId]: idOf('Front Squat') });
    expect(count('athlete_sport_profile', B)).toBe(1);
    expect(count('athlete_sport_profile', A)).toBe(0);
  });

  test('an invalid sport answer refuses the whole save', async () => {
    state().completeOnboarding(PROFILE, 'Synthetic B', undefined, undefined, {
      binding: state().beginOnboardingDraft(), focus: BEACH, goal: GOAL,
      sport: { ...SPORT, outcomeId: 'bigger_competition_lifts' },
    });
    await settle();
    expect(state().error).toMatch(/Choose what you want from your training/);
    expect(state().onboarded).toBe(false);
    for (const table of ['athlete_focus', 'athlete_goal', 'athlete_sport_profile', 'athlete_goal_movement']) expect(count(table, B)).toBe(0);
  });

  test('a failure on the last write rolls the sport answer back with the rest', async () => {
    raw(B).exec(`CREATE TEMP TRIGGER synthetic_link_failure BEFORE INSERT ON athlete_goal_movement
                 BEGIN SELECT RAISE(ABORT, 'synthetic storage failure'); END`);
    state().completeOnboarding(PROFILE, 'Synthetic B', undefined, undefined, {
      binding: state().beginOnboardingDraft(), focus: BEACH, goal: GOAL,
      goalMovementId: idOf('Front Squat'), sport: SPORT,
    });
    await settle();
    expect(state().error).toMatch(/synthetic storage failure/);
    expect(state().onboarded).toBe(false);
    for (const table of ['athlete_focus', 'athlete_goal', 'athlete_sport_profile', 'athlete_goal_movement']) expect(count(table, B)).toBe(0);
  });

  test('no sport answer means no sport row and a general plan', async () => {
    state().completeOnboarding(PROFILE, 'Synthetic B', undefined, undefined, {
      binding: state().beginOnboardingDraft(), focus: { bundleId: 'balanced', muscles: [] }, sport: null,
    });
    await settle();
    expect(state().onboarded).toBe(true);
    expect(state().sport).toBeNull();
    expect(count('athlete_sport_profile', B)).toBe(0);
  });
});
