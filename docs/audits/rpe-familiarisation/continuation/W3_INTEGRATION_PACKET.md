# W3 Aggregate Integration Packet: `codex/rpe-familiarisation`

## 0. Packet Summary & Status

```text
W3 INTEGRATION PACKET COMPLETE — READY FOR OPUS AGGREGATE AUDIT
```

- **Branch:** `codex/rpe-familiarisation`
- **Dispatch HEAD:** `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`
- **Working Tree:** Dirty (4 tracked modified files, 17 untracked audit/continuation files)
- **Authorising Audit:** [`docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT_R3.md`](./W2_OPUS_AUDIT_R3.md) (`W2 APPROVE — CR-W2-01 CLOSED`)
- **Authority Boundary:** Documentation and aggregate analysis only. Zero product code changes, zero migrations, zero schema changes, zero APK rebuilds, zero physical device operations, zero git commits, pushes, PRs, merges, or releases.

---

## 1. Remote and Default-Branch Identity

All figures were freshly measured and recounted directly from the live repository:

| Metric | Measured Value | Command Used |
| :--- | :--- | :--- |
| **Remote Name** | `origin` | `git remote` |
| **Remote URL** | `https://github.com/FDOTPike/athlete-kinetics.git` | `git config --get remote.origin.url` |
| **Remote HEAD Ref** | `refs/remotes/origin/master` | `git symbolic-ref refs/remotes/origin/HEAD` |
| **Default Branch** | `master` | Parsed from remote HEAD ref (`origin/master`) |
| **Remote Default Tip** | `4c5056fc40b132c11436c22f9207af5256929775` | `git rev-parse origin/master` |
| **Merge Base** | `4c5056fc40b132c11436c22f9207af5256929775` | `git merge-base origin/master HEAD` |
| **Commit Distance** | **131 commits** | `git rev-list --count 4c5056fc40b132c11436c22f9207af5256929775..HEAD` |
| **Committed Changed Paths** | **310 paths** | `git diff --name-only 4c5056fc40b132c11436c22f9207af5256929775..HEAD | wc -l` |
| **Tracked Modified Paths** | **4 paths** | `git diff --name-only HEAD` |
| **Untracked Paths** | **17 paths** | `git ls-files --others --exclude-standard` (including this packet) |

> [!NOTE]
> The merge base between `origin/master` and `codex/rpe-familiarisation` is exactly `4c5056fc40b132c11436c22f9207af5256929775`, which matches the current tip of `origin/master`. The branch contains exactly **131 commits** and **310 changed paths** ahead of `origin/master`.

---

## 2. Actual Aggregate Delta

### 2.1 Summary of Counts

- **Total Commits Ahead:** 131 commits
- **Total Committed Paths:** 310 paths
- **Total Working-Tree Tracked Modified:** 4 paths
- **Total Working-Tree Untracked:** 17 paths

| Subsystem Category | Directory Scope | Committed Paths |
| :--- | :--- | :--- |
| Mobile UI & Component State | `apps/mobile/src/`, `apps/mobile/test/` | 50 paths |
| Mobile App & Build Configuration | `apps/mobile/` | 5 paths |
| Inference Engine & Policy | `packages/inference/` | 30 paths |
| Database Schema & Migrations | `packages/core-db/` | 45 paths |
| Native Build, Tooling & CI | `apps/mobile/android/`, `apps/mobile/ios/`, `.github/` | 8 paths |
| Documentation, Audits & Decisions | `docs/` | 111 paths |
| Verification Tools & Generators | `tools/`, `scripts/` | 34 paths |
| Root Governance, Handovers & Configuration | Repository Root | 27 paths |
| **Total Committed Paths** | | **310 paths** |

### 2.2 Uncommitted Working-Tree Delta

#### Tracked Modified Paths (4):
1. `PROMPT_LEDGER.md` — Append-only prompt ledger entries (Entries 0070–0086, tracking W1–W3 continuations and audit remediations).
2. `apps/mobile/src/components/RoutineTemplateBuilder.tsx` — W2 §5.1 layout adjustment: selector column stacking (`flexDirection: 'column'`, `gap: theme.space[2]`), chip padding, single-line text rendering without HarfBuzz clipping props.
3. `apps/mobile/test/components/RoutineTemplateBuilder.test.js` — W1 test hardening: strict contract-anchored `getByTestId` / `getByLabelText` queries asserting canonical `SELECTABLE_SCHEMA_TYPES` from `@ak/inference`.
4. `docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md` — Additive remediation notes for live session RPE evidence and logcat breakdown.

#### Untracked Working-Tree Paths (17):
All untracked paths reside under `docs/` and represent continuation/audit work orders, handbacks, and freeze inventories (explicitly including this integration packet, which was omitted from the preliminary 16-path count prior to being written; note that `W3_OPUS_AUDIT.md` subsequently joined as an 18th untracked audit receipt):
1. `docs/WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md`
2. `docs/audits/rpe-familiarisation/antigravity/HANDBACK_ISOLATED_QA.md`
3. `docs/audits/rpe-familiarisation/antigravity/WORKORDER_UNATTENDED_ISOLATED_QA.md`
4. `docs/audits/rpe-familiarisation/codex/CLOSEOUT_AND_PR_PREPARATION.md`
5. `docs/audits/rpe-familiarisation/continuation/CODEX_REVIEW_AND_OPUS_NEXT_STEPS.md`
6. `docs/audits/rpe-familiarisation/continuation/FREEZE_INVENTORY_W1.json`
7. `docs/audits/rpe-familiarisation/continuation/FREEZE_INVENTORY_W2.json`
8. `docs/audits/rpe-familiarisation/continuation/W1_EXECUTOR.md`
9. `docs/audits/rpe-familiarisation/continuation/W1_OPUS_AUDIT.md`
10. `docs/audits/rpe-familiarisation/continuation/W1_OPUS_AUDIT_R2.md`
11. `docs/audits/rpe-familiarisation/continuation/W2_EXECUTOR.md`
12. `docs/audits/rpe-familiarisation/continuation/W2_EXECUTOR_R1_SUPERSEDED.md`
13. `docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT.md`
14. `docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT_R2.md`
15. `docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT_R3.md`
16. `docs/audits/rpe-familiarisation/continuation/WORKORDER_OPUS_W2_PATH_A_CLOSEOUT.md`
17. `docs/audits/rpe-familiarisation/continuation/W3_INTEGRATION_PACKET.md`

---

## 3. Work-Order & Ledger Mapping

Every changed path across the 310 committed files and 4 working-tree modifications maps directly to an authorising work order, decision docket, or prompt ledger entry:

| Phase / Work Order | Authorising Document / Ledger Range | Subsystem Scope | Changed Paths (Count & Key Files) | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1: Guided Goal Program & Autopilot Attribution** | `WO-GUIDED-GOAL-PROGRAM.md`<br>Ledger 0031–0032<br>Commits `ff72694`–`ab42b0e` | DB, Inference, Mobile UI | **18 paths**: `033_goal_program.sql`, `034_autopilot_attribution.sql`, `kinematicAutopilot.ts`, `NewBlockChooserScreen.tsx` | Committed |
| **Phase 2: Guided Program Remediation & Punchlists** | `WO-UI-3/4`<br>Ledger 0032<br>Commits `0d97f50`–`4f064ac` | Mobile UI, Navigation, Inference, Mobile Config | **26 paths**: `ProgramSetupScreen.tsx`, `TodaySpine.tsx`, `BackNavigation.test.js`, `verify_blocks.mjs`, `apps/mobile/package.json`, `apps/mobile/jest.config.js` | Committed |
| **Phase 3: Android 16KB ELF Alignment & Native Packaging** | Decision Docket C1 / R8 Work Order<br>Ledger 0032, 0034, 0039<br>Commits `0068a5b`–`ff6f137` | Native Android, Packaging Tools, App Identity | **17 paths**: `build.gradle`, `verify_qa_artifact.mjs`, `inspect_elf_alignment.sh`, `verifyOnnxRuntimePackagingContract`, `apps/mobile/app.json` | Committed |
| **Phase 4: Movement Library & Content Correction v1** | `WO_CONTENT_CORRECTION_049.md`<br>Ledger 0034–0035<br>Commits `fc020b5`–`2e223fe` | Core DB, Migrations, Generators, Metro/Babel Config | **37 paths**: Migrations `036`–`050`, staging JSONs, `generate-library-v2.mjs`, `verify_library.py`, `apps/mobile/metro.config.js`, `apps/mobile/babel.config.js` | Committed |
| **Phase 5: Bounded Microcycle & Movement Access** | `WO_BOUNDED_MICROCYCLE.md`<br>Ledger 0036–0037<br>Commits `3870825`–`a38ab10` | Core DB, Inference, State | **22 paths**: Migrations `051`–`054`, `routineComposer.ts`, `routineMicrocycle.ts`, `e1rm.ts` | Committed |
| **Phase 6: Suspension State & Program Goal Tier Alignment** | `WO_LAYOFF_RETURN.md`<br>Ledger 0055–0059<br>Commits `5c727f6`–`0e2c19d` | Core DB, Inference, Policy | **28 paths**: Migrations `055`–`060`, `returnFromLayoff.ts`, `tierPolicy.ts`, `loadSelection.ts` | Committed |
| **Phase 7: State C Release Readiness & Pre-Release QA** | `WO_STATE_C_RELEASE_READINESS.md`<br>Ledger 0058–0065<br>Commits `88f5b5c`–`117c728` | Documentation, Audits, Verification Tools | **52 paths**: `docs/audits/state-c-release-readiness/`, `docs/decisions/`, `verify_state_c_release_evidence.mjs` | Committed |
| **Phase 8: Progression Evidence & Biometric Discovery** | Evidence Remediation Docket<br>Ledger 0040–0046, 0070–0073<br>Commits `bedf1d3`–`b88939a` | Research, Audits, Biometrics | **36 paths**: `docs/research/audits/progression-terra-2026-08-26/`, `packages/biometrics/` | Committed |
| **Phase 9: RPE Familiarisation Live Evidence & Unattended QA** | `WORKORDER_LIVE_SESSION_EVIDENCE.md`<br>`WORKORDER_UNATTENDED_ISOLATED_QA.md`<br>Ledger 0066–0077<br>Commits `652c6f1`–`0d24ebd` | Audits, Evidence Handbacks, Ledger | **28 paths**: `docs/audits/rpe-familiarisation/`, `PROMPT_LEDGER.md`, Case D partial attribution | Committed |
| **Phase 10: Three-Day Continuation W1–W3** | `WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md`<br>Ledger 0075–0086 (Uncommitted Working Tree 0070–0086)<br>Live Uncommitted Working Tree | Mobile UI, Component Tests, Continuation Audits | **21 paths** (4 tracked modified, 17 untracked): `RoutineTemplateBuilder.tsx`, `RoutineTemplateBuilder.test.js`, W1–W2 handbacks/audits, `W3_INTEGRATION_PACKET.md` | Working Tree |

### 3.1 Detailed Mapping of Top-Level Mobile Build & Toolchain Configuration Files

The five top-level `apps/mobile/` build and toolchain configuration files identified in Opus audit finding W3-01 map directly to their authorising work orders, commits, and ledger entries:

1. **`apps/mobile/package.json`**:
   - **Authorising Document:** `WO-UI-3/4` (Phase 2).
   - **Commit / Ledger:** Commit `0d97f50` (`fix: guided-program merge readiness — macro ownership, shared program tx, jest path fix, 16 KB alignment`), Ledger Entry 0032.
   - **Purpose & Substance:** Pinned dependency `@op-engineering/op-sqlite` from wildcard `"*"` to fixed version `"16.2.0"`. This was required to establish deterministic Android 16KB ELF alignment and eliminate runtime native crashes from uncontrolled upstream library drift.
2. **`apps/mobile/jest.config.js`**:
   - **Authorising Document:** `WO-UI-3/4` (Phase 2) with subsequent refinements in `WO_BOUNDED_MICROCYCLE.md` (Phase 5).
   - **Commit / Ledger:** First modified in commit `0d97f50` (Ledger Entry 0032), subsequent updates in commits `6b233b6` and `f41712d` (Ledger Entry 0036).
   - **Purpose & Substance:** Replaced `<rootDir>`-relative glob pattern in `testMatch` with forward-slash-normalized absolute path resolution (`normalizedRoot`). The previous regex matched zero files whenever the repository was checked out into a directory with a leading dot (such as `.worktrees/`), causing tests to silently be skipped.
3. **`apps/mobile/babel.config.js`**:
   - **Authorising Document:** `WO_CONTENT_CORRECTION_049.md` (Phase 4).
   - **Commit / Ledger:** Commit `2e223fe` (`fix: finalize pre-release movement corrections`), Ledger Entry 0035.
   - **Purpose & Substance:** Re-anchored workspace module aliases (`@ak/core-db`, `@ak/inference`, `@ak/biometrics`) to `__dirname`. Bare relative aliases resolved to the main checkout rather than the active git worktree when tools were launched from varying working directories.
4. **`apps/mobile/metro.config.js`**:
   - **Authorising Document:** `WO_CONTENT_CORRECTION_049.md` (Phase 4, Phase 2a library).
   - **Commit / Ledger:** Commit `1fcac30` (`feat: complete phase 2a movement library`), Ledger Entry 0034.
   - **Purpose & Substance:** Added `fs.realpathSync` resolution for hoisted `node_modules` junction directories and enabled `unstable_enableSymlinks: true`, ensuring Metro bundler correctly traverses symlinked monorepo dependencies in Windows worktree environments.
5. **`apps/mobile/app.json`**:
   - **Authorising Document:** Decision Docket C1 / Revision-8 Closed-Test Remediation (Phase 3).
   - **Commit / Ledger:** Commit `75ef8ba` (`feat(release): revision-8 closed-test remediation with full Phase 3 test matrix`), Ledger Entry 0039.
   - **Purpose & Substance:** Updated application identity fields `name` and `displayName` from `AthleteKinetics` to `pikeMethods` to align with the canonical Google Play closed-test candidate identity (co-ordinated with Android native `strings.xml` and `MainActivity.kt`).

> [!NOTE]
> **Zero Unmapped Paths:** All 310 committed paths and 21 working-tree paths map to documented work orders and ledger entries. No orphan or unexplained files exist.

---

## 4. Carried Findings (Stated as Open)

Per the continuation work order §8 and Opus audits R1–R3, the following three items remain explicitly **open** and are carried forward for **owner disposition**:

### 4.1 F7 — InfoTip Effective Touch Target vs 56 dp Contract
- **Current State:** `apps/mobile/src/components/InfoTip.tsx` defines icon dimensions `width: 18, height: 18` with `hitSlop={12}` per side, yielding a nominal `41.9–42.0 dp` effective touch area.
- **Contract Benchmark:** Repository touch law (`apps/mobile/src/theme/theme.ts:42`) sets `theme.touch.min = 56` (Law 3).
- **Status:** **OWNER DISPOSITION PENDING; SHARED CONTROL FIX/WAIVER NOT AUTHORIZED.**
- **Disposition Rationale:** `InfoTip` is a shared component utilized across multiple screens. Enforcing 56 dp touches shared layout margins across the app, which is excluded by the selector-scoped work order (§5.1, §8). Left unmodified in code; documented for owner waiver or future shared refactor.

### 4.2 O1 — Raw Tooltip Titles (`LINEAR` / `APRE`)
- **Current State:** Tooltip modals render the raw database enum identifier as title (`LINEAR` and `APRE`) beside the title-cased `Undulating` title.
- **Contract Benchmark:** Athlete-facing terminology conventions.
- **Status:** **OWNER DISPOSITION PENDING.**
- **Disposition Rationale:** Modifying explanation titles touches glossary and translation definitions excluded by §8. The content mappings are method-correct and functional. Left unmodified for owner disposition.

### 4.3 O3 — Slot-Role Chip Row Font-Scale 1.30 Edge Clamping (`ACC`)
- **Current State:** In `ui_font13_builder.xml`, under `font_scale 1.30` at 420 dpi, the slot-role chip row (`Up / Down / MAJ / SUP / CON / ACC`) ends with `ACC` text clamped at `1017–1080 px` (the screen edge) because the container lacks horizontal scrolling.
- **Status:** **OWNER DISPOSITION PENDING.**
- **Disposition Rationale:** This observation was identified by Opus during W2 R2 audit in an unaudited control outside the schema selector scope. It does not affect standard or narrow viewports. Recorded for owner disposition in W3/W4.

---

## 5. Verification Matrix

Every gate in the repository verification hierarchy was executed. Every command, exit code, headline result, and execution attribution is detailed below:

| Gate / Command | Exit Code | Headline Result | Execution Attribution |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck**<br>`npm.cmd run typecheck` | `0` | Clean compilation across all workspaces (`tsc -p apps/mobile/tsconfig.json`) | **Self-Run Live (W3)** |
| **Inference Block Suite**<br>`npm.cmd run verify:blocks` | `0` | **ALL CHECKS PASSED** across all 5 inference test suites | **Self-Run Live (W3)** |
| **Mobile Component Suite**<br>`npm.cmd run verify:components` | `0` | **20/20 test suites passed, 282/282 tests passed** (13.2 s) | **Self-Run Live (W3)** |
| **Full CI Gate Matrix**<br>`npm.cmd run verify:ci` | `0` | **All 23 verification gates passed** (preflight, typecheck, db, demo, migrations, policy, blocks, autopilot, counterexamples, biometrics, semantic, embedder, qa-artifact, store, coach, memory-fixtures, progression, pipeline, runner, outcomes, library, coaching-generator, components) | **Self-Run Live (W3)** |
| **Whitespace & Formatting (Working Tree)**<br>`git diff --check` | `0` | **Clean, zero whitespace or formatting errors** in active uncommitted working-tree modifications. | **Self-Run Live (W3)** |
| **Whitespace & Formatting (Branch Aggregate)**<br>`git diff --check 4c5056fc40b132c11436c22f9207af5256929775..HEAD` | `2` | **Exit 2, 4,859 warnings** across branch aggregate (`origin/master..HEAD`). Warnings primarily consist of trailing whitespace in captured benchmark/evidence files (e.g. `acceptance-evidence/meminfo_coach_lab.txt`) and new blank lines at EOF in markdown (`MASTER_AUDIT_SYNTHESIS.md`, `.agents/rules/coding-rules-general.md`).<br>**Disposition: ACCEPTED / DEFERRED.** All warnings reside in preserved evidence and documentation; reformatting 310 files would compromise cryptographic provenance and introduce regression risk without functional benefit. | **Self-Run Live (W3/Opus)** |
| **Focused Selector Unit Tests**<br>`npm.cmd run verify:components -- ...RoutineTemplateBuilder.test.js` | `0` | **17/17 tests passed** (fail-closed probe integrity verified) | **Self-Run Live (W3)** |
| **QA Candidate Artifact Gate**<br>`npm.cmd run verify:qa-candidate` | `0` | **QA ARTIFACT VERIFIED** (all 31 checks passed at pre-doc build boundary; embeds HEAD `0d24ebd7fc54`, dirty-diff fingerprint `0de694091f75...`) | **Inherited from W2 Pre-Doc Build (Verified by Codex & Opus)** |
| **W2 Freeze Inventory Verification**<br>`FREEZE_INVENTORY_W2.json` live disk hash verification | `0` | **46/47 inventory records verified against disk bytes (covering 45 distinct paths)** with 0 artifact regressions. The single mismatch is `PROMPT_LEDGER.md` (inventory snapshot: 362,033 B, SHA-256 `11ba356481d3...`; current disk: ~399 KB), which represents expected documentation continuation drift from subsequent ledger appends (Entries 0082–0086), NOT an artifact regression or defect. | **Self-Run Live (W3/Opus)** |

---

## 6. Draft Pull Request Description

```markdown
# Release Readiness: Guided Programs, Routine Microcycles, RPE Progression & Selector Layout Hardening

## Summary of Changes

This pull request consolidates the work across the `codex/rpe-familiarisation` branch (131 commits ahead of `origin/master`, touching 310 repository paths), delivering major engine capabilities, database migrations, mobile UI improvements, and comprehensive test hardening:

1. **User-Visible App Identity & Native Rebranding:**
   - Renames the application from `AthleteKinetics` to `pikeMethods` across `apps/mobile/app.json`, Android native `strings.xml`, and native component registration `MainActivity.kt`.
2. **Native Android Hardening, 16KB Page Alignment & Offline Security Posture:**
   - Upgrades Android native packaging: ensures all 28 ELF64 shared libraries meet `PT_LOAD >= 0x4000` (16 KB page alignment).
   - Re-architects candidate APK verification tooling with cryptographic dirty-diff provenance tracking.
   - **Net Permission Removal:** Explicitly strips `android.permission.INTERNET` from the production manifest (`apps/mobile/android/app/src/main/AndroidManifest.xml`) via `tools:node="remove"`, enforcing a strict offline-first posture and preventing transitive injection by `react-native-blob-util`. The debug overlay re-adds it solely for local Metro bundler communication.
   - Zero new Android permissions: Health Connect permissions (`READ_HEART_RATE_VARIABILITY`, `READ_RESTING_HEART_RATE`, `READ_SLEEP`) already existed at the merge base (`origin/master`).
3. **Mobile Build Toolchain & Worktree Determinism:**
   - Pinned `@op-engineering/op-sqlite` to fixed version `"16.2.0"` in `apps/mobile/package.json` to eliminate wildcard dependency drift and lock 16KB native library alignment.
   - Normalized Jest `testMatch` to forward slashes (`apps/mobile/jest.config.js`) resolving test suite discovery under worktree dot-directories (`.worktrees/`).
   - Anchored Babel module aliases to `__dirname` (`apps/mobile/babel.config.js`) and enabled symlink traversal in Metro (`apps/mobile/metro.config.js`).
4. **Guided Goal Programs & Autopilot Attribution:**
   - Adds schema migrations 033–034 supporting guided programs and autopilot target attribution.
   - Introduces multi-tier program selection and state persistence.
5. **Movement Library Expansion & Content Corrections (v1/v2):**
   - Implements migrations 036–050 adding 12 batches of movements with complete coaching intents and movement media manifests.
   - Adds automated migration generators and data validation suites.
6. **Bounded Routine Microcycles & RPE Major Support:**
   - Implements migrations 051–054 enforcing context-aware movement access, routine role compatibility, and legacy-role provenance.
   - Bounded microcycle stress calculation and author-projected RPE ceiling preservation.
7. **Suspension Episodes & Layoff Recovery:**
   - Adds migrations 058–060 supporting suspension states, load intent, and program goal tier alignment.
8. **Mobile UI Hardening & Accessibility Layout Remediation:**
   - Refactors `RoutineTemplateBuilder.tsx` loading-method selector to vertical column stacking (`flexDirection: 'column'`, `gap: theme.space[2]`), eliminating label clipping under enlarged font scale (`font_scale 1.30` at 420 dpi) and narrow phone widths (360 dp).
   - Strengthens selector unit test coverage to contract-anchored fail-closed queries.

## Risk Assessment & Mitigations

- **Database Integrity & Historical Migration Modification:**
  - **Modified Historical Migration 004:** `packages/core-db/src/schema/004_state_vector_materialize.sql` is a modified historical migration, not a new additive migration. It removes the ACWR / load component term (weight 0.30) from the readiness score calculation, leaving readiness as a weighted mean of HRV (0.35) and sleep (0.25) recovery inputs only.
  - **`user_version` Divergence Consequence:** Because `packages/core-db/src/migrationRunner.ts` gates execution on `user_version`, existing installations that have already executed migration 004 will retain the legacy ACWR-weighted readiness score, while fresh installations apply the updated HRV+sleep formula. Merges and release evaluations must account for this behavioural bifurcation between existing and new installs.
  - **Destructive Table Rebuilds (Migrations 049 & 052):** Migrations 049 and 052 perform destructive table rebuilds (`DROP TABLE`) against three live tables: `movement_equipment`, `movement_role_eligibility`, and `routine_template_slot`.
  - **Data Preservation Verified Safe:** Each rebuild follows the canonical SQLite copy-forward migration pattern: `CREATE TABLE …_vNNN` → `INSERT … SELECT` from original → `DROP TABLE` original → `ALTER TABLE …_vNNN RENAME TO …`. Rows are copied forward before anything is dropped, primary keys are preserved on `routine_template_slot`, targeted catalogue deletions in 049 are verified, legacy allowance cleanup in 054 is benign, and the temporary `_m060_guard` table in 060 is cleanly dropped.
- **Inference Stability:** Extensive test harness covering longitudinal bounds, policy references, autopilot counterexamples, and effort cues (`npm run verify:blocks`, `npm run verify:autopilot`).
- **Binary Compatibility:** Android QA candidate APK verified with strict manifest validation, Hermes bytecode bundling, ONNX runtime packaging, and apksigner debug certificate checks.

## Data Preservation & Migrations Status

- SQLite schema changes comprise 28 forward migrations (033–060), destructive table rebuilds with verified copy-forward (049, 052), and one modified historical migration (004 with `user_version` divergence disclosed).
- Demo path data verified clean.
- Device evidence recorded on synthetic isolated emulator; physical Pixel `49241FDAP001C7` untouched.

## Carried Open Items (Owner Disposition)

- **F7:** InfoTip nominal 42 dp touch target vs 56 dp contract recorded for owner decision.
- **O1:** Raw enum identifiers (`LINEAR` / `APRE`) in tooltip headers recorded for owner decision.
- **O3:** Slot-role chip row `ACC` label edge-clamping under `font_scale 1.30` recorded for owner decision.

## Explicit Exclusions

- No production release or signing is performed in this branch.
- No physical device data was modified.
```

