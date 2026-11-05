import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import ReadinessScreen from '../../src/screens/ReadinessScreen';
import TodayScreen from '../../src/screens/TodayScreen';
import BlockScreen from '../../src/screens/BlockScreen';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDriver;

jest.mock('../../src/navigation/navigation', () => ({ useSubViewBack: () => undefined }));
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

test('an unmatched follow-up reply in "Something feels off" logs the reply without clearing an active safety halt across Today, Ready, Plan, and startSession', async () => {
  await useStore.getState().reportSubjective('feeling dizzy', 8);
  expect(useStore.getState().lastTriage?.kind).toBe('matched');
  expect(useStore.getState().lastTriage?.directive?.halt).toBe(true);

  await useStore.getState().reportSubjective('no change yet', 5);

  const loggedRows = mockDriver.raw
    .prepare('SELECT raw_text, matched_entry_id, halt FROM subjective_report WHERE raw_text = ?')
    .all('no change yet');
  expect(loggedRows).toEqual([{ raw_text: 'no change yet', matched_entry_id: null, halt: 0 }]);

  expect(useStore.getState().lastTriage?.kind).toBe('matched');
  expect(useStore.getState().lastTriage?.directive?.halt).toBe(true);

  useStore.getState().startSession();
  expect(useStore.getState().session).toBeNull();

  const { unmount: unmountToday } = render(<TodayScreen />);
  expect(screen.getByTestId('today-card-halted')).toBeOnTheScreen();
  expect(screen.queryByTestId('today-primary-start')).toBeNull();
  unmountToday();

  const { unmount: unmountReady } = render(<ReadinessScreen />);
  expect(screen.getByText("Resolve today's safety report")).toBeOnTheScreen();
  expect(screen.queryByText('Ready to train')).toBeNull();
  unmountReady();

  render(<BlockScreen />);
  expect(screen.getByText('Training is paused')).toBeOnTheScreen();
  expect(screen.getByText('Stop training today')).toBeOnTheScreen();
});

test('an unmatched report sets lastTriage to rejected when no safety halt is active', async () => {
  await useStore.getState().reportSubjective('no change yet', 5);
  expect(useStore.getState().lastTriage).toEqual({ kind: 'rejected' });
});

// reportSubjective reports whether the report was persisted. A caller shows
// "not sent" and keeps the typed text on false, so every early exit must say so.
describe('reportSubjective returns true only when the report is stored', () => {
  const reportCount = () => mockDriver.raw.prepare('SELECT COUNT(*) AS n FROM subjective_report').all()[0].n;

  test('a stored unmatched report and a stored safety report both return true', async () => {
    await expect(useStore.getState().reportSubjective('no change yet', 5)).resolves.toBe(true);
    await expect(useStore.getState().reportSubjective('feeling dizzy', 8)).resolves.toBe(true);
    expect(reportCount()).toBe(2);
  });

  test('empty or over-long text returns false and stores nothing', async () => {
    const before = reportCount();
    await expect(useStore.getState().reportSubjective('   ', 5)).resolves.toBe(false);
    await expect(useStore.getState().reportSubjective('x'.repeat(501), 5)).resolves.toBe(false);
    expect(reportCount()).toBe(before);
  });

  test('a store that is not ready, has no readiness vector, or is already checking returns false', async () => {
    const before = reportCount();
    const vector = useStore.getState().vector;
    useStore.setState({ status: 'booting' });
    await expect(useStore.getState().reportSubjective('no change yet', 5)).resolves.toBe(false);
    useStore.setState({ status: 'ready', vector: null });
    await expect(useStore.getState().reportSubjective('no change yet', 5)).resolves.toBe(false);
    useStore.setState({ status: 'ready', vector, triaging: true });
    await expect(useStore.getState().reportSubjective('no change yet', 5)).resolves.toBe(false);
    useStore.setState({ triaging: false });
    expect(reportCount()).toBe(before);
  });

  test('a report the data lock refuses returns false and stores nothing', async () => {
    const before = reportCount();
    resetDataMaintenanceLockForTests();
    try {
      await expect(useStore.getState().reportSubjective('no change yet', 5)).resolves.toBe(false);
    } finally {
      authorizeAthleteDataBoot();
    }
    expect(reportCount()).toBe(before);
  });

  test('a report whose athlete changes during the check returns false and stores nothing', async () => {
    const before = reportCount();
    const athleteId = useStore.getState().activeAthleteId;
    useStore.getState().setEmbedder({
      embed: async () => {
        useStore.setState({ activeAthleteId: 'someone-else' });
        return new Float32Array(384);
      },
    });
    try {
      await expect(useStore.getState().reportSubjective('feeling dizzy', 8)).resolves.toBe(false);
    } finally {
      useStore.getState().setEmbedder(null);
      useStore.setState({ activeAthleteId: athleteId });
    }
    expect(reportCount()).toBe(before);
  });

  test('a storage error while writing returns false, rolls back, and stores nothing', async () => {
    const before = reportCount();
    const original = mockDriver.executeSync.bind(mockDriver);
    const spy = jest.spyOn(mockDriver, 'executeSync').mockImplementation((sql, params) => {
      if (/VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?\)/.test(sql)) throw new Error('disk full');
      return original(sql, params);
    });
    try {
      await expect(useStore.getState().reportSubjective('feeling dizzy', 8)).resolves.toBe(false);
    } finally {
      spy.mockRestore();
    }
    expect(reportCount()).toBe(before);
    expect(useStore.getState().error).toContain('disk full');
  });
});
