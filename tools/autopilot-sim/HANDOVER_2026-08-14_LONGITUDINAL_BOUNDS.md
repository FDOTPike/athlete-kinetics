# Handover — 2026-08-14 Longitudinal Deterministic Verification (rev. 5)

Owner: Francis Pike
Phase: test-only longitudinal verification (HERMES_WORK_ORDER_LONGITUDINAL_VERIFICATION.md and HERMES_AMENDMENT_OPUS_P2_CLOSEOUT.md, 2026-08-14)
Primary implementation: Hermes/Gemini executor pipeline
Final accuracy cleanup: Codex (owner-authorized)

## 1. Frozen parent and checkpoints

- Frozen parent: `a38ab102b9b01cebdc91c20214fed1560207cd39` (`fix(routines): preserve authored projected RPE ceiling`).
- Checkpoint 1: `12da513b2c7815d6941b172651e3eb00f8afc2ea` (`test(inference): add longitudinal bounds verification`).
- Checkpoint 2: `7002c247c3bbd7291056dad459b8d5b57144848f` (`fix(inference): harden longitudinal verifier per audit`).
- Checkpoint 3: `f6dce82002890c6e230670fe7708addacd350132` (`test(inference): close longitudinal audit findings`).
- Checkpoint 4: `2ed953153da1e80bd020826524b3344adec5ba3d` (`test(inference): land P2 closeout implementations and repair summary`).
- Checkpoint 5 (final accuracy cleanup): the commit containing this handover. The focused audit range is `2ed953153da1e80bd020826524b3344adec5ba3d..<checkpoint5>` (full range `a38ab102b9b01cebdc91c20214fed1560207cd39..<checkpoint5>`).
- Worktree/branch: `.worktrees/hermes-longitudinal-verification` / `codex/hermes-longitudinal-verification`. No push, no release.

## 2. Exact files changed

| File | Change |
|---|---|
| `packages/inference/test/verify_longitudinal_bounds.mjs` | Extends generator fixture-completeness coverage across every required field and derives all per-segment/per-variant/per-block evaluation counts from the real trace structures. |
| `tools/autopilot-sim/HANDOVER_2026-08-14_LONGITUDINAL_BOUNDS.md` | Corrects the two residual audit overclaims and updates the final checkpoint history. |
| `package.json` | Byte-identical to `7002c24` and `f6dce82` (unchanged). |

No other file changed. Production inference, policy, coefficients, budgets,
thresholds, tier/role/access behavior, ACWR behavior, migrations, UI, native
code and dependencies are untouched (§7).

## 3. Coverage map (existing vs new)

