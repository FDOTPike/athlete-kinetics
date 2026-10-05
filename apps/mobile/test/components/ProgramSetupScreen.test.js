/**
 * ProgramSetupScreen.test.js
 *
 * Astra UX Phase 1 W2 changed what this screen ASKS, not what it can do.
 *
 * Before: four programming decisions had to be made by hand before the form
 * would submit — who selects movements, review horizon, duration, progression
 * method — and R8 §2.3 required each unmet one to be explained beside the
 * disabled button, one at a time.
 *
 * After: each of those opens on a disclosed coach default, so the required
 * path is review-and-confirm. The R8 §2.3 contract is NOT dropped: the one
 * rule that can still block (choosing the Date horizon without typing a date)
 * is still explained in the same live region. The other four prompts are gone
 * because the rules they policed are gone, and the tests below pin that
 * distinction rather than just deleting the old assertions.
 *
 * Every control still exists and is still reachable — one disclosure away —
 * which is what the "without deleting capabilities" clause of §2 requires.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';
import { RECOMMENDED_BLOCK_COUNT, recommendedProgramDefaults } from '../../src/state/programDefaults';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  useStore: (selector) => selector(mockState),
}));

const preview = {
  objective: 'strength', startDate: '2026-08-03', requestedReviewDate: null,
  plannedEndDate: '2026-08-31', plannedBlockCount: 1, schemaType: 'LINEAR',
  days: [{ dayIndex: 1, focus: 'full' }],
  plan: {
    objective: 'strength', start_date: '2026-08-03', weeks: 4, schemaType: 'LINEAR',
    macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false, sessions: [],
    warnings: [], recovery: false, autopilotAdjusted: [],
  },
};

const stateFor = (trainingAge) => ({
  today: '2026-08-03', error: null, program: null, movements: [],
  profile: {
    objective: 'strength', training_age: trainingAge, weekly_frequency: 1,
    equipment_inventory: [], base_rpe_cap: 9, session_duration_cap_min: 60,
  },
  previewTrainingProgram: jest.fn(() => preview),
  createTrainingProgram: jest.fn(),
  updateProgramPreferences: jest.fn(),
  getMovementAvailabilityVerdicts: jest.fn(() => []),
});

/** The optional area is collapsed on a first run; open it to reach a control. */
const openAdvanced = () =>
  fireEvent.press(screen.getByLabelText('Fine-tune your program (optional)'));

// ---------------------------------------------------------------------------
// W2 — the required path is review-and-confirm
// ---------------------------------------------------------------------------

test('a first run can create the program without making any programming decision', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);

  // The button is live on arrival. This is the whole point: previously four
  // decisions stood between an onboarded athlete and a program.
  expect(screen.getByText('Create program')).not.toBeDisabled();
  expect(screen.queryByText('Choose who selects movements.')).toBeNull();
  expect(screen.queryByText('Choose a progression method.')).toBeNull();

  fireEvent.press(screen.getByText('Create program'));

  expect(mockState.createTrainingProgram).toHaveBeenCalledTimes(1);
  expect(mockState.createTrainingProgram.mock.calls[0][0]).toMatchObject({
    horizon: { kind: 'weeks', blockCount: RECOMMENDED_BLOCK_COUNT },
    schemaType: 'LINEAR',
    dayIndices: [1],
    movementPreferences: [],
  });
});

test('every default the athlete no longer chooses is disclosed on the screen', () => {
  // A default applied silently would be worse than a question asked loudly.
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);

  const { disclosure } = recommendedProgramDefaults(mockState.profile);
  expect(screen.getByTestId('program-recommendation-card')).toBeOnTheScreen();
  expect(screen.getByText(disclosure)).toBeOnTheScreen();
  expect(disclosure).toContain('linear progression');
  expect(disclosure).toContain(`${RECOMMENDED_BLOCK_COUNT * 4} weeks`);
});

test('the training week is reused from onboarding rather than asked for again', () => {
  mockState = stateFor('intermediate');
  mockState.profile.weekly_frequency = 3;
  render(<ProgramSetupScreen />);

  expect(screen.getByText(/Your 3-day week comes from the training days you already gave/))
    .toBeOnTheScreen();
  // The control still exists — it just is not a question any more.
  expect(screen.queryByText('3. Training days')).toBeNull();
  openAdvanced();
  expect(screen.getByText('3. Training days')).toBeOnTheScreen();
});

