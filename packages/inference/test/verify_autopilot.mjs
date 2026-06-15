/**
 * verify_autopilot.mjs — boundary invariants of the Kinematic Autopilot
 * (Phase 13, Step 3). The operators F (detectFlaws) and u_{t+1}
 * (deriveControlAction / deriveDailyAdjustment) were hand-translated from
 * docs/Kinematic_Autopilot_Derivation.md.txt; THESE laws are what the math was
 * built to satisfy. Hardened after an adversarial review (p13s3-autopilot-review)
 * surfaced real defects (thin-data injury hole, NaN fail-danger, rpe_cap
 * overshoot) and verifier false-confidence gaps — each now has a pin below.
 *
 *   [1] Determinism + input purity — F AND u double-run deep-equal; frozen
 *       inputs to all three operators are never mutated.
 *   [2] Closed-form correctness — analytic φ pins (S_max cancels): constant ΔE,
 *       attenuation, injury attenuation on P (and its ABSENCE on N), the F-stage
 *       deadband + its strict-< boundary, the trend, the RECENCY direction
 *       (ω = λ^(20-i)), and the confidence gate.
 *   [3] Control-law table — every φ band incl. the inclusive ±0.4 / ±0.15
 *       boundaries maps to the exact correction row.
 *   [4] Monotone-conservative under flags — caution / restrictive guardrail /
 *       an injured loaded joint (incl. THIN-DATA niggle) can only reduce.
 *   [5] Halt supremacy — halt forces a fully neutral action (cap pinned at a
 *       non-default base_rpe_cap too).
 *   [6] Bounded authority / anti-windup — per-pattern bounded; total positive
 *       additions ≤ MAX_ADDED_SETS, granted to the most-headroom patterns
 *       (selection pinned with lowest-φ at LATE declaration indices + a tie).
 *   [7] Domain closure — the daily projection passes validateAdjustment, lands
 *       in the literal domains (ACTUAL produced values, not hard-coded), never
 *       exceeds base_rpe_cap, and clampAdjustment is idempotent.
 *   [8] Volume bifurcation — static source tripwire AND a behavioural proof
 *       that F ignores the raw acwr / acute / chronic fields.
 *   [9] Edge / fail-safe — empty/short/ragged windows, NaN/Infinity injection,
 *       steep-trend overflow, and a non-finite φ all stay finite & fail SAFE.
 *  [10] Constant contract — literals/derivation coefficients pinned.
 *
 * Run:  npm run verify:autopilot
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const {
  detectFlaws, deriveControlAction, deriveDailyAdjustment, snapToLiteral,
  FLAW_DETECTION_CONSTANTS, CONTROL_AUTHORITY, NEUTRAL_LOAD_MODIFIER,
} = require('./.build/kinematicAutopilot.js');
const {
  validateAdjustment, clampAdjustment, LOAD_MODIFIER_LITERALS,
  SET_MODIFIER_LITERALS, RPE_CAP_LITERALS,
} = require('./.build/outputSchema.js');
const { MOVEMENT_PATTERNS, EXPERIENCE_SEVERITY, DEFAULT_PROFILE } =
  require('./.build/types.js');
const { buildPatternWindow } = require('./.build/autopilotProjection.js');

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fail += 1;
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const round4 = (n) => Math.round(n * 1e4) / 1e4;
const NEUTRAL_CORR = { dLoad_p: 1.0, dSet_p: 0, dRpe_p: 0, prefBias_p: 0 };

// --- builders ----------------------------------------------------------------
const zeros = (L) => Array(L).fill(0);
const nulls = (L) => Array(L).fill(null);
const emptySeries = (L) => ({ avgDeltaRPE: nulls(L), avgAttenuation: zeros(L), setCount: zeros(L), maxJointSev: zeros(L) });
const makeDelta = (L, overrides = {}) => {
  const d = {};
  for (const p of MOVEMENT_PATTERNS) d[p] = overrides[p] ?? emptySeries(L);
  return d;
};
/** Constant daily ΔE=e (attenuation w, joint sev j) over the most-recent `days`. */
const constSeries = (L, { e, w = 1, j = 0, days = L }) => {
  const s = emptySeries(L);
  for (let i = L - days; i < L; i++) { s.avgDeltaRPE[i] = e; s.avgAttenuation[i] = w; s.setCount[i] = 1; s.maxJointSev[i] = j; }
  return s;
};
/** Signal on an explicit set of day indices (for recency / NaN-injection tests). */
const atDays = (L, indices, { e, w = 1, j = 0 }) => {
  const s = emptySeries(L);
  for (const i of indices) { s.avgDeltaRPE[i] = e; s.avgAttenuation[i] = w; s.setCount[i] = 1; s.maxJointSev[i] = j; }
  return s;
};
const svRows = (L) => Array.from({ length: L }, (_, i) => ({ date: `2026-06-${i + 1}` }));
const svRowsFull = (L, raw) => Array.from({ length: L }, (_, i) => ({
  date: `2026-06-${i + 1}`, readiness_score: 50,
  acwr: raw, acute_load_kg: raw, chronic_load_kg: raw,
}));
const prof = (over = {}) => ({ ...DEFAULT_PROFILE, ...over });

