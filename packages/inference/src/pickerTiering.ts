/**
 * pickerTiering.ts — Pure implement tier mapping and movement sorting for the
 * custom routine template builder movement picker (Phase 19 Custom Block Builder).
 *
 * Fully deterministic, pure functions (no clock, no RNG, no I/O).
 */

import {
  DIFFICULTY_RANK,
  type DifficultyRating,
  type TaxonomyImplement,
} from './types';

export type PickerTier = 1 | 2 | 3;

export const PICKER_TIER_NAMES: Record<PickerTier, string> = {
  1: 'MAIN LIFTS',
  2: 'DUMBBELL, KETTLEBELL & BODYWEIGHT',
  3: 'CABLE & ASSISTED',
} as const;

export const TIER_3_CAPTION =
  'Assisted and cable variations to maintain training stimulus when injury or equipment restricts free weight movement.';

/**
 * Total mapping from implement to picker tier:
 *   Tier 1: barbell
 *   Tier 2: dumbbell, kettlebell, bodyweight, band
 *   Tier 3: cable, machine, other
 */
export function mapImplementToTier(implement: string | null | undefined): PickerTier {
  switch (implement) {
    case 'barbell':
      return 1;
    case 'dumbbell':
    case 'kettlebell':
    case 'bodyweight':
    case 'band':
      return 2;
    case 'cable':
    case 'machine':
    case 'other':
      return 3;
    default:
      return 3;
  }
}


export interface PickerSortableMovement {
  name: string;
  difficulty: DifficultyRating;
  implement?: string | null;
  executable: boolean;
}

/**
 * Sorts movements within a specific implement tier:
 *   - Usable (executable) movements sort above locked/unavailable ones.
 *   - Tier 1: difficulty_rating DESCENDING (Advanced > Intermediate > Beginner).
 *   - Tiers 2 & 3: difficulty_rating ASCENDING (Beginner > Intermediate > Advanced).
 *   - Ties break alphabetically by name so ordering is deterministic.
 */
export function sortPickerMovements<T extends PickerSortableMovement>(
  items: readonly T[],
  tier: PickerTier,
): T[] {
  return [...items].sort((a, b) => {
    // 1. Usable first
    if (a.executable !== b.executable) {
      return a.executable ? -1 : 1;
    }
    // 2. Difficulty rating
    const rankA = DIFFICULTY_RANK[a.difficulty] ?? 1;
    const rankB = DIFFICULTY_RANK[b.difficulty] ?? 1;
    if (rankA !== rankB) {
      return tier === 1 ? rankB - rankA : rankA - rankB;
    }
    // 3. Name alphabetical tie breaker (case-insensitive for consistency)
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/**
 * Groups movements into the three implement tiers and applies the tier-specific sort order.
 */
export function groupAndSortPickerMovements<T extends PickerSortableMovement>(
  items: readonly T[],
): Record<PickerTier, T[]> {
  const groups: Record<PickerTier, T[]> = {
    1: [],
    2: [],
    3: [],
  };
  for (const item of items) {
    const tier = mapImplementToTier(item.implement);
    groups[tier].push(item);
  }
  return {
    1: sortPickerMovements(groups[1], 1),
    2: sortPickerMovements(groups[2], 2),
    3: sortPickerMovements(groups[3], 3),
  };
}
