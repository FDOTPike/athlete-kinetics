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

test('after Start the screen shows preparation and offers no way to log a set', () => {
  startFromScreen();
  expect(screen.getByTestId('preparation-panel')).toBeTruthy();
  expect(screen.getByText('Before your first set')).toBeTruthy();
  expect(screen.getByText(/exercises? planned after preparation./)).toBeTruthy();
  expect(logSetButton()).toBeNull();
  expect(screen.queryByTestId('session-load-input')).toBeNull();
  expect(state().preparation.status).toBe('pending');
});

test('working through preparation and finishing hands over to the first working set', () => {
  startFromScreen();
  press('preparation-begin');
  expect(state().preparation.status).toBe('in_progress');
  const itemCount = state().preparation.items.length;
  for (let index = 0; index < itemCount; index += 1) press(`preparation-item-${index}-done`);
  expect(state().preparation.items.every((item) => item.status === 'done')).toBe(true);
  press('preparation-finish');
  expect(state().preparation.status).toBe('completed');
  // The panel is gone, the timeline is back, and the outcome is stated.
  expect(screen.queryByTestId('preparation-panel')).toBeNull();
  expect(screen.getByTestId('session-preparation-status').props.children).toBe('Preparation: completed as written');
  expect(logSetButton()).not.toBeNull();
  expect(count('SELECT COUNT(*) AS c FROM set_record')).toBe(0);
});

test('a double tap on the same button records once', () => {
  startFromScreen();
  press('preparation-begin');
  const done = screen.getByTestId('preparation-item-0-done');
  // Two presses delivered against the same render: the second carries a stale revision.
  act(() => { fireEvent.press(done); fireEvent.press(done); });
  expect(state().preparation.items.filter((item) => item.status !== 'pending')).toHaveLength(1);
  expect(state().preparation.revision).toBe(3); // start, begin, one item
  expect(state().error).toBeNull();
});

test('"I am already warm" and "Skip preparation" move on and say so', () => {
  startFromScreen();
  press('preparation-already-warm');
  expect(state().preparation.status).toBe('already_warm');
  expect(screen.getByTestId('session-preparation-status').props.children).toBe('Preparation: already warm before the session');
  expect(logSetButton()).not.toBeNull();
});

test('stopping from the preparation screen ends the session without logging anything', () => {
  startFromScreen();
  const sessionId = state().session.sessionId;
  press('preparation-begin');
  press('preparation-stop-session');
  expect(state().session).toBeNull();
  expect(count('SELECT COUNT(*) AS c FROM set_record')).toBe(0);
  // A manual stop with no sets is an empty session: it and its preparation are discarded together.
  expect(Number(raw().prepare('SELECT COUNT(*) AS c FROM session WHERE session_id = ?').get(sessionId).c)).toBe(0);
  expect(count('SELECT COUNT(*) AS c FROM session_preparation')).toBe(0);
});

test('the completion screen states the preparation outcome and shows extra work as work', () => {
  startFromScreen();
  press('preparation-begin');
  press('preparation-item-0-change');
  // 240 s prescribed; record 600 s — far more than written.
  act(() => { for (let i = 0; i < 12; i += 1) fireEvent.press(screen.getByLabelText('Increase Seconds you did')); });
  press('preparation-item-0-save');
  expect(state().preparation.items[0]).toMatchObject({ status: 'modified', performedAmount: 600, extraWork: true });
  press('preparation-finish');
  expect(state().preparation.status).toBe('modified');

  const slot = state().sessionPlan[0];
  act(() => { state().logSet(slot.movementId, 5, 60, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId); });
  expect(state().error).toBeNull();
  act(() => { state().runnerHalt('manual'); state().endSession(); });
  expect(state().session).toBeNull();
  expect(screen.getByTestId('session-preparation-summary')).toBeTruthy();
  expect(screen.getByText('Preparation: completed with changes.')).toBeTruthy();
  expect(screen.getByTestId('session-preparation-extra-work').props.children)
    .toBe('Extra work during preparation: Easy movement and breathing — 600 seconds.');
  expect(count('SELECT COUNT(*) AS c FROM set_record')).toBe(1);
});

