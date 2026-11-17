/**
 * Issue #155:
 * - Label objective chips on Profile with the onboarding names (one shared map),
 *   keeping the stored keys.
 * - Label the PROFILE MANAGEMENT slot chips as saved test profiles
 *   (e.g. "Saved profile: Intermediate"), not as the athlete's training level.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

let mockState;
jest.mock('../../src/state/useStore', () => {
  const actual = jest.requireActual('../../src/state/useStore');
  const useStore = (selector) => selector(mockState);
  useStore.getState = () => mockState;
  return { ...actual, useStore };
});

import ProfileScreen, { objectiveChangeText } from '../../src/screens/ProfileScreen';
import { OBJECTIVE_COPY, OBJECTIVE_LABEL } from '../../src/screens/OnboardingScreen';

describe('ProfileScreen objective chip labels and saved profile slot labels (#155)', () => {
  beforeEach(() => {
    mockState = {
      status: 'ready',
      databaseReady: true,
      error: null,
      clearError: jest.fn(),
      profile: {
        training_age: 'beginner',
        objective: 'rehab',
        weekly_frequency: 3,
        session_duration_cap_min: 45,
        max_sessions_per_day: 1,
        base_rpe_cap: 8.0,
        target_energy_system: 'hybrid',
        equipment_inventory: ['barbell', 'bench'],
        injury_flags: [],
        mobility_limits: [],
        practitioner_notes: '',
        preference_notes: '',
        notes: '',
      },
      saveProfile: jest.fn(),
      loadPreference: 'auto',
      loadPreferenceExplicit: false,
      saveLoadPreference: jest.fn(),
      loadIntents: {},
      saveMovementLoadIntent: jest.fn(() => true),
      getMovementAvailabilityVerdicts: jest.fn(() => []),
      movementAvailabilityRevision: 0,
      niggles: [],
      movementPreferences: {},
      setMovementPreference: jest.fn(),
      uiPreferences: {
        sessionModeOverride: null,
        readinessDetail: 'simple',
        restTimerEnabled: true,
        textScale: 'default',
      },
      saveUiPreferences: jest.fn(),
      bandLadder: [],
      saveBandLevel: jest.fn(),
      deleteBandLevel: jest.fn(),
      movements: [],
      oneRepMaxes: {},
      saveOneRepMax: jest.fn(),
      today: '2026-11-08',
      importHistory: jest.fn(),
      saveBodyweight: jest.fn(),
      loadMeasuredHistory: jest.fn(() => []),
      biometricsStatus: 'idle',
      syncBiometrics: jest.fn(),
      requestBiometricsAccess: jest.fn(),
      profileSlots: [
        { slotId: 1, name: 'Intermediate', trainingAge: 'beginner', isActive: true },
        { slotId: 2, name: 'Competition Prep', trainingAge: 'advanced', isActive: false },
      ],
      switchProfile: jest.fn(),
      wipeActiveBlockState: jest.fn(),
      resetTrainingData: jest.fn(),
      session: null,
      athletes: [{ id: 'default', name: 'Alex' }],
      activeAthleteId: 'default',
      switchAthlete: jest.fn(),
      createAthlete: jest.fn(),
      renameAthleteEntry: jest.fn(),
      deleteAthlete: jest.fn(),
      completeOnboarding: jest.fn(),
      beginOnboardingDraft: () => ({ athleteId: 'default', contextRevision: 0 }),
      loadDemoAthlete: jest.fn(),
      loadRecentOutcomes: () => [],
    };
  });

  test('objective row shows RETURN TO TRAINING for rehab and no raw objective key', () => {
    render(<ProfileScreen />);

    // Shared map is exported from OnboardingScreen
    expect(OBJECTIVE_COPY.rehab.label).toBe('RETURN TO TRAINING');

    // Every objective chip shows the onboarding label and not the raw key
    expect(screen.getByText('RETURN TO TRAINING')).toBeOnTheScreen();
    expect(screen.getByText('ALL-ROUND FITNESS')).toBeOnTheScreen();
    expect(screen.getByText('STRENGTH + GRAPPLING')).toBeOnTheScreen();
    expect(screen.getByText('WEIGHT-LOSS SUPPORT')).toBeOnTheScreen();

    expect(screen.queryByText('REHAB')).toBeNull();
    expect(screen.queryByText('GPP')).toBeNull();
    expect(screen.queryByText('WEIGHT LOSS')).toBeNull();

    const rehabChip = screen.getByRole('button', { name: '1 · OBJECTIVE: RETURN TO TRAINING' });
    expect(rehabChip.props.accessibilityState.selected).toBe(true);

    const gppChip = screen.getByRole('button', { name: '1 · OBJECTIVE: ALL-ROUND FITNESS' });
    fireEvent.press(gppChip);
    fireEvent.press(screen.getByTestId('profile-objective-confirm'));
    expect(mockState.saveProfile).toHaveBeenCalledWith({ objective: 'gpp' });
  });

  test('profile slot chip text names a saved profile rather than reading as the athlete training level', () => {
    render(<ProfileScreen />);

    expect(screen.getByText('Saved profile: Intermediate ✓')).toBeOnTheScreen();
    expect(screen.getByText('Saved profile: Competition Prep')).toBeOnTheScreen();
    expect(screen.queryByText('INTERMEDIATE ✓')).toBeNull();

    const activeSlot = screen.getByRole('button', { name: 'Saved profile: Intermediate, active' });
    expect(activeSlot.props.accessibilityState.selected).toBe(true);
  });

  // Issue #353: confirmation message and button/a11y labels map through
  // OBJECTIVE_LABEL (never exposing raw enum tokens like gpp/hybrid/rehab/weight_loss).
  test('#353 objectiveChangeText and confirmation buttons use OBJECTIVE_LABEL for gpp, hybrid, rehab, weight_loss', () => {
    const rawEnumPattern = /\b(gpp|hybrid|rehab|weight_loss|weight loss|strength|hypertrophy|power|endurance)\b/;
    const pairs = [
      ['rehab', 'gpp'],
      ['hybrid', 'weight_loss'],
      ['gpp', 'hybrid'],
      ['weight_loss', 'rehab'],
    ];

    for (const [from, to] of pairs) {
      const fromLabel = OBJECTIVE_LABEL[from];
      const toLabel = OBJECTIVE_LABEL[to];
      const variants = [
        objectiveChangeText(from, to, null, false, false, false),
        objectiveChangeText(from, to, null, true, false, false),
        objectiveChangeText(from, to, null, false, true, false),
        objectiveChangeText(from, to, from, true, false, false),
        objectiveChangeText(from, to, from, true, false, true),
      ];
      for (const text of variants) {
        expect(text).toContain(fromLabel);
        expect(text).toContain(toLabel);
        expect(rawEnumPattern.test(text)).toBe(false);
      }
    }

    mockState = {
      ...mockState,
      profile: { ...mockState.profile, objective: 'hybrid' },
      block: { blockId: 1, startDate: '2026-07-01', objective: 'hybrid', createdAtMs: 1 },
      program: null,
    };
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: '1 · OBJECTIVE: WEIGHT-LOSS SUPPORT' }));

    const changeText = screen.getByTestId('profile-objective-change-text').props.children;
    expect(changeText).toContain('STRENGTH + GRAPPLING');
    expect(changeText).toContain('WEIGHT-LOSS SUPPORT');
    expect(rawEnumPattern.test(changeText)).toBe(false);

    const confirmBtn = screen.getByTestId('profile-objective-confirm');
    expect(confirmBtn.props.accessibilityLabel).toBe('Change objective to WEIGHT-LOSS SUPPORT');
    expect(rawEnumPattern.test(confirmBtn.props.accessibilityLabel)).toBe(false);

    const keepBtn = screen.getByTestId('profile-objective-keep');
    expect(keepBtn.props.accessibilityLabel).toBe('Keep STRENGTH + GRAPPLING');
    expect(screen.getByText('Keep STRENGTH + GRAPPLING')).toBeOnTheScreen();
    expect(rawEnumPattern.test(keepBtn.props.accessibilityLabel)).toBe(false);
  });
});
