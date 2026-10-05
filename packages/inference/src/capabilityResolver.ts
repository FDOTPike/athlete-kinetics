import type { DifficultyRating, TrainingAge } from './types';
import {
  effectiveMovementAccessContext,
  isDifficultyAllowed,
  type ExecutableMovementAccessContext,
  type MovementAccessContext,
} from './tierPolicy';

export type MovementAvailabilityState = 'available' | 'teaching_only';

export interface CapabilityMovement {
  readonly movementId: number;
  readonly difficulty: DifficultyRating;
  readonly beginnerOk: boolean;
  readonly sportTracking: boolean;
  readonly requiredEquipment: readonly string[];
}

export interface CapabilityEdge {
  readonly prerequisiteMovementId: number;
  readonly movementId: number;
  readonly relationship: 'prerequisite' | 'regression' | 'variation';
  readonly minSessions: number;
  readonly minSetsPerSession: number;
  readonly minValue: number;
  readonly valueKind: 'reps' | 'time';
  readonly maxRpe: number | null;
  readonly requiresAttestation: boolean;
}

export interface CapabilityEvidence {
  readonly movementId: number;
  readonly sessionId: string | number;
  readonly qualifyingSets: number;
  readonly minimumValue: number;
  readonly maximumRpe: number | null;
  readonly verified: boolean;
}

export interface MovementAvailability {
  readonly movementId: number;
  readonly state: MovementAvailabilityState;
  readonly reasons: readonly ('tier' | 'equipment' | 'safety' | 'capability')[];
  readonly effectiveContext: ExecutableMovementAccessContext;
  readonly capabilitySource: CapabilitySource;
  readonly blockingPrerequisiteMovementIds: readonly number[];
  readonly confirmationWouldClear: boolean;
  readonly separateAttestationRequired: boolean;
}

export type CapabilitySource =
  | 'not_required'
  | 'evidence'
  | 'prior_experience'
  | 'advanced_bypass'
  | 'blocked';

export interface ResolveMovementAvailabilityInput {
  readonly movements: readonly CapabilityMovement[];
  readonly edges: readonly CapabilityEdge[];
  readonly evidence: readonly CapabilityEvidence[];
  readonly attestedEdgeKeys: ReadonlySet<string>;
  readonly priorExperienceMovementIds: ReadonlySet<number>;
  readonly trainingAge: TrainingAge;
  readonly accessContext: MovementAccessContext;
  readonly equipment: ReadonlySet<string>;
  readonly safetyExcludedMovementIds: ReadonlySet<number>;
}

export const capabilityEdgeKey = (edge: Pick<CapabilityEdge, 'prerequisiteMovementId' | 'movementId'>): string =>
  `${edge.prerequisiteMovementId}:${edge.movementId}`;

const evidenceClearsEdge = (
  edge: CapabilityEdge,
  evidence: readonly CapabilityEvidence[],
): boolean => {
  const sessions = new Set<string | number>();
  for (const row of evidence) {
    if (!row.verified || row.movementId !== edge.prerequisiteMovementId) continue;
    if (row.qualifyingSets < edge.minSetsPerSession || row.minimumValue < edge.minValue) continue;
    if (edge.maxRpe !== null && (row.maximumRpe === null || row.maximumRpe > edge.maxRpe)) continue;
    sessions.add(row.sessionId);
  }
  return sessions.size >= edge.minSessions;
};

/** One deterministic availability law shared by the library, routine builder,
 * generator, and substitution surfaces. Tier/equipment/safety stay outer hard
 * gates. Prior experience and Advanced status may replace ordinary capability
 * evidence only in their ratified contexts; neither can replace attestation. */
export function resolveMovementAvailability(
  input: ResolveMovementAvailabilityInput,
): readonly MovementAvailability[] {
  const incoming = new Map<number, CapabilityEdge[]>();
  for (const edge of input.edges) {
    if (edge.relationship !== 'prerequisite') continue;
    const list = incoming.get(edge.movementId) ?? [];
    list.push(edge);
    incoming.set(edge.movementId, list);
  }

  return [...input.movements]
    .sort((a, b) => a.movementId - b.movementId)
    .map((movement): MovementAvailability => {
      const reasons: ('tier' | 'equipment' | 'safety' | 'capability')[] = [];
      const effectiveContext = effectiveMovementAccessContext(
        input.accessContext,
        movement.sportTracking,
      );
      const tierAllowed = isDifficultyAllowed(
        input.trainingAge,
        movement.difficulty,
        movement.beginnerOk,
        effectiveContext,
        movement.sportTracking,
      );
      if (!tierAllowed) reasons.push('tier');
      if (!movement.requiredEquipment.every((item) => input.equipment.has(item))) reasons.push('equipment');
      if (input.safetyExcludedMovementIds.has(movement.movementId)) reasons.push('safety');
      const prerequisites = incoming.get(movement.movementId) ?? [];
      const missingAttestation = prerequisites.filter((edge) =>
        edge.requiresAttestation && !input.attestedEdgeKeys.has(capabilityEdgeKey(edge)));
      const missingEvidence = prerequisites.filter((edge) =>
        !evidenceClearsEdge(edge, input.evidence));
      const separateAttestationRequired = missingAttestation.length > 0;
      const confirmationPermitted = effectiveContext === 'sport_conditioning'
        || (effectiveContext === 'weight_room' && input.trainingAge === 'intermediate');
      const advancedBypassPermitted = effectiveContext === 'weight_room'
        && (input.trainingAge === 'advanced' || input.trainingAge === 'elite');

      let capabilitySource: CapabilitySource;
      if (prerequisites.length === 0) capabilitySource = 'not_required';
      else if (separateAttestationRequired) capabilitySource = 'blocked';
      else if (missingEvidence.length === 0) capabilitySource = 'evidence';
      else if (confirmationPermitted && input.priorExperienceMovementIds.has(movement.movementId)) {
        capabilitySource = 'prior_experience';
      } else if (advancedBypassPermitted) capabilitySource = 'advanced_bypass';
      else capabilitySource = 'blocked';

      if (capabilitySource === 'blocked') {
        reasons.push('capability');
      }
      const blockingPrerequisiteMovementIds = capabilitySource === 'blocked'
        ? [...new Set([...missingEvidence, ...missingAttestation]
            .map((edge) => edge.prerequisiteMovementId))].sort((a, b) => a - b)
        : [];
      const confirmationWouldClear = capabilitySource === 'blocked'
        && confirmationPermitted
        && !separateAttestationRequired
        && missingEvidence.length > 0;
      return {
        movementId: movement.movementId,
        state: reasons.length === 0 ? 'available' : 'teaching_only',
        reasons,
        effectiveContext,
        capabilitySource,
        blockingPrerequisiteMovementIds,
        confirmationWouldClear,
        separateAttestationRequired,
      };
    });
}
