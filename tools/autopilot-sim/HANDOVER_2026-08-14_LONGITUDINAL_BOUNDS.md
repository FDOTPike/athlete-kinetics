# Handover — 2026-08-14 Longitudinal Deterministic Verification

Owner: Francis Pike
Phase: test-only longitudinal verification (HERMES_WORK_ORDER_LONGITUDINAL_VERIFICATION.md, 2026-08-14)
Implementer: Hermes (sole implementation agent)

## 1. Frozen parent and checkpoint

- Frozen parent: `a38ab102b9b01cebdc91c20214fed1560207cd39` (`fix(routines): preserve authored projected RPE ceiling`)
- Checkpoint commit: the single authorized commit containing this handover.
  The audit range is `a38ab102b9b01cebdc91c20214fed1560207cd39..<checkpoint SHA>`.
  A commit cannot embed its own hash; the exact checkpoint SHA is reported to
  Francis in the completion message and is `git rev-parse HEAD` on this worktree.
- Worktree/branch: `.worktrees/hermes-longitudinal-verification` /
  `codex/hermes-longitudinal-verification`.
- Status: one checkpoint commit, no push, no release.

## 2. Exact files changed

| File | Change |
|---|---|
| `packages/inference/test/verify_longitudinal_bounds.mjs` | NEW — executable longitudinal/metamorphic verifier (4 families + counterexample checks + fixture-completeness gates), loads compiled production exports from `packages/inference/test/.build`. |
| `package.json` | `verify:autopilot` appends `&& node packages/inference/test/verify_longitudinal_bounds.mjs` after the existing Autopilot checks. No new top-level `verify:*` gate. |
| `tools/autopilot-sim/HANDOVER_2026-08-14_LONGITUDINAL_BOUNDS.md` | NEW — this handover. |

No other file changed. Production inference, policy, coefficients, budgets,
thresholds, tier/role/access behavior, ACWR behavior, migrations, UI, native
code and dependencies are untouched (see §6).

## 3. Existing-coverage vs newly-added-coverage map

Requested property → where it was already proved vs. what this phase adds.

