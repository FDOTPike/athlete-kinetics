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

  // The law (audit round 4 corrected): capacity = the count of DISTINCT
  // anchor PATTERNS (squat / push_h / hinge) reachable in the shaped week.
  // The big three are three ROLES, not three occurrences of two patterns.
  //   1 day  = [full]: budget 90min=4 -> squat,hinge,push_h reachable -> 3.
  //   2 days = [lower,upper]: squat+hinge (lower), push_h (upper) -> 3.
  //   3 days = [lower,upper,full]: same three roles -> 3 (more repeats of
  //            the same roles do not add capacity).
  check('[P3] a 1-day plan shapes to [full] with 90-min budget 4: all 3 anchor roles reachable',
    strengthAnchorCapacity(mkProfile(1, 90), programFocuses, defaultProgramDayIndices) === 3,
    String(strengthAnchorCapacity(mkProfile(1, 90), programFocuses, defaultProgramDayIndices)));
  check('[P3] a 2-day split (lower+upper) reaches all 3 anchor roles at 90 min',
    strengthAnchorCapacity(mkProfile(2, 90), programFocuses, defaultProgramDayIndices) === 3,
    String(strengthAnchorCapacity(mkProfile(2, 90), programFocuses, defaultProgramDayIndices)));
  check('[P3] a 3-day, 90-minute strength plan reaches all 3 anchor roles (lower 2 + upper 1 + full 3 occurrences, 3 distinct roles)',
    strengthAnchorCapacity(mkProfile(3, 90), programFocuses, defaultProgramDayIndices) === 3,
    String(strengthAnchorCapacity(mkProfile(3, 90), programFocuses, defaultProgramDayIndices)));

  // Duration shaping: 15 minutes clamps the budget to 2. lower's menu is
  // squat+hinge, upper's push_h, full's trimmed menu is squat+hinge — the
  // three roles are still all reachable across a 3-day week.
  check('[P3] 15-minute sessions: budget clamps to 2; a 3-day plan still reaches all 3 roles',
    strengthAnchorCapacity(mkProfile(3, 15), programFocuses, defaultProgramDayIndices) === 3,
    String(strengthAnchorCapacity(mkProfile(3, 15), programFocuses, defaultProgramDayIndices)));
  check('[P3] 240-minute sessions: budget clamps to 5, menus are already shorter, so all 3 roles remain reachable',
    strengthAnchorCapacity(mkProfile(3, 240), programFocuses, defaultProgramDayIndices) === 3,
    String(strengthAnchorCapacity(mkProfile(3, 240), programFocuses, defaultProgramDayIndices)));

  // Boundary sweep 1..7 days x {15, 90, 240} minutes: capacity is finite,
  // positive, capped by the three anchor roles, and monotone non-decreasing
  // in days (a longer week can only reach more roles, never fewer).
  let sweepOk = true;
  let sweepDetail = '';
  let previousDaysCap = 0;
  for (let days = 1; days <= 7; days++) {
    let cap90 = -1;
    for (const minutes of [15, 90, 240]) {
      const cap = strengthAnchorCapacity(mkProfile(days, minutes), programFocuses, defaultProgramDayIndices);
      if (!(Number.isFinite(cap) && cap > 0 && cap <= 3)) { sweepOk = false; sweepDetail = `days=${days} min=${minutes} cap=${cap}`; }
      if (minutes === 90) cap90 = cap;
    }
    if (cap90 < previousDaysCap) { sweepOk = false; sweepDetail = `days=${days} cap90=${cap90} < previous ${previousDaysCap}`; }
    previousDaysCap = cap90;
  }
  check('[P3] sweep 1..7 days x {15,90,240} min: positive, capped at 3 roles, monotone in days at fixed minutes', sweepOk, sweepDetail);

  // The 7-day strength split reaches all three roles (lower, upper, full
  // days together cover squat/push_h/hinge; conditioning days add none).
  check('[P3] a 7-day strength plan reaches all 3 anchor roles',
    strengthAnchorCapacity(mkProfile(7, 90), programFocuses, defaultProgramDayIndices) === 3,
    String(strengthAnchorCapacity(mkProfile(7, 90), programFocuses, defaultProgramDayIndices)));
}

