# Opus 5 independent audit — Codex / Astra UX accessible-coach slice

Audit date: 2026-09-13. Auditor: Claude Opus 5, independent of the executing
orchestrator. Audit branch: `claude/astra-ux-audit-2026-09-13`, cut from the
integration tip so that tip stays byte-identical to the commit its APK
provenance claims.

## 1. Scope

| Item | Value |
|---|---|
| Audit target | `codex/accessible-coach-2026-09-12` tip `a0c4c20` |
| Work audited | 16 commits `229c2cd..a0c4c20` |
| Dispatch source | `docs/WORK_ORDERS_2026-09-12_ACCESSIBLE_COACH.md` (WO-01 … WO-10) |
| Claims audited | Entry 0117, `HANDOVER_2026-09-12_ACCESSIBLE_COACH_INTEGRATION.md`, `docs/audits/accessible-coach/ORCHESTRATOR_EXECUTION_PLAN.md`, five per-WO handovers |
| Per-WO branches | `codex/ac-wo01-keyboard`, `ac-wo02-onboarding`, `ac-wo03-backup`, `ac-wo04-evidence`, `ac-wo06-clinical-design`, `ac-wo08-inventory` |
| Diff size | 59 files, +3523 / −198 |

## 2. Verdict

```text
CLAIM ACCURACY:            HIGH — no overclaim found in the status taxonomy
GATE INTEGRITY:            PASS — gates added, none weakened or removed
VERIFICATION REPRODUCED:   PASS — verify:ci exit 0, 27 suites / 467 tests
PROVENANCE CLAIMS:         VERIFIED — cherry-pick and baseline numbers exact
DEFECTS FOUND:             2 substantive (accessibility), 4 minor
NET: the slice is what it says it is. The defects sit inside the surface the
handover itself lists as untested (screen-reader behaviour), so they are gaps
in delivery rather than misstatements.
```

The honesty discipline here is unusually good. The handover volunteers its own
failures (a first-build crash, a Gboard extract-mode discovery, a scroll-offset
bug, a goal-ellipsis miss caught on the final screenshot), refuses to call
WO-03 a working backup, and keeps the final APK hash out of the tracked file
specifically so the document cannot invalidate the provenance it asserts. Every
number I could independently recompute matched.

## 3. Claims independently reproduced

