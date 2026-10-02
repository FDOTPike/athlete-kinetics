// Negative controls for work order 2: each mutation removes ONE fix and runs the
// gate that is supposed to notice. A mutation that is NOT detected is a weak test.
//
//   node scripts/coaching/negative-controls-wo2.mjs          # all
//   node scripts/coaching/negative-controls-wo2.mjs N3       # one
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const run = (command) => spawnSync(command, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// --no-cache: a stale transform cache once served an older copy of a migration.
const jest = (file) => `npx jest --config apps/mobile/jest.config.js --runInBand --no-cache apps/mobile/test/components/${file}`;
const BUILD = 'npx tsc --strict --target es2020 --module commonjs --lib es2020 --outDir packages/inference/test/.build packages/inference/src/focusGoals.ts';
const PURE = `${BUILD} && node packages/inference/test/verify_focus_goals.mjs`;
const MIG_BUILD = 'npx tsc --strict --target es2020 --module commonjs --lib es2020 --outDir packages/core-db/test/.build packages/core-db/src/migrationRunner.ts';
const MIG = `${MIG_BUILD} && node packages/core-db/test/verify_migrations.mjs`;
const STORE = 'apps/mobile/src/state/useStore.ts';
const SQL = 'packages/core-db/src/schema/066_focus_and_goals.sql';
const PURE_SRC = 'packages/inference/src/focusGoals.ts';

const mutations = [
  {
    name: 'N1 onboarding ignores the athlete/context binding',
    file: STORE,
    from: `    if (binding !== undefined && (binding.athleteId !== get().activeAthleteId
        || binding.contextRevision !== athleteContextRevision
        || dbAthleteId !== binding.athleteId)) {`,
    to: `    if (binding !== undefined && false) {`,
    gate: jest('FocusGoalStore.test.js'),
  },
  {
    name: 'N2 the binding compares the athlete id only (no context revision)',
    file: STORE,
    from: `        || binding.contextRevision !== athleteContextRevision
        || dbAthleteId !== binding.athleteId)) {`,
    to: `        || dbAthleteId !== binding.athleteId)) {`,
    gate: jest('FocusGoalStore.test.js'),
  },
  {
    name: 'N3 an incomplete onboarding goal is dropped silently instead of refusing the save',
    file: STORE,
    from: `    const validatedGoal = goalDraft === null ? null : validateSmartGoal(goalDraft, localToday());
    if (validatedGoal !== null && !validatedGoal.ok) {
      set({ error: validatedGoal.errors[0]?.message ?? 'That goal is not complete yet.' });
      return;
    }`,
    to: `    const validatedGoal = goalDraft === null ? null : validateSmartGoal(goalDraft, localToday());`,
    gate: jest('FocusGoalStore.test.js'),
  },
  {
    name: 'N4 a failed onboarding save keeps what was written so far',
    file: STORE,
    from: `        insertAthleteGoal(d, \`goal-\${savedAtMs}-\${Math.floor(Math.random() * 1e9).toString(36)}\`, validatedGoal.goal, savedAtMs);
      }
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('ROLLBACK');`,
    to: `        insertAthleteGoal(d, \`goal-\${savedAtMs}-\${Math.floor(Math.random() * 1e9).toString(36)}\`, validatedGoal.goal, savedAtMs);
      }
      d.executeSync('COMMIT');
    } catch (e) {
      d.executeSync('COMMIT');`,
    gate: jest('FocusGoalStore.test.js'),
  },
  {
    name: 'N5 a goal edit is not compare-and-set on the revision the editor saw',
    file: 'apps/mobile/src/state/focusGoalStore.ts',
    from: `  if (current === undefined || current.current_revision !== expectedRevision) return false;
  const next = expectedRevision + 1;`,
    to: `  if (current === undefined) return false;
  const next = current.current_revision + 1;`,
    gate: jest('FocusGoalStore.test.js'),
  },
  {
    name: 'N6 a training-data reset leaves goal measurements behind',
    file: STORE,
    from: `      deleteAllGoalObservations(d);
      d.executeSync('DELETE FROM movement_capability_attestation');`,
    to: `      d.executeSync('DELETE FROM movement_capability_attestation');`,
    gate: jest('FocusGoalStore.test.js'),
  },
  {
    name: 'N7 a measurement dated in the future is accepted',
    file: STORE,
    from: `        || !/^\\d{4}-\\d{2}-\\d{2}$/.test(observedOn) || observedOn > localToday()) {`,
    to: `        || !/^\\d{4}-\\d{2}-\\d{2}$/.test(observedOn)) {`,
    gate: jest('FocusGoalStore.test.js'),
  },
  {
    name: 'N8 the store does not enforce the active-goal limit before writing',
    file: STORE,
    from: `    if (existing === undefined
        && get().goals.filter((goal) => goal.status === 'active').length >= MAX_ACTIVE_GOALS) {
      set({ error: \`You can keep up to \${MAX_ACTIVE_GOALS} active goals. Retire one before adding another.\` });
      return false;
    }`,
    to: '',
    gate: jest('FocusGoalStore.test.js'),
  },
  {
    name: 'N9 recorded measurements can be rewritten (immutability trigger dropped)',
    file: SQL,
    from: `  SELECT RAISE(ABORT, 'athlete_goal_observation is immutable');`,
    to: `  SELECT 1;`,
    gate: jest('FocusGoalStore.test.js'),
  },
  {
    name: 'N10 a goal revision can be rewritten (immutability trigger dropped)',
    file: SQL,
    from: `  SELECT RAISE(ABORT, 'athlete_goal_revision is immutable');`,
    to: `  SELECT 1;`,
    gate: MIG,
  },
  {
    name: 'N11 the database allows a sixth active goal',
    file: SQL,
    from: `CREATE TRIGGER IF NOT EXISTS trg_athlete_goal_active_limit_bi`,
    to: `CREATE TRIGGER IF NOT EXISTS trg_athlete_goal_active_limit_bi_disabled`,
    gate: MIG,
  },
  {
    name: 'N12 an ambiguous gym word is guessed ("arms" means biceps)',
    file: PURE_SRC,
    from: `  abs: 'core', quads: 'quadriceps',`,
    to: `  abs: 'core', arms: 'biceps', quads: 'quadriceps',`,
    gate: PURE,
  },
  {
    name: 'N13 the focus question wording drifts',
    file: PURE_SRC,
    from: `export const FOCUS_QUESTION = 'Is there an area that you want to work on?' as const;`,
    to: `export const FOCUS_QUESTION = 'Which area do you want to work on?' as const;`,
    gate: PURE,
  },
  {
    name: 'N14 a movement with no mapping is treated as matching the focus',
    file: PURE_SRC,
    from: `  if (focus.size === 0) return 'none';
  let match: FocusMatch = 'none';`,
    to: `  if (focus.size === 0) return 'none';
  let match: FocusMatch = roles.length === 0 ? 'supporting' : 'none';`,
    gate: PURE,
  },
  {
    name: 'N15 a blank baseline is accepted as known',
    file: PURE_SRC,
    from: `  if (draft.baselineKnown && !isMeasurable(baselineValue)) {
    errors.push({ field: 'baselineValue', message: 'Enter where you are now, or choose "I do not know yet".' });
  }`,
    to: '',
    gate: PURE,
  },
  {
    name: 'N16 an unassessable goal is reported as a realistic rate',
    file: PURE_SRC,
    from: `    ...base, kind: 'not_assessable', changePerWeek, totalChangeFraction,`,
    to: `    ...base, kind: 'gradual_rate', changePerWeek, totalChangeFraction,`,
    gate: PURE,
  },
  {
    name: 'N17 the feasibility note promises the result',
    file: PURE_SRC,
    from: `const UNCERTAINTY = 'This is arithmetic, not a prediction. How fast anyone changes varies a great deal from person to person, and the app cannot promise a result or a date.';`,
    to: `const UNCERTAINTY = 'Follow the plan and you will reach your target on time. We guarantee it.';`,
    gate: PURE,
  },
  {
    name: 'N18 progress is reported without any recorded measurement',
    file: PURE_SRC,
    from: `      kind: 'no_observations', latest: null, startValue: goal.baselineValue, fractionOfGap: null,`,
    to: `      kind: 'moving_toward', latest: null, startValue: goal.baselineValue, fractionOfGap: 0.25,`,
    gate: PURE,
  },
  {
    name: 'N19 a half-written onboarding target does not block NEXT',
    file: 'apps/mobile/src/screens/OnboardingScreen.tsx',
    from: `            disabled={limitsGateOpen || targetGateOpen}`,
    to: `            disabled={limitsGateOpen}`,
    gate: jest('OnboardingFocusGoal.test.js'),
  },
  {
    name: 'N20 a refused onboarding save is silent',
    file: 'apps/mobile/src/screens/OnboardingScreen.tsx',
    from: `            {saveAttempted && typeof storeError === 'string' && storeError.length > 0 && (`,
    to: `            {false && typeof storeError === 'string' && (`,
    gate: jest('OnboardingFocusGoal.test.js'),
  },
  {
    name: 'N21 the incline rule is applied by name instead of by reviewed movement id',
    file: SQL,
    from: `  AND m.movement_id IN (65, 134, 212, 216);`,
    to: `  AND lower(m.name) LIKE '%incline%';`,
    gate: MIG,
  },
  {
    name: 'N22 the intermediate (v64) backup schema is dropped from the registry',
    file: 'packages/core-db/src/backup/schemaContract.ts',
    from: `  {
    userVersion: 64,
    migrationSlot: 65,
    tableCount: 106,
    objectCount: 181,
    fingerprint: '17b90b6396b16acfd0ef6910751bccb00e1b109f94fe426ad511f9362dbb8ba3',
  },`,
    to: '',
    gate: 'npm run verify:backup',
  },
  {
    name: 'N23 the muscle-mapping seed is not a self-heal sentinel',
    file: 'packages/core-db/src/migrationRunner.ts',
    from: `SELECT 1 AS ok WHERE NOT EXISTS (
      SELECT 1 FROM movement_detail d
      JOIN json_each(d.target_muscles) j`,
    to: `SELECT 1 AS ok WHERE 1 = 1 OR NOT EXISTS (
      SELECT 1 FROM movement_detail d
      JOIN json_each(d.target_muscles) j`,
    gate: MIG,
  },
];

const only = process.argv[2];
const results = [];
for (const mutation of mutations) {
  if (only !== undefined && !mutation.name.startsWith(`${only} `)) continue;
  const original = fs.readFileSync(mutation.file, 'utf8');
  const occurrences = original.split(mutation.from).length - 1;
  if (occurrences === 0 || (occurrences !== 1 && mutation.firstOnly !== true)) {
    results.push({ name: mutation.name, outcome: `ANCHOR ${occurrences === 0 ? 'NOT FOUND' : 'NOT UNIQUE'}` });
    console.log(JSON.stringify(results.at(-1)));
    continue;
  }
  fs.writeFileSync(mutation.file, original.replace(mutation.from, () => mutation.to));
  let result;
  try { result = run(mutation.gate); } finally { fs.writeFileSync(mutation.file, original); }
  const output = `${result.stdout}\n${result.stderr}`;
  const failed = (output.match(/^\s*(?:FAIL|×|✕)\s.*$/gm) ?? []).slice(0, 3).map((line) => line.trim().slice(0, 160));
  const compile = failed.length === 0 ? (output.match(/error TS\d+.*$/m)?.[0] ?? '').slice(0, 160) : '';
  results.push({ name: mutation.name, outcome: result.status === 0 ? 'NOT DETECTED' : 'detected', exit: result.status, sample: failed, compile });
  console.log(JSON.stringify(results.at(-1)));
}
// Rebuild the unmutated verifier outputs.
run(BUILD);
run(MIG_BUILD);
console.log('SUMMARY', JSON.stringify(results.map((row) => [row.name, row.outcome])));
