# TASK FOR DeepSeek-R1 — Pure Math Functor `M`: Derive the Kinematic Autopilot

You are **`M`**, a deterministic mathematical-reasoning functor inside a multi-agent pipeline. You are NOT writing application code, UI, or I/O. You are deriving the **pure control-theory mathematics** that will be hand-compiled into an existing TypeScript inference engine for an on-device strength-and-grappling coaching app (**Athlete Kinetics**).

Your deliverable: model the athlete as a discrete-time **state vector `s_t`**, derive a **Flaw-Detection operator `F`** over a 3-week trailing window, and derive a deterministic **Control Action `u_{t+1}`** that auto-corrects the next 4-week training block. Everything you emit must reduce to closed-form arithmetic over fixed-length numeric arrays.

Read every constraint below before deriving. The interfaces and formulas in §3 are the **real, shipped boundaries** — your math must consume and produce these exact shapes, not idealized substitutes.

---

## 0. OUTPUT CONTRACT (obey exactly)

1. Put **all** reasoning, scratch algebra, case analysis, and trade-off discussion inside `<thinking>` … `</thinking>` tags. Be exhaustive in there.
2. **After** the closing `</thinking>` tag, emit only the final artifact, in this order:
   - **`F` — Flaw Detection**: the closed-form formulas, then the TypeScript **interface/function signatures** (signatures + doc comments only — no bodies unless a body is a one-line pure expression).
   - **`u_{t+1}` — Control Action**: the closed-form mapping `F → u`, then the TypeScript interface/function signatures.
   - **Constant tables**: every coefficient, threshold, decay rate, and clamp you introduce, as named `const` data tables (mirroring the style of `PHASE_MODS` / `EXPERIENCE_TRIAGE` in §3).
   - **Invariant list**: the machine-checkable properties your math guarantees (determinism, monotone-conservatism, domain-closure, bounds).
3. Formulas must be explicit. No "fit a regression" / "use an optimizer" / "apply a Kalman filter" hand-waves: if you want a slope, write the normal-equation closed form over the array; if you want a filter, write the scalar recurrence. Anything you name, you define.

---

## 1. SYSTEM CONSTRAINTS (non-negotiable — your math fails review if it violates these)

- **450 MB hard edge-compute envelope.** The entire app (RN/Hermes runtime + SQLite + intelligence layer) is audited against a 450 MB peak-RSS gate in CI (`tools/memory-audit`, currently ~450.1 MiB peak). Your algorithm runs in the **~100 MB transient** intelligence budget. No allocation that scales with history beyond the bounded trailing window. Fixed-length `Float32Array`/`number[]` only.
- **Pure TypeScript runtime, fully on-device, offline.** Output is hand-translated to pure TS (strict mode). No native math libs, no BLAS/linear-algebra packages, no matrix types, no autodiff. Permitted primitives: `+ - * /`, `Math.{min,max,abs,round,sqrt,log,exp,pow}`, comparisons, and array reduces. If you need `ln`/`sqrt`/`exp`, they are available; nothing else transcendental.
- **Determinism is a verified invariant.** No clock reads, no `Date.now()`, no randomness, no floating-point order dependence in reductions. Same persisted inputs ⇒ byte-identical output (double-run deep-equality is a CI gate). Use **fixed rounding** exactly like the codebase: `round2(n)=Math.round(n*100)/100`, `round4(n)=Math.round(n*1e4)/1e4`. RPE rounds to the nearest 0.5 (`Math.round(x*2)/2`); kg rounds to 2.5 kg plates.
- **SQLite (WAL mode) read/write limits.** Single-writer WAL; readers see a snapshot. The flaw detector is a **read-only trailing-window scan** — it consumes at most the last **21 daily rows** of `state_vector` (a clustered `WITHOUT ROWID` range scan, like the existing 14-day trend read) plus the windowed `set_record`/`niggle` aggregates. It must NOT aggregate raw sets at read time beyond what the rollups below already expose. The control action `u_{t+1}` must be applied as a **single bounded upsert** (a side-car row keyed on a parent PK, FK-cascaded — the established `slot_override` / `set_prefix` pattern), never a multi-statement migration or a hot-path table rewrite. Absent calendar days are **zero-load days**, not missing rows (gap-tolerant calendar `RANGE` windows — see §3).
- **No LLM at runtime (see §5).**

