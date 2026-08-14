# Handover — 2026-08-14 Longitudinal Deterministic Verification (rev. 2)

Owner: Francis Pike
Phase: test-only longitudinal verification (HERMES_WORK_ORDER_LONGITUDINAL_VERIFICATION.md, 2026-08-14)
Implementer: Hermes (sole implementation agent)

## 1. Frozen parent and checkpoints

- Frozen parent: `a38ab102b9b01cebdc91c20214fed1560207cd39` (`fix(routines): preserve authored projected RPE ceiling`).
- Checkpoint 1 (initial): `12da513b2c7815d6941b172651e3eb00f8afc2ea`
  `test(inference): add longitudinal bounds verification`.
- Checkpoint 2 (audit remediation): the commit containing this handover (see report / `git rev-parse HEAD`). A commit cannot embed its own hash; the audit range is `12da513b…..<checkpoint2>`.
- Worktree/branch: `.worktrees/hermes-longitudinal-verification` / `codex/hermes-longitudinal-verification`. No push, no release.

## 2. Exact files changed

| File | Change (checkpoint 1 → checkpoint 2) |
|---|---|
| `packages/inference/test/verify_longitudinal_bounds.mjs` | NEW → hardened by audit (§5). |
| `package.json` | `verify:autopilot` appends `&& node packages/inference/test/verify_longitudinal_bounds.mjs`. No new top-level `verify:*` gate. (Unchanged in rev. 2.) |
| `tools/autopilot-sim/HANDOVER_2026-08-14_LONGITUDINAL_BOUNDS.md` | NEW → this rev. 2 handover (supersedes rev. 1). |

No other file changed. Production inference, policy, coefficients, budgets,
thresholds, tier/role/access behavior, ACWR behavior, migrations, UI, native
code and dependencies are untouched (§7).

## 3. Coverage map (existing vs new)

| Property | Existing coverage | New longitudinal/metamorphic coverage |
|---|---|---|
| Nondeterminism / input mutation | `verify_blocks` [1]; `verify_autopilot` [1]; `verify_pipeline` | Every scenario double-run from freshly deep-cloned, deeply frozen inputs (Set/Map mutators stubbed), deep-equality via `isDeepStrictEqual`, mutation throws. |
| Unbounded growth / trace size | `verify_blocks` [2]/[7]; 32-week closed-loop sim (`tools/autopilot-sim/closedLoop.ts`, `runSweep.ts`) | Exact cardinalities: A 4 segs×4 wks; B 5 variants×4 wks; C/D 48 sessions. Every repeated week byte-identical. |
| Non-finite / out-of-domain dose | `verify_blocks` [2]; `verify_pipeline` | `doseViolations`/`planSlotDomainViolation` over all 68 simulated weeks. |
| Dose expansion across repeated family exposure | `verify_pipeline` Elite bench (single microcycle) | A 16-wk trace (s4==s1 byte-equal), 5 distinct purposes, dose never exceeds authored, finalStress ≤ budget & ≤ initial. |
| Support before major under binding bounds | `verify_pipeline` rising stress + moderate accessory-first | A-seg3 support omitted with provenance text before any major cut; B-tighten duration yields support first; detector X3. |
| Major preservation / no silent substitution | `verify_pipeline` freeze/role/availability; `verify_blocks` substitution | A-seg1 five majors preserved 1:1; B availability-loss whole-result fail-closed with named blocker, zero prescriptions; detector X6. |
| Sport-tier relief not leaking to weight-room days | `verify_blocks` [16b] single block | C composed 4-block trace: Advanced probe on sport days, zero weight-room days; per-day context from focus; shared detector X4. |
| Dates across month/year/DST-adjacent boundaries | `verify_blocks` [2] single-block date formula | C: 4 blocks advanced by `addDaysIso(prev,28)` over 2025-10-04 (Sydney DST-start), Nov/Dec month, 2026-01-01 year boundary; 48 dates unique+ordered; explicit arithmetic pins incl. DST-end; detector X5. |
| Stale state vs missing-input seam | Store gate `verify_store_sql.mjs` ("missing readiness vector clears the stale prescription") | D: `recentAcwr:null` never shifts even after a hot neighbour; omitted ≡ null; hot block effect scoped (pinned phases); per-block isolation byte-equal. Cited, not re-invented. |
| Existing ACWR behavior | `verify_blocks` [10] | D re-pins the ratified shape per block; no policy/terminology change. |

## 4. Scenarios, weeks, invariants

- 4 families + 7 counterexample checks + 4 fixture-completeness self-tests = 78 checks (rev. 2).
- Simulated weeks: A 16 (4 segs × 4 wks), B 20 (5 variants × 4 wks, genuinely repeated), C 16 (4 blocks × 4 wks), D 16 (4 peak blocks × 4 wks) = 68 weeks.
- Counterexample checks X1–X7 now invoke the SAME named predicates the family checks use against the real outputs, proving each invariant can fail for its intended reason on a local mutation (H5 satisfied). Fixture completeness fails with the exact missing field name.
- Trace/memory discipline: in-memory deterministic summary only (scenario/segment/week counts, purposes, finalStress); no timestamps/paths/machine names; `process.memoryUsage()` informational only; no files left behind.

