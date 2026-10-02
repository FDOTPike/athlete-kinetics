# Work order 2 negative controls

Run 2026-10-02 with `node scripts/coaching/negative-controls-wo2.mjs`. Each mutation removes one fix, runs the gate that should notice (jest gates run with `--no-cache`), and is then reverted. "detected" means the gate failed (exit 1) under the mutation.

| Mutation | Outcome | First failing checks |
| --- | --- | --- |
| N1 onboarding ignores the athlete/context binding | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js<br>× switching athlete while the interview is open writes nothing to either athlete (107 ms)<br>× switching away and back does not revive the old interview (166 ms) |
| N2 the binding compares the athlete id only (no context revision) | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js<br>× switching away and back does not revive the old interview (163 ms) |
| N3 an incomplete onboarding goal is dropped silently instead of refusing the save | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js<br>× an incomplete goal is refused before anything is written (54 ms) |
| N4 a failed onboarding save keeps what was written so far | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js<br>× a failure on the LAST write rolls the profile and the focus back with it (55 ms) |
| N5 a goal edit is not compare-and-set on the revision the editor saw | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js<br>× a second save from the same editor (duplicate tap or stale screen) is refused (58 ms) |
| N6 a training-data reset leaves goal measurements behind | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js<br>× a training-data reset removes measurements and keeps goals and focus (foreign keys ON) (54 ms)<br>× a training-data reset removes measurements and keeps goals and focus (foreign keys OFF) (54 ms) |
| N7 a measurement dated in the future is accepted | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js<br>× a future date, a non-number and an unknown goal record nothing (51 ms) |
| N8 the store does not enforce the active-goal limit before writing | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js<br>× five active goals is the limit, in the store and in the database (55 ms) |
| N9 recorded measurements can be rewritten (immutability trigger dropped) | detected | FAIL apps/mobile/test/components/FocusGoalStore.test.js<br>× the database refuses to rewrite a revision or an observation (53 ms) |
| N10 a goal revision can be rewritten (immutability trigger dropped) | detected | FAIL  066 a goal definition cannot be rewritten or deleted while its goal exists<br>FAIL  066 editing appends a revision: revision 1 is still there, unchanged |
| N11 the database allows a sixth active goal | detected | gate aborted (exit 1) |
| N12 an ambiguous gym word is guessed ("arms" means biceps) | detected | FAIL  an ambiguous or unknown term is NOT guessed (arms, back, legs, toned) |
| N13 the focus question wording drifts | detected | FAIL  the slide question is exact |
| N14 a movement with no mapping is treated as matching the focus | detected | FAIL  a movement with NO mapping matches nothing — absence is not a match |
| N15 a blank baseline is accepted as known | detected | FAIL  baseline: known needs a number; a blank is not zero |
| N16 an unassessable goal is reported as a realistic rate | detected | FAIL  where no reviewed reference exists the app says so instead of inventing a benchmark<br>FAIL  a weight GAIN goal has no reference and is not assessed against the loss guidance |
| N17 the feasibility note promises the result | detected | FAIL  every assessment carries the same uncertainty statement and never promises |
| N18 progress is reported without any recorded measurement | detected | FAIL  no observation means no progress is reported — nothing is inferred<br>FAIL  an invalid observation row is ignored rather than counted |
| N19 a half-written onboarding target does not block NEXT | detected | FAIL apps/mobile/test/components/OnboardingFocusGoal.test.js (8.115 s)<br>× with a target: nine screens, a gate until the goal is complete, and one atomic save (71 ms)<br>× "Skip this" drops the half-written target and trains with the focus only (78 ms) |
| N20 a refused onboarding save is silent | detected | FAIL apps/mobile/test/components/OnboardingFocusGoal.test.js (8.219 s)<br>× switching athlete while the interview is open: nothing is saved and the screen says why (125 ms) |
| N21 the incline rule is applied by name instead of by reviewed movement id | detected | FAIL  066 the incline rule maps exactly the four incline presses to the upper chest  [65:Incline Dumbbell Press | 90:Incline Push-Up | 134:Barbell Incline Bench<br>FAIL  066 the incline rule does not touch incline push-ups, flyes, 218, 135 or 187 |
| N22 the intermediate (v64) backup schema is dropped from the registry | detected | gate aborted (exit 1) |
| N23 the muscle-mapping seed is not a self-heal sentinel | detected | FAIL  066 lost mapping rows are detected and re-seeded exactly, athlete rows untouched |

23 of 23 mutations detected.
