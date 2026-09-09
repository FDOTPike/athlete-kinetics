/**
 * SuspensionResetAndSwitch.test.js — the reset-lifecycle gap (audit Finding 2,
 * MASTER_AUDIT_SYNTHESIS OW-002), closed on both halves.
 *
 * Boots the REAL zustand store (apps/mobile/src/state/useStore.ts) against the
 * REAL complete migration chain, in the shape SuspensionLifecycle.test.js
 * established: only two seams are replaced, the native op-sqlite handle
 * (node:sqlite driver) and the athlete-registry IO shell. This file extends that
 * harness in one way — the DB seam is keyed BY FILE NAME, so Coach Mode's
 * one-database-per-athlete model is actually exercised instead of every
 * athlete sharing a single in-memory database. `resetTrainingData`,
 * `switchAthlete`, `boot`, `beginSuspension` and `generateNewBlock` all run
 * unmodified.
 *
 * What was wrong, and what each half asserts:
 *
 *   (a) PER_ATHLETE_RESET cleared every per-athlete surface EXCEPT
 *       `suspension`. boot() ends with refreshSuspension(), so a COMPLETED
 *       swap looked correct; the exposure was the interval before that call,
 *       and any boot that failed first, either of which leaves athlete B
 *       wearing athlete A's episode. Both windows are asserted here, the first
 *       by observing the store at the exact moment boot opens B's file.
 *
 *   (b) resetTrainingData deleted none of the suspension tables and did not
 *       refresh suspension afterwards. A wipe therefore left the athlete still
 *       suspended at a frozen macro index whose entire block history no longer
 *       existed — and because nextMacroPosition returns the frozen index for as
 *       long as an episode is open, every block minted afterwards was pinned
 *       there. The reset was frozen permanently, in the database and in memory.
 *
 * A blanket `DELETE FROM suspension_episode` is NOT the fix and is asserted as
 * such: 059 refuses to delete a closed episode, and inside the reset's single
 * transaction that abort rolls the entire wipe back. Only the OPEN episode is
 * removed. Whether a training-data wipe should keep closed episodes at all is
 * an open owner question (OW-034) and is deliberately not answered here.
 *
 * Expected to FAIL against 3ec532d6082e4ad96470c413a3365dc7f531a765.
 */
import { useStore, localToday } from '../../src/state/useStore';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

const ATHLETE_A = 'default';
const ATHLETE_B = 'athlete-b';
const DB_A = 'athlete_kinetics.db';
const DB_B = 'athlete_b.db';

/** dbName -> driver. One database file per athlete, created on first open and
 *  reused afterwards, so switching back finds the earlier athlete's real rows
 *  rather than a fresh file. */
let drivers;
/** Names whose next open() must throw, simulating a DB boot failure. */
let openFails;
/** What the store held at the moment boot() opened each file. This is the only
 *  way to see the window between PER_ATHLETE_RESET's set() and boot()'s
 *  refreshSuspension(), which is where half the defect lived. */
let suspensionAtOpen;
let mockRegistry;

// A function DECLARATION, not a const: the jest.mock factories below are
// hoisted above this file's imports and must be able to reach it.
function mockDriverFor(name) {
  if (openFails.has(name)) {
    openFails.delete(name);
    throw new Error(`simulated DB boot failure for ${name}`);
  }
  suspensionAtOpen.push({ dbName: name, suspension: useStore.getState().suspension });
  if (!drivers.has(name)) drivers.set(name, makeNodeSqliteDriver());
  return drivers.get(name);
}

