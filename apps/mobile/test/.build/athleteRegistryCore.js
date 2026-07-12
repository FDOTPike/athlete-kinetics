"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ATHLETE_ID = exports.LEGACY_DB_NAME = exports.REGISTRY_FILE = void 0;
exports.defaultRegistry = defaultRegistry;
exports.sanitizeName = sanitizeName;
exports.parseRegistry = parseRegistry;
exports.serializeRegistry = serializeRegistry;
exports.addAthlete = addAthlete;
exports.renameAthlete = renameAthlete;
exports.removeAthlete = removeAthlete;
exports.setActiveAthlete = setActiveAthlete;
exports.activeEntry = activeEntry;
exports.REGISTRY_FILE = 'coach_athletes.json';
/** Mirrors DB_NAME in packages/core-db/src/pragmas.ts (cross-checked by
 *  verify:coach against the pragmas source — no import, no RN dependency). */
exports.LEGACY_DB_NAME = 'athlete_kinetics.db';
exports.DEFAULT_ATHLETE_ID = 'default';
const MAX_NAME_LEN = 24;
function defaultRegistry() {
    return {
        version: 1,
        activeId: exports.DEFAULT_ATHLETE_ID,
        athletes: [
            { id: exports.DEFAULT_ATHLETE_ID, name: 'Athlete 1', dbName: exports.LEGACY_DB_NAME, createdAtMs: 0 },
        ],
    };
}
const ID_RE = /^[a-z0-9]+$/;
const DB_RE = /^ak_athlete_[a-z0-9]+\.db$/;
/** Clean a display name: trim, collapse whitespace, cap length, never empty. */
function sanitizeName(raw, fallback) {
    const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN).trim();
    return cleaned.length > 0 ? cleaned : fallback;
}
/** TOTAL parse (I5): returns a valid registry for ANY input string. Unknown
 *  fields are dropped; invalid entries are skipped; the default athlete is
 *  re-inserted if missing (I1); a dangling activeId is repaired (I2). */
function parseRegistry(json) {
    let entries = [];
    let activeId = exports.DEFAULT_ATHLETE_ID;
    try {
        const o = JSON.parse(json);
        if (Array.isArray(o.athletes)) {
            const seenIds = new Set();
            const seenDbs = new Set();
            for (const raw of o.athletes) {
                if (typeof raw !== 'object' || raw === null)
                    continue;
                const e = raw;
                const id = typeof e.id === 'string' ? e.id : '';
                const dbName = typeof e.dbName === 'string' ? e.dbName : '';
                const validShape = id === exports.DEFAULT_ATHLETE_ID
                    ? dbName === exports.LEGACY_DB_NAME
                    : ID_RE.test(id) && DB_RE.test(dbName) && dbName === `ak_athlete_${id}.db`;
                if (!validShape || seenIds.has(id) || seenDbs.has(dbName))
                    continue;
                seenIds.add(id);
                seenDbs.add(dbName);
                entries.push({
                    id,
                    name: sanitizeName(typeof e.name === 'string' ? e.name : '', `Athlete ${entries.length + 1}`),
                    dbName,
                    createdAtMs: typeof e.createdAtMs === 'number' && Number.isFinite(e.createdAtMs) && e.createdAtMs >= 0
                        ? Math.floor(e.createdAtMs)
                        : 0,
                });
            }
        }
        if (typeof o.activeId === 'string')
            activeId = o.activeId;
    }
    catch {
        entries = [];
    }
    if (!entries.some((e) => e.id === exports.DEFAULT_ATHLETE_ID)) {
        entries.unshift(...defaultRegistry().athletes);
    }
    if (!entries.some((e) => e.id === activeId))
        activeId = exports.DEFAULT_ATHLETE_ID;
    return { version: 1, activeId, athletes: entries };
}
function serializeRegistry(reg) {
    return JSON.stringify(reg);
}
/** Derive a new unique athlete id from a timestamp; a counter suffix resolves
 *  same-millisecond collisions deterministically (I3). */
function addAthlete(reg, rawName, nowMs) {
    const base = `a${Math.max(0, Math.floor(nowMs)).toString(36)}`;
    let id = base;
    let n = 2;
    const ids = new Set(reg.athletes.map((e) => e.id));
    while (ids.has(id))
        id = `${base}${n++}`;
    // Dedupe display names: "Alex", "Alex (2)", "Alex (3)" ...
    const wanted = sanitizeName(rawName, `Athlete ${reg.athletes.length + 1}`);
    const names = new Set(reg.athletes.map((e) => e.name));
    let name = wanted;
    let k = 2;
    while (names.has(name))
        name = `${wanted} (${k++})`.slice(0, MAX_NAME_LEN + 4);
    const entry = {
        id,
        name,
        dbName: `ak_athlete_${id}.db`,
        createdAtMs: Math.max(0, Math.floor(nowMs)),
    };
    return { reg: { ...reg, athletes: [...reg.athletes, entry] }, entry };
}
function renameAthlete(reg, id, rawName) {
    const target = reg.athletes.find((e) => e.id === id);
    if (target === undefined)
        return reg;
    const name = sanitizeName(rawName, target.name);
    return {
        ...reg,
        athletes: reg.athletes.map((e) => (e.id === id ? { ...e, name } : e)),
    };
}
/** Remove an athlete (I4): never the active one, never 'default', never the
 *  last entry. Returns the entry so the caller can delete its DB file. */
function removeAthlete(reg, id) {
    if (id === reg.activeId || id === exports.DEFAULT_ATHLETE_ID || reg.athletes.length <= 1) {
        return { reg, removed: null };
    }
    const removed = reg.athletes.find((e) => e.id === id) ?? null;
    if (removed === null)
        return { reg, removed: null };
    return { reg: { ...reg, athletes: reg.athletes.filter((e) => e.id !== id) }, removed };
}
/** Point activeId at an existing athlete; unknown ids are a no-op (I2). */
function setActiveAthlete(reg, id) {
    if (!reg.athletes.some((e) => e.id === id))
        return reg;
    return { ...reg, activeId: id };
}
function activeEntry(reg) {
    return reg.athletes.find((e) => e.id === reg.activeId) ?? reg.athletes[0];
}
