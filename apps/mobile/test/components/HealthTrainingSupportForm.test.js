import React from 'react';
import { TextInput } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import HealthTrainingSupportForm from '../../src/components/HealthTrainingSupportForm';

// R3 (post-PR #19): each actual set of radio options is its own labelled
// radiogroup. These assert the React Native accessibility contract; they do not
// exercise a real TalkBack or VoiceOver session.

let mockState;

jest.mock('../../src/state/useStore', () => ({
  useStore: (selector) => selector(mockState),
}));

const details = {
  athleteId: 'athlete-1',
  revision: 3,
  reviewState: 'not_assessed',
  preferences: [{ preferenceKind: 'position', reportedValue: 'seated', detailText: null }],
  notes: [],
  instructions: [],
};

// #174: every option reads in plain words; the stored keys are unchanged.
const GROUPS = [
  ['support-preference-position-options', 'Position preference',
    ['Not answered', 'No preference', 'Seated', 'Lying down', 'Standing', 'Other'].map((value) => `Position preference: ${value}`)],
  ['support-preference-position_transitions-options', 'Position changes',
    ['Not answered', 'I have a concern', 'No concern'].map((value) => `Position changes: ${value}`)],
  ['support-preference-rest-options', 'Rest needs',
    ['Not answered', 'I need support here', 'I do not need support here'].map((value) => `Rest needs: ${value}`)],
  ['support-note-kind-options', 'Note type',
    ['General', 'What I can do day to day', 'What brings on symptoms', 'Rest and recovery'].map((value) => `Note type: ${value}`)],
];

beforeEach(() => {
  mockState = {
    activeAthleteId: 'athlete-1',
    status: 'ready',
    healthSupportRevision: 3,
    movements: [],
    activityLedger: { definitions: [], series: [], occurrences: [] },
    getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }),
    getHealthSupportFacts: () => ({ reviewState: 'not_assessed' }),
    getHealthSupportDetails: jest.fn(() => details),
    setSupportReviewState: jest.fn(),
    saveSupportPreference: jest.fn(),
    saveSupportNote: jest.fn(),
    deleteSupportNote: jest.fn(),
    saveSupportInstruction: jest.fn(),
    confirmSupportInstruction: jest.fn(),
    deleteSupportInstruction: jest.fn(),
  };
});

const openSupport = () => {
  render(<HealthTrainingSupportForm />);
  fireEvent.press(screen.getByRole('button', { name: 'Show health and training support' }));
};

