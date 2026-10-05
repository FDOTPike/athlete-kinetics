# Accessible coaching: orchestrator work orders

Prepared for Francis, 12 September 2026, Australia/Sydney. Consolidates both feedback messages. This is an implementation brief; no app changes or implementation tasks have been launched by its author.

## Master instruction for the orchestrator

Implement the work orders below through separate tasks. Target a tested build today, prioritizing input accessibility, clear onboarding, data backup, and an integrated first version of existing-activity support. Treat medical adaptation and live monitoring as separately validated capabilities. Do not describe every sport, every disability, or every wearable as supported without evidence. Report incomplete work explicitly; the deadline does not waive verification.

Read the current repository instructions and inspect the actual implementation before assigning file ownership. AGENT_WORKFLOW.md specifies offline runtime, deterministic TypeScript engines, strict typing, append-only migrations, and a 450 MB memory ceiling. Preserve these. Francis's current request authorizes the specified layout and copy changes despite the older UI freeze. Do not expand that authorization to unrelated redesigns or changes to movement eligibility.

The existing workflow identifies Fable as architect/reviewer and GPT-5.6 Sol at medium effort as builder. Retain those roles where available. Suggested Codex settings below are task-routing judgments, using models exposed by this host, rather than benchmark or completion-time promises. If a Codex orchestrator is needed, use GPT-6 Astra at high effort; use xhigh for the medical-policy and final safety review. Official model background: https://developers.openai.com/api/docs/guides/latest-model . The orchestrator may adjust settings to findings and available usage.

Before dispatch, establish a passing baseline and assign each task an exact allowed-file list. Use isolated branches/worktrees for implementation. Coordinate shared profile, store, schema, and onboarding files through one integration owner. Reserve migration numbers centrally. Do not let parallel builders assign the same migration slot. Return the required checkpoint bundles to the orchestrator; preserve existing owner ratification requirements for new training policies and schema decisions, with concrete proposals ready for review.

## Execution order and suggested task settings

| Task | Suggested model / effort | Dependencies | Target |
|---|---|---|---|
| WO-01 Keyboard and text inputs | GPT-5.6 Sol / medium | Baseline | Today, first |
| WO-02 Onboarding, tone, summary, effort language | GPT-5.6 Sol / medium | Coordinate shared UI with 01 | Today |
| WO-03 Backup and restore | GPT-5.6 Sol / high | Data inventory; include new schema in final integration | Today if round-trip verified |
| WO-04 Evidence and recommendation policy | GPT-6 Astra / high | Current engine audit | Today, before new prescription rules |
| WO-05 Existing routines, sports, custom activities | GPT-5.6 Sol / high | Shared contract and 04 policy | Today: smallest complete vertical slice |
| WO-06 Conditions and clinician instructions | GPT-6 Astra / xhigh | 04 and shared contract | Today: reviewed design; implement bounded validated scope |
| WO-07 Live heart-rate capability | GPT-5.6 Sol / high | 06; native capability audit | Today: feasibility and tests; live support only if verified |
| WO-08 Activity and movement coverage | GPT-5.6 Sol / high | 04–05 taxonomy | Today: inventory and priority batch |
| WO-09 Offline movement animations | GPT-5.6 Sol / medium | Stable movement IDs and 08 | Optional, after required work |
| WO-10 Integration and acceptance | GPT-6 Astra / xhigh | Completed work orders | Mandatory before release claim |

Start 01, 03, and 04 independently once ownership is settled. Run 02 after 01 if they touch the same files. Design 05 and 06 against a single shared profile contract before builders modify persistence. Re-test backup after those fields are integrated. Do not spend the remaining day on animation polish while core work is unfinished.

## WO-01: Keep every text input visible above the keyboard

Audit every editable field, including injury notes, onboarding, athlete profile, workout logs, search, custom routines, dialogs, and bottom sheets. Reproduce the injury-field issue. Implement appropriate keyboard avoidance, safe-area handling, scroll-to-focused-input behavior, and sufficient scroll space for multiline text. Keep the caret and relevant controls reachable while typing. Avoid keyboard dismissal consuming the first tap on a control.

