# Accessible Coach WO-05 — Factual Activity UI and Store Adapter

## 1. Status and authority

- Date: 2026-09-13.
- Branch: `codex/accessible-coach-2026-09-12`.
- Parent: `addd25854570b6a81e2b856a16711c7381f6d7c1`.
- Controlling decisions: `docs/decisions/ACCESSIBLE_COACH_ASTRA_OWNER_RULINGS_2026-09-13.md` D01–D06, SC-01–SC-06, and PO-TAXONOMY-01.
- Status: `IMPLEMENTATION CANDIDATE — FULL VERIFICATION PASSED; EXACT-TIP APK AND NATIVE CHECK PENDING`.
- Merge, tag, release, and C6: not performed.

## 2. Implemented vertical slice

### 2.1 Offline store adapter

- `apps/mobile/src/state/activityStore.ts` is the application adapter for Migration 064. It reads and writes only athlete-local SQLite through the existing synchronous DB boundary.
- Stable activity definitions can be explicitly reused. Names may be corrected while the activity-kind identity cannot be silently relabelled.
- A weekly series records weekday, optional local time, IANA device timezone, fixed/flexible commitment, optional expected duration, and optional whole-session Effort 1–10.
- One-off occurrences record planned, completed, missed, or cancelled facts. Planned occurrences can later receive a separately stored actual completion.
- Missing duration and effort remain `NULL`. The adapter never computes duration × effort, cross-sport equivalence, a safety score, RIR, or a coach dose.
- Fixed one-off events are resolved only in the device timezone. A nonexistent or transition-affected local time is refused, and a duration is required so the end instant is not invented.
- Ending a weekly schedule versions and dates the series. It does not delete the definition or occurrence history.
- The completed 28-local-day summary counts canonical occurrences once and reports known minutes plus duration missingness separately. The current weekly total similarly reports only explicit expected minutes.

### 2.2 Athlete-facing activity ledger

- `apps/mobile/src/screens/ActivitiesScreen.tsx` is reachable from a distinct `EXISTING ACTIVITIES` section in Athlete Profile, not from the strength-equipment inventory and not through a new root tab.
- The form supports the ratified 15-kind taxonomy including a neutral custom path; broad demand, facility, activity equipment, cycling modality, and occurrence purpose remain explicit/unknown rather than inferred from a name.
- Pool access is presented as a facility while swimming is the activity. Activity equipment is not copied into strength-movement eligibility.
- The screen supports weekly fixed/flexible schedules, factual one-off states, logging actual duration/optional effort, explicit missed/cancelled actions, schedule editing, and non-destructive schedule ending.
- A saved activity must be deliberately selected before a later occurrence reuses its identity. There is no fuzzy or near-time merge.
- The Plan screen shows current weekly external commitments in a read-only disclosure. It explicitly states that this slice does not silently move, add, remove, or intensify coach sessions.

### 2.3 Store lifecycle

- The factual ledger hydrates after Migration 064 during boot, refreshes after every activity mutation, resets before an athlete database switch, and refreshes its 28-day window on local-date rollover.
- Activity logging remains available independently of prospective-advice review holds, consistent with SC-06's retrospective-logging boundary.

## 3. Verification

- `npm run typecheck`: pass.
- Focused activity adapter, activity screen, Profile navigation, and Plan disclosure run: 4 suites / 91 tests passed.
- The adapter suite executes the real Migration 064 SQL on in-memory SQLite and verifies weekly create/edit/end, stable definition reuse, one-off completion, missingness, 28-day accounting, planned-to-completed/missed/cancelled transitions, invalid-date refusal, and fixed-event non-invention.
- Full `npm run verify:ci`: pass — all 22 verification stages completed; 29/29 component suites and 478/478 component tests passed.
- `git diff --check`: pass after the verified implementation and handover update.
- Exact-tip QA APK and emulator journey: pending.

## 4. Explicit boundaries and deferred work

- No automatic starter activity dose and no experience-only uplift.
- No automatic coach-session rescheduling, progression change, fatigue budget, or reaction to a skipped/high-effort external activity. Those require the separately reviewed recommendation policy; this UI does not imply they exist.
- Weekly series are stored as civil recurrence facts and are not yet materialized into DST-resolved occurrences. The bounded UI refuses transition-affected fixed one-offs rather than asking the still-unimplemented earlier/later-offset question.
- The separately dated typical-week report UI is not implemented. Current recurring commitments and the prior 28 completed local days remain distinct factual surfaces.
- Optional body-region demand capture is not implemented because Migration 064 contains only the ratified broad non-medical demand field.
- Multiple facilities/equipment facts can exist in the contract, but this first editor exposes one simple fact per category and deliberately does not erase a richer multi-row record it cannot faithfully display.
- No imported/coached-session reconciliation UI, source-link editor, midnight-overlap planner, clinician-instruction UI, prospective-advice hold enforcement, native encrypted backup, iOS/TalkBack/VoiceOver acceptance, physical-device run, C6, release signing, merge, tag, or release.

## 5. Audit entry points

1. Freeze HEAD/tree/status and audit the complete range `addd25854570b6a81e2b856a16711c7381f6d7c1..HEAD`.
2. Execute `ActivitiesStore.test.js`; inspect every write for stable identity, transaction rollback, NULL missingness, fixed-time truth, and one-count completion.
3. Execute `ActivitiesScreen.test.js`, the WO-05 Profile test, and the Plan disclosure test; verify the user must explicitly choose reuse and every state change is a direct action.
4. Confirm no new runtime network call, clinical computation, duration-times-effort calculation, RIR conversion, fuzzy merge, or strength-equipment entitlement exists.
5. Treat Section 4 as declared non-implementation, then report any product copy or handover claim that crosses it.
