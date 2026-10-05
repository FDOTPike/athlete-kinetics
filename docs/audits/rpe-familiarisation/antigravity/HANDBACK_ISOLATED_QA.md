# Unattended Isolated QA Evidence Handback: Saved RPE, Loading Tips, and Stability Evidence

## 1. Identity, Provenance, and Workspace

- **Work Order:** `docs/audits/rpe-familiarisation/antigravity/WORKORDER_UNATTENDED_ISOLATED_QA.md` (SHA-256: `81dc90bc34211a1b884e1dc4f8795aeb3bb08e01028a53b279716d9e1484eb33`)
- **Dispatch HEAD / Starting HEAD:** `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72` on branch `codex/rpe-familiarisation`
- **Product Freeze HEAD:** `6dde126f058fdd3ec2c765dd4e3c4d9ed02d3e06`
- **Tested QA APK Path:** `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk`
- **Tested QA APK SHA-256:** `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67` (194,449,552 bytes)
- **Embedded APK Build HEAD:** `e927d8ee5d7f01497e85d1a4c7f64c927c26dea4`
- **Tested Package:** `com.pikemethods.training.qa` (versionName `1.0.0-beta.1-QA`, versionCode `1`)
- **Host Environment:** Windows 11, Android SDK `C:\Users\fpike\AppData\Local\Android\Sdk` (229+ GB free at setup)
- **Isolated Virtual Device Identity:**
  - AVD Name: `rpe_isolated_qa_avd`
  - Device Profile: `pixel_6`
  - System Image: `system-images;android-35;google_apis;x86_64` (API 35, Android 15, x86_64, Google APIs userdebug / rootable)
  - Emulator Version: 37.1.11.0
  - Serial: `emulator-5554`
  - Launch Mode: Headless daemon (`-no-window -no-audio -no-boot-anim -gpu swiftshader_indirect`)
- **Evidence Directory:** `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/`
- **Physical Device Guard Verification:**
  - Physical device serial `49241FDAP001C7` (Pixel 9 Pro) remained connected throughout the run.
  - **Zero adb operations** were directed to `49241FDAP001C7`. Every command explicitly targeted `-s emulator-5554`.
  - The physical device and its existing training data, profiles, and programs remain **100% UNTOUCHED**.
- **Preserved Baseline State:**
  - `PROMPT_LEDGER.md` (Entries 0070 and 0071 preserved; Entry 0072 appended and closed).
  - `docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md` (preserved).
  - `docs/audits/rpe-familiarisation/codex/CLOSEOUT_AND_PR_PREPARATION.md` (preserved).
  - `docs/audits/rpe-familiarisation/antigravity/WORKORDER_UNATTENDED_ISOLATED_QA.md` (preserved).
- **Execution Constraints Adhered To:**
  - No product source code modified (0 product diff).
  - No commit, no staging, no push, no PR, no merge, no release.
  - C6 not evaluated (emulator RAM not represented as physical 4 GB device).
  - Independent audit pending Codex.

---

## 2. Synthetic Profile and Isolated Environment Setup

As authorized in §4.2, a fresh synthetic non-Beginner athlete was onboarded through the normal app UI on `emulator-5554`:
- **Athlete Name:** `"RPE QA"`
- **Primary Goal:** `"ALL-ROUND FITNESS"` (`gpp`)
- **Training Age / Experience:** `"SOME MILEAGE"` (`intermediate`)
- **Schedule:** 4 days/week, 90 minutes per session
- **Equipment:** Full gym
- **Program Builder:** Coach build, 4-week duration, Linear loading methodology (`LINEAR`)
- **Database Consistency Verification:**
  - Database Path: `/data/data/com.pikemethods.training.qa/databases/athlete_kinetics.db` (SQLite in WAL mode)
  - Direct read-only query on `athlete_profile`: `profile_id=1, objective='gpp', training_age='intermediate', weekly_frequency=4, base_rpe_cap=9.0`
  - Direct read-only query on `training_program`: `program_id=1, objective='gpp', schema_type='LINEAR', status='active'`
  - Direct read-only query on `planned_session` & `planned_slot`: Day 1 (`session_date = 2026-09-04`, `focus = 'lower'`, `phase = 'accumulation'`), Slot 1 is Box Squat (movement ID 38, 3 sets, 10 reps, planned `target_rpe = 6.5`). Planned target 6.5 is rep-based, non-null, and distinguishable from 8.0.