/** A full FlawReport with chosen {phi, flawClass?, obs?, maxJointSev?} per pattern. */
const makeReport = (byPattern = {}, { guardrail = null } = {}) => {
  const patterns = {};
  let maxAbs = 0; let crit = null;
  const { THETA_DEFICIT, THETA_HEADROOM } = FLAW_DETECTION_CONSTANTS;
  for (const p of MOVEMENT_PATTERNS) {
    const spec = byPattern[p] ?? { phi: 0 };
    const phi = Number.isFinite(spec.phi) ? round4(spec.phi) : spec.phi;
    let flawClass = spec.flawClass;
    if (flawClass === undefined) {
      flawClass = !Number.isFinite(phi) ? 'neutral'
        : phi >= THETA_DEFICIT ? 'capacity_deficit'
          : phi <= -THETA_HEADROOM ? 'latent_headroom' : 'neutral';
    }
    patterns[p] = { pattern: p, phi, flawClass, observations: spec.obs ?? 21, maxJointSev: spec.maxJointSev ?? 0 };
    if (Number.isFinite(phi) && Math.abs(phi) > maxAbs) { maxAbs = Math.abs(phi); crit = p; }
  }
  const dominantFlaw = crit === null ? 'neutral' : patterns[crit].flawClass;
  return { patterns, windowSummary: { dominantFlaw, maxAbsPhi: round4(maxAbs), criticalPattern: crit }, globalGuardrail: guardrail };
};

const NEUTRAL_PROFILE = prof();
const GPP = 'gpp';
const guard = (o) => ({ load_multiplier: 1, set_delta: 0, rpe_cap_max: 10, halt: false, follow_up: null, ...o });

// =============================================================================
// [1] determinism + input purity (F and u)
// =============================================================================
console.log('[1] determinism + input purity');
{
  const L = 21;
  const delta = makeDelta(L, {
    hinge: constSeries(L, { e: 2.0 }), squat: constSeries(L, { e: -1.5 }),
    push_h: constSeries(L, { e: 1.0, w: 0.5 }), pull_v: constSeries(L, { e: 3, j: 6 }),
  });
  const sv = svRows(L);
  const g = guard({ load_multiplier: 0.9 });
  const a = detectFlaws(sv, delta, 'intermediate', g);
  check('detectFlaws double-run deep-equality', eq(a, detectFlaws(sv, delta, 'intermediate', g)));
  const ua = deriveControlAction(a, NEUTRAL_PROFILE, GPP);
  check('deriveControlAction double-run deep-equality', eq(ua, deriveControlAction(a, NEUTRAL_PROFILE, GPP)));
  const day = ['hinge', 'squat', 'push_h'];
  check('deriveDailyAdjustment double-run deep-equality',
    eq(deriveDailyAdjustment(ua, day, NEUTRAL_PROFILE), deriveDailyAdjustment(ua, day, NEUTRAL_PROFILE)));

  // input purity: deep-freeze inputs to ALL THREE operators; a mutation throws.
  const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  const frozenDelta = deepFreeze(makeDelta(L, { hinge: constSeries(L, { e: 2 }) }));
  let fThrew = false;
  try { detectFlaws(deepFreeze(svRows(L)), frozenDelta, 'elite'); } catch { fThrew = true; }
  check('F does not mutate frozen inputs', fThrew === false);
  const rep = makeReport({ squat: { phi: -0.9 }, hinge: { phi: -0.8 }, push_h: { phi: -0.7 } });
  const frozenRep = deepFreeze(JSON.parse(JSON.stringify(rep)));
  const frozenProf = deepFreeze(prof());
  let uThrew = false;
  try { const act = deriveControlAction(frozenRep, frozenProf, GPP); deriveDailyAdjustment(deepFreeze(act), ['squat', 'hinge'], frozenProf); } catch { uThrew = true; }
  check('u operators do not mutate frozen FlawReport / profile / action', uThrew === false);
}

