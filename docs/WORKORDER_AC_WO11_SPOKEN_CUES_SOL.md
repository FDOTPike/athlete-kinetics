# Work order AC-WO11: read coaching cues aloud with the phone's own voice

Date: 2026-09-25
Status: **AUTHORIZED**. The owner (Francis) authorized Sol to run it on 2026-09-25 (ledger Entry 0173).
Assignee: GPT-5.6 Sol (Codex). Effort: **high**. The work is native toolchain debugging, and at medium effort Sol thrashes in retry loops (AGENT_WORKFLOW §11).
Reviewer: Fable at the final checkpoint.
Worktree: `.worktrees/ac-wo11-spoken-cues`
Branch: `codex/ac-wo11-spoken-cues`, created with no upstream.
Base: `origin/codex/rpe-familiarisation` @ `6c2fd709` (PR #20 merge).
PR target: `codex/rpe-familiarisation`. Never target `master`, which is a separate lineage.

---

## 1. Outcome

Put a small **Listen** control next to the coaching text. The athlete taps it and
the phone's built-in text-to-speech engine reads that text aloud. Tapping it again
stops the speech.

The app ships no audio files, calls no cloud service and adds no npm dependency.
The text to read already exists; this work order only adds the ability to speak it.

## 2. Ratified decisions (do not relitigate)

1. **Use the operating system's speech engine; ship no audio files.** Some cue
   text is chosen at runtime (for example, the triage `coaching_cue` on the halt
   card), so it cannot be pre-recorded.
2. **This work order covers Android only.** No runner and no owner machine can
   build iOS today (CI is `ubuntu-latest` only). The JS contract must work on any
   platform. On iOS the native module is absent, so the Listen control does not
   render. iOS gets its own work order once an iOS build path exists. Do not edit
   anything under `apps/mobile/ios/`.
3. **Zero-cloud still applies (AGENT_WORKFLOW §1.1).**
   - The production manifest keeps `INTERNET` removed.
   - Never request network synthesis.
   - Use only voices whose `isNetworkConnectionRequired()` is `false`.
   - If no offline English voice exists, report the engine as unavailable. Never
     fall back to a network voice.
4. **Memory (§1.3).** The speech engine runs in its own system process, for
   example `com.google.android.tts`, so it is not in the app's memory. On the app
   side:
   - Create the `TextToSpeech` instance lazily, on the first tap. Never create it
     at app start.
   - Shut it down when the app goes to the background.
   - Allow at most one instance.
5. **The UI freeze is lifted for this change only (§7).** The owner asked for the
   control. It may be added at the call sites in §4.3, with styling taken from
   existing theme tokens. It does not authorize restyling anything else.
6. **What is spoken is exactly what is displayed.** The engine reads the text on
   screen for that block. The only change is the pronunciation mapping in §4.2,
   which changes how a word is spoken, never what is shown.

## 3. Current code (verified at `6c2fd709`)

| Surface | Location | Text |
|---|---|---|
| Session, "How & why" disclosure | `apps/mobile/src/screens/SessionScreen.tsx:1205-1222` | `coachingIntent`, SET UP steps (`setup`, :745), CUES (`cues`, :746) |
| Session, halt card | `SessionScreen.tsx:775-790` | "Stop training for today." + `formatRunnerHaltReason(...)` |
| Library, movement detail | `apps/mobile/src/screens/LibraryScreenV2.tsx:307-322` | "Coaching Cues" (`selectedMovement.cues`), "Execution Instructions" (`selectedMovement.instructions`) |

Other facts:
- New Architecture is on (`newArchEnabled=true`).
- React Native is 0.81.6. `targetSdkVersion` is 36 and `minSdkVersion` is 26.
- `MainApplication.kt` registers manual packages in `getPackages()`.
- `backupCrypto.ts:6-17` shows how the repo already calls a Turbo module.
- The minimum touch target is `theme.touch.min` (56).

## 4. Build

### 4.1 Android native module
Put the Android code in `apps/mobile/android/app/src/main/java/com/athletekinetics/speech/`.

- **Module type.** Use a Turbo Native Module with a codegen spec at
  `apps/mobile/src/native/NativeSpeechCue.ts`, plus a `codegenConfig` block in
  `apps/mobile/package.json`. If codegen will not build on CI after two honest
  attempts, fall back to a legacy bridge module running through the interop
  layer. Flag the fallback in the checkpoint bundle.
- **Methods:**
  - `isAvailable(): Promise<boolean>`
  - `speak(text: string, utteranceId: string): Promise<void>`
  - `stop(): Promise<void>`
- **Events.** Emit `start`, `done`, `stopped` and `error` with the
  `utteranceId`, using `UtteranceProgressListener`.
- **Engine lifecycle:**
  - Initialize the engine on the first `isAvailable` or `speak` call and cache
    the init result.
  - Call `shutdown()` on host pause/destroy and on module invalidate.
  - Use `QUEUE_FLUSH`, so a new `speak` replaces the current one.
- **Language:**
  - All content is English. Prefer the device's own English variant, then
    `en-AU`, `en-GB` and `en-US`.
  - If `setLanguage` returns `LANG_MISSING_DATA` or `LANG_NOT_SUPPORTED`, report
    unavailable.
  - Choose a voice with `isNetworkConnectionRequired() == false`.
- **Long text.** Split anything over `getMaxSpeechInputLength()` at sentence
  boundaries and queue the chunks (`QUEUE_ADD` after the first). `stop` must
  cancel every chunk.
- **Audio focus and attributes:**
  - Use `USAGE_ASSISTANT` with `CONTENT_TYPE_SPEECH`. If a device test later
    shows it is silenced by a volume stream the athlete would not expect, record
    that in the handover rather than switching streams on a guess.
  - Request `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` so the athlete's music ducks and
    does not stop.
  - Abandon focus on `done`, `stopped` and `error`.
- **Manifest.** Add a `<queries>` element with `<intent><action
  android:name="android.intent.action.TTS_SERVICE" /></intent>`. Without it,
  Android 11+ package visibility hides the engine. Add no permission.
- **Registration.** Register the package in `MainApplication.getPackages()`.

### 4.2 JS layer
Put the JS layer in `apps/mobile/src/speech/`.

- **`spokenText.ts` (pure).** `toSpokenText(displayed: string): string`:
  - Strips list glyphs (`•`) and turns numbered prefixes into "Step N."
  - Applies a small, data-driven pronunciation table on **whole tokens only**:
    RPE → "R P E", RIR → "R I R", RDL → "Romanian deadlift", DB → "dumbbell",
    KB → "kettlebell", "e.g." → "for example".
  - Leaves unknown tokens untouched.
  - Does not rewrite numbers. Before adding any entry, grep the movement library
    and record which records it affects.
- **`speech.ts` (wrapper):**
  - The wrapper resolves the module with `TurboModuleRegistry.get` (not
    `getEnforcing`). If the module is absent, the engine is unavailable.
  - One active utterance app-wide. The wrapper exposes `speak(key, text)`,
    `stop()` and a subscription to the current `key` so exactly one control
    shows "Stop".
  - Errors do not throw into render. They resolve to the idle state.
- **`ListenButton.tsx`.** Put it in `apps/mobile/src/components/ui/`.
  - It renders nothing when the engine is unavailable.
  - Content is a speaker glyph plus the text "Listen", switching to "Stop"
    while speaking. Do not add an icon or SVG dependency; a text glyph is fine
    if it renders on Android's system font.
  - The touch target is at least `theme.touch.min`.
  - Set `accessibilityRole="button"`.
  - Give it a specific label, for example "Read the cues aloud" or "Stop
    reading", and expose `accessibilityState` for busy/selected.
- **Stop conditions.** Speech stops when:
  - the athlete taps the control again
  - the owning block unmounts, or the "How & why" disclosure closes
  - a set is logged
  - the athlete navigates away
  - the app goes to the background (AppState)

### 4.3 Call sites
| Location | Controls | Text each control speaks |
|---|---|---|
| Session "How & why" | One control for SET UP, one for CUES | SET UP: the numbered steps. CUES: the cue lines |
| Session halt card | One control | "Stop training for today." + the displayed halt reason |
| Library detail | One control for "Coaching Cues", one for "Execution Instructions" | Only the text shown in that section; never the "not yet recorded" placeholder, so hide the control when the text is empty |

`coachingIntent` is not spoken on its own. Add it to the SET UP control's text
only if that text is non-empty, and say in the bundle which way you chose.

## 5. Gates. Every gate must be watched failing once (§8.1).

1. **`spokenText` unit tests.** Cover every table entry; whole-token boundaries
   ("RPE" becomes "R P E", but "RPEX" and "ADB" are unchanged); glyph and
   numbering stripping; and identity on text with no mapped tokens.
2. **`ListenButton` tests.**
   - Hidden when the module is absent or `isAvailable` resolves false.
   - A tap calls `speak` with `toSpokenText(displayed)`.
   - A second tap calls `stop`.
   - Unmount calls `stop`.
   - Starting control B clears control A.
3. **Screen tests.** Extend `SessionScreen.test.js` and `LibraryScreen.test.js`
   (or `LibraryScreenV2` if that is the tested surface) with a mocked module:
   - The controls appear at every §4.3 call site.
   - The halt control speaks the halt reason.
   - Logging a set calls `stop`.
   - Empty library sections render no control.
4. **Offline and permission tripwire.** Add a jest contract test (a source-grep
   contract is acceptable under §3) that fails if any of the following happen:
   - the production `AndroidManifest.xml` declares `INTERNET` without
     `tools:node="remove"`
   - the manifest loses the `TTS_SERVICE` query
   - the Kotlin module references `KEY_FEATURE_NETWORK_SYNTHESIS` or
     `KEY_FEATURE_NETWORK_RETRIES_COUNT`
   - the Kotlin module stops filtering on `isNetworkConnectionRequired`
5. **Full suite.** Run `npm run typecheck`, then `npm run verify:ci`; it must
   exit 0.
6. **CI.** Both the `verify` and `android-apk` jobs (`assembleDebug` and
   `assembleQa`) must be green on the pushed branch. This is the only
   compile proof of the Kotlin and codegen, because the owner has no local
   Android toolchain.

For worktree setup, run `npm ci` then `npm run fetch:embedder` then `node
scripts/verify-preflight.mjs`. Never junction `node_modules` from another checkout.

## 6. Allowed files
- `apps/mobile/android/app/src/main/java/com/athletekinetics/speech/**` (new)
- `apps/mobile/android/app/src/main/java/com/athletekinetics/MainApplication.kt`
- `apps/mobile/android/app/src/main/AndroidManifest.xml`: the `<queries>` element only
- `apps/mobile/src/native/NativeSpeechCue.ts` (new)
- `apps/mobile/src/speech/**` (new)
- `apps/mobile/src/components/ui/ListenButton.tsx` (new) and `components/ui/index.ts`
- `apps/mobile/src/screens/SessionScreen.tsx` and `LibraryScreenV2.tsx`: call-site wiring only
- `apps/mobile/package.json`: the `codegenConfig` block only; no dependency changes, and the lockfile stays unchanged
- `apps/mobile/test/components/**` (new or extended tests)
- `PROMPT_LEDGER.md` (append only), `HANDOVER_2026-09-*_AC_WO11_SPOKEN_CUES.md`, and `DEVIATION_LOG.md` (append only, if you deviate)

Anything else is out of scope. If you need a file that is not listed, **STOP**
and flag it.

## 7. Out of scope
- iOS.
- A settings toggle, speech rate or voice picker.
- Auto-speaking cues without a tap.
- Speaking rest timers, set counts or anything that is not displayed coaching text.
- Changing cue or instruction content.
- Movement library migrations.
- Any engine or policy file.

## 8. STOP and escalate (do not work around these)
- Codegen and the interop fallback both fail on CI.
- The work needs a new npm or Gradle dependency.
- Any gate is red for a reason unrelated to this change on a clean base.
  Prove it on base `6c2fd709` first.
- Any §1 constraint would need to bend.

## 9. Git and publication (authorized)
- Commit on `codex/ac-wo11-spoken-cues` in small, logical commits. Each commit
  must be preceded by a green `npm run typecheck`.
- Push explicitly: `git push -u origin HEAD:codex/ac-wo11-spoken-cues`. A bare
  `git push` is prohibited.
- Open a **draft** PR against `codex/rpe-familiarisation`. **Do not merge. Do not
  enable auto-merge.**

## 10. Final checkpoint bundle (then STOP for Fable)
1. `git diff --stat 6c2fd709..HEAD` and a list of new files.
2. Gate output for §5 items 1–5, with the watched-failure evidence for items 1–4.
3. The CI run URL and conclusion for both jobs.
4. At most 20 lines of self-report: whether you used codegen or the fallback,
   any audio-focus behaviour you could not test, where `coachingIntent` went, the pronunciation entries
   with the records each one affects, and anything uncertain.
5. `HANDOVER_2026-09-<dd>_AC_WO11_SPOKEN_CUES.md`. It must contain the device
   checklist in §11, with every item marked **UNVERIFIED** until Francis runs it.
   Do not claim behaviour on a device you did not observe.
6. The `PROMPT_LEDGER.md` entry, with its Output section completed (numbering rule: start prompt, step 0).

## 11. Owner device checklist (for the handover; Francis runs it on the phone)
- [ ] Airplane mode on: cues are still spoken.
- [ ] Music playing: it ducks during speech and returns afterwards.
- [ ] A second tap stops speech. Logging a set stops it. Leaving the screen stops it. Backgrounding the app stops it.
- [ ] Starting a second Listen control stops the first.
- [ ] With TalkBack on, the control is announced with its label and speech still plays.
- [ ] "R P E", "Romanian deadlift" and so on sound right.
- [ ] On a phone with no English voice data, or with the TTS engine disabled, no Listen control appears.

## 12. Start prompt for Sol
Paste the block below into a new Codex session opened on the worktree.

```text
You are GPT-5.6 Sol (builder), effort HIGH, working in
C:\Users\fpike\Documents\Claude Coding\Athlete App\.worktrees\ac-wo11-spoken-cues
on branch codex/ac-wo11-spoken-cues (base 6c2fd709, PR target codex/rpe-familiarisation).

Execute docs/WORKORDER_AC_WO11_SPOKEN_CUES_SOL.md end to end. Francis has authorized it.
Read AGENTS.md, then the work order, then only the files it cites.

Order of work:
0. FIRST file write: append a PROMPT_LEDGER.md entry containing this prompt
   verbatim. Number it one above the highest "## Entry NNNN" on any local or
   remote ref, and say why you skipped numbers.
1. Setup: npm ci -> npm run fetch:embedder -> node scripts/verify-preflight.mjs.
   Baseline: npm run typecheck (must be green before you change anything).
2. Pure layer + tests first (spokenText, speech wrapper, ListenButton), then the
   Android module + manifest query + registration, then the call sites.
3. Gates per §5. Break each guard once, record the failure, revert.
4. Commit, then push explicitly: git push -u origin HEAD:codex/ac-wo11-spoken-cues.
   Open a DRAFT PR. Wait for CI (verify + android-apk) and fix until green.
5. Produce the §10 bundle and STOP. Do not merge.

Hard limits: Android only; no npm/Gradle dependency; no network synthesis;
only the files in §6. If anything in §8 happens, STOP and report; do not
invent a workaround.
```
