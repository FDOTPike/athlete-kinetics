# PR #15 carry-over defects — bounded executor handover

## Input and boundaries

- Base: `origin/codex/rpe-familiarisation` at `b94053b4d63fb0ffd3b933aa1890d80f7313a87b`.
- Task branch: `codex/pr15-carry-over-defects`.
- Scope: the four requested activity-adapter and activity-screen observations only.
- Migration 064 remained frozen. Its blob hash stayed
  `69090f214516fe2b3d0e31c082f7969b8889dc86` before and after implementation.
- No coach adaptation, migration, merge, rebase, master update, tag, release,
  production signing, or C6 claim was made.

## What changed

- `saveOneOffActivity` now receives an explicit current local date and refuses
  future `completed` or `missed` facts while permitting same-day facts and
  future plans. The store derives the date from the same captured clock instant
  used for the write stamp.
- Weekly edits now verify that the requested series/activity pair is active
  before changing a definition or schedule. Missing and ended rows fail inside
  the transaction, and the update no longer clears an end date.
- Optional Effort remains range-checked against the schema's 1–10 `REAL`
  contract but is no longer rounded to half-points.
- The completion form autofocuses its first editable field and moves
  accessibility focus there when laid out. Entry, completion, and row-action
  failures have independent state.

## Test-first evidence

The first executable run against the merged implementation reported six
failures for the intended causes:

- future completed fact: `Received function did not throw`;
- exact effort: `Expected: 6.37`, `Received: 6.5`;
- missing series edit: `Received function did not throw`;
- ended series edit: `Received function did not throw`;
- completion autofocus: `Expected: true`, `Received: undefined`;
- error isolation: the completion form received the entry alert.

After the implementation:

- focused activity adapter/screen: 2 suites, 19 tests;
- focused adapter/screen/Profile/Plan/keyboard: 5 suites, 104 tests;
- `npm run typecheck`: exit 0;
- `npm run verify:ci`: exit 0 through all 22 stages, with 29 component suites
  and 488 component tests;
- `git diff --check`: exit 0.

The Jest runs retained the existing React Native animated `act(...)` console
warnings and module-resolution diagnostic lines; neither changed the zero exit
status. The first `verify:ci` attempt stopped in preflight because this fresh
worktree lacked the pinned embedder files. `npm run fetch:embedder` then
materialized and hash-verified the pinned revision, after which the full gate
ran successfully.

## Verification still outstanding at this checkpoint

- Exact-tip QA APK build and `verify:qa-candidate`: NOT VERIFIED — these must
  run after the commit exists so the embedded provenance names the final clean
  HEAD and tree.
- Native TalkBack/VoiceOver and physical keyboard behavior: NOT VERIFIED — no
  device acceptance was authorized or available in this bounded source task.
- Push state: NOT VERIFIED — the task branch has not yet been pushed at the
  point this handover file is authored.

## Next atomic action

Run typecheck once more, commit the narrow diff, build the QA APK at that exact
clean tip, run `verify:qa-candidate`, and push only
`codex/pr15-carry-over-defects` if all provenance checks succeed.
