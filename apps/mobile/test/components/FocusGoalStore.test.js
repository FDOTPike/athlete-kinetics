/**
 * FocusGoalStore.test.js — the athlete's focus and SMART goals in the REAL
 * store, booted by the production boot path over the production migration
 * chain, with one SQLite file per athlete (node:sqlite stands in for the
 * op-sqlite handle only). Pins work order 2's store contract:
 *
 *   - the onboarding interview is saved whole or not at all: profile, focus
 *     and goal share ONE transaction;
 *   - the interview is bound to the athlete and store context it was started
 *     for — an athlete switch while it is open means nothing is written;
 *   - editing a goal appends a revision and rewrites neither earlier
 *     revisions, recorded observations nor an existing plan;
 *   - observations are real measurements only: validated, immutable, bound to
 *     the definition they were taken under;
 *   - a training-data reset removes observations and keeps goals and focus;
 *   - the five-active-goal and six-area limits hold in the store AND the
 *     database.
 */
import { useStore, ONBOARDING_STALE_MESSAGE } from '../../src/state/useStore';
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

const PROFILE = {
  training_age: 'intermediate', weekly_frequency: 3, session_duration_cap_min: 60,
  equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'],
};
const LOWER_BODY = { bundleId: 'lower_body', muscles: ['glutes', 'quadriceps', 'hamstrings', 'calves'] };
const GOAL = {
  specificOutcome: 'Squat 100 kg for 5 reps', metricId: 'load_kg', measurementMethod: 'Back squat, 5 reps to parallel',
  baselineKnown: true, baselineValue: 80, targetValue: 100, reason: 'To be stronger for football',
  requestedDeadline: '2099-01-08',
};
const goalNamed = (name) => ({ ...GOAL, specificOutcome: name });

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
    focus: null, goals: [], block: null, program: null, todayPlan: null,
  });
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
  expect(state().onboarded).toBe(false);
});

afterEach(async () => {
  await settle();
  jest.restoreAllMocks();
});

describe('the onboarding interview is saved whole or not at all', () => {
  test('profile, focus and goal are written together and read back', async () => {
    const binding = state().beginOnboardingDraft();
    state().completeOnboarding(PROFILE, 'Synthetic A', undefined, undefined, { binding, focus: LOWER_BODY, goal: GOAL });
    await settle();
    expect(state().error).toBeNull();
    expect(state().onboarded).toBe(true);
    expect(state().focus).toMatchObject({ bundleId: 'lower_body', customised: false, revision: 1,
      muscles: ['glutes', 'quadriceps', 'hamstrings', 'calves'] });
    expect(state().goals).toHaveLength(1);
    expect(state().goals[0]).toMatchObject({ status: 'active', revision: 1, observations: [],
      goal: { specificOutcome: GOAL.specificOutcome, unit: 'kg', baselineValue: 80, targetValue: 100, requestedDeadline: '2099-01-08' } });
    expect(all('SELECT bundle_id, customised, movement_control, revision FROM athlete_focus'))
      .toEqual([{ bundle_id: 'lower_body', customised: 0, movement_control: 0, revision: 1 }]);
    expect(count('athlete_focus_muscle')).toBe(4);
    expect(count('athlete_goal')).toBe(1);
    expect(count('athlete_goal_revision')).toBe(1);
    // No measurement is invented from the stated baseline.
    expect(count('athlete_goal_observation')).toBe(0);
  });

  test('skipping the detailed goal saves the focus alone', async () => {
    state().completeOnboarding(PROFILE, 'Synthetic A', undefined, undefined,
      { binding: state().beginOnboardingDraft(), focus: { bundleId: 'posture', muscles: ['upper_back', 'rear_shoulders', 'core'] } });
    await settle();
    expect(state().onboarded).toBe(true);
    expect(state().focus).toMatchObject({ bundleId: 'posture', movementControl: true });
    expect(state().goals).toEqual([]);
    expect(count('athlete_goal')).toBe(0);
  });

  test('an incomplete goal is refused before anything is written', async () => {
    state().completeOnboarding(PROFILE, 'Synthetic A', undefined, undefined,
      { binding: state().beginOnboardingDraft(), focus: LOWER_BODY, goal: { ...GOAL, reason: '' } });
    await settle();
    expect(state().error).toMatch(/why this matters/);
    expect(state().onboarded).toBe(false);
    expect(state().focus).toBeNull();
    expect(count('athlete_focus')).toBe(0);
    expect(count('athlete_goal')).toBe(0);
  });

  test('an unrecognised focus is refused before anything is written', async () => {
    state().completeOnboarding(PROFILE, 'Synthetic A', undefined, undefined,
      { binding: state().beginOnboardingDraft(), focus: { bundleId: null, muscles: ['legs'] }, goal: GOAL });
    await settle();
    expect(state().error).toMatch(/not recognised/);
    expect(state().onboarded).toBe(false);
    expect(count('athlete_focus')).toBe(0);
    expect(count('athlete_goal')).toBe(0);
  });

  test('a failure on the LAST write rolls the profile and the focus back with it', async () => {
    const before = all('SELECT * FROM athlete_profile');
    // The goal revision is the final statement of the save. Make it fail.
    raw().exec(`CREATE TEMP TRIGGER synthetic_goal_failure BEFORE INSERT ON athlete_goal_revision
                BEGIN SELECT RAISE(ABORT, 'synthetic storage failure'); END`);
    state().completeOnboarding(PROFILE, 'Synthetic A', undefined, undefined,
      { binding: state().beginOnboardingDraft(), focus: LOWER_BODY, goal: GOAL });
    await settle();
    expect(state().error).toMatch(/synthetic storage failure/);
    expect(state().onboarded).toBe(false);
    expect(state().focus).toBeNull();
    expect(state().goals).toEqual([]);
    expect(all('SELECT * FROM athlete_profile')).toEqual(before);
    expect(count('athlete_focus')).toBe(0);
    expect(count('athlete_focus_muscle')).toBe(0);
    expect(count('athlete_goal')).toBe(0);
    // The database is not left inside the failed transaction.
    raw().exec('DROP TRIGGER synthetic_goal_failure');
    expect(state().saveFocus(LOWER_BODY)).toBe(true);
  });
});

