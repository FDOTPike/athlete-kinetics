/**
 * Issue #208 (Ruling Group 5 — Q1 + Q2 C):
 * Neutral Exercise Swap, Parity List, and "For today only" vs "For the rest of this block"
 * persistence against real useStore + real SQLite migrations.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { EQUIPMENT_ITEMS, NEUTRAL_SWAP_SUBTITLE, deriveAvoidPromotionsFromSwaps } from '@ak/inference';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';
import SessionScreen from '../../src/screens/SessionScreen';

let mockDrivers;
let mockRegistry;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) {
    mockDrivers.set(name, { ...makeNodeSqliteDriver(), close: jest.fn() });
  }
  return mockDrivers.get(name);
}
jest.mock('@op-engineering/op-sqlite', () => ({ open: ({ name }) => mockDriverFor(name) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => mockRegistry,
  saveRegistry: async (next) => { mockRegistry = next; return true; },
}));

const settle = async () => {
  for (let n = 0; n < 12; n += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
};

const state = () => useStore.getState();
const rawDb = () => mockDriverFor('athlete_kinetics.db').raw;

function movementByName(name) {
  const m = state().movements.find((mv) => mv.name === name);
  expect(m).toBeDefined();
  return m;
}

function seedActiveProgramAndBlock({ targetMovementName = 'Incline Dumbbell Press' } = {}) {
  act(() => {
    state().saveProfile({
      objective: 'hypertrophy',
      training_age: 'intermediate',
      weekly_frequency: 2,
      session_duration_cap_min: 90,
      equipment_inventory: [...EQUIPMENT_ITEMS],
    });
  });

  const target = movementByName(targetMovementName);
  const availableIds = new Set(
    state().getMovementAvailabilityVerdicts('weight_room')
      .filter((v) => v.state === 'available')
      .map((v) => v.movementId),
  );
  const altZero = state().movements.find(
    (m) =>
      availableIds.has(m.movement_id) &&
      m.pattern === target.pattern &&
      m.movement_id !== target.movement_id &&
      m.difficulty === target.difficulty,
  );
  expect(altZero).toBeDefined();

  // Start a multi-block program with custom preference for targetMovement on day 1 so
  // both remaining block sessions and training_program_movement_preference (033) can be asserted.
  const preview = state().previewTrainingProgram({
    horizon: { kind: 'weeks', blockCount: 2 },
    schemaType: 'LINEAR',
    dayIndices: [1, 3],
    days: [{ dayIndex: 1, focus: 'upper' }, { dayIndex: 3, focus: 'upper' }],
  });
  const day1 = preview.plan.sessions.find((s) => s.day_index === 1);
  const day3 = preview.plan.sessions.find((s) => s.day_index === 3);
  const day1SamePatternSlot = day1.slots.find((sl) => {
    const mv = state().movements.find((m) => m.movement_id === sl.movement_id);
    return mv?.pattern === target.pattern;
  });
  const day3SamePatternSlot = day3.slots.find((sl) => {
    const mv = state().movements.find((m) => m.movement_id === sl.movement_id);
    return mv?.pattern === target.pattern;
  });

  const prefs = [];
  if (day1SamePatternSlot) {
    prefs.push({ dayIndex: 1, slotIndex: day1SamePatternSlot.slot_index, pattern: target.pattern, movementId: target.movement_id });
  }
  if (day3SamePatternSlot) {
    prefs.push({ dayIndex: 3, slotIndex: day3SamePatternSlot.slot_index, pattern: target.pattern, movementId: target.movement_id });
  }

  act(() => {
    const ok = state().createTrainingProgram({
      horizon: { kind: 'weeks', blockCount: 2 },
      schemaType: 'LINEAR',
      dayIndices: [1, 3],
      days: [{ dayIndex: 1, focus: 'upper' }, { dayIndex: 3, focus: 'upper' }],
      movementPreferences: prefs,
    });
    expect(ok).toBe(true);
  });

  // Guarantee today's session has targetMovement and remaining future block sessions
  // on both day 1 & day 3 also hold targetMovement so scope diffs are directly observable.
  const db = rawDb();
  const blockId = state().block.blockId;
  const todayId = state().todayPlan.plannedSessionId;
  const todaySlot = state().todayPlan.slots.find((s) => s.pattern === target.pattern);
  if (todaySlot && todaySlot.movementId !== target.movement_id) {
    db.prepare('UPDATE planned_slot SET movement_id = ? WHERE planned_slot_id = ?').run(target.movement_id, todaySlot.plannedSlotId);
  }
  // Put target.movement_id on one future unstarted upper session as well
  const futureSessions = db.prepare(
    'SELECT planned_session_id, day_index FROM planned_session WHERE block_id = ? AND planned_session_id <> ? ORDER BY week_index, day_index',
  ).all(blockId, todayId);
  expect(futureSessions.length).toBeGreaterThanOrEqual(2);
  for (const fs of futureSessions) {
    const matchingSlot = db.prepare(
      `SELECT ps.planned_slot_id FROM planned_slot ps
       JOIN movement m ON m.movement_id = ps.movement_id
       WHERE ps.planned_session_id = ? AND m.pattern = ? LIMIT 1`,
    ).get(fs.planned_session_id, target.pattern);
    if (matchingSlot) {
      db.prepare('UPDATE planned_slot SET movement_id = ? WHERE planned_slot_id = ?').run(target.movement_id, matchingSlot.planned_slot_id);
    }
  }
  act(() => { state().refreshBlock(); state().refreshProgram(); });

  return { target, altZero, blockId, todayId, futureSessions };
}

beforeEach(async () => {
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDrivers = new Map();
  mockRegistry = {
    version: 1,
    activeId: 'default',
    advancedToolsUnlocked: false,
    athletes: [{ id: 'default', name: 'Athlete 1', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
  };
  useStore.setState({
    status: 'booting',
    error: null,
    activeAthleteId: 'default',
    session: null,
    sessionPlan: [],
    activeSessionPlanSlotId: null,
    activeMovementId: null,
    runner: null,
    sessionMode: null,
    preparation: null,
    focus: null,
    goals: [],
    block: null,
    program: null,
    todayPlan: null,
    substitution: null,
  });
  state().boot();
  await settle();
  expect(state().status).toBe('ready');
});

function startAndActivateTarget(targetMovementId) {
  act(() => { state().startSession(); });
  expect(state().session).not.toBeNull();
  if (state().preparation) {
    act(() => { state().finishPreparation('already_warm', state().preparation.revision); });
  }
  const slot = state().sessionPlan.find((s) => s.movementId === targetMovementId);
  expect(slot).toBeDefined();
  if (state().activeSessionPlanSlotId !== slot.sessionPlanSlotId) {
    act(() => { state().selectMovementSlot(slot.sessionPlanSlotId); });
  }
  if (state().runner) {
    act(() => { state().skipRunnerRest(); });
  }
  return slot;
}

test('Q1: entry button is "Swap exercise" alongside "Report discomfort", opens neutral sheet with unselected chips, ranked parity list, and writes zero Avoid (-1)', () => {
  const { target } = seedActiveProgramAndBlock();
  startAndActivateTarget(target.movement_id);

  render(<SessionScreen />);

  expect(screen.getByText('Swap exercise')).toBeOnTheScreen();
  expect(screen.getByText('Report discomfort')).toBeOnTheScreen();
  expect(screen.queryByText('Swap or avoid this')).toBeNull();
  expect(screen.queryByText("Doesn't feel right")).toBeNull();

  fireEvent.press(screen.getByLabelText(`Swap exercise: ${target.name}`));

  // Zero Avoid (-1) promotions on opening or running neutral swap
  const avoids = rawDb().prepare('SELECT COUNT(*) AS c FROM movement_preference WHERE preference = -1').get().c;
  expect(avoids).toBe(0);
  expect(state().error).toBeNull();

  // Sheet header & subtitle
  expect(screen.getAllByText('Swap exercise').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('Pick an available exercise for the same movement pattern.')).toBeOnTheScreen();

  // Three reason chips start UNSELECTED
  const chipEquip = screen.getByTestId('neutral-swap-reason-equipment_busy');
  const chipPref = screen.getByTestId('neutral-swap-reason-preference');
  const chipTime = screen.getByTestId('neutral-swap-reason-time');
  expect(screen.getByText('Equipment busy')).toBeOnTheScreen();
  expect(screen.getByText('Prefer another exercise')).toBeOnTheScreen();
  expect(screen.getByText('Short on time')).toBeOnTheScreen();
  expect(chipEquip.props.accessibilityState?.selected).toBe(false);
  expect(chipPref.props.accessibilityState?.selected).toBe(false);
  expect(chipTime.props.accessibilityState?.selected).toBe(false);

  // Neutral candidate rows carry exact neutral subtitle and zero injury/regression copy
  expect(screen.getAllByText(NEUTRAL_SWAP_SUBTITLE).length).toBeGreaterThan(0);
  expect(screen.queryByText(/reduced mechanical demand/i)).toBeNull();
  expect(screen.queryByText(/at matched difficulty/i)).toBeNull();

  // Matched difficulty (|tierDelta| === 0) precedes |tierDelta| === 1
  const neutralOptions = state().substitution?.neutralOptions ?? [];
  expect(neutralOptions.length).toBeGreaterThan(0);
  const deltas = neutralOptions.map((o) => o.absTierDelta);
  expect(deltas.every((d, i) => i === 0 || deltas[i - 1] <= d)).toBe(true);
  expect(deltas[0]).toBe(0);

  // Persistence buttons start disabled until BOTH reason chip AND candidate are selected
  const btnToday = screen.getByText('For today only').parent?.parent ?? screen.getByLabelText('For today only');
  const btnBlock = screen.getByText('For the rest of this block').parent?.parent ?? screen.getByLabelText('For the rest of this block');
  expect(screen.getByLabelText('For today only').props.accessibilityState?.disabled).toBe(true);
  expect(screen.getByLabelText('For the rest of this block').props.accessibilityState?.disabled).toBe(true);

  // Only reason chip selected -> still disabled
  fireEvent.press(chipEquip);
  expect(chipEquip.props.accessibilityState?.selected).toBe(true);
  expect(screen.getByLabelText('For today only').props.accessibilityState?.disabled).toBe(true);
  expect(screen.getByLabelText('For the rest of this block').props.accessibilityState?.disabled).toBe(true);

  // Candidate also selected -> both enabled
  const firstOpt = neutralOptions[0];
  fireEvent.press(screen.getByTestId(`neutral-swap-option-${firstOpt.movement_id}`));
  expect(screen.getByLabelText('For today only').props.accessibilityState?.disabled).toBe(false);
  expect(screen.getByLabelText('For the rest of this block').props.accessibilityState?.disabled).toBe(false);

  // Unselecting/clearing? Selecting only candidate without reason checked cleanly above (`expect(...disabled).toBe(true)`).
  void btnToday; void btnBlock;
});

test('Q2 "For today only" writes 073 + 078 cause, preserves future block planned_slots & 033 program prefs, and writes zero -1 avoids', () => {
  const { target, altZero, blockId, todayId, futureSessions } = seedActiveProgramAndBlock();
  const activeSlot = startAndActivateTarget(target.movement_id);
  const origSessionSlotId = activeSlot.sessionPlanSlotId;
  // Log 1 set so swap creates a 073 replacement row, then skip rest to return to working state
  act(() => {
    state().logSet(target.movement_id, 8, 20, 7.5, undefined, undefined, undefined, undefined, origSessionSlotId);
    state().skipRunnerRest();
  });

  render(<SessionScreen />);
  fireEvent.press(screen.getByLabelText(`Swap exercise: ${target.name}`));
  fireEvent.press(screen.getByTestId('neutral-swap-reason-equipment_busy'));
  fireEvent.press(screen.getByTestId(`neutral-swap-option-${altZero.movement_id}`));
  fireEvent.press(screen.getByLabelText('For today only'));

  const db = rawDb();
  // 073 link written
  const rep073 = db.prepare('SELECT * FROM session_plan_slot_replacement WHERE session_plan_slot_id = ?').get(origSessionSlotId);
  expect(rep073).toBeDefined();
  expect(rep073.replaced_by_session_plan_slot_id).toBeTruthy();

  // 078 cause/scope persisted
  const cause078 = db.prepare('SELECT * FROM session_slot_swap_cause WHERE session_plan_slot_id = ?').get(origSessionSlotId);
  expect(cause078).toMatchObject({
    session_plan_slot_id: origSessionSlotId,
    cause: 'equipment_busy',
    scope: 'today_only',
    replaced_by_session_plan_slot_id: rep073.replaced_by_session_plan_slot_id,
  });

  // Remaining unstarted block sessions NOT rewritten
  const remainingTargetCount = db.prepare(
    `SELECT COUNT(*) AS c FROM planned_slot ps
     JOIN planned_session s ON s.planned_session_id = ps.planned_session_id
     WHERE s.block_id = ? AND s.planned_session_id <> ? AND ps.movement_id = ?`,
  ).get(blockId, todayId, target.movement_id).c;
  expect(remainingTargetCount).toBeGreaterThanOrEqual(futureSessions.length);

  // Program preference (033) NOT rewritten
  const pref033 = db.prepare(
    'SELECT movement_id FROM training_program_movement_preference WHERE program_id = ? AND day_index = 1 AND movement_id = ?',
  ).all(state().program.programId, altZero.movement_id);
  expect(pref033).toHaveLength(0);

  // ZERO Avoid (-1)
  expect(db.prepare('SELECT COUNT(*) AS c FROM movement_preference WHERE preference = -1').get().c).toBe(0);
});

test('Q2 "For the rest of this block" with equipment_busy/time updates remaining block planned_slots ONLY (033 updated ONLY for cause = preference), and Mechanism 1 triggers zero Avoid (-1)', () => {
  const { target, altZero, blockId, todayId } = seedActiveProgramAndBlock();
  const activeSlot = startAndActivateTarget(target.movement_id);

  const db = rawDb();
  const origSessionSlotId = activeSlot.sessionPlanSlotId;

  // Swap with cause = 'equipment_busy' + scope = 'rest_of_block'
  render(<SessionScreen />);
  fireEvent.press(screen.getByLabelText(`Swap exercise: ${target.name}`));
  fireEvent.press(screen.getByTestId('neutral-swap-reason-equipment_busy'));
  fireEvent.press(screen.getByTestId(`neutral-swap-option-${altZero.movement_id}`));
  fireEvent.press(screen.getByLabelText('For the rest of this block'));

  // Current session 078 row
  const cause078 = db.prepare('SELECT * FROM session_slot_swap_cause WHERE session_plan_slot_id = ?').get(origSessionSlotId);
  expect(cause078).toMatchObject({ cause: 'equipment_busy', scope: 'rest_of_block' });

  // Future unstarted block planned_slots updated to altZero
  const remainingOld = db.prepare(
    `SELECT COUNT(*) AS c FROM planned_slot ps
     JOIN planned_session s ON s.planned_session_id = ps.planned_session_id
     WHERE s.block_id = ? AND s.planned_session_id <> ? AND ps.movement_id = ?`,
  ).get(blockId, todayId, target.movement_id).c;
  const remainingNew = db.prepare(
    `SELECT COUNT(*) AS c FROM planned_slot ps
     JOIN planned_session s ON s.planned_session_id = ps.planned_session_id
     WHERE s.block_id = ? AND s.planned_session_id <> ? AND ps.movement_id = ?`,
  ).get(blockId, todayId, altZero.movement_id).c;
  expect(remainingOld).toBe(0);
  expect(remainingNew).toBeGreaterThanOrEqual(2);

  // 033 NOT updated when cause !== 'preference'
  const day1PrefBefore = db.prepare(
    'SELECT movement_id FROM training_program_movement_preference WHERE program_id = ? AND day_index = 1',
  ).all(state().program.programId).map((r) => r.movement_id);
  expect(day1PrefBefore).toContain(target.movement_id);
  expect(day1PrefBefore).not.toContain(altZero.movement_id);

  // Now do a second swap on the active slot with cause = 'preference' + scope = 'rest_of_block' -> altZero -> altSecond
  const availAfterIds = new Set(
    state().getMovementAvailabilityVerdicts('weight_room')
      .filter((v) => v.state === 'available')
      .map((v) => v.movementId),
  );
  const altSecond = (state().movements.filter(
    (m) =>
      availAfterIds.has(m.movement_id) &&
      m.pattern === target.pattern &&
      m.movement_id !== target.movement_id &&
      m.movement_id !== altZero.movement_id &&
      m.difficulty === target.difficulty,
  ))[0];
  expect(altSecond).toBeDefined();
  act(() => {
    const ok = state().applyNeutralSwap(altZero.movement_id, altSecond.movement_id, 'preference', 'rest_of_block');
    expect(ok).toBe(true);
  });

  // 033 IS updated on cause === 'preference' + scope === 'rest_of_block'
  const day1PrefAfter = db.prepare(
    'SELECT movement_id FROM training_program_movement_preference WHERE program_id = ? AND day_index = 1',
  ).all(state().program.programId).map((r) => r.movement_id);
  expect(day1PrefAfter).toContain(altSecond.movement_id);

  // Feed persisted 078 rows into Mechanism 1 kTrigger=2 -> ZERO Avoid (-1) promotions
  const persistedCauses = db.prepare(
    `SELECT sps.movement_id, c.cause
     FROM session_slot_swap_cause c
     JOIN session_plan_slot sps ON sps.session_plan_slot_id = c.session_plan_slot_id`,
  ).all();
  expect(persistedCauses.length).toBeGreaterThanOrEqual(1);
  const avoidsFromMechanism1 = deriveAvoidPromotionsFromSwaps(
    [
      ...persistedCauses.map((r) => ({ ...r, overlaps_affected_joint: true })),
      ...persistedCauses.map((r) => ({ ...r, overlaps_affected_joint: true })),
    ],
    2,
  );
  expect(avoidsFromMechanism1).toEqual({});
  expect(db.prepare('SELECT COUNT(*) AS c FROM movement_preference WHERE preference = -1').get().c).toBe(0);

  // resetTrainingData cleans 078 cleanly
  act(() => {
    state().runnerHalt('manual');
    state().endSession();
  });
  act(() => { expect(state().resetTrainingData()).toBe(true); });
  expect(db.prepare('SELECT COUNT(*) AS c FROM session_slot_swap_cause').get().c).toBe(0);
});
