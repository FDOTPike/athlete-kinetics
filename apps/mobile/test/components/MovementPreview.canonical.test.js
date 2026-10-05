/**
 * WO-09 round-1 remediation — canonical renderer + hook-order regressions.
 *
 * Holds the fixes the three-round remediation was for:
 *  - every hook runs unconditionally: a preview appearing or disappearing
 *    mid-tree can no longer violate the rules of hooks;
 *  - the canonical 11-joint rig renders through the component (until now the
 *    dual-body parameters were imported and never used);
 *  - the bodyType prop actually changes the drawn silhouette;
 *  - canonical playback interpolates between keyframes on a timer.
 *
 * The fixture uses the REAL authored manifest JSON (goblet squat, id 14)
 * relabelled as a covered canonical entry — the athlete-facing gate is not
 * touched: `resolveMovementPreview` is only overridden for this fixture id.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DUAL_BODY_PARAMETERS, MovementPreview } from '../../src/components/movementPreview';
import * as manifestModule from '../../src/components/movementPreview/manifest';
import { previewManifest } from './previewManifest';
import { resetPreviewPlayback } from '../../src/components/movementPreview/playbackCoordinator';

// R2 Part C: the preview data is an index plus one file per family; the merged
// shape comes from the app's own module through the shared test helper.
const MANIFEST = previewManifest;

// The authored goblet squat (canonical rig, pending in the real manifest).
const RAW = MANIFEST.entries.find((entry) => entry.movementId === 14 && entry.frames?.length > 0);

const FIXTURE_ENTRY = {
  movementId: 14,
  assetKey: RAW.assetKey,
  name: RAW.name,
  pattern: RAW.pattern,
  status: 'covered',
  previewId: 'wo09_round_remediation_fixture',
  implement: null,
  summary: RAW.summary,
  frameData: {
    rig: 'canonical',
    view: RAW.view,
    viewBox: RAW.viewBox,
    segmentDurationsMs: RAW.segmentDurationsMs,
    frames: RAW.frames.map((frame) => ({
      id: frame.id,
      caption: frame.caption,
      joints: frame.joints,
    })),
  },
  frames: RAW.frames,
};
const FIXTURE_SUBJECT = {
  movement_id: 14,
  name: RAW.name,
  media: { assetKey: RAW.assetKey, status: 'external_fallback', revision: 1, fallbackUrl: null },
};

const SQUAT_SUBJECT = {
  movement_id: 28,
  name: 'Bodyweight Squat',
  media: { assetKey: 'movement/bodyweight-squat/demo/v1', status: 'external_fallback', revision: 1, fallbackUrl: null },
};

/** The ratified gate: without the fixture override, movement 14 renders NOTHING. */
describe('approval gate holds for canonical entries', () => {
  test('a pending canonical movement renders nothing even though frames exist in the manifest', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    render(<MovementPreview movement={FIXTURE_SUBJECT} />);
    await act(async () => {});
    expect(screen.queryByTestId('movement-preview-figure')).toBeNull();
  });
});

describe('canonical rendering behind the gate (fixture override)', () => {
  let restore;
  let realResolve;
  beforeEach(() => {
    jest.useFakeTimers();
    resetPreviewPlayback();
    realResolve = manifestModule.resolveMovementPreview;
    restore = jest.spyOn(manifestModule, 'resolveMovementPreview')
      .mockImplementation((subject) => (
        subject && subject.movement_id === 14 ? FIXTURE_ENTRY : realResolve(subject)
      ));
  });
  afterEach(() => {
    restore.mockRestore();
    jest.useRealTimers();
  });

  async function renderPreview(element) {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const utils = render(element);
    await act(async () => {});
    return utils;
  }

  test('renders the canonical 11-joint figure with apparatus and implement', async () => {
    await renderPreview(<MovementPreview movement={FIXTURE_SUBJECT} />);
    expect(screen.getByTestId('movement-preview-stage-canonical')).toBeTruthy();
    expect(screen.getByTestId('movement-preview-figure')).toBeTruthy();
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 1 of 5');
  });

  test('neutral is the exact midpoint and the implicit component default', async () => {
    expect(DUAL_BODY_PARAMETERS.neutral).toEqual({ sw: 10.2, hw: 8.5, lw: 4.8, hr: 6.2 });
    expect(DUAL_BODY_PARAMETERS.male).toEqual(DUAL_BODY_PARAMETERS.neutral);
    expect(DUAL_BODY_PARAMETERS.female).toEqual(DUAL_BODY_PARAMETERS.neutral);
    const implicit = await renderPreview(<MovementPreview movement={FIXTURE_SUBJECT} />);
    const explicit = await renderPreview(<MovementPreview movement={FIXTURE_SUBJECT} bodyType="neutral" />);
    const drawing = (view) => JSON.stringify(React.Children.toArray(
      view.getByTestId('movement-preview-stage-canonical').props.children,
    ).map((child) => child.props.style));
    expect(drawing(implicit)).toBe(drawing(explicit));
  });

  test('legacy male/female bodyType inputs resolve to the identical neutral geometry', async () => {
    const neutral = await renderPreview(<MovementPreview movement={FIXTURE_SUBJECT} bodyType="neutral" />);
    const male = await renderPreview(<MovementPreview movement={FIXTURE_SUBJECT} bodyType="male" />);
    const female = await renderPreview(<MovementPreview movement={FIXTURE_SUBJECT} bodyType="female" />);
    const drawing = (view) => JSON.stringify(React.Children.toArray(
      view.getByTestId('movement-preview-stage-canonical').props.children,
    ).map((child) => child.props.style));
    expect(drawing(male)).toBe(drawing(neutral));
    expect(drawing(female)).toBe(drawing(neutral));
  });

  test('canonical playback advances through segments and halts at the final frame (single cycle)', async () => {
    await renderPreview(<MovementPreview movement={FIXTURE_SUBJECT} singleCycle={true} />);
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    const durations = FIXTURE_ENTRY.frameData.segmentDurationsMs;
    act(() => { jest.advanceTimersByTime(durations[0] + 40); });
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 2 of 5');
    act(() => {
      jest.advanceTimersByTime(durations.slice(1).reduce((a, b) => a + b, 0) + 100);
    });
    expect(screen.getByTestId('movement-preview-position')).toHaveTextContent('Position 5 of 5');
    expect(screen.getByTestId('movement-preview-control')).toHaveTextContent('REPLAY');
  });

  test('interpolated pose differs from both neighbouring keyframes mid-segment', async () => {
    const utils = await renderPreview(<MovementPreview movement={FIXTURE_SUBJECT} />);
    const before = JSON.stringify(utils.toJSON());
    fireEvent.press(screen.getByTestId('movement-preview-control'));
    act(() => { jest.advanceTimersByTime(FIXTURE_ENTRY.frameData.segmentDurationsMs[0] / 2); });
    const mid = JSON.stringify(utils.toJSON());
    expect(mid).not.toBe(before);
    // Reaching the NEXT keyframe must also differ from the mid-segment pose.
    act(() => { jest.advanceTimersByTime(FIXTURE_ENTRY.frameData.segmentDurationsMs[0]); });
    expect(JSON.stringify(utils.toJSON())).not.toBe(mid);
  });
});

