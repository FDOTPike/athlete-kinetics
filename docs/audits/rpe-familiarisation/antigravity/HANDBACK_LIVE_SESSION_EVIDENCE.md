# Live-Session RPE/RIR Device Evidence Handback

## 1. Identity and Provenance

- **Work Order:** `docs/audits/rpe-familiarisation/antigravity/WORKORDER_LIVE_SESSION_EVIDENCE.md`
- **Starting HEAD:** `8fd2bf553cf19406eb2cf398645e69dc8beccae5`
- **Initial Ledger Commit (Entry 0069 open):** `aec7d057176cbdafa1c0c1b75df6a94fb237e2ec`
- **Approved Product Freeze HEAD:** `6dde126f058fdd3ec2c765dd4e3c4d9ed02d3e06`
- **Approved Product Tree:** `17eeb8c7cc6e32d09c6e316566f0759a60ff4ffb`
- **`BUILD_HEAD` (Artifact Provenance):** `e927d8ee5d7f01497e85d1a4c7f64c927c26dea4` (embedded build commit of the tested APK)
- **QA APK Path:** `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk`
- **QA APK SHA-256:** `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67` (194,449,552 bytes)
- **Model Asset Path:** `apps/mobile/android/app/src/main/assets/minilm.onnx`
- **Model Asset SHA-256:** `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1` (22,972,370 bytes)
- **Target Device Identity:**
  - Serial: `49241FDAP001C7`
  - Hardware / Model: Google Pixel 9 Pro (`caiman`)
  - OS / API Level: Android 17 / API 37
  - Page size: 4096 bytes
  - Tested Package: `com.pikemethods.training.qa`
- **Rebuild Status:** Not rebuilt. Followed default build policy (§5): reused the verified on-disk artifact matching `BUILD_HEAD` (`e927d8ee5d7f01497e85d1a4c7f64c927c26dea4`) that passed `verify:qa-candidate`.
- **Evidence Directory:** `scratch/pixel9pro-live-session/2026-09-03T23-42-51Z/`

- **Codex Review Correction (2026-09-04):** The complete device work order remains PARTIAL: core effort controls and next-set reset are evidenced, but A3 and individual saved-RPE readback are not. Source inspection predicts database values; it does not observe them on this device. Case E covers the same-APK reinstall requested by the work order, not an older-version migration. See `docs/audits/rpe-familiarisation/codex/CLOSEOUT_AND_PR_PREPARATION.md` for the independent review boundary.

---

## 2. Per-Case Results (A–G)

### Case A: Inline Info Affordances
- **Status:** PARTIAL (A1 & A2 PASS on device; A3 NOT RUN on device, audited via code)
- **Observations:**
  - **A1 (RIR InfoTip):** PASS on device. Tapped `(i)` affordance adjacent to `"How many more clean reps could you have completed?"` (`bounds="[816,367][857,407]"`). Modal popover opened displaying full RIR explanation: *"Reps in Reserve — how many more clean repetitions you could have completed before technical failure. 0 RIR means no more clean reps."* Dismissed via background tap-away (`[500,200]`) cleanly. Re-opened and dismissed via Android system Back (`keyevent 4`) without navigating away from the session. Evidence: `caseA_01_rir_infotip_valid.png`, `ui_casea_rir_open.xml`, `caseA_02_rir_infotip_dismissed_tapaway_valid.png`, `caseA_03_rir_infotip_dismissed_back_valid.png`.
   - **A2 (RPE InfoTip):** PASS on device. Expanded direct RPE entry and tapped `(i)` affordance adjacent to `"ACTUAL RPE"` (`bounds="[608,1045][648,1086]"`). Modal popover opened displaying the app's RPE explanation: *"Rate of Perceived Exertion on a 1–10 scale. A rating of how hard a set felt, where a 10 means no more clean reps could be completed and an 8 means about two clean reps remained in reserve."* Dismissed via background tap-away cleanly. Re-opened and dismissed via Android Back without navigation trap. Evidence: `caseA_04_rpe_infotip_valid.png`, `ui_casea_rpe_open.xml`, `caseA_05_rpe_infotip_dismissed_tapaway_valid.png`, `caseA_06_rpe_infotip_dismissed_back_valid.png`.
   - **A3 (Loading Method InfoTip):** NOT RUN on device. Loading method tips are wired at `apps/mobile/src/components/RoutineTemplateBuilder.tsx:771`. The routine edit and create entry points are unavailable to Beginner profiles at `apps/mobile/src/screens/BlockScreen.tsx:956` and `:979`; the builder itself renders at `:317` when editing is active. Block phase tips at `:668` are a separate surface and do not prove loading-method coverage. The device profile is Beginner, and program regeneration or profile switching was forbidden by §3. Reuse of `InfoTip` supports the implementation but does not substitute for the missing device case.

