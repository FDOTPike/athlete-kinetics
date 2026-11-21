/**
 * PendingAutopilotAdjustmentsStore.test.js — what the real store's
 * getPendingAutopilotAdjustments() returns for the active block, over the
 * production migration chain (node:sqlite stands in for op-sqlite).
 *
 * A time-mode movement with a time policy keeps the policy's set count at
 * block commit (defaultSetsForTarget), so its stored set delta was never
 * applied: a set-only row is left out, and a row with an RPE change reports
 * setDelta 0. Every other row reports its stored set delta.
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

// The first boot in a fresh jest worker loads the full migration chain.
jest.setTimeout(60_000);

const state = () => useStore.getState();
const raw = () => mockDriver.raw;

beforeEach(async () => {
  authorizeAthleteDataBoot();
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({ status: 'booting', error: null, session: null, runner: null, block: null, program: null });
  state().boot();
  for (let i = 0; i < 500 && state().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  expect(state().status).toBe('ready');
});

test('the getter reports setDelta 0 for a time-policy movement and the stored set delta otherwise', () => {
  const db = raw();
  db.exec("UPDATE training_block SET status = 'archived' WHERE status = 'active'");
  db.exec("INSERT INTO movement (movement_id,name,pattern,is_compound) VALUES (99950,'Timed Hold A','carry',0),(99951,'Timed Hold B','carry',0),(99952,'Timed No Policy','carry',0),(99953,'Plain Row','pull_h',1)");
  db.exec("INSERT INTO movement_logging_mode (movement_id,mode) VALUES (99950,'time'),(99951,'time'),(99952,'time')");
  db.exec("INSERT INTO movement_time_policy (movement_id,default_sets,target_seconds) VALUES (99950,3,30),(99951,3,30)");
  db.exec("INSERT INTO training_block (block_id,start_date,objective,status,created_at_ms) VALUES (99950,'2030-05-01','strength','active',0)");
  db.exec("INSERT INTO planned_session (planned_session_id,block_id,week_index,day_index,focus,phase,session_date) VALUES (99950,99950,1,1,'full','accumulation','2030-05-01')");
  db.exec("INSERT INTO planned_slot (planned_slot_id,planned_session_id,slot_index,movement_id,sets,reps,target_rpe) VALUES (99950,99950,1,99950,3,30,7.0),(99951,99950,2,99951,3,30,6.5),(99952,99950,3,99952,2,30,7.0),(99953,99950,4,99953,2,8,7.0)");
  db.exec("INSERT INTO planned_slot_autopilot (planned_slot_id,rpe_delta,set_delta,reason) VALUES (99950,0,-1,'eased'),(99951,-0.5,-1,'eased'),(99952,0,-1,'eased'),(99953,0,-1,'eased')");

  const rows = state().getPendingAutopilotAdjustments()
    .map(({ plannedSlotId, rpeDelta, setDelta, reason }) => ({ plannedSlotId, rpeDelta, setDelta, reason }));
  expect(rows).toEqual([
    // Time policy with an RPE change: the RPE change stays, the set change was not applied.
    { plannedSlotId: 99951, rpeDelta: -0.5, setDelta: 0, reason: 'eased' },
    // Timed movement without a policy: its set delta was applied.
    { plannedSlotId: 99952, rpeDelta: 0, setDelta: -1, reason: 'eased' },
    // Reps movement: its set delta was applied.
    { plannedSlotId: 99953, rpeDelta: 0, setDelta: -1, reason: 'eased' },
  ]);
});
