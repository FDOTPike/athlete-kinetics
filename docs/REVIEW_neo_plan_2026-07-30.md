# Review — Neo's execution plan (`plan.md`), 2026-07-30

Reviewer: Claude (Opus). Verdict: **AMEND BEFORE PROCEEDING.**
Roughly 40% of the plan is sound. One structural flaw invalidates the headline
deliverable; one stated fact is fabricated.

Send §A back to Neo as binding amendments. §B is optional polish.

---

## A. Blocking — must change

### A1. The sweep is inverted (§4)

The plan sweeps **controller** constants (λ, δ, THETA_DEFICIT, MAX_ADDED_SETS,
W_BASE/W_TREND) against **three hand-picked athletes** (§3: stable, overreaching,
adapting).

That is backwards, and it is the difference between evidence and noise.

- Robustness under model uncertainty is established by holding the **shipped
  controller fixed** and sweeping a **family of plants**. A controller stable
  across a wide plant family is trustworthy; one that oscillates for a plausible
  plant is defective regardless of which plant is real.
- Sweeping the controller against 3 invented plants produces "λ=0.82 beats 0.88"
  — a result fitted entirely to an athlete model Neo authored, with a sweep's
  authority attached to it. λ changes live `planned_slot.target_rpe`.

**Amendment:** primary sweep is over the plant family (§A2 constants) with the
shipped controller frozen at its current values. Controller sensitivity is a
**secondary** run, reported strictly as sensitivity, never as tuning. No plan
deliverable may recommend a new value for any constant in
`FLAW_DETECTION_CONSTANTS` or `CONTROL_AUTHORITY`.

### A2. The plant model is unspecified (§3)

The entire load-bearing assumption is one clause: *"Training load simulator:
given a ControlAction, generate realistic ΔRPE, attenuation, and niggle data."*

Realistic by what model? Whatever Neo invents becomes ground truth for every
downstream number, unreviewed.

**Amendment:** specify a two-factor fitness–fatigue (Banister) plant as an
explicit constant table in the style of `FLAW_DETECTION_CONSTANTS`, with the
citation in the header — chosen because it is *citable* rather than invented.
Per pattern `p`, per day `t`:

```
fitness_p(t+1) = fitness_p(t) * exp(-1/TAU_FIT) + K_FIT * dose_p(t)
fatigue_p(t+1) = fatigue_p(t) * exp(-1/TAU_FAT) + K_FAT * dose_p(t)
capacity_p(t)  = BASE + fitness_p(t) - fatigue_p(t)
rpe_actual     = target_rpe + RPE_GAIN * (prescribed_intensity - capacity_p(t)) + noise
```

Seeded PRNG for `noise`. RPE on the 0.5 grid, clamped [1, 10].
`TAU_FIT, TAU_FAT, K_FIT, K_FAT, RPE_GAIN, SIGMA_RPE` are the swept dimensions
of A1, not tuned values. The three archetypes in §3 become three *points* in
that family, not the family itself.

**This table is a ratification checkpoint. Francis signs it before any sweep.**

### A3. No analytic oscillation condition (§4)

The plan is pure brute force. The autopilot is a **relay with deadband** —
φ=0.15 and φ=0.99 emit the identical −0.5 RPE / −1 set output
(`kinematicAutopilot.ts:376-386`) — which is the controller class prone to
period-2 limit cycles.

**Amendment:** before the sweep, derive the closed-form condition on
`(RPE_GAIN, TAU_FAT, LAMBDA, DELTA)` under which one ±0.5 RPE correction moves φ
by more than 2 × DEADBAND = 0.30, i.e. drives the signal back across the deadband
and chatters. Then have the numerics **confirm** the boundary. Relevant external
literature exists (describing-function analysis for relay systems) — §"Research
Summary: no external research needed" is wrong on this point.

An analytic boundary reproduced by simulation is evidence. A sweep with no theory
behind it is a table.

### A4. Fabricated fact (§5)

> "Phrase codebase: ~30-50 curated entries"

There are **12** (`packages/inference/assets/phrase-codebase.json`):
`pain-mild, pain-moderate, pain-sharp, illness-systemic, dizzy, fatigue-heavy,
fatigue-sleep, soreness-doms, technique-breakdown, positive-strong,
equipment-improvised, pain-chest`.

The six categories Neo lists are correct, so the file was opened — the count was
estimated and presented as a finding. Off by 3–4×, and it is not cosmetic:
near-collision density at 12 entries versus 40 is the whole retrieval story, and
the confidence/ambiguity gates behave differently at each.

**Amendment:** every quantitative claim in every deliverable must be produced by
a command whose output is pasted into the artifact. No estimated counts.

### A5. Safety bounds framed as tuning targets (§2, §4)

- §4: `MAX_ADDED_SETS ∈ [1, 4]` — "is the cap constraining adaptation?"
- §2: "Daily min-composition ... is this too conservative?"

