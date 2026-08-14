# Handover — 2026-08-14 Longitudinal Deterministic Verification (rev. 3)

Owner: Francis Pike
Phase: test-only longitudinal verification (HERMES_WORK_ORDER_LONGITUDINAL_VERIFICATION.md & HERMES_AMENDMENT_OPUS_P2_CLOSEOUT.md, 2026-08-14)
Implementer: Hermes (sole implementation agent)

## 1. Frozen parent and checkpoints

- Frozen parent: `a38ab102b9b01cebdc91c20214fed1560207cd39` (`fix(routines): preserve authored projected RPE ceiling`).
- Checkpoint 1: `12da513b2c7815d6941b172651e3eb00f8afc2ea` (`test(inference): add longitudinal bounds verification`).
- Checkpoint 2: `7002c247c3bbd7291056dad459b8d5b57144848f` (`fix(inference): harden longitudinal verifier per audit`).
- Checkpoint 3 (P2 closeout): the commit containing this handover. The audit range is `7002c247c3bbd7291056dad459b8d5b57144848f..<checkpoint3>` (full range `a38ab102..checkpoint3`).
- Worktree/branch: `.worktrees/hermes-longitudinal-verification` / `codex/hermes-longitudinal-verification`. No push, no release.

## 2. Exact files changed

| File | Change |
|---|---|
| `packages/inference/test/verify_longitudinal_bounds.mjs` | Hardened per Opus P2 closeout amendment (§5). |
| `tools/autopilot-sim/HANDOVER_2026-08-14_LONGITUDINAL_BOUNDS.md` | Updated to rev. 3 handover. |
| `package.json` | Byte-identical to `7002c247c3bbd7291056dad459b8d5b57144848f` (unchanged). |

No other file changed. Production inference, policy, coefficients, budgets,
thresholds, tier/role/access behavior, ACWR behavior, migrations, UI, native
code and dependencies are untouched (§7).

## 3. Coverage map (existing vs new)

| Property | Existing coverage | New longitudinal/metamorphic coverage |
|---|---|---|
| Nondeterminism / input mutation | `verify_blocks` [1]; `verify_autopilot` [1]; `verify_pipeline` | Every scenario double-run from freshly deep-cloned, deeply frozen inputs (Set/Map mutators stubbed), deep-equality via `isDeepStrictEqual`, mutation throws. |
| Unbounded growth / trace size | `verify_blocks` [2]/[7]; 32-week closed-loop sim (`tools/autopilot-sim/closedLoop.ts`, `runSweep.ts`) | Exact cardinalities: A 4 segs×4 wks (16 weekly evaluations); B 5 variants×4 wks (20 weekly evaluations); C/D 48 sessions (16 date-advancing weeks each). Total 68 weekly evaluations (32 calendar-advancing, 36 time-invariant). |
| Non-finite / out-of-domain dose | `verify_blocks` [2]; `verify_pipeline` | `doseViolations`/`planSlotDomainViolation` over all 68 weekly evaluations. |
| Dose expansion across repeated family exposure | `verify_pipeline` Elite bench (single microcycle) | A 16 weekly evaluations (s4==s1 byte-equal), 5 distinct purposes, dose never exceeds authored, finalStress ≤ budget & ≤ initial. |
| Support before major under binding bounds | `verify_pipeline` rising stress + moderate accessory-first | A-seg3 support omitted with provenance text before any major cut; B-tighten duration positively verifies major inclusion, support omission, exact provenance text ("duration cap" and "before changing a major"), and dose domain validity (P2-1); detector X3. |
| Major preservation / no silent substitution | `verify_pipeline` freeze/role/availability; `verify_blocks` substitution | A-seg1 five majors preserved 1:1; B availability-loss whole-result fail-closed with named blocker, zero prescriptions; detector X6. |
| Sport-tier relief not leaking to weight-room days | `verify_blocks` [16b] single block | C composed 4-block trace (16 date-advancing weeks): Advanced probe on sport days, zero weight-room days; per-day context from focus; shared detector X4. Non-empty slot inspection guards added (P2-3). |
| Dates across month/year/calendar boundaries | `verify_blocks` [2] single-block date formula | C: 4 blocks advanced by `addDaysIso(prev,28)` over 2025-10-04 (Australian spring DST-adjacent), Nov/Dec month, 2026-01-01 year boundary; 48 dates unique+ordered; explicit arithmetic pins incl. autumn DST-adjacent (2026-04-05); detector X5. Uses timezone-independent UTC date-only arithmetic (P2-8). |
| Stale state vs missing-input seam | Store gate `verify_store_sql.mjs` ("missing readiness vector clears the stale prescription") | D: `recentAcwr:null` never shifts even after a hot neighbour; omitted ≡ null; hot block effect scoped (pinned phases); per-block isolation byte-equal. Cited, not re-invented. |
| Existing ACWR behavior | `verify_blocks` [10] | D re-pins the ratified shape per block; no policy/terminology change. |

## 4. Scenarios, evaluations, invariants

