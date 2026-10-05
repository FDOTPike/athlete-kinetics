# W3 Opus Audit — Aggregate Integration Packet

## 0. Verdict

```text
W3 REQUEST CHANGES — AGGREGATE DELTA SOUND; PACKET INVENTORY AND RISK CHARACTERISATION INCOMPLETE
```

The aggregate delta itself is in good shape. Identity, merge base and every headline count are correct and
independently reproduced; all four integration gates pass; migration data preservation is genuinely safe; the
carried findings are held open rather than quietly implemented; and W3 changed no product code.

The verdict is `REQUEST CHANGES` because the packet's own deliverable — a complete, accurately characterised
aggregate inventory that a merge decision can rest on — has four concrete defects: the path inventory is
incomplete and the omitted files are build-toolchain and dependency-manifest changes; the migration risk
statement is inaccurate; one verification-matrix row does not measure the aggregate it is presented against;
and one inventory result is not currently reproducible.

**Every correction is documentation-only.** No product change is required or authorised.

**Reviewed packet:** `W3_INTEGRATION_PACKET.md`, 49,216 B, SHA-256
`ca716eebc35fc8bacb701cae22b7e8469565491d3fb1b9f805d6c316600c8409`.
**Dispatch state:** branch `codex/rpe-familiarisation`, HEAD `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`, tree
dirty; ledger pre-write 384,130 B `992ddff2…`; live diff 110,246 B `57d84325…`.

---

## 1. Independently confirmed

Recounted from the repository, not read from the packet:

| Metric | My measurement | Packet | |
| :--- | :--- | :--- | :--- |
| Remote | `origin` → `https://github.com/FDOTPike/athlete-kinetics.git` | same | ✅ |
| Default branch | `master`, via `git symbolic-ref refs/remotes/origin/HEAD` | same | ✅ |
| `origin/master` tip | `4c5056fc40b132c11436c22f9207af5256929775` | same | ✅ |
| Merge base | `4c5056fc40b132c11436c22f9207af5256929775` | same | ✅ |
| Commits ahead | **131** | 131 | ✅ |
| Committed changed paths | **310** | 310 | ✅ |
| Tracked modified | **4** | 4 | ✅ |
| Untracked | **17** | 16 | ❌ W3-05 |

The merge base equals the `origin/master` tip, so the branch is strictly ahead with no divergence to reconcile.
The 131/310 figures were flagged in the W3 task as values not to carry over blindly; they were genuinely
recounted here and are correct — they simply have not moved, because HEAD has not moved.

Category counts also reproduce, six of seven exactly: mobile src/test 50, inference 30, core-db 45, native/CI 8,
docs 111, tools/scripts 34. The seventh is W3-01.

**Gates reproduced by me, all exit 0:**

| Gate | Result |
| :--- | :--- |
| `npm.cmd run typecheck` | clean, no diagnostics |
| `npm.cmd run verify:blocks` | `ALL CHECKS PASSED` |
| `npm.cmd run verify:components` | **20 suites / 282 tests** — matches the packet exactly |
| `npm.cmd run verify:ci` | `ALL CHECKS PASSED` |

The `verify:qa-candidate` artifact gate is correctly labelled in the packet as inherited from the W2 pre-doc
build boundary; I did not rerun it, for the reason given in `W2_OPUS_AUDIT_R3.md` §6.

---

## 2. Findings

### W3-01 — Blocking — The changed-path inventory is incomplete: 305 of 310

The appendix declares per-category totals of 50 + 30 + 45 + 8 + 111 + 34 + 27 = **305**, and lists exactly 305
entries. The repository has **310**. Five paths are absent:

```
apps/mobile/app.json
apps/mobile/babel.config.js
apps/mobile/jest.config.js
apps/mobile/metro.config.js
apps/mobile/package.json
```

They fall into a classification gap: the packet's mobile category matches `apps/mobile/src/` and
`apps/mobile/test/`, its native category matches `apps/mobile/android/` and `apps/mobile/ios/`, and its root
category collects repository-root files — so `apps/mobile/` top-level files belong to none of them.

This matters because of what those files contain:

- **`apps/mobile/package.json`** — `@op-engineering/op-sqlite` pinned from `"*"` to `"16.2.0"`. A dependency
  manifest change. Pinning a wildcard is a good change, but it is exactly the class of change an integration
  packet exists to surface, and several work orders in this branch's history prohibited dependency edits.
- **`apps/mobile/jest.config.js`** — `testMatch` rebuilt from an absolute, forward-slash-normalised path. The
  in-file comment states that the previous `<rootDir>`-based pattern "matches zero files whenever the checkout
  path contains a dot-directory (any git worktree under `.worktrees/`)". Every component-suite result produced
  from a worktree before this fix is therefore suspect, which is directly relevant to how much weight
  historical green runs on this branch can carry.
- **`apps/mobile/babel.config.js`** — workspace aliases re-anchored to `__dirname`, because bare relative
  aliases "silently mean a DIFFERENT directory depending on where the tool was launched" and, in a worktree,
  resolved into the **main checkout**.
