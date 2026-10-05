/**
 * Phase 2a pre-release content-correction codegen (overlay v1).
 *
 * The v2 library (migrations 036-048) is FROZEN: `generate-library-v2.mjs`
 * re-renders it from the v2 staging files and throws `Generated artifact drift`
 * on any edit. Corrections therefore ship as a separate, fingerprinted OVERLAY
 * that is applied by migration 049 on top of the shipped rows — historical
 * v1/v2 manifests and migrations 036-048 are never modified.
 *
 *   --stamp   derive supersedes_v2_sha256 / correction_sha256 / assignment
 *             hashes and the owner approval records INTO the overlay source.
 *             Run once when the authored copy changes; the approval binds the
 *             hash, so any later copy or equipment edit invalidates it.
 *   --write   render the manifest and migration 049 (refuses to overwrite a
 *             migration already present at HEAD).
 *   --check   (default) render everything in memory and fail on drift.
 *
 * Media is prohibited at every level: no asset key, status, revision or URL is
 * read, written, or hashed here. Migration 049 writes no media of any kind.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGET_NAMES } from './library-target-v1.mjs';

const ROOT = join(import.meta.dirname, '..');
const STAGING_DIR = join(ROOT, 'packages', 'core-db', 'staging');
const SCHEMA_DIR = join(ROOT, 'packages', 'core-db', 'src', 'schema');
const CORRECTION_PATH = join(STAGING_DIR, 'movement_content_correction_v1.json');
const CORRECTION_MANIFEST_PATH = join(STAGING_DIR, 'movement_content_correction_v1_manifest.json');
const V2_CONTENT_PATH = join(STAGING_DIR, 'movement_coaching_intent_v2.json');
const V2_MANIFEST_PATH = join(STAGING_DIR, 'movement_coaching_intent_v2_manifest.json');
const LEGACY_MANIFEST_PATH = join(STAGING_DIR, 'movement_coaching_intent_manifest.json');
const MIGRATION_PATH = join(SCHEMA_DIR, '049_movement_content_correction_v1.sql');

export const MIGRATION_SLOT = '049';
export const PATHS = { CORRECTION_PATH, CORRECTION_MANIFEST_PATH, MIGRATION_PATH, SCHEMA_DIR };
/** Specialist items are NEVER granted by a preset, a default, or a fallback —
 *  explicit athlete opt-in only (owner decision O3). Mirrors
 *  SPECIALIST_EQUIPMENT_ITEMS in packages/inference/src/types.ts. */
export const SPECIALIST_EQUIPMENT_ITEMS = ['boards'];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const jsonText = (value, indent = 2) => `${JSON.stringify(value, null, indent)}\n`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
/** Canonical JSON: compact separators, no re-sorting (field order is FROZEN by
 *  the canonicalizers below), non-ASCII left unescaped. Byte-identical to
 *  Python's json.dumps(..., separators=(',',':'), ensure_ascii=False). */
const canonical = (value) => JSON.stringify(value);
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const terminal = (value) => (/[.!?]$/.test(value) ? value : `${value}.`);

// --- live CHECK domains (parsed from the shipped schema, never hardcoded) -----
const domainFrom = (file, re) => {
  const sql = readFileSync(join(SCHEMA_DIR, file), 'utf8');
  const match = sql.match(re);
  if (match === null) throw new Error(`Could not read a CHECK domain from ${file}`);
  return [...match[1].matchAll(/'([a-z0-9_ -]+)'/gi)].map((m) => m[1]);
};

export const liveDomains = () => {
  const standardEquipment = domainFrom(
    '007_program_engine.sql',
    /item\s+TEXT NOT NULL CHECK \(item IN\s*\(([\s\S]*?)\)\)/,
  );
  return {
    pattern: domainFrom('001_mechanical_input.sql', /pattern\s+TEXT NOT NULL CHECK \(pattern IN\s*\(([\s\S]*?)\)\)/),
    difficulty: domainFrom('010_movement_library.sql', /difficulty_rating\s+TEXT NOT NULL DEFAULT 'Intermediate'\s*CHECK \(difficulty_rating IN \(([\s\S]*?)\)\)/),
    category: domainFrom('008_taxonomy.sql', /category\s+TEXT NOT NULL CHECK \(category IN\s*\(([\s\S]*?)\)\)/),
    implement: domainFrom('008_taxonomy.sql', /implement\s+TEXT NOT NULL DEFAULT 'bodyweight' CHECK \(implement IN\s*\(([\s\S]*?)\)\)/),
    standardEquipment,
    /** The domain movement_equipment carries AFTER 049 widens it. */
    equipment: [...standardEquipment, ...SPECIALIST_EQUIPMENT_ITEMS],
  };
};

