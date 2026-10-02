# Work order 2 — goal and focus questions

Audit, fix and validation record. 2026-10-02, Claude Opus 5.5 in Claude Code
Desktop. Baseline and prerequisite strategy: [BASELINE.md](BASELINE.md).
Stacked on work order 1 ([WO1_PREPARATION.md](WO1_PREPARATION.md)).

## What was found

| # | Finding in the baseline | Where |
| --- | --- | --- |
| 1 | Onboarding asked one "what are we training for?" objective and nothing about an area the athlete wants to work on. No focus existed anywhere in the data model. | `OnboardingScreen`, `athlete_profile` |
| 2 | Muscle information existed only as free display text (`movement_detail.target_muscles`, 29 distinct spellings such as `middle back`, `spinal_erectors`, `pectorals`). There were no canonical ids, no aliases, and no primary/supporting role a planner could rely on. | `049`–`052` content migrations |
| 3 | There were no goals. Nothing recorded an outcome, a measurement method, a baseline, a target, a reason or a deadline. | — |
| 4 | `completeOnboarding` wrote into whichever athlete database happened to be open when the athlete pressed START. An athlete switch while the interview was open would have saved one person's answers into another person's file. | `useStore.completeOnboarding` |
| 5 | A refused onboarding save was silent: the store set an error that the onboarding screen never displayed. | `OnboardingScreen` |
| 6 | Component tests pinned a seven-screen interview. | `ProfileScreens.test.js`, `ProgramQualityRound2.test.js` |

## What was built

**The question.** The focus slide asks exactly *"Is there an area that you
want to work on?"* (`FOCUS_QUESTION`, pinned by the pure verifier and by the
screen test). Four bundles start the answer and every one is editable:

| Bundle | Starts from | Notes |
| --- | --- | --- |
| Posture | upper back, rear shoulders, core | also asks for movement control |
| Beach muscles | biceps, triceps, upper chest | arms and upper chest |
| Lower body | glutes, quads, hamstrings, calves | |
| Balanced whole body | no emphasis | the starting answer — nothing is assumed |

"Choose muscle groups myself" shows all 17 groups in plain gym language
(Quads, Lats, Core and abs, Rear shoulders, Inner thighs, Outer hips…). Up to
six can be selected; more than that is no longer an emphasis and the screen
says so. **Nothing about the athlete is an input to the default** — no gender,
age or tier inference exists; `normalizeFocusSelection` takes the selection and
nothing else, which the verifier pins.

**Canonical ids and verified aliases** (`066_focus_and_goals.sql`,
`focusGoals.ts`). 17 `muscle_group` rows. 39 aliases of two kinds:
`library_term` — all 27 muscle spellings that actually occur in the
300-movement library — and `gym_term` — twelve common names. A word that could
mean two groups ("arms", "back", "legs") is deliberately **not** an alias:
guessing would be inventing a preference. Two library terms (`full_body`,
`cardiovascular`) name no muscle group and stay unmapped.

**Explicit movement mapping** (`movement_muscle_role`, 794 rows, 299 of 300
movements). Two provenance-recorded rules, both stored per row in `source`:

- `library_target_muscles` — position 0 of the library's own
  `target_muscles` list is the upstream primary muscle, later positions are
  the upstream secondary muscles (that order is how
  `scripts/generate-library-v2.mjs` writes it).
- `incline_press_rule` — the four incline **presses** whose library primary
  is the chest (ids 65, 134, 212, 216) are also primary for the upper chest.
  Basis: Trebs, Brandenburg and Pitney, *J Strength Cond Res* 2010;
  24(7):1925–1930. Listed by reviewed id, not matched by name, so a later
  name correction cannot change who it applies to on replay. Incline
  push-ups, incline flyes, 218 (identity is an open content question) and
  the held ids 135/187 are excluded and the migration header says why.

`movement_detail.target_muscles` is untouched; movement ids, aliases, asset
keys and history are unchanged. One movement (BJJ Sparring Round) has no
muscle mapping and therefore matches no focus — absence is never a match.

**SMART goals** (`validateSmartGoal`, `athlete_goal*`). Every element is
required: a specific outcome; what is measured, **how**, and in what unit; a
baseline **or an explicit "I do not know yet"** (which stores no number); a
target; a personal reason; a requested deadline **or an explicit "no
deadline"**. The deadline is the athlete's own date and is kept apart from the
four-week review horizon (`PLAN_REVIEW_WEEKS`); the editor says the plan is
never rushed, peaked or tested to a maximum for a date.

**Feasibility without invention** (`assessGoalFeasibility`). The app states
the gap and the weekly rate as arithmetic, always with the same uncertainty
sentence, and never promises. Only one external reference is used — the CDC's
gradual weight-loss rate (about 1–2 lb a week), and only for a body-weight
*reduction* goal, with "this app does not provide a diet plan or medical
advice". For every other measurement the app says it has **no reviewed
reference** for how quickly that measurement changes. Experience tier changes
nothing, because no tier-specific rate was verified. (The ACSM percentage
figures often quoted for strength gain could not be verified from a primary
source in this session and are not used.)