// BOTH seams are declared at module scope so babel-plugin-jest-hoist lifts them
// above the `import` of useStore. That matters for the registry: useStore takes
// a STATIC `import { loadRegistry, saveRegistry } from './athleteRegistry'`, so
// a jest.mock issued from inside beforeEach binds after the real module has
// already been resolved and is silently inert. The op-sqlite seam survives
// either placement only because pragmas.ts defers its require.
//
// Seam 1: the native DB handle factory, keyed by file name, so Coach Mode's
// one-file-per-athlete model is really exercised.
jest.mock('@op-engineering/op-sqlite', () => ({
  open: ({ name }) => mockDriverFor(name),
}));
// Seam 2: athlete-registry IO. Unlike the single-athlete mocks elsewhere, this
// one PERSISTS the write, because switchAthlete saves the new activeId and the
// boot() that follows reads it back to choose the database file.
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => mockRegistry,
  saveRegistry: async (next) => { mockRegistry = next; return true; },
}));

const raw = (dbName) => drivers.get(dbName).raw;
const store = () => useStore.getState();

/** boot()'s post-registry work runs in a microtask continuation; setImmediate
 *  fires after every pending microtask. switchAthlete awaits twice and then
 *  calls boot(), which awaits again, so drain more than once. */
const settle = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

const bootRealStore = async () => {
  useStore.setState({ status: 'booting', error: null });
  store().boot();
  await settle();
  expect(store().status).toBe('ready');
};

const switchTo = async (id) => {
  store().switchAthlete(id);
  await settle();
};

const episodes = (dbName) => raw(dbName)
  .prepare('SELECT episode_id, started_at_ms, ended_at_ms, reason, frozen_macro_index FROM suspension_episode ORDER BY episode_id')
  .all();
const openEpisodes = (dbName) => episodes(dbName).filter((e) => e.ended_at_ms === null);
const countIn = (dbName, table) => Number(raw(dbName).prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c);
const lastMintedMacroIndex = (dbName = DB_A) => {
  const row = raw(dbName).prepare('SELECT macro_block_index FROM block_meta ORDER BY block_id DESC LIMIT 1').get();
  return row === undefined ? null : Number(row.macro_block_index);
};

/** The single invariant this whole file exists to protect: what the store says
 *  about suspension and what the athlete's own database says must agree. */
const expectMemoryAndDbAgree = (dbName) => {
  const open = openEpisodes(dbName);
  const inMemory = store().suspension;
  if (open.length === 0) {
    expect(inMemory).toBeNull();
  } else {
    expect(inMemory).not.toBeNull();
    expect(inMemory.episode_id).toBe(open[0].episode_id);
    expect(inMemory.frozen_macro_index).toBe(open[0].frozen_macro_index);
  }
};

/** Age the active block past the 28-day continuation gate so the guided-program
 *  paths become reachable without touching the clock. */
const ageActiveBlockPastContinuationGate = (dbName = DB_A) => {
  raw(dbName)
    .prepare("UPDATE training_block SET start_date = date(?, '-40 days') WHERE status = 'active'")
    .run(localToday());
  store().refreshBlock();
  store().refreshProgram();
};

beforeEach(() => {
  drivers = new Map();
  openFails = new Set();
  suspensionAtOpen = [];
  mockRegistry = {
    version: 1,
    activeId: ATHLETE_A,
    advancedToolsUnlocked: false,
    athletes: [
      { id: ATHLETE_A, name: 'Athlete A', dbName: DB_A, createdAtMs: 0 },
      { id: ATHLETE_B, name: 'Athlete B', dbName: DB_B, createdAtMs: 1 },
    ],
  };
});

// ---------------------------------------------------------------------------
// (b) resetTrainingData
// ---------------------------------------------------------------------------

test('a confirmed training-data reset clears the open episode in BOTH the database and memory', async () => {
  await bootRealStore();
  store().generateNewBlock('LINEAR');
  const frozen = store().beginSuspension('injury', 1_756_000_000_000);

  // Precondition: genuinely suspended, in both places.
  expect(openEpisodes(DB_A)).toHaveLength(1);
  expect(store().suspension).not.toBeNull();
  expect(store().suspension.frozen_macro_index).toBe(frozen);

  expect(store().error).toBeNull();
  store().resetTrainingData();

  expect(store().error).toBeNull();
  expect(openEpisodes(DB_A)).toHaveLength(0);
  expect(store().suspension).toBeNull();
  expectMemoryAndDbAgree(DB_A);
});

