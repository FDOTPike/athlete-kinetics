import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { NavigationProvider } from '../../src/navigation/navigation';
import ProfileScreen from '../../src/screens/ProfileScreen';
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

const settle = async () => {
  for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); });
};

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDrivers = new Map();
  mockRegistry = {
    version: 1,
    activeId: 'default',
    advancedToolsUnlocked: true,
    athletes: [
      { id: 'default', name: 'Alice', dbName: 'athlete_kinetics.db', createdAtMs: 0 },
      { id: 'athlete-b', name: 'Bob', dbName: 'athlete_b.db', createdAtMs: 1 },
    ],
  };
  useStore.setState({
    status: 'booting',
    error: null,
    activeAthleteId: 'default',
    session: null,
    runner: null,
    focus: null,
    goals: [],
    block: null,
    program: null,
    todayPlan: null,
  });
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
});

describe('ProfileScreen disarms destructive confirmations across Coach Mode athlete switches', () => {
  test('switching athletes in Coach Mode resets armed "Confirm delete current block & state" and "Confirm switch to Secondary" confirmations', async () => {
    render(
      <NavigationProvider initialTab="athlete">
        <ProfileScreen />
      </NavigationProvider>,
    );

    // On Athlete A (Alice), arm "Delete the current block and today's state"
    fireEvent.press(screen.getByLabelText("Delete the current block and today's state"));
    expect(screen.getByLabelText('Confirm delete current block & state')).toBeOnTheScreen();

    // Also arm profile slot switch to Advanced on Athlete A
    fireEvent.press(screen.getByLabelText('Advanced profile'));
    expect(screen.getByLabelText('Confirm switch to Advanced')).toBeOnTheScreen();

    // Switch to Athlete B (Bob) via the real Coach Mode switchAthlete action
    await act(async () => {
      await useStore.getState().switchAthlete('athlete-b');
      await settle();
    });
    expect(useStore.getState().activeAthleteId).toBe('athlete-b');

    // Athlete B's profile is now rendered, and must NOT have destructive confirmations pre-armed from Athlete A
    expect({
      confirmWipeArmedOnBob: screen.queryByLabelText('Confirm delete current block & state') !== null,
      confirmSwitchSlotArmedOnBob: screen.queryByLabelText('Confirm switch to Advanced') !== null,
    }).toEqual({
      confirmWipeArmedOnBob: false,
      confirmSwitchSlotArmedOnBob: false,
    });
  });
});