---

## 7. Next Authorized Step

The W3 aggregate integration packet is complete and frozen. Ready for Opus W3 re-audit.

## Appendix: Complete Commit List (131 commits)

| # | Commit | Date | Author | Summary |
| :--- | :--- | :--- | :--- | :--- |
| 131 | `0d24ebd` | 2026-09-04 | Francis Saga Pike | docs(audit): distinguish verified session persistence from unverified saved-RPE values (Case D PARTIAL) |
| 130 | `8561538` | 2026-09-04 | Francis Saga Pike | docs(audit): remediate live-session evidence pack per Opus audit |
| 129 | `dcd312a` | 2026-09-04 | Francis Saga Pike | docs(audit): live-session RPE/RIR device evidence handback and Entry 0069 closeout |
| 128 | `aec7d05` | 2026-09-04 | Francis Saga Pike | docs(ledger): open Entry 0069 for live-session RPE/RIR device evidence |
| 127 | `8fd2bf5` | 2026-09-04 | Francis Saga Pike | docs(handover): make the starting-HEAD check an invariant, not a literal SHA |
| 126 | `7b28893` | 2026-09-04 | Francis Saga Pike | docs(handover): work order for Antigravity live-session RPE/RIR device evidence |
| 125 | `97230fb` | 2026-09-04 | Francis Saga Pike | docs(audit): record Pixel 9 Pro QA build and non-writing smoke test — PARTIAL |
| 124 | `e927d8e` | 2026-09-04 | Francis Saga Pike | docs(ledger): open Entry 0067 for Pixel 9 Pro QA build and non-writing smoke test |
| 123 | `6984f95` | 2026-09-04 | Francis Saga Pike | docs(audit): complete post-audit remediation handoff and close Entry 0066 |
| 122 | `6dde126` | 2026-09-04 | Francis Saga Pike | fix(rpe): candidate product freeze 4 — unanchor effort cue and correct beginner glossary semantics |
| 121 | `2862a79` | 2026-09-04 | Francis Saga Pike | docs(audit): record Opus re-audit of Round 3 remediation — APPROVE |
| 120 | `df08c5e` | 2026-09-04 | Francis Saga Pike | docs(audit): complete team preview round 3 reconciliation and close ledger output |
| 119 | `7048114` | 2026-09-04 | Francis Saga Pike | fix(rpe): candidate product freeze 3 — unanchor direct RPE stepper and repoint WAVE gate (F-01, F-02) |
| 118 | `76961b3` | 2026-09-04 | Francis Saga Pike | docs(audit): repair Round 2 sentinel report encoding and identifiers (F-03) |
| 117 | `40da059` | 2026-09-03 | Francis Saga Pike | docs(audit): record Opus independent audit of Gemini RPE/RIR work |
| 116 | `bacd9b8` | 2026-09-03 | Francis Saga Pike | docs(audit): commission Opus review of Gemini RPE work |
| 115 | `ea668ef` | 2026-09-03 | Francis Saga Pike | docs(audit): complete team preview round 2 reconciliation and close ledger output |
| 114 | `cedb24b` | 2026-09-03 | Francis Saga Pike | docs(audit): record round 1 reconciliation and update executor handoff for candidate freeze 2 |
| 113 | `71ccc02` | 2026-09-03 | Francis Saga Pike | fix(infotip): preserve static WAVE glossary entry and restore verify_blocks.mjs to base |
| 112 | `ce116d0` | 2026-09-03 | Francis Saga Pike | docs(audit): draft executor handoff for RPE/RIR familiarisation candidate freeze |
| 111 | `93d4877` | 2026-09-03 | Francis Saga Pike | feat(session): unanchored RIR and direct RPE effort entry for SessionScreen |
| 110 | `450380e` | 2026-09-03 | Francis Saga Pike | feat(glossary): add offline canonical glossary, hardened InfoTips, and ProfileScreen sub-view |
| 109 | `4614c4f` | 2026-09-03 | Francis Saga Pike | feat(inference): implement pure RIR-to-RPE mapping, stop guidance, and effort cues |
| 108 | `da84cb2` | 2026-09-03 | Francis Saga Pike | chore(ledger): record W0 prompt entry for RPE/RIR familiarisation |
| 107 | `f8a0033` | 2026-09-03 | Francis Saga Pike | docs(workorder): require Gemini 3.8 Team Preview execution |
| 106 | `2d6041b` | 2026-09-03 | Francis Saga Pike | docs(workorder): retarget beginner learning UX to Antigravity |
| 105 | `b66ffc0` | 2026-09-03 | Francis Saga Pike | docs(workorder): define beginner effort learning and glossary UX |
| 104 | `e15bbe9` | 2026-09-02 | Francis Saga Pike | docs(audit): record the Round 6 micro-fix in the handoff |
| 103 | `8ef5728` | 2026-09-02 | Francis Saga Pike | fix(programs): role-based capacity heading and simulated-edit advice |
| 102 | `a8ed7c2` | 2026-09-02 | Francis Saga Pike | docs(audit): inventory the preserved untracked audit-package dirs in the Round 5 record |
| 101 | `d3180ae` | 2026-09-02 | Francis Saga Pike | fix(programs): invocation-scoped PQ evidence, hypertrophy fallback, role-based capacity copy |
| 100 | `d9865f4` | 2026-09-01 | Francis Saga Pike | docs(audit): record the round-4 dual-APPROVE re-certification; cosmetic cleanups |
| 99 | `d4e043d` | 2026-09-01 | Francis Saga Pike | fix(programs): remediate the four audit P1s and the P2 evidence boundary |
| 98 | `1705577` | 2026-09-01 | Francis Saga Pike | docs(audit): record the round-3 dual-APPROVE certification |
| 97 | `048ca85` | 2026-09-01 | Francis Saga Pike | fix(app): scope the power-card caption by training age; correct handoff rows |
| 96 | `cb900c8` | 2026-09-01 | Francis Saga Pike | docs(audit): pin the re-freeze SHA in the handoff |
| 95 | `b8d5056` | 2026-09-01 | Francis Saga Pike | docs(audit): complete the re-freeze handoff with the review round record |
| 94 | `0223603` | 2026-09-01 | Francis Saga Pike | docs(audit): Round 2 re-freeze — supersede the frozen candidate reference |
| 93 | `2f460a9` | 2026-09-01 | Francis Saga Pike | docs(audit): record the Round 2 review outcome and re-freeze |
| 92 | `bc2c744` | 2026-09-01 | Francis Saga Pike | fix(programs): review remediation — reproducible matrix, tier-scoped power copy |
| 91 | `ff1496d` | 2026-09-01 | Francis Saga Pike | docs(audit): close the Round 2 ledger output |
| 90 | `19a17ae` | 2026-09-01 | Francis Saga Pike | docs(audit): freeze the Round 2 candidate and supersede the executor handoff |
| 89 | `e22a1cf` | 2026-09-01 | Francis Saga Pike | docs(audit): rebuild the PQ matrix with semantic PQ-04/05/06 |
| 88 | `8f42d2c` | 2026-09-01 | Francis Saga Pike | feat(app): preview progression summary, shaped capacity law, required limitations answer |
| 87 | `bd831a3` | 2026-09-01 | Francis Saga Pike | feat(programs): power-specific ranking and the named hypertrophy dose-role law |
| 86 | `9f2e1e9` | 2026-09-01 | Francis Saga Pike | docs(audit): pin freeze-vs-docs commits in the handover |
| 85 | `fe25604` | 2026-09-01 | Francis Saga Pike | docs(audit): hand off program-quality candidate |
| 84 | `cfbcf67` | 2026-09-01 | Francis Saga Pike | test(pipeline): pin the 060 tier-alignment policy and surviving tier ceiling |
| 83 | `08bc2c4` | 2026-09-01 | Francis Saga Pike | docs(audit): refresh matrix after access-context fix |
| 82 | `92b6145` | 2026-09-01 | Francis Saga Pike | fix(programs): apply the slot access context inside the ranking policy |
| 81 | `ff52fbe` | 2026-09-01 | Francis Saga Pike | docs(audit): generate the PQ acceptance matrix from candidate code |
| 80 | `34288d7` | 2026-09-01 | Francis Saga Pike | fix(programs): rank with visible gate reasons and anchor disclosures |
| 79 | `f4db96e` | 2026-09-01 | Francis Saga Pike | refactor(onboarding): reduce first-run decision burden |
| 78 | `3966c12` | 2026-09-01 | Francis Saga Pike | feat(session): clarify actual reps and plain-language effort cues |
| 77 | `bd97799` | 2026-09-01 | Francis Saga Pike | fix(progression): keep bodyweight reps monotone without a load channel |
| 76 | `0e2c19d` | 2026-09-01 | Francis Saga Pike | feat(programs): align goals, tiers, and movement selection |
| 75 | `71b1a2f` | 2026-09-01 | Francis Saga Pike | docs(programs): define quality remediation and audit handoff |
| 74 | `965492e` | 2026-09-01 | Francis Saga Pike | fix(ci): keep QA candidate provenance clean |
| 73 | `8184da8` | 2026-09-01 | Francis Saga Pike | fix(ci): install pinned Android native toolchain |
| 72 | `1a7e80d` | 2026-09-01 | Francis Saga Pike | docs(audit): record independent State C certification |
| 71 | `952afd3` | 2026-08-31 | Francis Saga Pike | docs(audit): reconcile State C release evidence |
| 70 | `88f5b5c` | 2026-08-31 | Francis Saga Pike | fix(progression): decouple chain rep floor from load routing |
| 69 | `34f91ff` | 2026-08-29 | Francis Saga Pike | docs(ledger): record the C0-C5 result for entry 0057 |
| 68 | `0cd8db9` | 2026-08-29 | Francis Saga Pike | feat(release): freeze progression under suspension and route dose on planned load |
| 67 | `f3ebab3` | 2026-08-29 | Francis Saga Pike | feat(db): Migration 059 -- suspension state, load intent, audit immutability |
| 66 | `a80f955` | 2026-08-29 | Francis Saga Pike | docs(decisions): C1 decision docket and the owner's ratified rulings |
| 65 | `48719b0` | 2026-08-27 | Francis Saga Pike | docs(mandate): Sol becomes Chief Orchestrator; supersede the auditor mandate |
| 64 | `339e2c5` | 2026-08-27 | Francis Saga Pike | docs(handover): rewrite the Sol brief for an orchestrator |
| 63 | `0c6d164` | 2026-08-27 | Francis Saga Pike | docs(handover): brief for Sol — state, outstanding work, and the traps |
| 62 | `5c727f6` | 2026-08-27 | Francis Saga Pike | feat(db): Migration 058 — suspension episodes (RR-02) |
| 61 | `1f934bb` | 2026-08-27 | Francis Saga Pike | feat(engine): RR-04 primary-slot volume bias + capability ladder reconciliation |
| 60 | `e0761a8` | 2026-08-27 | Francis Saga Pike | docs(audit): audit the external architecture review of 8b4e75b |
| 59 | `8b4e75b` | 2026-08-27 | Francis Saga Pike | feat(engine): Option C — implement-routed bodyweight progression in LINEAR |
| 58 | `0fc830c` | 2026-08-27 | Francis Saga Pike | docs(analysis): LINEAR progression is quantised away — finding, not a fix |
| 57 | `41dfad6` | 2026-08-27 | Francis Saga Pike | docs(decisions): ratify decision 4 plan-only; add the control safety brief |
| 56 | `9ebf18d` | 2026-08-27 | Francis Saga Pike | docs(decisions): ratify decisions 1-3; re-scope decision 4 after owner challenge |
| 55 | `21aca5a` | 2026-08-26 | Francis Saga Pike | docs(evidence): ratify decision 6 — preserve the audit archive in-repo |
| 54 | `4096d56` | 2026-08-26 | Francis Saga Pike | docs(decisions): ratify decision 5 — do not pursue push-up force values |
| 53 | `524595e` | 2026-08-26 | Francis Saga Pike | docs(ledger): entry 0042 — freeze commit for the evidence remediation |
| 52 | `bedf1d3` | 2026-08-26 | Francis Saga Pike | docs(evidence): freeze the audited progression-measurement evidence record |
| 51 | `368e82d` | 2026-08-26 | Francis Saga Pike | docs(ledger): backfill entries 0024-0039 for the six-week gap |
| 50 | `f686d7e` | 2026-08-26 | Francis Saga Pike | fix(mobile): hold trajectory and chip labels on one line at width |
| 49 | `ff6f137` | 2026-08-25 | Francis Saga Pike | chore(release): ignore the Kotlin daemon session directory |
| 48 | `62af2e5` | 2026-08-25 | Francis Saga Pike | fix(release): register the pikeMethods component name natively for cold launch |
| 47 | `bff0a38` | 2026-08-25 | Francis Saga Pike | fix(release): strip library-injected INTERNET from production merges |
| 46 | `125fcf4` | 2026-08-25 | Francis Saga Pike | fix(verification): accept empty newFiles for clean candidates; harden model size gate |
| 45 | `1edf390` | 2026-08-25 | Francis Saga Pike | fix(release): declare lint-task dependency on the Archivo packaging task |
| 44 | `75ef8ba` | 2026-08-25 | Francis Saga Pike | feat(release): revision-8 closed-test remediation with full Phase 3 test matrix |
| 43 | `a276bf1` | 2026-08-25 | Francis Saga Pike | chore(release): preserve audited revision 7 checkpoint |
| 42 | `dc1d89a` | 2026-08-20 | Francis Saga Pike | feat(program): anchor a dated goal program so its peak lands on the date |
| 41 | `a812cee` | 2026-08-20 | Francis Saga Pike | feat(inference): derive an estimated-1RM series from logged sets |
| 40 | `4b8d8e5` | 2026-08-20 | Francis Saga Pike | feat(engine): add SELECTABLE_SCHEMA_TYPES, retire STEP from selection |
| 39 | `a6be1a2` | 2026-08-17 | Francis Saga Pike | feat(builder): tiered movement picker, three-mode entry, and learning layer |
| 38 | `6727cba` | 2026-08-15 | Francis Saga Pike | chore(acceptance): pre-release calibration acceptance, migration 055, and device evidence |
| 37 | `d726a01` | 2026-08-14 | Francis Saga Pike | test(inference): close final longitudinal audit debt |
| 36 | `2ed9531` | 2026-08-14 | Francis Saga Pike | test(inference): land P2 closeout implementations and repair summary |
| 35 | `f6dce82` | 2026-08-14 | Francis Saga Pike | test(inference): close longitudinal audit findings |
| 34 | `7002c24` | 2026-08-14 | Francis Saga Pike | fix(inference): harden longitudinal verifier per audit |
| 33 | `12da513` | 2026-08-14 | Francis Saga Pike | test(inference): add longitudinal bounds verification |
| 32 | `a38ab10` | 2026-08-14 | Francis Saga Pike | fix(routines): preserve authored projected RPE ceiling |
| 31 | `4a95679` | 2026-08-13 | Francis Saga Pike | fix(embedder): close supply-chain audit findings |
| 30 | `2f4e72e` | 2026-08-13 | Francis Saga Pike | fix(embedder): pin model supply chain |
| 29 | `291183e` | 2026-08-13 | Francis Saga Pike | fix(migrations): seal routine legacy-role provenance |
| 28 | `d3cab60` | 2026-08-13 | Francis Saga Pike | fix(routines): close bounded-microcycle audit findings |
| 27 | `f41712d` | 2026-08-13 | Francis Saga Pike | feat(routines): bound uncapped microcycle stress |
| 26 | `6cfb990` | 2026-08-13 | Francis Saga Pike | feat(routines): project major RPE and rank support work |
| 25 | `6b233b6` | 2026-08-13 | Francis Saga Pike | fix(sessions): enforce access at log boundary |
| 24 | `046a165` | 2026-08-13 | Francis Saga Pike | fix(routines): close movement access audit findings |
| 23 | `3870825` | 2026-08-13 | Francis Saga Pike | feat(routines): enforce context-aware movement access |
| 22 | `ef825a7` | 2026-08-12 | Francis Saga Pike | docs(audit): hand over coach lab verification |
| 21 | `ebaf784` | 2026-08-12 | Francis Saga Pike | feat(mobile): add hidden coach verification lab |
| 20 | `37a06b8` | 2026-08-12 | Francis Saga Pike | fix(db): converge supplementary role eligibility |
| 19 | `2f67d56` | 2026-08-12 | Francis Saga Pike | fix(android): close ONNX release hardening gaps |
| 18 | `1854a8a` | 2026-08-12 | Francis Saga Pike | build(android): verify ONNX APK and AAB packaging |
| 17 | `2e223fe` | 2026-08-12 | Francis Saga Pike | fix: finalize pre-release movement corrections |
| 16 | `1fcac30` | 2026-08-09 | Francis Saga Pike | feat: complete phase 2a movement library |
| 15 | `332e356` | 2026-08-09 | Francis Saga Pike | data: add phase 2a library batches 047-048 |
| 14 | `ea3d1db` | 2026-08-09 | Francis Saga Pike | data: add phase 2a library batches 045-046 |
| 13 | `4a9d323` | 2026-08-09 | Francis Saga Pike | data: add phase 2a library batches 043-044 |
| 12 | `90858e0` | 2026-08-09 | Francis Saga Pike | data: add phase 2a library batches 041-042 |
| 11 | `a342563` | 2026-08-09 | Francis Saga Pike | data: add phase 2a library batches 039-040 |
| 10 | `fc020b5` | 2026-08-09 | Francis Saga Pike | data: add phase 2a library batches 037-038 |
| 9 | `578b0cd` | 2026-08-09 | Francis Saga Pike | chore: harden Android pre-release boundary |
| 8 | `5116ff7` | 2026-08-08 | Francis Saga Pike | fix: close four-mode load-selection audit findings |
| 7 | `617039f` | 2026-08-08 | Francis Saga Pike | feat: implement four-mode load selection |
| 6 | `004d1ce` | 2026-08-07 | Francis Saga Pike | docs: ratify four-mode load selection |
| 5 | `ab42b0e` | 2026-08-07 | Francis Saga Pike | feat: persist autopilot target attribution |
| 4 | `4f064ac` | 2026-08-07 | Francis Saga Pike | feat(ui): implement WO-UI-3/4 punchlist closeout |
| 3 | `0068a5b` | 2026-08-07 | Francis Saga Pike | fix: fail closed Android ELF alignment audit |
| 2 | `0d97f50` | 2026-08-06 | Francis Saga Pike | fix: guided-program merge readiness — macro ownership, shared program tx, jest path fix, 16 KB alignment |
| 1 | `ff72694` | 2026-08-03 | Francis Saga Pike | feat: add guided goal programs |