| Property | Existing direct / single-microcycle coverage | New longitudinal / metamorphic coverage |
|---|---|---|
| Nondeterminism / input mutation | `verify_blocks` [1] (generateBlock double-run all objectives×frequencies); `verify_autopilot` [1] (F/u deep-freeze purity); `verify_pipeline` (resolver + APRE determinism) | Every scenario double-run from freshly constructed, deeply frozen inputs; byte-equality asserted; frozen-input mutation throws (families A–D, all 5 metamorphic variants). |
| Non-termination / uncontrolled growth | `verify_blocks` [2]/[7] plan-shape pins; 8-block/32-week closed-loop sim (`tools/autopilot-sim/closedLoop.ts`, `runSweep.ts`) | Exact trace cardinality from scenario dimensions: A = 4 segments × 4 weeks × 5 (or 4 binding) prescriptions; C/D = 4 blocks × 12 sessions = 48; per-block/per-variant byte-identity of every repeated week (no hidden accumulation). |
| Non-finite / out-of-domain prescriptions | `verify_blocks` [2] sets 1–10, reps 1–30, RPE 5–10 ≤ cap; `verify_pipeline` RPE ≤ authored | `prescriptionDomainViolation` / `planSlotDomainViolation` over every output row in all 68 simulated weeks (routine reps 1–100, sets 1–10, RPE 5..cap; generator old-domain sets/reps/RPE). |
| Dose expansion across repeated family exposure | `verify_pipeline` Elite five-times-weekly bench (single microcycle: 5 exposures, purposes, no expansion) | Family A 16-week trace: 4 identical pure segments byte-reproduce (s4 == s1), 5 distinct purposes everywhere, authored dose never exceeded, family finalStress ≤ weeklyBudget and non-increasing vs initial. |
| Support surviving ahead of selected major work | `verify_pipeline` rising major-family stress + moderate-pressure accessory-first; duration-overflow freeze blockers | A-seg3 binding segment: support omitted with the production `before changing bench_press major exposure` provenance before any major cut; B-tighten: duration-cap support yields first; ordering detector (X3) proves a mutant with surviving full support behind a cut major is flagged. |
| Loss/duplication of athlete-selected majors | `verify_pipeline` freeze/role/availability blockers; `verify_blocks` substitution laws | A-seg1 five majors preserved 1:1 with no duplicates; B availability-loss: whole result fails closed with the named movement in a blocker, zero prescriptions (no silent substitution), detector X6 flags any partial result beside a blocker. |
| Sport-tier relief leaking into weight-room days | `verify_blocks` [16b] single-block day-local contexts | Family C 16-week composed trace: Advanced carry probe drafted on conditioning days and on ZERO weight-room days across 4 blocks; per-day context derived from the day's focus; weight-room days carry no Advanced movement. |
| Date duplication/ordering across month/year/DST-adjacent boundaries | `verify_blocks` [2] single-block `start + (week-1)*7 + (day-1)` formula | C: 4 blocks advanced by `addDaysIso(prev, 28)` (production UTC helper), starts 2025-10-04 (Sydney DST-start-adjacent), 2025-11-01, 2025-11-29, 2025-12-27 (block 4 internally crosses into 2026-01-01); 48 dates unique + strictly ordered; explicit arithmetic pins for 2025-10-05, 2025-12-01, 2026-01-01, DST-end 2026-04-05/06. |
| Stale state silently reused where the seam represents missing input | Store gate `apps/mobile/test/verify_store_sql.mjs` (~line 641): 'missing readiness vector clears the stale prescription') | D: `recentAcwr: null` never shifts, even after a hot neighbour; omitted `recentAcwr` ≡ explicit null; hot peak effect stays inside its own block (phase shape pinned: deload w1, accumulation w2, intensification w3, realization w4) and neighbours stay byte-equal to isolated recomputation. Stale readiness is not representable in this pure seam — the store gate is cited, not re-invented. |
| Existing ACWR behavior | `verify_blocks` [10] (calm/hot/gpp/null pins) — unchanged | D re-pins the same ratified shape per block inside a composed trace; no new policy, no terminology change. |

## 4. Scenarios, simulated weeks/segments, exact invariants

- 4 scenario families + 7 counterexample/mutation checks + 2 fixture-completeness self-tests = 64 checks.
- Simulated weeks: Family A 16 (4 segments × 4 weeks), Family B 20 (5 metamorphic variants × 4 weeks, seam-pure so each week byte-identical), Family C 16 (4 blocks × 4 weeks), Family D 16 (4 peak blocks × 4 weeks). Total 68 simulated weeks.
- Invariants enforced (grouped): determinism & input purity; exact trace cardinality; finite/domain-bounded dose; no dose expansion; support-yield-before-major; major preservation; fail-closed availability; day-local access context; tier-relief non-leak; capability/equipment independence from tier; unique strictly-ordered dates across month/year/DST-adjacent boundaries; null-vs-hot ACWR isolation; per-block purity of the composed trace.
- Mutation/counterexample checks (X1–X7): each major invariant's detector demonstrably fires on a locally mutated fixture/result; fixture completeness fails with the exact missing field name.
- Trace/memory discipline: in-memory deterministic summary only (scenario IDs, segment/week counts, purposes, finalStress, blockers); no timestamps/paths/machine names in equality assertions; `process.memoryUsage()` printed as informational diagnostics only; the gate leaves zero files behind (no temporary files created at all).

## 5. Gate command/result table

Baseline (before editing):

| Gate | Result |
|---|---|
| `npm.cmd run typecheck` | exit 0 |
| `npm.cmd run verify:autopilot` | exit 0 |
| `npm.cmd run verify:pipeline` | exit 0 (51 checks) |
| `git status --short` | clean |

