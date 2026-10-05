# W1 Opus Audit — Round 2: Remediation Re-Verification

## 0. Verdict

```text
W1 APPROVE
```

Bound to re-freeze: HEAD `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`, branch `codex/rpe-familiarisation`,
tracked-diff fingerprint `41f19f2aa87b062cefd570a0bc7f1e45e949ec4a068ece6444e65d1e6416c440`
(67,529 bytes), both independently recomputed here.

**F1 and F2 are closed.** Both were remediated in the correct form: the freeze inventory is now
tool-computed and matches disk on every row, and the logcat correction was appended additively rather
than by rewriting the existing record. Product code and tests are byte-identical to the candidate
approved in round 1. The one remediation pass permitted by §3.10 has been used and was sufficient.

**W2 is authorized to begin** (QA candidate build and visual verification on an isolated emulator).
This approval carries the same boundary as round 1: it certifies the hardening and the evidence record,
**not** that the selector layout has been observed. See §7.

- **Auditor:** Opus, 2026-09-04T06:18:16Z. Round 1: `W1_OPUS_AUDIT.md` (`cc75da5bd6e93736d29e1140678a876e00326dc5e9881fc0cc66f223d512f616`, unchanged on disk).
- **Audited handback:** `W1_EXECUTOR.md`, SHA-256 `7948ee92fbdf59225d797c8edd99a097de3a5b8b10573d09b180432ffaa7adaf` (6,319 bytes).
- **Audited inventory:** `FREEZE_INVENTORY_W1.json`, SHA-256 `7b49374146c2573c9d6ed539066fbc95ca7310f84c52a718b41768780018dede`.
- **Writes by this pass:** this file only. No product, test, ledger, evidence or inventory file touched. No commit, stage, push, merge, tag or release. No emulator, APK or physical Pixel action.
- **Disclosure carried forward (§9):** an earlier Opus session authored the inherited flex fix, testID and original regression test. This audit authored no product code. Round 1 §1 states the full mitigation; it is unchanged and still applies.

---

## 1. Re-freeze identity — CONFIRMED

| Item | Claimed | Recomputed | Result |
| :--- | :--- | :--- | :--- |
| HEAD | `0d24ebd7…5ec72` | identical | MATCH |
| Branch | `codex/rpe-familiarisation` | identical | MATCH |
| Tracked-diff fingerprint | `41f19f2a…c440` | identical | MATCH |
| Diff byte count | 67,529 | 67,529 | MATCH |
| `git diff --check` | exit 0 | exit 0 | MATCH |

The fingerprint moved from round 1's `f8b0f4fb…8bc0b` (64,223 B) to `41f19f2a…c440` (67,529 B). That
delta is **fully accounted for** and benign: `git diff --numstat` shows the only changed tracked file
relative to round 1 is `PROMPT_LEDGER.md` (+311 lines, **0 deletions**). The product and test diffs are
unchanged (`RoutineTemplateBuilder.tsx` 10+/1−; `RoutineTemplateBuilder.test.js` 69+/0−), as is
`HANDBACK_LIVE_SESSION_EVIDENCE.md` (25+/22−).

**Change surface since round 1** — exactly four files, all documentation:
`PROMPT_LEDGER.md`, `HANDBACK_ISOLATED_QA.md`, `FREEZE_INVENTORY_W1.json`, `W1_EXECUTOR.md`.
No product file, no test file, no raw evidence file was modified.

---

## 2. Product and test byte-identity — CONFIRMED

