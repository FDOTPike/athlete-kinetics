# Work order 3 negative controls

Run 2026-10-02 with `node scripts/coaching/negative-controls-wo3.mjs`. Each mutation removes one rule, runs the gate that should notice (jest gates run with `--no-cache`), and is then reverted. "detected" means the gate failed (exit 1) under the mutation.

| Mutation | Outcome | First failing checks |
| --- | --- | --- |
| E1 a spare or displaced slot is filled from the whole library instead of the gated pool | detected | FAIL  capability gate: an incline press that is not available to the athlete is never chosen for the focus<br>FAIL  and the report says no exercise passed the checks, instead of pretending<br>FAIL  capability gate on allocation: no slot is given to an arm exercise the athlete is not cleared for |
| E2 a main lift may be swapped for a movement that drops its job | detected | FAIL  beach muscles: the main press becomes an incline press (upper chest), which still trains the chest<br>FAIL  beach muscles: ONE upper day a week gives its last slot to biceps; the other keeps overhead pressing<br>FAIL  the report says what changed, in plain language |
| E3 a pattern may be displaced even when no other day trains it | detected | FAIL  a pattern is displaced at most once a week and is always still trained on another day |
| E4 a pattern may be displaced on every day of the week | detected | FAIL  beach muscles: ONE upper day a week gives its last slot to biceps; the other keeps overhead pressing<br>FAIL  the report says what changed, in plain language<br>FAIL  and what could not be done, with a way to change it |
| E5 the emphasis displaces a slot the athlete chose explicitly | detected | FAIL  the athlete's own exercise choice for a slot is kept: not swapped, not displaced |
| E6 a goal exercise is taken from outside the gated pool | detected | FAIL  a goal never re-admits a gated movement: no barbell, no front squat, and the reason is equipment |
| E7 a goal exercise outranks the slot the athlete chose explicitly | detected | FAIL  the athlete's explicit slot choice outranks the goal exercise, and the report says so |
| E8 the hybrid tax and the sport workload cut are added together | detected | FAIL  where the hybrid tax already takes one set, a high sport week takes NO further set (larger of, not the sum) |
| E9 a very full sport week does not hold week 3 | detected | FAIL  a very high sport week holds progression: week 3 repeats week 2 instead of stepping up |
| E10 the goal exercise loses sets under a high sport week | detected | FAIL  the exercise a goal names keeps its full dose under a high sport week |
| E11 a held movement (135/187) can be newly prescribed by the emphasis | detected | FAIL  even when they are the ONLY option, 135 and 187 are neither swapped in nor given a slot<br>FAIL  and the athlete is told no exercise passed the checks for that area |
| E11b a held movement (135/187) can be swapped in for a default of the same pattern | detected | FAIL  even when they are the ONLY option, 135 and 187 are neither swapped in nor given a slot<br>FAIL  and the athlete is told no exercise passed the checks for that area |
| E11c a goal that names a held movement (135/187) gets it planned in its pattern slot | detected | FAIL  a goal that names 135 or 187 does not put it in the plan<br>FAIL  and the athlete is told that exercise is on hold |
| E11d a goal that names a held movement is reported with a wrong reason instead of the hold | detected | FAIL  and the athlete is told that exercise is on hold |
| E12 the emphasis is applied on a sport or conditioning day | detected | FAIL  a conditioning or sport day is left alone |
| E13 scheduled and stated sport sessions are added together | detected | FAIL  the Activities schedule is the evidence: it replaces the stated numbers, never adds to them<br>FAIL  known minutes are summed; an unknown duration stays unknown, not zero and not estimated<br>FAIL  three sessions in the Activities schedule outweigh one stated: the schedule decides |
| E14 a competition date switches on the competition-lift promotion | detected | FAIL  for every sport, not only powerlifting: a competition date changes no session, set, rep or effort |
| E15 Muay Thai striking gets an emphasis with no reviewed basis | detected | FAIL  Muay Thai striking: no reviewed basis, so NO emphasis — and high-rep hip-flexor raises are not a default<br>FAIL  every emphasis with muscles names a published basis<br>FAIL  an outcome with no reviewed basis leaves the plan exactly as it was |
| E16 the sport text promises an outcome | detected | FAIL  no outcome promises a result or fewer injuries<br>FAIL  the report names the sport outcome as the reason and carries the limits |
| E17 an unknown session duration is estimated instead of left unknown | detected | FAIL  known minutes are summed; an unknown duration stays unknown, not zero and not estimated |
| E18 the committed block is generated without the emphasis the preview showed | detected | FAIL apps/mobile/test/components/SportEmphasisStore.test.js (9.834 s)<br>× focus changes selection and weekly allocation, and the explanation is frozen with the block (387 ms)<br>× the preview and the committed block say exactly the same thing (160 ms) |
| E19 the explanation is not stored with the block | detected | FAIL apps/mobile/test/components/SportEmphasisStore.test.js (9.964 s)<br>× focus changes selection and weekly allocation, and the explanation is frozen with the block (416 ms)<br>× the preview and the committed block say exactly the same thing (199 ms) |
| E20 a new block inherits an explanation left under a reused block id | detected | FAIL apps/mobile/test/components/SportEmphasisStore.test.js (10.041 s)<br>× a new block never inherits an explanation left under a reused block id (179 ms) |
| E21 a training-data reset leaves block explanations behind | detected | FAIL apps/mobile/test/components/SportEmphasisStore.test.js (10.071 s)<br>× a training-data reset removes block explanations and keeps the sport answer and goal exercise (foreign keys OFF) (155 ms) |
| E22 gym strength sessions and low-demand activities count as sport workload | detected | FAIL apps/mobile/test/components/SportEmphasisStore.test.js (9.377 s)<br>× gym strength sessions, low-demand activities and ended series are not counted; unknown durations stay unknown (106 ms) |
| E23 an ended weekly series still counts | detected | FAIL apps/mobile/test/components/SportEmphasisStore.test.js (9.439 s)<br>× gym strength sessions, low-demand activities and ended series are not counted; unknown durations stay unknown (106 ms) |
| E24 a retired goal still puts its exercise in the next block | detected | FAIL apps/mobile/test/components/SportEmphasisStore.test.js (9.344 s)<br>× a goal that names an exercise puts that exercise in the plan; a retired goal no longer does (464 ms) |
| E25 onboarding saves without validating the sport answer | detected | FAIL apps/mobile/test/components/SportEmphasisStore.test.js (9.326 s)<br>× an invalid sport answer refuses the whole save (196 ms) |
| E26 the goal exercise link is written outside the goal transaction outcome (a refused edit still changes the link) | detected | FAIL apps/mobile/test/components/SportEmphasisStore.test.js (9.466 s)<br>× a goal exercise link can be set, changed and removed without touching the goal definition (112 ms) |
| E27 a stored block explanation can be rewritten | detected | FAIL  067 one explanation per block, and it is frozen once written<br>FAIL  067 a lost immutability guard is detected and restored; the full replay alters no athlete row |
| E28 a listed sport may carry a free-text name / "another sport" need not be named | detected | FAIL  067 "another sport" must be named, and a listed sport must not carry a free-text name |
| E29 the block explanation table is not a self-heal sentinel | detected | FAIL  every durable table is a sentinel or a justified exemption  [UNCOVERED: block_emphasis]<br>FAIL  block_emphasis: loss detected, restored, unrelated data intact, replay idempotent  [detected=false restored=true idempotent=true movement 300->300 uv=66]<br>FAIL  067 block_emphasis: loss detected and the table recreated, every other athlete row untouched |
| E30 the previous (v65) backup schema is dropped from the registry | detected | gate aborted (exit 1) |
| E31 choosing "Football" silently picks a code for the athlete | detected | FAIL apps/mobile/test/components/SportScreens.test.js (17.641 s)<br>× football must be told apart by the athlete; the app never picks a code (199 ms) |
| E32 a half-answered sport screen does not block NEXT | detected | FAIL apps/mobile/test/components/SportScreens.test.js (17.844 s)<br>× is offered on the focus slide and is not part of the interview unless asked for (5345 ms)<br>× "not sure" is the starting workload answer; the competition date is context only (224 ms) |
| E33 "not sure" is sent to the store as zero | detected | FAIL apps/mobile/test/components/SportScreens.test.js (17.97 s)<br>× "another sport" is a supported answer in the athlete's own words (329 ms) |
| E34 the sport screen is part of the interview for everyone | detected | FAIL apps/mobile/test/components/OnboardingFocusGoal.test.js (14.475 s)<br>× asks the exact question and starts from balanced whole body (5150 ms)<br>× focus only: eight screens, no target screen, and only the focus is saved (182 ms) |
| E35 the program preview does not show the explanation | detected | FAIL apps/mobile/test/components/SportScreens.test.js (18.344 s)<br>× the program preview shows what focus and sport change, and what they cannot, before the plan is created (143 ms) |

