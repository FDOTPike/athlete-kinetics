/**
 * verify_preparation.mjs — the movement-preparation policy.
 *
 * Pins what the policy may and may not prescribe:
 *   [1] every prescribed dose has a recorded source, and stays inside it;
 *   [2] the protocol is tailored to the session (patterns, load, time, niggles,
 *       sport context, readiness) and is deterministic;
 *   [3] holds and exclusions reach preparation: 135/187 and any excluded
 *       movement are never rehearsed or ramped, and every omission is listed
 *       with its reason (nothing is dropped silently);
 *   [4] an empty free-form session still gets a protocol;
 *   [5] outcomes are derived from what was done and cannot overstate it;
 *   [6] a frozen protocol round-trips, and a damaged one is refused.
 *
 * Run: npm run verify:preparation
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const prep = require('./.build/preparationPolicy.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

const slot = (movementId, pattern, overrides = {}) => ({
  movementId, movementName: `Movement ${movementId}`, pattern, isCompound: true, externallyLoaded: true,
  target: { kind: 'reps', reps: 5 }, ...overrides,
});
const build = (overrides = {}) => prep.buildPreparationProtocol({
  tier: 'intermediate', accessContext: 'weight_room',
  slots: [slot(1, 'squat'), slot(2, 'hinge'), slot(3, 'isolation', { isCompound: false })],
  excludedMovements: new Map(), restrictedJoints: [], readinessReduced: false, budgetMin: 10,
  ...overrides,
});
const ids = (protocol) => protocol.items.map((item) => item.itemId);
const sum = (protocol) => protocol.items.reduce((seconds, item) => seconds + item.estimateSeconds, 0);

// --- [1] provenance and dose bounds ------------------------------------------
console.log('[1] provenance and dose bounds');
{
  const sourceIds = new Set(prep.PREPARATION_SOURCES.map((source) => source.id));
  check('six sources are recorded, each with a citation and what it supports',
    prep.PREPARATION_SOURCES.length === 6
      && prep.PREPARATION_SOURCES.every((source) => source.citation.length > 40 && source.supports.length > 20));
  const protocols = [
    build(), build({ budgetMin: 5 }), build({ slots: [] }),
    build({ slots: [slot(4, 'push_h'), slot(5, 'pull_v')] }),
    build({ slots: [slot(6, 'lunge'), slot(7, 'locomotion', { externallyLoaded: false, target: { kind: 'time', seconds: 600 } })], accessContext: 'sport_conditioning' }),
  ];
  const items = protocols.flatMap((protocol) => protocol.items);
  check('every item cites at least one recorded source',
    items.every((item) => item.sourceRefs.length > 0 && item.sourceRefs.every((ref) => sourceIds.has(ref))));
  check('every item has an instruction, a cue, a stop instruction and a positive estimate',
    items.every((item) => item.instruction.length > 20 && item.cue.length > 5 && item.stopInstruction.length > 10
      && item.estimateSeconds > 0));
  const raise = items.filter((item) => item.stage === 'raise');
  check('raise: easy movement for 3-5 minutes (RAMP raise phase), never removed',
    protocols.every((protocol) => protocol.items.filter((item) => item.stage === 'raise').length === 1)
      && raise.every((item) => item.dose.kind === 'time' && item.dose.seconds >= 180 && item.dose.seconds <= 300 && item.effort === 'easy'));
  const holds = items.filter((item) => (item.stage === 'mobilise' || item.stage === 'activate') && item.dose.kind === 'time');
  check('mobility and activation are short time boxes — no static hold of 60 s or more (Behm 2016)',
    holds.length > 0 && holds.every((item) => item.dose.seconds <= 30));
  const ramp = items.filter((item) => item.stage === 'ramp');
  check('ramp sets are 40% then 80% of today\'s working load (Ribeiro 2020)',
    ramp.length > 0 && build().items.filter((item) => item.stage === 'ramp').map((item) => item.dose.percentOfWorkingLoad).join(',') === '40,80'
      && ramp.every((item) => item.sourceRefs.includes('ribeiro2020')));
  check('a preparation set is never more repetitions than 6, nor more than the working set',
    ramp.every((item) => item.dose.reps <= 6)
      && build({ slots: [slot(1, 'squat', { target: { kind: 'reps', reps: 3 } })] }).items
        .filter((item) => item.stage === 'ramp' || item.stage === 'rehearse').every((item) => item.dose.reps <= 3));
  check('no preparation item is prescribed at hard effort',
    items.every((item) => item.effort === 'easy' || item.effort === 'moderate'));
  // The evaluated-and-rejected Muay Thai example: 25-50 raises per side.
  check('no item prescribes anything like 25-50 repetitions per side',
    items.every((item) => !(item.dose.kind === 'reps' && item.dose.reps >= 25)));
  check('held movement ids 135 and 187 are registered with a reason',
    prep.PREPARATION_HELD_MOVEMENT_IDS.has(135) && prep.PREPARATION_HELD_MOVEMENT_IDS.has(187)
      && prep.PREPARATION_HELD_MOVEMENT_IDS.size === 2);
}

// --- [2] tailoring -------------------------------------------------------------
console.log('[2] tailoring');
{
  const lower = build();
  check('deterministic: the same input gives the same protocol', JSON.stringify(build()) === JSON.stringify(lower));
  check('protocol carries its policy id, revision and version',
    lower.policyId === prep.PREPARATION_POLICY_ID && lower.policyRevision === prep.PREPARATION_POLICY_REVISION
      && lower.version === prep.PREPARATION_PROTOCOL_VERSION);
  check('stages run in order: raise, mobilise, activate, rehearse, ramp',
    lower.items.map((item) => prep.PREPARATION_STAGES.indexOf(item.stage)).every((stage, index, all) => index === 0 || stage >= all[index - 1]));
  check('a squat + hinge session gets lower-body mobility and bracing, not arm circles',
    ids(lower).includes('mobilise.leg_swings') && ids(lower).includes('mobilise.hip_hinge_reach')
      && !ids(lower).includes('mobilise.arm_circles') && ids(lower).includes('activate.front_support'), ids(lower).join(','));
  const upper = build({ slots: [slot(4, 'push_h'), slot(5, 'pull_v')] });
  check('a press + pull session gets shoulder and trunk mobility, not leg swings',
    ids(upper).includes('mobilise.arm_circles') && ids(upper).includes('mobilise.torso_rotation')
      && !ids(upper).includes('mobilise.leg_swings') && !ids(upper).some((id) => id.startsWith('activate.')), ids(upper).join(','));
  check('the session and the first movement are stated as the basis',
    lower.basis.some((line) => /squat, hinge/.test(line)) && lower.basis.some((line) => /First movement prepared: Movement 1/.test(line)));
  check('rehearsal and ramp target the first compound movement',
    lower.items.filter((item) => item.stage === 'rehearse' || item.stage === 'ramp').every((item) => item.movementId === 1));
  const isolationFirst = build({ slots: [slot(3, 'isolation', { isCompound: false }), slot(1, 'squat')] });
  check('a compound movement is prepared ahead of an earlier isolation movement',
    isolationFirst.items.filter((item) => item.stage === 'ramp').every((item) => item.movementId === 1));

  const bodyweight = build({ slots: [slot(8, 'pull_v', { externallyLoaded: false })] });
  check('a bodyweight first movement is rehearsed but has no loaded ramp, and the omission is explained',
    bodyweight.items.some((item) => item.stage === 'rehearse') && !bodyweight.items.some((item) => item.stage === 'ramp')
      && bodyweight.omitted.some((row) => row.itemId === 'ramp.sets' && row.reasonCode === 'not_applicable'));
  const timed = build({ slots: [slot(9, 'carry', { target: { kind: 'time', seconds: 40 } })] });
  check('a timed first movement is rehearsed as a short easy effort with no ramp',
    timed.items.some((item) => item.stage === 'rehearse' && item.dose.kind === 'time')
      && !timed.items.some((item) => item.stage === 'ramp'));

  const standard = build({ budgetMin: 10 });
  const condensed = build({ budgetMin: 5 });
  check('10 minutes builds the full protocol inside its budget', standard.variant === 'standard' && sum(standard) <= 600,
    `${sum(standard)} s`);
  check('5 minutes builds the short protocol: raise + preparation of the first movement',
    condensed.variant === 'condensed' && ids(condensed).join(',') === 'raise.easy_movement,ramp.set_40,ramp.set_80',
    ids(condensed).join(','));
  check('the short protocol stays within about 5 minutes and lists what it left out as "time"',
    sum(condensed) <= 330 && condensed.omitted.filter((row) => row.reasonCode === 'time').length >= 2,
    `${sum(condensed)} s`);
  check('a budget below the minimum is raised to the 5-minute minimum, never shrunk further',
    JSON.stringify(build({ budgetMin: 1 }).items) === JSON.stringify(condensed.items)
      && prep.PREPARATION_MINIMUM_MIN === 5);
  check('the estimate is a low-high range in seconds',
    standard.estimateSeconds.low <= standard.estimateSeconds.high && prep.preparationEstimateMinutes(standard) >= 8);

  const knee = build({ restrictedJoints: ['knee'] });
  check('a knee niggle withholds drills that load the knee and lists them as safety omissions',
    !ids(knee).includes('mobilise.leg_swings') && knee.omitted.some((row) => row.itemId === 'mobilise.leg_swings' && row.reasonCode === 'safety'));
  check('a lower-limb niggle changes the raise to a seated or upper-body option instead of removing it',
    /seated/.test(knee.items[0].instruction) && knee.items[0].itemId === 'raise.easy_movement');
  check('joints for the execution-time recheck are exposed per drill',
    prep.preparationItemJoints('mobilise.leg_swings').includes('knee') && prep.preparationItemJoints('raise.easy_movement').length === 0
      && prep.preparationItemJoints('rehearse.session_movement').length === 0);

  const sport = build({ accessContext: 'sport_conditioning', slots: [slot(7, 'locomotion', { externallyLoaded: false, target: { kind: 'time', seconds: 600 } })] });
  check('a sport or conditioning session includes single-leg balance',
    ids(sport).includes('activate.single_leg_balance') && sport.basis.some((line) => /Sport or conditioning/.test(line)));
  const eased = build({ readinessReduced: true });
  check('reduced readiness adds an instruction and adds no work',
    eased.notes.some((line) => /eased/.test(line)) && JSON.stringify(eased.items) === JSON.stringify(lower.items));
  const beginner = build({ tier: 'beginner' });
  check('experience changes emphasis, not dose (no tier-specific dose was sourced)',
    JSON.stringify(beginner.items) === JSON.stringify(lower.items) && beginner.basis.some((line) => /beginner/.test(line)));
  const conflict = build({ timeConflictNote: 'This session is over your 30-minute session limit.' });
  check('a frozen-plan time conflict is shown as a note', conflict.notes.includes('This session is over your 30-minute session limit.'));
}

// --- [3] holds and exclusions ----------------------------------------------------
console.log('[3] holds and exclusions');
{
  for (const held of [135, 187]) {
    const protocol = build({ slots: [slot(held, 'push_v'), slot(2, 'hinge')] });
    check(`movement ${held} is never rehearsed or ramped; the next movement is prepared instead`,
      protocol.items.every((item) => item.movementId !== held)
        && protocol.items.filter((item) => item.stage === 'ramp').every((item) => item.movementId === 2)
        && protocol.omitted.some((row) => row.movementId === held && row.reasonCode === 'movement_hold'));
  }
  const onlyHeld = build({ slots: [slot(135, 'push_v'), slot(187, 'push_v')] });
  check('a session of only held movements gets general preparation and no movement-bound item',
    onlyHeld.items.every((item) => item.movementId === null) && onlyHeld.items.some((item) => item.stage === 'raise')
      && onlyHeld.omitted.filter((row) => row.reasonCode === 'movement_hold').length === 2);
  for (const reasonCode of ['support_hold', 'capability', 'safety']) {
    const protocol = build({ excludedMovements: new Map([[1, { reasonCode, detail: 'it is excluded.' }]]) });
    check(`an excluded movement (${reasonCode}) is never used by preparation and is listed with that reason`,
      protocol.items.every((item) => item.movementId !== 1)
        && protocol.omitted.some((row) => row.movementId === 1 && row.reasonCode === reasonCode));
  }
  const all = build({ excludedMovements: new Map([1, 2, 3].map((id) => [id, { reasonCode: 'support_hold', detail: 'it is on hold.' }])) });
  check('when every session movement is excluded, no movement id appears in the protocol at all',
    all.items.every((item) => item.movementId === null) && all.omitted.filter((row) => row.reasonCode === 'support_hold').length === 3);
}

// --- [4] empty free-form session ---------------------------------------------------
console.log('[4] empty free-form session');
{
  const empty = build({ slots: [] });
  check('an empty plan still gets a protocol: raise, general mobility and a first-movement rehearsal',
    ids(empty).join(',') === 'raise.easy_movement,mobilise.leg_swings,mobilise.arm_circles,rehearse.first_choice', ids(empty).join(','));
  check('nothing in it names a movement id, and it says it is general preparation',
    empty.items.every((item) => item.movementId === null) && empty.basis.some((line) => /general preparation/.test(line)));
}

// --- [5] truthful outcomes -----------------------------------------------------------
console.log('[5] truthful outcomes');
{
  const resolve = prep.resolvePreparationOutcome;
  check('"completed" only when every item was done as written',
    resolve(['done', 'done', 'done']) === 'completed' && resolve(['done', 'modified']) === 'modified'
      && resolve(['done', 'skipped']) === 'modified' && resolve(['done', 'substituted']) === 'modified'
      && resolve(['done', 'withheld']) === 'modified');
  check('nothing performed is neither completed nor modified — the athlete must say already-warm or skipped',
    resolve(['skipped', 'skipped']) === null && resolve(['withheld']) === null && resolve(['pending']) === null && resolve([]) === null);
  check('terminal statuses are exactly the five outcomes',
    prep.PREPARATION_STATUSES.filter(prep.isTerminalPreparationStatus).join(',') === 'completed,modified,already_warm,skipped,stopped');
  const time = { kind: 'time', seconds: 30, perSide: true };
  const reps = { kind: 'reps', reps: 6, perSide: false };
  check('a performed dose more than 1.5x the prescription is extra work, not preparation',
    prep.isExtraPreparationWork(reps, 10) && !prep.isExtraPreparationWork(reps, 9) && !prep.isExtraPreparationWork(reps, 6)
      && prep.isExtraPreparationWork(time, 46) && !prep.isExtraPreparationWork(time, 45) && !prep.isExtraPreparationWork(reps, null));
  check('25 raises per side against a 30-second drill would be flagged, never hidden',
    prep.isExtraPreparationWork({ kind: 'reps', reps: 10, perSide: true }, 25));
  check('doses read in plain language',
    prep.describePreparationDose({ kind: 'time', seconds: 240, perSide: false }) === '4 minutes'
      && prep.describePreparationDose(time) === '30 seconds each side'
      && prep.describePreparationDose(reps) === '6 reps'
      && prep.describePreparationDose({ kind: 'ramp', reps: 5, percentOfWorkingLoad: 40 }) === '5 reps at about 40% of today\'s working load');
}

// --- [6] frozen protocol round trip -----------------------------------------------------
console.log('[6] frozen protocol round trip');
{
  const protocol = build({ restrictedJoints: ['knee'], readinessReduced: true });
  const json = JSON.stringify(protocol);
  check('a frozen protocol parses back to exactly what was built',
    JSON.stringify(prep.parsePreparationProtocol(json)) === json);
  const refuses = (mutate) => {
    const copy = JSON.parse(json);
    mutate(copy);
    try { prep.parsePreparationProtocol(JSON.stringify(copy)); return false; } catch (error) { return error.name === 'PreparationProtocolError'; }
  };
  check('a damaged or unknown protocol is refused, not partly trusted',
    refuses((copy) => { copy.version = 2; })
      && refuses((copy) => { copy.items = []; })
      && refuses((copy) => { copy.items[0].dose = { kind: 'time', seconds: -5, perSide: false }; })
      && refuses((copy) => { copy.items[0].stage = 'warmup'; })
      && refuses((copy) => { copy.items[0].sourceRefs = ['not-a-source']; })
      && refuses((copy) => { copy.omitted = [{ itemId: 'x', movementId: null, reasonCode: 'because', detail: 'd' }]; })
      && refuses((copy) => { copy.estimateSeconds = { low: 500, high: 100 }; }));
  let invalidJson = false;
  try { prep.parsePreparationProtocol('{not json'); } catch (error) { invalidJson = error.name === 'PreparationProtocolError'; }
  check('text that is not JSON is refused', invalidJson);
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
