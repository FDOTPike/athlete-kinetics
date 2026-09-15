# Post-PR #19 Accessibility and D02 Rest-Policy Remediation Handover

This is implementation work, not independent approval. An independent audit is required. Nothing here is physical-device, screen-reader or C6 qualification.

## 1. Identity and Scope

- **Work order:** POST-PR19 ACCESSIBILITY AND D02 REST-POLICY REMEDIATION, recorded verbatim as PROMPT_LEDGER Entry 0135. That entry was the first tracked write.
- **Worktree and branch:** `.worktrees/post-pr19-a11y-rest-remediation` on `codex/post-pr19-a11y-rest-remediation`.
- **Start:** `origin/codex/rpe-familiarisation` at `4aa0f9c53684d3da151d50f8e90cb34c95256414` (tree `83d816f5cb2e1122603a44f466ce513c897b9e2b`), the PR #19 merge. The remote had not advanced, so there were no intervening commits.
- **Inputs:** the `.agents/**` audit leads were read as untrusted and were not copied, edited or staged. Their "RELEASE READY" wording is not accepted.
- **Not changed:**
  - backup code;
  - schemas and migrations (Migration 064 blob `69090f2`);
  - `react-native-safe-area-context`;
  - `package.json` and the lockfile;
  - native Android and iOS projects;
  - activity recommendations, WO-07 and WO-09, and animation;
  - clinical or medical claims.

## 2. Commits

| Commit | Finding | Summary |
|---|---|---|
| `9e15e01` | — | Entry 0135 prompt record |
| `5dfb572` | R5 | tier-neutral automatic rest, plus decision record |
| `6b6cebf` | R1 | movement picker as an accessibility modal |
| `8b588d2` | R2 | Activities nested hardware Back |
| `983d615` | R3 | radio-group semantics |
| `b1ade48` | R4 | truthful effort explanation |
| this commit | — | handover and Entry 0135 results |

## 3. Finding-by-Finding Disposition

### R1 — Movement-picker accessibility modal (reviewer REV-C-01): FIXED

**File:** `apps/mobile/src/components/RoutineTemplateBuilder.tsx`

- **Containment and escape:** the picker's overlay View (`movement-picker-dialog`) declares `accessibilityViewIsModal` and `onAccessibilityEscape={closePicker}`.
- **Initial focus:** `Modal onShow` moves accessibility focus to the "Choose Movement" heading, using the InfoTip `findNodeHandle` pattern. The heading is now `accessibilityRole="header"`.
- **Retained behaviour:** Android `onRequestClose` is kept. The search field is not auto-focused, and no keyboard is forced open. Selection, filtering and dismissal are unchanged; the full builder suite passes 21/21.
- **Tests** (`RoutineTemplateBuilder.test.js`): containment, escape, initial focus and Android close.
  - React Native's jest `Text` is a mock class component, so `findNodeHandle` cannot resolve a tag there. A disposable probe confirmed this. The focus test therefore mocks `RendererProxy.findNodeHandle` to resolve only the heading instance to a tag.
  - The Android close test passed before the fix, because `onRequestClose` already existed. It is a retention guard; mutant R1-e shows it detects removal.
- **Limit:** these tests exercise the React Native contract only. A real TalkBack or VoiceOver session was not exercised.

### R2 — Activities nested Back (reviewer REV-C-02): FIXED, with a required navigation change

**Files:** `apps/mobile/src/screens/ActivitiesScreen.tsx`, `apps/mobile/src/navigation/navigation.tsx`

**Activities behaviour:**
- Android Back first closes an open completion view, then the entry form. Only a later Back, handled by the Profile host, leaves Activities.
- Hardware Back keeps the in-memory draft. A kept entry draft reopens for a new entry, or for the same weekly schedule being edited. Typed actual minutes and effort reopen for the same planned occurrence. Both visible Cancel actions still clear.

