# Work Order — Antigravity (Opus 4.8, `/goal` mode)

## Live-session RPE/RIR device evidence for the RPE-familiarisation candidate

Handed over from Claude Code executor, PROMPT_LEDGER Entry 0067 → Entry 0068.
Predecessor verdict: **`PARTIAL`**. You are completing the residue, not repeating the run.

---

## 0. Autonomous-run rules — read first

You run continuously with **no human in the loop**. There is no one to ask mid-run. Therefore:

- **Never improvise past an ambiguity.** If a decision is not covered here, take the *most
  conservative* option, record it, and continue. If the conservative option makes the task
  impossible, **stop and write the handback** — a truthful partial is worth more than a guessed pass.
- **Fail closed.** Any hard stop condition (§6) means: stop touching the device, write the handback,
  halt. Do not attempt repair.
- **Never fix product code.** This is an evidence-gathering run. If you find a defect, you *record*
  it. You do not fix it, and you do not "just adjust" a test to make it pass.
- **Report what happened, not what should have happened.** If a case fails, say `FAIL` and show the
  observation. A handback that overstates completion is worse than one that admits a gap — your
  successor is auditing you specifically for this.
- **No push, PR, merge, rebase, tag, release, or signing-key use. Ever.** Commits are local and
  documentation-only.

---

## 1. Why this run exists

The candidate's central fix is the **SessionScreen effort-cue anchoring** change: when actual effort
is unanswered — or the athlete picks *"Not sure"* — the UI must **not** display a cue derived from
the planned target RPE, because that would suggest the answer the athlete is supposed to report
independently.

Entry 0067 verified this **only by committed component tests**. It has **no device evidence**,
because reaching the effort controls requires an active session, which that work order prohibited.
That is the gap you close.

Everything else in the smoke matrix already passed on device (glossary, corrected meanings,
navigation, offline, portrait layout, stability). **Do not re-run those except where §4.F asks for a
narrow regression check.**

---

## 2. Frozen state you are inheriting

Work in:

```text
C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation
```

