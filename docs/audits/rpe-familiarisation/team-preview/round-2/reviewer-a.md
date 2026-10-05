# Team Preview Audit Report — Round 2: Reviewer A (Product & Data Correctness)

**Work Order:** `docs/WORKORDER_RPE_RIR_FAMILIARISATION.md`
**Auditor:** Reviewer A (Product & Data Correctness) — Round 2
**Date:** 2026-09-03T11:51:00Z
**Worktree:** `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation`
**Branch:** `codex/rpe-familiarisation`

---

## 1. Audited Candidate Identification

- **Base Commit SHA (W0):** `f8a0033717962f3492ff38e54681b20d54f82868`
- **Required Product Ancestor SHA:** `e15bbe9301fe756ecda9d8296877b19e425ac112`
- **Candidate Product Freeze 2 Commit SHA:** `71ccc027275b080a42fea0ad67aff1e38d913740`
  - **Product Freeze Tree SHA:** `7e12cfe16fae28135e940735b5292062c790480e`
- **Candidate Freeze Head 2 Commit SHA:** `cedb24b54335493b4e752ea86c9de2fb2dee74d5`
  - **Freeze Head Tree SHA:** `b5dd11b99321fad3e0632c0c5ccc9bbe5e072785`

---

## 2. Review Charter & Scope

Reviewer A conducts an independent, read-only audit of Candidate Freeze 2 in a fresh context, evaluating:
1. Candidate diff against base commit `f8a0033717962f3492ff38e54681b20d54f82868` and scope boundaries.
2. Null semantics: untouched effort logs null; selecting 'Not sure' logs null.
3. Absence of target copying: target RPE is visible for prescription but never preselected, confirmed, or defaulted into actual RPE; absence of `Confirm target RPE` chip.
4. Pure RIR mapping: choices '0', '1', '2', '3', '4+' map strictly to 10.0, 9.0, 8.0, 7.0, 6.0; 'Not sure' and invalid values map strictly to null.
5. Set identity resets: effort state resets to unanswered only when set identity changes (advancing set count or switching exercises), never on ordinary rerenders or target edits.
6. Rest fallback separation: athlete actual RPE determines rest timer; if null, rest timer falls back to target RPE while persisted evidence remains null.
7. Timed-work behavior: timed/non-rep sets omit RIR conversion while allowing unanchored direct numeric RPE.
8. Coach/autopilot evidence boundaries: only athlete-confirmed non-null actual RPE reaches Coach evidence.
9. Absence of regressions in bodyweight reps, load steppers, and guided session runner.
10. Independent execution of tests, verification gates, edge cases, and counterexamples.

---

## 3. Executive Verdict

### **APPROVE**

**Verdict Rationale:**
- **Zero P0, P1, or P2 findings.**
- All 10 review charter requirements are satisfied with rigorous code-level and execution-level evidence.
- The unauthorized path defect from Round 1 (`packages/inference/test/verify_blocks.mjs`, Finding F-01) has been completely remediated: `verify_blocks.mjs` was restored to its exact base version at `f8a0033717962f3492ff38e54681b20d54f82868`, and `InfoTip.tsx` now satisfies the static literal expectation without modifying any unauthorized files.
- Full verification gates (`verify:ci` across all 22 CI gates, `verify:components` across all 20 suites / 270 tests, `typecheck`, and `git diff --check`) pass cleanly with exit code 0.

---

## 4. Charter-by-Charter Audit Analysis & Verified Evidence

### 4.1 Scope Boundary and Diff Hygiene (Charter Item 1)
- **Observation:**
  Running `git diff --name-status f8a0033717962f3492ff38e54681b20d54f82868 71ccc027275b080a42fea0ad67aff1e38d913740` confirms that modified files match the authorized write set in §6 of the Work Order:
  - `PROMPT_LEDGER.md` (§6.1)
  - `apps/mobile/src/components/InfoTip.tsx` (§6.2)
  - `apps/mobile/src/components/RoutineTemplateBuilder.tsx` (§6.2)
  - `apps/mobile/src/data/glossary.ts` (§6.2, new canonical data module)
  - `apps/mobile/src/screens/GlossaryScreen.tsx` (§6.2, new glossary screen)
  - `apps/mobile/src/screens/ProfileScreen.tsx` (§6.2)
  - `apps/mobile/src/screens/SessionScreen.tsx` (§6.2)
  - `apps/mobile/test/components/Glossary.test.js` (§6.3, new focused test)
  - `apps/mobile/test/components/ProfileScreens.test.js` (§6.3)
  - `apps/mobile/test/components/SessionScreen.test.js` (§6.3)
  - `docs/audits/rpe-familiarisation/EXECUTOR_HANDOFF.md` (§6.1)
  - `packages/inference/src/effortCues.ts` (§6.2)
  - `packages/inference/src/index.ts` (§6.2)
  - `packages/inference/test/verify_effort_cues.mjs` (§6.3)
