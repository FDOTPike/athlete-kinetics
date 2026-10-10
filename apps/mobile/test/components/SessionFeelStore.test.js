/**
 * SessionFeelStore.test.js — how a finished session went, and why (070).
 *
 * Behavioural tests of the REAL zustand store, booted by the production boot
 * path over the production migration chain (node:sqlite stands in for the
 * op-sqlite handle only). They pin the store contract:
 *
 *   - only a finished session can carry an answer;
 *   - the pure rule decides what is saved: a refused answer writes nothing;
 *   - the answer and the typed note are saved together, and the note is
 *     stored as typed (outer whitespace trimmed, nothing else touched);
 *   - an answer can be corrected, and an empty note leaves an earlier one alone;
 *   - saving is a record only: it changes no prescription, plan, set or report;
 *   - reset clears the answers with the sessions they describe.
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

const state = () => useStore.getState();
const raw = () => mockDriver.raw;
const count = (sql, ...params) => Number(raw().prepare(sql).get(...params).c);
const feelRow = (sessionId) => raw().prepare('SELECT * FROM session_feel WHERE session_id = ?').get(sessionId);
const noteRow = (sessionId) => raw().prepare('SELECT * FROM session_note WHERE session_id = ?').get(sessionId);
const idOf = (name) => Number(raw().prepare('SELECT movement_id FROM movement WHERE name = ?').get(name).movement_id);

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
});

afterEach(() => { jest.restoreAllMocks(); });

/** One finished free-form session with a single logged set. Returns its id.
 *  An earlier session is seeded so the free-form start has a movement to repeat. */
