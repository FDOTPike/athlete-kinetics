/**
 * SuspensionRpeRaise.test.js — a block generated while a suspension is open
 * gets no autopilot effort raise (owner ruling 2026-10-13,
 * docs/decisions/SUSPENSION_RPE_RAISE_2026-10-13.md).
 *
 * The real zustand store over the real migration chain. The history seeded
 * here reads as clear headroom, so the autopilot grants its half point when it
 * is allowed to. The tests then pin, through `generateNewBlock`:
 *
 *   - outside a suspension the raise is granted, at a granting position;
 *   - during a suspension it is not, for every block generated in the episode,
 *     however many there are (the gap: each used to be offered the frozen
 *     position's grant again);
 *   - the suspension still does what it did: the block takes the frozen
 *     position, consumes none, and is attributed to the episode;
 *   - after the suspension ends the raise is available again at the position
 *     that was frozen;
 *   - a block generated during a suspension can still be eased: a history that
 *     reads as a deficit is cut exactly as it is outside one.
 */
import { useStore, localToday } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDriver;
jest.mock('@op-engineering/op-sqlite', () => ({ open: () => mockDriver }));
jest.mock('../../src/state/athleteRegistry', () => {
  const core = jest.requireActual('../../src/state/athleteRegistryCore');
  return {
    loadRegistry: async () => ({ version: 1, activeId: core.DEFAULT_ATHLETE_ID, advancedToolsUnlocked: false,
      athletes: [{ id: core.DEFAULT_ATHLETE_ID, name: 'Athlete 1', dbName: core.LEGACY_DB_NAME, createdAtMs: 0 }] }),
    saveRegistry: async () => undefined,
  };
});

// The first heavy module load in a fresh jest worker is slow.
jest.setTimeout(60_000);

const store = () => useStore.getState();
const raw = () => mockDriver.raw;
const all = (sql, ...params) => raw().prepare(sql).all(...params);

