/**
 * Issue #152 (Android walk W7-1), onboarding NEXT:
 *   two presses of NEXT sent together (before the screen re-renders) advanced
 *   two steps, so the focus step was skipped. Each press must move at most one
 *   step from the screen the athlete is looking at.
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

// The real store boots through the full migration chain; first render is slow.
jest.setTimeout(60_000);

const A = 'athlete_kinetics.db';
const state = () => useStore.getState();
const settle = async () => { for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); }); };
const pressLabel = (label) => act(() => { fireEvent.press(screen.getByLabelText(label)); });
const stepLabel = () => screen.getByLabelText(/^Step \d+ of \d+$/).props.accessibilityLabel;

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

test('two NEXT presses sent together advance one step, not two', () => {
  render(<OnboardingScreen />);
  pressLabel('Next'); // welcome -> goal
  expect(stepLabel()).toBe('Step 2 of 8');
  pressLabel('GET STRONGER. Lift heavier on the big lifts');

  // Both presses arrive before the screen re-renders: one act, two presses.
  act(() => {
    fireEvent.press(screen.getByLabelText('Next'));
    fireEvent.press(screen.getByLabelText('Next'));
  });

  // The focus step (Step 3 of 8) is shown; the experience step is not skipped to.
  expect(stepLabel()).toBe('Step 3 of 8');
  expect(screen.queryByText('HOW LONG HAVE YOU BEEN TRAINING?')).toBeNull();
});
