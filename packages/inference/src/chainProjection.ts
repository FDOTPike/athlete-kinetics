/**
 * chainProjection.ts — P19 S0: derive progression chains from capability graph.
 *
 * Walks prerequisite edges grouped by movement_capability_family and emits
 * sequential (progressionGroup, progressionRank 0..n-1) display projection.
 * Deterministic, pure, no clock, no RNG.
 *
 * Throws on cycles, branching ambiguity (in-degree > 1 or out-degree > 1),
 * or disconnected components within a family.
 */

export interface MovementFamilyInput {
  readonly movementId: number;
  readonly family: string;
}

export interface CapabilityEdgeInput {
  readonly prerequisiteMovementId: number;
  readonly movementId: number;
  readonly relationship: string;
}

export interface ProjectedChainRow {
  readonly movementId: number;
  readonly progressionGroup: string;
  readonly progressionRank: number;
}

export const projectChainsFromGraph = (
  families: readonly MovementFamilyInput[],
  edges: readonly CapabilityEdgeInput[],
): ProjectedChainRow[] => {
  const familyByMovement = new Map<number, string>();
  const movementsByFamily = new Map<string, Set<number>>();

  for (const f of families) {
    familyByMovement.set(f.movementId, f.family);
    if (!movementsByFamily.has(f.family)) {
      movementsByFamily.set(f.family, new Set());
    }
    movementsByFamily.get(f.family)!.add(f.movementId);
  }

  const prereqEdges = edges.filter((e) => e.relationship === 'prerequisite');
  const results: ProjectedChainRow[] = [];

  // Process family by family in deterministic (alphabetical) order
  const sortedFamilies = Array.from(movementsByFamily.keys()).sort();

  for (const familyName of sortedFamilies) {
    const familyMovements = movementsByFamily.get(familyName)!;
    if (familyMovements.size === 0) continue;

    // Filter prerequisite edges that belong to this family
    const familyEdges = prereqEdges.filter((e) => {
      const pFam = familyByMovement.get(e.prerequisiteMovementId);
      const mFam = familyByMovement.get(e.movementId);
      return pFam === familyName && mFam === familyName;
    });

    const inDegree = new Map<number, number>();
    const outDegree = new Map<number, number>();
    const nextNode = new Map<number, number>();

    for (const mId of familyMovements) {
      inDegree.set(mId, 0);
      outDegree.set(mId, 0);
    }

    for (const e of familyEdges) {
      const src = e.prerequisiteMovementId;
      const dst = e.movementId;

      const currentIn = inDegree.get(dst) ?? 0;
      if (currentIn >= 1) {
        throw new Error(`Branching ambiguity in family "${familyName}": movement ${dst} has multiple prerequisites`);
      }
      inDegree.set(dst, currentIn + 1);

      const currentOut = outDegree.get(src) ?? 0;
      if (currentOut >= 1) {
        throw new Error(`Branching ambiguity in family "${familyName}": movement ${src} has multiple dependents`);
      }
      outDegree.set(src, currentOut + 1);
      nextNode.set(src, dst);
    }

    const roots = Array.from(familyMovements).filter((mId) => (inDegree.get(mId) ?? 0) === 0);

    if (familyEdges.length > 0 && roots.length > 1) {
      throw new Error(`Branching ambiguity in family "${familyName}": multiple root movements found`);
    }

    if (roots.length === 0) {
      throw new Error(`Cycle detected in family "${familyName}": no root movement found`);
    }

    // Walk from the root (if multiple roots exist when there are 0 edges, sort by movementId for determinism)
    roots.sort((a, b) => a - b);
    const visited = new Set<number>();

    for (const root of roots) {
      let curr: number | undefined = root;
      let rank = 0;

      while (curr !== undefined) {
        if (visited.has(curr)) {
          throw new Error(`Cycle detected in family "${familyName}" at movement ${curr}`);
        }
        visited.add(curr);
        results.push({
          movementId: curr,
          progressionGroup: familyName,
          progressionRank: rank++,
        });
        curr = nextNode.get(curr);
      }
    }

    if (visited.size !== familyMovements.size) {
      throw new Error(`Disconnected components or cycle in family "${familyName}"`);
    }
  }

  return results;
};
