import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';

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

test('beginner sees an editable Linear recommendation and must choose a horizon', () => {
  mockState = stateFor('beginner');
  render(<ProgramSetupScreen />);

  expect(screen.getByText(/Linear is recommended/)).toBeOnTheScreen();
  expect(screen.getByText('Linear')).toBeOnTheScreen();
  expect(screen.getByText('Create program')).toBeDisabled();

  fireEvent.press(screen.getByText('Coach build'));
  fireEvent.press(screen.getByText('Duration'));
  fireEvent.press(screen.getByText('4 wk'));
  fireEvent.press(screen.getByText('Create program'));

  expect(mockState.createTrainingProgram).toHaveBeenCalledTimes(1);
  expect(mockState.createTrainingProgram.mock.calls[0][0]).toMatchObject({
    horizon: { kind: 'weeks', blockCount: 1 }, schemaType: 'LINEAR', dayIndices: [1],
  });
});

test('intermediate athlete cannot continue until a method is chosen', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);

  fireEvent.press(screen.getByText('Coach build'));
  fireEvent.press(screen.getByText('Duration'));
  fireEvent.press(screen.getByText('4 wk'));
  expect(screen.getByText('Create program')).toBeDisabled();

  // STEP is retired from selection (product simplification).
  expect(screen.queryByText('Step loading')).toBeNull();

  fireEvent.press(screen.getByText('Undulating'));
  expect(screen.getByText('Create program')).not.toBeDisabled();
});

test('rehab profile renders the approved rehab explainer and footer', () => {
  mockState = stateFor('intermediate');
  mockState.profile.objective = 'rehab';
  mockState.profile.weekly_frequency = 5;
  render(<ProgramSetupScreen />);

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

  fireEvent.press(screen.getByText('Coach build'));
  fireEvent.press(screen.getByText('Duration'));
  fireEvent.press(screen.getByText('4 wk'));
  fireEvent.press(screen.getByText('Linear'));

  // Day 1 default for strength 2-day is 'lower'. Change it to 'conditioning'.
  // Find conditioning chip for day 1
  const conditioningChips = screen.getAllByText('conditioning');
  fireEvent.press(conditioningChips[0]);

  fireEvent.press(screen.getByText('Create program'));

  expect(mockState.createTrainingProgram).toHaveBeenCalledTimes(1);
  const calledInput = mockState.createTrainingProgram.mock.calls[0][0];
  expect(calledInput.days).toBeDefined();
  expect(calledInput.days.find((d) => d.dayIndex === 1)?.focus).toBe('conditioning');
});

// ---------------------------------------------------------------------------
// R8 §2.3 — disabled-state guidance, in the order the form asks for them.
// The screen renders ONLY the first unmet requirement, directly explaining
// why Create program is disabled (never an invisible rule).
// ---------------------------------------------------------------------------

const GUIDANCE_ORDER = [
  'Choose who selects movements.',
  'Choose when you want to review the program.',
  'Choose a program duration.',
  'Enter a review date.',
  'Choose a progression method.',
];

const escapeForRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const GUIDANCE_RE = new RegExp(`^(${GUIDANCE_ORDER.map(escapeForRegExp).join('|')})$`);

const guidanceText = () => {
  const captions = screen.getAllByText(GUIDANCE_RE);
  expect(captions).toHaveLength(1); // exactly ONE unmet requirement shown at a time
  return captions[0].props.children;
};

test('guidance walks all five unmet requirements in form order, one at a time', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);

  // 1. nothing chosen yet
  expect(guidanceText()).toBe(GUIDANCE_ORDER[0]);
  // The live region must announce changes politely, and the button is off.
  expect(screen.getByText(GUIDANCE_ORDER[0]).props.accessibilityLiveRegion).toBe('polite');
  expect(screen.getByText('Create program')).toBeDisabled();

  fireEvent.press(screen.getByText('Coach build'));
  expect(guidanceText()).toBe(GUIDANCE_ORDER[1]);

  fireEvent.press(screen.getByText('Duration'));
  expect(guidanceText()).toBe(GUIDANCE_ORDER[2]);

  fireEvent.press(screen.getByText('4 wk'));
  expect(guidanceText()).toBe(GUIDANCE_ORDER[4]); // beginner-independent: intermediate has no preset method

  fireEvent.press(screen.getByText('Undulating'));
  // Everything satisfied: no guidance remains and creation is available.
  expect(screen.queryByText(GUIDANCE_RE)).toBeNull();
  expect(screen.getByText('Create program')).not.toBeDisabled();
});

test('date horizon swaps the duration prompt for the review-date prompt', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);

  fireEvent.press(screen.getByText('Coach build'));
  fireEvent.press(screen.getByText('Date'));
  expect(guidanceText()).toBe(GUIDANCE_ORDER[3]);

  fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), '2026-12-01');
  expect(guidanceText()).toBe(GUIDANCE_ORDER[4]);
});

test('review-boundary disclosure states rounding, the 27-day bound, and that it is not a competition date', () => {
  mockState = stateFor('intermediate');
  render(<ProgramSetupScreen />);

  fireEvent.press(screen.getByText('Coach build'));
  fireEvent.press(screen.getByText('Date'));
  fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), '2026-12-01');
  // The disclosure renders under the normalized-boundary notice, which needs
  // a successful preview — i.e. a COMPLETE input (method included).
  fireEvent.press(screen.getByText('Undulating'));

  // R3 REVIEW_BOUNDARY contract verbatim — every ratified element present.
  const disclosure = screen.getByText(
    /Blocks are whole 4-week units, so this rounds up to the next full block and can fall\s+up to 27 days after the date you chose\. It is a review checkpoint, not a competition\s+date — your training phases are not scheduled around it\./,
  );
  expect(disclosure).toBeOnTheScreen();
});

test('custom week-one rows use the middle dot between day number and focus', () => {
  mockState = stateFor('intermediate');
  mockState.profile.objective = 'strength';
  mockState.profile.weekly_frequency = 1;
  // The shared preview fixture carries an empty session list; give THIS test
  // one generated week-one session so section 5 renders its day rows.
  const base = stateFor('intermediate');
  mockState.previewTrainingProgram = jest.fn(() => ({
    ...base.previewTrainingProgram(),
    plan: {
      ...preview.plan,
      sessions: [{
        week_index: 1,
        day_index: 1,
        focus: 'lower',
        slots: [],
      }],
    },
  }));
  render(<ProgramSetupScreen />);

  fireEvent.press(screen.getByText('Customize'));
  // Week-one rows (and their Day N · focus headings) render only when the
  // preview exists, so complete the form first.
  fireEvent.press(screen.getByText('Duration'));
  fireEvent.press(screen.getByText('4 wk'));
  fireEvent.press(screen.getByText('Undulating'));

  // The literal separator is U+00B7 MIDDLE DOT, never '?'.
  expect(screen.getByText(/Day \d+ · /)).toBeOnTheScreen();
  expect(screen.queryByText(/Day \d+ \? /)).toBeNull();
});