| Item | Value |
|---|---|
| Branch | `codex/rpe-familiarisation` |
| Required starting HEAD | `97230fb17a6beabeb60255142816e3b9078fd9c5` |
| `BUILD_HEAD` (the artifact's provenance) | `e927d8ee5d7f01497e85d1a4c7f64c927c26dea4` |
| Approved product commit | `6dde126f058fdd3ec2c765dd4e3c4d9ed02d3e06` |
| Approved product tree | `17eeb8c7cc6e32d09c6e316566f0759a60ff4ffb` |
| APK path | `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` |
| APK SHA-256 | `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67` |
| Device serial | `49241FDAP001C7` |
| Package | `com.pikemethods.training.qa` (QA only — never touch any other package) |

**Verify HEAD and a clean tree before your first write. Stop on unexplained drift.**

### Device state as handed over

Pixel 9 Pro (`caiman`), Android 17 / API 37, page size 4096, `arm64-v8a`. The QA APK above is
**already installed** and its on-device hash was confirmed byte-identical to the build. You should
**not need to rebuild or reinstall** — see §5.

The app already contains, all created 2026-09-04 during Entry 0067:

- Profile: goal *all-round fitness* (`gpp`), experience *new to this* (beginner), 4 days ≤ 90 min,
  full gym, no limitations noted. Effort ceiling RPE 9.0.
- Program: coach-build, 8-week review horizon (normalised to 2 × 4-week blocks), **Linear**, starting
  2026-09-04. Weekly split includes upper / full / conditioning days.
- **No sessions, no logged sets, no outcomes.** Training history is empty.

The owner's phone was left with **Wi-Fi off and airplane mode on**. Connectivity is irrelevant to the
app (it holds no `INTERNET` permission) but confirm the owner has restored it before you finish, and
say so in the handback.

### Environment prerequisites — already satisfied, do not redo blindly

`node_modules` is materialized, the embedder revision cache is fetched, and the gitignored model
asset is staged at `apps/mobile/android/app/src/main/assets/minilm.onnx` (ratified pin
`afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`, 22,972,370 B).

**Two traps that cost the predecessor time — do not fall into them:**

1. **A green `verify:ci` in a fresh worktree can be a lie.** If `node_modules` is missing, Node
   resolution silently walks up to the **main repository's** `node_modules` (master lineage) and the
   gate passes against the wrong dependency tree. Always confirm
   `node_modules/@react-native/gradle-plugin` exists in *this* worktree before trusting any gate.
2. **The model asset is gitignored and staged manually** per `docs/PRE_RELEASE_ANDROID.md:44`. Without
   it, `verify:qa-candidate` correctly rejects the artifact for a missing `assets/minilm.onnx`.

---

## 3. Authorization — what changed, and what did not

**You ARE authorized to start one session on the QA build and log sets.** Entry 0067 withheld this;
this handover grants it, because next-set reset and persistence cannot be evidenced any other way.

Rationale, recorded so the owner can override by editing this section before running: the QA package
was freshly installed on 2026-09-04 and contains **only synthetic QA data created during Entry 0067**.
There is no real athlete history in it. Logging therefore cannot destroy owner data.

**Still absolutely prohibited:**

- Any package other than `com.pikemethods.training.qa`.
- Uninstall, `pm clear`, storage clear, downgrade, factory reset, database reset,
  *Reset and load demo*, *Load demo athlete*, athlete wipe, profile-slot switching.
- Regenerating or deleting the existing program, or altering health permissions.
- Product-code, schema, migration, dependency, signing-config, version or build-script changes.
- Push, PR, merge, rebase, tag, release, signing-key use.

Keep the blast radius to: **one session, its sets, and the outcomes they legitimately produce.**

---

## 4. The work

Record every case as `PASS`, `FAIL`, or `NOT RUN` with the concrete observation that justifies it.

### A. Inline information buttons — RPE/RIR and loading method
Find and open the RPE/RIR and loading-method information affordances reachable from the session and
program surfaces. Confirm each opens readable text and closes reliably (tap-away **and** Android
Back), with no navigation trap. Entry 0067 only managed the *"What does GPP mean?"* tooltip, which
passed; the RPE/RIR and loading-method ones are unverified.

### B. Effort draft controls before logging — **the core case**
On an active session, at a set whose **planned target RPE is non-null** (ideally 8.0), exercise the
effort control **without pressing "Log set"**:

| Draft state | Required observation |
|---|---|
| Unanswered (untouched) | Neutral guidance only. The exact expected string is `RPE is optional evidence — leave it untouched to skip.` **No target-derived cue may appear.** |
| RIR `2` selected | A cue derived from the *chosen* value appears. |
| Direct RPE `8.5` entered | A cue derived from the *entered* value appears. |
| *"Not sure"* selected | Returns to the **neutral** string above — not a target-derived cue. |

Confirm the full **neutral → chosen cue → neutral** cycle. Capture a screenshot of each of the four
states. **This is the single most important evidence in the run** — it is the fix under test.

A `FAIL` here means the target-derived cue reappears in the unanswered or *"Not sure"* state. Report
it plainly with the screenshot; do not soften it.

### C. Next-set reset
Log one set. Confirm the effort control for the **next** set returns to the unanswered/neutral state
and does not carry over the previous set's answer or show a target-derived cue.

### D. Persistence across a logged set
Confirm the logged effort value persists correctly: background/foreground, then fully kill and
relaunch the app. Verify the **actual** reported effort is stored and displayed as actual — not
conflated with, or overwritten by, the planned target.

Also confirm a set logged with the effort left **untouched** persists as *null / not reported*,
rather than being silently backfilled with the target.

### E. Upgrade preservation
Re-install the **same** APK over itself with `adb -s 49241FDAP001C7 install -r <apk>` and confirm the
profile, program and the sets you logged all survive. This closes the upgrade-path case that Entry
0067 recorded `NOT RUN` (the package had vanished before installation, forcing a fresh install).
Never uninstall to achieve this.

### F. Narrow regression check
After logging, re-open the glossary once and confirm **TARGET RPE**, **RPE CAP** and **LINEAR** still
read as approved — target distinct from cap, and no universal-best claim on linear. This is a
regression spot-check, not a re-run of the full glossary matrix.

### G. Stability
Check app-scoped crash and ANR logs across the whole run. Report any crash or ANR attributable to
`com.pikemethods.training.qa`.

---

## 5. Build policy

**Default: do not rebuild.** The installed artifact already matches `BUILD_HEAD` and passed
`verify:qa-candidate`. Reuse it.

Rebuild **only** if you must change HEAD for a reason this work order authorizes (it does not
anticipate one). If you ever do rebuild, you must re-run in order: `npm.cmd ci` →
`npm.cmd run fetch:embedder` → stage the model asset → `npm.cmd run verify:ci` →
`.\gradlew.bat assembleQa --no-daemon` → `npm.cmd run verify:qa-candidate`, capture every exit code,
and record the new `BUILD_HEAD` and APK SHA-256. **Never relabel the existing artifact as built from
a later commit.**

Evidence (raw logs, screenshots) goes under ignored `scratch/pixel9pro-live-session/<UTC timestamp>/`.
Keep personal information out of committed documents — the owner's display name is on the device;
do not transcribe it into the handback.

---

## 6. Hard stop conditions

Stop immediately, write the handback, and halt if any of these occur:

- A crash, ANR, or migration-error screen.
- Apparent data loss, or the profile/program disappearing.
- An install signature or version conflict.
- The device becoming unauthorized, disconnected, or a different serial appearing.
- Any required action that this work order does not authorize.
- `git status` showing unexpected modifications to product paths.

---

## 7. Ledger and handback

Append **PROMPT_LEDGER Entry 0069** on this branch as your **first tracked write**, preserving this
work order verbatim, with exactly one Input and one Output section. Commit that ledger-only
initialization before touching the device. Close the entry at the end and make a
**documentation-only** closeout commit. Verify the closeout changes no product bytes.

Write the handback to:

```text
docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md
```

It must contain:

1. Identity: starting HEAD, final documentation HEAD, `BUILD_HEAD`, APK SHA-256, device identity,
   and whether you rebuilt (and why, if so).
2. Per-case results for **A–G** with the concrete observation and evidence reference for each.
   Screenshots for all four states in case **B**.
3. **Exactly what was written to the device database**: how many sessions, how many sets, with what
   effort values, and whether anything was left in a partial state.
4. Commands run with exit codes.
5. Limitations and anything still `NOT RUN`.
6. Confirmation of the §3 boundaries — explicitly including that no push, merge or release occurred
   and no prohibited device action was taken.

### 7.1 Section addressed to the reviewing model

The handback must end with a section titled **"For the reviewing model"** containing:

- Every **assumption** you made where this work order was silent, and what you chose.
- Every **deviation** from this work order, with its justification.
- Your **confidence** in each of A–G, and specifically: *is the effort-cue fix genuinely evidenced on
  device, or did you infer it?* Say so directly.
- Anything you tried that **did not work**, and how you worked around it.
- What you would want checked if you were reviewing your own run.

Write this section for an auditor who assumes nothing and will verify your claims against the
evidence files. Do not summarise it away.

---

## 8. Completion tokens

On success:

```text
LIVE SESSION RPE/RIR DEVICE EVIDENCE: PASS
NEXT-SET RESET: PASS
PERSISTENCE ACROSS LOGGED SETS: PASS
UPGRADE PRESERVATION: PASS
C6: NOT EVALUATED
PUSH / MERGE / RELEASE: NOT PERFORMED
READY FOR REVIEW
```

Use `PARTIAL` where a case could not be exercised, and `FAIL` where an observed behaviour is
incorrect. **C6 (low-memory/device gate) remains out of scope — do not attempt it.** Do not claim
unrestricted release readiness under any outcome.
