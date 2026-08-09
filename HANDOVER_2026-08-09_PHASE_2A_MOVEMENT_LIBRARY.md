# Phase 2a Movement Library Handover — 2026-08-09

## Outcome

Phase 2a is complete on `codex/phase-2a-movement-library`.

- The live offline movement library contains exactly 300 curated movements: 124 legacy records plus the frozen 176-entry expansion target.
- Migration `036` introduces the STRICT `movement_media` sidecar. Migrations `037`–`048` add the expansion in eleven batches of 15 and one batch of 11.
- All legacy coaching fingerprints and fallback URLs remain unchanged. The 176 additions have unique frozen asset keys, status `planned`, revision `1`, and no fallback URL.
- One shared progressive tier predicate now governs generation, substitution, capability resolution, direct selection, routine/program construction, prescription, and session start.
- The movement library uses a virtualized `SectionList`, independent conjunctive filters, live counts, target-muscle search, canonical equipment tokens, tier-correct defaults, teaching-only explanations, and planned/fallback media behavior.
- The Profile screen contains the free-exercise-db/Unlicense data-source acknowledgement.

## Frozen Phase 2b boundary

Phase 2b may resolve `movement_media.asset_key` values to locally hosted/generated files and advance media status/revision. It must not rewrite Phase 2a coaching fingerprints, movement IDs, or asset keys. New generated videos, local-PC hosting, and Google Drive transfer remain out of Phase 2a.

## Verification

Final source-tree verification:

- `npm run verify:all` — PASS, including typecheck, database/schema, demo, migrations, policy, blocks, autopilot, biometrics, semantic/embedder, store, coach, memory, progression, pipeline, runner/outcomes, library, generator, and components.
- Component result — 8 suites and 135 tests passed. Existing React Native Animated `act(...)` console warnings remain non-failing.
- Migration result — clean `035` to `048` upgrade, exact 300-row corpus, all 12 batch boundaries replay idempotently, and poison-state repair passed.
- Android `:app:assembleDebug` — PASS. APK SHA-256: `20F2B88E0379A1C059A9A3DEB7843795AC0FC2A40ADDA2E6149C0A6F3EF3DB8C`.
- Pixel 9 Pro acceptance — PASS for Beginner, Intermediate, and Advanced defaults; search/filter/detail; tier teaching-only enforcement; planned media; session creation; and manual bodyweight `0.0` presentation.
- Device memory with the full library resident — 253,440 KB Private Dirty (about 247.5 MiB), below the 450 MB dirty-RAM ceiling.

## Next phase

Begin Phase 2b by defining the video-production style guide and acceptance rubric, rendering a small representative pilot set, validating anatomical/safety consistency, then implementing local asset resolution/hosting without changing the frozen Phase 2a keys.
