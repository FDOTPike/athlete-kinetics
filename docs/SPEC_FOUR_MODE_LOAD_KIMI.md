# Canonical four-mode load-selection UI specification (Kimi)

## 1. Provenance and authority

- **Original author:** Kimi (read-only design-specification agent, orchestrated by Hermes).
- **Original source task:** Codex task id `019fd63b-b3fa-7c02-873e-cb9701d698a6` ("Review Hermes audit findings").
- **Original attached handback:** `C:\Users\fpike\.codex\attachments\43fa7363-5c5f-48be-b2e2-2ff1cee98970\pasted-text.txt` (23,908 bytes, 215 logical lines; 214 newline bytes and no final newline), beginning with the read-only workspace verification and containing `# KIMI — FOUR-MODE LOAD-SELECTION UI SPECIFICATION` with all seven work-order deliverables.
- **Original mode:** read-only specification, produced 2026-08-07 **before implementation**, against HEAD `004d1ce130f414df0538a1cc5dceaf797582c390`, with no repository writes.
- **Acceptance:** accepted by Francis/Codex subject to the eight mandatory corrections in the later Kimi execution authorization (folded in here; see §10.1).
- **Canonicalized:** 2026-08-08 (Australia/Sydney), after the Opus 5 audit (`AUDIT_2026-08-08_FOUR_MODE_LOAD_OPUS5.md`, verdict REVISE), incorporating the post-Opus corrections of `TASK_AMENDMENT_AGENT.md` (see §10.2).
- **Owner decisions:** Francis selected the recommended D1 and D2 rulings on 2026-08-08 — **D1-A**: retain and ratify the bodyweight-1RM carve-out; **D2-A**: preserve the genuine Kimi artifact rather than waive it. This file is the resulting artifact.
- **Authority:** `docs/WO_FOUR_MODE_LOAD.md` (ratified 2026-08-07) is binding. This document is presentation-layer specification only; it may not change resolver order, tier authority, persistence model, or safety laws.

**Honesty note (per D2-A):** this canonical text did not exist verbatim before implementation. The original handback is the base; every later correction is marked in the amendment record (§10) rather than backdated into the original's voice. Where original wording was superseded, the superseded text appears only inside §10 quotations.

Domain values in code and tests remain exactly `seeded | history | derived | manual` (effective sources) and `auto | manual` (durable preference). Friendly labels below are presentation only. There is no fifth source.

---

## 2. Foundational presentation decisions

The pre-phase SESSION load field was a `Stepper` with an always-numeric value initialized to `0`. That shape cannot express "blank." This specification therefore changes the **load entry to a direct-entry numeric field with ± 2.5 kg fine-adjust buttons** — the composition proven by `OneRmRow` in `ProfileScreen.tsx` (text input, placeholder "—", numeric keyboard, ± buttons at 88pt hit zones). This is a screen-local composition of existing primitives plus `TextInput`; it requires no shared-primitive edit, no theme edit, and no new dependency.

Blank is rendered as an empty field with placeholder "—". The athlete's draft is held as **string state**, so `""`, `"0"`, and `"60"` are three distinct states at the UI boundary.

### 2.1 Strict load parsing (canonical — supersedes the original `Number.parseFloat` proposal)

- Trim the draft. An empty/whitespace draft is **absent** (`null`), never zero.
- Accept decimal notation only, dot or comma separator, validated against an expression equivalent to `^(?:\d+(?:[.,]\d*)?|[.,]\d+)$`.
- Normalize comma to dot and convert with `Number(...)`.
- Reject negatives, trailing characters, hexadecimal-like text, NaN, and Infinity (`Number.isFinite(value) && value >= 0` required after conversion).
- The literal `"0"` remains valid explicit-zero evidence.

### 2.2 Canonical load-entry grid and range (Opus P1-2 / amendment §6.2)

Syntax validity is not sufficient for loggability. A loggable load must additionally sit on the rack grid:

- valid range: **0 to 500 kg inclusive**;
- valid resolution: **exact 2.5 kg increments**;
- `0`, `0.0`, `2.5`, and `60` are loggable;
- `1`, `1.25`, `61`, and `500.1` are **not** loggable;
- blank remains absent (not an error; LOG SET stays disabled with the blank hint);
- invalid input keeps the athlete's draft visible and disables LOG SET;
- any draft that would change numerically at commit time is rejected — never silently snapped or clamped;
- the screen passes the same numeric value the athlete entered to `logSet`;
- the ± controls move by exactly 2.5 kg.

### 2.3 No fifth source after editing

