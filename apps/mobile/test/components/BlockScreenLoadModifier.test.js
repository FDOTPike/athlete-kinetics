import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { authorizeAthleteDataBoot, resetDataMaintenanceLockForTests } from '../../src/state/dataMaintenanceLock';
import { makeNodeSqliteDriver } from '../helpers/nodeSqliteOpDriver';

let mockDriver;

jest.mock('@op-engineering/op-sqlite', () => ({ open: () => mockDriver }));
jest.mock('../../src/state/athleteRegistry', () => {
  const core = jest.requireActual('../../src/state/athleteRegistryCore');
  return {
    loadRegistry: async () => ({
      version: 1,
      activeId: core.DEFAULT_ATHLETE_ID,
      advancedToolsUnlocked: false,
      athletes: [{ id: core.DEFAULT_ATHLETE_ID, name: 'Athlete 1', dbName: core.LEGACY_DB_NAME, createdAtMs: 0 }],
    }),
    saveRegistry: async () => undefined,
  };
});

let mockState = null;

jest.mock('../../src/state/useStore', () => {
  const actual = jest.requireActual('../../src/state/useStore');
  const selectorOrState = (selector) => {
    const source = mockState !== null ? mockState : actual.useStore.getState();
    return typeof selector === 'function' ? selector(source) : source;
  };
  return {
    ...actual,
    palette: {
      bg: '#000',
      surface: '#15151A',
      line: '#26262E',
      text: '#F4F4F6',
      dim: '#86868F',
      green: '#2EE6A8',
      amber: '#FFB454',
      red: '#FF5D5D',
    },
    useStore: Object.assign(selectorOrState, actual.useStore),
  };
});

import TodayScreen from '../../src/screens/TodayScreen';
import BlockScreen from '../../src/screens/BlockScreen';
import { useStore } from '../../src/state/useStore';

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
    objective: 'strength',
    training_age: 'intermediate',
    weekly_frequency: 4,
    equipment_inventory: ['barbell', 'dumbbell'],
    base_rpe_cap: 8.5,
    session_duration_cap_min: 60,
  },
  vector,
  prescription: {
    forDate: TODAY,
    state: 'OPTIMAL',
    source: 'policy',
    halt: false,
    vector: {
      load_modifier: 1.0,
      set_modifier: 0,
      rpe_cap: 8.5,
      coaching_cue: 'Readiness optimal — execute prescribed load.',
      profileNotes: [],
    },
  },
  lastTriage: null,
  profileNotes: [],
  niggles: [],
  movements: [
    {
      movement_id: 11,
      name: 'Goblet Squat',
      pattern: 'squat',
      primary_muscles: 'quads',
      equipment: 'dumbbell',
      fatigue_cost: 2,
      tier: 'beginner',
      is_bodyweight: 0,
      velocity_loss_pct: 20,
      preference: 0,
    },
  ],
  sessionPlan: [],
  activeMovementId: 11,
  activeSessionPlanSlotId: null,
  session: null,
  runner: null,
  sessionMode: null,
  uiPreferences: {
    sessionModeOverride: null,
    readinessDetail: 'headline',
    restTimerEnabled: true,
    textScale: 'system',
  },
  substitution: null,
  oneRepMaxes: { 11: 100 },
  apreOverrides: {},
  block: { blockId: 1, startDate: '2026-07-13', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'accumulation', peakShifted: false },
  hasArchivedBlock: false,
  blockSessions: [
    {
      plannedSessionId: 1,
      weekIndex: 1,
      dayIndex: 3,
      focus: 'lower',
      phase: 'accumulation',
      sessionDate: TODAY,
      slotCount: 1,
      completionStatus: null,
    },
  ],
  todayPlan,
  pendingAutopilotAdjustments: [],
  returnCheckin: null,
  suspension: null,
  program: null,
  nextBlockPreview: null,
  healthSupportRevision: 0,
  getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }),
  refreshVector: jest.fn(),
  computePrescription: jest.fn(),
  reportSubjective: jest.fn(),
  startSession: jest.fn(),
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => [todaySlot]),
  recordedDurationsForFocus: jest.fn(() => []),
  confirmReturnCheckin: jest.fn(),
  dismissReturnCheckin: jest.fn(),
  beginSuspension: jest.fn(),
  endSuspension: jest.fn(),
  ...overrides,
});

