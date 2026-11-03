import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

// Android walk 2026-11-03 (W1-4): an athlete who chose 15- or 30-minute
// sessions in onboarding reached BUILD YOUR PROGRAM with "Create program"
// disabled and no way to change the session length there. The plan's own
// verified offers are now choices that redraw the plan; nothing is saved
// until Create program.

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

const settle = async () => {
  for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); });
};

const SHORT_CAP = 15;

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDrivers = new Map();
  mockRegistry = {
    version: 1,
    activeId: 'default',
    advancedToolsUnlocked: false,
    athletes: [{ id: 'default', name: 'Athlete 1', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
  };
  useStore.setState({
    status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null,
    focus: null, goals: [], block: null, program: null, todayPlan: null,
  });
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
  act(() => {
    useStore.getState().saveProfile({ objective: 'gpp', weekly_frequency: 3, session_duration_cap_min: SHORT_CAP });
  });
  expect(useStore.getState().profile.session_duration_cap_min).toBe(SHORT_CAP);
});

const createDisabled = () => screen.getByLabelText('Create program').props.accessibilityState?.disabled === true;

describe('ProgramSetupScreen: a session that does not fit offers choices', () => {
  test('choosing a longer session redraws the plan, and Create program saves that length', () => {
    const onComplete = jest.fn();
    render(<ProgramSetupScreen onComplete={onComplete} />);
    expect(screen.getAllByTestId('session-time-conflict').length).toBeGreaterThan(0);
    expect(createDisabled()).toBe(true);

    const longer = screen.getByText(/^Use \d+-minute sessions$/);
    const chosen = Number(/Use (\d+)-minute/.exec(longer.props.children)[1]);
    expect(chosen).toBeGreaterThan(SHORT_CAP);
    fireEvent.press(longer);

    // The redrawn plan fits, and the profile is still the athlete's own.
    expect(screen.queryAllByTestId('session-time-conflict')).toHaveLength(0);
    expect(screen.getByTestId('session-time-summary').props.children).toContain(`your ${chosen}-minute limit`);
    expect(screen.getByTestId('session-time-draft')).toBeOnTheScreen();
    expect(useStore.getState().profile.session_duration_cap_min).toBe(SHORT_CAP);
    expect(createDisabled()).toBe(false);

    fireEvent.press(screen.getByLabelText('Create program'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(useStore.getState().program).not.toBeNull();
    expect(useStore.getState().profile.session_duration_cap_min).toBe(chosen);
  });

  test('Cancel after choosing leaves the profile and the plan untouched', () => {
    const onCancel = jest.fn();
    render(<ProgramSetupScreen onCancel={onCancel} />);
    fireEvent.press(screen.getByText(/^Use \d+-minute sessions$/));
    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(useStore.getState().profile.session_duration_cap_min).toBe(SHORT_CAP);
    expect(useStore.getState().program).toBeNull();
  });

  test('"Back to" returns to the profile length, and creation stays blocked while it does not fit', () => {
    render(<ProgramSetupScreen />);
    fireEvent.press(screen.getByText(/^Use \d+-minute sessions$/));
    expect(createDisabled()).toBe(false);
    fireEvent.press(screen.getByText(`Back to ${SHORT_CAP} minutes`));
    expect(screen.queryByTestId('session-time-draft')).toBeNull();
    expect(screen.getAllByTestId('session-time-conflict').length).toBeGreaterThan(0);
    expect(createDisabled()).toBe(true);
  });

  test('a fewer-days offer, when made, takes that many days and fits', () => {
    act(() => { useStore.getState().saveProfile({ weekly_frequency: 7 }); });
    render(<ProgramSetupScreen />);
    const fewer = screen.queryByText(/^Train \d+ days? a week at \d+ minutes$/);
    expect(fewer).not.toBeNull();
    const [, days, minutes] = /Train (\d+) days? a week at (\d+) minutes/.exec(fewer.props.children).map(Number);
    expect(days).toBeLessThan(7);
    fireEvent.press(fewer);
    expect(screen.queryAllByTestId('session-time-conflict')).toHaveLength(0);
    expect(screen.getByTestId('session-time-summary').props.children).toContain(`your ${minutes}-minute limit`);
    expect(createDisabled()).toBe(false);
    fireEvent.press(screen.getByLabelText('Create program'));
    expect(useStore.getState().program?.days.length).toBe(days);
    expect(useStore.getState().profile.session_duration_cap_min).toBe(minutes);
  });
});
