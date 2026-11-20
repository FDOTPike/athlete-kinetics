/**
 * SessionCompletionReport.test.js — "Something feels off" on the completion
 * screen (issue #180, step S5).
 *
 * The laws pinned here:
 *
 * 1. A CONTROL, NOT A ROUTE — the completion screen opens the same form the
 *    Plan screen uses, and Apply calls the same store action (reportSubjective)
 *    with the typed text and the chosen severity, exactly once. Nothing is sent
 *    on opening the form.
 * 2. THE SAME GATE AS THE PLAN SCREEN — with no readiness vector the form is
 *    not shown; the "Readiness is needed first" state is shown instead, with
 *    the same words BlockScreen uses, and nothing is sent.
 * 3. THE SAME COPY — the gated words and the form's labels are the words the
 *    Plan screen uses (a test reads BlockScreen.tsx to keep them in step).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SessionScreen from '../../src/screens/SessionScreen';
import { SubjectiveReportPanel } from '../../src/components/SubjectiveReportPanel';

jest.setTimeout(30_000);

let mockState;

jest.mock('../../src/state/useStore', () => {
  const useStoreImpl = (selector) => selector({ getTrainingSupportDecision: () => ({ status: 'available', holdIds: [] }), ...mockState });
  useStoreImpl.getState = () => mockState;
  useStoreImpl.setState = () => {};
  return {
    palette: { bg: '#000', surface: '#15151A', line: '#26262E', text: '#F4F4F6', dim: '#86868F', green: '#2EE6A8', amber: '#FFB454', red: '#FF5D5D' },
    useStore: useStoreImpl,
    formatTeachingOnlyReason: jest.fn(() => ''),
  };
});

jest.mock('@ak/inference', () => ({
  ...jest.requireActual('@ak/inference'),
  isDifficultyAllowed: jest.fn(() => true),
  effortCue: jest.fn(() => null),
  mapRirToRpe: jest.fn(() => 8),
}));

const source = (file) => fs.readFileSync(path.join(__dirname, '..', '..', 'src', file), 'utf8');

/** A readiness vector as the store holds it: present for today. */
const VECTOR = { date: '2026-11-06', load_modifier: 1, set_modifier: 1, rpe_cap: 10 };

const baseState = (overrides = {}) => ({
  movements: [],
  session: null,
  sessionPlan: [],
  activeSessionPlanSlotId: null,
  profile: { training_age: 'beginner', equipment_inventory: [], session_duration_cap_min: 60 },
  movementAvailabilityRevision: 0,
  activeSessionAccessContext: 'weight_room',
  niggles: [],
  oneRepMaxes: {},
  lastLoggedLoads: {},
  lastTriage: null,
  substitution: null,
  runner: null,
  sessionMode: null,
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  bandLadder: [],
  lastEndedSessionId: 42,
  loadSessionOutcome: jest.fn(() => ({ outcomeKind: 'followed_plan', finalizedAtMs: 1_757_000_000_000 })),
  loadSessionSummaryFacts: jest.fn(() => ({ durationMin: 38, exercises: [], previousSets: [] })),
  blockSessions: [],
  today: '2026-11-06',
  vector: VECTOR,
  status: 'ready',
  triaging: false,
  dismissOutcome: jest.fn(),
  getMovementAvailabilityVerdicts: () => [],
  // A session that went to plan: no feel question, so the completion view is the quiet one.
  loadSessionFeel: jest.fn(() => ({ ask: false, saved: null, note: null })),
  saveSessionFeel: jest.fn(() => null),
  saveSessionNote: jest.fn(),
  // The store resolves true only when it has stored the report (see useStore reportSubjective).
  reportSubjective: jest.fn(() => Promise.resolve(true)),
  ...overrides,
});