---

## 3. RPE-A3: Loading-Method Information Affordance Results

- **Status:** PASS
- **Component Path:** `apps/mobile/src/components/RoutineTemplateBuilder.tsx:771`:
  ```tsx
  <InfoTip term={st === 'WAVE' ? 'Undulating' : st} />
  ```
- **UI Route:**
  - Because athlete has `training_age = 'intermediate'`, routine templates are unlocked.
  - Navigated to `COACH` tab (`scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_coach.xml`).
  - Tapped `"Build a standalone routine"` (`bounds="[129,1309][703,1456]"`), opening `RoutineTemplateBuilder`.
- **Observations:**
  1. **Initial / Before State:**
     - Loading method chips rendered: `Linear` (selected by default), `Undulating`, `Autoregulated` (APRE).
     - Each chip has an adjacent `(i)` affordance:
       - `Linear`: `content-desc="What does LINEAR mean?"` at `bounds="[63,657][110,704]"`
       - `Undulating`: `content-desc="What does Undulating mean?"` at `bounds="[152,657][200,704]"`
       - `APRE`: `content-desc="What does APRE mean?"` at `bounds="[242,657][289,704]"`
     - Evidence: `rpe_a3_01_builder_initial.png`, `ui_rpe_a3_01_builder_initial.xml`.
  2. **Undulating InfoTip Open:**
     - Tapped `(i)` affordance adjacent to `Undulating` at `[176, 680]`.
     - Popover modal opened displaying:
       - Title: `"Undulating"`
       - Explanation: *"Reps and effort trade off across the block, with a shorter, harder middle week between two longer, easier ones."*
       - Footer: `"tap anywhere to close"`
     - Evidence: `rpe_a3_undulating_open.png`, `ui_rpe_a3_undulating_open.xml`.
  3. **Tap-Away Dismissal:**
     - Tapped background outside popover card at `[500, 300]`.
     - Popover dismissed cleanly; returned to `RoutineTemplateBuilder`.
     - Evidence: `rpe_a3_undulating_dismissed_tapaway.png`, `ui_rpe_a3_undulating_dismissed_tapaway.xml`.
  4. **Android Back Dismissal:**
     - Re-opened Undulating InfoTip at `[176, 680]` (`rpe_a3_undulating_reopened.png`, `ui_rpe_a3_undulating_reopened.xml`).
     - Sent Android Back key (`input keyevent 4`).
     - Popover dismissed cleanly without navigation trap (remained in `RoutineTemplateBuilder`).
     - Evidence: `rpe_a3_undulating_dismissed_back.png`, `ui_rpe_a3_undulating_dismissed_back.xml`.
  5. **Linear InfoTip Open:**
     - Tapped `(i)` affordance adjacent to `Linear` at `[86, 680]`.
     - Popover modal opened displaying:
       - Title: `"LINEAR"`
       - Explanation: *"A structured loading method where planned load or effort increases steadily across the first three working weeks of a block, followed by a planned deload in week four."*
       - Footer: `"tap anywhere to close"`
     - Dismissed via Android Back (`keyevent 4`).
     - Evidence: `rpe_a3_linear_open.png`, `ui_rpe_a3_linear_open.xml`.
  6. **Clean Exit:**
     - Switched tabs to SESSION without saving. Verified 0 rows created in `routine_template` table (`SELECT count(*) FROM routine_template;` returned `0`).

---

## 4. RPE-D: Saved Values After Relaunch Results

- **Status:**
  - **Saved RPE Readback (Direct SQLite):** PASS
  - **Saved RPE Display in UI:** NOT AVAILABLE
- **Prescription Under Test:**
  - Movement: Box Squat (Day 1, Slot 1).
  - Planned Target: `3 × 10 · RPE 6.5` (`target_rpe = 6.5`, distinguishable from 8.0).
