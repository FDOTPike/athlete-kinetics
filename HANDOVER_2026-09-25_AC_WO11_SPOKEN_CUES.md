# AC-WO11 spoken coaching cues handover — 2026-09-25

## Frozen implementation

- Branch: `codex/ac-wo11-spoken-cues`; base: `6c2fd7092baaf6f85e14cc4624974e83b2a1d6c8`.
- Verified source HEAD: `278cc358b169300065064ff251450ed7307350a6`.
- Verified source tree: `514c5d32560ddc5b08b91e2f1c802063da8ca3ce`.
- Commits: `75abb23e` JS speech contract/control; `b09948f7` Android offline TTS; `278cc358` screen wiring.
- TurboModule codegen was used; the interop fallback was not used.

## Delivered

- A single lazy Android `TextToSpeech` instance, offline-English voice filtering, sentence-boundary chunking, `QUEUE_FLUSH`/`QUEUE_ADD`, utterance events, lifecycle shutdown, `USAGE_ASSISTANT`, and transient may-duck audio focus.
- No audio files, npm/Gradle dependencies, network permission, network synthesis flags, migration, iOS change, or engine/policy change.
- Listen/Stop controls at Session SET UP, Session CUES, the halt card, Library Coaching Cues, and Library Execution Instructions. Empty Library sections have no control.
- Set logging, control/block unmount, navigation/unmount, AppState backgrounding, and native host pause stop speech.
- SET UP speech includes the displayed `coachingIntent` only when numbered setup text exists, followed by those displayed steps.
- Pronunciations: RPE → “R P E”; RIR → “R I R”; RDL → “Romanian deadlift”; DB → “dumbbell”; KB → “kettlebell”; e.g. → “for example”. A replay of all 63 current migrations found no current movement coaching record containing any of those whole tokens; runtime UI/halt text may still contain them.

## Evidence

- Required red observations:
  - Pronunciation mutation: `spokenText.test.js` failed 2 tests (6 passed).
  - Second-tap stop mutation: `ListenButton.test.js` failed 1 test (2 passed).
  - Before screen/native wiring: 3 suites failed, 4 tests failed and 114 passed; both Session controls, the halt control, the Library controls, and the TTS manifest query were absent.
- Restored focused gate: 6 suites passed, 132 tests passed.
- `npm run typecheck`: exit 0 before each implementation commit.
- `npm run verify:ci` at source HEAD/tree above: exit 0; 50 suites passed, 737 tests passed; preflight and every preceding gate passed.
- Standalone React Native codegen completed and generated `NativeSpeechCueSpec` with the expected promise methods and event emitter.
- Local Gradle compile was not evidence: the installed JDK reports 25.0.3/26.0.1 and this Gradle/Kotlin stack fails while parsing that Java version. The authorized `android-apk` CI job remains the compile proof.
- Existing Jest `act(...)`, SafeAreaView deprecation, and monorepo resolution notices remained non-failing and unchanged.

## Residual uncertainty

- Physical-device voice availability, pronunciation quality, volume-stream behavior, music ducking, TalkBack behavior, and lifecycle timing are UNVERIFIED.
- App-side memory adds only the wrapper/control state and one lazy native handle; actual device memory/latency was not measured. The TTS engine process is outside the app process, as designed.
- Independent review is pending. This handover is not self-approval and does not authorize merge or release.

## Owner device checklist — all UNVERIFIED

- [ ] **UNVERIFIED** — Airplane mode on: cues are still spoken.
- [ ] **UNVERIFIED** — Music playing: it ducks during speech and returns afterwards.
- [ ] **UNVERIFIED** — A second tap stops speech. Logging a set stops it. Leaving the screen stops it. Backgrounding the app stops it.
- [ ] **UNVERIFIED** — Starting a second Listen control stops the first.
- [ ] **UNVERIFIED** — With TalkBack on, the control is announced with its label and speech still plays.
- [ ] **UNVERIFIED** — “R P E”, “Romanian deadlift” and the other mappings sound right.
- [ ] **UNVERIFIED** — With no English voice data, or with the TTS engine disabled, no Listen control appears.

## Constraints and publication

- Changed implementation/test paths stay within AC-WO11 §6; `DEVIATION_LOG.md` was not changed because there was no deviation.
- Push is restricted to `git push -u origin HEAD:codex/ac-wo11-spoken-cues`.
- Draft PR target is `codex/rpe-familiarisation`; merge and auto-merge are prohibited.
