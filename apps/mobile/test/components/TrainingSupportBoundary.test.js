import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { useStore, localToday } from '../../src/state/useStore';
import ProfileScreen from '../../src/screens/ProfileScreen';
import SessionScreen from '../../src/screens/SessionScreen';
import { RoutineTemplateBuilder } from '../../src/components/RoutineTemplateBuilder';
import TodayScreen from '../../src/screens/TodayScreen';
import BlockScreen from '../../src/screens/BlockScreen';
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

const state = () => useStore.getState();
const hold = (movementId = null, status = 'held') => {
  mockDriver.raw.prepare(`INSERT INTO health_support_hold
    (hold_id,revision,origin,state,reason_code,created_at_ms,updated_at_ms)
    VALUES ('test-hold',1,'user_requested',?,'review_requested',1,1)`).run(status);
  if (movementId !== null) mockDriver.raw.prepare(`INSERT INTO health_support_scope
    (scope_id,hold_id,target_kind,movement_id) VALUES ('test-scope','test-hold','movement',?)`).run(movementId);
};
const unhold = () => mockDriver.raw.exec("UPDATE health_support_hold SET state='withdrawn',revision=revision+1");
const programInput = { horizon: { kind: 'weeks', blockCount: 2 }, schemaType: 'LINEAR', dayIndices: [1, 3, 5] };

beforeEach(async () => {
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({ status: 'booting', error: null, session: null, runner: null });
  state().boot();
  await new Promise((resolve) => setImmediate(resolve));
  expect(state().status).toBe('ready');
});

test('daily prescription: an unscoped held row prevents publication even with a real readiness vector', () => {
  state().loadDemoAthlete();
  state().computePrescription([]);
  expect(state().prescription).not.toBeNull();
  hold();
  state().computePrescription([]);
  expect(state().prescription).toBeNull();
  unhold();
  state().computePrescription([]);
  expect(state().prescription).not.toBeNull();
});

test('program preview holds before publication; withdrawal permits the same valid input', () => {
  expect(state().previewTrainingProgram(programInput).plan.sessions.length).toBeGreaterThan(0);
  hold();
  expect(() => state().previewTrainingProgram(programInput)).toThrow(/support/i);
  unhold();
  expect(state().previewTrainingProgram(programInput).plan.sessions.length).toBeGreaterThan(0);
});

test.each(['createTrainingProgram', 'generateNewBlock'])('%s cannot commit held generated dose', (action) => {
  hold();
  if (action === 'createTrainingProgram') state()[action](programInput);
  else state()[action]('LINEAR');
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM training_block').get().n).toBe(0);
  expect(state().error).toMatch(/support/i);
  unhold();
  if (action === 'createTrainingProgram') expect(state()[action](programInput)).toBe(true);
  else state()[action]('LINEAR');
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM training_block').get().n).toBeGreaterThan(0);
});

test('absolute load and manual advisory are both withdrawn under current movement support', () => {
  const movementId = state().movements[0].movement_id;
  const input = { movementId, bodyweightMode: false, targetReps: 5, targetRpe: 8, overrideLoadKg: 50 };
  useStore.setState({ profile: { ...state().profile, training_age: 'advanced' }, loadPreference: 'manual' });
  expect(state().resolveSlotLoad(input).advisoryKg).toBe(50);
  hold(movementId);
  expect(state().resolveSlotLoad(input)).toEqual({ source: 'manual', initialLoadKg: null, advisoryKg: null, advisoryKind: null });
  unhold();
  expect(state().resolveSlotLoad(input).advisoryKg).toBe(50);
});

test('skill-chain next rung is held without deleting achieved history', () => {
  const group = mockDriver.raw.prepare('SELECT progression_group AS g FROM movement_progression LIMIT 1').get().g;
  expect(state().resolveGoalRung(group, localToday())).not.toBeNull();
  hold();
  expect(state().resolveGoalRung(group, localToday())).toBeNull();
  unhold();
  expect(state().resolveGoalRung(group, localToday())).not.toBeNull();
});

test.each([false, true])('session start (repeat=%s) cannot create coached work with a current hold', (repeat) => {
  hold();
  state().startSession(repeat);
  expect(state().session).toBeNull();
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM session').get().n).toBe(0);
  expect(state().error).toMatch(/support/i);
  unhold();
  state().startSession(repeat);
  expect(state().session).not.toBeNull();
});

