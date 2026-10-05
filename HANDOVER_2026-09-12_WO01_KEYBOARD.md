# WO-01 keyboard accessibility handover

Date: 2026-09-12 (Australia/Sydney)
Branch: `codex/ac-wo01-keyboard`
Frozen base: `87624d9e43189ddd87db317e24d4379ef5a13fae`

## Shipped scope

- Inventoried all 21 static editable-input call sites (including mapped/dynamic families) in `docs/audits/accessible-coach/WO01_INPUT_INVENTORY.md`.
- Added one reusable `KeyboardAwareScrollView` contract. The shell remains the sole `KeyboardAvoidingView`; there is no nested offset conflict.
- Added 128 px of additive scroll runway and native focused-target scrolling on focus and keyboard show/reopen.
- Standardized `keyboardShouldPersistTaps="handled"` and platform drag dismissal across form scroll surfaces, the virtualized library, nested filter rows, and the routine picker list.
- Integrated onboarding, profile, program setup, coach/body report, live session, glossary, and routine builder. Library search retains its virtualized `SectionList` and consumes the shared list constants.
- Preserved the existing controlled/local/store state paths. No schema, persistence contract, engine, inference, network, or native-project changes.

## Verification

- Red-first focused run: expected failure, 5 suites failed / 159 tests passed. Missing shared module/wrappers and missing library dismiss behavior were observed before product edits.
- `npm run typecheck`: PASS (run during implementation and again before the final candidate).
- Focused keyboard/representative screens: PASS, 8 suites / 227 tests.
- `npm run verify:components`: PASS, 27 suites / 454 tests.
- `npm run verify:ci`: PASS on the single frozen final-candidate run. Preflight, typecheck, and all 22 repository gates completed with exit 0; component tail was 27 suites / 454 tests.
- `git diff --check`: PASS.
- Repository bootstrap: `npm ci` PASS; initial sandboxed `fetch:embedder` failed with network `EACCES`, then the approved rerun downloaded and byte-verified the pinned revision successfully.
- Non-failing diagnostics: existing Jest module-resolver notices and React animation `act(...)` warnings remained visible. No gate treated them as failures.

## Mutation evidence

The focused contract suite was watched fail under each mutation:

1. `keyboardShouldPersistTaps`: `handled` → `never`; test failed with expected `handled`, received `never`.
2. Focus clearance: native responder argument `extraScrollHeight` → `0`; test failed with expected `128`, received `0`.
3. Scroll runway: spacer height `extraScrollHeight` → `0`; test failed with expected `128`, received `0`.

The component was restored byte-identically after every mutation. SHA-256 before and after: `9893862813820E9BA0A9E558E61001C1FF5FCFAD4FD29CCA5679C9DE539E2D2A`.

## Device evidence and limitations

`adb devices -l` returned no device. The Android `emulator` executable was not available on PATH. This Windows host had no iOS simulator/device route. Therefore portrait, landscape, font scale 1.30, native multiline/numeric keyboard geometry, and native open/close/reopen behavior are all honestly marked **UNVERIFIED** in the inventory. No iOS verification is claimed. Component evidence is not presented as native keyboard evidence.

Release acceptance still requires the native matrix in the inventory. In particular, verify the limitations multiline caret plus Next button in small portrait, landscape, and font scale 1.30, then numeric profile/session fields and the modal/search first-tap behavior.

## Changed paths

Product:

- `apps/mobile/src/components/KeyboardAwareScrollView.tsx` (new)
- `apps/mobile/src/components/RoutineTemplateBuilder.tsx`
- `apps/mobile/src/screens/BlockScreen.tsx`
- `apps/mobile/src/screens/GlossaryScreen.tsx`
- `apps/mobile/src/screens/LibraryScreenV2.tsx`
- `apps/mobile/src/screens/OnboardingScreen.tsx`
- `apps/mobile/src/screens/ProfileScreen.tsx`
- `apps/mobile/src/screens/ProgramSetupScreen.tsx`
- `apps/mobile/src/screens/SessionScreen.tsx`

