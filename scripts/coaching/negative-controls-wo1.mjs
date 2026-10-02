// Negative controls for work order 1: each mutation removes ONE fix and runs the
// gate that is supposed to notice. A mutation that is NOT detected is a weak test.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const run = (command) => spawnSync(command, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const jest = (file) => `npx jest --config apps/mobile/jest.config.js --runInBand apps/mobile/test/components/${file}`;
const BUILD = 'npx tsc --strict --target es2020 --module commonjs --lib es2020 --outDir packages/inference/test/.build packages/inference/src/sessionTimeBudget.ts packages/inference/src/preparationPolicy.ts packages/inference/src/blockGenerator.ts packages/inference/src/routineMicrocycle.ts packages/inference/src/routineComposer.ts';
const MIG = 'npx tsc --strict --target es2020 --module commonjs --lib es2020 --outDir packages/core-db/test/.build packages/core-db/src/migrationRunner.ts && node packages/core-db/test/verify_migrations.mjs';

const mutations = [
  {
    name: 'M1 remove the logSet preparation gate',
    file: 'apps/mobile/src/state/useStore.ts',
    from: `    if (preparationOpenForSession(getDb(), s.sessionId)) {
      set({ error: PREPARATION_GATE_MESSAGE });
      return;
    }`,
    to: '',
    gate: jest('SessionPreparation.test.js'),
  },
  {
    name: 'M2 do not create preparation in the start transaction',
    file: 'apps/mobile/src/state/useStore.ts',
    from: `      const preparation = insertSessionPreparation(d, {
        sessionId,
        startedAtMs,
        instanceId: \`prep-\${sessionId}-\${startedAtMs}-\${Math.floor(Math.random() * 1e9).toString(36)}\`,
        protocol: preparationProtocol,
      });`,
    to: `      const preparation = null;`,
    gate: jest('SessionPreparation.test.js'),
  },
  {
    name: 'M3 drop the instance id from the compare-and-set (revision only)',
    file: 'apps/mobile/src/state/preparationStore.ts',
    from: `      WHERE session_id = ? AND instance_id = ? AND revision = ?
        AND status IN ('pending','in_progress')
        AND session_started_at_ms = (SELECT started_at_ms FROM session WHERE session_id = ?)\`,
    [
      status, nowMs, isTerminalPreparationStatus(status) ? 1 : 0, nowMs,
      identity.sessionId, identity.instanceId, expectedRevision, identity.sessionId,
    ],`,
    to: `      WHERE session_id = ? AND revision = ?
        AND status IN ('pending','in_progress')
        AND session_started_at_ms = (SELECT started_at_ms FROM session WHERE session_id = ?)\`,
    [
      status, nowMs, isTerminalPreparationStatus(status) ? 1 : 0, nowMs,
      identity.sessionId, expectedRevision, identity.sessionId,
    ],`,
    alsoFrom: `      WHERE p.session_id = ? AND p.instance_id = ? AND p.revision = ?
        AND p.status IN ('pending','in_progress')\`,
    [identity.sessionId, identity.instanceId, expectedRevision],`,
    alsoTo: `      WHERE p.session_id = ? AND p.revision = ?
        AND p.status IN ('pending','in_progress')\`,
    [identity.sessionId, expectedRevision],`,
    gate: jest('SessionPreparation.test.js'),
  },
  {
    name: 'M4 do not clear a stale protocol before inserting (reused id, FK off)',
    file: 'apps/mobile/src/state/preparationStore.ts',
    from: `  const { sessionId, startedAtMs, instanceId, protocol } = input;
  deleteSessionPreparation(db, sessionId);`,
    to: `  const { sessionId, startedAtMs, instanceId, protocol } = input;`,
    gate: jest('SessionPreparation.test.js'),
  },
  {
    name: 'M5 halting does not stop an open protocol',
    file: 'apps/mobile/src/state/useStore.ts',
    from: `      if (runnerChanged) persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);
      stopOpenSessionPreparation(d, session.sessionId, haltAtMs);`,
    to: `      if (runnerChanged) persistRunnerCheckpoint(d, session.sessionId, sessionMode, nextRunner);`,
    gate: jest('SessionPreparation.test.js'),
  },
  {
    name: 'M6 no execution-time recheck of holds and niggles',
    file: 'apps/mobile/src/state/useStore.ts',
    from: `      if (restriction !== null) effective = { status: 'withheld', reasonCode: 'restricted_at_execution' };`,
    to: `      restriction = null;`,
    gate: jest('SessionPreparation.test.js'),
  },
  {
    name: 'M7 reset leaves preparation rows behind',
    file: 'apps/mobile/src/state/useStore.ts',
    from: `      deleteAllSessionPreparation(d);
      d.executeSync('DELETE FROM session_runner_checkpoint');`,
    to: `      d.executeSync('DELETE FROM session_runner_checkpoint');`,
    gate: jest('SessionPreparation.test.js'),
  },
  {
    name: 'M8 held movement ids 135/187 are not excluded by the policy',
    file: 'packages/inference/src/preparationPolicy.ts',
    from: `    const held = PREPARATION_HELD_MOVEMENT_IDS.get(slot.movementId);
    if (held !== undefined) {`,
    to: `    const held = PREPARATION_HELD_MOVEMENT_IDS.get(slot.movementId);
    if (held !== undefined && slot.movementId < 0) {`,
    gate: `${BUILD} && node packages/inference/test/verify_preparation.mjs`,
  },
  {
    name: 'M9 block generator returns to clamp(round(cap / 22), 2, 5)',
    file: 'packages/inference/src/sessionTimeBudget.ts',
    from: `  const mainWorkMin = normalizedCapMin(capMin) - PREPARATION_FLOOR_MIN;
  return clamp(Math.round(mainWorkMin / LEGACY_MINUTES_PER_SLOT), 1, MAX_SESSION_SLOTS);`,
    to: `  return clamp(Math.round(normalizedCapMin(capMin) / LEGACY_MINUTES_PER_SLOT), 2, MAX_SESSION_SLOTS);`,
    gate: `${BUILD} && node packages/inference/test/verify_session_time.mjs`,
  },
  {
    name: 'M10 routine microcycle does not reserve preparation',
    file: 'packages/inference/src/routineMicrocycle.ts',
    from: `    const durationCap = sessionCap - preparationMin;`,
    to: `    const durationCap = sessionCap;`,
    gate: `${BUILD} && node packages/inference/test/verify_session_time.mjs`,
  },
  {
    name: 'M11 routine composer does not reserve preparation',
    file: 'packages/inference/src/routineComposer.ts',
    from: `  const durationCap = sessionCap - preparationMin;`,
    to: `  const durationCap = sessionCap;`,
    gate: `${BUILD} && node packages/inference/test/verify_session_time.mjs`,
  },
  {
    name: 'M12 the cross-table item trigger is not replay-blocking',
    file: 'packages/core-db/src/migrationRunner.ts',
    from: `  'trg_session_preparation_item_open_bu',     // 065 -> session_preparation\n`,
    to: '',
    gate: MIG,
  },
  {
    name: 'M13 a finished session may acquire preparation (live-session guard dropped)',
    file: 'packages/core-db/src/schema/065_session_preparation.sql',
    from: `      AND s.duration_min IS NULL
  )`,
    to: `  )`,
    gate: MIG,
  },
  {
    name: 'M14 staged restore copies are not checked against their source schema fingerprint',
    file: 'apps/mobile/src/state/backupStore.ts',
    from: `    if (!matchesBackupSchemaContract(schemaContract(handle), sourceContract, mobileBackupCrypto)) {
      throw new Error('A restored database does not match the verified app schema. Existing data is unchanged.');
    }`,
    to: '',
    gate: jest('BackupForwardRestore.test.js'),
  },
  {
    name: 'M15 a migrated copy is accepted without matching the current schema',
    file: 'apps/mobile/src/state/backupStore.ts',
    from: `    migrate(handle);
    if (!quickCheck(handle)
      || oneNumber(handle, 'PRAGMA user_version', 'user_version') !== SCHEMA_VERSION) {
      throw new Error(failureMessage);
    }
    requireCurrentSchema(handle, failureMessage);`,
    to: `    if (!quickCheck(handle)) throw new Error(failureMessage);`,
    gate: jest('BackupForwardRestore.test.js'),
  },
  {
    name: 'M16 a longer session is offered without planning the block at that length',
    file: 'packages/inference/src/blockGenerator.ts',
    from: `    if (!conflictFree({ ...input, profile: { ...input.profile, session_duration_cap_min: candidateCap } })) continue;`,
    to: '',
    gate: `${BUILD} && node packages/inference/test/verify_session_time.mjs`,
  },
  {
    name: 'M17 the transition guard only fires when status or revision is named',
    file: 'packages/core-db/src/schema/065_session_preparation.sql',
    from: `BEFORE UPDATE ON session_preparation
WHEN NEW.revision <> OLD.revision + 1`,
    to: `BEFORE UPDATE OF status, revision ON session_preparation
WHEN NEW.revision <> OLD.revision + 1`,
    gate: MIG,
  },
  {
    name: 'M18 a recorded outcome can still be rewritten under the same status',
    file: 'packages/core-db/src/schema/065_session_preparation.sql',
    from: `  OR OLD.status NOT IN ('pending','in_progress')
  OR (OLD.status = 'in_progress' AND NEW.status = 'pending')`,
    to: `  OR (OLD.status NOT IN ('pending','in_progress') AND NEW.status <> OLD.status)
  OR (OLD.status = 'in_progress' AND NEW.status = 'pending')`,
    gate: MIG,
  },
];

