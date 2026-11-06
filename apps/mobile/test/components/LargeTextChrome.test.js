// Android walk 2026-11-03 (a11y-5), system font size 2.0:
// - the "i" of every info button was clipped inside its fixed 18 dp circle;
// - in Profile, a long heading pushed its info button off the screen.
// (The header and tab labels are covered in NavigationShell.test.js.)
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 412, height: 915, scale: 3, fontScale: mockFontScale }),
}));

let mockState;
jest.mock('../../src/state/useStore', () => ({
  localToday: () => '2026-08-11',
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', faint: '#55555C', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  formatTeachingOnlyReason: (verdict) => `Teaching only — ${verdict.reasons.join('; ')}`,
  useStore: (selector) => selector(mockState),
}));

const InfoTip = require('../../src/components/InfoTip').default;
const ProfileScreen = require('../../src/screens/ProfileScreen').default;

describe('info button glyph grows with the system font size', () => {
  test.each([[1, 18], [2, 36], [1.3, 23]])('font scale %s gives a %s dp circle', (scale, size) => {
    mockFontScale = scale;
    render(<InfoTip term="HRV" />);
    const icon = StyleSheet.flatten(screen.getByTestId('info-tip-icon').props.style);
    expect(icon.width).toBe(size);
    expect(icon.height).toBe(size);
    expect(icon.borderRadius).toBe(size / 2);
  });
});

describe('profile headings shrink before they push an info button off screen', () => {
  beforeEach(() => {
    mockFontScale = 2;
    mockState = {
      status: 'ready',
      profile: {
        objective: 'gpp', training_age: 'intermediate', weekly_frequency: 4, max_sessions_per_day: 1,
        session_duration_cap_min: 60, base_rpe_cap: 8.5, target_energy_system: 'hybrid',
        progression_methodology: 'autoregulated', injury_flags: [], mobility_limits: [],
        equipment_inventory: ['barbell', 'dumbbells', 'bench'],
      },
      saveProfile: jest.fn(),
      uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
      saveUiPreferences: jest.fn(),
      loadPreference: 'auto',
      loadPreferenceExplicit: false,
      saveLoadPreference: jest.fn(),
      loadIntents: {},
      saveMovementLoadIntent: jest.fn(() => true),
      getMovementAvailabilityVerdicts: jest.fn(() => []),
      movementAvailabilityRevision: 0,
      niggles: [],
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
      beginOnboardingDraft: () => ({ athleteId: 'default', contextRevision: 0 }),
      loadDemoAthlete: jest.fn(),
      loadRecentOutcomes: () => [],
    };
  });

  test.each([
    ['1 · OBJECTIVE', 'GPP'],
    ['7 · TARGET ENERGY SYSTEM', 'ATP-PC'],
  ])('the label "%s" may shrink beside its %s info button, and the button may not', (labelText, term) => {
    render(<ProfileScreen />);
    const label = screen.getByText(labelText);
    const tip = screen.getByLabelText(`What does ${term} mean?`);
    // Both sit in the same row: walk up from the label to the first row and
    // check the button is inside it.
    let row = label.parent;
    while (row && StyleSheet.flatten(row.props?.style ?? {}).flexDirection !== 'row') row = row.parent;
    expect(row).toBeTruthy();
    let inRow = false;
    for (let node = tip; node; node = node.parent) if (node === row) inRow = true;
    expect(inRow).toBe(true);
    expect(StyleSheet.flatten(label.props.style).flexShrink).toBe(1);
    expect(StyleSheet.flatten(tip.props.style).flexShrink).toBe(0);
  });

  // Issue 158, Manage athletes: at font scale 2.0 an athlete's name gets its own row,
  // so a long name such as "W1-BLANK1" is not broken inside a word beside RENAME and DELETE.
  test('at font scale 2.0 an athlete row stacks, so the name has the full width', () => {
    mockState.advancedToolsUnlocked = true;
    mockState.athletes = [
      { id: 'default', name: 'Default Athlete' },
      { id: 'a2', name: 'W1-BLANK1' },
    ];
    render(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText('Coach mode, 2 athletes, collapsed'));
    let row = screen.getByLabelText('Athlete W1-BLANK1, tap to switch');
    const flexOf = (node) => (typeof node.props.style === 'function' || !node.props.style ? undefined : StyleSheet.flatten(node.props.style).flexDirection);
    while (row && flexOf(row) === undefined) row = row.parent;
    expect(row).toBeTruthy();
    expect(StyleSheet.flatten(row.props.style).flexDirection).toBe('column');
  });
});