| Claim | Method | Result |
|---|---|---|
| `npm run verify:ci` PASS, 27 suites / 467 tests | Full run at `a0c4c20` | **PASS**, exit 0, `27 passed, 27 total` / `467 passed, 467 total` |
| Gate count 21 → 22 with `verify:backup` added | Diff of `package.json`, `ci.yml`, `AGENT_WORKFLOW.md`, `README.md` | **TRUE**, and double-enforced: `verify_store_sql.mjs` asserts exactly 22 invocations, `test_verify_ci_structure.mjs` asserts `gateCount: 22`. No gate weakened or dropped. |
| React pinned to exactly `19.1.4`, preflight fails closed on drift | Read gate, observe run | **TRUE**. The gate parses the RN renderer's own runtime guard string out of `ReactNativeRenderer-prod.js`; run logged `PASS … [react=19.1.4; renderer=19.1.4]` |
| All 21 product `TextInput` call sites set `disableFullscreenUI` | Count both | **TRUE**, 21 / 21 exact |
| No user-facing "fat loss" remains | Grep `apps/mobile/src`, `packages/*/src` | **TRUE**. Remaining `damped` hits are engine internals and comments — the workload safeguards WO-02 said to preserve |
| Exact replacement week copy | Grep verbatim | **TRUE**, `OnboardingScreen.tsx:422` matches the work order character for character |
| Effort copy taught consistently | Grep | **TRUE** in glossary, onboarding, and session |
| 56 dp information controls | `theme.touch.min` + device UI dump | **TRUE**. `theme.touch.min = 56`; on-device bounds `[864,889][1032,1364]` = 168 px at 3× = exactly 56 dp, reserved in layout rather than via clippable `hitSlop` |
| Info control distinct from option select | Device UI dump | **TRUE**. Separate focusable nodes, non-overlapping bounds (option ends x=840, info starts x=864), distinct labels `What does NEW TO THIS mean?` |
| Selection state exposed to AT | Device UI dump | **TRUE**. `accessibilityState.selected` surfaces as the `selected` attribute |
| `ffae074` cherry-picked as `87624d9` | `git patch-id --stable` on both | **TRUE**, identical patch-id `1a24ce3b…` |
| Integration base `e8cedca` | `git merge-base --is-ancestor` | **TRUE**, and it is `87624d9`'s parent |
| Baseline "21 gates / 26 suites / 434 tests" | Gate count at `e8cedca`; suite enumeration; `.each`-aware test counting | **TRUE**. 21 invocations and `ci.yml` says 21; 26 suites at base vs 27 at head, delta exactly the new `KeyboardLayout.test.js` (3 tests, matching the "1 suite / 3 tests" focused-gate claim); bias-corrected expansion counting reproduces **434** exactly, delta exactly 33 |
| No migration added; `064` reserved | Diff + enumeration across every local and remote branch | **TRUE**. No schema change; max migration is `063` everywhere, so `064` is genuinely unallocated |
| Offline posture preserved | `AndroidManifest.xml` | **TRUE**. `INTERNET` carries `tools:node="remove"` against blob-util's library merge |
| WO-03 is contract-only | Read `packages/core-db/src/backup/**` | **TRUE**. Canonical JSON, injected SHA-256, envelope validation, replace-only restore model. No DB access, no UI, no crypto, no picker — exactly the `DESIGN_OR_RESEARCH_ONLY` label |
| Nothing pushed / merged / released | `git rev-parse origin/<branch>` ×7 | **TRUE**, all seven branches are local-only |
| WO-04 citations are real | Spot-checked 8 `file#line` links | **TRUE**, 8 / 8 land exactly on the claimed construct (`workingSetsFor`, `AGE_SET_DELTA`, `EXPERIENCE_TRIAGE`, `EXPERIENCE_SEVERITY`, `SCHEMES`, Epley translation, `DEFAULT_PROFILE`, return evaluator) |

Two things deserve explicit credit beyond their claims:

- **A latent bug fixed in passing, unmentioned.** `scripts/verify-preflight.mjs`
  gated its embedder-bootstrap remediation on `fail > 0`, so *any* earlier
  preflight failure printed a misleading embedder remediation. It is now
  `fail > embedderFailStart`. Correct, and not taken credit for.
- **The backup inventory is gated, not just documented.**
  `verify_backup_contract.mjs` extracts table sentinels from
  `migrationRunner.ts`, asserts 85 unique plus the row-sentinel cutoff, and
  asserts `WO03_DURABLE_DATA_INVENTORY.md` names every one. Adding a table
  without listing it **fails `verify:backup`**. That is the right protection for
  the Migration 064 hand-off and it already exists.

## 4. Defects found

### F1 — Explanation popovers are inaccessible to screen readers (substantive)

WO-02 required "a labelled information button with an accessible expandable
explanation or popover", and that "New to this" explain the option in ordinary
language. The button is correct. The explanation is not reachable.

From Codex's own device dump `14_final_experience_info.xml`, the open popover's
real Android tree is:

```text
android.widget.Button  content-desc="Dismiss explanation"
                       clickable=true focusable=true  bounds=[0,156][1080,2328]
  └── ViewGroup (card)
      ├── TextView "NEW TO THIS"                         focusable=false  content-desc=""
      ├── TextView "Choose this if structured training…"  focusable=false  content-desc=""
      └── TextView "tap anywhere to close"               focusable=false  content-desc=""
```

The only focusable node is a full-screen button whose accessible name is
"Dismiss explanation". The term and definition are non-focusable children with
empty `content-desc`, and an explicit `content-desc` on a container overrides
its children's text for the announcement. So TalkBack announces
*"Dismiss explanation, button"* and the explanation itself is never spoken.
There is also no `accessibilityViewIsModal`, no focus containment, and no
announcement on open.