---

## 2. THE STATE VECTOR `s_t`

Model the athlete on calendar day `t` (ISO `YYYY-MM-DD`, lexicographic = chronologic) as:

```
s_t = ( V_t , I_t , C_t , ΔE_t )
```

Each component already has a **persisted, deterministic source** in the schema. Use these sources — do not invent new sensors.

- **`V_t` — Mechanical Volume (Raw & Effective Tonnage).**
  - *Raw tonnage* (per set): `tonnage_kg = reps · load_kg` (a SQLite `GENERATED ... STORED` column), summed per day into `mech_daily.tonnage_kg`.
  - *Effective tonnage* (per set): `effective_load_kg` from the condition fold (§3 `calculateEffectiveLoad`): `effectiveLoad = baseLoad · ∏ difficultyModifier`. Persisted per set in `set_prefix`. **Bifurcation invariant:** raw tonnage feeds ACWR/readiness; effective tonnage is a *separate* recoverable signal — never conflate them.
  - *Rolling load*: `acute_load_kg` = mean daily tonnage over the trailing 7 calendar days; `chronic_load_kg` = mean over 28; `acwr = acute/chronic` (defined only when `chronic_load_kg > 1.0`).
- **`I_t` — Injury / Niggle severity matrix.** Source: `niggle(region, severity, reported_at_ms)`, append-only. `region ∈ JOINTS` (9 joints, §3). `severity ∈ [1,10]` integer. Map to structures via `PATTERN_JOINTS` (movement-pattern → loaded joints). The operative/halt thresholds are **experience-weighted** via `EXPERIENCE_SEVERITY[trainingAge]` (§3). Treat `I_t` as a per-joint severity signal over the window (you choose the decay/aggregation, but justify it and keep it bounded).
- **`C_t` — Daily Condition / Readiness.** Source: `state_vector.readiness_score ∈ [0,100]` and its four sub-components, computed by the materializer (§3): `readiness = 0.35·hrv + 0.30·load + 0.25·sleep + 0.10·spo2`. Each sub-component ∈ [0,100], 50 = neutral/no-data.
- **`ΔE_t` — RPE Error Delta.** The signed gap between **prescribed** effort and **reported actual** effort, per movement pattern:
  ```
  ΔE(slot) = rpe_actual − rpe_target
           = set_record.rpe  −  PlannedSlotPlan.target_rpe
  ```
  `rpe_target` is the planned slot effort (§3 `PlannedSlotPlan.target_rpe ∈ [5.0,10.0]`). `rpe_actual` is the logged `set_record.rpe ∈ [0,10]`. **Sign convention:** `ΔE > 0` ⇒ the athlete reported the work *harder than programmed* (under-recovery / capacity deficit for that pattern); `ΔE < 0` ⇒ easier than programmed (latent headroom). Aggregate per `MovementPattern` (and, via `PATTERN_TO_CATEGORY` / `PATTERN_JOINTS`, per category/joint).

---

## 3. CODEBASE STATE — exact interfaces & mathematical boundaries

These are extracted verbatim (comments trimmed) from `packages/inference` and `packages/core-db`. Your derivations must type-check against them.

### 3.1 Movement taxonomy (the index set of your per-pattern math)

```ts
export const MOVEMENT_PATTERNS = [
  'squat','hinge','push_h','push_v','pull_h','pull_v',
  'lunge','carry','rotation','isolation','locomotion',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const PATTERN_TO_CATEGORY: Record<MovementPattern, TaxonomyCategory> = {
  squat:'squat', hinge:'hinge', push_h:'push', push_v:'push',
  pull_h:'row', pull_v:'row', lunge:'unilateral', carry:'accessory',
  rotation:'core', isolation:'accessory', locomotion:'cardio',
};
```

### 3.2 `PlannedSlotPlan` — one prescribed working slot (the thing `u_{t+1}` rewrites)

```ts
export interface PlannedSlotPlan {
  slot_index: number;   // 1-based
  movement_id: number;
  sets: number;         // 1..10 (schema CHECK)
  reps: number;         // 1..30
  target_rpe: number;   // 5.0..10.0  (PRESCRIBED effort — the ΔE reference)
  applied_prefixes?: readonly MovementPrefix[]; // Phase-13 condition tokens
}
```

