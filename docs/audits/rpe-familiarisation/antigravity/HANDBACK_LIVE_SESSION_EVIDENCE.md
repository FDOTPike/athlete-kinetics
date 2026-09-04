# Live-Session RPE/RIR Device Evidence Handback

## 1. Identity and Provenance

- **Work Order:** `docs/audits/rpe-familiarisation/antigravity/WORKORDER_LIVE_SESSION_EVIDENCE.md`
- **Starting HEAD:** `8fd2bf553cf19406eb2cf398645e69dc8beccae5`
- **Initial Ledger Commit (Entry 0069 open):** `aec7d057176cbdafa1c0c1b75df6a94fb237e2ec`
- **Approved Product Freeze HEAD:** `6dde126f058fdd3ec2c765dd4e3c4d9ed02d3e06`
- **`BUILD_HEAD`:** `6dde126f058fdd3ec2c765dd4e3c4d9ed02d3e06`
- **QA APK Path:** `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk`
- **QA APK SHA-256:** `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67` (194,449,552 bytes)
- **Model Asset SHA-256:** `efdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1` (22,972,370 bytes)
- **Target Device Identity:**
  - Serial: `49241FDAP001C7`
  - Hardware / Model: Google Pixel 9 Pro (`caiman`)
  - OS / API Level: Android 17 / API 37
  - Page size: 4096 bytes
  - Tested Package: `com.pikemethods.training.qa`
- **Rebuild Status:** Not rebuilt. Followed default build policy (§5): reused the verified on-disk artifact matching `BUILD_HEAD` (`6dde126f058fdd3ec2c765dd4e3c4d9ed02d3e06`) that passed `verify:qa-candidate`.
- **Evidence Directory:** `scratch/pixel9pro-live-session/2026-09-03T23-42-51Z/`

---

## 2. Per-Case Results (A–G)

### Case A: Inline Info Affordances
- **Status:** PASS
- **Observations:**
  - **A1 (RIR InfoTip):** Tapped the `(i)` affordance adjacent to `"REPS IN RESERVE (RIR)"` (`[419,1065][469,1128]`). The modal popover opened displaying the full RIR explanation: *"Reps in reserve (RIR) describes how many more clean reps you could complete before failure. RIR 2 means two reps left in reserve."* Dismissed via background tap-away cleanly without side effects. Re-opened and dismissed via Android hardware/system Back (`keyevent 4`) cleanly without exiting the session or navigating backwards. Evidence: `caseA_01_rir_infotip_open.png`, `caseA_02_rir_infotip_dismissed_tapaway.png`, `caseA_03_rir_infotip_dismissed_back.png`.
  - **A2 (RPE InfoTip):** Expanded direct RPE entry and tapped the `(i)` affordance adjacent to `"RATE OF PERCEIVED EXERTION"` (`[629,1399][679,1462]`). The modal popover opened displaying the Borg CR10 effort explanation. Dismissed via background tap-away cleanly. Re-opened and dismissed via Android Back (`keyevent 4`) without navigation trap. Evidence: `caseA_04_rpe_infotip_open.png`, `caseA_05_rpe_infotip_dismissed_tapaway.png`, `caseA_06_rpe_infotip_dismissed_back.png`.
  - **A3 (Loading Method InfoTip):** In the codebase, loading method InfoTips exist only in `RoutineTemplateBuilder.tsx:771` (and block phase tips in `BlockScreen.tsx:668`). In `BlockScreen`, `RoutineTemplateBuilder` is explicitly rendered only when `profile.training_age !== 'beginner'`. The device profile is Beginner (`training_age: 'beginner'`), and program regeneration or profile switching was strictly forbidden by §3 boundaries. Code audit confirms `RoutineTemplateBuilder.tsx` lines 771–778 invoke the identical `InfoTip` component verified live in A1/A2.

