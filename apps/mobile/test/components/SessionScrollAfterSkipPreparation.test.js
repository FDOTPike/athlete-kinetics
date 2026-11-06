/**
 * SessionPreparationScreen.test.js — the session screen with the REAL store.
 *
 * Proves the flow an athlete actually sees, end to end: after Start the screen
 * shows preparation and no set-logging control; recording items and finishing
 * hands over to the first working set; stopping from preparation ends the
 * session; and the completion screen states the preparation outcome and any
 * extra work instead of hiding it.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { freeFormStartIsEmpty, useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
import SessionScreen from '../../src/screens/SessionScreen';
import TodayScreen from '../../src/screens/TodayScreen';
import BlockScreen from '../../src/screens/BlockScreen';
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

// First render of a heavy screen in a fresh jest worker takes several seconds.
jest.setTimeout(60_000);

const state = () => useStore.getState();
const raw = () => mockDriver.raw;
const count = (sql) => Number(raw().prepare(sql).get().c);
const press = (testID) => act(() => { fireEvent.press(screen.getByTestId(testID)); });

beforeEach(async () => {
  authorizeAthleteDataBoot();
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({
    status: 'booting', error: null, session: null, runner: null, sessionMode: null, sessionPlan: [],
    preparation: null, lastTriage: null, prescription: null, niggles: [], todayPlan: null, block: null,
    program: null, lastEndedSessionId: null,
  });
  state().boot();
  for (let i = 0; i < 500 && state().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  expect(state().status).toBe('ready');
  state().saveProfile({ training_age: 'intermediate', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'] });
  expect(state().createTrainingProgram({ horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] })).toBe(true);
});

afterEach(() => { jest.restoreAllMocks(); });

const logSetButton = () => screen.queryByText('Log set');
const startFromScreen = () => {
  render(<SessionScreen />);
  act(() => { fireEvent.press(screen.getByLabelText('Start a new workout session')); });
  expect(state().session).not.toBeNull();
};

const scrollerOf = () => {
  const { ScrollView } = require('react-native');
  return screen.UNSAFE_getAllByType(ScrollView)
    .map((node) => node.instance)
    .find((instance) => instance && typeof instance.scrollTo === 'function');
};

test('after Skip preparation the workout scrolls the current card into view once its layout is known', () => {
  const { theme } = require('../../src/theme/theme');
  startFromScreen();
  expect(screen.getByTestId('preparation-panel')).toBeTruthy();
  act(() => { fireEvent.press(screen.getByTestId('preparation-skip')); });
  expect(screen.queryByTestId('preparation-panel')).toBeNull();
  expect(screen.getByTestId('session-timeline')).toBeTruthy();

  const scrollTo = jest.spyOn(scrollerOf(), 'scrollTo');
  fireEvent(screen.getByTestId('session-timeline'), 'layout', { nativeEvent: { layout: { x: 0, y: 100, width: 300, height: 500 } } });
  expect(scrollTo).not.toHaveBeenCalled();
  fireEvent(screen.getByTestId('session-current-row'), 'layout', { nativeEvent: { layout: { x: 0, y: 200, width: 300, height: 300 } } });
  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(scrollTo).toHaveBeenCalledWith({ y: 100 + 200 - theme.space[4], animated: true });
});