### 3.3 RPE scale & boundaries (single source of truth)

- Logged/raw RPE domain (`set_record.rpe`, `session.session_rpe`, `target_avg_rpe`): **`REAL BETWEEN 0 AND 10`** (nullable).
- Prescribed slot RPE (`PlannedSlotPlan.target_rpe`): **`[5.0, 10.0]`**, the block generator floors at 5.0 and rounds to 0.5.
- Athlete effort ceiling `base_rpe_cap`: **`[5.0, 10.0]` in 0.5 steps**.
- Hard caps already enforced (monotone-conservative chain): **rehab ≤ 7.0**, **beginner ≤ 8.5**, **any flagged/restrictive report ≤ 8.0** (`FLAGGED_RPE_CEILING`).
- Reps-in-reserve identity used for %1RM: **`RIR = 10 − rpe`**.
- Discrete output RPE-cap vocabulary (`RPE_CAP_LITERALS`): `['6.5','7.0','7.5','8.0','8.5','9.0','9.5','10.0']`.

### 3.4 `effectiveLoad` — the condition fold (pure, order-independent)

```ts
export interface MovementPrefixCondition {
  prefixName: MovementPrefix;
  cnsLoadModifier: number;              // > 0, 1.0 = neutral
  stabilityRequirementModifier: number; // > 0, 1.0 = neutral
  difficultyModifier: number;           // > 0, 1.0 = neutral
}

export interface EffectiveLoad {
  baseLoad: number;       // clamp(base, ≥0)
  effectiveLoad: number;  // baseLoad · ∏ difficultyModifier   ("feels-like" kg)
  cnsLoad: number;        // baseLoad · ∏ cnsLoadModifier
  stabilityDemand: number;// ∏ stabilityRequirementModifier    (dimensionless)
  appliedPrefixes: readonly MovementPrefix[];
}

// safeBase = (isFinite(baseLoad) && baseLoad>0) ? baseLoad : 0
// each modifier m>0 else coerced to 1  (guards the product)
// return { baseLoad: round2(safeBase),
//          effectiveLoad: round2(safeBase·∏diff),
//          cnsLoad: round2(safeBase·∏cns),
//          stabilityDemand: round4(∏stab), appliedPrefixes }
export function calculateEffectiveLoad(
  baseLoad: number,
  prefixModifiers: readonly MovementPrefixCondition[],
): EffectiveLoad;
```

### 3.5 `AdjustmentVector` — the existing daily control output (your `u` must compose with this)

```ts
export const LOAD_MODIFIER_LITERALS = ['0.80','0.85','0.90','0.95','1.00','1.05'] as const;
export const SET_MODIFIER_LITERALS  = ['-2','-1','0','1'] as const;
export const RPE_CAP_LITERALS        = ['6.5','7.0','7.5','8.0','8.5','9.0','9.5','10.0'] as const;

export interface AdjustmentVector {
  load_modifier: number;  // multiplier on today's planned working weights
  set_modifier: number;   // delta on planned working sets per movement
  rpe_cap: number;        // hard RPE ceiling for the session
  coaching_cue: string;   // one blunt mechanical-rationale sentence (12..140 chars)
}

export const NEUTRAL_ADJUSTMENT: AdjustmentVector =
  { load_modifier:1.0, set_modifier:0, rpe_cap:9.0, coaching_cue:'…execute as written.' };

export const SET_MODIFIER_FLOOR = -3; // penalties never stack below this
// Final defensive clamp (idempotent, no-op on valid vectors):
export function clampAdjustment(v: AdjustmentVector): AdjustmentVector;
//   load_modifier: max(0, v.load_modifier)
//   set_modifier : max(SET_MODIFIER_FLOOR, v.set_modifier)
//   rpe_cap      : min(10, max(0, v.rpe_cap))
```

### 3.6 `Guardrail` — the restrictive-report shape (for safety composition)

