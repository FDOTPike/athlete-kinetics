/**
 * BlockScreenReportNotSent.test.js — the Plan screen's "Something feels off" form
 * keeps a report the store did not take (follow-up to the completion-screen form).
 *
 * The laws pinned here:
 *
 * 1. A report the store does not take (reportSubjective resolves false, or rejects)
 *    stays in the text box, and the form says it was not sent, with the same words
 *    the completion-screen form uses.
 * 2. A report the store takes (reportSubjective resolves true) clears the text and
 *    the chosen severity, as before, and shows no "not sent" line.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import BlockScreen from '../../src/screens/BlockScreen';

jest.setTimeout(30_000);

const NOT_SENT = 'Your report was not sent. It is still here, so you can try again.';

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
  useStore: (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState }),
}));

const TODAY = '2026-11-06';
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

const baseState = (overrides = {}) => ({
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
  vector,
  trend: [{ date: '2026-11-05', readiness_score: 76 }],
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
  block: { blockId: 1, startDate: '2026-11-01', objective: 'strength', createdAtMs: 1 },
  blockMeta: { schemaType: 'LINEAR', macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false },
  hasArchivedBlock: false,
  oneRepMaxes: {},
  blockSessions: [{
    plannedSessionId: 1,
    weekIndex: 1,
    dayIndex: 1,
    focus: 'lower',
    phase: 'gpp',
    sessionDate: '2026-11-04',
    slotCount: 1,
    completionStatus: 'complete',
  }],
  program: null,
  routineTemplates: [],
  pendingAutopilotAdjustments: [],
  generateNewBlock: jest.fn(),
  loadSessionSlots: jest.fn(() => []),
  // The store resolves true only when it has stored the report (see useStore reportSubjective).
  reportSubjective: jest.fn(() => Promise.resolve(true)),
  startSession: jest.fn(),
  returnCheckin: null,
  confirmReturnCheckin: jest.fn(),
  dismissReturnCheckin: jest.fn(),
  getMovementAvailabilityVerdicts: jest.fn(() => []),
  previewTrainingProgram: jest.fn(() => null),
  previewNextProgramBlock: jest.fn(() => null),
  continueTrainingProgram: jest.fn(),
  archiveTrainingProgram: jest.fn(),
  movements: [],
  niggles: [],
  ...overrides,
});

/** Opens the Plan screen's "Something feels off" disclosure, types a report and a severity, and applies it. */
async function applyReport(text, severity) {
  fireEvent.press(screen.getByText('Something feels off'));
  fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), text);
  fireEvent.press(screen.getByLabelText(`Severity ${severity} of 10`));
  await act(async () => { fireEvent.press(screen.getByLabelText('Apply report')); });
}

describe('Plan screen "Something feels off": a report the store does not take is kept', () => {
  test('when reportSubjective resolves false, the text stays and the not-sent line shows', async () => {
    mockState = baseState({ reportSubjective: jest.fn(() => Promise.resolve(false)) });
    render(<BlockScreen />);
    await applyReport('knee sore', 3);
    expect(mockState.reportSubjective).toHaveBeenCalledWith('knee sore', 3);
    expect(screen.getByText(NOT_SENT)).toBeOnTheScreen();
    expect(screen.getByLabelText('Describe how your body feels today').props.value).toBe('knee sore');
    expect(screen.getByLabelText('Severity 3 of 10')).toBeSelected();
  });

  test('when reportSubjective rejects, the text stays and the not-sent line shows', async () => {
    mockState = baseState({ reportSubjective: jest.fn(() => Promise.reject(new Error('database closed'))) });
    render(<BlockScreen />);
    await applyReport('knee sore', 3);
    await waitFor(() => expect(screen.getByText(NOT_SENT)).toBeOnTheScreen());
    expect(screen.getByLabelText('Describe how your body feels today').props.value).toBe('knee sore');
  });

  test('a later stored report clears the not-sent line and the text', async () => {
    const reportSubjective = jest.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    mockState = baseState({ reportSubjective });
    render(<BlockScreen />);
    await applyReport('knee sore', 3);
    expect(screen.getByText(NOT_SENT)).toBeOnTheScreen();
    await act(async () => { fireEvent.press(screen.getByLabelText('Apply report')); });
    expect(screen.queryByText(NOT_SENT)).toBeNull();
    expect(screen.getByLabelText('Describe how your body feels today').props.value).toBe('');
  });
});

describe('Plan screen "Something feels off": a report the store takes clears as before', () => {
  test('when reportSubjective resolves true, the text and severity clear and no not-sent line shows', async () => {
    mockState = baseState({ reportSubjective: jest.fn(() => Promise.resolve(true)) });
    render(<BlockScreen />);
    await applyReport('knee sore', 3);
    expect(mockState.reportSubjective).toHaveBeenCalledWith('knee sore', 3);
    expect(screen.queryByText(NOT_SENT)).toBeNull();
    expect(screen.getByLabelText('Describe how your body feels today').props.value).toBe('');
    expect(screen.getByLabelText('Severity 3 of 10')).not.toBeSelected();
  });
});
