/**
 * SportScreens.test.js — the sport questions and the plan explanation an
 * athlete actually sees, with the REAL store behind the screens (production
 * boot path and migration chain; node:sqlite stands in for the op-sqlite
 * handle only).
 *
 *   - the sport screen is offered on the focus slide and joins the interview
 *     only when the athlete says they play a sport;
 *   - football and hockey must be told apart by the athlete; "another sport"
 *     is a supported answer; every sport offers a general option;
 *   - choosing an outcome shows what the plan will do, what it cannot do and
 *     the published basis, before anything is saved;
 *   - "not sure" is the starting workload answer; a competition date is
 *     context only and the screen says so;
 *   - a goal measured on an exercise can name that exercise;
 *   - the program preview and the coach screen explain the plan in the
 *     generator's own words;
 *   - the profile panel edits and removes the sport without touching a plan.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import OnboardingScreen from '../../src/screens/OnboardingScreen';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';
import { SportPanel } from '../../src/components/SportPanel';
import { FocusGoalsPanel } from '../../src/components/FocusGoalsPanel';
import { EmphasisReportCard } from '../../src/components/EmphasisReportCard';
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
const selected = (testID) => screen.getByTestId(testID).props.accessibilityState.selected;
const stepLabel = () => screen.getByLabelText(/^Step \d+ of \d+$/).props.accessibilityLabel;
const nextDisabled = () => screen.getByLabelText('Next').props.accessibilityState.disabled === true;
const textsOf = (testID) => screen.queryAllByTestId(testID).map((node) => node.props.children);
const startTraining = () => act(async () => {
  fireEvent.press(screen.getByLabelText('START TRAINING'));
  await settle();
});

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDrivers = new Map();
  mockRegistry = { version: 1, activeId: 'default', advancedToolsUnlocked: false, athletes: [
    { id: 'default', name: 'Athlete 1', dbName: A, createdAtMs: 0 },
  ] };
  useStore.setState({
    status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null,
    focus: null, goals: [], sport: null, goalMovements: {}, blockEmphasis: null,
    block: null, program: null, todayPlan: null,
  });
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
});

afterEach(async () => {
  await settle();
  jest.restoreAllMocks();
});

/** welcome -> goal -> focus, with the sport screen switched on -> sport. */
const openSportSlide = () => {
  render(<OnboardingScreen />);
  next();
  next();
  press('onboarding-wants-sport');
  next();
  expect(screen.getByTestId('sport-editor')).toBeTruthy();
};
const walkToReview = () => {
  next(); // experience -> logistics
  next(); // logistics -> equipment
  next(); // equipment -> limits
  pressLabel('No, nothing to note');
  next(); // limits -> review
  expect(screen.getByLabelText('START TRAINING')).toBeTruthy();
};

