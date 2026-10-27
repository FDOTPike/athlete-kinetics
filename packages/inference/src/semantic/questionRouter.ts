// Routing port: lab 65836a8bb03df9dc351d4d9fda6f6a7f07e3aeb2, ask/lib.mjs makeRouter (one card).
import { topK } from './cosine';
import { scanRedFlags } from './redFlag';
import { QUESTION_PHRASES, QUESTION_SETTINGS } from './questionPhrases';

export interface QuestionIndex {
  readonly matrix: Float32Array;
  readonly entryIds: readonly string[];
  readonly dim: number;
}
export interface QuestionResult {
  readonly outcome: string;
  readonly shown: readonly string[];
}
interface QuestionEntry {
  readonly id: string;
  readonly term: string;
  readonly aliases?: readonly string[];
  readonly definition: string;
}

export function questionPhraseRows(entries: readonly QuestionEntry[]): { entryId: string; phrase: string }[] {
  const rows: { entryId: string; phrase: string }[] = [];
  for (const entry of entries) {
    const seen = new Set<string>();
    for (const phrase of [entry.term, ...(entry.aliases ?? []), ...(QUESTION_PHRASES[entry.id] ?? []), ...(QUESTION_SETTINGS.matchDefinitions ? [entry.definition] : [])]) {
      const tidy = phrase.trim().replace(/\s+/g, ' ');
      const key = tidy.toLowerCase();
      if (key.length === 0 || seen.has(key)) continue;
      seen.add(key);
      rows.push({ entryId: entry.id, phrase: tidy });
    }
  }
  for (const phrase of QUESTION_PHRASES.refer ?? []) rows.push({ entryId: 'refer', phrase });
  return rows;
}

export function routeQuestion(text: string, query: Float32Array, index: QuestionIndex): QuestionResult {
  const scan = scanRedFlags(text);
  if (scan.pain || scan.systemic) return { outcome: 'refer', shown: [] };
  const matches = topK(index.matrix, index.entryIds.length, index.dim, query, index.entryIds.length);
  const best = new Map<string, number>();
  let referScore: number | null = null;
  for (const match of matches) {
    const id = index.entryIds[match.index];
    if (id === 'refer') { referScore ??= match.score; continue; }
    if (!best.has(id)) best.set(id, match.score);
  }
  const ranked = [...best].map(([id, score]) => ({ id, score }));
  const top = ranked[0];
  if (referScore !== null && referScore >= QUESTION_SETTINGS.referThreshold && (top === undefined || referScore >= top.score)) {
    return { outcome: 'refer', shown: [] };
  }
  if (top === undefined || top.score < QUESTION_SETTINGS.threshold) return { outcome: 'none', shown: [] };
  return { outcome: top.id, shown: [top.id] };
}