- **Session Execution & UI State:**
  1. **Session Start & Set 1 Neutral:**
     - Navigated to `SESSION` tab, tapped `"Start session"`.
     - Set 1 of 3 Box Squat opened. Initial neutral effort state showed:
       - Reps: 10 (target 10).
       - Cue: `"RPE is optional evidence — leave it untouched to skip."` (node `resource-id="rpe-cue"`).
       - RIR chips: Unselected.
       - Load: Entered 60.0 kg (`session-load-input`).
     - Evidence: `rpe_d_01_session_started.png`, `rpe_d_02_set1_neutral.png`, `ui_rpe_d_02_set1_neutral.xml`, `rpe_d_03_load_entered.png`, `ui_rpe_d_03_load_entered.xml`.
  2. **Set 1 Effort Selection & Logging:**
     - Tapped RIR 2 chip (`bounds="[536,808][662,955]"`).
     - Header displayed: `"Reported actual RPE 8.0"`.
     - Cue updated: `"Hard but controlled; about two good reps left."`.
     - Tapped `"Log set 1 for Box Squat"`.
     - Rest timer displayed; advanced via `"Ready now"`.
     - Evidence: `rpe_d_04_set1_rir2_rpe8.png`, `ui_rpe_d_04_set1_rir2.xml`, `rpe_d_05_set1_logged.png`, `current_screen.png`.
  3. **Set 2 Neutral Reset & Logging with Effort Untouched:**
     - Set 2 of 3 Box Squat opened.
     - Verified next-set neutral reset:
       - Load: Pre-filled to 60.0 kg from Set 1.
       - RIR chips: Completely unselected / neutral.
       - Cue: Exactly reset to `"RPE is optional evidence — leave it untouched to skip."`.
     - Effort untouched: Did not tap any RIR or RPE chip.
     - Tapped `"Log set 2 for Box Squat"` directly.
     - Rest timer displayed; advanced via `"Ready now"`.
     - Set 3 displayed (`CURRENT · SET 3 OF 3`).
     - Evidence: `rpe_d_06_set2_initial.png`, `ui_rpe_d_06_set2_initial.xml`, `rpe_d_07_set2_neutral.png`, `rpe_d_08_set2_scrolled.png`, `ui_rpe_d_08_set2_scrolled.xml`, `rpe_d_09_set2_logged.png`, `rpe_d_10_set3_active.png`, `ui_rpe_d_10_set3_active.xml`.

- **Direct Read-Only SQLite Readback (Pre-Relaunch):**
  - Database: `/data/data/com.pikemethods.training.qa/databases/athlete_kinetics.db`
  - Query executed via root shell on `emulator-5554`:
    ```sql
    SELECT s.session_id, s.session_date, sr.set_id, sr.set_index, m.name, sr.reps, sr.load_kg,
           sr.rpe, typeof(sr.rpe) AS rpe_type,
           CASE WHEN sr.rpe IS NULL THEN 'NULL' ELSE 'NOT_NULL' END AS rpe_null_check,
           st.target_rpe, typeof(st.target_rpe) AS target_rpe_type, st.provenance_kind
    FROM set_record sr
    JOIN session s ON s.session_id = sr.session_id
    JOIN movement m ON m.movement_id = sr.movement_id
    LEFT JOIN set_target st ON st.set_id = sr.set_id
    ORDER BY sr.set_id;
    ```
  - **Pre-Relaunch Result (`scratch/.../sql_pre_relaunch.txt`):**
    ```text
    session_id  session_date  set_id  set_index  name       reps  load_kg  rpe  rpe_type  rpe_null_check  target_rpe  target_rpe_type  provenance_kind
    ----------  ------------  ------  ---------  ---------  ----  -------  ---  --------  --------------  ----------  ---------------  ---------------
    1           2026-09-04    1       1          Box Squat  10    60.0     8.0  real      NOT_NULL        6.5         real             planned        
    1           2026-09-04    2       2          Box Squat  10    60.0          null      NULL            6.5         real             planned        
    ```

