import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
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

describe('ProfileScreen OneRmRow and Bodyweight inputs preserve saved values and re-sync text on endEditing', () => {
  test('OneRmRow resets displayed text to snapped valueKg ("100.0") when entered text ("101") snaps to existing valueKg', () => {
    // Save Squat 1RM = 100.0 kg
    useStore.getState().saveOneRepMax(1, 100);
    expect(useStore.getState().oneRepMaxes[1]).toBe(100);

    render(
      <NavigationProvider initialTab="athlete">
        <ProfileScreen />
      </NavigationProvider>,
    );

    const squatInput = screen.getAllByLabelText(/one rep max in kilograms, type to set/i)[0];
    expect(squatInput.props.value).toBe('100.0');

    // Type "101" and finish editing: saveOneRepMax snaps 101 -> 100.0 (2.5 kg increment)
    fireEvent.changeText(squatInput, '101');
    fireEvent(squatInput, 'endEditing');

    // Also enter invalid sub-20 bodyweight "15" into Bodyweight today in kilograms and finish editing
    const bwInput = screen.getByLabelText('Bodyweight today in kilograms');
    fireEvent.changeText(bwInput, '15');
    fireEvent(bwInput, 'endEditing');

    expect(useStore.getState().oneRepMaxes[1]).toBe(100);
    // Input values must reflect the persisted values ("100.0" and "") rather than leaving unsaved "101" and "15" on screen
    expect({
      squatInputText: screen.getAllByLabelText(/one rep max in kilograms, type to set/i)[0].props.value,
      bodyweightInputText: screen.getByLabelText('Bodyweight today in kilograms').props.value,
    }).toEqual({
      squatInputText: '100.0',
      bodyweightInputText: '',
    });
  });

  test('hydrates today saved bodyweight on mount, ignores untouched blur, and restores saved bodyweight on out-of-range input', () => {
    const today = useStore.getState().today;
    useStore.getState().saveBodyweight(today, 82.5);

    render(
      <NavigationProvider initialTab="athlete">
        <ProfileScreen />
      </NavigationProvider>,
    );

    const bwInput = screen.getByLabelText('Bodyweight today in kilograms');
    expect(bwInput.props.value).toBe('82.5');

    // Blurring an untouched field must not change saved data
    fireEvent(bwInput, 'endEditing');
    expect(useStore.getState().loadMeasuredHistory(14).find((r) => r.date === today)?.bodyweightKg).toBe(82.5);
    expect(screen.getByLabelText('Bodyweight today in kilograms').props.value).toBe('82.5');

    // Out-of-range value ("15") must not delete saved bodyweight and must restore the field to "82.5"
    fireEvent.changeText(bwInput, '15');
    fireEvent(bwInput, 'endEditing');
    expect(useStore.getState().loadMeasuredHistory(14).find((r) => r.date === today)?.bodyweightKg).toBe(82.5);
    expect(screen.getByLabelText('Bodyweight today in kilograms').props.value).toBe('82.5');
  });
});
