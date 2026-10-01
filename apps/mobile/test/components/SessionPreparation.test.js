/**
 * SessionPreparation.test.js — movement preparation on every live session path.
 *
 * Behavioural tests of the REAL zustand store, booted by the production boot
 * path over the production migration chain (node:sqlite stands in for the
 * op-sqlite handle only). They pin work order 1's store contract:
 *
 *   - every live start path freezes a preparation protocol in the SAME
 *     transaction as the session — planned, routine, free-form (with and
 *     without history), sport day, guided and self-directed;
 *   - an empty free-form session, whose runner starts already 'complete',
 *     cannot bypass preparation;
 *   - the store itself refuses main-work sets until preparation has an outcome;
 *   - outcomes are truthful: completed / modified / already warm / skipped /
 *     stopped, with item-level performed dose and substitution;
 *   - duplicate taps, stale writes, restart, discard, reset and a reused
 *     session id are all safe;
 *   - holds reach preparation, at build time and again at execution time;
 *   - preparation writes no set_record and changes no APRE/load evidence;
 *   - finished, imported and demo sessions never acquire a preparation record.
 */
import { useStore, PREPARATION_GATE_MESSAGE } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import {
  readSessionPreparation, recordSessionPreparationItem, finishSessionPreparation,
} from '../../src/state/preparationStore';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDriver;
jest.mock('../../src/navigation/navigation', () => ({ useSubViewBack: () => undefined }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: () => mockDriver }));
jest.mock('../../src/state/athleteRegistry', () => {
  const core = jest.requireActual('../../src/state/athleteRegistryCore');
  return {
    loadRegistry: async () => ({ version: 1, activeId: core.DEFAULT_ATHLETE_ID,
      advancedToolsUnlocked: false,
      athletes: [{ id: core.DEFAULT_ATHLETE_ID, name: 'Athlete 1', dbName: core.LEGACY_DB_NAME, createdAtMs: 0 }] }),
    saveRegistry: async () => undefined,
  };
});

// The first heavy module load in a fresh jest worker is slow; an async test
// that hits it must not trip jest's 5 s default and cascade.
jest.setTimeout(60_000);

const state = () => useStore.getState();
const raw = () => mockDriver.raw;
const count = (sql, ...params) => Number(raw().prepare(sql).get(...params).c);
const prepRow = (sessionId) => raw().prepare('SELECT * FROM session_preparation WHERE session_id = ?').get(sessionId);
const itemRows = (sessionId) => raw().prepare('SELECT * FROM session_preparation_item WHERE session_id = ? ORDER BY item_index').all(sessionId);
const OWNED_EQUIPMENT = ['barbell', 'squat_rack', 'dumbbells', 'bench'];
const programInput = { horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] };

