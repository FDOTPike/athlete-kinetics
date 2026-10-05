# Athlete Kinetics bounded-microcycle checkpoint handover

> Historical checkpoint record for `f41712de0364498c721c3c7fa1235763759213a2`.
> The P1/P2 audit findings against that checkpoint are corrected in
> `HANDOVER_2026-08-13_BOUNDED_MICROCYCLE_AUDIT_REMEDIATION.md`; use that
> handover and its two independent audit prompts for current `HEAD`.

> **Documentation correction (2026-08-13).** The "Judgment calls and known
> limitations" section below lists only "missing movement or major-family
> contract and an invalid complete-week safe minimum" as global freeze
> blockers. That enumeration is incomplete: an out-of-range stored
> sets/reps/target-RPE value on any analysed day and an irreducible per-day
> session stress budget also block a freeze globally, because the weekly
> analysis must remain valid for every day. The authoritative, complete
> enumeration now lives in `docs/decisions/ROUTINE_BOUNDED_MICROCYCLE_POLICY.md`
> (see "Selection and dose"). This historical record is superseded on that
> point.

Date: 2026-08-13
Baseline: `6cfb990a33eabfa36f885e3239dac62e1d414c8f`
Audit range after the checkpoint commit: `6cfb990a33eabfa36f885e3239dac62e1d414c8f..HEAD`
Status: superseded by the post-Opus remediation handover

## What shipped

- Routine selection is uncapped by movement count or weekly frequency inside a
  seven-day microcycle. Every populated day still needs at least one major.
- `composeRoutineMicrocycle` evaluates the whole authored microcycle, preserves
  every selected major/variation at a safe minimum, sheds accessory then other
  related support first, and bounds sets, reps, RPE, stress purpose, order, and
  duration. Current `HEAD` additionally guarantees that final sets, reps, and
  RPE never exceed the authored/defaulted dose and captures initial stress
  before any non-increasing purpose or RPE adaptation. Beginner standalone
  policy and live access gates remain fail closed.
- Same-day same-family majors are one family exposure across executable
  variations. Board Press `2x6` at `0.90` plus Competition Bench `3x7` at
  `1.00` produces `31.8` bench-family equivalent reps. The same contract is
  tested across squat, deadlift, bench press, overhead press, horizontal pull,
  vertical pull, and power clean.
- Five Elite bench-family days are accepted and distributed over heavy,
  volume, technique, speed, and low-fatigue purposes without a count blocker.
- Migration 052 adds 79 curated family mappings and 54 explicit assistance
  relationships, separate from the capability graph. Runtime roles use the
  closest relationship: Hammer Curl is supplementary after pulls and accessory
  after squat/bench/deadlift/overhead/power-clean work, including mixed-family
  sessions. Current role counts are major 79, supplementary 84, accessory 14,
  conditional 12; future movements fail closed until curated. Migration 053 at
  current `HEAD` adds exact athlete-local compatibility only for persisted
  pre-contract supplementary slots without broadening those role counts.
- Accessories are offered last and ranked by uncovered muscles, objective,
  live availability/restrictions, duplication, composed time headroom, and
  remaining family-stress headroom. Zero recommendations is valid; selection
  itself remains uncapped.
- Authored template dose remains stored unchanged. Freeze persists the bounded
  selected-day prescription plus athlete-local family/session decisions,
  warnings, recommendations, and adaptations. New frozen plans survive source
  template deletion and fail closed on invalid review/role provenance.
- Readiness may reduce a frozen bounded routine but cannot add sets above it.
  Existing major RPE start/max projection and top-three supplementary ranking
  remain covered by regression tests.
- Builder and Block views expose microcycle days, family/session initial-to-final
  stress, coefficients, purposes, omissions, dose changes, warnings, and coach
  recommendations.

The product contract is documented in
`docs/decisions/ROUTINE_BOUNDED_MICROCYCLE_POLICY.md`.

## Historical verification evidence at f41712d

