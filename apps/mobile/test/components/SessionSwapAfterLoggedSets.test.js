import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDriver;
jest.mock('../../src/navigation/navigation', () => ({ useSubViewBack: () => undefined }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: () => mockDriver }));
jest.mock('../../src/state/athleteRegistry', () => {
  const core = jest.requireActual('../../src/state/athleteRegistryCore');
  return {
    loadRegistry: async () => ({
      version: 1,
      activeId: core.DEFAULT_ATHLETE_ID,
      advancedToolsUnlocked: false,
      athletes: [{ id: core.DEFAULT_ATHLETE_ID, name: 'Athlete 1', dbName: core.LEGACY_DB_NAME, createdAtMs: 0 }],
    }),
    saveRegistry: async () => undefined,
  };
});

jest.setTimeout(60_000);

const state = () => useStore.getState();
const raw = () => mockDriver.raw;
const idOf = (name) => Number(raw().prepare('SELECT movement_id FROM movement WHERE name = ?').get(name).movement_id);

const bootStore = async (existingDriver = null) => {
  authorizeAthleteDataBoot();
  if (!existingDriver) {
    mockDriver = makeNodeSqliteDriver();
  }
  useStore.setState({
    status: 'booting', error: null, session: null, runner: null, sessionMode: null, sessionPlan: [],
    preparation: null, activeSessionPlanSlotId: null, activeMovementId: null, lastTriage: null,
    prescription: null, niggles: [], todayPlan: null, block: null, program: null, lastEndedSessionId: null,
    substitution: null,
  });
  state().boot();
  for (let i = 0; i < 500 && state().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
};

afterEach(() => {
  jest.restoreAllMocks();
});

test('applyDaySwap after 1 of 3 logged sets keeps A at slot_index 0 with planned_sets = 1 and replaced_by_session_plan_slot_id, inserts B at slot_index 1 with planned_sets = 2 and original_movement_id = A, shifts later slot C from 1 to 2, preserves logged set attribution, and completes after logging B', async () => {
  let nowMs = 1_700_000_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  await bootStore();
  state().saveProfile({
    training_age: 'intermediate',
    equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'kettlebell'],
  });

  const today = state().today;
  const moveA = idOf('Push-up');
  const moveB = idOf('Incline Push-Up');
  const moveC = idOf('Bodyweight Squat');

  raw().prepare(
    "INSERT INTO training_block (block_id, start_date, objective, created_at_ms, status) VALUES (1, ?, 'strength', 1000, 'active')",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (100, 1, 1, 1, 'upper', 'accumulation', ?)",
  ).run(today);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (500, 100, 1, ?, 3, 5, 8)',
  ).run(moveA);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (501, 100, 2, ?, 1, 8, 7.5)',
  ).run(moveC);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (101, 1, 1, 3, 'upper', 'accumulation', date(?, '+2 days'))",
  ).run(today);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (502, 101, 1, ?, 3, 8, 8)',
  ).run(moveB);

  state().refreshBlock();
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);

  const slotA = state().sessionPlan[0];
  const slotC = state().sessionPlan[1];
  expect(slotA.movementId).toBe(moveA);
  expect(slotC.movementId).toBe(moveC);

  // Log 1 of 3 sets of movement A.
  state().logSet(moveA, 5, 0, 8, undefined, undefined, undefined, undefined, slotA.sessionPlanSlotId);

  // Swap A for B with 2 sets via applyDaySwap.
  state().applyDaySwap(
    moveA,
    {
      plannedSlotId: 502,
      fromDayIndex: 2,
      movement_id: moveB,
      name: 'Incline Push-Up',
      pattern: 'horizontal_push',
      setsConserved: 3,
      color: 'green',
      rationale: 'Swap from later day.',
    },
    2,
  );

  expect(state().error).toBeNull();
  expect(state().sessionPlan).toHaveLength(3);

  const dbSlots = raw().prepare(
    'SELECT session_plan_slot_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id, original_movement_id, replaced_by_session_plan_slot_id FROM session_plan_slot WHERE session_id = ? ORDER BY slot_index',
  ).all(state().session.sessionId);

  expect(dbSlots).toHaveLength(3);
  const [rowA, rowB, rowC] = dbSlots;

  // A's row stays at slot_index 0 with planned_sets = 1 and replaced_by_session_plan_slot_id pointing at B's row.
  expect(rowA).toMatchObject({
    session_plan_slot_id: slotA.sessionPlanSlotId,
    slot_index: 0,
    movement_id: moveA,
    planned_sets: 1,
    replaced_by_session_plan_slot_id: rowB.session_plan_slot_id,
  });

  // B's row is at slot_index 1 with planned_sets = 2 and original_movement_id = A.
  expect(rowB).toMatchObject({
    slot_index: 1,
    movement_id: moveB,
    planned_sets: 2,
    planned_reps: 8,
    provenance_kind: 'day_swapped',
    target_rpe: 8,
    source_planned_slot_id: 502,
    original_movement_id: moveA,
    replaced_by_session_plan_slot_id: null,
  });

  // Later slot C moved from slot_index 1 to 2.
  expect(rowC).toMatchObject({
    session_plan_slot_id: slotC.sessionPlanSlotId,
    slot_index: 2,
    movement_id: moveC,
    planned_sets: 1,
    replaced_by_session_plan_slot_id: null,
  });

  // In-memory sessionPlan matches SQLite.
  expect(state().sessionPlan[0]).toMatchObject({
    sessionPlanSlotId: slotA.sessionPlanSlotId,
    movementId: moveA,
    plannedSets: 1,
    replacedBySessionPlanSlotId: rowB.session_plan_slot_id,
  });
  expect(state().sessionPlan[1]).toMatchObject({
    sessionPlanSlotId: rowB.session_plan_slot_id,
    movementId: moveB,
    plannedSets: 2,
    originalMovementId: moveA,
    replacedBySessionPlanSlotId: null,
  });
  expect(state().sessionPlan[2]).toMatchObject({
    sessionPlanSlotId: slotC.sessionPlanSlotId,
    movementId: moveC,
    plannedSets: 1,
    replacedBySessionPlanSlotId: null,
  });

  // The logged set row and its set_target still point at A and A's slot.
  const loggedRows = raw().prepare(
    'SELECT sr.movement_id, st.session_plan_slot_id FROM set_record sr JOIN set_target st ON st.set_id = sr.set_id WHERE sr.session_id = ?',
  ).all(state().session.sessionId);
  expect(loggedRows).toEqual([
    { movement_id: moveA, session_plan_slot_id: slotA.sessionPlanSlotId },
  ]);

  // The runner's active slot is B at set 1 of 2 in working phase.
  expect(state().activeSessionPlanSlotId).toBe(rowB.session_plan_slot_id);
  expect(state().activeMovementId).toBe(moveB);
  expect(state().runner.phase).toBe('working');
  expect(state().runner.slotIndex).toBe(1);
  expect(state().runner.setIndex).toBe(1);
  expect(state().runner.slots[0]).toMatchObject({
    sessionPlanSlotId: slotA.sessionPlanSlotId,
    movementId: moveA,
    sets: 1,
  });
  expect(state().runner.slots[1]).toMatchObject({
    sessionPlanSlotId: rowB.session_plan_slot_id,
    movementId: moveB,
    sets: 2,
  });

  // Logging 2 sets of B finishes B and advances to C; logging C completes the session.
  state().logSet(moveB, 8, 0, 8, undefined, undefined, undefined, undefined, rowB.session_plan_slot_id);
  state().skipRunnerRest();
  expect(state().runner.slotIndex).toBe(1);
  expect(state().runner.setIndex).toBe(2);

  state().logSet(moveB, 8, 0, 8, undefined, undefined, undefined, undefined, rowB.session_plan_slot_id);
  state().skipRunnerRest();
  expect(state().runner.slotIndex).toBe(2);
  expect(state().runner.setIndex).toBe(1);

  state().logSet(moveC, 8, 20, 7.5, undefined, undefined, undefined, undefined, slotC.sessionPlanSlotId);
  expect(state().runner.phase).toBe('complete');
});

