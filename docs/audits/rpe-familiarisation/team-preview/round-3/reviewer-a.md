# Team Preview Audit Report — Round 3: Reviewer A (Product & Data Correctness)

**Work Order:** `docs/WORKORDER_RPE_RIR_FAMILIARISATION.md`
**Authoritative User Request:** `ORIGINAL_REQUEST.md` (Round 3 Remediation, lines 149–236)
**Auditor:** Reviewer A (Product & Data Correctness / Adversarial Review) — Round 3
**Date:** 2026-09-04T00:30:00+10:00
**Worktree:** `C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\rpe-familiarisation`
**Branch:** `codex/rpe-familiarisation`

---

## 1. Audited Candidate Identification

- **Candidate Product Freeze 3 Commit SHA:** `70481144700c16cc8f19400dfa3d46f7d2ab80b1`
- **Candidate Product Freeze 3 Tree SHA:** `fdb29f0f108131f6b574883d21bf3ee8a016a19d`
- **Prior Product Freeze 2 (Under Remediation):** `71ccc027275b080a42fea0ad67aff1e38d913740` (Tree `7e12cfe16fae28135e940735b5292062c790480e`)
- **Required Product Ancestor:** `e15bbe9301fe756ecda9d8296877b19e425ac112`
- **Base Commit SHA (W0):** `f8a0033717962f3492ff38e54681b20d54f82868`

*Note: In accordance with Round 3 governance rules, no verdict or approval from Round 1 or Round 2 has been carried forward. This review is conducted in a completely fresh, isolated context.*

---

## 2. Review Scope & Assessment Focus

This audit evaluates the Product and Data Correctness of Candidate Product Freeze 3 against the Opus Independent Audit (`OPUS_INDEPENDENT_AUDIT.md`) and the Authoritative User Request:

1. **F-01 Remediation Evaluation:** Confirm the direct numeric RPE entry stepper in `SessionScreen.tsx` opens from a target-independent state (`—`), computes its first adjustment from a target-independent neutral base (`8.0`), and does NOT reference `currentSlot.targetRpe`.
2. **F-02 Remediation Evaluation:** Confirm `verify_blocks.mjs` WAVE gate directly constrains the canonical live `UNDULATING` definition from `glossary.ts`, and the dead/shadowed literal at `InfoTip.tsx:44` is deleted under owner authorization path (a).
3. **Null Semantics:** Verify that an untouched stepper still logs null; selecting `Not sure` produces null; and unanswered rep sets persist null in both session runner state and durable `set_record` persistence.
4. **Absence of Target Copying:** Confirm target RPE remains visible as prescription guidance only, and is never preselected, confirmed, or copied into actual RPE.
5. **Pure RIR Mapping Boundary:** Verify exact mapping (`0` -> 10.0, `1` -> 9.0, `2` -> 8.0, `3` -> 7.0, `4+` -> 6.0; `Not sure` / invalid -> null).
6. **Set Resets:** Verify that effort state resets to unanswered strictly and only upon set identity change (`activeSetKey`).
7. **Rest Fallback Separation:** Verify that athlete actual RPE determines rest timer countdown when provided; falls back to target RPE (or 8) if null, while persisted database evidence strictly remains null.
8. **Timed-Work Behavior:** Verify that timed/non-rep work does not present an RIR conversion or question.
9. **Coach/Autopilot Evidence Boundaries:** Verify that only athlete-confirmed non-null values reach coach/autopilot evidence.
10. **Integrity & Adversarial Verification:** Actively inspect for hardcoded test cheats, facades, shortcuts, fabricated verification artifacts, or unhandled failure modes.

---

## 3. Executive Verdict

### **APPROVE**

