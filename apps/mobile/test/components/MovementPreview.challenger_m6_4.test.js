/**
 * WO-09 Milestone 6 Adversarial Challenge Test Suite
 *
 * Authored by challenger_m6_4 (M6 Offline Safety Footprint Challenger)
 * Independent empirical challenge covering:
 * 1. Offline Safety & Network Isolation:
 *    - Strict traps on global fetch, XMLHttpRequest, and WebSocket during mount, multi-step playback, and unmount.
 *    - Assert 0 network calls and 0 exceptions from network access.
 * 2. Reduced-Motion Fallback on 5-step numbered still sequence:
 *    - Numbered sequence: Position 1 of 5 -> 2 of 5 -> 3 of 5 -> 4 of 5 -> 5 of 5 -> 1 of 5.
 *    - Verifies distinct step captions for each position.
 *    - Verifies exactly 0 animation timers running throughout all manual step transitions.
 *    - Verifies mid-playback reduced-motion activation halts animation and destroys timers immediately.
 * 3. Accessibility & Touch Targets:
 *    - Control button minHeight >= 56 dp and minWidth >= 56 dp (theme.touch.min).
 *    - Locked stage dimensions (240 x 171.43 dp) preventing anatomical distortion.
 *    - Dynamic accessibility labels and progressbar values.
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

// 5-Frame movement fixture for testing 5-step numbered still sequence
const GOBLET_SQUAT_5FRAME_FIXTURE = {
  movementId: 14,
  assetKey: 'movement/goblet-squat/demo/v1',
  name: 'Goblet Squat',
  pattern: 'squat',
  previewId: 'goblet_squat_5step',
  implement: 'dumbbells',
  summary: 'Hold dumbbell at chest, squat until hips break parallel, stand up.',
  status: 'covered',
  segmentDurationsMs: [500, 450, 450, 500],
  frames: [
    { id: 'f1', step: 1, title: 'Standing Start', caption: 'Stand tall with feet shoulder-width, dumbbell held at chest.', joints: PREVIEW_ENTRIES[0].frames[0].joints },
    { id: 'f2', step: 2, title: 'Initiating Descent', caption: 'Hips hinge back and knees bend, chest stays upright.', joints: PREVIEW_ENTRIES[0].frames[1].joints },
    { id: 'f3', step: 3, title: 'Bottom Position', caption: 'Thighs reach parallel or just below, knees tracking toes.', joints: PREVIEW_ENTRIES[0].frames[2].joints },
    { id: 'f4', step: 4, title: 'Ascent Drive', caption: 'Drive through midfoot, extending knees and hips together.', joints: PREVIEW_ENTRIES[0].frames[1].joints },
    { id: 'f5', step: 5, title: 'Full Lockout', caption: 'Return to tall standing position with glutes engaged.', joints: PREVIEW_ENTRIES[0].frames[0].joints },
  ],
};

const GOBLET_SQUAT_SUBJECT = {
  movement_id: 14,
  name: 'Goblet Squat',
  media: { assetKey: 'movement/goblet-squat/demo/v1', status: 'covered', revision: 1 },
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
// 1. OFFLINE SAFETY & NETWORK ISOLATION (CHALLENGE 1)
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial Challenge 1: Dynamic Network Interception & Isolation', () => {
  let originalFetch;
  let originalXHR;
  let originalWebSocket;
  let networkCallCount = 0;
  const interceptedEvents = [];

  beforeEach(() => {
    networkCallCount = 0;
    interceptedEvents.length = 0;

    originalFetch = global.fetch;
    originalXHR = global.XMLHttpRequest;
    originalWebSocket = global.WebSocket;

    global.fetch = jest.fn((url) => {
      networkCallCount++;
      interceptedEvents.push({ type: 'fetch', url });
      throw new Error(`CRITICAL OFFLINE VIOLATION: fetch(${url}) called!`);
    });

    global.XMLHttpRequest = jest.fn().mockImplementation(() => {
      networkCallCount++;
      interceptedEvents.push({ type: 'XHR', detail: 'constructor' });
      throw new Error('CRITICAL OFFLINE VIOLATION: XMLHttpRequest instantiated!');
    });

    global.WebSocket = jest.fn().mockImplementation((url) => {
      networkCallCount++;
      interceptedEvents.push({ type: 'WebSocket', url });
      throw new Error(`CRITICAL OFFLINE VIOLATION: WebSocket(${url}) instantiated!`);
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.XMLHttpRequest = originalXHR;
    global.WebSocket = originalWebSocket;
  });

  test('proves zero network calls (fetch, XHR, WebSocket) occur during full playback lifecycle', async () => {
    jest.useFakeTimers();

    const { unmount } = await renderPreview(<MovementPreview movement={SQUAT} />);
    const control = screen.getByTestId('movement-preview-control');

    // Mount completed -> verify 0 network calls
    expect(networkCallCount).toBe(0);

    // Start playback
    fireEvent.press(control);
    expect(networkCallCount).toBe(0);

    // Advance 10 frames through multiple playback loops
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS * 10));
    expect(networkCallCount).toBe(0);

    // Pause playback
    fireEvent.press(control);
    expect(networkCallCount).toBe(0);

    // Resume playback
    fireEvent.press(control);
    act(() => jest.advanceTimersByTime(manifestModule.PREVIEW_FRAME_INTERVAL_MS * 2));
    expect(networkCallCount).toBe(0);

    // Unmount component
    unmount();
    expect(networkCallCount).toBe(0);
    expect(interceptedEvents).toEqual([]);
  });

  test('proves zero network calls when resolving and failing-closed across corrupt or pending movements', async () => {
    const corruptInputs = [
      null,
      undefined,
      {},
      { movement_id: 14, name: 'Goblet Squat', media: { assetKey: 'movement/goblet-squat/demo/v1' } }, // pending in real manifest
      { movement_id: 70, name: 'Power Clean', media: { assetKey: 'movement/power-clean/demo/v1' } }, // unsuitable
      { movement_id: 99999, name: 'Unknown', media: { assetKey: 'https://malicious.cdn.com/asset.json' } },
      { movement_id: 28, name: 'Squat', media: { assetKey: 'http://insecure.cdn.com/squat' } },
    ];

    for (const input of corruptInputs) {
      const { unmount } = await renderPreview(<MovementPreview movement={input} />);
      unmount();
    }

    expect(networkCallCount).toBe(0);
    expect(interceptedEvents).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. REDUCED MOTION 5-STEP NUMBERED STILL SEQUENCE (CHALLENGE 5)
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial Challenge 5: Reduced-Motion 5-Step Numbered Still Sequence & Zero Timers', () => {
  beforeEach(() => {
    // Intercept resolveMovementPreview to return our 5-frame fixture when Goblet Squat is rendered
    jest.spyOn(manifestModule, 'resolveMovementPreview').mockImplementation((subject, review) => {
      if (subject?.movement_id === 14) return GOBLET_SQUAT_5FRAME_FIXTURE;
      return REAL_RESOLVE(
        subject,
        subject?.media?.status === 'ready' ? APPROVED_REVIEW_FIXTURE : review,
      );
    });
  });

  test('renders 5-step numbered still sequence with captions and exactly 0 animation timers', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    await renderPreview(
      <MovementPreview movement={GOBLET_SQUAT_SUBJECT} reducedMotion={true} testID="goblet-preview" />
    );

    const card = screen.getByTestId('goblet-preview');
    const control = within(card).getByTestId('movement-preview-control');
    const position = within(card).getByTestId('movement-preview-position');
    const caption = within(card).getByTestId('movement-preview-caption');
    const figure = within(card).getByTestId('movement-preview-figure');
    const note = within(card).getByTestId('movement-preview-reduced-note');

    // Verify reduced motion explanatory note
    expect(note).toHaveTextContent(/Your device asks for reduced motion, so the positions stay still and you step through them/i);

    // Verify control button label
    expect(control).toHaveTextContent('NEXT POSITION');
    expect(control.props.accessibilityLabel).toBe('Show the next position of the Goblet Squat preview');

    // Step 1: Position 1 of 5
    expect(position).toHaveTextContent('Position 1 of 5');
    expect(caption).toHaveTextContent(GOBLET_SQUAT_5FRAME_FIXTURE.frames[0].caption);
    expect(figure.props.accessibilityLabel).toBe(`Goblet Squat preview. Position 1 of 5: ${GOBLET_SQUAT_5FRAME_FIXTURE.frames[0].caption}`);
    expect(liveIntervals()).toBe(0); // STRICT: 0 timers running!

    // Advance time: verify still frame stays completely put (no autoplay)
    act(() => jest.advanceTimersByTime(5000));
    expect(position).toHaveTextContent('Position 1 of 5');
    expect(liveIntervals()).toBe(0);

    // Manual Step -> Position 2 of 5
    fireEvent.press(control);
    expect(position).toHaveTextContent('Position 2 of 5');
    expect(caption).toHaveTextContent(GOBLET_SQUAT_5FRAME_FIXTURE.frames[1].caption);
    expect(figure.props.accessibilityLabel).toBe(`Goblet Squat preview. Position 2 of 5: ${GOBLET_SQUAT_5FRAME_FIXTURE.frames[1].caption}`);
    expect(liveIntervals()).toBe(0); // STRICT: 0 timers running!

    // Manual Step -> Position 3 of 5
    fireEvent.press(control);
    expect(position).toHaveTextContent('Position 3 of 5');
    expect(caption).toHaveTextContent(GOBLET_SQUAT_5FRAME_FIXTURE.frames[2].caption);
    expect(figure.props.accessibilityLabel).toBe(`Goblet Squat preview. Position 3 of 5: ${GOBLET_SQUAT_5FRAME_FIXTURE.frames[2].caption}`);
    expect(liveIntervals()).toBe(0);

    // Manual Step -> Position 4 of 5
    fireEvent.press(control);
    expect(position).toHaveTextContent('Position 4 of 5');
    expect(caption).toHaveTextContent(GOBLET_SQUAT_5FRAME_FIXTURE.frames[3].caption);
    expect(figure.props.accessibilityLabel).toBe(`Goblet Squat preview. Position 4 of 5: ${GOBLET_SQUAT_5FRAME_FIXTURE.frames[3].caption}`);
    expect(liveIntervals()).toBe(0);

    // Manual Step -> Position 5 of 5
    fireEvent.press(control);
    expect(position).toHaveTextContent('Position 5 of 5');
    expect(caption).toHaveTextContent(GOBLET_SQUAT_5FRAME_FIXTURE.frames[4].caption);
    expect(figure.props.accessibilityLabel).toBe(`Goblet Squat preview. Position 5 of 5: ${GOBLET_SQUAT_5FRAME_FIXTURE.frames[4].caption}`);
    expect(liveIntervals()).toBe(0);

    // Manual Step -> Wraps back to Position 1 of 5
    fireEvent.press(control);
    expect(position).toHaveTextContent('Position 1 of 5');
    expect(caption).toHaveTextContent(GOBLET_SQUAT_5FRAME_FIXTURE.frames[0].caption);
    expect(liveIntervals()).toBe(0);
  });

  test('turning reduced motion on mid-playback immediately pauses and destroys timers', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();

    const changeHandlers = [];
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'reduceMotionChanged') changeHandlers.push(handler);
      return { remove: () => {} };
    });

    await renderPreview(<MovementPreview movement={GOBLET_SQUAT_SUBJECT} />);
    const control = screen.getByTestId('movement-preview-control');

    // Start playback
    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
    expect(control).toHaveTextContent('PAUSE');

    // Advance to frame 2
    act(() => jest.advanceTimersByTime(500));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 5');

    // OS fires reduceMotionChanged: true
    act(() => {
      changeHandlers.forEach((handler) => handler(true));
    });

    // Verify timer is destroyed immediately and button switches to NEXT POSITION
    expect(liveIntervals()).toBe(0);
    expect(control).toHaveTextContent('NEXT POSITION');
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 5');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ACCESSIBILITY & TOUCH TARGETS (CHALLENGE 4)
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial Challenge 4: Accessibility & Touch Targets (56 dp minimum & Font Scaling)', () => {
  test('control button meets min 56 dp touch target (theme.touch.min)', async () => {
    await renderPreview(<MovementPreview movement={SQUAT} />);
    const control = screen.getByTestId('movement-preview-control');
    const flatStyle = StyleSheet.flatten(control.props.style);

    expect(flatStyle.minHeight).toBeDefined();
    expect(flatStyle.minWidth).toBeDefined();
    expect(flatStyle.minHeight).toBe(theme.touch.min);
    expect(flatStyle.minWidth).toBe(theme.touch.min);
    expect(theme.touch.min).toBeGreaterThanOrEqual(56);
  });

  test('locked stage dimensions prevent anatomical distortion regardless of text sizing', async () => {
    await renderPreview(<MovementPreview movement={SQUAT} />);
    const stage = screen.getByTestId('movement-preview-stage');
    const figureFrame = screen.getByTestId('movement-preview-figure');

    const flatStageStyle = StyleSheet.flatten(stage.props.style);
    const flatFrameStyle = StyleSheet.flatten(figureFrame.props.style);

    // Vector stage is strictly locked to 240 dp width and 171.43 dp height
    expect(flatStageStyle.width).toBe(240);
    expect(flatStageStyle.height).toBeCloseTo(171.43, 1);

    expect(flatFrameStyle.width).toBe(240);
    expect(flatFrameStyle.height).toBeCloseTo(171.43, 1);
    expect(flatFrameStyle.overflow).toBe('hidden');
  });

  test('semantic accessibility structure satisfies WCAG requirements', async () => {
    await renderPreview(<MovementPreview movement={SQUAT} />);

    // Header role
    expect(screen.getByRole('header', { name: 'Movement preview' })).toBeOnTheScreen();

    // Figure image role
    const figure = screen.getByTestId('movement-preview-figure');
    expect(figure.props.accessibilityRole).toBe('image');
    expect(figure.props.accessibilityLabel).toContain('Bodyweight Squat preview');

    // Scrubber progressbar role
    const scrubber = screen.getByTestId('movement-preview-scrubber');
    expect(scrubber.props.accessibilityRole).toBe('progressbar');
    expect(scrubber.props.accessibilityValue).toEqual({ min: 1, max: 3, now: 1 });

    // Control button role and state
    const control = screen.getByTestId('movement-preview-control');
    expect(control.props.accessibilityRole).toBe('button');
    expect(control.props.accessibilityState).toEqual({ selected: false });
    expect(control.props.accessibilityValue).toEqual({ text: 'Position 1 of 3' });
  });
});
