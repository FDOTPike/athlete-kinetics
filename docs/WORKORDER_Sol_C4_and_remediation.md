# Work order — C4 gate and remediation sequence

**Assignee:** Sol (Codex GPT-5.6). **Effort: xhigh.**
**Ratified 2026-07-30 by Francis: C1, C2, C3.** Audits:
`AUDIT_C1_2026-07-30.md`, `AUDIT_C2_2026-07-30.md`, `AUDIT_C3_2026-07-30.md`.

C3 stands as a **NO-GO for stability** and a **GO as a counterexample finding**.
Proposal option 5 (accept) is ruled out.

Two ratified decisions:

- **Remediation is sequenced, not combined: option 3, then option 4.**
- **C4 pins the counterexamples as expected-failure, before any controller
  change.**

---

## 1. C4 — expected-failure gate. Do this first.

No controller change. No constant change. The gate encodes the finding so it
cannot regress silently and so remediation has a regression target.

Must pin, as **currently failing**:

1. The six stationary-template limit cycles (`SWEEP_C3.md` §6), including both
   zero-noise cases at `TAU_FAT=21, TAU_FIT=60, K_FAT=1.0, K_FIT=0.2,
   RPE_GAIN=1.5, σ=0` from `(0,0)` and `(0,0.75)`.
2. The nominal upward saturation case (§5): stable plant, gain 3, zero noise —
   raise at all eight boundaries, RPE cap binding in peak blocks.
3. The healthy/niggle paired override result (§7): niggle blocks all eight
   raises, healthy receives all eight. **This one is an expected-PASS** — it is
   the safety property that currently works, and it must not regress while the
   rest is being fixed.

Must also pin as passing:

4. The low-frequency `thin_data_neutral` case (§9) — 3 observations <
   `MIN_OBSERVATIONS`, collapsing to neutral. Correct behaviour; keep it.

Mechanics: deterministic, double-run deep-equal, < 30 s, TS `--strict`, no
`any`, in `packages/inference/test/`. Wire into `package.json:30` `verify:all`
and `.github/workflows/ci.yml`, verified by running and by grepping the real
files. Reconcile the gate count across `AGENT_WORKFLOW.md:63`, `README.md:55`,
`package.json:30`.

**Naming matters.** Do not call it `verify:autopilot-stability` — nothing here
asserts stability. Something like `verify:autopilot-counterexamples`. A gate
whose name implies a property it does not test is how this failure mode
propagates.

State in the gate header that expected-failure entries are a **known open
defect**, not a permanent contract, with a pointer to the proposal.

## 2. Documentation, at C4

- `DEVIATION_LOG.md` — a known defect in shipped behaviour. Record the mechanism
  (deload/trend-window straddle), the exposure (`base_rpe_cap` is the only stop
  for a healthy athlete), and the current mitigation (none).
- `RELEASE_READINESS.md` — §D already treats prescription-derived liability
  exposure; add this to it.

## 3. R1 — cumulative RPE authority budget (proposal option 3)

Separate checkpoint, after C4 lands. This is the **bound**, not the cure.

The upward analogue of `MAX_ADDED_SETS`: a cumulative per-macro-cycle RPE budget
so the raise channel cannot ratchet unboundedly to `base_rpe_cap` on a
phase-biased signal.

Why this first: it does not touch the observer, so φ is unchanged and the
analytic pins in `verify_autopilot.mjs` survive. It adds a constraint pass on
the control action — `deriveControlAction`'s existing pass-2 anti-windup is the
precedent to follow. Blast radius is small and the harm bound is immediate.

Requirements: halt supremacy and the monotone-conservative override stay supreme
and untouched. Cuts must remain unrationed — real recovery still needs timely
downward correction, and §7 shows the down channel is already the conservative
one. State the worst-case cumulative RPE movement and the release behaviour.
Re-run the full C3 family and report which counterexamples move.

**Ratification C5 before landing.**

## 4. R2 — phase-aware trend reference (proposal option 4)

Separate checkpoint, after R1. This is the **cure** — it targets the mechanism
in `SWEEP_C3.md` §6 rather than its consequences.

Before designing it, settle the question from `AUDIT_C3_2026-07-30.md` §5:
**is the week-4 deload straddle universal across macro phases, or
template-specific?** §8 shows a week-1 deload converts continuous raising into
raise/neutral alternation. If deload placement varies by phase, the remediation
has to handle both cases; if it is systematic, the fix is narrower. Establish
this first — it determines the design.

Blast radius is genuinely larger: changing the trend reference changes φ, which
invalidates the analytic pins in `verify_autopilot.mjs`. **The gate protecting
the autopilot and the autopilot itself would change in the same commit.** Split
that deliberately — recompute and land the pins as a reviewable step of its own,
with the old and new φ values shown side by side for every pinned case.

Requirements: explicit phase-normalised formula, real-template substitutions for
normal and shifted deloads, low-frequency handling, fresh full-family sweep,
and the six stationary counterexamples plus nominal saturation as regression
cases. Then C4's expected-failure entries convert to expected-pass.

**Ratification C6 before landing.**

## 5. Constraints that still hold

Writes in `tools/autopilot-sim/` and `packages/inference/` only — R1 and R2 are
the first authorised changes to `packages/inference/src`, and only within their
ratified scope. No migrations. No new runtime dependency in
`apps/mobile/package.json`. Shell writes per `AGENT_WORKFLOW.md` §2. Evidence
standard from `WORKORDER_Sol_autopilot_stability.md` §7 remains in force: no
claim without a pasted command, present tense means it happened, verify by
running.

## 6. Out of scope — still separate tickets

`dLoad_p`/`prefBias_p` computed and never read · `autopilotAdjusted` has no UI
consumer, so the athlete sees changed numbers with no attribution — **this one
is now more pressing given C3** · `deriveDailyAdjustment` has zero callers ·
`triage.ts` thresholds unvalidated.
