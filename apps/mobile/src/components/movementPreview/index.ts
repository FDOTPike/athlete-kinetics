/**
 * movementPreview — offline movement previews (WO-09A bounded prototype,
 * canonical 11-joint rig rendering added under WO-09).
 *
 * Import from here: `import { MovementPreview } from '../components/movementPreview'`
 */
export { MovementPreview, PREVIEW_LAYOUT } from './MovementPreview';
export type { MovementPreviewProps } from './MovementPreview';

export {
  resolveMovementPreview,
  previewEntries,
  rawPreviewEntries,
  PREVIEW_BOX,
  PREVIEW_CHARACTER,
  PREVIEW_FRAME_INTERVAL_MS,
  PREVIEW_TECHNIQUE_REVIEW,
  PREVIEW_SHARED_RIG,
  DUAL_BODY_PARAMETERS,
  CHALK_VISUAL_RULES,
} from './manifest';
export type {
  BodyType,
  CanonicalFrame,
  CanonicalJointName,
  CanonicalPose,
  CoveredFrameData,
  CoveredPreview,
  PreviewEntry,
  PreviewFrame,
  PreviewJointName,
  PreviewPoint,
  PreviewRig,
  PreviewStatus,
  PreviewSubject,
  UncoveredPreview,
  ViewName,
} from './manifest';

export {
  layoutCanonicalFigure,
  lerpJoints,
  easeInOut,
  poseAtTime,
  segmentDurations,
  segmentLengths,
  EQUIPMENT_BY_SLUG,
} from './canonicalFigure';
export type {
  BodyParameters,
  CanonicalPoint,
  CirclePrim,
  ColorRole,
  FigureOptions,
  FigurePrim,
  RectPrim,
  BonePrim,
} from './canonicalFigure';

export {
  claimPreviewPlayback,
  releasePreviewPlayback,
  resetPreviewPlayback,
  isPlaybackActive,
} from './playbackCoordinator';
