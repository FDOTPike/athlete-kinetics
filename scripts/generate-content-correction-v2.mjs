/**
 * generate-content-correction-v2.mjs — movement content correction v2
 * (coaching work order 4): replaces the shared "Set up <name> with ..."
 * coaching template with concrete setup / action / controlled-return text
 * for the movements whose identity is established by their upstream source.
 *
 * Source of truth: packages/core-db/staging/movement_content_correction_v2.json
 * Evidence:        packages/core-db/staging/movement_upstream_instructions.json
 * Output:          packages/core-db/src/schema/068_movement_content_correction_v2.sql
 *                  packages/core-db/staging/movement_content_correction_v2_manifest.json
 *
 * What this correction may touch, and nothing else: movement_detail
 * .instructions, movement_detail.cues and movement_coaching_intent
 * .coaching_intent. It writes NO name, id, alias, pattern, difficulty,
 * taxonomy, equipment, asset key, media status, fallback URL or preview.
 *
 * It refuses to build when a record:
 *   - is not one of the 176 staged v2 movements, or was already corrected by
 *     correction v1 (049);
 *   - is one of the two movements that belong to the animation lane
 *     (ids 135 and 187, by name);
 *   - supersedes anything other than the shared template;
 *   - has no matching upstream evidence text;
 *   - breaks the house content law (2-4 one-sentence steps, 1-3 distinct
 *     positive cues, an intent of 1-160 characters, no medical or outcome
 *     claim);
 *   - carries a hash that does not reproduce.
 *
 * Usage:
 *   node scripts/generate-content-correction-v2.mjs --write
 *   node scripts/generate-content-correction-v2.mjs --check
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
const STAGING_DIR = join(ROOT, 'packages', 'core-db', 'staging');
const OVERLAY = join(STAGING_DIR, 'movement_content_correction_v2.json');
const EVIDENCE = join(STAGING_DIR, 'movement_upstream_instructions.json');
const MANIFEST = join(STAGING_DIR, 'movement_content_correction_v2_manifest.json');
const MIGRATION = join(ROOT, 'packages', 'core-db', 'src', 'schema', '068_movement_content_correction_v2.sql');

export const CORRECTION_VERSION = 2;
/** Movement ids 135 and 187. They belong to the animation lane. */
export const ANIMATION_LANE_NAMES = ['Barbell Incline Shoulder Raise', 'Dumbbell Incline Shoulder Raise'];

