# Accessible Coach Execution Plan — 2026-09-12

## 1. Authority and outcome

- Consolidated source: `docs/WORK_ORDERS_2026-09-12_ACCESSIBLE_COACH.md`.
- Owner direction: execute bounded work toward a tested build today; preserve the offline deterministic architecture; report tested, untested, and deferred work honestly.
- Integration branch: `codex/accessible-coach-2026-09-12`.
- Integration base: `e8cedca5defb688e1728e7bb917970921481e3f1` (`origin/codex/rpe-familiarisation`).
- Recovered follow-up: detached commit `ffae074fafa7981db43287a5e8c51348fdaedaca` was cherry-picked as `87624d9e43189ddd87db317e24d4379ef5a13fae` before dispatch.
- Baseline at the integration base: `typecheck` passed; `verify:ci` passed with 21 gates and 26 suites / 434 tests.

## 2. Non-negotiable constraints

- No cloud dependency, account requirement, network inference, or nondeterministic recommendation path.
- No medical inference from free text, exertion, heart rate, SpO2, or unverified clinician claims.
- Unknown evidence remains unknown; absence must not become a fabricated safe value.
- Database migrations are append-only. Migration `064` is reserved centrally for the shared activity/clinician contract and is unavailable to parallel tasks.
- The 512 MiB hard memory ceiling and preferred 450,000,000-byte operating target remain unchanged.
- Product behavior, policy, schema, documentation, and evidence must be described separately.
- Parallel executors must not edit `PROMPT_LEDGER.md`; the integration owner owns the single append-only ledger entry.

## 3. Refined ownership and dispatch

### 3.1 WO-01 — Keyboard accessibility

- Model/effort: `gpt-5.6-sol`, medium.
- Status: implemented and integrated from `89e140a`, with Android shell/scroll follow-ups in `fb265c8`, `80faa77`, and `7f4c8c0`. The final integration run covered a 4 GB Pixel 9 Pro Android emulator at 360 dp, font scale 1.30, portrait and landscape. iOS remains untested.
- Product ownership: `App.tsx`; the input-bearing screens identified by inventory; a shared keyboard-aware scroll primitive; matching component tests.
- Evidence ownership: `docs/audits/accessible-coach/WO01_INPUT_INVENTORY.md` and a WO-01 handover.
- Exclusions: store, schema, migrations, native configuration, package dependencies, recommendation engines, backup, activity, clinician, and animation work.
- Exit: every visible text field is reachable, remains visible while focused at supported font scale, submits/dismisses predictably, and has a non-vacuous regression test where practical.

### 3.2 WO-02 — Onboarding clarity

- Model/effort: `gpt-5.6-sol`, medium.
- Status/dependency: implemented after WO-01 and integrated in `55bc949`; the truthful non-clinical notes correction is `3aba520`. The goal, experience, equipment, notes, and review flow was exercised on the Android integration emulator. Existing Activities remains intentionally absent because WO-05 has no ratified capture contract.
- Product ownership: onboarding, profile, program setup, readiness/today copy and layout, existing `InfoTip` use, and matching tests.
- Required outcomes: athlete-facing `weight loss` wording; clearer experience/equipment selection; explicit program ceilings; RPE introduced as effort; review of RIR/RPE use; Ready summary grouped into the work order's exact applicable sections — GOAL, EXPERIENCE, YOUR WEEK, EQUIPMENT, EXISTING ACTIVITIES, and TRAINING SUPPORT — with edit paths.
- Exclusions: new training policy, prescription math, schema, activity contract, clinician inference, and animation work.

### 3.3 WO-03 — Local backup and restore foundation

- Model/effort: `gpt-5.6-sol`, high.
- Status: deterministic contract foundation completed, reviewed, and integrated as `8ec58e3`; product UI/native snapshot/restore/encryption work is not implemented.
- Ownership: pure backup inventory/codec modules, round-trip tests, optional contract verifier, backup design docket and handover.
- Exclusions: screens, store integration, OS picker, encryption claims, atomic live restore claims, migrations, and the reserved shared contract.
- Dependency: after Migration 064 lands, backup inventory and round-trip coverage must be re-run before backup is product-complete.

### 3.4 WO-04 — Evidence and policy audit

- Model/effort: `gpt-6-astra`, high.
- Status: completed, audited, and integrated as `cc39b15`; owner/clinical checkpoint remains open.
- Ownership: primary/official evidence register, source-to-rule matrix, persona audit, policy docket, and handover.
- Exclusions: product code, schema, migration, UI, native work, and silent policy ratification.
- Exit: every proposed policy is labelled current, proposed, uncertain, or owner/clinical decision required.