const only = process.argv[2];
const results = [];
for (const mutation of mutations) {
  if (only !== undefined && !mutation.name.startsWith(only)) continue;
  const original = fs.readFileSync(mutation.file, 'utf8');
  let mutated = original;
  for (const [from, to] of [[mutation.from, mutation.to], [mutation.alsoFrom, mutation.alsoTo]]) {
    if (from === undefined) continue;
    if (mutated.split(from).length !== 2) { results.push({ name: mutation.name, outcome: 'ANCHOR NOT FOUND' }); mutated = null; break; }
    mutated = mutated.replace(from, () => to);
  }
  if (mutated === null) continue;
  fs.writeFileSync(mutation.file, mutated);
  let result;
  try { result = run(mutation.gate); } finally { fs.writeFileSync(mutation.file, original); }
  const output = `${result.stdout}\n${result.stderr}`;
  const failed = (output.match(/^\s*(?:FAIL|×|✕)\s.*$/gm) ?? []).slice(0, 4).map((line) => line.trim().slice(0, 150));
  results.push({ name: mutation.name, outcome: result.status === 0 ? 'NOT DETECTED' : 'detected', exit: result.status, sample: failed });
  console.log(JSON.stringify(results.at(-1)));
}
// Rebuild the unmutated verifier outputs.
run(BUILD);
run('npx tsc --strict --target es2020 --module commonjs --lib es2020 --outDir packages/core-db/test/.build packages/core-db/src/migrationRunner.ts');
console.log('SUMMARY', JSON.stringify(results.map((row) => [row.name, row.outcome])));