test('add-plan-slot defaults respect a hold; an explicitly disjoint movement still works', () => {
  const available = state().getMovementAvailabilityVerdicts('weight_room').filter((v) => v.state === 'available');
  expect(available.length).toBeGreaterThan(1);
  const [first, other] = available;
  hold(first.movementId);
  state().addPlanSlot(first.movementId);
  expect(state().sessionPlan).toHaveLength(0);
  state().addPlanSlot(other.movementId);
  expect(state().sessionPlan.some((slot) => slot.movementId === other.movementId)).toBe(true);
});

test('all substitution layers are hidden for a held source; withdrawal restores the real options', () => {
  const target = state().movements.find((m) => m.name === 'Push-Up') ?? state().movements[0];
  state().openSubstitution(target.movement_id);
  expect(state().substitution).not.toBeNull();
  hold(target.movement_id);
  state().openSubstitution(target.movement_id);
  expect(state().substitution).toBeNull();
  unhold();
  state().openSubstitution(target.movement_id);
  expect(state().substitution).not.toBeNull();
});

test('missing 064 contract fails closed for prescription and load, without deleting history', () => {
  state().loadDemoAthlete();
  const historyCount = mockDriver.raw.prepare('SELECT count(*) AS n FROM session').get().n;
  mockDriver.raw.exec('DROP TABLE health_support_profile');
  state().computePrescription([]);
  expect(state().prescription).toBeNull();
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM session').get().n).toBe(historyCount);
});

const startPlanned = (method = 'LINEAR') => {
  state().generateNewBlock(method);
  expect(state().todayPlan).not.toBeNull();
  state().startSession();
  expect(state().sessionPlan.length).toBeGreaterThan(0);
  return state().sessionPlan[0];
};
const logSlot = (slot) => state().logSet(slot.movementId, slot.plannedReps ?? 5, 0, 5,
  undefined, undefined, undefined, slot.target.kind === 'time' ? { timeS: slot.target.seconds } : undefined, slot.sessionPlanSlotId);

test('store set logging rechecks support after session start and preserves already logged facts', () => {
  const slot = startPlanned();
  logSlot(slot);
  expect(state().session.sets).toHaveLength(1);
  state().skipRunnerRest();
  const next = state().sessionPlan.find((s) => s.sessionPlanSlotId === state().activeSessionPlanSlotId);
  hold();
  logSlot(next);
  expect(state().session.sets).toHaveLength(1);
  expect(state().error).toMatch(/support/i);
  state().runnerHalt('manual');
  state().endSession();
  expect(state().session).toBeNull();
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM set_record').get().n).toBe(1);
});

test.each(['skipRunnerRest', 'advanceRunnerRest', 'setRunnerRestOverride'])('%s cannot expose next work after support changes', (action) => {
  const slot = startPlanned();
  logSlot(slot);
  expect(state().runner.phase).toBe('resting');
  if (action === 'advanceRunnerRest') useStore.setState({ runner: { ...state().runner, restStartedAtMs: 0 } });
  const before = state().runner;
  hold();
  state()[action](60);
  expect(state().runner).toEqual(before);
  expect(state().error).toMatch(/support/i);
});

test('program preference-driven dose is blocked at the current support revision', () => {
  expect(state().createTrainingProgram(programInput)).toBe(true);
  const before = mockDriver.raw.prepare('SELECT * FROM training_program_day ORDER BY day_index').all();
  hold();
  expect(state().updateProgramPreferences({ ...programInput, dayIndices: [1, 4] })).toBe(false);
  expect(state().error).toMatch(/support/i);
  expect(mockDriver.raw.prepare('SELECT * FROM training_program_day ORDER BY day_index').all()).toEqual(before);
  unhold();
  expect(state().updateProgramPreferences({ ...programInput, dayIndices: [1, 4] })).toBe(true);
});

test('continuation preview and commit recheck support for an actually due next block', () => {
  expect(state().createTrainingProgram(programInput)).toBe(true);
  mockDriver.raw.exec("UPDATE training_block SET start_date=date('now','-28 days')");
  state().refreshBlock();
  expect(state().previewNextProgramBlock()).not.toBeNull();
  const count = mockDriver.raw.prepare('SELECT count(*) AS n FROM training_block').get().n;
  hold();
  expect(() => state().previewNextProgramBlock()).toThrow(/support/i);
  state().continueTrainingProgram();
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM training_block').get().n).toBe(count);
  expect(state().error).toMatch(/support/i);
});

