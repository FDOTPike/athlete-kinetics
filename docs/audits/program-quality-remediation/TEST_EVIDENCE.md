# Test Evidence — Program Quality and Intake Remediation

Executor: GLM-5.3 Flash (Hermes session, 2026-09-01) · Frozen candidate `cfbcf67e6b810bfb2e7793cf92980bff3f04d3d6`

All commands below were executed in `.worktrees/program-quality-remediation` on Node v26.5.1 / npm 12.0.2, Windows 11, git-bash shell.

## Baseline (pre-change, at 71b1a2f)

| Command | Exit | Result |
|---|---|---|
| `npm run typecheck` | 0 | clean |
| `npm run verify:blocks` | 0 | ALL CHECKS PASSED |
| `npm run verify:migrations` | 0 | ALL CHECKS PASSED (58 files) |
| `npm run verify:db` | 0 | ALL CHECKS PASSED |
| `npm run verify:store` | 0 | ALL CHECKS PASSED |

## Final (frozen candidate)

| Command | Exit | Result |
|---|---|---|
| `npm run typecheck` | 0 | clean |
| `npm run verify:migrations` | 0 | ALL CHECKS PASSED — includes new [2z] 060 section: exact 3-row correction, provenance, 059-boundary upgrade, replay idempotence, poison self-heal, full re-apply from zero, FK cascade; user_version pin re-pinned to 59 |
| `npm run verify:db` | 0 | ALL CHECKS PASSED |
| `npm run verify:blocks` | 0 | ALL CHECKS PASSED — verify_blocks.mjs (incl. new [29] bodyweight rep law + loaded counter-check), verify_movementRanking.mjs 35/35 (new), verify_effort_cues.mjs (new), verify_load_selection.mjs |
| `npm run verify:store` | 0 | ALL CHECKS PASSED (needles intact; completeOnboarding signature unchanged) |
| `npx jest --runInBand --runTestsByPath ProfileScreens ProgramSetupScreen SessionScreen` | 0 | 101/101 (69 SessionScreen incl. new PQ-12/PQ-13 proofs; 26 ProfileScreens incl. new W2 7-screen contract tests) |
| `npm run verify:components` | 0 | 18 suites / 239 tests passed |
| `npm run verify:autopilot` | 0 | longitudinal bounds 78 passed, 0 failed (after access-context fix; was 77/1 during W6 — fixed, documented below) |
| `npm run verify:pipeline` | 0 | 51 checks passed (re-based 060 pins) |
| `npm run verify:ci` | 0 | full log `%LOCALAPPDATA%\Temp\verify_ci_full2.log` — preflight 7/7 after sanctioned `npm ci && npm run fetch:embedder`; every gate green |
| `git diff --check 965492e..HEAD` | 0 | clean |
| `git status --short --branch` | — | clean worktree, branch ahead of origin by design (no push) |

## Red proofs (tests that failed against the old behavior, then passed)

- `verify_movementRanking.mjs` — full suite red before `movementRanking.ts` existed (module missing → require failure), including the live-corpus defect case (full-gym fresh intermediate defaulting to Bodyweight Squat 28 over loaded 38/55).
- `[29]` in verify_blocks.mjs — first run reproduced the owner regression exactly: week 1 `3×10 @ 6.5` → week 2 `3×8 @ 7.5` on a strictly bodyweight Push-up slot; after the W4 floor: `3×10 @ 7.5`. The loaded counter-check proves WAVE shrink survives where a real load channel exists (RDL 10→8).
- PQ matrix first run: 10/14 → after gate-reason visibility fix and correct pick assertions: 14/14. The failing rows initially exposed a genuine integration defect (ranker blind to gate reports), not a test artifact.
- `verify:autopilot` caught a real defect during W6: the ranker hardcoded the weight-room context and suppressed the ratified sport-tier-relief probe (77/1, "probe must actually be drafted under sport tier relief (non-vacuous)"). Fixed by threading `accessContext` through the ranking input; 78/0. No gate was weakened — the fix restored the sport context law.
- `verify:pipeline` caught the policy collision: three pins codified the old "competition lifts stay Advanced" ratification. Re-based onto the owner's explicit §2.3 ruling with provenance assertions and the surviving tier-ceiling property proven against still-Advanced movements. Disclosed in EXECUTOR_HANDOFF.md.

## Matrix

`PROBE_CWD=<repo> node docs/audits/program-quality-remediation/matrix_harness.mjs` → PQ-01…PQ-14: 14/14 PASS. Output and plan snapshots in GENERATED_PROGRAM_MATRIX.md (regenerated from the frozen candidate).

## Boundary confirmations

- No `verify:release` run; no C6 claim.
- No new dependency; no signing/release/build config touched.
- No sensor, Health Connect, or biometric code path added (verify_effort_cues.mjs greps the new copy for biometric implication; the new code imports no biometrics module).
- Shipped migrations 001–059 byte-identical (`git diff 965492e..HEAD -- packages/core-db/src/schema/` shows only the new 060 file).