describe('the interview is bound to the athlete it was started for', () => {
  test('switching athlete while the interview is open writes nothing to either athlete', async () => {
    const binding = state().beginOnboardingDraft();
    expect(binding.athleteId).toBe('default');
    const profileA = all('SELECT * FROM athlete_profile');
    state().switchAthlete('athlete-b');
    await settle();
    expect(state().status).toBe('ready');
    expect(state().activeAthleteId).toBe('athlete-b');
    const profileB = all('SELECT * FROM athlete_profile', B);

    // The interview started for athlete A is submitted while B is open.
    state().completeOnboarding(PROFILE, 'Synthetic A', undefined, undefined, { binding, focus: LOWER_BODY, goal: GOAL });
    await settle();
    expect(state().error).toBe(ONBOARDING_STALE_MESSAGE);
    expect(state().onboarded).toBe(false);
    expect(state().focus).toBeNull();
    for (const file of [A, B]) {
      expect(count('athlete_focus', file)).toBe(0);
      expect(count('athlete_goal', file)).toBe(0);
    }
    expect(all('SELECT * FROM athlete_profile')).toEqual(profileA);
    expect(all('SELECT * FROM athlete_profile', B)).toEqual(profileB);
    expect(mockRegistry.athletes.map((athlete) => athlete.name)).toEqual(['Synthetic A', 'Synthetic B']);
  });

  test('switching away and back does not revive the old interview', async () => {
    const binding = state().beginOnboardingDraft();
    state().switchAthlete('athlete-b');
    await settle();
    state().switchAthlete('default');
    await settle();
    expect(state().activeAthleteId).toBe('default');
    // Same athlete id, different store context: the draft is still stale.
    state().completeOnboarding(PROFILE, 'Synthetic A', undefined, undefined, { binding, focus: LOWER_BODY, goal: GOAL });
    await settle();
    expect(state().error).toBe(ONBOARDING_STALE_MESSAGE);
    expect(count('athlete_focus')).toBe(0);
    expect(count('athlete_goal')).toBe(0);

    // A draft started in the current context is accepted.
    useStore.setState({ error: null });
    state().completeOnboarding(PROFILE, 'Synthetic A', undefined, undefined,
      { binding: state().beginOnboardingDraft(), focus: LOWER_BODY, goal: GOAL });
    await settle();
    expect(state().error).toBeNull();
    expect(count('athlete_goal')).toBe(1);
  });

  test('each athlete keeps their own focus and goals', async () => {
    expect(state().saveFocus(LOWER_BODY)).toBe(true);
    expect(state().saveGoal(GOAL)).toBe(true);
    state().switchAthlete('athlete-b');
    await settle();
    expect(state().focus).toBeNull();
    expect(state().goals).toEqual([]);
    expect(count('athlete_goal', B)).toBe(0);
    state().switchAthlete('default');
    await settle();
    expect(state().focus).toMatchObject({ bundleId: 'lower_body' });
    expect(state().goals).toHaveLength(1);
  });
});

