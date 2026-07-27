export const HISTORY_FORMAT_VERSION = 'AK_HISTORY_V1' as const;

export interface HistoryMovementRef {
  readonly movementId: number;
  readonly name: string;
}
export interface ParsedHistorySet {
  readonly movementId: number;
  readonly movementName: string;
  readonly setIndex: number;
  readonly reps: number;
  readonly loadKg: number;
  readonly rpe: number | null;
  readonly seconds: number | null;
  readonly sourceLine: number;
}
export interface ParsedHistorySession {
  readonly sourceOrdinal: number;
  readonly sessionDate: string;
  readonly durationMin: number | null;
  readonly sessionRpe: number | null;
  readonly sourceLine: number;
  readonly sets: readonly ParsedHistorySet[];
}
export interface HistoryParseIssue {
  readonly line: number;
  readonly message: string;
}
export interface HistoryParseResult {
  readonly formatVersion: typeof HISTORY_FORMAT_VERSION | null;
  readonly sessions: readonly ParsedHistorySession[];
  readonly errors: readonly HistoryParseIssue[];
  readonly warnings: readonly HistoryParseIssue[];
  readonly unknownMovementNames: readonly string[];
}

const finite = (value: string): number | null => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const validIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const inRange = (value: number | null, min: number, max: number): value is number =>
  value !== null && value >= min && value <= max;

/**
 * Parse AK_HISTORY_V1 without mutating storage. The caller must show this result,
 * resolve every unknown movement, and receive explicit confirmation before a
 * transaction inserts the staged records.
 *
 * SESSION|YYYY-MM-DD|duration_minutes(optional)|session_rpe(optional)
 * SET|movement name|set index|reps|load kg|rpe(optional)|seconds(optional)
 * END_SESSION
 */
