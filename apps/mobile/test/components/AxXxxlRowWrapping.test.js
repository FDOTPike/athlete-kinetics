import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import BlockScreen from '../../src/screens/BlockScreen';
import LibraryScreenV2 from '../../src/screens/LibraryScreenV2';
import { Stepper } from '../../src/components/ui/Stepper';
import { theme } from '../../src/theme/theme';

let mockBlockState;
let mockLibraryState;

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

jest.mock('../../src/state/useStore', () => {
  const actual = jest.requireActual('../../src/state/useStore');
  return {
    ...actual,
    palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
    useStore: (selector) => selector(mockBlockState ?? mockLibraryState),
  };
});

const ancestorsOf = (node) => {
  const out = [];
  for (let n = node; n; n = n.parent) out.push(n);
  return out;
};

const sharedAncestor = (a, b) => {
  const inA = new Set(ancestorsOf(a));
  return ancestorsOf(b).find((n) => inA.has(n)) ?? null;
};

const TODAY = '2026-07-13';

const blockStoreState = () => ({
  status: 'ready',
  error: null,
  today: TODAY,
  activeAthleteId: 'default',
  activityLedger: {
    definitions: [], series: [], occurrences: [], completedLast28Days: 0,
    knownMinutesLast28Days: 0, completedWithUnknownDuration: 0,
    scheduledKnownMinutesPerWeek: 0, scheduledWithUnknownDuration: 0,
  },
  profile: {
    objective: 'strength', training_age: 'intermediate', weekly_frequency: 3,
    equipment_inventory: ['barbell', 'dumbbells', 'bench'], base_rpe_cap: 8.5,
    session_duration_cap_min: 60,
  },
  vector: {
    date: TODAY, readiness_score: 82, hrv_component: 84, load_component: 80,
    sleep_component: 79, spo2_component: 90, acwr: 1.02, acute_load_kg: 4200,
    chronic_load_kg: 4100, ln_rmssd: 4.2, hrv_z: 0.4, sleep_efficiency_pct: 88,
    spo2_night_mean: 97, computed_at_ms: 1,
  },
  trend: [],
  session: null,
  todayPlan: null,
  lastTriage: null,
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  boot: jest.fn(),
  refreshVector: jest.fn(),
  loadDemoAthlete: jest.fn(),
  resetTrainingData: jest.fn(),
  prescription: {
    forDate: TODAY,
    source: 'policy',
    vector: { load_modifier: 1.0, set_modifier: 0, rpe_cap: 8.5 },
  },
  profileNotes: [],
  triageReady: true,
  triaging: false,
  block: { blockId: 1, startDate: TODAY, objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
  hasArchivedBlock: false,
  oneRepMaxes: {},
  blockSessions: [
    { plannedSessionId: 1, weekIndex: 1, dayIndex: 1, focus: 'lower', phase: 'accumulation', sessionDate: '2026-07-13', slotCount: 1, completionStatus: null },
    { plannedSessionId: 2, weekIndex: 2, dayIndex: 3, focus: 'full', phase: 'intensification', sessionDate: '2026-07-22', slotCount: 1, completionStatus: null },
    { plannedSessionId: 3, weekIndex: 3, dayIndex: 1, focus: 'upper', phase: 'realization', sessionDate: '2026-07-27', slotCount: 1, completionStatus: null },
    { plannedSessionId: 4, weekIndex: 4, dayIndex: 1, focus: 'full', phase: 'deload', sessionDate: '2026-08-03', slotCount: 1, completionStatus: null },
  ],
  program: null,
  routineTemplates: [],
  pendingAutopilotAdjustments: [],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => []),
  reportSubjective: jest.fn(() => Promise.resolve()),
  startSession: jest.fn(),
  returnCheckin: null,
  confirmReturnCheckin: jest.fn(),
  dismissReturnCheckin: jest.fn(),
  getMovementAvailabilityVerdicts: jest.fn(() => []),
  getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }),
  movements: [],
  niggles: [],
});

const makeMovement = (id, name, pattern) => ({
  movement_id: id,
  name,
  baseName: name,
  pattern,
  is_compound: false,
  beginnerOk: true,
  loggingMode: 'reps',
  instructions: 'Move with control.',
  cues: 'Brace trunk.',
  media: null,
  targetMuscles: ['core'],
  coachingIntent: null,
  timePolicy: null,
  required: [],
  supportedPrefixes: ['Bodyweight'],
  difficulty: 'Beginner',
  preference: 0,
  progressionGroup: null,
  progressionRank: null,
  scope: 'full_body',
  sportTracking: false,
  implement: 'bodyweight',
});