test('profile real-store journey captures, confirms, edits and deletes an instruction behind collapsed details', () => {
  const view = render(<ProfileScreen />);
  expect(view.queryByLabelText('Clinician instruction text')).toBeNull();
  fireEvent.press(view.getByLabelText('Show health and training support'));
  fireEvent.changeText(view.getByLabelText('Clinician instruction text'), 'Private transcribed instruction');
  fireEvent.press(view.getByLabelText('Save clinician instruction draft'));
  expect(mockDriver.raw.prepare('SELECT transcription_state FROM clinician_instruction_revision').get().transcription_state).toBe('draft');
  fireEvent.press(view.getByLabelText('Confirm transcription revision 1'));
  expect(mockDriver.raw.prepare('SELECT transcription_state FROM clinician_instruction_revision').get().transcription_state).toBe('user_confirmed');
  expect(state().getTrainingSupportDecision().status).toBe('held');
  fireEvent.press(view.getByLabelText('Edit clinician instruction revision 1'));
  fireEvent.changeText(view.getByLabelText('Clinician instruction text'), 'Changed private transcription');
  fireEvent.press(view.getByLabelText('Save clinician instruction draft'));
  expect(mockDriver.raw.prepare('SELECT transcription_state FROM clinician_instruction_revision WHERE revision=2').get().transcription_state).toBe('draft');
  fireEvent.press(view.getByLabelText('Delete clinician instruction revision 2'));
  expect(view.getByText(/A content-free review hold remains/)).toBeTruthy();
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM clinician_instruction').get().n).toBe(1);
  fireEvent.press(view.getByLabelText('Confirm instruction deletion'));
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM clinician_instruction_revision').get().n).toBe(0);
  expect(state().getTrainingSupportDecision().status).toBe('held');
  fireEvent.press(view.getByLabelText('Hide health and training support'));
  expect(view.queryByText('Changed private transcription')).toBeNull();
});

test('session UI withdraws next-step and set controls when support changes during a session', () => {
  startPlanned();
  const view = render(<SessionScreen />);
  expect(view.getAllByText('Log set').length).toBeGreaterThan(0);
  act(() => { hold(); useStore.setState({ healthSupportRevision: 9 }); });
  expect(view.queryByText('Log set')).toBeNull();
  expect(view.getByLabelText('Finish session while support is on hold')).toBeTruthy();
});

test.each([false, true])('APRE finalisation saves truthful work and gates only future load (held=%s)', (held) => {
  const slot = startPlanned('APRE');
  expect(slot.plannedReps).not.toBeNull();
  mockDriver.raw.prepare('INSERT OR REPLACE INTO one_rep_max (movement_id,load_kg,updated_at_ms) VALUES (?,100,1)').run(slot.movementId);
  expect(mockDriver.raw.prepare(`SELECT count(*) AS n FROM planned_slot sl JOIN planned_session ps USING(planned_session_id)
    WHERE ps.week_index=2 AND sl.movement_id=?`).get(slot.movementId).n).toBeGreaterThan(0);
  state().logSet(slot.movementId, slot.plannedReps + 5, 40, 5, undefined, undefined, undefined, undefined, slot.sessionPlanSlotId);
  expect(state().session.sets).toHaveLength(1);
  if (held) hold();
  state().runnerHalt('manual');
  state().endSession();
  expect(state().session).toBeNull();
  expect(mockDriver.raw.prepare('SELECT reps,load_kg FROM set_record').get()).toMatchObject({ reps: slot.plannedReps + 5, load_kg: 40 });
  const overrides = mockDriver.raw.prepare('SELECT count(*) AS n FROM slot_override').get().n;
  if (held) expect(overrides).toBe(0);
  else expect(overrides).toBeGreaterThan(0);
});