describe('focus', () => {
  test('a saved focus is normalised, replaces the previous one and advances its revision', () => {
    expect(state().saveFocus({ bundleId: 'lower_body', muscles: ['calves', 'glutes', 'glutes', 'core'] })).toBe(true);
    expect(state().focus).toMatchObject({ bundleId: 'lower_body', customised: true, revision: 1, muscles: ['core', 'glutes', 'calves'] });
    expect(state().saveFocus({ bundleId: null, muscles: ['biceps'] })).toBe(true);
    expect(state().focus).toMatchObject({ bundleId: null, customised: true, revision: 2, muscles: ['biceps'] });
    expect(all('SELECT muscle_group_id FROM athlete_focus_muscle')).toEqual([{ muscle_group_id: 'biceps' }]);
    expect(state().saveFocus({ bundleId: 'balanced', muscles: [] })).toBe(true);
    expect(state().focus).toMatchObject({ bundleId: 'balanced', muscles: [], revision: 3 });
    expect(count('athlete_focus')).toBe(1);
    expect(count('athlete_focus_muscle')).toBe(0);
  });

  test('an unrecognised or oversized selection is refused and the saved focus is untouched', () => {
    expect(state().saveFocus(LOWER_BODY)).toBe(true);
    expect(state().saveFocus({ bundleId: null, muscles: ['arms'] })).toBe(false);
    expect(state().error).toMatch(/not recognised/);
    expect(state().saveFocus({ bundleId: null,
      muscles: ['chest', 'upper_chest', 'shoulders', 'biceps', 'triceps', 'lats', 'core'] })).toBe(false);
    expect(state().error).toMatch(/Choose up to 6 areas/);
    expect(state().focus).toMatchObject({ bundleId: 'lower_body', revision: 1 });
    expect(count('athlete_focus_muscle')).toBe(4);
  });

  test('the database itself refuses a seventh area and an unknown muscle group', () => {
    expect(state().saveFocus({ bundleId: null, muscles: ['chest', 'upper_chest', 'shoulders', 'biceps', 'triceps', 'lats'] })).toBe(true);
    expect(() => raw().exec("INSERT INTO athlete_focus_muscle (focus_id, muscle_group_id) VALUES (1, 'core')"))
      .toThrow(/at most six areas/);
    raw().exec("DELETE FROM athlete_focus_muscle WHERE muscle_group_id = 'lats'");
    expect(() => raw().exec("INSERT INTO athlete_focus_muscle (focus_id, muscle_group_id) VALUES (1, 'legs')")).toThrow();
  });

  test('changing the focus or a goal does not rewrite an existing plan', () => {
    state().saveProfile(PROFILE);
    expect(state().createTrainingProgram({ horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] })).toBe(true);
    const plan = () => JSON.stringify([
      all('SELECT * FROM planned_slot ORDER BY 1'), all('SELECT * FROM planned_session ORDER BY 1'),
      all('SELECT * FROM training_block ORDER BY 1'),
    ]);
    const before = plan();
    expect(JSON.parse(before)[0].length).toBeGreaterThan(0);
    expect(state().saveFocus(LOWER_BODY)).toBe(true);
    expect(state().saveGoal(GOAL)).toBe(true);
    const goal = state().goals[0];
    expect(state().saveGoal({ ...GOAL, targetValue: 110 }, { goalId: goal.goalId, expectedRevision: 1 })).toBe(true);
    expect(state().recordGoalObservation(goal.goalId, '2020-01-05', 85)).toBe(true);
    expect(plan()).toBe(before);
  });
});