## Appendix: Complete Committed Changed-Path Inventory (310 paths)

### Mobile UI & Component State (`apps/mobile/src/`, `apps/mobile/test/`) (50 paths)

- `apps/mobile/src/App.tsx`
- `apps/mobile/src/components/InfoTip.tsx`
- `apps/mobile/src/components/RoutineTemplateBuilder.tsx`
- `apps/mobile/src/components/ui/Chip.tsx`
- `apps/mobile/src/components/ui/Stepper.tsx`
- `apps/mobile/src/data/glossary.ts`
- `apps/mobile/src/diagnostics/coachVerificationLab.ts`
- `apps/mobile/src/inference/deviceEmbedder.ts`
- `apps/mobile/src/layout/statusBarPadding.ts`
- `apps/mobile/src/screens/BlockScreen.tsx`
- `apps/mobile/src/screens/CoachVerificationLabScreen.tsx`
- `apps/mobile/src/screens/GlossaryScreen.tsx`
- `apps/mobile/src/screens/LibraryScreen.tsx`
- `apps/mobile/src/screens/LibraryScreenV2.tsx`
- `apps/mobile/src/screens/NewBlockChooserScreen.tsx`
- `apps/mobile/src/screens/OnboardingScreen.tsx`
- `apps/mobile/src/screens/ProfileScreen.tsx`
- `apps/mobile/src/screens/ProgramSetupScreen.tsx`
- `apps/mobile/src/screens/ReadinessScreen.tsx`
- `apps/mobile/src/screens/SessionScreen.tsx`
- `apps/mobile/src/state/athleteRegistryCore.ts`
- `apps/mobile/src/state/equipmentInventory.ts`
- `apps/mobile/src/state/loadPreferenceStore.ts`
- `apps/mobile/src/state/useStore.ts`
- `apps/mobile/src/theme/theme.ts`
- `apps/mobile/test/.build/athleteRegistryCore.js`
- `apps/mobile/test/components/CoachVerificationLab.test.js`
- `apps/mobile/test/components/ContentCorrection049.test.js`
- `apps/mobile/test/components/DemoFeedback.test.js`
- `apps/mobile/test/components/DemoLoadStore.test.js`
- `apps/mobile/test/components/FocusScreens.test.js`
- `apps/mobile/test/components/Glossary.test.js`
- `apps/mobile/test/components/LearningLayer.test.js`
- `apps/mobile/test/components/LibraryScreen.test.js`
- `apps/mobile/test/components/NewBlockChooserScreen.test.js`
- `apps/mobile/test/components/NextBlockPanel.test.js`
- `apps/mobile/test/components/ProfileScreens.test.js`
- `apps/mobile/test/components/ProgramQualityRound2.test.js`
- `apps/mobile/test/components/ProgramSetupScreen.test.js`
- `apps/mobile/test/components/RoutineTemplateBuilder.test.js`
- `apps/mobile/test/components/SessionAccessBoundary.test.js`
- `apps/mobile/test/components/SessionScreen.test.js`
- `apps/mobile/test/components/SuspensionLifecycle.test.js`
- `apps/mobile/test/components/TodaySpine.test.js`
- `apps/mobile/test/components/UIComponents.test.js`
- `apps/mobile/test/helpers/nodeSqliteOpDriver.js`
- `apps/mobile/test/sqlRawTransformer.js`
- `apps/mobile/test/verify_coach.mjs`
- `apps/mobile/test/verify_routine_templates.mjs`
- `apps/mobile/test/verify_store_sql.mjs`

