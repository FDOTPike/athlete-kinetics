// Verifies the off-phone beta backup reader against a SYNTHETIC encrypted backup
// sealed with the package's own sealBackup. Local only: not part of verify:ci.
// Run with: npm run verify:beta-reader
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileContract } from '../lib/compile_contract.mjs';
import { readBackup } from '../lib/read_backup.mjs';
import { makeSyntheticBackup, SYNTHETIC_MANIFEST, SYNTHETIC_PASSWORD } from './make_synthetic_backup.mjs';

const testDir = dirname(fileURLToPath(import.meta.url));
const toolDir = resolve(testDir, '..');
const repoRoot = resolve(toolDir, '..', '..');
const cli = join(toolDir, 'read_beta_backup.mjs');
const work = mkdtempSync(join(tmpdir(), 'ak-beta-reader-verify-'));
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const textOf = (file) => readFileSync(file, 'utf8');
const expectCounts = (actual, expected) => {
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(actual[key], value, `counts.${key} must be ${JSON.stringify(value)}`);
  }
};
let checks = 0;
const pass = (message) => { checks += 1; console.log(`PASS ${message}`); };

try {
  const backup = await compileContract({ repoRoot, outDir: join(work, 'contract-build') });
  const synthetic = await makeSyntheticBackup({ repoRoot, work, backup });
  const { pmbakPath, damagedPmbakPath, manifestPath, noTimestampManifestPath } = synthetic;
  const pmbakSha = sha256(pmbakPath);
  const withPassword = (password, extra = {}) => ({
    backupPath: pmbakPath, manifestPath, workBase: work, repoRoot, ...extra,
    promptPassword: async () => password,
  });

  // 1. Refusals that never read the backup: password on argv, password in the
  // environment, and no terminal for the prompt.
  const argvRun = spawnSync(process.execPath, [cli, '--backup', pmbakPath, '--manifest', manifestPath, '--out', join(work, 'cli-argv'), '--password', SYNTHETIC_PASSWORD], { encoding: 'utf8', input: '' });
  assert.equal(argvRun.status, 2);
  assert.match(argvRun.stderr, /never accepted on the command line/);
  assert.equal(existsSync(join(work, 'cli-argv')), false);
  const equalsRun = spawnSync(process.execPath, [cli, '--backup', pmbakPath, '--manifest', manifestPath, '--out', join(work, 'cli-equals'), `--password=${SYNTHETIC_PASSWORD}`], { encoding: 'utf8', input: '' });
  assert.equal(equalsRun.status, 2);
  assert.match(equalsRun.stderr, /never accepted on the command line/);
  assert.equal(`${equalsRun.stdout}${equalsRun.stderr}`.includes(SYNTHETIC_PASSWORD), false, 'the password must never be echoed');
  assert.equal(existsSync(join(work, 'cli-equals')), false);
  const envRun = spawnSync(process.execPath, [cli, '--backup', pmbakPath, '--manifest', manifestPath, '--out', join(work, 'cli-env')], {
    encoding: 'utf8', input: '', env: { ...process.env, AK_BACKUP_PASSWORD: SYNTHETIC_PASSWORD, BACKUP_PASSWORD: SYNTHETIC_PASSWORD },
  });
  assert.equal(envRun.status, 2);
  assert.match(envRun.stderr, /interactive terminal/);
  assert.equal(existsSync(join(work, 'cli-env')), false);
  pass('password refused on argv, ignored in the environment, prompt needs a terminal; nothing written');

  // 2. Output inside the repository is refused before any password is asked for.
  const insideRepo = join(repoRoot, 'tools', 'beta-reader', 'refused-output-check');
  let prompts = 0;
  await assert.rejects(() => readBackup({ ...withPassword(SYNTHETIC_PASSWORD, { outDir: insideRepo }), promptPassword: async () => { prompts += 1; return SYNTHETIC_PASSWORD; } }),
    (error) => error.code === 'output_inside_repository');
  assert.equal(existsSync(insideRepo), false);
  assert.equal(prompts, 0);
  pass('output inside the repository refused before the password prompt');

  // 3. A manifest that lists a non-consenting athlete is refused before the prompt.
  const badManifest = join(work, 'manifest-not-consenting.json');
  writeFileSync(badManifest, JSON.stringify({ manifestVersion: 1, entries: [{ ...SYNTHETIC_MANIFEST.entries[0], consented: false }] }));
  prompts = 0;
  await assert.rejects(() => readBackup({ ...withPassword(SYNTHETIC_PASSWORD, { outDir: join(work, 'out-bad-manifest'), manifestPath: badManifest }), promptPassword: async () => { prompts += 1; return SYNTHETIC_PASSWORD; } }),
    (error) => error.code === 'manifest_invalid');
  assert.equal(prompts, 0);
  pass('manifest with a non-consenting entry refused before the password prompt');

  // 4. A manifest naming an athlete the backup does not contain is refused.
  const unknownManifest = join(work, 'manifest-unknown.json');
  writeFileSync(unknownManifest, JSON.stringify({ manifestVersion: 1, entries: [{ ...SYNTHETIC_MANIFEST.entries[0], athleteId: 'zz99' }] }));
  await assert.rejects(() => readBackup(withPassword(SYNTHETIC_PASSWORD, { outDir: join(work, 'out-unknown'), manifestPath: unknownManifest })),
    (error) => error.code === 'athlete_not_in_backup');
  assert.equal(existsSync(join(work, 'out-unknown')), false);
  pass('manifest athlete missing from the backup is refused');

  // 5. Wrong password: authentication fails and nothing is written.
  const wrongOut = join(work, 'out-wrong');
  await assert.rejects(() => readBackup(withPassword('not the password at all', { outDir: wrongOut })),
    (error) => error.code === 'authentication_failed');
  assert.equal(existsSync(wrongOut), false);
  pass('wrong password gives authentication_failed and writes nothing');

  // 6. Happy path: correct password, two consenting athletes, one quarantined.
  const happyOut = join(work, 'out-happy');
  prompts = 0;
  const happy = await readBackup({ ...withPassword(SYNTHETIC_PASSWORD, { outDir: happyOut, label: 'synthetic' }), promptPassword: async () => { prompts += 1; return SYNTHETIC_PASSWORD; } });
  assert.equal(prompts, 1, 'the password is asked for exactly once');
  assert.equal(happy.freeTextPath, null, 'free text is not written unless asked for');
  assert.equal(sha256(pmbakPath), pmbakSha, 'the backup file is never written to');
  assert.equal(readdirSync(work).filter((name) => name.startsWith('ak-beta-reader-')).length, 0, 'the disposable decoded copies are deleted');
  const aggregate = JSON.parse(textOf(happy.aggregatePath));
  const priv = JSON.parse(textOf(happy.privatePath));
  assert.equal(aggregate.input.backupSha256, pmbakSha);
  assert.equal(aggregate.input.sourceSchemaVersion, 76);
  assert.equal(aggregate.input.sourceMigrationSlot, 77);
  assert.deepEqual(aggregate.athletes, { consented: 2, quarantined: 1, totalInBackup: 3 });
  assert.deepEqual(aggregate.integrity, { athletesChecked: 2, integrityOk: 2, foreignKeyViolationRows: 0, schemaMatchesDeclaredContract: 2 });
  pass('input hash, slot 77 / version 76, consent counts and integrity checks as expected');

  const q = aggregate.queries;
  assert.equal(q.session_inventory.status, 'ok');
  expectCounts(q.session_inventory.counts, {
    started: 5, finalized: 4, unfinished: 1, unaccounted: 0,
    byOutcomeKind: { followed_plan: 1, adapted_session: 1, stopped_safely: 1, session_recorded: 1 },
    byTrainingAge: { beginner: 0, intermediate: 4, advanced: 0, elite: 0 },
  });
  // Completion: finalized slots only (1001 x2, 1002, 1004 and B's 2001). Capped
  // completion = min(logged, planned). The skipped slot of 1001 is a recorded skip.
  assert.equal(q.completion_per_slot.status, 'ok');
  expectCounts(q.completion_per_slot.counts, {
    slots: 5, plannedSets: 12, completedSetsCapped: 8, extraSets: 0, missingSets: 4,
    missingRecordedSkip: 2, missingNoRecordedSkip: 2, missingUnknownSkip: 0,
    slotsRecordedSkipYes: 1, slotsRecordedSkipNo: 4, slotsRecordedSkipUnknown: 0, slotsZeroLogged: 1,
  });
  assert.equal(q.completion_per_slot.counts.byProvenance.planned.plannedSets, 12);
  assert.equal(q.unmapped_sets.status, 'ok');
  expectCounts(q.unmapped_sets.counts, { unmappedOrCrossSlotSets: 1 });
  assert.equal(q.loads_shown.status, 'ok');
  expectCounts(q.loads_shown.counts, {
    sets: 9, unrecorded: 6, blank: 1, numeric: 2, numericDiffZero: 1, numericDiffPositive: 1, numericDiffNegative: 0,
    bySource: { seeded: 1, history: 1, manual: 1, derived: 0 },
  });
  // Effort: RPE 6 floor, explicit reps dose. Pairs counted, no estimate computed.
  assert.equal(q.effort.status, 'ok');
  expectCounts(q.effort.counts, {
    loggedSets: 9, answered: 8, unanswered: 1, eligibleSets: 6, excludedUnrated: 1, excludedBelowFloor: 1,
    excludedNoRepsDose: 1, excludedNonPositive: 0, excludedOutOfDomain: 0, withinSessionPairs: 3, crossSessionPairs: 1,
  });
  assert.equal(q.effort.counts.estimatesComputed, undefined, 'no estimate field exists in the output');
  assert.equal(q.session_feel.status, 'ok');
  expectCounts(q.session_feel.counts, {
    finalizedSessions: 4, feelRecorded: 4, feelAbsent: 0, noteRecorded: 2, noteAbsent: 2,
    byFeel: { as_planned: 1, harder: 1, easier: 1, stopped_early: 1 },
    reasons: { pain: 1, tired: 1, unwell: 0, technique: 0, equipment: 0, time: 0, felt_good: 1, other: 0 },
  });
  assert.equal(q.symptom_reports.status, 'ok');
  expectCounts(q.symptom_reports.counts, {
    reports: 4, matched: 2, unmatched: 2, halt: 1, loadModifierApplied: 1, setModifierApplied: 1, rpeCapApplied: 1,
  });
  assert.equal(q.attribution.status, 'ok');
  expectCounts(q.attribution.counts, { slots: 6, slotsWithSource: 6, unavailable: 6, byReason: { eased: 0, raised: 0, held_safety: 0 } });
  assert.equal(q.question_log.status, 'ok');
  expectCounts(q.question_log.counts, { questions: 4, byOutcome: { card: 1, none: 2, refer: 1 }, blankText: 0 });
  pass('de-identified aggregate counts match the hand-computed values for every reading-plan query');

  // Per-athlete private file: the same queries, split by participant code.
  assert.equal(priv.athletes.length, 2);
  const a = priv.athletes.find((athlete) => athlete.participantCode === 'SYN-01');
  const b = priv.athletes.find((athlete) => athlete.participantCode === 'SYN-02');
  assert.ok(a && b, 'the private file names each consenting athlete by participant code only');
  expectCounts(a.queries.session_inventory.counts, { started: 4, finalized: 3, unfinished: 1 });
  expectCounts(a.queries.effort.counts, { eligibleSets: 4, excludedUnrated: 1, excludedBelowFloor: 1, withinSessionPairs: 2, crossSessionPairs: 1 });
  expectCounts(a.queries.loads_shown.counts, { sets: 6, unrecorded: 3, blank: 1, numeric: 2 });
  expectCounts(b.queries.effort.counts, { eligibleSets: 2, excludedNoRepsDose: 1, withinSessionPairs: 1, crossSessionPairs: 0 });
  expectCounts(b.queries.unmapped_sets.counts, { unmappedOrCrossSlotSets: 1 });
  pass('per-athlete private file splits the counts by participant code');

  // Privacy: no names, no participant codes in the aggregate, no free text anywhere.
  const aggregateText = textOf(happy.aggregatePath);
  const privateText = textOf(happy.privatePath);
  for (const forbidden of ['SYN-01', 'SYN-02', 'SYN-03', 'Synthetic Athlete', 'private-', 'athlete_kinetics', 'ak_athlete', 'c789']) {
    assert.equal(aggregateText.includes(forbidden), false, `aggregate must not contain ${forbidden}`);
  }
  for (const forbidden of ['Synthetic Athlete', 'SYN-03', 'c789', 'private-']) {
    assert.equal(privateText.includes(forbidden), false, `private per-athlete file must not contain ${forbidden} without the free-text switch`);
  }
  pass('aggregate and per-athlete files hold no names, no quarantined athlete, no free text');

  // Free text only with the explicit switch, and only in its own file.
  const freeOut = join(work, 'out-free');
  const free = await readBackup(withPassword(SYNTHETIC_PASSWORD, { outDir: freeOut, label: 'synthetic-free', includeFreeText: true }));
  const freeText = textOf(free.freeTextPath);
  for (const needle of ['private-note-A-1001', 'private-note-A-1004', 'private-report-A-1', 'private-report-A-3', 'private-question-A-1', 'private-report-B-1', 'private-question-B-1']) {
    assert.ok(freeText.includes(needle), `free-text file must hold ${needle}`);
  }
  for (const forbidden of ['private-question-A-outside', 'private-note-C-3001', 'private-question-C-1', 'private-report-C-1']) {
    assert.equal(freeText.includes(forbidden), false, `free-text file must not hold ${forbidden} (outside the window or quarantined)`);
  }
  assert.equal(textOf(free.aggregatePath).includes('private-'), false, 'free text never reaches the aggregate');
  assert.equal(textOf(free.privatePath).includes('private-'), false, 'free text never reaches the per-athlete file');
  pass('free text appears only in its own file, only inside the window, and never for a quarantined athlete');

  // Missing timestamp bounds: the timestamp queries are not run, never zero.
  const noMsOut = join(work, 'out-no-timestamps');
  const noMs = await readBackup(withPassword(SYNTHETIC_PASSWORD, { outDir: noMsOut, label: 'no-timestamps', manifestPath: noTimestampManifestPath }));
  const noMsAggregate = JSON.parse(textOf(noMs.aggregatePath));
  const noMsPrivate = JSON.parse(textOf(noMs.privatePath));
  assert.equal(noMsAggregate.queries.symptom_reports.status, 'incomplete');
  assert.equal(noMsAggregate.queries.symptom_reports.counts, undefined, 'a query that did not run has no counts, not zeros');
  assert.equal(noMsAggregate.queries.question_log.status, 'incomplete');
  assert.equal(noMsAggregate.queries.session_inventory.status, 'ok');
  assert.equal(noMsPrivate.athletes[0].queries.symptom_reports.status, 'not_run');
  assert.equal(noMsPrivate.athletes[0].queries.symptom_reports.reason, 'no_timestamp_bounds');
  pass('timestamp queries are reported not_run without bounds in the manifest, never as zero');

  // Output files are never overwritten.
  await assert.rejects(() => readBackup(withPassword(SYNTHETIC_PASSWORD, { outDir: happyOut, label: 'synthetic' })),
    (error) => error.code === 'output_exists');
  pass('a second run into the same folder with the same label is refused');

  // A backup whose athlete schema does not match the declared contract fails closed.
  const damagedOut = join(work, 'out-damaged');
  await assert.rejects(() => readBackup(withPassword(SYNTHETIC_PASSWORD, { outDir: damagedOut, backupPath: damagedPmbakPath })),
    (error) => error.code === 'schema_mismatch');
  assert.equal(existsSync(damagedOut), false);
  pass('an athlete database that does not match the contract fails closed with schema_mismatch');

  assert.equal(readdirSync(work).filter((name) => name.startsWith('ak-beta-reader-')).length, 0, 'every run deletes its disposable copies');

  // The reading plan describes this reader as it ships: it names the CLI and its
  // crypto adapter, no longer says no reader is installed, and says the reader
  // counts eligible effort pairs without forming an estimate.
  const plan = textOf(join(repoRoot, 'docs', 'release', 'beta', 'plan', 'LOG_READING_PLAN.md'));
  assert.equal(plan.includes('There is no claim that such a CLI is already installed'), false, 'the plan must not say no reader is installed');
  assert.match(plan, /tools\/beta-reader\/read_beta_backup\.mjs/, 'the plan must name the reader CLI');
  assert.match(plan, /tools\/beta-reader\/lib\/node_crypto\.mjs/, 'the plan must name the reader crypto adapter');
  assert.match(plan, /does not call `estimateOneRepMax`/, 'the plan must say the reader forms no estimate');
  pass('the reading plan describes the shipped reader and its effort counts');

  console.log(`verify:beta-reader PASS - ${checks} checks: synthetic backup sealed with the package's sealBackup, opened with openBackup, read-only analysis, de-identified outputs`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
