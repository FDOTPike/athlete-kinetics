# W2 Opus Audit — Round 2: Selector Layout Remediation and Final-Artifact Lineage

## 0. Verdict

```text
W2 REQUEST CHANGES — LAYOUT REMEDIATION VERIFIED; FINAL-ARTIFACT CAPTURE LINEAGE UNRESOLVED
```

The layout remediation is real, correctly scoped, and independently verified. **F4, F5 and F6 are resolved.**
The verdict is `REQUEST CHANGES` for one reason only: **CR-W2-01**. The APK that Entry 0078 records as built
and installed is not retained, and the handback presents the install as being of a different, later artifact
without disclosing the second build boundary. That is a silent relabel of the install, and it is the same
defect class as the F5 this very audit round was opened to fix — a measurement attributed to a state it was
not taken under.

No product change is required. The remediation is a bounded evidence correction or a recapture; §7 gives the
executor handoff.

---

## 1. Required disclosure

- **Auditor:** Claude Opus 5 (`claude-opus-5`), High effort, fresh context. Not the executor.
- **Date:** 2026-09-04.
- **Authority:** this audit may return a scoped W2 verdict. It grants no authority to stage, commit product,
  push, open a PR, merge, sign, release, build an APK, touch the physical Pixel, or run an emulator.
- **What I ran versus relied on** is separated explicitly in §5. I reproduced the focused component gate and
  every hash and geometry figure I cite. I did **not** rebuild, install, launch an emulator, or re-run the
  Windows SDK artifact gate.

---

## 2. Artifact and source identity

Captured **before** my ledger write.

| Field | Value |
| :--- | :--- |
| Branch | `codex/rpe-familiarisation` |
| HEAD | `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72` |
| Working tree | **dirty** — 4 modified tracked, 5 untracked |
| `PROMPT_LEDGER.md` pre-write | 350,808 B · SHA-256 `6060a516c0a876fd2dc76fd8f2d27332346579de417d84629325aa429aa4263b` |
| Dirty-diff pre-write | 76,924 B · SHA-256 `39be999eb20501ba0a91c8d635dd1e76a8502f87c4528b40d563a25d41d66d93` |
| Selector source | `98e8aef8d18a056b6fb4a47db4ac3e559bc8bc97bdfcd51ebc0dff31f4dacbc1` |
| Focused test | `104e0cbd77741a16e3367673b95771e07e38e4142685d3d9978e4c66c6904343` |

Both source hashes were recomputed by me and match the Codex review table exactly.

**The W2 product change is uncommitted working-tree state.** There is no freeze commit for it. This is not a
defect in itself — the continuation work order operates this way — but it is the structural reason CR-W2-01
cannot be settled by commit identity, and it is why file-write times carry as much weight as they do below.

### 2.1 APKs actually present on disk

Every APK in the worktree, hashed by me:

| SHA-256 | Bytes | Modified (UTC) | Path |
| :--- | ---: | :--- | :--- |
| `3777054f246a01e30bfc28a33181791e09de93be928f515959ebc2440d4b858d` | 194,450,340 | 10:52:57 | `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` |
| `7d7f8846891e8be15771ed63f08cf519d4fcd9f66cd2272dc88fe72f97136aeb` | 194,450,148 | 06:37:47 | `scratch/continuation/w2_round1_apk/app-qa.apk` |
| `b42c1be10167dc516f675de2331189d1e4025a8ecdf0ec5d300d92624d410c67` | 194,449,552 | 2026-09-03 22:21:35 | `scratch/continuation/baseline_apk/app-qa.apk` |

`adcc6cdb19778e18ac52eeeb0bc713e600b9aaff0584f6a2749d41eda595503f` (194,450,436 B) — the APK Entry 0078
records as built **and installed** — **does not exist on disk**. This is an exhaustive result, not a spot check.

---

## 3. The layout remediation — verified

### 3.1 The change is in scope

`git diff HEAD -- apps/mobile/src/components/RoutineTemplateBuilder.tsx` is four hunks:

- `schemaRow.flexDirection`: `'row'` → `'column'` (`:1335-1338`)
- `schemaChip`: adds `paddingHorizontal: theme.space[3]`, `paddingVertical: theme.space[2]` (`:1347-1351`)
- `schemaChipContainer`: adds `flex: 1` and `gap: theme.space[2]` (`:1602-1612`)
- a `testID={`loading-method-option-${st}`}` on the option container (`:743-750`)

No label text, no behaviour, no glossary, no schema, no algorithm, no dependency, no native or CI change.
`InfoTip.tsx` and `theme/theme.ts` are confirmed **unmodified** by `git status`. This is exactly the
"adjust only this selector's layout (wrapping or stacking)" latitude §5.1 authorized, and nothing more.

### 3.2 F4 — RESOLVED

