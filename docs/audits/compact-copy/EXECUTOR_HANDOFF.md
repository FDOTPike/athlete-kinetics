# Compact descriptions and Pixel executor handoff

24–25 November 2026

PROVISIONAL — FOR ANTIGRAVITY & OWNER REVIEW

- Worktree `C:/codex-sol-compact`
- Branch `feat/sol-compact-ui-and-pixel-fixes`
- Base `fb539d06c7608b703f0b18479c8f4d23c1d04e61`
- Raw evidence `C:/codex-sol-compact-evidence`. Each screenshot named below has a matching layout JSON. Captures use `android layout --no-idle --full` and `android screen capture` with the physical serial specified.

| Local commit | Scope |
| --- | --- |
| `34ee7db0ab9089dee21188aaaa045e59762f1d53` | Compact descriptions, profile mode and migration 082 |
| `4686f75c226dbbb3e02da27597d8ddc8499ba224` | Pixel layout fixes and regression tests |
| `1fd7247b5f4902f5b0c6c140880c5e94e407a538` | Backup compatibility for the Git SQL and the exact provisional CRLF SQL |
| `d5d24e98da0d974cf1a37679741031e4064f7c51` and `bbc2ffd1dbbc908d2a94e42424969f90f074a49a` | Pipeline checks for the appended migration |
| `ec742514e7be08f0185b2b8cd148c74016f63578` | Pinned backup wording and disclosure test coverage |
| `e30fafb261dced191b8c5e8bd88c82aa5b5754af` | Locale-aware off-plan workout date in Today’s caption and accessibility label |

## Hardware evidence

EVIDENCE CAPTURED — Pixel 9 Pro, Android 17, physical serial `192.168.0.49:43851` at the baseline and `192.168.0.49:36939` after reconnection. `pixel-geometry.txt` records 960 by 2142 pixels, 427 dpi override and a 1.3 system font scale. The screen width is approximately 360 dp. The named screenshots were visually inspected. `pixel-layout-witnesses.txt` records the literal accessibility text, bounds and selected state used below. `pixel-file-sha256.txt` contains capture hashes.

| Observation | Screenshot and layout stem | Machine-readable witness |
| --- | --- | --- |
| Baseline Today, workout dot and tab position | `baseline/today` | `2026-11-23`, `header-session-live-dot` center `[355,204]`, and the Today tab lower edge `2142` |
| Baseline Box Squat action row and active validation | `baseline/workout-actions` | `Swap exercise: Box Squat`, `Report discomfort`, `session-load-hint`. Both action labels split mid-word in the PNG. |
| Baseline swap picker | `baseline/swap-exercise` | `neutral-swap-reason-equipment_busy` |
| Baseline optional effort text before logging | `baseline/log-set` | `rpe-cue` and visible stop guidance |
| Baseline Library and Profile detail | `baseline/library-detail`, `baseline/profile`, `baseline/profile-display` | `Farmer Carry`, `TRAINING GUIDANCE`, and `These choices stay with this profile slot.` |
| Updated Today date and shell clearance | `after/today-date`, `after/today-live-compact` | `Tue, Nov 24, 2026`. The Today tab lower edge is `2057`, with the gesture bar below it in the PNG. |
| Workout dot inline and active workout description closed | `after/today-live-compact` | `header-session-live-dot` center `[271,228]`, `WORKOUT` center `[373,227]`, and `Show details for Workout in progress` |
| Plan rail affordance and swipe to the end of the first week | `after/plan`, `after/plan-last-days` | `Swipe across a week to see all seven days.` and `trajectory-days-week-1`. The second PNG shows the week-one rail scrolled to its right edge. |
| Workout labels and protected stop guidance in Compact | `after/workout-actions` | `Swap exercise: Push-up` and `Report discomfort` on distinct full-width rows, with `effort-stop-guidance` visible and zero `rpe-cue` nodes |
| Set logged and rest timer started | `after/rest-timer` | `Set 1 logged: 10 reps at 0.0 kg` and `Rest timer: 1:00 remaining` at layout capture |
| Summary and Session Feel after the scratch session | `after/session-summary`, `after/session-feel` | `Session saved · Tue, Nov 24, 2026`, `Record how this session went` and `How did this session go?` |
| Goal rows with independent detail controls | `after/onboarding-compact` | `Show details for GET STRONGER` |
| Sport gate and BJJ disclosure | `after/sport-gate`, `after/sport-description-open` | `Choose your sport.` is still shown after pressing the BJJ chevron. `Hide details for Brazilian jiu-jitsu` identifies the open state. |
| Research basis closed and open | `after/sport-research-closed`, `after/sport-research-open` | `Show details for Research basis` with zero `sport-emphasis-basis` nodes. The open layout contains `PMID 28194734` and `Choose how long you have played.` |
| Sticky Start Training action and program setup | `after/onboarding-review`, `after/program-setup` | `Step 10 of 10`, `Back` and `START TRAINING` within the footer bounds, and `program-recommendation-heading` |
| Display mode change and Metro reload | `after/profile-display-compact`, `after/profile-display-show-all`, `after/profile-display-reloaded` | `COMPACT` then `SHOW ALL` with `SELECTED` state. On reload, `SHOW ALL` remained selected and the Session & Display explanation was visible. |
| Library detail with coaching and execution text | `after/library-detail` | `Execution Instructions` |

EVIDENCE CAPTURED — Coach Mode scratch athlete `New Athlete` received the test workout, set and display setting. `after/francis-reactivated.json` records `Athlete Francis, active` with `SELECTED`. `after/francis-relocked.json` identifies Francis as the active profile and the advanced-tools control is absent. The final app layout is Today. `pixel-qa-package.txt` records the installed `com.pikemethods.training.qa` package. `metro-handback.txt` records `PORT_8081_LISTENERS=0`.

