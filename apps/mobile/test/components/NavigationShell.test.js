/**
 * NavigationShell.test.js — Astra UX Phase 1 W4 contracts.
 *
 * What is pinned here, and why the split matters:
 *
 * 1. THREE PRIMARY DESTINATIONS — exactly TODAY, PLAN, PROGRESS render as
 *    primary tabs. A label-only assertion would not survive a re-skin, so the
 *    tabs are asserted through their ROUTE identities (pressing a primary tab
 *    switches the shell to a specific internal route and renders that route's
 *    screen).
 * 2. ROUTE/ACTION IDENTITY — the shell wires TodayScreen's actions to the
 *    production navigation calls: "Start workout" calls the store's
 *    startSession() with no arguments and lands on the session surface;
 *    resume never starts a second session.
 * 3. REACHABILITY — Readiness, Session, Library, and Profile/settings remain
 *    reachable from the header controls; the Session control surfaces a
 *    live-workout marker when a persisted session exists.
 * 4. BACK BEHAVIOUR — the tab history root is 'today'; navigating away and
 *    back returns to it, and the history stack is empty (native exit) at the
 *    cold-start root.
 */
import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { NavigationProvider, useNavigation } from '../../src/navigation/navigation';
import AppShellTestHarness from '../../src/AppShellTestHarness';

function Probe({ onRef }) {
  const nav = useNavigation();
  onRef(nav);
  return null;
}

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

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });
jest.mock('../../src/inference/deviceEmbedder', () => ({
  tryCreateDeviceEmbedder: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@ak/biometrics', () => ({
  tryCreateHealthConnectBridge: jest.fn(() => Promise.resolve(null)),
}));
// Navigation tests begin after the central cold-start recovery authority has
// declared the data safe. BackupBootIntegration owns the fail-closed cases.
jest.mock('../../src/state/backupStore', () => {
  const safeBackupState = {
    startupSafe: true,
    status: 'idle',
    message: null,
    preview: null,
    lastSuccessfulBackupAt: null,
    initialize: jest.fn(() => Promise.resolve()),
    createBackup: jest.fn(),
    chooseRestore: jest.fn(),
    confirmRestore: jest.fn(),
    cancelRestore: jest.fn(),
  };
  const useBackupStore = (selector) => selector(safeBackupState);
  useBackupStore.getState = () => safeBackupState;
  return { useBackupStore };
});

const state = (overrides = {}) => ({
  status: 'ready',
  onboarded: true,
  error: null,
  session: null,
  block: { blockId: 1, startDate: '2026-07-13', objective: 'strength', createdAtMs: 1 },
  program: { programId: 1 },
  today: '2026-07-15',
  todayPlan: null,
  blockSessions: [],
  hasArchivedBlock: false,
  lastTriage: null,
  vector: null,
  profile: {
    training_age: 'intermediate', session_duration_cap_min: 60, base_rpe_cap: 8.5,
    injury_flags: [], mobility_limits: [], equipment_inventory: [],
  },
  movements: [],
  sessionPlan: [],
  bandLadder: [],
  runner: null,
  substitution: null,
  profileSlots: [],
  activeAthleteId: null,
  pendingAutopilotAdjustments: [],
  startSession: jest.fn(),
  refreshVector: jest.fn(),
  recordedDurationsForFocus: jest.fn(() => []),
  loadRecentOutcomes: jest.fn(() => []),
  loadMeasuredHistory: jest.fn(() => []),
  getMovementAvailabilityVerdicts: jest.fn(() => []),
  boot: jest.fn(),
  rolloverDay: jest.fn(),
  setEmbedder: jest.fn(),
  connectBiometrics: jest.fn(),
  syncBiometrics: jest.fn(),
  uiPreferences: { sessionModeOverride: null, readinessDetail: 'summary', restTimerEnabled: true, textScale: 'system' },
  ...overrides,
});

beforeEach(() => { mockState = state(); });

// ---------------------------------------------------------------------------
// Three primary destinations, asserted through route identity
// ---------------------------------------------------------------------------