test('R3 each set of radio options is its own labelled radiogroup that contains only those radios', () => {
  openSupport();
  for (const [testID, groupLabel, radioLabels] of GROUPS) {
    const group = screen.getByTestId(testID);
    expect(group.props.accessibilityRole).toBe('radiogroup');
    expect(group.props.accessibilityLabel).toBe(groupLabel);
    expect(within(group).getAllByRole('radio').map((radio) => radio.props.accessibilityLabel)).toEqual(radioLabels);
    expect(within(group).queryAllByRole('button')).toHaveLength(0);
    expect(within(group).UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  }
  // No other element, in particular no section holding text fields or buttons, is a radiogroup.
  const radiogroups = screen.root.findAll((node) => typeof node.type === 'string' && node.props.accessibilityRole === 'radiogroup');
  expect(radiogroups.map((node) => node.props.testID)).toEqual(GROUPS.map(([testID]) => testID));
  // Every radio on the form sits inside one of those groups.
  expect(screen.getAllByRole('radio')).toHaveLength(GROUPS.reduce((sum, [, , labels]) => sum + labels.length, 0));
});

test('R3 grouping preserves each radio role, checked state and press behavior', () => {
  openSupport();
  const position = screen.getByTestId('support-preference-position-options');
  expect(within(position).getByRole('radio', { name: 'Position preference: Seated' }).props.accessibilityState).toMatchObject({ checked: true });
  expect(within(position).getByRole('radio', { name: 'Position preference: Standing' }).props.accessibilityState).toMatchObject({ checked: false });
  fireEvent.press(within(position).getByRole('radio', { name: 'Position preference: Standing' }));
  expect(mockState.saveSupportPreference).toHaveBeenCalledWith('athlete-1', 'position', 'standing', '', 3);

  const rest = screen.getByTestId('support-preference-rest-options');
  expect(within(rest).getByRole('radio', { name: 'Rest needs: Not answered' }).props.accessibilityState).toMatchObject({ checked: true });

  const notes = screen.getByTestId('support-note-kind-options');
  expect(within(notes).getByRole('radio', { name: 'Note type: General' }).props.accessibilityState).toMatchObject({ checked: true });
  fireEvent.press(within(notes).getByRole('radio', { name: 'Note type: Rest and recovery' }));
  const notesAfter = screen.getByTestId('support-note-kind-options');
  expect(within(notesAfter).getByRole('radio', { name: 'Note type: Rest and recovery' }).props.accessibilityState).toMatchObject({ checked: true });
  expect(within(notesAfter).getByRole('radio', { name: 'Note type: General' }).props.accessibilityState).toMatchObject({ checked: false });
});

// Android walk 2026-11-03, W4-3: the saved answer was drawn exactly like the
// other options; only the accessibility tree said which was checked.
test('the saved answer is drawn as chosen: a filled dot and the accent border', () => {
  const { StyleSheet } = require('react-native');
  const { theme } = require('../../src/theme/theme');
  openSupport();
  const chosen = screen.getByLabelText('Position preference: Seated');
  const other = screen.getByLabelText('Position preference: Standing');
  expect(within(chosen).getByText('●')).toBeOnTheScreen();
  expect(within(other).getByText('○')).toBeOnTheScreen();
  expect(StyleSheet.flatten(chosen.props.style).borderColor).toBe(theme.color.chalk);
  expect(StyleSheet.flatten(other.props.style).borderColor).toBe(theme.color.line);
  expect(screen.getByText('Seated')).toBeOnTheScreen();
  expect(screen.getByText('Position changes')).toBeOnTheScreen();
});

describe('#174: plain words, stored keys unchanged', () => {
  test('pressing a plain-worded option still saves the stored key', () => {
    openSupport();
    fireEvent.press(screen.getByRole('radio', { name: 'Position changes: I have a concern' }));
    expect(mockState.saveSupportPreference).toHaveBeenCalledWith('athlete-1', 'position_transitions', 'concern_reported', '', 3);
    fireEvent.press(screen.getByRole('radio', { name: 'Rest needs: I need support here' }));
    expect(mockState.saveSupportPreference).toHaveBeenCalledWith('athlete-1', 'rest', 'need_reported', '', 3);
    fireEvent.press(screen.getByRole('radio', { name: 'Position preference: No preference' }));
    expect(mockState.saveSupportPreference).toHaveBeenCalledWith('athlete-1', 'position', 'no_preference', '', 3);
  });

  test('each stored key renders its plain label, never the key', () => {
    openSupport();
    for (const text of ['Not answered', 'No preference', 'I have a concern', 'I need support here']) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    for (const key of ['Unanswered', 'Concern reported', 'Need reported', 'No need reported', 'Functional context']) {
      expect(screen.queryByText(key)).toBeNull();
    }
  });

  test('fields and the review state read in plain words', () => {
    openSupport();
    expect(screen.getByText('Review state: not yet reviewed. This is not medical clearance.')).toBeOnTheScreen();
    expect(screen.queryByText(/not assessed/)).toBeNull();
    expect(screen.getByLabelText('Position changes: details')).toBeOnTheScreen();
    expect(screen.getByLabelText('Rest needs: details')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save position changes details' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Date of the instruction (optional)')).toBeOnTheScreen();
    expect(screen.queryByText(/YYYY-MM-DD/)).toBeNull();
    expect(screen.queryByText(/transitions details/)).toBeNull();
  });

  test('"Saved as your note" is absent while no note exists', () => {
    openSupport();
    expect(screen.queryByText(/Saved as your note/)).toBeNull();
  });

  test('"Saved as your note" shows once a note exists, with its plain note type', () => {
    const withNote = { ...details, notes: [{ noteId: 'n1', noteKind: 'symptom_trigger', bodyText: 'Stairs after leg day' }] };
    mockState.getHealthSupportDetails = jest.fn(() => withNote);
    openSupport();
    expect(screen.getByText(/Saved as your note/)).toBeOnTheScreen();
    expect(screen.getByText('What brings on symptoms: Stairs after leg day')).toBeOnTheScreen();
  });
});
