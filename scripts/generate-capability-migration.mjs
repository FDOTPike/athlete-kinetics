/**
 * generate-capability-migration.mjs — P19 capability content migration generator.
 * Converts ratified capability JSON staging input into additive SQL migrations.
 *
 * Staging Input Schema (JSON object):
 * {
 *   "roles": [
 *     { "movementName": string, "role": "major" | "supplementary" | "conditional" }
 *   ],
 *   "families": [
 *     { "movementName": string, "family": string, "isAnchor"?: boolean }
 *   ],
 *   "edges": [
 *     {
 *       "prerequisiteMovementName": string,
 *       "movementName": string,
 *       "relationship": "prerequisite" | "regression" | "variation",
 *       "minSessions"?: number,
 *       "minSetsPerSession"?: number,
 *       "minValue"?: number,
 *       "valueKind"?: "reps" | "time",
 *       "maxRpe"?: number | null,
 *       "requiresAttestation"?: boolean
 *     }
 *   ]
 * }
 *
 * Validation Invariants:
 * 1. Movement names must resolve against known seeded movements.
 * 2. No self-edges (prerequisiteMovementName !== movementName).
 * 3. No duplicate edges for the same (prerequisite, target) pair.
 * 4. Value constraints:
 *    - role in ('major', 'supplementary', 'conditional')
 *    - family length between 1 and 80
 *    - relationship in ('prerequisite', 'regression', 'variation')
 *    - minSessions in 1..100
 *    - minSetsPerSession in 1..20
 *    - minValue in 1..7200
 *    - valueKind in ('reps', 'time')
 *    - maxRpe null or 5.0..10.0
 * 5. Chain compatibility:
 *    - Same-family prerequisite edges must form acyclic, unbranched chains.
 *
 * Codegen Invariants:
 * 1. Additive & idempotent (INSERT OR IGNORE).
 * 2. Emits row-count assertions scoped to the rows THIS migration seeds.
 *    SQLite restricts RAISE() to trigger bodies, so the abort is forced via
 *    json('ASSERTION_FAILED_<table>'): evaluating json() on a non-JSON literal
 *    raises 'malformed JSON' and aborts the apply. The diagnostic name is NOT
 *    surfaced in SQLite's error text -- grep the migration to identify which.
 * 3. Embeds _chain_projection.sql.tpl at the tail of the migration.
 *
 * Usage:
 *   node scripts/generate-capability-migration.mjs --staging=<path> [--outDir=<dir>] [--write]
 *   node scripts/generate-capability-migration.mjs --check
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = join(import.meta.dirname, '..');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');
const PROJECTION_TPL = join(SCHEMA_DIR, '_chain_projection.sql.tpl');

export const VALID_ROLES = new Set(['major', 'supplementary', 'conditional']);
export const VALID_RELATIONSHIPS = new Set(['prerequisite', 'regression', 'variation']);
export const VALID_VALUE_KINDS = new Set(['reps', 'time']);

const q = (str) => `'${String(str).replace(/'/g, "''")}'`;

/**
 * Load all schema migrations (001..031) into an in-memory SQLite DB
 * to get the authoritative set of seeded movements and their logging modes.
 */
export function buildSchemaContext(customSchemaDir = SCHEMA_DIR) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  // Polyfill functions if needed by 026/029
  try {
    db.prepare('SELECT ln(2.0), sqrt(2.0)').get();
  } catch {
    db.function('ln', { deterministic: true }, (x) => (x !== null && x > 0 ? Math.log(x) : null));
    db.function('sqrt', { deterministic: true }, (x) => (x !== null && x >= 0 ? Math.sqrt(x) : null));
  }

  const files = readdirSync(customSchemaDir)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('_') && !f.endsWith('_capability_content.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(customSchemaDir, file), 'utf-8');
    db.exec(sql);
  }

  const movementRows = db.prepare('SELECT movement_id, name FROM movement').all();
  const movementMap = new Map();
  for (const m of movementRows) {
    movementMap.set(m.name, m.movement_id);
    movementMap.set(m.name.toLowerCase(), m.movement_id);
  }

  const timeLoggingMovements = new Set(
    db.prepare("SELECT movement_id FROM movement_logging_mode WHERE mode = 'time'").all().map((r) => r.movement_id)
  );

  const existingFamilies = db.prepare('SELECT movement_id, family FROM movement_capability_family').all();
  const existingEdges = db.prepare('SELECT prerequisite_movement_id, movement_id, relationship FROM movement_capability_edge').all();

  return { db, movementMap, timeLoggingMovements, existingFamilies, existingEdges };
}

