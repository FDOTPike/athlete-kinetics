/**
 * SuspensionLifecycle.test.js — RR-02 behavioural lifecycle tests (C2 §6.1).
 *
 * Boots the REAL zustand store (apps/mobile/src/state/useStore.ts) against the
 * REAL 001-058 migration chain, replacing only the two seams DemoLoadStore.test.js
 * established: the native op-sqlite handle (node:sqlite driver) and the registry
 * IO shell. No production logic is reimplemented and no SQL literal is copied —
 * `nextMacroPosition`, `beginSuspension`, `endSuspension`, `generateNewBlock`,
 * `previewTrainingProgram` and `continueTrainingProgram` all run unmodified.
 *
 * This replaces source-text tripwires (verify_store_sql.mjs:442-454 asserts with
 * `src.includes(...)`) with assertions about what the store actually does.
 *
 * Rulings under test, ratified 2026-08-29 and recorded in
 * docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md §6:
 *
 *   S1(a) an in-flight block survives suspension untouched
 *   S2(a) with no prior block, the sequence start is frozen
 *   S4(a) the snapshot persisted at entry is authoritative on exit
 *   S5(c) freeze the global macro position AND the guided program's sequence state
 *   S6(b) training may continue while suspended, but blocks generated during an
 *         episode consume NEITHER frozen state; resume returns to exactly the
 *         recorded position
 *
 * Also covers L1(a) on the STORE side: which slots the store declares a
 * prospective load intent for. Mutation testing found that assertion missing —
 * reverting plannedImplementFor to supportedPrefixes[0] escaped every other
 * gate, because verify_blocks [28] exercises the ENGINE with intents already
 * supplied and never the store's own derivation.
 *
 * Expected to FAIL against 48719b07988ad30d255b0fed37f45ed5db49c935.
 */
import { useStore, localToday } from '../../src/state/useStore';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDriver;

const bootRealStore = async () => {
  useStore.setState({ status: 'booting', error: null });
  useStore.getState().boot();
  await new Promise((resolve) => setImmediate(resolve));
  expect(useStore.getState().status).toBe('ready');
};

/** The macro index of the most recently minted block, read straight from the
 *  block_meta side-car the store writes. */
const lastMintedMacroIndex = () => {
  const row = mockDriver.raw
    .prepare('SELECT macro_block_index FROM block_meta ORDER BY block_id DESC LIMIT 1')
    .get();
  return row === undefined ? null : Number(row.macro_block_index);
};

const macroIndexHistory = () =>
  mockDriver.raw
    .prepare('SELECT block_id, macro_block_index FROM block_meta ORDER BY block_id')
    .all()
    .map((r) => Number(r.macro_block_index));

/** Age the active block past the 28-day continuation gate so the guided-program
 *  paths become reachable without touching the clock. */
const ageActiveBlockPastContinuationGate = () => {
  mockDriver.raw
    .prepare("UPDATE training_block SET start_date = date(?, '-40 days') WHERE status = 'active'")
    .run(localToday());
  useStore.getState().refreshBlock();
  useStore.getState().refreshProgram();
};

