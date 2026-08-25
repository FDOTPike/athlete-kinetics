/**
 * DemoLoadStore.test.js — R8 Phase 3 §2.2 store-contract assertions.
 *
 * Boots the REAL zustand store (apps/mobile/src/state/useStore.ts) against
 * the REAL migration chain (packages/core-db schema bytes via the jest .sql
 * raw loader), with only two seams replaced: the native op-sqlite handle
 * (node:sqlite driver) and the registry IO shell (in-memory registry). No
 * production logic is reimplemented and no SQL literal is copied — the
 * store's own statements run unmodified.
 *
 * Contract under test (R8 §2.2):
 *   - loadDemoAthlete() on an empty training DB seeds the demo and returns
 *     'loaded'.
 *   - loadDemoAthlete() with existing sessions preserves ALL data untouched
 *     and returns 'blocked_existing_data' without surfacing an error.
 *   - Unexpected database errors fail honestly through the error channel and
 *     are never mapped to 'blocked_existing_data'.
 */
import { useStore, localToday } from '../../src/state/useStore';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDriver;

// boot()'s post-registry work runs in a microtask continuation; drain the
// microtask queue (setImmediate fires after every pending microtask) before
// asserting readiness.
const bootRealStore = async () => {
  useStore.setState({ status: 'booting', error: null });
  useStore.getState().boot();
  await new Promise((resolve) => setImmediate(resolve));
  expect(useStore.getState().status).toBe('ready');
};

beforeEach(() => {
  mockDriver = makeNodeSqliteDriver();

  // Seam 1: the native DB handle factory (deferred-required by pragmas.ts).
  jest.mock('@op-engineering/op-sqlite', () => ({
    open: () => mockDriver,
  }));
  // Seam 2: registry IO (blob-util document-dir reads).
  jest.mock('../../src/state/athleteRegistry', () => {
    const core = jest.requireActual('../../src/state/athleteRegistryCore');
    return {
      loadRegistry: async () => ({
        version: 1,
        activeId: core.DEFAULT_ATHLETE_ID,
        advancedToolsUnlocked: false,
        athletes: [{
          id: core.DEFAULT_ATHLETE_ID,
          name: 'Athlete 1',
          dbName: core.LEGACY_DB_NAME,
          createdAtMs: 0,
        }],
      }),
      saveRegistry: async () => undefined,
    };
  });
});

const countSessions = () =>
  Number(mockDriver.raw.prepare('SELECT count(*) AS c FROM session').get().c);

test('empty training database: demo seeds fully and returns loaded', async () => {
  await bootRealStore();
  const state = useStore.getState();
  expect(countSessions()).toBe(0);

  expect(state.loadDemoAthlete()).toBe('loaded');

  const after = useStore.getState();
  // Honest success: no error surfaced, movement library hydrated into memory.
  expect(after.error).toBeNull();
  expect(after.movements.length).toBeGreaterThan(0);
  // The seeded history is real: many sessions across the 180-day window.
  expect(countSessions()).toBeGreaterThan(100);
});

test('existing training data: blocked result preserves every pre-existing row byte-identical and adds nothing', async () => {
  await bootRealStore();

  // Seed ONE honest piece of user history directly through the migrated
  // schema — a dated session plus one fully-populated logged set.
  mockDriver.raw.prepare(
    'INSERT INTO session (session_date, started_at_ms, duration_min, session_rpe) VALUES (?, ?, ?, ?)',
  ).run(localToday(), 1755000000000, 42, 7.5);
  const sessionId = Number(
    mockDriver.raw.prepare('SELECT last_insert_rowid() AS id').get().id,
  );
  mockDriver.raw.prepare(
    'INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, mean_velocity_ms, logged_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(sessionId, 1, 1, 8, 60, 7, 0.5, 1755000100000);

  const beforeSessions = mockDriver.raw.prepare('SELECT * FROM session ORDER BY session_id').all();
  const beforeSets = mockDriver.raw.prepare('SELECT * FROM set_record ORDER BY set_id').all();
  expect(beforeSessions).toHaveLength(1);
  expect(beforeSets).toHaveLength(1);

  const result = useStore.getState().loadDemoAthlete();

  expect(result).toBe('blocked_existing_data');
  const after = useStore.getState();
  // A polite refusal, NOT an error: nothing failed, the request was denied.
  expect(after.error).toBeNull();

  // Byte-for-byte preservation, and nothing was appended.
  expect(mockDriver.raw.prepare('SELECT * FROM session ORDER BY session_id').all())
    .toEqual(beforeSessions);
  expect(mockDriver.raw.prepare('SELECT * FROM set_record ORDER BY set_id').all())
    .toEqual(beforeSets);
  expect(countSessions()).toBe(1);
});

test('unexpected database failure surfaces honestly through the error channel and never masquerades as blocked', async () => {
  await bootRealStore();

  // Sabotage ONLY the demo write path: pre-seed macro_cycle id 1 so the demo
  // generator's own INSERT hits a PRIMARY KEY constraint mid-transaction.
  // The guard (session table empty) still passes — this isolates the honest
  // error path from the blocked path.
  mockDriver.raw.prepare(
    "INSERT INTO macro_cycle (macro_cycle_id, name, goal, start_date) VALUES (?, ?, ?, ?)",
  ).run(1, 'User data', 'strength', localToday());

  let caught = null;
  try {
    useStore.getState().loadDemoAthlete();
  } catch (e) {
    caught = e;
  }

  // It throws (never silently swallowed), it is NOT the blocked sentinel, and
  // the error lands in the store's error channel for the UI.
  expect(caught).not.toBeNull();
  expect(String(caught && caught.message)).not.toBe('blocked_existing_data');
  expect(useStore.getState().error).not.toBeNull();
});
