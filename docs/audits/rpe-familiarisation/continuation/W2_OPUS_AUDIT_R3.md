# W2 Opus Audit — Round 3: Path A Evidence Delta and Final-Artifact Attribution

## 0. Verdict

```text
W2 APPROVE — CR-W2-01 CLOSED
```

Scoped to W2 only. This closes the final-artifact attribution gap held open by `W2_OPUS_AUDIT_R2.md`. It creates
no authority to stage, commit, push, open a PR, merge, sign, release, rebuild, or touch the physical Pixel, and
it says nothing about aggregate branch health, C6, or release readiness.

**Verdict binding.** This verdict attaches to exactly these artifacts:

| Artifact | SHA-256 |
| :--- | :--- |
| Candidate APK `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` (194,450,340 B) | `3777054f246a01e30bfc28a33181791e09de93be928f515959ebc2440d4b858d` |
| `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | `98e8aef8d18a056b6fb4a47db4ac3e559bc8bc97bdfcd51ebc0dff31f4dacbc1` |
| `apps/mobile/test/components/RoutineTemplateBuilder.test.js` | `104e0cbd77741a16e3367673b95771e07e38e4142685d3d9978e4c66c6904343` |
| `W2_EXECUTOR.md` (reviewed handback) | `6d91bf6cb1215834d9884c75952fb4cd57e7158f73dac55aaa8298e69567a9a6` |
| `FREEZE_INVENTORY_W2.json` (reviewed inventory) | `af3a46f47db568810f07e189e064bc9cd316c46024ae9dbb83ee9d47e39d1496` |
| `W2_OPUS_AUDIT_R2.md` (prior verdict, unmodified) | `1c430695851cce9f86e97a22d9f7ef139e5ea8866c971a205a1f5ad1ced333b7` |
| `scratch/continuation/evidence/15_font13_autoregulated.png` | `177f361e4b36a425d4e3c2bdfec2fc05878100daf5062ca79460057aeb0c5517` |

All seven were recomputed by me and match the dispatch table exactly.

---

## 1. Scope of this review

Delta only, per `WORKORDER_OPUS_W2_PATH_A_CLOSEOUT.md` §3.

- **Not re-audited:** W1, and F4/F5/F6, which stay closed. No contradictory evidence was found; §4 re-confirms them
  on the *recaptured* artifact only because the dumps were replaced, not because the findings were reopened.
- **Not done:** no rebuild, no emulator session, no install, no full CI for unchanged product inputs, no rerun of
  the Windows artifact gate, no physical device action, no F7/O1/O3 remediation.
- **Pre-write snapshot:** branch `codex/rpe-familiarisation`, HEAD `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`,
  tree dirty; `PROMPT_LEDGER.md` 368,851 B `652fc1f1a114c5c685aa174827df2dfbd0a271ece156d9b4170364c2247d297e`;
  live diff 94,967 B `d98c3a25aac56790e67c164a6671f900bf6c12929d52c2459d3e5653c1f591bf`.

---

## 2. What R2 asked for, and what closed it

R2 §7 offered Path A (recapture from the preserved final APK) or Path B (correct the record). Gemini executed
Path A in Entry 0081. That packet is genuine and is reviewed in §4.

But the item that actually closes CR-W2-01 is not the recapture. It is a check neither prior pass performed:
**the APK carries its own provenance manifest, and that manifest binds the artifact to source independently of
any capture, timestamp, or install claim.**

### 2.1 The embedded provenance manifest

I extracted `assets/candidate_manifest.json` from the frozen APK:

```json
{
  "schema": "ak.candidate-manifest/1",
  "label": "NON_PRODUCTION_QA_DEBUG_SIGNED",
  "packageId": "com.pikemethods.training.qa",
  "buildVariant": "qa",
  "branch": "codex/rpe-familiarisation",
  "head": "0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72",
  "sourceDirty": true,
  "trackedDiffFingerprint": {
    "method": "sha256(git diff --full-index --binary HEAD)",
    "value": "0de694091f75b89541c3c8b1c290a8e0919bd0bddbaeafd732fe00b289717203"
  }
}
```

plus 10 `newFiles` records. The embedded `head` equals the current HEAD, and the embedded fingerprint equals the
73,357-byte build diff recorded for this artifact.

### 2.2 Why that closes the gap

`tools/verify_qa_artifact.mjs:496-559` recomputes the tracked-diff fingerprint **from the live worktree** and
fails closed:

> *"the only way to know the artifact belongs to this source tree… HEAD mismatch… worktree recomputes … — this
> artifact is STALE"*

Codex's `verify:qa-candidate` run passed on this exact APK at a snapshot where the live selector source was
`98e8aef8…` — the fixed version. A `git diff --full-index --binary HEAD` necessarily contains the full content
diff of `RoutineTemplateBuilder.tsx`, because it is a modified tracked file. So a worktree carrying the fixed
selector reproduced the fingerprint the APK embeds.

The frozen APK is therefore bound to a source tree containing the verified selector fix. This holds regardless
of which build was installed on the emulator, regardless of file modification times, and regardless of whether
an installer transcript survives. It is the strongest link available and it is the basis for this approval.

### 2.3 Withdrawal of my own R2 reasoning

R2 §4.2 item 3 argued that an unchanged modification time on `RoutineTemplateBuilder.tsx` proved identical
source across both builds, on the grounds that an edit-and-revert would have advanced the timestamp. The
dispatch is right that this is too strong: timestamps can be preserved by copy or restore tooling, and an mtime
is supporting chronology, not proof of content history. **I withdraw that inference as a basis for approval.**
It does not affect the verified layout, and it is superseded by §2.2, which does not rely on timestamps at all.

---

## 3. Record clarifications

Stated here and in ledger Entry 0083. **No closed entry was edited.**

- **Build state versus capture state.** Entry 0081's "Pre-capture boundary" presents the 73,357-byte
  `0de69409…` fingerprint as though it were the worktree state at capture time. It is the **APK build-time**
  fingerprint. By 11:52Z the tracked diff had grown with intervening documentation. The current handback
  separates build and post-recapture fingerprints correctly. Entry 0081 stands unmodified as history.
- **Inventory counting.** Independently recounted: **47 records / 45 distinct paths**, with
  `scratch/continuation/baseline_apk/app-qa.apk` and `scratch/continuation/w2_round1_apk/app-qa.apk` each
  appearing twice across the array and named-APK groups. The handback's 45/45 is consistent under
  distinct-path counting; the denominator simply needs labelling. This is not a hash failure.
- **The one inventory drift is documentation, not defect.** 46 of 47 records verify against the live tree. The
  exception is `PROMPT_LEDGER.md`: inventory `11ba3564…`, current `652fc1f1…`. That is entirely Codex's later
  Entry 0082 append. Per the dispatch, hash drift caused solely by this review's own documentation is not an
  APK defect, and I record it as such.
- **A replaced evidence path.** The pre-Path-A `ui_font13_builder.xml` (`b67f21591c2d…`, 29,427 B) was
  overwritten in place by the recapture and is preserved nowhere in `scratch/`. The hash I cited in R2 §3.3
  **no longer resolves to the current contents.** Disclosed rather than silently re-pointed.

---

## 4. The Path A evidence delta

### 4.1 The captures are genuinely new

All 18 screenshots carry fresh SHA-256 values and modification times of **11:53:32Z–11:55:31Z**, matching Entry
0081's claimed window without exception. I viewed `15_font13_autoregulated.png` directly: `LINEAR`,
`UNDULATING` and `AUTOREGULATED` all render complete and single-line, stacked full width, each InfoTip clear to
the right. Its status-bar clock reads **21:55** against **08:37** in the image I reviewed for R2 — an
independent signal that this is a different session, not a relabelled file.

### 4.2 Bounds re-derived from the new dumps

R2 §7 required re-derivation from the new captures rather than carrying the old figures. Done:

| Capture | Label | Text px | Button (dp) | Fits | Slack |
| :--- | :--- | ---: | :--- | :--- | ---: |
| `ui_builder.xml` | LINEAR | 119×37 | 347.43×56.00 | yes | 793 px |
| | UNDULATING | 215×37 | 347.43×56.00 | yes | 697 px |
| | AUTOREGULATED | 287×37 | 347.43×56.00 | yes | 625 px |
| `ui_narrow_builder.xml` | LINEAR | 138×42 | 296.00×56.00 | yes | 750 px |
| | UNDULATING | 246×42 | 296.00×56.00 | yes | 642 px |
| | AUTOREGULATED | 328×42 | 296.00×56.00 | yes | 560 px |
| `ui_font13_builder.xml` | LINEAR | 158×50 | 347.43×56.00 | yes | 754 px |
| | UNDULATING | 285×50 | 347.43×56.00 | yes | 627 px |
| | AUTOREGULATED | 377×50 | 347.43×56.00 | yes | 535 px |

Every label is a single-line node fitting its button in both axes. The font-1.30 dump again shows genuinely
scaled metrics — 50 px line height against 37 px at the same density — so F5's condition holds on the new
capture too. Chip height remains exactly `theme.touch.min = 56` dp. F4, F5 and F6 stay closed.

### 4.3 An unexpected corroboration

`ui_builder.xml` and `ui_narrow_builder.xml` are **byte-identical** across the pre-Path-A and post-Path-A
sessions (`b9b9051bd953…` / 35,002 B and `97e1df66d6b8…` / 27,679 B respectively), while
`ui_font13_builder.xml` changed by 6 bytes. Two independent emulator sessions producing byte-identical
hierarchy dumps is what a deterministic layout on equivalent builds should produce, and it corroborates that
the two builds render the same tree.

I note the converse honestly: byte-identity alone cannot distinguish a fresh identical capture from a
carried-over file. What establishes that a real session occurred is the 18 new screenshot hashes and the
changed font-1.30 dump — and neither of those, in turn, identifies which APK was installed. That is §5.

---

## 5. Executor-attested limits

Recorded plainly, because the approval does not depend on them.

- **The installation of `3777054f…` specifically is executor-attested, not corroborated by retained evidence.**
  No `adb install` transcript was retained anywhere under `scratch/continuation/`. More decisively,
  `emulator_full_logcat.log` begins at **21:52:58Z**, roughly 40 seconds *after* the claimed 11:52:18Z install,
  so it cannot contain the install session even in principle. Codex's inability to locate installer output is
  explained: the log window opens too late.
- **Runtime corroboration exists but does not bind bytes.** The app ran from a randomized install path
  (`/data/app/~~BY-olXVJp0MTUrp8Z3DlSw==/com.pikemethods.training.qa-BilU5cla9HZjmbkKko7Krw==/base.apk`),
  `ProfileInstaller: Installing profile for com.pikemethods.training.qa` fired at 21:55:22, and the launcher
  released prior `ApkAssets` for that package at 21:53:52 — all consistent with a fresh `install -r`. None of
  it is a content hash of the installed artifact.
- **Timezone reconciles.** Logcat local `21:5x` maps to `11:5x` UTC (UTC+10), consistent with the repository's
  own `+1000` commit offsets. The chronology in Entry 0081 is internally coherent.
- **Stability coverage is narrower than stated.** `app_filtered_logcat.log` starts at 21:55:16Z on PID 12300.
  At least three app processes ran during the session (11242 → 11999 → 12300, per `ActivityManager: Start proc`
  entries). Its "0 application exceptions" result therefore covers the **final** process, not the whole
  11:53:32–11:55:31Z capture window. `emulator_full_logcat.log` spans 21:52:58–21:55:50Z and is the broader
  record. No crash-buffer or ANR contradiction was found in either.

**Why approval still stands:** the install attestation would be load-bearing only if the captures were the sole
evidence tying the frozen APK to the fixed source. They are not. §2.2 provides that tie cryptographically and
independently. The captures corroborate; they no longer carry the finding alone.

---

## 6. Reproduced, inherited, and not done

**Reproduced by me, in this worktree:**

- All seven dispatch identity hashes — all match.
- Extraction and parsing of `assets/candidate_manifest.json` from the frozen APK (§2.1).
- Full `FREEZE_INVENTORY_W2.json` recount and re-verification: 47 records / 45 distinct paths, 46 verified,
  1 documented drift.
- Bounds re-derivation for all three new dumps (§4.2), and hashes plus modification times for all 18
  screenshots and all dumps.
- Logcat time-range, PID sequence, install-marker and timezone analysis (§5).
- Direct visual review of `15_font13_autoregulated.png`.
- Ledger integrity after my own append: 5,134 CRLF lines, 0 bare LF, 0 deletions, all closed entries intact.

**Inherited with attribution, not reproduced:**

- Codex's `npm.cmd run verify:qa-candidate` on this exact APK — exit 0, `QA ARTIFACT VERIFIED`, including the
  live-worktree provenance check this approval leans on, Windows SDK tooling, packaged model/font, Hermes
  bundle, debug-signature, zipalign and ELF64 checks.
- Codex's inventory re-verification at its pre-0082 snapshot.
- Gemini's `verify:ci` and 31/31 provenance checks.

**Deliberately not done:** the artifact gate was **not** rerun. The live diff has moved to `d98c3a25…` through
this review's own documentation, so a rerun would report a stale-fingerprint mismatch that is documentation
drift, not an APK regression. Fixture mode was not used and the verifier was not weakened.

---

## 7. Owner decisions carried forward, unchanged

- **F7 — documentation corrected; shared-control fix or waiver NOT authorized.** `InfoTip.tsx` remains 18 dp
  with `hitSlop={12}`, a nominal 42 dp effective target against the repository's `theme.touch.min = 56`.
- **O1 — owner disposition pending.** Tooltip titles still render raw `LINEAR` and `APRE`.
- **O3 — owner disposition / W3 review item.** The slot-role chip row still clips `ACC` at the 1080 px screen
  edge at font scale 1.30 with no horizontal scroll; still visible in the new capture. Not part of the
  selector-evidence repair and not fixed here.

None of these was expanded into by this review, and W3 does not silently authorize their implementation.

---

## 8. Next queue step — W3 integration-packet task for Gemini

Issued under original continuation work order §6. Ready to pass to the executor.

```text
W3 — Integration packet preparation (executor task)

