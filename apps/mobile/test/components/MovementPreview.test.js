/**
 * WO-09A — offline movement preview prototype.
 *
 * These tests hold the rules the work order names: identity by canonical id and
 * asset key (never by display name), no autoplay, one player at a time, no
 * timer under reduced motion, nothing left running after unmount or
 * backgrounding, and an unchanged fallback for every movement the prototype
 * does not cover.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { AccessibilityInfo, AppState, StyleSheet, Text } from 'react-native';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MovementPreview, PREVIEW_LAYOUT } from '../../src/components/movementPreview';
import {
  previewEntries,
  PREVIEW_FRAME_INTERVAL_MS,
  PREVIEW_TECHNIQUE_REVIEW,
  resolveMovementPreview,
} from '../../src/components/movementPreview/manifest';

// R2 Part C loads one family per shown movement; this suite reads every entry,
// so it loads every family once and keeps the list.
import * as manifestModule from '../../src/components/movementPreview/manifest';
import { resetPreviewPlayback } from '../../src/components/movementPreview/playbackCoordinator';
import { theme } from '../../src/theme/theme';

// R2 Part C loads one family per shown movement; this suite reads every entry,
// so it loads every family once and keeps the list.
const PREVIEW_ENTRIES = previewEntries();

// Hypothetical-approval fixtures: these three prototype subjects stand in for
// what an APPROVED movement's subject will look like (DB media `ready`). The
// resolver wrapper below passes the labelled review fixture for them ONLY;
// every other subject keeps failing closed through the real resolver while
// the manifest's qualified review is pending (see MovementPreview.approval).
const SQUAT = { movement_id: 28, name: 'Bodyweight Squat', media: { assetKey: 'movement/bodyweight-squat/demo/v1', status: 'ready', revision: 1, fallbackUrl: null } };
const PUSH_UP = { movement_id: 16, name: 'Push-up', media: { assetKey: 'movement/push-up/demo/v1', status: 'ready', revision: 1, fallbackUrl: null } };
const RDL = { movement_id: 88, name: 'Dumbbell Romanian Deadlift', media: { assetKey: 'movement/dumbbell-romanian-deadlift/demo/v1', status: 'ready', revision: 1, fallbackUrl: null } };

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

// The compact family file (R2 Part C) carries the drawn data; the authoring
// metadata lives in movementPreviewManifest.json, the source of truth. The
// metadata laws (R5 completeness, F-1 caption support) speak about the
// manifest's content, so entryFor reads it there; PREVIEW_ENTRIES stays the
// runtime resolution the shipped files produce.
const sourceEntries = require('../../src/components/movementPreview/movementPreviewManifest.json').entries;
const entryFor = (movementId) => sourceEntries.find((entry) => entry.movementId === movementId);

/**
 * Counts the animation timers this component owns, and only those: jest's own
 * timer count includes whatever React Native's press handling schedules, which
 * would make "no animation timer" vacuous. Install after jest.useFakeTimers().
 */
function intervalProbe() {
  const started = jest.spyOn(global, 'setInterval');
  const cleared = jest.spyOn(global, 'clearInterval');
  return () => {
    const stopped = new Set(cleared.mock.calls.map((call) => call[0]));
    return started.mock.results.map((result) => result.value).filter((id) => !stopped.has(id)).length;
  };
}

/** Mounts with a known reduced-motion answer and lets the OS promise settle. */
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

// ── identity ─────────────────────────────────────────────────────────────────