`InfoTip.tsx` is pre-existing code, so this is inherited rather than newly
broken — but WO-02 promoted it to the primary vehicle for a new accessibility
requirement without hardening it. The handover's "TalkBack/VoiceOver … NOT
TESTED" line means this is undisclosed-but-not-misclaimed; it is nonetheless
the most important functional gap in the shipped slice.

Fix: put the accessible name and content on the card, not the backdrop — give
the card `accessibilityViewIsModal`, `accessibilityRole="alert"` or a labelled
container, move `accessibilityLabel="Dismiss explanation"` onto a real close
control, and let the term/definition be focusable text.

### F2 — The specialist/standard equipment distinction left the accessibility tree (substantive)

Before: `accessibilityLabel={`Specialist equipment ${LABEL}: ${owned ? 'owned' : 'not owned'}`}`
After: `accessibilityLabel={`${LABEL}. ${DESCRIPTION}`}` plus `accessibilityState={{ selected }}`.

Moving owned-state out of the label string into `accessibilityState` is the
correct pattern and is a genuine improvement. But the *"Specialist equipment"*
qualifier was dropped with nothing replacing it in the accessibility tree. Its
only remaining carrier is:

```tsx
<Text style={styles.fieldLabel}>SPECIALIST</Text>
```

with **no `accessibilityRole="header"`** — and the same file uses that role
correctly one screen over on `reviewHeading`, so the pattern was known. A
TalkBack user swiping through controls, or navigating by headings, never
encounters the standard/specialist boundary on a screen whose entire design
premise (per its own source comment) is that specialist equipment must be a
deliberate, explicit opt-in. WO-02's acceptance criterion is "screen-reader
labels and focus order work."

Two things compound it:

1. **The regression is masked by a test rewrite.** `ContentCorrection049.test.js`
   previously asserted `getByLabelText('Specialist equipment BOARDS: not owned')`.
   It now asserts the new description-bearing label and reads
   `accessibilityState.selected`. Nothing fails.
2. **The surface was never device-exercised.** `SPECIALIST` appears in **none**
   of the 64 evidence dumps, and `BARBELL` appears only in the review-summary
   dumps. The equipment *customize* list — all 11 `ChoiceRow`s and their 11
   `InfoTip`s — was never rendered on the emulator; `showCustomEquipment` stayed
   collapsed. The handover's "equipment choices and explanation controls" refers
   to the three presets (`FULL GYM` / `HOME BASIC` / `MINIMAL`), which the dumps
   do confirm. That wording is broader than the evidence.

Fix: add `accessibilityRole="header"` to the `fieldLabel` Texts (one line, and
it also helps `PAST INJURIES`, `MOBILITY LIMITS`, `WHO PICKS THE WEIGHTS?`),
and/or restore a "Specialist" prefix on those rows' labels.

### F3 — "Match the final navigation label" is unmet (minor)

WO-02: *"You can change this later in Athlete Profile." **Match the final
navigation label.*** The copy says "Athlete Profile". The navigation tab label
is `'PROFILE'` (`apps/mobile/src/App.tsx:51`). The destination screen's own
heading *is* `ATHLETE PROFILE` (`ProfileScreen.tsx:360`), so nothing misleads a
user — but the instruction as written is not satisfied, and this is the one
acceptance detail the handover's otherwise scrupulous untested/deferred list
does not mention. Cheap either way: relabel the tab, or say "Profile".

### F4 — Duplicated option copy with a crash-on-drift coupling (minor)

`EQUIPMENT_DESCRIPTION` (in `OnboardingScreen.tsx`) and the 11 new glossary
entries are byte-identical duplicates. `InfoTip` **throws** in dev on an
unknown term and renders `null` in production. Every equipment row now passes
`infoTerm={EQUIPMENT_LABEL[item]}`, so adding a 12th equipment item without a
matching glossary entry crashes onboarding in development and silently drops
the info button in production. All 11 resolve today (verified); nothing gates
it.

The experience options already show the drift this invites: the row label says
*"Under a year of consistent training, or returning after a long break"* while
the info card says *"Choose this if structured training is still new…"* — two
different explanations of one option.