// --- frozen canonical field order --------------------------------------------
const DOMAIN_ORDER = ['movement', 'detail', 'coaching', 'taxonomy', 'equipment'];
const FIELD_ORDER = {
  movement: ['pattern', 'primary_muscle', 'is_compound'],
  detail: ['difficulty_rating', 'target_muscles'],
  coaching: ['coaching_intent', 'setup_steps', 'cues'],
  taxonomy: ['category', 'implement', 'family'],
  equipment: ['required_items'],
};
/** Exact key sets. Every container in the overlay is CLOSED and fully
 *  required — there are no optional fields anywhere except the change domains
 *  (which are optional as a whole, but closed and partly required once
 *  present). Unknown fields are a generator error at EVERY depth, never
 *  silently ignored, so a typo can never smuggle unvalidated content past the
 *  hash into a shipped migration. */
const KEYS = {
  root: ['schemaVersion', 'correctionVersion', 'mediaExcluded', 'source', 'build',
    'ratificationTemplate', 'scopeAssignments', 'records'],
  source: ['dataset', 'url', 'retrieved_at', 'standing'],
  build: ['applied_at_ms', 'approved_on'],
  ratificationTemplate: ['approver_name', 'approver_role', 'approval_basis'],
  record: ['name', 'correction_version', 'supersedes_v2_sha256', 'source_ref',
    'changes', 'notes', 'ratification', 'correction_sha256'],
  source_ref: ['dataset', 'id', 'retrieved_at', 'standing'],
  ratification: ['approver_name', 'approver_role', 'approval_basis', 'approved_on',
    'correction_version', 'correction_sha256'],
  scopeAssignment: ['name', 'scope', 'content_set', 'assignment_sha256'],
};
/** Domains whose every listed field is mandatory once the domain is present. */
const FULLY_REQUIRED_DOMAINS = { coaching: FIELD_ORDER.coaching, equipment: FIELD_ORDER.equipment };
const APPROVER_ROLE = 'owner';
const APPROVAL_BASIS = 'owner_release_decision';
/** The EXACT approved import. Provenance is pinned here rather than merely
 *  type-checked: `retrieved_at` names the day the upstream bytes were read, and
 *  a "valid ISO date" test would happily accept a different day. */
const FROZEN_SOURCE = {
  dataset: 'yuhonas/free-exercise-db',
  url: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json',
  retrieved_at: '2026-08-11',
  standing: 'corroborating; frozen import revision unknown',
};
const FROZEN_STANDING = FROZEN_SOURCE.standing;
/** Provenance fingerprint of the 32 ratified records, frozen from the approved
 *  overlay. It is deliberately SEPARATE from correction_sha256: the ratified
 *  content hash covers what the athlete reads (name, version, superseded
 *  fingerprint, changes) and must stay exactly as approved, so it cannot also
 *  cover source_ref without re-hashing — and therefore re-approving — every
 *  record. Without this second, independent checksum, `source_ref.id` is
 *  structurally validated but not BOUND: swapping one id for another leaves
 *  every record hash, the manifest and migration 049 byte-identical, so the
 *  citation could silently drift away from the movement it justifies. */
const FROZEN_PROVENANCE_SHA256 = '5d689cb65008eefade68fc31c9389bdc7b55fca2c665ac6ed7606f48b190d868';
const CONTENT_SETS = ['legacy_v1', 'v2'];
/** Any media-shaped key anywhere in the overlay is a generator error. */
const MEDIA_KEY = /^(asset_key|assetKey|status|revision|video_placeholder_uri|videoUrl|video_url|fallbackUrl|fallback_url|media|media_status|media_revision|videoUri|video_uri|thumbnail|poster)$/;

// --- structural primitives ----------------------------------------------------
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isSha256 = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
/** A REAL calendar date, not just the shape of one: `2026-02-30` and
 *  `2026-13-01` match the pattern but name no day, and a build stamped with a
 *  date that does not exist is not a dated build. */
const isIsoDate = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [year, month, day] = v.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};
/** lower_snake_case, and a STRING: `123` and `true` must not be coerced through
 *  a regex test into a valid slug. */
const isLowerSnake = (v) => typeof v === 'string' && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(v);
const isStringArray = (v) => Array.isArray(v) && v.every(isNonEmptyString);

/** Rebuild `changes` in the frozen order so the hash never depends on the
 *  order keys happen to sit in the source file. Total on malformed input: a
 *  non-object `changes` or domain is SKIPPED rather than throwing, so a
 *  structural defect is reported by the validator as a named error instead of
 *  surfacing as a TypeError from inside the hash. Valid input is unaffected. */
export const canonicalChanges = (changes) => {
  const out = {};
  if (!isPlainObject(changes)) return out;
  for (const domain of DOMAIN_ORDER) {
    if (!(domain in changes)) continue;
    const source = changes[domain];
    if (!isPlainObject(source)) continue;
    const rebuilt = {};
    for (const field of FIELD_ORDER[domain]) {
      if (field in source) rebuilt[field] = source[field];
    }
    out[domain] = rebuilt;
  }
  return out;
};

export const correctionSha256 = (record) => sha256(canonical({
  name: record.name,
  correction_version: record.correction_version,
  supersedes_v2_sha256: record.supersedes_v2_sha256,
  changes: canonicalChanges(record.changes),
}));

