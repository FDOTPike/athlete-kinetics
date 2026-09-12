/**
 * Shared, offline contract for factual activities and user-reported training
 * support. IDs and timestamps are supplied by the application boundary: the
 * deterministic engines never generate identity or read the clock.
 *
 * This contract deliberately contains no diagnosis, screening answer,
 * executable medical limit, sport-dose rule, or duration-times-effort score.
 */

export const ACTIVITY_KIND_IDS = [
  'walking',
  'running',
  'swimming',
  'cycling',
  'strength_training',
  'basketball',
  'soccer',
  'netball',
  'rugby',
  'cricket',
  'field_hockey',
  'volleyball',
  'wheelchair_mobility',
  'wheelchair_sport',
  'custom',
] as const;
export type ActivityKindId = (typeof ACTIVITY_KIND_IDS)[number];

export const ACTIVITY_DEMANDS = ['low', 'moderate', 'high', 'unknown'] as const;
export type ActivityDemand = (typeof ACTIVITY_DEMANDS)[number];
export type DemandSource = 'user_reported' | 'curated' | 'unknown';
export type ActivityProvenance = 'user_reported' | 'imported' | 'coached_session';
export type TimingCommitment = 'fixed' | 'flexible';
export type ActivityOccurrenceState = 'planned' | 'completed' | 'cancelled' | 'missed';
export type ActivityCompletionState = 'partial' | 'completed';
export const ACTIVITY_MODALITY_IDS = [
  'outdoor_bicycle',
  'stationary_upright',
  'stationary_recumbent',
  'handcycle',
  'other',
  'unknown',
] as const;
export type ActivityModalityId = (typeof ACTIVITY_MODALITY_IDS)[number];
export const ACTIVITY_PURPOSE_IDS = [
  'practice',
  'match',
  'recreation',
  'conditioning',
  'transport',
  'other',
  'unknown',
] as const;
export type ActivityPurposeId = (typeof ACTIVITY_PURPOSE_IDS)[number];
export type TimeResolutionState =
  | 'unresolved'
  | 'unambiguous'
  | 'earlier_offset'
  | 'later_offset'
  | 'shift_forward_confirmed';
export type EffortScaleId = 'whole_session_effort_1_10';
export const WHOLE_SESSION_EFFORT_SCALE_VERSION = 1 as const;

export const ACTIVITY_FACILITY_KINDS = [
  'pool', 'open_water', 'road_path', 'trail', 'court', 'field_pitch',
  'indoor_space', 'gym', 'other', 'unknown',
] as const;
export type ActivityFacilityKind = (typeof ACTIVITY_FACILITY_KINDS)[number];

export const ACTIVITY_EQUIPMENT_KINDS = [
  'bicycle', 'stationary_cycle', 'handcycle', 'wheelchair', 'ball', 'stick',
  'protective_gear', 'other', 'unknown',
] as const;
export type ActivityEquipmentKind = (typeof ACTIVITY_EQUIPMENT_KINDS)[number];
export type ActivityRequirementState =
  | 'known_available'
  | 'known_unavailable'
  | 'unknown'
  | 'not_applicable';