describe('goals are edited by appending, never by rewriting', () => {
  const createGoal = () => {
    expect(state().saveGoal(GOAL)).toBe(true);
    return state().goals[0];
  };

  test('an edit appends a revision; the earlier definition and its observations stay exactly as recorded', () => {
    const created = createGoal();
    expect(state().recordGoalObservation(created.goalId, '2020-01-05', 82.5)).toBe(true);
    const firstRevision = all('SELECT * FROM athlete_goal_revision');
    const firstObservation = all('SELECT * FROM athlete_goal_observation');

    expect(state().saveGoal({ ...GOAL, targetValue: 110, requestedDeadline: null },
      { goalId: created.goalId, expectedRevision: 1 })).toBe(true);
    expect(state().goals[0]).toMatchObject({ revision: 2, goal: { targetValue: 110, requestedDeadline: null } });
    const revisions = all('SELECT * FROM athlete_goal_revision ORDER BY revision');
    expect(revisions).toHaveLength(2);
    expect(revisions[0]).toEqual(firstRevision[0]);
    expect(all('SELECT * FROM athlete_goal_observation')).toEqual(firstObservation);
    expect(state().goals[0].observations).toMatchObject([{ observedOn: '2020-01-05', value: 82.5, goalRevision: 1, unit: 'kg' }]);

    // A measurement taken after the edit is bound to the definition in force then.
    expect(state().recordGoalObservation(created.goalId, '2020-02-05', 90)).toBe(true);
    expect(all('SELECT goal_revision FROM athlete_goal_observation ORDER BY observed_on'))
      .toEqual([{ goal_revision: 1 }, { goal_revision: 2 }]);
  });

  test('a second save from the same editor (duplicate tap or stale screen) is refused', () => {
    const created = createGoal();
    const stale = { goalId: created.goalId, expectedRevision: 1 };
    expect(state().saveGoal({ ...GOAL, targetValue: 105 }, stale)).toBe(true);
    expect(state().saveGoal({ ...GOAL, targetValue: 120 }, stale)).toBe(false);
    expect(state().error).toMatch(/changed since you opened it/);
    expect(state().goals[0]).toMatchObject({ revision: 2, goal: { targetValue: 105 } });
    expect(count('athlete_goal_revision')).toBe(2);
  });

  test('an invalid edit changes nothing', () => {
    const created = createGoal();
    expect(state().saveGoal({ ...GOAL, measurementMethod: '' }, { goalId: created.goalId, expectedRevision: 1 })).toBe(false);
    expect(state().goals[0].revision).toBe(1);
    expect(count('athlete_goal_revision')).toBe(1);
  });

  test('the database refuses to rewrite a revision or an observation', () => {
    const created = createGoal();
    expect(state().recordGoalObservation(created.goalId, '2020-01-05', 82.5)).toBe(true);
    expect(() => raw().exec('UPDATE athlete_goal_revision SET target_value = 500')).toThrow(/immutable/);
    expect(() => raw().exec('UPDATE athlete_goal_observation SET value = 500')).toThrow(/immutable/);
    expect(() => raw().exec('DELETE FROM athlete_goal_revision')).toThrow(/kept for as long as its goal exists/);
    expect(state().saveGoal({ ...GOAL, targetValue: 105 }, { goalId: created.goalId, expectedRevision: 1 })).toBe(true);
    expect(() => raw().exec('UPDATE athlete_goal SET current_revision = 1')).toThrow(/cannot move backwards/);
  });

  test('status changes keep the definition and the measurements', () => {
    const created = createGoal();
    expect(state().recordGoalObservation(created.goalId, '2020-01-05', 100)).toBe(true);
    expect(state().setGoalStatus(created.goalId, 'achieved')).toBe(true);
    expect(state().goals[0]).toMatchObject({ status: 'achieved', revision: 1 });
    expect(state().goals[0].observations).toHaveLength(1);
    expect(state().setGoalStatus('goal-that-does-not-exist', 'retired')).toBe(false);
  });
});

