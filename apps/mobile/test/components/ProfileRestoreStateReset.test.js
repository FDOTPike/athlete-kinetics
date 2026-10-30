import React from 'react';
import { act, render } from '@testing-library/react-native';
import ProfileScreen from '../../src/screens/ProfileScreen';
import {
  closeStoreDatabaseForRestore,
  restartStoreAfterRestore,
  useStore,
} from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
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

describe('closeStoreDatabaseForRestore and restartStoreAfterRestore reset per-athlete state and update ProfileScreen inputs', () => {
  beforeEach(() => {
    drivers = new Map();
    mockRegistry = {
      version: 1,
      activeAthleteId: 'default',
      advancedToolsUnlocked: false,
      athletes: [
        { id: 'default', name: 'Primary Athlete', dbName: 'athlete_kinetics.db', createdAtMs: 1 },
      ],
    };
    authorizeAthleteDataBoot();
    useStore.setState({ status: 'idle', error: null, session: null });
  });

  afterEach(() => {
    for (const d of drivers.values()) {
      try { d.close(); } catch { /* already closed */ }
    }
  });

  test('restoring a backup while ProfileScreen is mounted updates Historical Injuries / Mobility Limits inputs and clears pre-restore transient store fields', async () => {
    useStore.getState().boot();
    await flush();
    expect(useStore.getState().status).toBe('ready');

    // Pre-restore athlete state on ProfileScreen.
    act(() => {
      useStore.getState().saveProfile({
        injury_flags: [{ region: 'shoulder', note: 'impingement' }],
        mobility_limits: [{ region: 'ankle', note: 'dorsiflexion' }],
      });
      useStore.setState({
        lastEndedSessionId: 42,
        lastTriage: { region: 'shoulder', severity: 7, action: 'substitute', summary: 'Prior triage' },
      });
    });

    const tree = render(<ProfileScreen />);
    await flush();

    expect(tree.getByLabelText('Historical injuries, one per line').props.value).toBe(
      'shoulder: impingement',
    );
    expect(tree.getByLabelText('Mobility limitations, one per line').props.value).toBe(
      'ankle: dorsiflexion',
    );

    // Prepare a second SQLite database representing the restored backup's database file
    // (where active profile_slot is still slot_id = 1, with different injury/mobility notes).
    const restoredDriver = { ...makeNodeSqliteDriver(), close: () => {} };
    drivers.set('restored_backup.db', restoredDriver);
    mockRegistry = {
      ...mockRegistry,
      athletes: [
        { id: 'default', name: 'Restored Athlete', dbName: 'restored_backup.db', createdAtMs: 2 },
      ],
    };

    // Execute the exact store lifecycle sequence confirmRestore performs:
    act(() => {
      closeStoreDatabaseForRestore();
    });
    act(() => {
      restartStoreAfterRestore();
    });
    await flush();

    // Seed the restored athlete's profile in the restored DB and re-run the restore boot cycle
    // so the restored DB already carries the restored profile on boot.
    act(() => {
      useStore.getState().saveProfile({
        injury_flags: [{ region: 'knee', note: 'meniscus' }],
        mobility_limits: [{ region: 'hip', note: 'internal rotation' }],
      });
    });

    // Switch back to pre-restore DB, render pre-restore text, then restore into the populated restored DB.
    mockRegistry = {
      ...mockRegistry,
      athletes: [
        { id: 'default', name: 'Primary Athlete', dbName: 'athlete_kinetics.db', createdAtMs: 1 },
      ],
    };
    act(() => {
      closeStoreDatabaseForRestore();
      restartStoreAfterRestore();
    });
    await flush();
    expect(useStore.getState().profile.injury_flags).toEqual([
      { region: 'shoulder', note: 'impingement' },
    ]);

    // Now perform the restore replacement to restored_backup.db.
    mockRegistry = {
      ...mockRegistry,
      athletes: [
        { id: 'default', name: 'Restored Athlete', dbName: 'restored_backup.db', createdAtMs: 2 },
      ],
    };
    act(() => {
      closeStoreDatabaseForRestore();
      restartStoreAfterRestore();
    });
    await flush();

    // The store's profile has been hydrated from the restored backup:
    expect(useStore.getState().profile.injury_flags).toEqual([
      { region: 'knee', note: 'meniscus' },
    ]);
    expect(useStore.getState().profile.mobility_limits).toEqual([
      { region: 'hip', note: 'internal rotation' },
    ]);

    // Expected: ProfileScreen's text inputs reflect the restored profile and pre-restore transient store fields are cleared.
    expect({
      injuryInput: tree.getByLabelText('Historical injuries, one per line').props.value,
      mobilityInput: tree.getByLabelText('Mobility limitations, one per line').props.value,
      lastEndedSessionId: useStore.getState().lastEndedSessionId,
      lastTriage: useStore.getState().lastTriage,
    }).toEqual({
      injuryInput: 'knee: meniscus',
      mobilityInput: 'hip: internal rotation',
      lastEndedSessionId: null,
      lastTriage: null,
    });
  });
});