describe('preview identity', () => {
  test('each covered movement id selects its own preview, not another', () => {
    const squat = resolveMovementPreview(SQUAT);
    const pushUp = resolveMovementPreview(PUSH_UP);
    const rdl = resolveMovementPreview(RDL);

    expect(squat.previewId).toBe('bodyweight_squat');
    expect(pushUp.previewId).toBe('push_up');
    expect(rdl.previewId).toBe('dumbbell_rdl');
    expect(new Set([squat.previewId, pushUp.previewId, rdl.previewId]).size).toBe(3);

    // The drawings are mechanically distinct, not one animation reused.
    expect(squat.frames[0].caption).toMatch(/shoulder width/i);
    expect(pushUp.frames[0].caption).toMatch(/head to heels/i);
    expect(rdl.frames[0].caption).toMatch(/dumbbells resting on the front of the thighs/i);
    expect(squat.pattern).toBe('squat');
    expect(pushUp.pattern).toBe('push_h');
    expect(rdl.pattern).toBe('hinge');
  });

  test('a matching display name never selects a preview — both canonical keys must agree', () => {
    // Same name and same asset key, unknown id.
    expect(resolveMovementPreview({ ...SQUAT, movement_id: 9999 })).toBeNull();
    // Covered id, but the media identity belongs to a different movement.
    expect(resolveMovementPreview({
      ...SQUAT,
      media: { ...SQUAT.media, assetKey: 'movement/goblet-squat/demo/v1' },
    })).toBeNull();
    // Covered id and key, renamed movement: the rename changes nothing.
    expect(resolveMovementPreview({ ...SQUAT, name: 'Air Squat' }).previewId).toBe('bodyweight_squat');
    // No media row at all: fail closed.
    expect(resolveMovementPreview({ ...SQUAT, media: null })).toBeNull();
  });

  test('a movement without a covered preview renders nothing at all', async () => {
    // Not "renders an empty card": the host screen must be able to lay itself
    // out as though this component did not exist.
    const { toJSON } = await renderPreview(
      <MovementPreview movement={{ movement_id: 14, name: 'Goblet Squat', media: { assetKey: 'movement/goblet-squat/demo/v1' } }} />,
    );
    expect(toJSON()).toBeNull();
  });

  test('unknown, pending and intentionally unsuitable movements resolve to nothing', () => {
    expect(resolveMovementPreview({ movement_id: 4242, name: 'Nothing', media: { assetKey: 'movement/nothing/demo/v1' } })).toBeNull();

    const goblet = entryFor(14);
    expect(goblet.status).toBe('pending');
    expect(goblet.reason.length).toBeGreaterThan(40);
    expect(resolveMovementPreview({ movement_id: 14, name: 'Goblet Squat', media: { assetKey: goblet.assetKey } })).toBeNull();

    const powerClean = entryFor(70);
    expect(powerClean.status).toBe('intentionally_unsuitable');
    expect(resolveMovementPreview({ movement_id: 70, name: 'Power Clean', media: { assetKey: powerClean.assetKey } })).toBeNull();
  });
});

// ── manifest ─────────────────────────────────────────────────────────────────

