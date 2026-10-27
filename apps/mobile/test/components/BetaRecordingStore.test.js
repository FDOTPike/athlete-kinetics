/**
 * BetaRecordingStore.test.js — which slots were skipped, and what a set's load
 * entry was seeded with (071).
 *
 * Behavioural tests of the REAL zustand store, booted by the production boot
 * path over the production migration chain (node:sqlite stands in for the
 * op-sqlite handle only). They pin the store contract:
 *
 *   - a seed passed to logSet is stored beside the set, exactly as passed:
 *     a blank field stays NULL and a real zero stays 0;
 *   - no seed, or a malformed one, writes no row and still logs the set;
 *   - the seed is written in the set's own transaction: if it cannot be
 *     written, the set is not logged either;
 *   - finishing a session stores the id of every skipped slot, and their
 *     number is the outcome's own skipped_slot_count;
 *   - if the skipped slots cannot be written the session is not finalized and
 *     stays resumable;
 *   - both are records only: they change no prescription, plan, set or outcome;
 *   - deleting a set removes its seed, editing a set leaves it, and reset
 *     clears both tables with foreign keys on or off.
 */
import { readFileSync } from 'node:fs';
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SessionScreen from '../../src/screens/SessionScreen';
import { join } from 'node:path';
import { useStore, storableLoadShown } from '../../src/state/useStore';
import { authorizeAthleteDataBoot } from '../../src/state/dataMaintenanceLock';
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

// The first heavy module load in a fresh jest worker is slow; an async test
// that hits it must not trip jest's 5 s default and cascade.
jest.setTimeout(60_000);

const MIGRATION_071 = readFileSync(join(__dirname, '..', '..', '..', '..', 'packages', 'core-db', 'src', 'schema', '071_beta_recording.sql'), 'utf8');

const state = () => useStore.getState();
const raw = () => mockDriver.raw;
const count = (sql, ...params) => Number(raw().prepare(sql).get(...params).c);
const all = (sql, ...params) => raw().prepare(sql).all(...params);
const idOf = (name) => Number(raw().prepare('SELECT movement_id FROM movement WHERE name = ?').get(name).movement_id);
const shownRow = (setId) => raw().prepare('SELECT * FROM set_load_shown WHERE set_id = ?').get(setId);
const lastSetId = () => Number(raw().prepare('SELECT MAX(set_id) AS id FROM set_record').get().id);

