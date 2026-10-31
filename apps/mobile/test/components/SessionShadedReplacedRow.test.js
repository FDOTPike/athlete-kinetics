import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SessionScreen from '../../src/screens/SessionScreen';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
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

jest.setTimeout(60_000);

const state = () => useStore.getState();
const raw = () => mockDriver.raw;
const idOf = (name) => Number(raw().prepare('SELECT movement_id FROM movement WHERE name = ?').get(name).movement_id);

beforeEach(async () => {
  authorizeAthleteDataBoot();
  let nowMs = 1_700_000_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({
    status: 'booting', error: null, session: null, runner: null, sessionMode: null, sessionPlan: [],
    preparation: null, activeSessionPlanSlotId: null, activeMovementId: null, lastTriage: null,
    prescription: null, niggles: [], todayPlan: null, block: null, program: null, lastEndedSessionId: null,
    substitution: null,
  });
  state().boot();
  for (let i = 0; i < 500 && state().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  state().saveProfile({
    training_age: 'intermediate',
    equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'bands'],
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('a replaced row after 1 logged set is drawn at opacity 0.4 with singular Swapped for line, accessible label, readable logged set values, and cannot be selected', () => {
  const today = state().today;
  const pushUpId = idOf('Push-up');
  const inclinePushUpId = idOf('Incline Push-Up');
  const squatId = idOf('Bodyweight Squat');

  raw().prepare(
    "INSERT INTO training_block (block_id, start_date, objective, created_at_ms, status) VALUES (1, ?, 'strength', 1000, 'active')",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (100, 1, 1, 1, 'upper', 'accumulation', ?)",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (500, 100, 1, ?, 3, 5, 8)",
  ).run(pushUpId);
  raw().prepare(
    "INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (501, 100, 2, ?, 3, 8, 8)",
  ).run(squatId);

  state().refreshBlock();
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);

  const firstSlot = state().sessionPlan[0];
  state().logSet(firstSlot.movementId, 5, 0, 8, undefined, undefined, undefined, { bandLevel: 2 }, firstSlot.sessionPlanSlotId);
  state().skipRunnerRest();

  render(<SessionScreen />);

  // Open substitution and swap to Incline Push-Up with 2 sets
  fireEvent.press(screen.getByLabelText('Avoid Push-up and find a substitution'));
  fireEvent.press(screen.getByLabelText('Use Incline Push-Up instead'));
  expect(screen.getByText('Sets of Incline Push-Up')).toBeOnTheScreen();
  expect(screen.getByText('1 logged set of Push-up is kept.')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Use Incline Push-Up instead'));

  const replacedSlot = state().sessionPlan[0];
  const newSlot = state().sessionPlan[1];
  expect(replacedSlot.replacedBySessionPlanSlotId).toBe(newSlot.sessionPlanSlotId);
  expect(newSlot.movementId).toBe(inclinePushUpId);

  // Shaded row accessibility label starts with "Swapped for Incline Push-Up" and has opacity 0.4
  const shadedRow = screen.getByLabelText(/^Swapped for Incline Push-Up/);
  expect(shadedRow).toBeOnTheScreen();
  expect(StyleSheet.flatten(shadedRow.props.style)).toMatchObject({ opacity: 0.4 });
  expect(shadedRow.props.accessibilityState).toMatchObject({ disabled: true });

  // Name and Swapped for line are shown
  expect(screen.getByText('Push-up')).toBeOnTheScreen();
  expect(screen.getByText('Swapped for Incline Push-Up · 1 set logged')).toBeOnTheScreen();

  // Logged sets and their values stay readable
  fireEvent.press(screen.getByLabelText('Review logged details, collapsed'));
  expect(screen.getByText('Set 1')).toBeOnTheScreen();

  // Not selectable as the current slot
  expect(screen.queryByLabelText('Choose Push-up as the current exercise')).toBeNull();
  fireEvent.press(shadedRow);
  expect(state().activeSessionPlanSlotId).toBe(newSlot.sessionPlanSlotId);
});

test('after swapping with 2 logged sets and completing the new row, the shaded row shows plural line and the completion screen lists both movements with their logged sets', () => {
  const today = state().today;
  const pushUpId = idOf('Push-up');
  const inclinePushUpId = idOf('Incline Push-Up');

  raw().prepare(
    "INSERT INTO training_block (block_id, start_date, objective, created_at_ms, status) VALUES (1, ?, 'strength', 1000, 'active')",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (100, 1, 1, 1, 'upper', 'accumulation', ?)",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (500, 100, 1, ?, 3, 5, 8)",
  ).run(pushUpId);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (101, 1, 1, 3, 'upper', 'accumulation', date(?, '+2 days'))",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (501, 101, 1, ?, 2, 8, 8)",
  ).run(inclinePushUpId);

  state().refreshBlock();
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);

  const firstSlot = state().sessionPlan[0];
  state().logSet(firstSlot.movementId, 5, 0, 8, undefined, undefined, undefined, undefined, firstSlot.sessionPlanSlotId);
  state().skipRunnerRest();
  state().logSet(firstSlot.movementId, 6, 0, 8, undefined, undefined, undefined, undefined, firstSlot.sessionPlanSlotId);
  state().skipRunnerRest();

  render(<SessionScreen />);

  fireEvent.press(screen.getByLabelText('Avoid Push-up and find a substitution'));
  fireEvent.press(screen.getByLabelText('Move Incline Push-Up forward into this session'));
  fireEvent.press(screen.getByLabelText('3 sets of Incline Push-Up'));
  fireEvent.press(screen.getByLabelText('Move Incline Push-Up forward into this session'));

  // Shaded row shows plural line and opacity 0.4
  const shadedRow = screen.getByLabelText(/^Swapped for Incline Push-Up/);
  expect(StyleSheet.flatten(shadedRow.props.style)).toMatchObject({ opacity: 0.4 });
  expect(screen.getByText('Swapped for Incline Push-Up · 2 sets logged')).toBeOnTheScreen();

  // Log all 3 sets of Incline Push-Up
  const replacementSlot = state().sessionPlan[1];
  act(() => {
    state().logSet(replacementSlot.movementId, 8, 0, 8, undefined, undefined, undefined, undefined, replacementSlot.sessionPlanSlotId);
    state().skipRunnerRest();
    state().logSet(replacementSlot.movementId, 8, 0, 8, undefined, undefined, undefined, undefined, replacementSlot.sessionPlanSlotId);
    state().skipRunnerRest();
    state().logSet(replacementSlot.movementId, 9, 0, 8, undefined, undefined, undefined, undefined, replacementSlot.sessionPlanSlotId);
  });

  // Finish the completed session and inspect the completion screen and summary
  fireEvent.press(screen.getByLabelText('Finish completed session'));
  expect(state().session).toBeNull();
  expect(screen.getByTestId('session-summary')).toBeOnTheScreen();
  expect(screen.getByText('Push-up — 2 of 2 sets · most reps in one set 6')).toBeOnTheScreen();
  expect(screen.getByText('Incline Push-Up — 3 of 3 sets · most reps in one set 9')).toBeOnTheScreen();
});
