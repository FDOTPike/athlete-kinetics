/**
 * SessionFeel.test.js — how a finished session went, and why (070).
 *
 * The laws pinned here:
 *
 * 1. A RECORD, NOT A DECISION — nothing on this path calls a plan, session,
 *    logging or progression action. Opening the panel writes nothing; only
 *    "Save" asks the store to save, exactly once.
 * 2. ASKED ONLY WHEN IT DID NOT GO TO PLAN — the completion screen shows the
 *    question only when the store says so. Otherwise there is one quiet action.
 * 3. TAPS, NOT TEXT — the answer is one of four choices; any choice but "as
 *    planned" needs a reason; the typed note is optional and is handed to the
 *    store exactly as typed.
 * 4. THE COMPLETION SCREEN NEVER DEPENDS ON IT — an absent or failing loader
 *    leaves the screen as it was, and "Back to Today" still dismisses once.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SessionScreen from '../../src/screens/SessionScreen';
import {
  SessionFeelPanel,
  describeSessionFeel,
  SESSION_FEEL_LABEL,
  SESSION_FEEL_REASON_LABEL,
} from '../../src/components/SessionFeelPanel';

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

const { validateSessionFeel, SESSION_FEEL_KINDS, SESSION_FEEL_REASONS } = jest.requireActual('@ak/inference');

/** Behaves as the store does: applies the real rule, saves nothing. */
const ruleOnly = () => jest.fn((draft) => {
  const checked = validateSessionFeel(draft);
  return checked.ok ? null : checked.problem;
});

// ---------------------------------------------------------------------------
// 1. The panel
// ---------------------------------------------------------------------------

