/** Independent, explicitly hypothetical approval fixtures. No product statuses are changed. */
const React = require('react');
const testing = require('@testing-library/react-native');
const { render, act, fireEvent, cleanup } = testing;
const screen = new Proxy({}, { get: (_, key) => testing.screen[key] });
const { AccessibilityInfo, StyleSheet } = require('react-native');
const root = 'C:/Users/fpike/.codex/worktrees/movement-pushdown-2026-10-04/Athlete App';
const { MovementPreview } = require(root + '/apps/mobile/src/components/movementPreview/MovementPreview');
const manifest = require(root + '/apps/mobile/src/components/movementPreview/manifest');
const { poseAtTime } = require(root + '/apps/mobile/src/components/movementPreview/canonicalFigure');
const coordinator = require(root + '/apps/mobile/src/components/movementPreview/playbackCoordinator');
const raw = require(root + '/apps/mobile/src/components/movementPreview/movementPreviewManifest.json');
const IDS = [143, 53, 82, 138, 163, 92, 158, 253, 80, 262, 292, 264, 49, 178, 220, 84, 52];
const fixtures = new Map([...IDS, 186].map((id) => {
  const entry = raw.entries.find((e) => e.movementId === id);
  const base = raw.entries.find((e) => e.movementId === entry?.derivesFrom);
  return [id, manifest.buildPreviewEntry({ ...entry, status: 'covered' }, base)];
}));
const subject = (id) => ({ movement_id: id, name: fixtures.get(id).name,
  media: { assetKey: fixtures.get(id).assetKey, status: 'ready' } });
const control = () => screen.getByTestId('movement-preview-control');
const stage = () => screen.getByTestId('movement-preview-stage-canonical');
const childStyles = () => React.Children.toArray(stage().props.children)
  .map((c) => StyleSheet.flatten(c.props.style));
const rotation = (style) => {
  const degrees = Number.parseFloat(style.transform?.find((t) => t.rotate !== undefined)?.rotate ?? '0');
  return ((degrees + 90) % 180 + 180) % 180 - 90;
};

beforeEach(() => {
  jest.useFakeTimers(); coordinator.resetPreviewPlayback();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(manifest, 'resolveMovementPreview').mockImplementation((s) => fixtures.get(s?.movement_id) ?? null);
});
afterEach(() => { cleanup(); jest.useRealTimers(); jest.restoreAllMocks(); });

function assertDrawFits(id, body, sample) {
  const surface = StyleSheet.flatten(stage().props.style);
  for (const [index, s] of childStyles().entries()) {
    if (s.width === undefined || s.height === undefined || s.opacity === 0) continue;
    const { left, top, width, height } = s;
    expect([left, top, width, height].every(Number.isFinite)).toBe(true);
    const angle = rotation(s) * Math.PI / 180;
    const r = Math.min(s.borderRadius ?? 0, width / 2, height / 2);
    // Exact rounded-rectangle outer extents of the component's own View style.
    // Native borders sit within these dimensions; no SVG stroke-padding guess.
    const halfX = (width / 2 - r) * Math.abs(Math.cos(angle))
      + (height / 2 - r) * Math.abs(Math.sin(angle)) + r;
    const halfY = (width / 2 - r) * Math.abs(Math.sin(angle))
      + (height / 2 - r) * Math.abs(Math.cos(angle)) + r;
    const cx = left + width / 2, cy = top + height / 2;
    const excess = Math.max(0, halfX - cx, halfY - cy,
      cx + halfX - surface.width, cy + halfY - surface.height);
    expect({ id, body, sample, primitive: index, cropExcessDp: excess }).toEqual({
      id, body, sample, primitive: index, cropExcessDp: expect.any(Number),
    });
    if (excess > 0.05) throw new Error(JSON.stringify({ id, body, sample,
      primitive: index, cropExcessDp: excess, style: s, surface }));
  }
}

test.each(IDS.flatMap((id) => ['neutral', 'male', 'female'].map((body) => [id, body])))
('all rendered View bounds fit the fixed crop for known affected motion %i (%s)', async (id, body) => {
  const e = fixtures.get(id), count = e.frames.length;
  const view = render(<MovementPreview movement={subject(id)} bodyType={body} reducedMotion={true} />);
  await act(async () => {});
  const initialSurface = JSON.stringify(StyleSheet.flatten(stage().props.style));
  for (let i = 0; i < count; i++) {
    assertDrawFits(id, body, `authored-${i}`);
    expect(screen.getByTestId('movement-preview-caption')).toHaveTextContent(e.frames[i].caption);
    expect(screen.getByTestId('movement-preview-figure').props.accessibilityLabel).toContain(e.frames[i].caption);
    expect(JSON.stringify(StyleSheet.flatten(stage().props.style))).toEqual(initialSurface);
    fireEvent.press(control());
  }
  // Restore full motion at the starting keyframe, then visit each real 33ms tick.
  view.rerender(<MovementPreview movement={subject(id)} bodyType={body} reducedMotion={false} singleCycle={true} />);
  fireEvent.press(control());
  const segs = e.frameData.segmentDurationsMs?.slice(0, count - 1)
    ?? Array.from({ length: count - 1 }, () => 900);
  const total = segs.reduce((a, b) => a + b, 0);
  for (let t = 0; t <= total + 33; t += 33) {
    assertDrawFits(id, body, `tick-${t}`);
    expect(JSON.stringify(StyleSheet.flatten(stage().props.style))).toEqual(initialSurface);
    act(() => jest.advanceTimersByTime(33));
  }
  expect(control()).toHaveTextContent('REPLAY');
  expect(coordinator.isPlaybackActive()).toBe(false);
});