/**
 * Validate capability content JSON input against schema constraints and graph invariants.
 */
export function validateCapabilityContent(input, ctx) {
  const errors = [];
  if (!input || typeof input !== 'object') {
    return { errors: ['Capability input must be an object'], validData: null };
  }

  const roles = Array.isArray(input.roles) ? input.roles : [];
  const families = Array.isArray(input.families) ? input.families : [];
  const edges = Array.isArray(input.edges) ? input.edges : [];

  const validatedRoles = [];
  for (const [idx, r] of roles.entries()) {
    if (!r.movementName || typeof r.movementName !== 'string') {
      errors.push(`roles[${idx}]: missing or invalid movementName`);
      continue;
    }
    if (!ctx.movementMap.has(r.movementName)) {
      errors.push(`roles[${idx}]: unknown movement "${r.movementName}"`);
      continue;
    }
    if (!VALID_ROLES.has(r.role)) {
      errors.push(`roles[${idx}]: invalid role "${r.role}" (must be major, supplementary, or conditional)`);
      continue;
    }
    validatedRoles.push({
      movementName: r.movementName,
      role: r.role,
    });
  }

  const validatedFamilies = [];
  for (const [idx, f] of families.entries()) {
    if (!f.movementName || typeof f.movementName !== 'string') {
      errors.push(`families[${idx}]: missing or invalid movementName`);
      continue;
    }
    if (!ctx.movementMap.has(f.movementName)) {
      errors.push(`families[${idx}]: unknown movement "${f.movementName}"`);
      continue;
    }
    if (!f.family || typeof f.family !== 'string' || f.family.trim().length < 1 || f.family.trim().length > 80) {
      errors.push(`families[${idx}]: family must be a string between 1 and 80 characters`);
      continue;
    }
    validatedFamilies.push({
      movementName: f.movementName,
      family: f.family.trim(),
      isAnchor: f.isAnchor === true ? 1 : 0,
    });
  }

  const validatedEdges = [];
  const edgeSet = new Set();

  for (const [idx, e] of edges.entries()) {
    if (!e.prerequisiteMovementName || typeof e.prerequisiteMovementName !== 'string') {
      errors.push(`edges[${idx}]: missing prerequisiteMovementName`);
      continue;
    }
    if (!e.movementName || typeof e.movementName !== 'string') {
      errors.push(`edges[${idx}]: missing movementName`);
      continue;
    }
    if (!ctx.movementMap.has(e.prerequisiteMovementName)) {
      errors.push(`edges[${idx}]: unknown prerequisite movement "${e.prerequisiteMovementName}"`);
      continue;
    }
    if (!ctx.movementMap.has(e.movementName)) {
      errors.push(`edges[${idx}]: unknown target movement "${e.movementName}"`);
      continue;
    }
    if (e.prerequisiteMovementName === e.movementName) {
      errors.push(`edges[${idx}]: self-edge detected for movement "${e.movementName}"`);
      continue;
    }

    const pairKey = `${e.prerequisiteMovementName} -> ${e.movementName}`;
    if (edgeSet.has(pairKey)) {
      errors.push(`edges[${idx}]: duplicate edge "${pairKey}"`);
      continue;
    }
    edgeSet.add(pairKey);

    const rel = e.relationship || 'prerequisite';
    if (!VALID_RELATIONSHIPS.has(rel)) {
      errors.push(`edges[${idx}]: invalid relationship "${rel}"`);
      continue;
    }

    const minSessions = e.minSessions !== undefined ? Number(e.minSessions) : 1;
    if (!Number.isInteger(minSessions) || minSessions < 1 || minSessions > 100) {
      errors.push(`edges[${idx}]: minSessions must be an integer between 1 and 100 (got ${e.minSessions})`);
    }

    const minSetsPerSession = e.minSetsPerSession !== undefined ? Number(e.minSetsPerSession) : 3;
    if (!Number.isInteger(minSetsPerSession) || minSetsPerSession < 1 || minSetsPerSession > 20) {
      errors.push(`edges[${idx}]: minSetsPerSession must be an integer between 1 and 20 (got ${e.minSetsPerSession})`);
    }

    const minValue = e.minValue !== undefined ? Number(e.minValue) : 8;
    if (!Number.isInteger(minValue) || minValue < 1 || minValue > 7200) {
      errors.push(`edges[${idx}]: minValue must be an integer between 1 and 7200 (got ${e.minValue})`);
    }

    const prereqId = ctx.movementMap.get(e.prerequisiteMovementName);
    const defaultKind = ctx.timeLoggingMovements.has(prereqId) ? 'time' : 'reps';
    const valueKind = e.valueKind || defaultKind;
    if (!VALID_VALUE_KINDS.has(valueKind)) {
      errors.push(`edges[${idx}]: invalid valueKind "${valueKind}"`);
    }

    let maxRpe = null;
    if (e.maxRpe !== undefined && e.maxRpe !== null) {
      maxRpe = Number(e.maxRpe);
      if (isNaN(maxRpe) || maxRpe < 5.0 || maxRpe > 10.0) {
        errors.push(`edges[${idx}]: maxRpe must be between 5.0 and 10.0 or null (got ${e.maxRpe})`);
      }
    }

    const requiresAttestation = e.requiresAttestation === true ? 1 : 0;

    validatedEdges.push({
      prerequisiteMovementName: e.prerequisiteMovementName,
      movementName: e.movementName,
      relationship: rel,
      minSessions,
      minSetsPerSession,
      minValue,
      valueKind,
      maxRpe,
      requiresAttestation,
    });
  }

  if (errors.length > 0) {
    return { errors, validData: null };
  }

  // Graph validation over same-family prerequisite edges
  const allFamiliesMap = new Map();
  for (const f of ctx.existingFamilies) {
    allFamiliesMap.set(f.movement_id, f.family);
  }
  for (const f of validatedFamilies) {
    const mId = ctx.movementMap.get(f.movementName);
    allFamiliesMap.set(mId, f.family);
  }

  const allPrereqEdges = [];
  for (const e of ctx.existingEdges) {
    if (e.relationship === 'prerequisite') {
      allPrereqEdges.push({ src: e.prerequisite_movement_id, dst: e.movement_id });
    }
  }
  for (const e of validatedEdges) {
    if (e.relationship === 'prerequisite') {
      const srcId = ctx.movementMap.get(e.prerequisiteMovementName);
      const dstId = ctx.movementMap.get(e.movementName);
      allPrereqEdges.push({ src: srcId, dst: dstId });
    }
  }

  // Group movements by family and validate acyclic unbranched chains
  const familyMovements = new Map();
  for (const [mId, fam] of allFamiliesMap.entries()) {
    if (!familyMovements.has(fam)) familyMovements.set(fam, new Set());
    familyMovements.get(fam).add(mId);
  }

  for (const [famName, mSet] of familyMovements.entries()) {
    const famEdges = allPrereqEdges.filter(
      (e) => allFamiliesMap.get(e.src) === famName && allFamiliesMap.get(e.dst) === famName
    );

    const inDeg = new Map();
    const outDeg = new Map();
    const nextNode = new Map();

    for (const mId of mSet) {
      inDeg.set(mId, 0);
      outDeg.set(mId, 0);
    }

    for (const e of famEdges) {
      const currentIn = inDeg.get(e.dst) ?? 0;
      if (currentIn >= 1) {
        errors.push(`Branching ambiguity in family "${famName}": movement ${e.dst} has multiple prerequisites`);
      }
      inDeg.set(e.dst, currentIn + 1);

      const currentOut = outDeg.get(e.src) ?? 0;
      if (currentOut >= 1) {
        errors.push(`Branching ambiguity in family "${famName}": movement ${e.src} has multiple dependents`);
      }
      outDeg.set(e.src, currentOut + 1);
      nextNode.set(e.src, e.dst);
    }

    const roots = Array.from(mSet).filter((mId) => (inDeg.get(mId) ?? 0) === 0);
    if (famEdges.length > 0 && roots.length > 1) {
      errors.push(`Branching ambiguity in family "${famName}": multiple root movements found`);
    }
    if (roots.length === 0) {
      errors.push(`Cycle detected in family "${famName}": no root movement found`);
    }

    const visited = new Set();
    for (const root of roots) {
      let curr = root;
      while (curr !== undefined) {
        if (visited.has(curr)) {
          errors.push(`Cycle detected in family "${famName}" at movement ${curr}`);
          break;
        }
        visited.add(curr);
        curr = nextNode.get(curr);
      }
    }

    if (visited.size !== mSet.size && errors.length === 0) {
      errors.push(`Disconnected components or cycle in family "${famName}"`);
    }
  }

  return {
    errors,
    validData: errors.length === 0 ? { roles: validatedRoles, families: validatedFamilies, edges: validatedEdges } : null,
  };
}

