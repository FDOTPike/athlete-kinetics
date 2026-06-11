export {
  AdjustmentValidationError,
  CUE_MAX_CHARS,
  CUE_MIN_CHARS,
  CUE_RE,
  LOAD_MODIFIER_LITERALS,
  NEUTRAL_ADJUSTMENT,
  RPE_CAP_LITERALS,
  SET_MODIFIER_LITERALS,
  validateAdjustment,
  type AdjustmentVector,
} from './outputSchema';
export {
  DEFAULT_PROFILE,
  ENERGY_SYSTEMS,
  EQUIPMENT_ITEMS,
  EQUIPMENT_PRESETS,
  MOVEMENT_PATTERNS,
  OBJECTIVES,
  PROGRESSION_METHODS,
  TRAINING_AGES,
  type BodyNote,
  type EnergySystem,
  type EquipmentItem,
  type MovementPattern,
  type Objective,
  type ProgressionMethod,
  type StateVectorRow,
  type TrainingAge,
  type UserProfile,
} from './types';
export { evaluatePolicy } from './policyReference';
export {
  applyProfileLimits,
  type ProfileContext,
  type ProfileLimitedPrescription,
} from './profileLimits';
export {
  RED_FLAG_PAIN,
  RED_FLAG_SYSTEMIC,
  resolveReport,
  scanRedFlags,
  type RedFlagScan,
  type ResolvedReport,
} from './semantic/redFlag';
export { getPrescription, type AdjustmentSource, type Prescription } from './prescribe';
export { normalize, packVectors, topK, type Match } from './semantic/cosine';
export {
  flattenTexts,
  loadCodebase,
  type Guardrail,
  type LoadedCodebase,
  type PhraseCodebase,
  type PhraseEntry,
} from './semantic/codebase';
export { type Embedder } from './semantic/embedder';
export { WordPieceTokenizer, type TokenizerSpec } from './semantic/wordpiece';
export {
  createMiniLmEmbedder,
  type MiniLmEmbedderOptions,
  type OrtSessionLike,
  type OrtTensorCtor,
} from './semantic/onnxEmbedder';
export {
  AMBIGUITY_MARGIN,
  CONFIDENCE_THRESHOLD,
  applyGuardrail,
  moreConservative,
  triage,
  type SessionDirective,
  type TriageResult,
} from './semantic/triage';
