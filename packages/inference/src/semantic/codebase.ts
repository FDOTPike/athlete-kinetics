/**
 * codebase.ts — the Phrase Codebase: a curated dictionary of subjective
 * athlete reports, each carrying a hardcoded guardrail. The embedding model
 * only ROUTES free text to an entry; every consequence is deterministic
 * TypeScript reviewed by a human.
 *
 * SAFETY INVARIANT (verified by test/verify_semantic.mjs): a subjective
 * report can only ever make a session more conservative — for every entry,
 * load_multiplier <= 1.0, set_delta <= 0, rpe_cap_max <= 10. "Feeling great"
 * routes to a no-op; only the objective state vector can raise load.
 */

export interface Guardrail {
  /** Multiplies the policy's load_modifier (<= 1.0, enforced). */
  load_multiplier: number;
  /** Added to the policy's set_modifier (<= 0, enforced). */
  set_delta: number;
  /** The session RPE cap becomes min(policy cap, this). */
  rpe_cap_max: number;
  /** Hard stop: end the session now (sharp pain, dizziness, chest symptoms). */
  halt: boolean;
  /** Deterministic follow-up question, or null when none is needed. */
  follow_up: string | null;
}

export interface PhraseEntry {
  id: string;
  category: 'pain' | 'illness' | 'fatigue' | 'technique' | 'positive' | 'equipment';
  /** Canonical phrasing (embedded). */
  text: string;
  /** Alternate phrasings, each embedded as an extra routing row. */
  aliases: readonly string[];
  /** Blunt cue shown when this entry matches. */
  cue: string;
  guardrail: Guardrail;
}

export interface PhraseCodebase {
  embeddingModel: string;
  dim: number;
  entries: readonly PhraseEntry[];
}

/** A guardrail that changes nothing (positive-sentiment entries). Such an
 *  entry must NEVER present as a safety intervention: the derivation skips
 *  it when picking the operative report, and the UI shows a positive
 *  acknowledgment instead of "guardrail applied". */
export const isNoOpGuardrail = (g: Guardrail): boolean =>
  !g.halt && g.load_multiplier >= 1 && g.set_delta >= 0 && g.rpe_cap_max >= 10;

/** Deterministic embed order: entry text, then aliases, per entry.
 *  scripts/embed-codebase.mjs and loadCodebase() must both use this. */
export function flattenTexts(cb: PhraseCodebase): { text: string; entryIndex: number }[] {
  const rows: { text: string; entryIndex: number }[] = [];
  cb.entries.forEach((e, entryIndex) => {
    rows.push({ text: e.text, entryIndex });
    for (const a of e.aliases) rows.push({ text: a, entryIndex });
  });
  return rows;
}

export interface LoadedCodebase {
  dim: number;
  /** Flat-packed normalized vectors, one row per flattenTexts() row. */
  matrix: Float32Array;
  rowCount: number;
  /** rowIndex -> entry index. */
  rowToEntry: readonly number[];
  entries: readonly PhraseEntry[];
}

import { packVectors } from './cosine';

/** Bind a codebase to its precomputed vectors (asset generated at build time
 *  by scripts/embed-codebase.mjs — the device never embeds the codebase). */
export function loadCodebase(cb: PhraseCodebase, vectors: readonly (readonly number[])[]): LoadedCodebase {
  const rows = flattenTexts(cb);
  if (vectors.length !== rows.length) {
    throw new Error(
      `codebase/vectors misaligned: ${rows.length} texts vs ${vectors.length} vectors — regenerate with scripts/embed-codebase.mjs`,
    );
  }
  return {
    dim: cb.dim,
    matrix: packVectors(vectors, cb.dim),
    rowCount: rows.length,
    rowToEntry: rows.map((r) => r.entryIndex),
    entries: cb.entries,
  };
}
