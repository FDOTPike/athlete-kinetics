# D02 Inference Policy Integration Handover

This is implementation work, not independent approval. Codex/Sol audits the completed candidate. Output equality here is a product-policy and deterministic-software result; it is not medical validation.

## 1. Authority and Scope

- Work order: D02, "Remove experience-only workload uplift and integrate it onto the post-PR #18 base", recorded verbatim as PROMPT_LEDGER Entry 0133 (the first repository write).
- Ruling: D02 in `docs/decisions/ACCESSIBLE_COACH_ASTRA_OWNER_RULINGS_2026-09-13.md` and the checkpoint record. Experience alone must not add sessions, minutes, sets, target effort or fatigue allowance. Eligibility, beginner protections and explanation depth may remain.
- Production scope accepted: `packages/inference/src/blockGenerator.ts`, `routineComposer.ts` and `routineMicrocycle.ts`. No other production file changed.
- Not changed: Migration 064 (blob `69090f214516fe2b3d0e31c082f7969b8889dc86`) and every migration and schema; backup, restore and recovery code; clinical, training-support and activity code; mobile UI; native Android; `package.json` and the lockfile. Activity-aware recommendation work was not started.

## 2. Starting Identity

- Repository: the Athlete App checkout; integration worktree `.worktrees/d02-policy-integration`.
- Target base: `origin/codex/rpe-familiarisation` at `9c7c91f6b7beaf73a9e98155b8ae626fd101875d` (tree `452d86b72691854073f0e9eb96470c9f6acbb997`), "Merge pull request #18". PR #18 was merged on 2026-09-14T22:38:49Z and its head `5e8e829` is contained. The tip was re-fetched before push and was unchanged.
- D02 source: `origin/codex/d02-inference-policy` at `327f84255b97f89973f8a06de52cbd4b830e07a7` (tree `01e31e44594895d6c2a329acf949019f34789481`). Merge base `b94053b4d63fb0ffd3b933aa1890d80f7313a87b`; the target was 31 commits ahead of it.
- Branch `claude/d02-policy-integration` was created from the verified target, clean, with no upstream. The Codex D02 worktree was only read.

## 3. Audit of the D02 Candidate

| Question | Finding |
|---|---|
| Production outputs that change | Three edits. `generateBlock` no longer adds an elite set. `routineMicrocycle` default doses use 0 instead of +1 for advanced and elite, and advanced and elite family budgets fall from 40/80 and 48/100 to the intermediate 32/60. `composeRoutine` (compatibility) uses 0 instead of +1 for advanced and elite. |
| All experience-only uplift paths covered | Yes, for dose. Every `training_age`/`TrainingAge` use in `packages/inference/src` and `apps/mobile/src` was reviewed (section 8). No other path adds sessions, sets, reps, target effort, slots or fatigue budget by tier alone. |
| Training age outside the authorized boundary | Remaining uses are eligibility (`tierPolicy`, `capabilityResolver`, `movementRanking`), beginner protections (RPE 8.5 cap, set reduction, standalone lock, load auto-mode), explanation copy, and more conservative symptom handling for experienced tiers. One item is flagged for owner review: the runner rest-timer scale (section 8). |
| Beginner eligibility and reductions | Intact. The beginner set reduction, the whitelist law and the standalone-routine lock are unchanged, and are now also pinned by mutation (section 6). |
| Authored or custom routines rewritten | Authored values are never rewritten: `authoredSets`, `authoredReps` and `authoredTargetRpe` are unchanged in every captured record. When an elite athlete's authored volume exceeds the lower family budget, the bounded execution dose tightens (section 5). This is the ratified fatigue-allowance removal, not an unexpected rewrite. |
| Evidence reproducible, no secrets or local data | Reproduced byte-for-byte (section 5). The artifact contains no user path, workstation name, `.codex` path or secret-like string (zero matches). `D02_EVIDENCE.md` still names the Codex worktree's absolute path in prose; this is documentation-only and left unchanged. |
| Assertions weakened | None. The candidate's test diff removes no assertion; its only deleted lines are an extended import, a relocated `require` and a reshaped loop header. |

Candidate gaps found and corrected in a separate test-only commit (section 4):

