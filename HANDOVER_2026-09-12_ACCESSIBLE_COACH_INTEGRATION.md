# Accessible Coach Integration Handover — 2026-09-12

## 1. Verdict and boundary

```text
REQUIRED SAME-DAY IMPLEMENTATION SLICE: COMPLETE
HOST VERIFICATION: PASS
ANDROID 4 GB EMULATOR QUALIFICATION: PASS FOR EXERCISED KEYBOARD/ONBOARDING FLOW
SHARED ACTIVITY/CLINICIAN PRODUCT CONTRACT: DEFERRED — OWNER/CLINICAL APPROVAL PENDING
PRODUCT BACKUP/RESTORE: NOT IMPLEMENTED
IOS / SCREEN READER / PHYSICAL DEVICE: NOT TESTED
PUSH / MERGE / RELEASE / C6: NOT PERFORMED
```

Integration branch: `codex/accessible-coach-2026-09-12`. Base: `e8cedca5defb688e1728e7bb917970921481e3f1` (`origin/codex/rpe-familiarisation` at dispatch). The product-code candidate used for the final extended emulator journey is `7f4c8c0446c7b14433225675dd92646b723e899e`.

This handover closes the bounded work that could be implemented without inventing medical rules or silently ratifying a new schema. It does not claim the full consolidated roadmap is release-complete.

## 2. Work-order status

| Work order | Final status | Delivered boundary |
|---|---|---|
| WO-01 Keyboard accessibility | `IMPLEMENTED_AND_TESTED` on Android exercised flow; iOS/AT/numeric device routes untested | Shared keyboard-aware scrolling across the 21 editable call sites; Android shell avoidance; first-tap preservation; landscape extract-mode prevention; source/component gates and native evidence. |
| WO-02 Onboarding clarity | `IMPLEMENTED_AND_TESTED` on Android exercised flow | Weight-loss wording, vertical experience/equipment choices, separate 56 dp information controls, ordinary-language explanations, supportive week copy, Effort teaching, and grouped Ready summary. Training notes are explicitly record-only. Existing Activities is absent until WO-05 exists. |
| WO-03 Backup and restore | `DESIGN_OR_RESEARCH_ONLY` plus tested pure foundation | Canonical JSON, checksum, deterministic envelope validation, durable-data inventory, and replace-only restore model tests. No live database snapshot/restore, UI, picker, encryption, atomic rollback, or phone transfer. |
| WO-04 Evidence/policy | `DESIGN_OR_RESEARCH_ONLY` | Evidence register, source-to-rule matrix, persona/current-policy audit, and D01–D10 docket. No evidence claim was converted to runtime policy. |
| WO-05 Existing activities | `DEFERRED_PENDING_OWNER_OR_CLINICAL_DECISION` | WO-08 supplies the current inventory and proposed taxonomy. No activity schema, recurrence engine, weekly planner input, or onboarding field was added. |
| WO-06 Clinician support | `DESIGN_OR_RESEARCH_ONLY` and `DEFERRED_PENDING_OWNER_OR_CLINICAL_DECISION` for product work | Current entry-point audit, one-contract/Migration-064 design, provenance/conflict/unknown-state rules, and acceptance fixtures. The existing notes copy was corrected; notes remain non-executable. |
| WO-07 Live heart rate | `DEFERRED_PENDING_OWNER_OR_CLINICAL_DECISION` | No live-monitoring implementation or availability claim. Historical biometrics are not represented as live. SpO2 remains excluded. |
| WO-08 Coverage | `DESIGN_OR_RESEARCH_ONLY` | Verified 300 coached movement records and the narrow existing activity logging surface; proposed first activity batch remains unratified. |
| WO-09 Offline animations | `DEFERRED_CAPACITY` | Correctly not started while required owner/clinical and backup work remains. |
| WO-10 Integration | `IMPLEMENTED_AND_TESTED` for the accepted same-day slice | Full host gates, exact QA build/integrity verification, and 4 GB Android emulator evidence. This is not C6 or release approval. |

## 3. Concrete checkpoint delivered

`docs/decisions/ACCESSIBLE_COACH_CHECKPOINT_2026-09-12.md` presents recommended dispositions for every D01–D10 and SC-01–SC-09 decision. It recommends one shared contract and one Migration 064, separate definition/series/occurrence/support identities, explicit unknown/provenance states, fixed-commitment precedence, capture-only clinician state before clinical sign-off, affected-scope holds, and replace-only restore first.

Decision tokens remain `OWNER APPROVAL PENDING` and `CLINICAL APPROVAL PENDING`. Consequently, there is no Migration 064, no production activity/clinician planner integration, and no executable clinical threshold.

## 4. Device findings closed during integration