**Required change to `useSubViewBack`:**
- Previously the hook re-registered its handler on every render, and `goBack` runs the newest handler first. When the Profile host re-rendered, React ran its effect after Activities' effect, so Profile's "close Activities" handler became newest and Back skipped the open form.
- The hook now registers once per activation and calls the latest handler through a ref. `registerSubViewBack` has a stable identity. The public contract is unchanged.

**Tests:**
- The tests capture the hardware Back listener `NavigationProvider` registers, so they run through the real registration path.
- `ActivitiesScreen.test.js`: two tests. One covers form Back, draft reopen and explicit Cancel clearing. The other covers completion-before-form order and completion-draft reopen and Cancel.
- `ProfileScreens.test.js`: the Profile-hosted order test, including a host re-render.
- `BackNavigation.test.js` test d: parent and nested sub-views.

**Red evidence:**
- Before any fix, both Activities tests and the Profile test failed.
- With only the Activities change applied, the Profile test still failed: Back left Activities.
- Test d failed on the pre-fix navigation file and passes on the fix. The fixed file was restored byte-identical by SHA-256.
- An earlier sibling-only version of test d passed before the fix. It was replaced because it did not reproduce the defect.

### R3 — Radio-group semantics (reviewer REV-C-03): FIXED

**File:** `apps/mobile/src/components/HealthTrainingSupportForm.tsx`

- **Groups:** each actual set of radios is wrapped in its own View with `accessibilityRole="radiogroup"` and a plain label: "Position preference", "Position changes", "Rest needs" and "Note type".
- **Kept outside:** detail fields and Save buttons stay outside the groups. No section is itself a radiogroup.
- **Preserved:** each radio keeps its role, label, checked state and press behaviour.
- **Tests** (`HealthTrainingSupportForm.test.js`, new):
  - group roles, labels and exact radio contents;
  - no buttons or text inputs inside a group;
  - exactly these four radiogroups in the tree, and every radio inside one;
  - checked state and press-to-save behaviour preserved.

### R4 — Truthful RPE explanation (reviewer REV-C-04): FIXED, copy only

**File:** `apps/mobile/src/screens/SessionScreen.tsx`

- **Copy:** "How hard did that feel? The full effort scale runs from 1 (very easy) to 10 (your hardest effort). Direct working-set entry runs from 5 to 10."
- **Direct entry, unchanged:** optional; 5.0 to 10.0 in 0.5 steps; no target default; unanswered and "Not sure" stay null.
- **Tests:**
  - The existing WO-02 copy assertion now expects the new sentence.
  - A new R4 test covers the copy, the chips (exactly 5.0 to 10.0), the stepper stopping at 5.0 and 10.0, clearing back to unanswered, and null logging.

### R5 — Tier-based rest (reviewer REV-B-01, D02 handover §8): CLOSED BY OWNER RULING

**Files:** `packages/inference/src/sessionRunner.ts`, `packages/inference/test/verify_runner.mjs`, `apps/mobile/src/screens/SessionScreen.tsx`, `docs/decisions/REST_DURATION_TIER_NEUTRAL_2026-09-15.md`

**Runner:**
- `restSecondsFor` uses only the RPE bands: 240, 180, 120 or 90 seconds, snapped to 15-second steps within 45–300.
- Unchanged: tier validation, actual-RPE precedence, the null-actual target fallback, explicit overrides and checkpoint version 1.

**Required scope details:**
1. `SessionScreen.tsx` had its own tier-scaled local rest fallback, used when no runner owns the timer. It now uses the same tier-neutral bands. Without this, tier would still change rest.
2. Restoring a runner checkpoint requires the stored rest to equal the computed rest. A checkpoint saved mid-rest by the current build for a beginner or elite athlete would otherwise be rejected after upgrade.
   - A restored checkpoint with no override may keep the pre-ruling tier-scaled value it was already counting down.
   - The next rest is tier-neutral, and every other value is still rejected.
   - The pre-ruling multipliers remain in the file only for this check.

