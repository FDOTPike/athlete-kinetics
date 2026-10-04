/**
 * OnboardingFocusGoal.test.js — the focus and target questions an athlete
 * actually sees, with the REAL store behind the screen (production boot path
 * and migration chain; node:sqlite stands in for the op-sqlite handle only).
 *
 *   - the focus slide asks the exact question, offers the four bundles, lets
 *     every bundle be edited and individual muscle groups be chosen;
 *   - a detailed target is optional: the interview is eight screens without
 *     it and nine with it, and "skip" really does train with the focus alone;
 *   - a started target must be finished or explicitly skipped;
 *   - the feasibility note states arithmetic and uncertainty, never a promise;
 *   - finishing saves profile, focus and goal together; a refused save is
 *     shown instead of failing silently;
 *   - the profile panel edits focus and goals later without touching a plan.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore, ONBOARDING_STALE_MESSAGE } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import OnboardingScreen from '../../src/screens/OnboardingScreen';
import { FocusGoalsPanel } from '../../src/components/FocusGoalsPanel';
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

// First render of a heavy screen in a fresh jest worker takes several seconds.
jest.setTimeout(60_000);

const A = 'athlete_kinetics.db';
const state = () => useStore.getState();
const raw = () => mockDrivers.get(A).raw;
const count = (table) => Number(raw().prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c);
const settle = async () => { for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); }); };
const press = (testID) => act(() => { fireEvent.press(screen.getByTestId(testID)); });
const pressLabel = (label) => act(() => { fireEvent.press(screen.getByLabelText(label)); });
const type = (testID, text) => act(() => { fireEvent.changeText(screen.getByTestId(testID), text); });
const next = () => pressLabel('Next');
// Finishing also renames the athlete in the registry asynchronously; keep that
// store update inside act so the screen re-renders the way it does on device.
const startTraining = () => act(async () => {
  fireEvent.press(screen.getByLabelText('START TRAINING'));
  await settle();
});
const selected = (testID) => screen.getByTestId(testID).props.accessibilityState.selected;
const stepLabel = () => screen.getByLabelText(/^Step \d+ of \d+$/).props.accessibilityLabel;
const nextDisabled = () => screen.getByLabelText('Next').props.accessibilityState.disabled === true;

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDrivers = new Map();
  mockRegistry = { version: 1, activeId: 'default', advancedToolsUnlocked: false, athletes: [
    { id: 'default', name: 'Athlete 1', dbName: A, createdAtMs: 0 },
    { id: 'athlete-b', name: 'Synthetic B', dbName: 'athlete_b.db', createdAtMs: 1 },
  ] };
  useStore.setState({
    status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null,
    focus: null, goals: [], block: null, program: null, todayPlan: null,
  });
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
});

afterEach(async () => {
  await settle();
  jest.restoreAllMocks();
});

/** welcome -> goal -> focus. */
const openFocusSlide = () => {
  render(<OnboardingScreen />);
  next();
  next();
  expect(screen.getByTestId('focus-picker')).toBeTruthy();
};
/** From the experience screen to the review screen, answering the required question. */
const walkToReview = () => {
  next(); // experience -> logistics
  next(); // logistics -> equipment
  next(); // equipment -> limits
  pressLabel('No, nothing to note');
  next(); // limits -> review
  expect(screen.getByLabelText('START TRAINING')).toBeTruthy();
};
const fillTarget = () => {
  type('goal-outcome', 'Squat 100 kg for 5 reps');
  type('goal-method', 'Back squat, 5 reps to parallel');
  type('goal-baseline', '80');
  type('goal-target', '100');
  type('goal-reason', 'To be stronger for football');
};

