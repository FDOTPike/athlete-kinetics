import React from 'react';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import ActivitiesScreen from '../../src/screens/ActivitiesScreen';
import { NavigationProvider } from '../../src/navigation/navigation';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  useStore: (selector) => selector(mockState),
}));

const emptyLedger = {
  definitions: [],
  series: [],
  occurrences: [],
  completedLast28Days: 0,
  knownMinutesLast28Days: 0,
  completedWithUnknownDuration: 0,
  scheduledKnownMinutesPerWeek: 0,
  scheduledWithUnknownDuration: 0,
};


// R2: capture the hardwareBackPress listener NavigationProvider registers, then
// press it the way Android does (newest listener first).
function captureHardwareBack() {
  const listeners = [];
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((eventName, listener) => {
    if (eventName === 'hardwareBackPress') listeners.push(listener);
    return { remove: () => { const index = listeners.indexOf(listener); if (index >= 0) listeners.splice(index, 1); } };
  });
  return {
    press: () => {
      let handled = false;
      act(() => {
        for (let index = listeners.length - 1; index >= 0 && !handled; index -= 1) handled = listeners[index]() === true;
      });
      return handled;
    },
    restore: () => spy.mockRestore(),
  };
}

describe('WO-05 factual activities screen', () => {
  beforeEach(() => {
    mockState = {
      today: '2026-09-13',
      activityLedger: emptyLedger,
      saveWeeklyActivity: jest.fn(() => 'series-1'),
      saveOneOffActivity: jest.fn(() => 'occurrence-1'),
      completeActivityOccurrence: jest.fn(),
      setActivityOccurrenceState: jest.fn(),
      endActivitySeries: jest.fn(),
    };
  });

  test('explains the non-prescriptive factual boundary and leaves unknowns visible', () => {
    render(<ActivitiesScreen onClose={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'YOUR ACTIVITIES' })).toBeOnTheScreen();
    expect(screen.getByText(/do not silently add, remove, or intensify/i)).toBeOnTheScreen();
    expect(screen.getByText(/does not turn them into a medical safety score/i)).toBeOnTheScreen();
    expect(screen.getByText('0 completed · 0 known minutes')).toBeOnTheScreen();
    expect(screen.getByText('No current weekly activities recorded.')).toBeOnTheScreen();
  });

  test('records a neutral custom completion with facility separate and effort unanswered', () => {
    render(<ActivitiesScreen onClose={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Add an existing or one-off activity' }));
    fireEvent.press(screen.getByRole('button', { name: 'Activity type: Another activity' }));
    fireEvent.changeText(screen.getByLabelText('Activity name shown in the app'), 'Hobby horsing');
    fireEvent.press(screen.getByRole('button', { name: 'One-off activity' }));
    fireEvent.changeText(screen.getByLabelText('Whole activity duration in minutes'), '35');
    fireEvent.press(screen.getByRole('button', { name: 'ACCESS AND BROAD DEMAND (OPTIONAL)' }));
    fireEvent.press(screen.getByRole('button', { name: 'Activity facility: pool' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save activity facts' }));

    expect(mockState.saveOneOffActivity).toHaveBeenCalledWith(expect.objectContaining({
      kindId: 'custom',
      displayName: 'Hobby horsing',
      facilityCode: 'pool',
      equipmentCode: null,
      state: 'completed',
      actualDurationMin: 35,
      actualEffort: null,
      expectedDurationMin: null,
      expectedEffort: null,
      modalityId: 'unknown',
      purposeId: 'unknown',
    }));
  });

  test('preserves a fixed Friday commitment with explicit local time and timezone', () => {
    render(<ActivitiesScreen onClose={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Add an existing or one-off activity' }));
    fireEvent.press(screen.getByRole('button', { name: 'Activity type: Basketball' }));
    fireEvent.press(screen.getByRole('button', { name: 'Friday' }));
    fireEvent.press(screen.getByRole('button', { name: 'Fixed commitment' }));
    fireEvent.changeText(screen.getByLabelText('Start time in 24-hour HH:MM'), '17:00');
    fireEvent.changeText(screen.getByLabelText('Whole activity duration in minutes'), '60');
    fireEvent.press(screen.getByRole('button', { name: 'Save activity facts' }));

    expect(mockState.saveWeeklyActivity).toHaveBeenCalledWith(expect.objectContaining({
      kindId: 'basketball',
      displayName: 'Basketball',
      localWeekday: 5,
      localStartMinute: 1020,
      timing: 'fixed',
      expectedDurationMin: 60,
      expectedEffort: null,
      effectiveStartDate: '2026-09-13',
    }));
    expect(mockState.saveWeeklyActivity.mock.calls[0][0].timezoneId).toEqual(expect.any(String));
  });

  test('reuses a saved definition only after the athlete explicitly selects it', () => {
    mockState.activityLedger = {
      ...emptyLedger,
      definitions: [{
        activityId: 'activity-swim', kindId: 'swimming', displayName: 'Pool swim', demand: 'moderate',
        facilities: ['pool'], equipment: [],
      }],
    };
    render(<ActivitiesScreen onClose={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Add an existing or one-off activity' }));
    fireEvent.press(screen.getByRole('button', { name: 'Use saved activity: Pool swim' }));
    fireEvent.press(screen.getByRole('button', { name: 'One-off activity' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save activity facts' }));
    expect(mockState.saveOneOffActivity).toHaveBeenCalledWith(expect.objectContaining({
      activityId: 'activity-swim', kindId: 'swimming', displayName: 'Pool swim', facilityCode: 'pool',
    }));
  });

  test('requires explicit actions to complete, miss, cancel, or end persisted facts', () => {
    mockState.activityLedger = {
      ...emptyLedger,
      definitions: [{
        activityId: 'activity-1', kindId: 'walking', displayName: 'Walk', demand: 'low',
        facilities: [], equipment: [],
      }],
      series: [{
        seriesId: 'series-1', activityId: 'activity-1', displayName: 'Walk', revision: 1,
        localWeekday: 5, localStartMinute: null, timezoneId: 'Australia/Sydney', timing: 'flexible',
        expectedDurationMin: 30, expectedEffort: null, effectiveStartDate: '2026-09-01', effectiveEndDate: null,
      }],
      occurrences: [{
        occurrenceId: 'occurrence-1', activityId: 'activity-1', displayName: 'Walk',
        localDate: '2026-09-13', localStartMinute: null, timezoneId: 'Australia/Sydney',
        state: 'planned', timing: 'flexible', modalityId: 'unknown', purposeId: 'recreation',
        expectedDurationMin: 30, expectedEffort: null, actualDurationMin: null, actualEffort: null,
      }],
      scheduledKnownMinutesPerWeek: 30,
    };
    render(<ActivitiesScreen onClose={jest.fn()} />);

    fireEvent.press(screen.getByRole('button', { name: 'Log actual completion for Walk' }));
    fireEvent.changeText(screen.getByLabelText('Actual activity duration in minutes'), '42');
    fireEvent.press(screen.getByRole('button', { name: 'SAVE ACTUAL ACTIVITY' }));
    expect(mockState.completeActivityOccurrence).toHaveBeenCalledWith({
      occurrenceId: 'occurrence-1', actualDurationMin: 42, actualEffort: null,
    });

    fireEvent.press(screen.getByRole('button', { name: 'Mark Walk missed' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mark Walk cancelled' }));
    fireEvent.press(screen.getByRole('button', { name: 'End weekly schedule for Walk' }));
    expect(mockState.setActivityOccurrenceState).toHaveBeenNthCalledWith(1, 'occurrence-1', 'missed');
    expect(mockState.setActivityOccurrenceState).toHaveBeenNthCalledWith(2, 'occurrence-1', 'cancelled');
    expect(mockState.endActivitySeries).toHaveBeenCalledWith('series-1');
  });

  test('R2 hardware Back closes the entry form without clearing its draft, and explicit Cancel still clears it', () => {
    const onClose = jest.fn();
    const hardwareBack = captureHardwareBack();
    try {
      render(<NavigationProvider initialTab="athlete"><ActivitiesScreen onClose={onClose} /></NavigationProvider>);
      fireEvent.press(screen.getByRole('button', { name: 'Add an existing or one-off activity' }));
      const defaultName = screen.getByLabelText('Activity name shown in the app').props.value;
      fireEvent.changeText(screen.getByLabelText('Activity name shown in the app'), 'Rock climbing');
      fireEvent.changeText(screen.getByLabelText('Whole activity duration in minutes'), '45');

      expect(hardwareBack.press()).toBe(true);
      expect(screen.queryByTestId('activity-entry-form')).toBeNull();
      expect(screen.getByTestId('activities-screen')).toBeOnTheScreen();
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.press(screen.getByRole('button', { name: 'Add an existing or one-off activity' }));
      expect(screen.getByLabelText('Activity name shown in the app').props.value).toBe('Rock climbing');
      expect(screen.getByLabelText('Whole activity duration in minutes').props.value).toBe('45');

      fireEvent.press(screen.getByRole('button', { name: 'CANCEL' }));
      expect(screen.queryByTestId('activity-entry-form')).toBeNull();
      fireEvent.press(screen.getByRole('button', { name: 'Add an existing or one-off activity' }));
      expect(screen.getByLabelText('Activity name shown in the app').props.value).toBe(defaultName);
      expect(screen.getByLabelText('Whole activity duration in minutes').props.value).toBe('');

      fireEvent.press(screen.getByRole('button', { name: 'CANCEL' }));
      expect(hardwareBack.press()).toBe(false);
      expect(onClose).not.toHaveBeenCalled();
      expect(mockState.saveWeeklyActivity).not.toHaveBeenCalled();
      expect(mockState.saveOneOffActivity).not.toHaveBeenCalled();
    } finally {
      hardwareBack.restore();
    }
  });

  test('R2 hardware Back closes an open completion view before the entry form and keeps its typed minutes for that entry', () => {
    mockState.activityLedger = { ...emptyLedger, occurrences: [{
        occurrenceId: 'occurrence-plan', activityId: 'activity-1', displayName: 'Walk',
        localDate: '2026-09-13', localStartMinute: null, timezoneId: 'Australia/Sydney',
        state: 'planned', timing: 'flexible', modalityId: 'unknown', purposeId: 'recreation',
        expectedDurationMin: 30, expectedEffort: null, actualDurationMin: null, actualEffort: null,
      }] };
    const hardwareBack = captureHardwareBack();
    try {
      render(<NavigationProvider initialTab="athlete"><ActivitiesScreen onClose={jest.fn()} /></NavigationProvider>);
      fireEvent.press(screen.getByRole('button', { name: 'Add an existing or one-off activity' }));
      fireEvent.press(screen.getByRole('button', { name: 'Log actual completion for Walk' }));
      fireEvent.changeText(screen.getByLabelText('Actual activity duration in minutes'), '25');

      expect(hardwareBack.press()).toBe(true);
      expect(screen.queryByTestId('activity-completion-form')).toBeNull();
      expect(screen.getByTestId('activity-entry-form')).toBeOnTheScreen();

      fireEvent.press(screen.getByRole('button', { name: 'Log actual completion for Walk' }));
      expect(screen.getByLabelText('Actual activity duration in minutes').props.value).toBe('25');
      fireEvent.press(within(screen.getByTestId('activity-completion-form')).getByRole('button', { name: 'CANCEL' }));
      fireEvent.press(screen.getByRole('button', { name: 'Log actual completion for Walk' }));
      expect(screen.getByLabelText('Actual activity duration in minutes').props.value).toBe('');

      expect(hardwareBack.press()).toBe(true);
      expect(screen.queryByTestId('activity-completion-form')).toBeNull();
      expect(hardwareBack.press()).toBe(true);
      expect(screen.queryByTestId('activity-entry-form')).toBeNull();
      expect(screen.getByTestId('activities-screen')).toBeOnTheScreen();
      expect(hardwareBack.press()).toBe(false);
      expect(mockState.completeActivityOccurrence).not.toHaveBeenCalled();
    } finally {
      hardwareBack.restore();
    }
  });

  test('logging a planned activity never pre-fills its planned minutes as the actual measurement', () => {
    mockState.activityLedger = {
      ...emptyLedger,
      occurrences: [{
        occurrenceId: 'occurrence-plan', activityId: 'activity-1', displayName: 'Walk',
        localDate: '2026-09-13', localStartMinute: null, timezoneId: 'Australia/Sydney',
        state: 'planned', timing: 'flexible', modalityId: 'unknown', purposeId: 'recreation',
        expectedDurationMin: 30, expectedEffort: null, actualDurationMin: null, actualEffort: null,
      }],
    };
    render(<ActivitiesScreen onClose={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Log actual completion for Walk' }));

    const actualMinutes = screen.getByLabelText('Actual activity duration in minutes');
    expect(actualMinutes.props.value).toBe('');
    expect(actualMinutes.props.placeholder).toMatch(/Planned 30 min/);
    fireEvent.press(screen.getByRole('button', { name: 'SAVE ACTUAL ACTIVITY' }));
    expect(mockState.completeActivityOccurrence).toHaveBeenCalledWith({
      occurrenceId: 'occurrence-plan', actualDurationMin: null, actualEffort: null,
    });
  });

  test('planned-activity actions and empty choices announce which activity and field they change', () => {
    mockState.activityLedger = {
      ...emptyLedger,
      occurrences: ['Walk', 'Swim'].map((name) => ({
        occurrenceId: `occurrence-${name}`, activityId: `activity-${name}`, displayName: name,
        localDate: '2026-09-13', localStartMinute: null, timezoneId: 'Australia/Sydney',
        state: 'planned', timing: 'flexible', modalityId: 'unknown', purposeId: 'recreation',
        expectedDurationMin: null, expectedEffort: null, actualDurationMin: null, actualEffort: null,
      })),
    };
    render(<ActivitiesScreen onClose={jest.fn()} />);

    // With two planned cards, a screen-reader user navigating by control must
    // know which activity each factual state change will be written to.
    fireEvent.press(screen.getByRole('button', { name: 'Mark Swim missed' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mark Walk cancelled' }));
    expect(mockState.setActivityOccurrenceState).toHaveBeenNthCalledWith(1, 'occurrence-Swim', 'missed');
    expect(mockState.setActivityOccurrenceState).toHaveBeenNthCalledWith(2, 'occurrence-Walk', 'cancelled');

    fireEvent.press(screen.getByRole('button', { name: 'Add an existing or one-off activity' }));
    fireEvent.press(screen.getByRole('button', { name: 'ACCESS AND BROAD DEMAND (OPTIONAL)' }));
    expect(screen.getByRole('button', { name: 'No facility recorded' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'No activity equipment recorded' })).toBeOnTheScreen();
  });

  test('switching activity type keeps a name the athlete typed and only replaces generated names', () => {
    render(<ActivitiesScreen onClose={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Add an existing or one-off activity' }));
    const nameField = () => screen.getByLabelText('Activity name shown in the app');

    fireEvent.press(screen.getByRole('button', { name: 'Activity type: Basketball' }));
    expect(nameField().props.value).toBe('Basketball');

    fireEvent.changeText(nameField(), 'Friday social hoops');
    fireEvent.press(screen.getByRole('button', { name: 'Activity type: Netball' }));
    expect(nameField().props.value).toBe('Friday social hoops');

    fireEvent.press(screen.getByRole('button', { name: 'Activity type: Another activity' }));
    fireEvent.changeText(nameField(), 'Hobby horsing');
    fireEvent.press(screen.getByRole('button', { name: 'Activity type: Rugby' }));
    expect(nameField().props.value).toBe('Hobby horsing');
  });
});
