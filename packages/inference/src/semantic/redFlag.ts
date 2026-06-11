/**
 * redFlag.ts — deterministic lexical safety layer over semantic triage.
 *
 * The cosine confidence gate (0.55) can reject genuinely dangerous reports
 * phrased tersely ("my back hurts"). This layer scans for injury language
 * with EXACT token sets (never prefixes — "stability", "chest press" and
 * "feeling sharp" must not trigger) and acts as a severity FLOOR:
 *
 *   - flags + a confident semantic match in a curated body-state category
 *     (pain/illness/fatigue) -> the curated entry wins (pain-sharp's halt,
 *     pain-mild's calibrated 0.7/7.0 — never degraded to the generic floor);
 *   - flags + below-gate OR a non-body match (positive/technique/equipment,
 *     i.e. a semantic misfire on a mixed report) -> the red-flag entry fires
 *     as a fully confident deterministic override;
 *   - systemic language (dizziness, faintness, chest symptoms) -> halt, not
 *     just a floor.
 *
 * Independent of the embedder by design: resolveReport(text, null) is the
 * full keyword path, so safety language works even when the ML runtime is
 * unavailable. One-token negation lookbehind suppresses "no pain today";
 * all residual ambiguity fails toward the conservative side.
 */
import type { PhraseEntry } from './codebase';
import type { TriageResult } from './triage';

// --- token sets (exact matches only) -----------------------------------------
const TIER1_PAIN = new Set([
  'hurt', 'hurts', 'hurting', 'pain', 'pains', 'painful',
  'tweak', 'tweaked', 'stab', 'stabbed', 'stabbing',
  'snap', 'snapped', 'numb', 'numbness', 'tingle', 'tingling', 'tingly',
]);
/** Ambiguous alone ("feeling sharp"); need a Tier-1 or body-region co-token. */
const TIER2_PAIN = new Set(['sharp', 'pop', 'popped']);
const BODY_REGIONS = new Set([
  'back', 'knee', 'knees', 'shoulder', 'shoulders', 'hip', 'hips',
  'elbow', 'elbows', 'neck', 'wrist', 'wrists', 'ankle', 'ankles',
  'spine', 'hamstring', 'hamstrings', 'quad', 'quads', 'calf', 'calves',
  'groin', 'rib', 'ribs', 'achilles', 'forearm', 'bicep', 'tricep',
]);
const SYSTEMIC = new Set([
  'dizzy', 'dizziness', 'lightheaded', 'faint', 'fainted', 'fainting',
  'nauseous', 'nausea', 'woozy',
]);
/** 'chest' alone is gym vocabulary (chest press/day/fly): bigrams only. */
const CHEST_SECOND = new Set(['pain', 'pains', 'pressure', 'tightness', 'tight', 'burn', 'burning', 'ache']);
const NEGATORS = new Set(['no', 'not', 'without', 'zero', 'isnt', 'never', 'non']);

const tokenize = (text: string): string[] =>
  text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 0);

export interface RedFlagScan {
  pain: boolean;
  systemic: boolean;
  matched: string[];
}

export function scanRedFlags(text: string): RedFlagScan {
  const tokens = tokenize(text);
  const negated = (i: number): boolean => i > 0 && NEGATORS.has(tokens[i - 1]);
  const matched: string[] = [];
  let tier1 = false;
  let tier2 = false;
  let body = false;
  let systemic = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (TIER1_PAIN.has(t) && !negated(i)) {
      tier1 = true;
      matched.push(t);
    }
    if (TIER2_PAIN.has(t) && !negated(i)) tier2 = true;
    if (BODY_REGIONS.has(t)) body = true;
    if (SYSTEMIC.has(t) && !negated(i)) {
      systemic = true;
      matched.push(t);
    }
    if (t === 'chest' && i + 1 < tokens.length && CHEST_SECOND.has(tokens[i + 1]) && !negated(i)) {
      systemic = true;
      matched.push(`chest ${tokens[i + 1]}`);
    }
  }
  if (tier2 && (tier1 || body)) matched.push('tier2+context');
  return { pain: tier1 || (tier2 && (tier1 || body)), systemic, matched };
}

// --- deterministic override entries -------------------------------------------
// Halt entries carry zero load and zero RPE cap (same invariant the codebase
// verifier enforces on curated halts).
export const RED_FLAG_SYSTEMIC: PhraseEntry = Object.freeze({
  id: 'red-flag-systemic',
  category: 'illness',
  text: 'systemic red flag keyword override',
  aliases: [],
  cue: 'Systemic red flag (dizziness or chest symptoms): stop now. No more load until symptoms fully settle.',
  guardrail: {
    load_multiplier: 0,
    set_delta: -3,
    rpe_cap_max: 0,
    halt: true,
    follow_up: 'Are the symptoms easing at complete rest right now?',
  },
});

export const RED_FLAG_PAIN: PhraseEntry = Object.freeze({
  id: 'red-flag-pain',
  category: 'pain',
  text: 'pain red flag keyword override',
  aliases: [],
  cue: 'Pain language detected: load drops 40% and effort caps at RPE 6 until you can localize it.',
  guardrail: {
    load_multiplier: 0.6,
    set_delta: -1,
    rpe_cap_max: 6.0,
    halt: false,
    follow_up: 'Where exactly is it, and does it change during the movement?',
  },
});

/** Categories where a confident semantic match is the better-calibrated
 *  body-state answer and must not be degraded to the generic floor. */
const CURATED_BODY_CATEGORIES = new Set(['pain', 'illness', 'fatigue']);

export interface ResolvedReport {
  entry: PhraseEntry | null;
  /** Cosine of the semantic match when one was computed; null on the
   *  keyword-only path (embedder unavailable). */
  similarity: number | null;
  confident: boolean;
  overrideApplied: boolean;
}

export function resolveReport(text: string, semantic: TriageResult | null): ResolvedReport {
  const flags = scanRedFlags(text);
  const sem: ResolvedReport = {
    entry: semantic?.confident === true ? semantic.entry : null,
    similarity: semantic?.similarity ?? null,
    confident: semantic?.confident === true,
    overrideApplied: false,
  };
  if (!flags.pain && !flags.systemic) return sem;

  // Confident curated body-state match wins (halts included).
  if (sem.confident && sem.entry !== null && CURATED_BODY_CATEGORIES.has(sem.entry.category)) {
    return sem;
  }
  // Below the gate, or a semantic misfire on a mixed report: deterministic
  // override, treated as fully confident.
  return {
    entry: flags.systemic ? RED_FLAG_SYSTEMIC : RED_FLAG_PAIN,
    similarity: semantic?.similarity ?? null,
    confident: true,
    overrideApplied: true,
  };
}
