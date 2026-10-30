import { act } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
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

describe('resetTrainingData deletes set_metric and counts non-session training data', () => {
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
      try { d.raw.close(); } catch { /* already closed */ }
    }
  });

  test('resetTrainingData clears set_metric even when foreign_keys is OFF and returns true when wiping non-session training data', async () => {
    useStore.getState().boot();
    await flush();
    expect(useStore.getState().status).toBe('ready');

    const driver = drivers.get('athlete_kinetics.db');
    const availableMovement = useStore
      .getState()
      .getMovementAvailabilityVerdicts('weight_room')
      .find((v) => v.state === 'available');
    expect(availableMovement).toBeDefined();
    const movementId = availableMovement.movementId;

    // 1. Start a session, finish preparation, and log a set with band_level metric (set_id = 1).
    act(() => {
      useStore.getState().saveBandLevel(3, 'Medium');
      useStore.getState().startSession();
      const prep = useStore.getState().preparation;
      if (prep !== null) {
        useStore.getState().finishPreparation('already_warm', prep.revision);
      }
      useStore.setState({ runner: null });
      useStore.getState().addPlanSlot(movementId);
      const slot = useStore.getState().sessionPlan[0];
      useStore.getState().logSet(
        slot.movementId,
        5,
        60,
        8,
        undefined,
        undefined,
        undefined,
        { timeS: 45, bandLevel: 3 },
        slot.sessionPlanSlotId,
      );
      useStore.getState().endSession();
      useStore.setState({ session: null });
    });

    expect(
      driver.raw.prepare('SELECT count(*) AS c FROM set_metric').get().c,
    ).toBeGreaterThanOrEqual(1);

    // Disable foreign_keys to test the explicit child-before-parent delete list in resetTrainingData
    // (see comments at useStore.ts:7922-7923, 7938-7941, 7962-7965).
    driver.raw.exec('PRAGMA foreign_keys = OFF;');

    act(() => {
      useStore.getState().resetTrainingData();
    });

    const survivingSetMetrics = driver.raw
      .prepare('SELECT metric, value FROM set_metric ORDER BY metric')
      .all();

    // 2. Now record a 1RM (no session or question_log rows) and reset again.
    act(() => {
      useStore.getState().saveOneRepMax(1, 140);
    });
    expect(useStore.getState().oneRepMaxes[1]).toBe(140);

    let hadNonSessionData = false;
    act(() => {
      hadNonSessionData = useStore.getState().resetTrainingData();
    });
    expect(useStore.getState().oneRepMaxes[1]).toBeUndefined();

    expect({
      survivingSetMetrics,
      hadNonSessionData,
    }).toEqual({
      survivingSetMetrics: [],
      hadNonSessionData: true,
    });
  });
});