**Verdict Rationale:**
- **Zero P0, P1, or P2 findings.**
- **F-01 is completely and cleanly remediated:** `draftRpe` state has been excised from `SessionScreen.tsx`. The direct RPE stepper opens displaying `—`, computes increments/decrements from neutral `8.0`, and does not reference `currentSlot.targetRpe` in its display, step base, or action handlers.
- **F-02 is completely and cleanly remediated:** Under explicit owner authorization, `packages/inference/test/verify_blocks.mjs` was repointed to read canonical live `apps/mobile/src/data/glossary.ts` directly for `UNDULATING`, and the dead literal at `InfoTip.tsx:44` was deleted.
- **Null semantics, unanchored effort, and evidence boundaries are rigorously maintained:** All null handling contracts, target separation rules, rest timer calculations, and coach aggregation gates are verified by inspection and green tests.
- **All independent verification commands exit 0:** `build:inference-test`, `verify_effort_cues.mjs`, `typecheck`, `verify:blocks`, `verify:components` (20 suites / 272 tests), `verify:ci` (all 22 sub-gates), and `git diff --check` passed cleanly.
- **Zero integrity violations:** No hardcoded mocks, shortcuts, facades, or test-bypassing logic exist in the changeset.

---

## 4. Remediation & Focus Area Audits

### 4.1 F-01 Remediation: Unanchored Direct Numeric RPE Stepper

#### Code Analysis (`apps/mobile/src/screens/SessionScreen.tsx`)
1. **Excision of Anchored State:**
   - In prior Candidate Freeze 2, `draftRpe` was declared as `useState<number>(8)` and seeded in the set-change effect with `setDraftRpe(currentSlot?.targetRpe ?? 8)`.
   - In Candidate Freeze 3 (`70481144700c16cc8f19400dfa3d46f7d2ab80b1`), `draftRpe` has been **completely deleted** (lines 272–275, 386–394).
2. **Target-Independent Opening State:**
   - `directRpe` initializes to `null`.
   - In `SessionScreen.tsx:993`:
     ```tsx
     value={directRpe !== null ? directRpe.toFixed(1) : '—'}
     ```
     When opened, before the athlete acts, `directRpe` is `null`, so the displayed value is `'—'`. The stepper's accessibility label resolves to `"Actual RPE —"`, never the prescribed target RPE.
3. **Target-Independent Step Computation:**
   - In `SessionScreen.tsx:994–1005`:
     ```tsx
     onDecrement={() => {
       const base = directRpe ?? 8.0;
       const next = clamp(base - 0.5, 5, 10);
       setDirectRpe(next);
       setSelectedChoice(null);
     }}
     onIncrement={() => {
       const base = directRpe ?? 8.0;
       const next = clamp(base + 0.5, 5, 10);
       setDirectRpe(next);
       setSelectedChoice(null);
     }}
     ```
   - If untouched (`directRpe === null`), increment computes from `8.0`: `clamp(8.0 + 0.5, 5, 10) = 8.5`.
   - If untouched (`directRpe === null`), decrement computes from `8.0`: `clamp(8.0 - 0.5, 5, 10) = 7.5`.
   - In direct chips selection (`SessionScreen.tsx:1008–1026`), tapping a chip assigns `val` to `directRpe` and clears `selectedChoice`.
   - **`currentSlot.targetRpe` does not appear anywhere in the direct RPE block.**

#### Test Evidence (`apps/mobile/test/components/SessionScreen.test.js`)
- `F-01 falsifier 1` (lines 592–606): Given `targetRpe: 6.5`, opening direct entry verifies that `"Actual RPE 6.5"` is `null` and `"Actual RPE —"` is on screen.
- `F-01 falsifier 2` (lines 608–630): Given `targetRpe: 6.5`, clicking increment verifies that `"Actual RPE 7.0"` (target + 0.5) is `null`, `"Actual RPE 8.5"` (8.0 + 0.5) is on screen, and logging persists `8.5`.
- Phone-width vertical stack layout assertion at line 168 was cleanly updated to `['current-rpe-stepper', 'Actual RPE', 'Actual RPE —', '—']` with all layout styling checks intact.

---

### 4.2 F-02 Remediation: WAVE Gate & Dead Literal Deletion

#### Code Analysis
1. **Dead Literal Deletion (`apps/mobile/src/components/InfoTip.tsx`):**
   - The static literal `WAVE: 'Load oscillates across weeks within a block, reducing accumulated fatigue while sustaining intensity.'` previously located at `InfoTip.tsx:44` has been **deleted**.
   - `GLOSSARY` in `InfoTip.tsx` now derives cleanly from `GLOSSARY_ENTRIES` (plus the legacy `'MACRO-CYCLE'` fallback).