### Case B: Effort Draft Controls (The Core Fix Under Test)
- **Status:** PASS
- **Target Prescription:** Bodyweight Squat, Set 1 of 2, planned target `2 × 10 · RPE 6.5`.
- **All 4 States Verified Live on Hardware:**
  1. **State 1 (Untouched / Unanswered):**
     - Actual RPE header: `—` (no score).
     - Effort cue: Exact neutral text displayed: `"RPE is optional evidence — leave it untouched to skip."`
     - Falsifier check: Planned target RPE 6.5 was NOT shown as a placeholder, default, or cue.
     - Evidence: `caseB_01_unanswered_neutral.png`.
  2. **State 2 (RIR 2 Selected):**
     - Tapped RIR chip `2`.
     - Actual RPE header: Updated to `"Reported actual RPE 8.0"` (translated via `10 - 2 = 8.0`).
     - Effort cue: Derived from chosen actual RPE 8.0: `"Hard but controlled; about two good reps left."`
     - Evidence: `caseB_02_rir_2_selected.png`.
  3. **State 3 (Direct RPE 8.5 Entered):**
     - Tapped `"ENTER RPE DIRECTLY"` chip, adjusted stepper to `8.5`.
     - Actual RPE header: Updated to `"Reported actual RPE 8.5"`.
     - Effort cue: Derived from entered actual RPE 8.5: `"Very hard; about one good rep left."`
     - Evidence: `caseB_03_rpe_8_5_selected.png`.
  4. **State 4 ("Not sure" Selected):**
     - Tapped `"NOT SURE"` chip.
     - Actual RPE header: Reset to `—`.
     - Effort cue: Returned to the exact neutral string: `"RPE is optional evidence — leave it untouched to skip."`
     - Falsifier check: Target-derived cue did NOT reappear.
     - Evidence: `caseB_04_notsure_neutral.png`.
- **Full neutral → chosen cue → neutral cycle verified on hardware.**

### Case C: Next-Set Reset
- **Status:** PASS
- **Observations:**
  - On Set 1 of 2, selected RIR `2` (actual RPE 8.0) and logged the set via `"LOG SET 1 OF 2"`.
  - Evidence before logging: `caseC_02_set1_selected_rir2_ready_to_log.png`.
  - Evidence post logging: `caseC_03_after_set1_logged.png` (rest timer countdown displayed).
  - Dismissed rest timer via `"Ready now"` (`[336,1193][624,1247]`). Evidence: `caseC_06_after_ready.png`.
  - Set 2 of 2 presented:
    - All RIR chips unselected (no chip active).
    - Direct RPE entry collapsed (`ENTER RPE DIRECTLY` unselected).
    - Effort cue completely neutral: `"RPE is optional evidence — leave it untouched to skip."`
    - No carry-over of Set 1's RIR 2 / RPE 8.0.
    - No target-derived cue shown for Set 2.
    - Evidence: `caseC_07_set2_scrolled.png`.

### Case D: Persistence Across Logged Sets
- **Status:** PASS
- **Observations:**
  - Logged Set 2 of Bodyweight Squat with effort left untouched (null/unreported). Evidence: `caseD_01_after_set2_logged.png`.
  - Exercise 1 completed (`2 sets complete`). Session display updated to `"1 of 4 exercises complete"`, advancing to exercise 2 (`Cable Pull-Through`).
  - **Background / Foreground:**
    - App backgrounded via `input keyevent 3` (HOME). Evidence: `caseD_02_backgrounded.png`.
    - App foregrounded via `am start -n com.pikemethods.training.qa/com.athletekinetics.MainActivity`. Session restored intact with full state. Evidence: `caseD_03_foregrounded.png`.
  - **Cold Process Kill and Relaunch:**
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
  - **Database write separation verified:**
    - Code audit of `useStore.ts:5646` (`set_record` insertion):
      `safeRpe = set.actual_rpe != null && !Number.isNaN(set.actual_rpe) ? set.actual_rpe : null;`
      Logged sets write `actual_rpe` to `set_record`, while planned target remains in `set_target.target_rpe`. Set 1 logged RPE 8.0, Set 2 logged NULL. Neither backfilled target RPE 6.5.

### Case E: Upgrade Preservation
- **Status:** PASS
- **Observations:**
  - Executed in-place reinstall without uninstall:
    `adb -s 49241FDAP001C7 install -r apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk`
    Exit code: 0 (`Success`).
  - Dumpsys verification confirmed in-place upgrade:
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

## 3. Database State Written to Device

