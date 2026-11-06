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

const bootWithPushUpSession = async () => {
  authorizeAthleteDataBoot();
  // Start at the real clock: the niggle filter reads today from the real date.
  let nowMs = Date.now();
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
  raw().prepare(
    "INSERT INTO training_block (block_id, start_date, objective, created_at_ms, status) VALUES (1, ?, 'strength', 1000, 'active')",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (100, 1, 1, 1, 'upper', 'accumulation', ?)",
  ).run(today);
  raw().prepare(
    "INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (500, 100, 1, ?, 3, 5, 8)",
  ).run(pushUpId);
  state().refreshBlock();
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);
  return { pushUpId };
};

test('when a reported area removes every same-pattern alternative, the store says the area held them back', async () => {
  const { pushUpId } = await bootWithPushUpSession();
  expect(state().reportNiggle('shoulder', 5)).toBe(true);

  state().openSubstitution(pushUpId);

  const { result, heldByReportedArea } = state().substitution;
  expect(result.layer1Regression.options).toEqual([]);
  expect(result.layer2DaySwap.options).toEqual([]);
  expect(heldByReportedArea).toBe(true);
});

test('when no alternative exists and no area is reported, the store does not claim an area held anything back', async () => {
  const { pushUpId } = await bootWithPushUpSession();
  // Keep only the target from its pattern, so the library has no alternative at all.
  useStore.setState({
    movements: state().movements.filter((movement) => movement.pattern !== 'push_h' || movement.movement_id === pushUpId),
  });

  state().openSubstitution(pushUpId);

  const { result, heldByReportedArea } = state().substitution;
  expect(result.layer1Regression.options).toEqual([]);
  expect(result.layer2DaySwap.options).toEqual([]);
  expect(heldByReportedArea).toBe(false);
});
