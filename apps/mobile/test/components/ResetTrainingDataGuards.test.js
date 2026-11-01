import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import ProfileScreen from '../../src/screens/ProfileScreen';
import {
  closeStoreDatabaseForRestore,
  useStore,
} from '../../src/state/useStore';
import {
  acquireDataMaintenanceLock,
  authorizeAthleteDataBoot,
  resetDataMaintenanceLockForTests,
} from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

jest.setTimeout(60_000);

let drivers;
let mockRegistry;

function mockDriverFor(name) {
  if (!drivers.has(name)) drivers.set(name, { ...makeNodeSqliteDriver(), close: () => {} });
  return drivers.get(name);
}

jest.mock('@op-engineering/op-sqlite', () => ({
  open: ({ name }) => mockDriverFor(name),
}));

jest.mock('../../src/state/athleteRegistry', () => {
  const actual = jest.requireActual('../../src/state/athleteRegistryCore');
  return {
    ...actual,
    loadRegistry: async () => mockRegistry,
    saveRegistry: async (next) => {
      mockRegistry = next;
      return true;
    },
  };
});

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe('resetTrainingData store-level session and maintenance-lock guards and ProfileScreen failed-reset handling', () => {
  beforeEach(() => {
    resetDataMaintenanceLockForTests();
    authorizeAthleteDataBoot();
    drivers = new Map();
    mockRegistry = {
      version: 1,
      activeAthleteId: 'default',
      advancedToolsUnlocked: false,
      athletes: [
        { id: 'default', name: 'Primary Athlete', dbName: 'athlete_kinetics.db', createdAtMs: 1 },
      ],
    };
    useStore.setState({ status: 'idle', error: null, session: null });
  });

  afterEach(() => {
    resetDataMaintenanceLockForTests();
    for (const d of drivers.values()) {
      try { d.raw.close(); } catch { /* already closed */ }
    }
  });

  test('useStore.resetTrainingData refuses during an active session or maintenance lock, and ProfileScreen renders resetError instead of throwing from loadMeasuredHistory when reset fails', async () => {
    useStore.getState().boot();
    await flush();
    expect(useStore.getState().status).toBe('ready');

    // 1. Seed a 1RM and start an active session: calling resetTrainingData() on the store should refuse.
    act(() => {
      useStore.getState().saveOneRepMax(1, 150);
      useStore.getState().startSession();
    });
    expect(useStore.getState().session).not.toBeNull();
    expect(useStore.getState().oneRepMaxes[1]).toBe(150);

    act(() => {
      useStore.getState().resetTrainingData();
    });
    const oneRmAfterActiveSessionReset = useStore.getState().oneRepMaxes[1] ?? null;
    act(() => {
      useStore.getState().endSession();
    });

    // 2. Seed a 1RM and hold the data maintenance lock: calling resetTrainingData() on the store should refuse.
    act(() => {
      useStore.getState().saveOneRepMax(1, 160);
    });
    const releaseMaintenance = acquireDataMaintenanceLock('encrypted-backup');
    act(() => {
      useStore.getState().resetTrainingData();
    });
    releaseMaintenance();
    const oneRmAfterLockedReset = useStore.getState().oneRepMaxes[1] ?? null;

    // 3. On ProfileScreen, open the reset confirmation and simulate a DB failure during resetTrainingData:
    // resetTrainingData catches the error and sets state.error, so ProfileScreen should render resetError without throwing from loadMeasuredHistory(14).
    const tree = render(<ProfileScreen />);
    await flush();

    fireEvent.press(tree.getByText('Reset training data'));
    fireEvent.press(tree.getByTestId('reset-continue-button'));
    expect(tree.getByTestId('reset-confirm-button')).toBeTruthy();

    // Simulate the DB handle becoming closed/unavailable right as confirm is pressed while status is still 'ready'.
    act(() => {
      const prevState = useStore.getState();
      closeStoreDatabaseForRestore();
      useStore.setState({ ...prevState, status: 'ready', error: null });
    });

    let thrownFromConfirmPress = null;
    try {
      act(() => {
        fireEvent.press(tree.getByTestId('reset-confirm-button'));
      });
    } catch (e) {
      thrownFromConfirmPress = e instanceof Error ? e.message : String(e);
    }

    expect({
      oneRmAfterActiveSessionReset,
      oneRmAfterLockedReset,
      thrownFromConfirmPress,
    }).toEqual({
      oneRmAfterActiveSessionReset: 150,
      oneRmAfterLockedReset: 160,
      thrownFromConfirmPress: null,
    });
  });
});