- 4 families + 8 counterexample checks (X1–X7b) + fixture-completeness self-tests = 78 checks.
- Evaluations: 68 total weekly evaluations (A: 16 time-invariant, B: 20 time-invariant across 5 variants, C: 16 calendar-advancing, D: 16 calendar-advancing). 32 weeks advance real production session dates; 36 evaluations are pure time-invariant routine microcycles.
- Counterexample checks X1–X7b (8 checks total: X1, X2, X3, X4, X5, X6, X7, X7b) invoke the SAME named predicates the family checks use against the real outputs, proving each invariant fails for its intended reason on a local mutation. Fixture completeness exercises every required field's failure path.
- Trace/memory discipline: in-memory deterministic summary only (scenario/segment/eval counts, purposes, finalStress); no timestamps/paths/machine names; `process.memoryUsage()` informational only; no files left behind.

## 5. Opus P2 Closeout Disposition (HERMES_AMENDMENT_OPUS_P2_CLOSEOUT.md)

- **P2-1 (B duration-cap proof non-vacuous):** In `[B-TIGHTEN-DURATION]`, positively asserts at least one major row exists and stays `included === true`, at least one support row exists and is `included === false`, every omitted support row carries exact production provenance with `"duration cap"` and `"before changing a major"`, included work strictly drops, final stress does not increase, and major dose stays inside domain bounds.
- **P2-2 (Routine fixture completeness failure path):** In `[B-BASE]`, iterates `ROUTINE_INPUT_REQUIRED` table, cloning the base input, deleting each key, asserting `assertRoutineInputComplete` throws, and asserting the thrown message names the missing field label.
- **P2-3 (Non-empty guards on Family C slot loops):** In Family C per-day context and slot-domain loops, counts inspected production slots and asserts `inspectedSlots > 0`.
- **P2-4 (Guard X4 before indexing slot):** In `[X4]`, asserts `fullDay !== undefined` and `fullDay.slots.length > 0` before indexing and mutating a slot.
- **P2-5 (Correct duration-cap handover claim):** Coverage map and remediation text accurately describe the positive, multi-assertion P2-1 check.
- **P2-6 (Truthful evaluation/week terminology):** Replaced ambiguous "68 simulated weeks" with 68 total weekly evaluations: 32 calendar-advancing generated weeks (C & D) and 36 time-invariant routine microcycle evaluations (A & B). Handover and verifier console summary use `weeklyEvaluations`, `calendarAdvancingWeeks`, `timeInvariantWeeklyEvaluations`, `dateAdvancingWeeks`.
- **P2-7 (Correct X-series count):** Updated all references to reflect exactly 8 checks in the X-series: X1, X2, X3, X4, X5, X6, X7, and X7b, while preserving the verified total of 78 `check()` calls.
- **P2-8 (Remove decorative Sydney-DST claims):** Reframed Family C as timezone-independent ISO calendar-boundary verification using UTC date-only arithmetic (`addDaysIso`), explicitly noting it does not consume an IANA timezone or test local-clock behavior. Labels updated to `DST-adjacent calendar boundaries`.

## 6. Gate results (rev. 3, in work-order order)

| Gate | Result |
|---|---|
| `typecheck` | 0 |
| `verify:autopilot` | 0 (78 longitudinal checks, 0 failed) |
| `verify:autopilot-counterexamples` | 0 |
| `verify:pipeline` | 0 (51 checks) |
| `verify:blocks` | 0 |
| `verify:store` | 0 |
| `verify:components` | 0 (179 tests) |
| `verify:all` | 0 (embedder pins re-verified) |
| `git diff --check 7002c247c3bbd7291056dad459b8d5b57144848f..HEAD` | 0 |
| `git status --short` after commit | clean |

## 7. Scope confirmation

No production edits under `apps/mobile/src/` or `packages/inference/src/`; no
migration/schema/migration-runner edits; no dependencies, package-version or
lockfile changes; no native/Android/Gradle/ONNX/release changes. `package.json`
is byte-identical to `7002c24`.

## 8. `git status --short` after commit

Clean — the commit contains exactly the verifier + handover; ignored
`.build`, ONNX assets and `node_modules` cannot leak in.

## 9. Honest limitations

- Software-property proof over adversarial 16-week scenarios only; no
  physiological-safety proof, no injury prediction, no training-science claim.
- Host `process.memoryUsage()` is informational, NOT Android 450 MB
  private-dirty evidence; device/visual acceptance remains out of scope here.

## 10. Auditor instruction

Fresh Claude Code / Opus 5 / maximum context / read-only: audit the range
`7002c247c3bbd7291056dad459b8d5b57144848f..<checkpoint3>` and full range
`a38ab102b9b01cebdc91c20214fed1560207cd39..<checkpoint3>`. Reproduce all §6
gates from a clean worktree at the frozen parent. Confirm: only the two
listed files changed relative to `7002c24`; `package.json` is byte-identical;
P2-1 through P2-8 are fully addressed; all gates pass. Do not push or release.
