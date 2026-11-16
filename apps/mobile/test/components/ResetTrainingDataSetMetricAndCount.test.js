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

  test('#355 resetTrainingData wipes recorded activity occurrences and 064 children, preserves schedule intentions, fails closed on 064 scopes, and refreshes activityLedger', async () => {
    useStore.getState().boot();
    await flush();
    expect(useStore.getState().status).toBe('ready');

    const driver = drivers.get('athlete_kinetics.db');

    // 1. Recurring schedule intention (activity_definition + activity_series) + flexibility tag.
    act(() => {
      useStore.getState().saveWeeklyActivity({
        kindId: 'basketball',
        displayName: 'Friday Basketball',
        demand: 'high',
        facilityCode: null,
        equipmentCode: null,
        localWeekday: 5,
        localStartMinute: 1080,
        timezoneId: 'Australia/Sydney',
        timing: 'fixed',
        expectedDurationMin: 60,
        expectedEffort: 7,
        effectiveStartDate: '2026-10-01',
      });
      useStore.getState().saveWeeklyActivity({
        kindId: 'walking',
        displayName: 'Recovery Stretch Walk',
        demand: 'low',
        facilityCode: null,
        equipmentCode: null,
        localWeekday: 0,
        localStartMinute: null,
        timezoneId: 'Australia/Sydney',
        timing: 'flexible',
        expectedDurationMin: 20,
        expectedEffort: null,
        effectiveStartDate: '2026-10-01',
      });
    });

    const walkActivity = useStore.getState().activityLedger.definitions.find((d) => d.kindId === 'walking');
    expect(walkActivity).toBeDefined();
    driver.raw.prepare(
      'INSERT INTO activity_flexibility_tag (activity_id, template_id, recorded_at_ms) VALUES (?, ?, ?)',
    ).run(walkActivity.activityId, 'hips_lower_body', 1000);

    // 2. Recorded activity_occurrence + activity_completion + session + activity_source_link + recommendation_activity_basis + 064 hold scope.
    let occurrenceId;
    act(() => {
      occurrenceId = useStore.getState().saveOneOffActivity({
        kindId: 'swimming',
        displayName: 'Saturday Swim',
        demand: 'moderate',
        facilityCode: 'pool',
        equipmentCode: null,
        localDate: '2026-11-08',
        localStartMinute: null,
        timezoneId: 'Australia/Sydney',
        timing: 'flexible',
        state: 'completed',
        modalityId: 'unknown',
        purposeId: 'conditioning',
        expectedDurationMin: 40,
        expectedEffort: 6,
        actualDurationMin: 40,
        actualEffort: 6,
      });
      const athleteId = useStore.getState().activeAthleteId;
      useStore.getState().saveSupportInstruction(
        athleteId,
        { instructionText: 'Monitor swim load', scopes: [{ targetKind: 'activity_occurrence', occurrenceId }] },
        useStore.getState().getHealthSupportFacts().revision,
      );
    });

    // Seed a session linked by activity_source_link and recommendation_activity_basis (both ON DELETE RESTRICT to activity_occurrence).
    driver.raw.exec("INSERT INTO session (session_id, session_date, started_at_ms) VALUES (901, '2026-11-08', 1000)");
    driver.raw.prepare(
      `INSERT INTO activity_source_link (source_link_id, occurrence_id, source_kind, source_identity, linked_session_id, recorded_at_ms)
       VALUES ('link-901', ?, 'coached_session', 'session:901', 901, 1000)`,
    ).run(occurrenceId);
    driver.raw.exec(
      `INSERT INTO recommendation_support_record (decision_id, advice_target_kind, advice_target_identity, support_status, engine_version, generated_at_ms)
       VALUES ('dec-901', 'block', 'b-1', 'held', 'test', 1000)`,
    );
    driver.raw.prepare(
      'INSERT INTO recommendation_activity_basis (decision_id, occurrence_id, occurrence_revision) VALUES (?, ?, 1)',
    ).run('dec-901', occurrenceId);

    const defsBefore = driver.raw.prepare('SELECT count(*) AS c FROM activity_definition').get().c;
    const seriesBefore = driver.raw.prepare('SELECT count(*) AS c FROM activity_series').get().c;
    const flexBefore = driver.raw.prepare('SELECT count(*) AS c FROM activity_flexibility_tag').get().c;
    expect(defsBefore).toBeGreaterThanOrEqual(3);
    expect(seriesBefore).toBeGreaterThanOrEqual(2);
    expect(flexBefore).toBe(1);
    expect(useStore.getState().activityLedger.occurrences.length).toBeGreaterThanOrEqual(1);

    let resetResult = false;
    act(() => {
      resetResult = useStore.getState().resetTrainingData();
    });
    expect(resetResult).toBe(true);
    expect(useStore.getState().error).toBeNull();

    // Recorded occurrences & child linkage gone; recurring schedule & flexibility tag preserved.
    expect(driver.raw.prepare('SELECT count(*) AS c FROM activity_occurrence').get().c).toBe(0);
    expect(driver.raw.prepare('SELECT count(*) AS c FROM activity_completion').get().c).toBe(0);
    expect(driver.raw.prepare('SELECT count(*) AS c FROM activity_source_link').get().c).toBe(0);
    expect(driver.raw.prepare('SELECT count(*) AS c FROM recommendation_activity_basis').get().c).toBe(0);
    expect(driver.raw.prepare('SELECT count(*) AS c FROM session').get().c).toBe(0);
    expect(driver.raw.prepare('SELECT count(*) AS c FROM activity_definition').get().c).toBe(defsBefore);
    expect(driver.raw.prepare('SELECT count(*) AS c FROM activity_series').get().c).toBe(seriesBefore);
    expect(driver.raw.prepare('SELECT count(*) AS c FROM activity_flexibility_tag').get().c).toBe(flexBefore);

    // 064 health_support_scope pointing to activity_occurrence fails closed as unresolved (instruction + hold rows).
    const scopesAfterReset = driver.raw.prepare(
      'SELECT target_kind, occurrence_id FROM health_support_scope',
    ).all();
    expect(scopesAfterReset.length).toBeGreaterThanOrEqual(1);
    expect(scopesAfterReset.every((row) => row.target_kind === 'unresolved' && row.occurrence_id === null)).toBe(true);
    expect(
      driver.raw.prepare("SELECT count(*) AS c FROM health_support_scope WHERE target_kind = 'activity_occurrence'").get().c,
    ).toBe(0);
    expect(driver.raw.prepare("SELECT count(*) AS c FROM health_support_hold WHERE state = 'held'").get().c).toBe(1);

    // In-memory ledger refreshed: occurrences cleared, series & definitions intact.
    expect(useStore.getState().activityLedger.occurrences).toEqual([]);
    expect(useStore.getState().activityLedger.series.length).toBe(seriesBefore);
    expect(useStore.getState().activityLedger.definitions.length).toBe(defsBefore);

    // Negative invariant: schedule intentions alone mean nothing recorded to wipe -> reset returns false.
    expect(useStore.getState().resetTrainingData()).toBe(false);

    // Activity_occurrence-only path: moduleTablesCountSql must report true and clear it.
    act(() => {
      useStore.getState().saveOneOffActivity({
        kindId: 'custom',
        displayName: 'Isolated occurrence',
        demand: 'low',
        facilityCode: null,
        equipmentCode: null,
        localDate: '2026-11-08',
        localStartMinute: null,
        timezoneId: 'Australia/Sydney',
        timing: 'flexible',
        state: 'planned',
        modalityId: 'unknown',
        purposeId: 'recreation',
        expectedDurationMin: 15,
        expectedEffort: null,
        actualDurationMin: null,
        actualEffort: null,
      });
    });
    expect(useStore.getState().activityLedger.occurrences).toHaveLength(1);
    let occurrenceOnlyReset = false;
    act(() => {
      occurrenceOnlyReset = useStore.getState().resetTrainingData();
    });
    expect(occurrenceOnlyReset).toBe(true);
    expect(driver.raw.prepare('SELECT count(*) AS c FROM activity_occurrence').get().c).toBe(0);
    expect(useStore.getState().activityLedger.occurrences).toEqual([]);
  });
});
