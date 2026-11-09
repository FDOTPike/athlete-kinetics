/**
 * PriorExperienceDeclarations.test.js — #217 and #204, with the REAL store
 * behind the screens (production boot path and migration chain; node:sqlite
 * stands in for the op-sqlite handle only).
 *
 *   - training age alone clears no capability gate: an intermediate who
 *     declares nothing gets no competition lift and no beginner basics;
 *   - onboarding asks "Have you trained these before?" for the three
 *     competition lifts and one declaration for the beginner basics, for any
 *     goal, and writes the same movement_prior_experience rows the Library's
 *     chip writes: the two unlock exactly the same movements;
 *   - nothing is offered where nothing can be declared (a beginner, or no
 *     barbell), and the build page's section hides then too;
 *   - the strength title names what the program is.
 */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import OnboardingScreen from '../../src/screens/OnboardingScreen';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';
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
jest.setTimeout(120_000);

const A = 'athlete_kinetics.db';
const state = () => useStore.getState();
const settle = async () => { for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); }); };
const press = (testID) => act(() => { fireEvent.press(screen.getByTestId(testID)); });
const pressLabel = (label) => act(() => { fireEvent.press(screen.getByLabelText(label)); });
const next = () => pressLabel('Next');
const FULL_GYM = ['barbell', 'squat_rack', 'bench', 'dumbbells', 'kettlebell', 'pullup_bar', 'bands', 'cable_machine', 'mats'];

const bootFresh = async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDrivers = new Map();
  mockRegistry = { version: 1, activeId: 'default', advancedToolsUnlocked: false, athletes: [
    { id: 'default', name: 'Athlete 1', dbName: A, createdAtMs: 0 },
  ] };
  useStore.setState({
    status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null,
    focus: null, goals: [], sport: null, goalMovements: {}, blockEmphasis: null,
    block: null, program: null, todayPlan: null, activePriorExperienceMovementIds: [],
  });
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
};

beforeEach(async () => {
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  await bootFresh();
});

afterEach(async () => {
  await settle();
  jest.restoreAllMocks();
});

const idOf = (name) => state().movements.find((m) => m.name === name).movement_id;
const ANCHORS = ['Competition Squat', 'Competition Bench', 'Deadlift'];
const sorted = (ids) => [...ids].sort((a, b) => a - b);
const availableIds = () => sorted(state().getMovementAvailabilityVerdicts('weight_room')
  .filter((v) => v.state === 'available').map((v) => v.movementId));
const verdictOf = (id) => state().getMovementAvailabilityVerdicts('weight_room').find((v) => v.movementId === id);

/** welcome -> goal (chosen) -> focus -> experience (chosen) -> (optional maxes) -> logistics -> equipment (chosen). */
const walkToEquipment = (goalLabel, ageLabel, presetLabel) => {
  render(<OnboardingScreen />);
  next();
  pressLabel(goalLabel);
  next();
  next();
  pressLabel(ageLabel);
  next();
  if (screen.queryByTestId('onboarding-maxes-step') !== null) next();
  next();
  pressLabel(presetLabel);
};
const finishFromEquipment = async () => {
  next();
  pressLabel('No, nothing to note');
  next();
  await act(async () => { fireEvent.press(screen.getByLabelText('START TRAINING')); await settle(); });
  expect(state().error).toBeNull();
  expect(state().onboarded).toBe(true);
};

describe('training age alone clears no gate (SC-08, D02)', () => {
  test('an intermediate with a full gym who declares nothing has no competition lift and no beginner basics', async () => {
    walkToEquipment(/^GET STRONGER\./, /^SOME MILEAGE\./, /^FULL GYM\./);
    expect(screen.getByTestId('onboarding-prior-experience')).toBeTruthy();
    await finishFromEquipment();
    expect(state().profile.training_age).toBe('intermediate');
    expect(state().activePriorExperienceMovementIds).toEqual([]);
    for (const name of ANCHORS) {
      expect(verdictOf(idOf(name))).toMatchObject({ state: 'teaching_only', reasons: ['capability'], confirmationWouldClear: true });
    }
    expect(verdictOf(idOf('Plank'))).toMatchObject({ state: 'teaching_only', reasons: ['capability'] });
  });

  test('a beginner is offered nothing to declare: the weight-room gate takes no declaration at that tier', () => {
    walkToEquipment(/^GET STRONGER\./, /^NEW TO THIS\./, /^FULL GYM\./);
    expect(screen.queryByTestId('onboarding-prior-experience')).toBeNull();
    const options = state().previewPriorExperienceDeclarations({ ...state().profile, training_age: 'beginner', equipment_inventory: FULL_GYM });
    expect(options.anchors).toEqual([]);
    expect(options.basicMovementIds).toEqual([]);
  });
});