test('the athlete reviews a real generated week before committing to it', () => {
  mockState = stateFor('intermediate');
  mockState.movements = [{ movement_id: 5, name: 'Back Squat', pattern: 'squat' }];
  mockState.previewTrainingProgram = jest.fn(() => ({
    ...preview,
    plan: {
      ...preview.plan,
      sessions: [{
        week_index: 1, day_index: 1, focus: 'lower',
        slots: [{ slot_index: 1, movement_id: 5, sets: 3, reps: 5, target_rpe: 8 }],
      }],
    },
  }));
  render(<ProgramSetupScreen />);

  expect(screen.getByTestId('recommended-week-card')).toBeOnTheScreen();
  expect(screen.getByText('Back Squat — 3×5')).toBeOnTheScreen();
});

test('every programming control survives, one disclosure away', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);

  // Collapsed by default: none of the controls are on screen...
  expect(screen.queryByText('Coach build')).toBeNull();
  expect(screen.queryByText('Undulating')).toBeNull();

  openAdvanced();

  // ...and all four sections are intact when asked for.
  expect(screen.getByText('1. Who chooses movements?')).toBeOnTheScreen();
  expect(screen.getByText('2. Review horizon')).toBeOnTheScreen();
  expect(screen.getByText('3. Training days')).toBeOnTheScreen();
  expect(screen.getByText('4. Training method')).toBeOnTheScreen();
  expect(screen.getByText('Coach build')).toBeOnTheScreen();
  expect(screen.getByText('Customize')).toBeOnTheScreen();
  expect(screen.getByText('Undulating')).toBeOnTheScreen();
  expect(screen.getByText('Linear')).toBeOnTheScreen();
});

test('overriding a default in the optional area still reaches program creation', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);

  openAdvanced();
  fireEvent.press(screen.getByText('Undulating'));
  fireEvent.press(screen.getByText('8 wk'));
  fireEvent.press(screen.getByText('Create program'));

  expect(mockState.createTrainingProgram.mock.calls[0][0]).toMatchObject({
    horizon: { kind: 'weeks', blockCount: 2 },
    schemaType: 'WAVE',
  });
});

test('beginners get the same Linear recommendation, and the existing rationale is kept', () => {
  mockState = stateFor('beginner');
  render(<ProgramSetupScreen />);

  fireEvent.press(screen.getByText('Create program'));
  expect(mockState.createTrainingProgram.mock.calls[0][0]).toMatchObject({ schemaType: 'LINEAR' });

  openAdvanced();
  expect(screen.getByText(/Linear is recommended/)).toBeOnTheScreen();
});

// ---------------------------------------------------------------------------
// W2 — regressions the work order names explicitly
// ---------------------------------------------------------------------------

test('an existing program overrides the recommendation instead of being overwritten by it', () => {
  // §3.2: existing athletes migrate through this UI change without data loss.
  // The recommendation must never win over a program the athlete already has.
  mockState = stateFor('advanced');
  mockState.program = {
    programId: 1, objective: 'strength', startDate: '2026-06-01',
    horizonKind: 'weeks', requestedReviewDate: null, plannedEndDate: '2026-09-01',
    plannedBlockCount: 7, startingMacroBlockIndex: 1, schemaType: 'APRE',
    status: 'active', currentSequenceIndex: 1,
    days: [{ dayIndex: 2, focus: 'upper' }, { dayIndex: 5, focus: 'lower' }],
    movementPreferences: [],
  };
  render(<ProgramSetupScreen editing />);

  fireEvent.press(screen.getByText('Save future preferences'));

  expect(mockState.updateProgramPreferences).toHaveBeenCalledTimes(1);
  expect(mockState.updateProgramPreferences.mock.calls[0][0]).toMatchObject({
    horizon: { kind: 'weeks', blockCount: 7 },
    schemaType: 'APRE',
    dayIndices: [2, 5],
  });
  // Nothing was created; editing never creates.
  expect(mockState.createTrainingProgram).not.toHaveBeenCalled();
});

test('editing opens the controls, because fine-tuning IS the task there', () => {
  mockState = stateFor('advanced');
  mockState.program = {
    programId: 1, objective: 'strength', startDate: '2026-06-01',
    horizonKind: 'weeks', requestedReviewDate: null, plannedEndDate: '2026-09-01',
    plannedBlockCount: 2, startingMacroBlockIndex: 1, schemaType: 'LINEAR',
    status: 'active', currentSequenceIndex: 1,
    days: [{ dayIndex: 1, focus: 'full' }], movementPreferences: [],
  };
  render(<ProgramSetupScreen editing />);

  expect(screen.getByText('1. Who chooses movements?')).toBeOnTheScreen();
  // The first-run recommendation card is a first-run thing only.
  expect(screen.queryByTestId('program-recommendation-card')).toBeNull();
});

