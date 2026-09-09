/**
 * LoadIntentDeclaration.test.js — OW-001, the unimplemented half of L1(a).
 *
 * Boots the REAL zustand store against the REAL complete migration chain, in
 * the shape SuspensionLifecycle.test.js established: only the native op-sqlite
 * handle and the registry IO shell are replaced. `saveMovementLoadIntent`,
 * `generateNewBlock` and the store's own `plannedImplementFor` all run
 * unmodified.
 *
 * The ruling under test, owner-ratified 2026-08-29 and re-confirmed 2026-09-09
 * (RELEASE_CANDIDATE_C1_DOCKET.md §6):
 *
 *   L1(a) constrained — persist explicit PROSPECTIVE per-slot load intent at
 *   block generation. Ambiguous mixed movements REQUIRE ATHLETE SELECTION.
 *   Missing legacy state fails closed toward the conservative loaded path.
 *   Intent may NOT be derived from dropdown order, taxonomy, equipment
 *   ownership, or retrospective set data.
 *
 * Before 063 the athlete had no way to select anything: the store declared an
 * implement only when a movement had exactly ONE supported prefix, so the 17
 * genuinely ambiguous movements on the shipped corpus were permanently
 * undeclared and permanently loaded. These tests are the selection.
 *
 * Expected to FAIL against 5f1cb6a.
 */
import { useStore } from '../../src/state/useStore';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDriver;
let mockRegistry;

function mockOpenDb() { return mockDriver; }

jest.mock('@op-engineering/op-sqlite', () => ({ open: () => mockOpenDb() }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => mockRegistry,
  saveRegistry: async (next) => { mockRegistry = next; return true; },
}));

const store = () => useStore.getState();
const raw = () => mockDriver.raw;

const bootRealStore = async () => {
  useStore.setState({ status: 'booting', error: null });
  store().boot();
  await new Promise((resolve) => setImmediate(resolve));
  expect(store().status).toBe('ready');
};

/** Every movement the library says can be trained more than one way. */
const ambiguous = () => store().movements.filter((m) => m.supportedPrefixes.length > 1);
/** An ambiguous movement that genuinely offers bodyweight — not every one
 *  does (several are BB/DB only), so tests must pick rather than assume. */
const ambiguousWithBodyweight = () => ambiguous().find((m) => m.supportedPrefixes.includes('Bodyweight'));

/** The per-slot record L1(a) requires, joined back to its movement. */
const slotIntents = () => raw().prepare(`
  SELECT m.name, m.movement_id, li.planned_implement AS declared
    FROM planned_slot ps
    JOIN movement m ON m.movement_id = ps.movement_id
    LEFT JOIN planned_slot_load_intent li ON li.planned_slot_id = ps.planned_slot_id
`).all();

const declarations = () => raw()
  .prepare('SELECT movement_id, planned_implement FROM movement_load_intent ORDER BY movement_id')
  .all();

