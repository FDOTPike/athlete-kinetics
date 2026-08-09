import type { DifficultyRating, TrainingAge } from './types';
import { isDifficultyAllowed } from './tierPolicy';

export type MovementAvailabilityState = 'available' | 'teaching_only';

export interface CapabilityMovement {
  readonly movementId: number;
  readonly difficulty: DifficultyRating;
  readonly beginnerOk: boolean;
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
}

export interface ResolveMovementAvailabilityInput {
  readonly movements: readonly CapabilityMovement[];
  readonly edges: readonly CapabilityEdge[];
  readonly evidence: readonly CapabilityEvidence[];
  readonly attestedEdgeKeys: ReadonlySet<string>;
  readonly trainingAge: TrainingAge;
  readonly equipment: ReadonlySet<string>;
  readonly safetyExcludedMovementIds: ReadonlySet<number>;
}

export const capabilityEdgeKey = (edge: Pick<CapabilityEdge, 'prerequisiteMovementId' | 'movementId'>): string =>
  `${edge.prerequisiteMovementId}:${edge.movementId}`;

const clearsEdge = (
  edge: CapabilityEdge,
  evidence: readonly CapabilityEvidence[],
  attested: ReadonlySet<string>,
): boolean => {
  if (edge.requiresAttestation && !attested.has(capabilityEdgeKey(edge))) return false;
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
 * generator, and substitution surfaces. Tier/equipment/safety are outer hard
 * gates; capability evidence can never override them. */
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
      const tierAllowed = isDifficultyAllowed(
        input.trainingAge,
        movement.difficulty,
        movement.beginnerOk,
      );
      if (!tierAllowed) reasons.push('tier');
      if (!movement.requiredEquipment.every((item) => input.equipment.has(item))) reasons.push('equipment');
      if (input.safetyExcludedMovementIds.has(movement.movementId)) reasons.push('safety');
      const prerequisites = incoming.get(movement.movementId) ?? [];
      if (prerequisites.some((edge) => !clearsEdge(edge, input.evidence, input.attestedEdgeKeys))) {
        reasons.push('capability');
      }
      return {
        movementId: movement.movementId,
        state: reasons.length === 0 ? 'available' : 'teaching_only',
        reasons,
      };
    });
}