- **Remediation Verification:**
  `packages/inference/test/verify_blocks.mjs` is completely absent from the git diff against base.
- **Diff Hygiene:**
  `git diff --check f8a0033717962f3492ff38e54681b20d54f82868 HEAD` exited with code 0 (zero whitespace or formatting errors).

### 4.2 Null Semantics (Charter Item 2)
- **Observation:**
  - In `SessionScreen.tsx:273-276`, effort states initialize unanswered:
    ```typescript
    const [selectedChoice, setSelectedChoice] = useState<EffortAnswer | null>(null);
    const [directRpe, setDirectRpe] = useState<number | null>(null);
    ```
  - In `SessionScreen.tsx:360-364`, `safeRpe` derives:
    ```typescript
    const safeRpe: number | null = selectedChoice !== null
      ? mapRirToRpe(selectedChoice)
      : directRpe !== null
        ? clamp(Math.round(directRpe * 2) / 2, 5, 10)
        : null;
    ```
  - When untouched, `selectedChoice === null` and `directRpe === null` -> `safeRpe === null`.
  - When 'Not sure' is chosen, `mapRirToRpe('Not sure')` returns `null` -> `safeRpe === null`.
  - In `SessionScreen.tsx:608`, `logCurrent` calls `logSet(..., safeRpe, ...)`.
  - In `useStore.ts:5648`, `set_record` is inserted with `safeRpe` (`NULL`).
- **Verification Evidence:**
  - `apps/mobile/test/components/SessionScreen.test.js`:
    - `§7.2 Item 3: logging without an answer persists null actual RPE (pre-existing passing)` -> PASS
    - `§7.2 Item 4: selecting Not sure persists null actual RPE` -> PASS
    - `untouched actual RPE logs null instead of fabricating target equality` -> PASS
    - `untouched RPE stays null and shows its plain-language cue (PQ-13)` -> PASS

### 4.3 Absence of Target Copying (Charter Item 3)
- **Observation:**
  - Planned target RPE remains visible as prescription in `SessionScreen.tsx:815`:
    `<Text style={styles.targetLine}>Target {targetText(slot)}{slot.targetRpe === null ? '' : ` · RPE ${slot.targetRpe.toFixed(1)}`}</Text>`
  - The legacy confirmation chip (`Confirm target RPE ...`) and associated confirmation state have been excised.
  - Opening direct numeric entry (`Enter RPE directly`) sets `directEntryOpen = true`, but `directRpe` remains `null`.
  - Grep search for `Confirm target` across the repository confirmed zero occurrences in product source code.
- **Verification Evidence:**
  - `apps/mobile/test/components/SessionScreen.test.js`:
    - `§7.2 Item 2: absence of Confirm target RPE action and target is not preselected` -> PASS
    - `§7.2 Item 9: optional direct RPE entry supports half-step boundaries without initializing from target RPE` -> PASS

### 4.4 Pure RIR Mapping (Charter Item 4)
- **Observation:**
  - In `packages/inference/src/effortCues.ts:50-67`, `mapRirToRpe` is a pure function:
    - `'0'` -> `10.0`
    - `'1'` -> `9.0`
    - `'2'` -> `8.0`
    - `'3'` -> `7.0`
    - `'4+'` -> `6.0`
    - `'Not sure'` -> `null`
    - default (malformed, NaN, undefined, out-of-domain) -> `null`
  - Re-exported via `packages/inference/src/index.ts:97`.
- **Verification Evidence:**
  - `node packages/inference/test/verify_effort_cues.mjs` -> PASS
  - `SessionScreen.test.js`: `§7.2 Item 5: clean-reps-remaining choice %s maps to stored actual RPE %s` (all 5 branches) -> PASS

