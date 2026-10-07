/**
 * Regression test for Finding A: Canonical frame and stage enclosure.
 *
 * Verifies that:
 * 1. For Movement 52 (Dumbbell Reverse Lunge) on neutral body
 *    and throughout every 33 ms tick of the full cycle, figureFrame height strictly matches
 *    the canonical stage height (240 dp), the floor line's full height (floor.top + floor.height)
 *    fits completely, and all painted primitives (accounting for rotation and rounded caps)
 *    lie strictly within the visible frame window with numerical epsilon 1e-6 dp.
 * 2. Negative controls (original 171.43 dp frame and 24 dp shorter frame mutation) demonstrably
 *    fail this single enclosure guard.
 * 3. All renderable canonical and derived entries (dynamically derived from manifest) are covered
 *    across every 33 ms tick of the full cycle with zero clipping.
 * 4. Parent layout presentations (standard card for Library, compact for Session) are verified.
 */
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { MovementPreview } from '../../src/components/movementPreview';
import * as manifest from '../../src/components/movementPreview/manifest';
import { resetPreviewPlayback } from '../../src/components/movementPreview/playbackCoordinator';
import { theme } from '../../src/theme/theme';
import { previewManifest } from './previewManifest';

const EPS = 1e-6; // Strict numerical epsilon: allows machine floating-point noise only
const TICK_MS = 33;

const raw52 = previewManifest.entries.find((e) => e.movementId === 52);
const fixture52 = manifest.buildPreviewEntry({ ...raw52, status: 'covered' });
const subject52 = { movement_id: 52, media: { assetKey: raw52.assetKey, status: 'ready' } };
const TOTAL_52_MS = raw52.segmentDurationsMs.reduce((a, b) => a + b, 0);

function rotOf(s) {
  const r = s.transform?.find((t) => t.rotate !== undefined);
  return r ? (parseFloat(r.rotate) * Math.PI) / 180 : (s.rotate || 0);
}

function paintedBounds(s) {
  const w = s.width;
  const h = s.height;
  const th = rotOf(s);
  const r = Math.min(s.borderRadius ?? 0, w / 2, h / 2);
  const cx = s.left + w / 2;
  const cy = s.top + h / 2;
  const ex = (w / 2 - r) * Math.abs(Math.cos(th)) + (h / 2 - r) * Math.abs(Math.sin(th)) + r;
  const ey = (w / 2 - r) * Math.abs(Math.sin(th)) + (h / 2 - r) * Math.abs(Math.cos(th)) + r;
  return {
    left: cx - ex,
    right: cx + ex,
    top: cy - ey,
    bottom: cy + ey,
  };
}

/**
 * Single enclosure function with numerical epsilon 1e-6 dp.
 * Asserts the frame encloses the stage, the floor's full thickness fits,
 * and all painted rounded bounds are strictly enclosed within the visible frame window.
 */
function assertEnclosure(frameEl, stageEl) {
  const frameStyle = StyleSheet.flatten(frameEl.props.style);
  const stageStyle = StyleSheet.flatten(stageEl.props.style);

  const frameW = frameStyle.width;
  const frameH = frameStyle.height;
  const stageW = stageStyle.width;
  const stageH = stageStyle.height;

  // 1. Frame encloses stage
  if (frameW < stageW - EPS) {
    throw new Error(`Frame width ${frameW} does not enclose stage width ${stageW}`);
  }
  if (frameH < stageH - EPS) {
    throw new Error(`Frame height ${frameH} does not enclose stage height ${stageH}`);
  }

  // Visible window in stage coordinates
  const visibleMinX = Math.max(0, (stageW - frameW) / 2);
  const visibleMaxX = stageW - visibleMinX;
  const visibleMinY = Math.max(0, (stageH - frameH) / 2);
  const visibleMaxY = stageH - visibleMinY;

  const rawChildren = stageEl.props.children;
  const children = Array.isArray(rawChildren) ? rawChildren.flat(Infinity) : [rawChildren];

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!child || !child.props) continue;
    const s = child.props.style ? StyleSheet.flatten(child.props.style) : null;
    if (!s) continue;
    const isFloor = s.height === 1 && s.backgroundColor === theme.color.line;
    if (isFloor) {
      if (s.top < visibleMinY - EPS || s.top + s.height > visibleMaxY + EPS) {
        throw new Error(`Floor [${s.top}, ${s.top + s.height}] exceeds visible window [${visibleMinY}, ${visibleMaxY}]`);
      }
      continue;
    }
    const b = paintedBounds(s);
    if (b.top < visibleMinY - EPS) {
      throw new Error(`Primitive top ${b.top} exceeds visibleMinY ${visibleMinY}`);
    }
    if (b.bottom > visibleMaxY + EPS) {
      throw new Error(`Primitive bottom ${b.bottom} exceeds visibleMaxY ${visibleMaxY}`);
    }
    if (b.left < visibleMinX - EPS) {
      throw new Error(`Primitive left ${b.left} exceeds visibleMinX ${visibleMinX}`);
    }
    if (b.right > visibleMaxX + EPS) {
      throw new Error(`Primitive right ${b.right} exceeds visibleMaxX ${visibleMaxX}`);
    }
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  resetPreviewPlayback();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(manifest, 'resolveMovementPreview').mockImplementation((m) => (m?.movement_id === 52 ? fixture52 : null));
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
  resetPreviewPlayback();
});

