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

const GROUPS = [
  ['support-preference-position-options', 'Position preference',
    ['unanswered', 'no preference', 'seated', 'recumbent', 'standing', 'other'].map((value) => `position: ${value}`)],
  ['support-preference-position_transitions-options', 'Position changes',
    ['unanswered', 'concern reported', 'no concern reported'].map((value) => `position transitions: ${value}`)],
  ['support-preference-rest-options', 'Rest needs',
    ['unanswered', 'need reported', 'no need reported'].map((value) => `rest: ${value}`)],
  ['support-note-kind-options', 'Note type',
    ['general', 'functional context', 'symptom trigger', 'rest context'].map((value) => `Note type: ${value}`)],
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
  expect(within(position).getByRole('radio', { name: 'position: seated' }).props.accessibilityState).toMatchObject({ checked: true });
  expect(within(position).getByRole('radio', { name: 'position: standing' }).props.accessibilityState).toMatchObject({ checked: false });
  fireEvent.press(within(position).getByRole('radio', { name: 'position: standing' }));
  expect(mockState.saveSupportPreference).toHaveBeenCalledWith('athlete-1', 'position', 'standing', '', 3);

  const rest = screen.getByTestId('support-preference-rest-options');
  expect(within(rest).getByRole('radio', { name: 'rest: unanswered' }).props.accessibilityState).toMatchObject({ checked: true });

  const notes = screen.getByTestId('support-note-kind-options');
  expect(within(notes).getByRole('radio', { name: 'Note type: general' }).props.accessibilityState).toMatchObject({ checked: true });
  fireEvent.press(within(notes).getByRole('radio', { name: 'Note type: rest context' }));
  const notesAfter = screen.getByTestId('support-note-kind-options');
  expect(within(notesAfter).getByRole('radio', { name: 'Note type: rest context' }).props.accessibilityState).toMatchObject({ checked: true });
  expect(within(notesAfter).getByRole('radio', { name: 'Note type: general' }).props.accessibilityState).toMatchObject({ checked: false });
});