const NEGATIVE_CUE = /\b(?:don't|do not|never|avoid|stop|no)\b/i;
const BANNED_CLAIM = /\b(cure|heal(?:s|ing)?|guarantee|injury[- ]proof|prevent(?:s|ing)? injur|bulletproof|pain[- ]free|insurance|pays out|burn(?:s)? fat|melt|shred your|doctor|medical|prescription|diagnos|therap)\b/i;
const MEDIA_SHAPED = /asset_?[Kk]ey|video_placeholder_uri|videoUrl|https?:\/\//;

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = (text) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
/** Same bytes as the Python gate's json.dumps(..., ensure_ascii=False, separators=(',', ':')). */
export const compactHash = (value) => sha256(JSON.stringify(value));
const terminal = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
/** Plain code-point order, so the Python gate's sorted() agrees byte for byte. */
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

function isSingleSentence(text) {
  const marks = [...text.matchAll(/[.!?]+/g)];
  return marks.length === 0 || (marks.length === 1 && marks[0].index + marks[0][0].length === text.length);
}

export const correctionHash = (record) => compactHash({
  name: record.name,
  correction_version: record.correction_version,
  supersedes_v2_sha256: record.supersedes_v2_sha256,
  changes: { coaching: {
    coaching_intent: record.changes.coaching.coaching_intent,
    setup_steps: record.changes.coaching.setup_steps,
    cues: record.changes.coaching.cues,
  } },
});

/** The fingerprint Phase 2a recorded for a staged v2 coaching row. */
export const stagedFingerprint = (entry) => compactHash({
  name: entry.name,
  coachingIntent: entry.coachingIntent,
  instructions: entry.setupSteps.map((step) => terminal(step.trim())).join(' '),
  cues: entry.cues.map((cue) => terminal(cue.trim())).join(' '),
});

/** True when the staged text is the shared template this correction replaces. */
export const isSharedTemplate = (entry) =>
  typeof entry.setupSteps?.[0] === 'string' && entry.setupSteps[0].startsWith(`Set up ${entry.name} with `);

/**
 * Validate an overlay without touching the filesystem.
 *   context.staged     Map(name -> staged v2 entry)
 *   context.v1Names    Set of names corrected by correction v1
 *   context.evidence   Map(name -> { instructions_raw, instructions_sha256 })
 */
export function validateCorrectionV2(overlay, context) {
  const errors = [];
  if (overlay?.correctionVersion !== CORRECTION_VERSION) errors.push('correctionVersion must be 2');
  if (overlay?.mediaExcluded !== true) errors.push('mediaExcluded must be true');
  if (!Number.isInteger(overlay?.build?.applied_at_ms) || overlay.build.applied_at_ms <= 0) errors.push('build.applied_at_ms must be a positive integer');
  const state = overlay?.ratification?.state;
  if (state !== 'pending_owner_review' && state !== 'owner_approved') errors.push('ratification.state must be pending_owner_review or owner_approved');
  if (!Array.isArray(overlay?.records) || overlay.records.length === 0) return { errors: [...errors, 'records must be a non-empty array'] };

  const seen = new Set();
  for (const [index, record] of overlay.records.entries()) {
    const at = `record ${index} (${record?.name ?? 'unnamed'})`;
    const name = record?.name;
    if (typeof name !== 'string' || name.length === 0) { errors.push(`${at}: needs a name`); continue; }
    if (seen.has(name)) { errors.push(`${at}: duplicate record`); continue; }
    seen.add(name);
    if (ANIMATION_LANE_NAMES.includes(name)) { errors.push(`${at}: belongs to the animation lane and must not be corrected here`); continue; }
    const staged = context.staged.get(name);
    if (staged === undefined) { errors.push(`${at}: not a staged v2 movement`); continue; }
    if (context.v1Names.has(name)) { errors.push(`${at}: already corrected by correction v1`); continue; }
    if (!isSharedTemplate(staged)) { errors.push(`${at}: the superseded text is not the shared template`); continue; }
    if (record.correction_version !== CORRECTION_VERSION) errors.push(`${at}: correction_version must be 2`);
    if (record.supersedes_v2_sha256 !== stagedFingerprint(staged)) errors.push(`${at}: supersedes_v2_sha256 is not the staged v2 fingerprint`);

    const changes = record.changes;
    if (changes === null || typeof changes !== 'object' || Object.keys(changes).join(',') !== 'coaching') {
      errors.push(`${at}: changes must contain the coaching domain only`);
      continue;
    }
    const { coaching_intent: intent, setup_steps: steps, cues } = changes.coaching;
    if (Object.keys(changes.coaching).join(',') !== 'coaching_intent,setup_steps,cues') {
      errors.push(`${at}: coaching must be exactly coaching_intent, setup_steps, cues, in that order`);
      continue;
    }
    if (typeof intent !== 'string' || intent.trim().length < 1 || intent.length > 160 || !isSingleSentence(intent)) {
      errors.push(`${at}: coaching_intent must be one sentence of 1..160 characters`);
    }
    if (!Array.isArray(steps) || steps.length < 2 || steps.length > 4
        || steps.some((step) => typeof step !== 'string' || step.trim().length === 0 || !isSingleSentence(step))) {
      errors.push(`${at}: setup_steps must be 2..4 one-sentence steps`);
      continue;
    }
    if (!Array.isArray(cues) || cues.length < 1 || cues.length > 3
        || cues.some((cue) => typeof cue !== 'string' || cue.trim().length === 0 || !isSingleSentence(cue))) {
      errors.push(`${at}: cues must be 1..3 one-sentence cues`);
      continue;
    }
    if (cues.some((cue) => NEGATIVE_CUE.test(cue))) errors.push(`${at}: cues must be positive-intention commands`);
    if (new Set(cues.map((cue) => cue.trim().toLowerCase())).size !== cues.length) errors.push(`${at}: cues must be distinct`);
    const body = [intent, ...steps, ...cues].join(' ');
    if (BANNED_CLAIM.test(body)) errors.push(`${at}: contains a prohibited medical or outcome claim`);
    if (MEDIA_SHAPED.test(JSON.stringify(changes))) errors.push(`${at}: a correction must not carry media`);
    if (steps[0].startsWith(`Set up ${name} with `)) errors.push(`${at}: the replacement is still the shared template`);

    const evidence = context.evidence.get(name);
    if (evidence === undefined) errors.push(`${at}: no upstream evidence text for this name`);
    else {
      if (sha256(evidence.instructions_raw) !== evidence.instructions_sha256) errors.push(`${at}: the evidence text does not match its own hash`);
      if (record.source_ref?.upstream_instructions_sha256 !== evidence.instructions_sha256) errors.push(`${at}: source_ref does not point at the evidence text`);
    }
    if (correctionHash(record) !== record.correction_sha256) errors.push(`${at}: correction_sha256 does not reproduce`);
    if (state === 'owner_approved'
        && (record.ratification?.correction_sha256 !== record.correction_sha256 || record.ratification?.approver_role !== 'owner')) {
      errors.push(`${at}: an approved set needs an owner approval bound to this record's hash`);
    }
    if (state === 'pending_owner_review' && record.ratification !== null) {
      errors.push(`${at}: a pending set must not carry a per-record approval`);
    }
  }
  return { errors };
}

export function renderMigration(overlay) {
  const records = [...overlay.records].sort(byName);
  const lines = [
    '-- =============================================================================',
    '-- 068_movement_content_correction_v2.sql',
    '-- Movement content correction v2 (generated, additive, idempotent).',
    '-- Source of truth: packages/core-db/staging/movement_content_correction_v2.json',
    '-- Evidence:        packages/core-db/staging/movement_upstream_instructions.json',
    '-- Regenerate with: node scripts/generate-content-correction-v2.mjs --write',
    '--',
    `-- Replaces the shared "Set up <name> with ..." coaching template on ${records.length} movements`,
    '-- with concrete setup, action and controlled-return text. Coaching text ONLY:',
    '-- no name, id, alias, pattern, difficulty, taxonomy, equipment, asset key, media',
    '-- status, fallback URL or preview is written. Movements 135 and 187 are not',
    '-- touched. Migrations 036-049 are not modified.',
    '--',
    `-- Ratification state when generated: ${overlay.ratification.state}.`,
    '--',
    '-- Provenance is appended to movement_content_correction (created by 049) at',
    '-- correction_version 2, beside any version 1 row: INSERT OR IGNORE, never an',
    '-- UPDATE, never a DELETE.',
    '-- =============================================================================',
    '',
  ];
  for (const [index, record] of records.entries()) {
    const { coaching_intent: intent, setup_steps: steps, cues } = record.changes.coaching;
    const where = `  WHERE movement_id = (SELECT movement_id FROM movement WHERE name = ${q(record.name)});`;
    lines.push(
      '-- ---------------------------------------------------------------------------',
      `-- ${String(index + 1).padStart(3, '0')} · ${record.name}`,
      `-- correction_sha256 ${record.correction_sha256}`,
      '-- ---------------------------------------------------------------------------',
      `UPDATE movement_detail SET instructions = ${q(steps.map((step) => terminal(step.trim())).join(' '))}, cues = ${q(cues.map((cue) => terminal(cue.trim())).join(' '))}`,
      where,
      `UPDATE movement_coaching_intent SET coaching_intent = ${q(intent.trim())}`,
      where,
      '',
    );
  }
  lines.push(
    '-- ---------------------------------------------------------------------------',
    '-- Provenance (immutable revision history, version 2)',
    '-- ---------------------------------------------------------------------------',
    'INSERT OR IGNORE INTO movement_content_correction',
    '  (movement_id, correction_version, correction_sha256, applied_at_ms) VALUES',
    records.map((record) =>
      `  ((SELECT movement_id FROM movement WHERE name = ${q(record.name)}), ${CORRECTION_VERSION}, ${q(record.correction_sha256)}, ${overlay.build.applied_at_ms})`).join(',\n') + ';',
    '',
  );
  return lines.join('\n');
}

export function renderManifest(overlay, evidenceDoc) {
  const records = [...overlay.records].sort(byName);
  return `${JSON.stringify({
    schemaVersion: 1,
    correctionVersion: CORRECTION_VERSION,
    mediaExcluded: true,
    fingerprintFields: ['name', 'correction_version', 'supersedes_v2_sha256', 'changes'],
    ratificationState: overlay.ratification.state,
    build: overlay.build,
    evidenceRecordsSetSha256: evidenceDoc.recordsSetSha256,
    recordsSetSha256: compactHash(records.map((record) => record.correction_sha256)),
    records: records.map((record) => ({
      name: record.name,
      correction_version: record.correction_version,
      supersedes_v2_sha256: record.supersedes_v2_sha256,
      correction_sha256: record.correction_sha256,
      upstream_instructions_sha256: record.source_ref.upstream_instructions_sha256,
      changed_domains: ['coaching'],
    })),
  }, null, 2)}\n`;
}

export function loadContext() {
  const staged = new Map(readJson(join(STAGING_DIR, 'movement_coaching_intent_v2.json')).movements.map((entry) => [entry.name, entry]));
  const v1Names = new Set(readJson(join(STAGING_DIR, 'movement_content_correction_v1.json')).records.map((record) => record.name));
  const evidenceDoc = readJson(EVIDENCE);
  const evidence = new Map(evidenceDoc.records.map((record) => [record.name, record]));
  return { staged, v1Names, evidence, evidenceDoc };
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') {
    console.error('usage: node scripts/generate-content-correction-v2.mjs --write | --check');
    process.exit(2);
  }
  const overlay = readJson(OVERLAY);
  const context = loadContext();
  const { errors } = validateCorrectionV2(overlay, context);
  const evidenceSet = compactHash(context.evidenceDoc.records.map((record) => [record.name, record.instructions_sha256]));
  if (evidenceSet !== context.evidenceDoc.recordsSetSha256) errors.push('the evidence file roll-up hash does not reproduce');
  if (errors.length > 0) {
    for (const error of errors) console.error(`  ERROR  ${error}`);
    console.error(`content correction v2: ${errors.length} error(s)`);
    process.exit(1);
  }
  const sql = renderMigration(overlay);
  const manifest = renderManifest(overlay, context.evidenceDoc);
  if (mode === '--write') {
    // A shipped migration is never edited (migrations.ts): devices that
    // applied 068 keep its bytes, so any later revision, including owner
    // approval, ships in a new migration slot.
    const rel = relative(ROOT, MIGRATION).replaceAll('\\', '/');
    let shipped = true;
    try { execFileSync('git', ['cat-file', '-e', `HEAD:${rel}`], { cwd: ROOT, stdio: 'ignore' }); } catch { shipped = false; }
    if (shipped) throw new Error(`Refusing to overwrite shipped migration: ${rel}`);
    writeFileSync(MIGRATION, sql);
    writeFileSync(MANIFEST, manifest);
    console.log(`content correction v2: wrote ${overlay.records.length} corrections (${overlay.ratification.state})`);
    return;
  }
  const stale = [];
  if (!existsSync(MIGRATION) || readFileSync(MIGRATION, 'utf8') !== sql) stale.push('068_movement_content_correction_v2.sql');
  if (!existsSync(MANIFEST) || readFileSync(MANIFEST, 'utf8') !== manifest) stale.push('movement_content_correction_v2_manifest.json');
  if (stale.length > 0) {
    console.error(`content correction v2: generated output is stale: ${stale.join(', ')}. Run --write.`);
    process.exit(1);
  }
  console.log(`content correction v2: ${overlay.records.length} corrections valid and generated output is current (${overlay.ratification.state})`);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