```ts
export interface Guardrail {
  load_multiplier: number; // ≤ 1 when restrictive
  set_delta: number;       // ≤ 0 when restrictive
  rpe_cap_max: number;     // < 10 when restrictive
  halt: boolean;           // hard stop — NEVER relaxed by re-derivation
  follow_up: string | null;
}
```

### 3.7 Experience weighting (DOMS-vs-structural — already shipped)

```ts
export const EXPERIENCE_SEVERITY: Record<TrainingAge,{triageMin:number;haltMin:number}> = {
  beginner:{triageMin:5,haltMin:8}, intermediate:{triageMin:4,haltMin:8},
  advanced:{triageMin:3,haltMin:7}, elite:{triageMin:3,haltMin:6},
};
export const EXPERIENCE_TRIAGE: Record<TrainingAge,
  {loadScale:number;capDelta:number;extraSetCut:number}> = {
  beginner:{loadScale:1.2,capDelta:2.0,extraSetCut:0},
  intermediate:{loadScale:1.0,capDelta:0.0,extraSetCut:0},
  advanced:{loadScale:0.9,capDelta:-0.5,extraSetCut:0},
  elite:{loadScale:0.8,capDelta:-1.0,extraSetCut:1},
};
// TrainingAge = 'beginner'|'intermediate'|'advanced'|'elite'
```

### 3.8 Injury structures (`I_t` boundary)

```ts
export const JOINTS = ['knee','hip','ankle','shoulder','elbow','wrist',
  'lower_back','spine','neck'] as const;            // == niggle.region CHECK domain
export const PATTERN_JOINTS: Record<MovementPattern, readonly Joint[]> = {
  squat:['knee','hip'], hinge:['hip','lower_back'],
  push_h:['shoulder','elbow'], push_v:['shoulder','elbow'],
  pull_h:['shoulder','elbow'], pull_v:['shoulder','elbow'],
  lunge:['knee','hip','ankle'], carry:['shoulder'], rotation:['spine'],
  isolation:[], locomotion:['knee','ankle'],
};
// niggle row: { region∈JOINTS, severity INTEGER 1..10, reported_at_ms INTEGER }
```

### 3.9 Block-template math (what `u_{t+1}` perturbs)

```ts
// Per-objective base scheme; rpeWave is weeks 1..3, week 4 = deload.
const SCHEMES: Record<Objective, {reps:number;sets:number;rpeWave:[number,number,number]}> = {
  strength:{reps:5,sets:4,rpeWave:[7.5,8.0,8.5]}, power:{reps:3,sets:5,rpeWave:[7.0,7.5,8.0]},
  hypertrophy:{reps:10,sets:4,rpeWave:[7.5,8.0,8.5]}, endurance:{reps:15,sets:3,rpeWave:[6.5,7.0,7.5]},
  gpp:{reps:8,sets:3,rpeWave:[7.0,7.5,8.0]}, hybrid:{reps:5,sets:4,rpeWave:[7.5,8.0,8.5]},
  rehab:{reps:12,sets:3,rpeWave:[6.0,6.5,7.0]}, weight_loss:{reps:12,sets:3,rpeWave:[7.0,7.5,8.0]},
};
const PHASE_MODS: Record<MacroPhase,{reps:number;rpe:number;sets:number}> = {
  gpp:{reps:2,rpe:-0.5,sets:0}, hypertrophy:{reps:3,rpe:0,sets:0},
  volume:{reps:0,rpe:0,sets:1}, peak:{reps:-2,rpe:0.5,sets:0},
};
export const SCHEMA_FATIGUE_COST: Record<SchemaType,Record<MacroPhase,number>> = {
  LINEAR:{gpp:1.0,hypertrophy:1.1,volume:1.2,peak:1.2}, WAVE:{gpp:1.1,hypertrophy:1.2,volume:1.3,peak:1.3},
  STEP:{gpp:1.1,hypertrophy:1.2,volume:1.4,peak:1.3}, APRE:{gpp:1.3,hypertrophy:1.4,volume:1.5,peak:1.6},
};
export const HYBRID_TAX_THRESHOLD = 1.3;   // ≥ strips 1 accessory set, ≥1.5 strips 2
export const OVERREACH_ACWR = 1.5;         // peak-block deadlift auto-regulation gate
export const BLOCK_WEEKS = 4;              // accumulation→intensification→realization→deload

// RPE/rep → %1RM (Epley) and physical target weight (2.5 kg plate rounding):
export const targetPct = (reps:number, rpe:number): number =>
  1 / (1 + (reps + Math.max(0, 10 - rpe)) / 30);
export const targetLoadKg = (oneRmKg:number, reps:number, rpe:number): number =>
  Math.max(0, Math.round((oneRmKg * targetPct(reps,rpe)) / 2.5) * 2.5);
```