**Expectation changes, not weakening:** two existing `verify_runner` assertions pinned tier-scaled rest: beginner 180 / elite 300 / beginner 75, and "beginner rest must be shorter". They now pin the ruling.

**New counterfactual checks:**
- All four tiers across 12 RPE values in every band, for target, actual-precedence and null-actual inputs.
- Live logged-set rests and overrides.
- Checkpoint compatibility, with an intermediate control and an override control.
- The SessionScreen fallback is identical for every tier and equals the runner's value.

## 4. Changed Paths (against `4aa0f9c`)

- `M` `PROMPT_LEDGER.md`
- `M` `apps/mobile/src/components/HealthTrainingSupportForm.tsx`
- `M` `apps/mobile/src/components/RoutineTemplateBuilder.tsx`
- `M` `apps/mobile/src/navigation/navigation.tsx`
- `M` `apps/mobile/src/screens/ActivitiesScreen.tsx`
- `M` `apps/mobile/src/screens/SessionScreen.tsx`
- `M` `apps/mobile/test/components/ActivitiesScreen.test.js`
- `M` `apps/mobile/test/components/BackNavigation.test.js`
- `A` `apps/mobile/test/components/HealthTrainingSupportForm.test.js`
- `M` `apps/mobile/test/components/ProfileScreens.test.js`
- `M` `apps/mobile/test/components/RoutineTemplateBuilder.test.js`
- `M` `apps/mobile/test/components/SessionScreen.test.js`
- `A` `docs/decisions/REST_DURATION_TIER_NEUTRAL_2026-09-15.md`
- `M` `packages/inference/src/sessionRunner.ts`
- `M` `packages/inference/test/verify_runner.mjs`
- `A` `HANDOVER_2026-09-15_POST_PR19_A11Y_REST_REMEDIATION.md` (this commit; `PROMPT_LEDGER.md` also gains the Entry 0135 results)

## 5. Mutation Evidence

The run used `mutate_r1_r5.cjs` on the clean committed tree `b1ade48`.
- Unmutated controls ran first.
- Each mutant edited one tracked source file and ran the focused gate.
- It passed only if the named test failed. For the runner, that meant the named check did not print PASS and no TypeScript compile error occurred.
- Each file was then restored and checked against its pristine SHA-256.