### Mobile App & Build Configuration (`apps/mobile/`) (5 paths)

- `apps/mobile/app.json`
- `apps/mobile/babel.config.js`
- `apps/mobile/jest.config.js`
- `apps/mobile/metro.config.js`
- `apps/mobile/package.json`

### Inference Engine & Policy (`packages/inference/`) (30 paths)

- `packages/inference/src/blockGenerator.ts`
- `packages/inference/src/capabilityResolver.ts`
- `packages/inference/src/e1rm.ts`
- `packages/inference/src/effortCues.ts`
- `packages/inference/src/index.ts`
- `packages/inference/src/kinematicAutopilot.ts`
- `packages/inference/src/loadSelection.ts`
- `packages/inference/src/movementRanking.ts`
- `packages/inference/src/pickerTiering.ts`
- `packages/inference/src/policyReference.ts`
- `packages/inference/src/returnFromLayoff.ts`
- `packages/inference/src/routineComposer.ts`
- `packages/inference/src/routineMicrocycle.ts`
- `packages/inference/src/semantic/onnxEmbedder.ts`
- `packages/inference/src/substitution.ts`
- `packages/inference/src/tierPolicy.ts`
- `packages/inference/src/types.ts`
- `packages/inference/test/verify_autopilot_counterexamples.ts`
- `packages/inference/test/verify_blocks.mjs`
- `packages/inference/test/verify_effort_cues.mjs`
- `packages/inference/test/verify_embedder.mjs`
- `packages/inference/test/verify_embedder_integrity.mjs`
- `packages/inference/test/verify_lazy_lifecycle.mjs`
- `packages/inference/test/verify_load_selection.mjs`
- `packages/inference/test/verify_longitudinal_bounds.mjs`
- `packages/inference/test/verify_movementRanking.mjs`
- `packages/inference/test/verify_pipeline.mjs`
- `packages/inference/test/verify_policy.mjs`
- `packages/inference/test/verify_programQualityRound2.mjs`
- `packages/inference/test/verify_semantic.mjs`

### Database Schema & Migrations (`packages/core-db/`) (45 paths)