### 3.10 Readiness materializer (`C_t` boundary) & windowed features (`V_t` boundary)

```
hrv_z          = (ln_rmssd − baseline_mean) / baseline_sd        -- baseline over [28d..1d) PRECEDING
hrv_component  = clamp(50 + 25·hrv_z, 0, 100)                     -- 50 if null
load_component = acwr<0.8 : clamp(100 − (0.8−acwr)·125, 0, 100)   -- detraining penalty 125/unit
                 0.8≤acwr≤1.3 : 100                               -- sweet spot
                 acwr>1.3 : clamp(100 − (acwr−1.3)·200, 0, 100)   -- spike penalty 200/unit
                 acwr null : 50
sleep_component= clamp((sleep_eff_pct − 65)·(100/30), 0, 100)     -- 50 if null
spo2_component = clamp((spo2_night_mean − 90)·(100/7), 0, 100)    -- 50 if null
readiness      = round(0.35·hrv + 0.30·load + 0.25·sleep + 0.10·spo2, 1)

acute_load_kg   = Σ tonnage_kg over RANGE [6 PRECEDING, CURRENT]  / 7.0   -- absent day = 0
chronic_load_kg = Σ tonnage_kg over RANGE [27 PRECEDING, CURRENT] / 28.0
acwr            = chronic_load_kg > 1.0 ? acute_load_kg / chronic_load_kg : NULL
```

`StateVectorRow` (the only inference read surface, one clustered PK row per day):

```ts
export interface StateVectorRow {
  date: string; readiness_score: number;
  hrv_component: number; load_component: number; sleep_component: number; spo2_component: number;
  acwr: number|null; acute_load_kg: number|null; chronic_load_kg: number|null;
  ln_rmssd: number|null; hrv_z: number|null;
  sleep_efficiency_pct: number|null; spo2_night_mean: number|null; computed_at_ms: number;
}
```

---

## 4. YOUR DERIVATION TASK

Derive two operators. Treat the next block as a 4-week horizon; the trailing window is **W = 21 days** (3 micro-weeks), gap-tolerant on the calendar exactly like the 7/28-day windows above.

### 4.1 `F` — Flaw-Detection operator (the observer)

Define `F` as a pure map from the windowed history to a **per-pattern flaw signal**:

```
F : { StateVectorRow[≤21], perPatternΔE[≤21], niggleRows[window] }  ⟶  FlawReport
```

Requirements:
- Produce, per `MovementPattern p` (11 of them), a bounded **deficit score** `φ_p ∈ [−1, 1]` (or a documented bounded range) built from:
  - the **persistence and magnitude of `ΔE_p > 0`** across the window (your example case: persistent `ΔE > 0` on `hinge` ⇒ posterior-chain deficit). Specify the exact aggregation — e.g. a fixed-λ EWMA or a windowed mean with a `persistence` count — as a closed-form recurrence/sum over the array. No library calls.
  - a **condition-weighted** adjustment using `cnsLoad` / `stabilityDemand` from §3.4 where prefixes were applied (a hard `ΔE>0` under a low-CNS condition is more diagnostic than under an `Earthquake Bar`).
  - the **joint-injury coupling** via `PATTERN_JOINTS` ∩ `I_t`: an injured loaded joint must *attenuate* a "train it harder" deficit reading (you never chase a deficit through a niggle).
  - a **trend** term (sign of change across the window) — give the explicit 2-point or least-squares-slope closed form over the daily array.
- Emit a discrete **flaw class** per pattern from a fixed enum you define (e.g. `'capacity_deficit' | 'latent_headroom' | 'fatigue_masking' | 'neutral'`), via deterministic thresholds on `φ_p` (thresholds as a named constant table).
- Confidence gating: a pattern with too few logged sets in the window (below a fixed `MIN_OBSERVATIONS`) returns `'neutral'` (no action on thin data — mirror the existing 0.55 confidence-gate philosophy).
- Output a `FlawReport` interface: per-pattern `{ pattern, phi, flawClass, observations }` plus a window-level summary.

