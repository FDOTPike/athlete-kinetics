import { act } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';
import { targetLoadKg } from '@ak/inference';

jest.setTimeout(60_000);

let drivers;
let mockRegistry;

function mockDriverFor(name) {
  if (!drivers.has(name)) drivers.set(name, { ...makeNodeSqliteDriver(), close: () => {} });
  return drivers.get(name);
}

jest.mock('@op-engineering/op-sqlite', () => ({
  open: ({ name }) => mockDriverFor(name),
}));

jest.mock('../../src/state/athleteRegistry', () => {
  const actual = jest.requireActual('../../src/state/athleteRegistryCore');
  return {
    ...actual,
    loadRegistry: async () => mockRegistry,
    saveRegistry: async (next) => { mockRegistry = next; return true; },
  };
});

// Owner ruling 2026-11-03 (PR #194, commit b4fe6b42; Entry 0300; issue #297;
// walk finding W2-3): logged loads sit on
// a 0.5 kg grid, so a 12, 14, 16 or 24 kg dumbbell or kettlebell is stored as
// lifted. Before, the store rounded every load to 2.5 kg (12 became 12.5).

const flush = async () => {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

beforeEach(() => {
  drivers = new Map();
  mockRegistry = {
    version: 1, activeAthleteId: 'default', advancedToolsUnlocked: false,
    athletes: [{ id: 'default', name: 'Primary Athlete', dbName: 'athlete_kinetics.db', createdAtMs: 1 }],
  };
  authorizeAthleteDataBoot();
  useStore.setState({ status: 'idle', error: null, session: null });
});

afterEach(() => {
  for (const d of drivers.values()) { try { d.raw.close(); } catch { /* already closed */ } }
});

// Issue #233: the grid is now 0.25 kg, for 1.25 kg change plates.
test('logged and edited loads keep 0.25 kg steps; anything finer still rounds to 0.25', async () => {
  useStore.getState().boot();
  await flush();
  expect(useStore.getState().status).toBe('ready');
  const driver = drivers.get('athlete_kinetics.db');
  // An available, rep-based movement (the first available one may be timed).
  const available = new Set(useStore.getState().getMovementAvailabilityVerdicts('weight_room')
    .filter((v) => v.state === 'available').map((v) => v.movementId));
  const movementId = useStore.getState().movements
    .find((m) => available.has(m.movement_id) && m.loggingMode !== 'time').movement_id;

  act(() => {
    useStore.getState().startSession();
    const prep = useStore.getState().preparation;
    if (prep !== null) useStore.getState().finishPreparation('already_warm', prep.revision);
    useStore.setState({ runner: null });
    useStore.getState().addPlanSlot(movementId);
    const slot = useStore.getState().sessionPlan[0];
    for (const kg of [12, 16, 24, 12.3, 22.75, 251.25, 22.1]) {
      useStore.getState().logSet(slot.movementId, 5, kg, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
    }
  });
  expect(useStore.getState().error).toBeNull();
  const loads = () => driver.raw.prepare('SELECT load_kg FROM set_record ORDER BY set_id').all().map((r) => r.load_kg);
  expect(loads()).toEqual([12, 16, 24, 12.25, 22.75, 251.25, 22]);

  const firstId = driver.raw.prepare('SELECT MIN(set_id) AS id FROM set_record').get().id;
  act(() => { useStore.getState().editSet(firstId, 5, 14, 8); });
  expect(loads()[0]).toBe(14);
  act(() => { useStore.getState().editSet(firstId, 5, 13.75, 8); });
  expect(loads()[0]).toBe(13.75);
});

test('one-rep maxes keep 0.25 kg steps; anything finer rounds to 0.25', async () => {
  useStore.getState().boot();
  await flush();
  expect(useStore.getState().status).toBe('ready');
  const movementId = useStore.getState().movements[0].movement_id;
  act(() => { useStore.getState().saveOneRepMax(movementId, 251.25); });
  expect(useStore.getState().oneRepMaxes[movementId]).toBe(251.25);
  act(() => { useStore.getState().saveOneRepMax(movementId, 22.1); });
  expect(useStore.getState().oneRepMaxes[movementId]).toBe(22);
});

test('a suggestion from a quarter-kilogram max stays on the 2.5 kg plate grid', () => {
  for (const reps of [1, 3, 5, 8]) {
    const kg = targetLoadKg(251.25, reps, 8);
    expect(Math.abs(kg / 2.5 - Math.round(kg / 2.5))).toBeLessThan(1e-9);
  }
});
