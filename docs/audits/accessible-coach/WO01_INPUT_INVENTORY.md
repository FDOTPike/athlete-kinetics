# WO-01 editable-input inventory and keyboard evidence

Date: 2026-09-12 (Australia/Sydney)

Scope: frozen base `87624d9e43189ddd87db317e24d4379ef5a13fae`, Android and iOS React Native app. This inventory counts 21 static `TextInput` call sites. Mapped inputs such as one-rep maxes, band labels, athlete renames, and routine slots can render more than one native field.

## Shared keyboard contract

All vertically scrolling form surfaces use `KeyboardAwareScrollView`. It deliberately does not add a second `KeyboardAvoidingView`; the app shell remains the single avoiding layer. The reusable scroll surface:

- uses `keyboardShouldPersistTaps="handled"`, so a visible button, chip, or row handles the first tap while the keyboard is open;
- uses interactive iOS or on-drag Android keyboard dismissal;
- retains 128 px of scroll runway after the form content without replacing each screen's existing safe-area/content padding;
- records the focused native target and calls `scrollResponderScrollNativeHandleToKeyboard(target, 128, true)` after focus and again after the platform keyboard-show event;
- retains the last focused target across keyboard close/reopen so reopening can restore caret clearance.

Nested horizontal filter lists and the routine picker list share the tap-persistence constant. The virtualized library list shares both tap-persistence and keyboard-dismiss behavior.

## Editable fields

| Surface | Editable field / call site | Keyboard | State and save/validation behavior | Keyboard-safe integration |
|---|---|---|---|---|
| Onboarding | Your name | Default text | Controlled local draft; committed only by completion/demo action | Shared vertical scroll |
| Onboarding | Past injuries | Multiline text | Controlled local draft; parsed and committed on completion; explicit “No” intentionally clears it | Shared vertical scroll + 128 px runway |
| Onboarding | Mobility limits | Multiline text | Controlled local draft; parsed and committed on completion; explicit “No” intentionally clears it | Shared vertical scroll + 128 px runway |
| Athlete profile | One-rep max (mapped: squat, bench, deadlift, OHP when movement exists) | Numeric | Controlled local draft; valid end-edit commits to store, invalid/sub-20 intentionally clears | Shared vertical scroll |
| Athlete profile | Historical injuries | Multiline text | Controlled draft and saved to profile on every change | Shared vertical scroll + 128 px runway |
| Athlete profile | Mobility limits | Multiline text | Controlled draft and saved to profile on every change | Shared vertical scroll + 128 px runway |
| Athlete profile | Band label (one per ladder row) | Default text | Native draft; commits on end-edit | Shared vertical scroll |
| Athlete profile | Bodyweight today | Numeric | Controlled draft; valid end-edit saves measurement, blank/invalid intentionally clears today's manual value | Shared vertical scroll |
| Athlete profile | AK history import | Multiline text | Controlled draft; preview validation precedes explicit import | Shared vertical scroll + 128 px runway |
| Athlete profile | Athlete rename (one per editing row) | Default text, autofocus | Controlled draft; explicit Save commits, Cancel intentionally discards | Shared vertical scroll; autofocus triggers focus-scroll |
| Athlete profile | New athlete name | Default text | Controlled draft; Add commits and then intentionally clears | Shared vertical scroll |
| Program setup | Review date | Default text (`YYYY-MM-DD`) | Controlled draft; required only for date horizon and passed through program validation/save | Shared vertical scroll |
| Coach / block | Body-feeling report | Multiline text | Controlled draft; Apply awaits deterministic local triage, then clears only after completion | Shared vertical scroll + 128 px runway |
| Session | Load in kilograms / added load | Numeric | Controlled draft; invalid text remains visible with validation and cannot log; valid text reaches set logging | Shared vertical scroll |
| Movement library | Movement search | Default text | Controlled ephemeral search; clear/reset is explicit | Virtualized-list shared tap/dismiss contract; field is in list header |
| Glossary | Glossary search | Default text | Controlled ephemeral search; clear is explicit | Shared vertical scroll; nested category row preserves first taps |
| Routine builder | Template name | Default text | Controlled draft; explicit Save commits | Shared vertical scroll |
| Routine builder | Sets (per selected slot) | Number pad | Controlled slot draft; parsed and validated by routine update/save path | Shared vertical scroll |
| Routine builder | Reps (per selected slot) | Number pad | Controlled slot draft; parsed and validated by routine update/save path | Shared vertical scroll |
| Routine builder | Target/max RPE (per selected slot) | Decimal pad | Controlled slot draft; cap validation remains visible and blocks invalid save | Shared vertical scroll |
| Routine movement picker modal | Movement search | Default text | Controlled picker-local search; closes with picker | Modal search remains at top; nested virtualized picker preserves first row/chip tap and drag dismissal |

No editable `TextInput` was found outside the allowed product-file list. The library compatibility export (`LibraryScreen.tsx`) contains no field of its own.

## Reproduction and automated observations