### 4.2 `u_{t+1}` — Control Action (the deterministic controller)

Define `u_{t+1} = g(FlawReport, profile, macroPhase)` that auto-corrects the **next** block. It must be expressible as a perturbation of the §3.9 generator tables and must **degrade to the existing `AdjustmentVector` domain** at the daily grain. Concretely, derive:

- A **per-pattern correction** `u_p = { dLoad_p, dSet_p, dRpe_p, prefBias_p }` where:
  - `dRpe_p` adjusts the prescribed `rpeWave` / slot `target_rpe` for pattern `p` (a `capacity_deficit` lowers prescribed effort to close `ΔE`; `latent_headroom` may raise it — but **never above** the §3.3 ceilings or `base_rpe_cap`).
  - `dSet_p` adds/removes **corrective accessory volume** for the deficit's category (`PATTERN_TO_CATEGORY`), **budget-bounded** by `SCHEMA_FATIGUE_COST` / `HYBRID_TAX_THRESHOLD` (no CNS overspend) and floored at `SET_MODIFIER_FLOOR`.
  - `dLoad_p` is snapped onto `LOAD_MODIFIER_LITERALS` when surfaced as a daily `AdjustmentVector.load_modifier`.
  - `prefBias_p ∈ {−1,0,+1}` biases the deterministic substitution router toward/away from the pattern (reuse the existing preference sentiment scale).
- A **controller law** mapping `φ_p → u_p`: give the explicit transfer function (proportional, or P-with-deadband — define the deadband so small `|φ_p|` ⇒ zero action and the system doesn't hunt). State the **gain constants** as a named table. Prove the loop is **contractive / non-oscillating** within the safe envelope (bounded gain × the existing monotone clamps).
- **Safety / composition invariants (must hold by construction):**
  1. *Monotone-conservative under flags:* if any `Guardrail` is restrictive or `I_t` flags a loaded joint, `u_{t+1}` may only reduce load/sets/effort for affected patterns — never raise them.
  2. *Domain closure:* the daily projection of `u_{t+1}` lands inside the `AdjustmentVector` literal domains after `clampAdjustment`, and block-level `target_rpe` stays in `[5.0,10.0]` rounded to 0.5.
  3. *Halt supremacy:* a recorded `halt` is never relaxed by `u_{t+1}`.
  4. *Bounded authority per block:* total corrective volume added across the block ≤ a fixed cap (state it); `u` cannot move the athlete more than one "step" of load/effort per block (anti-windup).
  5. *Volume bifurcation respected:* corrections reason over **effective** tonnage where relevant but never rewrite the **raw** `mech_daily`/ACWR pipeline.
- Output a `ControlAction` interface (`Record<MovementPattern, PatternCorrection>` + block-level scalars) and the pure signature `deriveControlAction(report: FlawReport, profile: UserProfile, macroPhase: MacroPhase): ControlAction`.

---

## 5. NO LLM AT RUNTIME — HARD COMPILE TARGET

The shipped app runs **no generative model**. A sub-3B on-device SLM was trialed and **removed** (it held the output grammar but could not execute the numeric rule table — constant outputs regardless of input). The only ML artifact on device is a ~23 MB sentence-embedding model used solely for routing free-text reports by cosine similarity; it produces **no numbers your math may depend on**. Therefore:

- Your `F` and `u_{t+1}` must be **pure deterministic arithmetic** that hand-translates to TypeScript operating over plain numeric arrays (`number[]` / `Float32Array`) — **no inference call, no learned weights, no training step, no runtime model of any kind.**
- Every coefficient is a **human-reviewable constant** you emit in §3-style tables (like `PHASE_MODS`), not a fitted parameter.
- No operation may require more than the §1 primitive set, must be O(window) time and O(1)-beyond-window space, and must satisfy the determinism/rounding rules in §1.

Begin. Reason inside `<thinking>`; then emit `F`, `u_{t+1}`, the constant tables, and the invariant list.
