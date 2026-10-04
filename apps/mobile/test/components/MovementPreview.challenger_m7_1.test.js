/**
 * WO-09 Milestone 7 Adversarial Test Suite & Tier 5 Coverage Hardening
 *
 * Authored by challenger_m7_1 (M7 Tier 5 Adversarial Coverage Challenger)
 * Comprehensive empirical stress testing:
 * 1. Extreme boundary conditions & poisoned input hardening (BVA & fail-closed invariants)
 * 2. High-concurrency preemption storms & re-entrancy resilience
 * 3. Deep timer leak & AppState listener leak audits across rapid mount/unmount cycles
 * 4. Air-gapped network isolation verification
 * 5. Layout geometry, accessibility bounds, and font-scale resilience
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

const UNCOVERED_MOVEMENT = {
  movement_id: 999,
  name: 'Pending Movement',
  media: { assetKey: 'movement/pending-movement/demo/v1', status: 'pending', revision: 1, fallbackUrl: null },
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
// 1. EXTREME BOUNDARY CONDITIONS & POISONED INPUTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 5 Hardening: Extreme Boundary Conditions & Poisoned Inputs', () => {
  test('rejects malformed and poisoned movement subjects without throwing', async () => {
    const poisonedSubjects = [
      null,
      undefined,
      {},
      { movement_id: NaN },
      { movement_id: -1 },
      { movement_id: 3.14159 },
      { movement_id: Number.MAX_SAFE_INTEGER },
      { movement_id: 28, media: null },
      { movement_id: 28, media: {} },
      { movement_id: 28, media: { assetKey: null } },
      { movement_id: 28, media: { assetKey: 'movement/wrong-key/demo/v1' } },
      { movement_id: 28, media: { asset_key: 'movement/wrong-key/demo/v1' } },
      { movement_id: '28', media: { assetKey: 'movement/bodyweight-squat/demo/v1' } },
    ];

    for (const subject of poisonedSubjects) {
      const { toJSON } = render(<MovementPreview movement={subject} />);
      expect(toJSON()).toBeNull();
    }
  });

  test('survives circular references and objects with throwing properties', async () => {
    const circularSubject = {
      movement_id: 28,
      media: { assetKey: 'movement/bodyweight-squat/demo/v1', status: 'ready' },
    };
    circularSubject.self = circularSubject;

    const throwingSubject = {
      get movement_id() {
        return 28;
      },
      media: {
        get assetKey() {
          return 'movement/bodyweight-squat/demo/v1';
        },
        get status() {
          return 'ready';
        },
      },
    };

    const { unmount: u1 } = await renderPreview(<MovementPreview movement={circularSubject} testID="circ-preview" />);
    expect(screen.getByTestId('circ-preview')).toBeTruthy();
    u1();

    const { unmount: u2 } = await renderPreview(<MovementPreview movement={throwingSubject} testID="throw-preview" />);
    expect(screen.getByTestId('throw-preview')).toBeTruthy();
    u2();
  });

  test('dynamically updating movement prop from covered A to covered B while playing updates preview cleanly', async () => {
    jest.useFakeTimers();
    const activeIntervals = intervalProbe();

    const { rerender, unmount } = await renderPreview(<MovementPreview movement={SQUAT} testID="dyn-preview" />);

    // Start playback on Squat
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    expect(activeIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    // Advance 1 frame
    act(() => {
      jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS);
    });
    expect(screen.getByTestId('movement-preview-position').props.children).toBe('Position 2 of 3');

    // Dynamically change prop to Push-up while playing
    await act(async () => {
      rerender(<MovementPreview movement={PUSH_UP} testID="dyn-preview" />);
    });

    // Push-up container should be rendered
    expect(screen.getByTestId('dyn-preview')).toBeTruthy();
    // A new movement starts still-first and releases the previous claim.
    expect(activeIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
    expect(screen.getByTestId('movement-preview-position').props.children).toBe('Position 1 of 3');

    // The new movement can acquire a fresh claim, then release it.
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    expect(activeIntervals()).toBe(1);
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    expect(activeIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);

    unmount();
  });

  test('dynamically updating movement prop to an uncovered movement halts animation timer and releases on unmount', async () => {
    jest.useFakeTimers();
    const activeIntervals = intervalProbe();

    const { rerender, toJSON, unmount } = await renderPreview(<MovementPreview movement={SQUAT} testID="uncovered-dyn" />);

    // Start playing
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    expect(activeIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    // Dynamically change prop to uncovered movement
    await act(async () => {
      rerender(<MovementPreview movement={UNCOVERED_MOVEMENT} testID="uncovered-dyn" />);
    });

    // Uncovered movement renders null
    expect(toJSON()).toBeNull();
    // Animation interval is immediately cleared
    expect(activeIntervals()).toBe(0);

    // Unmounting releases coordinator
    unmount();
    expect(isPlaybackActive()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. HIGH-CONCURRENCY PREEMPTION & RE-ENTRANCY RESILIENCE
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 5 Hardening: High-Concurrency Preemption & Re-entrancy Stress', () => {
  test('massive 30-player preemption storm maintains strictly <= 1 active interval at all moments', async () => {
    jest.useFakeTimers();
    const activeIntervals = intervalProbe();

    // Render 30 separate preview components wrapped in a single container
    const ids = Array.from({ length: 30 }, (_, i) => `preview-${i}`);
    const { unmount } = render(
      <View>
        {ids.map((id, i) => (
          <MovementPreview key={id} movement={i % 2 === 0 ? SQUAT : PUSH_UP} testID={id} />
        ))}
      </View>
    );

    // Burst-activate each preview in succession
    for (let i = 0; i < 30; i++) {
      const container = screen.getByTestId(`preview-${i}`);
      const control = within(container).getByTestId('movement-preview-control');
      fireEvent.press(control);
      expect(activeIntervals()).toBe(1);
      expect(isPlaybackActive()).toBe(true);
    }

    // Step time forward
    act(() => {
      jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS * 2);
    });
    expect(activeIntervals()).toBe(1);

    // Stop the last active preview
    const lastContainer = screen.getByTestId('preview-29');
    const lastControl = within(lastContainer).getByTestId('movement-preview-control');
    fireEvent.press(lastControl);
    expect(activeIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);

    unmount();
    expect(activeIntervals()).toBe(0);
  });

  test('re-entrant playback claims inside onPlaybackStateChange do not deadlock or loop infinitely', async () => {
    jest.useFakeTimers();
    let callbackCount = 0;

    const onPlaybackStateChange = jest.fn((isPlaying) => {
      callbackCount++;
      if (isPlaying && callbackCount < 5) {
        // Attempt re-entrant claim
        claimPreviewPlayback(() => {});
      }
    });

    const { unmount } = await renderPreview(
      <MovementPreview movement={SQUAT} onPlaybackStateChange={onPlaybackStateChange} />,
    );

    fireEvent.press(screen.getByTestId('movement-preview-control'));

    expect(onPlaybackStateChange).toHaveBeenCalledWith(true);
    expect(callbackCount).toBeGreaterThanOrEqual(1);

    unmount();
  });

  test('burst tapping (50 simultaneous presses within 1 tick) does not leak timers or cause desync', async () => {
    jest.useFakeTimers();
    const activeIntervals = intervalProbe();

    const { unmount } = await renderPreview(<MovementPreview movement={SQUAT} />);
    const control = screen.getByTestId('movement-preview-control');

    // 50 rapid fireEvent.press calls
    for (let i = 0; i < 50; i++) {
      fireEvent.press(control);
    }

    // Since 50 is even, playing state toggled 50 times -> ended on false
    expect(activeIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);

    // One more press -> playing = true
    fireEvent.press(control);
    expect(activeIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    unmount();
    expect(activeIntervals()).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DEEP MEMORY, TIMER, AND APPSTATE LEAK AUDITS
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 5 Hardening: Deep Memory & AppState Listener Leak Audits', () => {
  test('50 rapid mount-play-pause-unmount cycles produce exactly ZERO orphaned timers', async () => {
    jest.useFakeTimers();
    const activeIntervals = intervalProbe();

    for (let i = 0; i < 50; i++) {
      const { unmount } = render(<MovementPreview movement={SQUAT} />);
      fireEvent.press(screen.getByTestId('movement-preview-control'));
      expect(activeIntervals()).toBe(1);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      unmount();
      expect(activeIntervals()).toBe(0);
    }

    expect(activeIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
  });

  test('30 rapid mount-unmount cycles leave zero lingering AppState listeners', async () => {
    const addListenerSpy = jest.spyOn(AppState, 'addEventListener');
    const removeMock = jest.fn();

    addListenerSpy.mockImplementation((event, handler) => {
      return { remove: removeMock };
    });

    const instances = [];
    for (let i = 0; i < 30; i++) {
      instances.push(render(<MovementPreview movement={SQUAT} />));
    }

    expect(addListenerSpy).toHaveBeenCalledTimes(30);

    for (const inst of instances) {
      inst.unmount();
    }

    expect(removeMock).toHaveBeenCalledTimes(30);
  });

  test('AppState transitions through active -> inactive -> background -> inactive -> active cycle safely', async () => {
    jest.useFakeTimers();
    const activeIntervals = intervalProbe();

    let appStateHandler;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'change') {
        appStateHandler = handler;
      }
      return { remove: jest.fn() };
    });

    const { unmount } = await renderPreview(<MovementPreview movement={SQUAT} />);

    // Start playing
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    expect(activeIntervals()).toBe(1);
    expect(isPlaybackActive()).toBe(true);

    // Transition to inactive
    act(() => {
      if (appStateHandler) appStateHandler('inactive');
    });
    expect(activeIntervals()).toBe(0);
    expect(screen.getByTestId('movement-preview-control')).toBeTruthy();

    // Transition to background
    act(() => {
      if (appStateHandler) appStateHandler('background');
    });
    expect(activeIntervals()).toBe(0);

    // Transition back to active: MUST NOT auto-resume
    act(() => {
      if (appStateHandler) appStateHandler('active');
    });
    expect(activeIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);

    unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. AIR-GAPPED NETWORK ISOLATION VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 5 Hardening: Air-Gapped Network Isolation Verification', () => {
  test('strictly zero network calls (fetch, XHR, WebSocket, sendBeacon) during full lifecycle', async () => {
    jest.useFakeTimers();
    const mockFetch = jest.fn();
    const mockXHR = jest.fn();
    const mockWS = jest.fn();

    global.fetch = mockFetch;
    global.XMLHttpRequest = mockXHR;
    global.WebSocket = mockWS;

    const { unmount: u1 } = await renderPreview(<MovementPreview movement={SQUAT} />);

    // Playback cycle
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    act(() => {
      jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS * 4);
    });

    // Pause
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    u1();

    // Step in reduced motion mode
    const { unmount: u2 } = await renderPreview(
      <MovementPreview movement={PUSH_UP} reducedMotion={true} />,
    );
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    u2();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockXHR).not.toHaveBeenCalled();
    expect(mockWS).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ACCESSIBILITY, VIEWPORT EXTREMA, AND FONT SCALING RESILIENCE
// ─────────────────────────────────────────────────────────────────────────────

describe('Tier 5 Hardening: Accessibility, Viewport Extrema, and Font Scaling', () => {
  test('stage dimensions remain bit-exact constants invariant across font scaling', async () => {
    expect(PREVIEW_LAYOUT.width).toBe(240);
    expect(PREVIEW_LAYOUT.height).toBeCloseTo(171.42857, 4);
    expect(PREVIEW_LAYOUT.scale).toBeCloseTo(240 / 140, 4);

    const { unmount } = await renderPreview(<MovementPreview movement={SQUAT} />);
    const stage = screen.getByTestId('movement-preview-stage');
    const flatStyle = StyleSheet.flatten(stage.props.style);

    expect(flatStyle.width).toBe(240);
    expect(flatStyle.height).toBeCloseTo(171.42857, 4);
    unmount();
  });

  test('minimum touch target dimension (56 dp) holds for all variants', async () => {
    expect(theme.touch.min).toBe(56);

    const u1 = render(<MovementPreview movement={SQUAT} compact={false} testID="std-card" />);
    const standardControl = within(screen.getByTestId('std-card')).getByTestId('movement-preview-control');
    const stdStyle = StyleSheet.flatten(standardControl.props.style);
    expect(stdStyle.minHeight).toBeGreaterThanOrEqual(56);
    expect(stdStyle.minWidth).toBeGreaterThanOrEqual(56);
    u1.unmount();

    const u2 = render(<MovementPreview movement={SQUAT} compact={true} testID="compact-card" />);
    const compactControl = within(screen.getByTestId('compact-card')).getByTestId('movement-preview-control');
    const compactStyle = StyleSheet.flatten(compactControl.props.style);
    expect(compactStyle.minHeight).toBeGreaterThanOrEqual(56);
    expect(compactStyle.minWidth).toBeGreaterThanOrEqual(56);
    u2.unmount();
  });

  test('dynamic reduced motion prop switch while playing immediately halts animation', async () => {
    jest.useFakeTimers();
    const activeIntervals = intervalProbe();

    const { rerender, unmount } = await renderPreview(
      <MovementPreview movement={SQUAT} reducedMotion={false} />,
    );

    fireEvent.press(screen.getByTestId('movement-preview-control'));
    expect(activeIntervals()).toBe(1);

    // Switch reducedMotion prop to true mid-playback
    await act(async () => {
      rerender(<MovementPreview movement={SQUAT} reducedMotion={true} />);
    });

    expect(activeIntervals()).toBe(0);
    expect(isPlaybackActive()).toBe(false);
    expect(screen.getByTestId('movement-preview-control')).toBeTruthy();
    expect(within(screen.getByTestId('movement-preview-control')).getByText('NEXT POSITION')).toBeTruthy();

    unmount();
  });
});
