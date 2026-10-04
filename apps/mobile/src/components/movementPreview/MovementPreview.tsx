/**
 * MovementPreview — a small offline movement preview (WO-09A bounded prototype,
 * extended by WO-09 with the canonical 11-joint renderer).
 *
 * What it is: drawn positions of ONE movement, played on the athlete's
 * command. The figure is built from plain Views — no image, no video, no
 * network, no new dependency. Frame geometry lives in the coverage manifest
 * next to this file; the layout math lives in canonicalFigure.ts and is
 * shared verbatim with the headless evidence rasterizer.
 *
 * Rules this component enforces (WO-09):
 *  - never autoplays; the first thing shown is a still frame;
 *  - only one preview animates anywhere in the app (playbackCoordinator);
 *  - stops when the app leaves the foreground, and on unmount/dismissal;
 *  - under the OS reduced-motion preference it never starts a timer at all —
 *    the athlete steps through the positions instead;
 *  - a movement with no covered preview renders NOTHING, so the existing text
 *    instructions and video affordance stay exactly as they were;
 *  - every hook runs unconditionally (no early return before hooks) so a
 *    preview appearing or disappearing mid-tree can never violate the rules
 *    of hooks.
 *
 * It is a detail-view affordance on purpose: list rows never mount it, so a
 * scrolling list can never animate.
 *
 * It describes positions. It is not medical, injury-prevention or technique
 * certification advice, and the copy must never imply otherwise.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { useReduceMotion } from '../ui/motionDuration';
import { claimPreviewPlayback, releasePreviewPlayback } from './playbackCoordinator';
import {
  layoutCanonicalFigure,
  poseAtTime,
  peakWeightAtTime,
  segmentDurations,
  type BodyParameters,
  type ColorRole,
  type FigurePrim,
} from './canonicalFigure';
import {
  CHALK_VISUAL_RULES,
  DUAL_BODY_PARAMETERS,
  PREVIEW_BOX,
  PREVIEW_CHARACTER,
  PREVIEW_FRAME_INTERVAL_MS,
  resolveMovementPreview,
  type BodyType,
  type CanonicalFrame,
  type CoveredCanonicalFrames,
  type CoveredFrameData,
  type CoveredPreview,
  type FrameRole,
  type ImplementOrientation,
  type JointOffsets,
  type PreviewFrame,
  type PreviewPoint,
  type PreviewSubject,
} from './manifest';

export { DUAL_BODY_PARAMETERS, CHALK_VISUAL_RULES };
export type { BodyType };

/** Drawing width in dp. 240 keeps the figure inside a 320 dp screen's card. */
const PREVIEW_WIDTH = 240;
const SCALE = PREVIEW_WIDTH / PREVIEW_BOX.width;
const PREVIEW_HEIGHT = PREVIEW_BOX.height * SCALE;
const BONE = 4;
const HEAD_SIZE = PREVIEW_CHARACTER.headRadius * 2 * SCALE;
/** Half a dumbbell bar, in manifest box units. */
const IMPLEMENT_HALF_WIDTH = 7;
const IMPLEMENT_THICKNESS = 6;

/** The drawing surface, in dp, and the manifest-unit -> dp scale. */
export const PREVIEW_LAYOUT = { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, scale: SCALE } as const;

/** Canonical figures fit inside this square (dp), preserving viewBox aspect. */
const CANONICAL_FIT = 240;
/** Canonical playback tick (~30 fps of pose interpolation). */
const CANONICAL_TICK_MS = 33;

interface BoneProps {
  from: PreviewPoint;
  to: PreviewPoint;
}

/** One limb: a rounded bar laid between two joints. */
function Bone({ from, to }: BoneProps): React.JSX.Element {
  const dx = (to[0] - from[0]) * SCALE;
  const dy = (to[1] - from[1]) * SCALE;
  const length = Math.hypot(dx, dy);
  const centreX = ((from[0] + to[0]) / 2) * SCALE;
  const centreY = ((from[1] + to[1]) / 2) * SCALE;
  return (
    <View
      style={[
        styles.bone,
        {
          left: centreX - length / 2,
          top: centreY - BONE / 2,
          width: length,
          transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }],
        },
      ]}
    />
  );
}

