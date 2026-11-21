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
 *     pain-mild's calibrated 0.7/7.0 — never degraded to the generic floor),
 *     with ONE exception: systemic language beside a curated entry that does
 *     not halt. Then the systemic halt stands (next but one bullet). A sore
 *     back with dizziness is a halt, not a soreness adjustment. Until
 *     2026-10-13 the curated entry won here too, so the two rules collided
 *     and the report left without a halt (decision recorded in
 *     DEVIATION_LOG.md, 2026-10-13);
 *   - flags + below-gate OR a non-body match (positive/technique/equipment,
 *     i.e. a semantic misfire on a mixed report) -> the red-flag entry fires
 *     as a fully confident deterministic override;
 *   - systemic language (dizziness, faintness, chest symptoms) -> halt, not
 *     just a floor.
 *
 * Independent of the embedder by design: resolveReport(text, null) is the
 * full keyword path, so safety language works even when the ML runtime is
 * unavailable. Clause-scoped negation suppresses denied symptoms;
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
const NEGATORS = new Set(['no', 'not', 'without', 'zero', 'isnt', 'never', 'non', 'none', 'free', 'resolved']);
const RESOLUTION_NEGATORS = new Set(['not', 'no', 'never', 'isnt', 'wasnt', 'hardly', 'barely', 'without']);
const RELIEF_OR_CONTRAST = new Set([
  'relief', 'improvement', 'recovery', 'recovered', 'better',
  'ease', 'easing', 'change', 'break', 'letup', 'until', 'unless', 'despite',
]);

const BOUNDARY = new Set([',', ';', '.', '!', '?', 'but', 'however', 'except', 'though', 'although']);
const DENIAL = new Set(['zero', 'gone', 'resolved', 'subsided', 'none']);
const tokenize = (text: string): string[] => text.toLowerCase().match(/[a-z0-9]+|[,;.!?]/g) ?? [];

export interface RedFlagScan {
  pain: boolean;
  systemic: boolean;
  matched: string[];
}

export function scanRedFlags(text: string): RedFlagScan {
  const clauses: string[][] = [[]];
  for (const token of tokenize(text)) {
    if (BOUNDARY.has(token)) { if (clauses[clauses.length - 1].length) clauses.push([]); }
    else clauses[clauses.length - 1].push(token);
  }
  const matched: string[] = [];
  const bodyAnywhere = clauses.some(clause => clause.some(t => BODY_REGIONS.has(t)));
  let pain = false;
  let systemic = false;
  for (let c = 0; c < clauses.length; c++) {
    const tokens = clauses[c];
    const negated = (i: number): boolean => {
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        if (tokens[j] === 'and' || RELIEF_OR_CONTRAST.has(tokens[j])) break;
        if (TIER1_PAIN.has(tokens[j]) || SYSTEMIC.has(tokens[j])) {
          if ((tokens[j + 1] === 'or' || tokens[j + 1] === 'nor') && negated(j)) return true;
          break;
        }
        if (NEGATORS.has(tokens[j])) return true;
      }
      for (let j = i + 1; j <= Math.min(tokens.length - 1, i + 3); j++) {
        if (tokens[j] === 'and' || TIER1_PAIN.has(tokens[j]) || SYSTEMIC.has(tokens[j]) ||
            RESOLUTION_NEGATORS.has(tokens[j])) break;
        if (DENIAL.has(tokens[j])) return true;
      }
      const past = tokens.includes('yesterday') || tokens.includes('earlier') || tokens.includes('tuesday') ||
        tokens.some((t, j) => t === 'last' && tokens[j + 1] === 'week');
      if (!past) return false;
      const tail = [...tokens.slice(i + 1), ...(clauses[c + 1] ?? [])];
      const resolution = tail.findIndex((t, j) => {
        const matchesResolution = (t === 'resolved') ||
          ((t === 'fine' || t === 'good' || t === 'gone' || t === '100') && tail[j + 1] === 'now');
        if (!matchesResolution) return false;
        return !RESOLUTION_NEGATORS.has(tail[j - 1] ?? '') && !RESOLUTION_NEGATORS.has(tail[j - 2] ?? '');
      });
      if (resolution < 0) return false;
      const isSystemicToken = SYSTEMIC.has(tokens[i]) || tokens[i] === 'chest' ||
        (i > 0 && tokens[i - 1] === 'chest' && CHEST_SECOND.has(tokens[i]));
      const beforeResolution = tail.slice(0, resolution);
      if (beforeResolution.some(t => TIER1_PAIN.has(t) || SYSTEMIC.has(t))) return false;
      if (beforeResolution.some(t => BODY_REGIONS.has(t) && (isSystemicToken || !tokens.includes(t)))) {
        return false;
      }
      return true;
    };
    let tier1 = false;
    let tier2 = false;
    let body = bodyAnywhere;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (TIER1_PAIN.has(t) && !negated(i)) { tier1 = true; matched.push(t); }
      if (TIER2_PAIN.has(t) && !negated(i)) {
        const related = tokens.slice(i + 1, i + 4).findIndex(word => TIER1_PAIN.has(word));
        if (related < 0 || !negated(i + 1 + related)) tier2 = true;
      }
      if (BODY_REGIONS.has(t)) body = true;
      if (SYSTEMIC.has(t) && !negated(i)) { systemic = true; matched.push(t); }
      if (t === 'chest' && i + 1 < tokens.length && CHEST_SECOND.has(tokens[i + 1]) &&
          !negated(i) && !negated(i + 1)) {
        systemic = true; matched.push(`chest ${tokens[i + 1]}`);
      }
    }
    if (tier2 && (tier1 || body)) matched.push('tier2+context');
    pain ||= tier1 || (tier2 && (tier1 || body));
  }
  return { pain, systemic, matched };
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

  // Confident curated body-state match wins (halts included)...
  if (sem.confident && sem.entry !== null && CURATED_BODY_CATEGORIES.has(sem.entry.category)) {
    // ...unless the text also holds systemic language and the match does not
    // halt. Systemic language is a halt, not a floor: a curated entry that
    // only restricts must not carry the report past it. A curated entry that
    // already halts is returned as it is, with its own wording. A pain word
    // is NOT given this precedence: the pain floor still yields to a
    // confident curated match, exactly as before.
    if (flags.systemic && !sem.entry.guardrail.halt) {
      return {
        entry: RED_FLAG_SYSTEMIC,
        similarity: semantic?.similarity ?? null,
        confident: true,
        overrideApplied: true,
      };
    }
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
