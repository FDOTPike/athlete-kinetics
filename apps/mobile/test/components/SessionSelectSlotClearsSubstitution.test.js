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

test('switching the active exercise in self-directed mode clears an open substitution sheet instead of letting a stale option overwrite the newly selected exercise', async () => {
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
  const widePushUpId = idOf('Push-Up Wide');
  const inclinePushUpId = idOf('Incline Push-Up');

  raw().prepare(
    "INSERT INTO training_block (block_id, start_date, objective, created_at_ms, status) VALUES (1, ?, 'strength', 1000, 'active')",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (100, 1, 1, 1, 'full', 'accumulation', ?)",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (500, 100, 1, ?, 3, 5, 8)",
  ).run(pushUpId);
  raw().prepare(
    "INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (501, 100, 2, ?, 3, 8, 8)",
  ).run(widePushUpId);

  state().refreshBlock();
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);

  expect(state().sessionMode).toBe('self_directed');

  render(<SessionScreen />);

  // Open substitution on Slot 1 (Push-up).
  fireEvent.press(screen.getByLabelText('Avoid Push-up and find a substitution'));
  expect(screen.getByLabelText('Use Incline Push-Up instead')).toBeOnTheScreen();

  // Switch active exercise to Slot 2 (Push-Up Wide).
  fireEvent.press(screen.getByLabelText('Choose Push-Up Wide as the current exercise'));

  // If the stale Push-up substitution sheet is still rendered and tapped, it overwrites Slot 2 (Push-Up Wide).
  const staleOption = screen.queryByLabelText('Use Incline Push-Up instead');
  if (staleOption !== null) {
    fireEvent.press(staleOption);
  }

  expect({
    staleOptionRemainedVisibleAfterSwitchingSlot: staleOption !== null,
    slot1MovementId: state().sessionPlan[0].movementId,
    slot2MovementId: state().sessionPlan[1].movementId,
  }).toEqual({
    staleOptionRemainedVisibleAfterSwitchingSlot: false,
    slot1MovementId: pushUpId,
    slot2MovementId: widePushUpId,
  });
});