- **`apps/mobile/metro.config.js`** — `fs.realpathSync` on the hoisted `node_modules` junction plus
  `unstable_enableSymlinks: true`.
- **`apps/mobile/app.json`** — app `name`/`displayName` changed `AthleteKinetics` → `pikeMethods`.

The W3 task required flagging any path that could not be mapped rather than omitting it. These were omitted
silently.

**To clear:** list all 310 paths, correct the per-category totals so they sum to 310, and map these five to
their authorising work order or ledger entry.

### W3-02 — Blocking — "SQLite migrations are additive and backwards-compatible" is inaccurate

Two separate problems with that sentence.

**A modified historical migration.** `packages/core-db/src/schema/004_state_vector_materialize.sql` is `M`, not
`A`, in `git diff --name-status`. Its change removes the `acwr` / `load_component` term — weight `0.30` — from
the readiness computation, leaving a weighted mean of HRV and sleep only, and updates the header comment from
"available HRV/load/sleep inputs" to "available HRV/sleep recovery inputs". The migration performs
`INSERT INTO state_vector (…)`, so it is one-shot DDL/DML rather than a re-created view, and
`packages/core-db/src/migrationRunner.ts` gates application on `user_version`. An install that already applied
004 will therefore keep the ACWR-weighted formula while a fresh install gets the new one — a behavioural
divergence in readiness scoring between existing and new users. That is not backwards-compatible, and it is a
training-relevant change that a merge decision should see explicitly.

*(This may well be the deliberate ACWR/readiness bifurcation recorded elsewhere in the project. The finding is
that the packet does not disclose it at all, not that the change is wrong.)*

**Destructive rebuilds.** Migrations 049 and 052 issue `DROP TABLE` against three real tables —
`movement_equipment`, `movement_role_eligibility`, `routine_template_slot`.

**Data preservation is genuinely safe, and I verified it:** each follows the correct SQLite pattern —
`CREATE TABLE …_vNNN`, `INSERT … SELECT` from the original, `DROP TABLE` original, `ALTER TABLE … RENAME`.
Rows are copied before anything is dropped, and `routine_template_slot` preserves its primary keys. The
remaining destructive statements are benign: targeted `DELETE` of specific catalogue rows in 049, legacy
allowance cleanup in 054, and a temporary `_m060_guard` table in 060.

But "additive" is the wrong word for a table rebuild, and a reviewer relying on that sentence would not know to
check the copy-forward at all.

**To clear:** state that 004 is a modified historical migration, describe its readiness-formula effect and the
`user_version` consequence, and describe 049/052 as destructive rebuilds with verified copy-forward rather than
as additive changes.

### W3-03 — Blocking — Verification-matrix scope mismatch on `git diff --check`

The matrix presents `git diff --check` → exit 0 → "Clean, zero whitespace or formatting errors" as a
branch-level result, alongside gates that do cover the branch.

The bare command checks only the **working tree**. I confirm it exits 0. Over the range the packet is actually
about:

```
git diff --check 4c5056fc40b132c11436c22f9207af5256929775..HEAD   →  exit 2, 4,859 warnings
```

Warnings include trailing whitespace throughout `acceptance-evidence/meminfo_coach_lab.txt` and new blank lines
at EOF in `.agents/rules/coding-rules-general.md` and `MASTER_AUDIT_SYNTHESIS.md`.

The command and its stated result are self-consistent; the defect is that the row does not measure the
aggregate it sits inside. This is not a reason to reformat 310 files — most of the noise is captured evidence
text. It is a reason to state the scope accurately.

**To clear:** either label the row as working-tree scope, or report the aggregate result with its count and an
explicit accept/deferral decision.

### W3-04 — Blocking — "47/47 inventory items verified, 0 mismatches" is not currently reproducible

I re-verified `FREEZE_INVENTORY_W2.json` against disk: **46 of 47 match**. The single mismatch is
`PROMPT_LEDGER.md` — inventory records `11ba3564…`, the file is now `992ddff2…`.

This is entirely the documentation drift Codex already clarified in Entry 0082 and I re-stated in
`W2_OPUS_AUDIT_R3.md` §3: subsequent ledger appends move that hash, and it is not an artifact defect. The
problem is only that the packet presents 47/47 as a live self-run result when the ledger had already moved past
the inventory snapshot.

Confirmed independently: 47 records / 45 distinct paths, with `baseline_apk/app-qa.apk` and
`w2_round1_apk/app-qa.apk` each appearing twice.

**To clear:** report 46/47 with the ledger drift named and explained, or re-run at a stated snapshot and label
the snapshot.

### W3-05 — Minor — Untracked count is 17, not 16

`git ls-files --others --exclude-standard` returns 17. The packet lists 16 and omits
`W3_INTEGRATION_PACKET.md` itself — presumably counted before it was written. Say so, or count 17.

### W3-06 — Minor — User-visible app rename is undisclosed in the draft PR