const boot = async () => {
  useStore.setState({
    status: 'booting', error: null, session: null, runner: null, sessionMode: null, sessionPlan: [],
    preparation: null, activeSessionPlanSlotId: null, activeMovementId: null, lastTriage: null,
    prescription: null, niggles: [], todayPlan: null, block: null, program: null, lastEndedSessionId: null,
  });
  state().boot();
  for (let i = 0; i < 500 && state().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  expect(state().status).toBe('ready');
};

beforeEach(async () => {
  authorizeAthleteDataBoot();
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDriver = makeNodeSqliteDriver();
  await boot();
  state().saveProfile({ training_age: 'intermediate', equipment_inventory: OWNED_EQUIPMENT });
});

afterEach(() => { jest.restoreAllMocks(); });

/** Seed one finished session so the free-form path has history to repeat. */
const seedHistory = (movementIds) => {
  raw().exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (9000, NULL, '2026-01-05', 1000, 40)");
  movementIds.forEach((movementId, index) => {
    raw().prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (9000, ?, 1, 5, 40, 7, ?)')
      .run(movementId, 2000 + index);
  });
};
const idOf = (name) => Number(raw().prepare('SELECT movement_id FROM movement WHERE name = ?').get(name).movement_id);
const startPlanned = () => {
  expect(state().createTrainingProgram(programInput)).toBe(true);
  expect(state().todayPlan).not.toBeNull();
  state().startSession();
  expect(state().error).toBeNull();
  expect(state().session).not.toBeNull();
  return state().session.sessionId;
};
const finishAllItems = () => {
  state().beginPreparation(state().preparation.revision);
  for (const item of state().preparation.items) {
    state().recordPreparationItem(item.index, { status: 'done' }, state().preparation.revision);
  }
};

describe('every live start path freezes preparation atomically', () => {
  test('planned start: protocol and items are inserted with the session, pending at revision 1', () => {
    const sessionId = startPlanned();
    const row = prepRow(sessionId);
    const preparation = state().preparation;
    expect(row).toMatchObject({ status: 'pending', revision: 1, policy_id: 'ramp-general', finished_at_ms: null });
    expect(row.session_started_at_ms).toBe(state().session.startedAtMs);
    expect(preparation).toMatchObject({ sessionId, status: 'pending', revision: 1, instanceId: row.instance_id });
    expect(itemRows(sessionId)).toHaveLength(preparation.protocol.items.length);
    expect(itemRows(sessionId).every((item) => item.status === 'pending')).toBe(true);
    // Movement-bound items only ever name a movement from this session's plan.
    const planIds = new Set(state().sessionPlan.map((slot) => slot.movementId));
    expect(preparation.protocol.items.filter((item) => item.movementId !== null).length).toBeGreaterThan(0);
    expect(preparation.protocol.items.every((item) => item.movementId === null || planIds.has(item.movementId))).toBe(true);
    expect(preparation.protocol.items[0].stage).toBe('raise');
    expect(count('SELECT COUNT(*) AS c FROM set_record')).toBe(0);
  });

  test('free-form start with history prepares the repeated movements', () => {
    seedHistory([idOf('Push-up'), idOf('Sumo Deadlift')]);
    state().startSession();
    const sessionId = state().session.sessionId;
    expect(state().sessionPlan.length).toBeGreaterThan(0);
    expect(prepRow(sessionId).status).toBe('pending');
    expect(state().preparation.protocol.basis.join(' ')).toMatch(/Session movements:/);
  });

  test('an EMPTY free-form session cannot bypass preparation even though its runner starts complete', () => {
    state().startSession();
    const sessionId = state().session.sessionId;
    expect(state().sessionPlan).toHaveLength(0);
    expect(state().runner.phase).toBe('complete');
    // Regression: before 065 this session had nothing between Start and logging.
    expect(prepRow(sessionId).status).toBe('pending');
    expect(state().preparation.protocol.items.map((item) => item.itemId))
      .toEqual(['raise.easy_movement', 'mobilise.leg_swings', 'mobilise.arm_circles', 'rehearse.first_choice']);
    state().logSet(idOf('Push-up'), 5, 0, 7);
    expect(state().error).toBe(PREPARATION_GATE_MESSAGE);
    expect(count('SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', sessionId)).toBe(0);
  });

  test('routine start prepares the frozen routine', () => {
    state().saveProfile({ training_age: 'elite', session_duration_cap_min: 120, equipment_inventory: [...OWNED_EQUIPMENT, 'bands', 'boards'] });
    const template = state().saveRoutineTemplate({
      name: 'Bench day', schemaType: 'LINEAR',
      slots: [{ dayIndex: 1, slotIndex: 1, movementId: idOf('Competition Bench'), role: 'major', sets: 3, reps: 5, targetRpe: 8 }],
    });
    state().freezeRoutineTemplateToPlannedSession(template.routineTemplateId, undefined, 1);
    expect(state().todayPlan).not.toBeNull();
    state().startSession();
    expect(state().error).toBeNull();
    const preparation = state().preparation;
    expect(preparation.status).toBe('pending');
    expect(preparation.protocol.items.filter((item) => item.stage === 'ramp').map((item) => item.movementId))
      .toEqual([idOf('Competition Bench'), idOf('Competition Bench')]);
  });

  test('sport-day start prepares in the sport context (balance included)', () => {
    expect(state().createTrainingProgram(programInput)).toBe(true);
    // Re-point today's planned session at a conditioning focus: the same frozen
    // slots, executed in the sport/conditioning access context.
    raw().prepare("UPDATE planned_session SET focus = 'conditioning' WHERE planned_session_id = ?").run(state().todayPlan.plannedSessionId);
    state().refreshBlock();
    expect(state().todayPlan.focus).toBe('conditioning');
    state().startSession();
    expect(state().error).toBeNull();
    expect(state().activeSessionAccessContext).toBe('sport_conditioning');
    expect(state().preparation.protocol.basis.join(' ')).toMatch(/Sport or conditioning session/);
    expect(state().preparation.protocol.items.some((item) => item.itemId === 'activate.single_leg_balance')
      || state().preparation.protocol.omitted.some((row) => row.itemId === 'activate.single_leg_balance')).toBe(true);
  });

  test.each([['guided', 'beginner'], ['self_directed', 'intermediate']])('%s session gets preparation', (mode, tier) => {
    state().saveProfile({ training_age: tier });
    state().startSession();
    expect(state().sessionMode).toBe(mode);
    expect(prepRow(state().session.sessionId).status).toBe('pending');
  });

  test('atomic: when the protocol cannot be written, no session is created at all', () => {
    raw().exec('DROP TABLE session_preparation_item');
    state().startSession();
    expect(state().session).toBeNull();
    expect(state().preparation).toBeNull();
    expect(state().error).toMatch(/session_preparation_item/);
    expect(count('SELECT COUNT(*) AS c FROM session')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM session_preparation')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM session_runner_checkpoint')).toBe(0);
  });

  test('a frozen plan that no longer fits the session limit is left unchanged and the conflict is stated', () => {
    expect(state().createTrainingProgram(programInput)).toBe(true);
    const frozen = JSON.stringify(state().todayPlan.slots.map((slot) => [slot.movementId, slot.sets, slot.target]));
    state().saveProfile({ session_duration_cap_min: 15 });
    state().startSession();
    expect(state().error).toBeNull();
    expect(JSON.stringify(state().todayPlan.slots.map((slot) => [slot.movementId, slot.sets, slot.target]))).toBe(frozen);
    expect(state().preparation.protocol.variant).toBe('condensed');
    expect(state().preparation.protocol.notes.join(' ')).toMatch(/over your 15-minute session limit/);
    expect(state().preparation.protocol.notes.join(' ')).toMatch(/has not been shortened below 5 minutes/);
    expect(state().preparation.protocol.items[0].stage).toBe('raise');
  });
});