test('the reset removes ONLY the open episode: closed history survives and the wipe still commits', async () => {
  await bootRealStore();
  store().generateNewBlock('LINEAR');
  store().beginSuspension('injury', 1_700_000_000_000);
  store().endSuspension(1_700_900_000_000);          // episode 1, closed
  store().beginSuspension('illness', 1_756_000_000_000); // episode 2, open
  expect(episodes(DB_A)).toHaveLength(2);

  const closedBefore = episodes(DB_A).filter((e) => e.ended_at_ms !== null);
  expect(closedBefore).toHaveLength(1);

  store().resetTrainingData();

  // A blanket delete would have hit 059's no-delete-closed trigger and, inside
  // the reset's single transaction, rolled the WHOLE wipe back. It committed:
  expect(store().error).toBeNull();
  expect(countIn(DB_A, 'training_block')).toBe(0);
  expect(countIn(DB_A, 'block_meta')).toBe(0);
  // ...the closed episode is untouched history...
  expect(episodes(DB_A).filter((e) => e.ended_at_ms !== null)).toEqual(closedBefore);
  // ...and only the open one is gone.
  expect(openEpisodes(DB_A)).toHaveLength(0);
  expectMemoryAndDbAgree(DB_A);
});

test('the reset leaves no 059 side-car rows behind', async () => {
  await bootRealStore();
  expect(store().createTrainingProgram({
    horizon: { kind: 'weeks', blockCount: 4 },
    schemaType: 'LINEAR',
    dayIndices: [1, 3, 5],
  })).toBe(true);
  store().beginSuspension('injury', 1_756_000_000_000);
  // A continuation minted DURING the episode: S6(b) attributes it rather than
  // letting it consume the frozen position, which is what puts a row in
  // block_suspension_origin.
  ageActiveBlockPastContinuationGate();
  store().continueTrainingProgram();
  expect(store().error).toBeNull();

  expect(countIn(DB_A, 'suspension_episode_program')).toBeGreaterThan(0);
  expect(countIn(DB_A, 'block_suspension_origin')).toBeGreaterThan(0);
  expect(countIn(DB_A, 'planned_slot_load_intent')).toBeGreaterThan(0);

  store().resetTrainingData();

  expect(store().error).toBeNull();
  expect(countIn(DB_A, 'suspension_episode_program')).toBe(0);
  expect(countIn(DB_A, 'block_suspension_origin')).toBe(0);
  expect(countIn(DB_A, 'planned_slot_load_intent')).toBe(0);
});

test('after the reset the athlete is no longer frozen: the next block advances the macro position', async () => {
  await bootRealStore();
  store().generateNewBlock('LINEAR');
  store().generateNewBlock('LINEAR');
  const frozen = store().beginSuspension('injury', 1_756_000_000_000);
  store().generateNewBlock('LINEAR');
  expect(lastMintedMacroIndex()).toBe(frozen); // S6(b): pinned while suspended

  store().resetTrainingData();
  expect(store().error).toBeNull();

  // The wipe removed every block, so the position restarts at 1 and then
  // ADVANCES. Before the fix both of these were the stale frozen index for
  // ever, because an open episode short-circuits nextMacroPosition.
  store().generateNewBlock('LINEAR');
  expect(store().error).toBeNull();
  expect(lastMintedMacroIndex()).toBe(1);

  store().generateNewBlock('LINEAR');
  expect(store().error).toBeNull();
  expect(lastMintedMacroIndex()).toBe(2);
});

