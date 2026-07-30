# Work order — Kinematic Autopilot: is the loop stable?

**Assignee:** Sol (Codex GPT-5.6). **Effort: xhigh.**
**Single executor.** No sub-delegation. Francis ratifies at C1–C4.
Supersedes `PROMPT_Sol_autopilot_stability.md` and
`WORKORDER_autopilot_stability_remediation.md`.

xhigh is set because the two ways this task fails are both reasoning failures,
not labour failures: a derivation that looks right and isn't, and a simulation
that runs cleanly while measuring nothing. Both have already happened once here.

Method is yours. What is fixed: the evidence standard (§6), the checkpoints (§7),
and the containment boundary (§8).

---

## 1. The question

The Kinematic Autopilot is a relay-with-deadband controller that rewrites real
`planned_slot.target_rpe` and `sets` in shipped blocks
(`blockGenerator.ts:483-499` → `useStore.ts:2246-2249`). Its loop has never been
closed, in production or in simulation.

`DEEPSEEK_KINEMATIC_AUTOPILOT_PROMPT.md:291` asked the original derivation to
*"prove the loop is contractive / non-oscillating."*
`Kinematic_Autopilot_Derivation.md.txt:436-441` returned one sentence of
assertion. Replace it with evidence or with a counterexample.

Two failure modes are in scope, and the second was missed by the prior attempt:

- **Limit cycling** — deficit → cut → headroom → raise → deficit. The classic
  relay pathology.
- **Saturation** — φ pins high, the controller cuts every block and never
  recovers. An oscillation-only test reports this as *stable*.

---

## 2. Prior work — reference input only, not a foundation

