# WO-08 activity and movement coverage inventory handover

Date: 2026-09-12 (Australia/Sydney). Branch: `codex/ac-wo08-inventory`. Frozen base: `cc39b1560947804a9dcb20261bb2e5b34cdf84f0`.

## Outcome

WO-08 inventory and implementation-ready curation design are complete. The coverage audit is at `docs/audits/accessible-coach/WO08_ACTIVITY_MOVEMENT_COVERAGE.md`.

No product behavior shipped. No movement, taxonomy, equipment, eligibility, whitelist, schema, migration, generator, store, profile, UI, package or native file changed. The only proposed records are a clearly marked, pending-ratification batch of 15 log-only activity kinds plus supporting vocabulary candidates.

## What the audit establishes

- The live corpus has 300 coached movements with complete detail, taxonomy and coaching content, 401 equipment rows across 11 strength-equipment tokens, and six time-mode movements.
- Sport tracking is exactly three movement rows: BJJ sparring, road running and combined trail running/walking.
- Generic walking, swimming, cycling, existing external gym sessions, common team sports, wheelchair/adaptive activity and custom activity are not implemented as persisted activity/occurrence kinds at frozen base `cc39b15`.
- No facility vocabulary exists in the scoped product/schema source. Pool access cannot honestly be encoded as strength equipment.
- The combined trail running/walking identity and nearby strength session/time fields need adaptation; they are not evidence of a general activity contract.
- Sport/activity logging is explicitly separated from coached exercise records. Activity kinds carry no exercise instructions, sets, default duration, default effort, progression or suitability claim.
- No exhaustive sport coverage is claimed. The proposed `custom` fallback is the bounded completeness mechanism.

## Judgment calls for review

1. **Recommended first slice:** ratify a log-only activity catalogue/occurrence contract before adding new sport movements. The proposed first batch covers walking, running, swimming, cycling, external strength training, seven common team sports, wheelchair mobility/sport and custom activity.
2. **Keep facilities separate:** proposed pool/open-water/route/court/field/gym facility IDs and bicycle/handcycle/wheelchair activity-equipment IDs must not widen `EQUIPMENT_ITEMS` or alter movement executability.
3. **Preserve shipped rows:** do not rename/split `Trail Running/Walking` or add `movement_sport_tracking` memberships without an append-only lineage and owner review. Sport membership bypasses ordinary difficulty-tier limits.
4. **Defer adaptive prescriptions:** logging must remain available without disability-based exclusion, but wheelchair/adaptive movement suitability requires terminology co-design, qualified review and entry-point validation.
5. **Defer cycling movement imports:** quarantined Air Bike/Bicycling/Stationary/Recumbent Bike names should become activity modality context, not three assumed-equivalent coached prescriptions.
6. **Chair Squat:** return it to later movement curation after chair/bench/bodyweight equipment truth and adaptive instruction review. No beginner-whitelist change is proposed.

All proposed IDs/vocab remain **pending shared-contract ratification**. The shared docket is still `PROPOSED — NOT RATIFIED`; migration 064 remains owned/reserved by the integration owner.

## Verification evidence

- `npm run typecheck`: passed after both assigned documents were written; final run performed immediately before commit.
- `npm run verify:library`: passed all sections on SQLite 3.50.4, including exact 300-row corpus, complete coaching/taxonomy, 11-item equipment union, ratified eight-row beginner whitelist, six time-mode rows, and exact three-row sport-tracking set.
- Read-only citation/source checker: 51 exact full-path citations found in the coverage audit; zero missing files or out-of-range line references. WO-04 counts reproduced as 11 external entries, two local heuristic entries and 13 source-to-rule rows.
- In-memory SQL/JSON inventory: reproduced 300 live movements, 401 equipment rows, six time-mode movements, three sport rows, 21 multi-row taxonomy families/49 rows, 20 repeated-base clusters/42 rows, 434 import rows, 441 quarantine rows, two prefix-encoded names and six `do_not_seed` names.
- Scoped absence search found zero relevant facility/pool-access/wheelchair/adaptive-activity/activity-kind/occurrence tokens in product/schema source; the coverage audit records the exact bounded search.
- No device, UI, clinical, native, release or new activity behavior was tested or claimed.

## Integration-owner checklist

1. Obtain Francis's disposition on the shared-contract docket and proposed batch/vocab; retain `unknown` and custom names.
2. Keep migration 064 centrally owned. Do not copy proposed IDs into SQL until the contract, backup ownership and occurrence identity are ratified.
3. Implement the activity occurrence path separately from movement/set records, including planned/actual/cancelled/missed states, fixed/flexible local time, timezone identity and explicit dedup links.
4. Preserve whole-session effort as separately scoped optional data; no RIR conversion, cross-sport equivalence or clinical safety score.
5. Add deterministic acceptance cases from the audit, then run persistence, backup, policy, library, component and integration gates as applicable.
6. Reconcile legacy road/BJJ/trail movement history explicitly; no destructive rename or fuzzy conversion.
7. Keep the beginner whitelist unchanged unless Francis separately ratifies a movement-policy change.

## Files

- Added: `docs/audits/accessible-coach/WO08_ACTIVITY_MOVEMENT_COVERAGE.md`
- Added: `HANDOVER_2026-09-12_WO08_INVENTORY.md`

## MASTER LEDGER ENTRY

Input state: frozen base `cc39b1560947804a9dcb20261bb2e5b34cdf84f0`, isolated branch `codex/ac-wo08-inventory`, clean start. Constraints enforced: exact two documentation writes only; inventory/design only; no product/SQL/migration/generator/store/profile/UI/package/native/movement-eligibility/whitelist edits; no PROMPT_LEDGER edit; no push/merge/rebase/tag/release; no exhaustive sport, clinical-safety or prescription claim. Actions: mechanically inventoried the 300-row movement corpus, taxonomy, 11-token equipment domain, absent facility/activity contract, exact three sport rows, quarantine/duplicate controls and WO-04 evidence boundary; authored a strict five-class coverage matrix, proposed pending-ratification 15-kind log-only batch, validation cases and deferred ledger. Verification: typecheck and `verify:library` passed; 51 full-path citations and WO-04/source counts mechanically validated; final `git diff --check` and scoped status recorded before commit. Judgment calls: activity-first curation, custom fallback in batch one, separate facility/activity-equipment vocabulary, no sport-membership or adaptive-prescription change. RAM/latency/constraint deltas: documentation only; zero runtime, bundle, database, memory or latency change. Status: WO-08 inventory complete; owner/shared-contract checkpoint required before implementation.