| Property | Existing coverage | New longitudinal/metamorphic coverage |
|---|---|---|
| Nondeterminism / input mutation | `verify_blocks` [1]; `verify_autopilot` [1]; `verify_pipeline` | Every scenario double-run from freshly deep-cloned, deeply frozen inputs (Set/Map mutators stubbed), deep-equality via `isDeepStrictEqual`, mutation throws. |
| Unbounded growth / trace size | `verify_blocks` [2]/[7]; 32-week closed-loop sim (`tools/autopilot-sim/closedLoop.ts`, `runSweep.ts`) | Exact cardinalities: A 16 weekly evaluations derived from segment arrays; B 20 derived from variant evaluation arrays; C/D 48 sessions each, with generated-week counts derived from each block's observed `week_index` values. Total 68 weekly evaluations (32 calendar-advancing, 36 time-invariant). |
| Non-finite / out-of-domain dose | `verify_blocks` [2]; `verify_pipeline` | `doseViolations`/`planSlotDomainViolation` over all 68 weekly evaluations. |
| Dose expansion across repeated family exposure | `verify_pipeline` Elite bench (single microcycle) | A 16 weekly evaluations (s4==s1 byte-equal), 5 distinct purposes, dose never exceeds authored, finalStress ≤ budget & ≤ initial. |
| Support before major under binding bounds | `verify_pipeline` rising stress + moderate accessory-first | A-seg3 support omitted with provenance text before any major cut; B-tighten duration positively verifies major inclusion, support omission, exact provenance text ("duration cap" and "before changing a major"), and dose domain validity (P2-1); detector X3. |
| Major preservation / no silent substitution | `verify_pipeline` freeze/role/availability; `verify_blocks` substitution | A-seg1 five majors preserved 1:1; B availability-loss whole-result fail-closed with named blocker, zero prescriptions; detector X6. |
| Sport-tier relief not leaking to weight-room days | `verify_blocks` [16b] single block | C composed 4-block trace (16 date-advancing weeks): Advanced probe on sport days, zero weight-room days; per-day context from focus; shared detector X4. Non-empty slot inspection guards added (P2-3). |
| Dates across month/year/calendar boundaries | `verify_blocks` [2] single-block date formula | C: 4 blocks advanced by `addDaysIso(prev,28)` over 2025-10-04 (Australian spring DST-adjacent), Nov/Dec month, 2026-01-01 year boundary; 48 dates unique+ordered; explicit arithmetic pins incl. autumn DST-adjacent (2026-04-05); detector X5. Uses timezone-independent UTC date-only arithmetic (P2-8). Zero occurrences of "Sydney" in verifier. |
| Stale state vs missing-input seam | Store gate `verify_store_sql.mjs` ("missing readiness vector clears the stale prescription") | D: `recentAcwr:null` never shifts even after a hot neighbour; omitted ≡ null; hot block effect scoped (pinned phases); per-block isolation byte-equal. Cited, not re-invented. |
| Existing ACWR behavior | `verify_blocks` [10] | D re-pins the ratified shape per block; no policy/terminology change. |

## 4. Scenarios, evaluations, invariants

- 4 families + 8 counterexample checks (X1–X7b) + fixture-completeness self-tests = 78 checks.
- Evaluations: 68 total weekly evaluations (A: 16 time-invariant, B: 20 time-invariant across 5 variants, C: 16 calendar-advancing, D: 16 calendar-advancing). A/B counts derive from their segment/variant arrays; C/D counts derive from distinct production `week_index` values observed inside each generated block. 32 weeks advance real production session dates; 36 evaluations are pure time-invariant routine microcycles.
- Counterexample checks X1–X7b (8 checks total: X1, X2, X3, X4, X5, X6, X7, X7b) invoke the SAME named predicates the family checks use against the real outputs, proving each invariant fails for its intended reason on a local mutation. Routine and generator fixture-completeness checks each iterate their owning required-field table and prove every listed field produces a named failure when omitted.
- Trace/memory discipline: in-memory deterministic summary only (scenario/segment/eval counts, purposes, finalStress); no timestamps/paths/machine names; `process.memoryUsage()` informational only; no files left behind.

## 5. Opus P2 Closeout Disposition

### Rev. 3 correction

Rev. 3 (`f6dce82`) documented P2-1, P2-2, P2-3 and the verifier half of P2-8 as complete, but the committed verifier did not contain them; only P2-4, P2-6 (as hardcoded literals) and P2-7 had landed. Rev. 4 lands the actual implementations and additionally derives the P2-6 counts from the traces rather than asserting literals.

### Rev. 5 final accuracy cleanup

The independent audit accepted checkpoint 4 with no P0/P1 but identified two residual documentation overclaims. Rev. 5 closes both: X7 now iterates all `GENERATOR_MOVEMENT_REQUIRED` fields (matching the routine-input loop), and summary week counts no longer multiply block counts by a literal four. A/B per-segment/per-variant counts and C/D per-block counts all derive from their actual trace arrays. Stale line-number citations existed only in the external audit summary and are deliberately not repeated here. The consumed untracked `AGENT.md` executor order was removed before this checkpoint.

### Detailed disposition

