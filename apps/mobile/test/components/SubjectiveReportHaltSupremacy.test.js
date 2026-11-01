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
