# Routine contract-cutoff provenance handover

Date: 2026-08-13
Baseline: `d3cab607817ccf8c609e413e5bb13c66c53abb21`
Review range after checkpoint: `d3cab607817ccf8c609e413e5bb13c66c53abb21..HEAD`
Status: implementation and all local repository gates complete; owner review pending

## Outcome

Both independent bounded-microcycle audits reported no P1 or P2 defect. The
Opus report identified one incomplete policy enumeration and one future
self-heal risk in migration 053. This checkpoint corrects both without changing
the routine engine, global role eligibility, the assistance graph, pickers, or
recommendations.

Hermes implemented the initial migration-054 cutoff approach and stopped before
claiming a green full gate. Codex review found that its first cutoff-poison test
allowed a lost cutoff table to recapture the current `MAX(routine_template_id)`;
that could have classified an already-existing post-contract template as
legacy. The final implementation replaces that degradation with a tested
fail-closed repair.

## Delivered contract

- New append-only migration
  `packages/core-db/src/schema/054_contract_cutoff_provenance.sql` captures the
  highest existing AUTOINCREMENT routine-template id exactly once. A fresh
  install captures zero; an upgrade captures every template that existed before
  the compatibility contract landed. No device wall clock is used.
- After migration 053 re-evaluates its historical query during a full replay,
  migration 054 deletes template allowances above the captured cutoff. It also
  deletes reconstructed frozen markers above the cutoff when their source
  template is still identifiable.
- Existing exact pre-contract allowances survive ordinary replay and later
  relationship re-parenting. A frozen marker whose source template was already
  deleted remains preserved because its provenance cannot be reconstructed
  safely.
- The cutoff is stored in a STRICT, WITHOUT ROWID singleton and protected by
  immutable-update and immutable-delete triggers.
- The production migration runner treats the singleton row and both guards as
  sentinels. Loss of the table, row, or either guard commits cutoff zero before
  resetting `user_version` and replaying the chain. This conservative value
  survives even if an earlier replayed migration fails and a later boot retries.
- Missing or corrupted cutoff provenance therefore removes reconstructable
  compatibility rather than expanding it. Migration 053 and all earlier
  migrations remain byte-unchanged.
- The policy now distinguishes selected-day execution/duration gates from
  global structural-dose and stress gates. The superseded historical handover
  carries an explicit correction notice.

Global movement-role counts remain major 79, supplementary 84, accessory 14,
and conditional 12.

## Adversarial evidence

Migration coverage now proves:

1. Fresh install, pre-contract upgrade, replay, and ordinary full self-heal are
   deterministic.
2. Existing exact migration-053 allowances and frozen snapshots survive upgrade
   and replay.
3. A post-contract template cannot become legacy after a relationship is
   re-parented and the full chain self-heals.
4. A reconstructed post-contract frozen marker is pruned while the legitimate
   pre-contract marker is retained.
5. Loss of the cutoff table or singleton row persists zero and does not
   recapture a pre-existing post-contract template.
6. The zero repair survives a deliberately failed early replay and remains in
   force on the successful retry.
7. Loss of an immutability guard plus a deliberately widened cutoff resets to
   zero, restores both guards, and prunes fabricated access.
8. Migration 054 does not alter role counts or global eligibility.

## Verification

- `npm run typecheck`: PASS.
- `npm run verify:migrations`: PASS; `user_version = 53`, 72 sentinels,
  including migration-054 upgrade/replay/table-row-trigger poison and failed
  replay retry coverage.
- `npm run verify:store`: PASS; store SQL 540/540 and routine templates 16/16.
- `npm run verify:pipeline`: PASS; 51 checks against the real 001-054 chain.
- `npm run verify:components`: PASS; 11 suites, 178 tests, 0 snapshots.
- `npm run verify:all`: PASS, exit 0, 124.5 seconds; all 20 repository gates
  plus strict typecheck.

Expected non-failing noise remains the existing React Native Jest `act(...)`
warnings and Node SQLite experimental warning. No native, Gradle, Android, or
ONNX packaging input changed, so native artifacts and device checks were not
rebuilt for this migration/documentation-only checkpoint.

## Known limitations

- If cutoff provenance is lost, fail-closed repair intentionally forfeits
  reconstructable legacy template allowances by setting the boundary to zero.
  The athlete must edit those templates under the current curated contract.
- A frozen allowance whose source template was already deleted remains the only
  trustworthy execution snapshot available and is not deleted speculatively.
- The cutoff assumes application-authored routine templates continue to use the
  table's AUTOINCREMENT identity. Direct database tampering with explicit reused
  ids is outside the product path.
- Sentinel recovery covers the repository's poison model: `user_version`
  claims completion while a required object or row is absent. Simultaneously
  rolling `user_version` back below migration 054 and deleting every 054 object
  is indistinguishable from a legitimate pre-054 upgrade and remains outside
  the supported repair model.
- Migrations 053 and 054 are intended to ship in the same eventual release.
  Templates authored on an internal build in the local checkpoint gap between
  them are conservatively included in the first-run cutoff.
- No current migration removes or re-parents a lift-family or assistance row;
  migration 054 hardens that future operation rather than changing today's
  relationships.
- Embedder revision pinning, release credentials, release-variant acceptance,
  device memory measurement, coefficient calibration, and the parked visual
  checkpoint remain separate pre-release work. No release action is authorized.

## Optional read-only audit prompt

```text
Perform an independent, read-only evidence audit of Athlete Kinetics range
d3cab607817ccf8c609e413e5bb13c66c53abb21..HEAD. Do not edit files, create a
commit, push, sign, upload, publish, or authorize release.

Read AGENT_WORKFLOW.md,
HANDOVER_2026-08-13_ROUTINE_CONTRACT_CUTOFF.md,
docs/decisions/ROUTINE_BOUNDED_MICROCYCLE_POLICY.md,
packages/core-db/src/schema/053_routine_role_compatibility.sql,
packages/core-db/src/schema/054_contract_cutoff_provenance.sql,
packages/core-db/src/migrationRunner.ts, and the migration tests.

Verify from code and read-only gates that migration 054 is append-only and
idempotent; preserves exact pre-contract allowances; prevents a post-contract
template from becoming legacy after relationship change plus self-heal; and
fails closed when the cutoff table, singleton row, or immutability guard is
lost, including across a failed replay retry. Verify frozen source-deletion
behavior, unchanged role counts, the complete global blocker documentation,
and that migration 053 is unchanged.

Report P1 and P2 defects separately with exact file:line evidence,
reproduction, contradicted invariant, and smallest defensible fix. Then report
contradicted claims, non-defect residual risks, and genuinely outstanding tasks.
Say explicitly if no P1/P2 defect exists and exclude style-only advice.
```

## MASTER LEDGER ENTRY

- Input: green checkpoint `d3cab607817ccf8c609e413e5bb13c66c53abb21`, two
  independent no-P1/no-P2 audits, one documentation correction, and one future
  migration-self-heal risk.
- Constraints: offline deterministic runtime, strict TypeScript/SQLite,
  append-only migrations, athlete-local exact compatibility, fail-closed lost
  provenance, no engine or relationship broadening, one unsigned local commit,
  no release action.
- Actions: added migration 054 and runner data/guard sentinels, corrected the
  global-blocker policy, added adversarial upgrade/replay/poison/failure tests,
  and updated real-chain assertions.
- Constraint delta: +1 migration, +3 sentinels (singleton row and two guards),
  no movement-role/relationship/network/native surface change.
- Output: local correction checkpoint ready for owner review. No push, signing,
  upload, publication, or release authorization occurred.