// =============================================================================
// [2] closed-form correctness — analytic φ pins (S_max cancels)
// =============================================================================
console.log('[2] closed-form correctness (analytic phi pins)');
{
  const L = 21;
  const detect = (series, age = 'intermediate') => detectFlaws(svRows(L), makeDelta(L, { hinge: series }), age).patterns.hinge;

  const def = detect(constSeries(L, { e: 3.0 }));
  check('constant ΔE=+3 → φ=0.7, capacity_deficit', def.phi === 0.7 && def.flawClass === 'capacity_deficit', `${def.phi}/${def.flawClass}`);
  const head = detect(constSeries(L, { e: -3.0 }));
  check('constant ΔE=−3 → φ=−0.7, latent_headroom', head.phi === -0.7 && head.flawClass === 'latent_headroom', `${head.phi}/${head.flawClass}`);
  const mild = detect(constSeries(L, { e: 1.0 }));
  check('constant ΔE=+1 → φ=0.2333, neutral', mild.phi === 0.2333 && mild.flawClass === 'neutral', `${mild.phi}`);
  const att = detect(constSeries(L, { e: 3.0, w: 0.5 }));
  check('attenuation w=0.5 halves the signal: φ=0.35 (< 0.7)', att.phi === 0.35 && att.phi < def.phi, `${att.phi}`);
  // injury attenuation on the P branch + caution gate.
  const injP = detect(constSeries(L, { e: 3.0, j: 4 }));
  check('injury sev=triageMin attenuates P (φ=0.42) AND forces caution', injP.phi === 0.42 && injP.flawClass === 'caution', `${injP.phi}/${injP.flawClass}`);
  // ASYMMETRY: N (headroom) carries NO injury term — j must NOT attenuate −3.
  const injN = detect(constSeries(L, { e: -3.0, j: 4 }));
  check('headroom N is NOT injury-attenuated: φ stays −0.7 (caution) — not −0.42',
    injN.phi === -0.7 && injN.flawClass === 'caution', `${injN.phi}/${injN.flawClass}`);
  // F-stage deadband on D_norm and its strict-< boundary.
  const inBand = detect(constSeries(L, { e: 0.4 }));   // D_norm=0.1333 < 0.15 → zeroed
  check('F deadband: D_norm 0.1333 < δ → φ_base=0 → φ=0', inBand.phi === 0, `${inBand.phi}`);
  const onBand = detect(constSeries(L, { e: 0.45 }));  // D_norm=0.15, strict < → NOT zeroed
  check('F deadband strict-<: D_norm=0.15 NOT zeroed → φ=0.105', onBand.phi === 0.105, `${onBand.phi}`);
  // confidence gate.
  const thin = detect(constSeries(L, { e: 3.0, days: 4 }));
  check('thin data (4 obs < 5) → neutral regardless of ΔE', thin.flawClass === 'neutral' && thin.observations === 4, `obs=${thin.observations}`);
  // RECENCY direction ω=λ^(20-i): recent-only vs old-only with EXACT pins
  // (a reversed- or flat-ω mutant yields different exact φ; both are S_max-free).
  const recent6 = detect(atDays(L, [15, 16, 17, 18, 19, 20], { e: 3 }));
  const old6 = detect(atDays(L, [0, 1, 2, 3, 4, 5], { e: 3 }));
  check('recency: recent-only ΔE=+3 → φ=0.7009 (ω weights newest)', recent6.phi === 0.7009, `${recent6.phi}`);
  check('recency: old-only ΔE=+3 → φ=−0.2985 (old signal decays, trend negative)', old6.phi === -0.2985, `${old6.phi}`);
  check('recency direction pinned: φ(recent) ≫ φ(old)', recent6.phi > old6.phi);

  const rep = detectFlaws(svRows(L), makeDelta(L, { squat: constSeries(L, { e: -3 }), hinge: constSeries(L, { e: 3 }) }), 'intermediate');
  check('windowSummary picks max |φ| as criticalPattern',
    Math.abs(rep.patterns[rep.windowSummary.criticalPattern].phi) === rep.windowSummary.maxAbsPhi && rep.windowSummary.maxAbsPhi === 0.7);
  const empty = detectFlaws(svRows(L), makeDelta(L), 'intermediate');
  check('all-empty window → every φ=0, neutral, criticalPattern null',
    MOVEMENT_PATTERNS.every((p) => empty.patterns[p].phi === 0 && empty.patterns[p].flawClass === 'neutral') &&
    empty.windowSummary.criticalPattern === null && empty.windowSummary.dominantFlaw === 'neutral');
}