The results in this section predate the remediation. Current results are
recorded only in the correction handover.

- `npm ci`: PASS from the frozen baseline.
- `npm run verify:all`: PASS, exit 0, 134.9 s on the final source. All 20
  repository gates plus strict typecheck passed. Notable included results:
  pipeline 47 checks; component tests 11 suites / 172 tests / 0 snapshots;
  migration fresh/upgrade/replay/poison checks green; memory audit green with
  its existing 450.1 MiB peak estimate.
- Deterministic seed smoke:
  - `--end=2026-06-10`: PASS, state-vector hash prefix `00c127d4e25acb68`,
    131 sessions / 1151 sets.
  - current date `2026-08-13`: PASS, hash prefix `6b973c6720ef3fc4`,
    131 sessions / 1143 sets.
- Metro production Android bundle: PASS, 2,905,244 bytes,
  SHA-256 `C62851ADA27869DE1A77055EB8044E666EE1B0D6B0FF83DDEA39A951BD7C3623`.
- `npm run fetch:embedder`: PASS from cache. Model SHA-256
  `AFDB6F1A0E45B715D0BB9B11772F032C399BABD23BFC31FED1C170AFC848BDB1`;
  full tokenizer SHA-256
  `DA0E79933B9ED51798A3AE27893D3C5FA4A201126CEF75586296DF9B4D2C62A0`.
- Android debug QA build:
  `:app:verifyOnnxRuntimePackagingContract :app:assembleDebug :app:bundleDebug
  --no-daemon`: PASS. Initial clean build 6m35s; final incremental contract run
  1m09s. No release task or release signing credential was used.
  - APK: 244,935,262 bytes, SHA-256
    `D381EA378AA60838227109F7A9F143CC2C8E154BD018D741C82BC335DEE025C4`.
  - AAB: 99,247,364 bytes, SHA-256
    `65DB8902F4466F262D8C0FAE1F8DB10F0D24A99DE589005576506A4BD1F73ACA`.
  - Direct ZIP inspection found the exact model hash and paired
    `libonnxruntime.so` / `libonnxruntimejsi.so` for arm64-v8a, armeabi-v7a,
    x86, and x86_64 in both artifacts.
- Connected Pixel 9 Pro: `adb install -r -t` PASS; MainActivity launch PASS in
  357 ms; process alive and foreground; no fatal exception,
  `UnsatisfiedLinkError`, or ONNX startup error in the post-launch log sample.
- `git diff --check`: PASS. Generated model, bundle, databases, APK, and AAB
  remain ignored/untracked and are not checkpoint content.

Expected non-failing noise: existing React Native Jest `act(...)` warnings and
resolver messages; Android dependency deprecation/manifest/CMake path warnings.

## Judgment calls and known limitations

- Stress coefficients, purpose multipliers, and Intermediate/Advanced/Elite
  budgets are deterministic first-pass product policy, not a clinically or
  longitudinally validated dose model. They need coach/field calibration.
- The curated contract currently covers seven families and 79 movements. An
  uncurated future movement intentionally receives no major/support role.
- Same-day variations may carry different component purposes (for example,
  heavy Board Press plus volume Competition Bench) while the session remains
  one aggregated family exposure.
- Freeze enforces live availability/contextual-role gates and irreducible
  duration only on the selected day while retaining every template day for
  weekly stress. Other-day duration overflow is a warning; missing movement or
  major-family contract and an invalid complete-week safe minimum remain global
  blockers because weekly analysis would otherwise be impossible.
- Pre-052 frozen routines have no stress sidecars and retain the historical
  source-template role fallback. Current migration 053 snapshots only exact
  recoverable compatibility; a plan whose source template was already deleted
  before that migration remains unrecoverable.
- The device result is a native install/launch smoke, not the full manual
  acceptance matrix or a measured on-device memory profile. Debug variants use
  Metro for JavaScript; the separately built production bundle proves current
  JS bundling but was not installed as a release candidate.
