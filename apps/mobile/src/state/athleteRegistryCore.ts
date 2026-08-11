/**
 * athleteRegistryCore.ts — pure logic for Coach Mode's athlete registry.
 *
 * Phase 15: one SQLite FILE per athlete (true isolation — sessions, telemetry,
 * blocks, and profile never bleed between people). This module is the pure,
 * dependency-free core: registry parsing, mutation, and invariants. The IO
 * shell (document-dir JSON read/write via react-native-blob-util) lives in
 * athleteRegistry.ts; keeping the core import-free lets verify:coach compile
 * and execute it directly under Node (the demoData extraction precedent).
 *
 * INVARIANTS (machine-checked in apps/mobile/test/verify_coach.mjs):
 *   I1. The 'default' athlete always exists and maps to LEGACY_DB_NAME — an
 *       existing install's data keeps its file, forever.
 *   I2. activeId always points at an existing athlete (parse repairs it).
 *   I3. Generated db names match /^ak_athlete_[a-z0-9]+\.db$/ and can never
 *       collide with LEGACY_DB_NAME or each other.
 *   I4. The active athlete and the 'default' athlete cannot be removed, and
 *       the registry never becomes empty.
 *   I5. parseRegistry is TOTAL: any input (garbage, wrong version, hand-edited
 *       JSON) yields a valid registry — a corrupt file must never brick boot.
 */

export const REGISTRY_FILE = 'coach_athletes.json';
/** Mirrors DB_NAME in packages/core-db/src/pragmas.ts (cross-checked by
 *  verify:coach against the pragmas source — no import, no RN dependency). */
export const LEGACY_DB_NAME = 'athlete_kinetics.db';
export const DEFAULT_ATHLETE_ID = 'default';
const MAX_NAME_LEN = 24;

export interface AthleteEntry {
  id: string;
  name: string;
  dbName: string;
  createdAtMs: number;
}

export interface AthleteRegistry {
  version: 1;
  activeId: string;
  athletes: AthleteEntry[];
  /** Device-wide advanced coaching/debug surfaces. This is discoverability,
   *  not authentication; athlete databases remain independently isolated. */
  advancedToolsUnlocked: boolean;
}

export function defaultRegistry(): AthleteRegistry {
  return {
    version: 1,
    activeId: DEFAULT_ATHLETE_ID,
    advancedToolsUnlocked: false,
    athletes: [
      { id: DEFAULT_ATHLETE_ID, name: 'Athlete 1', dbName: LEGACY_DB_NAME, createdAtMs: 0 },
    ],
  };
}

const ID_RE = /^[a-z0-9]+$/;
const DB_RE = /^ak_athlete_[a-z0-9]+\.db$/;

/** Clean a display name: trim, collapse whitespace, cap length, never empty. */
export function sanitizeName(raw: string, fallback: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN).trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/** TOTAL parse (I5): returns a valid registry for ANY input string. Unknown
 *  fields are dropped; invalid entries are skipped; the default athlete is
 *  re-inserted if missing (I1); a dangling activeId is repaired (I2). */
export function parseRegistry(json: string): AthleteRegistry {
  let entries: AthleteEntry[] = [];
  let activeId = DEFAULT_ATHLETE_ID;
  let advancedToolsUnlocked = false;
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    if (Array.isArray(o.athletes)) {
      const seenIds = new Set<string>();
      const seenDbs = new Set<string>();
      for (const raw of o.athletes as unknown[]) {
        if (typeof raw !== 'object' || raw === null) continue;
        const e = raw as Record<string, unknown>;
        const id = typeof e.id === 'string' ? e.id : '';
        const dbName = typeof e.dbName === 'string' ? e.dbName : '';
        const validShape =
          id === DEFAULT_ATHLETE_ID
            ? dbName === LEGACY_DB_NAME
            : ID_RE.test(id) && DB_RE.test(dbName) && dbName === `ak_athlete_${id}.db`;
        if (!validShape || seenIds.has(id) || seenDbs.has(dbName)) continue;
        seenIds.add(id);
        seenDbs.add(dbName);
        entries.push({
          id,
          name: sanitizeName(typeof e.name === 'string' ? e.name : '', `Athlete ${entries.length + 1}`),
          dbName,
          createdAtMs:
            typeof e.createdAtMs === 'number' && Number.isFinite(e.createdAtMs) && e.createdAtMs >= 0
              ? Math.floor(e.createdAtMs)
              : 0,
        });
      }
    }
    if (typeof o.activeId === 'string') activeId = o.activeId;
    advancedToolsUnlocked = o.advancedToolsUnlocked === true;
  } catch {
    entries = [];
  }
  if (!entries.some((e) => e.id === DEFAULT_ATHLETE_ID)) {
    entries.unshift(...defaultRegistry().athletes);
  }
  if (!entries.some((e) => e.id === activeId)) activeId = DEFAULT_ATHLETE_ID;
  return { version: 1, activeId, athletes: entries, advancedToolsUnlocked };
}

