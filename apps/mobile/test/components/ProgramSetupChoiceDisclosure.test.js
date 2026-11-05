/**
 * Issue #222 (Android walks A and E): after choosing Undulating or
 * Autoregulated in Fine-tune, the box at the top of BUILD YOUR PROGRAM still
 * said "on a linear progression" and "a review after 12 weeks". The sentence
 * was fixed to the recommended defaults. It now describes the screen's
 * current choices.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import ProgramSetupScreen from '../../src/screens/ProgramSetupScreen';
import { recommendedProgramDefaults } from '../../src/state/programDefaults';

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

beforeEach(() => {
  mockState = {
    today: '2026-08-03', error: null, program: null, movements: [],
    profile: {
      objective: 'strength', training_age: 'advanced', weekly_frequency: 1,
      equipment_inventory: [], base_rpe_cap: 9, session_duration_cap_min: 60,
    },
    previewTrainingProgram: jest.fn(() => preview),
    createTrainingProgram: jest.fn(),
    updateProgramPreferences: jest.fn(),
    getMovementAvailabilityVerdicts: jest.fn(() => []),
  };
});

const openAdvanced = () =>
  fireEvent.press(screen.getByLabelText('Fine-tune your program (optional)'));
const topBox = () => {
  const card = within(screen.getByTestId('program-recommendation-card'));
  return card.getByTestId('program-choice-disclosure').props.children;
};

test('with nothing changed, the top box shows the recommended defaults', () => {
  render(<ProgramSetupScreen />);
  expect(topBox()).toBe(recommendedProgramDefaults(mockState.profile).disclosure);
  // Pinned to the approved default sentence, not only to the shared builder.
  expect(topBox()).toBe('Coach picks the movements, on a linear progression, with a review after 12 weeks (3 four-week blocks). Change any of it below.');
});

test.each([
  ['Undulating', 'undulating'],
  ['Autoregulated', 'autoregulated'],
])('after choosing %s, the top box names it and no longer says linear', (chip, word) => {
  render(<ProgramSetupScreen />);
  openAdvanced();
  fireEvent.press(screen.getByText(chip));
  expect(topBox()).toContain(word);
  expect(topBox()).not.toMatch(/linear/i);
});

test('after changing the review length to 8 weeks, the top box says 8 weeks', () => {
  render(<ProgramSetupScreen />);
  openAdvanced();
  fireEvent.press(screen.getByText('8 wk'));
  expect(topBox()).toContain('8 weeks');
  expect(topBox()).not.toContain('12 weeks');
});

test('after entering a date horizon, the top box uses the trimmed date', () => {
  render(<ProgramSetupScreen />);
  openAdvanced();
  fireEvent.press(screen.getByText('Date'));
  fireEvent.changeText(screen.getByPlaceholderText('YYYY-MM-DD'), ' 2026-12-01 ');
  expect(topBox()).toContain('with a review around 2026-12-01 (rounded up to whole four-week blocks)');
  expect(topBox()).not.toContain('around  2026-12-01  (');
});

test('choosing Customize says the athlete picks the movements', () => {
  render(<ProgramSetupScreen />);
  openAdvanced();
  fireEvent.press(screen.getByText('Customize'));
  expect(topBox()).toMatch(/^You pick the movements/);
});
