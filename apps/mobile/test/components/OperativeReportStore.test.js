/**
 * Issue #186: the store carries the operative report and the change it
 * actually applied: the prescription with today's reports against the same
 * derivation without them (after the severity gate and the experience
 * scaling), not the matched entry's cue.
 */
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

jest.setTimeout(60000);

let mockDriver;

jest.mock('@op-engineering/op-sqlite', () => ({ open: () => mockDriver }));
jest.mock('../../src/state/athleteRegistry', () => {
  const core = jest.requireActual('../../src/state/athleteRegistryCore');
  return {
    loadRegistry: async () => ({
      version: 1,
      activeId: core.DEFAULT_ATHLETE_ID,
      advancedToolsUnlocked: false,
      athletes: [{ id: core.DEFAULT_ATHLETE_ID, name: 'Athlete 1', dbName: core.LEGACY_DB_NAME, createdAtMs: 0 }],
    }),
    saveRegistry: async () => undefined,
  };
});

const settle = async () => {
  for (let n = 0; n < 8; n += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({ status: 'booting', error: null, session: null, runner: null, triaging: false, lastTriage: null });
  useStore.getState().setEmbedder(null);
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
  expect(useStore.getState().loadDemoAthlete()).toBe('loaded');
});

test('a gated, non-halting report carries its text and the applied figures', async () => {
  const before = useStore.getState().prescription;
  expect(before?.report ?? null).toBeNull();
  await useStore.getState().reportSubjective('sharp pain in my knee when I squat', 5);
  const { prescription, lastTriage } = useStore.getState();
  expect(lastTriage?.kind).toBe('matched');
  expect(lastTriage.directive.halt).toBe(false);
  expect(prescription.report).toEqual(expect.objectContaining({
    text: 'sharp pain in my knee when I squat',
    effect: expect.objectContaining({ halt: false }),
  }));
  // The applied figure, read against the day without the report.
  const expectedPct = Math.round((1 - prescription.vector.load_modifier / before.vector.load_modifier) * 100);
  expect(prescription.report.effect.loadReductionPct).toBe(expectedPct);
  expect(prescription.report.effect.setDelta).toBe(prescription.vector.set_modifier - before.vector.set_modifier);
});

test('a halting report carries no operative-report line', async () => {
  await useStore.getState().reportSubjective('feeling dizzy', 8);
  expect(useStore.getState().lastTriage?.directive?.halt).toBe(true);
  expect(useStore.getState().prescription?.report ?? null).toBeNull();
});
