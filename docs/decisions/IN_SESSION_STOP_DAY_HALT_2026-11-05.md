# In-Session Stop Closes the Day: Decision Record

Date: 2026-11-05
Status: PROPOSED (ratified when the owner merges the pull request)
Issues: #179, #181, #187

## Rules (2026-11-05)

> #179: a Stop reached through 'Report discomfort' sets the day halt that a Plan report at halt level sets: every start is blocked today and every screen shows the halt. A manual 'Stop session' does not halt the day.

> #181: a report-driven Stop closes the session and says 'stopped'; the completion summary lists the reports and regions. A manual stop keeps 'paused' while the session can still be finished.

> #187: after a report-driven Stop the prompts say 'You stopped today's session after a report'; after a manual stop with no sets they offer to repeat the planned session; otherwise 'No session is ready to start'. Never 'there is no plan'.

## Why

On the Android walk of 2026-11-03 (W5-2), an athlete reported wrist discomfort at Stop inside a workout. The running session halted, but nothing else did: Today offered an extra session, READY said "Train steadily today", Plan invited a start, and each start opened a new session at once. A Plan report at the same level halts every screen. This is new safety behaviour in the stricter direction: a report that already stopped the session now also stops the day.

## What changes

- **What counts as a report-driven Stop.** A "Report discomfort" report at or above the athlete's stop level: the same experience-weighted level (`EXPERIENCE_SEVERITY[tier].haltMin`) at which the form already says "At this level the session stops for today" and at which the session runner already halts the session. No threshold, chip value or severity gate changes.
- **The day halt is recorded where a Plan halt is.** `reportNiggle` writes, in the same transaction as the niggle, one `subjective_report` row with `halt = 1` and the severity in `report_severity`. The report is a region and a severity, not text the phrase codebase matched, so the row has `matched_entry_id = NULL`. Its `raw_text` reads "Report discomfort during a session: Wrist, 8 of 10. Session stopped." No migration: the 005 schema already allows a halt row with no matched entry.
- **Every halt check sees it.** Every halt check in the app reads the derived prescription (`lastTriage`). `computePrescription` now also reads today's halt rows with no matched entry and passes them to `derivePrescription` as a recorded halt (`wasHalt: true`) under one fixed entry, `SESSION_REPORT_STOP_ENTRY` in `apps/mobile/src/state/sessionReportStop.ts`, whose cue is "You stopped today's session after a report. No more training today." The entry lives in the app, not in `phrase-codebase.json`: it is never embedded or routed. With no readiness vector, where the derivation does not run, the same halt is still set, because a halt does not depend on readiness. So `startSession`, `logSet`, Today, Plan, READY and the workout screen all treat it as they treat a Plan halt, and it survives a restart.
- **The session closes.** After the report is saved, the store finishes the session (`endSession`). It is recorded as `stopped_safely`, with or without logged sets, as a niggle halt already was. If finishing fails, the session stays halted with its Finish button.
- **Wording.** A session halted by a report (or a safety halt) is titled "Session stopped"; a manual stop keeps "Session paused". The report halt copy says the session "has stopped for today". After a report-driven Stop, Today, Plan and the workout tab say "You stopped today's session after a report." The empty-start card no longer says "There is no plan for today": it says "No session is ready to start" and "Open your plan to see your next session."
- **Summary.** The completion summary lists each "Report discomfort" report made during the session, with its region and severity ("Report: Lower back · Stop (8 of 10)"). A niggle carries no session id; sessions never overlap, so a report belongs to the session whose start and finish enclose it.

## What does not change

- A manual "Stop session" writes no halt and does not block another start. A manual stop with no sets is discarded as before, which frees today's planned session, so the next start is that planned session again (#187's "offer to repeat the planned session").
- A report below the stop level does what it did: it is saved and may offer an alternative; it halts neither the session nor the day.
- No change to the keyword layer, the phrase codebase, the severity gate, `EXPERIENCE_SEVERITY`, the session runner, `derivePrescription`, or any migration.
- The day halt cannot be withdrawn the same day (D10).

## Checks

- `apps/mobile/test/components/SessionReportStopDayHalt.test.js` (real store over the production migration chain): a Stop report records the halt row, closes the session as `stopped_safely`, and refuses every start that day; the same with no sets logged; the halt survives a restart; Moderate stops an elite athlete's session and day; a Mild report halts nothing; the summary facts list each report; a manual stop does not halt the day, with or without sets.
- Component tests: "Session stopped" vs "Session paused" by halt reason; the idle workout screen, Today and the summary wording.