// --- [P4] audit round 4: capacity law must follow the DRAFT schedule -----------
console.log('[P4a] capacity from the actual draft days/focuses');
{
  // The screen computes capacity from the persisted profile when it must
  // follow the athlete's CURRENT dayIndices/dayFocuses draft. The pure
  // overload takes the explicit draft and counts DISTINCT anchor PATTERNS
  // the shaped week can carry — squat, horizontal-push, hinge — because the
  // big three are the three roles, not three occurrences of two patterns.
  const mk = (days, minutes) => ({
    objective: 'strength', training_age: 'intermediate', weekly_frequency: days,
    max_sessions_per_day: 1, session_duration_cap_min: minutes, base_rpe_cap: 9,
    target_energy_system: 'hybrid', progression_methodology: 'autoregulated',
    injury_flags: [], mobility_limits: [], equipment_inventory: FULL_GYM,
  });
  // Audit scenario: a four-day profile drafted down to ONE session. The
  // persisted profile would claim all 3 roles, but the DRAFT (one lower
  // day) carries only squat+hinge = 2 distinct roles < 3, so the warning
  // must appear. The property under test is DRAFT-following, not the
  // specific minutes: with 90 minutes the lower menu keeps both patterns.
  const draft = strengthAnchorCapacity(mk(4, 90), programFocuses, defaultProgramDayIndices, [
    { dayIndex: 1, focus: 'lower' },
  ]);
  check('[P4a] a 4-day profile drafted to ONE lower day counts 2 distinct anchor roles while the persisted profile claims 3',
    draft === 2 && strengthAnchorCapacity(mk(4, 90), programFocuses, defaultProgramDayIndices) === 3, String(draft));
  // Default 3-day 90-min split: lower(2) + upper(1) + full(3) = 3 distinct roles.
  const threeDay = strengthAnchorCapacity(mk(3, 90), programFocuses, defaultProgramDayIndices);
  check('[P4a] the default 3-day 90-min split carries all 3 distinct anchor roles',
    threeDay === 3, String(threeDay));
  // Custom all-lower schedule with no upper day: push_h never appears, so
  // capacity < 3 even though squat+hinge both do.
  const allLower = strengthAnchorCapacity(mk(4, 90), programFocuses, defaultProgramDayIndices, [
    { dayIndex: 1, focus: 'lower' }, { dayIndex: 3, focus: 'lower' },
    { dayIndex: 5, focus: 'lower' }, { dayIndex: 6, focus: 'lower' },
  ]);
  check('[P4a] a custom all-lower schedule caps at 2 distinct anchor roles (no push_h slot)',
    allLower === 2, String(allLower));
  // Omitting the draft falls back to the persisted profile (byte-compatible
  // with every existing caller and the earlier sweep expectations).
  const fallback = strengthAnchorCapacity(mk(1, 90), programFocuses, defaultProgramDayIndices);
  check('[P4a] no draft days -> the persisted profile shapes the week (1-day full: 3 roles)',
    fallback === 3, String(fallback));
}