EVIDENCE CAPTURED — The 25 November rerun captured the complete Stage 3 walkthrough on the Android 17 Pixel, including both ends of the Plan strip and the Review footer before and after scrolling. On Today, the footer reads `Wed, Nov 25, 2026` and the off-plan caption and accessibility label contain `Tue, Nov 24, 2026`. The rerun closed the scratch workout, restored Francis to Today, relocked advanced tools and released Metro port 8081. [Rerun evidence and device handback](C:/codex-sol-compact-evidence/stage3-restart-2026-11-25/STAGE_3_RERUN.md)

EVIDENCE CAPTURED — A disposable Android 15 emulator supplied reconstructed before-state captures from `fb539d06` and a matched Box Squat comparison against verified application commit `e30fafb2`. The updated labels fit on one line, the live dot aligns with WORKOUT within 1 px, and all three tab bounds end 85 px above the bottom of the display. Both versions show the rest timer, stopped-session summary and Session Feel after the same scratch set. The packet also includes before-state Onboarding, Sport (BJJ), Program Setup, Today and Plan. [Android 15 evidence index](C:/codex-sol-compact-evidence/emulator-comparison-2026-11-25/ANDROID15_COMPARISON.md)

EVIDENCE CAPTURED — The restarted physical Pixel walkthrough now pairs the original Box Squat layout with the updated Box Squat layout at the same display settings. On the updated build, both action labels fit, the live dot is inline, and the tabs clear the gesture bar. The same run captured the swap picker, rest timer, stopped-session summary, Session Feel and both display modes. The scratch athlete’s initial Compact setting was restored, Francis was reactivated, advanced tools were relocked and port 8081 was released. [Physical restart evidence](C:/codex-sol-compact-evidence/pixel-workorder-restart-2026-11-25/PIXEL_RESTART.md)

## §10 report

1. **What I did**
   EVIDENCE CAPTURED — Added per-slot Compact and Show All settings, inline descriptions and glossary access across the 16 scoped surfaces. The manifest records the string edits. Migration 082 adds one STRICT table, participates in self-heal and joins the existing encrypted database snapshot and restore path. Updated `App.tsx`, `BlockScreen.tsx`, `OnboardingScreen.tsx`, `SessionScreen.tsx` and `TodayScreen.tsx` for the separate Pixel fixes.

2. **Commands and decisive output**
   EVIDENCE CAPTURED — `npm run typecheck` reports `EXIT=0` in `typecheck-final.log`. `npm run verify:pipeline` reports `pipeline verification: 55 checks passed` and `EXIT=0` in `pipeline-final.log`. The focused compact-description run reports `177 passed, 177 total` in `stage2-focused-final.log`. The final backup-portability filter reports `5 passed` and `EXIT=0` in `backup-portability-focused.log`. Red-first outputs include `compact-red.log`, `migration-red.log`, `backup-red.log`, `pixel-red.log`, `pixel-review-red.log` and `line-endings-red.log`. The last proves the LF schema initially failed the backup fingerprint check. After the full suite identified disclosure fixtures that still expected visible copy, the four affected suites reran with `34 passed, 34 total` and `EXIT=0` in `remaining-pins-final.log`. The Git diff check and hex audit are recorded separately.

   EVIDENCE CAPTURED — `npm run verify:ci` at `ec742514e7be08f0185b2b8cd148c74016f63578` ran `npm run verify:components` and exited with `EXIT=0` in `verify-ci-release-review.log`. Its final lines read `Test Suites: 256 passed, 256 total` and `Tests: 6884 passed, 6884 total`. `git-diff-check.txt` records `EXIT=0` and `final-hex-audit.txt` records `ADDED_HEX_LITERALS=0`.

   EVIDENCE CAPTURED — On the application tree committed as `e30fafb261dced191b8c5e8bd88c82aa5b5754af`, both off-plan caption assertions failed on the raw dates before the fix. With the fix, `npm run typecheck`, nine focused component suites with 391 tests, and `git diff --check` exited 0. The full `npm run verify:ci` ran `npm run verify:components` and exited 0 with 256 suites and 6,884 tests. [Before-fix test log](C:/codex-sol-compact-evidence/stage3-restart-2026-11-25/caption-red.log) · [Full verification log](C:/codex-sol-compact-evidence/stage3-restart-2026-11-25/verify-ci.log)

3. **What I could not verify**
   NOT VERIFIED — the Pixel locked during the original physical baseline before a logged set, rest timer, Session Feel and post-session summary could be captured. The reconstructed Android 15 emulator baseline covers those flows on the original source commit, and the physical after-walk covers them on the updated build.
   NOT VERIFIED — Library animation is gated on completed technique review in the bundled manifest. The Library detail layout is captured.
   NOT VERIFIED — physical Android 15 and 16, Android 16 emulation, other viewport/font sizes, and disclosure states outside the evidence packets. Android 15 gesture clearance is captured on the emulator. The component gates exercise the added layout and touch-target contracts.
   NOT VERIFIED — encrypted restore on the physical phone would replace live athlete data. Encrypted restore evidence comes from the local SQLite suites.

4. **Judgment calls**
   Compact is the provisional default and Show All remains profile-slot scoped. The backup contract accepts precisely the two observed SQL texts for migration 082. The Plan cue appears when the measured rail overflows, and the Android clearance uses a gesture-bar fallback. The original and after workouts used different movements because the original workout aged into the earlier-session screen. The scratch athlete remains available for review.

5. **Next atomic action**
   Antigravity independently reviews the local commits, the two copy records and the paired device evidence with the owner.