// =============================================================================
// [3] control-law table — φ band → exact correction row (incl. boundaries)
// =============================================================================
console.log('[3] control-law table (phi band -> correction, inclusive boundaries)');
{
  const u = (phi) => deriveControlAction(makeReport({ hinge: { phi } }), NEUTRAL_PROFILE, GPP).corrections.hinge;
  check('φ=0 (deadband) → {1.0,0,0,0}', eq(u(0), NEUTRAL_CORR));
  check('φ=0.5 (strong deficit) → {0.95,-1,-0.5,-1}', eq(u(0.5), { dLoad_p: 0.95, dSet_p: -1, dRpe_p: -0.5, prefBias_p: -1 }));
  check('φ=0.25 (mild deficit) → {1.0,-1,-0.5,-1}', eq(u(0.25), { dLoad_p: 1.0, dSet_p: -1, dRpe_p: -0.5, prefBias_p: -1 }));
  check('φ=-0.5 (strong headroom) → {1.05,+1,+0.5,+1}', eq(u(-0.5), { dLoad_p: 1.05, dSet_p: 1, dRpe_p: 0.5, prefBias_p: 1 }));
  check('φ=-0.25 (mild headroom) → {1.0,+1,+0.5,+1}', eq(u(-0.25), { dLoad_p: 1.0, dSet_p: 1, dRpe_p: 0.5, prefBias_p: 1 }));
  // inclusive boundaries: >= STRONG and >= DEADBAND (and their negatives).
  check('φ=0.4 exactly → strong deficit row (0.95), inclusive', eq(u(0.4), { dLoad_p: 0.95, dSet_p: -1, dRpe_p: -0.5, prefBias_p: -1 }));
  check('φ=-0.4 exactly → strong headroom row (1.05), inclusive', eq(u(-0.4), { dLoad_p: 1.05, dSet_p: 1, dRpe_p: 0.5, prefBias_p: 1 }));
  check('φ=0.15 exactly → mild deficit (NOT deadband), inclusive', eq(u(0.15), { dLoad_p: 1.0, dSet_p: -1, dRpe_p: -0.5, prefBias_p: -1 }));
  check('φ=-0.15 exactly → mild headroom (NOT deadband), inclusive', eq(u(-0.15), { dLoad_p: 1.0, dSet_p: 1, dRpe_p: 0.5, prefBias_p: 1 }));
  check('φ=0.149 (just inside deadband) → neutral', eq(u(0.149), NEUTRAL_CORR));
}

// =============================================================================
// [4] monotone-conservative under flags (incl. thin-data niggle — R2#1)
// =============================================================================
console.log('[4] monotone-conservative under flags');
{
  const raises = (c) => c.dLoad_p > 1 || c.dSet_p > 0 || c.dRpe_p > 0 || c.prefBias_p > 0;
  const cautionUp = deriveControlAction(makeReport({ hinge: { phi: -0.5, flawClass: 'caution' } }), NEUTRAL_PROFILE, GPP).corrections.hinge;
  check('caution pattern with headroom never raises', !raises(cautionUp) && cautionUp.dLoad_p <= 1 && cautionUp.dSet_p <= 0 && cautionUp.dRpe_p <= 0);
  const restr = makeReport(Object.fromEntries(MOVEMENT_PATTERNS.map((p, i) => [p, { phi: i % 2 ? -0.5 : 0.5 }])), { guardrail: guard({ load_multiplier: 0.9 }) });
  const uRestr = deriveControlAction(restr, NEUTRAL_PROFILE, GPP);
  check('restrictive guardrail: no pattern raises', MOVEMENT_PATTERNS.every((p) => !raises(uRestr.corrections[p])));
  const stillReduces = deriveControlAction(makeReport({ hinge: { phi: 0.5 } }, { guardrail: guard({ load_multiplier: 0.9, set_delta: -1, rpe_cap_max: 8 }) }), NEUTRAL_PROFILE, GPP).corrections.hinge;
  check('reductions pass through under a restrictive guardrail', stillReduces.dLoad_p === 0.95 && stillReduces.dSet_p === -1 && stillReduces.dRpe_p === -0.5);

  // R2#1: a severe niggle on THIN data (class collapsed to 'neutral' by the
  // obs gate) must NOT let headroom raise load into the injury.
  const injuredThin = makeReport({ hinge: { phi: -0.5993, flawClass: 'neutral', obs: 4, maxJointSev: 9 } });
  const uThin = deriveControlAction(injuredThin, NEUTRAL_PROFILE, GPP).corrections.hinge;
  check('THIN-DATA severe niggle + headroom φ → neutral, never raises (R2#1)', eq(uThin, NEUTRAL_CORR));
  const adjThin = deriveDailyAdjustment(deriveControlAction(injuredThin, NEUTRAL_PROFILE, GPP), ['hinge'], NEUTRAL_PROFILE);
  check('THIN-DATA niggle daily projection does not raise load/set/rpe', adjThin.load_modifier <= 1 && adjThin.set_modifier <= 0 && adjThin.rpe_cap <= NEUTRAL_PROFILE.base_rpe_cap);
  // the INDEPENDENT injury trigger: obs≥5, class 'neutral' but joint flagged → still no raise.
  const injuredFat = makeReport({ hinge: { phi: -0.5, flawClass: 'neutral', obs: 21, maxJointSev: 9 } });
  check('injured loaded joint (≥triageMin) blocks a raise even when class≠caution', !raises(deriveControlAction(injuredFat, NEUTRAL_PROFILE, GPP).corrections.hinge));
  // R2#2: thin data without a niggle → no action either direction.
  check('thin-data headroom (no niggle) → neutral (no raise)', eq(deriveControlAction(makeReport({ hinge: { phi: -0.6, obs: 4 } }), NEUTRAL_PROFILE, GPP).corrections.hinge, NEUTRAL_CORR));
  check('thin-data deficit → neutral (no action)', eq(deriveControlAction(makeReport({ hinge: { phi: 0.5, obs: 3 } }), NEUTRAL_PROFILE, GPP).corrections.hinge, NEUTRAL_CORR));
}