Workspace: C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation
Branch: codex/rpe-familiarisation. Integrity mode: development.
Authorising audit: docs/audits/rpe-familiarisation/continuation/W2_OPUS_AUDIT_R3.md (W2 APPROVE — CR-W2-01 CLOSED).

Before any write, snapshot identity: branch, HEAD, dirty-diff fingerprint and byte count, and the pre-write
PROMPT_LEDGER size and SHA-256. Append the next unused ledger entry as your first tracked write, preserving
CRLF and every closed entry. Do not edit Entries 0078-0083.

Produce docs/audits/rpe-familiarisation/continuation/W3_INTEGRATION_PACKET.md containing:

1. Fresh remote and default-branch identity: actual remote URL, actual default branch, and the real merge base
   between it and codex/rpe-familiarisation, each with the command used. Do NOT reuse the stale 131-commit or
   310-path figures; recount from the repository as it is now.
2. The actual aggregate delta: commit list and full changed-path inventory from that merge base to the current
   state, separating committed changes from the uncommitted working-tree delta. State the counts you measured.
3. Work-order mapping: which work order or ledger entry authorised each changed path. Flag any path you cannot
   map, rather than omitting it.
4. Carried findings, stated as open: F7 (InfoTip ~42 dp vs the 56 dp contract), O1 (raw LINEAR/APRE tooltip
   titles), O3 (slot-role ACC clipping at font scale 1.30). Record each as owner-disposition pending. Do NOT
   implement any of them under W3.
