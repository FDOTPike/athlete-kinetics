# WO-02 onboarding clarity handover — 2026-09-12

## Status

- `IMPLEMENTED_NOT_DEVICE_TESTED`
- Frozen base: `2af3adc398bd959a3fef8bfaa8f5003785867470`
- Branch: `codex/ac-wo02-onboarding`
- Offline/deterministic architecture: unchanged. No schema, store, engine, math, field-name, migration, dependency, or network change.

## Implemented

- Replaced athlete-facing “fat loss” copy with “weight loss” while retaining the persisted/API objective token `weight_loss`.
- Replaced the weekly-ceiling paragraph with the exact approved supportive copy.
- Added an onboarding-local choice-row treatment for experience, equipment presets, and custom equipment. Choices stack vertically, labels/descriptions wrap, selection and information are distinct accessible actions, and both use the existing 56-unit touch-target contract.
- Added offline glossary explanations for every experience/equipment information action. The shared `Chip` and `KeyboardAwareScrollView` components were not changed.
- Rebuilt Ready into spaced, scrollable `GOAL`, `EXPERIENCE`, `YOUR WEEK`, `EQUIPMENT`, and `TRAINING SUPPORT` sections. Every rendered section has a tested edit route back to its source field; the local draft remains intact.
- Labelled directly athlete-reported RPE as “Effort” and displayed the exact explanation: “How hard did that feel? 1 is very easy. 10 is your hardest effort.” Technical stored names and effort math remain unchanged.
- Retained RIR as the strength-set question “How many more clean reps could you have completed?” and retained its existing pure RIR-to-RPE conversion only for rep-based work. Timed work still receives no RIR conversion.
- Corrected beginner review copy to match the existing load law: the athlete chooses the first weight and later sessions start from logged history.

## Explicit dispositions

- `EXISTING ACTIVITIES` is not rendered in Ready because this onboarding flow has no activity-capture field and the WO-05 shared activity contract is proposed but not ratified. A placeholder with an edit action would imply a capture path that does not exist. Add the section only when the ratified capture field lands.
- Routine-template planned-target RPE terminology remains technical and is paired with offline InfoTips; WO-02 changes the default label for athlete-reported RPE, not stored/prescribed engine vocabulary.
- No `IRR` label exists in the scoped source/tests. The only case-insensitive text hit is the substring in “MIRRORS”.

## Test evidence

- Red-first onboarding run: 4 intended WO-02 failures, 38 pre-existing focused passes.
- Red-first effort run: 1 intended WO-02 failure; 99 tests skipped by the focused name filter.
- Mutation: changed `WEIGHT-LOSS SUPPORT` back to `FAT-LOSS SUPPORT`; the exact-copy test failed. Restored `OnboardingScreen.tsx` byte-identically (SHA-256 before/after `EC7749D565C6A9A2AA8A8798C40CA27F348590F36A5C7FF2F5028075EBA25B47`) and the test passed.
- Focused onboarding/session suites: 2 suites, 142 tests passed before the final five edit-route cases were added.
- Focused WO-02 onboarding cases after final additions: 9 passed.
- Glossary/learning/keyboard suites: 3 suites, 19 tests passed.
- `verify:blocks`: passed, including the exact `Weight-loss support` inference label and unchanged RIR mapping gates.
- Full `verify:components`: 27 suites, 464 tests passed.
- Final `npm run typecheck`: passed.
- Final `git diff --check`: passed.
- `npm run verify:ci`: stopped at its preflight before product gates because this isolated checkout has no local `node_modules` marker and lacks the pinned embedder cache/device outputs (7 preflight failures). No network bootstrap was authorized. The same checkout can resolve ordinary dependencies through the parent installation, which is why typecheck and component tests run; `verify:ci` intentionally requires checkout-local offline assets.

## Untested and deferred

- No device/emulator run: narrow-width wrapping, enlarged text, screen-reader focus order, modal announcement, keyboard occlusion, and physical touch targets remain device-untested.
- No activity capture/summary section until WO-05 is ratified and implemented.
- No clinical or training-policy changes were made. Experience-dependent volume/symptom policy remains at the owner/clinical checkpoint (`SC-08`).
- No APK build, release evidence, push, merge, or release action was performed.