// =============================================================================
// [5] halt supremacy
// =============================================================================
console.log('[5] halt supremacy');
{
  const haltGuard = guard({ load_multiplier: 0.5, set_delta: -2, rpe_cap_max: 6, halt: true });
  const rep = makeReport(Object.fromEntries(MOVEMENT_PATTERNS.map((p, i) => [p, { phi: i % 2 ? 0.6 : -0.6 }])), { guardrail: haltGuard });
  const u = deriveControlAction(rep, NEUTRAL_PROFILE, GPP);
  check('halt → every correction exactly neutral, blockAddedSets=0',
    u.blockAddedSets === 0 && MOVEMENT_PATTERNS.every((p) => eq(u.corrections[p], NEUTRAL_CORR)));
  const adjHalt = deriveDailyAdjustment(u, ['hinge', 'squat'], NEUTRAL_PROFILE);
  check('halt daily projection: load 1.0, set 0, rpe = base cap (default 9.0)',
    adjHalt.load_modifier === 1.0 && adjHalt.set_modifier === 0 && adjHalt.rpe_cap === 9.0, JSON.stringify(adjHalt));
  // non-default base_rpe_cap exercises the clamp/snap under halt.
  const a7 = deriveDailyAdjustment(u, ['hinge', 'squat'], prof({ base_rpe_cap: 7.0 }));
  check('halt projection honors a non-default base_rpe_cap (7.0 → rpe_cap 7.0)', a7.rpe_cap === 7.0, `${a7.rpe_cap}`);
}

// =============================================================================
// [6] bounded authority / anti-windup
// =============================================================================
console.log('[6] bounded authority / anti-windup');
{
  // selection is by LOWEST φ, NOT declaration order: put the two lowest at LATE
  // declaration indices so an order-only mutant fails.
  const u = deriveControlAction(makeReport({
    squat: { phi: -0.2 }, hinge: { phi: -0.25 }, push_h: { phi: -0.3 },
    rotation: { phi: -0.8 }, locomotion: { phi: -0.9 },
  }), NEUTRAL_PROFILE, GPP);
  const added = MOVEMENT_PATTERNS.filter((p) => u.corrections[p].dSet_p > 0);
  check('total positive additions capped at MAX_ADDED_SETS (2)', u.blockAddedSets === CONTROL_AUTHORITY.MAX_ADDED_SETS && added.length === 2, `added=${added.join(',')}`);
  check('granted to the LOWEST-φ patterns (locomotion,rotation — late decl. order)', added.includes('locomotion') && added.includes('rotation'), added.join(','));
  // tie at the lowest φ → resolved by declaration order (rotation idx8 < isolation idx9 < locomotion idx10).
  const tie = deriveControlAction(makeReport({
    rotation: { phi: -0.9 }, isolation: { phi: -0.9 }, locomotion: { phi: -0.9 }, squat: { phi: -0.3 },
  }), NEUTRAL_PROFILE, GPP);
  const tieAdded = MOVEMENT_PATTERNS.filter((p) => tie.corrections[p].dSet_p > 0);
  check('φ tie → kept by declaration order (rotation,isolation)', eq(tieAdded.sort(), ['isolation', 'rotation']), tieAdded.join(','));

  let bounded = true;
  for (let phi = -1; phi <= 1.0001; phi += 0.05) {
    const c = deriveControlAction(makeReport({ hinge: { phi } }), NEUTRAL_PROFILE, GPP).corrections.hinge;
    if (![-1, 0, 1].includes(c.dSet_p) || ![0.95, 1.0, 1.05].includes(c.dLoad_p) || ![-0.5, 0, 0.5].includes(c.dRpe_p) || ![-1, 0, 1].includes(c.prefBias_p)) bounded = false;
  }
  check('per-pattern: dSet∈{-1,0,1}, dLoad∈{0.95,1,1.05}, dRpe∈{-0.5,0,0.5}, pref∈{-1,0,1}', bounded);
  check('LOAD_STEP equals the adjacent literal difference (0.05)', CONTROL_AUTHORITY.LOAD_STEP === 0.05);
}