**Real observations only** (`goalProgress`, `athlete_goal_observation`).
Progress is computed from measurements the athlete recorded, each with its
date, unit and the goal revision it was taken under. With no measurement the
app reports no progress; training volume is never a stand-in. The database
accepts only `source = 'athlete_entered'` on a real, non-future date.

**Editing without rewriting.** A goal edit appends a revision (compare-and-set
on the revision the editor was shown, so a duplicate tap cannot apply twice).
Triggers make revisions and observations immutable, keep `current_revision`
moving forward, and cap active goals at five. Changing a focus or a goal
writes nothing to `planned_slot`, `planned_session` or `training_block`; the
panel says the new focus is used when the next block is created.

**Onboarding.** Eight screens: welcome, goal, **focus**, experience, week,
equipment, limits, review — nine when the athlete opts into the detailed
target. "Skip this — train with the focus only" discards a half-written
target. A started target must be finished or skipped; NEXT stays disabled and
says why. The review screen has a FOCUS section with its own edit link.

**Atomic, athlete-bound save.** `beginOnboardingDraft()` captures the active
athlete and the store's athlete-context revision when the interview opens —
the same revision counter that already guards asynchronous health-sync and
report writes. `completeOnboarding` refuses when either has changed or the
open database belongs to someone else, validates focus and goal before
`BEGIN`, and writes profile, load preference, focus and goal in one
transaction. A refusal is shown on the review screen ("Not saved. …").

**Profile.** `FocusGoalsPanel` on the Athlete profile reviews and edits the
focus, adds/edits/retires goals, and records or removes measurements.

**Lifecycle.**

| Event | Focus | Goals and revisions | Measurements |
| --- | --- | --- | --- |
| Training-data reset | kept (stated intention, like the profile) | kept | deleted (measurement history) |
| Athlete deletion | removed with the athlete's database file | same | same |
| Athlete switch | per-athlete; re-read on boot | same | same |
| Backup / restore | round-trips | round-trips, every revision | round-trips |

**Backup contract.** v65 (slot 066: 114 tables, 198 schema objects) is
appended to the registry; v63 and v64 entries are unchanged. Restore of every
registered pre-upgrade schema is now tested, not only the first.

## Decisions an owner may want to revisit

1. *Posture* starts from upper back, **rear shoulders** and core. The brief
   said "upper back/core and movement control"; rear shoulders were added
   because the library tags most scapular-retraction work there. It is one
   tap to remove.
2. *Beach muscles* is biceps, triceps and upper chest exactly as briefed.
   Forearms and shoulders are not included.
3. Six areas is the emphasis limit; five is the active-goal limit. Both are
   product choices, enforced in the store and the database.
4. A reset keeps goals and focus and deletes measurements.
5. Demo-athlete onboarding saves no focus (balanced is used) and no goal.

## What this work order does not do

- It does not change programming. The focus is stored and shown; **work
  order 3** makes focus, goal, sport and workload change allocation,
  selection and progression. Until then the panel's wording ("used when your
  next block is created") describes work order 3's behaviour, and this
  commit must not ship without it.
- It does not ask sport questions (work order 3) and does not touch movement
  text (work order 4) or any animation asset, frame, manifest or approval
  state.
- No native-device acceptance is claimed. Everything below ran on desktop.

## Validation

All on desktop, Windows 11, Node 24, 2026-10-02.

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run verify:migrations` (38 checks for 066: seed, provenance, guards, upgrade from 064/065, replay, self-heal) | exit 0 |
| `npm run verify:backup` (v63, v64, v65 contract pins) | exit 0 |
| `npm run verify:preparation` (now also `verify_focus_goals.mjs`, 61 checks) | exit 0 |
| `npm run verify:store`, `verify:blocks`, `verify:pipeline` | exit 0 |
| `npm run verify:components` (75 suites, `--no-cache`) | 1660 tests; 1656 passed on the first run, 4 failed in `BackupForwardRestore` on a wrong pin of mine (see below); the three work order 2 suites re-run `--no-cache` after the correction: 53 of 53 passed |
| `FocusGoalStore.test.js` (real store, two athlete databases) | 25 passed |
| `OnboardingFocusGoal.test.js` (real store behind the real screens) | 12 passed |
| `BackupForwardRestore.test.js` | 16 passed |
| Negative controls | 23 of 23 detected — [evidence/WO2_NEGATIVE_CONTROLS.md](evidence/WO2_NEGATIVE_CONTROLS.md) |

The full integrated `verify:ci` for this commit is run in a separate clean
checkout and its exit code is recorded in the final report.

### A defect in my own evidence, found and corrected

I first pinned the seeded mapping at 799 rows. That number came from a run in
which jest's transform cache served an **older copy of migration 066** (the
name-based incline rule, which I had already replaced with reviewed ids). The
full `--no-cache` suite disagreed: 794. A direct diff of a fresh database
against a forward-migrated one confirmed 794 is correct (four incline-rule
rows, not nine) and that the cached runs were the wrong ones. The pin and this
document now say 794, the shared jest cache was cleared, and the negative
controls run with `--no-cache`. CI already runs the component suite with
`--no-cache`, which is why it caught this.