describe('preview manifest', () => {
  test('exactly three covered movements, three frames each, one per mechanical pattern', () => {
    const covered = PREVIEW_ENTRIES.filter((entry) => entry.status === 'covered');
    expect(covered).toHaveLength(3);
    expect(covered.map((entry) => entry.pattern).sort()).toEqual(['hinge', 'push_h', 'squat']);
    for (const entry of covered) {
      expect(entry.frames).toHaveLength(3);
      expect(new Set(entry.frames.map((frame) => frame.id)).size).toBe(3);
      for (const frame of entry.frames) expect(frame.caption.length).toBeGreaterThan(10);
    }
    expect(new Set(PREVIEW_ENTRIES.map((entry) => entry.movementId)).size).toBe(PREVIEW_ENTRIES.length);
    expect(new Set(PREVIEW_ENTRIES.map((entry) => entry.assetKey)).size).toBe(PREVIEW_ENTRIES.length);
  });

  test('one character: every bone keeps its length in every frame of every movement', () => {
    const lengths = new Map();
    for (const entry of PREVIEW_ENTRIES) {
      if (entry.status !== 'covered') continue;
      for (const frame of entry.frames) {
        for (const [from, to] of [['heel', 'toe'], ['ankle', 'knee'], ['knee', 'hip'], ['hip', 'shoulder'], ['shoulder', 'elbow'], ['elbow', 'hand'], ['shoulder', 'head']]) {
          const a = frame.joints[from];
          const b = frame.joints[to];
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const seen = lengths.get(`${from}-${to}`) ?? [];
          seen.push(length);
          lengths.set(`${from}-${to}`, seen);
        }
      }
    }
    for (const [bone, seen] of lengths) {
      const min = Math.min(...seen);
      const max = Math.max(...seen);
      expect(seen).toHaveLength(9); // 3 movements x 3 frames
      expect(max - min).toBeLessThan(0.5); // rounded to 0.1 in the manifest
      expect(`${bone}:${min > 1}`).toBe(`${bone}:true`);
    }
  });

  test('technique review is reported as pending, and no clinical claim is made', () => {
    expect(PREVIEW_TECHNIQUE_REVIEW.status).toBe('pending');
    // R2 Part C: the data is the index plus one file per family; this scan
    // covers every one of them.
    const previewDir = path.join(__dirname, '..', '..', 'src', 'components', 'movementPreview');
    const manifest = [
      path.join(previewDir, 'previewIndex.json'),
      ...fs.readdirSync(path.join(previewDir, 'families'))
        .map((name) => path.join(previewDir, 'families', name)),
    ].map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    expect(manifest).not.toMatch(/prevent injury|injury prevention|pain-free|safe for|certified|physiotherap|guarantee/i);
  });

  test('no network or runtime-fetch path exists in the preview module', () => {
    const dir = path.join(__dirname, '..', '..', 'src', 'components', 'movementPreview');
    // R2 Part C put the family files in a subdirectory: walk the tree, never
    // skip a directory, so every shipped preview file (module or data) is read.
    const walk = (root) => fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(root, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
    const files = walk(dir);
    expect(files.length).toBeGreaterThan(3);
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/https?:\/\//);
      expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebView|NetInfo|\.download\b/);
      // No remote or file-backed image source either: the figure is drawn.
      expect(source).not.toMatch(/\bImage\b|\brequire\(['"][^'"]*\.(png|jpg|gif|svg)/);
    }
  });
});

// ── layout ───────────────────────────────────────────────────────────────────

describe('preview layout', () => {
  /** The box the drawing actually occupies, in manifest units. */
  const drawnBand = (entry) => {
    const radius = 6; // head radius, from the manifest character
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = 96; // the ground line is part of the drawing
    for (const frame of entry.frames) {
      for (const [name, point] of Object.entries(frame.joints)) {
        const margin = name === 'head' ? radius : 0;
        minX = Math.min(minX, point[0] - margin);
        maxX = Math.max(maxX, point[0] + margin);
        minY = Math.min(minY, point[1] - margin);
        maxY = Math.max(maxY, point[1] + margin);
      }
    }
    return { minX, maxX, minY, maxY };
  };

  const stageOffset = () => {
    const transform = StyleSheet.flatten(screen.getByTestId('movement-preview-stage').props.style).transform;
    const translateX = transform.find((entry) => 'translateX' in entry).translateX;
    const translateY = transform.find((entry) => 'translateY' in entry).translateY;
    return { dx: translateX / PREVIEW_LAYOUT.scale, dy: translateY / PREVIEW_LAYOUT.scale };
  };

  test.each([['push-up', PUSH_UP, 16], ['squat', SQUAT, 28], ['deadlift', RDL, 88]])(
    'the %s drawing sits in the middle of its box, with equal margins',
    async (_label, movement, movementId) => {
      await renderPreview(<MovementPreview movement={movement} />);
      const { dx, dy } = stageOffset();
      const band = drawnBand(entryFor(movementId));
      // Equal margins top/bottom and left/right is what "centred" means; a
      // push-up otherwise sits in the bottom third with an empty card above it.
      expect(band.minY + dy).toBeCloseTo(100 - (band.maxY + dy), 1);
      expect(band.minX + dx).toBeCloseTo(140 - (band.maxX + dx), 1);
    },
  );

  test('the character does not jump: one offset serves every frame', async () => {
    jest.useFakeTimers();
    await renderPreview(<MovementPreview movement={PUSH_UP} />);
    const first = stageOffset();
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    for (const position of ['Position 2 of 3', 'Position 3 of 3']) {
      act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS));
      expect(screen.getByTestId('movement-preview-position')).toHaveTextContent(position);
      expect(stageOffset()).toEqual(first);
    }
  });
});

// ── playback ─────────────────────────────────────────────────────────────────