describe('the sport screen in the interview', () => {
  test('is offered on the focus slide and is not part of the interview unless asked for', () => {
    render(<OnboardingScreen />);
    next();
    next();
    expect(stepLabel()).toBe('Step 3 of 8');
    expect(selected('onboarding-wants-sport')).toBe(false);
    press('onboarding-wants-sport');
    expect(stepLabel()).toBe('Step 3 of 9');
    next();
    expect(screen.getByText('DO YOU PLAY OR COMPETE IN A SPORT?')).toBeTruthy();
    expect(stepLabel()).toBe('Step 4 of 9');
    for (const family of ['basketball', 'football', 'hockey', 'powerlifting', 'muay_thai', 'other']) {
      expect(screen.getByTestId(`sport-family-${family}`)).toBeTruthy();
    }
    // A started sport answer is finished or skipped: nothing half-answered is carried forward.
    expect(nextDisabled()).toBe(true);
    expect(screen.getByText(/Finish the sport questions to continue, or choose "Skip this"/)).toBeTruthy();
  });

  test('football must be told apart by the athlete; the app never picks a code', () => {
    openSportSlide();
    press('sport-family-football');
    expect(screen.getByText('WHICH KIND OF FOOTBALL?')).toBeTruthy();
    expect(screen.getByLabelText('Football (soccer). Association football: round ball, played with the feet.')).toBeTruthy();
    expect(screen.getByLabelText('Australian football (AFL). Australian rules: oval ball, marking and kicking, an oval field.')).toBeTruthy();
    expect(screen.getByLabelText('Rugby. Rugby union or rugby league: oval ball, tackling, no forward pass.')).toBeTruthy();
    expect(screen.getByLabelText('American football. Gridiron: downs, pads and helmets.')).toBeTruthy();
    // No code is selected and no outcome is offered until the athlete chooses.
    for (const id of ['football_association', 'football_australian', 'football_rugby', 'football_american']) {
      expect(selected(`sport-${id}`)).toBe(false);
    }
    expect(screen.queryByTestId('sport-outcome-general_support')).toBeNull();
    press('sport-football_australian');
    expect(screen.getByTestId('sport-outcome-jump_higher')).toBeTruthy();
    expect(screen.getByTestId('sport-outcome-strength_for_contact')).toBeTruthy();
    // Changing the code clears the outcome: an AFL outcome is not carried to soccer.
    press('sport-outcome-jump_higher');
    press('sport-football_association');
    expect(screen.queryByTestId('sport-outcome-jump_higher')).toBeNull();
    expect(selected('sport-outcome-faster_running')).toBe(false);
  });

  test('hockey is field or ice; a single-code sport needs no second question', () => {
    openSportSlide();
    press('sport-family-hockey');
    expect(screen.getByLabelText('Field hockey. Played on grass or turf.')).toBeTruthy();
    expect(screen.getByLabelText('Ice hockey. Played on ice, on skates.')).toBeTruthy();
    press('sport-family-basketball');
    expect(screen.queryByText(/WHICH KIND OF/)).toBeNull();
    expect(screen.getByTestId('sport-outcome-jump_higher')).toBeTruthy();
  });

  test('choosing an outcome says what the plan will do, what it cannot do, and on what basis', () => {
    openSportSlide();
    press('sport-family-basketball');
    expect(screen.queryByTestId('sport-emphasis')).toBeNull();
    press('sport-outcome-jump_higher');
    expect(screen.getByTestId('sport-emphasis-summary').props.children)
      .toBe('Extra leg-strength work for quads, glutes and calves, which jumping relies on.');
    expect(textsOf('sport-emphasis-limit').join(' ')).toMatch(/no jump or plyometric drills yet.*does not include jump training itself/);
    expect(screen.getByTestId('sport-emphasis-basis').props.children).toMatch(/Suchomel.*Markovic/);
    // An outcome with no reviewed basis says so and adds nothing.
    press('sport-family-muay_thai');
    press('sport-outcome-striking_and_clinch');
    expect(screen.getByTestId('sport-emphasis-summary').props.children).toMatch(/^No extra emphasis\. The app has no reviewed evidence/);
    expect(textsOf('sport-emphasis-limit').join(' ')).toMatch(/hip-flexor raises are not added by default/);
    expect(screen.queryByTestId('sport-emphasis-basis')).toBeNull();
  });

  test('"not sure" is the starting workload answer; the competition date is context only', () => {
    openSportSlide();
    press('sport-family-powerlifting');
    expect(screen.getByLabelText('PRACTICE SESSIONS A WEEK Not sure')).toBeTruthy();
    expect(screen.getByLabelText('MATCHES OR COMPETITIONS A WEEK Not sure')).toBeTruthy();
    expect(selected('sport-practice-unsure')).toBe(true);
    pressLabel('Increase PRACTICE SESSIONS A WEEK');
    pressLabel('Increase PRACTICE SESSIONS A WEEK');
    expect(screen.getByLabelText('PRACTICE SESSIONS A WEEK 2')).toBeTruthy();
    expect(selected('sport-practice-unsure')).toBe(false);
    press('sport-practice-unsure');
    expect(screen.getByLabelText('PRACTICE SESSIONS A WEEK Not sure')).toBeTruthy();
    expect(screen.getByTestId('sport-competition-note').props.children)
      .toBe('The date is used for reminders and for reviewing your goals. It does not make the plan peak, taper or test a maximum.');
    press('sport-outcome-bigger_competition_lifts');
    press('sport-experience-over_5_years');
    expect(nextDisabled()).toBe(false);
    type('sport-competition', '2020-01-01');
    expect(screen.getByTestId('sport-error-competitionDate').props.children).toMatch(/That date has passed/);
    expect(nextDisabled()).toBe(true);
    type('sport-minutes', 'ninety');
    expect(screen.getByTestId('sport-error-typicalSessionMinutes').props.children).toMatch(/usual length in minutes/);
    type('sport-minutes', '');
    type('sport-competition', '2099-03-01');
    expect(nextDisabled()).toBe(false);
  });

  test('a complete sport answer is saved with the rest of the interview, in one go', async () => {
    openSportSlide();
    press('sport-family-football');
    press('sport-football_association');
    press('sport-outcome-stay_available');
    press('sport-experience-2_to_5_years');
    pressLabel('Increase PRACTICE SESSIONS A WEEK');
    pressLabel('Increase PRACTICE SESSIONS A WEEK');
    pressLabel('Increase MATCHES OR COMPETITIONS A WEEK');
    type('sport-minutes', '90');
    expect(nextDisabled()).toBe(false);
    next();
    walkToReview();
    expect(stepLabel()).toBe('Step 9 of 9');
    expect(screen.getByText('Football (soccer) — keep training and playing without long breaks')).toBeTruthy();
    await startTraining();
    expect(state().error).toBeNull();
    expect(state().onboarded).toBe(true);
    expect(state().sport).toMatchObject({
      sportId: 'football_association', outcomeId: 'stay_available', experienceId: '2_to_5_years',
      practiceSessionsPerWeek: 2, matchesPerWeek: 1, typicalSessionMinutes: 90, competitionDate: null,
    });
    expect(state().sportWorkload).toMatchObject({ source: 'stated', sessionsPerWeek: 3, tier: 'high' });
  });

  test('"another sport" is a supported answer in the athlete\'s own words', async () => {
    openSportSlide();
    press('sport-family-other');
    expect(nextDisabled()).toBe(true);
    expect(screen.getByText(/You still get an honest general plan, and your weekly sessions still count/)).toBeTruthy();
    type('sport-other-name', 'Netball');
    press('sport-outcome-general_support');
    press('sport-experience-new');
    expect(screen.getByTestId('sport-emphasis-summary').props.children)
      .toBe('No extra emphasis. The plan is general strength alongside your Netball.');
    next();
    walkToReview();
    expect(screen.getByText('Netball — general strength for my sport')).toBeTruthy();
    await startTraining();
    expect(state().sport).toMatchObject({ sportId: 'other', otherSportName: 'Netball', practiceSessionsPerWeek: null, matchesPerWeek: null });
  });

  test('"Skip this" drops a half-answered sport and plans general gym training', async () => {
    openSportSlide();
    press('sport-family-football');
    expect(nextDisabled()).toBe(true);
    press('onboarding-skip-sport');
    expect(screen.queryByTestId('sport-editor')).toBeNull();
    expect(screen.getByText('HOW LONG HAVE YOU BEEN TRAINING?')).toBeTruthy();
    expect(stepLabel()).toBe('Step 4 of 8');
    walkToReview();
    expect(screen.queryByText('SPORT')).toBeNull();
    await startTraining();
    expect(state().onboarded).toBe(true);
    expect(state().sport).toBeNull();
    expect(count('athlete_sport_profile')).toBe(0);
  });

  test('sport and target together: ten screens, sport first, and a goal can name its exercise', async () => {
    render(<OnboardingScreen />);
    next();
    next();
    press('onboarding-wants-sport');
    press('onboarding-wants-target');
    expect(stepLabel()).toBe('Step 3 of 10');
    next();
    press('sport-family-basketball');
    press('sport-outcome-general_support');
    press('sport-experience-new');
    next();
    expect(screen.getByTestId('goal-editor')).toBeTruthy();
    expect(stepLabel()).toBe('Step 5 of 10');
    type('goal-outcome', 'Goblet squat 40 kg for 10');
    type('goal-method', 'Goblet squat, 10 reps to parallel');
    type('goal-baseline', '24');
    type('goal-target', '40');
    type('goal-reason', 'Stronger legs for basketball');
    // The exercise question is asked because this goal is measured on an exercise.
    expect(screen.getByTestId('goal-exercise')).toBeTruthy();
    type('goal-exercise-search', 'g');
    expect(screen.queryByTestId('goal-exercise-none')).toBeNull();
    type('goal-exercise-search', 'zzzz');
    expect(screen.getByTestId('goal-exercise-none')).toBeTruthy();
    type('goal-exercise-search', 'goblet');
    const gobletId = Number(raw().prepare("SELECT movement_id FROM movement WHERE name = 'Goblet Squat'").get().movement_id);
    press(`goal-exercise-option-${gobletId}`);
    expect(screen.getByTestId('goal-exercise-linked').props.children).toBe('Linked exercise: Goblet Squat');
    // A body-weight goal has no exercise to name.
    press('goal-metric-bodyweight_kg');
    expect(screen.queryByTestId('goal-exercise')).toBeNull();
    press('goal-metric-load_kg');
    expect(screen.getByTestId('goal-exercise-linked')).toBeTruthy();
    next();
    walkToReview();
    await startTraining();
    expect(state().error).toBeNull();
    expect(state().sport).toMatchObject({ sportId: 'basketball' });
    expect(state().goals).toHaveLength(1);
    expect(state().goalMovements).toEqual({ [state().goals[0].goalId]: gobletId });
  });
});

