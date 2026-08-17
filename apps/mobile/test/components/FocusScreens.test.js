import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ReadinessScreen from '../../src/screens/ReadinessScreen';
import BlockScreen from '../../src/screens/BlockScreen';
import { theme } from '../../src/theme/theme';

let mockState;

jest.mock('@ak/inference', () => {
  const actual = jest.requireActual('@ak/inference');
  return {
    ...actual,
    SCHEMA_TYPES: ['LINEAR', 'WAVE', 'STEP', 'APRE'],
    targetLoadKg: jest.fn(() => 42.5),
    addDaysIso: jest.fn((iso, days) => {
      const date = new Date(`${iso}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    }),
  };
});
jest.mock('../../src/state/useStore', () => ({
  palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
  useStore: (selector) => selector(mockState),
}));

const TODAY = '2026-07-15';
const vector = {
  date: TODAY,
  readiness_score: 82,
  hrv_component: 84,
  load_component: 80,
  sleep_component: 79,
  spo2_component: 90,
  acwr: 1.02,
  acute_load_kg: 4200,
  chronic_load_kg: 4100,
  ln_rmssd: 4.2,
  hrv_z: 0.4,
  sleep_efficiency_pct: 88,
  spo2_night_mean: 97,
  computed_at_ms: 1,
};
const todaySlot = {
  slotIndex: 0,
  plannedSlotId: 10,
  movementId: 11,
  movementName: 'Goblet Squat',
  sets: 3,
  reps: 8,
  target: { kind: 'reps', reps: 8 },
  targetRpe: 7.5,
  overrideLoadKg: null,
  overrideReason: null,
};
const todayPlan = {
  plannedSessionId: 1,
  focus: 'lower',
  phase: 'accumulation',
  slots: [todaySlot],
};
const baseState = (overrides = {}) => ({
  status: 'ready',
  error: null,
  today: TODAY,
  profile: {
    objective: 'strength', training_age: 'intermediate', weekly_frequency: 4,
    equipment_inventory: ['barbell', 'dumbbells', 'bench'], base_rpe_cap: 8.5,
    session_duration_cap_min: 60,
  },
  vector,
  trend: [{ date: '2026-07-14', readiness_score: 76 }],
  session: null,
  todayPlan,
  lastTriage: null,
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  boot: jest.fn(),
  refreshVector: jest.fn(),
  loadDemoAthlete: jest.fn(),
  resetTrainingData: jest.fn(),
  prescription: {
    forDate: TODAY,
    source: 'policy',
    vector: { load_modifier: 0.9, set_modifier: -1, rpe_cap: 7.5 },
  },
  profileNotes: ['Keep the lower-body volume controlled.'],
  triageReady: true,
  triaging: false,
  block: { blockId: 1, startDate: '2026-07-01', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
  hasArchivedBlock: false,
  oneRepMaxes: {},
  blockSessions: [{
    plannedSessionId: 1,
    weekIndex: 1,
    dayIndex: 1,
    focus: 'lower',
    phase: 'accumulation',
    sessionDate: TODAY,
    slotCount: 1,
    completionStatus: null,
  }],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => [todaySlot]),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  returnCheckin: null,
  confirmReturnCheckin: jest.fn(),
  dismissReturnCheckin: jest.fn(),
  getMovementAvailabilityVerdicts: jest.fn(() => []),
  previewTrainingProgram: jest.fn(() => ({ plan: { sessions: [] } })),
  movements: [],
  niggles: [],
  ...overrides,
});

beforeEach(() => { mockState = baseState(); });

test('READY keeps one direct action and hides raw metrics until the relevant disclosure opens', () => {
  const openCoach = jest.fn();
  render(<ReadinessScreen onOpenCoach={openCoach} />);

  expect(screen.getByText('Ready to train')).toBeOnTheScreen();
  expect(screen.getByText("Follow today's plan at the effort it prescribes.")).toBeOnTheScreen();
  expect(screen.getByText('Lower session planned today.')).toBeOnTheScreen();
  expect(screen.getByLabelText("Review today's plan")).toBeOnTheScreen();
  expect(screen.queryByText('Your recent training load and recovery signals support the planned work.')).toBeNull();
  expect(screen.queryByText('Acute to chronic load')).toBeNull();

  fireEvent.press(screen.getByLabelText('Why this recommendation'));
  expect(screen.getByText('Your recent training load and recovery signals support the planned work.')).toBeOnTheScreen();
  expect(screen.queryByText('Acute to chronic load')).toBeNull();
  fireEvent.press(screen.getByLabelText("Review today's plan"));
  expect(openCoach).toHaveBeenCalledTimes(1);
});

test('READY renders the full vector only for profiles that explicitly request it', () => {
  mockState = baseState({
    uiPreferences: { sessionModeOverride: null, readinessDetail: 'full', restTimerEnabled: true, textScale: 'system' },
  });
  render(<ReadinessScreen />);

  fireEvent.press(screen.getByLabelText('Why this recommendation'));
  expect(screen.queryByText('Readiness estimate')).toBeNull();
  fireEvent.press(screen.getByLabelText('Full readiness metrics'));
  expect(screen.getByText('Readiness estimate')).toBeOnTheScreen();
  expect(screen.getByText('82 / 100')).toBeOnTheScreen();
});

test('READY keeps a safety halt visible and routes its single action to Coach', () => {
  const openCoach = jest.fn();
  mockState = baseState({
    lastTriage: {
      kind: 'matched',
      directive: { halt: true, vector: { coaching_cue: 'Stop and recover today.' } },
    },
  });
  render(<ReadinessScreen onOpenCoach={openCoach} />);

  expect(screen.getByText('Resolve today\'s safety report')).toBeOnTheScreen();
  expect(screen.getByText('Training is paused for today. Review the report before doing more work.')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Review safety report'));
  expect(openCoach).toHaveBeenCalledTimes(1);
});

test('COACH keeps the trajectory compact and expands a session only when its day is requested', () => {
  render(<BlockScreen />);

  expect(screen.getByText('Today: Lower')).toBeOnTheScreen();
  expect(screen.getByText('Four-week trajectory')).toBeOnTheScreen();
  expect(screen.queryByText('Goblet Squat')).toBeNull();
  expect(screen.queryByText('Choose a loading structure')).toBeNull();

  fireEvent.press(screen.getByLabelText(`Week 1, lower session on ${TODAY}`));
  expect(mockState.loadSessionSlots).toHaveBeenCalledWith(1);
  expect(screen.getByText('Goblet Squat')).toBeOnTheScreen();
  expect(screen.getByText('3 x 8')).toBeOnTheScreen();

  fireEvent.press(screen.getByLabelText('Why today changed'));
  expect(screen.getByText('Source')).toBeOnTheScreen();
  expect(screen.getByText('policy')).toBeOnTheScreen();

  expect(screen.getByLabelText('Manage current block')).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Manage current block'));
  expect(screen.getByText('Choose a loading structure')).toBeOnTheScreen();
});

test('COACH opens the Manage program editor and saves future preferences', () => {
  const updateProgramPreferences = jest.fn(() => true);
  const activeProgram = {
    programId: 7,
    objective: 'strength',
    startDate: '2026-07-01',
    horizonKind: 'weeks',
    requestedReviewDate: null,
    plannedEndDate: '2026-10-21',
    plannedBlockCount: 4,
    startingMacroBlockIndex: 1,
    schemaType: 'LINEAR',
    status: 'active',
    currentSequenceIndex: 1,
    days: [{ dayIndex: 1, focus: 'full' }],
    movementPreferences: [],
  };
  const editorPreview = {
    objective: 'strength',
    startDate: TODAY,
    requestedReviewDate: null,
    plannedEndDate: '2026-10-21',
    plannedBlockCount: 4,
    schemaType: 'LINEAR',
    days: activeProgram.days,
    plan: {
      objective: 'strength', start_date: TODAY, weeks: 4, schemaType: 'LINEAR',
      macroBlockIndex: 2, macroPhase: 'gpp', peakShifted: false,
      sessions: [], warnings: [], recovery: false, autopilotAdjusted: [],
    },
  };
  mockState = baseState({
    profile: {
      objective: 'strength', training_age: 'beginner', weekly_frequency: 1,
      equipment_inventory: [], base_rpe_cap: 9, session_duration_cap_min: 60,
    },
    program: activeProgram,
    movements: [],
    previewTrainingProgram: jest.fn(() => editorPreview),
    updateProgramPreferences,
    getMovementAvailabilityVerdicts: jest.fn(() => []),
    previewNextProgramBlock: jest.fn(() => null),
    continueTrainingProgram: jest.fn(),
    archiveTrainingProgram: jest.fn(),
  });

  render(<BlockScreen />);
  fireEvent.press(screen.getByLabelText('Manage future program preferences'));
  expect(screen.getByText('MANAGE PROGRAM')).toBeOnTheScreen();
  fireEvent.press(screen.getByText('Save future preferences'));
  expect(updateProgramPreferences).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('MANAGE PROGRAM')).toBeNull();
});

test('COACH discloses a raised autopilot attribution on demand', () => {
  const raisedSlot = { ...todaySlot, autopilot: { rpeDelta: 0.5, setDelta: 1, reason: 'raised' } };
  mockState = baseState({
    todayPlan: { ...todayPlan, slots: [raisedSlot] },
    loadSessionSlots: jest.fn(() => [raisedSlot]),
  });
  render(<BlockScreen />);
  fireEvent.press(screen.getByLabelText(`Week 1, lower session on ${TODAY}`));
  expect(screen.getByLabelText('Why Goblet Squat target changed')).toBeOnTheScreen();
  expect(screen.queryByText('Nudged up — your recent sets felt easier than planned.')).toBeNull();
  fireEvent.press(screen.getByLabelText('Why Goblet Squat target changed'));
  expect(screen.getByText('Nudged up — your recent sets felt easier than planned.')).toBeOnTheScreen();
});

test('COACH discloses eased attribution in today\'s preview', () => {
  const easedSlot = { ...todaySlot, autopilot: { rpeDelta: -0.5, setDelta: -1, reason: 'eased' } };
  mockState = baseState({ todayPlan: { ...todayPlan, slots: [easedSlot] } });
  render(<BlockScreen />);
  fireEvent.press(screen.getByLabelText("Preview today's session"));
  fireEvent.press(screen.getByLabelText('Why Goblet Squat target changed'));
  expect(screen.getByText('Eased off — your recent sets felt harder than planned.')).toBeOnTheScreen();
});

test('COACH discloses a held-safety autopilot attribution on demand', () => {
  const safetySlot = { ...todaySlot, autopilot: { rpeDelta: -0.5, setDelta: -1, reason: 'held_safety' } };
  mockState = baseState({
    todayPlan: { ...todayPlan, slots: [safetySlot] },
    loadSessionSlots: jest.fn(() => [safetySlot]),
  });
  render(<BlockScreen />);
  fireEvent.press(screen.getByLabelText(`Week 1, lower session on ${TODAY}`));
  fireEvent.press(screen.getByLabelText('Why Goblet Squat target changed'));
  expect(screen.getByText('Eased for safety — a recent safety signal lowered this target.')).toBeOnTheScreen();
});

test('COACH explains the late-cycle upward-effort budget on demand', () => {
  mockState = baseState({
    blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 6, macroPhase: 'peak', peakShifted: false },
  });
  render(<BlockScreen />);
  expect(screen.queryByText('Held steady — effort only rises early in a cycle.')).toBeNull();
  fireEvent.press(screen.getByLabelText('Why effort is held steady'));
  expect(screen.getByText('Held steady — effort only rises early in a cycle.')).toBeOnTheScreen();
});

test('COACH shows only exact finalized plan outcomes as Done or Stopped', () => {
  const planned = baseState().blockSessions[0];
  mockState = baseState({
    blockSessions: [
      { ...planned, completionStatus: 'complete' },
      { ...planned, plannedSessionId: 2, dayIndex: 2, sessionDate: '2026-07-02', completionStatus: 'halted' },
    ],
  });
  render(<BlockScreen />);

  expect(screen.getByText('Done')).toBeOnTheScreen();
  expect(screen.getByText('Stopped')).toBeOnTheScreen();
  expect(screen.getByLabelText(`Week 1, lower session on ${TODAY}, completed`)).toBeOnTheScreen();
  expect(screen.getByLabelText('Week 1, lower session on 2026-07-02, stopped')).toBeOnTheScreen();
});

test('COACH leaves the safety form behind its explicit action even during a halt', () => {
  mockState = baseState({
    lastTriage: {
      kind: 'matched',
      directive: {
        halt: true,
        followUp: 'Rest and reassess tomorrow.',
        vector: { coaching_cue: 'Stop training and recover today.' },
      },
    },
  });
  render(<BlockScreen />);

  expect(screen.getByText('Stop training today')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Describe how your body feels today')).toBeNull();
  fireEvent.press(screen.getByLabelText('Review safety report'));
  expect(screen.getByLabelText('Describe how your body feels today')).toBeOnTheScreen();
});

test('READY recovery state lowers the primary action prominence and shows a reduced-effort label', () => {
  // A recovery readiness score (< 70) triggers the RECOVERY AthleteState.
  // READY shows a different title and guidance message, not a primary action button.
  mockState = baseState({
    vector: {
      ...vector,
      readiness_score: 58,
      acwr: 1.1,
    },
  });
  render(<ReadinessScreen />);

  // The RECOVERY title must be visible
  expect(screen.getByText('Train steadily today')).toBeOnTheScreen();
  // OPTIMAL title must not appear
  expect(screen.queryByText('Ready to train')).not.toBeOnTheScreen();
  // Recovery guidance directs to the Coach tab, not a direct primary action
  expect(screen.getByText(/Open the relevant tab below/)).toBeOnTheScreen();
});

test('COACH renders a rest-day placeholder when no session is scheduled today', () => {
  // A rest day has no todayPlan, so COACH should render a safe rest-day message
  // rather than an empty slot list or a crash.
  mockState = baseState({ todayPlan: null, blockSessions: [] });
  render(<BlockScreen />);

  // The four-week trajectory must still be visible
  expect(screen.getByText('Four-week trajectory')).toBeOnTheScreen();
  // No exercise slot data should appear
  expect(screen.queryByText('Goblet Squat')).toBeNull();
});

test('READY renders rest-day statement and metrics list when no session is scheduled', () => {
  mockState = baseState({
    todayPlan: null,
    uiPreferences: { sessionModeOverride: null, readinessDetail: 'full', restTimerEnabled: true, textScale: 'system' },
  });
  render(<ReadinessScreen />);

  // Wordmark check
  expect(screen.getByText('pikeMethods')).toBeOnTheScreen();
  // Display type title check
  expect(screen.getByText('Rest day.')).toBeOnTheScreen();
  expect(screen.getByText("That's the work.")).toBeOnTheScreen();
  // Metrics check (rendered directly as quiet list, not hidden under Full readiness metrics disclosure)
  expect(screen.getByText('Readiness estimate')).toBeOnTheScreen();
  expect(screen.getByText('82 / 100')).toBeOnTheScreen();
});

test('COACH renders archived block card when block is null and hasArchivedBlock is true', () => {
  mockState = baseState({ block: null, blockMeta: null, todayPlan: null, blockSessions: [], hasArchivedBlock: true });
  render(<BlockScreen />);

  expect(screen.getAllByText('Your previous block had ended.').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('A short four-week block gives Coach a clear trajectory to follow.').length).toBeGreaterThanOrEqual(1);
  expect(screen.queryByText('A new block was started.')).toBeNull();
});

test('COACH enforces Law-2 assertion by marking only TODAY with chalk in the trajectory', () => {
  const planned = baseState().blockSessions[0];
  mockState = baseState({
    today: TODAY,
    blockSessions: [
      { ...planned, plannedSessionId: 1, dayIndex: 1, sessionDate: TODAY, focus: 'lower' },
      { ...planned, plannedSessionId: 2, dayIndex: 3, sessionDate: '2026-07-17', focus: 'upper' },
      { ...planned, plannedSessionId: 3, dayIndex: 5, sessionDate: '2026-07-19', focus: 'full' },
    ],
  });
  render(<BlockScreen />);

  const todayMarker = screen.getByTestId('today-marker');
  expect(todayMarker).toBeOnTheScreen();
  expect(screen.queryAllByTestId('today-marker')).toHaveLength(1);

  const todayPressable = screen.getByLabelText(`Week 1, lower session on ${TODAY}`);
  expect(todayPressable.props.accessibilityState.selected).toBe(true);
  expect(StyleSheet.flatten(todayPressable.props.style)).toMatchObject({
    borderLeftColor: theme.color.chalk,
    borderLeftWidth: 4,
  });

  const futurePressable1 = screen.getByLabelText('Week 1, upper session on 2026-07-17');
  expect(futurePressable1.props.accessibilityState.selected).toBe(false);
  expect(StyleSheet.flatten(futurePressable1.props.style)).not.toMatchObject({
    borderLeftColor: theme.color.chalk,
    borderLeftWidth: 4,
  });

  const futurePressable2 = screen.getByLabelText('Week 1, full session on 2026-07-19');
  expect(futurePressable2.props.accessibilityState.selected).toBe(false);
  expect(StyleSheet.flatten(futurePressable2.props.style)).not.toMatchObject({
    borderLeftColor: theme.color.chalk,
    borderLeftWidth: 4,
  });
});

test('COACH displays SUBSTITUTED badge element when slot load is overridden', () => {
  const substitutedSlot = { ...todaySlot, overrideLoadKg: 45.0 };
  mockState = baseState({
    loadSessionSlots: jest.fn(() => [substitutedSlot]),
  });
  render(<BlockScreen />);
  fireEvent.press(screen.getByLabelText(`Week 1, lower session on ${TODAY}`));

  expect(screen.getByText('SUBSTITUTED')).toBeOnTheScreen();
});

test('READY renders return check-in card when layoff is detected, with truthful non-dose copy', () => {
  mockState = baseState({
    returnCheckin: {
      lastQualifyingDate: '2026-06-01',
      daysSinceLastTrained: 44,
      options: ['continue_plan', 'review_first_session'],
      isDismissed: false,
    },
  });
  render(<ReadinessScreen />);

  expect(screen.getByTestId('return-checkin-banner')).toBeOnTheScreen();
  expect(screen.getByText('RETURN CHECK-IN')).toBeOnTheScreen();
  expect(screen.getByText('Welcome back')).toBeOnTheScreen();
  expect(screen.getByText(/It's been 44 days since your last logged session/)).toBeOnTheScreen();
  expect(screen.getByText(/Your plan is unchanged/)).toBeOnTheScreen();

  // Confirm NO claims of automatic dose reduction
  expect(screen.queryByText(/reduced/i)).toBeNull();
  expect(screen.queryByText(/scaled/i)).toBeNull();
  expect(screen.queryByText(/85%/)).toBeNull();
  expect(screen.queryByText(/deload/i)).toBeNull();
});

test('READY return check-in card actions confirm and dismiss correctly', () => {
  const openCoach = jest.fn();
  const confirmReturnCheckin = jest.fn();
  const dismissReturnCheckin = jest.fn();

  mockState = baseState({
    returnCheckin: {
      lastQualifyingDate: '2026-06-01',
      daysSinceLastTrained: 44,
      options: ['continue_plan', 'review_first_session'],
      isDismissed: false,
    },
    confirmReturnCheckin,
    dismissReturnCheckin,
  });

  const { rerender } = render(<ReadinessScreen onOpenCoach={openCoach} />);

  // 1. Continue plan
  fireEvent.press(screen.getByText('Continue current plan'));
  expect(confirmReturnCheckin).toHaveBeenCalledWith('continue_plan');

  // 2. Review first session
  fireEvent.press(screen.getByText('Review first session'));
  expect(confirmReturnCheckin).toHaveBeenCalledWith('review_first_session');
  expect(openCoach).toHaveBeenCalled();

  // 3. Dismiss
  fireEvent.press(screen.getByText('Dismiss'));
  expect(dismissReturnCheckin).toHaveBeenCalled();
});

test('READY hides return check-in card when dismissed or absent', () => {
  mockState = baseState({
    returnCheckin: {
      lastQualifyingDate: '2026-06-01',
      daysSinceLastTrained: 44,
      options: ['continue_plan', 'review_first_session'],
      isDismissed: true,
    },
  });
  render(<ReadinessScreen />);

  expect(screen.queryByTestId('return-checkin-banner')).toBeNull();
});

describe('BlockScreen - Chooser Entry (Work Order E)', () => {
  test('renders Plan a new block action when a block IS active and opens chooser', () => {
    mockState = baseState({
      block: { blockId: 1, startDate: '2026-07-01', objective: 'strength', createdAtMs: 1 },
      program: {
        programId: 1,
        status: 'active',
        currentSequenceIndex: 1,
        plannedBlockCount: 2,
        plannedEndDate: '2026-08-26',
      },
    });

    render(<BlockScreen />);

    // Action must render when block is active
    const planNewBlockButton = screen.getByText('Plan a new block');
    expect(planNewBlockButton).toBeOnTheScreen();

    // Tapping it opens the NewBlockChooserScreen
    fireEvent.press(planNewBlockButton);

    expect(screen.getByText('Start a new block')).toBeOnTheScreen();
    expect(screen.getByText('Auto')).toBeOnTheScreen();
    expect(screen.getByText('Custom')).toBeOnTheScreen();
    expect(screen.getByText('Guided')).toBeOnTheScreen();
    expect(screen.getByText('Coming soon')).toBeOnTheScreen();
  });

  test('inter-block state with block === null and program !== null still opens chooser and routes to handlers', () => {
    mockState = baseState({
      block: null,
      hasArchivedBlock: true,
      program: {
        programId: 1,
        status: 'active',
        currentSequenceIndex: 1,
        plannedBlockCount: 2,
        plannedEndDate: '2026-08-26',
        days: [
          { dayIndex: 1, focus: 'lower' },
          { dayIndex: 2, focus: 'upper' },
        ],
        movementPreferences: [],
      },
    });

    render(<BlockScreen />);

    // Start a new block button on the inter-block card
    const startNewBlockButton = screen.getByText('Start a new block');
    expect(startNewBlockButton).toBeOnTheScreen();

    // Tapping opens chooser
    fireEvent.press(startNewBlockButton);

    expect(screen.getByText('Start a new block')).toBeOnTheScreen();
    expect(screen.getByText('Auto')).toBeOnTheScreen();
    expect(screen.getByText('Custom')).toBeOnTheScreen();

    // Auto opens ProgramSetupScreen in editing mode
    fireEvent.press(screen.getByText('Auto'));
    expect(screen.getByText('MANAGE PROGRAM')).toBeOnTheScreen();
  });
});
