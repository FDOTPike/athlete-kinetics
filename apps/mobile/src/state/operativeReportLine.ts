/**
 * One line naming today's operative report and the change it actually applied
 * (#186), for Today, READY, Plan and the workout. The figures are the applied
 * ones (after the severity gate and the experience scaling), never the matched
 * entry's cue. Display only.
 */
import { reportEffectParts, type ReportEffect } from './reportCopy';

const MAX_QUOTED = 60;

const quoted = (text: string): string => {
  const trimmed = text.trim();
  return trimmed.length <= MAX_QUOTED ? trimmed : `${trimmed.slice(0, MAX_QUOTED - 1).trimEnd()}…`;
};

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const joinParts = (parts: readonly string[]): string => (parts.length <= 1
  ? parts.join('')
  : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

/** "Load reduced by 46% and one set fewer today, because of your report: “sharp pain in my knee”." */
export function operativeReportLine(report: { text: string; effect: ReportEffect }): string {
  const parts = reportEffectParts(report.effect);
  if (parts.length === 0) return `Your report “${quoted(report.text)}” did not change today's plan.`;
  return `${capitalised(joinParts(parts))} today, because of your report: “${quoted(report.text)}”.`;
}