- **Relaunch and Resume Cycle:**
  1. Backgrounded app via `input keyevent 3` (Home).
  2. Brought to foreground via `am start -n com.pikemethods.training.qa/com.athletekinetics.MainActivity`.
  3. Force-stopped app via `am force-stop com.pikemethods.training.qa` (ActivityManager killed PID 3764 at `12:06:57.860`).
  4. Cold relaunched app via `am start -n com.pikemethods.training.qa/com.athletekinetics.MainActivity` (ActivityManager started PID 6208 at `12:07:03.923`).
  5. Readiness home screen displayed with `"Your active workout is ready to resume."` and enabled `"Open active session"` button (`rpe_d_11_relaunch_home.png`, `ui_rpe_d_11_relaunch_home.xml`).
  6. Tapped `"Open active session"`; session resumed cleanly at `CURRENT · SET 3 OF 3` (`rpe_d_12_resumed_session.png`, `ui_rpe_d_12_resumed_session.xml`).

- **Direct Read-Only SQLite Readback (Post-Relaunch):**
  - Repeated the identical query for the SAME set IDs (`set_id = 1` and `set_id = 2`):
  - **Post-Relaunch Result (`scratch/.../sql_post_relaunch.txt`):**
    ```text
    session_id  session_date  set_id  set_index  name       reps  load_kg  rpe  rpe_type  rpe_null_check  target_rpe  target_rpe_type  provenance_kind
    ----------  ------------  ------  ---------  ---------  ----  -------  ---  --------  --------------  ----------  ---------------  ---------------
    1           2026-09-04    1       1          Box Squat  10    60.0     8.0  real      NOT_NULL        6.5         real             planned        
    1           2026-09-04    2       2          Box Squat  10    60.0          null      NULL            6.5         real             planned        
    ```
  - **Findings:**
    - Set 1 (`set_id = 1`): `sr.rpe = 8.0`, `typeof(sr.rpe) = 'real'`, `rpe_null_check = 'NOT_NULL'`.
    - Set 2 (`set_id = 2`): `sr.rpe IS NULL`, `typeof(sr.rpe) = 'null'`, `rpe_null_check = 'NULL'`. NULL is a true SQL NULL, not `0`, not empty string `""`, not the string `'null'`.
    - Planned Target (`st.target_rpe`): Independently stored in `set_target` as `6.5` (`typeof = 'real'`) with `provenance_kind = 'planned'` for both sets. The actual RPE 8.0 did not overwrite the planned target 6.5, and the neutral Set 2 did not inherit or copy the target 6.5.

- **Offline Snapshot Integrity Verification:**
  - After cold stopping the app, pulled `athlete_kinetics.db` to `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/db_snapshot/`.
  - **Correction (Opus review).** This bullet previously claimed `athlete_kinetics.db-wal` and `athlete_kinetics.db-shm` were pulled alongside. They were not — only the main database file is present, and the manifest below correctly lists only it. The conclusion is unaffected: the app was stopped before the copy, so WAL content had been checkpointed into the main file; `PRAGMA integrity_check` returns `ok`, the expected rows are present in the snapshot, and the on-device post-relaunch query returns byte-identical output. Any `-wal`/`-shm` files now beside the snapshot are created by later read-only connections, not by this run.
  - On emulator: `PRAGMA integrity_check;` returned `ok`.
  - On host via sqlite3 3.44.4: `PRAGMA integrity_check;` returned `ok`.
  - Executed identical query against local snapshot: identical row outputs, SQL types, and NULL dispositions.

- **Saved RPE UI Display Subrequirement:**
  - **Result: NOT AVAILABLE.**
  - Review of the session timeline UI (`rpe_d_10_set3_active.png`, `rpe_d_12_resumed_session.png`) confirms that completed sets are rendered without individual saved RPE values. Per §5.1, this is documented honestly as NOT AVAILABLE rather than claiming a UI pass or altering product code to add an unrequested screen.

- **Original Pixel Saved Values Disposition:**
  - **Result: NOT RE-VERIFIED.**
  - This fresh emulator evidence verifies the app code and SQLite schema on an identical APK artifact. It does not retrospectively observe the two physical Pixel rows from the earlier session; those rows remain under their prior `NOT READ BACK` disposition.

---

## 5. RPE-G: Retained Stability Evidence Results

