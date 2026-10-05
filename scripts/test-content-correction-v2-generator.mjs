/**
 * test-content-correction-v2-generator.mjs — negative controls for the content
 * correction v2 generator (coaching work order 4). Each case tampers with ONE
 * thing in a valid overlay and requires the validator to refuse it.
 *
 * Run: npm run verify:coaching-content-generator
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ANIMATION_LANE_NAMES,
  correctionHash,
  loadContext,
  renderMigration,
  validateCorrectionV2,
} from './generate-content-correction-v2.mjs';

const ROOT = join(import.meta.dirname, '..');
const overlay = JSON.parse(readFileSync(join(ROOT, 'packages', 'core-db', 'staging', 'movement_content_correction_v2.json'), 'utf8'));
const context = loadContext();

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const reseal = (record) => ({ ...record, correction_sha256: correctionHash(record) });
/** Tamper with the first record, reseal it (so only the intended rule can refuse it), and validate. */
const refuses = (mutate, pattern, { resealed = true } = {}) => {
  const copy = clone(overlay);
  const mutated = mutate(copy.records[0], copy) ?? copy.records[0];
  copy.records[0] = resealed ? reseal(mutated) : mutated;
  const { errors } = validateCorrectionV2(copy, context);
  return errors.some((error) => pattern.test(error)) ? '' : `not refused: ${errors.slice(0, 2).join(' | ') || 'no errors'}`;
};
const expectRefused = (label, mutate, pattern, options) => {
  const detail = refuses(mutate, pattern, options);
  check(label, detail === '', detail);
};

console.log('[1] the shipped overlay');
{
  const { errors } = validateCorrectionV2(overlay, context);
  check('the staged overlay is valid as shipped', errors.length === 0, errors.slice(0, 2).join(' | '));
  check('it is coaching text only and declares media excluded',
    overlay.mediaExcluded === true && overlay.records.every((record) => Object.keys(record.changes).join(',') === 'coaching'));
  check('it says honestly that no owner approval has been given',
    overlay.ratification.state === 'pending_owner_review' && overlay.records.every((record) => record.ratification === null));
  check('the two animation-lane movements are not in it',
    ANIMATION_LANE_NAMES.every((name) => !overlay.records.some((record) => record.name === name)));
  check('no record is one correction v1 already made', overlay.records.every((record) => !context.v1Names.has(record.name)));
}

