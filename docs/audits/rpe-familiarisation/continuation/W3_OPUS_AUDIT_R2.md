# W3 Opus Audit — Round 2: Remediated Integration Packet

## 0. Verdict

```text
W3 APPROVE — AGGREGATE DELTA REVIEWED; PACKET ACCURATE
```

All eight findings from `W3_OPUS_AUDIT.md` are closed. The inventory is complete, the migration risk is
described accurately, the verification matrix now measures what it claims to measure, and the two undisclosed
product-facing changes are in the PR description.

**Scope of this approval.** W3 approval means the aggregate delta has been reviewed and the packet describes it
accurately. It is **not** authority to stage, commit, push, create a PR, merge, sign or release. **C6 remains
NOT EVALUATED** — nothing here speaks to memory qualification or physical-device readiness.

**Reviewed packet:** 57,821 B, SHA-256 `4bfd1f443a7f635969928f6823fb7ca3645a65c3914886b656d1ab640ffb34fb`
(previously 49,216 B / `ca716eeb…`).
**State:** HEAD `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`, unmoved; tree dirty; ledger pre-write 398,703 B
`2e5a41cf…`.

---

## 1. Finding disposition

| ID | Was | Now |
| :--- | :--- | :--- |
| W3-01 | Inventory 305 / 310 | **CLOSED** |
| W3-02 | "additive and backwards-compatible" inaccurate | **CLOSED** |
| W3-03 | `git diff --check` scope mismatch | **CLOSED** |
| W3-04 | "47/47" not reproducible | **CLOSED** |
| W3-05 | Untracked 16 vs 17 | **CLOSED** |
| W3-06 | App rename undisclosed in PR | **CLOSED** |
| W3-07 | Permission posture under-disclosed | **CLOSED** |
| W3-08 | Gate count inconsistent | **CLOSED** |
| W3-09 | *(new, found in this pass)* cited inventory hash no longer resolves | **OPEN — observation, non-blocking** (§3a) |

### W3-01 — Inventory complete

I re-diffed the appendix against `git diff --name-only 4c5056fc..HEAD`: **310 repository paths, zero absent.**
A new category `Mobile App & Build Configuration (apps/mobile/) (5 paths)` fills the classification gap between
the `apps/mobile/src|test` and `apps/mobile/android|ios` prefixes and the repo-root category. Declared totals
now sum correctly: 50 + 5 + 30 + 45 + 8 + 111 + 34 + 27 = **310**.

All five previously-omitted files are present and mapped, including the substantive detail I flagged — the
`op-sqlite` pin, the worktree-correctness fixes in `babel.config.js` / `metro.config.js` / `jest.config.js`, and
the `app.json` rename.

### W3-02 — Migration risk described accurately

The packet now states, in the risk section rather than buried:

- `004_state_vector_materialize.sql` is a **modified historical migration, not a new additive migration**;
- it removes the ACWR / load component (weight 0.30), leaving readiness a weighted mean of HRV (0.35) and
  sleep (0.25);
- because `migrationRunner.ts` gates on `user_version`, **existing installs retain the legacy ACWR-weighted
  score while fresh installs apply the new formula**, and merge/release evaluation must account for that
  bifurcation;
- migrations 049 and 052 perform **destructive table rebuilds** against `movement_equipment`,
  `movement_role_eligibility` and `routine_template_slot`;
- data preservation is described precisely — `CREATE TABLE …_vNNN` → `INSERT … SELECT` → `DROP TABLE` →
  `RENAME`, rows copied before anything is dropped, primary keys preserved on `routine_template_slot`, with
  054's legacy-allowance cleanup and 060's temporary `_m060_guard` correctly characterised as benign.

That matches what I verified in the SQL itself. The summary line no longer calls the set "additive".

### W3-03 — Verification matrix scope corrected

Split into two labelled rows:

| Scope | Command | Exit |
| :--- | :--- | :--- |
| Working tree | `git diff --check` | 0 |
| Branch aggregate | `git diff --check 4c5056fc…..HEAD` | **2, 4,859 warnings** |

with an explicit **ACCEPTED / DEFERRED** disposition: the warnings sit in preserved evidence and documentation,
and reformatting 310 files would disturb captured provenance for no functional gain. That is a reasonable call,
and the point was that it be stated rather than left implicit.

### W3-04 — Inventory result now reproducible

Reported as **46/47 records verified across 45 distinct paths**, naming `PROMPT_LEDGER.md` as the single
mismatch, giving the snapshot size and hash, attributing the drift to Entries 0082–0086, and stating plainly
that it is documentation continuation drift and not an artifact regression. This matches my own measurement.

### W3-05 — Untracked count corrected

Now **17**, with an honest note that the packet itself was missing from the preliminary 16-count, plus a
proactive disclosure that `W3_OPUS_AUDIT.md` has since joined as an 18th. The live count is indeed 18. Handling
a moving count by disclosing the movement is the right approach.