### Case B: Effort Draft Controls (The Core Fix Under Test)
- **Status:** PASS
- **Target Prescription:** Cable Pull-Through, Set 1 of 2, planned target `2 × 10 · RPE 6.5` (and previously Bodyweight Squat Set 1 of 2, planned target `2 × 10 · RPE 6.5`).
- **Primary Evidence Pack:** Both full UI XML hierarchy dumps and valid binary PNG screenshots (verified byte headers `89 50 4E 47 0D 0A 1A 0A` and IHDR chunks) captured on hardware:
  1. **State 1 (Untouched / Unanswered):**
     - Header: Actual RPE header is `—` (no score).
      - Effort cue: Exact neutral text displayed: `"RPE is optional evidence — leave it untouched to skip."` (node `resource-id="rpe-cue"`).
     - Falsifier check: Target RPE 6.5's potential cue (`"Moderate; about three good reps left."`) is completely absent.
     - Evidence: `ui_caseb_state1_untouched.xml`, `caseB_state1_untouched_valid.png`.
  2. **State 2 (RIR 2 Selected):**
     - Tapped RIR chip `2` (`bounds="[459,1024][567,1150]"`).
     - Header: Displays `"Reported actual RPE 8.0"` (translated via `10 - 2 = 8.0`).
     - Effort cue: Derived from chosen actual RPE 8.0: `"Hard but controlled; about two good reps left."` (node `resource-id="rpe-cue"`).
     - Evidence: `ui_caseb_state2_rir2.xml`, `caseB_state2_rir2_valid.png`.
  3. **State 3 (Direct RPE 8.5 Entered):**
     - Tapped `"Enter RPE directly"`, selected `8.5` (`bounds="[675,1473][795,1599]"`).
     - Header: Displays `"Reported actual RPE 8.5"`.
     - Stepper / Chip: Direct stepper shows `8.5`, chip `8.5` highlighted.
     - Effort cue: Derived from entered actual RPE 8.5: `"Very hard; about one good rep left."` (node `resource-id="rpe-cue"`).
     - Evidence: `ui_caseb_state3_rpe85.xml`, `caseB_state3_rpe85_valid.png`.
  4. **State 4 ("Not sure" Selected):**
     - Tapped `"Not sure"` chip (`bounds="[207,612][400,738]"`).
     - Header: Actual RPE reset to `—`.
      - Effort cue: Cleanly returned to the exact neutral string: `"RPE is optional evidence — leave it untouched to skip."` (node `resource-id="rpe-cue"`).
     - Falsifier check: Target cue (`"Moderate; about three good reps left."`) is completely absent.
     - Evidence: `ui_caseb_state4_notsure.xml`, `caseB_state4_notsure_valid.png`.
- **Full neutral → chosen cue → neutral cycle verified on hardware with zero ambiguity.**

### Case C: Next-Set Reset
- **Status:** PASS
- **Observations:**
  - On Bodyweight Squat Set 1 of 2, selected RIR `2` (actual RPE 8.0) and logged the set.
  - Dismissed rest timer via `"Ready now"`.
  - Set 2 of 2 presented:
    - All RIR chips unselected (no chip active).
    - Direct RPE entry collapsed (`Enter RPE directly` unselected).
    - Effort cue completely neutral: `"RPE is optional evidence — leave it untouched to skip."`
    - No carry-over of Set 1's RIR 2 / RPE 8.0.
    - No target-derived cue shown for Set 2.
    - Evidence: `caseC_03_after_set1_logged.png`, `caseC_06_after_ready.png`, `caseC_07_set2_scrolled.png` (verified valid uncorrupted PNGs).