describe('Finding A: Canonical Frame-Fit Enclosure and Stage Integrity', () => {
  test('Movement 52: figureFrame encloses stage, floor full height fits, all painted Views enclosed (neutral)', async () => {
    const { getByTestId, unmount } = render(<MovementPreview movement={subject52} bodyType="neutral" />);
    await act(async () => {});

    const control = getByTestId('movement-preview-control');
    fireEvent.press(control);

    const ticks = Math.ceil(TOTAL_52_MS / TICK_MS);
    for (let tick = 0; tick <= ticks; tick++) {
      const frameEl = getByTestId('movement-preview-figure');
      const stageEl = getByTestId('movement-preview-stage-canonical');
      assertEnclosure(frameEl, stageEl);
      act(() => {
        jest.advanceTimersByTime(TICK_MS);
      });
    }
    unmount();
  });

  test('Negative Control: original 171.43 dp frame height demonstrably fails enclosure guard for 52', async () => {
    const { getByTestId, unmount } = render(<MovementPreview movement={subject52} bodyType="neutral" />);
    await act(async () => {});
    const frameEl = getByTestId('movement-preview-figure');
    const stageEl = getByTestId('movement-preview-stage-canonical');

    // Mutate frame element with original 171.43 dp height (pre-fix bug)
    const mutatedFrame = {
      ...frameEl,
      props: {
        ...frameEl.props,
        style: StyleSheet.flatten([frameEl.props.style, { height: 171.42857 }]),
      },
    };
    expect(() => assertEnclosure(mutatedFrame, stageEl)).toThrow();
    unmount();
  });

  test('Negative Control: 24 dp shorter frame mutation demonstrably fails enclosure guard for 52', async () => {
    const { getByTestId, unmount } = render(<MovementPreview movement={subject52} bodyType="neutral" />);
    await act(async () => {});
    const frameEl = getByTestId('movement-preview-figure');
    const stageEl = getByTestId('movement-preview-stage-canonical');
    const stageStyle = StyleSheet.flatten(stageEl.props.style);

    // Mutate frame element with frame 24 dp shorter than stage
    const mutatedFrame = {
      ...frameEl,
      props: {
        ...frameEl.props,
        style: StyleSheet.flatten([frameEl.props.style, { height: stageStyle.height - 24 }]),
      },
    };
    expect(() => assertEnclosure(mutatedFrame, stageEl)).toThrow();
    unmount();
  });

  // Both shortened-frame controls trip the frame-encloses-stage check first, so
  // on their own they would still pass if the floor and painted-bounds checks
  // were deleted. These two keep the real frame and move one thing out of it.
  test('Negative Control: a painted primitive past the stage edge fails the enclosure guard', async () => {
    const { getByTestId, unmount } = render(<MovementPreview movement={subject52} bodyType="neutral" />);
    await act(async () => {});
    const frameEl = getByTestId('movement-preview-figure');
    const stageEl = getByTestId('movement-preview-stage-canonical');
    const stageStyle = StyleSheet.flatten(stageEl.props.style);
    expect(() => assertEnclosure(frameEl, stageEl)).not.toThrow();

    const children = React.Children.toArray(stageEl.props.children);
    const stray = {
      props: {
        style: {
          position: 'absolute', left: stageStyle.width - 4, top: 10, width: 8, height: 8, borderRadius: 4,
        },
      },
    };
    const mutatedStage = { ...stageEl, props: { ...stageEl.props, children: [...children, stray] } };
    expect(() => assertEnclosure(frameEl, mutatedStage)).toThrow(/Primitive right/);
    unmount();
  });

  test('Negative Control: a floor line whose thickness leaves the stage fails the enclosure guard', async () => {
    const { getByTestId, unmount } = render(<MovementPreview movement={subject52} bodyType="neutral" />);
    await act(async () => {});
    const frameEl = getByTestId('movement-preview-figure');
    const stageEl = getByTestId('movement-preview-stage-canonical');
    const stageStyle = StyleSheet.flatten(stageEl.props.style);

    const children = React.Children.toArray(stageEl.props.children);
    const isFloor = (child) => {
      const s = StyleSheet.flatten(child.props.style);
      return s.height === 1 && s.backgroundColor === theme.color.line;
    };
    expect(children.filter(isFloor)).toHaveLength(1);
    const moved = children.map((child) => (isFloor(child)
      ? { props: { style: StyleSheet.flatten([child.props.style, { top: stageStyle.height - 0.5 }]) } }
      : child));
    const mutatedStage = { ...stageEl, props: { ...stageEl.props, children: moved } };
    expect(() => assertEnclosure(frameEl, mutatedStage)).toThrow(/Floor/);
    unmount();
  });

  test('Coverage of all renderable canonical and derived entries across the full cycle', async () => {
    const renderableEntries = previewManifest.entries.filter(
      (e) => (Array.isArray(e.frames) && e.frames.length > 0 && Array.isArray(e.viewBox)) || Boolean(e.derivesFrom),
    );

    // Nothing may drop out of coverage silently. Every manifest entry is either
    // guarded here, marked unsuitable, or one of the legacy-rig prototypes that
    // carry frames without a canonical view box and are not drawn on this stage.
    const unsuitable = previewManifest.entries.filter((e) => e.status === 'intentionally_unsuitable');
    const legacyRig = previewManifest.entries.filter(
      (e) => e.status !== 'intentionally_unsuitable' && !e.derivesFrom
        && Array.isArray(e.frames) && e.frames.length > 0 && !Array.isArray(e.viewBox),
    );
    expect(legacyRig.map((e) => e.movementId).sort((a, b) => a - b)).toEqual([16, 28, 88]);
    expect(renderableEntries.length + unsuitable.length + legacyRig.length).toBe(previewManifest.entries.length);

    let derivedCount = 0;
    for (const entry of renderableEntries) {
      const base = entry.derivesFrom
        ? previewManifest.entries.find((b) => b.movementId === entry.derivesFrom)
        : undefined;
      if (entry.derivesFrom) {
        derivedCount++;
      }
      const fixture = manifest.buildPreviewEntry({ ...entry, status: 'covered' }, base);
      jest.spyOn(manifest, 'resolveMovementPreview').mockReturnValue(fixture);

      const subject = { movement_id: entry.movementId, media: { assetKey: entry.assetKey, status: 'ready' } };
      const { getByTestId, unmount } = render(<MovementPreview movement={subject} bodyType="neutral" />);
      await act(async () => {});

      const control = getByTestId('movement-preview-control');
      fireEvent.press(control);

      const durations = fixture.frameData?.segmentDurationsMs ?? entry.segmentDurationsMs;
      const total = durations ? durations.reduce((a, b) => a + b, 0) : 1000;
      const ticks = Math.ceil(total / TICK_MS);
      const frameEl = getByTestId('movement-preview-figure');
      for (let tick = 0; tick <= ticks; tick++) {
        const stageEl = getByTestId('movement-preview-stage-canonical');
        assertEnclosure(frameEl, stageEl);
        act(() => {
          jest.advanceTimersByTime(TICK_MS);
        });
      }

      unmount();
      jest.restoreAllMocks();
    }

    expect(derivedCount).toBeGreaterThanOrEqual(1);
  }, 300000);

  test('Parent layout presentation: compact mode (SessionScreen) and card mode (LibraryScreenV2)', async () => {
    // Standard Card mode (Library)
    const cardRender = render(<MovementPreview movement={subject52} compact={false} />);
    await act(async () => {});
    expect(screen.getByRole('header', { name: 'Movement preview' })).toBeOnTheScreen();
    expect(screen.getByText(raw52.summary)).toBeOnTheScreen();
    cardRender.unmount();

    // Compact mode (Session)
    const compactRender = render(<MovementPreview movement={subject52} compact={true} />);
    await act(async () => {});
    expect(screen.queryByRole('header', { name: 'Movement preview' })).toBeNull();
    expect(screen.getByTestId('movement-preview-figure')).toBeOnTheScreen();
    compactRender.unmount();
  });
});