1. The mutation check had no elite family-budget mutant and did not prove restoration by hash.
2. `compare_d02.mjs` did not assert "no dose increase". A tampered capture with one extra set passed the candidate's compare (exit 0).
3. Routine non-vacuity assertions had no R05 message, so an empty-routine mutant could not be attributed to R05.
4. Beginner eligibility had no D02-specific frozen check, and there was no focused D02 verifier.

## 4. Commits

- `e57908a` docs(ledger): record D02 policy integration prompt (Entry 0133)
- `1ac6fa3` Merge origin/codex/d02-inference-policy (parents `e57908a`, `327f842`), a normal non-squash merge. The candidate commits `9e9f739` and `327f842` are unchanged.
  - Only conflict: `PROMPT_LEDGER.md`, where both sides appended after Entry 0121. Resolved as the merge-base bytes, then the D02 prompt text (committed 2026-09-13 14:20 and 14:36), then this lineage's WO-06 section through Entry 0133 (first committed 15:17 that day). Both sides are byte-for-byte; no byte was added or removed; entry header count is unchanged.
- `c9da999` test(inference): strengthen D02 acceptance, mutation and evidence checks. Test files only.
- This commit: docs, the D02 integration handover and Entry 0133 results (documentation only; its final verify:ci is reported in the pull request).

## 5. Before/After Prescription Effects

The capture harness was run twice, each time from clean builds:

- at the candidate base `b94053b` versus the candidate tip `327f842`, in a disposable detached worktree;
- at the integration base `e57908a` versus the merge `1ac6fa3`.

Both runs regenerate `packages/inference/test/D02_PRESCRIPTION_CHANGES.json.gz` byte-for-byte: SHA-256 `a1359e4eabd6ba8857d17897e37db782de2db977a1fa16ae91c9d41a1c15b558`, 221,910 bytes.

| Verifier | Calls before/after | Unique inputs | Changed inputs | Changed calls |
|---|---:|---:|---:|---:|
| verify_blocks | 8,879 / 8,879 | 8,671 | 3 | 3 |
| verify_pipeline | 39 / 39 | 37 | 17 | 17 |
| verify_programQualityRound2 | 2 / 2 | 2 | 0 | 0 |
| verify_longitudinal_bounds | 109 / 109 | 24 | 6 | 55 |
| verify_autopilot, verify_movementRanking, verify_effort_cues, verify_load_selection, verify_completion_action | 0 / 0 | 0 | 0 | 0 |

No captured input or call disappeared. The strengthened compare checks all 26 changed inputs and finds no increase. The total prescribed sets delta is -132.

- **Blocks:** three elite inputs (two strength, one gpp) have 126 prescription rows each reduced by one set (-64, -42, -20). Session count, slot count, movements, reps and target effort are unchanged.
- **Pipeline:** all 17 changed inputs are elite `composeRoutineMicrocycle` fixtures.
  - In 16, only the reported family budgets change (weekly 100 to 60, session 48 to 32). Stress, level, warnings, blockers and prescriptions are unchanged.
  - In one binding authored case (authored 10x10@9, bench-press family), rows move from 3x10@9 to 2x10@9 and from 4x5@9 to 2x5@9 (-3 sets). Bench stress falls from 46.3 to 27.8 and the adaptation warning text changes.
- **Longitudinal autopilot:** the same binding authored case appears 7 times (-3 sets per unique input). Five other elite cases report lower budgets with unchanged doses.
- **Changed fields:** only `sets`, `budget`, `weeklyBudget`, `adaptations`, `equivalentVolume`, `level`, `stressDose`, `finalStress` and `warnings`. Reps, target effort, inclusion, movement order and session counts never change.

Reproduction:

1. Build: `npm run build:inference-test`, plus the `verify:pipeline` tsc step.
2. For each suite named in `compare_d02.mjs`, run `D02_CAPTURE=<dir>/<before|after>-<suite>.jsonl node --require ./packages/inference/test/capture_d02.cjs <verifier>`. The `blocks`, `pipeline` and `autopilot` suites map to `verify_<suite>.mjs`; the others map to `<suite>.mjs`.
3. Repeat step 2 on the before and after commits.
4. Run `node packages/inference/test/compare_d02.mjs <dir> <out.json.gz>`.

## 6. Acceptance Tests and Mutation Results

Required tests and where each is implemented:

