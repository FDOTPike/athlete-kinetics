import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ProfileScreen from '../../src/screens/ProfileScreen';
import { NavigationProvider } from '../../src/navigation/navigation';

let mockState;

jest.mock('@ak/inference', () => {
  const actual = jest.requireActual('@ak/inference');
  return {
    ...actual,
  };
});

jest.mock('../../src/state/useStore', () => {
  const actual = jest.requireActual('../../src/state/useStore');
  const storeFunc = (selector) => selector(mockState);
  storeFunc.getState = () => mockState;
  storeFunc.setState = (patch) => { Object.assign(mockState, typeof patch === 'function' ? patch(mockState) : patch); };
  return {
    ...actual,
    useStore: storeFunc,
  };
});

beforeEach(() => {
  mockState = {
    status: 'ready',
    error: null,
    today: '2026-11-08',
    profile: {
      objective: 'strength',
      training_age: 'intermediate',
      weekly_frequency: 4,
      session_duration_cap_min: 60,
      max_sessions_per_day: 1,
      base_rpe_cap: 8.5,
      volume_tolerance: 10,
      general_notes: '',
      equipment_inventory: ['barbell', 'dumbbell', 'bench', 'squat_rack'],
      injury_flags: [],
      mobility_limits: [],
    },
    movements: [
      { movement_id: 1, name: 'Competition Squat', baseName: 'Squat', supportedPrefixes: ['Barbell'], required: ['barbell', 'squat_rack'], pattern: 'squat', is_compound: true, beginnerOk: true, difficulty: 'Beginner', loggingMode: 'reps', preference: 0, sportTracking: false, scope: null, instructions: '', cues: '', media: null, targetMuscles: ['quads'], coachingIntent: '', timePolicy: null },
      { movement_id: 2, name: 'Competition Bench', baseName: 'Bench Press', supportedPrefixes: ['Barbell'], required: ['barbell', 'bench'], pattern: 'push_h', is_compound: true, beginnerOk: true, difficulty: 'Beginner', loggingMode: 'reps', preference: 0, sportTracking: false, scope: null, instructions: '', cues: '', media: null, targetMuscles: ['chest'], coachingIntent: '', timePolicy: null },
    ],
    oneRepMaxes: { 1: 140, 2: 100 },
    loadPreference: 'auto',
    loadPreferenceExplicit: false,
    loadIntents: {},
    getMovementAvailabilityVerdicts: jest.fn(() => []),
    movementAvailabilityRevision: 0,
    ambiguousMovements: [],
    bandLadder: [],
    profileSlots: [{ slotId: 1, name: 'Default', isActive: true }],
    athletes: [{ id: 'default', name: 'Alice', dbName: 'athlete_kinetics.db', createdAtMs: 0 }],
    activeAthleteId: 'default',
    advancedToolsUnlocked: false,
    session: null,
    biometricsStatus: 'unavailable',
    biometricsSummary: null,
    lastBiometricsSyncAt: null,
    lastSuccessfulBackupAt: null,
    backupWorking: false,
    backupError: null,
    backupNotice: null,
    backupPreview: null,
    recoveryBackupAvailable: false,
    recoveryBlockedReason: null,
    uiPreferences: {
      sessionModeOverride: null,
      readinessDetail: 'summary',
      restTimerEnabled: true,
      textScale: 'system',
    },
    focus: null,
    goals: [],
    sport: null,
    activities: [],
    healthSupportState: {
      status: 'not_assessed',
      preferencesText: '',
      privateNotesText: '',
      instructionsText: '',
      holdMovementIds: [],
      updatedAtMs: null,
    },
    saveProfile: jest.fn(),
    saveOneRepMax: jest.fn(),
    saveBodyweight: jest.fn(),
    saveLoadPreference: jest.fn(),
    saveMovementLoadIntent: jest.fn(() => true),
    saveUiPreferences: jest.fn(),
    saveBandLevel: jest.fn(),
    deleteBandLevel: jest.fn(),
    switchProfile: jest.fn(),
    wipeBlockAndState: jest.fn(),
    resetTrainingData: jest.fn(),
    loadDemoData: jest.fn(),
    loadRecentOutcomes: jest.fn(() => []),
    loadMeasuredHistory: jest.fn(() => []),
    loadTodayBodyweight: jest.fn(() => 82.5),
    importHistory: jest.fn(),
    requestBiometricsAccess: jest.fn(),
    syncBiometrics: jest.fn(),
    getTrainingSupportDecision: jest.fn(() => ({ status: 'available', holdIds: [] })),
  };
});

describe('ProfileScreen single-line numeric inputs allow parent ScrollView drag interception on Android (#153)', () => {
  test('One-Rep Max and Bodyweight inputs avoid textAlign center (which triggers Android TextView VERY_WIDE horizontal scroll range) and keep validation intact', () => {
    render(
      <NavigationProvider initialTab="athlete">
        <ProfileScreen />
      </NavigationProvider>,
    );

    const squatInput = screen.getByLabelText('SQUAT one rep max in kilograms, type to set');
    const benchInput = screen.getByLabelText('BENCH one rep max in kilograms, type to set');
    const bodyweightInput = screen.getByLabelText('Bodyweight today in kilograms');

    for (const input of [squatInput, benchInput, bodyweightInput]) {
      const flatStyle = StyleSheet.flatten(input.props.style);
      expect(flatStyle.textAlign).not.toBe('center');
      expect(flatStyle.includeFontPadding).toBe(false);
    }

    // Validation & commit behavior on tap/edit remains unchanged
    fireEvent.changeText(squatInput, '145');
    fireEvent(squatInput, 'endEditing');
    expect(mockState.saveOneRepMax).toHaveBeenCalledWith(1, 145);

    fireEvent.changeText(bodyweightInput, '83.2');
    fireEvent(bodyweightInput, 'endEditing');
    expect(mockState.saveBodyweight).toHaveBeenCalledWith('2026-11-08', 83.2);
  });
});