/**
 * How far this movement's drawing must move to sit in the middle of the box.
 *
 * Computed over EVERY frame of the movement, not per frame, so the character
 * never jumps between positions: a squat fills the box top to bottom, while a
 * push-up occupies a low, wide band that would otherwise leave the top third
 * of the card empty and the figure small. The ground line travels with the
 * figure, so the drawing stays internally honest.
 */
function centreOffset(frames: readonly PreviewFrame[]): { dx: number; dy: number } {
  const radius = PREVIEW_CHARACTER.headRadius;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = PREVIEW_BOX.ground;
  for (const frame of frames) {
    for (const [name, point] of Object.entries(frame.joints)) {
      const margin = name === 'head' ? radius : 0;
      minX = Math.min(minX, point[0] - margin);
      maxX = Math.max(maxX, point[0] + margin);
      minY = Math.min(minY, point[1] - margin);
      maxY = Math.max(maxY, point[1] + margin);
    }
  }
  return {
    dx: (PREVIEW_BOX.width - (maxX - minX)) / 2 - minX,
    dy: (PREVIEW_BOX.height - (maxY - minY)) / 2 - minY,
  };
}

interface FigureProps {
  frame: PreviewFrame;
  implement: 'dumbbells' | null;
  offset: { dx: number; dy: number };
}

function Figure({ frame, implement, offset }: FigureProps): React.JSX.Element {
  const joint = (name: keyof PreviewFrame['joints']): PreviewPoint => frame.joints[name];
  const head = joint('head');
  const hand = joint('hand');
  return (
    <View
      testID="movement-preview-stage"
      style={[styles.stage, {
        transform: [{ translateX: offset.dx * SCALE }, { translateY: offset.dy * SCALE }],
      }]}
    >
      {/* The floor travels with the figure vertically, but stays edge to edge
          horizontally, so centring never reveals a gap at one side. */}
      <View
        style={[styles.ground, {
          top: PREVIEW_BOX.ground * SCALE,
          transform: [{ translateX: -offset.dx * SCALE }],
        }]}
      />
      {PREVIEW_CHARACTER.bonePairs.map(([from, to]) => (
        <Bone
          key={`${from}-${to}`}
          from={joint(from as keyof PreviewFrame['joints'])}
          to={joint(to as keyof PreviewFrame['joints'])}
        />
      ))}
      <View
        style={[
          styles.head,
          { left: head[0] * SCALE - HEAD_SIZE / 2, top: head[1] * SCALE - HEAD_SIZE / 2 },
        ]}
      />
      {implement === 'dumbbells' && (
        <View
          style={[
            styles.implement,
            {
              left: (hand[0] - IMPLEMENT_HALF_WIDTH) * SCALE,
              top: hand[1] * SCALE - (IMPLEMENT_THICKNESS * SCALE) / 2,
              width: IMPLEMENT_HALF_WIDTH * 2 * SCALE,
              height: IMPLEMENT_THICKNESS * SCALE,
            },
          ]}
        />
      )}
    </View>
  );
}

/** Theme role -> token, the only place this component names a color. */
function roleColor(role: ColorRole): string {
  switch (role) {
    case 'textHi': return theme.color.textHi;
    case 'textLow': return theme.color.textLow;
    case 'textMid': return theme.color.textMid;
    case 'line': return theme.color.line;
    case 'ink1': return theme.color.ink1;
  }
}