describe('completion screen: "Something feels off" opens the Plan screen form', () => {
  test('the control is on the completion screen and opening it sends nothing', () => {
    mockState = baseState();
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Something feels off'));
    expect(screen.getByTestId('completion-report-panel')).toBeOnTheScreen();
    expect(screen.getByLabelText('Describe how your body feels today')).toBeOnTheScreen();
    expect(mockState.reportSubjective).not.toHaveBeenCalled();
  });

  test('Apply calls the same store action the Plan form calls, once, with the typed text and severity', async () => {
    mockState = baseState();
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Something feels off'));
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'left knee sore when I squat');
    fireEvent.press(screen.getByLabelText('Severity 4 of 10'));
    await act(async () => { fireEvent.press(screen.getByLabelText('Apply report')); });
    expect(mockState.reportSubjective).toHaveBeenCalledTimes(1);
    expect(mockState.reportSubjective).toHaveBeenCalledWith('left knee sore when I squat', 4);
  });

  test('a report needs both text and a severity before Apply is enabled', () => {
    mockState = baseState();
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Something feels off'));
    fireEvent.press(screen.getByLabelText('Apply report'));
    expect(mockState.reportSubjective).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'knee');
    fireEvent.press(screen.getByLabelText('Apply report'));
    expect(mockState.reportSubjective).not.toHaveBeenCalled();
  });

  test('after Apply the store answer is shown on this screen', async () => {
    mockState = baseState({ lastTriage: { kind: 'rejected' }, reportSubjective: jest.fn(() => Promise.resolve(true)) });
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Something feels off'));
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'something odd');
    fireEvent.press(screen.getByLabelText('Severity 2 of 10'));
    await act(async () => { fireEvent.press(screen.getByLabelText('Apply report')); });
    await waitFor(() => expect(screen.getByText('No change')).toBeOnTheScreen());
    expect(mockState.reportSubjective).toHaveBeenCalledWith('something odd', 2);
  });

  test('a report the store does not take (it is not ready) is kept on screen and said not to be sent', async () => {
    mockState = baseState({ status: 'loading', reportSubjective: jest.fn(() => Promise.resolve(false)) });
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Something feels off'));
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'knee sore');
    fireEvent.press(screen.getByLabelText('Severity 3 of 10'));
    await act(async () => { fireEvent.press(screen.getByLabelText('Apply report')); });
    expect(mockState.reportSubjective).toHaveBeenCalledWith('knee sore', 3);
    expect(screen.getByTestId('completion-report-not-sent')).toHaveTextContent('Your report was not sent. It is still here, so you can try again.');
    expect(screen.getByLabelText('Describe how your body feels today').props.value).toBe('knee sore');
  });

  test('a store call that fails keeps the typed report on screen', async () => {
    mockState = baseState({ reportSubjective: jest.fn(() => Promise.reject(new Error('database closed'))) });
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Something feels off'));
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'knee sore');
    fireEvent.press(screen.getByLabelText('Severity 3 of 10'));
    await act(async () => { fireEvent.press(screen.getByLabelText('Apply report')); });
    expect(mockState.reportSubjective).toHaveBeenCalledWith('knee sore', 3);
    expect(screen.getByTestId('completion-report-not-sent')).toBeOnTheScreen();
    expect(screen.getByLabelText('Describe how your body feels today').props.value).toBe('knee sore');
  });

  test('closing the form returns to the completion screen without sending anything', () => {
    mockState = baseState();
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Something feels off'));
    fireEvent.press(screen.getByTestId('completion-report-close'));
    expect(screen.queryByTestId('completion-report-panel')).toBeNull();
    expect(screen.getByLabelText('Back to Today')).toBeOnTheScreen();
    expect(mockState.reportSubjective).not.toHaveBeenCalled();
  });
});

