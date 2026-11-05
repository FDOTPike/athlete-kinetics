/**
 * Issue #215 (Android walk I, finding I-16), onboarding step YOUR TARGET:
 *   - NEXT stayed grey with only a generic notice; the missing field was the
 *     reason, which was not marked as required. The gate notice now names the
 *     first missing field in the validator's own words.
 *   - The summary dropped the starting number ("140 kg", not "from 120 kg to
 *     140 kg").
 *   - The last step promised "waiting on Today", but program setup comes next.
 * Real store behind the screen, as in OnboardingFocusGoal.test.js.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import OnboardingScreen from '../../src/screens/OnboardingScreen';
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

jest.setTimeout(60_000);

const A = 'athlete_kinetics.db';
const state = () => useStore.getState();
const settle = async () => { for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); }); };
const press = (testID) => act(() => { fireEvent.press(screen.getByTestId(testID)); });
const pressLabel = (label) => act(() => { fireEvent.press(screen.getByLabelText(label)); });
const type = (testID, text) => act(() => { fireEvent.changeText(screen.getByTestId(testID), text); });
const next = () => pressLabel('Next');
const nextDisabled = () => screen.getByLabelText('Next').props.accessibilityState.disabled === true;

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

/** welcome -> goal -> focus (asking for a target) -> target. */
const openTargetStep = () => {
  render(<OnboardingScreen />);
  next();
  next();
  press('onboarding-wants-target');
  next();
  expect(screen.getByTestId('goal-editor')).toBeTruthy();
};
const fillAllButReason = () => {
  type('goal-outcome', 'Squat 140 kg for 1 rep');
  type('goal-method', 'Back squat, 1 rep to parallel');
  type('goal-baseline', '120');
  type('goal-target', '140');
};

test('a target missing only the reason names the reason in the gate notice', () => {
  openTargetStep();
  fillAllButReason();
  expect(nextDisabled()).toBe(true);
  expect(screen.getByTestId('onboarding-target-gate-missing').props.children)
    .toBe('Say why this matters to you. It is what you will read when it gets hard.');
  // The field itself says it is needed.
  expect(screen.getByText('WHY DOES THIS MATTER TO YOU? (REQUIRED)')).toBeTruthy();

  type('goal-reason', 'To be stronger for football');
  expect(nextDisabled()).toBe(false);
  expect(screen.queryByTestId('onboarding-target-gate-missing')).toBeNull();
});

test('the summary shows the starting value and the target, and says what comes next', () => {
  openTargetStep();
  fillAllButReason();
  type('goal-reason', 'To be stronger for football');
  next(); // target -> experience
  next(); // experience -> logistics
  next(); // logistics -> equipment
  next(); // equipment -> limits
  pressLabel('No, nothing to note');
  next(); // limits -> review
  expect(screen.getByLabelText('START TRAINING')).toBeTruthy();
  expect(screen.getByTestId('onboarding-summary-target-row').props.children)
    .toBe('TARGET — Squat 140 kg for 1 rep: from 120 kg to 140 kg, no deadline');
  expect(screen.queryByText(/waiting on Today/)).toBeNull();
  expect(screen.getByText(/Next, check your first week, then start on Today\./)).toBeTruthy();
});