describe('the store gate and truthful outcomes', () => {
  test('logSet is refused until preparation has an outcome, then allowed', () => {
    seedHistory([idOf('Push-up')]);
    state().startSession();
    const sessionId = state().session.sessionId;
    const slot = state().sessionPlan[0];
    state().logSet(slot.movementId, 5, 0, 7, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
    expect(state().error).toBe(PREPARATION_GATE_MESSAGE);
    expect(count('SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', sessionId)).toBe(0);
    expect(state().runner.loggedSets).toBe(0);

    state().finishPreparation('already_warm', state().preparation.revision);
    expect(state().preparation.status).toBe('already_warm');
    useStore.setState({ error: null });
    state().logSet(slot.movementId, 5, 0, 7, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
    expect(state().error).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', sessionId)).toBe(1);
  });

  test('the gate reads the database, not the in-memory copy', () => {
    seedHistory([idOf('Push-up')]);
    state().startSession();
    const slot = state().sessionPlan[0];
    // A stale or missing in-memory protocol must not open the gate.
    useStore.setState({ preparation: null });
    state().logSet(slot.movementId, 5, 0, 7, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
    expect(state().error).toBe(PREPARATION_GATE_MESSAGE);
    expect(count('SELECT COUNT(*) AS c FROM set_record')).toBe(1); // the seeded history row only
  });

  test('completed: every item done as written', () => {
    const sessionId = startPlanned();
    finishAllItems();
    state().finishPreparation('finished', state().preparation.revision);
    expect(prepRow(sessionId).status).toBe('completed');
    expect(prepRow(sessionId).finished_at_ms).not.toBeNull();
    expect(itemRows(sessionId).every((item) => item.status === 'done' && item.performed_amount === item.prescribed_amount)).toBe(true);
    expect(state().preparation.status).toBe('completed');
  });

  test('modified: a changed dose and a substitution are recorded item by item, and "completed" is not claimed', () => {
    const sessionId = startPlanned();
    state().beginPreparation(state().preparation.revision);
    const [first, second, ...rest] = state().preparation.items;
    const firstPrescribed = itemRows(sessionId)[0].prescribed_amount;
    state().recordPreparationItem(first.index, { status: 'modified', performedAmount: firstPrescribed - 60, reasonCode: 'no_time' }, state().preparation.revision);
    state().recordPreparationItem(second.index, { status: 'substituted', substitutionText: 'easy rowing', performedAmount: 30 }, state().preparation.revision);
    for (const item of rest) state().recordPreparationItem(item.index, { status: 'done' }, state().preparation.revision);
    state().finishPreparation('finished', state().preparation.revision);
    expect(prepRow(sessionId).status).toBe('modified');
    const rows = itemRows(sessionId);
    expect(rows[0]).toMatchObject({ status: 'modified', performed_amount: firstPrescribed - 60, reason_code: 'no_time', extra_work: 0 });
    expect(rows[1]).toMatchObject({ status: 'substituted', substitution_text: 'easy rowing', performed_amount: 30 });
  });

  test('"modified" with the prescribed amount is stored as done, not dressed up as a change', () => {
    const sessionId = startPlanned();
    const prescribed = itemRows(sessionId)[0].prescribed_amount;
    state().recordPreparationItem(0, { status: 'modified', performedAmount: prescribed }, state().preparation.revision);
    expect(itemRows(sessionId)[0]).toMatchObject({ status: 'done', performed_amount: prescribed });
  });

  test('finishing with unrecorded items resolves to modified and closes those items as skipped', () => {
    const sessionId = startPlanned();
    state().recordPreparationItem(0, { status: 'done' }, state().preparation.revision);
    state().finishPreparation('finished', state().preparation.revision);
    expect(prepRow(sessionId).status).toBe('modified');
    const rows = itemRows(sessionId);
    expect(rows[0].status).toBe('done');
    expect(rows.slice(1).every((item) => item.status === 'skipped' && item.reason_code === 'athlete_choice')).toBe(true);
  });

  test('"finished" with nothing performed is refused: it is not completed', () => {
    const sessionId = startPlanned();
    state().beginPreparation(state().preparation.revision);
    state().finishPreparation('finished', state().preparation.revision);
    expect(state().error).toMatch(/Nothing in preparation is recorded as done/);
    expect(prepRow(sessionId).status).toBe('in_progress');
  });

  test('skipped and already warm are recorded as exactly that', () => {
    const skippedId = startPlanned();
    state().finishPreparation('skipped', state().preparation.revision);
    expect(prepRow(skippedId).status).toBe('skipped');
    expect(itemRows(skippedId).every((item) => item.status === 'skipped')).toBe(true);
  });

  test('"skip" after work was done is recorded as modified — performed work is not erased', () => {
    const sessionId = startPlanned();
    state().recordPreparationItem(0, { status: 'done' }, state().preparation.revision);
    state().finishPreparation('skipped', state().preparation.revision);
    expect(prepRow(sessionId).status).toBe('modified');
    expect(itemRows(sessionId)[0].status).toBe('done');
  });

  test('stopping during preparation records "stopped" and stays available', () => {
    const sessionId = startPlanned();
    state().beginPreparation(state().preparation.revision);
    state().runnerHalt('safety');
    expect(state().runner.phase).toBe('halted');
    expect(prepRow(sessionId).status).toBe('stopped');
    expect(state().preparation.status).toBe('stopped');
    // A safety stop is kept as a session outcome; its preparation stays "stopped".
    state().endSession();
    expect(state().session).toBeNull();
    expect(state().loadSessionPreparation(sessionId)).toMatchObject({ status: 'stopped' });
    expect(count('SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', sessionId)).toBe(0);
  });

  test('halting an empty free-form session during preparation is recorded even though its runner cannot change', () => {
    state().startSession();
    const sessionId = state().session.sessionId;
    expect(state().runner.phase).toBe('complete');
    state().runnerHalt('manual');
    expect(prepRow(sessionId).status).toBe('stopped');
  });

  test('an outcome is final', () => {
    const sessionId = startPlanned();
    state().finishPreparation('already_warm', state().preparation.revision);
    const revision = state().preparation.revision;
    state().finishPreparation('skipped', revision);
    state().recordPreparationItem(0, { status: 'done' }, revision);
    state().beginPreparation(revision);
    expect(prepRow(sessionId)).toMatchObject({ status: 'already_warm', revision });
    expect(itemRows(sessionId).every((item) => item.status === 'pending')).toBe(true);
  });

  test('work far beyond the written dose is recorded as extra work and shown in the summary', () => {
    const sessionId = startPlanned();
    const index = state().preparation.protocol.items.findIndex((item) => item.stage === 'mobilise');
    expect(index).toBeGreaterThan(-1);
    for (let i = 0; i < index; i += 1) state().recordPreparationItem(i, { status: 'done' }, state().preparation.revision);
    const prescribed = itemRows(sessionId)[index].prescribed_amount;
    state().recordPreparationItem(index, { status: 'modified', performedAmount: prescribed * 3 }, state().preparation.revision);
    expect(itemRows(sessionId)[index]).toMatchObject({ status: 'modified', extra_work: 1, performed_amount: prescribed * 3 });
    state().finishPreparation('finished', state().preparation.revision);
    const summary = state().loadSessionPreparation(sessionId);
    expect(summary.status).toBe('modified');
    expect(summary.extraWorkCount).toBe(1);
    // Visible, but never converted into an invented logged set.
    expect(count('SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', sessionId)).toBe(0);
  });
});

describe('duplicate taps, stale writes, restart, discard, reset and reused ids', () => {
  test('a duplicate tap causes exactly one transition', () => {
    const sessionId = startPlanned();
    const revision = state().preparation.revision;
    state().recordPreparationItem(0, { status: 'done' }, revision);
    state().recordPreparationItem(0, { status: 'done' }, revision);
    state().recordPreparationItem(1, { status: 'done' }, revision); // same stale revision, other item
    expect(prepRow(sessionId).revision).toBe(revision + 1);
    expect(itemRows(sessionId).filter((item) => item.status !== 'pending')).toHaveLength(1);

    const finishRevision = state().preparation.revision;
    state().finishPreparation('finished', finishRevision);
    state().finishPreparation('finished', finishRevision);
    expect(prepRow(sessionId).revision).toBe(finishRevision + 1);
    expect(state().error).toBeNull();
  });

  test('a stale revision writes nothing and the screen is re-synced to the stored row', () => {
    const sessionId = startPlanned();
    state().beginPreparation(1);
    const before = JSON.stringify([prepRow(sessionId), itemRows(sessionId)]);
    state().recordPreparationItem(0, { status: 'done' }, 1);      // stale: revision is now 2
    state().finishPreparation('already_warm', 1);                  // stale
    expect(JSON.stringify([prepRow(sessionId), itemRows(sessionId)])).toBe(before);
    expect(state().preparation).toMatchObject({ revision: 2, status: 'in_progress' });
    expect(state().error).toBeNull();
  });

  test('restart resumes the SAME protocol, instance, revision and item records', async () => {
    const sessionId = startPlanned();
    state().beginPreparation(state().preparation.revision);
    state().recordPreparationItem(0, { status: 'done' }, state().preparation.revision);
    state().recordPreparationItem(1, { status: 'skipped', reasonCode: 'discomfort' }, state().preparation.revision);
    const before = JSON.parse(JSON.stringify(state().preparation));

    await boot(); // app killed and relaunched against the same database

    expect(state().session.sessionId).toBe(sessionId);
    expect(JSON.parse(JSON.stringify(state().preparation))).toEqual(before);
    expect(state().preparation.items[0].status).toBe('done');
    expect(state().preparation.items[1]).toMatchObject({ status: 'skipped', reasonCode: 'discomfort' });
    // Still gated, and still writable from where it stopped.
    state().recordPreparationItem(2, { status: 'done' }, state().preparation.revision);
    expect(itemRows(sessionId)[2].status).toBe('done');
  });

  test('discarding an empty session removes its preparation', () => {
    const sessionId = startPlanned();
    state().finishPreparation('already_warm', state().preparation.revision);
    state().runnerHalt('manual');
    state().endSession();
    expect(state().session).toBeNull();
    expect(state().preparation).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM session WHERE session_id = ?', sessionId)).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM session_preparation')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM session_preparation_item')).toBe(0);
  });

  test('discard removes preparation even with foreign keys off (no orphan left under the id)', () => {
    raw().exec('PRAGMA foreign_keys = OFF');
    startPlanned();
    state().runnerHalt('manual');
    state().endSession();
    expect(count('SELECT COUNT(*) AS c FROM session_preparation')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM session_preparation_item')).toBe(0);
  });

  test.each([['ON'], ['OFF']])('reset removes every preparation record (foreign keys %s)', (mode) => {
    raw().exec(`PRAGMA foreign_keys = ${mode}`);
    startPlanned();
    finishAllItems();
    state().finishPreparation('finished', state().preparation.revision);
    useStore.setState({ session: null, runner: null });
    expect(state().resetTrainingData()).toBe(true);
    expect(state().preparation).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM session_preparation')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM session_preparation_item')).toBe(0);
  });

  test('a NEW session that reuses an old session id never inherits the old preparation', () => {
    raw().exec('PRAGMA foreign_keys = OFF');
    state().startSession();
    const firstId = state().session.sessionId;
    state().recordPreparationItem(0, { status: 'done' }, state().preparation.revision);
    const oldPreparation = state().preparation;
    const oldRevision = oldPreparation.revision;
    // The session row disappears without its side-car (a crash or an FK-off
    // delete), leaving an orphan protocol under an id the next session reuses.
    raw().exec('DELETE FROM session_runner_checkpoint; DELETE FROM session_origin; DELETE FROM session');
    expect(count('SELECT COUNT(*) AS c FROM session_preparation')).toBe(1);
    expect(readSessionPreparation(mockDriver, firstId)).toBeNull(); // orphan is not bound to any session
    useStore.setState({ session: null, runner: null, sessionMode: null, sessionPlan: [], preparation: null });

    state().startSession();
    const secondId = state().session.sessionId;
    expect(secondId).toBe(firstId); // the id really is reused
    const fresh = state().preparation;
    expect(fresh.instanceId).not.toBe(oldPreparation.instanceId);
    expect(fresh).toMatchObject({ status: 'pending', revision: 1 });
    expect(fresh.items.every((item) => item.status === 'pending')).toBe(true);
    expect(count('SELECT COUNT(*) AS c FROM session_preparation')).toBe(1);

    // A write that still carries the OLD session's identity — at a revision
    // that happens to be valid for it — must not touch the new protocol.
    const before = JSON.stringify([prepRow(secondId), itemRows(secondId)]);
    raw().exec('BEGIN');
    expect(recordSessionPreparationItem(mockDriver, oldPreparation, oldRevision, 1, { status: 'done' }, Date.now())).toBe(false);
    expect(finishSessionPreparation(mockDriver, oldPreparation, oldRevision, 'completed', Date.now())).toBe(false);
    // Revision 1 is the new row's revision too: the instance id is what refuses it.
    expect(finishSessionPreparation(mockDriver, { ...oldPreparation, status: 'pending' }, 1, 'completed', Date.now())).toBe(false);
    raw().exec('COMMIT');
    expect(JSON.stringify([prepRow(secondId), itemRows(secondId)])).toBe(before);

    // Through the store, with a stale in-memory protocol: nothing changes and the screen re-syncs.
    useStore.setState({ preparation: oldPreparation });
    state().finishPreparation('already_warm', oldRevision);
    expect(JSON.stringify([prepRow(secondId), itemRows(secondId)])).toBe(before);
    expect(state().preparation.instanceId).toBe(fresh.instanceId);
  });
});

describe('holds reach preparation', () => {
  const holdMovement = (movementId) => {
    raw().prepare(`INSERT INTO health_support_hold
      (hold_id,revision,origin,state,reason_code,created_at_ms,updated_at_ms)
      VALUES ('prep-hold',1,'user_requested','held','review_requested',1,1)`).run();
    raw().prepare(`INSERT INTO health_support_scope (scope_id,hold_id,target_kind,movement_id)
      VALUES ('prep-scope','prep-hold','movement',?)`).run(movementId);
  };

  test('a movement held AFTER the protocol was frozen is withheld when the athlete reaches it', () => {
    const sessionId = startPlanned();
    const index = state().preparation.protocol.items.findIndex((item) => item.movementId !== null);
    const movementId = state().preparation.protocol.items[index].movementId;
    for (let i = 0; i < index; i += 1) state().recordPreparationItem(i, { status: 'done' }, state().preparation.revision);
    holdMovement(movementId);
    state().recordPreparationItem(index, { status: 'done' }, state().preparation.revision);
    expect(itemRows(sessionId)[index]).toMatchObject({ status: 'withheld', reason_code: 'restricted_at_execution', performed_amount: null });
    expect(state().error).toMatch(/on hold under your training support settings/);
  });

  test('a niggle reported after start withholds a drill that loads that area', () => {
    state().startSession(); // empty free-form: general protocol with leg swings
    const sessionId = state().session.sessionId;
    const index = state().preparation.protocol.items.findIndex((item) => item.itemId === 'mobilise.leg_swings');
    for (let i = 0; i < index; i += 1) state().recordPreparationItem(i, { status: 'done' }, state().preparation.revision);
    state().reportNiggle('knee', 6);
    state().recordPreparationItem(index, { status: 'done' }, state().preparation.revision);
    expect(itemRows(sessionId)[index]).toMatchObject({ status: 'withheld', reason_code: 'restricted_at_execution' });
    // Skipping stays possible for a restricted item; nothing was performed.
    expect(state().error).toMatch(/active niggle/);
  });

  test('a niggle present at start keeps the affected drill out of the protocol with the reason listed', () => {
    state().reportNiggle('knee', 6);
    state().startSession();
    const protocol = state().preparation.protocol;
    expect(protocol.items.some((item) => item.itemId === 'mobilise.leg_swings')).toBe(false);
    expect(protocol.omitted.some((row) => row.itemId === 'mobilise.leg_swings' && row.reasonCode === 'safety')).toBe(true);
    expect(protocol.items[0].instruction).toMatch(/seated/);
  });

  test('movements 135 and 187 are never prescribed as a preparation drill', () => {
    state().saveProfile({ training_age: 'elite', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'bands', 'boards', 'cable_machine', 'kettlebells', 'pull_up_bar'] });
    // A session made of exactly the two held movements: the policy has to
    // look at both when it searches for a movement to rehearse.
    seedHistory([135, 187]);
    state().startSession();
    expect(state().error).toBeNull();
    const protocol = state().preparation.protocol;
    const planned = state().sessionPlan.map((slot) => slot.movementId);
    expect(planned.filter((movementId) => movementId === 135 || movementId === 187).length).toBeGreaterThan(0);
    expect(protocol.items.every((item) => item.movementId !== 135 && item.movementId !== 187)).toBe(true);
    for (const held of planned) {
      expect(protocol.omitted.some((row) => row.movementId === held && row.reasonCode === 'movement_hold')).toBe(true);
    }
    expect(protocol.items[0].stage).toBe('raise'); // general preparation is still given
  });
});