I re-derived the geometry myself from each UI dump, locating each label's text node and walking outward to
its enclosing `clickable="true"` ancestor:

| Capture | Density | Label | Text px | Button px (dp) | Fits |
| :--- | ---: | :--- | ---: | :--- | :--- |
| `ui_builder.xml` | 2.625 | LINEAR | 119×37 | 912×147 (347.43×56.00) | yes, 793 px slack |
| | | UNDULATING | 215×37 | 912×147 | yes, 697 px |
| | | AUTOREGULATED | 287×37 | 912×147 | yes, 625 px |
| `ui_narrow_builder.xml` | 3.0 | LINEAR | 138×42 | 888×168 (296.00×56.00) | yes, 750 px |
| | | UNDULATING | 246×42 | 888×168 | yes, 642 px |
| | | AUTOREGULATED | 328×42 | 888×168 | yes, 560 px |
| `ui_font13_builder.xml` | 2.625 | LINEAR | 158×50 | 912×147 (347.43×56.00) | yes, 754 px |
| | | UNDULATING | 285×50 | 912×147 | yes, 627 px |
| | | AUTOREGULATED | 377×50 | 912×147 | yes, 535 px |

Every label is a **single-line** node fitting its button in both axes with 535–793 px of horizontal slack.
Clipping is not geometrically possible in any of the three configurations. My dp figures reproduce the Codex
review's independently.

I also viewed `15_font13_autoregulated.png` directly. `LINEAR`, `UNDULATING` and `AUTOREGULATED` all render
complete, stacked full-width, each with its InfoTip clear to the right and no overlap. This is the exact
configuration that previously rendered `LINE`, `UNDULAT` and a mid-glyph-sliced `AUTOREGU`/`LATED`.

Chip height is `56.00 dp` in all three captures — exactly `theme.touch.min`.

### 3.3 F5 — RESOLVED

The three dumps are genuinely distinct artifacts:

| File | Bytes | SHA-256 |
| :--- | ---: | :--- |
| `ui_builder.xml` | 35,002 | `b9b9051bd9537de239143e2dfea302679647bafaf233f438350582f314655d77` |
| `ui_narrow_builder.xml` | 27,679 | `97e1df66d6b86c3452db555842b805482010c17a2de5690035abc820ba843c12` |
| `ui_font13_builder.xml` | 29,427 | `b67f21591c2d1f4122058ce2f9acb3933a67796fc4afe51d07b581f493f0c592` |

Distinctness alone would not have satisfied me — the original F5 failure was a dump that did not reflect the
state it was labelled with. The decisive evidence is internal: text line height in the font-1.30 capture is
**50 px against 37 px** at the same 2.625 density in `ui_builder.xml`, and every label node is proportionally
wider. The framework text metrics genuinely scaled. The capture was taken under the condition it is
attributed to.

### 3.4 F6 — RESOLVED

`AUTOREGULATED` at standard width is now a single `287×37 px` node. The previously reported `249×74 px`
two-line mid-word break is gone. The baseline description and the artifact now agree.

### 3.5 F7 — DOCUMENTATION CORRECTED; SHARED CONTROL FIX/WAIVER NOT AUTHORIZED

`W2_EXECUTOR.md:15,164` now cites `theme.touch.min = 56` (Law 3) as the contract and records the InfoTip's
`41.9–42.0 dp` effective area against it for owner disposition. That is the correction that was asked for.

It is **not** a fix. `InfoTip.tsx` is unmodified: `width: 18` / `height: 18` (`:103-104`) with `hitSlop={12}`
(`:76`), a nominal 42 dp effective area, 14 dp short of the repository's own 56 dp law, and actual hit regions
may be further constrained by parents. `theme.ts:42` still reads `touch: { min: 56, log: 72, destructiveGap: 16 }`.
Record this as **documentation corrected; shared-control fix or waiver not authorized**, and do not read the
handback's opening summary as evidence of a product fix.

### 3.6 O1 — OWNER DISPOSITION PENDING

Tooltip titles still render the raw identifiers `LINEAR` and `APRE` beside a title-cased `Undulating`.
Unchanged and correctly left alone — the fix touches glossary content, excluded by §8. This is not a completed
owner waiver; it is still awaiting one.

### 3.7 Focused tests — genuine, with a stated limit

The test delta adds two tests and removes nothing (`+74/-0` in the reviewed hunks; zero `.skip`, `.only`,
`xit`, `todo` in the file).

Credited as genuine:

- `screen.getByTestId(...)` and `getByLabelText(...)`, not `queryBy…` with a `continue` — the control's absence
  **fails the test**. This is the W1 silent-skip defect staying fixed.
- The expected method list is asserted against the canonical `SELECTABLE_SCHEMA_TYPES` from `@ak/inference`,
  so a schema-contract change breaks the test rather than silently narrowing it.
