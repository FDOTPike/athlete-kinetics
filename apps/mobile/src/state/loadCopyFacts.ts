/** Copy facts for the load field (#131). They never change the load. They are
 *  derived from the same inputs resolveSlotLoad reads, so the wording names
 *  the source the resolver actually used. */
export interface LoadCopyFacts {
  /** The operative "history" load came from a set logged this session: the
   *  resolver takes the current session's latest load before lastLoggedLoads. */
  historyFromThisSession: boolean;
  /** The manual advisory "history" load came from a set logged this session.
   *  logSet writes lastLoggedLoads only on days with no load reduction, so on
   *  an eased day the advisory is always the earlier session's load. */
  advisoryFromThisSession: boolean;
  /** lastLoggedLoads for the movement: the load before today's easing. */
  unadjustedHistoryKg: number | null;
}

const isHonest = (kg: number | null | undefined): kg is number =>
  typeof kg === 'number' && Number.isFinite(kg) && kg >= 0;

export const loadCopyFactsFor = (input: {
  /** Load of this movement's latest set in the current session, or null. */
  currentSessionLoadKg: number | null;
  hasSetThisSession: boolean;
  lastLoggedKg: number | null;
  easedToday: boolean;
}): LoadCopyFacts => ({
  historyFromThisSession: input.hasSetThisSession && isHonest(input.currentSessionLoadKg),
  advisoryFromThisSession: input.hasSetThisSession && !input.easedToday,
  unadjustedHistoryKg: isHonest(input.lastLoggedKg) ? input.lastLoggedKg : null,
});

/** Eased wording applies only when the shown load is actually lower than the
 *  unadjusted history load. A 0 kg added load on an eased day is not eased. */
export const isEasedBelow = (
  shownKg: number | null | undefined,
  unadjustedKg: number | null | undefined,
): boolean => isHonest(shownKg) && isHonest(unadjustedKg) && shownKg < unadjustedKg;