describe('#381 AX XXXL row wrapping and dayMark horizontal padding', () => {
  beforeEach(() => {
    mockBlockState = null;
    mockLibraryState = null;
  });

  test('BlockScreen trajectory weekMeta/weekPhaseRow/weekPhase wrap and dayMark adds horizontal padding', () => {
    mockBlockState = blockStoreState();
    render(<BlockScreen />);

    const checks = [
      { week: 'Week 2', phase: 'Build strength', tip: 'What does BUILD STRENGTH mean?' },
      { week: 'Week 3', phase: 'Realise', tip: 'What does REALISE mean?' },
      { week: 'Week 4', phase: 'Deload', tip: 'What does DELOAD mean?' },
    ];

    for (const { week, phase, tip } of checks) {
      const weekEl = screen.getByText(week);
      const phaseEl = screen.getByText(phase);
      const tipEl = screen.getByLabelText(tip);

      const weekPhaseRow = sharedAncestor(phaseEl, tipEl);
      expect(weekPhaseRow).not.toBeNull();
      const weekMeta = sharedAncestor(weekEl, weekPhaseRow);
      expect(weekMeta).not.toBeNull();

      expect(StyleSheet.flatten(weekMeta.props.style)).toMatchObject({
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.space[1],
      });
      expect(StyleSheet.flatten(weekPhaseRow.props.style)).toMatchObject({
        flexDirection: 'row',
        flexWrap: 'wrap',
        flexShrink: 1,
      });
      expect(StyleSheet.flatten(phaseEl.props.style)).toMatchObject({
        flexShrink: 1,
      });
    }

    const fulMark = screen.getByLabelText('Week 2, full session on 2026-07-22');
    const fulStyle = StyleSheet.flatten(fulMark.props.style);
    expect(fulStyle.minWidth).toBeGreaterThanOrEqual(theme.touch.min);
    expect(fulStyle.paddingHorizontal).toBeGreaterThanOrEqual(theme.space[1]);
  });

  test('LibraryScreenV2 sectionHeader wraps and sectionHeaderTitle shrinks', () => {
    const movements = [
      makeMovement(1, 'Farmer Walk', 'carry'),
      makeMovement(2, 'Suitcase Carry', 'carry'),
      makeMovement(3, 'Pallof Press', 'rotation'),
      makeMovement(4, 'Dead Bug', 'rotation'),
    ];
    mockLibraryState = {
      movements,
      profile: {
        objective: 'strength',
        training_age: 'intermediate',
        weekly_frequency: 3,
        session_duration_cap_min: 60,
        base_rpe_cap: 8.5,
        equipment_inventory: [],
      },
      niggles: [],
      today: TODAY,
      activePriorExperienceMovementIds: [],
      movementAvailabilityRevision: 0,
      resolveGoalRung: jest.fn(() => null),
      getMovementAvailabilityVerdicts: jest.fn(() => movements.map((m) => ({
        movementId: m.movement_id,
        state: 'available',
        reasons: [],
        missingPrerequisites: [],
        priorExperienceConfirmed: false,
        confirmationWouldClear: false,
        separateAttestationRequired: false,
      }))),
      confirmMovementPriorExperience: jest.fn(() => true),
      revokeMovementPriorExperience: jest.fn(() => true),
      loadIntents: {},
      saveMovementLoadIntent: jest.fn(() => true),
      error: null,
    };

    render(<LibraryScreenV2 />);

    for (const titleText of ['Carry & Conditioning', 'Core & Trunk Stability']) {
      const titleEl = screen.getByText(titleText);
      const countEls = screen.getAllByText('2 movements');
      const header = countEls
        .map((c) => sharedAncestor(titleEl, c))
        .find((node) => node !== null && node.children?.some((ch) => ch === titleEl || ch.props?.children === titleText));
      expect(header).toBeDefined();

      expect(StyleSheet.flatten(header.props.style)).toMatchObject({
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.space[2],
      });
      expect(StyleSheet.flatten(titleEl.props.style)).toMatchObject({
        flexShrink: 1,
      });
    }
  });

  test('Stepper labelRow wraps centered within container width and label shrinks centered', () => {
    render(
      <Stepper
        label="6 · EFFORT CEILING"
        value="8.5"
        onDecrement={() => {}}
        onIncrement={() => {}}
        tip="RPE"
      />,
    );

    const labelEl = screen.getByText('6 · EFFORT CEILING');
    const tipEl = screen.getByLabelText('What does RPE mean?');
    const labelRow = sharedAncestor(labelEl, tipEl);
    expect(labelRow).not.toBeNull();

    expect(StyleSheet.flatten(labelRow.props.style)).toMatchObject({
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      maxWidth: '100%',
    });
    expect(StyleSheet.flatten(labelEl.props.style)).toMatchObject({
      flexShrink: 1,
      textAlign: 'center',
    });
  });
});
