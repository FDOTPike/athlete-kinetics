import React from 'react';
import { act } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

// Review (PR 194): the generator keeps a partner sparring round on BJJ days
// only. A custom choice the builder accepts must be one the generator will
// place, so the preview refuses a sparring round on a conditioning day and
// keeps it on a BJJ day.

let mockDrivers;
let mockRegistry;
function mockDriverFor(name) {
  if (!mockDrivers.has(name)) mockDrivers.set(name, { ...makeNodeSqliteDriver(), close: jest.fn() });
  return mockDrivers.get(name);
}
jest.mock('@op-engineering/op-sqlite', () => ({ open: ({ name }) => mockDriverFor(name) }));
jest.mock('../../src/state/athleteRegistry', () => ({
  loadRegistry: async () => mockRegistry,
  saveRegistry: async (next) => { mockRegistry = next; return true; },
}));


const settle = async () => {
  for (let n = 0; n < 12; n += 1) await new Promise((resolve) => { setImmediate(resolve); });
};


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
    status: 'booting', error: null, activeAthleteId: 'default', session: null, runner: null,
    focus: null, goals: [], block: null, program: null, todayPlan: null,
  });
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
  act(() => {
    useStore.getState().saveProfile({ objective: 'gpp', weekly_frequency: 2, session_duration_cap_min: 90, equipment_inventory: ['mats', 'bands'] });
  });
});

const sparring = () => useStore.getState().movements.find((m) => m.name === 'BJJ Sparring Round');
const baseInput = (focus) => ({
  horizon: { kind: 'weeks', blockCount: 1 }, schemaType: 'LINEAR', dayIndices: [1], days: [{ dayIndex: 1, focus }],
});
// A real slot on that day whose pattern is the sparring round's: the same
// choice the builder would list beside the generated movement.
const sameSlot = (focus) => {
  const { movements } = useStore.getState();
  const byId = new Map(movements.map((m) => [m.movement_id, m]));
  const plan = useStore.getState().previewTrainingProgram(baseInput(focus)).plan;
  const day = plan.sessions.find((session) => session.day_index === 1);
  return day.slots.find((slot) => byId.get(slot.movement_id)?.pattern === sparring().pattern);
};
const previewWith = (focus) => {
  const m = sparring();
  const slot = sameSlot(focus);
  expect(slot).toBeDefined();
  return () => useStore.getState().previewTrainingProgram({
    ...baseInput(focus),
    movementPreferences: [{ dayIndex: 1, slotIndex: slot.slot_index, pattern: m.pattern, movementId: m.movement_id }],
  });
};

test('a sparring round chosen for a conditioning day is refused, not silently replaced', () => {
  expect(sparring()).toBeDefined();
  expect(previewWith('conditioning')).toThrow('A preferred movement does not belong on that day.');
});

test('the same choice on a BJJ day is accepted and placed in its slot', () => {
  const slot = sameSlot('bjj');
  const { plan } = previewWith('bjj')();
  const placed = plan.sessions.find((session) => session.day_index === 1).slots
    .find((candidate) => candidate.slot_index === slot.slot_index);
  expect(placed.movement_id).toBe(sparring().movement_id);
});

// Review (PR 194): a preference saved before the day rule existed must not
// make the continuation preview throw. It is left out, as continuation's
// generator leaves it out.
test('a saved preference that no longer fits its day does not break the continuation preview', () => {
  const m = sparring();
  const slot = sameSlot('conditioning');
  expect(useStore.getState().createTrainingProgram({ ...baseInput('conditioning'), horizon: { kind: 'weeks', blockCount: 2 } })).toBe(true);
  const raw = mockDriverFor('athlete_kinetics.db').raw;
  const { program_id: programId } = raw.prepare("SELECT program_id FROM training_program WHERE status = 'active'").get();
  raw.prepare(`INSERT INTO training_program_movement_preference (program_id, day_index, slot_index, pattern, movement_id)
    VALUES (?, 1, ?, ?, ?)`).run(programId, slot.slot_index, m.pattern, m.movement_id);
  // The store dates blocks by the local calendar (localToday); SQLite's
  // date('now') is UTC and can be a day off, so the date is built locally.
  const started = new Date();
  started.setDate(started.getDate() - 28);
  const pad = (n) => String(n).padStart(2, '0');
  const startDate = `${started.getFullYear()}-${pad(started.getMonth() + 1)}-${pad(started.getDate())}`;
  raw.prepare('UPDATE training_block SET start_date = ?').run(startDate);
  useStore.getState().refreshProgram();
  useStore.getState().refreshBlock();
  expect(useStore.getState().program.movementPreferences.map((p) => p.movementId)).toEqual([m.movement_id]);
  const preview = useStore.getState().previewNextProgramBlock();
  expect(preview).not.toBeNull();
  const day = preview.sessions.find((session) => session.day_index === 1);
  // The preview plans the saved conditioning day, as continuation will.
  expect(day.focus).toBe('conditioning');
  expect(day.slots.map((candidate) => candidate.movement_id)).not.toContain(m.movement_id);
});
