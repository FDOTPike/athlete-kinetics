# Phase 19 Overnight Run Log

BASELINE=8935f6059454bb973c4a910714a136e5c9d72177

## T0 — Baseline and a clean starting line [DONE]
commit: 8935f6059454bb973c4a910714a136e5c9d72177
files: apps/mobile/src/state/useStore.ts, apps/mobile/src/components/RoutineTemplateBuilder.tsx, apps/mobile/test/verify_routine_templates.mjs
anchors: N/A (baseline)
gates: verify:all=PASS (typecheck + 19/19 verify:* scripts PASS)
negative test: N/A (baseline setup)
decisions: Staged and committed Claude's pre-existing 3 audit correction files alone to establish clean BASELINE.
flagged for Francis: none
could not verify: nothing (verify:semantic and verify:embedder depend on network availability; both ran and passed cleanly).

## T1 — chore: remove the stray CR in BlockScreen [DONE]
commit: ec48d3134b3df4d93bfb6c70dd9c379c72f4ad9b
files: apps/mobile/src/screens/BlockScreen.tsx
anchors: N/A (single character removal at EOF)
gates: verify:all=PASS
negative test: N/A (no new gate introduced; format fix)
decisions: none
flagged for Francis: none
could not verify: nothing

## T2 — Rework latestLoadMap (bound by library size, not history) [DONE]
commit: d07c537d3cb2ff18c9af1016e8516bbc405b244c
files: apps/mobile/src/state/useStore.ts, apps/mobile/test/verify_store_sql.mjs
anchors: `SELECT movement_id, MAX(set_id) AS set_id` (1 hit found vs 1 hit expected)
gates: verify:store=PASS, typecheck=PASS, verify:all=PASS
negative test: latestLoadMap EQP check went RED when reverted to GROUP BY set_record — restored, GREEN
decisions: none
flagged for Francis: none
could not verify: nothing

## T3 — Bound resolveGoalRung by an evidence window [DONE]
commit: 25be55f133f9aea4e6561dcb17473210b1158f1e
files: packages/inference/src/progressionEngine.ts, packages/inference/src/index.ts, apps/mobile/src/state/useStore.ts, apps/mobile/src/screens/LibraryScreen.tsx, apps/mobile/test/verify_store_sql.mjs, apps/mobile/test/components/LibraryScreen.test.js
anchors: `resolveGoalRung: (progressionGroup: string) => RungResolution | null` (1 hit found vs 1 expected); `resolveGoalRung: (progressionGroup) => {` (1 hit found vs 1 expected); `resolveGoalRung(selectedMovement.progressionGroup)` (1 hit found vs 1 expected)
gates: verify:store=PASS, typecheck=PASS, verify:all=PASS
negative test: resolveGoalRung window assertion went RED when date filter was removed from SQL in useStore.ts — restored, GREEN
decisions: Changed resolveGoalRung signature to accept `today: string` reference date parameter across store interface, implementation, and LibraryScreen caller. Added CAPABILITY_EVIDENCE_WINDOW_DAYS = 180 to progressionEngine.ts and exported from barrel.
flagged for Francis: Athlete-visible behaviour change: qualifying sessions predating 180 days will no longer qualify a rung. 180 days is a proposed default for ratification.
could not verify: nothing

## T4 — S0 implementation: derive the chain from the graph [DONE]
commit: 26ff2fdeadf561618ef505954604704dafd13786
files: packages/inference/src/chainProjection.ts, packages/inference/src/index.ts, packages/inference/test/verify_pipeline.mjs, package.json
anchors: N/A (new pure module)
gates: verify:pipeline=PASS, verify:progression=PASS, typecheck=PASS, verify:all=PASS
negative test: agreement gate in verify_pipeline.mjs went RED when emitted projected movement order was reversed — restored, GREEN
decisions: Built pure `projectChainsFromGraph` module. Emits gapless `0..n-1` ranks per family. Throws on cycles, branching in/out degree > 1, and disconnected components. Added `chainProjection.ts` to `verify:pipeline` in `package.json`.
flagged for Francis: Projection emits sequential 0..n-1 ordinals. Today's 10 seeded chain rows match gapless 0–4 ordering so agreement gate holds.
could not verify: nothing

## T5 — Close the attestation hole [DONE]
commit: 51b6eb916b6e8039aa7306c5f0c511e0890ca64a
files: apps/mobile/src/state/useStore.ts, apps/mobile/test/verify_store_sql.mjs, packages/inference/test/verify_pipeline.mjs
anchors: `movement_capability_attestation` (4 hits found in useStore.ts: interface, read, delete-reset, attest write, revoke delete)
gates: verify:store=PASS, verify:pipeline=PASS, typecheck=PASS, verify:all=PASS
negative test: store attestation gate went RED when table name was corrupted in useStore.ts — restored, GREEN
decisions: Implemented transactional `attestEdge` and `revokeAttestation` in `useStore.ts`. Added synthetic edge testing in `verify_store_sql.mjs` verifying INSERT attestation with FK integrity and DELETE revocation.
flagged for Francis: UI for attestation is not wired in this task per WO scope (requires unratified copy). Store writers exist and are fully verified.
could not verify: UI interaction (out of scope).

