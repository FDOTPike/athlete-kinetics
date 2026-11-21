import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { NavigationProvider } from '../../src/navigation/navigation';
import OnboardingScreen from '../../src/screens/OnboardingScreen';
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
    advancedToolsUnlocked: false,
    athletes: [{ id: 'default', name: 'Athlete 1', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
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

describe('Skipping onboarding to load the demo athlete computes today prescription alongside state vector', () => {
  test('pressing "Skip the questionnaire and load the demo athlete" computes today prescription alongside state vector', async () => {
    expect(useStore.getState().onboarded).toBe(false);
    expect(useStore.getState().vector).toBeNull();
    expect(useStore.getState().prescription).toBeNull();

    render(
      <NavigationProvider initialTab="today">
        <OnboardingScreen />
      </NavigationProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Skip the questionnaire and load the demo athlete'));
      await settle();
    });

    const state = useStore.getState();
    expect(state.onboarded).toBe(true);
    expect(state.vector).not.toBeNull();
    expect(state.vector.date).toBe(state.today);
    expect(state.prescription).not.toBeNull();
    expect(state.prescription.forDate).toBe(state.today);
  });
});