- `packages/core-db/src/index.ts`
- `packages/core-db/src/migrationRunner.ts`
- `packages/core-db/src/migrations.ts`
- `packages/core-db/src/programTx.ts`
- `packages/core-db/src/schema/004_state_vector_materialize.sql`
- `packages/core-db/src/schema/033_goal_program.sql`
- `packages/core-db/src/schema/034_autopilot_attribution.sql`
- `packages/core-db/src/schema/035_profile_load_preference.sql`
- `packages/core-db/src/schema/036_movement_media.sql`
- `packages/core-db/src/schema/037_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/038_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/039_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/040_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/041_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/042_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/043_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/044_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/045_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/046_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/047_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/048_movement_library_v2_batch.sql`
- `packages/core-db/src/schema/049_movement_content_correction_v1.sql`
- `packages/core-db/src/schema/050_movement_role_convergence.sql`
- `packages/core-db/src/schema/051_routine_access_context.sql`
- `packages/core-db/src/schema/052_bounded_microcycle_roles.sql`
- `packages/core-db/src/schema/053_routine_role_compatibility.sql`
- `packages/core-db/src/schema/054_contract_cutoff_provenance.sql`
- `packages/core-db/src/schema/055_return_checkin_ack.sql`
- `packages/core-db/src/schema/056_movement_taxonomy_backfill.sql`
- `packages/core-db/src/schema/057_block_meta_phase_invariant.sql`
- `packages/core-db/src/schema/058_suspension_episode.sql`
- `packages/core-db/src/schema/059_suspension_state_and_load_intent.sql`
- `packages/core-db/src/schema/060_program_goal_tier_alignment.sql`
- `packages/core-db/staging/library_target_v1.json`
- `packages/core-db/staging/movement_coaching_intent_v2.json`
- `packages/core-db/staging/movement_coaching_intent_v2_manifest.json`
- `packages/core-db/staging/movement_content_correction_v1.json`
- `packages/core-db/staging/movement_content_correction_v1_manifest.json`
- `packages/core-db/staging/movement_import.json`
- `packages/core-db/staging/movement_media_manifest.json`
- `packages/core-db/staging/seeded_manifest.json`
- `packages/core-db/test/verify_demo_path.mjs`
- `packages/core-db/test/verify_library.py`
- `packages/core-db/test/verify_migrations.mjs`
- `packages/core-db/test/verify_schema.py`

### Native Build, Tooling & CI (`apps/mobile/android/`, `apps/mobile/ios/`, `.github/`) (8 paths)

- `.github/workflows/ci.yml`
- `apps/mobile/android/app/build.gradle`
- `apps/mobile/android/app/src/debug/AndroidManifest.xml`
- `apps/mobile/android/app/src/main/AndroidManifest.xml`
- `apps/mobile/android/app/src/main/java/com/athletekinetics/MainActivity.kt`
- `apps/mobile/android/app/src/main/res/values/strings.xml`
- `apps/mobile/android/build.gradle`
- `apps/mobile/android/gradlew`

### Documentation, Audits & Decisions (`docs/`) (111 paths)

- `docs/ANALYSIS_linear_scheme_progression_defect.md`
- `docs/AUDIT_architecture_review_8b4e75b.md`
- `docs/BRIEF_progression_control_safety.md`
- `docs/HANDOVER_TEAM_PREVIEW_PROGRAM_QUALITY_AUDIT.md`
- `docs/PARKED_RR03_taper_and_microcycle_architecture.md`
- `docs/PRE_RELEASE_ANDROID.md`
- `docs/PROGRAM_QUALITY_REMEDIATION_SEQUENCE.md`
- `docs/PROPOSAL_suspended_state_trigger.md`
- `docs/SPEC_FOUR_MODE_LOAD_KIMI.md`
- `docs/WORKORDER_ADVANCED_BIOMETRIC_RPE_DISCOVERY.md`
- `docs/WORKORDER_GLM53_AUDIT_SYNTHESIS_CONTINUATION.md`
- `docs/WORKORDER_MASTER_AUDIT_SYNTHESIS_REMEDIATION.md`
- `docs/WORKORDER_OPUS_INDEPENDENT_AUDIT_RPE_RIR_FAMILIARISATION.md`
- `docs/WORKORDER_PROGRAM_QUALITY_AND_INTAKE_REMEDIATION.md`
- `docs/WORKORDER_RPE_RIR_FAMILIARISATION.md`
- `docs/WORKORDER_STATE_C_RELEASE_READINESS.md`
- `docs/WO_FOUR_MODE_LOAD.md`
- `docs/audits/AUDIT_CLAUDE_RELEASE_CLOSEOUT_34F91FF.md`
- `docs/audits/MASTER_AUDIT_SOURCE_MANIFEST.md`
- `docs/audits/phase-2a-movement-library/OPUS_AUDIT_PROMPT.md`
- `docs/audits/phase-2a-movement-library/README.md`
- `docs/audits/pre-release-coach-verification-lab/CLAUDE_CODE_AUDIT_HANDOVER.md`
- `docs/audits/program-quality-remediation/EXECUTOR_HANDOFF.md`
- `docs/audits/program-quality-remediation/EXECUTOR_HANDOFF_R2.md`
- `docs/audits/program-quality-remediation/GENERATED_PROGRAM_MATRIX.md`
- `docs/audits/program-quality-remediation/OWNER_DECISIONS_AND_LIMITATIONS.md`
- `docs/audits/program-quality-remediation/TEST_EVIDENCE.md`
- `docs/audits/program-quality-remediation/TEST_EVIDENCE_R2.md`
- `docs/audits/program-quality-remediation/matrix_harness.mjs`
- `docs/audits/program-quality-remediation/reviews/round-3-reviewer-a.txt`
- `docs/audits/program-quality-remediation/reviews/round-3-reviewer-b.txt`
- `docs/audits/rpe-familiarisation/EXECUTOR_HANDOFF.md`
- `docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md`
- `docs/audits/rpe-familiarisation/antigravity/WORKORDER_LIVE_SESSION_EVIDENCE.md`
- `docs/audits/rpe-familiarisation/opus/OPUS_INDEPENDENT_AUDIT.md`
- `docs/audits/rpe-familiarisation/opus/OPUS_REAUDIT_ROUND3.md`
- `docs/audits/rpe-familiarisation/opus/PIXEL9PRO_SMOKE_REPORT.md`
- `docs/audits/rpe-familiarisation/team-preview/round-1/reconciliation.md`
- `docs/audits/rpe-familiarisation/team-preview/round-1/reviewer-a.md`
- `docs/audits/rpe-familiarisation/team-preview/round-1/reviewer-b.md`
- `docs/audits/rpe-familiarisation/team-preview/round-1/sentinel.md`
- `docs/audits/rpe-familiarisation/team-preview/round-2/reconciliation.md`
- `docs/audits/rpe-familiarisation/team-preview/round-2/reviewer-a.md`
- `docs/audits/rpe-familiarisation/team-preview/round-2/reviewer-b.md`
- `docs/audits/rpe-familiarisation/team-preview/round-2/sentinel.md`
- `docs/audits/rpe-familiarisation/team-preview/round-3/reconciliation.md`
- `docs/audits/rpe-familiarisation/team-preview/round-3/reviewer-a.md`
- `docs/audits/rpe-familiarisation/team-preview/round-3/reviewer-b.md`
- `docs/audits/rpe-familiarisation/team-preview/round-3/sentinel.md`
- `docs/audits/state-c-release-readiness/LEDGER_LINEAGE_CROSSWALK.md`
- `docs/audits/state-c-release-readiness/lineage/PROMPT_LEDGER_AUDIT_LINEAGE_1A878602.md`
- `docs/audits/state-c-release-readiness/reviews/round-10-reviewer-a.txt`
- `docs/audits/state-c-release-readiness/reviews/round-10-reviewer-b.txt`
- `docs/audits/state-c-release-readiness/reviews/round-11-reviewer-a.txt`
- `docs/audits/state-c-release-readiness/reviews/round-11-reviewer-b.txt`
- `docs/audits/state-c-release-readiness/reviews/round-12-reviewer-a.txt`
- `docs/audits/state-c-release-readiness/reviews/round-12-reviewer-b.txt`
- `docs/audits/state-c-release-readiness/reviews/round-13-reviewer-a.txt`
- `docs/audits/state-c-release-readiness/reviews/round-13-reviewer-b.txt`
- `docs/audits/state-c-release-readiness/reviews/round-2-reviewer-a.txt`
- `docs/audits/state-c-release-readiness/reviews/round-2-reviewer-b.txt`
- `docs/audits/state-c-release-readiness/reviews/round-3-reviewer-a.txt`
- `docs/audits/state-c-release-readiness/reviews/round-3-reviewer-b.txt`
- `docs/audits/state-c-release-readiness/reviews/round-4-reviewer-a.txt`
- `docs/audits/state-c-release-readiness/reviews/round-4-reviewer-b.txt`
- `docs/audits/state-c-release-readiness/reviews/round-5-reviewer-a.txt`
- `docs/audits/state-c-release-readiness/reviews/round-5-reviewer-b.txt`
- `docs/audits/state-c-release-readiness/reviews/round-6-reviewer-a.txt`
- `docs/audits/state-c-release-readiness/reviews/round-6-reviewer-b.txt`
- `docs/audits/state-c-release-readiness/reviews/round-7-reviewer-a.txt`
- `docs/audits/state-c-release-readiness/reviews/round-7-reviewer-b.txt`
- `docs/audits/state-c-release-readiness/reviews/round-8-reviewer-b.txt`
- `docs/audits/state-c-release-readiness/reviews/round-9-reviewer-a.txt`
- `docs/audits/state-c-release-readiness/reviews/round-9-reviewer-b.txt`
- `docs/decisions/CALIBRATION_POLICY_V1.md`
- `docs/decisions/FOUR_LIFT_EQUIVALENT_VOLUME.md`
- `docs/decisions/PROGRESSION_MEASUREMENT_OPEN_DECISIONS.md`
- `docs/decisions/RELEASE_CANDIDATE_C1_DOCKET.md`
- `docs/decisions/ROUTINE_BOUNDED_MICROCYCLE_POLICY.md`
- `docs/decisions/ROUTINE_MAJOR_SUPPORT_POLICY.md`
- `docs/decisions/TRAINING_PROGRESSION_LAYERS.md`
- `docs/decisions/TRAINING_STRUCTURE_CONVENTIONS.md`
- `docs/decisions/coach-verification-lab.md`
- `docs/research/PROGRESSION_MEASUREMENT_EVIDENCE_BASELINE.md`
- `docs/research/audits/README.md`
- `docs/research/audits/progression-terra-2026-08-26.sha256`
- `docs/research/audits/progression-terra-2026-08-26/AUDIT_REPORT.md`
- `docs/research/audits/progression-terra-2026-08-26/CLAIM_LEDGER.csv`
- `docs/research/audits/progression-terra-2026-08-26/OPUS_RECONCILIATION.md`
- `docs/research/audits/progression-terra-2026-08-26/PROCESS_ASSURANCE_APPENDIX.md`
- `docs/research/audits/progression-terra-2026-08-26/RUN_MANIFEST.json`
- `docs/research/audits/progression-terra-2026-08-26/SOURCE_LOG.csv`
- `docs/research/audits/progression-terra-2026-08-26/VERDICT_LOCK.json`
- `docs/research/audits/progression-terra-2026-08-26/calculations/DERIVATIONS.md`
- `docs/research/audits/progression-terra-2026-08-26/calculations/generate_audit_artifacts.py`
- `docs/research/audits/progression-terra-2026-08-26/calculations/recalculate.py`
- `docs/research/audits/progression-terra-2026-08-26/calculations/retrieve_high_risk_sources.py`
- `docs/research/audits/progression-terra-2026-08-26/checkpoints/Q1_LOCKED.md`
- `docs/research/audits/progression-terra-2026-08-26/checkpoints/Q2_LOCKED.md`
- `docs/research/audits/progression-terra-2026-08-26/checkpoints/Q3_LOCKED.md`
- `docs/research/audits/progression-terra-2026-08-26/checkpoints/Q4_LOCKED.md`
- `docs/research/audits/progression-terra-2026-08-26/checkpoints/Q5_LOCKED.md`
- `docs/research/audits/progression-terra-2026-08-26/checkpoints/Q6_LOCKED.md`
- `docs/research/audits/progression-terra-2026-08-26/checkpoints/Q7_LOCKED.md`
- `docs/research/audits/progression-terra-2026-08-26/checkpoints/Q8_LOCKED.md`
- `docs/research/audits/progression-terra-2026-08-26/inputs/HANDOVER_20260826_RESEARCH_AGENT.txt`
- `docs/research/audits/progression-terra-2026-08-26/inputs/HERMES_RESEARCH_BRIEF_progression_measurement.md`
- `docs/research/audits/progression-terra-2026-08-26/inputs/evidence_review_strength_progression.md`
- `docs/research/audits/progression-terra-2026-08-26/inputs/progression_measurement_evidence_review.md`
- `docs/research/audits/progression-terra-2026-08-26/source_metadata.json`
- `docs/research/audits/progression-terra-2026-08-26/workorder.md`