1. The first APK crashed when a field received focus because React `19.2.7` did not match React Native's embedded renderer `19.1.4`. Root/mobile React and test renderer are now exact `19.1.4`; offline preflight extracts the embedded version and fails closed on mismatch. A temporary `19.2.7` mutation failed that exact gate.
2. After the runtime fix, Android portrait let the IME overlay the onboarding footer. The shell now uses Android height avoidance. The final portrait evidence shows the focused field and Next fully above the IME; one tap advances.
3. Moving from a long onboarding step to the next retained the prior scroll offset and clipped the next heading. The keyed step scroll surface now resets at each step; the limitations heading opens at the top.
4. Gboard used a separate full-screen extract editor in landscape, hiding app context. All 21 product `TextInput` call sites now set `disableFullscreenUI`; a source inventory gate covers every call site and failed when one flag was removed. The rebuilt APK kept the app and focused injury field visible with the landscape IME.

## 5. Verification

| Check | Result |
|---|---|
| `npm ci --dry-run` | PASS |
| Focused keyboard component gate | PASS — 1 suite / 3 tests |
| Landscape inventory negative mutation | PASS — removing one flag made only the new inventory assertion fail; bytes restored before the green run |
| `npm run typecheck` | PASS |
| `git diff --check` | PASS |
| `npm run verify:ci` | PASS — all configured gates; 27 component suites / 467 tests |
| `gradlew app:assembleQa` at product commit `7f4c8c0` | PASS |
| `npm run verify:qa-candidate` at product commit `7f4c8c0` | PASS — exact clean provenance, no INTERNET permission, pinned model/font, four ABIs, v2 debug signature, 16 KB alignment |

The full suite emits existing React Native test warnings about animated updates not wrapped in `act`; all 27 suites and 467 tests pass. Android/Gradle also reports existing deprecation and duplicate SDK-backup warnings; the QA build completes.

## 6. Android evidence

- Emulator: `Codex_Pixel_9_Pro_API_35`, Android 35, `emulator-5554`.
- Memory: `MemTotal: 4013940 kB` (4 GB class).
- Stress geometry: 1080 × 2400 override at 480 dpi (360 dp), portrait locked; font scale 1.30.
- Exercised: clean install/cold launch, name entry, first-tap Next, goal, experience choices and explanation, weekly logistics, equipment choices and explanation controls, explicit limitations answer, multiline injury text, one-tap advance to review, review sections, and portrait-to-landscape retention/context.
- Exact product candidate before documentation closeout: 194,534,980 bytes; SHA-256 `0152cf8a1ab7aec2297afa0e014d4a3e8f132ce007cc5bf4ca0d9b103fdd33b0`; manifest identity `7f4c8c0446c7`, clean fingerprint.
- Evidence directory: `C:\Users\fpike\AppData\Local\Temp\accessible-coach-20260912`.

The final docs-only tip is rebuilt once more after this handover and the append-only ledger closeout commit. Its exact HEAD, APK size, and SHA-256 belong in the user handback rather than this tracked file: adding the generated hash here would change HEAD and invalidate the provenance it claims.

## 7. Files and ownership

Product changes are limited to the mobile shell, the inventoried input-bearing screens/components, glossary/onboarding presentation, exact React dependency alignment, and matching tests/preflight. Backup foundation is isolated under `packages/core-db/src/backup` with its verifier. Evidence, decision, inventory, and handover material is under `docs/research/accessible-coach`, `docs/audits/accessible-coach`, and `docs/decisions`.

No schema, migration, network permission, account, cloud inference, probabilistic recommendation, activity planner, clinician evaluator, live-warning path, or animation asset was added.

## 8. Untested and deferred

- iOS keyboard/safe-area behavior.
- TalkBack/VoiceOver announcements, focus order, and rotor navigation.
- Physical Pixel device execution; the connected physical device was not modified.
- Android device runs for Profile/Session/Routine numeric keyboards and every one of the 21 rendered call sites.
- Real upgrade/restore-to-new-phone journey and all product backup UI/native operations.
- Existing-activity capture, recurrence/DST resolution, duplicate reconciliation, weekly-plan integration, and no-double-counting persona journeys.
- Structured clinician instruction capture, any clinical evaluator, expiry/conflict runtime behavior, and live monitoring.
- C6, release signing, store submission, push, merge, tag, or release.

## 9. Next authorized sequence

1. Francis reviews and records dispositions in `docs/decisions/ACCESSIBLE_COACH_CHECKPOINT_2026-09-12.md`.
2. A qualified clinician reviews D07–D10 and SC-04–SC-06/SC-08 plus any executable screening, unit, warning, and symptom rules.
3. After approval, one integration owner creates the shared contract and Migration 064; WO-05 and WO-06 consume it without parallel schemas.
4. Rerun backup inventory/round trip, activity/persona/boundary gates, and native input evidence after those fields land.
5. Complete physical-device, screen-reader, iOS, upgrade/restore, memory/C6, and release evidence before a release claim.
