/**
 * Android walk 2026-11-03 (W5-2, W5-5, W5-11), issues #179, #181 and #187.
 *
 * A Stop reached through "Report discomfort" halted the running session only.
 * Today, READY and Plan then invited training, and Start session, the WORKOUT
 * tab and Today's extra session each started a new session at once. A Plan
 * report at the same level halts the whole day.
 *
 * Ruling 2026-11-05: a report-driven Stop records the day halt a Plan halt
 * records (subjective_report.halt), closes the running session, and the
 * completion summary names each report's region and severity. A manual
 * "Stop session" does not halt the day.
 *
 * Store tests run the REAL store over the production migration chain
 * (node:sqlite stands in for op-sqlite), as in SessionFeelStore.test.js.
 */
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import { buildSessionSummary } from '../../src/state/sessionSummary';
import { isSessionReportStop, SESSION_REPORT_STOP_SENTENCE } from '../../src/state/sessionReportStop';
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

// The first heavy module load in a fresh jest worker is slow.
jest.setTimeout(60_000);

const state = () => useStore.getState();
const raw = () => mockDriver.raw;
const count = (sql, ...params) => Number(raw().prepare(sql).get(...params).c);
const idOf = (name) => Number(raw().prepare('SELECT movement_id FROM movement WHERE name = ?').get(name).movement_id);
const dayHalted = () => state().lastTriage?.kind === 'matched' && state().lastTriage.directive.halt === true;

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

const setAge = (trainingAge) => state().saveProfile({
  training_age: trainingAge, equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'],
});

beforeEach(async () => {
  authorizeAthleteDataBoot();
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDriver = makeNodeSqliteDriver();
  await boot();
  setAge('intermediate');
  // An earlier session, so a free-form start has a movement to repeat.
  raw().exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (9000, NULL, '2026-01-05', 1000, 40)");
  raw().prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (9000, ?, 1, 5, 40, 7, 2000)')
    .run(idOf('Push-up'));
});

afterEach(() => { jest.restoreAllMocks(); });

/** Start a session, pass preparation, optionally log one set. Returns its id. */
const startWorking = ({ logOne = true } = {}) => {
  state().startSession();
  expect(state().session).not.toBeNull();
  const sessionId = state().session.sessionId;
  state().finishPreparation('already_warm', state().preparation.revision);
  useStore.setState({ error: null });
  if (logOne) {
    const slot = state().sessionPlan[0];
    state().logSet(slot.movementId, 5, 0, 7, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
    expect(state().error).toBeNull();
    state().skipRunnerRest();
  }
  expect(state().runner.phase).toBe('working');
  return sessionId;
};

describe('a Stop reached through Report discomfort closes the day', () => {
  test('the report records a day halt, closes the session, and no new session starts today', () => {
    const sessionId = startWorking();
    expect(state().reportNiggle('wrist', 8)).toBe(true);

    // The day halt, in the same table a Plan halt uses.
    const halts = raw().prepare('SELECT * FROM subjective_report WHERE halt = 1').all();
    expect(halts).toHaveLength(1);
    expect(halts[0].matched_entry_id).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM report_severity WHERE report_id = ? AND severity = 8', halts[0].report_id)).toBe(1);
    expect(dayHalted()).toBe(true);
    expect(isSessionReportStop(state().lastTriage)).toBe(true);
    expect(state().lastTriage.directive.vector.coaching_cue).toContain(SESSION_REPORT_STOP_SENTENCE);

    // The session is closed and recorded as stopped.
    expect(state().session).toBeNull();
    expect(state().lastEndedSessionId).toBe(sessionId);
    expect(raw().prepare('SELECT outcome_kind FROM session_outcome WHERE session_id = ?').get(sessionId).outcome_kind)
      .toBe('stopped_safely');

    // Every start is refused for the rest of the day.
    state().startSession();
    expect(state().session).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM session WHERE session_id <> 9000')).toBe(1);
  });

  test('a Stop with no sets logged still closes the day', () => {
    startWorking({ logOne: false });
    expect(state().reportNiggle('knee', 8)).toBe(true);
    expect(state().session).toBeNull();
    expect(dayHalted()).toBe(true);
    state().startSession();
    expect(state().session).toBeNull();
  });

  test('the day halt survives a restart', async () => {
    startWorking();
    state().reportNiggle('wrist', 8);
    await boot();
    expect(dayHalted()).toBe(true);
    expect(isSessionReportStop(state().lastTriage)).toBe(true);
    state().startSession();
    expect(state().session).toBeNull();
  });

  test('the stop level follows the athlete: Moderate stops an elite session and the day', () => {
    setAge('elite');
    startWorking();
    expect(state().reportNiggle('shoulder', 6)).toBe(true);
    expect(state().session).toBeNull();
    expect(dayHalted()).toBe(true);
  });

  test('a report below the stop level halts neither the session nor the day', () => {
    startWorking();
    expect(state().reportNiggle('wrist', 4)).toBe(true);
    expect(state().session).not.toBeNull();
    expect(dayHalted()).toBe(false);
    expect(count('SELECT COUNT(*) AS c FROM subjective_report')).toBe(0);
  });

  test('the completion summary names each report, its region and severity', () => {
    const sessionId = startWorking();
    state().reportNiggle('wrist', 4);
    state().closeSubstitution();
    state().reportNiggle('lower_back', 8);
    const facts = state().loadSessionSummaryFacts(sessionId);
    expect(facts.reports).toEqual([
      { region: 'wrist', severity: 4 },
      { region: 'lower_back', severity: 8 },
    ]);
    const view = buildSessionSummary({
      exercises: facts.exercises, previousSets: facts.previousSets, durationMin: facts.durationMin,
      blockSessions: [], today: '2026-11-05', reports: facts.reports,
    });
    expect(view.reportLines.map((line) => line.text)).toEqual([
      'Report: Wrist · Mild (4 of 10)',
      'Report: Lower back · Stop (8 of 10)',
    ]);
  });
});

describe('a manual Stop session does not halt the day', () => {
  test('after a manual stop a new session starts', () => {
    startWorking();
    state().runnerHalt('manual');
    state().endSession();
    expect(state().session).toBeNull();
    expect(dayHalted()).toBe(false);
    expect(count('SELECT COUNT(*) AS c FROM subjective_report')).toBe(0);
    state().startSession();
    expect(state().session).not.toBeNull();
  });

  test('a manual stop with no sets is discarded and a new session starts', () => {
    startWorking({ logOne: false });
    state().runnerHalt('manual');
    state().endSession();
    expect(state().lastEndedSessionId).toBeNull();
    state().startSession();
    expect(state().session).not.toBeNull();
  });
});