describe('the focus slide', () => {
  test('asks the exact question and starts from balanced whole body', () => {
    openFocusSlide();
    expect(screen.getByText('Is there an area that you want to work on?')).toBeTruthy();
    expect(stepLabel()).toBe('Step 3 of 8');
    for (const bundle of ['posture', 'beach_muscles', 'lower_body', 'balanced']) {
      expect(screen.getByTestId(`focus-bundle-${bundle}`)).toBeTruthy();
    }
    // Nothing is assumed about the athlete: no bundle is pre-selected for them.
    expect(selected('focus-bundle-balanced')).toBe(true);
    expect(screen.getByTestId('focus-summary').props.children).toBe('Selected — Balanced whole body');
    expect(screen.getByLabelText('Posture. Upper back, core and controlled movement.')).toBeTruthy();
    expect(screen.getByLabelText('Beach muscles. Arms and upper chest.')).toBeTruthy();
    // The athlete is told what a focus does and does not do.
    expect(screen.getByText(/you still train your whole body, and safety, your equipment and your available time always come first/)).toBeTruthy();
  });

  test('a bundle can be edited: areas are added and removed, and the summary says so', () => {
    openFocusSlide();
    press('focus-bundle-lower_body');
    expect(screen.getByTestId('focus-summary').props.children).toBe('Selected — Lower body: glutes, quads, hamstrings, calves');
    expect(screen.queryByTestId('focus-muscle-groups')).toBeNull();
    pressLabel('Choose individual muscle groups');
    expect(selected('focus-muscle-glutes')).toBe(true);
    expect(selected('focus-muscle-core')).toBe(false);
    press('focus-muscle-calves');
    press('focus-muscle-core');
    expect(screen.getByTestId('focus-summary').props.children)
      .toBe('Selected — Lower body (edited): core and abs, glutes, quads, hamstrings');
    expect(selected('focus-bundle-lower_body')).toBe(true);
  });

  test('muscle groups can be chosen one by one, in plain gym language, up to six', () => {
    openFocusSlide();
    pressLabel('Choose individual muscle groups');
    for (const label of ['QUADS', 'LATS', 'CORE AND ABS', 'REAR SHOULDERS', 'INNER THIGHS', 'OUTER HIPS']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    press('focus-muscle-biceps');
    expect(selected('focus-bundle-balanced')).toBe(false);
    expect(screen.getByTestId('focus-summary').props.children).toBe('Selected — Your own selection: biceps');
    for (const muscle of ['triceps', 'chest', 'shoulders', 'lats', 'core']) press(`focus-muscle-${muscle}`);
    expect(screen.getByText(/That is 6 areas, the most that still counts as an emphasis/)).toBeTruthy();
    expect(screen.getByTestId('focus-muscle-glutes').props.accessibilityState.disabled).toBe(true);
    press('focus-muscle-glutes');
    expect(selected('focus-muscle-glutes')).toBe(false);
    // Clearing every area is balanced whole body again.
    for (const muscle of ['biceps', 'triceps', 'chest', 'shoulders', 'lats', 'core']) press(`focus-muscle-${muscle}`);
    expect(selected('focus-bundle-balanced')).toBe(true);
  });
});

describe('the detailed target is optional', () => {
  test('focus only: eight screens, no target screen, and only the focus is saved', async () => {
    openFocusSlide();
    press('focus-bundle-posture');
    next();
    expect(screen.queryByTestId('goal-editor')).toBeNull();
    expect(screen.getByText('HOW LONG HAVE YOU BEEN TRAINING?')).toBeTruthy();
    expect(stepLabel()).toBe('Step 4 of 8');
    walkToReview();
    expect(stepLabel()).toBe('Step 8 of 8');
    expect(screen.getByText('Posture: rear shoulders, upper back, core and abs')).toBeTruthy();
    expect(screen.getByTestId('onboarding-summary-target-row').props.children)
      .toBe('No specific target — training with the focus only.');
    await startTraining();
    expect(state().error).toBeNull();
    expect(state().onboarded).toBe(true);
    expect(state().focus).toMatchObject({ bundleId: 'posture', movementControl: true, muscles: ['rear_shoulders', 'upper_back', 'core'] });
    expect(state().goals).toEqual([]);
    expect(count('athlete_goal')).toBe(0);
  });

  test('with a target: nine screens, a gate until the goal is complete, and one atomic save', async () => {
    openFocusSlide();
    press('focus-bundle-lower_body');
    press('onboarding-wants-target');
    expect(stepLabel()).toBe('Step 3 of 9');
    next();
    expect(screen.getByTestId('goal-editor')).toBeTruthy();
    expect(stepLabel()).toBe('Step 4 of 9');
    // A started target must be finished or explicitly skipped.
    expect(nextDisabled()).toBe(true);
    expect(screen.getByText(/Finish the target to continue, or choose "Skip this"/)).toBeTruthy();
    // Untouched fields are not shouted at; a touched invalid one is explained.
    expect(screen.queryByTestId('goal-error-reason')).toBeNull();
    type('goal-outcome', 'ok');
    expect(screen.getByTestId('goal-error-specificOutcome').props.children).toBe('Say exactly what you want to achieve.');
    fillTarget();
    expect(nextDisabled()).toBe(false);
    // No deadline: the gap is stated, with the uncertainty, and nothing is promised.
    const explanation = () => screen.getByTestId('goal-feasibility-explanation').props.children;
    expect(explanation()).toMatch(/an increase of 20 kg \(25% of where you are now\)/);
    expect(explanation()).toMatch(/There is no deadline/);
    expect(screen.getByTestId('goal-feasibility-uncertainty').props.children).toMatch(/not a prediction.*cannot promise/);
    // A deadline is the athlete's own date and is checked.
    press('goal-deadline-set');
    expect(nextDisabled()).toBe(true);
    type('goal-deadline', '2020-01-01');
    expect(screen.getByTestId('goal-error-requestedDeadline').props.children).toMatch(/Choose a date after today/);
    type('goal-deadline', '2099-01-08');
    expect(nextDisabled()).toBe(false);
    expect(explanation()).toMatch(/The app has no reviewed reference for how quickly this kind of measurement changes/);
    expect(screen.getByText(/never rushed, peaked or tested to a maximum for a date/)).toBeTruthy();

    next();
    expect(screen.getByText('HOW LONG HAVE YOU BEEN TRAINING?')).toBeTruthy();
    walkToReview();
    expect(stepLabel()).toBe('Step 9 of 9');
    expect(screen.getByTestId('onboarding-summary-target-row').props.children)
      .toBe('TARGET — Squat 100 kg for 5 reps: 100 kg by 2099-01-08');
    await startTraining();
    expect(state().error).toBeNull();
    expect(state().onboarded).toBe(true);
    expect(state().focus).toMatchObject({ bundleId: 'lower_body', customised: false });
    expect(state().goals).toHaveLength(1);
    expect(state().goals[0].goal).toMatchObject({ specificOutcome: 'Squat 100 kg for 5 reps', metricId: 'load_kg', unit: 'kg',
      baselineKnown: true, baselineValue: 80, targetValue: 100, requestedDeadline: '2099-01-08' });
    expect(count('athlete_goal_observation')).toBe(0);
  });

  test('"I do not know yet" is an explicit baseline answer and invents no number', async () => {
    openFocusSlide();
    press('onboarding-wants-target');
    next();
    fillTarget();
    press('goal-baseline-unknown');
    expect(screen.queryByTestId('goal-baseline')).toBeNull();
    expect(screen.getByText(/Nothing is assumed in its place/)).toBeTruthy();
    expect(screen.getByTestId('goal-feasibility-explanation').props.children).toMatch(/Your starting point is not recorded yet/);
    expect(nextDisabled()).toBe(false);
    next();
    walkToReview();
    await startTraining();
    expect(state().goals[0].goal).toMatchObject({ baselineKnown: false, baselineValue: null, requestedDeadline: null });
  });

  test('"Skip this" drops the half-written target and trains with the focus only', async () => {
    openFocusSlide();
    press('focus-bundle-beach_muscles');
    press('onboarding-wants-target');
    next();
    type('goal-outcome', 'Bigger arms');
    expect(nextDisabled()).toBe(true);
    press('onboarding-skip-target');
    // The target screen is gone and the interview carries on at the next screen.
    expect(screen.queryByTestId('goal-editor')).toBeNull();
    expect(screen.getByText('HOW LONG HAVE YOU BEEN TRAINING?')).toBeTruthy();
    expect(stepLabel()).toBe('Step 4 of 8');
    walkToReview();
    expect(screen.getByTestId('onboarding-summary-target-row').props.children)
      .toBe('No specific target — training with the focus only.');
    await startTraining();
    expect(state().onboarded).toBe(true);
    expect(state().focus).toMatchObject({ bundleId: 'beach_muscles' });
    expect(count('athlete_goal')).toBe(0);
  });

  test('a custom measurement asks for its unit', () => {
    openFocusSlide();
    press('onboarding-wants-target');
    next();
    expect(screen.queryByTestId('goal-unit')).toBeNull();
    fillTarget();
    press('goal-metric-custom');
    expect(screen.getByTestId('goal-unit')).toBeTruthy();
    expect(nextDisabled()).toBe(true);
    type('goal-unit', 'rounds');
    expect(nextDisabled()).toBe(false);
    expect(screen.getByTestId('goal-feasibility-explanation').props.children).toMatch(/20 rounds/);
  });
});

describe('a refused save is never silent', () => {
  test('switching athlete while the interview is open: nothing is saved and the screen says why', async () => {
    openFocusSlide();
    press('focus-bundle-lower_body');
    next();
    walkToReview();
    expect(screen.queryByTestId('onboarding-save-error')).toBeNull();
    // The store context moves on underneath the open interview.
    await act(async () => {
      state().switchAthlete('athlete-b');
      await settle();
    });
    expect(state().activeAthleteId).toBe('athlete-b');
    await startTraining();
    expect(state().error).toBe(ONBOARDING_STALE_MESSAGE);
    expect(screen.getByTestId('onboarding-save-error').props.children).toBe(`Not saved. ${ONBOARDING_STALE_MESSAGE}`);
    expect(state().onboarded).toBe(false);
    expect(count('athlete_focus')).toBe(0);
    expect(Number(mockDrivers.get('athlete_b.db').raw.prepare('SELECT COUNT(*) AS c FROM athlete_focus').get().c)).toBe(0);
  });
});

describe('the profile panel', () => {
  const PROFILE = { training_age: 'intermediate', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'] };

  test('shows the unanswered state honestly, then saves a focus without touching the plan', () => {
    state().saveProfile(PROFILE);
    expect(state().createTrainingProgram({ horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] })).toBe(true);
    const plan = () => JSON.stringify(raw().prepare('SELECT * FROM planned_slot ORDER BY 1').all());
    const before = plan();
    render(<FocusGoalsPanel />);
    expect(screen.getByTestId('profile-focus-summary').props.children)
      .toBe('Not answered yet. Balanced whole body is used until you choose.');
    expect(screen.getByTestId('profile-goals-empty')).toBeTruthy();
    press('profile-focus-edit');
    expect(screen.getByText('Is there an area that you want to work on?')).toBeTruthy();
    press('focus-bundle-posture');
    press('profile-focus-save');
    expect(screen.getByTestId('profile-focus-summary').props.children).toBe('Posture: rear shoulders, upper back, core and abs');
    expect(screen.getByTestId('focus-goals-message').props.children)
      .toBe('Focus saved. Your current plan is unchanged; the new focus is used when your next block is created.');
    expect(state().focus).toMatchObject({ bundleId: 'posture' });
    expect(plan()).toBe(before);
  });

  test('adds a goal, records a real measurement, and edits the goal keeping both', () => {
    render(<FocusGoalsPanel />);
    press('profile-goal-add');
    // Saving an empty goal explains every missing element instead of saving.
    press('profile-goal-save');
    expect(screen.getByTestId('goal-error-specificOutcome')).toBeTruthy();
    expect(screen.getByTestId('goal-error-reason')).toBeTruthy();
    expect(state().goals).toEqual([]);
    fillTarget();
    press('profile-goal-save');
    expect(screen.getByTestId('focus-goals-message').props.children).toBe('Goal saved.');
    const { goalId } = state().goals[0];
    expect(screen.getByTestId(`profile-goal-progress-${goalId}`).props.children)
      .toBe('No measurement recorded yet. Progress is shown only from measurements you record.');

    press(`profile-goal-measure-${goalId}`);
    // A blank or non-numeric measurement is refused, not stored as zero.
    press('profile-goal-measure-save');
    expect(screen.getByTestId('focus-goals-message').props.children).toMatch(/Enter the measurement and the date/);
    expect(count('athlete_goal_observation')).toBe(0);
    type('profile-goal-measure-value', '90');
    type('profile-goal-measure-date', '2020-03-01');
    press('profile-goal-measure-save');
    expect(screen.getByTestId('focus-goals-message').props.children).toBe('Measurement recorded.');
    expect(screen.getByTestId(`profile-goal-progress-${goalId}`).props.children)
      .toMatch(/Latest measurement: 90 kg on 2020-03-01 \(started at 80 kg, target 100 kg\)\. About 50% of the way\./);

    press(`profile-goal-edit-${goalId}`);
    type('goal-target', '120');
    press('profile-goal-save');
    expect(screen.getByTestId('focus-goals-message').props.children)
      .toBe('Goal updated. Its earlier version and your recorded measurements are kept as they were.');
    expect(state().goals[0]).toMatchObject({ revision: 2, goal: { targetValue: 120 } });
    expect(state().goals[0].observations).toMatchObject([{ observedOn: '2020-03-01', value: 90, goalRevision: 1 }]);
    expect(count('athlete_goal_revision')).toBe(2);
    expect(screen.getByTestId(`profile-goal-progress-${goalId}`).props.children).toMatch(/About 25% of the way\./);
  });

  test('a goal can be retired and is kept, not deleted', () => {
    render(<FocusGoalsPanel />);
    press('profile-goal-add');
    fillTarget();
    press('profile-goal-save');
    pressLabel('Retire the goal Squat 100 kg for 5 reps. It is kept, not deleted.');
    expect(state().goals[0].status).toBe('retired');
    expect(count('athlete_goal')).toBe(1);
    expect(screen.getByText('Target 100 kg, no deadline · retired')).toBeTruthy();
    expect(screen.getByLabelText('Make the goal Squat 100 kg for 5 reps active again')).toBeTruthy();
  });
});