beforeEach(() => {
  mockDriver = makeNodeSqliteDriver();
  jest.mock('@op-engineering/op-sqlite', () => ({ open: () => mockDriver }));
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

// ---------------------------------------------------------------------------
// S6(b) — the standalone counterexample the audit recorded
// ---------------------------------------------------------------------------

test('S6(b) standalone: a block generated during an episode does not consume the frozen position', async () => {
  await bootRealStore();
  const store = () => useStore.getState();

  store().generateNewBlock('LINEAR');
  expect(store().error).toBeNull();
  const beforeSuspension = lastMintedMacroIndex();
  expect(beforeSuspension).not.toBeNull();

  const frozen = store().beginSuspension('injury', 1_756_000_000_000);
  expect(store().activeSuspension()).not.toBeNull();

  // Training is NOT suspended (058's own contract): generate while the episode
  // is open. The block correctly takes the frozen position...
  store().generateNewBlock('LINEAR');
  expect(store().error).toBeNull();
  expect(lastMintedMacroIndex()).toBe(frozen);

  store().endSuspension(1_756_900_000_000);
  expect(store().activeSuspension()).toBeNull();

  // ...and after resume the athlete returns to EXACTLY the frozen position.
  // TRAINING_PROGRESSION_LAYERS.md 4.1: the place is "held, not consumed".
  store().generateNewBlock('LINEAR');
  expect(store().error).toBeNull();
  expect(lastMintedMacroIndex()).toBe(frozen);
});

test('S6(b) standalone: repeated blocks during one episode all reuse the frozen position', async () => {
  await bootRealStore();
  const store = () => useStore.getState();

  store().generateNewBlock('LINEAR');
  const frozen = store().beginSuspension('illness', 1_756_000_000_000);

  for (let i = 0; i < 3; i += 1) {
    store().generateNewBlock('LINEAR');
    expect(store().error).toBeNull();
    expect(lastMintedMacroIndex()).toBe(frozen);
  }

  store().endSuspension(1_756_900_000_000);
  store().generateNewBlock('LINEAR');
  expect(lastMintedMacroIndex()).toBe(frozen);
});

test('S4(a) the entry snapshot survives a process restart and still governs resume', async () => {
  await bootRealStore();
  const store = () => useStore.getState();

  store().generateNewBlock('LINEAR');
  const frozen = store().beginSuspension('life', 1_756_000_000_000);
  store().generateNewBlock('LINEAR');

  // Rehydrate the store against the SAME database file, as a process restart does.
  await bootRealStore();
  expect(useStore.getState().activeSuspension().frozen_macro_index).toBe(frozen);

  useStore.getState().endSuspension(1_756_900_000_000);
  useStore.getState().generateNewBlock('LINEAR');
  expect(lastMintedMacroIndex()).toBe(frozen);
});

// ---------------------------------------------------------------------------
// S5(c) — the guided-program bypass
// ---------------------------------------------------------------------------

test('S5(c) guided program: preview does not advance the program-owned position while suspended', async () => {
  await bootRealStore();
  const store = () => useStore.getState();

  const created = store().createTrainingProgram({
    horizon: { kind: 'weeks', blockCount: 4 },
    schemaType: 'LINEAR',
    dayIndices: [1, 3, 5],
  });
  expect(created).toBe(true);
  ageActiveBlockPastContinuationGate();

  const previewBefore = store().previewNextProgramBlock();
  expect(previewBefore).not.toBeNull();

  const frozen = store().beginSuspension('injury', 1_756_000_000_000);

  // A preview taken immediately after entry is NOT discriminating: the
  // program-owned derivation and the global one agree on the first
  // continuation. Consume a continuation during the episode first, so the two
  // derivations have somewhere to diverge.
  store().continueTrainingProgram();
  expect(store().error).toBeNull();
  ageActiveBlockPastContinuationGate();

  const previewDuring = store().previewNextProgramBlock();
  expect(previewDuring).not.toBeNull();
  // The preview a suspended athlete is shown must not step the macro position
  // past the frozen one.
  expect(previewDuring.macroBlockIndex).toBe(frozen);
});

test('S5(c)+S6(b) guided program: a continuation generated while suspended does not consume the position', async () => {
  await bootRealStore();
  const store = () => useStore.getState();

  expect(store().createTrainingProgram({
    horizon: { kind: 'weeks', blockCount: 4 },
    schemaType: 'LINEAR',
    dayIndices: [1, 3, 5],
  })).toBe(true);
  ageActiveBlockPastContinuationGate();

  const frozen = store().beginSuspension('injury', 1_756_000_000_000);

  store().continueTrainingProgram();
  expect(store().error).toBeNull();
  expect(lastMintedMacroIndex()).toBe(frozen);

  store().endSuspension(1_756_900_000_000);
  ageActiveBlockPastContinuationGate();

  store().continueTrainingProgram();
  expect(store().error).toBeNull();
  expect(lastMintedMacroIndex()).toBe(frozen);
});

// ---------------------------------------------------------------------------
// S1(a), S2(a) — entry-condition rulings
// ---------------------------------------------------------------------------

test('S1(a) an in-flight block and all of its plan rows survive entry byte-identical', async () => {
  await bootRealStore();
  const store = () => useStore.getState();

  store().generateNewBlock('LINEAR');
  const blocksBefore = mockDriver.raw.prepare('SELECT * FROM training_block ORDER BY block_id').all();
  const metaBefore = mockDriver.raw.prepare('SELECT * FROM block_meta ORDER BY block_id').all();
  const sessionsBefore = mockDriver.raw.prepare('SELECT * FROM planned_session ORDER BY planned_session_id').all();
  const slotsBefore = mockDriver.raw.prepare('SELECT * FROM planned_slot ORDER BY planned_slot_id').all();
  expect(blocksBefore.length).toBeGreaterThan(0);
  expect(slotsBefore.length).toBeGreaterThan(0);

  store().beginSuspension('injury', 1_756_000_000_000);

  expect(mockDriver.raw.prepare('SELECT * FROM training_block ORDER BY block_id').all()).toEqual(blocksBefore);
  expect(mockDriver.raw.prepare('SELECT * FROM block_meta ORDER BY block_id').all()).toEqual(metaBefore);
  expect(mockDriver.raw.prepare('SELECT * FROM planned_session ORDER BY planned_session_id').all()).toEqual(sessionsBefore);
  expect(mockDriver.raw.prepare('SELECT * FROM planned_slot ORDER BY planned_slot_id').all()).toEqual(slotsBefore);
});

test('S2(a) entry before any block exists freezes the sequence start and resume honours it', async () => {
  await bootRealStore();
  const store = () => useStore.getState();

  expect(lastMintedMacroIndex()).toBeNull();

  const frozen = store().beginSuspension('life', 1_756_000_000_000);
  expect(frozen).toBe(1);

  store().generateNewBlock('LINEAR');
  expect(lastMintedMacroIndex()).toBe(1);

  store().endSuspension(1_756_900_000_000);
  store().generateNewBlock('LINEAR');
  expect(lastMintedMacroIndex()).toBe(1);
});

// ---------------------------------------------------------------------------
// Episode lifecycle invariants
// ---------------------------------------------------------------------------

test('a second begin is refused and leaves the first episode intact', async () => {
  await bootRealStore();
  const store = () => useStore.getState();

  store().generateNewBlock('LINEAR');
  const frozen = store().beginSuspension('injury', 1_756_000_000_000);

  expect(() => store().beginSuspension('life', 1_756_100_000_000)).toThrow();

  const open = mockDriver.raw
    .prepare('SELECT * FROM suspension_episode WHERE ended_at_ms IS NULL').all();
  expect(open).toHaveLength(1);
  expect(Number(open[0].frozen_macro_index)).toBe(frozen);
  expect(open[0].reason).toBe('injury');
});

test('a repeated end is a no-op and does not move the recorded close time', async () => {
  await bootRealStore();
  const store = () => useStore.getState();

  store().generateNewBlock('LINEAR');
  store().beginSuspension('injury', 1_756_000_000_000);
  store().endSuspension(1_756_900_000_000);

  const afterFirst = mockDriver.raw.prepare('SELECT * FROM suspension_episode').all();
  store().endSuspension(1_757_000_000_000);
  expect(mockDriver.raw.prepare('SELECT * FROM suspension_episode').all()).toEqual(afterFirst);
});

test('the full lifecycle preserves every pre-existing session and set row', async () => {
  await bootRealStore();
  const store = () => useStore.getState();

  mockDriver.raw
    .prepare('INSERT INTO session (session_date, started_at_ms, duration_min, session_rpe) VALUES (?, ?, ?, ?)')
    .run(localToday(), 1_755_000_000_000, 42, 7.5);
  const sessionId = Number(mockDriver.raw.prepare('SELECT last_insert_rowid() AS id').get().id);
  mockDriver.raw
    .prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, mean_velocity_ms, logged_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(sessionId, 1, 1, 8, 60, 7, 0.5, 1_755_000_100_000);

  const sessionsBefore = mockDriver.raw.prepare('SELECT * FROM session ORDER BY session_id').all();
  const setsBefore = mockDriver.raw.prepare('SELECT * FROM set_record ORDER BY set_id').all();

  store().generateNewBlock('LINEAR');
  store().beginSuspension('injury', 1_756_000_000_000);
  store().generateNewBlock('LINEAR');
  store().endSuspension(1_756_900_000_000);
  store().generateNewBlock('LINEAR');

  expect(mockDriver.raw.prepare('SELECT * FROM session ORDER BY session_id').all()).toEqual(sessionsBefore);
  expect(mockDriver.raw.prepare('SELECT * FROM set_record ORDER BY set_id').all()).toEqual(setsBefore);
});

test('no clock or randomness: the same fixture replays to the same macro history', async () => {
  const run = async () => {
    mockDriver = makeNodeSqliteDriver();
    await bootRealStore();
    const store = () => useStore.getState();
    store().generateNewBlock('LINEAR');
    store().beginSuspension('injury', 1_756_000_000_000);
    store().generateNewBlock('LINEAR');
    store().endSuspension(1_756_900_000_000);
    store().generateNewBlock('LINEAR');
    return macroIndexHistory();
  };

  expect(await run()).toEqual(await run());
});

// ---------------------------------------------------------------------------
// L1(a) — which slots the STORE declares an intent for
// ---------------------------------------------------------------------------

test('L1(a) store: only unambiguous movements get a declared load intent, and it is never dropdown order', async () => {
  await bootRealStore();
  useStore.getState().generateNewBlock('LINEAR');
  expect(useStore.getState().error).toBeNull();

  const slots = mockDriver.raw.prepare(`
    SELECT ps.planned_slot_id,
           m.name,
           d.supported_prefixes AS prefixes,
           li.planned_implement  AS declared
      FROM planned_slot ps
      JOIN movement m ON m.movement_id = ps.movement_id
      JOIN movement_detail d ON d.movement_id = ps.movement_id
      LEFT JOIN planned_slot_load_intent li ON li.planned_slot_id = ps.planned_slot_id
  `).all().map((r) => ({ ...r, supported: JSON.parse(r.prefixes ?? '[]') }));

  expect(slots.length).toBeGreaterThan(0);

  for (const slot of slots) {
    if (slot.supported.length === 1) {
      // No choice to make: the sole supported implement IS the selection.
      expect(slot.declared).toBe(slot.supported[0]);
    } else {
      // Ambiguous: the athlete has not chosen, so nothing may be declared on
      // their behalf. This is the assertion that kills the dropdown-order
      // mutant — element zero must NOT become an intent.
      expect(slot.declared).toBeNull();
    }
  }

  // Stated as its own claim so a future refactor cannot satisfy the loop above
  // vacuously by declaring nothing at all.
  expect(slots.some((slot) => slot.declared !== null)).toBe(true);
});

test('L1(a) store: a multi-implement movement never receives the bodyweight dose by default', async () => {
  await bootRealStore();
  useStore.getState().generateNewBlock('LINEAR');

  const bodyweightFirstButAmbiguous = mockDriver.raw.prepare(`
    SELECT m.name, li.planned_implement AS declared
      FROM planned_slot ps
      JOIN movement m ON m.movement_id = ps.movement_id
      JOIN movement_detail d ON d.movement_id = ps.movement_id
      LEFT JOIN planned_slot_load_intent li ON li.planned_slot_id = ps.planned_slot_id
     WHERE json_array_length(d.supported_prefixes) > 1
       AND json_extract(d.supported_prefixes, '$[0]') = 'Bodyweight'
  `).all();

  // Weighted Pull-up, Bulgarian Split Squat, Walking Lunge and friends: listed
  // Bodyweight-first, but loadable. None may be silently declared bodyweight.
  for (const row of bodyweightFirstButAmbiguous) {
    expect(row.declared).toBeNull();
  }
});