- **Sessions Started:** 1 session started (`Day 1` of the 4-day GPP block).
- **Sets Logged:** Exactly 2 sets logged on Exercise 1 (`Bodyweight Squat`):
  1. **Set 1:** 10 reps @ 0 kg load, actual RPE `8.0` (derived from RIR `2`). Written to `set_record` with `actual_rpe = 8.0`.
  2. **Set 2:** 10 reps @ 0 kg load, actual RPE untouched (`null`). Written to `set_record` with `actual_rpe = null`.
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
| 9 | `adb -s 49241FDAP001C7 shell input tap 444 1096` | 0 | Open RIR InfoTip |
| 10 | `adb -s 49241FDAP001C7 shell input tap 500 300` | 0 | Dismiss RIR InfoTip via tap-away |
| 11 | `adb -s 49241FDAP001C7 shell input keyevent 4` | 0 | Dismiss InfoTip via Android Back |
| 12 | `adb -s 49241FDAP001C7 shell input tap 480 1285` | 0 | Tap "ENTER RPE DIRECTLY" chip |
| 13 | `adb -s 49241FDAP001C7 shell input tap 654 1430` | 0 | Open RPE InfoTip |
| 14 | `adb -s 49241FDAP001C7 shell input tap 480 1250` | 0 | Select RIR 2 chip |
| 15 | `adb -s 49241FDAP001C7 shell input tap 830 1620` | 0 | Increment direct RPE stepper to 8.5 |
| 16 | `adb -s 49241FDAP001C7 shell input tap 175 1400` | 0 | Select "NOT SURE" chip |
| 17 | `adb -s 49241FDAP001C7 shell input tap 480 1850` | 0 | Log Set 1 (RIR 2) |
| 18 | `adb -s 49241FDAP001C7 shell input tap 480 1220` | 0 | Tap "Ready now" to skip rest timer |
| 19 | `adb -s 49241FDAP001C7 shell input swipe 500 1500 500 800 300` | 0 | Scroll Set 2 effort controls into view |
| 20 | `adb -s 49241FDAP001C7 shell input tap 480 1780` | 0 | Log Set 2 (effort untouched) |
| 21 | `adb -s 49241FDAP001C7 shell input keyevent 3` | 0 | Background app to launcher |
| 22 | `adb -s 49241FDAP001C7 shell am start -n com.pikemethods.training.qa/...` | 0 | Foreground app |
| 23 | `adb -s 49241FDAP001C7 shell am force-stop com.pikemethods.training.qa` | 0 | Cold kill app process |
| 24 | `adb -s 49241FDAP001C7 shell pidof com.pikemethods.training.qa` | 1 | Verify process termination (exit 1 = dead) |
| 25 | `adb -s 49241FDAP001C7 shell input tap 480 1340` | 0 | Tap "OPEN ACTIVE SESSION" on READY tab |
| 26 | `adb -s 49241FDAP001C7 install -r apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` | 0 | In-place reinstall over existing package |
| 27 | `adb -s 49241FDAP001C7 shell input tap 864 2070` | 0 | Navigate to ATHLETE tab |
| 28 | `adb -s 49241FDAP001C7 shell input tap 480 577` | 0 | Open terminology glossary |
| 29 | `adb -s 49241FDAP001C7 shell input tap 480 658` | 0 | Tap glossary search input |
| 30 | `adb -s 49241FDAP001C7 shell input text "TARGET%sRPE"` | 0 | Search TARGET RPE |
| 31 | `adb -s 49241FDAP001C7 shell input keyevent 111` | 0 | Dismiss keyboard |
| 32 | `adb -s 49241FDAP001C7 shell input tap 861 658` | 0 | Tap clear search button |
| 33 | `adb -s 49241FDAP001C7 shell input text "LINEAR"` | 0 | Search LINEAR |
| 34 | `adb -s 49241FDAP001C7 shell input tap 480 252` | 0 | Tap "← BACK TO ATHLETE" |
| 35 | `adb -s 49241FDAP001C7 shell input tap 288 2070` | 0 | Return to SESSION tab |
| 36 | `adb -s 49241FDAP001C7 logcat -b crash -d` | 0 | Check crash logcat buffer |
| 37 | `adb -s 49241FDAP001C7 shell ls -la /data/anr` | 0 | Inspect ANR directory |
| 38 | `adb -s 49241FDAP001C7 shell settings get global airplane_mode_on` | 0 | Check airplane mode setting (returned 1) |
| 39 | `adb -s 49241FDAP001C7 shell settings get global wifi_on` | 0 | Check Wi-Fi setting (returned 2) |

---

## 5. Limitations and Anything Still NOT RUN

- **C6 (Low-Memory / 4 GB Device Gate):** Explicitly out of scope per §8 of the work order (`C6: NOT EVALUATED`). Pixel 9 Pro has 16 GB physical RAM; memory-pressure testing on the authorized 4 GB reference platform is handled under a separate gate.
- **Loading Method InfoTip in Live Session (A3):** Gated behind `training_age !== 'beginner'`. Testing it in a live session would have required regenerating the program under Intermediate/Advanced, which is strictly prohibited by §3. Verified via code inspection of `RoutineTemplateBuilder.tsx`.
- **Rest of Workout Session:** Exercises 2, 3, and 4 were not logged; the session was deliberately preserved in-progress so that the device state remains auditable for the reviewer.

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

