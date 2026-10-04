# Coaching, goals, sport and preparation — baseline and prerequisite record

Recorded 2026-10-02 by the Claude Code Desktop executor (Claude Opus 5.5).
This file states exactly what the coaching work was built on, how that was
proved, and which changes are **not** part of the coaching work.

## Source that was selected

| Item | Value |
| --- | --- |
| Frozen checkout | `C:/Users/fpike/.codex/worktrees/wo09-health-connect-ordering/Athlete App` |
| Branch | `codex/wo09-health-connect-ordering` |
| HEAD | `01023cf04eeb85b73004b92de11f64efa7350a1c` |
| Tree | `4b0bfbfe758a258bf29db79983d6d515be147c49` |
| Staged state | empty, before and after copying |
| Uncommitted overlay | 100 files (22 modified, 78 untracked) |
| Overlay digest | `2b979f5cac3ef283a51939c4367cf79594813fe172adec22fe32a413eec67900` |

The frozen checkout was only read. The root's own verifier was run against it
first:

```text
node wo09-remediation/verify-health-handoff.mjs verify
{"dirtyFiles":100,"unchangedNonOwnedFiles":98,"verifiedHandbackHashes":true,
 "dirtyFilesSha256":"2b979f5cac3ef283a51939c4367cf79594813fe172adec22fe32a413eec67900"}
exit 0
```

## Working checkout

| Item | Value |
| --- | --- |
| Worktree | `C:/Users/fpike/Documents/Claude Coding/Athlete App/.worktrees/coaching-goals` |
| Prerequisite branch | `codex/coaching-goals-sport-preparation-baseline` |
| Feature branch | `codex/coaching-goals-sport-preparation` (stacked on the prerequisite) |

Byte equivalence was proved file by file: for each of the 100 overlay files the
SHA-256 of the frozen source, the SHA-256 recorded in
`wo09-remediation/health-source-snapshot.json` and the SHA-256 of the copied
file are equal, the recomputed digest equals the recorded digest, and the
copied dirty-file set equals the snapshot's file list exactly. The check was
repeated after the prerequisite commit.

## What is prerequisite and what is coaching work

Nothing in this lineage after `origin/codex/rpe-familiarisation`
(`6c2fd709`) was on the remote when this work started: the frozen HEAD is 285
local commits ahead of that branch, and none of them was reachable from any
remote branch. On top of those commits sat the 100-file uncommitted overlay.

So that coaching commits contain only coaching changes:

1. **Inherited commits** — `6c2fd709..01023cf0` (285 commits). Other lanes'
   work, unchanged. Not coaching work.
2. **Inherited overlay** — one commit, `56ddfb7d`
   *chore(baseline): snapshot inherited 100-file overlay (prerequisite, not
   coaching work)*. It is the frozen overlay, byte for byte. Not coaching work,
   not approved or released by being committed, and it changes no ownership,
   approval state or hold (including movements 135 and 187).
3. **Coaching work** — every commit after `56ddfb7d` on
   `codex/coaching-goals-sport-preparation`.

The prerequisite branch is not a claim that items 1 and 2 are merged anywhere:
it exists so the dependency is visible. It is local only and was not pushed —
see "How the coaching work is published" below.

## Baseline checks (before any coaching edit)