// --- [P4b] accessory ordering must respect the bodybuilding exclusion ----------
console.log('[P4b] accessory slots keep the bodybuilding contract');
{
  // The accessory branch sorted `available`, bypassing the competition-lift
  // exclusion: a hypertrophy accessory slot could auto-pick Deadlift even
  // when Romanian Deadlift was available. The fix routes the accessory sort
  // over defaultLoadedPool (which already excludes the big three for
  // hypertrophy).
  const hypAcc = rankMovementsForPattern(
    [
      { movementId: 2, name: 'Deadlift', difficulty: 'Intermediate', required: ['barbell'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
      { movementId: 9, name: 'Romanian Deadlift', difficulty: 'Intermediate', required: ['barbell'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
      { movementId: 55, name: 'Dumbbell Squat', difficulty: 'Beginner', required: ['dumbbells'], plannedImplement: undefined, capabilityAvailable: true, isCompound: false },
    ],
    baseInput({ objective: 'hypertrophy' }), 'hinge',
    { accessorySlot: true },
  );
  check('[P4b] a hypertrophy accessory slot NEVER auto-selects a competition lift (Deadlift) while a non-anchor loaded rung exists',
    hypAcc.movementId !== 2 && hypAcc.name !== 'Deadlift', JSON.stringify(hypAcc));
  // Primary slots keep their existing behavior (anchor exclusion already
  // applied via defaultLoadedPool -> loadedAvailable).
  const hypPrim = rankMovementsForPattern(
    [
      { movementId: 2, name: 'Deadlift', difficulty: 'Intermediate', required: ['barbell'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
      { movementId: 9, name: 'Romanian Deadlift', difficulty: 'Intermediate', required: ['barbell'], plannedImplement: undefined, capabilityAvailable: true, isCompound: true },
    ],
    baseInput({ objective: 'hypertrophy' }), 'hinge',
  );
  check('[P4b] the primary hypertrophy slot also stays competition-free',
    hypPrim.movementId === 9, JSON.stringify(hypPrim));
}

console.log('[P4c] progression summary identity (see component + generated matrix)');
{
  // The identity fix (day_index + slot_index + movement) is pinned by the
  // real-generator block assertions below and exercised end-to-end by the
  // regenerated PQ-05/PQ-12/13 matrix evidence.
  const { weeklyProgressionSummary } = require('./.build/blockGenerator.js');
  const gm = (id, name, pattern) => ({ name, bodyweight: pattern === undefined ? false : pattern });
  const dayPlan = {
    objective: 'hypertrophy', start_date: '2026-09-01', weeks: 4, schemaType: 'LINEAR',
    macroBlockIndex: 1, macroPhase: 'gpp', peakShifted: false, recovery: false,
    autopilotAdjusted: [], warnings: [],
    sessions: [
      // Two lower days at the same day_index-in-week positions across weeks.
      { week_index: 1, day_index: 1, focus: 'lower', slots: [{ slot_index: 1, movement_id: 14, sets: 4, reps: 12, target_rpe: 7 }] },
      { week_index: 1, day_index: 4, focus: 'lower', slots: [{ slot_index: 1, movement_id: 28, sets: 4, reps: 12, target_rpe: 7 }] },
      { week_index: 2, day_index: 1, focus: 'lower', slots: [{ slot_index: 1, movement_id: 14, sets: 5, reps: 12, target_rpe: 7 }] },
      { week_index: 2, day_index: 4, focus: 'lower', slots: [{ slot_index: 1, movement_id: 28, sets: 4, reps: 12, target_rpe: 7.5 }] },
    ],
  };
  const lines = weeklyProgressionSummary(dayPlan, (id) => (id === 14 ? { name: 'Goblet Squat', bodyweight: false } : { name: 'Bodyweight Squat', bodyweight: true }));
  const goblet = lines.find((l) => l.startsWith('Goblet Squat'));
  const bw = lines.find((l) => l.startsWith('Bodyweight Squat'));
  check('[P4c] two same-focus days are described separately (Goblet day: same reps plus a set)',
    goblet !== undefined && goblet.includes('same reps plus a set'), JSON.stringify(lines));
  check('[P4c] the bodyweight day keeps its OWN progression (higher effort, not a collision with the other lower day)',
    bw !== undefined && bw.includes('higher target effort'), JSON.stringify(lines));
  // Determinism: repeated runs give identical output.
  check('[P4c] the summary is deterministic across repeated runs',
    JSON.stringify(weeklyProgressionSummary(dayPlan, (id) => (id === 14 ? { name: 'Goblet Squat', bodyweight: false } : { name: 'Bodyweight Squat', bodyweight: true }))) === JSON.stringify(lines));
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