1. **Tier-only non-increase.** R05 compares complete outputs (deep equality, which is stronger than non-increase), with identical executable movements, availability, schedule, time cap, effort cap and objective. Comparisons: intermediate, advanced and elite. It covers session count, slots, sets, reps, target effort, duration-bounded inclusion, and per-family session and weekly budgets.
   - Blocks: 3,072 comparisons (autopilot: 12,288, over neutral, deficit, headroom and halt reports).
   - Bounded routines: 3,584.
   - Compatibility composer: 256.
   - Budgets are part of the routine output, and the budget table itself is also asserted.
2. **Beginner safeguards.**
   - Beginner set reduction is pinned exactly (block and compatibility) and is non-increasing across the matrix.
   - The standalone-routine lock stays closed, with its blocker.
   - New `verifyR05Eligibility` checks all 192 `isDifficultyAllowed` rows against an independent restatement of the ratified tier law. At block level, beginners receive only Beginner rows or whitelisted Intermediate staples. Beginners and intermediates never receive Advanced rows (dropped, never filled upward). Advanced and elite get identical prescriptions from both an Advanced-only fixture and a mixed-difficulty fixture.
3. **Non-vacuity.**
   - Every block session executes with work, and every routine prescription is included with sets.
   - Every family, schema and objective is exercised, and exact matrix sizes are asserted.
   - Fixtures use movements eligible for every compared tier.
4. **Mutations.** `node packages/inference/test/mutation_check_r05.mjs`:
   - Unmutated control runs pass first.
   - Each mutant rewrites one compiled file, is rejected by the named R05 check, and is restored to its pristine SHA-256.
   - The tracked-worktree fingerprint (HEAD, status, binary diff) is unchanged at the end.

| # | Mutant (compiled output) | Detected by | Result |
|---|---|---|---|
| 1 | elite block +1 set | R05 block tier-only dose | detected, restored |
| 2 | advanced/elite routine +1 set | R05 routine tier-only dose | detected, restored |
| 3 | advanced family budget 32/60 to 40/80 | R05 routine tier-only dose | detected, restored |
| 4 | elite family budget 32/60 to 48/100 | R05 routine tier-only dose | detected, restored |
| 5 | compatibility composer advanced/elite +1 set | R05 legacy tier-only dose | detected, restored |
| 6 | empty block output | R05 non-vacuity | detected, restored |
| 7 | empty bounded-routine output | R05 non-vacuity: every routine prescription executes | detected, restored |
| 8 | empty compatibility-composer output | R05 legacy non-vacuity | detected, restored |
| 9 | beginner block set reduction removed | R05 preserve beginner reduction | detected, restored |
| 10 | beginner eligibility widened | R05 eligibility | detected, restored |
| 11 | beginner standalone-routine lock removed | R05 beginner standalone eligibility stays closed | detected, restored |

Summary line: `11/11 detected; every file restored to its pristine SHA-256; worktree fingerprint dded589f197cb5e1 unchanged`. On the as-merged commit `1ac6fa3`, the candidate's original five-mutant script also passed (exit 0).

The first run of the new eligibility check failed, and the cause was a test fixture defect, not a product defect: three fixtures shared overlapping movement ids, so id 10 resolved to another fixture's Advanced row. Each fixture now owns a disjoint id range, with a uniqueness assertion.

5. **Evidence.**
   - `compare_d02.mjs` now asserts no dose increase for every changed output: no added session, slot, prescription or family, no newly included prescription, and no higher set, rep, effort, duration, stress or budget value.
   - Before the change was applied, the check was probed with a copy of the captures where one routine prescription had an extra set. The new compare exited 1 (`prescriptions[0].sets 2->3`); the candidate compare exited 0.
   - The artifact bytes are unaffected by the check.

Focused verifier: `node packages/inference/test/verify_d02.mjs`. It runs `verify:blocks`, `verify:pipeline` and `verify:autopilot`, and requires every R05 result line with its exact matrix size and no R05 failure.

## 7. Commands and Exit Statuses

Setup (worktree): `npm ci` exit 0 (791 packages). The pinned embedder cache and minilm assets were copied from a verified same-lineage worktree. `node scripts/verify-preflight.mjs`: `PREFLIGHT OK`, exit 0.