During implementation (after each meaningful batch):

| Gate | Result |
|---|---|
| `npm.cmd run typecheck` | exit 0 |
| `npm.cmd run verify:autopilot` | exit 0 (now incl. 64 new longitudinal checks) |
| `npm.cmd run verify:pipeline` | exit 0 |
| `npm.cmd run verify:blocks` | exit 0 |

Final gate (in work-order order):

| # | Gate | Result |
|---|---|---|
| 1 | `npm.cmd run typecheck` | exit 0 |
| 2 | `npm.cmd run verify:autopilot` | exit 0 |
| 3 | `npm.cmd run verify:autopilot-counterexamples` | exit 0 (7 R2 conversions, 13 expected PASS) |
| 4 | `npm.cmd run verify:pipeline` | exit 0 |
| 5 | `npm.cmd run verify:blocks` | exit 0 |
| 6 | `npm.cmd run verify:store` | exit 0 |
| 7 | `npm.cmd run verify:components` | exit 0 |
| 8 | `npm.cmd run verify:all` | exit 0 (after `npm.cmd run fetch:embedder`) |
| 9 | `git diff --check` | exit 0 |
| 10 | `git status --short` | clean after checkpoint commit |

`verify:all` first attempt stopped at `verify:embedder` with
`embedder assets missing — run: node scripts/fetch-embedder.mjs`. The
pinned workflow `npm.cmd run fetch:embedder` then materialized the model
from the verified revision cache: `onnx/model_quantized.onnx`
`sha256=afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`,
`tokenizer.json` `sha256=da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0`,
`tokenizer.min.json` `sha256=ed2e443c24f234f62dd05a039ca0c489d8d1a7039f1f42fc876aaae9cb32cff6` —
all byte-identical to the ratified integrity pins. Assets remain ignored;
no pins, lockfiles or supply-chain policy changed.

## 6. Scope confirmation

Production inference, policy, coefficients, budgets, thresholds, tier/role/
access/attestation behavior, ACWR behavior, return-to-training and BJJ
policy, migrations, schema, migration runner, UI (`apps/mobile/src/`),
native/Android/Gradle/ONNX runtime and dependencies were NOT changed in this
phase. The only production-adjacent mutation is the `verify:autopilot` script
line appending the new verifier. No dependencies, package versions or
lockfiles were touched.

## 7. Honest limitations

- This verifier proves software properties over adversarial 12–16-week
  scenarios. It does NOT establish physiological safety, calibrate training
  science, or claim injury prediction. No schedule here is asserted to be
  medically safe.
- Host-process `process.memoryUsage()` is informational only and is NOT
  evidence for the Android 450 MB private-dirty requirement; that remains
  owner visual/device acceptance (no APK/AAB build or device memory run was
  performed, as authorized).
- Family A/B execute the routine microcycle seam directly; the store gate
  owns concepts that are not representable there (see §3 stale-readiness row).
- The composed generateBlock traces share one fixed profile and schedule per
  family; the metamorphic families vary exactly one input dimension each by
  design.

## 8. `git status --short` after commit

Clean — the checkpoint commit contains exactly the three files in §2; `.build`,
downloaded ONNX assets, `node_modules` and the work-order directory are
ignored. Confirmed in the completion report immediately after the commit.

## 9. Auditor instruction

Fresh Claude Code / Opus 5 / maximum context / read-only: audit the frozen
range `a38ab102b9b01cebdc91c20214fed1560207cd39..<checkpoint SHA>` and
reproduce every gate in §5 in order from a clean worktree created from the
frozen parent. Confirm: only the three listed files changed; verifier loads
production exports from `.build` and copies no formula; no assertion weakens
an existing check; `verify:all` passes end-to-end (run `npm.cmd run
fetch:embedder` first if the model asset is absent, then verify its pinned
hashes). Do not push or release.