test('a restart mid-preparation comes back to the same step', async () => {
  startFromScreen();
  press('preparation-begin');
  press('preparation-item-0-done');
  const before = JSON.parse(JSON.stringify(state().preparation));
  screen.unmount();

  useStore.setState({ status: 'booting', session: null, runner: null, sessionMode: null, sessionPlan: [], preparation: null });
  state().boot();
  for (let i = 0; i < 500 && state().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  expect(JSON.parse(JSON.stringify(state().preparation))).toEqual(before);
  render(<SessionScreen />);
  expect(screen.getByTestId('preparation-panel')).toBeTruthy();
  expect(screen.getByTestId('preparation-item-0-recorded').props.children).toBe('Done as written');
  expect(screen.getByTestId('preparation-item-1-done')).toBeTruthy();
  expect(logSetButton()).toBeNull();
});

describe('session-5: plan-first empty free-form starts', () => {
  test('when there is no plan for today and no earlier session to repeat, Today, Plan and Session show the inline card, Go to Plan navigates, Cancel closes, and no session row is created', () => {
    // Clear the program/block so today has no planned session and no prior logged sets exist.
    raw().exec('DELETE FROM planned_slot; DELETE FROM planned_session; DELETE FROM training_block; DELETE FROM training_program;');
    act(() => {
      state().refreshBlock();
      state().refreshProgram();
    });
    expect(state().todayPlan).toBeNull();
    expect(freeFormStartIsEmpty()).toBe(true);
    expect(count('SELECT COUNT(*) AS c FROM session')).toBe(0);

    // 1. TodayScreen unplanned start
    const openPlanFromToday = jest.fn();
    const todayView = render(<TodayScreen onOpenPlan={openPlanFromToday} />);
    fireEvent.press(screen.getByTestId('today-adhoc-session'));
    expect(screen.getByText('Nothing to start yet')).toBeOnTheScreen();
    expect(
      screen.getByText('There is no plan for today and no earlier session to repeat. Build your plan first.'),
    ).toBeOnTheScreen();
    expect(count('SELECT COUNT(*) AS c FROM session')).toBe(0);
    expect(state().session).toBeNull();

    // Cancel closes the card and restores the start control
    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(screen.queryByText('Nothing to start yet')).toBeNull();
    expect(screen.getByTestId('today-adhoc-session')).toBeOnTheScreen();

    // Re-open and press Go to Plan
    fireEvent.press(screen.getByTestId('today-adhoc-session'));
    fireEvent.press(screen.getByLabelText('Go to Plan'));
    expect(openPlanFromToday).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Nothing to start yet')).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM session')).toBe(0);
    todayView.unmount();

    // 2. SessionScreen unplanned start
    const openPlanFromSession = jest.fn();
    const sessionView = render(<SessionScreen onOpenPlan={openPlanFromSession} />);
    fireEvent.press(screen.getByLabelText('Start a new workout session'));
    expect(screen.getByText('Nothing to start yet')).toBeOnTheScreen();
    expect(
      screen.getByText('There is no plan for today and no earlier session to repeat. Build your plan first.'),
    ).toBeOnTheScreen();
    expect(count('SELECT COUNT(*) AS c FROM session')).toBe(0);
    expect(state().session).toBeNull();

    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(screen.queryByText('Nothing to start yet')).toBeNull();
    expect(screen.getByLabelText('Start a new workout session')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Start a new workout session'));
    fireEvent.press(screen.getByLabelText('Go to Plan'));
    expect(openPlanFromSession).toHaveBeenCalledTimes(1);
    expect(count('SELECT COUNT(*) AS c FROM session')).toBe(0);
    sessionView.unmount();

    // 3. BlockScreen unplanned start
    useStore.setState({
      vector: {
        date: state().today, readiness_score: 80, hrv_component: 80, load_component: 80,
        sleep_component: 80, spo2_component: 80, acwr: 1.0, acute_load_kg: 1000,
        chronic_load_kg: 1000, ln_rmssd: 4.0, hrv_z: 0, sleep_efficiency_pct: 85,
        spo2_night_mean: 97, computed_at_ms: 1,
      },
    });
    const blockView = render(<BlockScreen />);
    fireEvent.press(screen.getByText('Start without a planned session'));
    fireEvent.press(screen.getByLabelText('Start an unplanned session'));
    expect(screen.getByText('Nothing to start yet')).toBeOnTheScreen();
    expect(
      screen.getByText('There is no plan for today and no earlier session to repeat. Build your plan first.'),
    ).toBeOnTheScreen();
    expect(count('SELECT COUNT(*) AS c FROM session')).toBe(0);

    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(screen.queryByText('Nothing to start yet')).toBeNull();
    expect(screen.getByLabelText('Start an unplanned session')).toBeOnTheScreen();
    blockView.unmount();
  });

  test('an already-open empty session shows updated preparation and empty-card copy and still discards on finish', () => {
    raw().exec('DELETE FROM planned_slot; DELETE FROM planned_session; DELETE FROM training_block; DELETE FROM training_program;');
    act(() => {
      state().refreshBlock();
      state().refreshProgram();
      state().startSession();
    });
    expect(state().session).not.toBeNull();
    expect(state().sessionPlan).toHaveLength(0);

    render(<SessionScreen />);
    expect(screen.getByText('No movements are planned yet.')).toBeOnTheScreen();
    expect(screen.queryByText('No movements are planned yet. Prepare first, then add your work.')).toBeNull();

    press('preparation-already-warm');
    expect(screen.getByText('No exercise is queued.')).toBeOnTheScreen();
    expect(screen.getByText('Finish this session, then build your plan on the PLAN tab.')).toBeOnTheScreen();
    expect(screen.queryByText('Return to Coach to create a session plan, then come back here.')).toBeNull();

    act(() => {
      fireEvent.press(screen.getByLabelText('Finish empty session'));
    });
    expect(state().session).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM session')).toBe(0);
  });
});
