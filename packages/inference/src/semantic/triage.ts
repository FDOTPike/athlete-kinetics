/**
 * triage.ts — routes a subjective report to a guardrail and applies it.
 *
 * Confidence gate: below CONFIDENCE_THRESHOLD cosine, the system says so and
 * changes NOTHING — an unrecognized report must never silently alter load.
 * Margin gate: when the top two matches resolve to different entries with
 * near-identical scores, prefer the more conservative guardrail (lower
 * effective load) — ambiguity always resolves toward safety.
 */
import type { AdjustmentVector } from '../outputSchema';
import { CUE_MAX_CHARS } from '../outputSchema';
import { topK } from './cosine';
import type { Guardrail, LoadedCodebase, PhraseEntry } from './codebase';

export const CONFIDENCE_THRESHOLD = 0.55;
export const AMBIGUITY_MARGIN = 0.03;

export interface TriageResult {
  /** null = no confident match; nothing changes. */
  entry: PhraseEntry | null;
  similarity: number;
  confident: boolean;
}

export function triage(query: Float32Array, cb: LoadedCodebase): TriageResult {
  const matches = topK(cb.matrix, cb.rowCount, cb.dim, query, 2);
  if (matches.length === 0) return { entry: null, similarity: 0, confident: false };

  const [first, second] = matches;
  if (first.score < CONFIDENCE_THRESHOLD) {
    return { entry: null, similarity: first.score, confident: false };
  }

  let entry = cb.entries[cb.rowToEntry[first.index]];
  // Ambiguity gate: two different entries within the margin -> take the more
  // conservative one (halt beats everything, then lower load multiplier).
  if (second !== undefined && first.score - second.score < AMBIGUITY_MARGIN) {
    const other = cb.entries[cb.rowToEntry[second.index]];
    if (other.id !== entry.id && moreConservative(other.guardrail, entry.guardrail)) {
      entry = other;
    }
  }
  return { entry, similarity: first.score, confident: true };
}

/** True when guardrail `a` is strictly the more conservative of the pair.
 *  Exported: the store reuses it to pick the operative entry when several
 *  reports exist for one day. */
export function moreConservative(a: Guardrail, b: Guardrail): boolean {
  if (a.halt !== b.halt) return a.halt;
  if (a.load_multiplier !== b.load_multiplier) return a.load_multiplier < b.load_multiplier;
  return a.set_delta < b.set_delta;
}

// ---------------------------------------------------------------------------
// Guardrail application
// ---------------------------------------------------------------------------
export interface SessionDirective {
  vector: AdjustmentVector;
  /** End the session now. vector is forced to zero-load when set. */
  halt: boolean;
  /** Deterministic follow-up question for the athlete, if any. */
  followUp: string | null;
  /** What the system matched, for transparency in the UI. */
  matchedCue: string;
  similarity: number;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * Compose a guardrail onto the policy prescription. Monotone conservative by
 * construction: load and sets can only go down, the RPE cap can only tighten.
 */
export function applyGuardrail(
  base: AdjustmentVector,
  entry: PhraseEntry,
  similarity: number,
): SessionDirective {
  const g = entry.guardrail;
  if (g.halt) {
    return {
      vector: {
        load_modifier: 0,
        set_modifier: -2,
        rpe_cap: 0,
        coaching_cue: entry.cue.slice(0, CUE_MAX_CHARS),
      },
      halt: true,
      followUp: g.follow_up,
      matchedCue: entry.text,
      similarity,
    };
  }
  return {
    vector: {
      load_modifier: round2(Math.min(base.load_modifier, base.load_modifier * g.load_multiplier)),
      set_modifier: Math.max(-3, base.set_modifier + Math.min(0, g.set_delta)),
      rpe_cap: Math.min(base.rpe_cap, g.rpe_cap_max),
      coaching_cue: entry.cue.slice(0, CUE_MAX_CHARS),
    },
    halt: false,
    followUp: g.follow_up,
    matchedCue: entry.text,
    similarity,
  };
}