/**
 * Render additive SQL migration containing role eligibility, capability families,
 * capability edges, expected row-count assertions, and _chain_projection.sql.tpl.
 */
export function renderCapabilityMigration(migrationNumber, data, templateSql = '') {
  const lines = [];
  lines.push(`-- =============================================================================`);
  lines.push(`-- ${migrationNumber}_capability_content.sql`);
  lines.push(`-- Additive capability content migration (roles, families, prerequisite edges).`);
  lines.push(`-- Generated by scripts/generate-capability-migration.mjs.`);
  lines.push(`-- =============================================================================`);
  lines.push('');

  // 1. Movement Role Eligibility
  if (data.roles.length > 0) {
    lines.push('-- Movement Role Eligibility');
    for (const r of data.roles) {
      lines.push(
        `INSERT OR IGNORE INTO movement_role_eligibility (movement_id, role)\nSELECT movement_id, ${q(r.role)} FROM movement WHERE name = ${q(r.movementName)};`
      );
    }
    lines.push('');
  }

  // 2. Movement Capability Family
  if (data.families.length > 0) {
    lines.push('-- Movement Capability Family');
    for (const f of data.families) {
      lines.push(
        `INSERT OR IGNORE INTO movement_capability_family (movement_id, family, is_anchor)\nSELECT movement_id, ${q(f.family)}, ${f.isAnchor} FROM movement WHERE name = ${q(f.movementName)};`
      );
    }
    lines.push('');
  }

  // 3. Movement Capability Edge
  if (data.edges.length > 0) {
    lines.push('-- Movement Capability Edge');
    for (const e of data.edges) {
      const maxRpeVal = e.maxRpe === null ? 'NULL' : e.maxRpe.toFixed(1);
      lines.push(
        `INSERT OR IGNORE INTO movement_capability_edge (\n` +
        `  prerequisite_movement_id, movement_id, relationship,\n` +
        `  min_sessions, min_sets_per_session, min_value, value_kind, max_rpe, requires_attestation\n` +
        `)\n` +
        `SELECT p.movement_id, m.movement_id, ${q(e.relationship)}, ${e.minSessions}, ${e.minSetsPerSession}, ${e.minValue}, ${q(e.valueKind)}, ${maxRpeVal}, ${e.requiresAttestation}\n` +
        `FROM movement p, movement m\n` +
        `WHERE p.name = ${q(e.prerequisiteMovementName)} AND m.name = ${q(e.movementName)};`
      );
    }
    lines.push('');
  }

  // 4. Expected Row-Count Assertions
  lines.push('-- Expected Row-Count Assertions');
  if (data.roles.length > 0) {
    const names = data.roles.map((r) => q(r.movementName)).join(', ');
    lines.push(
      `SELECT CASE\n` +
      `  WHEN (SELECT COUNT(*) FROM movement_role_eligibility re JOIN movement m ON m.movement_id = re.movement_id WHERE m.name IN (${names})) < ${data.roles.length}\n` +
      `  THEN json('ASSERTION_FAILED_movement_role_eligibility_row_count_mismatch')\n` +
      `END;`
    );
  }
  if (data.families.length > 0) {
    const names = data.families.map((f) => q(f.movementName)).join(', ');
    lines.push(
      `SELECT CASE\n` +
      `  WHEN (SELECT COUNT(*) FROM movement_capability_family cf JOIN movement m ON m.movement_id = cf.movement_id WHERE m.name IN (${names})) < ${data.families.length}\n` +
      `  THEN json('ASSERTION_FAILED_movement_capability_family_row_count_mismatch')\n` +
      `END;`
    );
  }
  if (data.edges.length > 0) {
    // Count ONLY the pairs this migration seeds. A bare COUNT(*) over the table
    // includes rows from earlier migrations, so a PARTIAL silent drop (some
    // names stale, some not) still satisfies the threshold and passes -- which
    // is precisely the failure this guard exists to catch.
    const pairs = data.edges
      .map((e) => `(${q(e.prerequisiteMovementName)}, ${q(e.movementName)})`)
      .join(', ');
    lines.push(
      `SELECT CASE\n` +
      `  WHEN (SELECT COUNT(*) FROM movement_capability_edge ce\n` +
      `          JOIN movement pm ON pm.movement_id = ce.prerequisite_movement_id\n` +
      `          JOIN movement tm ON tm.movement_id = ce.movement_id\n` +
      `         WHERE (pm.name, tm.name) IN (VALUES ${pairs})) < ${data.edges.length}\n` +
      `  THEN json('ASSERTION_FAILED_movement_capability_edge_row_count_mismatch')\n` +
      `END;`
    );
  }
  lines.push('');

  // 5. Embedded Chain Projection Template
  if (templateSql) {
    lines.push('-- Embedded Chain Projection Template');
    lines.push(templateSql.trim());
    lines.push('');
  }

  return lines.join('\n');
}

