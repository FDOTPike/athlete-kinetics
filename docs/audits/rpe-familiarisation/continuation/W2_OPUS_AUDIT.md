# W2 Opus Audit — QA Candidate Build and Observed Selector Layout

## 0. Verdict

```text
W2 REQUEST CHANGES
```

Bound to freeze: HEAD `0d24ebd7fc549ae6ecd2444856ec1386f5a5ec72`, branch `codex/rpe-familiarisation`,
tracked-diff fingerprint `41f19f2aa87b062cefd570a0bc7f1e45e949ec4a068ece6444e65d1e6416c440`
(67,529 bytes), QA candidate APK `7d7f8846891e8be15771ed63f08cf519d4fcd9f66cd2272dc88fe72f97136aeb` —
all independently recomputed here.

**The build, the provenance chain and the behavioural evidence are sound.** The artifact was genuinely
built from the reviewed frozen source, the freeze inventory is tool-accurate on all 49 rows, and selection,
tooltips, both dismissal routes and the neutral → effort → neutral regression all verify against the
screenshots. Gemini also reported the layout problem candidly rather than burying it, which is the right
behaviour and is credited below.

**Two findings block approval:**

- **F4 (blocking)** — at `font_scale 1.30` the labels are silently truncated into *different words*:
  `LINEAR` renders as **"LINE"**, `UNDULATING` as **"UNDULAT"**, and `AUTOREGULATED`'s second line is
  sliced through mid-glyph by the chip edge. §5.1 required that observed clipping be *fixed* in this pass.
  It was observed and left unremediated — product bytes are byte-identical to W1.
- **F5 (blocking)** — the `font_scale 1.30` UI dump is a **byte-identical duplicate** of the standard-width
  dump, so every bound and clearance figure claimed for that condition was not measured under it.

Neither requires work outside §5.1's authorized scope. **W3 is not authorized to begin.**

- **Auditor:** Opus, fresh audit context, 2026-09-04T09:33:20Z (see §9 for coverage limits).
- **Audited handback:** `W2_EXECUTOR.md`, SHA-256 `065162351c1bad22bc989d75ddfc1a801a6b5782f113bb3e26d6cdf4fecb6757` (11680 bytes), recomputed.
- **Writes by this pass:** this file only. No product, test, ledger, evidence, inventory or APK file was
  created, modified or deleted. No commit, stage, push, merge, tag or release. No emulator launched, no
  APK rebuilt, no physical Pixel interaction.

---

## 1. Required disclosure (work order §9)

An **earlier Opus session authored the inherited flex fix now under observation** — `flex: 1` on
`styles.schemaChipContainer`, its explanatory comment, the `testID` on each option container, and the
original regression test (`PROMPT_LEDGER.md` Entry 0074; work order §1).

This audit ran in a fresh context and authored no product code, in this pass or any earlier one in this
session. The disclosure constrains what this verdict may claim:

- I am **not** an independent second reviewer of that fix's *design*. I am an independent verifier of the
  W2 build, its provenance, and what the retained visual evidence actually shows.
- This is **one** reviewer. No claim of multiple independent reviewers is made.
- The disclosure cuts against the fix, not for it: F4 below finds that the inherited fix is **insufficient**
  at an accessibility font size. Prior Opus authorship is a reason to state that plainly, not to soften it.

---

## 2. Freeze and artifact identity — CONFIRMED

| Item | Declared | Recomputed | Result |
| :--- | :--- | :--- | :--- |
| HEAD | `0d24ebd7…5ec72` | identical | MATCH |
| Branch | `codex/rpe-familiarisation` | identical | MATCH |
| Tracked-diff fingerprint | `41f19f2a…c440` | identical | MATCH |
| Diff bytes | 67,529 | 67,529 | MATCH |
| `git diff --check` | exit 0 | exit 0 | MATCH |
| Candidate APK SHA-256 | `7d7f8846…6aeb` | identical (194,450,148 B) | MATCH |
| Archived baseline APK | `b42c1be1…0c67` | identical (194,449,552 B) | MATCH |