describe('completion screen: with no readiness vector the Plan screen gate applies', () => {
  test('a null vector shows "Readiness is needed first" and no form, and sends nothing', () => {
    mockState = baseState({ vector: null });
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Something feels off'));
    expect(screen.getByText('Readiness is needed first')).toBeOnTheScreen();
    expect(screen.getByText("Sync telemetry or load the demo athlete before asking Coach to adjust today's plan.")).toBeOnTheScreen();
    expect(screen.queryByLabelText('Describe how your body feels today')).toBeNull();
    expect(screen.queryByLabelText('Apply report')).toBeNull();
    expect(mockState.reportSubjective).not.toHaveBeenCalled();
  });

  test('a store with no vector field is gated the same way', () => {
    mockState = baseState({ vector: undefined });
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Something feels off'));
    expect(screen.getByText('Readiness is needed first')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Describe how your body feels today')).toBeNull();
    expect(mockState.reportSubjective).not.toHaveBeenCalled();
  });

  test('the gated state can be left, and the completion screen is still there', () => {
    mockState = baseState({ vector: null });
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Something feels off'));
    fireEvent.press(screen.getByTestId('completion-report-close'));
    expect(screen.getByLabelText('Back to Today')).toBeOnTheScreen();
  });
});

describe('the completion control uses the Plan screen words and the Plan screen gate', () => {
  test('the gated words and the form labels are the ones BlockScreen uses', () => {
    const block = source('screens/BlockScreen.tsx');
    const panel = source('components/SubjectiveReportPanel.tsx');
    for (const words of [
      'Readiness is needed first',
      "Sync telemetry or load the demo athlete before asking Coach to adjust today's plan.",
      'Describe how your body feels today',
      'Apply report',
      'Something feels off',
    ]) {
      expect(block).toContain(words);
      expect(panel).toContain(words);
    }
  });

  test('the completion view only hands the store action through; it adds no route and no decision', () => {
    const screenSource = source('screens/SessionScreen.tsx');
    expect(screenSource).toContain('reportSubjective');
    expect(screenSource).toContain('label="Something feels off"');
    const panel = source('components/SubjectiveReportPanel.tsx');
    expect(panel).toContain('onApply(');
    // The type-only import of TriageOutcome is erased; no runtime store access may appear.
    expect(panel).not.toMatch(/useStore\(|resolveReport|triage\(|embedder|saveSessionFeel|saveSessionNote/);
  });
});

describe('the form itself: what a stored or unstored answer shows', () => {
  const haltedMatch = {
    kind: 'matched',
    directive: { halt: true, vector: { coaching_cue: 'Stop training and see a clinician.' }, followUp: null },
  };

  test('an answer of false keeps the typed text and says the report was not sent', async () => {
    const onApply = jest.fn(() => Promise.resolve(false));
    render(<SubjectiveReportPanel hasVector lastTriage={null} triaging={false} triageReady onApply={onApply} onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'knee sore');
    fireEvent.press(screen.getByLabelText('Severity 3 of 10'));
    await act(async () => { fireEvent.press(screen.getByLabelText('Apply report')); });
    expect(onApply).toHaveBeenCalledWith('knee sore', 3);
    expect(screen.getByTestId('completion-report-not-sent')).toBeOnTheScreen();
    expect(screen.getByLabelText('Describe how your body feels today').props.value).toBe('knee sore');
  });

  test('an answer of true clears the text and shows the result', async () => {
    const onApply = jest.fn(() => Promise.resolve(true));
    render(<SubjectiveReportPanel hasVector lastTriage={{ kind: 'rejected' }} triaging={false} triageReady onApply={onApply} onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'something odd');
    fireEvent.press(screen.getByLabelText('Severity 2 of 10'));
    await act(async () => { fireEvent.press(screen.getByLabelText('Apply report')); });
    expect(screen.queryByTestId('completion-report-not-sent')).toBeNull();
    expect(screen.getByLabelText('Describe how your body feels today').props.value).toBe('');
    expect(screen.getByText('No change')).toBeOnTheScreen();
  });

  test('a second Apply while the first is pending sends nothing more, and the stored answer is not marked not sent', async () => {
    let settle;
    const onApply = jest.fn(() => new Promise((resolve) => { settle = resolve; }));
    render(<SubjectiveReportPanel hasVector lastTriage={{ kind: 'rejected' }} triaging={false} triageReady onApply={onApply} onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'knee sore');
    fireEvent.press(screen.getByLabelText('Severity 3 of 10'));
    const apply = screen.getByTestId('completion-report-apply');
    await act(async () => {
      fireEvent.press(apply);
      fireEvent.press(apply);
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    await act(async () => { settle(true); });
    expect(screen.queryByTestId('completion-report-not-sent')).toBeNull();
    expect(screen.getByText('No change')).toBeOnTheScreen();
  });

  test('a new report that is not sent does not keep the earlier result on screen', async () => {
    const answers = [true, false];
    const onApply = jest.fn(() => Promise.resolve(answers.shift()));
    render(<SubjectiveReportPanel hasVector lastTriage={{ kind: 'rejected' }} triaging={false} triageReady onApply={onApply} onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'first report');
    fireEvent.press(screen.getByLabelText('Severity 2 of 10'));
    await act(async () => { fireEvent.press(screen.getByLabelText('Apply report')); });
    expect(screen.getByText('No change')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'second report');
    fireEvent.press(screen.getByLabelText('Severity 4 of 10'));
    await act(async () => { fireEvent.press(screen.getByLabelText('Apply report')); });
    expect(onApply).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('completion-report-not-sent')).toBeOnTheScreen();
    expect(screen.queryByText('No change')).toBeNull();
    expect(screen.getByLabelText('Describe how your body feels today').props.value).toBe('second report');
  });

  test('without triage the Plan form caption is shown, with the same words', () => {
    const block = source('screens/BlockScreen.tsx');
    const caption = 'Semantic matching is unavailable in this build. Injury-language safety checks still apply.';
    expect(block).toContain(caption);
    render(<SubjectiveReportPanel hasVector lastTriage={null} triaging={false} triageReady={false} onApply={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText(caption)).toBeOnTheScreen();
  });

  test('a safety halt is shown once, and no result card repeats it', async () => {
    const onApply = jest.fn(() => Promise.resolve(true));
    render(<SubjectiveReportPanel hasVector lastTriage={haltedMatch} triaging={false} triageReady onApply={onApply} onClose={jest.fn()} />);
    expect(screen.getAllByText('Stop training today')).toHaveLength(1);
    fireEvent.changeText(screen.getByLabelText('Describe how your body feels today'), 'dizzy');
    fireEvent.press(screen.getByLabelText('Severity 8 of 10'));
    await act(async () => { fireEvent.press(screen.getByLabelText('Apply report')); });
    expect(screen.getAllByText('Stop training today')).toHaveLength(1);
    expect(screen.getAllByText('Stop training and see a clinician.')).toHaveLength(1);
    expect(screen.queryByText('Plan adjusted')).toBeNull();
  });

  test('the gate is the same without readiness, whatever the triage state', () => {
    render(<SubjectiveReportPanel hasVector={false} lastTriage={null} triaging={false} triageReady={false} onApply={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Readiness is needed first')).toBeOnTheScreen();
    expect(screen.queryByText('Semantic matching is unavailable in this build. Injury-language safety checks still apply.')).toBeNull();
  });
});

