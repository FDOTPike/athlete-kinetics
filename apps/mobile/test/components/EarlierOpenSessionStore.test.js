/**
 * EarlierOpenSessionStore.test.js — a workout the app never closed (issue 191).
 *
 * Behavioural tests of the REAL zustand store over the production migration
 * chain (node:sqlite stands in for the op-sqlite handle only). A workout left
 * open on an earlier day is not in memory and is never restored, so it is
 * simulated here by starting a real workout, moving its date back, and clearing
 * the in-memory session, which is what a restart on a later day leaves behind.
 *
 *   - an earlier open workout is listed, with its logged sets and its date;
 *   - finishing it keeps its logged sets, keeps its date, and records it as a
 *     recorded session (not "stopped safely") unless a directive safety halt
 *     happened, which keeps "stopped safely";
 *   - discarding it removes only an empty workout and its rows, never one with
 *     logged sets or a safety stop;
 *   - starting another workout refuses, and says why, while one is open;
 *   - a same-day open workout still resumes on boot, as before.
 */
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
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

const EARLIER = '2026-01-05';
const state = () => useStore.getState();
const raw = () => mockDriver.raw;
const count = (sql, ...params) => Number(raw().prepare(sql).get(...params).c);
const idOf = (name) => Number(raw().prepare('SELECT movement_id FROM movement WHERE name = ?').get(name).movement_id);
const sessionRow = (sessionId) => raw().prepare('SELECT * FROM session WHERE session_id = ?').get(sessionId);
const outcomeRow = (sessionId) => raw().prepare('SELECT * FROM session_outcome WHERE session_id = ?').get(sessionId);
const checkpointCount = (sessionId) => count('SELECT COUNT(*) AS c FROM session_runner_checkpoint WHERE session_id = ?', sessionId);

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
  state().saveProfile({ training_age: 'intermediate', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'] });
  // A finished earlier workout gives a free-form start something to repeat.
  raw().exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (9000, NULL, '2026-01-04', 1000, 40)");
  raw().prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (9000, ?, 1, 5, 40, 7, 2000)')
    .run(idOf('Push-up'));
});

afterEach(() => { jest.restoreAllMocks(); });

/** Start a free-form workout today; returns its id. */
const startToday = () => {
  state().startSession();
  expect(state().error).toBeNull();
  const sessionId = state().session.sessionId;
  return sessionId;
};

/** Move a workout's date back to the earlier day. The database refuses this once
 *  a set exists, so it is done before any set is logged, as a real earlier-day
 *  workout would have been dated when it began. */
const backdate = (sessionId) => {
  raw().prepare('UPDATE session SET session_date = ? WHERE session_id = ?').run(EARLIER, sessionId);
};

