/**
 * Component surface of the Phase 2a pre-release content correction (049):
 *   - full-body training scope is visible in the library list AND detail, and
 *     is independently filterable (O4);
 *   - specialist equipment is a SEPARATE, explicit opt-in in both equipment
 *     surfaces, and no preset selects it (O3).
 *
 * These target LibraryScreenV2 directly — LibraryScreen.tsx is a two-line
 * re-export shim and carries no implementation.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EQUIPMENT_PRESETS, SPECIALIST_EQUIPMENT_ITEMS, STANDARD_EQUIPMENT_ITEMS } from '@ak/inference';
import LibraryScreenV2 from '../../src/screens/LibraryScreenV2';
import ProfileScreen from '../../src/screens/ProfileScreen';
import OnboardingScreen from '../../src/screens/OnboardingScreen';

let mockState;

jest.mock('../../src/state/useStore', () => ({
  localToday: () => '2026-08-11',
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  formatTeachingOnlyReason: (verdict) => `Teaching only — ${verdict.reasons.join('; ')}`,
  useStore: (selector) => selector(mockState),
}));

const movement = (over) => ({
  movement_id: 1,
  name: 'Movement',
  pattern: 'squat',
  is_compound: true,
  beginnerOk: false,
  loggingMode: 'reps',
  instructions: 'Set up. Move.',
  cues: 'Own the rep.',
  media: null,
  targetMuscles: ['quadriceps'],
  coachingIntent: 'Train the pattern.',
  timePolicy: null,
  required: [],
  baseName: 'Movement',
  supportedPrefixes: [],
  difficulty: 'Intermediate',
  preference: 0,
  progressionGroup: null,
  progressionRank: null,
  scope: null,
  sportTracking: false,
  ...over,
});

// Mirrors the two ratified rows: the canonical TGU is a legacy v1 record with a
// reviewed YouTube fallback, the Lunge-style one is a v2 record with planned media.
const CANONICAL_TGU = movement({
  movement_id: 68,
  name: 'Kettlebell Turkish Get-Up',
  pattern: 'rotation',
  baseName: 'Turkish Get-Up',
  difficulty: 'Advanced',
  required: ['kettlebell'],
  scope: 'full_body',
  media: {
    assetKey: 'movement/kettlebell-turkish-get-up/demo/v1',
    status: 'external_fallback',
    revision: 1,
    fallbackUrl: 'https://www.youtube.com/watch?v=lpltjWHd0ek',
  },
});
const LUNGE_TGU = movement({
  movement_id: 231,
  name: 'Kettlebell Turkish Get-Up (Lunge style)',
  pattern: 'rotation',
  baseName: 'Kettlebell Turkish Get-Up (Lunge style)',
  required: ['kettlebell'],
  scope: 'full_body',
  media: { assetKey: 'movement/kettlebell-turkish-get-up-lunge-style/demo/v1', status: 'planned', revision: 1, fallbackUrl: null },
});
const PLANK = movement({ movement_id: 25, name: 'Plank', pattern: 'rotation', baseName: 'Plank' });
const BOARD_PRESS = movement({
  movement_id: 151,
  name: 'Board Press',
  pattern: 'push_h',
  baseName: 'Board Press',
  required: ['boards', 'bands', 'barbell', 'bench', 'squat_rack'],
});

const libraryMovements = [CANONICAL_TGU, PLANK, BOARD_PRESS, LUNGE_TGU];

describe('049 full-body scope in the movement library', () => {
  beforeEach(() => {
    mockState = {
      movements: libraryMovements,
      profile: { training_age: 'advanced', equipment_inventory: ['kettlebell'] },
      getMovementAvailabilityVerdicts: () => libraryMovements.map((m) => ({
        movementId: m.movement_id, state: 'available', reasons: [], effectiveContext: 'weight_room',
        capabilitySource: 'not_required', blockingPrerequisiteMovementIds: [],
        confirmationWouldClear: false, separateAttestationRequired: false,
      })),
      movementAvailabilityRevision: 0,
      resolveGoalRung: () => null,
    };
  });

  test('both Turkish Get-Ups carry a full-body badge in the list, and nothing else does', () => {
    render(<LibraryScreenV2 />);
    expect(screen.getByLabelText('Kettlebell Turkish Get-Up is a full body movement')).toBeOnTheScreen();
    expect(screen.getByLabelText('Kettlebell Turkish Get-Up (Lunge style) is a full body movement')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Plank is a full body movement')).not.toBeOnTheScreen();
    expect(screen.queryByLabelText('Board Press is a full body movement')).not.toBeOnTheScreen();
  });

  test('the scope filter is independent of pattern and type, and narrows to the scoped rows', () => {
    render(<LibraryScreenV2 />);
    expect(screen.getByText('4 of 4 movements')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Filter scope by Full body'));
    expect(screen.getByText('2 of 4 movements')).toBeOnTheScreen();
    expect(screen.getByText('Kettlebell Turkish Get-Up')).toBeOnTheScreen();
    expect(screen.getByText('Kettlebell Turkish Get-Up (Lunge style)')).toBeOnTheScreen();
    expect(screen.queryByText('Plank')).not.toBeOnTheScreen();
  });

  test('the scope filter composes conjunctively with an equipment facet', () => {
    render(<LibraryScreenV2 />);
    fireEvent.press(screen.getByLabelText('Filter scope by Full body'));
    fireEvent.press(screen.getByLabelText('Filter equipment by Boards'));
    expect(screen.getByText('No matching movements')).toBeOnTheScreen();
  });

  test('clearing filters restores the full corpus', () => {
    render(<LibraryScreenV2 />);
    fireEvent.press(screen.getByLabelText('Filter scope by Full body'));
    fireEvent.press(screen.getAllByLabelText('Clear search and filters')[0]);
    expect(screen.getByText('4 of 4 movements')).toBeOnTheScreen();
  });

  test('the detail view shows the scope chip and preserves the legacy media identity', () => {
    render(<LibraryScreenV2 initialMovementId={68} />);
    expect(screen.getByLabelText('Kettlebell Turkish Get-Up is a full body movement')).toBeOnTheScreen();
    expect(screen.getByLabelText('Watch movement demonstration video')).toBeOnTheScreen();
  });

  test('an unscoped movement shows no scope chip in detail', () => {
    render(<LibraryScreenV2 initialMovementId={25} />);
    expect(screen.queryByLabelText('Plank is a full body movement')).not.toBeOnTheScreen();
  });

  test('the Boards requirement is labelled, not shown as a raw token', () => {
    render(<LibraryScreenV2 initialMovementId={151} />);
    expect(screen.getByText('BOARDS')).toBeOnTheScreen();
  });
});

describe('049 specialist equipment is explicit opt-in only', () => {
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
  let saveProfile;

  beforeEach(() => {
    saveProfile = jest.fn();
    mockState = {
      profile: baseProfile,
      saveProfile,
      uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
      saveUiPreferences: jest.fn(),
      loadPreference: 'auto',
      loadPreferenceExplicit: false,
      saveLoadPreference: jest.fn(),
      bandLadder: [],
      saveBandLevel: jest.fn(),
      deleteBandLevel: jest.fn(),
      movements: [],
      oneRepMaxes: {},
      saveOneRepMax: jest.fn(),
      today: '2026-08-11',
      importHistory: jest.fn(),
      saveBodyweight: jest.fn(),
      loadMeasuredHistory: jest.fn(() => []),
      biometricsStatus: 'idle',
      syncBiometrics: jest.fn(),
      requestBiometricsAccess: jest.fn(),
      profileSlots: [{ slotId: 1, name: 'Main', isActive: true }],
      switchProfile: jest.fn(),
      wipeActiveBlockState: jest.fn(),
      session: null,
      athletes: [{ id: 'default', name: 'Default Athlete' }],
      activeAthleteId: 'default',
      switchAthlete: jest.fn(),
      createAthlete: jest.fn(),
      renameAthleteEntry: jest.fn(),
      deleteAthlete: jest.fn(),
      completeOnboarding: jest.fn(),
      loadDemoAthlete: jest.fn(),
      loadRecentOutcomes: () => [],
    };
  });

  test('no preset bundle contains a specialist item', () => {
    for (const bundle of Object.values(EQUIPMENT_PRESETS)) {
      for (const item of SPECIALIST_EQUIPMENT_ITEMS) {
        expect(bundle).not.toContain(item);
      }
    }
    expect([...EQUIPMENT_PRESETS.full_gym]).toEqual([...STANDARD_EQUIPMENT_ITEMS]);
  });

  test('ProfileScreen renders Boards in its own specialist group, unselected by default', () => {
    render(<ProfileScreen />);
    expect(screen.getByText(/Specialist equipment — off unless you turn it on/)).toBeOnTheScreen();
    const toggle = screen.getByLabelText('Specialist equipment boards, not owned');
    expect(toggle).toBeOnTheScreen();
    fireEvent.press(toggle);
    expect(saveProfile).toHaveBeenCalledWith({
      equipment_inventory: ['barbell', 'dumbbells', 'bench', 'boards'],
    });
  });

  test('ProfileScreen reflects an explicit Boards selection as owned', () => {
    mockState.profile = { ...baseProfile, equipment_inventory: ['barbell', 'boards'] };
    render(<ProfileScreen />);
    expect(screen.getByLabelText('Specialist equipment boards, owned')).toBeOnTheScreen();
  });

  test('pressing the full_gym preset never turns Boards on', () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText('Use full gym equipment preset'));
    const [[patch]] = saveProfile.mock.calls;
    expect(patch.equipment_inventory).not.toContain('boards');
    expect(patch.equipment_inventory).toEqual([...STANDARD_EQUIPMENT_ITEMS]);
  });

  test('Onboarding separates the specialist toggle from the standard grid', () => {
    render(<OnboardingScreen />);
    // Walk the wizard forward to the equipment step.
    for (let i = 0; i < 20; i += 1) {
      if (screen.queryByText('WHAT CAN YOU GET YOUR HANDS ON?') !== null) break;
      const next = screen.queryByLabelText('Next');
      if (next === null) break;
      fireEvent.press(next);
    }
    // W2 (program-quality work order §6.2): presets come first and the
    // standard grid is collapsed until the athlete explicitly customizes.
    fireEvent.press(screen.getByLabelText('Customize equipment'));
    expect(screen.getByText('SPECIALIST')).toBeOnTheScreen();
    // The onboarding draft starts from DEFAULT_PROFILE: every STANDARD item is
    // pre-owned, and the specialist toggle is off — that asymmetry is the point.
    expect(screen.getByLabelText('BARBELL: owned')).toBeOnTheScreen();
    expect(screen.getByLabelText('Specialist equipment BOARDS: not owned')).toBeOnTheScreen();
    expect(screen.getByText(/Specialist items stay off unless you turn them on/)).toBeOnTheScreen();
  });
});