test.each(['swapMovement', 'applyRegression'])('%s rechecks a cached destination hold', (action) => {
  const slot = startPlanned();
  state().openSubstitution(slot.movementId);
  const options = state().substitution.result.layer1Regression.options;
  expect(options.length).toBeGreaterThan(0);
  const destination = options[0].movement_id;
  hold(destination);
  state()[action](slot.movementId, destination);
  expect(state().sessionPlan[0].movementId).toBe(slot.movementId);
  expect(state().error).toMatch(/support/i);
  unhold();
  state()[action](slot.movementId, destination);
  expect(state().sessionPlan[0].movementId).toBe(destination);
});

test('day-swap rechecks a cached option and conserves the original future slot when held', () => {
  const slot = startPlanned();
  state().openSubstitution(slot.movementId);
  // Fixture: place a real eligible regression in a later day to exercise an actual day-swap option.
  const alternative = state().substitution.result.layer1Regression.options[0].movement_id;
  const future = mockDriver.raw.prepare(`SELECT sl.planned_slot_id AS id FROM planned_slot sl
    JOIN planned_session ps USING(planned_session_id) WHERE ps.session_date>? AND sl.movement_id=? LIMIT 1`).get(localToday(), slot.movementId);
  mockDriver.raw.prepare('UPDATE planned_slot SET movement_id=? WHERE planned_slot_id=?').run(alternative, future.id);
  state().openSubstitution(slot.movementId);
  const options = state().substitution.result.layer2DaySwap.options;
  expect(options.length).toBeGreaterThan(0);
  const option = options[0];
  const before = mockDriver.raw.prepare('SELECT * FROM planned_slot WHERE planned_slot_id=?').get(option.plannedSlotId);
  hold(option.movement_id);
  state().applyDaySwap(slot.movementId, option);
  expect(state().sessionPlan[0].movementId).toBe(slot.movementId);
  expect(state().error).toMatch(/support/i);
  expect(mockDriver.raw.prepare('SELECT * FROM planned_slot WHERE planned_slot_id=?').get(option.plannedSlotId)).toEqual(before);
  unhold();
  state().applyDaySwap(slot.movementId, option);
  expect(state().sessionPlan[0].movementId).toBe(option.movement_id);
});

const routineInput = () => {
  state().saveProfile({ training_age: 'elite', session_duration_cap_min: 120,
    equipment_inventory: ['barbell', 'squat_rack', 'dumbbells', 'bench', 'bands', 'boards'] });
  const idOf = (name) => mockDriver.raw.prepare('SELECT movement_id FROM movement WHERE name=?').get(name).movement_id;
  return { name: 'WO06 routine fixture', schemaType: 'LINEAR', slots: [
    { dayIndex: 1, slotIndex: 1, movementId: idOf('Board Press'), role: 'major', sets: 2, reps: 6, targetRpe: 8 },
    { dayIndex: 1, slotIndex: 2, movementId: idOf('Competition Bench'), role: 'major', sets: 3, reps: 7, targetRpe: 8 },
  ] };
};

test('routine save and freeze are separate guarded prescription boundaries', () => {
  const input = routineInput();
  const template = state().saveRoutineTemplate(input);
  expect(template.slots).toHaveLength(2);
  hold();
  expect(() => state().saveRoutineTemplate({ ...input, name: 'Blocked new routine' })).toThrow(/support/i);
  expect(() => state().freezeRoutineTemplateToPlannedSession(template.routineTemplateId)).toThrow(/support/i);
  expect(mockDriver.raw.prepare("SELECT count(*) AS n FROM routine_template WHERE name='Blocked new routine'").get().n).toBe(0);
  unhold();
  expect(state().freezeRoutineTemplateToPlannedSession(template.routineTemplateId)).toBeDefined();
});

test('routine UI does not publish accessory ranking or defaults while support is held', () => {
  routineInput();
  const view = render(<RoutineTemplateBuilder />);
  expect(view.getByText('Linear')).toBeTruthy();
  act(() => { hold(); useStore.setState({ healthSupportRevision: 42 }); });
  expect(view.queryByText('Linear')).toBeNull();
  expect(view.getByText(/routine suggestions are on hold/)).toBeTruthy();
});