Acceptance: test small-screen portrait with rotation locked, landscape, large text, multiline input, number keyboards, and keyboard open/close transitions on supported platforms. Verify real device or emulator behavior, not just component layout mocks. Provide an input inventory with pass/fail/unverified status. Saving, validation, and back navigation retain the user's text.

## WO-02: Clear, supportive onboarding and summaries

Change user-facing “fat loss” to “weight loss” throughout goals, summaries, help, and relevant content. Preserve persisted identifiers unless a tested migration is necessary. Audit language for shame, commands, and discouragement; use supportive choices without promising weight outcomes.

Stack experience and equipment choices vertically in all orientations. Wrap complete labels and descriptions without ellipses, forced one-line layouts, or sentence-fragment dashes. Do not require screen rotation. Give every experience/equipment option a labelled information button with an accessible expandable explanation or popover. “New to this” should explain the option in ordinary language. Selecting an option and opening its information must have predictable, distinct behavior. Use information icons, not unexplained eye symbols.

Replace the “extra work is damped, not rewarded” explanation with: “Choose a week that feels manageable. A realistic ceiling beats an optimistic one. You can change this later in Athlete Profile.” Match the final navigation label. Preserve underlying workload safeguards.

Rebuild Ready as spaced, scrollable sections: GOAL, EXPERIENCE, YOUR WEEK, EQUIPMENT, EXISTING ACTIVITIES, and TRAINING SUPPORT where applicable. Use uppercase headings and smaller sentence-case descriptions, retaining readable contrast and font scaling. Include edit links that return to the correct field and preserve other answers. Remove dash-separated text walls without indiscriminately stripping meaningful punctuation.

Use one default user-facing effort system. Proposed choice: RPE, labelled “Effort” and briefly explained as “How hard did that feel? 1 is very easy. 10 is your hardest effort.” Keep the selected scale consistent across help and workouts. Audit the reported “IRR” label and all RIR/RPE usage. RIR means repetitions remaining and cannot simply be relabelled RPE. Preserve engine semantics, make any strength-specific conversion explicit and tested, and put technical detail in an optional offline “Learn more” glossary. Do not apply a repetitions-remaining conversion to swimming or sports.

Acceptance: all options and summary values visible at narrow width and enlarged text; screen-reader labels and focus order work; no stale user-facing goal terminology; effort labels match stored values and engine meaning.

## WO-03: Backup users can find and restore themselves

First establish whether backup/export already exists and what it actually saves. Add a prominent “Back up and transfer data” entry in settings/profile, plus a short onboarding explanation. Offer “Create backup,” “Restore backup,” and simple new-phone instructions. Explain that a copy kept only on the same phone will not protect against losing that phone. Use the OS file picker/share sheet for user-directed storage, preserving zero-cloud app runtime.

Inventory all durable user data: athlete profiles, workout history, routines, goals, equipment, activity schedules, condition information, clinician instructions, preferences, and necessary identifiers. Distinguish a restorable backup from an optional CSV history export. Show the last successful backup time only after confirmed success, and be precise about what the OS action confirms.

Implement a versioned format and safe consistent database snapshot. Validate integrity and compatibility before restore. Preview what will be restored, state replace/merge behavior explicitly, protect existing data with a recovery copy, and restore atomically. Do not silently merge duplicates. Handle invalid, newer-version, truncated, cancelled, and low-storage cases without losing current data. Design appropriate encryption and clear password/recovery behavior for exported health information using established platform/library facilities.

Acceptance: transfer a representative backup to a fresh installation and compare all durable data, including new fields from 05–06. Test failure rollback. An unfamiliar user can follow the in-app steps without phone-settings knowledge.

## WO-04: Evidence-backed weekly recommendations

Create an evidence register before encoding new workload recommendations. Each rule needs its source, publication date, population, outcome, limitations, review date, and whether it is published guidance or a product heuristic. Include primary research for specific progression or sport-load claims; guideline summaries alone do not establish an optimal program for every experience level.

Selecting experience and goal should prefill an editable suggested starting week, with frequency, approximate duration, effort, and a concise “Why this suggestion?” explanation. Adapt to recent actual activity, available time, preferences, recovery, and applicable clinician restrictions. Distinguish long-term public-health guidance from a beginner's starting prescription. Do not guarantee weight loss or describe a fixed dose as universally best.

