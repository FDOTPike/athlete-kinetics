import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
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

afterEach(() => {
  jest.restoreAllMocks();
});

test('applying a day-swap option on Set 3 of 3 when the pulled-forward slot has 2 sets replaces the remaining work instead of failing with a checkpoint error', async () => {
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
    equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'],
  });

  const today = state().today;
  const pushUpId = idOf('Push-up');
  const inclinePushUpId = idOf('Incline Push-Up');

  // Seed an active block with today's 3-set Push-up session and a later day's 2-set Incline Push-Up slot.
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

  const slot = state().sessionPlan[0];
  // Log Set 1 of 3 and Set 2 of 3 on Push-up, leaving Set 3 of 3 active.
  state().logSet(slot.movementId, 5, 0, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
  state().skipRunnerRest();
  state().logSet(slot.movementId, 5, 0, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
  state().skipRunnerRest();

  expect(state().runner.phase).toBe('working');
  expect(state().runner.setIndex).toBe(3);

  render(<SessionScreen />);

  // Open substitution via "Doesn't feel right" and tap the Layer-2 Day-Swap option.
  fireEvent.press(screen.getByLabelText('Avoid Push-up and find a substitution'));
  expect(screen.getByText('Your completed sets stay recorded. The replacement carries the remaining work.')).toBeOnTheScreen();

  const daySwapButton = screen.getByLabelText('Move Incline Push-Up forward into this session');
  fireEvent.press(daySwapButton);

  expect({
    error: state().error,
    substitutionOpen: state().substitution !== null,
    activeMovementId: state().sessionPlan[0].movementId,
  }).toEqual({
    error: null,
    substitutionOpen: false,
    activeMovementId: inclinePushUpId,
  });
});