A cloud agent (Neo) produced an audit at
`C:\rag_system_audit_2345_20260730_011907\rag_system_audit_2345\`. Its headline
finding was *"stable by design, no limit cycling across the entire plant
family."* **That finding is rejected.** Reasons in
`REVIEW_neo_plan_2026-07-30.md` and below.

| Artifact | Status |
|---|---|
| `audit/oscillation_condition.md` | **Rejected.** Self-invalidating (see §3) |
| `baseline/test_results.txt` | **Rejected.** 9 of 20 gates ran |
| `simulation/simulateAthlete.mjs` | **Distrusted.** Rebuild unless §4 clears it |
| `sensitivity/run_sweep.mjs` + results | Reference. Range likely below the real boundary |
| `simulation/banister_plant.ts` | Reference. Its *constants* are worth keeping (§5) |
| `audit/control_theory_audit.md` | Keep, fix misattributions (§9) |
| `audit/guardrail_router_audit.md` | Keep, fix misattributions (§9) |
| `verify_autopilot_stability.mjs` | Hold. Unassessable until the above resolve |
| CI wiring | Claimed, absent — `.github/workflows/ci.yml` not in the sandbox |

Read these for orientation. Do not inherit their conclusions.

---

## 3. Why the prior derivation was rejected

`oscillation_condition.md` contains, in sequence: `:35` *"(ignoring trend for
oscillation analysis)"* → `:107` *"**Wait — this is clearly wrong.**"* → `:172`
*"Wait, this is getting complex."* → `:208` *"the trend term (W_TREND = 0.3)
amplifies directional changes, **making the system more sensitive to
oscillations**"* → then publishes 21.4 without incorporating that.

It is also in **future tense throughout** (`:212`, `:227`, `:233` — *"the sweep
will confirm"*), i.e. never updated after the sweep ran. And it carries a
spurious `(1 − λ²¹)` against `S_max` in the denominator; since
`S_max = (1 − λ^L)/(1 − λ)` these cancel to `(1 − λ)`, injecting λ-dependence
into a quantity that provably has none — `verify_autopilot.mjs:15` says as much
(*"S_max cancels"*), and constant ΔE=+3 gives φ = 0.7000 identically at
λ = 0.5, 0.88, 0.99.

---

## 4. Start here: the coupling test

**Cheapest decisive experiment available. Run it before building anything.**

Hypothesis: the prior simulation's loop was never closed, and its null result is
an artefact.

The reported symptoms are jointly suspicious. A relay controller with a deadband,
swept over six plant dimensions with gain 2.0–6.0, and *nothing oscillates
anywhere* — while max |φ| sits at 0.8232–0.8929 against a 0.15 deadband, and
"convergence" is nonetheless claimed. All three are simultaneously explained if
corrections never reach the plant: φ parks where initial conditions put it, never
moves (reads as convergence), never oscillates (trivially true), and stays high.
An open loop produces a clean, confident, meaningless null.

Test it directly against Neo's harness:

1. Inject a known correction at a block boundary.
2. Does `dose` change in the following block?
3. Does that change reach `avgDeltaRPE` in the next observer window?
4. Does φ move at the next boundary, and by roughly the magnitude the plant
   equations predict?

If any link is broken, the null is explained and the harness is dead — rebuild.
**If all four hold, the harness is sound and rebuilding it is waste** — say so
and salvage it. Default is rebuild; this test is the one thing that overrides
that, and your judgement on the evidence governs.

---

## 5. Knowledge worth carrying forward

Roughly a page, and the durable value of the prior work:

- **Plant: Banister two-factor fitness–fatigue.** Chosen because it is *citable*
  rather than invented — Calvert et al. 1976, Busso 2003. Literature time
  constants: τ_fitness ≈ 42–50 d, τ_fatigue ≈ 7–15 d.
- λ = 0.88 → 5.4-day half-life (`ln 0.5 / ln 0.88`). The observer therefore
  reacts on a timescale well inside τ_fatigue. Whether that is appropriate for a
  short-horizon corrective controller or a source of phase lag is an open
  question worth your attention.
- **Swept dimensions:** `TAU_FAT`, `TAU_FIT`, `K_FAT`, `K_FIT`, `RPE_GAIN`,
  `SIGMA`.
- **Archetypes** (points in that family, not the family):
  stable `τ_fat=14, τ_fit=45, K_fat=0.5, K_fit=0.12, RPE_GAIN=3.0, σ=0.5`;
  overreach `10, 50, 0.8, 0.10, 4.5, 0.7`; adapting `18, 40, 0.4, 0.18, 2.5, 0.4`.
- **Metrics:** φ per pattern per block; correction magnitudes; `blockAddedSets`
  utilisation; time-to-settle; peak-to-peak φ over the last 3 blocks vs the first 3.
- **S_max(λ=0.88, L=21) = 7.764** (note λ²¹ = 0.0683; the prior work used 0.077
  and got 7.69).

The plant constants are **fiat choices** and must be labelled as such in an
explicit table in the style of `FLAW_DETECTION_CONSTANTS`. They are the swept
dimensions, not tuned values. **This table is C1.**

---

## 6. The work

Sequence is yours; these are the obligations.

### 6a. Baseline

Node 22+ (the prior run was on <22, so `node:sqlite` was missing and seven gates
never executed — that is a setup gap, not an environmental constraint).
`npm run verify:all`, 20/20 resolved, per-gate output pasted. `verify:blocks`
matters most — `generateBlock` is under test. `verify:memory` is the llama.rn /
RAM backstop.

### 6b. Derivation — C2

Requirements, not method:

- **Include the trend term.** `φ = W_BASE·φ_base + W_TREND·tanh((e_recent −
  e_old)/T_SCALE)` (`kinematicAutopilot.ts:265`). A step in ΔE is precisely what
  maximises `e_recent − e_old`; the trend channel is first-order for this input.
- Every substitution evaluated in the text. No formula followed by an asserted
  number.
- **State the falsifier** — what sweep result would refute your boundary.
- Present tense. A future-tense deliverable is a plan.

A first-order open-loop estimate, offered as a starting point and nothing more:

```
W_BASE·min(δe,E_MAX)/E_MAX + W_TREND·tanh(δe/T_SCALE) > 2·DEADBAND,   δe = 0.5·RPE_GAIN
```

→ boundary near **RPE_GAIN ≈ 1.2**. It ignores plant adaptation, the block
template's RPE recompute (`blockGenerator.ts:443-448`), the monotone-conservative
override (`:395-400`), and `MIN_OBSERVATIONS`. **Refute it if the algebra takes
you elsewhere — show the working.** Do not treat 1.2 as a target to reproduce.

If the boundary lands below 2.0, the prior sweep range `[2.0, 6.0]` could not
have seen the transition, and its null becomes uninformative rather than
reassuring.

### 6c. Closed-loop simulation

Real engines only — `detectFlaws`, `deriveControlAction`, `generateBlock`,
`buildPatternWindow` imported from `packages/inference`. A reimplementation
proves nothing about shipped code.

Deterministic: seeded PRNG, no `Date.now()`, no `Math.random()`, double-run
deep-equality. 8 blocks × 4 weeks.

**Fail loudly if block 1 yields an all-neutral `FlawReport`.** Context:
`demoData.ts` writes no `set_target` rows, so on the seed DB ΔE is null → obs=0 →
every pattern collapses to neutral (`kinematicAutopilot.ts:237,270`). The
autopilot has never produced a non-trivial output on any dataset in this repo.
If your athlete does not emit prescribed targets, you are measuring nothing.

### 6d. Sweep — C3

Range must bracket your derived boundary. Report where the transition is, or
that there isn't one, as an **open question**. The prior plan pre-registered
"a sharp transition at the predicted threshold," which converts a real finding
into "inconclusive" when the prediction is wrong.

Report per-block φ tables, not just aggregates — that is what distinguishes
saturation from convergence.

### 6e. Gate — C4

Assert what you found, not only absence of oscillation. If saturation is real,
an oscillation-only gate passes a broken controller.

`packages/inference/test/`, TS `--strict`, no `any`, < 30 s, deterministic.
Wire into `package.json:30` `verify:all` **and** `.github/workflows/ci.yml` —
verify by running and by grepping the real files, not a sandbox copy. Reconcile
the gate count across `AGENT_WORKFLOW.md:63`, `README.md:55`, `package.json:30`
(19 gates + typecheck = 20 chained entries; that resolution is correct).

---

## 7. Evidence standard

The prior agent missed on quantitative claims five times: phrase count "30–50"
vs 12; category sum 13 vs 12; S_max 7.69 vs 7.764; "CI wired" vs no CI file;
"sweep confirmed" vs a future-tense document. Assume nothing carries.

1. No claim without a pasted command and its output.
2. Present tense means it happened.
3. A derivation that says *"this is clearly wrong"* mid-page is a draft.
4. Analytic/numeric agreement is evidence only if they could have disagreed. If
   both share an omission, agreement is circular. State what would falsify each.
5. Verify by running, never by reading prose (`AGENT_WORKFLOW.md` §9). Cite
   `file:line`.
6. **No constant changes.** Nothing in `FLAW_DETECTION_CONSTANTS` or
   `CONTROL_AUTHORITY` moves. `MAX_ADDED_SETS` and daily min-composition are
   monotone-conservatism guarantees — measure binding frequency, never widen.

---

## 8. Containment

Writes land in `tools/autopilot-sim/` and `packages/inference/test/` only. Never
`packages/*/src`, `apps/`, or any migration. Shipped migrations are frozen; this
work order adds zero. No new runtime dependency reaches
`apps/mobile/package.json` — `tools/memory-audit/audit.mjs` is the backstop.
Repo writes go through the shell (`AGENT_WORKFLOW.md` §2). Neo's sandbox is
read-only source material.

---

## 9. Checkpoints, hand-back, and the acceptable failure

**C1** plant constants · **C2** derivation · **C3** sweep complete, before any
gate · **C4** before wiring `verify:all` and CI. Do not self-approve.

Hand back to Claude (Opus) for final pass. **GO** requires: 20/20 baseline;
derivation in present tense with the trend term and a stated falsifier;
coupling test resolved; per-block φ tables distinguishing saturation from
convergence; sweep bracketing the boundary; gate green, deterministic, wired and
verified in both places; `typecheck` and `verify:all` green; every number
traceable to a pasted command. A partial GO is a NO-GO.

**If the autopilot cannot be shown stable, that is a valid and valuable
outcome** — a `PROPOSAL_` doc with the counterexample and the options: widen
`DELTA`, add relay hysteresis, rate-limit direction changes, or accept with a
documented bound. Do not manufacture a green gate. A gate that passes a
controller nobody has shown to be stable is worse than no gate, because it
converts an open question into a settled one.

Saturation, if you find it, is a live defect in shipped code — it would mean
real athletes' prescriptions are cut every block with no recovery path and no UI
attribution. Treat that as the highest-value finding available here, not a
footnote.

---

## 10. Reference

```ts
detectFlaws(stateVectors, patternDailyDelta, trainingAge, globalGuardrail) -> FlawReport
deriveControlAction(report, profile, macroPhase) -> { corrections, blockAddedSets }
```

Observer (`kinematicAutopilot.ts:229-266`): `D_norm = (P − N)/(E_MAX · S_max)`,
deadband `|D_norm| < 0.15 → 0`, `φ = 0.7·φ_base + 0.3·tanh((e_recent −
e_old)/1.0)`, clamped [−1,1], round4.

Relay (`:376-386`) — identical output at φ = 0.16 and φ = 0.99:

| φ | dRpe | dSet | dLoad | prefBias |
|---|---|---|---|---|
| \|φ\| < 0.15 | 0 | 0 | 1.00 | 0 |
| ≥ 0.4 | −0.5 | −1 | 0.95 | −1 |
| 0.15–0.4 | −0.5 | −1 | 1.00 | −1 |
| ≤ −0.4 | +0.5 | +1 | 1.05 | +1 |
| −0.4 to −0.15 | +0.5 | +1 | 1.00 | +1 |

λ=0.88 · E_MAX=3.0 · DELTA=0.15 · W_BASE=0.7 · W_TREND=0.3 · T_SCALE=1.0 ·
MIN_OBSERVATIONS=5 · THETA_DEFICIT=0.3 · MAX_ADDED_SETS=2 · S_max=7.764.
`EXPERIENCE_SEVERITY.triageMin` (`types.ts:51`): beginner 5, intermediate 4,
advanced 3, elite 3.

**Misattributions to fix in the keeper audits:** `MAX_ADDED_SETS` is
`CONTROL_AUTHORITY` (`kinematicAutopilot.ts:73`), not `profileLimits`;
experience scaling is `EXPERIENCE_SEVERITY` (`types.ts:51`), not `profileLimits`;
the router is described as "top-1 via insertion sort", which cannot support a
0.03 ambiguity margin — that needs top-2; shipped RPE_GAIN range is given
inconsistently as 2.0–6.0 and 2.0–4.0.

## 11. Out of scope — separate tickets

`dLoad_p`/`prefBias_p` computed (`:403,406`) and never read · `autopilotAdjusted`
(`blockGenerator.ts:535`) has no UI consumer · `deriveDailyAdjustment` has zero
callers (`DEVIATION_LOG.md:96-105`) · `triage.ts` thresholds unvalidated
(`ASSESSMENT_heyneo_2026-07-30.md`) · cross-pattern squat/hinge coupling.