test('retrospective factual activity capture remains available under an unresolved hold', () => {
  hold();
  const id = state().saveOneOffActivity({ kindId: 'custom', displayName: 'Already completed activity', demand: 'unknown',
    facilityCode: null, equipmentCode: null, localDate: localToday(), localStartMinute: null, timezoneId: 'Australia/Sydney',
    timing: 'flexible', state: 'completed', modalityId: 'unknown', purposeId: 'recreation',
    expectedDurationMin: null, expectedEffort: null, actualDurationMin: 20, actualEffort: null });
  expect(mockDriver.raw.prepare('SELECT actual_duration_min FROM activity_completion WHERE occurrence_id=?').get(id).actual_duration_min).toBe(20);
  expect(state().getTrainingSupportDecision().status).toBe('held');
});

test('layer-three accessory candidates exclude held destinations while retaining disjoint choices', () => {
  const slot = startPlanned();
  state().reportNiggle('shoulder', 4);
  state().openSubstitution(slot.movementId);
  const cluster = state().substitution.result.layer3Triage.cluster;
  expect(cluster).not.toBeNull();
  expect(cluster.movements.length).toBeGreaterThan(1);
  const destination = cluster.movements[0].movement_id;
  hold(destination);
  state().openSubstitution(slot.movementId);
  const next = state().substitution.result.layer3Triage.cluster;
  expect(next).not.toBeNull();
  expect(next.movements.some((m) => m.movement_id === destination)).toBe(false);
  expect(next.movements.length).toBeGreaterThan(0);
});

test('layer-one candidate publication excludes a held destination before a tap', () => {
  const slot = startPlanned();
  state().openSubstitution(slot.movementId);
  const options = state().substitution.result.layer1Regression.options;
  expect(options.length).toBeGreaterThan(1);
  const destination = options[0].movement_id;
  hold(destination);
  state().openSubstitution(slot.movementId);
  expect(state().substitution.result.layer1Regression.options.some((o) => o.movement_id === destination)).toBe(false);
  expect(state().substitution.result.layer1Regression.options.length).toBeGreaterThan(0);
});

test('repeat of factual history cannot publish free-form defaults while held', () => {
  const slot = startPlanned();
  logSlot(slot);
  state().runnerHalt('manual');
  state().endSession();
  state().wipeActiveBlockState();
  const n = mockDriver.raw.prepare('SELECT count(*) AS n FROM session').get().n;
  hold(slot.movementId);
  state().startSession(false);
  expect(state().session).toBeNull();
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM session').get().n).toBe(n);
  unhold();
  state().startSession(false);
  expect(state().sessionPlan.some((s) => s.movementId === slot.movementId && s.plannedSets > 0)).toBe(true);
});

test('continuation commit independently blocks a due program after an earlier permitted preview', () => {
  expect(state().createTrainingProgram(programInput)).toBe(true);
  mockDriver.raw.exec("UPDATE training_block SET start_date=date('now','-28 days')");
  state().refreshBlock();
  expect(state().previewNextProgramBlock()).not.toBeNull();
  const before = mockDriver.raw.prepare('SELECT * FROM training_block').all();
  hold();
  state().continueTrainingProgram();
  expect(mockDriver.raw.prepare('SELECT * FROM training_block').all()).toEqual(before);
  expect(state().error).toMatch(/support/i);
});

test('routine freeze independently rejects support added after template capture', () => {
  const template = state().saveRoutineTemplate(routineInput());
  const before = mockDriver.raw.prepare('SELECT count(*) AS n FROM planned_session').get().n;
  hold();
  expect(() => state().freezeRoutineTemplateToPlannedSession(template.routineTemplateId)).toThrow(/support/i);
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM planned_session').get().n).toBe(before);
  unhold();
  state().freezeRoutineTemplateToPlannedSession(template.routineTemplateId);
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM planned_session').get().n).toBeGreaterThan(before);
});

test('slot selection cannot move the runner into held work', () => {
  startPlanned();
  expect(state().sessionMode).toBe('self_directed');
  const destination = state().sessionPlan[1];
  const before = state().runner;
  hold(destination.movementId);
  state().selectMovementSlot(destination.sessionPlanSlotId);
  expect(state().runner).toEqual(before);
  unhold();
  state().selectMovementSlot(destination.sessionPlanSlotId);
  expect(state().activeSessionPlanSlotId).toBe(destination.sessionPlanSlotId);
});

test('skip-slot cannot publish held next work, while manual stopping remains reachable', () => {
  startPlanned();
  const before = state().runner;
  hold();
  state().runnerSkipSlot();
  expect(state().runner).toEqual(before);
  state().runnerHalt('manual');
  expect(state().runner.phase).toBe('halted');
});

