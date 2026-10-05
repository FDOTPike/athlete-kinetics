# Pixel 9 Pro QA Build and Non-Writing Smoke Test

**Verdict: `PARTIAL`** — every non-writing case that could be exercised without creating training
records passed; the live-session effort cases were not run by owner decision.

Executor: single Opus executor (no reviewer team, per owner decision). Ledger Entry 0067.

---

## 1. Build inputs and provenance

| Item | Value |
|---|---|
| Worktree | `.worktrees/rpe-familiarisation` |
| Branch | `codex/rpe-familiarisation` |
| Required starting HEAD | `6984f95c56d8434a1f7bd15c76ba5b9726c6c64a` — confirmed, clean tree |
| Approved product commit | `6dde126f058fdd3ec2c765dd4e3c4d9ed02d3e06` |
| Approved product tree | `17eeb8c7cc6e32d09c6e316566f0759a60ff4ffb` — confirmed matching |
| `BUILD_HEAD` | `e927d8ee5d7f01497e85d1a4c7f64c927c26dea4` |
| Final documentation HEAD | recorded in the closeout commit that adds this report |
| APK SHA-256 | `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67` |
| APK size | 194,449,552 bytes (537 entries) |

`git diff --name-status 6984f95..e927d8e` returns `PROMPT_LEDGER.md` only — documentation.
`git diff --name-status 6dde126..e927d8e` returns `PROMPT_LEDGER.md` and
`docs/audits/rpe-familiarisation/EXECUTOR_HANDOFF.md` — documentation. **No product bytes changed**
between the approved product freeze and `BUILD_HEAD`.

The APK's own embedded manifest independently confirms provenance: `head=e927d8ee5d7f`,
`dirty=false`, branch `codex/rpe-familiarisation`, tracked-diff fingerprint
`e3b0c44298fc…` (the empty-diff SHA-256), 0 staged/new paths.

Opus's approval of the underlying candidate is already persisted alongside this report in
`OPUS_INDEPENDENT_AUDIT.md` and `OPUS_REAUDIT_ROUND3.md`; this run adds device evidence only and
does not re-approve the product.

## 2. Commands and exit codes

| Command | Exit |
|---|---|
| `npm.cmd ci` | 0 |
| `npm.cmd run fetch:embedder` | 0 |
| `npm.cmd run verify:ci` | 0 |
| `.\gradlew.bat assembleQa --no-daemon` | 0 (`BUILD SUCCESSFUL`) |
| `npm.cmd run verify:qa-candidate` | 0 (`QA ARTIFACT VERIFIED`) |
| `git diff --exit-code` | 0 |
| `git diff --cached --exit-code` | 0 |
| `adb -s <serial> install -r … app-qa.apk` | 0 (`Success`) |

Artifact gate highlights (real-candidate mode, external Android SDK build-tools 36.0.0 mandatory
and discovered — not fixture mode): non-empty Hermes bundle packaged; package id
`com.pikemethods.training.qa`, variant `qa`; model asset at the ratified size 22,972,370 B and
SHA-256 `afdb6f1a…`; Archivo font at its ratified pin; onnxruntime JSI/runtime pairs present for
all four ABIs; v2 signature with the Android Debug signing class; `zipalign -c -P 16 4` clean;
every inspected ELF64 `PT_LOAD` ≥ `0x4000` across 28 libraries; and **no
`android.permission.INTERNET`** (10 permissions, none networking).

### Build prerequisites that a fresh worktree does not satisfy

Three environment steps were required and are recorded because they are gate-integrity relevant:

1. **`node_modules` was absent.** The very first `verify:ci` invocation reported exit 0 *before*
   dependencies were installed, because Node module resolution walked up to the **main repository's**
   `node_modules` (master lineage, `3358be6`) rather than this branch's pinned tree. That result was
   discarded as invalid and the gate was re-run after `npm ci`. A green `verify:ci` inside a fresh
   worktree is therefore not by itself trustworthy — this is a real hazard worth fixing upstream.
2. **Embedder revision cache absent** — `scripts/verify-preflight.mjs` failed closed and named the
   documented remedy (`npm run fetch:embedder`, the only network-capable, byte-verifying materializer).
3. **`assets/minilm.onnx` not staged** — the first `assembleQa` produced an APK that
   `verify:qa-candidate` correctly **REJECTED** for a missing model asset. The model is gitignored and
   staged manually per `docs/PRE_RELEASE_ANDROID.md:44`. Staged at the ratified pin and rebuilt. The
   ledger shows a prior run hit this identical trap.