**Freeze inventory — 49/49 rows verified against disk bytes**: 4 `trackedModified`, 10
`untrackedAuditFiles`, 35 `continuationEvidenceFiles`. Zero mismatches, zero missing. The W1 F1 defect
class has not recurred.

**Product scope held.** `RoutineTemplateBuilder.tsx` (`4f6531bb…acb6`, 68,588 B) and
`RoutineTemplateBuilder.test.js` (`104e0cbd…4343`, 29,219 B) are byte-identical to the W1-approved
candidate, and the tracked diff is unchanged (`311/0`, `10/1`, `69/0`, `25/22`). No unauthorized file moved.
This is correct as a scope matter — and is simultaneously the evidence for F4, since §5.1 required a layout
adjustment once clipping was observed.

**Baseline preservation — verified, and more informative than claimed.** The archived pre-build APK carries
embedded head `e927d8ee…` and tracked-diff fingerprint
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` — the SHA-256 of the empty string,
i.e. built from a **clean** checkout. That independently confirms the old artifact predates the uncommitted
flex fix and could never have demonstrated it. §5.1's instruction not to overwrite the sole copy of
previously cited evidence was honoured.

---

## 3. Build provenance — CONFIRMED by independent reproduction

The embedded `assets/candidate_manifest.json` in the candidate APK was extracted and checked against the
live worktree:

| Manifest field | Value | Against worktree |
| :--- | :--- | :--- |
| `schema` | `ak.candidate-manifest/1` | — |
| `label` | `NON_PRODUCTION_QA_DEBUG_SIGNED` | correctly non-production |
| `head` | `0d24ebd7…5ec72` | **== worktree HEAD** |
| `branch` | `codex/rpe-familiarisation` | **== worktree branch** |
| `sourceDirty` | `true` | honest dirty representation (§5.1.6) |
| `trackedDiffFingerprint` | `41f19f2a…c440` | **== worktree fingerprint** |
| `newFiles` | 8 entries | **8/8 hash-match disk** |

Embedded assets spot-checked: `assets/minilm.onnx` at **exactly 22,972,370 bytes** (the verifier's ratified
size), `assets/fonts/Archivo.ttf` packaged, `assets/index.android.bundle` (Hermes) packaged.

The artifact was therefore built from the reviewed frozen source — not from an earlier commit and not from
later documentation. The two W2 packet documents postdate the build and are untracked, so they could not
and did not perturb the tracked fingerprint; that is why the provenance still resolves after the
documentation writes, and it satisfies §5.1.8 rather than evading it.

---

## 4. Observed layout — the substance

### 4.1 Standard width (420 dpi, density 2.625, 411.4 dp) — PASS on geometry

Recomputed from `ui_builder.xml`, converted at density 2.625:

| Control | Pixels | dp | Contract |
| :--- | :--- | :--- | :--- |
| Chip (each of three) | 255 × 147 | **97.14 × 56.00** | meets `theme.touch.min = 56` |
| InfoTip button | 47 × 47 | 17.90 × 17.90 | see F7 |
| Chip → InfoTip clearance | 16 | **6.10** | positive, zero overlap |

Visually confirmed in `01/02/03`: three chips, clearly separated, no overlap with the adjacent info
buttons, and selection moves correctly (inverted white fill — `theme` Law 2) across Linear → Undulating →
Autoregulated. **Geometry passes. See F6 for what the label text actually does here.**

### 4.2 Narrow width (480 dpi, density 3.0, 360 dp) — PASS on geometry

Recomputed from `ui_narrow_builder.xml` at density 3.0:

| Control | Pixels | dp | Contract |
| :--- | :--- | :--- | :--- |
| Chip | 240 × 168 | **80.00 × 56.00** | meets 56 dp |
| InfoTip button | 54 × 54 | 18.00 × 18.00 | see F7 |
| Clearance | 18 | **6.00** | positive, zero overlap |

Visually confirmed in `10/11/12`: mid-word wrapping exactly as the handback states — `UNDULATIN` / `G` and
`AUTOREGUL` / `ATED`. Both lines are fully rendered and nothing is cut; chips stay separated and tappable.
Ugly, but not clipping. **Not blocking on its own**; worth fixing alongside F4.

### 4.3 Enlarged font (`font_scale 1.30`, 420 dpi) — FAIL

Screenshots `13/14/15` inspected directly at magnification. What renders:

| Intended label | Actually rendered | Failure |
| :--- | :--- | :--- |
| `LINEAR` | **`LINE`** | `AR` cut horizontally, no ellipsis |
| `UNDULATING` | **`UNDULAT`** | `ING` cut horizontally, no ellipsis |
| `AUTOREGULATED` | `AUTOREGU` / `LATED` | second line sliced through mid-glyph by the chip's bottom edge |

This is not degraded polish. Two of the three method names become **different, complete-looking words**.
Nothing signals truncation — no ellipsis, no fade. A user at a common accessibility font size is choosing
between "LINE", "UNDULAT" and a half-cut two-line block, and cannot tell what the third one says or that
any text is missing. `font_scale 1.30` is an ordinary Android accessibility setting, not an extreme.

Work order §5.1 sets the bar: *"Linear, Undulating and Autoregulated must be readable and tappable without
overlapping adjacent info buttons."* Tappable and non-overlapping: **pass**. Readable: **fail**.

---

## 5. Behaviour, tooltips and session regression — PASS

- **Selection states** (`01/02/03`, `10/11/12`): all three methods select, mutually exclusive, inverted
  white fill on the selected chip. Verified visually at both widths.
- **Tooltip content is method-correct and distinct** — verified by reading the rendered cards, not test
  names: `LINEAR` → "A structured loading method where planned load or effort increases steadily across the
  first three working weeks…"; `Undulating` → "Reps and effort trade off across the block, with a shorter,
  harder middle week between two longer, easier ones."; `APRE` → "Autoregulated. The set you actually
  perform decides the next set's load, so a bad day costs less." This closes my W1 observation **O2** at the
  visual level: the wiring is not mis-mapped.
- **Both dismissal routes verified** (`04` → `05` → `06` → `07`): tap-away dismisses cleanly; reopen works;
  Android Back dismisses the popover and leaves the builder in place — no navigation trap, the underlying
  Slot 1 row is intact in `07`.
- **Neutral → effort → neutral regression** (`16/17/18`): effort chips start unselected; tapping `2`
  (RIR 2 / RPE 8.0) highlights only that chip; tapping again returns to neutral. Critically, the planned
  target header reads **`Target 3 × 10 · RPE 6.5` in all three states, unchanged** — the reported actual
  never rewrites the prescription. The actual-versus-target separation holds under direct observation.
- **Stability reproduced from the raw log**: 0 `FATAL EXCEPTION` / `AndroidRuntime` / `ANR`; exactly **4**
  error-level lines, all `E unknown:ReactNative: Tried to remove non-existent frame callback` on PID 6612,
  timestamped at the configuration changes. Benign RN frame-callback teardown, correctly characterised.
- **No emulator result is attributed to the Pixel** anywhere in the handback. Every measurement is labelled
  as the isolated synthetic AVD.

---

## 6. Findings

| ID | Severity | Finding |
| :--- | :--- | :--- |
| **F4** | **BLOCKING** | `font_scale 1.30` truncates `LINEAR`→"LINE" and `UNDULATING`→"UNDULAT" with no ellipsis, and clips `AUTOREGULATED`'s second line mid-glyph (`13/14/15`). §5.1 required that observed clipping be adjusted in this pass — "adjust only this selector's layout (for example wrapping or stacking) without changing labels or behavior, then rerun affected gates/rebuild" — but product bytes are byte-identical to W1, so no adjustment was made. Observation without the required remediation does not satisfy W2. |
| **F5** | **BLOCKING** | `ui_font13_builder.xml` is **byte-identical** to `ui_builder.xml` (both SHA-256 `8907d6e24ca9e2649ca43498e2bf4749df258d05318b6c12f13f3820c4fa31e7`, 38,806 B). The font-1.30 PNGs plainly differ from the standard PNGs, so the font scale did take effect on screen — but the XML did not capture it. Every font-1.30 figure in the handback ("chip heights remain 56.0 dp (147 px), clearance remains 6.1 dp (16 px), zero overlap") is therefore derived from a **font-scale-1.0** dump and is unsupported for the condition it is attributed to. Same class as W1's F1: a value attributed to a state it was not measured under. The claim may well be true — the screenshots suggest the box geometry held while text overflowed — but it is not measured. |
| **F6** | Minor | At standard width, `AUTOREGULATED` **already wraps mid-word** to `AUTOREGULAT` / `ED` (text node 249 × 74 px = two 37 px lines, confirmed visually in `01/02/03`). The handback calls the baseline condition "fully visible, legible, and separated". Visible and separated: yes. A mid-word break is not what "legible" conveys. Not clipping, so not blocking — but the description should match the artifact. |
| **F7** | Minor, needs owner disposition | The repository touch-target contract is **`theme.touch.min = 56`** (`theme.ts:42`), stated in-code as *"Law 3: Touch targets >= 56pt"*. The handback cites the contract as "`minHeight >= 48 dp`, theme min 56 dp" — 48 dp is the generic Material figure, not this repository's. Chips measure exactly 56.0 dp and pass either way, so the conclusion stands. But the **InfoTip is 18 dp with `hitSlop={12}` = 42 dp effective** (`InfoTip.tsx:76,103-104`), failing the repository's own 56 dp law by 14 dp; the handback reports the 42 dp number and never evaluates it against any contract. `InfoTip` is shared across screens, so this is pre-existing and **out of W2's product scope to fix** — but it must be reported against the real contract and dispositioned by the owner, not left as a bare figure. |
| **F8** | Trivial | App logcat reported as 717 lines; newline count is 716. Same line-vs-newline convention noted in W1. Recorded only so the two numbers are not later read as a discrepancy. |
| **O1** | Observation, upgraded | My W1 observation is now **visually confirmed and is user-facing, not merely an accessibility label**: the tooltip cards render titles `LINEAR` and `APRE` — raw enum identifiers — beside a correctly title-cased `Undulating` (`08`, `09` vs `04`). Changing this touches glossary definitions, excluded by §8. Owner disposition. |

### Mechanism for F4, from source — offered as diagnosis, not prescription

Stated as observed facts so the executor can choose a remedy; the choice among §5.1's own options
(wrapping, stacking) is theirs and the owner's, and I am not prescribing a patch:

- `theme.font.eyebrow` applies `textTransform: 'uppercase'` **and** `letterSpacing: 1.6`
  (`theme.ts:36-37`). "Autoregulated" therefore renders as 13 uppercase glyphs with added tracking — far
  wider than the 13-character source string implies, and the tracking does not shrink as the font grows.
- The chip label `<Text>` (`RoutineTemplateBuilder.tsx:766-773`) carries **no `numberOfLines`, no
  `ellipsizeMode`, no `adjustsFontSizeToFit`** — nothing bounds or signals overflow.
- `styles.schemaChip` sets `minHeight: theme.touch.min` (`:1341-1343`), a floor rather than a ceiling; at
  `font_scale 1.30` the text exceeds the row's rendered box and is clipped rather than allowed to grow.

---

## 7. Required to clear this verdict

1. **Fix F4 within §5.1's authorized scope** — this selector's layout only. No label text changes, no
   glossary, schema, algorithm, dependency or native-build changes. All three names must be readable at
   `font_scale 1.30`; ideally resolve the 360 dp mid-word breaks (§4.2) and the standard-width break (F6)
   in the same change. Then rerun the affected gates and **rebuild the QA candidate**.
2. **Fix F5** — recapture the font-1.30 UI hierarchy genuinely under `font_scale 1.30` and re-derive the
   bounds and clearance from that capture. If the geometry turns out unchanged, that is a perfectly good
   result; it simply has to be measured rather than inherited.
3. **Correct F6 and F7** in the handback: describe the standard-width wrap accurately, cite
   `theme.touch.min = 56` as the contract, and record the InfoTip 42 dp shortfall for owner disposition.
4. **Re-freeze and hand back** with a tool-computed `FREEZE_INVENTORY_W2.json`.

Because the layout must change, product bytes change, the tracked-diff fingerprint changes, and the APK
must be rebuilt and re-verified. **This is a genuine build cycle, not a documentation pass** — unlike W1's
remediation, the focused component tests and `verify:ci` must be rerun, and before/after layout evidence
retained per §5.1.

Per §3.10 this was the review pass; one targeted remediation pass follows.

---

## 8. What is credited

Recorded because it should not be lost in a REQUEST CHANGES:

- The clipping was **found and reported by the executor**, in the handback body and in the freeze
  inventory's own `provenanceNotes` ("honestly report font 1.30 label truncation"). Gemini did not hide an
  inconvenient result to obtain an approval. That is the behaviour this queue is meant to produce.
- The W1 F1 defect class did not recur: 49/49 inventory rows are tool-accurate.
- My R2 recommendation from the W1 audit was acted on — the superseded handback is retained at
  `W2_EXECUTOR_R1_SUPERSEDED.md` rather than overwritten.
- Build provenance is honest about being dirty and resolves exactly against the reviewed source.

---

## 9. Coverage boundary — what this audit did NOT establish

- **`verify:qa-candidate` was NOT reproduced end-to-end.** Run from this session it exits 1 at
  *"Android SDK build tools discovered (aapt, apksigner, zipalign) — FAIL"*, because the Windows SDK tools
  are not reachable from the Linux shell this audit runs in. That is an environment limit, not an artifact
  defect — and notably the verifier **failed closed rather than passing on the manifest's self-assertions**,
  which corroborates its integrity. I independently reproduced its provenance core (APK hash, embedded
  head/branch/fingerprint against the live worktree, 8/8 `newFiles` digests, byte-exact ONNX size, Archivo
  and Hermes bundle presence). The aapt/apksigner/zipalign, certificate-DN, 16 KB zipalign and 28 ELF64
  `PT_LOAD` checks remain **executor-reported and unverified by me**.
- **No emulator was launched and no APK was rebuilt by this audit.** All layout conclusions come from
  retained screenshots and UI dumps. I did not observe the running app.
- **`font_scale 1.30` geometry is unmeasured** (F5) — by the executor and, absent a genuine dump, by me.
- **Physical Pixel**: untouched by me. The "zero commands to `49241FDAP001C7`" guard is consistent with the
  retained evidence but is a process claim that retained artifacts cannot fully prove.
- **`verify:ci` / `verify:components` not re-run** in this pass or either W1 pass.
- **No aggregate branch review** — that is W3, which this verdict does not authorize.
- **Statuses unchanged**: `ORIGINAL PIXEL SAVED VALUES: NOT RE-VERIFIED`;
  `SAVED-RPE HISTORY UI: NOT AVAILABLE`; `C6: NOT EVALUATED`. None licenses unrequested feature work.
- **No commit, stage, push, PR, merge, tag, signing or release** is authorized or implied. Owner authority
  is untouched.

---

## 10. Handback token

```text
W2 REQUEST CHANGES — BUILD AND PROVENANCE VERIFIED; LAYOUT OBSERVED AND FAILING
F4 FONT_SCALE 1.30 LABEL TRUNCATION NOT REMEDIATED — §5.1 ADJUSTMENT REQUIRED
F5 FONT-1.30 UI DUMP IS A DUPLICATE OF THE STANDARD DUMP — BOUNDS UNMEASURED
BEHAVIOUR, TOOLTIPS, DISMISSAL AND TARGET/ACTUAL SEPARATION: PASS
W3 NOT AUTHORIZED TO BEGIN
COMMIT / PUSH / MERGE / RELEASE / PHYSICAL DEVICE: NOT AUTHORIZED
```
