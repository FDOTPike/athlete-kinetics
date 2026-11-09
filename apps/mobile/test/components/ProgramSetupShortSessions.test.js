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

  // Review (PR 194): the chosen length and the new program are one commit. A
  // stop between two separate commits used to leave a changed length with no
  // program; the length's write now sits inside the program's transaction.
  test('the chosen length is written in the same transaction as the program', () => {
    const driver = mockDrivers.get('athlete_kinetics.db');
    const original = driver.executeSync;
    const statements = [];
    driver.executeSync = (sql, params) => { statements.push(String(sql).trim().replace(/\s+/g, ' ')); return original.call(driver, sql, params); };
    try {
      render(<ProgramSetupScreen />);
      fireEvent.press(screen.getByText(/^Use \d+-minute sessions$/));
      fireEvent.press(screen.getByLabelText('Create program'));
    } finally {
      driver.executeSync = original;
    }
    expect(useStore.getState().program).not.toBeNull();
    const capWrites = statements.map((sql, i) => [sql, i]).filter(([sql]) => /^UPDATE athlete_profile SET/.test(sql) && /session_duration_cap_min/.test(sql));
    expect(capWrites).toHaveLength(1);
    const at = capWrites[0][1];
    const begin = statements.slice(0, at).lastIndexOf('BEGIN');
    const commit = statements.indexOf('COMMIT', at);
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(statements.slice(begin + 1, at).includes('COMMIT')).toBe(false);
    const inTransaction = statements.slice(begin, commit);
    expect(inTransaction.some((sql) => /^INSERT INTO training_program\b/.test(sql))).toBe(true);
    expect(inTransaction.some((sql) => /^INSERT INTO training_block\b/.test(sql))).toBe(true);
  });

  test('a failure inside that transaction saves neither the length nor the program', () => {
    const driver = mockDrivers.get('athlete_kinetics.db');
    const original = driver.executeSync;
    driver.executeSync = (sql, params) => {
      if (/^\s*INSERT INTO training_block\b/.test(String(sql))) throw new Error('synthetic failure inside the block transaction');
      return original.call(driver, sql, params);
    };
    try {
      render(<ProgramSetupScreen />);
      fireEvent.press(screen.getByText(/^Use \d+-minute sessions$/));
      fireEvent.press(screen.getByLabelText('Create program'));
    } finally {
      driver.executeSync = original;
    }
    expect(useStore.getState().program).toBeNull();
    expect(useStore.getState().profile.session_duration_cap_min).toBe(SHORT_CAP);
    const stored = driver.executeSync('SELECT session_duration_cap_min AS cap FROM athlete_profile WHERE profile_id = 1');
    const rows = stored.rows?._array ?? stored.rows ?? [];
    expect(Number(rows[0].cap)).toBe(SHORT_CAP);
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

  // Walk 1 (W1-15): the header showed internal goal codes ("Goal: hypertrophy",
  // "gpp", "hybrid"). The title names the goal in the athlete's words.
  test.each(['hypertrophy', 'gpp', 'hybrid', 'weight_loss'])('the %s header shows no internal goal code', (objective) => {
    act(() => { useStore.getState().saveProfile({ objective, session_duration_cap_min: 90 }); });
    render(<ProgramSetupScreen />);
    expect(screen.queryByText(new RegExp(`Goal: ${objective.replace('_', ' ')}`))).toBeNull();
    expect(screen.queryByText(/^Goal: /)).toBeNull();
    expect(screen.getByText(/Four-week blocks stay intact/)).toBeOnTheScreen();
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

// Issue #209: beginner sessions stay short and the build screen says so, with
// the expected lifting time. Session size itself is unchanged.
describe('ProgramSetupScreen: a beginner is told the session is short on purpose', () => {
  test('a beginner sees the expected lifting time; an intermediate does not', () => {
    act(() => {
      useStore.getState().saveProfile({ training_age: 'beginner', session_duration_cap_min: 60 });
    });
    const view = render(<ProgramSetupScreen onComplete={jest.fn()} />);
    const line = screen.getByTestId('session-time-beginner').props.children;
    expect(line).toMatch(/^Beginner sessions are kept short on purpose: about \d+ minutes of lifting, plus \d+ minutes of preparation\.$/);
    const lifting = Number(line.match(/about (\d+) minutes of lifting/)[1]);
    expect(lifting).toBeGreaterThan(0);
    expect(lifting).toBeLessThanOrEqual(60);
    view.unmount();
    act(() => {
      useStore.getState().saveProfile({ training_age: 'intermediate', session_duration_cap_min: 60 });
    });
    render(<ProgramSetupScreen onComplete={jest.fn()} />);
    expect(screen.queryByTestId('session-time-beginner')).toBeNull();
  });
});