test('applyRegression after 2 of 4 sets logged keeps A with planned_sets = 2 and replaced_by_session_plan_slot_id, inserts B at slot_index 1 with planned_sets = 1 and original_movement_id = A, shifts C from 1 to 2, and completes after logging B', async () => {
  let nowMs = 1_700_000_100_000;
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  await bootStore();
  state().saveProfile({
    training_age: 'intermediate',
    equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'kettlebell'],
  });

  const today = state().today;
  const moveA = idOf('Push-up');
  const moveB = idOf('Incline Push-Up');
  const moveC = idOf('Bodyweight Squat');

  raw().prepare(
    "INSERT INTO training_block (block_id, start_date, objective, created_at_ms, status) VALUES (1, ?, 'strength', 1000, 'active')",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (100, 1, 1, 1, 'upper', 'accumulation', ?)",
  ).run(today);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (500, 100, 1, ?, 4, 6, 8)',
  ).run(moveA);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (501, 100, 2, ?, 1, 8, 7.5)',
  ).run(moveC);

  state().refreshBlock();
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);

  const slotA = state().sessionPlan[0];
  const slotC = state().sessionPlan[1];

  // Log 2 of 4 sets of A.
  state().logSet(moveA, 6, 0, 8, undefined, undefined, undefined, undefined, slotA.sessionPlanSlotId);
  state().skipRunnerRest();
  state().logSet(moveA, 6, 0, 8, undefined, undefined, undefined, undefined, slotA.sessionPlanSlotId);
  state().skipRunnerRest();

  // Swap A for B with 1 set via applyRegression.
  state().applyRegression(moveA, moveB, 1);

  expect(state().error).toBeNull();
  expect(state().sessionPlan).toHaveLength(3);

  const dbSlots = raw().prepare(
    'SELECT session_plan_slot_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind, target_rpe, source_planned_slot_id, original_movement_id, replaced_by_session_plan_slot_id FROM session_plan_slot WHERE session_id = ? ORDER BY slot_index',
  ).all(state().session.sessionId);

  expect(dbSlots).toHaveLength(3);
  const [rowA, rowB, rowC] = dbSlots;

  expect(rowA).toMatchObject({
    session_plan_slot_id: slotA.sessionPlanSlotId,
    slot_index: 0,
    movement_id: moveA,
    planned_sets: 2,
    replaced_by_session_plan_slot_id: rowB.session_plan_slot_id,
  });

  expect(rowB).toMatchObject({
    slot_index: 1,
    movement_id: moveB,
    planned_sets: 1,
    planned_reps: 6,
    provenance_kind: 'substituted',
    target_rpe: 8,
    source_planned_slot_id: 500,
    original_movement_id: moveA,
    replaced_by_session_plan_slot_id: null,
  });

  expect(rowC).toMatchObject({
    session_plan_slot_id: slotC.sessionPlanSlotId,
    slot_index: 2,
    movement_id: moveC,
    planned_sets: 1,
    replaced_by_session_plan_slot_id: null,
  });

  // Both logged sets and their set_target rows still point at A and A's slot.
  const loggedRows = raw().prepare(
    'SELECT sr.movement_id, st.session_plan_slot_id FROM set_record sr JOIN set_target st ON st.set_id = sr.set_id WHERE sr.session_id = ? ORDER BY sr.set_index',
  ).all(state().session.sessionId);
  expect(loggedRows).toEqual([
    { movement_id: moveA, session_plan_slot_id: slotA.sessionPlanSlotId },
    { movement_id: moveA, session_plan_slot_id: slotA.sessionPlanSlotId },
  ]);

  // Active slot is B at set 1 of 1.
  expect(state().activeSessionPlanSlotId).toBe(rowB.session_plan_slot_id);
  expect(state().activeMovementId).toBe(moveB);
  expect(state().runner.phase).toBe('working');
  expect(state().runner.slotIndex).toBe(1);
  expect(state().runner.setIndex).toBe(1);
  expect(state().runner.slots[1]).toMatchObject({
    sessionPlanSlotId: rowB.session_plan_slot_id,
    movementId: moveB,
    sets: 1,
  });

  // Skip C first or log B then C to complete the session.
  state().logSet(moveB, 6, 0, 8, undefined, undefined, undefined, undefined, rowB.session_plan_slot_id);
  state().skipRunnerRest();
  state().logSet(moveC, 8, 20, 7.5, undefined, undefined, undefined, undefined, slotC.sessionPlanSlotId);
  expect(state().runner.phase).toBe('complete');
});

