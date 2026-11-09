import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
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

// The lazy embedder's session is created on the first embed call, so a model
// that cannot load fails there, not at construction.
const failingEmbedder = {
  modelId: 'test-model',
  dim: 384,
  embed: async () => { throw new Error('embedder session could not be created'); },
};
const workingEmbedder = {
  modelId: 'test-model',
  dim: 384,
  embed: async () => new Float32Array(384),
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

test('a report whose matching could not run marks matching unavailable', async () => {
  useStore.getState().setEmbedder(failingEmbedder);
  await useStore.getState().reportSubjective('no change yet', 5);
  expect(useStore.getState().triageReady).toBe(false);
  expect(useStore.getState().lastTriage).toEqual({ kind: 'rejected' });
});

test('a report whose matching could not run says matching was unavailable, not that it did not match', async () => {
  useStore.getState().setEmbedder(failingEmbedder);
  await useStore.getState().reportSubjective('no change yet', 5);
  render(<BlockScreen />);
  fireEvent.press(screen.getByText('Something feels off'));
  expect(screen.getByText(/Matching is unavailable, so this report was not matched/)).toBeOnTheScreen();
  expect(screen.getAllByText(/Injury-language safety checks still apply/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/did not match this to a known scenario/)).toBeNull();
});

test('a report that matching ran on and did not match still says it did not match', async () => {
  useStore.getState().setEmbedder(workingEmbedder);
  await useStore.getState().reportSubjective('no change yet', 5);
  expect(useStore.getState().triageReady).toBe(true);
  render(<BlockScreen />);
  fireEvent.press(screen.getByText('Something feels off'));
  expect(screen.getByText(/did not match this to a known scenario/)).toBeOnTheScreen();
  expect(screen.queryByText(/Matching is unavailable/)).toBeNull();
});
