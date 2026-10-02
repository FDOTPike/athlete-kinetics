# Work order 1 negative controls

Run 2026-10-02 with `node scripts/coaching/negative-controls-wo1.mjs`. Each mutation removes one fix, runs the gate that should notice, and is then reverted. "detected" means the gate failed (exit 1) under the mutation.

| Mutation | Outcome | First failing checks |
| --- | --- | --- |
| M1 remove the logSet preparation gate | detected | FAIL apps/mobile/test/components/SessionPreparation.test.js (5.272 s)<br>× an EMPTY free-form session cannot bypass preparation even though its runner starts complete (42 ms) |
| M2 do not create preparation in the start transaction | detected | FAIL apps/mobile/test/components/SessionPreparation.test.js (5.218 s)<br>× planned start: protocol and items are inserted with the session, pending at revision 1 (73 ms) |
| M3 drop the instance id from the compare-and-set (revision only) | detected | FAIL apps/mobile/test/components/SessionPreparation.test.js<br>× a NEW session that reuses an old session id never inherits the old preparation (96 ms) |
| M4 do not clear a stale protocol before inserting (reused id, FK off) | detected | FAIL apps/mobile/test/components/SessionPreparation.test.js<br>× a NEW session that reuses an old session id never inherits the old preparation (78 ms) |
| M5 halting does not stop an open protocol | detected | FAIL apps/mobile/test/components/SessionPreparation.test.js (5.371 s)<br>× stopping during preparation records "stopped" and stays available (108 ms) |
| M6 no execution-time recheck of holds and niggles | detected | FAIL apps/mobile/test/components/SessionPreparation.test.js (5.298 s)<br>× a movement held AFTER the protocol was frozen is withheld when the athlete reaches it (112 ms) |
| M7 reset leaves preparation rows behind | detected | FAIL apps/mobile/test/components/SessionPreparation.test.js (5.451 s)<br>× reset removes every preparation record (foreign keys OFF) (110 ms) |
| M8 held movement ids 135/187 are not excluded by the policy | detected | FAIL  movement 135 is never rehearsed or ramped; the next movement is prepared instead<br>FAIL  movement 187 is never rehearsed or ramped; the next movement is prepared instead |
| M9 block generator returns to clamp(round(cap / 22), 2, 5) | detected | FAIL  slotBudgetForCap on the session-length stepper  [2,2,2,3,3,4,5,5,5,5]<br>FAIL  REGRESSION: the old law promised 2 movements (44 nominal minutes) to a 15- and a 30-minute session |
| M10 routine microcycle does not reserve preparation | detected | FAIL  REGRESSION: a day that only fits WITHOUT preparation now sheds support work  [legacy=22.5 main=25.7 day={"dayIndex":1,"capMin":27,"preparationMi<br>FAIL  the omission says preparation was counted |
| M11 routine composer does not reserve preparation | detected | FAIL  REGRESSION: a cap that holds the work but not the preparation now sheds the accessory  [need=38 cap=40 kept=3] |
| M12 the cross-table item trigger is not replay-blocking | detected | verifier aborted (exit 1) |
| M13 a finished session may acquire preparation (live-session guard dropped) | detected | FAIL  065 refuses a protocol for a FINISHED session (no fabricated history)<br>FAIL  065 accepts a pending protocol for a live session |
| M14 staged restore copies are not checked against their source schema fingerprint | detected | FAIL apps/mobile/test/components/BackupForwardRestore.test.js (53.828 s)<br>× a "v63" database with a dropped index is not the v63 schema and fails closed before any migration (5718 ms) |
| M15 a migrated copy is accepted without matching the current schema | detected | FAIL apps/mobile/test/components/BackupForwardRestore.test.js (52.436 s)<br>× a v63 portable backup restores: validated as v63, forward-migrated in isolation, installed at the current schema (6135 ms) |
| M16 a longer session is offered without planning the block at that length | detected | FAIL  the offered length is one at which the regenerated block has no conflict  [[{"kind":"extend_session","capMin":45}]]<br>FAIL  every conflict message names the verified length, never the derived one  [The conditioning session needs about 33 minutes (5 min preparation + 2<br>FAIL  every offer in the profile domain is longer than the current limit and fits when the block is planned as offered  [143 offers endurance f=6 cap= |
| M17 the transition guard only fires when status or revision is named | detected | FAIL  065 a write that names only timestamps still has to advance the revision<br>FAIL  065 a recorded outcome accepts no further write, even under the same status |
| M18 a recorded outcome can still be rewritten under the same status | detected | FAIL  065 a recorded outcome accepts no further write, even under the same status |

18 of 18 mutations detected.

M16–M18 were added with the fixes for the review of pull request 22 (see
"Review of pull request 22" in `WO1_PREPARATION.md`); M1–M15 are from the
original run.
