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

  test('resetTrainingData returns true when wiping athlete_goal_observation or other deleted tables (set_target, session_note, session_feel, slot_override, block_meta)', async () => {
    useStore.getState().boot();
    await flush();
    expect(useStore.getState().status).toBe('ready');

    const driver = drivers.get('athlete_kinetics.db');

    // Empty database returns false.
    expect(useStore.getState().resetTrainingData()).toBe(false);

    // 1. Save a goal and record a goal observation (athlete_goal_observation only).
    act(() => {
      useStore.getState().saveGoal({
        specificOutcome: 'Squat 100 kg for 5 reps',
        metricId: 'load_kg',
        measurementMethod: 'Back squat, 5 reps to parallel',
        baselineKnown: true,
        baselineValue: 80,
        targetValue: 100,
        reason: 'To be stronger for football',
        requestedDeadline: '2099-01-08',
      });
      const goalId = useStore.getState().goals[0].goalId;
      useStore.getState().recordGoalObservation(goalId, '2026-10-30', 85);
    });
    expect(driver.raw.prepare('SELECT count(*) AS c FROM athlete_goal_observation').get().c).toBe(1);

    let hadGoalObservation = false;
    act(() => {
      hadGoalObservation = useStore.getState().resetTrainingData();
    });
    expect(hadGoalObservation).toBe(true);
    expect(driver.raw.prepare('SELECT count(*) AS c FROM athlete_goal_observation').get().c).toBe(0);

    // 2. With foreign_keys OFF, seed each child/metadata table alone and verify resetTrainingData returns true.
    driver.raw.exec('PRAGMA foreign_keys = OFF;');
    const seeds = [
      ['set_target', "INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms) VALUES (1, 1, 'planned', 8.0, 101, 1000)"],
      ['session_note', "INSERT INTO session_note (session_id, note, created_at_ms) VALUES (1, 'Moved well', 1000)"],
      ['session_feel', "INSERT INTO session_feel (session_id, feel, recorded_at_ms) VALUES (1, 'as_planned', 1000)"],
      ['slot_override', "INSERT INTO slot_override (planned_slot_id, target_load_kg, reason, created_at_ms) VALUES (1, 100, 'APRE adjustment', 1000)"],
      ['block_meta', "INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted) VALUES (1, 1, 'gpp', 'LINEAR', 0)"],
    ];
    for (const [table, sql] of seeds) {
      driver.raw.exec(sql);
      let hadTableData = false;
      act(() => {
        hadTableData = useStore.getState().resetTrainingData();
      });
      // Both halves of the reset contract: it reports the data, and the data is gone.
      expect({ table, hadTableData }).toEqual({ table, hadTableData: true });
      expect({ table, left: driver.raw.prepare(`SELECT count(*) AS c FROM ${table}`).get().c }).toEqual({ table, left: 0 });
    }
  });
});
