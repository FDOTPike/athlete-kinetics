> **SUPERSEDED 2026-07-30** by `WORKORDER_Sol_autopilot_stability.md`.
> Retained for history. Do not execute.

# Work order — Kinematic Autopilot stability: REVIEW AND LAND

Target agent: **Sol (Codex, GPT-5.6)** — recommended effort **high** for §2 and §4,
medium is sufficient for §6 mechanical wiring. Do not run §2 below high; it is an
algebra audit where a plausible-looking wrong answer is the failure mode.

Status: DRAFT, unratified. Supersedes the 2026-07-30 build-oriented version of
this file (git history).
Repo: `athlete-kinetics`. Companion docs: `REVIEW_neo_plan_2026-07-30.md`,
`ASSESSMENT_heyneo_2026-07-30.md`.

---

## 0. What changed

Neo revised its plan and now owns the build. This work order is no longer a
build order — it is a **review-and-land** order. Neo works in a duplicated repo
in its cloud sandbox (`/app/rag_system_audit_2345/`). Nothing it produces reaches
this repo except through you.

| Actor | Owns |
|---|---|
| **Neo** (cloud) | Baseline, Banister plant, simulation harness, sweeps, router audit, draft gate — all inside its sandbox |
| **Sol (you)** | Verifying every artifact, correcting the C2 derivation, landing TypeScript in this repo, wiring `verify:all` + CI, reconciling the gate count |
| **Francis** | Ratifies C1–C4. Nothing lands without this |

Neo's revised plan already incorporates the six blocking amendments from
`REVIEW_neo_plan_2026-07-30.md`. **Do not re-derive, re-plan, or rebuild what it
now owns** (§3). Your value is entirely in §2 and §4.

---

## 1. Mission, unchanged

`DEEPSEEK_KINEMATIC_AUTOPILOT_PROMPT.md:291` asked the derivation to *"prove the
loop is contractive / non-oscillating."* What came back
(`Kinematic_Autopilot_Derivation.md.txt:436-441`) is one sentence of assertion.
The autopilot is live — it rewrites `planned_slot.target_rpe` and `sets`
(`blockGenerator.ts:483-499` → `useStore.ts:2246-2249`) — and its loop has never
been closed even in simulation. Replace the assertion with evidence or a
counterexample.

---

## 2. BLOCKING REVIEW CRITERION — what the C2 deliverable must survive

**Status check first: the derivation does not exist yet.** Neo's Subtask 3 is a
*plan item*; its deliverable `audit/oscillation_condition.md` has not been
produced. What follows is a review of the **sketch inside the plan**, not a
verdict on finished work. Neo may well correct these itself when it does the real
derivation — sketches are allowed to be rough.

Flag them anyway, for three reasons: a sketch's errors usually propagate, because
the executor expands its own outline rather than starting clean; two of the
downstream consequences (§2f) are baked into *specified experiment design*, not
sketch; and C2 exists precisely to catch this class of problem before 10⁴ runs
are interpreted against a wrong boundary.

**Do not treat §2a–2d as findings. Treat them as the checklist the finished
derivation has to pass.** If it lands clean and disagrees with me, the derivation
wins — provided it shows its substitutions.

Neo's revised plan, Subtask 3, sketches:

```
RPE_GAIN * 0.5 * (1 - λ^21) * W_base / (E_max * S_max) > 2 * DELTA
```

concluding a threshold of "≈ 4.0", then "~5.5", and that literature RPE_GAIN of
2–4 puts the system "below the chatter threshold by design."

**Three defects in the sketch. Confirm each numerically yourself before accepting
or rejecting my correction — do not take this section on trust.**

### 2a. The `(1 − λ²¹)` factor is spurious

`S_max = (1 − λ^L)/(1 − λ)`, so `(1 − λ²¹)/S_max = (1 − λ) = 0.12`. Neo has
introduced a factor that cancels against its own denominator and injects a
λ-dependence into a quantity that provably has none.

The shipped gate says so itself — `verify_autopilot.mjs:15`, *"analytic φ pins
(S_max cancels)"*. Confirm empirically: for constant ΔE = +3 the observer returns
**φ = 0.7000 for λ = 0.5, 0.88, and 0.99 alike**. The recency weights sum to
S_max and cancel in `D_norm = (P − N)/(E_MAX · S_max)`.

This also re-confirms a finding you should carry: the gate's headline pins cannot
detect a wrong λ.

### 2b. The stated numbers contradict Neo's own formula

Neo's simplified form is
`RPE_GAIN > (2·DELTA·E_max·S_max) / (0.5·(1−λ²¹)·W_base)`.
Substituting DELTA=0.15, E_max=3, S_max=7.764, λ²¹=0.0683, W_base=0.7 gives
**21.4** — not 4.0, not 5.5. Neither quoted number follows from the algebra
above it.

### 2c. The trend term is omitted, and it is first-order here

φ is not φ_base. From `kinematicAutopilot.ts:265`:

```
φ = W_BASE · φ_base + W_TREND · tanh((e_recent − e_old) / T_SCALE)
```