### W3-06 — Rename disclosed, and the claim checks out

The rename appears in both the path mapping and the PR description. I verified the three-way coordination
claim rather than accepting it: `apps/mobile/app.json` (`name`/`displayName`), Android
`res/values/strings.xml` (`app_name`), and `MainActivity.kt` — where `getMainComponentName()` changes
`"AthleteKinetics"` → `"pikeMethods"` and carries an in-code note that it must equal `app.json`'s `name` or
cold launch throws an AppRegistry invariant violation. The packet's description is accurate.

### W3-07 — Permission posture stated

The PR description now records the net permission **removal** — `android.permission.INTERNET` stripped from the
production manifest via `tools:node="remove"`, blocking transitive injection by `react-native-blob-util`, with
the debug overlay re-adding it for Metro only — and states **zero new Android permissions**, noting the Health
Connect read scopes pre-existed at the merge base. Both halves match what I measured.

### W3-08 — Gate count correct

Now "All 23 verification gates". I confirmed against `package.json` that `verify:ci` chains exactly **23**
steps. This closes a counting inconsistency that had recurred across three documents.

---

## 2. Coverage — narrowed, and what remains

My prior audit left open coverage across a 310-path delta and said a future approval should either close it or
accept it explicitly. Doing that now.

**Narrowed in this pass.** I characterised the entire `packages/inference` delta at file and stat level. It is
overwhelmingly **additive** rather than a rewrite of existing behaviour:

| File | Delta |
| :--- | ---: |
| `routineMicrocycle.ts` | +864 / −0 |
| `movementRanking.ts` | +536 / −0 |
| `loadSelection.ts` | +190 / −0 |
| `e1rm.ts` | +117 / −0 |
| `pickerTiering.ts` | +104 / −0 |
| `blockGenerator.ts` | +781 / −62 |
| `routineComposer.ts` | +298 / −15 |
| `capabilityResolver.ts` | +69 / −9 |
| `types.ts` | +64 / −7 |

Deletions are confined to six files and are small relative to the additions. Every one of these modules has a
dedicated `verify_*` gate inside the same delta — `verify_blocks`, `verify_load_selection`,
`verify_movementRanking`, `verify_pipeline`, `verify_policy`, `verify_programQualityRound2`,
`verify_longitudinal_bounds`, `verify_autopilot_counterexamples` — and all pass.

**Accepted as a stated limit.** Still not reviewed line by line: the 111 `docs` paths, the 34 `tools`/`scripts`
paths, the `apps/mobile/src|test` paths beyond those audited across the W2 and Freeze-4 rounds, and the 66/16-line
`.github/workflows/ci.yml` diff. I accept this because the delta's highest-consequence surfaces have been
examined directly — migrations and data preservation, native manifests and permissions, dependency and build
configuration, and the RPE/selector product surface across four prior audit rounds — and because every
integration gate passes. It is an accepted limit, not a closed one, and a reviewer should read it that way.

---

## 3. Reproduction posture

Product inputs are **byte-identical** to my prior W3 pass (`RoutineTemplateBuilder.tsx` `98e8aef8…`, QA APK
`3777054f…`) and the remediation was documentation-only, so the four integration gates were **not** re-run.
I rely on my own same-session reproduction recorded in Entry 0085 — `typecheck`, `verify:blocks`,
`verify:components` (20 suites / 282 tests) and `verify:ci`, all exit 0 — consistent with the queue rule against
repeating full CI for unchanged product inputs.

**Verified fresh in this pass:** appendix-to-repository path diff; category totals; `verify:ci` chain length;
the `MainActivity.kt` rename; ledger append-only integrity (778 insertions, 0 deletions, 5,338 CRLF, 0 bare LF,
87 entries, my Entries 0080/0083/0085 each present once and unedited); and unchanged hashes for the product
source, focused test, QA APK, `W2_OPUS_AUDIT_R2.md` and `W3_OPUS_AUDIT.md`.

`FREEZE_INVENTORY_W2.json` is the one exception, recorded as **W3-09** below.

---

## 3a. W3-09 — Observation — a cited inventory hash no longer resolves

Found while verifying artifact integrity for this pass, and reported rather than quietly dropped.

`docs/audits/rpe-familiarisation/continuation/FREEZE_INVENTORY_W2.json` on disk now hashes
`8fef8466a4058243c0db2f1e5caf90634a6915e53205fc50fc9c4c3089637661` (11,546 B, mtime `2026-09-04T17:04:14Z`,
internal `generatedAt` `2026-09-04T17:02:33.902Z`, `stage: W2_REMEDIATION_PATH_A_RECAPTURE`).

Two frozen documents cite a different value as the reviewed inventory:

- `WORKORDER_OPUS_W2_PATH_A_CLOSEOUT.md:36` — `af3a46f47db568810f07e189e064bc9cd316c46024ae9dbb83ee9d47e39d1496`
- `W2_OPUS_AUDIT_R3.md:21` — the same hash, in that audit's verdict-binding table

**That hash does not resolve to the file on disk.** It is my own citation as much as the work order's.

What I can and cannot establish:

- The regeneration itself **was disclosed**: Entry 0081 records "Updated
  `docs/audits/rpe-familiarisation/continuation/FREEZE_INVENTORY_W2.json` with 45/45 file hashes matching disk"
  as a Path A deliverable. This is not an undisclosed change, and no ledger entry misrepresents it.
- No entry records the before/after inventory hashes, so the exact point at which
  `af3a46f4…` became `8fef8466…` relative to the W2 R3 verification **cannot be reconstructed** from retained
  evidence. I state that rather than infer a sequence.
- **Substance is intact.** I re-verified the current file: 47 records across 45 distinct paths, **46 verify
  against disk**, and the single mismatch is `PROMPT_LEDGER.md` — the same expected documentation continuation
  drift already disclosed under W3-04. No artifact regression.

**Why this does not change the W3 verdict.** The W3 packet cites no inventory hash of its own, and its 46/47
claim verifies against the file as it exists now. The aggregate delta is unaffected. This is a W2-lineage
provenance-citation issue, of the same class as the replaced `ui_font13_builder.xml` I disclosed in
`W2_OPUS_AUDIT_R3.md` §3 — a cited hash that has been superseded in place.

**To close (documentation only, next executor append):** record both inventory hashes and the regeneration
boundary in the ledger, and note against `W2_OPUS_AUDIT_R3.md:21` and the Path A work order table that
`af3a46f4…` is a superseded snapshot. Do not edit either frozen document, and do not regenerate the inventory
again to make a hash match.

---

## 4. Carried owner decisions — still open

Unchanged and still unimplemented. W3 approval authorises none of them:

- **F7** — shared `InfoTip` nominal 42 dp effective target against the repository's `theme.touch.min = 56`.
- **O1** — raw `LINEAR` / `APRE` identifiers as tooltip titles.
- **O3** — slot-role chip row clipping `ACC` at the screen edge under `font_scale 1.30`, no horizontal scroll.

Each requires a separate owner-approved scope.

---

## 5. Next queue step — W4 C6 / release preparation

Issued under original continuation work order §5.3. Preparation only.

```text
W4 — C6 / release preparation packet (executor task)

Workspace: C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation
Branch: codex/rpe-familiarisation. Integrity mode: development.
Authorising audit: docs/audits/rpe-familiarisation/continuation/W3_OPUS_AUDIT_R2.md (W3 APPROVE).

Before any write, snapshot identity: branch, HEAD, dirty-diff fingerprint and byte count, and the pre-write
PROMPT_LEDGER size and SHA-256. Append the next unused ledger entry as your first tracked write, preserving
CRLF and every closed entry. Do not edit Entries 0078-0087.

Produce docs/audits/rpe-familiarisation/continuation/W4_C6_RELEASE_PREPARATION.md containing:

1. The current executable memory and provenance contracts as they actually exist in the repository — name the
   files and the commands that run them (for example the memory-audit tooling under tools/memory-audit/ and
   npm run verify:memory-contract). State what each one does and does not prove.
2. A clear three-way separation: (a) tooling that is ready and runnable today; (b) physical evidence that is
   missing and can only come from a device run; (c) decisions that are the owner's alone. Do not blur these.
3. C6 status recorded as NOT EVALUATED. Emulator success is not physical 4 GB qualification and must not be
   presented as such anywhere in the document.
4. A release-gate inventory: every gate that would have to pass for a release decision, its current state, and
   whether it has ever been run against the current candidate.
5. The three carried findings (F7, O1, O3) restated as open owner decisions with their current evidence.

Scope limits: this is PREPARATION ONLY. No phone or physical Pixel actions, no stress runs, no memory
threshold changes, no signing-secret access, no store submission, no APK rebuild, no emulator session, no
product code, migration, schema, dependency, native or CI-gate change.

Stop when the document is written and the ledger Output section is closed. Freeze it and hand back for the
Opus W4 audit. Do not stage, commit, push, create a PR, merge, sign or release.
```

W5 remains a proposed landing package for owner approval, and follows W4.

---

## 6. Authority boundary

Nothing was staged, committed, pushed, merged, signed or released in this audit. The physical Pixel was not
touched. No product code, test, migration, schema, dependency, native file, APK, evidence file or prior audit
was modified, and no closed ledger entry was edited.

```text
W3 APPROVE — AGGREGATE DELTA REVIEWED; PACKET ACCURATE
```
