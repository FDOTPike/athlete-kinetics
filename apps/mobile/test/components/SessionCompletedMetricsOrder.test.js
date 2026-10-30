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

test('CompletedMetrics lists logged sets in ascending set order (Set 1, Set 2)', async () => {
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
    equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'resistance_bands'],
  });

  const today = state().today;
  const pushUpId = idOf('Push-up');
  const widePushUpId = idOf('Push-Up Wide');

  raw().prepare(
    "INSERT INTO training_block (block_id, start_date, objective, created_at_ms, status) VALUES (1, ?, 'strength', 1000, 'active')",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (100, 1, 1, 1, 'full', 'accumulation', ?)",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (500, 100, 1, ?, 2, 5, 8)",
  ).run(pushUpId);
  raw().prepare(
    "INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (501, 100, 2, ?, 2, 5, 8)",
  ).run(widePushUpId);

  state().refreshBlock();
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);

  const firstSlot = state().sessionPlan[0];

  // Log Set 1 and Set 2 on Slot 1 with bandLevel so Slot 1 finishes and renders CompletedMetrics.
  state().logSet(firstSlot.movementId, 5, 0, 8, undefined, undefined, undefined, { bandLevel: 1 }, firstSlot.sessionPlanSlotId);
  state().skipRunnerRest();
  state().logSet(firstSlot.movementId, 5, 0, 8, undefined, undefined, undefined, { bandLevel: 2 }, firstSlot.sessionPlanSlotId);
  state().skipRunnerRest();

  render(<SessionScreen />);

  fireEvent.press(screen.getByLabelText('Review logged details, collapsed'));
  const renderedSetHeaders = screen.getAllByText(/^Set \d+$/).map((node) => node.props.children.join(''));

  expect(renderedSetHeaders).toEqual(['Set 1', 'Set 2']);
});
