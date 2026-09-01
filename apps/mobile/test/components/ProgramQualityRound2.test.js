/**
 * Round 2 (PROMPT_LEDGER Entry 0060) — RED proofs for the onboarding and
 * program-setup remediations. Added BEFORE the product changes; every test
 * here fails against the frozen candidate and must pass after the fix.
 *
 *   [R5] the limitations screen cannot be left until the athlete explicitly
 *        chooses Yes or No (NEXT disabled + explained; draft/back and atomic
 *        Finish preserved);
 *   [R6] progression_methodology is disclosed in the review screen's coach
 *        defaults alongside every other removed advanced default;
 *   [R1-UI] the power objective renders a power-specific athlete explanation
 *        that is NOT a relabeled bodybuilding/strength template and never
 *        promises tier-unlocked lifts;
 *   [R4-UI] the strength capacity warning is driven by the pure shaped-slot
 *        calculation (imported from @ak/inference), not a days<3 mirror.
 *   [R3-UI] the preview renders the weekly progression summary for
 *        representative slots.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import OnboardingScreen from '../../src/screens/OnboardingScreen';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';
// Real production resolvers imported directly (never mirrored in the test).
import {
  strengthAnchorCapacity,
  programFocuses,
  defaultProgramDayIndices,
} from '@ak/inference';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  useStore: (selector) => selector(mockState),
}));

const previewFixture = (over = {}) => ({
  objective: 'strength', startDate: '2026-08-03', requestedReviewDate: null,
  plannedEndDate: '2026-08-31', plannedBlockCount: 1, schemaType: 'LINEAR',
  days: [{ dayIndex: 1, focus: 'lower' }],
  plan: {
    objective: 'strength', start_date: '2026-08-03', weeks: 4, schemaType: 'LINEAR',
    macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false, sessions: [],
    warnings: [], recovery: false, autopilotAdjusted: [],
  },
  ...over,
});

// ---------------------------------------------------------------------------
// [R5] limitations gate
// ---------------------------------------------------------------------------
describe('Round 2 R5: the limitations screen blocks NEXT until an explicit answer', () => {
  beforeEach(() => {
    mockState = {
      today: '2026-09-01', error: null, program: null, movements: [],
      athletes: [], activeAthleteId: null,
      profile: {
        objective: 'gpp', training_age: 'intermediate', weekly_frequency: 4,
        equipment_inventory: [], base_rpe_cap: 9, session_duration_cap_min: 60,
        max_sessions_per_day: 1, target_energy_system: 'hybrid',
        progression_methodology: 'autoregulated', injury_flags: [], mobility_limits: [],
      },
      completeOnboarding: jest.fn(),
      loadDemoAthlete: jest.fn(() => 'loaded'),
      previewTrainingProgram: jest.fn(() => previewFixture()),
      createTrainingProgram: jest.fn(),
      updateProgramPreferences: jest.fn(),
      getMovementAvailabilityVerdicts: jest.fn(() => []),
      activePriorExperienceMovementIds: [],
      confirmMovementPriorExperience: jest.fn(),
    };
  });

  const toLimits = () => {
    render(<OnboardingScreen />);
    for (let i = 0; i < 5; i += 1) fireEvent.press(screen.getByLabelText('Next'));
  };

  test('NEXT is disabled with an explanation until the athlete answers no/yes', () => {
    toLimits();
    expect(screen.getByText('ANYTHING I SHOULD TRAIN AROUND?')).toBeOnTheScreen();
    expect(screen.getByLabelText('Next')).toBeDisabled();
    // The rule is never invisible: the screen says why NEXT is off.
    expect(screen.getByText(/Choose YES or NO to continue/)).toBeOnTheScreen();

    // Answering No enables NEXT without any note field.
    fireEvent.press(screen.getByLabelText('No, nothing to note'));
    expect(screen.getByLabelText('Next')).not.toBeDisabled();

    // Moving on and coming BACK preserves the explicit answer (draft/back law).
    fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('READY.')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByLabelText('No, nothing to note').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Next')).not.toBeDisabled();
  });

  test('answering Yes reveals the note fields and enables NEXT; Finish stays one atomic call', () => {
    mockState.completeOnboarding = jest.fn();
    toLimits();
    expect(screen.getByLabelText('Next')).toBeDisabled();
    fireEvent.press(screen.getByLabelText('Yes, let me add notes'));
    expect(screen.getByLabelText('Past injuries, one per line as region colon note')).toBeOnTheScreen();
    expect(screen.getByLabelText('Next')).not.toBeDisabled();
    fireEvent.changeText(screen.getByLabelText('Past injuries, one per line as region colon note'), 'knee: old ACL');
    fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('READY.')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('START TRAINING'));
    expect(mockState.completeOnboarding).toHaveBeenCalledTimes(1);
  });

  test('an athlete who never reached the screen is unaffected: earlier steps keep NEXT enabled', () => {
    render(<OnboardingScreen />);
    // welcome/goal/experience/logistics/equipment all behave as before.
    fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('WHAT ARE WE TRAINING FOR?')).toBeOnTheScreen();
    expect(screen.getByLabelText('Next')).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// [R6] progression methodology disclosure
// ---------------------------------------------------------------------------
describe('Round 2 R6: the review screen discloses progression methodology', () => {
  beforeEach(() => {
    mockState = {
      today: '2026-09-01', error: null, program: null, movements: [],
      athletes: [], activeAthleteId: null,
      profile: {
        objective: 'gpp', training_age: 'intermediate', weekly_frequency: 4,
        equipment_inventory: [], base_rpe_cap: 9, session_duration_cap_min: 60,
        max_sessions_per_day: 1, target_energy_system: 'hybrid',
        progression_methodology: 'autoregulated', injury_flags: [], mobility_limits: [],
      },
      completeOnboarding: jest.fn(),
      loadDemoAthlete: jest.fn(() => 'loaded'),
    };
  });

  test('the coach-defaults block names the progression methodology', () => {
    render(<OnboardingScreen />);
    for (let i = 0; i < 5; i += 1) fireEvent.press(screen.getByLabelText('Next'));
    fireEvent.press(screen.getByLabelText('No, nothing to note'));
    fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('READY.')).toBeOnTheScreen();
    // Every text inside the coach-defaults block, joined (RNTL nests Text).
    const joinTexts = (node) => {
      if (node === null || node === undefined) return '';
      if (typeof node === 'string' || typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map(joinTexts).join('');
      if (node.props) return joinTexts(node.props.children);
      return '';
    };
    const block = screen.getByTestId('onboarding-coach-defaults');
    expect(joinTexts(block)).toContain('Progression method: Autoregulated');
  });
});

// ---------------------------------------------------------------------------
// [R1-UI] power-specific explanation + [R4-UI] capacity + [R3-UI] summary
// ---------------------------------------------------------------------------
describe('Round 2: ProgramSetupScreen power explanation, capacity law, progression summary', () => {
  beforeEach(() => {
    mockState = {
      today: '2026-09-01', error: null, program: null, movements: [],
      profile: {
        objective: 'power', training_age: 'intermediate', weekly_frequency: 4,
        equipment_inventory: [], base_rpe_cap: 9, session_duration_cap_min: 60,
        max_sessions_per_day: 1, target_energy_system: 'hybrid',
        progression_methodology: 'autoregulated', injury_flags: [], mobility_limits: [],
      },
      previewTrainingProgram: jest.fn(() => previewFixture()),
      createTrainingProgram: jest.fn(),
      updateProgramPreferences: jest.fn(),
      getMovementAvailabilityVerdicts: jest.fn(() => []),
      activePriorExperienceMovementIds: [],
      confirmMovementPriorExperience: jest.fn(),
    };
  });

  test('power renders a power-specific explanation that names explosive work and the tier law', () => {
    render(<ProgramSetupScreen />);
    expect(screen.getByText('Athletic power')).toBeOnTheScreen();
    expect(screen.getByTestId('power-explanation-card')).toBeOnTheScreen();
    // The card renders the PURE production explanation, not screen-local copy.
    expect(screen.getByText(/explosive force/i)).toBeOnTheScreen();
    // The tier law is disclosed: competition olympic lifts are Advanced-tier.
    expect(screen.getByText(/Advanced-tier/i)).toBeOnTheScreen();
  });

  test('a strength objective does NOT render the power explanation', () => {
    mockState.profile.objective = 'strength';
    render(<ProgramSetupScreen />);
    expect(screen.queryByText('Athletic power')).toBeNull();
  });

  test('the capacity warning follows the DRAFT schedule and counts distinct anchor roles (audit round 4)', () => {
    mockState.profile.objective = 'strength';
    // The auditor's scenario: a four-day profile drafted down to fewer
    // sessions. Default draft is [1 lower, 4 lower, 6 upper] (3 roles, no
    // warning). Drop Tomorrow and Day 6 -> draft [1 lower, 4 lower]: the
    // distinct roles are squat+hinge only (2 < 3), so the warning MUST
    // appear — even though the persisted 4-day profile claims 3 roles.
    render(<ProgramSetupScreen />);
    fireEvent.press(screen.getByText('Coach build'));
    fireEvent.press(screen.getByText('Duration'));
    fireEvent.press(screen.getByText('4 wk'));
    fireEvent.press(screen.getAllByText('Tomorrow')[0]);
    fireEvent.press(screen.getAllByText('Day 6')[0]);
    const shaped = strengthAnchorCapacity(
      mockState.profile, programFocuses, defaultProgramDayIndices,
      [{ dayIndex: 1, focus: 'lower' }, { dayIndex: 4, focus: 'lower' }],
    );
    expect(shaped).toBe(2); // two lower days repeat squat+hinge; push_h absent
    expect(screen.getByTestId('strength-capacity-warning')).toBeOnTheScreen();
    // Round 5: the copy speaks in ROLES, not slot counts — it names the
    // covered roles and the missing one with the focus change that fixes it.
    expect(screen.getByText(/The big three need three lift roles/)).toBeOnTheScreen();
    expect(screen.getByText(/covers 2 of those roles/)).toBeOnTheScreen();
    expect(screen.getByText(/squat, hinge \(deadlift\)/)).toBeOnTheScreen();
    expect(screen.getByText(/Easiest fix: change one day's focus above to upper \(or full\)/)).toBeOnTheScreen();
    expect(screen.getByText(/keep a reduced-anchor plan/)).toBeOnTheScreen();

    // The persisted-profile claim would be 3 — the warning is driven by the
    // DRAFT, not the profile (the defect the auditor demonstrated).
    expect(strengthAnchorCapacity(mockState.profile, programFocuses, defaultProgramDayIndices)).toBe(3);

    // Switching day 4 to 'upper' adds the push_h role: the draft now covers
    // all three roles and the warning disappears.
    fireEvent.press(screen.getAllByText('upper')[1]); // day-4 row's upper chip
    expect(screen.queryByTestId('strength-capacity-warning')).toBeNull();
  });

  test('the preview renders the weekly progression summary for representative slots', () => {
    mockState.previewTrainingProgram = jest.fn(() => previewFixture({
      plan: {
        ...previewFixture().plan,
        sessions: [
          { week_index: 1, day_index: 1, focus: 'lower', slots: [{ slot_index: 1, movement_id: 1, sets: 4, reps: 8, target_rpe: 7 }] },
          { week_index: 2, day_index: 1, focus: 'lower', slots: [{ slot_index: 1, movement_id: 1, sets: 4, reps: 8, target_rpe: 7.5 }] },
          { week_index: 3, day_index: 1, focus: 'lower', slots: [{ slot_index: 1, movement_id: 1, sets: 4, reps: 8, target_rpe: 8 }] },
          { week_index: 4, day_index: 1, focus: 'lower', slots: [{ slot_index: 1, movement_id: 1, sets: 2, reps: 8, target_rpe: 6.5 }] },
        ],
      },
    }));
    mockState.movements = [{ movement_id: 1, name: 'Competition Squat', pattern: 'squat', movement_id_is_bodyweight: undefined }];
    render(<ProgramSetupScreen />);
    fireEvent.press(screen.getByText('Coach build'));
    fireEvent.press(screen.getByText('Duration'));
    fireEvent.press(screen.getByText('4 wk'));
    fireEvent.press(screen.getByText('Linear'));
    expect(screen.getByTestId('weekly-progression-summary')).toBeOnTheScreen();
    expect(screen.getByText(/same work at a higher target effort/)).toBeOnTheScreen();
    expect(screen.getByText(/deload/)).toBeOnTheScreen();
  });
});
