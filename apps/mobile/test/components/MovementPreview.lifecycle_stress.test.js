/**
 * WO-09 Milestone 6 Adversarial Lifecycle & Mutual Exclusion Stress Test Suite
 *
 * Authored by challenger_m6_3 (M6 Lifecycle Mutual Exclusion Challenger)
 * Independent empirical stress tests targeting:
 * 1. Mutual exclusion & bidirectional preemption (Player A <-> Player B <-> Player C)
 * 2. Try/catch error resilience: thrown exceptions during stop handling
 * 3. Single-cycle cadence: final frame halt, REPLAY button, restart at frame 0, mid-cycle hold & resume
 * 4. Unmount & AppState background lifecycle: active cancellation, leak prevention, no auto-resume
 * 5. Rapid debounce & tap race conditions: burst pressing, interleaved preemption storms
 */
import React from 'react';
import { AccessibilityInfo, AppState, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { MovementPreview, PREVIEW_LAYOUT } from '../../src/components/movementPreview';
import * as manifestModule from '../../src/components/movementPreview/manifest';
import {
  claimPreviewPlayback,
  releasePreviewPlayback,
  resetPreviewPlayback,
  isPlaybackActive,
} from '../../src/components/movementPreview/playbackCoordinator';
import { theme } from '../../src/theme/theme';

// R2 Part C loads one family per shown movement; this suite builds its fixtures
// from the first entry, so it loads every family once here.
const PREVIEW_ENTRIES = manifestModule.previewEntries();

// Hypothetical-approval fixtures: these three prototype subjects stand in for
// what an APPROVED movement's subject will look like (DB media `ready`). The
// resolver wrapper below passes the labelled review fixture for them ONLY;
// every other subject keeps failing closed through the real resolver while
// the manifest's qualified review is pending (see MovementPreview.approval).
const SQUAT = {
  movement_id: 28,
  name: 'Bodyweight Squat',
  media: { assetKey: 'movement/bodyweight-squat/demo/v1', status: 'ready', revision: 1, fallbackUrl: null },
};

const PUSH_UP = {
  movement_id: 16,
  name: 'Push-up',
  media: { assetKey: 'movement/push-up/demo/v1', status: 'ready', revision: 1, fallbackUrl: null },
};

const RDL = {
  movement_id: 88,
  name: 'Dumbbell Romanian Deadlift',
  media: { assetKey: 'movement/dumbbell-romanian-deadlift/demo/v1', status: 'ready', revision: 1, fallbackUrl: null },
};

const REAL_RESOLVE = manifestModule.resolveMovementPreview;
const APPROVED_REVIEW_FIXTURE = { status: 'complete', detail: 'Hypothetical approval fixture — not a real signoff.' };

beforeEach(() => {
  jest.spyOn(manifestModule, 'resolveMovementPreview').mockImplementation(
    (subject, review) => REAL_RESOLVE(
      subject,
      subject?.media?.status === 'ready' ? APPROVED_REVIEW_FIXTURE : review,
    ),
  );
});

// Synthetic 5-frame movement fixture with asymmetric segment durations
const FIVE_FRAME_FIXTURE = {
  movement_id: 8888,
  name: 'Synthetic 5-Frame Stress Fixture',
  media: { assetKey: 'movement/synthetic-5frame-stress/demo/v1', status: 'covered', revision: 1, fallbackUrl: null },
};

const FIVE_FRAME_ENTRY = {
  movementId: 8888,
  assetKey: 'movement/synthetic-5frame-stress/demo/v1',
  name: 'Synthetic 5-Frame Stress Fixture',
  pattern: 'squat',
  previewId: 'synthetic_5frame_stress',
  implement: null,
  summary: 'Adversarial 5-frame stress preview.',
  status: 'covered',
  segmentDurationsMs: [500, 450, 450, 500],
  frames: [
    { id: 'frame_1', step: 1, title: 'Top', caption: 'Starting setup position', joints: PREVIEW_ENTRIES[0].frames[0].joints },
    { id: 'frame_2', step: 2, title: 'Descent', caption: 'Midway descending inflection', joints: PREVIEW_ENTRIES[0].frames[1].joints },
    { id: 'frame_3', step: 3, title: 'Bottom', caption: 'Full inflection depth', joints: PREVIEW_ENTRIES[0].frames[2].joints },
    { id: 'frame_4', step: 4, title: 'Ascent', caption: 'Midway ascending recovery', joints: PREVIEW_ENTRIES[0].frames[1].joints },
    { id: 'frame_5', step: 5, title: 'Lockout', caption: 'Final completed lockout position', joints: PREVIEW_ENTRIES[0].frames[0].joints },
  ],
};

function intervalProbe() {
  const started = jest.spyOn(global, 'setInterval');
  const cleared = jest.spyOn(global, 'clearInterval');
  return () => {
    const stopped = new Set(cleared.mock.calls.map((call) => call[0]));
    return started.mock.results.map((result) => result.value).filter((id) => !stopped.has(id)).length;
  };
}

async function renderPreview(element, { reduceMotion = false } = {}) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  const utils = render(element);
  await act(async () => {});
  return utils;
}