describe('progress uses only measurements of what the goal tracks now', () => {
  test('after an edit to a different metric, earlier measurements stay on record but leave progress', () => {
    expect(state().saveGoal(GOAL)).toBe(true);
    const { goalId } = state().goals[0];
    expect(state().recordGoalObservation(goalId, '2020-01-05', 90)).toBe(true);
    // The same goal now counts repetitions instead of kilograms.
    expect(state().saveGoal({
      ...GOAL, metricId: 'reps', baselineKnown: true, baselineValue: 5, targetValue: 12,
    }, { goalId, expectedRevision: 1 })).toBe(true);
    const stored = state().goals[0];
    expect(stored.goal).toMatchObject({ metricId: 'reps', unit: 'reps' });
    // Nothing was deleted or rewritten: the kilogram measurement is still there,
    // labelled with the metric it was recorded against.
    expect(stored.observations).toMatchObject([{ value: 90, unit: 'kg', metricId: 'load_kg', goalRevision: 1 }]);
    const { goalProgress } = require('@ak/inference');
    // 90 kg is not "90 reps, target reached".
    expect(goalProgress(stored.goal, stored.observations).kind).toBe('no_observations');
    expect(state().recordGoalObservation(goalId, '2020-02-05', 8)).toBe(true);
    const after = state().goals[0];
    expect(goalProgress(after.goal, after.observations)).toMatchObject({ kind: 'moving_toward', latest: { value: 8 } });
  });
});

describe('observations are real measurements only', () => {
  test('a future date, a non-number and an unknown goal record nothing', () => {
    expect(state().saveGoal(GOAL)).toBe(true);
    const { goalId } = state().goals[0];
    expect(state().recordGoalObservation(goalId, '2999-01-01', 90)).toBe(false);
    expect(state().recordGoalObservation(goalId, '2020-01-05', Number.NaN)).toBe(false);
    expect(state().recordGoalObservation(goalId, '2020-01-05', -1)).toBe(false);
    expect(state().recordGoalObservation(goalId, 'last week', 90)).toBe(false);
    expect(state().error).toMatch(/Enter the measurement and the date/);
    // An impossible calendar date is ordinary typed input: same plain message,
    // never the database's own constraint text.
    useStore.setState({ error: null });
    expect(state().recordGoalObservation(goalId, '2020-02-30', 90)).toBe(false);
    expect(state().error).toBe('Enter the measurement and the date it was taken (today or earlier).');
    expect(state().recordGoalObservation(goalId, '2021-13-01', 90)).toBe(false);
    expect(state().recordGoalObservation('goal-that-does-not-exist', '2020-01-05', 90)).toBe(false);
    expect(count('athlete_goal_observation')).toBe(0);
  });

  test('a mistaken measurement can be removed; the others are untouched', () => {
    expect(state().saveGoal(GOAL)).toBe(true);
    const { goalId } = state().goals[0];
    expect(state().recordGoalObservation(goalId, '2020-01-05', 82.5)).toBe(true);
    expect(state().recordGoalObservation(goalId, '2020-01-12', 825)).toBe(true);
    const wrong = state().goals[0].observations.find((row) => row.value === 825);
    state().removeGoalObservation(wrong.observationId);
    expect(state().goals[0].observations).toMatchObject([{ observedOn: '2020-01-05', value: 82.5 }]);
    expect(count('athlete_goal_observation')).toBe(1);
  });

  test('the database only accepts athlete-entered measurements on a real date', () => {
    expect(state().saveGoal(GOAL)).toBe(true);
    const { goalId } = state().goals[0];
    const insert = (id, date, source) => raw().prepare(
      `INSERT INTO athlete_goal_observation (observation_id, goal_id, goal_revision, observed_on, value, unit, source, recorded_at_ms)
       VALUES (?, ?, 1, ?, 90, 'kg', ?, 1)`).run(id, goalId, date, source);
    expect(() => insert('obs-estimated', '2020-01-05', 'estimated_from_training')).toThrow();
    expect(() => insert('obs-bad-date', '2020-02-30', 'athlete_entered')).toThrow();
    insert('obs-real-one', '2020-01-05', 'athlete_entered');
    expect(count('athlete_goal_observation')).toBe(1);
  });
});