export function getNextFreeSlot(schemaDir = SCHEMA_DIR) {
  const files = readdirSync(schemaDir)
    .filter((f) => f.endsWith('.sql') && !f.startsWith('_'));
  const slots = files
    .map((f) => parseInt(f.slice(0, 3), 10))
    .filter((n) => Number.isFinite(n));
  const maxSlot = slots.length > 0 ? Math.max(...slots) : 0;
  return String(maxSlot + 1).padStart(3, '0');
}

export function main() {
  const checkOnly = process.argv.includes('--check');
  const isWrite = process.argv.includes('--write');

  let stagingPath = null;
  const stagingEqualArg = process.argv.find((a) => a.startsWith('--staging='));
  if (stagingEqualArg) {
    stagingPath = stagingEqualArg.slice('--staging='.length);
  } else {
    const idx = process.argv.indexOf('--staging');
    if (idx !== -1 && idx + 1 < process.argv.length) {
      stagingPath = process.argv[idx + 1];
    }
  }

  if (!stagingPath) {
    stagingPath = join(ROOT, 'packages', 'core-db', 'staging', 'capability_content.json');
  }

  let outDir = null;
  const outDirEqualArg = process.argv.find((a) => a.startsWith('--outDir='));
  if (outDirEqualArg) {
    outDir = outDirEqualArg.slice('--outDir='.length);
  } else {
    const idx = process.argv.indexOf('--outDir');
    if (idx !== -1 && idx + 1 < process.argv.length) {
      outDir = process.argv[idx + 1];
    }
  }

  if (!outDir) {
    outDir = SCHEMA_DIR;
  }

  if (!existsSync(stagingPath)) {
    console.error(`ABORT: Staging file not found at ${stagingPath}`);
    process.exit(1);
  }

  let input;
  try {
    input = JSON.parse(readFileSync(stagingPath, 'utf-8'));
  } catch (err) {
    console.error(`ABORT: Failed to parse JSON from ${stagingPath}:\n  ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const ctx = buildSchemaContext();
  const { errors, validData } = validateCapabilityContent(input, ctx);

  if (errors.length > 0) {
    console.error(`ABORT: Validation failed with ${errors.length} error(s):\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }

  const nextSlot = getNextFreeSlot(SCHEMA_DIR);
  const targetFileName = `${nextSlot}_capability_content.sql`;
  const schemaTargetPath = join(SCHEMA_DIR, targetFileName);

  if (checkOnly) {
    let templateSql = '';
    if (existsSync(PROJECTION_TPL)) {
      templateSql = readFileSync(PROJECTION_TPL, 'utf-8');
    }

    const schemaFiles = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('_capability_content.sql'));
    for (const file of schemaFiles) {
      const slotMatch = file.match(/^(\d{3})_capability_content\.sql$/);
      if (slotMatch) {
        const slot = slotMatch[1];
        const rendered = renderCapabilityMigration(slot, validData, templateSql);
        const existingContent = readFileSync(join(SCHEMA_DIR, file), 'utf-8');
        if (existingContent.trim() === rendered.trim()) {
          console.log(`CHECK PASS: staging content in ${stagingPath} is valid and already landed in migration ${file}.`);
          process.exit(0);
        }
      }
    }

    if (!existsSync(schemaTargetPath)) {
      console.error(`ABORT: capability content in ${stagingPath} is valid, but migration ${targetFileName} is not emitted in schema directory; run with --write to generate it.`);
      process.exit(1);
    }
    console.log(`CHECK PASS: staging content in ${stagingPath} is valid and migration ${targetFileName} exists.`);
    process.exit(0);
  }

  if (isWrite) {
    let templateSql = '';
    if (existsSync(PROJECTION_TPL)) {
      templateSql = readFileSync(PROJECTION_TPL, 'utf-8');
    }
    const renderedSql = renderCapabilityMigration(nextSlot, validData, templateSql);

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    const outputPath = join(outDir, targetFileName);
    writeFileSync(outputPath, renderedSql, 'utf-8');

    const majorCount = validData.roles.filter((r) => r.role === 'major').length;
    const suppCount = validData.roles.filter((r) => r.role === 'supplementary').length;
    const condCount = validData.roles.filter((r) => r.role === 'conditional').length;

    console.log(`wrote ${outputPath}: ${validData.roles.length} roles (major: ${majorCount}, supp: ${suppCount}, cond: ${condCount}), ${validData.families.length} families, ${validData.edges.length} edges`);
    console.log(`Target slot ${nextSlot}. NEXT: Register ${targetFileName} in packages/core-db/src/migrations.ts and extend the migration/library gates.`);
    process.exit(0);
  }

  const majorCount = validData.roles.filter((r) => r.role === 'major').length;
  const suppCount = validData.roles.filter((r) => r.role === 'supplementary').length;
  const condCount = validData.roles.filter((r) => r.role === 'conditional').length;

  console.log(`VALIDATION SUCCESS: ${stagingPath}`);
  console.log(`  roles: ${validData.roles.length} (major: ${majorCount}, supplementary: ${suppCount}, conditional: ${condCount})`);
  console.log(`  families: ${validData.families.length}`);
  console.log(`  edges: ${validData.edges.length}`);
  console.log(`  target slot: ${nextSlot} (${targetFileName})`);
  console.log('Summary: 0 errors. (Run with --write to emit migration)');
  process.exit(0);
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