Both are monotone-conservatism guarantees, not performance knobs. Relaxing
either raises volume or effort authority over real athletes.
(`deriveDailyAdjustment` also has zero callers in `apps/` — deliberate deferral,
`DEVIATION_LOG.md:96-105` — so the second question is moot.)

**Amendment:** both are out of scope. They may be *measured* (how often does the
cap bind?) but no recommendation may propose widening either.

### A6. Nothing becomes an invariant

Every deliverable lands in `/app/rag_system_audit_2345/` as markdown or a
scratch `.mjs`. Terminal output is a recommendations doc.

`AGENT_WORKFLOW.md` §3: *"A new invariant is not real until a gate asserts it."*

**Amendment:** if the loop proves stable, the deliverable is a
`verify:autopilot-stability` gate — deterministic, double-run deep-equality, a
fixed sub-family fast enough for CI (< 30s) — wired into `package.json`
`verify:all` and `.github/workflows/ci.yml`. If unstable, the deliverable is a
counterexample plant plus its trajectory. A recommendations doc is neither.

---

## B. Should change

### B1. The baseline is partial but described as complete (§1)

Lists 9 gates; the repo has ~20 (`package.json:30`). Missing: `verify:db`,
`verify:demo`, `verify:migrations`, `verify:store`, `verify:coach`,
`verify:memory`, `verify:library`, `verify:coaching-content-generator`,
`verify:components`.

Environmental traps that will read as real failures in a sandbox:
`verify:semantic` and `verify:embedder` need network (they fetch the MiniLM
weights); `verify:db` and `verify:library` shell out to Python and false-fail
when python is off PATH (`PHASE_PLAN_rev4_FORGE.md:55`).

**Amendment:** run `npm run verify:all`, and label network/Python failures as
environmental rather than counting them as baseline red.

### B2. State the `set_target` scope cut explicitly (§3)

`demoData.ts` writes no `set_target` rows, so on the seed DB ΔE is null →
`obs = 0` → every pattern collapses to `neutral`
(`kinematicAutopilot.ts:237, 270`). The autopilot has never produced a
non-trivial output on any dataset in this repo.

Generating ΔRPE directly at the `PatternDailyDelta` level (as §3 implies)
legitimately sidesteps this — but it means `buildPatternWindow` and the store's
hydration query go untested. That is an acceptable v1 cut; it must be *stated*.

**Amendment:** add a smoke assertion that fails loudly if block 1 yields an
all-neutral `FlawReport`. §"Evaluation Criteria" already has the right instinct
here — *"parameter sweep produces meaningful metrics (not flat lines)"* — promote
it to a hard assertion rather than a criterion.

### B3. Confirm the real engines are imported, not reimplemented

The plan never states this. A reimplemented observer or controller proves nothing
about the shipped code and is the most likely way this work silently becomes
worthless. `detectFlaws`, `deriveControlAction`, `generateBlock`,
`buildPatternWindow` must be imported from `packages/inference`.

**Verify by checking the import statements, not by asking.**

### B4. Fix the λ half-life question (§2)

"compare to recovery time constants" — compare to *whose*? There is no athlete
data in this project and no athlete population.

**Amendment:** λ=0.88 gives a 5.4-day half-life (`ln 0.5 / ln 0.88`). Compare
against **published** Banister-family constants — fatigue τ ≈ 11–15 days,
fitness τ ≈ 40–50 days — with citations. That is answerable and useful. Comparing
against "your athlete population" is not.

### B5. Drop the "RAG" framing

§5, `rag_pipeline_audit.md`, and the sandbox path `rag_system_audit_2345` all
call the semantic layer a RAG pipeline. It is a 12-entry nearest-neighbour router
over hand-authored guardrails — no corpus, no chunking, no generation. The naming
is a tell that the subsystem was pattern-matched rather than read.

### B6. Cross-pattern coupling — defer (§2)

Squat/hinge posterior-chain overlap is a real effect and a reasonable v2. It
multiplies the plant's free parameters, and A1's question is answerable without
it. Note as future work; do not build it now.

---

## C. What the plan gets right — keep

- **§1 baseline before changes.** Correct, and matches `AGENT_WORKFLOW.md` §9:
  a commit that does not typecheck is not a valid behaviour baseline.
- **§3 instrumentation.** φ trajectory, correction magnitudes, `blockAddedSets`
  utilization is exactly the right telemetry.
- **§"Evaluation Criteria" — "not flat lines".** The sharpest line in the
  document; see B2.
- **Working on a duplicated repo.** Good containment. Keep it — nothing from
  this work order should write into the live tree until it passes review here.

---

## D. Ratification checkpoints

Neo does not self-approve past these.

- **C1** — plant constant table (§A2) exists. Before any sweep.
- **C2** — analytic chatter condition (§A3) derived. Before the full sweep.
- **C3** — sweep complete, before any gate is written. Francis sets the pass
  threshold.
- **C4** — before wiring `verify:all` and CI.
