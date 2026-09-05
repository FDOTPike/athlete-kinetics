# W2 Executor Handback: QA Candidate Build & Isolated Synthetic Emulator Layout Observation

## 0. Handback Status & Verdict Request

```text
W2 EXECUTION COMPLETE — READY FOR OPUS W2 AUDIT AND VERDICT
```

This handback reports complete execution of Requirements **R1 through R5** for W2 continuation in accordance with `docs/WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md` and Opus approval `docs/audits/rpe-familiarisation/continuation/W1_OPUS_AUDIT_R2.md`.

Product code and tests remain strictly **byte-identical** to the reviewed W1 candidate. No product changes were requested or made.

---

## 1. Requirement Execution Summary

### R1. Pre-Build Baseline & QA Candidate Build
- **Pre-existing APK Baseline Archived:**
  - Archived from `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` to ignored path `scratch/continuation/baseline_apk/app-qa.apk` before executing build.
  - Baseline APK Size: `194,449,552` bytes | SHA-256: `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67`.
- **QA Candidate Build Execution:**
  - Built via documented repository command: `.\gradlew.bat assembleQa --no-daemon` in `apps/mobile/android`.
  - Built QA APK: `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk`.
  - Built QA APK Size: `194,450,148` bytes | SHA-256: `7d7f8846891e8be15771ed63f08cf519d4fcd9f66cd2272dc88fe72f97136aeb`.
  - Embedded candidate manifest:
    - schema: `ak.candidate-manifest/1`
    - label: `NON_PRODUCTION_QA_DEBUG_SIGNED`
    - head: `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`
    - branch: `codex/rpe-familiarisation`
    - dirty: `true`
    - trackedDiffFingerprint: `41f19f2aa87b062cefd570a0bc7f1e45e949ec4a068ece6444e65d1e6416c440`
    - packageId: `com.pikemethods.training.qa`
    - buildVariant: `qa`
- **QA Candidate Verification Gate:**
  - Command: `npm.cmd run verify:qa-candidate`
  - Exit Code: `0` (`QA ARTIFACT VERIFIED`)
  - All 31 validation checks passed, including live worktree provenance verification, Hermes bundle check, ONNX model ratified hash, Archivo font ratified hash, 16KB zipalign, 28 ELF64 PT_LOAD >= 0x4000 checks, and apksigner certificate DN debug class validation.

### R2. Isolated Synthetic Emulator Layout Observation
- **Synthetic Emulator Setup:**
  - Booted dedicated isolated virtual device `rpe_isolated_qa_avd` via `emulator.exe -avd rpe_isolated_qa_avd -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect`.
  - Host identity: Serial `emulator-5554`, API 35 (Android 15), ABI `x86_64`.
  - Installed hash-verified QA APK: `adb -s emulator-5554 install -r apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` (Exit 0, `Success`).
- **Standard Width (420 dpi / 411.4 dp width):**
  - All three options (`Linear`, `Undulating`, `Autoregulated`) fully visible, legible, and separated.
  - Direct screenshots:
    - `scratch/continuation/evidence/01_standard_width_linear.png` (Linear selected)
    - `scratch/continuation/evidence/02_standard_width_undulating.png` (Undulating selected)
    - `scratch/continuation/evidence/03_standard_width_autoregulated.png` (Autoregulated selected)
  - Control bounds measured:
    - Chip buttons: `255 × 147 px` = `97.1 × 56.0 dp` (satisfies touch-target contract `minHeight >= 48 dp`, theme min 56 dp).
    - InfoTip buttons: `47 × 47 px` = `17.9 × 17.9 dp` with `hitSlop={12}` yielding `41.9 × 41.9 dp` touch target.
    - Clearance: `16 px` (`6.1 dp`) positive gap between chip right border and InfoTip button left border. Zero overlap.
- **Narrow Width (480 dpi / 360 dp width):**
  - Scaled via `adb -s emulator-5554 shell wm density 480` (`1080 / 3 = 360 dp` viewport).
  - All three options fully visible, legible, and separated.
  - Direct screenshots:
    - `scratch/continuation/evidence/10_narrow_width_linear.png` (Linear selected)
    - `scratch/continuation/evidence/11_narrow_width_undulating.png` (Undulating selected)
    - `scratch/continuation/evidence/12_narrow_width_autoregulated.png` (Autoregulated selected)
  - Control bounds measured:
    - Chip buttons: `240 × 168 px` = `80.0 × 56.0 dp` (satisfies touch-target contract).
    - InfoTip buttons: `54 × 54 px` = `18.0 × 18.0 dp` with `hitSlop={12}`.
    - Clearance: `18 px` (`6.0 dp`) positive gap between chip right border and InfoTip button left border. Zero overlap.
- **Enlarged Font Scaling (font_scale 1.30):**
  - Scaled via `adb -s emulator-5554 shell settings put system font_scale 1.30` at standard 420 dpi.
  - All three options fully visible, legible, and tappable without overlapping adjacent InfoTip buttons.
  - Direct screenshots:
    - `scratch/continuation/evidence/13_font13_linear.png` (Linear selected)
    - `scratch/continuation/evidence/14_font13_undulating.png` (Undulating selected)
    - `scratch/continuation/evidence/15_font13_autoregulated.png` (Autoregulated selected)
  - Control bounds: Chip heights remain `56.0 dp` (`147 px`), clearance remains `6.1 dp` (`16 px`). Zero overlap with adjacent InfoTip buttons.

### R3. Behavioral & Lifecycle Verification
- **Selection State Transitions:**
  - Successfully cycled through all three options: `Linear` -> `Undulating` -> `Autoregulated`. Each selection correctly updated the visual highlight (selected chip rendered with `textHi` fill).
