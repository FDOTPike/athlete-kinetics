import React from 'react';
import { StyleSheet } from 'react-native';
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

const settle = async () => {
  for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); });
};
const press = (testID) => act(() => { fireEvent.press(screen.getByTestId(testID)); });
const pressLabel = (label) => act(() => { fireEvent.press(screen.getByLabelText(label)); });
const type = (testID, text) => act(() => { fireEvent.changeText(screen.getByTestId(testID), text); });
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

describe('OnboardingScreen review step provides an Edit target action when wantsTarget is enabled', () => {
  test('review step provides an Edit target action that navigates directly to the target step ("WHAT ARE WE AIMING FOR?")', () => {
    render(<OnboardingScreen />);

    // welcome -> goal -> focus
    next();
    next();
    press('focus-bundle-lower_body');
    press('onboarding-wants-target');

    // focus -> target (goal-editor)
    next();
    expect(screen.getByTestId('goal-editor')).toBeOnTheScreen();
    type('goal-outcome', 'Squat 100 kg for 5 reps');
    type('goal-method', 'Back squat, 5 reps to parallel');
    type('goal-baseline', '80');
    type('goal-target', '100');
    type('goal-reason', 'To be stronger for football');

    // target -> experience -> logistics -> equipment -> limits -> review
    next();
    next();
    next();
    next();
    pressLabel('No, nothing to note');
    next();

    expect(screen.getByLabelText('START TRAINING')).toBeOnTheScreen();
    const targetRow = screen.getByTestId('onboarding-summary-target-row');
    expect(targetRow.props.children)
      .toContain('TARGET — Squat 100 kg for 5 reps');
    expect(StyleSheet.flatten(targetRow.props.style)).toMatchObject({ flexShrink: 1 });

    const editLabels = screen.getAllByLabelText(/^Edit /).map((node) => node.props.accessibilityLabel);
    expect(editLabels).toContain('Edit target');
    expect(StyleSheet.flatten(screen.getByLabelText('Edit target').props.style)).toMatchObject({
      minWidth: 56,
      minHeight: 56,
    });

    pressLabel('Edit target');
    expect(screen.getByTestId('goal-editor')).toBeOnTheScreen();
  });
});
