/**
 * Android walk 2026-11-03 (ux-8): the completion screen listed only the
 * exercises with logged sets. An exercise the athlete chose to skip vanished
 * from the record of the session, although the timeline had shown
 * "Skipped: Bodyweight Squat · no sets logged" a moment before.
 *
 * Store tests run the REAL store over the production migration chain
 * (node:sqlite stands in for op-sqlite), as in SessionFeelStore.test.js.
 */
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import { buildSessionSummary } from '../../src/state/sessionSummary';
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

jest.setTimeout(60_000);

const state = () => useStore.getState();
const raw = () => mockDriver.raw;
const idOf = (name) => Number(raw().prepare('SELECT movement_id FROM movement WHERE name = ?').get(name).movement_id);

beforeEach(async () => {
  authorizeAthleteDataBoot();
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({ status: 'booting', error: null, session: null, runner: null, lastEndedSessionId: null });
  state().boot();
  for (let i = 0; i < 500 && state().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  expect(state().status).toBe('ready');
});

const seedSession = () => {
  raw().exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (7000, NULL, '2026-11-03', 1000, 30)");
  const slot = raw().prepare(
    "INSERT INTO session_plan_slot (session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind) VALUES (7000, ?, ?, ?, 10, 'added')",
  );
  slot.run(0, idOf('Goblet Squat'), 3);
  slot.run(1, idOf('Push-up'), 2);
  slot.run(2, idOf('Walking Lunge'), 2);
  const slotId = (index) => Number(raw().prepare('SELECT session_plan_slot_id AS id FROM session_plan_slot WHERE session_id = 7000 AND slot_index = ?').get(index).id);
  raw().prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (7000, ?, 1, 10, 16, 7, 2000)')
    .run(idOf('Goblet Squat'));
  raw().prepare('INSERT INTO session_skipped_slot (session_plan_slot_id) VALUES (?)').run(slotId(2));
  raw().prepare('INSERT INTO session_skipped_slot (session_plan_slot_id) VALUES (?)').run(slotId(1));
};

test('the summary facts name the skipped exercises, in plan order', () => {
  seedSession();
  const facts = state().loadSessionSummaryFacts(7000);
  expect(facts.skippedExercises).toEqual(['Push-up', 'Walking Lunge']);
  expect(facts.exercises.map((exercise) => exercise.movementName)).toEqual(['Goblet Squat']);
});

test('a session with nothing skipped reports an empty list', () => {
  raw().exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (7001, NULL, '2026-11-03', 1000, 30)");
  expect(state().loadSessionSummaryFacts(7001).skippedExercises).toEqual([]);
});

test('the summary view gives each skipped exercise its own line, in the timeline wording', () => {
  const view = buildSessionSummary({
    exercises: [],
    previousSets: [],
    durationMin: null,
    blockSessions: [],
    today: '2026-11-03',
    skippedExercises: ['Push-up', 'Walking Lunge'],
  });
  expect(view.skippedLines.map((line) => line.text)).toEqual([
    'Skipped: Push-up · no sets logged',
    'Skipped: Walking Lunge · no sets logged',
  ]);
  expect(new Set(view.skippedLines.map((line) => line.key)).size).toBe(2);
});

test('without skipped exercises the view has no skipped lines', () => {
  const view = buildSessionSummary({
    exercises: [], previousSets: [], durationMin: null, blockSessions: [], today: '2026-11-03',
  });
  expect(view.skippedLines).toEqual([]);
});