beforeEach(() => {
  mockDriver = makeNodeSqliteDriver();
  mockRegistry = {
    version: 1,
    activeId: 'default',
    advancedToolsUnlocked: false,
    athletes: [{ id: 'default', name: 'Athlete 1', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
  };
});

// ---------------------------------------------------------------------------
// The gap OW-001 exists to close
// ---------------------------------------------------------------------------

test('the shipped corpus really does carry ambiguous movements, and they start undeclared', async () => {
  await bootRealStore();

  // Not a vacuous suite: the defect only exists because these movements exist.
  expect(ambiguous().length).toBeGreaterThan(0);
  expect(declarations()).toHaveLength(0);
  expect(store().loadIntents).toEqual({});

  store().generateNewBlock('LINEAR');
  expect(store().error).toBeNull();

  // Fail closed: every ambiguous slot is undeclared, and element zero of the
  // supported list is never taken even when that element is 'Bodyweight'.
  const ambiguousIds = new Set(ambiguous().map((m) => m.movement_id));
  const ambiguousSlots = slotIntents().filter((r) => ambiguousIds.has(Number(r.movement_id)));
  for (const slot of ambiguousSlots) expect(slot.declared).toBeNull();
});

// ---------------------------------------------------------------------------
// The selection itself
// ---------------------------------------------------------------------------

test('a declaration is recorded, reflected in the store, and withdrawable', async () => {
  await bootRealStore();
  const m = ambiguousWithBodyweight();
  expect(m).toBeDefined();

  expect(store().saveMovementLoadIntent(m.movement_id, 'Bodyweight')).toBe(true);
  expect(store().error).toBeNull();
  expect(store().loadIntents[m.movement_id]).toBe('Bodyweight');
  expect(declarations()).toEqual([{ movement_id: m.movement_id, planned_implement: 'Bodyweight' }]);

  // Changing your mind is allowed — it is prospective, so it rewrites nothing.
  const other = m.supportedPrefixes.find((p) => p !== 'Bodyweight');
  expect(store().saveMovementLoadIntent(m.movement_id, other)).toBe(true);
  expect(store().loadIntents[m.movement_id]).toBe(other);

  // Withdrawing returns the movement to UNDECLARED, not to bodyweight.
  expect(store().saveMovementLoadIntent(m.movement_id, null)).toBe(true);
  expect(store().loadIntents[m.movement_id]).toBeUndefined();
  expect(declarations()).toHaveLength(0);
});

test('a declaration routes the generated slot, and undeclared movements still fail closed', async () => {
  await bootRealStore();

  // Declare bodyweight for every ambiguous movement that offers it, so the
  // assertion does not depend on which movements the ranker happens to pick.
  const declared = ambiguous().filter((m) => m.supportedPrefixes.includes('Bodyweight'));
  expect(declared.length).toBeGreaterThan(0);
  for (const m of declared) {
    expect(store().saveMovementLoadIntent(m.movement_id, 'Bodyweight')).toBe(true);
  }

  store().generateNewBlock('LINEAR');
  expect(store().error).toBeNull();

  const declaredIds = new Set(declared.map((m) => m.movement_id));
  const rows = slotIntents();
  const declaredSlots = rows.filter((r) => declaredIds.has(Number(r.movement_id)));
  // Every slot for a declared movement carries the athlete's choice...
  for (const slot of declaredSlots) expect(slot.declared).toBe('Bodyweight');
  // ...and an ambiguous movement they did NOT declare still carries nothing.
  const undeclaredAmbiguousIds = new Set(
    ambiguous().filter((m) => !declaredIds.has(m.movement_id)).map((m) => m.movement_id),
  );
  for (const slot of rows.filter((r) => undeclaredAmbiguousIds.has(Number(r.movement_id)))) {
    expect(slot.declared).toBeNull();
  }
  // Unambiguous movements are unaffected: their sole implement is still theirs.
  const soleById = new Map(store().movements
    .filter((m) => m.supportedPrefixes.length === 1)
    .map((m) => [m.movement_id, m.supportedPrefixes[0]]));
  for (const slot of rows.filter((r) => soleById.has(Number(r.movement_id)))) {
    expect(slot.declared).toBe(soleById.get(Number(slot.movement_id)));
  }
});

test('a declaration is PROSPECTIVE: it never rewrites a block that already exists', async () => {
  await bootRealStore();
  store().generateNewBlock('LINEAR');
  expect(store().error).toBeNull();
  const before = JSON.stringify(slotIntents());

  for (const m of ambiguous().filter((x) => x.supportedPrefixes.includes('Bodyweight'))) {
    expect(store().saveMovementLoadIntent(m.movement_id, 'Bodyweight')).toBe(true);
  }

  // The already-planned slots are untouched. This is what makes the deferred
  // "does planned_implement freeze once trained" question moot: nothing here
  // writes that row a second time.
  expect(JSON.stringify(slotIntents())).toBe(before);
});

// ---------------------------------------------------------------------------
// What a declaration may NOT be
// ---------------------------------------------------------------------------

test('nothing may be declared for a movement with only one way to load it', async () => {
  await bootRealStore();
  const sole = store().movements.find((m) => m.supportedPrefixes.length === 1);
  expect(sole).toBeDefined();

  expect(store().saveMovementLoadIntent(sole.movement_id, sole.supportedPrefixes[0])).toBe(false);
  expect(store().error).not.toBeNull();
  expect(declarations()).toHaveLength(0);
});

test('an implement the movement does not support is refused at the store AND by 063', async () => {
  await bootRealStore();
  const m = ambiguous().find((x) => !x.supportedPrefixes.includes('Cable'));
  expect(m).toBeDefined();

  expect(store().saveMovementLoadIntent(m.movement_id, 'Cable')).toBe(false);
  expect(declarations()).toHaveLength(0);

  // The store guard is not the only guard: 063's trigger refuses it too, so a
  // future writer that skips the store cannot plant an unsupported declaration.
  expect(() => raw()
    .prepare('INSERT INTO movement_load_intent (movement_id, planned_implement, declared_at_ms) VALUES (?, ?, ?)')
    .run(m.movement_id, 'Cable', 1)).toThrow(/not supported by this movement/);
});

test('an unknown movement is refused', async () => {
  await bootRealStore();
  expect(store().saveMovementLoadIntent(999999, 'Bodyweight')).toBe(false);
  expect(store().error).not.toBeNull();
  expect(declarations()).toHaveLength(0);
});

test('declarations survive a training-data reset, like every other preference', async () => {
  await bootRealStore();
  const m = ambiguousWithBodyweight();
  expect(store().saveMovementLoadIntent(m.movement_id, 'Bodyweight')).toBe(true);
  store().generateNewBlock('LINEAR');

  store().resetTrainingData();
  expect(store().error).toBeNull();

  // The wipe clears training history, never the athlete's settings. The
  // per-slot records went with their slots; the declaration itself remains.
  expect(raw().prepare('SELECT COUNT(*) AS c FROM planned_slot_load_intent').get().c).toBe(0);
  expect(store().loadIntents[m.movement_id]).toBe('Bodyweight');
  expect(declarations()).toHaveLength(1);
});
