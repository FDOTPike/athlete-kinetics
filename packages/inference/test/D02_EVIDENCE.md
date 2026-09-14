# D02 inference policy evidence

## Frozen starting identity

- Path: `C:\Users\fpike\.codex\worktrees\abec\Athlete App`.
- Initial branch: detached HEAD; no upstream; clean index and worktree.
- Required base and `origin/codex/rpe-familiarisation`:
  `b94053b4d63fb0ffd3b933aa1890d80f7313a87b`.
- Base tree: `99759f7be3af360a17037f3b18dd0f817cfd6704`.
- Initial divergence from required origin ref: 0 / 0.
- First repository write: verbatim task prompt appended to `PROMPT_LEDGER.md`.
- Task branch subsequently created: `codex/d02-inference-policy`.
- Test-first commit: `9e9f739d9c4b3907be8d2fc228f0584e816cee13`.
  Production engine files at this commit are identical to the required base.

## Policy change and limits

`blockGenerator.workingSetsFor` no longer adds an elite-only set.
`routineMicrocycle.AGE_SET_DELTA` changes advanced and elite from +1 to 0.
Routine session/week family ceilings change from 40/80 (advanced) and 48/100
(elite) to 32/60, the existing intermediate ceilings. These are product
heuristics, not claims of clinical validation.

The beginner block reduction and standalone-routine lock remain. Eligibility,
equipment, capability, attestation, and symptom-severity policies are unchanged.
R05 compares identical executable movements and hard limits across intermediate,
advanced and elite. Beginner safety exceptions are asserted separately; the
test does not claim equal dose across the permitted beginner safety boundary.

The owner-approved `docs/decisions/ROUTINE_BOUNDED_MICROCYCLE_POLICY.md` requires
non-increasing bounded prescriptions and a beginner lock. Its statement that
budgets are deterministic by training age does not require an upward gradient;
the age-keyed table remains, with equal eligible-tier ceilings. No conflicting
ratified requirement to grant larger advanced/elite budgets was found.

**Scope extension:** the owner explicitly authorized including
`packages/inference/src/routineComposer.ts` after its independent advanced/elite
+1 default-set delta was identified. That compatibility path now uses zero for
both tiers and retains its beginner reduction. The verbatim authorization is in
the prompt ledger. No mobile store, schema, or UI change was required.

## Test-first and mutation evidence

Before implementation, all three focused commands exited 1 with R05 failing
for the intended production cause. Their pre-existing checks passed:

- `verify:blocks`: `R05 block tier-only dose:
  strength/LINEAR/1/15/Barbell/elite`; elite adds sets to identical slots.
- `verify:pipeline`: `R05 routine tier-only dose:
  bench_press/LINEAR/strength/15/authored=false/freeze=false/advanced`;
  the default dose and family allowance depend on tier.
- `verify:autopilot`: the same elite block counterexample with a neutral report.

After scope authorization, the added legacy R05 test failed before its production
edit: `R05 legacy tier-only dose: LINEAR/strength/15/6/advanced`,
`verify:pipeline` exit 1. It now covers four roles, four schemas, eight objectives,
two time caps and two effort caps, plus beginner safety and unavailable movements.

Final R05 coverage includes all eight objectives, four schemas, four macro
phase positions, 15/90-minute block caps, declared loaded/bodyweight routes,
automatic/explicit schedules, all experience tiers, and neutral, deficit,
headroom and halt reports. Routine coverage exercises all seven actual
DB-derived major families, all schemas/objectives, 15/120-minute caps,
default/authored doses, builder/save and selected-day freeze with RPE clamping.
Full output equality covers individual doses, schedules, inclusion, stress
metrics and fatigue allowances. Non-empty execution checks prevent vacuity.
Final gate counts: 3,072 block tier comparisons, 12,288 autopilot block tier
comparisons, 3,584 bounded-routine comparisons, and 256 legacy comparisons.
The block counts include the intermediate control as well as the two changed
tiers; beginner safety assertions are additional.

