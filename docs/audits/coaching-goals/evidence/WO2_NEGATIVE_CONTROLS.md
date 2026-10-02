# Work order 2 negative controls

Run with `node scripts/coaching/negative-controls-wo2.mjs`. Each mutation removes one rule, runs the gate that should notice (jest gates run with `--no-cache`), and is then reverted.

A mutation is **detected** only when its gate passes without the mutation (each distinct gate is run once unmutated first) and the mutated run reports a failure of its own — a failing check, an assertion or a compile error. A gate that is already broken, or one that exits without reporting anything, is listed as what it is and does not count.

| Mutation | Outcome | What the gate reported |
| --- | --- | --- |
| N1 onboarding ignores the athlete/context binding | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js (7.109 s)<br>× switching athlete while the interview is open writes nothing to either athlete (202 ms)<br>× switching away and back does not revive the old interview (306 ms) |
| N2 the binding compares the athlete id only (no context revision) | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js (7.08 s)<br>× switching away and back does not revive the old interview (311 ms) |
| N3 an incomplete onboarding goal is dropped silently instead of refusing the save | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js (6.864 s)<br>× an incomplete goal is refused before anything is written (105 ms) |
| N4 a failed onboarding save keeps what was written so far | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js (7.016 s)<br>× a failure on the LAST write rolls the profile and the focus back with it (105 ms) |
| N5 a goal edit is not compare-and-set on the revision the editor saw | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js (7.047 s)<br>× a second save from the same editor (duplicate tap or stale screen) is refused (103 ms) |
| N6 a training-data reset leaves goal measurements behind | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js (7.219 s)<br>× a training-data reset removes measurements and keeps goals and focus (foreign keys ON) (102 ms)<br>× a training-data reset removes measurements and keeps goals and focus (foreign keys OFF) (122 ms) |
| N7 a measurement dated in the future is accepted | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js (7.293 s)<br>× a future date, a non-number and an unknown goal record nothing (72 ms) |
| N8 the store does not enforce the active-goal limit before writing | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js (6.716 s)<br>× five active goals is the limit, in the store and in the database (105 ms) |
| N9 recorded measurements can be rewritten (immutability trigger dropped) | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js (7.132 s)<br>× the database refuses to rewrite a revision or an observation (104 ms) |
| N10 a goal revision can be rewritten (immutability trigger dropped) | detected | FAIL  066 a goal definition cannot be rewritten or deleted while its goal exists<br>FAIL  066 editing appends a revision: revision 1 is still there, unchanged |
| N11 the database allows a sixth active goal | detected | Error: schema incomplete after full re-apply: missing trg_athlete_goal_active_limit_bi |
| N12 an ambiguous gym word is guessed ("arms" means biceps) | detected | FAIL  an ambiguous or unknown term is NOT guessed (arms, back, legs, toned) |
| N13 the focus question wording drifts | detected | FAIL  the slide question is exact |
| N14 a movement with no mapping is treated as matching the focus | detected | FAIL  a movement with NO mapping matches nothing — absence is not a match |
| N15 a blank baseline is accepted as known | detected | FAIL  baseline: known needs a number; a blank is not zero |
| N16 an unassessable goal is reported as a realistic rate | detected | FAIL  where no reviewed reference exists the app says so instead of inventing a benchmark<br>FAIL  a weight GAIN goal has no reference and is not assessed against the loss guidance |
| N17 the feasibility note promises the result | detected | FAIL  every assessment carries the same uncertainty statement and never promises |
| N18 progress is reported without any recorded measurement | detected | FAIL  a measurement taken in another unit is left out of progress (the goal was edited to count something else)<br>FAIL  a measurement of another metric in the SAME unit is left out too (body weight is not a lift)<br>FAIL  no observation means no progress is reported — nothing is inferred |
| N19 a half-written onboarding target does not block NEXT | detected | FAIL apps/mobile/test/components/OnboardingFocusGoal.test.js (16.835 s)<br>× with a target: nine screens, a gate until the goal is complete, and one atomic save (121 ms)<br>× "Skip this" drops the half-written target and trains with the focus only (249 ms) |
| N20 a refused onboarding save is silent | detected | FAIL apps/mobile/test/components/OnboardingFocusGoal.test.js (15.539 s)<br>× switching athlete while the interview is open: nothing is saved and the screen says why (169 ms) |
| N21 the incline rule is applied by name instead of by reviewed movement id | detected | FAIL  066 the incline rule maps exactly the four incline presses to the upper chest  [65:Incline Dumbbell Press \| 90:Incline Push-Up \| 134:Barbell Incline Bench Press - Medium Grip<br>FAIL  066 the incline rule does not touch incline push-ups, flyes, 218, 135 or 187 |
| N22 the intermediate (v64) backup schema is dropped from the registry | detected | AssertionError [ERR_ASSERTION]: supported schema registry must list every supported contract, oldest first, ending with the current one |
| N23 the muscle-mapping seed is not a self-heal sentinel | detected | FAIL  066 lost mapping rows are detected and re-seeded exactly, athlete rows untouched |
| N24 progress counts measurements taken in another unit or metric | detected | FAIL  a measurement taken in another unit is left out of progress (the goal was edited to count something else)<br>FAIL  a measurement of another metric in the SAME unit is left out too (body weight is not a lift) |
| N25 a goal whose date has gone is described as "less than 4 weeks away" | detected | FAIL  a stored goal whose date has gone is told so, not that the date is "less than 4 weeks away" |
| N26 an impossible calendar date reaches the database and its raw error reaches the athlete | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js (7.558 s)<br>× a future date, a non-number and an unknown goal record nothing (85 ms) |

26 of 26 mutations detected.