| Path | Size | SHA-256 | Round 1 |
| :--- | ---: | :--- | :--- |
| `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | 68,588 | `4f6531bb…acb6` | identical |
| `apps/mobile/test/components/RoutineTemplateBuilder.test.js` | 29,219 | `104e0cbd…4343` | identical |

The remediation honoured the round-1 instruction to freeze product bytes.

**On not re-running the suite — stated explicitly rather than implied.** Round 1 executed the focused
suite (17/17, exit 0), `typecheck` (exit 0) and both fail-closed probes against these exact bytes. Jest
reads only source, test and config files; the four files changed since are Markdown and JSON outside that
graph. The round-1 results therefore carry over as a matter of fact, not assumption. I did re-run
`git diff --check` (exit 0), whose input did change. I did **not** re-execute jest or tsc in this pass,
and this verdict does not claim otherwise.

---

## 3. F1 — CLOSED

`FREEZE_INVENTORY_W1.json` was regenerated. **All 10 declared rows recomputed against disk: 10 match on
both SHA-256 and byte size, 0 mismatches, 0 missing** — 4 tracked-modified, 6 untracked audit files.

The row that failed in round 1 now resolves:

| Path | Round-1 inventory | Now declared | On disk | Result |
| :--- | :--- | :--- | :--- | :--- |
| `…/antigravity/HANDBACK_ISOLATED_QA.md` | `c88f34fe…7df0` (matched nothing) | `96d9ff8c…9410`, 25,963 B | identical | MATCH |

The handback also does what round 1 asked and does not quietly overwrite the bad value: §1.1 records the
faulty digest, the pre-F2 disk digest (`182f06ae…`, 25,212 B) and the current one, so the transition is
legible.

**Root cause is executor-reported, not verified.** §1.1 attributes the bad value to an uncomputed
hardcoded template placeholder in `generate_w1_deliverables.py`. That script is **not present anywhere in
the worktree**, so I cannot inspect it. The account is consistent with the round-1 symptom — a digest with
no upstream source anywhere in the repository, which is what an unsubstituted placeholder produces — but
consistency is not verification. Recorded as R1 below. It does not affect the verdict, because the
remediated inventory is verified against disk directly and does not depend on the root-cause story.

---

## 4. F2 — CLOSED, and additivity proven

`HANDBACK_ISOLATED_QA.md:223–226` now carries the correction, attributed to the W1 continuation review.
Verified against the raw bytes, independently of any document:

| Raw log line | Tag / PID | Category |
| ---: | :--- | :--- |
| 3355 | `E/ods.training.qa` PID 3764 | JDWP — non-debuggable package |
| 14955 | `E/FrameTracker` PID 3764 | IME insets CUJ timeout |
| 19734 | `E/FrameTracker` PID 3764 | IME insets CUJ timeout |
| 33428 | `E/FrameTracker` PID 3764 | IME insets CUJ timeout |
| 36941 | `E/ods.training.qa` PID 6208 | JDWP — non-debuggable package |

**4 lines on PID 3764 / 1 on PID 6208; 3 FrameTracker, 2 JDWP.** Exactly as the correction states, and
matching my round-1 parse line-for-line. The raw log is unchanged (`13eb255e…ac35`), so §4.1's
requirement to preserve raw evidence bytes holds.

**Additivity is proven, not inferred.** Deleting lines 223–226 from the current file reproduces the
pre-remediation bytes exactly — `182f06ae7a4c53c9db9201793a04d1bb5fb73e4fe320990267c97318977daad2`,
25,212 bytes, the digest I recorded in round 1. The remediation inserted four lines and altered nothing
else. The original erroneous Sol/Opus note at line 222 survives verbatim and is explicitly named as
misattributed by the correction beneath it. This is the append-a-correction form §4.1 requires, not a
rewrite of the record.

**Ledger discipline holds.** `PROMPT_LEDGER.md` gained Entry 0077 — the next unused entry — with
**0 deletion lines in its diff**. Closed history was not rewritten.

---

## 5. F3 — CLOSED (with one wording correction)

The inventory now carries `W1_EXECUTOR.md` and `W1_OPUS_AUDIT.md`; both verify against disk, and my
round-1 audit is byte-unchanged at `cc75da5b…f616`, so the auditor's record was not altered.

Handback §1.3 says the inventory includes self-digests of the packet files "and its own metadata".
It does **not** contain a digest of `FREEZE_INVENTORY_W1.json` — which is unavoidable, since a file
cannot contain its own hash. Not a defect; the wording just overstates. For the chain of custody I record
it externally here: `FREEZE_INVENTORY_W1.json` = `7b49374146c2573c9d6ed539066fbc95ca7310f84c52a718b41768780018dede`.

---

## 6. Residual items — all minor, none blocking

| ID | Item |
| :--- | :--- |
| **R1** | `generate_w1_deliverables.py` is not retained in the worktree, so the F1 root-cause account is executor-reported and uninspectable. The remediated inventory is verified directly against disk and does not rest on it. If that generator still produces packet artifacts, retaining it under the packet would make future freezes auditable at the source. |
| **R2** | The pre-remediation handback was overwritten in place, so `703c37d7c10e6d96fbbd24d4f88f0a9997164eff3cdc2465fb2e4d8359f869fa` is no longer resolvable on disk. The audit trail survives only because `W1_OPUS_AUDIT.md` records that digest and the claims it certified. For W2, retain the superseded revision (e.g. `W1_EXECUTOR_R1.md`) rather than overwriting. |
| **R3** | Handback §1.3 wording, per §5 above. Recorded, not requiring action. |
| **O1–O3** | Round-1 observations stand, correctly dispositioned by the handback §1.4: O1 (InfoTip announces raw enum terms) and O2 (tooltip content not asserted) route to W2 acceptance; O3 (inert jest transform key) to a separate dispatch. None is W1 scope. |

---

## 7. What this approval does and does not authorize

**Authorizes:** W2 to begin — building the QA candidate and visually verifying the selector on an
isolated synthetic emulator, under the constraints of work order §5.

**Does not authorize, and does not assert:**

- **The layout has still never been observed.** The fix remains unit-proven only. No screenshot, no dp or
  density measurement, no touch-target check, no font-scale check exists. This verdict must not be cited
  as evidence the three labels render legibly or tappably.
- No commit, stage, push, PR, merge, tag, signing or release. Owner authority, untouched.
- No physical Pixel interaction. The existing APK `b42c1be1…` predates the layout fix and cannot
  demonstrate it; W2 must build a new artifact and represent the dirty candidate honestly to
  `verify:qa-candidate`.
- Statuses unchanged by W1: `ORIGINAL PIXEL SAVED VALUES: NOT RE-VERIFIED`;
  `SAVED-RPE HISTORY UI: NOT AVAILABLE`; `C6: NOT EVALUATED`. None licenses unrequested feature work.
- No aggregate branch review. That is W3; this covers the W1 candidate only.
- `verify:ci` / `verify:components` remain not independently re-run by me, in either round.

**At W2 acceptance I will require** the built APK's own hash matched to its embedded build provenance and
to this frozen source; actual screenshots inspected directly rather than XML strings or test names;
recomputed control bounds in dp with stated density, width and font scale; all three labels legible and
tappable without overlapping the adjacent info buttons; both tooltip dismissal routes; and no report
attributing emulator results to the Pixel.

---

## 8. Handback token

```text
W1 APPROVE — F1 AND F2 CLOSED; PRODUCT BYTES FROZEN AND UNCHANGED
W2 AUTHORIZED TO BEGIN — BUILD AND OBSERVE
LAYOUT REMAINS UNOBSERVED — UNIT-PROVEN ONLY
COMMIT / PUSH / MERGE / RELEASE / PHYSICAL DEVICE: NOT AUTHORIZED
```