describe('the plan explains itself', () => {
  const PROFILE = {
    objective: 'hypertrophy', training_age: 'intermediate', weekly_frequency: 4, session_duration_cap_min: 60,
    equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'cable_machine', 'kettlebell', 'pullup_bar', 'bands'],
  };

  test('the program preview says the plan is standard when nothing is set', () => {
    state().saveProfile(PROFILE);
    render(<ProgramSetupScreen onCancel={() => undefined} />);
    expect(screen.getByTestId('program-emphasis-empty').props.children)
      .toBe('No focus, sport or goal exercise is set, so this is the standard plan for your objective. You can set them in Athlete Profile; they are used when the next block is created.');
  });

  test('the program preview shows what focus and sport change, and what they cannot, before the plan is created', () => {
    state().saveProfile(PROFILE);
    expect(state().saveFocus({ bundleId: 'beach_muscles', muscles: ['biceps', 'triceps', 'upper_chest'] })).toBe(true);
    expect(state().saveSport({
      sportId: 'basketball', otherSportName: null, outcomeId: 'jump_higher', experienceId: 'new',
      practiceSessionsPerWeek: 3, matchesPerWeek: 0, typicalSessionMinutes: null, competitionDate: null,
    })).toBe(true);
    render(<ProgramSetupScreen onCancel={() => undefined} />);
    const applied = textsOf('program-emphasis-applied');
    const omitted = textsOf('program-emphasis-omitted');
    expect(applied[0]).toBe('Focus — Beach muscles: upper chest, biceps, triceps.');
    expect(applied.join(' ')).toMatch(/is planned instead of .+: it trains upper chest directly \(your focus\)\./);
    expect(applied.join(' ')).toMatch(/Basketball — jump higher: Extra leg-strength work/);
    expect(applied.join(' ')).toMatch(/Sport workload: 3 practice sessions and 0 matches a week, as you told the app\. To leave room for it, each accessory exercise has one fewer set\./);
    expect(omitted.join(' ')).toMatch(/no jump or plyometric drills yet/);
    expect(screen.getByText('Safety, your equipment, your experience level and your session length always come first.')).toBeTruthy();
    // Nothing has been created by looking.
    expect(count('training_block')).toBe(0);
    expect(count('block_emphasis')).toBe(0);
  });

  test('the explanation card renders the generator\'s own lines and nothing else', () => {
    const report = { version: 1, applied: ['One thing changed.'], omitted: ['One thing could not.'] };
    const view = render(<EmphasisReportCard report={report} />);
    expect(textsOf('emphasis-report-applied')).toEqual(['One thing changed.']);
    expect(textsOf('emphasis-report-omitted')).toEqual(['One thing could not.']);
    view.rerender(<EmphasisReportCard report={{ version: 1, applied: [], omitted: [] }} />);
    expect(screen.getByTestId('emphasis-report-nothing-applied')).toBeTruthy();
    expect(screen.queryByText('What they could not change, and why')).toBeNull();
    view.rerender(<EmphasisReportCard report={null} />);
    expect(screen.queryByTestId('emphasis-report')).toBeNull();
  });
});

