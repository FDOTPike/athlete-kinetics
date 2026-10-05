/** Hypothetical rendering fixtures only; no production approval changes. */
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
// Explicit non-curated fixture preserves the shared raw-frame contract.
const fixture = manifest.buildPreviewEntry({ ...lunge, reducedMotionFrames: undefined, status: 'covered' });
const durations = fixture.frameData.segmentDurationsMs;
const total = durations.slice(0, fixture.frames.length - 1).reduce((a, b) => a + b, 0);
const control = () => screen.getByTestId('movement-preview-control');
const drawing = () => JSON.stringify(React.Children.toArray(
  screen.getByTestId('movement-preview-stage-canonical').props.children,
).map((child) => child.props.style));
const position = (i) => {
  expect(screen.getByTestId('movement-preview-position')).toHaveTextContent(`Position ${i + 1} of ${fixture.frames.length}`);
  expect(screen.getByTestId('movement-preview-caption')).toHaveTextContent(fixture.frames[i].caption);
};

beforeEach(() => {
  jest.useFakeTimers();
  resetPreviewPlayback();
  expect(lunge.status).toBe('pending');
  expect(raw.techniqueReview.status).toBe('pending');
  expect(manifest.resolveMovementPreview(subject)).toBeNull();
  // Expose parsed canonical data only in this component fixture. The actual
  // control, drawing and state transitions run without replacements.
  jest.spyOn(manifest, 'resolveMovementPreview').mockReturnValue(fixture);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test.each(['neutral'])('Walking Lunge canonical navigation and motion transitions (%s)', async (bodyType) => {
  const element = (reducedMotion) => <MovementPreview movement={subject} bodyType={bodyType} reducedMotion={reducedMotion} />;
  const view = render(element(true));
  await act(async () => {});
  position(0);
  const firstDrawing = drawing();
  fireEvent.press(control());
  position(1);
  const secondDrawing = drawing();
  expect(secondDrawing).not.toBe(firstDrawing);
  act(() => jest.advanceTimersByTime(total * 2));
  position(1);
  expect(drawing()).toBe(secondDrawing);

  // Exit reduced motion without autoplay; playback starts at the chosen still.
  view.rerender(element(false));
  expect(control()).toHaveTextContent('PLAY');
  position(1);
  fireEvent.press(control());
  act(() => jest.advanceTimersByTime(Math.ceil(durations[1] / 33) * 33 + 66));
  position(2);
  view.rerender(element(true));
  position(2);
  const stoppedDrawing = drawing();
  act(() => jest.advanceTimersByTime(total * 2));
  position(2);
  expect(drawing()).toBe(stoppedDrawing);
  fireEvent.press(control());
  position(3);
  expect(drawing()).not.toBe(stoppedDrawing);

  // Traverse every remaining still, wrap, then reach the end for replay.
  for (let i = 4; i < fixture.frames.length; i++) { fireEvent.press(control()); position(i); }
  fireEvent.press(control());
  position(0);
  expect(drawing()).toBe(firstDrawing);
  for (let i = 1; i < fixture.frames.length; i++) fireEvent.press(control());
  view.rerender(element(false));
  expect(control()).toHaveTextContent('REPLAY');
  fireEvent.press(control());
  position(0);
  act(() => jest.advanceTimersByTime(total + 100));
  position(fixture.frames.length - 1);
  expect(control()).toHaveTextContent('REPLAY');
  fireEvent.press(control());
  position(0);
});
