import type {
  HealthSupportHold,
  HealthSupportScope,
  PersonalizedAdviceTarget,
} from './accessibleCoachContract';

export type TrainingSupportDecision =
  | { readonly status: 'available'; readonly holdIds: readonly [] }
  | { readonly status: 'held'; readonly holdIds: readonly string[]; readonly reasonCodes: readonly string[] }
  | { readonly status: 'support_unavailable'; readonly holdIds: readonly [] };

// Migration 064 forbids a targeted scope without its identifier, but this is an
// exported boundary. A malformed scope has an unknown target, so it is treated
// as unresolved and holds athlete-wide rather than being silently skipped.
const targetIdentifierMissing = (scope: HealthSupportScope): boolean =>
  (scope.targetKind === 'activity_definition' && (scope.activityId ?? null) === null)
  || (scope.targetKind === 'activity_series' && (scope.seriesId ?? null) === null)
  || (scope.targetKind === 'activity_occurrence' && (scope.occurrenceId ?? null) === null)
  || (scope.targetKind === 'movement' && (scope.movementId ?? null) === null);

const sameTarget = (scope: HealthSupportScope, target: PersonalizedAdviceTarget): boolean => {
  if (scope.targetKind === 'all_prescription' || scope.targetKind === 'unresolved') return true;
  if (targetIdentifierMissing(scope)) return true;
  if (target.targetKind === 'all_prescription') return true;
  if (scope.targetKind === 'activity_definition') {
    return target.activityId === undefined || scope.activityId === target.activityId;
  }
  if (scope.targetKind === 'activity_series') {
    return target.seriesId === undefined || scope.seriesId === target.seriesId;
  }
  if (scope.targetKind === 'activity_occurrence') {
    return target.occurrenceId === undefined || scope.occurrenceId === target.occurrenceId;
  }
  return target.movementId === undefined || scope.movementId === target.movementId;
};

/**
 * Mechanical product boundary only. It does not interpret instruction prose,
 * decide clinical compatibility, or create clearance. Missing contract tables
 * fail closed; a present contract with no explicit hold remains factual
 * `not_assessed` state rather than a clearance claim.
 */
export function evaluateTrainingSupport(input: {
  readonly contractAvailable: boolean;
  readonly target: PersonalizedAdviceTarget;
  readonly holds: readonly HealthSupportHold[];
}): TrainingSupportDecision {
  if (!input.contractAvailable) return { status: 'support_unavailable', holdIds: [] };

  const matched = input.holds
    .filter((hold) => hold.state === 'held')
    .filter((hold) => hold.scopes.length === 0 || hold.scopes.some((scope) => sameTarget(scope, input.target)))
    .sort((a, b) => a.holdId < b.holdId ? -1 : a.holdId > b.holdId ? 1 : 0);

  if (matched.length === 0) return { status: 'available', holdIds: [] };
  return {
    status: 'held',
    holdIds: matched.map((hold) => hold.holdId),
    reasonCodes: [...new Set(matched.map((hold) => hold.reasonCode))].sort(),
  };
}
