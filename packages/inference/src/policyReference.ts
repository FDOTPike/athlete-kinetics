/**
 * policyReference.ts — the LOADCTL policy: a deterministic first-match-wins
 * rule table mapping the daily state vector to a mechanical adjustment.
 *
 * This is THE prescription engine (the generative SLM it once shadowed was
 * removed after live-fire evaluation — see outputSchema.ts header). It runs
 * in microseconds, needs zero downloads, and is the reason the app is fully
 * functional on any device for free.
 *
 * INVARIANT (verified by test/verify_policy.mjs): for any state_vector row,
 * the output stays inside the canonical literal domains of outputSchema.ts
 * and the cue obeys the charset/length contract.
 */
import type { AdjustmentVector } from './outputSchema';
import type { StateVectorRow } from './types';

const fmt = (v: number | null, dp: number): string =>
  v === null || !Number.isFinite(v) ? 'NA' : v.toFixed(dp);

/** Charset-safe cue (GBNF cue-char class), clamped to the 12..140 contract. */
const cue = (text: string): string => {
  const safe = text.replace(/[^0-9A-Za-z .,;:%()+/-]/g, '').slice(0, 140);
  return safe.length >= 12 ? safe : 'Execute the plan as written today.';
};

/**
 * First match wins per field. NA (null) inputs skip any rule that tests them.
 */
export function evaluatePolicy(row: StateVectorRow): AdjustmentVector {
  const r = row.readiness_score;
  const acwr = row.acwr;
  const hrvz = row.hrv_z;
  const slp = row.sleep_efficiency_pct;

  // load_modifier (first match wins)
  let load: number;
  if (acwr !== null && acwr > 1.5) load = 0.85;
  else if (r < 40) load = 0.85;
  else if (r < 55) load = 0.9;
  else if (r < 70) load = 0.95;
  else if (r >= 85 && acwr !== null && acwr <= 1.3 && hrvz !== null && hrvz >= 0) load = 1.05;
  else load = 1.0;

  // set_modifier
  let sets: number;
  if ((acwr !== null && acwr > 1.5) || r < 40) sets = -2;
  else if (r < 55) sets = -1;
  else if (r >= 85 && slp !== null && slp >= 85) sets = 1;
  else sets = 0;

  // rpe_cap
  let rpe: number;
  if (r < 40 || (hrvz !== null && hrvz < -1.5)) rpe = 6.5;
  else if (r < 55) rpe = 7.5;
  else if (r < 70) rpe = 8.5;
  else if (r < 85) rpe = 9.0;
  else rpe = 9.5;

  // coaching_cue — blunt mechanical rationale citing the decisive numbers
  let text: string;
  if (acwr !== null && acwr > 1.5) {
    text = `ACWR ${fmt(acwr, 2)} spike: cut load 15% and drop 2 sets to re-enter the 0.8-1.30 band.`;
  } else if (r < 40) {
    text = `Readiness ${fmt(r, 0)} with HRV z ${fmt(hrvz, 1)}: pull load 15% and cap effort at RPE ${fmt(rpe, 1)}.`;
  } else if (r < 55) {
    text = `Readiness ${fmt(r, 0)}: reduce load 10%, one set down, RPE cap ${fmt(rpe, 1)}.`;
  } else if (r < 70) {
    text = `Readiness ${fmt(r, 0)}: shave load 5% and stop sets at RPE ${fmt(rpe, 1)}.`;
  } else if (load === 1.05) {
    text = `Readiness ${fmt(r, 0)}, ACWR ${fmt(acwr, 2)} in band: add 5% load${sets === 1 ? ' and one set' : ''}, cap RPE ${fmt(rpe, 1)}.`;
  } else {
    text = `Readiness ${fmt(r, 0)}, ACWR ${fmt(acwr, 2)}: hold planned loads, RPE cap ${fmt(rpe, 1)}.`;
  }

  return { load_modifier: load, set_modifier: sets, rpe_cap: rpe, coaching_cue: cue(text) };
}