| Observation | Status | Evidence |
|---|---|---|
| Pre-change injury/limitations path had no focused-input scroll contract | FAIL (pre-change component structure) | Red focused run: wrapper testID absent on Onboarding/Profile/Session/Routine; new component module absent. The limitations fields were low in a plain `ScrollView`, while the shell only supplied iOS keyboard padding. This is structural/component evidence, not native keyboard evidence. |
| First control tap while keyboard is open | PASS (component contract) | `KeyboardLayout.test.js` asserts `handled`; mutation to `never` failed the test. Nested filter/picker containers use the same constant. |
| Focus target scroll and clearance | PASS (component contract) | Helper test asserts native responder call `(target, extraHeight, true)`; mutation of clearance to zero failed. |
| Sufficient multiline scroll runway | PASS (component contract) | Spacer is asserted at 128 px; mutation to zero failed. |
| Onboarding limitation text survives back/forward navigation | PASS (component interaction) | `ProfileScreens.test.js` types both multiline fields, navigates back and forward, and observes both drafts unchanged. |
| Profile multiline and numeric entry survive editing/validation | PASS (component interaction) | `ProfileScreens.test.js` observes the controlled multiline draft and a valid 142.5 kg numeric draft, then verifies the store commit. |
| Session numeric logging draft survives rerender | PASS (component interaction) | Existing `SessionScreen.test.js` scenario retains athlete-authored `32.5` after refreshed history evidence; wrapper and numeric keyboard are asserted. |
| Search and custom-routine entry paths | PASS (component interaction) | Library search, glossary search, routine picker search, template name, sets, reps, RPE, and save scenarios pass. |

Component tests establish render/state contracts only. They do not establish native soft-keyboard geometry.

## Native device/emulator matrix

Discovery on 2026-09-12: `adb devices -l` returned no attached devices. `emulator -list-avds` could not run because `emulator` was not available on PATH. No iOS simulator/device tooling was available on this Windows host.

| Platform / scenario | Status | Observation |
|---|---|---|
| Android small-screen portrait, rotation locked, limitations multiline | UNVERIFIED | No attached device/emulator |
| Android landscape, limitations multiline | UNVERIFIED | No attached device/emulator |
| Android font scale 1.30, limitations multiline | UNVERIFIED | No attached device/emulator |
| Android numeric keyboard, profile and session | UNVERIFIED | No attached device/emulator |
| Android keyboard open/close/reopen and first control tap | UNVERIFIED | No attached device/emulator |
| iOS portrait/landscape/large text, multiline and numeric | UNVERIFIED | No iOS device/simulator available; no iOS verification claimed |

## Integration device update — 2026-09-12

The earlier discovery result above is retained as append-only history. Integration subsequently provisioned `Codex_Pixel_9_Pro_API_35` (`emulator-5554`), Android 35, with `MemTotal: 4013940 kB`, a 1080 × 2400 override at 480 dpi (360 dp), and font scale 1.30.

| Platform / scenario | Integration status | Observation |
|---|---|---|
| Android small-screen portrait, rotation locked, name and limitations multiline | PASS | With the IME shown, the name and past-injury fields were fully visible at `[48,1101][1032,1260]`; footer Next was fully visible at `[755,1299][1044,1467]`. |
| Android first control tap with keyboard open | PASS | One tap on Next advanced from name to goal and dismissed the IME; no dismissal-only first tap was required. The same one-tap transition advanced limitations to review. |
| Android font scale 1.30 onboarding choices | PASS in exercised flow | Experience and equipment cards wrapped complete text vertically. Each independent information control measured 168 px = 56 dp at 480 dpi and opened its matching explanation without changing the selection. |
| Android step transition scroll reset | PASS | Limits reopened at its heading after the longer equipment page; the prior scroll offset no longer clipped the next step's title. |
| Android landscape multiline | PASS for in-app entry context | Initial device evidence exposed Gboard's separate full-screen extract editor. `7f4c8c0` adds `disableFullscreenUI` to all 21 static product inputs. The rebuilt APK kept the focused injury field and app context on screen in landscape with the IME shown. |
| Android rotation/edit retention | PASS in exercised flow | `knee:oldACL` remained in the controlled draft across portrait-to-landscape rotation. Existing component coverage separately proves onboarding back/forward retention. |
| Android numeric keyboards across Profile, Session, and Routine Builder | UNVERIFIED ON DEVICE | Keyboard types and shared source contract are component/source tested; these separate journeys were not exercised in this integration window. |
| Android TalkBack focus/announcement order | UNVERIFIED | No assistive-technology session was run. |
| iOS portrait/landscape/large text, multiline and numeric | UNVERIFIED | No iOS device/simulator was available on this Windows host. |

Selected raw evidence is outside the repository at `C:\Users\fpike\AppData\Local\Temp\accessible-coach-20260912`. The exact product candidate at `7f4c8c0446c7b14433225675dd92646b723e899e` passed `verify:qa-candidate`; its SHA-256 was `0152cf8a1ab7aec2297afa0e014d4a3e8f132ce007cc5bf4ca0d9b103fdd33b0` before the final documentation-only closeout commit. The final artifact is rebuilt and reported separately so its provenance remains exact.

Native acceptance remains required before release. Suggested rerun order is limitations multiline in small portrait, keyboard back/reopen, first tap on Next; repeat at font scale 1.30 and landscape; then profile 1RM/bodyweight, session load, library/glossary search filters, routine modal search and Save.