test('with 0 sets logged, both applyDaySwap and applyRegression still replace in place and add no row', async () => {
  let nowMs = 1_700_000_200_000;
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  await bootStore();
  state().saveProfile({
    training_age: 'intermediate',
    equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'kettlebell'],
  });

  const today = state().today;
  const moveA = idOf('Push-up');
  const moveB = idOf('Incline Push-Up');
  const moveC = idOf('Bodyweight Squat');
  const moveD = idOf('Glute Bridge');

  raw().prepare(
    "INSERT INTO training_block (block_id, start_date, objective, created_at_ms, status) VALUES (1, ?, 'strength', 1000, 'active')",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (100, 1, 1, 1, 'upper', 'accumulation', ?)",
  ).run(today);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (500, 100, 1, ?, 3, 5, 8)',
  ).run(moveA);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (501, 100, 2, ?, 3, 8, 8)',
  ).run(moveC);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (101, 1, 1, 3, 'upper', 'accumulation', date(?, '+2 days'))",
  ).run(today);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (502, 101, 1, ?, 2, 8, 8)',
  ).run(moveB);

  state().refreshBlock();
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);

  const slotAId = state().sessionPlan[0].sessionPlanSlotId;
  const slotCId = state().sessionPlan[1].sessionPlanSlotId;

  // 0 sets logged on slot 0: applyDaySwap replaces in place.
  state().applyDaySwap(moveA, {
    plannedSlotId: 502,
    fromDayIndex: 2,
    movement_id: moveB,
    name: 'Incline Push-Up',
    pattern: 'horizontal_push',
    setsConserved: 2,
    color: 'green',
    rationale: 'Swap from later day.',
  });

  expect(state().sessionPlan).toHaveLength(2);
  expect(state().sessionPlan[0]).toMatchObject({
    sessionPlanSlotId: slotAId,
    movementId: moveB,
    plannedSets: 2,
    originalMovementId: moveA,
    replacedBySessionPlanSlotId: null,
  });

  // Select slot 1 (still 0 sets logged on slot 1) and applyRegression in place.
  state().selectMovementSlot(slotCId);
  state().applyRegression(moveC, moveD);

  expect(state().sessionPlan).toHaveLength(2);
  expect(state().sessionPlan[1]).toMatchObject({
    sessionPlanSlotId: slotCId,
    movementId: moveD,
    plannedSets: 3,
    originalMovementId: moveC,
    replacedBySessionPlanSlotId: null,
  });

  const dbCount = raw().prepare('SELECT COUNT(*) AS c FROM session_plan_slot WHERE session_id = ?').get(state().session.sessionId).c;
  expect(Number(dbCount)).toBe(2);
});