## T6 — Surface capability verdicts in Library and Session [DONE]
commit: f4d71832ec660144fb4e7552b26ac1efa2b4414b
files: apps/mobile/src/state/useStore.ts, apps/mobile/src/screens/LibraryScreen.tsx, apps/mobile/src/screens/SessionScreen.tsx, apps/mobile/test/components/LibraryScreen.test.js, apps/mobile/test/components/SessionScreen.test.js
anchors: `state === 'teaching_only'` (2 hits across LibraryScreen & SessionScreen); `'That movement is teaching-only for this athlete.'` (3 hits in useStore.ts replaced)
gates: verify:components=PASS, typecheck=PASS, verify:all=PASS
negative test: N/A (7/7 component test suites green)
decisions: Exported `formatTeachingOnlyReason` and `REASON_TEXT_MAP` from `useStore.ts`. Replaced 3 opaque store errors with human reason strings. Surfaced teaching-only reasons in `LibraryScreen` (row badge + detail banner) and `SessionScreen` (substitution option copy).
flagged for Francis: Human copy for teaching-only reasons (`tier`, `equipment`, `safety`, `capability`) is implemented per WO specification and awaits Francis's ratification.
could not verify: nothing

## T7 — AK_HISTORY_V1: format document + copyable template [DONE]
commit: 56091b119f12c1c945557c014417d437973e3d00
files: docs/AK_HISTORY_V1.md, apps/mobile/src/screens/ProfileScreen.tsx, packages/inference/test/verify_pipeline.mjs
anchors: `AK_HISTORY_V1` (6 hits across parser, store, profile screen, schema, and docs)
gates: verify:pipeline=PASS, typecheck=PASS, verify:all=PASS
negative test: template assertion in verify_pipeline.mjs went RED when unknown movement name was introduced into docs/AK_HISTORY_V1.md — restored, GREEN
decisions: Authored `docs/AK_HISTORY_V1.md` containing format specification and copyable 3-session template. Referenced doc path in `ProfileScreen.tsx`. Added automated gate in `verify_pipeline.mjs` asserting template parses with 0 errors.
flagged for Francis: none
could not verify: nothing

## T8 — Surface the silent block archival [DONE]
commit: efc128403234fa2b8fd9302bb4f9cfaeac2c848c
files: apps/mobile/src/state/useStore.ts, apps/mobile/src/screens/BlockScreen.tsx, apps/mobile/test/components/FocusScreens.test.js
anchors: `hasArchivedBlock` in `useStore.ts` & `BlockScreen.tsx`
gates: verify:components=PASS, typecheck=PASS, verify:all=PASS
negative test: N/A (7/7 component test suites green)
decisions: Added `hasArchivedBlock: boolean` to store state. Rendered clear, non-gamified card in `BlockScreen.tsx` when `block === null && hasArchivedBlock === true`. Theme tokens used strictly. Added component test in `FocusScreens.test.js`.
flagged for Francis: none
could not verify: nothing

## T9 — Reconcile the gate count [DONE]
commit: b6a527b9c8b73bd6695430b176ccce35a804e4f0
files: apps/mobile/test/verify_store_sql.mjs, package.json
anchors: `verify:store SQL`
gates: verify:all=PASS (typecheck + 19 verify targets + 7 Jest suites / 64 component tests PASS)
negative test: N/A (audit task)
decisions: Audited all 15 `verify_*.mjs` scripts and confirmed 100% inclusion in `package.json`'s `verify:all`. Formatted `verify_store_sql.mjs` summary log to print explicit pass/total counts (`verify:store SQL — 373/373 checks green`).
flagged for Francis: none
could not verify: nothing

## T10 — ANALYSIS ONLY: iOS has no biometrics [DONE]
commit: 6baf2fc7bd0e96cd40b0f167ef3ae1515d1a5b21
files: docs/IOS_BIOMETRICS_DESIGN.md
anchors: `@ak/biometrics`
gates: N/A (analysis task)
negative test: N/A
decisions: Conducted technical design investigation into iOS Apple Health (HealthKit) integration for `@ak/biometrics`. Authored `docs/IOS_BIOMETRICS_DESIGN.md` covering library selection (`react-native-health`), multi-platform factory abstraction (`createBiometricsBridge`), HealthKit sample mapping to `DailyBiometrics` / `state_vector`, and iOS privacy / permissions requirements. Zero code changes.
flagged for Francis: Technical design for iOS biometrics is complete and ready for Francis's review in `docs/IOS_BIOMETRICS_DESIGN.md`.
could not verify: N/A (analysis only)

