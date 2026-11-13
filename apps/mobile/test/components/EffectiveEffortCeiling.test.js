/**
 * EffectiveEffortCeiling.test.js — Issue #129 (walk fn-2 / W1).
 *
 * Verifies that:
 * 1. A Return-to-Training (rehab) beginner sees 7.0 on the onboarding review
 *    (both the summary line and the beginner sentence) and on Profile, while
 *    keeping the base setting editable and labelled as the athlete's own upper
 *    setting.
 * 2. An intermediate general-fitness (gpp) athlete sees their own base value in
 *    both places.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { NavigationProvider } from '../../src/navigation/navigation';
import OnboardingScreen from '../../src/screens/OnboardingScreen';
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
const pressLabel = (label) => act(() => { fireEvent.press(screen.getByLabelText(label)); });
const next = () => pressLabel('Next');

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

describe('#129 Effective effort ceiling across Onboarding review and Profile', () => {
  test('a Return-to-Training (rehab) beginner sees 7.0 on onboarding review (summary and beginner line) and on Profile', () => {
    const { unmount } = render(
      <NavigationProvider initialTab="today">
        <OnboardingScreen />
      </NavigationProvider>,
    );

    // welcome -> goal
    next();
    pressLabel(/^RETURN TO TRAINING\./);
    // goal -> focus -> experience
    next();
    next();
    pressLabel(/^NEW TO THIS\./);
    // experience -> logistics -> equipment -> limits -> review
    next();
    next();
    next();
    pressLabel('No, nothing to note');
    next();

    expect(screen.getByText(/Effort ceiling 7\.0/)).toBeOnTheScreen();
    expect(screen.getByText(/Your effort ceiling starts at 7\.0 and can change as your experience grows\./)).toBeOnTheScreen();
    expect(screen.queryByText(/Your effort ceiling starts at 8\.5/)).toBeNull();

    unmount();

    act(() => {
      useStore.getState().saveProfile({
        objective: 'rehab',
        training_age: 'beginner',
        base_rpe_cap: 9.0,
      });
    });

    render(
      <NavigationProvider initialTab="athlete">
        <ProfileScreen />
      </NavigationProvider>,
    );

    const effectiveNode = screen.getByTestId('profile-effective-effort-ceiling');
    expect(effectiveNode).toHaveTextContent(/Effort ceiling 7\.0/);
    expect(effectiveNode).toHaveTextContent(/Your upper setting is 9\.0/);
    expect(effectiveNode).toHaveTextContent(/Return to training caps effort at 7\.0/);
  });

  test('an intermediate general-fitness (gpp) athlete sees their own base value in both places', () => {
    const { unmount } = render(
      <NavigationProvider initialTab="today">
        <OnboardingScreen />
      </NavigationProvider>,
    );

    // welcome -> goal
    next();
    pressLabel(/^ALL-ROUND FITNESS\./);
    // goal -> focus -> experience
    next();
    next();
    pressLabel(/^SOME MILEAGE\./);
    // experience -> maxes -> logistics -> equipment -> limits -> review
    next();
    next();
    next();
    next();
    pressLabel('No, nothing to note');
    next();

    expect(screen.getByText(/Effort ceiling 9\.0/)).toBeOnTheScreen();

    unmount();

    act(() => {
      useStore.getState().saveProfile({
        objective: 'gpp',
        training_age: 'intermediate',
        base_rpe_cap: 8.5,
      });
    });

    render(
      <NavigationProvider initialTab="athlete">
        <ProfileScreen />
      </NavigationProvider>,
    );

    const effectiveNode = screen.getByTestId('profile-effective-effort-ceiling');
    expect(effectiveNode).toHaveTextContent(/Effort ceiling 8\.5/);
    expect(effectiveNode).toHaveTextContent(/Your upper setting \(8\.5\) is the ceiling in use\./);
  });
});
