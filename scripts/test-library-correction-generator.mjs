/**
 * Contract tests for the Phase 2a correction-overlay generator.
 *
 * These are the refusal laws, not just the happy path: a shipped migration is
 * never overwritten, an approval that no longer binds its record's hash blocks
 * generation, unknown fields and out-of-domain enums are rejected, and no
 * media-shaped key can ride into a correction.
 *
 * Run:  node scripts/test-library-correction-generator.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PATHS,
  compareOrWrite,
  correctionSha256,
  generate,
  liveDomains,
  loadContext,
  pathAtHead,
  provenanceSha256,
  renderManifest,
  renderMigration,
  scopeSetSha256,
  validate,
} from './generate-library-correction.mjs';
import { TARGET_NAMES } from './library-target-v1.mjs';

let passed = 0;
const check = (label, run) => {
  try {
    run();
    passed += 1;
    console.log(`  [${passed}] PASS ${label}`);
  } catch (error) {
    console.error(`  FAIL ${label}: ${error.message}`);
    process.exitCode = 1;
  }
};

const overlay = () => JSON.parse(readFileSync(PATHS.CORRECTION_PATH, 'utf8'));
const context = loadContext();
const throwsMatching = (fn, pattern) => {
  try {
    fn();
  } catch (error) {
    assert.match(error.message, pattern);
    return;
  }
  throw new Error('expected a refusal, but the generator accepted the input');
};

check('every generated artifact exactly matches the frozen contracts', () => {
  assert.deepEqual(generate({ write: false }), {
    records: 32,
    scopeAssignments: 2,
    equipmentReplacements: 4,
  });
});

check('a shipped migration is never overwritten by --write', () => {
  const shipped = join(PATHS.SCHEMA_DIR, '048_movement_library_v2_batch.sql');
  assert.equal(pathAtHead(shipped), true, '048 must be present at HEAD for this test to mean anything');
  throwsMatching(
    () => compareOrWrite(shipped, 'clobbered', true, true),
    /Refusing to overwrite shipped migration/,
  );
  assert.notEqual(readFileSync(shipped, 'utf8'), 'clobbered');
});

check('corrected names are inside the 176 target and disjoint from the 124 legacy', () => {
  const target = new Set(TARGET_NAMES);
  const legacy = new Set(context.legacyNames);
  const names = overlay().records.map((r) => r.name);
  assert.equal(new Set(names).size, 32);
  assert.ok(names.every((n) => target.has(n)), 'a correction escaped the 176 target');
  assert.ok(names.every((n) => !legacy.has(n)), 'a correction named a legacy v1 movement');
});

check('a correction naming a legacy v1 movement is refused', () => {
  const doc = overlay();
  doc.records[0].name = 'Kettlebell Turkish Get-Up';
  throwsMatching(() => validate(doc, context), /outside the 176 target|legacy v1 movement/);
});

check('scope assignments are validated against all 300 names, not the 176 target', () => {
  const doc = overlay();
  const legacy = new Set(context.legacyNames);
  // The canonical TGU is a LEGACY record and must be accepted here.
  assert.ok(legacy.has('Kettlebell Turkish Get-Up'));
  assert.doesNotThrow(() => validate(doc, context));
  doc.scopeAssignments[0].name = 'No Such Movement';
  doc.scopeAssignments[0].assignment_sha256 = '';
  throwsMatching(() => validate(doc, context), /scope assignment names an unknown movement/);
});

check('the scope set roll-up catches an added or removed assignment', () => {
  const doc = overlay();
  const full = scopeSetSha256(doc.scopeAssignments);
  const dropped = scopeSetSha256(doc.scopeAssignments.slice(0, 1));
  assert.notEqual(full, dropped);
  assert.equal(renderManifest(doc).scopeAssignmentsSetSha256, full);
});

check('an unknown field at any depth is rejected', () => {
  const withUnknownRecordKey = overlay();
  withUnknownRecordKey.records[3].reviewer = 'someone';
  throwsMatching(() => validate(withUnknownRecordKey, context), /unknown field at records\[3\]: reviewer/);

  const withUnknownDomain = overlay();
  withUnknownDomain.records[3].changes.mediaPlan = { note: 'x' };
  throwsMatching(() => validate(withUnknownDomain, context), /unknown change domain at records\[3\]\.changes: mediaPlan/);

  const withUnknownField = overlay();
  withUnknownField.records[3].changes.movement = { secondary_muscles: ['chest'] };
  throwsMatching(() => validate(withUnknownField, context), /unknown field at records\[3\]\.changes\.movement: secondary_muscles/);
});

check('secondary_muscles has no home in the schema and cannot be smuggled in', () => {
  const doc = overlay();
  doc.records[3].changes.detail = { secondary_muscles: ['chest'] };
  throwsMatching(() => validate(doc, context), /unknown field at records\[3\]\.changes\.detail: secondary_muscles/);
});

check('an unknown field in the overlay ROOT is rejected', () => {
  const doc = overlay();
  doc.reviewedBy = 'someone';
  throwsMatching(() => validate(doc, context), /unknown field at overlay: reviewedBy/);
});

check('an unknown field in source, build, or the approval template is rejected', () => {
  for (const [container, field] of [
    ['source', 'commit'], ['build', 'builtBy'], ['ratificationTemplate', 'signature'],
  ]) {
    const doc = overlay();
    doc[container][field] = 'x';
    throwsMatching(() => validate(doc, context),
      new RegExp(`unknown field at overlay\\.${container}: ${field}`));
  }
});

check('an unknown field in source_ref or a ratification is rejected', () => {
  const withSourceRef = overlay();
  withSourceRef.records[2].source_ref.sha = 'abc';
  throwsMatching(() => validate(withSourceRef, context), /unknown field at records\[2\]\.source_ref: sha/);

  const withRatification = overlay();
  withRatification.records[2].ratification.countersigned_by = 'someone';
  throwsMatching(() => validate(withRatification, context),
    /unknown field at records\[2\]\.ratification: countersigned_by/);
});

check('an unknown field in a scope assignment is rejected', () => {
  const doc = overlay();
  doc.scopeAssignments[0].reviewer = 'someone';
  throwsMatching(() => validate(doc, context), /unknown field at scopeAssignments\[0\]: reviewer/);
});

check('a MISSING required field is rejected everywhere, not silently defaulted', () => {
  const cases = [
    ['overlay.source', (d) => { delete d.source.url; }, /missing required field at overlay\.source: url/],
    ['overlay.source.standing', (d) => { delete d.source.standing; }, /missing required field at overlay\.source: standing/],
    ['overlay.build', (d) => { delete d.build.applied_at_ms; }, /missing required field at overlay\.build: applied_at_ms/],
    ['overlay.ratificationTemplate', (d) => { delete d.ratificationTemplate.approver_name; },
      /missing required field at overlay\.ratificationTemplate: approver_name/],
    ['overlay root', (d) => { delete d.mediaExcluded; }, /missing required field at overlay: mediaExcluded/],
    ['record', (d) => { delete d.records[1].notes; }, /missing required field at records\[1\]: notes/],
    ['source_ref', (d) => { delete d.records[1].source_ref.id; }, /missing required field at records\[1\]\.source_ref: id/],
    ['ratification', (d) => { delete d.records[1].ratification.approved_on; },
      /missing required field at records\[1\]\.ratification: approved_on/],
    ['scope assignment', (d) => { delete d.scopeAssignments[1].content_set; },
      /missing required field at scopeAssignments\[1\]: content_set/],
    ['coaching domain', (d) => { delete d.records[1].changes.coaching.cues; },
      /missing required field at records\[1\]\.changes\.coaching: cues/],
  ];
  for (const [label, mutate, pattern] of cases) {
    const doc = overlay();
    mutate(doc);
    try {
      throwsMatching(() => validate(doc, context), pattern);
    } catch (error) {
      throw new Error(`${label}: ${error.message}`);
    }
  }
});

check('a malformed container is rejected rather than coerced', () => {
  const cases = [
    [(d) => { d.source = 'yuhonas/free-exercise-db'; }, /overlay\.source must be an object/],
    [(d) => { d.build = []; }, /overlay\.build must be an object/],
    [(d) => { d.ratificationTemplate = null; }, /overlay\.ratificationTemplate must be an object/],
    [(d) => { d.records = {}; }, /overlay\.records must be an array/],
    [(d) => { d.scopeAssignments = 'none'; }, /overlay\.scopeAssignments must be an array/],
    [(d) => { d.records[0] = 'Barbell Side Split Squat'; }, /records\[0\] must be an object/],
    [(d) => { d.records[0].changes = []; }, /records\[0\]\.changes must be an object/],
    [(d) => { d.records[0].changes.coaching = 'copy'; }, /records\[0\]\.changes\.coaching must be an object/],
    [(d) => { d.records[0].source_ref = null; }, /records\[0\]\.source_ref must be an object/],
    [(d) => { d.records[0].ratification = 'approved'; }, /records\[0\]\.ratification must be an object/],
    [(d) => { d.scopeAssignments[0] = 'Kettlebell Turkish Get-Up'; }, /scopeAssignments\[0\] must be an object/],
  ];
  for (const [mutate, pattern] of cases) {
    const doc = overlay();
    mutate(doc);
    throwsMatching(() => validate(doc, context), pattern);
  }
});

check('non-string setup steps, cues, notes and items are rejected', () => {
  const cases = [
    [(d) => { d.records[0].changes.coaching.setup_steps[1] = 42; },
      /setup_steps must be an array of non-empty strings/],
    [(d) => { d.records[0].changes.coaching.setup_steps[1] = '   '; },
      /setup_steps must be an array of non-empty strings/],
    [(d) => { d.records[0].changes.coaching.setup_steps = 'one step'; },
      /setup_steps must be an array of non-empty strings/],
    [(d) => { d.records[0].changes.coaching.cues[0] = { text: 'x' }; },
      /cues must be an array of non-empty strings/],
    [(d) => { d.records[0].changes.coaching.cues = null; },
      /cues must be an array of non-empty strings/],
    [(d) => { d.records[0].changes.coaching.coaching_intent = 12; },
      /coaching_intent must be a string of 1-160 characters/],
    [(d) => { d.records[0].notes = ['ok', 7]; },
      /notes must be an array of non-empty strings/],
    [(d) => { d.records[0].notes = 'a note'; },
      /notes must be an array of non-empty strings/],
    [(d) => { d.records.find((r) => r.name === 'Board Press').changes.equipment.required_items = ['boards', 9]; },
      /required_items must be a non-empty array of non-empty strings/],
    [(d) => { d.records.find((r) => r.name === 'Kettlebell Turkish Get-Up (Lunge style)').changes.detail.target_muscles = ['shoulders', null]; },
      /target_muscles must be a non-empty array of unique non-empty strings/],
  ];
  for (const [mutate, pattern] of cases) {
    const doc = overlay();
    mutate(doc);
    throwsMatching(() => validate(doc, context), pattern);
  }
});

check('the frozen provenance fields cannot drift per record', () => {
  const wrongDataset = overlay();
  wrongDataset.records[0].source_ref.dataset = 'some/other-db';
  throwsMatching(() => validate(wrongDataset, context), /source_ref\.dataset must equal overlay\.source\.dataset/);

  const wrongDate = overlay();
  wrongDate.records[0].source_ref.retrieved_at = '2020-01-01';
  throwsMatching(() => validate(wrongDate, context), /source_ref\.retrieved_at must equal overlay\.source\.retrieved_at/);

  const overclaimedStanding = overlay();
  overclaimedStanding.records[0].source_ref.standing = 'authoritative';
  throwsMatching(() => validate(overclaimedStanding, context), /source_ref\.standing must be exactly/);

  const rootStanding = overlay();
  rootStanding.source.standing = 'authoritative for the frozen bytes';
  throwsMatching(() => validate(rootStanding, context), /overlay\.source\.standing must be exactly/);
});

check('the approved import is PINNED, not merely well-formed', () => {
  const cases = [
    // Each is a well-formed value that passes every type check and names a
    // DIFFERENT import than the one the corrections were ratified against.
    [(d) => { d.source.dataset = 'yuhonas/free-exercise-dbb'; }, /overlay\.source\.dataset is pinned/],
    [(d) => { d.source.url = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercise.json'; },
      /overlay\.source\.url is pinned/],
    [(d) => { d.source.retrieved_at = '2026-08-12'; }, /overlay\.source\.retrieved_at is pinned/],
  ];
  for (const [mutate, pattern] of cases) {
    const doc = overlay();
    mutate(doc);
    throwsMatching(() => validate(doc, context), pattern);
  }
  // Moving the root date and every record's copy of it in lockstep defeats the
  // per-record equality check; only the pin catches it.
  const lockstep = overlay();
  lockstep.source.retrieved_at = '2026-08-12';
  for (const record of lockstep.records) record.source_ref.retrieved_at = '2026-08-12';
  throwsMatching(() => validate(lockstep, context), /overlay\.source\.retrieved_at is pinned/);
});

check('a one-character change to any citation is rejected by the frozen provenance set', () => {
  const cases = [
    ['the reported defect', (d) => { d.records[0].source_ref.id = 'Completely_Wrong_Id'; }],
    ['one character of an id', (d) => { d.records[0].source_ref.id += 'x'; }],
    ['a citation swapped between two records', (d) => {
      const first = d.records[0].source_ref.id;
      d.records[0].source_ref.id = d.records[1].source_ref.id;
      d.records[1].source_ref.id = first;
    }],
    ['a record renamed to another in-target movement', (d) => {
      const taken = new Set(d.records.map((r) => r.name));
      d.records[0].name = TARGET_NAMES.find((n) => !taken.has(n));
    }],
  ];
  for (const [label, mutate] of cases) {
    const doc = overlay();
    mutate(doc);
    try {
      throwsMatching(() => validate(doc, context), /source provenance set does not reproduce/);
    } catch (error) {
      throw new Error(`${label}: ${error.message}`);
    }
  }
});

check('the provenance checksum is INDEPENDENT of the ratified content hash', () => {
  const clean = overlay();
  const tampered = overlay();
  tampered.records[0].source_ref.id = 'Completely_Wrong_Id';

  // This is precisely why a second checksum is needed: the ratified hash is
  // unchanged (source_ref is deliberately outside it, so corrections keep their
  // approvals), and 049 never renders a citation, so the shipped SQL is
  // byte-identical. Nothing but the provenance set can see this edit.
  assert.equal(correctionSha256(tampered.records[0]), correctionSha256(clean.records[0]));
  assert.equal(tampered.records[0].correction_sha256, clean.records[0].correction_sha256);
  assert.equal(renderMigration(tampered, context.domains), renderMigration(clean, context.domains));
  assert.notEqual(provenanceSha256(tampered.records), provenanceSha256(clean.records));
  throwsMatching(() => validate(tampered, context), /source provenance set does not reproduce/);
});

check('the provenance checksum is order-independent and exposed in the manifest', () => {
  const doc = overlay();
  const reordered = { ...doc, records: [...doc.records].reverse() };
  assert.equal(provenanceSha256(reordered.records), provenanceSha256(doc.records));

  const manifest = renderManifest(doc);
  assert.deepEqual(manifest.sourceProvenanceFields, ['name', 'source_ref']);
  assert.equal(manifest.sourceProvenanceSha256, provenanceSha256(doc.records));
  // Audit visibility means an auditor can RE-DERIVE it from the overlay alone.
  assert.match(manifest.sourceProvenanceSha256, /^[0-9a-f]{64}$/);
  assert.notEqual(manifest.sourceProvenanceSha256, manifest.records[0].correction_sha256);
});

check('a date that does not exist on the calendar is rejected', () => {
  const cases = [
    [(d) => { d.build.approved_on = '2026-02-30'; }, /approved_on must be an ISO-8601 calendar date/],
    [(d) => { d.build.approved_on = '2026-13-01'; }, /approved_on must be an ISO-8601 calendar date/],
    [(d) => { d.build.approved_on = '2026-08-00'; }, /approved_on must be an ISO-8601 calendar date/],
    [(d) => { d.source.retrieved_at = '2026-02-31'; }, /retrieved_at must be an ISO-8601 calendar date/],
  ];
  for (const [mutate, pattern] of cases) {
    const doc = overlay();
    mutate(doc);
    throwsMatching(() => validate(doc, context), pattern);
  }
  // 2026 is not a leap year; the shape test alone would accept this.
  const leap = overlay();
  leap.build.approved_on = '2026-02-29';
  throwsMatching(() => validate(leap, context), /approved_on must be an ISO-8601 calendar date/);
});

check('optional movement and taxonomy values are type-checked, never coerced', () => {
  const cases = [
    [(d) => { d.records[15].changes.movement.primary_muscle = 42; },
      /movement\.primary_muscle must be a non-empty string/],
    [(d) => { d.records[15].changes.movement.primary_muscle = '   '; },
      /movement\.primary_muscle must be a non-empty string/],
    [(d) => { d.records[15].changes.movement.primary_muscle = ['quadriceps']; },
      /movement\.primary_muscle must be a non-empty string/],
    [(d) => { d.records[15].changes.movement.primary_muscle = null; },
      /movement\.primary_muscle must be a non-empty string/],
    // A bare regex over `value ?? ''` stringifies 123 to "123" and passes it.
    [(d) => { d.records[16].changes.taxonomy.family = 123; },
      /taxonomy\.family must be a lower_snake_case string/],
    [(d) => { d.records[16].changes.taxonomy.family = true; },
      /taxonomy\.family must be a lower_snake_case string/],
    [(d) => { d.records[16].changes.taxonomy.family = 'Turkish_Get_Up'; },
      /taxonomy\.family must be a lower_snake_case string/],
    [(d) => { d.records[16].changes.taxonomy.family = '_leading'; },
      /taxonomy\.family must be a lower_snake_case string/],
    [(d) => { d.records[16].changes.taxonomy.family = 'double__underscore'; },
      /taxonomy\.family must be a lower_snake_case string/],
    [(d) => { d.records[16].changes.taxonomy.family = ''; },
      /taxonomy\.family must be a lower_snake_case string/],
  ];
  for (const [mutate, pattern] of cases) {
    const doc = overlay();
    mutate(doc);
    throwsMatching(() => validate(doc, context), pattern);
  }
  // The one ratified family value must still be accepted.
  const tgu = overlay().records.find((r) => r.name === 'Kettlebell Turkish Get-Up (Lunge style)');
  assert.equal(tgu.changes.taxonomy.family, 'turkish_get_up');
});

check('cues must be distinct after trim and case normalization', () => {
  // The ratified copy already satisfies this; the rule is now enforced.
  for (const record of overlay().records) {
    const folded = record.changes.coaching.cues.map((c) => c.trim().toLowerCase());
    assert.equal(new Set(folded).size, folded.length, `${record.name} ships duplicate cues`);
  }
  const cases = [
    (d) => { d.records[0].changes.coaching.cues[1] = d.records[0].changes.coaching.cues[0]; },
    (d) => { d.records[0].changes.coaching.cues[1] = `  ${d.records[0].changes.coaching.cues[0]}  `; },
    (d) => { d.records[0].changes.coaching.cues[1] = d.records[0].changes.coaching.cues[0].toUpperCase(); },
  ];
  for (const mutate of cases) {
    const doc = overlay();
    const record = doc.records[0];
    mutate(doc);
    // Re-stamp the hash and the approval so the ONLY surviving objection is the
    // cue rule, not a stale fingerprint.
    record.correction_sha256 = correctionSha256(record);
    record.ratification.correction_sha256 = record.correction_sha256;
    throwsMatching(() => validate(doc, context), /cues must be distinct after trim and case folding/);
  }
});

check('malformed hashes and build inputs are rejected', () => {
  const cases = [
    [(d) => { d.records[0].correction_sha256 = 'not-a-hash'; }, /correction_sha256 must be a 64-character sha256/],
    [(d) => { d.records[0].supersedes_v2_sha256 = 'ABC'; }, /supersedes_v2_sha256 must be a 64-character sha256/],
    [(d) => { d.scopeAssignments[0].assignment_sha256 = 'zz'; }, /assignment_sha256 must be a 64-character sha256/],
    [(d) => { d.build.applied_at_ms = '1786406400000'; }, /applied_at_ms must be a positive integer/],
    [(d) => { d.build.applied_at_ms = -1; }, /applied_at_ms must be a positive integer/],
    [(d) => { d.build.approved_on = '11-08-2026'; }, /approved_on must be an ISO-8601 calendar date/],
    [(d) => { d.source.retrieved_at = 'yesterday'; }, /retrieved_at must be an ISO-8601 calendar date/],
    [(d) => { d.source.url = 'http://insecure.example'; }, /url must be an https URL/],
    [(d) => { d.schemaVersion = 2; }, /schemaVersion must be 1/],
  ];
  for (const [mutate, pattern] of cases) {
    const doc = overlay();
    mutate(doc);
    throwsMatching(() => validate(doc, context), pattern);
  }
});

check('an out-of-domain enum is rejected against the LIVE CHECK domains', () => {
  const domains = liveDomains();
  assert.ok(!domains.pattern.includes('core'), 'core is not a movement.pattern value');
  assert.deepEqual(domains.equipment.slice(-1), ['boards']);

  const badPattern = overlay();
  badPattern.records[15].changes.movement.pattern = 'core';
  throwsMatching(() => validate(badPattern, context), /pattern outside the live CHECK domain/);

  const badCategory = overlay();
  badCategory.records[16].changes.taxonomy.category = 'full_body';
  throwsMatching(() => validate(badCategory, context), /taxonomy.category outside the live CHECK domain/);

  const badItem = overlay();
  badItem.records[4].changes.equipment.required_items = ['sled'];
  throwsMatching(() => validate(badItem, context), /equipment item outside the post-049 CHECK domain/);

  const badDifficulty = overlay();
  badDifficulty.records[4].changes.detail = { difficulty_rating: 'Expert' };
  throwsMatching(() => validate(badDifficulty, context), /difficulty_rating outside the live CHECK domain/);
});

check('a media-shaped key anywhere in the overlay is rejected', () => {
  const MEDIA_KEYS = ['asset_key', 'assetKey', 'status', 'revision', 'video_placeholder_uri',
    'videoUrl', 'video_url', 'fallbackUrl', 'media', 'media_status', 'media_revision',
    'videoUri', 'thumbnail', 'poster'];
  // Every container, not just the records: the media prohibition is scanned
  // over the COMPLETE overlay root.
  const containers = [
    ['overlay root', (d, k) => { d[k] = 'x'; }],
    ['source', (d, k) => { d.source[k] = 'x'; }],
    ['build', (d, k) => { d.build[k] = 'x'; }],
    ['ratificationTemplate', (d, k) => { d.ratificationTemplate[k] = 'x'; }],
    ['record', (d, k) => { d.records[4][k] = 'x'; }],
    ['changes.coaching', (d, k) => { d.records[4].changes.coaching[k] = 'x'; }],
    ['source_ref', (d, k) => { d.records[4].source_ref[k] = 'x'; }],
    ['ratification', (d, k) => { d.records[4].ratification[k] = 'x'; }],
    ['scopeAssignment', (d, k) => { d.scopeAssignments[1][k] = 'x'; }],
  ];
  for (const [label, mutate] of containers) {
    for (const key of MEDIA_KEYS) {
      const doc = overlay();
      mutate(doc, key);
      try {
        throwsMatching(() => validate(doc, context), /media key is prohibited in the overlay/);
      } catch (error) {
        throw new Error(`${label}.${key}: ${error.message}`);
      }
    }
  }
  // Nested one level deeper than any schema reaches.
  const nested = overlay();
  nested.records[4].notes = [{ asset_key: 'movement/x/demo/v1' }];
  throwsMatching(() => validate(nested, context), /media key is prohibited in the overlay/);
});

check('the rendered migration writes no media table and no URL', () => {
  const sql = renderMigration(overlay(), liveDomains());
  for (const forbidden of ['movement_media', 'video_placeholder_uri', 'asset_key', 'http']) {
    assert.ok(!sql.includes(forbidden), `049 must not mention ${forbidden}`);
  }
});

check('tampering one character of approved copy invalidates the approval', () => {
  const doc = overlay();
  const record = doc.records.find((r) => r.name === 'Board Press');
  const before = record.correction_sha256;
  record.changes.coaching.cues[0] = 'Keep the boards banded and fixed!';
  assert.notEqual(correctionSha256(record), before);
  throwsMatching(() => validate(doc, context), /correction_sha256 does not reproduce/);
  // Re-derive the record hash but leave the approval bound to the old one:
  // this is exactly the "edited after approval" state the gate exists for.
  record.correction_sha256 = correctionSha256(record);
  throwsMatching(() => validate(doc, context), /approval record does not bind this record's current hash/);
});

check('tampering an approved equipment set invalidates the approval', () => {
  const doc = overlay();
  const record = doc.records.find((r) => r.name === 'Floor Glute-Ham Raise');
  record.changes.equipment.required_items = ['nordic_bench', 'bands'];
  record.correction_sha256 = correctionSha256(record);
  throwsMatching(() => validate(doc, context), /approval record does not bind this record's current hash/);
});

check('a missing approval record blocks generation outright', () => {
  const doc = overlay();
  doc.records[7].ratification = null;
  throwsMatching(() => validate(doc, context), /missing approval record/);
});

check('an approval asserting a clinical credential is rejected', () => {
  for (const mutate of [
    (d) => { d.records[7].ratification.approver_role = 'physiotherapist'; },
    (d) => { d.records[7].ratification.approval_basis = 'clinical_sign_off'; },
  ]) {
    const doc = overlay();
    mutate(doc);
    throwsMatching(() => validate(doc, context), /must assert owner authority/);
  }
});

check('every field of the approval must bind, not just the hash', () => {
  const cases = [
    [(d) => { d.records[7].ratification.approver_name = 'Someone Else'; },
      /approver_name must match overlay\.ratificationTemplate/],
    [(d) => { d.records[7].ratification.approved_on = '2020-01-01'; },
      /approved_on must equal overlay\.build\.approved_on/],
    [(d) => { d.records[7].ratification.correction_version = 2; },
      /correction_version must equal the record's own version/],
  ];
  for (const [mutate, pattern] of cases) {
    const doc = overlay();
    mutate(doc);
    throwsMatching(() => validate(doc, context), pattern);
  }
});

check('moving the build approval date invalidates every approval at once', () => {
  const doc = overlay();
  doc.build.approved_on = '2026-09-01';
  throwsMatching(() => validate(doc, context), /approved_on must equal overlay\.build\.approved_on/);
});

check('supersedes_v2_sha256 must equal the shipped v2 fingerprint', () => {
  const doc = overlay();
  const record = doc.records[0];
  assert.equal(record.supersedes_v2_sha256, context.v2Hashes.get(record.name));
  record.supersedes_v2_sha256 = 'a'.repeat(64);
  record.correction_sha256 = correctionSha256(record);
  record.ratification.correction_sha256 = record.correction_sha256;
  throwsMatching(() => validate(doc, context), /does not match the shipped v2 fingerprint/);
});

check('coaching copy stays claim-safe, positively cued, and inside the 160-char intent CHECK', () => {
  const banned = overlay();
  banned.records[0].changes.coaching.coaching_intent = 'This will prevent injury and heal the knee.';
  banned.records[0].correction_sha256 = correctionSha256(banned.records[0]);
  banned.records[0].ratification.correction_sha256 = banned.records[0].correction_sha256;
  throwsMatching(() => validate(banned, context), /banned claim/);

  const negative = overlay();
  negative.records[0].changes.coaching.cues[0] = 'Never let the knee cave';
  negative.records[0].correction_sha256 = correctionSha256(negative.records[0]);
  negative.records[0].ratification.correction_sha256 = negative.records[0].correction_sha256;
  throwsMatching(() => validate(negative, context), /positive intention/);

  const long = overlay();
  long.records[0].changes.coaching.coaching_intent = 'x'.repeat(161);
  long.records[0].correction_sha256 = correctionSha256(long.records[0]);
  long.records[0].ratification.correction_sha256 = long.records[0].correction_sha256;
  throwsMatching(() => validate(long, context), /1-160 characters/);
});

check('equipment.required_items is REPLACE-only: an empty list is refused, not treated as a clear', () => {
  const doc = overlay();
  const record = doc.records.find((r) => r.name === 'Board Press');
  record.changes.equipment.required_items = [];
  record.correction_sha256 = correctionSha256(record);
  record.ratification.correction_sha256 = record.correction_sha256;
  throwsMatching(() => validate(doc, context), /must be a non-empty array/);
});

check('the four ratified equipment replacements are exactly the plan sets', () => {
  const byName = new Map(overlay().records.map((r) => [r.name, r]));
  assert.deepEqual(byName.get('Board Press').changes.equipment.required_items,
    ['boards', 'bands', 'barbell', 'bench', 'squat_rack']);
  assert.deepEqual(byName.get('Floor Glute-Ham Raise').changes.equipment.required_items,
    ['nordic_bench']);
  assert.deepEqual(byName.get('Natural Glute Ham Raise').changes.equipment.required_items,
    ['nordic_bench', 'bands']);
  assert.deepEqual(byName.get('Seated Good Mornings').changes.equipment.required_items,
    ['barbell', 'squat_rack', 'bench']);
});

check('O1 corrects exactly the four identified overhead presses to push_v', () => {
  const pushV = overlay().records
    .filter((r) => r.changes.movement?.pattern === 'push_v')
    .map((r) => r.name)
    .sort();
  assert.deepEqual(pushV, [
    'Kettlebell Seated Press',
    'Seated Dumbbell Press',
    'Standing Dumbbell Press',
    'Standing Palm-In One-Arm Dumbbell Press',
  ]);
});

check('O4 routes the Lunge-style TGU to rotation/core and never to lunge', () => {
  const tgu = overlay().records.find((r) => r.name === 'Kettlebell Turkish Get-Up (Lunge style)');
  assert.equal(tgu.changes.movement.pattern, 'rotation');
  assert.equal(tgu.changes.movement.is_compound, 1);
  assert.equal(tgu.changes.taxonomy.category, 'core');
  assert.equal(tgu.changes.taxonomy.family, 'turkish_get_up');
  assert.ok(!JSON.stringify(tgu.changes).includes('lunge'));
});

check('the O2 alias pair carries a byte-identical literal payload', () => {
  const byName = new Map(overlay().records.map((r) => [r.name, r]));
  const a = byName.get('Hammer Grip Incline DB Bench Press').changes.coaching;
  const b = byName.get('Incline Dumbbell Bench With Palms Facing In').changes.coaching;
  assert.deepEqual(a, b);
});

if (process.exitCode) process.exit(process.exitCode);
console.log(`library-correction generator — all ${passed} checks green`);