38 of 38 mutations detected.

## What the first run found

The first complete run, on the work order 3 commit, detected 32 of 35. The three it missed were weaknesses in the tests, not in the engine, and are recorded here rather than quietly re-run:

| First-run mutation | First outcome | What was wrong | What changed |
| --- | --- | --- | --- |
| E1 the emphasis picks from the whole library instead of the gated pool | NOT DETECTED | An equivalent mutant. The mutation widened a list that the ranker filters through the gated pool again one line later, so the engine behaved identically. The control proved nothing. | The mutation now removes the gate where it is actually enforced (the candidate source for a spare or displaced slot). The verifier gained a capability-gate check on weekly allocation. |
| E8 the hybrid tax and the sport workload cut are added together | NOT DETECTED | No test planned a block where both cuts were non-zero, so "larger of" and "sum" gave the same plan. | The verifier now plans a block that pays the hybrid tax and asserts that a high sport week takes no further set. |
| E11 a held movement (135/187) can be newly prescribed by the emphasis | NOT DETECTED | In every tested pool a better candidate existed, so the held movements were never the engine's choice with or without the rule. | The verifier now corners the pool so 135 and 187 are the only candidates for the focus, and asserts they are neither swapped in nor given a slot and that the athlete is told nothing passed the checks. E11b covers the swap path separately. |

The four rows E1, E8, E11 and E11b in the table above are from the re-run against the strengthened verifier (`packages/inference/test/verify_emphasis.mjs`); the other rows are from the first run. No engine source changed between the two runs.

## What the independent review found

Reading the final diff before publication found one engine gap the controls
above could not have found, because no test asked the question: **a goal that
names movement 135 or 187 had that movement planned**, through the
goal-exercise rule, even though the emphasis is documented as never newly
prescribing a held movement. The engine now skips a held movement on both
goal paths and tells the athlete the exercise is on hold. Three checks were
added to `verify_emphasis.mjs` and two mutations (E11c, E11d) to this script.
E11c failing under mutation is the proof that the defect was real.