2. **WAVE Gate Repointing (`packages/inference/test/verify_blocks.mjs`):**
   - Lines 555–562:
     ```javascript
     const glossarySrc = readFileSync(
       join(import.meta.dirname, '..', '..', '..', 'apps', 'mobile', 'src', 'data', 'glossary.ts'),
       'utf-8',
     );
     const waveMatch = glossarySrc.match(/id:\s*['"]UNDULATING['"][\s\S]*?definition:\s*\n?\s*['"]([^'"]+)['"]/i);
     const waveCopy = (waveMatch ?? [])[1] ?? '';
     check('WAVE tip exists and makes no "rises past" claim the block never delivers',
       waveCopy.length > 0 && !/past where it was|past its former|rises past/i.test(waveCopy),
       waveCopy.slice(0, 70));
     ```
   - The test reads `apps/mobile/src/data/glossary.ts` directly.
   - It captures the definition of entry `UNDULATING` (`'Reps and effort trade off across the block, with a shorter, harder middle week between two longer, easier ones.'`).
   - It verifies that `waveCopy.length > 0` and that no "rises past" phrasing is present.
3. **Owner Authorization:**
   - Explicit owner authorization to modify `packages/inference/test/verify_blocks.mjs` under path (a) was verified in `ORIGINAL_REQUEST.md` line 187.
4. **Adversarial Gate Falsification:**
   - Testing an adversarial string with `"Load rises past former level"` against the gate regex confirms that the condition `!/past where it was|past its former|rises past/i.test(...)` evaluates to `false`, guaranteeing that the gate is actively constraining and non-vacuous.

---

### 4.3 Null Semantics & Absence of Target Copying

1. **Untouched State Persists Null:**
   - In `SessionScreen.tsx:359–363`:
     ```typescript
     const safeRpe: number | null = selectedChoice !== null
       ? mapRirToRpe(selectedChoice)
       : directRpe !== null
         ? clamp(Math.round(directRpe * 2) / 2, 5, 10)
         : null;
     ```
   - When untouched, `selectedChoice === null` and `directRpe === null`, yielding `safeRpe = null`.
   - Logging passes `safeRpe` directly to `logSet(...)`.
   - Tested by `untouched actual RPE logs null instead of fabricating target equality` (line 401) and `§7.2 Item 3` (line 467).
2. **`Not sure` Produces Null:**
   - Selecting `Not sure` sets `selectedChoice = 'Not sure'`.
   - `mapRirToRpe('Not sure')` returns `null`.
   - Logging passes `null` to `logSet(...)`.
   - Tested by `§7.2 Item 4` (line 479).
3. **Absence of Target Copying & Confirmation:**
   - Target RPE is displayed only as informational guidance: `Target {targetText(slot)} · RPE {slot.targetRpe.toFixed(1)}` (`SessionScreen.tsx:813`).
   - No `Confirm target RPE` chip or button exists in the DOM (verified by `§7.2 Item 2`, line 458).
   - Target RPE is never used as default or preselected value for actual RPE.

---

### 4.4 Pure RIR Mapping Boundary

- `packages/inference/src/effortCues.ts` defines `mapRirToRpe` as a pure, side-effect-free function:
  | Input | Output RPE | Meaning |
  |---|---|---|
  | `'0'` | `10.0` | No more clean reps |
  | `'1'` | `9.0` | About one clean rep left |
  | `'2'` | `8.0` | About two clean reps left |
  | `'3'` | `7.0` | About three clean reps left |
  | `'4+'` | `6.0` | At least four clean reps left |
  | `'Not sure'` | `null` | Athlete cannot give reliable answer |
  | Any other value / out-of-domain | `null` | Strict fail-safe |
- Verified via `packages/inference/test/verify_effort_cues.mjs` and parameterized Jest test `§7.2 Item 5` in `SessionScreen.test.js`.

---

### 4.5 Set Resets