export const assignmentSha256 = (assignment) => sha256(canonical({
  name: assignment.name,
  scope: assignment.scope,
}));

export const scopeSetSha256 = (assignments) =>
  sha256(canonical([...assignments.map((a) => a.assignment_sha256)].sort()));

/** Fingerprint of the COMPLETE citation set: every {name, source_ref} pair,
 *  canonicalized in frozen field order and sorted, so the digest depends on the
 *  set itself and not on the order records happen to sit in the file. Total on
 *  malformed input (a non-object source_ref simply contributes undefined
 *  fields) — the structural validator reports that separately, by name. */
export const provenanceSha256 = (records) => sha256(canonical(
  records.map((record) => canonical({
    name: record?.name,
    source_ref: {
      dataset: record?.source_ref?.dataset,
      id: record?.source_ref?.id,
      retrieved_at: record?.source_ref?.retrieved_at,
      standing: record?.source_ref?.standing,
    },
  })).sort(),
));

// --- validation ---------------------------------------------------------------
const BANNED_CLAIM = /\b(cure|heal(?:s|ing)?|guarantee|injury[- ]proof|prevent(?:s|ing)? injur|bulletproof|pain[- ]free|insurance|pays out|burn(?:s)? fat|melt|shred your|doctor|medical|prescription|diagnos|therap)\b/i;
const NEGATIVE_CUE = /\b(?:don't|do not|never|avoid|stop|no)\b/i;

const assertNoMediaKeys = (value, path, errors) => {
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoMediaKeys(item, `${path}[${i}]`, errors));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (MEDIA_KEY.test(key)) errors.push(`media key is prohibited in the overlay: ${path}.${key}`);
    assertNoMediaKeys(child, `${path}.${key}`, errors);
  }
};

/** Closed-object check: `path` must be an object whose key set is EXACTLY
 *  `allowed` — every unknown key and every missing key is an error. */
const closedObject = (value, path, allowed, errors) => {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!allowed.includes(key)) errors.push(`unknown field at ${path}: ${key}`);
  }
  for (const key of allowed) {
    if (!keys.includes(key)) errors.push(`missing required field at ${path}: ${key}`);
  }
  return true;
};

const requireString = (value, path, errors, predicate = isNonEmptyString, what = 'a non-empty string') => {
  if (!predicate(value)) errors.push(`${path} must be ${what}`);
};

