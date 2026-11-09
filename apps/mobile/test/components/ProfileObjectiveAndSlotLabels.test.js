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

import ProfileScreen from '../../src/screens/ProfileScreen';
import { OBJECTIVE_COPY } from '../../src/screens/OnboardingScreen';

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
});