If the athlete edits a value initially populated from `history` or `derived`, the operative logged value is the athlete's edited value, but the effective source for that set's source presentation **remains `history` or `derived`**. No `athlete-entered`, `edited`, or similar source value exists.

### 2.4 Unknown implement fails toward blank (Opus P2-2)

`bodyweightMode` is true **only** when the movement's canonical first supported prefix is exactly `Bodyweight`. An absent, empty, unparseable, or non-canonical prefix list is not bodyweight evidence: the load field follows external-load safety behavior — blank first exposure, LOG SET disabled until an explicit valid entry.

### 2.5 Bodyweight 1RM carve-out — Francis decision D1-A (ratified)

- A stored movement 1RM does not distinguish total system load from added load for bodyweight movements.
- Therefore reps + 1RM must not derive an operative **or advisory** added load when `bodyweightMode` is true.
- A valid absolute APRE override may still prescribe added load.
- Exact logged added-load history remains valid.
- Manual entry and current-session carry-forward remain valid.
- Absent evidence uses the bodyweight identity zero.
- This is an intentional safety/domain rule, not an accidental resolver omission.

### 2.6 Stable target RPE for load provenance (Opus P2-4)

The displayed resolver call and the one-time draft initializer use **the same** target-RPE input: the slot's target RPE when present, and one fixed prescription fallback when the slot target is nullable. Mutable Actual RPE is completion evidence; it must never recalculate source/advisory copy or rewrite load draft state.

### 2.7 Current-session carry-forward (manual mode)

- After the athlete logs a manual set, the latest **actual** load for that movement may initialize its next set.
- Source remains `manual`; the carried value is not an advisory suggestion and creates no current-session-history source.
- The latest set is determined by **highest `set_id`**, never assumed array order.

---

## 3. Exact athlete-facing copy and accessibility labels

### 3a. Session load-field supporting copy (rendered as the `loadEvidence` line)