export function validate(overlay, context) {
  const { domains, v2Hashes, legacyNames, targetNames } = context;
  const errors = [];
  const targetSet = new Set(targetNames);
  const legacySet = new Set(legacyNames);
  const allNames = new Set([...targetNames, ...legacyNames]);

  // The media prohibition is scanned over the COMPLETE overlay, not just the
  // records: a media-shaped key in the root, the source block, or a scope
  // assignment is equally forbidden.
  assertNoMediaKeys(overlay, 'overlay', errors);

  if (!closedObject(overlay, 'overlay', KEYS.root, errors)) throw new Error(errors.join('\n'));
  if (overlay.schemaVersion !== 1) errors.push('overlay.schemaVersion must be 1');
  if (overlay.correctionVersion !== 1) errors.push('overlay.correctionVersion must be 1');
  if (overlay.mediaExcluded !== true) errors.push('overlay must declare mediaExcluded: true');

  if (closedObject(overlay.source, 'overlay.source', KEYS.source, errors)) {
    requireString(overlay.source.dataset, 'overlay.source.dataset', errors);
    requireString(overlay.source.url, 'overlay.source.url', errors,
      (v) => typeof v === 'string' && /^https:\/\//.test(v), 'an https URL');
    requireString(overlay.source.retrieved_at, 'overlay.source.retrieved_at', errors, isIsoDate,
      'an ISO-8601 calendar date');
    if (overlay.source.standing !== FROZEN_STANDING) {
      errors.push(`overlay.source.standing must be exactly "${FROZEN_STANDING}" — upstream corroborates, it does not authorize`);
    }
    // The approved import is PINNED, not merely well-formed: a different
    // dataset, URL or retrieval day is a different citation for the same
    // ratified copy, and nothing downstream would notice.
    for (const field of ['dataset', 'url', 'retrieved_at']) {
      if (overlay.source[field] !== FROZEN_SOURCE[field]) {
        errors.push(`overlay.source.${field} is pinned to the approved import and must be exactly "${FROZEN_SOURCE[field]}"`);
      }
    }
  }
  if (closedObject(overlay.build, 'overlay.build', KEYS.build, errors)) {
    if (!Number.isInteger(overlay.build.applied_at_ms) || overlay.build.applied_at_ms <= 0) {
      errors.push('overlay.build.applied_at_ms must be a positive integer (deterministic build input)');
    }
    requireString(overlay.build.approved_on, 'overlay.build.approved_on', errors, isIsoDate,
      'an ISO-8601 calendar date');
  }
  if (closedObject(overlay.ratificationTemplate, 'overlay.ratificationTemplate', KEYS.ratificationTemplate, errors)) {
    requireString(overlay.ratificationTemplate.approver_name, 'overlay.ratificationTemplate.approver_name', errors);
    if (overlay.ratificationTemplate.approver_role !== APPROVER_ROLE) {
      errors.push(`overlay.ratificationTemplate.approver_role must be "${APPROVER_ROLE}" — no clinical or coaching credential may be asserted`);
    }
    if (overlay.ratificationTemplate.approval_basis !== APPROVAL_BASIS) {
      errors.push(`overlay.ratificationTemplate.approval_basis must be "${APPROVAL_BASIS}"`);
    }
  }
  if (!Array.isArray(overlay.records)) errors.push('overlay.records must be an array');
  if (!Array.isArray(overlay.scopeAssignments)) errors.push('overlay.scopeAssignments must be an array');
  if (errors.length > 0) throw new Error(errors.join('\n'));

  const seen = new Set();
  overlay.records.forEach((record, index) => {
    const path = `records[${index}]`;
    if (!closedObject(record, path, KEYS.record, errors)) return;
    const where = isNonEmptyString(record.name) ? record.name : `<unnamed at ${path}>`;
    requireString(record.name, `${path}.name`, errors);
    if (seen.has(record.name)) errors.push(`duplicate correction record: ${where}`);
    seen.add(record.name);
    // Scoping rule: `records` corrects the 176 v2 target ONLY. A legacy v1 name
    // here would corrupt the "corrected names are disjoint from the 124" law.
    if (!targetSet.has(record.name)) errors.push(`correction names a movement outside the 176 target: ${where}`);
    if (legacySet.has(record.name)) errors.push(`correction names a legacy v1 movement: ${where}`);
    if (record.correction_version !== 1) errors.push(`correction_version must be 1 on ${where}`);
    requireString(record.supersedes_v2_sha256, `${path}.supersedes_v2_sha256`, errors, isSha256, 'a 64-character sha256 hex digest');
    requireString(record.correction_sha256, `${path}.correction_sha256`, errors, isSha256, 'a 64-character sha256 hex digest');
    if (record.supersedes_v2_sha256 !== v2Hashes.get(record.name)) {
      errors.push(`supersedes_v2_sha256 does not match the shipped v2 fingerprint on ${where}`);
    }

    // source_ref carries the FROZEN provenance fields, identical on every record.
    if (closedObject(record.source_ref, `${path}.source_ref`, KEYS.source_ref, errors)) {
      if (record.source_ref.dataset !== overlay.source.dataset) {
        errors.push(`${path}.source_ref.dataset must equal overlay.source.dataset on ${where}`);
      }
      requireString(record.source_ref.id, `${path}.source_ref.id`, errors);
      if (record.source_ref.retrieved_at !== overlay.source.retrieved_at) {
        errors.push(`${path}.source_ref.retrieved_at must equal overlay.source.retrieved_at on ${where}`);
      }
      if (record.source_ref.standing !== FROZEN_STANDING) {
        errors.push(`${path}.source_ref.standing must be exactly "${FROZEN_STANDING}" on ${where}`);
      }
    }
    if (!isStringArray(record.notes)) {
      errors.push(`${path}.notes must be an array of non-empty strings on ${where}`);
    }

    const changes = record.changes;
    if (!isPlainObject(changes)) {
      errors.push(`${path}.changes must be an object`);
      return;
    }
    for (const domain of Object.keys(changes)) {
      if (!DOMAIN_ORDER.includes(domain)) errors.push(`unknown change domain at ${path}.changes: ${domain}`);
    }
    if (!('coaching' in changes)) errors.push(`every correction must carry coaching copy: ${where}`);
    let domainsWellFormed = true;
    for (const domain of DOMAIN_ORDER) {
      if (!(domain in changes)) continue;
      const block = changes[domain];
      const domainPath = `${path}.changes.${domain}`;
      if (!isPlainObject(block)) {
        errors.push(`${domainPath} must be an object`);
        domainsWellFormed = false;
        continue;
      }
      const fields = Object.keys(block);
      for (const field of fields) {
        if (!FIELD_ORDER[domain].includes(field)) errors.push(`unknown field at ${domainPath}: ${field}`);
      }
      if (fields.length === 0) errors.push(`${domainPath} must declare at least one field`);
      for (const field of FULLY_REQUIRED_DOMAINS[domain] ?? []) {
        if (!fields.includes(field)) errors.push(`missing required field at ${domainPath}: ${field}`);
      }
    }
    // A malformed domain is already reported by name; running the value and
    // hash checks over it would only turn a clear error into a TypeError.
    if (!domainsWellFormed) return;

    const movement = changes.movement ?? {};
    if ('pattern' in movement && !domains.pattern.includes(movement.pattern)) {
      errors.push(`pattern outside the live CHECK domain on ${where}: ${movement.pattern}`);
    }
    if ('is_compound' in movement && movement.is_compound !== 0 && movement.is_compound !== 1) {
      errors.push(`is_compound must be 0 or 1 on ${where}`);
    }
    if ('primary_muscle' in movement && !isNonEmptyString(movement.primary_muscle)) {
      errors.push(`movement.primary_muscle must be a non-empty string on ${where}`);
    }
    const detail = changes.detail ?? {};
    if ('difficulty_rating' in detail && !domains.difficulty.includes(detail.difficulty_rating)) {
      errors.push(`difficulty_rating outside the live CHECK domain on ${where}`);
    }
    if ('target_muscles' in detail
      && (!isStringArray(detail.target_muscles) || detail.target_muscles.length === 0
        || new Set(detail.target_muscles).size !== detail.target_muscles.length)) {
      errors.push(`target_muscles must be a non-empty array of unique non-empty strings on ${where}`);
    }
    const taxonomy = changes.taxonomy ?? {};
    if ('category' in taxonomy && !domains.category.includes(taxonomy.category)) {
      errors.push(`taxonomy.category outside the live CHECK domain on ${where}`);
    }
    if ('implement' in taxonomy && !domains.implement.includes(taxonomy.implement)) {
      errors.push(`taxonomy.implement outside the live CHECK domain on ${where}`);
    }
    // `?? ''` + a bare regex test would coerce 42 to "42" and accept it.
    if ('family' in taxonomy && !isLowerSnake(taxonomy.family)) {
      errors.push(`taxonomy.family must be a lower_snake_case string on ${where}`);
    }
    const equipment = changes.equipment ?? {};
    if ('required_items' in equipment) {
      const items = equipment.required_items;
      if (!isStringArray(items) || items.length === 0) {
        errors.push(`equipment.required_items must be a non-empty array of non-empty strings on ${where} (REPLACE semantics; omit the key to leave rows untouched)`);
      } else {
        if (new Set(items).size !== items.length) errors.push(`equipment.required_items contains duplicates on ${where}`);
        for (const item of items) {
          if (!domains.equipment.includes(item)) errors.push(`equipment item outside the post-049 CHECK domain on ${where}: ${item}`);
        }
      }
    }

    const coaching = changes.coaching ?? {};
    const intent = coaching.coaching_intent;
    const steps = coaching.setup_steps;
    const cues = coaching.cues;
    if (typeof intent !== 'string' || intent.trim().length < 1 || intent.trim().length > 160) {
      errors.push(`coaching_intent must be a string of 1-160 characters (movement_coaching_intent CHECK) on ${where}`);
    }
    if (!isStringArray(steps)) {
      errors.push(`setup_steps must be an array of non-empty strings on ${where}`);
    } else if (steps.length < 2 || steps.length > 4) {
      errors.push(`setup_steps must hold 2-4 entries on ${where}`);
    }
    if (!isStringArray(cues)) {
      errors.push(`cues must be an array of non-empty strings on ${where}`);
    } else if (cues.length < 1 || cues.length > 3) {
      errors.push(`cues must hold 1-3 entries on ${where}`);
    }
    // Ratified cue law: a correction may carry up to three cues, and a repeated
    // one spends a scarce slot on nothing. Trim + case folding, because "Brace
    // the ribs" and "brace the ribs " read as one cue to the athlete.
    if (Array.isArray(cues)) {
      const folded = cues.filter((cue) => typeof cue === 'string').map((cue) => cue.trim().toLowerCase());
      if (new Set(folded).size !== folded.length) {
        errors.push(`cues must be distinct after trim and case folding on ${where}`);
      }
    }
    const body = [intent, ...(Array.isArray(steps) ? steps : []), ...(Array.isArray(cues) ? cues : [])]
      .filter((part) => typeof part === 'string').join(' ');
    if (BANNED_CLAIM.test(body)) errors.push(`coaching copy makes a banned claim on ${where}`);
    if (Array.isArray(cues) && cues.some((cue) => typeof cue === 'string' && NEGATIVE_CUE.test(cue))) {
      errors.push(`cues must use positive intention on ${where}`);
    }

    if (record.correction_sha256 !== correctionSha256(record)) {
      errors.push(`correction_sha256 does not reproduce on ${where}`);
    }
    // The approval binds the hash: edit any approved copy or equipment set and
    // the generator refuses to emit 049 until the record is re-approved. Every
    // field of the approval is checked, not just the hash — a mismatched
    // approver, basis, date or version is an unratified record.
    const ratification = record.ratification;
    const ratificationPath = `${path}.ratification`;
    if (ratification === null) {
      errors.push(`missing approval record on ${where}`);
    } else if (closedObject(ratification, ratificationPath, KEYS.ratification, errors)) {
      if (ratification.approver_name !== overlay.ratificationTemplate.approver_name) {
        errors.push(`${ratificationPath}.approver_name must match overlay.ratificationTemplate on ${where}`);
      }
      if (ratification.approver_role !== APPROVER_ROLE || ratification.approval_basis !== APPROVAL_BASIS) {
        errors.push(`approval record must assert owner authority on ${where} — no clinical or coaching credential may be asserted`);
      }
      if (ratification.approved_on !== overlay.build.approved_on) {
        errors.push(`${ratificationPath}.approved_on must equal overlay.build.approved_on on ${where}`);
      }
      if (ratification.correction_version !== record.correction_version) {
        errors.push(`${ratificationPath}.correction_version must equal the record's own version on ${where}`);
      }
      if (ratification.correction_sha256 !== correctionSha256(record)) {
        errors.push(`approval record does not bind this record's current hash on ${where} — re-approve before generating`);
      }
    }
  });
  if (seen.size !== 32) errors.push(`expected exactly 32 correction records, found ${seen.size}`);

  // Provenance is frozen INDEPENDENTLY of the ratified content hash. Every
  // structural check above is satisfied by a source_ref that cites the wrong
  // upstream exercise — the id is a free-form string and 049 never renders it,
  // so a swapped or mistyped citation is invisible to correction_sha256, to the
  // manifest and to the migration bytes. This binds the whole citation set.
  const provenance = provenanceSha256(overlay.records);
  if (provenance !== FROZEN_PROVENANCE_SHA256) {
    errors.push(`source provenance set does not reproduce: expected ${FROZEN_PROVENANCE_SHA256}, got ${provenance} — a name or source_ref changed after ratification`);
  }

  const scopeSeen = new Set();
  overlay.scopeAssignments.forEach((assignment, index) => {
    const path = `scopeAssignments[${index}]`;
    if (!closedObject(assignment, path, KEYS.scopeAssignment, errors)) return;
    requireString(assignment.name, `${path}.name`, errors);
    requireString(assignment.assignment_sha256, `${path}.assignment_sha256`, errors, isSha256,
      'a 64-character sha256 hex digest');
    // Scope may reference a LEGACY movement (the canonical TGU), so it is
    // validated against the full 300-name corpus, not the 176 target.
    if (!allNames.has(assignment.name)) errors.push(`scope assignment names an unknown movement: ${assignment.name}`);
    if (assignment.scope !== 'full_body') errors.push(`scope must be full_body: ${assignment.name}`);
    if (!CONTENT_SETS.includes(assignment.content_set)) {
      errors.push(`${path}.content_set must be one of ${CONTENT_SETS.join('|')}`);
    } else {
      const expectedSet = legacySet.has(assignment.name) ? 'legacy_v1' : 'v2';
      if (assignment.content_set !== expectedSet) {
        errors.push(`scope assignment content_set must be ${expectedSet} for ${assignment.name}`);
      }
    }
    if (scopeSeen.has(assignment.name)) errors.push(`duplicate scope assignment: ${assignment.name}`);
    scopeSeen.add(assignment.name);
    if (assignment.assignment_sha256 !== assignmentSha256(assignment)) {
      errors.push(`assignment_sha256 does not reproduce for ${assignment.name}`);
    }
  });
  if (scopeSeen.size !== 2) errors.push(`expected exactly 2 scope assignments, found ${scopeSeen.size}`);

  if (errors.length > 0) throw new Error(errors.join('\n'));
}

// --- rendering -----------------------------------------------------------------
const cteValues = (rows) => rows.join(',\n');
const idOf = (name) => `(SELECT movement_id FROM movement WHERE name = ${q(name)})`;

export function renderMigration(overlay, domains) {
  const appliedAtMs = overlay.build.applied_at_ms;
  const lines = [
    '-- =============================================================================',
    `-- ${MIGRATION_SLOT}_movement_content_correction_v1.sql`,
    '-- Phase 2a pre-release content correction (generated, additive, idempotent).',
    '-- Source of truth: packages/core-db/staging/movement_content_correction_v1.json',
    '-- Regenerate with: node scripts/generate-library-correction.mjs --write',
    '--',
    '-- Writes NO media of any kind: asset keys, statuses, revisions and the legacy',
    '-- fallback URLs stay byte-identical. Migrations 036-048 are not modified.',
    '-- =============================================================================',
    '',
    '-- Full-body scope is a SEPARATE axis from movement.pattern: FOCUS_PATTERNS.full',
    '-- already holds five entries, so a sixth pattern slot is unreachable. Row absent',
    '-- = not scoped.',
    'CREATE TABLE IF NOT EXISTS movement_scope (',
    '  movement_id INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,',
    "  scope       TEXT NOT NULL CHECK (scope IN ('full_body')),",
    '  PRIMARY KEY (movement_id, scope)',
    ') STRICT, WITHOUT ROWID;',
    '',
    '-- Immutable revision history: INSERT OR IGNORE only. A future correction set',
    '-- writes version 2 alongside version 1 — never an UPDATE, never a DELETE.',
    'CREATE TABLE IF NOT EXISTS movement_content_correction (',
    '  movement_id        INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,',
    '  correction_version INTEGER NOT NULL CHECK (correction_version >= 1),',
    '  correction_sha256  TEXT    NOT NULL,',
    '  applied_at_ms      INTEGER NOT NULL,',
    '  PRIMARY KEY (movement_id, correction_version)',
    ') STRICT;',
    '',
    '-- ---------------------------------------------------------------------------',
    '-- movement_equipment: widen the item CHECK to carry specialist equipment.',
    '-- The CHECK is a STRICT table constraint and SQLite cannot ALTER it, so the',
    '-- table is rebuilt. movement_equipment is a child-only table (nothing',
    '-- REFERENCES it), which is why a rename/copy/drop is FK-safe even though the',
    '-- runner holds an open transaction (PRAGMA foreign_keys = OFF is silently',
    '-- ignored inside one, so the classic 12-step recipe would not work here).',
    '-- STRICT, WITHOUT ROWID, the composite PK and the ON DELETE CASCADE are all',
    '-- preserved, and every pre-existing row is copied before any correction runs.',
    '-- ---------------------------------------------------------------------------',
    'CREATE TABLE IF NOT EXISTS movement_equipment_v049 (',
    '  movement_id INTEGER NOT NULL REFERENCES movement ON DELETE CASCADE,',
    '  item        TEXT NOT NULL CHECK (item IN',
    `                (${domains.standardEquipment.slice(0, 5).map(q).join(',')},`,
    `                 ${domains.standardEquipment.slice(5).map(q).join(',')},`,
    `                 ${SPECIALIST_EQUIPMENT_ITEMS.map(q).join(',')})),`,
    '  PRIMARY KEY (movement_id, item)',
    ') STRICT, WITHOUT ROWID;',
    '',
    'INSERT OR IGNORE INTO movement_equipment_v049 (movement_id, item)',
    '  SELECT movement_id, item FROM movement_equipment;',
    '',
    'DROP TABLE movement_equipment;',
    'ALTER TABLE movement_equipment_v049 RENAME TO movement_equipment;',
    '',
  ];

  overlay.records.forEach((record, index) => {
    const changes = canonicalChanges(record.changes);
    const id = idOf(record.name);
    lines.push(
      '-- ---------------------------------------------------------------------------',
      `-- ${String(index + 1).padStart(2, '0')} · ${record.name}`,
      `-- correction_sha256 ${record.correction_sha256}`,
      '-- ---------------------------------------------------------------------------',
    );
    if (changes.movement !== undefined) {
      const sets = Object.entries(changes.movement)
        .map(([field, value]) => `${field} = ${typeof value === 'number' ? value : q(value)}`);
      lines.push(`UPDATE movement SET ${sets.join(', ')} WHERE name = ${q(record.name)};`);
    }
    if (changes.detail !== undefined) {
      const sets = Object.entries(changes.detail).map(([field, value]) =>
        `${field} = ${q(field === 'target_muscles' ? JSON.stringify(value) : value)}`);
      lines.push(`UPDATE movement_detail SET ${sets.join(', ')} WHERE movement_id = ${id};`);
    }
    if (changes.coaching !== undefined) {
      const instructions = changes.coaching.setup_steps.map(terminal).join(' ');
      const cues = changes.coaching.cues.map(terminal).join(' ');
      lines.push(
        `UPDATE movement_detail SET instructions = ${q(instructions)}, cues = ${q(cues)}`,
        `  WHERE movement_id = ${id};`,
        `UPDATE movement_coaching_intent SET coaching_intent = ${q(changes.coaching.coaching_intent)}`,
        `  WHERE movement_id = ${id};`,
      );
    }
    if (changes.taxonomy !== undefined) {
      const sets = Object.entries(changes.taxonomy).map(([field, value]) => `${field} = ${q(value)}`);
      lines.push(`UPDATE movement_taxonomy SET ${sets.join(', ')} WHERE movement_id = ${id};`);
    }
    if (changes.equipment !== undefined) {
      // Complete REPLACE semantics — there is no additive mode.
      lines.push(
        `DELETE FROM movement_equipment WHERE movement_id = ${id};`,
        'INSERT OR IGNORE INTO movement_equipment (movement_id, item) VALUES',
        `${cteValues(changes.equipment.required_items.map((item) => `  (${id}, ${q(item)})`))};`,
      );
    }
    lines.push('');
  });

  lines.push(
    '-- ---------------------------------------------------------------------------',
    '-- Full-body scope assignments (seeded by name, matching the 037-048 idiom).',
    '-- The canonical Kettlebell Turkish Get-Up is a LEGACY v1 record: it receives a',
    '-- scope row and nothing else, so its v1 fingerprint and reviewed YouTube',
    '-- fallback stay byte-identical.',
    '-- ---------------------------------------------------------------------------',
    'INSERT OR IGNORE INTO movement_scope (movement_id, scope) VALUES',
    `${cteValues(overlay.scopeAssignments.map((a) => `  (${idOf(a.name)}, ${q(a.scope)})`))};`,
    '',
    '-- ---------------------------------------------------------------------------',
    '-- Provenance. Table existence proves 049 ran; it proves nothing about row',
    '-- presence or content integrity — verify_library.py checks those separately.',
    '-- ---------------------------------------------------------------------------',
    'INSERT OR IGNORE INTO movement_content_correction',
    '  (movement_id, correction_version, correction_sha256, applied_at_ms) VALUES',
    `${cteValues(overlay.records.map((r) =>
      `  (${idOf(r.name)}, ${r.correction_version}, ${q(r.correction_sha256)}, ${appliedAtMs})`))};`,
    '',
  );
  return lines.join('\n');
}

export function renderManifest(overlay) {
  return {
    schemaVersion: 1,
    correctionVersion: 1,
    mediaExcluded: true,
    fingerprintFields: ['name', 'correction_version', 'supersedes_v2_sha256', 'changes'],
    source: overlay.source,
    // Audit visibility: the citation-set digest an auditor can reproduce from
    // the overlay without re-deriving any ratified content hash.
    sourceProvenanceFields: ['name', 'source_ref'],
    sourceProvenanceSha256: provenanceSha256(overlay.records),
    build: overlay.build,
    scopeAssignmentsSetSha256: scopeSetSha256(overlay.scopeAssignments),
    scopeAssignments: overlay.scopeAssignments.map((a) => ({
      name: a.name,
      scope: a.scope,
      content_set: a.content_set,
      assignment_sha256: a.assignment_sha256,
    })),
    records: overlay.records.map((r) => ({
      name: r.name,
      correction_version: r.correction_version,
      supersedes_v2_sha256: r.supersedes_v2_sha256,
      correction_sha256: r.correction_sha256,
      changed_domains: DOMAIN_ORDER.filter((d) => d in r.changes),
      ratification: r.ratification,
    })),
  };
}

// --- IO guards -----------------------------------------------------------------
export const pathAtHead = (path) => {
  const rel = relative(ROOT, path).replaceAll('\\', '/');
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${rel}`], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

export const compareOrWrite = (path, expected, write, migration = false) => {
  if (write) {
    if (migration && pathAtHead(path)) throw new Error(`Refusing to overwrite shipped migration: ${relative(ROOT, path)}`);
    writeFileSync(path, expected);
    return;
  }
  if (!existsSync(path)) throw new Error(`Missing generated artifact: ${relative(ROOT, path)}`);
  if (readFileSync(path, 'utf8') !== expected) throw new Error(`Generated artifact drift: ${relative(ROOT, path)}`);
};

export function loadContext() {
  const v2Manifest = readJson(V2_MANIFEST_PATH);
  const legacyManifest = readJson(LEGACY_MANIFEST_PATH);
  const v2Records = Object.values(v2Manifest.slots).flat();
  const legacyNames = Object.values(legacyManifest.slots).flat().map((r) => r.name);
  if (v2Records.length !== 176) throw new Error(`Expected 176 v2 records, found ${v2Records.length}`);
  if (legacyNames.length !== 124) throw new Error(`Expected 124 legacy records, found ${legacyNames.length}`);
  return {
    domains: liveDomains(),
    v2Hashes: new Map(v2Records.map((r) => [r.name, r.content_sha256])),
    v2Content: new Map(readJson(V2_CONTENT_PATH).movements.map((r) => [r.name, r])),
    legacyNames,
    targetNames: TARGET_NAMES,
  };
}

/** Derive every hash and stamp the owner approvals against them. Hashes first,
 *  approvals second — never the reverse (plan 12.2). */
export function stamp() {
  const overlay = readJson(CORRECTION_PATH);
  const context = loadContext();
  for (const record of overlay.records) {
    record.supersedes_v2_sha256 = context.v2Hashes.get(record.name) ?? '';
    record.changes = canonicalChanges(record.changes);
    record.correction_sha256 = correctionSha256(record);
    record.ratification = {
      ...overlay.ratificationTemplate,
      approved_on: overlay.build.approved_on,
      correction_version: record.correction_version,
      correction_sha256: record.correction_sha256,
    };
  }
  for (const assignment of overlay.scopeAssignments) {
    assignment.assignment_sha256 = assignmentSha256(assignment);
  }
  writeFileSync(CORRECTION_PATH, jsonText(overlay));
  return { records: overlay.records.length, scopeAssignments: overlay.scopeAssignments.length };
}

export function generate({ write = false } = {}) {
  const overlay = readJson(CORRECTION_PATH);
  const context = loadContext();
  validate(overlay, context);
  compareOrWrite(CORRECTION_MANIFEST_PATH, jsonText(renderManifest(overlay)), write);
  compareOrWrite(MIGRATION_PATH, renderMigration(overlay, context.domains), write, true);
  return {
    records: overlay.records.length,
    scopeAssignments: overlay.scopeAssignments.length,
    equipmentReplacements: overlay.records.filter((r) => 'equipment' in r.changes).length,
  };
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  if (process.argv.includes('--stamp')) {
    const result = stamp();
    console.log(`stamped ${result.records} correction hashes + approvals and ${result.scopeAssignments} scope assignments`);
  } else {
    const write = process.argv.includes('--write');
    const result = generate({ write });
    console.log(`${write ? 'wrote' : 'verified'} Phase 2a correction overlay: ${result.records} records, ${result.equipmentReplacements} equipment replacements, ${result.scopeAssignments} scope assignments`);
  }
}