describe('exactly Today, Plan and Progress are the primary destinations', () => {
  test('the shared shell actively resizes above the keyboard on both platforms', () => {
    render(<AppShellTestHarness />);
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior)
      .toBe(Platform.OS === 'ios' ? 'padding' : 'height');
  });

  test('the primary bar renders TODAY, PLAN, PROGRESS and nothing else', () => {
    render(<AppShellTestHarness />);
    expect(screen.getByTestId('tab-today')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-coach')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-progress')).toBeOnTheScreen();
    // No fourth primary exists: SESSION, LIBRARY, ATHLETE, READINESS are
    // header controls, not primary destinations.
    expect(screen.queryByTestId('tab-session')).toBeNull();
    expect(screen.queryByTestId('tab-library')).toBeNull();
    expect(screen.queryByTestId('tab-athlete')).toBeNull();
    expect(screen.queryByTestId('tab-readiness')).toBeNull();
  });

  test('pressing the PLAN tab switches to the coach route and renders the block surface', () => {
    render(<AppShellTestHarness />);
    fireEvent.press(screen.getByTestId('tab-coach'));
    expect(screen.getByTestId('coach-screen')).toBeOnTheScreen();
  });

  test('PR #13 review: PROGRESS never reads the database while it is still booting', () => {
    mockState = state({
      status: 'booting',
      loadMeasuredHistory: jest.fn(() => { throw new Error('kinetics db not booted'); }),
      loadRecentOutcomes: jest.fn(() => []),
    });
    render(<AppShellTestHarness />);
    fireEvent.press(screen.getByTestId('tab-progress'));
    expect(screen.queryByTestId('progress-screen')).toBeNull();
    expect(mockState.loadMeasuredHistory).not.toHaveBeenCalled();
    expect(mockState.loadRecentOutcomes).not.toHaveBeenCalled();
  });

  test('pressing the PROGRESS tab renders the read-only progress surface', () => {
    render(<AppShellTestHarness />);
    fireEvent.press(screen.getByTestId('tab-progress'));
    expect(screen.getByTestId('progress-screen')).toBeOnTheScreen();
    expect(mockState.loadRecentOutcomes).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Route/action identity: start, resume
// ---------------------------------------------------------------------------

describe('Today actions keep their production identity in the shell', () => {
  test('a planned day: the primary action calls startSession() and lands on the session surface', () => {
    mockState = state({
      todayPlan: { plannedSessionId: 1, focus: 'lower', slots: [{ plannedSlotId: 10, movementName: 'Back Squat', sets: 3, target: { kind: 'reps', reps: 8 } }] },
      blockSessions: [{ plannedSessionId: 1, weekIndex: 1, dayIndex: 1, focus: 'lower', sessionDate: '2026-07-15', slotCount: 1, completionStatus: null }],
    });
    // Sol R4 F5: success means the store created a session; Today navigates
    // only once one exists.
    mockState.startSession = jest.fn(() => {
      mockState.session = { sessionId: 8, date: '2026-07-15', startedAtMs: 1, sets: [] };
    });
    render(<AppShellTestHarness />);
    expect(screen.getByTestId('today-card-planned')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('today-primary-start'));
    expect(mockState.startSession).toHaveBeenCalledTimes(1);
    expect(mockState.startSession).toHaveBeenCalledWith();
    // The shell delivered the athlete to the session surface via the same
    // onOpenSession wiring the Coach start path uses.
    expect(screen.getByTestId('session-screen-shown')).toBeOnTheScreen();
  });

  test('an active session: the primary action resumes the SAME persisted session without starting a new one', () => {
    mockState = state({ session: { sessionId: 7, date: '2026-07-15', startedAtMs: 1, sets: [] } });
    render(<AppShellTestHarness />);
    expect(screen.getByTestId('today-card-active')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('today-primary-resume'));
    expect(mockState.startSession).not.toHaveBeenCalled();
    expect(screen.getByTestId('session-screen-shown')).toBeOnTheScreen();
  });
});

// ---------------------------------------------------------------------------
// Reachability of every non-primary surface
// ---------------------------------------------------------------------------

describe('Sol R4 F5: a refused start keeps the athlete on Today', () => {
  test('the store refuses (inaccessible planned movement): no WORKOUT surface, error visible', () => {
    mockState = state({
      todayPlan: { plannedSessionId: 1, focus: 'lower', slots: [{ plannedSlotId: 10, movementName: 'Back Squat', sets: 3, target: { kind: 'reps', reps: 8 } }] },
      blockSessions: [{ plannedSessionId: 1, weekIndex: 1, dayIndex: 1, focus: 'lower', sessionDate: '2026-07-15', slotCount: 1, completionStatus: null }],
    });
    mockState.startSession = jest.fn(() => {
      mockState.error = 'This plan contains a movement outside the current access boundary. Regenerate or edit it before starting.';
    });
    render(<AppShellTestHarness />);
    fireEvent.press(screen.getByTestId('today-primary-start'));
    expect(mockState.startSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('today-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('session-screen-shown')).toBeNull();
    expect(screen.queryByText('Ready when you are.')).toBeNull();
    expect(screen.getByText('This plan contains a movement outside the current access boundary. Regenerate or edit it before starting.')).toBeOnTheScreen();
  });
});

describe('Sol R4 F1: "Back to Today" actually returns to Today', () => {
  const outcomeState = () => state({
    session: null,
    lastEndedSessionId: 42,
    loadSessionOutcome: jest.fn(() => ({ outcomeKind: 'stopped_safely', finalizedAtMs: 1_757_548_800_000 })),
    loadSessionSummaryFacts: jest.fn(() => ({ durationMin: 12, exercises: [], previousSets: [] })),
    dismissOutcome: jest.fn(),
    endSession: jest.fn(),
  });

  test('pressing it dismisses once, lands on the Today surface, and leaves Today as the only history entry', () => {
    mockState = outcomeState();
    const seen = [];
    render(<AppShellTestHarness onBackState={(p) => seen.push(p)} />);
    fireEvent.press(screen.getByTestId('header-session'));
    expect(screen.getByTestId('session-screen-shown')).toBeOnTheScreen();
    expect(screen.getByText('Session stopped.')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Back to Today'));

    expect(screen.getByTestId('today-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('session-screen-shown')).toBeNull();
    // The idle WORKOUT copy Sol's device capture showed must not be what the athlete sees.
    expect(screen.queryByText('Ready when you are.')).toBeNull();
    expect(mockState.dismissOutcome).toHaveBeenCalledTimes(1);
    // Dismissal is not completion: no second write path is touched.
    expect(mockState.endSession).not.toHaveBeenCalled();
    expect(mockState.startSession).not.toHaveBeenCalled();
    // setTab('today') collapses history to the root, so Android back exits
    // instead of reopening the summary.
    expect(seen[seen.length - 1]).toBe(false);
  });
});

describe('Readiness, Session, Library and Profile remain reachable', () => {
  test('the header controls route to each preserved surface with descriptive accessible names', () => {
    render(<AppShellTestHarness />);
    expect(screen.getByLabelText('Open the exercise library')).toBeOnTheScreen();
    expect(screen.getByLabelText('Open profile and settings')).toBeOnTheScreen();
    expect(screen.getByLabelText('Open readiness details')).toBeOnTheScreen();
    expect(screen.getByLabelText('Open the workout')).toBeOnTheScreen();
    expect(screen.getByText('READY')).toBeOnTheScreen();
    expect(screen.getByText('WORKOUT')).toBeOnTheScreen();
    expect(screen.getByText('LIBRARY')).toBeOnTheScreen();
    expect(screen.getByText('PROFILE')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('header-library'));
    expect(screen.getByTestId('library-list')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('header-athlete'));
    expect(screen.getByTestId('athlete-screen-shown')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('header-readiness'));
    expect(screen.getByTestId('readiness-screen')).toBeOnTheScreen();
  });

  test('Session is reachable during an active workout, marked as in progress', () => {
    mockState = state({ session: { sessionId: 7, date: '2026-07-15', startedAtMs: 1, sets: [] } });
    render(<AppShellTestHarness />);
    expect(screen.getByLabelText('Open the workout — workout in progress')).toBeOnTheScreen();
    expect(screen.getByTestId('header-session-live-dot', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('WORKOUT')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('header-session'));
    expect(screen.getByTestId('session-screen-shown')).toBeOnTheScreen();
  });

  test('the live-workout marker is absent when no session is open', () => {
    render(<AppShellTestHarness />);
    // includeHiddenElements is REQUIRED: the dot is deliberately hidden from
    // the accessibility tree, so a default query cannot see it whether or not
    // it rendered — the assertion would be unfalsifiable without this.
    expect(
      screen.queryByTestId('header-session-live-dot', { includeHiddenElements: true }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cold start root and back behaviour
// ---------------------------------------------------------------------------

describe('cold start and back behaviour stay deterministic under the new shell', () => {
  test('cold start renders Today, not the old readiness root', () => {
    render(<AppShellTestHarness />);
    expect(screen.getByTestId('today-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('readiness-screen')).toBeNull();
  });

  test('R2: the top header precedes the body among real siblings of the shell root', () => {
    render(<AppShellTestHarness />);
    const root = screen.getByTestId('shell-root');
    const header = screen.getByTestId('shell-top-header');
    const body = screen.getByTestId('shell-body');
    const tabs = screen.getByTestId('shell-primary-tabs');

    // All four regions are on the screen.
    expect(header).toBeOnTheScreen();
    expect(body).toBeOnTheScreen();
    expect(tabs).toBeOnTheScreen();

    // Header, body and primary tab bar share the SAME host parent (the shell
    // root View). Queries return host elements whose direct .parent is a
    // composite wrapper, so walk to the nearest HOST ancestor and compare —
    // via failure-safe booleans, because a failing instance-identity
    // expectation makes Jest print a subtree dump (observed to exhaust the
    // heap on this tree size).
    const hostAncestorOf = (el) => {
      let cur = el.parent;
      while (cur && typeof cur.type !== 'string') cur = cur.parent;
      return cur;
    };
    const headerHost = hostAncestorOf(header);
    expect(headerHost?.props?.testID).toBe('shell-root');
    expect(hostAncestorOf(body) === headerHost && hostAncestorOf(tabs) === headerHost).toBe(true);

    // Sibling ORDER: the header must come BEFORE the body (a second bottom
    // bar would place it after). root.children order is render order.
    const childIds = root.children.map((c) => (typeof c === 'object' ? c?.props?.testID : null));
    const headerIdx = childIds.indexOf('shell-top-header');
    const bodyIdx = childIds.indexOf('shell-body');
    const tabsIdx = childIds.indexOf('shell-primary-tabs');
    expect(headerIdx).toBeGreaterThan(-1);
    expect(bodyIdx).toBeGreaterThan(-1);
    expect(tabsIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeLessThan(bodyIdx);
    // The primary tab bar is a bottom bar: it comes AFTER the body.
    expect(tabsIdx).toBeGreaterThan(bodyIdx);
  });

  test('R3: the shell root is a SafeAreaView, so iOS keeps its notch/home-indicator insets', () => {
    render(<AppShellTestHarness />);
    // `styles.root.paddingTop` uses statusBarPaddingTop, which returns 0 on any
    // non-Android platform (see UIComponents.test.js). SafeAreaView is therefore
    // the ONLY thing insetting the shell on iOS: without it the top header
    // renders under the status bar/notch and the primary tab bar under the home
    // indicator. This pins the element type so the root cannot be downgraded to
    // a plain View for test convenience — the sibling-order test above walks
    // HOST ancestors and passes either way, so nothing else would catch it.
    expect(screen.getByTestId('shell-root').type).toBe('RCTSafeAreaView');
  });

  test('R1: the workout header control states its accessibility name and transitions live', () => {
    // Inactive (no open session): plain descriptive label.
    mockState = state({ session: null });
    const { rerender } = render(<AppShellTestHarness />);
    expect(screen.getByLabelText('Open the workout')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Open the workout — workout in progress')).toBeNull();
    expect(screen.queryByText('● WORKOUT')).toBeNull();

    // Active (persisted session open): state-ful label + live region + badge.
    mockState = state({ session: { sessionId: 7, date: '2026-07-15', startedAtMs: 1, sets: [] } });
    rerender(<AppShellTestHarness />);
    expect(screen.getByLabelText('Open the workout — workout in progress')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Open the workout')).toBeNull();
    // The decorative dot exists but is hidden from accessibility (R1: it must
    // not be part of the accessible text or the a11y tree).
    expect(
      screen.getByTestId('header-session-live-dot', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('WORKOUT')).toBeOnTheScreen();

    // Back to inactive: the label reverts and the badge disappears.
    mockState = state({ session: null });
    rerender(<AppShellTestHarness />);
    expect(screen.getByLabelText('Open the workout')).toBeOnTheScreen();
    // Hidden-inclusive, for the same reason as above.
    expect(
      screen.queryByTestId('header-session-live-dot', { includeHiddenElements: true }),
    ).toBeNull();
  });

  test('after visiting Plan, the back stack holds [today, coach] — one pop to the root', () => {
    const seen = [];
    render(<AppShellTestHarness onBackState={(p) => seen.push(p)} />);
    expect(seen).toEqual([false]);
    fireEvent.press(screen.getByTestId('tab-coach'));
    expect(seen).toContain(true);
  });

  test('goBack pops the tab stack and reaches the root deterministically (provider law)', () => {
    let navRef = null;
    render(
      <NavigationProvider initialTab="today">
        <Probe onRef={(r) => { navRef = r; }} />
      </NavigationProvider>
    );
    expect(navRef.tab).toBe('today');
    act(() => { navRef.setTab('coach'); });
    expect(navRef.tab).toBe('coach');
    let handled = false;
    act(() => { handled = navRef.goBack(); });
    expect(handled).toBe(true);
    expect(navRef.tab).toBe('today');
    // At the root with an empty stack: back hands the event to the OS.
    act(() => { handled = navRef.goBack(); });
    expect(handled).toBe(false);
  });
});