- The embedder fetch script still reports upstream model/tokenizer hashes as
  unpinned. This is an existing pre-release supply-chain blocker.
- No release artifact, release signing, upload, push, publication, or release
  authorization was performed.

## Superseded audit prompt

Do not use the historical prompt below for the remediation audit. Use the two
independent prompts in
`HANDOVER_2026-08-13_BOUNDED_MICROCYCLE_AUDIT_REMEDIATION.md`.

```text
Act as Claude Code Opus 5 Maximum performing the single read-only checkpoint
audit for Athlete Kinetics. Do not edit files, create commits, push, sign,
upload, publish, or authorize a release.

Repository: C:\Users\fpike\.codex\worktrees\42a4\Athlete App
Audit range: 6cfb990a33eabfa36f885e3239dac62e1d414c8f..HEAD

First read AGENT_WORKFLOW.md,
HANDOVER_2026-08-13_BOUNDED_MICROCYCLE.md, and
docs/decisions/ROUTINE_BOUNDED_MICROCYCLE_POLICY.md. Treat the owner's product
rules in the handover as fixed; audit whether the implementation actually
satisfies them. You may run read-only diagnostics/gates, but make no writes.

Prioritize P1/P2 defects only and cite exact file:line evidence. Specifically
audit:
1. No hidden movement-count/frequency blocker; same-day same-family variations
   count as one exposure and use sum(coefficient * sets * reps) across all seven
   curated families. Check the Elite five-day bench case and safe locked-dose
   preservation.
2. Complete-microcycle/session stress math, deterministic purpose assignment,
   termination/minimum-prescription behavior, support-first reduction, duration
   handling, and the rule that readiness cannot re-expand frozen dose.
3. Genuine fail-closed equipment, safety/niggle, tier/capability/attestation,
   contextual-role, Beginner, missing-contract, and corrupted-snapshot paths.
4. Migration 052 fresh install, 051 upgrade, replay/self-heal/poison behavior,
   exact template data preservation, athlete isolation, JSON/role constraints,
   and removal of the old blanket supplementary trigger.
5. Contextual multi-role behavior, especially Hammer Curl with pull, non-pull,
   and mixed-family sessions; accessory ranking/zero-result behavior; no reuse
   of the capability graph as the assistance graph.
6. Store/UI end-to-end persistence and review surfaces, template deletion,
   selected-day execution gating versus whole-week stress, top-three
   supplementary and projected major RPE regressions.
7. Android/ONNX, migration, component, routine-access, and existing behavior
   regressions. Distinguish the documented calibration/manual-device limits
   from implementation defects.

Return: (a) findings ordered P1 then P2 with file:line, impact, reproduction,
and smallest defensible correction; (b) any claim in the handover contradicted
by evidence; (c) residual risks. If there are no P1/P2 defects, say so plainly.
Do not include style-only suggestions and do not modify the repository.
```

## MASTER LEDGER ENTRY

- Input state: frozen green checkpoint
  `6cfb990a33eabfa36f885e3239dac62e1d414c8f`.
- Constraints enforced: offline/deterministic runtime; strict TS and STRICT
  SQLite; append-only migration 052; athlete-local persistence; uncapped
  selection/bounded dose; no release actions.
- Actions: added curated family/assistance policy, pure microcycle analyzer,
  accessory role/ranker, store freeze/start integrity, review UI, migration and
  adversarial coverage; ran all repository/seed/Metro/Android/ONNX/device gates.
- Constraint deltas: +4 schema sentinels; role surface major 79 / supplementary
  84 / accessory 14 / conditional 12; no network runtime, telemetry, RNG, or
  cloud dependency added. Analyzer cost grows with authored selections and was
  not benchmarked for pathological thousands-of-slot templates.
- Output state: this handover is included in the single local checkpoint;
  audit range `6cfb990a33eabfa36f885e3239dac62e1d414c8f..HEAD`; no push or release action.
