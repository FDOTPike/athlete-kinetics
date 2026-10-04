/**
 * WO-09 Milestone 6 Adversarial Challenge Test Suite
 *
 * Authored by challenger_m6_1 (Milestone 6 Playback Lifecycle & Mutual Exclusion Challenger)
 * Independent empirical verification of:
 * 1. Mutual exclusion across components, screens, and unmount order invariance.
 * 2. Single-cycle playback: 4 segments on 5-frame movements, auto-pause at final frame, reset & replay.
 * 3. Pause / resume mid-cycle: frame retention, timer cessation, resumption to completion.
 * 4. AppState transitions: inactive / background halts playback, clears timers, releases claims, no auto-resume.
 * 5. Unmount cleanup: claim releases, 0 timer leaks, AppState listener detachment.
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

// Synthetic 5-frame covered movement fixture for testing 4-segment single cycle playback
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
const FIVE_FRAME_COVERED_MOVEMENT = {
  movement_id: 9999,
  name: 'Synthetic 5-Frame Movement',
  media: { assetKey: 'movement/synthetic-5frame/demo/v1', status: 'covered', revision: 1, fallbackUrl: null },
};

const FIVE_FRAME_PREVIEW_ENTRY = {
  movementId: 9999,
  assetKey: 'movement/synthetic-5frame/demo/v1',
  name: 'Synthetic 5-Frame Movement',
  pattern: 'squat',
  previewId: 'synthetic_5frame',
  implement: null,
  summary: 'Five drawn positions test fixture.',
  status: 'covered',
  segmentDurationsMs: [500, 450, 450, 500],
  frames: [
    { id: 'f1', step: 1, title: 'Frame 1', caption: 'Step 1 Caption', joints: PREVIEW_ENTRIES[0].frames[0].joints },
    { id: 'f2', step: 2, title: 'Frame 2', caption: 'Step 2 Caption', joints: PREVIEW_ENTRIES[0].frames[1].joints },
    { id: 'f3', step: 3, title: 'Frame 3', caption: 'Step 3 Caption', joints: PREVIEW_ENTRIES[0].frames[2].joints },
    { id: 'f4', step: 4, title: 'Frame 4', caption: 'Step 4 Caption', joints: PREVIEW_ENTRIES[0].frames[1].joints },
    { id: 'f5', step: 5, title: 'Frame 5', caption: 'Step 5 Caption', joints: PREVIEW_ENTRIES[0].frames[0].joints },
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
// 1. MUTUAL EXCLUSION ADVERSARIAL CHALLENGES
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial Challenge 1: Playback Coordinator Mutual Exclusion', () => {
  test('claiming playback on Preview B immediately stops Preview A across separate components', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    await renderPreview(
      <View>
        <MovementPreview movement={SQUAT} testID="preview-a" />
        <MovementPreview movement={PUSH_UP} testID="preview-b" />
      </View>
    );

    const controlA = within(screen.getByTestId('preview-a')).getByTestId('movement-preview-control');
    const controlB = within(screen.getByTestId('preview-b')).getByTestId('movement-preview-control');

    // Start Preview A
    fireEvent.press(controlA);
    expect(isPlaybackActive()).toBe(true);
    expect(liveIntervals()).toBe(1);
    expect(controlA.props.accessibilityState.selected).toBe(true);
    expect(controlB.props.accessibilityState.selected).toBe(false);

    // Advance 1 frame on A
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(within(screen.getByTestId('preview-a')).getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 3');

    // Claim playback on Preview B
    fireEvent.press(controlB);
    expect(isPlaybackActive()).toBe(true);
    expect(liveIntervals()).toBe(1); // Exactly 1 timer globally!
    expect(controlA.props.accessibilityState.selected).toBe(false);
    expect(controlB.props.accessibilityState.selected).toBe(true);

    // Advance time: B advances, A does NOT advance
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(within(screen.getByTestId('preview-b')).getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 3');
    expect(within(screen.getByTestId('preview-a')).getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 3');
  });

  test('unmounting superseded Preview A does NOT clear Preview B claim', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    function ParentScreen({ showA }) {
      return (
        <View>
          {showA && <MovementPreview movement={SQUAT} testID="preview-a" />}
          <MovementPreview movement={PUSH_UP} testID="preview-b" />
        </View>
      );
    }

    const { rerender } = await renderPreview(<ParentScreen showA={true} />);

    const controlA = within(screen.getByTestId('preview-a')).getByTestId('movement-preview-control');
    const controlB = within(screen.getByTestId('preview-b')).getByTestId('movement-preview-control');

    // A starts playing
    fireEvent.press(controlA);
    expect(isPlaybackActive()).toBe(true);

    // B starts playing (preempts A)
    fireEvent.press(controlB);
    expect(isPlaybackActive()).toBe(true);
    expect(liveIntervals()).toBe(1);

    // Now unmount A while B is playing!
    rerender(<ParentScreen showA={false} />);
    await act(async () => {});

    // Preview A must be gone
    expect(screen.queryByTestId('preview-a')).toBeNull();

    // CRITICAL: B's claim must remain active, timer must still be 1, and B continues animating
    expect(isPlaybackActive()).toBe(true);
    expect(liveIntervals()).toBe(1);

    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(within(screen.getByTestId('preview-b')).getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 3');
  });

  test('multi-player preemption cascade (A -> B -> C -> A) maintains strictly 1 active timer', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    await renderPreview(
      <View>
        <MovementPreview movement={SQUAT} testID="preview-a" />
        <MovementPreview movement={PUSH_UP} testID="preview-b" />
        <MovementPreview movement={RDL} testID="preview-c" />
      </View>
    );

    const controlA = screen.getByTestId('preview-a').findByProps({ testID: 'movement-preview-control' });
    const controlB = screen.getByTestId('preview-b').findByProps({ testID: 'movement-preview-control' });
    const controlC = screen.getByTestId('preview-c').findByProps({ testID: 'movement-preview-control' });

    // Start A
    fireEvent.press(controlA);
    expect(liveIntervals()).toBe(1);
    expect(controlA.props.accessibilityState.selected).toBe(true);

    // B preempts A
    fireEvent.press(controlB);
    expect(liveIntervals()).toBe(1);
    expect(controlA.props.accessibilityState.selected).toBe(false);
    expect(controlB.props.accessibilityState.selected).toBe(true);

    // C preempts B
    fireEvent.press(controlC);
    expect(liveIntervals()).toBe(1);
    expect(controlB.props.accessibilityState.selected).toBe(false);
    expect(controlC.props.accessibilityState.selected).toBe(true);

    // A preempts C
    fireEvent.press(controlA);
    expect(liveIntervals()).toBe(1);
    expect(controlC.props.accessibilityState.selected).toBe(false);
    expect(controlA.props.accessibilityState.selected).toBe(true);

    // Stop A
    fireEvent.press(controlA);
    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
  });

  test('fault tolerance: throwing stop callback in superseded player does not prevent new player claim', () => {
    const errorThrowingStop = () => {
      throw new Error('Explosive unmount failure in legacy player');
    };
    const validStop = jest.fn();

    claimPreviewPlayback(errorThrowingStop);
    expect(isPlaybackActive()).toBe(true);

    // Claim with validStop should not throw and should become the active player
    expect(() => {
      claimPreviewPlayback(validStop);
    }).not.toThrow();

    expect(isPlaybackActive()).toBe(true);
    releasePreviewPlayback(validStop);
    expect(isPlaybackActive()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SINGLE-CYCLE PLAYBACK ADVERSARIAL CHALLENGES
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial Challenge 2: Single-Cycle Playback & Replay Cadence', () => {
  test('5-frame movement executes 4 segments, auto-pauses at final frame, sets playing=false, and replays from frame 0', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    // Mock manifest resolution for the synthetic 5-frame covered movement
    jest.spyOn(manifestModule, 'resolveMovementPreview').mockImplementation((subject, review) => {
      if (subject?.movement_id === 9999) return FIVE_FRAME_PREVIEW_ENTRY;
      return REAL_RESOLVE(
        subject,
        subject?.media?.status === 'ready' ? APPROVED_REVIEW_FIXTURE : review,
      );
    });

    const stateChangeSpy = jest.fn();

    await renderPreview(
      <MovementPreview
        movement={FIVE_FRAME_COVERED_MOVEMENT}
        onPlaybackStateChange={stateChangeSpy}
        testID="five-frame-preview"
      />
    );

    const card = screen.getByTestId('five-frame-preview');
    const control = within(card).getByTestId('movement-preview-control');
    const position = within(card).getByTestId('movement-preview-position');

    // Initial state: frame 0 (Position 1 of 5), control is PLAY
    expect(position).toHaveTextContent('Position 1 of 5');
    expect(control).toHaveTextContent('PLAY');
    expect(liveIntervals()).toBe(0);

    // Tap PLAY -> starts single cycle
    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
    expect(stateChangeSpy).toHaveBeenLastCalledWith(true);
    expect(control).toHaveTextContent('PAUSE');

    // Segment 1 (500 ms): frame 0 -> frame 1
    act(() => jest.advanceTimersByTime(500));
    expect(position).toHaveTextContent('Position 2 of 5');

    // Segment 2 (450 ms): frame 1 -> frame 2
    act(() => jest.advanceTimersByTime(450));
    expect(position).toHaveTextContent('Position 3 of 5');

    // Segment 3 (450 ms): frame 2 -> frame 3
    act(() => jest.advanceTimersByTime(450));
    expect(position).toHaveTextContent('Position 4 of 5');

    // Segment 4 (500 ms): frame 3 -> frame 4 (final frame)
    act(() => jest.advanceTimersByTime(500));
    expect(position).toHaveTextContent('Position 5 of 5');

    // At final frame: next tick auto-pauses, halts timer, sets playing=false
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(position).toHaveTextContent('Position 5 of 5');
    expect(liveIntervals()).toBe(0); // Timer cleanly destroyed!
    expect(stateChangeSpy).toHaveBeenLastCalledWith(false);
    expect(isPlaybackActive()).toBe(false); // Coordinator claim released!
    expect(control).toHaveTextContent('REPLAY');
    expect(control.props.accessibilityLabel).toMatch(/Replay/i);

    // Subsequent tap resets to frame 0 and replays
    fireEvent.press(control);
    expect(position).toHaveTextContent('Position 1 of 5');
    expect(liveIntervals()).toBe(1);
    expect(control).toHaveTextContent('PAUSE');
    expect(stateChangeSpy).toHaveBeenLastCalledWith(true);
  });

  test('3-frame movement with explicit singleCycle={true} auto-pauses at position 3 and switches to REPLAY', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    await renderPreview(<MovementPreview movement={SQUAT} singleCycle={true} />);
    const control = screen.getByTestId('movement-preview-control');

    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);

    // Step to frame 2
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 3');

    // Step to frame 3
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 3 of 3');

    // Auto-pause step
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 3 of 3');
    expect(liveIntervals()).toBe(0);
    expect(control).toHaveTextContent('REPLAY');

    // Press REPLAY -> immediately resets to Position 1 of 3
    fireEvent.press(control);
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 1 of 3');
    expect(liveIntervals()).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PAUSE / RESUME MID-CYCLE ADVERSARIAL CHALLENGES
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial Challenge 3: Mid-Cycle Pause & Resume Frame Retention', () => {
  test('tapping mid-cycle holds current frame indefinitely and resumes from that exact frame', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    await renderPreview(<MovementPreview movement={PUSH_UP} />);
    const control = screen.getByTestId('movement-preview-control');
    const position = screen.getByTestId('movement-preview-position');

    // Play -> step to Position 2
    fireEvent.press(control);
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(position).toHaveTextContent('Position 2 of 3');
    expect(control).toHaveTextContent('PAUSE');

    // Tap to PAUSE mid-cycle
    fireEvent.press(control);
    expect(control).toHaveTextContent('PLAY');
    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);

    // Advance simulated time by 60 seconds: position MUST stay at Position 2 of 3
    act(() => jest.advanceTimersByTime(60000));
    expect(position).toHaveTextContent('Position 2 of 3');
    expect(liveIntervals()).toBe(0);

    // Tap to RESUME: must NOT reset to Position 1, must advance from Position 2 to Position 3
    fireEvent.press(control);
    expect(control).toHaveTextContent('PAUSE');
    expect(liveIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS));
    expect(position).toHaveTextContent('Position 3 of 3');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. APPSTATE BACKGROUND HANDLING ADVERSARIAL CHALLENGES
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial Challenge 4: AppState Inactive and Background Transitions', () => {
  test('AppState transition to "inactive" immediately halts playback and clears interval', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();
    const appStateListeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      appStateListeners.push({ event, handler });
      return { remove: () => {} };
    });

    await renderPreview(<MovementPreview movement={RDL} />);
    const control = screen.getByTestId('movement-preview-control');

    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    // Trigger inactive state (e.g. system alert or app switcher)
    act(() => {
      appStateListeners
        .filter((l) => l.event === 'change')
        .forEach((l) => l.handler('inactive'));
    });

    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
    expect(control).toHaveTextContent('PLAY');
  });

  test('AppState transition to "background" immediately halts playback and clears interval', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();
    const appStateListeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      appStateListeners.push({ event, handler });
      return { remove: () => {} };
    });

    await renderPreview(<MovementPreview movement={SQUAT} />);
    const control = screen.getByTestId('movement-preview-control');

    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    // Trigger background state (e.g. home button pressed)
    act(() => {
      appStateListeners
        .filter((l) => l.event === 'change')
        .forEach((l) => l.handler('background'));
    });

    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
    expect(control).toHaveTextContent('PLAY');
  });

  test('returning from background to "active" does NOT auto-resume playback', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();
    const appStateListeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      appStateListeners.push({ event, handler });
      return { remove: () => {} };
    });

    await renderPreview(<MovementPreview movement={PUSH_UP} />);
    const control = screen.getByTestId('movement-preview-control');

    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);

    // Background app
    act(() => {
      appStateListeners
        .filter((l) => l.event === 'change')
        .forEach((l) => l.handler('background'));
    });
    expect(liveIntervals()).toBe(0);

    // Resume app to active
    act(() => {
      appStateListeners
        .filter((l) => l.event === 'change')
        .forEach((l) => l.handler('active'));
    });

    // Must remain stopped!
    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
    expect(control).toHaveTextContent('PLAY');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. UNMOUNT CLEANUP & LEAK VERIFICATION ADVERSARIAL CHALLENGES
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial Challenge 5: Component Unmount Cleanup & Zero Leaks', () => {
  test('unmounting a currently playing preview releases coordinator claim and clears all timers', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    const { unmount } = await renderPreview(<MovementPreview movement={SQUAT} />);
    const control = screen.getByTestId('movement-preview-control');

    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    // Unmount during active playback
    unmount();

    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
  });

  test('unmounting unregisters AppState listener with zero memory leaks', async () => {
    const removeSpy = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: removeSpy });

    const { unmount } = await renderPreview(<MovementPreview movement={SQUAT} />);
    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  test('stress test: rapid mount, play, preempt and unmount across 10 previews leaves 0 leaks', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    function MultiDeck({ activeId }) {
      return (
        <View>
          {activeId === 1 && <MovementPreview movement={SQUAT} testID="p1" />}
          {activeId === 2 && <MovementPreview movement={PUSH_UP} testID="p2" />}
          {activeId === 3 && <MovementPreview movement={RDL} testID="p3" />}
        </View>
      );
    }

    const { rerender, unmount } = await renderPreview(<MultiDeck activeId={1} />);

    for (let cycle = 0; cycle < 5; cycle++) {
      // Play p1
      fireEvent.press(screen.getByTestId('p1').findByProps({ testID: 'movement-preview-control' }));
      expect(liveIntervals()).toBe(1);

      // Switch to p2 (unmounting p1 while playing)
      rerender(<MultiDeck activeId={2} />);
      await act(async () => {});
      expect(liveIntervals()).toBe(0);
      expect(isPlaybackActive()).toBe(false);

      // Play p2
      fireEvent.press(screen.getByTestId('p2').findByProps({ testID: 'movement-preview-control' }));
      expect(liveIntervals()).toBe(1);
      expect(isPlaybackActive()).toBe(true);

      // Switch to p3 (unmounting p2 while playing)
      rerender(<MultiDeck activeId={3} />);
      await act(async () => {});
      expect(liveIntervals()).toBe(0);
      expect(isPlaybackActive()).toBe(false);

      // Play p3
      fireEvent.press(screen.getByTestId('p3').findByProps({ testID: 'movement-preview-control' }));
      expect(liveIntervals()).toBe(1);

      // Switch back to p1
      rerender(<MultiDeck activeId={1} />);
      await act(async () => {});
      expect(liveIntervals()).toBe(0);
      expect(isPlaybackActive()).toBe(false);
    }

    unmount();
    expect(liveIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
  });
});