### 4.5 Set Identity Resets (Charter Item 5)
- **Observation:**
  - In `SessionScreen.tsx:383-396`:
    ```typescript
    const activeSetKey = currentSlot === null
      ? null
      : `${currentSlot.sessionPlanSlotId}:${currentLogged}:${runnerSetIndex}:${runnerSlotCompleted}:${currentMovement?.movement_id}`;

    useEffect(() => {
      if (activeSetKey === null) return;
      if (lastSetKeyRef.current !== activeSetKey) {
        lastSetKeyRef.current = activeSetKey;
        setSelectedChoice(null);
        setDirectRpe(null);
        setDraftRpe(currentSlot?.targetRpe ?? 8);
        setDirectEntryOpen(false);
      }
    }, [activeSetKey]);
    ```
  - Resets occur exclusively when set count advances or the movement/slot changes.
  - Re-renders (e.g. disclosure toggle, timer ticks) and plan target modifications do NOT alter `activeSetKey` and therefore do NOT reset selected effort.
- **Verification Evidence:**
  - `SessionScreen.test.js`:
    - `§7.2 Item 6: selecting an RIR answer, rerendering the same set, and logging preserves that selected answer` -> PASS
    - `§7.2 Item 7: advancing to the next set resets actual effort to unanswered` -> PASS
    - `§7.2 Item 8: changing the planned target does not silently change a selected actual answer` -> PASS

### 4.6 Rest Fallback Separation (Charter Item 6)
- **Observation:**
  - In `SessionScreen.tsx:612`, manual rest timer:
    `seconds: restSecondsFor(safeRpe ?? currentSlot.targetRpe ?? 8, profile.training_age)`
  - In `SessionScreen.tsx:368`, runner resting state:
    `seconds: runner?.restSecondsTarget ?? restSecondsFor(safeRpe ?? currentSlot?.targetRpe ?? 8, profile.training_age)`
  - In `useStore.ts:5604`:
    `LOG_SET` event passes `...(safeRpe === null ? {} : { actualRpe: safeRpe })`.
  - In `sessionRunner.ts:701`:
    `const actualRpe = event.actualRpe ?? slot.targetRpe;`
  - Rest timer falls back to planned target RPE when `safeRpe` is null.
  - Persisted database evidence in `set_record` receives `safeRpe` directly, persisting `NULL`.
- **Verification Evidence:**
  - `verify_runner.mjs` -> PASS
  - `SessionScreen.test.js` rest timer tests -> PASS

### 4.7 Timed-Work Behavior (Charter Item 7)
- **Observation:**
  - In `SessionScreen.tsx:929`:
    `{target?.kind !== 'time' && (` RIR Question Container ... `)}`
    Timed sets (`target.kind === 'time'`) completely omit RIR conversion and question text.
  - The direct numeric entry toggle (`Enter RPE directly`) remains accessible, permitting unanchored direct half-step RPE entry (`5.0–10.0`) without RIR conversion.
- **Verification Evidence:**
  - `SessionScreen.test.js`: `§7.2 Item 10: timed/non-rep work does not present an RIR conversion` -> PASS

### 4.8 Coach/Autopilot Evidence Boundaries (Charter Item 8)
- **Observation:**
  - In `useStore.ts:5648`, database write inserts `safeRpe` into `set_record.rpe`.
  - In `useStore.ts:5654`, `set_target` stores `target_rpe` distinctly.
  - In `packages/core-db/src/schema/001_mechanical_input.sql:173-174`, schema triggers compute `rpe_x_reps` and `reps_with_rpe` filtering strictly `WHERE rpe IS NOT NULL`.
  - Coach/autopilot queries consume actual RPE from `set_record.rpe`; null values are omitted from effort evidence.
- **Verification Evidence:**
  - `verify_store_sql.mjs` -> PASS
  - `verify_autopilot.mjs` -> PASS

### 4.9 Absence of Regressions in Core Mechanics (Charter Item 9)
- **Observation:**
  - Bodyweight actual-reps flow: verified intact (`SessionScreen.test.js: §7.2 Item 11`, `PQ-12`).
  - Load stepper and draft string validation: verified intact across valid loads (0, 2.5, 60, 500) and invalid/off-grid inputs.
  - Guided session runner: verified intact (`verify_runner.mjs`, `verify_outcomes.mjs`, and all guided mode tests in `SessionScreen.test.js`).