interface CanonicalStageProps {
  frameData: CoveredCanonicalFrames;
  pose: CanonicalFrame['joints'];
  body: BodyParameters;
  assetKey: string;
  /** Step role of the drawn frame (variant contract); base entries pass none. */
  role?: FrameRole;
  implementTiltWeight?: number;
  /** Variant implement orientation; omitted means 'flat'. */
  implementOrientation?: ImplementOrientation;
  /** Variant implement count; omitted means the slug's own default. */
  implementCount?: 1 | 2;
  /** Owner batch (B1-20-R2): implement scale; omitted means 1. */
  implementScale?: number;
  /** Owner batch (B1-20-R2): front-view body turn in degrees; omitted means none. */
  bodyTurnDeg?: number;
  /** Variant-only (B1-55): constant per-joint draw-time offsets; omitted means none. */
  jointOffsets?: JointOffsets;
  /** Variant-only, front view (B1-300): grip change per hand; omitted means none. */
  gripDelta?: number;
  testID?: string;
}

/**
 * The canonical 11-joint figure, drawn from the SAME primitive list the
 * evidence rasterizer consumes. Each primitive maps onto plain Views: bones
 * are rotated rounded bars, circles are bordered/filled round views, rects
 * are plain views. Body parameters select the silhouette; the joint
 * coordinates (the technique) are identical for every parameter set.
 */
function CanonicalStage({
  frameData, pose, body, assetKey, role, implementTiltWeight, implementOrientation, implementCount,
  implementScale, bodyTurnDeg, jointOffsets, gripDelta, testID,
}: CanonicalStageProps): React.JSX.Element {
  const { view, viewBox } = frameData;
  const scale = Math.min(CANONICAL_FIT / viewBox[2], CANONICAL_FIT / viewBox[3]);
  const stageW = viewBox[2] * scale;
  const stageH = viewBox[3] * scale;
  const prims: FigurePrim[] = layoutCanonicalFigure(pose, {
    view, body, assetKey, role, implementTiltWeight, implementOrientation, implementCount,
    implementScale, bodyTurnDeg, jointOffsets, gripDelta,
  });
  const groundY = (96.9 - viewBox[1]) * scale;
  return (
    <View
      testID={testID ?? 'movement-preview-stage-canonical'}
      style={[styles.stageCanonical, { width: stageW, height: stageH }]}
    >
      {groundY >= 0 && groundY <= stageH && (
        <View style={[styles.ground, { top: groundY }]} />
      )}
      {prims.map((prim, i) => {
        if (prim.kind === 'bone') {
          const x1 = (prim.x1 - viewBox[0]) * scale;
          const y1 = (prim.y1 - viewBox[1]) * scale;
          const x2 = (prim.x2 - viewBox[0]) * scale;
          const y2 = (prim.y2 - viewBox[1]) * scale;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const length = Math.hypot(dx, dy);
          const thickness = Math.max(1, prim.w * scale);
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: (x1 + x2) / 2 - length / 2,
                top: (y1 + y2) / 2 - thickness / 2,
                width: length,
                height: thickness,
                borderRadius: thickness / 2,
                backgroundColor: roleColor(prim.color),
                opacity: prim.opacity,
                // Torso bars carry an outline: without it the ink1 fill equals
                // the stage background and the trunk renders as a hole.
                borderWidth: prim.stroke !== undefined ? (prim.strokeWidth ?? 1) * scale : undefined,
                borderColor: prim.stroke !== undefined ? roleColor(prim.stroke) : undefined,
                transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }],
              }}
            />
          );
        }
        if (prim.kind === 'circle') {
          const size = prim.r * 2 * scale;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: (prim.cx - viewBox[0]) * scale - size / 2,
                top: (prim.cy - viewBox[1]) * scale - size / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: roleColor(prim.fill),
                borderWidth: prim.stroke !== undefined ? (prim.strokeWidth ?? 1) * scale : undefined,
                borderColor: prim.stroke !== undefined ? roleColor(prim.stroke) : undefined,
                opacity: prim.opacity,
              }}
            />
          );
        }
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (prim.x - viewBox[0]) * scale,
              top: (prim.y - viewBox[1]) * scale,
              width: prim.w * scale,
              height: prim.h * scale,
              borderRadius: prim.rx * scale,
              backgroundColor: roleColor(prim.fill),
              borderWidth: prim.stroke !== undefined ? (prim.strokeWidth ?? 1) * scale : undefined,
              borderColor: prim.stroke !== undefined ? roleColor(prim.stroke) : undefined,
              opacity: prim.opacity,
            }}
          />
        );
      })}
    </View>
  );
}