test('invalid set counts (0, 7, NaN, non-integer) are refused with no DB or state change', async () => {
  let nowMs = 1_700_000_300_000;
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  await bootStore();
  state().saveProfile({
    training_age: 'intermediate',
    equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'kettlebell'],
  });

  const today = state().today;
  const moveA = idOf('Push-up');
  const moveB = idOf('Incline Push-Up');

  raw().prepare(
    "INSERT INTO training_block (block_id, start_date, objective, created_at_ms, status) VALUES (1, ?, 'strength', 1000, 'active')",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (100, 1, 1, 1, 'upper', 'accumulation', ?)",
  ).run(today);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (500, 100, 1, ?, 3, 5, 8)',
  ).run(moveA);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (101, 1, 1, 3, 'upper', 'accumulation', date(?, '+2 days'))",
  ).run(today);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (502, 101, 1, ?, 2, 8, 8)',
  ).run(moveB);

  state().refreshBlock();
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);

  const slotA = state().sessionPlan[0];
  state().logSet(moveA, 5, 0, 8, undefined, undefined, undefined, undefined, slotA.sessionPlanSlotId);

  const snapshotDbSlots = () => raw().prepare(
    'SELECT * FROM session_plan_slot WHERE session_id = ? ORDER BY slot_index',
  ).all(state().session.sessionId);
  const snapshotCheckpoint = () => raw().prepare(
    'SELECT runner_state_json FROM session_runner_checkpoint WHERE session_id = ?',
  ).get(state().session.sessionId);

  const beforeSlots = snapshotDbSlots();
  const beforeCheckpoint = snapshotCheckpoint();
  const beforePlan = state().sessionPlan;
  const beforeRunner = state().runner;

  const daySwapOption = {
    plannedSlotId: 502,
    fromDayIndex: 2,
    movement_id: moveB,
    name: 'Incline Push-Up',
    pattern: 'horizontal_push',
    setsConserved: 2,
    color: 'green',
    rationale: 'Swap from later day.',
  };

  for (const invalidCount of [0, 7, NaN, 2.5, -1, undefined]) {
    state().applyDaySwap(moveA, daySwapOption, invalidCount);
    state().applyRegression(moveA, moveB, invalidCount);
    state().swapMovement(moveA, moveB, invalidCount);
  }

  expect(snapshotDbSlots()).toEqual(beforeSlots);
  expect(snapshotCheckpoint()).toEqual(beforeCheckpoint);
  expect(state().sessionPlan).toBe(beforePlan);
  expect(state().runner).toBe(beforeRunner);
});