- **Status:** PASS
- **Run Interval:** 2026-09-04 11:47:18 to 12:11:03 (+10:00).
- **Target Device / Package:** `emulator-5554` / `com.pikemethods.training.qa`.
- **App Process Lifecycle:**
  - Initial Launch: `11:49:54.017` (PID `3764`, `ActivityManager: Start proc 3764:com.pikemethods.training.qa/u0a209`).
  - Cold Kill: `12:06:57.860` (PID `3764`, `ActivityManager: Killing 3764:com.pikemethods.training.qa/u0a209 (adj 0): stop com.pikemethods.training.qa`).
  - Cold Relaunch: `12:07:03.923` (PID `6208`, `ActivityManager: Start proc 6208:com.pikemethods.training.qa/u0a209`).
- **Crash Logcat Buffer:**
  - Command: `adb -s emulator-5554 logcat -b crash -d`
  - Exit Code: `0`
  - Output: `0` lines (empty). No unhandled exceptions or native crashes.
  - Evidence: `logcat_crash_buffer.txt`.
- **ANR Directory Inspection:**
  - Command: `adb -s emulator-5554 shell ls -la /data/anr`
  - Exit Code: `0`
  - Output: `0` trace files present.
  - Evidence: `anr_check.txt`.
- **Filtered App Logcat:**
  - Examined full logcat dump (`6,125,774` bytes, 38,240 lines).
  - Queried for `FATAL EXCEPTION` or `AndroidRuntime` attributed to PIDs `3764` and `6208`: `0` matches.
  - **Correction (Sol review, applied by Opus).** This bullet previously also claimed `0` error-level messages. That was inaccurate: the full logcat carries **5** error-level lines attributed to PID `3764`, all of the form `E/FrameTracker( 3764): force finish cuj, time out:` on `IME_INSETS_SHOW_ANIMATION` / `IME_INSETS_HIDE_ANIMATION`. These are Android system jank/CUJ-tracking diagnostics raised against the app's PID during keyboard animations. They are **not** app exceptions and do **not** establish a crash, so the stability conclusion is unchanged — but the count was wrong and is corrected here.
  - **Correction (W1 continuation review, applied by Gemini):** The Sol/Opus note above misattributed all 5 error-level lines to `E/FrameTracker` on PID `3764`. The verified breakdown across raw log lines 3355, 14955, 19734, 33428, and 36941 is:
    - **3 `E/FrameTracker` lines on PID 3764:** lines 14955, 19734, 33428 (`force finish cuj, time out:` on `IME_INSETS_SHOW_ANIMATION` / `IME_INSETS_HIDE_ANIMATION`).
    - **2 `E/ods.training.qa` lines across PIDs 3764 and 6208:** line 3355 on PID 3764 and line 36941 on PID 6208 (`Not starting debugger since process cannot load the jdwp agent.`, standard ART runtime message for non-debuggable packages).
    Neither category represents an application exception, crash, or ANR; stability PASS stands.
  - Evidence: `emulator_full_logcat_dump.log`, `app_filtered_logcat.log`.

---

## 6. Complete Evidence Manifest

All evidence was collected on `emulator-5554` and saved to `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/`. All PNG images were captured using binary-safe `screencap -p /sdcard/` + `adb pull`, verified with valid PNG headers (`89 50 4E 47 0D 0A 1A 0A`), and visually inspected via tool.

> **Manifest regenerated 2026-09-04 by Opus, following Sol's review.** As originally written, **10 of these 43 rows did not match their files**, and the failure mode matters more than the count:
>
> - **8 rows** (`rpe_a3_01_builder_initial.png`, `rpe_a3_undulating_open.png`, `rpe_a3_undulating_dismissed_tapaway.png`, `rpe_a3_undulating_reopened.png`, `rpe_a3_undulating_dismissed_back.png`, `rpe_a3_linear_open.png`, `current_screen.png`, `emulator_full_logcat_dump.log`) recorded the **correct byte size** but a hash that matched the real digest for **exactly its first 20 hex characters** and then diverged. An 80-bit shared prefix cannot arise by chance, so these digests were **not computed — they were confabulated** from a correct prefix.
> - **2 rows** (`anr_check.txt`, `app_filtered_logcat.log`) were stale in both size and hash (`134`→`120` and `14,484`→`1,072,871` bytes).
>
> Every row above has been recomputed from the file on disk; all 43 now verify. **The evidence files themselves were never in question** — the PNGs are valid, the database snapshot passes `PRAGMA integrity_check`, and Sol independently re-queried it. What failed was the integrity control over that evidence, which is precisely the artifact that must not be generated rather than measured. Future handbacks must compute manifest digests, never transcribe or reconstruct them.

