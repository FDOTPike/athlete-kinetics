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

// The store dates blocks by the local calendar (localToday); SQLite's
// date('now') is UTC and can be a day off, so dates are built locally.
const localDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

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
  raw.prepare('UPDATE training_block SET start_date = ?').run(localDaysAgo(28));
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

// Review (PR 194): a saved preference can also stop passing the profile gate,
// e.g. an Intermediate-only movement after the athlete changes to Beginner.
// The continuation preview leaves it out (continuation falls back for it);
// choosing it anew is still refused.
test('a saved preference the athlete can no longer do is left out of the continuation preview', () => {
  act(() => {
    useStore.getState().saveProfile({
      training_age: 'intermediate', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'kettlebell', 'cable_machine'],
    });
  });
  const store = () => useStore.getState();
  const input = baseInput('full');
  const day = store().previewTrainingProgram(input).plan.sessions.find((session) => session.day_index === 1);
  // An Intermediate-only movement the builder accepts for one of this day's
  // slots, found in the catalogue rather than named, so it cannot go stale.
  let chosen = null;
  for (const slot of day.slots) {
    const pattern = store().movements.find((m) => m.movement_id === slot.movement_id)?.pattern;
    for (const m of store().movements) {
      if (chosen !== null || m.pattern !== pattern || m.difficulty !== 'Intermediate' || m.beginnerOk || m.sportTracking) continue;
      if (m.movement_id === slot.movement_id) continue;
      const preference = { dayIndex: 1, slotIndex: slot.slot_index, pattern: m.pattern, movementId: m.movement_id };
      try {
        store().previewTrainingProgram({ ...input, movementPreferences: [preference] });
        chosen = preference;
      } catch { /* not accepted for this slot; try the next one */ }
    }
  }
  expect(chosen).not.toBeNull();
  expect(store().createTrainingProgram({ ...input, horizon: { kind: 'weeks', blockCount: 2 }, movementPreferences: [chosen] })).toBe(true);
  act(() => { store().saveProfile({ training_age: 'beginner' }); });
  expect(store().profile.training_age).toBe('beginner');
  mockDriverFor('athlete_kinetics.db').raw.prepare('UPDATE training_block SET start_date = ?').run(localDaysAgo(28));
  store().refreshProgram();
  store().refreshBlock();
  expect(store().program.movementPreferences.map((p) => p.movementId)).toEqual([chosen.movementId]);
  // A new choice is still checked strictly.
  expect(() => store().previewTrainingProgram({ ...input, movementPreferences: [chosen] }))
    .toThrow('A preferred movement is teaching-only for this athlete.');
  const preview = store().previewNextProgramBlock();
  expect(preview).not.toBeNull();
  const planned = preview.sessions.filter((session) => session.day_index === 1).flatMap((session) => session.slots);
  expect(planned.length).toBeGreaterThan(0);
  expect(planned.map((slot) => slot.movement_id)).not.toContain(chosen.movementId);
});