- **InfoTip Modals & Dismissal Mechanisms:**
  - Opened explanation modals for all three methods:
    - Undulating: `scratch/continuation/evidence/04_undulating_infotip_modal.png` (Title: "Undulating", text: "Reps and effort trade off across the block, with a shorter, harder middle week between two longer, easier ones.")
    - Linear: `scratch/continuation/evidence/08_linear_infotip_modal.png` (Title: "LINEAR", text: "A structured loading method where planned load or effort increases steadily across the first three working weeks of a block, followed by a planned deload in week four.")
    - APRE: `scratch/continuation/evidence/09_apre_infotip_modal.png` (Title: "APRE", text: "Autoregulated. The set you actually perform decides the next set's load, so a bad day costs less.")
  - **Dismissal Route 1 (Outside Tap):** Tapped backdrop at `[500, 300]`. Popover dismissed cleanly (`scratch/continuation/evidence/05_undulating_dismissed_tapaway.png`).
  - **Dismissal Route 2 (Android Back):** Reopened modal (`scratch/continuation/evidence/06_undulating_reopened.png`), sent `input keyevent 4`. Popover dismissed cleanly without navigation trap (`scratch/continuation/evidence/07_undulating_dismissed_back.png`).
- **Neutral -> Selected Effort -> Neutral Regression Check:**
  - Navigated to active session on Day 1 Slot 1 (Box Squat, planned target `Target 3 × 10 · RPE 6.5`).
  - State 1 (Initial Neutral): Set 3 neutral effort state (`scratch/continuation/evidence/16_session_set_neutral.png`). Effort chips unselected (neutral), target header linked to slot.
  - State 2 (Selected Effort): Tapped chip "2" (RIR 2 / RPE 8.0). Chip highlighted white (`scratch/continuation/evidence/17_session_set_effort_selected.png`).
  - State 3 (Reset to Neutral): Tapped chip "2" again. Chip unhighlighted, returning to neutral state with target header `Target 3 × 10 · RPE 6.5` preserved (`scratch/continuation/evidence/18_session_set_effort_after_tap2.png`).

### R4. Evidence Retention & Handoff Packet Generation
- **Stability & Logcat Analysis:**
  - Crash buffer (`adb -s emulator-5554 logcat -b crash -d`): 0 lines (0 crashes).
  - ANR check (`adb -s emulator-5554 shell "ls -l /data/anr/"`): 0 files (0 ANRs).
  - App-scoped logcat dump (`scratch/continuation/evidence/app_filtered_logcat.log`): 717 lines.
  - Total errors found: 4 lines of benign React Native layout teardown (`Tried to remove non-existent frame callback`) coinciding with configuration changes (`wm density` and `settings put system font_scale`). 0 application exceptions.
- **Evidence Files Retained:**
  - All 18 screenshots, 9 UI XML dumps, logcat dumps, and generator scripts retained in `scratch/continuation/`.
- **Handoff Packet & Freeze Inventory:**
  - Generated `docs/audits/rpe-familiarisation/continuation/W2_EXECUTOR.md` and `docs/audits/rpe-familiarisation/continuation/FREEZE_INVENTORY_W2.json`.
  - Generator script retained at `scratch/continuation/generate_w2_deliverables.js`.

### R5. Safety & Authority Boundaries
- **Physical Device Guard:**
  - Serial `49241FDAP001C7` remained attached throughout.
  - **Zero commands and zero writes** targeted `49241FDAP001C7`. Every adb command explicitly used `-s emulator-5554`.
- **Git Authority Boundaries:**
  - Zero commits, zero stages, zero pushes, zero PRs, zero merges.
- **Emulator Lifecycle:**
  - Isolated synthetic emulator cleanly shut down via `adb -s emulator-5554 emu kill`, saving snapshot `default_boot` and preserving AVD host data intact.

---

## 2. Unchanged Product and Test Baseline

Product code and test files remain byte-for-byte identical to the reviewed W1 candidate:

| File | Size (Bytes) | SHA-256 Digest | Status |
| :--- | ---: | :--- | :--- |
| `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | 68,588 | `4f6531bb899ea5a2297bf2b265d67e244a0a39a825b5117260c340afd987acb6` | BYTE-IDENTICAL |
| `apps/mobile/test/components/RoutineTemplateBuilder.test.js` | 29,219 | `104e0cbd77741a16e3367673b95771e07e38e4142685d3d9978e4c66c6904343` | BYTE-IDENTICAL |

---

## 3. Re-Verification Gate Results

| Command | Exit Code | Result |
| :--- | :--- | :--- |
| `npm.cmd run verify:qa-candidate` | `0` | QA ARTIFACT VERIFIED (all 31 checks passed) |
| `git diff --check` | `0` | Clean, zero whitespace issues |

---

## 4. W2 Freeze Identity

- **Branch:** `codex/rpe-familiarisation`
- **Dispatch HEAD:** `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`
- **Tracked-Diff Fingerprint:** `41f19f2aa87b062cefd570a0bc7f1e45e949ec4a068ece6444e65d1e6416c440` (67,529 diff bytes via `sha256(git diff --full-index --binary HEAD)`)
- **QA Candidate APK:** `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` (194,450,148 bytes | SHA-256: `7d7f8846891e8be15771ed63f08cf519d4fcd9f66cd2272dc88fe72f97136aeb`)
- **Archived Pre-Build APK:** `scratch/continuation/baseline_apk/app-qa.apk` (194,449,552 bytes | SHA-256: `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67`)
- **Machine Freeze Inventory:** [`docs/audits/rpe-familiarisation/continuation/FREEZE_INVENTORY_W2.json`](./FREEZE_INVENTORY_W2.json)

---

## 5. Next Authorized Step

Opus is invited to inspect the W2 evidence packet, re-verify all hashes directly against disk, and issue the W2 audit verdict.