- In `SessionScreen.tsx:380–394`:
  ```typescript
  const runnerSetIndex = runner?.setIndex ?? 1;
  const runnerSlotCompleted = runner?.slotSetCounts?.[runner?.slotIndex ?? 0] ?? 0;
  const activeSetKey = currentSlot === null
    ? null
    : `${currentSlot.sessionPlanSlotId}:${currentLogged}:${runnerSetIndex}:${runnerSlotCompleted}:${currentMovement?.movement_id}`;

  useEffect(() => {
    if (activeSetKey === null) return;
    if (lastSetKeyRef.current !== activeSetKey) {
      lastSetKeyRef.current = activeSetKey;
      setSelectedChoice(null);
      setDirectRpe(null);
      setDirectEntryOpen(false);
    }
  }, [activeSetKey]);
  ```
- **Reset Invariant:** Effort states (`selectedChoice`, `directRpe`, `directEntryOpen`) reset if and only if `activeSetKey` changes.
- **Rerender Preservation:** If the component rerenders without advancing the set identity (e.g., preference hydration, store update, target RPE edit in plan), `lastSetKeyRef.current === activeSetKey`, and the athlete's in-progress selection is preserved.
- Verified by:
  - `§7.2 Item 6` (rerendering preserves selected answer).
  - `§7.2 Item 7` (advancing set resets answer to unanswered).
  - `§7.2 Item 8` (changing target RPE does not alter selected actual answer).

---

### 4.6 Rest Fallback Separation

- In `SessionScreen.tsx`:
  - **Countdown calculation:** Lines 367 and 610 compute rest duration using:
    ```typescript
    seconds: runner?.restSecondsTarget ?? restSecondsFor(safeRpe ?? currentSlot?.targetRpe ?? 8, profile.training_age)
    ```
    If `safeRpe` is non-null, athlete actual effort dictates rest. If `safeRpe` is null, it falls back to prescribed `targetRpe` (or default 8).
  - **Database Persistence:** Line 606 calls:
    ```typescript
    logSet(..., safeRpe, ...);
    ```
    Where `safeRpe` is strictly null when unanswered.
  - In `apps/mobile/src/state/useStore.ts:5604, 5648`:
    ```typescript
    ...(safeRpe === null ? {} : { actualRpe: safeRpe })
    // and
    INSERT INTO set_record (..., rpe, ...) VALUES (..., safeRpe, ...)
    ```
  - The rest countdown fallback calculation never leaks into `set_record` or runner events.

---

### 4.7 Timed-Work Behavior

- In `SessionScreen.tsx:927`:
  ```tsx
  {target?.kind !== 'time' && (
    <View style={styles.rirContainer} testID="rir-question-container">
      ...
    </View>
  )}
  ```
- When an exercise has a timed target (`target.kind === 'time'`), the RIR question ("How many more clean reps could you have completed?") and its associated chips are completely omitted.
- Verified by `§7.2 Item 10` in `SessionScreen.test.js:632`.

---

### 4.8 Coach & Autopilot Evidence Boundaries

- In `SessionScreen.tsx:1037–1040`:
  ```tsx
  <Text style={styles.rpeEvidence}>
    {safeRpe !== null
      ? 'This actual RPE will be used as Coach evidence.'
      : 'Unanswered RPE is left out of Coach evidence.'}
  </Text>
  ```
- In downstream analytics:
  - `packages/inference/src/e1rm.ts:75`:
    ```typescript
    export function estimateOneRepMax(loadKg: number, reps: number, rpe: number | null): number | null {
      if (rpe === null) return null;
      ...
    ```
    Sets logged without actual RPE return `null` and never fabricate an e1RM data point.
  - `packages/inference/src/autopilotProjection.ts:31–35`: `sumDeltaRpe` and `deltaCount` are aggregated strictly over sets with a non-null `rpe`.
- Null actual RPE is completely excluded from influencing future load and volume projections.

---

## 5. Adversarial Stress-Testing & Edge Cases