export interface ActivityDefinition {
  readonly activityId: string;
  readonly kindId: ActivityKindId;
  readonly displayName: string;
  readonly demand: ActivityDemand;
  readonly demandSource: DemandSource;
  readonly provenance: 'user_reported';
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface ActivityRequirement {
  readonly requirementId: string;
  readonly activityId: string;
  readonly requirementKind: 'facility' | 'equipment';
  readonly requirementCode: ActivityFacilityKind | ActivityEquipmentKind;
  readonly requirementState: ActivityRequirementState;
  readonly provenance: 'user_reported';
  readonly recordedAtMs: number;
}

export interface ActivitySeries {
  readonly seriesId: string;
  readonly activityId: string;
  readonly revision: number;
  readonly recurrenceKind: 'weekly';
  readonly localWeekday: number;
  readonly localStartMinute: number | null;
  readonly timezoneId: string;
  readonly resolutionState: TimeResolutionState;
  readonly effectiveStartDate: string;
  readonly effectiveEndDate: string | null;
  readonly timing: TimingCommitment;
  readonly expectedDurationMin: number | null;
  readonly expectedEffort: number | null;
  readonly effortScaleId: EffortScaleId | null;
  readonly effortScaleVersion: typeof WHOLE_SESSION_EFFORT_SCALE_VERSION | null;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface ActivityOccurrence {
  readonly occurrenceId: string;
  readonly activityId: string;
  readonly seriesId: string | null;
  readonly originalRecurrenceKey: string | null;
  /** Immutable identity of the source that first materialized this occurrence. */
  readonly originKind: 'manual' | 'imported' | 'coached_session';
  readonly originIdentity: string;
  readonly originSessionId: number | null;
  readonly revision: number;
  readonly localDate: string;
  readonly localStartMinute: number | null;
  readonly timezoneId: string;
  readonly resolutionState: TimeResolutionState;
  readonly resolvedStartAtMs: number | null;
  readonly resolvedEndAtMs: number | null;
  readonly resolverVersion: string | null;
  readonly state: ActivityOccurrenceState;
  readonly timing: TimingCommitment;
  readonly modalityId: ActivityModalityId;
  readonly purposeId: ActivityPurposeId;
  readonly expectedDurationMin: number | null;
  readonly expectedEffort: number | null;
  readonly effortScaleId: EffortScaleId | null;
  readonly effortScaleVersion: typeof WHOLE_SESSION_EFFORT_SCALE_VERSION | null;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface ActivityCompletion {
  readonly occurrenceId: string;
  readonly state: ActivityCompletionState;
  readonly actualStartAtMs: number | null;
  readonly actualEndAtMs: number | null;
  readonly actualDurationMin: number | null;
  readonly actualEffort: number | null;
  readonly effortScaleId: EffortScaleId | null;
  readonly effortScaleVersion: typeof WHOLE_SESSION_EFFORT_SCALE_VERSION | null;
  readonly effortReportedAtMs: number | null;
  readonly recordedAtMs: number;
  readonly provenance: ActivityProvenance;
}

export interface ActivitySourceLink {
  readonly sourceLinkId: string;
  readonly occurrenceId: string;
  readonly sourceKind: 'manual' | 'imported' | 'coached_session';
  readonly sourceIdentity: string;
  readonly linkedSessionId: number | null;
  readonly recordedAtMs: number;
}

export interface ActivityTypicalWeekReport {
  readonly reportId: string;
  readonly reportedLocalDate: string;
  readonly coverageStartDate: string;
  readonly coverageEndDate: string;
  readonly timezoneId: string;
  readonly recordedAtMs: number;
}

export interface ActivityTypicalWeekItem {
  readonly itemId: string;
  readonly reportId: string;
  readonly activityId: string;
  readonly localWeekday: number | null;
  readonly typicalDurationMin: number | null;
  readonly typicalEffort: number | null;
  readonly effortScaleId: EffortScaleId | null;
  readonly effortScaleVersion: typeof WHOLE_SESSION_EFFORT_SCALE_VERSION | null;
}

export type HealthSupportReviewState = 'not_assessed' | 'pending_review' | 'review_required';
export type HealthSupportPreferenceKind = 'position' | 'position_transitions' | 'rest';
export type HealthSupportNoteKind = 'general' | 'functional_context' | 'symptom_trigger' | 'rest_context';
export type HealthSupportHoldOrigin = 'user_requested' | 'instruction_review' | 'deleted_support_review';
export type HealthSupportHoldReason =
  | 'review_requested'
  | 'instruction_unreviewed'
  | 'scope_unknown'
  | 'source_changed'
  | 'date_unresolved'
  | 'conflict_reported'
  | 'support_deleted';
export type HealthSupportTargetKind =
  | 'all_prescription'
  | 'activity_definition'
  | 'activity_series'
  | 'activity_occurrence'
  | 'movement'
  | 'unresolved';

export interface HealthSupportScope {
  readonly scopeId: string;
  readonly instructionId: string | null;
  readonly instructionRevision: number | null;
  readonly holdId: string | null;
  readonly targetKind: HealthSupportTargetKind;
  readonly activityId: string | null;
  readonly seriesId: string | null;
  readonly occurrenceId: string | null;
  readonly movementId: number | null;
  readonly reportedScopeText: string | null;
}

export interface HealthSupportHold {
  readonly holdId: string;
  readonly revision: number;
  readonly instructionId: string | null;
  readonly instructionRevision: number | null;
  readonly origin: HealthSupportHoldOrigin;
  readonly state: 'held' | 'withdrawn';
  readonly reasonCode: HealthSupportHoldReason;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly scopes: readonly HealthSupportScope[];
}

export interface HealthSupportProfile {
  readonly revision: number;
  readonly reviewState: HealthSupportReviewState;
  readonly detailsVisibility: 'collapsed' | 'expanded';
  readonly updatedAtMs: number;
}

export interface HealthSupportPreference {
  readonly preferenceId: string;
  readonly revision: number;
  readonly preferenceKind: HealthSupportPreferenceKind;
  readonly reportedValue: string;
  readonly detailText: string | null;
  readonly provenance: 'user_reported';
  readonly recordedAtMs: number;
  readonly updatedAtMs: number;
}

export interface HealthSupportNote {
  readonly noteId: string;
  readonly revision: number;
  readonly noteKind: HealthSupportNoteKind;
  readonly bodyText: string;
  readonly provenance: 'user_reported';
  readonly recordedAtMs: number;
  readonly updatedAtMs: number;
}

export interface ClinicianInstruction {
  readonly instructionId: string;
  readonly currentRevision: number;
  readonly createdAtMs: number;
}

export interface ClinicianInstructionRevision {
  readonly instructionId: string;
  readonly revision: number;
  readonly instructionText: string;
  readonly issuerText: string | null;
  readonly sourceClass: 'clinician_guidance_as_reported';
  readonly provenance: 'user_reported';
  readonly verificationState: 'not_verified';
  readonly recordedAtMs: number;
  readonly instructionDate: string | null;
  readonly effectiveDate: string | null;
  readonly reviewDate: string | null;
  readonly expiryDate: string | null;
  readonly dateZoneId: string | null;
  readonly dateStatus: 'unknown' | 'as_reported';
  readonly transcriptionState: 'draft' | 'user_confirmed';
  readonly confirmedAtMs: number | null;
  readonly supersedesRevision: number | null;
  readonly lifecycle: 'current' | 'superseded' | 'withdrawn';
}

export interface PersonalizedAdviceTarget {
  readonly targetKind: Exclude<HealthSupportTargetKind, 'unresolved'>;
  readonly activityId?: string;
  readonly seriesId?: string;
  readonly occurrenceId?: string;
  readonly movementId?: number;
}

export type RecommendationSupportStatus =
  | 'available'
  | 'held'
  | 'setup_required'
  | 'support_unavailable';

/**
 * Content-free provenance for a deterministic recommendation attempt. Health
 * prose is deliberately excluded: only the decisive stable IDs/revisions and
 * reason codes may be attached by the application boundary.
 */
export interface RecommendationSupportRecord {
  readonly decisionId: string;
  readonly adviceTargetKind: 'program' | 'block' | 'session' | 'slot' | 'movement_substitution';
  readonly adviceTargetIdentity: string;
  readonly status: RecommendationSupportStatus;
  readonly engineVersion: string;
  readonly generatedAtMs: number;
}

export interface RecommendationActivityBasis {
  readonly decisionId: string;
  readonly occurrenceId: string;
  readonly occurrenceRevision: number;
}

export interface RecommendationHoldBasis {
  readonly decisionId: string;
  readonly holdId: string;
  readonly holdRevision: number;
  readonly reasonCode: HealthSupportHoldReason;
}
