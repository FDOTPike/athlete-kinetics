/**
 * Regression suite for PR #384 CodeRabbit Major remediations across useStore,
 * ProgramSetupScreen, and SessionScreen backed by real SQLite migrations.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import {
  authorizeAthleteDataBoot,
  resetDataMaintenanceLockForTests,
} from '../../src/state/dataMaintenanceLock';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';
import SessionScreen from '../../src/screens/SessionScreen';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

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

jest.setTimeout(60_000);

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
    status: 'booting',
    error: null,
    activeAthleteId: 'default',
    session: null,
    runner: null,
    focus: null,
    goals: [],
    block: null,
    program: null,
    todayPlan: null,
    substitution: null,
    niggles: [],
  });
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
});

describe('PR #384 CodeRabbit Major Remediations', () => {
  test('useStore:3184-3187 — APRE finalization excludes back-off reps from top-set surplus', async () => {
    const db = mockDriverFor('athlete_kinetics.db');
    db.executeSync("UPDATE athlete_profile SET training_age = 'advanced', objective = 'strength', weekly_frequency = 2, session_duration_cap_min = 90 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();

    // Seed completed macro position 4 so nextMacroPosition returns 5 (volume -> top single + 5-rep back-offs)
    db.executeSync("INSERT INTO training_block (start_date, objective, status, created_at_ms) VALUES ('2026-09-01', 'strength', 'archived', 1000)");
    const prevBlockId = db.executeSync('SELECT last_insert_rowid() AS id').rows[0].id;
    db.executeSync("INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted) VALUES (?, 4, 'hypertrophy', 'APRE', 0)", [prevBlockId]);

    useStore.getState().generateNewBlock('APRE');
    await settle();
    const block = useStore.getState().block;
    expect(block).not.toBeNull();

    const backOffRow = db.executeSync(
      `SELECT ps.planned_session_id, sl.planned_slot_id, sl.movement_id, sl.reps, psb.sets AS backoff_sets, psb.reps AS backoff_reps
         FROM planned_session ps
         JOIN planned_slot sl ON sl.planned_session_id = ps.planned_session_id
         JOIN planned_slot_backoff psb ON psb.planned_slot_id = sl.planned_slot_id
        WHERE ps.block_id = ? AND ps.week_index = 1 AND sl.reps = 1
        LIMIT 1`,
      [block.blockId],
    ).rows[0];
    expect(backOffRow).toBeDefined();

    // Seed 1RM so APRE load adjustment would fire if surplus > 0
    useStore.getState().saveOneRepMax(backOffRow.movement_id, 160);

    // Start the planned session, finish preparation, and log EVERY set as prescribed: Set 1 = 1 rep, Sets 2..N = backoff_reps (5)
    useStore.getState().startSession(backOffRow.planned_session_id);
    await settle();
    const prep1 = useStore.getState().preparation;
    if (prep1 !== null) useStore.getState().finishPreparation('already_warm', prep1.revision);
    const planSlot = useStore.getState().sessionPlan.find((s) => s.movementId === backOffRow.movement_id);
    expect(planSlot?.backOff).toBeDefined();
    useStore.getState().selectMovementSlot(planSlot.sessionPlanSlotId);
    useStore.getState().logSet(planSlot.movementId, 1, 140, 8.0);
    for (let i = 0; i < planSlot.backOff.sets; i += 1) {
      useStore.getState().logSet(planSlot.movementId, planSlot.backOff.reps, 125, 7.5);
    }

    useStore.getState().endSession();
    await settle();

    // Week 2 slot for that movement must have ZERO unearned APRE slot_override!
    const week2Slot = db.executeSync(
      `SELECT sl.planned_slot_id
         FROM planned_session ps
         JOIN planned_slot sl ON sl.planned_session_id = ps.planned_session_id
        WHERE ps.block_id = ? AND ps.week_index = 2 AND sl.movement_id = ?
        LIMIT 1`,
      [block.blockId, backOffRow.movement_id],
    ).rows[0];
    expect(week2Slot).toBeDefined();
    const overrides = db.executeSync(
      'SELECT target_load_kg, reason FROM slot_override WHERE planned_slot_id = ?',
      [week2Slot.planned_slot_id],
    ).rows;
    expect(overrides).toHaveLength(0);
  });

  test('useStore:9703-9705 — back-off targets stop after prescribed backOff.sets on extended replacement slots', async () => {
    const db = mockDriverFor('athlete_kinetics.db');
    db.executeSync("UPDATE athlete_profile SET training_age = 'advanced', objective = 'strength', weekly_frequency = 2, session_duration_cap_min = 90 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();

    db.executeSync("INSERT INTO training_block (start_date, objective, status, created_at_ms) VALUES ('2026-09-01', 'strength', 'archived', 1000)");
    const prevBlockId = db.executeSync('SELECT last_insert_rowid() AS id').rows[0].id;
    db.executeSync("INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted) VALUES (?, 6, 'volume', 'LINEAR', 0)", [prevBlockId]);
    useStore.getState().generateNewBlock('LINEAR');
    await settle();
    const block = useStore.getState().block;

    const sbd = db.executeSync(
      `SELECT ps.planned_session_id, sl.movement_id, sl.reps, psb.sets AS backoff_sets, psb.reps AS backoff_reps
         FROM planned_session ps
         JOIN planned_slot sl ON sl.planned_session_id = ps.planned_session_id
         JOIN planned_slot_backoff psb ON psb.planned_slot_id = sl.planned_slot_id
        WHERE ps.block_id = ? AND ps.week_index = 1 AND psb.sets = 2
        LIMIT 1`,
      [block.blockId],
    ).rows[0];
    expect(sbd).toBeDefined();

    useStore.getState().startSession(sbd.planned_session_id);
    await settle();
    const prep2 = useStore.getState().preparation;
    if (prep2 !== null) useStore.getState().finishPreparation('already_warm', prep2.revision);
    const planSlot = useStore.getState().sessionPlan.find((s) => s.movementId === sbd.movement_id);
    db.executeSync('UPDATE session_plan_slot SET planned_sets = 6 WHERE session_plan_slot_id = ?', [planSlot.sessionPlanSlotId]);
    useStore.setState({
      sessionPlan: useStore.getState().sessionPlan.map((s) =>
        s.sessionPlanSlotId === planSlot.sessionPlanSlotId ? { ...s, plannedSets: 6 } : s),
      runner: null,
    });
    useStore.getState().selectMovementSlot(planSlot.sessionPlanSlotId);

    // Log 4 sets: Set 1 = top set, Sets 2-3 = back-off, Set 4 = post-backoff (must NOT use backoff_reps!)
    useStore.getState().logSet(planSlot.movementId, 1, 140, 8.0);
    useStore.getState().logSet(planSlot.movementId, 3, 125, 7.5);
    useStore.getState().logSet(planSlot.movementId, 3, 125, 7.5);
    useStore.getState().logSet(planSlot.movementId, 1, 130, 8.0);

    const targets = db.executeSync(
      `SELECT sr.set_index, sdt.target_reps
         FROM set_record sr
         JOIN set_dose_target sdt ON sdt.set_id = sr.set_id
        WHERE sr.session_id = ?
        ORDER BY sr.set_index`,
      [useStore.getState().session.sessionId],
    ).rows;
    expect(targets.map((r) => [r.set_index, r.target_reps])).toEqual([
      [1, sbd.reps],
      [2, sbd.backoff_reps],
      [3, sbd.backoff_reps],
      [4, sbd.reps],
    ]);
  });

  test('useStore:3932, 8918 & substitution:357 — swap validates bound target, blocks on haltAdvised, and commits rest_of_block atomically', async () => {
    const db = mockDriverFor('athlete_kinetics.db');
    db.executeSync("UPDATE athlete_profile SET training_age = 'elite', objective = 'hypertrophy', weekly_frequency = 2, session_duration_cap_min = 90 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();

    useStore.getState().generateNewBlock('LINEAR');
    await settle();
    const block = useStore.getState().block;
    const week1SessionId = db.executeSync(
      'SELECT planned_session_id FROM planned_session WHERE block_id = ? AND week_index = 1 ORDER BY day_index LIMIT 1',
      [block.blockId],
    ).rows[0].planned_session_id;
    useStore.getState().startSession(week1SessionId);
    await settle();
    const prep3 = useStore.getState().preparation;
    if (prep3 !== null) useStore.getState().finishPreparation('already_warm', prep3.revision);
    const plan = useStore.getState().sessionPlan;
    expect(plan.length).toBeGreaterThanOrEqual(2);
    const slotA = plan[0];
    const slotB = plan[1];

    // 1. Validate selected slot against swap target before writing
    useStore.getState().selectMovementSlot(slotB.sessionPlanSlotId);
    const openedForA = useStore.getState().openNeutralSwap(slotA.movementId);
    expect(openedForA).toBe(true);
    const optA = useStore.getState().substitution.neutralOptions[0];
    expect(optA).toBeDefined();
    // Corrupt active slot to slotB while keeping substitution null: direct swap with mismatched active slot fails closed!
    useStore.setState({ substitution: null, activeSessionPlanSlotId: slotB.sessionPlanSlotId });
    const wrongTargetApplied = useStore.getState().applyNeutralSwap(slotA.movementId, optA.movement_id, 'equipment_busy', 'today_only');
    expect(wrongTargetApplied).toBe(false);
    expect(useStore.getState().sessionPlan.find((s) => s.sessionPlanSlotId === slotB.sessionPlanSlotId).movementId).toBe(slotB.movementId);

    // 2. Atomic rest_of_block rollback on future-slot SQL failure
    useStore.getState().selectMovementSlot(slotA.sessionPlanSlotId);
    useStore.getState().openNeutralSwap(slotA.movementId);
    const origExecute = db.executeSync.bind(db);
    const runnerBefore = useStore.getState().runner;
    const execSpy = jest.spyOn(db, 'executeSync').mockImplementation((sql, params) => {
      if (typeof sql === 'string' && sql.includes('UPDATE planned_slot SET movement_id = ?')) {
        throw new Error('injected future-slot failure');
      }
      return origExecute(sql, params);
    });
    const failedBlockSwap = useStore.getState().applyNeutralSwap(slotA.movementId, optA.movement_id, 'equipment_busy', 'rest_of_block');
    execSpy.mockRestore();
    expect(failedBlockSwap).toBe(false);
    const liveRowAfterFail = db.executeSync(
      'SELECT movement_id FROM session_plan_slot WHERE session_plan_slot_id = ?',
      [slotA.sessionPlanSlotId],
    ).rows[0];
    expect(liveRowAfterFail.movement_id).toBe(slotA.movementId);
    const causeRowsAfterFail = db.executeSync(
      'SELECT * FROM session_slot_swap_cause WHERE session_plan_slot_id = ?',
      [slotA.sessionPlanSlotId],
    ).rows;
    expect(causeRowsAfterFail).toHaveLength(0);
    expect(useStore.getState().runner).toEqual(runnerBefore);

    // 3. Halt-level niggle blocks neutral swap options, applyNeutralSwap, and shows halt UI on neutral sheet
    db.executeSync(
      "INSERT INTO niggle (id, region, severity, reported_at_ms) VALUES ('halt-neck-6', 'neck', 6, ?)",
      [Date.now()],
    );
    useStore.getState().refreshNiggles();
    useStore.getState().openNeutralSwap(slotA.movementId);
    expect(useStore.getState().substitution.result.haltAdvised).toBe(true);
    expect(useStore.getState().substitution.neutralOptions).toEqual([]);
    const blockedByHalt = useStore.getState().applyNeutralSwap(slotA.movementId, optA.movement_id, 'equipment_busy', 'today_only');
    expect(blockedByHalt).toBe(false);

    render(<SessionScreen />);
    const haltBanner = screen.getByTestId('neutral-swap-halt');
    expect(haltBanner).toBeOnTheScreen();
    expect(within(haltBanner).getByText('Stop session')).toBeOnTheScreen();
  });

  test('useStore:6038-6042 & 6703 — single effective competitionDate (25 days away) across preview/create and Duration edit clears countdown sidecar', async () => {
    const db = mockDriverFor('athlete_kinetics.db');
    db.executeSync("UPDATE athlete_profile SET training_age = 'advanced', objective = 'strength', weekly_frequency = 2, session_duration_cap_min = 90 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();

    // Save sport profile with NO saved competition date yet
    useStore.getState().saveSport({
      sportId: 'powerlifting',
      outcomeId: 'bigger_competition_lifts',
      experienceId: '2_to_5_years',
      otherSportName: null,
      practiceSessionsPerWeek: 0,
      matchesPerWeek: 2,
      typicalSessionMinutes: null,
      competitionDate: null,
    });
    await settle();

    const today = useStore.getState().today;
    const [y, m, d] = today.split('-').map(Number);
    const meetDate = new Date(Date.UTC(y, m - 1, d + 25)).toISOString().slice(0, 10);

    const dateInput = {
      horizon: { kind: 'date', requestedReviewDate: meetDate },
      schemaType: 'LINEAR',
      scheduleMode: 'iso_weekday',
      dayIndices: [1, 4],
      days: [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 4, focus: 'upper' }],
    };
    const preview = useStore.getState().previewTrainingProgram(dateInput);
    expect(preview.plan.sessions.length).toBeGreaterThan(0);
    expect(preview.plan.sessions.every((s) => s.session_date < meetDate)).toBe(true);

    const created = useStore.getState().createTrainingProgram(dateInput);
    expect(created).toBe(true);
    await settle();

    const committedBlock = useStore.getState().block;
    const committedSessions = db.executeSync(
      'SELECT session_date FROM planned_session WHERE block_id = ? ORDER BY session_date',
      [committedBlock.blockId],
    ).rows;
    expect(committedSessions.length).toBe(preview.plan.sessions.length);
    expect(committedSessions.every((s) => s.session_date < meetDate)).toBe(true);

    const progId = useStore.getState().program.programId;
    expect(db.executeSync('SELECT competition_date FROM training_program_meet_countdown WHERE program_id = ?', [progId]).rows).toHaveLength(1);

    // Switch the active program from Date to Duration (weeks) — sidecar must be cleared in same tx
    const updated = useStore.getState().updateProgramPreferences({
      horizon: { kind: 'weeks', blockCount: 2 },
      schemaType: 'LINEAR',
      scheduleMode: 'iso_weekday',
      dayIndices: [1, 4],
      days: [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 4, focus: 'upper' }],
    });
    expect(updated).toBe(true);
    await settle();
    expect(db.executeSync('SELECT competition_date FROM training_program_meet_countdown WHERE program_id = ?', [progId]).rows).toHaveLength(0);
  });

  test('ProgramSetupScreen:997, 254, 864 — effort cap updates preview, legacy edit preserves relative_day_index, and routine picker stays visible on preview error', async () => {
    const db = mockDriverFor('athlete_kinetics.db');
    db.executeSync("UPDATE athlete_profile SET training_age = 'advanced', objective = 'strength', weekly_frequency = 2, session_duration_cap_min = 90 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();

    // 1. Effort cap toggle recomputes preview immediately without another edit
    const origPreview = useStore.getState().previewTrainingProgram;
    let previewCalls = 0;
    useStore.setState({
      previewTrainingProgram: (inp) => {
        previewCalls += 1;
        return origPreview(inp);
      },
    });
    const { unmount } = render(<ProgramSetupScreen />);
    fireEvent.press(screen.getByLabelText('Fine-tune your program (optional)'));
    const callsBefore = previewCalls;
    fireEvent.press(screen.getByTestId('program-rpe-cap-9-5'));
    await settle();
    expect(previewCalls).toBeGreaterThan(callsBefore);
    unmount();
    useStore.setState({ previewTrainingProgram: origPreview });

    // 2. Editing a legacy relative_day_index program preserves scheduleMode = 'relative_day_index'
    const createdLegacy = useStore.getState().createTrainingProgram({
      horizon: { kind: 'weeks', blockCount: 2 },
      schemaType: 'LINEAR',
      scheduleMode: 'relative_day_index',
      dayIndices: [1, 3],
      days: [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 3, focus: 'upper' }],
    });
    expect(useStore.getState().error).toBeNull();
    expect(createdLegacy).toBe(true);
    await settle();
    expect(useStore.getState().program.scheduleMode).toBe('relative_day_index');

    const { unmount: unmountEdit } = render(<ProgramSetupScreen editing={true} />);
    fireEvent.press(screen.getByText('12 wk'));
    fireEvent.press(screen.getByText('Save future preferences'));
    await settle();
    expect(useStore.getState().program.plannedBlockCount).toBe(3);
    expect(useStore.getState().program.scheduleMode).toBe('relative_day_index');
    unmountEdit();

    // 3. Routine assignment controls stay visible even when preview fails due to a removed routine day
    const majorMove = useStore.getState().movements.find((m) => m.pattern === 'squat');
    useStore.getState().saveRoutineTemplate({
      name: 'Temp Day',
      schemaType: 'LINEAR',
      slots: [{ dayIndex: 1, movementId: majorMove.movement_id, role: 'major', sets: 3, reps: 5, targetRpe: 8 }],
    });
    await settle();
    const savedRoutineId = useStore.getState().routineTemplates.find((r) => r.name === 'Temp Day').routineTemplateId;
    const progId = useStore.getState().program.programId;
    db.executeSync(
      'INSERT OR REPLACE INTO training_program_day_routine (program_id, day_index, routine_template_id, routine_day_index) VALUES (?, 1, ?, 1)',
      [progId, savedRoutineId],
    );
    db.executeSync('DELETE FROM routine_template_slot WHERE routine_template_id = ?', [savedRoutineId]);
    useStore.getState().refreshProgram();
    await settle();

    render(<ProgramSetupScreen editing={true} />);
    expect(screen.getByTestId('day-routine-picker-1')).toBeOnTheScreen();
    expect(screen.getAllByText('Generated day').length).toBeGreaterThan(0);
  });

  test('useStore:3365 — continuation preview and commit include completed outgoing block 1 in longitudinal evidence', async () => {
    const db = mockDriverFor('athlete_kinetics.db');
    db.executeSync("UPDATE athlete_profile SET training_age = 'advanced', objective = 'strength', weekly_frequency = 2, session_duration_cap_min = 90 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();

    const created = useStore.getState().createTrainingProgram({
      horizon: { kind: 'weeks', blockCount: 2 },
      schemaType: 'LINEAR',
      scheduleMode: 'iso_weekday',
      dayIndices: [1, 4],
      days: [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 4, focus: 'upper' }],
    });
    expect(created).toBe(true);
    await settle();

    const block1Id = useStore.getState().block.blockId;
    const today = useStore.getState().today;
    const [y, m, d] = today.split('-').map(Number);
    const oldStart = new Date(Date.UTC(y, m - 1, d - 35)).toISOString().slice(0, 10);
    // Move block 1 start_date back 35 days so block 1 is completed and ready to continue (still status = 'active')
    db.executeSync('UPDATE training_block SET start_date = ? WHERE block_id = ?', [oldStart, block1Id]);
    const squatId = db.executeSync("SELECT movement_id FROM movement WHERE pattern = 'squat' LIMIT 1").rows[0].movement_id;
    // Log high-RPE overshoot sets across 6 distinct days inside block 1's window so MRV_p is derived from block 1!
    for (let dayOff = 1; dayOff <= 6; dayOff += 1) {
      const sDate = new Date(Date.UTC(y, m - 1, d - 35 + dayOff * 3)).toISOString().slice(0, 10);
      db.executeSync('INSERT INTO session (session_date, started_at_ms) VALUES (?, ?)', [sDate, 1000 + dayOff]);
      const sid = db.executeSync('SELECT last_insert_rowid() AS id').rows[0].id;
      for (let si = 1; si <= 4; si += 1) {
        db.executeSync(
          'INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (?, ?, ?, 5, 100, 9.5, ?)',
          [sid, squatId, si, 1500 + dayOff * 10 + si],
        );
        const setId = db.executeSync('SELECT last_insert_rowid() AS id').rows[0].id;
        db.executeSync(
          "INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms) VALUES (?, NULL, 'planned', 7.0, NULL, ?)",
          [setId, 1500 + dayOff * 10 + si],
        );
      }
    }
    useStore.getState().refreshBlock();
    useStore.getState().refreshProgram();
    await settle();

    // Unrelated preview (without includeCompletedBlockId) does NOT include the active unarchived block
    const unrelatedPreview = useStore.getState().previewTrainingProgram({
      horizon: { kind: 'weeks', blockCount: 2 },
      schemaType: 'LINEAR',
      scheduleMode: 'iso_weekday',
      dayIndices: [1, 4],
      days: [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 4, focus: 'upper' }],
    });
    expect(unrelatedPreview.patternMrvSets).toBeUndefined();

    // Continuation preview DOES include completed outgoing block 1
    const contPreview = useStore.getState().previewTrainingProgram({
      horizon: { kind: 'weeks', blockCount: 2 },
      schemaType: 'LINEAR',
      scheduleMode: 'iso_weekday',
      dayIndices: [1, 4],
      days: [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 4, focus: 'upper' }],
      includeCompletedBlockId: block1Id,
    });
    expect(contPreview.patternMrvSets).toBeDefined();
    expect(contPreview.patternMrvSets.squat).toBeDefined();

    // previewNextProgramBlock() and continueTrainingProgram() succeed cleanly with block 1 evidence included
    const nextPlan = useStore.getState().previewNextProgramBlock();
    expect(nextPlan).not.toBeNull();
    useStore.getState().continueTrainingProgram();
    await settle();
    expect(useStore.getState().error).toBeNull();
    expect(useStore.getState().block.blockId).not.toBe(block1Id);
  });

  test('SessionScreen:1005-1006 — correcting top-set load during back-off phase re-derives back-off load field', async () => {
    const db = mockDriverFor('athlete_kinetics.db');
    db.executeSync("UPDATE athlete_profile SET training_age = 'advanced', objective = 'strength', weekly_frequency = 2, session_duration_cap_min = 90 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();

    db.executeSync("INSERT INTO training_block (start_date, objective, status, created_at_ms) VALUES ('2026-09-01', 'strength', 'archived', 1000)");
    const prevBlockId = db.executeSync('SELECT last_insert_rowid() AS id').rows[0].id;
    db.executeSync("INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted) VALUES (?, 6, 'volume', 'LINEAR', 0)", [prevBlockId]);
    useStore.getState().generateNewBlock('LINEAR');
    await settle();

    const sbd = db.executeSync(
      `SELECT ps.planned_session_id, sl.movement_id, psb.load_multiplier
         FROM planned_session ps
         JOIN planned_slot sl ON sl.planned_session_id = ps.planned_session_id
         JOIN planned_slot_backoff psb ON psb.planned_slot_id = sl.planned_slot_id
        WHERE ps.block_id = ? AND ps.week_index = 1
        LIMIT 1`,
      [useStore.getState().block.blockId],
    ).rows[0];
    expect(sbd).toBeDefined();

    useStore.getState().startSession(sbd.planned_session_id);
    await settle();
    const prep = useStore.getState().preparation;
    if (prep !== null) useStore.getState().finishPreparation('already_warm', prep.revision);
    const planSlot = useStore.getState().sessionPlan.find((s) => s.movementId === sbd.movement_id);
    useStore.getState().selectMovementSlot(planSlot.sessionPlanSlotId);
    // Log Set 1 top set at 100 kg -> first back-off derives 90 kg (0.9 * 100)
    useStore.getState().logSet(planSlot.movementId, 1, 100, 8.0);
    await settle();

    render(<SessionScreen />);
    const readyNow = screen.queryByText('Ready now');
    if (readyNow !== null) {
      fireEvent.press(readyNow);
      await settle();
    }
    const loadInput = screen.getByTestId('session-load-input');
    expect(loadInput.props.value).toBe('90.0');

    // Correct Set 1 top set to 120 kg -> back-off field must re-derive 107.5 kg (round(120 * 0.9 = 108 -> 107.5))!
    const topSetId = useStore.getState().session.sets[0].set_id;
    useStore.getState().editSet(topSetId, 1, 120, 8.0);
    await settle();
    expect(screen.getByTestId('session-load-input').props.value).toBe('107.5');
  });
});