describe('preview playback', () => {
  test('never autoplays: the still frame stays put and no timer is running', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();
    await renderPreview(<MovementPreview movement={SQUAT} />);

    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 1 of 3');
    expect(liveIntervals()).toBe(0);
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS * 10));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 1 of 3');
    expect(screen.getByTestId('movement-preview-control')).toHaveTextContent('PLAY');
  });

  test('play advances the frames and pause stops them where they are', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();
    await renderPreview(<MovementPreview movement={PUSH_UP} />);
    const control = screen.getByTestId('movement-preview-control');

    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 3');
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS * 2));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 1 of 3');

    fireEvent.press(screen.getByTestId('movement-preview-control'));
    expect(liveIntervals()).toBe(0);
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS * 5));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 1 of 3');
  });

  test('only one preview plays at a time', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();
    await renderPreview(
      <>
        <MovementPreview movement={SQUAT} />
        <MovementPreview movement={PUSH_UP} />
      </>,
    );
    const squat = screen.getByTestId('movement-preview-28');
    const pushUp = screen.getByTestId('movement-preview-16');
    const controlIn = (card) => card.findByProps({ testID: 'movement-preview-control' });
    const positionOf = (card) => card.findByProps({ testID: 'movement-preview-position' }).props.children;

    fireEvent.press(controlIn(squat));
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS));
    expect(positionOf(squat)).toBe('Position 2 of 3');

    fireEvent.press(controlIn(pushUp));
    expect(liveIntervals()).toBe(1);
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS * 2));
    expect(positionOf(pushUp)).toBe('Position 3 of 3');
    expect(positionOf(squat)).toBe('Position 2 of 3');
  });

  test('leaving the foreground stops playback', async () => {
    jest.useFakeTimers();
    const listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      listeners.push({ event, handler });
      return { remove: () => {} };
    });
    const liveIntervals = intervalProbe();
    await renderPreview(<MovementPreview movement={RDL} />);
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    expect(liveIntervals()).toBe(1);

    act(() => listeners.filter((l) => l.event === 'change').forEach((l) => l.handler('background')));
    expect(liveIntervals()).toBe(0);
    expect(screen.getByTestId('movement-preview-control')).toHaveTextContent('PLAY');
  });

  test('unmounting a playing preview leaves no timer behind', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();
    const { unmount } = await renderPreview(<MovementPreview movement={SQUAT} />);
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    expect(liveIntervals()).toBe(1);
    unmount();
    expect(liveIntervals()).toBe(0);
  });
});

// ── reduced motion ───────────────────────────────────────────────────────────

describe('reduced motion', () => {
  test('shows a still sequence, starts no timer, and steps on demand', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();
    await renderPreview(<MovementPreview movement={SQUAT} />, { reduceMotion: true });

    expect(screen.queryByLabelText('Play the Bodyweight Squat preview')).not.toBeOnTheScreen();
    expect(screen.getByTestId('movement-preview-reduced-note')).toBeOnTheScreen();
    const control = screen.getByTestId('movement-preview-control');
    expect(control).toHaveTextContent('NEXT POSITION');

    fireEvent.press(control);
    expect(liveIntervals()).toBe(0);
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 3');
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS * 4));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 3');
  });

  test('turning reduced motion on mid-playback stops the animation', async () => {
    jest.useFakeTimers();
    const changeHandlers = [];
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'reduceMotionChanged') changeHandlers.push(handler);
      return { remove: () => {} };
    });
    const liveIntervals = intervalProbe();
    await renderPreview(<MovementPreview movement={SQUAT} />);
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    expect(liveIntervals()).toBe(1);
    expect(changeHandlers.length).toBeGreaterThan(0);

    act(() => changeHandlers.forEach((handler) => handler(true)));
    expect(liveIntervals()).toBe(0);
    expect(screen.getByTestId('movement-preview-control')).toHaveTextContent('NEXT POSITION');
  });
});

// ── accessibility ────────────────────────────────────────────────────────────

describe('preview accessibility', () => {
  test('heading, truthful figure label and a 56 dp control that reports its own state', async () => {
    await renderPreview(<MovementPreview movement={RDL} />);

    expect(screen.getByRole('header', { name: 'Movement preview' })).toBeOnTheScreen();
    const figure = screen.getByTestId('movement-preview-figure');
    expect(figure.props.accessibilityRole).toBe('image');
    expect(figure.props.accessibilityLabel)
      .toBe(`Dumbbell Romanian Deadlift preview. Position 1 of 3: ${entryFor(88).frames[0].caption}`);

    const control = screen.getByTestId('movement-preview-control');
    expect(control.props.accessibilityRole).toBe('button');
    expect(control.props.accessibilityLabel).toBe('Play the Dumbbell Romanian Deadlift preview');
    expect(control.props.accessibilityState.selected).toBe(false);
    expect(control.props.accessibilityValue.text).toBe('Position 1 of 3');
    expect(StyleSheet.flatten(control.props.style)).toMatchObject({
      minHeight: theme.touch.min,
      minWidth: theme.touch.min,
    });

    fireEvent.press(control);
    const playing = screen.getByTestId('movement-preview-control');
    expect(playing.props.accessibilityLabel).toBe('Pause the Dumbbell Romanian Deadlift preview');
    expect(playing.props.accessibilityState.selected).toBe(true);
    fireEvent.press(playing);
  });

  test('the figure label follows the frame that is actually shown', async () => {
    jest.useFakeTimers();
    await renderPreview(<MovementPreview movement={PUSH_UP} />);
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS));
    expect(screen.getByTestId('movement-preview-figure').props.accessibilityLabel)
      .toBe(`Push-up preview. Position 2 of 3: ${entryFor(16).frames[1].caption}`);
    expect(screen.getByTestId('movement-preview-caption')).toHaveTextContent(entryFor(16).frames[1].caption);
  });
});