describe('SessionFeelPanel: an answer by tapping', () => {
  test('every answer and every reason in the closed lists has a label', () => {
    expect(Object.keys(SESSION_FEEL_LABEL)).toEqual([...SESSION_FEEL_KINDS]);
    expect(Object.keys(SESSION_FEEL_REASON_LABEL)).toEqual([...SESSION_FEEL_REASONS]);
  });

  test('reasons stay hidden until an answer other than "as planned" is chosen', () => {
    render(<SessionFeelPanel saved={null} note={null} onSave={ruleOnly()} onClose={jest.fn()} />);
    expect(screen.queryByTestId('session-feel-reasons')).toBeNull();
    fireEvent.press(screen.getByTestId('session-feel-as_planned'));
    expect(screen.queryByTestId('session-feel-reasons')).toBeNull();
    fireEvent.press(screen.getByTestId('session-feel-harder'));
    expect(screen.getByTestId('session-feel-reasons')).toBeOnTheScreen();
  });

  test('saving with no answer says so and does not close', () => {
    const onSave = ruleOnly();
    const onClose = jest.fn();
    render(<SessionFeelPanel saved={null} note={null} onSave={onSave} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('session-feel-problem')).toHaveTextContent('Choose how the session went.');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('"harder" with no reason is refused; adding one saves and closes', () => {
    const onSave = ruleOnly();
    const onClose = jest.fn();
    render(<SessionFeelPanel saved={null} note={null} onSave={onSave} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('session-feel-harder'));
    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(screen.getByTestId('session-feel-problem')).toHaveTextContent('Choose at least one reason.');
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('session-feel-reason-unwell'));
    expect(screen.queryByTestId('session-feel-problem')).toBeNull();
    fireEvent.press(screen.getByTestId('session-feel-reason-tired'));
    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(onSave).toHaveBeenLastCalledWith({ feel: 'harder', reasons: ['unwell', 'tired'] }, '');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('a reason can be untapped again', () => {
    const onSave = ruleOnly();
    render(<SessionFeelPanel saved={null} note={null} onSave={onSave} onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('session-feel-easier'));
    fireEvent.press(screen.getByTestId('session-feel-reason-felt_good'));
    fireEvent.press(screen.getByTestId('session-feel-reason-other'));
    fireEvent.press(screen.getByTestId('session-feel-reason-other'));
    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(onSave).toHaveBeenLastCalledWith({ feel: 'easier', reasons: ['felt_good'] }, '');
  });

  test('the typed note is handed over exactly as typed, with no rewriting', () => {
    const onSave = ruleOnly();
    render(<SessionFeelPanel saved={null} note={null} onSave={onSave} onClose={jest.fn()} />);
    const typed = '  No chest pain today. Left knee: 3/10 on the last set??  ';
    fireEvent.press(screen.getByTestId('session-feel-as_planned'));
    fireEvent.changeText(screen.getByTestId('session-feel-note'), typed);
    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(onSave).toHaveBeenLastCalledWith({ feel: 'as_planned', reasons: [] }, typed);
  });

  test('a saved answer and note are shown for correction', () => {
    render(
      <SessionFeelPanel
        saved={{ feel: 'stopped_early', reasons: ['pain'] }}
        note="shoulder pinched on the press"
        onSave={ruleOnly()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByTestId('session-feel-stopped_early').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('session-feel-reason-pain').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('session-feel-reason-tired').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('session-feel-note').props.value).toBe('shoulder pinched on the press');
  });

  test('a failed save keeps the panel open and says the session itself is safe', () => {
    const onClose = jest.fn();
    render(<SessionFeelPanel saved={null} note={null} onSave={jest.fn(() => 'not_saved')} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('session-feel-as_planned'));
    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(screen.getByTestId('session-feel-problem')).toHaveTextContent('This could not be saved. Your session is still recorded.');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('cancel closes without asking to save', () => {
    const onSave = ruleOnly();
    const onClose = jest.fn();
    render(<SessionFeelPanel saved={null} note={null} onSave={onSave} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('session-feel-harder'));
    fireEvent.press(screen.getByTestId('session-feel-cancel'));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('the one-line description is plain and lists reasons in order', () => {
    expect(describeSessionFeel({ feel: 'as_planned', reasons: [] })).toBe('As planned.');
    expect(describeSessionFeel({ feel: 'harder', reasons: ['tired', 'unwell'] }))
      .toBe('Harder than planned: tired or slept badly, unwell.');
  });
});

// ---------------------------------------------------------------------------
// 2. The completion screen
// ---------------------------------------------------------------------------

const movement = (id, name) => ({
  movement_id: id, name, pattern: 'squat', difficulty: 'Beginner', beginnerOk: true,
  supportedPrefixes: ['Barbell'], joint_stress: {}, movement_id_is_bodyweight: undefined,
  targetMuscles: [], coachingIntent: '', timePolicy: null,
  media: { assetKey: `movement/test-${id}/demo/v1`, status: 'external_fallback', revision: 1, fallbackUrl: 'https://www.youtube.com/watch?v=test' },
});

const baseState = (overrides = {}) => ({
  movements: [movement(11, 'Goblet Squat')],
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
  loadSessionOutcome: jest.fn(() => ({ outcomeKind: 'adapted_session', finalizedAtMs: 1_757_000_000_000 })),
  loadSessionSummaryFacts: jest.fn(() => ({
    durationMin: 38,
    exercises: [{ movementId: 11, movementName: 'Goblet Squat', plannedSets: 3, sets: [{ reps: 8, loadKg: 24, timeS: null }] }],
    previousSets: [],
  })),
  blockSessions: [],
  today: '2026-10-09',
  startSession: jest.fn(),
  selectMovementSlot: jest.fn(),
  setMovementPreference: jest.fn(),
  openSubstitution: jest.fn(),
  closeSubstitution: jest.fn(),
  applyRegression: jest.fn(),
  applyDaySwap: jest.fn(),
  reportNiggle: jest.fn(),
  logSet: jest.fn(),
  editSet: jest.fn(),
  endSession: jest.fn(),
  dismissOutcome: jest.fn(),
  advanceRunnerRest: jest.fn(),
  skipRunnerRest: jest.fn(),
  setRunnerRestOverride: jest.fn(),
  runnerThumbsDown: jest.fn(),
  runnerHalt: jest.fn(),
  getMovementAvailabilityVerdicts: () => [],
  loadSessionFeel: jest.fn(() => ({ ask: true, saved: null, note: null })),
  saveSessionFeel: jest.fn(() => null),
  saveSessionNote: jest.fn(),
  ...overrides,
});

const trainingActions = ['startSession', 'logSet', 'editSet', 'endSession', 'applyRegression', 'applyDaySwap', 'reportNiggle', 'runnerHalt'];
const expectNoTrainingAction = () => {
  for (const action of trainingActions) expect(mockState[action]).not.toHaveBeenCalled();
};

describe('completion screen: asked only when the session did not go to plan', () => {
  test('a store with no session-feel loader leaves the completion screen unchanged', () => {
    mockState = baseState({ loadSessionFeel: undefined, saveSessionFeel: undefined });
    render(<SessionScreen />);
    expect(screen.getByLabelText('Back to Today')).toBeOnTheScreen();
    expect(screen.queryByTestId('session-feel-summary')).toBeNull();
  });

  test('a loader that throws leaves the completion screen unchanged', () => {
    mockState = baseState({ loadSessionFeel: jest.fn(() => { throw new Error('database closed'); }) });
    render(<SessionScreen />);
    expect(screen.getByLabelText('Back to Today')).toBeOnTheScreen();
    expect(screen.queryByTestId('session-feel-summary')).toBeNull();
  });

  test('a session that went to plan is not asked; one quiet action remains', () => {
    mockState = baseState({ loadSessionFeel: jest.fn(() => ({ ask: false, saved: null, note: null })) });
    render(<SessionScreen />);
    expect(screen.queryByTestId('session-feel-ask')).toBeNull();
    expect(screen.queryByTestId('session-feel-open')).toBeNull();
    expect(screen.getByTestId('session-feel-note-open')).toBeOnTheScreen();
    expect(mockState.loadSessionFeel).toHaveBeenCalledWith(42);
  });

  test('a session that did not go to plan shows the question; rendering it writes nothing', () => {
    mockState = baseState();
    render(<SessionScreen />);
    expect(screen.getByTestId('session-feel-ask')).toHaveTextContent('This session went differently from the plan.');
    expect(screen.getByTestId('session-feel-open')).toBeOnTheScreen();
    expect(mockState.saveSessionFeel).not.toHaveBeenCalled();
    expectNoTrainingAction();
  });

  test('opening the panel writes nothing; saving asks the store once and returns to the screen', () => {
    const loadSessionFeel = jest.fn()
      .mockReturnValueOnce({ ask: true, saved: null, note: null })
      .mockReturnValue({ ask: true, saved: { feel: 'harder', reasons: ['unwell'] }, note: 'felt rough' });
    mockState = baseState({ loadSessionFeel });
    render(<SessionScreen />);
    fireEvent.press(screen.getByTestId('session-feel-open'));
    expect(screen.getByTestId('session-feel-panel')).toBeOnTheScreen();
    expect(mockState.saveSessionFeel).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('session-feel-harder'));
    fireEvent.press(screen.getByTestId('session-feel-reason-unwell'));
    fireEvent.changeText(screen.getByTestId('session-feel-note'), 'felt rough');
    fireEvent.press(screen.getByTestId('session-feel-save'));

    expect(mockState.saveSessionFeel).toHaveBeenCalledTimes(1);
    expect(mockState.saveSessionFeel).toHaveBeenCalledWith({ feel: 'harder', reasons: ['unwell'] }, 'felt rough');
    expect(screen.queryByTestId('session-feel-panel')).toBeNull();
    expect(screen.getByTestId('session-feel-saved')).toHaveTextContent('How it went: Harder than planned: unwell.');
    expect(screen.getByText('Your note is saved with this session.')).toBeOnTheScreen();
    expect(screen.getByTestId('session-feel-change')).toBeOnTheScreen();
    expectNoTrainingAction();
    expect(mockState.dismissOutcome).not.toHaveBeenCalled();
  });

  test('a save the store refuses keeps the panel open', () => {
    mockState = baseState({ saveSessionFeel: jest.fn(() => 'not_saved') });
    render(<SessionScreen />);
    fireEvent.press(screen.getByTestId('session-feel-open'));
    fireEvent.press(screen.getByTestId('session-feel-as_planned'));
    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(screen.getByTestId('session-feel-panel')).toBeOnTheScreen();
    expect(screen.getByTestId('session-feel-problem')).toBeOnTheScreen();
  });

  test('cancelling the panel returns to the completion screen with nothing saved', () => {
    mockState = baseState();
    render(<SessionScreen />);
    fireEvent.press(screen.getByTestId('session-feel-open'));
    fireEvent.press(screen.getByTestId('session-feel-cancel'));
    expect(screen.getByLabelText('Back to Today')).toBeOnTheScreen();
    expect(mockState.saveSessionFeel).not.toHaveBeenCalled();
  });

  test('a session that went to plan can save a note on its own, with no answer', () => {
    const loadSessionFeel = jest.fn()
      .mockReturnValueOnce({ ask: false, saved: null, note: null })
      .mockReturnValue({ ask: false, saved: null, note: 'new shoes felt good' });
    mockState = baseState({ loadSessionFeel });
    render(<SessionScreen />);
    fireEvent.press(screen.getByTestId('session-feel-note-open'));
    expect(screen.getByTestId('session-feel-optional')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId('session-feel-note'), '  new shoes felt good  ');
    fireEvent.press(screen.getByTestId('session-feel-save'));

    expect(mockState.saveSessionNote).toHaveBeenCalledTimes(1);
    expect(mockState.saveSessionNote).toHaveBeenCalledWith('  new shoes felt good  ');
    expect(mockState.saveSessionFeel).not.toHaveBeenCalled();
    expect(screen.queryByTestId('session-feel-panel')).toBeNull();
    expect(screen.getByTestId('session-feel-note-saved')).toHaveTextContent('Your note is saved with this session.');
    expect(screen.getByLabelText('Edit the note about this session')).toBeOnTheScreen();
    expectNoTrainingAction();
  });

  test('when the answer is optional, saving nothing at all says so and writes nothing', () => {
    mockState = baseState({ loadSessionFeel: jest.fn(() => ({ ask: false, saved: null, note: null })) });
    render(<SessionScreen />);
    fireEvent.press(screen.getByTestId('session-feel-note-open'));
    fireEvent.changeText(screen.getByTestId('session-feel-note'), '   ');
    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(screen.getByTestId('session-feel-problem')).toHaveTextContent('Type a note, or choose how the session went.');
    expect(mockState.saveSessionNote).not.toHaveBeenCalled();
    expect(mockState.saveSessionFeel).not.toHaveBeenCalled();
  });

  test('when the answer is optional, choosing one still saves it as an answer', () => {
    mockState = baseState({ loadSessionFeel: jest.fn(() => ({ ask: false, saved: null, note: null })) });
    render(<SessionScreen />);
    fireEvent.press(screen.getByTestId('session-feel-note-open'));
    fireEvent.press(screen.getByTestId('session-feel-as_planned'));
    fireEvent.changeText(screen.getByTestId('session-feel-note'), 'steady');
    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(mockState.saveSessionFeel).toHaveBeenCalledWith({ feel: 'as_planned', reasons: [] }, 'steady');
    expect(mockState.saveSessionNote).not.toHaveBeenCalled();
  });

  test('a session that did not go to plan cannot be saved with a note alone', () => {
    mockState = baseState({ saveSessionFeel: jest.fn(() => 'feel_required') });
    render(<SessionScreen />);
    fireEvent.press(screen.getByTestId('session-feel-open'));
    expect(screen.queryByTestId('session-feel-optional')).toBeNull();
    fireEvent.changeText(screen.getByTestId('session-feel-note'), 'felt rough');
    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(mockState.saveSessionFeel).toHaveBeenCalledWith({ feel: null, reasons: [] }, 'felt rough');
    expect(mockState.saveSessionNote).not.toHaveBeenCalled();
    expect(screen.getByTestId('session-feel-problem')).toHaveTextContent('Choose how the session went.');
  });

  test('a note-only save that fails keeps the panel open', () => {
    mockState = baseState({
      loadSessionFeel: jest.fn(() => ({ ask: false, saved: null, note: null })),
      saveSessionNote: jest.fn(() => { throw new Error('database closed'); }),
    });
    render(<SessionScreen />);
    fireEvent.press(screen.getByTestId('session-feel-note-open'));
    fireEvent.changeText(screen.getByTestId('session-feel-note'), 'a note');
    fireEvent.press(screen.getByTestId('session-feel-save'));
    expect(screen.getByTestId('session-feel-panel')).toBeOnTheScreen();
    expect(screen.getByTestId('session-feel-problem')).toHaveTextContent('This could not be saved. Your session is still recorded.');
  });

  test('"Back to Today" still dismisses exactly once and never saves an answer', () => {
    mockState = baseState();
    render(<SessionScreen />);
    fireEvent.press(screen.getByLabelText('Back to Today'));
    expect(mockState.dismissOutcome).toHaveBeenCalledTimes(1);
    expect(mockState.saveSessionFeel).not.toHaveBeenCalled();
    expectNoTrainingAction();
  });
});
