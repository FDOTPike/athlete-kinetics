# Work order 3 — sport selection and goal-responsive programming

Audit, fix and validation record. 2026-10-02, Claude Opus 5.5 in Claude Code
Desktop. Baseline and prerequisite strategy: [BASELINE.md](BASELINE.md).
Stacked on work orders 1 and 2. Sources and rules:
[../../coaching/SPORT_PROGRAMMING_PROVENANCE.md](../../coaching/SPORT_PROGRAMMING_PROVENANCE.md).

## What was found

| # | Finding | Where |
| --- | --- | --- |
| 1 | The app never asked which sport an athlete plays. The only sport-shaped input was the `hybrid` objective, which is a BJJ split. | `OnboardingScreen`, `Objective` |
| 2 | The focus saved by work order 2 was stored and shown but read by nothing: the generator's inputs were profile, movements, schema and the autopilot report. | `generateBlock`, `BlockInput` |
| 3 | The weekly Activities schedule (064) was displayed beside the plan and deliberately did not influence it. A new block took no account of how full the athlete's sport week was. | `BlockScreen`, `generateNewBlock` |
| 4 | A goal such as "squat 100 kg" could not put the squat in the plan: goals had no link to a movement. | `athlete_goal*` |
| 5 | Nothing explained why a plan contained what it contained beyond ranking and time notes. | `ProgramSetupScreen` |
| 6 | The muscle mapping from work order 2 exposes library gaps that matter for sport: no jump or sprint drills, no adductor-strengthening exercise, one rear-shoulder primary. | `movement_muscle_role` |

## What was built

**The sport question** (`sportProfile.ts`, `SportFields.tsx`). Offered on the
focus slide; the sport screen joins the interview only when the athlete says
they play a sport (8 screens without, 9 with, 10 with a target as well).
Families first — basketball, football, hockey, powerlifting, Muay Thai,
another sport — then an explicit second question where a family has more
than one code: association / Australian / rugby / American football, field /
ice hockey. The app never picks a code. "Another sport" is named in the
athlete's own words and is a supported answer.

Then: the outcome wanted from gym training (per sport, always ending with
"general strength for my sport"), how long they have played, practice
sessions and matches in a normal week (each starts at **Not sure**, stored as
NULL, never zero), an optional usual session length, and an optional next
competition.

The moment an outcome is chosen the screen shows what the plan will do, what
it cannot do, and the published basis — before anything is saved.

**Stored as a side-car** (`067_sport_and_emphasis.sql`,
`athlete_sport_profile`). `athlete_profile.objective` and its CHECK are
byte-for-byte unchanged, and so is the activity kind list: a sport objective
is neither an objective value nor an activity kind. Verified by comparing
the table definitions before and after 067.

**Workload from schedule evidence** (`resolveSportWorkload`,
`readScheduledSportSessions`). Weekly `activity_series` rows in effect on the
block's start date are the evidence (gym strength sessions and low-demand
activities excluded, each counted entry named). The numbers stated with the
sport answer are used only while the schedule is empty. They are never added.
Unknown durations stay unknown and no load score is computed. Reading the
schedule writes nothing to it.

**The engine** (`programEmphasis.ts`, `blockGenerator.ts`,
`movementRanking.ts`). One additive side-car, `BlockInput.emphasis`. Absent
⇒ byte-identical output (the whole existing `verify:blocks` suite passes
unchanged, and the new verifier compares JSON). When present it changes:

| | What changes | Bound |
| --- | --- | --- |
| Movement selection | A default may become a same-pattern movement that trains an emphasised muscle directly. | Same loading class and compound class; a main lift keeps its own primary muscles; anchors, explicit choices, goal exercises and curated power rungs are untouched. |
| Weekly allocation | One accessory slot a week per pattern may go to an emphasised muscle with no direct work yet. | Only the last accessory slot; the displaced movement must be trained another day; never the first two slots; nothing added beyond the slot budget. |
| Goal exercise | The exercise a goal names takes its pattern's slot, or one spare accessory slot a week. | Only from the gated pool; below the athlete's explicit slot choice. |
| Competition lifts | Powerlifting promotes squat, bench and deadlift as main lifts on any objective. | Loaded-first mode only (not beginners or rehab); gates apply. |
| Dose | 3–4 sport sessions a week: one set off each accessory. 5+: two sets, never below one. | Strength days, weeks 1–3; never main lifts, never the deload. |
| Progression | 5+ sport sessions: week 3 repeats week 2. | Nothing is ever raised. |

Safety, capability, equipment, tier and time are structurally ahead of all of
it: the emphasis only ever reads the pool that has already passed them, and
the session-time fit runs afterwards on whatever was chosen.

