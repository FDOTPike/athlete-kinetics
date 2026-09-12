# Accessible Coach Migration 064 — Implementation Handover

## 1. Status and authority

- Date: 2026-09-13.
- Branch: `codex/accessible-coach-2026-09-12`.
- Parent before this slice: `56e76c6fc9b709461cf4629f14811c70c74da533`.
- Controlling product ruling: `docs/decisions/ACCESSIBLE_COACH_ASTRA_OWNER_RULINGS_2026-09-13.md`.
- Decision boundary: bounded capture, factual accounting, and mechanical review holds are authorized. Clinical interpretation is not.
- Status: `IMPLEMENTATION CANDIDATE — INDEPENDENT AUDIT REQUIRED`.
- Push, merge, tag, release, and C6: not performed.

## 2. Implemented in this slice

### 2.1 Shared deterministic contract

- `packages/inference/src/accessibleCoachContract.ts` defines the ratified 15-kind log-only activity vocabulary, nullable whole-session effort, local-civil recurrence facts, stable occurrence origins, user-reported/not-verified support records, explicit scopes and holds, and content-free recommendation provenance.
- `packages/inference/src/activityOccurrences.ts` counts each completed occurrence once, keeps missing duration/effort unknown, rejects duplicate/orphan records, and reconciles sources by exact identity only.
- `packages/inference/src/trainingSupport.ts` performs mechanical scope matching only. Missing contract data returns `support_unavailable`; active unresolved or unscoped holds fail closed athlete-wide; withdrawn and proven-disjoint holds do not block.
- The new contract and functions are exported from `packages/inference/src/index.ts` and compiled by the existing inference test gate.

### 2.2 Migration 064

- `packages/core-db/src/schema/064_accessible_coach_support.sql` is appended after Migration 063; the executable chain now contains 63 migrations and reports `PRAGMA user_version = 63`.
- The migration adds 18 athlete-local durable tables: activity definitions, requirements, series, occurrences, completions, exact source links, separately dated typical-week reports/items, support profile/preferences/notes, clinician instruction envelopes/revisions, holds/scopes, and three content-free recommendation-provenance tables.
- Fixed commitments require an explicit local start. Fixed materialized occurrences require resolved instants and a resolver version. Civil dates reject impossible calendar dates. Occurrence origin identity cannot be relabelled after materialization; aliases cannot reuse another occurrence's origin, and a `coached_session` origin requires an explicit native session link.
- Effort remains nullable and must carry the named/versioned whole-session 1–10 scale when present. No duration-times-effort score is persisted or computed.
- Clinician text is restricted to `user_reported` / `not_verified`. No clearance, screening, diagnosis, numeric medical limit, metric, operator, unit, threshold, or verified-source field/state exists.
- Deleting an instruction removes transcription revisions and instruction-owned scope prose, while preserving a content-free `deleted_support_review` / `support_deleted` marker and any separately recorded hold scope. An unscoped active marker therefore remains athlete-wide.
- Technical bounds are enforced on insertion and owner-changing updates: 256 notes per athlete, 64 instruction envelopes, 64 revisions per envelope, and 256 scopes per instruction revision or hold. Excess is rejected rather than truncated or deleted.
- Every new table and enforcement trigger is registered for production self-heal. Cross-table triggers that would obstruct full replay are dropped only within recovery and recreated before sentinel validation returns control.

### 2.3 Backup inventory integration

- `docs/audits/accessible-coach/WO03_DURABLE_DATA_INVENTORY.md` now enumerates all 104 live durable tables, including the 18-table Migration 064 graph.
- `verify:backup` requires all 103 table sentinels plus the row-sentinel cutoff table to appear in that inventory.
- This is inventory/contract coverage, not a claim that protected native backup exists.

## 3. Verification performed

- `npm run typecheck`: pass.
- `npm run verify:policy`: pass, including the new occurrence-accounting and mechanical-hold tests.
- `npm run verify:migrations`: pass, including fresh install, clean upgrade from the pre-064 chain, no inferred seed data, all-table and all-trigger self-heal, fixed-time/DST-resolution shape, impossible-date rejection, immutable origin, exact source reconciliation, effort-scale pairing, privacy deletion, content-free recommendation provenance, excluded-clinical-column scan, and resource-bound bypass checks.
- `npm run verify:backup`: pass with the 104-table inventory gate.
- `npm run verify:store`: pass, 673/673 checks.
- `npm run verify:pipeline`: pass, 51 checks against the real 001–064 chain.
- `npm run verify:ci`: final exit 0; 27/27 component suites and 467/467 component tests passed.
- `git diff --check`: pass before this handover write.

The first full-CI attempts correctly caught two stale whole-chain assertions that still expected Migration 063/62 executable files. Those gates were advanced to Migration 064/63 files and the final full run passed.

A later in-place SQL edit exposed Jest reusing stale transformed migration bytes: standalone migration tests were green while real-store component boots reported the two newest trigger sentinels missing. A `--no-cache` run immediately passed and identified transformation cache reuse, not a production migration failure. `verify:components` now always uses `--no-cache`, so the ordinary full gate cannot evaluate stale raw-SQL modules.

## 4. Non-vacuity evidence

- Reversing completed-occurrence selection made the new accounting gate fail on completed count, known minutes, missingness, and excluded count.
- Treating withdrawn holds as active made the new support gate fail on the withdrawn/disjoint fixture.
- Allowing `verification_state = 'verified'` made exactly the Migration 064 verified-source rejection check fail.
- Each mutation was removed before the final green runs. No mutation remains in the candidate.

## 5. Explicitly not implemented or authorized

- WO-05 activity capture/edit/calendar UI and store adapter.
- WO-06 support capture UI and mechanical-hold checks at every prospective-advice entry point.
- Clinical interpretation, executable limits, screening, clearance, expiry compatibility decisions, symptom thresholds, live alerts, or condition-specific exercise advice.
- Protected native backup/export/restore, OS document picker, authenticated encryption, recovery snapshot, and phone-to-phone restore.
- Athlete-ID adapter binding verification, merge restore, authentication/app lock, animations, iOS/device accessibility acceptance, C6, release signing, push, merge, tag, or release.

The generic backup contract remains a design/test foundation. Do not describe the product as having backup or restore until the native encrypted adapter and complete round-trip acceptance exist.

## 6. Independent-audit entry points

1. Freeze `HEAD`, tree hash, branch, and `git status --short`; audit the complete range `e8cedca5defb688e1728e7bb917970921481e3f1..HEAD`.
2. Recheck the earlier Opus F1/F2 remediation in commits `e6601d5` and `2619345`, plus the native evidence recorded for `56e76c6`.
3. Compare Migration 064 and TypeScript types against every D01–D10, SC-01–SC-09, and supplemental ruling in the controlling Astra record.
4. Independently inspect all 18 new tables, 13 triggers, replay-blocking trigger registration, all-table sentinels, upgrade behavior, privacy deletion, bounds and recommendation-provenance shape.
5. Prove exclusions from code/schema, not comments: no clinical computation, numeric medical thresholds, verified-source claim, prose execution, fuzzy activity merge, duration-times-effort score, or inferred activity seeding.
6. Treat the unimplemented items in Section 5 as declared boundaries, then report any claim that crosses them.

## 7. Native artifact boundary

The final exact-tip QA APK build and native boot/upgrade result are reported outside this tracked handover after the candidate commit, so writing an artifact hash cannot change the commit it claims to represent. An APK from any earlier tip is not evidence for Migration 064.