beforeEach(() => {
  resetPreviewPlayback();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. MUTUAL EXCLUSION & BIDIRECTIONAL PREEMPTION
// ─────────────────────────────────────────────────────────────────────────────

describe('Challenger Stress 1: Mutual Exclusion & Reverse Preemption', () => {
  test('rigorous bidirectional handoff: Player A -> Player B -> Player A -> Player B', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    await renderPreview(
      <View>
        <MovementPreview movement={SQUAT} testID="player-a" />
        <MovementPreview movement={PUSH_UP} testID="player-b" />
      </View>
    );

    const controlA = within(screen.getByTestId('player-a')).getByTestId('movement-preview-control');
    const controlB = within(screen.getByTestId('player-b')).getByTestId('movement-preview-control');
    const posA = within(screen.getByTestId('player-a')).getByTestId('movement-preview-position');
    const posB = within(screen.getByTestId('player-b')).getByTestId('movement-preview-position');

    // Step 1: Start Player A
    fireEvent.press(controlA);
    expect(isPlaybackActive()).toBe(true);
    expect(liveIntervals()).toBe(1);
    expect(controlA.props.accessibilityState.selected).toBe(true);
    expect(controlB.props.accessibilityState.selected).toBe(false);

    // Advance Player A to frame 2
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(posA).toHaveTextContent('Position 2 of 3');
    expect(posB).toHaveTextContent('Position 1 of 3');

    // Step 2: Player B preempts Player A
    fireEvent.press(controlB);
    expect(isPlaybackActive()).toBe(true);
    expect(liveIntervals()).toBe(1);
    expect(controlA.props.accessibilityState.selected).toBe(false);
    expect(controlB.props.accessibilityState.selected).toBe(true);

    // Advance time: Player B advances to frame 2; Player A remains frozen at frame 2
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(posA).toHaveTextContent('Position 2 of 3');
    expect(posB).toHaveTextContent('Position 2 of 3');

    // Step 3: Reverse mutual exclusion: Player A reclaims playback
    fireEvent.press(controlA);
    expect(isPlaybackActive()).toBe(true);
    expect(liveIntervals()).toBe(1);
    expect(controlA.props.accessibilityState.selected).toBe(true);
    expect(controlB.props.accessibilityState.selected).toBe(false);

    // Player A resumes from frame 2 -> advances to frame 3; Player B holds at frame 2
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(posA).toHaveTextContent('Position 3 of 3');
    expect(posB).toHaveTextContent('Position 2 of 3');

    // Step 4: Player B reclaims playback again
    fireEvent.press(controlB);
    expect(isPlaybackActive()).toBe(true);
    expect(liveIntervals()).toBe(1);
    expect(controlA.props.accessibilityState.selected).toBe(false);
    expect(controlB.props.accessibilityState.selected).toBe(true);

    // Player B resumes from frame 2 -> advances to frame 3; Player A holds at frame 3
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(posA).toHaveTextContent('Position 3 of 3');
    expect(posB).toHaveTextContent('Position 3 of 3');

    // Step 5: Stop Player B explicitly
    fireEvent.press(controlB);
    expect(isPlaybackActive()).toBe(false);
    expect(liveIntervals()).toBe(0);
    expect(controlA.props.accessibilityState.selected).toBe(false);
    expect(controlB.props.accessibilityState.selected).toBe(false);
  });

  test('three-way circular preemption storm: A -> B -> C -> A -> C -> B with exact timer invariant', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    await renderPreview(
      <View>
        <MovementPreview movement={SQUAT} testID="p-squat" />
        <MovementPreview movement={PUSH_UP} testID="p-pushup" />
        <MovementPreview movement={RDL} testID="p-rdl" />
      </View>
    );

    const cSquat = screen.getByTestId('p-squat').findByProps({ testID: 'movement-preview-control' });
    const cPush = screen.getByTestId('p-pushup').findByProps({ testID: 'movement-preview-control' });
    const cRdl = screen.getByTestId('p-rdl').findByProps({ testID: 'movement-preview-control' });

    const sequence = [
      { trigger: cSquat, active: cSquat, others: [cPush, cRdl] },
      { trigger: cPush, active: cPush, others: [cSquat, cRdl] },
      { trigger: cRdl, active: cRdl, others: [cSquat, cPush] },
      { trigger: cSquat, active: cSquat, others: [cPush, cRdl] },
      { trigger: cRdl, active: cRdl, others: [cSquat, cPush] },
      { trigger: cPush, active: cPush, others: [cSquat, cRdl] },
    ];

    for (const step of sequence) {
      fireEvent.press(step.trigger);
      expect(liveIntervals()).toBe(1);
      expect(isPlaybackActive()).toBe(true);
      expect(step.active.props.accessibilityState.selected).toBe(true);
      for (const other of step.others) {
        expect(other.props.accessibilityState.selected).toBe(false);
      }
    }

    // Final halt
    fireEvent.press(cPush);
    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRY/CATCH RESILIENCE & ERROR CONTAINMENT
// ─────────────────────────────────────────────────────────────────────────────

describe('Challenger Stress 2: Try/Catch Resilience Under Thrown Exceptions', () => {
  test('coordinator gracefully catches throw in superseded player and activates new player', () => {
    const errorSpy = jest.fn(() => {
      throw new Error('Superseded component crash inside stop callback');
    });
    const playerBStop = jest.fn();

    // Player A claims
    claimPreviewPlayback(errorSpy);
    expect(isPlaybackActive()).toBe(true);

    // Player B claims: must NOT throw error to caller, and must install playerBStop
    expect(() => {
      claimPreviewPlayback(playerBStop);
    }).not.toThrow();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(isPlaybackActive()).toBe(true);

    // Releasing Player B must cleanly deactivate
    releasePreviewPlayback(playerBStop);
    expect(isPlaybackActive()).toBe(false);
  });

  test('coordinator survives non-Error thrown values (strings, null, undefined, objects)', () => {
    const weirdThrows = [
      () => { throw 'String exception'; },
      () => { throw null; },
      () => { throw undefined; },
      () => { throw { weird: 'object' }; },
      () => { throw 42; },
    ];

    for (const thrower of weirdThrows) {
      claimPreviewPlayback(thrower);
      expect(isPlaybackActive()).toBe(true);

      const nextStop = jest.fn();
      expect(() => {
        claimPreviewPlayback(nextStop);
      }).not.toThrow();

      expect(isPlaybackActive()).toBe(true);
      releasePreviewPlayback(nextStop);
      expect(isPlaybackActive()).toBe(false);
    }
  });

  test('re-entrant claim inside stop callback does not corrupt coordinator state', () => {
    const reentrantStop = jest.fn();
    const sneakyStop = () => {
      // While being stopped, tries to claim again for someone else!
      claimPreviewPlayback(reentrantStop);
    };

    const legitimateStop = jest.fn();

    // Start with sneaky
    claimPreviewPlayback(sneakyStop);
    expect(isPlaybackActive()).toBe(true);

    // Legitimate player claims
    claimPreviewPlayback(legitimateStop);

    // Legitimate player must be the ultimate winner
    expect(isPlaybackActive()).toBe(true);
    releasePreviewPlayback(legitimateStop);
    expect(isPlaybackActive()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SINGLE-CYCLE CADENCE & REPLAY SEMANTICS
// ─────────────────────────────────────────────────────────────────────────────

describe('Challenger Stress 3: Single-Cycle Cadence & Replay', () => {
  test('5-frame movement: exact step-by-step segment timings, final frame halt, REPLAY control label, and frame 0 restart', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    jest.spyOn(manifestModule, 'resolveMovementPreview').mockImplementation((subject, review) => {
      if (subject?.movement_id === 8888) return FIVE_FRAME_ENTRY;
      return REAL_RESOLVE(
        subject,
        subject?.media?.status === 'ready' ? APPROVED_REVIEW_FIXTURE : review,
      );
    });

    const stateChanges = [];
    await renderPreview(
      <MovementPreview
        movement={FIVE_FRAME_FIXTURE}
        onPlaybackStateChange={(s) => stateChanges.push(s)}
        testID="test-five-frame"
      />
    );

    const card = screen.getByTestId('test-five-frame');
    const control = within(card).getByTestId('movement-preview-control');
    const pos = within(card).getByTestId('movement-preview-position');
    const caption = within(card).getByTestId('movement-preview-caption');

    // Initial check: stopped at frame 0 (Position 1 of 5)
    expect(pos).toHaveTextContent('Position 1 of 5');
    expect(caption).toHaveTextContent('Starting setup position');
    expect(control).toHaveTextContent('PLAY');
    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);

    // Press PLAY
    fireEvent.press(control);
    expect(control).toHaveTextContent('PAUSE');
    expect(liveIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);
    expect(stateChanges[stateChanges.length - 1]).toBe(true);

    // Step 1: 500 ms -> Frame 2
    act(() => jest.advanceTimersByTime(500));
    expect(pos).toHaveTextContent('Position 2 of 5');
    expect(caption).toHaveTextContent('Midway descending inflection');

    // Step 2: 450 ms -> Frame 3
    act(() => jest.advanceTimersByTime(450));
    expect(pos).toHaveTextContent('Position 3 of 5');
    expect(caption).toHaveTextContent('Full inflection depth');

    // Step 3: 450 ms -> Frame 4
    act(() => jest.advanceTimersByTime(450));
    expect(pos).toHaveTextContent('Position 4 of 5');
    expect(caption).toHaveTextContent('Midway ascending recovery');

    // Step 4: 500 ms -> Frame 5 (Lockout / final frame)
    act(() => jest.advanceTimersByTime(500));
    expect(pos).toHaveTextContent('Position 5 of 5');
    expect(caption).toHaveTextContent('Final completed lockout position');

    // Advance interval at final frame -> MUST auto-pause:
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(pos).toHaveTextContent('Position 5 of 5');
    expect(liveIntervals()).toBe(0); // Timer cleanly killed
    expect(isPlaybackActive()).toBe(false); // Coordinator claim released
    expect(stateChanges[stateChanges.length - 1]).toBe(false);
    expect(control).toHaveTextContent('REPLAY');
    expect(control.props.accessibilityLabel).toMatch(/Replay/i);
    expect(control.props.accessibilityState.selected).toBe(false);

    // Even if additional time elapses, it must NEVER loop or move
    act(() => jest.advanceTimersByTime(60000));
    expect(pos).toHaveTextContent('Position 5 of 5');
    expect(liveIntervals()).toBe(0);

    // Subsequent tap on REPLAY: resets immediately to Position 1 of 5
    fireEvent.press(control);
    expect(pos).toHaveTextContent('Position 1 of 5');
    expect(caption).toHaveTextContent('Starting setup position');
    expect(control).toHaveTextContent('PAUSE');
    expect(liveIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);
    expect(stateChanges[stateChanges.length - 1]).toBe(true);
  });

  test('mid-cycle pause preserves held position and resumes smoothly to end', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    jest.spyOn(manifestModule, 'resolveMovementPreview').mockImplementation((subject, review) => {
      if (subject?.movement_id === 8888) return FIVE_FRAME_ENTRY;
      return REAL_RESOLVE(
        subject,
        subject?.media?.status === 'ready' ? APPROVED_REVIEW_FIXTURE : review,
      );
    });

    await renderPreview(
      <MovementPreview movement={FIVE_FRAME_FIXTURE} testID="mid-pause-preview" />
    );

    const card = screen.getByTestId('mid-pause-preview');
    const control = within(card).getByTestId('movement-preview-control');
    const pos = within(card).getByTestId('movement-preview-position');

    // Start playback
    fireEvent.press(control);
    // Advance 500 ms to Frame 2
    act(() => jest.advanceTimersByTime(500));
    expect(pos).toHaveTextContent('Position 2 of 5');

    // Pause mid-cycle
    fireEvent.press(control);
    expect(control).toHaveTextContent('PLAY');
    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);

    // Wait 10 seconds: position is strictly held
    act(() => jest.advanceTimersByTime(10000));
    expect(pos).toHaveTextContent('Position 2 of 5');

    // Resume playback
    fireEvent.press(control);
    expect(control).toHaveTextContent('PAUSE');
    expect(liveIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    // Advance 450 ms -> moves to Frame 3!
    act(() => jest.advanceTimersByTime(450));
    expect(pos).toHaveTextContent('Position 3 of 5');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. UNMOUNT & APPSTATE BACKGROUND LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

describe('Challenger Stress 4: Unmount & AppState Background Lifecycle', () => {
  test('unmounting active preview halts timer immediately and releases coordinator', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    const { unmount } = await renderPreview(<MovementPreview movement={SQUAT} />);
    const control = screen.getByTestId('movement-preview-control');

    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    unmount();

    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
  });

  test('AppState change to inactive halts playback, clears timer, and returning to active does NOT restart', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    const listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      listeners.push({ event, handler });
      return { remove: () => {} };
    });

    await renderPreview(<MovementPreview movement={PUSH_UP} />);
    const control = screen.getByTestId('movement-preview-control');

    // Start playback
    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    // AppState: inactive
    act(() => {
      listeners.filter((l) => l.event === 'change').forEach((l) => l.handler('inactive'));
    });

    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
    expect(control).toHaveTextContent('PLAY');

    // AppState: active (return to foreground) -> must remain stopped!
    act(() => {
      listeners.filter((l) => l.event === 'change').forEach((l) => l.handler('active'));
    });

    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
    expect(control).toHaveTextContent('PLAY');
  });

  test('AppState change to background halts playback, clears timer, and releases coordinator', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    const listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      listeners.push({ event, handler });
      return { remove: () => {} };
    });

    await renderPreview(<MovementPreview movement={RDL} />);
    const control = screen.getByTestId('movement-preview-control');

    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    // AppState: background
    act(() => {
      listeners.filter((l) => l.event === 'change').forEach((l) => l.handler('background'));
    });

    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
    expect(control).toHaveTextContent('PLAY');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. RAPID DEBOUNCE & RACE CONDITIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('Challenger Stress 5: Rapid Debounce & Press Race Conditions', () => {
  test('burst tapping (10 rapid taps) never creates duplicate intervals and settles correctly', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    await renderPreview(<MovementPreview movement={SQUAT} />);
    const control = screen.getByTestId('movement-preview-control');

    // Burst of 10 rapid presses
    for (let i = 0; i < 10; i++) {
      fireEvent.press(control);
      // Interval count must NEVER exceed 1 at any moment!
      expect(liveIntervals()).toBeLessThanOrEqual(1);
    }

    // 10 presses starting from paused -> even number of toggles -> ends paused!
    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
    expect(control).toHaveTextContent('PLAY');

    // 11th press -> ends playing!
    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);
    expect(control).toHaveTextContent('PAUSE');
  });

  test('interleaved rapid-tap preemption race between two players', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    await renderPreview(
      <View>
        <MovementPreview movement={SQUAT} testID="deck-a" />
        <MovementPreview movement={PUSH_UP} testID="deck-b" />
      </View>
    );

    const cA = within(screen.getByTestId('deck-a')).getByTestId('movement-preview-control');
    const cB = within(screen.getByTestId('deck-b')).getByTestId('movement-preview-control');

    // Rapid alternating presses: A, B, A, B, A, B...
    for (let i = 0; i < 20; i++) {
      fireEvent.press(i % 2 === 0 ? cA : cB);
      // Strictly 1 timer globally at all times during preemption storm
      expect(liveIntervals()).toBe(1);
      expect(isPlaybackActive()).toBe(true);
    }

    // Last press was i=19 (odd) -> cB
    expect(cB.props.accessibilityState.selected).toBe(true);
    expect(cA.props.accessibilityState.selected).toBe(false);

    // Stop cB
    fireEvent.press(cB);
    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
  });
});
