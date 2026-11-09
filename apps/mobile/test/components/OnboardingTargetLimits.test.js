/**
 * Issue #139, onboarding YOUR TARGET step (walk W1-8):
 *   - a target of 0 is refused, and so is a number above the app's 500 kg limit;
 *   - a lift target below where the athlete is now needs an explicit confirm
 *     before NEXT opens.
 * Real store behind the screen, as in OnboardingTargetGate.test.js.
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
const gateText = () => screen.queryByTestId('onboarding-target-gate-missing')?.props.children ?? null;

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

/** welcome -> goal -> focus (asking for a target) -> target, with the lift filled but the target. */
const openTargetStepWith = (targetText) => {
  render(<OnboardingScreen />);
  next();
  next();
  press('onboarding-wants-target');
  next();
  type('goal-outcome', 'Squat 100 kg for 5 reps');
  type('goal-method', 'Back squat, 5 reps to parallel');
  type('goal-baseline', '120');
  type('goal-target', targetText);
  type('goal-reason', 'To be stronger for football');
};

test('a target of 0 is refused with the reason, and NEXT stays shut', () => {
  openTargetStepWith('0');
  expect(nextDisabled()).toBe(true);
  expect(gateText()).toBe('Enter a target above 0.');
});

test('a target above the 500 kg limit is refused and names the range', () => {
  openTargetStepWith('99999');
  expect(nextDisabled()).toBe(true);
  expect(gateText()).toBe('Enter a target from 0 to 500 kg.');
});

test('a lift target below where the athlete is now waits for the confirm, then opens NEXT', () => {
  openTargetStepWith('60');
  expect(nextDisabled()).toBe(true);
  expect(gateText()).toBe('Your target is lower than where you are now. Keep it?');
  press('goal-confirm-lower-target');
  expect(nextDisabled()).toBe(false);
  expect(gateText()).toBeNull();
});
