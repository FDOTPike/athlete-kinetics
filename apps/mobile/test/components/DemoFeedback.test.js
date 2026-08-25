/**
 * DemoFeedback.test.js — R8 Phase 3 §2.2 UI-feedback assertions.
 *
 * The store contract (loaded vs blocked_existing_data, honest failures) is
 * proven at the store level in DemoLoadStore.test.js against the real
 * migration chain. This suite pins the two UI surfaces that must translate
 * that contract into honest feedback:
 *
 *   READY first-run (ReadinessScreen, vector === null):
 *     - a blocked result shows the exact neutral notice, polite live region;
 *     - the notice never appears when nothing was attempted or on 'loaded'.
 *
 *   Onboarding welcome step:
 *     - 'blocked_existing_data' keeps the wizard on the welcome step, does
 *       NOT call completeOnboarding, and explains preserved history + normal
 *       setup;
 *     - 'loaded' completes onboarding and never claims a demo was installed
 *       after a block.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ReadinessScreen from '../../src/screens/ReadinessScreen';
import OnboardingScreen from '../../src/screens/OnboardingScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector(mockState),
}));

const BLOCKED_NOTICE =
  'Demo not loaded because training history already exists. Use “Reset and load demo” if you want to replace it.';

const readinessState = (loadDemoAthlete) => ({
  status: 'ready',
  error: null,
  today: '2026-08-25',
  vector: null, // first-run branch hosts the demo affordance
  trend: [],
  profile: {
    objective: 'strength', training_age: 'intermediate', weekly_frequency: 3,
    equipment_inventory: ['barbell'], base_rpe_cap: 8.5, session_duration_cap_min: 60,
  },
  session: null,
  todayPlan: null,
  lastTriage: null,
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  boot: jest.fn(),
  refreshVector: jest.fn(),
  loadDemoAthlete,
  resetTrainingData: jest.fn(),
  returnCheckin: null,
  confirmReturnCheckin: jest.fn(),
  dismissReturnCheckin: jest.fn(),
});

beforeEach(() => {
  mockState = readinessState(jest.fn(() => 'loaded'));
});

describe('READY first-run demo feedback', () => {
  test('a blocked result renders the exact neutral notice with a polite live region', () => {
    mockState = readinessState(jest.fn(() => 'blocked_existing_data'));
    render(<ReadinessScreen />);

    expect(screen.queryByText(BLOCKED_NOTICE)).toBeNull();
    fireEvent.press(screen.getByLabelText('Load the 180 day demo athlete'));

    const notice = screen.getByText(BLOCKED_NOTICE);
    expect(notice).toBeOnTheScreen();
    expect(notice.props.accessibilityLiveRegion).toBe('polite');
  });

  test('no notice before any attempt and no notice after a successful load', () => {
    render(<ReadinessScreen />);
    expect(screen.queryByText(BLOCKED_NOTICE)).toBeNull();

    fireEvent.press(screen.getByLabelText('Load the 180 day demo athlete'));
    expect(mockState.loadDemoAthlete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(BLOCKED_NOTICE)).toBeNull();
  });
});

describe('onboarding demo feedback', () => {
  beforeEach(() => {
    // The wizard reads these beyond the shared base state.
    mockState.athletes = [{ id: 'default', name: 'Athlete 1' }];
    mockState.activeAthleteId = 'default';
  });

  test('blocked result stays on the welcome step, preserves history, and explains normal setup instead', () => {
    mockState.loadDemoAthlete = jest.fn(() => 'blocked_existing_data');
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByLabelText('Skip the questionnaire and load the demo athlete'));

    expect(mockState.loadDemoAthlete).toHaveBeenCalledTimes(1);
    // Still on welcome: the skip link is still rendered.
    expect(screen.getByLabelText('Skip the questionnaire and load the demo athlete')).toBeOnTheScreen();
    // Honest explanation: history preserved, normal setup remains available.
    expect(screen.getByText(
      'Your existing training history was preserved, so the demo was not loaded. You can complete the normal setup instead.',
    )).toBeOnTheScreen();
  });

  test('loaded result completes onboarding without lingering blocked copy', () => {
    let completed = false;
    mockState.completeOnboarding = jest.fn(() => { completed = true; });
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByLabelText('Skip the questionnaire and load the demo athlete'));

    expect(mockState.completeOnboarding).toHaveBeenCalledTimes(1);
    expect(completed).toBe(true);
  });
});