## 5. Audit remediation (from review of 12da513)

All high/medium findings fixed in rev. 2, gates re-run green:

- **H1** X6 no longer a tautology — it uses the shared `failClosedViolation` predicate on the real `lostResult`, proving it is clean, then injects a prescription and proves it fires.
- **H2** X3/X4/X5 now use the same `supportFullyOmittedViolations` / `leakViolations` / `dateOrderViolations` predicates as the families (no hand-shaped duplicate), asserting clean-before and firing-after local mutation.
- **H3** X2 asserts the clamped plan is violation-free at cap 7.5 first, then mutates a row to 8.5 and pins the `outside 5..` reason — the mutation is now required.
- **H4** Family B now carries a real 4-week repetition per variant (5 variants × 4 weeks = 20 weeks); the 68-week total is genuine, not overstated.
- **H5** The X-series meta-claim is now true (each detector demonstrably fails locally).
- **M1** `deepFreeze` stubs `Set`/`Map` `.add/.delete/.clear/.set` mutators and recurses content — availability/role-eligibility Sets genuinely protected (empirically re-checked: mutated Set mutation now throws).
- **M2** The [C] probe check partitions by `accessContextForBlockFocus`, not by `focus === 'conditioning'`.
- **M3** `deepFreeze(cloneInput(x))` (freezeFresh) — module defaults (e.g. `DEFAULT_PROFILE.injury_flags`) are cloned before freezing; empirically confirmed no longer frozen process-wide.
- **M4** Removed the outer `check` wrappers that swallowed `runTwice`'s own failures.
- **M5** The [C] composed-trace determinism run freezes the whole closure and composes all four blocks (mirrors D).
- **L1** `runTwice` reports the real thrown error and classifies "mutation" only for a freeze-guard throw.
- **L2** Every input is freshly deep-cloned per run via `freezeFresh`.
- **L3** `eq` is now `isDeepStrictEqual` (distinguishes undefined-key vs absent; exact NaN/Infinity).
- **L4** Replaced the duplicated [C] capability check with an Advanced-profile variant that opens the tier ceiling in both contexts to isolate capability/equipment exclusions from tier.
- **L5** `composeReal` no longer carries an unused `data` parameter.
- **L6** [B-ADD-SUPPORT] asserts the added accessory changed the output and is still analysed; [B-TIGHTEN-DURATION] asserts included work strictly drops — neither law passes as a no-op.

## 6. Gate results (rev. 2, in work-order order)

| Gate | Result |
|---|---|
| `typecheck` | 0 |
| `verify:autopilot` | 0 (78 new longitudinal checks) |
| `verify:autopilot-counterexamples` | 0 |
| `verify:pipeline` | 0 (51 checks) |
| `verify:blocks` | 0 |
| `verify:store` | 0 |
| `verify:components` | 0 |
| `verify:all` | 0 (179 component tests; embedder pins re-verified) |
| `git diff --check` | 0 |
| `git status --short` after commit | clean |

`verify:all` runs with the pinned embedder asset materialized via
`npm.cmd run fetch:embedder` (revision cache byte-verified: ONNX
`afdb6f1a…`, tokenizer `da0e7993…`, min `ed2e443c…`); assets remain ignored.

## 7. Scope confirmation

No production edits under `apps/mobile/src/` or `packages/inference/src/`; no
migration/schema/migration-runner edits; no dependencies, package-version or
lockfile changes; no native/Android/Gradle/ONNX/release changes. The only
mutable surface is the `verify:autopilot` script line.

## 8. `git status --short` after commit

Clean — the commit contains exactly the verifier + handover; ignored
`.build`, ONNX assets and `node_modules` cannot leak in.

## 9. Honest limitations

- Software-property proof over adversarial 16-week scenarios only; no
  physiological-safety proof, no injury prediction, no training-science claim.
- Host `process.memoryUsage()` is informational, NOT Android 450 MB
  private-dirty evidence; device/visual acceptance remains out of scope here.

## 10. Auditor instruction

Fresh Claude Code / Opus 5 / maximum context / read-only: audit the frozen
range `12da513b2c7815d6941b172651e3eb00f8afc2ea..<checkpoint2>` (and, for
context, `a38ab102..12da513`), reproduce all §6 gates from a clean worktree
at the frozen parent (run `npm.cmd run fetch:embedder` first if the model
asset is absent), confirm only the listed files changed, that the verifier
loads production exports from `.build` and copies no formula, that the
counterexample layer fails locally (and passes on real output), and that no
assertion weakens an existing check. Do not push or release.
