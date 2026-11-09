/**
 * OffPlanStart.test.js — #228, with the REAL store (production boot path and
 * migration chain; node:sqlite stands in for the op-sqlite handle only).
 *
 * "Start a session anyway / now" starts a named unfinished planned session of
 * the current block, through the same planned start as today's session; a
 * finished or unknown session is refused and nothing is written.
 */
import { act } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { offPlanStartTarget } from '../../src/state/offPlanStart';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDrivers;
let mockRegistry;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) mockDrivers.set(name, { ...makeNodeSqliteDriver(), close: jest.fn() });
  return mockDrivers.get(name);
}
jest.mock('../../src/navigation/navigation', () => ({ useSubViewBack: () => undefined }));
jest.mock('@op-engineering/op-sqlite', () => ({ open: ({ name }) => mockDriverFor(name) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => mockRegistry,
  saveRegistry: async (next) => { mockRegistry = next; return true; },
}));

jest.setTimeout(120_000);

const A = 'athlete_kinetics.db';
const state = () => useStore.getState();
const raw = () => mockDrivers.get(A).raw;
const settle = async () => { for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); }); };

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDrivers = new Map();
  mockRegistry = { version: 1, activeId: 'default', advancedToolsUnlocked: false, athletes: [
    { id: 'default', name: 'Athlete 1', dbName: A, createdAtMs: 0 },
  ] };
  useStore.setState({
    status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null,
    block: null, program: null, todayPlan: null,
  });
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
  state().saveProfile({ training_age: 'intermediate', objective: 'hypertrophy', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'pullup_bar', 'bands', 'mats'] });
  expect(state().createTrainingProgram({ horizon: { kind: 'weeks', blockCount: 1 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] })).toBe(true);
});

afterEach(async () => {
  await settle();
  jest.restoreAllMocks();
});

test('the off-plan start consumes the named planned session, as a planned start', () => {
  const target = offPlanStartTarget(state().blockSessions, state().today);
  expect(target).not.toBeNull();
  expect(target.kind).toBe('next_planned');
  const id = target.session.plannedSessionId;
  act(() => { state().startSession(false, id); });
  expect(state().error).toBeNull();
  expect(state().session).not.toBeNull();
  const origin = raw().prepare('SELECT origin_kind, source_planned_session_id FROM session_origin').all();
  expect(origin).toEqual([{ origin_kind: 'planned', source_planned_session_id: id }]);
  const planned = raw().prepare('SELECT movement_id FROM planned_slot WHERE planned_session_id = ? ORDER BY slot_index').all(id)
    .map((row) => Number(row.movement_id));
  expect(state().sessionPlan.map((slot) => slot.movementId)).toEqual(planned);
});

test('a session that is not an unfinished planned session of this block is refused, and nothing is written', () => {
  act(() => { state().startSession(false, 999_999); });
  expect(state().session).toBeNull();
  expect(state().error).toMatch(/finished or no longer in your plan/);
  expect(Number(raw().prepare('SELECT COUNT(*) AS c FROM session').get().c)).toBe(0);
});