describe('preparation is not training volume', () => {
  /** One planned APRE session: preparation as given, then one logged main set. */
  const runSession = async (prepare) => {
    mockDriver = makeNodeSqliteDriver();
    await boot();
    state().saveProfile({ training_age: 'intermediate', equipment_inventory: OWNED_EQUIPMENT });
    expect(state().createTrainingProgram({ ...programInput, schemaType: 'APRE' })).toBe(true);
    state().startSession();
    prepare();
    const slot = state().sessionPlan[0];
    for (let set = 0; set < slot.plannedSets; set += 1) {
      state().logSet(slot.movementId, 5, 60, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
      state().skipRunnerRest();
    }
    expect(state().error).toBeNull();
    state().runnerHalt('manual');
    state().endSession();
    expect(state().session).toBeNull();
    const all = (sql) => raw().prepare(sql).all();
    return {
      sets: all('SELECT movement_id, set_index, reps, load_kg, rpe FROM set_record ORDER BY set_id'),
      setTargets: all('SELECT provenance_kind, target_rpe FROM set_target ORDER BY set_id'),
      oneRepMax: all('SELECT movement_id, load_kg FROM one_rep_max ORDER BY movement_id'),
      plannedSlots: all('SELECT planned_slot_id, movement_id, sets, reps, target_rpe FROM planned_slot ORDER BY planned_slot_id'),
      // APRE's next-week load decisions live here.
      slotOverrides: all('SELECT planned_slot_id, target_load_kg, reason FROM slot_override ORDER BY planned_slot_id'),
      evidence: all('SELECT movement_id, qualifying_sets, minimum_value, maximum_rpe FROM capability_session_evidence ORDER BY movement_id'),
      mech: all('SELECT * FROM mech_daily ORDER BY 1'),
      lastLoads: JSON.stringify(state().lastLoggedLoads),
    };
  };

  test('heavy, extra preparation leaves sets, APRE progression, 1RM, capability evidence and load history identical to skipping it', async () => {
    const skipped = await runSession(() => state().finishPreparation('skipped', state().preparation.revision));
    const heavy = await runSession(() => {
      state().beginPreparation(state().preparation.revision);
      for (const item of state().preparation.items) {
        state().recordPreparationItem(item.index, {
          status: 'modified', performedAmount: 50, performedLoadKg: 250, reasonCode: 'athlete_choice',
        }, state().preparation.revision);
      }
      state().finishPreparation('finished', state().preparation.revision);
      expect(count('SELECT COUNT(*) AS c FROM session_preparation_item WHERE extra_work = 1')).toBeGreaterThan(0);
      expect(count('SELECT COUNT(*) AS c FROM session_preparation_item WHERE performed_load_kg = 250')).toBeGreaterThan(0);
    });
    expect(heavy).toEqual(skipped);
    expect(heavy.sets.length).toBeGreaterThan(0);
    expect(heavy.sets.every((row) => row.load_kg === 60)).toBe(true);
  });
});

describe('no fabricated preparation history', () => {
  test('demo, finished and seeded sessions have no preparation record', () => {
    expect(state().loadDemoAthlete()).not.toBe('blocked_existing_data');
    const demoSessions = raw().prepare('SELECT session_id FROM session ORDER BY session_id').all();
    expect(demoSessions.length).toBeGreaterThan(1);
    expect(count('SELECT COUNT(*) AS c FROM session_preparation')).toBe(0);
    for (const row of demoSessions) expect(state().loadSessionPreparation(Number(row.session_id))).toBeNull();
    // An imported-style finished session added afterwards is the same.
    raw().exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (9000, NULL, '2026-01-05', 1000, 40)");
    expect(state().loadSessionPreparation(9000)).toBeNull();
    // And the schema refuses to attach one to any of them after the fact.
    expect(() => raw().prepare(`INSERT INTO session_preparation
      (session_id, instance_id, session_started_at_ms, policy_id, policy_revision, protocol_version,
       protocol_json, item_count, estimate_low_seconds, estimate_high_seconds, status, revision,
       created_at_ms, updated_at_ms, finished_at_ms)
      VALUES (9000, 'fabricated-1', 1000, 'ramp-general', 1, 1, '{}', 1, 60, 60, 'pending', 1, 1000, 1000, NULL)`).run())
      .toThrow(/only be created pending for a live session/);
  });

  test('a session that was already in progress before 065 resumes with no protocol and is not gated', async () => {
    seedHistory([idOf('Push-up')]);
    state().startSession();
    const sessionId = state().session.sessionId;
    // The shape of a session started on the previous build: no side-car rows.
    raw().exec('DELETE FROM session_preparation_item; DELETE FROM session_preparation');
    await boot();
    expect(state().session.sessionId).toBe(sessionId);
    expect(state().preparation).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM session_preparation')).toBe(0); // none invented on resume
    const slot = state().sessionPlan[0];
    state().logSet(slot.movementId, 5, 0, 7, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
    expect(state().error).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', sessionId)).toBe(1);
    expect(state().loadSessionPreparation(sessionId)).toBeNull();
  });
});
