# W1 Opus Audit — Selector Regression Hardening and Evidence Reconciliation

## 0. Verdict

```text
W1 REQUEST CHANGES
```

Bound to freeze: HEAD `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`, branch `codex/rpe-familiarisation`,
tracked-diff fingerprint `f8b0f4fb7e7983adb24ac32d9c7671396b35c2aa92898613e296c3fc9808bc0b`
(64,223 bytes, `sha256(git diff --full-index --binary HEAD)`), both independently recomputed here.

**The engineering substance of W1 passes.** Every product/test claim Gemini made was reproduced from
tools, including both fail-closed probes, the 43-row manifest and the raw-log re-categorisation.
**Two record-integrity defects block approval**, neither of which requires a product code change:

- **F1** — the freeze inventory carries a digest for `HANDBACK_ISOLATED_QA.md` that no tool could have
  produced from that file.
- **F2** — the specific residual W1 was dispatched to address is still uncorrected in the evidence document.

W1 approval is the permission to begin W2 (work order §4.2). That permission is **withheld** pending the
three documentation-only items in §6. It is not a finding against the selector fix or the hardened test.

- **Auditor:** Opus, fresh audit context, 2026-09-04T04:56Z.
- **Audited handback:** `docs/audits/rpe-familiarisation/continuation/W1_EXECUTOR.md` (SHA-256 `703c37d7c10e6d96fbbd24d4f88f0a9997164eff3cdc2465fb2e4d8359f869fa`).
- **Work order:** `docs/WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md`, SHA-256 recomputed `6e37e00b0b8467870f8a14f7fb77d0d19e9293c16a0856950a1129f0856beacf` — matches the executor's citation.
- **Writes performed by this audit:** this file only. No product code, test, ledger, evidence or inventory
  file was created, modified or deleted. No commit, stage, push, merge, tag or release. No emulator, APK or
  physical Pixel action.

---

## 1. Required disclosure (work order §9)

An **earlier Opus session authored the inherited initial flex fix** now under audit: `flex: 1` on
`styles.schemaChipContainer`, its explanatory comment, the `testID={`loading-method-option-${st}`}` on each
option container, and the original regression test. This is recorded at `PROMPT_LEDGER.md` Entry 0074 and
stated in the work order §1.

This audit ran in a fresh context and authored no product code, here or previously in this session. The
disclosure still constrains what this verdict may claim:

- I am **not** an independent second reviewer of the flex fix's *design*. I am an independent verifier of
  W1's hardening work and of Gemini's evidence claims.
- Mitigation applied: the necessity of the container `flex` was re-derived from the component source
  (`RoutineTemplateBuilder.tsx:743-780`, `:1596-1612`) rather than accepted from Entry 0074's assertion, and
  both fail-closed probes were executed against mutations of that inherited code (§4).
- This is **one** reviewer, not several. No claim of multiple independent reviewers is made.
- The layout fix remains **unobserved on any device or emulator**. Nothing below endorses it as visually
  correct; that is W2's job.

---

## 2. Freeze verification — candidate identity CONFIRMED

Recomputed with tools in the worktree, not read from the handback.

| Item | Claimed | Recomputed | Result |
| :--- | :--- | :--- | :--- |
| HEAD | `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72` | identical (`git rev-parse HEAD`) | MATCH |
| Branch | `codex/rpe-familiarisation` | identical | MATCH |
| Tracked-diff fingerprint | `f8b0f4fb…8bc0b` | identical | MATCH |
| Diff byte count | 64,223 | 64,223 | MATCH |
| `git diff --check` | exit 0 | exit 0 | MATCH |

Tracked modified files — size and SHA-256, all four **MATCH**:

