import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ProfileScreen from '../../src/screens/ProfileScreen';
import OnboardingScreen from '../../src/screens/OnboardingScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector(mockState),
}));

const baseProfile = {
  objective: 'hybrid',
  training_age: 'intermediate',
  weekly_frequency: 4,
  max_sessions_per_day: 1,
  session_duration_cap_min: 60,
  base_rpe_cap: 8.5,
  target_energy_system: 'hybrid',
  progression_methodology: 'autoregulated',
  injury_flags: [],
  mobility_limits: [],
  equipment_inventory: ['barbell', 'dumbbells', 'bench'],
};

describe('ProfileScreens & Onboarding (WO-UI-5b Remediation)', () => {
  let deleteAthleteMock;
  let wipeBlockStateMock;
  let switchProfileMock;

  beforeEach(() => {
    deleteAthleteMock = jest.fn();
    wipeBlockStateMock = jest.fn();
    switchProfileMock = jest.fn();

    mockState = {
      profile: baseProfile,
      saveProfile: jest.fn(),
      uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
      saveUiPreferences: jest.fn(),
      bandLadder: [{ level: 1, label: 'Red Band' }],
      saveBandLevel: jest.fn(),
      deleteBandLevel: jest.fn(),
      movements: [],
      oneRepMaxes: {},
      saveOneRepMax: jest.fn(),
      biometricsStatus: 'idle',
      syncBiometrics: jest.fn(),
      requestBiometricsAccess: jest.fn(),
      profileSlots: [
        { slotId: 1, name: 'Main', isActive: true },
        { slotId: 2, name: 'Secondary', isActive: false },
      ],
      switchProfile: switchProfileMock,
      wipeActiveBlockState: wipeBlockStateMock,
      session: null,
      athletes: [
        { id: 'default', name: 'Default Athlete' },
        { id: 'ath-2', name: 'Test Athlete' },
      ],
      activeAthleteId: 'default',
      switchAthlete: jest.fn(),
      createAthlete: jest.fn(),
      renameAthleteEntry: jest.fn(),
      deleteAthlete: deleteAthleteMock,
      completeOnboarding: jest.fn(),
      loadDemoAthlete: jest.fn(),
      loadRecentOutcomes: () => [
        { outcomeKind: 'followed_plan', finalizedAtMs: 1700000000000 },
        { outcomeKind: 'adapted_session', finalizedAtMs: 1700000100000 },
        { outcomeKind: 'stopped_safely', finalizedAtMs: 1700000200000 },
        { outcomeKind: 'session_recorded', finalizedAtMs: 1700000300000 },
      ],
    };
  });

  test('a) chips & steppers render with shared primitive accessibility semantics', () => {
    render(<ProfileScreen />);

    expect(screen.getByText('ATHLETE PROFILE')).toBeOnTheScreen();
    // Steppers render with Decrease/Increase accessibility labels
    expect(screen.getByLabelText('Decrease 3 · TRAINING DAYS PER WEEK')).toBeOnTheScreen();
    expect(screen.getByLabelText('Increase 3 · TRAINING DAYS PER WEEK')).toBeOnTheScreen();
  });

  test('b) Coach Mode athlete delete requires two presses before store action fires', () => {
    render(<ProfileScreen />);

    // Expand Coach Mode
    fireEvent.press(screen.getByLabelText('Coach mode, 2 athletes, collapsed'));

    // 1st press: trigger initial delete request
    fireEvent.press(screen.getByLabelText('Delete Test Athlete and their database'));

    // Assert action was NOT called on 1st press
    expect(deleteAthleteMock).not.toHaveBeenCalled();

    // Confirm message is now displayed
    expect(screen.getByText(/Confirm delete — this removes Test Athlete/)).toBeOnTheScreen();

    // 2nd press: confirm delete via QuietAction
    fireEvent.press(screen.getByText('Confirm delete Test Athlete'));

    // Assert action IS called on 2nd press
    expect(deleteAthleteMock).toHaveBeenCalledWith('ath-2');
  });

  test('b) Block wipe requires two presses before store action fires', () => {
    render(<ProfileScreen />);

    fireEvent.press(screen.getByLabelText("Delete the current block and today's state"));
    expect(wipeBlockStateMock).not.toHaveBeenCalled();

    expect(screen.getByText(/Hard-deletes the active 4-week block/)).toBeOnTheScreen();

    fireEvent.press(screen.getByText('Confirm delete current block & state'));
    expect(wipeBlockStateMock).toHaveBeenCalled();
  });

  test('c) training-decisions disclosure renders the 4 outcome labels from mocked outcome rows', () => {
    render(<ProfileScreen />);

    // Open Training-decisions disclosure
    fireEvent.press(screen.getByText('TRAINING-DECISIONS DISCLOSURE'));

    expect(screen.getByText('Plan followed')).toBeOnTheScreen();
    expect(screen.getByText('Session adapted')).toBeOnTheScreen();
    expect(screen.getByText('Session stopped safely')).toBeOnTheScreen();
    expect(screen.getByText('Session recorded')).toBeOnTheScreen();
  });

  test('renders OnboardingScreen wizard correctly using shared primitives', () => {
    render(<OnboardingScreen />);

    expect(screen.getByText(/YOUR COACH\./)).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Your name')).toBeOnTheScreen();

    // Navigate to goal step
    fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('WHAT ARE WE TRAINING FOR?')).toBeOnTheScreen();
  });
});
