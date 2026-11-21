/**
 * RestAfterBodyweightSets.test.js — issue #209 with the REAL store: a set of
 * 0 kg on a bodyweight movement rests 60 s below RPE 8 and 90 s at RPE 8 or
 * above; the same movement with added load keeps the RPE-band rest. By load,
 * never by tier (docs/decisions/REST_AFTER_BODYWEIGHT_SETS_2026-11-05.md).
 */
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';
import { deserializeRunner } from '../../../../packages/inference/src/sessionRunner';

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
});

afterEach(() => { jest.restoreAllMocks(); });

/** A started free-form session repeating an earlier Push-up session. */
const startPushUpSession = (trainingAge) => {
  state().saveProfile({ training_age: trainingAge, equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'] });
  raw().exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (9000, NULL, '2026-01-05', 1000, 40)");
  raw().prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (9000, ?, 1, 8, 0, 7, 2000)')
    .run(idOf('Push-up'));
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);
  useStore.setState({ error: null });
  const slot = state().sessionPlan.find((s) => s.movementId === idOf('Push-up'));
  expect(slot).toBeDefined();
  return slot;
};

test.each(['beginner', 'intermediate', 'advanced', 'elite'])(
  '%s: a bodyweight set at RPE 7 rests 60 s; added load rests by RPE band; the checkpoint keeps it',
  async (trainingAge) => {
    const slot = startPushUpSession(trainingAge);
    const log = (loadKg, rpe) => {
      state().logSet(slot.movementId, 8, loadKg, rpe, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
      expect(state().error).toBeNull();
      return state().runner.restSecondsTarget;
    };
    expect(log(0, 7)).toBe(60);
    const checkpoint = deserializeRunner(raw().prepare('SELECT runner_state_json FROM session_runner_checkpoint').get().runner_state_json);
    expect(checkpoint.restSecondsTarget).toBe(60);
    expect(checkpoint.restBodyweight).toBe(true);
    state().skipRunnerRest();
    // The same movement with added load is not a bodyweight set.
    expect(log(10, 9)).toBe(240);
  },
);