| Situation | Exact copy |
|---|---|
| seeded, external load (reps target) | `First time on this one — pick a weight you could lift about ten times.` |
| seeded, external load (**timed** target) | `First time on this one — choose a load you can control for the full interval.` |
| seeded, bodyweight/added-load | `0 kg means bodyweight only. Add weight when you need it.` |
| history, external load | `Last logged {X.X} kg` |
| history, added load | `Last logged {X.X} kg added load` |
| derived via APRE override | `Prescribed {X.X} kg` |
| derived via APRE override, added load | `Prescribed {X.X} kg added load` |
| derived via 1RM | `Based on your {Y.Y} kg 1RM` |
| manual with no advisory | `Your call. The number you enter is what gets logged.` |
| manual with APRE advisory | `Coach suggests {X.X} kg — your entry stands.` |
| manual with 1RM advisory | `Coach suggests {X.X} kg from your {Y.Y} kg 1RM — your entry stands.` |
| manual with history advisory | `Coach suggests {X.X} kg from your last session — your entry stands.` |
| manual current-session carry-forward | (no extra copy — the field holds the athlete's own last logged load, which is not a suggestion) |

Advisory precedence in manual mode is APRE override → 1RM-derived → history, exactly one advisory line, never more. Per D1-A, the 1RM advisory does not exist for bodyweight movements.

### 3b. Validation errors and disabled-state hints

| Situation | Exact copy |
|---|---|
| LOG SET disabled, blank external load (hint rendered below the field) | `Enter a load to log this set.` |
| Invalid or non-canonical entry (bad syntax, off-grid, out of range) — field keeps draft text | `Enter a load from 0 to 500 in 2.5 kg increments.` |
| Explicit zero is **not** an error. It logs. | — |

### 3c. Field labels

| Field | Label |
|---|---|
| External-load movement | `LOAD KG` |
| Bodyweight/added-load movement | `ADDED KG (0 = BODYWEIGHT)` |

Unknown/uncatalogued implement uses the external-load label (§2.4).

### 3d. Accessibility labels (screen-reader exact strings)

| Element | accessibilityLabel |
|---|---|
| Load input, seeded external (reps) | `Load in kilograms. First time on this movement — enter a weight you could lift about ten times.` |
| Load input, seeded external (timed) | `Load in kilograms. First time on this movement — choose a load you can control for the full interval.` |
| Load input, history external | `Load in kilograms. Last logged {X.X} kilograms.` |
| Load input, derived APRE | `Load in kilograms. Prescribed {X.X} kilograms.` |
| Load input, derived 1RM | `Load in kilograms. Based on your {Y.Y} kilogram one rep max.` |
| Load input, manual, no advisory | `Load in kilograms. Your choice — the number you enter is what gets logged.` |
| Load input, manual, with advisory | `Load in kilograms. Coach suggests {X.X} kilograms. Your entry stands.` |
| Load input, added-load modes | Same stems with `Added load in kilograms, zero means bodyweight only` replacing the first sentence. |
| Load validation (when invalid) | conveys the same range and increment: `Enter a load from 0 to 500 in 2.5 kg increments.` |
| Decrease button | `Decrease load by 2.5 kilograms` |
| Increase button | `Increase load by 2.5 kilograms` |
| Disabled LOG SET | `Log set {N} for {movement}, unavailable — enter a load first` |
| Enabled LOG SET | unchanged: `Log set {N} for {movement}` |

### 3e. Onboarding load-preference step copy (non-beginner only)

- Heading: `WHO PICKS THE WEIGHTS?`
- Subline (`pDim`): `You can change this later in the ATHLETE tab when no session is active.`
- Chip AUTO: `COACH SUGGESTS — Targets come from your numbers and history. You can always adjust before logging.`
- Chip MANUAL: `I CHOOSE — You set every load. Coach suggestions appear as reference only.`
- Accessibility: `Coach suggests. Targets come from your numbers and history.` / `I choose. You set every load, with coach suggestions as reference.`

Pre-selected on entry: intermediate → COACH SUGGESTS; advanced/elite → I CHOOSE. The pre-selection is visible (selected chip inverted) and freely changeable.

### 3f. Onboarding summary rows

- Beginner (no choice step shown): `LOADS — you choose the first; next time starts from what you logged` — sits beside the existing `PROGRAMMING — handled by your coach (auto)` row.
- Intermediate/advanced/elite: `LOADS — coach suggests` or `LOADS — you choose`.

### 3g. Profile (ATHLETE tab) copy

Placed in the existing `SESSION & DISPLAY` section as a chip row matching the section's existing pattern:

- Label: `LOAD SELECTION`
- Chips: `COACH SUGGESTS` / `I CHOOSE`
- Hint below (idle): `Coach suggests loads from your numbers and history, or you choose every load yourself. Applies to your next session.`
- Hint while session active: `Finish the active session before changing load selection.`
- Beginner: the row is **not rendered** (beginner is restricted to auto; rendering a disabled choice invites a question the law forbids).

Training-age active-session hint (§4.1): shown under the TRAINING AGE row while a session is active — training age cannot be changed until the session ends because it can change load authority.

---

## 4. Onboarding placement, defaults, explicit-choice behavior, and summary

A step key `loads` sits in the non-beginner step list between `effort` and `science`: `['welcome','goal','experience','schedule','time','effort','loads','science','body','equipment','summary']`. The beginner list is unchanged — `loads` never appears for beginners.

Selection mechanics: the wizard holds a transient `loadPreference` draft plus an **explicitness flag**. When the athlete selects a training age on the `experience` step, the draft is set to the tier default (`auto` intermediate, `manual` advanced/elite, forced `auto` beginner) — at selection time, not at step entry. When training age changes mid-wizard, the transition law applies immediately to the draft: entering beginner forces `auto` and removes the step; leaving beginner applies the destination tier's default; moving between non-beginner tiers preserves the athlete's explicit choice. Explicitness flips true only when the athlete presses a chip on the `loads` step; a value set purely by a tier default is not explicit and re-derives on tier change. **An explicit value equal to the tier default is still explicit** and survives later non-beginner tier changes.

The summary step renders the §3f row for every tier. `completeOnboarding` receives the preference (and its explicitness) alongside the profile so the store commits profile fields and preference in **one SQLite transaction** — no committed state may contain a completed onboarding with the wrong tier default (WO §5).

The demo-athlete path is untouched; it bypasses the wizard and takes the seeded migration default.

### 4.1 Independent transition cases (canonical — tests must keep these separate)

1. **Explicit preservation:** advanced → explicitly select auto → elite preserves auto.
2. **Non-explicit re-default:** advanced default manual → change to intermediate before any explicit load choice → auto.
3. **Enter beginner:** any prior value → beginner forces auto and hides the choice.
4. **Leave beginner → intermediate:** defaults auto.
5. **Leave beginner → advanced/elite:** defaults manual.
6. **Explicit same-as-default:** an explicitly chosen value equal to the tier default is still explicit; it survives restart and later non-beginner tier changes.

A test intended to prove non-explicit re-derivation must not reuse an explicitly selected value.

---

## 5. ATHLETE/Profile edit behavior and active-session behavior

Edit affordance: two `Chip`s in the `SESSION & DISPLAY` section per §3g — identical in structure and state semantics to the existing `SESSION MODE` and `READINESS DETAIL` rows. Save-on-tap, matching the screen's no-save-button convention: pressing a chip calls the store's single validated save action immediately.

States: selected chip = inverted white fill (skin Law 2); unselected = line border, `textMid` label; the not-chosen chip is never disabled in idle. During an active session both chips render `disabled` (45% opacity, `ink1` fill — the frozen Chip disabled style) with `accessibilityState={{ disabled: true }}` and the §3g active-session hint replacing the idle hint. The store action independently rejects preference changes during an active session (defense in depth; the UI does not rely on the store for presentation and the store does not rely on the UI for enforcement).

Confirmation and feedback: none required — a two-state chip toggle is self-confirming. The persisted value re-renders as the selected chip, which is the feedback.

### 5.1 Active-session training-age behavior (Opus P1-1 — canonical)

- TRAINING AGE chips are **disabled** while a session is active.
- A visible hint explains that training age cannot be changed until the session ends **because it can change load authority**.
- The direct LOAD SELECTION chips remain disabled as already specified.
- The store rejects any active-session training-age patch whose computed preference or explicitness would change — rejected before any SQLite or in-memory mutation, using the athlete-facing error `End the active session before changing load selection.`
- Ordinary profile edits that do not alter the preference tuple remain available; **not all Profile fields are frozen during a session**.
- Both the UI and store restrictions carry behavioral tests (§8).

### 5.2 Tier transitions on this screen (no active session)

Changing `2 · TRAINING AGE` to beginner forces the preference to `auto` and the `LOAD SELECTION` row disappears on the same render. Leaving beginner applies the destination tier's default and the row reappears pre-set to that default. Moving between non-beginner tiers preserves an explicit preference and re-derives a non-explicit one (§4.1). All of this is store-side law; the screen only renders the hydrated value.

---

## 6. Session behavior for seeded, history, derived, and manual

The screen resolves the effective source by calling the pure resolver (WO §3) with explicit inputs — tier, preference, movement 1RM, honest last logged load, APRE `overrideLoadKg`, target kind, bodyweight mode (§2.4), and the current-session logged sets for the movement. The screen maps `(source, advisory)` to entry state:

**Seeded, external load.** Field starts blank (empty draft, placeholder "—"). Copy per §3a (reps vs timed variants). LOG SET disabled until the athlete enters a canonical grid value (§2.2). Explicit zero, once typed, enables logging. The ± buttons are disabled while the field is blank and become live on first valid entry.

**History (auto or beginner).** Field starts at the exact most recently logged load, `toFixed(1)`. Copy §3a history line. Fully editable; an edited value is authoritative at log time **while the displayed source line remains `history`** (§2.3). Explicit-zero history initializes to `0.0` and is loggable as-is.

**Derived (non-beginner auto).** APRE override present → field starts at `overrideLoadKg`, copy `Prescribed {X.X} kg` (or `... added load`). Else reps target + movement 1RM (external implements only, per D1-A) → field starts at `targetLoadKg(oneRm, reps, targetRpe)`, copy `Based on your {Y.Y} kg 1RM`. Editable; athlete edits are authoritative at log time.

**Manual.** External load: field always starts **blank** on the first set of the movement in the session, regardless of any advisory. Bodyweight/added load: field starts at **`0.0`** — the identity load — and LOG SET is enabled at zero (§5.4 of the correction set). The advisory (if any) renders as the supporting line only — it never populates the field. On subsequent sets of the same movement in the same session, the field initializes to the actual load logged on the latest set of that movement (highest `set_id`; §2.7). Source remains `manual`; the carried value is not a suggestion.

**Timed targets.** `target.kind === 'time'` cannot use repetition/1RM derivation. A valid absolute APRE override remains eligible for non-beginner auto (it is already an absolute prescription) → `derived`. Timed + 1RM but no APRE falls to history when available, otherwise seeded. Beginner ignores APRE for operative load regardless of target kind. Timed seeded copy uses the interval-control wording (§3a).

**Bodyweight / added load.** Seeded added-load initializes to `0` (identity load — the one lawful exception to blank-first). `0` is loggable. History at explicit `0` initializes to `0.0`. APRE override for added load renders `Prescribed {X.X} kg added load`. Reps + 1RM never derives or advises added load (D1-A).

**Rerender protection.** The draft load text lives in local state keyed by `(sessionPlanSlotId, setIndex)` and initializes **once per key change** from the resolver output, using the same stable target RPE as the display path (§2.6). Preference hydration, evidence refreshes (`lastLoggedLoads` updates), Actual-RPE changes, and rerenders with the same key must never overwrite the draft.

---

## 7. Complete state matrix

Abbreviations: B/I/A/E = tiers; OP = operative initial entry value; ADV = advisory value; LOG = LOG SET enabled on entry (before athlete edit). "honest history" = a non-null latest logged load (explicit zero included). All OP values shown are already on the 2.5 kg grid; off-grid/out-of-range drafts are rejected per §2.2 regardless of row.

| # | Tier | Pref | APRE | 1RM | Hist | Target | Load kind | Set | Source | OP | ADV | Copy line | LOG | Validation |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | B | (auto) | – | – | ✗ | reps | external | 1st | seeded | blank | – | seeded external reps copy | NO | blank blocks; `0`/grid values ok |
| 2 | B | (auto) | – | – | ✓ 40 | reps | external | 1st | history | 40.0 | – | `Last logged 40.0 kg` | YES | edits free on grid |
| 3 | B | (auto) | ✓ | ✓ | ✓ | reps | external | 1st | history | last load | – | history copy | YES | beginner never derives |
| 4 | B | (auto) | – | – | ✗ | reps | bodyweight | 1st | seeded | 0.0 | – | `0 kg means bodyweight only…` | YES | identity load |
| 5 | B | (auto) | – | – | ✓ 0 | reps | bodyweight | 1st | history | 0.0 | – | `Last logged 0.0 kg added load` | YES | explicit zero survives |
| 6 | B | (auto) | – | – | ✗ | time | external | 1st | seeded | blank | – | timed seeded copy | NO | as #1 |
| 7 | B | (auto) | ✓ | – | ✗ | time | external | 1st | seeded | blank | – | timed seeded copy | NO | beginner ignores APRE |
| 8 | B | (auto) | – | – | ✓ | reps | external | 2nd+ | history | latest logged load (highest set_id) | – | history copy | YES | current-session evidence wins |
| 9 | I | auto | ✗ | ✗ | ✗ | reps | external | 1st | seeded | blank | – | seeded external reps copy | NO | as #1 |
| 10 | I | auto | ✗ | ✗ | ✓ 60 | reps | external | 1st | history | 60.0 | – | history copy | YES | |
| 11 | I | auto | ✗ | ✓ 100 | ✗ | reps | external | 1st | derived | targetLoadKg(100,reps,rpe) | – | `Based on your 100.0 kg 1RM` | YES | |
| 12 | I | auto | ✓ 95 | ✓ | ✓ | reps | external | 1st | derived | 95.0 | – | `Prescribed 95.0 kg` | YES | APRE beats 1RM |
| 13 | I | auto | ✓ 95 | ✗ | ✗ | time | external | 1st | derived | 95.0 | – | `Prescribed 95.0 kg` | YES | timed APRE derives (absolute) |
| 14 | I | auto | ✗ | ✓ 100 | ✗ | time | external | 1st | seeded | blank | – | timed seeded copy | NO | timed cannot derive from 1RM |
| 15 | I | auto | ✗ | ✓ 100 | ✓ 55 | time | external | 1st | history | 55.0 | – | history copy | YES | timed falls to history |
| 16 | I | auto | ✗ (invalid: −5/NaN/∞) | ✗ | ✗ | reps | external | 1st | seeded | blank | – | seeded copy | NO | invalid APRE fails closed |
| 17 | I | auto | ✗ (invalid) | ✓ 100 | ✓ 60 | reps | external | 1st | derived | targetLoadKg(100,reps,rpe) | – | 1RM copy | YES | invalid APRE falls through to 1RM |
| 18 | I | auto | – | – | ✗ | reps | bodyweight | 1st | seeded | 0.0 | – | bodyweight seeded copy | YES | identity zero |
| 19 | I | auto | ✗ | ✓ 100 | ✗ | reps | bodyweight | 1st | seeded | 0.0 | – | bodyweight seeded copy | YES | D1-A: no 1RM derivation on bodyweight |
| 20 | I | auto | ✗ | ✓ 100 | ✓ 5 | reps | bodyweight | 1st | history | 5.0 | – | `Last logged 5.0 kg added load` | YES | D1-A: history valid |
| 21 | I | auto | ✓ 10 | ✓ 100 | ✗ | reps | bodyweight | 1st | derived | 10.0 | – | `Prescribed 10.0 kg added load` | YES | D1-A: absolute APRE valid |
| 22 | I | manual | ✗ | ✗ | ✗ | reps | external | 1st | manual | blank | – | `Your call…` | NO | advisory never prefills |
| 23 | I | manual | ✓ 95 | ✓ 100 | ✓ 60 | reps | external | 1st | manual | blank | 95.0 | APRE advisory copy | NO | |
| 24 | I | manual | ✗ | ✓ 100 | ✓ 60 | reps | external | 1st | manual | blank | derived value | 1RM advisory copy | NO | |
| 25 | I | manual | ✗ | ✗ | ✓ 60 | reps | external | 1st | manual | blank | 60.0 | history advisory copy | NO | |
| 26 | I | manual | ✗ | ✗ | ✗ | reps | bodyweight | 1st | manual | 0.0 | – | `Your call…` | YES | identity zero, loggable |
| 27 | I | manual | ✗ | ✓ 100 | ✗ | reps | bodyweight | 1st | manual | 0.0 | – | `Your call…` | YES | D1-A: no 1RM advisory on bodyweight |
| 28 | I | manual | ✓ 10 | – | – | reps | bodyweight | 1st | manual | 0.0 | 10.0 | APRE advisory copy | YES | advisory stays supporting |
| 29 | I | manual | – | – | – | reps | external | 2nd+ | manual | latest actual logged load | per evidence | matching advisory copy | YES | carry-forward (highest set_id) |
| 30 | I | manual | – | – | – | reps | bodyweight | 2nd+ | manual | latest actual logged load | per evidence | advisory copy | YES | carry-forward; explicit 0 carries |
| 31 | A | manual (default) | — as rows 22–30 (advanced manual behaves as I/manual) | | | | | | | | | | | |
| 32 | A | auto | — as rows 9–21 | | | | | | | | | | | |
| 33 | E | manual (default) | — as advanced | | | | | | | | | | | |
| 34 | E | auto | — as intermediate | | | | | | | | | | | |
| 35 | any non-B | any | – | – | ✓ 0 | reps | external | 1st | per source | 0.0 (history) | – | `Last logged 0.0 kg` | YES | explicit-zero history ≠ missing |
| 36 | any | any | – | – | – | reps | **unknown implement** (absent/empty/non-canonical prefixes) | 1st | per evidence, treated as external | blank when seeded | – | external labels/copy | NO until valid entry | §2.4 fail-toward-blank |
| 37 | any | any | – | – | – | reps | external | any | any | athlete-edited value | – | source line unchanged (§2.3) | per grid | rerender/hydration never overwrites |
| 38 | any | any | – | – | – | reps | external | 1st | any | `1`, `1.25`, `61`, `500.1`, `-2.5`, `-0`, `0x1F`, `NaN`, `Infinity`, `1e2`, `2.5.5` typed | – | range/increment validation copy | NO | off-grid/out-of-range/non-decimal syntax rejected; draft kept; `logSet` never called |
| 39 | any | any | – | – | – | reps | external | 1st | any | `0`, `0.0`, `2.5`, `2,5`, `60`, `500` typed | – | – | YES | exact parsed value reaches `logSet` without rounding, snapping, or clamping |
| 40 | any non-B | auto | ✗ | ✓ 100 | ✗ | reps, **nullable target RPE** | external | 1st | derived | targetLoadKg with the fixed fallback RPE | – | 1RM copy | YES | display and init use the same fallback (§2.6); Actual-RPE changes do not alter it |

Matrix notes: row 3 pins the beginner law (APRE + 1RM + history all present → `history`). Rows 13–15 pin the timed law including the APRE absolute exception. Rows 16–17 pin invalid-APRE fail-through. Rows 19–21 and 27–28 pin D1-A. Row 26 pins the corrected manual bodyweight identity zero. Row 36 pins unknown-implement blank. Rows 38–39 pin the canonical grid/range validation.

---

## 8. Semantic locators and component-test scenarios

Stable locators (testID unless noted):

- Onboarding: `onboarding-loads-step` (container), `onboarding-loads-auto`, `onboarding-loads-manual`, `onboarding-summary-loads-row` (Text).
- Profile: `profile-load-selection-row`, `profile-load-pref-auto`, `profile-load-pref-manual`, `profile-load-pref-hint`; the TRAINING AGE row reuses the existing `ChipRow` with a disabled state — no new shared-primitive API beyond a screen-local extension.
- Session: `session-load-input` (TextInput), `session-load-decrease`, `session-load-increase`, `session-load-source-line`, `session-load-validation` (rendered only when invalid), `session-load-hint` (blank-entry hint), existing `Log set {N} for {movement}` accessibility label for the button.

### 8.1 Real resolver evidence in component tests (Opus P2-1 — canonical)

The Session mock store's `resolveSlotLoad` adapter **must call the real exported `resolveLoadSelection`**. It may gather store inputs and select the highest-`set_id` current-session set; it must not reimplement precedence, honesty checks, advisory rules, timed/beginner/bodyweight rules, or numeric validation. A regression case must show negative, NaN, and infinite APRE values falling through exactly as production does.

The persistence testing section must require **executable SQLite round-trip/isolation evidence** (the `node:sqlite` verification database already applies all 35 migrations): active-slot upsert, hydration LEFT JOIN returning valid persisted `auto` for advanced/elite, manual round-trip, missing-row fallback to tier default, per-slot isolation on switch, explicit same-as-default survival, and beginner-manual/active-session rejection through the production path. Source-string matching alone is not behavioral evidence.

### 8.2 Component-test scenarios

**OnboardingScreen:**
1. Beginner path: `onboarding-loads-step` never renders; summary shows the corrected beginner loads row (§3f).
2. Intermediate: `onboarding-loads-auto` selected by default; pressing manual flips selection; `completeOnboarding` receives `manual`.
3. Advanced/elite: `onboarding-loads-manual` selected by default.
4. Independent transition cases per §4.1 — explicit preservation, non-explicit re-default, enter-beginner force/hide, leave-beginner defaults, explicit same-as-default survival. No test may prove re-derivation with an explicitly chosen value.

**ProfileScreen:**
5. Intermediate with `auto`: auto chip selected; pressing `profile-load-pref-manual` calls the save action with `manual`.
6. Beginner profile: `profile-load-selection-row` absent.
7. Active session: LOAD SELECTION chips disabled with active-session hint; pressing either does not call save.
8. Active session: TRAINING AGE chips all disabled with the load-authority hint; pressing does not call `saveProfile`.
9. Tier change to beginner (no session): row disappears; store returns beginner + forced auto.

**SessionScreen:**
10. Seeded external: input `""`, placeholder `—`, seeded copy, LOG SET disabled. Type `0` → enabled; `logSet` receives `0`. Type garbage → §3b range/increment validation copy, LOG disabled, draft kept.
11. Blank is not zero: fresh seeded render logs nothing; `logSet` never receives `0` unless the athlete typed it.
12. History auto: input `60.0`, history copy, LOG enabled. Explicit-zero history: input `0.0`, enabled, distinct from seeded.
13. Derived 1RM (non-beginner auto): input = `targetLoadKg` output, 1RM copy.
14. APRE precedence: `overrideLoadKg` + 1RM present → input is the override, `Prescribed …` copy.
15. Timed + APRE → derived accepted; timed + 1RM only → no derivation (history when present, else seeded with the timed seeded copy).
16. Manual with advisory: input blank, advisory line present, LOG disabled until entry; the advisory value never appears in `session-load-input` (all three advisory kinds).
17. Manual bodyweight first set: input `0.0`, LOG enabled at zero; advisory remains supporting only.
18. Manual carry-forward: log set 1 at 50 → set 2 initializes `50.0`; the latest set is selected by highest `set_id`, not array order; source stays manual.
19. Beginner never derives: beginner + 1RM + APRE + history → history (row 3); beginner + APRE + timed → seeded (row 7).
20. Bodyweight 1RM carve-out (D1-A): auto + bodyweight + reps + 1RM only → seeded identity zero (or history when present); manual + bodyweight + 1RM only → no 1RM advisory; bodyweight + valid APRE → derived in non-beginner auto.
21. Unknown implement (`supportedPrefixes: []`): external label, blank first exposure, LOG SET disabled until explicit valid entry.
22. Grid/range validation: `1` and `61` render validation and never call `logSet`; `500.1` is rejected rather than becoming 500; `-2.5`, `-0`, `0x1F`, `NaN`, `Infinity`, `1e2`, and `2.5.5` retain the draft and never call `logSet`; `0`, `0.0`, `2.5`, `2,5`, `60`, and `500` reach `logSet` as exactly `0`, `0`, `2.5`, `2.5`, `60`, and `500`.
23. Stable nullable-target-RPE provenance: display suggestion and initialized load come from the same resolver inputs; moving Actual RPE changes neither the copy nor the draft.
24. Rerender survival: type `47.5`, trigger rerender/evidence refresh/hydration — draft still `47.5`.
25. Invalid APRE regression: negative/NaN/infinite overrides fall through exactly as production does (via the real resolver, §8.1).

**Persistence (executable, §8.1):**
26. Sidecar round-trip and per-slot isolation on switch; missing/malformed rows fail to the tier default; explicit same-as-default survives restart and later non-beginner transitions; reset-training-data preserves preference.

---

## 9. Theme, primitives, and zero-hex confirmation

Confirmed. Every element composes from existing frozen primitives (`Chip`, `PrimaryButton`, Stepper-style ± pattern as standalone `Pressable`s per `OneRmRow`) and `TextInput` styled from existing screen-local styles. All colors, fonts, spacing, radii, and touch targets come from `theme` tokens — `textHi/textMid/textLow/ink0/ink1/line`, `font.eyebrow/label/body/title`, `space[]`, `radius.control/chip`, `touch.min/log`. Chalk is used nowhere new. No shared primitive is edited; no theme token is added or changed; no new dependency; no raw hex appears in any touched screen; no aesthetic redesign beyond the functional load-selection surfaces. The screen-local direct-entry composition is the authorized exception to stepper-only entry.

---

## 10. Amendment record

### 10.1 Corrections accepted before implementation (execution authorization, folded in)

| # | Correction | Where applied |
|---|---|---|
| 5.1 | Strict decimal parsing replaces `Number.parseFloat` — superseded original text (§0 of the handback): *"logging converts draft text → `number \| null` via `Number.parseFloat(text.replace(',', '.'))`"* | §2.1 |
| 5.2 | Honest onboarding promise — supersedes *"You can change this any time in the ATHLETE tab."* | §3e |
| 5.3 | Correct beginner summary — supersedes *"LOADS — your coach sets these, starting from what you log"* | §3f |
| 5.4 | Manual bodyweight identity load initializes `0.0`, loggable, source stays manual — supersedes original matrix row 20 (manual bodyweight blank, LOG NO) | §6, matrix rows 26–28 |
| 5.5 | No fifth source after editing | §2.3 |
| 5.6 | Timed targets and APRE: timed 1RM derivation forbidden; absolute APRE eligible for non-beginner auto; beginner ignores APRE; timed seeded copy refers to controlling the load for the full interval | §6, §3a, matrix rows 7, 13–15 |
| 5.7 | Independent transition cases, including explicit same-as-default | §4.1 |
| 5.8 | Manual current-session carry-forward: actual load, source stays manual, latest by highest `set_id` | §2.7 |

### 10.2 Post-Opus corrections and Francis's ratified decisions (folded in)

| # | Correction | Where applied |
|---|---|---|
| 6.1 (P1-1) | Active-session TRAINING AGE disabled + hint; store rejects active-session tier patches that would mutate the preference tuple; not all Profile fields frozen | §5.1 |
| 6.2 (P1-2) | Canonical grid/range validation: 0–500 inclusive, exact 2.5 kg increments, reject-don't-snap, exact value to `logSet`, canonical validation copy — supersedes the original generic *"Enter a number, 0 or more."* | §2.2, §3b, §3d, matrix rows 38–39 |
| 6.3 (P2-1) | Component mocks must delegate to the real `resolveLoadSelection`; persistence evidence must be executable SQLite, not source strings; invalid-APRE regression case | §8.1, §8.2 #25–26 |
| 6.4 (P2-2) | Unknown implement fails toward blank external-load behavior | §2.4, matrix row 36, §8.2 #21 |
| 6.5 (P2-3) | **D1-A ratified:** bodyweight 1RM carve-out retained — no operative or advisory added-load derivation from movement 1RM on bodyweight movements; APRE, history, manual, carry, and identity zero remain | §2.5, matrix rows 19–21, 27–28 |
| 6.6 (P2-4) | One stable target RPE for display and initialization; Actual RPE never recalculates provenance | §2.6, matrix row 40, §8.2 #23 |
| 6.7 (P2-5) | Truthful migration-test wording: 034→035 proves creation/seeding; preservation of an explicit update is proven by the replay check; labels state exactly which property each sequence proves | verification map note below |
| 6.8 (P2-6) | **D2-A ratified:** preserve the genuine Kimi handback — this canonical document cites the source task/attachment, identifies every folded correction, and backdates nothing | §1, §10 |

**Verification-map note (6.7):** the migration gate's 034→035 sequence proves table creation and tier-derived seeding; the separate replay sequence proves an explicit post-035 update survives `INSERT OR IGNORE`; poison/self-heal, CHECK, FK, and cascade tests remain independent. No migration SQL change is prescribed.

### 10.3 Final evidence reconciliation

- **GPT-5.6 Sol via Hermes, 2026-08-08:** distinguished the attachment's 215 logical lines from its 214 newline bytes and absent final newline; synchronized matrix rows 38–39 and scenario 22 with the executable direct-entry boundary cases.

---

## 11. Remaining blockers

`none`.

The original handback's five open items are resolved: the direct-entry composition was authorized by the execution authorization (original blocker 1); store action naming and the `completeOnboarding` signature were executor-owned and are settled at implementation HEAD (blocker 2); manual mode renders one supporting line (blocker 3); ± buttons are disabled on blank (blocker 4); and no law conflicts exist (blocker 5). Sections 5 and 6 of `KIMI_SPECIFICATION_AGENT.md` close every wording question this specification raised.