describe('the profile sport panel', () => {
  test('adds, changes and removes the sport without touching the plan, and shows the workload the next block will use', () => {
    state().saveProfile({ training_age: 'intermediate', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'] });
    expect(state().createTrainingProgram({ horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] })).toBe(true);
    const plan = () => JSON.stringify([raw().prepare('SELECT * FROM planned_slot ORDER BY 1').all(), raw().prepare('SELECT * FROM block_emphasis').all()]);
    const before = plan();
    render(<SportPanel />);
    expect(screen.getByTestId('profile-sport-summary').props.children).toBe('No sport set. The plan is general gym training.');
    expect(screen.getByTestId('profile-sport-workload').props.children).toMatch(/^Sport workload: no sport sessions recorded\./);
    press('profile-sport-edit');
    expect(screen.getByText('Do you play or compete in a sport?')).toBeTruthy();
    // Saving an unfinished answer explains what is missing instead of saving.
    press('profile-sport-save');
    expect(screen.getByTestId('sport-error-sportId')).toBeTruthy();
    expect(state().sport).toBeNull();
    press('sport-family-hockey');
    press('sport-hockey_ice');
    press('sport-outcome-stay_available');
    press('sport-experience-over_5_years');
    for (let n = 0; n < 4; n += 1) pressLabel('Increase PRACTICE SESSIONS A WEEK');
    pressLabel('Increase MATCHES OR COMPETITIONS A WEEK');
    press('profile-sport-save');
    expect(screen.getByTestId('sport-panel-message').props.children)
      .toBe('Sport saved. Your current plan is unchanged; this is used when your next block is created.');
    expect(screen.getByTestId('profile-sport-summary').props.children)
      .toBe('Ice hockey — keep training and playing without long breaks. Played: more than 5 years.');
    expect(screen.getByTestId('profile-sport-workload').props.children)
      .toMatch(/^Sport workload: 4 practice sessions and 1 match a week, as you told the app\. That is a very full week/);
    expect(plan()).toBe(before);

    press('profile-sport-remove');
    expect(screen.getByTestId('sport-panel-message').props.children)
      .toBe('Sport removed. Your current plan is unchanged; this is used when your next block is created.');
    expect(state().sport).toBeNull();
    expect(count('athlete_sport_profile')).toBe(0);
    expect(plan()).toBe(before);
  });

  test('the goals panel links a goal to an exercise and shows the link', () => {
    render(<FocusGoalsPanel />);
    press('profile-goal-add');
    type('goal-outcome', 'Row 60 kg for 8');
    type('goal-method', 'Barbell row, 8 strict reps');
    type('goal-baseline', '45');
    type('goal-target', '60');
    type('goal-reason', 'A stronger back');
    type('goal-exercise-search', 'barbell row');
    const rowId = Number(raw().prepare("SELECT movement_id FROM movement WHERE name = 'Barbell Row'").get().movement_id);
    press(`goal-exercise-option-${rowId}`);
    press('profile-goal-save');
    const { goalId } = state().goals[0];
    expect(state().goalMovements).toEqual({ [goalId]: rowId });
    expect(screen.getByTestId(`profile-goal-exercise-${goalId}`).props.children).toBe('Exercise: Barbell Row');
    // Editing shows the link and lets the athlete remove it; the goal itself is kept.
    press(`profile-goal-edit-${goalId}`);
    expect(screen.getByTestId('goal-exercise-linked').props.children).toBe('Linked exercise: Barbell Row');
    press('goal-exercise-remove');
    press('profile-goal-save');
    expect(state().goalMovements).toEqual({});
    expect(screen.queryByTestId(`profile-goal-exercise-${goalId}`)).toBeNull();
    expect(state().goals).toHaveLength(1);
  });
});