| Path | Size | SHA-256 |
| :--- | ---: | :--- |
| `PROMPT_LEDGER.md` | 333,876 | `6520c9eaec7250e25eb011b3046caca8fb2ce42c51570c196af25d30808dbdf1` |
| `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | 68,588 | `4f6531bb899ea5a2297bf2b265d67e244a0a39a825b5117260c340afd987acb6` |
| `apps/mobile/test/components/RoutineTemplateBuilder.test.js` | 29,219 | `104e0cbd77741a16e3367673b95771e07e38e4142685d3d9978e4c66c6904343` |
| `docs/audits/rpe-familiarisation/antigravity/HANDBACK_LIVE_SESSION_EVIDENCE.md` | 29,057 | `3bab3f48f8a4ece02cb88a310dc729060076b949d0e61341ee1cae08b31a6d79` |

**Authorized-scope check — PASS.** Exactly four tracked files differ from HEAD. Two are the authorized
product files (§4.1). `PROMPT_LEDGER.md` is required by §3.3. `HANDBACK_LIVE_SESSION_EVIDENCE.md` is
inherited from Entry 0070 — its mtime `01:31:04Z` predates the work order (`03:42:35Z`), so W1 preserved it
rather than editing it, as required. No training-algorithm, glossary, schema, dependency, biometrics or
native-build file is touched.

Untracked audit files — three of four match; the fourth is **F1**:

| Path | Inventory digest | Recomputed | Result |
| :--- | :--- | :--- | :--- |
| `docs/WORKORDER_GEMINI_OPUS_THREE_DAY_CONTINUATION.md` | `6e37e00b…eacf` | identical | MATCH |
| `…/antigravity/WORKORDER_UNATTENDED_ISOLATED_QA.md` | `81dc90bc…eb33` | identical | MATCH |
| `…/codex/CLOSEOUT_AND_PR_PREPARATION.md` | `8dc0584f…d139` | identical | MATCH — and equals the digest Entry 0070 recorded, so the historical Codex closeout is genuinely preserved untouched |
| `…/antigravity/HANDBACK_ISOLATED_QA.md` | `c88f34fe…7df0` | `182f06ae7a4c53c9db9201793a04d1bb5fb73e4fe320990267c97318977daad2` | **MISMATCH** |

---

## 3. F1 — MATERIAL: freeze inventory contains a digest no tool produced

`FREEZE_INVENTORY_W1.json` records `c88f34feebcc573752e259b1f09570c1dd3baae172692797e8838d7211bf7df0`
for `HANDBACK_ISOLATED_QA.md`. The file on disk hashes to
`182f06ae7a4c53c9db9201793a04d1bb5fb73e4fe320990267c97318977daad2` (25,212 bytes).

Alternative explanations were tested and eliminated:

- **Not a line-ending artifact.** The file contains zero CR bytes. Raw bytes and CRLF-stripped bytes both
  give `182f06ae…`; LF→CRLF gives `0349fa72…`; dropping the trailing newline gives `14dfde9b…`. None is `c88f34fe…`.
- **Not a stale digest of an older revision still on disk.** No file anywhere under
  `docs/audits/rpe-familiarisation/` or `scratch/rpe-isolated-qa/` hashes to `c88f34fe…`.
- **Not copied from a prior document.** The string `c88f34fe` occurs exactly once in the entire repository —
  in `FREEZE_INVENTORY_W1.json` itself. It has no upstream source.
- **Not a post-freeze edit.** `HANDBACK_ISOLATED_QA.md` mtime is `2026-09-04T03:32:23Z` — 31 minutes *before*
  the inventory was generated (`04:03:12Z`) and 10 minutes before the work order itself was written
  (`03:42:35Z`). The file was already in its current state when the inventory was produced and has not
  changed since.

The digest therefore was not computed from the file it names. This breaches §3.11 ("hashes must come from
tools and cited evidence; do not generate or manually complete hash suffixes") and defeats §3.4, whose whole
point is that the freeze must identify the candidate.

Severity is raised by context, not lowered by it: this is the **same failure class the packet itself
documents** — `HANDBACK_ISOLATED_QA.md` §6 records that 8 of its original 43 rows carried digests sharing
exactly a 20-hex prefix with the truth and were "not computed — they were confabulated". A freeze inventory
that repeats that failure, while certifying the very file whose manifest integrity W1 was sent to establish,
cannot be used as a provenance anchor for W2's build.

**Scope of the damage is bounded, and worth stating plainly:** every *content* claim Gemini made about that
file independently checks out (§5.1, §5.2). This is a defect in the provenance record, not in the evidence.

---

## 4. Product and test audit — hardening CONFIRMED

### 4.1 Diff inspected directly

`RoutineTemplateBuilder.tsx` — two hunks, both inherited, both confined to the selector: the `testID` added
to each option container (`:746`), and `flex: 1` plus its comment on `styles.schemaChipContainer` (`:1603`).
The press handler, `SCHEMA_LABELS`, chip styling, `InfoTip` wiring and all RPE semantics are untouched.
Confirmed that Gemini made no product change: the file's bytes still hash to the value recorded at freeze,
and the tracked-diff fingerprint is unchanged after all probe activity (§4.3).

`RoutineTemplateBuilder.test.js` — the permissive pattern is genuinely gone. Every lookup is now
`screen.getByTestId(...)` / `screen.getByLabelText(...)`, which throw on absence. No `queryByTestId` and no
`if (container === null) continue` remains anywhere in the file.

### 4.2 The canonical binding is real, not decorative

`expect(EXPECTED_LOADING_METHODS.map((m) => m.schema)).toEqual([...SELECTABLE_SCHEMA_TYPES])` is load-bearing:

- `packages/inference/src/types.ts:241` defines `SELECTABLE_SCHEMA_TYPES = ['LINEAR','WAVE','APRE']`.
- `RoutineTemplateBuilder.tsx:65` sets `const SCHEMAS: readonly SchemaType[] = SELECTABLE_SCHEMA_TYPES` — the
  component renders **exactly** the set the test asserts against, so the test cannot silently under-cover.
- `apps/mobile/jest.config.js` maps `^@ak/inference$` to the real TypeScript source, not a mock, so the
  contract imported by the test is the shipped constant.

Adding a fourth selectable schema fails this assertion. That is the correct fail-closed property.

### 4.3 Negative probes — both independently REPRODUCED

Executed here, not accepted from the handback. To honour the read-only mandate the mutations were applied
**at the Jest transform layer** — a transformer outside the repository (`/tmp/probe/`) rewrote the module
source in memory before Babel, so no repository file was ever written. The transformer throws if its anchor
text is absent, so a silent no-op cannot masquerade as a result. A control run with the harness and no
mutation passed 17/17, proving the harness itself changes nothing.

| Probe | Mutation | Result | Status |
| :--- | :--- | :--- | :--- |
| Control | none | 17/17 passed, exit 0 | harness sound |
| **A** | `testID` removed from option container | `Error: Unable to find an element with testID: loading-method-option-LINEAR` — 1 failed | **FAIL-CLOSED CONFIRMED** |
| **B** | `flex: 1` removed from `schemaChipContainer` | `toMatchObject` diff at `RoutineTemplateBuilder.test.js:134` showing `- "flex": 1` — 1 failed | **FAIL-CLOSED CONFIRMED** |

Probe A's failure text matches Gemini's report verbatim. Probe B fails on exactly the assertion that encodes
the device regression, so the missing-parent-flex regression genuinely cannot pass unnoticed.

**Post-probe integrity re-verified:** tracked-diff fingerprint still `f8b0f4fb…8bc0b`; `RoutineTemplateBuilder.tsx`
still `4f6531bb…`; `RoutineTemplateBuilder.test.js` still `104e0cbd…`. The audit was non-mutating.

### 4.4 Focused suite reproduced

`jest --config apps/mobile/jest.config.js --runInBand apps/mobile/test/components/RoutineTemplateBuilder.test.js`
→ **17 passed / 17 total, exit 0**, including both new tests. `tsc -p apps/mobile/tsconfig.json --noEmit`
→ **exit 0, zero diagnostic output**. Both match the executor's table.

A style assertion is not a pixel measurement. The test proves the style contract holds in a synthetic
renderer; it says nothing about rendered width on a device. The work order is explicit that this is W2's
burden, and this verdict keeps that line.

---

## 5. Evidence reconciliation

### 5.1 43-row manifest — CONFIRMED 43/43

All 43 rows were parsed out of `HANDBACK_ISOLATED_QA.md` mechanically and each recomputed against the raw
file: **43 match on both byte size and SHA-256; 0 missing, 0 size mismatches, 0 hash mismatches.** Gemini's
claim is accurate and the regenerated manifest is trustworthy.

The framing is also correct and appropriately modest: the measurable fact is that the original digests did
not match and the regenerated digests do. Nothing in the packet is used to argue intent from the shared
prefixes, as §4.1 required.

### 5.2 Raw logcat re-categorisation — CONFIRMED, and it corrects a real prior error

Independently parsed `scratch/rpe-isolated-qa/2026-09-04T01-42-42Z/emulator_full_logcat_dump.log`
(6,125,774 bytes; SHA-256 `13eb255e483f1b3ce2224e5362885053f68eb927a5fda4902101983a9117ac35`) with an
anchored `MM-DD HH:MM:SS.mmm P/TAG( PID):` pattern. Every figure reproduces exactly:

- Records on PIDs 3764/6208: **493** — V 14, D 273, I 44, W 157, **E 5**, F 0.
- The five error records, at lines **3355, 14955, 19734, 33428, 36941**, are verbatim as quoted.
- Split: **3 `E/FrameTracker` IME-insets CUJ-timeout lines on PID 3764**, and **2 `E/ods.training.qa`
  "Not starting debugger…" JDWP lines, one on PID 3764 and one on PID 6208**.
- `FATAL EXCEPTION` / `AndroidRuntime` / `ANR in` attributed to either target PID: **0**. Zero matches also
  mention the `pikemethods` package anywhere in the file.

Gemini's categorisation is right, its refusal to manufacture a crash finding from ordinary platform
diagnostics is right, and it correctly refutes the earlier "five FrameTracker lines on PID 3764" claim.

Minor: the handback's "38,239 lines" is the newline count; `HANDBACK_ISOLATED_QA.md` says 38,240. The file
ends with a newline, so both are defensible readings of the same bytes. Not a defect; noted so the two
documents' differing numbers are not later mistaken for a discrepancy.

### 5.3 F2 — MATERIAL: the residual W1 was dispatched to fix is still uncorrected

`HANDBACK_ISOLATED_QA.md:222` still reads:

> "the full logcat carries **5** error-level lines attributed to PID `3764`, all of the form
> `E/FrameTracker( 3764): force finish cuj, time out:`…"

Both halves are false against the raw bytes, as §5.2 establishes: the five lines are split 4/1 across PIDs
3764 and 6208, and only three are FrameTracker. The file's mtime (`03:32:23Z`) confirms it was never opened
during W1.

The work order names this residual twice and treats fixing it as W1 work — §1: "the corrected log summary
still misidentifies the five error-level lines. **W1 addresses these bounded residuals**"; §4.1: "Record
exact diagnostic categories and distinguish error priority from a crash/ANR."

Gemini did the analysis correctly and recorded it in `W1_EXECUTOR.md` §4.2. But the erroneous sentence is
still the one a reader of the evidence pack encounters, and it is not flagged as superseded. A correct
finding in the executor's own handback does not retire a false statement left standing in the evidence
document that handback certifies. The fix is additive — append a correction; §4.1 also forbids rewriting
closed ledger history, so the appended-correction form is the required one.

### 5.4 AVD inventory — destruction claim falsified, remainder not verifiable

Directly observed: `rpe_isolated_qa_avd.avd` **exists** under `C:\Users\fpike\.android\avd\`. The "AVD
destroyed" narrative is therefore false, which is the material point and matches the work order's §1 warning.

Not verifiable by me: the `.ini` file and the directory's contents. That path is outside this session's
connected folder, so only directory names are visible. "Shut down, not deleted" is a claim about process
history that no retained artifact can settle. Recorded as corroborated-in-part, not confirmed.

---

## 6. Required to clear this verdict

Documentation-only. **No product or test change is requested, and none should be made** — the product/test
tracked diff is verified and must stay byte-identical so the W2 build binds to the same inputs.

1. **Regenerate `FREEZE_INVENTORY_W1.json` digests with a tool.** Replace the `HANDBACK_ISOLATED_QA.md`
   entry with the recomputed value, and state in the packet what the recorded value was and how it arose.
   Do not silently overwrite it — the wrong value is itself the finding.
2. **Correct `HANDBACK_ISOLATED_QA.md:222`** to the verified categorisation (4 lines PID 3764 / 1 line PID
   6208; 3 FrameTracker, 2 JDWP), appended as a correction rather than a rewrite. If the residual is instead
   to be left standing, say so explicitly and route it to the owner — do not leave it unmarked.
3. **Re-freeze and hand back.** This is the single targeted remediation pass §10 allows. Include the packet's
   own self-digests, which the current inventory omits (F3 below).

On receipt I will re-verify items 1–3 and the unchanged product fingerprint only. I will not re-run the
product tests, and this should not consume a further review cycle.

---

## 7. Findings and observations

| ID | Severity | Finding |
| :--- | :--- | :--- |
| **F1** | MATERIAL | `FREEZE_INVENTORY_W1.json` records `c88f34fe…` for `HANDBACK_ISOLATED_QA.md`; actual `182f06ae…`. Not a line-ending, staleness or copy artifact; the string exists nowhere else in the repo and the file predates the inventory by 31 minutes. Breaches §3.11 and defeats §3.4. |
| **F2** | MATERIAL | `HANDBACK_ISOLATED_QA.md:222` still misattributes all five error-level lines to `E/FrameTracker` on PID 3764. False on both count and category. Named in §1/§4.1 as W1 work; file untouched during W1. |
| **F3** | MINOR | The freeze inventory omits its own digest and the handback's. Recorded here: `W1_EXECUTOR.md` = `703c37d7c10e6d96fbbd24d4f88f0a9997164eff3cdc2465fb2e4d8359f869fa`; `FREEZE_INVENTORY_W1.json` = `a826858ab65004f9dcc012c3edbe029c83e83b4863ea62b16d0ce01c0c3adb61`. |
| **O1** | OBSERVATION — out of W1 scope | `InfoTip term={st === 'WAVE' ? 'Undulating' : st}` (`RoutineTemplateBuilder.tsx:777`) gives the info buttons accessible names "What does **LINEAR** mean?" and "What does **APRE** mean?" beside chips reading "Linear" and "Autoregulated". All three glossary terms exist (`glossary.ts:162/170/186`), so nothing is broken — but two of three announce a raw enum identifier. Changing it touches glossary definitions, which §8 excludes from W1. Route to W2's "matching tooltip content" check or to the owner. |
| **O2** | OBSERVATION — coverage gap, deferred by design | The tooltip test asserts only that a "Dismiss explanation" control appears and disappears; it never asserts the explanation *content* corresponds to the method pressed. A mis-wired `term` would pass. W2 acceptance covers this, so it is deferred rather than missed — but the current test should not be described as verifying "matching explanations". |
| **O3** | OBSERVATION — pre-existing, no W1 impact | `apps/mobile/jest.config.js` transform key `'^.+\\\\.(js|ts|tsx)$'` compiles to the regex `^.+\\.(js|ts|tsx)$`, requiring a literal backslash before the extension. It matches no path on POSIX or Windows; the react-native preset's own `^.+\.(js|ts|tsx)$` is what actually transforms these files, so the bespoke `babelrc:false, configFile:false` options are inert. Predates W1 and does not affect this verdict. Worth a separate dispatch. |

---

## 8. Coverage boundary — what this audit did NOT establish

Stated so partial coverage is never read as full coverage.

- **`npm run verify:ci` (21 gates) and `verify:components` (20 suites / 282 tests) were NOT independently
  re-run.** Full-suite execution over the device file bridge exceeds this session's per-command budget.
  Reproduced instead: the focused component suite (17/17, exit 0), `typecheck` (exit 0) and `git diff --check`
  (exit 0). Consistency note only, not verification: Gemini reports 282/282 where Entry 0070 recorded 280/280
  for the same gate; +2 is exactly the two tests W1 added, which is coherent.
- **Probe pass-counts not matched exactly.** Gemini reported "1 failed, 16 passed, 17 total" per probe. I ran
  the probes name-filtered (1 failed, 1 passed, 15 skipped). Same failing test, same failure text; the
  16-passed figure is unreproduced.
- **No layout evidence exists.** No emulator, no APK build, no screenshots, no dp/density/touch-target
  measurement, no font-scale check. The fix remains **unit-proven, not observed**. This verdict must not be
  cited as evidence that the three labels render legibly or tappably.
- **No device or artifact work of any kind.** The physical Pixel was not touched. The QA APK
  `b42c1be1…` still predates the layout fix and cannot demonstrate it.
- **Statuses that remain open and unchanged by W1:** `ORIGINAL PIXEL SAVED VALUES: NOT RE-VERIFIED`;
  `SAVED-RPE HISTORY UI: NOT AVAILABLE`; `C6: NOT EVALUATED`. None is a licence to add unrequested feature work.
- **Aggregate branch review not performed.** This audit covers the W1 candidate only, not the 131-commit
  integration delta. That is W3.
- **No merge, publication or release judgement.** Nothing here authorises commit, stage, push, PR, merge, tag
  or release, and a technical approval would not have authorised them either.

---

## 9. Handback token

```text
W1 REQUEST CHANGES — HARDENING AND EVIDENCE VERIFIED; FREEZE DIGEST F1 AND LOG RESIDUAL F2 MUST BE CORRECTED
W2 NOT AUTHORIZED TO START
LAYOUT REMAINS UNOBSERVED — UNIT-PROVEN ONLY
```

Next step: Gemini performs the single remediation pass in §6 (documentation only, product bytes frozen) and
re-freezes. Owner retains all commit, publication, device and release authority.