### 3.5 WO-05 and WO-06 — Shared activity and clinician contract

- Model/effort: WO-05 `gpt-5.6-sol` high; WO-06 `gpt-6-astra` xhigh for integration review.
- Dependency: WO-04 evidence plus explicit owner/clinical checkpoint disposition of the docket in `docs/decisions/ACCESSIBLE_COACH_SHARED_CONTRACT_DOCKET.md`.
- Schema ownership: one integration task only; Migration 064; shared types, repositories, deterministic weekly planner inputs, and tests.
- Rule: activities and clinician constraints must enter planning through one normalized contract rather than parallel special cases.
- Exclusions until ratified: clinical units/thresholds, automated interpretation of free text, remote sync, calendars, and probabilistic load inference.
- Current status: the WO-06 source/entry-point review is integrated as design-only `d97a60f`. The concrete recommended dispositions are assembled in `docs/decisions/ACCESSIBLE_COACH_CHECKPOINT_2026-09-12.md`. Migration 064 and recommendation changes remain held at the Francis/qualified-clinical checkpoint.

### 3.6 WO-07 — Live heart-rate assessment

- Model/effort: `gpt-5.6-sol`, high.
- Dependency: shared contract ratified and integrated; biometric evidence boundaries preserved.
- Scope: assess current capture, retention, visibility, and offline lifecycle against actual code/device behavior.
- No diagnostic or medical claim; SpO2 remains excluded unless separately ratified.

### 3.7 WO-08 — Activity and movement coverage

- Model/effort: `gpt-5.6-sol`, high.
- Status: current-state inventory and first-batch curation design completed, audited, and integrated as `2af3adc`; no product taxonomy/schema change shipped.
- Dependency: the proposed 15-kind log-only activity batch remains pending shared-contract ratification.
- Scope: expand deterministic local coverage and mappings without inventing exercise equivalence or clinical safety rules.

### 3.8 WO-09 — Offline movement animations

- Model/effort: only after required work is complete and capacity remains.
- Status: deferred by dispatch rule.
- Constraint: local assets only, bounded package/memory impact, reduced-motion support, no network fetch.

### 3.9 WO-10 — Integration, test, and release evidence

- Model/effort: `gpt-6-astra`, xhigh.
- Dependency: all accepted implementation work integrated.
- Status: integration verification executed. Exact final values live in `HANDOVER_2026-09-12_ACCESSIBLE_COACH_INTEGRATION.md` and the user handback; a tracked document cannot contain the SHA-256 of an APK built from the same document commit without invalidating provenance.
- Required checks: diff hygiene, typecheck, focused tests, full `verify:ci`, QA APK build, `verify:qa-candidate`, provenance hash, and emulator/device evidence appropriate to the changed surfaces.
- Release authority: not implied by a green build. C6 and owner release/push decisions remain separate.

## 4. Integration sequence

1. Review and integrate WO-01.
2. Dispatch, review, and integrate WO-02 from the updated integration tip.
3. Review WO-03 as a foundation only; integrate only claims demonstrated by executable round-trip tests.
4. Review WO-04 and present its policy conflicts with the shared-contract docket at the existing owner/clinical checkpoint.
5. After ratification, implement Migration 064 and the shared contract once, then route weekly planning through it.
6. Re-run backup coverage against the final schema.
7. Execute WO-07 and WO-08 only after the shared contract is stable.
8. Run WO-10; spend remaining capacity on WO-09 only if no required item remains.

## 5. Initial risk register

- Current experience level appears to change training volume directly; the evidence task is checking whether this should remain a prescription rule or become a presentation/onboarding input only.
- Current beginner symptom thresholds may relax severity handling; this requires owner/clinical review and must not be changed as copy-only work.
- The repository has no demonstrated product-complete backup/restore path; a pure codec is not equivalent to safe live restore.
- External activities and clinician constraints do not yet share a normalized persistence/planning contract.
- React and the React Native embedded renderer were found mismatched during the first emulator run. They are now pinned to the same exact `19.1.4` version and preflight fails closed on future drift.
- A first Android landscape run exposed Gboard extract mode. Every one of the 21 product `TextInput` call sites now opts out, with a mutation-proven inventory gate.

## 6. Completion-report contract

The final handback must list each work order under exactly one status:

- `IMPLEMENTED_AND_TESTED`
- `IMPLEMENTED_NOT_DEVICE_TESTED`
- `DESIGN_OR_RESEARCH_ONLY`
- `DEFERRED_PENDING_OWNER_OR_CLINICAL_DECISION`
- `DEFERRED_CAPACITY`

It must separately state commit, push, merge, release, C6, APK provenance, device/emulator coverage, and any retained unknowns.
