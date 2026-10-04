/** Failing-first: curated reduced-motion sequence for the canonical lunge. */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { MovementPreview } from '../../src/components/movementPreview';
import * as manifest from '../../src/components/movementPreview/manifest';
import { previewManifest } from './previewManifest';
import { resetPreviewPlayback } from '../../src/components/movementPreview/playbackCoordinator';

// R2 Part C: the merged preview data comes from the app's own module.
const raw = previewManifest;
const lunge = raw.entries.find((entry) => entry.movementId === 17);
const subject = { movement_id: 17, name: lunge.name,
  media: { assetKey: lunge.assetKey, status: 'ready', revision: 1, fallbackUrl: null } };
const fixture = manifest.buildPreviewEntry({ ...lunge, status: 'covered' });
const curated = lunge.reducedMotionFrames;
const durations = fixture.frameData.segmentDurationsMs;
const total = durations.slice(0, fixture.frames.length - 1).reduce((a, b) => a + b, 0);
const control = () => screen.getByTestId('movement-preview-control');
const drawing = () => JSON.stringify(React.Children.toArray(
  screen.getByTestId('movement-preview-stage-canonical').props.children,
).map((child) => child.props.style));
const position = (i) => {
  expect(screen.getByTestId('movement-preview-position'))
    .toHaveTextContent(`Position ${i + 1} of ${curated.length}`);
  expect(screen.getByTestId('movement-preview-scrubber').props.accessibilityValue)
    .toEqual({ min: 1, max: curated.length, now: i + 1 });
  expect(React.Children.count(screen.getByTestId('movement-preview-scrubber').props.children))
    .toBe(curated.length);
  expect(screen.getByTestId('movement-preview-caption'))
    .toHaveTextContent(fixture.frames[curated[i]].caption);
};

beforeEach(() => {
  jest.useFakeTimers();
  resetPreviewPlayback();
  // The audit gate: 43 raw keyframes must surface as a curated 8–12 position
  // sequence under reduced motion; the count itself must change, not just move.
  expect(curated.length).toBeGreaterThanOrEqual(8);
  expect(curated.length).toBeLessThanOrEqual(12);
  expect(manifest.resolveMovementPreview(subject)).toBeNull();
  jest.spyOn(manifest, 'resolveMovementPreview').mockReturnValue(fixture);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test.each(['male', 'female'])('curated reduced-motion sequence teaches the lunge (%s)', async (bodyType) => {
  const element = (reducedMotion) => (
    <MovementPreview movement={subject} bodyType={bodyType} reducedMotion={reducedMotion} />
  );
  const view = render(element(true));
  await act(async () => {});
  position(0);
  // Traverse each teaching position; all selected drawings must be distinct.
  const drawings = [drawing()];
  for (let i = 1; i < curated.length; i++) {
    fireEvent.press(control());
    position(i);
    drawings.push(drawing());
  }
  expect(new Set(drawings).size).toBe(curated.length);
  // The accessibility label carries position and count, not just an advancing index.
  expect(screen.getByTestId('movement-preview-figure').props.accessibilityLabel)
    .toContain(`Position ${curated.length} of ${curated.length}`);
  // Wrap returns to the first teaching position.
  fireEvent.press(control());
  position(0);
  expect(drawing()).toBe(drawings[0]);
  // Full-motion playback is untouched: the cycle still runs to the end.
  view.rerender(element(false));
  expect(control()).toHaveTextContent('PLAY');
  fireEvent.press(control());
  act(() => jest.advanceTimersByTime(total + 200));
  expect(control()).toHaveTextContent('REPLAY');
  // Reduced motion after playback shows a curated position, count preserved.
  view.rerender(element(true));
  expect(screen.getByTestId('movement-preview-position'))
    .toHaveTextContent(new RegExp(`of ${curated.length}$`));
  fireEvent.press(control());
  position(0);
});
