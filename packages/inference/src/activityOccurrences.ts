import type {
  ActivityCompletion,
  ActivityOccurrence,
} from './accessibleCoachContract';

export interface ActivityAccountingSummary {
  readonly completedOccurrenceCount: number;
  readonly knownDurationMin: number;
  readonly unknownDurationCount: number;
  readonly knownEffortCount: number;
  readonly excludedOccurrenceCount: number;
}

/**
 * Counts each stable occurrence once. A series is schedule intent and never a
 * second completion. Duration and effort stay separate; missing effort never
 * becomes zero and no cross-sport load score is invented.
 */
export function summarizeCompletedActivities(input: {
  readonly occurrences: readonly ActivityOccurrence[];
  readonly completions: readonly ActivityCompletion[];
}): ActivityAccountingSummary {
  const occurrences = new Map<string, ActivityOccurrence>();
  for (const occurrence of input.occurrences) {
    if (occurrences.has(occurrence.occurrenceId)) {
      throw new Error(`duplicate activity occurrence: ${occurrence.occurrenceId}`);
    }
    occurrences.set(occurrence.occurrenceId, occurrence);
  }

  const completions = new Map<string, ActivityCompletion>();
  for (const completion of input.completions) {
    if (completions.has(completion.occurrenceId)) {
      throw new Error(`duplicate activity completion: ${completion.occurrenceId}`);
    }
    completions.set(completion.occurrenceId, completion);
  }

  let completedOccurrenceCount = 0;
  let knownDurationMin = 0;
  let unknownDurationCount = 0;
  let knownEffortCount = 0;
  let excludedOccurrenceCount = 0;

  for (const occurrence of occurrences.values()) {
    if (occurrence.state !== 'completed') {
      excludedOccurrenceCount += 1;
      continue;
    }
    const completion = completions.get(occurrence.occurrenceId);
    if (completion === undefined) {
      unknownDurationCount += 1;
      completedOccurrenceCount += 1;
      continue;
    }
    completedOccurrenceCount += 1;
    if (completion.actualDurationMin === null) unknownDurationCount += 1;
    else knownDurationMin += completion.actualDurationMin;
    if (completion.actualEffort !== null) knownEffortCount += 1;
  }

  for (const occurrenceId of completions.keys()) {
    if (!occurrences.has(occurrenceId)) {
      throw new Error(`activity completion has no occurrence: ${occurrenceId}`);
    }
  }

  return {
    completedOccurrenceCount,
    knownDurationMin,
    unknownDurationCount,
    knownEffortCount,
    excludedOccurrenceCount,
  };
}

export interface ActivitySourceIdentity {
  readonly occurrenceId: string;
  readonly sourceKind: 'manual' | 'imported' | 'coached_session';
  readonly sourceIdentity: string;
}

/**
 * Source links are explicit reconciliation, not fuzzy matching. A source may
 * identify one occurrence only; several sources may deliberately identify the
 * same occurrence without multiplying its accounting contribution.
 */
export function indexExplicitActivitySources(
  links: readonly ActivitySourceIdentity[],
): ReadonlyMap<string, string> {
  const sourceToOccurrence = new Map<string, string>();
  for (const link of links) {
    const sourceKey = `${link.sourceKind}:${link.sourceIdentity}`;
    const existing = sourceToOccurrence.get(sourceKey);
    if (existing !== undefined && existing !== link.occurrenceId) {
      throw new Error(`activity source already linked: ${sourceKey}`);
    }
    sourceToOccurrence.set(sourceKey, link.occurrenceId);
  }
  return sourceToOccurrence;
}