| Mutant | Broken behaviour | File | Detected by | Result |
|---|---|---|---|---|
| R1-a | picker content no longer declared an accessibility modal | `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | R1 containment: the picker content is declared an accessibility modal around the card and its heading | detected, restored (exit 1) |
| R1-b | screen-reader escape handler removed | `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | R1 escape: the screen-reader escape action closes the picker without selecting and resets its search | detected, restored (exit 1) |
| R1-c | initial focus on show removed | `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | R1 initial focus: on show, accessibility focus moves to the picker heading and the search field is not focused | detected, restored (exit 1) |
| R1-d | search field auto-focused (keyboard forced open) | `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | R1 initial focus: on show, accessibility focus moves to the picker heading and the search field is not focused | detected, restored (exit 1) |
| R1-e | Android onRequestClose removed | `apps/mobile/src/components/RoutineTemplateBuilder.tsx` | R1 Android close: the system back request closes the picker and resets its search | detected, restored (exit 1) |
| R2-a | Activities registers no sub-view Back handler | `apps/mobile/src/screens/ActivitiesScreen.tsx` | R2 hardware Back closes the entry form without clearing its draft, and explicit Cancel still clears it; R2 hardware Back closes an open completion view before the entry form and keeps its typed minutes for that entry | detected, restored (exit 1) |
| R2-b | Back closes the entry form before an open completion view | `apps/mobile/src/screens/ActivitiesScreen.tsx` | R2 hardware Back closes an open completion view before the entry form and keeps its typed minutes for that entry | detected, restored (exit 1) |
| R2-c | hardware Back discards the entry draft | `apps/mobile/src/screens/ActivitiesScreen.tsx` | R2 hardware Back closes the entry form without clearing its draft, and explicit Cancel still clears it | detected, restored (exit 1) |
| R2-d | explicit Cancel no longer clears the entry draft | `apps/mobile/src/screens/ActivitiesScreen.tsx` | R2 hardware Back closes the entry form without clearing its draft, and explicit Cancel still clears it | detected, restored (exit 1) |
| R2-e | hardware Back discards typed completion minutes | `apps/mobile/src/screens/ActivitiesScreen.tsx` | R2 hardware Back closes an open completion view before the entry form and keeps its typed minutes for that entry | detected, restored (exit 1) |
| R2-f | useSubViewBack re-registers on every render (Profile host takes Back priority) | `apps/mobile/src/navigation/navigation.tsx` | R2 inside Profile, hardware Back closes Activities completion, then the entry form, keeps both drafts, and only then leaves Activities | detected, restored (exit 1) |
| R3-a | preference options lose the radiogroup role | `apps/mobile/src/components/HealthTrainingSupportForm.tsx` | R3 each set of radio options is its own labelled radiogroup that contains only those radios | detected, restored (exit 1) |
| R3-b | preference radiogroup loses its label | `apps/mobile/src/components/HealthTrainingSupportForm.tsx` | R3 each set of radio options is its own labelled radiogroup that contains only those radios | detected, restored (exit 1) |
| R3-c | note type options lose the radiogroup role | `apps/mobile/src/components/HealthTrainingSupportForm.tsx` | R3 each set of radio options is its own labelled radiogroup that contains only those radios | detected, restored (exit 1) |
| R3-d | whole support section marked as a radiogroup | `apps/mobile/src/components/HealthTrainingSupportForm.tsx` | R3 each set of radio options is its own labelled radiogroup that contains only those radios | detected, restored (exit 1) |
| R3-e | grouped radio press no longer saves the preference | `apps/mobile/src/components/HealthTrainingSupportForm.tsx` | R3 grouping preserves each radio role, checked state and press behavior | detected, restored (exit 1) |
| R4-a | effort explanation reverted to the untruthful copy | `apps/mobile/src/screens/SessionScreen.tsx` | R4 explains the 1-10 effort scale truthfully and keeps direct working-set entry optional and bounded to 5-10 | detected, restored (exit 1) |
| R4-b | direct entry broadened below 5.0 | `apps/mobile/src/screens/SessionScreen.tsx` | R4 explains the 1-10 effort scale truthfully and keeps direct working-set entry optional and bounded to 5-10 | detected, restored (exit 1) |
| R4-c | unanswered effort defaults from the target instead of null | `apps/mobile/src/screens/SessionScreen.tsx` | R4 explains the 1-10 effort scale truthfully and keeps direct working-set entry optional and bounded to 5-10 | detected, restored (exit 1) |
| R5-a | runner beginner rest multiplier 0.75 reintroduced | `packages/inference/src/sessionRunner.ts` | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:; actual: 180,; expected: 240, | detected, restored (exit 1) |
| R5-b | runner intermediate rest multiplier 1.25 reintroduced | `packages/inference/src/sessionRunner.ts` | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:; actual: 300,; expected: 240, | detected, restored (exit 1) |
| R5-c | runner advanced rest multiplier 1.25 reintroduced | `packages/inference/src/sessionRunner.ts` | AssertionError [ERR_ASSERTION]: R5 tier-only rest: target advanced RPE 0; actual: 120,; expected: 90, | detected, restored (exit 1) |
| R5-d | runner elite rest multiplier 1.25 reintroduced | `packages/inference/src/sessionRunner.ts` | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:; actual: 300,; expected: 240, | detected, restored (exit 1) |
| R5-e | pre-ruling mid-rest checkpoints rejected again | `packages/inference/src/sessionRunner.ts` | RunnerCheckpointError('resting state violates the rest prescription');; RunnerCheckpointError: resting state violates the rest prescription | detected, restored (exit 1) |
| R5-f | actual-RPE precedence over target lost | `packages/inference/src/sessionRunner.ts` | AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:; actual: 180,; expected: 90, | detected, restored (exit 1) |
| R5-g | app local rest fallback tier multiplier reintroduced | `apps/mobile/src/screens/SessionScreen.tsx` | R5 local rest fallback is identical for every tier and equals the runner rest for the same answer | detected, restored (exit 1) |