Tests/evidence:

- `apps/mobile/test/components/KeyboardLayout.test.js` (new)
- `apps/mobile/test/components/FocusScreens.test.js`
- `apps/mobile/test/components/Glossary.test.js`
- `apps/mobile/test/components/LibraryScreen.test.js`
- `apps/mobile/test/components/ProfileScreens.test.js`
- `apps/mobile/test/components/ProgramSetupScreen.test.js`
- `apps/mobile/test/components/RoutineTemplateBuilder.test.js`
- `apps/mobile/test/components/SessionScreen.test.js`
- `docs/audits/accessible-coach/WO01_INPUT_INVENTORY.md` (new)
- `HANDOVER_2026-09-12_WO01_KEYBOARD.md` (new)

`App.tsx` was inspected but did not require a change. `PROMPT_LEDGER.md` was not touched; ledger ownership remains with the orchestrator.

## Judgment calls for orchestrator review

- **FOR REVIEW:** 128 px is a conservative fixed scroll clearance, independent of screen font scaling. It is component-verified but must be confirmed on the supported native device matrix.
- **FOR REVIEW:** `handled` preserves the first tap for the app's Pressable/Chip/button controls while allowing unhandled background taps to dismiss. Mutation coverage pins this behavior.
- **FOR REVIEW:** last focused target remains recorded across keyboard hide so a keyboard reopen can reapply clearance even if native focus never changed.

## Francis checklist

- [x] Every current editable field inventoried.
- [x] Reusable, non-nested keyboard-safe pattern integrated.
- [x] Multiline/numeric/search/routine/state-retention component paths covered.
- [x] First-tap, focus-clearance, and extra-space mutations killed and restored byte-identically.
- [x] Full repository CI gate passed once at the frozen code candidate.
- [ ] Android small portrait / landscape / font scale 1.30 native keyboard evidence.
- [ ] Android multiline/numeric open-close-reopen and first-control-tap evidence.
- [ ] iOS device/simulator evidence.

## MASTER LEDGER ENTRY

### Input G(x)

WO-01 from `WORK_ORDERS_2026-09-12_ACCESSIBLE_COACH.md`, implemented on isolated branch `codex/ac-wo01-keyboard` from frozen base `87624d9e43189ddd87db317e24d4379ef5a13fae`. Exact ownership was limited to the named mobile screens/component, their matching component suites, one focused keyboard-layout suite, the input inventory, and this handover. Required constraints: zero-cloud/offline runtime, deterministic engines untouched, strict TypeScript, no schema/migration/native/package changes, one reusable keyboard-safe pattern, no nested conflicting offsets, no swallowed first tap, honest separation of component versus native evidence, and no `PROMPT_LEDGER.md` edit.

### Output F(G(x))

Implemented an additive scroll-and-focus contract around every vertically scrolling editable form, with shared tap/dismiss constants for virtualized and nested lists. The contract adds one inert 128 px spacer, remembers one numeric native target, schedules native focus scrolling on focus and keyboard show, and registers one keyboard-show subscription while a covered screen is mounted. Existing controlled draft/save/validation logic remains unchanged. Automated evidence covers onboarding back/forward drafts, profile multiline and numeric commit, session numeric rerender retention, program date validation, coach report reachability, library/glossary search, and routine name/dose/search/save. Three mutations failed and the source returned to the identical SHA-256. Full `verify:ci` passed. Native Android/iOS geometry remains unverified because no device/emulator was available.

RAM delta: one small React wrapper instance, two refs, one keyboard subscription, and one inert `View` on the active form screen; no dataset/model/cache growth and no new long-lived collection.
Latency delta: one `requestAnimationFrame` focus-scroll call, repeated once after keyboard show; no network or inference work.
Constraint delta: none to persistence, database, prescriptions, progression, biometrics, memory ceilings, or offline behavior.
Authorization state: committed locally only; nothing pushed, merged, rebased, tagged, signed, built for release, or released.

PUSH / MERGE / RELEASE: NOT AUTHORIZED