export interface MovementPreviewProps {
  /** Any movement record: only its canonical id and media identity are read. */
  movement?: (PreviewSubject & { name?: string }) | null | undefined;
  /** Neutral by default; male/female remain explicit compatibility inputs. */
  bodyType?: BodyType;
  /** Compact card layout flag for constrained viewports (e.g. SessionScreen Disclosure). */
  compact?: boolean;
  /** Reduced motion preference override. If omitted, OS preference is used. */
  reducedMotion?: boolean;
  /** Playback state change notification callback. */
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  /** Explicitly enforce single-cycle playback (pauses at final frame). */
  singleCycle?: boolean;
  /** Test identifier. */
  testID?: string;
}

export function MovementPreview({
  movement,
  bodyType = 'neutral',
  compact = false,
  reducedMotion: reducedMotionProp,
  onPlaybackStateChange,
  singleCycle,
  testID,
}: MovementPreviewProps): React.JSX.Element | null {
  // Pure, non-hook resolution — safe to call before any hooks.
  const preview = useMemo(() => resolveMovementPreview(movement), [movement]);
  const osReduceMotion = useReduceMotion();
  const reduceMotion = reducedMotionProp ?? osReduceMotion;
  // Covered entries carry rig-specific data in frameData; a covered entry that
  // predates the canonical rig (and any test double built on the ratified
  // WO-09A shape) exposes `frames` directly — normalize both here.
  const frameData: CoveredFrameData | null = preview
    ? (preview.frameData ?? (preview.frames
        ? { rig: 'legacy', frames: preview.frames as readonly PreviewFrame[] }
        : null))
    : null;
  const legacyFrames = frameData !== null && frameData.rig === 'legacy' ? frameData.frames : null;
  const canonical = frameData !== null && frameData.rig === 'canonical' ? frameData : null;

  const offset = useMemo(
    () => (legacyFrames === null ? { dx: 0, dy: 0 } : centreOffset(legacyFrames)),
    [legacyFrames],
  );
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [canonicalTimeMs, setCanonicalTimeMs] = useState(0);

  // A reused detail slot must start the new identity still at position one.
  // Losing coverage also stops its timer and releases the playback claim.
  useEffect(() => {
    setPlaying(false);
    setIndex(0);
    setCanonicalTimeMs(0);
  }, [preview?.movementId, preview?.assetKey]);

  const legacyCount = legacyFrames?.length ?? 0;
  const canonicalCount = canonical?.frames.length ?? 0;
  const canonicalTotalMs = useMemo(() => {
    if (canonical === null) return 0;
    return segmentDurations(canonical.frames.length, canonical.segmentDurationsMs)
      .reduce((acc, d) => acc + d, 0);
  }, [canonical]);

  // Single-cycle policy: true when explicitly enabled or for movements with > 3 frames
  const isSingleCycle = singleCycle ?? Boolean(
    (legacyFrames !== null && legacyFrames.length > 3)
    || (canonical !== null && canonical.frames.length > 3),
  );

  // Notify parent of playback state change
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  onPlaybackStateChangeRef.current = onPlaybackStateChange;
  useEffect(() => {
    onPlaybackStateChangeRef.current?.(playing);
  }, [playing]);

  // Reduced motion is authoritative: if it turns on mid-playback, motion stops.
  useEffect(() => {
    if (reduceMotion && playing) setPlaying(false);
  }, [reduceMotion, playing]);

  // Legacy timer: steps whole keyframes. An entry may carry per-segment
  // durations (stress-suite contract); otherwise the manifest default.
  const legacySegmentMs = (preview as { segmentDurationsMs?: number[] } | null)?.segmentDurationsMs;
  useEffect(() => {
    if (!playing || legacyFrames === null || legacyCount === 0) return undefined;
    const intervalMs = legacySegmentMs?.[index] ?? PREVIEW_FRAME_INTERVAL_MS;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = current + 1;
        if (isSingleCycle && next >= legacyCount) {
          setPlaying(false);
          return current;
        }
        return next % legacyCount;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [playing, legacyFrames, legacyCount, isSingleCycle, index, legacySegmentMs]);

  // Canonical timer: advances eased pose interpolation inside the cycle.
  useEffect(() => {
    if (!playing || canonical === null || canonicalTotalMs === 0) return undefined;
    const timer = setInterval(() => {
      setCanonicalTimeMs((t) => {
        const next = t + CANONICAL_TICK_MS;
        if (next >= canonicalTotalMs) {
          if (isSingleCycle) {
            setPlaying(false);
            return canonicalTotalMs;
          }
          return next % canonicalTotalMs;
        }
        return next;
      });
    }, CANONICAL_TICK_MS);
    return () => clearInterval(timer);
  }, [playing, canonical, canonicalTotalMs, isSingleCycle]);

  // One preview plays at a time, app-wide.
  useEffect(() => {
    if (!playing) return undefined;
    const stop = (): void => setPlaying(false);
    claimPreviewPlayback(stop);
    return () => releasePreviewPlayback(stop);
  }, [playing]);

  // Backgrounded (or an incoming call) stops playback; nothing animates unseen.
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && playingRef.current) setPlaying(false);
    });
    return () => subscription.remove();
  }, []);

  const stillIndices = reduceMotion ? canonical?.reducedMotionFrames : undefined;
  const frameCount = stillIndices?.length ?? (legacyCount > 0 ? legacyCount : canonicalCount);

  const onControlPress = useCallback(() => {
    if (reduceMotion) {
      if (canonical !== null) {
        // Keep canonical playback and still navigation on the same timeline.
        // Durations are authored per segment, so index * duration is invalid.
        setCanonicalTimeMs((current) => {
          const rawIndex = frameIndexAtTime(canonical.frames.length, current,
            canonical.segmentDurationsMs);
          const next = stillIndices === undefined
            ? (rawIndex + 1) % canonical.frames.length
            : stillIndices.find((frame) => frame > rawIndex) ?? stillIndices[0];
          return segmentDurations(canonical.frames.length, canonical.segmentDurationsMs)
            .slice(0, next).reduce((acc, duration) => acc + duration, 0);
        });
      } else {
        setIndex((current) => (frameCount === 0 ? 0 : (current + 1) % frameCount));
      }
      return;
    }
    setPlaying((currentlyPlaying) => {
      if (!currentlyPlaying) {
        if (legacyFrames !== null && isSingleCycle && index >= legacyFrames.length - 1) {
          setIndex(0);
        }
        if (canonical !== null && isSingleCycle && canonicalTimeMs >= canonicalTotalMs) {
          setCanonicalTimeMs(0);
        }
        return true;
      }
      return false;
    });
  }, [frameCount, reduceMotion, stillIndices, isSingleCycle, index, legacyFrames, canonical, canonicalTimeMs, canonicalTotalMs]);

  // Unknown, pending or unsuitable movement: the existing UI stands alone.
  if (preview === null) return null;

  const rawPositionIndex = canonical !== null
    ? Math.min(
        frameIndexAtTime(canonical.frames.length, canonicalTimeMs, canonical.segmentDurationsMs),
        canonicalCount - 1,
      )
    : Math.min(index, Math.max(0, legacyCount - 1));
  // Snap presentation to the preceding teaching position on entering reduced
  // motion. NEXT still advances authored time, including unequal durations.
  const positionIndex = stillIndices === undefined ? rawPositionIndex
    : Math.max(0, stillIndices.filter((frame) => frame <= rawPositionIndex).length - 1);
  const drawnFrameIndex = stillIndices?.[positionIndex] ?? rawPositionIndex;
  const position = `Position ${positionIndex + 1} of ${frameCount}`;
  const isAtFinalFrame = isSingleCycle
    && (canonical !== null
      ? canonicalTimeMs >= canonicalTotalMs
      : index >= legacyCount - 1);
  const controlLabel = reduceMotion
    ? 'NEXT POSITION'
    : playing
      ? 'PAUSE'
      : isAtFinalFrame
        ? 'REPLAY'
        : 'PLAY';
  const controlAccessibilityLabel = reduceMotion
    ? `Show the next position of the ${preview.name} preview`
    : playing
      ? `Pause the ${preview.name} preview`
      : isAtFinalFrame
        ? `Replay the ${preview.name} preview`
        : `Play the ${preview.name} preview`;

  const containerTestID = testID ?? `movement-preview-${preview.movementId}`;

  // The drawn frame: legacy uses the stepped keyframe; canonical uses the
  // eased interpolated pose, including when held by pause/backgrounding.
  // Reduced motion steps through exact teaching keyframes.
  // Body parameters affect silhouette only; joint coordinates (technique)
  // are identical for neutral and both explicit legacy inputs.
  const body = DUAL_BODY_PARAMETERS[bodyType];
  let caption: string;
  let figure: React.JSX.Element;
  if (canonical !== null) {
    const pose = !reduceMotion
      ? poseAtTime(canonical.frames.map((f) => f.joints), canonicalTimeMs, canonical.segmentDurationsMs)
      : canonical.frames[drawnFrameIndex].joints;
    caption = canonical.frames[drawnFrameIndex].caption;
    // The implement tilt belongs to ONE frame — the variant's `peak`. Roles are
    // keyed by frame id and a base entry carries none, so this stays undefined
    // for every production movement and its drawing path is untouched.
    const drawnFrame = canonical.frames[drawnFrameIndex];
    const role = preview.frameRoles?.[drawnFrame.id];
    figure = (
      <CanonicalStage
        frameData={canonical}
        pose={pose}
        body={body}
        assetKey={preview.assetKey}
        role={role}
        implementTiltWeight={reduceMotion ? undefined : peakWeightAtTime(
          canonical.frames, preview.frameRoles, canonicalTimeMs, canonical.segmentDurationsMs,
        )}
        implementOrientation={preview.implementOrientation}
        implementCount={preview.implementCount}
        implementScale={preview.implementScale}
        bodyTurnDeg={preview.bodyTurnDeg}
        jointOffsets={preview.jointOffsets}
        gripDelta={preview.gripDelta}
        testID="movement-preview-stage-canonical"
      />
    );
  } else {
    const frames = legacyFrames as readonly PreviewFrame[];
    const frame = frames[Math.min(index, frames.length - 1)];
    caption = frame.caption;
    figure = <Figure frame={frame} implement={preview.implement} offset={offset} />;
  }

  return (
    <View style={compact ? styles.compactCard : styles.card} testID={containerTestID}>
      {!compact && (
        <>
          <Text style={styles.heading} accessibilityRole="header">Movement preview</Text>
          <Text style={styles.summary}>{preview.summary}</Text>
          <Text style={styles.provenance}>
            Drawn in the app from its own coaching notes. No video and no internet connection are used.
          </Text>
        </>
      )}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${preview.name} preview. ${position}: ${caption}`}
        testID="movement-preview-figure"
        style={styles.figureFrame}
      >
        {figure}
      </View>
      {/* Strict Chalk Rule: chalk (#EFC94C) indicates active progress/position only; NEVER rendered on limbs or joints */}
      <View
        testID="movement-preview-scrubber"
        style={styles.scrubber}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: frameCount, now: positionIndex + 1 }}
      >
        {Array.from({ length: frameCount }, (_, i) => (
          <View
            key={i}
            style={[
              styles.scrubberTick,
              i === positionIndex ? styles.scrubberTickActive : styles.scrubberTickInactive,
            ]}
          />
        ))}
      </View>
      <Text style={styles.position} testID="movement-preview-position">{position}</Text>
      <Text style={styles.caption} testID="movement-preview-caption">{caption}</Text>
      <Pressable
        onPress={onControlPress}
        accessibilityRole="button"
        accessibilityLabel={controlAccessibilityLabel}
        accessibilityState={{ selected: playing }}
        accessibilityValue={{ text: position }}
        testID="movement-preview-control"
        style={({ pressed }) => [styles.control, pressed && styles.controlPressed]}
      >
        <Text style={styles.controlLabel}>{controlLabel}</Text>
      </Pressable>
      {reduceMotion && (
        <Text style={styles.reducedNote} testID="movement-preview-reduced-note">
          Your device asks for reduced motion, so the positions stay still and you step through them.
        </Text>
      )}
    </View>
  );
}

/** Segment index active at an absolute time within the cycle. */
function frameIndexAtTime(count: number, tMs: number, perSegment?: readonly number[]): number {
  const segs = segmentDurations(count, perSegment);
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (tMs < acc + segs[i]) return i;
    acc += segs[i];
  }
  return Math.max(0, count - 1);
}

const styles = StyleSheet.create({
  card: {
    marginTop: theme.space[4], // 16
    padding: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
    backgroundColor: theme.color.ink1,
    gap: theme.space[2], // 8
  },
  compactCard: {
    marginTop: theme.space[2], // 8
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    gap: theme.space[2],
  },

  heading: {
    ...theme.font.eyebrow,
    fontFamily: theme.font.family,
    color: theme.color.textLow,
  },
  summary: {
    ...theme.font.body,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
  },
  provenance: {
    ...theme.font.label,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
  },
  figureFrame: {
    alignSelf: 'center',
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    maxWidth: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    position: 'relative',
  },
  stageCanonical: {
    position: 'relative',
    overflow: 'hidden',
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: theme.color.line,
  },
  bone: {
    position: 'absolute',
    height: BONE,
    borderRadius: BONE / 2,
    backgroundColor: theme.color.textHi,
  },
  head: {
    position: 'absolute',
    width: HEAD_SIZE,
    height: HEAD_SIZE,
    borderRadius: HEAD_SIZE / 2,
    borderWidth: 3,
    borderColor: theme.color.textHi,
  },
  implement: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: theme.color.textMid,
  },
  position: {
    ...theme.font.label,
    fontFamily: theme.font.family,
    color: theme.color.textLow,
  },
  caption: {
    ...theme.font.body,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
  },
  control: {
    minHeight: theme.touch.min, // 56
    minWidth: theme.touch.min,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space[5], // 24
    borderWidth: 1,
    borderColor: theme.color.line,
    borderRadius: theme.radius.control,
  },
  controlPressed: {
    backgroundColor: theme.color.ink0,
  },
  controlLabel: {
    ...theme.font.label,
    fontFamily: theme.font.family,
    color: theme.color.textHi,
    letterSpacing: 0.4,
  },
  reducedNote: {
    ...theme.font.label,
    fontFamily: theme.font.family,
    color: theme.color.textMid,
  },
  scrubber: {
    flexDirection: 'row',
    height: 4,
    gap: theme.space[1], // 4
    marginTop: theme.space[1], // 4
    marginBottom: theme.space[1], // 4
    width: '100%',
  },
  scrubberTick: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  // STRICT CHALK RULE: Chalk color (#EFC94C) indicates active progress/position only; NEVER rendered on limbs or joints
  scrubberTickActive: {
    backgroundColor: theme.color.chalk,
  },
  scrubberTickInactive: {
    backgroundColor: theme.color.line,
  },
});