const finishOneSession = () => {
  raw().exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (9000, NULL, '2026-01-05', 1000, 40)");
  raw().prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (9000, ?, 1, 5, 40, 7, 2000)')
    .run(idOf('Push-up'));
  state().startSession();
  const sessionId = state().session.sessionId;
  const slot = state().sessionPlan[0];
  state().finishPreparation('already_warm', state().preparation.revision);
  useStore.setState({ error: null });
  state().logSet(slot.movementId, 5, 0, 7, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
  expect(state().error).toBeNull();
  state().skipRunnerRest();
  state().runnerHalt('manual');
  state().endSession();
  expect(state().error).toBeNull();
  expect(state().lastEndedSessionId).toBe(sessionId);
  return sessionId;
};

/** Everything a plan, a prescription or a progression could read. */
const trainingFacts = () => JSON.stringify({
  prescription: state().prescription,
  todayPlan: state().todayPlan,
  sets: raw().prepare('SELECT * FROM set_record ORDER BY set_id').all(),
  sessions: raw().prepare('SELECT * FROM session ORDER BY session_id').all(),
  outcomes: raw().prepare('SELECT * FROM session_outcome ORDER BY session_id').all(),
  reports: raw().prepare('SELECT * FROM subjective_report ORDER BY report_id').all(),
  niggles: raw().prepare('SELECT * FROM niggle ORDER BY reported_at_ms').all(),
  plannedSlots: raw().prepare('SELECT * FROM planned_slot ORDER BY planned_slot_id').all(),
  overrides: raw().prepare('SELECT * FROM slot_override ORDER BY planned_slot_id').all(),
});

describe('only a finished session carries an answer', () => {
  test('with no ended session nothing is saved', () => {
    expect(state().lastEndedSessionId).toBeNull();
    expect(state().saveSessionFeel({ feel: 'as_planned', reasons: [] }, 'note')).toBe('not_saved');
    expect(count('SELECT COUNT(*) AS c FROM session_feel')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM session_note')).toBe(0);
  });

  test('a session id with no outcome reads as nothing to ask and nothing saved', () => {
    expect(state().loadSessionFeel(123456)).toEqual({ ask: false, saved: null, note: null });
  });

  test('a finished free-form session is asked about, with nothing saved yet', () => {
    const sessionId = finishOneSession();
    expect(state().loadSessionFeel(sessionId)).toEqual({ ask: true, saved: null, note: null });
  });
});

describe('the pure rule decides what is saved', () => {
  test('a refused answer writes neither the answer nor the note', () => {
    const sessionId = finishOneSession();
    expect(state().saveSessionFeel({ feel: null, reasons: [] }, 'a note')).toBe('feel_required');
    expect(state().saveSessionFeel({ feel: 'harder', reasons: [] }, 'a note')).toBe('reason_required');
    expect(state().saveSessionFeel({ feel: 'awful', reasons: ['tired'] }, 'a note')).toBe('unknown_value');
    expect(feelRow(sessionId)).toBeUndefined();
    expect(noteRow(sessionId)).toBeUndefined();
  });

  test('a valid answer and its note are saved together and read back', () => {
    const sessionId = finishOneSession();
    const typed = '  No chest pain today. Left knee 3/10 on the last set??  ';
    expect(state().saveSessionFeel({ feel: 'harder', reasons: ['unwell', 'tired'] }, typed)).toBeNull();
    expect(feelRow(sessionId)).toMatchObject({
      feel: 'harder', reason_tired: 1, reason_unwell: 1,
      reason_pain: 0, reason_technique: 0, reason_equipment: 0, reason_time: 0, reason_felt_good: 0, reason_other: 0,
    });
    // Stored as typed: outer whitespace trimmed, nothing else touched.
    expect(noteRow(sessionId).note).toBe('No chest pain today. Left knee 3/10 on the last set??');
    expect(state().loadSessionFeel(sessionId)).toEqual({
      ask: true,
      saved: { feel: 'harder', reasons: ['tired', 'unwell'] },
      note: 'No chest pain today. Left knee 3/10 on the last set??',
    });
  });

  test('an answer can be corrected; "as planned" clears the reasons; an empty note keeps the earlier one', () => {
    const sessionId = finishOneSession();
    expect(state().saveSessionFeel({ feel: 'stopped_early', reasons: ['pain'] }, 'shoulder pinched')).toBeNull();
    expect(state().saveSessionFeel({ feel: 'as_planned', reasons: ['pain'] }, '   ')).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM session_feel WHERE session_id = ?', sessionId)).toBe(1);
    expect(feelRow(sessionId)).toMatchObject({ feel: 'as_planned', reason_pain: 0 });
    expect(noteRow(sessionId).note).toBe('shoulder pinched');
    expect(state().loadSessionFeel(sessionId).saved).toEqual({ feel: 'as_planned', reasons: [] });
  });
});

describe('a note on its own', () => {
  test('the note writer saves a note with no answer, and the loader reads it back', () => {
    const sessionId = finishOneSession();
    state().saveSessionNote('  new shoes felt good  ');
    expect(feelRow(sessionId)).toBeUndefined();
    expect(noteRow(sessionId).note).toBe('new shoes felt good');
    expect(state().loadSessionFeel(sessionId)).toEqual({ ask: true, saved: null, note: 'new shoes felt good' });
  });
});

describe('a record, not a decision', () => {
  test('saving changes no prescription, plan, set, outcome, report or niggle', () => {
    const sessionId = finishOneSession();
    const before = trainingFacts();
    expect(state().saveSessionFeel({ feel: 'harder', reasons: ['pain', 'unwell'] }, 'chest pain and dizzy')).toBeNull();
    expect(trainingFacts()).toBe(before);
    expect(state().lastTriage).toBeNull();
    expect(state().lastEndedSessionId).toBe(sessionId);
  });

  test('reset clears the answers with the sessions they describe', () => {
    const sessionId = finishOneSession();
    expect(state().saveSessionFeel({ feel: 'easier', reasons: ['felt_good'] }, '')).toBeNull();
    expect(feelRow(sessionId)).toBeDefined();
    expect(state().resetTrainingData()).toBe(true);
    expect(count('SELECT COUNT(*) AS c FROM session_feel')).toBe(0);
  });
});