5. Verification matrix: for every integration gate, the exact command, exit code, and headline counts. Include
   at minimum typecheck, verify:blocks, verify:components and verify:ci. Label every result you ran yourself
   versus inherited, and do not weaken or skip a gate.
6. A draft PR description: scope, risk, migrations/data-preservation status, and explicit exclusions. Draft
   only — do not create it.

Scope limits: no product code change, no migration, no schema change, no dependency or lockfile edit, no
native or CI-gate change, no APK rebuild, no emulator session, no physical Pixel action. Do not restart
completed programming-quality, intake or biometric research work.

Stop when the packet is written and the ledger Output section is closed. Freeze it and hand back for Opus's
aggregate audit. Do not stage, commit, push, create a PR, merge, sign or release.
```

On return, I audit the actual aggregate code delta — migrations and data preservation, training and
progression behaviour, actual-versus-target separation, and native/build/CI risk — and record reviewed versus
unreviewed paths, checkpointing coverage rather than restarting if context runs short. Partial coverage will
not be labelled APPROVE.

---

## 9. Coverage boundary

This audit did **not** establish: aggregate branch health or integration readiness (that is W3); memory or C6
qualification, which remains **NOT EVALUATED**; anything about the physical Pixel; release, signing or store
readiness; or that any gate other than those listed in §6 currently passes. W2 approval is internal review
completion for the selector work and its evidence — nothing further.

---

## 10. Handback token

```text
W2 APPROVE — CR-W2-01 CLOSED
```

W3 may proceed on the §8 task. No staging, commit, push, PR, merge, signing or release is authorized by this
document, and none was performed.