For competitive athletes, explain which existing sessions influenced the plan and what the app does not know. Experience alone must not justify higher workload. Changes should be deterministic, inspectable, and bounded; no runtime LLM or internet dependency.

Acceptance: a source-to-rule matrix and tests covering new beginner, returning athlete, intermediate recreational user, competitive athlete, limited time, missing history, and health restrictions. Each proposed numerical default is traceable to evidence or clearly identified as a heuristic pending ratification.

Evidence starting point: WHO recommends 150–300 minutes of moderate aerobic activity per week or equivalent for adult health. This is not a universal first-week target or proof of a weight-loss dose. https://www.who.int/europe/publications/i/item/9789240014886

## WO-05: Existing routines, sports, and miscellaneous activities

Ask “What activities do you already do?” separately from equipment. Capture walking, swimming, cycling, gym sessions, sport practice, matches, and custom activities. Pool access is a facility; swimming is an activity. Support wheelchair/adaptive activities and neutral user-defined names.

Capture recurring day/time, duration, timezone, expected effort, fixed versus flexible timing, and optional body-region demands. Support one-off events, missed/cancelled sessions, changes, and actual completion. Ask about recent typical activity so existing habits are not treated as new workload.

Preserve fixed commitments such as Friday basketball at 5 pm. Explain changes to nearby coach sessions. Count existing activity toward relevant weekly totals without treating every activity as interchangeable with strength work. Reconcile planned and completed sessions without double counting; update recommendations when activity is skipped or unexpectedly hard.

Use a custom activity path for hobby horsing, horse riding, skiing, snowboarding, surfing, and other niche activities. Duration and user-reported effort can provide a rough load estimate. Optional impact/body-region questions add context. Unknown demand remains unknown; do not invent an exact sport-specific muscle load or injury threshold. Any duration-times-effort model requires sourced limitations and must not be presented as a clinical safety score.

Acceptance: beginner who swims keeps swimming in the suggested week; walking counts; Friday sport remains scheduled; an extra strenuous session influences the next recommendation; an unknown hobby can be saved and accounted for; overlapping, midnight/timezone, and cancelled events behave correctly. Preserve normal operation for users with only personal goals and no sport commitments.

## WO-06: Disabilities, health conditions, and clinician instructions

Extend beyond injury notes with optional “Health and training support.” Capture functional needs and limitations without requiring a diagnostic label. Include seated/recumbent preference, positional-transition concerns, rest needs, symptom triggers, and user-entered clinician instructions where relevant. Allow editing, deletion, and privacy controls.

Represent actionable clinician limits as structured values with units, applicability, source recorded as user-reported unless actually verified, date, and review/expiry information. Keep free text as notes; do not silently translate prose into executable restrictions. Offer explicit user confirmation of structured entries. A entered note is not verified medical clearance.

Design a clinically reviewed screening flow with concrete triggers and pending, cleared-with-restrictions, and review-required states. Request clinician guidance when indicated; disability alone must not automatically exclude someone from all app use. Preserve history and non-prescriptive functions when personalized recommendations are held. Undefined or conflicting restrictions must not be guessed away.

Apply restrictions consistently to generation, substitutions, progression, custom-session warnings, and session execution. A clinician limit outranks goal optimization. Include symptom check-ins and the ability to stop, rest, or reduce a session. For POTS, do not implement automatic weekly escalation or universal fluid/salt advice; use individual tolerance and clinician guidance, including the possibility that symptoms worsen after activity. Hydration reminders follow an appropriate individual plan.

Acceptance: review concrete POTS and other functional-limitation scenarios; test missing clearance, conflicting instructions, changed limits, symptom worsening, offline persistence, deletion, and all prescription entry points. New clinical rules need qualified clinical review before being represented as validated medical adaptation.

Clinical context: Johns Hopkins describes POTS treatment as individualized and exercise progression as tolerance-based rather than rigid. https://www.hopkinsmedicine.org/health/conditions-and-diseases/postural-orthostatic-tachycardia-syndrome-pots

## WO-07: Clinician heart-rate limits and wearable warnings

Audit packages/biometrics and native integrations first. Distinguish historical health-data imports from a genuinely live stream. Produce a supported-device/platform matrix with foreground, background, lock-screen, permission, pairing, and reconnect behavior. Do not infer live support from an installed health-data dependency.