Fix: derive the glossary entries from `EQUIPMENT_DESCRIPTION`, or add a
one-line assertion to an existing gate.

### F5 — One sentence overstates the keyboard primitive's reach (minor)

"Shared keyboard-aware scrolling across the 21 editable call sites" is not
quite true of `LibraryScreenV2`: its search field sits above a virtualized
`SectionList`, which correctly cannot be wrapped in a `ScrollView` primitive,
so it received the shared tap/dismiss constants but no scroll-to-focused-input
runway. The engineering call is right; the sentence is imprecise.

### F6 — The whole slice exists only on this machine (minor, operational)

All seven branches are local-only, spread across seven worktrees, including
~3,500 lines of evidence and decision documents that exist nowhere else. The
handover says push was not performed, so this is disclosed, not hidden. Also
`docs/WORK_ORDERS_2026-09-12_ACCESSIBLE_COACH.md` sits **untracked** in the
master checkout while being committed on the branch — a stray copy that will
confuse whoever reads master next.

### Not a defect — checked and cleared

- The final on-disk `app-qa.apk` is 194,534,936 bytes / SHA-256
  `cea97dbd89043fd0719a2aa3fc4368876ad2e4971580cbbb1485996413809b73`, which does
  **not** match the handover's `0152cf8a…` / 194,534,980 bytes. That is
  expected and consistent: the handover attributes `0152cf8a…` to the
  `7f4c8c0` extended-keyboard candidate and states the final documentation tip
  is rebuilt afterwards. The hash above is that final-tip rebuild, and it is
  recorded here because the handover deliberately (and correctly) could not
  contain it.
- Every modified pre-existing test was checked for assertion-weakening. All
  five are consequential updates to changed copy or new behaviour, not
  loosened assertions. `ProgramQualityRound2.test.js`'s heading change
  (`ANYTHING I SHOULD TRAIN AROUND?` → `ANY TRAINING NOTES TO RECORD?`) is the
  honest correction, since the notes are record-only and not executable.
- The plaintext backup envelope is disclosed rather than glossed:
  `manifest.protection.mode` is fixed to `plaintext`, described as "a truthful
  marker, not an assertion that exported health data is adequately protected",
  with a designed libsodium Argon2id + XChaCha20-Poly1305 wrapper and a hard
  "must not be exposed as the default shareable health backup without a
  reviewed protection layer".

## 5. Review of the queued checkpoint work order

Reviewing `docs/decisions/ACCESSIBLE_COACH_CHECKPOINT_2026-09-12.md` —
"Francis' policy/schema dispositions plus clinician review" — as the next
queued item.

It is a well-built decision instrument: every item has a concrete recommended
disposition rather than an open question, policy (`D*`) and persistence (`SC*`)
identifiers are deliberately kept separate so they cannot be conflated, and the
precedence order is stated once and unambiguously. Four observations.

### R1 — Most of this does not actually need the clinician (act on this first)

The decision tokens read as one combined owner-plus-clinical gate, and the
handover repeats that framing. Read closely, the docket has already decoupled
them. D07 approves "only state/provenance capture in the first schema slice",
and SC-04 puts "no executable numeric medical threshold or validation range in
Migration 064 … executable types/units wait for clinical approval".

So **Migration 064 as scoped needs owner approval only.** The clinician gates
the screening question text, executable limit types and units, symptom policy,
warning semantics, and conflict/expiry interpretation — all downstream code,
not the schema.

Owner-decidable now: D01, D03, D04, D05, D06, the capture half of D08,
SC-01, SC-02, SC-03, SC-05, SC-07, SC-09.
Genuinely clinician-gated: D07, D09, D10, the executable half of SC-04,
the clinical semantics of SC-06, the symptom conservatism of SC-08.

That means the largest remaining block of value — WO-05 activity capture,
recurrence, occurrence reconciliation, and weekly-planner integration — is
unblocked by your dispositions alone. §5 of the checkpoint lists owner and
clinical acceptance together, which is correct for the whole roadmap but
misleading as a gate on the *next* slice. Worth splitting explicitly before
dispatch.