test('a reset mid-program leaves guided progression usable again', async () => {
  await bootRealStore();
  expect(store().createTrainingProgram({
    horizon: { kind: 'weeks', blockCount: 4 },
    schemaType: 'LINEAR',
    dayIndices: [1, 3, 5],
  })).toBe(true);
  store().beginSuspension('life', 1_756_000_000_000);

  store().resetTrainingData();
  expect(store().error).toBeNull();
  expect(store().program).toBeNull();
  expect(store().suspension).toBeNull();

  // A fresh program on the wiped file, then a real continuation: neither is
  // reachable while a stale episode is still open, because the continuation
  // would be minted at the frozen index and, being attributed to that episode,
  // would consume no position at all.
  expect(store().createTrainingProgram({
    horizon: { kind: 'weeks', blockCount: 4 },
    schemaType: 'LINEAR',
    dayIndices: [1, 3, 5],
  })).toBe(true);
  ageActiveBlockPastContinuationGate();
  store().continueTrainingProgram();

  expect(store().error).toBeNull();
  expect(countIn(DB_A, 'block_suspension_origin')).toBe(0);
  expect(countIn(DB_A, 'training_block_program')).toBe(2);
  expectMemoryAndDbAgree(DB_A);
});

// ---------------------------------------------------------------------------
// (a) PER_ATHLETE_RESET and athlete switching
// ---------------------------------------------------------------------------

test("switching athletes clears the previous suspension BEFORE the new athlete's file is read", async () => {
  await bootRealStore();
  store().beginSuspension('injury', 1_756_000_000_000);
  expect(store().suspension).not.toBeNull();

  suspensionAtOpen.length = 0;
  await switchTo(ATHLETE_B);
  expect(store().status).toBe('ready');

  // This is the assertion the fix exists for. boot() ends with
  // refreshSuspension(), so the FINAL value was already correct; what was not
  // correct is the value resident while athlete B's database was being opened
  // and migrated — A's episode, under B's identity.
  const openedB = suspensionAtOpen.find((o) => o.dbName === DB_B);
  expect(openedB).toBeDefined();
  expect(openedB.suspension).toBeNull();

  expect(store().activeAthleteId).toBe(ATHLETE_B);
  expect(store().suspension).toBeNull();
  expect(openEpisodes(DB_B)).toHaveLength(0);
  expectMemoryAndDbAgree(DB_B);
});

test("a failed boot after a switch does not leave the previous athlete's suspension resident", async () => {
  await bootRealStore();
  store().beginSuspension('illness', 1_756_000_000_000);
  expect(store().suspension).not.toBeNull();

  openFails.add(DB_B); // boot throws before it can reach refreshSuspension()
  await switchTo(ATHLETE_B);

  expect(store().status).toBe('error');
  // The second exposure window: nothing re-read the value, so whatever
  // PER_ATHLETE_RESET left is what the athlete is stuck with.
  expect(store().suspension).toBeNull();
});

test('A -> B -> A restores only A\'s own episode, and B never gains one', async () => {
  await bootRealStore();
  store().generateNewBlock('LINEAR');
  const frozen = store().beginSuspension('injury', 1_756_000_000_000);
  const episodeA = openEpisodes(DB_A)[0];
  expect(episodeA).toBeDefined();

  await switchTo(ATHLETE_B);
  expect(store().suspension).toBeNull();
  expectMemoryAndDbAgree(DB_B);

  // B trains normally while A is suspended; nothing about A may follow.
  store().generateNewBlock('LINEAR');
  expect(store().error).toBeNull();
  expect(openEpisodes(DB_B)).toHaveLength(0);
  expect(lastMintedMacroIndex(DB_B)).toBe(1);

  await switchTo(ATHLETE_A);
  expect(store().activeAthleteId).toBe(ATHLETE_A);
  expect(store().suspension).not.toBeNull();
  expect(store().suspension.episode_id).toBe(episodeA.episode_id);
  expect(store().suspension.frozen_macro_index).toBe(frozen);
  expect(store().suspension.reason).toBe('injury');
  expectMemoryAndDbAgree(DB_A);

  // A's episode was never copied into B's file by any of this.
  expect(episodes(DB_B)).toHaveLength(0);
  expect(episodes(DB_A)).toHaveLength(1);
});