For a supported live source, pass heart-rate samples with timestamps, freshness, and connection state into a deterministic limit evaluator. A clinician-entered 150 bpm ceiling is an example input, never a default for POTS. Define threshold-boundary behavior and warning timing explicitly; avoid silently delaying a clinician-limit warning. Present readable warnings, sound/haptics where supported, and the applicable instruction to pause/recover. Test exact boundary, over-limit, repeated events, sensor artifacts, and changed limits.

Always display disconnected/stale/unavailable monitoring. Never show “safe” because there is no reading. Explain that the app can warn on received data but cannot guarantee heart rate stays below a limit or replace a medical monitor. If continuous monitoring is a requirement of the individual's plan, make that requirement visible and do not offer a misleading monitored workout when it cannot be met.

Acceptance: automated sample-replay tests plus native hardware evidence for each claimed integration. If no live integration can be verified today, deliver the capability assessment and clearly unavailable UI state; do not claim live alerts are shipped.

## WO-08: Audit missing movement and activity coverage

Inventory the current library, facilities, equipment, and activity taxonomy. Produce a coverage matrix: supported, missing, duplicated, needs adaptation, and unsupported prescription. Prioritize walking, swimming, cycling, everyday recreational activity, and common team sports before obscure movement variants.

Keep sport-session logging distinct from coached exercise instructions. Add a bounded, reviewed batch using existing curation and migration rules. Do not weaken beginner whitelists to increase coverage. Unknown/custom activities should already be usable through 05 without waiting for exhaustive research.

Acceptance: no claim to cover every sport; added records have valid equipment/facility requirements, understandable instructions, effort/duration fields where appropriate, and evidence for any programming rules. Publish remaining coverage work with priorities.

## WO-09: Optional offline movement animations

Prototype a small consistent character using about three frames for a few representative movements. Prefer lightweight local vector/sprite assets and a reusable renderer; no network needed. Put the preview next to the existing video affordance, with tap-to-play, pause, reduced-motion support, a useful still image, and text instructions. Avoid making every list item animate at once.

Validate that each animation accurately depicts its specific movement; do not reuse a generic squat for mechanically different exercises. Cover every applicable movement only after the prototype and technique review pass. Record movement IDs as covered, intentionally unsuitable, or pending, with reasons. Include app-size and memory impact. Complex movements may require more frames or a clearer still sequence.

Acceptance: previews work in airplane mode and remain legible at small sizes; reduced-motion preferences are respected; technique review passes; measured performance fits repository limits. This order is optional and must not displace required work.

## WO-10: Integration and release evidence

Run npm run typecheck before any commit, affected repository gates during implementation, and the required verification suite at integration. Report environment-dependent failures distinctly from passes. Component tests cannot prove native keyboard or wearable behavior; include device/emulator evidence and explicitly list untested platforms.

Exercise complete journeys: older beginner with large text and rotation locked; beginner with weight-loss goal and existing swimming; athlete with Friday sport; user with a niche custom activity; user with clinician restrictions and missing monitoring; existing installation upgraded and restored to a new phone. Check offline operation, screen-reader navigation, edit persistence, schema upgrades, source-linked explanations, and no duplicate workload counting.

Deliver a checkpoint/handover with changed files, test evidence, screenshots where useful, accepted policy decisions, unresolved issues, and exact shipped scope. Distinguish implemented, verified, design-only, and deferred. A same-day build is a target; unverified clinical logic and unsupported continuous monitoring are not release-ready because the clock ran out.

## Copy-paste dispatch instruction

Orchestrator: use this document as the consolidated work order for both of Francis's feedback messages. Create bounded implementation tasks with the suggested models and effort levels, refine file ownership and dependencies after inspecting current code, and execute the required work toward a tested build today. Preserve offline deterministic architecture. Start with keyboard accessibility, then onboarding clarity; pursue backup and evidence research independently. Integrate existing activities with weekly planning and clinician constraints through one shared data contract. Bring concrete new policy/schema decisions to the existing review checkpoint. Finish with an honest tested/untested/deferred report. Only spend remaining capacity on offline movement animations once required work is complete.