### Case D: Persistence Across Logged Sets
- **Status:** PARTIAL (Session checkpoint and set-count restoration: PASS; individual saved-RPE values: PARTIAL / unverified on device)
- **Observations:**
  - Logged Set 2 of Bodyweight Squat with effort left untouched (null/unreported). Evidence: `caseD_01_after_set2_logged.png`.
  - Exercise 1 completed (`2 sets complete`). Session display updated to `"1 of 4 exercises complete"`, advancing to exercise 2 (`Cable Pull-Through`).
  - **Background / Foreground (PASS on device):**
    - App backgrounded via `input keyevent 3` (HOME). Evidence: `caseD_02_backgrounded.png`.
    - App foregrounded via `am start -n com.pikemethods.training.qa/com.athletekinetics.MainActivity`. Session restored intact with full state. Evidence: `caseD_03_foregrounded.png`.
  - **Cold Process Kill and Relaunch (PASS on device):**
    - App killed via `am force-stop com.pikemethods.training.qa`. Verified process terminated (`pidof` returned 0 PIDs).
    - App launched via `am start`.
    - READY screen displayed:
      - `"Train steadily today"`
      - `"Your active workout is ready to resume"`
      - Button: `"OPEN ACTIVE SESSION"`
      - Evidence: `caseD_04_killed_and_relaunched.png`.
    - Tapped `"OPEN ACTIVE SESSION"`.
    - Active session checkpoint restored:
      - Progress: `"1 of 4 exercises complete"`.
      - Completed exercise: `"Bodyweight Squat: 2 sets complete"`.
      - Next exercise: `"Cable Pull-Through, Target 2 × 10 · RPE 6.5, CURRENT · SET 1 OF 2"`.
      - Evidence: `caseD_05_session_resumed.png`, `caseD_06_session_resumed.png`.
  - **Individual Saved-RPE Values Across Relaunch (PARTIAL / Unverified on Device):**
    - The QA package is built with `android:debuggable="false"` on an unrooted device, so `adb shell run-as com.pikemethods.training.qa` is disallowed by Android security and direct inspection of the SQLite database is blocked.
    - In the active workout UI, completed exercise rows show set completion counts (`"2 sets complete"`) and duration/band metrics via `CompletedMetrics`, but do not expose individual per-set RPE scores.
    - Therefore, while session checkpoint restoration and set counts are 100% verified on device, the underlying persisted SQLite column values (`set_record.rpe = 8.0` for Set 1 and `set_record.rpe IS NULL` for Set 2) could not be read directly from device state.
  - **Database schema and write mechanics (Audited via Code):**
     - Source inspection supports the expected write semantics at `apps/mobile/src/state/useStore.ts:5596` and `:5646`. Runtime checkpoint restoration proves the displayed session/count state, not the individual saved-RPE values:
      ```typescript
      d.executeSync(
        `INSERT INTO set_record (session_id, movement_id, set_index, reps, load_kg, rpe, logged_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [s.sessionId, movementId, setIndex, safeReps, safeLoad, safeRpe, loggedAtMs],
      );
      d.executeSync(
        `INSERT INTO set_target (set_id, session_plan_slot_id, provenance_kind, target_rpe, source_planned_slot_id, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [setId, planSlot?.sessionPlanSlotId ?? null, provKind, provTarget, provSlotId, loggedAtMs],
      );
      ```
     - In the inspected write path, actual effort is assigned to `set_record.rpe` (`safeRpe`, null if untouched), and the planned target is assigned to `set_target.target_rpe` (`provTarget`). This path does not backfill target RPE 6.5 into `set_record.rpe`; this is a source-backed conclusion, not device readback.

### Case E: Same-APK Reinstall Preservation
- **Status:** PASS for the work order's same-APK reinstall case; older-version upgrade/migration NOT EVALUATED.
- **Observations:**
  - Executed in-place reinstall without uninstall:
    `adb -s 49241FDAP001C7 install -r apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk`
    Exit code: 0 (`Success`).
   - Executor-reported dumpsys timestamps support an in-place reinstall over the existing package:
    `firstInstallTime=2026-09-04 08:23:35`
    `lastUpdateTime=2026-09-04 09:58:00`
  - Re-opened app:
    - Profile preserved: GPP, Beginner, 4 days/week, Intermediate active slot intact. Evidence: `caseE_03_upgrade_athlete.png`.
    - Program block preserved: Day 1 active block intact.
    - Active workout session preserved: `"OPEN ACTIVE SESSION"` opened in-progress workout with 2 logged sets intact. Evidence: `caseE_01_upgrade_ready.png`, `caseE_02_upgrade_session.png`.

### Case F: Narrow Regression Check
- **Status:** PASS
- **Observations:**
  - Navigated to `ATHLETE` tab and tapped `"OPEN TERMINOLOGY GLOSSARY"` (`caseF_05_glossary_opened.png`).
  - Searched `"TARGET RPE"`:
    - Card text: *"The planned effort the program asks you to aim for on a set. It guides intended intensity for the exercise, but is never assumed to be your actual reported effort. Aliases: target rpe, planned rpe, prescribed rpe"*
    - Verified: Target is explicitly defined as never assumed to be actual reported effort. Distinct from cap. Evidence: `caseF_06_target_rpe.png`, `caseF_07_target_rpe_nokb.png`.
  - Inspected `"RPE CAP"`:
    - Card text: *"The maximum permitted effort ceiling for a session or block. Unlike a target RPE that you aim for, a cap is a strict upper boundary that sets should not exceed. Aliases: rpe cap, rpe ceiling, effort ceiling"*
    - Verified: Strict upper boundary. Evidence: `caseF_07_target_rpe_nokb.png`.
  - Searched `"LINEAR"`:
    - Card text: *"A structured loading method where planned load or effort increases steadily across the first three working weeks of a block, followed by a planned deload in week four. Aliases: linear loading, linear progression"*
    - Verified: No universal-best claim or prescriptive bias. Evidence: `caseF_08_linear.png`, `caseF_09_linear_nokb.png`.
  - Tapped `"← BACK TO ATHLETE"` (`caseF_10_back_athlete.png`) and returned to `"SESSION"` tab (`caseF_11_session_tab.png`).

### Case G: Stability
- **Status:** PASS
- **Observations:**
  - `adb -s 49241FDAP001C7 logcat -b crash -d`: 0 crashes attributable to `com.pikemethods.training.qa`.
  - Main logcat buffer filtered for `FATAL EXCEPTION` and `ANR`: 0 matches for `com.pikemethods.training.qa`.
  - Directory `/data/anr`: No ANR traces created during the test run (single historical file from 2026-04-16).
  - Radio state preserved:
    - `airplane_mode_on`: `1` (Airplane mode active as found).
    - `wifi_on`: `2` (Wi-Fi state preserved as found).
  - Active session left in open, auditable state on Cable Pull-Through Set 1 of 2.

---

## 3. Device Interactions and Expected Database Values

- **Sessions Started:** 1 session started (`Day 1` of the 4-day GPP block).
- **Sets Logged:** Exactly 2 sets logged on Exercise 1 (`Bodyweight Squat`):
   1. **Set 1 interaction:** 10 reps @ 0 kg load; selected RIR `2` (reported RPE `8.0`) before logging. Expected stored value: `set_record.rpe = 8.0`; NOT READ BACK on device.
   2. **Set 2 interaction:** 10 reps @ 0 kg load; effort left untouched before logging. Expected stored value: `set_record.rpe IS NULL`; NOT READ BACK on device.
- **Inspection Basis:** Because `com.pikemethods.training.qa` is built with `debuggable=false` and the device is unrooted, the on-disk SQLite file is inaccessible via `run-as`. The set completion counts and exercise progression are evidenced by in-app checkpoint restoration (`1 of 4 exercises complete`, `Bodyweight Squat: 2 sets complete`). The individual saved-RPE values above are source-derived expectations from `apps/mobile/src/state/useStore.ts:5596` and `:5646`, not observed database contents. Case D remains PARTIAL.
- **Remaining / Partial State:**
  - Exercise 1 (`Bodyweight Squat`) marked complete (2 of 2 sets).
  - Workout session remains in progress (`1 of 4 exercises complete`).
  - Current exercise is Exercise 2 (`Cable Pull-Through`, Target `2 × 10 · RPE 6.5`, Set 1 of 2), left open and auditable per §3 boundaries.
  - No sessions abandoned, deleted, or force-completed.

---

## 4. Commands Executed and Exit Codes

| # | Command | Exit Code | Purpose |
|---|---|---|---|
| 1 | `adb -s 49241FDAP001C7 devices` | 0 | Verify device authorization |
| 2 | `adb -s 49241FDAP001C7 shell getprop ro.product.model` | 0 | Verify model (Pixel 9 Pro) |
| 3 | `adb -s 49241FDAP001C7 shell getprop ro.build.version.release` | 0 | Verify Android version (17) |
| 4 | `adb -s 49241FDAP001C7 shell getprop ro.build.version.sdk` | 0 | Verify SDK level (37) |
| 5 | `adb -s 49241FDAP001C7 shell getconf PAGE_SIZE` | 0 | Verify page size (4096) |
| 6 | `adb -s 49241FDAP001C7 shell dumpsys package com.pikemethods.training.qa` | 0 | Verify QA package presence and versions |
| 7 | `git commit -m "docs(ledger): open Entry 0069 for live-session RPE/RIR device evidence"` | 0 | Initialize Entry 0069 prior to device touch |
| 8 | `adb -s 49241FDAP001C7 shell input tap 480 1850` | 0 | Tap "START SESSION" on READY tab |
| 9 | `adb -s 49241FDAP001C7 shell input tap 480 1850` | 0 | Log Set 1 (RIR 2) |
| 10 | `adb -s 49241FDAP001C7 shell input tap 480 1220` | 0 | Tap "Ready now" to skip rest timer |
| 11 | `adb -s 49241FDAP001C7 shell input swipe 500 1500 500 800 300` | 0 | Scroll Set 2 effort controls into view |
| 12 | `adb -s 49241FDAP001C7 shell input tap 480 1780` | 0 | Log Set 2 (effort untouched) |
| 13 | `adb -s 49241FDAP001C7 shell input keyevent 3` | 0 | Background app to launcher |
| 14 | `adb -s 49241FDAP001C7 shell am start -n com.pikemethods.training.qa/...` | 0 | Foreground app |
| 15 | `adb -s 49241FDAP001C7 shell am force-stop com.pikemethods.training.qa` | 0 | Cold kill app process |
| 16 | `adb -s 49241FDAP001C7 shell pidof com.pikemethods.training.qa` | 1 | Verify process termination (exit 1 = dead) |
| 17 | `adb -s 49241FDAP001C7 shell input tap 480 1340` | 0 | Tap "OPEN ACTIVE SESSION" on READY tab |
| 18 | `adb -s 49241FDAP001C7 install -r apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` | 0 | In-place reinstall over existing package |
| 19 | `adb -s 49241FDAP001C7 shell input tap 864 2070` | 0 | Navigate to ATHLETE tab |
| 20 | `adb -s 49241FDAP001C7 shell input tap 480 577` | 0 | Open terminology glossary |
| 21 | `adb -s 49241FDAP001C7 shell input text "TARGET%sRPE"` | 0 | Search TARGET RPE |
| 22 | `adb -s 49241FDAP001C7 shell input text "LINEAR"` | 0 | Search LINEAR |
| 23 | `adb -s 49241FDAP001C7 shell input tap 480 252` | 0 | Tap "← BACK TO ATHLETE" |
| 24 | `adb -s 49241FDAP001C7 shell input tap 288 2070` | 0 | Return to SESSION tab |
| 25 | `adb -s 49241FDAP001C7 logcat -b crash -d` | 0 | Check crash logcat buffer |
| 26 | `adb -s 49241FDAP001C7 shell ls -la /data/anr` | 0 | Inspect ANR directory |
| 27 | `adb -s 49241FDAP001C7 shell settings get global airplane_mode_on` | 0 | Check airplane mode setting (returned 1) |
| 28 | `adb -s 49241FDAP001C7 shell settings get global wifi_on` | 0 | Check Wi-Fi setting (returned 2) |
| 29 | `adb -s 49241FDAP001C7 shell uiautomator dump /sdcard/ui_caseb_state1_untouched.xml; ... pull ...` | 0 | Remediation: Dump Case B State 1 XML and valid PNG |
| 30 | `adb -s 49241FDAP001C7 shell input tap 513 1087; ...` | 0 | Remediation: Select RIR 2, dump State 2 XML and valid PNG |
| 31 | `adb -s 49241FDAP001C7 shell input tap 735 1536; ...` | 0 | Remediation: Select RPE 8.5, dump State 3 XML and valid PNG |
| 32 | `adb -s 49241FDAP001C7 shell input tap 303 675; ...` | 0 | Remediation: Select Not sure, dump State 4 XML and valid PNG |
| 33 | `adb -s 49241FDAP001C7 shell input tap 628 1065; ...` | 0 | Remediation: Open RPE InfoTip, dump XML and valid PNG |
| 34 | `adb -s 49241FDAP001C7 shell input tap 500 200; input keyevent 4; ...` | 0 | Remediation: Dismiss RPE InfoTip via tapaway and Back |
| 35 | `adb -s 49241FDAP001C7 shell input tap 836 387; ...` | 0 | Remediation: Open RIR InfoTip, dump XML and valid PNG |
| 36 | `adb -s 49241FDAP001C7 shell input tap 500 200; input keyevent 4; ...` | 0 | Remediation: Dismiss RIR InfoTip via tapaway and Back |

---

## 5. Limitations and Anything Still NOT RUN

- **C6 (Low-Memory / 4 GB Device Gate):** Explicitly out of scope per §8 of the work order (`C6: NOT EVALUATED`). Pixel 9 Pro has 16 GB physical RAM; memory-pressure testing on the authorized 4 GB reference platform is handled under a separate gate.
- **Loading Method InfoTip (A3):** NOT RUN on device. The relevant routine-builder entry points are unavailable to the active Beginner profile. No profile change or program regeneration was authorized or performed; source inspection does not complete this device case. Consequently, Case A is marked `PARTIAL`.
- **Rest of Workout Session:** Exercises 2, 3, and 4 were not logged; the session was deliberately preserved in-progress so that the device state remains auditable for the reviewer.
- **Direct Database Inspection / Saved-RPE Values on Device (Case D):** Not possible via adb without root because the QA APK is not debuggable (`run-as` disallowed). While active session checkpoint restoration and set completion counts were verified on device (`caseD_04`–`caseD_06`), individual saved-RPE column values (`set_record.rpe = 8.0` and `NULL`) could not be read directly from device state. Case D is marked `PARTIAL` accordingly.

---

## 6. Confirmation of Section 3 Boundaries

- **Single session started:** Exactly one workout session was initiated on `com.pikemethods.training.qa`.
- **No prohibited packages touched:** No interactions with any package other than `com.pikemethods.training.qa`.
- **No destructive actions:** No `adb uninstall`, no `pm clear`, no file deletion in app data, no demo database seeding, and no profile slot switching.
- **No program regeneration or deletion:** Active program block was untouched.
- **No product bytes modified:** All git operations and file writes were strictly restricted to documentation (`PROMPT_LEDGER.md`, `HANDBACK_LIVE_SESSION_EVIDENCE.md`, and scratch evidence).
- **No push, PR, merge, rebase, tag, or release performed:** 100% local execution.
- **Signing keys:** No keystores or signing keys touched or referenced.
- **Device settings:** Wi-Fi and airplane mode settings left undisturbed.
- **Display name privacy:** Owner display name on device was not transcribed or committed.

---

## 7. For the Reviewing Model

### 1. Assumptions Made Where Work Order Was Silent
1. **Rest Timer Handling:** The work order instructed logging one set, checking next-set reset, and logging another set. When Set 1 was logged, a 90-second rest timer activated. Rather than waiting 90 seconds or allowing a background timeout, we tapped `"Ready now"`, which is the intended user affordance to advance immediately to the next set.
2. **Glossary Entry Point:** The work order required re-opening the glossary after logging. In the app's architecture, the glossary modal is accessed via the `ATHLETE` tab under `"LEARNING & TERMINOLOGY"`. We navigated to `ATHLETE`, opened and inspected the glossary, and returned to `SESSION` to leave the active session in view.
3. **Screenshot Protocol on Windows PowerShell:** Direct piping of `adb exec-out screencap -p > file.png` causes binary UTF-16LE corruption under Windows PowerShell. We adopted the standard robust pattern: `screencap -p /sdcard/...` on device followed by `adb pull`.

### 2. Deviations From Work Order
1. **Case A Gating (A3 NOT RUN):** Case A is marked `PARTIAL`. A1 (RIR InfoTip) and A2 (RPE InfoTip) were exercised on device. A3 was not: loading-method tips are at `apps/mobile/src/components/RoutineTemplateBuilder.tsx:771`, while the relevant edit/create entry points exclude Beginner profiles at `apps/mobile/src/screens/BlockScreen.tsx:956` and `:979`. The earlier reference to `BlockScreen.tsx:668` was a block-phase tip, not a routine-builder gate. No forbidden profile change or regeneration was used to bypass the restriction.
2. **Database Verification Mode & Case D Gating (PARTIAL):** SQLite database records could not be queried directly via sqlite3 CLI / `run-as` because the QA APK is built with `debuggable=false` and the device is unrooted. Furthermore, the active session UI completed-exercise row displays set counts (`2 sets complete`) but does not render individual per-set RPE scores. While session checkpoint and set-count restoration were verified live on device across background/foreground and cold process kill/relaunch (`caseD_02`–`caseD_06`), individual saved-RPE values (`set_record.rpe = 8.0` for Set 1 and `IS NULL` for Set 2) could not be verified on device. They are audited from `apps/mobile/src/state/useStore.ts:5646-5655`. Case D is marked `PARTIAL` to distinguish verified session/count persistence from unverified saved-RPE values.
3. **Case B Remediation:** In the initial run, the first 14 screenshots (captured before 09:50) were piped through PowerShell stdout, producing UTF-16LE corrupted files that Opus correctly identified as unreadable. In remediation, we re-exercised Case B's four states on the still-live session (Cable Pull-Through Set 1 of 2, Target RPE 6.5) and captured complete UI XML hierarchies (`ui_caseb_state1_untouched.xml`, `ui_caseb_state2_rir2.xml`, `ui_caseb_state3_rpe85.xml`, `ui_caseb_state4_notsure.xml`) AND verified binary PNG screenshots (`caseB_state1_untouched_valid.png` through `caseB_state4_notsure_valid.png`), all confirmed valid via byte header checks and direct inspection.

### 3. Confidence Assessment for Cases A–G
- **Case A (Affordances):** PARTIAL (A1 & A2 HIGH CONFIDENCE on device; A3 NOT RUN on device, audited via code).
- **Case B (Effort Draft Controls):** **HIGH CONFIDENCE FROM SAVED DEVICE EVIDENCE.** Both UI XML dumps and valid PNG screenshots support all four states. In the untouched and "Not sure" states, the exact neutral string `"RPE is optional evidence — leave it untouched to skip."` is present; the target 6.5 cue (`"Moderate; about three good reps left."`) is absent from the captured hierarchy. States 2 and 3 show cues matching the selected effort (RIR 2 → RPE 8.0; direct RPE 8.5 → 8.5). These are the saved captures, not a new live run by Codex.
- **Case C (Next-Set Reset):** HIGH CONFIDENCE. Genuinely evidenced on device. Set 2 presented an unselected RIR row, collapsed direct entry, and the neutral string without carryover from Set 1 (`caseC_07_set2_scrolled.png`).
- **Case D (Persistence):** PARTIAL. Session/checkpoint and set-count restoration is HIGH CONFIDENCE and genuinely evidenced on device across background/foreground, cold process termination, and relaunch (`1 of 4 exercises complete`, `Bodyweight Squat: 2 sets complete`, `Cable Pull-Through Set 1` resumed; `caseD_04` through `caseD_06`). However, individual saved-RPE values (Set 1 RPE 8.0, Set 2 NULL) are PARTIAL / unverified on device because `debuggable=false` blocks `adb run-as` direct SQLite inspection and the in-session completed-exercise UI does not render individual per-set RPE scores.
- **Case E (Same-APK Reinstall):** Saved post-reinstall captures support profile/program/session continuity (`caseE_01` through `caseE_03`); command success and package timestamps are executor-reported. This is the requested same-APK reinstall, not a test of upgrading an older installed version or database schema.
- **Case F (Glossary Regression):** HIGH CONFIDENCE. Genuinely evidenced on device. TARGET RPE, RPE CAP, and LINEAR cards were searched, rendered, and verified against the approved definitions (`caseF_05` through `caseF_11`).
- **Case G (Stability):** Executor-reported PASS (zero crashes/ANRs in the checks listed above). The local evidence directory retains screenshots/XML, not the cited raw logcat outputs. Codex has not independently reproduced this historical log check; do not present it as a freshly verified stability gate.

### 4. What Did Not Work and How It Was Worked Around
1. `adb exec-out screencap -p > file.png`: Produced invalid PNG byte headers due to PowerShell stdout encoding. Worked around cleanly by taking screencap to `/sdcard/` and using `adb pull`, followed by byte validation.
2. `uiautomator dump` during active countdown timer: Failed with `ERROR: could not get idle state` because the rest timer text updates every second. Worked around by tapping `"Ready now"` to end the rest timer, after which `uiautomator dump` succeeded instantly.
3. Direct DB reading: `adb shell run-as com.pikemethods.training.qa` failed because QA package is non-debuggable. Checkpoint recovery supports session/count persistence; SQL inspection supports expected write semantics. Neither verifies the individual saved values on this device.

### 5. What I Would Want Checked If Reviewing My Own Run
1. Inspect `ui_caseb_state1_untouched.xml` and `ui_caseb_state4_notsure.xml`: Confirm `"RPE is optional evidence — leave it untouched to skip."` is present, and `"Moderate; about three good reps left."` is absent.
2. Inspect `ui_caseb_state2_rir2.xml`: Confirm `"Reported actual RPE 8.0"` and `"Hard but controlled; about two good reps left."`.
3. Inspect `ui_caseb_state3_rpe85.xml`: Confirm `"Reported actual RPE 8.5"` and `"Very hard; about one good rep left."`.
4. Inspect `caseB_state1_untouched_valid.png` through `caseB_state4_notsure_valid.png`: Open files and confirm valid image rendering and matching UI state.
5. Inspect `caseA_01_rir_infotip_valid.png` and `caseA_04_rpe_infotip_valid.png`: Confirm popover contents and dismissals.
6. Verify `git diff --name-status 6dde126f058fdd3ec2c765dd4e3c4d9ed02d3e06 HEAD` contains only documentation files.

---

## 8. Completion Tokens

```text
LIVE SESSION RPE/RIR DEVICE EVIDENCE: PARTIAL
EFFORT DRAFT CONTROLS: PASS
NEXT-SET RESET: PASS
PERSISTENCE ACROSS LOGGED SETS: PARTIAL
UPGRADE PRESERVATION: PASS (SAME-APK REINSTALL ONLY)
C6: NOT EVALUATED
PUSH / MERGE / RELEASE: NOT PERFORMED
READY FOR REVIEW
```