const boot = async () => {
  authorizeAthleteDataBoot();
  useStore.setState({ status: 'booting', error: null });
  store().boot();
  for (let i = 0; i < 500 && store().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  expect(store().status).toBe('ready');
};

beforeEach(async () => {
  mockDriver = makeNodeSqliteDriver();
  await boot();
  // Effort authority belongs to athletes past the beginner tier.
  store().saveProfile({ training_age: 'intermediate', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'] });
  expect(store().error).toBeNull();
});

/** Eighteen training days running up to yesterday. On each, three sets of one
 *  movement of every pattern the library has, with a frozen effort target and
 *  the effort logged. Target 9 logged 6 reads as clear headroom; target 6
 *  logged 9.5 reads as a clear deficit. The detector weighs recency and the
 *  share of the three-week window that has evidence, so a thin history reads
 *  as neutral and would prove nothing here. */
const seedHistory = (target, logged) => {
  const perPattern = all('SELECT pattern, MIN(movement_id) AS movement_id FROM movement GROUP BY pattern');
  let setId = 50_000;
  for (let day = 0; day < 18; day += 1) {
    const sessionId = 40_000 + day;
    raw().prepare("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (?, NULL, date(?, ?), ?, 45)")
      .run(sessionId, localToday(), `-${1 + day} days`, 1_000 + day);
    for (const { movement_id: movementId } of perPattern) {
      for (let index = 1; index <= 3; index += 1) {
        setId += 1;
        raw().prepare('INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (?, ?, ?, ?, 8, 40, ?, ?)')
          .run(setId, sessionId, movementId, index, logged, 2_000 + setId);
        raw().prepare("INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms) VALUES (?, NULL, 'planned', ?, 1, ?)")
          .run(setId, target, 2_000 + setId);
      }
    }
  }
};

const lastBlockId = () => Number(raw().prepare('SELECT MAX(block_id) AS id FROM block_meta').get().id);
const macroIndexOf = (blockId) => Number(raw().prepare('SELECT macro_block_index AS i FROM block_meta WHERE block_id = ?').get(blockId).i);
/** The autopilot's stored corrections for one block. */
const deltasOf = (blockId) => all(
  `SELECT a.rpe_delta, a.set_delta FROM planned_slot_autopilot a
   JOIN planned_slot ps ON ps.planned_slot_id = a.planned_slot_id
   JOIN planned_session s ON s.planned_session_id = ps.planned_session_id
   WHERE s.block_id = ?`, blockId);
const raisesIn = (blockId) => deltasOf(blockId).filter((row) => row.rpe_delta > 0).length;
const cutsIn = (blockId) => deltasOf(blockId).filter((row) => row.rpe_delta < 0).length;
const generate = () => {
  store().generateNewBlock('LINEAR');
  expect(store().error).toBeNull();
  return lastBlockId();
};

test('outside a suspension the raise is granted; during one it is withheld from every block of the episode; afterwards it is available again at the frozen position', () => {
  seedHistory(9, 6);
  const first = generate();
  expect(macroIndexOf(first)).toBeLessThanOrEqual(5);
  // The history does earn the raise: without this the rest would prove nothing.
  expect(raisesIn(first)).toBeGreaterThanOrEqual(1);

  const frozen = store().beginSuspension('injury', 1_756_000_000_000);
  expect(frozen).toBeLessThanOrEqual(5);
  const during = [generate(), generate(), generate(), generate()];
  for (const blockId of during) {
    // The suspension still does what it did: frozen position, attributed to the episode.
    expect(macroIndexOf(blockId)).toBe(frozen);
    expect(all('SELECT episode_id FROM block_suspension_origin WHERE block_id = ?', blockId)).toHaveLength(1);
    // And no slot of the block is raised.
    expect(raisesIn(blockId)).toBe(0);
    expect(all(
      `SELECT ps.planned_slot_id FROM planned_slot ps JOIN planned_session s ON s.planned_session_id = ps.planned_session_id
       JOIN planned_slot_autopilot a ON a.planned_slot_id = ps.planned_slot_id WHERE s.block_id = ? AND a.rpe_delta > 0`, blockId)).toEqual([]);
  }

  store().endSuspension(1_757_000_000_000);
  expect(store().activeSuspension()).toBeNull();
  const after = generate();
  // Resume returns to exactly the frozen position, and that position's grant is its ordinary single use.
  expect(macroIndexOf(after)).toBe(frozen);
  expect(all('SELECT episode_id FROM block_suspension_origin WHERE block_id = ?', after)).toHaveLength(0);
  expect(raisesIn(after)).toBeGreaterThanOrEqual(1);
});

test.each(['injury', 'illness', 'life'])('the raise is withheld whatever the suspension is for (%s)', (reason) => {
  seedHistory(9, 6);
  // The history earns the raise before the suspension, so its absence afterwards is the rule at work.
  expect(raisesIn(generate())).toBeGreaterThanOrEqual(1);
  store().beginSuspension(reason, 1_756_000_000_000);
  expect(store().error).toBeNull();
  expect(raisesIn(generate())).toBe(0);
});

test('a block generated during a suspension is still eased: a history that reads as a deficit is cut as it is outside one', () => {
  seedHistory(6, 9.5);
  const open = generate();
  expect(cutsIn(open)).toBeGreaterThanOrEqual(1);
  expect(raisesIn(open)).toBe(0);
  store().beginSuspension('injury', 1_756_000_000_000);
  const suspended = generate();
  expect(raisesIn(suspended)).toBe(0);
  // The same cuts, slot for slot: the suspension withholds a raise and takes nothing else away.
  const shape = (blockId) => JSON.stringify(deltasOf(blockId).map((row) => [row.rpe_delta, row.set_delta]).sort());
  expect(cutsIn(suspended)).toBe(cutsIn(open));
  expect(shape(suspended)).toBe(shape(open));
});
