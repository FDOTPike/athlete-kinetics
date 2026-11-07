/**
 * sessionReportStop.ts — the day halt left by a Stop reached through
 * "Report discomfort" inside a workout (issues #179, #181, #187).
 *
 * A Plan report at halt level is stored in subjective_report with halt = 1,
 * and every halt check in the app reads that row through the derived
 * prescription. A Stop-level in-session report is stored the same way, so
 * every one of those checks sees it. Such a report is a region and a severity,
 * not text the phrase codebase matched, so its row has no matched entry
 * (matched_entry_id NULL, halt 1). This entry is what the derivation applies
 * for that row. It lives in the app, not in phrase-codebase.json: it is never
 * embedded and never routed, and the research lab's baseline is unchanged.
 *
 * See docs/decisions/IN_SESSION_STOP_DAY_HALT_2026-11-05.md.
 */
import type { PhraseEntry } from '@ak/inference';

/** What the athlete reads wherever the day halt is shown. */
export const SESSION_REPORT_STOP_SENTENCE = "You stopped today's session after a report.";

export const SESSION_REPORT_STOP_ENTRY: PhraseEntry = {
  id: 'in-session-report-stop',
  category: 'pain',
  text: 'Report discomfort: stop during a session',
  aliases: [],
  cue: `${SESSION_REPORT_STOP_SENTENCE} No more training today.`,
  guardrail: {
    load_multiplier: 0,
    set_delta: -3,
    rpe_cap_max: 0,
    halt: true,
    follow_up: null,
  },
};

/** True when today's operative halt is the one an in-session Stop report left. */
export const isSessionReportStop = (
  lastTriage: { kind: string; directive?: { halt: boolean; matchedCue: string } } | null | undefined,
): boolean => lastTriage?.kind === 'matched'
  && lastTriage.directive?.halt === true
  && lastTriage.directive.matchedCue === SESSION_REPORT_STOP_ENTRY.text;

/** Region keys are stored as typed ("lower_back"); the athlete reads "Lower back". */
export const regionLabel = (region: string): string => {
  const words = region.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The in-session severity chips: Mild 4, Moderate 6, Stop 8. */
export const reportSeverityLabel = (severity: number): string => {
  const named = severity === 4 ? 'Mild' : severity === 6 ? 'Moderate' : severity === 8 ? 'Stop' : null;
  return named === null ? `${severity} of 10` : `${named} (${severity} of 10)`;
};

/** The raw_text a Stop-level in-session report is stored with. */
export const sessionReportStopText = (region: string, severity: number): string =>
  `Report discomfort during a session: ${regionLabel(region)}, ${severity} of 10. Session stopped.`;