/** Start a workout, date it on the earlier day, and log one set in it; returns its id. */
const startWithOneLoggedSet = (onEarlierDay = true) => {
  const sessionId = startToday();
  if (onEarlierDay) backdate(sessionId);
  const slot = state().sessionPlan[0];
  state().finishPreparation('already_warm', state().preparation.revision);
  useStore.setState({ error: null });
  state().logSet(slot.movementId, 5, 0, 7, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
  expect(state().error).toBeNull();
  return sessionId;
};

/** What a restart on a later day leaves: the workout is open, dated earlier,
 *  and no longer in memory. */
const leaveEarlierOpen = (sessionId) => {
  if (sessionRow(sessionId).session_date !== EARLIER) backdate(sessionId);
  useStore.setState({
    session: null, runner: null, sessionMode: null, sessionPlan: [], preparation: null,
    activeSessionPlanSlotId: null, activeMovementId: null, activeSessionAccessContext: null,
    error: null,
  });
  state().refreshEarlierOpenSessions();
};

describe('an earlier workout the app never closed is listed', () => {
  test('it shows its date, its logged sets, and what can be done with it', () => {
    const sessionId = startWithOneLoggedSet();
    leaveEarlierOpen(sessionId);
    expect(state().earlierOpenSessions).toEqual([
      { sessionId, sessionDate: EARLIER, loggedSetCount: 1, safetyStop: false, canDiscard: false },
    ]);
  });

  test('an empty earlier workout can be discarded and is listed as such', () => {
    const sessionId = startToday();
    leaveEarlierOpen(sessionId);
    expect(state().earlierOpenSessions).toEqual([
      { sessionId, sessionDate: EARLIER, loggedSetCount: 0, safetyStop: false, canDiscard: true },
    ]);
  });

  test('today\'s own workout is never listed as earlier', () => {
    startToday();
    state().refreshEarlierOpenSessions();
    expect(state().earlierOpenSessions).toEqual([]);
  });
});

describe('finishing an earlier workout keeps what was logged', () => {
  test('its sets and its date are kept, and it is recorded as a recorded session', () => {
    const sessionId = startWithOneLoggedSet();
    leaveEarlierOpen(sessionId);

    expect(state().finishEarlierSession(sessionId)).toBe(true);
    expect(state().error).toBeNull();

    expect(sessionRow(sessionId).session_date).toBe(EARLIER);
    expect(sessionRow(sessionId).duration_min).not.toBeNull();
    expect(sessionRow(sessionId).duration_min).toBeLessThan(60);
    expect(count('SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', sessionId)).toBe(1);
    expect(outcomeRow(sessionId)).toMatchObject({
      outcome_kind: 'session_recorded', terminal_phase: 'complete', halt_reason: null, logged_set_count: 1,
    });
    expect(checkpointCount(sessionId)).toBe(0);
    expect(state().earlierOpenSessions).toEqual([]);
  });

  test('a manual stop is recorded as a recorded session, not as stopped safely', () => {
    const sessionId = startWithOneLoggedSet();
    state().runnerHalt('manual');
    leaveEarlierOpen(sessionId);

    expect(state().finishEarlierSession(sessionId)).toBe(true);
    expect(outcomeRow(sessionId)).toMatchObject({ outcome_kind: 'session_recorded', terminal_phase: 'complete', halt_reason: null });
  });

  test('a directive safety halt keeps its stopped-safely outcome', () => {
    const sessionId = startWithOneLoggedSet();
    state().runnerHalt('safety');
    leaveEarlierOpen(sessionId);
    expect(state().earlierOpenSessions[0].safetyStop).toBe(true);

    expect(state().finishEarlierSession(sessionId)).toBe(true);
    expect(sessionRow(sessionId).session_date).toBe(EARLIER);
    expect(outcomeRow(sessionId)).toMatchObject({ outcome_kind: 'stopped_safely', terminal_phase: 'halted', halt_reason: 'safety' });
  });

  test('an empty workout is not finished: it has nothing to keep, so it is discarded instead', () => {
    const sessionId = startToday();
    leaveEarlierOpen(sessionId);

    expect(state().finishEarlierSession(sessionId)).toBe(false);
    expect(state().error).toMatch(/discard/i);
    expect(sessionRow(sessionId)).toBeDefined();
    expect(checkpointCount(sessionId)).toBe(1);
  });

  test('a safety stop with no sets is finished and kept, never discarded', () => {
    const sessionId = startToday();
    state().runnerHalt('safety');
    leaveEarlierOpen(sessionId);
    expect(state().earlierOpenSessions[0]).toMatchObject({ canDiscard: false, safetyStop: true });

    expect(state().discardEarlierSession(sessionId)).toBe(false);
    expect(sessionRow(sessionId)).toBeDefined();

    expect(state().finishEarlierSession(sessionId)).toBe(true);
    expect(outcomeRow(sessionId)).toMatchObject({ outcome_kind: 'stopped_safely', logged_set_count: 0 });
  });
});

describe('discarding an earlier workout removes only an empty one', () => {
  test('an empty workout is removed with its rows, in one step', () => {
    const sessionId = startToday();
    leaveEarlierOpen(sessionId);

    expect(state().discardEarlierSession(sessionId)).toBe(true);
    expect(state().error).toBeNull();
    expect(sessionRow(sessionId)).toBeUndefined();
    expect(count('SELECT COUNT(*) AS c FROM session_origin WHERE session_id = ?', sessionId)).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM session_plan_slot WHERE session_id = ?', sessionId)).toBe(0);
    expect(checkpointCount(sessionId)).toBe(0);
    expect(state().earlierOpenSessions).toEqual([]);
  });

  test('a workout with logged sets is refused and stays open, with its sets', () => {
    const sessionId = startWithOneLoggedSet();
    leaveEarlierOpen(sessionId);

    expect(state().discardEarlierSession(sessionId)).toBe(false);
    expect(state().error).toMatch(/only an empty workout/i);
    expect(sessionRow(sessionId)).toBeDefined();
    expect(count('SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', sessionId)).toBe(1);
    expect(checkpointCount(sessionId)).toBe(1);
  });
});

describe('starting another workout first resolves the earlier one', () => {
  test('the start is refused, says what to do, and opens no session', () => {
    const sessionId = startToday();
    leaveEarlierOpen(sessionId);

    state().startSession();

    expect(state().session).toBeNull();
    expect(state().error).toMatch(/finish or discard/i);
    expect(count("SELECT COUNT(*) AS c FROM session WHERE session_date = ? AND duration_min IS NULL", state().today)).toBe(0);
    expect(state().earlierOpenSessions).toHaveLength(1);
  });

  test('once the earlier workout is resolved, today\'s workout starts', () => {
    const sessionId = startToday();
    leaveEarlierOpen(sessionId);
    expect(state().discardEarlierSession(sessionId)).toBe(true);

    state().startSession();
    expect(state().error).toBeNull();
    expect(state().session).not.toBeNull();
  });
});

describe('a same-day open workout still resumes', () => {
  test('after a restart on the same day, the open workout is restored as it was', async () => {
    const sessionId = startWithOneLoggedSet(false);
    useStore.setState({ session: null, runner: null, sessionPlan: [], preparation: null });

    await boot();

    expect(state().session?.sessionId).toBe(sessionId);
    expect(state().earlierOpenSessions).toEqual([]);
    expect(sessionRow(sessionId).session_date).toBe(state().today);
  });
});