None of these touched tracked files: the worktree was verified clean (`git status --porcelain` empty)
immediately before and after the build, and `package-lock.json` / `package.json` are unmodified.

## 3. Device and runtime identity (remeasured, not assumed)

| Property | Value |
|---|---|
| Model / device | Pixel 9 Pro / `caiman` |
| Android release / SDK | 17 / 37 |
| Page size | 4096 |
| ABI | `arm64-v8a` |
| Build fingerprint | `google/caiman/caiman:17/CP2A.260805.005/15828068:user/release-keys` |
| Installed `versionName` | `1.0.0-beta.1-QA` (`versionCode=1`, `minSdk=26`, `targetSdk=36`) |

Installation verified by pulling the installed artifact's hash on device:
`sha256sum /data/app/…/base.apk` = `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67`
— **byte-identical to the built artifact**.

### Pre-existing install and the absence of an existing athlete

At the pre-install baseline the QA package **was** installed (`lastUpdateTime=2026-09-01 01:28:04`)
and its READY tab showed *"No readiness yet"* with demo-loading affordances — i.e. no athlete or
readiness data was visible even then. By the time installation began the package was **absent
entirely**, including from `pm list packages -u` (no retained data). The executor did not uninstall
it and is barred from doing so by this work order; the cause is not established from the evidence
available. Consequently `firstInstallTime == lastUpdateTime == 2026-09-04 08:23:35`: this was a
**fresh install, not an upgrade**, and no pre-existing athlete survived into the test.

No claim of database integrity is made from screenshots.

## 4. Smoke-test matrix

| Case | Result | Evidence and reasoning |
|---|---|---|
| Launch and upgrade | `PASS` (launch) / `NOT RUN` (upgrade preservation) | App opens to onboarding with no crash, no migration-error screen and no Metro connection; JS is bundled in-APK. Upgrade-preservation could not be exercised: the package was absent at install time, so there was no prior state to preserve. |
| Navigation | `PASS` | READY / SESSION / COACH / LIBRARY / ATHLETE all open and render. Android Back dismisses the glossary back to Athlete Profile, dismisses an info tooltip in place, and at the onboarding root exits to the launcher — all without a trap; relaunch restores correctly. |
| Inline information | `PARTIAL` | The reachable inline affordance works: *"What does GPP mean?"* opens a readable explanation ("General Physical Preparedness — broad, balanced fitness…") and closes both by tap and by Back. RPE/RIR-specific and loading-method info buttons were not reachable without starting a session — see *Existing session only*. |
| Glossary | `PASS` | Athlete → *Open terminology glossary* opens a 46-term offline reference with category filters. Searches: `RPE` → 7 terms, `RIR` → 1, `target` → 5 (TARGET RPE first), `cap` → 3, `load` → 12 (LOAD first), `sets` → 3 (SETS first), `undulating` → 1, `linear` → 1. Alias search `wave` → Undulating. Mixed case `UnDuLaTiNg` → Undulating. No-results `zzqqxx` → `0 TERMS` with *"No matching terms found / No entries match "zzqqxx" in the glossary…"*. |
| Corrected meanings | `PASS` | Read on device: **TARGET RPE** — *"The planned effort the program asks you to aim for on a set… but is never assumed to be your actual reported effort."* **RPE CAP** — *"The maximum permitted effort ceiling… Unlike a target RPE that you aim for, a cap is a strict upper boundary that sets should not exceed."* **RPE MAX** — *"A ceiling, not a target."* **LOAD** and **SETS** both lead with the underlying concept (weight/resistance; a group of consecutive reps followed by rest) before the planning adjustment. **LINEAR** — *"A structured loading method where planned load or effort increases steadily across the first three working weeks of a block, followed by a planned deload in week four"* — no universal-best claim. |
| Offline operation | `PASS` (owner-assisted) | Owner switched Wi-Fi off; device confirmed fully offline (`Active default network: none`, no connected network agents, airplane mode on). With connectivity genuinely absent the glossary opened, search returned correct results (`cap` → 3 terms), and the Movement Library rendered 172/300 movements. Reinforced structurally: the packaged manifest carries **no `INTERNET` permission** (only `ACCESS_NETWORK_STATE`), so the app cannot reach the network in any radio state. |
| Pixel layout | `PASS` (portrait), with a landscape observation | Portrait at the device's current display settings: text readable, controls tappable, nothing clipped by screen edges or the gesture navigation bar, content clear of the tab bar. Landscape observations — (a) on the final onboarding step the primary CTA sits below the fold and needs two scrolls with no visual affordance; (b) on the injuries step the second option box is visually clipped by the bottom action bar. Both are landscape-only and neither blocks completion. |
| Existing session only | `NOT RUN` | No session existed after the fresh install, and reaching the effort controls would have required starting one — explicitly prohibited ("do not start… a session merely to reach a test screen"). Owner was asked and chose to uphold the prohibition. The unanswered → RIR `2` → direct `8.5` → *"Not sure"* neutral→cue→neutral behaviour therefore remains verified **only by the committed component tests, not by device evidence**. No set was logged. |
| Stability | `PASS` | Zero app entries in the crash buffer across the whole session (`logcat -b crash` filtered to the package = 0). No new ANR (`/data/anr` holds only a stale unrelated 2026-04-16 record). App survived background→foreground, Back-to-launcher and relaunch, and remained resident throughout. |