- **Verification Evidence:**
  - All 83 tests in `SessionScreen.test.js` passed.
  - All 20 suites / 270 tests in `verify:components` passed.

### 4.10 Independent Test Execution & Verification (Charter Item 10)

| Command Executed | Exit Code | Output / Result Summary |
|---|:---:|---|
| `git status` | 0 | Working tree clean, branch `codex/rpe-familiarisation` |
| `git diff --check f8a0033717962f3492ff38e54681b20d54f82868 HEAD` | 0 | Clean diff, zero whitespace errors |
| `node packages/inference/test/verify_effort_cues.mjs` | 0 | 17/17 checks PASS |
| `npm.cmd run verify:blocks` | 0 | All inference blocks and reverted `verify_blocks.mjs` PASS |
| `npx.cmd jest --config apps/mobile/jest.config.js apps/mobile/test/components/SessionScreen.test.js` | 0 | 1 suite, 83/83 tests PASS |
| `npx.cmd jest --config apps/mobile/jest.config.js apps/mobile/test/components/Glossary.test.js` | 0 | 1 suite, 6/6 tests PASS |
| `npx.cmd jest --config apps/mobile/jest.config.js apps/mobile/test/components/ProfileScreens.test.js` | 0 | 1 suite, 25/25 tests PASS |
| `npm.cmd run typecheck` | 0 | TypeScript check clean (0 errors) |
| `npm.cmd run verify:components` | 0 | 20 suites, 270/270 tests PASS |
| `node scripts/verify-preflight.mjs` | 0 | Offline preflight verified OK |
| `npm.cmd run verify:ci` | 0 | All 22 CI gates PASS clean |

---

## 5. Adversarial Challenge & Edge Case Assessment

1. **Mutual Reset of Direct vs RIR Selection:**
   - *Attack:* If an athlete selects RIR '2' (derived RPE 8.0) and then toggles direct entry and picks '8.5', could both answers conflict or produce double evidence?
   - *Result:* Inspected `SessionScreen.tsx:1001, 1025` and `955`. Selecting a direct chip calls `setSelectedChoice(null)`. Selecting an RIR chip calls `setDirectRpe(null)`. State transitions are mutually exclusive; `safeRpe` derives strictly from the active non-null selection.
2. **Deselection to Null:**
   - *Attack:* Can an athlete clear an accidental choice back to unanswered null before logging?
   - *Result:* Tapping an already-selected RIR chip sets `selectedChoice(null)`. Tapping an active direct half-step chip sets `directRpe(null)`. Both paths allow full revert to `null` prior to logging.
3. **Mid-Set Prescription Edits:**
   - *Attack:* If the background plan target changes while an athlete is mid-set, does it overwrite their selected actual effort?
   - *Result:* `activeSetKey` does not depend on `targetRpe`. Re-renders from plan adjustments leave athlete-selected actual effort intact (`SessionScreen.test.js: §7.2 Item 8` PASS).
4. **Integrity Violations Check:**
   - No hardcoded test fixtures in production code.
   - No facade or dummy implementations.
   - No shortcuts or bypassed logic.
   - All tests independently run and verified.

---

## 6. Findings Summary

| ID | Severity | File / Line Citation | Description | Resolution / Status |
|---|:---:|---|---|---|
| **OBS-01** | P3 | `SessionScreen.tsx:1530` | Inert stylesheet rule `rpeConfirmation: { ... }` remains from removed confirmation view. | Non-defective. Retained for stylesheet hygiene without functional impact. |

**Summary:** 0 P0, 0 P1, 0 P2 findings. 1 non-defective P3 observation.

---

## 7. Conclusion

Candidate Product Freeze 2 (`71ccc027275b080a42fea0ad67aff1e38d913740`, Tree `7e12cfe16fae28135e940735b5292062c790480e`) and Candidate Freeze Head 2 (`cedb24b54335493b4e752ea86c9de2fb2dee74d5`, Tree `b5dd11b99321fad3e0632c0c5ccc9bbe5e072785`) completely fulfill all technical, product, and data correctness requirements specified in `docs/WORKORDER_RPE_RIR_FAMILIARISATION.md`.

Final Verdict: **APPROVE**.
