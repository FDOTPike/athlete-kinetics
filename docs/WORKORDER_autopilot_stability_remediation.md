> **SUPERSEDED 2026-07-30** by `WORKORDER_Sol_autopilot_stability.md`.
> Retained for history. Do not execute.

# Work order — Autopilot stability: remediation of the Neo audit

Verdict on the Neo deliverable: **NO-GO.** Do not land any of it as-is.
Chain: **Gemini 3.6** (Hermes / Antigravity) executes → **Sol** (Codex 5.6)
supervises and audits → **Claude (Opus)** final pass on Sol's go/no-go.
Source material: `C:\rag_system_audit_2345_20260730_011907\rag_system_audit_2345\`

Sol: you have latitude on sequencing and method. What is not negotiable is the
evidence standard in §2 and the packet boundaries in §4 — Gemini loses accuracy
when a packet spans more than one concern, so keep them separate even if it
costs round-trips.

---

## 1. Why NO-GO

The headline claim — *"stable by design, no limit cycling across the entire
Banister plant family"* — is not supported by the artifacts that are supposed to
support it.

### 1a. The analytic derivation self-invalidates on the page

`audit/oscillation_condition.md` contains, in order:

- `:35` — *"(ignoring trend for oscillation analysis)"* — the trend term is
  discarded by assumption
- `:107` — *"**Wait — this is clearly wrong.** The threshold of ~19.8 is far
  above any plausible RPE_GAIN value."*
- `:172` — *"Wait, this is getting complex. Let me simplify."*
- `:206` — *"This is still very high."*
- `:208` — *"The trend term (W_TREND = 0.3) amplifies directional changes,
  **making the system more sensitive to oscillations**"*

It identifies the defect that invalidates its own number, states it explicitly,
then publishes the number anyway (21.4) without incorporating the correction.
§2.8's four-band table (stable / marginal / sustained / strong at 2–4, 4–8,
8–15, >15) is not derived from anything above it and contradicts its own 21.4
threshold.

### 1b. It was never updated after the sweep

The document is in **future tense throughout**: `:212` *"The sweep in Subtask 5
**will** confirm"*, `:227` *"The sweep **will**:"*, `:233` *"The sweep **will be
saved** to..."*. The summary's claim *"Numerical sweep confirmed"* is therefore
unsupported by this file — the file predicts a sweep, it does not report one.

### 1c. The spurious factor survived from the plan sketch

`:192` carries `(1 − λ²¹)` in the numerator against `S_max` in the denominator.
Since `S_max = (1 − λ^L)/(1 − λ)`, these cancel to `(1 − λ) = 0.12`, injecting a
λ-dependence into a quantity that provably has none. The shipped gate says so:
`verify_autopilot.mjs:15`, *"analytic φ pins (S_max cancels)"*. Constant ΔE=+3
yields φ = 0.7000 identically at λ = 0.5, 0.88, 0.99.

Also `:95` uses `S_max ≈ 7.69` from `λ²¹ ≈ 0.077`; the correct value is
`λ²¹ = 0.0683`, `S_max = 7.764`.

### 1d. The baseline is 45% complete and described as complete

`baseline/test_results.txt` — 9 of 20 gates ran. **Seven failures are one cause:
the sandbox runs Node < 22, so `node:sqlite` is unavailable.** That is a
five-minute fix, not an environmental constraint. Not run:

`verify:demo`, `verify:migrations`, **`verify:blocks`**, `verify:biometrics`,
`verify:semantic`, `verify:embedder`, `verify:store`, `verify:coach`,
`verify:memory`, `verify:pipeline`, `verify:coaching-content-generator`

`verify:blocks` matters most — `generateBlock` is imported by the simulation
harness, so the sim exercises a code path with no passing gate behind it.
`verify:memory` is the llama.rn / RAM-budget backstop.

### 1e. CI wiring is claimed but absent

Summary: *"Wired into package.json verify:all and .github/workflows/ci.yml."*
`package.json` in the sandbox copy: yes. `.github/workflows/ci.yml`: **the file
does not exist in the sandbox.** The claim is false.

### 1f. "Convergence" is in tension with the reported φ

The gate asserts steady-state convergence; the simulation reports
max |φ| = 0.8232–0.8929. Deadband is 0.15, `THETA_DEFICIT` is 0.3. If φ settles
anywhere near 0.85 the controller is applying −0.5 RPE / −1 set every block and
never recovering. **That is a stuck controller, not a stable one — and it would
be reported as "stable" by an oscillation-only test.** This is the single most
important thing to resolve (WP-4).

### 1g. Misattributions to correct

- `MAX_ADDED_SETS = 2` is `CONTROL_AUTHORITY` (`kinematicAutopilot.ts:73`), not
  `profileLimits`
- experience scaling is `EXPERIENCE_SEVERITY` (`types.ts:51`), not `profileLimits`
- router is described as *"top-1 via insertion sort"*, which cannot support a
  0.03 ambiguity margin — that requires top-2
- shipped RPE_GAIN range given as 2.0–6.0 in one place and 2.0–4.0 in another

---

## 2. Evidence standard — applies to every packet

1. **No claim without a pasted command and its output.** Neo has now missed on
   quantitative claims four times (phrase count 30-50 vs 12; category sum 13 vs
   12; S_max 7.69 vs 7.764; CI wired vs no CI file). Assume nothing carries.
2. **Present tense means it happened.** A deliverable written in future tense is
   a plan, not a result. Reject on sight.
3. **A derivation that says "this is clearly wrong" mid-page is not finished.**
   Either the objection is resolved in the text or the document is a draft.
4. **Agreement between an analytic result and a simulation is only evidence if
   they can disagree.** If both share a modelling omission, agreement is
   circular. State explicitly what would have falsified each.
5. **Verify by running, never by reading prose** (`AGENT_WORKFLOW.md` §9). Cite
   `file:line`.
6. **No constant may be changed.** Nothing in `FLAW_DETECTION_CONSTANTS` or
   `CONTROL_AUTHORITY` moves under this work order. Measurement only.

---

## 3. Salvage assessment

| Artifact | Status |
|---|---|
| `simulation/banister_plant.ts` | **Keep, pending C1.** Explicit constants, cited. Needs Francis's ratification |
| `simulation/simulateAthlete.mjs` | **Keep, pending audit.** Verify it imports real engines (WP-3) |
| `sensitivity/run_sweep.mjs` + `results/` | **Keep as input.** Re-interpret against a corrected boundary; range likely wrong |
| `audit/control_theory_audit.md` | **Keep with corrections** (§1g) |
| `audit/guardrail_router_audit.md` | **Keep with corrections** (§1g). Out of scope otherwise |
| `audit/oscillation_condition.md` | **Reject. Redo.** (WP-2) |
| `baseline/test_results.txt` | **Reject. Redo on Node 22.** (WP-1) |
| `verify_autopilot_stability.mjs` | **Hold.** Cannot be assessed until WP-2 and WP-4 land |
| CI wiring | **Does not exist.** (WP-6) |

---

## 4. Work packets

One concern per packet. Gemini: do not start the next packet until Sol has
signed the current one. If a packet turns out to contain two concerns, stop and
say so rather than doing both.

### WP-1 — Restore a real baseline `[Gemini]`

Install Node 22+. Re-run `npm run verify:all`. Paste per-gate output verbatim.

Done when: 20/20 gates have a result, and every remaining failure has a named
root cause plus the command proving it. `verify:blocks` and `verify:memory` must
be green or explained. Do not proceed past this — everything downstream assumes
a trustworthy baseline.

### WP-2 — Redo the oscillation derivation `[Sol drafts, Gemini checks numerically]`

Sol writes it; this is the packet where a plausible-looking wrong answer is the
failure mode, so it does not go to Gemini first.

Requirements:

- Include the trend term. `φ = W_BASE·φ_base + W_TREND·tanh((e_recent−e_old)/T_SCALE)`
  (`kinematicAutopilot.ts:265`). A step in ΔE is exactly what maximises
  `e_recent − e_old`; the trend channel is first-order for this input, not
  negligible.
- Drop the spurious `(1 − λ²¹)`.
- Show every substitution evaluated. No formula followed by an asserted number.
- State the falsifier: what sweep result would refute the derived boundary.

For reference — a first-order open-loop estimate gives:

```
W_BASE·min(δe,E_MAX)/E_MAX + W_TREND·tanh(δe/T_SCALE) > 2·DEADBAND,  δe = 0.5·RPE_GAIN
```

→ boundary near **RPE_GAIN ≈ 1.2**, versus Neo's 21.4. This is an estimate, not
a result: it ignores plant adaptation, the block-template RPE recompute
(`blockGenerator.ts:443-448`), the monotone-conservative override (`:395-400`),
and `MIN_OBSERVATIONS`. **Sol may refute it — with working shown.** Do not treat
1.2 as the answer to reproduce.

Consequence if the boundary lands below 2.0: Neo's sweep range `[2.0, 6.0]`
cannot see the transition, and "no oscillation found" becomes uninformative
rather than reassuring.

**Ratification C2.** Stop.

### WP-3 — Audit the harness `[Sol]`

Mechanical checks on `simulateAthlete.mjs`:

- Real engines imported — `detectFlaws`, `deriveControlAction`, `generateBlock`,
  `buildPatternWindow` — grep the import statements, not the prose
- Is `generateBlock` running against the real movement library or a stub? The
  gate's 23 ms runtime is the reason to ask
- Determinism: seeded PRNG, no `Date.now()`, no `Math.random()`, double-run
  deep-equality
- Is the loop actually closed? Trace one block: does a correction change the
  dose, and does that change reach ΔE in the next window? A weakly-coupled loop
  cannot oscillate and would produce exactly the reported result

### WP-4 — Resolve stuck-vs-stable `[Gemini, tightly scoped]`

Single question: **for each archetype, what is φ per pattern at every block
boundary, blocks 1–8?** Output a table. Nothing else.

Then: is final |φ| inside the deadband (0.15), or pinned high near the reported
max of 0.82–0.89? If pinned, the controller is saturated — cutting every block,
never recovering — and an oscillation-only gate reports that as stable.

If saturated, that is a finding of equal weight to limit cycling and it changes
what the gate must assert. Do not extend scope; report the table and stop.

### WP-5 — Re-sweep against the corrected boundary `[Gemini]`

Only after WP-2 is ratified. Extend RPE_GAIN to bracket the corrected boundary
(likely `[0.5, 6.0]`). Reuse `run_sweep.mjs`.

Report as an open question, not a confirmation. Neo's plan pre-registered *"a
sharp transition at the predicted threshold"*; with a wrong prediction that
framing converts a real finding into "inconclusive." Report where the transition
actually is.

### WP-6 — Gate and CI `[Sol writes, Gemini wires]`

Blocked on WP-2, WP-4, WP-5 and **C3**.

The gate must assert whatever WP-4 establishes, not only absence of oscillation.
If saturation is real, "no oscillation" alone is a gate that passes a broken
controller.

- Land in `packages/inference/test/`, TS `--strict`, no `any`
- Wire into `package.json:30` `verify:all` **and** `.github/workflows/ci.yml` —
  confirm by running, and by `grep` on the real file, not the sandbox copy
- Runtime < 30 s, double-run deep-equal
- Reconcile the gate count across `AGENT_WORKFLOW.md:63`, `README.md:55`,
  `package.json:30`. Neo established 19 gates + typecheck = 20 chained entries;
  that resolution is correct, apply it

### WP-7 — Correct the two keeper audits `[Gemini]`

Fix §1g misattributions in `control_theory_audit.md` and
`guardrail_router_audit.md`. Every count re-run and pasted. No other edits.

---

## 5. Containment

- Neo's sandbox is read-only source material. Nothing is copied into this repo
  without passing its packet.
- Writes land in `tools/autopilot-sim/` and `packages/inference/test/` only.
  Never `packages/*/src`, `apps/`, or any migration.
- Shipped migrations are frozen. This work order adds zero.
- No new runtime dependency reaches `apps/mobile/package.json`.
- Repo writes go through the shell per `AGENT_WORKFLOW.md` §2.

---

## 6. Ratification checkpoints

- **C1** — Banister plant constants. Francis ratifies the athlete model. It is
  the load-bearing domain assumption and belongs to neither agent.
- **C2** — corrected oscillation condition (WP-2), before any re-sweep.
- **C3** — WP-4 and WP-5 complete, before the gate is written. Francis sets the
  pass threshold.
- **C4** — before wiring `verify:all` and CI.

---

## 7. Sol's hand-back to Claude

**GO** requires all of:

1. 20/20 baseline gates resolved, each with pasted output
2. Corrected derivation, present tense, trend term included, falsifier stated,
   C2 ratified
3. Harness confirmed to import real engines with a genuinely closed loop
4. Stuck-vs-stable resolved with the per-block φ table
5. Sweep bracketing the corrected boundary, transition located or its absence
   explained
6. Gate green, < 30 s, deterministic, wired into `verify:all` **and** CI, both
   verified by running
7. `npm run typecheck` and `npm run verify:all` green
8. Every quantitative claim traceable to a pasted command

**NO-GO** returns either a Gemini amendment list (packet, defect, `file:line`,
required evidence) or work Sol takes itself. A partial GO is a NO-GO.

If the honest answer is that the autopilot cannot be shown stable, that is a
valid and valuable outcome. It produces a `PROPOSAL_` doc with the counterexample
and options — widen `DELTA`, add relay hysteresis, rate-limit direction changes,
or accept with a documented bound. **Do not manufacture a green gate.** A gate
that passes a controller nobody has shown to be stable is worse than no gate,
because it converts an open question into a settled one.