console.log('[2] generated SQL');
{
  const sql = renderMigration(overlay);
  const statements = sql.split('\n').filter((line) => /^(UPDATE|INSERT|DELETE|CREATE|DROP|ALTER)\b/.test(line));
  check('only UPDATEs of the three coaching columns and one provenance INSERT are generated',
    statements.length === overlay.records.length * 2 + 1
      && statements.filter((line) => line.startsWith('UPDATE movement_detail SET instructions = ')).length === overlay.records.length
      && statements.filter((line) => line.startsWith('UPDATE movement_coaching_intent SET coaching_intent = ')).length === overlay.records.length
      && statements.filter((line) => line.startsWith('INSERT OR IGNORE INTO movement_content_correction')).length === 1);
  check('no movement name, id, pattern, taxonomy, equipment or media table is written',
    !/\b(?:UPDATE|INSERT\s+(?:OR\s+\w+\s+)?INTO|DELETE\s+FROM)\s+(?:movement|movement_taxonomy|movement_equipment|movement_media|movement_scope|movement_progression|movement_muscle_role)\b(?!_)/.test(sql)
      && !/video_placeholder_uri|asset_key|difficulty_rating|target_muscles|base_name|supported_prefixes/.test(sql));
  check('every movement is addressed by name and never by a literal id', !/movement_id\s*=\s*\d/.test(sql));
  check('the output is deterministic', renderMigration(clone(overlay)) === sql);
  check('apostrophes in text are escaped', sql.includes("arm''s length") && !/[a-z]'s length/.test(sql));
}

console.log('[3] refusals');
expectRefused('a movement that belongs to the animation lane is refused',
  (record) => { record.name = ANIMATION_LANE_NAMES[0]; }, /animation lane/);
expectRefused('a movement already corrected by v1 is refused',
  (record) => { record.name = [...context.v1Names][0]; }, /already corrected by correction v1/);
expectRefused('a name that is not a staged v2 movement is refused',
  (record) => { record.name = 'Competition Squat'; }, /not a staged v2 movement/);
{
  // Every uncorrected staged v2 row IS the template today, so the case is made
  // by giving one of them specific text in a copy of the context.
  const name = overlay.records[0].name;
  const staged = new Map(context.staged);
  staged.set(name, { ...staged.get(name), setupSteps: ['Stand tall with the bar across the back.', 'Lower under control.'] });
  const { errors } = validateCorrectionV2(overlay, { ...context, staged });
  check('a movement whose current text is not the shared template is refused',
    errors.some((error) => /not the shared template/.test(error)));
}
expectRefused('a wrong superseded fingerprint is refused',
  (record) => { record.supersedes_v2_sha256 = '0'.repeat(64); }, /supersedes_v2_sha256/);
expectRefused('a change outside the coaching domain is refused',
  (record) => { record.changes.movement = { pattern: 'squat' }; }, /coaching domain only/, { resealed: false });
expectRefused('a prohibition in a cue is refused',
  (record) => { record.changes.coaching.cues[0] = 'Never let the elbows flare.'; }, /positive-intention/);
expectRefused('a medical or outcome claim is refused',
  (record) => { record.changes.coaching.setup_steps[0] = 'This guarantee of a pain-free shoulder starts with the setup.'; }, /prohibited medical or outcome claim/);
expectRefused('five steps are refused',
  (record) => { record.changes.coaching.setup_steps = ['One.', 'Two.', 'Three.', 'Four.', 'Five.']; }, /2\.\.4 one-sentence steps/);
expectRefused('a step that is two sentences is refused',
  (record) => { record.changes.coaching.setup_steps[0] = 'Stand tall. Then brace.'; }, /2\.\.4 one-sentence steps/);
expectRefused('a duplicated cue is refused',
  (record) => { record.changes.coaching.cues = ['Lower slowly.', 'LOWER SLOWLY.']; }, /distinct/);
expectRefused('an over-long intent is refused',
  (record) => { record.changes.coaching.coaching_intent = `${'Train the arms '.repeat(12)}.`; }, /1\.\.160 characters/);
expectRefused('a replacement that is still the shared template is refused',
  (record) => { record.changes.coaching.setup_steps[0] = `Set up ${record.name} with a load you can control.`; }, /still the shared template/);
expectRefused('a media-shaped value is refused',
  (record) => { record.changes.coaching.cues[0] = 'Open the videoUrl link first.'; }, /must not carry media/);
expectRefused('a record with no upstream evidence is refused',
  (record) => { record.source_ref.upstream_instructions_sha256 = 'f'.repeat(64); }, /source_ref does not point at the evidence text/);
expectRefused('edited text without a new hash is refused',
  (record) => { record.changes.coaching.cues[0] = 'Move with control.'; }, /correction_sha256 does not reproduce/, { resealed: false });
expectRefused('a pending set that smuggles in a per-record approval is refused',
  (record) => { record.ratification = { approver_role: 'owner', correction_sha256: record.correction_sha256 }; }, /must not carry a per-record approval/, { resealed: false });
expectRefused('an "approved" set without an owner approval bound to each hash is refused',
  (record, copy) => { copy.ratification.state = 'owner_approved'; }, /owner approval bound to this record/, { resealed: false });
expectRefused('a duplicate record is refused',
  (record, copy) => { copy.records.push(clone(copy.records[0])); }, /duplicate record/, { resealed: false });
{
  const tampered = new Map(context.evidence);
  const first = overlay.records[0].name;
  tampered.set(first, { ...tampered.get(first), instructions_raw: `${tampered.get(first).instructions_raw} (edited)` });
  const { errors } = validateCorrectionV2(overlay, { ...context, evidence: tampered });
  check('edited evidence text is detected', errors.some((error) => /does not match its own hash/.test(error)));
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