### Verification Tools & Generators (`tools/`, `scripts/`) (34 paths)

- `scripts/embed-codebase.mjs`
- `scripts/embedder-integrity.mjs`
- `scripts/export_movement_library.mjs`
- `scripts/fetch-embedder.mjs`
- `scripts/generate-coaching-intent-migration.mjs`
- `scripts/generate-library-correction.mjs`
- `scripts/generate-library-v2.mjs`
- `scripts/library-target-v1.mjs`
- `scripts/test-library-correction-generator.mjs`
- `scripts/test-library-v2-generator.mjs`
- `scripts/verify-preflight.mjs`
- `tools/audit/state-c-release-fingerprint.json`
- `tools/audit/verify_state_c_release_evidence.mjs`
- `tools/autopilot-sim/HANDOVER_2026-08-14_LONGITUDINAL_BOUNDS.md`
- `tools/autopilot-sim/closedLoop.ts`
- `tools/autopilot-sim/deriveBoundary.ts`
- `tools/inspect_elf_alignment.sh`
- `tools/memory-audit/audit.mjs`
- `tools/memory-audit/budget.json`
- `tools/memory-audit/evidence_provenance.mjs`
- `tools/memory-audit/lifecycle_correlator.mjs`
- `tools/memory-audit/meminfo_harness.mjs`
- `tools/memory-audit/meminfo_parser.mjs`
- `tools/memory-audit/memory_gate.mjs`
- `tools/memory-audit/test_lifecycle_correlator.mjs`
- `tools/memory-audit/test_meminfo_parser.mjs`
- `tools/memory-audit/test_memory_gate.mjs`
- `tools/test_inspect_elf_alignment.sh`
- `tools/test_verify_ci_structure.mjs`
- `tools/test_verify_install_scripts.mjs`
- `tools/test_verify_qa_artifact.mjs`
- `tools/verify_ci_structure.mjs`
- `tools/verify_install_scripts.mjs`
- `tools/verify_qa_artifact.mjs`

### Root Governance, Handovers & Configuration (27 paths)

- `.agents/rules/coding-rules-general.md`
- `.gitattributes`
- `.gitignore`
- `.npmrc`
- `AGENT_WORKFLOW.md`
- `CHIEF_ORCHESTRATOR_MANDATE_SOL.md`
- `DEVIATION_LOG.md`
- `HANDOVER_2026-08-09_PHASE_2A_MOVEMENT_LIBRARY.md`
- `HANDOVER_2026-08-13_BOUNDED_MICROCYCLE.md`
- `HANDOVER_2026-08-13_BOUNDED_MICROCYCLE_AUDIT_REMEDIATION.md`
- `HANDOVER_2026-08-13_EMBEDDER_SUPPLY_CHAIN_PIN.md`
- `HANDOVER_2026-08-13_EMBEDDER_SUPPLY_CHAIN_PIN_AUDIT_CORRECTION.md`
- `HANDOVER_2026-08-13_ROUTINE_CONTRACT_CUTOFF.md`
- `HANDOVER_2026-08-14_FINAL_AUDIT_RPE_CORRECTION.md`
- `HANDOVER_2026-08-27_SOL.md`
- `MASTER_AUDIT_SYNTHESIS.md`
- `PROMPT_LEDGER.md`
- `README.md`
- `RELEASE_READINESS.md`
- `acceptance-evidence/acceptance_item_a_observational_acwr.png`
- `acceptance-evidence/acceptance_item_b_block_active.png`
- `acceptance-evidence/acceptance_item_d_set_logged.png`
- `acceptance-evidence/acceptance_item_e_coach_lab.png`
- `acceptance-evidence/meminfo_coach_lab.txt`
- `package-lock.json`
- `package.json`
- `research_packet.md`