`apps/mobile/app.json` and `apps/mobile/android/app/src/main/res/values/strings.xml` both change the app name
from `AthleteKinetics` to `pikeMethods`. This appears nowhere in the PR summary. A reviewer approving this
branch would be approving a product rename without being told. Consequence of W3-01.

### W3-07 — Observation — A favourable native change is under-disclosed

The net permission delta is a **removal**, which is worth saying plainly. At the merge base the production
manifest declared `android.permission.INTERNET`; at HEAD it is stripped with `tools:node="remove"`, with the
in-code rationale that the production app has no in-process network client and that
`react-native-blob-util` injects INTERNET through library merging. The debug overlay re-adds it for Metro.

Health Connect `READ_HEART_RATE_VARIABILITY`, `READ_RESTING_HEART_RATE` and `READ_SLEEP` **already existed at
the merge base**, so this branch adds no new permissions. I checked specifically because an integration packet
that omitted a new biometric permission would be a serious problem; it is not the case here.

**Suggested:** state the permission posture explicitly in the PR description — it is a security-positive change
and reviewers should not have to infer it from commit `bff0a38`.

### W3-08 — Observation — Recurring gate-count inconsistency

The matrix says "All 21 verification gates passed" while enumerating 23 in the same cell; earlier rounds said
22. Cosmetic, but it has now recurred across three documents. Pick the number the script actually chains and
use it consistently.

---

## 3. Credited

- Identity, remote and merge-base derivation are correct, with commands shown, and the counts genuinely
  recounted rather than carried over.
- All four integration gates pass and the packet's headline numbers match my own runs exactly, including
  282/282 tests across 20 suites.
- Execution attribution is labelled per row — self-run versus inherited — which is the right habit and made
  this audit faster.
- **Migration data preservation is correct**, which is the single highest-consequence thing W3 had to get
  right. Every destructive statement copies forward first.
- F7, O1 and O3 are all carried as open owner decisions with accurate descriptions, and none was implemented.
  W3 did not silently expand scope.
- The PR description is explicitly a draft and was not created.
- No product code, test, migration, schema, dependency or native file was modified by W3 itself; product
  source, tests and the QA APK all verify unchanged.

---

## 4. Coverage checkpoint

Recorded rather than implied, per the W3 task.

**Reviewed in this pass:** identity, remote, merge base and all counts; full inventory completeness against the
repository; the five omitted files' diffs in detail; every `packages/core-db/src/schema` path at name level,
plus `004` and all four migrations containing destructive statements in detail; all eight native/CI paths,
including both `AndroidManifest.xml` files, `strings.xml`, and the merge-base permission comparison; the
verification matrix against my own reproductions; carried-findings handling; the draft PR; and ledger and
prior-artifact integrity.

**Not reviewed line-by-line, and therefore open coverage:** the 50 `apps/mobile/src|test` paths beyond
`RoutineTemplateBuilder`, `SessionScreen`, `InfoTip` and `glossary` already audited in the W2 and Freeze-4
rounds; the 30 `packages/inference` paths beyond `effortCues.ts`; the 111 `docs` paths; the 34 `tools`/`scripts`
paths; the 27 root paths other than the config and manifest files named above; and the 66/16-line
`.github/workflows/ci.yml` diff.

That remaining coverage is a genuine gap in a 310-path aggregate review. It does not decide this verdict — the
findings above do — but it means a future `W3 APPROVE` should either close it or state it as an accepted limit.

---

## 5. Required to clear this verdict

Documentation only. No rebuild, no emulator, no product change, no device action.

1. Complete the inventory to all **310** paths, fix the category totals, and map the five omitted
   `apps/mobile/` files (W3-01).
2. Correct the migrations statement: `004` is a modified historical migration with a readiness-formula change
   and a `user_version` divergence consequence; 049/052 are destructive rebuilds with verified copy-forward
   (W3-02).
3. Label the `git diff --check` row's scope, or report the aggregate result and an explicit decision on it
   (W3-03).
4. Report the inventory as 46/47 with the ledger drift explained, or re-run at a labelled snapshot (W3-04).
5. Fix the untracked count to 17 (W3-05); add the app rename (W3-06) and the INTERNET-removal posture (W3-07)
   to the PR description; settle the gate count (W3-08).

Append the next unused ledger entry; do not edit Entries 0078–0085. Do not implement F7, O1 or O3.

---

## 6. Authority boundary

W3 approval, when earned, means the aggregate delta has been reviewed and the packet accurately describes it.
It is **not** merge, push, PR-creation, signing or release authority. **C6 remains NOT EVALUATED**; nothing here
speaks to memory qualification or physical-device readiness. W4 remains preparation only, and W5 remains a
proposed landing package for owner approval.

Nothing was staged, committed, pushed, merged, signed or released in this audit, and the physical Pixel was not
touched.

```text
W3 REQUEST CHANGES — AGGREGATE DELTA SOUND; PACKET INVENTORY AND RISK CHARACTERISATION INCOMPLETE
```