const boot = async () => {
  useStore.setState({
    status: 'booting', error: null, session: null, runner: null, sessionMode: null, sessionPlan: [],
    preparation: null, activeSessionPlanSlotId: null, activeMovementId: null, lastTriage: null,
    prescription: null, niggles: [], todayPlan: null, block: null, program: null, lastEndedSessionId: null,
  });
  state().boot();
  for (let i = 0; i < 500 && state().status !== 'ready'; i += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  expect(state().status).toBe('ready');
};

beforeEach(async () => {
  authorizeAthleteDataBoot();
  let nowMs = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
  mockDriver = makeNodeSqliteDriver();
  await boot();
  state().saveProfile({ training_age: 'intermediate', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'] });
});

afterEach(() => { jest.restoreAllMocks(); });

/** A started free-form session of two slots, preparation done. An earlier
 *  session is seeded so the free-form start has two movements to repeat. */
const startTwoSlotSession = () => {
  raw().exec("INSERT INTO session (session_id, micro_cycle_id, session_date, started_at_ms, duration_min) VALUES (9000, NULL, '2026-01-05', 1000, 40)");
  const insert = raw().prepare('INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (9000, ?, 1, 5, 0, 7, ?)');
  insert.run(idOf('Push-up'), 2000);
  insert.run(idOf('Bodyweight Squat'), 2001);
  state().startSession();
  state().finishPreparation('already_warm', state().preparation.revision);
  useStore.setState({ error: null });
  expect(state().sessionPlan.length).toBe(2);
  return state().session.sessionId;
};
const logOn = (slot, loadKg, seed) => {
  state().logSet(slot.movementId, 5, loadKg, 7, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId, seed);
};

/** Everything a plan, a prescription or a progression could read. Ids and
 *  clock values are left out so that two separate runs can be compared. */
const trainingFacts = () => JSON.stringify({
  prescription: state().prescription,
  todayPlan: state().todayPlan,
  sets: all('SELECT session_id, movement_id, set_index, reps, load_kg, rpe FROM set_record ORDER BY set_id'),
  targets: all('SELECT provenance_kind, target_rpe FROM set_target ORDER BY set_id'),
  outcomes: all(`SELECT outcome_kind, terminal_phase, halt_reason, origin_kind, session_mode, training_age, slot_count,
    planned_set_count, logged_set_count, exact_dose_count, under_dose_count, over_dose_count, unknown_dose_count,
    unmapped_set_count, missing_set_count, missing_unskipped_set_count, extra_set_count, adapted_slot_count,
    skipped_slot_count, off_plan_slot_count FROM session_outcome ORDER BY session_id`),
  mech: all('SELECT * FROM mech_daily ORDER BY 1, 2'),
  plannedSlots: all('SELECT * FROM planned_slot ORDER BY planned_slot_id'),
  oneRepMaxes: all('SELECT movement_id, load_kg FROM one_rep_max ORDER BY movement_id'),
});

describe('what the load entry was seeded with', () => {
  test('a seed is stored beside the set exactly as passed: a load, a blank field with an advisory, and a real zero', () => {
    startTwoSlotSession();
    const slot = state().sessionPlan[0];
    logOn(slot, 42.5, { source: 'history', shownLoadKg: 40, advisoryKg: null, advisoryKind: null });
    expect(state().error).toBeNull();
    expect(shownRow(lastSetId())).toEqual({ set_id: lastSetId(), load_source: 'history', shown_load_kg: 40, advisory_kg: null, advisory_kind: null });
    state().skipRunnerRest();
    logOn(slot, 42.5, { source: 'manual', shownLoadKg: null, advisoryKg: 45, advisoryKind: 'onerm' });
    expect(shownRow(lastSetId())).toEqual({ set_id: lastSetId(), load_source: 'manual', shown_load_kg: null, advisory_kg: 45, advisory_kind: 'onerm' });
    state().skipRunnerRest();
    logOn(slot, 0, { source: 'seeded', shownLoadKg: 0, advisoryKg: null, advisoryKind: null });
    expect(shownRow(lastSetId())).toEqual({ set_id: lastSetId(), load_source: 'seeded', shown_load_kg: 0, advisory_kg: null, advisory_kind: null });
    expect(state().error).toBeNull();
    // The load that was lifted is the athlete's, whatever was shown.
    expect(all('SELECT load_kg FROM set_record WHERE session_id = ? ORDER BY set_id', state().session.sessionId).map((row) => row.load_kg)).toEqual([42.5, 42.5, 0]);
  });

  test('no seed, or a malformed one, writes no row and the set is still logged', () => {
    const sessionId = startTwoSlotSession();
    const slot = state().sessionPlan[0];
    const malformed = [
      undefined, null,
      { source: 'auto', shownLoadKg: 40, advisoryKg: null, advisoryKind: null },
      { source: 'history', shownLoadKg: -1, advisoryKg: null, advisoryKind: null },
      { source: 'history', shownLoadKg: Number.NaN, advisoryKg: null, advisoryKind: null },
      { source: 'history', shownLoadKg: Number.POSITIVE_INFINITY, advisoryKg: null, advisoryKind: null },
      { source: 'history', shownLoadKg: '40', advisoryKg: null, advisoryKind: null },
      { source: 'manual', shownLoadKg: null, advisoryKg: 45, advisoryKind: null },
      { source: 'manual', shownLoadKg: null, advisoryKg: null, advisoryKind: 'apre' },
      { source: 'manual', shownLoadKg: null, advisoryKg: 45, advisoryKind: 'derived' },
      { source: 'manual', shownLoadKg: null, advisoryKg: -5, advisoryKind: 'apre' },
    ];
    for (const seed of malformed) expect(storableLoadShown(seed)).toBeNull();
    logOn(slot, 40, undefined);
    state().skipRunnerRest();
    logOn(slot, 40, malformed[3]);
    state().skipRunnerRest();
    logOn(slot, 40, malformed[7]);
    expect(state().error).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', sessionId)).toBe(3);
    expect(count('SELECT COUNT(*) AS c FROM set_load_shown')).toBe(0);
  });

  test('the seed is written in the set\'s own transaction: if it cannot be written, the set is not logged and the session carries on', () => {
    const sessionId = startTwoSlotSession();
    const slot = state().sessionPlan[0];
    const checkpointBefore = raw().prepare('SELECT runner_state_json FROM session_runner_checkpoint WHERE session_id = ?').get(sessionId).runner_state_json;
    raw().exec('DROP TABLE set_load_shown');
    logOn(slot, 40, { source: 'history', shownLoadKg: 40, advisoryKg: null, advisoryKind: null });
    expect(state().error).toMatch(/set_load_shown/);
    expect(count('SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', sessionId)).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM set_target')).toBe(0);
    expect(state().session.sets.length).toBe(0);
    expect(raw().prepare('SELECT runner_state_json FROM session_runner_checkpoint WHERE session_id = ?').get(sessionId).runner_state_json).toBe(checkpointBefore);
    // With the table back, the same set logs and is recorded.
    raw().exec(MIGRATION_071);
    useStore.setState({ error: null });
    logOn(slot, 40, { source: 'history', shownLoadKg: 40, advisoryKg: null, advisoryKind: null });
    expect(state().error).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM set_load_shown')).toBe(1);
  });

  test('deleting a set removes its seed; editing a set leaves the seed as it was', () => {
    startTwoSlotSession();
    const slot = state().sessionPlan[0];
    logOn(slot, 40, { source: 'history', shownLoadKg: 40, advisoryKg: null, advisoryKind: null });
    const first = lastSetId();
    state().skipRunnerRest();
    logOn(slot, 40, { source: 'manual', shownLoadKg: 40, advisoryKg: null, advisoryKind: null });
    const second = lastSetId();
    state().editSet(first, 6, 47.5, 8);
    expect(state().error).toBeNull();
    expect(raw().prepare('SELECT load_kg FROM set_record WHERE set_id = ?').get(first).load_kg).toBe(47.5);
    expect(shownRow(first)).toMatchObject({ load_source: 'history', shown_load_kg: 40 });
    state().deleteSet(second);
    expect(shownRow(second)).toBeUndefined();
    expect(shownRow(first)).toBeDefined();
  });
});

describe('which slots were skipped', () => {
  test('the screen confirms each explicit exercise skip, then finishing persists exactly those slot ids', () => {
    const sessionId = startTwoSlotSession();
    const ids = state().sessionPlan.map((slot) => slot.sessionPlanSlotId).sort((a, b) => a - b);
    const confirm = jest.spyOn(Alert, 'alert');
    render(<SessionScreen />);
    act(() => logOn(state().sessionPlan[0], 0));
    expect(screen.queryByRole('button', { name: 'Skip this exercise' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Ready now, skip the rest timer' }));
    fireEvent.press(screen.getByRole('button', { name: 'Skip this exercise' }));
    expect(state().runner.skippedSessionPlanSlotIds).toEqual([]);
    act(() => confirm.mock.calls.at(-1)[2].find((button) => button.text === 'Cancel').onPress?.());
    expect(state().runner.skippedSessionPlanSlotIds).toEqual([]);
    for (const id of ids) {
      fireEvent.press(screen.getByRole('button', { name: 'Skip this exercise' }));
      expect(confirm.mock.calls.at(-1)[0]).toBe('Skip this exercise');
      act(() => confirm.mock.calls.at(-1)[2].find((button) => button.text === 'Skip this exercise').onPress());
      expect(state().runner.skippedSessionPlanSlotIds).toContain(id);
    }
    expect(screen.queryByRole('button', { name: 'Skip this exercise' })).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM session_skipped_slot')).toBe(0);
    expect(screen.getByText('No exercises remain.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Finish completed session' }));
    expect(state().session).toBeNull();
    expect(state().lastEndedSessionId).toBe(sessionId);
    expect(count('SELECT COUNT(*) AS c FROM set_record WHERE session_id = ?', sessionId)).toBe(1);
    expect(all('SELECT session_plan_slot_id FROM session_skipped_slot ORDER BY 1').map((row) => row.session_plan_slot_id)).toEqual(ids);
    expect(raw().prepare('SELECT skipped_slot_count FROM session_outcome WHERE session_id = ?').get(sessionId).skipped_slot_count).toBe(ids.length);
  });

  test('finishing a session stores the id of every skipped slot, and their number is the outcome\'s own count', () => {
    const sessionId = startTwoSlotSession();
    const [first] = state().sessionPlan;
    logOn(first, 0, { source: 'seeded', shownLoadKg: 0, advisoryKg: null, advisoryKind: null });
    state().skipRunnerRest();
    state().runnerSkipSlot();
    state().runnerSkipSlot();
    expect(state().error).toBeNull();
    const skipped = [...state().runner.skippedSessionPlanSlotIds].sort((a, b) => a - b);
    expect(skipped.length).toBeGreaterThanOrEqual(1);
    expect(count('SELECT COUNT(*) AS c FROM session_skipped_slot')).toBe(0);
    if (state().runner.phase !== 'complete' && state().runner.phase !== 'halted') state().runnerHalt('manual');
    state().endSession();
    expect(state().error).toBeNull();
    expect(state().lastEndedSessionId).toBe(sessionId);
    expect(all('SELECT session_plan_slot_id FROM session_skipped_slot ORDER BY 1').map((row) => row.session_plan_slot_id)).toEqual(skipped);
    const outcome = raw().prepare('SELECT skipped_slot_count FROM session_outcome WHERE session_id = ?').get(sessionId);
    expect(outcome.skipped_slot_count).toBe(skipped.length);
    // Every stored id is a slot of this session.
    expect(count('SELECT COUNT(*) AS c FROM session_skipped_slot k JOIN session_plan_slot s ON s.session_plan_slot_id = k.session_plan_slot_id WHERE s.session_id = ?', sessionId)).toBe(skipped.length);
    expect(count('SELECT COUNT(*) AS c FROM session_runner_checkpoint WHERE session_id = ?', sessionId)).toBe(0);
  });

  test('a session with no skipped slot stores none', () => {
    const sessionId = startTwoSlotSession();
    logOn(state().sessionPlan[0], 0, undefined);
    state().skipRunnerRest();
    state().runnerHalt('manual');
    state().endSession();
    expect(state().error).toBeNull();
    expect(raw().prepare('SELECT skipped_slot_count FROM session_outcome WHERE session_id = ?').get(sessionId).skipped_slot_count).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM session_skipped_slot')).toBe(0);
  });

  test('if the skipped slots cannot be written the session is not finalized and stays resumable; with the table back it finishes', () => {
    const sessionId = startTwoSlotSession();
    logOn(state().sessionPlan[0], 0, undefined);
    state().skipRunnerRest();
    state().runnerSkipSlot();
    state().runnerSkipSlot();
    if (state().runner.phase !== 'complete' && state().runner.phase !== 'halted') state().runnerHalt('manual');
    const skipped = state().runner.skippedSessionPlanSlotIds.length;
    expect(skipped).toBeGreaterThanOrEqual(1);
    raw().exec('DROP TABLE session_skipped_slot');
    state().endSession();
    expect(state().error).toMatch(/session_skipped_slot/);
    expect(count('SELECT COUNT(*) AS c FROM session_outcome WHERE session_id = ?', sessionId)).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM session_runner_checkpoint WHERE session_id = ?', sessionId)).toBe(1);
    expect(state().session).not.toBeNull();
    raw().exec(MIGRATION_071);
    useStore.setState({ error: null });
    state().endSession();
    expect(state().error).toBeNull();
    expect(count('SELECT COUNT(*) AS c FROM session_outcome WHERE session_id = ?', sessionId)).toBe(1);
    expect(count('SELECT COUNT(*) AS c FROM session_skipped_slot')).toBe(skipped);
  });
});

describe('records, not decisions', () => {
  const run = (seed) => {
    startTwoSlotSession();
    const [first] = state().sessionPlan;
    logOn(first, 40, seed);
    state().skipRunnerRest();
    logOn(first, 42.5, seed);
    state().skipRunnerRest();
    state().runnerSkipSlot();
    state().runnerSkipSlot();
    if (state().runner.phase !== 'complete' && state().runner.phase !== 'halted') state().runnerHalt('manual');
    state().endSession();
    expect(state().error).toBeNull();
    return trainingFacts();
  };

  test('the same session logged with and without seeds leaves every training fact identical', async () => {
    const withSeeds = run({ source: 'manual', shownLoadKg: null, advisoryKg: 60, advisoryKind: 'history' });
    expect(count('SELECT COUNT(*) AS c FROM set_load_shown')).toBe(2);
    jest.restoreAllMocks();
    authorizeAthleteDataBoot();
    let nowMs = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => ++nowMs);
    mockDriver = makeNodeSqliteDriver();
    await boot();
    state().saveProfile({ training_age: 'intermediate', equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench'] });
    const without = run(undefined);
    expect(count('SELECT COUNT(*) AS c FROM set_load_shown')).toBe(0);
    expect(without).toBe(withSeeds);
  });

  test.each([['on', 'ON'], ['off', 'OFF']])('reset clears both tables with foreign keys %s', (_label, pragma) => {
    run({ source: 'history', shownLoadKg: 40, advisoryKg: null, advisoryKind: null });
    expect(count('SELECT COUNT(*) AS c FROM set_load_shown')).toBe(2);
    expect(count('SELECT COUNT(*) AS c FROM session_skipped_slot')).toBeGreaterThanOrEqual(1);
    raw().exec(`PRAGMA foreign_keys = ${pragma}`);
    expect(state().resetTrainingData()).toBe(true);
    expect(count('SELECT COUNT(*) AS c FROM set_load_shown')).toBe(0);
    expect(count('SELECT COUNT(*) AS c FROM session_skipped_slot')).toBe(0);
    raw().exec('PRAGMA foreign_keys = ON');
  });
});