const settle = async () => {
  for (let n = 0; n < 8; n += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

beforeEach(() => {
  mockState = baseState();
});

test('non-halting pain restriction reaches BlockScreen session preview and TodayScreen workout card', () => {
  mockState = baseState({
    lastTriage: {
      kind: 'matched',
      directive: {
        ruleId: 'RED_FLAG_PAIN',
        similarity: 1,
        matchedAnchor: 'sharp pain',
        halt: false,
        followUp: 'Where exactly is it, and does it change during the movement?',
        vector: {
          load_modifier: 0.6,
          set_modifier: -1,
          rpe_cap: 6.0,
          coaching_cue: 'Pain noted: load drops 40%, 1 set removed, RPE capped at 6.0.',
        },
      },
    },
    prescription: {
      forDate: TODAY,
      state: 'OPTIMAL',
      source: 'guardrail',
      halt: false,
      vector: {
        load_modifier: 0.6,
        set_modifier: -1,
        rpe_cap: 6.0,
        coaching_cue: 'Pain noted: load drops 40%, 1 set removed, RPE capped at 6.0.',
        profileNotes: [],
      },
    },
  });

  const { unmount } = render(<BlockScreen />);
  fireEvent.press(screen.getByLabelText('Why today changed'));
  expect(screen.getByText('x0.60')).toBeOnTheScreen();
  expect(screen.getByText('-1')).toBeOnTheScreen();
  expect(screen.getByText('6.0')).toBeOnTheScreen();

  fireEvent.press(screen.getByLabelText("Preview today's session"));
  expect(screen.queryByText(/3 x 8 at RPE 7\.5/)).toBeNull();
  expect(screen.getByText(/2 x 8 at RPE 6\.0/)).toBeOnTheScreen();
  unmount();

  render(<TodayScreen />);
  expect(screen.queryByText('Goblet Squat · 3×8')).toBeNull();
  expect(screen.getByText('Goblet Squat · 2×8')).toBeOnTheScreen();
});

test('resolveSlotLoad reduces and rounds down history-based and APRE override loads when load_modifier is 0.7 and leaves them unchanged when load_modifier is 1', async () => {
  mockState = null;
  resetDataMaintenanceLockForTests();
  authorizeAthleteDataBoot();
  mockDriver = makeNodeSqliteDriver();
  useStore.setState({ status: 'booting', error: null, session: null, runner: null, triaging: false, lastTriage: null });
  useStore.getState().setEmbedder(null);
  useStore.getState().boot();
  await settle();
  expect(useStore.getState().status).toBe('ready');

  const today = useStore.getState().today;
  useStore.setState({
    profile: { ...useStore.getState().profile, training_age: 'intermediate' },
    loadPreference: 'auto',
    oneRepMaxes: {},
    lastLoggedLoads: { 11: 82.5 },
    prescription: {
      forDate: today,
      source: 'guardrail',
      vector: {
        load_modifier: 0.7,
        set_modifier: -1,
        rpe_cap: 7.0,
        coaching_cue: 'Reduced load today.',
      },
    },
  });

  // 82.5 * 0.7 = 57.75 -> rounded down to 2.5 kg increment is 57.5 kg
  const historyReducedAuto = useStore.getState().resolveSlotLoad({
    movementId: 11,
    bodyweightMode: false,
    targetReps: 8,
    targetRpe: 7.0,
    overrideLoadKg: null,
    sessionPlanSlotId: 1,
  });
  expect(historyReducedAuto).toEqual({
    source: 'history',
    initialLoadKg: 57.5,
    advisoryKg: null,
    advisoryKind: null,
  });

  // 95 * 0.7 = 66.5 -> rounded down to 2.5 kg increment is 65 kg
  const apreReducedAuto = useStore.getState().resolveSlotLoad({
    movementId: 11,
    bodyweightMode: false,
    targetReps: 8,
    targetRpe: 7.0,
    overrideLoadKg: 95,
    sessionPlanSlotId: 1,
  });
  expect(apreReducedAuto).toEqual({
    source: 'derived',
    initialLoadKg: 65,
    advisoryKg: null,
    advisoryKind: null,
  });

  // Manual preference advisory path also scales and rounds down
  useStore.setState({ loadPreference: 'manual' });
  const apreReducedManual = useStore.getState().resolveSlotLoad({
    movementId: 11,
    bodyweightMode: false,
    targetReps: 8,
    targetRpe: 7.0,
    overrideLoadKg: 95,
    sessionPlanSlotId: 1,
  });
  expect(apreReducedManual).toEqual({
    source: 'manual',
    initialLoadKg: null,
    advisoryKg: 65,
    advisoryKind: 'apre',
  });

  // With load_modifier === 1, both history and APRE override loads are unchanged
  useStore.setState({
    loadPreference: 'auto',
    prescription: {
      forDate: today,
      source: 'policy',
      vector: {
        load_modifier: 1,
        set_modifier: 0,
        rpe_cap: 8.5,
        coaching_cue: 'Execute prescribed load.',
      },
    },
  });

  const historyUnchanged = useStore.getState().resolveSlotLoad({
    movementId: 11,
    bodyweightMode: false,
    targetReps: 8,
    targetRpe: 7.5,
    overrideLoadKg: null,
    sessionPlanSlotId: 1,
  });
  expect(historyUnchanged).toEqual({
    source: 'history',
    initialLoadKg: 82.5,
    advisoryKg: null,
    advisoryKind: null,
  });

  const apreUnchanged = useStore.getState().resolveSlotLoad({
    movementId: 11,
    bodyweightMode: false,
    targetReps: 8,
    targetRpe: 7.5,
    overrideLoadKg: 95,
    sessionPlanSlotId: 1,
  });
  expect(apreUnchanged).toEqual({
    source: 'derived',
    initialLoadKg: 95,
    advisoryKg: null,
    advisoryKind: null,
  });
});