// ── 1. Canonical 12-Movement Manifest Resolution & Truth State Safety (R5) ──

describe('canonical 12-movement manifest resolution (R5)', () => {
  const CANONICAL_12 = [
    { id: 14, slug: 'goblet-squat', name: 'Goblet Squat', pattern: 'squat' },
    { id: 9, slug: 'romanian-deadlift', name: 'Romanian Deadlift', pattern: 'hinge' },
    { id: 15, slug: 'kettlebell-swing', name: 'Kettlebell Swing', pattern: 'hinge' },
    { id: 10, slug: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', pattern: 'push_h' },
    { id: 11, slug: 'dumbbell-shoulder-press', name: 'Dumbbell Shoulder Press', pattern: 'push_v' },
    { id: 12, slug: 'single-arm-dumbbell-row', name: 'Single-Arm Dumbbell Row', pattern: 'pull_h' },
    { id: 21, slug: 'lat-pulldown', name: 'Lat Pulldown', pattern: 'pull_v' },
    { id: 54, slug: 'dumbbell-split-squat', name: 'Dumbbell Split Squat', pattern: 'lunge' },
    { id: 17, slug: 'walking-lunge', name: 'Walking Lunge', pattern: 'lunge' },
    { id: 19, slug: 'farmer-carry', name: 'Farmer Carry', pattern: 'carry' },
    { id: 39, slug: 'cable-crunch', name: 'Cable Crunch', pattern: 'rotation' },
    { id: 62, slug: 'hammer-curl', name: 'Hammer Curl', pattern: 'isolation' },
  ];

  test.each(CANONICAL_12)(
    'canonical movement $name ($id) resolves in manifest with complete metadata and pending status',
    ({ id, slug, pattern }) => {
      const entry = entryFor(id);
      expect(entry).toBeDefined();
      expect(entry.assetKey).toBe(`movement/${slug}/demo/v1`);
      expect(entry.status).toBe('pending');
      expect(entry.pattern).toBe(pattern);
      expect(entry.reason.length).toBeGreaterThan(20);
      expect(entry.instructions?.length).toBeGreaterThan(10);
      expect(entry.cues?.length).toBeGreaterThan(10);
      expect(entry.techniqueCitations?.length).toBeGreaterThan(0);
    },
  );

  test('formerly null canonical IDs (54, 39, 62) correctly resolve to database IDs', () => {
    expect(entryFor(54).assetKey).toBe('movement/dumbbell-split-squat/demo/v1');
    expect(entryFor(39).assetKey).toBe('movement/cable-crunch/demo/v1');
    expect(entryFor(62).assetKey).toBe('movement/hammer-curl/demo/v1');
  });

  test('all 12 pending movements fail closed to null in resolveMovementPreview to protect athlete safety', () => {
    for (const { id, slug, name } of CANONICAL_12) {
      const subject = {
        movement_id: id,
        name,
        media: { assetKey: `movement/${slug}/demo/v1`, status: 'external_fallback' },
      };
      expect(resolveMovementPreview(subject)).toBeNull();
    }
  });
});

// ── 2. Truth State Fallbacks & Input Resilience (R5) ─────────────────────────

describe('truth state fallbacks and input resilience (R5)', () => {
  test('covered movement renders complete interactive preview card with all controls', async () => {
    await renderPreview(<MovementPreview movement={SQUAT} />);
    expect(screen.getByTestId('movement-preview-28')).toBeOnTheScreen();
    expect(screen.getByTestId('movement-preview-figure')).toBeOnTheScreen();
    expect(screen.getByTestId('movement-preview-scrubber')).toBeOnTheScreen();
    expect(screen.getByTestId('movement-preview-control')).toBeOnTheScreen();
  });

  test('compact mode renders figure and controls without verbose card headers or provenance', async () => {
    await renderPreview(<MovementPreview movement={SQUAT} compact={true} testID="test-compact-preview" />);
    expect(screen.getByTestId('test-compact-preview')).toBeOnTheScreen();
    expect(screen.queryByText('Movement preview')).not.toBeOnTheScreen();
    expect(screen.queryByText(/Drawn in the app from its own coaching notes/i)).not.toBeOnTheScreen();
    expect(screen.getByTestId('movement-preview-figure')).toBeOnTheScreen();
    expect(screen.getByTestId('movement-preview-control')).toBeOnTheScreen();
  });

  test('pending movement renders null safely without throwing or crashing host screen', async () => {
    const { toJSON } = await renderPreview(
      <MovementPreview movement={{ movement_id: 14, name: 'Goblet Squat', media: { assetKey: 'movement/goblet-squat/demo/v1' } }} />,
    );
    expect(toJSON()).toBeNull();
  });

  test('unsuitable movement (id 70 Power Clean) renders null safely without throwing', async () => {
    const { toJSON } = await renderPreview(
      <MovementPreview movement={{ movement_id: 70, name: 'Power Clean', media: { assetKey: 'movement/power-clean/demo/v1' } }} />,
    );
    expect(toJSON()).toBeNull();
  });

  test.each([
    ['null movement', null],
    ['undefined movement', undefined],
    ['empty object', {}],
    ['missing media', { movement_id: 28, name: 'Squat' }],
    ['null media', { movement_id: 28, name: 'Squat', media: null }],
    ['null assetKey', { movement_id: 28, name: 'Squat', media: { assetKey: null } }],
    ['negative id', { movement_id: -1, name: 'Invalid', media: { assetKey: 'movement/invalid' } }],
    ['unknown id', { movement_id: 99999, name: 'Unknown', media: { assetKey: 'movement/unknown' } }],
  ])('corrupt or missing movement props (%s) fail closed without crashing', async (_label, prop) => {
    const { toJSON } = await renderPreview(<MovementPreview movement={prop} />);
    expect(toJSON()).toBeNull();
  });
});

// ── 3. Playback Lifecycle: Resume, Single-Cycle & Debounce (R5) ───────────────

describe('playback lifecycle extensions (R5)', () => {
  test('playback resumes from paused position on second control tap', async () => {
    jest.useFakeTimers();
    await renderPreview(<MovementPreview movement={PUSH_UP} />);
    const control = screen.getByTestId('movement-preview-control');

    // Tap PLAY -> advance to Position 2
    fireEvent.press(control);
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 3');

    // Tap PAUSE -> advance time, position holds at 2
    fireEvent.press(control);
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS * 3));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 3');

    // Tap RESUME -> advance 1 frame -> position resumes to 3
    fireEvent.press(control);
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 3 of 3');
  });

  test('rapid double-tap on control button does not duplicate interval timers', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();
    await renderPreview(<MovementPreview movement={SQUAT} />);
    const control = screen.getByTestId('movement-preview-control');

    fireEvent.press(control);
    fireEvent.press(control);
    expect(liveIntervals()).toBe(0);

    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
  });

  test('single-cycle playback plays through segments, auto-pauses at final frame, and replays on subsequent tap', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();
    await renderPreview(<MovementPreview movement={SQUAT} singleCycle={true} />);
    const control = screen.getByTestId('movement-preview-control');

    // Tap PLAY: starts at Position 1
    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);

    // Advance 1 interval -> Position 2
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 3');

    // Advance 1 interval -> Position 3 (final frame)
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 3 of 3');

    // Advance 1 interval -> auto-pauses at final frame: timer cleared, playing becomes false
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS));
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 3 of 3');
    expect(liveIntervals()).toBe(0);
    expect(control).toHaveTextContent('REPLAY');

    // Subsequent tap restarts from frame 0
    fireEvent.press(control);
    expect(liveIntervals()).toBe(1);
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 1 of 3');
  });
});