// ---------------------------------------------------------------------------
// The surviving R8 §2.3 rule
// ---------------------------------------------------------------------------

test('the one rule that can still block is still explained, and still live-announced', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);
  expect(screen.getByTestId('keyboard-aware-scroll-view')).toBeOnTheScreen();

  // Nothing is unmet on arrival.
  expect(screen.queryByText('Enter a review date.')).toBeNull();

  openAdvanced();
  fireEvent.press(screen.getByText('Date'));

  const guidance = screen.getByText('Enter a review date.');
  expect(guidance).toBeOnTheScreen();
  expect(guidance.props.accessibilityLiveRegion).toBe('polite');
  expect(screen.getByText('Create program')).toBeDisabled();

  fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), '2026-12-01');
  expect(screen.queryByText('Enter a review date.')).toBeNull();
  expect(screen.getByText('Create program')).not.toBeDisabled();
});

test('the four retired prompts are retired because their rules are, not because they were hidden', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);
  openAdvanced();

  // Each control is present and pressable — so the prompts cannot be missing
  // merely because the controls moved somewhere unreachable.
  for (const label of ['Coach build', 'Duration', '12 wk', 'Linear']) {
    expect(screen.getByText(label)).toBeOnTheScreen();
  }
  for (const retired of [
    'Choose who selects movements.',
    'Choose when you want to review the program.',
    'Choose a program duration.',
    'Choose a progression method.',
  ]) {
    expect(screen.queryByText(retired)).toBeNull();
  }
});

// ---------------------------------------------------------------------------
// Behaviour that predates W2 and must survive it
// ---------------------------------------------------------------------------

test('rehab profile renders the approved rehab explainer and footer', () => {
  mockState = stateFor('intermediate');
  mockState.profile.objective = 'rehab';
  mockState.profile.weekly_frequency = 5;
  render(<ProgramSetupScreen />);
  openAdvanced();

  expect(screen.getByText(
    'Every day is full-body and effort is capped at RPE 7. Rehab keeps volume low and frequency steady rather than loading any one pattern hard.',
  )).toBeOnTheScreen();
  expect(screen.getByText('You can change any day below.')).toBeOnTheScreen();
});

test('editing a day row changes the focus passed to block generation / program creation', () => {
  mockState = stateFor('intermediate');
  mockState.profile.objective = 'strength';
  mockState.profile.weekly_frequency = 2; // day 1 (Today) and day 4
  render(<ProgramSetupScreen />);
  openAdvanced();

  // Day 1 default for strength 2-day is 'lower'. Change it to 'conditioning'.
  const conditioningChips = screen.getAllByText('conditioning');
  fireEvent.press(conditioningChips[0]);

  fireEvent.press(screen.getByText('Create program'));

  expect(mockState.createTrainingProgram).toHaveBeenCalledTimes(1);
  const calledInput = mockState.createTrainingProgram.mock.calls[0][0];
  expect(calledInput.days).toBeDefined();
  expect(calledInput.days.find((d) => d.dayIndex === 1)?.focus).toBe('conditioning');
});

test('review-boundary disclosure states rounding, the 27-day bound, and that it is not a competition date', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);
  openAdvanced();

  fireEvent.press(screen.getByText('Date'));
  fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), '2026-12-01');

  // R3 REVIEW_BOUNDARY contract verbatim — every ratified element present.
  const disclosure = screen.getByText(
    /Blocks are whole 4-week units, so this rounds up to the next full block and can fall\s+up to 27 days after the date you chose\. It is a review checkpoint, not a competition\s+date — your training phases are not scheduled around it\./,
  );
  expect(disclosure).toBeOnTheScreen();
});

test('STEP remains retired from selection', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);
  openAdvanced();
  expect(screen.queryByText('Step loading')).toBeNull();
});

test('custom week-one rows use the middle dot between day number and focus', () => {
  mockState = stateFor('intermediate');
  mockState.profile.objective = 'strength';
  mockState.profile.weekly_frequency = 1;
  mockState.previewTrainingProgram = jest.fn(() => ({
    ...preview,
    plan: {
      ...preview.plan,
      sessions: [{ week_index: 1, day_index: 1, focus: 'lower', slots: [] }],
    },
  }));
  render(<ProgramSetupScreen />);
  openAdvanced();

  fireEvent.press(screen.getByText('Customize'));

  // The literal separator is U+00B7 MIDDLE DOT, never '?'.
  expect(screen.getAllByText(/Day \d+ · /).length).toBeGreaterThan(0);
  expect(screen.queryByText(/Day \d+ \? /)).toBeNull();
});