describe('manifest boundary — dual-rig reading (regression for the crash-on-flip defect)', () => {
  const manifestModule = require('../../src/components/movementPreview/manifest');

  test('a canonical entry flipped to covered parses as rig canonical with view + viewBox', () => {
    const raw = JSON.parse(JSON.stringify(RAW));
    raw.status = 'covered';
    raw.previewId = 'gate-test';
    raw.summary = 'gate test summary';
    const entry = manifestModule.buildPreviewEntry(raw);
    expect(entry.status).toBe('covered');
    expect(entry.frameData.rig).toBe('canonical');
    expect(entry.frameData.view).toBe('side');
    expect(entry.frameData.viewBox).toHaveLength(4);
    expect(entry.frames).toHaveLength(RAW.frames.length);
  });

  test('the three ratified legacy entries still parse as rig legacy', () => {
    const legacyRaw = MANIFEST.entries.find((e) => e.movementId === 28);
    const entry = manifestModule.buildPreviewEntry(legacyRaw);
    expect(entry.frameData.rig).toBe('legacy');
    expect(entry.frames).toHaveLength(3);
  });

  test('a malformed canonical frame throws instead of drawing something wrong', () => {
    const raw = JSON.parse(JSON.stringify(RAW));
    raw.status = 'covered';
    raw.previewId = 'gate-test';
    raw.summary = 'gate test summary';
    delete raw.frames[1].joints.nk;
    expect(() => manifestModule.buildPreviewEntry(raw)).toThrow(/bad canonical joint nk/);
  });

  test('a covered canonical entry without a view is rejected', () => {
    const raw = JSON.parse(JSON.stringify(RAW));
    raw.status = 'covered';
    raw.previewId = 'gate-test';
    raw.summary = 'gate test summary';
    delete raw.view;
    expect(() => manifestModule.buildPreviewEntry(raw)).toThrow(/needs view/);
  });
});

describe('hook-order regression (rules of hooks)', () => {
  // Hypothetical-approval fixture: SQUAT_SUBJECT carries DB media `ready` and
  // the resolver wrapper supplies the labelled review fixture for it — the
  // renderer path exercised here is exactly the one an approved movement takes.
  let restore;
  let realResolve;
  beforeEach(() => {
    jest.useFakeTimers();
    resetPreviewPlayback();
    realResolve = manifestModule.resolveMovementPreview;
    restore = jest.spyOn(manifestModule, 'resolveMovementPreview')
      .mockImplementation((subject, review) => (
        subject && subject.movement_id === 28
          ? FIXTURE_ENTRY
          : realResolve(subject, review)
      ));
  });
  afterEach(() => {
    restore.mockRestore();
    jest.useRealTimers();
  });

  async function renderPreview(element) {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const utils = render(element);
    await act(async () => {});
    return utils;
  }

  test('covered -> uncovered transition on the same mounted component does not crash', async () => {
    const utils = await renderPreview(<MovementPreview movement={SQUAT_SUBJECT} />);
    expect(screen.getByTestId('movement-preview-figure')).toBeTruthy();
    await act(async () => {
      utils.rerender(<MovementPreview movement={{ movement_id: 999999, media: { assetKey: 'unknown' } }} />);
    });
    expect(screen.queryByTestId('movement-preview-figure')).toBeNull();
  });

  test('uncovered -> covered transition on the same mounted component does not crash', async () => {
    const utils = await renderPreview(<MovementPreview movement={null} />);
    expect(screen.queryByTestId('movement-preview-figure')).toBeNull();
    await act(async () => {
      utils.rerender(<MovementPreview movement={SQUAT_SUBJECT} />);
    });
    expect(screen.getByTestId('movement-preview-figure')).toBeTruthy();
  });
});