// ── 4. Mutual Exclusion Deep-Dive (R5) ───────────────────────────────────────

describe('mutual exclusion deep-dive (R5)', () => {
  test('reverse mutual exclusion handoff updates both player control buttons and intervals cleanly', async () => {
    jest.useFakeTimers();
    const liveIntervals = intervalProbe();
    await renderPreview(
      <>
        <MovementPreview movement={SQUAT} />
        <MovementPreview movement={PUSH_UP} />
      </>,
    );
    const squatCard = screen.getByTestId('movement-preview-28');
    const pushUpCard = screen.getByTestId('movement-preview-16');
    const squatControl = squatCard.findByProps({ testID: 'movement-preview-control' });
    const pushUpControl = pushUpCard.findByProps({ testID: 'movement-preview-control' });
    const labelIn = (card) => card.findByProps({ testID: 'movement-preview-control' }).findByType(Text).props.children;

    // Start Squat
    fireEvent.press(squatControl);
    expect(liveIntervals()).toBe(1);
    expect(labelIn(squatCard)).toBe('PAUSE');

    // Push-up preempts Squat
    fireEvent.press(pushUpControl);
    expect(liveIntervals()).toBe(1);
    expect(labelIn(pushUpCard)).toBe('PAUSE');
    expect(labelIn(squatCard)).toBe('PLAY');

    // Squat preempts Push-up back
    fireEvent.press(squatControl);
    expect(liveIntervals()).toBe(1);
    expect(labelIn(squatCard)).toBe('PAUSE');
    expect(labelIn(pushUpCard)).toBe('PLAY');
  });
});

