/**
 * Phase 2 Strength & Competitive Meet Programming (#219 + #229) UI & Store tests.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useStore } from '../../src/state/useStore';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { SportEditor, COMPETITION_DATE_FIRST_NOTE } from '../../src/components/SportFields';
import { SportPanel } from '../../src/components/SportPanel';
import { EQUIPMENT_ITEMS, SPORT_PEAKING_CATALOG, addDaysIso, applyPrescriptionToSlot } from '@ak/inference';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';
import BlockScreen from '../../src/screens/BlockScreen';
import TodayScreen from '../../src/screens/TodayScreen';
import SessionScreen from '../../src/screens/SessionScreen';
import { NavigationProvider } from '../../src/navigation/navigation';
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
    sport: null,
  });
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');
});

describe('#229 Q8 Equipment inventory untouched', () => {
  test('keeps exactly the 11 existing EQUIPMENT_ITEMS', () => {
    expect(EQUIPMENT_ITEMS).toHaveLength(11);
  });
});

describe('#229 Q7 Verbatim lifting sport copy & 0..52 competition frequency', () => {
  test.each([
    ['powerlifting'],
    ['olympic_weightlifting'],
    ['strongman'],
  ])('renders exact lifting copy for %s', (sportId) => {
    const onChange = jest.fn();
    render(
      <SportEditor
        fields={{
          family: 'strength',
          sportId,
          otherSportName: '',
          outcomeId: sportId === 'powerlifting' ? 'bigger_competition_lifts' : 'general_support',
          experienceId: 'over_5_years',
          practiceSessionsPerWeek: 0,
          matchesPerWeek: 4,
          minutesText: '',
          competitionText: '2099-03-01',
        }}
        onChange={onChange}
        today={useStore.getState().today}
      />,
    );

    expect(screen.getByText('How long have you trained for competition?')).toBeOnTheScreen();
    expect(screen.getByText(/^Competitions a year$/i)).toBeOnTheScreen();
    expect(screen.getByLabelText('Increase Competitions a year')).toBeOnTheScreen();
    expect(
      screen.getByText("Since this is your main lifting goal, we won't count your gym sessions twice as outside sport practice."),
    ).toBeOnTheScreen();
    expect(COMPETITION_DATE_FIRST_NOTE).toBe(
      'If you add a competition date, your blocks count down to peak and taper for competition day, and the date stays synced with your goal review.',
    );
  });

  test('saves lifting sport with 20 competitions/year and keeps sport_peaking_movement static catalog across resetTrainingData', () => {
    const compDate = (() => {
      const d = new Date(`${useStore.getState().today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 60);
      return d.toISOString().slice(0, 10);
    })();
    let saved = false;
    act(() => {
      saved = useStore.getState().saveSport({
        sportId: 'olympic_weightlifting',
        outcomeId: 'general_support',
        experienceId: 'over_5_years',
        otherSportName: null,
        practiceSessionsPerWeek: 0,
        matchesPerWeek: 20,
        typicalSessionMinutes: null,
        competitionDate: compDate,
      });
    });
    expect(saved).toBe(true);
    expect(useStore.getState().sport?.sportId).toBe('olympic_weightlifting');
    expect(useStore.getState().sport?.matchesPerWeek).toBe(20);
    expect(useStore.getState().sportWorkload.sessionsPerWeek).toBe(0);

    act(() => {
      useStore.getState().resetTrainingData();
    });
    const db = mockDriverFor('athlete_kinetics.db');
    const row = db.executeSync("SELECT COUNT(*) AS c FROM sport_peaking_movement WHERE sport_id = 'basketball'").rows[0];
    expect(Number(row.c)).toBe(3);
  });
});

describe('#229 Q4 Effort cap default 9.0 & 9.5 opt-in in Fine-tune', () => {
  test('only advanced/elite see 9.5 opt-in in Fine-tune; default stays 9.0', () => {
    act(() => {
      useStore.getState().saveProfile({ training_age: 'intermediate', objective: 'strength', base_rpe_cap: 9.0 });
    });
    const r1 = render(<ProgramSetupScreen />);
    fireEvent.press(screen.getByText('Fine-tune your program (optional)'));
    expect(screen.queryByTestId('program-rpe-cap-9-5')).toBeNull();
    r1.unmount();

    act(() => {
      useStore.getState().saveProfile({ training_age: 'advanced', objective: 'strength', base_rpe_cap: 9.0 });
    });
    render(<ProgramSetupScreen />);
    fireEvent.press(screen.getByText('Fine-tune your program (optional)'));
    const optIn = screen.getByTestId('program-rpe-cap-9-5');
    expect(optIn).toBeOnTheScreen();
    fireEvent.press(optIn);
    // Draft until confirmation: Cancel leaves saved profile unchanged; Create program persists 9.5.
    expect(useStore.getState().profile.base_rpe_cap).toBe(9.0);
    fireEvent.press(screen.getByText('Create program'));
    expect(useStore.getState().profile.base_rpe_cap).toBe(9.5);
  });
});

describe('#229 Q5 & Q6 & question1: Plan header, canonical date sync & peaking catalog', () => {
  test('syncs canonical competition date across Sport, Goal deadline, and Program horizon, and renders Plan header + basketball peaking catalog', () => {
    const meetDate = (() => {
      const d = new Date(`${useStore.getState().today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 49);
      return d.toISOString().slice(0, 10);
    })();
    act(() => {
      useStore.getState().saveProfile({
        objective: 'strength',
        training_age: 'advanced',
        weekly_frequency: 4,
        session_duration_cap_min: 90,
        equipment_inventory: ['barbell', 'squat_rack', 'bench', 'dumbbells'],
      });
      useStore.getState().saveSport({
        sportId: 'basketball',
        outcomeId: 'general_support',
        experienceId: 'over_5_years',
        otherSportName: null,
        practiceSessionsPerWeek: 2,
        matchesPerWeek: 1,
        typicalSessionMinutes: 60,
        competitionDate: meetDate,
      });
      useStore.getState().saveGoal({
        specificOutcome: 'Squat 140 kg before meet',
        metricId: 'load_kg',
        unit: 'kg',
        measurementMethod: 'Logged top single',
        baselineKnown: true,
        baselineValue: 120,
        targetValue: 140,
        reason: 'Competition readiness',
        requestedDeadline: null,
      });
      useStore.getState().createTrainingProgram({
        dayIndices: [1, 2, 4, 5],
        days: [
          { dayIndex: 1, focus: 'lower' },
          { dayIndex: 2, focus: 'upper' },
          { dayIndex: 4, focus: 'lower' },
          { dayIndex: 5, focus: 'upper' },
        ],
        horizon: { kind: 'date', requestedReviewDate: meetDate },
        schemaType: 'WAVE',
        movementPreferences: [],
      });
    });

    const st = useStore.getState();
    expect(st.program?.plannedEndDate).toBe(meetDate);
    expect(st.program?.requestedReviewDate).toBe(meetDate);
    expect(st.goals[0]?.goal.requestedDeadline).toBe(meetDate);

    // Update goal deadline -> syncs sport & program canonically
    const newMeetDate = (() => {
      const d = new Date(`${meetDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 14);
      return d.toISOString().slice(0, 10);
    })();
    act(() => {
      useStore.getState().saveGoal(
        {
          specificOutcome: 'Squat 140 kg before meet',
          metricId: 'load_kg',
          unit: 'kg',
          measurementMethod: 'Logged top single',
          baselineKnown: true,
          baselineValue: 120,
          targetValue: 140,
          reason: 'Competition readiness',
          requestedDeadline: newMeetDate,
        },
        { goalId: st.goals[0].goalId, expectedRevision: st.goals[0].revision },
      );
    });
    expect(useStore.getState().sport?.competitionDate).toBe(newMeetDate);
    expect(useStore.getState().program?.requestedReviewDate).toBe(newMeetDate);

    const rBlock = render(
      <NavigationProvider initialTab="plan">
        <BlockScreen />
      </NavigationProvider>,
    );
    expect(screen.getByText(/Block 1 of \d+ · \d+ weeks to competition/)).toBeOnTheScreen();
    expect(screen.getByText('Mock basketball game')).toBeOnTheScreen();
    expect(screen.getByText('Specific basketball movement drills')).toBeOnTheScreen();
    expect(screen.getByText('High-intensity cardio')).toBeOnTheScreen();
    rBlock.unmount();

    // Non-basketball non-powerlifting sport with empty catalog shows fallback copy
    expect(SPORT_PEAKING_CATALOG.football_rugby).toEqual([]);
    act(() => {
      useStore.getState().saveSport({
        sportId: 'football_rugby',
        outcomeId: 'general_support',
        experienceId: 'over_5_years',
        otherSportName: null,
        practiceSessionsPerWeek: 2,
        matchesPerWeek: 1,
        typicalSessionMinutes: 60,
        competitionDate: newMeetDate,
      });
    });
    render(
      <NavigationProvider initialTab="plan">
        <BlockScreen />
      </NavigationProvider>,
    );
    expect(
      screen.getByText('Sport-specific peaking movements for Rugby will be added over time.'),
    ).toBeOnTheScreen();
  });
});

describe('#229 Q2 SessionScreen back-off Set 1 vs Set 2 load/rep pre-fill', () => {
  test('Set 1 prompts top single and after logging 140 kg Set 2 pre-fills -10% (125 kg) x back-off reps', () => {
    act(() => {
      useStore.getState().saveProfile({
        objective: 'strength',
        training_age: 'advanced',
        weekly_frequency: 4,
        session_duration_cap_min: 90,
        equipment_inventory: ['barbell', 'squat_rack', 'bench', 'dumbbells'],
      });
      // Seed 1RM-capable squat history so Set 1 works cleanly and generate peak block.
      const db = mockDriverFor('athlete_kinetics.db');
      const sq = useStore.getState().movements.find((m) => m.pattern === 'squat' && m.name.toLowerCase().includes('back squat'));
      if (sq) {
        useStore.getState().saveMovementLoadIntent(sq.movement_id, 'BB');
      }
      // 1-block countdown triggers peak block (top single + 2x3 @ -10%)
      const meetDate = (() => {
        const d = new Date(`${useStore.getState().today}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 25);
        return d.toISOString().slice(0, 10);
      })();
      useStore.getState().saveSport({
        sportId: 'powerlifting',
        outcomeId: 'bigger_competition_lifts',
        experienceId: 'over_5_years',
        otherSportName: null,
        practiceSessionsPerWeek: 0,
        matchesPerWeek: 2,
        typicalSessionMinutes: null,
        competitionDate: meetDate,
      });
      useStore.getState().generateNewBlock('WAVE');
      useStore.getState().startSession();
      const prep = useStore.getState().preparation;
      if (prep !== null) {
        useStore.getState().finishPreparation('already_warm', prep.revision);
      }
    });

    const firstSlot = useStore.getState().sessionPlan[0];
    expect(firstSlot.plannedReps).toBe(1);
    expect(firstSlot.backOff).toBeTruthy();
    expect(firstSlot.backOff.reps).toBe(3);

    render(<SessionScreen />);
    const loadInput = screen.getByTestId('session-load-input');
    expect(screen.getByLabelText('Actual reps 1')).toBeOnTheScreen();
    fireEvent.changeText(loadInput, '140');
    fireEvent.press(screen.getByText('Log set'));
    act(() => {
      useStore.getState().skipRunnerRest();
    });

    // Set 2 should pre-fill back-off reps (3) and -10% on 2.5 kg grid (125.0 kg)!
    expect(screen.getByLabelText('Actual reps 3')).toBeOnTheScreen();
    expect(screen.getByTestId('session-load-input').props.value).toBe('125.0');

    // Logging Set 2 writes the back-off prescribed dose (3 reps @ backOff.targetRpe)
    // and Set 3 retains the Set 2 load instead of applying -10% a second time.
    fireEvent.press(screen.getByText('Log set'));
    act(() => {
      useStore.getState().skipRunnerRest();
    });
    expect(screen.getByLabelText('Actual reps 3')).toBeOnTheScreen();
    expect(screen.getByTestId('session-load-input').props.value).toBe('125.0');
    const setRows = mockDriverFor('athlete_kinetics.db').executeSync(
      'SELECT sr.set_index, sdt.target_reps, st.target_rpe FROM set_record sr JOIN set_dose_target sdt ON sdt.set_id = sr.set_id JOIN set_target st ON st.set_id = sr.set_id ORDER BY sr.set_index',
    ).rows;
    expect(setRows.length).toBe(2);
    expect(setRows[0].target_reps).toBe(1);
    expect(setRows[1].target_reps).toBe(3);
    expect(setRows[1].target_rpe).toBe(firstSlot.backOff.targetRpe);
  });
});

describe('#59 regressions: meet-day 0w, lifting-sport peaking, 0-set backOff guard & countdown lifecycle', () => {
  const localTodayIso = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  test('olympic_weightlifting with competitionDate shows fallback peaking text on both SportPanel and BlockScreen', () => {
    const compDate = addDaysIso(localTodayIso(), 42);
    act(() => {
      useStore.getState().saveProfile({
        objective: 'strength',
        training_age: 'intermediate',
        weekly_frequency: 3,
        session_duration_cap_min: 90,
        equipment_inventory: ['barbell', 'squat_rack', 'bench', 'dumbbells'],
        base_rpe_cap: 9.0,
      });
      useStore.getState().saveSport({
        sportId: 'olympic_weightlifting',
        outcomeId: 'general_support',
        experienceId: 'over_5_years',
        otherSportName: null,
        practiceSessionsPerWeek: 0,
        matchesPerWeek: 3,
        typicalSessionMinutes: null,
        competitionDate: compDate,
      });
      useStore.getState().generateNewBlock('LINEAR');
    });

    const rPanel = render(<SportPanel />);
    expect(screen.getByTestId('profile-sport-peaking')).toBeOnTheScreen();
    expect(
      screen.getByText('Sport-specific peaking movements for Olympic weightlifting will be added over time.'),
    ).toBeOnTheScreen();
    rPanel.unmount();

    render(
      <NavigationProvider initialTab="plan">
        <BlockScreen />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('plan-sport-peaking')).toBeOnTheScreen();
    expect(
      screen.getByText('Sport-specific peaking movements for Olympic weightlifting will be added over time.'),
    ).toBeOnTheScreen();
  });

  test('meet-day BlockScreen header floors at 0 weeks to competition', () => {
    const todayIso = localTodayIso();
    const compDate = addDaysIso(todayIso, 42);
    act(() => {
      useStore.getState().saveProfile({
        objective: 'strength',
        training_age: 'intermediate',
        weekly_frequency: 3,
        session_duration_cap_min: 90,
        equipment_inventory: ['barbell', 'squat_rack', 'bench', 'dumbbells'],
        base_rpe_cap: 9.0,
      });
      useStore.getState().saveSport({
        sportId: 'powerlifting',
        outcomeId: 'bigger_competition_lifts',
        experienceId: 'over_5_years',
        otherSportName: null,
        practiceSessionsPerWeek: 0,
        matchesPerWeek: 3,
        typicalSessionMinutes: null,
        competitionDate: compDate,
      });
      useStore.getState().generateNewBlock('LINEAR');
      mockDriverFor('athlete_kinetics.db').executeSync(
        'UPDATE training_block_meet_meta SET competition_date = ?',
        [todayIso],
      );
      useStore.getState().refreshBlock();
    });

    render(
      <NavigationProvider initialTab="plan">
        <BlockScreen />
      </NavigationProvider>,
    );
    expect(screen.getByTestId('plan-meet-countdown-header').props.children).toMatch(/· 0 weeks to competition$/);
  });

  test('applyPrescriptionToSlot set_modifier -2 drops backOff at 1 set and TodayScreen/BlockScreen never format + 0x', () => {
    const eased = applyPrescriptionToSlot(
      {
        sets: 3,
        reps: 5,
        targetRpe: 8.5,
        backOff: { sets: 2, reps: 5, targetRpe: 8.0, loadMultiplier: 0.925 },
      },
      { load_modifier: 0.9, set_modifier: -2, rpe_cap: 7.5 },
    );
    expect(eased.sets).toBe(1);
    expect(eased.backOff).toBeUndefined();

    const compDate = addDaysIso(localTodayIso(), 49);
    act(() => {
      useStore.getState().saveProfile({
        objective: 'strength',
        training_age: 'advanced',
        weekly_frequency: 3,
        session_duration_cap_min: 90,
        equipment_inventory: ['barbell', 'squat_rack', 'bench', 'dumbbells'],
        base_rpe_cap: 9.0,
      });
      useStore.getState().saveSport({
        sportId: 'powerlifting',
        outcomeId: 'bigger_competition_lifts',
        experienceId: 'over_5_years',
        otherSportName: null,
        practiceSessionsPerWeek: 0,
        matchesPerWeek: 3,
        typicalSessionMinutes: null,
        competitionDate: compDate,
      });
      useStore.getState().generateNewBlock('LINEAR');
    });

    const todayBefore = useStore.getState().todayPlan;
    expect(todayBefore).not.toBeNull();
    const backOffSlot = todayBefore.slots.find((s) => s.backOff !== undefined);
    expect(backOffSlot).toBeDefined();

    act(() => {
      useStore.setState({
        todayPlan: {
          ...todayBefore,
          slots: todayBefore.slots.map((s) => (
            s.slotId === backOffSlot.slotId
              ? { ...s, backOff: { ...s.backOff, sets: 0 } }
              : s
          )),
        },
        vector: {
          ...useStore.getState().vector,
          set_modifier: -2,
        },
      });
    });

    const rToday = render(<TodayScreen />);
    expect(screen.queryByText(/\+ 0×/)).toBeNull();
    expect(screen.queryByText(/\+ 0 x/)).toBeNull();
    rToday.unmount();

    render(
      <NavigationProvider initialTab="plan">
        <BlockScreen />
      </NavigationProvider>,
    );
    expect(screen.queryByText(/\+ 0 x/)).toBeNull();
    expect(screen.queryByText(/\+ 0×/)).toBeNull();
  });

  test('continueTrainingProgram keeps competitionDate as plannedEndDate and clearing competitionDate cleans meet metadata', () => {
    const meetDate = addDaysIso(localTodayIso(), 50);
    act(() => {
      useStore.getState().saveProfile({
        objective: 'strength',
        training_age: 'intermediate',
        weekly_frequency: 3,
        session_duration_cap_min: 90,
        equipment_inventory: ['barbell', 'squat_rack', 'bench', 'dumbbells'],
        base_rpe_cap: 9.0,
      });
      useStore.getState().saveSport({
        sportId: 'powerlifting',
        outcomeId: 'bigger_competition_lifts',
        experienceId: 'over_5_years',
        otherSportName: null,
        practiceSessionsPerWeek: 0,
        matchesPerWeek: 2,
        typicalSessionMinutes: null,
        competitionDate: meetDate,
      });
      useStore.getState().createTrainingProgram({
        dayIndices: [1, 3, 5],
        days: [
          { dayIndex: 1, focus: 'lower' },
          { dayIndex: 3, focus: 'upper' },
          { dayIndex: 5, focus: 'full' },
        ],
        horizon: { kind: 'date', requestedReviewDate: meetDate },
        schemaType: 'LINEAR',
        movementPreferences: [],
      });
    });

    expect(useStore.getState().program?.plannedBlockCount).toBeGreaterThanOrEqual(2);
    expect(useStore.getState().program?.plannedEndDate).toBe(meetDate);
    expect(useStore.getState().blockMeetMeta?.blockNumber).toBe(1);

    act(() => {
      mockDriverFor('athlete_kinetics.db').executeSync(
        "UPDATE training_block SET start_date = ? WHERE status = 'active'",
        [addDaysIso(localTodayIso(), -28)],
      );
      useStore.getState().refreshBlock();
      useStore.getState().continueTrainingProgram();
    });
    expect(useStore.getState().program?.currentSequenceIndex).toBe(2);
    expect(useStore.getState().program?.plannedEndDate).toBe(meetDate);
    expect(useStore.getState().blockMeetMeta?.blockNumber).toBe(2);

    act(() => {
      useStore.getState().saveSport({
        sportId: 'powerlifting',
        outcomeId: 'bigger_competition_lifts',
        experienceId: 'over_5_years',
        otherSportName: null,
        practiceSessionsPerWeek: 0,
        matchesPerWeek: 2,
        typicalSessionMinutes: null,
        competitionDate: null,
      });
    });
    expect(useStore.getState().sport?.competitionDate).toBeNull();
    expect(useStore.getState().blockMeetMeta).toBeNull();
    expect(useStore.getState().program?.horizonKind).toBe('weeks');
    expect(useStore.getState().program?.requestedReviewDate).toBeNull();
    const countdownRows = mockDriverFor('athlete_kinetics.db').executeSync(
      'SELECT COUNT(*) AS n FROM training_program_meet_countdown',
    ).rows;
    expect(countdownRows[0].n).toBe(0);
    const activeMeetMetaRows = mockDriverFor('athlete_kinetics.db').executeSync(
      "SELECT COUNT(*) AS n FROM training_block_meet_meta m JOIN training_block tb ON tb.block_id = m.block_id WHERE tb.status = 'active'",
    ).rows;
    expect(activeMeetMetaRows[0].n).toBe(0);
  });
});