export function serializeRegistry(reg: AthleteRegistry): string {
  return JSON.stringify(reg);
}

/** Derive a new unique athlete id from a timestamp; a counter suffix resolves
 *  same-millisecond collisions deterministically (I3). */
export function addAthlete(
  reg: AthleteRegistry,
  rawName: string,
  nowMs: number,
): { reg: AthleteRegistry; entry: AthleteEntry } {
  const base = `a${Math.max(0, Math.floor(nowMs)).toString(36)}`;
  let id = base;
  let n = 2;
  const ids = new Set(reg.athletes.map((e) => e.id));
  while (ids.has(id)) id = `${base}${n++}`;
  // Dedupe display names: "Alex", "Alex (2)", "Alex (3)" ...
  const wanted = sanitizeName(rawName, `Athlete ${reg.athletes.length + 1}`);
  const names = new Set(reg.athletes.map((e) => e.name));
  let name = wanted;
  let k = 2;
  while (names.has(name)) name = `${wanted} (${k++})`.slice(0, MAX_NAME_LEN + 4);
  const entry: AthleteEntry = {
    id,
    name,
    dbName: `ak_athlete_${id}.db`,
    createdAtMs: Math.max(0, Math.floor(nowMs)),
  };
  return { reg: { ...reg, athletes: [...reg.athletes, entry] }, entry };
}

export function renameAthlete(reg: AthleteRegistry, id: string, rawName: string): AthleteRegistry {
  const target = reg.athletes.find((e) => e.id === id);
  if (target === undefined) return reg;
  const name = sanitizeName(rawName, target.name);
  return {
    ...reg,
    athletes: reg.athletes.map((e) => (e.id === id ? { ...e, name } : e)),
  };
}

/** Remove an athlete (I4): never the active one, never 'default', never the
 *  last entry. Returns the entry so the caller can delete its DB file. */
export function removeAthlete(
  reg: AthleteRegistry,
  id: string,
): { reg: AthleteRegistry; removed: AthleteEntry | null } {
  if (id === reg.activeId || id === DEFAULT_ATHLETE_ID || reg.athletes.length <= 1) {
    return { reg, removed: null };
  }
  const removed = reg.athletes.find((e) => e.id === id) ?? null;
  if (removed === null) return { reg, removed: null };
  return { reg: { ...reg, athletes: reg.athletes.filter((e) => e.id !== id) }, removed };
}

/** Point activeId at an existing athlete; unknown ids are a no-op (I2). */
export function setActiveAthlete(reg: AthleteRegistry, id: string): AthleteRegistry {
  if (!reg.athletes.some((e) => e.id === id)) return reg;
  return { ...reg, activeId: id };
}

/** Persist the hidden-surface preference without changing the active athlete. */
export function setAdvancedToolsUnlocked(
  reg: AthleteRegistry,
  unlocked: boolean,
): AthleteRegistry {
  return { ...reg, advancedToolsUnlocked: unlocked };
}

export function activeEntry(reg: AthleteRegistry): AthleteEntry {
  return reg.athletes.find((e) => e.id === reg.activeId) ?? reg.athletes[0];
}
