// Negative controls for work order 3: each mutation removes ONE rule and runs the
// gate that is supposed to notice. A mutation that is NOT detected is a weak test.
//
//   node scripts/coaching/negative-controls-wo3.mjs          # all
//   node scripts/coaching/negative-controls-wo3.mjs E3       # one
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const run = (command) => spawnSync(command, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// --no-cache: a stale transform cache once served an older copy of a migration.
const jest = (file) => `npx jest --config apps/mobile/jest.config.js --runInBand --no-cache apps/mobile/test/components/${file}`;
const BUILD = 'npm run build:inference-test';
const PURE = `${BUILD} && node packages/inference/test/verify_emphasis.mjs`;
const MIG_BUILD = 'npx tsc --strict --target es2020 --module commonjs --lib es2020 --outDir packages/core-db/test/.build packages/core-db/src/migrationRunner.ts';
const MIG = `${MIG_BUILD} && node packages/core-db/test/verify_migrations.mjs`;
const GEN = 'packages/inference/src/blockGenerator.ts';
const SPORT = 'packages/inference/src/sportProfile.ts';
const EMPH = 'packages/inference/src/programEmphasis.ts';
const STORE = 'apps/mobile/src/state/useStore.ts';
const SQL = 'packages/core-db/src/schema/067_sport_and_emphasis.sql';

const mutations = [
  // E1 mutates the ALLOCATION path. The same-pattern swap takes its candidates
  // from the ranker's own gated list, so reading them from the whole library
  // there is an equivalent mutant (the ranker already refused everything the
  // gates refuse) and proves nothing.
  {
    name: 'E1 a spare or displaced slot is filled from the whole library instead of the gated pool',
    file: GEN,
    from: `          const movement = pickEmphasisCandidate(pool, muscle, usedIds, emphasisIndex, loadedFirstEmphasis);
          if (movement !== null) return { movement, muscle, goalLabel: null };`,
    to: `          const movement = pickEmphasisCandidate(input.movements, muscle, usedIds, emphasisIndex, loadedFirstEmphasis);
          if (movement !== null) return { movement, muscle, goalLabel: null };`,
    gate: PURE,
  },
  {
    name: 'E2 a main lift may be swapped for a movement that drops its job',
    file: GEN,
    from: `            if ((slots.length + 1) < ACCESSORY_SLOT_FROM
                && !emphasisIndex.keepsPrimaryWork(id, defaultChoice.movement_id)) continue;`,
    to: '',
    gate: PURE,
  },
  {
    name: 'E3 a pattern may be displaced even when no other day trains it',
    file: GEN,
    from: `            && (weeklyPatternDays.get(pattern) ?? 0) >= 2 && !weekDisplaced.has(pattern)) {`,
    to: `            && (weeklyPatternDays.get(pattern) ?? 0) >= 1 && !weekDisplaced.has(pattern)) {`,
    gate: PURE,
  },
  {
    name: 'E4 a pattern may be displaced on every day of the week',
    file: GEN,
    from: `            && (weeklyPatternDays.get(pattern) ?? 0) >= 2 && !weekDisplaced.has(pattern)) {`,
    to: `            && (weeklyPatternDays.get(pattern) ?? 0) >= 2) {`,
    gate: PURE,
  },
  {
    name: 'E5 the emphasis displaces a slot the athlete chose explicitly',
    file: GEN,
    from: `            && selected !== null && preferredMovement === undefined && goalMovement === undefined
            && !(ranking.reason === 'anchor' && selected.movement_id === ranking.movementId)`,
    to: `            && selected !== null && goalMovement === undefined
            && !(ranking.reason === 'anchor' && selected.movement_id === ranking.movementId)`,
    gate: PURE,
  },
  {
    name: 'E6 a goal exercise is taken from outside the gated pool',
    file: GEN,
    from: `          ? pool.find((candidate) => candidate.pattern === pattern
              && goalLinks.has(candidate.movement_id) && !usedIds.has(candidate.movement_id))`,
    to: `          ? input.movements.find((candidate) => candidate.pattern === pattern
              && goalLinks.has(candidate.movement_id) && !usedIds.has(candidate.movement_id))`,
    gate: PURE,
  },
  {
    name: 'E7 a goal exercise outranks the slot the athlete chose explicitly',
    file: GEN,
    from: `        const defaultChoice = preferredMovement ?? goalMovement ?? scopeMovement ?? rankedDefault`,
    to: `        const defaultChoice = goalMovement ?? preferredMovement ?? scopeMovement ?? rankedDefault`,
    also: [`        const goalMovement = preferredMovement === undefined && goalLinks.size > 0`, `        const goalMovement = goalLinks.size > 0`],
    gate: PURE,
  },
  {
    name: 'E8 the hybrid tax and the sport workload cut are added together',
    file: GEN,
    from: `  const accessoryCut = Math.max(hybridAccessoryCut, emphasis?.workload?.accessorySetCut ?? 0);`,
    to: `  const accessoryCut = hybridAccessoryCut + (emphasis?.workload?.accessorySetCut ?? 0);`,
    gate: PURE,
  },
  {
    name: 'E9 a very full sport week does not hold week 3',
    file: GEN,
    from: `  const lastLoadingRow = emphasis?.workload?.holdHardestWeek === true ? 1 : 2;`,
    to: `  const lastLoadingRow = 2;`,
    gate: PURE,
  },
  {
    name: 'E10 the goal exercise loses sets under a high sport week',
    file: GEN,
    from: `          slotIndex >= ACCESSORY_SLOT_FROM && !locomotion &&
          // Work order 3: the exercise a goal names keeps its full dose.
          !goalLinks.has(m.movement_id);`,
    to: `          slotIndex >= ACCESSORY_SLOT_FROM && !locomotion;`,
    gate: PURE,
  },
  {
    name: 'E11 a held movement (135/187) can be newly prescribed by the emphasis',
    file: GEN,
    from: `    && candidate.pattern !== 'locomotion'
    && !PREPARATION_HELD_MOVEMENT_IDS.has(candidate.movement_id)`,
    to: `    && candidate.pattern !== 'locomotion'`,
    gate: PURE,
  },
  {
    name: 'E11b a held movement (135/187) can be swapped in for a default of the same pattern',
    file: GEN,
    from: `            if (PREPARATION_HELD_MOVEMENT_IDS.has(id)) continue;`,
    to: '',
    gate: PURE,
  },
  {
    name: 'E11c a goal that names a held movement (135/187) gets it planned in its pattern slot',
    file: GEN,
    from: `              && goalLinks.has(candidate.movement_id) && !usedIds.has(candidate.movement_id)
              && !PREPARATION_HELD_MOVEMENT_IDS.has(candidate.movement_id))`,
    to: `              && goalLinks.has(candidate.movement_id) && !usedIds.has(candidate.movement_id))`,
    gate: PURE,
  },
  {
    name: 'E11d a goal that names a held movement is reported with a wrong reason instead of the hold',
    file: GEN,
    from: `      else if (PREPARATION_HELD_MOVEMENT_IDS.has(movementId)) gap = 'held';`,
    to: '',
    gate: PURE,
  },
  {
    name: 'E12 the emphasis is applied on a sport or conditioning day',
    file: GEN,
    from: `      const emphasisDay: EmphasisDayRegion | null = emphasisIndex !== null && STRENGTH_FOCI.has(focus)
        ? focus as EmphasisDayRegion
        : null;`,
    to: `      const emphasisDay: EmphasisDayRegion | null = emphasisIndex !== null
        ? (STRENGTH_FOCI.has(focus) ? focus : 'full') as EmphasisDayRegion
        : null;`,
    gate: PURE,
  },
  {
    name: 'E13 scheduled and stated sport sessions are added together',
    file: SPORT,
    from: `    const sessionsPerWeek = input.scheduled.length;`,
    to: `    const sessionsPerWeek = input.scheduled.length + (input.profile?.practiceSessionsPerWeek ?? 0) + (input.profile?.matchesPerWeek ?? 0);`,
    gate: PURE,
  },
  {
    name: 'E14 a competition date switches on the competition-lift promotion',
    file: EMPH,
    from: `      competitionLifts: derived.competitionLifts,`,
    to: `      competitionLifts: derived.competitionLifts || input.sport.competitionDate !== null,`,
    gate: PURE,
  },
  {
    name: 'E15 Muay Thai striking gets an emphasis with no reviewed basis',
    file: SPORT,
    from: `    case 'striking_and_clinch':
      return {
        muscles: [],`,
    to: `    case 'striking_and_clinch':
      return {
        muscles: ['core'],`,
    gate: PURE,
  },
  {
    name: 'E16 the sport text promises an outcome',
    file: SPORT,
    from: `const NO_PROMISE = 'The app cannot promise fewer injuries or better results; it can only make sure this work is in your plan.';`,
    to: `const NO_PROMISE = 'This work will prevent injuries and will improve your results.';`,
    gate: PURE,
  },
  {
    name: 'E17 an unknown session duration is estimated instead of left unknown',
    file: SPORT,
    from: `      knownMinutesPerWeek: known.reduce((sum, session) => sum + (session.expectedDurationMin ?? 0), 0),`,
    to: `      knownMinutesPerWeek: input.scheduled.reduce((sum, session) => sum + (session.expectedDurationMin ?? 60), 0),`,
    gate: PURE,
  },
  {
    name: 'E18 the committed block is generated without the emphasis the preview showed',
    file: STORE,
    from: `      powerPreferredMovementNames: powerNamesGenerate,
      ...(blockEmphasisInput === null ? {} : { emphasis: blockEmphasisInput }),`,
    to: `      powerPreferredMovementNames: powerNamesGenerate,`,
    gate: jest('SportEmphasisStore.test.js'),
  },
  {
    name: 'E19 the explanation is not stored with the block',
    file: STORE,
    from: `      if (blockEmphasisInput !== null && plan.emphasis !== undefined) {
        insertBlockEmphasis(d, blockId, blockEmphasisInput, plan.emphasis, Date.now());
      }`,
    to: '',
    gate: jest('SportEmphasisStore.test.js'),
  },
  {
    name: 'E20 a new block inherits an explanation left under a reused block id',
    file: STORE,
    from: `      clearBlockEmphasis(d, blockId);
      if (blockEmphasisInput !== null && plan.emphasis !== undefined) {`,
    to: `      if (blockEmphasisInput !== null && plan.emphasis !== undefined) {`,
    gate: jest('SportEmphasisStore.test.js'),
  },
  {
    name: 'E21 a training-data reset leaves block explanations behind',
    file: STORE,
    from: `      deleteBlockEmphasisFor(d, 'all');
      d.executeSync('DELETE FROM training_block');`,
    to: `      d.executeSync('DELETE FROM training_block');`,
    gate: jest('SportEmphasisStore.test.js'),
  },
  {
    name: 'E22 gym strength sessions and low-demand activities count as sport workload',
    file: 'apps/mobile/src/state/sportStore.ts',
    from: `        AND d.kind_id <> 'strength_training'
        AND d.demand_class <> 'low'`,
    to: '',
    gate: jest('SportEmphasisStore.test.js'),
  },
  {
    name: 'E23 an ended weekly series still counts',
    file: 'apps/mobile/src/state/sportStore.ts',
    from: `        AND (s.effective_end_date IS NULL OR s.effective_end_date >= ?)`,
    to: `        AND (s.effective_end_date IS NULL OR s.effective_end_date >= ? OR 1 = 1)`,
    gate: jest('SportEmphasisStore.test.js'),
  },
  {
    name: 'E24 a retired goal still puts its exercise in the next block',
    file: STORE,
    from: `    .filter((goal) => goal.status === 'active' && links.has(goal.goalId))`,
    to: `    .filter((goal) => links.has(goal.goalId))`,
    gate: jest('SportEmphasisStore.test.js'),
  },
  {
    name: 'E25 onboarding saves without validating the sport answer',
    file: STORE,
    from: `      if (!validatedSport.ok) {
        set({ error: validatedSport.errors[0]?.message ?? 'That sport answer is not complete yet.' });
        return;
      }
      sportProfile = validatedSport.profile;`,
    to: `      sportProfile = validatedSport.ok ? validatedSport.profile : null;`,
    gate: jest('SportEmphasisStore.test.js'),
  },
  {
    name: 'E26 the goal exercise link is written outside the goal transaction outcome (a refused edit still changes the link)',
    file: STORE,
    from: `      if (applied && movementId !== undefined) setGoalMovementLink(d, goalId, movementId, nowMs);`,
    to: `      if (movementId !== undefined) setGoalMovementLink(d, goalId, movementId, nowMs);`,
    gate: jest('SportEmphasisStore.test.js'),
  },
  {
    name: 'E27 a stored block explanation can be rewritten',
    file: SQL,
    from: `  SELECT RAISE(ABORT, 'block_emphasis is immutable');`,
    to: `  SELECT 1;`,
    gate: MIG,
  },
  {
    name: 'E28 a listed sport may carry a free-text name / "another sport" need not be named',
    file: SQL,
    from: `  CHECK ((sport_id = 'other') = (other_sport_name IS NOT NULL))`,
    to: `  CHECK (1 = 1)`,
    gate: MIG,
  },
  {
    name: 'E29 the block explanation table is not a self-heal sentinel',
    file: 'packages/core-db/src/migrationRunner.ts',
    from: `  { type: 'table', name: 'block_emphasis' },                                  // 067`,
    to: '',
    gate: MIG,
  },
  {
    name: 'E30 the previous (v65) backup schema is dropped from the registry',
    file: 'packages/core-db/src/backup/schemaContract.ts',
    from: `  {
    userVersion: 65,
    migrationSlot: 66,
    tableCount: 114,
    objectCount: 198,
    fingerprint: '491c8ac536b220bacb3c61ef2979ced7b4a5515a0dad7c9f9adb72e68ddeb189',
  },`,
    to: '',
    gate: 'npm run verify:backup',
  },
  {
    name: 'E31 choosing "Football" silently picks a code for the athlete',
    file: 'apps/mobile/src/components/SportFields.tsx',
    from: `    patch({ family, sportId: members.length === 1 ? members[0]! : null, outcomeId: null });`,
    to: `    patch({ family, sportId: members[0]!, outcomeId: null });`,
    gate: jest('SportScreens.test.js'),
  },
  {
    name: 'E32 a half-answered sport screen does not block NEXT',
    file: 'apps/mobile/src/screens/OnboardingScreen.tsx',
    from: `            disabled={limitsGateOpen || targetGateOpen || sportGateOpen}`,
    to: `            disabled={limitsGateOpen || targetGateOpen}`,
    gate: jest('SportScreens.test.js'),
  },
  {
    name: 'E33 "not sure" is sent to the store as zero',
    file: 'apps/mobile/src/components/SportFields.tsx',
    from: `  practiceSessionsPerWeek: fields.practiceSessionsPerWeek,
  matchesPerWeek: fields.matchesPerWeek,
  typicalSessionMinutes: parseMinutes(fields.minutesText),`,
    to: `  practiceSessionsPerWeek: fields.practiceSessionsPerWeek ?? 0,
  matchesPerWeek: fields.matchesPerWeek ?? 0,
  typicalSessionMinutes: parseMinutes(fields.minutesText),`,
    gate: jest('SportScreens.test.js'),
  },
  {
    name: 'E34 the sport screen is part of the interview for everyone',
    file: 'apps/mobile/src/screens/OnboardingScreen.tsx',
    from: `  const [wantsSport, setWantsSport] = useState(false);`,
    to: `  const [wantsSport, setWantsSport] = useState(true);`,
    gate: jest('OnboardingFocusGoal.test.js'),
  },
  {
    name: 'E35 the program preview does not show the explanation',
    file: 'apps/mobile/src/screens/ProgramSetupScreen.tsx',
    from: `          report={previewResult.preview.plan.emphasis ?? null}`,
    to: `          report={null}`,
    gate: jest('SportScreens.test.js'),
  },
];

const only = process.argv[2];
const results = [];
for (const mutation of mutations) {
  if (only !== undefined && !mutation.name.startsWith(`${only} `)) continue;
  const original = fs.readFileSync(mutation.file, 'utf8');
  let mutated = original;
  let anchorProblem = null;
  for (const [from, to] of [[mutation.from, mutation.to], ...(mutation.also === undefined ? [] : [mutation.also])]) {
    const occurrences = mutated.split(from).length - 1;
    if (occurrences !== 1) { anchorProblem = `ANCHOR ${occurrences === 0 ? 'NOT FOUND' : 'NOT UNIQUE'}`; break; }
    mutated = mutated.replace(from, () => to);
  }
  if (anchorProblem !== null) {
    results.push({ name: mutation.name, outcome: anchorProblem });
    console.log(JSON.stringify(results.at(-1)));
    continue;
  }
  fs.writeFileSync(mutation.file, mutated);
  let result;
  try { result = run(mutation.gate); } finally { fs.writeFileSync(mutation.file, original); }
  const output = `${result.stdout}\n${result.stderr}`;
  const failed = (output.match(/^\s*(?:FAIL|×|✕)\s.*$/gm) ?? []).slice(0, 3).map((line) => line.trim().slice(0, 170));
  const compile = failed.length === 0 ? (output.match(/error TS\d+.*$/m)?.[0] ?? '').slice(0, 170) : '';
  results.push({ name: mutation.name, outcome: result.status === 0 ? 'NOT DETECTED' : 'detected', exit: result.status, sample: failed, compile });
  console.log(JSON.stringify(results.at(-1)));
}
// Rebuild the unmutated verifier outputs.
run(BUILD);
run(MIG_BUILD);
console.log('SUMMARY', JSON.stringify(results.map((row) => [row.name, row.outcome])));
