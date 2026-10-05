/**
 * export_movement_library.mjs — dumps the full movement library to JSON for
 * design-time analysis (see PROMPT_1a_DeepMind_movement_analysis.md).
 *
 * Deterministic: replays the full production migration chain into an in-memory DB (the same
 * schema-replay the verify: gates use), then exports movement + movement_detail
 * + movement_progression + equipment + beginner flag. No device or seed-file
 * dependency; reproducible from source.
 *
 * Run:  node scripts/export_movement_library.mjs
 * Out:  movement_library_export.json  (repo root)
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');
const OUT = join(ROOT, 'movement_library_export.json');

// The production registry IS the replay order (user_version ordinals; see
// packages/core-db/MIGRATION_LINEAGE.md). A hand-copied list here went stale
// at 033 and exported the 124-row pre-v2 library instead of all 300 rows.
const REGISTRY = readFileSync(join(ROOT, 'packages', 'core-db', 'src', 'migrations.ts'), 'utf-8');
const IMPORTS = Object.fromEntries([...REGISTRY.matchAll(/import (m\d+) from '\.\/schema\/([^']+)'/g)].map((m) => [m[1], m[2]]));
const registryMatch = REGISTRY.match(/(?:^|\n)\s*(?:export\s+)?const\s+MIGRATIONS\b[^=]*=\s*\[([^\]]+)\]/s);
if (!registryMatch) throw new Error('migrations.ts: the MIGRATIONS registry declaration was not found');
const IDS = registryMatch[1].split(',').map((id) => id.trim()).filter(Boolean);
const unresolved = IDS.filter((id) => IMPORTS[id] === undefined);
// An incomplete parse must fail, never export a truncated library.
if (IDS.length === 0 || unresolved.length > 0 || IDS.length !== Object.keys(IMPORTS).length) {
  throw new Error(`migrations.ts registry parse is incomplete: ${IDS.length} ids, ${Object.keys(IMPORTS).length} imports, unresolved: ${unresolved.join(', ') || 'none'}`);
}
const FILES = IDS.map((id) => IMPORTS[id]);

const db = new DatabaseSync(':memory:');
// Some migrations reference ln/sqrt (present in op-sqlite at runtime); shim for node:sqlite.
try { db.prepare('SELECT ln(2.0), sqrt(2.0)').get(); } catch {
  db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
  db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
}

for (const f of FILES) {
  db.exec(readFileSync(join(SCHEMA_DIR, f), 'utf-8'));
}

const rows = db.prepare(`
  SELECT
    m.movement_id            AS movement_id,
    m.name                   AS name,
    m.pattern                AS pattern,
    m.is_compound            AS is_compound,
    d.base_name              AS base_name,
    d.supported_prefixes     AS supported_prefixes,
    d.difficulty_rating      AS difficulty_rating,
    d.target_muscles         AS target_muscles,
    d.instructions           AS instructions,
    d.cues                   AS cues,
    mp.progression_group     AS progression_group,
    mp.progression_rank      AS progression_rank,
    (SELECT json_group_array(me.item) FROM movement_equipment me
       WHERE me.movement_id = m.movement_id) AS equipment,
    (w.movement_id IS NOT NULL) AS beginner_ok
  FROM movement m
  LEFT JOIN movement_detail d              ON d.movement_id  = m.movement_id
  LEFT JOIN movement_progression mp        ON mp.movement_id = m.movement_id
  LEFT JOIN movement_beginner_whitelist w  ON w.movement_id  = m.movement_id
  ORDER BY m.movement_id
`).all();

const parse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };

const movements = rows.map((r) => ({
  movement_id: r.movement_id,
  name: r.name,
  pattern: r.pattern,
  is_compound: r.is_compound === 1,
  base_name: r.base_name ?? null,
  supported_prefixes: parse(r.supported_prefixes, []),
  difficulty_rating: r.difficulty_rating ?? null,
  target_muscles: parse(r.target_muscles, []),
  equipment: parse(r.equipment, []),
  beginner_ok: r.beginner_ok === 1,
  progression_group: r.progression_group ?? null,
  progression_rank: r.progression_rank ?? null,
  instructions: r.instructions ?? '',
  cues: r.cues ?? '',
}));

writeFileSync(OUT, JSON.stringify({
  exported_at: new Date().toISOString(),
  schema_through: FILES[FILES.length - 1],
  movement_count: movements.length,
  movements,
}, null, 2));

console.log(`Exported ${movements.length} movements -> ${OUT}`);