## 5. Deviations from the work order

Recorded plainly; each was either owner-directed or environmentally forced.

1. **Onboarding was completed** (owner instruction: *"Please proceed with filling out the app
   yourself"*), overriding "do not save questionnaire changes". The resulting profile is QA data:
   goal *all-round fitness*, experience *new to this* (chosen deliberately — the candidate under test
   is the beginner-facing RPE/RIR familiarisation work), 4 days ≤90 min, full gym, no limitations.
   The display name was entered by the owner directly on the device, not by the executor.
2. **A program was created** — coach-build, 8-week review horizon (normalised to 2 × 4-week blocks),
   Linear method. This was necessary to pass the onboarding gate; it is a program record, not a
   training record.
3. **Environment preparation** — `npm ci`, `fetch:embedder`, and manual model staging, as described
   in §2. Gitignored paths only.
4. **Execution worktree** — this executor session was provisioned in a different Claude worktree; per
   the work order's explicit "Work only in" instruction all work was performed in
   `.worktrees/rpe-familiarisation`. The provisioned worktree was left untouched.
5. **A demo reset was requested and then retracted by the owner mid-run; it was never performed.**

## 6. Confirmation of boundaries held

- **No synthetic training records.** No session was started, finished or skipped; *"Log set"* was
  never pressed; no set, session or outcome was written.
- **No demo data seeded and no database reset.** *"Load demo athlete"* and *"Reset and load demo"*
  were never pressed, including when initially requested — the owner retracted before any action.
- **No uninstall, storage clear, downgrade, athlete wipe or database reset** was performed by the
  executor at any point.
- **No product edits.** `apps/`, `packages/`, `tools/`, `scripts/`, schema, migrations, dependencies,
  signing configuration, versions and build scripts are unmodified; the worktree was clean at build
  time and the artifact records `dirty=false`.
- **No push, PR, merge, tag, release or signing-key use.** Commits are local and documentation-only.
- **No health permissions altered**, no questionnaire re-saved after creation, no athlete/profile slot
  switched, no program regenerated.

## 7. Limitations

- Live logging, next-set reset, and persistence across actually logged sets remain untested on device.
- The RPE/RIR effort-cue anchoring fix — the core of the candidate — has **no device evidence**; it
  rests on the committed component tests. Automated tests are explicitly not treated as device
  evidence here.
- The upgrade/migration path was not exercised, because installation was a fresh install.
- C6 low-memory/device gate: **not evaluated**; out of scope for this work order.
- Database integrity is not asserted; only visible UI state was observed.

## 8. Handback

```
PIXEL 9 PRO NON-WRITING SMOKE: PARTIAL
LIVE LOGGING / NEXT-SET / PERSISTENCE: NOT TESTED ON DEVICE
C6: NOT EVALUATED
READY FOR CODEX/SOL REVIEW
PUSH / MERGE / RELEASE: NOT PERFORMED
```

`PARTIAL` rather than `PASS` because the *Existing session only* case and the RPE/RIR and
loading-method inline information buttons could not be exercised without creating training records.
No observed behaviour was incorrect. This is not a claim of unrestricted release readiness.

Raw logs and screenshots: ignored `scratch/pixel9pro-smoke/2026-09-03T21-59-17Z/`.
