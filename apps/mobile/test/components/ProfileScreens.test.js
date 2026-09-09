import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TRAINING_AGES } from '@ak/inference';
import ProfileScreen from '../../src/screens/ProfileScreen';
import OnboardingScreen from '../../src/screens/OnboardingScreen';
import { NavigationProvider } from '../../src/navigation/navigation';

let mockState;

jest.mock('@ak/inference', () => ({
  ...jest.requireActual('@ak/inference'),
  defaultLoadPreference: (age) => age === 'advanced' || age === 'elite' ? 'manual' : 'auto',
  transitionLoadPreference: (from, to, current, explicit) => {
    if (to === 'beginner') return 'auto';
    if (from === 'beginner') return to === 'advanced' || to === 'elite' ? 'manual' : 'auto';
    if (explicit) return current;
    return to === 'advanced' || to === 'elite' ? 'manual' : 'auto';
  },
}));

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
  let saveLoadPreferenceMock;

  beforeEach(() => {
    deleteAthleteMock = jest.fn();
    wipeBlockStateMock = jest.fn();
    switchProfileMock = jest.fn();
    saveLoadPreferenceMock = jest.fn();

    mockState = {
      profile: baseProfile,
      saveProfile: jest.fn(),
      uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
      saveUiPreferences: jest.fn(),
      loadPreference: 'auto',
      loadPreferenceExplicit: false,
      saveLoadPreference: saveLoadPreferenceMock,
      bandLadder: [{ level: 1, label: 'Red Band' }],
      saveBandLevel: jest.fn(),
      deleteBandLevel: jest.fn(),
      movements: [],
      oneRepMaxes: {},
      saveOneRepMax: jest.fn(),
      today: '2026-07-15',
      importHistory: jest.fn(() => ({ committed: false, duplicate: false, preview: { sessions: [], errors: [], warnings: [], unknownMovementNames: [], formatVersion: null } })),
      saveBodyweight: jest.fn(),
      loadMeasuredHistory: jest.fn(() => []),
      loadCoachDiagnosticContext: jest.fn(() => ({ sessionsToday: 0, trainedDaysLast7: 0 })),
      loadCoachMovementAccessContext: jest.fn(() => ({
        edges: [],
        evidence: [],
        attestedEdgeKeys: [],
        safetyExcludedMovementIds: [],
        priorExperienceMovementIds: [],
      })),
      vector: null,
      blockSessions: [],
      getMovementAvailabilityVerdicts: jest.fn(() => []),
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
      advancedToolsUnlocked: false,
      setAdvancedToolsUnlocked: jest.fn(),
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
    expect(screen.getByTestId('training-guidance-safety-notice')).toBeOnTheScreen();
    expect(screen.getByLabelText(/Training guidance safety notice/)).toBeOnTheScreen();
    expect(screen.getByText(/pikeMethods provides training guidance, not medical advice/)).toBeOnTheScreen();
    // Steppers render with Decrease/Increase accessibility labels
    expect(screen.getByLabelText('Decrease 3 · TRAINING DAYS PER WEEK')).toBeOnTheScreen();
    expect(screen.getByLabelText('Increase 3 · TRAINING DAYS PER WEEK')).toBeOnTheScreen();
  });

  test('b) Coach Mode athlete delete requires two presses before store action fires', () => {
    mockState.advancedToolsUnlocked = true;
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

  test('advanced athlete management and Lab are hidden until the seven-tap gesture', () => {
    render(<ProfileScreen />);

    expect(screen.queryByTestId('advanced-athlete-manager')).toBeNull();
    expect(screen.queryByTestId('advanced-tools-section')).toBeNull();
    for (let i = 0; i < 7; i += 1) fireEvent.press(screen.getByLabelText('Build 0.1.0'));
    expect(mockState.setAdvancedToolsUnlocked).toHaveBeenCalledTimes(1);
    expect(mockState.setAdvancedToolsUnlocked).toHaveBeenCalledWith(true);
  });

  test('unlocked tools expose the sandbox Lab and explicit relock', () => {
    mockState.advancedToolsUnlocked = true;
    render(<ProfileScreen />);

    expect(screen.getByTestId('advanced-athlete-manager')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Open Coach Verification Lab'));
    expect(screen.getByTestId('coach-verification-lab')).toBeOnTheScreen();
    expect(screen.getByTestId('lab-no-write-notice')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Run all verification scenarios'));
    expect(screen.getByTestId('lab-module-prescription')).toBeOnTheScreen();
    expect(screen.getByTestId('lab-module-session')).toBeOnTheScreen();
    expect(mockState.saveProfile).not.toHaveBeenCalled();
    expect(mockState.saveBodyweight).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Close Coach Verification Lab'));
    fireEvent.press(screen.getByLabelText('Relock advanced tools'));
    expect(mockState.setAdvancedToolsUnlocked).toHaveBeenCalledWith(false);
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

  test('d) history import disclosure renders selectable example and AI prompt blocks without repo path hint', () => {
    render(<ProfileScreen />);

    // Open Import Training History disclosure
    fireEvent.press(screen.getByText('IMPORT TRAINING HISTORY'));

    // Example block is visible on-screen and selectable
    const exampleElement = screen.getByText(/SESSION\|2026-07-20\|45\|7\.5/);
    expect(exampleElement).toBeOnTheScreen();
    expect(exampleElement.props.selectable).toBe(true);

    // AI prompt block is visible on-screen and selectable
    const promptElement = screen.getByText(/External-AI prompt:/);
    expect(promptElement).toBeOnTheScreen();
    expect(promptElement.props.selectable).toBe(true);

    // Repo path hint is removed
    expect(screen.queryByText(/docs\/AK_HISTORY_V1\.md/)).toBeNull();
  });

  test('ships the offline movement catalogue data-source acknowledgement', () => {
    render(<ProfileScreen />);

    expect(screen.getByTestId('data-sources-acknowledgement')).toBeOnTheScreen();
    expect(screen.getByText('DATA SOURCES')).toBeOnTheScreen();
    expect(screen.getAllByText(/free-exercise-db/)).toHaveLength(2);
    expect(screen.getByText(/released under the Unlicense/)).toBeOnTheScreen();
  });

  test('renders OnboardingScreen wizard correctly using shared primitives', () => {
    render(<OnboardingScreen />);

    expect(screen.getByText(/YOUR COACH\./)).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Your name')).toBeOnTheScreen();

    // Navigate to goal step
    fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByText('WHAT ARE WE TRAINING FOR?')).toBeOnTheScreen();
  });

  test('Profile load selection is editable for non-beginners when no session is active', () => {
    render(<ProfileScreen />);

    expect(screen.getByTestId('profile-load-selection-row')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-load-pref-auto').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByTestId('profile-load-pref-manual'));
    expect(saveLoadPreferenceMock).toHaveBeenCalledWith('manual');
    expect(screen.getByText(/Applies to your next session\./)).toBeOnTheScreen();
  });

  test('Profile load selection is disabled during an active session', () => {
    mockState.session = { sessionId: 10, sets: [] };
    render(<ProfileScreen />);

    expect(screen.getByTestId('profile-load-pref-auto').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('profile-load-pref-manual').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Finish the active session before changing load selection.')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('profile-load-pref-manual'));
    expect(saveLoadPreferenceMock).not.toHaveBeenCalled();
  });

  test('Profile omits the load-selection choice for beginners', () => {
    mockState.profile = { ...baseProfile, training_age: 'beginner' };
    render(<ProfileScreen />);
    expect(screen.queryByTestId('profile-load-selection-row')).toBeNull();
  });

  const advance = (count) => {
    for (let i = 0; i < count; i += 1) fireEvent.press(screen.getByLabelText('Next'));
  };
  const retreat = (count) => {
    for (let i = 0; i < count; i += 1) fireEvent.press(screen.getByLabelText('Back'));
  };
  // Round 2 (ledger 0060): the limitations screen requires an explicit
  // no/yes answer BEFORE NEXT enables — a full walk to review must answer
  // it. Helpers that pass through the limits screen press the explicit No.
  const advanceAnsweringLimits = (count, fromStep) => {
    for (let i = 0; i < count; i += 1) {
      fireEvent.press(screen.getByLabelText('Next'));
      if (fromStep + i === 4) { // arriving at limits (0-based step 5)
        fireEvent.press(screen.getByLabelText('No, nothing to note'));
      }
    }
  };

  test('onboarding omits the load question for beginners and explains first-use history on summary', () => {
    render(<OnboardingScreen />);
    advance(2);
    fireEvent.press(screen.getByLabelText(/NEW TO THIS\./));
    advanceAnsweringLimits(4, 2); // beginner flow is 7 screens; review is the 7th

    expect(screen.queryByTestId('onboarding-loads-step')).toBeNull();
    expect(screen.getByTestId('onboarding-summary-loads-row').props.children)
      .toBe('LOADS — you choose the first; next time starts from what you logged');
  });

  test('onboarding preserves an explicit same-as-default choice across non-beginner tier churn', () => {
    render(<OnboardingScreen />);
    advance(2);
    fireEvent.press(screen.getByLabelText(/SOME MILEAGE\./));
    advanceAnsweringLimits(4, 2);
    expect(screen.getByTestId('onboarding-loads-auto').props.accessibilityState.selected).toBe(true);

    // Press the already-selected default: this is now an explicit athlete
    // choice and must survive the destination tier's different default.
    fireEvent.press(screen.getByTestId('onboarding-loads-auto'));
    retreat(4);
    fireEvent.press(screen.getByLabelText(/EXPERIENCED\./));
    advanceAnsweringLimits(4, 2);

    expect(screen.getByTestId('onboarding-loads-auto').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('onboarding-loads-manual').props.accessibilityState.selected).toBe(false);
  });

  test('onboarding re-defaults a non-explicit preference after a non-beginner tier change', () => {
    render(<OnboardingScreen />);
    advance(2);
    fireEvent.press(screen.getByLabelText(/SOME MILEAGE\./));
    advanceAnsweringLimits(4, 2);
    expect(screen.getByTestId('onboarding-loads-auto').props.accessibilityState.selected).toBe(true);

    // No load chip was pressed, so the intermediate auto value is only a
    // default. Advanced must independently derive its manual default.
    retreat(4);
    fireEvent.press(screen.getByLabelText(/EXPERIENCED\./));
    advanceAnsweringLimits(4, 2);

    expect(screen.getByTestId('onboarding-loads-manual').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('onboarding-loads-auto').props.accessibilityState.selected).toBe(false);
  });

  test('active session disables all TRAINING AGE chips and shows the load-authority hint', () => {
    mockState = { ...mockState, session: { sessionId: 10, date: '2026-07-15', startedAtMs: Date.now(), sets: [] } };
    render(<ProfileScreen />);
    // Every TRAINING AGE chip must be disabled
    for (const age of TRAINING_AGES) {
      const chip = screen.getByLabelText(`2 · TRAINING AGE: ${age}`);
      expect(chip.props.accessibilityState.disabled).toBe(true);
    }
    expect(screen.getByText('Training age cannot change during a session because it can change load authority.')).toBeOnTheScreen();
  });

  test('active session pressing a disabled TRAINING AGE chip does not call saveProfile', () => {
    mockState = { ...mockState, session: { sessionId: 10, date: '2026-07-15', startedAtMs: Date.now(), sets: [] } };
    render(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText('2 · TRAINING AGE: advanced'));
    expect(mockState.saveProfile).not.toHaveBeenCalled();
  });

  test('LOAD SELECTION chips remain disabled during active session', () => {
    mockState = {
      ...mockState,
      session: { sessionId: 10, date: '2026-07-15', startedAtMs: Date.now(), sets: [] },
      profile: { ...baseProfile, training_age: 'intermediate' },
      loadPreference: 'auto',
      saveLoadPreference: jest.fn(),
    };
    render(<ProfileScreen />);
    expect(screen.getByTestId('profile-load-pref-auto').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('profile-load-pref-manual').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Finish the active session before changing load selection.')).toBeOnTheScreen();
  });

  // R8 §2.4 — ChipRow is a permitted composition wrapper over the FROZEN Chip
  // primitive. These assertions prove the wrapper forwards real Chip
  // accessibility semantics for both a selected and an unselected option
  // (the Stepper assertions in UIComponents cover NumberRow's other half).
  test('ChipRow exposes shared Chip selected-state semantics for exactly one option', () => {
    const { getByRole } = render(<ProfileScreen />);

    // OBJECTIVES renders one chip per objective; 'hybrid' is baseProfile's value.
    const objectives = ['strength', 'hypertrophy', 'power', 'endurance', 'gpp', 'hybrid', 'rehab', 'weight_loss'];
    const selected = getByRole('button', { name: '1 · OBJECTIVE: hybrid' });
    expect(selected.props.accessibilityState.selected).toBe(true);

    const unselected = getByRole('button', { name: '1 · OBJECTIVE: strength' });
    expect(unselected.props.accessibilityState.selected).toBe(false);
    expect(unselected.props.accessibilityState.disabled).toBe(false);

    // Exactly ONE of the row's chips claims the selected state.
    const selectedCount = objectives.filter(
      (o) => getByRole('button', {
        name: `1 · OBJECTIVE: ${o.replace(/_/g, ' ')}`,
      }).props.accessibilityState.selected,
    ).length;
    expect(selectedCount).toBe(1);
  });

  test('TRAINING AGE ChipRow keeps shared semantics and disables every chip during a session', () => {
    mockState.session = { sessionId: 10, date: '2026-07-15', startedAtMs: Date.now(), sets: [] };
    const { getByRole } = render(<ProfileScreen />);

    for (const age of TRAINING_AGES) {
      const chip = getByRole('button', { name: `2 · TRAINING AGE: ${age}` });
      expect(chip.props.accessibilityState.disabled).toBe(true);
      expect(chip.props.accessibilityState.selected).toBe(age === 'intermediate');
    }
  });

  // --- W2: the seven-screen first-run contract (WO §2.1) ---------------------

  test('first-run flow is at most seven screens and combines days with minutes (WO 2.1)', () => {
    render(<OnboardingScreen />);
    expect(screen.getByLabelText('Step 1 of 7')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Next')); // goal
    fireEvent.press(screen.getByLabelText('Next')); // experience
    fireEvent.press(screen.getByLabelText('Next')); // logistics
    expect(screen.getByText('TRAINING DAYS PER WEEK')).toBeOnTheScreen();
    expect(screen.getByText('MINUTES IN A SESSION, TOPS')).toBeOnTheScreen();
    // The retired per-decision screens never appear anywhere in the flow.
    for (const retired of ['HOW HARD SHOULD HARD DAYS GET?', 'THE SCIENCE BITS', 'WHO PICKS THE WEIGHTS?', 'MAX SESSIONS IN ONE DAY', 'HOW LONG IS A SESSION?']) {
      expect(screen.queryByText(retired)).toBeNull();
    }
    fireEvent.press(screen.getByLabelText('Next')); // equipment
    // Round 2: NEXT is disabled on limitations until an explicit answer.
    fireEvent.press(screen.getByLabelText('Next')); // limits
    expect(screen.getByLabelText('Next')).toBeDisabled();
    fireEvent.press(screen.getByLabelText('No, nothing to note'));
    expect(screen.getByLabelText('Next')).not.toBeDisabled();
    fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByLabelText('Step 7 of 7')).toBeOnTheScreen();
  });

  test('limitations asks one explicit no/yes; yes reveals notes, no clears drafts, review discloses', () => {
    render(<OnboardingScreen />);
    advance(3); // -> logistics
    fireEvent.press(screen.getByLabelText('Next')); // equipment
    fireEvent.press(screen.getByLabelText('Next')); // limits
    expect(screen.queryByLabelText('Past injuries, one per line as region colon note')).toBeNull();
    fireEvent.press(screen.getByLabelText('Yes, let me add notes'));
    expect(screen.getByLabelText('Past injuries, one per line as region colon note')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('Past injuries, one per line as region colon note'), 'knee: old ACL');
    // "No" is an explicit clearing of the draft notes, not a silent skip.
    fireEvent.press(screen.getByLabelText('No, nothing to note'));
    expect(screen.queryByLabelText('Past injuries, one per line as region colon note')).toBeNull();
    fireEvent.press(screen.getByLabelText('Next')); // review
    expect(screen.getByTestId('onboarding-summary-limits-row').props.children.join(''))
      .toBe('LIMITATIONS — none noted');
  });

  test('nothing persists before Finish and back navigation keeps the draft', () => {
    mockState.completeOnboarding = jest.fn();
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByLabelText('Next')); // welcome -> goal
    fireEvent.press(screen.getByLabelText(/ALL-ROUND FITNESS/));
    fireEvent.press(screen.getByLabelText('Next')); // goal -> experience
    fireEvent.press(screen.getByLabelText(/SOME MILEAGE/));
    expect(mockState.completeOnboarding).not.toHaveBeenCalled();
    // Android/back navigation walks the DRAFT back a step, keeping answers.
    fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByText('WHAT ARE WE TRAINING FOR?')).toBeOnTheScreen();
    expect(screen.getByLabelText(/ALL-ROUND FITNESS/).props.accessibilityState.selected).toBe(true);
    expect(mockState.completeOnboarding).not.toHaveBeenCalled();
  });

  test('non-beginner load preference is visible and changeable on the review screen', () => {
    render(<OnboardingScreen />);
    advance(2);
    fireEvent.press(screen.getByLabelText(/SOME MILEAGE/));
    advanceAnsweringLimits(4, 2); // review
    expect(screen.getByTestId('onboarding-loads-step')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-loads-auto').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByTestId('onboarding-loads-manual'));
    expect(screen.getByTestId('onboarding-loads-manual').props.accessibilityState.selected).toBe(true);
    // Coach defaults are disclosed honestly with their later-editability.
    expect(screen.getByText(/EDIT ANYTIME IN ATHLETE \/ PROFILE/)).toBeOnTheScreen();
  });

  // --- W1 Red Test: Athlete/Profile Offline Glossary Sub-view (WO §7.2 Item 15) ---

  test('[Item 15] Athlete/Profile contains an entry point to open offline Glossary sub-view without a sixth root tab, and sub-view back returns without tab change', () => {
    const { getByRole, getByText } = render(
      <NavigationProvider initialTab="athlete">
        <ProfileScreen />
      </NavigationProvider>,
    );

    // ProfileScreen must contain an accessible button/row to open Glossary
    const glossaryButton = getByRole('button', { name: /glossary|terminology/i });
    expect(glossaryButton).toBeOnTheScreen();

    // Opening Glossary sub-view renders Glossary screen
    fireEvent.press(glossaryButton);
    expect(getByText(/GLOSSARY/i)).toBeOnTheScreen();

    // Closing Glossary via back button returns to Athlete Profile without tab change
    const backButton = getByRole('button', { name: /back to athlete/i });
    expect(backButton).toBeOnTheScreen();
    fireEvent.press(backButton);

    // ProfileScreen content is restored
    expect(getByText('ATHLETE PROFILE')).toBeOnTheScreen();
  });
});

// ---------------------------------------------------------------------------
// OW-001 load-intent declaration surface (audit W3/W4)
//
// Three defects this covers, all found by the stacked-PR audit against the
// first implementation of this section:
//   * it offered choices for movements the athlete cannot currently do, while
//     an authoritative athlete-facing availability contract already existed;
//   * it labelled the options with the internal vocabulary (DB / BB / KB);
//   * a failed save was completely silent, because ProfileScreen mounts no
//     error surface of its own — the same defect class as OW-007's resume path.
// ---------------------------------------------------------------------------
describe('OW-001 load-intent declaration surface', () => {
  const PUSH_UP = { movement_id: 41, name: 'Push-up', supportedPrefixes: ['Bodyweight', 'Banded'] };
  const SPLIT_SQUAT = { movement_id: 42, name: 'Bulgarian Split Squat', supportedPrefixes: ['Bodyweight', 'DB', 'BB'] };
  const BENCH = { movement_id: 43, name: 'Bench Press', supportedPrefixes: ['BB'] };
  const LOCKED = { movement_id: 44, name: 'Nordic Curl', supportedPrefixes: ['Bodyweight', 'Banded'] };

  let saveIntent;

  const setup = (overrides = {}) => {
    saveIntent = overrides.saveMovementLoadIntent ?? jest.fn(() => true);
    mockState = {
      ...mockState,
      movements: [PUSH_UP, SPLIT_SQUAT, BENCH, LOCKED],
      loadIntents: overrides.loadIntents ?? {},
      saveMovementLoadIntent: saveIntent,
      movementAvailabilityRevision: 0,
      niggles: [],
      // LOCKED is deliberately absent: the athlete cannot currently do it.
      getMovementAvailabilityVerdicts: jest.fn(() => [
        { movementId: PUSH_UP.movement_id, state: 'available' },
        { movementId: SPLIT_SQUAT.movement_id, state: 'available' },
        { movementId: BENCH.movement_id, state: 'available' },
        { movementId: LOCKED.movement_id, state: 'blocked' },
      ]),
    };
    render(<ProfileScreen />);
  };

  test('offers a choice only for AVAILABLE movements that genuinely have one', () => {
    setup();
    // Ambiguous and available.
    expect(screen.getByTestId(`load-intent-row-${PUSH_UP.movement_id}`)).toBeOnTheScreen();
    expect(screen.getByTestId(`load-intent-row-${SPLIT_SQUAT.movement_id}`)).toBeOnTheScreen();
    // Only one way to load it: nothing to choose.
    expect(screen.queryByTestId(`load-intent-row-${BENCH.movement_id}`)).toBeNull();
    // Ambiguous but the athlete cannot currently do it — offering it would ask
    // for a decision they cannot act on.
    expect(screen.queryByTestId(`load-intent-row-${LOCKED.movement_id}`)).toBeNull();
  });

  test('labels the options in words, never the internal DB/BB/KB vocabulary', () => {
    setup();
    expect(screen.getByTestId(`load-intent-${SPLIT_SQUAT.movement_id}-DB`)).toHaveTextContent('DUMBBELL');
    expect(screen.getByTestId(`load-intent-${SPLIT_SQUAT.movement_id}-BB`)).toHaveTextContent('BARBELL');
    expect(screen.getByTestId(`load-intent-${PUSH_UP.movement_id}-Banded`)).toHaveTextContent('BAND');
    // The stored value is still the canonical token — the testID proves the
    // mapping is presentation-only.
    expect(screen.queryByText('DB')).toBeNull();
    expect(screen.queryByText('BB')).toBeNull();
  });

  test('selected, unselected and NOT SET are distinguishable to a screen reader', () => {
    setup({ loadIntents: { [PUSH_UP.movement_id]: 'Bodyweight' } });
    // Read the prop directly: this RNTL build has no toHaveAccessibilityState.
    const stateOf = (id) => screen.getByTestId(id).props.accessibilityState;
    expect(stateOf(`load-intent-${PUSH_UP.movement_id}-Bodyweight`).selected).toBe(true);
    expect(stateOf(`load-intent-${PUSH_UP.movement_id}-Banded`).selected).toBe(false);
    expect(stateOf(`load-intent-${PUSH_UP.movement_id}-unset`).selected).toBe(false);
    // Every chip carries the role too, so the state is announced against one.
    expect(screen.getByTestId(`load-intent-${PUSH_UP.movement_id}-Bodyweight`).props.accessibilityRole)
      .toBe('button');
    // An undeclared movement reads as NOT SET, not as a silent bodyweight pick.
    expect(stateOf(`load-intent-${SPLIT_SQUAT.movement_id}-unset`).selected).toBe(true);
  });

  test('accessibility labels name the movement and the readable implement', () => {
    setup();
    expect(screen.getByLabelText('Plan Push-up with Bodyweight only')).toBeOnTheScreen();
    expect(screen.getByLabelText('Plan Bulgarian Split Squat with Dumbbell')).toBeOnTheScreen();
    expect(screen.getByLabelText('Leave Push-up unset, so it is planned with added weight')).toBeOnTheScreen();
  });

  test('copy says the choice applies to FUTURE programming and what unset means', () => {
    setup();
    expect(screen.getByText(/planned as the loaded version/i)).toBeOnTheScreen();
    expect(screen.getByText(/from now on/i)).toBeOnTheScreen();
  });

  test('a failed save is visible and actionable, and a later success clears it', () => {
    const failing = jest.fn(() => false);
    setup({ saveMovementLoadIntent: failing });
    expect(screen.queryByTestId('load-intent-error')).toBeNull();

    fireEvent.press(screen.getByTestId(`load-intent-${PUSH_UP.movement_id}-Bodyweight`));
    expect(failing).toHaveBeenCalledWith(PUSH_UP.movement_id, 'Bodyweight');
    // Before the audit fix this rendered nothing at all: the chip did not move
    // and the athlete was told nothing.
    expect(screen.getByTestId('load-intent-error'))
      .toHaveTextContent('Could not save your choice for Push-up. Try again.');

    failing.mockReturnValue(true);
    fireEvent.press(screen.getByTestId(`load-intent-${PUSH_UP.movement_id}-Banded`));
    expect(screen.queryByTestId('load-intent-error')).toBeNull();
  });

  test('choosing and clearing both reach the store with the canonical token', () => {
    setup();
    fireEvent.press(screen.getByTestId(`load-intent-${SPLIT_SQUAT.movement_id}-BB`));
    expect(saveIntent).toHaveBeenCalledWith(SPLIT_SQUAT.movement_id, 'BB');
    fireEvent.press(screen.getByTestId(`load-intent-${SPLIT_SQUAT.movement_id}-unset`));
    expect(saveIntent).toHaveBeenCalledWith(SPLIT_SQUAT.movement_id, null);
  });
});