`node packages/inference/test/mutation_check_r05.mjs` independently restored
each production defect in disposable compiler output and rejected all mutants:

1. Elite block set bonus: R05 block counterfactual fails.
2. Advanced/elite microcycle default bonus: R05 routine counterfactual fails.
3. Advanced family budget bonus: R05 routine counterfactual fails.
4. Legacy advanced/elite default bonus: R05 legacy counterfactual fails.
5. Empty block output: R05 non-vacuity assertion fails.

The mutation script restores each compiled file in a `finally` block.

## Exhaustive before/after capture for existing gate fixtures

`D02_PRESCRIPTION_CHANGES.json.gz` contains the exact canonical inputs and full
before/after outputs for every changed input in the existing gate fixtures.
Each record includes its input SHA-256 key and repeat count. Decompress with
Node's `gunzipSync` to obtain readable JSON. R05 calls are deliberately excluded
from this regression capture because they form a separate new test matrix.
Compressed artifact SHA-256:
`a1359e4eabd6ba8857d17897e37db782de2db977a1fa16ae91c9d41a1c15b558`.

| Verifier | Calls before/after | Unique inputs | Changed inputs | Changed calls |
|---|---:|---:|---:|---:|
| verify_blocks | 8,879 / 8,879 | 8,671 | 3 | 3 |
| verify_pipeline | 39 / 39 | 37 | 17 | 17 |
| verify_autopilot | 0 / 0 | 0 | 0 | 0 |
| verify_programQualityRound2 | 2 / 2 | 2 | 0 | 0 |
| verify_longitudinal_bounds (verify:autopilot) | 109 / 109 | 24 | 6 | 55 |

The remaining scripts in `verify:blocks` and `verify:autopilot` had no planner
calls and no changed outputs. The comparison asserts matching input keys and
per-input call counts, as well as determinism of repeated baseline calls.
No captured input or call disappeared.
The final recapture includes the authorized legacy-composer change. Existing
compatibility-composer fixtures use unchanged tiers, so they add no changed
records; the new legacy R05 matrix proves the advanced/elite behavior directly.

Across distinct changed inputs:

- Blocks: 126 changed prescription rows, each reduced by one set (126 fewer
  sets in total). Examples: 5x8@7 becomes 4x8@7; 4x10@6.5 becomes 3x10@6.5.
- Pipeline: two changed prescription rows, three fewer sets in total. The
  other changes concern lower family budgets, stress levels and review output.
- Longitudinal autopilot: two changed prescription rows in the binding-stress
  case, three fewer sets in total. Example: 3x10@9 becomes 2x10@9; total bench
  stress falls from 46.3 to 27.8. Other cases retain dose and report lower budgets.
- Captured session counts, reps, target effort, movement inclusion and order
  do not change. No prescription dose increases.

Capture reproduction: build each engine version, then run each gate's child
verifier with `D02_CAPTURE=<before-or-after-file.jsonl>` and
`node --require ./packages/inference/test/capture_d02.cjs <verifier.mjs>`.
File naming and the complete child-verifier list are in `compare_d02.mjs`.
Compare with `node packages/inference/test/compare_d02.mjs <capture-dir>
<output.json.gz>`. Baseline captures were taken before the production edit;
final captures were taken after it. No existing assertion was relaxed.

## Validation

Focused `verify:blocks`, `verify:pipeline`, and `verify:autopilot`: passed.
Standalone typecheck and `git diff --check`: passed. Five mutation checks: passed.
Full `npm run verify:ci` passed after the legacy-composer change: exit 0,
29/29 component suites and 482/482 component tests. Final commit/tree/push
identity is reported in the task handover, avoiding self-referential commit IDs.

The worktree was prepared with `npm ci` from the unchanged lockfile and
`npm run fetch:embedder`; the fetcher verified all committed asset hashes.
All generated test artifacts and dependency installations remain ignored.

MERGE / RELEASE / C6: NOT PERFORMED