test('a reset on A leaves B untouched, and each athlete keeps its own suspension state', async () => {
  await bootRealStore();
  store().generateNewBlock('LINEAR');
  store().beginSuspension('injury', 1_756_000_000_000);

  await switchTo(ATHLETE_B);
  store().generateNewBlock('LINEAR');
  const bFrozen = store().beginSuspension('life', 1_757_000_000_000);
  expect(openEpisodes(DB_B)).toHaveLength(1);

  await switchTo(ATHLETE_A);
  expect(store().suspension.reason).toBe('injury');
  store().resetTrainingData();
  expect(store().error).toBeNull();
  expect(store().suspension).toBeNull();
  expect(openEpisodes(DB_A)).toHaveLength(0);

  // B's file was never opened by the reset and keeps everything.
  expect(openEpisodes(DB_B)).toHaveLength(1);
  expect(countIn(DB_B, 'training_block')).toBe(1);

  await switchTo(ATHLETE_B);
  expect(store().suspension).not.toBeNull();
  expect(store().suspension.reason).toBe('life');
  expect(store().suspension.frozen_macro_index).toBe(bFrozen);
  expectMemoryAndDbAgree(DB_B);
});

// ---------------------------------------------------------------------------
// OW-007 (store half) — endSuspension is transactional and reports failure
// ---------------------------------------------------------------------------

test('OW-007 endSuspension rolls back and RETHROWS when its write fails', async () => {
  await bootRealStore();
  const frozen = store().beginSuspension('injury', 1_756_000_000_000);
  expect(openEpisodes(DB_A)).toHaveLength(1);

  // Fail exactly the close write, nothing else. beginSuspension already
  // committed, so this isolates the resume path.
  const driver = drivers.get(DB_A);
  const realExecuteSync = driver.executeSync.bind(driver);
  driver.executeSync = (sql, params) => {
    if (/UPDATE suspension_episode SET ended_at_ms/.test(String(sql))) {
      throw new Error('database is locked');
    }
    return realExecuteSync(sql, params);
  };

  // Before the fix this was an unguarded executeSync: it threw from inside the
  // store with no transaction to unwind and nothing to catch it.
  expect(() => store().endSuspension(1_756_900_000_000)).toThrow('database is locked');

  driver.executeSync = realExecuteSync;

  // Rolled back: the episode is still open, in the database AND in memory, so
  // the athlete can retry rather than being left in a half-resumed state.
  expect(openEpisodes(DB_A)).toHaveLength(1);
  expect(openEpisodes(DB_A)[0].ended_at_ms).toBeNull();
  store().refreshSuspension();
  expect(store().suspension).not.toBeNull();
  expect(store().suspension.frozen_macro_index).toBe(frozen);
  expectMemoryAndDbAgree(DB_A);

  // And the retry succeeds, which is the point of failing cleanly.
  store().endSuspension(1_757_000_000_000);
  expect(openEpisodes(DB_A)).toHaveLength(0);
  expectMemoryAndDbAgree(DB_A);
});

test('OW-007 a successful resume still closes the episode exactly once', async () => {
  await bootRealStore();
  store().beginSuspension('illness', 1_756_000_000_000);
  store().endSuspension(1_756_900_000_000);

  const all = episodes(DB_A);
  expect(all).toHaveLength(1);
  expect(all[0].ended_at_ms).toBe(1_756_900_000_000);
  // 059 refuses a second close, and endSuspension no-ops with no open episode.
  expect(() => store().endSuspension(1_757_000_000_000)).not.toThrow();
  expect(episodes(DB_A)[0].ended_at_ms).toBe(1_756_900_000_000);
  expectMemoryAndDbAgree(DB_A);
});