## 6. Commands and Results

| Tree | Command | Result |
|---|---|---|
| `4aa0f9c` + `9e15e01` | `npm ci`; minilm assets copied from a verified same-lineage worktree; `node scripts/verify-preflight.mjs` | exit 0; `PREFLIGHT OK` |
| `9e15e01` | `npm run typecheck` (before the Entry 0135 commit) | exit 0 |
| `9e15e01` + tests only (red first) | `npm run verify:runner` | exit 1 (`verify_runner.mjs:163`: beginner RPE 9 actual 180, expected 240) |
| same | `jest RoutineTemplateBuilder.test.js -t R1` | exit 1 (3 failed: no dialog, no `onShow`; Android close passed, pre-existing) |
| same | `jest ActivitiesScreen.test.js -t R2` | exit 1 (2 failed: first hardware Back returned false) |
| same | `jest ProfileScreens.test.js -t R2` | exit 1 (Back left Activities) |
| same | `jest HealthTrainingSupportForm.test.js` | exit 1 (2 failed: groups absent) |
| same | `jest SessionScreen.test.js -t "R4\|R5\|WO-02 labels"` | exit 1 (3 failed: old copy; beginner fallback 180, expected 240) |
| product fixes without navigation change | `jest ProfileScreens.test.js -t R2` | exit 1 (Profile host still took Back priority) |
| navigation file temporarily at HEAD | `jest BackNavigation.test.js -t "d)"` (nested form) | exit 1 (nested handler 0 calls); fixed file restored byte-identical |
| working tree before commits | typecheck; `verify:runner`; builder, Activities, Profile, support, SessionScreen, BackNavigation, Library/NavigationShell/FocusScreens suites | all exit 0 |
| each of C1-C5 | `npm run typecheck` before commit | exit 0 (5 of 5) |
| `b1ade48` (clean) | `node mutate_r1_r5.cjs --with-navigation` | exit 0; 26/26 detected, each file restored to its pristine SHA-256, tracked-worktree fingerprint `38c2278a94291781` unchanged; 7 unmutated controls passed first (exit 0) |
| `b1ade48` | `git diff --check 4aa0f9c HEAD` | exit 0, clean |
| `b1ade48` | `npm run typecheck` | exit 0 |
| `b1ade48` | `npm run verify:runner` | exit 0 (20 checks) |
| `b1ade48` | `npm run verify:components` | exit 0 (46 passed, 46 total; 718 passed, 718 total) |
| `b1ade48` | `npm run verify:ci` | exit 0 (PREFLIGHT OK; 46 passed, 46 total; 718 passed, 718 total) |

## 7. Tested, Untested and Deferred

**Tested by execution:** sections 3, 5 and 6.

**Untested:**
- Real TalkBack, VoiceOver or physical-device screen-reader behaviour.
- iOS.
- C6.
- Power-loss or process-death checkpoint restore on a device.

The QA APK, `verify:qa-candidate` and the Android emulator smoke check run after this commit and are reported in the pull request and handback, because no repository write follows the APK build.

**Deferred** (none was a gate failure):
- The `SafeAreaView` deprecation warning.
- React `act(...)` warnings in component tests.
- Monorepo module-resolution notices.
- Broad Jest and import cleanup.
- `react-native-safe-area-context` adoption.

MERGE: NOT PERFORMED. C6: NOT EVALUATED. RELEASE: NO-GO — PHYSICAL DEVICE / SCREEN-READER QUALIFICATION AND C6 REMAIN DEFERRED.
