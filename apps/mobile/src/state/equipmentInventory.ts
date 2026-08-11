/**
 * equipmentInventory.ts — the fail-closed parser for a persisted
 * athlete_profile.equipment_inventory cell.
 *
 * The law it enforces (owner decision O3, migration 049): no DEFAULT, PRESET,
 * or PARSE FALLBACK may ever grant specialist equipment. Specialist items are
 * explicit opt-in only, so a movement that needs one stays teaching-only until
 * the athlete deliberately selects it.
 *
 * That splits the parser into two branches with deliberately DIFFERENT domains:
 *
 *   - RECOVERY (malformed JSON, or valid JSON that is not an array) falls back
 *     to the STANDARD vocabulary. Returning the full union here would silently
 *     hand Boards to an athlete whose profile row is corrupt, and make Board
 *     Press executable for someone who never owned boards.
 *   - CANONICALIZATION (a valid array) filters against the FULL union, because
 *     it is filtering an explicit, valid selection — that is exactly where a
 *     persisted 'boards' has to survive, in canonical order.
 *
 * An empty array stays empty: "I own nothing" is a valid explicit answer and is
 * never repopulated.
 *
 * Dependency-free by design (the loadPreferenceStore / athleteRegistryCore
 * precedent): the two vocabularies are passed in from @ak/inference by the one
 * caller, so there is still a single source of truth, and verify:store can
 * compile and EXECUTE the branch behaviour under Node instead of asserting it
 * by eye.
 */

/** Parse a persisted inventory cell. `canonical` is the complete persisted
 *  domain (used to canonicalize an explicit selection); `recovery` is the
 *  strictly narrower set a damaged cell may fall back to. */
export const parseInventoryWith = <T extends string>(
  json: string,
  canonical: readonly T[],
  recovery: readonly T[],
): T[] => {
  try {
    const v: unknown = JSON.parse(json);
    if (!Array.isArray(v)) return [...recovery];       // non-array -> recovery set
    const seen = new Set(v.filter((x): x is string => typeof x === 'string'));
    return canonical.filter((i) => seen.has(i));       // canonical order, known items
  } catch {
    return [...recovery];                              // malformed -> recovery set
  }
};

// ---------------------------------------------------------------------------
// The two persistence boundaries the inventory actually crosses. Both are
// named here so verify:store can execute the REAL production path rather than
// re-deriving an equivalent one (useStore itself cannot be imported under Node).
// ---------------------------------------------------------------------------

/** HYDRATION: athlete_profile.equipment_inventory is a TEXT cell holding a JSON
 *  array. Used by useStore.profileFromRow. */
export const inventoryFromRowCell = <T extends string>(
  cell: string,
  canonical: readonly T[],
  recovery: readonly T[],
): T[] => parseInventoryWith(cell, canonical, recovery);

/** SAVE: the inventory half of a profile_slot.profile_json snapshot. Used by
 *  useStore.profileToJsonString. Copied, so a later mutation of the live
 *  profile array cannot reach back into a written snapshot. */
export const inventoryToSnapshot = <T extends string>(inventory: readonly T[]): T[] => [...inventory];

/** LOAD: the inventory half of a parsed profile_slot snapshot. The value
 *  arrives already JSON-parsed, so it is re-serialized through the one shared
 *  parser — a hand-edited slot holding `{}`, `7` or a missing key must fail
 *  closed exactly as a damaged athlete_profile cell does. Used by
 *  useStore.profileFromJsonString. */
export const inventoryFromSnapshot = <T extends string>(
  value: unknown,
  canonical: readonly T[],
  recovery: readonly T[],
): T[] => parseInventoryWith(JSON.stringify(value ?? []), canonical, recovery);
