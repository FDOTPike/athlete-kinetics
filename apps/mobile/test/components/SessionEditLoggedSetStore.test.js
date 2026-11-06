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

test('correcting a logged set keeps the set count, the plan, the runner and the next load suggestion in step with the store', async () => {
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
  state().logSet(slot.movementId, 5, 80, 8, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
  const setId = state().session.sets[0].set_id;
  const setCountBefore = state().session.sets.length;
  const plannedBefore = state().sessionPlan.map((item) => item.plannedSets);
  const runnerBefore = state().runner;

  state().editSet(setId, 7, 77.5, 8);

  expect(state().error).toBeNull();
  expect(state().session.sets.length).toBe(setCountBefore);
  expect(state().session.sets[0]).toMatchObject({ set_id: setId, reps: 7, load_kg: 77.5, rpe: 8 });
  expect(raw().prepare('SELECT reps, load_kg, rpe FROM set_record WHERE set_id = ?').get(setId)).toEqual({ reps: 7, load_kg: 77.5, rpe: 8 });
  expect(state().lastLoggedLoads[pushUpId]).toBe(77.5);
  expect(state().sessionPlan.map((item) => item.plannedSets)).toEqual(plannedBefore);
  expect(state().runner).toEqual(runnerBefore);
});