// =============================================================================
// [7] domain closure (ACTUAL produced values, base_rpe_cap ceiling)
// =============================================================================
console.log('[7] domain closure');
{
  const LOADS = new Set(LOAD_MODIFIER_LITERALS.map(Number));
  const SETS = new Set(SET_MODIFIER_LITERALS.map(Number));
  const RPES = new Set(RPE_CAP_LITERALS.map(Number));
  const phiVals = [-0.9, -0.5, -0.25, -0.1, 0, 0.1, 0.25, 0.5, 0.9];
  let validOk = true; let idempotent = true; let inDomain = true; let underCap = true; let n = 0;
  const producedLoads = new Set(); const producedSets = new Set(); const producedRpe = new Set();
  for (const a of phiVals) for (const b of phiVals) {
    const u = deriveControlAction(makeReport({ hinge: { phi: a }, squat: { phi: b } }), NEUTRAL_PROFILE, GPP);
    for (const cap of [5.0, 6.5, 8.0, 9.0, 10.0]) {
      const adj = deriveDailyAdjustment(u, ['hinge', 'squat'], prof({ base_rpe_cap: cap }));
      n += 1;
      producedLoads.add(adj.load_modifier); producedSets.add(adj.set_modifier); producedRpe.add(adj.rpe_cap);
      try { validateAdjustment(adj); } catch { validOk = false; }
      if (!eq(clampAdjustment(adj), adj)) idempotent = false;
      if (!LOADS.has(adj.load_modifier) || !SETS.has(adj.set_modifier) || !RPES.has(adj.rpe_cap)) inDomain = false;
      // rpe_cap never exceeds base_rpe_cap (except the 6.5 vocabulary floor for sub-6.5 caps).
      if (adj.rpe_cap > Math.max(cap, 6.5)) underCap = false;
    }
  }
  check('daily projection always passes validateAdjustment (literals + cue)', validOk, `${n} projections`);
  check('clampAdjustment idempotent on every projection', idempotent);
  check('ACTUAL produced load/set/rpe values all lie in the literal domains', inDomain,
    `loads=${[...producedLoads].sort().join(',')} sets=${[...producedSets].sort().join(',')}`);
  check('daily rpe_cap NEVER exceeds base_rpe_cap (R2#3 fix; 6.5 vocab floor aside)', underCap);
  // value pins: deficit pulls the session down (min-composition); headroom can't push past base.
  const uMix = deriveControlAction(makeReport({ hinge: { phi: 0.5 }, squat: { phi: -0.5 } }), NEUTRAL_PROFILE, GPP);
  const adjMix = deriveDailyAdjustment(uMix, ['hinge', 'squat'], NEUTRAL_PROFILE);
  check('min-composition: a deficit pattern pulls the whole session down', adjMix.load_modifier === 0.95 && adjMix.set_modifier === -1 && adjMix.rpe_cap === 8.5, JSON.stringify(adjMix));
  const uUp = deriveControlAction(makeReport({ hinge: { phi: -0.5 } }), NEUTRAL_PROFILE, GPP);
  check('headroom at base_rpe_cap=8.0 → rpe_cap pinned to 8.0 (NOT 8.5)', deriveDailyAdjustment(uUp, ['hinge'], prof({ base_rpe_cap: 8.0 })).rpe_cap === 8.0);
  check('base_rpe_cap=5.0 → rpe_cap snaps to the 6.5 vocabulary floor', deriveDailyAdjustment(uUp, ['hinge'], prof({ base_rpe_cap: 5.0 })).rpe_cap === 6.5);
  const none = deriveDailyAdjustment(uUp, [], NEUTRAL_PROFILE);
  check('empty day projection → neutral defaults, valid', none.load_modifier === 1.0 && none.set_modifier === 0);
}