describe('limits and lifecycle', () => {
  test('five active goals is the limit, in the store and in the database', () => {
    for (let n = 1; n <= 5; n += 1) expect(state().saveGoal(goalNamed(`Goal number ${n}`))).toBe(true);
    expect(state().saveGoal(goalNamed('Goal number 6'))).toBe(false);
    expect(state().error).toMatch(/up to 5 active goals/);
    expect(count('athlete_goal')).toBe(5);
    expect(() => raw().exec("INSERT INTO athlete_goal (goal_id, status, current_revision, created_at_ms, updated_at_ms) VALUES ('goal-direct-sixth', 'active', 1, 1, 1)"))
      .toThrow(/at most five goals can be active/);

    // Retiring one makes room; the retired goal cannot be reactivated past the limit.
    const retired = state().goals[0].goalId;
    expect(state().setGoalStatus(retired, 'retired')).toBe(true);
    expect(state().saveGoal(goalNamed('Goal number 6'))).toBe(true);
    expect(state().goals.filter((goal) => goal.status === 'active')).toHaveLength(5);
    expect(state().setGoalStatus(retired, 'active')).toBe(false);
    expect(state().error).toMatch(/at most five goals can be active/);
    expect(state().goals.find((goal) => goal.goalId === retired).status).toBe('retired');
  });

  test('onboarding cannot add a sixth active goal either, and saves nothing when it would', async () => {
    for (let n = 1; n <= 5; n += 1) expect(state().saveGoal(goalNamed(`Goal number ${n}`))).toBe(true);
    state().completeOnboarding(PROFILE, 'Synthetic A', undefined, undefined,
      { binding: state().beginOnboardingDraft(), focus: LOWER_BODY, goal: GOAL });
    await settle();
    expect(state().error).toMatch(/up to 5 active goals/);
    expect(state().onboarded).toBe(false);
    expect(count('athlete_focus')).toBe(0);
    expect(count('athlete_goal')).toBe(5);
  });

  test.each([['ON'], ['OFF']])('a training-data reset removes measurements and keeps goals and focus (foreign keys %s)', (mode) => {
    raw().exec(`PRAGMA foreign_keys = ${mode}`);
    expect(state().saveFocus(LOWER_BODY)).toBe(true);
    expect(state().saveGoal(GOAL)).toBe(true);
    const { goalId } = state().goals[0];
    expect(state().saveGoal({ ...GOAL, targetValue: 105 }, { goalId, expectedRevision: 1 })).toBe(true);
    expect(state().recordGoalObservation(goalId, '2020-01-05', 82.5)).toBe(true);
    const definitions = all('SELECT * FROM athlete_goal_revision ORDER BY revision');

    // The return value reports whether any SESSION existed; there are none here.
    state().resetTrainingData();
    expect(state().error).toBeNull();
    expect(count('athlete_goal_observation')).toBe(0);
    expect(all('SELECT * FROM athlete_goal_revision ORDER BY revision')).toEqual(definitions);
    expect(state().goals).toHaveLength(1);
    expect(state().goals[0]).toMatchObject({ revision: 2, observations: [], goal: { targetValue: 105 } });
    expect(state().focus).toMatchObject({ bundleId: 'lower_body', muscles: ['glutes', 'quadriceps', 'hamstrings', 'calves'] });
  });

  test('focus and goals are read back from storage after a restart', async () => {
    expect(state().saveFocus({ bundleId: 'beach_muscles', muscles: ['biceps', 'triceps', 'upper_chest'] })).toBe(true);
    expect(state().saveGoal({ ...GOAL, baselineKnown: false, baselineValue: null })).toBe(true);
    const { goalId } = state().goals[0];
    expect(state().recordGoalObservation(goalId, '2020-01-05', 78)).toBe(true);
    useStore.setState({ status: 'booting', focus: null, goals: [] });
    state().boot();
    await settle();
    expect(state().status).toBe('ready');
    expect(state().focus).toMatchObject({ bundleId: 'beach_muscles', customised: false, muscles: ['upper_chest', 'biceps', 'triceps'] });
    expect(state().goals).toHaveLength(1);
    expect(state().goals[0]).toMatchObject({ goalId, goal: { baselineKnown: false, baselineValue: null },
      observations: [{ observedOn: '2020-01-05', value: 78 }] });
  });
});