test.each([['Today', TodayScreen], ['Plan', BlockScreen]])('%s replaces cached prospective guidance with the current support hold', (_name, Screen) => {
  state().generateNewBlock();
  expect(state().todayPlan.slots.length).toBeGreaterThan(0);
  const view = render(<Screen />);
  expect(view.queryByTestId('training-support-notice')).toBeNull();
  act(() => { hold(); useStore.setState({ healthSupportRevision: 70 }); });
  expect(view.getByTestId('training-support-notice')).toBeTruthy();
  expect(view.queryByTestId('today-primary-start')).toBeNull();
});

test('an open instruction editor cannot overwrite a newer saved revision', () => {
  const athlete = state().activeAthleteId;
  state().saveSupportInstruction(athlete, { instructionText: 'Original revision', scopes: [] }, 0);
  const view = render(<ProfileScreen />);
  fireEvent.press(view.getByLabelText('Show health and training support'));
  fireEvent.press(view.getByLabelText('Edit clinician instruction revision 1'));
  const id = mockDriver.raw.prepare('SELECT instruction_id AS id FROM clinician_instruction').get().id;
  act(() => state().saveSupportInstruction(athlete, { instructionId: id, instructionText: 'Newer saved revision', scopes: [] }, state().getHealthSupportFacts().revision));
  fireEvent.changeText(view.getByLabelText('Clinician instruction text'), 'Stale unsaved draft');
  fireEvent.press(view.getByLabelText('Save clinician instruction draft'));
  expect(mockDriver.raw.prepare('SELECT current_revision AS revision FROM clinician_instruction').get().revision).toBe(2);
  expect(view.getByText(/Support changed/)).toBeTruthy();
});

test('layer-two candidate publication excludes a held future movement', () => {
  const slot = startPlanned();
  state().openSubstitution(slot.movementId);
  const alternative = state().substitution.result.layer1Regression.options[0].movement_id;
  const future = mockDriver.raw.prepare(`SELECT sl.planned_slot_id AS id FROM planned_slot sl
    JOIN planned_session ps USING(planned_session_id) WHERE ps.session_date>? AND sl.movement_id=? LIMIT 1`).get(localToday(), slot.movementId);
  mockDriver.raw.prepare('UPDATE planned_slot SET movement_id=? WHERE planned_slot_id=?').run(alternative, future.id);
  state().openSubstitution(slot.movementId);
  expect(state().substitution.result.layer2DaySwap.options.some((o) => o.movement_id === alternative)).toBe(true);
  hold(alternative);
  state().openSubstitution(slot.movementId);
  expect(state().substitution.result.layer2DaySwap.options.some((o) => o.movement_id === alternative)).toBe(false);
});

test('saving inert support prose preserves an open routine draft', () => {
  routineInput();
  const view = render(<RoutineTemplateBuilder />);
  fireEvent.changeText(view.getByLabelText('Routine template name'), 'Unsaved athlete draft');
  act(() => state().saveSupportNote(state().activeAthleteId, 'general', 'Private note, no review requested', undefined, state().getHealthSupportFacts().revision));
  expect(state().getTrainingSupportDecision().status).toBe('available');
  expect(view.getByLabelText('Routine template name').props.value).toBe('Unsaved athlete draft');
});

test('decision evidence identifies block, slot and substitution advice through their real entry points', () => {
  state().generateNewBlock('LINEAR');
  expect(mockDriver.raw.prepare('SELECT count(*) AS n FROM training_block').get().n).toBeGreaterThan(0);
  const movementId = state().getMovementAvailabilityVerdicts('weight_room').find((v) => v.state === 'available').movementId;
  state().addPlanSlot(movementId);
  state().openSubstitution(movementId);
  expect(state().substitution).not.toBeNull();
  const kindFor = (operation) => mockDriver.raw.prepare('SELECT advice_target_kind AS kind FROM recommendation_support_record WHERE advice_target_identity LIKE ?').get(`${operation}:%`).kind;
  expect(kindFor('block-commit')).toBe('block');
  expect(kindFor('add-plan-slot')).toBe('slot');
  expect(kindFor('substitution-preview')).toBe('movement_substitution');
});
