import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';
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

describe('ProgramSetupScreen setDayFocus clears stale movementPreferences for the modified day', () => {
  test('changing a day focus in custom movement mode clears incompatible day preferences so preview, customizer, and Create program remain valid', () => {
    render(<ProgramSetupScreen />);

    // Open Fine-tune your program (optional) and select Customize movement mode
    fireEvent.press(screen.getByText('Fine-tune your program (optional)'));
    fireEvent.press(screen.getByText('Customize'));

    expect(screen.getByText('5. Customize generated week')).toBeOnTheScreen();

    // Pick a weight-room movement preference on Day 1 Slot 1 (Box Squat Chip in 5. Customize generated week)
    // and a movement preference on another day so we can verify other days' preferences survive.
    const boxSquatId = useStore.getState().movements.find((m) => m.name === 'Box Squat').movement_id;
    const boxSquatChips = screen.getAllByLabelText('Box Squat');
    fireEvent.press(boxSquatChips[0]);
    fireEvent.press(boxSquatChips[1]);

    // Now change Day 1 ("Today") focus from lower to upper
    fireEvent.press(screen.getAllByLabelText('upper')[0]);

    // Expected: changing Day 1 focus clears incompatible Day 1 movement preferences
    // so the customizer stays mounted, no invalid-preference error is thrown, and Create program stays enabled.
    expect({
      customizerMounted: screen.queryByText('5. Customize generated week') !== null,
      invalidPreferenceErrorShown: screen.queryByText('Program schedule contains an invalid movement preference.') !== null,
      createProgramDisabled: screen.getByLabelText('Create program').props.accessibilityState?.disabled === true,
    }).toEqual({
      customizerMounted: true,
      invalidPreferenceErrorShown: false,
      createProgramDisabled: false,
    });

    fireEvent.press(screen.getByLabelText('Create program'));
    const savedPreferences = useStore.getState().program?.movementPreferences ?? [];
    expect(savedPreferences.some((pref) => pref.dayIndex === 1)).toBe(false);
    expect(savedPreferences).toEqual([
      {
        dayIndex: 4,
        slotIndex: 1,
        pattern: 'squat',
        movementId: boxSquatId,
      },
    ]);
  });
});