// ── 5. AppState Transitions & Foreground Safety (R5) ─────────────────────────

describe('appstate transitions (R5)', () => {
  test('appstate transition to inactive pauses playback, and active does not auto-resume', async () => {
    jest.useFakeTimers();
    const listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      listeners.push({ event, handler });
      return { remove: () => {} };
    });
    const liveIntervals = intervalProbe();
    await renderPreview(<MovementPreview movement={RDL} />);
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    expect(liveIntervals()).toBe(1);

    // Transition to inactive (e.g. iOS app switcher or incoming call)
    act(() => listeners.filter((l) => l.event === 'change').forEach((l) => l.handler('inactive')));
    expect(liveIntervals()).toBe(0);
    expect(screen.getByTestId('movement-preview-control')).toHaveTextContent('PLAY');

    // Return to active -> must stay paused
    act(() => listeners.filter((l) => l.event === 'change').forEach((l) => l.handler('active')));
    expect(liveIntervals()).toBe(0);
    expect(screen.getByTestId('movement-preview-control')).toHaveTextContent('PLAY');
  });
});

// ── 6. Accessibility & High Font Scale 1.30 (R5) ─────────────────────────────

describe('accessibility and high font scale (R5)', () => {
  test('scrubber carries accessible progressbar role and range values', async () => {
    await renderPreview(<MovementPreview movement={SQUAT} />);
    const scrubber = screen.getByTestId('movement-preview-scrubber');
    expect(scrubber.props.accessibilityRole).toBe('progressbar');
    expect(scrubber.props.accessibilityValue).toEqual({ min: 1, max: 3, now: 1 });
  });

  test('layout bounds and touch targets remain compliant under font scale 1.30', async () => {
    await renderPreview(<MovementPreview movement={SQUAT} />);
    const control = screen.getByTestId('movement-preview-control');
    const stage = screen.getByTestId('movement-preview-stage');

    // Control must maintain >= 56 dp touch target
    expect(StyleSheet.flatten(control.props.style)).toMatchObject({
      minHeight: theme.touch.min,
      minWidth: theme.touch.min,
    });
    // Stage must keep locked fixed dimensions to preserve anatomy
    expect(StyleSheet.flatten(stage.props.style)).toMatchObject({
      width: PREVIEW_LAYOUT.width,
      height: PREVIEW_LAYOUT.height,
    });
  });
});

// ── 7. Dynamic Runtime Airplane Mode & Network Isolation (R5) ────────────────

describe('runtime network isolation & airplane mode safety (R5)', () => {
  test('complete lifecycle execution generates zero network requests (0 fetch, 0 xhr)', async () => {
    jest.useFakeTimers();
    const fetchSpy = jest.fn();
    const xhrSpy = jest.fn();
    global.fetch = fetchSpy;
    global.XMLHttpRequest = xhrSpy;

    const { unmount } = await renderPreview(<MovementPreview movement={PUSH_UP} />);
    const control = screen.getByTestId('movement-preview-control');

    // Play, step, pause, unmount
    fireEvent.press(control);
    act(() => jest.advanceTimersByTime(PREVIEW_FRAME_INTERVAL_MS * 5));
    fireEvent.press(control);
    unmount();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
  });
});