- Selection state is exercised with real `fireEvent.press` and asserts mutual exclusivity across all three
  options; InfoTip open/dismiss is exercised per method.

Stated limit, which matters for how much these tests are allowed to carry: they assert **style props**
(`flex: 1`, `flexDirection: 'row'`), not rendered geometry. The renderer does not lay out or measure text.
These tests guard the flex regression that collapsed the chips to ~5 px; they **cannot** demonstrate
font-scale readability. All F4/F5/F6 readability evidence rests on the emulator captures — which is precisely
why the provenance of those captures, below, is load-bearing.

---

## 4. CR-W2-01 — the blocking finding

**Type:** evidence/provenance. Not an established product defect.

### 4.1 What the records say

- `PROMPT_LEDGER.md` Entry 0078 (`:4906`, `:4910`) — built APK `adcc6cdb…`, 194,450,436 B; and
  *"Installed hash-verified APK `adcc6cdb19…` (`Success`)"* on `emulator-5554`.
- `W2_EXECUTOR.md:29,176` — built QA APK `3777054f…`, 194,450,340 B.
- `W2_EXECUTOR.md:48` — *"Installed hash-verified QA APK: `adb -s emulator-5554 install -r
  apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` (Exit 0, `Success`)"* — the path that today holds
  `3777054f…`, with no mention that the artifact actually installed was `adcc6cdb…`.

The handback therefore asserts an install of the final artifact while the ledger records a different artifact
as the one installed. The owner's dispatch named this risk exactly: *do not silently relabel old screenshots*.

### 4.2 What I established

1. **`adcc6cdb…` is not retained.** I hashed every APK in the worktree; none matches. The build that produced
   the layout evidence no longer exists, so the captures cannot be hash-bound to any surviving artifact.
2. **The captures predate the frozen artifact.** Screenshots `01`/`12`/`15` were written 10:36:05, 10:37:05 and
   10:37:48 UTC; `ui_font13_builder.xml` at 10:37:43. The frozen APK was written 10:52:57 and embeds build time
   `2026-09-04T10:52:48.487332900Z`. **The frozen APK has no layout capture of any kind.**
3. **The selector source is unchanged across the whole window.** `RoutineTemplateBuilder.tsx` was last written
   **10:27:40 UTC** — before the captures and before the final build — and its SHA-256 matches the freeze. Any
   modification, *including an edit-and-revert*, would have advanced that timestamp. Both builds therefore drew
   on identical selector source. This is the strongest mitigation available and I weight it accordingly.
4. **Bundle inspection cannot close the gap.** I extracted `assets/index.android.bundle` from all three
   retained APKs. The baseline lacks the `loading-method-option-` marker; the round-1 and final bundles both
   carry it, so it does not discriminate the layout fix — it predates it. Comparing printable string tables
   between the round-1 and final bundles yields **zero** semantic additions or removals (the 7 nominal
   differences are bytecode noise). That is expected for a style-value-only change and is consistent with the
   fix, but it is not proof that the frozen APK contains the column layout.

### 4.3 Assessment

The substantive risk — that the frozen APK does not contain the fix — is **low**: the only product input
governing this layout is provably unwritten since before both builds. But "low risk" is not the standard this
review round applied to F5, where a plausibly-true geometry claim was blocked because it was measured under
the wrong state. Applying that standard consistently, layout observations captured from a destroyed build may
not be presented as observations of the frozen artifact.

The correction is cheap and requires no product change. It does require that the record stop asserting an
install that did not happen as described.

---

## 5. Reproduction and attribution

**Reproduced by me, in this worktree:**

| Check | Result |
| :--- | :--- |
| `npm.cmd run verify:components -- apps/mobile/test/components/RoutineTemplateBuilder.test.js` | exit 0 — **17/17**, 1 suite |
| Selector and focused-test SHA-256 | match the freeze and the Codex table |
| All four on-disk APK SHA-256 and sizes | tabulated in §2.1 |
| UI-dump SHA-256, sizes, and full label/button geometry | §3.2, §3.3 |
| JS bundle extraction from three APKs + string-table diff | §4.2 item 4 |
| Direct view of `15_font13_autoregulated.png` | §3.2 |
| `InfoTip.tsx` / `theme.ts` unmodified | §3.5 |
| Ledger CRLF integrity after my append | 4,991 CRLF, 0 bare LF, 0 deletions |

**Relied on with attribution, not reproduced** (per §5.1 step 6):

- Codex's `npm.cmd run verify:qa-candidate` — exit 0, `QA ARTIFACT VERIFIED`, including Windows SDK tooling,
  packaged model/font, Hermes bundle, debug-signature, zipalign and 28 ELF64 checks.
- Codex's recomputation of all 42 `FREEZE_INVENTORY_W2.json` records with zero mismatches.
- Gemini's `verify:ci` and 31/31 provenance-check results, which remain executor-reported.

**Not performed and not claimed:** no rebuild, no emulator launch, no install, no interaction replay, no
physical Pixel action, no aggregate-branch review, no full CI run.

---

## 6. New observation — outside W2 scope

**O3 — role-chip row clips `ACC` at `font_scale 1.30`.** In `ui_font13_builder.xml` the slot-role chip row
(`Up / Down / MAJ / SUP / CON / ACC`) ends with `ACC`'s text node at x `1017–1080` — clamped exactly at the
1080 px screen edge — and its clickable ancestor at `994–1080`, 86 px wide against 110 px for the same control
at standard and narrow width. There is **no** `HorizontalScrollView` anywhere in the hierarchy, so the label is
clipped rather than scrollable. Visible in `15_font13_autoregulated.png` in both the Slot 1 and Slot 2 rows.
At standard width `ACC` is fully on screen (`842–905`), so this is font-scale-specific.

This is the same defect class as F4 in a **different control** that W2 was never scoped to touch. It is **not**
a W2 blocker and I am not authorizing a fix. It belongs with F7 and O1 as an owner-disposition item, and is a
natural candidate for W3's aggregate review.

---

## 7. Required to clear this verdict

Narrowly scoped executor handoff. **No product code change. No rebuild for documentation's sake. No physical
device.** Either path closes it; (A) is preferred because it produces evidence for the artifact that will
actually ship.

**Path A — recapture from the preserved final APK.** Using W2's already-authorized isolated emulator workflow,
install `apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk` (`3777054f…`, 194,450,340 B), recording the
installation hash explicitly, and recapture the three selector configurations — standard width, 360 dp, and
`font_scale 1.30` — as screenshots plus genuine UI dumps taken under each condition. Re-derive the label and
button bounds from the new dumps. Do not reuse or relabel the existing images.

**Path B — correct the record.** If a recapture is not warranted, amend `W2_EXECUTOR.md` to state plainly:
that the build installed and captured on `emulator-5554` was `adcc6cdb…` (194,450,436 B); that this artifact
was **not retained**; that a later rebuild at `2026-09-04T10:52:48Z` produced the frozen `3777054f…`; and that
the layout observations are carried forward on the basis that `RoutineTemplateBuilder.tsx` was last written at
10:27:40 UTC, before both builds, with the freeze-matching SHA-256 `98e8aef8…`. Label every carried-forward
figure as measured on `adcc6cdb…`, not on the frozen artifact. Correct `W2_EXECUTOR.md:48` so it no longer
reads as an install of the final APK.

**Either path also requires:** regenerate `FREEZE_INVENTORY_W2.json` with the tool so it reflects the corrected
record, and append the next unused ledger entry rather than editing Entry 0078 or any closed history.

Do not rebuild the APK, rerun unrelated persistence experiments, touch the Pixel, or expand into shared
InfoTip, glossary or role-chip changes while closing this.

---

## 8. What is credited

- The executor made a genuinely good, tightly bounded fix. Stacking the selector and giving the container a
  definite width to flex into resolves F4, F6 and the 360 dp mid-word breaks in a single change, without
  touching a label, a behaviour, or any shared control.
- F5's recapture is honest: the new dump is not merely a different file, it demonstrably carries scaled text
  metrics. That is the right way to close a "measured under the wrong state" finding.
- The focused tests were strengthened in the right direction — contract-anchored and fail-closed.
- F7 and O1 were correctly left unfixed and escalated rather than quietly absorbed into a selector-only pass.

## 9. Coverage boundary — what this audit did NOT establish

- That the frozen APK `3777054f…` renders the verified layout. No capture of it exists; see §4.
- Anything about the physical Pixel. Every measurement here is the isolated synthetic AVD.
- Full `verify:ci`, the Windows artifact gate, or the 42-record inventory — attributed to Codex/Gemini in §5.
- Aggregate branch health, migrations, or release readiness. That is W3 and beyond, and W2 approval would not
  have implied any of it.
- Whether `theme.font.eyebrow`'s `letterSpacing: 1.6` and `textTransform: 'uppercase'` cause the same overflow
  in other controls. O3 suggests at least one place it may.

---

## 10. Handback token

```text
W2 REQUEST CHANGES — LAYOUT REMEDIATION VERIFIED; FINAL-ARTIFACT CAPTURE LINEAGE UNRESOLVED
```

W3 does not begin until CR-W2-01 is closed. Per §5.1 step 8 this stops here with the exact remaining
requirement rather than opening an indefinite review loop: one bounded correction (§7, path A or B), then a
short re-check of that correction alone — not a re-audit of the layout, which is settled.
