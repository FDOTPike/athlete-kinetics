/**
 * meminfo_parser.mjs — pure parser for `adb shell dumpsys meminfo -d <package>`
 * output (WO remediation E2 / GEMINI-MEMINFO-PARSER).
 *
 * Defect class this fixes: the TOTAL table row must be parsed BY COLUMN
 * POSITION within the row itself, never overwritten later by the "TOTAL PSS:"
 * summary line, and every Android-reported kB value converts to bytes
 * explicitly via value * 1024 while the raw kB value is preserved.
 *
 * Reported separately: Pss Total, Private Dirty, Private Clean, SwapPss Dirty,
 * Rss Total. No other row may feed these numbers. The "TOTAL PSS:" summary is
 * parsed independently and labeled as informational only.
 */
import { readFileSync } from 'node:fs';

/** Canonical trailing-column layout of a `dumpsys meminfo -d` table row after
 *  the heap-name cell (Android 7..15 stable). From the right edge of the
 *  numeric block, before the per-heap size columns begin:
 *    ... | Pss Total | Private Dirty | Private Clean | SwapPss Dirty |
 *    Rss Total | Heap Size | Heap Alloc | Heap Free | Native Pres ...
 *  We anchor on the HEADER's canonical order instead of trusting any single
 *  device formatting quirk. */
const CANONICAL_METRICS = [
  'Pss Total',
  'Private Dirty',
  'Private Clean',
  'SwapPss Dirty',
  'Rss Total',
];

/** Parse the "TOTAL PSS:" SUMMARY line — informational only; never feeds the
 *  per-column metrics. The trailing unit is optional across Android versions.
 *  Returns kB and explicit bytes. */
export function parseSummaryLine(text) {
  const m = text.match(/^TOTAL PSS:\s*([\d.]+)(?:\s*kB)?/i);
  if (!m) return null;
  const totalPssKb = Number(m[1]);
  return { totalPssKb, totalPssBytes: totalPssKb * 1024 };
}

/**
 * Parse a full `dumpsys meminfo -d` capture.
 * Returns {
 *   samples: [{ metric, kB, bytes }],   // from the TABLE's TOTAL row only
 *   summary: { totalPssKb, totalPssBytes, totalRssKb } | null, // "TOTAL PSS:" line
 *   appName: string | null,
 *   totalRowFound: boolean
 * }
 */
export function parseMeminfoDump(text) {
  const lines = text.split(/\r?\n/);

  // dumpsys renders the table header across TWO physical lines:
  //   line 1: "                   Pss  Private  Private  SwapPss      Rss     Heap ..."
  //   line 2: "                Total    Dirty    Clean    Dirty    Total     Size ..."
  // Reassemble label pairs positionally, then map them onto the numeric
  // columns of the TOTAL row by ORDER (both header and rows are fixed-width,
  // right-aligned grids; heap-name cells occupy the same left gutter).
  const headerIdx = lines.findIndex((l) => /\bPss\b.*\bPrivate\b.*\bSwapPss\b/i.test(l));
  let samples = [];
  let totalRowFound = false;

  if (headerIdx !== -1) {
    const top = lines[headerIdx].trim().split(/\s+/);       // ["Pss","Private","Private","SwapPss","Rss","Heap",...]
    const bottom = (lines[headerIdx + 1] ?? '').trim().split(/\s+/);
    const columnLabels = [];
    for (let i = 0; i < top.length && i < bottom.length; i += 1) {
      columnLabels.push(`${top[i]} ${bottom[i]}`.toLowerCase());
    }
    // columnLabels is now e.g. ["pss total","private dirty","private clean",
    // "swappss dirty","rss total","heap size", ...] — one label per numeric column.

    // Find the TABLE's TOTAL row: the data line whose leading cell is exactly
    // "TOTAL" followed by numeric columns. The summary "TOTAL PSS:" line fails
    // that shape test and is parsed separately below.
    for (let li = headerIdx + 2; li < lines.length && li < headerIdx + 80; li += 1) {
      const trimmed = lines[li].trim();
      if (!/^TOTAL\b/.test(trimmed)) continue;
      if (/^TOTAL\s+PSS:/i.test(trimmed)) break; // reached summary zone
      const tokens = trimmed.split(/\s+/);
      if (!/^TOTAL$/.test(tokens[0])) continue;
      // Row layout: [TOTAL, ...numericColumns...] — numeric col k maps to tokens[k+1].
      samples = CANONICAL_METRICS.flatMap((metric) => {
        const colIdx = columnLabels.indexOf(metric.toLowerCase());
        if (colIdx === -1 || colIdx + 1 >= tokens.length) return [];
        const kb = Number(tokens[colIdx + 1]);
        if (!Number.isFinite(kb)) return [];
        return [{ metric, kB: kb, bytes: kb * 1024 }];
      });
      totalRowFound = samples.length > 0;
      break;
    }
  }

  // Summary line(s), parsed separately and clearly labeled informational.
  let summary = null;
  for (const line of lines) {
    const s = parseSummaryLine(line.trim());
    if (s) {
      const rssMatch = line.match(/TOTAL RSS:\s*([\d.]+)/i);
      summary = { ...s, totalRssKb: rssMatch ? Number(rssMatch[1]) : null };
      break;
    }
  }

  // App identity comes from the "** MEMINFO in pid NNN [package] **" line.
  const appMatch = text.match(/\*\*\s*MEMINFO in pid \d+ \[(\S+)\]\s*\*\*/);
  const appName = appMatch ? appMatch[1] : null;

  return { samples, summary, appName, totalRowFound };
}

/** Decisive metric in bytes, or null when the capture lacked it. */
export function privateDirtyBytes(parsed) {
  const s = parsed.samples.find((x) => x.metric === 'Private Dirty');
  return s ? s.bytes : null;
}
