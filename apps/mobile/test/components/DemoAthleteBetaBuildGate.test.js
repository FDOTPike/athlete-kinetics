/**
 * Issue #133:
 * - Hide "Load demo athlete" and every "Reset and load demo" entry point
 *   (READY and onboarding) in athlete beta builds (`IS_BETA_BUILD === true`).
 *   Keep them in internal and dev builds (`IS_BETA_BUILD === false`).
 * - In beta builds, copy that says "load the demo athlete" must not appear.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

let mockIsBetaBuild = false;
jest.mock('../../src/config/features', () => ({
  get IS_BETA_BUILD() {
    return mockIsBetaBuild;
  },
  get QUESTION_BOX_ENABLED() {
    return mockIsBetaBuild;
  },
}));

let mockState;
jest.mock('../../src/state/useStore', () => {
  const actual = jest.requireActual('../../src/state/useStore');
  const useStore = (selector) => selector(mockState);
  useStore.getState = () => mockState;
  return { ...actual, useStore };
});

import ReadinessScreen from '../../src/screens/ReadinessScreen';
import OnboardingScreen from '../../src/screens/OnboardingScreen';
import BlockScreen from '../../src/screens/BlockScreen';
import { SubjectiveReportPanel } from '../../src/components/SubjectiveReportPanel';

describe('Demo athlete entry points and copy gated by IS_BETA_BUILD (#133)', () => {
  beforeEach(() => {
    mockIsBetaBuild = false;
    mockState = {
      status: 'ready',
      databaseReady: true,
      getTrainingSupportDecision: () => ({ status: 'available' }),
      healthSupportStatus: 'ready',
      healthSupportHold: false,
      error: null,
      clearError: jest.fn(),
      vector: null,
      lastTriage: null,
      session: null,
      todayPlan: null,
      today: '2026-11-08',
      refreshVector: jest.fn(),
      loadDemoAthlete: jest.fn(() => 'loaded'),
      resetTrainingData: jest.fn(),
      uiPreferences: {
        sessionModeOverride: null,
        readinessDetail: 'simple',
        restTimerEnabled: true,
        textScale: 'default',
      },
      saveUiPreferences: jest.fn(),
      profile: {
        training_age: 'beginner',
        objective: 'gpp',
        weekly_frequency: 3,
        session_duration_cap_min: 45,
        max_sessions_per_day: 1,
        base_rpe_cap: 8.5,
        target_energy_system: 'hybrid',
        equipment_inventory: ['barbell', 'bench'],
        injury_flags: [],
        mobility_limits: [],
        practitioner_notes: '',
        preference_notes: '',
        notes: '',
      },
      beginOnboardingDraft: () => ({ athleteId: 'default', contextRevision: 0 }),
      completeOnboarding: jest.fn(),
      athletes: [{ id: 'default', name: 'Athlete 1' }],
      activeAthleteId: 'default',
      block: null,
      blockSessions: [],
      program: null,
      prescription: null,
      routineTemplates: [],
      loadRoutineTemplates: jest.fn(),
      deleteRoutineTemplate: jest.fn(),
      freezeRoutineTemplateToPlannedSession: jest.fn(),
      previewNextProgramBlock: jest.fn(() => null),
      continueTrainingProgram: jest.fn(),
      archiveTrainingProgram: jest.fn(),
    };
  });

  test('a beta build shows no demo control on READY or in onboarding, and no "load the demo athlete" copy', () => {
    mockIsBetaBuild = true;

    const readyView = render(<ReadinessScreen />);
    expect(screen.queryByText('Load demo athlete')).toBeNull();
    expect(screen.queryByText('Reset and load demo')).toBeNull();
    expect(screen.getByText('Refresh')).toBeOnTheScreen();
    readyView.unmount();

    const onboardingView = render(<OnboardingScreen />);
    expect(screen.queryByText(/Load the demo athlete/i)).toBeNull();
    onboardingView.unmount();

    const blockView = render(<BlockScreen />);
    expect(screen.queryByText(/load the demo athlete/i)).toBeNull();
    expect(
      screen.getByText("Sync telemetry before asking Coach to adjust today's plan."),
    ).toBeOnTheScreen();
    blockView.unmount();

    const reportView = render(
      <SubjectiveReportPanel
        hasVector={false}
        lastTriage={null}
        triaging={false}
        triageReady={true}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText(/load the demo athlete/i)).toBeNull();
    expect(
      screen.getByText("Sync telemetry before asking Coach to adjust today's plan."),
    ).toBeOnTheScreen();
    reportView.unmount();
  });

  test('a dev build keeps the demo controls on READY and onboarding and the demo copy', () => {
    mockIsBetaBuild = false;

    const readyView = render(<ReadinessScreen />);
    expect(screen.getByText('Load demo athlete')).toBeOnTheScreen();
    expect(screen.getByText('Reset and load demo')).toBeOnTheScreen();
    readyView.unmount();

    const onboardingView = render(<OnboardingScreen />);
    expect(screen.getByText('Just exploring? Load the demo athlete →')).toBeOnTheScreen();
    onboardingView.unmount();

    const blockView = render(<BlockScreen />);
    expect(
      screen.getByText(
        "Sync telemetry or load the demo athlete before asking Coach to adjust today's plan.",
      ),
    ).toBeOnTheScreen();
    blockView.unmount();
  });
});