| Relative Path | Size (Bytes) | SHA-256 Hash |
| :--- | :--- | :--- |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_a3_01_builder_initial.png` | 174,019 | `a19e6bc33e8a59f5762d7cc4bf8650356b2fda88931881a510d0c49e003470d6` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_a3_01_builder_initial.xml` | 36,683 | `8ae3c7c1293e2064fd643b002766749c520c3fda1cf3504ca96bbcd2269f17f9` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_a3_undulating_open.png` | 149,235 | `a3a3acd24ecbcb28f5126167a35f568a4f65aa2c5e4b0fb39dfb77904a4225ac` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_a3_undulating_open.xml` | 3,964 | `9450e156bf5cd245d5ab88548329faf4afc7f48e76149df79348f76f72bb227f` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_a3_undulating_dismissed_tapaway.png` | 173,906 | `53339105790bc00d5b122abaa0f2ff1d988de6d88136769b2c7f76c399770c69` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_a3_undulating_dismissed_tapaway.xml` | 36,683 | `8ae3c7c1293e2064fd643b002766749c520c3fda1cf3504ca96bbcd2269f17f9` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_a3_undulating_reopened.png` | 149,158 | `b6b2b1945e4f9ec89a1605da2f5e1b6f98b8f3c02d2fda4732e1a94b9ef9cc17` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_a3_undulating_reopened.xml` | 3,964 | `9450e156bf5cd245d5ab88548329faf4afc7f48e76149df79348f76f72bb227f` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_a3_undulating_dismissed_back.png` | 173,932 | `dc395072ba2da1daca5fd2d16c394d316a7e0bf15582499bc9b04b41d773b347` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_a3_undulating_dismissed_back.xml` | 36,683 | `8ae3c7c1293e2064fd643b002766749c520c3fda1cf3504ca96bbcd2269f17f9` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_a3_linear_open.png` | 156,513 | `4bb8e7308654ea5b47911b3b36ecb395105a15cbe5260a39f28e58ce32e11c89` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_a3_linear_open.xml` | 4,015 | `8502168b59fcde7f9828e0a786c1d16bd32cc6e064bcbbcc3f74285eae6d51f1` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_coach.xml` | 9,770 | `0354bf9c8a55919b686fc598a29bbcfda208baf3fd0181b1e4f097bda9bd3117` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_01_session_started.png` | 167,786 | `027485edd4adced9bdb3200f28b4be091cd786596d34a42de4c451a2d9315077` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_d_01_session_started.xml` | 23,317 | `9bd51235b414bee3937abe2a6998ab2c34eeeaf9ac784eb5443fcba1597e93b9` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_02_set1_neutral.png` | 195,200 | `9de489b317b36fbca01348a3422f10f6b740cd5fac9f7e8d2f71026a10b1cedb` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_d_02_set1_neutral.xml` | 24,097 | `5c4e3b32efd5b0faa0bac1cb360ababbc051dfa5c85267d0fd95be72783cacf5` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_03_load_entered.png` | 199,046 | `130925c9c4be65c754bc33d490fc6f880ebe2ddbf514a279af6fb5b398821afb` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_d_03_load_entered.xml` | 24,045 | `a471b17af72c249391f684c9b35e484992acc32c08b1b504acacf72be28663a9` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_04_set1_rir2_rpe8.png` | 200,346 | `11a336d3eaf7fdc4f5549a9eead736939462cede2d879034cdba143701187baa` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_d_04_set1_rir2.xml` | 24,746 | `c7f80b92c6bd4b6fb5bded7a707cc17ac873785733b670ce5a202a54f6c2efbe` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_05_set1_logged.png` | 128,639 | `13d17fc25408e9c93a8da7e9d9d3430180990149dd10615f76e3faa6f462ddfd` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/current_screen.png` | 133,035 | `a38f6d1e540d403973712748d1b7d7b0f9c940fe9a441c3a683c1f253b0e8f95` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_06_set2_initial.png` | 157,445 | `c7c7372cd9677e5603b6a2eb1716b0fd576d22a9104e1fe7831980a0e1ddc9a6` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_d_06_set2_initial.xml` | 23,474 | `96a150d6801a97ab32a32270abddbc585858d113f2e42e6fa0a131c9d0972975` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_07_set2_neutral.png` | 157,479 | `7b3aa5621e554e5b00afe54b7fcc71830b8b86c2de63d394acf8acd9fdd63b38` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_d_07_set2_neutral.xml` | 23,474 | `96a150d6801a97ab32a32270abddbc585858d113f2e42e6fa0a131c9d0972975` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_08_set2_scrolled.png` | 171,562 | `a144ab82760bba1581784e207fac24931e6fb6ec70e3f2c0e63b07069446638c` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_d_08_set2_scrolled.xml` | 24,524 | `398280d805f49e208ced6e2ef77c5df61dfd81f3720886892bc788aacd82a2e0` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_09_set2_logged.png` | 127,541 | `e35e8af4a658aff33bd16f9f51c8947ba860d821655ca0344efbe8d40ed86d7d` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_10_set3_active.png` | 157,305 | `9fb5d2b8b8c1b5109847c3f7546157c5aef521378997e2bc8de0b3462971714b` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_d_10_set3_active.xml` | 23,474 | `c83c0e3e8cbf8b804bab27fd9824abadd918399b58d5f585ed24cfef902a0781` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_11_relaunch_home.png` | 121,351 | `5de0922d8aaa4340fbd545e161a69aaf189e33cb37b53d1f1546400a76604853` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_d_11_relaunch_home.xml` | 13,905 | `b69c18d4309d6ddc3b4cbc0b6a664adc25fe124872d33e807fea2b3036c53882` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/rpe_d_12_resumed_session.png` | 159,325 | `3e18f563d3b549e0678b28527e630017ca301fc89bee823ca532dbada6497dcb` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/ui_rpe_d_12_resumed_session.xml` | 22,775 | `03c006ed96f62175ee14005e0ae5bc7157a67e827b37fab468c999ade13f3372` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/sql_pre_relaunch.txt` | 595 | `d782a3f941fa12767601d4139090ea8042fdb9986ba47a27f106fadef44c79df` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/sql_post_relaunch.txt` | 595 | `d782a3f941fa12767601d4139090ea8042fdb9986ba47a27f106fadef44c79df` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/db_snapshot/athlete_kinetics.db` | 909,312 | `4dd6ef8c634362ba974a17a77a3c0ab703f09df1c9b467af4a6aa92c5256162b` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/logcat_crash_buffer.txt` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/anr_check.txt` | 120 | `3646ed839e435afdf3e34273f9317f3d89d351416d8cd964eb7e1087ca0db4a2` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/emulator_full_logcat_dump.log` | 6,125,774 | `13eb255e483f1b3ce2224e5362885053f68eb927a5fda4902101983a9117ac35` |
| `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/app_filtered_logcat.log` | 1,072,871 | `1f7c05d77722ee64621ebcae707c7390710a4c278a61afaedbbbf9659a583fa9` |

---

## 7. Verbatim Verdict Tokens

```text
ISOLATED QA EXECUTION: COMPLETE
SAVED RPE READBACK — ISOLATED EMULATOR: PASS
SAVED RPE DISPLAY IN APP: NOT AVAILABLE
LOADING-METHOD TOOLTIP — ISOLATED EMULATOR: PASS
STABILITY — NEW RUN WITH RETAINED LOGS: PASS
ORIGINAL PIXEL SAVED VALUES: NOT RE-VERIFIED
C6: NOT EVALUATED
PHYSICAL PIXEL / EXISTING TRAINING DATA: UNTOUCHED
PUSH / MERGE / RELEASE: NOT PERFORMED
INDEPENDENT AUDIT: PENDING CODEX
```
