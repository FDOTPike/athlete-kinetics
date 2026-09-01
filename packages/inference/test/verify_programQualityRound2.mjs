/**
 * verify_programQualityRound2.mjs — Round 2 remediation contracts.
 *
 * Work order: PROMPT_LEDGER Entry 0060 (Round 2 continuation). Failing tests
 * FIRST, then the product fix. Covers:
 *   [P1] power-specific ranking (R1): migration 052's owner-curated
 *        movement_lift_family.preferred_purpose='speed' rows are the ONLY
 *        classification basis; a power objective prefers gated-available
 *        speed-purpose loaded rungs; Power Clean stays Advanced (tier gate
 *        binds for an intermediate); hypertrophy/strength defaults unchanged.
 *   [P2] hypertrophy dose roles (R2): the named PRIMARY/ACCESSORY role rule
 *        (ROUND2_HYPERTROPHY_ROLE_SET_DELTA) separates primary from accessory
 *        working sets with boundary tests, and accessories prefer
 *        non-compound candidates so the roles are visibly distinct.
 *   [P3] strength anchor capacity (R4): the pure calculation
 *        strengthAnchorCapacity over squat/horizontal-push/hinge plan slots
 *        after duration + focus shaping; 1..7 days x 15..240 minutes.
 *
 * Run: joined to verify:blocks (npm run verify:blocks).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  rankMovementsForPattern,
} = require('./.build/movementRanking.js');
const {
  generateBlock,
  programFocuses,
  defaultProgramDayIndices,
  strengthAnchorCapacity,
  ROUND2_HYPERTROPHY_ROLE_SET_DELTA,
  weeklyProgressionSummary,
} = require('./.build/blockGenerator.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};

const FULL_GYM = ['barbell', 'squat_rack', 'bench', 'dumbbells', 'kettlebell', 'pullup_bar', 'nordic_bench', 'bands', 'cable_machine', 'mats'];
const DB_KB = ['dumbbells', 'kettlebell'];

const baseInput = (over = {}) => ({
  trainingAge: 'intermediate',
  objective: 'strength',
  inventory: FULL_GYM,
  safetyExcludedMovementIds: new Set(),
  preferredMovementIds: new Set(),
  ...over,
});

// Live-corpus movement ids (007/016/020/044/047 seeds):
// 1 Competition Squat, 2 Deadlift, 3 Competition Bench, 8 Front Squat,
// 14 Goblet Squat, 15 Kettlebell Swing, 28 Bodyweight Squat, 38 Box Squat,
// 55 Dumbbell Squat.
// Speed rows are the migration-052 curated membership (by NAME, resolved the
// way the store resolves anchors — against the candidate pool, never a
// hardcoded id): Speed Box Squat, Kettlebell Seesaw Press,
// Double Kettlebell Push Press, Power Clean.

// --- [P1] power-specific ranking ------------------------------------------------
console.log('[P1] power-specific ranking from curated speed-purpose rows');
{
  const SPEED_SQUAT_POOL = [
    { movementId: 1, name: 'Competition Squat', difficulty: 'Intermediate', required: ['barbell', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
    { movementId: 47, name: 'Speed Box Squat', difficulty: 'Intermediate', required: ['barbell', 'bench', 'squat_rack', 'bands'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true, preferred_purpose: 'speed' },
    { movementId: 38, name: 'Box Squat', difficulty: 'Intermediate', required: ['barbell', 'bench', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
    { movementId: 28, name: 'Bodyweight Squat', difficulty: 'Beginner', required: [], plannedImplement: 'Bodyweight', capabilityAvailable: true, isCompound: true },
  ];
  // The power input accepts the curated speed-purpose set (name-based, as the
  // store resolves it from movement_lift_family). No speed row -> legacy order.
  const withSpeed = (pool, names) => pool.map((m) => ({
    ...m,
    preferred_purpose: names.includes(m.name) ? 'speed' : m.preferred_purpose,
  }));

  const powerNames = ['Speed Box Squat'];
  const power = rankMovementsForPattern(
    withSpeed(SPEED_SQUAT_POOL, powerNames),
    baseInput({ objective: 'power', powerPreferredMovementNames: powerNames }), 'squat',
  );
  check('[P1] power prefers the gated-available speed-purpose rung (Speed Box Squat) over the plain compound',
    power.movementId === 47 && power.reason === 'loaded', JSON.stringify(power));

  const strength = rankMovementsForPattern(
    withSpeed(SPEED_SQUAT_POOL, powerNames),
    baseInput({ objective: 'strength', powerPreferredMovementNames: powerNames }), 'squat',
  );
  check('[P1] strength still takes the anchor when speed data is present (power law is objective-scoped)',
    strength.movementId === 1 && strength.reason === 'anchor', JSON.stringify(strength));

  const hypertrophy = rankMovementsForPattern(
    withSpeed(SPEED_SQUAT_POOL, powerNames),
    baseInput({ objective: 'hypertrophy', powerPreferredMovementNames: powerNames }), 'squat',
  );
  check('[P1] hypertrophy ignores the speed law (competition-free default unchanged)',
    hypertrophy.movementId !== 47 && hypertrophy.reason !== 'anchor' && hypertrophy.movementId !== 28, JSON.stringify(hypertrophy));

  // Speed row gated OUT: power falls back to the ordinary loaded rung — never
  // re-admits a rejected candidate.
  const gatedOut = SPEED_SQUAT_POOL.map((m) => m.name === 'Speed Box Squat'
    ? { ...m, capabilityAvailable: false, excludedBy: ['equipment'] } : m);
  const fallback = rankMovementsForPattern(
    withSpeed(gatedOut, powerNames),
    baseInput({ objective: 'power', powerPreferredMovementNames: powerNames }), 'squat',
  );
  check('[P1] a gate-rejected speed rung is never re-admitted; power falls to the legacy-law loaded rung (Competition Squat, lowest id among compounds)',
    fallback.movementId === 1 && fallback.reason === 'loaded' && fallback.movementId !== 47, JSON.stringify(fallback));

  // Tier law: Power Clean is Advanced (016). An intermediate NEVER receives it
  // even with power preference; an advanced athlete may.
  const HINGE_POOL = [
    { movementId: 2, name: 'Deadlift', difficulty: 'Intermediate', required: ['barbell'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
    { movementId: 15, name: 'Kettlebell Swing', difficulty: 'Intermediate', required: ['kettlebell'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
    { movementId: 44, name: 'Power Clean', difficulty: 'Advanced', required: ['barbell'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true, preferred_purpose: 'speed' },
  ];
  const cleanNames = ['Power Clean'];
  const intermediate = rankMovementsForPattern(
    withSpeed(HINGE_POOL, cleanNames),
    baseInput({ objective: 'power', inventory: FULL_GYM, powerPreferredMovementNames: cleanNames }), 'hinge',
  );
  check('[P1] tier-unlock prohibition: an intermediate power athlete NEVER receives Power Clean',
    intermediate.movementId !== 44, JSON.stringify(intermediate));
  const advanced = rankMovementsForPattern(
    withSpeed(HINGE_POOL, cleanNames),
    baseInput({ objective: 'power', trainingAge: 'advanced', inventory: FULL_GYM, powerPreferredMovementNames: cleanNames }), 'hinge',
  );
  check('[P1] an advanced power athlete with clean gates open receives the Power Clean',
    advanced.movementId === 44 && advanced.reason === 'loaded', JSON.stringify(advanced));

  // Determinism: pool order cannot change the choice.
  const shuffled = [...withSpeed(SPEED_SQUAT_POOL, powerNames)].reverse();
  const again = rankMovementsForPattern(
    shuffled, baseInput({ objective: 'power', powerPreferredMovementNames: powerNames }), 'squat',
  );
  check('[P1] power ranking is deterministic under pool reordering', again.movementId === 47, JSON.stringify(again));
}

// --- [P1b] Round 2 review proof: beginner power copy is scoped by tier ---------
console.log('[P1b] beginner-scoped power explanation');
{
  const { powerObjectiveExplanation } = require('./.build/movementRanking.js');
  const advancedCopy = powerObjectiveExplanation('power', 'intermediate');
  const beginnerCopy = powerObjectiveExplanation('power', 'beginner');
  check('[P1b] the intermediate+ power copy promises speed-focused rungs (the loaded-mode law)',
    advancedCopy.includes('speed-focused versions'), advancedCopy);
  check('[P1b] the beginner power copy does NOT promise speed rungs (legacy mode has no speed law) and discloses the base-first path',
    !beginnerCopy.includes('The coach plans the speed-focused versions')
    && beginnerCopy.includes('strength base first'), beginnerCopy);
  check('[P1b] non-power objectives render no power explanation',
    powerObjectiveExplanation('strength') === '' && powerObjectiveExplanation('hypertrophy', 'beginner') === '');
}

// --- [P2] hypertrophy dose roles -------------------------------------------------
console.log('[P2] hypertrophy primary/accessory dose roles');
{
  // The rule is a NAMED constant, exported and boundary-tested — never an
  // inline magic number.
  check('[P2] the role delta is a named, exported constant equal to -1 (documented owner precedent: hybrid accessory tax)',
    ROUND2_HYPERTROPHY_ROLE_SET_DELTA === -1, String(ROUND2_HYPERTROPHY_ROLE_SET_DELTA));

  const pool = (objective) => [
    { movementId: 1, name: 'Competition Squat', difficulty: 'Intermediate', required: ['barbell', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
    { movementId: 8, name: 'Front Squat', difficulty: 'Intermediate', required: ['barbell', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
    { movementId: 14, name: 'Goblet Squat', difficulty: 'Beginner', required: ['dumbbells'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
    { movementId: 28, name: 'Bodyweight Squat', difficulty: 'Beginner', required: [], plannedImplement: 'Bodyweight', capabilityAvailable: true, isCompound: true },
  ].map((m) => ({ ...m }));

  // NOTE: for hypertrophy, competition-lift names are excluded from the
  // DEFAULT pool by the ratified bodybuilding contract, so the fixtures use
  // non-anchor compound (Box Squat) vs non-compound (Dumbbell Squat) to
  // isolate the role law from the anchor law.
  const acc = rankMovementsForPattern(
    [
      { movementId: 38, name: 'Box Squat', difficulty: 'Intermediate', required: ['barbell', 'bench', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
      { movementId: 55, name: 'Dumbbell Squat', difficulty: 'Beginner', required: ['dumbbells'], plannedImplement: undefined, capabilityAvailable: true, isCompound: false },
    ],
    baseInput({ objective: 'hypertrophy' }), 'squat',
    { accessorySlot: true },
  );
  check('[P2] an accessory slot prefers the non-compound candidate over the compound',
    acc.movementId === 55, JSON.stringify(acc));
  const prim = rankMovementsForPattern(
    [
      { movementId: 38, name: 'Box Squat', difficulty: 'Intermediate', required: ['barbell', 'bench', 'squat_rack'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
      { movementId: 55, name: 'Dumbbell Squat', difficulty: 'Beginner', required: ['dumbbells'], plannedImplement: undefined, capabilityAvailable: true, isCompound: false },
    ],
    baseInput({ objective: 'hypertrophy' }), 'squat',
    { accessorySlot: false },
  );
  check('[P2] a primary slot keeps the compound-first law (no role inversion)',
    prim.movementId === 38, JSON.stringify(prim));

  // Block-level dose separation, real generator, full-gym intermediate.
  // The pool must cover EVERY pattern a strength-day menu can ask for
  // (squat, hinge, lunge, isolation, push_h, pull_h, push_v, pull_v) or
  // sessions get dropped and the assertion is vacuous. Only slot 1 (squat)
  // and slot 3 (hinge) matter for the role law; the rest are fillers so the
  // sessions exist. Bodyweight Squat's plannedImplement is undefined
  // (ambiguous), failing closed to loaded like the live store mapping.
  const gm = (id, name, pattern, difficulty, required, compound) => ({
    movement_id: id, name, pattern, is_compound: compound, required,
    difficulty, beginner_ok: false, sportTracking: false,
    capability_available_weight_room: true, capability_available_sport_conditioning: true,
  });
  const HYP_POOL = [
    gm(1, 'Competition Squat', 'squat', 'Intermediate', ['barbell', 'squat_rack'], true),
    gm(2, 'Deadlift', 'hinge', 'Intermediate', ['barbell'], true),
    gm(10, 'Dumbbell Bench Press', 'push_h', 'Intermediate', ['bench', 'dumbbells'], true),
    gm(11, 'Dumbbell Shoulder Press', 'push_v', 'Intermediate', ['dumbbells'], true),
    gm(12, 'Single-Arm Dumbbell Row', 'pull_h', 'Intermediate', ['dumbbells'], true),
    gm(13, 'Chin-up', 'pull_v', 'Intermediate', ['pullup_bar'], true),
    gm(17, 'Walking Lunge', 'lunge', 'Beginner', [], true),
    gm(30, 'Plank', 'isolation', 'Beginner', [], false),
  ];
  const profile = {
    objective: 'hypertrophy', training_age: 'intermediate', weekly_frequency: 4,
    max_sessions_per_day: 1, session_duration_cap_min: 90, base_rpe_cap: 9,
    target_energy_system: 'hybrid', progression_methodology: 'autoregulated',
    injury_flags: [], mobility_limits: [], equipment_inventory: FULL_GYM,
  };
  const plan = generateBlock({ profile, movements: HYP_POOL, startDate: '2026-09-01', schemaType: 'LINEAR' });
  const lowerWeek1 = plan.sessions.filter((s) => s.week_index === 1 && s.focus === 'lower');
  const primarySets = new Set(lowerWeek1.flatMap((s) => s.slots.filter((sl) => sl.slot_index < 3).map((sl) => sl.sets)));
  const accessorySets = new Set(lowerWeek1.flatMap((s) => s.slots.filter((sl) => sl.slot_index >= 3).map((sl) => sl.sets)));
  check('[P2] in the generated block every primary slot carries MORE working sets than every accessory slot',
    primarySets.size === 1 && accessorySets.size === 1
    && [...primarySets][0] === [...accessorySets][0] + 1,
    JSON.stringify({ primarySets: [...primarySets], accessorySets: [...accessorySets] }));

  // Boundary: the clamp never drops a slot below the schema floor of 2, even
  // for a beginner where the base scheme is already reduced.
  const beginnerProfile = { ...profile, training_age: 'beginner' };
  const beginnerPlan = generateBlock({ profile: beginnerProfile, movements: HYP_POOL, startDate: '2026-09-01', schemaType: 'LINEAR' });
  const minSets = Math.min(...beginnerPlan.sessions.flatMap((s) => s.slots.map((sl) => sl.sets)));
  check('[P2] boundary: the role delta never produces a slot below the 2-set floor',
    minSets >= 2, String(minSets));

  // Deload: the deload transform still applies on top (week 4 volume cut).
  const deloadSets = plan.sessions.filter((s) => s.week_index === 4 && s.focus === 'lower')
    .flatMap((s) => s.slots.map((sl) => sl.sets));
  check('[P2] the deload still cuts volume (week-4 sets below week-1 primaries)',
    Math.min(...deloadSets) < [...primarySets][0], JSON.stringify(deloadSets));
}

// --- [P3] strength anchor capacity (R4) ------------------------------------------
console.log('[P3] pure strength anchor capacity over shaped plan slots');
{
  const mkProfile = (days, minutes) => ({
    objective: 'strength', training_age: 'intermediate', weekly_frequency: days,
    max_sessions_per_day: 1, session_duration_cap_min: minutes, base_rpe_cap: 9,
    target_energy_system: 'hybrid', progression_methodology: 'autoregulated',
    injury_flags: [], mobility_limits: [], equipment_inventory: FULL_GYM,
  });

  // The law: capacity = the count of squat/push_h/hinge SLOTS in the shaped
  // week. lower carries squat+hinge (2), upper carries push_h (1), full
  // carries squat+hinge then push_h (3) — always trimmed to the duration's
  // slot budget (clamp(round(minutes/22), 2, 5)).
  //   1 day  = [full]: budget 90min=4 -> squat,hinge,push_h -> 3.
  //   2 days = [lower,upper]: 2+1 = 3.
  //   3 days = [lower,upper,full]: 2+1+3 = 6.
  check('[P3] a 1-day plan shapes to [full] with 90-min budget 4: capacity 3 (squat+hinge+push_h)',
    strengthAnchorCapacity(mkProfile(1, 90), programFocuses, defaultProgramDayIndices) === 3,
    String(strengthAnchorCapacity(mkProfile(1, 90), programFocuses, defaultProgramDayIndices)));
  check('[P3] a 2-day split (lower+upper) yields capacity 3 at 90 min',
    strengthAnchorCapacity(mkProfile(2, 90), programFocuses, defaultProgramDayIndices) === 3,
    String(strengthAnchorCapacity(mkProfile(2, 90), programFocuses, defaultProgramDayIndices)));
  check('[P3] a 3-day, 90-minute strength plan carries 6 anchor-capable slots (lower 2 + upper 1 + full 3)',
    strengthAnchorCapacity(mkProfile(3, 90), programFocuses, defaultProgramDayIndices) === 6,
    String(strengthAnchorCapacity(mkProfile(3, 90), programFocuses, defaultProgramDayIndices)));

  // Duration shaping: 15 minutes clamps the budget to 2. lower = squat+hinge
  // (2, budget 2 keeps both), upper = push_h (budget 2 keeps it), full =
  // budget 2 keeps squat+hinge only.
  check('[P3] 15-minute sessions: budget clamps to 2; a 3-day plan counts lower 2 + upper 1 + full 2 = 5',
    strengthAnchorCapacity(mkProfile(3, 15), programFocuses, defaultProgramDayIndices) === 5,
    String(strengthAnchorCapacity(mkProfile(3, 15), programFocuses, defaultProgramDayIndices)));
  check('[P3] 240-minute sessions: budget clamps to 5, menus are already shorter, so 3 days = 6 (same as 90 min)',
    strengthAnchorCapacity(mkProfile(3, 240), programFocuses, defaultProgramDayIndices) === 6,
    String(strengthAnchorCapacity(mkProfile(3, 240), programFocuses, defaultProgramDayIndices)));

  // Boundary sweep 1..7 days x {15, 90, 240} minutes: capacity is finite,
  // monotone non-decreasing in days, and strictly shaped by minutes.
  let sweepOk = true;
  let sweepDetail = '';
  let previousDaysCap = 0;
  for (let days = 1; days <= 7; days++) {
    let cap90 = -1;
    for (const minutes of [15, 90, 240]) {
      const cap = strengthAnchorCapacity(mkProfile(days, minutes), programFocuses, defaultProgramDayIndices);
      if (!(Number.isFinite(cap) && cap > 0)) { sweepOk = false; sweepDetail = `days=${days} min=${minutes} cap=${cap}`; }
      if (minutes === 90) cap90 = cap;
    }
    if (cap90 < previousDaysCap) { sweepOk = false; sweepDetail = `days=${days} cap90=${cap90} < previous ${previousDaysCap}`; }
    previousDaysCap = cap90;
  }
  check('[P3] sweep 1..7 days x {15,90,240} min: positive, finite, monotone in days at fixed minutes', sweepOk, sweepDetail);

  // The full 7-day strength split [lower,upper,lower,upper,full,cond,full]:
  // anchor slots = 2+1+2+1+3+0+3 = 12 at 90 min.
  check('[P3] a 7-day strength plan at 90 min carries 12 anchor-capable slots (full/cond days contribute per their menus)',
    strengthAnchorCapacity(mkProfile(7, 90), programFocuses, defaultProgramDayIndices) === 12,
    String(strengthAnchorCapacity(mkProfile(7, 90), programFocuses, defaultProgramDayIndices)));
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