test('restarting/resuming the session from SQLite after a post-set swap restores both rows, replacedBySessionPlanSlotId, and the runner position', async () => {
  let nowMs = 1_700_000_400_000;
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  await bootStore();
  state().saveProfile({
    training_age: 'intermediate',
    equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'kettlebell'],
  });

  const today = state().today;
  const moveA = idOf('Push-up');
  const moveB = idOf('Incline Push-Up');
  const moveC = idOf('Bodyweight Squat');

  raw().prepare(
    "INSERT INTO training_block (block_id, start_date, objective, created_at_ms, status) VALUES (1, ?, 'strength', 1000, 'active')",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (100, 1, 1, 1, 'upper', 'accumulation', ?)",
  ).run(today);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (500, 100, 1, ?, 3, 5, 8)',
  ).run(moveA);
  raw().prepare(
    'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (501, 100, 2, ?, 2, 8, 7.5)',
  ).run(moveC);

  state().refreshBlock();
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);

  const slotA = state().sessionPlan[0];
  state().logSet(moveA, 5, 0, 8, undefined, undefined, undefined, undefined, slotA.sessionPlanSlotId);
  state().applyRegression(moveA, moveB, 2);

  const newSlotId = state().sessionPlan[1].sessionPlanSlotId;
  expect(newSlotId).toBeGreaterThan(slotA.sessionPlanSlotId);

  // Simulate app restart on the same SQLite database.
  await bootStore(mockDriver);

  expect(state().sessionPlan).toHaveLength(3);
  expect(state().sessionPlan[0]).toMatchObject({
    sessionPlanSlotId: slotA.sessionPlanSlotId,
    movementId: moveA,
    plannedSets: 1,
    replacedBySessionPlanSlotId: newSlotId,
  });
  expect(state().sessionPlan[1]).toMatchObject({
    sessionPlanSlotId: newSlotId,
    movementId: moveB,
    plannedSets: 2,
    originalMovementId: moveA,
    replacedBySessionPlanSlotId: null,
  });
  expect(state().activeSessionPlanSlotId).toBe(newSlotId);
  expect(state().activeMovementId).toBe(moveB);
  expect(state().runner.phase).toBe('working');
  expect(state().runner.slotIndex).toBe(1);
  expect(state().runner.setIndex).toBe(1);
  expect(state().selectMovementSlot(slotA.sessionPlanSlotId)).toBeUndefined();
  expect(state().activeSessionPlanSlotId).toBe(newSlotId);
});
