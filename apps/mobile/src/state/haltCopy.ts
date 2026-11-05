/**
 * The one sentence set every screen shows while today's safety report has set
 * a halt (issue #178). A halt is not an adjustment: the matched entry's
 * coaching cue ("load drops 40%...") describes a reduced session and must not
 * be printed while no session is allowed. Wording and display only; what sets
 * or clears a halt is unchanged.
 */
export const HALT_TODAY_TEXT = 'Stop training for today. Do no more sets or sessions today.';

export const HALT_NEXT_TEXT =
  'Next: rest today and check in tomorrow. If it has not settled, or it gets worse, seek qualified professional advice.';

/** Replaces "You can still train while paused" on the programme pause card while a halt is active. */
export const HALT_PAUSE_CARD_TEXT =
  'Pausing holds your place in the programme so a gap does not cost you a block. Today\'s safety report has stopped training for today.';
