/**
 * Android walk 2026-11-03 (ux-8): the completion screen listed only the
 * exercises with logged sets. An exercise the athlete chose to skip vanished
 * from the record of the session, although the timeline had shown
 * "Skipped: Bodyweight Squat · no sets logged" a moment before.
 *
 * Owner ruling (PROMPT_LEDGER.md Entry 0300; the original 2026-11-03 Entry
 * 0286 is unrecovered, issue #297): the completion summary may read 071
 * session_skipped_slot. It is the one reader; no engine reads it.
 *
 * Store tests run the REAL store over the production migration chain
 * (node:sqlite stands in for op-sqlite), as in SessionFeelStore.test.js.
 */
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import { buildSessionSummary, skippedExerciseText } from '../../src/state/sessionSummary';
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

const slotId = (index) => Number(raw().prepare(
  'SELECT session_plan_slot_id AS id FROM session_plan_slot WHERE session_id = 7000 AND slot_index = ?',
).get(index).id);

let nextSetIndex = 1;
const logSet = (movementName, slotIndex) => {
  const { lastInsertRowid } = raw().prepare(
    'INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (7000, ?, ?, 10, 16, 7, 2000)',
  ).run(idOf(movementName), nextSetIndex);
  nextSetIndex += 1;
  if (slotIndex !== undefined) {
    raw().prepare("INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind) VALUES (?, ?, 'added')")
      .run(Number(lastInsertRowid), slotId(slotIndex));
  }
};

const seedSession = () => {
  nextSetIndex = 1;
  raw().exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (7000, NULL, '2026-11-03', 1000, 30)");
  const slot = raw().prepare(
    "INSERT INTO session_plan_slot (session_id, slot_index, movement_id, planned_sets, planned_reps, provenance_kind) VALUES (7000, ?, ?, ?, 10, 'added')",
  );
  slot.run(0, idOf('Goblet Squat'), 3);
  slot.run(1, idOf('Push-up'), 2);
  slot.run(2, idOf('Walking Lunge'), 2);
  logSet('Goblet Squat');
};
const skip = (slotIndex) => raw().prepare('INSERT INTO session_skipped_slot (session_plan_slot_id) VALUES (?)').run(slotId(slotIndex));

test('the summary facts name the skipped exercises, in plan order', () => {
  seedSession();
  skip(2);
  skip(1);
  const facts = state().loadSessionSummaryFacts(7000);
  expect(facts.skippedExercises).toEqual([
    { name: 'Push-up', plannedSets: 2, loggedSets: 0, loggedAs: [] },
    { name: 'Walking Lunge', plannedSets: 2, loggedSets: 0, loggedAs: [] },
  ]);
  expect(facts.exercises.map((exercise) => exercise.movementName)).toEqual(['Goblet Squat']);
});

// CodeRabbit on PR 116: "no sets logged" was false when the athlete logged a
// set and then skipped the rest. Sets are counted as the timeline counts them.
test('sets logged before a skip are counted, by slot or else by movement', () => {
  seedSession();
  logSet('Push-up');                  // no slot link: counted by movement
  logSet('Bodyweight Squat', 2);      // a swap logged into the lunge slot
  skip(1);
  skip(2);
  const facts = state().loadSessionSummaryFacts(7000);
  expect(facts.skippedExercises).toEqual([
    { name: 'Push-up', plannedSets: 2, loggedSets: 1, loggedAs: [] },
    { name: 'Walking Lunge', plannedSets: 2, loggedSets: 1, loggedAs: ['Bodyweight Squat'] },
  ]);
});

// Android walk 2026-11-03 (W2-1): a swap before any set rewrites the slot's
// movement and keeps the planned one in original_movement_id. The line named
// the replacement as if it were the skipped plan ("Skipped: Dumbbell Romanian
// Deadlift · 1 of 3 sets logged"); it names the planned exercise.
test('a slot swapped before its first set is named by its planned exercise', () => {
  seedSession();
  const swap = raw().prepare(
    // An added slot keeps its provenance when swapped, as the store does.
    'UPDATE session_plan_slot SET movement_id = ?, original_movement_id = ? WHERE session_plan_slot_id = ?',
  );
  swap.run(idOf('Bodyweight Squat'), idOf('Walking Lunge'), slotId(2));
  swap.run(idOf('Dumbbell Squat'), idOf('Push-up'), slotId(1));
  logSet('Bodyweight Squat', 2);
  logSet('Dumbbell Squat');           // no slot link: counted by the slot's current movement
  skip(1);
  skip(2);
  const facts = state().loadSessionSummaryFacts(7000);
  expect(facts.skippedExercises).toEqual([
    { name: 'Push-up', plannedSets: 2, loggedSets: 1, loggedAs: ['Dumbbell Squat'] },
    { name: 'Walking Lunge', plannedSets: 2, loggedSets: 1, loggedAs: ['Bodyweight Squat'] },
  ]);
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
    skippedExercises: [
      { name: 'Push-up', plannedSets: 2, loggedSets: 0, loggedAs: [] },
      { name: 'Walking Lunge', plannedSets: 3, loggedSets: 1, loggedAs: [] },
      { name: 'Goblet Squat', plannedSets: 3, loggedSets: 2, loggedAs: ['Bodyweight Squat'] },
    ],
  });
  expect(view.skippedLines.map((line) => line.text)).toEqual([
    'Skipped: Push-up · no sets logged',
    'Skipped: Walking Lunge · 1 of 3 sets logged',
    'Skipped: Goblet Squat · 2 of 3 sets logged as Bodyweight Squat',
  ]);
  expect(new Set(view.skippedLines.map((line) => line.key)).size).toBe(3);
});

test('the completion card and the summary share one wording', () => {
  expect(skippedExerciseText({ name: 'Push-up', plannedSets: 2, loggedSets: 0, loggedAs: [] }))
    .toBe('Skipped: Push-up · no sets logged');
});

test('without skipped exercises the view has no skipped lines', () => {
  const view = buildSessionSummary({
    exercises: [], previousSets: [], durationMin: null, blockSessions: [], today: '2026-11-03',
  });
  expect(view.skippedLines).toEqual([]);
});

// Android walk 2026-11-03 (W2-6): the summary listed exercises by movement
// id, not in the order they were done.
test('the summary lists exercises in the order they were logged', () => {
  seedSession();                      // logs Goblet Squat first
  const later = ['Walking Lunge', 'Push-up', 'Bodyweight Squat'].sort((a, b) => idOf(b) - idOf(a));
  for (const name of later) logSet(name);
  const facts = state().loadSessionSummaryFacts(7000);
  expect(facts.exercises.map((exercise) => exercise.movementName)).toEqual(['Goblet Squat', ...later]);
});

// Android walk 2026-11-03 (W2-10): "1 of 1 sets" and "Bjj session".
test('set counts and focus names read correctly', () => {
  const { setsOfPlanned, sessionFocusName, skippedExerciseText } = require('../../src/state/sessionSummary');
  expect(setsOfPlanned(1, 1)).toBe('1 of 1 set');
  expect(setsOfPlanned(0, 3)).toBe('0 of 3 sets');
  expect(skippedExerciseText({ name: 'Plank', plannedSets: 1, loggedSets: 1, loggedAs: [] }))
    .toBe('Skipped: Plank · 1 of 1 set logged');
  expect(sessionFocusName('bjj')).toBe('BJJ');
  expect(sessionFocusName('lower')).toBe('Lower');
  expect(sessionFocusName('full_body')).toBe('Full Body');
  expect(sessionFocusName('')).toBe('Session');
});
