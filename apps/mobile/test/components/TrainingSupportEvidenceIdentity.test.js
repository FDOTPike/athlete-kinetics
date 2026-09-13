import { useStore } from '../../src/state/useStore';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDriver;
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

const state = () => useStore.getState();
const evidenceFor = (operation) => mockDriver.raw.prepare(`SELECT decision_id,advice_target_identity AS identity
  FROM recommendation_support_record WHERE advice_target_identity LIKE ? ORDER BY generated_at_ms DESC LIMIT 1`).get(`${operation}:%`);

beforeEach(async () => {
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({ status: 'booting', error: null, session: null, runner: null });
  state().boot();
  await new Promise((resolve) => setImmediate(resolve));
  expect(state().status).toBe('ready');
});

test('real block, session and substitution entry points persist factual target identities', () => {
  state().generateNewBlock('LINEAR');
  const blockEvidence = evidenceFor('block-commit');
  expect(blockEvidence.identity).toMatch(new RegExp(
    `^block-commit:block-candidate:${state().today}:LINEAR:pnone:[0-9a-f]{64}$`,
  ));
  expect(blockEvidence.identity).not.toContain(blockEvidence.decision_id);

  const plannedSessionId = state().todayPlan.plannedSessionId;
  state().startSession();
  const sessionEvidence = evidenceFor('session-start-commit');
  expect(sessionEvidence.identity).toBe(`session-start-commit:planned-session:${plannedSessionId}`);
  expect(sessionEvidence.identity).not.toContain(sessionEvidence.decision_id);

  const slot = state().sessionPlan[0];
  state().openSubstitution(slot.movementId);
  const substitutionEvidence = evidenceFor('substitution-preview');
  expect(substitutionEvidence.identity).toBe(
    `substitution-preview:session:${state().session.sessionId}:slot:${slot.sessionPlanSlotId}:movement:${slot.movementId}`,
  );
  expect(substitutionEvidence.identity).not.toContain(substitutionEvidence.decision_id);

  state().addPlanSlot(slot.movementId);
  expect(evidenceFor('add-plan-slot').identity).toBe(
    `add-plan-slot:session:${state().session.sessionId}:slot:new:movement:${slot.movementId}`,
  );

  const destination = state().sessionPlan[1];
  state().selectMovementSlot(destination.sessionPlanSlotId);
  expect(evidenceFor('select-slot').identity).toBe(
    `select-slot:session:${state().session.sessionId}:slot:${destination.sessionPlanSlotId}:movement:${destination.movementId}`,
  );
  state().logSet(destination.movementId, destination.plannedReps ?? 5, 0, 5,
    undefined, undefined, undefined, undefined, destination.sessionPlanSlotId);
  expect(evidenceFor('log-set').identity).toBe(
    `log-set:session:${state().session.sessionId}:slot:${destination.sessionPlanSlotId}:movement:${destination.movementId}`,
  );
  state().skipRunnerRest();
  state().runnerSkipSlot();
  expect(evidenceFor('skip-to-next-slot').identity).toBe(
    `skip-to-next-slot:session:${state().session.sessionId}:slot:${state().activeSessionPlanSlotId ?? 'complete'}`,
  );
});

test('block regeneration evidence identifies the candidate and never the active block it will archive', () => {
  state().generateNewBlock('LINEAR');
  const oldBlockId = state().block.blockId;
  state().generateNewBlock('WAVE');
  expect(state().block.blockId).not.toBe(oldBlockId);
  const evidence = evidenceFor('block-commit');
  expect(evidence.identity).toMatch(new RegExp(
    `^block-commit:block-candidate:${state().today}:WAVE:pnone:[0-9a-f]{64}$`,
  ));
  expect(evidence.identity).not.toContain(`block:${oldBlockId}`);
});

test('openSubstitution support reads stay bounded by support state, not a 400-candidate library', () => {
  const seedMovement = state().movements.find((movement) => movement.name === 'Push-Up') ?? state().movements[0];
  const candidates = Array.from({ length: 400 }, (_, index) => ({
    ...seedMovement,
    movement_id: 100000 + index,
    name: `Synthetic candidate ${index}`,
    required: [],
    difficulty: 'Beginner',
    beginnerOk: true,
  }));
  const insertMovement = mockDriver.raw.prepare('INSERT INTO movement(movement_id,name,pattern,is_compound) VALUES (?,?,?,?)');
  const insertHold = mockDriver.raw.prepare(`INSERT INTO health_support_hold
    (hold_id,revision,origin,state,reason_code,created_at_ms,updated_at_ms)
    VALUES (?,1,'user_requested','held','review_requested',1,1)`);
  const insertScope = mockDriver.raw.prepare(`INSERT INTO health_support_scope
    (scope_id,hold_id,target_kind,movement_id) VALUES (?,?,'movement',?)`);
  for (let index = 0; index < 64; index += 1) {
    const movementId = 200000 + index;
    insertMovement.run(movementId, `Held fixture ${index}`, 'squat', 0);
    insertHold.run(`hold-${index}`);
    insertScope.run(`scope-${index}`, `hold-${index}`, movementId);
  }
  useStore.setState({
    movements: candidates,
    profile: { ...state().profile, training_age: 'advanced', equipment_inventory: [] },
    todayPlan: null,
    block: null,
  });

  let supportReads = 0;
  const executeSync = mockDriver.executeSync.bind(mockDriver);
  mockDriver.executeSync = (sql, values) => {
    if (/^\s*(SELECT|WITH)\b/i.test(String(sql))
      && /(sqlite_master|health_support_|clinician_instruction|recommendation_support_record)/i.test(String(sql))) {
      supportReads += 1;
    }
    return executeSync(sql, values);
  };
  state().openSubstitution(candidates[0].movement_id);

  expect(state().substitution).not.toBeNull();
  expect(supportReads).toBeLessThanOrEqual(140);
});