// =============================================================================
// [8] volume bifurcation — source tripwire + behavioural proof
// =============================================================================
console.log('[8] volume bifurcation');
{
  const src = readFileSync(join(import.meta.dirname, '..', 'src', 'kinematicAutopilot.ts'), 'utf-8');
  check('module imports nothing from core-db', !/from\s+['"][^'"]*core-db/.test(src));
  check('no SQL writes / DatabaseSync / db access', !/\b(INSERT|UPDATE|DELETE)\s/i.test(src) && !/DatabaseSync|db\.(exec|prepare)/.test(src) && !/require\s*\(/.test(src));
  const imports = [...new Set([...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]))].sort();
  check('imports limited to ./types, ./outputSchema, ./semantic/codebase', eq(imports, ['./outputSchema', './semantic/codebase', './types']), imports.join(','));
  // BEHAVIOURAL: F must ignore the raw acwr / acute / chronic fields entirely —
  // poisoning them must not change the FlawReport (it reads only effective signal).
  const L = 21; const delta = makeDelta(L, { hinge: constSeries(L, { e: 2 }), squat: constSeries(L, { e: -2, j: 5 }) });
  const clean = detectFlaws(svRowsFull(L, 1.2), delta, 'advanced');
  const poisoned = detectFlaws(svRowsFull(L, NaN), delta, 'advanced');
  const spiked = detectFlaws(svRowsFull(L, 999), delta, 'advanced');
  check('F output is invariant to acwr/acute/chronic poisoning (never reads the raw pipeline)', eq(clean, poisoned) && eq(clean, spiked));
}

// =============================================================================
// [9] edge / fail-safe (finite, no throw, fails SAFE)
// =============================================================================
console.log('[9] edge / fail-safe');
{
  const finite = (r) => MOVEMENT_PATTERNS.every((p) => Number.isFinite(r.patterns[p].phi));
  check('empty window: all φ finite, criticalPattern null', finite(detectFlaws([], makeDelta(0), 'beginner')) && detectFlaws([], makeDelta(0), 'beginner').windowSummary.criticalPattern === null);
  check('short window L=3: finite, no throw', finite(detectFlaws(svRows(3), makeDelta(3, { hinge: constSeries(3, { e: 3 }) }), 'elite')));
  const ragged = makeDelta(21, { hinge: { avgDeltaRPE: [3, 3, 3], avgAttenuation: [1, 1], setCount: [1, 1, 1], maxJointSev: [0] } });
  let raggedOk = true; try { raggedOk = finite(detectFlaws(svRows(21), ragged, 'intermediate')); } catch { raggedOk = false; }
  check('ragged (short) per-pattern arrays: defensive, finite, no throw', raggedOk);
  // NaN / Infinity / negative-weight injection must NOT poison φ (sanitized at the boundary).
  const L = 21;
  const nanE = detectFlaws(svRows(L), makeDelta(L, { hinge: atDays(L, [18, 19, 20], { e: NaN }) }), 'intermediate').patterns.hinge;
  check('NaN in avgDeltaRPE → φ finite (=0), not NaN', Number.isFinite(nanE.phi) && nanE.phi === 0, `${nanE.phi}`);
  const infW = detectFlaws(svRows(L), makeDelta(L, { hinge: atDays(L, [15, 16, 17, 18, 19, 20], { e: 3, w: Infinity }) }), 'intermediate').patterns.hinge;
  check('Infinity in avgAttenuation → φ finite & clamped', Number.isFinite(infW.phi) && infW.phi >= -1 && infW.phi <= 1, `${infW.phi}`);
  const negW = detectFlaws(svRows(L), makeDelta(L, { hinge: constSeries(L, { e: 3, w: -5 }) }), 'intermediate').patterns.hinge;
  check('negative avgAttenuation cannot flip control direction (clamped to 0)', Number.isFinite(negW.phi) && negW.phi <= 0.001, `${negW.phi}`);
  // steep trend (gap that would overflow exp()) → tanh clamped → finite.
  const steep = detectFlaws(svRows(L), makeDelta(L, { hinge: { avgDeltaRPE: Array.from({ length: L }, (_, i) => i < 7 ? -1e6 : i >= 14 ? 1e6 : null), avgAttenuation: zeros(L).map(() => 1), setCount: zeros(L).map(() => 1), maxJointSev: zeros(L) } }), 'intermediate').patterns.hinge;
  check('steep trend (>exp overflow) → φ finite, ∈[-1,1]', Number.isFinite(steep.phi) && steep.phi >= -1 && steep.phi <= 1, `${steep.phi}`);
  // a non-finite φ reaching u must FAIL SAFE (neutral), never raise.
  const nanU = deriveControlAction(makeReport({ hinge: { phi: NaN } }), NEUTRAL_PROFILE, GPP).corrections.hinge;
  check('non-finite φ in u → neutral (fail-safe, never raises)', eq(nanU, NEUTRAL_CORR));
}

// =============================================================================
// [10] constant contract
// =============================================================================
console.log('[10] constant contract');
{
  const F = FLAW_DETECTION_CONSTANTS;
  check('FLAW_DETECTION_CONSTANTS pinned', F.LAMBDA === 0.88 && F.E_MAX === 3.0 && F.J_MAX === 10 && F.DELTA === 0.15 && F.W_BASE === 0.7 && F.W_TREND === 0.3 && F.T_SCALE === 1.0 && F.MIN_OBSERVATIONS === 5 && F.THETA_DEFICIT === 0.3 && F.THETA_HEADROOM === 0.3);
  check('CONTROL_AUTHORITY pinned', CONTROL_AUTHORITY.MAX_ADDED_SETS === 2 && CONTROL_AUTHORITY.DEADBAND === 0.15 && CONTROL_AUTHORITY.STRONG_THRESHOLD === 0.4 && CONTROL_AUTHORITY.RPE_STEP === 0.5 && CONTROL_AUTHORITY.SET_STEP === 1 && CONTROL_AUTHORITY.LOAD_STEP === 0.05);
  check('NEUTRAL_LOAD_MODIFIER === 1.0', NEUTRAL_LOAD_MODIFIER === 1.0);
  check('EXPERIENCE_SEVERITY.intermediate.triageMin === 4', EXPERIENCE_SEVERITY.intermediate.triageMin === 4);
  check('snapToLiteral nearest', snapToLiteral(0.93, LOAD_MODIFIER_LITERALS) === 0.95 && snapToLiteral(0.86, LOAD_MODIFIER_LITERALS) === 0.85);
  check('snapToLiteral tie → lower', snapToLiteral(7.25, RPE_CAP_LITERALS) === 7.0);
  check('snapToLiteral clamps below-range to the floor literal', snapToLiteral(5.0, RPE_CAP_LITERALS) === 6.5);
}

// =============================================================================
// [11] window projection (buildPatternWindow — Phase 13 Step 4 hydration)
// =============================================================================
console.log('[11] window projection (buildPatternWindow)');
{
  const dates = ['2026-06-01', '2026-06-02', '2026-06-03'];
  const setRows = [
    { date: '2026-06-02', pattern: 'squat', setCount: 2, sumDeltaRpe: 3.0, deltaCount: 2, sumAttenuation: 1.5 },
    { date: '2026-06-03', pattern: 'hinge', setCount: 1, sumDeltaRpe: -1.0, deltaCount: 1, sumAttenuation: 1.0 },
  ];
  const niggleRows = [
    { date: '2026-06-02', region: 'knee', severity: 5 },
    { date: '2026-06-02', region: 'knee', severity: 7 }, // max wins
    { date: '2026-06-03', region: 'shoulder', severity: 4 },
  ];
  const w = buildPatternWindow(dates, setRows, niggleRows);
  check('arrays align to windowDates length (all 11 patterns)',
    MOVEMENT_PATTERNS.every((p) => w[p].avgDeltaRPE.length === 3 && w[p].avgAttenuation.length === 3 && w[p].setCount.length === 3 && w[p].maxJointSev.length === 3));
  check('squat day-2 pivot: setCount=2, avgΔ=1.5, avgAtten=0.75',
    w.squat.setCount[1] === 2 && w.squat.avgDeltaRPE[1] === 1.5 && w.squat.avgAttenuation[1] === 0.75,
    `${w.squat.setCount[1]}/${w.squat.avgDeltaRPE[1]}/${w.squat.avgAttenuation[1]}`);
  check('gap days are zero/null (squat day-1 empty)',
    w.squat.setCount[0] === 0 && w.squat.avgDeltaRPE[0] === null && w.squat.avgAttenuation[0] === 0);
  check('knee niggle (max sev 7) maps to squat (loads knee) but NOT push_h',
    w.squat.maxJointSev[1] === 7 && w.push_h.maxJointSev[1] === 0, `squat=${w.squat.maxJointSev[1]} push_h=${w.push_h.maxJointSev[1]}`);
  check('hinge day-3 headroom pivot: avgΔ=−1.0', w.hinge.avgDeltaRPE[2] === -1.0);
  check('a pattern with no rows is fully empty (locomotion)',
    w.locomotion.setCount.every((n) => n === 0) && w.locomotion.avgDeltaRPE.every((e) => e === null));
  // end-to-end: projected rows feed detectFlaws and reproduce the analytic pin.
  const dates21 = Array.from({ length: 21 }, (_, i) => `2026-06-${String(i + 1).padStart(2, '0')}`);
  const sr = dates21.map((d) => ({ date: d, pattern: 'hinge', setCount: 1, sumDeltaRpe: 3.0, deltaCount: 1, sumAttenuation: 1.0 }));
  const rep = detectFlaws(svRows(21), buildPatternWindow(dates21, sr, []), 'intermediate');
  check('projected constant ΔE=+3 hinge → φ=0.7 capacity_deficit (end-to-end)',
    rep.patterns.hinge.phi === 0.7 && rep.patterns.hinge.flawClass === 'capacity_deficit', `${rep.patterns.hinge.phi}`);
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail ? 1 : 0);
