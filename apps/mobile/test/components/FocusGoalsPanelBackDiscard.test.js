/**
 * Issue #139, Profile goal form: Android Back on an open goal form asks before
 * a changed, unsaved draft is discarded. An unchanged form closes at once.
 * Real store behind the panel, as in OnboardingFocusGoal.test.js.
 */
import React from 'react';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { FocusGoalsPanel } from '../../src/components/FocusGoalsPanel';
import { NavigationProvider } from '../../src/navigation/navigation';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDrivers;
let mockRegistry;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) mockDrivers.set(name, { ...makeNodeSqliteDriver(), close: jest.fn() });
  return mockDrivers.get(name);
}
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
const type = (testID, text) => act(() => { fireEvent.changeText(screen.getByTestId(testID), text); });
const queryTestId = (testID) => screen.queryByTestId(testID);

/** Press Android Back the way the app receives it: newest listener first. */
function captureHardwareBack() {
  const listeners = [];
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((eventName, listener) => {
    if (eventName === 'hardwareBackPress') listeners.push(listener);
    return { remove: () => { const index = listeners.indexOf(listener); if (index >= 0) listeners.splice(index, 1); } };
  });
  return {
    press: () => {
      let handled = false;
      act(() => {
        for (let index = listeners.length - 1; index >= 0 && !handled; index -= 1) handled = listeners[index]() === true;
      });
      return handled;
    },
    restore: () => spy.mockRestore(),
  };
}

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

const openNewGoalAndFill = () => {
  press('profile-goal-add');
  type('goal-outcome', 'Squat 100 kg for 5 reps');
  type('goal-method', 'Back squat, 5 reps to parallel');
  type('goal-baseline', '80');
  type('goal-target', '100');
  type('goal-reason', 'To be stronger for football');
};

describe('Android Back on the Profile goal form', () => {
  test('a changed, unsaved goal asks before it is discarded, and Keep editing keeps it', () => {
    const back = captureHardwareBack();
    render(<NavigationProvider initialTab="athlete"><FocusGoalsPanel /></NavigationProvider>);
    openNewGoalAndFill();

    expect(back.press()).toBe(true);
    expect(queryTestId('profile-goal-discard-prompt')).toBeTruthy();
    expect(queryTestId('profile-goal-editor')).toBeTruthy();
    expect(state().goals).toEqual([]);

    press('profile-goal-keep-editing');
    expect(queryTestId('profile-goal-discard-prompt')).toBeNull();
    expect(queryTestId('profile-goal-editor')).toBeTruthy();
    back.restore();
  });

  test('Discard changes closes the form without saving anything', () => {
    const back = captureHardwareBack();
    render(<NavigationProvider initialTab="athlete"><FocusGoalsPanel /></NavigationProvider>);
    openNewGoalAndFill();

    back.press();
    press('profile-goal-discard');
    expect(queryTestId('profile-goal-editor')).toBeNull();
    expect(state().goals).toEqual([]);
    back.restore();
  });

  test('an unchanged goal form closes at once, with no prompt', () => {
    const back = captureHardwareBack();
    render(<NavigationProvider initialTab="athlete"><FocusGoalsPanel /></NavigationProvider>);
    press('profile-goal-add');

    expect(back.press()).toBe(true);
    expect(queryTestId('profile-goal-discard-prompt')).toBeNull();
    expect(queryTestId('profile-goal-editor')).toBeNull();
    back.restore();
  });
});