export function parseHistoryImport(
  text: string,
  movements: readonly HistoryMovementRef[],
): HistoryParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const errors: HistoryParseIssue[] = [];
  const warnings: HistoryParseIssue[] = [];
  const unknown = new Set<string>();
  const sessions: ParsedHistorySession[] = [];
  const movementByName = new Map<string, HistoryMovementRef>();
  for (const movement of movements) movementByName.set(movement.name.trim().toLocaleLowerCase(), movement);

  let formatVersion: typeof HISTORY_FORMAT_VERSION | null = null;
  let current: { sourceOrdinal: number; sessionDate: string; durationMin: number | null; sessionRpe: number | null; sourceLine: number; sets: ParsedHistorySet[]; keys: Set<string> } | null = null;
  const firstContent = lines.findIndex((line) => line.trim() !== '' && !line.trim().startsWith('#'));
  if (firstContent < 0 || lines[firstContent]!.trim() !== HISTORY_FORMAT_VERSION) {
    errors.push({ line: firstContent < 0 ? 1 : firstContent + 1, message: `First record must be ${HISTORY_FORMAT_VERSION}.` });
  } else {
    formatVersion = HISTORY_FORMAT_VERSION;
  }

  const finish = (line: number): void => {
    if (current === null) {
      errors.push({ line, message: 'END_SESSION has no open SESSION.' });
      return;
    }
    if (current.sets.length === 0) warnings.push({ line: current.sourceLine, message: 'Session contains no valid sets.' });
    sessions.push({
      sourceOrdinal: current.sourceOrdinal,
      sessionDate: current.sessionDate,
      durationMin: current.durationMin,
      sessionRpe: current.sessionRpe,
      sourceLine: current.sourceLine,
      sets: current.sets,
    });
    current = null;
  };

  for (let index = firstContent + 1; index < lines.length; index += 1) {
    const sourceLine = index + 1;
    const raw = lines[index]!.trim();
    if (raw === '' || raw.startsWith('#')) continue;
    const fields = raw.split('|').map((field) => field.trim());
    if (fields[0] === 'SESSION') {
      if (current !== null) {
        errors.push({ line: sourceLine, message: 'A new SESSION began before END_SESSION.' });
        finish(sourceLine - 1);
      }
      if (fields.length !== 4 || !validIsoDate(fields[1] ?? '')) {
        errors.push({ line: sourceLine, message: 'SESSION requires a real YYYY-MM-DD date plus optional duration and RPE fields.' });
        continue;
      }
      const duration = finite(fields[2]!);
      const sessionRpe = finite(fields[3]!);
      if (duration !== null && !inRange(duration, 0, 1440)) errors.push({ line: sourceLine, message: 'Session duration must be 0–1440 minutes.' });
      if (sessionRpe !== null && !inRange(sessionRpe, 0, 10)) errors.push({ line: sourceLine, message: 'Session RPE must be 0–10.' });
      current = {
        sourceOrdinal: sessions.length + 1,
        sessionDate: fields[1]!,
        durationMin: duration !== null && inRange(duration, 0, 1440) ? duration : null,
        sessionRpe: sessionRpe !== null && inRange(sessionRpe, 0, 10) ? sessionRpe : null,
        sourceLine,
        sets: [],
        keys: new Set(),
      };
      continue;
    }
    if (fields[0] === 'END_SESSION') {
      if (fields.length !== 1) errors.push({ line: sourceLine, message: 'END_SESSION takes no fields.' });
      finish(sourceLine);
      continue;
    }
    if (fields[0] !== 'SET') {
      errors.push({ line: sourceLine, message: `Unknown record type “${fields[0] ?? ''}”.` });
      continue;
    }
    if (current === null) {
      errors.push({ line: sourceLine, message: 'SET must appear inside a SESSION.' });
      continue;
    }
    if (fields.length !== 7) {
      errors.push({ line: sourceLine, message: 'SET requires movement, index, reps, load, optional RPE, and optional seconds.' });
      continue;
    }
    const movementName = fields[1]!;
    const movement = movementByName.get(movementName.toLocaleLowerCase());
    if (movement === undefined) {
      unknown.add(movementName);
      warnings.push({ line: sourceLine, message: `Unknown movement “${movementName}”; mapping is required.` });
      continue;
    }
    const setIndex = finite(fields[2]!);
    const reps = finite(fields[3]!);
    const loadKg = finite(fields[4]!);
    const rpe = finite(fields[5]!);
    const seconds = finite(fields[6]!);
    if (!Number.isInteger(setIndex) || !inRange(setIndex, 1, 1000) || !Number.isInteger(reps) || !inRange(reps, 0, 1000) || !inRange(loadKg, 0, 5000) || (rpe !== null && !inRange(rpe, 0, 10)) || (seconds !== null && (!Number.isInteger(seconds) || !inRange(seconds, 1, 7200)))) {
      errors.push({ line: sourceLine, message: 'SET numeric fields are outside their allowed ranges.' });
      continue;
    }
    const key = `${movement.movementId}:${setIndex}`;
    if (current.keys.has(key)) {
      errors.push({ line: sourceLine, message: `Duplicate set index ${setIndex} for ${movement.name}.` });
      continue;
    }
    current.keys.add(key);
    current.sets.push({ movementId: movement.movementId, movementName: movement.name, setIndex, reps, loadKg, rpe, seconds, sourceLine });
  }
  if (current !== null) {
    errors.push({ line: current.sourceLine, message: 'SESSION is missing END_SESSION.' });
    finish(lines.length);
  }
  if (sessions.length === 0) warnings.push({ line: 1, message: 'No sessions were parsed.' });
  return { formatVersion, sessions, errors, warnings, unknownMovementNames: [...unknown].sort((a, b) => a.localeCompare(b)) };
}

/** Stable 256-bit content fingerprint for local duplicate detection. This is
 * deliberately named a fingerprint rather than a cryptographic signature. */
export function historyContentFingerprint(text: string): string {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5];
  const hashes = seeds.map((seed) => seed >>> 0);
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    const bytes = code < 0x80 ? [code] : code < 0x800
      ? [0xc0 | (code >> 6), 0x80 | (code & 0x3f)]
      : [0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f)];
    for (const byte of bytes) {
      for (let lane = 0; lane < hashes.length; lane += 1) {
        hashes[lane] = Math.imul((hashes[lane]! ^ byte) >>> 0, 0x01000193 + lane * 2) >>> 0;
      }
    }
  }
  return hashes.map((hash) => hash.toString(16).padStart(8, '0')).join('');
}
export const HISTORY_IMPORT_EXAMPLE = `${HISTORY_FORMAT_VERSION}\nSESSION|2026-07-20|45|7.5\nSET|Pull-Up|1|5|0|7|\nSET|Pull-Up|2|5|0|7.5|\nEND_SESSION`;
export const HISTORY_IMPORT_AI_PROMPT = `Convert my training history to ${HISTORY_FORMAT_VERSION}. Use only SESSION, SET, and END_SESSION records exactly as shown in the app example. Preserve dates and units; do not invent missing values.`;