A **step** change in ΔE is exactly the perturbation that maximises
`e_recent − e_old`. The trend term is the derivative channel; it is the fastest-
responding part of the observer for precisely this input. Dropping it removes up
to ±0.3 of a ±0.30 threshold.

### 2d. Corrected condition

```
W_BASE · min(δe, E_MAX)/E_MAX  +  W_TREND · tanh(δe / T_SCALE)  >  2 · DEADBAND
```

with `δe = 0.5 · RPE_GAIN` (one relay step of ±0.5 RPE). Evaluated:

| RPE_GAIN | δe | base | trend | total | vs 0.30 |
|---|---|---|---|---|---|
| 1.0 | 0.50 | 0.117 | 0.139 | 0.255 | stable |
| **1.2** | 0.60 | 0.140 | 0.161 | **0.301** | **boundary** |
| 2.0 | 1.00 | 0.233 | 0.228 | 0.462 | chatters |
| 4.0 | 2.00 | 0.467 | 0.289 | 0.756 | chatters |
| 5.5 | 2.75 | 0.642 | 0.298 | 0.939 | chatters |

**Threshold ≈ 1.2, not 5.5.** Neo's swept range is RPE_GAIN ∈ [2.0, 6.0] —
**every point in it sits above the corrected boundary.** Its conclusion inverts.

### 2e. What this does and does not license

Do **not** report "the autopilot oscillates." This is a first-order open-loop
estimate and it ignores real stabilising effects:

- the plant adapts, so ΔE does not hold a step;
- corrections land on a block template that recomputes RPE from scheme tables
  (`blockGenerator.ts:443-448`), so the input is not a clean step;
- the monotone-conservative override suppresses the raise direction under
  caution / restrictive guardrail / injured joint (`kinematicAutopilot.ts:395-400`);
- `MIN_OBSERVATIONS = 5` gates thin windows;
- φ re-accumulates over days, not instantly.

The defensible claim is: **the boundary is near 1.2, it lies below Neo's entire
swept range, and the sweep should therefore be expected to show oscillation
broadly rather than a clean transition at 5.5.**

### 2f. Consequences — these apply NOW, regardless of the derivation

Unlike §2a–2d, these are not sketch problems. They are already fixed in Neo's
specified experiment design (Subtasks 4 and 5) and will bite even if the finished
derivation is flawless.


1. **Extend the primary sweep to RPE_GAIN ∈ [0.5, 6.0]** so it brackets the
   corrected boundary. As specified it cannot find the transition — the range
   starts past it.
2. **Kill the pre-registered conclusion.** Neo's plan asserts the numerics "should
   show a sharp transition at the predicted RPE_GAIN threshold." With a wrong
   prediction, a real finding (oscillation everywhere) reads as "inconclusive,
   no clean boundary." Rewrite as an open question.
3. Neo must show the derivation stepwise with each substitution evaluated, not a
   formula followed by asserted numbers.

---

## 3. SUPERSEDED — Neo owns these. Do not rebuild.

Its revised plan covers these adequately. Review the output; do not duplicate the work.

- Baseline of all 19 gates + typecheck, with environmental failures labelled
- Banister two-factor plant, explicit constant table, cited (Calvert 1976, Busso 2003)
- Simulation harness importing the real shipped engines
- Primary sweep over the plant family with the controller frozen
- Secondary controller-sensitivity sweep, reported as sensitivity only
- Non-trivial-`FlawReport` smoke assertion
- Guardrail router audit (correctly renamed from "RAG")
- Draft `verify:autopilot-stability` gate

Neo also resolved the gate-count discrepancy correctly: **19 gates + typecheck =
the 20 entries chained at `package.json:30`.** Carry that into §6.

---

## 4. RETAINED — only you can do these

1. **§2.** The derivation audit. Highest value in this work order.
2. **Land the TypeScript.** Neo's artifacts live in its sandbox. You port them
   into `tools/autopilot-sim/` and `packages/inference/test/`. TS `--strict`,
   no `any`.
3. **Wire the gate** into `package.json:30` `verify:all` and
   `.github/workflows/ci.yml`. Per `AGENT_WORKFLOW.md` §3: *"A new invariant is
   not real until a gate asserts it."*
4. **Reconcile the gate count** across `AGENT_WORKFLOW.md:63` (19),
   `README.md:55` ("80+"), and `package.json:30`. Already open work at
   `PHASE19_PLAN_capability_content.md:157-158`. Adding a gate is the moment.
5. **Enforce the containment boundary.** Neo writes to `tools/autopilot-sim/`
   only — never `packages/src`, `apps/`, or any migration. Shipped migrations
   are frozen; this work order adds zero.

---

## 5. Review protocol for Neo's artifacts

`AGENT_WORKFLOW.md` §9: verify by running gates, never by reading prose. Cite
`file:line`. Check each of these mechanically:

- **Real engines imported, not reimplemented.** Grep the imports for
  `detectFlaws`, `deriveControlAction`, `generateBlock`, `buildPatternWindow`.
  A reimplementation proves nothing about shipped code and is the likeliest way
  this becomes worthless.
