/**
 * Fail-first integration & UI verification for Phase 2 #228 (Advanced Athlete Control)
 * + Owner A7 (Introductory Week 1), backed by real SQLite migrations & useStore.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import {
  authorizeAthleteDataBoot,
  resetDataMaintenanceLockForTests,
} from '../../src/state/dataMaintenanceLock';
import ProgramSetupScreen, { chosenSplitText } from '../../src/screens/ProgramSetupScreen';
import BlockScreen from '../../src/screens/BlockScreen';
import { offPlanSessionName } from '../../src/state/offPlanStart';
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
  });
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
});

describe('#228 Phase 2 Advanced Athlete Control', () => {
  test('Q3 + Q2: fixed Mon–Sun toggles, exact Q3 caption, extended foci (Push/Pull/Legs/Accessories), chronological non-Monday placement & BlockScreen grid alignment', async () => {
    const db = mockDriverFor('athlete_kinetics.db');
    db.executeSync("UPDATE athlete_profile SET training_age = 'advanced', objective = 'hypertrophy', weekly_frequency = 3 WHERE profile_id = 1");
    const RealDate = Date;
    const dateSpy = jest.spyOn(global, 'Date').mockImplementation((...args) => (
      args.length === 0 ? new RealDate(2026, 10, 18, 12, 0, 0) : new RealDate(...args)
    ));
    Date.now = RealDate.now;
    Date.UTC = RealDate.UTC;
    Date.parse = RealDate.parse;
    try {
      useStore.setState({ status: 'booting' });
      useStore.getState().boot();
      await settle();

      render(<ProgramSetupScreen />);
      fireEvent.press(screen.getByLabelText('Fine-tune your program (optional)'));

      // Exact ratified Q3 caption
      expect(screen.getByText('Choose the days of the week you train. Your schedule repeats every week.')).toBeOnTheScreen();

      // Fixed Mon..Sun chips (all 7 present, no relative 'Day 1, ...' label)
      for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
        expect(screen.getAllByText(day).length).toBeGreaterThanOrEqual(1);
      }
      expect(screen.queryByText(/Day 1,/)).toBeNull();

      // Extended focus chips rendered via sessionFocusName on Mon (first selected day)
      expect(screen.getAllByText('Push').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pull').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Legs').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Accessories').length).toBeGreaterThan(0);

      // Test creating directly on store with Wednesday 2026-11-18 startDate & Mon/Wed/Fri ISO weekdays
      const previewInput = {
        horizon: { kind: 'weeks', blockCount: 1 },
        schemaType: 'LINEAR',
        dayIndices: [1, 3, 5],
        days: [
          { dayIndex: 1, focus: 'legs' },
          { dayIndex: 3, focus: 'push' },
          { dayIndex: 5, focus: 'pull' },
        ],
      };
      const preview = useStore.getState().previewTrainingProgram(previewInput);
      const week1Dates = preview.plan.sessions.filter((s) => s.week_index === 1).map((s) => ({
        day: s.day_index,
        focus: s.focus,
        date: s.session_date,
      }));
      expect(week1Dates).toEqual([
        { day: 3, focus: 'push', date: '2026-11-18' },
        { day: 5, focus: 'pull', date: '2026-11-20' },
        { day: 1, focus: 'legs', date: '2026-11-23' },
      ]);

      const ok = useStore.getState().createTrainingProgram(previewInput);
      expect(ok).toBe(true);
      expect(useStore.getState().program?.days).toEqual([
        { dayIndex: 1, focus: 'legs' },
        { dayIndex: 3, focus: 'push' },
        { dayIndex: 5, focus: 'pull' },
      ]);

      // BlockScreen Week 1 Today marker must align with the Wed push session (NOT recovery day),
      // and Week 2 renders the extended PSH/PUL/LEG abbreviations.
      render(<BlockScreen />);
      const week1Row = screen.getByTestId('trajectory-days-week-1');
      const todayCell = within(week1Row).getByTestId('today-marker');
      expect(todayCell.props.accessibilityLabel).toContain('push session on 2026-11-18');
      expect(within(week1Row).getByText('PUL')).toBeOnTheScreen();
      expect(within(week1Row).getByText('LEG')).toBeOnTheScreen();
      const week2Row = screen.getByTestId('trajectory-days-week-2');
      expect(within(week2Row).getByText('PSH')).toBeOnTheScreen();
    } finally {
      dateSpy.mockRestore();
    }
  });

  test('Q1 + A7: intermediate+ Customize enables slot dose controls, routine-day assignment, MRV ceiling override & keeps beginner movement-only', async () => {
    const db = mockDriverFor('athlete_kinetics.db');

    // 1) Beginner stays movement-swap-only
    db.executeSync("UPDATE athlete_profile SET training_age = 'beginner', objective = 'strength', weekly_frequency = 1 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();
    render(<ProgramSetupScreen />);
    fireEvent.press(screen.getByLabelText('Fine-tune your program (optional)'));
    expect(screen.getByText('Customize changes movements only. Sets, reps and RPE stay coach-controlled.')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Customize'));
    expect(screen.queryByTestId('slot-sets-1-1')).toBeNull();
    expect(screen.queryByTestId('day-routine-picker-1')).toBeNull();

    // 2) Advanced unlocks dose controls, routine assignment & #53 Introductory Week 1 on Block 1
    db.executeSync("UPDATE athlete_profile SET training_age = 'advanced', objective = 'strength', weekly_frequency = 1 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();
    const movements = useStore.getState().movements;
    const boxSquat = movements.find((m) => m.name === 'Box Squat');
    expect(boxSquat).toBeDefined();
    useStore.getState().saveRoutineTemplate({
      name: 'Adv Squat Day',
      schemaType: 'LINEAR',
      slots: [{ dayIndex: 1, movementId: boxSquat.movement_id, role: 'major', sets: 5, reps: 5, targetRpe: 8.0 }],
    });

    render(<ProgramSetupScreen />);
    fireEvent.press(screen.getByLabelText('Fine-tune your program (optional)'));

    // Exact ratified intermediate+ Customize caption
    expect(screen.getByText('Choose exercises, sets, reps and target RPE for each slot, or assign a saved routine to a day.')).toBeOnTheScreen();

    // Block 1 Introductory Week 1 note & Week 1 lighter working sets (-1 floored at 2)
    expect(
      screen.getByText('Week 1 is an introductory week with lighter volume to gauge your work capacity before stepping up in Weeks 2 and 3.'),
    ).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Customize'));
    expect(screen.getByTestId('slot-sets-1-1')).toBeOnTheScreen();
    expect(screen.getByTestId('slot-reps-1-1')).toBeOnTheScreen();
    expect(screen.getByTestId('slot-rpe-1-1')).toBeOnTheScreen();

    // Test per-slot dose stepper edit (+1 sets from #53 W1 3 -> 4) before routine assignment
    fireEvent.press(screen.getAllByLabelText('Increase Sets')[0]);
    expect(within(screen.getByTestId('slot-sets-1-1')).getByText('4')).toBeOnTheScreen();

    // Routine-day assignment picker offers Generated day + Adv Squat Day · Day 1
    expect(screen.getByTestId('day-routine-picker-1')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Adv Squat Day · Day 1'));

    // Commit program & confirm DB persistence + reload via boot()
    fireEvent.press(screen.getByLabelText('Create program'));
    expect(useStore.getState().error).toBeNull();
    expect(useStore.getState().program?.days[0].routineAssignment?.routineName).toBe('Adv Squat Day');

    useStore.setState({ status: 'booting', program: null });
    useStore.getState().boot();
    await settle();
    expect(useStore.getState().program?.days[0].routineAssignment?.routineName).toBe('Adv Squat Day');
  });

  test('SQLite persistence + store reload: accessories focus, slot dose overrides (intermediate/elite), and BlockScreen ACC label', async () => {
    const db = mockDriverFor('athlete_kinetics.db');
    db.executeSync("UPDATE athlete_profile SET training_age = 'elite', objective = 'hypertrophy', weekly_frequency = 1 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();

    const ok = useStore.getState().createTrainingProgram({
      horizon: { kind: 'weeks', blockCount: 1 },
      schemaType: 'LINEAR',
      dayIndices: [1],
      days: [{ dayIndex: 1, focus: 'accessories' }],
      slotOverrides: [{ dayIndex: 1, slotIndex: 1, sets: 6, reps: 14, targetRpe: 8.5 }],
    });
    expect(ok).toBe(true);

    // Reload from fresh boot and assert side-car durability across restarts
    useStore.setState({ status: 'booting', program: null, block: null, blockSessions: [], todayPlan: null });
    useStore.getState().boot();
    await settle();

    const state = useStore.getState();
    expect(state.program?.days).toEqual([{ dayIndex: 1, focus: 'accessories' }]);
    expect(state.program?.scheduleMode).toBe('iso_weekday');
    expect(state.program?.slotOverrides).toEqual([
      { dayIndex: 1, slotIndex: 1, sets: 6, reps: 14, targetRpe: 8.5 },
    ]);
    expect(state.blockSessions[0]?.focus).toBe('accessories');

    const loadedSlots = state.loadSessionSlots(state.blockSessions[0].plannedSessionId);
    expect(loadedSlots[0]).toMatchObject({
      sets: 6,
      reps: 14,
      targetRpe: 8.5,
      athleteOverride: { source: 'slot_override' },
    });

    render(<BlockScreen />);
    expect(screen.getAllByText('ACC').length).toBeGreaterThan(0);

    // #33 FOCUS_SPLIT_WORD + FOCUS_WORD for 'accessories' must use 'accessory'
    expect(chosenSplitText('strength', ['accessories'])).toBe('1 accessory session a week, as you chose.');
    expect(offPlanSessionName({ sessionDate: '2026-11-16', focus: 'accessories' })).toBe("Monday's accessory session");
  });

  test('longitudinal patternMrvSets wiring: coach-build clamps to MRV_p while Customize override > MRV_p shows exact note & keeps [1,10]', async () => {
    const db = mockDriverFor('athlete_kinetics.db');
    db.executeSync("UPDATE athlete_profile SET training_age = 'advanced', objective = 'strength', weekly_frequency = 1 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();

    const squatMv = useStore.getState().movements.find((m) => m.pattern === 'squat');
    expect(squatMv).toBeDefined();
    // Seed an archived block whose Week-3 squat sets overreached (delta_rpe = +2.5 vs target, peak sets = 5)
    // so evaluateLongitudinalAutopilot(DEFAULT_LONGITUDINAL_AUTOPILOT_POLICY) yields patternMrvSets.squat = 4.
    db.executeSync("INSERT INTO training_block (block_id, start_date, objective, created_at_ms, status) VALUES (900, '2026-09-01', 'strength', 1, 'archived')");
    db.executeSync("INSERT INTO block_meta (block_id, macro_block_index, macro_phase, schema_type, peak_shifted) VALUES (900, 1, 'gpp', 'LINEAR', 0)");
    db.executeSync("INSERT INTO planned_session (planned_session_id, block_id, week_index, day_index, focus, phase, session_date) VALUES (900, 900, 1, 1, 'lower', 'accumulation', '2026-09-01')");
    db.executeSync(
      'INSERT INTO planned_slot (planned_slot_id, planned_session_id, slot_index, movement_id, sets, reps, target_rpe) VALUES (900, 900, 1, ?, 5, 5, 7.0)',
      [squatMv.movement_id],
    );
    const sessionDates = [
      '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17',
      '2026-09-18', '2026-09-19', '2026-09-20',
    ];
    for (let idx = 0; idx < sessionDates.length; idx += 1) {
      const sid = 901 + idx;
      db.executeSync(
        'INSERT INTO session (session_id, session_date, duration_min, started_at_ms) VALUES (?, ?, 45, ?)',
        [sid, sessionDates[idx], sid],
      );
      db.executeSync(
        'INSERT INTO set_record (set_id, session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms) VALUES (?, ?, ?, 1, 5, 100, 9.5, ?)',
        [sid, sid, squatMv.movement_id, sid],
      );
      db.executeSync(
        "INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms) VALUES (?, NULL, 'planned', 6.5, 900, 1)",
        [sid],
      );
    }

    const baseInput = {
      horizon: { kind: 'weeks', blockCount: 1 },
      schemaType: 'LINEAR',
      dayIndices: [1],
      days: [{ dayIndex: 1, focus: 'legs' }],
    };

    // 1) Coach build strictly clamps squat working sets to MRV_p = 4
    const coachPreview = useStore.getState().previewTrainingProgram(baseInput);
    expect(coachPreview.patternMrvSets?.squat).toBe(4);
    const coachSquatSlot = coachPreview.plan.sessions[0].slots.find((sl) => {
      const m = useStore.getState().movements.find((mv) => mv.movement_id === sl.movement_id);
      return m?.pattern === 'squat';
    });
    expect(coachSquatSlot.sets).toBeLessThanOrEqual(4);

    // 2) Customize explicit edit to 6 sets honors 6 sets AND emits exact MRV ceiling note
    const customInput = {
      ...baseInput,
      slotOverrides: [{ dayIndex: 1, slotIndex: 1, sets: 6 }],
    };
    const customPreview = useStore.getState().previewTrainingProgram(customInput);
    expect(customPreview.plan.coachNotes).toContain('Above your recent recovery ceiling of 4 sets.');
    expect(customPreview.plan.sessions[0].slots[0].sets).toBe(6);

    // Verify ProgramSetupScreen renders exact MRV note after raising sets in Customize
    render(<ProgramSetupScreen />);
    fireEvent.press(screen.getByLabelText('Fine-tune your program (optional)'));
    fireEvent.press(screen.getByText('Customize'));
    const setsRow = screen.getByTestId('slot-sets-1-1');
    const incBtn = within(setsRow).getByLabelText('Increase Sets');
    fireEvent.press(incBtn);
    fireEvent.press(incBtn);
    fireEvent.press(incBtn); // pushes sets above 4 (up to >= 5..6)
    expect(screen.getByText('Above your recent recovery ceiling of 4 sets.')).toBeOnTheScreen();

    // Commit and verify above_mrv persisted in planned_slot_athlete_override
    fireEvent.press(screen.getByLabelText('Create program'));
    expect(useStore.getState().error).toBeNull();
    const wk1Slots = useStore.getState().loadSessionSlots(useStore.getState().blockSessions[0].plannedSessionId);
    expect(wk1Slots[0].athleteOverride).toEqual({
      source: 'slot_override',
      mrvCeilingSets: 4,
      aboveMrv: true,
    });
  });

  test('#53 Intro Week 1: Block 1 trims extra uncustomized day in Week 1, steps linearly to full schedule in Weeks 2–3, and Block 2 skips Intro Week 1', async () => {
    const db = mockDriverFor('athlete_kinetics.db');
    db.executeSync("UPDATE athlete_profile SET training_age = 'intermediate', objective = 'strength', weekly_frequency = 4 WHERE profile_id = 1");
    useStore.setState({ status: 'booting' });
    useStore.getState().boot();
    await settle();

    const fourDayInput = {
      horizon: { kind: 'weeks', blockCount: 2 },
      schemaType: 'LINEAR',
      dayIndices: [1, 2, 4, 6],
      days: [
        { dayIndex: 1, focus: 'lower' },
        { dayIndex: 2, focus: 'upper' },
        { dayIndex: 4, focus: 'legs' },
        { dayIndex: 6, focus: 'push' },
      ],
    };
    const preview = useStore.getState().previewTrainingProgram(fourDayInput);
    expect(preview.plan.coachNotes).toContain(
      'Week 1 is an introductory week with lighter volume to gauge your work capacity before stepping up in Weeks 2 and 3.',
    );
    expect(preview.plan.sessions.filter((s) => s.week_index === 1)).toHaveLength(3);
    expect(preview.plan.sessions.filter((s) => s.week_index === 2)).toHaveLength(4);
    expect(preview.plan.sessions.filter((s) => s.week_index === 3)).toHaveLength(4);

    // Customize view renders all 4 scheduled days including Day 6 paused in Week 1
    render(<ProgramSetupScreen />);
    fireEvent.press(screen.getByLabelText('Fine-tune your program (optional)'));
    fireEvent.press(screen.getByText('Customize'));
    expect(screen.getByTestId('customize-slot-6-1')).toBeOnTheScreen();

    // Commit Block 1
    expect(useStore.getState().createTrainingProgram(fourDayInput)).toBe(true);
    const sessions = useStore.getState().blockSessions;
    expect(sessions.filter((s) => s.weekIndex === 1)).toHaveLength(3);
    expect(sessions.filter((s) => s.weekIndex === 2)).toHaveLength(4);

    // Editing a program once Block 1 is active previews Block 2 (no Intro Week 1 trim)
    const block2Preview = useStore.getState().previewTrainingProgram(fourDayInput);
    expect(block2Preview.plan.sessions.filter((s) => s.week_index === 1)).toHaveLength(4);
    expect(block2Preview.plan.coachNotes ?? []).not.toContain(
      'Week 1 is an introductory week with lighter volume to gauge your work capacity before stepping up in Weeks 2 and 3.',
    );
  });
});