| Scenario / Hypothesis | Stress Test Method | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **Boundary Clamping on Direct Stepper** | Rapid decrement at scale minimum (5.0) or increment at maximum (10.0) | Values clamp strictly to `[5.0, 10.0]` half-steps | `clamp(base ± 0.5, 5, 10)` enforces bounds | **PASS** |
| **Mutual Exclusivity: RIR vs. Direct Entry** | Select RIR chip `'2'`, then tap direct stepper `+` | `selectedChoice` must be cleared so only `directRpe` is active | `setSelectedChoice(null)` executed in `onIncrement`/`onDecrement`/chip tap | **PASS** |
| **Mutual Exclusivity: Direct Entry vs. RIR** | Select direct RPE `8.5`, then tap RIR chip `'1'` | `directRpe` must be cleared so only RIR choice is active | `setDirectRpe(null)` executed in RIR chip `onPress` | **PASS** |
| **Deselection of Active Chips** | Tap already selected direct chip `8.0` | State resets to `null`, `safeRpe` becomes `null` | `setDirectRpe(null)` executed on re-tap | **PASS** |
| **Missing `targetRpe` in Plan Slot** | Slot with `targetRpe: null` / `undefined` opens direct stepper | Stepper still opens displaying `—` and steps from `8.0` | Stepper does not reference `currentSlot.targetRpe`; neutral base `8.0` used | **PASS** |
| **WAVE Regex Sensitivity** | Definition in `glossary.ts` formatted across newlines or with single/double quotes | Regex extracts definition without syntax error or false negative | Tested in Node environment with various quote/newline styles | **PASS** |
| **Integrity / Facade Check** | Search for mock bypasses or hardcoded test overrides in source files | Zero facade logic or hardcoded cheat values | Code inspection confirms real stateful React Native components and pure TypeScript modules | **PASS** |

---

## 6. Independent Verification Command Log

All commands were independently executed in Windows PowerShell using `npm.cmd` at Candidate Product Freeze 3:

| # | Command | Working Directory | Exit Code | Summary / Metrics |
|---|---|---|---|---|
| 1 | `npm.cmd run build:inference-test` | Repo root | **0** | Built 25 TypeScript source targets to `.build` |
| 2 | `node packages/inference/test/verify_effort_cues.mjs` | Repo root | **0** | 18/18 checks passed (cues, bands, stop guidance, RIR mapping) |
| 3 | `npm.cmd run verify:components -- apps/mobile/test/components/SessionScreen.test.js` | Repo root | **0** | 1 suite, 85/85 tests passed (including F-01 falsifiers 1 & 2) |
| 4 | `npm.cmd run typecheck` | Repo root | **0** | Clean TypeScript compilation (`tsconfig.json`) |
| 5 | `npm.cmd run verify:blocks` | Repo root | **0** | All block generator, ranking, and effort cue checks passed |
| 6 | `npm.cmd run verify:components` | Repo root | **0** | 20 suites passed, 272/272 tests passed (>= 270 threshold met) |
| 7 | `npm.cmd run verify:ci` | Repo root | **0** | All 22 CI gates passed cleanly |
| 8 | `git diff --check 71ccc027275b080a42fea0ad67aff1e38d913740 HEAD` | Repo root | **0** | Zero whitespace or formatting issues |

---

## 7. Scope & Line Count Verification

Comparing Candidate Product Freeze 3 (`70481144700c16cc8f19400dfa3d46f7d2ab80b1`) against Prior Product Freeze 2 (`71ccc027275b080a42fea0ad67aff1e38d913740`) in implementation and test directories (`apps/` and `packages/`):

```text
apps/mobile/src/components/InfoTip.tsx            |  1 -
apps/mobile/src/screens/SessionScreen.tsx         | 11 ++----
apps/mobile/test/components/SessionScreen.test.js | 42 ++++++++++++++++++++++-
packages/inference/test/verify_blocks.mjs         |  7 ++--
4 files changed, 48 insertions(+), 13 deletions(-)
```

- Zero unnecessary file modifications.
- Zero unauthorized changes to native code, migrations, database schema, or third-party dependencies.
- Tracked worktree is clean with respect to product code.

---

## 8. Conclusion

Candidate Product Freeze 3 (`70481144700c16cc8f19400dfa3d46f7d2ab80b1`, Tree `fdb29f0f108131f6b574883d21bf3ee8a016a19d`) comprehensively resolves findings F-01 and F-02 from the Opus Independent Audit with zero regressions, complete integrity, and flawless verification gate execution.

**Final Verdict: APPROVE**