| Commit | Command | Exit / result |
|---|---|---|
| `9c7c91f` + `e57908a` | `npm run typecheck` | 0 |
| `e57908a` (pre-merge) | capture harness, nine child verifiers | all 0 (8,879 / 39 / 2 / 109 captured calls) |
| `b94053b` → `327f842` (disposable worktree) | capture harness + `compare_d02.mjs` | all 0; artifact byte-identical |
| `1ac6fa3` (merge, staged) | `git diff --cached --check`; `npm run typecheck` | clean; 0 |
| `1ac6fa3` | capture harness + `compare_d02.mjs` | all 0; artifact byte-identical; suites equal the candidate's |
| `1ac6fa3` | `npm run verify:blocks` / `verify:pipeline` / `verify:autopilot` / `verify:policy` | 0 / 0 / 0 / 0 |
| `1ac6fa3` | `node packages/inference/test/mutation_check_r05.mjs` (candidate, 5 mutants) | 0; 5/5 detected |
| working tree over `1ac6fa3` | strengthened `compare_d02.mjs` on both capture sets | 0; `NO DOSE INCREASE: 26 changed inputs checked; total prescribed sets delta -132`; artifact unchanged |
| scratch probe | strengthened / candidate `compare_d02.mjs` on a capture with +1 set | 1 (rejected) / 0 (accepted) |
| working tree over `1ac6fa3` | `npm run verify:blocks` (first run) | 1: eligibility fixture id collision (test defect, fixed) |
| working tree over `1ac6fa3` | `npm run verify:blocks` / `verify:pipeline` | 0 / 0 |
| working tree over `1ac6fa3` | `node packages/inference/test/mutation_check_r05.mjs` (11 mutants) | 0; 11/11 detected and restored |
| working tree over `1ac6fa3` | `npm run verify:autopilot` / `verify:policy` | 0 / 0 |
| working tree over `1ac6fa3` | `node packages/inference/test/verify_d02.mjs` | 0; `D02 FOCUSED VERIFY PASSED` |
| `c9da999` | `git diff --check`; `npm run typecheck` | clean; 0 |
| `c9da999` | `npm run verify:ci` | exit 0 (PREFLIGHT OK; Jest 45 suites / 706 tests passed) |

The tree checked in the working-tree rows is exactly the tree committed as `c9da999`, apart from the D02_EVIDENCE addendum (prose only), which was applied just before its typecheck and commit.

## 8. Remaining Training-Age Uses Reviewed (Not Changed)

- `tierPolicy.isDifficultyAllowed`, `capabilityResolver` (intermediate confirmation, advanced/elite prerequisite bypass) and `movementRanking.modeFor`: eligibility and ordering, authorized.
- `profileLimits`: the beginner RPE 8.5 cap, and `EXPERIENCE_TRIAGE` guardrail scaling. The scaling is more restrictive for experienced tiers; its load multiplier never exceeds 1 and its set delta is never positive.
- `types.EXPERIENCE_SEVERITY`: lower triage and halt thresholds for experienced tiers (more conservative). Legacy symptom semantics remain under D10 clinical review.
- `loadSelection.defaultLoadPreference`: advanced and elite default to manual load entry, which sets no prescription dose. Beginner is forced to auto.
- Mobile: onboarding and profile copy, guided or self-directed default mode, readiness detail level, library availability view. These are presentation and beginner protections.
- **Flagged for owner review:** `sessionRunner` scales the rest timer by 0.75 (beginner), 1 (intermediate and advanced) and 1.25 (elite).
  - It adds no sets, reps, effort, slots or fatigue allowance, and lowers work density.
  - It can lengthen an elite athlete's elapsed session time.
  - Changing it would alter live runner behaviour outside this work order's authorized scope and would be a replacement heuristic, so it is left unchanged pending a ruling.

## 9. Tested, Untested and Deferred

Tested by execution: sections 5–7.

Untested:
- No emulator, physical device or iOS run; not required for a pure prescription-policy change.
- No QA APK was built and no C6 qualification is claimed.
- No persona-level product acceptance or clinical review was run.
- Stored routines on existing installations were not replayed. The engine change applies the next time a routine is composed.

Deferred:
- The runner rest-scale ruling (section 8).
- D10 clinical review of experience-dependent symptom thresholds.
- The reviewed replacement for legacy tier-based budgets (owner rulings section 7). No replacement dose heuristic was introduced.

Remaining dependency: activity-aware recommendations may begin only after independent approval of D02.

MERGE / RELEASE / C6: NOT PERFORMED.