- **Determinism.** Double-run deep-equality. No `Date.now()`, no `Math.random()`.
- **Every quantitative claim re-derived by you.** Neo committed to
  command-backed numbers and has now missed twice — see §7.
- **No constant-change recommendation.** Nothing may propose a new value for any
  member of `FLAW_DETECTION_CONSTANTS` or `CONTROL_AUTHORITY`. Sensitivity
  reporting only.
- **Safety bounds measured, never widened.** `MAX_ADDED_SETS` and daily
  min-composition are monotone-conservatism guarantees. Binding-frequency
  measurement is fine; widening is not.
- **Gate runtime < 30s** and green under `npm run verify:all`.

---

## 6. Definition of done

1. §2 resolved **against the delivered `oscillation_condition.md`**, not against
   the plan sketch: either my correction confirmed and pushed to Neo, or my
   correction refuted with working shown. §2f is actionable immediately and does
   not wait for that deliverable.
2. Stable across the swept family → `verify:autopilot-stability` lands, wired
   into `verify:all` and CI, with the analytic boundary and the margin to the
   nearest unstable plant documented.
3. Unstable → a `PROPOSAL_` doc in repo convention with the counterexample plant,
   its trajectory, and options: widen DELTA, add relay hysteresis, rate-limit
   direction changes, or accept with a documented bound.
4. `npm run typecheck` and `npm run verify:all` green.
5. Gate count reconciled across all three documents.

---

## 7. Neo's error pattern — two data points, same shape

Both times: correct structure, confident presentation, arithmetic that does not
survive checking.

- **First plan:** claimed the phrase codebase held "~30-50 curated entries". It
  holds 12.
- **Revised plan:** after explicitly committing that *"every quantitative claim
  [is] produced by a command whose output is pasted into the artifact"*, it
  states category counts of pain(4), illness(3), fatigue(3), technique(1),
  positive(1), equipment(1) — which sums to **13**, against its own verified
  total of 12. Actual, by `grep -o '"category": *"[a-z]*"' | sort | uniq -c`:
  **pain 3, illness 3, fatigue 3, technique 1, positive 1, equipment 1**.
- **Revised plan Subtask 3:** the chatter sketch in §2 above — with the caveat
  that a sketch is not a deliverable, and this one may yet be corrected in
  execution.

None of this makes Neo useless — its revised plan structure is sound and its
research summary is genuinely useful. It means **every number it produces is
unverified until you run the command yourself.** Treat its prose as a hypothesis
and its arithmetic as unchecked.

---

## 8. Ratification checkpoints

Do not self-approve.

- **C1** — Banister plant constant table. Francis ratifies the athlete model;
  it is the load-bearing domain assumption and it is not yours or Neo's.
- **C2** — the oscillation condition, **after §2 is resolved**. This checkpoint
  is now doing real work: as drafted it would have anchored the entire sweep to
  a wrong boundary.
- **C3** — sweep complete, before any gate is written. Francis sets the pass
  threshold.
- **C4** — before wiring `verify:all` and CI.

---

## 9. Reference — the API under test

```ts
detectFlaws(stateVectors, patternDailyDelta, trainingAge, globalGuardrail) -> FlawReport
deriveControlAction(report, profile, macroPhase) -> { corrections, blockAddedSets }
```

Observer (`kinematicAutopilot.ts:229-266`):
`D_norm = (P − N)/(E_MAX · S_max)`, deadband `|D_norm| < 0.15 → 0`,
`φ = 0.7·φ_base + 0.3·tanh((e_recent − e_old)/1.0)`, clamped [−1,1], round4.

Relay map (`:376-386`) — same output at φ=0.16 and φ=0.99:

| φ | dRpe | dSet | dLoad | prefBias |
|---|---|---|---|---|
| \|φ\| < 0.15 | 0 | 0 | 1.00 | 0 |
| ≥ 0.4 | −0.5 | −1 | 0.95 | −1 |
| 0.15–0.4 | −0.5 | −1 | 1.00 | −1 |
| ≤ −0.4 | +0.5 | +1 | 1.05 | +1 |
| −0.4 to −0.15 | +0.5 | +1 | 1.00 | +1 |

Constants: λ=0.88 (5.4-day half-life), E_MAX=3.0, DELTA=0.15, W_BASE=0.7,
W_TREND=0.3, T_SCALE=1.0, MIN_OBSERVATIONS=5, THETA_DEFICIT=0.3,
MAX_ADDED_SETS=2, S_max(λ=0.88, L=21)=7.764.

## 10. Out of scope — separate tickets

- `dLoad_p` / `prefBias_p` computed (`:403,406`), never read by the block generator
- `BlockPlan.autopilotAdjusted` (`blockGenerator.ts:535`) has no UI consumer —
  athlete numbers change with no attribution
- `deriveDailyAdjustment` has zero callers; deferral recorded at
  `DEVIATION_LOG.md:96-105`
- `triage.ts` thresholds unvalidated in the same way — see
  `ASSESSMENT_heyneo_2026-07-30.md`
- Cross-pattern coupling (squat/hinge posterior chain) — real, deferred to v2