### R2 — D02 is an unfunded dependency on engine work

D02's desired end state is "remove experience-tier-only workload uplift", with
the interim rule that the accessible flow must not be *described* as conforming
while the legacy uplift remains. That uplift is real and substantial —
`blockGenerator.ts:886` (`workingSetsFor`: beginner −1 set, elite +1) and
`routineMicrocycle.ts:200` (`AGE_SET_DELTA` plus per-session/week family
budgets of beginner 0/0, intermediate 32/60, advanced 40/80, elite 48/100, a
50 %+ budget increase from experience tier alone).

Removing it is a change to the highest-risk area of the engine, guarded by the
policy/blocks/autopilot gates, and it currently has **no work order, no owner,
and no test plan** — while simultaneously blocking the conformance claim. It
needs its own bounded work order. The oracle is already written: R05's
counterfactual — identical activity, time, recovery and limits, changed tier,
no added work — and no such counterfactual test exists in
`packages/inference/test` today.

### R3 — The clinical review needs a written brief, not an open engagement

§1 records "Qualified clinical reviewer: not yet identified", and everything in
R1's clinician-gated column waits on that person. This is the real critical
path and it is a procurement problem, not an engineering one. Scope it as a
tight written brief covering exactly the six items — screening triggers and
state transitions, executable limit types and units, symptom-severity
conservatism, monitoring warning semantics, conflict/expiry handling, and the
POTS-specific rules — with the APSS-versus-ACSM comparator already chosen. That
converts an open-ended clinical engagement into a bounded paid review, and it
keeps the schema work in R1 off the critical path.

### R4 — `064` is free today, and thirteen branches are queued behind it

Verified: no branch, local or remote, exceeds migration `063`, so the
reservation is currently valid. But thirteen local branches sit at `063` and
any of them could claim `064` first. The checkpoint's own instruction to
re-check before creating it is exactly right; reserve it in the same commit
that lands the contract rather than ahead of time.

One genuine trap the checkpoint already defuses: SC-07 requires backup to
inventory all 064 rows. As noted in §3, `verify:backup` already fails closed
when a schema table is missing from the inventory document, so 064 cannot land
silently without backup coverage being addressed. The remaining gap is that the
gate couples schema to the *document*, not to an exporter — which is correct
today, since the contract is deliberately table-agnostic and no exporter
exists, but it will need extending when one does.

## 6. Recommended sequence

1. **Fix F1 and F2** — both are small, both are in the surface WO-02 was
   commissioned to improve, and F2 additionally needs its rewritten test to
   re-assert the specialist distinction so the regression cannot recur.
2. **Fix F3 and F4** — one copy decision, one de-duplication.
3. **Exercise the equipment customize list on device** (and, ideally, one
   TalkBack pass over the onboarding flow) to close the coverage gap F2 exposed.
4. **Push the seven branches** so ~3,500 lines of evidence stop living on one
   machine, and remove the untracked stray work-order copy from master.
5. **Record D01, D03–D06, D08-capture, SC-01–SC-03, SC-05, SC-07, SC-09** and
   dispatch Migration 064 plus WO-05 on owner approval alone (R1).
6. **Open a bounded work order for D02** with the R05 counterfactual as its
   acceptance oracle (R2).
7. **Commission the clinical review** against the six-item brief (R3).

## 7. Audit method and limits

Everything in §3 was recomputed from the repository, the emulator evidence
directory, or a full local gate run — not read off the handover. Gate results
come from one `npm run verify:ci` at `a0c4c20` (exit 0). Accessibility findings
were derived from source and then confirmed against Codex's own uiautomator
dumps, which is stronger than source reading alone but is still not a TalkBack
session.

Not verified by this audit: iOS behaviour, any actual assistive-technology
announcement, physical-device execution, the emulator's live behaviour (only
its recorded artifacts), and the `7f4c8c0` candidate APK, which no longer
exists on disk — its build is attested only by the handover and the surviving
final-tip rebuild.