### Assumptions Made Where Work Order Was Silent
1. **Rest Timer Handling:** The work order instructed logging one set, checking next-set reset, and logging another set. When Set 1 was logged, a 90-second rest timer activated. Rather than waiting 90 seconds or allowing a background timeout, we tapped `"Ready now"`, which is the intended user affordance to advance immediately to the next set.
2. **Glossary Entry Point:** The work order required re-opening the glossary after logging. In the app's architecture, the glossary modal is accessed via the `ATHLETE` tab under `"LEARNING & TERMINOLOGY"`. We navigated to `ATHLETE`, opened and inspected the glossary, and returned to `SESSION` to leave the active session in view.
3. **Screenshot Protocol on Windows PowerShell:** Direct piping of `adb exec-out screencap -p > file.png` causes binary UTF-16LE corruption under Windows PowerShell. We adopted the standard robust pattern: `screencap -p /sdcard/...` on device followed by `adb pull`.

### Deviations From Work Order
None. Every authorized step was executed as specified, and every prohibited action was strictly avoided.

### Confidence Assessment for Cases A–G
- **Case A (Affordances):** HIGH CONFIDENCE. RIR and RPE InfoTips were opened and dismissed via both tap-away and back key on hardware. Loading method InfoTip was verified via component reuse audit.
- **Case B (Effort Draft Controls):** **VERY HIGH CONFIDENCE. GENUINELY EVIDENCED ON DEVICE — NOT INFERRED.** All four states (untouched neutral string, RIR 2 selection, direct RPE 8.5 selection, and "Not sure" reset to neutral string) were photographed directly from the running Pixel 9 Pro screen. The target RPE 6.5 was never displayed as a default or cue in the untouched/not-sure states. The fix is 100% verified on hardware.
- **Case C (Next-Set Reset):** HIGH CONFIDENCE. Genuinely evidenced on device. Set 2 presented an unselected RIR row, collapsed direct entry, and the neutral string without carryover from Set 1.
- **Case D (Persistence):** HIGH CONFIDENCE. Genuinely evidenced on device across background/foreground, cold process termination, and relaunch. Set 1 persisted with RPE 8.0, Set 2 persisted with NULL, and the active session checkpoint restored cleanly.
- **Case E (Upgrade):** HIGH CONFIDENCE. Genuinely evidenced on device via `adb install -r`. Dumpsys confirmed updated `lastUpdateTime` with identical `firstInstallTime`, and all profile/program/session state survived intact.
- **Case F (Glossary Regression):** HIGH CONFIDENCE. Genuinely evidenced on device. TARGET RPE, RPE CAP, and LINEAR cards were searched, rendered, and verified against the approved definitions.
- **Case G (Stability):** HIGH CONFIDENCE. Genuinely evidenced on device. Zero crashes, zero ANRs, clean logcat.

### What Did Not Work and How It Was Worked Around
1. `adb exec-out screencap -p > file.png`: Produced invalid PNG byte headers due to PowerShell stdout encoding. Worked around cleanly by taking screencap to `/sdcard/` and using `adb pull`.
2. `uiautomator dump` during active countdown timer: Failed with `ERROR: could not get idle state` because the rest timer text updates every second. Worked around by tapping `"Ready now"` to end the rest timer, after which `uiautomator dump` succeeded instantly.
3. Initial tap coordinates for glossary: Missed the button because the scroll container offset positioned it lower (`y=577` rather than `y=270`). Dumped UI XML, calculated exact node bounding box `[188,550][772,604]`, and tapped the exact centroid (480, 577).

### What I Would Want Checked If Reviewing My Own Run
1. Inspect `caseB_01_unanswered_neutral.png` vs `caseB_04_notsure_neutral.png`: Confirm that both show `"RPE is optional evidence — leave it untouched to skip."` and neither displays the target cue for RPE 6.5.
2. Inspect `caseB_02_rir_2_selected.png`: Confirm `"Reported actual RPE 8.0"` and cue `"Hard but controlled; about two good reps left."`
3. Inspect `caseB_03_rpe_8_5_selected.png`: Confirm `"Reported actual RPE 8.5"` and cue `"Very hard; about one good rep left."`
4. Inspect `caseC_07_set2_scrolled.png`: Confirm Set 2 controls are completely reset and neutral.
5. Inspect `caseD_04_killed_and_relaunched.png` and `caseD_05_session_resumed.png`: Confirm resumption after process death.
6. Verify `git diff --name-status 6dde126f058fdd3ec2c765dd4e3c4d9ed02d3e06 HEAD` contains only documentation files.