- **P2-1 (B duration-cap proof non-vacuous):** In `[B-TIGHTEN-DURATION]`, positively asserts at least one major row exists and stays `included === true`, at least one support row exists and is `included === false`, every omitted support row carries exact production provenance with `"duration cap"` and `"before changing a major"`, included work strictly drops, final stress does not increase, and major dose stays inside domain bounds.
- **P2-2 (Fixture completeness failure paths):** `[B-BASE]` iterates every `ROUTINE_INPUT_REQUIRED` field; X7 now mirrors that proof for every `GENERATOR_MOVEMENT_REQUIRED` field. Each case clones a complete fixture, deletes one key, asserts the owning validator throws, and verifies the missing-field label.
- **P2-3 (Non-empty guards on Family C slot loops):** In Family C per-day context and slot-domain loops, counts inspected production slots and asserts `inspectedSlots > 0`.
- **P2-4 (Guard X4 before indexing slot):** In `[X4]`, asserts `fullDay !== undefined` and `fullDay.slots.length > 0` before indexing and mutating a slot.
- **P2-5 (Correct duration-cap handover claim):** Coverage map and remediation text accurately describe the positive, multi-assertion P2-1 check.
- **P2-6 (Truthful evaluation/week terminology):** Replaced ambiguous "68 simulated weeks" with 68 total weekly evaluations: 32 calendar-advancing generated weeks (C & D) and 36 time-invariant routine microcycle evaluations (A & B). A/B counts derive from real segment/variant arrays; C/D generated-week counts derive from distinct observed `week_index` values per block. No summary week count uses a literal multiplier.
- **P2-7 (Correct X-series count):** Updated all references to reflect exactly 8 checks in the X-series: X1, X2, X3, X4, X5, X6, X7, and X7b, while preserving the verified total of 78 `check()` calls.
- **P2-8 (Remove decorative Sydney-DST claims):** Reframed Family C as timezone-independent ISO calendar-boundary verification using UTC date-only arithmetic (`addDaysIso`), explicitly noting it does not consume an IANA timezone or test local-clock behavior. Zero occurrences of `Sydney` in the verifier; labels updated to `DST-adjacent calendar boundaries`.

## 6. Gate results (rev. 5, in work-order order)

| Gate | Result |
|---|---|
| `typecheck` | 0 |
| `verify:autopilot` | 0 (78 longitudinal checks, 0 failed) |
| `verify:autopilot-counterexamples` | 0 (7 R2 conversions, 13 expected PASS) |
| `verify:pipeline` | 0 (51 checks) |
| `verify:blocks` | 0 |
| `verify:store` | 0 |
| `verify:components` | 0 (179 tests) |
| `verify:all` | 0 (embedder pins re-verified) |
| `git diff --check 2ed953153da1e80bd020826524b3344adec5ba3d..HEAD` | 0 |
| `git status --short` after commit | clean |

## 7. Scope confirmation

No production edits under `apps/mobile/src/` or `packages/inference/src/`; no
migration/schema/migration-runner edits; no dependencies, package-version or
lockfile changes; no native/Android/Gradle/ONNX/release changes. `package.json`
is byte-identical to `7002c24` and `f6dce82`.

## 8. `git status --short` after commit

Clean — the commit contains exactly the verifier + handover; ignored `.build`,
ONNX assets, and `node_modules` cannot leak in. The consumed untracked
`AGENT.md` executor order was removed before the final checkpoint.

## 9. Honest limitations

- Software-property proof over adversarial 16-week scenarios only; no
  physiological-safety proof, no injury prediction, no training-science claim.
- Host `process.memoryUsage()` is informational, NOT Android 450 MB
  private-dirty evidence; device/visual acceptance remains out of scope here.

## 10. Auditor instruction

Fresh Claude Code / Opus 5 / maximum context / read-only: audit the focused
range `2ed953153da1e80bd020826524b3344adec5ba3d..<checkpoint5>` and full range
`a38ab102b9b01cebdc91c20214fed1560207cd39..<checkpoint5>`. Reproduce all §6
gates from a clean worktree. Confirm: only the verifier and handover changed
relative to checkpoint 4; `package.json` is byte-identical; generator and
routine completeness cover every declared required field; all evaluation/week
counts derive from actual trace structures; all gates pass. Do not push or release.
