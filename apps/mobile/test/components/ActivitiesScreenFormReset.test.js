import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ActivitiesScreen from '../../src/screens/ActivitiesScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  useStore: (selector) => selector(mockState),
}));

beforeEach(() => {
  mockState = {
    today: '2026-07-15',
    activityLedger: {
      definitions: [
        {
          activityId: 'activity-swim',
          kindId: 'swimming',
          displayName: 'Pool swim',
          demand: 'aerobic',
          facilities: ['pool'],
          equipment: [],
          archivedAtMs: null,
        },
      ],
      series: [
        {
          seriesId: 'series-swim',
          activityId: 'activity-swim',
          kindId: 'swimming',
          displayName: 'Pool swim',
          demand: 'aerobic',
          localWeekday: 2,
          localStartMinute: 390,
          timezoneId: 'Australia/Sydney',
          timing: 'fixed',
          expectedDurationMin: 60,
          expectedEffort: 6,
          effectiveStartDate: '2026-07-01',
          effectiveEndDate: null,
        },
      ],
      occurrences: [],
      completedLast28Days: 0,
      knownMinutesLast28Days: 0,
      completedWithUnknownDuration: 0,
      scheduledKnownMinutesPerWeek: 60,
      scheduledWithUnknownDuration: 0,
    },
    saveWeeklyActivity: jest.fn(() => 'series-swim'),
    saveOneOffActivity: jest.fn(() => 'occ-1'),
    completeActivityOccurrence: jest.fn(),
    setActivityOccurrenceState: jest.fn(),
    endActivitySeries: jest.fn(),
  };
});

test('plan-7: cancelling the activity form after selecting ONE-OFF resets entryMode back to EVERY WEEK on reopen', () => {
  render(<ActivitiesScreen />);

  fireEvent.press(screen.getByRole('button', { name: 'Add an existing or one-off activity' }));
  fireEvent.press(screen.getByRole('button', { name: 'One-off activity' }));
  expect(screen.getByRole('button', { name: 'One-off activity' }).props.accessibilityState.selected).toBe(true);

  // Cancel discards the draft and resets the form
  fireEvent.press(screen.getByRole('button', { name: 'CANCEL' }));

  // Reopening ADD AN ACTIVITY should start in the default EVERY WEEK mode
  fireEvent.press(screen.getByRole('button', { name: 'Add an existing or one-off activity' }));
  expect(screen.getByRole('button', { name: 'Repeat every week' }).props.accessibilityState.selected).toBe(true);
});