describe('onboarding declarations (#217)', () => {
  test('offered for every goal, in plain words, with the competition squat named as a back squat', () => {
    walkToEquipment(/^BUILD MUSCLE\./, /^SOME MILEAGE\./, /^FULL GYM\./);
    expect(screen.getByText('HAVE YOU TRAINED THESE BEFORE? (OPTIONAL)')).toBeTruthy();
    expect(screen.getByLabelText('I have trained Back squat (competition squat) before')).toBeTruthy();
    expect(screen.getByLabelText('I have trained Bench press (competition bench) before')).toBeTruthy();
    expect(screen.getByLabelText('I have trained Deadlift before')).toBeTruthy();
    expect(screen.getByLabelText('I have done planks, carries and bodyweight basics before')).toBeTruthy();
  });

  test('no barbell: the competition lifts are not offered', () => {
    walkToEquipment(/^GET STRONGER\./, /^SOME MILEAGE\./, /^HOME BASIC\./);
    expect(screen.queryByLabelText('I have trained Back squat (competition squat) before')).toBeNull();
    expect(screen.queryByLabelText('I have trained Deadlift before')).toBeNull();
  });

  test('the onboarding declaration unlocks exactly what the Library chip unlocks', async () => {
    // Athlete 1: declares in onboarding.
    walkToEquipment(/^GET STRONGER\./, /^SOME MILEAGE\./, /^FULL GYM\./);
    for (const label of ['Back squat (competition squat)', 'Bench press (competition bench)', 'Deadlift']) {
      pressLabel(`I have trained ${label} before`);
    }
    pressLabel('I have done planks, carries and bodyweight basics before');
    await finishFromEquipment();
    const declaredInOnboarding = sorted(state().activePriorExperienceMovementIds);
    const availableAfterOnboarding = availableIds();
    for (const name of [...ANCHORS, 'Plank']) expect(declaredInOnboarding).toContain(idOf(name));
    screen.unmount();

    // Athlete 2: the same answers, nothing declared in onboarding; then the
    // Library's chip (confirmMovementPriorExperience) for the same movements.
    await bootFresh();
    walkToEquipment(/^GET STRONGER\./, /^SOME MILEAGE\./, /^FULL GYM\./);
    await finishFromEquipment();
    expect(availableIds()).not.toEqual(availableAfterOnboarding);
    for (const id of declaredInOnboarding) {
      expect(state().confirmMovementPriorExperience(id, 'weight_room')).toBe(true);
    }
    expect(sorted(state().activePriorExperienceMovementIds)).toEqual(declaredInOnboarding);
    expect(availableIds()).toEqual(availableAfterOnboarding);
  });
});

describe('the build page section and title (#204, #217)', () => {
  const setUp = (patch) => {
    state().saveProfile({ training_age: 'intermediate', objective: 'strength', equipment_inventory: FULL_GYM, ...patch });
  };

  test('no barbell: no "Big-lift availability" section, and the strength title says what the program is', () => {
    setUp({ equipment_inventory: ['dumbbells', 'kettlebell', 'pullup_bar', 'bands', 'mats'] });
    render(<ProgramSetupScreen />);
    expect(screen.queryByTestId('anchor-coverage-card')).toBeNull();
    expect(screen.getByText('Strength foundations')).toBeTruthy();
  });

  test('a beginner with a full gym: nothing to declare, so no section', () => {
    setUp({ training_age: 'beginner' });
    render(<ProgramSetupScreen />);
    expect(screen.queryByTestId('anchor-coverage-card')).toBeNull();
    expect(screen.getByText('Strength foundations')).toBeTruthy();
  });

  test('an intermediate with a full gym, on any goal, can declare in plain words; the title follows', () => {
    setUp({ objective: 'hypertrophy' });
    const { unmount } = render(<ProgramSetupScreen />);
    expect(screen.getByTestId('anchor-coverage-card')).toBeTruthy();
    unmount();

    setUp({});
    render(<ProgramSetupScreen />);
    expect(screen.getByText('Strength foundations')).toBeTruthy();
    expect(screen.getByText('Back squat (competition squat): not in your plan yet. Tap below if you have trained it before.')).toBeTruthy();
    expect(within(screen.getByTestId('anchor-coverage-card')).queryByText(/blocked|capability/)).toBeNull();
    press(`anchor-confirm-${idOf('Competition Squat')}`);
    expect(verdictOf(idOf('Competition Squat')).state).toBe('available');
    expect(screen.getByText('Big-lift strength')).toBeTruthy();
  });
});