**Explanation** (`EmphasisReport`, `EmphasisReportCard`). The generator
returns what it applied and what it could not, in plain language, including
the reason a goal exercise was left out (equipment, experience level, not
available, the athlete's own slot choice, no slot) and the library gaps. The
program preview shows it before the plan is created; the coach screen shows
the copy frozen with the block.

**Frozen with the block** (`block_emphasis`). Inserted in the block's own
generation transaction; immutable by trigger; removed with the block. If it
cannot be written the block is not created. Later edits to focus, goals or
sport never rewrite a plan or its explanation. Every block-creating path
first clears any row under the new block id, so a reused id cannot inherit an
old explanation.

**Goal exercise link** (`athlete_goal_movement`). Optional, asked only for
goals measured on an exercise. A separate table, so the append-only goal
revisions from work order 2 are untouched. Saved in the same transaction as
the goal.

**Onboarding.** The sport answer and the goal exercise are validated before
`BEGIN` and written in the same transaction as the profile, focus and goal,
still bound to the athlete and store context the interview was started for.

**Lifecycle.**

| Event | Sport answer | Goal exercise link | Block explanation |
| --- | --- | --- | --- |
| Training-data reset | kept | kept | deleted with the blocks (explicitly, foreign keys on or off) |
| Block archived | — | — | kept with the archived block |
| Goal deleted | — | removed with it | — |
| Athlete switch / deletion | per-athlete file | same | same |
| Backup / restore | round-trips | round-trips | round-trips, immutability guard included |

**Backup contract.** v66 (slot 067: 117 tables, 203 schema objects) appended;
v63, v64 and v65 entries unchanged; a v65 backup carrying focus and goals is
restore-tested.

## Accepted constraints preserved

- The Activities ledger is read, never written, by this work. The existing
  statement on the coach screen — activities are shown beside the plan and do
  not silently move, add, remove or intensify coach sessions — stays true: an
  existing plan is never changed; a new block may plan fewer accessory sets,
  never more, and says so in its explanation.
- No cross-sport load score is computed.
- A competition date confers no peak or testing authority (the existing
  review-boundary ruling for dated programs is untouched).
- Movement animation, frames, manifests and approval states are untouched.
  Ids 135 and 187 are never newly prescribed by the emphasis.

## What this work order does not do

- Preparation (work order 1) is not changed by the sport answer. It already
  adapts to a sport or conditioning session; whether a sport athlete's gym
  days should carry sport-specific preparation is an open product question.
- Athlete-authored routines are not altered by the emphasis: they are the
  athlete's explicit choice.
- Session days are not moved around scheduled sport. The schedule's weekdays
  are carried in the workload for a later decision; today only the number of
  sessions is used.
- No native-device acceptance is claimed. Everything below ran on desktop.

## Open questions for the owner

See "Owner decisions" in the provenance document: the workload cut points and
effects, which schedule entries count, whether a goal exercise should outrank
a strength anchor, the muscles per outcome, rugby codes, and the BJJ naming of
hybrid sport rounds.

## Validation

All on desktop, Windows 11, Node 24, 2026-10-02.

| Check | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run verify:preparation` (now also `verify_emphasis.mjs`: 101 checks on the real 300-movement library and its real muscle mapping) | exit 0 |
| `npm run verify:blocks` — the whole pre-existing block suite, unchanged, proving the no-emphasis path is byte-identical | exit 0 |
| `npm run verify:migrations` (24 checks for 067: side-car proof, guards, upgrade, self-heal) | exit 0 |
| `npm run verify:backup` (v63–v66 contract pins) | exit 0 |
| `npm run verify:pipeline`, `verify:store`, `verify:progression`, `verify:db` | exit 0 |
| `npm run verify:components` (77 suites, `--no-cache`) | 1701 of 1701 passed, exit 0 |
| `SportEmphasisStore.test.js` (real store, two athlete databases) | 25 passed |
| `SportScreens.test.js` (real store behind the real screens) | 14 passed |
| `BackupForwardRestore.test.js` (v63, v64, v65 forward restore; 067 round trip) | 18 passed |

Full integrated `npm run verify:ci`:

| Where | Result |
| --- | --- |
| Development lineage, the work order 3 commit, separate clean checkout | exit 0 (25 gates there; 77 suites, 1701 tests) |
| Development lineage, with both later fixes | exit 0 (78 suites, 1710 tests) |
| Published branch at its first published tip, hosted CI on pull request 24 | "Verification suite (23 gates + typecheck)" passed |
| Top of the published stack (all four work orders), local | exit 0 (23 gates; 55 suites, 877 tests) |

This branch's own tip was **not** run through the full local `verify:ci` on
the published base; the hosted run on pull request 24 is that check
(`claude/coaching-wo3-sport-programming`).

Negative controls (`scripts/coaching/negative-controls-wo3.mjs`): the first
complete run detected 32 of 35. The three misses were weaknesses in the tests
(one equivalent mutant, two scenarios no test exercised), not engine defects.
`verify_emphasis.mjs` was strengthened, one mutation was corrected and one
added, and the re-run detects 36 of 36. Both runs are recorded in
`evidence/WO3_NEGATIVE_CONTROLS.md`. No engine source changed between them.

Independent review of the final diff then found one engine defect: a goal
that named held movement 135 or 187 had it planned through the goal-exercise
rule. Fixed (a held movement is skipped on both goal paths and the athlete is
told it is on hold), with three new checks and two new mutations: 38 of 38
detected. That fix is later than the first run in the table above and is
covered by the others.

The negative-control script was later made stricter (a gate must pass
unmutated, and must report a failure of its own under the mutation) and
re-run in full: 38 of 38 detected.

### What the real store showed that the pure verifier could not

The pure verifier marks every movement capability-available. The real store
does not: a new athlete has no capability evidence for, for example, the
competition lifts or the front squat. So in the real store a goal that names
the front squat is **not** planned for a new athlete, and the explanation
says "it is not available to you right now". That is the gate working, and
the store tests assert it. The store tests therefore compare plans with a
control athlete (same profile, nothing set) instead of with fixed names.