`npm ci` exit 0; `npm run fetch:embedder` installed the pinned, hash-verified
embedder assets (four pinned files were downloaded from the pinned Hugging Face
revision into the revision cache by the repository's own fetch script);
`node scripts/verify-preflight.mjs` reported `PREFLIGHT OK`.

`npm run verify:ci` on the baseline: every non-component gate passed and the
component stage reported 68 of 69 suites, 1,550 of 1,551 tests. The one failure
was `BackupRestoreStore.test.js › a stale legacy marker cannot poison a newer
preparation journal`, which asserts the table count of a database built from
**every file in the schema directory**. It failed because the first coaching
file (`065_session_preparation.sql`) had already been written into that
directory while the long run was in progress — a contamination of the baseline
run by this executor, not a baseline defect. With that one file moved aside the
suite was re-run on its own and passed 10 of 10 (exit 0). The baseline is
therefore green; the full-suite exit code of that first run was 1 and is
recorded here as such.

## Migration filename

The chain had 63 entries ending at filename `064`. No file numbered `065` or
higher existed in any local or remote ref or in any sibling worktree. The
animation lane's incline-raise handback *proposes* a future
`065_incline_scapular_coaching_correction.sql`; it is not written or applied
anywhere. The coaching work takes the next unused filenames in order, starting
with `065_session_preparation.sql`; the animation lane takes the next unused
filename when its correction is approved. `user_version` counts entries, so
either order of landing is safe as long as each lane appends.

## How the coaching work is published

The first plan was to open a pull request against the prerequisite branch, so
its diff would show only item 3. That plan was dropped, for one reason:
**pushing the prerequisite branch would publish items 1 and 2** — 285
unpublished commits and an uncommitted overlay that belong to other lanes
(the movement animation lane and its roughly 9,900 evidence files, and the
architecture lane). Publishing another lane's unfinished work is not within
this assignment's authority, and a pull request cannot be opened against a
branch that is not on the remote.

What was done instead:

1. The coaching commits were **ported onto the newest published ancestor**,
   `origin/codex/rpe-familiarisation` (`6c2fd709`), one commit per work
   order, and pushed as four stacked branches:

   | Branch | Base | Content |
   | --- | --- | --- |
   | `claude/coaching-wo1-preparation` | `codex/rpe-familiarisation` | work order 1 |
   | `claude/coaching-wo2-focus-goals` | `claude/coaching-wo1-preparation` | work order 2 |
   | `claude/coaching-wo3-sport-programming` | `claude/coaching-wo2-focus-goals` | work order 3 |
   | `claude/coaching-wo4-coaching-content` | `claude/coaching-wo3-sport-programming` | work order 4 |

   Each pull request shows exactly one work order. Nothing from items 1 or 2
   is in any of them.

2. The port was small because the coaching work and the unpublished lanes
   barely overlap. Of the files the coaching work touches, these are the only
   ones that differ between `6c2fd709` and the baseline, and each was
   resolved by hand:

   | File | Resolution on the port |
   | --- | --- |
   | `package.json`, `.github/workflows/ci.yml`, `AGENT_WORKFLOW.md`, `apps/mobile/test/verify_store_sql.mjs`, `tools/test_verify_ci_structure.mjs` | The published base runs 22 `verify:*` gates; the unpublished lineage runs 24 (two animation-evidence gates). `verify:preparation` is the 23rd on the port and the 25th on the lineage. |
   | `apps/mobile/src/screens/SessionScreen.tsx` | The published base has no movement-preview component; the preparation changes are applied without that import. |
   | `apps/mobile/src/state/useStore.ts` | The published base has no athlete-context revision counter (it arrives with the unpublished Health Connect ordering work). The onboarding binding needs one, so the port adds the minimal counter under the same name and with the same three increment points, with a note in the code. |
   | `packages/core-db/test/verify_library.py` | The published file has no preview-manifest checks; the content-correction checks are applied to the published file. |
   | `PROMPT_LEDGER.md` | The published ledger ends at Entry 0135. Entry 0192 is appended with a numbering note; entries 0136–0191 are not reproduced. |

3. The full `verify:ci` was run on the ported tip, not assumed from the
   lineage run. Both results are in the final report. Suite and test counts quoted
   in the work-order records are from the development lineage, which also
   carries other lanes’ suites; the counts for the published branches are
   lower and are given in each pull request.

Consequences, stated plainly:

- **Two lineages now carry the coaching work**: the local stacked branch
  `codex/coaching-goals-sport-preparation` (as developed, on the frozen
  baseline) and the four published branches (as ported). They are the same
  changes; the published ones are the reviewable ones.
- **When the prerequisite lineage is published by its owners**, merging it
  with the coaching work will conflict in exactly the files in the table
  above, in exactly the ways described there. That reconciliation is a
  release blocker and is theirs and the owner's to schedule; it is not
  attempted here.
- Migration filenames `065`–`068` are taken by the coaching work on the
  published branches. The animation lane's proposed
  `065_incline_scapular_coaching_correction.sql` must take the next unused
  filename when it lands (`user_version` counts entries, so order of landing
  is safe as long as each lane appends).
