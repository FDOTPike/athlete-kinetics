/**
 * verify_movementRanking.mjs — the goal/tier movement-ranking policy (W3).
 *
 * Work order: docs/WORKORDER_PROGRAM_QUALITY_AND_INTAKE_REMEDIATION.md §2.3-2.6,
 * §7.1. The ranking policy is a PURE, DETERMINISTIC layer that runs ONLY AFTER
 * the equipment, tier, safety, capability, prior-experience, attestation and
 * context gates. It must:
 *   [R1] never default an intermediate-or-higher non-rehab athlete to a
 *        strictly bodyweight movement when a compatible loaded candidate is
 *        gated-available (the owner's device finding: Bodyweight Squat id 28
 *        outranked loaded id 38/55 purely by movement_id order);
 *   [R2] keep Goblet Squat as the minimum loaded squat when the dumbbell or
 *        kettlebell rung is gated-available;
 *   [R3] keep bodyweight valid exactly when nothing loaded is available, the
 *        athlete explicitly preferred it, or a gate excluded the loaded rungs —
 *        and say WHICH constraint caused the fallback;
 *   [R4] keep a valid explicit athlete preference ahead of every coach default;
 *   [R5] never re-admit a gate-rejected candidate (mutation check);
 *   [R6] be deterministic and stable under pool-order shuffling;
 *   [R7] expose the strength big-three anchor contract (exact anchors under an
 *        open gate chain; loaded substitutes + exact blockers otherwise);
 *   [R8] impose no anchor obligation on hypertrophy (bodybuilding contract).
 *
 * Candidate fixtures mirror the live 001-059 corpus: the capability chain
 * Bodyweight Squat(28) <- Goblet(14) <- Front Squat(8) <- Competition Squat(1)
 * is what left a fresh intermediate with Bodyweight Squat on a full gym.
 *
 * Run: joined to verify:blocks (npm run verify:blocks).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  rankMovementsForPattern, anchorNamesForObjective, objectiveStyleLabel,
  bigLiftAnchorNames, anchorSubstituteFor,
} = require('./.build/movementRanking.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

// --- live-corpus squat / hinge / push_h candidates ----------------------------
// movementId, name, difficulty, required equipment, plannedImplement (single-
// member supported-prefixes rule from L1(a)), capabilityAvailable (the shared
// verdict's equipment/tier/safety/capability outcome, already resolved).
const SQUAT_POOL = [
  { movementId: 1, name: 'Competition Squat', difficulty: 'Intermediate', required: ['barbell', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: true },
  { movementId: 8, name: 'Front Squat', difficulty: 'Intermediate', required: ['barbell', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: true },
  { movementId: 14, name: 'Goblet Squat', difficulty: 'Beginner', required: ['dumbbells'], plannedImplement: undefined, capabilityAvailable: true },
  { movementId: 28, name: 'Bodyweight Squat', difficulty: 'Beginner', required: [], plannedImplement: 'Bodyweight', capabilityAvailable: true },
  { movementId: 38, name: 'Box Squat', difficulty: 'Intermediate', required: ['barbell', 'bench', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: true },
  { movementId: 55, name: 'Dumbbell Squat', difficulty: 'Beginner', required: ['dumbbells'], plannedImplement: undefined, capabilityAvailable: true },
];
// The defect pool: a fresh intermediate's real squat situation — the chain's
// loaded rungs are all capability-blocked; only Bodyweight Squat (28) and the
// off-chain loaded Box Squat (38) remain.
const FRESH_CHAIN_POOL = [
  { movementId: 1, name: 'Competition Squat', difficulty: 'Intermediate', required: ['barbell', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: false, excludedBy: ['capability'] },
  { movementId: 8, name: 'Front Squat', difficulty: 'Intermediate', required: ['barbell', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: false, excludedBy: ['capability'] },
  { movementId: 14, name: 'Goblet Squat', difficulty: 'Beginner', required: ['dumbbells'], plannedImplement: undefined, capabilityAvailable: false, excludedBy: ['capability'] },
  { movementId: 28, name: 'Bodyweight Squat', difficulty: 'Beginner', required: [], plannedImplement: 'Bodyweight', capabilityAvailable: true },
  { movementId: 38, name: 'Box Squat', difficulty: 'Intermediate', required: ['barbell', 'bench', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: true },
];
const HINGE_POOL = [
  { movementId: 2, name: 'Deadlift', difficulty: 'Intermediate', required: ['barbell'], plannedImplement: undefined, capabilityAvailable: true },
  { movementId: 9, name: 'Romanian Deadlift', difficulty: 'Intermediate', required: ['barbell'], plannedImplement: undefined, capabilityAvailable: true },
  { movementId: 29, name: 'Glute Bridge', difficulty: 'Beginner', required: [], plannedImplement: undefined, capabilityAvailable: true },
];
const PUSH_POOL = [
  { movementId: 3, name: 'Competition Bench', difficulty: 'Intermediate', required: ['barbell', 'bench'], plannedImplement: undefined, capabilityAvailable: true },
  { movementId: 10, name: 'Dumbbell Bench Press', difficulty: 'Intermediate', required: ['bench', 'dumbbells'], plannedImplement: undefined, capabilityAvailable: true },
  { movementId: 16, name: 'Push-up', difficulty: 'Beginner', required: [], plannedImplement: 'Bodyweight', capabilityAvailable: true },
];

const FULL_GYM = ['barbell', 'squat_rack', 'bench', 'dumbbells', 'kettlebell', 'pullup_bar', 'nordic_bench', 'bands', 'cable_machine', 'mats'];
const DB_KB = ['dumbbells', 'kettlebell'];
const MINIMAL = ['bands', 'mats'];

const baseInput = (over = {}) => ({
  trainingAge: 'intermediate',
  objective: 'strength',
  inventory: FULL_GYM,
  safetyExcludedMovementIds: new Set(),
  preferredMovementIds: new Set(),
  ...over,
});

const byId = (pool, id) => pool.find((m) => m.movementId === id);
const withAvailability = (pool, availableIds) => pool.map((m) => ({
  ...m,
  capabilityAvailable: availableIds.includes(m.movementId),
  excludedBy: availableIds.includes(m.movementId) ? [] : ['capability'],
}));

// --- [R1] loaded default beats bodyweight despite movement_id order -----------
console.log('[R1] loaded default for intermediate+');
{
  const r = rankMovementsForPattern(
    withAvailability(SQUAT_POOL, [28, 38, 55]),
    baseInput(), 'squat',
  );
  check('[R1] the live defect case: full-gym fresh intermediate selects the loaded Box Squat (38), never Bodyweight Squat (28)',
    r.movementId === 38 && r.reason === 'loaded', JSON.stringify(r));
  check('[R1] a lower movement_id does not outrank a loaded selection (28 < 38)',
    r.movementId !== 28);
  const dbkb = rankMovementsForPattern(
    withAvailability(SQUAT_POOL, [28, 55]),
    baseInput({ inventory: DB_KB }), 'squat',
  );
  check('[R1] dumbbell/kettlebell fresh intermediate defaults to the loaded Dumbbell Squat (55)',
    dbkb.movementId === 55 && dbkb.reason === 'loaded', JSON.stringify(dbkb));
  const hinge = rankMovementsForPattern(HINGE_POOL, baseInput(), 'hinge');
  check('[R1] open hinge pool defaults to the loaded Deadlift, not Glute Bridge', hinge.movementId === 2 && hinge.reason !== 'bodyweight', JSON.stringify(hinge));
  const push = rankMovementsForPattern(PUSH_POOL, baseInput(), 'push_h');
  check('[R1] open push pool defaults to the loaded Competition Bench, not Push-up', push.movementId === 3 && push.reason !== 'bodyweight', JSON.stringify(push));
  check('[R1] mutation of the defect: whenever ANY loaded candidate is gated-available the bodyweight rung must lose',
    [ [28, 38], [28, 55], [28, 14], [28, 8], [28, 1] ].every(([bw, loaded]) =>
      rankMovementsForPattern(withAvailability(SQUAT_POOL, [bw, loaded]), baseInput(), 'squat').movementId === loaded));
}

// --- [R2] minimum loaded rung when the Goblet rung is available ----------------
console.log('[R2] minimum loaded rung');
{
  const r = rankMovementsForPattern(SQUAT_POOL, baseInput({ inventory: DB_KB }), 'squat');
  check('[R2] dumbbell/kettlebell inventory with all rungs available defaults to Goblet Squat (the minimum loaded squat)',
    r.movementId === 14 && r.reason === 'loaded', JSON.stringify(r));
}

// --- [R3] bodyweight only with a reason --------------------------------------
console.log('[R3] reasoned bodyweight');
{
  const minimal = rankMovementsForPattern(SQUAT_POOL, baseInput({ inventory: MINIMAL }), 'squat');
  check('[R3] minimal equipment: Bodyweight Squat is the fallback WITH the equipment reason',
    minimal.movementId === 28 && minimal.reason === 'bodyweight'
    && minimal.blockers.includes('equipment'), JSON.stringify(minimal));
  const safetyOut = rankMovementsForPattern(SQUAT_POOL, baseInput({
    safetyExcludedMovementIds: new Set([1, 8, 14, 38, 55]),
  }), 'squat');
  check('[R3] all loaded rungs safety-excluded: bodyweight fallback names safety',
    safetyOut.movementId === 28 && safetyOut.blockers.includes('safety'), JSON.stringify(safetyOut));
  const explicit = rankMovementsForPattern(SQUAT_POOL, baseInput({
    preferredMovementIds: new Set([28]),
  }), 'squat');
  check('[R3] explicit athlete bodyweight choice wins and is labelled preference',
    explicit.movementId === 28 && explicit.reason === 'preference', JSON.stringify(explicit));
}

// --- [R4] explicit preference precedence --------------------------------------
console.log('[R4] explicit preference precedence');
{
  const r = rankMovementsForPattern(SQUAT_POOL, baseInput({ preferredMovementIds: new Set([38]) }), 'squat');
  check('[R4] valid explicit preference (Box Squat) beats the anchor default', r.movementId === 38 && r.reason === 'preference', JSON.stringify(r));
  const bad = rankMovementsForPattern(SQUAT_POOL, baseInput({
    preferredMovementIds: new Set([999]),
    inventory: DB_KB,
  }), 'squat');
  check('[R4] an invalid/unknown preference is ignored, ranking still applies', bad.movementId === 14, JSON.stringify(bad));
  const unavailable = rankMovementsForPattern(SQUAT_POOL, baseInput({
    preferredMovementIds: new Set([14]),
    inventory: MINIMAL,
  }), 'squat');
  check('[R4] a preference outside the gated pool cannot re-admit itself', unavailable.movementId === 28, JSON.stringify(unavailable));
}

// --- [R5] mutation: rejected candidates cannot be re-admitted -----------------
console.log('[R5] gate rejection is final inside ranking');
{
  const tierBlocked = { ...byId(SQUAT_POOL, 1), capabilityAvailable: false, excludedBy: ['tier'] };
  const safetyBlocked = { ...byId(SQUAT_POOL, 8), capabilityAvailable: false, excludedBy: ['safety'] };
  const r = rankMovementsForPattern([tierBlocked, safetyBlocked, byId(SQUAT_POOL, 28)], baseInput(), 'squat');
  check('[R5] tier- and safety-rejected candidates are never selected', r.movementId === 28, JSON.stringify(r));
  check('[R5] the blocker report names the exact gate per rejected movement (1: tier, 8: safety)',
    JSON.stringify(r.blockersById?.[1]) === JSON.stringify(['tier'])
    && JSON.stringify(r.blockersById?.[8]) === JSON.stringify(['safety']),
    JSON.stringify(r.blockersById));
}

// --- [R6] determinism ---------------------------------------------------------
console.log('[R6] determinism and order stability');
{
  const a = rankMovementsForPattern(SQUAT_POOL, baseInput(), 'squat');
  const shuffled = [...SQUAT_POOL].sort((x, y) => ((x.movementId * 7919 + y.movementId) % 3) - ((y.movementId * 7919 + x.movementId) % 3));
  const b = rankMovementsForPattern(shuffled, baseInput(), 'squat');
  check('[R6] identical input gives identical output regardless of pool order',
    a.movementId === b.movementId && a.reason === b.reason
    && JSON.stringify(a.rankedIds) === JSON.stringify(b.rankedIds), JSON.stringify({ a, b }));
}

// --- [R7] strength big-three anchor contract ----------------------------------
console.log('[R7] strength anchor contract');
{
  check('[R7] the strength anchor set is exactly Competition Squat, Competition Bench, Deadlift (by authored name)',
    JSON.stringify(bigLiftAnchorNames()) === JSON.stringify(['Competition Squat', 'Competition Bench', 'Deadlift']), JSON.stringify(bigLiftAnchorNames()));
  check('[R7] anchorNamesForObjective imposes anchors ONLY on strength',
    anchorNamesForObjective('strength').length === 3
    && anchorNamesForObjective('hypertrophy').length === 0
    && anchorNamesForObjective('power').length === 0
    && anchorNamesForObjective('gpp').length === 0);
  const open = rankMovementsForPattern(SQUAT_POOL, baseInput(), 'squat');
  check('[R7] open gate chain selects the exact competition anchor for squat', open.movementId === 1 && open.reason === 'anchor', JSON.stringify(open));
  const anchorBlocked = rankMovementsForPattern(
    withAvailability(SQUAT_POOL, [8, 14, 28, 38, 55]), baseInput(), 'squat',
  );
  check('[R7] capability-blocked anchor falls to the loaded rung with the exact blocker and the substitute recorded',
    anchorBlocked.movementId === 8
    && JSON.stringify(anchorBlocked.blockersById[1]) === JSON.stringify(['capability'])
    && anchorBlocked.substituteId === 8,
    JSON.stringify(anchorBlocked));
  const chain = rankMovementsForPattern(FRESH_CHAIN_POOL, baseInput(), 'squat');
  check('[R7] a fresh intermediate (chain blocked, off-chain Box Squat open) gets the loaded rung with the exact anchor blocker recorded',
    chain.movementId === 38
    && JSON.stringify(chain.blockersById[1]) === JSON.stringify(['capability'])
    && chain.substituteId === 38,
    JSON.stringify(chain));
  const CHAIN_ONLY_POOL = FRESH_CHAIN_POOL.filter((m) => m.movementId !== 38);
  const noLoad = rankMovementsForPattern(CHAIN_ONLY_POOL, baseInput(), 'squat');
  check('[R7] with NO loaded rung available the substitute is null and bodyweight carries its reason',
    noLoad.movementId === 28 && noLoad.reason === 'bodyweight'
    && noLoad.substituteId === null
    && JSON.stringify(noLoad.blockersById[1]) === JSON.stringify(['capability']),
    JSON.stringify(noLoad));
  const sub = anchorSubstituteFor('Competition Squat', withAvailability(SQUAT_POOL, [8, 14, 28, 38, 55]), baseInput());
  check('[R7] anchorSubstituteFor(Competition Squat) resolves the best available loaded rung (Front Squat)', sub === 8, String(sub));
  const boxSub = anchorSubstituteFor('Competition Squat', FRESH_CHAIN_POOL, baseInput());
  check('[R7] anchorSubstituteFor resolves across the whole gated pool (Box Squat when the chain is closed)', boxSub === 38, String(boxSub));
  const noneSub = anchorSubstituteFor('Competition Squat', CHAIN_ONLY_POOL, baseInput());
  check('[R7] with no loaded rung available the substitute is null', noneSub === null, String(noneSub));
}

// --- [R8] bodybuilding contract -----------------------------------------------
console.log('[R8] bodybuilding has no anchor obligation');
{
  const hyp = rankMovementsForPattern(SQUAT_POOL, baseInput({ objective: 'hypertrophy' }), 'squat');
  check('[R8] hypertrophy squat ranking is anchor-free and still loaded-first', hyp.movementId === 8 && hyp.reason !== 'anchor' && hyp.movementId !== 28, JSON.stringify(hyp));
  check('[R8] hypertrophy does not inherit the strength anchor list', anchorNamesForObjective('hypertrophy').length === 0);
}

// --- goal/style label mapping (§2.2, unit coverage) ---------------------------
console.log('[§2.2] objective/style label mapping');
{
  const expected = {
    strength: 'Big-lift strength',
    hypertrophy: 'Bodybuilding',
    power: 'Athletic power',
    endurance: 'Endurance',
    gpp: 'General athlete',
    hybrid: 'Strength + grappling',
    rehab: 'Return to training',
    weight_loss: 'Fat-loss support',
  };
  for (const [objective, label] of Object.entries(expected)) {
    check(`[§2.2] ${objective} maps to the honest style label "${label}"`,
      objectiveStyleLabel(objective) === label, objectiveStyleLabel(objective));
  }
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
